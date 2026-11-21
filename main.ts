// The Quiet Gallery — the hand-in program for the best-stealth-game entry.
// A Node 22 program using only the standard library. It gathers the game
// (plain static files under game/) and the screenshots beside this file,
// copies them to the output directory, and writes dossier.json with the
// vendored make.fun library, which is the summary the judge reads.
//
// Run it from this directory with an output directory of your choice:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The game first, then the screenshots; both are copied whole so the
// dossier the library builds describes exactly what ships.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own (see the kit's reference/gate.json): the
// text cap shapes how much source the dossier carries, and the rest refuse
// an entry the scorer would refuse — more than 4 screenshots or one over
// 256 KiB, more than 993 files in game/ or 48 MiB of game files in all,
// or a path under game/ over 1,000 bytes. game/ counts beside /output's
// own 1,000-entry cap, its screenshots/ and dossier.json, so the caps
// below leave room for all three.
//
// Check the hand-in before the library does: a missing game/ or an empty
// screenshots/ folder is a build mistake, and an oversized screenshot
// would only be refused later by buildDossier. Fail here, loudly, with
// the file at fault named, so a bad run never writes a bad dossier.
const SCREENSHOT_MAX_BYTES = 262144;
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing: the game folder is not beside main.ts');
}
if (!existsSync(join(here, 'screenshots'))) {
  throw new Error('screenshots/ is missing: take 3 or 4 screenshots of the game first');
}
const shotFiles = readdirSync(join(here, 'screenshots'))
  .filter((name) => !name.startsWith('.'))
  .sort();
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`screenshots/ holds ${shotFiles.length} images, expected 3 or 4`);
}
for (const name of shotFiles) {
  const bytes = statSync(join(here, 'screenshots', name)).size;
  if (bytes > SCREENSHOT_MAX_BYTES) {
    throw new Error(`screenshots/${name} is ${bytes} bytes, over the 256 KiB cap`);
  }
}
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
