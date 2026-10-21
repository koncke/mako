// =============================================================================
// Hijo de tests/dashboard-bloque-grafico.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// «La persona YA VE este resultado» se le dice al modelo SÓLO si el bloque se dibujó de verdad (revisión del 21/10/2026).
// Por el camino REAL (`ejecutarOperacion`, lib/api-mako/ejecutar.ts): una lectura que devuelve `{ content, bloque,
// siSeDibuja }`, con un canal que la acepta, uno que la rechaza (el tope de bloques del turno), un bloque que el saneo
// descarta y sin canal (WhatsApp, HTTP). El runner se reemplaza por uno de mentira (se prueba el canal, no la lectura),
// como en tests/_dibujar-hijo.ts. Contra un PostgREST de mentira, en un node aparte con `--conditions=react-server`.
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
const AVISO = '(La persona YA VE este resultado dibujado en el chat.)';

async function main() {
  const { ejecutarOperacion } = await import('../lib/api-mako/ejecutar');
  const { runnerDe } = await import('../lib/api-mako/runners');
  const { runWithWorkspace } = await import('../lib/workspace');
  pg.db.workspaces.push({ id: WS, nombre: 'Prueba', slug: 'prueba', estado: 'activo', capa: 'completo', created_at: new Date().toISOString() });

  const G5 = { t: 'creado', titulo: 'Leads', abrir: { titulo: 'Abrir en el Dashboard', href: '/dashboard' } };
  let bloque: unknown = G5;
  Object.assign(runnerDe('listar_disenos_imagen') as object, { leer: async () => ({ content: 'la tabla', bloque, siSeDibuja: AVISO }) });

  const ctx = (aDibujar?: (b: unknown) => boolean | void) => ({
    ws: WS, canal: 'app' as const, canalKey: 'app:77', alcance: 'proponer' as const, rol: 'admin' as const, actor: 'Prueba',
    ...(aDibujar ? { aDibujar } : {}),
  });
  const leer = async (c: ReturnType<typeof ctx>) => {
    const r = await runWithWorkspace(WS, () => ejecutarOperacion('listar_disenos_imagen', {}, c, 'json'));
    return (r as { resultado?: string }).resultado ?? null;
  };
  const dibujados: unknown[] = [];
  const acepta = await leer(ctx((b) => { dibujados.push(b); return true; }));
  // Un canal de antes, que no dice nada (`void`): se toma como dibujado.
  const callado = await leer(ctx(() => {}));
  const rechaza = await leer(ctx(() => false));
  const sinCanal = await leer(ctx());
  bloque = { t: 'creado', titulo: 'Leads', abrir: { titulo: 'Abrir', href: 'https://otro.com' } };
  const descartado = await leer(ctx((b) => { dibujados.push(b); return true; }));
  process.stdout.write(JSON.stringify({ acepta, callado, rechaza, sinCanal, descartado, dibujados: dibujados.length, aviso: AVISO, red }));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
