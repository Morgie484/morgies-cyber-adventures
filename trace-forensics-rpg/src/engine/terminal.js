// Terminal command processor. Realistic forensics commands, but every
// command self-documents and failures are forgiving (beginner mode).

import { VDir, isDir, isFile } from "./filesystem.js";
import { pseudoSha256, extractStrings, hexdump, rot, tryBase64Decode } from "./crypto.js";
import { skillCheck, isSuccess, DC, CheckResult } from "./dice.js";
import { modFor } from "./character.js";
import { SPELL_ALIASES, DISCIPLINES, rankTitle } from "../data/lore.js";

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

  // Candidate completions for Tab: command names + spellwords (for the first
  // token), or file/dir names in the current directory (for later tokens).
  completions(input) {
    const parts = input.split(/\s+/);
    const typingCommand = parts.length <= 1;
    if (typingCommand) {
      const names = [...Object.keys(this.commands), ...Object.keys(SPELL_ALIASES)];
      const frag = parts[0] || "";
      return names.filter((n) => n.startsWith(frag)).sort();
    }
    const frag = parts[parts.length - 1] || "";
    const names = [...this.cwd.children.values()]
      .filter((n) => isFile(n) || isDir(n))
      .map((n) => n.name);
    return names.filter((n) => n.startsWith(frag)).sort();
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
    let [cmd, ...args] = input.split(/\s+/);
    // Spell aliases: 'scry' casts 'scan', 'banish' casts 'decode', etc.
    const casted = SPELL_ALIASES[cmd];
    if (casted) cmd = casted;
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
        line("GREPOIRE FORENSIC SHELL — grimoire of the Silent Grep:", "t-cyan"),
        line(""),
        line("  ls [-a]            list files   (-a also shows hidden files)"),
        line("  cat <file>         read a file's contents"),
        line("  strings <file>     pull readable text out of a binary file"),
        line("  hexdump <file>     view raw bytes (offset / hex / ascii)"),
        line("  sha256 <file>      read a file's true-name SIGIL (hash)"),
        line("  verify <file> <hash>  check a file against a known sigil"),
        line("  scan               scry for ECHOES (deleted) or hidden sigils"),
        line("  recover <file>     call an ECHO back (restore a deleted file)"),
        line("  decode <file>      BANISH a ward (decode sealed/encoded text)"),
        line("  grep <word> <file> search for a word inside a file"),
        line("  log <file>         pretty-print a log file as a timeline"),
        line("  pcap <file>        scry an AETHER-STREAM (packet capture)"),
        line("     pcap <file> follow <#>   reassemble one flow"),
        line("  tag <file>         seal a file as EVIDENCE for the quest"),
        line("  whoami / stats     commune with your own spirit (your sheet)"),
        line("  clear              clear the screen"),
        line("  exit               disconnect from this device"),
        line(""),
        line("  ✦ SPELLWORDS: scry=scan · banish=decode · mend=recover", "t-cyan"),
        line("    divine=sha256 · reveal=ls · behold=cat · commune=stats", "t-cyan"),
        line(""),
        line("New here? Try 'ls' first, then 'cat' a file that looks interesting.", "t-amber"),
      ],

      // Hidden signature easter egg (not listed in help — discover it!).
      morg: () => [
        line("  .  * .   ✦   .  *", "t-dim"),
        line("   __  __  ___  ___   ___ ", "t-cyan"),
        line("  |  \\/  |/ _ \\| _ \\ / __|", "t-cyan"),
        line("  | |\\/| | (_) |   / | (_ |", "t-cyan"),
        line("  |_|  |_|\\___/|_|_\\  \\___|", "t-cyan"),
        line("  * .   ✦   .  *  .   ✦", "t-dim"),
        line("GREPOIRE is a MORG systems production.", "t-amber"),
        line("Where the grep meets the grimoire. Trace the ghost in the logs.", "t-dim"),
        line("( you found the hidden command — +0 XP, +1 style )", "t-green"),
      ],

      whoami: () => this.commands.stats(),
      stats: () => {
        const c = this.character;
        const out = [
          line(`✦ ${c.name}, ${rankTitle(c.level)} of the Silent Grep`, "t-amber"),
          line(`  ${c.backgroundName} · Level ${c.level} · ${c.xp} XP`, "t-cyan"),
          line(""),
          line("  DISCIPLINE     SCORE  MOD  SCHOOL"),
        ];
        for (const [k, v] of Object.entries(c.stats)) {
          const mod = Math.floor((v - 10) / 2);
          const school = DISCIPLINES[k] ? DISCIPLINES[k].school : "";
          out.push(line(`  ${k.padEnd(13)} ${String(v).padStart(3)}  ${(mod >= 0 ? "+" : "") + mod}   ${school}`));
        }
        out.push(line(`  Boon: ${c.perk}`, "t-amber"));
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
        // Heuristic: does text read like plain English? (used to chain layers)
        const looksPlain = (s) =>
          s && /[\x20-\x7e]{4,}/.test(s) &&
          /\b(the|and|to|is|of|by|from|wallet|host|account|payment|data|motive|controlled|buyer)\b/i.test(s);

        // Try to peel encoding layers: base64 and/or ROT13, chained if needed.
        let decoded = f.content;
        const layers = [];
        for (let pass = 0; pass < 3; pass++) {
          if (looksPlain(decoded)) break;
          const b64 = tryBase64Decode(decoded);
          if (b64 && /[\x20-\x7e]{4,}/.test(b64) && b64 !== decoded) {
            decoded = b64; layers.push("base64"); continue;
          }
          const r = rot(decoded, 13);
          if (looksPlain(r) || pass === 0) { decoded = r; layers.push("ROT13"); continue; }
          break;
        }
        const method = layers.length ? layers.join(" → ") : "plaintext";
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

      // Inspect a packet capture. `pcap <file>` lists packets; a TECH check
      // flags anomalies. `pcap <file> follow <n>` reassembles that stream.
      pcap: async (args) => {
        const f = this.resolveFile(args[0]);
        if (!f) return [line(`pcap: ${args[0] || "<file>"}: no such file`, "t-red")];
        if (!f.packets) return [line(`pcap: ${f.name} is not a packet capture.`, "t-amber")];

        // follow a stream
        if (args[1] === "follow") {
          const n = parseInt(args[2], 10);
          const pkt = f.packets[n - 1];
          if (!pkt) return [line(`pcap: no packet #${args[2]} in ${f.name}.`, "t-red")];
          const res = await this.doCheck("LOGIC", DC.MEDIUM, "Reassemble stream", { tag: "crypto" });
          const out = [this.checkLine(res, "LOGIC")];
          if (!isSuccess(res.result)) {
            out.push(line("Stream reassembly failed — packets out of order. Try again.", "t-amber"));
            return out;
          }
          out.push(line(`--- follow TCP stream (packet #${n}) ---`, "t-cyan"));
          (pkt.payload || "(no application-layer payload)").split("\n").forEach((l) => out.push(line("  " + l)));
          this.onXP?.(20, `followed stream in ${f.name}`);
          return out;
        }

        // list view, with a PERCEPTION check to surface the suspicious packet
        const res = await this.doCheck("PERCEPTION", DC.MEDIUM, "Traffic analysis", { tag: "scan" });
        const out = [this.checkLine(res, "PERCEPTION")];
        out.push(line(`Packet capture — ${f.name} (${f.packets.length} packets):`, "t-cyan"));
        out.push(line("  #   TIME      SRC → DST                PROTO  INFO"));
        f.packets.forEach((p, i) => {
          const suspicious = p.flag && isSuccess(res.result);
          const row = `  ${String(i + 1).padStart(2)}  ${p.time}  ${(p.src + " → " + p.dst).padEnd(22)}  ${(p.proto || "").padEnd(5)}  ${p.info || ""}`;
          out.push(line(row + (suspicious ? "   ⚠" : ""), suspicious ? "t-amber" : ""));
        });
        if (isSuccess(res.result) && f.packets.some((p) => p.flag)) {
          out.push(line("  ⚠ One flow looks off — try 'pcap " + f.name + " follow <#>' to read it.", "t-amber"));
        } else {
          out.push(line("  (Nothing jumps out yet — raise PERCEPTION or look again.)", "t-dim"));
        }
        return out;
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
