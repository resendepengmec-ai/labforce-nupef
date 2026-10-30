#!/usr/bin/env bash
# narrar.sh - gera a narracao com a Runway (TTS) e junta ao video.
# Requisitos no seu computador: uv, ffmpeg, o plugin/skill rw-generate-audio
# e a chave em RUNWAYML_API_SECRET (nunca no repositorio).
#   export RUNWAYML_API_SECRET=...      (PowerShell: $env:RUNWAYML_API_SECRET="...")
#   bash ferramentas/video/narrar.sh /caminho/para/skills/rw-generate-audio  [VOZ]
set -euo pipefail
SKILL="${1:?informe a pasta da skill rw-generate-audio}"; VOZ="${2:-Maya}"
DIR="$(cd "$(dirname "$0")" && pwd)"; RAIZ="$DIR/../.."; OUT="$DIR/narracao"; mkdir -p "$OUT"
: "${RUNWAYML_API_SECRET:?defina RUNWAYML_API_SECRET}"
i=0; entradas=(); filtros=""; mix=""
while IFS=$'\t' read -r ini txt; do
  [ "$ini" = "inicio_s" ] && continue
  f="$OUT/trecho_$(printf %02d $i).mp3"
  [ -s "$f" ] || uv run "$SKILL/scripts/generate_audio.py" --type tts --voice-id "$VOZ" --text "$txt" --filename "$(basename "$f")" --output-dir "$OUT"
  # avisa se o trecho passar do inicio do proximo
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"); echo "trecho $i: inicio $ini s, duracao $d s"
  entradas+=(-i "$f"); ms=$(python3 -c "print(int(float('$ini')*1000))")
  filtros+="[$((i+1)):a]adelay=${ms}|${ms}[a$i];"; mix+="[a$i]"; i=$((i+1))
done < "$DIR/narracao.tsv"
ffmpeg -y -i "$RAIZ/assets/apresentacao.mp4" "${entradas[@]}" \
  -filter_complex "${filtros}${mix}amix=inputs=$i:normalize=0,apad[a]" -map 0:v -map "[a]" \
  -c:v copy -c:a aac -b:a 128k -shortest -movflags +faststart "$DIR/apresentacao_narrada.mp4"
echo "Pronto: $DIR/apresentacao_narrada.mp4 (confira e copie para assets/apresentacao.mp4)"
