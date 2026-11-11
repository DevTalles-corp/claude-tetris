# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running

No build, install, tests, or linter. Open `index.html` directly or serve the folder statically (`python3 -m http.server 8000`). Verify changes by playing in the browser.

## Constraints

- Keep it vanilla: no `package.json`, npm tooling, bundler, frameworks, or external dependencies.
- `game.js` is a classic `<script>` (not an ES module) so the game works over `file://`. Don't convert to `import`/`export` or split into modules.

## Language

- Player-facing strings (overlay text, HUD hints in `index.html`) and `README.md` are in **Spanish**.
- Code identifiers and new code comments are in **English**.

## Keep in sync

- `#board` canvas `width`/`height` in `index.html` must equal `COLS × BLOCK` by `ROWS × BLOCK` in `game.js`. `#next-canvas` (120×120) assumes a 4×4 grid of 30px cells (`NB` in `drawNext`).
- Controls are defined in three places: the `keydown` handler in `game.js`, the `.controls` list in `index.html`, and the Controles table in `README.md`. Update all three together.
- `README.md` documents function names, scoring/speed formulas, and the tunable constants table. Update it when you change those.
