---
name: clima
description: Consulta el clima actual y pronóstico usando wttr.in. Sin argumento detecta la ubicación por IP; acepta una ciudad como argumento (ej. "Madrid", "Buenos Aires"). Úsala cuando el usuario pregunte por el clima, temperatura, lluvia o pronóstico.
allowed-tools: Bash
---

# Clima (wttr.in)

Consulta clima sin API key usando wttr.in.

## Comando

Windows: usar siempre `curl.exe`, nunca `curl` a secas (en PowerShell es alias de `Invoke-WebRequest` y rompe el formato).

- Sin ciudad (autodetección por IP):
  `curl.exe -s "https://wttr.in/?format=j1"`
- Con ciudad (reemplazar espacios por `+` o `%20`):
  `curl.exe -s "https://wttr.in/<ciudad>?format=j1"`

## Parseo del JSON (`j1`)

- Actual: `current_condition[0]` → `temp_C`, `FeelsLikeC`, `weatherDesc[0].value`, `humidity`, `windspeedKmph`, `precipMM`.
- Pronóstico: `weather[0]` = hoy, `weather[1]` = mañana → `date`, `maxtempC`, `mintempC`, y `hourly[4].chanceofrain` (índice 4 ≈ mediodía) para probabilidad de lluvia.
- Ciudad detectada: `nearest_area[0].areaName[0].value` (+ `country[0].value`).

## Formato de respuesta

```
**<Ciudad>** · <descripción>
<temp>°C (sensación <FeelsLikeC>°C) · Humedad <humidity>% · Viento <windspeedKmph> km/h

Hoy <mintempC>/<maxtempC>°C · lluvia <chanceofrain>%
Mañana <mintempC>/<maxtempC>°C · lluvia <chanceofrain>%
```

Responder siempre en español, conciso, sin texto de relleno.

## Alternativa rápida (una línea, sin parsear JSON)

`curl.exe -s "https://wttr.in/<ciudad>?format=%l:+%c+%t+%h+%w"`

Usar solo si el usuario pide algo muy breve o el JSON falla pero el texto plano funciona.

## Errores

Si la respuesta viene vacía, es HTML de error, o la ciudad no se reconoce: decirlo en una línea y sugerir reintentar con el nombre de ciudad explícito (en inglés si el nombre local falla). Nunca inventar datos de clima.
