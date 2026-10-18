// Save / load via localStorage. Persists the character (stats, level, XP,
// appearance), which cases are solved, and the active case id.

const KEY = "grepoire.save.v1";

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      character: state.character,      // plain object — JSON-safe
      solved: [...(state.solved || [])],
      activeCaseId: state.activeCase ? state.activeCase.id : null,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false; // storage disabled / full — fail quietly
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !data.character) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// Human-readable summary for the "Continue" button on the title screen.
export function saveSummary() {
  const d = loadGame();
  if (!d) return null;
  const c = d.character;
  return {
    name: c.name,
    level: c.level,
    background: c.backgroundName,
    solvedCount: (d.solved || []).length,
  };
}
