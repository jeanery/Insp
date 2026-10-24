import React, { useState, useEffect, FormEvent } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
type Row = Record<string, any>;
const names: Record<string, string> = {
  overview: "Visão geral",
  requests: "Solicitações",
  orders: "Ordens de serviço",
  plants: "UHEs e reservatórios",
  teams: "Equipes",
  siga: "Processos SIGA-CCU",
  audit: "Histórico",
};
const statusNames: Record<string, string> = {
  open: "Aberta",
  triage: "Em triagem",
  awaiting_schedule: "Aguardando programação",
  scheduled: "Programada",
  in_progress: "Em execução",
  completed: "Concluída",
  cancelled: "Cancelada",
};
const transitions: Record<string, string[]> = {
  open: ["triage", "cancelled"],
  triage: ["awaiting_schedule", "cancelled"],
  awaiting_schedule: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "awaiting_schedule", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
const skills: Record<string, string> = {
  land: "Inspeção fundiária",
  environmental: "Inspeção ambiental",
  engineering: "Engenharia",
  nautical: "Inspeção náutica",
  tagging: "Etiquetagem",
  drone: "Inspeção com drone",
};
const days = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];
async function api<T = any>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const csv = typeof data === "string";
  const res = await fetch("/api/" + path, {
    method,
    headers: { "Content-Type": csv ? "text/csv" : "application/json" },
    body: data === undefined ? undefined : csv ? data : JSON.stringify(data),
  });
  const json: any = await res.json();
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event("session-expired"));
    throw new Error(
      [
        json.message,
        ...(json.errors || []).map((v: Row) => v.field + ": " + v.message),
      ].join(" "),
    );
  }
  return json;
}
function App() {
  const [me, setMe] = useState<Row | null>(null),
    [checking, setChecking] = useState(true),
    [tab, setTab] = useState("overview"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [summary, setSummary] = useState<Row>({}),
    [rows, setRows] = useState<Row[]>([]),
    [plants, setPlants] = useState<Row[]>([]),
    [reservoirs, setReservoirs] = useState<Row[]>([]),
    [page, setPage] = useState(1),
    [last, setLast] = useState(1),
    [total, setTotal] = useState(0),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("");
  const [form, setForm] = useState(""),
    [data, setData] = useState<Row>({}),
    [selected, setSelected] = useState<Row | null>(null),
    [links, setLinks] = useState<Row[]>([]),
    [saving, setSaving] = useState(false),
    [issueKey, setIssueKey] = useState("");
  const write = !!me?.can_write;
  useEffect(() => {
    api("me")
      .then(setMe)
      .catch(() => {})
      .finally(() => setChecking(false));
    const expired = () => setMe(null);
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  async function catalog(path: string) {
    const out: Row[] = [];
    for (let n = 1; n <= 20; n++) {
      const v = await api(path + "?page=" + n);
      out.push(...v.data);
      if (n >= v.last_page) return out;
    }
    throw new Error(
      "Catálogo maior que 1.000 registros. Consulte a administração.",
    );
  }
  async function load(target = tab, n = page, q = query, s = status) {
    setBusy(true);
    setError("");
    try {
      const [overview, p, r] = await Promise.all([
        api("overview"),
        catalog("plants"),
        catalog("reservoirs"),
      ]);
      setSummary(overview);
      setPlants(p);
      setReservoirs(r);
      if (target === "siga") {
        setRows(await api("integration/siga/processes"));
        setLast(1);
      } else if (target !== "overview" && target !== "plants") {
        const result = await api(
          target +
            "?" +
            new URLSearchParams({
              page: String(n),
              ...(target === "requests" ? { q, status: s } : {}),
            }),
        );
        setRows(result.data);
        setLast(result.last_page);
        setTotal(result.total);
      }
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (me) void load("overview", 1, "", "");
  }, [me]);
  function navigate(t: string) {
    if (saving || busy) return;
    setTab(t);
    setPage(1);
    setQuery("");
    setStatus("");
    setForm("");
    setSelected(null);
    setNotice("");
    void load(t, 1, "", "");
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      setMe(await api("auth/login", "POST", Object.fromEntries(f)));
      setNotice("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function open(type: string, item: Row | null = null) {
    setError("");
    setNotice("");
    setSelected(item);
    setForm(type);
    setData({
      state: "PR",
      priority: "normal",
      service_seconds: 900,
      ...(type === "status"
        ? { status: transitions[item!.status][0], reason: "" }
        : {}),
    });
    if (type === "order") setIssueKey(crypto.randomUUID());
    if (type === "profile") {
      setData(
        item?.operational_profile
          ? { ...item.operational_profile, reason: "" }
          : {
              version: 0,
              availability: "unavailable",
              timezone: "America/Sao_Paulo",
              skills: [],
              weekly_windows: [],
              daily_capacity_minutes: 480,
              reason: "",
            },
      );
    }
  }
  function field(k: string, label: string, type = "text", opts: Row = {}) {
    return (
      <label className={opts.full ? "full" : ""}>
        {label}
        <input
          name={k}
          type={type}
          value={data[k] ?? ""}
          onChange={(e) => setData({ ...data, [k]: e.target.value })}
          required={opts.required !== false}
          {...Object.fromEntries(
            Object.entries(opts).filter(
              ([k]) => k !== "full" && k !== "required",
            ),
          )}
        />
      </label>
    );
  }
  function select(k: string, label: string, options: Row[]) {
    return (
      <label>
        {label}
        <select
          aria-label={label}
          value={data[k] ?? ""}
          required
          onChange={(e) => setData({ ...data, [k]: e.target.value })}
        >
          <option value="">Selecione</option>
          {options.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!write || saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = { ...data };
      for (const k of [
        "latitude",
        "longitude",
        "access_latitude",
        "access_longitude",
        "base_latitude",
        "base_longitude",
        "service_seconds",
        "daily_capacity_minutes",
        "source_id",
      ])
        if (k in payload)
          payload[k] = payload[k] === "" ? null : Number(payload[k]);
      if (form === "order")
        await api("requests/" + selected!.id + "/orders", "POST", {
          ...payload,
          idempotency_key: issueKey,
        });
      else if (form === "status")
        await api(
          selected!.resource + "/" + selected!.id + "/status",
          "PATCH",
          payload,
        );
      else if (form === "profile")
        await api("teams/" + selected!.id + "/profile", "PATCH", payload);
      else if (form === "siga-import")
        await api("requests/from-siga", "POST", {
          ...payload,
          source_id: selected!.id,
        });
      else
        await api(
          {
            plant: "plants",
            reservoir: "reservoirs",
            team: "teams",
            request: "requests",
          }[form]!,
          "POST",
          payload,
        );
      setForm("");
      setSelected(null);
      setNotice("Registro salvo com sucesso.");
      setPage(1);
      await load(tab, 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function detail(item: Row) {
    setError("");
    setSelected(item);
    try {
      setLinks(await api("requests/" + item.id + "/orders"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function importFile(file?: File) {
    if (!file || saving) return;
    setSaving(true);
    setError("");
    try {
      if (file.size > 2097152) throw new Error("Limite de 2 MiB.");
      const res = await api("requests/import", "POST", await file.text());
      setNotice(res.count + " solicitações importadas.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const button = (label: string, onClick: () => void, disabled = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || saving || busy}
    >
      {label}
    </button>
  );
  const formTitle: Record<string, string> = {
    plant: "Cadastrar UHE",
    reservoir: "Cadastrar reservatório",
    team: "Cadastrar equipe",
    request: "Nova solicitação",
    profile: "Perfil operacional",
    order: "Emitir ordem de serviço",
    status: "Atualizar situação",
    "siga-import": "Vincular processo SIGA-CCU",
  };
  const options = Object.entries(statusNames).map(([id, name]) => ({
    id,
    name,
  }));
  if (checking)
    return (
      <main className="login">
        <p>Verificando sessão…</p>
      </main>
    );
  if (!me)
    return (
      <main className="login">
        <div className="brand">≈ SIG-UHE</div>
        <h1>Gestão de inspeções</h1>
        <p>Entre com sua conta interna do SIGA-CCU.</p>
        <form onSubmit={login}>
          <label>
            E-mail
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Senha
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={saving}>
            {saving ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <small>
          Cloudflare Workers · Acesso restrito aos perfis operacionais
        </small>
      </main>
    );
  return (
    <>
      <header>
        <div className="brand">≈ SIG-UHE</div>
        <span className="identity">
          {me.user.name} · {me.user.role}
        </span>
        {button("Sair", async () => {
          await api("auth/logout", "POST");
          setMe(null);
          setError("");
        })}
      </header>
      <main>
        <div className="heading">
          <div>
            <p className="eyebrow">GESTÃO DE INSPEÇÕES · CLOUDFLARE</p>
            <h1>SIG-UHE</h1>
            <p>Usinas, reservatórios e operações de campo</p>
          </div>
          {button("Atualizar", () => void load())}
        </div>
        <nav aria-label="Navegação SIG-UHE">
          {Object.entries(names).map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => navigate(key)}
              disabled={saving || busy}
            >
              {label}
            </button>
          ))}
        </nav>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        {busy && <p role="status">Carregando registros…</p>}
        {form && (
          <section>
            <div className="section-heading">
              <h2>{formTitle[form]}</h2>
              {button("Cancelar", () => {
                setForm("");
                setSelected(null);
              })}
            </div>
            <form onSubmit={save}>
              <fieldset
                disabled={saving || (!write && form === "profile")}
                className="fields"
              >
                {form === "plant" && (
                  <>
                    {field("code", "Código da UHE", "text", { maxLength: 30 })}
                    {field("name", "Nome da UHE")}
                    {field("state", "UF", "text", {
                      maxLength: 2,
                      pattern: "[A-Z]{2}",
                    })}
                  </>
                )}
                {form === "reservoir" && (
                  <>
                    {select("plant_id", "UHE", plants)}
                    {field("name", "Nome do reservatório")}
                  </>
                )}
                {form === "team" && field("name", "Nome da equipe")}
                {form === "request" && (
                  <>
                    {select("reservoir_id", "Reservatório", reservoirs)}
                    {field("protocol", "Protocolo", "text", { maxLength: 80 })}
                    {field("category", "Categoria")}
                    {select("priority", "Prioridade", [
                      { id: "low", name: "Baixa" },
                      { id: "normal", name: "Normal" },
                      { id: "high", name: "Alta" },
                      { id: "urgent", name: "Urgente" },
                    ])}
                    {field("description", "Descrição da inspeção", "text", {
                      full: true,
                      maxLength: 5000,
                    })}
                    {field("latitude", "Latitude da ocorrência", "number", {
                      step: "any",
                      min: -90,
                      max: 90,
                    })}
                    {field("longitude", "Longitude da ocorrência", "number", {
                      step: "any",
                      min: -180,
                      max: 180,
                    })}
                    {field(
                      "access_latitude",
                      "Latitude do acesso terrestre",
                      "number",
                      { required: false, step: "any", min: -90, max: 90 },
                    )}
                    {field(
                      "access_longitude",
                      "Longitude do acesso terrestre",
                      "number",
                      { required: false, step: "any", min: -180, max: 180 },
                    )}
                    {field(
                      "service_seconds",
                      "Duração estimada (segundos)",
                      "number",
                      { min: 60, max: 86400 },
                    )}
                    <p className="full muted">
                      Sem acesso cadastrado, a emissão de OS fica bloqueada.
                    </p>
                  </>
                )}
                {form === "order" && (
                  <>
                    <p className="full">
                      {selected!.protocol} · A OS usa o acesso da solicitação.
                      Não calcula rota nem despacha equipe.
                    </p>
                    {field("base_latitude", "Latitude da base", "number", {
                      step: "any",
                      min: -90,
                      max: 90,
                    })}
                    {field("base_longitude", "Longitude da base", "number", {
                      step: "any",
                      min: -180,
                      max: 180,
                    })}
                  </>
                )}
                {form === "status" && (
                  <>
                    {select(
                      "status",
                      "Nova situação",
                      transitions[selected!.status].map((id) => ({
                        id,
                        name: statusNames[id],
                      })),
                    )}
                    {field("reason", "Justificativa", "text", {
                      maxLength: 2000,
                    })}
                  </>
                )}
                {form === "siga-import" && (
                  <>
                    <p className="full">
                      {selected!.protocol || "Processo " + selected!.id} ·{" "}
                      {selected!.reservoir}. Será criada uma solicitação
                      vinculada, sem modificar o processo original.
                    </p>
                    {select(
                      "reservoir_id",
                      "Reservatório de destino",
                      reservoirs,
                    )}
                    {field(
                      "access_latitude",
                      "Latitude do acesso terrestre",
                      "number",
                      { required: false, step: "any", min: -90, max: 90 },
                    )}
                    {field(
                      "access_longitude",
                      "Longitude do acesso terrestre",
                      "number",
                      { required: false, step: "any", min: -180, max: 180 },
                    )}
                  </>
                )}
                {form === "profile" && (
                  <>
                    <p className="full">{selected!.name}</p>
                    {select("availability", "Disponibilidade operacional", [
                      { id: "available", name: "Disponível" },
                      { id: "unavailable", name: "Indisponível" },
                    ])}
                    {field("timezone", "Fuso horário")}
                    {field(
                      "base_latitude",
                      "Latitude da base operacional",
                      "number",
                      { step: "any", min: -90, max: 90 },
                    )}
                    {field(
                      "base_longitude",
                      "Longitude da base operacional",
                      "number",
                      { step: "any", min: -180, max: 180 },
                    )}
                    {field(
                      "daily_capacity_minutes",
                      "Capacidade diária (minutos)",
                      "number",
                      { min: 1, max: 1440 },
                    )}
                    <div>
                      <h3>Habilidades</h3>
                      {Object.entries(skills).map(([key, label]) => (
                        <label className="check" key={key}>
                          <input
                            type="checkbox"
                            checked={data.skills?.includes(key) || false}
                            onChange={(e) =>
                              setData({
                                ...data,
                                skills: e.target.checked
                                  ? [...data.skills, key]
                                  : data.skills.filter(
                                      (v: string) => v !== key,
                                    ),
                              })
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <div className="full">
                      <h3>Jornada semanal</h3>
                      <p className="muted">
                        Horários no fuso informado. Intervalos dentro do mesmo
                        dia; cadastre pausas separadamente.
                      </p>
                      {(data.weekly_windows || []).map((w: Row, i: number) => (
                        <div className="window" key={i}>
                          <label>
                            Dia
                            <select
                              value={w.day}
                              onChange={(e) =>
                                setData({
                                  ...data,
                                  weekly_windows: data.weekly_windows.map(
                                    (v: Row, j: number) =>
                                      i === j
                                        ? { ...v, day: Number(e.target.value) }
                                        : v,
                                  ),
                                })
                              }
                            >
                              {days.map((d, j) => (
                                <option key={d} value={j + 1}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </label>
                          {["start", "end"].map((k) => (
                            <label key={k}>
                              {k === "start" ? "Início" : "Fim"}
                              <input
                                type="time"
                                value={w[k]}
                                required
                                onChange={(e) =>
                                  setData({
                                    ...data,
                                    weekly_windows: data.weekly_windows.map(
                                      (v: Row, j: number) =>
                                        i === j
                                          ? { ...v, [k]: e.target.value }
                                          : v,
                                    ),
                                  })
                                }
                              />
                            </label>
                          ))}
                          {write &&
                            button("Remover intervalo", () =>
                              setData({
                                ...data,
                                weekly_windows: data.weekly_windows.filter(
                                  (_: Row, j: number) => j !== i,
                                ),
                              }),
                            )}
                        </div>
                      ))}
                      {write &&
                        button(
                          "Adicionar intervalo",
                          () =>
                            setData({
                              ...data,
                              weekly_windows: [
                                ...data.weekly_windows,
                                { day: 1, start: "08:00", end: "17:00" },
                              ],
                            }),
                          data.weekly_windows.length >= 28,
                        )}
                    </div>
                    {write &&
                      field(
                        "reason",
                        "Motivo da alteração operacional",
                        "text",
                        { full: true, maxLength: 2000 },
                      )}
                  </>
                )}
              </fieldset>
              {write && (
                <div className="form-footer">
                  <button className="primary" disabled={saving}>
                    {saving ? "Salvando…" : "Salvar registro"}
                  </button>
                </div>
              )}
            </form>
          </section>
        )}
        {tab === "overview" && (
          <>
            <div className="stats">
              {[
                ["plants", "UHEs cadastradas"],
                ["requests", "Solicitações"],
                ["orders", "Ordens emitidas"],
                ["teams", "Equipes"],
              ].map(([key, label]) => (
                <article key={key}>
                  <span>{label}</span>
                  <strong>{summary[key] ?? 0}</strong>
                  <small>Dados deste ambiente</small>
                </article>
              ))}
            </div>
            <section className="intro">
              <div className="water">≈</div>
              <div>
                <p className="eyebrow">CENTRO DE OPERAÇÕES</p>
                <h2>Da solicitação à ordem de serviço</h2>
                <p>
                  Cadastre demandas de inspeção ou vincule processos autorizados
                  do SIGA-CCU. Organize equipes, jornadas e acompanhe o
                  histórico.
                </p>
                <div className="actions">
                  {button("Ver solicitações", () => navigate("requests"))}
                  {button("Processos SIGA-CCU", () => navigate("siga"))}
                </div>
              </div>
            </section>
            <section className="steps">
              <div>
                <b>01 · Organize os locais</b>
                <p>Cadastre a usina e seus reservatórios.</p>
              </div>
              <div>
                <b>02 · Registre a demanda</b>
                <p>Crie uma solicitação ou importe um CSV.</p>
              </div>
              <div>
                <b>03 · Emita e acompanhe</b>
                <p>Gere a OS e consulte as alterações.</p>
              </div>
            </section>
          </>
        )}
        {tab === "plants" && (
          <>
            <section>
              <div className="section-heading">
                <h2>Usinas hidrelétricas</h2>
                {write && button("Cadastrar UHE", () => open("plant"))}
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>UHE</th>
                      <th>UF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plants.map((v) => (
                      <tr key={v.id}>
                        <td>{v.code}</td>
                        <td>{v.name}</td>
                        <td>{v.state}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!plants.length && (
                <p className="empty">Nenhuma UHE cadastrada.</p>
              )}
            </section>
            <section>
              <div className="section-heading">
                <h2>Reservatórios</h2>
                {write &&
                  button(
                    "Cadastrar reservatório",
                    () => open("reservoir"),
                    !plants.length,
                  )}
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Reservatório</th>
                      <th>UHE</th>
                      <th>Identificador para CSV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservoirs.map((v) => (
                      <tr key={v.id}>
                        <td>{v.name}</td>
                        <td>{plants.find((p) => p.id === v.plant_id)?.name}</td>
                        <td>
                          <code>{v.id}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
        {tab === "teams" && (
          <section>
            <div className="section-heading">
              <h2>Equipes de inspeção</h2>
              {write && button("Cadastrar equipe", () => open("team"))}
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Equipe</th>
                    <th>Disponibilidade</th>
                    <th>Habilidades</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.id}>
                      <td>{v.name}</td>
                      <td>
                        {v.operational_profile
                          ? v.operational_profile.availability === "available"
                            ? "Disponível"
                            : "Indisponível"
                          : "Não configurado"}
                      </td>
                      <td>
                        {v.operational_profile?.skills
                          .map((s: string) => skills[s])
                          .join(", ") || "Não informadas"}
                      </td>
                      <td>
                        {button("Perfil operacional", () => open("profile", v))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {(tab === "requests" || tab === "orders") && (
          <section>
            <div className="section-heading">
              <div>
                <h2>{names[tab]}</h2>
                <p>{total} registros encontrados</p>
              </div>
              {write &&
                tab === "requests" &&
                button(
                  "Nova solicitação",
                  () => open("request"),
                  !reservoirs.length,
                )}
            </div>
            {tab === "requests" && (
              <form
                className="filters"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(1);
                  void load(tab, 1);
                }}
              >
                <label>
                  Pesquisar
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <label>
                  Situação
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">Todas</option>
                    {options.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button disabled={busy}>Filtrar</button>
              </form>
            )}
            {selected && !form && tab === "requests" && (
              <article className="detail">
                <div className="section-heading">
                  <h3>{selected.protocol}</h3>
                  {button("Fechar detalhes", () => setSelected(null))}
                </div>
                <p>{selected.description}</p>
                <div className="detail-grid">
                  <p>
                    <small>Situação</small>
                    {statusNames[selected.status]}
                  </p>
                  <p>
                    <small>Ocorrência</small>
                    {selected.latitude}, {selected.longitude}
                  </p>
                  <p>
                    <small>Acesso</small>
                    {selected.access_latitude == null
                      ? "Não informado"
                      : `${selected.access_latitude}, ${selected.access_longitude}`}
                  </p>
                </div>
                <div className="actions">
                  {write &&
                    button(
                      "Emitir OS",
                      () => open("order", selected),
                      selected.access_latitude == null ||
                        ["completed", "cancelled"].includes(selected.status),
                    )}
                  {write &&
                    !!transitions[selected.status]?.length &&
                    button("Atualizar situação", () =>
                      open("status", { ...selected, resource: "requests" }),
                    )}
                </div>
                <h3>Ordens vinculadas</h3>
                {links.length ? (
                  links.map((v) => (
                    <p key={v.id}>
                      {v.order_number} · {statusNames[v.status]}
                    </p>
                  ))
                ) : (
                  <p>Nenhuma ordem vinculada.</p>
                )}
              </article>
            )}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{tab === "requests" ? "Protocolo" : "OS"}</th>
                    <th>{tab === "requests" ? "Categoria" : "Solicitação"}</th>
                    <th>Situação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <b>{v.protocol || v.order_number}</b>
                        {v.source_protocol && (
                          <small>SIGA-CCU: {v.source_protocol}</small>
                        )}
                      </td>
                      <td>{v.category || v.request_id}</td>
                      <td>{statusNames[v.status]}</td>
                      <td>
                        {tab === "requests"
                          ? button("Detalhes", () => void detail(v))
                          : write &&
                            !!transitions[v.status]?.length &&
                            button("Atualizar situação", () =>
                              open("status", { ...v, resource: "orders" }),
                            )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && !busy && (
              <p className="empty">Nenhum registro encontrado.</p>
            )}
            {write && tab === "requests" && (
              <div className="import">
                <h3>Importar solicitações</h3>
                <p>
                  CSV UTF-8 · Até 100 linhas e 2 MiB. Consulte o identificador
                  do reservatório no cadastro.
                </p>
                <label>
                  Selecionar CSV
                  <input
                    aria-label="Selecionar CSV"
                    type="file"
                    accept=".csv,text/csv"
                    disabled={saving}
                    onChange={(e) => {
                      void importFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            )}
          </section>
        )}
        {tab === "siga" && (
          <section>
            <div className="section-heading">
              <div>
                <h2>Processos do SIGA-CCU</h2>
                <p>
                  Somente processos autorizados pelo sistema de origem. A
                  vinculação não altera o processo.
                </p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Protocolo</th>
                    <th>Reservatório</th>
                    <th>Município</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.id}>
                      <td>{v.protocol || "Processo " + v.id}</td>
                      <td>{v.reservoir}</td>
                      <td>{v.municipality}</td>
                      <td>
                        {write &&
                          button(
                            "Vincular inspeção",
                            () => open("siga-import", v),
                            !reservoirs.length,
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {tab === "audit" && (
          <section>
            <div className="section-heading">
              <h2>Histórico de alterações</h2>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Autor</th>
                    <th>Alteração</th>
                    <th>Referência</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.id}>
                      <td>{new Date(v.created_at).toLocaleString("pt-BR")}</td>
                      <td>{v.actor_name}</td>
                      <td>{v.action}</td>
                      <td>
                        <code>{v.subject_id}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {["requests", "orders", "teams", "audit"].includes(tab) && (
          <div className="pagination">
            <span>
              Página {page} de {last}
            </span>
            <div>
              {button(
                "Anterior",
                () => {
                  setPage(page - 1);
                  void load(tab, page - 1);
                },
                page <= 1,
              )}
              {button(
                "Próxima",
                () => {
                  setPage(page + 1);
                  void load(tab, page + 1);
                },
                page >= last,
              )}
            </div>
          </div>
        )}
        <footer>
          <span>SIG-UHE · Operações de campo</span>
          <span>
            {write ? "Perfil de gestão" : "Somente consulta"} · Identidade
            SIGA-CCU
          </span>
        </footer>
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
