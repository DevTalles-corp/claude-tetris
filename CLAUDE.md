# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris in vanilla JS + HTML5 Canvas. No dependencies, no build, no tests, no linter. README.md (Spanish) documents controls and customization.

## Run

Open `index.html` directly, or serve statically: `python -m http.server 8000` (or `npx serve .`).

## Architecture

Three files, all loaded by `index.html` (`<script src="game.js">`, no modules):

- `index.html` — fixed DOM ids that `game.js` looks up at load: `board` (300x600 canvas), `next-canvas` (120x120), `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`. Renaming any breaks the game.
- `style.css` — layout/theme only.
- `game.js` (~300 lines) — all logic, global scope:
  - Constants: `COLS=10`, `ROWS=20`, `BLOCK=30` (canvas size = COLS/ROWS × BLOCK; keep in sync with canvas attrs in HTML), `COLORS`, `PIECES`, `LINE_SCORES`.
  - Mutable game state lives in module-level `let` vars (`board`, `current`, `next`, `score`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`...), reset in `init()`.
  - Loop: `requestAnimationFrame(loop)` accumulates delta time into `dropAccum`; gravity step when it exceeds `dropInterval` (shrinks per level). `lockPiece` → `merge` → `clearLines` → `spawn` (game over if spawn collides).
  - Single `keydown` listener handles input; restart button calls `init`.
  - Rendering is a full redraw each frame (`draw`, `drawNext`, ghost piece via `ghostY`).
