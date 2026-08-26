/**
 * Sections 2-7 of the report (05 §5.1), streamed from the server into one
 * card each.
 *
 * The stream arrives as markdown fragments at arbitrary boundaries, so the text
 * is split into sections line by line as it lands and re-rendered on the next
 * animation frame. Only the section still being written is re-rendered: once a
 * later heading arrives, everything above it is sealed and never touched again.
 * That keeps the per-frame cost proportional to the section in flight rather
 * than to the whole report, which matters at a couple of thousand words. A
 * heading that has only half-arrived is withheld rather than printed as prose.
 *
 * Markdown is rendered by the small hand-rolled formatter below - deliberately
 * not a library - and everything is HTML-escaped before a single markdown rule
 * runs, so no model output can inject markup.
 */

import { createFrameScheduler, el, motionMs, prefersReducedMotion, shimmerText } from './dom';
import { applyTagChips } from './tags';
import {
  createThinkingPanel,
  THINKING_STATUS,
  WRITING_STATUS,
  type ThinkingPanelApi,
} from './ThinkingPanel';

/* ------------------------------------------------------------------ *
 * Section splitting
 * ------------------------------------------------------------------ */

/**
 * The exact section headings the server emits, in the order it emits them
 * (05 §5.1, sections 2-7; section 1 is code-rendered by SignatureView).
 */
export const SECTION_TITLES: readonly string[] = [
  'How your mind tends to work',
  'How you handle different situations',
  'When things get stressful',
  'Things you can try',
  'Where this report comes from',
  "What this report can't tell you",
];

const HEADINGS = SECTION_TITLES.map((title) => `## ${title}`);

/**
 * A heading line, canonicalised. Tolerates trailing space, extra hashes and a
 * leading section number - anything else is body text.
 */
export function matchSectionTitle(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('#')) return null;
  const text = trimmed
    .replace(/^#+\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/\s*#+$/, '')
    .trim()
    .toLowerCase();
  return SECTION_TITLES.find((title) => title.toLowerCase() === text) ?? null;
}

/**
 * True while an unterminated trailing line could still turn into a heading, so
 * a half-delivered "## When things" - or a complete "## Things you can try" whose newline has
 * not arrived - is withheld instead of being printed as prose.
 */
export function couldContinueHeading(tail: string): boolean {
  if (tail === '' || !tail.startsWith('#')) return false;
  const lower = tail.toLowerCase();
  return HEADINGS.some((heading) => heading.toLowerCase().startsWith(lower));
}

export interface ReportSection {
  /** null for anything the model emitted before the first known heading. */
  title: string | null;
  body: string;
}

/** How a section's body grows: line by line, newline-joined, per splitSections. */
function joinLine(body: string, line: string): string {
  return body === '' ? line : `${body}\n${line}`;
}

export interface SectionDelta extends ReportSection {
  /** Position in the report; stable, and only ever appended to. */
  index: number;
  /** True once a later heading arrived: this body will never change again. */
  sealed: boolean;
}

export interface SectionSplitter {
  /** Feed a stream fragment of any size. */
  push(text: string): void;
  /** Flush the trailing partial line. Call once, at end of stream. */
  end(): void;
  /**
   * Sections whose renderable text changed since the last call. At most two:
   * the one just sealed and the new one below it.
   */
  drain(): SectionDelta[];
  /** Every section parsed so far, growing tail included. */
  snapshot(): SectionDelta[];
}

/**
 * Incremental counterpart to splitSections: same rules, fed a fragment at a
 * time, reporting only what changed. This is what the streaming view runs on.
 */
export function createSectionSplitter(): SectionSplitter {
  const sections: SectionDelta[] = [{ index: 0, title: null, body: '', sealed: false }];
  const dirty = new Set<number>([0]);
  /** Text after the last newline seen: not yet a line, so not yet committed. */
  let pending = '';
  let ended = false;

  const addLine = (line: string): void => {
    const title = matchSectionTitle(line);
    if (title !== null) {
      const previous = sections[sections.length - 1];
      previous.sealed = true;
      dirty.add(previous.index);
      sections.push({ index: sections.length, title, body: '', sealed: false });
    } else {
      const current = sections[sections.length - 1];
      current.body = joinLine(current.body, line);
    }
    dirty.add(sections[sections.length - 1].index);
  };

  /** The active section's body plus whatever of `pending` is safe to show. */
  const renderable = (section: SectionDelta): string => {
    if (section.sealed || pending === '' || couldContinueHeading(pending)) return section.body;
    return joinLine(section.body, pending);
  };

  return {
    push(text: string): void {
      if (ended || text === '') return;
      pending += text;
      let cut = pending.indexOf('\n');
      while (cut !== -1) {
        addLine(pending.slice(0, cut));
        pending = pending.slice(cut + 1);
        cut = pending.indexOf('\n');
      }
      // The tail changed even if no line completed, so the active section is
      // dirty either way.
      dirty.add(sections[sections.length - 1].index);
    },

    end(): void {
      if (ended) return;
      ended = true;
      // split('\n') yields a final element for the text after the last newline,
      // empty or not; committing it unconditionally keeps this in step with
      // splitSections.
      addLine(pending);
      pending = '';
    },

    drain(): SectionDelta[] {
      const changed = [...dirty]
        .sort((a, b) => a - b)
        .map((index) => ({ ...sections[index], body: renderable(sections[index]) }));
      dirty.clear();
      return changed;
    },

    snapshot(): SectionDelta[] {
      return sections.map((section) => ({ ...section, body: renderable(section) }));
    },
  };
}

/**
 * Batch split, and the executable specification the incremental splitter is
 * tested against. Deliberately a separate, obvious implementation.
 */
export function splitSections(markdown: string): ReportSection[] {
  const sections: ReportSection[] = [{ title: null, body: '' }];
  for (const line of markdown.split('\n')) {
    const title = matchSectionTitle(line);
    if (title) {
      sections.push({ title, body: '' });
    } else {
      const current = sections[sections.length - 1];
      current.body = joinLine(current.body, line);
    }
  }
  return sections;
}

/* ------------------------------------------------------------------ *
 * Minimal markdown
 * ------------------------------------------------------------------ */

/** Neutralises every HTML-significant character. Runs before anything else. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** **bold** and *italic*, applied to already-escaped text. */
function inline(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}

/**
 * The supported subset: `##`/`###` headings, `**bold**`, `*italic*`, `-` lists,
 * `>` blockquotes (the §5.6 disclaimer), and blank-line-separated paragraphs.
 * Everything else is literal text.
 */
export function renderMarkdown(markdown: string): string {
  const lines = escapeHtml(markdown).split('\n');
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];

  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list.length) {
      out.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
    }
    list = [];
  };
  const flushQuote = () => {
    if (quote.length) {
      out.push(`<blockquote class="disclaimer"><p>${inline(quote.join(' '))}</p></blockquote>`);
    }
    quote = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    if (line.trim() === '') {
      flushAll();
      continue;
    }

    const heading = /^(#{2,6})\s+(.*)$/.exec(line.trim());
    if (heading) {
      flushAll();
      const tag = heading[1].length <= 2 ? 'h3' : 'h4';
      out.push(`<${tag}>${inline(heading[2].replace(/\s*#+$/, '').trim())}</${tag}>`);
      continue;
    }

    const quoted = /^&gt;\s?(.*)$/.exec(line);
    if (quoted) {
      flushPara();
      flushList();
      if (quoted[1].trim() !== '') quote.push(quoted[1].trim());
      continue;
    }

    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (item) {
      flushPara();
      flushQuote();
      list.push(item[1].trim());
      continue;
    }

    flushList();
    flushQuote();
    para.push(line.trim());
  }

  flushAll();
  return out.join('');
}

/* ------------------------------------------------------------------ *
 * The view
 * ------------------------------------------------------------------ */

interface SectionCard {
  card: HTMLElement;
  heading: HTMLElement | null;
  body: HTMLElement;
  html: string;
}

export interface ReportView {
  /** The whole report block: banners, status, thinking panel, section cards. */
  element: HTMLElement;
  /** A delta of the model's raw reasoning (the `thinking` event). */
  appendThinking(text: string): void;
  /** A delta of report content (the `chunk` event). */
  append(text: string): void;
  finish(): void;
  setStatus(text: string | null): void;
  showFlatNotice(): void;
  showError(message: string, onRetry: () => void): void;
}

export function createReportView(): ReportView {
  const element = el('div', 'report stack-flow');
  const banners = el('div', 'banner-host stack-flow');
  const statusHost = el('div', 'status');
  statusHost.setAttribute('aria-live', 'polite');
  // The thinking panel is mounted lazily, above the section cards, and removed
  // again once the report has content.
  const thinkingHost = el('div', 'thinking-host');
  const sectionHost = el('div', 'stack-flow');
  element.append(banners, statusHost, thinkingHost, sectionHost);

  const cards = new Map<number, SectionCard>();
  const caret = el('span', 'caret');
  const splitter = createSectionSplitter();
  /** The lowest card on the page, i.e. where the caret belongs. */
  let tailIndex = -1;
  /** Whether any non-blank prose has arrived at all. */
  let anyText = false;
  let streaming = true;
  let flatNoticeShown = false;
  let errorCard: HTMLElement | null = null;
  /** The live reasoning panel; created on the first thinking delta. */
  let thinking: ThinkingPanelApi | null = null;
  /** Whether the thinking panel ever took over the status line. */
  let thinkingOwnsStatus = false;
  /**
   * Once the report starts arriving the reasoning window is retired for good.
   * The SSE contract allows thinking and chunk events to interleave, so without
   * this a late thinking delta would build the panel again underneath a report
   * that is already on screen.
   */
  let thinkingRetired = false;
  /** Set once an error event arrives; suppresses the empty-report placeholder. */
  let errored = false;
  /** The placeholder card, so an error arriving later can withdraw it. */
  let placeholderIndex: number | null = null;

  const ensureCard = (index: number, title: string | null): SectionCard => {
    const existing = cards.get(index);
    if (existing) {
      if (title && existing.heading && existing.heading.textContent !== title) {
        existing.heading.textContent = title;
      }
      return existing;
    }
    const card = el('section', 'card report-section t-toast');
    let heading: HTMLElement | null = null;
    if (title) {
      heading = el('h2', undefined, title);
      card.appendChild(heading);
    }
    const body = el('div', 'report-body');
    card.appendChild(body);
    sectionHost.appendChild(card);
    /*
     * Entrance on the card itself, never on its contents. Anything that walked
     * .report-body per chunk would redo renderMarkdown's output every frame and
     * blow the streaming perf contract; this fires at most once per section and
     * never re-enters paint(). The card node is also never replaced or cloned -
     * the caret is a single shared element parented into it.
     */
    requestAnimationFrame(() => card.classList.add('is-open'));
    const made: SectionCard = { card, heading, body, html: '' };
    cards.set(index, made);
    if (index > tailIndex) tailIndex = index;
    return made;
  };

  /**
   * Re-render only the sections the splitter reports as changed - in practice
   * the one still being written, plus the one just sealed above it.
   */
  const paint = () => {
    for (const section of splitter.drain()) {
      // An empty preamble means the model went straight to a heading: no card.
      if (section.title === null && section.body.trim() === '' && !cards.has(section.index)) {
        continue;
      }
      const card = ensureCard(section.index, section.title);
      const html = applyTagChips(renderMarkdown(section.body));
      if (html !== card.html) {
        card.body.innerHTML = html;
        card.html = html;
      }
    }
    const tail = tailIndex >= 0 ? cards.get(tailIndex) : undefined;
    if (streaming && tail) {
      if (tail.body.lastChild !== caret) tail.body.appendChild(caret);
    } else {
      caret.remove();
    }
  };

  const { schedule } = createFrameScheduler(paint);

  /*
   * The status line. The label shimmers (transitions.dev 15) instead of
   * spinning, and carries an elapsed clock: the reasoning phase can run for
   * minutes, and a shimmer with no clock reads as a hang.
   *
   * `elapsedFrom` is set once per view, not per status change, so the count
   * spans thinking -> writing rather than resetting at the handover. The
   * counter is aria-hidden so the polite live region announces only the label.
   */
  let elapsedFrom = 0;
  let elapsedTimer = 0;

  const stopElapsed = (): void => {
    if (!elapsedTimer) return;
    clearInterval(elapsedTimer);
    elapsedTimer = 0;
  };

  const writeStatus = (text: string | null): void => {
    statusHost.replaceChildren();
    stopElapsed();
    if (text === null) return;

    if (!elapsedFrom) elapsedFrom = Date.now();
    const elapsed = el('span', 'status-elapsed');
    elapsed.setAttribute('aria-hidden', 'true');
    statusHost.append(shimmerText(text), elapsed);

    const tick = () => {
      const seconds = Math.round((Date.now() - elapsedFrom) / 1000);
      elapsed.textContent = seconds >= 1 ? `${seconds}s` : '';
    };
    tick();
    elapsedTimer = setInterval(tick, 1000) as unknown as number;
  };

  /**
   * Take the reasoning window away once the report has something to show. The
   * status line lives in its header, so that has to come home first - it is the
   * same element throughout, which is what keeps the elapsed clock running
   * across the handover instead of restarting.
   */
  const retireThinking = (): void => {
    if (!thinking) return;
    const panel = thinking.element;
    thinking.stop();
    thinking = null;
    thinkingRetired = true;
    element.insertBefore(statusHost, thinkingHost);

    if (prefersReducedMotion()) {
      panel.remove();
      return;
    }

    /*
     * Two tweens on the same clock: the t-toast close fades the panel, and the
     * host's height (plus its slot of stack rhythm) tweens to zero underneath
     * it. Without the second one the fade ends in a hard jump - the node is
     * removed, the host hits :empty { display: none }, and the report below
     * snaps up by the panel's full height in a single frame.
     */
    const ms = motionMs('--toast-close', 250);
    const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
    thinkingHost.style.blockSize = `${thinkingHost.offsetHeight}px`;
    thinkingHost.style.overflow = 'hidden';
    panel.classList.remove('is-open');
    requestAnimationFrame(() => {
      thinkingHost.style.transition = `block-size ${ms}ms ${ease}, margin-block-start ${ms}ms ${ease}`;
      thinkingHost.style.blockSize = '0px';
      thinkingHost.style.marginBlockStart = '0px';
    });
    setTimeout(() => {
      panel.remove();
      thinkingHost.removeAttribute('style');
    }, ms + 30);
  };

  const banner = (kind: 'warn' | 'calm', title: string): HTMLElement => {
    const box = el('div', `banner t-toast ${kind}`);
    requestAnimationFrame(() => box.classList.add('is-open'));
    const head = el('div', 'banner-head');
    head.appendChild(el('span', undefined, title));
    const dismiss = el('button', 'dismiss', 'Dismiss');
    dismiss.setAttribute('type', 'button');
    dismiss.addEventListener('click', () => box.remove());
    head.appendChild(dismiss);
    box.appendChild(head);
    return box;
  };

  return {
    element,

    appendThinking(text: string) {
      if (text === '' || thinkingRetired) return;
      if (!thinking) {
        thinking = createThinkingPanel();
        thinking.element.classList.add('t-toast');
        thinkingHost.appendChild(thinking.element);
        requestAnimationFrame(() => thinking?.element.classList.add('is-open'));
        /*
         * Move the live status line into the panel header rather than leaving a
         * second copy of it above. Same element, so the shimmer and the elapsed
         * clock carry across untouched - it just lives somewhere better now.
         */
        thinking.header.appendChild(statusHost);
      }
      thinking.push(text);
      // The reasoning phase can run for minutes; the panel plus this line are the
      // live feedback that replaces a blank spinner - but only until content flows.
      if (!anyText) {
        thinkingOwnsStatus = true;
        writeStatus(THINKING_STATUS);
      }
    },

    append(text: string) {
      const firstContent = !anyText && text.trim() !== '';
      if (text.trim() !== '') anyText = true;
      if (firstContent) {
        // Real report content has started: collapse the scratch work so the
        // report is the focus (still re-expandable), and hand the status line back.
        thinking?.noteContent();
        // The report is here; the reasoning window has done its job.
        retireThinking();
        if (thinkingOwnsStatus) writeStatus(WRITING_STATUS);
      }
      splitter.push(text);
      schedule();
    },

    finish() {
      streaming = false;
      thinking?.flush();
      splitter.end();
      paint();
      /*
       * The placeholder is for the one case it describes: the stream completed
       * and carried no prose. An error is a different thing entirely - it comes
       * with a reason the reader needs - so the placeholder must never stand in
       * for it, in either call order.
       */
      if (!errored && !anyText && cards.size === 0) {
        const card = ensureCard(0, null);
        card.body.textContent =
          'The generator returned no text. Nothing was written rather than something invented.';
        placeholderIndex = 0;
      }
    },

    setStatus(text: string | null) {
      writeStatus(text);
    },

    showFlatNotice() {
      if (flatNoticeShown) return;
      flatNoticeShown = true;
      const box = banner(
        'calm',
        'Your profile is too flat for this instrument to resolve structure. Here is what that means',
      );
      const body = el('div', 'banner-body');
      body.appendChild(
        el(
          'p',
          undefined,
          'Your eight scores sit close enough together that the differences between them are ' +
            'inside this instrument\'s noise. Any structure a report claimed to see here would ' +
            'be manufactured, and most of it would be true of nearly anyone. So we are not ' +
            'saying it.',
        ),
      );
      const list = el('ul');
      list.appendChild(
        el(
          'li',
          undefined,
          'A retake often moves scores by several points; a flat result can simply mean the ' +
            'questionnaire did not separate your preferences this time.',
        ),
      );
      list.appendChild(
        el(
          'li',
          undefined,
          'The 256-item Sakinorva Domains Test is finer-grained, and is a better input if you ' +
            'want more resolution.',
        ),
      );
      list.appendChild(
        el(
          'li',
          undefined,
          'A flat profile is not a deficiency, an absence of personality, or a worse result. ' +
            'It is a measurement outcome.',
        ),
      );
      body.appendChild(list);
      box.appendChild(body);
      banners.prepend(box);
    },

    showError(message: string, onRetry: () => void) {
      errored = true;
      // finish() may never run on this path, so the clock is stopped here too.
      stopElapsed();
      // Withdraw the placeholder if finish() already put one up: the error
      // explains the silence, and "returned no text" would contradict it.
      if (placeholderIndex !== null) {
        cards.get(placeholderIndex)?.card.remove();
        cards.delete(placeholderIndex);
        placeholderIndex = null;
      }
      errorCard?.remove();
      const card = el('div', 'card error-card t-toast');
      card.setAttribute('role', 'alert');
      requestAnimationFrame(() => card.classList.add('is-open'));
      card.appendChild(el('h2', 'card-title', 'That did not go through'));
      card.appendChild(el('p', 'card-sub', message));
      card.appendChild(
        el(
          'p',
          'muted',
          'Your stack signature above was computed in your browser and is unaffected.',
        ),
      );
      const retry = el('button', 'btn btn-secondary', 'Try again');
      retry.type = 'button';
      retry.addEventListener('click', () => {
        card.remove();
        errorCard = null;
        onRetry();
      });
      card.appendChild(retry);
      errorCard = card;
      banners.appendChild(card);
      streaming = false;
      caret.remove();
    },
  };
}
