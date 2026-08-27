/**
 * Everything that switches with the report language (05 §5.1 headings, the
 * §5.6 disclaimer, the honest-null FLAT report, and the per-request render
 * directive). One place, so English and Indonesian cannot drift apart
 * structurally: same five headings, same disclaimer content, same FLAT facts.
 *
 * Only the READER-FACING text switches. The system prompt, the signature, the
 * render plan and the knowledge-base fragments stay English on every path -
 * that is what keeps the system prompt byte-stable for DeepSeek prefix caching.
 * The language directive rides in the user prompt, which varies per request
 * anyway.
 *
 * Zero cross-language contamination (a hard requirement): an English request
 * never sees a word of Indonesian. The static system prompt names no specific
 * language, languageDirective('en') is a single English line, and the guards
 * run English rules against the English disclaimer only. Everything Indonesian
 * lives in this module and reaches a prompt only when the request says 'id'.
 *
 * The Indonesian strings below are verbatim-contract translations of their
 * English counterparts (kb `rules.disclaimer`, assemble's REPORT_HEADINGS).
 * Editing an English original means re-translating its pair here;
 * test/language.test.ts pins the structural equivalences.
 */

import type { FunctionKey, Signature } from '../../shared/geometry';
import { DEFAULT_REPORT_LANGUAGE, type ReportLanguage } from '../../shared/language';
import { getDisclaimer } from '../kb/loader';

export { DEFAULT_REPORT_LANGUAGE, type ReportLanguage };

/* ------------------------------------------------------------------ *
 * Headings (05 §5.1, sections 2-6; section 1 is code-rendered)
 * ------------------------------------------------------------------ */

/**
 * The five headings the client's cards are keyed to, in order. Exact strings:
 * the client matches on them (ReportView SECTION_TITLES / SECTION_TITLES_ID).
 */
export const REPORT_HEADINGS_EN = [
  '## How your mind tends to work',
  '## How you handle different situations',
  '## When things get stressful',
  '## Things you can try',
  "## What this report can't tell you",
] as const;

export const REPORT_HEADINGS_ID = [
  '## Cara pikiranmu biasanya bekerja',
  '## Cara kamu menghadapi berbagai situasi',
  '## Saat keadaan penuh tekanan',
  '## Hal yang bisa kamu coba',
  '## Apa yang tidak bisa dikatakan laporan ini',
] as const;

export function headingsFor(language: ReportLanguage): readonly string[] {
  return language === 'id' ? REPORT_HEADINGS_ID : REPORT_HEADINGS_EN;
}

/* ------------------------------------------------------------------ *
 * Disclaimer (05 §5.6)
 * ------------------------------------------------------------------ */

/**
 * Verbatim Indonesian translation of kb `rules.disclaimer`. Same sentences,
 * same order, same claims. The guards recognize either language's block, and
 * stripDisclaimer needs the first and last sentences below as its markers.
 */
export const DISCLAIMER_ID =
  '**Apa ini dan apa yang bukan.** Laporan ini hanya untuk refleksi diri dan hiburan. ' +
  'Ini bukan tes psikologi. Ini bukan diagnosis. Jangan gunakan laporan ini untuk ' +
  'perekrutan kerja, penerimaan sekolah, keputusan medis, atau keputusan penting lainnya. ' +
  'Standar pengujian profesional (AERA/APA/NCME, 2014) mengatakan bahwa setiap penggunaan ' +
  'skor butuh bukti bahwa skor itu bekerja untuk penggunaan tersebut. Kami tidak punya ' +
  'bukti seperti itu di tingkat mana pun. Skormu berasal dari kuis hobi yang belum pernah ' +
  'diuji ketepatannya. Perbedaan kecil pada skormu hanyalah naik-turun acak. Orang sering ' +
  'mendapat hasil yang berbeda saat mengulang kuis ini. Ide-ide dalam laporan ini ' +
  'mencampur tulisan komunitas kepribadian yang belum teruji dengan tebakan kami sendiri. ' +
  'Kalau ada bagian yang tidak cocok dengan apa yang kamu tahu tentang dirimu, percayalah ' +
  'pada dirimu. Kalau kamu sedang melewati masa yang sulit, sebuah laporan tidak bisa ' +
  'menolong. Tenaga profesional yang berkualifikasi bisa.';

export function disclaimerFor(language: ReportLanguage): string {
  return language === 'id' ? DISCLAIMER_ID : getDisclaimer();
}

/* ------------------------------------------------------------------ *
 * The render directive (user prompt, section 5)
 * ------------------------------------------------------------------ */

/** Rule 0.5's habit table, in everyday Indonesian. Handed to the model per request. */
const PLAIN_HABITS_ID: Readonly<Record<FunctionKey, string>> = {
  Ni: 'firasat halus tentang ke mana segala sesuatu mengarah; membaca arah jangka panjang. Perkiraan yang masuk akal, bukan hal gaib',
  Ne: 'mengejar ide baru dan kemungkinan "bagaimana kalau"; melihat banyak kemungkinan',
  Si: 'bersandar pada apa yang sudah pernah berhasil; ingatan tentang cara yang biasa; rutinitas yang mantap',
  Se: 'menangkap dan bertindak pada apa yang ada tepat di depan mata; hidup di saat ini; langsung turun tangan',
  Ti: 'memikirkan sesuatu sendiri sampai masuk akal; mencari tahu kenapa; logika pribadi',
  Te: 'mengatur dan menyelesaikan pekerjaan; mengelola; menjalankan rencana',
  Fi: 'rasa dalam diri tentang apa yang terasa benar; nilai pribadi; apa yang bisa kamu bela',
  Fe: 'peka pada perasaan orang lain; membaca suasana; menjaga perasaan kelompok',
};

/**
 * The language block of the render instruction. English gets one line (the
 * default is named, never implied); Indonesian gets the full working kit:
 * register, habit names, confidence stems, the if-then template, and the
 * reminder that every quoted English phrasing is a meaning, not wording.
 */
export function languageDirective(language: ReportLanguage): string[] {
  if (language !== 'id') {
    return ['Report language: ENGLISH. Every reader-facing sentence is written in English.'];
  }
  return [
    'Report language: INDONESIAN (Bahasa Indonesia). Every reader-facing sentence is written ' +
      'in Indonesian: the five headings (exactly as listed below), all body text, every fork ' +
      'and falsifier, and the closing disclaimer block. Address the reader as "kamu", warm ' +
      'and plain, the way a kind friend talks.',
    'The signature, the render plan and the fragments above are English source material, not ' +
      'wording. Every quoted English phrasing in them ("too close to tell apart", "worth ' +
      'checking") names a meaning to express in natural everyday Indonesian, never words to ' +
      'copy or leave in English.',
    'The plain language standard applies with the same force in Indonesian: at most 15 words ' +
      'per sentence, one idea per sentence, everyday words a junior-high reader understands ' +
      'on the first read. No English loanword where a plain Indonesian word exists. No ' +
      'academic Indonesian, no psychology terms, no em-dashes, no "bukan X, melainkan Y" ' +
      'frames, and never a number, grade, or two-letter code about the person. The one place ' +
      'numbers are allowed (the short "where this came from" method note inside section 6, ' +
      'method facts only) uses Indonesian number formatting: a period for thousands, as in ' +
      '"hanya 16 dari 40.320 urutan yang mungkin".',
    'The confidence-audibility bans carry over: a community idea or guess never contains ' +
      '"penelitian", "sains", "bukti", "terbukti", or "tervalidasi" in the affirmative ' +
      '(negations like "belum pernah diuji oleh sains" are required, not banned). Never ' +
      'write "jelas", "tidak diragukan", or "ini berarti" about the person.',
    'Plain everyday Indonesian words for the eight habits (adapt to the sentence, never as a ' +
      'fixed label): ' +
      (Object.keys(PLAIN_HABITS_ID) as FunctionKey[])
        .map((fn) => `${fn} = ${PLAIN_HABITS_ID[fn]}`)
        .join(' · ') +
      '. The two-letter codes themselves never appear in the report.',
    'Confidence stems in Indonesian, one per level: established science = "Penelitian ' +
      'menemukan bahwa..."; community idea = "Beberapa penulis kepribadian mengatakan ini. ' +
      'Ini belum pernah diuji oleh sains."; stretched community idea = "Penulis kepribadian ' +
      'membicarakan hal ini di latar yang berbeda. Kami menebak ini mungkin cocok juga ' +
      'untukmu. Coba dan lihat sendiri."; our guess = "Ini sesuatu yang kami duga mungkin ' +
      'benar untukmu. Lihat apakah cocok dengan hidupmu." The first use of a community idea ' +
      'includes "belum teruji" or "belum pernah dibuktikan".',
    'The if-then template in Indonesian: "Saat [situasi sehari-hari], kamu mungkin [prediksi ' +
      'yang bisa diamati]; tapi kalau kamu melihat [pengamatan sebaliknya], itu memberi tahu ' +
      'kami [bagian tebakan ini yang perlu diperbaiki]." All three parts stay required.',
    'Gate C1\'s fixed falsifier format in Indonesian, labels included: "Prediksi: ... ' +
      'Pengamatan tandingan: kalau kamu melihat bahwa ..., tebakan ini salah. Buang saja." ' +
      'Never leave the labels in English.',
  ];
}

/* ------------------------------------------------------------------ *
 * FLAT honest-null report, Indonesian (mirrors assemble.ts's English one)
 * ------------------------------------------------------------------ */

/** Everyday Indonesian words for each habit, so the FLAT report names no bare codes. */
const PLAIN_FLAT_ID: Readonly<Record<FunctionKey, string>> = {
  Ni: 'firasatmu tentang ke mana segala sesuatu mengarah',
  Ne: 'kegemaranmu pada ide baru dan kemungkinan "bagaimana kalau"',
  Si: 'kebiasaanmu bersandar pada apa yang sudah pernah berhasil',
  Se: 'fokusmu pada apa yang ada tepat di depanmu',
  Ti: 'kebiasaanmu memikirkan sesuatu sendiri sampai masuk akal',
  Te: 'kebiasaanmu mengatur dan menyelesaikan pekerjaan',
  Fi: 'rasa dalam dirimu tentang apa yang terasa benar',
  Fe: 'kepekaanmu pada perasaan orang lain',
};

/**
 * The Indonesian FLAT report: same structure as the English builder in
 * assemble.ts (the limits heading, the honest null, the one licensed watch
 * item, next steps, the verbatim disclaimer). The provenance section was
 * removed; attribution rides the disclaimer's own community-writing line.
 */
export function buildHonestNullReportId(signature: Signature): string {
  const watch = signature.watchItem;
  const lines: string[] = [
    REPORT_HEADINGS_ID[4],
    '',
    'Kedelapan jawabanmu keluar sangat berdekatan. Perbedaan di antaranya terlalu kecil ' +
      'untuk bisa dibaca dengan jelas oleh kuis ini. Kami tidak bisa menulis laporan yang ' +
      'berguna dari hasil ini. Apa pun yang kami katakan akan berlaku untuk hampir semua orang.',
    '',
    'Kami tidak bisa mengatakan kebiasaan mana yang paling kamu andalkan, mana yang bekerja ' +
      'sama, atau mana yang kamu hindari. Semua pembacaan itu butuh perbedaan yang lebih ' +
      'besar daripada yang ditunjukkan jawabanmu. Hasil yang datar biasanya berarti kuisnya ' +
      'bekerja kurang baik, dan tiga penjelasan sama-sama mungkin: kamu mungkin memang ' +
      'berubah mengikuti situasi, kamu mungkin menjawab dekat titik tengah setiap kali, atau ' +
      'kamu mungkin terburu-buru mengisi kuis hari itu. Ini tidak mengatakan apa-apa tentang ' +
      'kemampuanmu, kesehatan batinmu, atau nilai dirimu.',
    '',
  ];

  if (watch) {
    lines.push(
      `Satu hal kecil yang layak dicatat: jarak terbesar antara dua jawabanmu adalah ` +
        `${PLAIN_FLAT_ID[watch.above]} yang berada sedikit di atas ${PLAIN_FLAT_ID[watch.below]}. ` +
        'Ini petunjuk kecil, dan bisa jadi hanya kebetulan. Kalau kamu mengulang kuis ini ' +
        'dan jaraknya membesar, itu layak dilihat lebih dekat.',
      '',
    );
  }

  lines.push(
    'Yang mungkin membantu: ulangi kuis ini di hari yang berbeda. Atau coba Sakinorva ' +
      'Domains Test yang lebih panjang (256 pertanyaan), yang bisa menangkap perbedaan ' +
      'yang lebih kecil. Keduanya memberi peluang lebih baik untuk mendapat hasil dengan ' +
      'bentuk yang jelas.',
    '',
    `> ${DISCLAIMER_ID}`,
    '',
  );

  return lines.join('\n');
}
