#!/usr/bin/env bash
# Crea (o actualiza) las labels que usa el triaje automático de issues.
#
# Uso:  bash .github/setup-labels.sh
# Requiere el CLI `gh` autenticado con permisos de escritura sobre el repositorio.
#
# Es idempotente: si la label ya existe, se actualiza su color y descripción.
# El workflow de triaje NUNCA crea labels; solo aplica las que ya existen,
# así que este script debe ejecutarse una vez antes de usarlo.

set -euo pipefail

ensure_label() {
  local name="$1" color="$2" description="$3"
  if gh label create "$name" --color "$color" --description "$description" >/dev/null 2>&1; then
    echo "  creada:     $name"
  else
    gh label edit "$name" --color "$color" --description "$description" >/dev/null
    echo "  actualizada: $name"
  fi
}

echo "Área:"
ensure_label "area:gameplay"  "1d76db" "Lógica de juego: piezas, rotación, colisión, gravedad"
ensure_label "area:rendering" "5319e7" "Dibujado en canvas, ghost piece, colores"
ensure_label "area:controls"  "0e8a16" "Entrada de teclado y manejo de eventos"
ensure_label "area:ui"        "fbca04" "HUD, overlays, maquetación y CSS"
ensure_label "area:scoring"   "c2e0c6" "Puntuación, líneas, niveles y velocidad"

echo "Prioridad:"
ensure_label "priority:high"   "b60205" "Bloquea el juego o afecta a todas las partidas"
ensure_label "priority:medium" "fbca04" "Importante, pero hay forma de seguir jugando"
ensure_label "priority:low"    "c5def5" "Mejora menor o cosmética"

echo "Complejidad:"
ensure_label "complexity:small"  "bfdadc" "Cambio localizado, pocas líneas"
ensure_label "complexity:medium" "bfd4f2" "Toca varias funciones o archivos"
ensure_label "complexity:large"  "d4c5f9" "Cambio estructural o con riesgo de regresión"

echo
echo "Listo. Labels actuales del repositorio:"
gh label list --limit 100
