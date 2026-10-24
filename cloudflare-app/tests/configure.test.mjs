import { test } from "node:test";
import assert from "node:assert/strict";
import { configure } from "../scripts/configure.mjs";
const id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const account = "a".repeat(32),
  secret = "test-fixture-only-not-a-real-token";
const config =
  '[[d1_databases]]\nbinding = "DB"\ndatabase_name = "sig-uhe"\ndatabase_id = "00000000-0000-0000-0000-000000000000"\n';
function setup({
  databases = [],
  tables = [],
  serviceStatus = 200,
  apiError = false,
} = {}) {
  const calls = [];
  let saved;
  const request = async (url, options) => {
    assert(
      url.startsWith(
        `https://api.cloudflare.com/client/v4/accounts/${account}/`,
      ),
    );
    assert.equal(options.headers.Authorization, "Bearer " + secret);
    calls.push({
      url,
      method: options.method,
      body: options.body ? JSON.parse(options.body) : null,
    });
    if (url.endsWith("/workers/services/siga-ccu"))
      return Response.json(
        {
          success: serviceStatus === 200,
          result: {},
          errors: [{ code: 10000 }],
        },
        { status: serviceStatus },
      );
    if (apiError)
      return Response.json(
        { success: false, errors: [{ code: 10000 }] },
        { status: 403 },
      );
    if (url.includes("/d1/database?"))
      return Response.json({ success: true, result: databases });
    if (url.endsWith("/query"))
      return Response.json({
        success: true,
        result: [{ success: true, results: tables.map((name) => ({ name })) }],
      });
    if (url.endsWith("/d1/database") && options.method === "POST")
      return Response.json({
        success: true,
        result: { uuid: id, name: "sig-uhe" },
      });
    throw Error("Unexpected endpoint");
  };
  return {
    calls,
    get saved() {
      return saved;
    },
    options: {
      accountId: account,
      apiToken: secret,
      request,
      readConfig: () => config,
      writeConfig: (v) => (saved = v),
    },
  };
}
test("missing credentials stop before contacting the network or changing configuration", async () => {
  const s = setup();
  await assert.rejects(configure({ ...s.options, apiToken: "" }), /Secrets/);
  assert.equal(s.calls.length, 0);
  assert.equal(s.saved, undefined);
});
test("invalid account or database ID stops before network calls", async () => {
  const s = setup();
  await assert.rejects(
    configure({ ...s.options, accountId: "../../other" }),
    /Account ID/,
  );
  await assert.rejects(
    configure({ ...s.options, databaseId: "not-a-uuid" }),
    /Database ID/,
  );
  assert.equal(s.calls.length, 0);
});
test("missing SIGA service stops provisioning without writing anything", async () => {
  const s = setup({ serviceStatus: 404 });
  await assert.rejects(configure(s.options), /HTTP 404/);
  assert.equal(s.calls.length, 1);
  assert.equal(s.saved, undefined);
});
test("creates a dedicated D1, checks only schema metadata, and binds the confirmed ID", async () => {
  const s = setup();
  const result = await configure(s.options);
  assert.equal(result.created, true);
  assert(s.saved.includes(id));
  assert.equal(
    s.calls.filter((v) => v.method === "POST" && v.url.endsWith("/d1/database"))
      .length,
    1,
  );
  assert.equal(
    s.calls
      .find((v) => v.url.endsWith("/query"))
      .body.sql.startsWith("SELECT name FROM sqlite_master"),
    true,
  );
  assert.equal(
    s.calls
      .filter((v) => v.url.includes("/workers/"))
      .every((v) => v.method === "GET"),
    true,
  );
});
test("rerun reuses the existing sig-uhe D1 instead of creating another", async () => {
  const s = setup({ databases: [{ name: "sig-uhe", uuid: id }] });
  const result = await configure(s.options);
  assert.equal(result.created, false);
  assert.equal(
    s.calls.some((v) => v.method === "POST" && v.url.endsWith("/d1/database")),
    false,
  );
});
test("an unrelated or SIGA database ID is rejected without schema queries or writes", async () => {
  const s = setup({ databases: [{ name: "siga-ccu", uuid: id }] });
  await assert.rejects(
    configure({ ...s.options, databaseId: id }),
    /não corresponde/,
  );
  assert.equal(
    s.calls.some((v) => v.method === "POST"),
    false,
  );
  assert.equal(s.saved, undefined);
});
test("pre-existing D1 with SIGA tables is refused before binding or migrations", async () => {
  const s = setup({
    databases: [{ name: "sig-uhe", uuid: id }],
    tables: ["users"],
  });
  await assert.rejects(configure(s.options), /tabelas SIGA/);
  assert.equal(s.saved, undefined);
  assert(s.calls.every((v) => !v.body?.sql || v.body.sql.startsWith("SELECT")));
});
test("API permission failure does not expose the secret or create resources", async () => {
  const s = setup({ apiError: true });
  let message = "";
  try {
    await configure(s.options);
  } catch (e) {
    message = e.message;
  }
  assert.match(message, /HTTP 403/);
  assert(!message.includes(secret));
  assert.equal(s.saved, undefined);
  assert.equal(
    s.calls.some((v) => v.method === "POST"),
    false,
  );
});
test("ambiguous databases are rejected rather than selecting an arbitrary destination", async () => {
  const s = setup({
    databases: [
      { name: "sig-uhe", uuid: id },
      { name: "sig-uhe", uuid: "cccccccc-cccc-cccc-cccc-cccccccccccc" },
    ],
  });
  await assert.rejects(configure(s.options), /Mais de um/);
  assert.equal(s.saved, undefined);
  assert.equal(
    s.calls.some((v) => v.method === "POST"),
    false,
  );
});

test("an empty schema response cannot be treated as a successful safety check", async () => {
  const s = setup({ databases: [{ name: "sig-uhe", uuid: id }] });
  const original = s.options.request;
  await assert.rejects(
    configure({
      ...s.options,
      request: (url, options) =>
        url.endsWith("/query")
          ? Promise.resolve(Response.json({ success: true, result: [] }))
          : original(url, options),
    }),
    /verificar o esquema/,
  );
  assert.equal(s.saved, undefined);
});
