// The Quiet Gallery — canvas rendering.
// Top-down view with a camera that follows the thief: marble floor tiles,
// stone walls, display cases, statues and plants you can read at a glance,
// guards with translucent vision cones, glinting artifacts, the service
// exit, and a darkness overlay that leaves lit ground bright and shadow
// zones dark so the player can see what is safe.

import { TILE, TILE_WALL, TILE_CASE, TILE_STATUE, TILE_PLANT, TILE_DARK, TILE_DOOR } from './levels.js';

const VIEW_W = 1280;
const VIEW_H = 720;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Draw one guard or camera vision cone: a wedge from the watcher toward
// its facing, fading with distance, with a bright rim on the near edge.
function drawCone(ctx, x, y, dir, range, halfAngle, color) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, dir - halfAngle, dir + halfAngle);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, range, dir - halfAngle, dir + halfAngle);
  ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.55)');
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawGuard(ctx, g) {
  // Vision cone first, so the guard body sits on top of it.
  drawCone(ctx, g.x, g.y, g.dir, g.range, g.halfAngle, g.coneColor);
  // Body: a dark uniform with a state-coloured ring and a facing nose.
  ctx.save();
  ctx.beginPath();
  ctx.arc(g.x, g.y, 13, 0, Math.PI * 2);
  ctx.fillStyle = '#232733';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = g.ringColor;
  ctx.stroke();
  // Cap brim and nose show which way the guard is looking.
  ctx.beginPath();
  ctx.arc(g.x, g.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#3a4152';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(g.x + Math.cos(g.dir) * 8, g.y + Math.sin(g.dir) * 8);
  ctx.lineTo(g.x + Math.cos(g.dir + 2.6) * 13, g.y + Math.sin(g.dir + 2.6) * 13);
  ctx.lineTo(g.x + Math.cos(g.dir - 2.6) * 13, g.y + Math.sin(g.dir - 2.6) * 13);
  ctx.closePath();
  ctx.fillStyle = g.ringColor;
  ctx.fill();
  // "!" when suspicious, "!!" when alert — readable without the HUD.
  if (g.state !== 'patrol') {
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = g.state === 'alert' ? '#ff5a4a' : '#ffd94a';
    ctx.fillText(g.state === 'alert' ? '!!' : '!', g.x, g.y - 16);
  }
  ctx.restore();
}

function drawCamera(ctx, cam) {
  drawCone(ctx, cam.x, cam.y, cam.dir, cam.range, cam.halfAngle, cam.coneColor);
  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.rotate(cam.dir);
  ctx.fillStyle = '#1c1f28';
  ctx.fillRect(-7, -7, 14, 14);
  ctx.fillStyle = cam.seesPlayer ? '#ff5a4a' : '#f0c434';
  ctx.beginPath();
  ctx.arc(7, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawArtifact(ctx, a, time) {
  const glint = 0.6 + 0.4 * Math.sin(time * 3 + a.x);
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(Math.PI / 4);
  const s = 9 + Math.sin(time * 2 + a.y) * 1.2;
  ctx.fillStyle = `rgba(255, 214, 90, ${0.75 + 0.25 * glint})`;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeStyle = '#fff3c4';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-s / 2, -s / 2, s, s);
  ctx.restore();
  // A soft glow ring so artifacts read from across the room.
  ctx.save();
  ctx.beginPath();
  ctx.arc(a.x, a.y, 16 + Math.sin(time * 2) * 2, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 214, 90, ${0.25 * glint})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawPlayer(ctx, p, time) {
  ctx.save();
  // Soft shadow under the thief.
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 8, 12, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fill();
  // Cloak: a deep teal hood with a pale face slit facing the walk dir.
  ctx.beginPath();
  ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
  ctx.fillStyle = p.sneaking ? '#1d5c4d' : '#2a7a63';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#bfe8d8';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.dir) * 4, p.y + Math.sin(p.dir) * 4, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#e8dcc8';
  ctx.fill();
  // Sneak indicator: a small crouch line under the cloak.
  if (p.sneaking) {
    ctx.beginPath();
    ctx.moveTo(p.x - 7, p.y + 14);
    ctx.lineTo(p.x + 7, p.y + 14);
    ctx.strokeStyle = 'rgba(191, 232, 216, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

// One tile of floor, wall or cover. Walls get a top highlight so the
// room's edges read as solid stone; cases get a glass shine.
function drawTile(ctx, tile, px, py) {
  if (tile === TILE_WALL) {
    ctx.fillStyle = '#3d3a4e';
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = '#4d4962';
    ctx.fillRect(px, py, TILE, 6);
    ctx.fillStyle = '#2c2940';
    ctx.fillRect(px, py + TILE - 4, TILE, 4);
    return;
  }
  if (tile === TILE_DARK) {
    ctx.fillStyle = '#14121f';
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = '#171527';
    ctx.fillRect(px, py, TILE, 2);
    return;
  }
  // Lit marble floor: a subtle checker.
  const checker = ((px / TILE + py / TILE) % 2 === 0) ? '#b8ac8e' : '#ada184';
  ctx.fillStyle = checker;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = 'rgba(60, 50, 30, 0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
}

function drawCover(ctx, tile, px, py, time) {
  if (tile === TILE_CASE) {
    // A glass display case on a brass plinth.
    ctx.fillStyle = '#6b5a2e';
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = 'rgba(180, 220, 235, 0.55)';
    ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
    ctx.strokeStyle = '#d9b45a';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 3.5, py + 3.5, TILE - 7, TILE - 7);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(px + 9, py + 8, 5, TILE - 16);
    return;
  }
  if (tile === TILE_STATUE) {
    ctx.fillStyle = '#8d8578';
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a89f8d';
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6f675a';
    ctx.fillRect(px + TILE / 2 - 2, py + 2, 4, 10);
    return;
  }
  if (tile === TILE_PLANT) {
    ctx.fillStyle = '#7a4a2b';
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2 + 6, 7, 0, Math.PI * 2);
    ctx.fill();
    const sway = Math.sin(time * 1.4 + px) * 1.5;
    ctx.fillStyle = '#2f7a3d';
    for (const [ox, oy, r] of [[-6, -4, 7], [5, -6, 8], [0, -10, 7]]) {
      ctx.beginPath();
      ctx.arc(px + TILE / 2 + ox + sway, py + TILE / 2 + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (tile === TILE_DOOR) {
    ctx.fillStyle = '#5a4a2e';
    ctx.fillRect(px + 2, py, TILE - 4, TILE);
    ctx.fillStyle = '#8a6d3b';
    ctx.fillRect(px + 2, py + 4, TILE - 4, 3);
    ctx.fillRect(px + 2, py + TILE - 7, TILE - 4, 3);
    ctx.fillStyle = '#d9b45a';
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The exit: a service door. Red and barred while artifacts remain, green
// and open once the thief has them all.
function drawExit(ctx, level, doorOpen, time) {
  const e = level.exit;
  const x = e.x - TILE / 2;
  const y = e.y - TILE / 2;
  ctx.save();
  if (doorOpen) {
    const pulse = 0.5 + 0.3 * Math.sin(time * 3);
    ctx.fillStyle = `rgba(80, 220, 120, ${0.35 + pulse * 0.2})`;
    ctx.fillRect(x - 4, y - 4, TILE + 8, TILE + 8);
    ctx.fillStyle = '#2fae5f';
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = '#eafff0';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', e.x, e.y);
  } else {
    ctx.fillStyle = '#7a2e2e';
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.strokeStyle = '#c9a35a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 5);
    ctx.lineTo(x + TILE - 5, y + TILE - 5);
    ctx.moveTo(x + TILE - 5, y + 5);
    ctx.lineTo(x + 5, y + TILE - 5);
    ctx.stroke();
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LOCKED', e.x, e.y - TILE / 2 - 8);
  }
  ctx.restore();
}

// Darkness overlay: the museum at night is dim; light pools around the
// thief, the artifacts and the exit so the player can read the room.
// Drawn on an offscreen canvas and stamped over the scene.
function drawDarkness(ctx, game, camX, camY) {
  const off = game._darkCanvas;
  const octx = off.getContext('2d');
  octx.clearRect(0, 0, VIEW_W, VIEW_H);
  octx.globalCompositeOperation = 'source-over';
  octx.fillStyle = 'rgba(6, 8, 22, 0.52)';
  octx.fillRect(0, 0, VIEW_W, VIEW_H);
  octx.globalCompositeOperation = 'destination-out';
  const holes = [];
  const p = game.player;
  holes.push([p.x - camX, p.y - camY, p.inDark ? 150 : 215]);
  for (const a of game.level.artifacts) {
    if (!a.taken) holes.push([a.x - camX, a.y - camY, 70]);
  }
  holes.push([game.level.exit.x - camX, game.level.exit.y - camY, 80]);
  for (const [hx, hy, hr] of holes) {
    const g = octx.createRadialGradient(hx, hy, 10, hx, hy, hr);
    g.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
    g.addColorStop(0.7, 'rgba(0, 0, 0, 0.55)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    octx.fillStyle = g;
    octx.beginPath();
    octx.arc(hx, hy, hr, 0, Math.PI * 2);
    octx.fill();
  }
  ctx.drawImage(off, 0, 0);
}

export function render(ctx, game, time) {
  const level = game.level;
  const p = game.player;
  // Camera follows the thief, clamped to the level bounds; a level smaller
  // than the view sits centred in it instead of pinned to a corner.
  const camX = level.pixelWidth <= VIEW_W
    ? (level.pixelWidth - VIEW_W) / 2
    : clamp(p.x - VIEW_W / 2, 0, level.pixelWidth - VIEW_W);
  const camY = level.pixelHeight <= VIEW_H
    ? (level.pixelHeight - VIEW_H) / 2
    : clamp(p.y - VIEW_H / 2, 0, level.pixelHeight - VIEW_H);
  game.camera = { x: camX, y: camY };

  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#0b0a14';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const x0 = Math.max(0, Math.floor(camX / TILE));
  const x1 = Math.min(level.width - 1, Math.ceil((camX + VIEW_W) / TILE));
  const y0 = Math.max(0, Math.floor(camY / TILE));
  const y1 = Math.min(level.height - 1, Math.ceil((camY + VIEW_H) / TILE));

  ctx.save();
  ctx.translate(-camX, -camY);
  // Floor and walls first.
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      drawTile(ctx, level.tiles[ty][tx], tx * TILE, ty * TILE);
    }
  }
  // Locked door (drawn over its tile).
  if (level.door) {
    drawCover(ctx, TILE_DOOR, level.door.tx * TILE, level.door.ty * TILE, time);
  }
  drawExit(ctx, level, game.exitOpen, time);
  // Artifacts under the cover objects.
  for (const a of level.artifacts) {
    if (!a.taken) drawArtifact(ctx, a, time);
  }
  // Cover objects (cases, statues, plants) after the floor.
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = level.tiles[ty][tx];
      if (t === TILE_CASE || t === TILE_STATUE || t === TILE_PLANT) {
        drawCover(ctx, t, tx * TILE, ty * TILE, time);
      }
    }
  }
  // Noise rings from landed coins.
  for (const e of p.noiseEvents) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(e.x, e.y, 26 + (0.6 - e.ttl) * 60, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 220, 120, ${Math.min(1, e.ttl * 2)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  // Flying coins.
  for (const c of p.coinsFlying) {
    const pos = p.coinPosition(c);
    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd65a';
    ctx.fill();
    ctx.strokeStyle = '#fff3c4';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  // Cameras, then guards, then the thief on top.
  for (const cam of game.cameras) drawCamera(ctx, cam);
  for (const g of game.guards) drawGuard(ctx, g);
  drawPlayer(ctx, p, time);
  ctx.restore();

  // Night darkness over the whole view.
  drawDarkness(ctx, game, camX, camY);

  // A thin vignette so the edges of the screen fall away.
  const vg = ctx.createRadialGradient(
    VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45,
    VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95,
  );
  vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vg.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

export { VIEW_W, VIEW_H };
