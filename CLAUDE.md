# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A classic Tetris implementation in vanilla JavaScript, HTML5 Canvas, and CSS. No dependencies, no build process, no package.json.

## Running the game

Open `index.html` directly, or serve it with any static server:

```bash
open index.html          # macOS
python3 -m http.server 8000   # then visit http://localhost:8000
npx serve .
```

There is no build, lint, or test tooling in this repo — changes to `game.js` are verified by reloading the page and playing.

## Architecture

The entire game lives in three files with no module system (plain `<script src="game.js">`):

- `index.html` — DOM structure: the `#board` canvas (300×600, i.e. `COLS×BLOCK` × `ROWS×BLOCK`), the `#next-canvas` preview, HUD elements (`#score`, `#lines`, `#level`), and the pause/game-over `#overlay`.
- `style.css` — dark/retro arcade visual theme.
- `game.js` — all game logic, as top-level functions operating on module-level `let` state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc). No classes, no state management library.

### Core model

- **Board**: a `ROWS × COLS` matrix where each cell is `0` (empty) or a color index `1–7` identifying which piece locked there.
- **Pieces**: defined in `PIECES` as square matrices of color indices. Rotation is done via `rotateCW` (transpose + row reverse), not by storing pre-rotated states.
- **Collision** (`collide`): checks board bounds and overlap with locked cells.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` and keeps the first that doesn't collide.
- **Game loop** (`loop`): driven by `requestAnimationFrame`; accumulates elapsed time in `dropAccum` and advances the piece one row once it exceeds `dropInterval`.
- **Line clearing** (`clearLines`): scans bottom-to-top, splices out full rows and unshifts empty ones at the top.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds 2 points/row dropped, soft drop adds 1 point/row.
- **Leveling**: `level` increases every 10 lines; `dropInterval = max(100, 1000 - (level-1)*90)` ms.
- **Ghost piece** (`ghostY`): projects the current piece straight down to its landing row, drawn at `globalAlpha = 0.2`.

### Flow

`init()` → creates the board, generates `next`, calls `spawn()` (promotes `next` to `current`, generates a new `next`), starts `requestAnimationFrame(loop)`. If a freshly spawned piece immediately collides, `endGame()` fires and the Game Over overlay is shown. Keyboard input (`keydown`) drives movement/rotation/soft-drop/hard-drop/pause; the restart button re-runs `init()`.

### Tunable constants (top of `game.js`)

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS × BLOCK` and `ROWS × BLOCK`).

## Notes

- README.md is written in Spanish and is the canonical source for gameplay/controls documentation — keep it in sync with `game.js` if mechanics change.
