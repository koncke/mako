// =============================================================================
// Hijo de tests/carruseles-editar-a-tiempo.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El ticket 119 (19/11/2026, Leila: «Tu IA tardó más de 4 minutos en escribir la versión y se cortó»). Corre la cascada de visión
// REAL (`leerDocumentoIA`, lib/ai-cheap.ts) contra un PostgREST de mentira y una red de mentira, en un negocio con SU Gemini y SU
// GPT (como el ws 11):
//   · `gemini-flash-latest` no contesta: se queda esperando hasta que el pedido se aborta (medido: 184 s con el pensar al mínimo
//     para un carrusel de 12 láminas, y sin terminar en 240 s con el de siempre: con el plazo de 120 s, nunca llegaba);
//   · `gemini-flash-lite-latest` contesta en el acto; GPT también.
// Anota a qué modelo salió cada pedido, cuánto tardó cada lectura y qué tiró.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'GEMINI_MODEL', 'GEMINI_VISION_MODEL']) delete process.env[k];

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos', 'ia_saldos'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
/** Cada pedido que salió a una IA: `gemini:<modelo>` u `openai`. */
let pedidos: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'generativelanguage.googleapis.com') {
    const modelo = /\/models\/([^:/]+):/.exec(u.pathname)?.[1] ?? '?';
    pedidos.push(`gemini:${modelo}`);
    if (modelo === 'gemini-flash-latest') {
      // No contesta: espera a que el pedido se aborte por su plazo (el `AbortSignal.timeout` de leerConGemini). ⚠️ El reloj de
      // `AbortSignal.timeout` no mantiene vivo el proceso: sin el intervalo, el hijo terminaba mudo mientras «esperaba».
      return new Promise<Response>((_ok, mal) => {
        const s = init.signal;
        if (s?.aborted) return mal(s.reason);
        const vivo = setInterval(() => {}, 1_000);
        s?.addEventListener('abort', () => { clearInterval(vivo); mal(s.reason); }, { once: true });
      });
    }
    return json(200, { candidates: [{ content: { parts: [{ text: '{"ok":true,"de":"flash-lite"}' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } });
  }
  if (u.host === 'api.openai.com') {
    pedidos.push('openai');
    return json(200, { choices: [{ message: { content: '{"ok":true,"de":"gpt"}' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
  }
  pedidos.push(u.host);
  return json(500, { error: { message: 'red de mentira' } });
}) as typeof fetch;

const NEGOCIO = 11;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const ai = await import('../lib/ai-cheap');
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: NEGOCIO, capa: 'cliente', nombre: 'Leila de mentira' });
  const poner = (clave: string, valor: string) =>
    pg.db.credenciales.push({ workspace_id: NEGOCIO, clave, valor_enc: cifrarSecreto(valor, NEGOCIO, clave), servicio: clave.split('_')[0].toLowerCase() });
  poner('GEMINI_API_KEY', `AIza${'g'.repeat(35)}`);
  poner('OPENAI_API_KEY', `sk-proj-${'o'.repeat(48)}`);
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const leer = (extra: Record<string, unknown>) => ai.leerDocumentoIA({
    dataUrl: png, dataUrls: [png, png], isPdf: false, nombreArchivo: 'carrusel', prompt: 'el prompt de la réplica', json: true,
    feature: 'carrusel-replica', motivo: 'Editar un carrusel de ejemplo', maxTokens: 12_000, ...extra,
  } as Parameters<typeof ai.leerDocumentoIA>[0]);
  const casos: Record<string, () => Promise<unknown>> = {
    // «Editar» con el modelo de la réplica (lib/carruseles/replica-servidor.ts, `MODELOS_REPLICA`) y el plazo de siempre.
    conElModeloDeLaReplica: () => leer({ modelos: { gemini: 'gemini-flash-lite-latest' }, timeoutMs: 120_000 }),
    // Sin pedir modelo: el de por defecto primero (el que nunca llegaba). Con un plazo chico para no esperar 120 s.
    sinPedirModelo: () => leer({ timeoutMs: 1_500 }),
    // El plazo de la corrida ya casi vencido: no se arranca ningún intento.
    sinTiempoParaArrancar: () => leer({ timeoutMs: 120_000, hastaMs: Date.now() + 5_000 }),
    // El plazo de la corrida ACOTA el intento: el que no contesta se corta a ~16 s, no a los 120 s de su timeout.
    elPlazoAcotaElIntento: () => leer({ timeoutMs: 120_000, hastaMs: Date.now() + 16_000 }),
  };
  const out: Record<string, { pedidos: string[]; ms: number; de?: string; tiro?: string }> = {};
  for (const [nombre, f] of Object.entries(casos)) {
    pedidos = [];
    const t0 = Date.now();
    let de: string | undefined;
    let tiro: string | undefined;
    await runWithWorkspace(NEGOCIO, async () => {
      try { const r = await f() as { text: string; provider: string }; de = `${r.provider} ${r.text}`; } catch (e) { tiro = e instanceof Error ? e.message.slice(0, 400) : String(e); }
    });
    out[nombre] = { pedidos: [...pedidos], ms: Date.now() - t0, ...(de ? { de } : {}), ...(tiro ? { tiro } : {}) };
  }
  process.stdout.write(`@@A_TIEMPO@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@A_TIEMPO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
