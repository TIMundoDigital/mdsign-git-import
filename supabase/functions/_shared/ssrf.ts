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
  // IPv4 dentro do IPv6 (::ffff:10.0.0.1).
  const mapped = /^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped) return isPrivateIp(mapped[1]!);
  if (ip === "::" || ip === "::1") return true;
  const first = parseInt(ip.split(":")[0] || "0", 16);
  return (
    (first & 0xfe00) === 0xfc00 || // fc00::/7 (rede local)
    (first & 0xffc0) === 0xfe80 || // fe80::/10 (link-local)
    (first & 0xff00) === 0xff00 // ff00::/8 (multicast)
  );
}

export type Resolver = (host: string, type: "A" | "AAAA") => Promise<string[]>;

const denoResolver: Resolver = (host, type) => Deno.resolveDns(host, type);

/**
 * O endereço é público? Recusa nomes internos, IPs privados e nomes que resolvem para algum IP
 * privado. Se o DNS não estiver disponível no ambiente ou falhar, vale a checagem pelo texto
 * (não bloqueia todos os webhooks por limitação do ambiente); um nome inexistente falha na entrega.
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
  for (const type of ["A", "AAAA"] as const) {
    let ips: string[] = [];
    try {
      ips = await resolve(host, type);
    } catch {
      continue; // sem registro desse tipo, ou DNS indisponível
    }
    if (ips.some((ip) => isPrivateIp(ip))) return false;
  }
  return true;
}

function defaultResolver(): Resolver | null {
  return typeof Deno?.resolveDns === "function" ? denoResolver : null;
}
