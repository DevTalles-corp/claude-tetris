---
name: verify-tetris
description: Manual browser checklist to verify the Tetris game works after changes to game.js, index.html or style.css.
---

Serve the folder (`python3 -m http.server 8000` in `03-tetris/`) and open it in a browser. Check each item and report what you did and did not verify:

1. No console errors on load.
2. Controls: ←/→ move, ↑ or X rotate, ↓ soft drop, Space hard drop, P pause/resume.
3. Wall kicks: rotating a piece against a wall or the floor still works.
4. Line clears: completing 1–4 lines clears them and scores `[100,300,500,800]` × level.
5. Drop points: hard drop adds 2 per cell, soft drop 1 per row.
6. Ghost piece and next-piece preview render correctly.
7. Level goes up every 10 lines and fall speed increases.
8. Game over triggers when the stack reaches the top, and restart works.
9. Pause stops the game and input does not move pieces.

If you couldn't open a browser, say so instead of claiming the checks passed.
