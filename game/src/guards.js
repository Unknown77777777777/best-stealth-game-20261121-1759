// The Quiet Gallery — guard and camera AI.
// Guards patrol waypoint loops, see through a vision cone, and switch
// between three states: patrol (green), suspicious (yellow, investigates a
// noise or a glimpse) and alert (red, chases the thief). Cameras are fixed
// to the walls and sweep their cones back and forth; they raise the alarm
// but never catch anyone themselves.

import { TILE, blocksSightTile, tileAt, isSolidTile, circleHitsSolid } from './levels.js';

export const GUARD_RANGE = 175;
export const GUARD_HALF_ANGLE = 0.62; // ~35 degrees each side
export const CAMERA_RANGE = 205;
export const CAMERA_HALF_ANGLE = 0.5;

const TAU = Math.PI * 2;

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

export function angleTo(x0, y0, x1, y1) {
  return Math.atan2(y1 - y0, x1 - x0);
}

// Line of sight: sample the segment every 6 px; a tall-cover tile blocks it.
export function hasLineOfSight(level, x0, y0, x1, y1, doorOpen) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const tx = Math.floor((x0 + dx * t) / TILE);
    const ty = Math.floor((y0 + dy * t) / TILE);
    if (blocksSightTile(tileAt(level, tx, ty), doorOpen)) return false;
  }
  return true;
}

// Is (tx, ty) inside a vision cone from (x, y) facing `dir`?
export function inVisionCone(level, x, y, dir, range, halfAngle, tx, ty, doorOpen) {
  const dx = tx - x;
  const dy = ty - y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist > 4 && Math.abs(angleDiff(Math.atan2(dy, dx), dir)) > halfAngle) return false;
  return hasLineOfSight(level, x, y, tx, ty, doorOpen);
}

function tileCenter(tx, ty) {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

// Move a point toward a target with axis-separated collision so the mover
// slides along walls instead of sticking on corners.
export function moveWithCollision(level, pos, tx, ty, speed, dt, doorOpen) {
  const dx = tx - pos.x;
  const dy = ty - pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return 0;
  const step = Math.min(dist, speed * dt);
  const nx = pos.x + (dx / dist) * step;
  const ny = pos.y + (dy / dist) * step;
  let moved = 0;
  if (!circleHitsSolid(level, nx, pos.y, 12, doorOpen)) { pos.x = nx; moved += Math.abs(nx - pos.x); }
  if (!circleHitsSolid(level, pos.x, ny, 12, doorOpen)) { pos.y = ny; moved += Math.abs(ny - pos.y); }
  return moved;
}

export class Guard {
  constructor(def) {
    this.waypoints = def.waypoints.map(([tx, ty]) => tileCenter(tx, ty));
    this.speed = def.speed;
    this.x = this.waypoints[0].x;
    this.y = this.waypoints[0].y;
    this.wpIndex = 1 % this.waypoints.length;
    this.dir = 0;
    this.state = 'patrol'; // patrol | suspicious | alert
    this.waitTimer = 0;
    this.lookTimer = 0;
    this.lookDir = 0;
    this.investigate = null; // {x, y} point to walk to and look around
    this.lastSeen = null; // last known player position
    this.loseTimer = 0; // how long since the guard last saw the player
    this.stuckTimer = 0;
    this.lastX = this.x;
    this.lastY = this.y;
    this.chaseSpeed = this.speed * 1.75;
    this.held = false; // staged for a screenshot: stay exactly put
  }

  get range() { return GUARD_RANGE; }
  get halfAngle() { return GUARD_HALF_ANGLE; }

  get coneColor() {
    if (this.state === 'alert') return 'rgba(235, 64, 52, 0.30)';
    if (this.state === 'suspicious') return 'rgba(240, 196, 52, 0.26)';
    return 'rgba(120, 220, 130, 0.20)';
  }

  get ringColor() {
    if (this.state === 'alert') return '#eb4034';
    if (this.state === 'suspicious') return '#f0c434';
    return '#7ee081';
  }

  canSee(level, px, py, doorOpen) {
    return inVisionCone(level, this.x, this.y, this.dir, this.range, this.halfAngle, px, py, doorOpen);
  }

  // The guard heard something (a coin, loud footsteps) at (x, y).
  hear(x, y) {
    if (this.state === 'alert') return;
    this.state = 'suspicious';
    this.investigate = { x, y };
    this.lookTimer = 0;
  }

  // The guard caught a glimpse of the thief; remember where.
  glimpse(x, y) {
    this.lastSeen = { x, y };
    if (this.state === 'patrol') {
      this.state = 'suspicious';
      this.investigate = { x, y };
      this.lookTimer = 0;
    }
  }

  raiseAlarm(x, y) {
    this.state = 'alert';
    this.lastSeen = { x, y };
    this.loseTimer = 0;
    this.investigate = null;
  }

  calmToSuspicious() {
    if (this.state !== 'alert') return;
    this.state = 'suspicious';
    this.investigate = this.lastSeen ? { ...this.lastSeen } : null;
    this.lookTimer = 0;
  }

  update(dt, level, doorOpen) {
    if (this.held) return;
    // Stuck detection: if we barely moved while trying to walk, give up
    // on the current target and move on instead of grinding on a wall.
    const movedDist = Math.hypot(this.x - this.lastX, this.y - this.lastY);
    this.lastX = this.x;
    this.lastY = this.y;

    if (this.state === 'alert') {
      const target = this.lastSeen || this.waypoints[this.wpIndex];
      // Stuck check scaled to this step's expected movement: the guard
      // moves chaseSpeed * dt per step, so it is only stuck if it moved
      // less than half of that while still trying to reach the target.
      if (movedDist < this.chaseSpeed * dt * 0.5 && this.loseTimer > 0.4) this.stuckTimer += dt;
      else this.stuckTimer = 0;
      if (this.stuckTimer > 1.0) {
        this.stuckTimer = 0;
        this.state = 'suspicious';
        this.investigate = { ...target };
      } else {
        moveWithCollision(level, this, target.x, target.y, this.chaseSpeed, dt, doorOpen);
        this.dir = angleTo(this.x, this.y, target.x, target.y);
      }
      return;
    }

    if (this.state === 'suspicious' && this.investigate) {
      const d = Math.hypot(this.investigate.x - this.x, this.investigate.y - this.y);
      if (d > 10) {
        moveWithCollision(level, this, this.investigate.x, this.investigate.y, this.speed * 1.25, dt, doorOpen);
        this.dir = angleTo(this.x, this.y, this.investigate.x, this.investigate.y);
        return;
      }
      // Arrived: look around for a while, then head back to patrol.
      this.lookTimer += dt;
      this.dir = this.lookDir + Math.sin(this.lookTimer * 2.2) * 1.1;
      if (this.lookTimer > 2.6) {
        this.investigate = null;
        this.lookTimer = 0;
        this.state = 'patrol';
        // Resume from the nearest waypoint so the guard does not
        // backtrack across the whole map.
        let best = 0;
        let bestD = Infinity;
        this.waypoints.forEach((w, i) => {
          const dd = Math.hypot(w.x - this.x, w.y - this.y);
          if (dd < bestD) { bestD = dd; best = i; }
        });
        this.wpIndex = best;
      }
      return;
    }

    // Patrol: walk the loop, pausing briefly at each waypoint and looking
    // down the corridor before moving on.
    const target = this.waypoints[this.wpIndex];
    const d = Math.hypot(target.x - this.x, target.y - this.y);
    if (d < 6) {
      this.waitTimer += dt;
      if (this.waitTimer > 0.9) {
        this.waitTimer = 0;
        this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
      }
      return;
    }
    // Stuck check scaled to this step's expected movement: the guard
    // moves speed * dt per step, so it is only stuck if it moved less
    // than half of that while still far from its waypoint.
    if (movedDist < this.speed * dt * 0.5 && d > 12) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 1.0) {
        this.stuckTimer = 0;
        this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
        return;
      }
    } else {
      this.stuckTimer = 0;
    }
    moveWithCollision(level, this, target.x, target.y, this.speed, dt, doorOpen);
    this.dir = angleTo(this.x, this.y, target.x, target.y);
    this.lookDir = this.dir;
  }
}

export class Camera {
  constructor(def) {
    this.x = (def.tx + 0.5) * TILE;
    this.y = (def.ty + 0.5) * TILE;
    this.baseAngle = def.angle;
    this.sweep = def.sweep;
    this.speed = def.speed;
    this.range = def.range || CAMERA_RANGE;
    this.halfAngle = CAMERA_HALF_ANGLE;
    this.time = Math.random() * 10;
    this.dir = this.baseAngle;
    this.seesPlayer = false;
  }

  get coneColor() {
    return this.seesPlayer ? 'rgba(235, 64, 52, 0.30)' : 'rgba(240, 196, 52, 0.22)';
  }

  update(dt) {
    this.time += dt;
    this.dir = this.baseAngle + Math.sin(this.time * this.speed) * this.sweep;
  }

  canSee(level, px, py, doorOpen) {
    return inVisionCone(level, this.x, this.y, this.dir, this.range, this.halfAngle, px, py, doorOpen);
  }
}

// Is (px, py) inside the wall the camera is mounted on? Used by the
// renderer to draw the camera body on the right side of its tile.
export function cameraMountSide(camera, level) {
  if (tileAt(level, Math.floor(camera.x / TILE), Math.floor(camera.y / TILE) - 1) === 1) return 'north';
  if (tileAt(level, Math.floor(camera.x / TILE), Math.floor(camera.y / TILE) + 1) === 1) return 'south';
  if (tileAt(level, Math.floor(camera.x / TILE) - 1, Math.floor(camera.y / TILE)) === 1) return 'west';
  return 'east';
}

export { isSolidTile };
