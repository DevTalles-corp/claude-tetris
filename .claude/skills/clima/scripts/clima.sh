#!/usr/bin/env bash
# Consulta el clima en wttr.in. Sin API key y sin dependencias aparte de curl.
#
# Uso:  clima.sh [modo] [ubicación...]
#   modo: ahora (por defecto) | hoy | semana | ancho | astro
#   ubicación: opcional. Si se omite, wttr.in la deduce de la IP pública.
#
# Ejemplos:
#   clima.sh                       -> ahora, ubicación por IP
#   clima.sh hoy                   -> hoy, ubicación por IP
#   clima.sh semana Madrid         -> 3 días en Madrid
#   clima.sh ahora San Sebastián   -> ahora en San Sebastián (los acentos se codifican)
#   clima.sh astro                 -> amanecer, atardecer, fase lunar, UV

set -u

BASE="https://wttr.in"
TIMEOUT=20
LANG_Q="lang=es"

# Codifica byte a byte en UTF-8. Imprescindible: si el acento de "San Sebastián"
# viaja en crudo, wttr.in lo lee mal y devuelve una ciudad completamente distinta.
urlencode() {
  local s="$1" out="" i c
  local LC_ALL=C
  for (( i=0; i<${#s}; i++ )); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) out="$out$c" ;;
      ' ')             out="$out+" ;;
      *)               out="$out$(printf '%%%02X' "'$c")" ;;
    esac
  done
  printf '%s' "$out"
}

modo="ahora"
case "${1:-}" in
  ahora|hoy|semana|ancho|astro) modo="$1"; shift ;;
esac

loc="$(urlencode "$*")"

get() {
  local url="${BASE}/${loc}?$1"
  if ! curl -sS --max-time "$TIMEOUT" "$url"; then
    echo "ERROR: no se pudo consultar ${url}" >&2
    return 1
  fi
}

case "$modo" in
  ahora)
    get "format=%25l:+%25C+%25t+(sens.+%25f)+viento+%25w+hum+%25h+lluvia+%25p+UV+%25u&${LANG_Q}" || exit 1
    echo
    get "0&T&n&${LANG_Q}"
    ;;
  hoy)    get "1&T&n&${LANG_Q}" ;;
  semana) get "3&T&n&${LANG_Q}" ;;
  ancho)  get "3&T&${LANG_Q}" ;;
  astro)
    get "format=%25l:+amanece+%25S+anochece+%25s+luna+%25m+UV+%25u&${LANG_Q}" || exit 1
    echo
    ;;
esac
