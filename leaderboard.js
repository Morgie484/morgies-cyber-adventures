/* =========================================================================
   CipherTrace — Leaderboard
   Persistent local high-score table (localStorage). Stores the top runs
   with context: name, score, mode, difficulty, agent, missions solved.
   ========================================================================= */

const Leaderboard = (function () {
  "use strict";

  const KEY = "ciphertrace.leaderboard.v1";
  const MAX = 10; // keep top 10

  function load() {
    try {
      const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (_) { /* ignore */ }
  }

  // Would this score make the board? (board not full, or beats the lowest)
  function qualifies(score) {
    const list = load();
    if (score <= 0) return false;
    if (list.length < MAX) return true;
    return score > list[list.length - 1].score;
  }

  // Add an entry, keep sorted desc, trim to MAX. Returns the entry's rank (1-based) or -1.
  function add(entry) {
    const list = load();
    const clean = {
      name: String(entry.name || "AGENT").slice(0, 12).toUpperCase() || "AGENT",
      score: Math.max(0, Math.round(entry.score || 0)),
      mode: entry.mode || "campaign",
      difficulty: entry.difficulty || "normal",
      agent: entry.agent || "—",
      solved: entry.solved || 0,
      total: entry.total || 0,
      date: new Date().toISOString().slice(0, 10),
    };
    list.push(clean);
    list.sort((a, b) => b.score - a.score);
    const trimmed = list.slice(0, MAX);
    save(trimmed);
    const rank = trimmed.indexOf(clean) + 1;
    return rank === 0 ? -1 : rank;
  }

  function clear() { save([]); }

  function all() { return load(); }

  return { qualifies, add, clear, all };
})();
