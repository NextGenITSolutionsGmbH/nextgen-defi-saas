#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Configuration ---
THRESHOLD=80
SPEC_PATTERN='FR-[0-9][0-9]-[0-9][0-9]|US-[0-9][0-9][0-9]|NFR-[A-Z][0-9][0-9]|EP-[0-9][0-9]'

# --- Collect test files (exclude node_modules, .pnpm, dist) ---
mapfile -t TEST_FILES < <(
  find "$PROJECT_ROOT" \
    -path '*/node_modules' -prune -o \
    -path '*/dist' -prune -o \
    -path '*/.next' -prune -o \
    -path '*/.claude' -prune -o \
    \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' -o -name '*.spec.tsx' \) \
    -print | sort
)

TOTAL=${#TEST_FILES[@]}

if [ "$TOTAL" -eq 0 ]; then
  echo "[spec-refs] No test files found."
  exit 0
fi

# --- Scan for spec references ---
WITH_REFS=()
WITHOUT_REFS=()

for FILE in "${TEST_FILES[@]}"; do
  REL_PATH="${FILE#"$PROJECT_ROOT"/}"
  if grep -qE "$SPEC_PATTERN" "$FILE" 2>/dev/null; then
    WITH_REFS+=("$REL_PATH")
  else
    WITHOUT_REFS+=("$REL_PATH")
  fi
done

COVERED=${#WITH_REFS[@]}
MISSING=${#WITHOUT_REFS[@]}

if [ "$TOTAL" -gt 0 ]; then
  PERCENT=$(( COVERED * 100 / TOTAL ))
else
  PERCENT=0
fi

# --- Report ---
echo ""
echo "========================================="
echo "  Spec Reference Coverage Report"
echo "========================================="
echo ""

if [ "$COVERED" -gt 0 ]; then
  echo "Files WITH spec references ($COVERED):"
  for F in "${WITH_REFS[@]}"; do
    # Extract the matched requirement IDs
    REFS=$(grep -oE "$SPEC_PATTERN" "$PROJECT_ROOT/$F" 2>/dev/null | sort -u | tr '\n' ' ')
    echo "  + $F  [$REFS]"
  done
  echo ""
fi

if [ "$MISSING" -gt 0 ]; then
  echo "Files WITHOUT spec references ($MISSING):"
  for F in "${WITHOUT_REFS[@]}"; do
    echo "  - $F"
  done
  echo ""
fi

echo "-----------------------------------------"
echo "  Coverage: $COVERED of $TOTAL test files ($PERCENT%)"
echo "  Threshold: ${THRESHOLD}%"
echo "-----------------------------------------"

# --- Exit with advisory warning if below threshold ---
if [ "$PERCENT" -lt "$THRESHOLD" ]; then
  echo ""
  echo "WARNING: Spec reference coverage ($PERCENT%) is below ${THRESHOLD}% threshold."
  echo "Consider adding requirement IDs (FR-XX-XX, US-XXX, NFR-AXX, EP-XX) to test descriptions."
  echo ""
  # Exit 0 — this is advisory, not blocking
  exit 0
fi

echo ""
echo "Spec reference coverage meets the ${THRESHOLD}% threshold."
exit 0
