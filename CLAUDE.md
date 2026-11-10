# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No build, no dependencies, no `package.json`, no tests, no linter. The README and UI text are in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python -m http.server 8000`, `npx serve .`) and visit `http://localhost:8000`.

## Architecture

Three files: `index.html` (DOM + two canvases), `style.css`, and `game.js` (all logic, one script, no modules). `game.js` runs at load and calls `init()` itself; it relies on element IDs in `index.html` (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`), so renaming an ID requires updating both.

Key points in `game.js`:
- State lives in module-level `let` globals (`board`, `current`, `next`, `score`, ...) reset by `init()`, which is also the restart handler.
- Board is a `ROWS×COLS` matrix of 0 or a color/piece index 1–7; `COLORS` and `PIECES` are indexed by that same number (index 0 is `null`).
- Piece lifecycle: `spawn()` (moves `next` → `current`; calls `endGame()` if it collides immediately) → move/rotate → `lockPiece()` = `merge()` + `clearLines()` + `spawn()`. Both gravity (`loop`) and `softDrop`/`hardDrop` end in `lockPiece()`.
- `loop` is a `requestAnimationFrame` loop accumulating `dropAccum` against `dropInterval`; pause/game over stop it with `cancelAnimationFrame(animId)`, and `togglePause` restarts it manually. `clearLines` recomputes level and `dropInterval` (`max(100, 1000 - (level-1)*90)`).
- Rotation is `rotateCW` (transpose + reverse) with horizontal-only kicks `[0,-1,1,-2,2]` in `tryRotate`.

## Gotchas

- Changing `COLS`, `ROWS`, or `BLOCK` requires updating the `width`/`height` attributes of `<canvas id="board">` in `index.html` (`COLS*BLOCK` × `ROWS*BLOCK`). The next-piece canvas is a fixed 120×120 (4×4 cells of 30px, hardcoded `NB` in `drawNext`).
- The README's project tree says `03-tetris/` and "~300 líneas"; it is descriptive only.
