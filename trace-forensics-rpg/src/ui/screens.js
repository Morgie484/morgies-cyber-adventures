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
  "TRACE OS v1.4 — Forensic Investigation Platform",
  "booting secure shell..............[ OK ]",
  "mounting evidence vault...........[ OK ]",
  "loading case files................[ OK ]",
  "",
  "CASE #4471 — OPERATION NIGHTJAR",
  "Meridian Dynamics reports a confidential client list has leaked.",
  "Your job: find out WHO, HOW, and WHEN.",
  "",
  ">> This is a training case. The game will guide you. <<",
  "",
  "[ click anywhere to begin ]",
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
      const gated = opt.requires && !hasEvidence(opt.requires);
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
export function showCaseSelect(cases, onPick) {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;background:#05070a;z-index:80;padding:5%;overflow:auto;color:#d6e1e8;font-family:monospace";
  const diffColor = (d) => (d === "HARD" ? "#ff4b4b" : d === "TUTORIAL" ? "#39ff14" : "#ffb000");

  overlay.innerHTML =
    `<h1 style="color:#ffb000;letter-spacing:2px">SELECT A CASE</h1>
     <p style="color:#5a6b7a">Start with the training case if you're new. Harder cases have tougher skill checks, encrypted data, and trickier trails.</p>
     <div id="cs-list"></div>`;
  const list = overlay.querySelector("#cs-list");

  cases.forEach((c) => {
    const card = document.createElement("div");
    card.style.cssText =
      "border:1px solid #22303d;background:#0b131c;padding:14px;margin:10px 0;cursor:pointer";
    card.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:center">
         <span style="color:#26d9ff;font-weight:bold">CASE #${c.id} — ${c.name}</span>
         <span style="color:${diffColor(c.difficulty)};border:1px solid ${diffColor(c.difficulty)};padding:2px 8px;font-size:12px">${c.difficulty}</span>
       </div>
       <div style="color:#8aa;margin-top:8px;font-size:13px;line-height:1.5">${c.brief}</div>
       <button class="primary" style="margin-top:10px">Investigate →</button>`;
    const go = () => { audio.sfx("confirm"); document.body.removeChild(overlay); onPick(c.id); };
    card.querySelector("button").onclick = go;
    card.onmouseenter = () => audio.sfx("move");
    list.appendChild(card);
  });

  document.body.appendChild(overlay);
}
