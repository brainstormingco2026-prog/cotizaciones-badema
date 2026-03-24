#!/bin/bash
# log_horas_diario.sh
# Agrega automáticamente las horas del día anterior a HORAS.md
# Se ejecuta todos los días a las 8 AM (hora Argentina)

PROJECT_DIR="/Users/desiree/CRM - Juampi"
HORAS_FILE="$PROJECT_DIR/HORAS.md"
LOG_FILE="$PROJECT_DIR/scripts/log_horas_diario.log"

cd "$PROJECT_DIR" || exit 1

# Fecha de ayer en formato YYYY-MM-DD
YESTERDAY=$(date -v-1d "+%Y-%m-%d")

# Commits de ayer
COMMITS=$(git log --after="$YESTERDAY 00:00:00" --before="$YESTERDAY 23:59:59" --format="%H %ad %s" --date=format:"%H:%M" 2>/dev/null)

if [ -z "$COMMITS" ]; then
  echo "[$YESTERDAY $(date '+%H:%M')] Sin commits ayer — no se agrega entrada." >> "$LOG_FILE"
  exit 0
fi

# Calcular rango horario del día (primer y último commit)
FIRST_TIME=$(git log --after="$YESTERDAY 00:00:00" --before="$YESTERDAY 23:59:59" --format="%ad" --date=format:"%H:%M" 2>/dev/null | tail -1)
LAST_TIME=$(git log  --after="$YESTERDAY 00:00:00" --before="$YESTERDAY 23:59:59" --format="%ad" --date=format:"%H:%M" 2>/dev/null | head -1)
COMMIT_COUNT=$(echo "$COMMITS" | wc -l | tr -d ' ')

# Calcular horas: diferencia entre primer y último commit + 30 min por commit (mínimo 1 hora)
FIRST_H=$(echo "$FIRST_TIME" | cut -d: -f1 | sed 's/^0//')
FIRST_M=$(echo "$FIRST_TIME" | cut -d: -f2 | sed 's/^0//')
LAST_H=$(echo "$LAST_TIME"  | cut -d: -f1 | sed 's/^0//')
LAST_M=$(echo "$LAST_TIME"  | cut -d: -f2 | sed 's/^0//')

FIRST_MIN=$(( ${FIRST_H:-0} * 60 + ${FIRST_M:-0} ))
LAST_MIN=$(( ${LAST_H:-0}  * 60 + ${LAST_M:-0}  ))
DIFF_MIN=$(( LAST_MIN - FIRST_MIN + 30 ))
HOURS=$(( DIFF_MIN / 60 ))
[ "$HOURS" -lt 1 ] && HOURS=1

# Descripción: lista de mensajes de commits de ayer
DESCRIPTIONS=$(git log --after="$YESTERDAY 00:00:00" --before="$YESTERDAY 23:59:59" --format="%s" 2>/dev/null | paste -sd "; " -)

# Verificar que la fecha no esté ya registrada
if grep -q "| $YESTERDAY |" "$HORAS_FILE"; then
  echo "[$YESTERDAY $(date '+%H:%M')] Entrada ya existe — no se duplica." >> "$LOG_FILE"
  exit 0
fi

# Actualizar total en el resumen
CURRENT_TOTAL=$(grep "^\*\*Total horas\*\*" "$HORAS_FILE" | grep -o '[0-9]*' | head -1)
NEW_TOTAL=$(( ${CURRENT_TOTAL:-0} + HOURS ))

# Insertar nueva fila antes de la fila "TOTAL" en la tabla
NEW_ROW="| $YESTERDAY | $HOURS | $DESCRIPTIONS |"
sed -i '' "s/| \*\*TOTAL\*\* |/| $NEW_ROW\n| **TOTAL** |/" "$HORAS_FILE"

# Actualizar total
sed -i '' "s/| \*\*TOTAL\*\* | [0-9]* |/| **TOTAL** | $NEW_TOTAL |/" "$HORAS_FILE"

# Actualizar "Última actualización"
sed -i '' "s/| Última actualización .*/| Última actualización | $YESTERDAY |/" "$HORAS_FILE"

# Actualizar total en resumen
sed -i '' "s/| \*\*Total horas\*\* .*/| **Total horas** | **~$NEW_TOTAL hs** |/" "$HORAS_FILE"

echo "[$YESTERDAY $(date '+%H:%M')] Entrada agregada: $HOURS hs — $COMMIT_COUNT commits — $DESCRIPTIONS" >> "$LOG_FILE"
