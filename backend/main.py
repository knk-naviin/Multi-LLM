import asyncio
import logging
from datetime import timezone
from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from pymongo import ASCENDING, DESCENDING

from auth_utils import (
    create_jwt_token,
    decode_jwt_token,
    hash_password,
    hash_session_token,
    normalize_email,
    utc_now,
    validate_email,
    verify_password,
)
from benchmark_model import benchmark_model
from config import (
    CORS_ALLOW_ORIGIN_REGEX,
    FRONTEND_ORIGINS,
    GOOGLE_CLIENT_ID,
    JWT_EXPIRE_HOURS,
    JWT_SECRET,
    MONGODB_DB,
    MONGODB_URI,
)
from db_utils import (
    parse_object_id,
    serialize_chat_full,
    serialize_chat_summary,
    serialize_folder,
    serialize_project,
    serialize_user,
    utc_iso,
)
from models.claude import call_claude
from models.gemini import GeminiRateLimitError, call_gemini, can_call_gemini
from models.gpt import call_gpt
from router import rank_models

app = FastAPI(title="Swastik Ai API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_origin_regex=CORS_ALLOW_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ChatCompleteRequest(BaseModel):
    prompt: Optional[str] = None
    query: Optional[str] = None
    text: Optional[str] = None
    forced_model: Optional[str] = None
    chat_id: Optional[str] = None
    folder_id: Optional[str] = None
    project_id: Optional[str] = None
    store: bool = False


class AuthSignupRequest(BaseModel):
    name: str
    email: str
    password: str


class AuthLoginRequest(BaseModel):
    email: str
    password: str


class AuthGoogleRequest(BaseModel):
    credential: str


class ProjectCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class FolderCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""


class FolderUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class SettingsNotificationsUpdateRequest(BaseModel):
    email_digest: Optional[bool] = None
    browser_push: Optional[bool] = None
    product_updates: Optional[bool] = None
    weekly_recap: Optional[bool] = None


class SettingsPrivacyUpdateRequest(BaseModel):
    share_analytics: Optional[bool] = None
    improve_model: Optional[bool] = None


class SettingsSecurityUpdateRequest(BaseModel):
    two_factor_enabled: Optional[bool] = None


class SettingsUpdateRequest(BaseModel):
    preferred_model: Optional[str] = None
    theme: Optional[str] = None
    auto_store_chats: Optional[bool] = None
    language: Optional[str] = None
    density: Optional[str] = None
    notifications: Optional[SettingsNotificationsUpdateRequest] = None
    privacy: Optional[SettingsPrivacyUpdateRequest] = None
    security: Optional[SettingsSecurityUpdateRequest] = None


class ChatCreateRequest(BaseModel):
    title: Optional[str] = ""
    folder_id: Optional[str] = None
    project_id: Optional[str] = None


def _extract_prompt(request: ChatCompleteRequest) -> str:
    prompt = request.prompt or request.query or request.text or ""
    prompt = prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    return prompt


def _title_from_prompt(prompt: str) -> str:
    compact = " ".join(prompt.split())
    return (compact[:80] + "...") if len(compact) > 80 else compact


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    if not authorization.startswith("Bearer "):
        return None
    token = authorization.replace("Bearer ", "", 1).strip()
    return token or None


def _as_utc_aware(value):
    if value is None:
        return None
    if getattr(value, "tzinfo", None) is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _field_present(model: BaseModel, field_name: str) -> bool:
    fields_set = getattr(model, "model_fields_set", getattr(model, "__fields_set__", set()))
    return field_name in fields_set


def _default_user_settings() -> Dict[str, Any]:
    return {
        "preferred_model": None,
        "theme": "dark",
        "auto_store_chats": True,
        "language": "en",
        "density": "comfortable",
        "notifications": {
            "email_digest": True,
            "browser_push": False,
            "product_updates": True,
            "weekly_recap": False,
        },
        "privacy": {
            "share_analytics": True,
            "improve_model": False,
        },
        "security": {
            "two_factor_enabled": False,
        },
    }


def _sanitize_user_settings(raw_settings: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    defaults = _default_user_settings()
    if not isinstance(raw_settings, dict):
        return defaults

    preferred_model = raw_settings.get("preferred_model")
    if preferred_model in {None, "gpt", "gemini", "claude"}:
        defaults["preferred_model"] = preferred_model

    theme = raw_settings.get("theme")
    if theme in {"light", "dark"}:
        defaults["theme"] = theme

    auto_store = raw_settings.get("auto_store_chats")
    if isinstance(auto_store, bool):
        defaults["auto_store_chats"] = auto_store

    language = raw_settings.get("language")
    if isinstance(language, str) and language.strip():
        defaults["language"] = language.strip().lower()

    density = raw_settings.get("density")
    if density in {"comfortable", "compact", "spacious"}:
        defaults["density"] = density

    raw_notifications = raw_settings.get("notifications")
    if isinstance(raw_notifications, dict):
        for key in defaults["notifications"]:
            value = raw_notifications.get(key)
            if isinstance(value, bool):
                defaults["notifications"][key] = value

    raw_privacy = raw_settings.get("privacy")
    if isinstance(raw_privacy, dict):
        for key in defaults["privacy"]:
            value = raw_privacy.get(key)
            if isinstance(value, bool):
                defaults["privacy"][key] = value

    raw_security = raw_settings.get("security")
    if isinstance(raw_security, dict):
        for key in defaults["security"]:
            value = raw_security.get(key)
            if isinstance(value, bool):
                defaults["security"][key] = value

    return defaults


def get_db(request: Request):
    db = getattr(request.app.state, "db", None)
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable. Guest chat works, but sign-in/storage is offline.",
        )
    return db


async def get_optional_auth(
    request: Request, authorization: Optional[str] = Header(default=None)
):
    db = getattr(request.app.state, "db", None)
    if db is None:
        return None

    bearer = _extract_bearer_token(authorization)
    if not bearer:
        return None

    try:
        claims = decode_jwt_token(bearer, JWT_SECRET)
    except Exception:  # noqa: BLE001
        return None

    try:
        user_id = parse_object_id(claims.get("sub"), "token_sub")
    except HTTPException:
        return None
    if user_id is None:
        return None

    token_jti = claims.get("jti")
    if not isinstance(token_jti, str) or not token_jti:
        return None

    session = await db.sessions.find_one(
        {
            "token_hash": hash_session_token(token_jti),
            "user_id": user_id,
        }
    )
    if not session:
        return None

    now = utc_now()
    expires_at = _as_utc_aware(session.get("expires_at"))
    if expires_at and expires_at < now:
        await db.sessions.delete_one({"_id": session["_id"]})
        return None

    user = await db.users.find_one({"_id": user_id})
    if not user:
        return None

    return {"user": user, "token_jti": token_jti}


async def get_current_auth(optional_auth=Depends(get_optional_auth)):
    if not optional_auth:
        raise HTTPException(status_code=401, detail="Authentication required")
    return optional_auth


async def _issue_auth_token(db, user_doc: Dict[str, Any]) -> str:
    token, token_jti, expires_at = create_jwt_token(
        user_id=str(user_doc["_id"]),
        email=user_doc.get("email", ""),
        secret=JWT_SECRET,
        expires_hours=JWT_EXPIRE_HOURS,
    )

    await db.sessions.insert_one(
        {
            "token_hash": hash_session_token(token_jti),
            "user_id": user_doc["_id"],
            "created_at": utc_now(),
            "expires_at": expires_at,
        }
    )
    return token


async def _resolve_folder_oid(
    db,
    user_id,
    folder_id: Optional[str] = None,
    project_id: Optional[str] = None,
):
    raw_value = folder_id or project_id
    if not raw_value:
        return None

    folder_oid = parse_object_id(raw_value, "folder_id")
    if folder_oid is None:
        return None

    folder_doc = await db.folders.find_one({"_id": folder_oid, "user_id": user_id})
    if folder_doc:
        return folder_oid

    # Compatibility: support legacy projects records as folders.
    legacy_project = await db.projects.find_one({"_id": folder_oid, "user_id": user_id})
    if legacy_project:
        return folder_oid

    raise HTTPException(status_code=404, detail="Folder not found")


def _verify_google_credential(credential: str) -> Dict[str, Any]:
    try:
        token_info = google_id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID or None,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail=f"Invalid Google credential: {exc}") from exc

    issuer = token_info.get("iss")
    if issuer not in {"accounts.google.com", "https://accounts.google.com"}:
        raise HTTPException(status_code=401, detail="Invalid Google issuer")

    email = normalize_email(token_info.get("email", ""))
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    if not token_info.get("email_verified", False):
        raise HTTPException(status_code=400, detail="Google email is not verified")

    sub = token_info.get("sub")
    if not sub:
        raise HTTPException(status_code=400, detail="Google account identifier missing")

    return token_info


async def _run_model(model_name: str, prompt: str) -> str:
    if model_name == "gemini":
        allowed, retry_after = can_call_gemini()
        if not allowed:
            raise GeminiRateLimitError(
                f"gemini skipped by local rate limit (retry in ~{retry_after:.1f}s)"
            )
        return await asyncio.to_thread(call_gemini, prompt)

    if model_name == "gpt":
        return await asyncio.to_thread(call_gpt, prompt)

    if model_name == "claude":
        return await asyncio.to_thread(call_claude, prompt)

    raise RuntimeError(f"Unsupported model: {model_name}")


async def _generate_response(prompt: str, forced_model: Optional[str] = None) -> Dict[str, Any]:
    started = utc_now()
    routing = rank_models(prompt)
    ranking = routing["ranking"]

    if forced_model:
        forced = forced_model.strip().lower()
        supported = {entry["model"] for entry in ranking}
        if forced not in supported:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported forced_model. Allowed: {sorted(supported)}",
            )
        candidate_models = [forced] + [entry["model"] for entry in ranking if entry["model"] != forced]
    else:
        candidate_models = [entry["model"] for entry in ranking]

    errors = []
    selected_model = None
    final_response = None

    for model_name in candidate_models:
        try:
            final_response = await _run_model(model_name, prompt)
            selected_model = model_name
            break
        except GeminiRateLimitError as exc:
            errors.append(f"{model_name}: {exc}")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{model_name}: {exc}")

    if final_response is None or selected_model is None:
        raise HTTPException(status_code=503, detail=f"All providers failed: {errors}")

    elapsed = (utc_now() - started).total_seconds()

    return {
        "selector": routing.get("selector", "benchmarkModel"),
        "selector_source": routing.get("source"),
        "selector_confidence": routing.get("confidence"),
        "domain": routing.get("domain"),
        "domain_ranking": routing.get("domain_ranking", []),
        "model_selected": selected_model,
        "model_ranking": ranking,
        "fallback_errors": errors,
        "response_time_seconds": round(elapsed, 2),
        "response": final_response,
    }


async def _persist_chat_turn(
    db,
    user_id,
    prompt: str,
    assistant_response: str,
    model_selected: str,
    chat_id: Optional[str] = None,
    folder_id: Optional[str] = None,
    project_id: Optional[str] = None,
) -> str:
    now = utc_now()

    folder_oid = await _resolve_folder_oid(
        db=db,
        user_id=user_id,
        folder_id=folder_id,
        project_id=project_id,
    )

    chat_oid = parse_object_id(chat_id, "chat_id") if chat_id else None
    if chat_oid:
        chat_doc = await db.chats.find_one({"_id": chat_oid, "user_id": user_id})
        if not chat_doc:
            raise HTTPException(status_code=404, detail="Chat not found")
    else:
        insert_payload = {
            "user_id": user_id,
            "folder_id": folder_oid,
            "title": _title_from_prompt(prompt),
            "messages": [],
            "created_at": now,
            "updated_at": now,
        }
        inserted = await db.chats.insert_one(insert_payload)
        chat_oid = inserted.inserted_id

    set_update = {"updated_at": now}
    if folder_oid is not None:
        set_update["folder_id"] = folder_oid

    await db.chats.update_one(
        {"_id": chat_oid, "user_id": user_id},
        {
            "$set": set_update,
            "$push": {
                "messages": {
                    "$each": [
                        {
                            "role": "user",
                            "content": prompt,
                            "model_used": None,
                            "created_at": now,
                        },
                        {
                            "role": "assistant",
                            "content": assistant_response,
                            "model_used": model_selected,
                            "created_at": now,
                        },
                    ]
                }
            },
        },
    )

    return str(chat_oid)


@app.on_event("startup")
async def on_startup():
    app.state.mongo_client = AsyncIOMotorClient(MONGODB_URI)
    app.state.db = None

    try:
        db = app.state.mongo_client[MONGODB_DB]
        await db.command("ping")
        await db.users.create_index("email", unique=True)
        await db.users.create_index("google_sub", unique=True, sparse=True)
        await db.sessions.create_index("token_hash", unique=True)
        await db.sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.folders.create_index([("user_id", ASCENDING), ("updated_at", DESCENDING)])
        await db.projects.create_index([("user_id", ASCENDING), ("updated_at", DESCENDING)])
        await db.chats.create_index([("user_id", ASCENDING), ("updated_at", DESCENDING)])
        app.state.db = db
        logger.info("MongoDB connected")
    except Exception as exc:  # noqa: BLE001
        logger.warning("MongoDB unavailable at startup: %s", exc)


@app.on_event("shutdown")
async def on_shutdown():
    mongo_client = getattr(app.state, "mongo_client", None)
    if mongo_client:
        mongo_client.close()


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"ok": False, "error": str(exc.detail)})


@app.exception_handler(Exception)
async def generic_exception_handler(_: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"ok": False, "error": "Internal server error"})


@app.get("/")
async def root_redirect():
    return {
        "ok": True,
        "service": "swastik-ai-backend",
        "message": "API is running",
    }


@app.post("/api/auth/signup")
async def auth_signup(payload: AuthSignupRequest, db=Depends(get_db)):
    name = payload.name.strip()
    email = normalize_email(payload.email)
    password = payload.password

    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters")
    if not validate_email(email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    now = utc_now()
    user_doc = {
        "name": name,
        "email": email,
        "password_hash": hash_password(password),
        "auth_provider": "password",
        "settings": _default_user_settings(),
        "created_at": now,
    }
    inserted = await db.users.insert_one(user_doc)
    user_doc["_id"] = inserted.inserted_id

    token = await _issue_auth_token(db, user_doc)

    return {
        "ok": True,
        "token": token,
        "user": serialize_user(user_doc),
    }


@app.post("/api/auth/login")
async def auth_login(payload: AuthLoginRequest, db=Depends(get_db)):
    email = normalize_email(payload.email)
    password = payload.password

    user_doc = await db.users.find_one({"email": email})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    password_hash = user_doc.get("password_hash")
    if not password_hash:
        raise HTTPException(status_code=401, detail="This account uses Google sign-in")

    if not verify_password(password, password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = await _issue_auth_token(db, user_doc)

    return {"ok": True, "token": token, "user": serialize_user(user_doc)}


@app.post("/api/auth/google")
async def auth_google(payload: AuthGoogleRequest, db=Depends(get_db)):
    credential = payload.credential.strip()
    if not credential:
        raise HTTPException(status_code=400, detail="Google credential is required")

    token_info = _verify_google_credential(credential)
    email = normalize_email(token_info.get("email", ""))
    google_sub = token_info.get("sub")
    display_name = (token_info.get("name") or email.split("@")[0] or "User").strip()

    now = utc_now()
    user_doc = await db.users.find_one({"email": email})
    if user_doc:
        existing_google_sub = user_doc.get("google_sub")
        if existing_google_sub and existing_google_sub != google_sub:
            raise HTTPException(status_code=409, detail="Google account mismatch for this email")

        updates = {
            "auth_provider": "google",
            "google_sub": google_sub,
            "updated_at": now,
        }
        if not user_doc.get("name"):
            updates["name"] = display_name

        await db.users.update_one({"_id": user_doc["_id"]}, {"$set": updates})
        user_doc = await db.users.find_one({"_id": user_doc["_id"]})
    else:
        user_doc = {
            "name": display_name,
            "email": email,
            "auth_provider": "google",
            "google_sub": google_sub,
            "settings": _default_user_settings(),
            "created_at": now,
            "updated_at": now,
        }
        inserted = await db.users.insert_one(user_doc)
        user_doc["_id"] = inserted.inserted_id

    token = await _issue_auth_token(db, user_doc)
    return {"ok": True, "token": token, "user": serialize_user(user_doc)}


@app.post("/api/auth/logout")
async def auth_logout(current_auth=Depends(get_current_auth), db=Depends(get_db)):
    await db.sessions.delete_one({"token_hash": hash_session_token(current_auth["token_jti"])})
    return {"ok": True, "message": "Logged out"}


@app.get("/api/auth/me")
async def auth_me(current_auth=Depends(get_current_auth)):
    return {"ok": True, "user": serialize_user(current_auth["user"])}


@app.get("/api/auth/sessions")
async def list_auth_sessions(current_auth=Depends(get_current_auth), db=Depends(get_db)):
    current_hash = hash_session_token(current_auth["token_jti"])
    cursor = db.sessions.find({"user_id": current_auth["user"]["_id"]}).sort("created_at", DESCENDING)

    sessions = []
    async for session in cursor:
        sessions.append(
            {
                "id": str(session["_id"]),
                "created_at": utc_iso(_as_utc_aware(session.get("created_at"))),
                "expires_at": utc_iso(_as_utc_aware(session.get("expires_at"))),
                "current": session.get("token_hash") == current_hash,
            }
        )

    return {"ok": True, "sessions": sessions}


@app.post("/api/auth/logout-all")
async def auth_logout_all(current_auth=Depends(get_current_auth), db=Depends(get_db)):
    current_hash = hash_session_token(current_auth["token_jti"])
    result = await db.sessions.delete_many(
        {
            "user_id": current_auth["user"]["_id"],
            "token_hash": {"$ne": current_hash},
        }
    )
    return {"ok": True, "revoked_sessions": result.deleted_count}


@app.delete("/api/auth/sessions/{session_id}")
async def auth_revoke_session(
    session_id: str,
    current_auth=Depends(get_current_auth),
    db=Depends(get_db),
):
    session_oid = parse_object_id(session_id, "session_id")
    current_hash = hash_session_token(current_auth["token_jti"])

    session_doc = await db.sessions.find_one(
        {
            "_id": session_oid,
            "user_id": current_auth["user"]["_id"],
        }
    )
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")

    if session_doc.get("token_hash") == current_hash:
        raise HTTPException(status_code=400, detail="Cannot revoke current session")

    await db.sessions.delete_one({"_id": session_oid})
    return {"ok": True, "message": "Session revoked"}


@app.get("/api/settings")
async def get_settings(optional_auth=Depends(get_optional_auth)):
    default_settings = _default_user_settings()
    if not optional_auth:
        return {
            "ok": True,
            "settings": {
                **default_settings,
                "auto_store_chats": False,
            },
            "guest": True,
        }

    user = optional_auth["user"]
    settings = _sanitize_user_settings(user.get("settings", {}))
    return {
        "ok": True,
        "settings": settings,
        "guest": False,
    }


@app.put("/api/settings")
async def update_settings(
    payload: SettingsUpdateRequest,
    current_auth=Depends(get_current_auth),
    db=Depends(get_db),
):
    user = current_auth["user"]
    next_settings = _sanitize_user_settings(user.get("settings", {}))

    if _field_present(payload, "preferred_model"):
        allowed_models = {None, "gpt", "gemini", "claude"}
        if payload.preferred_model not in allowed_models:
            raise HTTPException(status_code=400, detail="Invalid preferred_model")
        next_settings["preferred_model"] = payload.preferred_model

    if _field_present(payload, "theme"):
        if payload.theme not in {"light", "dark"}:
            raise HTTPException(status_code=400, detail="Invalid theme")
        next_settings["theme"] = payload.theme

    if _field_present(payload, "auto_store_chats"):
        next_settings["auto_store_chats"] = bool(payload.auto_store_chats)

    if _field_present(payload, "language"):
        language = (payload.language or "").strip().lower()
        if language not in {"en", "es", "fr", "de", "ja", "hi"}:
            raise HTTPException(status_code=400, detail="Invalid language")
        next_settings["language"] = language

    if _field_present(payload, "density"):
        if payload.density not in {"comfortable", "compact", "spacious"}:
            raise HTTPException(status_code=400, detail="Invalid density")
        next_settings["density"] = payload.density

    if _field_present(payload, "notifications"):
        notification_payload = payload.notifications or SettingsNotificationsUpdateRequest()
        for key in next_settings["notifications"]:
            if _field_present(notification_payload, key):
                next_settings["notifications"][key] = bool(getattr(notification_payload, key))

    if _field_present(payload, "privacy"):
        privacy_payload = payload.privacy or SettingsPrivacyUpdateRequest()
        for key in next_settings["privacy"]:
            if _field_present(privacy_payload, key):
                next_settings["privacy"][key] = bool(getattr(privacy_payload, key))

    if _field_present(payload, "security"):
        security_payload = payload.security or SettingsSecurityUpdateRequest()
        for key in next_settings["security"]:
            if _field_present(security_payload, key):
                next_settings["security"][key] = bool(getattr(security_payload, key))

    await db.users.update_one({"_id": user["_id"]}, {"$set": {"settings": next_settings}})

    return {"ok": True, "settings": next_settings}


@app.get("/api/folders")
async def list_folders(current_auth=Depends(get_current_auth), db=Depends(get_db)):
    cursor = db.folders.find({"user_id": current_auth["user"]["_id"]}).sort("updated_at", DESCENDING)
    folders = [serialize_folder(doc) async for doc in cursor]
    return {"ok": True, "folders": folders}


@app.post("/api/folders")
async def create_folder(
    payload: FolderCreateRequest,
    current_auth=Depends(get_current_auth),
    db=Depends(get_db),
):
    name = payload.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Folder name must be at least 2 characters")

    now = utc_now()
    folder_doc = {
        "user_id": current_auth["user"]["_id"],
        "name": name,
        "description": (payload.description or "").strip(),
        "created_at": now,
        "updated_at": now,
    }
    inserted = await db.folders.insert_one(folder_doc)
    folder_doc["_id"] = inserted.inserted_id
    return {"ok": True, "folder": serialize_folder(folder_doc)}


@app.patch("/api/folders/{folder_id}")
async def update_folder(
    folder_id: str,
    payload: FolderUpdateRequest,
    current_auth=Depends(get_current_auth),
    db=Depends(get_db),
):
    folder_oid = parse_object_id(folder_id, "folder_id")
    updates = {}

    if payload.name is not None:
        trimmed_name = payload.name.strip()
        if len(trimmed_name) < 2:
            raise HTTPException(status_code=400, detail="Folder name must be at least 2 characters")
        updates["name"] = trimmed_name

    if payload.description is not None:
        updates["description"] = payload.description.strip()

    if not updates:
        raise HTTPException(status_code=400, detail="No changes submitted")

    updates["updated_at"] = utc_now()

    result = await db.folders.update_one(
        {"_id": folder_oid, "user_id": current_auth["user"]["_id"]},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Folder not found")

    folder_doc = await db.folders.find_one({"_id": folder_oid})
    return {"ok": True, "folder": serialize_folder(folder_doc)}


@app.delete("/api/folders/{folder_id}")
async def delete_folder(
    folder_id: str,
    current_auth=Depends(get_current_auth),
    db=Depends(get_db),
):
    folder_oid = parse_object_id(folder_id, "folder_id")

    result = await db.folders.delete_one(
        {"_id": folder_oid, "user_id": current_auth["user"]["_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Folder not found")

    now = utc_now()
    await db.chats.update_many(
        {"user_id": current_auth["user"]["_id"], "folder_id": folder_oid},
        {"$set": {"folder_id": None, "updated_at": now}},
    )
    await db.chats.update_many(
        {"user_id": current_auth["user"]["_id"], "project_id": folder_oid},
        {"$set": {"project_id": None, "updated_at": now}},
    )

    return {"ok": True, "message": "Folder deleted"}


@app.get("/api/projects")
async def list_projects(current_auth=Depends(get_current_auth), db=Depends(get_db)):
    cursor = db.projects.find({"user_id": current_auth["user"]["_id"]}).sort("updated_at", DESCENDING)
    projects = [serialize_project(doc) async for doc in cursor]
    return {"ok": True, "projects": projects}


@app.post("/api/projects")
async def create_project(
    payload: ProjectCreateRequest,
    current_auth=Depends(get_current_auth),
    db=Depends(get_db),
):
    name = payload.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Project name must be at least 2 characters")

    now = utc_now()
    project = {
        "user_id": current_auth["user"]["_id"],
        "name": name,
        "description": (payload.description or "").strip(),
        "created_at": now,
        "updated_at": now,
    }
    inserted = await db.projects.insert_one(project)
    project["_id"] = inserted.inserted_id
    return {"ok": True, "project": serialize_project(project)}


@app.patch("/api/projects/{project_id}")
async def update_project(
    project_id: str,
    payload: ProjectUpdateRequest,
    current_auth=Depends(get_current_auth),
    db=Depends(get_db),
):
    project_oid = parse_object_id(project_id, "project_id")
    updates = {}

    if payload.name is not None:
        trimmed_name = payload.name.strip()
        if len(trimmed_name) < 2:
            raise HTTPException(status_code=400, detail="Project name must be at least 2 characters")
        updates["name"] = trimmed_name

    if payload.description is not None:
        updates["description"] = payload.description.strip()

    if not updates:
        raise HTTPException(status_code=400, detail="No changes submitted")

    updates["updated_at"] = utc_now()

    result = await db.projects.update_one(
        {"_id": project_oid, "user_id": current_auth["user"]["_id"]},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")

    project_doc = await db.projects.find_one({"_id": project_oid})
    return {"ok": True, "project": serialize_project(project_doc)}


@app.delete("/api/projects/{project_id}")
async def delete_project(
    project_id: str,
    current_auth=Depends(get_current_auth),
    db=Depends(get_db),
):
    project_oid = parse_object_id(project_id, "project_id")

    result = await db.projects.delete_one(
        {"_id": project_oid, "user_id": current_auth["user"]["_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.chats.update_many(
        {"user_id": current_auth["user"]["_id"], "project_id": project_oid},
        {"$set": {"project_id": None, "updated_at": utc_now()}},
    )

    return {"ok": True, "message": "Project deleted"}


@app.post("/api/chats")
async def create_chat(
    payload: ChatCreateRequest,
    current_auth=Depends(get_current_auth),
    db=Depends(get_db),
):
    now = utc_now()
    folder_oid = await _resolve_folder_oid(
        db=db,
        user_id=current_auth["user"]["_id"],
        folder_id=payload.folder_id,
        project_id=payload.project_id,
    )

    title = payload.title.strip() if payload.title else "New Chat"
    chat_doc = {
        "user_id": current_auth["user"]["_id"],
        "folder_id": folder_oid,
        "title": title[:120],
        "messages": [],
        "created_at": now,
        "updated_at": now,
    }
    inserted = await db.chats.insert_one(chat_doc)
    chat_doc["_id"] = inserted.inserted_id

    return {"ok": True, "chat": serialize_chat_full(chat_doc)}


@app.get("/api/chats")
async def list_chats(
    current_auth=Depends(get_current_auth),
    db=Depends(get_db),
    folder_id: Optional[str] = Query(default=None),
    project_id: Optional[str] = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
):
    query = {"user_id": current_auth["user"]["_id"]}
    selected_folder_id = folder_id or project_id
    if selected_folder_id:
        folder_oid = parse_object_id(selected_folder_id, "folder_id")
        query["$or"] = [{"folder_id": folder_oid}, {"project_id": folder_oid}]

    cursor = db.chats.find(query).sort("updated_at", DESCENDING).limit(limit)
    chats = [serialize_chat_summary(doc) async for doc in cursor]

    return {"ok": True, "chats": chats}


@app.get("/api/chats/export")
async def export_chats(
    current_auth=Depends(get_current_auth),
    db=Depends(get_db),
    folder_id: Optional[str] = Query(default=None),
):
    query = {"user_id": current_auth["user"]["_id"]}
    if folder_id:
        folder_oid = parse_object_id(folder_id, "folder_id")
        query["$or"] = [{"folder_id": folder_oid}, {"project_id": folder_oid}]

    cursor = db.chats.find(query).sort("updated_at", DESCENDING)
    chats = [serialize_chat_full(doc) async for doc in cursor]

    return {
        "ok": True,
        "exported_at": utc_iso(utc_now()),
        "count": len(chats),
        "chats": chats,
    }


@app.delete("/api/chats")
async def clear_chats(
    current_auth=Depends(get_current_auth),
    db=Depends(get_db),
    folder_id: Optional[str] = Query(default=None),
):
    query = {"user_id": current_auth["user"]["_id"]}
    if folder_id:
        folder_oid = parse_object_id(folder_id, "folder_id")
        query["$or"] = [{"folder_id": folder_oid}, {"project_id": folder_oid}]

    result = await db.chats.delete_many(query)
    return {"ok": True, "deleted_chats": result.deleted_count}


@app.get("/api/chats/{chat_id}")
async def get_chat(
    chat_id: str,
    current_auth=Depends(get_current_auth),
    db=Depends(get_db),
):
    chat_oid = parse_object_id(chat_id, "chat_id")
    chat_doc = await db.chats.find_one({"_id": chat_oid, "user_id": current_auth["user"]["_id"]})
    if not chat_doc:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"ok": True, "chat": serialize_chat_full(chat_doc)}


@app.delete("/api/chats/{chat_id}")
async def delete_chat(
    chat_id: str,
    current_auth=Depends(get_current_auth),
    db=Depends(get_db),
):
    chat_oid = parse_object_id(chat_id, "chat_id")
    result = await db.chats.delete_one({"_id": chat_oid, "user_id": current_auth["user"]["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"ok": True, "message": "Chat deleted"}


@app.delete("/api/account")
async def delete_account(current_auth=Depends(get_current_auth), db=Depends(get_db)):
    user_id = current_auth["user"]["_id"]
    await db.sessions.delete_many({"user_id": user_id})
    await db.chats.delete_many({"user_id": user_id})
    await db.folders.delete_many({"user_id": user_id})
    await db.projects.delete_many({"user_id": user_id})
    await db.users.delete_one({"_id": user_id})
    return {"ok": True, "message": "Account deleted"}


@app.post("/api/chat/complete")
async def chat_complete(
    payload: ChatCompleteRequest,
    request: Request,
    optional_auth=Depends(get_optional_auth),
):
    prompt = _extract_prompt(payload)
    completion = await _generate_response(prompt, payload.forced_model)

    stored_chat_id = None
    if payload.store:
        db = getattr(request.app.state, "db", None)
        if db is None:
            raise HTTPException(
                status_code=503,
                detail="MongoDB unavailable. Disable Auto Store and retry.",
            )
        if not optional_auth:
            raise HTTPException(
                status_code=401,
                detail="Sign in required to store chats",
            )
        stored_chat_id = await _persist_chat_turn(
            db=db,
            user_id=optional_auth["user"]["_id"],
            prompt=prompt,
            assistant_response=completion["response"],
            model_selected=completion["model_selected"],
            chat_id=payload.chat_id,
            folder_id=payload.folder_id,
            project_id=payload.project_id,
        )

    return {"ok": True, **completion, "chat_id": stored_chat_id}


# Backward compatibility route
@app.post("/chat")
async def legacy_chat(payload: ChatCompleteRequest):
    prompt = _extract_prompt(payload)
    completion = await _generate_response(prompt, payload.forced_model)
    return completion


@app.post("/route-debug")
async def route_debug(payload: ChatCompleteRequest):
    prompt = _extract_prompt(payload)
    return rank_models(prompt)


@app.get("/benchmark-model/status")
async def benchmark_model_status():
    return benchmark_model.status()


@app.post("/benchmark-model/reload")
async def benchmark_model_reload():
    return benchmark_model.reload()


@app.get("/health")
async def health(request: Request):
    db = getattr(request.app.state, "db", None)
    try:
        if db is None:
            raise RuntimeError("MongoDB unavailable")
        await db.command("ping")
        mongo_ok = True
    except Exception:  # noqa: BLE001
        mongo_ok = False

    return {
        "ok": True,
        "service": "swastik-ai",
        "mongodb": mongo_ok,
        "time": utc_iso(utc_now()),
    }
