// The Quiet Gallery — staged screenshot states.
// Reading ?shot=1..4 puts a real game into a chosen moment using only the
// game's own code paths (loadLevel, place the thief and the guards, set
// the detection meter): no fake rendering anywhere, so the screenshots are
// honest renders of the game in a browser.

import { TILE } from './levels.js';

// Place the thief on a tile and face a direction (radians).
function placePlayer(game, tx, ty, dir) {
  game.player.x = (tx + 0.5) * TILE;
  game.player.y = (ty + 0.5) * TILE;
  game.player.dir = dir;
  game.player.sneaking = false;
}

// Place a guard on a tile, facing a direction, in a state.
function placeGuard(game, i, tx, ty, dir, state) {
  const g = game.guards[i];
  if (!g) return;
  g.x = (tx + 0.5) * TILE;
  g.y = (ty + 0.5) * TILE;
  g.dir = dir;
  g.lookDir = dir;
  g.held = true; // stay exactly where the shot staged it
  g.state = state || 'patrol';
  g.investigate = null;
  g.lookTimer = 0;
}

export function stageShot(game, n) {
  if (n === 1) {
    // Cover shot: Wren crouched behind a display case in the Marble Hall
    // while a guard's cone sweeps past the case.
    game.loadLevel(0);
    placePlayer(game, 5, 2, 0);
    game.player.sneaking = true;
    // The guard's cone points straight at Wren but stops at the display
    // case between them: hidden in plain sight.
    placeGuard(game, 0, 10, 2, Math.PI, 'patrol');
    placeGuard(game, 1, 18, 13, -Math.PI / 2, 'patrol');
    game.state = 'playing';
  } else if (n === 2) {
    // Mid-level play in the East Wing: three guards, cones, artifacts
    // and the locked side room all in view.
    game.loadLevel(1);
    placePlayer(game, 8, 8, Math.PI / 4);
    placeGuard(game, 0, 6, 3, Math.PI / 2, 'patrol');
    placeGuard(game, 1, 21, 1, Math.PI, 'patrol');
    placeGuard(game, 2, 20, 13, -Math.PI / 2, 'patrol');
    game.state = 'playing';
  } else if (n === 3) {
    // A tense near-miss in the Vault: the meter half full, a guard
    // suspicious and closing in, a camera cone sweeping the dark.
    game.loadLevel(2);
    placePlayer(game, 5, 12, Math.PI / 2);
    game.player.sneaking = true;
    game.detection = 0.5;
    const g = game.guards[1];
    placeGuard(game, 1, 5, 10, Math.PI / 2, 'suspicious');
    g.investigate = { x: (5 + 0.5) * TILE, y: (12 + 0.5) * TILE };
    g.lastSeen = { x: (5 + 0.5) * TILE, y: (12 + 0.5) * TILE };
    placeGuard(game, 0, 12, 9, Math.PI, 'patrol');
    placeGuard(game, 2, 15, 9, -Math.PI / 2, 'patrol');
    game.state = 'playing';
  } else if (n === 4) {
    // The exit reached: every artifact pocketed, the service door open
    // and green, Wren one step from slipping out.
    game.loadLevel(0);
    for (const a of game.level.artifacts) a.taken = true;
    game.player.artifacts = game.level.artifacts.length;
    game.exitOpen = true;
    placePlayer(game, 20, 16, 0);
    placeGuard(game, 0, 10, 7, -Math.PI / 2, 'patrol');
    placeGuard(game, 1, 5, 15, 0, 'patrol');
    game.state = 'playing';
    game.player.x = game.level.exit.x - 40;
    game.player.y = game.level.exit.y;
  }
  game.hideOverlay();
  game.updateHud();
}
