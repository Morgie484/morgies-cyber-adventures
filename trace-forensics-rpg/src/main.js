// GREPOIRE — main orchestrator. Ties the overworld, terminal, dialogue,
// character sheet, dice rolls, audio, and case resolution together.

import { createCharacter, addEvidence, grantXP, modFor, spendStatPoint } from "./engine/character.js";
import { Terminal } from "./engine/terminal.js";
import { isSuccess, skillCheck } from "./engine/dice.js";
import { Overworld } from "./world/overworld.js";
import { CASES, getCase } from "./data/cases.js";
import { playBoot, showCharacterCreation, showDialogue, showCaseSelect, showTitleScreen, showLevelUp, showCodex, showSettings } from "./ui/screens.js";
import * as lore from "./data/lore.js";
import { animateRoll } from "./ui/diceRoll.js";
import { audio } from "./engine/audio.js";
import { STATS } from "./engine/character.js";
import { saveGame, loadGame, hasSave, clearSave, saveSummary } from "./engine/save.js";

const $ = (id) => document.getElementById(id);

const state = {
  character: null,
  mode: "world", // world | terminal | dialogue | board
  terminal: null,
  activeCase: null,
  solved: [], // array of solved case ids
};

// Persist current progress. Called at meaningful checkpoints.
function persist() {
  if (state.character) saveGame(state);
}

// ---------- boot & character creation ----------
// Unlock audio on the very first interaction anywhere.
const unlockAudioOnce = () => { audio.unlock(); audio.startMusic(); window.removeEventListener("pointerdown", unlockAudioOnce); window.removeEventListener("keydown", unlockAudioOnce); };
window.addEventListener("pointerdown", unlockAudioOnce);
window.addEventListener("keydown", unlockAudioOnce);

// Title screen → (Continue | New Game) → boot → creation → case select → game.
showTitleScreen((choice) => {
  // handler below
  audio.unlock();
  audio.startMusic();

  // Continue: restore the saved character and jump to case select.
  if (choice === "continue") {
    const data = loadGame();
    if (data && data.character) {
      state.character = data.character;
      state.solved = data.solved || [];
      showCaseSelect(CASES, (caseId) => {
        state.activeCase = getCase(caseId);
        startGame();
      }, { solved: state.solved });
      return;
    }
  }

  // New Game: wipe any old save, run boot + character creation.
  clearSave();
  state.solved = [];
  $("boot").classList.remove("hidden");
  playBoot($("boot"), () => {
    audio.unlock();
    $("boot").classList.add("hidden");
    showCharacterCreation(({ name, backgroundId, appearance }) => {
      state.character = createCharacter(name, backgroundId);
      state.character.appearance = appearance;
      persist();
      showCaseSelect(CASES, (caseId) => {
        state.activeCase = getCase(caseId);
        startGame();
      }, { solved: state.solved });
    });
  });
}, saveSummary());

// ---------- game ----------
let world;
function startGame() {
  audio.startMusic();
  $("game").classList.remove("hidden");
  world = new Overworld($("world"), state.activeCase, state.character.appearance);
  setHint("WASD move · SPACE interact · [E] Evidence · [J] Codex · [M] Mute");
  installAudioToggle();
  loop();

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", (e) => { world.keys[e.key.toLowerCase()] = false; });

  $("ws-exit").onclick = closeTerminal;
  $("eb-close").onclick = closeBoard;
  $("case-title").textContent = `CASE #${state.activeCase.id} — ${state.activeCase.name} [${state.activeCase.difficulty}]`;
}

let lastMoveSound = 0;
function loop() {
  if (state.mode === "world") {
    const before = `${Math.round(world.player.x)},${Math.round(world.player.y)}`;
    world.update();
    const after = `${Math.round(world.player.x)},${Math.round(world.player.y)}`;
    if (before !== after && Date.now() - lastMoveSound > 120) { audio.sfx("move"); lastMoveSound = Date.now(); }
    world.draw();
  }
  requestAnimationFrame(loop);
}

function onKeyDown(e) {
  const k = e.key.toLowerCase();
  if (state.mode === "world") {
    world.keys[k] = true;
    if (k === " ") { e.preventDefault(); interact(); }
    if (k === "e") openBoard();
    if (k === "j") openCodex();
    if (k === "m") toggleMute();
  } else if (state.mode === "terminal") {
    if (k === "escape") closeTerminal();
  } else if (state.mode === "board") {
    if (k === "escape") closeBoard();
  } else if (state.mode === "codex") {
    if (k === "escape") closeCodex();
  }
}

function setHint(text) { $("hint").textContent = text; }

function installAudioToggle() {
  if ($("audio-toggle")) return;
  const btn = document.createElement("button");
  btn.id = "audio-toggle";
  btn.textContent = "♪ ON";
  btn.style.cssText =
    "position:fixed;top:8px;right:12px;z-index:20;background:#0b131c;border:1px solid #22303d;color:#39ff14;font-family:monospace;padding:4px 10px;cursor:pointer";
  btn.onclick = toggleMute;
  document.body.appendChild(btn);

  const gear = document.createElement("button");
  gear.id = "settings-btn";
  gear.textContent = "⚙";
  gear.title = "Settings";
  gear.style.cssText =
    "position:fixed;top:8px;right:74px;z-index:20;background:#0b131c;border:1px solid #22303d;color:#26d9ff;font-family:monospace;padding:4px 10px;cursor:pointer";
  gear.onclick = openSettings;
  document.body.appendChild(gear);
}

function openSettings() {
  const prevMode = state.mode;
  state.mode = "settings";
  showSettings({
    audio,
    onResetSave: () => { clearSave(); location.reload(); },
    onClose: () => { state.mode = prevMode === "settings" ? "world" : prevMode; },
  });
}
function toggleMute() {
  const on = audio.toggleAll();
  const btn = $("audio-toggle");
  if (btn) { btn.textContent = on ? "♪ ON" : "♪ OFF"; btn.style.color = on ? "#39ff14" : "#5a6b7a"; }
}

// ---------- interaction ----------
function interact() {
  const near = world.nearby;
  if (!near) return;
  audio.sfx("enter");
  if (near.type === "location") openTerminal(near.data.host);
  else if (near.type === "npc") openDialogue(near.data.npc);
}

// ---------- terminal ----------
function openTerminal(host) {
  const device = state.activeCase.devices[host];
  if (!device) return;
  state.mode = "terminal";
  $("ws-host").textContent = host;
  $("workstation").classList.remove("hidden");
  $("term-output").innerHTML = "";

  state.terminal = new Terminal({
    device,
    character: state.character,
    dcBonus: state.activeCase.dcBonus || 0,
    onEvidence: (ev) => {
      const added = addEvidence(state.character, { ...ev, ...evidenceMeta(ev.id) });
      if (added) { audio.sfx("evidence"); checkCaseReady(); persist(); }
      return added;
    },
    onXP: (amount, reason) => {
      const levels = grantXP(state.character, amount);
      printLine(`+${amount} XP (${reason})`, "t-cyan");
      persist();
      if (levels.length) {
        audio.sfx("levelUp");
        printLine(`LEVEL UP! You are now level ${state.character.level}. (+2 skill points — spend on the Evidence Board)`, "t-amber");
        showLevelUp(state.character.level, levels.length * 2);
      }
    },
    // Async: plays the animated dice popup and resolves when it finishes.
    onCheck: (res, label, stat) => animateRoll(res, { stat, label }),
  });

  printWelcome(host);
  focusInput();
  bindInput();
}

function printWelcome(host) {
  printLine(`Connected to ${host}.`, "t-green");
  printLine(`Type 'help' for commands. New here? Start with 'ls'.`, "t-dim");
  printLine("");
}

function printLine(text, cls = "") {
  const out = $("term-output");
  const div = document.createElement("div");
  if (cls) div.className = cls;
  div.textContent = text;
  out.appendChild(div);
  out.scrollTop = out.scrollHeight;
}

let inputBound = false;
function bindInput() {
  const input = $("term-input");
  $("term-prompt").textContent = state.terminal.prompt();
  if (inputBound) return;
  inputBound = true;
  input.addEventListener("keydown", async (e) => {
    if (state.mode !== "terminal") return;
    const t = state.terminal;

    // ↑ / ↓ — walk command history.
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const hist = t.history;
      if (!hist.length) return;
      if (state.histIndex === undefined || state.histIndex === null) state.histIndex = hist.length;
      state.histIndex += e.key === "ArrowUp" ? -1 : 1;
      state.histIndex = Math.max(0, Math.min(hist.length, state.histIndex));
      input.value = state.histIndex < hist.length ? hist[state.histIndex] : "";
      audio.sfx("move");
      return;
    }

    // Tab — complete command or filename.
    if (e.key === "Tab") {
      e.preventDefault();
      const matches = t.completions(input.value);
      if (matches.length === 1) {
        const parts = input.value.split(/\s+/);
        parts[parts.length - 1] = matches[0];
        input.value = parts.join(" ");
        audio.sfx("select");
      } else if (matches.length > 1) {
        printLine(`${t.prompt()} ${input.value}`, "t-dim");
        printLine(matches.join("    "), "t-cyan");
        // fill the shared prefix
        const prefix = sharedPrefix(matches);
        const parts = input.value.split(/\s+/);
        if (prefix.length > parts[parts.length - 1].length) {
          parts[parts.length - 1] = prefix;
          input.value = parts.join(" ");
        }
        audio.sfx("select");
      }
      return;
    }

    if (e.key === "Enter") {
      const raw = input.value;
      printLine(`${t.prompt()} ${raw}`, "t-dim");
      input.value = "";
      state.histIndex = null; // reset history cursor after a command
      input.disabled = true; // prevent double-submit during async roll
      const lines = await t.run(raw);
      input.disabled = false;
      input.focus();
      for (const l of lines) {
        if (l.clear) { $("term-output").innerHTML = ""; continue; }
        if (l.exit) { closeTerminal(); return; }
        printLine(l.text, l.cls);
      }
      $("term-prompt").textContent = t.prompt();
    }
  });
}

// Longest common prefix of a list of strings (for Tab-completion).
function sharedPrefix(arr) {
  if (!arr.length) return "";
  let p = arr[0];
  for (const s of arr) {
    while (!s.startsWith(p)) p = p.slice(0, -1);
    if (!p) break;
  }
  return p;
}

function focusInput() { setTimeout(() => $("term-input").focus(), 50); }

function closeTerminal() {
  $("workstation").classList.add("hidden");
  state.mode = "world";
}

// ---------- dialogue ----------
function openDialogue(npcId) {
  const npc = state.activeCase.npcs[npcId];
  if (!npc) return;
  state.mode = "dialogue";
  showDialogue({
    npcName: npc.name,
    tree: npc.lines,
    character: state.character,
    hasEvidence: (id) => state.character.evidence.some((e) => e.id === id),
    // Async roll with animation; returns the resolved check.
    rollCheck: async (stat, dc, label) => {
      const res = rollSocial(stat, dc);
      await animateRoll(res, { stat, label });
      return res;
    },
    onNote: (note) => {
      if (!state.character.notes.includes(note)) {
        state.character.notes.push(note);
        setHint(`Note added: ${note}`);
      }
    },
    onClose: () => { state.mode = "world"; },
  });
}

function rollSocial(stat, dc) {
  const mod = modFor(state.character, stat, { tag: "social" });
  return skillCheck(mod, dc + (state.activeCase.dcBonus || 0));
}

// ---------- evidence board & case solving ----------
function evidenceMeta(id) {
  // Per-case evidence descriptions.
  const meta = {
    // Case 01
    ev_grudge: { desc: "Hidden note: Vale resents being passed over; mentions selling the client list." },
    ev_clientlist: { desc: "Recovered deleted client_list.csv on Vale's home machine." },
    ev_tool: { desc: "Exfiltration tool 'uploader v2' pointing at nightjar.onion, built by the attacker." },
    ev_accesslog: { desc: "Server access log: j.vale logged in 03:47, downloaded the list, uploaded it 03:51 to nightjar.onion." },
    ev_payload: { desc: "Decoded relay payload naming the buyer (Globex rival) and Vale's wallet." },
    // Case 02
    ev_tamper: { desc: "config.ini on LEDGER-TELLER — hash mismatch proves it was edited (backdoor hook injected)." },
    ev_backdoor: { desc: "Hidden backdoor '.ldr' siphoning 0.5% of each payment to acct_99120, installed by svc_deploy." },
    ev_authlog: { desc: "Auth log: svc_deploy token issued 23:40 from rogue host 10.0.0.9, then config modified + .ldr started." },
    ev_opsnote: { desc: "Decoded ops note: host 10.0.0.9 is R. Castellan's dev laptop; acct_99120 is theirs." },
    // Case 03
    ev_ransomnote: { desc: "Ransom note signed 'The Silent Quorum' — but tooling signature matches an INSIDER build, not a known gang." },
    ev_decoy: { desc: "Planted .bat implicating D. Mercer — note admits its timestamps were BACKDATED (a frame-up)." },
    ev_dropper: { desc: "Recovered dropper.tmp: payload staged from CARE-DB03 by svc_backup at 02:11." },
    ev_tamperedlog: { desc: "security.log hash MISMATCH on CARE-DC01 — the 02:45 'd.mercer' login was inserted to frame him." },
    ev_whois: { desc: "Decoded (base64→ROT13): svc_backup is controlled by Dr. A. Okafor; motive is a patient-data sale." },
    ev_payload3: { desc: "quorum.bin ransomware compiled on CARE-DB03 under USER=a.okafor — ties the build to Okafor." },
    // Case 04 (D&D aether-stream quest)
    ev_capture: { desc: "Gateway aether-stream capture: a tainted HTTP POST to whisper.nullchoir.aether, courier header X-Courier: m.falk." },
    ev_oath: { desc: "Hidden oath scroll: Malric Falk swore loyalty to the Hollow Court." },
    ev_scroll: { desc: "Banished ward-scroll: confirms the Null Choir dead-drop host accepts Falk's manifest." },
  };
  return meta[id] || { desc: "" };
}

function checkCaseReady() {
  const n = state.character.evidence.length;
  setHint(`Evidence collected: ${n}. Press [E] to open the Evidence Board.`);
}

let codexHandle = null;
function openCodex() {
  state.mode = "codex";
  audio.sfx("enter");
  codexHandle = showCodex({
    character: state.character,
    cases: CASES,
    solved: state.solved,
    activeCaseId: state.activeCase ? state.activeCase.id : null,
    lore,
    onClose: () => { state.mode = "world"; codexHandle = null; },
  });
}
function closeCodex() {
  if (codexHandle) codexHandle.close();
  else state.mode = "world";
}

function openBoard() {
  state.mode = "board";
  $("evidence-board").classList.remove("hidden");
  renderBoard();
}

function renderBoard() {
  const c = state.character;
  const ac = state.activeCase;

  // Evidence list + spendable skill points.
  let statPointsUI = "";
  if (c.statPoints > 0) {
    statPointsUI =
      `<div style="margin:10px 0;padding:8px;border:1px solid #39ff14;background:#0c1a10">
        <span style="color:#39ff14">You have ${c.statPoints} skill point(s) to spend:</span><br/>` +
      STATS.map((s) => `<button class="sp-btn" data-stat="${s}" style="margin:4px 4px 0 0;background:#060b10;border:1px solid #22303d;color:#26d9ff;font-family:monospace;padding:4px 8px;cursor:pointer">+1 ${s} (${c.stats[s]})</button>`).join("") +
      `</div>`;
  }

  $("evidence-list").innerHTML =
    `<div style="color:#5a6b7a;margin-bottom:8px">Investigator: ${c.name} — ${c.backgroundName} · Level ${c.level} · XP ${c.xp}</div>` +
    statPointsUI +
    (c.evidence.length
      ? c.evidence.map((e) => `<div class="evidence-item"><div class="tag">[${e.id}] from ${e.host}</div><div>${e.name} — ${e.desc || e.summary}</div></div>`).join("")
      : `<div style="color:#5a6b7a">No evidence yet. Explore the locations and 'tag' important files.</div>`) +
    (c.notes.length ? `<div style="margin-top:10px;color:#ffb000">Notes:</div>` + c.notes.map((n) => `<div style="color:#cbd;font-size:12px">• ${n}</div>`).join("") : "");

  $("evidence-list").querySelectorAll(".sp-btn").forEach((btn) => {
    btn.onclick = () => { if (spendStatPoint(c, btn.dataset.stat)) { audio.sfx("confirm"); persist(); renderBoard(); } };
  });

  // Case questions.
  const q = $("case-questions");
  q.innerHTML = `<h3 style="color:#26d9ff">Solve the case — ${ac.name}</h3>` +
    ac.questions.map((qq) =>
      `<div class="case-q"><label>${qq.prompt}</label>
        <select data-q="${qq.id}">
          <option value="">— choose —</option>
          ${qq.options.map((o) => `<option>${o}</option>`).join("")}
        </select></div>`).join("") +
    `<button class="primary" id="submit-case">Submit Verdict</button>
     <div id="verdict" style="margin-top:10px"></div>`;

  q.querySelector("#submit-case").onclick = submitCase;
}

function submitCase() {
  const ac = state.activeCase;
  const selects = $("case-questions").querySelectorAll("select[data-q]");
  let correct = 0;
  const results = [];
  selects.forEach((sel) => {
    const qq = ac.questions.find((x) => x.id === sel.dataset.q);
    const ok = sel.value === qq.answer;
    if (ok) correct++;
    results.push({ prompt: qq.prompt, ok });
  });

  const verdict = $("verdict");
  if (correct === ac.questions.length) {
    audio.sfx("levelUp");
    const reward = ac.reward || (ac.difficulty === "EXPERT" ? 400 : ac.difficulty === "HARD" ? 250 : 100);
    const levels = grantXP(state.character, reward);
    if (levels.length) showLevelUp(state.character.level, levels.length * 2);
    if (!state.solved.includes(ac.id)) state.solved.push(ac.id);
    persist();
    const otherCases = CASES.filter((c) => c.id !== ac.id);
    verdict.innerHTML =
      `<div style="color:#39ff14;font-size:16px">✓ CASE SOLVED — ${ac.name} closed!</div>
       <div style="color:#cbd;margin-top:6px">All questions correct. +${reward} XP.</div>` +
      (levels.length ? `<div style="color:#ffb000">Reached level ${state.character.level}!</div>` : "") +
      (otherCases.length
        ? `<div style="margin-top:10px;color:#26d9ff">Another case is available:</div>` +
          otherCases.map((c) => `<button class="primary next-case" data-id="${c.id}" style="margin-top:6px">Start Case #${c.id} — ${c.name} [${c.difficulty}] →</button>`).join("")
        : `<div style="color:#5a6b7a;margin-top:8px">You've closed every case. More can be added in src/data/.</div>`);
    verdict.querySelectorAll(".next-case").forEach((b) => {
      b.onclick = () => switchCase(b.dataset.id);
    });
  } else {
    audio.sfx("failure");
    verdict.innerHTML =
      `<div style="color:#ff4b4b">Not quite — ${correct}/${ac.questions.length} correct. Review your evidence and try again.</div>` +
      results.filter((r) => !r.ok).map((r) => `<div style="color:#5a6b7a;font-size:12px">• Re-check: ${r.prompt}</div>`).join("");
  }
}

function switchCase(id) {
  state.activeCase = getCase(id);
  // Keep the character (level/skills/appearance), reset per-case evidence & notes.
  state.character.evidence = [];
  state.character.notes = [];
  closeBoard();
  world = new Overworld($("world"), state.activeCase, state.character.appearance);
  $("case-title").textContent = `CASE #${state.activeCase.id} — ${state.activeCase.name} [${state.activeCase.difficulty}]`;
  setHint(`New case loaded: ${state.activeCase.name}. Explore and gather evidence.`);
  audio.sfx("confirm");
  persist();
}

function closeBoard() {
  $("evidence-board").classList.add("hidden");
  state.mode = "world";
}
