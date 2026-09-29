#!/usr/bin/env bash
# Fetches current weather for the caller's location.
#
# Usage:
#   get-weather.sh              # auto-detect location via IP geolocation
#   get-weather.sh <lat> <lon>  # skip geolocation, use given coordinates
#
# Prints two labeled blocks to stdout: LOCATION (plain text) and
# CURRENT_WEATHER (raw JSON from Open-Meteo). No jq dependency — only
# grep/sed extraction of a couple of numeric/string fields.

set -uo pipefail

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

extract() {
  # extract <field> <json>  -> prints the string/number/boolean value, or nothing
  grep -oE "\"$1\"[[:space:]]*:[[:space:]]*(\"[^\"]*\"|-?[0-9.]+|true|false|null)" <<<"$2" \
    | head -n1 \
    | sed -E 's/^"[^"]*"[[:space:]]*:[[:space:]]*//; s/^"(.*)"$/\1/'
}

LAT="${1:-}"
LON="${2:-}"
CITY=""
REGION=""
COUNTRY=""

if [[ -z "$LAT" || -z "$LON" ]]; then
  GEO_JSON="$(curl -sS --max-time 10 'https://ipwho.is/')"
  CURL_STATUS=$?
  [[ $CURL_STATUS -eq 0 ]] || fail "could not reach ipwho.is for IP geolocation (curl exit $CURL_STATUS)"
  [[ -n "$GEO_JSON" ]] || fail "empty response from ipwho.is"

  SUCCESS="$(extract success "$GEO_JSON")"
  [[ "$SUCCESS" == "true" ]] || fail "ipwho.is geolocation failed: $GEO_JSON"

  LAT="$(extract latitude "$GEO_JSON")"
  LON="$(extract longitude "$GEO_JSON")"
  CITY="$(extract city "$GEO_JSON")"
  REGION="$(extract region "$GEO_JSON")"
  COUNTRY="$(extract country "$GEO_JSON")"

  [[ -n "$LAT" && -n "$LON" ]] || fail "could not parse latitude/longitude from ipwho.is response: $GEO_JSON"
fi

WEATHER_JSON="$(curl -sS --max-time 10 "https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current_weather=true&timezone=auto")"
CURL_STATUS=$?
[[ $CURL_STATUS -eq 0 ]] || fail "could not reach Open-Meteo API (curl exit $CURL_STATUS)"
[[ -n "$WEATHER_JSON" ]] || fail "empty response from Open-Meteo"

echo "=== LOCATION ==="
if [[ -n "$CITY" || -n "$COUNTRY" ]]; then
  echo "city: ${CITY:-unknown}"
  echo "region: ${REGION:-unknown}"
  echo "country: ${COUNTRY:-unknown}"
else
  echo "city: (manual coordinates, not resolved to a place name)"
fi
echo "latitude: ${LAT}"
echo "longitude: ${LON}"
echo
echo "=== CURRENT_WEATHER (raw JSON from Open-Meteo) ==="
echo "$WEATHER_JSON"
