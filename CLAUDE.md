# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Vanilla-JS Tetris. No dependencies, no build step, no package.json, no test suite. Three files: `index.html`, `style.css`, `game.js`.

## Running / testing changes

No build/lint/test commands exist. To verify a change, open `index.html` directly in a browser, or serve it locally:

```bash
python3 -m http.server 8000   # or: npx serve .
```

Then check the change by playing the game (there is no automated test to run instead).

## Architecture

Everything lives in `game.js` (~300 lines), driven by a single `requestAnimationFrame` loop (`loop()`), started by `init()` at the bottom of the file.

- **Board model**: `board` is a `ROWS × COLS` matrix (20×10) of `0` (empty) or a color index `1–8` for a locked piece.
- **Pieces**: `PIECES` are square matrices (8 types, incl. index 8 = "nut", 3×3 ring with empty center); `current`/`next` are `{ type, shape, x, y }`. Rotation is `rotateCW` (transpose + reverse), used by `tryRotate`, which tries wall-kick offsets `[0, -1, 1, -2, 2]` before giving up on a rotation.
- **Collision**: `collide(shape, ox, oy)` is the single source of truth for whether a shape placement is legal — bounds check + overlap with locked board cells. Movement, rotation, ghost-piece projection, and spawn-collision (game over) all route through it.
- **Lock/clear cycle**: `lockPiece()` → `merge()` (bake piece into `board`) → `clearLines()` (bottom-up full-row sweep, splice + unshift empty row at top) → `spawn()` (promote `next` to `current`, generate new `next`, check for immediate collision = game over).
- **Scoring/leveling**: `LINE_SCORES = [0,100,300,500,800]` × `level`; hard drop adds `2 × rows dropped`; soft drop adds `1` per row. Level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)` ms.
- **Rendering**: `draw()` clears and redraws grid, locked board, ghost piece (`ghostY()` projects straight down via `collide`, drawn at `globalAlpha 0.2`), then the current piece — every frame, no dirty-rect tracking. `drawNext()` renders the preview canvas the same way.
- **Input**: single `keydown` listener switches on `e.code` (arrows, `KeyX` for rotate, `Space` for hard drop, `KeyP` for pause), gated by `paused`/`gameOver`.

If you change `COLS`, `ROWS`, or `BLOCK` in `game.js`, also update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS × BLOCK`, `ROWS × BLOCK`) — nothing derives it automatically.

README.md (in Spanish) has more narrative detail if needed, but the above supersedes it for architecture.
