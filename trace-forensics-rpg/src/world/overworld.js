// Top-down overworld. Walk with WASD/arrows, enter locations, meet NPCs.
// Kept simple and readable for beginners.

import { drawCharacter } from "../engine/appearance.js";

const TILE = 32;

// Map legend: . grass/floor  # wall  road  L location door  N npc
// Each location door links to a device host; each npc to a dialogue id.
const MAP = [
  "####################",
  "#..................#",
  "#..LLL....NN....LLL.#",
  "#..LLL..........LLL.#",
  "#..LLL....##....LLL.#",
  "#.........##.......#",
  "#..................#",
  "#....NN.......LLL...#",
  "#.............LLL...#",
  "#.............LLL...#",
  "#..................#",
  "####################",
];

// Predefined map slots to place a case's locations and NPCs onto.
const LOCATION_SLOTS = [
  { x: 4, y: 3 }, { x: 16, y: 3 }, { x: 14, y: 8 }, { x: 4, y: 8 },
];
const NPC_SLOTS = [
  { x: 9, y: 2 }, { x: 5, y: 7 }, { x: 15, y: 6 }, { x: 10, y: 9 },
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

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // tiles
    for (let r = 0; r < MAP.length; r++) {
      for (let c = 0; c < MAP[r].length; c++) {
        const ch = MAP[r][c];
        ctx.fillStyle = ch === "#" ? "#16222e" : "#0d141c";
        ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
        ctx.strokeStyle = "#0a0f15";
        ctx.strokeRect(c * TILE, r * TILE, TILE, TILE);
      }
    }

    // locations
    for (const loc of this.locations) {
      const { cx, cy } = this.centerOf(loc);
      ctx.fillStyle = "#26d9ff";
      ctx.fillRect(cx - 12, cy - 12, 24, 24);
      ctx.fillStyle = "#06121a";
      ctx.font = "16px monospace";
      ctx.textAlign = "center";
      ctx.fillText("◼", cx, cy + 5);
      ctx.fillStyle = "#9fd8e8";
      ctx.font = "10px monospace";
      ctx.fillText(loc.label, cx, cy - 16);
    }

    // npcs
    for (const n of this.npcs) {
      const { cx, cy } = this.centerOf(n);
      ctx.fillStyle = "#ffb000";
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1200";
      ctx.font = "13px monospace";
      ctx.textAlign = "center";
      ctx.fillText("!", cx, cy + 5);
      ctx.fillStyle = "#ffd98a";
      ctx.font = "10px monospace";
      ctx.fillText(n.label, cx, cy - 15);
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

    // interaction prompt
    if (this.nearby) {
      const label = this.nearby.type === "location"
        ? `Enter ${this.nearby.data.label}`
        : `Talk to ${this.nearby.data.label}`;
      ctx.fillStyle = "#39ff14";
      ctx.font = "14px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`[ SPACE ] ${label}`, this.canvas.width / 2, this.canvas.height - 18);
    }
  }
}
