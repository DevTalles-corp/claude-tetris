---
name: clima
description: Obtiene el clima actual y el pronóstico de la ubicación local del usuario (o de una ciudad indicada). Úsala cuando el usuario pregunte por el clima, la temperatura, si va a llover o el pronóstico de hoy/los próximos días.
---

# Clima local

Consulta el clima con [wttr.in](https://wttr.in) (sin API key). Responde siempre en español.

## Pasos

1. **Ubicación**: si el usuario indicó una ciudad, úsala (reemplaza espacios por `+`, ej. `Buenos+Aires`). Si no, deja el campo vacío: wttr.in detecta la ubicación aproximada por IP. Si el resultado parece incorrecto, pide la ciudad al usuario.
2. **Clima actual** (una línea):
   ```bash
   curl -s "https://wttr.in/CIUDAD?format=%l:+%c+%t+(sensación+%f)+humedad+%h+viento+%w&lang=es&m"
   ```
3. **Pronóstico detallado** (3 días, JSON) cuando pidan más detalle:
   ```bash
   curl -s "https://wttr.in/CIUDAD?format=j1&lang=es"
   ```
   Campos útiles: `current_condition[0]` (`temp_C`, `FeelsLikeC`, `humidity`, `windspeedKmph`, `lang_es[0].value`) y `weather[]` (`date`, `maxtempC`, `mintempC`, `hourly[].chanceofrain`).
4. **Presenta** un resumen breve: ubicación, temperatura (°C), sensación térmica, condición, humedad, viento y probabilidad de lluvia. Añade una recomendación corta si aplica (paraguas, abrigo, etc.).

## Notas

- Unidades métricas (`m`). Para Fahrenheit/mph usa `u` en lugar de `m`.
- Si `curl` falla o no hay red, díselo al usuario; no inventes datos.
- La consulta envía la ciudad (o la IP, si no se indica) a wttr.in; avísalo si el usuario pregunta por privacidad.
