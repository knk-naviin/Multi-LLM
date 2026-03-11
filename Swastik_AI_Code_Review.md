# Swastik AI — Code Review: Bug, Flaw & Security Audit

**Date:** March 9, 2026 | **Scope:** Full-Stack (Backend + Frontend) | **Files Reviewed:** 40+

---

## Executive Summary

A comprehensive audit of the Swastik AI monorepo (FastAPI backend + Next.js frontend) uncovered **29 issues** across security, logic, data integrity, and code quality. The most urgent findings involve unsafe deserialization, race conditions, missing authorization checks, and silent error handling.

| Severity | Count | Action |
|----------|-------|--------|
| **CRITICAL** | 5 | Immediate action required — security or data risk |
| **HIGH** | 10 | Fix before production deployment |
| **MEDIUM** | 10 | Address in next sprint |
| **LOW** | 4 | Improve when convenient |

---

## CRITICAL Issues

### [C1] Weak MongoDB Password & Credential Hygiene
**File:** `backend/.env` | **Lines:** All

The `.env` file uses the password `admin123` for the MongoDB Atlas connection. While `.gitignore` properly excludes the file, this password is trivially guessable. All API keys (OpenAI, Anthropic, Gemini) and the JWT secret should be rotated if this repo was ever shared or the credentials were exposed. Consider using a secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault) instead of flat files.

### [C2] Unsafe pickle.load() — Arbitrary Code Execution
**File:** `backend/benchmark_model.py` | **Line:** 98

`pickle.load(f)` deserializes the benchmark model file without any safety checks. A malicious `.pkl` file could execute arbitrary code on the server. Replace with `safetensors`, JSON, or `joblib` with safer options.

### [C3] Race Condition in Gemini Rate Limiter
**File:** `backend/models/gemini.py` | **Lines:** 31, 46–60

Global mutable state `_api_block_until` is accessed by multiple concurrent async tasks without synchronization (no lock). This can corrupt rate-limit state under load, causing either bypassed rate limits or unnecessary blocking.

### [C4] Silent Exception Swallowing in Chat Persistence
**File:** `backend/main.py` | **Lines:** 1289–1290

`except Exception: pass` silently ignores ALL errors when storing streamed chat data. Users lose conversation history without any indication. Failed writes are completely invisible to both users and operators.

### [C5] Weak Default JWT Secret
**File:** `backend/config.py` | **Line:** 21

Default JWT secret is `"change-this-jwt-secret-in-production"`. If deployed with the default, any attacker can forge authentication tokens and access any account. The startup check logs a warning but does not prevent the app from running.

---

## HIGH Issues

### [H1] GOOGLE_CLIENT_ID Typo in Frontend Constants
**File:** `frontend/src/lib/constants.ts` | **Line:** 11

Fallback checks `NEXT_PUBLIC_GOOGLE_CLIENT_I` (missing final "D") instead of the correct variable name. Google OAuth will silently fail if the primary env var is not set, falling through to an empty string.

### [H2] Exception Details Leaked to Clients
**File:** `backend/main.py` | **Line:** 376

`raise HTTPException(detail=f"Invalid Google credential: {exc}")` exposes internal exception messages to attackers, revealing implementation details about the authentication system.

### [H3] QC Validator Defaults to PASS on Parse Failure
**File:** `backend/services/qc_validator.py` | **Line:** 40

When the quality-check verdict marker is missing from the LLM response, the validator defaults to "PASS". This silently bypasses quality checks, allowing poor-quality outputs through the workflow.

### [H4] Folder Update Corrupts Data (Sets Both folder_id AND project_id)
**File:** `backend/main.py` | **Lines:** 1134–1136

When updating a chat's folder, both `folder_id` and `project_id` are set to the same value. This overwrites any existing project association, causing data corruption for users who rely on project organization.

### [H5] Missing Authorization Checks After Update
**File:** `backend/main.py` | **Lines:** 892, 984

After updating folders/projects, the refetch query doesn't include `user_id`. A race condition could return another user's data if the original document is deleted between the update and refetch.

### [H6] Unsafe Dictionary Access in Debate Service
**File:** `backend/services/debate.py` | **Lines:** 70, 76, 137, 162, 177

Five locations access `AGENT_DEFINITIONS[r.agent]` without checking if the key exists. The server crashes with `KeyError` if an invalid agent key is provided.

### [H7] No Input Length Limits on User Fields
**File:** `backend/main.py` | **Lines:** 79–81

Pydantic models for signup (`name`, `email`, `password`) have no `max_length` constraints. Attackers could submit extremely large values, causing memory exhaustion or storage bloat.

### [H8] Unbounded Prompt Concatenation in Workflow Engine
**File:** `backend/services/iterative_engine.py` | **Lines:** 29–34

Each workflow iteration concatenates previous outputs into the next prompt without truncation. This creates exponential token cost growth (3x–10x multiplier) over long workflows.

### [H9] No CSRF Protection on State-Changing Endpoints
**File:** Frontend (multiple components)

POST/PATCH/DELETE requests rely only on Bearer tokens without CSRF token validation. This leaves the application vulnerable to cross-site request forgery attacks.

### [H10] Unvalidated Proxy Path in API Route
**File:** `frontend/src/app/api/proxy/[...path]/route.ts` | **Line:** 12

No validation or sanitization of path segments before constructing the backend URL. This opens potential for path traversal or injection attacks through the proxy layer.

---

## MEDIUM Issues

### [M1] Duplicate Files: router.py and benchmarks.py Are Identical
**File:** `backend/` — Both files contain the same code. One is unnecessary and creates maintenance confusion.

### [M2] No Version Pinning in requirements.txt
**File:** `backend/requirements.txt` — Dependencies have no version constraints. Builds are non-reproducible and vulnerable to dependency confusion or breaking changes.

### [M3] Non-Atomic MongoDB Operations (Race Conditions)
**File:** `backend/main.py` | **Lines:** 504–527 — Chat document fetch and update are separate operations. Concurrent requests can interleave messages or corrupt state. Use `find_one_and_update()` or transactions.

### [M4] Orphaned Chats on Folder Delete
**File:** `backend/main.py` | **Lines:** 910–918 — Two separate `update_many` calls without a transaction. If the second fails, `folder_id` is cleared but `project_id` still references the deleted folder.

### [M5] Silent JSON Parse Failures in Frontend API
**File:** `frontend/src/lib/api.ts` | **Line:** 43 — `response.json().catch(() => ({}))` silently returns an empty object on parse failure, masking server errors.

### [M6] Hardcoded Localhost Fallback in Proxy
**File:** `frontend/src/app/api/proxy/[...path]/route.ts` | **Line:** 7 — Falls back to `http://127.0.0.1:8000` if env vars are missing. In production, requests silently route to localhost instead of failing clearly.

### [M7] Overly Permissive CORS Regex
**File:** `backend/config.py` | **Lines:** 29–32 — Allows all private IP ranges and localhost on any port. In shared infrastructure, unintended services could make cross-origin requests.

### [M8] Weak Email Validation
**File:** `backend/auth_utils.py` | **Line:** 11 — Email regex accepts invalid addresses like `a@b.c` or `@test.com`. Use the `email-validator` package for RFC-compliant validation.

### [M9] No Prompt Length Limit
**File:** `backend/main.py` | **Lines:** 152–155 — Prompts are checked for emptiness but have no maximum length. A user could submit an extremely large prompt, causing OOM or runaway API costs.

### [M10] Incomplete .gitignore (Backend)
**File:** `backend/.gitignore` — Missing entries for `.pkl`, `benchmark_model/`, `.env.local`, `venv/`, `.DS_Store`. Model artifacts or local config could be accidentally committed.

---

## LOW Issues

### [L1] Inconsistent Python Version Syntax
**File:** `backend/` (multiple) — Mixes `list[str]` (3.9+) with `dict | None` (3.10+). Inconsistent compatibility targets; may break on older Python versions.

### [L2] Hardcoded Magic Numbers
**File:** `frontend/src/contexts/AlertContext.tsx` | **Line:** 34 — Alert timeout of 4200ms is a hardcoded magic number. Should be a named constant.

### [L3] Missing Accessibility Labels on External Links
**File:** `frontend/src/components/ui/MarkdownRenderer.tsx` | **Lines:** 25–31 — Links with `target="_blank"` lack `aria-label` indicating they open in a new tab (WCAG compliance).

### [L4] Silent .catch(() => {}) Patterns Throughout Frontend
**File:** Frontend (multiple) — Multiple components silently swallow errors with empty catch blocks, making debugging extremely difficult.

---

## Recommendations

**Immediate (Today):** Rotate all API keys and the MongoDB password. Remove pickle deserialization or replace with a safe format. Add a threading lock to the Gemini rate limiter. Fix the `GOOGLE_CLIENT_ID` typo in frontend constants.

**Before Production:** Add input length limits on all Pydantic models. Implement CSRF token protection. Add authorization (`user_id`) checks on all post-update refetch queries. Replace silent `except: pass` blocks with proper error logging. Validate and sanitize the proxy path parameter.

**Next Sprint:** Pin all dependency versions in requirements.txt. Switch to `find_one_and_update()` for atomic operations. Add prompt length limits. Implement proper email validation. Remove duplicate `router.py`/`benchmarks.py`. Add rate limiting on frontend API calls.

**Ongoing:** Set up automated security scanning (Bandit for Python, ESLint security plugin). Add comprehensive error monitoring (Sentry or similar). Improve accessibility labels. Establish a code review checklist covering these patterns.

---

*Estimated fix time: Critical issues only — 4–6 hours | All critical + high — 8–12 hours | All issues — 2–3 days*
