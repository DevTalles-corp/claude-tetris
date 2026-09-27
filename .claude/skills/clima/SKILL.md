---
name: clima
description: >
  Obtiene el clima actual y el pronóstico desde la terminal usando wttr.in
  (servicio gratuito, sin API key). Ciudad por defecto: Villeta, Cundinamarca,
  Colombia; acepta otra ciudad si se indica. Usar cuando el usuario pregunte
  "qué clima hace", "cómo está el tiempo", "clima de <ciudad>", pida un
  pronóstico, o invoque /clima.
---

## Ciudad por defecto

`Villeta,Cundinamarca,Colombia`

Si el usuario no indica ciudad, usar esta por defecto. Si indica una ciudad
(y opcionalmente país), usar esa en su lugar, reemplazando espacios por `+`
en la URL (ej. "Nueva York" → `New+York`).

## Cómo obtener el clima

Fuente: [wttr.in](https://wttr.in) — no requiere API key ni registro, devuelve
texto plano listo para mostrar.

Ejecutar uno de estos comandos según la herramienta disponible:

**Bash:**
```bash
curl -s "wttr.in/Villeta,Cundinamarca,Colombia?lang=es"
```

**PowerShell:**
```powershell
curl.exe -s "wttr.in/Villeta,Cundinamarca,Colombia?lang=es"
```

(Usar `curl.exe` explícito en PowerShell, no el alias `curl` de
`Invoke-WebRequest`.)

### Variantes de formato (agregar como query params, separados por `&`)

- **Completo (default)**: sin `format=`, solo `?lang=es` → reporte de 3 días
  con arte ASCII, tal como lo devuelve wttr.in.
- **Resumen de una línea**: `?lang=es&format=3` → ej. `Villeta: ☀️ +27°C`
- **JSON estructurado** (si se necesita parsear algún dato puntual):
  `?format=j1`

## Presentación

- Reporte "completo": mostrar el bloque de texto tal cual lo devuelve el
  comando (viene pre-formateado), sin reformatear.
- Reporte "resumen": responder solo la línea devuelta.
- Si el comando falla (sin internet, ciudad no encontrada, timeout): decirlo
  claramente y sugerir revisar el nombre de la ciudad o la conexión — no
  inventar datos de clima.

## Ejemplos de invocación

- "clima" / "/clima" → reporte completo de Villeta, Cundinamarca, Colombia
- "clima de Madrid" / "/clima Madrid" → reporte completo de Madrid
- "resumen del clima" / "cómo está el tiempo en una línea" → formato de una
  línea
</content>
</invoke>
