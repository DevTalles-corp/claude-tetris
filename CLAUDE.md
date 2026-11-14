# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris (HTML5 Canvas + CSS). No `package.json`, no build step, no tests, no linter. The README and UI text are in Spanish.

## Running

Open `index.html` directly in a browser, or serve the folder statically (e.g. `python -m http.server 8000`, then visit `http://localhost:8000`).

## Architecture

Three files: `index.html` (DOM + two canvases), `style.css`, and `game.js` (all logic, loaded as a classic script, `'use strict'`).

`game.js` uses module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, ...) declared in one `let` line and reset by `init()`. Key points that span the file:

- Board is a `ROWS x COLS` matrix; `0` = empty, `1-7` = index into both `COLORS` and `PIECES` (the piece type id doubles as the color id, and index 0 is `null` in both).
- Piece lifecycle: `spawn()` promotes `next` to `current`; if it collides immediately it calls `endGame()`. All locking goes through `lockPiece()` (merge -> `clearLines()` -> `spawn()`), used by the gravity tick in `loop()`, `softDrop()` and `hardDrop()`.
- `loop()` is the `requestAnimationFrame` game loop; gravity uses `dropAccum` vs `dropInterval`. Pause/game over work by `cancelAnimationFrame(animId)`, and resuming restarts `loop` manually, so keep `lastTime` reset when resuming.
- Cell ids: `1-7` classic pieces, `8-12` special pieces (+, U, Y, 1x1, 3x3 ring), `13` garbage, `14` wildcard, `15` power-up (never stored on the board; applied by `applyPower()` on lock). `COLORS`/`PIECES` are indexed by these ids.
- Upcoming pieces live in the `upcoming` queue (`next` = `upcoming[0]`); rewards/power-ups are inserted with `insertAfterNext()`. Hold goes through `doHold()`, locked per piece via `holdUsed`.
- `lockPiece()` also owns scoring: combo multiplier, T-spin, back-to-back, perfect clear, energy, level/speed (level = baseLevel + lines/10; `dropInterval = max(100, 1000 - (level-1)*90)`), power-up/reward insertion and challenge goal check. It calls `saveUndo()` first (used by the "undo" ability).
- Challenge modes are configured in `CHALLENGES` and selected via `#mode-select`; the ability menu (`E`) pauses the loop like `togglePause()` does, and resumes by resetting `lastTime`.
- Extra canvases: `hold-canvas` (120x120) and `look-canvas` (120x200, only shown while the "next 5" ability is active); all previews use `drawMini()`.
- Input is a single `keydown` handler at the bottom of `game.js` (uses `e.code`).
- Canvas pixel size is hard-coded in `index.html` (`300x600` board, `120x120` next preview); if `COLS`, `ROWS` or `BLOCK` change in `game.js`, update the canvas `width`/`height` to match.
