/**
 * Sections 2-7 of the report (05 §5.1), streamed from the server into one
 * <wired-card> each.
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

import { applyTagChips, createTagLegend } from './tags';

/* ------------------------------------------------------------------ *
 * Section splitting
 * ------------------------------------------------------------------ */

/**
 * The exact section headings the server emits, in the order it emits them
 * (05 §5.1, sections 2-7; section 1 is code-rendered by SignatureView).
 */
export const SECTION_TITLES: readonly string[] = [
  'How your processing runs',
  'Where you are right now',
  'Under pressure',
  'Levers',
  'How this reading was made',
  'What this report cannot know',
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
 * a half-delivered "## Under pres" - or a complete "## Levers" whose newline has
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

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * <wired-spinner> is unusable in this dependency set: it draws its knob with
 * roughjs's `generator.fillPolygon`, which roughjs dropped after 4.3, so the
 * element throws inside draw() and never leaves opacity 0. (Same fault in
 * <wired-progress> and in <wired-card fill="...">, which is why no card here
 * sets `fill`.) The CSS ring below is the styled-plain-element fallback: a
 * wobbly dashed circle, in keeping with the hand-drawn look.
 */
function spinner(): HTMLElement {
  return el('span', 'spinner-fallback');
}

interface SectionCard {
  card: HTMLElement;
  heading: HTMLElement | null;
  body: HTMLElement;
  html: string;
}

export interface ReportView {
  /** The whole report block: banners, status, tag legend, section cards. */
  element: HTMLElement;
  append(text: string): void;
  finish(): void;
  setStatus(text: string | null): void;
  showAudit(violations: string[]): void;
  showFlatNotice(): void;
  showError(message: string, onRetry: () => void): void;
}

export function createReportView(): ReportView {
  const element = el('div', 'report stack-flow');
  const banners = el('div', 'stack-flow');
  const statusHost = el('div', 'status');
  statusHost.setAttribute('aria-live', 'polite');
  const legend = createTagLegend();
  const sectionHost = el('div', 'stack-flow');
  element.append(banners, statusHost, legend, sectionHost);

  const cards = new Map<number, SectionCard>();
  const caret = el('span', 'caret');
  const splitter = createSectionSplitter();
  /** The lowest card on the page, i.e. where the caret belongs. */
  let tailIndex = -1;
  /** Whether any non-blank prose has arrived at all. */
  let anyText = false;
  let streaming = true;
  let frame = 0;
  let flatNoticeShown = false;
  let errorCard: HTMLElement | null = null;
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
    const card = el('wired-card', 'report-section');
    let heading: HTMLElement | null = null;
    if (title) {
      heading = el('h2', undefined, title);
      card.appendChild(heading);
    }
    const body = el('div', 'report-body');
    card.appendChild(body);
    sectionHost.appendChild(card);
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
    frame = 0;
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

  const schedule = () => {
    if (frame) return;
    frame =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(paint)
        : (setTimeout(paint, 16) as unknown as number);
  };

  const banner = (kind: 'warn' | 'calm', title: string): HTMLElement => {
    const box = el('div', `banner ${kind}`);
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

    append(text: string) {
      if (text.trim() !== '') anyText = true;
      splitter.push(text);
      schedule();
    },

    finish() {
      streaming = false;
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
      statusHost.replaceChildren();
      if (text === null) return;
      statusHost.append(spinner(), el('span', undefined, text));
    },

    showAudit(violations: string[]) {
      if (!violations.length) return;
      const box = banner('warn', 'Automated honesty check flagged:');
      const list = el('ul');
      for (const violation of violations) list.appendChild(el('li', undefined, violation));
      box.appendChild(list);
      banners.prepend(box);
    },

    showFlatNotice() {
      if (flatNoticeShown) return;
      flatNoticeShown = true;
      const box = banner(
        'calm',
        'Your profile is too flat for this instrument to resolve structure — here’s what that means',
      );
      const body = el('div', 'banner-body');
      body.appendChild(
        el(
          'p',
          undefined,
          'Your eight scores sit close enough together that the differences between them are ' +
            'inside this instrument’s noise. Any structure a report claimed to see here would ' +
            'be manufactured, and most of it would be true of nearly anyone — so we are not ' +
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
      // Withdraw the placeholder if finish() already put one up: the error
      // explains the silence, and "returned no text" would contradict it.
      if (placeholderIndex !== null) {
        cards.get(placeholderIndex)?.card.remove();
        cards.delete(placeholderIndex);
        placeholderIndex = null;
      }
      errorCard?.remove();
      const card = el('wired-card', 'error-card');
      card.appendChild(el('h2', 'card-title', 'That did not go through'));
      card.appendChild(el('p', 'card-sub', message));
      card.appendChild(
        el(
          'p',
          'muted',
          'Your stack signature above was computed in your browser and is unaffected.',
        ),
      );
      const retry = el('wired-button', undefined, 'Try again');
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
