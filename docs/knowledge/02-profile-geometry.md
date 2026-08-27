<!-- 02 · Profile Geometry — the measurement layer (scores → stack signature) and the sole owner of every geometric term and threshold. Legend: [S] established science · [D] typology community, unvalidated · [D→H] community concept generalized by Mindstack · [H] Mindstack hypothesis. -->

# 02 · Profile Geometry — From Eight Scores to a Stack Signature

**Epistemic legend:** [S] established science (cited) · [D] derived from typology-community sources (mbti-notes.tumblr.com; Naomi Quenk's grip concept — attributed, unvalidated) · [D→H] a [D] concept generalized by Mindstack beyond its home theory · [H] Mindstack hypothesis (our extrapolation; speculative, offered for the reader to test). Detection rules are pure arithmetic and carry no tag; only interpretations are tagged. Canonical term definitions: the [glossary](00-overview.md#glossary).

**Ownership rule.** This component is the sole owner of every geometric term and threshold in the knowledge base. [01](01-functions.md), [03](03-engagement-dynamics.md), [04](04-situational-conditioning.md), and [05](05-report-generation.md) consume the outputs defined here and define no geometry of their own; where their text names a threshold, it restates this file, and this file wins on any discrepancy.

This component defines the measurement layer: how eight raw scores become a **stack signature** — a geometric object with tiers, gaps, cliffs, and indices — before a single interpretive word is written. Every downstream component (engagement dynamics, eruption candidates, friction maps) consumes the outputs defined here. The discipline is strict: arithmetic first, hypotheses second, and no structure asserted that the numbers do not support. The signature is a photograph of current engagement, not an essence; all geometry language in reports is tensed "currently / lately" [D + S: within-person state variability, Fleeson 2001].

## 1. Input handling

**Range and validation.** Input is eight numbers — Ni, Ne, Si, Se, Ti, Te, Fi, Fe — each roughly 0–50, transcribed by the user from the Sakinorva functions test (96 items, ~12 per function, no published reliability or validity; see [docs/research/mindstack-feasibility.md](../research/mindstack-feasibility.md) §3). Validate that all eight are numeric; values outside 0–50 are flagged back to the user for confirmation, never silently clamped. Magnitudes are always stored; a bare ordering is never stored, because rank without distance destroys the information (Fi 34 / Ni 33 and Fi 34 / Ni 12 share a ranking and share nothing else).

**Normalization.** None by default. If a differently scaled instrument is ever accepted (e.g., the 256-item Sakinorva Domains test), rescale linearly to 0–50 and hold the noise band at 10% of scale width [H — stipulated convention].

**Noise band.** B = 5 points, default. Justification: the input is an unvalidated hobbyist instrument whose own author reports that results change on retake; ~12 coarse items per function cannot resolve small differences; even professionally maintained continuous type scales show test–retest reliability of only ~.61–.75 [S: Randall et al. 2017], so a hobbyist test's per-function error is plausibly several points. B is a **stipulated resolution limit, not a measured standard error** [H]; it is configurable, and every threshold below derives from it (gap > B, cliff > 2B, marginal window ≤ 1.2× threshold), so changing B re-derives the whole geometry consistently.

**Tie rule (hard constraint).** Two scores within B of each other are a tie. Order inside a tie must never be verbalized as rank. "Ti edges out Te, 34 to 31" is a forbidden sentence; "Ti and Te are effectively tied" is the required one.

## 2. Tier derivation algorithm

```
INPUT: s[f] for f ∈ {Ni,Ne,Si,Se,Ti,Te,Fi,Fe};  B = 5

0  REGIME CHECK (weak signal first; see §4 S5/S6 and §6):
     diff = max − min of the eight scores
     diff ≤ B                          → FLAT (S6): honest null. No tiers are
                                          asserted, even if a boundary technically
                                          exists; the single largest gap may be
                                          named only as a tentative watch item.
     B < diff ≤ 2B                     → NEAR-FLAT low-confidence zone [H]: proceed
                                          with the steps below (the regime stays
                                          STAIRCASE or NORMAL), but attach a warning —
                                          every reading rests on differences the noise
                                          band could erase, the report must say so
                                          plainly near its start, and no length
                                          minimum applies (05 §5.1).
     no adjacent gap > B AND diff > B  → STAIRCASE (S5): one segment, no tier
                                          boundaries; only upper-vs-lower-edge
                                          contrasts are interpretable.
     otherwise                         → continue.
1  SORT descending → S[0..7]  (stable; exact ties keep input order, marked tied)
2  GAPS: g[i] = S[i] − S[i+1]  for i = 0..6
3  BOUNDARIES: cut after position i wherever g[i] > B
     boundary strength = g[i] − B  (descriptive)
     flag MARGINAL if g[i] ≤ 1.2B                  (the marginal window, §2.2)
     flag CLIFF wherever g[i] > 2B  (marginal cliff if g[i] ≤ 2.4B)
4  SEGMENTS: split the sorted list at the cuts → T1..Tk  (k = 2..8 here)
5  TIERS: Lead cluster = T1;  Shadow floor = Tk
     Support band = T2 (if k ≥ 3)
     Reserve band = T3..T(k−1), merged (if k ≥ 4)
6  SMEAR CHECK: flag any segment whose internal span (max − min) > B
     inside a smeared segment:
       X genuinely above Y  ⇔  s[X] − s[Y] > B     (pairwise rule;
                                                     hedge if the difference ≤ 1.2B)
       upper edge = members within B of segment max
       lower edge = members within B of segment min  (windows may overlap)
     a smeared T1: the operative Lead reading is its upper edge
7  ACTIVE SET: Lead cluster, plus the upper edge of T2 when the lead
     boundary is MARGINAL  (used by composition checks: §3 J/P, §4 S3b)
8  OUTPUT: regime, tiers, cliffs, boundary strengths, smear flags,
     edge windows, active set
```

**Why the smear machinery exists.** Chained near-ties defeat clean cuts: scores 34, 31, 30, 25.4 have no adjacent gap above B, yet 34 vs 25.4 is a real difference. The segment rule is canonical for tier lines; the pairwise rule and edge windows describe real structure *inside* a smeared segment without ever asserting a rank the noise band cannot support. When T1 itself is smeared, "Lead cluster" means its upper edge, and the report must hedge accordingly.

### 2.1 Contract with the friction map (exported to 04)

Supply grades form a ladder: **flow > near-flow > scaffolded stretch > friction.** Base grades by tier: Lead cluster → flow; Support band → near-flow; Reserve band → scaffolded stretch; Shadow floor → friction. Within a **smeared** segment: an upper-edge member takes the segment's base grade; a lower-edge member takes one grade lower, floored at scaffolded stretch (friction is reserved for shadow-floor membership); a member in both windows or in neither takes a hedged fork between the two grades. These supply grades are the **only** licensed downstream use of edge windows — the windows remain descriptive, never tiers, never a rank. [H]

### 2.2 The marginal window (canonical, corpus-wide)

One definition of "marginal," used by every component: **a detection whose measured quantity exceeds its threshold by no more than 20% of that threshold is marginal** — rendered as a hedged watch item (a fork statement per 05 §5.5), never a firm pattern. Concretely at B = 5: gaps 5 < g ≤ 6; cliffs 10 < g ≤ 12; circuit strength 5 < s ≤ 6; pairwise smear differences 5 < d ≤ 6. Index cutoffs (§3) take the mirror treatment: a value within 20% past its cutoff carries a "borderline" qualifier. A detection past its marginal window is **firm** — even when barely; the report may say "firm, just past the resolution hedge." [H — stipulated convention. This supersedes any per-file margin rule; 03 and 05 point here.]

## 3. Derived indices

All sums below use Σall = sum of the eight scores; E = {Ne, Se, Te, Fe}, I = {Ni, Si, Ti, Fi}, J = {Ti, Te, Fi, Fe}, P = {Ni, Ne, Si, Se}.

- **Attitude tilt** = (ΣE − ΣI) / Σall, range −1…+1. Thresholds: |tilt| ≤ .05 neutral, ≤ .15 mild, > .15 strong; values within 20% past a cutoff carry a "borderline" qualifier per §2.2 [H cutoffs]. Interpretation: the profile's outward/inward processing metabolism [D — attitude as energy direction, per mbti-notes], explicitly **not** sociability or shyness [D — the source is emphatic on this].
- **Axis polarization**, per opposing pair (Ni–Se, Ne–Si, Ti–Fe, Te–Fi): pol = |a − b|. The five-way scale, consumed verbatim by 03 §7: **balanced** if pol ≤ B, sub-classified by pair mean vs. profile mean into **balanced-high** and **balanced-low**; **leaning** if B < pol ≤ 2B; **polarized** if 2B < pol ≤ 4B; **extreme** if pol > 4B. Interpretations live in the taxonomy (S9–S11).
- **Judging/perceiving pressure.** The index (ΣJ − ΣP) / Σall (tilt's thresholds [H]) is context only. The diagnostic is the **composition check on the active set** (§2 step 7): all-judging active set → judging pressure; all-perceiving → perceiving pressure; mixed → no pressure dynamic fires, and at most one hedged composition note (e.g., "judging-heavy, 3 J : 1 P") may be rendered [H]. All-judging: conclusions may outrun data-gathering; all-perceiving: intake without closure [D — both failure modes described by the source's J/P closure mechanics].
- **Differentiation index** = S[0] − S[7] (the spread). Low if ≤ 2B (the NEAR-FLAT low-confidence zone; the FLAT honest-null fires only at ≤ B, §2 step 0), moderate if ≤ 4B, high above that [H cutoffs]. **Hard honesty rule:** low differentiation is a weak signal, and the report must say so plainly rather than invent content. A flat profile rendered as a rich portrait is a Barnum failure by construction [S: Forer 1949 — identical sketches rate as highly accurate].
- **Elevation** = mean of the eight scores. Never interpreted as overall ability, health, or development; elevation plausibly reflects self-report response style as much as psychology [H]. Used only to contextualize the all-high/all-low edge cases.

## 4. Shape taxonomy

Thirteen recurring signature shapes. Detection is arithmetic; interpretations are competing hypotheses for the reader to test, never verdicts. Multiple shapes can co-fire on one profile (rendering salience and caps: 05 §5.1; convergent detections merge per 03 §0).

**S1 · Lead spike.** *Detect:* |Lead| = 1. Grades by g[0]: **marginal spike** if B < g[0] ≤ 1.2B; **clear spike** if 1.2B < g[0] ≤ 2B; **hard spike** if g[0] > 2B. *Hypotheses:* one mode is the reliable first reach in unstructured situations [D — the source's dominant-identification heuristic]; cost side: hammer-and-nail over-application to mismatched situations [D]. *Not:* skill or maturity in that domain — investment ≠ quality [D — position is influence, not maturity]. *Falsifiable marker:* in novel low-stakes situations the first move should predictably be that mode (an Ni spike: pause and model implications before acting); a person whose first move varies freely falsifies the spike.

**S2 · Twin peak.** *Detect:* |Lead| = 2. Variants: axis partners (also fires S10), same attitude (also fires S12 when the circuit-strength condition holds), mixed. *Hypotheses:* a working team of two, analogous to the community's dominant-auxiliary pairing [D]; or alternation with occasional deadlock [H]. *Not:* a canonical dom-aux — order within the pair is uninterpretable by the tie rule. *Marker:* the person can name distinct contexts where each mode leads; if one demonstrably leads everywhere, the second peak is overstated.

**S3 · Pluralistic lead cluster.** *Detect:* |Lead| = 3. *Hypotheses:* versatile context-switching vs. decision friction — competing inner criteria and slow closure, especially if all three are judging functions [H]. *Not:* "well-rounded maturity." *Marker:* the friction hypothesis predicts a characteristic multi-criteria stall on big decisions; the flexibility hypothesis predicts smooth switching without distress. Fast single-criterion deciding falsifies both, and the cluster should then be read as compression noise.

**S3b · Pluralistic sub-cluster.** *Detect:* three or more functions mutually within one noise band forming the upper edge of T2 while the lead boundary is MARGINAL, or forming the upper edge of a smeared T1. This is the licensed replacement for any "adjacent" reading: it fires as its own rule or the content is not rendered (03 §0, rule of firing). *Hypotheses:* as S3 — deliberative flexibility vs. decision friction — plus one structural hedge: membership rests on a marginal boundary and edge windows, so the whole reading is watch-item grade and must be rendered as a fork [H]. *Not:* a lead cluster — never call it one. *Marker:* as S3.

**S4 · Compressed top.** *Detect:* |Lead| ≥ 4. *Hypotheses:* prioritization filters not strongly set — breadth of engagement bought at the cost of a default mode [H, inverting the source's efficiency-filter economics [D]]; or elevated, undifferentiated self-report. *Not:* mastery of four-plus functions. *Marker:* difficulty naming a single characteristic first move; an obvious signature first reach falsifies the face reading.

**S5 · Staircase.** *Detect:* regime STAIRCASE (§2 step 0: no adjacent gap > B, differentiation > B). *Hypotheses:* gradual differentiation without discrete tiers; or measurement smear. *Not:* an eight-rung ladder — no adjacent rank is real. *Marker:* only extreme contrasts (upper vs. lower edge) should ring true; if even top-vs-bottom contrasts don't, the profile carries no usable signal and the report says so. Report behavior: extremes-only (03 §9, 05 §5.5).

**S6 · Flat.** *Detect:* regime FLAT (differentiation ≤ B) — takes precedence over **all** other shapes; when it holds, no other shape is rendered even if a boundary technically exists. *Interpretation:* weak signal — honest null [hard rule]. Offered hypotheses only: genuinely even engagement, undifferentiated self-knowledge, or neutral/careless responding [D — the source catalogs self-report failure modes]. *Not:* "you are balanced and adaptable" — a Barnum item that flatters everyone and differentiates no one. *Marker:* none derivable — which is exactly the sentence the report must contain. Report schema: 05 §5.1 and §5.5.

**S7 · Cliff floor.** *Detect:* |Shadow| = 1 and the final gap > 2B (marginal cliff if ≤ 2.4B, per §2.2). *Hypotheses — hold all three* [H]: suppression (active repression, predicting eruptive return [D→H — Quenk's grip, via mbti-notes, re-keyed to gap-derived floors]); avoidance (the domain is feared or devalued [D — the source's contrarian-influence principle: a repressed function still shapes the worldview through what gets disowned, disavowed, or defined as unimportant]); simple non-development (never practiced, no drama). *Not:* incapacity, and never a diagnosis. *Marker:* suppression predicts crude, out-of-character eruptions in that domain under fatigue or stress; non-development predicts plain absence without eruption — which one the reader recognizes discriminates the hypotheses. Smooth handling of the domain under stress falsifies all three.

**S8 · Bimodal split (hollow middle).** *Detect:* k = 2 and the single boundary is a cliff. *Hypotheses:* all-or-nothing engagement — trusted tools vs. shunned tools with no stretch zone [H]; if the high group shares one attitude, a defended structure (see S12). *Not:* "two personalities." *Marker:* friction-map predictions become step-shaped — demands on the high group flow, demands on the low group grind, little in between. Graded performance across domains falsifies it. Note: the entire lower group is the shadow floor; friction applies to all of it, but rendered eruption candidates are capped per §6.

**S9 · Polarized axis.** *Detect:* pol > 2B on an opposing pair (extreme if > 4B). *Hypotheses:* one-sided channel processing — the high pole does that axis's work while the starved pole is repressed rather than absent: it still shapes the worldview through what gets disowned, disavowed, or defined as unimportant [D — the source's contrarian-influence principle]; Mindstack's own extension: the starved pole's domain often takes on a devalued or faintly threatening cast [D→H — our paraphrase, not source wording]. *Marker:* the axis-failure signature for the low pole (e.g., Ti≫Fe: recurring relationship ceiling, missed social cues); fluent handling of that domain under pressure falsifies the reading.

**S10 · Balanced-high axis.** *Detect:* pol ≤ B and pair mean ≥ profile mean. *Competing hypotheses* [D→H]: flexible both-ways processing vs. unresolved tug-of-war — the axis's dilemma is live and costly. *Not:* automatic integration; the source treats reconciling an axis as a decades-long achievement [D]. *Marker — behavioral, not felt:* flexibility predicts stable context-keyed assignment (each recurring context reliably gets one pole); tension predicts observable re-decision — the same decision re-made in the other pole's currency within days, or deadlock on trade-off calls. A generic recognized feeling of being "torn between X and Y" decides nothing — nearly everyone endorses it [S: Forer 1949]; only the behavioral markers adjudicate. If neither behavioral marker fits, treat the index as noise.

**S11 · Balanced-low axis.** *Detect:* pol ≤ B and pair mean < profile mean. *Hypothesis:* the whole channel is quiet — its dilemma (old/new, meaning/moment, autonomy/belonging, integrity/efficacy) is not where this person currently lives [H]. *Not:* a deficit verdict. *Marker:* that axis's dilemma should rarely surface as a lived theme; a reader for whom that exact tug-of-war is central falsifies the quiet-channel reading.

**S12 · Single-attitude lead (circuit candidate).** *Detect:* all Lead members (upper edge, if T1 is smeared) share one attitude AND **circuit strength > B**, where the **counterweight** = the highest-scoring opposite-attitude function and circuit strength = Lead minimum − counterweight score. Grades: **moderate** if B < strength ≤ 2B; **strong (sealed)** if strength > 2B; strength ≤ B → no circuit fires (the attitude-uniform lead may be noted in one clause at most). The strength condition is what keeps |Lead| = 1 profiles from firing trivially. The marginal window applies (strength ≤ 1.2B → marginal read). [H operationalization of the closed-circuit definition] Interpretation is owned by the engagement-dynamics component ([03](03-engagement-dynamics.md) §1–2); geometry only flags it. *Not:* introversion/extraversion as sociability [D]. *Marker:* an internal circuit predicts reality-testing starvation on long solo runs (plans never checked against the world); an external circuit predicts momentum without reflection. A reader who routinely activates the counterweight falsifies circuit risk.

## 5. Worked example — profile A (canonical derivation; every other component quotes THIS output)

Profile: Ni 39.6, Ti 34, Te 31, Fi 30, Ne 25.4, Se 25, Si 21, Fe 8.

1. **Regime check:** differentiation = 31.6 > 2B → proceed.
2. **Sort:** Ni · Ti · Te · Fi · Ne · Se · Si · Fe.
3. **Gaps:** 5.6, 3.0, 1.0, 4.6, 0.4, 4.0, 13.0.
4. **Boundaries:** after Ni (5.6 > 5 — **MARGINAL**, inside the 5–6 window); after Si (13.0 > 10 — **CLIFF**, firm: past the 12-point marginal window, though only just — reports may say "firm, barely"). No other gap exceeds B (note Fi→Ne = 4.6 is a tie).
5. **Segments (k = 3):** Lead = {Ni}; Support = {Ti, Te, Fi, Ne, Se, Si}; Shadow = {Fe}; Reserve empty.
6. **Smear check:** Support spans 34 − 21 = 13 > B → smeared. Upper edge (within 5 of 34): Ti, Te, Fi. Lower edge (within 5 of 21): Ne, Se, Si. Pairwise licensed facts: each of Ti/Te/Fi is genuinely above Si (13, 10, 9); Ti is genuinely above Ne and Se (8.6, 9.0); Te's edge over Ne and Se is only marginal (5.6, 6.0 — inside the marginal window); Fi–Ne (4.6) and Fi–Se (5.0) are ties — chained structure, hence no clean internal cut. Reading Si as strictly below Ne/Se is **not** licensed (gaps 4.4 and 4.0).
7. **Active set:** the lead boundary is marginal → active set = {Ni} ∪ upper edge of T2 = {Ni, Ti, Te, Fi}.
8. **Indices:** Σall = 214. Tilt = (89.4 − 124.6)/214 = **−0.16** → strong inward, **borderline** (just past the .15 cutoff). J/P index = (103 − 111)/214 = −0.04, neutral; composition check: active set is mixed (1 P : 3 J) → **no pressure dynamic fires**; the licensed hedged note: judging-heavy active set fed by a single perceiving channel. Polarization: Ti–Fe = 26 (**extreme**), Ni–Se = 14.6 (**polarized**), Ne–Si = 4.4 (**balanced-low**; pair mean 23.2 < 26.75), Te–Fi = 1.0 (**balanced-high**; pair mean 30.5 > 26.75). Differentiation = 31.6 (**high**). Elevation = 26.75 (mid).
9. **Shapes fired:** S1 marginal spike (Ni — hedge it); S3b pluralistic sub-cluster {Ti, Te, Fi} (watch-item grade — an unordered judging trio one marginal boundary from lead material; hypothesis fork: deliberative flexibility vs. decision friction [H]); S7 cliff floor (Fe, 13 points below Si — firm; prime eruption candidate per §6, since its axis partner Ti sits in the upper edge; a predictable friction site in group-atmosphere demands); S9 ×2 (Ti–Fe extreme; Ni–Se polarized); S10 (Te–Fi: flexible pragmatic-vs-personal judging, or a live tug-of-war — behavioral markers decide, per S10); S11 (Ne–Si: the old-vs-new channel currently quiet); S12 internal circuit: counterweight Te = 31, circuit strength 39.6 − 31 = 8.6 → **moderate, firm** (past the 6-point marginal window) — flagged for [03 §1](03-engagement-dynamics.md), not interpreted here.
10. **Supply grades (per §2.1, for 04):** Ni → flow; Ti/Te/Fi → near-flow (upper edge); Ne/Se/Si → scaffolded stretch (lower edge); Fe → friction (firm eruption candidate).

## 6. Edge cases and the canonical eruption-candidacy rule

**Eruption candidacy (canonical; 01, 03, 04, and 05 import this rule and define no other):**

- **Firm candidate:** a shadow-floor function whose boundary above is a cliff (> 2B; hedged if inside the 2B–2.4B marginal window). [D→H — Quenk's grip, generalized]
- **Watch item only:** a shadow-floor function above a gap-but-not-cliff boundary — rendered as at most one hedged line, never a firm "Under pressure" feature.
- **Priority when several qualify:** (a) any candidate whose axis partner sits in the Lead cluster or upper edge; then (b) depth below the boundary.
- **Cap:** at most **two** candidates rendered per report — an "Under pressure" section listing six crude-eruption catalogs is horoscope by breadth; remaining floor members get one summary line.

Other edge cases:

- **All-high** (elevation ≥ 37.5): interpret shape only; elevation is confounded with response style [H]. If differentiation is also ≤ B, FLAT governs.
- **All-low** (elevation ≤ 12.5): same shape-only rule; hypotheses include disengaged or self-effacing responding and low self-clarity [H]. Never read low elevation as deficiency or distress — no diagnosis.
- **FLAT / STAIRCASE:** see §2 step 0 and S5/S6. FLAT → the honest-null report (05 §5.1 flat schema): state that the instrument returned little structure, suggest a retest or the finer-grained 256-item Domains test, and generate **no** trait content. STAIRCASE → extremes-only reporting.
- **Multiple cliffs (≥ 2):** a stratified profile. Each cliff is a separate interpretable feature; treat each isolated lower tier on its own terms and never rank functions inside any tier.
- **Shared-attitude shadow floor:** strengthens the circuit hypothesis for the engagement-dynamics component ([03](03-engagement-dynamics.md)) [H].

**Failure honesty, restated once:** where the geometry is weak — marginal boundaries, smears, flat spans — the report's job is to say the measurement is weak. Precision theater over noisy input is the one failure mode this component exists to prevent.

## 7. Contrast profile — profile B (second canonical example)

Profile B exists so that no generator anchors on a single introverted exemplar; [03 §2/§8](03-engagement-dynamics.md), [04 §e2](04-situational-conditioning.md), and [05 §5.7](05-report-generation.md) carry its downstream readings.

Profile: Se 41, Ne 38, Te 31, Fe 27, Ni 21, Si 19, Ti 16, Fi 8.

1. **Regime check:** differentiation = 33 > 2B → proceed. **Sort:** Se · Ne · Te · Fe · Ni · Si · Ti · Fi. **Gaps:** 3, 7, 4, 6, 2, 3, 8.
2. **Boundaries:** after Ne (7 — firm); after Fe (6 — **marginal**); after Ti (8 — firm; a gap, **not** a cliff).
3. **Segments (k = 4):** Lead = {Se, Ne}; Support = {Te, Fe}; Reserve = {Ni, Si, Ti}; Shadow = {Fi}. No smears (segment spans 3, 4, 5, 0 — none exceeds B).
4. **Active set:** lead boundary firm → active set = Lead = {Se, Ne}.
5. **Indices:** Σall = 201. Tilt = (137 − 64)/201 = **+0.36** → strong outward. J/P index = (82 − 119)/201 = −0.18; composition check: all-perceiving active set → **perceiving pressure fires**. Polarization: Te–Fi = 23 (**extreme, borderline** — just past the 20 cutoff); Ni–Se = 20 and Ne–Si = 19 (**polarized**); Ti–Fe = 11 (**polarized, borderline**). Differentiation = 33 (high). Elevation = 25.1 (mid).
6. **Shapes fired:** S2 twin peak (same-attitude variant); S12 external circuit: counterweight Ni = 21, circuit strength 38 − 21 = 17 > 2B → **strong (sealed)**; perceiving pressure (composition); Shadow {Fi} sits below a gap-not-cliff (8 < 10) → **not** a firm eruption candidate — hedged watch item only (§6); S9 on Te–Fi (extreme, borderline).
7. **Supply grades (per §2.1):** Se/Ne → flow; Te/Fe → near-flow (hedge Fe slightly — the boundary below it is marginal); Ni/Si/Ti → scaffolded stretch; Fi → friction (watch-item eruption grade only).
