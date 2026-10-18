// CASE #5520 — "Hollow Ledger" (INTERMEDIATE/HARD)
// A finance platform shows phantom transactions. Someone planted a backdoor
// and tampered with records. Harder than the tutorial: encrypted files,
// a tampered file you must catch via hash MISMATCH, and a multi-hop trail.

import { VDir, VFile } from "../engine/filesystem.js";
import { pseudoSha256 } from "../engine/crypto.js";

function buildTeller() {
  const root = new VDir("~");
  const app = new VDir("app");
  // A config file whose recorded hash will NOT match (tampered) — the catch.
  const tamperedConfig = "db_host=prod-ledger\nadmin_token=ROTATED\n# injected:\nhook=/tmp/.ldr pay_to=acct_99120";
  const originalConfig = "db_host=prod-ledger\nadmin_token=ROTATED";
  app.add(new VFile({ name: "config.ini", tag: "ev_tamper", content: tamperedConfig }));
  app.add(new VFile({ name: "config.ini.sha256", content: pseudoSha256(originalConfig) + "  config.ini" }));
  app.add(new VFile({
    name: ".ldr",
    hidden: true,
    tag: "ev_backdoor",
    content: "\x7fELF backdoor: on each payment, siphon 0.5% to acct_99120. installed_by=svc_deploy",
  }));
  root.add(app);
  return { host: "LEDGER-TELLER", label: "Teller Server", root };
}

function buildAuth() {
  const root = new VDir("~");
  const logs = new VDir("logs");
  logs.add(new VFile({
    name: "auth.log",
    tag: "ev_authlog",
    content:
      "09:01 svc_deploy token-issued (normal deploy)\n" +
      "23:40 svc_deploy token-issued FROM 10.0.0.9 (NOT a deploy host!)\n" +
      "23:41 config.ini modified by svc_deploy\n" +
      "23:42 process /tmp/.ldr started\n" +
      "23:59 svc_deploy token-issued FROM 10.0.0.9",
  }));
  // Encrypted note (base64) revealing who controls 10.0.0.9.
  const secret = btoa("host 10.0.0.9 = dev laptop of R. Castellan. acct_99120 is theirs.");
  logs.add(new VFile({ name: "ops_note.enc", locked: true, tag: "ev_opsnote", content: secret }));
  root.add(logs);
  return { host: "LEDGER-AUTH", label: "Auth Server", root };
}

export const CASE_HOLLOW_LEDGER = {
  id: "5520",
  name: "Hollow Ledger",
  difficulty: "HARD",
  brief:
    "Phantom transactions drain 0.5% from every payment. A deploy service " +
    "account was abused to plant a backdoor and tamper with config. Prove it: " +
    "catch the tampered file, trace the rogue host, and name the insider.",
  dcBonus: 4, // all skill checks in this case are harder

  npcs: {
    sec: {
      name: "Priya (Security Lead)",
      lines: {
        start: {
          text: "\"Our reconciliation is off by exactly 0.5% across thousands of payments. The deploy service account 'svc_deploy' is the common thread — but service accounts don't act alone.\"",
          options: [
            { text: "Where would the backdoor live?", dc: 14, stat: "SOCIAL", to: "hint" },
            { text: "(Leave)", to: null },
          ],
        },
        hint: {
          text: "\"Check LEDGER-TELLER's app folder. And verify the config against its recorded hash — if it's been edited, the hash won't match.\"",
          options: [{ text: "Got it.", to: null }],
          reward: { note: "Priya: verify config.ini hash on LEDGER-TELLER; hunt for hidden backdoor." },
        },
      },
    },
    castellan: {
      name: "R. Castellan (Dev)",
      lines: {
        start: {
          text: "\"I just write deploy scripts. The service account? Everyone uses it.\"",
          options: [
            { text: "Confront: 10.0.0.9 is YOUR laptop, and acct_99120 is yours. (needs the decoded note)", requires: "ev_opsnote", dc: 18, stat: "SOCIAL", to: "crack" },
            { text: "(Leave)", to: null },
          ],
        },
        crack: {
          text: "Castellan goes pale. \"...You decoded that? Okay. Okay. I did it. The siphon was supposed to be invisible.\" Full confession.",
          options: [{ text: "It wasn't invisible enough.", to: null }],
          reward: { note: "Castellan confessed to installing the siphon backdoor via svc_deploy." },
        },
      },
    },
  },

  questions: [
    {
      id: "insider",
      prompt: "WHO planted the backdoor?",
      options: ["svc_deploy (the service account itself)", "Priya", "R. Castellan", "An external APT group"],
      answer: "R. Castellan",
    },
    {
      id: "proof",
      prompt: "What PROVES the config was tampered with?",
      options: [
        "It was deleted",
        "Its hash does NOT match the recorded .sha256",
        "It was encrypted",
        "It had a newer timestamp",
      ],
      answer: "Its hash does NOT match the recorded .sha256",
    },
    {
      id: "host",
      prompt: "Which rogue host issued the off-hours tokens?",
      options: ["prod-ledger", "10.0.0.9", "127.0.0.1", "deploy-host-1"],
      answer: "10.0.0.9",
    },
    {
      id: "method",
      prompt: "HOW were funds stolen?",
      options: [
        "Direct wire transfers",
        "A backdoor siphoning 0.5% of each payment to acct_99120",
        "Stolen credit cards",
        "Fake invoices",
      ],
      answer: "A backdoor siphoning 0.5% of each payment to acct_99120",
    },
  ],

  devices: {
    "LEDGER-TELLER": buildTeller(),
    "LEDGER-AUTH": buildAuth(),
  },
};
