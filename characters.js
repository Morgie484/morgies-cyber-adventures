/* =========================================================================
   CipherTrace — Playable agents
   Each character gives a small gameplay perk, encouraging replay with
   different strategies. Perks are applied in game.js.

   Character shape:
   {
     id, name, icon, title, blurb,
     perk: {
       bonusLives:   extra lives added at run start (int)
       timeMult:     multiplier on each mission timer (e.g. 1.25 = +25% time)
       scoreMult:    multiplier on points earned (e.g. 1.1 = +10%)
       label:        short human-readable perk description
     }
   }
   ========================================================================= */

const CHARACTERS = [
  {
    id: "cipher",
    name: "NOVA",
    icon: "🧠",
    title: "The Cryptographer",
    blurb: "Lives and breathes ciphers. Scores big when the answer is right.",
    perk: { bonusLives: 0, timeMult: 1.0, scoreMult: 1.2, label: "+20% score" },
  },
  {
    id: "trace",
    name: "RAVEN",
    icon: "🕵️",
    title: "The Investigator",
    blurb: "Methodical and patient. Takes extra time to pick evidence apart.",
    perk: { bonusLives: 0, timeMult: 1.3, scoreMult: 1.0, label: "+30% time" },
  },
  {
    id: "ghost",
    name: "ECHO",
    icon: "🛡️",
    title: "The Survivor",
    blurb: "Hard to knock out. Starts every run with an extra life.",
    perk: { bonusLives: 2, timeMult: 1.0, scoreMult: 1.0, label: "+2 lives" },
  },
  {
    id: "flux",
    name: "ZERO",
    icon: "⚡",
    title: "The All-Rounder",
    blurb: "Balanced across the board — a little more of everything.",
    perk: { bonusLives: 1, timeMult: 1.1, scoreMult: 1.1, label: "+1 life · +10% time · +10% score" },
  },
];
