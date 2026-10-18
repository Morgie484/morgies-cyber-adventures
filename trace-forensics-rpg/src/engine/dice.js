// Dice & skill-check engine — D&D-style d20 resolution.

export function rollDie(sides = 20) {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(count, sides) {
  let total = 0;
  const rolls = [];
  for (let i = 0; i < count; i++) {
    const r = rollDie(sides);
    rolls.push(r);
    total += r;
  }
  return { total, rolls };
}

// Convert a raw stat (1-20) into a modifier, D&D-style (stat 10 => +0).
export function statModifier(stat) {
  return Math.floor((stat - 10) / 2);
}

export const CheckResult = {
  CRIT_SUCCESS: "critical success",
  SUCCESS: "success",
  FAILURE: "failure",
  CRIT_FAILURE: "critical failure",
};

/**
 * Resolve a skill check: d20 + modifier vs. DC.
 * Natural 20 = critical success, natural 1 = critical failure.
 * @param {number} modifier - total modifier to add to the roll
 * @param {number} dc - difficulty class to beat (>=)
 * @returns {{d20:number, modifier:number, total:number, dc:number, result:string, margin:number}}
 */
export function skillCheck(modifier, dc) {
  const d20 = rollDie(20);
  const total = d20 + modifier;
  let result;
  if (d20 === 20) result = CheckResult.CRIT_SUCCESS;
  else if (d20 === 1) result = CheckResult.CRIT_FAILURE;
  else if (total >= dc) result = CheckResult.SUCCESS;
  else result = CheckResult.FAILURE;

  return { d20, modifier, total, dc, result, margin: total - dc };
}

export function isSuccess(result) {
  return result === CheckResult.SUCCESS || result === CheckResult.CRIT_SUCCESS;
}

// Difficulty class presets, for consistent tuning across the game.
export const DC = {
  TRIVIAL: 5,
  EASY: 10,
  MEDIUM: 14,
  HARD: 18,
  EXTREME: 22,
};
