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

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

let cache: string | null = null;

function loadFoundationsText(): string {
  const candidates: Array<string | URL> = [
    new URL('./foundations.json', import.meta.url),
    resolve(process.cwd(), 'src/server/prompt/foundations.json'),
  ];

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as FoundationsArtifact;
      if (!parsed || typeof parsed.text !== 'string' || parsed.text.length === 0) {
        throw new Error('foundations.json has no `text` string');
      }
      return parsed.text;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    'prompt/foundations: could not load foundations.json. Run `node scripts/build-foundations.mjs`. ' +
      `Last error: ${String(lastError)}`,
  );
}

/**
 * The full system message: foundations (Part A) followed by the generation contract (Part B).
 *
 * Lazily composed and cached (mirroring kb/loader.ts), so the string is byte-stable for the
 * process lifetime. That stability is what lets DeepSeek's automatic prefix caching cache the
 * whole preamble across every request, no matter the profile.
 */
export function fullSystemPrompt(): string {
  if (cache !== null) return cache;
  cache = `${loadFoundationsText()}\n\n${SYSTEM_PROMPT}`;
  return cache;
}
