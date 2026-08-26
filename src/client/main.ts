/**
 * Client bootstrap.
 *
 * The order of operations is the point: the moment the numbers validate, the
 * signature is computed locally and Section 1 is on screen. The network call for
 * sections 2-6 starts in parallel and streams in underneath it. Nothing the
 * server says can change Section 1, and a failed request still leaves the person
 * with the arithmetic they came for.
 */

import { computeSignature } from '../shared/geometry';
import { validateScores } from '../shared/validation';
import type { Scores } from '../shared/geometry/types';
import { generateReport, type GenerateRequest } from './api';
import { createInputForm } from './ui/InputForm';
import { createSignatureView, createTierStrip } from './ui/SignatureView';
import { createReportView } from './ui/ReportView';
import { confirmOutOfRange, summarizeFlags } from './ui/validation-ui';
import { el } from './ui/dom';

const app = document.getElementById('app');
if (!app) throw new Error('mindstack: #app is missing from the page');

/* ---- chrome ---- */

const masthead = el('header', 'masthead');
masthead.append(
  el('h1', undefined, 'Mindstack'),
  el(
    'p',
    undefined,
    'Eight cognitive-function scores in, one structured self-reflection out. A set of hypotheses with the math shown.',
  ),
);

const formSlot = el('section');
const outputSlot = el('section', 'stack-flow');

const shell = el('div', 'stack-flow');
shell.append(formSlot, outputSlot);
app.append(masthead, shell);

/* ---- form ---- */

const form = createInputForm(() => {
  void submit();
});
formSlot.appendChild(form.element);

/* ---- run ---- */

let running = false;

async function submit(): Promise<void> {
  if (running) return;

  const result = validateScores(form.readScores());
  const summary = summarizeFlags(result);
  form.markInvalid(summary.invalid);
  form.showErrors(summary.messages);

  if (!result.ok || !result.scores) {
    if (summary.invalid.length) form.focusField(summary.invalid[0]);
    return;
  }

  if (result.needsConfirmation) {
    const choice = await confirmOutOfRange(result);
    if (choice === 'edit') {
      form.markInvalid(result.outOfRange);
      if (result.outOfRange.length) form.focusField(result.outOfRange[0]);
      return;
    }
    // Confirmed: the values go through exactly as typed (02 §1, never clamp).
    form.markInvalid([]);
  }

  await run(result.scores);
}

async function run(scores: Scores): Promise<void> {
  running = true;
  /*
   * Dismiss the on-screen keyboard before anything moves. Otherwise the
   * viewport growing back races the card collapsing and the scroll below, and
   * on a phone all three fight each other.
   */
  (document.activeElement as HTMLElement | null)?.blur?.();
  form.setBusy(true);
  form.setStale(false);
  /*
   * Hide the form completely, leaving only its back button. Fired, not awaited -
   * the promise is used further down, purely to time the scroll.
   */
  const collapsed = form.collapse();
  masthead.dataset.compact = 'true';
  outputSlot.replaceChildren();

  /*
   * 1. The geometry, computed locally and immediately - but NOT yet shown.
   *
   * The readout is the working, not the answer, so it is held back until the
   * report is finished and then mounted underneath it. Computing it now still
   * matters: it is what catches un-measurable numbers before any network call,
   * and it costs nothing.
   */
  let signatureRegime = 'NORMAL';
  let signatureView: HTMLElement | null = null;
  let tierStrip: HTMLElement | null = null;
  try {
    const signature = computeSignature(scores);
    signatureRegime = signature.regime;
    signatureView = createSignatureView(signature);
    signatureView.classList.add('t-toast');
    // The headline reading goes up straight away, above the thinking panel.
    // Only the working is held back until the report is done.
    tierStrip = createTierStrip(signature);
  } catch (error) {
    const card = el('div', 'card error-card');
    card.setAttribute('role', 'alert');
    card.append(
      el('h2', 'card-title', 'Those numbers could not be measured'),
      el('p', 'card-sub', error instanceof Error ? error.message : String(error)),
    );
    outputSlot.appendChild(card);
    running = false;
    form.setBusy(false);
    return;
  }

  /* 2. Sections 2-7, streamed. This is what the reader came for, so it sits at
   * the top of the output with nothing above it to scroll past. */
  const report = createReportView();
  if (tierStrip) {
    outputSlot.appendChild(tierStrip);
    requestAnimationFrame(() => tierStrip?.classList.add('is-open'));
  }
  outputSlot.appendChild(report.element);
  report.setStatus('interpreting your profile…');
  if (signatureRegime === 'FLAT') report.showFlatNotice();

  /*
   * Wait for the collapse to settle before scrolling. scrollIntoView computes
   * its target from the layout at call time, and the card above is in the middle
   * of losing several hundred pixels - scrolling now lands that far too low.
   */
  void collapsed.then(() => {
    outputSlot.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const request: GenerateRequest = { scores };
  let failed = false;

  /*
   * Mount the readout below the report once the run settles. It is revealed on
   * failure too: the arithmetic is local and already done, and a failed request
   * should still leave the person with the numbers they came for.
   */
  const revealSignature = (): void => {
    if (!signatureView || signatureView.isConnected) return;
    outputSlot.appendChild(signatureView);
    requestAnimationFrame(() => signatureView?.classList.add('is-open'));
  };

  await generateReport(request, {
    onMeta(meta) {
      if (!meta.llm) {
        report.showFlatNotice();
        report.setStatus('writing the short, honest version…');
      }
    },
    onThinking(text) {
      report.appendThinking(text);
    },
    onChunk(text) {
      report.append(text);
    },
    onError(error) {
      failed = true;
      report.setStatus(null);
      // The error card first, so the reason is on screen before anything else;
      // finish() then flushes whatever prose did arrive before the failure.
      report.showError(error.message, () => {
        void run(scores);
      });
      report.finish();
      revealSignature();
    },
    onDone() {
      report.setStatus(null);
      report.finish();
      revealSignature();
    },
  });

  if (!failed) report.finish();
  report.setStatus(null);
  // Backstop: a stream that ends without a terminal event still reveals it.
  revealSignature();
  running = false;
  form.setBusy(false);
}
