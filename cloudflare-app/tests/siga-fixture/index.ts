// Contract fixture only. Never deployed or referenced by the production configuration.
const users: Record<
  string,
  { id: number; name: string; email: string; role: string }
> = {
  manager: {
    id: 1,
    name: "Gestora de teste",
    email: "gestora@example.test",
    role: "supervisor_inspecao",
  },
  reader: {
    id: 2,
    name: "Inspetor de teste",
    email: "inspetor@example.test",
    role: "inspetor_vistoriador",
  },
  external: {
    id: 3,
    name: "Solicitante",
    email: "externo@example.test",
    role: "solicitante",
  },
};
const process = {
  id: 7,
  protocol_number: "CCU-0007",
  reservoir: "Canoas I",
  municipality: "Itambaracá",
  latitude: -23,
  longitude: -50,
  purpose: "Vistoria de rampa",
  applicant_document: "NOT-FOR-EXPORT",
  email: "private@example.test",
};
export default {
  async fetch(r: Request) {
    const url = new URL(r.url);
    const bearer = r.headers.get("Authorization")?.slice(7) || "";
    if (url.pathname === "/api/auth/login") {
      const p = await r.json<{ email: string; password: string }>();
      const entry = Object.entries(users).find(([, u]) => u.email === p.email);
      return entry && p.password === "Fixture-Only-123"
        ? Response.json({ user: entry[1], token: entry[0] })
        : Response.json({ message: "Credenciais inválidas" }, { status: 401 });
    }
    const user = users[bearer];
    if (!user)
      return Response.json({ message: "Não autenticado" }, { status: 401 });
    if (url.pathname === "/api/me") return Response.json({ user });
    if (url.pathname === "/api/requests") return Response.json([process]);
    if (url.pathname === "/api/requests/7") return Response.json(process);
    return Response.json({ message: "Não encontrado" }, { status: 404 });
  },
};
