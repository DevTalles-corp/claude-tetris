# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands
No build process or dependencies.
- Run game: Open `index.html` in browser or use static server.
- Local server examples:
  - `python3 -m http.server 8000`
  - `npx serve .`

## Architecture
Vanilla JavaScript, HTML5 Canvas, and CSS.

### Core Structure
- `index.html`: DOM structure, main game canvas (`#board`), and UI overlays.
- `style.css`: Dark retro arcade theme.
- `game.js`: Entire game logic.

### Game Logic (`game.js`)
- **Board Model**: 2D array (`ROWS` x `COLS`) storing color indices (1-7) or 0 for empty cells.
- **Piece Representation**: Square matrices. Rotation handled via transposition and row reversal (`rotateCW`).
- **Game Loop**: `requestAnimationFrame` driven. Accumulates delta time to trigger piece drops based on `dropInterval`.
- **Collision & Movement**: 
  - `collide()`: Checks bounds and occupied cells.
  - `tryRotate()`: Implements basic wall kicks (±1, ±2 column shifts) if initial rotation fails.
- **Mechanics**:
  - **Ghost Piece**: Project current piece to bottom (`ghostY`) and render with low opacity.
  - **Line Clearing**: Scans bottom-up, removes full rows, and shifts board down.
  - **Scoring**: Based on lines cleared and current level. Hard drop adds 2 pts/cell, soft drop adds 1 pt/row.
  - **Difficulty**: Level increases every 10 lines, reducing `dropInterval` (min 100ms).
