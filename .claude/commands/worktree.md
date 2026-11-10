---
description: Crea un worktree aislado en .trees/<rama> con lo último de main y qa, y ejecuta ahí el requerimiento indicado sin tocar el código principal.
argument-hint: <requerimiento a implementar en el worktree>
---

# /worktree — trabajar un requerimiento en un worktree aislado

Requerimiento recibido:

$ARGUMENTS

## 1. Elegir el nombre de la rama

Decide un nombre corto en minúsculas, con guiones y sin acentos, que describa el requerimiento. Sigue las convenciones del repo:

- `feature/<descripcion>` para funcionalidades nuevas (`feature/issue-N-<descripcion>` si el requerimiento menciona un issue).
- `fix/<descripcion>` para correcciones (`fix/issue-N-<descripcion>` si hay issue).
- `docs/<descripcion>`, `test/<descripcion>` o `chore/<descripcion>` cuando corresponda.

Si `$ARGUMENTS` está vacío, pregunta al usuario cuál es el requerimiento y no crees nada.
Comprueba que el nombre no exista ya (`git branch -a --list "*<rama>*"` y `ls .trees/`). Si existe, elige otro o pregunta al usuario.

## 2. Crear el worktree con los últimos cambios de main y qa

Ejecuta desde la raíz del repositorio principal:

```bash
git fetch origin main qa
git worktree add .trees/<rama> -b <rama> origin/qa
cd .trees/<rama>
git merge --no-edit origin/main
```

- La rama nace de `origin/qa` y después se le une `origin/main`, así contiene lo último de las dos.
- Si `origin/main` ya está contenido en `qa`, el merge no hace nada; está bien.
- Si el merge tiene conflictos, detente, muestra los archivos en conflicto y pregunta al usuario cómo seguir. No los resuelvas a ciegas.
- Asegúrate de que `.trees/` esté en `.gitignore` del repositorio principal; si no está, agrégalo.
- Si el requerimiento necesita pruebas (`npm test`), ejecuta `npm install` dentro del worktree: `node_modules/` no se comparte.

## 3. Ejecutar el requerimiento dentro del worktree

A partir de aquí **todo** el trabajo ocurre en `.trees/<rama>`:

- Usa rutas absolutas dentro del worktree (`<raíz-del-repo>/.trees/<rama>/...`) en Read, Edit y Write, y `cd` al worktree en cada comando Bash.
- No edites archivos, ni cambies de rama, ni hagas commits en el repositorio principal. El código principal debe quedar intacto.
- Sigue las instrucciones de `CLAUDE.md` del proyecto (textos de la interfaz en español, actualizar `README.md` si cambian controles, puntuación o constantes, etc.).
- Si el requerimiento es un issue o necesita evidencia, aplica la skill `qa-tests`.
- Haz commits en la rama `<rama>` del worktree solo si el requerimiento lo pide o el usuario lo confirma. No hagas push ni abras PR sin confirmación.

## 4. Al terminar

Informa al usuario:

- La rama y la ruta del worktree (`.trees/<rama>`).
- Qué se cambió y cómo se verificó (o qué falta verificar).
- Cómo probarlo: `cd .trees/<rama> && python3 -m http.server 8000`.
- Cómo eliminarlo cuando ya no se necesite: `git worktree remove .trees/<rama>` (y `git branch -d <rama>` si la rama ya se unió).
