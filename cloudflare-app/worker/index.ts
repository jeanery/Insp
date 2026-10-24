import { z } from "zod";
export interface Env {
  DB: D1Database;
  SIGA: Fetcher;
  ASSETS: Fetcher;
}
type User = { id: number; name: string; email: string; role: string };
const writers = new Set([
  "supervisor_inspecao",
  "supervisor_cessao",
  "coordenador",
  "gerente",
  "diretor",
]);
const readers = new Set([
  ...writers,
  "analista_fundiario",
  "analista_respeitabilidade",
  "analista_area",
  "inspetor_vistoriador",
]);
const statuses = [
  "open",
  "triage",
  "awaiting_schedule",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;
const transitions: Record<string, string[]> = {
  open: ["triage", "cancelled"],
  triage: ["awaiting_schedule", "cancelled"],
  awaiting_schedule: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "awaiting_schedule", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
const text = (max = 160) => z.string().trim().min(1).max(max);
const lat = z.number().min(-90).max(90),
  lng = z.number().min(-180).max(180);
const reqSchema = z
  .object({
    reservoir_id: z.uuid(),
    protocol: text(80),
    description: text(5000),
    category: text(80),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    latitude: lat,
    longitude: lng,
    access_latitude: lat.nullable().optional(),
    access_longitude: lng.nullable().optional(),
    service_seconds: z.number().int().min(60).max(86400),
  })
  .refine((v) => (v.access_latitude == null) === (v.access_longitude == null), {
    message: "Informe as duas coordenadas de acesso ou deixe ambas vazias.",
  });
const profileSchema = z
  .object({
    version: z.number().int().nonnegative(),
    reason: text(2000),
    availability: z.enum(["available", "unavailable"]),
    timezone: text(64).refine(
      (v) => {
        try {
          new Intl.DateTimeFormat("pt-BR", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      },
      { message: "Fuso horário inválido." },
    ),
    base_latitude: lat,
    base_longitude: lng,
    skills: z
      .array(
        z.enum([
          "land",
          "environmental",
          "engineering",
          "nautical",
          "tagging",
          "drone",
        ]),
      )
      .max(6)
      .refine((v) => new Set(v).size === v.length),
    daily_capacity_minutes: z.number().int().min(1).max(1440),
    weekly_windows: z
      .array(
        z.object({
          day: z.number().int().min(1).max(7),
          start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        }),
      )
      .max(28),
  })
  .superRefine((v, c) => {
    const days = new Map<number, typeof v.weekly_windows>();
    for (const w of v.weekly_windows) {
      if (w.start >= w.end)
        c.addIssue({
          code: "custom",
          message: "O fim deve ser posterior ao início no mesmo dia.",
        });
      days.set(w.day, [...(days.get(w.day) || []), w]);
    }
    if (v.availability === "available" && !days.size)
      c.addIssue({
        code: "custom",
        message: "Equipe disponível precisa de jornada.",
      });
    const mins = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
    for (const windows of days.values()) {
      windows.sort((a, b) => a.start.localeCompare(b.start));
      let end = "";
      let total = 0;
      for (const w of windows) {
        if (w.start < end)
          c.addIssue({ code: "custom", message: "Jornadas sobrepostas." });
        end = w.end;
        total += mins(w.end) - mins(w.start);
      }
      if (total < v.daily_capacity_minutes)
        c.addIssue({
          code: "custom",
          message: "Capacidade maior que a jornada diária.",
        });
    }
  });
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function fail(status: number, message: string): never {
  throw new ApiError(status, message);
}
function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
const now = () => new Date().toISOString();
async function hash(value: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
async function input(r: Request) {
  if (Number(r.headers.get("content-length") || 0) > 2 * 1024 * 1024)
    fail(413, "Arquivo maior que 2 MiB.");
  const s = await r.text();
  if (new TextEncoder().encode(s).length > 2 * 1024 * 1024)
    fail(413, "Arquivo maior que 2 MiB.");
  try {
    return JSON.parse(s);
  } catch {
    fail(400, "JSON inválido.");
  }
}
function token(r: Request) {
  return (
    r.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ||
    r.headers
      .get("Cookie")
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("sig_uhe_session="))
      ?.slice(16) ||
    ""
  );
}
function cookie(r: Request, t: string, age = 28800) {
  return `sig_uhe_session=${t}; HttpOnly; ${new URL(r.url).protocol === "https:" ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=${age}`;
}
async function siga(
  env: Env,
  path: string,
  t: string,
  options: RequestInit = {},
) {
  if (!env.SIGA) fail(503, "Vincule o Worker SIGA-CCU para autenticar.");
  try {
    return await env.SIGA.fetch(
      new Request("https://siga.internal" + path, {
        ...options,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(t ? { Authorization: "Bearer " + t } : {}),
        },
        redirect: "manual",
      }),
    );
  } catch {
    fail(503, "SIGA-CCU indisponível. Tente novamente.");
  }
}
async function identity(env: Env, t: string) {
  if (!t) fail(401, "Entre com sua conta SIGA-CCU.");
  const res = await siga(env, "/api/me", t);
  if (res.status === 401) fail(401, "Sessão expirada. Entre novamente.");
  if (!res.ok) fail(503, "Não foi possível validar a sessão no SIGA-CCU.");
  const { user } = await res.json<{ user: User }>();
  if (!user || !Number.isSafeInteger(user.id) || !readers.has(user.role))
    fail(403, "Seu perfil não possui acesso operacional ao SIG-UHE.");
  return user;
}
function audit(
  env: Env,
  u: User,
  action: string,
  id: string,
  details: unknown = {},
  conditional = false,
) {
  const values = [
    crypto.randomUUID(),
    u.id,
    u.name,
    action,
    id,
    JSON.stringify(details),
    now(),
  ];
  return env.DB.prepare(
    `INSERT INTO audit_events(id,actor_id,actor_name,action,subject_id,details_json,created_at) SELECT ?,?,?,?,?,?,? ${conditional ? "WHERE changes()=1" : ""}`,
  ).bind(...values);
}
async function row(
  env: Env,
  table: "plants" | "reservoirs" | "teams" | "requests" | "orders",
  id: string,
) {
  return (
    (await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`)
      .bind(id)
      .first<Record<string, any>>()) || fail(404, "Registro não encontrado.")
  );
}
async function page(
  env: Env,
  table:
    "plants" | "reservoirs" | "teams" | "requests" | "orders" | "audit_events",
  url: URL,
) {
  const n = z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .parse(url.searchParams.get("page") || 1);
  let where = "";
  const params: any[] = [];
  if (table === "requests") {
    const q = (url.searchParams.get("q") || "").slice(0, 100);
    const status = url.searchParams.get("status");
    if (q) {
      where =
        " WHERE (protocol LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')";
      const term = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
      params.push(term, term);
    }
    if (status) {
      z.enum(statuses).parse(status);
      where += (where ? " AND " : " WHERE ") + "status=?";
      params.push(status);
    }
  }
  const total = Number(
    (
      await env.DB.prepare(`SELECT COUNT(*) n FROM ${table}${where}`)
        .bind(...params)
        .first<{ n: number }>()
    )?.n || 0,
  );
  const { results } = await env.DB.prepare(
    `SELECT * FROM ${table}${where} ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET ?`,
  )
    .bind(...params, (n - 1) * 50)
    .all<Record<string, any>>();
  if (table === "teams")
    results.forEach(
      (v) =>
        (v.operational_profile = v.profile_json
          ? { ...JSON.parse(v.profile_json), version: v.version }
          : null),
    );
  return json({
    data: results,
    total,
    current_page: n,
    last_page: Math.max(1, Math.ceil(total / 50)),
  });
}
export function parseCsv(value: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  value = value.replace(/^\uFEFF/, "");
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '"') {
      if (quoted && value[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell) fail(422, "CSV inválido.");
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && value[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) fail(422, "Aspas não fechadas no CSV.");
  row.push(cell);
  if (row.some((v) => v !== "")) rows.push(row);
  const headers = rows.shift() || [];
  if (!headers.length || new Set(headers).size !== headers.length)
    fail(422, "Cabeçalho CSV inválido.");
  if (rows.length < 1 || rows.length > 100)
    fail(422, "Envie entre 1 e 100 linhas.");
  return rows.map((r, i) => {
    if (r.length !== headers.length)
      fail(422, `Linha ${i + 2}: colunas inconsistentes.`);
    return Object.fromEntries(headers.map((h, j) => [h.trim(), r[j]]));
  });
}
function requestInsert(
  env: Env,
  data: z.infer<typeof reqSchema>,
  id: string,
  sourceId: number | null = null,
  sourceProtocol: string | null = null,
) {
  return env.DB.prepare(
    "INSERT INTO requests(id,reservoir_id,protocol,description,category,priority,latitude,longitude,access_latitude,access_longitude,service_seconds,source_siga_id,source_protocol,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  ).bind(
    id,
    data.reservoir_id,
    data.protocol,
    data.description,
    data.category,
    data.priority,
    data.latitude,
    data.longitude,
    data.access_latitude ?? null,
    data.access_longitude ?? null,
    data.service_seconds,
    sourceId,
    sourceProtocol,
    now(),
    now(),
  );
}
async function createRequests(env: Env, u: User, items: unknown[]) {
  const data = items.map((v) => reqSchema.parse(v));
  const reservoirs = await env.DB.prepare("SELECT id FROM reservoirs").all<{
    id: string;
  }>();
  const ids = new Set(reservoirs.results.map((v) => v.id));
  for (const v of data)
    if (!ids.has(v.reservoir_id)) fail(404, "Reservatório não encontrado.");
  const output = data.map((v) => ({ ...v, id: crypto.randomUUID() }));
  // Set-based inserts keep a 100-row import at two SQL statements, atomically.
  const timestamp = now();
  const encoded = JSON.stringify(
    output.map((v) => ({ ...v, audit_id: crypto.randomUUID() })),
  );
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO requests(id,reservoir_id,protocol,description,category,priority,latitude,longitude,access_latitude,access_longitude,service_seconds,created_at,updated_at)
      SELECT json_extract(value,'$.id'),json_extract(value,'$.reservoir_id'),json_extract(value,'$.protocol'),json_extract(value,'$.description'),json_extract(value,'$.category'),json_extract(value,'$.priority'),json_extract(value,'$.latitude'),json_extract(value,'$.longitude'),json_extract(value,'$.access_latitude'),json_extract(value,'$.access_longitude'),json_extract(value,'$.service_seconds'),?,? FROM json_each(?)`,
    ).bind(timestamp, timestamp, encoded),
    env.DB.prepare(
      `INSERT INTO audit_events(id,actor_id,actor_name,action,subject_id,details_json,created_at)
      SELECT json_extract(value,'$.audit_id'),?,?,'request.created',json_extract(value,'$.id'),'{}',? FROM json_each(?)`,
    ).bind(u.id, u.name, timestamp, encoded),
  ]);
  return output;
}
function sourceSummary(p: Record<string, any>) {
  return {
    id: p.id,
    protocol: p.protocol_number,
    reservoir: p.reservoir,
    municipality: p.municipality,
    latitude: p.latitude,
    longitude: p.longitude,
    description:
      p.intervention_description ||
      p.purpose ||
      "Inspeção vinculada ao SIGA-CCU",
  };
}
async function api(r: Request, env: Env, url: URL) {
  const path = url.pathname,
    method = r.method,
    t = token(r);
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const origin = r.headers.get("Origin");
    if (origin && origin !== url.origin) fail(403, "Origem não autorizada.");
  }
  if (path === "/api/health") {
    await env.DB.prepare("SELECT 1").first();
    return json({
      ok: true,
      runtime: "cloudflare-workers",
      identity: "siga-ccu",
      routing: false,
    });
  }
  if (path === "/api/auth/logout" && method === "POST")
    return json({ ok: true }, 200, { "Set-Cookie": cookie(r, "", 0) });
  if (path === "/api/auth/login" && method === "POST") {
    const payload = z
      .object({ email: text(254), password: z.string().min(1).max(1024) })
      .parse(await input(r));
    const key = await hash(r.headers.get("CF-Connecting-IP") || "local");
    const ts = Date.now();
    const rate = await env.DB.prepare(
      "INSERT INTO login_attempts(key,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END RETURNING attempts",
    )
      .bind(key, ts + 900000, ts, ts)
      .first<{ attempts: number }>();
    if ((rate?.attempts || 0) > 8)
      return json({ message: "Muitas tentativas. Aguarde 15 minutos." }, 429, {
        "Retry-After": "900",
      });
    const res = await siga(env, "/api/auth/login", "", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res.status === 401 || res.status === 400)
      fail(401, "E-mail ou senha inválidos.");
    if (!res.ok) fail(503, "Login SIGA-CCU indisponível.");
    const data = await res.json<{ user: User; token: string }>();
    if (!data.token || !/^[A-Za-z0-9_.-]+$/.test(data.token))
      fail(503, "Resposta de login inválida.");
    const user = await identity(env, data.token);
    return json({ user, can_write: writers.has(user.role) }, 200, {
      "Set-Cookie": cookie(r, data.token),
    });
  }
  const user = await identity(env, t);
  const canWrite = writers.has(user.role);
  if (path === "/api/me") return json({ user, can_write: canWrite });
  if (method !== "GET" && !canWrite)
    fail(403, "Seu perfil permite somente consulta.");
  if (path === "/api/overview" && method === "GET") {
    const results = await env.DB.batch<{ n: number }>(
      ["plants", "reservoirs", "requests", "orders", "teams"].map((table) =>
        env.DB.prepare(`SELECT COUNT(*) n FROM ${table}`),
      ),
    );
    return json(
      Object.fromEntries(
        results.map((v, i) => [
          ["plants", "reservoirs", "requests", "orders", "teams"][i],
          v.results[0].n,
        ]),
      ),
    );
  }
  if (
    method === "GET" &&
    ["plants", "reservoirs", "teams", "requests", "orders", "audit"].some(
      (v) => path === "/api/" + v,
    )
  )
    return page(
      env,
      (path.slice(5) === "audit" ? "audit_events" : path.slice(5)) as any,
      url,
    );
  if (path === "/api/plants" && method === "POST") {
    const v = z
      .object({
        code: text(30),
        name: text(),
        state: z.string().regex(/^[A-Z]{2}$/),
      })
      .parse(await input(r));
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO plants VALUES (?,?,?,?,?)").bind(
        id,
        v.code,
        v.name,
        v.state,
        now(),
      ),
      audit(env, user, "plant.created", id),
    ]);
    return json(await row(env, "plants", id), 201);
  }
  if (path === "/api/reservoirs" && method === "POST") {
    const v = z
      .object({ plant_id: z.uuid(), name: text() })
      .parse(await input(r));
    await row(env, "plants", v.plant_id);
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO reservoirs VALUES (?,?,?,?)").bind(
        id,
        v.plant_id,
        v.name,
        now(),
      ),
      audit(env, user, "reservoir.created", id),
    ]);
    return json(await row(env, "reservoirs", id), 201);
  }
  if (path === "/api/teams" && method === "POST") {
    const v = z.object({ name: text() }).parse(await input(r));
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO teams(id,name,created_at) VALUES (?,?,?)",
      ).bind(id, v.name, now()),
      audit(env, user, "team.created", id),
    ]);
    return json(await row(env, "teams", id), 201);
  }
  const profile = path.match(/^\/api\/teams\/([\w-]+)\/profile$/);
  if (profile) {
    const current = await row(env, "teams", profile[1]);
    if (method === "GET")
      return json({
        profile: current.profile_json
          ? { ...JSON.parse(current.profile_json), version: current.version }
          : null,
      });
    if (method === "PATCH") {
      const { version, reason, ...v } = profileSchema.parse(await input(r));
      if (current.version !== version)
        fail(409, "Perfil alterado. Reabra antes de salvar.");
      const result = await env.DB.batch([
        env.DB.prepare(
          "UPDATE teams SET profile_json=?,version=version+1 WHERE id=? AND version=?",
        ).bind(JSON.stringify(v), profile[1], version),
        audit(
          env,
          user,
          "team.profile_updated",
          profile[1],
          {
            reason,
            before: current.profile_json
              ? JSON.parse(current.profile_json)
              : null,
            after: v,
          },
          true,
        ),
      ]);
      if (!result[0].meta.changes)
        fail(409, "Perfil alterado. Reabra antes de salvar.");
      return json({ ...v, version: version + 1 });
    }
  }
  if (path === "/api/requests" && method === "POST")
    return json((await createRequests(env, user, [await input(r)]))[0], 201);
  if (path === "/api/requests/import" && method === "POST") {
    const content = await r.text();
    if (new TextEncoder().encode(content).length > 2 * 1024 * 1024)
      fail(413, "CSV maior que 2 MiB.");
    const items = parseCsv(content).map((v) => {
      const out: Record<string, any> = { ...v };
      for (const k of [
        "latitude",
        "longitude",
        "access_latitude",
        "access_longitude",
        "service_seconds",
      ])
        out[k] = v[k]?.trim() ? Number(v[k]) : undefined;
      return out;
    });
    return json(
      { data: await createRequests(env, user, items), count: items.length },
      201,
    );
  }
  const state = path.match(/^\/api\/(requests|orders)\/([\w-]+)\/status$/);
  if (state && method === "PATCH") {
    const v = z
      .object({ status: z.enum(statuses), reason: text(2000) })
      .parse(await input(r));
    const current = await row(env, state[1] as "requests" | "orders", state[2]);
    if (!transitions[current.status]?.includes(v.status))
      fail(409, "Transição não permitida.");
    const result = await env.DB.batch([
      env.DB.prepare(
        `UPDATE ${state[1]} SET status=? WHERE id=? AND status=?`,
      ).bind(v.status, state[2], current.status),
      audit(
        env,
        user,
        state[1] + ".status_changed",
        state[2],
        { reason: v.reason, from: current.status, to: v.status },
        true,
      ),
    ]);
    if (!result[0].meta.changes)
      fail(409, "Registro alterado. Atualize a consulta.");
    return json(await row(env, state[1] as any, state[2]));
  }
  const issue = path.match(/^\/api\/requests\/([\w-]+)\/orders$/);
  if (issue) {
    await row(env, "requests", issue[1]);
    if (method === "GET")
      return json(
        (
          await env.DB.prepare(
            "SELECT * FROM orders WHERE request_id=? ORDER BY created_at",
          )
            .bind(issue[1])
            .all()
        ).results,
      );
    if (method === "POST") {
      const v = z
        .object({
          idempotency_key: text(80),
          base_latitude: lat,
          base_longitude: lng,
        })
        .parse(await input(r));
      const digest = await hash(
        JSON.stringify([issue[1], v.base_latitude, v.base_longitude]),
      );
      const existing = await env.DB.prepare(
        "SELECT * FROM orders WHERE idempotency_key=?",
      )
        .bind(v.idempotency_key)
        .first<Record<string, any>>();
      if (existing) {
        if (existing.input_hash !== digest)
          fail(409, "Chave já usada com conteúdo diferente.");
        return json(existing, 201);
      }
      const request = await row(env, "requests", issue[1]);
      if (request.access_latitude == null || request.access_longitude == null)
        fail(422, "Informe o ponto de acesso antes de emitir a OS.");
      if (["completed", "cancelled"].includes(request.status))
        fail(409, "Solicitação encerrada.");
      const id = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO orders(id,request_id,order_number,idempotency_key,input_hash,base_latitude,base_longitude,access_latitude,access_longitude,created_at) SELECT ?,?,?,?,?,?,?,?,?,? FROM requests WHERE id=? AND status NOT IN ('completed','cancelled') ON CONFLICT(idempotency_key) DO NOTHING",
        ).bind(
          id,
          issue[1],
          "OS-" + id,
          v.idempotency_key,
          digest,
          v.base_latitude,
          v.base_longitude,
          request.access_latitude,
          request.access_longitude,
          now(),
          issue[1],
        ),
        audit(env, user, "order.issued", id, { request_id: issue[1] }, true),
      ]);
      const saved = await env.DB.prepare(
        "SELECT * FROM orders WHERE idempotency_key=?",
      )
        .bind(v.idempotency_key)
        .first<Record<string, any>>();
      if (!saved) fail(409, "Solicitação encerrada durante a emissão.");
      if (saved.input_hash !== digest)
        fail(409, "Chave já usada com conteúdo diferente.");
      return json(saved, 201);
    }
  }
  if (path === "/api/integration/siga/processes" && method === "GET") {
    const res = await siga(env, "/api/requests", t);
    if (res.status === 403)
      fail(403, "SIGA-CCU não autorizou consultar processos.");
    if (!res.ok) fail(503, "Não foi possível consultar os processos.");
    const data = await res.json<Record<string, any>[]>();
    return json(data.map(sourceSummary));
  }
  if (path === "/api/requests/from-siga" && method === "POST") {
    const v = z
      .object({
        source_id: z.number().int().positive(),
        reservoir_id: z.uuid(),
        access_latitude: lat.nullable().optional(),
        access_longitude: lng.nullable().optional(),
      })
      .parse(await input(r));
    await row(env, "reservoirs", v.reservoir_id);
    const res = await siga(env, "/api/requests/" + v.source_id, t);
    if ([403, 404].includes(res.status))
      fail(res.status, "Processo não disponível para seu perfil.");
    if (!res.ok) fail(503, "SIGA-CCU indisponível.");
    const source = sourceSummary(await res.json());
    const data = reqSchema.parse({
      reservoir_id: v.reservoir_id,
      protocol: "SIGA-" + v.source_id,
      description: source.description,
      category: "Inspeção vinculada ao SIGA-CCU",
      priority: "normal",
      latitude: source.latitude,
      longitude: source.longitude,
      access_latitude: v.access_latitude,
      access_longitude: v.access_longitude,
      service_seconds: 900,
    });
    const id = crypto.randomUUID();
    await env.DB.batch([
      requestInsert(env, data, id, v.source_id, source.protocol || null),
      audit(env, user, "request.imported_siga", id, {
        source_id: v.source_id,
        source_protocol: source.protocol,
      }),
    ]);
    return json(await row(env, "requests", id), 201);
  }
  fail(404, "Rota não encontrada.");
}
export default {
  async fetch(r: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(r.url);
      if (url.pathname.startsWith("/api/")) return await api(r, env, url);
      return await env.ASSETS.fetch(r);
    } catch (e) {
      if (e instanceof z.ZodError)
        return json(
          {
            message: "Confira os campos informados.",
            errors: e.issues.map((v) => ({
              field: v.path.join("."),
              message: v.message,
            })),
          },
          422,
        );
      if (e instanceof ApiError) return json({ message: e.message }, e.status);
      if (e instanceof Error && /UNIQUE constraint failed/.test(e.message))
        return json(
          {
            message:
              "Registro duplicado. Confira protocolo, código ou origem SIGA.",
          },
          409,
        );
      return json({ message: "Falha ao processar a operação." }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
