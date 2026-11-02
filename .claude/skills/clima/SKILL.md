---
name: clima
description: Obtiene el clima actual y el pronóstico de la ubicación local del usuario (o de una ciudad indicada) usando wttr.in. Úsalo cuando el usuario pida el clima, la temperatura, el pronóstico o si va a llover. Invocable con /clima [ciudad].
---

# clima

Consulta el clima local desde la terminal con `curl` y la API pública de wttr.in (sin API key).

## Uso

- `/clima`: clima de la ubicación detectada por IP.
- `/clima <ciudad>`: clima de la ciudad indicada (ej. `/clima Buenos Aires`).

## Pasos

1. Determina la ubicación:
   - Si el usuario pasó una ciudad, úsala (reemplaza espacios por `+`).
   - Si no, deja la ubicación vacía: wttr.in la detecta por IP.
2. Ejecuta la consulta. Salida resumida en una línea:

   ```bash
   curl -s "https://wttr.in/<ciudad>?format=%l:+%c+%t+(sensación+%f)+humedad+%h+viento+%w&lang=es"
   ```

3. Para el pronóstico de 3 días en texto plano:

   ```bash
   curl -s "https://wttr.in/<ciudad>?0&T&lang=es"
   ```

   Usa `?1` para hoy, `?2` para hoy + mañana, sin número para 3 días.
4. Para datos estructurados (si necesitas procesarlos):

   ```bash
   curl -s "https://wttr.in/<ciudad>?format=j1"
   ```

   Campos útiles: `current_condition[0].temp_C`, `FeelsLikeC`, `humidity`, `windspeedKmph`, `weatherDesc[0].value`, `weather[].maxtempC`, `weather[].mintempC`.

## Respuesta

- Responde en el idioma del usuario.
- Incluye: ubicación, condición, temperatura (°C), sensación térmica, humedad, viento y, si aplica, probabilidad de lluvia.
- Si piden pronóstico, resume máxima/mínima por día.

## Notas

- Si `curl` falla o devuelve vacío/HTML de error, informa que no hay conexión o que wttr.in no está disponible; no inventes datos.
- La detección por IP puede ser imprecisa (VPN, proxy). Si la ubicación devuelta parece incorrecta, pide la ciudad al usuario.
- En PowerShell usa `curl.exe` (no el alias `curl`) o ejecuta el comando con la herramienta Bash.
