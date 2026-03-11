"""
Streaming model functions — token-by-token generators for all 4 providers.
Each function is a synchronous generator that yields string chunks.
Use async_stream_wrapper() to consume them from async code.
"""

import asyncio
import json
import logging
import time
from typing import AsyncGenerator, Generator

import requests

from config import GROK_API_KEY

logger = logging.getLogger("streaming")

# ─── Reuse module-level clients/state from existing model files ────────

from models.gpt import client as _openai_client
from models.claude import client as _anthropic_client, _candidate_models
from models.gemini import (
    _client as _gemini_client,
    _use_new_sdk as _gemini_use_new_sdk,
    _rate_limiter as _gemini_rate_limiter,
    _api_block_until as _gemini_api_block_until,
    GeminiRateLimitError,
)
import models.gemini as _gemini_module  # for mutating _api_block_until

GROK_URL = "https://api.x.ai/v1/chat/completions"


# ─── GPT Streaming ────────────────────────────────────────────────────

def stream_gpt(prompt: str) -> Generator[str, None, None]:
    """Stream tokens from OpenAI GPT-4o-mini."""
    stream = _openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        stream=True,
    )
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


# ─── Gemini Streaming ─────────────────────────────────────────────────

def stream_gemini(prompt: str) -> Generator[str, None, None]:
    """Stream tokens from Google Gemini. Respects rate limiter."""
    now = time.monotonic()
    if now < _gemini_module._api_block_until:
        raise GeminiRateLimitError(
            f"Gemini API cooldown active. Retry in ~{(_gemini_module._api_block_until - now):.1f}s"
        )

    allowed, retry_after = _gemini_rate_limiter.try_acquire()
    if not allowed:
        raise GeminiRateLimitError(
            f"Gemini local rate limit reached. Retry in ~{retry_after:.1f}s"
        )

    try:
        if _gemini_use_new_sdk:
            response = _gemini_client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                stream=True,
            )
            for chunk in response:
                if hasattr(chunk, "text") and chunk.text:
                    yield chunk.text
        else:
            response = _gemini_client.generate_content(prompt, stream=True)
            for chunk in response:
                if hasattr(chunk, "text") and chunk.text:
                    yield chunk.text
    except Exception as exc:
        message = str(exc).lower()
        if "429" in message or "rate limit" in message:
            _gemini_module._api_block_until = time.monotonic() + 90
            raise GeminiRateLimitError(f"Gemini API rate-limited: {exc}") from exc
        raise


# ─── Claude Streaming ─────────────────────────────────────────────────

def stream_claude(prompt: str) -> Generator[str, None, None]:
    """Stream tokens from Anthropic Claude. Uses model fallback."""
    from config import ANTHROPIC_API_KEY

    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")

    last_error = None
    for model_name in _candidate_models():
        try:
            with _anthropic_client.messages.stream(
                model=model_name,
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                for text in stream.text_stream:
                    yield text
            return  # success
        except Exception as exc:
            status = getattr(exc, "status_code", None)
            message = str(exc).lower()
            if status == 404 or "not found" in message:
                last_error = exc
                continue
            raise

    raise RuntimeError(
        f"No available Claude model succeeded. last_error={last_error}"
    )


# ─── Grok Streaming ───────────────────────────────────────────────────

def stream_grok(prompt: str) -> Generator[str, None, None]:
    """Stream tokens from XAI Grok via OpenAI-compatible SSE API."""
    if not GROK_API_KEY:
        raise RuntimeError("GROK_API_KEY is not configured")

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROK_API_KEY}",
    }
    payload = {
        "model": "grok-4-latest",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0,
        "stream": True,
    }

    with requests.post(GROK_URL, headers=headers, json=payload, stream=True) as resp:
        if resp.status_code != 200:
            raise RuntimeError(f"Grok error {resp.status_code}: {resp.text}")

        for line in resp.iter_lines(decode_unicode=True):
            if not line or not line.startswith("data: "):
                continue
            data_str = line[6:]
            if data_str.strip() == "[DONE]":
                break
            try:
                chunk = json.loads(data_str)
                delta = chunk.get("choices", [{}])[0].get("delta", {})
                content = delta.get("content", "")
                if content:
                    yield content
            except json.JSONDecodeError:
                continue


# ─── Stream function registry ─────────────────────────────────────────

STREAM_FUNCTIONS = {
    "gpt": stream_gpt,
    "gemini": stream_gemini,
    "claude": stream_claude,
    "grok": stream_grok,
}


# ─── Async wrapper (sync generator → async generator via thread) ──────

_sentinel = object()


async def async_stream_wrapper(
    sync_gen_fn,
    prompt: str,
) -> AsyncGenerator[str, None]:
    """
    Run a synchronous streaming generator in a thread pool,
    yielding tokens asynchronously via an asyncio.Queue.
    """
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def _run_in_thread():
        try:
            for chunk in sync_gen_fn(prompt):
                loop.call_soon_threadsafe(queue.put_nowait, chunk)
        except Exception as e:
            loop.call_soon_threadsafe(queue.put_nowait, e)
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, _sentinel)

    loop.run_in_executor(None, _run_in_thread)

    while True:
        item = await queue.get()
        if item is _sentinel:
            break
        if isinstance(item, Exception):
            raise item
        yield item
