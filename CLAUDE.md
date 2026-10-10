# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running

Dependency-free static site (`index.html`, `style.css`, `game.js`). No build, lint, or test tooling. Open `index.html` directly or run `npx serve .` from this folder.

## Architecture

All logic is in `game.js` as top-level functions over shared module-level `let` state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`). There are no classes or modules. `README.md` (Spanish) documents scoring/speed formulas and the game-loop flow; keep docs in Spanish.

- `board` is a `ROWS × COLS` matrix of color indices (0 = empty). `PIECES` and `COLORS` are indexed by the same 1–7 type index, and each piece's cells hold that index, so the shape matrix doubles as the color source in `drawBlock`.
- Pieces are `{ type, shape, x, y }`; `shape` is a square matrix copied from `PIECES`. Rotation is `rotateCW` (transpose + reverse), applied by `tryRotate` with kicks `[0, -1, 1, -2, 2]`. There is only clockwise rotation, no SRS kick tables.
- Piece lifecycle: `loop`/`softDrop`/`hardDrop` → `lockPiece` → `merge` → `clearLines` → `spawn`. `spawn` calls `endGame` when the new piece collides immediately.
- `init()` is also the restart handler (`restartBtn`), so any new state must be reset there.
- Gravity uses the `dropAccum` / `dropInterval` accumulator in `loop`, and `clearLines` recomputes `dropInterval` from `level`. The initial `1000` is hardcoded in `init` and again in the speed formula.

## Gotchas

- `COLS`/`ROWS`/`BLOCK` must match the `<canvas id="board">` `width`/`height` in `index.html`. The next-piece canvas uses its own hardcoded 4×4 grid and `NB = 30` in `drawNext`.
- `endGame` calls `cancelAnimationFrame(animId)`, but when it is triggered from inside `loop` (via `lockPiece` → `spawn`), `loop` still reschedules itself afterwards. That's why `loop` starts with `if (gameOver) return;`: the next frame exits without applying gravity or rescheduling. Keep this guard when touching the end-of-game or pause flow.
- The `keydown` handler calls `updateHUD()` after every key, which is why `hardDrop` does not call it itself.
