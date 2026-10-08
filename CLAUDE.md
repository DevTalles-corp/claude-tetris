# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Vanilla JavaScript Tetris rendered on HTML5 Canvas. No dependencies, no build step, no package.json, no tests. Three files do everything: `index.html` (DOM + two canvases), `style.css` (dark theme), `game.js` (all game logic, ~300 lines). UI strings are in Spanish.

## Running

Open `index.html` directly, or serve statically (`python3 -m http.server 8000`). There is nothing to build, lint, or test — iterate by editing files and reloading the browser.

## Architecture (game.js)

- **Single-module, global mutable state.** State lives in top-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `dropInterval`, etc.) reset by `init()`. Functions read and mutate these globals directly rather than passing state around — follow that convention when adding features.
- **Board model.** `board` is a `ROWS × COLS` matrix of ints: `0` = empty, `1–7` = a color/piece-type index into the `COLORS` and `PIECES` arrays (index 0 is `null` in both so indices line up).
- **Pieces** are square matrices; rotation is transpose + row-reverse (`rotateCW`). `tryRotate` applies basic wall kicks (tries x-offsets `0, -1, 1, -2, 2`).
- **Game loop** (`loop`) is `requestAnimationFrame`-driven, accumulating `dt` into `dropAccum` and dropping one row when `dropInterval` is exceeded. Pausing/game-over cancels `animId`.
- **Piece lifecycle:** `spawn()` promotes `next` → `current` and generates a new `next`; if the new piece collides immediately it triggers `endGame()`. `lockPiece()` = `merge()` into board → `clearLines()` → `spawn()`.
- **Scoring/leveling** (in `clearLines`): `LINE_SCORES[cleared] * level`; level rises every 10 lines and recomputes `dropInterval = max(100, 1000 - (level-1)*90)`.

## Gotchas

- **Canvas size is hard-coded in HTML.** `#board` is `width="300" height="600"` in `index.html`, matching `COLS*BLOCK` (10×30) and `ROWS*BLOCK` (20×30). Changing `COLS`, `ROWS`, or `BLOCK` in `game.js` requires updating those attributes too, or rendering breaks.
- **DOM element IDs are the contract** between `index.html` and `game.js` (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`). Renaming one requires updating both files.
- The single `#overlay` serves both PAUSE and GAME OVER states, toggled via `.hidden` and by setting `overlay-title`/`overlay-score` text.
