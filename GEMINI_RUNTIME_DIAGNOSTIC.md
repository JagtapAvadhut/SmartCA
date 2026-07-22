# Gemini Runtime Diagnostic

**Date:** 2026-07-22  
**Question:** Why does Google return HTTP 401 / Invalid API key for SmartCA?  
**Verdict (proven):** **Not a SmartCA wiring bug.** Google rejects the configured credential with reason **`ACCESS_TOKEN_TYPE_UNSUPPORTED`**.  

---

## Root Cause (final)

| Claim | Proven? | Evidence |
|---|---|---|
| SmartCA truncates/escapes/mangles the key | **No** | Key bytes identical across `Go/.env`, root `.env`, and container env |
| SmartCA calls wrong endpoint | **No** | Uses `https://generativelanguage.googleapis.com/v1beta` |
| SmartCA uses wrong auth header | **No** | Sends `X-goog-api-key` (official REST style) |
| Network/TLS/DNS blocked | **No** | Outbound HTTPS works; TLS verify OK |
| Key missing in container | **No** | Container has key length 53, prefix `AQ.***`, suffix `****` |
| **Google rejects this credential** | **Yes** | HTTP **401** + `reason: ACCESS_TOKEN_TYPE_UNSUPPORTED` |

### Classification

**Category 2 + 3:** Invalid / unsupported Google API credential (account/key issue on Googleâ€™s side for this token), **not** a SmartCA application defect.

Control experiment:

| Request | HTTP | Meaning |
|---|---|---|
| `GET /v1beta/models` **without** key | **403** | Endpoint reachable; Google asks for an API key |
| Same request **with** runtime key (`x-goog-api-key`) | **401** | Key was received; Google says credential type unsupported |
| Same request as `Authorization: Bearer` | **401** | `API_KEY_SERVICE_BLOCKED` |
| Same key from host curl | **401** | Same rejection outside Docker |
| Same key from Docker alpine sidecar on `smartca_smartca-net` | **401** | Same rejection from container network |

If SmartCA were dropping the key, Google would return **403** (â€œunregistered callersâ€), not **401 ACCESS_TOKEN_TYPE_UNSUPPORTED**.

---

## Key Validation (Step 1)

| Property | Go/.env | root .env | container |
|---|---|---|---|
| Length | 53 | 53 | 53 |
| First 6 | `AQ.***` | `AQ.***` | `AQ.***` |
| Last 4 | `****` | `****` | `****` |
| Leading/trailing whitespace | none | none | none |
| CR / LF / TAB | none | none | none |
| Quotes | none | none | none |
| Control characters | none | none | none |
| UTF-8 BOM on value | no | no | no |
| File BOM | no | no | n/a |
| Equals across sources | **identical** | **identical** | **identical** |

Prefix class: **`AQ.`** = Google AI Studio **Auth key** format (not classic `AIzaâ€¦` traffic key).

Hex (first 8 / last 4): redacted (prefix class `AQ.` confirmed; suffix redacted)

**Key was not modified by this investigation.**

---

## Environment / Container (Steps 2â€“3)

| Source | AI_PROVIDER | GEMINI_MODEL | Key present |
|---|---|---|---|
| `Go/.env` | gemini | gemini-flash-latest | yes (len 53) |
| root `.env` | gemini | gemini-flash-latest | yes (len 53) |
| `smartca-api` container | gemini | gemini-flash-latest | yes (len 53) |

Note: API image is **distroless** (no shell / no `printenv`). Container env was verified via `docker inspect`. Live Google calls used an alpine/curl sidecar on the same Docker network with the **same key bytes**.

---

## Direct Google Tests (Step 4)

Endpoint: `https://generativelanguage.googleapis.com/v1beta/models?pageSize=5`

### With `x-goog-api-key` (SmartCAâ€™s method)

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="invalid_token"
Content-Type: application/json; charset=UTF-8
```

```json
{
  "error": {
    "code": 401,
    "message": "Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential. ...",
    "status": "UNAUTHENTICATED",
    "details": [
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        "reason": "ACCESS_TOKEN_TYPE_UNSUPPORTED",
        "metadata": {
          "method": "google.ai.generativelanguage.v1beta.ModelService.ListModels",
          "service": "generativelanguage.googleapis.com"
        }
      }
    ]
  }
}
```

### With `?key=` query param

Same **401** / `ACCESS_TOKEN_TYPE_UNSUPPORTED`.

### With `Authorization: Bearer <key>`

**401** / reason `API_KEY_SERVICE_BLOCKED`.

### `generateContent` on `gemini-flash-latest`

Same **401** / `ACCESS_TOKEN_TYPE_UNSUPPORTED`.

### No key (control)

**403** `PERMISSION_DENIED` â€” â€œPlease use API Keyâ€¦â€.

---

## Models (Step 5)

Could **not** list models with this credential (401 before model enumeration).  
Therefore model selection cannot be validated against a live catalog until a working key is supplied.

Configured model remains `gemini-flash-latest` (official latest alias). SmartCA also supports discovery once auth succeeds.

---

## SDK / Client Review (Step 6)

SmartCA does **not** use a deprecated Gemini SDK. It uses direct HTTPS REST:

| Item | Implementation |
|---|---|
| Base URL | `https://generativelanguage.googleapis.com/v1beta` |
| Auth | `X-goog-api-key: <key>` |
| List models | `GET /models` |
| Generate | `POST /models/{model}:generateContent` |
| Stream | `POST /models/{model}:streamGenerateContent?alt=sse` |
| Body | JSON `contents[].parts[].text` + optional `systemInstruction` |

This matches current Gemini Developer API REST. No Vertex (`aiplatform.googleapis.com`) mix-up.

---

## Network (Step 7)

| Check | Result |
|---|---|
| DNS `generativelanguage.googleapis.com` | resolves |
| TLS from Docker network | `ssl_verify=0` (success), handshake ~100ms |
| Outbound HTTPS from sidecar | works |
| Host curl | works |

No firewall/proxy symptom: unauthenticated calls reach Google and return structured JSON errors.

---

## Runtime SmartCA Tests (Step 8)

| Test | Result |
|---|---|
| Settings provider | `gemini` (not mock) |
| hasApiKey | `true` |
| Test Connection | `ok=false`, message includes Google reason |
| After error-message fix | `Invalid API key [ACCESS_TOKEN_TYPE_UNSUPPORTED] â€” Google rejected this credential type...` |

Full generate/stream/history success **cannot** pass until Google accepts a valid key.

---

## What this is / is not

### Not SmartCA
- No truncation, CRLF, quotes, BOM, or env mismatch  
- Correct endpoint + header  
- Network healthy  

### Is Google credential rejection
- `ACCESS_TOKEN_TYPE_UNSUPPORTED` on Generative Language API  
- Same failure host + container  
- `AQ.` auth-style key rejected as unsupported token type for this API call  

Likely operator next steps (outside SmartCA code):

1. In [Google AI Studio](https://aistudio.google.com/apikey) **revoke** this key and **create a new** Gemini API key.  
2. Confirm Generative Language API access for the project.  
3. Put the new key in `Go/.env`, run `scripts/sync-docker-ai-env.ps1`, recreate API.  
4. Re-run Test Connection â€” expect `Connected` and a model list.

---

## Files Changed (diagnostic hardening only)

| File | Change |
|---|---|
| `Go/internal/ai/gemini/models.go` | Parse Google `details[].reason`; `DisplayMessage()` |
| `Go/internal/ai/gemini/client.go` / `discover.go` | Surface reason in classified errors |
| `Go/internal/ai/runtime.go` | Human Test Connection text for `ACCESS_TOKEN_TYPE_UNSUPPORTED` / `API_KEY_SERVICE_BLOCKED` |
| `GEMINI_RUNTIME_DIAGNOSTIC.md` | This report |

No key values were committed. Diag temp files cleaned.

---

## Regression

| Check | Status |
|---|---|
| Unit tests `./internal/ai/...` | pass |
| API rebuilt & healthy | pass |
| Test Connection shows Google reason | pass |
| Proof: no-key â†’ 403; with-key â†’ 401 ACCESS_TOKEN_TYPE_UNSUPPORTED | pass |

---

## Stop Condition â€” Proven Outcome

**Proven: Invalid / unsupported Google API key (credential rejected by Google), not a SmartCA bug.**

Concrete evidence: identical key delivery + correct REST auth + healthy network + Google response reason **`ACCESS_TOKEN_TYPE_UNSUPPORTED`**.
