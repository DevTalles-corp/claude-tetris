# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

No build/install/test tooling — vanilla JS, no `package.json`.

- Run: open `index.html` directly, or serve statically (`npx serve .`, `python3 -m http.server 8000`, `php -S localhost:8000`) and visit `http://localhost:8000`.
- No lint, no test suite, no build step.

## Architecture

Single-page Tetris: `index.html` (DOM/canvas), `style.css` (dark/retro theme), `game.js` (all logic, one file, no modules).

Global mutable state (`board, current, next, score, lines, level, paused, gameOver, ...`) lives at module scope in `game.js` and is mutated directly by game functions — no classes, no state container.

Key flow: `init()` → `createBoard()` + `spawn()` → `requestAnimationFrame(loop)`. `loop()` accumulates elapsed time and drops the current piece one row every `dropInterval` ms, calling `lockPiece()` on collision. `lockPiece()` → `merge()` (bakes piece into `board`) → `clearLines()` → `spawn()` (promotes `next` to `current`, generates new `next`; if the new piece immediately collides, `endGame()` fires).

Pieces are 4×4 or 3×3 matrices of color indices (`PIECES`); rotation is transpose+reverse (`rotateCW`), with `tryRotate()` attempting wall kicks at offsets `[0,-1,1,-2,2]` before giving up. Collision (`collide`) checks board bounds and occupied cells.

Scoring: `LINE_SCORES = [0,100,300,500,800]` × `level`; hard drop = 2 pts/row, soft drop = 1 pt/row. Level increases every 10 lines; `dropInterval = max(100, 1000 - (level-1)*90)`.

Special pieces: every `SPECIAL_EVERY_LINES` cleared lines, `spawn()` makes `next` a 1×1 `BOMB` (clears 3×3 on lock, `detonate`) or `TINT` (turns all blocks of the color below into `WILD`, `applyTint`). `WILD` cells let a row clear if gaps ≤ wilds (`isRowComplete`). Glyphs drawn via `BLOCK_GLYPHS` in `drawBlock`.

Tunable constants live at the top of `game.js`: `COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval`. Changing `COLS`/`ROWS`/`BLOCK` requires updating the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS×BLOCK` by `ROWS×BLOCK`).
