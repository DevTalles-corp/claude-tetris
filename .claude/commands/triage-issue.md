---
description: Analiza un issue, le asigna labels y publica/actualiza un diagnóstico técnico como comentario en formato Markdown válido para que GitHub lo renderice correctamente
allowed-tools: Bash(gh issue view:*), Bash(gh issue edit:*), Bash(gh label list:*), Bash(gh api:*), Read, Grep, Glob
---

Haz el triaje del issue número **$ARGUMENTS** de este repositorio.

Tu trabajo tiene dos entregables: **(1)** las labels correctas aplicadas al issue y **(2)** un comentario de
diagnóstico técnico que sirva como punto de partida para que después se implemente la solución. No escribas
ni modifiques código, no crees ramas y no abras pull requests.

Escribe todo el contenido de cara al usuario **en español**, igual que el resto del proyecto.

## 1. Lee el issue

```bash
gh issue view $ARGUMENTS --json number,title,body,labels,author,comments
```

## 2. Consulta las labels disponibles

```bash
gh label list --limit 100
```

**Regla dura:** solo puedes usar labels que aparezcan en esa lista. No inventes nombres nuevos y no ejecutes
`gh label create`. Si para alguna categoría no hay una label adecuada, simplemente omite esa categoría.

## 3. Entiende el código antes de opinar

Lee `CLAUDE.md` para conocer las invariantes del proyecto y, según el tema del issue, las partes relevantes
de `game.js`, `index.html` y `style.css`. Es un Tetris en JS puro, sin dependencias ni suite de tests: toda
la lógica vive en funciones de nivel de módulo dentro de `game.js`.

No especules sobre funciones que no hayas leído. Cita siempre referencias concretas con el formato
`archivo:línea` (por ejemplo `game.js:142`).

## 4. Aplica las labels

Elige, como máximo, una de cada categoría:

- **Tipo**: `bug`, `enhancement`, `documentation`, `question`, `accessibility`…
- **Área**: `area:gameplay`, `area:rendering`, `area:controls`, `area:ui`, `area:scoring`
- **Prioridad**: `priority:high`, `priority:medium`, `priority:low`
- **Complejidad**: `complexity:small`, `complexity:medium`, `complexity:large`

```bash
gh issue edit $ARGUMENTS --add-label "bug,area:gameplay,priority:medium,complexity:small"
```

Usa **solo** `--add-label`: nunca quites labels que haya puesto una persona. Si el issue ya tiene una label
de una categoría y tu análisis coincide, no hace falta volver a añadirla.

## 5. Redacta el diagnóstico

Escribe el comentario a un fichero temporal (por ejemplo `/tmp/triage-$ARGUMENTS.md`) con esta estructura
exacta. La primera línea **debe** ser el marcador HTML, que es lo que permite actualizar el comentario en
ejecuciones posteriores:

```markdown
<!-- claude-triage -->
## 🔍 Diagnóstico automático

**Tipo:** … · **Área:** … · **Prioridad:** … · **Complejidad:** …

### Resumen
Dos o tres frases: qué pide el issue y qué implica.

### Comportamiento esperado vs. actual
Solo si es un bug. Qué debería pasar y qué pasa en su lugar.

### Análisis técnico
Archivos y funciones implicadas, con referencias `archivo:línea` y una frase por cada una explicando su papel.

### Hipótesis de causa raíz
Para un bug, por qué falla. Para una mejora, qué impide hoy el comportamiento deseado.

### Enfoque de solución propuesto
Pasos numerados y concretos, al nivel de "en `tal función` cambiar X por Y".

### Invariantes a respetar
Las reglas de `CLAUDE.md` que toca este cambio. Por ejemplo: las celdas del tablero indexan `COLORS` y
`PIECES`, que están 1-indexados con un `null` inicial; todo movimiento nuevo debe pasar por `collide()`;
`COLS`/`ROWS`/`BLOCK` están duplicados en el `<canvas>` de `index.html`; cualquier parada o reinicio del
bucle rAF debe resetear `lastTime`.

### Criterios de aceptación
Lista de comprobaciones verificables a mano en el navegador — no hay suite de tests en este proyecto.

### Información que falta
Preguntas concretas al autor si el issue es ambiguo. Si no falta nada, omite esta sección entera.

---
*Diagnóstico generado automáticamente por Claude. Revísalo antes de implementar.*
```

Sé específico y breve: este texto se lee para empezar a programar, no para documentar el proyecto. Si el
issue es trivial, un diagnóstico corto es la respuesta correcta.

El comentario se publica en GitHub, así que **todo el cuerpo tiene que ser Markdown válido** para que se
renderice bien: encabezados con `###`, listas con `-`, énfasis con `**`, referencias a código entre comillas
simples invertidas y los fragmentos de código en bloques con triple comilla invertida indicando el lenguaje
(```js). No uses HTML, salvo el marcador `<!-- claude-triage -->` de la primera línea.

## 6. Publica o actualiza el comentario

Busca un diagnóstico previo y, si existe, **actualízalo** en lugar de añadir uno nuevo:

```bash
ID=$(gh api "repos/$GITHUB_REPOSITORY/issues/$ARGUMENTS/comments" --paginate \
      --jq '[.[] | select(.body | startswith("<!-- claude-triage -->")) | .id] | first')

if [ -n "$ID" ] && [ "$ID" != "null" ]; then
  gh api -X PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$ID" -F body=@/tmp/triage-$ARGUMENTS.md
else
  gh api -X POST "repos/$GITHUB_REPOSITORY/issues/$ARGUMENTS/comments" -F body=@/tmp/triage-$ARGUMENTS.md
fi
```

Si ejecutas este comando fuera de GitHub Actions, `$GITHUB_REPOSITORY` no estará definido: usa entonces
`jlopezbustamante/claude-tetris`.

## 7. Resume

Termina con dos o tres líneas en el chat indicando qué labels aplicaste y si creaste o actualizaste el
comentario de diagnóstico.
