# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas + CSS). No dependencies, no build step, no tests, no linter. The README and UI text are in Spanish; keep user-facing strings in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python3 -m http.server 8000`) and visit `http://localhost:8000`.

## Architecture

Three files, with `game.js` holding all logic (loaded as a plain script, no modules, `'use strict'`):

- `index.html` defines the DOM that `game.js` looks up by id at load time (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`). Renaming an id requires updating the lookups at the top of `game.js`. The canvas sizes (300×600 board, 120×120 next) must match `COLS*BLOCK` / `ROWS*BLOCK` (10×20 at 30px).
- `game.js` uses module-level mutable globals (`board`, `current`, `next`, `score`, `level`, `dropInterval`, etc.) declared in one `let` and reset by `init()`. There is no state object.

### Game flow

- `init()` resets state and starts the `requestAnimationFrame` `loop`. The restart button calls `init` again.
- `loop(ts)` accumulates `dropAccum` and applies gravity when it reaches `dropInterval`, then calls `draw()` every frame. Pause and game-over stop it with `cancelAnimationFrame(animId)`; resuming from pause resets `lastTime` and calls `loop` manually.
- Piece lifecycle: `lockPiece()` → `merge()` into `board` → `clearLines()` (updates lines/score/level/`dropInterval`) → `spawn()` (promotes `next`, rolls a new one, calls `endGame()` if the spawn position collides).
- Pieces are `{type, shape, x, y}`. Shapes are matrices whose cell values are the color index into `COLORS`; the `PIECES` and `COLORS` arrays are 1-indexed (index 0 is `null`/empty), and `board` cells use the same values.
- `collide(shape, ox, oy)` is the single collision check used for movement, rotation, ghost piece, and spawn. Rotation (`tryRotate`) is clockwise only, with horizontal kicks `[0, -1, 1, -2, 2]`.
- Scoring: `LINE_SCORES[cleared] * level`, plus 1 per soft-drop cell and 2 per hard-drop cell. Level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`.
- The keydown handler calls `updateHUD()` after every handled key, so HUD updates from input need not call it themselves.
