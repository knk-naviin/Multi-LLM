import asyncio
import logging
from datetime import timezone
from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
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
from services.ai_council import ConversationOrchestrator, CouncilConfig
from services.best_answer import BestAnswerEngine
from services.task_mode import TASK_TYPES, TaskWorkflowEngine, IterativeWorkflowEngine

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


class ChatUpdateRequest(BaseModel):
    title: Optional[str] = None
    folder_id: Optional[str] = None


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
        await db.task_workflows.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
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


@app.patch("/api/chats/{chat_id}")
async def update_chat(
    chat_id: str,
    body: ChatUpdateRequest,
    current_auth=Depends(get_current_auth),
    db=Depends(get_db),
):
    chat_oid = parse_object_id(chat_id, "chat_id")
    update_fields: Dict[str, Any] = {"updated_at": utc_now()}
    if body.title is not None:
        update_fields["title"] = body.title.strip()[:120]
    if body.folder_id is not None:
        folder_oid = parse_object_id(body.folder_id, "folder_id") if body.folder_id else None
        update_fields["folder_id"] = folder_oid
        update_fields["project_id"] = folder_oid
    result = await db.chats.update_one(
        {"_id": chat_oid, "user_id": current_auth["user"]["_id"]},
        {"$set": update_fields},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Chat not found")
    updated = await db.chats.find_one({"_id": chat_oid})
    return {"ok": True, "chat": serialize_chat_summary(updated)}


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


# ─── Streaming Chat (token-by-token SSE) ──────────────────────────────


def _chat_sse(data: dict) -> str:
    """Format a dict as an SSE data line."""
    import json as _json
    return f"data: {_json.dumps(data, default=str)}\n\n"


@app.post("/api/chat/stream")
async def chat_stream(
    payload: ChatCompleteRequest,
    request: Request,
    optional_auth=Depends(get_optional_auth),
):
    """Stream chat tokens via SSE instead of returning a complete JSON response."""
    prompt = _extract_prompt(payload)

    async def _event_generator():
        import uuid as _uuid

        stream_id = str(_uuid.uuid4())[:8]
        started = utc_now()
        routing = rank_models(prompt)
        ranking = routing["ranking"]

        if payload.forced_model:
            forced = payload.forced_model.strip().lower()
            candidate_models = [forced] + [
                entry["model"] for entry in ranking if entry["model"] != forced
            ]
        else:
            candidate_models = [entry["model"] for entry in ranking]

        from models.streaming import STREAM_FUNCTIONS, async_stream_wrapper

        errors = []
        selected_model = None
        full_content: list[str] = []

        for model_name in candidate_models:
            stream_fn = STREAM_FUNCTIONS.get(model_name)
            if not stream_fn:
                errors.append(f"{model_name}: no streaming function")
                continue

            try:
                yield _chat_sse({
                    "type": "stream_start",
                    "model": model_name,
                    "stream_id": stream_id,
                })

                async for token in async_stream_wrapper(stream_fn, prompt):
                    full_content.append(token)
                    yield _chat_sse({
                        "type": "token",
                        "content": token,
                        "stream_id": stream_id,
                    })

                selected_model = model_name
                break
            except GeminiRateLimitError as exc:
                errors.append(f"{model_name}: {exc}")
                full_content.clear()
            except Exception as exc:
                errors.append(f"{model_name}: {exc}")
                full_content.clear()

        if selected_model is None:
            yield _chat_sse({
                "type": "stream_error",
                "message": f"All providers failed: {errors}",
            })
            return

        elapsed = (utc_now() - started).total_seconds()
        complete_response = "".join(full_content)

        stored_chat_id = None
        if payload.store:
            db = getattr(request.app.state, "db", None)
            if db is not None and optional_auth:
                try:
                    stored_chat_id = await _persist_chat_turn(
                        db=db,
                        user_id=optional_auth["user"]["_id"],
                        prompt=prompt,
                        assistant_response=complete_response,
                        model_selected=selected_model,
                        chat_id=payload.chat_id,
                        folder_id=payload.folder_id,
                        project_id=payload.project_id,
                    )
                except Exception:
                    pass

        yield _chat_sse({
            "type": "stream_complete",
            "model": selected_model,
            "domain": routing.get("domain"),
            "response_time": round(elapsed, 2),
            "chat_id": stored_chat_id,
            "stream_id": stream_id,
        })

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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


# ── Task Mode — AI Team Workflow ──────────────────────────────────────


class TaskModeRequest(BaseModel):
    task_prompt: str
    task_type: str
    agents: dict[str, str]  # role_key -> agent_key
    store: bool = False
    chat_id: Optional[str] = None
    folder_id: Optional[str] = None
    project_id: Optional[str] = None


@app.get("/api/task-types")
async def get_task_types():
    """Return available task types and their role definitions."""
    types = []
    for key, cfg in TASK_TYPES.items():
        types.append({
            "key": cfg.key,
            "label": cfg.label,
            "icon": cfg.icon,
            "roles": [
                {
                    "key": r.key,
                    "label": r.label,
                    "description": r.description,
                }
                for r in cfg.roles
            ],
        })
    return {"ok": True, "task_types": types}


@app.post("/api/task-mode")
async def task_mode(
    payload: TaskModeRequest,
    request: Request,
    optional_auth=Depends(get_optional_auth),
):
    prompt = payload.task_prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Task prompt is required")

    if payload.task_type not in TASK_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown task type: {payload.task_type}",
        )

    engine = TaskWorkflowEngine(
        task_type=payload.task_type,
        agents=payload.agents,
    )
    result = await engine.run(prompt)

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
            assistant_response=result["final_answer"],
            model_selected=f"task-{payload.task_type}",
            chat_id=payload.chat_id,
            folder_id=payload.folder_id,
            project_id=payload.project_id,
        )

    return {"ok": True, **result, "chat_id": stored_chat_id}


# ── Task Follow-Up Chat ──────────────────────────────────────────────


class TaskFollowUpRequest(BaseModel):
    task_id: str
    message: str
    forced_model: Optional[str] = None


def _build_followup_context(workflow_doc: Dict[str, Any]) -> str:
    """Build a system-level context string from workflow data for follow-up chat."""
    task_prompt = workflow_doc.get("task_prompt", "")
    task_type = workflow_doc.get("task_type", "")
    task_label = workflow_doc.get("task_label", task_type)
    final_result = workflow_doc.get("final_result", {})
    events = workflow_doc.get("events", [])

    # Extract step outputs from events
    step_outputs = []
    for event in events:
        if event.get("type") == "step_complete" and event.get("content"):
            step_outputs.append(
                f"[{event.get('step_label', event.get('step', 'Step'))} "
                f"by {event.get('agent_name', event.get('agent', 'Agent'))}]:\n"
                f"{event['content'][:2000]}"
            )

    steps_text = "\n\n".join(step_outputs) if step_outputs else "(no step outputs available)"

    final_text = final_result.get("content", "") if final_result else ""
    final_agent = final_result.get("agent_name", "") if final_result else ""

    context = (
        f"You are a helpful AI assistant continuing a conversation about a completed "
        f"{task_label} workflow.\n\n"
        f"=== ORIGINAL TASK ===\n{task_prompt}\n\n"
        f"=== WORKFLOW STEPS ===\n{steps_text}\n\n"
        f"=== FINAL SYNTHESIZED RESULT (by {final_agent}) ===\n{final_text}\n\n"
        f"The user may ask for clarifications, improvements, error fixes, additional features, "
        f"or explanations about the above output. Respond helpfully with full context awareness. "
        f"When providing code, always provide complete, production-ready implementations."
    )
    return context


# ── Task Workflow — Iterative Streaming Engine ───────────────────────


class TaskWorkflowRequest(BaseModel):
    task_prompt: str
    task_type: str
    agents: dict[str, str]  # role_key -> agent_key
    max_review_iterations: int = 3
    max_qc_iterations: int = 3
    store: bool = True


async def _workflow_with_persistence(
    engine: IterativeWorkflowEngine,
    prompt: str,
    payload: TaskWorkflowRequest,
    db,
    user_id,
):
    """Wrapper generator that yields SSE events and persists the workflow to MongoDB on completion."""
    import json as _json
    import time as _time

    collected_events: list[dict] = []
    final_result_data: dict | None = None
    done_data: dict | None = None

    async for chunk in engine.run_workflow(prompt):
        yield chunk

        # Parse the event for collection
        if chunk.startswith("data: "):
            try:
                event = _json.loads(chunk[6:].strip())
                event["_ts"] = _time.time()
                collected_events.append(event)

                if event.get("type") == "final_result":
                    final_result_data = {
                        "content": event.get("content", ""),
                        "agent": event.get("agent", ""),
                        "agent_name": event.get("agent_name", ""),
                    }
                elif event.get("type") == "done":
                    done_data = event
            except Exception:
                pass

    # Persist to MongoDB after stream is done
    if db is not None and user_id is not None and done_data is not None:
        try:
            task_config = TASK_TYPES.get(payload.task_type)
            task_label = task_config.label if task_config else payload.task_type

            doc = {
                "user_id": user_id,
                "task_prompt": prompt,
                "task_type": payload.task_type,
                "task_label": task_label,
                "agents": payload.agents,
                "events": collected_events,
                "final_result": final_result_data,
                "total_time": done_data.get("total_time", 0),
                "total_tokens": done_data.get("total_tokens", 0),
                "steps_count": done_data.get("steps_count", 0),
                "status": "completed" if final_result_data else "failed",
                "created_at": utc_now(),
            }
            inserted = await db.task_workflows.insert_one(doc)
            workflow_id = str(inserted.inserted_id)

            # Yield a final persistence event so the frontend knows the workflow_id
            yield f"data: {_json.dumps({'type': 'workflow_saved', 'workflow_id': workflow_id})}\n\n"
        except Exception as exc:
            logger.warning("Failed to persist task workflow: %s", exc)


@app.post("/api/task-workflow")
async def task_workflow(
    payload: TaskWorkflowRequest,
    request: Request,
    optional_auth=Depends(get_optional_auth),
):
    """
    Streaming task workflow with iterative review loops.
    Returns SSE events as the workflow progresses in real time.
    Optionally persists the completed workflow to MongoDB.
    """
    prompt = (payload.task_prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Task prompt is required")

    if payload.task_type not in TASK_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown task type: {payload.task_type}",
        )

    engine = IterativeWorkflowEngine(
        task_type=payload.task_type,
        agents=payload.agents,
        max_review_iterations=max(1, min(payload.max_review_iterations, 5)),
        max_qc_iterations=max(1, min(payload.max_qc_iterations, 5)),
    )

    db = getattr(request.app.state, "db", None) if payload.store else None
    user_id = optional_auth["user"]["_id"] if optional_auth else None

    should_persist = payload.store and db is not None and user_id is not None
    generator = (
        _workflow_with_persistence(engine, prompt, payload, db, user_id)
        if should_persist
        else engine.run_workflow(prompt)
    )

    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Task Workflow History ─────────────────────────────────────────────


def _serialize_workflow_summary(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "task_prompt": (doc.get("task_prompt") or "")[:180],
        "task_type": doc.get("task_type", ""),
        "task_label": doc.get("task_label", ""),
        "total_time": doc.get("total_time", 0),
        "total_tokens": doc.get("total_tokens", 0),
        "steps_count": doc.get("steps_count", 0),
        "status": doc.get("status", "completed"),
        "created_at": utc_iso(doc.get("created_at")),
        "has_followup": bool(doc.get("followup_chat")),
    }


def _serialize_workflow_full(doc: Dict[str, Any]) -> Dict[str, Any]:
    summary = _serialize_workflow_summary(doc)
    summary["task_prompt"] = doc.get("task_prompt", "")  # full prompt
    summary["agents"] = doc.get("agents", {})
    summary["events"] = doc.get("events", [])
    summary["final_result"] = doc.get("final_result")
    summary["followup_chat"] = doc.get("followup_chat", [])
    return summary


@app.get("/api/task-workflows")
async def list_task_workflows(
    request: Request,
    optional_auth=Depends(get_optional_auth),
    limit: int = Query(default=20, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
):
    """List the authenticated user's past task workflows."""
    if not optional_auth:
        raise HTTPException(status_code=401, detail="Sign in required")

    db = getattr(request.app.state, "db", None)
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    user_id = optional_auth["user"]["_id"]
    cursor = (
        db.task_workflows.find({"user_id": user_id})
        .sort("created_at", DESCENDING)
        .skip(skip)
        .limit(limit)
    )

    workflows = []
    async for doc in cursor:
        workflows.append(_serialize_workflow_summary(doc))

    total = await db.task_workflows.count_documents({"user_id": user_id})

    return {"ok": True, "workflows": workflows, "total": total}


@app.get("/api/task-workflows/{workflow_id}")
async def get_task_workflow(
    workflow_id: str,
    request: Request,
    optional_auth=Depends(get_optional_auth),
):
    """Get full task workflow with all events for replay."""
    if not optional_auth:
        raise HTTPException(status_code=401, detail="Sign in required")

    db = getattr(request.app.state, "db", None)
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    oid = parse_object_id(workflow_id, "workflow_id")
    user_id = optional_auth["user"]["_id"]

    doc = await db.task_workflows.find_one({"_id": oid, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Workflow not found")

    return {"ok": True, "workflow": _serialize_workflow_full(doc)}


@app.post("/api/task-followup")
async def task_followup(
    payload: TaskFollowUpRequest,
    request: Request,
    optional_auth=Depends(get_optional_auth),
):
    """Follow-up chat on a completed task workflow with full context awareness."""
    message = (payload.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    db = getattr(request.app.state, "db", None)
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    if not optional_auth:
        raise HTTPException(status_code=401, detail="Sign in required")

    user_id = optional_auth["user"]["_id"]
    oid = parse_object_id(payload.task_id, "task_id")

    # Fetch the workflow document
    workflow_doc = await db.task_workflows.find_one({"_id": oid, "user_id": user_id})
    if not workflow_doc:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Build the full context prompt
    context = _build_followup_context(workflow_doc)

    # Retrieve existing follow-up messages for conversation continuity
    existing_followups = workflow_doc.get("followup_chat", [])

    # Build the full prompt with conversation history
    conversation_parts = [context]
    for msg in existing_followups:
        role_label = "User" if msg["role"] == "user" else "Assistant"
        conversation_parts.append(f"\n{role_label}: {msg['content']}")

    conversation_parts.append(f"\nUser: {message}")
    conversation_parts.append("\nAssistant:")

    full_prompt = "\n".join(conversation_parts)

    # Default to the agent that produced the final synthesis
    default_model = None
    final_result = workflow_doc.get("final_result")
    if final_result and final_result.get("agent"):
        default_model = final_result["agent"]

    try:
        result = await _generate_response(full_prompt, payload.forced_model or default_model)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Model generation failed: {exc}")

    now = utc_now()

    # Persist the exchange to the workflow document
    await db.task_workflows.update_one(
        {"_id": oid, "user_id": user_id},
        {
            "$push": {
                "followup_chat": {
                    "$each": [
                        {
                            "role": "user",
                            "content": message,
                            "model_used": None,
                            "created_at": utc_iso(now),
                        },
                        {
                            "role": "assistant",
                            "content": result["response"],
                            "model_used": result["model_selected"],
                            "created_at": utc_iso(now),
                        },
                    ]
                }
            }
        },
    )

    return {
        "ok": True,
        "reply": result["response"],
        "model_used": result["model_selected"],
        "response_time_seconds": result["response_time_seconds"],
    }


# ── Best Answer Mode — Multi-Agent Synthesis ─────────────────────────


@app.post("/api/chat/best-answer")
async def chat_best_answer(
    payload: ChatCompleteRequest,
    request: Request,
    optional_auth=Depends(get_optional_auth),
):
    prompt = _extract_prompt(payload)

    engine = BestAnswerEngine()
    result = await engine.generate(prompt)

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
            assistant_response=result["final_answer"],
            model_selected=result.get("synthesized_by", "best-answer"),
            chat_id=payload.chat_id,
            folder_id=payload.folder_id,
            project_id=payload.project_id,
        )

    return {"ok": True, **result, "chat_id": stored_chat_id}


# ── AI Council — Multi-Agent Debate ──────────────────────────────────


class AICouncilRequest(BaseModel):
    prompt: str
    enabled_agents: Optional[list[str]] = None
    max_rounds: int = 5


@app.post("/api/ai-council")
async def ai_council(payload: AICouncilRequest):
    prompt = (payload.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    config = CouncilConfig(
        enabled_agents=payload.enabled_agents,
        max_rounds=max(1, min(payload.max_rounds, 5)),
    )
    orchestrator = ConversationOrchestrator(config)

    return StreamingResponse(
        orchestrator.run_debate(prompt),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── AI Council — Sequential Debate Mode ─────────────────────────────


class AICouncilDebateRequest(BaseModel):
    prompt: str
    enabled_agents: Optional[list[str]] = None


@app.post("/api/ai-council-debate")
async def ai_council_debate(payload: AICouncilDebateRequest):
    prompt = (payload.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    config = CouncilConfig(enabled_agents=payload.enabled_agents)
    orchestrator = ConversationOrchestrator(config)

    return StreamingResponse(
        orchestrator.run_sequential_debate(prompt),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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
