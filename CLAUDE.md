# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no `package.json`, no build, no tests, no linter. The README and UI text are in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python -m http.server 8000`, `npx serve .`) and visit `http://localhost:8000`.

## Architecture

Three files: `index.html` (DOM + two canvases), `style.css`, and `game.js` (all logic, loaded as a classic script with `'use strict'`; no modules).

`game.js` uses module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, ...) shared by all functions. Key flow:

- `init()` resets all state and starts the `requestAnimationFrame` `loop`; it is also the restart-button handler.
- `loop(ts)` accumulates elapsed time into `dropAccum` and gravity-drops or calls `lockPiece()`, then `draw()`.
- `lockPiece()` = `merge()` → `clearLines()` → `spawn()`. `spawn()` calls `endGame()` if the new piece collides immediately.
- Board cells are `0` or a color/piece index 1–7; `PIECES` and `COLORS` are indexed by the same number (index 0 is `null`).
- Pause/game over cancel the animation frame (`cancelAnimationFrame(animId)`); resuming restarts `loop` manually with a fresh `lastTime`.

## Gotchas

- Pausa (P/Escape) muestra `#pause-menu` (no `#overlay`, que es solo game over). `startLevel` (selector 1–10) lo usa `init()`; `clearLines()` calcula `level = startLevel + floor(lines/10)`.

- Canvas size is hardcoded in `index.html` (`#board` 300×600; `#next-canvas`/`#hold-canvas` 120×120 y `#peek-canvas` 120×180, mostrados a 96px de ancho por CSS). If you change `COLS`, `ROWS` or `BLOCK` in `game.js`, update the canvas `width`/`height` to `COLS*BLOCK` × `ROWS*BLOCK`.
- Rotation uses simple horizontal kicks only (`[0,-1,1,-2,2]` in `tryRotate`), not SRS.
- Scoring: `LINE_SCORES[cleared] * level`; soft drop +1/cell, hard drop +2/cell. Fall interval is `max(100, 1000 - (level-1)*90)` ms, recomputed in `clearLines()`.
- The README's "~300 lines" and docs describe `game.js`; keep it in sync if behavior changes (e.g. controls table, scoring).
- Theming: colors are CSS variables in `style.css` (`:root` = dark default, `[data-theme="light"]`). An inline `<head>` script sets `data-theme` from `localStorage` before paint; `game.js` `applyTheme()` caches `--grid` into `gridColor` for `drawGrid()`. Piece `COLORS` are shared by both themes.
- Layout: `index.html` tiene un `<aside class="panel">` izquierdo (Score/Lines/Level, habilidades, controles), el `#board` y otro `<aside>` derecho (Next, Hold, Próximas 5). Los paneles deben quedar más bajos que el tablero (602px) para no generar scroll; `[hidden]` lleva `!important` en `style.css` porque `.panel-section{display:flex}` lo anulaba.
