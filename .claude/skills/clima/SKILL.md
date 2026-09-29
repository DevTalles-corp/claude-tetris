---
name: clima
description: This skill should be used when the user asks about the current weather, temperature, or forecast for their location — e.g. "qué tiempo hace", "clima actual", "temperatura ahora", "how's the weather", "check the weather", "what's the weather like". Fetches live local weather via free public APIs (IP geolocation + Open-Meteo), no API key required.
user-invocable: true
allowed-tools:
  - Bash
---

# Clima (local weather)

Fetch the user's current local weather using free, keyless public APIs, then present it back to the user in Spanish.

## How it works

Run the bundled script with the Bash tool:

```bash
bash .claude/skills/clima/scripts/get-weather.sh
```

The script:
1. Auto-detects the caller's location via IP geolocation (`ipwho.is`) — no city needs to be asked for.
2. Fetches current conditions for those coordinates from Open-Meteo (`current_weather`).
3. Prints two labeled blocks to stdout: `=== LOCATION ===` (city/region/country/lat/lon as plain text) and `=== CURRENT_WEATHER ===` (raw JSON with `temperature`, `windspeed`, `winddirection`, `weathercode`, `time`, `is_day`).

### Manual location override

If the user names a specific place or IP geolocation fails/looks wrong, pass coordinates directly to skip geolocation:

```bash
bash .claude/skills/clima/scripts/get-weather.sh <lat> <lon>
```

(Look up the coordinates yourself if the user gives a city name instead of lat/lon.)

### Errors

If the script exits non-zero, it printed `ERROR: ...` to stderr (network unreachable, API down, unparseable response). Relay that failure to the user in Spanish instead of inventing weather data.

## Interpreting `weathercode`

Open-Meteo's `current_weather.weathercode` is a WMO code, not a text description. Map it using this table when composing the final answer:

| Code | Descripción |
|---|---|
| 0 | Cielo despejado |
| 1 | Mayormente despejado |
| 2 | Parcialmente nublado |
| 3 | Nublado |
| 45, 48 | Niebla |
| 51, 53, 55 | Llovizna (ligera/moderada/intensa) |
| 56, 57 | Llovizna helada |
| 61, 63, 65 | Lluvia (ligera/moderada/intensa) |
| 66, 67 | Lluvia helada |
| 71, 73, 75 | Nieve (ligera/moderada/intensa) |
| 77 | Granos de nieve |
| 80, 81, 82 | Chubascos (ligeros/moderados/violentos) |
| 85, 86 | Chubascos de nieve |
| 95 | Tormenta eléctrica |
| 96, 99 | Tormenta eléctrica con granizo |

## Final answer

Present the result to the user **in Spanish**, including: ciudad/país, temperatura (°C), condición (de la tabla anterior), y viento (velocidad y, si es relevante, dirección). Keep it concise — a short paragraph or a few bullet points is enough, no need to dump the raw JSON.
