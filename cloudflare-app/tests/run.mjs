import { freePort } from "./ports.mjs";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
const port = await freePort();
const runtime = ".wrangler/test-state-" + crypto.randomUUID();
mkdirSync(".wrangler", { recursive: true });
writeFileSync(".wrangler/last-test-state", runtime);
function command(args) {
  const r = spawnSync(
    process.execPath,
    ["node_modules/wrangler/bin/wrangler.js", ...args],
    {
      stdio: "inherit",
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    },
  );
  assert.equal(r.status, 0, args.join(" "));
}
command([
  "d1",
  "migrations",
  "apply",
  "sig-uhe",
  "--local",
  "--persist-to",
  runtime,
]);
const log = openSync(".wrangler/test-worker.log", "w");
const proc = spawn(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--config",
    "wrangler.toml",
    "--config",
    process.env.SIGA_TEST_CONFIG || "tests/siga-fixture/wrangler.toml",
    "--port",
    String(port),
    "--persist-to",
    runtime,
    "--show-interactive-dev-session=false",
  ],
  {
    stdio: ["ignore", log, log],
    detached: true,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  },
);
const base = `http://127.0.0.1:${port}`;
const auth = { Authorization: "Bearer manager" };
let passed = 0;
async function req(path, method = "GET", data, headers = auth) {
  const res = await fetch(base + "/api/" + path, {
    method,
    headers: {
      ...headers,
      "Content-Type":
        typeof data === "string" ? "text/csv" : "application/json",
    },
    body:
      data === undefined
        ? undefined
        : typeof data === "string"
          ? data
          : JSON.stringify(data),
  });
  let value;
  try {
    value = await res.json();
  } catch {
    value = null;
  }
  return { status: res.status, value, headers: res.headers };
}
async function check(name, fn) {
  await fn();
  passed++;
  console.log("PASS:", name);
}
try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    if (proc.exitCode != null)
      throw Error(readFileSync(".wrangler/test-worker.log", "utf8"));
    try {
      const r = await fetch(base + "/api/health");
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(500);
  }
  assert(
    ready,
    "Worker did not start: " +
      readFileSync(".wrangler/test-worker.log", "utf8"),
  );
  const suffix = crypto.randomUUID();
  let plant, reservoir, team, request, order;
  await check(
    "unauthenticated, forged identity and external SIGA profile denied",
    async () => {
      assert.equal((await req("plants", "GET", undefined, {})).status, 401);
      assert.equal(
        (
          await req("plants", "GET", undefined, {
            Authorization: "Bearer forged",
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await req("plants", "GET", undefined, {
            Authorization: "Bearer external",
          })
        ).status,
        403,
      );
    },
  );
  await check(
    "native SIGA login creates HttpOnly same-origin session, without returning token",
    async () => {
      const r = await req(
        "auth/login",
        "POST",
        { email: "gestora@example.test", password: "Fixture-Only-123" },
        {},
      );
      assert.equal(r.status, 200, JSON.stringify(r.value));
      assert(r.headers.get("set-cookie").includes("HttpOnly"));
      assert(!("token" in r.value));
      assert.equal(
        (
          await req("me", "GET", undefined, {
            Cookie: r.headers.get("set-cookie").split(";")[0],
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await req(
            "auth/login",
            "POST",
            { email: "gestora@example.test", password: "wrong" },
            {},
          )
        ).status,
        401,
      );
    },
  );
  await check("reader and cross-origin writes denied", async () => {
    assert.equal(
      (await req("plants", "POST", {}, { Authorization: "Bearer reader" }))
        .status,
      403,
    );
    assert.equal(
      (
        await req(
          "plants",
          "POST",
          {},
          { ...auth, Origin: "https://evil.test" },
        )
      ).status,
      403,
    );
  });
  await check("plants, reservoirs and teams persisted", async () => {
    let r = await req("plants", "POST", {
      code: suffix,
      name: "Canoas I",
      state: "PR",
    });
    assert.equal(r.status, 422);
    r = await req("plants", "POST", {
      code: suffix.slice(0, 12),
      name: "Canoas I",
      state: "PR",
    });
    assert.equal(r.status, 201, JSON.stringify(r.value));
    plant = r.value;
    r = await req("reservoirs", "POST", {
      plant_id: plant.id,
      name: "Reservatório de teste",
    });
    assert.equal(r.status, 201);
    reservoir = r.value;
    r = await req("teams", "POST", { name: "Equipe ambiental" });
    assert.equal(r.status, 201);
    team = r.value;
  });
  const sample = (changes = {}) => ({
    reservoir_id: reservoir.id,
    protocol: crypto.randomUUID(),
    description: "Inspeção de rampa",
    category: "Rampa",
    priority: "normal",
    latitude: -23,
    longitude: -50,
    service_seconds: 900,
    ...changes,
  });
  await check(
    "coordinates and access validation; OS blocked without access",
    async () => {
      assert.equal(
        (await req("requests", "POST", sample({ latitude: 91 }))).status,
        422,
      );
      assert.equal(
        (await req("requests", "POST", sample({ access_latitude: -23 })))
          .status,
        422,
      );
      const r = await req("requests", "POST", sample());
      assert.equal(r.status, 201);
      assert.equal(
        (
          await req("requests/" + r.value.id + "/orders", "POST", {
            idempotency_key: crypto.randomUUID(),
            base_latitude: -23,
            base_longitude: -50,
          })
        ).status,
        422,
      );
    },
  );
  await check(
    "100-row CSV is atomic and paginated, including quoted multiline text",
    async () => {
      const prefix = "CSV-" + suffix;
      const fields =
        "reservoir_id,protocol,description,category,priority,latitude,longitude,service_seconds";
      const csv =
        fields +
        "\r\n" +
        Array.from(
          { length: 100 },
          (_, i) =>
            `${reservoir.id},${prefix}-${i},"Rampa, margem\ninspeção",Rampa,normal,-23,-50,900`,
        ).join("\r\n");
      const r = await req("requests/import", "POST", csv);
      assert.equal(r.status, 201, JSON.stringify(r.value));
      assert.equal(r.value.count, 100);
      const list = await req("requests?q=" + prefix);
      assert.equal(list.value.total, 100);
      assert.equal(list.value.data.length, 50);
      assert.equal(
        (await req("requests?q=" + prefix + "&page=2")).value.data.length,
        50,
      );
      const bad =
        fields +
        `\n${reservoir.id},ATOMIC-${suffix},OK,Rampa,normal,-23,-50,900\n${reservoir.id},BAD-${suffix},NO,Rampa,normal,99,-50,900`;
      assert.equal((await req("requests/import", "POST", bad)).status, 422);
      assert.equal((await req("requests?q=ATOMIC-" + suffix)).value.total, 0);
      const dup =
        fields +
        `\n${reservoir.id},DUP-${suffix},OK,Rampa,normal,-23,-50,900\n${reservoir.id},DUP-${suffix},NO,Rampa,normal,-23,-50,900`;
      assert.equal((await req("requests/import", "POST", dup)).status, 409);
      assert.equal((await req("requests?q=DUP-" + suffix)).value.total, 0);
    },
  );
  await check(
    "OS retries and concurrent duplicate issuance produce one order",
    async () => {
      request = (
        await req(
          "requests",
          "POST",
          sample({ access_latitude: -23.01, access_longitude: -50.01 }),
        )
      ).value;
      const body = {
        idempotency_key: suffix,
        base_latitude: -23.02,
        base_longitude: -50.02,
      };
      const responses = await Promise.all([
        req("requests/" + request.id + "/orders", "POST", body),
        req("requests/" + request.id + "/orders", "POST", body),
      ]);
      for (const r of responses)
        assert.equal(r.status, 201, JSON.stringify(r.value));
      order = responses[0].value;
      assert.equal(order.id, responses[1].value.id);
      assert.equal(
        (await req("requests/" + request.id + "/orders")).value.length,
        1,
      );
      assert.equal(order.access_latitude, -23.01);
      assert.equal(
        (
          await req("requests/" + request.id + "/orders", "POST", {
            ...body,
            base_latitude: -24,
          })
        ).status,
        409,
      );
    },
  );
  await check(
    "independent OS/request state machines and justified audit",
    async () => {
      assert.equal(
        (
          await req("requests/" + request.id + "/status", "PATCH", {
            status: "completed",
            reason: "Salto inválido",
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await req("requests/" + request.id + "/status", "PATCH", {
            status: "triage",
            reason: "Triagem",
          })
        ).status,
        200,
      );
      const r = await req("orders/" + order.id + "/status", "PATCH", {
        status: "triage",
        reason: "Preparação da OS",
      });
      assert.equal(r.status, 200);
      assert.equal(
        (await req("requests/" + request.id + "/orders")).value[0].status,
        "triage",
      );
    },
  );
  await check(
    "weekly profile rejects overlaps/capacity and stale concurrent editors",
    async () => {
      const path = "teams/" + team.id + "/profile";
      const p = {
        version: 0,
        reason: "Jornada inicial",
        availability: "available",
        timezone: "America/Sao_Paulo",
        base_latitude: -23,
        base_longitude: -50,
        skills: ["drone", "environmental"],
        daily_capacity_minutes: 480,
        weekly_windows: [{ day: 1, start: "08:00", end: "17:00" }],
      };
      assert.equal(
        (await req(path, "PATCH", { ...p, daily_capacity_minutes: 600 }))
          .status,
        422,
      );
      assert.equal(
        (
          await req(path, "PATCH", {
            ...p,
            weekly_windows: [
              ...p.weekly_windows,
              { day: 1, start: "16:00", end: "18:00" },
            ],
          })
        ).status,
        422,
      );
      const results = await Promise.all([
        req(path, "PATCH", p),
        req(path, "PATCH", p),
      ]);
      assert.deepEqual(results.map((v) => v.status).sort(), [200, 409]);
      assert.equal((await req(path)).value.profile.version, 1);
      assert.equal(
        (await req(path, "PATCH", p, { Authorization: "Bearer reader" }))
          .status,
        403,
      );
    },
  );
  await check(
    "SIGA linkage enforces source access, deduplicates and excludes personal documents",
    async () => {
      const list = await req("integration/siga/processes");
      assert.equal(list.status, 200);
      assert(!JSON.stringify(list.value).includes("private@example"));
      assert(!JSON.stringify(list.value).includes("NOT-FOR-EXPORT"));
      let r = await req("requests/from-siga", "POST", {
        source_id: 999,
        reservoir_id: reservoir.id,
      });
      assert.equal(r.status, 404);
      r = await req("requests/from-siga", "POST", {
        source_id: 7,
        reservoir_id: reservoir.id,
      });
      assert.equal(r.status, 201, JSON.stringify(r.value));
      assert.equal(r.value.source_protocol, "CCU-0007");
      assert.equal(
        (
          await req("requests/from-siga", "POST", {
            source_id: 7,
            reservoir_id: reservoir.id,
          })
        ).status,
        409,
      );
    },
  );
  await check("persistent audit, aggregates and literal search", async () => {
    const events = await req("audit");
    assert(events.value.total > 100);
    assert(events.value.data.some((v) => v.action === "team.profile_updated"));
    assert((await req("overview")).value.orders >= 1);
    assert.equal((await req("requests?q=%25")).value.total, 0);
  });
  await check("login rate limit enforced", async () => {
    let res;
    for (let i = 0; i < 8; i++)
      res = await req(
        "auth/login",
        "POST",
        { email: "gestora@example.test", password: "wrong" },
        {},
      );
    assert.equal(res.status, 429);
  });
  console.log(
    `${passed} integration groups passed against local Workers + D1. Production SIGA not contacted.`,
  );
} finally {
  try {
    process.kill(-proc.pid, "SIGTERM");
  } catch {}
}
