# Implementa

## Menú de pausa completo

Al pausar (tecla `P` o `Escape`) mostrar un overlay con opciones reales:

- **Reanudar** — vuelve al juego
- **Reiniciar** — nueva partida sin recargar página
- **Ver controles** — lista de teclas dentro del menú
- **Nivel inicial** — selector para elegir con qué nivel empezar la próxima partida
- Bloquear inputs del juego mientras el menú está abierto para evitar movimientos accidentales al volver

---

# Implementa

## Tabla de records local

Guardar las mejores puntuaciones en `localStorage`:

- Top 5 puntuaciones con nombre del jugador (campo de texto al game over)
- Mostrar en pantalla de inicio y en el overlay de game over
- Resaltar si la puntuación actual entra en el top
- Botón para resetear records
- Mostrar también el mejor combo y líneas máximas conseguidas

---

# Implementa

## Temas visuales / skins

Selector de skin que cambia la apariencia completa:

- **Retro** — bloques cuadrados, colores planos (estilo actual)
- **Neon** — fondo negro, glow effect con `shadowBlur` en canvas
- **Pastel** — colores suaves, bordes redondeados simulados
- **Pixel art** — patrón de textura dibujado sobre cada bloque
- Guardar preferencia en `localStorage`; cambio sin recargar aplicando nuevas constantes de color y función de draw
