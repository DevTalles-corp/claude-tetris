# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Tetris en JavaScript vanilla + HTML5 Canvas + CSS. Sin dependencias, sin `package.json`, sin build, sin tests ni linter configurados. El README (en español) documenta mecánicas, controles y flujo del juego.

## Ejecutar

Abrir `index.html` directamente (`start index.html` en Windows) o servirlo estático:

```bash
python -m http.server 8000   # luego http://localhost:8000
npx serve .
```

## Arquitectura

Tres archivos: `index.html` (DOM, `<canvas id="board">`, `<canvas id="next-canvas">`, panel HUD y overlay), `style.css` (tema oscuro) y `game.js` (toda la lógica).

Puntos de `game.js` que requieren leer varias funciones para entenderse:

- **Estado global mutable**: `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId` se declaran con un único `let` a nivel de módulo y se (re)inicializan en `init()`, que también sirve como reinicio (botón del overlay).
- **Representación de piezas**: `PIECES[type]` son matrices cuadradas cuyas celdas contienen el propio `type` (1–7), que a la vez es el índice en `COLORS`. `merge()` copia esos valores al `board`, así que el tablero guarda el color directamente (`0` = vacío). Mantener alineados `PIECES` y `COLORS` al añadir/cambiar piezas.
- **Ciclo de una pieza**: `spawn()` mueve `next` → `current`, genera una nueva `next` y dispara `endGame()` si colisiona al aparecer. Toda fijación pasa por `lockPiece()` → `merge()` → `clearLines()` → `spawn()` (desde el loop, `softDrop` o `hardDrop`).
- **Colisiones**: `collide(shape, ox, oy)` es la única fuente de verdad; permite `y < 0` (por encima del tablero). Movimiento, rotación con wall kicks (`tryRotate`, offsets `[0,-1,1,-2,2]`) y `ghostY()` dependen de ella.
- **Game loop**: `requestAnimationFrame` con acumulador de tiempo (`dropAccum` vs `dropInterval`). Pausa/game over cancelan el frame con `cancelAnimationFrame(animId)`; al reanudar se resetea `lastTime` para evitar un `dt` enorme.
- **Puntuación/nivel** se recalculan en `clearLines()`: `LINE_SCORES[n] * level`, nivel = `floor(lines/10)+1`, `dropInterval = max(100, 1000 - (level-1)*90)`. Soft drop +1/fila, hard drop +2/fila.
- **Render**: `draw()` redibuja todo cada frame (grid, tablero, ghost con alpha 0.2, pieza actual). `drawNext()` solo se llama desde `spawn()`. El HUD se actualiza vía `updateHUD()` (no en cada frame).

## Acoplamientos a tener en cuenta

- Si cambian `COLS`, `ROWS` o `BLOCK`, ajustar `width`/`height` de `<canvas id="board">` en `index.html` (`COLS×BLOCK` × `ROWS×BLOCK`).
- `game.js` obtiene elementos por id (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`); renombrarlos en el HTML rompe el script.
- Los controles están duplicados: handler `keydown` en `game.js`, lista en el panel de `index.html` y tabla en `README.md`.
