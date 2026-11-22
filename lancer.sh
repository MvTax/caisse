#!/bin/sh
# Lance le testeur d'impression (macOS / Linux).
cd "$(dirname "$0")" || exit 1
exec python3 serveur.py "$@"
