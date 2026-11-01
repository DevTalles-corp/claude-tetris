# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris using HTML5 Canvas. No dependencies, no build step, no package.json, no tests, no linter. UI text and README are in Spanish; keep new user-facing strings in Spanish.

## Running

Open `index.html` directly (`open index.html`), or serve statically (`python3 -m http.server 8000`) and visit `http://localhost:8000`.

## Architecture

Three files: `index.html` (DOM + two canvases: `#board` 300x600 and `#next-canvas` 120x120, plus the `#overlay` used for both pause and game over), `style.css`, and `game.js` (all logic, loaded as a classic script with `'use strict'`).

`game.js` is a single-file, global-state design:

- **State** lives in top-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `lastTime`, `animId`), all reset in `init()`. `init()` is also the restart handler.
- **Piece/board encoding**: `PIECES[type]` are matrices whose non-zero cells equal the piece type (1–7), which doubles as the index into `COLORS`. The board stores that same integer per cell (0 = empty), so colors are resolved at draw time. Adding a piece means adding entries to both `PIECES` and `COLORS` and updating the `Math.random() * 7` in `randomPiece()`.
- **Game loop**: `loop(ts)` runs on `requestAnimationFrame`, accumulates `dropAccum` and applies gravity when it exceeds `dropInterval`, then calls `draw()`. Pause and game over stop the loop with `cancelAnimationFrame(animId)`; resuming restarts it with a fresh `lastTime` to avoid a huge `dt`. Game over can also fire from inside `loop()` (gravity lock), where cancelling has no effect on the running frame, so `loop()` must return without rescheduling when `gameOver` is set.
- **Piece lifecycle**: `lockPiece()` → `merge()` → `clearLines()` → `spawn()`. `spawn()` promotes `next`, generates a new one, and calls `endGame()` if the spawn position collides. `clearLines()` also owns scoring/level/speed (`LINE_SCORES[cleared] * level`; level = lines/10 + 1; `dropInterval = max(100, 1000 - (level-1)*90)`).
- **Collision** is the single `collide(shape, ox, oy)` function, used for movement, rotation (`tryRotate` tries horizontal kicks `[0,-1,1,-2,2]`), ghost piece (`ghostY`), and spawn checks. Cells above the board (`ny < 0`) are allowed.
- **Input**: one `keydown` listener at the bottom handles all controls (arrows, `KeyX` rotate, `Space` hard drop, `KeyP` pause) and calls `updateHUD()` after each key.
- **Theme**: dark by default (`data-theme="dark"` on `<html>`). `style.css` defines all colors as CSS variables in `:root` with a `[data-theme="light"]` override. Canvas-only colors (grid, block shine, ghost alpha) live in the `THEMES` object in `game.js`; `setTheme()` swaps both and redraws manually since the loop is stopped while paused/game over. The `#theme-toggle` button has `tabindex="-1"` and blurs on click so it doesn't steal keyboard controls. The theme is not persisted.
- Drop bonuses: soft drop +1 per cell, hard drop +2 per cell.
