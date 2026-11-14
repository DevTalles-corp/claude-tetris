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
- Level and speed are recomputed inside `clearLines()` (level = lines/10 + 1; `dropInterval = max(100, 1000 - (level-1)*90)`).
- Input is a single `keydown` handler at the bottom of `game.js` (uses `e.code`).
- Canvas pixel size is hard-coded in `index.html` (`300x600` board, `120x120` next preview); if `COLS`, `ROWS` or `BLOCK` change in `game.js`, update the canvas `width`/`height` to match.
