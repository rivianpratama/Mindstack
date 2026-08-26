#!/usr/bin/env node
/**
 * build-foundations.mjs — foundations preamble compiler.
 *
 * Compiles the curated cognitive-function theory into src/server/prompt/foundations.json:
 * the "Part A" background block that is prepended to the static generation contract
 * (src/server/prompt/system-prompt.ts) to form the report generator's full system message.
 * Mirrors scripts/build-kb.mjs → src/server/kb/fragments.json: a shipped artifact, so the
 * server never depends on docs/ at runtime, and the bytes are stable for prompt caching.
 *
 * Zero dependencies (node:fs + node:path only). Run: `node scripts/build-foundations.mjs`
 *
 * Sources (verbatim, in reading order), worked examples stripped:
 *   docs/knowledge/00-overview.md        epistemic tiers, glossary, how components fit
 *   docs/knowledge/01-functions.md       per-function engagement states
 *   docs/knowledge/02-profile-geometry.md  what the signature's fields MEAN (tiers/gaps/cliffs)
 *   docs/knowledge/03-engagement-dynamics.md  loop/grip/floor mechanics
 *   docs/knowledge/04-situational-conditioning.md  friction map, if-then templates
 *   docs/knowledge/06-foundations-digest.md   distilled nuance from the raw docs/sources guides
 *
 * Deliberately EXCLUDES:
 *   05-report-generation.md — already condensed into system-prompt.ts (Part B); re-injecting it
 *                             would duplicate/conflict the generation rules and add drift.
 *   KNOWN-ISSUES.md         — a QA/harmonization log, not prompt material.
 *
 * Worked-example strip (why): this repo deliberately removed worked examples from the system
 * prompt because "the one worked example threaded through the knowledge base already drives
 * template convergence" (system-prompt.ts header). Injecting 00-04 verbatim would re-introduce
 * the canonical Profile A / Profile B exemplars, so they are stripped here. Guard G aborts the
 * build if any labeled exemplar or dedicated worked-example section survives.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// ---------------------------------------------------------------- paths

const ROOT = resolve(dirname(process.argv[1]), '..');
const KB_DIR = join(ROOT, 'docs', 'knowledge');
const OUT_FILE = join(ROOT, 'src', 'server', 'prompt', 'foundations.json');

const KNOWLEDGE_FILES = [
  '00-overview.md',
  '01-functions.md',
  '02-profile-geometry.md',
  '03-engagement-dynamics.md',
  '04-situational-conditioning.md',
];
const DIGEST_FILE = '06-foundations-digest.md';

// ---------------------------------------------------------------- framing (Part A wrapper)

const PART_A_HEADER = `# PART A — FOUNDATIONS (cognitive-function theory; background reference)

Read this first, before any analysis. It is the theory you reason WITH — the full knowledge base the per-request fragments are drawn from, given here whole so you hold the complete picture before you interpret anyone.

This is BACKGROUND, not a script. Three standing rules bind it:

- It never dictates WHAT goes in a report. The user message's render plan (the whitelist of fired features) and its selected fragments still decide what a specific person's report may claim. A mechanism described here that did not fire for this profile does not belong in that person's report.
- Everything community-derived is unvalidated. Honor the epistemic tiers throughout: **[S]** cited science · **[D]** typology-community idea, attributed + unvalidated · **[D→H]** a community idea Mindstack generalizes beyond its home theory · **[H]** Mindstack's own hypothesis. Never let a [D]/[D→H]/[H] idea borrow the language of [S].
- Every number, two-letter code, and internal label below is PRIVATE evidence and vocabulary. Reason with it; never print it. Translate to plain everyday words per the contract in Part B.`;

const PART_B_DIVIDER = `---

# PART B — OPERATING CONTRACT

What follows governs how to turn one person's computed signature into their report. It outranks Part A wherever they meet: if the theory above suggests something the contract forbids, the contract wins.`;

// ---------------------------------------------------------------- worked-example strip

/** Drop whole `##`/`###` sections whose heading is a dedicated worked example. */
function dropExampleSections(md) {
  const out = [];
  let skipping = false;
  for (const line of md.split('\n')) {
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      if (level <= 2 && /worked example|worked scenario|running example|contrast profile/i.test(heading[2])) {
        skipping = true;
        continue;
      }
      if (skipping && level <= 2) skipping = false; // a same/higher-level heading ends the skip
    }
    if (!skipping) out.push(line);
  }
  return out.join('\n');
}

/** Drop blank-line-delimited paragraphs that are predominantly canonical exemplars. */
function dropExampleParagraphs(md) {
  return md
    .split(/\n\s*\n/)
    .filter((para) => {
      const t = para.trim();
      if (/^\*\*Example \(profile [AB]\)/i.test(t)) return false; // 03 inline examples
      if (/^\*\*Worked example\b/i.test(t)) return false; // 01 §23 worked-example paragraph
      if (/^Running examples?:/i.test(t)) return false; // 03 running-examples header
      if (/^Profile:\s*\*{0,2}(Ni|Se|Ne|Ti|Te|Fi|Fe|Si)\b/i.test(t)) return false; // bare/bold vector line
      if (/threaded through all components as canonical worked examples/i.test(t)) return false; // 00 intro
      if (/^-\s+\*\*Profile [AB]\*\*/im.test(t)) return false; // 00 exemplar bullets
      return true;
    })
    .join('\n\n');
}

/** Strip inline parentheticals that reference an exemplar, keeping the surrounding knowledge. */
function stripInlineExampleParens(md) {
  return md.replace(/\s*\([^)]*\bprofile [AB]\b[^)]*\)/gi, '');
}

function stripWorkedExamples(md) {
  return stripInlineExampleParens(dropExampleParagraphs(dropExampleSections(md))).trim();
}

// ---------------------------------------------------------------- guard G

function assertClean(text) {
  const violations = [];
  if (/\bprofile [AB]\b/i.test(text)) violations.push('a "Profile A/B" exemplar label');
  if (/^#{1,3}\s.*(worked example|worked scenario|running example|contrast profile)/im.test(text)) {
    violations.push('a worked-example section heading');
  }
  // A full score vector — 4+ consecutive `<code> <number>` pairs — is a canonical exemplar
  // regardless of whether it is labeled "Profile A/B". This is the real invariant to enforce.
  if (/(?:\b(?:Ni|Ne|Si|Se|Ti|Te|Fi|Fe)\s+\d{1,2}(?:\.\d)?\b[^A-Za-z0-9]{0,4}){4,}/.test(text)) {
    violations.push('a full score vector (4+ consecutive function-score pairs)');
  }
  if (violations.length > 0) {
    throw new Error(
      `build-foundations: worked-example strip failed — output still contains ${violations.join(
        ' and ',
      )}. Refine the strip in scripts/build-foundations.mjs.`,
    );
  }
}

// ---------------------------------------------------------------- build

const sources = [];
const parts = [PART_A_HEADER];

for (const file of KNOWLEDGE_FILES) {
  const raw = readFileSync(join(KB_DIR, file), 'utf8');
  parts.push(`\n\n<!-- source: ${file} (worked examples stripped) -->\n\n${stripWorkedExamples(raw)}`);
  sources.push(file);
}

const digestPath = join(KB_DIR, DIGEST_FILE);
let digestPresent = false;
if (existsSync(digestPath)) {
  const digest = readFileSync(digestPath, 'utf8').trim();
  if (digest.length > 0) {
    parts.push(`\n\n<!-- source: ${DIGEST_FILE} -->\n\n${stripWorkedExamples(digest)}`);
    sources.push(DIGEST_FILE);
    digestPresent = true;
  }
}
if (!digestPresent) {
  console.warn(
    `⚠ build-foundations: ${DIGEST_FILE} is missing or empty — foundations.json is being built WITHOUT the sources digest. Re-run once the digest exists.`,
  );
}

parts.push(`\n\n${PART_B_DIVIDER}`);

const text = parts.join('\n');
assertClean(text);

const approxTokens = Math.round(text.length / 4);
const artifact = {
  meta: {
    generator: 'scripts/build-foundations.mjs',
    sources,
    digestPresent,
    excluded: ['05-report-generation.md (already in system-prompt.ts)', 'KNOWN-ISSUES.md (QA log)'],
    chars: text.length,
    approxTokens,
  },
  text,
};

writeFileSync(OUT_FILE, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

// re-parse guard (mirror build-kb G4)
const reparsed = JSON.parse(readFileSync(OUT_FILE, 'utf8'));
if (typeof reparsed.text !== 'string' || reparsed.text.length === 0) {
  throw new Error('build-foundations: emitted foundations.json has no `text`.');
}

console.log(
  `✓ foundations.json — ${sources.length} sources, ${text.length} chars (~${approxTokens} tokens), digest ${
    digestPresent ? 'included' : 'MISSING'
  }.`,
);
