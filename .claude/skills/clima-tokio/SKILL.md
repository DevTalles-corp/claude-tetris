---
name: clima-tokio
description: Obtiene el clima actual y el pronóstico de 3 días para Tokio, Japón, usando la API gratuita Open-Meteo (sin API key). Úsala cuando el usuario pida el clima, temperatura, lluvia o pronóstico de Tokio.
---

# Clima de Tokio

Consulta la API pública de Open-Meteo (sin clave) y resume el resultado en español.

## Pasos

1. Ejecuta con Bash:

```bash
curl -s --max-time 20 "https://api.open-meteo.com/v1/forecast?latitude=35.6762&longitude=139.6503&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=3"
```

2. Lee el JSON:
   - `current`: hora local (`time`), `temperature_2m` (°C), `apparent_temperature` (sensación térmica, °C), `relative_humidity_2m` (%), `precipitation` (mm), `wind_speed_10m` (km/h), `weather_code`.
   - `daily`: fechas, `temperature_2m_max`, `temperature_2m_min`, `precipitation_probability_max` (%).

3. Traduce `weather_code` (código WMO) a descripción:

| Código | Descripción |
|---|---|
| 0 | Despejado |
| 1, 2, 3 | Mayormente despejado / parcialmente nublado / nublado |
| 45, 48 | Niebla |
| 51, 53, 55 | Llovizna |
| 56, 57 | Llovizna helada |
| 61, 63, 65 | Lluvia |
| 66, 67 | Lluvia helada |
| 71, 73, 75 | Nieve |
| 77 | Granizo fino |
| 80, 81, 82 | Chubascos |
| 85, 86 | Chubascos de nieve |
| 95 | Tormenta |
| 96, 99 | Tormenta con granizo |

4. Responde en español, breve:
   - Línea de clima actual: condición, temperatura, sensación térmica, humedad, viento, hora local de Tokio.
   - Pronóstico de los 3 días: fecha, mín/máx, probabilidad de lluvia.
   - Si el usuario pide algo específico (solo mañana, paraguas, etc.), responde eso.

## Notas

- Si `curl` falla o el JSON trae `error`, informa el fallo y no inventes datos.
- Las coordenadas son de Tokio (35.6762, 139.6503). Hora local: Asia/Tokyo (UTC+9).
