// Webhooks de saída só para endereços públicos (auditoria de 17/11/2026, P1-12 / D-26).
//
// Antes, a validação olhava só o texto do endereço: um domínio que apontasse para um IP interno
// (rede privada, loopback, metadados da nuvem) passava. Agora o nome é resolvido no DNS e
// nenhum dos IPs pode ser privado, tanto no cadastro quanto antes de cada entrega.
// Limite conhecido: entre a conferência e a chamada, o DNS pode mudar (rebinding); a entrega não
// segue redirecionamentos e tem tempo-limite curto, o que reduz esse risco.

const V4_PRIVATE: [number, number][] = [
  // [início, bits do prefixo]
  [0x00000000, 8], // 0.0.0.0/8
  [0x0a000000, 8], // 10.0.0.0/8
  [0x64400000, 10], // 100.64.0.0/10 (CGNAT)
  [0x7f000000, 8], // 127.0.0.0/8
  [0xa9fe0000, 16], // 169.254.0.0/16 (link-local, metadados da nuvem)
  [0xac100000, 12], // 172.16.0.0/12
  [0xc0000000, 24], // 192.0.0.0/24
  [0xc0a80000, 16], // 192.168.0.0/16
  [0xc6120000, 15], // 198.18.0.0/15
  [0xe0000000, 4], // 224.0.0.0/4 (multicast)
  [0xf0000000, 4], // 240.0.0.0/4 (reservado e broadcast)
];

function v4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = n * 256 + Number(p);
  }
  return n;
}

/** IPv6 em 8 grupos de 16 bits (aceita "::" e IPv4 no fim). Texto inválido → null. */
function v6Groups(ip: string): number[] | null {
  let text = ip;
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted) {
    const v4 = v4ToInt(dotted[1]!);
    if (v4 === null) return null;
    text =
      text.slice(0, -dotted[1]!.length) +
      `${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const part = (s: string) => (s ? s.split(":") : []);
  const head = part(halves[0]!);
  const tail = halves.length === 2 ? part(halves[1]!) : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : fill < 1) return null;
  const all = [...head, ...Array(halves.length === 2 ? fill : 0).fill("0"), ...tail];
  if (all.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return all.map((g) => parseInt(g, 16));
}

const v4From = (hi: number, lo: number) => `${hi >>> 8}.${hi & 0xff}.${lo >>> 8}.${lo & 0xff}`;

/** IP privado, interno ou reservado (IPv4 ou IPv6). Texto que não é IP → false. */
export function isPrivateIp(raw: string): boolean {
  const ip = raw.replace(/^\[|\]$/g, "").toLowerCase();
  const v4 = v4ToInt(ip);
  if (v4 !== null)
    return V4_PRIVATE.some(([start, bits]) => {
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (v4 & mask) >>> 0 === start;
    });
  if (!ip.includes(":")) return false;
  const g = v6Groups(ip.replace(/%.*$/, "")); // sem o "%interface" do link-local
  if (!g) return true; // parece IPv6 mas não é válido: na dúvida, recusa
  const zeros = (n: number) => g.slice(0, n).every((x) => x === 0);
  // ::/96 (inclui :: e ::1) e ::ffff:0:0/96: IPv4 embutido; o servidor escreve em hexadecimal
  // ([::ffff:7f00:1] = 127.0.0.1), então a conferência é feita pelos números, não pelo texto.
  if (zeros(6)) return true; // IPv4-compatível (obsoleto), :: e ::1
  if (zeros(5) && g[5] === 0xffff) return isPrivateIp(v4From(g[6]!, g[7]!));
  if (g[0] === 0x64 && g[1] === 0xff9b) {
    // NAT64: 64:ff9b::/96 traduz para o IPv4 embutido; 64:ff9b:1::/48 é de uso local.
    if (g[2] === 1) return true;
    return isPrivateIp(v4From(g[6]!, g[7]!));
  }
  if (g[0] === 0x2002) return isPrivateIp(v4From(g[1]!, g[2]!)); // 6to4
  if (g[0] === 0x2001 && g[1] === 0) return true; // Teredo
  if (g[0] === 0x2001 && g[1] === 0xdb8) return true; // documentação
  if (g[0] === 0x100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true; // 100::/64
  const first = g[0]!;
  return (
    (first & 0xfe00) === 0xfc00 || // fc00::/7 (rede local)
    (first & 0xffc0) === 0xfe80 || // fe80::/10 (link-local)
    (first & 0xffc0) === 0xfec0 || // fec0::/10 (site-local, obsoleto)
    (first & 0xff00) === 0xff00 // ff00::/8 (multicast)
  );
}

export type Resolver = (host: string, type: "A" | "AAAA") => Promise<string[]>;

const denoResolver: Resolver = (host, type) => Deno.resolveDns(host, type);

/**
 * O endereço é público? Recusa nomes internos, IPs privados e nomes que resolvem para algum IP
 * privado, e nomes que não existem no DNS. Se o DNS não estiver disponível no ambiente, vale a
 * checagem pelo texto (não bloqueia todos os webhooks por limitação do ambiente).
 */
export async function isPublicHost(hostname: string, resolve: Resolver | null = defaultResolver()) {
  const host = hostname
    .replace(/^\[|\]$/g, "")
    .toLowerCase()
    .replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost")) return false;
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan")) return false;
  if (v4ToInt(host) !== null || host.includes(":")) return !isPrivateIp(host);
  if (!resolve) return true;
  let found = 0;
  let missing = 0;
  for (const type of ["A", "AAAA"] as const) {
    let ips: string[] = [];
    try {
      ips = await resolve(host, type);
    } catch (e) {
      // Sem registro desse tipo; outro erro = DNS indisponível no ambiente (vale o texto).
      if ((e as Error)?.name === "NotFound") missing++;
      continue;
    }
    if (ips.some((ip) => isPrivateIp(ip))) return false;
    found += ips.length;
    if (!ips.length) missing++;
  }
  // Nome que não existe (sem A nem AAAA): a entrega falharia de qualquer jeito; recusa já.
  return !(found === 0 && missing === 2);
}

function defaultResolver(): Resolver | null {
  return typeof Deno?.resolveDns === "function" ? denoResolver : null;
}
