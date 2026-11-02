#!/usr/bin/env bash
# Aplica las etiquetas y publica (o actualiza) el diagnóstico de Claude en un issue.
# Lo usa .github/workflows/claude-issue-triage.yml.
#
# Variables: RESULTADO (JSON de Claude), NUMERO, REPO, MODELO, GH_TOKEN.
# Con SECO=1 solo imprime las etiquetas y el comentario, sin llamar a GitHub (para probar en local).
set -euo pipefail

MARCADOR='<!-- diagnostico-claude -->'

# Etiquetas: tipo, áreas y prioridad, en ese orden, sin vacíos ni repetidas
ETIQUETAS=$(jq -r '([.tipo] + (.areas // []) + [.prioridad]) | map(select(. != null and . != ""))
  | reduce .[] as $e ([]; if index([$e]) then . else . + [$e] end) | join(",")' <<< "$RESULTADO")

seccion() {
  jq -r --arg k "$1" '.[$k] // "" | if (. | gsub("\\s"; "")) == "" then "_Sin información._" else . end' <<< "$RESULTADO"
}

{
  echo "$MARCADOR"
  echo "### 🩺 Diagnóstico de Claude"
  echo "**Etiquetas:** ${ETIQUETAS//,/ · }"
  echo
  echo "#### Diagnóstico"
  seccion diagnostico
  echo
  echo "#### Área afectada"
  seccion area_afectada
  echo
  echo "#### Causa raíz"
  seccion causa_raiz
  echo
  echo "#### Propuesta de solución"
  seccion propuesta_solucion
  echo
  echo "#### Riesgos"
  seccion riesgos
  echo
  echo "---"
  echo "<sub>Modelo: \`$MODELO\` · $(date -u '+%Y-%m-%d %H:%M UTC') · Se actualiza al editar el título o la descripción del issue.</sub>"
  echo
  echo "<sub>Para implementar, comenta en este issue mencionando a Claude (arroba seguida de claude, todo junto) y pide que siga la skill \`qa-tests\`.</sub>"
} > diagnostico.md

# Un comentario de un bot con la mención literal dispararía claude.yml: se quita la arroba
sed -i 's/@claude/claude/g' diagnostico.md

if [ "${SECO:-0}" = "1" ]; then
  echo "ETIQUETAS=$ETIQUETAS"
  cat diagnostico.md
  exit 0
fi

gh issue edit "$NUMERO" --repo "$REPO" --add-label "$ETIQUETAS" >/dev/null

# Un solo comentario por issue: si ya existe, se actualiza
ID=$(gh api "repos/$REPO/issues/$NUMERO/comments" --paginate \
  --jq ".[] | select(.user.login == \"github-actions[bot]\" and (.body | contains(\"$MARCADOR\"))) | .id" | head -1)
if [ -n "$ID" ]; then
  gh api -X PATCH "repos/$REPO/issues/comments/$ID" -F body=@diagnostico.md >/dev/null
  echo "Diagnóstico actualizado (comentario $ID). Etiquetas: $ETIQUETAS"
else
  gh api "repos/$REPO/issues/$NUMERO/comments" -F body=@diagnostico.md >/dev/null
  echo "Diagnóstico publicado. Etiquetas: $ETIQUETAS"
fi
