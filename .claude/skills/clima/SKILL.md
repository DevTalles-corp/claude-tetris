---
name: clima
description: Obtiene el clima actual y el pronóstico para una ubicación usando la API pública gratuita wttr.in, sin necesidad de API key. Úsala cuando el usuario pregunte por el clima, la temperatura, el pronóstico del tiempo, si va a llover, o pida "el clima en <ciudad>". Funciona con /clima [ciudad opcional].
---

# Clima

Consulta el clima actual (y pronóstico corto) usando el servicio público **wttr.in**, que no requiere API key ni configuración.

## Cómo usarla

1. **Determina la ubicación**:
   - Si el usuario pasó una ciudad como argumento (`args`) o la mencionó en su mensaje, úsala tal cual (URL-encodeada si tiene espacios/acentos, ej. `"Buenos Aires"` → `Buenos+Aires`).
   - Si no se indicó ninguna ubicación, **no preguntes**: deja que wttr.in autodetecte la ubicación por IP omitiendo el segmento de ciudad en la URL.

2. **Ejecuta la consulta** con el tool `Bash` (git bash, no PowerShell, para que el ASCII art se muestre bien). Usa el flag `?m` para unidades métricas (Celsius, km/h, mm):

   ```bash
   # Con ciudad:
   curl -s "wttr.in/Santiago?m"

   # Sin ciudad (autodetección por IP):
   curl -s "wttr.in?m"
   ```

   Para una respuesta breve de una sola línea (útil si el usuario solo quiere un dato rápido), usa `format=3`:

   ```bash
   curl -s "wttr.in/Santiago?format=3&m"
   ```

3. **Si `curl` falla o no está disponible** (poco común en git bash), usa PowerShell como respaldo:

   ```powershell
   (Invoke-RestMethod -Uri "https://wttr.in/Santiago?m&format=j1").current_condition
   ```

4. **Presenta el resultado**: si usaste el reporte ASCII completo, muéstralo dentro de un bloque de código para que se vea correctamente alineado. Si usaste `format=3`, puedes integrarlo directo en tu respuesta en texto.

5. **Timeout / sin conexión**: si `curl` no responde en unos segundos o da error de red, informa al usuario que no se pudo contactar wttr.in en vez de reintentar en bucle.

## Notas

- Unidades por defecto: **Celsius / métrico** (`?m`). No cambies a `?u` (imperial) salvo que el usuario lo pida explícitamente.
- No se requiere API key ni configuración adicional — es un servicio público gratuito.
- Esta skill es de nivel de proyecto (`.claude/skills/clima/`), disponible solo dentro de este repo.
