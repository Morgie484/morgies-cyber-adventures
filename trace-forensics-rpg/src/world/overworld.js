// Top-down overworld. Walk with WASD/arrows, enter locations, meet NPCs.
// Kept simple and readable for beginners.

import { drawCharacter } from "../engine/appearance.js";

const TILE = 32;

// Map legend: '.' forest-floor clearing   '#' dense trees (impassable).
// An enchanted-wood layout: open glades threaded by tree lines, ringed by
// forest. Locations are placed in clearings; a few tree clusters break it up.
const MAP = [
  "####################",
  "#...####......####.#",
  "#...#..............#",
  "#..........##......#",
  "#...#......##...#..#",
  "#...#..............#",
  "#.......####.......#",
  "#..#...............#",
  "#..#......##....##.#",
  "#.........##.......#",
  "#....##............#",
  "####################",
];

// Predefined forest-clearing slots to place a case's shrines (locations) and
// wanderers (NPCs) onto. All land on open floor in the map above.
const LOCATION_SLOTS = [
  { x: 2, y: 2 }, { x: 16, y: 2 }, { x: 15, y: 5 }, { x: 3, y: 9 },
];
const NPC_SLOTS = [
  { x: 9, y: 5 }, { x: 6, y: 7 }, { x: 16, y: 7 }, { x: 11, y: 10 },
];

export class Overworld {
  constructor(canvas, activeCase, appearance) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.player = { x: 2 * TILE, y: 6 * TILE, w: 24, h: 24, speed: 2.4 };
    this.keys = {};
    this.appearance = appearance;
    this.frame = 0;

    // Build locations from the case's devices.
    const hosts = Object.keys(activeCase.devices);
    this.locations = hosts.map((host, i) => ({
      ...LOCATION_SLOTS[i % LOCATION_SLOTS.length],
      host,
      label: activeCase.devices[host].label || host,
    }));

    // Build NPCs from the case's npc definitions.
    const npcIds = Object.keys(activeCase.npcs || {});
    this.npcs = npcIds.map((npc, i) => ({
      ...NPC_SLOTS[i % NPC_SLOTS.length],
      npc,
      label: (activeCase.npcs[npc].name || npc).split(" ")[0].replace(/[^\w.]/g, ""),
    }));

    this.nearby = null; // {type:'location'|'npc', data}

    // Drifting fireflies / glowing spores for forest atmosphere.
    this.fireflies = Array.from({ length: 22 }, () => ({
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      spd: 0.2 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      size: 1 + Math.random() * 1.5,
    }));
  }

  tileAt(px, py) {
    const col = Math.floor(px / TILE);
    const row = Math.floor(py / TILE);
    if (row < 0 || row >= MAP.length || col < 0 || col >= MAP[0].length) return "#";
    return MAP[row][col];
  }

  isWall(px, py) {
    return this.tileAt(px, py) === "#";
  }

  update() {
    const p = this.player;
    let dx = 0, dy = 0;
    if (this.keys["w"] || this.keys["arrowup"]) dy -= p.speed;
    if (this.keys["s"] || this.keys["arrowdown"]) dy += p.speed;
    if (this.keys["a"] || this.keys["arrowleft"]) dx -= p.speed;
    if (this.keys["d"] || this.keys["arrowright"]) dx += p.speed;

    // Axis-separated collision.
    if (!this.collides(p.x + dx, p.y)) p.x += dx;
    if (!this.collides(p.x, p.y + dy)) p.y += dy;

    this.updateNearby();
  }

  collides(x, y) {
    const corners = [
      [x, y], [x + this.player.w, y],
      [x, y + this.player.h], [x + this.player.w, y + this.player.h],
    ];
    return corners.some(([cx, cy]) => this.isWall(cx, cy));
  }

  centerOf(entity) {
    return { cx: (entity.x + 0.5) * TILE, cy: (entity.y + 0.5) * TILE };
  }

  updateNearby() {
    const pcx = this.player.x + this.player.w / 2;
    const pcy = this.player.y + this.player.h / 2;
    const near = (e) => {
      const { cx, cy } = this.centerOf(e);
      return Math.hypot(pcx - cx, pcy - cy) < TILE * 1.1;
    };
    const loc = this.locations.find(near);
    if (loc) { this.nearby = { type: "location", data: loc }; return; }
    const npc = this.npcs.find(near);
    if (npc) { this.nearby = { type: "npc", data: npc }; return; }
    this.nearby = null;
  }

  // Deterministic pseudo-random in [0,1) seeded by tile coords (stable decor).
  rand(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  drawTree(ctx, px, py) {
    // canopy — layered circles in forest greens
    const cx = px + TILE / 2;
    ctx.fillStyle = "#143d22";
    ctx.beginPath(); ctx.arc(cx, py + 16, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1c5230";
    ctx.beginPath(); ctx.arc(cx - 6, py + 12, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 6, py + 14, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#246b3d";
    ctx.beginPath(); ctx.arc(cx, py + 10, 9, 0, Math.PI * 2); ctx.fill();
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // ground: mossy forest floor with a soft vertical gradient
    const grad = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    grad.addColorStop(0, "#0c1a12");
    grad.addColorStop(1, "#0a1410");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // floor tiles + scattered foliage; trees for walls
    for (let r = 0; r < MAP.length; r++) {
      for (let c = 0; c < MAP[r].length; c++) {
        const ch = MAP[r][c];
        const px = c * TILE, py = r * TILE;
        if (ch === "#") {
          this.drawTree(ctx, px, py);
        } else {
          // mottled moss patches
          const t = this.rand(c, r);
          ctx.fillStyle = t > 0.5 ? "#0e1e14" : "#0b1810";
          ctx.fillRect(px, py, TILE, TILE);
          // little grass tufts / pebbles / flowers, stable per tile
          if (t > 0.82) {
            ctx.fillStyle = "#1c5230";
            ctx.fillRect(px + 6 + t * 10, py + 20, 2, 5);
            ctx.fillRect(px + 9 + t * 10, py + 18, 2, 7);
          } else if (t > 0.72) {
            ctx.fillStyle = "#3a2c55";
            ctx.beginPath(); ctx.arc(px + 10 + t * 12, py + 14 + t * 8, 2, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }

    // locations: glowing arcane shrine-stones in a clearing
    for (const loc of this.locations) {
      const { cx, cy } = this.centerOf(loc);
      const pulse = 0.5 + 0.5 * Math.sin(this.frame / 20 + cx);
      // glow aura
      ctx.globalAlpha = 0.18 + 0.1 * pulse;
      ctx.fillStyle = "#26d9ff";
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // standing stone
      ctx.fillStyle = "#1a2b38";
      ctx.fillRect(cx - 9, cy - 13, 18, 26);
      ctx.strokeStyle = "#26d9ff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 9, cy - 13, 18, 26);
      // glowing rune
      ctx.fillStyle = `rgba(79,240,224,${0.6 + 0.4 * pulse})`;
      ctx.font = "13px monospace";
      ctx.textAlign = "center";
      ctx.fillText("ᛝ", cx, cy + 5);
      // label banner
      ctx.fillStyle = "#9fd8e8";
      ctx.font = "10px monospace";
      ctx.fillText(loc.label, cx, cy - 20);
    }

    // npcs: lantern-lit wanderers of the wood
    for (const n of this.npcs) {
      const { cx, cy } = this.centerOf(n);
      const bob = Math.sin(this.frame / 15 + cx) * 1.5;
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#ffcf6b";
      ctx.beginPath(); ctx.arc(cx, cy + bob, 16, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // cloaked figure
      ctx.fillStyle = "#6b4a1c";
      ctx.beginPath(); ctx.arc(cx, cy + bob, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1a1200";
      ctx.font = "13px monospace";
      ctx.textAlign = "center";
      ctx.fillText("?", cx, cy + 5 + bob);
      ctx.fillStyle = "#ffd98a";
      ctx.font = "10px monospace";
      ctx.fillText(n.label, cx, cy - 15 + bob);
    }

    // player — rendered as the customized data-mage
    const p = this.player;
    this.frame++;
    if (this.appearance) {
      drawCharacter(ctx, this.appearance, p.x - 6, p.y - 10, 40, this.frame);
    } else {
      ctx.fillStyle = "#39ff14";
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }

    // drifting fireflies / spores (atmosphere, drawn above everything)
    for (const f of this.fireflies) {
      f.y -= f.spd;
      f.x += Math.sin(this.frame / 40 + f.phase) * 0.4;
      if (f.y < -4) { f.y = this.canvas.height + 4; f.x = Math.random() * this.canvas.width; }
      const glow = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this.frame / 12 + f.phase));
      ctx.globalAlpha = glow;
      ctx.fillStyle = "#b8ff8a";
      ctx.beginPath(); ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // interaction prompt
    if (this.nearby) {
      const isShrine = this.nearby.type === "location";
      const label = isShrine
        ? `Commune with ${this.nearby.data.label}`
        : `Speak with ${this.nearby.data.label}`;
      ctx.fillStyle = "#b8ff8a";
      ctx.font = "14px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`[ SPACE ] ${label}`, this.canvas.width / 2, this.canvas.height - 18);
    }
  }
}
