# Plan de pruebas

## 1. Objetivo
Verificar que cada cambio de Tetris funciona en el navegador antes de llegar a `main`, y dejar evidencia de cada verificación.

## 2. Alcance
- Aplicación: Tetris en HTML5 Canvas (`index.html`, `game.js`, `style.css`).
- Pruebas: escenarios automatizados con Playwright en `tests/`.
- Fuera de alcance: lógica de juego (puntuación, colisiones) y pruebas de rendimiento.

## 3. Entorno

| Elemento | Valor |
|---|---|
| Herramienta | `@playwright/test` 1.64.1 |
| Navegador | Chromium 156.0.8078.4 |
| Sistema (CI) | GitHub Actions `ubuntu-24.04` |
| Sistema (local) | Linux |
| Viewport | 1080 × 1920 |
| Tema | oscuro fijo (`colorScheme: 'dark'`) |

## 4. Casos de prueba

| ID | Escenario | Resultado esperado | Captura |
|---|---|---|---|
| TC-01 | Carga del tablero y del botón de tema | `#board` y `#theme-toggle` visibles | `carga-tablero.png` |
| TC-02 | Modo claro | Al pulsar el botón, `data-theme` vale `light` | `modo-claro.png` |
| TC-03 | Vuelta al modo oscuro | Dos pulsaciones devuelven `data-theme` a `dark` | `modo-oscuro.png` |
| TC-04 | Título visible | `h1.title` con texto `TETRIS` visible (issue #2) | `titulo-visible.png` |
| TC-05 | Título fuera de `.wrapper` | `h1.title` no es descendiente de `.wrapper`, para que el overlay de GAME OVER no lo cubra (issue #2) | `titulo-fuera-wrapper.png` |
| TC-06 | Tablero debajo del título | `#board` visible y su borde superior en o debajo del borde inferior del título (issue #2) | `tablero-debajo-titulo.png` |
| TC-07 | Etiqueta PIEZAS en el panel | `PIEZAS` aparece en el panel con el mismo estilo que `SCORE`, `LINES` y `LEVEL` (issue #18) | `panel-etiqueta-piezas.png` |
| TC-08 | Contador en 0 al cargar | `#pieces` vale `0` al cargar la página (issue #18) | `contador-inicia-en-cero.png` |
| TC-09 | Suma al fijar una pieza | Cada pieza fijada en el tablero (Espacio) suma 1: `#pieces` pasa de 0 a 1 y de 1 a 2 (issue #18) | `contador-suma-al-fijar.png` |
| TC-10 | Reinicio a 0 | Tras fijar 3 piezas, pausar y pulsar Reiniciar devuelve `#pieces` a `0` (issue #18) | `contador-reinicia-en-cero.png` |
| TC-11 | Partida automática hasta el nivel 4 | Un bot con el teclado juega desde el inicio hasta 30 líneas (`#level` = 4) sin GAME OVER; el video de la partida queda como evidencia (issue #26) | `inicio-partida.png`, `nivel-4-sin-game-over.png`, `partida-nivel-4.webm` (video) |
| TC-12 | Partida reproducible | Con la semilla 26, dos partidas sacan las mismas 10 primeras piezas (issue #31) | `misma-secuencia-de-piezas.png` |
| TC-13 | Récord del bot | Con la semilla 26, el bot juega hasta GAME OVER o 90 s y logra al menos 30 líneas. Solo corre con `ISSUE=31`: es una medición, no regresión (issue #31) | `record-final.png`, `record-panel.png` |
| TC-14 | La J en azul pálido | `COLORS[6]` vale `#90caf9`, el resto de la paleta no cambia, y el centro de una celda de la J dibujada en el tablero tiene ese color (issue #34) | `j-azul-palido.png` |
| TC-15 | Antes y después de la J | Con el color anterior (`#7986cb`) y con el nuevo (`#90caf9`), la J dibujada muestra cada color en su celda (issue #34) | `antes-j-indigo.png`, `despues-j-azul-palido.png` |
| TC-16 | Bucle detenido tras GAME OVER por gravedad | Con la semilla 34 y sin pulsar teclas tras apilar, la gravedad termina la partida; 3 s después `animId`, `pieces` y `board` no cambian (issue #39) | `game-over-por-gravedad.png`, `tras-3-s-sin-cambios.png` |
| TC-17 | Reiniciar tras GAME OVER por gravedad | Tras el GAME OVER, Reiniciar pone `pieces` en 0 y la pieza nueva vuelve a caer sola (issue #39) | `reiniciar-vuelve-a-caer.png` |
| TC-18 | Pausa con P | Con P el bucle se detiene (`animId` y posición de la pieza fijos); con P de nuevo la pieza vuelve a caer (issue #39) | `pausa.png` |
| TC-19 | Pentominós | `+`, `U` e `Y` tienen 5 bloques, 4 giros vuelven a la forma original y la cruz es simétrica (issue #42) | `piezas-especiales-en-tablero.png` |
| TC-20 | Colisiones de las especiales | Las 5 piezas nuevas respetan paredes, suelo y bloques fijos (issue #42) | — |
| TC-21 | Cuadrado hueco | Al fijarse quedan 8 bloques y el centro vacío; al rotar conserva la forma (issue #42) | `cuadrado-hueco-centro-vacio.png` |
| TC-22 | Líneas con especiales | El 1×1 completa una línea: suma 100 puntos y, con 10 líneas, sube al nivel 2 (issue #42) | `linea-completada-con-1x1.png` |
| TC-23 | Recompensa del Tetris | Tras eliminar 4 líneas a la vez, la pieza siguiente es el 1×1 (issue #42) | `recompensa-1x1-tras-tetris.png` |
| TC-24 | Frecuencias | En 20 000 piezas: hueco entre 0,5 y 1,5 %, pentominós entre 6 y 10 %, ninguna especial seguida y el 1×1 solo como recompensa (issue #42) | — |
| TC-25 | Fin de partida | Un cuadrado hueco que no cabe al aparecer dispara GAME OVER (issue #42) | `game-over-con-cuadrado-hueco.png` |
| TC-26 | Combo encadenado | 9 líneas seguidas suman 100, 200 … 800, 800 (tope ×8); fijar sin línea vuelve el combo a 0 (issue #48) | `combo-en-el-tope-x8.png` |
| TC-27 | Contador de combo | `#combo-hud` se ve con `×3` tras tres eliminaciones y se oculta al fijar sin línea (issue #48) | `contador-combo-activo.png`, `contador-combo-oculto-al-romperse.png` |
| TC-28 | T-spin doble con el teclado | Girar en el aire, bajar con ↓, girar dentro de la ranura y soltar: `T-SPIN DOUBLE` y 1200 + 17 puntos (issue #48) | `tspin-doble.png` |
| TC-29 | T-spin Mini | Con 3 esquinas ocupadas pero no las dos del frente, el giro da `T-SPIN MINI` y 200 puntos con 1 línea (issue #48) | `tspin-mini.png` |
| TC-30 | Sin giro no hay T-spin | Girar en el aire y caer con Espacio en un hueco de 3 esquinas da un doble normal (334 puntos), sin aviso (issue #48) | `sin-giro-no-es-tspin.png` |
| TC-31 | Back-to-Back | Tetris (`B2B ACTIVADO`, 800), pieza sin línea (B2B sigue), Tetris (×1,5: 1200), T-spin doble (`B2B x3`) y una línea normal lo rompe (issue #48) | `b2b-x3-tras-tspin.png`, `b2b-roto-con-linea-normal.png` |
| TC-32 | Perfect Clear | Dejar el tablero vacío suma (100 + 800) × combo 2 = 1800, con aviso `PERFECT CLEAR` y destello (issue #48) | `perfect-clear-con-combo.png` |
| TC-33 | Fórmula de puntuación | 11 jugadas en `scoreMove` cumplen `round((base × B2B + perfectClear) × combo)` y ningún tipo de evento se repite en una jugada (issue #48) | — |
| TC-34 | Avisos e intensidad | Nunca hay más de 3 avisos a la vez; el contador pasa por las intensidades 0, 1, 2 y 3 y late en cada eliminación (issue #48) | `avisos-limitados-e-intensidad-maxima.png` |
| TC-35 | Sonido | Combo (desde ×2), T-spin, B2B y Perfect Clear suenan; 🔊/🔇 silencia sin tocar el volumen, y el volumen al 20 % o en 0 funciona aparte (issue #48) | `controles-de-sonido-volumen-20.png` |
| TC-36 | Eventos separados | Sin la capa visual ni sonora, un Tetris emite `combo`, `b2b-start` y `score` y puntúa igual; `scoreMove` no cambia el estado (issue #48) | `reglas-sin-capa-visual.png` |
| TC-37 | Piezas especiales y niveles | Combo con la cruz `+` y el cuadrado hueco, subida al nivel 2 en mitad del combo y el 1×1 sigue tras el Tetris (issue #48) | `combo-con-piezas-especiales.png` |
| TC-38 | GAME OVER y reinicio | Con combo y B2B activos la partida termina; Reiniciar deja combo, B2B y avisos en 0 (issue #48) | `game-over-con-combo-activo.png`, `reinicio-limpia-combo-y-b2b.png` |
| TC-49 | Tabla al cargar | Con `localStorage` vacío, `#records` (RÉCORDS) se ve con «Sin récords todavía» y `Mejor combo: 0 · Líneas máximas: 0`, debajo del tablero y del panel (560×800 y 1080×1920), y el juego arranca solo (issue #54) | `tabla-vacia-al-cargar.png` |
| TC-50 | Récords guardados al cargar | Con 6 récords desordenados en `localStorage`, la tabla muestra los 5 mejores ordenados por puntos, con líneas, nivel y combo, y los máximos guardados (issue #54) | `tabla-con-records-al-cargar.png` |
| TC-51 | GAME OVER con récord | Jugando con Espacio hasta el GAME OVER: `¡Nuevo récord! Puesto #1`, campo de nombre enfocado, botón Guardar y la fila resaltada en las dos tablas; `#overlay-score` no cambia (issue #54) | `game-over-nuevo-record.png` |
| TC-52 | Escribir el nombre | Las teclas en un campo de texto no mueven, bajan ni pausan; Espacio mantenido no llena el campo; «Ana Pepa» se escribe completo, Enter lo guarda y un segundo envío o `endGame` no duplica la partida (issue #54) | `nombre-guardado-con-enter.png` |
| TC-53 | Nombre vacío y largo | Guardar con el campo vacío guarda «Jugador»; un nombre largo se corta a 12 letras (issue #54) | `nombre-vacio-y-nombre-largo.png` |
| TC-54 | Reiniciar sin guardar | La puntuación queda guardada como «Jugador», el formulario y el resaltado desaparecen, el foco vuelve al juego, y en PAUSA no aparecen los récords (issue #54) | `reinicio-sin-guardar.png`, `pausa-sin-records.png` |
| TC-55 | Posición en el top 5 | Con 5 récords, 3500 entra en el puesto 3 y saca al 5.º; un empate con el 5.º o 0 puntos no entran ni piden nombre (issue #54) | `record-puesto-3.png`, `sin-record-empate-con-el-quinto.png` |
| TC-56 | Mejor combo y líneas máximas | Tres líneas seguidas y una pieza sin línea dejan `maxCombo` en 3; la tabla y los máximos muestran 3 y 3, una partida peor no los baja y `init()` vuelve `maxCombo` a 0 (issue #54) | `mejor-combo-y-lineas.png`, `maximos-se-conservan.png` |
| TC-57 | Borrar récords | El botón pide confirmación en la página (sin `window.confirm`); Cancelar no borra y «Sí, borrar» vacía la tabla, los máximos y `localStorage` (issue #54) | `confirmar-borrado.png`, `records-borrados.png` |
| TC-58 | Datos dañados y otra pestaña | JSON roto o registros con tipos incorrectos no rompen el juego: se ignoran o se sanean y la siguiente partida se guarda bien, sin errores en la página; un récord guardado desde otra pestaña se conserva al terminar la partida (issue #54) | `datos-danados-ignorados.png`, `record-de-otra-pestana-conservado.png` |

Cada requerimiento agrega sus propios casos con un ID nuevo en `tests/issue-N.spec.js`.

## 5. Criterios de aceptación
1. Todos los casos del requerimiento pasan.
2. Cada caso tiene su captura en `tests/evidencia/issue-N/AAAA-MM-DD_HH-MM-SS/`.
3. El comentario del issue muestra el resultado, el modelo, el navegador y el dispositivo.
4. Una persona aprueba antes de cualquier merge a `main`.

## 6. Ejecución
- Local: `ISSUE=N npm test`.
- En GitHub: automático al hacer merge de una PR hacia `qa`, o manual desde Actions → QA → Run workflow → `issue = N`.

## 7. Riesgos conocidos
- **Preferencia de tema del sistema:** la página sigue el tema del sistema. Por eso la configuración fija el tema oscuro.
- **Título del juego (issue #2):** TC-04 a TC-06 fallarán hasta que el cambio `<h1 class="title">` llegue a la rama de pruebas. Este commit no lo incluye.
- **Captura de fallos:** si una prueba falla, la captura se guarda en `fallo/`, no en la carpeta principal.

## 8. Responsables
- **Claude:** escribe los casos y ejecuta las pruebas, siguiendo la skill `qa-tests`.
- **Persona:** revisa la evidencia y aprueba el merge.

Ver también: [Claude como asistente de pruebas](pruebas-con-claude.md) y [Framework de pruebas](framework-pruebas.md).
