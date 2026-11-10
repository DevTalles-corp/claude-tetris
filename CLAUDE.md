# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no `package.json`, no build, no linter, no tests. The README and UI text are in Spanish; keep user-facing strings in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python -m http.server 8000`) and visit `http://localhost:8000`. There is nothing to build or test; verify changes by playing in the browser.

## Architecture

Three files: `index.html` (DOM + two canvases + overlay), `style.css`, and `game.js` (all logic, loaded as a classic script with `'use strict'`; all state lives in module-level `let` globals declared on one line near the top).

Things that span the file and aren't obvious from a skim:

- **Piece/board encoding**: board cells and piece matrices store a color index 1–8 (0 = empty) that indexes both `COLORS` and `PIECES` — adding a piece means adding to both arrays in the same position and updating `randomPiece` (the 7 standard pieces are uniform via `* 7`; the ring piece, index 8, is rarer and chosen via `RING_CHANCE`).
- **Piece lifecycle**: `lockPiece()` = `merge()` → `clearLines()` → `spawn()`. Game over is detected inside `spawn()` (new piece collides immediately) and calls `endGame()`. Hard drop, soft drop and the gravity tick in `loop()` all funnel into `lockPiece()`.
- **Game loop**: `requestAnimationFrame` `loop(ts)` accumulates `dropAccum` against `dropInterval`. Pause/game over/restart cancel and restart the rAF via the shared `animId`; `init()` is both the first start and the restart handler, but it is NOT called on load: the page shows `#start-screen` (via `showStartScreen()`) and `init()` runs from the "Jugar" button or Enter (so `current` is undefined until then). Resuming from pause must reset `lastTime` to avoid a huge `dt`.
- **Scoring/levels** are computed in `clearLines()` (`LINE_SCORES[cleared] * level`, level = lines/10 + 1, `dropInterval = max(100, 1000 - (level-1)*90)`); soft/hard drop points are added in `softDrop()`/`hardDrop()`. Note `init()` hardcodes the initial `dropInterval = 1000`.
- **Records**: top 5 `{name, score, lines, combo, date}` in `localStorage['tetrisRecords']` and `{maxCombo, maxLines}` in `tetrisBests`. `clearLines()` tracks `combo`/`bestCombo` (consecutive locks that clear lines). `endGame()` updates bests and shows a name input (`#record-entry`) if the score qualifies; `submitRecord()` saves; `renderRecords(container, highlightIdx)` builds the table with `textContent` only (names are user input). The keydown handler ignores events from `INPUT`/`TEXTAREA` targets. All storage access is try/catch and tolerates corrupt JSON.
- **Rotation** (`tryRotate`) is clockwise only, with simple horizontal kicks `[0,-1,1,-2,2]` — not SRS.
- **Canvas size is hardcoded in HTML**: `#board` is `300×600` (= `COLS*BLOCK` × `ROWS*BLOCK`) and `#next-canvas` is `120×120` (4 cells × `NB=30` in `drawNext`). Changing `COLS`/`ROWS`/`BLOCK` requires editing these attributes in `index.html`.
- **HUD controls list** in `index.html` and the key handler in `game.js` are maintained separately (the handler also accepts `KeyX` for rotate, which the HUD doesn't list).
