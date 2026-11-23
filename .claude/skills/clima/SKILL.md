---
name: clima
description: Consulta el clima actual y el pronóstico de una ciudad (por defecto Lisboa, Caracas y Marinha Grande) usando servicios públicos sin API key. Úsala cuando el usuario pregunte por el clima, el tiempo, la temperatura, la lluvia o el pronóstico, o invoque /clima.
---

# Clima

Obtiene el clima con `curl` desde la terminal, sin API keys ni dependencias.

## Argumentos

- `/clima` → las **zonas por defecto**, consultando cada una (una llamada por ciudad):
  - Lisboa, Portugal → `Lisboa`
  - Caracas, Venezuela → `Caracas`
  - Marinha Grande, Portugal → `Marinha+Grande`
- `/clima <ciudad>` → esa ciudad (p. ej. `/clima Santiago`, `/clima "Buenos Aires"`).
- Si el usuario pide pronóstico de varios días, usa la sección "Pronóstico detallado".

## Clima actual (rápido)

Usa wttr.in en español. Sustituye espacios de la ciudad por `+`; sin ciudad, repite el comando para cada zona por defecto:

```bash
curl -s "https://wttr.in/<Ciudad>?lang=es&format=%l:+%c+%C,+%t+(sensaci%C3%B3n+%f),+humedad+%h,+viento+%w,+lluvia+%p\n"
```

Para un resumen de 3 días en texto:

```bash
curl -s "https://wttr.in/<Ciudad>?lang=es&m&T&n"
```

## Pronóstico detallado (Open-Meteo)

Si wttr.in falla o se pide más detalle:

1. Geocodificar la ciudad:
   ```bash
   curl -s "https://geocoding-api.open-meteo.com/v1/search?name=<Ciudad>&count=1&language=es"
   ```
   Toma `latitude`, `longitude`, `name`, `country` y `timezone` del primer resultado. Si no hay resultados, pide al usuario que precise la ciudad.

2. Pedir el pronóstico:
   ```bash
   curl -s "https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3"
   ```

3. Traducir `weather_code` (WMO): 0 despejado · 1–3 parcialmente nublado/nublado · 45, 48 niebla · 51–57 llovizna · 61–67 lluvia · 71–77 nieve · 80–82 chubascos · 85–86 chubascos de nieve · 95–99 tormenta.

## Respuesta

Responde en español, breve. Con varias ciudades, un bloque corto por ciudad (o una tabla):

- Ubicación (ciudad, país).
- Ahora: estado, temperatura, sensación térmica, humedad, viento.
- Si hay pronóstico: una línea por día con máx/mín y probabilidad de lluvia.
- Una recomendación corta si aplica (paraguas, abrigo, protector solar).

Si no hay conexión o ambos servicios fallan, dilo claramente y muestra el error de `curl`; no inventes datos.
