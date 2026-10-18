// CASE #7013 — "Silent Quorum" (EXPERT)
// A hospital network is hit with ransomware. The obvious suspect (a recently
// fired admin) looks guilty — but the real culprit framed them. This case
// rewards careful work: a DECOY trail, a tampered log, double-encoded data,
// and a confession gated behind TWO pieces of evidence.

import { VDir, VFile } from "../engine/filesystem.js";
import { pseudoSha256 } from "../engine/crypto.js";

// ---- Device 1: Infected ward workstation ----
function buildWard() {
  const root = new VDir("~");
  const desktop = new VDir("Desktop");
  desktop.add(new VFile({
    name: "RESTORE_FILES.txt",
    tag: "ev_ransomnote",
    content:
      "Your files are encrypted. Pay 40 BTC to wallet bc1-QUORUM.\n" +
      "Signed: THE SILENT QUORUM\n" +
      "(forensic note: tooling signature matches an INSIDER build, not a known gang)",
  }));
  // A DECOY: planted file pointing at the fired admin. Looks damning...
  desktop.add(new VFile({
    name: "logout_dale.bat",
    tag: "ev_decoy",
    content: "REM leftover from D.Mercer account\n:: NOTE: timestamps here were BACKDATED — see auth log",
  }));
  const sys = new VDir("System");
  // Deleted dropper, recoverable; names the real staging host.
  sys.add(new VFile({
    name: "dropper.tmp",
    deleted: true,
    tag: "ev_dropper",
    content: "staged from host CARE-DB03 by account svc_backup at 02:11. payload=quorum.bin",
  }));
  root.add(desktop);
  root.add(sys);
  return { host: "WARD-PC14", label: "Ward Workstation", root };
}

// ---- Device 2: Domain controller (the tampered-log twist) ----
function buildDC() {
  const root = new VDir("~");
  const logs = new VDir("logs");
  // Recorded hash is for the ORIGINAL log; the present log was edited to frame Mercer.
  const original =
    "01:58 svc_backup login FROM CARE-DB03\n" +
    "02:11 svc_backup spawned quorum.bin\n" +
    "02:12 svc_backup disabled shadow copies\n" +
    "02:40 svc_backup logoff";
  const tampered = original + "\n02:45 d.mercer login (INSERTED — mercer was deactivated weeks ago)";
  logs.add(new VFile({ name: "security.log", tag: "ev_tamperedlog", content: tampered }));
  logs.add(new VFile({ name: "security.log.sha256", content: pseudoSha256(original) + "  security.log" }));
  // Who really holds svc_backup? Double-encoded (base64 of ROT13).
  const plain = "svc_backup controlled by Dr. A. Okafor. motive: covering a data-sale to pharma broker.";
  const rot13 = plain.replace(/[a-z]/gi, (ch) => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + 13) % 26) + base);
  });
  logs.add(new VFile({ name: "whois_svc.enc", locked: true, tag: "ev_whois", content: btoa(rot13) }));
  root.add(logs);
  return { host: "CARE-DC01", label: "Domain Controller", root };
}

// ---- Device 3: Staging database server ----
function buildStaging() {
  const root = new VDir("~");
  const tmp = new VDir("tmp");
  tmp.add(new VFile({
    name: "quorum.bin",
    tag: "ev_payload3",
    content: "\x7fELF quorum ransomware build. compiled_on=CARE-DB03 author_env=USER=a.okafor",
  }));
  tmp.add(new VFile({ name: "notes.txt", hidden: true, content: "remember to wipe build env (USER var leaks identity!)" }));
  root.add(tmp);
  return { host: "CARE-DB03", label: "Staging DB", root };
}

export const CASE_SILENT_QUORUM = {
  id: "7013",
  name: "The Masque of the Revenant",
  difficulty: "EXPERT",
  dcBonus: 7, // hardest checks in the game
  reward: 400,
  brief:
    "Ransomware crippled a hospital network. A recently fired admin (D. Mercer) " +
    "looks guilty — maybe too guilty. Separate the frame-up from the facts: catch " +
    "the tampered log, recover the dropper, trace the service account, and unmask " +
    "the insider who signed their own build.",

  npcs: {
    ciso: {
      name: "CISO Nwosu",
      lines: {
        start: {
          text: "\"Everyone's pointing at Mercer — fired last month, and there's a login under his name at 02:45. But something's off. If you can PROVE the log was altered, I'll authorize deeper access.\"",
          options: [
            { text: "How would I prove tampering?", dc: 16, stat: "LOGIC", to: "hint" },
            { text: "(Leave)", to: null },
          ],
        },
        hint: {
          text: "\"On CARE-DC01, compare security.log to its recorded .sha256. If it doesn't match, the Mercer line was inserted — a frame-up.\"",
          options: [{ text: "On it.", to: null }],
          reward: { note: "CISO: verify security.log on CARE-DC01 — a hash mismatch proves the Mercer login was faked." },
        },
      },
    },
    mercer: {
      name: "D. Mercer (fired admin)",
      lines: {
        start: {
          text: "\"I was HOME. I don't even have an active account anymore! Someone's setting me up. Check the real service account — svc_backup. That's not me.\"",
          options: [
            { text: "I believe you — the log was altered. (needs tampered-log proof)", requires: "ev_tamperedlog", dc: 14, stat: "SOCIAL", to: "ally" },
            { text: "(Leave)", to: null },
          ],
        },
        ally: {
          text: "\"Finally. svc_backup runs the nightly jobs — only a couple of senior clinicians can trigger it manually. Follow THAT.\"",
          options: [{ text: "Thank you.", to: null }],
          reward: { note: "Mercer (cleared): svc_backup is the real actor; only senior clinicians can run it manually." },
        },
      },
    },
    okafor: {
      name: "Dr. A. Okafor",
      lines: {
        start: {
          text: "Okafor is calm, almost rehearsed. \"Terrible business. Mercer always was careless.\"",
          options: [
            { text: "Confront: svc_backup is yours, and quorum.bin was built under USER=a.okafor. (needs BOTH)", requires: "ev_whois", requires2: "ev_payload3", dc: 20, stat: "SOCIAL", to: "crack" },
            { text: "(Leave)", to: null },
          ],
        },
        crack: {
          text: "The composure cracks. \"...You pulled the build environment. I thought I wiped it.\" Okafor confesses — the ransomware was cover for selling patient data to a pharma broker.",
          options: [{ text: "The quorum wasn't so silent.", to: null }],
          reward: { note: "Okafor confessed: ransomware was cover for a patient-data sale; framed Mercer via a forged log line." },
        },
      },
    },
  },

  questions: [
    {
      id: "culprit",
      prompt: "WHO is the real culprit?",
      options: ["D. Mercer", "Dr. A. Okafor", "svc_backup (automated, no human)", "The Silent Quorum gang"],
      answer: "Dr. A. Okafor",
    },
    {
      id: "frame",
      prompt: "How was D. Mercer FRAMED?",
      options: [
        "His password was stolen",
        "A fake 02:45 login line was inserted into a tampered log",
        "He was seen on CCTV",
        "His badge was cloned",
      ],
      answer: "A fake 02:45 login line was inserted into a tampered log",
    },
    {
      id: "account",
      prompt: "Which account actually executed the attack?",
      options: ["d.mercer", "svc_backup", "administrator", "guest"],
      answer: "svc_backup",
    },
    {
      id: "motive",
      prompt: "What was the TRUE motive behind the ransomware?",
      options: [
        "Bitcoin extortion only",
        "Cover for selling patient data to a pharma broker",
        "Political protest",
        "Revenge for being fired",
      ],
      answer: "Cover for selling patient data to a pharma broker",
    },
    {
      id: "proof",
      prompt: "What single artifact PROVES Okafor built the ransomware?",
      options: [
        "The ransom note",
        "quorum.bin compiled under USER=a.okafor",
        "The decoy .bat file",
        "A CCTV still",
      ],
      answer: "quorum.bin compiled under USER=a.okafor",
    },
  ],

  devices: {
    "WARD-PC14": buildWard(),
    "CARE-DC01": buildDC(),
    "CARE-DB03": buildStaging(),
  },
};
