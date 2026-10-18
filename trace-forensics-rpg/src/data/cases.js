// Registry of all cases, ordered easiest → hardest.

import { CASE } from "./case01.js";
import { CASE_HOLLOW_LEDGER } from "./case02.js";

export const CASES = [CASE, CASE_HOLLOW_LEDGER];

export function getCase(id) {
  return CASES.find((c) => c.id === id) || CASES[0];
}
