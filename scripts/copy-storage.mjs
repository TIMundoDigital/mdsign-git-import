// Copia os arquivos do Storage entre dois projetos Supabase (migração para sa-east-1, ver
// docs/migracao-sa-east-1.md). Rode pelo scripts/copy-storage.sh, que pede as chaves sem mostrar
// na tela. Por padrão SÓ LISTA e compara; com --executar, copia o que falta e confere de novo.
//
// Variáveis: ORIGEM_URL, ORIGEM_CHAVE, DESTINO_URL, DESTINO_CHAVE (chaves service_role/secret).
import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["templates", "bulk-sources", "attachments"];
const executar = process.argv.includes("--executar");

const env = (k) => {
  const v = process.env[k]?.trim();
  if (!v) throw new Error(`Falta ${k}.`);
  return v;
};
const origem = createClient(env("ORIGEM_URL"), env("ORIGEM_CHAVE"), {
  auth: { persistSession: false },
});
const destino = createClient(env("DESTINO_URL"), env("DESTINO_CHAVE"), {
  auth: { persistSession: false },
});

/** Todos os arquivos do bucket (subpastas incluídas), com o tamanho. */
async function listar(client, bucket, prefix = "", depth = 0) {
  const out = new Map();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    for (const it of data ?? []) {
      const path = prefix ? `${prefix}/${it.name}` : it.name;
      if (it.id) out.set(path, it.metadata?.size ?? 0);
      else if (depth < 5)
        for (const [p, s] of await listar(client, bucket, path, depth + 1)) out.set(p, s);
    }
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

async function garantirBucket(bucket) {
  const { data } = await destino.storage.getBucket(bucket);
  if (data) return;
  const { data: o } = await origem.storage.getBucket(bucket);
  if (!executar) return console.log(`  (bucket ${bucket} não existe no destino: será criado)`);
  const { error } = await destino.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: o?.file_size_limit ?? undefined,
    allowedMimeTypes: o?.allowed_mime_types ?? undefined,
  });
  if (error) throw new Error(`criar bucket ${bucket}: ${error.message}`);
}

let divergente = false;
for (const bucket of BUCKETS) {
  await garantirBucket(bucket);
  const a = await listar(origem, bucket);
  let b = await listar(destino, bucket).catch(() => new Map());
  const faltam = [...a.keys()].filter((p) => !b.has(p));
  console.log(`${bucket}: origem ${a.size}, destino ${b.size}, faltam ${faltam.length}`);
  if (executar)
    for (const [i, path] of faltam.entries()) {
      const { data: blob, error } = await origem.storage.from(bucket).download(path);
      if (error) throw new Error(`baixar ${bucket}/${path}: ${error.message}`);
      const { error: up } = await destino.storage
        .from(bucket)
        .upload(path, blob, { contentType: blob.type || undefined, upsert: false });
      if (up && !/exists/i.test(up.message))
        throw new Error(`enviar ${bucket}/${path}: ${up.message}`);
      if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${faltam.length}`);
    }
  if (executar) b = await listar(destino, bucket);
  const diferentes = [...a].filter(([p, s]) => b.get(p) !== s).length;
  if (diferentes) {
    divergente = true;
    console.log(`  ⚠ ${diferentes} arquivo(s) ausentes ou com tamanho diferente no destino`);
  } else if (executar) console.log("  conferido: mesma quantidade e mesmos tamanhos");
}
if (!executar) console.log("\nSimulação: nada foi copiado. Para copiar, rode com --executar.");
process.exit(divergente && executar ? 1 : 0);
