---
name: clima
description: Obtiene el clima actual y el pronóstico de los próximos días para Santiago de Chile (o una ciudad que la usuaria indique). Úsala cuando pida el clima, la temperatura, si va a llover o el pronóstico.
---

# Clima local

Responde siempre en español.

## Ubicación

1. Si la usuaria indica una ciudad, úsala.
2. Si no, usa siempre la ubicación por defecto: `Santiago,Chile` (zona horaria America/Santiago).

## Cómo obtener los datos

Usa `curl` con wttr.in (no requiere API key). Codifica los espacios de la ciudad como `+`.

Resumen rápido en una línea:

```bash
curl -s "https://wttr.in/Santiago,Chile?format=%l:+%c+%t+(sensación+%f),+humedad+%h,+viento+%w,+lluvia+%p&lang=es"
```

Detalle completo en JSON (actual + 3 días):

```bash
curl -s "https://wttr.in/Santiago,Chile?format=j1&lang=es"
```

Campos útiles del JSON:
- `current_condition[0]`: `temp_C`, `FeelsLikeC`, `humidity`, `windspeedKmph`, `precipMM`, `lang_es[0].value` (descripción)
- `weather[i]`: `date`, `maxtempC`, `mintempC`, `hourly[*].chanceofrain`

## Formato de la respuesta

- Ubicación y condición actual (temperatura, sensación térmica, descripción).
- Humedad, viento y probabilidad de lluvia.
- Pronóstico de hoy y de los próximos 2 días (mín/máx y lluvia).
- Una recomendación breve (paraguas, abrigo, etc.) si aplica.

Usa grados Celsius y km/h.

## Si falla

Si `curl` no devuelve datos (sin conexión o wttr.in caído), díselo claramente a la usuaria y no inventes valores. Como alternativa puedes probar Open-Meteo (`https://api.open-meteo.com/v1/forecast?latitude=-33.45&longitude=-70.67&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FSantiago`), ajustando latitud y longitud si se trata de otra ciudad.
