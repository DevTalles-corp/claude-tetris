# Instrucciones de triage automático de issues

Estas instrucciones las ejecuta Claude Code dentro del workflow
`.github/workflows/claude-issue-triage.yml` cada vez que se abre, edita o reabre un issue en este
repositorio. El objetivo es doble: (1) asignar labels correctas y (2) dejar un diagnóstico técnico en
español que sirva de punto de partida directo para implementar la solución.

**Idioma de salida: siempre español**, sin importar en qué idioma esté escrito el issue.

## Contexto del proyecto

Lee `CLAUDE.md` en la raíz del repo antes de analizar el issue. Resume mental: Tetris vanilla en
`game.js` (estado global, sin clases), `board` como matriz `ROWS×COLS`, pipeline
`lockPiece()→merge()→clearLines()→spawn()`, `collide()` para colisiones/wall kicks, `tryRotate()` con
offsets de kick, loop por `requestAnimationFrame` con `dropAccum`/`dropInterval`, scoring por
`LINE_SCORES`/nivel, input por un único listener de `keydown` sobre `e.code`. `index.html` es el DOM
shell, `style.css` el tema visual.

## Paso 1 — Leer el issue

```
gh issue view <N> --json number,title,body,labels,author,comments
```
Reemplaza `<N>` por el número de issue indicado en el prompt.

## Paso 2 — Investigar el código antes de opinar

Usa Read/Grep/Glob sobre `game.js`, `index.html`, `style.css` para localizar las funciones o secciones
concretas relacionadas con lo que reporta o pide el issue. **No cites una función, línea o
comportamiento del juego que no hayas verificado leyendo el código.** Si el issue describe un bug,
intenta razonar el flujo real (por ejemplo, sigue la ruta `collide` → `tryRotate` → `move` para un bug de
rotación) antes de proponer causa raíz.

## Paso 3 — Clasificar y asignar labels

Obtén la lista autoritativa de labels del repo (no la inventes ni la dupliques):

```
gh label list
```

Elige:
- **Exactamente 1 label de tipo**: `bug`, `enhancement`, `documentation` o `question` (usa `invalid` o
  `duplicate` solo si aplica claramente en vez de una de tipo).
- **1 o 2 labels de `area:*`**: `area:gameplay`, `area:rendering`, `area:input`, `area:ui`,
  `area:scoring`, `area:infra` — según la sección del código identificada en el Paso 2.
- **Exactamente 1 label de `priority:*`**: `priority:high`, `priority:medium` o `priority:low`.
- **`needs-info`** si falta información esencial para poder implementar la solución (pasos de
  reproducción, comportamiento esperado, contexto de navegador, etc.).
- **`triaged`** siempre, para marcar que ya pasó por este análisis.

Aplica las labels nuevas sin tocar las que ya haya puesto una persona:

```
gh issue edit <N> --add-label "bug,area:gameplay,priority:medium,triaged"
```

**Nunca** quites una label existente puesta manualmente.

## Paso 4 — Publicar el diagnóstico como comentario sticky

El comentario debe **reescribirse** en cada corrida, no duplicarse. Para eso:

1. Busca si ya existe un comentario de triage previo:
   ```
   gh api repos/{owner}/{repo}/issues/<N>/comments --jq '.[] | select(.body | contains("<!-- claude-triage -->")) | .id'
   ```
   (usa `${{ github.repository }}` ya separado en `owner/repo`, o pásalo tal cual a `gh api` con `-F`).
2. Si devuelve un ID, actualiza ese comentario:
   ```
   gh api --method PATCH repos/{owner}/{repo}/issues/comments/<ID> -f body=@diagnostico.md
   ```
3. Si no devuelve nada, crea uno nuevo:
   ```
   gh issue comment <N> --body-file diagnostico.md
   ```

El cuerpo del comentario debe empezar exactamente con la línea `<!-- claude-triage -->` (marcador para
poder encontrarlo la próxima vez) y seguir con este formato:

```markdown
<!-- claude-triage -->
## 🔍 Diagnóstico automático

**Resumen**: 2-3 frases de qué reporta o pide el issue.

**Clasificación**: tipo · área(s) · prioridad · complejidad estimada (S/M/L) — con una frase de por qué.

**Comportamiento actual vs. esperado** (solo si es bug): qué pasa hoy, qué debería pasar, pasos de
reproducción si se pueden inferir del código o del propio issue.

**Código implicado**: rutas y funciones concretas, p. ej. `game.js` → `collide()`, `tryRotate()`.

**Hipótesis de causa raíz** (bugs) / **Dónde encaja en la arquitectura** (features).

**Plan de solución propuesto**: pasos numerados sobre funciones/archivos concretos.

**Criterios de aceptación**: cómo verificar manualmente abriendo `index.html` en el navegador.

**Riesgos y preguntas abiertas**: incluye explícitamente qué información falta si se asignó `needs-info`.
```

## Reglas duras

- No modifiques código ni crees ramas, commits o pull requests.
- No cierres, reabras ni reasignes el issue.
- No quites labels puestas por humanos.
- No inventes comportamiento del juego que no esté respaldado por el código leído.
- Si el issue es spam, prueba, o no tiene relación con el proyecto, aplica igualmente `triaged` y dilo
  brevemente en el diagnóstico en vez de omitir el paso.
