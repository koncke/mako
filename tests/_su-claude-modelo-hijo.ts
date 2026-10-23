// =============================================================================
// Hijo de tests/su-claude-modelo.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// IA5 (22/10/2026): corre la puerta 2 REAL (lib/anthropic.ts → `conClaveDelNegocio`) contra un PostgREST de mentira y anota
// con qué modelo le pide a Anthropic:
//   · ws3 eligió Sonnet y su clave es suya → Sonnet, con la marca del negocio en el gasto;
//   · ws10 eligió Sonnet pero su clave es el crédito de Max de la plataforma (Martín le puso su cuenta 2) → Haiku;
//   · ws3 con una función del Plan → nada (el Plan nunca paga IA).
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
delete process.env.ANTHROPIC_API_KEY;
const CREDITO = `sk-ant-api03-CREDITO-DE-MAX-cuenta2-${'c'.repeat(40)}`;
process.env.ANTHROPIC_CREDITO_CUENTA2 = CREDITO;

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
const pedidos: Array<{ ws: number; model: string }> = [];
let wsEnCurso = 0;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host === 'api.anthropic.com') {
    pedidos.push({ ws: wsEnCurso, model: JSON.parse(String(init.body ?? '{}')).model });
    return new Response(JSON.stringify({ content: [{ type: 'text', text: 'hola' }], usage: { input_tokens: 5, output_tokens: 2 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('{}', { status: 500 });
}) as typeof fetch;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { conClaveDelNegocio } = await import('../lib/anthropic');
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: 3, capa: 'cliente', nombre: 'Prueba' }, { id: 10, capa: 'cliente', nombre: 'Leandro' });
  const poner = (ws: number, valor: string) => pg.db.credenciales.push({ workspace_id: ws, clave: 'ANTHROPIC_API_KEY', valor_enc: cifrarSecreto(valor, ws, 'ANTHROPIC_API_KEY'), servicio: 'anthropic' });
  poner(9, `sk-ant-api03-PLATAFORMA-${'p'.repeat(40)}`);
  poner(3, `sk-ant-api03-DEL-NEGOCIO-${'n'.repeat(40)}`);
  poner(10, CREDITO);
  for (const ws of [3, 10]) pg.db.app_settings.push({ workspace_id: ws, key: 'ia.su_claude.modelo', value: 'sonnet' });
  const out: Record<string, unknown> = {};
  const correr = async (ws: number, feature: string) => {
    wsEnCurso = ws;
    return runWithWorkspace(ws, () => conClaveDelNegocio({ system: 's', user: 'hola', feature, timeoutMs: 10_000 }));
  };
  out.ws3 = await correr(3, 'landing-analyst');
  out.ws10 = await correr(10, 'landing-analyst');
  // El Plan (Martín, 22/10/2026: «Sí, si es su clave»): el ws3 con SU clave, con Haiku aunque eligió Sonnet; el ws10, con el
  // crédito de Martín, no.
  out.plan = await correr(3, 'plan-fathom');
  out.planWs10 = await correr(10, 'plan-fathom');
  out.pedidos = pedidos;
  out.gasto = pg.db.anthropic_usage.map((f) => ({ ws: f.workspace_id, model: f.model, motivo: f.motivo }));
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
