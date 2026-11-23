# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Tetris en JavaScript vanilla + HTML5 Canvas. Sin dependencias, sin `package.json`, sin build, sin tests ni linter. La documentación y los textos de UI están en español.

## Ejecutar

Abrir `index.html` directamente en el navegador, o servirlo con cualquier servidor estático:

```bash
python -m http.server 8000   # luego http://localhost:8000
```

No hay suite de tests: los cambios se verifican jugando en el navegador.

## Arquitectura

Tres archivos: `index.html` (DOM: canvas del tablero, panel HUD, overlay), `style.css` (tema oscuro) y `game.js` (toda la lógica). `game.js` se carga como script clásico al final del `<body>` y obtiene los elementos por `id` al evaluarse, así que renombrar ids en el HTML rompe el JS.

Puntos clave de `game.js` que requieren leer varias partes para entenderse:

- **Estado global mutable**: `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc. son variables de módulo declaradas en una sola línea `let` y reinicializadas en `init()` (que también es el handler del botón Reiniciar).
- **Índice de pieza = valor de celda = índice de color**: cada matriz de `PIECES[type]` contiene el propio número `type` (1–7) en sus celdas ocupadas; `merge()` copia esos valores al `board`, y `drawBlock` los usa para indexar `COLORS`. Añadir una pieza implica añadirla en `PIECES` y `COLORS` con el mismo índice y ajustar el `* 7` de `randomPiece()`.
- **Rotación**: `rotateCW` (transponer + invertir) y `tryRotate` con kicks horizontales `[0, -1, 1, -2, 2]`; no es SRS.
- **Colisión**: `collide(shape, ox, oy)` permite `y < 0` (por encima del tablero) pero no fuera de los lados ni del fondo.
- **Ciclo de pieza**: `lockPiece()` → `merge()` → `clearLines()` (actualiza líneas/puntos/nivel/`dropInterval`) → `spawn()`. El Game Over se detecta en `spawn()` si la nueva pieza colisiona al aparecer.
- **Bucle**: `loop` con `requestAnimationFrame` acumula `dt` en `dropAccum`; la pausa cancela el frame (`animId`) y al reanudar se llama a `loop` directamente tras resetear `lastTime`.
- **Velocidad**: `dropInterval = max(100, 1000 − (level − 1) × 90)`, nivel = `floor(lines / 10) + 1`.

## Acoplamientos a tener en cuenta

- Si cambias `COLS`, `ROWS` o `BLOCK`, actualiza `width`/`height` de `<canvas id="board">` en `index.html` (`COLS×BLOCK` × `ROWS×BLOCK`).
- El canvas de "next" (120×120) asume una rejilla 4×4 de bloques de 30 px (`NB` en `drawNext`).
- Los controles se documentan en tres sitios: el `switch` de `keydown` en `game.js`, la lista del panel en `index.html` y la tabla del `README.md`. Mantenlos sincronizados.
