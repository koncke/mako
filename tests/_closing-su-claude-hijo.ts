// =============================================================================
// Hijo de tests/closing-su-claude.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// IA12 (22/10/2026): corre `analyzeMeeting` REAL (lib/closing.ts) contra un PostgREST de mentira y anota con qué clave y qué
// modelo le pide a Anthropic:
//   · ws3 con su clave y Sonnet elegido → su clave, Sonnet, su marca en el gasto;
//   · ws11 con su clave rota → «Tu clave de Claude no pudo…», y la clave de MaKo NO se toca;
//   · ws13 sin clave, con el permiso de la plataforma VENCIDO (el reloj del hijo está el 20/11/2026) → «Conecta tu Claude».
// El reloj del hijo está FIJO: el 10/11/2026 (con el permiso de closing vigente) salvo en el tramo «después del 13/11». Con el reloj
// real, el 14/11/2026 los casos que necesitan el permiso vigente cayeron todos en «venció» y la punta de Spy dio rojo (corrida 1306).
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.ANTHROPIC_API_KEY = `sk-ant-api03-PLATAFORMA-env-${'p'.repeat(40)}`;
delete process.env.ANTHROPIC_CREDITO_CUENTA1;
delete process.env.ANTHROPIC_CREDITO_CUENTA2;

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_pc_dispositivos', 'ia_cuotas', 'ia_rebotes'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
const pedidos: Array<{ host: string; clave: string; model: string }> = [];
const ANALISIS = JSON.stringify({ outcome: 'avanzó', scores: {}, notas: 'ok' });
/** Un bache SÓLO en la lectura de las claves de la plataforma (las filas del ws9): la frontera no se puede leer. */
let bacheEnLaFrontera = false;
/** La clave de la PLATAFORMA y el crédito que paga MaKo, sin crédito (revisión del tren m, 26/10/2026). */
let sinCreditoLaPlataforma = false;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test' && bacheEnLaFrontera && u.pathname.endsWith('/credenciales') && u.searchParams.get('workspace_id') === 'eq.9') {
    return new Response(JSON.stringify({ code: '57014', message: 'canceling statement due to statement timeout', details: null, hint: null }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
  if (u.host === 'supa.test') return pg.responder(u, init);
  const h = new Headers(init.headers);
  const clave = h.get('x-api-key') ?? h.get('authorization') ?? '';
  let model = '';
  try { model = JSON.parse(String(init.body ?? '{}')).model ?? ''; } catch { /* multipart */ }
  pedidos.push({ host: u.host, clave, model });
  if (u.host === 'api.anthropic.com' && sinCreditoLaPlataforma && /PLATAFORMA|CREDITO/.test(clave)) return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }), { status: 400 });
  if (u.host === 'api.anthropic.com' && clave.includes('ROTA')) return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }), { status: 400 });
  if (u.host === 'api.anthropic.com') return new Response(JSON.stringify({ content: [{ type: 'text', text: ANALISIS }], usage: { input_tokens: 50, output_tokens: 20 }, stop_reason: 'end_turn' }), { status: 200, headers: { 'content-type': 'application/json' } });
  return new Response(JSON.stringify({ error: { message: 'red de mentira' } }), { status: 500 });
}) as typeof fetch;

const Real = Date;
/** Antes de que venza el permiso de closing de la plataforma (`hasta` en lib/veto-claude.ts). */
const ANTES_DEL_13 = '2026-11-10T12:00:00Z';
function fijarReloj(iso: string) {
  const fijo = Real.parse(iso);
  globalThis.Date = class extends Real {
    constructor(...a: ConstructorParameters<typeof Date>) { if (a.length) super(...a); else super(fijo); }
    static now() { return fijo; }
  } as DateConstructor;
}

async function main() {
  fijarReloj(ANTES_DEL_13);
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { analyzeMeeting } = await import('../lib/closing');
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, ...[1, 3, 10, 11, 13].map((id) => ({ id, capa: 'cliente', nombre: `ws${id}` })));
  const poner = (ws: number, valor: string, clave = 'ANTHROPIC_API_KEY') => pg.db.credenciales.push({ workspace_id: ws, clave, valor_enc: cifrarSecreto(valor, ws, clave), servicio: 'anthropic' });
  poner(9, process.env.ANTHROPIC_API_KEY!);
  poner(3, `sk-ant-api03-DEL-NEGOCIO-${'n'.repeat(40)}`);
  poner(11, `sk-ant-api03-ROTA-del-negocio-${'r'.repeat(40)}`);
  // El ws1: una copia de la de la plataforma. El ws10: el crédito de Max de Martín (su cuenta 2), y eligió Sonnet.
  poner(1, process.env.ANTHROPIC_API_KEY!);
  const CREDITO = `sk-ant-api03-CREDITO-cuenta2-${'c'.repeat(40)}`;
  poner(10, CREDITO);
  poner(9, CREDITO, 'ANTHROPIC_CREDITO_CUENTA2');
  pg.db.app_settings.push({ workspace_id: 3, key: 'ia.su_claude.modelo', value: 'sonnet' }, { workspace_id: 10, key: 'ia.su_claude.modelo', value: 'sonnet' });
  // 26/10/2026: `analyzeMeeting` lee una `Reunion` de cualquier grabador (lib/grabadores); ésta viene de Fathom.
  const { deFathom } = await import('../lib/grabadores/reunion');
  const reunion = deFathom({ recording_id: 1, title: 'R2 con Juan', transcript: [{ speaker: { display_name: 'Closer' }, text: 'Hola Juan, ¿cómo va?', timestamp: '00:00:01' }], calendar_invitees: [], recorded_by: { name: 'Closer' } } as never);
  const out: Record<string, unknown> = {};
  for (const ws of [3, 11]) {
    pedidos.length = 0;
    const r = await runWithWorkspace(ws, () => analyzeMeeting(reunion, null));
    out[`ws${ws}`] = { r, pedidos: [...pedidos] };
  }
  // ws13: el reloj después del 13/11, cuando vence el permiso de closing de la plataforma.
  fijarReloj('2026-11-20T12:00:00Z');
  pedidos.length = 0;
  const r13 = await runWithWorkspace(13, () => analyzeMeeting(reunion, null));
  const { conQueAnalizaElClosing } = await import('../lib/closing');
  const despuesDel13 = { ws1: await runWithWorkspace(1, conQueAnalizaElClosing), ws3: await runWithWorkspace(3, conQueAnalizaElClosing) };
  fijarReloj(ANTES_DEL_13);
  out.ws13 = { r: r13, pedidos: [...pedidos] };

  // ── Lo que encontró la revisión adversarial de IA5/IA12 (22/10/2026) ────────────────────────────────────────────────
  const { chatClaude } = await import('../lib/anthropic');
  // (a) con un bache en la frontera, el closing caía a `chatClaude`, que pagaba Sonnet con la clave del negocio (ws3) o con
  //     el crédito de Martín (ws10). Ahora: error que se reintenta, y ningún pedido a Anthropic.
  const bache: Record<string, unknown> = {};
  bacheEnLaFrontera = true;
  for (const ws of [3, 10]) {
    pedidos.length = 0;
    const r = await runWithWorkspace(ws, () => analyzeMeeting(reunion, null));
    bache[`ws${ws}`] = { r, pedidos: [...pedidos] };
  }
  bache.cron = await runWithWorkspace(3, conQueAnalizaElClosing);
  bacheEnLaFrontera = false;
  out.bache = bache;
  // (b) el control del ws10 sin bache: Haiku sobre el crédito, aunque eligió Sonnet. Con el ENTORNO del crédito puesto con
  //     otra clave (una rotada): la fila se lee igual. Antes, con el entorno puesto la fila no se miraba.
  process.env.ANTHROPIC_CREDITO_CUENTA2 = `sk-ant-api03-CREDITO-rotada-${'z'.repeat(40)}`;
  pedidos.length = 0;
  out.ws10 = { r: await runWithWorkspace(10, () => analyzeMeeting(reunion, null)), pedidos: [...pedidos] };
  // (c) la lista blanca no paga con una clave que no es de la plataforma, aunque `credWs` la devuelva.
  pedidos.length = 0;
  const directo = await runWithWorkspace(3, () => chatClaude('s', [{ role: 'user', content: 'hola' }], { feature: 'closing', thinking: false }).then(() => 'contestó', (e) => `tiró: ${e instanceof Error ? e.message : String(e)}`));
  out.chatClaudeConSuClave = { r: directo, pedidos: [...pedidos] };
  const { chatClaudeTools } = await import('../lib/anthropic');
  pedidos.length = 0;
  const conTools = await runWithWorkspace(3, () => chatClaudeTools('s', [{ role: 'user', content: 'hola' }], [], async () => 'ok', { feature: 'closing', model: 'claude-sonnet-5' }).then(() => 'contestó', (e) => `tiró: ${e instanceof Error ? e.message : String(e)}`));
  out.chatClaudeToolsConSuClave = { r: conTools, pedidos: [...pedidos] };
  // (d) el cron pregunta lo mismo que el análisis.
  out.cron = {
    antesDel13: { ws1: await runWithWorkspace(1, conQueAnalizaElClosing), ws3: await runWithWorkspace(3, conQueAnalizaElClosing), ws13: await runWithWorkspace(13, conQueAnalizaElClosing) },
    despuesDel13,
  };
  // (e) Revisión del tren m (26/10/2026): la clave de la PLATAFORMA (el ws1 tiene una copia) o el crédito que paga MaKo (el
  //     ws10) sin crédito NO es «de su cuenta». El error tiene la misma forma que el de la clave del negocio; lo que los
  //     separa es `deSuClave`, y sin la marca el Closing le pedía al negocio que cargara crédito en una cuenta ajena.
  sinCreditoLaPlataforma = true;
  const plataforma: Record<string, unknown> = {};
  for (const ws of [1, 10]) {
    pedidos.length = 0;
    plataforma[`ws${ws}`] = { r: await runWithWorkspace(ws, () => analyzeMeeting(reunion, null)), pedidos: [...pedidos] };
  }
  sinCreditoLaPlataforma = false;
  out.plataformaSinCredito = plataforma;
  out.gasto = pg.db.anthropic_usage.map((f) => ({ ws: f.workspace_id, model: f.model, motivo: f.motivo }));
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
