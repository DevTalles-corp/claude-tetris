# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running

Vanilla HTML/CSS/JS Tetris. No build, lint, or test tooling exists (no `package.json`), so there is no test command. Open `index.html` directly, or serve statically, e.g. `python -m http.server 8000`.

## Architecture

All logic is in `game.js`, a single non-module script with top-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, ...) that `init()` resets.

- Board is a `ROWS x COLS` matrix of `0` or a piece id 1-7. `PIECES` and `COLORS` are indexed by that same id (index 0 is `null`), so adding or changing a piece means editing both.
- Flow: `init` -> `spawn` -> `loop` (requestAnimationFrame, accumulates time against `dropInterval`) -> `lockPiece` -> `merge`/`clearLines` -> `spawn`. A spawned piece that collides calls `endGame`.
- A single `keydown` handler (uses `e.code`) drives move, rotate, soft/hard drop and pause. `tryRotate` tries wall-kick offsets `[0, -1, 1, -2, 2]`.
- Scoring: `LINE_SCORES[cleared] * level`; hard drop +2 per cell, soft drop +1 per row. Level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms. The level/interval update lives inside the line-clear path.

## Coupling to watch

- `COLS`, `ROWS`, `BLOCK` must match the `<canvas id="board">` `width`/`height` (300x600) in `index.html`.
- `game.js` fetches DOM elements by id at load time (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`); renaming any in `index.html` breaks the game.
- README and UI text are in Spanish. The README's project-structure section references a stale `03-tetris/` folder name.
