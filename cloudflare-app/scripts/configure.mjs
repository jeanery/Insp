import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const protectedTables = new Set([
  "users",
  "applicant_profiles",
  "inspection_work_orders",
]);

/** Configure only SIG-UHE resources; the SIGA service is checked with a read-only call. */
export async function configure({
  accountId,
  apiToken,
  databaseId = "",
  request = fetch,
  readConfig = () => readFileSync("wrangler.toml", "utf8"),
  writeConfig = (value) => writeFileSync("wrangler.toml", value),
}) {
  if (!apiToken?.trim() || !accountId?.trim())
    throw Error(
      "Cadastre CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID nos Secrets do GitHub.",
    );
  if (!/^[0-9a-f]{32}$/i.test(accountId))
    throw Error(
      "CLOUDFLARE_ACCOUNT_ID deve ser o Account ID de 32 caracteres da Cloudflare.",
    );
  if (databaseId && !uuid.test(databaseId))
    throw Error(
      "Database ID inválido. Deixe vazio para criar/localizar o D1 sig-uhe.",
    );
  const config = readConfig();
  if (
    (config.match(/^database_id\s*=/gm) || []).length !== 1 ||
    !/^database_name\s*=\s*"sig-uhe"\s*$/m.test(config)
  )
    throw Error(
      "A configuração deve conter um único D1 exclusivo chamado sig-uhe.",
    );
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
  async function api(path, method = "GET", payload) {
    let res;
    try {
      res = await request(base + path, {
        method,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
    } catch {
      throw Error(
        "Não foi possível conectar à API Cloudflare. Confira o acesso à rede.",
      );
    }
    let data;
    try {
      data = await res.json();
    } catch {
      throw Error("A API Cloudflare retornou uma resposta inválida.");
    }
    if (!res.ok || data.success !== true) {
      const code = data.errors?.[0]?.code;
      throw Error(
        `A Cloudflare recusou ${method} ${path.split("?")[0]} (HTTP ${res.status}${Number.isInteger(code) ? `, código ${code}` : ""}). Confira a conta e as permissões Workers Scripts: Edit, D1: Edit e Account Settings: Read.`,
      );
    }
    return data;
  }
  // Never create resources if the selected account does not contain the expected SIGA Worker.
  await api("/workers/services/siga-ccu");
  const matches = [];
  let complete = false;
  for (let page = 1; page <= 100; page++) {
    const data = await api(
      "/d1/database?" +
        new URLSearchParams({
          name: "sig-uhe",
          per_page: "100",
          page: String(page),
        }),
    );
    if (!Array.isArray(data.result))
      throw Error("Resposta de listagem D1 inválida.");
    matches.push(...data.result.filter((db) => db.name === "sig-uhe"));
    if (
      data.result.length < 100 ||
      (data.result_info?.total_pages && page >= data.result_info.total_pages)
    ) {
      complete = true;
      break;
    }
  }
  if (!complete)
    throw Error("Listagem D1 incompleta. Nenhum banco foi criado.");
  if (matches.length > 1)
    throw Error(
      "Mais de um D1 chamado sig-uhe foi localizado. Confira os recursos antes de continuar.",
    );
  let database = matches[0];
  let created = false;
  if (databaseId && (!database || database.uuid !== databaseId))
    throw Error(
      "O Database ID informado não corresponde ao D1 sig-uhe desta conta. Não use o banco SIGA-CCU.",
    );
  if (!database) {
    database = (await api("/d1/database", "POST", { name: "sig-uhe" })).result;
    created = true;
  }
  if (!database || database.name !== "sig-uhe" || !uuid.test(database.uuid))
    throw Error("A API não confirmou um D1 sig-uhe válido.");
  // Metadata only, never rows/documents from the SIGA system.
  const check = await api(`/d1/database/${database.uuid}/query`, "POST", {
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','applicant_profiles','inspection_work_orders')",
    params: [],
  });
  if (
    !Array.isArray(check.result) ||
    check.result.length !== 1 ||
    check.result.some((v) => v.success === false || !Array.isArray(v.results))
  )
    throw Error(
      "Não foi possível verificar o esquema do D1. Configuração interrompida.",
    );
  if (
    check.result.some((v) =>
      v.results.some((row) => protectedTables.has(row.name)),
    )
  )
    throw Error(
      "O D1 contém tabelas SIGA-CCU. Configuração interrompida sem aplicar migrations ou alterar o Worker SIGA.",
    );
  const updated = config.replace(
    /^database_id\s*=\s*"[^"]*"\s*$/m,
    `database_id = "${database.uuid}"`,
  );
  if (
    updated === config &&
    !config.includes(`database_id = "${database.uuid}"`)
  )
    throw Error("Não foi possível atualizar o binding DB.");
  writeConfig(updated);
  return { created, databaseId: database.uuid, service: "siga-ccu" };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const result = await configure({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
      databaseId: process.env.SIG_UHE_D1_ID?.trim() || "",
    });
    console.log(
      `D1 exclusivo sig-uhe ${result.created ? "criado" : "localizado"}; binding DB configurado e serviço SIGA verificado. Nenhuma alteração aplicada ao SIGA-CCU.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
