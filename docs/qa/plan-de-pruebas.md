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
