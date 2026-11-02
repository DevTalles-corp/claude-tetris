# Tetris

**Versión 1.1**: el número de versión se muestra junto al título del juego (`<span class="version">` en `index.html`).

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
  - [Récords](#récords)
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
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) más la **tuerca**, una pieza de reto de 3x3 con el centro vacío, todas con colores diferenciados.
- **Bomba**: cada 5 líneas eliminadas aparece en la vista previa una pieza bomba de 1 celda. Al fijarse destruye los bloques de un área de **3x3** centrada en ella (sin gravedad: lo de arriba queda flotando) y suma 10 puntos por bloque destruido, multiplicados por el nivel. Mientras cae, el ghost marca en rojo el área de explosión.
- **Rayo**: cada 4 líneas eliminadas aparece en la vista previa una pieza rayo de 1 celda (no sustituye a la bomba; si coinciden, sale primero el rayo). Al fijarse vacía la **columna** y elimina la **fila** donde cae, con gravedad (lo de arriba baja). Suma 10 puntos por bloque destruido × nivel, sin contar dos veces la intersección, y no cuenta en `LINES` ni en el nivel. Mientras cae, el ghost marca en amarillo la fila y la columna afectadas.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel).
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Menú de pausa** (`P` o `Esc`) con **Reanudar**, **Reiniciar** (nueva partida sin recargar), **Ver controles** y selector de **Nivel inicial** (1–10) para la próxima partida.
- **Game Over** con opción de reinicio.
- **Récords locales**: top 5 con nombre, mejor combo y líneas máximas, guardados en el navegador (ver [Récords](#récords)).

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
| `P` o `Esc` | Abrir / cerrar el menú de pausa |

Con el menú de pausa abierto ninguna tecla llega al juego: el menú se maneja con ratón o con `Tab` / `Enter` / `Espacio`. Al reanudar, las teclas que sigan pulsadas se ignoran hasta que se sueltan, para evitar movimientos accidentales.

Mientras se escribe el nombre en el campo de récord, las teclas del juego no actúan; `Enter` guarda el nombre.

---

## Récords

Al cargar la página aparece una **pantalla de inicio** con el top 5, el mejor combo y las líneas máximas. El juego no arranca hasta pulsar **Jugar**.

- **Top 5**: al terminar la partida, si la puntuación es mayor que 0 y entra en el top (hay menos de 5 récords o supera al quinto), se guarda con el nombre por defecto `Jugador` y la fila se resalta. Aparece un campo de texto (máx. 12 caracteres) para escribir tu nombre; **Guardar** o `Enter` lo cambia. Si reinicias o cierras sin guardar, el récord queda con `Jugador`. Si no entra en el top, el overlay muestra la tabla directamente.
- **Mejor combo**: racha máxima de bloqueos consecutivos de piezas normales que limpian al menos una línea. Un bloqueo que no limpia líneas reinicia la racha; la bomba y el rayo no la cuentan ni la cortan.
- **Líneas máximas**: el mayor número de líneas (`LINES`) conseguido en una partida.
- Ambas marcas se actualizan al terminar la partida y se resaltan en el game over si son nuevas.
- **Borrar récords** (en la pantalla de inicio y en el game over) pide confirmación y elimina todo.

Se guardan en `localStorage` con la clave `tetris-records`:

```json
{ "top": [{ "name": "Ana", "score": 1200, "lines": 9, "level": 1 }], "bestCombo": 3, "maxLines": 9 }
```

Si los datos faltan o están corruptos se ignoran sin errores. Los nombres se pintan con `textContent`.

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero.
- Un panel lateral con `SCORE`, `LINES`, `LEVEL`, vista de la siguiente pieza y la lista de controles.
- Un overlay `#overlay` para **GAME OVER** (incluye el bloque de récords `#over-records`) y un panel `#pause-menu` para el menú de **PAUSA**.
- Un overlay de inicio (`#start-overlay`) con los récords y el botón **Jugar**.

### 2. `style.css`

Aporta el aspecto visual con estética _retro arcade_: tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays. Todos los colores son variables CSS: `:root` define el **tema oscuro** (predeterminado) y `[data-theme="light"]` sobrescribe la paleta del **tema claro**.

El botón **Tema claro / Tema oscuro** junto al título cambia entre ambos temas (es un `role="switch"` accesible con teclado). La preferencia se guarda en `localStorage` (`tetris-theme`). `game.js` lee de las variables CSS los colores que pinta el canvas (cuadrícula, brillo y borde de bloques, opacidad del ghost) y repinta al cambiar de tema, también en pausa o game over.

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–8) que identifica la pieza. La bomba (tipo `9`) y el rayo (tipo `10`) nunca se guardan en el tablero.
- **Bomba** (`bombPiece`, `explode`): `clearLines` encola una bomba cada vez que `lines` alcanza `nextBombAt`; `spawn` la pone como siguiente pieza. Al fijarse, `lockPiece` llama a `explode()` en lugar de `merge()`/`clearLines()`.
- **Rayo** (`lightningPiece`, `strike`): igual que la bomba, con `nextLightningAt` y `pendingLightnings`. `spawn` da prioridad al rayo sobre la bomba. `strike()` vacía la columna y elimina la fila (`splice`/`unshift`).
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`).
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación**: usa la tabla clásica `[0, 100, 300, 500, 800]` multiplicada por el nivel actual; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Nivel y velocidad**: la partida empieza en el nivel inicial elegido en el menú de pausa (guardado en `localStorage`, clave `tetris-start-level`); después sube uno cada 10 líneas: `nivel inicial + ⌊lines / 10⌋`. La velocidad de caída (`speedForLevel`) se calcula como `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Menú de pausa** (`openPauseMenu`, `closePauseMenu`): `togglePause()` abre y cierra `#pause-menu`. Cambiar el nivel inicial no altera la partida en curso (usa `gameStartLevel`, fijado en `init()`); al cerrar el menú, las teclas aún pulsadas pasan a `blockedKeys` y el juego ignora su autorrepetición hasta el `keyup`. Mientras está abierto, `Tab` queda atrapado dentro del menú.
- **Récords** (sección `Récords locales` al final): `trackCombo` se llama desde `lockPiece` tras `clearLines`; `endGame` llama a `finishRecords()`, que guarda marcas y la fila del top (protegido para ejecutarse una vez por partida); `init` llama a `resetRecordsState()`.
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja con la opacidad del tema (`--ghost-alpha`: 0.2 en oscuro, 0.4 en claro).

### Flujo del juego

```
carga → pantalla de inicio (récords) → Jugar
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

   keydown → mover / rotar / soft-drop / hard-drop / menú de pausa (P o Esc)
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()` y se muestra el overlay de **Game Over** con los récords.

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color (temas claro y oscuro), `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego (temas oscuro y claro)
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
| `COLORS`       | Paleta de colores por tipo de pieza      | 8 colores + bomba     |
| `LINE_SCORES`  | Puntos por 1, 2, 3 o 4 líneas eliminadas | `[0,100,300,500,800]` |
| `dropInterval` | Velocidad inicial de caída en ms (según el nivel inicial) | `1000`  |
| `MAX_START_LEVEL` | Nivel inicial máximo del selector     | `10`                  |
| `BOMB_EVERY`   | Cada cuántas líneas aparece una bomba    | `5`                   |
| `BOMB_RADIUS`  | Radio de la explosión (`1` = 3x3)        | `1`                   |
| `BOMB_BLOCK_SCORE` | Puntos por bloque destruido (× nivel) | `10`                |
| `LIGHTNING_EVERY` | Cada cuántas líneas aparece un rayo   | `4`                   |
| `LIGHTNING_BLOCK_SCORE` | Puntos por bloque del rayo (× nivel) | `10`              |
| `RECORDS_MAX`  | Puestos de la tabla de récords           | `5`                   |
| `RECORD_NAME_MAX` | Longitud máxima del nombre (ajusta también `maxlength` en `index.html`) | `12` |
| `RECORD_DEFAULT_NAME` | Nombre por defecto del récord     | `'Jugador'`           |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
