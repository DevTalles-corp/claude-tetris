---
name: clima
description: Consulta el clima actual (temperatura, sensación térmica, condición, humedad, viento) de una ciudad usando wttr.in. Úsala cuando el usuario pida el clima o la temperatura de un lugar; por defecto Asunción, Paraguay.
---

# Clima

Obtiene el clima actual de una ciudad y lo resume en español.

## Entrada

El argumento es el nombre de la ciudad (ej. `/clima Encarnación`). Si no se da ninguno, usar `Asuncion,Paraguay`.

## Pasos

1. Consultar wttr.in con Bash (reemplazar espacios por `+` en la ciudad):

   ```bash
   curl -s "https://wttr.in/<ciudad>?format=j1&lang=es"
   ```

2. Del JSON, leer `current_condition[0]`:
   - `temp_C`: temperatura
   - `FeelsLikeC`: sensación térmica
   - `lang_es[0].value` (o `weatherDesc[0].value`): condición
   - `humidity`: humedad (%)
   - `windspeedKmph` y `winddir16Point`: viento
   - `observation_time`: hora de la observación (UTC)

3. Responder en una o dos líneas, por ejemplo:

   > Asunción: 19 °C (sensación 21 °C), neblina, humedad 95 %, viento 8 km/h NE.

## Notas

- Si `curl` falla o el JSON viene vacío, probar con `WebFetch` sobre la misma URL; si tampoco funciona, informar el error sin inventar datos.
- `nearest_area[0].areaName[0].value` indica la estación que respondió, que puede ser una localidad cercana (ej. Luque para Asunción); mencionarlo si difiere de la ciudad pedida.
- No requiere clave de API ni instalar dependencias.
