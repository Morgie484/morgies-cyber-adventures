// Registry of all cases, ordered easiest → hardest.

import { CASE } from "./case01.js";
import { CASE_HOLLOW_LEDGER } from "./case02.js";
import { CASE_SILENT_QUORUM } from "./case03.js";

export const CASES = [CASE, CASE_HOLLOW_LEDGER, CASE_SILENT_QUORUM];

export function getCase(id) {
  return CASES.find((c) => c.id === id) || CASES[0];
}
