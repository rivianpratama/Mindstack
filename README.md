# Mindstack

Eight Sakinorva cognitive-function scores in, one streamed self-reflection report out — a set of
hypotheses with the math shown, explicitly **not** a 16-type label. All arithmetic runs in the
browser; the server only writes prose. Nothing is stored.

## Setup

```bash
npm install
npm run build:data   # compiles docs/knowledge/ into src/server/prompt/*.json (required once,
                     # and again after editing knowledge files)
```

The report generator needs a DeepSeek API key in the environment of the API server
(see src/server/deepseek.ts).

## Development

Two servers (both configured in `.claude/launch.json`):

```bash
npm run dev          # Vite client on :5173, proxies /api to :8787
```

```bash
npm run dev:server   # Hono API on :8787
```

## Checks

```bash
npm test             # vitest, plain node — no DOM environment
```

```bash
npm run typecheck
```

## Where the rules live

Architecture invariants, the motion budget, and the browser-support floor are indexed in
[CLAUDE.md](CLAUDE.md) (each line names the file that owns the rationale). UI provenance and
upstream diff-bases for vendored material are in [docs/design/](docs/design/). The domain
knowledge pipeline is `docs/sources/ → docs/knowledge/ → npm run build:data`; never file UI
material there.
