import time
from typing import List

import anthropic

from config import ANTHROPIC_API_KEY, CLAUDE_MODELS

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

_DISCOVERY_TTL_SECONDS = 600
_cached_models: List[str] = []
_cached_models_ts = 0.0


def _discover_models() -> List[str]:
    global _cached_models, _cached_models_ts

    now = time.monotonic()
    if _cached_models and (now - _cached_models_ts) < _DISCOVERY_TTL_SECONDS:
        return _cached_models

    try:
        listing = client.models.list(limit=50)
        discovered = [item.id for item in getattr(listing, "data", []) if getattr(item, "id", None)]
        if discovered:
            _cached_models = discovered
            _cached_models_ts = now
        return discovered
    except Exception:
        return []


def _candidate_models() -> List[str]:
    discovered = _discover_models()
    if not discovered:
        return list(CLAUDE_MODELS)

    available = set(discovered)
    preferred = [model for model in CLAUDE_MODELS if model in available]
    if preferred:
        return preferred + [model for model in discovered if model not in preferred]
    return discovered


def _call_model(model_name: str, prompt: str) -> str:
    response = client.messages.create(
        model=model_name,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


def call_claude(prompt: str) -> str:
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")

    last_error = None

    for model_name in _candidate_models():
        try:
            return _call_model(model_name, prompt)
        except Exception as exc:
            status = getattr(exc, "status_code", None)
            message = str(exc).lower()
            if status == 404 or "not found" in message:
                last_error = exc
                continue
            raise

    raise RuntimeError(
        f"No available Claude model succeeded. configured={CLAUDE_MODELS}, discovered={_cached_models}, last_error={last_error}"
    )
