# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Tetris** game implemented in vanilla JavaScript using HTML5 Canvas and CSS2026-10-12. No external dependencies, no frameworks, no build process: just open and play.

### Key Files

| File | Purpose |
|------|---------|
| `index.html` | DOM structure with canvas elements (game board 300×600px, next piece preview) |
| `style.css` | Styling with dark/retro arcade aesthetic, backdrop blur effects |
| `game.js` | All game logic (~280 lines): board model, pieces, collision detection, wall kicks, game loop |

### Architecture

The game follows a simple ECS-inspired structure without external state management:

**Model**: 
- Board is a 2D array (`ROWS × COLS`) where each cell stores `0` (empty) or a color index (1–7)
- Pieces are 2D matrices representing their shapes
- Game state: `current` piece, `next` piece, score, lines cleared, level

**View**: 
- Single canvas (`#board`) for the main game board
- Secondary canvas (`#next-canvas`) for next piece preview
- HTML elements for HUD (score, lines, level) and overlays

**Controller**: 
- Event-driven via `keydown` listener (arrow keys, space, X to rotate, P to pause)
- Game loop using `requestAnimationFrame` with time-accumulated delta
- All input handlers update state, then call `draw()` to render

### Core Functions in game.js

| Function | Responsibility |
|----------|----------------|
| `createBoard()` | Creates empty 2D array |
| `randomPiece()` | Generates random piece type (1–7) with centered spawn position |
| `collide(ox, oy)` | Checks bounds and existing blocks; used for movement/rotation validation |
| `rotateCW(shape)` | Transpose + reverse rows for clockwise rotation |
| `tryRotate()` | Attempts rotation with wall kicks (kicks: `[-2, -1, 0, 1, 2]`) |
| `merge()` | Copies current piece into board array |
| `clearLines()` | Removes full rows from bottom, adds empty row at top; updates score/level |
| `ghostY()` | Computes where piece would land (for ghost piece visualization) |
| `hardDrop()` | Drops to ghost position, adds 2× distance points, locks piece |
| `softDrop()` | Moves down 1 if no collision, adds 1 point; else locks |
| `lockPiece()` | Merges → clears lines → spawns next |
| `spawn()` | Sets current = next, generates new next, checks immediate collision for game over |
| `drawGrid()`, `drawBlock()`, `draw()` | Rendering functions using Canvas 2D API |
| `drawNext()` | Renders preview piece on secondary canvas |
| `endGame()`, `togglePause()` | Game state transitions |
| `loop(ts)` | Main game loop: accumulates time, drops pieces at `dropInterval`, calls `draw()` |
| `updateHUD()` | Syncs score/lines/level to DOM |
| `init()` | Resets all state, starts game loop |

### Gameplay Flow

```
init()
  ├─ board = empty matrix
  ├─ next = random piece
  ├─ spawn() → current = next, new next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ dt = timestamp - lastTime
     ├─ if dt ≥ dropInterval → drop piece or lock it
     ├─ drawGrid() + board + ghost + current
     └─ requestAnimationFrame(loop)

   keydown → validate move/rotate/drop → update state → updateHUD()
```

### Configuration Constants (in game.js)

| Constant | Default | Notes |
|----------|---------|-------|
| `COLS` | 10 | Columns |
| `ROWS` | 20 | Rows |
| `BLOCK` | 30 | Pixel size per cell |
| `dropInterval` | 1000ms | Initial drop speed; decreases with level |
| `LINE_SCORES` | `[0, 100, 300, 500, 800]` | Classic multi-line clear bonuses × level |

**Customization**: Modify these constants in `game.js`; if changing `COLS`, `ROWS`, or `BLOCK`, also update canvas `width` and `height` attributes in `index.html`.

### Running the Game

No build steps required. Choose:

```bash
# Option 1: Open directly (macOS)
open index.html

# Option 2: Local server (recommended)
python3 -m http.server 8000
# or
npx serve .
# Then open http://localhost:8000
```

### Common Development Tasks

**Run a single test**: Not applicable (no testing framework; game is self-contained)

**Add a new piece behavior**: 
1. Extend `PIECES` array with new shape matrix and color index
2. Update corresponding piece definition in `PIECES` type mapping
3. Test manually in browser

**Modify scoring**: Edit `LINE_SCORES` array and/or add hooks in `clearLines()`

**Add keyboard bindings**: Extend the `keydown` listener's switch statement

**Change visual theme**: Modify `COLORS` palette or edit `style.css`

### Performance Notes

- Single `requestAnimationFrame` loop drives all rendering
- All drawing done via Canvas 2D API methods (`fillRect`, `stroke`)
- Time accumulation prevents missed frames on slow systems
- Maximum drop interval clamped to 100ms at high levels

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
