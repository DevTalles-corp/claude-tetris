# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas + CSS). No dependencies, no `package.json`, no build, no tests, no linter. README and UI text are in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python -m http.server 8000`, then http://localhost:8000). Verify changes by playing in the browser.

## CI

Three workflows in `.github/workflows/`, all using `anthropics/claude-code-action@v1` with the `CLAUDE_CODE_OAUTH_TOKEN` secret: `claude.yml` (responds to `@claude` mentions), `claude-code-review.yml` (PR review), and `claude-issue-triage.yml` (on issue opened/edited: applies existing labels and posts a diagnosis comment marked `<!-- claude-triage -->`; skips issues mentioning `@claude`).

## Architecture

Three files: `index.html` (DOM + two canvases), `style.css`, and `game.js` (all logic, ~300 lines, global scope, `'use strict'`).

- `game.js` uses module-level mutable globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, …) initialized in `init()`; `init()` is also the restart handler.
- Board is a `ROWS × COLS` matrix of `0` or color index 1–7; `PIECES` and `COLORS` are indexed by the same type id (index 0 is `null`).
- Flow: `loop` (rAF) → gravity step or `lockPiece()` (`merge` → `clearLines` → `spawn`) → `draw()`. `spawn()` calls `endGame()` if the new piece collides immediately.
- Input is a single `keydown` handler. `softDrop`/`hardDrop` add score directly; `clearLines` updates level and `dropInterval`.
- Rotation is `rotateCW` plus horizontal-only kicks `[0,-1,1,-2,2]` in `tryRotate` (not SRS).
- `index.html` canvas size (`300×600`) must match `COLS*BLOCK` × `ROWS*BLOCK` in `game.js`; the next-piece canvas is `120×120` (4×4 cells at 30px).
