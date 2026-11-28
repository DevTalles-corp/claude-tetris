# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No package.json, no build, no tests, no linter. The README and UI text are in Spanish.

Run it by opening `index.html` in a browser, or serve statically (e.g. `python -m http.server 8000`).

## Architecture

Three files: `index.html` (DOM + two canvases), `style.css`, and `game.js` (all logic, a single script loaded as a classic non-module `<script>`).

`game.js` uses module-level mutable globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, ...) that are reset by `init()`, which is also the restart handler. Things that span multiple functions:

- Piece lifecycle: `lockPiece()` = `merge()` → `clearLines()` → `spawn()`. `spawn()` promotes `next` to `current`, and calls `endGame()` if the new piece collides immediately. Both the gravity tick in `loop()`, `softDrop()` and `hardDrop()` go through `lockPiece()`.
- Board cells hold `0` or a piece-type index 1–7; the same index selects the entry in `COLORS` and `PIECES` (index 0 is `null` in both). New piece types need an entry in both arrays and the `Math.random() * 7` in `randomPiece()`.
- Pause/game-over share the `#overlay` element; `togglePause()` and `endGame()` stop/restart the `requestAnimationFrame` loop via `cancelAnimationFrame(animId)`.
- Board size is duplicated: `COLS`/`ROWS`/`BLOCK` in `game.js` must match the `width`/`height` attributes of `<canvas id="board">` in `index.html`. The next-piece canvas is a fixed 120×120 (4×4 cells of 30px) hardcoded in `drawNext()`.
- Gravity speed is recomputed in `clearLines()` as `max(100, 1000 - (level-1)*90)`; the initial `1000` is also hardcoded in `init()`.
- Rotation is `rotateCW` plus a simple horizontal-only kick list (`[0,-1,1,-2,2]`) in `tryRotate()`; it is not SRS.
