# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Tetris clásico en JavaScript vanilla con HTML5 Canvas. **Sin dependencias, sin `package.json`, sin bundler, sin transpilador y sin tests.** Solo tres archivos: `index.html`, `style.css`, `game.js`.

## Ejecutar

No hay build ni lint ni suite de tests. Para probar los cambios hay que abrir el juego en el navegador:

```bash
start index.html              # Windows (abrir directo)
python3 -m http.server 8000   # o servir estáticamente (recomendado) → http://localhost:8000
```

La verificación es manual en el navegador (consola del devtools para errores).

## Arquitectura

Todo el estado y la lógica viven en `game.js` como variables de módulo (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `animId`). No hay clases ni módulos ES: el script se carga con `<script src="game.js">` y se autoejecuta llamando a `init()` al final del archivo.

Piezas clave para entender el conjunto:

- **Tablero**: matriz `ROWS × COLS` donde cada celda es `0` (vacía) o un índice `1–7`. Ese índice es a la vez el tipo de pieza y el índice en `COLORS` y en `PIECES` (ambos arrays empiezan con `null` para que el índice 1 sea la pieza I). Al añadir o reordenar piezas hay que mantener alineados `COLORS`, `PIECES` y los valores dentro de cada matriz de forma.
- **Rotación**: `rotateCW` transpone + invierte; `tryRotate` prueba *wall kicks* en el orden `[0, -1, 1, -2, 2]` y descarta el giro si ninguno encaja.
- **Colisión**: `collide(shape, ox, oy)` es la única comprobación de validez; permite `y` negativa (pieza parcialmente sobre el tablero) y la usan movimiento, rotación, drops y `spawn`.
- **Game loop**: `loop(ts)` con `requestAnimationFrame`, acumulando `dt` en `dropAccum` y bajando una fila cuando supera `dropInterval`. La pausa cancela el frame (`cancelAnimationFrame`) y al reanudar resetea `lastTime` para no acumular el tiempo pausado.
- **Ciclo de fijado**: `lockPiece()` → `merge()` → `clearLines()` → `spawn()`. `spawn()` mueve `next` a `current` y llama a `endGame()` si la nueva pieza ya colisiona.
- **Dificultad**: `clearLines()` recalcula `level = floor(lines / 10) + 1` y `dropInterval = max(100, 1000 - (level - 1) * 90)`.
- **Renderizado**: `draw()` repinta el frame completo (grid → tablero → ghost con `alpha 0.2` → pieza actual). `drawBlock` es el único punto de dibujo de celdas y lo comparten el tablero y el canvas de vista previa (`drawNext`), parametrizado por `size`.
- **Reinicio**: `init()` reinicia todo el estado y está enlazado tanto al arranque como al botón `#restart-btn`; no hay otra ruta de reset.

El acoplamiento con el DOM es por `getElementById` al cargar el script: cambiar un `id` en `index.html` rompe `game.js` silenciosamente al inicio.

### Dimensiones acopladas

`COLS`, `ROWS` y `BLOCK` en `game.js` deben coincidir con `width`/`height` del `<canvas id="board">` en `index.html` (`COLS × BLOCK` por `ROWS × BLOCK`, hoy 300 × 600). `drawNext` asume una rejilla de 4 × 4 celdas de 30 px dentro de `<canvas id="next-canvas">` (120 × 120).

## Convenciones

- `'use strict'` al inicio de `game.js`; ES6+ sin transpilar.
- El texto visible al usuario (overlays, controles) está en español; los nombres de código y las etiquetas del HUD (`SCORE`, `LINES`, `LEVEL`) en inglés.
- Entrada de teclado mediante `e.code` en un único listener `keydown`; `P` se procesa antes del guard de pausa/game over.
