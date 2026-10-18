// Animated d20 roll popup. Tumbles through random faces, then lands on the
// real result and shows the full breakdown (d20 + modifier vs DC).

import { audio } from "../engine/audio.js";
import { isSuccess, CheckResult } from "../engine/dice.js";

/**
 * Play the dice animation for a resolved check, then resolve the promise.
 * @param {object} res  result from skillCheck() — {d20, modifier, total, dc, result}
 * @param {object} opts {stat, label}
 * @returns {Promise<void>} resolves after the animation + a short hold
 */
export function animateRoll(res, { stat = "CHECK", label = "" } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "dice-overlay";
    overlay.innerHTML = `
      <div class="dice-box">
        <div class="dice-label">${label || stat + " check"}</div>
        <div class="dice-sub">rolling d20… ${stat} vs DC ${res.dc}</div>
        <div class="d20"><div class="d20-face">?</div></div>
        <div class="dice-breakdown"></div>
      </div>`;
    document.body.appendChild(overlay);

    const face = overlay.querySelector(".d20-face");
    const d20El = overlay.querySelector(".d20");
    const breakdown = overlay.querySelector(".dice-breakdown");

    audio.sfx("diceRoll");

    // Tumble: cycle random faces with decreasing speed.
    let elapsed = 0;
    const duration = 1100;
    let interval = 50;
    d20El.classList.add("tumbling");

    const tumble = () => {
      face.textContent = String(Math.floor(Math.random() * 20) + 1);
      elapsed += interval;
      interval += 12; // ease out
      if (elapsed < duration) {
        setTimeout(tumble, interval);
      } else {
        land();
      }
    };

    const land = () => {
      d20El.classList.remove("tumbling");
      face.textContent = String(res.d20);
      audio.sfx("diceLand");

      const crit = res.result === CheckResult.CRIT_SUCCESS;
      const critFail = res.result === CheckResult.CRIT_FAILURE;
      const ok = isSuccess(res.result);

      d20El.classList.add(ok ? "roll-good" : "roll-bad");
      if (crit) d20El.classList.add("roll-crit");

      const sign = res.modifier >= 0 ? "+" : "";
      breakdown.innerHTML =
        `<div class="bd-math">${res.d20} <span class="bd-dim">(d20)</span> ${sign}${res.modifier} <span class="bd-dim">(${stat})</span> = <b>${res.total}</b> vs DC ${res.dc}</div>
         <div class="bd-result ${ok ? "good" : "bad"}">${res.result.toUpperCase()}</div>`;

      setTimeout(() => {
        audio.sfx(crit ? "critSuccess" : critFail ? "critFail" : ok ? "success" : "failure");
      }, 120);

      // Hold, then dismiss.
      setTimeout(() => {
        overlay.classList.add("fade-out");
        setTimeout(() => { overlay.remove(); resolve(); }, 280);
      }, 1150);
    };

    setTimeout(tumble, interval);
  });
}
