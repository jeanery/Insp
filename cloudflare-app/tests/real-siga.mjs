import { freePort } from "./ports.mjs";
// Optional compatibility test against the original source supplied by the user; no production calls.
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  openSync,
} from "node:fs";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import assert from "node:assert/strict";
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const source = process.argv[2];
if (!source) throw Error("Pass the extracted SIGA-CCU source folder.");
const root = resolve(".wrangler/real-siga-" + crypto.randomUUID());
mkdirSync(root + "/cloudflare/migrations", { recursive: true });
mkdirSync(root + "/server");
for (const file of [
  "cloudflare/worker.ts",
  "server/constants.ts",
  "cloudflare/migrations/0001_initial.sql",
  "cloudflare/migrations/0002_operational_modules.sql",
  "cloudflare/migrations/0003_auth_and_privacy.sql",
])
  copyFileSync(resolve(source, file), root + "/" + file);
const config = root + "/wrangler.json";
writeFileSync(
  config,
  JSON.stringify({
    name: "siga-ccu",
    main: "cloudflare/worker.ts",
    compatibility_date: "2026-10-14",
    d1_databases: [
      {
        binding: "DB",
        database_name: "siga-compat",
        database_id: "00000000-0000-0000-0000-000000000001",
        migrations_dir: "cloudflare/migrations",
      },
    ],
    r2_buckets: [{ binding: "UPLOADS", bucket_name: "siga-compat-private" }],
  }),
);
writeFileSync(
  root + "/.dev.vars",
  "AUTH_SECRET=" + randomBytes(32).toString("hex") + "\n",
  { mode: 0o600 },
);
const password = randomBytes(18).toString("hex") + "A1";
const hash = await bcrypt.hash(password, 10);
const seed = root + "/seed.sql";
writeFileSync(
  seed,
  `INSERT INTO users(id,name,email,password_hash,role) VALUES (1,'Gestora sintética','gestora@example.test','${hash}','supervisor_inspecao'),(2,'Inspetor sintético','inspetor@example.test','${hash}','inspetor_vistoriador'),(3,'Solicitante sintético','externo@example.test','${hash}','solicitante');`,
  { mode: 0o600 },
);
const state = root + "/state",
  log = openSync(root + "/runtime.log", "w");
function command(args) {
  const p = spawnSync(
    process.execPath,
    ["node_modules/wrangler/bin/wrangler.js", ...args],
    {
      stdio: ["ignore", log, log],
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    },
  );
  assert.equal(
    p.status,
    0,
    "Compatibility setup failed; inspect the private runtime log.",
  );
}
command([
  "d1",
  "migrations",
  "apply",
  "sig-uhe",
  "--local",
  "--persist-to",
  state,
]);
command([
  "d1",
  "migrations",
  "apply",
  "siga-compat",
  "--config",
  config,
  "--local",
  "--persist-to",
  state,
]);
command([
  "d1",
  "execute",
  "siga-compat",
  "--config",
  config,
  "--local",
  "--persist-to",
  state,
  "--file",
  seed,
]);
const proc = spawn(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--config",
    "wrangler.toml",
    "--config",
    config,
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
  assert(ready, "Original SIGA Worker did not start; inspect runtime.log.");
  const login = async (email) => {
    const res = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return {
      status: res.status,
      data: await res.json(),
      cookie: res.headers.get("set-cookie")?.split(";")[0],
    };
  };
  const manager = await login("gestora@example.test");
  assert.equal(manager.status, 200, JSON.stringify(manager.data));
  assert.equal(manager.data.user.role, "supervisor_inspecao");
  assert(!("token" in manager.data));
  const me = await fetch(base + "/api/me", {
    headers: { Cookie: manager.cookie },
  });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.id, 1);
  const reader = await login("inspetor@example.test");
  assert.equal(reader.status, 200);
  const denied = await fetch(base + "/api/teams", {
    method: "POST",
    headers: { Cookie: reader.cookie, "Content-Type": "application/json" },
    body: '{"name":"Forbidden"}',
  });
  assert.equal(denied.status, 403);
  assert.equal((await login("externo@example.test")).status, 403);
  const allowed = await fetch(base + "/api/teams", {
    method: "POST",
    headers: { Cookie: manager.cookie, "Content-Type": "application/json" },
    body: '{"name":"Equipe original SIGA"}',
  });
  assert.equal(allowed.status, 201);
  console.log(
    "PASS: original uploaded SIGA Worker, original D1 migrations, bcrypt login, signed session, live /api/me, reader/external denials and authorized SIG-UHE write. No production data used.",
  );
} finally {
  try {
    process.kill(-proc.pid, "SIGTERM");
  } catch {}
}
