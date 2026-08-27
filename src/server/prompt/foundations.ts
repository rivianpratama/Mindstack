/**
 * foundations.ts: composes the report generator's full system message.
 *
 * FULL system message = Part A (foundations.json, the cognitive-function theory, background
 * reference) + Part B (the static SYSTEM_PROMPT contract). Part A is prepended so the model
 * absorbs the full theory BEFORE any per-request analysis; the operating contract (Part B)
 * stays adjacent to the user message so its rules are freshest at generation time.
 *
 * system-prompt.ts is intentionally left byte-for-byte untouched: this file only wraps it.
 *
 * foundations.json is a build artifact; never hand-edit it. Regenerate with
 * `node scripts/build-foundations.mjs` (compiles docs/knowledge 00-04 + 06-foundations-digest).
 */

import foundationsData from './foundations.json';
import { SYSTEM_PROMPT } from './system-prompt';

interface FoundationsArtifact {
  meta: {
    sources: string[];
    digestPresent: boolean;
    chars: number;
    approxTokens: number;
  };
  text: string;
}

const artifact = foundationsData as unknown as FoundationsArtifact;
if (!artifact || typeof artifact.text !== 'string' || artifact.text.length === 0) {
  throw new Error('prompt/foundations: foundations.json has no `text` string.');
}

let cache: string | null = null;

/**
 * The full system message: foundations (Part A) followed by the generation contract (Part B).
 *
 * Lazily composed and cached (mirroring kb/loader.ts), so the string is byte-stable for the
 * process lifetime. That stability is what lets DeepSeek's automatic prefix caching cache the
 * whole preamble across every request, no matter the profile.
 */
export function fullSystemPrompt(): string {
  if (cache !== null) return cache;
  cache = `${artifact.text}\n\n${SYSTEM_PROMPT}`;
  return cache;
}
