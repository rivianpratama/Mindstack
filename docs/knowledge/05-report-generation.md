# Component 5 — Report Generation and Epistemics

**Epistemic legend:** [S] established science (cited) · [D] derived from typology-community sources — attributed, unvalidated · [H] Mindstack hypothesis — our own extrapolation, plausible but speculative.

This component governs the last mile: how profile geometry, dynamics, and the friction map become sentences a person can trust. A personalized report is delivered under exactly the conditions known to maximize uncritical acceptance: it feels made "for you alone," it comes from an authoritative-seeming source, and it can flatter. Forer (1949) obtained a mean accuracy rating of 4.26/5 for an *identical* sketch handed to every student; Dickson & Kelly (1985) showed acceptance rises further with favorability and personalization; Sharma et al. (2024) documented LLM drift toward flattery under user approval. [S] Honesty here is therefore an engineering constraint, not a tone preference. Every rule below is checkable at generation time from the eight scores and the draft text alone.

## 5.1 Report structure

Six fixed sections, ordered from most to least certain content, so confidence decays visibly as the reader descends. [H — falsifiable as policy: if reader studies showed interleaving certainty levels produced better-calibrated self-assessments, this ordering would be wrong.]

1. **Your stack signature.** The geometry, plainly: the eight scores; engagement tiers with the gaps that define them; ties inside the noise band; cliffs; attitude tilt; axis polarizations; judging/perceiving pressure. Arithmetic and detection only — zero interpretation. **Geometry anchor rule [H]:** every feature interpreted anywhere downstream must be named here first, with its numbers, so the reader can audit every later claim against this section.
2. **How your processing runs.** Interpretation of the tier structure: lead cluster character, closed circuits and their counterweights, pluralistic or monolithic judging, polarization readings. Highest [D]/[H] density in the report; highest constraint load (§5.4).
3. **Where you are right now.** The situational friction map for whatever 5W1H context the person supplied, rendered as if-then signatures — "when the situation demands X, expect..." ([S] framing via Mischel & Shoda 1995 CAPS; [H] the demand→function mapping). If no context was supplied, the section uses two or three common contexts and says so plainly rather than faking personalization.
4. **Under pressure.** Eruption candidates from the shadow floor, each with its characteristic crude expression and an early-warning line. [D] The first symptom of an eruption state is *loss of healthy lead-function quality*, before any shadow behavior appears (Quenk's grip concept, via mbti-notes.tumblr.com) — reports teach the reader to watch for the loss, not the eruption.
5. **Levers.** Counterweights with their activation conditions, plus concrete experiments. Every experiment must test a *named* hypothesis from sections 2–4 and be low-stakes — safe to run even if the hypothesis is false. [H]
6. **What this report cannot know.** Limits, then the disclaimer block (§5.6). Required content: the retest fragility of every marginal feature; all three live hypotheses for any cliff (suppression, avoidance, simple non-development [H] — never pick one); the statement that the report knows nothing about ability, mental health, or worth.

**Information budget [H]:** interpretive length is capped by resolvable structure — roughly 150 words of interpretation per detected feature (tier boundary, cliff, circuit, polarized axis, strong tilt). A profile with two resolvable features gets a short report. Padding thin geometry is how Barnum text gets manufactured; brevity is the honest output for a quiet profile.

## 5.2 Voice rules

- **Second person, present-tense snapshot.** "Currently," "lately," "this stretch of your life." The profile is a photograph of current engagement, not an essence; scores move with age, environment, and practice. [D + S] Banned: "you are and always will be," "your true nature," any future-fixing ("you will never...").
- **Hypothesis-offering, never oracular.** Approved stems: *worth testing*, *watch for*, *one reading is*, *check whether*, *if this doesn't match your experience, discard it*. Banned as claim-carriers: *clearly*, *undoubtedly*, *this means*, *you are*. [H]
- **Person-as-authority.** Where the person's account and the geometry disagree, the geometry is what's in question — the input is an unvalidated hobbyist instrument. The report must say this, not merely imply it. [S — the instrument's own author disclaims its precision; see feasibility research §3.]
- **No essentialism, no types.** No type codes, no "an Ni-dom," no reframing the stack signature as an identity noun.
- **No clinical or diagnostic vocabulary.** Never attribute disorders, name conditions, or prescribe treatment (see §5.8).
- **Specificity floor [H].** Interpretive sentences must be behavioral and conditional (situation → response), not adjectival. "You're analytical" fails — any profile accepts it. "When a problem resists formulation, watch whether you re-frame it rather than execute a known procedure" passes: a Lead-cluster-Se/Si profile would predict the opposite, so the sentence differentiates.

## 5.3 Tier-to-language mapping

Every major claim carries exactly one tier, and the tier must be *audible* in the phrasing.

- **[S] stems:** "Research on personality suggests..." / "Studies of day-to-day behavior show..." Author-year citations permitted (Fleeson 2001; Mischel & Shoda 1995). Reserved for genuinely cited findings: situational variability, retest noise, the Barnum caveats themselves.
- **[D] stems:** "In typology practice this pattern is described as..." / "Typology writers (mbti-notes; Quenk's 'grip') describe..." First use in any report must include the word *unvalidated*.
- **[H] stems:** "One hypothesis to test against your own experience..." / "Our speculative reading — check it against a real week..."

**Tier audibility rule [H]:** strip all tags from a finished report; a reader must still be able to rank every claim's confidence from wording alone. Enforcement: no sentence mixes tiers — split blended sentences; no [D] or [H] sentence may contain *research*, *science*, *evidence*, *proven*, or *validated* in the affirmative; upgrading is prohibited (an [H] claim never borrows an [S] stem, even in summary or transition text, where laundering most often happens). The generator runs a final audit pass: classify each sentence's implied tier from phrasing alone; any mismatch with the intended tier forces a rewrite.

## 5.4 Barnum mitigations as hard generation constraints

These are pass/fail gates on the draft, not stylistic aims.

- **C1 — Falsifiability quota. [S: Forer 1949]** Sections 2–5 must each contain at least one falsifiable prediction with a named **counter-observation**, in the fixed format: "Prediction: ... Counter-observation: if you find that ..., this reading is wrong — discard it." The counter-observation must be something the reader could actually notice within weeks.
- **C2 — Cost quota. [S: Dickson & Kelly 1985 — acceptance tracks favorability; Sharma et al. 2024]** At least one-third of interpretive statements must state a trade-off or cost, and each cost must attach to the *same geometric feature* being credited ("the same 26-point Ti–Fe polarization that buys you X charges you Y"). Free-floating strengths are rejected.
- **C3 — Contrast quota. [H, operationalizing constraint 1 of the design brief]** Each of sections 2–4 must contain at least one "unlike profiles where..." statement referencing a genuinely different geometry — different by at least one tier assignment or an inverted axis polarization, stated with its shape ("unlike profiles where one judging function towers 15+ points over the others..."). Vacuous contrasts ("unlike people who never reflect") are rejected.
- **C4 — Mirror test (differentiation self-check). [S-motivated: Forer 1949; Dickson & Kelly 1985]** For every interpretive sentence, construct the **mirror profile**: lead cluster and shadow floor swapped, attitude tilt sign inverted. Would the mirror profile's holder plausibly accept the sentence as accurate? If yes, delete it or sharpen it until the answer is no. This screens for accepted-by-anyone content — the operational definition of a Barnum statement. Acceptance is not truth; the test filters acceptance, and only the counter-observations (C1) test truth.
- **C5 — Sycophancy guard. [S: Sharma et al. 2024]** No section may end on praise. In interactive follow-ups, the generator must not retract a geometry-anchored claim merely because the user objects; the required move is: "Your self-report disagrees with the geometry — the instrument may well be wrong. Here is the observation that would decide it." Agreement offered to please is a defect, not politeness.
- **C6 — No-norms rule. [S: no norms or reliability data exist for the input instrument — feasibility §3]** Never claim rarity, percentile, or population comparison ("only 3% of profiles..."). There is no dataset that licenses it.

## 5.5 Uncertainty language

- **Noise-band ties.** Mandatory phrasing: "statistically indistinguishable — treat their order as unknown." Tied functions are never ranked, never adjective-ranked ("slightly more Ti-flavored"), and always interpreted as a *set*.
- **Flat profiles.** Detection: no adjacent gap in the sorted profile exceeds the noise band (the whole profile is one lead cluster). Response: a much shorter, franker report — "your profile is too flat for this instrument to resolve structure; most of what any report could tell you here would be true of nearly anyone, so we won't say it." Offer the finer-grained 256-item Sakinorva Domains Test as an optional richer input. Never pad. [H]
- **Marginal detections.** Any feature within 1.2× of its detection threshold (a gap of 5–6 against a noise band of 5; a cliff of 10–12) must be rendered as a **fork statement**: both hypotheses, labeled, plus the observation that decides between them. "Read A if...; Read B if...; watch X this month to tell." One-sided rendering of a marginal feature is a generation error.

## 5.6 Required disclaimer block

Every report ends with this block, verbatim:

> **What this is — and is not.** This report is structured self-reflection, offered for reflection and entertainment. It is not a psychological assessment, not a diagnosis, and not valid input to hiring, admissions, clinical, or any other consequential decision: professional testing standards (AERA/APA/NCME, *Standards for Educational and Psychological Testing*, 2014) require documented validity evidence for every intended use of a score, and no layer of this pipeline has any. Your scores come from an unvalidated hobbyist questionnaire; small differences are noise, and results commonly change on retake. The interpretive frames mix unvalidated typology-community ideas with our own clearly labeled hypotheses. Where anything here conflicts with what you know about yourself, trust yourself. If you are struggling, a report cannot help — a qualified professional can.

## 5.7 Example report skeleton (running example)

*Profile: Ni 39.6 · Ti 34 · Te 31 · Fi 30 · Ne 25.4 · Se 25 · Si 21 · Fe 8. Illustrative excerpts, not exhaustive.*

**Your stack signature.** Ni sits 5.6 above the next score — right at this instrument's resolution limit, so "Ni leads alone" is a marginal call, not a fact. Ti, Te, and Fi (34/31/30) are statistically indistinguishable — treat their order as unknown. Ne and Se are tied (25.4/25); Si sits at 21; Fe sits 13 points below Si — the profile's one unambiguous feature. Overall tilt: inward (89.4 outward vs 124.6 inward). Most polarized axis: Ti–Fe, at 26.

**How your processing runs.** Two readings of the top, worth testing. (A) A single pattern-first lead feeding three near-equal judging tools. (B) No true lead — a four-way working cluster. Watch a genuinely new problem this week: if you reflexively ask "what is this an instance of, where is it heading" before evaluating anything, that favors A; if you go straight to evaluating, B. One hypothesis to test against your own experience: your decision criteria are unusually plural — logical coherence, external workability, and personal congruence each get a real vote. The cost side of the same tie: decisions engaging all three may stall. Unlike profiles where one judging function towers 15+ points over the rest — where decisions come fast and one-flavored — your likely friction is choosing *which kind of right* wins. Counter-observation: if your decisions are consistently quick and you can't recall the last time two of your own standards collided, discard this reading.

**Under pressure.** Fe — tracking and managing a group's emotional temperature — is this profile's isolated floor. In typology practice (Quenk's "grip," via mbti-notes; unvalidated), floor processes are described as surfacing crudely under depletion. Worth testing: under real fatigue, does your interpersonal processing erupt — uncharacteristic approval-hunger, or sudden conviction the room is against you — rather than gently weaken? Early warning to watch for first: your usual pattern-sight going murky. Counter-observation: if your last few depleted stretches left group situations feeling exactly as they do rested, this reading is wrong.

**Levers.** Your tied Ne/Se pair is the built-in exit from an all-inward spiral. Experiment (tests the circuit hypothesis above): next time a line of thought loops twice without new input, force one concrete external act — say the problem aloud to someone, or handle the physical thing itself — and note whether the loop breaks.

**What this report cannot know.** Whether Ni's 5.6-point edge survives a retest. Why Fe is low — suppressed, avoided, or simply unpracticed; all three remain live. Anything about ability, health, or worth. *(Disclaimer block follows.)*

## 5.8 Prohibited outputs

The generator must never emit:

1. Type codes or type nouns (INTJ, "an Fi-dom"), even hedged or "for reference."
2. Any ordering of scores inside a noise band.
3. Clinical or diagnostic vocabulary applied to the person (disorder names, "trauma response," "depressive," "narcissistic"), or treatment prescriptions.
4. Essentialist framing: "you are," "your true self," "you will always/never."
5. Rarity, percentile, or norm claims of any kind (C6).
6. Validation laundering: [S] stems or the words *research/proven/evidence* attached to [D]/[H] content; any intelligence-agency or institutional-endorsement framing (verifiably false — feasibility §5).
7. Ability, intelligence, or talent verdicts; career, partner-compatibility, or hiring judgments.
8. Uncosted flattery, superlatives ("gifted," "rare mind"), or a section ending on praise (C5).
9. Universal-experience filler that survives the mirror test ("you sometimes doubt yourself").
10. "Switch" as a mechanic (no source exists, even in community folklore), or loop/grip presented as validated mechanisms rather than [D] folklore.
11. High-stakes advice contingent on the report being true (e.g., "avoid roles demanding Fe") — levers must be reversible experiments.
12. A report without the §5.6 disclaimer block, verbatim, at the end.
