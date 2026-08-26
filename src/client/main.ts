/**
 * Client bootstrap.
 *
 * The order of operations is the point: the moment the numbers validate, the
 * signature is computed locally and Section 1 is on screen. The network call for
 * sections 2-6 starts in parallel and streams in underneath it. Nothing the
 * server says can change Section 1, and a failed request still leaves the person
 * with the arithmetic they came for.
 */

import 'wired-elements';

import { computeSignature } from '../shared/geometry';
import { validateScores } from '../shared/validation';
import type { Scores } from '../shared/geometry/types';
import { generateReport, type GenerateRequest } from './api';
import { createInputForm } from './ui/InputForm';
import { createSignatureView } from './ui/SignatureView';
import { createReportView } from './ui/ReportView';
import { confirmOutOfRange, summarizeFlags } from './ui/validation-ui';

const app = document.getElementById('app');
if (!app) throw new Error('mindstack: #app is missing from the page');

/* ---- chrome ---- */

const masthead = document.createElement('header');
masthead.className = 'masthead';
const title = document.createElement('h1');
title.textContent = 'Mindstack';
const tagline = document.createElement('p');
tagline.textContent =
  'Eight cognitive-function scores in, one structured self-reflection out. Not a type, not an assessment — a set of hypotheses with the arithmetic shown.';
masthead.append(title, tagline);

const formSlot = document.createElement('section');
const outputSlot = document.createElement('section');
outputSlot.className = 'stack-flow';

const shell = document.createElement('div');
shell.className = 'stack-flow';
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
  form.setBusy(true);
  outputSlot.replaceChildren();

  /* 1. Section 1, immediately, from local arithmetic. */
  let signatureRegime = 'NORMAL';
  try {
    const signature = computeSignature(scores);
    signatureRegime = signature.regime;
    outputSlot.appendChild(createSignatureView(signature));
  } catch (error) {
    const card = document.createElement('wired-card');
    const heading = document.createElement('h2');
    heading.className = 'card-title';
    heading.textContent = 'Those numbers could not be measured';
    const detail = document.createElement('p');
    detail.className = 'card-sub';
    detail.textContent = error instanceof Error ? error.message : String(error);
    card.append(heading, detail);
    outputSlot.appendChild(card);
    running = false;
    form.setBusy(false);
    return;
  }

  /* 2. Sections 2-6, streamed. */
  const report = createReportView();
  outputSlot.appendChild(report.element);
  report.setStatus('interpreting your profile…');
  if (signatureRegime === 'FLAT') report.showFlatNotice();

  outputSlot.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const request: GenerateRequest = { scores };
  let failed = false;

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
    onAudit(audit) {
      report.showAudit(audit.violations);
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
    },
    onDone() {
      report.setStatus(null);
      report.finish();
    },
  });

  if (!failed) report.finish();
  report.setStatus(null);
  running = false;
  form.setBusy(false);
}

/*
 * wired-elements measure their sketch geometry from the layout box. Cards and
 * inputs watch themselves with a ResizeObserver, buttons and dividers do not, so
 * nudge every wired element after a viewport change (orientation, on-screen
 * keyboard, desktop resize).
 */
let redrawTimer = 0;
window.addEventListener(
  'resize',
  () => {
    window.clearTimeout(redrawTimer);
    redrawTimer = window.setTimeout(() => {
      const wired = document.querySelectorAll<HTMLElement & { wiredRender?: (f: boolean) => void }>(
        'wired-input, wired-button, wired-card, wired-divider',
      );
      wired.forEach((node) => node.wiredRender?.(true));
    }, 180);
  },
  { passive: true },
);
