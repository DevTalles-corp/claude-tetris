# Tetris

Implementación del clásico **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Tetris](#tetris)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
    - [Opción 1: abrir el archivo directamente](#opción-1-abrir-el-archivo-directamente)
    - [Opción 2: servidor local (recomendado)](#opción-2-servidor-local-recomendado)
  - [Controles](#controles)
  - [Cómo funciona](#cómo-funciona)
    - [1. `index.html`](#1-indexhtml)
    - [2. `style.css`](#2-stylecss)
    - [3. `game.js`](#3-gamejs)
    - [Flujo del juego](#flujo-del-juego)
  - [Combos y multiplicadores](#combos-y-multiplicadores)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados.
- **Piezas especiales** que aparecen de vez en cuando: pentominós **`+`**, **`U`** e **`Y`** (5 bloques), un **cuadrado hueco 3×3** muy poco frecuente y un **bloque 1×1** como recompensa después de cada Tetris (ver [Piezas especiales](#piezas-especiales)).
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel), con **combo encadenado**, **T-spin** (normal y Mini), **Back-to-Back** y **Perfect Clear** (ver [Combos y multiplicadores](#combos-y-multiplicadores)).
- **Efectos visuales y sonoros** para cada jugada, con un interruptor de sonido y control de volumen.
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Pausa** y **Game Over** con opción de reinicio.

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar. Tienes dos opciones:

### Opción 1: abrir el archivo directamente

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Opción 2: servidor local (recomendado)

Cualquier servidor estático funciona. Algunos ejemplos:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

Después abre `http://localhost:8000` en el navegador.

---

## Controles

| Tecla     | Acción                            |
| --------- | --------------------------------- |
| `←` / `→` | Mover la pieza horizontalmente    |
| `↑` o `X` | Rotar la pieza en sentido horario |
| `↓`       | Soft drop (bajar más rápido)      |
| `Espacio` | Hard drop (caída instantánea)     |
| `P`       | Pausar / reanudar                 |

En el panel, el botón **🔊 / 🔇** activa o desactiva el sonido y el deslizador ajusta el volumen. Las dos opciones se recuerdan entre partidas.

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero.
- Un panel lateral con `SCORE`, `LINES`, `LEVEL`, `PIEZAS` (número de piezas fijadas en el tablero), vista de la siguiente pieza, la lista de controles y los controles de sonido.
- Sobre el tablero, el contador de combo, el indicador de B2B, los avisos flotantes y el destello del Perfect Clear. No mueven el diseño del panel.
- Un overlay para los estados **PAUSA** y **GAME OVER**.

### 2. `style.css`

Aporta el aspecto visual con estética _dark / retro arcade_: fondo oscuro, tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays.

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–12) que identifica la pieza: 1–7 las clásicas y 8–12 las especiales.
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`).
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación** (`scoreMove`): una sola función combina línea, T-spin, B2B, Perfect Clear y combo, y devuelve los puntos y los eventos de la jugada. `lockPiece()` detecta el T-spin (`detectTSpin`), fija la pieza, elimina líneas y aplica el resultado con `settleMove()`. El hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Eventos**: las reglas emiten eventos (`combo`, `tspin`, `b2b`, `perfect-clear`…) y los efectos visuales y el sonido (Web Audio, sin archivos) solo se suscriben con `onGameEvent`. Se pueden cambiar las animaciones sin tocar las reglas.
- **Nivel y velocidad**: el nivel sube cada 10 líneas; la velocidad de caída se calcula como `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja con `globalAlpha = 0.2`.

### Flujo del juego

```
init()
  ├─ createBoard()                  → matriz vacía
  ├─ next = randomPiece()
  ├─ spawn()                        → mueve next a current y genera nueva next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ acumula dt
     ├─ si dt ≥ dropInterval → baja la pieza o llama a lockPiece()
     ├─ draw()  (grid + tablero + ghost + pieza actual)
     └─ requestAnimationFrame(loop)

   keydown → mover / rotar / soft-drop / hard-drop / pausa
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()` y se muestra el overlay de **Game Over**.

### Piezas especiales

| Pieza | Forma | Cuándo aparece |
| --- | --- | --- |
| `+` (cruz) | `.■.` / `■■■` / `.■.` | Pentominó: 8 % en total entre `+`, `U` e `Y` |
| `U` | `■.■` / `■■■` | Pentominó |
| `Y` | `■` / `■■` / `■` / `■` | Pentominó |
| Cuadrado hueco 3×3 | `■■■` / `■.■` / `■■■` | 1 % |
| Bloque 1×1 | `■` | Siempre como siguiente pieza después de un Tetris |

`randomPiece()` delega en `randomType()`: primero entrega el 1×1 si hay recompensa pendiente (`bonusSingle`), luego decide si sale una especial y, si no, una clásica. Después de una pieza especial siempre sale una clásica (`lastSpecial`), para evitar secuencias injustas; la única excepción es la recompensa 1×1. Todas usan la misma lógica que las clásicas para moverse, rotar, chocar, fijarse y completar líneas.

---

## Combos y multiplicadores

Cada jugada se puntúa con una sola fórmula:

```
puntos = round((base × B2B + perfectClear) × combo)
```

| Jugada | Base (× nivel) |
| --- | --- |
| 1 / 2 / 3 / 4 líneas | 100 / 300 / 500 / 800 |
| T-spin con 0 / 1 / 2 / 3 líneas | 400 / 800 / 1200 / 1600 |
| T-spin Mini con 0 / 1 / 2 líneas | 100 / 200 / 400 |
| Perfect Clear con 1 / 2 / 3 / 4 líneas (se suma a la base) | 800 / 1200 / 1800 / 2000 |

- **Combo**: cada pieza seguida que elimina líneas sube el multiplicador (×1, ×2, ×3…, tope ×8). Fijar una pieza sin eliminar líneas lo vuelve a 0. La primera eliminación vale ×1, así que una jugada aislada puntúa igual que antes.
- **T-spin**: la T tiene que terminar con un giro (moverla o bajarla lo cancela) y 3 de las 4 esquinas de su caja 3×3 tienen que estar ocupadas (por bloques, paredes o el suelo). Es normal si las dos esquinas del lado al que apunta la T están ocupadas; si no, es Mini. Un T-spin sin líneas da su base, rompe el combo y no toca el B2B.
- **Back-to-Back**: un Tetris o un T-spin con líneas lo activa (`B2B ACTIVADO`). Mientras las siguientes eliminaciones también sean de ese tipo, su base vale ×1,5 (`BACK-TO-BACK`, `B2B x2`, `B2B x3`…). Una eliminación normal lo rompe; fijar una pieza sin eliminar no.
- **Perfect Clear**: si el tablero queda vacío tras eliminar, se suma su bonificación. No recibe el B2B, pero sí el combo.

Los avisos flotantes muestran como mucho 3 a la vez. El contador de combo brilla más en ×3, ×5 y ×8.

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.
- **Web Audio API** — sonidos generados en el momento, sin archivos de audio.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego (dark theme)
├── game.js         # Toda la lógica del Tetris (~600 líneas)
└── README.md
```

---

## Personalización

Algunos parámetros fáciles de tunear en `game.js`:

| Constante      | Significado                              | Por defecto           |
| -------------- | ---------------------------------------- | --------------------- |
| `COLS`         | Columnas del tablero                     | `10`                  |
| `ROWS`         | Filas del tablero                        | `20`                  |
| `BLOCK`        | Tamaño en píxeles de cada celda          | `30`                  |
| `COLORS`       | Paleta de colores por tipo de pieza      | 12 colores (7 + 5 especiales) |
| `LINE_SCORES`  | Puntos por 1, 2, 3 o 4 líneas eliminadas | `[0,100,300,500,800]` |
| `dropInterval` | Velocidad inicial de caída en ms         | `1000`                |
| `PENTOMINO_CHANCE` | Probabilidad de que la pieza generada sea un pentominó | `0.08` |
| `HOLLOW_CHANCE` | Probabilidad del cuadrado hueco 3×3      | `0.01`                |
| `TSPIN_SCORES` | Puntos de un T-spin con 0, 1, 2 o 3 líneas | `[400,800,1200,1600]` |
| `TSPIN_MINI_SCORES` | Puntos de un T-spin Mini con 0, 1 o 2 líneas | `[100,200,400]` |
| `PERFECT_CLEAR_SCORES` | Bonificación del Perfect Clear con 1–4 líneas | `[0,800,1200,1800,2000]` |
| `B2B_MULTIPLIER` | Multiplicador de la base durante el Back-to-Back | `1.5` |
| `MAX_COMBO_MULTIPLIER` | Tope del multiplicador de combo | `8` |
| `MAX_TOASTS` | Avisos flotantes visibles a la vez | `3` |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
