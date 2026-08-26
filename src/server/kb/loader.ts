/**
 * Typed accessor over the knowledge-base fragment store.
 *
 * `fragments.json` is a build artifact produced by `scripts/build-kb.mjs` from
 * `docs/knowledge/*.md`; never hand-edit it. Fragments are markdown strings meant to be
 * dropped verbatim into the LLM prompt (see src/server/prompt/assemble.ts).
 *
 * Every key the build guarantees is reachable through a typed accessor, so a typo is a
 * compile error rather than an `undefined` silently landing in a prompt. Requires ESM
 * (the module resolves the artifact relative to `import.meta.url`).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------- key types

export type FunctionKey = 'Ni' | 'Ne' | 'Si' | 'Se' | 'Ti' | 'Te' | 'Fi' | 'Fe';

/**
 * Per-function blocks carried into prompts (01):
 *   a = what it processes · b = engaged · c = over-engaged
 *   d = unengaged · e = eruptive · h = supporting
 * 01's (f) demand cues and (g) confusables are deliberately not in the store.
 */
export type FunctionBlock = 'a' | 'b' | 'c' | 'd' | 'e' | 'h';

/** 03 §1–§10, worked examples stripped. */
export type DynamicKey =
  | 'internal-circuit'
  | 'external-circuit'
  | 'balanced-lead'
  | 'pluralistic'
  | 'lead-spike'
  | 'shadow-floor'
  | 'polarized-axes'
  | 'jp-pressure'
  | 'weak-signal'
  | 'development';

/** 02 §4 shape taxonomy, `*Detect:*` clauses stripped (detection lives in src/shared/geometry). */
export type ShapeId =
  | 'S1'
  | 'S2'
  | 'S3'
  | 'S3b'
  | 'S4'
  | 'S5'
  | 'S6'
  | 'S7'
  | 'S8'
  | 'S9'
  | 'S10'
  | 'S11'
  | 'S12';

/** 04 §a–§d friction machinery (§e's worked scenarios are excluded by the build). */
export type FrictionKey =
  | 'intake-schema'
  | 'demand-taxonomy'
  | 'classification'
  | 'modifiers'
  | 'template';

/** Fragments injected into every report: 03 §10 and 04 §f. */
export type AlwaysKey = 'development' | 'state-honesty';

export const FUNCTION_KEYS: readonly FunctionKey[] = [
  'Ni',
  'Ne',
  'Si',
  'Se',
  'Ti',
  'Te',
  'Fi',
  'Fe',
];
export const FUNCTION_BLOCKS: readonly FunctionBlock[] = ['a', 'b', 'c', 'd', 'e', 'h'];
export const SHAPE_IDS: readonly ShapeId[] = [
  'S1',
  'S2',
  'S3',
  'S3b',
  'S4',
  'S5',
  'S6',
  'S7',
  'S8',
  'S9',
  'S10',
  'S11',
  'S12',
];
export const DYNAMIC_KEYS: readonly DynamicKey[] = [
  'internal-circuit',
  'external-circuit',
  'balanced-lead',
  'pluralistic',
  'lead-spike',
  'shadow-floor',
  'polarized-axes',
  'jp-pressure',
  'weak-signal',
  'development',
];
export const FRICTION_KEYS: readonly FrictionKey[] = [
  'intake-schema',
  'demand-taxonomy',
  'classification',
  'modifiers',
  'template',
];
export const ALWAYS_KEYS: readonly AlwaysKey[] = ['development', 'state-honesty'];

// ---------------------------------------------------------------- store

export interface FragmentStoreMeta {
  generator: string;
  sources: string[];
  excluded: string[];
  fragmentCount: number;
}

export interface FragmentStore {
  meta: FragmentStoreMeta;
  /** Flat map of dotted fragment key → markdown text. */
  fragments: Record<string, string>;
}

let cache: FragmentStore | null = null;

function loadStore(): FragmentStore {
  if (cache) return cache;

  const candidates: Array<string | URL> = [
    new URL('./fragments.json', import.meta.url),
    resolve(process.cwd(), 'src/server/kb/fragments.json'),
  ];

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as FragmentStore;
      if (!parsed || typeof parsed.fragments !== 'object') {
        throw new Error('fragments.json has no `fragments` object');
      }
      cache = parsed;
      return cache;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    'kb/loader: could not load fragments.json. Run `node scripts/build-kb.mjs`. ' +
      `Last error: ${String(lastError)}`,
  );
}

function get(key: string): string {
  const text = loadStore().fragments[key];
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error(
      `kb/loader: fragment "${key}" is missing from fragments.json. Rebuild with ` +
        '`node scripts/build-kb.mjs`',
    );
  }
  return text;
}

// ---------------------------------------------------------------- accessors

/** 01 per-function block, e.g. `getFunctionBlock('Fe', 'e')` → Fe's eruptive expression. */
export function getFunctionBlock(fn: FunctionKey, block: FunctionBlock): string {
  return get(`functions.${fn}.${block}`);
}

/** 03 engagement dynamic (Detection/Inside/Observable/Trade-offs/…, examples stripped). */
export function getDynamic(key: DynamicKey): string {
  return get(`dynamics.${key}`);
}

/** 02 §4 shape interpretation (hypotheses / "Not:" / falsifiable marker). */
export function getShape(id: ShapeId): string {
  return get(`shapes.${id}`);
}

/** 04 friction-map machinery. */
export function getFriction(key: FrictionKey): string {
  return get(`friction.${key}`);
}

/** The always-on fragments: 03 §10 development snapshot and 04 §f state-vs-trait honesty. */
export function getAlways(): Record<AlwaysKey, string> {
  return {
    development: get('always.development'),
    'state-honesty': get('always.state-honesty'),
  };
}

/** 05 §5.6 disclaimer block, verbatim. Every report must end with this text. */
export function getDisclaimer(): string {
  return get('rules.disclaimer');
}

/** Every dotted key in the store, in build order. Useful for tests and inventory checks. */
export function listKeys(): string[] {
  return Object.keys(loadStore().fragments);
}

/** Provenance of the loaded artifact (source files, exclusions, fragment count). */
export function getStoreMeta(): FragmentStoreMeta {
  return loadStore().meta;
}
