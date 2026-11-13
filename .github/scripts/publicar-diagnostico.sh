#!/usr/bin/env bash
# Aplica las etiquetas y publica (o actualiza) el diagnóstico de Claude en un issue.
# Lo usa .github/workflows/claude-issue-triage.yml.
#
# Claude devuelve piezas cortas (JSON); este script arma el Markdown con un formato fijo
# y recorta lo que se extienda, para que el comentario sea breve y fácil de leer.
#
# Variables: RESULTADO (JSON de Claude), NUMERO, REPO, MODELO, GH_TOKEN.
# Con SECO=1 solo imprime las etiquetas y el comentario, sin llamar a GitHub (para probar en local).
set -euo pipefail

MARCADOR='<!-- diagnostico-claude -->'

# Funciones jq comunes: texto en una línea, recortado, y seguro dentro de una tabla
JQ_DEFS='
def limpio: tostring | gsub("[\\r\\n\\t]+"; " ") | gsub(" {2,}"; " ") | ltrimstr(" ") | rtrimstr(" ");
def corto($n): limpio | if length > $n then (.[0:($n - 1)] | sub(" +[^ ]*$"; "")) + "…" else . end;
def celda($n): corto($n) | gsub("\\|"; "\\|");
def vacio: if (. | limpio) == "" then "_Sin información._" else . end;
'
q() { jq -r "$JQ_DEFS $1" <<< "$RESULTADO"; }

# Etiquetas: tipo, áreas y prioridad, en ese orden, sin vacíos ni repetidas
ETIQUETAS=$(q '([.tipo] + (.areas // []) + [.prioridad]) | map(select(. != null and . != ""))
  | reduce .[] as $e ([]; if index([$e]) then . else . + [$e] end) | join(",")')

{
  echo "$MARCADOR"
  echo "## 🩺 Diagnóstico de Claude"
  echo
  echo "| Tipo | Área | Prioridad |"
  echo "|---|---|---|"
  q '"| `\(.tipo)` | \((.areas // []) | map("`\(.)`") | join(" ")) | \(
      {"prioridad:alta":"🔴 Alta","prioridad:media":"🟠 Media","prioridad:baja":"🟢 Baja"}[.prioridad] // .prioridad) |"'
  echo
  echo "### 🔍 Diagnóstico"
  q '.diagnostico | corto(500) | vacio'
  echo
  echo "### 📂 Área afectada"
  if [ "$(q '(.area_afectada // []) | length')" -gt 0 ]; then
    echo "| Archivo | Qué hay ahí |"
    echo "|---|---|"
    q '(.area_afectada // [])[0:4][] | "| `\(.archivo | celda(60) | gsub("`"; ""))` | \(.detalle | celda(140)) |"'
  else
    echo "_Sin información._"
  fi
  echo
  echo "### 🧩 Causa raíz"
  q '.causa_raiz | corto(500) | vacio'
  echo
  echo "### 🛠️ Propuesta de solución"
  q 'if ((.propuesta_solucion // []) | length) == 0 then "_Sin información._"
     else (.propuesta_solucion[0:5] | to_entries[] | "\(.key + 1). \(.value | corto(280))") end'
  echo
  echo "### ⚠️ Riesgos"
  q 'if ((.riesgos // []) | length) == 0 then "_Sin información._"
     else (.riesgos[0:3][] | "- \(corto(280))") end'
  echo
  echo "---"
  echo "<sub>🤖 Modelo \`$MODELO\` · $(date -u '+%Y-%m-%d %H:%M UTC') · Se actualiza al editar el título o la descripción.<br>"
  echo "Para implementar, comenta mencionando a Claude (arroba seguida de claude, todo junto) y pide que siga la skill \`qa-tests\`.</sub>"
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
