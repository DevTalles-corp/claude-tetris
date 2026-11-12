---
name: clima
description: Consulta el tiempo actual, el pronóstico y los datos astronómicos (amanecer, atardecer, fase lunar, índice UV) de cualquier ubicación usando wttr.in vía curl, sin API key. Úsala siempre que el usuario pregunte por el clima, el tiempo, la temperatura, si llueve o va a llover, si hace frío o calor, el viento, la humedad, el pronóstico, a qué hora amanece o anochece, la fase de la luna o el índice UV — tanto si menciona una ciudad como si no (en ese caso la ubicación se deduce de la IP). Cubre también formulaciones indirectas como "¿me llevo paraguas?", "¿hace falta abrigo?", "¿puedo salir a correr?", "qué tal el tiempo mañana", "weather", "forecast". No la uses para zonas horarias, datos climáticos históricos ni predicciones de más de 3 días.
---

# Clima

Devuelve el tiempo desde [wttr.in](https://wttr.in): sin API key, sin cuenta y sin
dependencias más allá de `curl`. Esto importa porque este equipo no tiene `python`
ni `jq` instalados, así que cualquier solución que pase por parsear JSON añade
fricción innecesaria — wttr.in ya devuelve texto listo para leer.

## Uso

El script `scripts/clima.sh` encapsula los parámetros correctos (español, sin
colores ANSI, vista estrecha) y codifica la ubicación. Ejecútalo desde la raíz del
proyecto:

```bash
./.claude/skills/clima/scripts/clima.sh [modo] [ubicación...]
```

| Modo | Qué devuelve |
|---|---|
| `ahora` (por defecto) | Resumen en una línea + bloque del momento actual |
| `hoy` | Actual + pronóstico de hoy |
| `semana` | Actual + 3 días (hoy incluido) |
| `ancho` | Igual que `semana` pero con las 4 franjas del día (mañana, mediodía, tarde, noche) |
| `astro` | Amanecer, atardecer, fase lunar e índice UV |

La ubicación es opcional: si se omite, wttr.in la deduce de la IP pública, que es
el comportamiento que se quiere por defecto. Pásala solo cuando el usuario nombre
un sitio concreto.

```bash
./.claude/skills/clima/scripts/clima.sh                      # aquí, ahora
./.claude/skills/clima/scripts/clima.sh hoy                  # aquí, hoy
./.claude/skills/clima/scripts/clima.sh semana Madrid
./.claude/skills/clima/scripts/clima.sh ahora San Sebastián  # los acentos funcionan
./.claude/skills/clima/scripts/clima.sh astro
```

## Cómo elegir el modo

Deja que lo decida la pregunta, no el modo más completo. Pedir tres días cuando
alguien solo quiere saber si hace frío ahora mismo gasta tiempo y llena la
respuesta de ruido.

- "¿qué tiempo hace?", "¿hace frío?", "¿está lloviendo?" → `ahora`
- "¿llueve esta tarde?", "¿me llevo paraguas hoy?" → `hoy`
- "¿qué tiempo va a hacer?", "el finde", "los próximos días" → `semana`
- "¿a qué hora anochece?", "¿hay luna llena?", "¿cuánto UV hay?" → `astro`

## Cómo presentar la respuesta

Responde primero a lo que se ha preguntado, en una o dos frases, y deja los datos
después. Alguien que pregunta "¿me llevo paraguas?" quiere un sí o un no, no una
tabla de la que deducirlo.

Reproduce el bloque ASCII de wttr.in tal cual cuando aporte algo (el pronóstico
por franjas, sobre todo): está pensado para leerse en terminal y las cajas se
rompen si lo reescribes a mano. Para una consulta de `ahora` basta con la línea
de resumen, sin el dibujo.

Menciona la ubicación que ha resuelto wttr.in siempre que no se haya pedido una
explícitamente. La detección por IP puede devolver el municipio vecino o, con una
VPN activa, otro país entero, y el usuario necesita poder detectarlo.

## Si algo falla

- **Ciudad equivocada**: wttr.in resuelve nombres ambiguos de forma caprichosa.
  Reintenta añadiendo el país — `semana Córdoba, Argentina`. También acepta
  códigos de aeropuerto (`MAD`), códigos postales y `~Torre+Eiffel` para puntos
  de interés.
- **Respuesta vacía o error de red**: wttr.in limita las peticiones por IP. Espera
  unos segundos y reintenta una vez; si sigue cayendo, dilo en lugar de inventar
  datos.
- **Caracteres raros en el dibujo**: el bloque usa Unicode; si la terminal lo
  destroza, usa el modo `ahora`, que es texto plano.

Si hace falta un dato que el script no expone, wttr.in acepta más indicadores de
formato (`%P` presión, `%D` alba, `%z` cenit) documentados en
`https://wttr.in/:help`; el modo `ahora` del script muestra cómo se encadenan.
