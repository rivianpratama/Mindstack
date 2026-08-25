/**
 * Epistemic tags (00 legend, 05 §5.3).
 *
 * The model prefixes tagged claims with a bare [S] / [D] / [D->H] / [H] marker.
 * The client swaps those markers for chips and prints one persistent legend, so
 * the reader can rank the confidence of every claim without reading the docs.
 *
 * `applyTagChips` runs on ALREADY-ESCAPED html (see ReportView.renderMarkdown):
 * the markers contain no HTML-special characters, and nothing this app emits
 * puts a square bracket inside a tag or attribute, so the substitution cannot
 * reach into markup.
 */

export type TagId = 'S' | 'D' | 'D->H' | 'H';

export interface TagTier {
  id: TagId;
  /** What the chip prints. */
  label: string;
  /** CSS class carrying the colour. */
  cls: string;
  /** The one-line gloss in the legend card. */
  short: string;
  gloss: string;
}

export const TAG_TIERS: readonly TagTier[] = [
  {
    id: 'S',
    label: '[S]',
    cls: 'tag tag-s',
    short: 'cited science',
    gloss: 'An established finding, cited to its source - the sturdiest thing here.',
  },
  {
    id: 'D',
    label: '[D]',
    cls: 'tag tag-d',
    short: 'typology folklore, unvalidated',
    gloss: 'Taken from typology writers, attributed but never scientifically validated.',
  },
  {
    id: 'D->H',
    label: '[D→H]',
    cls: 'tag tag-dh',
    short: 'folklore, generalized by us',
    gloss: 'A typology idea we stretched past what its source actually claimed.',
  },
  {
    id: 'H',
    label: '[H]',
    cls: 'tag tag-h',
    short: 'our hypothesis',
    gloss: 'Our own speculation - plausible, unproven, offered for you to test.',
  },
];

const CHIP_OF: Record<string, TagTier> = {
  S: TAG_TIERS[0],
  D: TAG_TIERS[1],
  'D->H': TAG_TIERS[2],
  H: TAG_TIERS[3],
};

/*
 * The arrow reaches us as a literal U+2192, as '->' or as '-&gt;' (escapeHtml
 * has already run on '>'). Longest alternatives first so [D->H] never matches
 * as a bare [D].
 */
const TAG_PATTERN = /\[(D(?:→|->|-&gt;)H|S|D|H)\]/g;

function chipHtml(tier: TagTier): string {
  return `<span class="${tier.cls}" title="${tier.short}">${tier.label}</span>`;
}

/** Swap every inline marker in an escaped-HTML string for its chip. */
export function applyTagChips(escapedHtml: string): string {
  return escapedHtml.replace(TAG_PATTERN, (match, body: string) => {
    const key = body.replace(/→|-&gt;|->/, '->');
    const tier = CHIP_OF[key];
    return tier ? chipHtml(tier) : match;
  });
}

/** The persistent legend card that sits above the streamed report. */
export function createTagLegend(): HTMLElement {
  const card = document.createElement('wired-card');
  card.className = 'legend-card';

  const title = document.createElement('h2');
  title.className = 'card-title';
  title.textContent = 'How sure is each claim?';
  card.appendChild(title);

  const sub = document.createElement('p');
  sub.className = 'card-sub';
  sub.textContent =
    'Every tagged sentence below carries exactly one of these four confidence tiers.';
  card.appendChild(sub);

  const list = document.createElement('dl');
  list.className = 'legend-list';

  for (const tier of TAG_TIERS) {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const term = document.createElement('dt');
    term.innerHTML = chipHtml(tier);

    const def = document.createElement('dd');
    def.style.margin = '0';
    const strong = document.createElement('b');
    strong.textContent = tier.short;
    def.appendChild(strong);
    def.appendChild(document.createTextNode(` — ${tier.gloss}`));

    item.append(term, def);
    list.appendChild(item);
  }

  card.appendChild(list);
  return card;
}
