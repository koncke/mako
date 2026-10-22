// =============================================================================
// Hijo de tests/credito-marca.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La marca explícita del crédito de Martín en la clave de un negocio (lib/credito-marca.ts; decisión del Cerebro,
// 22/10/2026: «que no dependa del valor»). Corre la puerta 2 REAL contra un PostgREST de mentira:
//   A. con la fila del crédito en la plataforma y SIN marca: el ws10 va con Haiku (eligió Sonnet), su gasto queda como del
//      crédito, y la marca se escribe sola;
//   B. BORRADA la fila del crédito de la plataforma: el ws10 hace EXACTAMENTE lo mismo (Haiku, gasto del crédito, su Plan no
//      paga, la tarjeta dice «sólo Haiku»);
//   C. el control: el ws11, con SU clave y Sonnet elegido, Sonnet y gasto del negocio;
//   D. si el ws10 cambia su clave por una suya, la marca ya no vale (es de la huella de la vieja).
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_CREDITO_CUENTA1', 'ANTHROPIC_CREDITO_CUENTA2', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY']) delete process.env[k];

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_cuotas', 'ia_rebotes', 'ia_pc_dispositivos'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
const pedidos: Array<{ clave: string; model: string }> = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host === 'api.anthropic.com') {
    const h = new Headers(init.headers);
    let model = '';
    try { model = JSON.parse(String(init.body ?? '{}')).model ?? ''; } catch { /* nada */ }
    pedidos.push({ clave: (h.get('x-api-key') ?? '').slice(0, 26), model });
    return new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 5, output_tokens: 5 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response(JSON.stringify({ error: { message: 'red de mentira' } }), { status: 500, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const CREDITO = `sk-ant-api03-CREDITO-cuenta2-${'c'.repeat(40)}`;
const DE_MAKO = `sk-ant-api03-DE-MAKO-${'m'.repeat(40)}`;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { conClaveDelNegocio } = await import('../lib/anthropic');
  const { planConSuClave } = await import('../lib/ia-del-negocio');
  const { estadoDeSusClaves } = await import('../lib/su-clave');
  const { olvidarD6b } = await import('../lib/solo-su-ia');
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: 10, capa: 'cliente', nombre: 'ws10' }, { id: 11, capa: 'cliente', nombre: 'ws11' });
  const poner = (ws: number, clave: string, valor: string) => pg.db.credenciales.push({ workspace_id: ws, clave, valor_enc: cifrarSecreto(valor, ws, clave), servicio: 'anthropic' });
  poner(9, 'ANTHROPIC_API_KEY', DE_MAKO);
  poner(9, 'ANTHROPIC_CREDITO_CUENTA2', CREDITO);
  poner(10, 'ANTHROPIC_API_KEY', CREDITO);
  poner(11, 'ANTHROPIC_API_KEY', `sk-ant-api03-ws11-propia-${'k'.repeat(40)}`);
  for (const ws of [10, 11]) pg.db.app_settings.push({ workspace_id: ws, key: 'ia.su_claude.modelo', value: 'sonnet' });
  const out: Record<string, unknown> = {};
  const correr = async (ws: number, feature: string) => {
    pedidos.length = 0;
    const r = await runWithWorkspace(ws, () => conClaveDelNegocio({ system: 's', user: 'hola', feature, timeoutMs: 10_000 }));
    return { r: r && 'texto' in r ? 'texto' : r, pedidos: [...pedidos] };
  };
  const gasto = (ws: number) => pg.db.anthropic_usage.filter((f) => f.workspace_id === ws).map((f) => String(f.motivo ?? '')).pop() ?? '';
  const marca = () => pg.db.app_settings.find((f) => f.workspace_id === 10 && f.key === 'ia.su_claude.credito_de')?.value ?? null;
  const tarjeta = async (ws: number) => ((await estadoDeSusClaves(ws)) ?? []).find((c) => c.proveedor === 'anthropic')?.soloHaiku ?? null;

  // A. Con la fila del crédito, sin marca.
  out.A = { ws10: await correr(10, 'landing-analyst'), gasto: gasto(10), marca: marca() };
  // B. Sin la fila del crédito en la plataforma.
  pg.db.credenciales = pg.db.credenciales.filter((f) => !(f.workspace_id === 9 && f.clave === 'ANTHROPIC_CREDITO_CUENTA2'));
  olvidarD6b();
  out.B = {
    ws10: await correr(10, 'landing-analyst'),
    gasto: gasto(10),
    plan: await correr(10, 'plan-fathom'),
    planConSuClave: await planConSuClave(10),
    tarjeta: await tarjeta(10),
  };
  // C. El control: su clave de verdad.
  out.C = { ws11: await correr(11, 'landing-analyst'), gasto: gasto(11) };
  // D. El ws10 cambia su clave por una suya: la marca (de la vieja) ya no vale.
  pg.db.credenciales = pg.db.credenciales.filter((f) => !(f.workspace_id === 10 && f.clave === 'ANTHROPIC_API_KEY'));
  poner(10, 'ANTHROPIC_API_KEY', `sk-ant-api03-ws10-nueva-propia-${'n'.repeat(40)}`);
  olvidarD6b();
  out.D = { ws10: await correr(10, 'landing-analyst'), gasto: gasto(10) };
  out.claves = { CREDITO: CREDITO.slice(0, 26) };
  process.stdout.write(`@@CREDITO@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@CREDITO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
