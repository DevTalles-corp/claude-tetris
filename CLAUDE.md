# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A classic Tetris implementation in vanilla JavaScript (ES6+), HTML5 Canvas, and CSS. No dependencies, no build tools, no package manager — just `index.html`, `style.css`, and `game.js`.

## Running the game

There is no build/lint/test tooling. To run:

```bash
# Open directly
start index.html      # Windows

# Or serve locally (recommended, avoids any local-file restrictions)
python3 -m http.server 8000
npx serve .
```

Then visit `http://localhost:8000` if using a server. To verify a change works, open the page in a browser and play — there are no automated tests.

## Architecture

Everything lives in `game.js` as top-level state and functions (no classes, no modules, no bundler). Key pieces:

- **Board model**: `board` is a `ROWS × COLS` matrix (20×10). Each cell is `0` (empty) or `1–7`, an index into `COLORS`/`PIECES` identifying which tetromino locked there.
- **Pieces**: `PIECES` defines the 7 tetrominoes as square matrices. `current` and `next` are piece objects `{ type, shape, x, y }`. Rotation is `rotateCW` (transpose + reverse), not a lookup table — there's no SRS/rotation-state tracking.
- **Collision (`collide`)**: checks a shape against board bounds and already-locked cells at a given offset. Nearly every movement operation (`tryRotate`, `softDrop`, `hardDrop`, arrow-key handlers, `ghostY`) is built on top of this one function.
- **Wall kicks (`tryRotate`)**: on rotation, tries offsets `[0, -1, 1, -2, 2]` columns until one doesn't collide, then commits.
- **Game loop (`loop`)**: driven by `requestAnimationFrame`; accumulates elapsed time in `dropAccum` and advances the piece one row once `dropAccum >= dropInterval`, otherwise just redraws.
- **Locking a piece (`lockPiece`)**: `merge()` writes the piece into `board` → `clearLines()` removes full rows and scores → `spawn()` promotes `next` to `current` and generates a new `next`; if the new piece immediately collides, `endGame()` fires.
- **Scoring/leveling**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds `2 × rows dropped`, soft drop adds `1` per row. `level` increases every 10 lines; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- **Rendering (`draw`)**: clears and redraws the whole canvas every frame — grid, locked board cells, ghost piece (`ghostY()` projected downward, drawn at `globalAlpha = 0.2`), then the current piece. `drawNext` renders the preview piece on a separate small canvas.
- **Input**: a single `keydown` listener switches on `e.code` (arrows, `Space` for hard drop, `KeyX`/`ArrowUp` for rotate, `KeyP` for pause). Movement/rotation is ignored while `paused` or `gameOver`.

Tunable constants at the top of `game.js`: `COLS`, `ROWS`, `BLOCK` (px per cell), `COLORS`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS × BLOCK` and `ROWS × BLOCK`).

## Branching model (Git Flow)

- `main` — always deployable/stable.
- `develop` — integration branch; base new work off this, not `main`.
- `feature/<name>` — branched from `develop`, merged back into `develop` via PR.
- `release/<version>` — branched from `develop` when preparing a release, merged into both `main` and `develop`.
- `hotfix/<name>` — branched from `main` for urgent fixes, merged into both `main` and `develop`.
