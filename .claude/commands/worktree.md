---
description: Crea un git worktree aislado en .trees/[nombre] y ejecuta ahí las instrucciones dadas
argument-hint: <requerimiento o instrucciones a ejecutar>
---

Requerimiento del usuario: $ARGUMENTS

Sigue estos pasos en orden:

1. **Determina el nombre**: a partir del requerimiento, elige un nombre corto en kebab-case (2-4 palabras, minúsculas, sin acentos ni espacios), p. ej. `add-sound-effects`. Si `.trees/<nombre>` ya existe, añade un sufijo (`-2`, `-3`...).
2. **Prepara el entorno**: verifica que `.trees/` esté en `.gitignore`; si no, agrégalo (no lo commitees).
3. **Crea el worktree** desde la raíz del repo:
   `git worktree add .trees/<nombre>`
   (esto crea una rama nueva con el mismo nombre). Si falla, reporta el error completo y detente.
4. **Ejecuta el requerimiento dentro del worktree**, de forma independiente y aislada:
   - Trabaja SOLO en `.trees/<nombre>/`: usa rutas absolutas dentro del worktree para Read/Edit/Write y ejecuta comandos con `cd .trees/<nombre> && ...`.
   - NO modifiques archivos del directorio principal ni de otros worktrees.
   - Sigue las convenciones de CLAUDE.md.
5. **Al terminar**, reporta brevemente: nombre/ruta del worktree, rama, resumen de cambios y cómo integrarlos (`git merge <nombre>`) o eliminarlos (`git worktree remove .trees/<nombre>`). No hagas commit, merge ni push salvo que el usuario lo pida.

Si `$ARGUMENTS` está vacío, pregunta al usuario qué requerimiento ejecutar antes de crear nada.
