# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Classic Tetris in vanilla JavaScript + HTML5 Canvas + CSS. No dependencies, no `package.json`, no build step, no test suite, no linter. UI text and README are in Spanish — keep user-facing strings in Spanish.

## Running

```bash
open index.html              # open directly (macOS)
python3 -m http.server 8000  # or serve statically, then visit http://localhost:8000
```

## Architecture

Three files: `index.html` (DOM + canvases + overlay), `style.css` (dark retro theme), `game.js` (all logic, loaded as a classic `<script>`, `'use strict'`, no modules).

Key points in `game.js` that span multiple pieces:

- **State is module-level `let` globals** (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`). `init()` resets all of them and is also the restart handler.
- **Board model**: `ROWS × COLS` matrix; `0` = empty, `1–7` = piece type. That same integer is the index into both `COLORS` and `PIECES` (index `0` is `null` in both), and piece shape matrices store their type number in filled cells — so merging a piece into the board just copies cell values. Adding a piece type means updating `COLORS`, `PIECES`, and the `* 7` in `randomPiece()`.
- **Piece lifecycle**: `spawn()` promotes `next` → `current` and generates a new `next`; if the spawned piece already collides, `endGame()` fires. Locking always goes `lockPiece()` → `merge()` → `clearLines()` → `spawn()`.
- **Collision** (`collide(shape, x, y)`) is the single check used by movement, rotation (with kicks `[0,-1,1,-2,2]` in `tryRotate`), gravity, ghost projection (`ghostY`), and game-over detection. Cells with `y < 0` are allowed (above the board).
- **Game loop**: `requestAnimationFrame`-driven `loop(ts)` accumulates `dropAccum` and applies gravity when it exceeds `dropInterval`; it redraws the whole board every frame. Pause/game-over stop the loop via `cancelAnimationFrame(animId)`; unpausing resets `lastTime` and restarts `loop`.
- **Scoring/levels** live in `clearLines()`, `softDrop()`, `hardDrop()`: `LINE_SCORES[n] * level`, +1 per soft-drop row, +2 per hard-drop cell; level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Power-ups**: every `POWERUP_EVERY` lines `clearLines()` sets `pendingPowerup`, and `spawn()` then makes `next` via `makePowerPiece()` — a normal piece with `power: { kind, r, c }` marking one cell of its `shape` (`tryRotate()` rotates that coordinate too). `lockPiece()` runs `applyPowerup()` between `merge()` and `clearLines()`. Timed effects (`freezeLeft`, `tintLeft`) are decremented by `dt` in `loop()`, so they pause with the game; `init()` resets them plus `nextPowerupAt`/`pendingPowerup`. `COLORS[8]` is `WILDCARD` (Tinte), a color-only index with no entry in `PIECES`.
- **Overlay** (`#overlay`) is shared between PAUSA and GAME OVER states; its title/score text is set by `togglePause()` / `endGame()` and hidden by `init()`.

## Coupled constants

If you change `COLS`, `ROWS`, or `BLOCK` in `game.js`, update the `<canvas id="board">` `width`/`height` in `index.html` to `COLS*BLOCK × ROWS*BLOCK`. The next-piece preview assumes a 4×4 grid of 30px cells (`#next-canvas` is 120×120, `NB = 30` in `drawNext()`).
