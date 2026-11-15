# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Classic Tetris in vanilla JavaScript + HTML5 Canvas + CSS. No dependencies, no package.json, no bundler/transpiler, no linter, no test suite. UI text and README are in Spanish — keep user-facing strings in Spanish.

## Running

Open `index.html` directly (`start index.html` on Windows), or serve the folder statically (recommended):

    python -m http.server 8000     # then http://localhost:8000
    npx serve .

There is nothing to build or test; verify changes by loading the page in a browser and checking the console.

## Architecture

All logic lives in `game.js`, a single classic script (not an ES module) loaded at the end of `index.html`. It grabs DOM elements by id at top level, so element ids in `index.html` (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`) are a hard contract with `game.js`.

- **State** is a set of module-level `let` globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, …). `init()` is the single reset point, also wired to the restart button. Any new state must be initialized there.
- **Cell encoding**: board cells hold `0` (empty) or the piece type `1–7`. The same number is the value stored inside each `PIECES` matrix and the index into `COLORS`. Adding or reordering a piece means keeping `PIECES`, `COLORS` and the `* 7` in `randomPiece()` in sync.
- **Pieces** are square matrices; rotation is `rotateCW` (transpose + reverse), and `tryRotate` applies simple horizontal kicks `[0,-1,1,-2,2]` (no SRS). `collide` treats rows with `y < 0` as free (pieces may extend above the board).
- **Loop**: `loop()` runs on `requestAnimationFrame`, accumulates `dt` into `dropAccum` and moves the piece down once per `dropInterval`. Pause and game over stop the loop with `cancelAnimationFrame`; resuming calls `loop()` directly.
- **Lock sequence**: `lockPiece()` → `merge()` → `clearLines()` (updates lines/score/level/`dropInterval`) → `spawn()`. Game over is detected in `spawn()` when the new piece collides on entry.
- **Rendering**: `draw()` fully redraws the main canvas every frame (grid, board, ghost at alpha 0.2, current piece). The next-piece preview (`drawNext`) and the HUD (`updateHUD`) are *not* per-frame: they update only on spawn, on line clear and soft drop, and after each keydown. New HUD values must be pushed through `updateHUD()`.

## Coupled constants

- `COLS × BLOCK` and `ROWS × BLOCK` must match the `<canvas id="board">` `width`/`height` in `index.html` (300 × 600).
- `#next-canvas` is 120 × 120, i.e. a 4 × 4 grid of 30px cells hardcoded in `drawNext` (`NB = 30`, centering on 4).
- Scoring: `LINE_SCORES[cleared] * level`; soft drop +1 per row, hard drop +2 per row. Level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 − (level − 1) × 90)`.
