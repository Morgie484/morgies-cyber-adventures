// QUEST #8842 — "The Whispering Aether" (EXPERT)
// Commissioned by the Order of the Silent Grep. A rogue Data-Mage is
// smuggling stolen secrets out of a merchant-guild's citadel by hiding them
// inside ordinary-looking aether-streams (network traffic). Scry the capture,
// follow the tainted flow, break its ward, and name the Null Choir contact.

import { VDir, VFile } from "../engine/filesystem.js";

// ---- Device 1: Guild gateway (the capture lives here) ----
function buildGateway() {
  const root = new VDir("~");
  const captures = new VDir("captures");

  // A simulated packet capture. Most traffic is benign; one HTTPS flow to a
  // strange host carries a base64 payload (the exfiltration).
  const packets = [
    { time: "20:01:02", src: "10.2.0.5", dst: "10.2.0.1", proto: "DNS", info: "A guild-ledger.local" },
    { time: "20:01:03", src: "10.2.0.5", dst: "93.184.0.7", proto: "TLS", info: "ClientHello guild-ledger" },
    { time: "20:02:40", src: "10.2.0.9", dst: "10.2.0.1", proto: "DNS", info: "A updates.service" },
    { time: "20:14:55", src: "10.2.0.9", dst: "45.77.13.2", proto: "DNS", info: "A whisper.nullchoir.aether", flag: true },
    {
      time: "20:14:56", src: "10.2.0.9", dst: "45.77.13.2", proto: "HTTP", flag: true,
      info: "POST /drop  (unusual: large body to unknown host)",
      // The payload is base64 — player follows the stream, then 'decode's it.
      payload:
        "POST /drop HTTP/1.1\nHost: whisper.nullchoir.aether\nX-Courier: m.falk\n\n" +
        btoa("MANIFEST: guild vault runes + patron ledger. buyer: The Hollow Court. courier: M. Falk."),
    },
    { time: "20:15:10", src: "10.2.0.5", dst: "93.184.0.7", proto: "TLS", info: "ApplicationData (benign)" },
  ];
  captures.add(new VFile({ name: "gateway.pcap", tag: "ev_capture", packets, content: "[binary pcap — use 'pcap gateway.pcap']" }));
  captures.add(new VFile({ name: "readme.txt", content: "Border-gate aether tap. The Order suspects a courier within the guild." }));
  root.add(captures);
  return { host: "GUILD-GATE", label: "Guild Gateway", root };
}

// ---- Device 2: The suspect courier's scrying-stone (workstation) ----
function buildCourier() {
  const root = new VDir("~");
  const chest = new VDir("chest");
  chest.add(new VFile({
    name: "oath.txt",
    content: "I, Malric Falk, courier of the merchant-guild, swear loyalty to the Hollow Court.\n(This oath should not exist.)",
    hidden: true,
    tag: "ev_oath",
  }));
  // A sealed scroll (encrypted) confirming the dead-drop host.
  const sealed = btoa("dead-drop ward: whisper.nullchoir.aether accepts the manifest. - M.F.");
  chest.add(new VFile({ name: "ward_scroll.enc", locked: true, tag: "ev_scroll", content: sealed }));
  root.add(chest);
  return { host: "FALK-STONE", label: "Courier's Scrying-Stone", root };
}

export const CASE_WHISPERING_AETHER = {
  id: "8842",
  name: "Song of the Null Choir",
  difficulty: "EXPERT",
  dcBonus: 6,
  reward: 350,
  questGiver: "Archivist Vess of the Silent Grep",
  brief:
    "The Order of the Silent Grep commissions you, Data-Mage: a courier within " +
    "the merchant-guild is smuggling vault-runes to the Null Choir, hidden inside " +
    "innocent aether-streams. Scry the gateway capture, follow the tainted flow, " +
    "banish its ward, and name both the courier and the buyer.",
  loreIntro:
    "Archivist Vess presses a scrying-shard into your palm. \"The guild's border-gate " +
    "keeps an aether-tap. Somewhere in that river of whispers, one voice carries stolen " +
    "secrets. Find it. The Choir must not feed.\"",

  npcs: {
    vess: {
      name: "Archivist Vess (quest-giver)",
      lines: {
        start: {
          text: "\"Data-Mage. The capture is on GUILD-GATE, in /captures. Scry it with the aether-sight — 'pcap gateway.pcap'. One flow will not sit right. Follow it, and banish whatever ward guards its cargo.\"",
          options: [
            { text: "How will I know the courier?", dc: 14, stat: "SOCIAL", to: "hint" },
            { text: "(Bow and depart)", to: null },
          ],
        },
        hint: {
          text: "\"The tainted flow will name its courier in the headers. Cross it with what you find on their scrying-stone. The Choir always leaves a signature — pride is their weakness.\"",
          options: [{ text: "It shall be done.", to: null }],
          reward: { note: "Vess: scry gateway.pcap, follow the odd flow, then match the courier name to their stone (FALK-STONE)." },
        },
      },
    },
    falk: {
      name: "Malric Falk (courier)",
      lines: {
        start: {
          text: "Falk's hand drifts toward a hidden ward-sigil. \"I carry parcels. That is all a courier does.\"",
          options: [
            { text: "Confront: the aether-stream named you, and your oath to the Hollow Court is sealed in your chest. (needs both)", requires: "ev_capture", requires2: "ev_oath", dc: 19, stat: "SOCIAL", to: "crack" },
            { text: "(Leave)", to: null },
          ],
        },
        crack: {
          text: "The sigil fizzles; Falk sags. \"...The Choir promised me a seat in the Hollow Court. I only had to whisper the vault-runes into the river. You were never meant to hear them.\" A confession.",
          options: [{ text: "The Archive hears everything.", to: null }],
          reward: { note: "Falk confessed: smuggled vault-runes to the Null Choir, promised a place in the Hollow Court." },
        },
      },
    },
  },

  questions: [
    {
      id: "courier",
      prompt: "WHO is the courier smuggling the secrets?",
      options: ["Archivist Vess", "Malric Falk", "An outside raider", "The guild-master"],
      answer: "Malric Falk",
    },
    {
      id: "method",
      prompt: "HOW were the secrets exfiltrated?",
      options: [
        "Carried out on horseback",
        "Hidden in an HTTP POST to an unknown host in the aether-stream",
        "Whispered to a spy in person",
        "Burned into a crystal",
      ],
      answer: "Hidden in an HTTP POST to an unknown host in the aether-stream",
    },
    {
      id: "host",
      prompt: "Which host received the tainted flow?",
      options: ["guild-ledger.local", "updates.service", "whisper.nullchoir.aether", "93.184.0.7"],
      answer: "whisper.nullchoir.aether",
    },
    {
      id: "buyer",
      prompt: "WHO was buying the stolen vault-runes?",
      options: ["The Cipher Guild", "The Hollow Court", "The Order of the Silent Grep", "No one — it was personal"],
      answer: "The Hollow Court",
    },
  ],

  devices: {
    "GUILD-GATE": buildGateway(),
    "FALK-STONE": buildCourier(),
  },
};
