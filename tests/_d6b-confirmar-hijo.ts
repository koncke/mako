// =============================================================================
// Hijo de tests/d6b-confirmar.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/mako-turno-app.ts lleva `server-only`: corre en un node aparte con `--conditions=react-server`. Corre los caminos
// REALES de CONFIRMAR una tarjeta —`confirmarDesdeTarjeta` (el chat de la app, el teléfono, el CRM y el Analyst) y la
// acción de la bandeja /mako/pendientes— contra un PostgREST de mentira (tests/_postgrest-de-mentira.ts). Lo único de
// mentira es la EJECUCIÓN de la tarjeta (`confirmarPendiente`, lib/api-mako/acciones.ts): se cambia en `Module._load`
// por una que hace lo que hace una tarjeta con costo de IA —pedirle a la cascada barata— y anota si corría adentro de
// «sólo su IA». Toda la red que no es la base se anota por host y contesta 500.
//
// El negocio (ws3) tiene su OpenAI (su IA, D6b) y además una Gemini vieja del onboarding: fuera del contexto, la cascada
// sale a Gemini; adentro, sólo a su OpenAI.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';

const WS = 3;
const PLATAFORMA = 9;
const PERSONA = { ws: WS, rol: 'admin' as const, actor: 'ana@negocio.com', chartKey: 'mako-movil:ana@negocio.com' };
const SESION = 77;

const pg = crearPostgrest({ tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos', 'chart_sessions', 'chart_chats', 'mako_acciones_pendientes'] });
let red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host);
  return new Response(JSON.stringify({ error: { message: 'red de mentira' } }), { status: 500, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

/** Cada ejecución de la tarjeta de mentira: si corrió adentro de «sólo su IA». */
const ejecuciones: boolean[] = [];
/** Una tarjeta con costo de IA: lo que hace `analizar_hoja_dashboard`, `generar_insight_lead`… le pide a la cascada. */
async function ejecutarTarjeta() {
  const { soloSuIA } = await import('../lib/solo-su-ia');
  const ai = await import('../lib/ai-cheap');
  ejecuciones.push(soloSuIA());
  await ai.chatCheapCascade({ system: 's', user: 'los números del negocio', provs: ['gemini', 'groq', 'openai'], redDePlataforma: true }).catch(() => '');
  return { ok: true, resumen: 'Listo', tipo: 'analizar_hoja_dashboard', datos: {} };
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Modulo = require('node:module') as { _load: (pedido: string, padre: unknown, esMain: boolean) => unknown };
const cargarOriginal = Modulo._load;
Modulo._load = function (this: unknown, pedido: string, padre: unknown, esMain: boolean) {
  if (pedido === '@/lib/api-mako/acciones') {
    const real = cargarOriginal.call(this, pedido, padre, esMain) as Record<string, unknown>;
    return { ...real, confirmarPendiente: ejecutarTarjeta };
  }
  if (pedido === 'next/cache') return { revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (f: unknown) => f };
  if (pedido === '../ctx-bandeja') return { ctxDeBandeja: async () => ({ ctx: { ws: WS, canal: 'app', canalKey: 'app:ws3', alcance: 'ejecutar', rol: 'admin', actor: PERSONA.actor } }) };
  return cargarOriginal.call(this, pedido, padre, esMain);
};

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' }, { id: WS, capa: 'cliente', nombre: 'Prueba' });
  for (const k of ['GEMINI_API_KEY', 'OPENAI_API_KEY']) pg.db.credenciales.push({ workspace_id: WS, clave: k, valor_enc: cifrarSecreto(`negocio-${k}-${'x'.repeat(30)}`, WS, k), servicio: k.split('_')[0].toLowerCase() });
  for (const k of ['GEMINI_API_KEY', 'GROQ_API_KEY']) pg.db.credenciales.push({ workspace_id: PLATAFORMA, clave: k, valor_enc: cifrarSecreto(`plataforma-${k}-${'y'.repeat(30)}`, PLATAFORMA, k), servicio: k.split('_')[0].toLowerCase() });
  pg.db.chart_sessions.push({ id: SESION, workspace_id: WS, chart_key: PERSONA.chartKey, titulo: 'Prueba', pinned: false, updated_at: new Date().toISOString(), created_at: new Date().toISOString() });

  const { runWithWorkspace } = await import('../lib/workspace');
  const { confirmarDesdeTarjeta } = await import('../lib/mako-turno-app');
  const { confirmarPendienteAction } = await import('../app/mako/pendientes/acciones');
  const out: Record<string, { red: string[]; adentro: boolean | null; ok?: unknown }> = {};
  const medir = async (nombre: string, f: () => Promise<unknown>) => {
    red = [];
    const antes = ejecuciones.length;
    let ok: unknown;
    try { ok = await f(); } catch (e) { ok = `tiró: ${e instanceof Error ? e.message : String(e)}`; }
    out[nombre] = { red: [...new Set(red)], adentro: ejecuciones.length > antes ? ejecuciones[ejecuciones.length - 1] : null, ok: (ok as { ok?: unknown })?.ok ?? ok };
  };
  // El control: la misma ejecución con D6b decidido AFUERA (como un negocio sin su IA): tiene que salir a la red gratis, o la
  // prueba no vería nada. Desde IA6 «a pelo» ya no sirve de control: la puerta de la capa de IA la pone adentro sola.
  const { conSoloSuIA } = await import('../lib/solo-su-ia');
  await medir('control', () => runWithWorkspace(WS, () => conSoloSuIA(false, ejecutarTarjeta)));
  // A pelo dentro del negocio, sin que nadie decida (IA6): la puerta decide por el negocio, que tiene su OpenAI.
  await medir('aPelo', () => runWithWorkspace(WS, ejecutarTarjeta));
  await medir('tarjetaDelChat', () => confirmarDesdeTarjeta(PERSONA, SESION, 123));
  await medir('bandeja', () => confirmarPendienteAction(123));
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
