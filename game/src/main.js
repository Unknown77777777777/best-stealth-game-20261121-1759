// The Quiet Gallery — bootstrap, game loop and state machine.
// States: menu -> playing -> caught -> levelclear -> win. The loop runs on
// requestAnimationFrame with a fixed 1/60 s timestep. This file owns the
// detection meter, the alarm, hearing, pickups and the exit; the guards,
// the thief and the renderer each own their own job.

import { LEVELS, parseLevel, TILE } from './levels.js';
import { Guard, Camera } from './guards.js';
import { Player } from './player.js';
import { render, VIEW_W, VIEW_H } from './render.js';
import { SoundEngine } from './audio.js';
import { Input } from './input.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const CATCH_DISTANCE = 22;

// How fast the detection meter fills when a watcher has eyes on Wren.
// Close + lit + walking fills fast; far + dark + sneaking fills slowly.
function detectionRate(dist, range, inDark, sneaking) {
  const proximity = 1.7 - 1.2 * Math.min(1, dist / range);
  const light = inDark ? 0.45 : 1;
  const sneak = sneaking ? 0.55 : 1;
  return 0.55 * proximity * light * sneak;
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvas.width = VIEW_W;
    this.canvas.height = VIEW_H;
    this._darkCanvas = document.createElement('canvas');
    this._darkCanvas.width = VIEW_W;
    this._darkCanvas.height = VIEW_H;
    this.input = new Input(canvas);
    this.sound = new SoundEngine();
    this.state = 'menu';
    this.levelIndex = 0;
    this.level = null;
    this.player = null;
    this.guards = [];
    this.cameras = [];
    this.detection = 0;
    this.alarm = false;
    this.alarmTimer = 0;
    this.doorOpen = false;
    this.exitOpen = false;
    this.elapsed = 0;
    this.totalTime = 0;
    this.camera = { x: 0, y: 0 };
    this._last = 0;
    this._acc = 0;
    this._hud = {};
    for (const id of ['hud-level', 'hud-objective', 'hud-artifacts', 'hud-coins', 'hud-timer', 'hud-detection', 'hud-detection-label', 'overlay']) {
      this._hud[id] = document.getElementById(id);
    }
    this.input.onFirstGesture = () => this.sound.init();
    this.loadLevel(0);
    this.showMenu();
  }

  loadLevel(index) {
    this.levelIndex = index;
    this.level = parseLevel(LEVELS[index]);
    this.player = new Player(this.level);
    this.guards = this.level.guardDefs.map((d) => new Guard(d));
    this.cameras = this.level.cameraDefs.map((d) => new Camera(d));
    this.detection = 0;
    this.alarm = false;
    this.alarmTimer = 0;
    this.doorOpen = false;
    this.exitOpen = false;
    this.elapsed = 0;
  }

  start() {
    this.sound.init();
    this.state = 'playing';
    this.input.clicked = false; // the click that started must not throw a coin
    this.hideOverlay();
    this.updateHud();
  }

  restartLevel() {
    this.loadLevel(this.levelIndex);
    this.state = 'playing';
    this.input.clicked = false;
    this.hideOverlay();
    this.updateHud();
  }

  nextLevel() {
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.state = 'win';
      this.showWin();
      return;
    }
    this.totalTime += this.elapsed;
    this.loadLevel(this.levelIndex + 1);
    this.state = 'playing';
    this.hideOverlay();
    this.updateHud();
  }

  // ---- overlays -------------------------------------------------------

  showOverlay(html) {
    const el = this._hud.overlay;
    el.innerHTML = html;
    el.classList.remove('hidden');
  }

  hideOverlay() {
    const el = this._hud.overlay;
    el.innerHTML = '';
    el.classList.add('hidden');
  }

  showMenu() {
    this.showOverlay(`
      <div class="panel">
        <h1>The Quiet Gallery</h1>
        <p class="tagline">A thief. A museum at night. Nobody must see you.</p>
        <p>Slip past the guards, pocket every artifact, and reach the
        service exit unseen. Guards patrol in cones of light — stay out of
        them, hide behind display cases, and toss a coin to lure a guard away.</p>
        <ul class="controls">
          <li><b>WASD / arrows</b> — move</li>
          <li><b>Shift</b> — sneak (slower, quieter, harder to spot)</li>
          <li><b>E</b> — pick up an artifact / open the exit</li>
          <li><b>Q or click</b> — toss a coin to distract a guard</li>
          <li><b>M</b> — mute &nbsp; <b>R</b> — restart level</li>
        </ul>
        <p class="start">Click or press Enter to begin — ${this.level.name}</p>
      </div>`);
  }

  showCaught() {
    this.showOverlay(`
      <div class="panel">
        <h1>Caught!</h1>
        <p>A guard laid hands on Wren in ${this.level.name}.</p>
        <p>Artifacts pocketed: ${this.player.artifacts} of ${this.level.artifacts.length} &nbsp;·&nbsp; Time: ${this.formatTime(this.elapsed)}</p>
        <p class="start">Press R or click to try the level again.</p>
      </div>`);
  }

  showLevelClear() {
    this.showOverlay(`
      <div class="panel">
        <h1>Level Clear</h1>
        <p>${this.level.name} — every artifact pocketed, out through the service exit.</p>
        <p>Time: ${this.formatTime(this.elapsed)} &nbsp;·&nbsp; Detection peaked and faded — the gallery never knew you were there.</p>
        <p class="start">Press Enter or click for the next wing.</p>
      </div>`);
  }

  showWin() {
    const total = this.totalTime + this.elapsed;
    this.showOverlay(`
      <div class="panel">
        <h1>The Gallery Is Yours</h1>
        <p>Wren slipped out of the Vault with every artifact. Three wings,
        no alarms that stuck, no guard the wiser.</p>
        <p>Total time: ${this.formatTime(total)}</p>
        <p class="start">Press Enter or click to play again from the Marble Hall.</p>
      </div>`);
  }

  formatTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ---- HUD ------------------------------------------------------------

  updateHud() {
    const level = this.level;
    const p = this.player;
    this._hud['hud-level'].textContent = `${level.name} — ${this.levelIndex + 1}/3`;
    const remaining = level.artifacts.length - p.artifacts;
    this._hud['hud-objective'].textContent = remaining > 0
      ? `Steal ${remaining} more artifact${remaining > 1 ? 's' : ''}, then reach the exit`
      : 'All artifacts pocketed — reach the green exit!';
    this._hud['hud-artifacts'].textContent = `◆ ${p.artifacts}/${level.artifacts.length}`;
    this._hud['hud-coins'].textContent = `◉ ${p.coins}`;
    this._hud['hud-timer'].textContent = this.formatTime(this.elapsed);
    const pct = Math.round(this.detection * 100);
    const bar = this._hud['hud-detection'];
    bar.style.width = `${pct}%`;
    bar.className = this.alarm ? 'fill alarm' : pct > 50 ? 'fill hot' : 'fill';
    this._hud['hud-detection-label'].textContent = this.alarm
      ? 'ALARM!'
      : pct > 50 ? `Spotted ${pct}% — break line of sight!` : `Detection ${pct}%`;
  }

  // ---- input ----------------------------------------------------------

  screenToWorld(sx, sy) {
    return { x: sx + this.camera.x, y: sy + this.camera.y };
  }

  handleGlobalKeys() {
    const input = this.input;
    if (input.wasPressed('KeyM')) {
      this.sound.setMuted(!this.sound.muted);
    }
    if (this.state === 'menu' && (input.wasPressed('Enter') || input.clicked)) {
      this.start();
    } else if (this.state === 'caught' && (input.wasPressed('KeyR') || input.clicked)) {
      this.restartLevel();
    } else if (this.state === 'levelclear' && (input.wasPressed('Enter') || input.clicked)) {
      this.nextLevel();
    } else if (this.state === 'win' && (input.wasPressed('Enter') || input.clicked)) {
      this.totalTime = 0;
      this.loadLevel(0);
      this.start();
    } else if (this.state === 'playing' && input.wasPressed('KeyR')) {
      this.restartLevel();
    }
  }

  // ---- the stealth core ------------------------------------------------

  update(dt) {
    if (this.state !== 'playing') return;
    this.elapsed += dt;
    const input = this.input;
    const level = this.level;
    const p = this.player;

    p.update(dt, input, level, this.doorOpen);
    if (p.moving && p.stepAccum === 0) this.sound.footstep(p.sneaking);

    // Interact: pick up an artifact, or slip out the open exit.
    if (input.wasPressed('KeyE')) {
      const a = p.artifactInReach(level);
      if (a) {
        p.pickUp(a);
        this.sound.pickupChime();
        if (p.artifacts === 1 && level.door) this.doorOpen = true;
        if (p.artifacts === level.artifacts.length) this.exitOpen = true;
      } else if (p.exitInReach(level)) {
        this.state = 'levelclear';
        this.sound.fanfare();
        this.showLevelClear();
        this.updateHud();
        return;
      }
    }
    // Walking onto the open exit also slips out.
    if (this.exitOpen && Math.hypot(level.exit.x - p.x, level.exit.y - p.y) <= 20) {
      this.state = 'levelclear';
      this.sound.fanfare();
      this.showLevelClear();
      this.updateHud();
      return;
    }

    // Coin toss: Q, or a click on the canvas.
    if (input.wasPressed('KeyQ') || input.clicked) {
      const target = input.wasPressed('KeyQ') && !input.clicked
        ? { x: p.x + Math.cos(p.dir) * 160, y: p.y + Math.sin(p.dir) * 160 }
        : this.screenToWorld(input.clickedAt.x, input.clickedAt.y);
      if (p.throwCoin(target.x, target.y)) this.sound.coinClink();
    }

    // Landed coins ping: the nearest guard comes to look.
    for (const e of p.noiseEvents) {
      if (e.ttl > 0.55) continue; // handled once, right after landing
      if (e._handled) continue;
      e._handled = true;
      let best = null;
      let bestD = Infinity;
      for (const g of this.guards) {
        const d = Math.hypot(g.x - e.x, g.y - e.y);
        if (d < bestD) { bestD = d; best = g; }
      }
      if (best) {
        best.hear(e.x, e.y);
        if (best.state === 'suspicious') this.sound.suspiciousNote();
      }
    }

    // Loud footsteps near a guard draw a look (sneaking stays quiet).
    if (p.moving && !p.sneaking && p.noisePulse > 0.6) {
      for (const g of this.guards) {
        if (g.state !== 'patrol') continue;
        if (Math.hypot(g.x - p.x, g.y - p.y) < p.noiseRadius) {
          g.hear(p.x, p.y);
          this.sound.suspiciousNote();
        }
      }
    }

    // Vision: who can see Wren right now?
    let seenBy = null;
    let seenDist = Infinity;
    for (const g of this.guards) {
      if (g.canSee(level, p.x, p.y, this.doorOpen)) {
        const d = Math.hypot(g.x - p.x, g.y - p.y);
        if (d < seenDist) { seenDist = d; seenBy = g; }
      }
    }
    for (const cam of this.cameras) {
      cam.update(dt);
      cam.seesPlayer = cam.canSee(level, p.x, p.y, this.doorOpen);
      if (cam.seesPlayer) {
        const d = Math.hypot(cam.x - p.x, cam.y - p.y);
        if (d < seenDist) { seenDist = d; seenBy = cam; }
      }
    }

    if (seenBy) {
      const rate = detectionRate(seenDist, seenBy.range || 175, p.inDark, p.sneaking);
      this.detection = Math.min(1, this.detection + rate * dt);
      if (seenBy instanceof Guard) {
        seenBy.glimpse(p.x, p.y);
        seenBy.loseTimer = 0;
      }
      if (this.detection >= 1 && !this.alarm) {
        this.alarm = true;
        this.alarmTimer = 0;
        this.sound.alertSting();
        for (const g of this.guards) g.raiseAlarm(p.x, p.y);
      }
    } else {
      this.detection = Math.max(0, this.detection - 0.22 * dt);
      for (const g of this.guards) {
        if (g.state === 'alert') {
          g.loseTimer += dt;
          if (g.loseTimer > 4) g.calmToSuspicious();
        }
      }
    }

    // The alarm decays once nobody has eyes on Wren for a while.
    if (this.alarm) {
      if (!seenBy) {
        this.alarmTimer += dt;
        if (this.alarmTimer > 5) {
          this.alarm = false;
          this.detection = 0.35;
        }
      } else {
        this.alarmTimer = 0;
        // Chasing guards keep tracking the last seen spot.
        for (const g of this.guards) {
          if (g.state === 'alert') g.lastSeen = { x: p.x, y: p.y };
        }
      }
    }

    // A glimpse past halfway makes the watcher come and look.
    if (seenBy instanceof Guard && this.detection > 0.35 && seenBy.state === 'patrol') {
      seenBy.glimpse(p.x, p.y);
    }

    for (const g of this.guards) g.update(dt, level, this.doorOpen);

    // Caught: a guard lays hands on the thief.
    for (const g of this.guards) {
      if (Math.hypot(g.x - p.x, g.y - p.y) < CATCH_DISTANCE) {
        this.state = 'caught';
        this.sound.caughtSting();
        this.showCaught();
        this.updateHud();
        return;
      }
    }

    this.updateHud();
  }

  // ---- loop ------------------------------------------------------------

  frame = (now) => {
    const dtMs = Math.min(100, now - (this._last || now));
    this._last = now;
    this._acc += dtMs / 1000;
    this.handleGlobalKeys();
    let steps = 0;
    while (this._acc >= STEP && steps < 5) {
      this.update(STEP);
      this._acc -= STEP;
      steps += 1;
    }
    if (steps === 5) this._acc = 0;
    render(this.ctx, this, now / 1000);
    this.input.endFrame();
    requestAnimationFrame(this.frame);
  };

  run() {
    this.input.attach();
    const params = new URLSearchParams(window.location.search);
    const shot = Number(params.get('shot') || 0);
    if (shot >= 1 && shot <= 4) {
      // Staged screenshot: a real game state, rendered by the real loop.
      stageShot(this, shot);
      this.sound.init();
    }
    requestAnimationFrame(this.frame);
    // Debug/testing hook: the playtest reads state through this, and the
    // game exposes nothing else to the page.
    window.__game = this;
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
game.run();
