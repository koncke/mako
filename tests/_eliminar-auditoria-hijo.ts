// =============================================================================
// Hijo de tests/eliminar-workspace-auditoria.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corren REALES, sobre el PostgREST de mentira (tests/_postgrest-de-mentira.ts), `eliminarWorkspace`, `resetearWorkspace`,
// `planesDeVideoDelNegocio` y `planesDeVideo`. Necesita `--conditions=react-server`.
// =============================================================================

import { pathToFileURL } from 'node:url';

const RAIZ = new URL('..', import.meta.url);
const imp = (p: string) => import(pathToFileURL(new URL(p, RAIZ).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href);
type Fila = Record<string, unknown>;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const PLATAFORMA = 9, PRUEBA = 3, A_BORRAR = 40, OTRO = 41, SIN_AUDITORIA = 42, AUDITORIA_CAIDA = 43, AGENCIA = 44;
// Los planes de video: uno por cada fuente, uno que también nombra OTRO negocio, y el del AI Avatar (de todos).
const P_HIST = '11111111-1111-4111-8111-111111111111';
const P_MONTAJE = '22222222-2222-4222-8222-222222222222';
const P_FLOW = '33333333-3333-4333-8333-333333333333';
const P_COMPARTIDO = '44444444-4444-4444-8444-444444444444';
const P_PRUEBA = '55555555-5555-4555-8555-555555555555';

async function main() {
  const { crearPostgrest } = await imp('tests/_postgrest-de-mentira.ts');
  let ids = 1000;
  const pg = crearPostgrest({
    tablas: ['app_settings', 'workspaces', 'usuarios', 'bajas_cuenta', 'agencia_clientes', 'agencia_altas', 'leads',
      'evolution_instancias', 'borrados_workspace', 'montaje_trabajos', 'flow_trabajos', 'funnels'],
    defaults: (tabla: string, f: Fila) => (tabla === 'borrados_workspace' ? { id: ids++, estado: 'empezado', ...f } : { ...f }),
  });
  const db = pg.db as Record<string, Fila[]>;
  /** Todo lo que se le pide a la base y a Storage, en orden: para saber qué pasó ANTES de qué. */
  const eventos: string[] = [];
  const borradosStorage: string[] = [];
  let auditoriaCaida = false;

  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
    const metodo = (init.method ?? 'GET').toUpperCase();
    const body = typeof init.body === 'string' ? JSON.parse(init.body) as Fila : null;
    if (u.host === 'supa.test' && u.pathname.startsWith('/storage/')) {
      const m = /\/storage\/v1\/object\/list\/([^/]+)/.exec(u.pathname);
      if (m) {
        const prefijo = String(body?.prefix ?? '');
        const hay = Number(body?.offset ?? 0) === 0 && (
          (m[1] === 'video-clips' && prefijo.startsWith('video-generator/'))
          || (m[1] === 'ads-creatives' && prefijo.startsWith('grupo/'))
        );
        return json(200, hay ? [{ id: 'f', name: 'archivo.mp4' }] : []);
      }
      if (metodo === 'DELETE') {
        const bucket = u.pathname.split('/').pop();
        for (const p of (body?.prefixes as string[]) ?? []) { borradosStorage.push(`${bucket}:${p}`); eventos.push(`storage ${bucket}:${p}`); }
        return json(200, []);
      }
      return json(200, []);
    }
    if (u.host === 'supa.test') {
      const tabla = u.pathname.replace('/rest/v1/', '');
      eventos.push(`${metodo} ${tabla}`);
      if (tabla === 'borrados_workspace' && metodo === 'POST' && auditoriaCaida) return json(500, { code: 'XX000', message: 'la base no contesta' });
      return pg.responder(u, init);
    }
    return json(500, { error: `red de mentira: ${u.host}` });
  }) as typeof fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
  process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales-R';
  process.env.APP_BASE_URL = 'https://mako.test';
  process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba';

  const negocio = (id: number, nombre: string, capa = 'completo') => ({ id, nombre, capa, estado: 'activo' });
  db.workspaces.push(negocio(PLATAFORMA, 'MaKo', 'superadmin'), negocio(PRUEBA, 'Cliente de Prueba'), negocio(A_BORRAR, 'Se Va'),
    negocio(OTRO, 'Otro'), negocio(SIN_AUDITORIA, 'Sin Auditoria'), negocio(AUDITORIA_CAIDA, 'Auditoria Caida'), negocio(AGENCIA, 'La Agencia', 'agencia'));
  const persona = (id: number, ws: number | null, rol_ws: string | null, rol = 'usuario') => ({ id, email: `p${id}@test.com`, nombre: `P${id}`, rol, rol_ws, workspace_id: ws, estado: 'activo' });
  db.usuarios.push(persona(1, PLATAFORMA, null, 'admin'), persona(2, A_BORRAR, 'admin'), persona(3, A_BORRAR, 'closer'), persona(4, OTRO, 'admin'),
    persona(5, SIN_AUDITORIA, 'admin'), persona(6, AUDITORIA_CAIDA, 'admin'), persona(7, PRUEBA, 'admin'));
  // Era cliente de una agencia, con su alta: la constancia guarda las dos filas, sin el email ni el nombre de la persona.
  db.agencia_clientes.push({ agencia_ws: AGENCIA, cliente_ws: A_BORRAR, estado: 'aprobado', decidido_por: 'super@test.com' });
  db.agencia_altas.push({ id: 77, agencia_ws: AGENCIA, cliente_ws: A_BORRAR, email: 'dueno@cliente.test', nombre: 'Dueño Real', rol_ws: 'admin', estado: 'aprobado' });
  // Sus planes de video: el historial, un montaje y un trabajo de la cola de Flow. Y uno que también nombra OTRO negocio.
  const historial = (ids: string[]) => JSON.stringify(ids.map((id) => ({ id, plan: {} })));
  db.app_settings.push(
    { workspace_id: A_BORRAR, key: 'video-generator.historial', value: historial([P_HIST, P_COMPARTIDO, 'ai-avatar']) },
    { workspace_id: OTRO, key: 'video-generator.historial', value: historial([P_COMPARTIDO]) },
    { workspace_id: PRUEBA, key: 'video-generator.historial', value: historial([P_PRUEBA]) },
  );
  db.montaje_trabajos.push({ id: 1, workspace_id: A_BORRAR, plan_id: P_MONTAJE }, { id: 2, workspace_id: OTRO, plan_id: 'no-es-un-uuid' });
  db.flow_trabajos.push(
    { id: 1, workspace_id: A_BORRAR, pedido: { ruta: `video-generator/${P_FLOW}/toma-1-${'a'.repeat(8)}-aaaa-4aaa-8aaa-aaaaaaaaaaaa.mp4` } },
    { id: 2, workspace_id: A_BORRAR, pedido: { ruta: `video-generator/ai-avatar/escena-1-x.jpg` } },
  );

  const { eliminarWorkspace } = await imp('lib/eliminar-workspace.ts');
  const { resetearWorkspace, planesDeVideo, planesDeVideoDelNegocio } = await imp('lib/reset-workspace.ts');
  const R: Record<string, unknown> = {};

  // ── Lo puro: qué planes nombra lo guardado.
  R.puro = planesDeVideo({
    historial: historial([P_HIST, 'ai-avatar', P_COMPARTIDO]), planIds: [P_MONTAJE, 'ai-avatar', 7],
    rutas: [`video-generator/${P_FLOW}/toma-1-x.mp4`, 'video-generator/ai-avatar/escena-1-x.jpg', null],
    ajenos: new Set([P_COMPARTIDO]),
  });
  R.puroIlegible = planesDeVideo({ historial: '{no es json', planIds: [], rutas: [], ajenos: new Set() });
  R.delNegocio = await planesDeVideoDelNegocio(A_BORRAR);

  // ── 1. La auditoría instalada: se anota ANTES de lo primero que no tiene vuelta atrás, y se cierra al terminar.
  eventos.length = 0;
  R.borrado = await eliminarWorkspace(A_BORRAR, 'Se Va', PLATAFORMA, 'super@test.com');
  R.eventos = [...eventos];
  R.constancia = db.borrados_workspace.find((f) => f.negocio_id === A_BORRAR) ?? null;
  R.sigueElNegocio = db.workspaces.some((w) => w.id === A_BORRAR);
  R.storage = [...borradosStorage];

  // ── 2. La auditoría instalada y caída: no se borra NADA.
  auditoriaCaida = true;
  eventos.length = 0;
  R.caida = await eliminarWorkspace(AUDITORIA_CAIDA, 'Auditoria Caida', PLATAFORMA, 'super@test.com');
  R.eventosCaida = [...eventos];
  R.sigueCaida = db.workspaces.some((w) => w.id === AUDITORIA_CAIDA);
  R.personaCaida = db.usuarios.some((u) => u.id === 6);
  auditoriaCaida = false;

  // ── 3. La migración sin aplicar: se borra igual, y se avisa que no quedó anotado.
  pg.faltan.add('borrados_workspace');
  R.sinTabla = await eliminarWorkspace(SIN_AUDITORIA, 'Sin Auditoria', PLATAFORMA, 'super@test.com');
  R.sigueSinTabla = db.workspaces.some((w) => w.id === SIN_AUDITORIA);
  pg.faltan.delete('borrados_workspace');

  // ── 4. El reset del negocio de prueba también se lleva las tomas de sus planes.
  borradosStorage.length = 0;
  R.reset = await resetearWorkspace(PRUEBA);
  R.storageReset = [...borradosStorage];

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(R)}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
