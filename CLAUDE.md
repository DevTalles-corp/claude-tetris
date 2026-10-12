# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no build step, no tests, no linter. The README is in Spanish, as is user-facing UI text (e.g. "PAUSA", "Puntuación").

## Running

Open `index.html` directly in a browser, or serve the folder (e.g. `python -m http.server`) and open it. Verify changes by playing the game in the browser.

## Architecture

Three files: `index.html` (canvas `#board`, `#next-canvas`, HUD elements, `#overlay` for pause/game over), `style.css`, and `game.js` (all logic, loaded as a single script).

`game.js` is a single-file, global-state game:
- State lives in module-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, ...), all reset in `init()`, which is also the restart button handler.
- Board cells hold `0` or a piece-type index 1–7; the same index selects the entry in `COLORS` and `PIECES`, so the three arrays must stay aligned (index 0 is `null`).
- Game loop: `loop(ts)` via `requestAnimationFrame` accumulates time in `dropAccum` and drops/locks the piece when it reaches `dropInterval` (recomputed in `clearLines()` from level: `max(100, 1000 - (level-1)*90)`), then calls `draw()` every frame. Pause/game over stop the loop with `cancelAnimationFrame`; unpausing restarts it.
- Piece lifecycle: `lockPiece()` → `merge()` → `clearLines()` → `spawn()` (promotes `next`, generates a new one, ends the game if the spawn position collides).
- Rotation is `rotateCW` plus horizontal wall kicks `[0,-1,1,-2,2]` in `tryRotate()` (no SRS, no 7-bag: pieces are uniformly random).
- Scoring: line clears use `LINE_SCORES * level`; soft drop gives 1/cell, hard drop 2/cell.
- Input is a single `keydown` handler (arrows, X rotate, Space hard drop, P pause).
