# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A dependency-free Tetris clone in vanilla JavaScript + HTML5 Canvas. No `package.json`, bundler, transpiler, linter, or test suite: the three source files (`index.html`, `style.css`, `game.js`) are served as-is.

## Running

Open `index.html` directly in a browser, or serve the directory statically (recommended):

```bash
python -m http.server 8000   # then open http://localhost:8000
npx serve .
```

There are no build, lint, or test commands. Verify changes by playing the game in a browser.

## Architecture

All game logic lives in `game.js`, a single classic (non-module) script loaded at the end of `<body>`. It grabs DOM elements by id at load time, so element ids in `index.html` (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`) are a contract with `game.js`.

- **State** is a set of module-level `let` globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `animId`, …), all (re)initialized in `init()`. `init()` is also the restart handler.
- **Board** is a `ROWS × COLS` matrix; each cell is `0` (empty) or a piece type index `1–18`. Piece shapes in `PIECES` store that same index as their non-zero value, and `COLORS[index]` gives the color, so `PIECES` and `COLORS` must stay aligned. Indices 1–7 are the standard pieces (`STANDARD_TYPES`), 8–10 the pentominoes +/U/Y (`PENTOMINO_TYPES`, chosen with probability `PENTOMINO_CHANCE` in `randomPiece()`), 11 the `SINGLE` 1×1, 12 the `HOLLOW` 3×3 ring, 13–17 the 1×1 power-ups (`POWERUP_TYPES`: `BOMB`, `BOLT`, `DYE`, `GRAVITY`, `FREEZE`, icons in `POWERUP_ICONS`), and 18 `WILD`, a cell-only value with `PIECES[18] = null` that never spawns. All shapes must fit in 4×4 for the preview.
- **Pieces** are `{ type, shape, x, y }`; rotation is a pure matrix transform (`rotateCW`) with simple horizontal wall kicks in `tryRotate` (offsets 0, -1, 1, -2, 2; no SRS tables).
- **`collide(shape, ox, oy)`** is the single collision check used for movement, rotation, gravity, ghost projection, and spawn/game-over detection. Cells with `y < 0` are allowed (above the board).
- **Game loop**: `loop()` runs on `requestAnimationFrame`, accumulating `dt` into `dropAccum` and applying gravity when it exceeds `dropInterval`. Pause and game over stop the loop via `cancelAnimationFrame(animId)`; resuming restarts it by calling `loop()` directly.
- **Piece lifecycle**: `lockPiece()` → `merge()` → `clearLines()` (updates lines/score/level/speed) → `spawn()` (promotes `next` to `current`; collision on spawn triggers `endGame()`).
- **Forced pieces**: `pieceQueue` (reset in `init()`) holds pieces that `spawn()` takes as `next` before falling back to `randomPiece()`. `clearLines()` pushes a `SINGLE` after a Tetris and a `HOLLOW` on level up. `clearLines()` also queues a random power-up every `POWERUP_EVERY_LINES` lines. Never assign `next` directly from `clearLines()`: `spawn()` runs right after and would promote it, skipping the piece already shown in the preview.
- **Power-ups**: `lockPiece()` calls `applyPowerUp(type, x, y)` instead of `merge()`, so a power-up never stays on the board. Rows/cells removed by an effect add `POWERUP_BLOCK_SCORE` each but don't count as `lines`. `compactColumns(shouldRemove)` drops cells down per column (used by Gravedad with `v === 0` and by wildcards with `v === WILD`). After any real line clear, `clearLines()` removes all `WILD` cells and recurses, since compacting can complete new rows. `freezeLeft` (ms, reset in `init()`) makes `loop()` skip adding `dt` to `dropAccum`.
- **Rendering** is full redraw each frame in `draw()` (grid, locked cells, ghost at alpha 0.2, current piece). The next-piece preview (`drawNext`) is only redrawn on spawn. `updateHUD()` must be called after score/lines/level change.

## Conventions and gotchas

- Board dimensions are duplicated: changing `COLS`, `ROWS`, or `BLOCK` in `game.js` requires updating the `<canvas id="board">` `width`/`height` in `index.html` (`COLS × BLOCK` by `ROWS × BLOCK`). The preview canvas (120×120) assumes a 4×4 grid of 30px cells.
- User-facing text (HTML, overlay messages, README) is in Spanish; keep it that way.
- Controls are bound in a single `keydown` listener using `e.code` (`ArrowLeft/Right/Down/Up`, `KeyX`, `Space`, `KeyP`). The control list in `index.html` and the README controls table should be kept in sync with it.
