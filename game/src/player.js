// The Quiet Gallery — the thief, Wren.
// Movement, sneaking, footsteps, artifact pickups, the service exit and
// the coin toss. The player never talks to the guards directly; main.js
// reads the player's position and noise and drives the guards from it.

import { TILE, circleHitsSolid, isDarkAt } from './levels.js';

export const PLAYER_RADIUS = 11;
export const WALK_SPEED = 150;
export const SNEAK_SPEED = 78;
export const INTERACT_RANGE = 34;
export const COIN_FLIGHT_TIME = 0.38;
export const COIN_NOISE_RADIUS = 250;

// How loud a footstep is: guards hear a walker further away than a sneaker.
export const WALK_NOISE_RADIUS = 95;
export const SNEAK_NOISE_RADIUS = 34;

export class Player {
  constructor(level) {
    this.reset(level);
  }

  reset(level) {
    this.x = level.start.x;
    this.y = level.start.y;
    this.vx = 0;
    this.vy = 0;
    this.dir = -Math.PI / 2; // facing up the hall
    this.sneaking = false;
    this.moving = false;
    this.coins = level.coins;
    this.artifacts = 0;
    this.stepAccum = 0; // distance walked since the last footstep tick
    this.noisePulse = 0; // 1 right after a loud footstep, decays to 0
    this.coinsFlying = []; // {x, y, sx, sy, tx, ty, t}
    this.noiseEvents = []; // {x, y, radius, ttl} — landed coins
    this.inDark = false;
  }

  get noiseRadius() {
    return this.sneaking ? SNEAK_NOISE_RADIUS : WALK_NOISE_RADIUS;
  }

  get speed() {
    return this.sneaking ? SNEAK_SPEED : WALK_SPEED;
  }

  // Move with WASD/arrows; axis-separated so the thief slides along walls.
  update(dt, input, level, doorOpen) {
    let ax = 0;
    let ay = 0;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) ax -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) ax += 1;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) ay -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) ay += 1;
    this.sneaking = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    this.moving = ax !== 0 || ay !== 0;

    const len = Math.hypot(ax, ay) || 1;
    const speed = this.speed;
    const nx = this.x + (ax / len) * speed * dt;
    const ny = this.y + (ay / len) * speed * dt;
    if (ax !== 0 && !circleHitsSolid(level, nx, this.y, PLAYER_RADIUS, doorOpen)) this.x = nx;
    if (ay !== 0 && !circleHitsSolid(level, this.x, ny, PLAYER_RADIUS, doorOpen)) this.y = ny;
    if (this.moving) this.dir = Math.atan2(ay, ax);

    // Footsteps: every 26 px walked (18 px while sneaking) is one tick.
    if (this.moving) {
      this.stepAccum += speed * dt;
      const stride = this.sneaking ? 18 : 26;
      if (this.stepAccum >= stride) {
        this.stepAccum = 0;
        this.noisePulse = 1;
      }
    }
    this.noisePulse = Math.max(0, this.noisePulse - dt * 3);
    this.inDark = isDarkAt(level, this.x, this.y);

    // Coins in flight arc toward their target, then land with a clink.
    for (const c of this.coinsFlying) {
      c.t += dt / COIN_FLIGHT_TIME;
      if (c.t >= 1) {
        c.t = 1;
        this.noiseEvents.push({ x: c.tx, y: c.ty, radius: COIN_NOISE_RADIUS, ttl: 0.6 });
      }
    }
    this.coinsFlying = this.coinsFlying.filter((c) => c.t < 1);
    for (const e of this.noiseEvents) e.ttl -= dt;
    this.noiseEvents = this.noiseEvents.filter((e) => e.ttl > 0);
  }

  // The nearest artifact within reach, or null.
  artifactInReach(level) {
    for (const a of level.artifacts) {
      if (a.taken) continue;
      if (Math.hypot(a.x - this.x, a.y - this.y) <= INTERACT_RANGE) return a;
    }
    return null;
  }

  // The exit is usable once every artifact is pocketed.
  exitInReach(level) {
    const allTaken = level.artifacts.every((a) => a.taken);
    if (!allTaken) return false;
    return Math.hypot(level.exit.x - this.x, level.exit.y - this.y) <= INTERACT_RANGE + 6;
  }

  pickUp(artifact) {
    artifact.taken = true;
    this.artifacts += 1;
  }

  // Toss a coin toward a world point (the mouse). It lands with a ping
  // that draws the nearest guard over to investigate.
  throwCoin(tx, ty) {
    if (this.coins <= 0) return false;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const range = Math.min(d, 220);
    this.coins -= 1;
    this.coinsFlying.push({
      sx: this.x,
      sy: this.y,
      tx: this.x + (dx / d) * range,
      ty: this.y + (dy / d) * range,
      t: 0,
    });
    return true;
  }

  coinPosition(c) {
    const t = Math.min(1, c.t);
    const x = c.sx + (c.tx - c.sx) * t;
    const y = c.sy + (c.ty - c.sy) * t;
    // A little hop so the coin reads as thrown, not slid.
    const hop = Math.sin(t * Math.PI) * 14;
    return { x, y: y - hop };
  }
}
