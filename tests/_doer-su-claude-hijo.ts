// =============================================================================
// Hijo de tests/doer-su-ia.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// WA1 (22/10/2026): corre `chatClaudeTools` REAL con `soloSuClaude` (lo que usa el doer de WhatsApp después de su OpenAI)
// contra un PostgREST de mentira:
//   · ws3 con su clave de Claude → le pide a Anthropic con SU clave y el modelo de la puerta 2, sin `model` de la plataforma;
//   · ws13 sin clave → «falló la IA (el negocio no tiene su clave de Claude)», y la clave de MaKo no se toca.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.ANTHROPIC_API_KEY = `sk-ant-api03-PLATAFORMA-${'p'.repeat(40)}`;

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'ia_pc_dispositivos', 'ia_cuotas', 'ia_rebotes'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
const pedidos: Array<{ host: string; clave: string; model: string }> = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  const h = new Headers(init.headers);
  let model = '';
  try { model = JSON.parse(String(init.body ?? '{}')).model ?? ''; } catch { /* nada */ }
  pedidos.push({ host: u.host, clave: h.get('x-api-key') ?? h.get('authorization') ?? '', model });
  if (u.host === 'api.anthropic.com') return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Tienes 3 leads nuevos hoy.' }], stop_reason: 'end_turn', usage: { input_tokens: 9, output_tokens: 6 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  return new Response(JSON.stringify({ error: { message: 'red de mentira' } }), { status: 500 });
}) as typeof fetch;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { chatClaudeTools } = await import('../lib/anthropic');
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: 3, capa: 'cliente', nombre: 'Prueba' }, { id: 13, capa: 'cliente', nombre: 'Sin clave' });
  pg.db.credenciales.push({ workspace_id: 9, clave: 'ANTHROPIC_API_KEY', valor_enc: cifrarSecreto(process.env.ANTHROPIC_API_KEY!, 9, 'ANTHROPIC_API_KEY'), servicio: 'anthropic' });
  pg.db.credenciales.push({ workspace_id: 3, clave: 'ANTHROPIC_API_KEY', valor_enc: cifrarSecreto(`sk-ant-api03-DEL-NEGOCIO-${'n'.repeat(40)}`, 3, 'ANTHROPIC_API_KEY'), servicio: 'anthropic' });
  const tool = [{ name: 'contar_leads', description: 'Cuenta los leads', input_schema: { type: 'object', properties: {} } }];
  const out: Record<string, unknown> = {};
  for (const ws of [3, 13]) {
    pedidos.length = 0;
    let r: unknown;
    try {
      r = await runWithWorkspace(ws, () => chatClaudeTools('s', [{ role: 'user', content: '¿cuántos leads hoy?' }], tool as never, async () => '3', { feature: 'mako-doer-in', soloSuClaude: true, maxSteps: 4 }));
    } catch (e) { r = `tiró: ${e instanceof Error ? e.message : String(e)}`; }
    out[`ws${ws}`] = { r, pedidos: [...pedidos] };
  }
  out.gasto = pg.db.anthropic_usage.map((f) => ({ ws: f.workspace_id, model: f.model, motivo: f.motivo }));
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
