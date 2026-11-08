# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris on HTML5 Canvas. The game itself has no dependencies and no build step. The only dev dependency is `@playwright/test` (pinned in `package.json`), used for QA tests in `tests/` on the `qa` branch, with evidence screenshots in `tests/evidencia/`. Run them with `npm test`. Per the `qa-tests` skill, requirement tests are written on `qa` and merged to `main` through a PR. No linter. The README and UI strings are in Spanish; keep user-facing text consistent with that.

## Running

Open `index.html` directly, or serve the directory statically (e.g. `python3 -m http.server 8000`) and visit `http://localhost:8000`. Verification is manual, in the browser.

## Architecture

Three files: `index.html` (DOM + two canvases), `style.css`, and `game.js` (all logic, loaded as a plain script, so everything is global within `'use strict'`).

- **State** lives in module-level `let` variables declared on one line (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`, and the combo state `combo`, `b2b`, `lastRotated`). `init()` resets all of them and is also the restart handler.
- **Board** is a `ROWS × COLS` matrix of `0` or a color index 1–12 (1–7 classic pieces, 8–12 special pieces). The same index keys both `COLORS` and `PIECES`, and the shape matrices store that index as their cell value (not `1`), so `merge()` writes piece cells straight into `board`.
- **Pieces** are square matrices rotated by `rotateCW`. `tryRotate` applies wall kicks by trying x offsets `[0, -1, 1, -2, 2]`.
- **Special pieces**: pentominoes `+`, `U`, `Y` (8–10), the 1×1 `SINGLE` (11) and the `HOLLOW` 3×3 square (12, center cell `0`). `randomPiece()` → `randomType()`: the 1×1 first if `bonusSingle` is set (`settleMove()` sets it on a Tetris), else `HOLLOW_CHANCE` / `PENTOMINO_CHANCE`, else a classic piece. `lastSpecial` forbids two specials in a row (except the reward). Both flags live on the state line and are reset in `init()`.
- **Lock flow**: `lockPiece()` → `detectTSpin()` (must run before `clearLines()` shifts the rows) → `merge()` → `clearLines()` (only removes rows and returns the count) → `settleMove()` (score, `combo`, `b2b`, lines, level, `dropInterval`, emits events) → `spawn()`. `spawn()` promotes `next` to `current`, clears `lastRotated`, and calls `endGame()` if it collides immediately.
- **Loop**: `loop(ts)` runs on `requestAnimationFrame`, accumulates `dropAccum`, and gravity-drops or locks once it reaches `dropInterval`. Key handling is a single `keydown` listener that mutates `current` directly. `draw()` is called every frame, never from input handlers.
- **Scoring**: every bonus is combined only in `scoreMove()`, a pure function: `round((base × B2B + perfectClear) × min(combo, MAX_COMBO_MULTIPLIER))`, where base is `LINE_SCORES` or the T-spin tables times the level. Don't add points anywhere else, or bonuses get applied twice. +1 per soft-drop row and +2 per hard-drop row are added directly. Fall speed is `max(100, 1000 - (level-1)*90)` ms and level is `floor(lines/10)+1`.
- **T-spin**: `lastRotated` is set by a successful `tryRotate` and cleared by any move, soft drop, gravity drop, or a hard drop that moves the piece. `current.rot` (0 = spawn, T pointing up) selects the two front corners.
- **Events**: rules call `emit()`; visuals (`renderEvent`) and sound (`soundEvent`, Web Audio) only subscribe via `onGameEvent` and never change game state. `soundLog` records played sounds for the tests.

## Gotchas

- Canvas sizes are hardcoded in `index.html` (`board` is 300×600, `next-canvas` is 120×120). If you change `COLS`, `ROWS` or `BLOCK` in `game.js`, update the `<canvas>` width/height to match.
- `endGame()` and `togglePause()` stop the loop with `cancelAnimationFrame(animId)`. When game over is triggered from inside `loop` (gravity lock), `cancelAnimationFrame` has no effect on the frame that is already running, so `loop` checks `gameOver` after `draw()` and returns without scheduling another frame. Keep that check when changing the loop or end-of-game behavior; otherwise the game keeps locking pieces behind the GAME OVER overlay.
- `README.md` documents controls, scoring and tunable constants; update it if you change them.
