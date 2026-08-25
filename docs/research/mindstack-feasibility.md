# Mindstack Feasibility Research

**Date:** 2026-08-25
**Question:** Is Mindstack feasible — a web app where users input Sakinorva cognitive-function scores and an LLM (DeepSeek) generates behavioral/thought-process descriptions from the full 8-function ordering (all 8! = 40,320 permutations treated as meaningful, via loop/grip/switch theory, conditioned on situational 5W1H factors) instead of assigning one of 16 MBTI types? And what do leading institutions actually use?

All load-bearing claims below were adversarially verified against primary sources; anything that could not be verified is flagged as such.

---

## 1. Executive summary

**Verdict: feasible as a product, not as stated theory. Build it — but reframe it.**

The engineering is trivially feasible: the input is eight numbers, the output is LLM-generated text, and DeepSeek's current API (see §7 — the model the developer should target is `deepseek-v4-flash`, not "deepseek flash" or the deprecated `deepseek-chat`) costs a fraction of a cent per report. Nothing about the software is hard.

The theory is another matter, and the honest assessment is blunt:

1. **The developer's own cited source contradicts the core premise.** mbti-notes.tumblr.com uses a strict four-function Grant-style stack, explicitly declines full 8-function ordering models as "excessively complicated... and somewhat redundant," and defines loops and grips *relative to the fixed positions of one of the 16 canonical stacks*. It also explicitly says test-derived function orderings are unreliable, and warns that applying a wrong stack to a person "may be harmful." No concept called "switch" appears on the site at all.
2. **Only 16 of the 40,320 orderings are canonical in any theory the app invokes** (32 if socionics Model A is counted as a second, non-overlapping set). Treating all 40,320 as meaningful types is supported by *no* surveyed system — not Grant, not Beebe, not socionics, not Objective Personality.
3. **The underlying typology is empirically unsupported.** Peer-reviewed work — including in the type community's own journal — rejects type dynamics (function-order predictions held in roughly 1 of 540 tests), and there is literally zero peer-reviewed literature on loops or grips.
4. **No intelligence agency verifiably uses this.** CIA, FBI, and clearance adjudication use clinical evaluation, structured interviews, and situational testing. KGB/Mossad-typology stories are unverifiable myth; socionics is officially listed as pseudoscience by the Russian Academy of Sciences commission.
5. **However — and this matters — two of the developer's instincts have real academic support**, just under a different substrate: (a) *don't collapse people into 16 boxes* — psychometrics agrees; continuous scores are more reliable and informative than typed categories; (b) *behavior depends on situation* — this is mainstream science (Fleeson's density distributions, Mischel & Shoda's if-then signatures), operating on continuous trait states, not function orderings.

**The viable reframe:** treat the eight Sakinorva scores as a **continuous profile with magnitudes** (not a rank-order "type"), generate situationally-conditioned reflective descriptions from that profile, drop loop/grip/switch as mechanics, and position the output as structured self-reflection/entertainment — never as validated assessment. That version is honest, novel, more robust to measurement noise, and closer to the actual science than either the 16-type model or the 40,320-permutation model.

---

## 2. What the cited theory actually says (mbti-notes: loop, grip, "switch")

All four primary pages of mbti-notes.tumblr.com ([/basics](https://mbti-notes.tumblr.com/basics/mobile), [/theory](https://mbti-notes.tumblr.com/theory/mobile), [/development](https://mbti-notes.tumblr.com/development/mobile), [/spotting](https://mbti-notes.tumblr.com/spotting/mobile)) were fetched and key passages verified verbatim against raw HTML. The findings are unambiguous, and they cut against Mindstack's premise at every load-bearing point.

**The model is a fixed 4-function stack, not an 8-function ordering.** The source uses the conventional Grant-style primary stack — dominant / auxiliary / tertiary / inferior with alternating introvert/extravert attitudes ("eiei/ieie") — and hard pairing rules (a perceiving dominant takes a judging auxiliary of opposite attitude, and vice versa), which admit only the 16 canonical stacks. The author is aware of full 8-function models (Beebe is named) and explicitly declines them: *"full stack models seem excessively complicated, difficult to interpret consistently... and somewhat redundant"* ([/theory, Part II](https://mbti-notes.tumblr.com/theory/mobile)). Functions outside the top four hold no ordered positions at all ("not even in the stack"), so positions 5–8 of a measured ordering have no meaning in this framework.

**Grip and loop are states within a fixed stack, not alternative orderings.**

- **Grip** (credited to Naomi Quenk): a transient episode, triggered by stress, fatigue, or illness, in which the *inferior function of the unchanged stack* drives out-of-character behavior. It ends; the person returns to baseline ("Once the grip episode/period is over, it isn't unusual for people to wonder what came over them").
- **Loop** (a.k.a. tertiary temptation): an unhealthy defensive pattern in which the dominant teams up with the same-attitude tertiary to avoid the auxiliary — "essentially a double down strategy." It can persist for years, but it is defined entirely by the fixed stack positions of one of the 16 types.

Both concepts describe *which functions are engaged*; neither describes a reordered stack. Applying "loop/grip" labels to an arbitrary permutation of eight functions is incoherent within the theory that defines those terms.

**"Switch" does not exist.** The term appears nowhere on any of the four pages as a named concept. The loop/grip/switch triad the developer attributes to this source could not be verified for "switch" — it appears to be a community coinage from elsewhere or a misremembering. *(Flagged: unverified; treat as non-existent in the cited source.)*

**Test-derived orderings are explicitly distrusted.** The source says test results "only measure probability" and are a starting point; unofficial online quizzes "tend to yield inaccurate results"; and — most damaging to Mindstack's input pipeline — psychological instability "muddles the true order of the functions as they get expressed" ([/spotting](https://mbti-notes.tumblr.com/spotting/mobile)). In other words, the observed/expressed function ordering is treated as noise over a fixed latent type — the *opposite* of treating a measured ordering as the type itself.

**Situational variation is a confound, not an input.** The source acknowledges all eight functions can appear behaviorally "depending on the circumstances," but instructs typers to *separate* dispositional from situational factors. The developer's 5W1H conditioning idea therefore has no support here (it does have support elsewhere — see §5).

**A directly relevant warning:** "Using the wrong functional stack for self-development may be harmful by exacerbating tertiary loop and inferior grip problems" ([/development](https://mbti-notes.tumblr.com/development/mobile)). An app that generates guidance from arbitrary measured orderings is, by this source's own lights, systematically doing the harmful thing.

---

## 3. The Sakinorva test: what it is and what it can bear

First, a spelling correction: the developer wrote "Sakirnova"; the instrument is the **Sakinorva Cognitive Functions Test (Grant/Brownsword)** at [sakinorva.net/functions](https://sakinorva.net/functions?lang=en) (2024 edition), a pseudonymous hobbyist project.

**Structure (verified by direct HTML inspection):** exactly 96 questions (radio inputs q1–q96), each on a 5-point disagree–agree scale with the middle option meaning "no preference for either side"; questions may be skipped with no penalty (per the site [FAQ](http://i.sakinorva.net/question_time)). That's roughly 12 items per function — coarse resolution.

**Scoring is a black box.** The form POSTs to the same page; scoring runs server-side; no page publishes per-question weights or the question→function key, and **there is no API**. Widely-circulated Grant-stack coefficients (1.25/0.75/0.25/−0.25) were reverse-engineered by a forum user in 2020, cover only the type-derivation stage, and predate later algorithm revisions. Practical consequence: Mindstack cannot recompute or verify scores — users must transcribe results manually (or paste a screenshot).

**Outputs:** results are computed four ways — Grant/Brownsword, axis-based, Myers, and Myers-letters — plus absolute scores for all eight functions. This matches the developer's screenshot. *(Caveat, flagged: the four methods and their descriptions were verified on the test page itself; the exact rendered results-table labels were confirmed only via convergent secondary sources, since rendering results requires submitting the form.)*

**Psychometric status: none.** No reliability, validity, factor-analysis, or norms documentation exists anywhere on the site. The author's own [dataset article](https://sakinorva.net/rakugaki/kizi/data_analysis1) (~5.2M results from 3M+ users since April 2018) reports only distribution graphs and z-score re-norming, and admits a structural letter bias "inherent to the test." The author's stance is remarkably candid: the test was built to *"reverse engineer how typology hobbyists generally understand 'the cognitive functions'"*, typology systems are *"ultimately completely bogus,"* and *"the questions are just too vague"* ([Q&A](http://i.sakinorva.net/question_time)). The author also notes results change on retake ("We're fluid beings").

**Bearing on Mindstack:** with ~12 coarse items per function and no reliability data, small gaps between adjacent function scores are almost certainly retest-unstable. Treating the *full ordering* of eight such scores as one of 40,320 meaningful states demands far more measurement precision than the instrument can deliver. No statistic exists on how often raw orderings match canonical stacks (checked; the author's dataset article doesn't address it), but structurally only 16/40,320 orderings are canonical and community threads treat non-canonical orderings as routine. Also noteworthy: the same author now offers a 256-question [Cognitive Function Domains Test](https://sakinorva.net/test/function_bunya) scoring the eight functions across four domains — a finer-grained input if the developer wants one. And the sakinorva.net library itself states *"type dynamics have never been able to be verified empirically"* ([contextualizing functions](https://sakinorva.net/library/contextualizing_functions)).

---

## 4. Academic assessment: what peer review says

**MBTI scales measure something real — but continuous, not typological.** McCrae & Costa (1989, *Journal of Personality* 57(1), [DOI 10.1111/j.1467-6494.1989.tb00759.x](https://doi.org/10.1111/j.1467-6494.1989.tb00759.x)) found no support for dichotomous preferences or qualitatively distinct types; the MBTI measures four relatively independent continuous dimensions that correlate with four of the Big Five, and Jung's theory is "either incorrect or inadequately operationalized by the MBTI." They also found no evidence for the score interactions type dynamics requires.

**Type dynamics — the function-stack theory Mindstack extends — fails even in the type community's own journal.** Reynierse's "The Case Against Type Dynamics" (*Journal of Psychological Type* 69(1), 2009 — published by CAPT, a pro-type organization) concluded the theory rests on category mistakes, anecdote, and empirical inconsistency; Reynierse & Harker (JPT 68, 2008) tested dominant > auxiliary > tertiary > inferior predictions directly and found the presumed order held in **1 of 540 tests**. Reynierse's positive account — observed effects are additive effects of continuous preferences ("preference multidimensionality") — is, ironically, an argument *for* Mindstack's profile-based reframe and *against* both the 16 types and the 40,320 orderings. *(Flagged: the JPT full texts are no longer directly fetchable from CAPT; conclusions verified via the Semantic Scholar record and converging secondary summaries.)*

**Types aren't real clusters, and they aren't stable.** Score distributions are continuous and center-weighted, not bimodal (Stricker & Ross 1964; Bess & Harvey 2002 — earlier bimodality reports were an IRT software artifact). 50% of test-takers change on at least one letter across a 5-week retest (McCarley & Carskadon 1983, via [Pittenger 2005](https://doi.org/10.1037/1065-9293.57.3.210), full text verified); even the MBTI Manual reports 35% retype at 4 weeks. Meanwhile the *continuous* subscale scores show acceptable reliability (test-retest ≥ .75 for three scales, .61 for T-F; Randall, Isaacson & Ciro 2017 [meta-analysis](https://gwern.net/doc/psychology/personality/2017-randall.pdf)). Lesson for Mindstack: **keep the magnitudes; distrust the discretization** — whether into 16 buckets or 40,320.

**Loops and grips have zero peer-reviewed literature.** An OpenAlex exact-phrase search for "dominant-tertiary loop" returns **0 works** across its full index; Google Scholar returns one self-published book. "Grip" traces to Quenk's practitioner books (*In the Grip*, CPP 1996/2000; *Was That Really Me?*, Davies-Black 2002) — commercial publications with no controlled empirical validation. The loop concept originates in online typology communities (building on Lenore Thomson's popular writing), not research.

**Consensus:** Stein & Swan (2019, *Social and Personality Psychology Compass* 13:e12434, [full text](https://swanpsych.com/publications/SteinSwanMBTITheory_2019.pdf)) conclude MBTI/Jungian function theory "lacks agreement with known facts and data, lacks testability, and possesses internal contradictions," existing "in a parallel universe governed mostly by commerce rather than peer review." Mainstream personality science uses the Big Five (and HEXACO, ~47 languages, maintained for academic research by [Ashton & Lee](https://hexaco.org/hexaco-inventory)).

---

## 5. What leading institutions actually use

The honest answer to "don't intelligence agencies use this?" is **no** — and the documented history is more interesting than the myth.

**OSS (WWII, the origin story).** The OSS assessment program — run by clinical psychologists and psychiatrists including Henry Murray and Donald MacKinnon, documented in *Assessment of Men* (1948) — put candidates through 3 days of situational tests (85–90 assessments, including stress scenarios with planted obstructive "stooges") and pooled multi-rater staff-conference ratings on 10 dimensions (emotional stability, effective intelligence, leadership, etc.). It was the origin of the assessment-center method — behavioral and situational, with no Jungian typology anywhere in it. Lenzenweger's reanalysis of the sole surviving data matrix (n=133) found three factors: emotional/interpersonal, intelligence processing, agency/surgency ([Lenzenweger 2015, *J. Personality Assessment* 97(1)](https://doi.org/10.1080/00223891.2014.935980), full text verified).

**Modern US intelligence and law enforcement.** CIA's official hiring page lists "a background investigation, a polygraph interview, and a physical and psychological examination" — the page HTML contains no mention of MBTI, type, or Jung ([cia.gov/careers/how-we-hire](https://www.cia.gov/careers/how-we-hire/), keyword-searched directly). Security-clearance adjudication follows ODNI [SEAD-4](https://www.dni.gov/index.php/ncsc-how-we-work/ncsc-security-executive-agent/ncsc-policy) (effective June 2017), whose Guideline I (Psychological Conditions) is clinical and requires "a duly qualified mental health professional" — the full guidelines text contains no Myers-Briggs, Jung, or typology. FBI Special Agent selection uses a psychometric battery (logic-based reasoning, personality assessment, situational judgment), structured interview, polygraph, and clinical/background stages. Police/public-safety screening standardly uses the MMPI-2-RF/MMPI-3 with dedicated police-candidate comparison groups.

**MBTI's real institutional footprint** is development and team-building — a 2007 Government Executive report found agencies using it for management improvement, ~20% of publisher CPP's sales — and The Myers-Briggs Company itself states the MBTI "is not intended for use in selection of job candidates" and calls screening use unethical ([themyersbriggs.com facts page](https://ap.themyersbriggs.com/themyersbriggs-mbti-facts.aspx)).

**KGB/Mossad claims: unverifiable myth.** A 1987 in-house KGB manual on profiling *recruitment targets* exists (per journalist Michael Weiss), but nothing available shows Jungian typology in it, and it concerns targets, not personnel screening. Mossad's publicly described assessment involves psychological analysis and interviews; no instrument-level documentation is public. **Socionics** — the Soviet-era 8-function Jungian offshoot (Augustinavičiūtė, Model A) — is the closest real-world precedent for 8-function thinking, is popular in ex-USSR countries, has no documented KGB adoption, was not derived empirically, and has been placed by the Russian Academy of Sciences' pseudoscience commission "among such well-known pseudosciences as astrology and homeopathy" ([overview](https://en.wikipedia.org/wiki/Socionics)).

**Where the developer's situational intuition IS supported.** The 5W1H idea — that how a person thinks/behaves depends on who/what/when/where/why/how — is genuinely mainstream science, just not on a Jungian substrate:

- **Fleeson (2001, JPSP 80:1011–1027):** experience-sampling shows the typical individual "regularly and routinely manifested nearly all levels of all traits in his or her everyday behavior," while each person's *distribution* of states is highly stable. Both "situations matter" and "stable dispositions exist" are simultaneously true.
- **Mischel & Shoda (1995, *Psychological Review* 102:246–268):** the CAPS model formalizes personality as stable **if-then situation-behavior signatures** ("if situation X, then behavior Y") — the canonical academic version of exactly what Mindstack wants to generate.
- **Whole Trait Theory (Fleeson & Jayawickreme 2015, JRP 56:82–92)** integrates the two: traits as density distributions of states, with social-cognitive mechanisms explaining situational variation.

Critically, all of this operates on **continuous trait-state dimensions**, not function orderings. It supports the situational-conditioning half of Mindstack while giving no support to the 8!-permutation half.

---

## 6. The 40,320 question

**Combinatorics vs. theory.** Brute-force enumeration (verified computationally) confirms: under Grant/Beebe constraints — 8 dominant choices × 2 legal auxiliaries (opposite attitude, opposite J/P), tertiary/inferior fixed by axis pairing (Ni–Se, Ne–Si, Ti–Fe, Te–Fi), positions 5–8 attitude-flipped mirrors of 1–4 — exactly **16 of 40,320 orderings are canonical (0.04%)**. Socionics Model A independently admits its own 16 (a disjoint set, arranged differently); the union across both models is 32 orderings (0.08%). So "40,320 valid type-orderings" doesn't extend the cited theory — it contradicts it, since ≥99.92% of orderings are illegal in every framework the app invokes. And because loops and grips are defined as *engagement states within an unchanged canonical stack* (Quenk's grip: the inferior erupts while remaining the inferior; the loop: dom+tertiary bypass the aux), they cannot rescue arbitrary orderings — they presuppose the fixed positions the arbitrary orderings abandon.

**Prior art survey — nobody does free orderings.** Beebe's eight-function/eight-archetype model: all 8 functions in fixed archetypal positions per type; still 16 types. Socionics Model A: first two functions determine all eight positions; 16 types. Objective Personality: expands to 512 types via nine binary "coins" scored by paired human raters — added dichotomies, not free orderings. Mindstack's framing would be **novel, not supported** — which is worth saying plainly: novelty here is not a moat, because the theory the novelty extends is itself empirically hollow (§4).

**The defensible reframe: profile, not permutation.** Treating the 8 continuous scores as a **score profile with magnitudes** is legitimate and actually preserves *more* information than either 16 buckets or a bare rank-order:

- A rank-order discards distances. Fi 34, Ni 33 vs. Fi 34, Ni 12 are wildly different profiles with the same adjacent ranking.
- With 8 bounded, coarse scores, exact ties and within-error near-ties are common, so the full ranking is **unstable under retest noise** — many of the 40,320 orderings are separated by less than the measurement error of a 96-item hobbyist test.
- Reynierse's peer-reviewed conclusion — continuous, additive preferences outperform stack dynamics — is direct support for conditioning on magnitudes rather than order.

So: feed the LLM the eight scores *with magnitudes and explicit closeness/tie annotations*, describe the shape of the profile (dominant cluster, close races, deep troughs), and condition on situational context via CAPS-style if-then framing. That is the version of Mindstack a psychometrician could not laugh out of the room.

---

## 7. Product implications: concrete recommendations

**Input handling**

1. **No Sakinorva API exists and scoring is a black box.** Users must manually enter their eight function scores (or the app parses a pasted results screenshot/text). Validate ranges, and store raw magnitudes — never just the ordering.
2. Spell it **Sakinorva** (the developer's "Sakirnova" is a misspelling) and consider supporting the author's newer 256-question [Domains Test](https://sakinorva.net/test/function_bunya) (8 functions × 4 domains) as a richer optional input.
3. State clearly in-app that the test is an unvalidated hobbyist instrument whose own author calls typology "completely bogus" — set expectations at the door.

**Ties, near-ties, and profile shape**

4. Compute pairwise gaps between adjacent scores and pass explicit annotations to the LLM: "Ti and Ni effectively tied (within noise)," "large drop-off after position 3." Never let the prompt imply that position 6 vs. 7 is meaningful.
5. Generate descriptions from the **profile shape** (peaks, clusters, troughs, magnitudes), not from a named permutation. Drop loop/grip/switch as generative mechanics; if referenced at all, present them as community folklore about stress states, clearly labeled as unvalidated (and note "switch" has no source even in that folklore).

**Situational (5W1H) conditioning — the app's best idea**

6. Frame situational outputs as **if-then signatures** ("in high-pressure deadline situations, someone with this profile might..."), explicitly modeled on Mischel & Shoda's CAPS and Fleeson's state-distribution work. This is the one component with genuine peer-reviewed backing — lead with it.

**Barnum-effect mitigations (mandatory, not optional)**

7. The risk is quantified: Forer (1949) got a 4.26/5 accuracy rating for an *identical* sketch given to every student; acceptance rises with favorability, "for you alone" framing, and source prestige (Dickson & Kelly 1985) — exactly the conditions a personalized LLM report creates. LLM sycophancy (Sharma et al., ICLR 2024) compounds this: the model drifts toward flattery, and flattery is what users rate as accurate.
8. Mitigations from the literature: prompt for **specific, falsifiable statements** rather than warm generalities; include non-flattering/trade-off content by explicit instruction; offer a **discriminant check** (show the user their profile's description alongside a contrasting profile's — can they pick theirs out?).

**Framing and ethics**

9. The AERA/APA/NCME *Standards for Educational and Psychological Testing* (2014) require validity evidence for every intended interpretation of test scores. Mindstack has none available at any layer (instrument, theory, or generative step). **Position the output as reflective entertainment / self-exploration**, with a persistent disclaimer: not a psychological assessment, not diagnostic, not for hiring, placement, or clinical decisions. Note the irony guardrail: even mbti-notes warns that wrong-stack guidance "may be harmful."
10. Do not market with intelligence-agency associations — they are unverifiable at best and false at worst (§5).

**DeepSeek API (corrections to the developer's briefing)**

11. As of August 2026, "DeepSeek Flash" **is** real: DeepSeek V4 shipped `deepseek-v4-flash` (GA 2026-07-31) and `deepseek-v4-pro` (2026-08-13). The legacy names `deepseek-chat` / `deepseek-reasoner` are deprecated aliases slated for discontinuation — new code should use the exact string **`deepseek-v4-flash`** ([official changelog](https://api-docs.deepseek.com/updates/)).
12. Integration: base URL `https://api.deepseek.com`, compatible with OpenAI and Anthropic SDKs. Pricing (off-peak): $0.22/M input (cache miss), $0.66/M output, doubled at peak (01:00–04:00 and 06:00–10:00 UTC weekdays), cache-hit input ~$0.007–0.014/M; 1M context ([pricing](https://api-docs.deepseek.com/quick_start/pricing)). A 2–4K-token report costs a fraction of a cent — **cost is not a feasibility constraint**. Batch generation off-peak halves it further.

---

## 8. Sources

**Cited theory (mbti-notes)**
- https://mbti-notes.tumblr.com/basics/mobile · /theory/mobile · /development/mobile · /spotting/mobile (all fetched; key quotes verified verbatim against raw HTML)

**Sakinorva**
- Test page: https://sakinorva.net/functions?lang=en (96 items, four scoring methods — verified via raw HTML)
- Author Q&A/FAQ: http://i.sakinorva.net/question_time
- Dataset article: https://sakinorva.net/rakugaki/kizi/data_analysis1 (~5.2M results; no psychometric documentation)
- Library essay: https://sakinorva.net/library/contextualizing_functions ("type dynamics have never been able to be verified empirically")
- Domains test: https://sakinorva.net/test/function_bunya

**Academic psychometrics**
- McCrae & Costa (1989). *Journal of Personality*, 57(1), 17–40. DOI 10.1111/j.1467-6494.1989.tb00759.x
- Reynierse (2009). The Case Against Type Dynamics. *Journal of Psychological Type*, 69(1), 1–24 (via Semantic Scholar record; full PDF no longer hosted at CAPT — flagged)
- Reynierse & Harker (2008). *Journal of Psychological Type*, 68 (1-of-540 result; via converging secondary summaries — flagged)
- Stricker & Ross (1964). *J. Abnormal and Social Psychology*, 68(1), 62–71
- Bess & Harvey (2002). *J. Personality Assessment*, 78(1), 176–186. DOI 10.1207/S15327752JPA7801_11
- Pittenger (2005). *Consulting Psychology Journal*, 57(3), 210–221. DOI 10.1037/1065-9293.57.3.210 (full text read)
- Randall, Isaacson & Ciro (2017). *J. Best Practices in Health Professions Diversity*, 10(1), 1–27 (full text read)
- Stein & Swan (2019). *Social and Personality Psychology Compass*, 13:e12434 (full text read)
- Loop/grip literature absence: OpenAlex exact-phrase "dominant-tertiary loop" = 0 works (https://api.openalex.org/works?search=%22dominant-tertiary%20loop%22); Quenk, *In the Grip* (CPP 1996/2000) and *Was That Really Me?* (Davies-Black 2002) — practitioner books, no journal validation

**Institutions**
- Lenzenweger (2015). *J. Personality Assessment*, 97(1), 100–110. DOI 10.1080/00223891.2014.935980 (OSS reanalysis; full text read)
- CIA hiring: https://www.cia.gov/careers/how-we-hire/ (HTML keyword-searched)
- ODNI SEAD-4 adjudicative guidelines (via DSS/DCSA 2017 Job Aid PDF, nationalinsiderthreatsig.org)
- Myers-Briggs Company selection disclaimer: https://ap.themyersbriggs.com/themyersbriggs-mbti-facts.aspx; https://www.myersbriggs.org/unique-features-of-myers-briggs/ethical-use-of-the-mbti/
- Government Executive (2007): https://www.govexec.com/magazine/magazine-news-and-analysis/2007/06/personality-test/24549/
- Socionics: https://en.wikipedia.org/wiki/Socionics (RAS pseudoscience-commission listing)
- KGB manual (unverified for typology content — flagged): https://macspaunday.substack.com/p/moscows-ordinary-people
- HEXACO: https://hexaco.org/hexaco-inventory
- Barrick & Mount (1991). *Personnel Psychology*, 44, 1–26; Sackett et al. (2022). *J. Applied Psychology*, DOI 10.1037/apl0000994

**Situational science (the real support for 5W1H)**
- Fleeson (2001). *JPSP*, 80(6), 1011–1027 (density distributions of states)
- Mischel & Shoda (1995). *Psychological Review*, 102(2), 246–268 (CAPS if-then signatures)
- Fleeson & Jayawickreme (2015). *J. Research in Personality*, 56, 82–92 (Whole Trait Theory)

**Combinatorics & prior art**
- 16/40,320 canonical orderings: brute-force enumeration verified; constraints per Beebe (*Energies and Patterns in Psychological Type*, Routledge 2016, ch. 8) and socionics Model A (https://wikisocion.github.io/content/model_a.html); union with Model A = 32 orderings
- Objective Personality: https://wiki.personality-database.com/books/objective-personality

**Barnum effect & LLM sycophancy**
- Forer (1949). *J. Abnormal and Social Psychology*, 44(1), 118–123
- Dickson & Kelly (1985). *Psychological Reports*, 57(2), 367–382
- Furnham & Schofield (1987). *Current Psychology*, 6, 162–178
- Sharma et al. (2023). Towards Understanding Sycophancy in Language Models. arXiv:2310.13548 (ICLR 2024)

**DeepSeek**
- https://api-docs.deepseek.com/updates/ · https://api-docs.deepseek.com/quick_start/pricing (corroborated: OpenRouter, Hugging Face model cards)

**Ethics standards**
- AERA, APA, & NCME (2014). *Standards for Educational and Psychological Testing*: https://www.apa.org/science/programs/testing/standards

**Items that remained unverified (flagged inline above):** the "switch" concept (no source found anywhere in the cited material); exact rendered labels of the Sakinorva results table (secondary confirmation only); JPT full texts for Reynierse 2008/2009 (record-level + secondary verification); any quantitative rate of non-canonical Sakinorva orderings (no primary statistic exists); KGB/Mossad instrument-level practices (no primary documentation).
