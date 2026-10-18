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

// Backgrounds are your CLASS in the Order of the Silent Grep. Each sets a
// starting discipline spread (point-buy baseline of 10) and a signature boon.
// `name` is the mythic class title; `role` is the mortal-world origin flavor.
export const BACKGROUNDS = {
  "ex-law": {
    name: "Warden of Seals",
    role: "Once a cybercrime investigator; now sworn to guard the truth.",
    blurb: "A paladin of procedure. Every artifact you seal is unbreakable in the Order's eyes.",
    stats: { LOGIC: 12, PERCEPTION: 14, TECH: 10, SOCIAL: 13, COMPOSURE: 11 },
    perk: "Chain of Custody: evidence you seal can never be challenged.",
    perkId: "chain_of_custody",
  },
  "black-hat": {
    name: "Shadow Revenant",
    role: "A former breaker of wards who turned to the Order's light.",
    blurb: "You once served the Null Choir. You still think like the hand that strikes.",
    stats: { LOGIC: 13, PERCEPTION: 11, TECH: 15, SOCIAL: 9, COMPOSURE: 12 },
    perk: "Insider's Eye: +2 on checks to understand attacker tooling.",
    perkId: "insiders_eye",
  },
  "academic": {
    name: "Rune-Scholar",
    role: "A cloistered cryptomancer drawn into the field by the Order.",
    blurb: "Theory before instinct. Ciphers unknot themselves beneath your gaze.",
    stats: { LOGIC: 15, PERCEPTION: 12, TECH: 11, SOCIAL: 10, COMPOSURE: 12 },
    perk: "First Principles: +2 on cryptanalysis and decoding checks.",
    perkId: "first_principles",
  },
  "seer": {
    name: "Aether-Seer",
    role: "A clairvoyant who reads the streams between worlds.",
    blurb: "You see what others miss — the faint echo, the forged line, the whisper in the traffic.",
    stats: { LOGIC: 11, PERCEPTION: 16, TECH: 11, SOCIAL: 10, COMPOSURE: 12 },
    perk: "Second Sight: +2 on scrying checks (scan / traffic analysis).",
    perkId: "second_sight",
  },
  "bard": {
    name: "Silver-Tongue Bard",
    role: "A wandering loremonger who loosens any guarded tongue.",
    blurb: "Doors open and suspects crack when you speak. Your weakness is the raw arcana.",
    stats: { LOGIC: 10, PERCEPTION: 11, TECH: 9, SOCIAL: 16, COMPOSURE: 14 },
    perk: "Honeyed Words: +2 on all SOCIAL checks when confronting a suspect.",
    perkId: "honeyed_words",
  },
  "artificer": {
    name: "Clockwork Artificer",
    role: "A tinker-mage who bends arcane tools to their will.",
    blurb: "No ward survives your instruments, no echo stays buried. Steady hands, steadier nerves.",
    stats: { LOGIC: 12, PERCEPTION: 11, TECH: 15, SOCIAL: 9, COMPOSURE: 13 },
    perk: "Master's Tools: +2 on TECH checks (recover / reassemble streams).",
    perkId: "masters_tools",
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
  // Boon (perk) bonuses, keyed to the check's context tag.
  if (character.perkId === "insiders_eye" && context.tag === "attacker-tooling") mod += 2;
  if (character.perkId === "first_principles" && context.tag === "crypto") mod += 2;
  if (character.perkId === "second_sight" && context.tag === "scan") mod += 2;
  if (character.perkId === "honeyed_words" && context.tag === "social") mod += 2;
  if (character.perkId === "masters_tools" && context.tag === "recover") mod += 2;
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
