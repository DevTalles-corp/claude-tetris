# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- No build, lint, or test tooling. No `package.json`, no dependencies.
- Run: open `index.html` directly, or serve the folder (e.g. `python3 -m http.server 8000`).
- Testing: none automated; verify by reloading and playing.

## Architecture

Three files, no modules, no framework: `index.html` loads `style.css` and a single `game.js` script.

- **`game.js` is one global-state game loop.** All state lives in top-level `let`s (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `animId`). `init()` resets everything and is also the restart handler.
- **Board model:** `board` is `ROWS × COLS` 2D array; `0` = empty, `1–7` = color index into `COLORS`, which is also the piece-type index into `PIECES`. Pieces are small square matrices using the same numbering.
- **Piece lifecycle:** `spawn()` promotes `next` → `current` and calls `endGame()` if the new piece collides immediately. Locking goes through `lockPiece()` = `merge()` → `clearLines()` → `spawn()`. Hard drop and soft drop (when blocked) and the gravity tick in `loop()` all reach `lockPiece()`. Keep this single path.
- **Loop:** `loop(ts)` accumulates `dt` into `dropAccum`; when it crosses `dropInterval` it moves the piece down or locks it. Then it calls `draw()` and reschedules via `requestAnimationFrame`. `togglePause()` cancels/restarts the loop manually.
- **Rendering:** every frame redraws the whole board canvas (`draw()`: grid → locked cells → ghost at `globalAlpha` 0.2 → current piece). `drawNext()` draws the preview on a separate 120×120 canvas.
- **Scoring/level couple:** `clearLines()` awards `LINE_SCORES[n] * level` using the level *before* it is recomputed, then sets `level = floor(lines/10)+1` and `dropInterval = max(100, 1000 - (level-1)*90)`. The initial `1000` in `init()` duplicates that formula's base; change both together.
- **Input:** one `keydown` listener on `document`. `KeyP` toggles pause and is handled before the paused/gameOver guard; all other keys are ignored while paused or game over. Rotation (`tryRotate`) tries kicks `[0,-1,1,-2,2]`.

## Constraints

- `COLS`, `ROWS`, `BLOCK` in `game.js` must match `width`/`height` of `<canvas id="board">` in `index.html` (currently 300×600 = 10×30 × 20×30). Changing one without the other distorts rendering.
- The preview canvas assumes a 4×4 cell grid at `NB = 30` in `drawNext()`; its size is hard-coded in `index.html`.
- UI strings are in Spanish (`PAUSA`, `GAME OVER`, `Reiniciar`, `Puntuación`); keep them consistent with `README.md`.
