# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no build, no tests, no linter. README.md is in Spanish; UI strings are mixed Spanish/English.

## Run

Open `index.html` in a browser, or serve statically: `python -m http.server 8000`.

## Architecture

Three files, one global script scope (`index.html` loads `game.js` with a plain `<script>`; no modules).

- `game.js` holds all logic as top-level functions sharing module-level `let` state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, ...). `init()` resets all of it, so restart (button and game over) is just `init()`.
- Loop: `loop(ts)` via `requestAnimationFrame` accumulates `dropAccum` and drops one row when it passes `dropInterval`. `lockPiece()` then runs `merge` → `clearLines` → `spawn`. A colliding spawn calls `endGame()`.
- Board is a `ROWS × COLS` matrix of `0` or color index 1–7 (indexes `COLORS`). Pieces in `PIECES` are square matrices; rotation is `rotateCW` plus `tryRotate` wall kicks (±1, ±2 columns).
- Rendering is split across `draw()` (grid, board, ghost, current piece) and `drawNext()` (second canvas).

## Gotchas

- Canvas size is hardcoded in `index.html` (`#board` is 300×600, `#next-canvas` and `#hold-canvas` are 120×120). Changing `COLS`, `ROWS` or `BLOCK` in `game.js` requires updating those attributes to `COLS×BLOCK` by `ROWS×BLOCK`.
- DOM ids used by `game.js` (`board`, `next-canvas`, `hold-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`) are looked up at load. Renaming one in the HTML breaks the script.
- Scoring: `LINE_SCORES` times level. Hard drop gives 2 points per cell, soft drop 1 per row. Level rises every 10 lines. Fall interval is `max(100, 1000 − (level − 1) × 90)` ms.
- `#pause-menu` and its children (`resume-btn`, `pause-restart-btn`, `start-level`) are looked up at load; the start level persists in localStorage key `tetris-start-level` and applies in `init()` (next game), and `clearLines` never drops below it.
