# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Tetris clone written in vanilla JavaScript, HTML5 Canvas and CSS. There are no dependencies, no `package.json`, no bundler or transpiler, and no test suite or linter. The UI text and the README are in Spanish (`<html lang="es">`).

## Running

Open `index.html` in a browser, or serve the directory statically (recommended):

```bash
python -m http.server 8000   # then open http://localhost:8000
npx serve .
```

To verify a change, reload the page and play. There are no automated tests.

## Architecture

- `index.html` holds the DOM: the `#board` canvas (300×600), a side panel (`#score`, `#lines`, `#level`, `#next-canvas` 120×120) and a shared `#overlay` used for both PAUSE and GAME OVER. `game.js` loads as a plain classic `<script>` at the end of the body, not as a module.
- `game.js` is the whole game. It is a single file of top-level functions that share mutable module-level state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`). It has no classes and no state object. `init()` resets everything and is also the restart button's handler.
- **Cell encoding:** `board` is a `ROWS × COLS` matrix. Each cell is `0` (empty) or a piece type index from 1 to 7. Piece shapes in `PIECES` store that same index in their filled cells, so the index is also the key into `COLORS`. Index 0 / `null` is the empty slot in both arrays. Keep this coupling when you add or change pieces.
- **Rotation:** `rotateCW` (transpose, then reverse the rows) changes `current.shape` in place. `tryRotate` applies basic wall kicks with column offsets of ±1 and ±2. It is not SRS.
- **Game loop:** `loop` is driven by `requestAnimationFrame`. It adds the elapsed time to `dropAccum` and moves the piece down one row when `dropAccum` passes `dropInterval`. Pausing cancels the animation frame, and resuming resets `lastTime` so the time spent paused does not count. `draw()` redraws the whole board every frame (grid, locked cells, ghost piece at alpha 0.2, current piece).
- **Locking:** `lockPiece` runs `merge`, then `clearLines`, then `spawn`. `spawn` ends the game if the new piece collides as soon as it appears.
- **Scoring and level:** a cleared line scores `LINE_SCORES[n] * level`. A hard drop adds 2 points per row fallen and a soft drop adds 1 point per row. The level is `floor(lines / 10) + 1`, and the drop interval is `max(100, 1000 - (level - 1) * 90)` ms.

## Gotchas

- If you change `COLS`, `ROWS` or `BLOCK`, also update the `width`/`height` of `<canvas id="board">` in `index.html` so they equal `COLS*BLOCK` × `ROWS*BLOCK`. The next-piece preview uses its own fixed cell size of 30 inside a 4×4 area.
- The key bindings live in a single `keydown` listener at the bottom of `game.js`. They match on `e.code` (`ArrowLeft`, `KeyX`, `Space`, `KeyP`, …). If you change a binding, also update the controls list in `index.html` and the controls table in `README.md`.
