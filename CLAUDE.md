# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris (HTML5 Canvas + CSS). No dependencies, no build step, no package.json, no tests, no linter. The README is in Spanish, as is the UI text (overlay, controls panel).

## Running

Open `index.html` directly in a browser, or serve the folder (e.g. `python3 -m http.server`) and visit it. Verification is manual by playing the game.

## Architecture

Three files, all loaded by `index.html` (`game.js` via a plain `<script>`, no modules):

- `index.html` — fixed DOM the script looks up by id: `board` (300x600 canvas = `COLS*BLOCK` x `ROWS*BLOCK`), `next-canvas` (120x120), `score`/`lines`/`level`, and the `overlay` (`overlay-title`, `overlay-score`, `restart-btn`) used for both PAUSA and GAME OVER.
- `style.css` — layout and theming only.
- `game.js` — the whole game as module-level functions over shared top-level `let` state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `animId`). `init()` resets all of it, so any new state must be reset there.

Key details that span the file:

- Pieces are matrices whose cell values are 1–7, which double as indexes into `COLORS`. `0` is empty. Keep `PIECES` and `COLORS` aligned (index 0 is `null`).
- Game loop: `loop(ts)` runs on `requestAnimationFrame`, accumulates `dropAccum` and applies gravity once it passes `dropInterval`. It redraws every frame. Pausing/ending cancels `animId`; resuming resets `lastTime` before calling `loop` to avoid a time jump.
- Piece lifecycle: `lockPiece()` = `merge()` → `clearLines()` → `spawn()`. `spawn()` promotes `next`, generates a new one, and calls `endGame()` if the new piece collides immediately. `hardDrop`, `softDrop` and gravity in `loop` all end in `lockPiece()` when blocked.
- `collide(shape, ox, oy)` is the single collision check (walls, floor, board); rows above the board (`ny < 0`) are allowed. Rotation (`tryRotate`) uses `rotateCW` plus simple horizontal wall kicks `[0,-1,1,-2,2]`.
- Scoring/levels live in `clearLines()`: `LINE_SCORES[n] * level`, level = `floor(lines/10)+1`, `dropInterval = max(100, 1000 - (level-1)*90)`. Soft drop gives 1 point per cell, hard drop 2 per cell.
- Input is a single `keydown` listener (arrows, `X` rotate, `Space` hard drop, `P` pause). Pause is handled before the `paused || gameOver` guard.
