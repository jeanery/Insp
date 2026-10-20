#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python scripts/setup.py
python scripts/setup_console.py
docker compose up -d --wait database cache api worker web
