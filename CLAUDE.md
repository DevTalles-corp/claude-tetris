# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris on HTML5 Canvas. No dependencies, no package.json, no build, no tests, no linter. The README and UI text are in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python3 -m http.server 8000`) and visit `http://localhost:8000`.

## Architecture

Three files: `index.html` (markup; loads `game.js` as a classic script at the end of `<body>`), `style.css`, and `game.js` (all logic, ~300 lines, global scope, no modules).

`game.js` structure:
- Constants at top: `COLS`/`ROWS`/`BLOCK` (10×20 board, 30px cells — must match the `#board` canvas size of 300×600 in `index.html`), `COLORS`, `PIECES` (shape matrices indexed by piece type), `LINE_SCORES`.
- DOM/canvas handles are grabbed once at top level by element id; renaming an id in `index.html` requires updating `game.js`.
- All mutable game state lives in module-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`), reset in `init()`. The restart button simply calls `init()`.
- Game loop: `loop(ts)` driven by `requestAnimationFrame`, accumulating elapsed time in `dropAccum` and dropping the piece when it exceeds `dropInterval` (shrinks as `level` rises, every 10 lines).
- Piece flow: `spawn()` → `collide()` checks → move/`tryRotate()` (rotation via `rotateCW` with wall kicks) → `softDrop()`/`hardDrop()` → `lockPiece()` → `merge()` + `clearLines()` → `spawn()`. `ghostY()` computes the landing row for the ghost piece.
- Rendering is redrawn in full each frame (`draw()`, `drawGrid()`, `drawNext()`, `drawBlock()`); `updateHUD()` writes score/lines/level to the DOM.
- Input is a single `keydown` listener at the bottom of `game.js`.

## Commits y versionado

Los commits siguen Conventional Commits (semantic release): `<tipo>(<scope opcional>): <descripción>`.

| Tipo | Efecto en la versión |
|------|----------------------|
| `fix:`, `perf:` | patch (0.1.0 → 0.1.1) |
| `feat:` | minor (0.1.0 → 0.2.0) |
| `tipo!:` o footer `BREAKING CHANGE:` | major (0.1.0 → 1.0.0) |
| `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore` | sin release |

- Con squash merge, el título del PR debe seguir este formato (es el mensaje que llega a `main`).
- `version.txt` contiene la versión actual y lo gestiona `.github/workflows/release.yml` en cada push a `main`: calcula la versión, hace commit `chore(release): vX.Y.Z`, crea el tag y el GitHub Release (notas redactadas por Claude Haiku). No editarlo a mano.
