// =============================================================================
// Hijo de tests/calendario-publicar.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Publicar desde el Calendario (28/10/2026), de punta a punta: lib/calendario-publicar.ts, lib/calendario.ts y la operación
// `programar_publicacion` REALES (`server-only`, en un node aparte con `--conditions=react-server`), sobre el PostgREST de
// mentira (tests/_postgrest-de-mentira.ts), con Storage y la API de Zernio de mentira. En el ws 3. Imprime lo que quedó en la
// base y lo que salió a Zernio. Lo que no es la base, Storage ni Zernio se anota en `red`.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const WS = 3;
const AHORA = Date.parse('2026-11-02T12:00:00Z');
const DateReal = Date;
class DateFijo extends DateReal {
  constructor(...a: ConstructorParameters<typeof Date> | []) { if (a.length === 0) super(AHORA); else super(...(a as ConstructorParameters<typeof Date>)); }
  static now() { return AHORA; }
}
globalThis.Date = DateFijo as DateConstructor;

const pg = crearPostgrest({ tablas: ['calendario_eventos', 'credenciales', 'app_settings', 'workspaces', 'webhook_routing', 'zernio_workspace'] });
const db = pg.db;
const red: string[] = [];
const zernio: Array<{ metodo: string; ruta: string; requestId: string | null; cuerpo: Record<string, unknown> | null }> = [];
const firmas: Array<{ ruta: string; expiresIn: number }> = [];
/** Lo que contesta Zernio a la próxima creación de un post: 'ok' | 'error' | '409'. */
let proximoPost: 'ok' | 'error' | '409' = 'ok';
let nPost = 0;
/** El estado de cada post en Zernio, para la relectura. */
const posts: Record<string, Record<string, unknown>> = {};
/** Sin la mig 0342: cualquier lectura o escritura que nombre sus columnas contesta 400, como PostgREST. */
let sinMigracion = false;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const COL_0342 = /\b(red|cuenta_red|archivo|archivo_tipo|texto|post_id|publicacion|publicacion_motivo|publicacion_url)\b/;

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const metodo = (init.method ?? 'GET').toUpperCase();
  if (u.host === 'supa.test' && u.pathname.startsWith('/storage/v1/')) {
    const resto = u.pathname.replace(/^\/storage\/v1\//, '');
    if (resto.startsWith('object/upload/sign/')) return json(200, { url: `/${resto}?token=subir` });
    if (resto.startsWith('object/sign/')) {
      const ruta = resto.replace(/^object\/sign\/ig-media\//, '');
      const b = JSON.parse(String(init.body ?? '{}')) as { expiresIn?: number };
      firmas.push({ ruta: decodeURIComponent(ruta), expiresIn: Number(b.expiresIn) });
      return json(200, { signedURL: `/${resto}?token=leer` });
    }
    red.push(`${metodo} ${u.pathname}`);
    return json(404, { message: 'sin mock' });
  }
  if (u.host === 'supa.test') {
    if (sinMigracion && u.pathname.endsWith('/calendario_eventos')) {
      // Las CLAVES del cuerpo, no sus valores: `tipo: 'publicacion'` no nombra la columna `publicacion`.
      let claves: string[] = [];
      try { const b = typeof init.body === 'string' ? JSON.parse(init.body) : null; claves = (Array.isArray(b) ? b : [b]).flatMap((x) => (x && typeof x === 'object' ? Object.keys(x) : [])); } catch { claves = []; }
      if (COL_0342.test(u.searchParams.get('select') ?? '') || claves.some((k) => COL_0342.test(k)) || [...u.searchParams.keys()].some((k) => COL_0342.test(k))) {
        return json(400, { code: '42703', message: 'column calendario_eventos.red does not exist', details: null, hint: null });
      }
    }
    return pg.responder(u, init);
  }
  if (u.host === 'zernio.com') {
    const ruta = u.pathname.replace(/^\/api\/v1/, '');
    const cuerpo = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    zernio.push({ metodo, ruta, requestId: new Headers(init.headers).get('x-request-id'), cuerpo });
    if (metodo === 'POST' && ruta === '/posts') {
      if (proximoPost === 'error') { proximoPost = 'ok'; return json(500, { error: 'Internal error', type: 'api_error' }); }
      if (proximoPost === '409') { proximoPost = 'ok'; return json(409, { error: 'Duplicate content', details: { existingPostId: 'post_ya' } }); }
      nPost += 1;
      const id = `post_${nPost}`;
      posts[id] = { _id: id, status: 'scheduled' };
      return json(200, { post: posts[id] });
    }
    const m = ruta.match(/^\/posts\/([^/]+)$/);
    if (m && metodo === 'GET') return posts[m[1]] ? json(200, { post: posts[m[1]] }) : json(404, { error: 'not found' });
    if (m && metodo === 'DELETE') { if (!posts[m[1]]) return json(404, { error: 'not found' }); delete posts[m[1]]; return json(200, { message: 'deleted' }); }
    return json(404, { error: `sin mock: ${metodo} ${ruta}` });
  }
  red.push(`${metodo} ${u.host}${u.pathname}`);
  return json(500, { error: 'red de mentira' });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales';

const evento = (id: string, x: Record<string, unknown> = {}) => ({
  id, workspace_id: WS, tipo: 'publicacion', formato: 'reel', titulo: `Reel ${id}`, notas: '', inicio: '2026-11-03T13:00:00.000Z', fin: null,
  dia_completo: false, estado: 'planeado', origen: 'user', creado_por: null, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z',
  red: 'instagram', cuenta_red: 'acc_ig_1', archivo: `${WS}/calendario/${id}/abcdef123456.mp4`, archivo_tipo: 'video', texto: 'Mira esto',
  post_id: null, publicacion: null, publicacion_motivo: null, publicacion_url: null, ...x,
});

async function main() {
  const { cifrar } = await import('../lib/cripto-credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const P = await import('../lib/calendario-publicar');
  const C = await import('../lib/calendario');
  const { RUNNERS } = await import('../lib/api-mako/areas/calendario.run');

  const reset = () => {
    pg.vaciar();
    zernio.length = 0; firmas.length = 0; red.length = 0; proximoPost = 'ok'; sinMigracion = false;
    db.workspaces.push({ id: WS, nombre: 'Prueba' });
    db.app_settings.push({ workspace_id: WS, key: 'mako.timezone', value: 'America/Argentina/Buenos_Aires', updated_at: '2026-10-01T00:00:00Z' });
    db.credenciales.push({ workspace_id: WS, clave: 'ZERNIO_API_KEY', valor_enc: cifrar('sk_zernio_prueba', WS, 'ZERNIO_API_KEY'), servicio: 'zernio' });
  };
  const fila = (id: string) => {
    const f = db.calendario_eventos.find((x) => x.id === id);
    return f ? { publicacion: f.publicacion ?? null, post_id: f.post_id ?? null, estado: f.estado, motivo: f.publicacion_motivo ?? null, url: f.publicacion_url ?? null } : null;
  };
  const posts0 = () => zernio.filter((z) => z.metodo === 'POST' && z.ruta === '/posts');
  const enWs = <T>(f: () => Promise<T>) => runWithWorkspace(WS, f).catch((e) => ({ tira: e instanceof Error ? e.message : String(e) }));
  const out: Record<string, unknown> = {};

  // (a) Un evento listo se programa: el post sale con la hora en UTC, la cuenta, el reel, la media firmada y su x-request-id.
  reset();
  db.calendario_eventos.push(evento('eva'));
  out.a = { r: await enWs(() => P.programarPublicaciones(['eva'])), fila: fila('eva'), post: posts0()[0] ?? null, firmas: [...firmas] };

  // (b) Otra vez: ya está programada, y a Zernio no sale nada.
  out.b = { r: await enWs(() => P.programarPublicaciones(['eva'])), posts: posts0().length };

  // (c) Dos pedidos a la vez sobre el mismo evento: un solo post.
  reset();
  db.calendario_eventos.push(evento('evc'));
  const dos = await Promise.all([enWs(() => P.programarPublicaciones(['evc'])), enWs(() => P.programarPublicaciones(['evc']))]);
  out.c = { r: dos, posts: posts0().length, fila: fila('evc') };

  // (d) Zernio falla: queda `fallo` con el motivo, y se vuelve a programar.
  reset();
  db.calendario_eventos.push(evento('evd'));
  proximoPost = 'error';
  const falla = await enWs(() => P.programarPublicaciones(['evd']));
  const trasFalla = fila('evd');
  out.d = { falla, trasFalla, otra: await enWs(() => P.programarPublicaciones(['evd'])), fila: fila('evd') };

  // (e) Uno programado no se mueve ni se borra; se cancela (DELETE en Zernio) y después sí.
  reset();
  db.calendario_eventos.push(evento('eve'));
  await enWs(() => P.programarPublicaciones(['eve']));
  const entrada = { titulo: 'Reel eve', tipo: 'publicacion' as const, formato: 'reel' as const, fecha: '2026-11-04', hora: '10:00', duracionMin: null, notas: '' };
  out.e = {
    mover: await enWs(() => C.cambiarEvento('eve', entrada, 'America/Argentina/Buenos_Aires')),
    borrar: await enWs(() => C.borrarEvento('eve')),
    cancelar: await enWs(() => P.cancelarPublicacion('eve')),
    trasCancelar: fila('eve'),
    deletes: zernio.filter((z) => z.metodo === 'DELETE').map((z) => z.ruta),
    moverDespues: await enWs(() => C.cambiarEvento('eve', entrada, 'America/Argentina/Buenos_Aires')),
  };

  // (f) Releer: la hora pasó y Zernio dice publicada → `publicada`, con su link, y el evento `hecho`. Una que sigue esperando, igual.
  reset();
  db.calendario_eventos.push(evento('evf', { inicio: '2026-11-02T11:00:00.000Z', publicacion: 'programada', post_id: 'post_pub' }));
  db.calendario_eventos.push(evento('evg', { inicio: '2026-11-02T11:30:00.000Z', publicacion: 'programada', post_id: 'post_fallo' }));
  db.calendario_eventos.push(evento('evh', { inicio: '2026-11-02T11:45:00.000Z', publicacion: 'programada', post_id: 'post_espera' }));
  db.calendario_eventos.push(evento('evi', { inicio: '2026-11-05T11:00:00.000Z', publicacion: 'programada', post_id: 'post_futuro' }));
  posts.post_pub = { _id: 'post_pub', status: 'published', platforms: [{ status: 'published', platformPostUrl: 'https://www.instagram.com/reel/abc/' }] };
  posts.post_fallo = { _id: 'post_fallo', status: 'failed', platforms: [{ status: 'failed', errorMessage: 'Video too long for Reels' }] };
  posts.post_espera = { _id: 'post_espera', status: 'publishing' };
  out.f = {
    cambiados: await enWs(() => P.releerPublicaciones()),
    f: fila('evf'), g: fila('evg'), h: fila('evh'), i: fila('evi'),
    leidos: zernio.filter((z) => z.metodo === 'GET').map((z) => z.ruta),
  };

  // (g) Sin la mig 0342: el Calendario sigue (mover, borrar), y programar dice que falta.
  reset();
  sinMigracion = true;
  db.calendario_eventos.push(evento('evj'));
  out.g = {
    leer: await enWs(async () => (await P.leerPublicaciones(['evj'])).size),
    mover: await enWs(() => C.cambiarEvento('evj', { ...entrada, titulo: 'Reel evj' }, 'America/Argentina/Buenos_Aires')),
    programar: await enWs(() => P.programarPublicaciones(['evj'])),
    borrar: await enWs(async () => !!(await C.borrarEvento('evj'))),
  };

  // (h) El archivo: el de otro negocio o de otro evento no se guarda; el propio sí. Y la subida la arma el server.
  reset();
  db.calendario_eventos.push(evento('evk', { archivo: null, archivo_tipo: null }));
  out.h = {
    ajeno: await enWs(() => P.guardarPublicacion('evk', { archivo: `30/calendario/evk/abcdef123456.mp4`, archivoTipo: 'video' })),
    otroEvento: await enWs(() => P.guardarPublicacion('evk', { archivo: `${WS}/calendario/evotro/abcdef123456.mp4`, archivoTipo: 'video' })),
    propio: await enWs(() => P.guardarPublicacion('evk', { archivo: `${WS}/calendario/evk/abcdef123456.mp4`, archivoTipo: 'video' })),
    subida: await enWs(() => P.subidaDelArchivo('evk', 'video/mp4')),
    subidaPdf: await enWs(() => P.subidaDelArchivo('evk', 'application/pdf')),
  };

  // (i) En serie: las listas de la semana (con cuenta y archivo; no la que no tiene archivo, ni la de otra semana), por la operación
  //     de MaKo: el resumen que se confirma y lo que se programa al confirmar.
  reset();
  db.calendario_eventos.push(evento('ev1', { inicio: '2026-11-03T13:00:00.000Z' }));
  db.calendario_eventos.push(evento('ev2', { inicio: '2026-11-04T13:00:00.000Z', formato: 'story', archivo: `${WS}/calendario/ev2/abcdef123456.jpg`, archivo_tipo: 'image' }));
  db.calendario_eventos.push(evento('ev3', { inicio: '2026-11-05T13:00:00.000Z', archivo: null, archivo_tipo: null }));
  db.calendario_eventos.push(evento('ev4', { inicio: '2026-11-20T13:00:00.000Z' }));
  db.calendario_eventos.push(evento('ev5', { inicio: '2026-11-06T13:00:00.000Z', dia_completo: true }));
  const op = RUNNERS.programar_publicacion as { preparar: (i: Record<string, unknown>) => Promise<Record<string, unknown>>; ejecutar: (p: Record<string, unknown>) => Promise<Record<string, unknown>> };
  const prep = await enWs(() => op.preparar({ desde: '2026-11-02', hasta: '2026-11-08' }));
  const antesDeConfirmar = posts0().length;
  const ejec = 'payload' in (prep as object) ? await enWs(() => op.ejecutar((prep as { payload: Record<string, unknown> }).payload)) : null;
  out.i = { prep, antesDeConfirmar, ejec, posts: posts0().map((p) => (p.cuerpo?.metadata as { calendarioEventoId?: string })?.calendarioEventoId), filas: ['ev1', 'ev2', 'ev3', 'ev4', 'ev5'].map(fila) };

  // (j) El 409 de Zernio (el mismo contenido en 24 h) no es un error: es el post que ya estaba.
  reset();
  db.calendario_eventos.push(evento('evl'));
  proximoPost = '409';
  out.j = { r: await enWs(() => P.programarPublicaciones(['evl'])), fila: fila('evl') };

  out.red = [...red];
  // Se cierra a mano: algún módulo del Calendario deja un temporizador vivo y el padre (execFileSync) esperaba para siempre.
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`, () => process.exit(0));
}

void main().catch((e) => { process.stdout.write(`\n@@RESULTADO@@${JSON.stringify({ tiro: e instanceof Error ? e.stack : String(e) })}`, () => process.exit(0)); });

export {};
