// =============================================================================
// Hijo de tests/credito-vigia.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre el vigía REAL (lib/credito-vigia.ts: lee el gasto con `leerCreditoApi`, guarda el %, reclama y manda los avisos) contra
// un PostgREST de mentira. Nada sale a ningún lado: WhatsApp no está configurado y cualquier red que no sea la base contesta 500;
// el aviso llega por la campanita (la tabla `notificaciones` de mentira).
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
for (const k of ['ANTHROPIC_API_KEY', 'EVOLUTION_API_URL', 'EVOLUTION_API_KEY', 'ANTHROPIC_CREDITO_CUENTA1', 'ANTHROPIC_CREDITO_CUENTA2', 'ANTHROPIC_CREDITO_CUENTA3', 'ANTHROPIC_CREDITO_CUENTA4', 'ANTHROPIC_CREDITO_CUENTA5']) delete process.env[k];
process.env.ANTHROPIC_CREDITO_CUENTA2 = `sk-ant-api03-credito-cuenta2-${'d'.repeat(40)}`;

let n = 0;
const pg = crearPostgrest({
  tablas: ['credenciales', 'workspaces', 'app_settings', 'anthropic_usage', 'notificaciones', 'mako_grupos', 'mako_mensajes'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
let gastoIlegible = false;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test' && gastoIlegible && u.pathname.endsWith('/anthropic_usage') && (init.method ?? 'GET') === 'GET') {
    return new Response(JSON.stringify({ code: '57014', message: 'canceling statement due to statement timeout' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
  if (u.host === 'supa.test') return pg.responder(u, init);
  return new Response(JSON.stringify({ error: { message: 'red de mentira' } }), { status: 500, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

async function main() {
  const { vigilarCreditoClaude } = await import('../lib/credito-vigia');
  const PLATAFORMA = 9;
  pg.db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo' });
  const ahora = Date.now();
  const gasto = (usd: number, motivo = '⚠ crédito de Claude de la plataforma (cuenta 2) · Ops Center') =>
    pg.db.anthropic_usage.push({ id: ++n, workspace_id: PLATAFORMA, created_at: new Date(ahora - 60_000).toISOString(), motivo, cuenta: 2, cost_usd: usd, provider: 'anthropic', model: 'claude-haiku-4-5' });
  const uso = () => JSON.parse(String(pg.db.app_settings.find((f) => f.workspace_id === PLATAFORMA && f.key === 'ia.credito.uso')?.value ?? 'null'));
  const out: Record<string, unknown> = {};
  gasto(162);
  out.al81 = await vigilarCreditoClaude(ahora);
  out.uso81 = uso()?.cuentas ?? null;
  out.al81OtraVez = await vigilarCreditoClaude(ahora + 600_000);
  gasto(40);
  out.al101 = await vigilarCreditoClaude(ahora + 1_200_000);
  out.campanitas = pg.db.notificaciones.map((f) => `${f.tipo}:${String(f.descripcion ?? '').slice(0, 60)}`);
  gastoIlegible = true;
  out.sinLeer = await vigilarCreditoClaude(ahora + 1_800_000);
  out.usoSinLeer = uso()?.cuentas ?? null;
  process.stdout.write(`@@VIGIA@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@VIGIA@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
