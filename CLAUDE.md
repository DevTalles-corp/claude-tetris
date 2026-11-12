# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla-JS Tetris: three files (`index.html`, `style.css`, `game.js`), no dependencies, no `package.json`, no build step, no tests, no linter. UI strings and `README.md` are in Spanish — keep new user-facing text in Spanish.

## Running

Open `index.html` directly (`start index.html` on Windows), or serve statically:

```bash
python3 -m http.server 8000   # or: npx serve .
```

Verification is manual in a browser — there is no test suite to run. The browser console is the only error channel.

## Architecture of `game.js`

All logic lives in one file as module-level functions over a handful of module-level `let` globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`). There are no classes and no encapsulation; `init()` resets every global and is also the restart handler. DOM nodes are looked up once at top level, so the script must stay at the end of `<body>` (or any move to `<head>` needs `defer`).

Key invariants to respect when editing:

- **Board cells double as the color table.** `board[r][c]` is `0` (empty) or `1–7`, indexing both `COLORS` and `PIECES` — those two arrays are 1-indexed with a leading `null`, and piece shapes are filled with their own type number (the T piece's matrix contains `3`s). Adding a piece means appending to *both* arrays and bumping the `* 7` in `randomPiece()`.
- **Rotation is matrix transpose + row reverse** (`rotateCW`), so shapes must stay square-ish padded matrices (I is 4×4, O is 2×2, the rest 3×3). `tryRotate()` applies wall kicks by trying x-offsets `[0,-1,1,-2,2]` and silently keeps the old shape if all collide. This is not SRS.
- **`collide(shape, ox, oy)` reads the global `board`** but takes a candidate position, so it's used for lookahead everywhere: movement, rotation kicks, `ghostY()`, and the gravity step. New movement code should go through it rather than bounds-checking by hand.
- **`clearLines()` mutates `board` via `splice`/`unshift`** and compensates with `r++` after a removal, so the loop re-tests the shifted-down row. Score uses `LINE_SCORES[cleared] * level`, level is recomputed as `floor(lines/10)+1`, and `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Geometry is duplicated between files.** `COLS`/`ROWS`/`BLOCK` in `game.js` must match the hardcoded `width`/`height` on `<canvas id="board">` in `index.html` (`COLS*BLOCK` × `ROWS*BLOCK`); `drawNext()` hardcodes a 4×4 grid at 30px to match `<canvas id="next-canvas">` at 120×120.
- **Pause/resume restarts the rAF loop** rather than gating inside it: `togglePause()` cancels `animId` and, on resume, resets `lastTime` and calls `loop()` again. Anything that stops or restarts the loop must reset `lastTime`, or the first frame's `dt` spikes.
- **`drawBlock` is shared by both canvases** and takes the context as its first argument; it resets `globalAlpha` to 1 on exit, so callers never need to.
- **The keydown handler calls `updateHUD()` unconditionally at the end**, which is why most individual actions don't refresh the HUD themselves.
