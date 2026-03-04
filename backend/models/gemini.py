import time
from collections import deque
from typing import Tuple

from config import GEMINI_API_KEY, GEMINI_REQUESTS_PER_MINUTE


class GeminiRateLimitError(RuntimeError):
    pass


class _LocalRateLimiter:
    def __init__(self, requests_per_minute: int):
        self.requests_per_minute = max(1, requests_per_minute)
        self._timestamps = deque()

    def try_acquire(self) -> Tuple[bool, float]:
        now = time.monotonic()
        while self._timestamps and (now - self._timestamps[0]) >= 60:
            self._timestamps.popleft()

        if len(self._timestamps) >= self.requests_per_minute:
            retry_after = 60 - (now - self._timestamps[0])
            return False, max(0.0, retry_after)

        self._timestamps.append(now)
        return True, 0.0


_rate_limiter = _LocalRateLimiter(GEMINI_REQUESTS_PER_MINUTE)
_api_block_until = 0.0

try:
    from google import genai as google_genai

    _client = google_genai.Client(api_key=GEMINI_API_KEY)
    _use_new_sdk = True
except Exception:
    import google.generativeai as google_legacy_genai

    google_legacy_genai.configure(api_key=GEMINI_API_KEY)
    _client = google_legacy_genai.GenerativeModel("gemini-1.5-flash")
    _use_new_sdk = False


def can_call_gemini() -> Tuple[bool, float]:
    global _api_block_until

    now = time.monotonic()
    if now < _api_block_until:
        return False, max(0.0, _api_block_until - now)

    while _rate_limiter._timestamps and (now - _rate_limiter._timestamps[0]) >= 60:
        _rate_limiter._timestamps.popleft()

    if len(_rate_limiter._timestamps) >= _rate_limiter.requests_per_minute:
        retry_after = 60 - (now - _rate_limiter._timestamps[0])
        return False, max(0.0, retry_after)

    return True, 0.0


def call_gemini(prompt: str) -> str:
    global _api_block_until

    now = time.monotonic()
    if now < _api_block_until:
        raise GeminiRateLimitError(
            f"Gemini API cooldown active. Retry in ~{(_api_block_until - now):.1f}s"
        )

    allowed, retry_after = _rate_limiter.try_acquire()
    if not allowed:
        raise GeminiRateLimitError(
            f"Gemini local rate limit reached. Retry in ~{retry_after:.1f}s"
        )

    try:
        if _use_new_sdk:
            response = _client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
            )
            return response.text

        response = _client.generate_content(prompt)
        return response.text
    except Exception as exc:
        message = str(exc).lower()
        if "429" in message or "rate limit" in message:
            _api_block_until = time.monotonic() + 90
            raise GeminiRateLimitError(f"Gemini API rate-limited: {exc}") from exc
        raise
