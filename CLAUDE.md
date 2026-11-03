# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Vanilla JS with no dependencies: there is no `package.json`, build step, linter, or test suite. To run the game, open `index.html` directly or serve the directory statically:

```bash
python -m http.server 8000   # then open http://localhost:8000
```

Changes can only be verified by running the game in a browser.

## Architecture

`index.html` loads `game.js` as a classic script (not a module). All game logic lives in that one file, as top-level functions sharing mutable module-level state (`board`, `current`, `next`, `score`, `paused`, `gameOver`, ...). The game starts immediately at load: the last line of `game.js` calls `init()`, which resets that state and also serves as the restart handler.

- **Cell values:** the piece type (1–7) is both the index into `PIECES` and `COLORS` and the value stored in shape matrices and `board` cells; `0` means empty. Adding or reordering pieces means keeping both arrays aligned, and the matrix values must match the piece's index. `randomPiece()` also hardcodes the count of 7.
- **Locking sequence:** gravity (`loop`), `softDrop`, and `hardDrop` all end in `lockPiece()`, which runs `merge()` → `clearLines()` → `spawn()`. Game over is detected only in `spawn()`, when a new piece collides immediately.
- **Rendering:** `draw()` repaints the whole board canvas every frame from state, so input handlers only mutate state. The next-piece preview is different: `drawNext()` runs only from `spawn()`. Canvas colors are hardcoded in `game.js` (`COLORS`, the highlight in `drawBlock()`, the grid in `drawGrid()`, ghost alpha `0.2`), not read from `style.css`.
- **HUD:** DOM counters update only through `updateHUD()`. `hardDrop()` doesn't call it and relies on the `keydown` handler calling it after every action.
- **Animation loop:** `loop()` always schedules its next frame at the end, so a `cancelAnimationFrame` issued from inside a `loop()` call does not stop it. In particular, `endGame()` reached via `loop()` → `lockPiece()` → `spawn()` does not stop the loop, so `endGame()` can fire again on later frames.
- **Pause:** `togglePause()` (P) shows the shared `#overlay` with `PAUSA`; resuming restarts `loop()` but does not re-add `hidden` to the overlay.

## Conventions

- Canvas sizes in `index.html` must match the constants in `game.js`: `#board` is `COLS × BLOCK` by `ROWS × BLOCK` (300×600), and `#next-canvas` is 4 cells of `NB` (120×120), where `NB` is local to `drawNext()`.
- `game.js` looks up DOM elements by id at load time, so renaming an id in `index.html` requires the same change there.
- User-facing text and the README are in Spanish (for example `PAUSA`, `Reiniciar`, `Puntuación`), though the HUD labels are English (`SCORE`, `LINES`, `LEVEL`). The README also documents controls, scoring, and tunable constants, so update it when those change.
