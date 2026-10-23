// =============================================================================
// Hijo de tests/credito-negocio.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El crédito de la cuenta 1 como el Claude del ws1 (22/10/2026, Martín: «habilita los tokens de la API de la cuenta de
// Mauricio, esos 200, para su Ops Center»). Corre lo REAL (la puerta 2, el chat con herramientas, la cascada de texto, la
// tarjeta de «Tus cuentas de IA», la lectura del Uso y el interruptor) contra un PostgREST de mentira:
//   · ws9 (la plataforma): su ANTHROPIC_API_KEY y las claves del crédito de las cuentas 1 y 2;
//   · ws1: copias de las claves de Claude y OpenAI de la plataforma (como el de verdad, medido el 22/10);
//   · ws13: también copias, y ningún crédito asignado.
// Anthropic contesta 200 sólo con la clave del crédito de la cuenta 1; con cualquier otra, 401.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'ANTHROPIC_CREDITO_CUENTA1', 'ANTHROPIC_CREDITO_CUENTA2']) delete process.env[k];

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos'],
  defaults: (tabla, f) => (tabla === 'anthropic_usage' ? { id: ++n, created_at: new Date(Date.now() + n).toISOString(), ...f } : f),
});
const PLATAFORMA = 9;
const CLAUDE_MAKO = `sk-ant-api03-plataforma-${'p'.repeat(40)}`;
const OPENAI_MAKO = `sk-proj-plataforma-${'P'.repeat(40)}`;
const CREDITO1 = `sk-ant-api03-credito-cuenta1-${'c'.repeat(40)}`;
const CREDITO2 = `sk-ant-api03-credito-cuenta2-${'d'.repeat(40)}`;
const PROPIA = `sk-ant-api03-propia-de-mauricio-${'m'.repeat(40)}`;

let anthropic: Array<{ camino: string; clave: string; modelo: string }> = [];
let ajustesFallan = false;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test' && ajustesFallan && u.pathname.endsWith('/app_settings') && (init.method ?? 'GET') === 'GET') {
    return new Response(JSON.stringify({ code: '57014', message: 'canceling statement due to statement timeout', details: null, hint: null }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
  if (u.host === 'supa.test') return pg.responder(u, init);
  const r = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'api.anthropic.com') {
    const clave = new Headers(init.headers).get('x-api-key') ?? '';
    let modelo = '';
    try { modelo = String(JSON.parse(String(init.body ?? '{}')).model ?? ''); } catch { /* sin cuerpo */ }
    anthropic.push({ camino: u.pathname, clave: clave.slice(0, 32), modelo });
    if (clave !== CREDITO1 && clave !== PROPIA) return r(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
    return r(200, { id: 'msg_1', type: 'message', role: 'assistant', model: modelo, stop_reason: 'end_turn', content: [{ type: 'text', text: 'hola desde Claude' }], usage: { input_tokens: 1000, output_tokens: 200 } });
  }
  return r(500, { error: { message: 'red de mentira' } });
}) as typeof fetch;

const espera = () => new Promise((ok) => setTimeout(ok, 300));

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { permisoDeLaClaveDelNegocio, chatClaudeTools } = await import('../lib/anthropic');
  const ai = await import('../lib/ai-cheap');
  const { estadoDeSusClaves } = await import('../lib/su-clave');
  const { claveDelCreditoAsignado, guardarInterruptorDeCredito } = await import('../lib/credito-negocio');
  const { leerCreditoApi } = await import('../lib/credito-api-db');
  const { hayIAParaCrear } = await import('../lib/flujo-ia-crear');
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' }, { id: 1, capa: 'completo', nombre: 'Mauricio' }, { id: 13, capa: 'cliente', nombre: 'ws13' });
  const poner = (ws: number, clave: string, valor: string) => pg.db.credenciales.push({ workspace_id: ws, clave, valor_enc: cifrarSecreto(valor, ws, clave), servicio: clave.split('_')[0].toLowerCase() });
  poner(PLATAFORMA, 'ANTHROPIC_API_KEY', CLAUDE_MAKO);
  poner(PLATAFORMA, 'OPENAI_API_KEY', OPENAI_MAKO);
  poner(PLATAFORMA, 'ANTHROPIC_CREDITO_CUENTA1', CREDITO1);
  poner(PLATAFORMA, 'ANTHROPIC_CREDITO_CUENTA2', CREDITO2);
  for (const ws of [1, 13]) { poner(ws, 'ANTHROPIC_API_KEY', CLAUDE_MAKO); poner(ws, 'OPENAI_API_KEY', OPENAI_MAKO); }
  const ajustesDe = (ws: number) => pg.db.app_settings.filter((f) => f.workspace_id === ws).map((f) => `${f.key}=${f.value}`);
  const permiso = async (ws: number, feature: string) => {
    const r = await runWithWorkspace(ws, () => permisoDeLaClaveDelNegocio(feature)).catch((e) => ({ tiro: String(e) }));
    if (r && 'permiso' in r) return { clave: r.permiso.clave.slice(0, 32), modelo: r.permiso.model, esCredito: !!r.permiso.esCredito };
    return r ? Object.keys(r)[0] : null;
  };
  const out: Record<string, unknown> = {};

  // ── Prendido (sin fila: el default) ─────────────────────────────────────────────────────────────────────────────────
  out.permisoChat = await permiso(1, 'mako-doer');
  out.permisoAutomations = await permiso(1, 'chatbot-crear-ia');
  out.permisoPlan = await permiso(1, 'plan-fathom');
  out.permisoWs13 = await permiso(13, 'mako-doer');
  out.claveWs1 = (await claveDelCreditoAsignado(1))?.slice(0, 32) ?? null;
  // El chat con herramientas del Ops Center y de la estrella de cada tab: corre con el crédito, con Haiku.
  anthropic = [];
  out.chat = await runWithWorkspace(1, () => chatClaudeTools('s', [{ role: 'user', content: 'hola' }], [], async () => 'ok', { feature: 'mako-doer' }))
    .then((r) => r.text, (e) => `tiró: ${e instanceof Error ? e.message : String(e)}`);
  out.chatAnthropic = [...anthropic];
  // El chat de Automations (texto): su Claude primero en la cascada.
  anthropic = [];
  out.automations = await runWithWorkspace(1, () => ai.chatCheapCascade({ system: 's', user: 'armá un flujo', feature: 'chatbot-crear-ia' })).catch((e) => `tiró: ${String(e)}`);
  out.automationsAnthropic = [...anthropic];
  // La pregunta de la API de MaKo antes de proponer un flujo (lib/flujo-ia-crear.ts): su Claude también crea.
  out.hayIAParaCrear = await runWithWorkspace(1, () => hayIAParaCrear());
  await espera();
  out.gasto = pg.db.anthropic_usage.filter((f) => f.workspace_id === 1).map((f) => ({ motivo: String(f.motivo ?? '').slice(0, 70), costo: Number(f.cost_usd ?? 0) }));
  out.ajustesWs1 = ajustesDe(1);
  out.tarjeta = await estadoDeSusClaves(1).then((l) => l?.map((c) => `${c.proveedor}:${c.es}`) ?? null);
  out.tarjetaWs13 = await estadoDeSusClaves(13).then((l) => l?.map((c) => `${c.proveedor}:${c.es}`) ?? null);
  const lectura = await leerCreditoApi();
  out.uso = lectura.ok ? lectura.asignados : lectura;

  // ── Apagado desde SuperAdmin › Uso ──────────────────────────────────────────────────────────────────────────────────
  await guardarInterruptorDeCredito(1, false);
  out.ajustesPlataforma = ajustesDe(PLATAFORMA);
  out.apagadoPermiso = await permiso(1, 'mako-doer');
  out.apagadoClave = await claveDelCreditoAsignado(1);
  out.apagadoHayIAParaCrear = await runWithWorkspace(1, () => hayIAParaCrear());
  out.apagadoTarjeta = await estadoDeSusClaves(1).then((l) => l?.map((c) => `${c.proveedor}:${c.es}`) ?? null);
  const apagado = await leerCreditoApi();
  out.apagadoUso = apagado.ok ? apagado.asignados?.map((a) => a.prendido) : apagado;
  out.otroNegocio = await guardarInterruptorDeCredito(13, true).then(() => 'guardó', (e) => `tiró: ${e instanceof Error ? e.message : String(e)}`);
  await guardarInterruptorDeCredito(1, true);
  out.prendidoOtraVez = await permiso(1, 'mako-doer');

  // ── «No pude leer» el interruptor: apagado para ESE pedido ─────────────────────────────────────────────────────────
  ajustesFallan = true;
  out.sinLeer = await claveDelCreditoAsignado(1);
  ajustesFallan = false;

  // ── Con su clave propia, la suya gana ───────────────────────────────────────────────────────────────────────────────
  pg.db.credenciales = pg.db.credenciales.filter((f) => !(f.workspace_id === 1 && f.clave === 'ANTHROPIC_API_KEY'));
  poner(1, 'ANTHROPIC_API_KEY', PROPIA);
  out.conLaSuya = await permiso(1, 'mako-doer');
  process.stdout.write(`@@CREDITO@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@CREDITO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
