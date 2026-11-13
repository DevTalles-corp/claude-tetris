# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris on HTML5 Canvas. No dependencies, no `package.json`, no build step, no test suite, no linter. The README and in-game UI text are in Spanish; keep user-facing strings in Spanish.

## Running

Open `index.html` directly in a browser, or serve the folder statically (preferred):

```bash
python -m http.server 8000   # then open http://localhost:8000
npx serve .
```

## Architecture

Three files: `index.html` (DOM: `#board` canvas, side panel with `#score`/`#lines`/`#level`, `#next-canvas`, and a shared `#overlay` used for both PAUSA and GAME OVER), `style.css` (dark arcade theme), and `game.js` (all logic).

`game.js` is a single script with module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`) declared in one `let` line and reset by `init()`, which is also the restart handler.

- **Board model**: `ROWS × COLS` matrix; `0` = empty, `1–7` = piece type, which is also the index into `COLORS` and the value stored inside each `PIECES` matrix. A piece's shape cells carry their own color index, so `merge()` copies them straight onto the board.
- **Pieces**: `{ type, shape, x, y }`. Shapes are square matrices copied from `PIECES` (never mutate `PIECES` itself). Rotation is `rotateCW` (transpose + reverse); `tryRotate` applies simple horizontal wall kicks `[0, -1, 1, -2, 2]` — not SRS.
- **Collision**: `collide(shape, x, y)` is the single source of truth for movement, rotation, gravity, ghost projection (`ghostY`) and game-over detection. Cells with `y < 0` are allowed (above the board).
- **Piece lifecycle**: `lockPiece()` → `merge()` → `clearLines()` (updates lines/score/level/`dropInterval`) → `spawn()` (promotes `next` to `current`, rolls a new `next`, calls `endGame()` if the new piece collides, redraws the preview).
- **Loop**: `loop(ts)` via `requestAnimationFrame` accumulates `dt` into `dropAccum` and applies gravity when it exceeds `dropInterval`, then redraws the whole board every frame. Pause/game over work by cancelling `animId`.
- **Scoring/speed**: `LINE_SCORES[cleared] * level`; soft drop +1/row, hard drop +2/row. Level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.

## Gotchas

- Changing `COLS`, `ROWS` or `BLOCK` requires updating the `<canvas id="board">` `width`/`height` in `index.html` (`COLS*BLOCK` × `ROWS*BLOCK`). The next-piece preview assumes a 4×4 grid of 30px cells (120×120 canvas).
- `endGame()` cancels `animId`, but when game over is triggered from inside `loop()` (gravity lock), `loop` schedules a new frame right afterwards, so the loop keeps running behind the overlay.
- Unpausing (`togglePause`) does not re-add the `hidden` class to `#overlay`.
