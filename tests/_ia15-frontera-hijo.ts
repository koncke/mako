// =============================================================================
// Hijo de tests/ia15-frontera.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La revisión adversarial de IA15 (el Plan con la clave del negocio, 22/10/2026). Corre la capa REAL contra un PostgREST de
// mentira y anota a qué hosts sale cada llamada, y con qué clave:
//   1. las filas de la PLATAFORMA ilegibles (cifradas para otro workspace: el secreto rotó, la fila se dañó): el ws10 (su
//      «clave de Claude» es el crédito de Martín) y el ws16 (tiene copiada la clave de MaKo) no pagan con ellas, ni el Plan
//      ni lo demás;
//   2. `planConSuClave`, caso por caso: su PC sola no cuenta, una clave ilegible sí, una copia no, y sin poder leer, sí
//      e incierta (y eso no se recuerda);
//   3. lo que NO es del Plan, llamado desde adentro de una función del Plan, usa su decisión y no la del Plan.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'ANTHROPIC_CREDITO_CUENTA1', 'ANTHROPIC_CREDITO_CUENTA2']) delete process.env[k];

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
let red: Array<{ host: string; clave: string }> = [];
let tablaQueFalla: string | null = null;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test' && tablaQueFalla && u.pathname.endsWith(`/${tablaQueFalla}`)) {
    return new Response(JSON.stringify({ code: '57014', message: 'canceling statement due to statement timeout', details: null, hint: null }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
  if (u.host === 'supa.test') return pg.responder(u, init);
  const h = new Headers(init.headers);
  red.push({ host: u.host, clave: (h.get('x-api-key') ?? h.get('authorization') ?? h.get('x-goog-api-key') ?? '').replace(/^Bearer /, '').slice(0, 28) });
  return new Response(JSON.stringify({ error: { message: 'red de mentira' } }), { status: 500, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const PLATAFORMA = 9;
const CREDITO = `sk-ant-api03-CREDITO-cuenta2-${'c'.repeat(40)}`;
const DE_MAKO = `sk-ant-api03-DE-MAKO-${'m'.repeat(40)}`;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const ai = await import('../lib/ai-cheap');
  const { planConSuClave } = await import('../lib/ia-del-negocio');
  const { conD6bDelPedido, olvidarD6b } = await import('../lib/solo-su-ia');
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' }, ...[3, 10, 14, 16, 17, 18].map((id) => ({ id, capa: 'cliente', nombre: `ws${id}` })));
  /** `paraWs`: el workspace con el que se cifra. Otro que el de la fila = una fila que existe y no se descifra. */
  const poner = (ws: number, clave: string, valor: string, paraWs = ws) => pg.db.credenciales.push({ workspace_id: ws, clave, valor_enc: cifrarSecreto(valor, paraWs, clave), servicio: clave.split('_')[0].toLowerCase() });
  const out: Record<string, unknown> = {};
  const correr = async (ws: number, feature: string) => {
    red = [];
    await runWithWorkspace(ws, () => ai.chatCheapCascade({ system: 's', user: 'la reunión con Juan', feature, provs: ['gemini'] }).catch(() => ''));
    return [...red];
  };

  // ── 1) Las filas de la plataforma ILEGIBLES ───────────────────────────────────────────────────────────────────────
  poner(PLATAFORMA, 'ANTHROPIC_CREDITO_CUENTA2', CREDITO, 99);
  poner(PLATAFORMA, 'ANTHROPIC_API_KEY', DE_MAKO, 99);
  poner(PLATAFORMA, 'GEMINI_API_KEY', `AIza-plataforma-${'p'.repeat(30)}`);
  poner(10, 'ANTHROPIC_API_KEY', CREDITO); poner(10, 'GEMINI_API_KEY', `AIza-ws10-${'g'.repeat(30)}`);
  poner(16, 'ANTHROPIC_API_KEY', DE_MAKO); poner(16, 'GEMINI_API_KEY', `AIza-ws16-${'g'.repeat(30)}`);
  out.ilegible = {
    ws10Plan: await correr(10, 'plan-fathom'),
    ws16Plan: await correr(16, 'plan-fathom'),
    ws16NoPlan: await correr(16, 'landing-analyst'),
  };
  // Las filas de la plataforma, legibles otra vez (para lo que sigue).
  pg.db.credenciales = pg.db.credenciales.filter((f) => f.workspace_id !== PLATAFORMA);
  poner(PLATAFORMA, 'ANTHROPIC_CREDITO_CUENTA2', CREDITO);
  poner(PLATAFORMA, 'ANTHROPIC_API_KEY', DE_MAKO);
  poner(PLATAFORMA, 'GEMINI_API_KEY', `AIza-plataforma-${'p'.repeat(30)}`);
  olvidarD6b();

  // ── 2) `planConSuClave`, caso por caso ─────────────────────────────────────────────────────────────────────────────
  poner(3, 'OPENAI_API_KEY', `sk-proj-ws3-${'o'.repeat(40)}`);
  pg.db.ia_pc_dispositivos.push({ workspace_id: 14, revocado_at: null, activa_at: new Date().toISOString(), persona: 'x' }); // sólo su PC
  poner(17, 'ANTHROPIC_API_KEY', `sk-ant-api03-ws17-${'k'.repeat(40)}`, 99); // su clave, ilegible
  poner(18, 'ANTHROPIC_API_KEY', `sk-ant-api03-ws18-propia-${'k'.repeat(40)}`);
  const caso = async (ws: number) => planConSuClave(ws);
  out.plan = { ws3: await caso(3), ws10: await caso(10), ws14: await caso(14), ws16: await caso(16), ws17: await caso(17), ws18: await caso(18) };
  tablaQueFalla = 'credenciales';
  out.planConLaBaseCaida = await caso(18);
  // «No pude saber» del Plan no se recuerda: con la base caída el Plan del ws18 no paga (incierto) y, con la base de vuelta,
  // sí (su clave).
  olvidarD6b();
  out.ws18PlanConBache = await correr(18, 'plan-fathom');
  tablaQueFalla = null;
  out.ws18PlanDespues = await correr(18, 'plan-fathom');

  // El ws16 (una copia: su Plan dice «no») con la base caída: «no pude saber» dice «sí» para ESE pedido, y no se recuerda.
  // Con la base de vuelta, su Plan vuelve a lo de siempre (su Gemini).
  olvidarD6b();
  tablaQueFalla = 'credenciales';
  await correr(16, 'plan-fathom');
  tablaQueFalla = null;
  out.ws16PlanDespuesDelBache = await correr(16, 'plan-fathom');

  // ── 2b) La puerta 2 pide la decisión del Plan, aunque su frontera no vea nada ─────────────────────────────────────
  // (a) El crédito guardado con otro nombre (`…_2`): la frontera de la puerta 2 no lo ve, `planConSuClave` sí.
  const CREDITO3 = `sk-ant-api03-CREDITO-otra-${'d'.repeat(40)}`;
  poner(PLATAFORMA, 'ANTHROPIC_CREDITO_CUENTA1_2', CREDITO3);
  poner(19, 'ANTHROPIC_API_KEY', CREDITO3);
  pg.db.workspaces.push({ id: 19, capa: 'cliente', nombre: 'ws19' }, { id: 20, capa: 'cliente', nombre: 'ws20' });
  olvidarD6b();
  out.ws19PlanCreditoConOtroNombre = await correr(19, 'plan-fathom');
  // (b) Una fila de la plataforma ilegible que sólo lee `planConSuClave` (incierto): la puerta 2 lee bien la suya, pero la
  //     decisión del Plan no es cierta, y el Plan no paga.
  pg.db.credenciales = pg.db.credenciales.filter((f) => !(f.workspace_id === PLATAFORMA && f.clave === 'ANTHROPIC_CREDITO_CUENTA1_2'));
  poner(PLATAFORMA, 'ANTHROPIC_CREDITO_CUENTA1_2', CREDITO3, 99);
  poner(20, 'ANTHROPIC_API_KEY', `sk-ant-api03-ws20-propia-${'k'.repeat(40)}`);
  olvidarD6b();
  out.ws20PlanIncierto = await correr(20, 'plan-fathom');
  pg.db.credenciales = pg.db.credenciales.filter((f) => !(f.workspace_id === PLATAFORMA && f.clave === 'ANTHROPIC_CREDITO_CUENTA1_2'));
  olvidarD6b();

  // ── 3) Lo que no es del Plan, desde adentro de una función del Plan ───────────────────────────────────────────────
  // El ws10: su Plan dice «no» (la clave es el crédito), pero el negocio tiene su IA (D6b): lo que no es del Plan va a su
  // Claude y nunca a Gemini.
  olvidarD6b();
  red = [];
  await runWithWorkspace(10, () => conD6bDelPedido('plan-buscar', () => ai.chatCheapCascade({ system: 's', user: 'Juan quiere otra landing', feature: 'landing-analyst', provs: ['gemini'] }).catch(() => '')));
  out.noPlanAdentroDelPlan = [...red];

  out.claves = { CREDITO: CREDITO.slice(0, 28), DE_MAKO: DE_MAKO.slice(0, 28) };
  process.stdout.write(`@@IA15@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@IA15@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
