---
name: clima-cdmx
description: Consulta el clima actual en Ciudad de México (CDMX) usando Open-Meteo y lo reporta en español. Úsala cuando el usuario pregunte por el clima, la temperatura, si llueve o el pronóstico en CDMX / Ciudad de México, o invoque /clima-cdmx.
---

# Clima en Ciudad de México

Obtén el clima actual de CDMX y repórtalo en español, de forma breve.

## Fuente

Usa WebFetch con la API de Open-Meteo (gratuita, sin API key, se actualiza cada 15 min):

```
https://api.open-meteo.com/v1/forecast?latitude=19.43&longitude=-99.13&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation&daily=temperature_2m_min,temperature_2m_max,precipitation_probability_max&forecast_days=1&timezone=America/Mexico_City
```

Prompt para WebFetch: pide los valores crudos de `current` (time, temperature_2m, apparent_temperature, relative_humidity_2m, weather_code, wind_speed_10m, wind_direction_10m, precipitation) y de `daily` (min, max, probabilidad de lluvia). Pide los números tal cual, sin interpretar el `weather_code`.

No uses wttr.in: puede devolver observaciones desactualizadas.

## Interpretar `weather_code` (WMO) tú mismo

No confíes en la interpretación del modelo de WebFetch; traduce con esta tabla:

| Código | Condición |
|---|---|
| 0 | Despejado |
| 1 | Mayormente despejado |
| 2 | Parcialmente nublado |
| 3 | Nublado |
| 45, 48 | Niebla |
| 51, 53, 55 | Llovizna (ligera / moderada / intensa) |
| 61, 63, 65 | Lluvia (ligera / moderada / fuerte) |
| 80, 81, 82 | Chubascos (ligeros / moderados / fuertes) |
| 95 | Tormenta eléctrica |
| 96, 99 | Tormenta con granizo |

Dirección del viento: convierte grados a punto cardinal (0°=N, 45°=NE, 90°=E, 135°=SE, 180°=S, 225°=SO, 270°=O, 315°=NO).

## Formato de respuesta

```
**Clima en CDMX (HH:MM):**
- Temperatura: X °C (sensación Y °C)
- Condición: <según tabla>
- Humedad: Z %
- Viento: N km/h del <cardinal>
- Lluvia: P mm ahora · probabilidad hoy Q %
- Hoy: mín A °C / máx B °C
```

Si WebFetch falla, reintenta una vez; si vuelve a fallar, usa WebSearch ("clima Ciudad de México ahora") e indica que la fuente es alternativa.
