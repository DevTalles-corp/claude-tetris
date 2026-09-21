# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

No build, no install, no test suite, no package.json — vanilla HTML/CSS/JS, open and play.

Run locally:
```bash
start index.html        # Windows: open directly, or serve statically
npx serve .              # or: python3 -m http.server 8000
```
There is no linter or test command configured for this repo.

## Architecture

Three files, no modules, no bundler:

- `index.html` — DOM shell: `#board` canvas (300×600, 10×20 grid at `BLOCK=30`px), `#next-canvas` for the preview piece, HUD spans (`#score`, `#lines`, `#level`), and the pause/game-over `#overlay`.
- `style.css` — dark/retro arcade theme.
- `game.js` — entire game logic in one file (~300 lines), all module-level state, no classes.

### Core model (`game.js`)

- `board`: `ROWS × COLS` matrix; each cell is `0` (empty) or a color index `1–7` identifying the piece type that occupies it.
- `PIECES`: the 7 tetrominoes as square matrices of color indices; `COLORS[index]` maps index → hex color.
- Piece rotation (`rotateCW`) is a transpose + row-reverse of the shape matrix — no separate rotation-state tables (no SRS).
- `collide(shape, ox, oy)` is the single collision primitive used for movement, rotation, ghost-piece projection, and spawn-blocking (game over) checks.
- `tryRotate()` implements basic wall kicks: after rotating, it tries offsets `[0, -1, 1, -2, 2]` and keeps the first that doesn't collide.
- `lockPiece()` → `merge()` writes the current piece into `board`, then `clearLines()`, then `spawn()`.
- `clearLines()` scans bottom-to-top, splices full rows out and unshifts empty rows in; re-checks the same index (`r++`) after a splice since rows shift down.
- Scoring: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds `2 × cellsDropped`; soft drop adds `1` per row.
- Level/speed: `level = floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- Game loop (`loop`, driven by `requestAnimationFrame`) accumulates `dt` and advances the piece one row (or locks it) once `dropAccum >= dropInterval`, then calls `draw()`.
- `spawn()` promotes `next` to `current` and generates a new `next`; if the new `current` immediately collides, `endGame()` fires.
- Ghost piece: `ghostY()` projects straight down from `current` to the landing row; drawn via `drawBlock(..., alpha=0.2)`.
- All keyboard input is one `keydown` listener switching on `e.code` (arrows + `KeyX` for rotate, `Space` for hard drop, `KeyP` for pause, handled outside the paused/gameOver guard).

### Tunable constants

`COLS`, `ROWS`, `BLOCK` (must stay in sync with the `#board` canvas `width`/`height` in `index.html`, i.e. `COLS×BLOCK` and `ROWS×BLOCK`), `COLORS`, `LINE_SCORES`, initial `dropInterval`.
