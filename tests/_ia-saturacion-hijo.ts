// =============================================================================
// Hijo de tests/ia-saturacion.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre la cascada REAL (lib/ai-cheap.ts) en el espacio de MaKo (ws9, una sola Gemini, como el caso del 26/10/2026) contra
// una base y un Google de mentira, y anota qué MODELO se pidió, con qué PLAZO y cuántas veces. El Google de mentira:
//   · `gemini-flash-latest` CUELGA (no contesta hasta que el pedido se corta) o contesta 503 «high demand», según la vuelta;
//   · `gemini-flash-lite-latest` contesta bien, enseguida.
// Los cortes por plazo no se esperan de verdad: `AbortSignal.timeout(ms)` anota el `ms` pedido y corta a los 50 ms. Lo que
// se mide es el plazo que la cascada PIDIÓ, que es lo que decide si al respaldo le queda lugar.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'GEMINI_MODEL']) delete process.env[k];

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});

/** Cada pedido a Google: el modelo y el plazo que pidió la cascada. */
let pedidos: Array<{ modelo: string; plazo: number | null }> = [];
let flashLatest: 'cuelga' | '503' = 'cuelga';
const plazos = new WeakMap<AbortSignal, number>();
const timeoutOriginal = AbortSignal.timeout.bind(AbortSignal);
AbortSignal.timeout = ((ms: number) => {
  const s = timeoutOriginal(Math.min(ms, 50));
  plazos.set(s, ms);
  return s;
}) as typeof AbortSignal.timeout;

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host !== 'generativelanguage.googleapis.com') return json({ error: { message: 'red de mentira' } }, 500);
  const cuerpo = JSON.parse(String(init.body ?? '{}')) as { model?: string };
  const modelo = String(cuerpo.model ?? '');
  pedidos.push({ modelo, plazo: init.signal ? plazos.get(init.signal) ?? null : null });
  if (modelo === 'gemini-flash-lite-latest') {
    return json({ choices: [{ message: { content: `respuesta de ${modelo}`, tool_calls: undefined }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
  }
  if (flashLatest === '503') return json([{ error: { code: 503, message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.', status: 'UNAVAILABLE' } }], 503);
  // Cuelga: contesta sólo cuando el pedido se corta (como un Google saturado que no responde).
  return new Promise<Response>((_ok, mal) => {
    const s = init.signal;
    if (!s) return;
    s.addEventListener('abort', () => mal(s.reason ?? new DOMException('The operation was aborted due to timeout', 'TimeoutError')));
  });
}) as typeof fetch;

const PLATAFORMA = 9;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const ai = await import('../lib/ai-cheap');
  const sat = await import('../lib/ia-saturacion');
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' });
  pg.db.credenciales.push({ workspace_id: PLATAFORMA, clave: 'GEMINI_API_KEY', valor_enc: cifrarSecreto(`gemini-${'k'.repeat(40)}`, PLATAFORMA, 'GEMINI_API_KEY'), servicio: 'GEMINI_API_KEY' });

  const out: Record<string, unknown> = {};
  const cascada = (hastaMs?: number) => runWithWorkspace(PLATAFORMA, () => ai.chatCheapCascade({
    system: 's', user: 'las secciones de la réplica', feature: 'landing-editor', provs: ['gemini'], timeoutMs: 88_800,
    ...(hastaMs ? { hastaMs } : {}),
  }).catch((e) => `tiró: ${e instanceof Error ? e.message : String(e)}`));

  // A. flash-latest CUELGA, con el plazo de una tanda de secciones (42 s): el respaldo tiene que contestar.
  sat.olvidarSaturados(); pedidos = []; flashLatest = 'cuelga';
  const inicioA = Date.now();
  out.A = { respuesta: await cascada(inicioA + 42_000), pedidos, quedabanMs: 42_000 };
  // B. Enseguida, otro pedido: el modelo saturado va al FINAL, así que empieza por el respaldo.
  pedidos = [];
  out.B = { respuesta: await cascada(Date.now() + 42_000), pedidos };
  // C. flash-latest contesta 503 «high demand» (sin cuelgue): no se reintenta, se pasa al respaldo.
  sat.olvidarSaturados(); pedidos = []; flashLatest = '503';
  out.C = { respuesta: await cascada(Date.now() + 42_000), pedidos, saturadoDespues: sat.estaSaturado('gemini', 'gemini-flash-latest') };
  // D. Sin plazo del que llama: el intento pide su timeout de siempre (nada que reservar).
  sat.olvidarSaturados(); pedidos = []; flashLatest = 'cuelga';
  out.D = { respuesta: await cascada(), pedidos };
  // E. El turno con herramientas (MaKo en WhatsApp) también anota el «high demand».
  sat.olvidarSaturados(); pedidos = []; flashLatest = '503';
  const tool = [{ name: 'contar_leads', description: 'Cuenta', input_schema: { type: 'object', properties: {} } }];
  await runWithWorkspace(PLATAFORMA, () => ai.chatCheapToolsCascade('s', [{ role: 'user', content: 'hola' }], tool as never, async () => 'ok', { provs: ['gemini'], feature: 'chatbot-paso-ia' }).catch(() => null));
  out.E = { pedidos, saturadoDespues: sat.estaSaturado('gemini', 'gemini-flash-latest') };
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

// ⚠️ El timer de `AbortSignal.timeout` no mantiene vivo el proceso: con el pedido colgado como única espera, Node terminaba
// con código 0 sin imprimir nada. Este intervalo lo sostiene hasta el final.
const vivo = setInterval(() => {}, 1_000);
main().finally(() => clearInterval(vivo)).then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
