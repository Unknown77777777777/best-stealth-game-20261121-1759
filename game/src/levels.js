// The Quiet Gallery — level data.
// Three hand-authored museum floors. Every grid is fixed data (no random
// generation) so a playthrough is reproducible. One tile is 32 pixels.
//
// Grid legend:
//   '#' wall            '.' lit marble floor     ',' dark floor (shadow)
//   'C' display case    'S' statue              'P' potted plant
//   'X' locked door     'A' artifact             'E' service exit
//   '@' player start
// Cases and statues are tall cover: they block movement AND sight.
// Plants are low: they block movement but not sight. A locked door opens
// once the thief has pocketed one artifact. Dark floor slows detection.

export const TILE = 32;

export const TILE_FLOOR = 0;
export const TILE_WALL = 1;
export const TILE_CASE = 2;
export const TILE_STATUE = 3;
export const TILE_PLANT = 4;
export const TILE_DARK = 5;
export const TILE_DOOR = 6;

export function isSolidTile(tile, doorOpen) {
  if (tile === TILE_WALL || tile === TILE_CASE || tile === TILE_STATUE || tile === TILE_PLANT) return true;
  if (tile === TILE_DOOR) return !doorOpen;
  return false;
}

// Tall cover blocks a guard's line of sight; low plants do not.
export function blocksSightTile(tile, doorOpen) {
  if (tile === TILE_WALL || tile === TILE_CASE || tile === TILE_STATUE) return true;
  if (tile === TILE_DOOR) return !doorOpen;
  return false;
}

export const LEVELS = [
  {
    name: 'The Marble Hall',
    sub: 'Level 1 — two guards, wide patrols, generous cover',
    coins: 3,
    grid: ['##########################',
      '#@....C.......C..........#',
      '#.....C.......C....A.....#',
      '#........................#',
      '#..C........C........C...#',
      '#........................#',
      '#....C.....C.......C.....#',
      '#........................#',
      '#..C........C....A.......#',
      '#........................#',
      '#.....C.......C....C.....#',
      '#........................#',
      '#..C.......C.......C.....#',
      '#........................#',
      '#....C........C......C...#',
      '#........................#',
      '#.......C.......C....E...#',
      '##########################',
    ],
    // Patrol loops are axis-aligned rectangles on open rows/columns.
    guards: [
      { waypoints: [[2, 3], [23, 3], [23, 13], [2, 13]], speed: 52 },
      { waypoints: [[2, 7], [23, 7], [23, 15], [2, 15]], speed: 58 },
    ],
    cameras: [],
  },
  {
    name: 'The East Wing',
    sub: 'Level 2 — three guards, a locked side room, tighter patrols',
    coins: 3,
    grid: ['############################',
      '#@....C.......C............#',
      '#.....C.......C.....A......#',
      '#..........C...............#',
      '#..C........C.......C......#',
      '#..............#############',
      '#....C......C..#...........#',
      '#..............#....A......#',
      '#..C.....C.....#...........#',
      '#..............#...........#',
      '#....C......C..####X########',
      '#..........................#',
      '#..C.......C.......C.......#',
      '#...................A......#',
      '#.....C.......C....C.......#',
      '#..........................#',
      '#........C.......C....E....#',
      '############################',
    ],
    guards: [
      { waypoints: [[2, 3], [10, 3], [10, 13], [2, 13]], speed: 58 },
      { waypoints: [[16, 1], [25, 1], [25, 2], [16, 2]], speed: 62 },
      { waypoints: [[16, 11], [26, 11], [26, 15], [16, 15]], speed: 62 },
    ],
    cameras: [],
  },
  {
    name: 'The Vault',
    sub: 'Level 3 — four guards, sweeping cameras, deep shadow',
    coins: 4,
    grid: ['##############################',
      '#@....C......,,,,,,..........#',
      '#.....C......,,,,,,...A......#',
      '#..........C.,,,,,...........#',
      '#..C........C.....C..........#',
      '#..............,,,,,,........#',
      '#....C......C..,,,,,,..C.....#',
      '#..............,,,,,,........#',
      '#..C......C....,,,,,,...A....#',
      '#............................#',
      '#.....C.......C......C.......#',
      '#..,,,,,.....................#',
      '#..A,,,,....C.......C........#',
      '#..,,,,,.....................#',
      '#....C.......C......C...E....#',
      '#............................#',
      '#.......C.......C............#',
      '##############################',
    ],
    guards: [
      { waypoints: [[2, 9], [27, 9], [27, 15], [2, 15]], speed: 64 },
      { waypoints: [[2, 1], [2, 15], [28, 15], [28, 1]], speed: 66 },
      { waypoints: [[9, 1], [9, 9], [20, 9], [20, 1]], speed: 60 },
      { waypoints: [[15, 11], [25, 11], [25, 13], [15, 13]], speed: 68 },
    ],
    // Fixed cameras mounted on the walls; their cones sweep back and forth.
    // angle is the rest direction in radians (0 = east, PI/2 = south).
    cameras: [
      { tx: 15, ty: 0, angle: Math.PI / 2, sweep: 0.7, speed: 0.55, range: 210 },
      { tx: 29, ty: 8, angle: Math.PI, sweep: 0.55, speed: 0.7, range: 200 },
    ],
  },
];

// Turn a level definition into the runtime structures the game uses.
// Returns tiles (2D array of tile ids), artifact list, start/exit in pixels,
// guard spawn data and camera data. Throws on malformed grids so a bad
// level fails loudly at load time instead of mid-game.
export function parseLevel(def) {
  const height = def.grid.length;
  const width = def.grid[0].length;
  const tiles = [];
  const artifacts = [];
  let start = null;
  let exit = null;
  let door = null;
  for (let y = 0; y < height; y++) {
    const row = def.grid[y];
    if (row.length !== width) {
      throw new Error(`Level "${def.name}" row ${y} is ${row.length} wide, expected ${width}`);
    }
    const out = [];
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      let tile = TILE_FLOOR;
      if (ch === '#') tile = TILE_WALL;
      else if (ch === 'C') tile = TILE_CASE;
      else if (ch === 'S') tile = TILE_STATUE;
      else if (ch === 'P') tile = TILE_PLANT;
      else if (ch === ',') tile = TILE_DARK;
      else if (ch === 'X') { tile = TILE_DOOR; door = { tx: x, ty: y }; }
      else if (ch === 'A') artifacts.push({ tx: x, ty: y, x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, taken: false });
      else if (ch === '@') start = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
      else if (ch === 'E') exit = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, tx: x, ty: y };
      else if (ch !== '.') throw new Error(`Level "${def.name}" has unknown tile '${ch}' at ${x},${y}`);
      out.push(tile);
    }
    tiles.push(out);
  }
  if (!start) throw new Error(`Level "${def.name}" has no player start '@'`);
  if (!exit) throw new Error(`Level "${def.name}" has no exit 'E'`);
  if (artifacts.length === 0) throw new Error(`Level "${def.name}" has no artifacts 'A'`);
  return {
    name: def.name,
    sub: def.sub,
    coins: def.coins,
    width,
    height,
    tiles,
    artifacts,
    start,
    exit,
    door,
    guardDefs: def.guards,
    cameraDefs: def.cameras,
    pixelWidth: width * TILE,
    pixelHeight: height * TILE,
  };
}

// Is the tile at (tx, ty) walkable? Out-of-bounds counts as solid.
export function tileAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= level.width || ty >= level.height) return TILE_WALL;
  return level.tiles[ty][tx];
}

// Circle-vs-tile collision: true when a circle at (x, y) with radius r
// overlaps any solid tile.
export function circleHitsSolid(level, x, y, r, doorOpen) {
  const x0 = Math.floor((x - r) / TILE);
  const x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE);
  const y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!isSolidTile(tileAt(level, tx, ty), doorOpen)) continue;
      const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
      const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  return false;
}

// Is the tile under pixel (x, y) a dark (shadow) tile?
export function isDarkAt(level, x, y) {
  return tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE)) === TILE_DARK;
}
