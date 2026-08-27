# Provider failover: OpenRouter primary, DeepSeek fallback

Date: 2026-08-27. Status: approved in conversation.

## Problem

The report generator calls a single provider (DeepSeek direct) built from `DEEPSEEK_*`
env vars. The intended primary is now the free OpenRouter model
`deepseek/deepseek-v4-flash:free`, which is heavily rate-limited (429) and periodically
unavailable. When the free tier is down the report should not fail; it should fall back to
the paid DeepSeek API.

## Decision

Runtime failover across an ordered provider list. Always try OpenRouter first; if it fails
**before the first byte of any kind reaches the reader** (429 / 5xx / network / auth /
empty-with-nothing-yielded), switch to DeepSeek and retry once. Once anything has streamed
(thinking or content) the error propagates as-is — no rewind, no failover.

Both providers are optional and additive:

- `OPENROUTER_API_KEY` set → OpenRouter is the primary. Defaults:
  `OPENROUTER_MODEL=deepseek/deepseek-v4-flash:free`,
  `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`.
- `DEEPSEEK_API_KEY` set → DeepSeek is the fallback (existing `DEEPSEEK_*` defaults).
- Only one set → that one provider, no failover (behaves exactly like today).
- Neither set → unconfigured; the route's existing not-configured path is unchanged.

Rejected: (a) config-only selection (pick one at startup) — a rate-limited free tier just
errors out; (b) provider looping inside `streamReport` — that generator is already dense
(per-attempt retries, exhaustion fallback, prelude splitter); a second loop axis inside it
hurts readability and testability.

## Architecture (two layers)

- **`streamOneProvider(request, provider)`** — the current `streamReport` body, extracted
  verbatim except that provider identity (`apiKey`/`baseURL`/`model`/`kind`) now comes
  from the `provider` argument instead of `readConfig()`. Retains all existing behavior:
  pre-stream retries, exhaustion fallback (thinking-off / no-plan), prelude splitter.
- **`streamReport(request)`** — keeps the public name (route and existing tests call it
  unchanged). Now the failover wrapper: resolves the ordered provider list, delegates to
  `streamOneProvider` for each, and advances to the next provider only when the inner
  generator throws **before yielding its first item**. Once it has forwarded any item, an
  inner error propagates. With a single configured provider it is transparent.

The reasoning mode (`DEEPSEEK_REASONING_EFFORT`: `prompted` / `none` / level) stays a
single shared policy read from the environment; it is translated per provider `kind`.
Prompted mode is provider-agnostic (prompt + content-stream splitting), so it behaves
identically on both.

## Provider-aware request body

`buildChatRequest(input)` gains an optional `input.kind` (default `'deepseek'`, so all
existing callers and tests are unchanged):

- `kind: 'deepseek'` — unchanged: `thinking: { type: 'enabled' | 'disabled' }` plus
  `reasoning_effort` only when thinking is on and a level was chosen.
- `kind: 'openrouter'` — DeepSeek's `thinking` param is dropped (OpenRouter uses its own
  unified control). Emits `reasoning`:
  - thinking off (`none` / `prompted`) → `reasoning: { enabled: false }`
  - a native level → `reasoning: { effort: <low|high|max> }`
  - server default (`null`) → `reasoning: { enabled: true }`

OpenRouter forwards unknown params upstream rather than 400-ing, so an unrecognized field
would not hard-fail; the translation above is nonetheless correct per OpenRouter's docs.
The OpenRouter client also sends an `X-Title: Mindstack` attribution header (and
`HTTP-Referer` when `OPENROUTER_APP_URL` is set).

## Provider-agnostic reasoning reader

The delta loop reads reasoning from **`delta.reasoning_content` (DeepSeek) or
`delta.reasoning` (OpenRouter)** — whichever is a non-empty string — into `thinking`
items and `reasoningChars`. DeepSeek streams unchanged; OpenRouter reasoning is no longer
silently dropped. (`reasoning_details` arrays are out of scope; default mode is
thinking-off, so reasoning deltas should not appear anyway.)

## Error handling and degradation

Failover attempts are logged to the server terminal only
(`[failover] openrouter failed before first byte; trying deepseek: <detail>`). The reader
only ever sees the final provider's reader-safe `publicMessage`. `describe()` wording is
already provider-neutral ("the report generator ..."), so no per-provider public messages
are needed. `isConfigured()` becomes "≥1 provider resolves." A rate-limited free primary
burns its ~1s of 429 backoff before failing over — a deliberate trade for transient-blip
resilience.

## Testing (no real LLM calls)

New `test/deepseek.failover.test.ts` with its own mocked `openai` module:

- `resolveProviders()` ordering and degradation across env combinations (both / only
  OpenRouter / only DeepSeek / neither), and the `OPENROUTER_*` defaults.
- `buildChatRequest` reasoning translation per `kind` (off / level / server-default on
  OpenRouter; DeepSeek shape unchanged).
- Failover decision: primary throws pre-yield (401 fast, and a 429 storm after retries)
  → advances to DeepSeek and succeeds; primary yields then throws → propagates, no
  failover; only-one-provider → no failover; neither → not-configured error.

Existing `deepseek.request.test.ts`, `deepseek.stream.test.ts`, `route.generate.test.ts`,
`prompt.assemble.test.ts` and the SSE wire contract stay untouched and green.
`.env.example` gains the `OPENROUTER_*` block.
