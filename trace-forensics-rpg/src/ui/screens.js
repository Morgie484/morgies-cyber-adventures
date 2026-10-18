// UI screens: boot sequence, character creation, dialogue, evidence board,
// and the dice-roll popup. All beginner-friendly with plain-English text.

import { BACKGROUNDS, STATS, STAT_DESC } from "../engine/character.js";
import { isSuccess } from "../engine/dice.js";
import { audio } from "../engine/audio.js";
import {
  ROBE_COLORS, HATS, STAVES, SKIN_TONES, AURAS,
  defaultAppearance, drawCharacter,
} from "../engine/appearance.js";

const BOOT_LINES = [
  "GREPOIRE — Grimoire of the Silent Grep",
  "a MORG systems production",
  "attuning to the Archive...........[ OK ]",
  "opening the scrying-vault.........[ OK ]",
  "binding the five disciplines......[ OK ]",
  "arcane runtime (morg-core)........[ OK ]",
  "",
  "THE ARCHIVE — where all data persists as magic.",
  "You are a Data-Mage of the Order of the Silent Grep:",
  "part detective, part sorcerer, sworn to recover buried truth.",
  "",
  "Your first commission is a training quest. The Order will guide you.",
  "",
  "[ click anywhere to begin your initiation ]",
];

export function playBoot(el, onDone) {
  const pre = el.querySelector("#boot-text");
  let i = 0;
  pre.textContent = "";
  const timer = setInterval(() => {
    if (i < BOOT_LINES.length) {
      pre.textContent += BOOT_LINES[i] + "\n";
      i++;
    } else {
      clearInterval(timer);
    }
  }, 180);
  el.addEventListener("click", () => { clearInterval(timer); onDone(); }, { once: true });
}

// Character creation returns {name, backgroundId, appearance} via callback.
export function showCharacterCreation(onConfirm) {
  const overlay = document.createElement("div");
  overlay.id = "chargen";
  overlay.style.cssText =
    "position:fixed;inset:0;background:#05070a;z-index:80;padding:4%;overflow:auto;color:#d6e1e8;font-family:monospace;";
  let chosen = "ex-law";
  const look = defaultAppearance();
  let name = "Investigator";
  let previewFrame = 0;
  let previewTimer = null;

  // static shell (built once so inputs keep focus/state)
  overlay.innerHTML = `
    <h1 style="color:#ffb000;letter-spacing:2px;margin-bottom:4px">CREATE YOUR DATA-MAGE</h1>
    <p style="color:#5a6b7a;margin-top:0">Part investigator, part arcane hacker. Choose a background (sets skills) and customize your look.</p>
    <div style="display:flex;gap:24px;flex-wrap:wrap">
      <div style="flex:1;min-width:320px">
        <label style="color:#39ff14">Codename</label><br/>
        <input id="cg-name" value="Investigator" style="background:#060b10;border:1px solid #22303d;color:#fff;font-family:monospace;padding:8px;width:260px;margin:8px 0" />
        <div id="cg-bgs" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px"></div>
        <div id="cg-stats" style="margin-top:14px"></div>
      </div>
      <div style="width:260px">
        <div style="color:#26d9ff;margin-bottom:6px">Appearance</div>
        <canvas id="cg-preview" width="200" height="200" style="background:#0a0e14;border:1px solid #22303d;display:block;margin-bottom:10px"></canvas>
        <div id="cg-custom"></div>
      </div>
    </div>
    <button id="cg-go" class="primary" style="margin-top:16px">Begin Investigation →</button>
  `;

  const previewCanvas = overlay.querySelector("#cg-preview");
  const pctx = previewCanvas.getContext("2d");
  const drawPreview = () => {
    pctx.clearRect(0, 0, 200, 200);
    drawCharacter(pctx, look, 40, 20, 120, previewFrame);
  };

  const optionRow = (label, map, key, labeler = (v) => v) => {
    const opts = Object.keys(map)
      .map((k) => `<option value="${k}" ${look[key] === k ? "selected" : ""}>${labeler(map[k])}</option>`)
      .join("");
    return `<div style="margin:6px 0"><span style="display:inline-block;width:70px;color:#8aa;font-size:12px">${label}</span>
      <select data-key="${key}" style="background:#060b10;border:1px solid #22303d;color:#fff;font-family:monospace;padding:4px;width:160px">${opts}</select></div>`;
  };

  const renderCustom = () => {
    const wrap = overlay.querySelector("#cg-custom");
    wrap.innerHTML =
      optionRow("Robe", ROBE_COLORS, "robeColor", (v) => v.name) +
      optionRow("Hat", HATS, "hat") +
      optionRow("Focus", STAVES, "staff") +
      optionRow("Aura", AURAS, "aura", (v) => v.name) +
      `<div style="margin:6px 0"><span style="display:inline-block;width:70px;color:#8aa;font-size:12px">Skin</span>
        <span id="cg-skins"></span></div>`;
    wrap.querySelectorAll("select[data-key]").forEach((sel) => {
      sel.onchange = () => { look[sel.dataset.key] = sel.value; audio.sfx("select"); drawPreview(); };
    });
    const skinWrap = wrap.querySelector("#cg-skins");
    SKIN_TONES.forEach((tone) => {
      const sw = document.createElement("button");
      sw.style.cssText =
        `width:20px;height:20px;border:2px solid ${look.skin === tone ? "#39ff14" : "#333"};background:${tone};cursor:pointer;margin-right:4px`;
      sw.onclick = () => { look.skin = tone; audio.sfx("select"); renderCustom(); drawPreview(); };
      skinWrap.appendChild(sw);
    });
  };

  const renderBgs = () => {
    const bgWrap = overlay.querySelector("#cg-bgs");
    bgWrap.innerHTML = "";
    for (const [id, bg] of Object.entries(BACKGROUNDS)) {
      const card = document.createElement("div");
      const active = id === chosen;
      card.style.cssText =
        `flex:1;min-width:140px;border:1px solid ${active ? "#39ff14" : "#22303d"};background:${active ? "#0c1a10" : "#0b131c"};padding:10px;cursor:pointer`;
      card.innerHTML = `<div style="color:#26d9ff;font-weight:bold;font-size:13px">${bg.name}</div>
        <div style="color:#8aa;margin:6px 0;font-size:11px">${bg.blurb}</div>
        <div style="color:#ffb000;font-size:11px">Perk: ${bg.perk}</div>`;
      card.onclick = () => { chosen = id; audio.sfx("select"); renderBgs(); renderStats(); };
      bgWrap.appendChild(card);
    }
  };

  const renderStats = () => {
    const statWrap = overlay.querySelector("#cg-stats");
    const bg = BACKGROUNDS[chosen];
    statWrap.innerHTML =
      `<div style="color:#39ff14;margin-bottom:6px">Starting skills:</div>` +
      STATS.map((s) => {
        const v = bg.stats[s];
        const mod = Math.floor((v - 10) / 2);
        return `<div style="margin:2px 0;font-size:12px"><span style="display:inline-block;width:110px;color:#26d9ff">${s}</span>
          <span style="color:#fff">${v}</span> <span style="color:#5a6b7a">(${mod >= 0 ? "+" : ""}${mod}) — ${STAT_DESC[s]}</span></div>`;
      }).join("");
  };

  overlay.querySelector("#cg-name").addEventListener("input", (e) => { name = e.target.value; });
  overlay.querySelector("#cg-go").onclick = () => {
    audio.sfx("confirm");
    if (previewTimer) clearInterval(previewTimer);
    document.body.removeChild(overlay);
    onConfirm({ name: name.trim() || "Investigator", backgroundId: chosen, appearance: look });
  };

  renderBgs();
  renderStats();
  renderCustom();
  drawPreview();
  previewTimer = setInterval(() => { previewFrame++; drawPreview(); }, 60);
  document.body.appendChild(overlay);
}

// Dialogue popup. Walks a dialogue tree; runs SOCIAL checks on gated options.
export function showDialogue({ npcName, tree, character, hasEvidence, rollCheck, onNote, onClose }) {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(5,7,10,.9);z-index:70;display:flex;align-items:center;justify-content:center;font-family:monospace";
  const box = document.createElement("div");
  box.style.cssText =
    "background:#0f1621;border:1px solid #22303d;max-width:620px;width:90%;padding:22px;color:#d6e1e8";
  overlay.appendChild(box);

  const renderNode = (key) => {
    const node = tree[key];
    if (!node) { close(); return; }
    if (node.reward?.note) onNote?.(node.reward.note);
    box.innerHTML = `<div style="color:#ffb000;margin-bottom:8px">${npcName}</div>
      <div style="line-height:1.5;margin-bottom:16px">${node.text}</div>`;
    for (const opt of node.options) {
      const btn = document.createElement("button");
      const gated =
        (opt.requires && !hasEvidence(opt.requires)) ||
        (opt.requires2 && !hasEvidence(opt.requires2));
      btn.textContent = (opt.dc ? `🎲 ` : "") + opt.text + (gated ? "  (need evidence first)" : "");
      btn.disabled = gated;
      btn.style.cssText =
        `display:block;width:100%;text-align:left;margin:6px 0;padding:10px;font-family:monospace;cursor:${gated ? "not-allowed" : "pointer"};background:#060b10;border:1px solid #22303d;color:${gated ? "#5a6b7a" : "#39ff14"}`;
      btn.onclick = async () => {
        if (opt.dc) {
          // Disable buttons during the roll animation.
          box.querySelectorAll("button").forEach((b) => (b.disabled = true));
          const res = await rollCheck(opt.stat, opt.dc, opt.text);
          if (!isSuccess(res.result)) {
            // Beginner-friendly: failed social check just lets you retry.
            box.querySelectorAll("button").forEach((b) => (b.disabled = false));
            const existing = box.querySelector(".dlg-fail");
            if (existing) existing.remove();
            const msg = document.createElement("div");
            msg.className = "dlg-fail";
            msg.style.cssText = "color:#ff4b4b;margin-top:10px";
            msg.textContent = `${opt.stat} check failed (rolled ${res.total} vs DC ${res.dc}). They didn't budge — try again.`;
            box.appendChild(msg);
            return;
          }
        }
        if (opt.to === null) close();
        else renderNode(opt.to);
      };
      box.appendChild(btn);
    }
  };

  const close = () => { if (overlay.parentNode) document.body.removeChild(overlay); onClose?.(); };
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  renderNode("start");
  document.body.appendChild(overlay);
}

// Case selection screen. Lists cases easiest → hardest.
export function showCaseSelect(cases, onPick, opts = {}) {
  const solved = new Set(opts.solved || []);
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;background:#05070a;z-index:80;padding:5%;overflow:auto;color:#d6e1e8;font-family:monospace";
  const diffColor = (d) =>
    d === "EXPERT" ? "#c9a6ff" : d === "HARD" ? "#ff4b4b" : d === "TUTORIAL" ? "#39ff14" : "#ffb000";

  overlay.innerHTML =
    `<h1 style="color:#ffb000;letter-spacing:2px">SELECT A CASE</h1>
     <p style="color:#5a6b7a">Start with the training case if you're new. Harder cases have tougher skill checks, encrypted data, and trickier trails.</p>
     <div id="cs-list"></div>`;
  const list = overlay.querySelector("#cs-list");

  cases.forEach((c) => {
    const card = document.createElement("div");
    card.style.cssText =
      "border:1px solid #22303d;background:#0b131c;padding:14px;margin:10px 0;cursor:pointer";
    const isSolved = solved.has(c.id);
    const solvedBadge = isSolved ? ` <span style="color:#39ff14;font-size:12px">✓ SOLVED</span>` : "";
    card.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:center">
         <span style="color:#26d9ff;font-weight:bold">CASE #${c.id} — ${c.name}${solvedBadge}</span>
         <span style="color:${diffColor(c.difficulty)};border:1px solid ${diffColor(c.difficulty)};padding:2px 8px;font-size:12px">${c.difficulty}</span>
       </div>
       <div style="color:#8aa;margin-top:8px;font-size:13px;line-height:1.5">${c.brief}</div>
       <button class="primary" style="margin-top:10px">${isSolved ? "Replay →" : "Investigate →"}</button>`;
    const go = () => { audio.sfx("confirm"); document.body.removeChild(overlay); onPick(c.id); };
    card.querySelector("button").onclick = go;
    card.onmouseenter = () => audio.sfx("move");
    list.appendChild(card);
  });

  document.body.appendChild(overlay);
}

// Title / landing screen. Animated logo, tagline, and start buttons.
// Calls onStart("new") or onStart("continue"). Shows Continue if a save exists.
export function showTitleScreen(onStart, save = null) {
  const overlay = document.createElement("div");
  overlay.id = "title-screen";
  const continueBtn = save
    ? `<button id="title-continue" class="primary title-start">▶ CONTINUE — ${save.name}, Lv ${save.level} (${save.solvedCount} solved)</button>`
    : "";
  overlay.innerHTML = `
    <canvas id="title-fx" width="800" height="600"></canvas>
    <div class="title-content">
      <div class="title-logo">GREPOIRE</div>
      <div class="title-sub">the grep meets the grimoire</div>
      <div class="title-tag">A digital forensics investigation RPG</div>
      ${continueBtn}
      <button id="title-start" class="primary title-start">${save ? "✦ NEW GAME" : "▶ ENTER THE ARCHIVE"}</button>
      <div class="title-credit">a MORG systems production</div>
    </div>`;
  document.body.appendChild(overlay);

  // Falling "data rune" rain behind the logo (matrix-ish, arcane palette).
  const canvas = overlay.querySelector("#title-fx");
  const ctx = canvas.getContext("2d");
  const glyphs = "01<>{}/\\|=+*#ᚠᚢᚦᚨᚱᚲᚷᛈᛉᛊ$%&".split("");
  const cols = Math.floor(canvas.width / 16);
  const drops = Array.from({ length: cols }, () => Math.floor((Math.random() * -canvas.height) / 16));
  let raf;
  const draw = () => {
    ctx.fillStyle = "rgba(5,7,10,0.12)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "14px monospace";
    for (let i = 0; i < cols; i++) {
      const g = glyphs[Math.floor(Math.random() * glyphs.length)];
      const x = i * 16;
      const y = drops[i] * 16;
      ctx.fillStyle = Math.random() > 0.97 ? "#c9a6ff" : "#2a7d6a";
      ctx.fillText(g, x, y);
      if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
    raf = requestAnimationFrame(draw);
  };
  draw();

  const start = (choice) => {
    audio.sfx("confirm");
    cancelAnimationFrame(raf);
    overlay.classList.add("title-fade");
    setTimeout(() => { overlay.remove(); onStart(choice); }, 400);
  };
  overlay.querySelector("#title-start").onclick = () => start("new");
  const cont = overlay.querySelector("#title-continue");
  if (cont) cont.onclick = () => start("continue");
}

// Level-up celebration popup. Shows the new level and any stat-point award.
export function showLevelUp(level, statPoints) {
  const overlay = document.createElement("div");
  overlay.className = "levelup-overlay";
  overlay.innerHTML = `
    <div class="levelup-box">
      <div class="levelup-burst"></div>
      <div class="levelup-title">LEVEL UP</div>
      <div class="levelup-level">Level ${level}</div>
      <div class="levelup-sub">+${statPoints} skill point${statPoints === 1 ? "" : "s"} — spend them on the Evidence Board</div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.classList.add("fade-out");
    setTimeout(() => overlay.remove(), 400);
  }, 1900);
}

// The Adventurer's Codex — an in-game journal with tabs: the character sheet,
// the quest log, collected evidence/notes, and the world lore.
export function showCodex({ character, cases, solved, activeCaseId, lore, onClose }) {
  const { WORLD, CODEX_LORE, DISCIPLINES, FACTIONS, rankTitle } = lore;
  const solvedSet = new Set(solved || []);
  const overlay = document.createElement("div");
  overlay.className = "codex-overlay";
  overlay.innerHTML = `
    <div class="codex">
      <div class="codex-head">
        <span class="codex-title">⚜ THE ADVENTURER'S CODEX</span>
        <button class="codex-close">✕ Close</button>
      </div>
      <div class="codex-tabs">
        <button data-tab="sheet" class="active">Character</button>
        <button data-tab="quests">Quest Log</button>
        <button data-tab="evidence">Evidence</button>
        <button data-tab="lore">World Codex</button>
      </div>
      <div class="codex-body"></div>
    </div>`;
  document.body.appendChild(overlay);

  const body = overlay.querySelector(".codex-body");
  const mod = (v) => { const m = Math.floor((v - 10) / 2); return (m >= 0 ? "+" : "") + m; };

  const renderSheet = () => {
    const c = character;
    body.innerHTML = `
      <div class="codex-sheet">
        <div class="cs-name">${c.name}</div>
        <div class="cs-rank">${rankTitle(c.level)} · ${c.backgroundName}</div>
        <div class="cs-xp">Level ${c.level} · ${c.xp} XP${c.statPoints ? ` · <span style="color:#39ff14">${c.statPoints} unspent discipline points</span>` : ""}</div>
        <div class="cs-boon">✦ Boon: ${c.perk}</div>
        <table class="cs-table">
          <tr><th>Discipline</th><th>Score</th><th>Mod</th><th>Arcane School</th></tr>
          ${Object.entries(c.stats).map(([k, v]) =>
            `<tr><td>${k}</td><td>${v}</td><td>${mod(v)}</td><td class="cs-school">${DISCIPLINES[k] ? DISCIPLINES[k].school + " — " + DISCIPLINES[k].flavor : ""}</td></tr>`
          ).join("")}
        </table>
      </div>`;
  };

  const renderQuests = () => {
    body.innerHTML = `<div class="codex-section-title">Quest Log — by commission of ${WORLD.order}</div>` +
      cases.map((c) => {
        const done = solvedSet.has(c.id);
        const active = c.id === activeCaseId;
        const status = done ? `<span class="q-done">✓ COMPLETE</span>` : active ? `<span class="q-active">◉ ACTIVE</span>` : `<span class="q-open">○ AVAILABLE</span>`;
        return `<div class="codex-quest ${done ? "done" : ""}">
          <div class="q-head"><span class="q-name">#${c.id} — ${c.name}</span> ${status} <span class="q-diff">${c.difficulty}</span></div>
          ${c.questGiver ? `<div class="q-giver">Commissioned by ${c.questGiver}</div>` : ""}
          <div class="q-brief">${c.brief}</div>
        </div>`;
      }).join("");
  };

  const renderEvidence = () => {
    const c = character;
    body.innerHTML =
      `<div class="codex-section-title">Evidence sealed for the current quest</div>` +
      (c.evidence && c.evidence.length
        ? c.evidence.map((e) => `<div class="codex-ev"><span class="ev-id">[${e.id}] ${e.host || ""}</span><div>${e.name} — ${e.desc || e.summary || ""}</div></div>`).join("")
        : `<div class="codex-dim">No evidence sealed yet. Explore the locations and 'tag' key artifacts.</div>`) +
      (c.notes && c.notes.length
        ? `<div class="codex-section-title">Field notes</div>` + c.notes.map((n) => `<div class="codex-note">• ${n}</div>`).join("")
        : "");
  };

  const renderLore = () => {
    body.innerHTML = `
      <div class="codex-section-title">${WORLD.realm} — a primer</div>
      <div class="lore-intro">${WORLD.intro}</div>
      <div class="codex-section-title">Arcane glossary</div>
      ${CODEX_LORE.map((l) => `<div class="lore-entry"><b>${l.term}</b> — ${l.text}</div>`).join("")}
      <div class="codex-section-title">Factions of the Archive</div>
      ${FACTIONS.map((f) => `<div class="lore-entry"><b>${f.name}</b> <span class="lore-align">(${f.align})</span> — ${f.text}</div>`).join("")}
    `;
  };

  const tabs = { sheet: renderSheet, quests: renderQuests, evidence: renderEvidence, lore: renderLore };
  overlay.querySelectorAll(".codex-tabs button").forEach((btn) => {
    btn.onclick = () => {
      overlay.querySelectorAll(".codex-tabs button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      audio.sfx("select");
      tabs[btn.dataset.tab]();
    };
  });

  const close = () => { overlay.remove(); onClose?.(); };
  overlay.querySelector(".codex-close").onclick = close;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  renderSheet();
  return { close };
}

// Settings panel — volume sliders + reset save. `audio` is the engine,
// `onResetSave` wipes the save and returns to the title.
export function showSettings({ audio, onResetSave, onClose }) {
  const vols = audio.getVolumes ? audio.getVolumes() : { master: 0.6, music: 0.6, sfx: 0.5 };
  const overlay = document.createElement("div");
  overlay.className = "settings-overlay";
  overlay.innerHTML = `
    <div class="settings-box">
      <div class="settings-head"><span>⚙ SETTINGS</span><button class="settings-close">✕</button></div>
      <div class="setting-row">
        <label>Master volume</label>
        <input type="range" min="0" max="1" step="0.05" value="${vols.master}" data-vol="master" />
      </div>
      <div class="setting-row">
        <label>Music volume</label>
        <input type="range" min="0" max="1" step="0.05" value="${vols.music}" data-vol="music" />
      </div>
      <div class="setting-row">
        <label>Sound effects</label>
        <input type="range" min="0" max="1" step="0.05" value="${vols.sfx}" data-vol="sfx" />
      </div>
      <hr class="settings-hr" />
      <button class="settings-reset">⚠ Reset save &amp; return to title</button>
      <div class="settings-note">This permanently deletes your saved character and progress.</div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelectorAll("input[data-vol]").forEach((sl) => {
    sl.oninput = () => {
      const v = parseFloat(sl.value);
      if (sl.dataset.vol === "master") audio.setMasterVolume(v);
      if (sl.dataset.vol === "music") audio.setMusicVolume(v);
      if (sl.dataset.vol === "sfx") { audio.setSfxVolume(v); audio.sfx("select"); }
    };
  });

  const close = () => { overlay.remove(); onClose?.(); };
  overlay.querySelector(".settings-close").onclick = close;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  overlay.querySelector(".settings-reset").onclick = () => {
    overlay.querySelector(".settings-reset").textContent = "Click again to confirm reset";
    overlay.querySelector(".settings-reset").onclick = () => { close(); onResetSave?.(); };
  };
  return { close };
}
