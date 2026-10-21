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
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel).
- **Combo y multiplicadores**: limpiar líneas en piezas consecutivas multiplica el puntaje (x2, x3, … hasta x10); un bloque sin limpiar rompe la cadena. **T-spin** (rotar una T y encajarla con ≥3 esquinas ocupadas) puntúa 400/800/1200/1600 por 0–3 líneas. **B2B**: Tetris o T-spin seguidos ×1.5. **Perfect clear** (tablero vacío): +2000 × nivel. Efectos visuales (textos, partículas, sacudida) y sonido que sube de tono con el combo.
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Piezas no estándar**: ~12% de las piezas son especiales: pentominós **+**, **U** y **Y** (5 bloques) o un **cuadro 3×3 hueco** (8 bloques, más raro). Tras un **Tetris** (4 líneas a la vez) la siguiente pieza es un **single 1×1** de recompensa.
- **Power-ups**: cada 5 líneas eliminadas la siguiente pieza es especial (1 bloque con icono, visible en NEXT). Equivale a ~1 de cada 12 piezas. Efecto al aterrizar, tipo al azar con pesos:
  - 💣 **Bomba** (25%): destruye un área de 3×3.
  - ⚡ **Rayo** (25%): limpia una fila o una columna completa (50/50).
  - 🎨 **Tinte** (20%): convierte el color más abundante en comodines ★. Una fila con comodines se completa aunque le falten hasta 2 huecos.
  - 🧲 **Gravedad** (15%): compacta los huecos del tablero.
  - ❄️ **Congelar** (15%): pausa la caída automática 5 s (puedes seguir moviendo).
  - Los bloques destruidos suman 10 puntos cada uno.
- **Desafíos por nivel**: al subir de nivel se activan retos con objetivo (panel OBJETIVO). Nivel 2 **Obstáculos** (15 líneas con bloques precolocados), 3 **Basura** (sobrevive 90 s con una fila de basura cada 10 s), 5 **Sprint** (40 líneas en 2:00), 6 **Fantasma** (15 líneas, los bloques se ocultan tras fijar la pieza), 8 **Inversa** (20 líneas con rotación inversa). Superarlo da bono de 1000 × nivel; fallar solo pierde el bono y el juego sigue. Si se solapan, se encolan.
- **Habilidades cargables**: cada línea limpiada suma 12% a la barra ENERGÍA. Con la barra llena pulsa `E` (el juego se pausa), elige una habilidad con `1`–`4` y la barra se vacía (`Esc` cancela sin costo):
  - 🔮 **Visión**: muestra las siguientes 5 piezas (durante 5 piezas).
  - 🔄 **Intercambio**: cambia la pieza actual por una de las 7 estándar a elección.
  - ⏳ **Lentitud**: la caída es ×3 más lenta durante 10 s.
  - ↩️ **Deshacer**: revierte la última colocación (tablero, puntaje, combo) y recuperas esa pieza.
- **Reserva (HOLD)**: `C` o `Shift` guarda la pieza actual en el panel HOLD; si ya hay una guardada, las intercambia. Solo una vez por pieza: el slot se atenúa hasta que la pieza actual se fije. Sirve para esperar un Tetris o evitar un mal spawn.
- **Pausa** y **Game Over** con opción de reinicio.
- **Toggle de tema** claro/oscuro (botón arriba a la derecha; por defecto modo oscuro).
- **Skins** (selector arriba a la derecha): Retro, Neon (glow con `shadowBlur`), Pastel (bordes redondeados) y Pixel art (textura por bloque); se guarda en `localStorage` y cambia sin recargar.

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
| `C` / `Shift` | Reservar / intercambiar pieza (HOLD) |
| `E`       | Abrir habilidades (barra llena)   |
| `P` / `Esc` | Menú de pausa (reanudar, reiniciar, controles, nivel inicial) |
| `M`       | Silenciar / activar sonido        |

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero.
- Un panel lateral con `SCORE`, `LINES`, `LEVEL`, vista de la siguiente pieza y la lista de controles.
- Un overlay para los estados **PAUSA** y **GAME OVER**.

### 2. `style.css`

Aporta el aspecto visual con estética _dark / retro arcade_: fondo oscuro, tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays.

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–7) que identifica la pieza.
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`).
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación**: usa la tabla clásica `[0, 100, 300, 500, 800]` multiplicada por el nivel actual; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Nivel y velocidad**: el nivel sube cada 10 líneas; la velocidad de caída se calcula como `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Records** (`localStorage`, clave `tetris-records`): top 5 con nombre (se pide al hacer game over), mejor combo y máximo de líneas. Se muestran en la pantalla de inicio y en el game over; la fila nueva se resalta y hay botón "Borrar records".
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

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego (dark theme)
├── game.js         # Toda la lógica del Tetris (~300 líneas)
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
| `COLORS`       | Paleta de colores por tipo de pieza      | 7 colores             |
| `LINE_SCORES`  | Puntos por 1, 2, 3 o 4 líneas eliminadas | `[0,100,300,500,800]` |
| `dropInterval` | Velocidad inicial de caída en ms         | `1000`                |
| `RARE_CHANCE`  | Probabilidad de pieza no estándar        | `0.12`                |
| `RARE_WEIGHTS` | Peso relativo de +, U, Y y hueca         | `3, 3, 3, 2`          |
| `POWER_EVERY`  | Líneas necesarias por power-up           | `5`                   |
| `FREEZE_MS`    | Duración de Congelar en ms               | `5000`                |
| `POWERUPS`     | Icono y peso (probabilidad) de cada tipo | 5 tipos               |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Triage automático de issues

El workflow `.github/workflows/claude-issue-triage.yml` analiza con Claude cada issue al crearse o editarse (título/cuerpo). Asigna labels y publica un único comentario de diagnóstico (resumen, archivos afectados, causa probable, pasos sugeridos) que se actualiza en cada edición. Usa el secret `CLAUDE_CODE_OAUTH_TOKEN`.

Si el autor del issue es `OWNER`, `MEMBER` o `COLLABORATOR` y el issue pide un cambio concreto, Claude también modifica el código y sube un commit a la rama `claude/issue-<número>` (nuevo commit en cada edición, sin force-push). No abre PR: el comentario incluye un link para abrirlo a mano. Para otros autores solo hay labels y diagnóstico. El workflow necesita permiso `contents: write`.

Labels gestionados: `bug`, `enhancement`, `question`, `documentation`, `area:gameplay`, `area:ui`, `area:controls`, `area:performance`, `priority:high`, `priority:medium`, `priority:low`, `needs-info`.

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
