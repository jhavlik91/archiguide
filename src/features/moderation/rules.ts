/**
 * Čistá pravidla nahlašování (T031). Bez DB / `next/*`, aby šla pokrýt unit testy
 * a sdílet mezi service, akcemi i UI.
 */

import {
  MESSAGE_REPORT_REASONS,
  REPORT_REASONS,
  type ReportReason,
} from "./types";

/** Je hodnota platný důvod nahlášení (z enumu)? */
export function isReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(value);
}

/** Je důvod nabízený u nahlášení zprávy? (server neakceptuje mimo tuto sadu). */
export function isMessageReportReason(value: string): value is ReportReason {
  return (MESSAGE_REPORT_REASONS as readonly string[]).includes(value);
}
