# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris in vanilla JavaScript + HTML5 Canvas + CSS. No dependencies, no `package.json`, no build, no linter, no tests. README.md is in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python -m http.server 8000`, then http://localhost:8000).

## Architecture

Three files, all logic in `game.js` (`'use strict'`, global scope, no modules):

- `index.html` — `<canvas id="board">` (300×600), `#next-canvas` preview, score/lines/level elements, and an overlay (`#overlay`, `#overlay-title`, `#overlay-score`, `#restart-btn`) reused for both PAUSE and GAME OVER. `game.js` looks these up by id at load, so renaming ids breaks it.
- `style.css` — dark/retro styling.
- `game.js` — all state lives in top-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, ...). Flow: `init()` → `spawn()` → `requestAnimationFrame(loop)`; `loop` accumulates `dt` against `dropInterval`, drops or locks the piece, then `draw()`. A `keydown` handler does move/rotate/soft drop/hard drop/pause. A spawn that collides triggers `endGame()`.

Conventions worth knowing:
- Board cells are `0` (empty) or `1–7`, which index both `PIECES` and `COLORS` (index 0 is `null` in each). Pieces are square matrices; rotation is `rotateCW` (transpose + reverse rows), with ±1/±2 column wall kicks in `tryRotate`.
- `BLOCK`, `COLS`, `ROWS` must stay consistent with the canvas `width`/`height` attributes in `index.html` (`COLS×BLOCK` by `ROWS×BLOCK`).
- Scoring: `LINE_SCORES` × level; hard drop +2/cell, soft drop +1/row. Level rises every 10 lines; drop interval is `max(100, 1000 − (level−1)×90)` ms.
- Ghost piece (`ghostY`) is drawn with `globalAlpha = 0.2`.
