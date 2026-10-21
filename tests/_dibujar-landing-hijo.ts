// =============================================================================
// Hijo de tests/ops-center-landing-bloques.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Lo que DIBUJA una lectura del Web Generator por el camino REAL (`ejecutarOperacion`, lib/api-mako/ejecutar.ts → el
// canal `ctx.aDibujar` del marco de Ops Center 3), con el runner de VERDAD de listar_disenos_landing (el catálogo de
// diseños, que no lee la base). Contra un PostgREST de mentira, en un node aparte con `--conditions=react-server`, con
// el molde de tests/_dibujar-hijo.ts. Nada sale a la red.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const TABLAS = ['workspaces', 'app_settings', 'usuarios'] as const;
const pg = crearPostgrest({ tablas: TABLAS });
const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 3; // el de prueba (nunca el 1)

async function main() {
  const { ejecutarOperacion } = await import('../lib/api-mako/ejecutar');
  const { runWithWorkspace } = await import('../lib/workspace');
  pg.db.workspaces.push({ id: WS, nombre: 'Prueba', slug: 'prueba', estado: 'activo', capa: 'completo', created_at: new Date().toISOString() });
  const dibujados: unknown[] = [];
  const ctx = (conCanal: boolean) => ({
    ws: WS, canal: 'app' as const, canalKey: 'app:77', alcance: 'proponer' as const, rol: 'admin' as const, actor: 'Prueba',
    ...(conCanal ? { aDibujar: (b: unknown) => { dibujados.push(b); } } : {}),
  });
  const conCanal = await runWithWorkspace(WS, () => ejecutarOperacion('listar_disenos_landing', {}, ctx(true), 'json'));
  const cuantos = dibujados.length;
  const sinCanal = await runWithWorkspace(WS, () => ejecutarOperacion('listar_disenos_landing', {}, ctx(false), 'json'));
  const trasSinCanal = dibujados.length;
  await runWithWorkspace(WS, () => ejecutarOperacion('listar_disenos_landing', {}, { ...ctx(true), mensajeUsuario: 'Armame una landing oscura' }, 'json'));
  await runWithWorkspace(WS, () => ejecutarOperacion('listar_disenos_landing', {}, { ...ctx(true), mensajeUsuario: 'Armame una presentación de ventas' }, 'json'));
  process.stdout.write(JSON.stringify({ conCanal, sinCanal, dibujados, cuantos, trasSinCanal, red }));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
