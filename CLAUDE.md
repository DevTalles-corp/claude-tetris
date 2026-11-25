# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris on HTML5 Canvas. There are no dependencies, no build step, no package.json, no linter and no test suite. The README and the UI text (overlay messages, controls list, `lang="es"`) are in Spanish, so keep new user-facing text in Spanish.

## Running

Serve the folder with any static server and open http://localhost:8000:

    python3 -m http.server 8000

You can also open `index.html` directly in a browser. To check a change, reload the page and play.

## Architecture

All game logic is in `game.js`, a single classic script with `'use strict'`. It is loaded at the end of `<body>` and has no modules. It reads DOM elements by id at load time, so any id rename in `index.html` must also be made in `game.js`. The ids are `board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`, `skin-select`, the records ids prefixed `records-` (`records-list`, `records-stats`, `records-reset`, `records-entry`, `records-name`, `records-save`, `records-overlay-list`) and the pause menu ids prefixed `pause-` (`pause-menu`, `pause-main`, `pause-controls`, `pause-resume`, `pause-restart`, `pause-controls-btn`, `pause-back`, `pause-level`).

- **State** is held in module-level `let` globals: `board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, clearing, combo`. `init()` resets all of them and is also the restart button handler.
- **Extra scripts** `records.js` (global `Records`: `noteCombo`, `onGameOver`, `startGame`, `isEditing`; top 5 in `localStorage`) and `skins.js` (globals `SKINS`, `SKIN_ORDER`) load before `game.js`. `drawBlock` delegates to `SKINS[currentSkin].drawBlock`. `init()` stores `startLines` so records only count lines played, not the ones implied by the start level.
- **Board** is a `ROWS × COLS` matrix. Each cell is `0` or a piece type index from 1 to 7. The same index is used for `PIECES[type]` (shape matrices whose cells hold the type number) and for `COLORS[type]`. Index 0 is `null` in both arrays.
- **Piece** is `{ type, shape, x, y }`. Rotation returns a new matrix from `rotateCW`. `tryRotate` applies kicks of `[0, -1, 1, -2, 2]` on the x axis only. The game uses a uniform random generator, not a 7-bag.
- **`collide(shape, ox, oy)`** is the single validity check used by movement, rotation, gravity, ghost projection and spawn. Cells with `y < 0` are allowed.
- **Lock pipeline**: `lockPiece()` calls `merge()` and `findFullRows()`. With no full rows it calls `spawn()` right away. Otherwise it sets `clearing = { rows, elapsed }` and the rows blink (`BLINK_MS`) for `CLEAR_DURATION` ms; during that time `loop` skips gravity, `draw()` skips ghost and piece, and keydown ignores input. When the time is up, `finishClear()` removes the rows, updates score, level and `dropInterval`, then calls `spawn()`. `spawn()` calls `endGame()` if the new piece collides as soon as it appears.
- **Loop**: `loop(ts)` runs on `requestAnimationFrame`. It adds frame time to `dropAccum` and applies gravity once `dropInterval` is reached, then redraws everything with `draw()`. The next-piece preview (`drawNext()`) is only redrawn on spawn. Pause and game over stop the loop with `cancelAnimationFrame(animId)`, and unpausing restarts it.
- **Scoring**: `LINE_SCORES[cleared] * level`, plus 1 point per soft-drop row and 2 points per hard-drop row. The level is `floor(lines / 10) + 1`, and the drop interval is `max(100, 1000 - (level - 1) * 90)` ms.

## Gotchas

- If you change `COLS`, `ROWS` or `BLOCK`, update the `<canvas id="board">` width and height in `index.html` to `COLS*BLOCK × ROWS*BLOCK` (currently 300×600).
- The preview canvas is 120×120 and `drawNext` assumes a 4×4 grid of 30px cells.
- Keyboard handling uses `e.code`, not `e.key`. The controls list is written out three times, in the README, in the `index.html` side panel and in the pause menu (`#pause-controls`), so update all when controls change. `startLevel` (chosen in the pause menu) is used by `init()` for the initial level, lines and drop interval.
