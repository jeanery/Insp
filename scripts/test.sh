#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose exec -T api php tests/seed.php
python tests/functional.py
docker compose exec -T api php tests/storage.php
docker compose exec -T api php tests/migration.php
docker compose exec -T api php tests/queue.php
