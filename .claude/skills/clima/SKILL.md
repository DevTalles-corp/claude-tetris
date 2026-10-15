---
name: clima
description: Consulta el clima actual (temperatura, estado, humedad, viento) de una ciudad usando la API gratuita de Open-Meteo, sin API key. Por defecto Hermosillo, Sonora. Úsalo cuando el usuario pregunte por el clima, la temperatura o el tiempo en alguna ciudad, o invoque /clima.
argument-hint: "[ciudad]"
allowed-tools: Bash(curl -s https://api.open-meteo.com/*) Bash(curl -s https://geocoding-api.open-meteo.com/*)
---

# Clima actual

Ciudad solicitada: `$ARGUMENTS` (si está vacío, usa **Hermosillo, Sonora**: latitud `29.0729`, longitud `-110.9559`).

## Pasos

1. **Coordenadas** — Si la ciudad es Hermosillo o no se indicó, usa las coordenadas de arriba. Si es otra ciudad, búscala solo por nombre (sin estado ni país, el geocoder no los acepta):

   ```bash
   curl -s "https://geocoding-api.open-meteo.com/v1/search?name=<CIUDAD_URL_ENCODED>&count=1&language=es"
   ```

   Toma `latitude`, `longitude`, `name`, `admin1` y `country` de `results[0]`. Si no hay `results`, dile al usuario que no encontraste la ciudad.

2. **Clima actual**:

   ```bash
   curl -s "https://api.open-meteo.com/v1/forecast?latitude=<LAT>&longitude=<LON>&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto"
   ```

3. **Reporta en español**, breve: ciudad, hora local de la lectura (`current.time`), estado, temperatura con sensación térmica, humedad y viento. Traduce `weather_code` con la tabla de abajo.

Open-Meteo actualiza cada 15 minutos; si la lectura es igual a una anterior en la conversación, dilo en una línea en vez de repetir todo como si fuera nuevo.

## Códigos WMO (`weather_code`)

| Código | Estado |
|---|---|
| 0 | Despejado |
| 1 / 2 / 3 | Mayormente despejado / Parcialmente nublado / Nublado |
| 45, 48 | Niebla |
| 51, 53, 55 | Llovizna ligera / moderada / intensa |
| 56, 57 | Llovizna helada |
| 61, 63, 65 | Lluvia ligera / moderada / intensa |
| 66, 67 | Lluvia helada |
| 71, 73, 75 | Nevada ligera / moderada / intensa |
| 77 | Granizo fino |
| 80, 81, 82 | Chubascos ligeros / moderados / violentos |
| 85, 86 | Chubascos de nieve |
| 95 | Tormenta eléctrica |
| 96, 99 | Tormenta con granizo |
