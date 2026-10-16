/* =========================================================================
   CipherTrace — Game engine
   Plain JS, no dependencies. Drives screens, HUD, timer, scoring,
   difficulty levels, customizable character perks, sound, quickplay,
   a multi-stage BOSS mission, and a persistent leaderboard.
   ========================================================================= */

(function () {
  "use strict";

  // ----- Tunable constants -----
  const BASE_LIVES = 3;
  const BASE_POINTS = 100;
  const TIME_BONUS = 5;
  const WRONG_PENALTY = 25;
  const STORE_KEY = "ciphertrace.progress.v1";
  const PREF_KEY = "ciphertrace.prefs.v1";
  const CHAR_KEY = "ciphertrace.characters.v1";

  // ----- Difficulty definitions -----
  const DIFFICULTIES = {
    easy:   { label: "EASY",   livesMod: +2, timeMult: 1.5, scoreMult: 0.8 },
    normal: { label: "NORMAL", livesMod: 0,  timeMult: 1.0, scoreMult: 1.0 },
    hard:   { label: "HARD",   livesMod: -1, timeMult: 0.6, scoreMult: 1.5 },
  };

  // Perk tuning limits (keep customization balanced)
  const PERK_LIMITS = {
    bonusLives: { min: 0, max: 3 },
    timeMult:   { min: 1.0, max: 1.5, step: 0.05 },
    scoreMult:  { min: 1.0, max: 1.5, step: 0.05 },
  };
  const ICON_CHOICES = ["🧠", "🕵️", "🛡️", "⚡", "🦊", "🐍", "🦅", "👾", "🤖", "🥷", "🔮", "🧨"];

  // ----- Working character roster (deep-cloned from defaults, then customized) -----
  let roster = [];

  // ----- State -----
  const state = {
    score: 0,
    lives: BASE_LIVES,
    cleared: new Set(),
    current: null,
    selectedIndex: null,
    caesarShift: 0,
    timeLeft: 0,
    timerId: null,
    answered: false,
    difficulty: "normal",
    character: null,
    mode: "campaign",       // "campaign" | "quickplay" | "boss"
    runCleared: new Set(),
    // boss sub-state
    bossStage: 0,
    editingCharId: null,
    // achievement tracking
    streak: 0,
    perfectRun: true,
  };

  // ----- DOM helpers -----
  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  // ----- Screens -----
  const screens = {
    start: $("#screen-start"),
    howto: $("#screen-howto"),
    setup: $("#screen-setup"),
    editor: $("#screen-editor"),
    board: $("#screen-board"),
    achievements: $("#screen-achievements"),
    select: $("#screen-select"),
    play: $("#screen-play"),
    end: $("#screen-end"),
  };

  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
    const hudScreens = ["select", "play", "end"];
    $("#hud").classList.toggle("hidden", !hudScreens.includes(name));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ----- Character roster persistence -----
  function defaultRoster() {
    return CHARACTERS.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      title: c.title,
      blurb: c.blurb,
      perk: { ...c.perk },
    }));
  }
  function buildPerkLabel(perk) {
    const parts = [];
    if (perk.bonusLives > 0) parts.push(`+${perk.bonusLives} ${perk.bonusLives === 1 ? "life" : "lives"}`);
    if (perk.timeMult > 1.0) parts.push(`+${Math.round((perk.timeMult - 1) * 100)}% time`);
    if (perk.scoreMult > 1.0) parts.push(`+${Math.round((perk.scoreMult - 1) * 100)}% score`);
    return parts.length ? parts.join(" · ") : "balanced";
  }
  function loadRoster() {
    roster = defaultRoster();
    try {
      const saved = JSON.parse(localStorage.getItem(CHAR_KEY) || "null");
      if (Array.isArray(saved)) {
        saved.forEach((s) => {
          const target = roster.find((r) => r.id === s.id);
          if (target && s.perk) {
            target.name = String(s.name || target.name).slice(0, 12);
            target.icon = s.icon || target.icon;
            target.blurb = s.blurb || target.blurb;
            target.perk.bonusLives = clamp(s.perk.bonusLives, PERK_LIMITS.bonusLives);
            target.perk.timeMult = clamp(s.perk.timeMult, PERK_LIMITS.timeMult);
            target.perk.scoreMult = clamp(s.perk.scoreMult, PERK_LIMITS.scoreMult);
            target.perk.label = buildPerkLabel(target.perk);
          }
        });
      }
    } catch (_) { /* ignore */ }
    roster.forEach((r) => { r.perk.label = buildPerkLabel(r.perk); });
  }
  function saveRoster() {
    try { localStorage.setItem(CHAR_KEY, JSON.stringify(roster)); } catch (_) { /* ignore */ }
  }
  function clamp(v, lim) {
    v = Number(v);
    if (isNaN(v)) v = lim.min;
    return Math.min(lim.max, Math.max(lim.min, v));
  }

  // ----- Progress + prefs persistence -----
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) state.cleared = new Set(JSON.parse(raw));
    } catch (_) { /* ignore */ }
    try {
      const prefs = JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
      if (prefs.difficulty && DIFFICULTIES[prefs.difficulty]) state.difficulty = prefs.difficulty;
      if (prefs.character) {
        const c = roster.find((x) => x.id === prefs.character);
        if (c) state.character = c;
      }
    } catch (_) { /* ignore */ }
    if (!state.character) state.character = roster[0];
  }
  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify([...state.cleared])); } catch (_) { /* ignore */ }
  }
  function savePrefs() {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({
        difficulty: state.difficulty,
        character: state.character.id,
      }));
    } catch (_) { /* ignore */ }
  }

  // ----- Derived helpers -----
  function startingLives() {
    const d = DIFFICULTIES[state.difficulty];
    return Math.max(1, BASE_LIVES + d.livesMod + state.character.perk.bonusLives);
  }
  function missionTime(m) {
    const d = DIFFICULTIES[state.difficulty];
    return Math.max(15, Math.round(m.time * d.timeMult * state.character.perk.timeMult));
  }
  function scoreMultiplier() {
    const d = DIFFICULTIES[state.difficulty];
    return d.scoreMult * state.character.perk.scoreMult;
  }
  function campaignComplete() {
    return MISSIONS.every((m) => state.cleared.has(m.id));
  }
  function bossCleared() {
    return state.cleared.has(BOSS.id);
  }

  // ----- Achievements plumbing -----
  function isCustomAgent(c) {
    const def = CHARACTERS.find((d) => d.id === c.id);
    if (!def) return true;
    return (
      c.name !== def.name || c.icon !== def.icon || c.blurb !== def.blurb ||
      c.perk.bonusLives !== def.perk.bonusLives ||
      c.perk.timeMult !== def.perk.timeMult ||
      c.perk.scoreMult !== def.perk.scoreMult
    );
  }
  function achCtx(type, extra) {
    return Object.assign({
      type,
      score: state.score,
      streak: state.streak,
      perfectRun: state.perfectRun,
      timeLeft: state.timeLeft,
      difficulty: state.difficulty,
      mode: state.mode,
      solved: state.runCleared.size,
      totalCleared: state.cleared.size,
      customAgent: isCustomAgent(state.character),
    }, extra || {});
  }
  function fireAchievements(type, extra) {
    const newly = Achievements.check(achCtx(type, extra));
    newly.forEach((a, i) => showToast(a, i));
  }
  function showToast(a, index) {
    const host = $("#toast-host");
    const t = el("div", "toast");
    t.innerHTML =
      `<div class="toast-icon">${a.icon}</div>` +
      `<div><div class="toast-title">ACHIEVEMENT UNLOCKED</div>` +
      `<div class="toast-name">${a.name}</div>` +
      `<div class="toast-desc">${a.desc}</div></div>`;
    host.appendChild(t);
    setTimeout(() => SFX.play("correct"), index * 180);
    // enter
    requestAnimationFrame(() => t.classList.add("in"));
    // exit
    setTimeout(() => {
      t.classList.remove("in");
      setTimeout(() => t.remove(), 400);
    }, 4200 + index * 400);
  }

  // ----- HUD -----
  function renderHud() {
    const total = MISSIONS.length;
    const done = state.mode === "campaign" ? state.cleared.size : state.runCleared.size;
    $("#hud-level").textContent = state.mode === "boss" ? "BOSS" : "LVL " + Math.min(done + 1, total);
    $("#hud-score").textContent = state.score;
    $("#hud-lives").textContent = state.lives > 0 ? "♥ ".repeat(state.lives).trim() : "—";
    $("#hud-timer").textContent = state.timeLeft > 0 ? state.timeLeft + "s" : "--";
    $("#hud-agent").textContent = state.character.icon + " " + state.character.name;
    $("#hud-diff").textContent = DIFFICULTIES[state.difficulty].label;
  }

  // ----- Timer -----
  function startTimer(seconds) {
    stopTimer();
    state.timeLeft = seconds;
    renderHud();
    $("#hud-timer").classList.remove("warn");
    state.timerId = setInterval(() => {
      state.timeLeft--;
      if (state.timeLeft <= 10) {
        $("#hud-timer").classList.add("warn");
        if (state.timeLeft > 0) SFX.play("tick");
      }
      renderHud();
      if (state.timeLeft <= 0) { stopTimer(); onTimeout(); }
    }, 1000);
  }
  function stopTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = null;
    $("#hud-timer").classList.remove("warn");
  }

  function diffBadge(d) {
    return `<span class="diff-pill diff-${d}">${d.toUpperCase()}</span>`;
  }

  // ================= SETUP SCREEN =================
  function renderSetup() {
    const dWrap = $("#difficulty-choices");
    dWrap.innerHTML = "";
    Object.keys(DIFFICULTIES).forEach((key) => {
      const d = DIFFICULTIES[key];
      const b = el("button", "choice-card" + (state.difficulty === key ? " selected" : ""));
      const livesTxt = d.livesMod === 0 ? "base lives" : (d.livesMod > 0 ? `+${d.livesMod} lives` : `${d.livesMod} life`);
      b.innerHTML =
        `<div class="choice-title diff-${key}">${d.label}</div>` +
        `<div class="choice-sub">${Math.round(d.timeMult * 100)}% time · ${Math.round(d.scoreMult * 100)}% score · ${livesTxt}</div>`;
      b.addEventListener("click", () => { state.difficulty = key; savePrefs(); SFX.play("select"); renderSetup(); });
      dWrap.appendChild(b);
    });

    const cWrap = $("#character-choices");
    cWrap.innerHTML = "";
    roster.forEach((c) => {
      const b = el("button", "choice-card char-card" + (state.character.id === c.id ? " selected" : ""));
      b.innerHTML =
        `<div class="char-icon">${c.icon}</div>` +
        `<div class="choice-title">${c.name}</div>` +
        `<div class="char-role">${c.title}</div>` +
        `<div class="choice-sub">${c.blurb}</div>` +
        `<div class="perk-pill">⚡ ${c.perk.label}</div>` +
        `<div class="edit-link" data-edit="${c.id}">✎ customize</div>`;
      b.addEventListener("click", (e) => {
        if (e.target && e.target.dataset.edit) { openEditor(c.id); return; }
        state.character = c; savePrefs(); SFX.play("select"); renderSetup();
      });
      cWrap.appendChild(b);
    });

    // boss availability note
    const bossNote = $("#boss-note");
    if (campaignComplete()) {
      bossNote.innerHTML = bossCleared()
        ? "💀 Boss defeated — replay it anytime from the mission board."
        : "💀 BOSS UNLOCKED! Finish setup, then launch Campaign to face it.";
      bossNote.classList.remove("hidden");
    } else {
      bossNote.classList.add("hidden");
    }

    renderHud();
  }

  // ================= CHARACTER EDITOR =================
  function openEditor(id) {
    SFX.play("click");
    state.editingCharId = id;
    const c = roster.find((r) => r.id === id);
    if (!c) return;

    $("#editor-title").textContent = "CUSTOMIZE: " + c.name;
    $("#edit-name").value = c.name;
    $("#edit-blurb").value = c.blurb;

    // icon picker
    const iconWrap = $("#edit-icons");
    iconWrap.innerHTML = "";
    const icons = ICON_CHOICES.includes(c.icon) ? ICON_CHOICES : [c.icon, ...ICON_CHOICES];
    icons.forEach((ic) => {
      const b = el("button", "icon-opt" + (c.icon === ic ? " active" : ""), ic);
      b.addEventListener("click", () => {
        c.icon = ic;
        [...iconWrap.children].forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        SFX.play("click");
      });
      iconWrap.appendChild(b);
    });

    // perk sliders
    $("#edit-lives").min = PERK_LIMITS.bonusLives.min;
    $("#edit-lives").max = PERK_LIMITS.bonusLives.max;
    $("#edit-lives").step = 1;
    $("#edit-lives").value = c.perk.bonusLives;

    $("#edit-time").min = PERK_LIMITS.timeMult.min;
    $("#edit-time").max = PERK_LIMITS.timeMult.max;
    $("#edit-time").step = PERK_LIMITS.timeMult.step;
    $("#edit-time").value = c.perk.timeMult;

    $("#edit-score").min = PERK_LIMITS.scoreMult.min;
    $("#edit-score").max = PERK_LIMITS.scoreMult.max;
    $("#edit-score").step = PERK_LIMITS.scoreMult.step;
    $("#edit-score").value = c.perk.scoreMult;

    updateEditorReadout();
    show("editor");
  }

  function updateEditorReadout() {
    const lives = Number($("#edit-lives").value);
    const t = Number($("#edit-time").value);
    const s = Number($("#edit-score").value);
    $("#edit-lives-val").textContent = "+" + lives;
    $("#edit-time-val").textContent = "+" + Math.round((t - 1) * 100) + "%";
    $("#edit-score-val").textContent = "+" + Math.round((s - 1) * 100) + "%";
    // live preview label
    $("#edit-preview").textContent = "⚡ " + buildPerkLabel({ bonusLives: lives, timeMult: t, scoreMult: s });
  }

  function saveEditor() {
    const c = roster.find((r) => r.id === state.editingCharId);
    if (!c) return;
    const name = $("#edit-name").value.trim().slice(0, 12) || c.name;
    c.name = name.toUpperCase();
    c.blurb = $("#edit-blurb").value.trim().slice(0, 90) || c.blurb;
    c.perk.bonusLives = clamp($("#edit-lives").value, PERK_LIMITS.bonusLives);
    c.perk.timeMult = clamp($("#edit-time").value, PERK_LIMITS.timeMult);
    c.perk.scoreMult = clamp($("#edit-score").value, PERK_LIMITS.scoreMult);
    c.perk.label = buildPerkLabel(c.perk);
    saveRoster();
    SFX.play("correct");
    renderSetup();
    show("setup");
  }

  function resetEditorChar() {
    const def = CHARACTERS.find((d) => d.id === state.editingCharId);
    const c = roster.find((r) => r.id === state.editingCharId);
    if (!def || !c) return;
    c.name = def.name; c.icon = def.icon; c.blurb = def.blurb;
    c.perk = { ...def.perk };
    saveRoster();
    SFX.play("select");
    openEditor(c.id);
  }

  // ================= LEADERBOARD SCREEN =================
  function renderBoard() {
    const wrap = $("#board-body");
    const rows = Leaderboard.all();
    if (!rows.length) {
      wrap.innerHTML = `<p class="sub">No scores yet. Be the first to make the board!</p>`;
    } else {
      let html = `<table class="board-table"><thead><tr>` +
        `<th>#</th><th>AGENT</th><th>SCORE</th><th>MODE</th><th>DIFF</th><th>SOLVED</th></tr></thead><tbody>`;
      rows.forEach((r, i) => {
        html += `<tr class="${i === 0 ? "top" : ""}">` +
          `<td>${i + 1}</td><td>${escapeHtml(r.name)}</td><td class="b-score">${r.score}</td>` +
          `<td>${r.mode}</td><td class="diff-${r.difficulty}">${r.difficulty.toUpperCase()}</td>` +
          `<td>${r.solved}/${r.total}</td></tr>`;
      });
      html += `</tbody></table>`;
      wrap.innerHTML = html;
    }
    show("board");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  // ================= ACHIEVEMENTS SCREEN =================
  function renderAchievements() {
    const list = Achievements.all();
    const got = Achievements.unlockedCount();
    const total = Achievements.total();
    $("#ach-progress").textContent = `${got} / ${total} unlocked`;
    const wrap = $("#ach-body");
    wrap.innerHTML = "";
    list.forEach((a) => {
      const card = el("div", "ach-card" + (a.unlocked ? " got" : " locked"));
      card.innerHTML =
        `<div class="ach-icon">${a.unlocked ? a.icon : "🔒"}</div>` +
        `<div><div class="ach-name">${a.unlocked ? a.name : "???"}</div>` +
        `<div class="ach-desc">${a.desc}</div></div>`;
      wrap.appendChild(card);
    });
    show("achievements");
  }

  // ================= MISSION SELECT (campaign) =================
  function renderSelect() {
    const grid = $("#mission-grid");
    grid.innerHTML = "";
    MISSIONS.forEach((m) => {
      const card = el("div", "mission-card " + m.track);
      if (state.cleared.has(m.id)) card.classList.add("cleared");
      card.innerHTML =
        `<div class="mc-track">${m.track === "crypto" ? "🔐 CRYPTOGRAPHY" : "🔍 FORENSICS"} ${diffBadge(m.difficulty)}</div>` +
        `<div class="mc-icon">${m.icon}</div>` +
        `<div class="mc-title">${m.title}</div>` +
        `<div class="mc-desc">${m.desc}</div>`;
      card.addEventListener("click", () => { SFX.play("click"); startMission(m); });
      grid.appendChild(card);
    });

    // Boss card (locked until campaign complete)
    const unlocked = campaignComplete();
    const boss = el("div", "mission-card boss-card" + (unlocked ? "" : " locked") + (bossCleared() ? " cleared" : ""));
    boss.innerHTML =
      `<div class="mc-track boss-track">💀 FINAL BOSS</div>` +
      `<div class="mc-icon">${unlocked ? BOSS.icon : "🔒"}</div>` +
      `<div class="mc-title">${BOSS.title.replace("BOSS: ", "")}</div>` +
      `<div class="mc-desc">${unlocked ? "A 3-stage finale under one timer. Big reward." : "Clear all missions above to unlock."}</div>`;
    if (unlocked) boss.addEventListener("click", () => { SFX.play("start"); startBoss(); });
    grid.appendChild(boss);

    renderHud();
  }

  // ================= QUICKPLAY =================
  function quickplayNext() {
    let pool = MISSIONS.filter((m) => !state.runCleared.has(m.id));
    if (pool.length === 0) pool = MISSIONS.slice();
    startMission(pool[Math.floor(Math.random() * pool.length)]);
  }

  // ================= REGULAR MISSION =================
  function startMission(m) {
    state.current = m;
    state.selectedIndex = null;
    state.caesarShift = 0;
    state.answered = false;

    $("#play-tag").textContent = m.track === "crypto" ? "CRYPTOGRAPHY" : "FORENSICS";
    $("#play-tag").className = "tag" + (m.track === "crypto" ? " crypto" : "");
    $("#play-diff").innerHTML = diffBadge(m.difficulty);
    $("#play-title").textContent = m.icon + " " + m.title;
    $("#play-brief").textContent = m.brief;

    const body = $("#play-body");
    body.innerHTML = "";
    if (m.evidence) body.appendChild(el("div", "evidence", m.evidence));

    if (m.type === "choice") renderChoice(body, m.options);
    else if (m.type === "input") renderInput(body, "Type your answer and press SUBMIT");
    else if (m.type === "caesar") renderCaesar(body, m);

    if (m.hint) body.appendChild(el("div", "hint", "💡 Hint: " + m.hint));

    resetPlayControls();
    $("#btn-continue").textContent = state.mode === "quickplay" ? "NEXT RANDOM ▶" : "CONTINUE ▶";
    show("play");
    startTimer(missionTime(m));
  }

  // ================= BOSS =================
  function startBoss() {
    state.mode = "boss";
    state.score = state.score || 0;   // keep accumulated campaign-run score if coming from a run
    if (state.lives == null || state.lives <= 0) state.lives = startingLives();
    state.bossStage = 0;
    state.current = BOSS;
    renderHud();
    renderBossStage();
    // One shared timer for the whole fight (scaled by difficulty/perk)
    startTimer(missionTime(BOSS));
  }

  function renderBossStage() {
    const stage = BOSS.stages[state.bossStage];
    state.selectedIndex = null;
    state.answered = false;

    $("#play-tag").textContent = "⚠ BOSS";
    $("#play-tag").className = "tag boss-tag";
    $("#play-diff").innerHTML = `<span class="diff-pill diff-hard">STAGE ${state.bossStage + 1}/${BOSS.stages.length}</span>`;
    $("#play-title").textContent = BOSS.icon + " " + BOSS.title.replace("BOSS: ", "");
    $("#play-brief").textContent = state.bossStage === 0 ? BOSS.intro + "\n\n" + stage.prompt : stage.prompt;

    const body = $("#play-body");
    body.innerHTML = "";
    if (stage.evidence) body.appendChild(el("div", "evidence", stage.evidence));
    if (stage.type === "choice") renderChoice(body, stage.options);
    else renderInput(body, "Decode and type the answer");
    if (stage.hint) body.appendChild(el("div", "hint", "💡 Hint: " + stage.hint));

    resetPlayControls();
    show("play");
  }

  // ----- shared play helpers -----
  function resetPlayControls() {
    const fb = $("#play-feedback");
    fb.className = "feedback hidden";
    fb.innerHTML = "";
    $("#btn-submit").classList.remove("hidden");
    $("#btn-submit").disabled = false;
    $("#btn-continue").classList.add("hidden");
  }

  function renderChoice(body, options) {
    const wrap = el("div", "options");
    options.forEach((opt, i) => {
      const b = el("button", "option", opt);
      b.addEventListener("click", () => {
        if (state.answered) return;
        state.selectedIndex = i;
        [...wrap.children].forEach((c) => c.classList.remove("selected"));
        b.classList.add("selected");
        SFX.play("select");
      });
      wrap.appendChild(b);
    });
    body.appendChild(wrap);
  }

  function renderInput(body, placeholder) {
    const inp = el("input", "text-input");
    inp.type = "text";
    inp.id = "answer-input";
    inp.placeholder = placeholder;
    inp.autocomplete = "off";
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && !state.answered) submit(); });
    body.appendChild(inp);
    setTimeout(() => inp.focus(), 50);
  }

  function renderCaesar(body, m) {
    body.appendChild(el("div", "hint", "Pick a shift to decode. When it reads as English, type the plaintext below."));
    const wheel = el("div", "wheel");
    for (let s = 0; s <= 25; s++) {
      const b = el("button", "wheel-btn", String(s));
      b.addEventListener("click", () => {
        state.caesarShift = s;
        [...wheel.children].forEach((c) => c.classList.remove("active"));
        b.classList.add("active");
        preview.textContent = caesarDecode(m.cipher, s);
        SFX.play("click");
      });
      wheel.appendChild(b);
    }
    body.appendChild(wheel);
    const preview = el("div", "shift-preview", m.cipher);
    body.appendChild(preview);
    const inp = el("input", "text-input");
    inp.type = "text"; inp.id = "answer-input"; inp.placeholder = "Type the decoded plaintext";
    inp.autocomplete = "off"; inp.style.marginTop = "12px";
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && !state.answered) submit(); });
    body.appendChild(inp);
  }

  function caesarDecode(text, s) {
    return text.replace(/[a-z]/gi, (ch) => {
      const base = ch <= "Z" ? 65 : 97;
      return String.fromCharCode(((ch.charCodeAt(0) - base - s + 26) % 26) + base);
    });
  }

  function normalize(s) { return String(s).toLowerCase().replace(/\s+/g, " ").trim(); }

  // ----- Submit / grading -----
  function submit() {
    if (state.answered) return;
    if (state.mode === "boss") return submitBoss();

    const m = state.current;
    let correct = false;
    if (m.type === "choice") {
      if (state.selectedIndex == null) { flash("Select an option first."); return; }
      correct = state.selectedIndex === m.answer;
    } else {
      const inp = $("#answer-input");
      const val = (inp ? inp.value : "").trim();
      if (!val) { flash("Type an answer first."); return; }
      correct = normalize(val) === normalize(m.answer);
    }
    grade(correct);
  }

  function onTimeout() {
    if (state.answered) return;
    if (state.mode === "boss") { bossFail(true); return; }
    grade(false, true);
  }

  function grade(correct, timedOut) {
    state.answered = true;
    stopTimer();
    $("#btn-submit").classList.add("hidden");
    $("#btn-continue").classList.remove("hidden");

    const m = state.current;
    if (m.type === "choice") {
      document.querySelectorAll(".option").forEach((o, i) => {
        if (i === m.answer) o.classList.add("correct");
        if (i === state.selectedIndex && i !== m.answer) o.classList.add("wrong");
      });
    }

    const fb = $("#play-feedback");
    fb.classList.remove("hidden");

    if (correct) {
      SFX.play("correct");
      const mult = scoreMultiplier();
      const base = Math.round(BASE_POINTS * mult);
      const bonus = Math.round(state.timeLeft * TIME_BONUS * mult);
      const gained = base + bonus;
      state.score += gained;
      state.runCleared.add(m.id);
      state.streak++;
      if (state.mode === "campaign") { state.cleared.add(m.id); saveProgress(); }
      fb.className = "feedback good";
      fb.innerHTML =
        `<div class="fb-title">✓ CORRECT</div>` +
        `<div>+${base} base &nbsp;+${bonus} time bonus &nbsp;= <strong>${gained} pts</strong> ` +
        `<span class="mult-note">(×${mult.toFixed(2)} ${DIFFICULTIES[state.difficulty].label}/${state.character.name})</span></div>` +
        `<div class="learn"><strong>DEBRIEF:</strong> ${m.learn}</div>`;
      // achievement checks (order: clear event, then threshold-based)
      fireAchievements("missionClear");
      fireAchievements("score");
      if (state.mode === "campaign" && campaignComplete()) fireAchievements("campaignComplete");
    } else {
      SFX.play("wrong");
      state.lives--;
      state.streak = 0;
      state.perfectRun = false;
      state.score = Math.max(0, state.score - WRONG_PENALTY);
      fb.className = "feedback bad";
      const why = timedOut ? "⏱ TIME'S UP" : "✗ INCORRECT";
      const answerText = m.type === "choice" ? m.options[m.answer] : m.answer;
      fb.innerHTML =
        `<div class="fb-title">${why}</div>` +
        `<div>Correct answer: <strong>${answerText}</strong> &nbsp;(−${WRONG_PENALTY} pts, −1 ♥)</div>` +
        `<div class="learn"><strong>DEBRIEF:</strong> ${m.learn}</div>`;
    }
    renderHud();
  }

  // ----- Boss grading -----
  function submitBoss() {
    const stage = BOSS.stages[state.bossStage];
    let correct = false;
    if (stage.type === "choice") {
      if (state.selectedIndex == null) { flash("Select an option first."); return; }
      correct = state.selectedIndex === stage.answer;
    } else {
      const inp = $("#answer-input");
      const val = (inp ? inp.value : "").trim();
      if (!val) { flash("Type an answer first."); return; }
      correct = normalize(val) === normalize(stage.answer);
    }

    if (!correct) { bossFail(false); return; }

    // Stage cleared
    state.answered = true;
    state.streak++;
    SFX.play("correct");
    fireAchievements("bossStage");
    const fb = $("#play-feedback");
    fb.className = "feedback good";
    fb.classList.remove("hidden");
    $("#btn-submit").classList.add("hidden");
    $("#btn-continue").classList.remove("hidden");

    const last = state.bossStage === BOSS.stages.length - 1;
    fb.innerHTML =
      `<div class="fb-title">✓ LOCK ${state.bossStage + 1} BROKEN</div>` +
      `<div class="learn"><strong>DEBRIEF:</strong> ${stage.learn}</div>`;
    $("#btn-continue").textContent = last ? "FINISH ▶" : "NEXT LOCK ▶";
  }

  function bossFail(timedOut) {
    state.answered = true;
    stopTimer();
    SFX.play("wrong");
    state.lives = 0; // boss is all-or-nothing on a miss
    state.streak = 0;
    state.perfectRun = false;
    const stage = BOSS.stages[state.bossStage];
    const fb = $("#play-feedback");
    fb.className = "feedback bad";
    fb.classList.remove("hidden");
    $("#btn-submit").classList.add("hidden");
    $("#btn-continue").classList.remove("hidden");
    $("#btn-continue").textContent = "CONTINUE ▶";
    const why = timedOut ? "⏱ TIME'S UP — GLITCH escaped!" : "✗ WRONG — GLITCH slipped away!";
    fb.innerHTML =
      `<div class="fb-title">${why}</div>` +
      `<div>Lock ${state.bossStage + 1} answer: <strong>${stage.answer}</strong></div>` +
      `<div class="learn"><strong>DEBRIEF:</strong> ${stage.learn}</div>`;
    renderHud();
  }

  function bossWin() {
    SFX.play("win");
    state.score += BOSS.reward;
    state.runCleared.add(BOSS.id);
    state.cleared.add(BOSS.id);
    saveProgress();
    fireAchievements("bossWin");
    fireAchievements("score");
    endGame(true, "boss");
  }

  function flash(msg) {
    const fb = $("#play-feedback");
    fb.className = "feedback bad";
    fb.innerHTML = `<div class="fb-title">⚠</div><div>${msg}</div>`;
    fb.classList.remove("hidden");
    setTimeout(() => { if (!state.answered) fb.classList.add("hidden"); }, 1400);
  }

  // ----- Continue after a mission / stage -----
  function continueAfter() {
    SFX.play("click");

    if (state.mode === "boss") {
      if (state.lives <= 0) { endGame(false); return; }       // boss failed
      if (state.bossStage >= BOSS.stages.length - 1) { bossWin(); return; }
      state.bossStage++;
      renderBossStage();
      return;
    }

    if (state.lives <= 0) { endGame(false); return; }

    if (state.mode === "quickplay") {
      if (state.runCleared.size >= MISSIONS.length) { fireAchievements("quickplayComplete"); endGame(true); return; }
      quickplayNext();
      return;
    }

    // campaign
    if (campaignComplete() && !bossCleared()) {
      // offer the boss immediately after the last regular mission
      renderSelect();
      show("select");
      return;
    }
    renderSelect();
    show("select");
  }

  // ----- End screen + leaderboard capture -----
  function rankFor(score) {
    if (score >= 2500) return "LEGENDARY";
    if (score >= 1800) return "ELITE ANALYST";
    if (score >= 1100) return "FIELD AGENT";
    if (score >= 500) return "JUNIOR INVESTIGATOR";
    return "TRAINEE";
  }

  function endGame(won, kind) {
    stopTimer();
    const title = $("#end-title");
    if (won) {
      SFX.play(kind === "boss" ? "win" : "win");
      title.textContent = kind === "boss" ? "BOSS DEFEATED" :
        (state.mode === "quickplay" ? "QUICKPLAY CLEARED" : "ALL MISSIONS CLEARED");
      title.className = "win";
      $("#end-msg").textContent = kind === "boss"
        ? "GLITCH is locked out and the vault is secure. You are the Cyber Response Unit's finest, Agent."
        : "Outstanding work, Agent. You cleared every mission. The Cyber Response Unit salutes you.";
    } else {
      SFX.play("lose");
      title.textContent = "RUN ENDED";
      title.className = "lose";
      $("#end-msg").textContent =
        "You're out of lives this run — but every analyst learns from failure. Review the debriefs and try again.";
    }
    $("#end-score").textContent = state.score;
    $("#end-rank").textContent = rankFor(state.score);
    $("#end-detail").textContent =
      `${state.character.icon} ${state.character.name} · ${DIFFICULTIES[state.difficulty].label} · ` +
      `${state.mode === "quickplay" ? "Quickplay" : state.mode === "boss" ? "Boss" : "Campaign"} · ` +
      `${state.runCleared.size}/${MISSIONS.length} solved`;

    // Leaderboard capture
    maybeOfferLeaderboard();
    show("end");
  }

  function maybeOfferLeaderboard() {
    const entryWrap = $("#end-lb-entry");
    const savedWrap = $("#end-lb-saved");
    entryWrap.classList.add("hidden");
    savedWrap.classList.add("hidden");
    if (Leaderboard.qualifies(state.score)) {
      entryWrap.classList.remove("hidden");
      const input = $("#lb-name");
      input.value = state.character.name;
      $("#lb-save-msg").textContent = "🏆 You made the leaderboard! Enter a name:";
    }
  }

  function saveToBoard() {
    const name = ($("#lb-name").value || state.character.name).trim();
    const rank = Leaderboard.add({
      name,
      score: state.score,
      mode: state.mode,
      difficulty: state.difficulty,
      agent: state.character.name,
      solved: state.runCleared.size,
      total: MISSIONS.length,
    });
    SFX.play("correct");
    $("#end-lb-entry").classList.add("hidden");
    const saved = $("#end-lb-saved");
    saved.classList.remove("hidden");
    saved.innerHTML = `✅ Saved! You're <strong>#${rank}</strong> on the leaderboard. ` +
      `<button class="btn btn-ghost btn-sm" id="btn-view-board-end">VIEW BOARD</button>`;
    $("#btn-view-board-end").addEventListener("click", () => { SFX.play("click"); renderBoard(); });
  }

  // ----- Start a run -----
  function beginRun(mode) {
    state.mode = mode;
    state.score = 0;
    state.lives = startingLives();
    state.runCleared = new Set();
    state.streak = 0;
    state.perfectRun = true;
    renderHud();
    fireAchievements("runStart");       // "collector" + "designer" can fire here
    if (mode === "quickplay") { SFX.play("start"); quickplayNext(); }
    else { renderSelect(); show("select"); }
  }

  // ----- Mute -----
  function renderMute() {
    $("#btn-mute").textContent = SFX.isMuted() ? "🔇" : "🔊";
    $("#btn-mute").setAttribute("aria-label", SFX.isMuted() ? "Unmute" : "Mute");
  }

  // ----- Wire up events -----
  function init() {
    loadRoster();
    loadProgress();
    renderHud();
    renderMute();

    document.body.addEventListener("pointerdown", () => SFX.unlock(), { once: true });

    // Start screen
    $("#btn-start").addEventListener("click", () => { SFX.play("start"); renderSetup(); show("setup"); });
    $("#btn-howto").addEventListener("click", () => { SFX.play("click"); show("howto"); });
    $("#btn-board").addEventListener("click", () => { SFX.play("click"); renderBoard(); });
    $("#btn-achievements").addEventListener("click", () => { SFX.play("click"); renderAchievements(); });
    $("#btn-howto-back").addEventListener("click", () => { SFX.play("click"); show("start"); });

    // Setup
    $("#btn-launch-campaign").addEventListener("click", () => beginRun("campaign"));
    $("#btn-launch-quickplay").addEventListener("click", () => beginRun("quickplay"));
    $("#btn-setup-back").addEventListener("click", () => { SFX.play("click"); show("start"); });

    // Editor
    ["edit-lives", "edit-time", "edit-score"].forEach((id) => {
      $("#" + id).addEventListener("input", updateEditorReadout);
    });
    $("#btn-edit-save").addEventListener("click", saveEditor);
    $("#btn-edit-reset").addEventListener("click", resetEditorChar);
    $("#btn-edit-cancel").addEventListener("click", () => { SFX.play("click"); loadRoster(); renderSetup(); show("setup"); });

    // Board
    $("#btn-board-back").addEventListener("click", () => { SFX.play("click"); show("start"); });
    $("#btn-board-clear").addEventListener("click", () => { SFX.play("click"); Leaderboard.clear(); renderBoard(); });

    // Achievements
    $("#btn-ach-back").addEventListener("click", () => { SFX.play("click"); show("start"); });
    $("#btn-ach-view").addEventListener("click", () => { SFX.play("click"); renderAchievements(); });

    // Gameplay
    $("#btn-submit").addEventListener("click", submit);
    $("#btn-continue").addEventListener("click", continueAfter);
    $("#btn-abort").addEventListener("click", () => {
      SFX.play("click");
      stopTimer();
      if (state.mode === "quickplay" || state.mode === "boss") { renderSetup(); show("setup"); }
      else { renderSelect(); show("select"); }
    });

    // Mission select
    $("#btn-reset").addEventListener("click", () => {
      SFX.play("click"); state.cleared = new Set(); saveProgress(); renderSelect();
    });
    $("#btn-select-quickplay").addEventListener("click", () => beginRun("quickplay"));

    // End screen
    $("#btn-again").addEventListener("click", () => { SFX.play("click"); renderSetup(); show("setup"); });
    $("#btn-lb-save").addEventListener("click", saveToBoard);
    $("#btn-lb-skip").addEventListener("click", () => { SFX.play("click"); $("#end-lb-entry").classList.add("hidden"); });

    // Mute
    $("#btn-mute").addEventListener("click", () => {
      const nowMuted = SFX.toggleMute();
      if (!nowMuted) SFX.play("select");
      renderMute();
    });

    show("start");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
