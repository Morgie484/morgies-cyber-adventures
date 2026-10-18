// Customizable "data-mage" appearance. Pure data + a canvas renderer so the
// same look appears on the overworld avatar and the character sheet.

export const ROBE_COLORS = {
  arcane:   { name: "Arcane Violet", robe: "#6a3dd6", trim: "#c9a6ff" },
  cyber:    { name: "Cyber Teal",    robe: "#128a8a", trim: "#4ff0e0" },
  ember:    { name: "Ember Red",     robe: "#a8322f", trim: "#ff9a6b" },
  void:     { name: "Void Black",    robe: "#23293a", trim: "#7f8cff" },
  forest:   { name: "Grove Green",   robe: "#2f7d3e", trim: "#9cf0a0" },
  gold:     { name: "Royal Gold",    robe: "#b58100", trim: "#ffe08a" },
};

export const HATS = {
  pointed:  "Pointed Wizard Hat",
  hooded:   "Mystic Hood",
  circlet:  "Data Circlet",
  none:     "Bare Head",
};

export const STAVES = {
  crystal:  "Crystal Staff",
  orb:      "Floating Orb",
  blade:    "Cipher Blade",
  none:     "No Focus",
};

export const SKIN_TONES = ["#f1c9a5", "#e0a97e", "#c68642", "#8d5524", "#5c3a21", "#d9b38c"];

export const AURAS = {
  none:   { name: "None",       color: null },
  spark:  { name: "Sparks",     color: "#4ff0e0" },
  rune:   { name: "Runes",      color: "#c9a6ff" },
  glitch: { name: "Glitch",     color: "#39ff14" },
};

export function defaultAppearance() {
  return {
    robeColor: "arcane",
    hat: "pointed",
    staff: "crystal",
    skin: SKIN_TONES[0],
    aura: "spark",
  };
}

/**
 * Draw the character at (x,y) with a given cell size `s`.
 * Used both small (overworld, ~28px) and large (character sheet, ~120px).
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawCharacter(ctx, appearance, x, y, s, frame = 0) {
  const a = appearance;
  const robe = ROBE_COLORS[a.robeColor] || ROBE_COLORS.arcane;
  const cx = x + s / 2;

  ctx.save();
  ctx.translate(0, 0);

  // Aura behind the figure.
  const aura = AURAS[a.aura];
  if (aura && aura.color) {
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(frame / 10);
    ctx.fillStyle = aura.color;
    ctx.beginPath();
    ctx.arc(cx, y + s * 0.55, s * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (a.aura === "rune" || a.aura === "spark") {
      for (let i = 0; i < 4; i++) {
        const ang = frame / 20 + (i * Math.PI) / 2;
        ctx.fillStyle = aura.color;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(cx + Math.cos(ang) * s * 0.5 - 1.5, y + s * 0.5 + Math.sin(ang) * s * 0.5 - 1.5, 3, 3);
      }
      ctx.globalAlpha = 1;
    }
  }

  // Robe (trapezoid body).
  ctx.fillStyle = robe.robe;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.12, y + s * 0.4);
  ctx.lineTo(cx + s * 0.12, y + s * 0.4);
  ctx.lineTo(cx + s * 0.32, y + s * 0.95);
  ctx.lineTo(cx - s * 0.32, y + s * 0.95);
  ctx.closePath();
  ctx.fill();
  // Robe trim.
  ctx.strokeStyle = robe.trim;
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(cx, y + s * 0.42);
  ctx.lineTo(cx, y + s * 0.93);
  ctx.stroke();

  // Head.
  ctx.fillStyle = a.skin;
  ctx.beginPath();
  ctx.arc(cx, y + s * 0.3, s * 0.14, 0, Math.PI * 2);
  ctx.fill();

  // Hat / hood.
  if (a.hat === "pointed") {
    ctx.fillStyle = robe.robe;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.17, y + s * 0.24);
    ctx.lineTo(cx + s * 0.17, y + s * 0.24);
    ctx.lineTo(cx, y - s * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = robe.trim;
    ctx.fillRect(cx - s * 0.17, y + s * 0.22, s * 0.34, s * 0.04);
    // star tip
    ctx.fillStyle = robe.trim;
    ctx.fillRect(cx - 1.5, y - s * 0.1, 3, 3);
  } else if (a.hat === "hooded") {
    ctx.fillStyle = robe.robe;
    ctx.beginPath();
    ctx.arc(cx, y + s * 0.26, s * 0.2, Math.PI, 0);
    ctx.lineTo(cx + s * 0.2, y + s * 0.34);
    ctx.lineTo(cx - s * 0.2, y + s * 0.34);
    ctx.closePath();
    ctx.fill();
  } else if (a.hat === "circlet") {
    ctx.strokeStyle = robe.trim;
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath();
    ctx.arc(cx, y + s * 0.26, s * 0.15, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = robe.trim;
    ctx.fillRect(cx - 1.5, y + s * 0.12, 3, 3);
  }

  // Staff / focus.
  if (a.staff === "crystal") {
    ctx.strokeStyle = "#8a5a2b";
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.34, y + s * 0.2);
    ctx.lineTo(cx + s * 0.34, y + s * 0.9);
    ctx.stroke();
    ctx.fillStyle = robe.trim;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(cx + s * 0.34, y + s * 0.16, s * 0.07 + Math.sin(frame / 8) * s * 0.01, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (a.staff === "orb") {
    ctx.fillStyle = robe.trim;
    ctx.globalAlpha = 0.8;
    const oy = y + s * 0.4 + Math.sin(frame / 8) * s * 0.05;
    ctx.beginPath();
    ctx.arc(cx + s * 0.4, oy, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (a.staff === "blade") {
    ctx.strokeStyle = robe.trim;
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.34, y + s * 0.85);
    ctx.lineTo(cx + s * 0.34, y + s * 0.3);
    ctx.stroke();
  }

  ctx.restore();
}
