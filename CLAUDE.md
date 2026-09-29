# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla Tetris implementation using HTML5 Canvas. No dependencies, no build step, no package.json, no test suite.

## Running

Open `index.html` directly in a browser, or serve it statically:

```bash
python3 -m http.server 8000
# or
npx serve .
```

There is no build, lint, or test command — this is plain JS/CSS/HTML consumed as-is by the browser.

## Architecture

Three files, no modules/bundler — `game.js` is loaded directly via `<script src="game.js">` and relies on global scope.

- **`index.html`** — DOM shell: `#board` canvas (300×600, 10×20 grid at `BLOCK=30`px), `#next-canvas` preview, HUD spans (`#score`, `#lines`, `#level`), and the `#overlay` used for both pause and game-over.
- **`style.css`** — dark/retro theme, flexbox layout, no build step.
- **`game.js`** — entire game logic, all state as module-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.). No classes, no state management library.

### Core model

- **Board**: `ROWS × COLS` matrix (`createBoard`), each cell is `0` (empty) or a color index `1–7` identifying which piece locked there.
- **Pieces**: `PIECES` array of square matrices (index 0 unused/null so piece type IDs 1–7 index directly into `PIECES`/`COLORS`). Rotation (`rotateCW`) is a matrix transpose + reverse, not precomputed rotation states.
- **Collision** (`collide`): bounds + board-cell overlap check, used for movement, rotation, and ghost-piece projection.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` columns until one doesn't collide.
- **Lock → clear → spawn pipeline**: `lockPiece()` calls `merge()` (bake current piece into `board`) → `clearLines()` (bottom-up full-row sweep, splice + unshift empty row at top) → `spawn()` (promote `next` to `current`, generate new `next`, check spawn collision → `endGame()`).
- **Game loop** (`loop`, driven by `requestAnimationFrame`): accumulates delta time in `dropAccum`; once it exceeds `dropInterval`, advances the piece one row or locks it. `draw()` runs every frame regardless (grid → locked board → ghost piece at `globalAlpha=0.2` → current piece).
- **Scoring/leveling**: `LINE_SCORES` table `[0,100,300,500,800]` × `level`; hard drop is 2 pts/row, soft drop 1 pt/row. Level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`.

### Input

Single `keydown` listener switches on `e.code`; movement/rotation/drop are ignored while `paused` or `gameOver` (except `KeyP`, which always toggles pause). `togglePause()` and `endGame()` both drive the same `#overlay` element, distinguished by `overlayTitle`/`overlayScore` text.

### Tunable constants (top of `game.js`)

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `PIECES`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS×BLOCK` by `ROWS×BLOCK`).
