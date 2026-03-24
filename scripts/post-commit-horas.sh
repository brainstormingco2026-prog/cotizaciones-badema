#!/bin/bash
# post-commit-horas.sh
# Actualiza HORAS.md con las horas del día actual cada vez que se hace un commit.
# Instalación: ln -sf "$(pwd)/scripts/post-commit-horas.sh" "$(pwd)/.git/hooks/post-commit"

PROJECT_DIR="/Users/desiree/CRM - Juampi"
HORAS_FILE="$PROJECT_DIR/HORAS.md"

cd "$PROJECT_DIR" || exit 0

TODAY=$(date "+%Y-%m-%d")

# Commits de hoy
COMMIT_COUNT=$(git log --after="$TODAY 00:00:00" --format="%H" 2>/dev/null | wc -l | tr -d ' ')

[ "$COMMIT_COUNT" -eq 0 ] && exit 0

# Rango horario de hoy
FIRST_TIME=$(git log --after="$TODAY 00:00:00" --format="%ad" --date=format:"%H:%M" 2>/dev/null | tail -1)
LAST_TIME=$(git log  --after="$TODAY 00:00:00" --format="%ad" --date=format:"%H:%M" 2>/dev/null | head -1)

FIRST_H=$(echo "$FIRST_TIME" | cut -d: -f1 | sed 's/^0*/0/' | bc 2>/dev/null || echo 0)
FIRST_M=$(echo "$FIRST_TIME" | cut -d: -f2 | sed 's/^0*/0/' | bc 2>/dev/null || echo 0)
LAST_H=$(echo "$LAST_TIME"   | cut -d: -f1 | sed 's/^0*/0/' | bc 2>/dev/null || echo 0)
LAST_M=$(echo "$LAST_TIME"   | cut -d: -f2 | sed 's/^0*/0/' | bc 2>/dev/null || echo 0)

DIFF_MIN=$(( (LAST_H * 60 + LAST_M) - (FIRST_H * 60 + FIRST_M) + 30 ))
HOURS=$(( DIFF_MIN / 60 ))
[ "$HOURS" -lt 1 ] && HOURS=1

# Descripción: todos los mensajes de commits de hoy
DESCRIPTIONS=$(git log --after="$TODAY 00:00:00" --format="%s" 2>/dev/null | paste -sd "; " -)

# Si ya existe entrada para hoy → actualizarla
if grep -q "| $TODAY |" "$HORAS_FILE"; then
  # Obtener horas anteriores para recalcular el total
  OLD_HOURS=$(grep "| $TODAY |" "$HORAS_FILE" | grep -o '| [0-9]* |' | grep -o '[0-9]*')
  DIFF=$(( HOURS - ${OLD_HOURS:-0} ))

  # Reemplazar fila existente
  sed -i '' "s|| $TODAY | [0-9]* |.*||| $TODAY | $HOURS | $DESCRIPTIONS ||" "$HORAS_FILE"

  # Actualizar total
  CURRENT_TOTAL=$(grep "^\*\*Total horas\*\*" "$HORAS_FILE" | grep -o '[0-9]*' | head -1)
  NEW_TOTAL=$(( ${CURRENT_TOTAL:-0} + DIFF ))
else
  # Insertar nueva fila antes de la fila TOTAL
  NEW_ROW="| $TODAY | $HOURS | $DESCRIPTIONS |"
  sed -i '' "/| \*\*TOTAL\*\* |/i\\
$NEW_ROW
" "$HORAS_FILE"

  # Recalcular total
  CURRENT_TOTAL=$(grep "^\*\*Total horas\*\*" "$HORAS_FILE" | grep -o '[0-9]*' | head -1)
  NEW_TOTAL=$(( ${CURRENT_TOTAL:-0} + HOURS ))
fi

# Actualizar total en tabla y resumen
sed -i '' "s/| \*\*TOTAL\*\* | [0-9]* |/| **TOTAL** | $NEW_TOTAL |/" "$HORAS_FILE"
sed -i '' "s/| \*\*Total horas\*\* .*/| **Total horas** | **~$NEW_TOTAL hs** |/" "$HORAS_FILE"
sed -i '' "s/| Última actualización .*/| Última actualización | $TODAY |/" "$HORAS_FILE"
