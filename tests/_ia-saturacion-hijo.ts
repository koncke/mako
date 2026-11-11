// =============================================================================
// Hijo de tests/ia-saturacion.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre la cascada REAL (lib/ai-cheap.ts) contra una base y un Google de mentira, y anota qué MODELO se pidió, con qué PLAZO
// y cuántas veces. Los negocios: el espacio de MaKo (ws9, una sola Gemini, como el caso del 26/10/2026) y un cliente con SU
// Gemini sola (ws13: corre con «sólo su IA», y su OpenAI no existe). El Google de mentira:
//   · `gemini-flash-latest` CUELGA (no contesta hasta que el pedido se corta) o contesta 503 «high demand», según la vuelta;
//   · `gemini-flash-lite-latest` contesta bien enseguida, o 503 en la vuelta F.
// Los cortes por plazo no se esperan de verdad: `AbortSignal.timeout(ms)` anota el `ms` pedido y corta a los 50 ms. Lo que
// se mide es el plazo que la cascada PIDIÓ.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'GEMINI_MODEL', 'ANTHROPIC_CREDITO_CUENTA1', 'ANTHROPIC_CREDITO_CUENTA2', 'ANTHROPIC_CREDITO_CUENTA3', 'ANTHROPIC_CREDITO_CUENTA4', 'ANTHROPIC_CREDITO_CUENTA5']) delete process.env[k];

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});

/** Cada pedido a Google: el modelo y el plazo que pidió la cascada. */
let pedidos: Array<{ modelo: string; plazo: number | null }> = [];
/** Cada pedido al crédito de Claude de la plataforma: el modelo, el tope de tokens y la clave. */
let credito: Array<{ model: string; max_tokens: number; clave: string }> = [];
/** El plazo que pidió cada pedido al crédito, y cuánto le quedaba en ese momento al pedido entero (`hastaDelPedido`). */
let plazosDelCredito: Array<{ plazo: number | null; quedaban: number | null }> = [];
let hastaDelPedido: number | null = null;
let creditoCuelga = false;
/** El crédito contesta «credit balance is too low» (la cuenta sin saldo del mes). */
let creditoSinSaldo = false;
let flashLatest: 'cuelga' | '503' = 'cuelga';
let flashLite: 'ok' | '503' = 'ok';
const plazos = new WeakMap<AbortSignal, number>();
const timeoutOriginal = AbortSignal.timeout.bind(AbortSignal);
AbortSignal.timeout = ((ms: number) => {
  const s = timeoutOriginal(Math.min(ms, 50));
  plazos.set(s, ms);
  return s;
}) as typeof AbortSignal.timeout;

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
const alta = json([{ error: { code: 503, message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.', status: 'UNAVAILABLE' } }], 503);
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  // El crédito de Claude de la plataforma (el último recurso del espacio de MaKo): anota qué pidió y contesta.
  if (u.host === 'api.anthropic.com') {
    const c = JSON.parse(String(init.body ?? '{}')) as { model?: string; max_tokens?: number };
    credito.push({ model: String(c.model ?? ''), max_tokens: Number(c.max_tokens ?? 0), clave: new Headers(init.headers).get('x-api-key') ?? '' });
    plazosDelCredito.push({ plazo: init.signal ? plazos.get(init.signal) ?? null : null, quedaban: hastaDelPedido == null ? null : hastaDelPedido - Date.now() });
    if (creditoSinSaldo) return json({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }, 400);
    if (creditoCuelga) {
      return new Promise<Response>((_ok, mal) => {
        init.signal?.addEventListener('abort', () => mal(init.signal?.reason ?? new DOMException('The operation was aborted due to timeout', 'TimeoutError')));
      });
    }
    return json({ content: [{ type: 'text', text: 'respuesta del crédito' }], usage: { input_tokens: 10, output_tokens: 5 } });
  }
  if (u.host !== 'generativelanguage.googleapis.com') return json({ error: { message: 'red de mentira' } }, 500);
  const cuerpo = JSON.parse(String(init.body ?? '{}')) as { model?: string };
  const modelo = String(cuerpo.model ?? '');
  pedidos.push({ modelo, plazo: init.signal ? plazos.get(init.signal) ?? null : null });
  if (modelo === 'gemini-flash-lite-latest') {
    if (flashLite === '503') return alta.clone();
    return json({ choices: [{ message: { content: `respuesta de ${modelo}` }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
  }
  if (flashLatest === '503') return alta.clone();
  // Cuelga: contesta sólo cuando el pedido se corta (como un Google saturado que no responde).
  return new Promise<Response>((_ok, mal) => {
    const s = init.signal;
    if (!s) return;
    s.addEventListener('abort', () => mal(s.reason ?? new DOMException('The operation was aborted due to timeout', 'TimeoutError')));
  });
}) as typeof fetch;

const PLATAFORMA = 9, CLIENTE = 13;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const ai = await import('../lib/ai-cheap');
  const sat = await import('../lib/ia-saturacion');
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' }, { id: CLIENTE, capa: 'cliente', nombre: 'ws13' });
  for (const ws of [PLATAFORMA, CLIENTE]) {
    pg.db.credenciales.push({ workspace_id: ws, clave: 'GEMINI_API_KEY', valor_enc: cifrarSecreto(`gemini-${ws}-${'k'.repeat(40)}`, ws, 'GEMINI_API_KEY'), servicio: 'GEMINI_API_KEY' });
  }

  const { conSoloSuIA } = await import('../lib/solo-su-ia');
  const out: Record<string, unknown> = {};
  type Op = { ws?: number; hastaMs?: number; maxTokens?: number; timeoutMs?: number; listaPorDefault?: boolean; red?: boolean; pii?: boolean };
  const pedido = (o: Op) => () => ai.chatCheapCascade({
    system: 's', user: 'las secciones de la réplica', feature: 'landing-editor', ...(o.listaPorDefault ? {} : { provs: ['gemini' as const] }), timeoutMs: o.timeoutMs ?? 88_800,
    ...(o.maxTokens ? { maxTokens: o.maxTokens } : {}), ...(o.hastaMs ? { hastaMs: o.hastaMs } : {}),
    ...(o.red ? { redDePlataforma: true } : {}), ...(o.pii ? { pii: true } : {}),
  }).catch((e) => `tiró: ${e instanceof Error ? e.message : String(e)}`);
  const cascada = (o: Op = {}) => runWithWorkspace(o.ws ?? PLATAFORMA, pedido(o));
  // Un cliente SIN «sólo su IA» (el AI Step que corre desde el CRON): ahí la red de la plataforma sí podría correr.
  const cascadaSinD6b = (o: Op) => runWithWorkspace(o.ws ?? CLIENTE, () => conSoloSuIA(false, pedido(o)));
  const reset = (latest: 'cuelga' | '503', lite: 'ok' | '503' = 'ok') => { sat.olvidarSaturados(); pedidos = []; flashLatest = latest; flashLite = lite; };

  // A. Una tanda GRANDE y sana-o-colgada (7.400 tokens) con 42 s de plazo: el intento pide TODO el plazo (sin reservar), y su
  //    corte no marca al modelo: no tuvo el plazo que su tamaño pedía (88,8 s).
  reset('cuelga');
  out.A = { respuesta: await cascada({ hastaMs: Date.now() + 42_000, maxTokens: 7_400 }), pedidos, saturadoDespues: sat.estaSaturado('gemini', 'gemini-flash-latest') };
  // A2. Un pedido CHICO (sin maxTokens: 30 s esperados) que cuelga sus 30 s enteros: en ESTE pedido no se reintenta (se pasa al
  //     respaldo), pero un timeout NUNCA marca al modelo para el proceso (verificación del tren-m, hallazgo 17).
  reset('cuelga');
  out.A2 = { respuesta: await cascada({ timeoutMs: 30_000 }), pedidos, saturadoDespues: sat.estaSaturado('gemini', 'gemini-flash-latest') };
  // C. flash-latest contesta 503 «high demand»: no se reintenta, se pasa al respaldo, y queda saturado.
  reset('503');
  out.C = { respuesta: await cascada({ hastaMs: Date.now() + 42_000 }), pedidos, saturadoDespues: sat.estaSaturado('gemini', 'gemini-flash-latest') };
  // B. Enseguida, otro pedido: el modelo saturado va al FINAL, así que empieza por el respaldo.
  pedidos = [];
  out.B = { respuesta: await cascada({ hastaMs: Date.now() + 42_000 }), pedidos };
  // H. Una RÉPLICA (`conMemoriaDelPedido`): la tanda 1 se cuelga con su plazo entero; la tanda 2 de la misma réplica empieza
  //    por el respaldo. Afuera de la réplica, el pedido siguiente empieza por flash-latest como siempre.
  reset('cuelga');
  const h: Record<string, unknown> = {};
  await sat.conMemoriaDelPedido(async () => {
    await cascada({ hastaMs: Date.now() + 42_000, maxTokens: 7_400 });
    h.tanda1 = pedidos; pedidos = [];
    await cascada({ hastaMs: Date.now() + 42_000, maxTokens: 7_400 });
    h.tanda2 = pedidos; pedidos = [];
  });
  await cascada({ hastaMs: Date.now() + 42_000, maxTokens: 7_400 });
  h.afuera = pedidos;
  h.saturadoDespues = sat.estaSaturado('gemini', 'gemini-flash-latest');
  out.H = h;
  // D. Sin plazo del que llama: el intento pide su timeout de siempre.
  reset('cuelga');
  out.D = { respuesta: await cascada(), pedidos };
  // E. El turno con herramientas (MaKo en WhatsApp) también anota el «high demand».
  reset('503');
  const tool = [{ name: 'contar_leads', description: 'Cuenta', input_schema: { type: 'object', properties: {} } }];
  await runWithWorkspace(PLATAFORMA, () => ai.chatCheapToolsCascade('s', [{ role: 'user', content: 'hola' }], tool as never, async () => 'ok', { provs: ['gemini'], feature: 'chatbot-paso-ia' }).catch(() => null));
  out.E = { pedidos, saturadoDespues: sat.estaSaturado('gemini', 'gemini-flash-latest') };
  // F. La lista por default (gemini y openai) en un negocio SIN clave de OpenAI: flash-lite es la ÚLTIMA opción real, y un 503
  //    suyo se reintenta (antes, `openai` en la lista contaba como «otra opción» y se cortaba sin reintento).
  reset('503', '503');
  out.F = { respuesta: await cascada({ hastaMs: Date.now() + 20_000, listaPorDefault: true }), pedidos };
  // F2. Lo mismo en un cliente con SU Gemini sola (corre con «sólo su IA»: su lista es openai y gemini, y su OpenAI no existe).
  reset('503', '503');
  out.F2 = { respuesta: await cascada({ ws: CLIENTE, hastaMs: Date.now() + 20_000, listaPorDefault: true }), pedidos };
  // G. Con la red de la plataforma PEDIDA pero que no corre (verificación del tren-m, hallazgo 18): un pedido con datos de
  //    clientes (el AI Step que le contesta a un lead), y el super admin (que ya probó sus keys). flash-lite es la última opción
  //    real: su 503 se reintenta.
  reset('503', '503');
  out.G = { respuesta: await cascadaSinD6b({ hastaMs: Date.now() + 20_000, listaPorDefault: true, red: true, pii: true }), pedidos };
  reset('503', '503');
  out.G2 = { respuesta: await cascada({ hastaMs: Date.now() + 20_000, listaPorDefault: true, red: true }), pedidos };
  // G3. Un cliente SIN datos de clientes, con la red pedida: la red gratis no corre para ningún negocio (22/10/2026), así que
  //     tampoco es «otra opción» (segunda verificación del tren-m: producción reintentaba y la rama no).
  reset('503', '503');
  out.G3 = { respuesta: await cascadaSinD6b({ hastaMs: Date.now() + 20_000, listaPorDefault: true, red: true }), pedidos };
  // P. EL CRÉDITO DE CLAUDE PRIMERO EN EL ESPACIO DE MaKo (Martín, 11/11/2026: «gastemos eso para todo esto en lugar de Gemini»),
  //    con la clave del crédito cargada: en el ws9 va ANTES que sus Gemini, para cualquier tarea que no sea del Plan; nunca para
  //    un negocio, nunca con `sinCredito` (`fallback: []`), nunca con un pedido que no entra en Haiku. Cada vuelta anota los
  //    pedidos a Google, los del crédito y las filas de uso con la marca del crédito.
  process.env.ANTHROPIC_CREDITO_CUENTA1 = 'sk-ant-credito-de-prueba-cuenta-1';
  const usoDelCredito = () => (pg.db.anthropic_usage ?? []).filter((f) => String(f.motivo ?? '').startsWith('⚠ crédito de Claude de la plataforma')).length;
  const vuelta = async (fn: () => Promise<unknown>) => {
    credito = [];
    plazosDelCredito = [];
    const antes = usoDelCredito();
    const respuesta = await fn();
    hastaDelPedido = null;
    return { respuesta, pedidos, credito, plazosDelCredito, filasDeUso: usoDelCredito() - antes };
  };
  // ⏱ 32 s de plazo: el crédito sólo va si le deja un intento entero (15 s) a Gemini; con 20 s no se prueba (P_corto).
  const hasta = (ms = 32_000) => (hastaDelPedido = Date.now() + ms);
  const enMaKo = (o: { feature: string; user?: string; sinCredito?: boolean }) => () => runWithWorkspace(PLATAFORMA, () => ai.chatCheapCascade({
    system: 's', user: o.user ?? 'otra tarea', feature: o.feature, provs: ['gemini'], timeoutMs: 30_000, hastaMs: hasta(),
    ...(o.sinCredito ? { sinCredito: true } : {}),
  }).catch((e) => `tiró: ${e instanceof Error ? e.message : String(e)}`));
  reset('503', '503');
  out.P = await vuelta(() => cascada({ hastaMs: hasta(), maxTokens: 7_400 }));
  reset('503', 'ok');
  out.P_gratisContesta = await vuelta(() => cascada({ hastaMs: hasta(), maxTokens: 7_400 }));
  // Los que NO usan el crédito van con flash-lite sano: lo que se mira es el crédito, y así no esperan los reintentos de Gemini.
  reset('503', 'ok');
  out.P_negocio = await vuelta(() => cascadaSinD6b({ hastaMs: hasta(), maxTokens: 7_400, red: true }));
  reset('503', '503');
  out.P_otraTarea = await vuelta(enMaKo({ feature: 'dashboard-conclusiones' }));
  reset('503', '503');
  out.P_plan = await vuelta(enMaKo({ feature: 'plan-fathom' }));
  reset('503', 'ok');
  out.P_sinCredito = await vuelta(enMaKo({ feature: 'dashboard-conclusiones', sinCredito: true }));
  // 600.000 caracteres son ~171.000 tokens a la cuenta de la cascada: no entran en Haiku (200K, techo 150K) y sí en Gemini.
  reset('503', 'ok');
  out.P_noEntra = await vuelta(enMaKo({ feature: 'dashboard-conclusiones', user: 'x'.repeat(600_000) }));
  // El crédito que se CORTA por plazo: no contesta, pero puede haber gastado (queda su fila con la marca), y pasa a Gemini sin
  // probar la otra cuenta (es el mismo Anthropic). Pidió lo que quedaba MENOS un intento entero: Gemini, la última opción real,
  // tiene su plazo y sus reintentos. Con 20 s (P_corto) no alcanza para los dos: el crédito no se prueba y Gemini tiene todo.
  reset('503', '503');
  process.env.ANTHROPIC_CREDITO_CUENTA2 = 'sk-ant-credito-de-prueba-cuenta-2';
  creditoCuelga = true;
  out.P_corte = await vuelta(() => cascada({ hastaMs: hasta(), maxTokens: 7_400 }));
  reset('503', '503');
  out.P_corto = await vuelta(() => cascada({ hastaMs: hasta(20_000), maxTokens: 7_400 }));
  creditoCuelga = false;
  delete process.env.ANTHROPIC_CREDITO_CUENTA2;
  // Sin saldo (va AL FINAL: deja la cuenta salteada 6 h en el proceso): la fila «sin crédito» y Gemini contesta.
  reset('503', 'ok');
  creditoSinSaldo = true;
  out.P_sinSaldo = await vuelta(() => cascada({ hastaMs: hasta(), maxTokens: 7_400 }));
  out.P_sinSaldoFila = (pg.db.anthropic_usage ?? []).map((f) => String(f.motivo ?? '')).filter((m) => /sin crédito hasta el próximo ciclo/.test(m)).length;
  creditoSinSaldo = false;
  delete process.env.ANTHROPIC_CREDITO_CUENTA1;
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

// ⚠️ El timer de `AbortSignal.timeout` no mantiene vivo el proceso: con el pedido colgado como única espera, Node terminaba
// con código 0 sin imprimir nada. Este intervalo lo sostiene hasta el final.
const vivo = setInterval(() => {}, 1_000);
main().finally(() => clearInterval(vivo)).then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
