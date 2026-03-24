#!/bin/bash
# post-commit-horas.sh
# Actualiza HORAS.md con las horas del día actual cada vez que se hace un commit.
# Instalado como symlink en .git/hooks/post-commit

PROJECT_DIR="/Users/desiree/CRM - Juampi"
HORAS_FILE="$PROJECT_DIR/HORAS.md"

cd "$PROJECT_DIR" || exit 0

TODAY=$(date "+%Y-%m-%d")

# Commits de hoy
COMMIT_COUNT=$(git log --after="${TODAY} 00:00:00" --format="%H" 2>/dev/null | wc -l | tr -d ' ')
[ "$COMMIT_COUNT" -eq 0 ] && exit 0

# Rango horario de hoy (primer y último commit)
FIRST_TIME=$(git log --after="${TODAY} 00:00:00" --format="%ad" --date=format:"%H:%M" 2>/dev/null | tail -1)
LAST_TIME=$(git  log --after="${TODAY} 00:00:00" --format="%ad" --date=format:"%H:%M" 2>/dev/null | head -1)

to_min() { echo $(( 10#${1%%:*} * 60 + 10#${1##*:} )); }
DIFF_MIN=$(( $(to_min "$LAST_TIME") - $(to_min "$FIRST_TIME") + 30 ))
HOURS=$(( DIFF_MIN / 60 ))
[ "$HOURS" -lt 1 ] && HOURS=1

# Descripción: mensajes de commits de hoy
DESCRIPTIONS=$(git log --after="${TODAY} 00:00:00" --format="%s" 2>/dev/null | paste -sd "; " -)

# Actualizar HORAS.md via Python (evita conflictos de | en sed)
python3 - "$HORAS_FILE" "$TODAY" "$HOURS" "$DESCRIPTIONS" <<'PYEOF'
import sys, re

filepath, today, hours_str, desc = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
hours = int(hours_str)

with open(filepath, "r") as f:
    content = f.read()

row_pattern = re.compile(r"^\| " + re.escape(today) + r" \| \d+ \|.*$", re.MULTILINE)
total_row_pattern = re.compile(r"^\| \*\*TOTAL\*\* \| \*\*(\d+)\*\* \|.*$", re.MULTILINE)
summary_pattern = re.compile(r"(\| \*\*Total horas\*\* \| \*\*~)\d+( hs\*\* \|)")
date_pattern = re.compile(r"(\| Última actualización \| )\S+( \|)")

# Calcular nuevo total
total_match = total_row_pattern.search(content)
current_total = int(total_match.group(1)) if total_match else 0

if row_pattern.search(content):
    # Actualizar fila existente: calcular diferencia de horas
    old_match = re.search(r"^\| " + re.escape(today) + r" \| (\d+) \|", content, re.MULTILINE)
    old_hours = int(old_match.group(1)) if old_match else 0
    new_total = current_total - old_hours + hours
    new_row = f"| {today} | {hours} | {desc} |"
    content = row_pattern.sub(new_row, content)
else:
    # Insertar nueva fila antes de TOTAL
    new_total = current_total + hours
    new_row = f"| {today} | {hours} | {desc} |"
    content = total_row_pattern.sub(new_row + "\n" + total_match.group(0), content)

# Actualizar fila TOTAL
content = total_row_pattern.sub(f"| **TOTAL** | **{new_total}** | |", content)

# Actualizar resumen
content = summary_pattern.sub(r"\g<1>" + str(new_total) + r"\g<2>", content)
content = date_pattern.sub(r"\g<1>" + today + r"\g<2>", content)

with open(filepath, "w") as f:
    f.write(content)

print(f"[{today}] HORAS.md actualizado: {hours} hs, total {new_total} hs")
PYEOF
