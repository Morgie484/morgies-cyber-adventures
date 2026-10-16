/* =========================================================================
   CipherTrace — Achievements
   Unlockable badges that persist in localStorage. The game engine reports
   events via Achievements.event(...) and run stats via check helpers;
   newly unlocked badges are returned so the engine can show toasts.

   Achievement shape:
   {
     id, icon, name, desc,
     test: (ctx) => boolean   // given the running context, is it earned now?
   }

   ctx fields supplied by the engine:
   {
     type:        the event ("correct","wrong","missionClear","bossWin",
                  "campaignComplete","quickplayComplete","runEnd")
     score:       current run score
     streak:      current correct-answer streak (resets on wrong)
     perfectRun:  true if the whole run had zero wrong answers so far
     timeLeft:    seconds left when a mission was answered
     difficulty:  "easy" | "normal" | "hard"
     mode:        "campaign" | "quickplay" | "boss"
     solved:      missions solved this run
     totalCleared:lifetime distinct missions cleared (campaign set size)
     customAgent: true if the active agent was edited from its default
   }
   ========================================================================= */

const Achievements = (function () {
  "use strict";

  const KEY = "ciphertrace.achievements.v1";

  const DEFS = [
    { id: "first_blood", icon: "🩸", name: "First Blood",
      desc: "Solve your first mission.",
      test: (c) => c.type === "missionClear" },

    { id: "streak_5", icon: "🔥", name: "On Fire",
      desc: "Get a streak of 5 correct answers in a row.",
      test: (c) => c.streak >= 5 },

    { id: "streak_10", icon: "⚡", name: "Unstoppable",
      desc: "Get a streak of 10 correct answers in a row.",
      test: (c) => c.streak >= 10 },

    { id: "clutch", icon: "⏱️", name: "Clutch",
      desc: "Answer correctly with 3 seconds or less left.",
      test: (c) => c.type === "missionClear" && c.timeLeft <= 3 },

    { id: "score_1k", icon: "💰", name: "Four Figures",
      desc: "Reach 1,000 points in a single run.",
      test: (c) => c.score >= 1000 },

    { id: "score_2k5", icon: "💎", name: "Legendary Haul",
      desc: "Reach 2,500 points in a single run.",
      test: (c) => c.score >= 2500 },

    { id: "boss_down", icon: "💀", name: "Boss Slayer",
      desc: "Defeat the final boss, GLITCH.",
      test: (c) => c.type === "bossWin" },

    { id: "campaign", icon: "🏅", name: "Case Closed",
      desc: "Clear every regular mission in Campaign.",
      test: (c) => c.type === "campaignComplete" },

    { id: "quickplay_all", icon: "🎲", name: "Deck Cleared",
      desc: "Solve every mission in a single Quickplay run.",
      test: (c) => c.type === "quickplayComplete" },

    { id: "flawless_hard", icon: "🥇", name: "Flawless on Hard",
      desc: "Beat the boss on HARD with no wrong answers in the run.",
      test: (c) => c.type === "bossWin" && c.difficulty === "hard" && c.perfectRun },

    { id: "collector", icon: "📚", name: "Collector",
      desc: "Clear 10 different missions across all your play.",
      test: (c) => c.totalCleared >= 10 },

    { id: "designer", icon: "🎨", name: "Agent Designer",
      desc: "Play a run with a customized agent.",
      test: (c) => c.customAgent === true },
  ];

  function loadUnlocked() {
    try {
      const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (_) { return new Set(); }
  }
  function saveUnlocked(set) {
    try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch (_) { /* ignore */ }
  }

  // Evaluate all definitions against ctx; unlock & return any NEW ones.
  function check(ctx) {
    const unlocked = loadUnlocked();
    const newly = [];
    DEFS.forEach((d) => {
      if (!unlocked.has(d.id)) {
        let earned = false;
        try { earned = !!d.test(ctx); } catch (_) { earned = false; }
        if (earned) { unlocked.add(d.id); newly.push(d); }
      }
    });
    if (newly.length) saveUnlocked(unlocked);
    return newly;
  }

  function all() {
    const unlocked = loadUnlocked();
    return DEFS.map((d) => ({ ...d, unlocked: unlocked.has(d.id) }));
  }

  function unlockedCount() { return loadUnlocked().size; }
  function total() { return DEFS.length; }
  function clear() { saveUnlocked(new Set()); }

  return { check, all, unlockedCount, total, clear };
})();
