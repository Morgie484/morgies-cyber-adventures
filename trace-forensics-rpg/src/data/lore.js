// The D&D-flavored world bible for GREPOIRE. Data is magic; investigators
// are spellcasters of an ancient order. This lore surfaces in the title
// screen, boot sequence, character creation, quest briefings, and the codex.

export const WORLD = {
  realm: "the Archive",
  order: "the Order of the Silent Grep",
  tagline: "Where the grep meets the grimoire.",
  intro:
    "Long ago the mortal world and the digital Aether were torn apart. What " +
    "remained between them is the ARCHIVE — a boundless realm where every " +
    "secret ever written still echoes as living data. Those who learn to read " +
    "it are the Data-Mages of the Order of the Silent Grep: part detective, " +
    "part sorcerer, sworn to recover the truth that others would bury.",
};

// In-world glossary. Real forensic terms re-skinned as arcane concepts.
export const CODEX_LORE = [
  { term: "The Archive", text: "The realm between worlds where all data persists as magic. Every device is a shard of it." },
  { term: "Aether-stream", text: "A flow of network traffic. Mages 'scry' these streams to witness messages in transit (see: packet capture)." },
  { term: "Wards & Seals", text: "Encryption. A sealed scroll resists reading until a mage 'banishes' the ward (decode) or finds the key." },
  { term: "Echoes", text: "Deleted data. Nothing truly dies in the Archive; a skilled mage can call an echo back (recover)." },
  { term: "Sigils", text: "Cryptographic hashes. A file's true-name sigil never changes unless the file is tampered with (sha256/verify)." },
  { term: "Revenant records", text: "Tampered logs. A forged line is a lie given false life — spot it by a broken sigil." },
  { term: "The Silent Grep", text: "The founding spell of the Order: to search all that is written and let only the truth answer." },
];

// The five arcane disciplines (your character stats, re-flavored).
export const DISCIPLINES = {
  LOGIC: { school: "Divination", flavor: "unraveling ciphers and seeing cause from effect" },
  PERCEPTION: { school: "Clairvoyance", flavor: "spotting echoes, forgeries, and hidden sigils" },
  TECH: { school: "Artifice", flavor: "wielding arcane tools and bending seals without shattering them" },
  SOCIAL: { school: "Enchantment", flavor: "reading hearts and loosening guarded tongues" },
  COMPOSURE: { school: "Abjuration", flavor: "holding your mind steady against traps and dread" },
};

// Factions of the Archive — texture for the codex and future quests.
export const FACTIONS = [
  { name: "The Order of the Silent Grep", align: "Lawful Good", text: "Keepers of truth. Your order. They commission the quests you take." },
  { name: "The Null Choir", align: "Chaotic Evil", text: "Cultists who worship deletion and the void. They scrub records and raise revenants." },
  { name: "The Cipher Guild", align: "True Neutral", text: "Mercenary cryptomancers. They'll seal anything for a price — ward-smiths without loyalty." },
  { name: "The Hollow Court", align: "Lawful Evil", text: "Aristocrats who trade in stolen secrets. Patrons of many a quiet betrayal." },
];

// Spell-flavored aliases → the real forensic command they cast.
export const SPELL_ALIASES = {
  scry: "scan",        // reveal echoes & hidden sigils
  banish: "decode",    // break a ward/seal
  commune: "stats",    // commune with your own spirit (view sheet)
  reveal: "ls",
  divine: "sha256",    // read a true-name sigil
  mend: "recover",     // call an echo back
  behold: "cat",
};

// Rank titles earned by level — gives leveling a D&D progression feel.
export function rankTitle(level) {
  const ranks = [
    "Initiate",        // 1
    "Apprentice Scribe", // 2
    "Journeyman Scryer", // 3
    "Adept of the Grep", // 4
    "Ward-Breaker",      // 5
    "Archivist",         // 6
    "Master Diviner",    // 7
    "Keeper of Echoes",  // 8
    "Grand Magus of the Archive", // 9+
  ];
  return ranks[Math.min(level - 1, ranks.length - 1)] || ranks[0];
}
