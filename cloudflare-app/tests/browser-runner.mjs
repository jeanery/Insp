import { freePort } from "./ports.mjs";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const state = ".wrangler/browser-" + crypto.randomUUID();
mkdirSync(".wrangler", { recursive: true });
const log = openSync(".wrangler/browser.log", "w");
const migration = spawnSync(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "d1",
    "migrations",
    "apply",
    "sig-uhe",
    "--local",
    "--persist-to",
    state,
  ],
  { stdio: ["ignore", log, log] },
);
assert.equal(migration.status, 0);
const p = spawn(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--config",
    "wrangler.toml",
    "--config",
    "tests/siga-fixture/wrangler.toml",
    "--port",
    String(port),
    "--persist-to",
    state,
    "--show-interactive-dev-session=false",
  ],
  {
    stdio: ["ignore", log, log],
    detached: true,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  },
);
try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(500);
  }
  assert(ready, "Browser worker did not start");
  const test = spawnSync(process.env.PYTHON || "python", ["tests/browser.py"], {
    stdio: "inherit",
    env: { ...process.env, SIG_UHE_TEST_ORIGIN: base },
  });
  if (test.error) throw test.error;
  assert.notEqual(
    test.status,
    null,
    "Browser runner terminated without a result",
  );
  process.exitCode = test.status;
} finally {
  try {
    process.kill(-p.pid, "SIGTERM");
  } catch {}
}
