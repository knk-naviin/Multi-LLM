import base64
import hashlib
import hmac
import json
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_email(email: str) -> bool:
    return bool(EMAIL_PATTERN.match(normalize_email(email)))


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 260_000)
    return base64.b64encode(salt + digest).decode("utf-8")


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        raw = base64.b64decode(stored_hash.encode("utf-8"))
    except Exception:
        return False

    if len(raw) < 17:
        return False

    salt, known_digest = raw[:16], raw[16:]
    check_digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 260_000)
    return hmac.compare_digest(known_digest, check_digest)


def generate_session_token() -> str:
    return secrets.token_urlsafe(40)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def session_expiry(days: int) -> datetime:
    return utc_now() + timedelta(days=max(1, days))


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padded = value + "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(padded.encode("utf-8"))


def create_jwt_token(
    user_id: str,
    email: str,
    secret: str,
    expires_hours: int,
) -> tuple[str, str, datetime]:
    now = utc_now()
    expires_at = now + timedelta(hours=max(1, expires_hours))
    jti = secrets.token_urlsafe(24)

    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "jti": jti,
    }

    encoded_header = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    encoded_payload = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{encoded_header}.{encoded_payload}"
    signature = hmac.new(secret.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
    token = f"{signing_input}.{_b64url_encode(signature)}"
    return token, jti, expires_at


def decode_jwt_token(token: str, secret: str) -> Dict[str, Any]:
    if not token:
        raise ValueError("Missing token")

    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid token format")

    encoded_header, encoded_payload, encoded_signature = parts
    signing_input = f"{encoded_header}.{encoded_payload}"

    expected_signature = hmac.new(
        secret.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    provided_signature = _b64url_decode(encoded_signature)
    if not hmac.compare_digest(expected_signature, provided_signature):
        raise ValueError("Invalid token signature")

    payload_raw = _b64url_decode(encoded_payload)
    payload: Dict[str, Any] = json.loads(payload_raw.decode("utf-8"))

    exp = payload.get("exp")
    if not isinstance(exp, int):
        raise ValueError("Missing token expiration")

    if exp < int(utc_now().timestamp()):
        raise ValueError("Token expired")

    sub = payload.get("sub")
    jti = payload.get("jti")
    if not isinstance(sub, str) or not sub:
        raise ValueError("Missing token subject")
    if not isinstance(jti, str) or not jti:
        raise ValueError("Missing token identifier")

    return payload
