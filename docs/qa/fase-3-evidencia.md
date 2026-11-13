# Fase 3 · Evidencia

**Qué pasa:** se guardan las capturas de cada prueba y se registran en `qa`.

**Dónde queda:** `tests/evidencia/issue-N/AAAA-MM-DD_HH-MM-SS/`

**Reglas:**
- Solo se guardan capturas de las pruebas del issue (`tests/issue-N.spec.js`). Las demás pruebas corren como regresión y su resultado aparece como resumen en el comentario.
- Cada ejecución crea su propia carpeta.
- Nunca se sobrescribe una ejecución anterior.
- Se hace commit en `qa` con el mensaje `Evidencia QA del issue #N`.

```mermaid
flowchart LR
  A[Capturas de cada prueba] --> B[tests/evidencia/issue-N/fecha]
  B --> C[Commit en qa]
```

**Siguiente paso:** [Fase 4 · Comentario en el issue](fase-4-comentario.md).
