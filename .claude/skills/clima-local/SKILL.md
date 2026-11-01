---
name: clima-local
description: Obtiene el clima actual y el pronóstico de la ubicación local del usuario (o de una ciudad indicada) usando wttr.in, sin API key. Úsala cuando el usuario pregunte por el clima, la temperatura, si va a llover, el pronóstico o "cómo está el tiempo".
---

# Clima local

Consulta el clima con `curl` contra [wttr.in](https://wttr.in). No requiere API key ni instalación. Responde siempre en español.

## Ubicación

- Si el usuario indica una ciudad (p. ej. "clima en Monterrey"), úsala.
- Si no indica ninguna, deja la ubicación vacía: wttr.in la detecta por la IP.
- Si el resultado de la ubicación detectada parece incorrecto, dilo y pide la ciudad.
- Reemplaza los espacios por `+` (p. ej. `Mexico+City`).

## Comandos

Sustituye `CIUDAD` por la ciudad, o déjalo vacío para autodetectar (la URL queda `https://wttr.in/?...`).

Resumen rápido, en una línea:

```bash
curl -s "https://wttr.in/CIUDAD?format=%l:+%c+%t+(sensación+%f),+humedad+%h,+viento+%w&lang=es&m"
```

Datos estructurados (clima actual y pronóstico de 3 días), para dar una respuesta más completa:

```bash
curl -s "https://wttr.in/CIUDAD?format=j1&lang=es"
```

Campos útiles del JSON:

- `nearest_area[0].areaName[0].value` y `country[0].value`: ubicación detectada.
- `current_condition[0]`: `temp_C`, `FeelsLikeC`, `humidity`, `windspeedKmph`, `winddir16Point`, `precipMM`, `uvIndex`, `lang_es[0].value` (descripción).
- `weather[0..2]`: `date`, `maxtempC`, `mintempC`, `hourly[].chanceofrain`.

Usa unidades métricas (°C, km/h, mm).

## Formato de respuesta

Breve, en español, con este orden:

1. Ubicación y condición actual (temperatura, sensación térmica, descripción).
2. Humedad, viento y probabilidad de lluvia.
3. Pronóstico de hoy y de los próximos días, solo si el usuario lo pidió.
4. Una recomendación corta si aplica (paraguas, protector solar, abrigo).

## Errores

- Si `curl` falla o no devuelve datos, informa que no se pudo consultar el servicio (posible falta de conexión) y no inventes valores.
- Si la respuesta no es JSON válido (p. ej. "Unknown location"), pide al usuario que confirme la ciudad.
- Nunca presentes datos de clima que no provengan de la consulta.
