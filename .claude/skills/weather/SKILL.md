---
name: weather
description: Obtiene el clima actual y el pronóstico de Ottawa, Canadá por defecto (o de otra ciudad si el usuario la indica) usando wttr.in, sin API key. Úsala cuando el usuario pregunte por el clima, la temperatura, la lluvia o el pronóstico.
---

# Weather

Consulta el clima con `curl` contra [wttr.in](https://wttr.in). No requiere API key ni instalación.

## Pasos

1. Determina la ubicación:
   - Si el usuario indica una ciudad, úsala (reemplaza espacios por `+`, por ejemplo `Quito` o `New+York`).
   - Si no indica ciudad, usa por defecto `Ottawa,Canada`. No dependas de la detección por IP.
2. Ejecuta el comando según lo que se pida.

### Clima actual (resumen en una línea)

```bash
curl -s "wttr.in/<ciudad>?format=%l:+%c+%t+(sensación+%f),+humedad+%h,+viento+%w,+lluvia+%p&lang=es"
```

### Pronóstico de 3 días

```bash
curl -s "wttr.in/<ciudad>?0mT&lang=es"
```

Usa `?1mT` para hoy y mañana, o `?mT` para los 3 días completos. `m` = unidades métricas, `T` = sin colores ANSI.

### Datos estructurados (JSON)

```bash
curl -s "wttr.in/<ciudad>?format=j1"
```

Útil si el usuario pide un dato concreto (por ejemplo probabilidad de lluvia por hora).

## Respuesta

- Responde en el idioma del usuario, de forma breve: temperatura, sensación térmica, condición, humedad, viento y probabilidad de lluvia.
- Indica la ubicación consultada (por defecto Ottawa, Canadá).
- Si `curl` falla o devuelve vacío, informa que no hay conexión o que el servicio no respondió. No inventes datos.
