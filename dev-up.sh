#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BACKEND_DIR="$ROOT_DIR/../osiris-inventario-be"
BACKEND_SCRIPT="$BACKEND_DIR/dev-up.sh"

if [ ! -f "$BACKEND_SCRIPT" ]; then
  echo "No se encontro $BACKEND_SCRIPT"
  exit 1
fi

exec "$BACKEND_SCRIPT" "$@"
