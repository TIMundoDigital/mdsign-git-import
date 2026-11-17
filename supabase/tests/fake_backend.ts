// Backend simulado para testes das funções (sem rede e sem banco): substitui o fetch global e
// responde no lugar do PostgREST do Supabase (tabelas em memória) e da API do SignDoc.
// Cobre só o que o código do MDSign usa: filtros eq/neq/is/in/lt/lte/gt/gte/not, order, limit,
// select de colunas simples, insert (com chave única), update, delete, upsert, count e rpc.
// Selects com tabelas embutidas ("tabela (colunas)") não são suportados.

type Row = Record<string, unknown>;
type Rpc = (args: Record<string, unknown>) => unknown;

export type EngineState = {
  documents: Record<string, Record<string, unknown>>;
  deleted: Set<string>;
  /** Recusas recebidas (POST /api/documents/{id}/refusal), com o motivo. */
  refusals: { id: string; reason: string }[];
  /** true = o motor responde erro na próxima recusa. */
  failRefusal?: boolean;
};

export type FakeBackend = {
  tables: Record<string, Row[]>;
  /** Arquivos do Storage por bucket (caminho completo). */
  storage: Record<string, Set<string>>;
  /** true = a próxima exclusão de arquivos "esquece" um arquivo (para testar a conferência). */
  storageDropOneOnRemove?: boolean;
  rpc: Record<string, Rpc>;
  engine: EngineState;
  /** Chamadas feitas à API do SignDoc ("GET /api/documents/…"). */
  engineCalls: string[];
  restore: () => void;
};

const parseValue = (raw: string): unknown => {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw.replace(/^"(.*)"$/, "$1");
};

const asComparable = (v: unknown) =>
  typeof v === "number" ? v : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;

function matches(row: Row, column: string, expr: string): boolean {
  let negate = false;
  if (expr.startsWith("not.")) {
    negate = true;
    expr = expr.slice(4);
  }
  const dot = expr.indexOf(".");
  const op = expr.slice(0, dot);
  const raw = expr.slice(dot + 1);
  const value = row[column];
  let ok: boolean;
  switch (op) {
    case "eq":
      ok = String(value) === String(parseValue(raw));
      break;
    case "neq":
      ok = String(value) !== String(parseValue(raw));
      break;
    case "is":
      ok = parseValue(raw) === null ? value == null : value === parseValue(raw);
      break;
    case "in": {
      const list = raw
        .replace(/^\(|\)$/g, "")
        .split(",")
        .map((s) => String(parseValue(s.trim())));
      ok = list.includes(String(value));
      break;
    }
    case "lt":
    case "lte":
    case "gt":
    case "gte": {
      const a = asComparable(value) as number | string;
      const b = asComparable(parseValue(raw)) as number | string;
      if (value == null) ok = false;
      else if (op === "lt") ok = a < b;
      else if (op === "lte") ok = a <= b;
      else if (op === "gt") ok = a > b;
      else ok = a >= b;
      break;
    }
    default:
      throw new Error(`fake_backend: filtro não suportado ${op}`);
  }
  return negate ? !ok : ok;
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns", "or"]);

/** Filtro "ou" do PostgREST: or=(col.op.valor,col.op.valor). */
function matchesOr(row: Row, expr: string): boolean {
  return expr
    .replace(/^\(|\)$/g, "")
    .split(",")
    .some((part) => {
      const dot = part.indexOf(".");
      return matches(row, part.slice(0, dot), part.slice(dot + 1));
    });
}

/** Divide o select no nível de cima, respeitando parênteses de tabelas embutidas. */
function splitSelect(select: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of select) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/**
 * Colunas simples e tabelas embutidas "muitos-para-um" (ex.: organizations(name, locale)),
 * ligadas pela coluna <tabela no singular>_id do registro.
 */
function project(row: Row, select: string | null, tables: Record<string, Row[]>): Row {
  if (!select || select === "*") return { ...row };
  const out: Row = {};
  for (const part of splitSelect(select)) {
    const embed = /^(\w+)\s*\((.*)\)$/s.exec(part);
    if (!embed) {
      out[part] = row[part];
      continue;
    }
    const [, rel, cols] = embed;
    const fk = `${rel!.replace(/s$/, "")}_id`;
    if (!(fk in row)) throw new Error(`fake_backend: embutido sem ${fk}: ${part}`);
    const target = (tables[rel!] ?? []).find((r) => r["id"] === row[fk]);
    out[rel!] = target ? project(target, cols!, tables) : null;
  }
  return out;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

/**
 * Instala o backend simulado. `unique` lista, por tabela, as colunas com chave única (gera o
 * erro 23505 como o Postgres). Chame `restore()` no fim do teste.
 */
export function installFakeBackend(opts: {
  tables?: Record<string, Row[]>;
  rpc?: Record<string, Rpc>;
  unique?: Record<string, string[][]>;
  /** Usuários logados, pelo token (GET /auth/v1/user do Supabase Auth). */
  users?: Record<string, { id: string; email: string }>;
  /** Outros serviços (ex.: Asaas): devolve a resposta ou undefined se não for com ele. */
  http?: (req: Request, url: URL) => Response | undefined | Promise<Response | undefined>;
}): FakeBackend {
  const tables: Record<string, Row[]> = structuredClone(opts.tables ?? {});
  const unique = opts.unique ?? {};
  const rpc: Record<string, Rpc> = {
    // Padrões neutros: sem webhooks a entregar, sem conta MDSign, funcionalidade desligada.
    claim_webhook_deliveries: () => [],
    claim_notifications: () => [],
    claim_engine_events: () => [],
    user_id_by_email: () => null,
    feature_enabled: () => false,
    // Auditoria: guarda as chamadas para o teste conferir.
    write_audit_as: (args) => {
      (tables["audit_calls"] ??= []).push({ ...args });
      return null;
    },
    ...(opts.rpc ?? {}),
  };
  const engine: EngineState = { documents: {}, deleted: new Set(), refusals: [] };
  const engineCalls: string[] = [];
  const storage: Record<string, Set<string>> = {};
  const original = globalThis.fetch;
  const backend = {} as FakeBackend;
  let seq = 1000;

  const table = (name: string) => (tables[name] ??= []);

  const filterRows = (name: string, params: URLSearchParams) => {
    let rows = table(name).filter((row) => {
      for (const [k, v] of params) {
        if (k === "or") {
          if (!matchesOr(row, v)) return false;
          continue;
        }
        if (RESERVED.has(k)) continue;
        if (!matches(row, k, v)) return false;
      }
      return true;
    });
    const order = params.get("order");
    if (order) {
      const [col, dir] = order.split(",")[0]!.split(".");
      rows = [...rows].sort((a, b) => {
        const x = asComparable(a[col!]) as number | string;
        const y = asComparable(b[col!]) as number | string;
        return (x < y ? -1 : x > y ? 1 : 0) * (dir === "desc" ? -1 : 1);
      });
    }
    const limit = params.get("limit");
    if (limit) rows = rows.slice(0, Number(limit));
    return rows;
  };

  const violates = (name: string, candidate: Row, ignore?: Row) => {
    for (const cols of unique[name] ?? []) {
      const clash = table(name).find(
        (r) => r !== ignore && cols.every((c) => candidate[c] != null && r[c] === candidate[c]),
      );
      if (clash) return clash;
    }
    return undefined;
  };

  const rest = async (req: Request, url: URL) => {
    const path = url.pathname.replace(/^\/rest\/v1\//, "");
    const params = url.searchParams;
    const prefer = req.headers.get("prefer") ?? "";
    const wantsObject = (req.headers.get("accept") ?? "").includes("vnd.pgrst.object");
    const representation = prefer.includes("return=representation");
    const select = params.get("select");

    const reply = (rows: Row[], status = 200) => {
      const projected = rows.map((r) => project(r, select, tables));
      if (wantsObject) {
        if (projected.length !== 1)
          return json(
            { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" },
            406,
          );
        return json(projected[0], status);
      }
      return json(projected, status);
    };

    if (path.startsWith("rpc/")) {
      const fn = path.slice(4);
      const handler = rpc[fn];
      if (!handler) throw new Error(`fake_backend: rpc não simulada ${fn}`);
      const args = req.method === "GET" ? Object.fromEntries(params) : await req.json();
      return json(await handler(args));
    }

    const name = path;
    if (req.method === "GET" || req.method === "HEAD") {
      const rows = filterRows(name, params);
      const headers = prefer.includes("count=")
        ? { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` }
        : undefined;
      if (req.method === "HEAD") return new Response(null, { status: 200, headers });
      const res = reply(rows);
      if (headers) res.headers.set("content-range", headers["content-range"]);
      return res;
    }

    if (req.method === "POST") {
      const body = await req.json();
      const list = (Array.isArray(body) ? body : [body]) as Row[];
      const ignoreDup = prefer.includes("resolution=ignore-duplicates");
      const merge = prefer.includes("resolution=merge-duplicates");
      const written: Row[] = [];
      for (const item of list) {
        const row: Row = { ...item };
        row["id"] ??= name === "engine_webhook_events" ? seq++ : crypto.randomUUID();
        const clash = violates(name, row);
        if (clash) {
          if (ignoreDup) continue;
          if (merge) {
            Object.assign(clash, item);
            written.push(clash);
            continue;
          }
          return json(
            { code: "23505", message: "duplicate key value violates unique constraint" },
            409,
          );
        }
        table(name).push(row);
        written.push(row);
      }
      return representation ? reply(written, 201) : new Response(null, { status: 201 });
    }

    if (req.method === "PATCH") {
      const patch = (await req.json()) as Row;
      const rows = filterRows(name, params);
      for (const r of rows) Object.assign(r, patch);
      return representation ? reply(rows) : new Response(null, { status: 204 });
    }

    if (req.method === "DELETE") {
      const rows = filterRows(name, params);
      tables[name] = table(name).filter((r) => !rows.includes(r));
      return representation ? reply(rows) : new Response(null, { status: 204 });
    }
    throw new Error(`fake_backend: método não suportado ${req.method}`);
  };

  const engineApi = async (req: Request, url: URL) => {
    engineCalls.push(`${req.method} ${url.pathname}`);
    const refusal = /^\/api\/documents\/([0-9a-f-]+)\/refusal$/i.exec(url.pathname);
    if (req.method === "POST" && refusal) {
      if (engine.failRefusal) return json({ code: "InternalError", message: "falha" }, 500);
      const id = refusal[1]!;
      engine.refusals.push({ id, reason: String(((await req.json()) as Row)["reason"] ?? "") });
      const doc = engine.documents[id];
      if (doc) doc["status"] = "Refused";
      return new Response(null, { status: 200 });
    }
    const m = /^\/api\/documents\/([0-9a-f-]+)$/i.exec(url.pathname);
    if (req.method === "GET" && m) {
      const id = m[1]!;
      if (engine.deleted.has(id))
        return json({ code: "DocumentIsDeleted", message: "The document was deleted" }, 422);
      const doc = engine.documents[id];
      return doc ? json(doc) : json({ code: "DocumentNotFound", message: "not found" }, 404);
    }
    throw new Error(`fake_backend: chamada ao SignDoc não simulada ${req.method} ${url.pathname}`);
  };

  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (url.pathname.startsWith("/rest/v1/")) return await rest(req, url);
    const list = /^\/storage\/v1\/object\/list\/([\w-]+)$/.exec(url.pathname);
    if (list && req.method === "POST") {
      const {
        prefix = "",
        limit = 100,
        offset = 0,
      } = (await req.json()) as {
        prefix?: string;
        limit?: number;
        offset?: number;
      };
      const base = prefix ? `${prefix.replace(/\/$/, "")}/` : "";
      const children = new Map<string, boolean>(); // nome → é arquivo
      for (const path of storage[list[1]!] ?? []) {
        if (!path.startsWith(base)) continue;
        const rest = path.slice(base.length);
        const [head, ...tail] = rest.split("/");
        if (!children.has(head!) || tail.length === 0) children.set(head!, tail.length === 0);
      }
      const items = [...children.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .slice(offset, offset + limit)
        .map(([name, isFile]) => ({ name, id: isFile ? crypto.randomUUID() : null }));
      return json(items);
    }
    const bucketDel = /^\/storage\/v1\/object\/([\w-]+)$/.exec(url.pathname);
    if (bucketDel && req.method === "DELETE") {
      const { prefixes = [] } = (await req.json()) as { prefixes?: string[] };
      const set = (storage[bucketDel[1]!] ??= new Set());
      let targets = prefixes.filter((p) => set.has(p));
      if (backend.storageDropOneOnRemove && targets.length) targets = targets.slice(1);
      for (const p of targets) set.delete(p);
      return json(targets.map((name) => ({ name })));
    }
    const adminUser = /^\/auth\/v1\/admin\/users\/([\w-]+)$/.exec(url.pathname);
    if (adminUser) {
      const user = Object.values(opts.users ?? {}).find((u) => u.id === adminUser[1]);
      return user ? json({ ...user, aud: "authenticated" }) : json({ msg: "User not found" }, 404);
    }
    if (url.pathname === "/auth/v1/user") {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      const user = opts.users?.[token];
      return user
        ? json({ ...user, aud: "authenticated", role: "authenticated" })
        : json({ code: 401, msg: "invalid JWT" }, 401);
    }
    if (url.pathname.startsWith("/api/")) return await engineApi(req, url);
    const other = await opts.http?.(req, url);
    if (other) return other;
    throw new Error(`fake_backend: requisição inesperada ${req.method} ${req.url}`);
  };

  Object.assign(backend, {
    tables,
    storage,
    rpc,
    engine,
    engineCalls,
    restore: () => (globalThis.fetch = original),
  });
  return backend;
}
