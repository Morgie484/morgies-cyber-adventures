// CASE #4471 — "Operation Nightjar" (tutorial case)
// A beginner-friendly investigation: company data was leaked. Find out
// WHO did it, HOW the data left, and WHEN it happened.
//
// The case is designed to teach one forensic idea per location:
//   1. Apartment workstation  -> files, hidden files, recovering deleted files
//   2. Office server          -> logs & timelines, hashing/verification
//   3. Data center            -> decoding, tying it all together

import { VDir, VFile } from "../engine/filesystem.js";
import { pseudoSha256 } from "../engine/crypto.js";

// ---- Device 1: Suspect's home workstation ----
function buildWorkstation() {
  const root = new VDir("~");
  const docs = new VDir("Documents");
  docs.add(new VFile({ name: "resume.txt", content: "Jordan Vale — Senior Network Engineer\n10 years at Meridian Dynamics." }));
  docs.add(new VFile({
    name: "notes.txt",
    hidden: true,
    tag: "ev_grudge",
    content: "They passed me over for the promotion AGAIN.\nFine. If I can't have the lead role, the client list is worth a lot to the right buyer.\n- J",
  }));
  docs.add(new VFile({
    name: "client_list.csv",
    deleted: true,
    tag: "ev_clientlist",
    content: "company,contract_value\nAcme Corp,2400000\nGlobex,1800000\nInitech,950000",
  }));

  const downloads = new VDir("Downloads");
  downloads.add(new VFile({ name: "cat_meme.jpg", content: "\x89PNG\r\n\x1a\n...just a cat picture..." }));
  downloads.add(new VFile({
    name: "exfil_tool.bin",
    tag: "ev_tool",
    content: "\x7fELF\x02\x01uploader v2 --dest nightjar.onion AUTH=J.Vale compiled-by-attacker",
  }));

  root.add(docs);
  root.add(downloads);
  return { host: "JVALE-HOME", label: "Vale's Apartment", root };
}

// ---- Device 2: Office file server ----
function buildServer() {
  const root = new VDir("~");
  const logs = new VDir("logs");
  logs.add(new VFile({
    name: "access.log",
    tag: "ev_accesslog",
    content:
      "02:14 login user=m.ortiz OK\n" +
      "02:16 login user=s.kim OK\n" +
      "03:47 login user=j.vale OK  (unusual: outside work hours)\n" +
      "03:49 download client_list.csv by j.vale (14.2 MB)\n" +
      "03:51 upload -> external host nightjar.onion by j.vale\n" +
      "08:30 login user=m.ortiz OK",
  }));
  const share = new VDir("share");
  // A real file + its known-good hash record, to teach verify.
  const original = "company,contract_value\nAcme Corp,2400000\nGlobex,1800000\nInitech,950000";
  share.add(new VFile({ name: "client_list.csv", content: original }));
  share.add(new VFile({
    name: "client_list.csv.sha256",
    content: pseudoSha256(original) + "  client_list.csv",
  }));
  root.add(logs);
  root.add(share);
  return { host: "MERIDIAN-FS01", label: "Meridian Office", root };
}

// ---- Device 3: Seized relay node (data center) ----
function buildRelay() {
  const root = new VDir("~");
  // ROT13 of a readable confession-ish payload.
  const plain = "destination buyer: GLOBEX RIVAL. payment to wallet of j.vale. handoff complete.";
  const rot13 = plain.replace(/[a-z]/gi, (ch) => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + 13) % 26) + base);
  });
  root.add(new VFile({ name: "payload.enc", locked: true, tag: "ev_payload", content: rot13 }));
  root.add(new VFile({ name: "readme.txt", content: "nightjar relay node. traffic forwarded. logs wiped (mostly)." }));
  return { host: "NIGHTJAR-RELAY", label: "Data Center", root };
}

export const CASE = {
  id: "4471",
  name: "Operation Nightjar",
  difficulty: "TUTORIAL",
  dcBonus: 0,
  brief:
    "Meridian Dynamics' confidential client list leaked to a competitor. " +
    "Three locations are open to you. Collect evidence, then name the culprit.",

  // NPCs for the dialogue/SOCIAL system.
  npcs: {
    ortiz: {
      name: "M. Ortiz (IT Admin)",
      lines: {
        start: {
          text: "Ortiz looks exhausted. \"I reported the leak. Our client list ended up with a competitor. I don't know who did it — but it happened overnight.\"",
          options: [
            { text: "Who had access overnight?", dc: 10, stat: "SOCIAL", to: "access" },
            { text: "(Leave)", to: null },
          ],
        },
        access: {
          text: "\"Only engineers have after-hours access. Check the server logs — FS01. The login times don't lie.\"",
          options: [{ text: "Thanks.", to: null }],
          reward: { note: "Ortiz: check server FS01 access logs for overnight logins." },
        },
      },
    },
    vale: {
      name: "J. Vale (Suspect)",
      lines: {
        start: {
          text: "Vale is defensive. \"I didn't touch that client list. You've got nothing on me.\"",
          options: [
            { text: "Confront with the 3:47am login. (needs evidence)", requires: "ev_accesslog", dc: 14, stat: "SOCIAL", to: "crack" },
            { text: "(Leave)", to: null },
          ],
        },
        crack: {
          text: "Vale's confidence drops. \"...Fine. They owed me. The company made millions off my work and gave me nothing.\" — a confession.",
          options: [{ text: "That's all I need.", to: null }],
          reward: { note: "Vale confessed when confronted with the 3:47am login evidence." },
        },
      },
    },
  },

  // The questions the player answers on the evidence board to solve the case.
  questions: [
    {
      id: "who",
      prompt: "WHO leaked the client list?",
      options: ["M. Ortiz", "S. Kim", "J. Vale", "An outside hacker"],
      answer: "J. Vale",
    },
    {
      id: "how",
      prompt: "HOW did the data leave the network?",
      options: [
        "Printed on paper",
        "Uploaded to an external host (nightjar.onion)",
        "Emailed to a personal account",
        "Copied to a USB drive",
      ],
      answer: "Uploaded to an external host (nightjar.onion)",
    },
    {
      id: "when",
      prompt: "WHEN did the exfiltration happen?",
      options: ["08:30", "02:14", "03:51", "12:00"],
      answer: "03:51",
    },
  ],

  devices: {
    "JVALE-HOME": buildWorkstation(),
    "MERIDIAN-FS01": buildServer(),
    "NIGHTJAR-RELAY": buildRelay(),
  },
};
