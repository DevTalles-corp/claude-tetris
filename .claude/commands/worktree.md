---
description: Crea un git worktree aislado en .trees/[nombre] y ejecuta ahí las instrucciones dadas
argument-hint: <instrucciones a ejecutar en el worktree>
---

Requerimiento: $ARGUMENTS

Pasos:

1. Deriva un `[nombre]` corto en kebab-case (2-4 palabras, minúsculas, sin espacios) que describa el requerimiento.
2. Verifica que `.trees/` esté en `.gitignore`; si no, agrégalo.
3. Crea el worktree desde la raíz del repo: `git worktree add .trees/[nombre]` (si el nombre ya existe, añade un sufijo).
4. Ejecuta TODO el requerimiento dentro de `.trees/[nombre]`. Usa solo rutas dentro de ese directorio; no modifiques archivos del árbol principal.
5. Haz commit de los cambios en la rama del worktree (mensaje claro, estilo `feat:`/`fix:` del repo). No hagas merge ni push salvo que se pida.
6. Reporta de forma concisa: nombre, ruta, rama, resumen de cambios y cómo integrarlo (`git merge [nombre]`) o eliminarlo (`git worktree remove .trees/[nombre]`).
