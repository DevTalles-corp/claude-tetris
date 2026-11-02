# Fase 1 · Implementación y decisión de evidencia

**Qué pasa:** después del [diagnóstico de la fase 0](fase-0-diagnostico.md), una persona revisa el issue y pide la implementación comentando con la mención a Claude. Claude ya no empieza solo al crear el issue.

**Quién:** Claude, siguiendo la skill `qa-tests`.

**Pasos de Claude:**
1. Implementa lo solicitado en su rama `claude/issue-N-…`.
2. Decide qué evidencia corresponde y explica el motivo en su comentario:
   - **Automatizar:** el cambio se ve o se usa en el navegador (interfaz, teclas, puntaje, estados). Crea `tests/issue-N.spec.js` con un escenario por criterio.
   - **Verificación LLM:** el cambio no se ve en el navegador (documentación, configuración, workflows). Revisa cada criterio contra el cambio y lo deja en `tests/evidencia/issue-N/verificacion-llm.md`.
   - Si duda, automatiza.
3. Hace commit y push de todo en la misma rama.

```mermaid
flowchart TD
  A["Pedido a Claude en un comentario"] --> B["Claude implementa en claude/issue-N"]
  B --> C{"¿Se ve o se usa en el navegador?"}
  C -->|Sí| D["Crea tests/issue-N.spec.js"]
  C -->|No| E["Verificación LLM en verificacion-llm.md"]
  D --> F["Commit y push en la misma rama"]
  E --> F
```

**Resultado:** una rama con el cambio y su evidencia, y un comentario con la decisión tomada.

**Siguiente paso:** una persona une la rama a `qa` con una PR → [Fase 2 · Ejecución de pruebas](fase-2-ejecucion.md).
