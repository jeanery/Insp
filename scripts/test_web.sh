#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose exec -T api php tests/seed.php
if python -c 'import playwright.sync_api' >/dev/null 2>&1; then
    python tests/browser.py
else
    python -m venv .runtime/browser-venv
    .runtime/browser-venv/bin/pip install -r requirements-dev.txt
    .runtime/browser-venv/bin/python tests/browser.py
fi
