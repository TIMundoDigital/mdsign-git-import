// Tarefas depois da resposta (EdgeRuntime.waitUntil, recurso das Edge Functions do Supabase).
// Fora do Supabase (testes, outro ambiente), espera a tarefa terminar antes de responder.

type EdgeRuntimeLike = { waitUntil: (p: Promise<unknown>) => void };

/** Roda a tarefa sem atrasar a resposta; erros são registrados no log. */
export async function inBackground(task: Promise<unknown>) {
  const safe = task.catch((e) => console.error("background", String(e).slice(0, 200)));
  const runtime = (globalThis as { EdgeRuntime?: EdgeRuntimeLike }).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(safe);
  else await safe;
}
