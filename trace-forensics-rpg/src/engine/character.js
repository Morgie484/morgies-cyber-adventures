// Character model — stats, backgrounds, XP/leveling, inventory.

import { statModifier } from "./dice.js";

export const STATS = ["LOGIC", "PERCEPTION", "TECH", "SOCIAL", "COMPOSURE"];

export const STAT_DESC = {
  LOGIC: "Reverse engineering, cryptanalysis, deduction.",
  PERCEPTION: "Spotting hidden, deleted, or tampered artifacts.",
  TECH: "Wielding advanced tools and exploits without breaking things.",
  SOCIAL: "Interrogation, social engineering, reading people.",
  COMPOSURE: "Holding steady under time pressure and traps.",
};

// Backgrounds set a starting stat spread (point-buy baseline of 10 each,
// with a themed +/- distribution) and grant a signature perk.
export const BACKGROUNDS = {
  "ex-law": {
    name: "Ex-Law Enforcement",
    blurb: "You worked cybercrime at the Bureau. Procedure is second nature.",
    stats: { LOGIC: 12, PERCEPTION: 14, TECH: 10, SOCIAL: 13, COMPOSURE: 11 },
    perk: "Chain of Custody: evidence you log can never be challenged.",
    perkId: "chain_of_custody",
  },
  "black-hat": {
    name: "Black-Hat Turncoat",
    blurb: "You used to be on the other side. You know how they think.",
    stats: { LOGIC: 13, PERCEPTION: 11, TECH: 15, SOCIAL: 9, COMPOSURE: 12 },
    perk: "Insider's Eye: +2 on checks to understand attacker tooling.",
    perkId: "insiders_eye",
  },
  "academic": {
    name: "Academic Cryptographer",
    blurb: "A researcher pulled into the field. Theory over instinct.",
    stats: { LOGIC: 15, PERCEPTION: 12, TECH: 11, SOCIAL: 10, COMPOSURE: 12 },
    perk: "First Principles: +2 on cryptanalysis and decoding checks.",
    perkId: "first_principles",
  },
};

const XP_PER_LEVEL = 100;

export function createCharacter(name, backgroundId) {
  const bg = BACKGROUNDS[backgroundId];
  if (!bg) throw new Error(`Unknown background: ${backgroundId}`);
  return {
    name: name || "Investigator",
    background: backgroundId,
    backgroundName: bg.name,
    perk: bg.perk,
    perkId: bg.perkId,
    stats: { ...bg.stats },
    level: 1,
    xp: 0,
    statPoints: 0, // awarded on level up
    inventory: [],
    evidence: [],
    notes: [],
  };
}

export function modFor(character, stat, context = {}) {
  let mod = statModifier(character.stats[stat]);
  // Perk bonuses.
  if (character.perkId === "insiders_eye" && context.tag === "attacker-tooling") mod += 2;
  if (character.perkId === "first_principles" && context.tag === "crypto") mod += 2;
  return mod;
}

export function grantXP(character, amount) {
  character.xp += amount;
  const leveledUp = [];
  while (character.xp >= character.level * XP_PER_LEVEL) {
    character.xp -= character.level * XP_PER_LEVEL;
    character.level += 1;
    character.statPoints += 2;
    leveledUp.push(character.level);
  }
  return leveledUp;
}

export function spendStatPoint(character, stat) {
  if (character.statPoints <= 0) return false;
  if (!STATS.includes(stat)) return false;
  if (character.stats[stat] >= 20) return false;
  character.stats[stat] += 1;
  character.statPoints -= 1;
  return true;
}

export function addEvidence(character, evidence) {
  if (character.evidence.find((e) => e.id === evidence.id)) return false;
  character.evidence.push(evidence);
  return true;
}

export function addItem(character, item) {
  character.inventory.push(item);
}

export function hasItem(character, itemId) {
  return character.inventory.some((i) => i.id === itemId);
}
