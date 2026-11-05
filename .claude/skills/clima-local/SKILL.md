---
name: clima-local
description: Obtiene el clima actual y el pronóstico de Barakaldo, Bizkaia por defecto (o de otra ciudad indicada) usando wttr.in, sin API key. Úsala cuando el usuario pregunte por el clima, temperatura, lluvia o pronóstico.
argument-hint: "[ciudad opcional]"
allowed-tools: Bash(curl *)
---

# Clima local

Consulta el clima con `wttr.in` (gratis, sin API key). Responde en español, muy conciso.

## Pasos

1. Ubicación: si el usuario pasó una ciudad (`$ARGUMENTS`), úsala (reemplaza espacios por `+`). Si no, usa por defecto `Barakaldo,Bizkaia` (nunca detectar por IP).
2. Clima actual (una línea):
   ```
   curl -s "wttr.in/<ciudad>?format=%l:+%c+%t+(sensación+%f)+humedad+%h+viento+%w+lluvia+%p&lang=es&m"
   ```
3. Pronóstico 3 días (solo si el usuario lo pide):
   ```
   curl -s "wttr.in/<ciudad>?format=j1&lang=es"
   ```
   Lee `weather[].date`, `maxtempC`, `mintempC` y `hourly[].chanceofrain`.
4. Presenta: ubicación, temperatura, sensación, condición, humedad, viento, probabilidad de lluvia. Añade una recomendación breve (paraguas, abrigo...) si aplica.

## Notas

- Unidades métricas (`m`), idioma español (`lang=es`).
- Si `curl` falla o devuelve error/HTML, informa que no hay conexión o el servicio no responde; no inventes datos.
- Ubicación por defecto: Barakaldo, Bizkaia. Para otra ciudad, el usuario debe indicarla.
