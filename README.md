# The Quiet Gallery

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Unknown77777777777/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Unknown77777777777/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

An original top-down stealth game. You are **Wren**, a thief slipping through
a museum at night. Pocket every artifact and reach the service exit unseen.

## How to play

Serve `game/` with any static server and open `game/index.html` in a desktop
browser — no network, no build step:

```sh
cd game && python3 -m http.server 8080
```

Guards patrol in cones of light. Step into a cone and the detection meter
fills — faster up close, in the light, and while walking. Break line of
sight and it drains; fill it and the alarm sounds, and every guard converges
on you. Hide behind display cases and statues (tall cover blocks sight),
stick to the dark floor, sneak with Shift, and toss a coin to lure a guard
away from your route. If a guard touches you, you are caught.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move |
| Shift | Sneak — slower, quieter, harder to spot |
| E | Pick up an artifact / open the exit |
| Q or mouse click | Toss a coin to distract the nearest guard |
| M | Mute |
| R | Restart the level |

## Levels

1. **The Marble Hall** — 2 guards, wide patrol loops, 2 artifacts.
2. **The East Wing** — 3 guards, tighter patrols, a locked side room that
   opens once you have pocketed one artifact, 3 artifacts.
3. **The Vault** — 4 guards, 2 sweeping security cameras, deep shadow
   zones, 3 artifacts.

## Structure

- `game/src/main.js` — bootstrap, fixed-timestep loop, state machine,
  detection meter and alarm.
- `game/src/levels.js` — the three hand-authored level grids and the loader.
- `game/src/guards.js` — guard AI (patrol / suspicious / alert), vision
  cones, line-of-sight raycast, and sweeping cameras.
- `game/src/player.js` — movement, sneaking, footsteps, pickups, coin toss.
- `game/src/render.js` — top-down canvas rendering, lighting and darkness.
- `game/src/audio.js` — synthesized WebAudio sounds, no audio files.
- `game/src/input.js` — keyboard and mouse input.
- `game/src/shots.js` — staged screenshot states built from the game's
  own code paths.

All art and sound is original and made in code; the game loads nothing over
the network.
