# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no build step, no package.json, no tests, no linter. The README (in Spanish) documents the user-facing features and controls; UI strings in the game are also in Spanish.

## Running

- `open index.html` or serve the directory (e.g. `python3 -m http.server`) and open it in a browser. Verify changes manually in the browser.

## Architecture

Three files: `index.html` (canvas `#board` 300×600, `#next-canvas` 120×120, HUD spans, `#overlay`), `style.css`, and `game.js` (all logic, loaded as a classic script, `'use strict'`).

`game.js` is a single global-state module. Things that span the file and aren't obvious:

- **State** lives in top-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, …), all reset in `init()`. Restart button calls `init()` again.
- **Board encoding**: `board[row][col]` holds `0` or a piece-type index 1–7. That same index selects the entry in both `PIECES` (shape matrices) and `COLORS`, so adding/reordering a piece means editing both arrays in lockstep (and `randomPiece()` hard-codes `7`).
- **Game loop**: `loop(ts)` via `requestAnimationFrame` accumulates `dropAccum` and applies gravity when it exceeds `dropInterval`, then always calls `draw()`. Pause/game-over stop it with `cancelAnimationFrame(animId)`; unpausing restarts it by calling `loop()` directly.
- **Piece lifecycle**: `lockPiece()` → `merge()` → `clearLines()` (updates score/level/`dropInterval`) → `spawn()` (promotes `next`, detects game over via collision at spawn).
- **Collision** (`collide(shape, ox, oy)`) is the single primitive used by movement, rotation (with wall-kick offsets `[0,-1,1,-2,2]` in `tryRotate`), ghost piece, and drop logic. Rows above the board (`ny < 0`) are allowed.
- **Scoring** is applied in several places: line clears in `clearLines()` (`LINE_SCORES × level`), +1 per soft-drop step, +2 per cell on hard drop.
- Keyboard handling is one `keydown` listener using `e.code` (`P` pause, arrows, `KeyX` rotate, `Space` hard drop).
