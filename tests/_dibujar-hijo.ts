// =============================================================================
// Hijo de tests/chat-bloques-salida.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Lo que DIBUJA una lectura (el `bloque` de su salida) y una propuesta de pantalla (`extra.bloque`) por el camino REAL
// (`ejecutarOperacion`, lib/api-mako/ejecutar.ts), con y sin `ctx.aDibujar`. Los runners se reemplazan por uno que
// devuelve lo que devolvería (lo que se prueba es el canal, no la lectura). Contra un PostgREST de mentira, en un node
// aparte con `--conditions=react-server`. Nada sale a la red.
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
  const { runnerDe } = await import('../lib/api-mako/runners');
  const { REGISTRO } = await import('../lib/api-mako/registro');
  const { runWithWorkspace } = await import('../lib/workspace');
  pg.db.workspaces.push({ id: WS, nombre: 'Prueba', slug: 'prueba', estado: 'activo', capa: 'completo', created_at: new Date().toISOString() });

  const G5 = { t: 'creado', titulo: 'Promo', abrir: { titulo: 'Abrir en Image Editor', href: '/image-editor/abc' } };
  const G4 = { t: 'antes_despues', titulo: 'Velocidad', filas: [{ antes: '1×', despues: '1,5×' }], abrir: { titulo: 'Aceptar en el editor', href: '/video-editor/p1?propuesta=x1' } };
  Object.assign(runnerDe('listar_disenos_imagen') as object, { leer: async () => ({ content: '{"disenos":1}', bloque: G5 }) });
  const video = REGISTRO.find((d) => d.area === 'video' && d.tipo === 'accion' && d.confirmacion === 'pantalla' && d.pantalla === '/video-editor');
  if (!video) throw new Error('falta una operación del Video Editor');
  Object.assign(runnerDe(video.id) as object, { proponer: async () => ({ id: 'x1', url: '/video-editor/p1?propuesta=x1', nueva: true, extra: { bloque: G4, para: 'el proyecto' } }) });

  const dibujados: unknown[] = [];
  const ctx = (conCanal: boolean) => ({
    ws: WS, canal: 'app' as const, canalKey: 'app:77', alcance: 'proponer' as const, rol: 'admin' as const, actor: 'Prueba',
    ...(conCanal ? { aDibujar: (b: unknown) => { dibujados.push(b); } } : {}),
  });
  const enWs = <T,>(fn: () => Promise<T>) => runWithWorkspace(WS, fn);
  const lectura = await enWs(() => ejecutarOperacion('listar_disenos_imagen', {}, ctx(true), 'json'));
  // Lo obligatorio de la operación, con valores de relleno (lo que valida `validarInput`; el runner es de mentira).
  const relleno = Object.fromEntries(video.parametros.filter((p) => p.obligatorio).map((p) => [p.nombre,
    p.enum?.length ? p.enum[0] : p.tipo === 'number' ? (p.minimo ?? 1) : p.tipo === 'boolean' ? true : p.tipo === 'string[]' ? ['x'] : p.tipo === 'object' ? {} : p.tipo === 'object[]' ? [{}] : 'x']));
  const propuesta = await enWs(() => ejecutarOperacion(video.id, relleno, ctx(true), 'json'));
  const cuantosConCanal = dibujados.length;
  const sinCanal = await enWs(() => ejecutarOperacion('listar_disenos_imagen', {}, ctx(false), 'json'));
  process.stdout.write(JSON.stringify({ lectura, propuesta, sinCanal, dibujados, cuantosConCanal, red }));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
