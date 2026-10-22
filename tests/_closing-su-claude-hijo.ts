// =============================================================================
// Hijo de tests/closing-su-claude.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// IA12 (22/10/2026): corre `analyzeMeeting` REAL (lib/closing.ts) contra un PostgREST de mentira y anota con qué clave y qué
// modelo le pide a Anthropic:
//   · ws3 con su clave y Sonnet elegido → su clave, Sonnet, su marca en el gasto;
//   · ws11 con su clave rota → «Tu clave de Claude no pudo…», y la clave de MaKo NO se toca;
//   · ws13 sin clave, con el permiso de la plataforma VENCIDO (el reloj del hijo está el 20/11/2026) → «Conecta tu Claude».
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
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  const h = new Headers(init.headers);
  const clave = h.get('x-api-key') ?? h.get('authorization') ?? '';
  let model = '';
  try { model = JSON.parse(String(init.body ?? '{}')).model ?? ''; } catch { /* multipart */ }
  pedidos.push({ host: u.host, clave, model });
  if (u.host === 'api.anthropic.com' && clave.includes('ROTA')) return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }), { status: 400 });
  if (u.host === 'api.anthropic.com') return new Response(JSON.stringify({ content: [{ type: 'text', text: ANALISIS }], usage: { input_tokens: 50, output_tokens: 20 }, stop_reason: 'end_turn' }), { status: 200, headers: { 'content-type': 'application/json' } });
  return new Response(JSON.stringify({ error: { message: 'red de mentira' } }), { status: 500 });
}) as typeof fetch;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { analyzeMeeting } = await import('../lib/closing');
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, ...[3, 11, 13].map((id) => ({ id, capa: 'cliente', nombre: `ws${id}` })));
  const poner = (ws: number, valor: string) => pg.db.credenciales.push({ workspace_id: ws, clave: 'ANTHROPIC_API_KEY', valor_enc: cifrarSecreto(valor, ws, 'ANTHROPIC_API_KEY'), servicio: 'anthropic' });
  poner(9, process.env.ANTHROPIC_API_KEY!);
  poner(3, `sk-ant-api03-DEL-NEGOCIO-${'n'.repeat(40)}`);
  poner(11, `sk-ant-api03-ROTA-del-negocio-${'r'.repeat(40)}`);
  pg.db.app_settings.push({ workspace_id: 3, key: 'ia.su_claude.modelo', value: 'sonnet' });
  const reunion = { title: 'R2 con Juan', transcript: [{ speaker: { display_name: 'Closer' }, text: 'Hola Juan, ¿cómo va?', timestamp: '00:00:01' }], calendar_invitees: [], recorded_by: { name: 'Closer' } } as never;
  const out: Record<string, unknown> = {};
  for (const ws of [3, 11]) {
    pedidos.length = 0;
    const r = await runWithWorkspace(ws, () => analyzeMeeting(reunion, null));
    out[`ws${ws}`] = { r, pedidos: [...pedidos] };
  }
  // ws13: el reloj después del 13/11, cuando vence el permiso de closing de la plataforma.
  const Real = Date;
  const fijo = Real.parse('2026-11-20T12:00:00Z');
  globalThis.Date = class extends Real {
    constructor(...a: ConstructorParameters<typeof Date>) { if (a.length) super(...a); else super(fijo); }
    static now() { return fijo; }
  } as DateConstructor;
  pedidos.length = 0;
  const r13 = await runWithWorkspace(13, () => analyzeMeeting(reunion, null));
  globalThis.Date = Real;
  out.ws13 = { r: r13, pedidos: [...pedidos] };
  out.gasto = pg.db.anthropic_usage.map((f) => ({ ws: f.workspace_id, model: f.model, motivo: f.motivo }));
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
