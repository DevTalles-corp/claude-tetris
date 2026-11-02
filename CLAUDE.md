# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Vanilla JS Tetris (HTML5 Canvas). No package.json, build, lint, or tests. README.md is in Spanish; UI strings are Spanish too.

## Running

Open `index.html` directly, or serve statically: `python -m http.server 8000`.

## Architecture

- `index.html`: two canvases (`#board` 300x600, `#next-canvas` 120x120), HUD spans, `#overlay` for PAUSA / GAME OVER.
- `game.js`: all logic, single global script (`'use strict'`), module-level mutable state (`board`, `current`, `next`, `score`, ...) reset by `init()`.
- `style.css`: dark theme only.

Key points spanning the code:
- Board is `ROWS x COLS` matrix; cell is `0` or color/piece index 1–7. `PIECES` and `COLORS` share the same index; piece matrices embed their own index as cell value.
- Loop is `requestAnimationFrame` (`loop`) accumulating `dropAccum` against `dropInterval`. Pause/game over cancel `animId`; unpause restarts `loop` manually. `init()` is also the restart handler.
- Piece lifecycle: `lockPiece` -> `merge` -> `clearLines` (updates lines/score/level/`dropInterval`) -> `spawn` (calls `endGame` if spawn collides).
- Rotation (`tryRotate`) uses simple horizontal kicks `[0,-1,1,-2,2]`, not SRS. Rotation is `rotateCW` on the matrix; O piece rotation is harmless.
- Changing `COLS`/`ROWS`/`BLOCK` requires updating canvas `width`/`height` in `index.html` manually.
