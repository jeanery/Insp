import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const config = readFileSync("wrangler.toml", "utf8");
if (config.includes("00000000-0000-0000-0000-000000000000"))
  throw Error(
    "Crie um D1 exclusivo para SIG-UHE e preencha database_id antes de publicar. Não use o banco SIGA-CCU.",
  );
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const safety = spawnSync(
  npm,
  [
    "exec",
    "wrangler",
    "--",
    "d1",
    "execute",
    "sig-uhe",
    "--remote",
    "--json",
    "--command",
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','applicant_profiles','inspection_work_orders')",
  ],
  { encoding: "utf8", shell: process.platform === "win32" },
);
if (safety.status !== 0)
  throw Error(
    "Não foi possível verificar o D1 de destino. Confira a autenticação Cloudflare e o banco antes de publicar.",
  );
const results = JSON.parse(safety.stdout);
if (
  JSON.stringify(results).match(
    /"name"\s*:\s*"(?:users|applicant_profiles|inspection_work_orders)"/,
  )
)
  throw Error(
    "O banco parece pertencer ao SIGA-CCU. Publicação interrompida. Use um D1 exclusivo para SIG-UHE.",
  );
for (const args of [
  ["run", "build"],
  [
    "exec",
    "wrangler",
    "--",
    "d1",
    "migrations",
    "apply",
    "sig-uhe",
    "--remote",
  ],
  ["exec", "wrangler", "--", "deploy"],
]) {
  const res = spawnSync(npm, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (res.status !== 0) process.exit(res.status || 1);
}
