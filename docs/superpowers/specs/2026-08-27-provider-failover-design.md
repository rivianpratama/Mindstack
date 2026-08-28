# Provider failover: Gemini primary, OpenRouter second, DeepSeek fallback

Date: 2026-08-27. Status: approved in conversation.

> **Order changed (2026-08-27):** Gemini is now the PRIMARY, OpenRouter second, DeepSeek
> third. The body below describes the original two-provider (OpenRouter → DeepSeek) design
> and still holds for those two; the Gemini addition and the new ordering are specified in
> the final amendment, "## Amendment (2026-08-27): Gemini added as primary (3-tier failover)".

## Amendment (2026-08-27, live test): primary model changed to minimax-m3

The intended primary `deepseek/deepseek-v4-flash:free` does not exist. A live probe with the
configured key returned `404: "This model is unavailable for free... use this slug instead:
deepseek/deepseek-v4-flash"` (the PAID slug), and the models list shows **no** DeepSeek `:free`
variant at all. The user chose to keep a free primary rather than pay, so the default
`OPENROUTER_DEFAULT_MODEL` is now **`minimax/minimax-m3:free`** — head-to-head the strongest
free model still reliably available that honors the report contract (plain B1 language, no
em-dashes, clean en/id long-form, `finish=stop` at ~500 words). Rejected free alternatives:
`thinkingmachines/inkling:free` (403, agentic-harness only), `z-ai/glm-5.2:free` (persistent
429), `google/gemma-4-31b-it:free` (flaky 429), `nvidia/nemotron-3-super-120b:free` (emits
em-dashes). The app's request translation (`reasoning:{enabled:false}`) and streaming reader
were verified correct against the live API on the paid deepseek slug and on minimax-m3.
Everything else below stands; only the default slug changed. To run the paid DeepSeek model
through OpenRouter, set `OPENROUTER_MODEL=deepseek/deepseek-v4-flash`.

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

## Amendment (2026-08-27): Gemini added as primary (3-tier failover)

Status: approved in conversation. A third provider, **Google Gemini**, is inserted at the
**front** of the failover chain, making the runtime order **Gemini → OpenRouter → DeepSeek**.
Rationale: user directive ("primary Gemini, 2nd OpenRouter, 3rd DeepSeek"). Nothing about the
failover *mechanism* changes — only the provider list grows by one and reorders. The
"advance only on a pre-first-byte failure, never rewind once streamed" rule, the per-provider
retries, the exhaustion fallbacks, and the prompted-plan splitter are all unchanged.

### Why it fits with no new dependency

Gemini exposes an **OpenAI-compatible endpoint**
(`https://generativelanguage.googleapis.com/v1beta/openai/`), so it is a third `kind` served
by the *same* `openai` SDK client with a different key, base URL, and model — exactly the
OpenRouter/DeepSeek arrangement. This keeps the "zero new runtime dependencies" invariant. The
SDK sends the key as a Bearer token; Gemini needs no attribution headers (unlike OpenRouter).

### Configuration (optional and additive, like the others)

- `GEMINI_API_KEY` set → Gemini is the primary (first in `resolveProviders()`). Defaults:
  `GEMINI_MODEL=gemini-3.7-flash`, `GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/`.
- Order in `resolveProviders()`: **Gemini first, then OpenRouter, then DeepSeek.** Any subset
  may be absent; an empty list is still the honest-null (unconfigured) path.
- `ProviderKind` gains `'gemini'` (now `'gemini' | 'openrouter' | 'deepseek'`).

### Provider-aware request body: `kind: 'gemini'`

The reasoning dialect is the only novel part. **Verified against Google's OpenAI-compat and
Gemini 3 docs (2026-08-27): Gemini 3 models CANNOT fully disable thinking.**
`reasoning_effort: "none"` disables thinking only on Gemini **2.5** models; for Gemini 3 the
floor is `minimal` ("matches the 'no thinking' setting for most queries," but "does not
guarantee that thinking is off"). `reasoning_effort` and `thinking_level`/`thinking_config`
are mutually exclusive, and `reasoning_effort: "medium"` is reported to 400 on Gemini 3 over
this endpoint (the app never emits `medium`, so this is avoided for free).

To honor "reasoning off" as closely as the chosen model allows AND keep the reader clean, the
Gemini branch uses Gemini's **native thinking config** (not `reasoning_effort`), passed through
as a top-level `extra_body` field on the request body (the same pass-through the DeepSeek
`thinking` and OpenRouter `reasoning` fields already rely on). Translation of the shared
resolved reasoning mode (`resolveReasoningEffort`), per `kind: 'gemini'`:

- thinking **off** (`none` / `prompted` — the default) →
  `extra_body: { google: { thinking_config: { thinking_level: 'minimal', include_thoughts: false } } }`.
  Minimal thinking, and **no thought summaries streamed** to the reader.
- explicit native **level** (`low` / `high` / `max`) → `thinking_level` `low` / `high` / `high`
  (Gemini 3 Flash has no level above `high`; `max` maps to `high`), with `include_thoughts: true`
  so an opt-in native pass is visible, matching the other providers' native paths.
- server **default** (`null`, i.e. `DEEPSEEK_REASONING_EFFORT=default`) → omit `thinking_config`
  entirely; Gemini applies its own dynamic default.

No `reasoning_effort`, no DeepSeek `thinking`, and no OpenRouter `reasoning` field ever rides a
Gemini request. `buildChatRequest`'s default `kind` stays `'deepseek'`, so all pre-existing
callers and tests are unchanged.

### Reasoning reader: unchanged

The delta loop already reads `delta.reasoning_content` **or** `delta.reasoning` into `thinking`
items, so any Gemini thought field is covered. On the default path `include_thoughts: false`
means none stream anyway. `describe()`'s status mapping (401/403/429/5xx/other-4xx) is
provider-neutral and needs no change; a Gemini failure fails over to OpenRouter under the same
rules OpenRouter already fails over to DeepSeek.

### Testing (no real LLM calls), extending `test/deepseek.failover.test.ts`

- `ENV_KEYS` gains `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_BASE_URL` (saved/restored).
- `resolveProviders()`: all three keys → `['gemini','openrouter','deepseek']`; Gemini defaults
  (model + base URL); only-Gemini degrades to a single transparent provider; `GEMINI_MODEL`
  override honored.
- `buildChatRequest({ kind: 'gemini' })`: off → the `extra_body.google.thinking_config` shape
  with `thinking_level: 'minimal'`, `include_thoughts: false`, and **no** `reasoning_effort` /
  `thinking` / `reasoning`; explicit level → `thinking_level` mapped (incl. `max`→`high`);
  `default` → no `thinking_config`. Messages/sampling/stream shape identical across kinds.
- Failover: Gemini throws pre-first-byte → advances to OpenRouter → DeepSeek; Gemini yields
  then throws → propagates, no failover.
- Export `GEMINI_DEFAULT_MODEL` / `GEMINI_DEFAULT_BASE_URL` for the test, mirroring the
  OpenRouter/DeepSeek default exports.

`.env.example` gains a `GEMINI_*` block at the top, marks Gemini the primary, and documents the
"Gemini 3 cannot fully disable thinking; minimal is the floor" caveat. `npm test` and
`npm run typecheck` must pass.

Sources: Google AI for Developers — OpenAI compatibility
(`https://ai.google.dev/gemini-api/docs/openai`) and the Gemini 3 developer guide
(`https://ai.google.dev/gemini-api/docs/gemini-3`).

### Correction (2026-08-28, live test): thinking-off level 'minimal' → 'low'

The docs above describe "Gemini 3 Flash" as accepting a `minimal` thinking level, but a live
probe with the configured key showed the actual default model, **gemini-3.7-flash, REJECTS
`thinking_level: 'minimal'`** — `400 INVALID_ARGUMENT: "Thinking level MINIMAL is not supported
for this model"`. Because a 400 is a non-retryable 4xx, every primary call failed and the chain
failed over past Gemini on **every** request (the "Gemini is failing" report). Probed live:
`minimal` → 400, `low` → 200, `high` → 200. So the thinking-off path sends the model's real
floor, **`thinking_level: 'low'`** (still `include_thoughts: false`), captured as the
`GEMINI_MIN_THINKING_LEVEL` constant so the reason and the value live in one place. The
`extra_body.google.thinking_config` pass-through itself was confirmed correct — Gemini received
and parsed it; only the level *value* was rejected. Explicit levels (low/high, max→high) were
already valid and are unchanged. The two tests that pinned `'minimal'` now assert `'low'`.

### Correction (2026-08-28, live test): failover gates on CONTENT, not thinking

**Supersedes** the original "Decision" and "Architecture" wording above ("Once anything —
thinking or content — has streamed, the error propagates as-is; no rewind, no failover").

A live run surfaced a second failure: with Gemini primary in prompted mode, `gemini-3.7-flash`
streamed the start of the PLANNING PASS (re-tagged `thinking` by the prelude splitter) and then
its stream **truncated** before the report heading (`finish_reason: null`, ~250–550 chars, varying
run to run — provider-side truncation under load, alongside frequent 503s). That yields **0
report content** → empty-report → the no-plan retry → a transient 503. But because the plan had
already streamed as `thinking`, the failover wrapper treated the provider as committed
(`yielded === true`) and **refused to fail over**, surfacing a hard error instead of falling
through to OpenRouter/DeepSeek. Since the primary ALWAYS streams its plan first in prompted mode,
the old rule defeated the entire chain for the primary.

**Fix:** `streamReport` now advances to the next provider whenever the inner generator throws
before yielding any report **CONTENT**. Streamed **thinking** (the prompted plan, native
reasoning murmur) no longer blocks failover — it is ephemeral scratch, never buffered/audited/part
of the report, so replaying it from the next provider duplicates no report; the reader just sees
the murmur continue. Once a CONTENT byte has streamed, switching would duplicate the report, so
the error still propagates (unchanged). Implemented by tracking `contentYielded` (set only on
`item.kind === 'content'`) instead of a byte-agnostic `yielded`. The test that pinned the old
behavior ("thinking counts as a byte → no failover") is inverted, and a test mirroring the real
Gemini prompted-plan-then-truncate → failover path is added.

Note on the transient Gemini instability itself: the truncations and 503s are provider-side
load/preview instability, exactly what failover absorbs. With this fix a flaky primary degrades
to "fails over to a healthy fallback" rather than "hard error."

### Correction (2026-08-28, live test): Gemini shows its thoughts; the app unwraps `<thought>`

**Supersedes** the "Provider-aware request body: `kind: 'gemini'`" thinking-off setting
(`include_thoughts: false`) and the "Reasoning reader: unchanged" claim above.

Symptom: with Gemini primary, the report streamed but the custom planning "thinking" murmur never
appeared. Root cause, found by live probe:

1. The prompted design assumes "native thinking OFF → the model writes the scripted plan in the
   content stream → the prelude splitter re-tags it as thinking." That holds for DeepSeek and
   OpenRouter, whose thinking is genuinely off. **Gemini cannot turn thinking off**, so it plans
   in its hidden native channel and (model- and run-dependent) writes only the report as content
   — the splitter sees the report heading immediately and emits **zero** thinking. Panel empty.
2. Even the explicit-level path was latently broken: Gemini's OpenAI-compat layer does **not**
   put thoughts in `reasoning_content`/`reasoning`. It **inlines them in `delta.content`, wrapped
   in a literal `<thought>...</thought>` block** (verified live against gemini-2.5-flash-lite;
   the framing is applied by the compat layer, so it is model-agnostic). The reasoning reader
   therefore never saw them, and with `include_thoughts: true` the raw tags would have leaked
   into the report buffer that guards and the disclaimer audit.

**Fix:**

- `buildChatRequest` (`kind: 'gemini'`): `include_thoughts` is now **true whenever
  thinking_config is sent** (both the thinking-off floor and explicit levels). Since thinking
  can't be off, showing the thoughts is the only way to give the reader a reasoning stream; the
  thinking-level floor ('low') still keeps it bounded.
- New leaf module **`src/server/gemini-thoughts.ts`** (`createThoughtUnwrapper`): a pure,
  streaming peeler that routes `<thought>...</thought>` interior to `thinking`, strips the marker
  tags, and passes the rest through as `content` — handling markers split across arbitrary delta
  boundaries, and acting as a transparent pass-through when no `<thought>` appears (so no model or
  path regresses). `streamOneProvider` runs Gemini content deltas through it **before** the
  prelude splitter, so the plan/report boundary is judged on report text only and a heading quoted
  inside a thought can't false-trigger it. The scripted plan, when the model also writes one,
  still splits off on top.

Net effect: the murmur now shows Gemini's real (bounded) reasoning as the Gemini-native analogue
of the scripted planning pass, robustly — regardless of whether the model writes a visible plan.
Tests: new `test/gemini-thoughts.test.ts` (unwrapper across hostile boundaries) plus a
`test/deepseek.failover.test.ts` case proving inline `<thought>` content surfaces as thinking and
never reaches the report; the two request-shape tests that pinned `include_thoughts: false` now
assert `true`. `npm test` (351) and `npm run typecheck` green.

Sources: live probe of `https://generativelanguage.googleapis.com/v1beta/openai/` (2026-08-28).
