/**
 * The report-language wire contract, shared by the form (which offers the
 * choice), the request body (which carries it), and the server (which writes
 * the report in it).
 *
 * This decides the language of the GENERATED REPORT only. The surrounding UI,
 * Section 1's code-rendered signature, and every instruction handed to the
 * model stay English; see src/server/prompt/language.ts for what switches.
 */

export const REPORT_LANGUAGES = ['en', 'id'] as const;

export type ReportLanguage = (typeof REPORT_LANGUAGES)[number];

export const DEFAULT_REPORT_LANGUAGE: ReportLanguage = 'en';

export function isReportLanguage(value: unknown): value is ReportLanguage {
  return typeof value === 'string' && (REPORT_LANGUAGES as readonly string[]).includes(value);
}
