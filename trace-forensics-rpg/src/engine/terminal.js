// Terminal command processor. Realistic forensics commands, but every
// command self-documents and failures are forgiving (beginner mode).

import { VDir, isDir, isFile } from "./filesystem.js";
import { pseudoSha256, extractStrings, hexdump, rot, tryBase64Decode } from "./crypto.js";
import { skillCheck, isSuccess, DC, CheckResult } from "./dice.js";
import { modFor } from "./character.js";

// Colored-line helpers. Returns {text, cls}.
const line = (text, cls = "") => ({ text, cls });

export class Terminal {
  constructor({ device, character, onEvidence, onXP, onCheck, dcBonus = 0 }) {
    this.device = device;         // { host, root: VDir, onConnect }
    this.character = character;
    this.cwd = device.root;
    this.path = ["~"];
    this.onEvidence = onEvidence; // (evidence) => void
    this.onXP = onXP;             // (amount, reason) => void
    this.onCheck = onCheck;       // (checkResult, label, stat) => void  (dice animation)
    this.dcBonus = dcBonus;       // added to every DC (case difficulty)
    this.history = [];
  }

  prompt() {
    return `investigator@${this.device.host}:${this.path.join("/")}$`;
  }

  // Returns a Promise<array of {text, cls} lines>. Async because skill-gated
  // commands await a dice-roll animation before producing output.
  async run(raw) {
    const input = raw.trim();
    if (!input) return [];
    this.history.push(input);
    const [cmd, ...args] = input.split(/\s+/);
    const fn = this.commands[cmd];
    if (!fn) {
      return [
        line(`command not found: ${cmd}`, "t-red"),
        line(`Type 'help' to see what you can do here.`, "t-dim"),
      ];
    }
    return (await fn.call(this, args)) || [];
  }

  // ---- helpers ----
  resolveFile(name) {
    const node = this.cwd.get(name);
    return node && isFile(node) ? node : null;
  }

  async doCheck(stat, dc, label, context = {}) {
    const mod = modFor(this.character, stat, context);
    const res = skillCheck(mod, dc + this.dcBonus);
    if (this.onCheck) await this.onCheck(res, label, stat);
    return res;
  }

  checkLine(res, stat) {
    const sign = res.modifier >= 0 ? "+" : "";
    const cls = isSuccess(res.result) ? "t-green" : "t-red";
    return line(
      `  [ROLL] ${stat} check: d20(${res.d20}) ${sign}${res.modifier} = ${res.total} vs DC ${res.dc} → ${res.result.toUpperCase()}`,
      cls
    );
  }

  get commands() {
    return {
      help: () => [
        line("TRACE FORENSIC SHELL — available commands:", "t-cyan"),
        line(""),
        line("  ls [-a]            list files   (-a also shows hidden files)"),
        line("  cat <file>         read a file's contents"),
        line("  strings <file>     pull readable text out of a binary file"),
        line("  hexdump <file>     view raw bytes (offset / hex / ascii)"),
        line("  sha256 <file>      compute a file's fingerprint (hash)"),
        line("  verify <file> <hash>  check a file against a known hash"),
        line("  scan               look closely for DELETED or hidden data"),
        line("  recover <file>     restore a deleted file you've found"),
        line("  decode <file>      try to decode scrambled/encoded text"),
        line("  grep <word> <file> search for a word inside a file"),
        line("  log <file>         pretty-print a log file as a timeline"),
        line("  tag <file>         mark a file as EVIDENCE for the case"),
        line("  whoami / stats     show your investigator stats"),
        line("  clear              clear the screen"),
        line("  exit               disconnect from this device"),
        line(""),
        line("New here? Try 'ls' first, then 'cat' a file that looks interesting.", "t-amber"),
      ],

      whoami: () => this.commands.stats(),
      stats: () => {
        const c = this.character;
        const out = [line(`${c.name} — ${c.backgroundName} (Level ${c.level}, XP ${c.xp})`, "t-cyan")];
        for (const [k, v] of Object.entries(c.stats)) {
          const mod = Math.floor((v - 10) / 2);
          out.push(line(`  ${k.padEnd(11)} ${String(v).padStart(2)}  (${mod >= 0 ? "+" : ""}${mod})`));
        }
        out.push(line(`  Perk: ${c.perk}`, "t-amber"));
        return out;
      },

      clear: () => { this._clear = true; return [{ clear: true }]; },

      exit: () => [{ exit: true }],

      ls: (args) => {
        const all = args.includes("-a");
        const nodes = this.cwd.list({ all });
        if (nodes.length === 0) return [line("(empty directory)", "t-dim")];
        return nodes.map((n) => {
          if (isDir(n)) return line(`${n.name}/`, "t-cyan");
          const marks = [];
          if (n.hidden) marks.push("hidden");
          if (n.locked) marks.push("encrypted");
          const tag = marks.length ? `  (${marks.join(", ")})` : "";
          return line(`${n.name}${tag}`, n.locked ? "t-amber" : "");
        });
      },

      cat: (args) => {
        const f = this.resolveFile(args[0]);
        if (!f) return [line(`cat: ${args[0] || "<file>"}: no such file`, "t-red")];
        if (f.locked) return [
          line(`cat: ${f.name}: file is ENCRYPTED and cannot be read directly.`, "t-amber"),
          line(`Hint: try 'decode ${f.name}', or find a key/password first.`, "t-dim"),
        ];
        return f.content.split("\n").map((l) => line(l));
      },

      strings: (args) => {
        const f = this.resolveFile(args[0]);
        if (!f) return [line(`strings: ${args[0] || "<file>"}: no such file`, "t-red")];
        const found = extractStrings(f.content);
        if (!found.length) return [line("(no printable strings found)", "t-dim")];
        return [
          line(`Readable text found inside ${f.name}:`, "t-dim"),
          ...found.map((s) => line("  " + s)),
        ];
      },

      hexdump: (args) => {
        const f = this.resolveFile(args[0]);
        if (!f) return [line(`hexdump: ${args[0] || "<file>"}: no such file`, "t-red")];
        return hexdump(f.content).split("\n").map((l) => line(l, "t-dim"));
      },

      sha256: (args) => {
        const f = this.resolveFile(args[0]);
        if (!f) return [line(`sha256: ${args[0] || "<file>"}: no such file`, "t-red")];
        const h = pseudoSha256(f.content);
        return [
          line(h, "t-green"),
          line(`  (a 'hash' is a fingerprint — same file always gives the same hash)`, "t-dim"),
        ];
      },

      verify: (args) => {
        const f = this.resolveFile(args[0]);
        if (!f) return [line(`verify: ${args[0] || "<file>"}: no such file`, "t-red")];
        if (!args[1]) return [line(`usage: verify <file> <expected-hash>`, "t-dim")];
        const h = pseudoSha256(f.content);
        if (h === args[1]) return [line(`MATCH — ${f.name} is authentic & untampered.`, "t-green")];
        return [
          line(`MISMATCH — ${f.name} does NOT match the expected hash!`, "t-red"),
          line(`  This file may have been altered. That itself is evidence.`, "t-amber"),
        ];
      },

      scan: async () => {
        // PERCEPTION check reveals deleted/hidden files.
        const res = await this.doCheck("PERCEPTION", DC.EASY, "Deep scan", { tag: "scan" });
        const out = [this.checkLine(res, "PERCEPTION")];
        if (!isSuccess(res.result)) {
          out.push(line("Nothing jumps out... take another look, or raise PERCEPTION.", "t-dim"));
          return out;
        }
        const deleted = [...this.cwd.children.values()].filter((n) => isFile(n) && n.deleted);
        const hidden = [...this.cwd.children.values()].filter((n) => isFile(n) && n.hidden);
        if (!deleted.length && !hidden.length) {
          out.push(line("Scan complete. No hidden or deleted data in this folder.", "t-dim"));
          return out;
        }
        if (deleted.length) {
          out.push(line("Found traces of DELETED files (recover them):", "t-amber"));
          deleted.forEach((f) => out.push(line(`  [deleted] ${f.name}`, "t-amber")));
        }
        if (hidden.length) {
          out.push(line("Found HIDDEN files (use 'ls -a' to list, 'cat' to read):", "t-cyan"));
          hidden.forEach((f) => out.push(line(`  [hidden] ${f.name}`)));
        }
        return out;
      },

      recover: async (args) => {
        const name = args[0];
        const node = name ? this.cwd.get(name) : null;
        if (!node || !isFile(node) || !node.deleted) {
          return [
            line(`recover: no deleted file named '${name || ""}' here.`, "t-red"),
            line(`Hint: run 'scan' first to find deleted files.`, "t-dim"),
          ];
        }
        const res = await this.doCheck("TECH", DC.EASY, "Recover file", { tag: "recover" });
        const out = [this.checkLine(res, "TECH")];
        if (isSuccess(res.result)) {
          node.deleted = false;
          out.push(line(`Recovered '${node.name}'. You can now 'cat' it.`, "t-green"));
          this.onXP?.(15, `recovered ${node.name}`);
        } else {
          // Beginner-friendly: failure never destroys data, just retry.
          out.push(line(`Recovery incomplete — the file is intact, try again.`, "t-amber"));
        }
        return out;
      },

      decode: async (args) => {
        const f = this.resolveFile(args[0]);
        if (!f) return [line(`decode: ${args[0] || "<file>"}: no such file`, "t-red")];
        const res = await this.doCheck("LOGIC", DC.MEDIUM, "Decode", { tag: "crypto" });
        const out = [this.checkLine(res, "LOGIC")];
        if (!isSuccess(res.result)) {
          out.push(line("Couldn't crack the encoding this time. Try again.", "t-amber"));
          return out;
        }
        // Try base64, then ROT13, as beginner-level encodings.
        let decoded = tryBase64Decode(f.content);
        let method = "base64";
        if (!decoded || !/[\x20-\x7e]{4,}/.test(decoded)) {
          decoded = rot(f.content, 13);
          method = "ROT13";
        }
        if (f.locked) f.locked = false;
        out.push(line(`Decoded (${method}):`, "t-green"));
        decoded.split("\n").forEach((l) => out.push(line("  " + l)));
        this.onXP?.(20, `decoded ${f.name}`);
        return out;
      },

      grep: (args) => {
        const [word, fname] = args;
        const f = this.resolveFile(fname);
        if (!word || !f) return [line(`usage: grep <word> <file>`, "t-dim")];
        const hits = f.content.split("\n").filter((l) => l.toLowerCase().includes(word.toLowerCase()));
        if (!hits.length) return [line(`(no lines containing "${word}")`, "t-dim")];
        return hits.map((l) => line(l.replace(new RegExp(`(${word})`, "ig"), "«$1»"), "t-green"));
      },

      log: (args) => {
        const f = this.resolveFile(args[0]);
        if (!f) return [line(`log: ${args[0] || "<file>"}: no such file`, "t-red")];
        const rows = f.content.split("\n").filter(Boolean);
        return [
          line(`Timeline — ${f.name}:`, "t-cyan"),
          ...rows.map((r) => line("  " + r)),
          line(`  (Read top-to-bottom. Look for the odd one out.)`, "t-dim"),
        ];
      },

      tag: (args) => {
        const f = this.resolveFile(args[0]);
        if (!f) return [line(`tag: ${args[0] || "<file>"}: no such file`, "t-red")];
        if (!f.tag) return [line(`tag: ${f.name} doesn't seem relevant to the case.`, "t-dim")];
        const added = this.onEvidence?.({
          id: f.tag,
          name: f.name,
          host: this.device.host,
          summary: `Collected from ${this.device.host}`,
        });
        if (added === false) return [line(`Already in your evidence board.`, "t-dim")];
        this.onXP?.(25, `tagged evidence ${f.name}`);
        return [
          line(`★ EVIDENCE LOGGED: ${f.name}`, "t-amber"),
          line(`  Added to your evidence board. Press [E] in the world to review.`, "t-dim"),
        ];
      },
    };
  }
}
