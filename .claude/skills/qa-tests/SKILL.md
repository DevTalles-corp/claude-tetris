---
name: qa-tests
description: Atender un issue o requerimiento con evidencia. Implementar el cambio, decidir si necesita pruebas Playwright automatizadas o una verificación LLM, y dejar la evidencia correspondiente. En GitHub se trabaja en la rama de Claude y el workflow QA ejecuta las pruebas al hacer merge a qa; en local se trabaja en qa. Usar al implementar cualquier issue.
---

# Pruebas QA para un requerimiento

## Cuándo usar
Al implementar un issue o requerimiento nuevo en este repositorio.

## Dónde se trabaja
Depende de dónde se ejecute la skill:

- **En GitHub (`@claude` en un issue):** la acción crea una rama `claude/issue-N-…` desde `main` y no permite cambiar de rama. Escribe las pruebas en esa rama. No intentes crear ni usar `qa`: la unión a `qa` la hace una persona con una PR. Tampoco puedes ejecutar `npm test`; las pruebas las ejecuta el workflow QA cuando se hace merge hacia `qa`. Si la implementación del requerimiento está en otra rama, avisa que esa rama debe unirse a `qa` antes que la de pruebas.
- **En local:** trabaja en la rama `qa` actualizada desde `main` y ejecuta las pruebas tú mismo.

En ningún caso se cambia `main` directamente.

## Reglas
- Las pruebas viven en `tests/`, un archivo por issue: `tests/issue-N.spec.js`. El nombre importa: `capturar` solo guarda imágenes del archivo del issue en curso.
- Cada ejecución corre todas las pruebas, como regresión. Las de otros issues deben seguir pasando, pero no generan capturas.
- Cada prueba debe partir de un estado conocido. La página sigue la preferencia del sistema, así que `playwright.config.js` fija `colorScheme: 'dark'`; no quitarlo.
- La evidencia siempre queda en `tests/evidencia/issue-N/AAAA-MM-DD_HH-MM-SS/`, donde N es el número del issue y la fecha y hora es la de la ejecución. Cada ejecución crea su propia carpeta; no sobrescribir ejecuciones anteriores.
- Ejecutar con `ISSUE=N npm test`. Sin `ISSUE`, la evidencia cae en `sin-issue/` y no debe usarse en un PR.
- Cada escenario captura su pantalla con un nombre que diga qué verifica. El nombre va **sin extensión**: `capturar(page, 'modo-claro')` guarda `modo-claro.png`. Si se escribe `'modo-claro.png'`, queda `modo-claro.png.png`.
- El bucle del juego sigue corriendo durante la prueba (también tras un GAME OVER). Si una prueba cambia el estado y después mide algo del canvas (color de un píxel, posición de una pieza), hazlo en **un mismo `page.evaluate`**: entre dos llamadas, la gravedad puede mover la pieza y la prueba fallaría sin un error real.
- No modificar `index.html`, `game.js` ni `style.css` para que una prueba pase. Si una prueba falla, reportar la causa.

## Referencia
Para explorar la página antes de escribir selectores, seguir el árbol de decisión de `anthropics/skills` → `skills/webapp-testing/SKILL.md`: esperar `networkidle`, tomar captura o inspeccionar el DOM, y luego escribir la prueba con los selectores encontrados. Ese material está en Python; aquí las pruebas se escriben en JavaScript con `@playwright/test`.

## Decidir si automatizar
Después de implementar, decide qué evidencia corresponde y escribe la decisión con su motivo en tu comentario: `Decisión: automatizar` o `Decisión: verificación LLM`.

**Automatizar** (pruebas Playwright) cuando el cambio:
- modifica lo que el usuario ve o hace en el navegador (`index.html`, `game.js`, `style.css`);
- agrega o cambia un flujo de juego (teclas, botones, puntaje, estados como pausa o game over).

**Verificación LLM** cuando el cambio no se puede observar en el navegador:
- documentación, `README.md`, `docs/`, textos o comentarios;
- configuración, workflows o skills.

Si dudas, automatiza.

### Formato de la verificación LLM
Archivo `tests/evidencia/issue-N/verificacion-llm.md`:

```markdown
# Verificación LLM · issue #N
- Fecha: AAAA-MM-DD HH:MM (UTC)
- Modelo: <modelo de esta ejecución>
- Rama: claude/issue-N-…
- Motivo de no automatizar: <una frase>

| Criterio | Cómo se verificó | Resultado |
|---|---|---|
| <criterio 1 del issue> | <archivo:línea o cambio revisado> | ✅ / ❌ |
```

Es una revisión rápida del cambio contra cada criterio, no una prueba ejecutada. Si algún criterio queda en ❌, dilo en tu comentario.

## Pasos
1. Leer el requerimiento y sus criterios de aceptación.
2. Implementar el cambio.
3. Decidir si automatizar (sección anterior) y anotar la decisión en el comentario.
4. **Si se automatiza:** crear `tests/issue-N.spec.js` con un escenario por criterio. Cada uno hace una captura con `capturar`, importada de `tests/helpers/evidencia.js` (`const { capturar } = require('./helpers/evidencia');`). No copiar la lógica de fecha ni de carpetas. Agregar los casos a `docs/qa/plan-de-pruebas.md` con el siguiente ID libre.
5. **Si no se automatiza:** crear `tests/evidencia/issue-N/verificacion-llm.md` con el formato anterior.
6. En local, ejecutar `ISSUE=N npm test` y confirmar que todo pasa. En GitHub, omitir este paso: el workflow QA ejecuta todas las pruebas al hacer merge a `qa`, también cuando solo hay verificación LLM.
7. Hacer commit y push de todo en la misma rama, con el trailer de co-autor.
8. En GitHub, no abrir PR hacia `main`: indicar que la rama se une a `qa` con una PR. En local, abrir la PR de `qa` a `main` con `Closes #N` solo si todo pasa.

## Qué no hacer
- No hacer merge del PR. Lo revisa una persona.
- No borrar pruebas existentes para que el resultado sea verde.
- No modificar la aplicación para que una prueba pase. Si una prueba falla, reportar la causa.
- No instalar dependencias nuevas sin registrarlas en `package.json`.
