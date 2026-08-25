#!/usr/bin/env node
/**
 * build-kb.mjs — knowledge-base fragment compiler.
 *
 * Reads the six docs/knowledge/*.md components and emits src/server/kb/fragments.json:
 * the prompt-ready fragment store consumed by src/server/prompt/assemble.ts.
 *
 * Zero dependencies (node:fs + node:path only). Run: `node scripts/build-kb.mjs`
 *
 * Key namespaces (see the implementation plan, Layer 2 · Fragment store):
 *   functions.<Ni|Ne|Si|Se|Ti|Te|Fi|Fe>.<a|b|c|d|e|h>   48 keys   (01, blocks f/g skipped)
 *   dynamics.<10 keys>                                  10 keys   (03 §1–§10, examples stripped)
 *   shapes.<S1..S12|S3b>                                13 keys   (02 §4, Detect: clauses stripped)
 *   friction.<intake-schema|demand-taxonomy|
 *             classification|modifiers|template>         5 keys   (04 §a–§d; §e EXCLUDED)
 *   always.<development|state-honesty>                   2 keys   (03 §10, 04 §f)
 *   rules.disclaimer                                     1 key    (05 §5.6, verbatim)
 *
 * Hard build-time guards (any violation aborts with a non-zero exit):
 *   G1  no worked-example leakage: "39.6", "Profile A/B" may not appear in any fragment
 *   G2  the fabricated "negative or frightening tone" attribution never enters a fragment
 *   G3  rules.disclaimer must contain "structured self-reflection" + "AERA/APA/NCME"
 *   G4  every expected key present, no unexpected keys, artifact re-parses from disk
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// ---------------------------------------------------------------- paths

const ROOT = resolve(dirname(process.argv[1]), '..');
const KB_DIR = join(ROOT, 'docs', 'knowledge');
const OUT_FILE = join(ROOT, 'src', 'server', 'kb', 'fragments.json');

const SOURCES = {
  overview: '00-overview.md',
  functions: '01-functions.md',
  geometry: '02-profile-geometry.md',
  dynamics: '03-engagement-dynamics.md',
  friction: '04-situational-conditioning.md',
  report: '05-report-generation.md',
};

// ---------------------------------------------------------------- constants

const FUNCTION_KEYS = ['Ni', 'Ne', 'Si', 'Se', 'Ti', 'Te', 'Fi', 'Fe'];
const FUNCTION_BLOCKS = ['a', 'b', 'c', 'd', 'e', 'h']; // (f) demand cues + (g) confusables: not prompt material
const SHAPE_IDS = ['S1', 'S2', 'S3', 'S3b', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12'];

const DYNAMICS_BY_SECTION = {
  1: 'internal-circuit',
  2: 'external-circuit',
  3: 'balanced-lead',
  4: 'pluralistic',
  5: 'lead-spike',
  6: 'shadow-floor',
  7: 'polarized-axes',
  8: 'jp-pressure',
  9: 'weak-signal',
  10: 'development',
};

const FRICTION_KEYS = ['intake-schema', 'demand-taxonomy', 'classification', 'modifiers', 'template'];

/** G1 — worked-example geometry must never reach a prompt; the live Signature owns geometry. */
const FORBIDDEN = ['39.6', 'Profile A', 'profile A', 'Profile B', 'profile B'];
/** G2 — fabricated attribution to mbti-notes (KNOWN-ISSUES, 03 §7 / 02 S9). */
const FABRICATED = 'negative or frightening tone';
/** G3 — disclaimer sanity anchors. */
const DISCLAIMER_ANCHORS = ['structured self-reflection', 'AERA/APA/NCME'];

const problems = [];
const notes = [];

// ---------------------------------------------------------------- markdown helpers

function read(name) {
  return readFileSync(join(KB_DIR, name), 'utf8').replace(/\r\n/g, '\n');
}

/** Split a document into sections at a given ATX heading level. Fenced code is ignored. */
function sections(md, level) {
  const prefix = '#'.repeat(level) + ' ';
  const out = [];
  let current = null;
  let fenced = false;
  for (const line of md.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced;
    if (!fenced && line.startsWith(prefix)) {
      current = { title: line.slice(prefix.length).trim(), lines: [] };
      out.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  return out.map((s) => ({ title: s.title, body: s.lines.join('\n').trim() }));
}

function findSection(md, level, matcher) {
  const hit = sections(md, level).find((s) => matcher(s.title));
  return hit ? hit.body : null;
}

const paragraphs = (body) => body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

/** Paragraphs that open a worked example ("**Example (profile A).** …"). */
const isExample = (p) => /^\*\*Example\b/.test(p);

/**
 * Flatten inline markdown links to their visible text: cross-file doc links are noise in a
 * prompt and invite the model to hallucinate file paths. All visible text is preserved.
 */
const flattenLinks = (text) => text.replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1');

/** Drop balanced parentheticals containing any of `tokens`. */
function dropParentheticals(text, tokens) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '(') {
      out += text[i++];
      continue;
    }
    const close = text.indexOf(')', i);
    if (close === -1) {
      out += text.slice(i);
      break;
    }
    const inner = text.slice(i, close + 1);
    if (tokens.some((t) => inner.includes(t))) {
      // also swallow the space that preceded the parenthetical
      out = out.replace(/[ \t]+$/, '');
    } else {
      out += inner;
    }
    i = close + 1;
  }
  return out;
}

/**
 * Drop whole sentences containing any of `tokens` (last-resort scrub). If a scrub would empty a
 * whole line — a table row, a list item, a heading — the source structure is not what this
 * compiler assumed, so it reports a problem instead of silently deleting content.
 */
function dropSentences(text, tokens, where = '') {
  return text
    .split('\n')
    .map((line) => {
      if (!tokens.some((t) => line.includes(t))) return line;
      const kept = line
        .split(/(?<=[.!?])\s+/)
        .filter((s) => !tokens.some((t) => s.includes(t)));
      const out = kept.join(' ').trim();
      if (!out && line.trim()) {
        problems.push(
          `guarded token appears in non-prose structure (${where || 'unknown fragment'}): ` +
            `"${line.trim().slice(0, 80)}" — fix the source doc, do not scrub it here`,
        );
      }
      return out;
    })
    .join('\n');
}

/**
 * G2 — if the fabricated attribution is ever reintroduced upstream, replace its sentence with
 * the doc's own [D→H] paraphrase from the same section when one exists, else drop the sentence.
 */
function stripFabricated(text, sectionBody, where) {
  if (!text.includes(FABRICATED)) return text;
  notes.push(`G2 fired: fabricated attribution found in ${where} — sentence replaced/removed`);
  const paraphrase = (sectionBody.match(/[^.\n]*\[D→H — our paraphrase[^.\n]*\./) || [])[0];
  const scrubbed = dropSentences(text, [FABRICATED], where);
  if (paraphrase && !scrubbed.includes(paraphrase.trim())) {
    return `${scrubbed.trim()} ${paraphrase.trim()}`;
  }
  return scrubbed;
}

/** Normalize a fragment: flatten links, strip guarded content, tidy whitespace. */
function sanitize(text, { sectionBody = '', where = '', verbatim = false } = {}) {
  let out = text;
  if (verbatim) return out.trim();
  out = flattenLinks(out);
  out = stripFabricated(out, sectionBody, where);
  if (FORBIDDEN.some((t) => out.includes(t))) {
    out = dropParentheticals(out, FORBIDDEN);
    if (FORBIDDEN.some((t) => out.includes(t))) out = dropSentences(out, FORBIDDEN, where);
    notes.push(`G1 scrub applied to ${where}`);
  }
  return out
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// ---------------------------------------------------------------- extractors

const fragments = {};

function put(key, text, opts) {
  const clean = sanitize(text, { ...opts, where: key });
  if (!clean) {
    problems.push(`empty fragment for ${key}`);
    return;
  }
  fragments[key] = clean;
}

/** 01 → functions.<Fn>.<a|b|c|d|e|h>; block labels stripped, epistemic tags kept inline. */
function buildFunctions() {
  const md = read(SOURCES.functions);
  for (const section of sections(md, 2)) {
    const fn = section.title.split(/[\s—-]/)[0];
    if (!FUNCTION_KEYS.includes(fn)) continue;

    const re = /\*\*\(([a-h])\)\s*([^*]+?)\*\*/g;
    const hits = [];
    let m;
    while ((m = re.exec(section.body)) !== null) {
      hits.push({ label: m[1], heading: m[2].trim(), start: m.index, afterHeading: re.lastIndex });
    }
    if (!hits.length) problems.push(`no lettered blocks found under 01 § ${section.title}`);

    hits.forEach((hit, i) => {
      if (!FUNCTION_BLOCKS.includes(hit.label)) return; // (f) and (g) are deliberately skipped
      const end = i + 1 < hits.length ? hits[i + 1].start : section.body.length;
      const rest = section.body.slice(hit.afterHeading, end).trim();
      put(`functions.${fn}.${hit.label}`, `**${hit.heading}** ${rest}`, {
        sectionBody: section.body,
      });
    });
  }
}

/** 03 §1–§10 → dynamics.*; "Example (profile …)" paragraphs stripped entirely. */
function buildDynamics() {
  const md = read(SOURCES.dynamics);
  for (const section of sections(md, 2)) {
    const num = Number((section.title.match(/^(\d+)\./) || [])[1]);
    const key = DYNAMICS_BY_SECTION[num];
    if (!key) continue;
    const kept = paragraphs(section.body).filter((p) => !isExample(p));
    const dropped = paragraphs(section.body).length - kept.length;
    if (dropped) notes.push(`dynamics.${key}: stripped ${dropped} worked-example paragraph(s)`);
    put(`dynamics.${key}`, kept.join('\n\n'), { sectionBody: section.body });
    if (key === 'development') {
      // 03 §10 is "always on" — also exposed under the always.* namespace.
      put('always.development', kept.join('\n\n'), { sectionBody: section.body });
    }
  }
}

/** 02 §4 → shapes.*; the "*Detect:*" clause is stripped (detection is code's job). */
function buildShapes() {
  const md = read(SOURCES.geometry);
  const body = findSection(md, 2, (t) => /^4\.\s/.test(t));
  if (!body) {
    problems.push('02 §4 (shape taxonomy) not found');
    return;
  }
  for (const p of paragraphs(body)) {
    const m = p.match(/^\*\*(S\d+b?)\s*·/);
    if (!m) continue;
    const id = m[1];
    if (!SHAPE_IDS.includes(id)) {
      problems.push(`unknown shape id ${id} in 02 §4`);
      continue;
    }
    // Cut from "*Detect:*" up to the next italic marker (*Hypotheses:*, *Interpretation:*, *Not:* …).
    let text = p;
    const detect = text.indexOf('*Detect:*');
    if (detect === -1) {
      problems.push(`${id}: no *Detect:* clause to strip`);
    } else {
      const tail = text.slice(detect + '*Detect:*'.length);
      const next = tail.search(/\*[A-Z][^*\n]*\*/);
      text = next === -1 ? text.slice(0, detect) : text.slice(0, detect) + tail.slice(next);
    }
    put(`shapes.${id}`, text, { sectionBody: body });
  }
}

/** 04 §a–§d + §f → friction.* / always.state-honesty. §e (worked scenarios) is never emitted. */
function buildFriction() {
  const md = read(SOURCES.friction);
  const byLetter = {};
  for (const section of sections(md, 2)) {
    const m = section.title.match(/^([a-f])\.\s/);
    if (m) byLetter[m[1]] = section.body;
  }
  for (const letter of ['a', 'b', 'c', 'd', 'f']) {
    if (!byLetter[letter]) problems.push(`04 §${letter} not found`);
  }
  if (byLetter.e) notes.push('04 §e (unharmonized worked scenarios) found and excluded by design');

  if (byLetter.a) put('friction.intake-schema', byLetter.a, { sectionBody: byLetter.a });
  if (byLetter.b) put('friction.demand-taxonomy', byLetter.b, { sectionBody: byLetter.b });

  if (byLetter.c) {
    const paras = paragraphs(byLetter.c);
    const cut = paras.findIndex((p) => /^\*\*Escalation modifiers\*\*/.test(p));
    if (cut === -1) {
      problems.push('04 §c: escalation-modifier paragraph not found');
    } else {
      put('friction.classification', paras.slice(0, cut).join('\n\n'), { sectionBody: byLetter.c });
      put('friction.modifiers', paras.slice(cut).join('\n\n'), { sectionBody: byLetter.c });
    }
  }

  if (byLetter.d) put('friction.template', byLetter.d, { sectionBody: byLetter.d });

  if (byLetter.f) {
    // Drop the trailing document-credits line: doc metadata, not report content.
    const kept = paragraphs(byLetter.f).filter((p) => !/^\*Conceptual credits/.test(p));
    put('always.state-honesty', kept.join('\n\n'), { sectionBody: byLetter.f });
  }
}

/** 05 §5.6 → rules.disclaimer, verbatim (blockquote markers removed, text untouched). */
function buildDisclaimer() {
  const md = read(SOURCES.report);
  const body = findSection(md, 2, (t) => /^5\.6\b/.test(t));
  if (!body) {
    problems.push('05 §5.6 (required disclaimer block) not found');
    return;
  }
  const quoted = body
    .split('\n')
    .filter((l) => l.trimStart().startsWith('>'))
    .map((l) => l.trimStart().replace(/^>\s?/, ''))
    .join('\n')
    .trim();
  if (!quoted) {
    problems.push('05 §5.6: no blockquote found');
    return;
  }
  put('rules.disclaimer', quoted, { verbatim: true });
}

// ---------------------------------------------------------------- build

buildFunctions();
buildDynamics();
buildShapes();
buildFriction();
buildDisclaimer();

// ---------------------------------------------------------------- guards

const expected = [
  ...FUNCTION_KEYS.flatMap((fn) => FUNCTION_BLOCKS.map((b) => `functions.${fn}.${b}`)),
  ...Object.values(DYNAMICS_BY_SECTION).map((k) => `dynamics.${k}`),
  ...SHAPE_IDS.map((id) => `shapes.${id}`),
  ...FRICTION_KEYS.map((k) => `friction.${k}`),
  'always.development',
  'always.state-honesty',
  'rules.disclaimer',
];

const rawSources = Object.values(SOURCES).map(read).join('\n');
if (rawSources.includes(FABRICATED)) {
  notes.push(`G2: "${FABRICATED}" present in source docs — guard active`);
} else {
  notes.push(`G2: "${FABRICATED}" absent from source docs — guard is a no-op`);
}

const orderedKeys = expected.filter((k) => k in fragments);
const extras = Object.keys(fragments).filter((k) => !expected.includes(k));
const missing = expected.filter((k) => !(k in fragments));

const payload = {
  meta: {
    generator: 'scripts/build-kb.mjs',
    sources: Object.values(SOURCES).map((f) => `docs/knowledge/${f}`),
    excluded: [
      '01 (f) situational demand cues, (g) confusable-with — not prompt material',
      '02 §4 *Detect:* clauses — detection is computed in src/shared/geometry',
      '03 worked-example paragraphs — geometry comes from the live Signature only',
      '04 §e worked scenarios — unharmonized with 02 (KNOWN-ISSUES blocker)',
    ],
    fragmentCount: orderedKeys.length + extras.length,
  },
  fragments: Object.fromEntries(
    [...orderedKeys, ...extras].map((k) => [k, fragments[k]]),
  ),
};

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');

// ---------------------------------------------------------------- verify from disk

const reloaded = JSON.parse(readFileSync(OUT_FILE, 'utf8'));
const store = reloaded.fragments;

const wordCount = (s) => s.trim().split(/\s+/).length;

const groups = [
  ['functions', (k) => k.startsWith('functions.')],
  ['dynamics', (k) => k.startsWith('dynamics.')],
  ['shapes', (k) => k.startsWith('shapes.')],
  ['friction', (k) => k.startsWith('friction.')],
  ['always', (k) => k.startsWith('always.')],
  ['rules', (k) => k.startsWith('rules.')],
];

const keys = Object.keys(store);
const pad = Math.max(...keys.map((k) => k.length)) + 2;
let total = 0;

console.log(`\nMindstack KB fragment inventory — ${OUT_FILE.replace(ROOT + '/', '')}\n`);
for (const [name, test] of groups) {
  const groupKeys = keys.filter(test);
  let groupWords = 0;
  console.log(`  ${name} (${groupKeys.length})`);
  for (const k of groupKeys) {
    const w = wordCount(store[k]);
    groupWords += w;
    total += w;
    console.log(`    ${k.padEnd(pad)}${String(w).padStart(5)} words`);
  }
  console.log(`    ${'—'.repeat(pad + 10)}`);
  console.log(`    ${`subtotal (${name})`.padEnd(pad)}${String(groupWords).padStart(5)} words\n`);
}
console.log(`  TOTAL: ${keys.length} fragments, ${total} words\n`);

// expected-key verification
const EXPECTED_COUNTS = { functions: 48, dynamics: 10, shapes: 13, friction: 5, always: 2, rules: 1 };
for (const [name, test] of groups) {
  const got = keys.filter(test).length;
  const want = EXPECTED_COUNTS[name];
  const ok = got === want ? 'OK' : 'MISMATCH';
  console.log(`  ${ok.padEnd(9)} ${name}: ${got}/${want}`);
  if (got !== want) problems.push(`${name}: expected ${want} keys, got ${got}`);
}
if (missing.length) problems.push(`missing keys: ${missing.join(', ')}`);
if (extras.length) problems.push(`unexpected keys: ${extras.join(', ')}`);

// G1 — leakage guard
for (const [k, text] of Object.entries(store)) {
  for (const token of FORBIDDEN) {
    if (text.includes(token)) problems.push(`G1 violated: ${k} contains "${token}"`);
  }
  if (text.includes(FABRICATED)) problems.push(`G2 violated: ${k} contains "${FABRICATED}"`);
}

// G3 — disclaimer sanity
const disclaimer = store['rules.disclaimer'] || '';
for (const anchor of DISCLAIMER_ANCHORS) {
  if (!disclaimer.includes(anchor)) problems.push(`G3 violated: disclaimer missing "${anchor}"`);
}

console.log(`  ${problems.length ? 'FAIL' : 'OK'.padEnd(9)} guards: G1 leakage · G2 fabricated quote · G3 disclaimer anchors · G4 reparse`);

if (notes.length) {
  console.log('\n  Build notes:');
  for (const n of notes) console.log(`    - ${n}`);
}

if (problems.length) {
  console.error('\nBUILD FAILED:');
  for (const p of problems) console.error(`  ! ${p}`);
  process.exit(1);
}

console.log('\nWrote ' + OUT_FILE.replace(ROOT + '/', '') + '\n');
