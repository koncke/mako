// =============================================================================
// Hijo de tests/calendario-publicar.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Publicar desde el Calendario (28/10/2026), de punta a punta: lib/calendario-publicar.ts, lib/calendario.ts y la operación
// `programar_publicacion` REALES (`server-only`, en un node aparte con `--conditions=react-server`), sobre el PostgREST de
// mentira (tests/_postgrest-de-mentira.ts), con Storage y la API de Zernio de mentira. En el ws 3. Imprime lo que quedó en la
// base y lo que salió a Zernio. Lo que no es la base, Storage ni Zernio se anota en `red`.
//
// El Zernio de mentira hace lo que importa del real: las cuentas son de un PERFIL (las de otro negocio vienen en la lista y se
// filtran por perfil), el `x-request-id` es idempotente POR ~5 MINUTOS desde el primer pedido (después crea otro, como documenta
// docs/api-mako-inventario.md) y un post es de la CUENTA de Zernio con cuya clave se creó (con otra clave, 404). El reloj avanza
// (`reloj`): la segunda verificación (29/10) pasa por minutos.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const WS = 3;
const AHORA = Date.parse('2026-11-02T12:00:00Z');
/** La hora de la prueba: arranca en AHORA en cada caso y la mueven los casos que pasan por minutos. */
let reloj = AHORA;
const DateReal = Date;
class DateFijo extends DateReal {
  constructor(...a: ConstructorParameters<typeof Date> | []) { if (a.length === 0) super(reloj); else super(...(a as ConstructorParameters<typeof Date>)); }
  static now() { return reloj; }
}
globalThis.Date = DateFijo as DateConstructor;
const haceMin = (n: number) => new DateReal(AHORA - n * 60_000).toISOString();

const pg = crearPostgrest({ tablas: ['calendario_eventos', 'credenciales', 'app_settings', 'workspaces', 'webhook_routing', 'zernio_workspace'] });
const db = pg.db;
const red: string[] = [];
const zernio: Array<{ metodo: string; ruta: string; requestId: string | null; clave: string; cuerpo: Record<string, unknown> | null }> = [];
const firmas: Array<{ ruta: string; expiresIn: number }> = [];
/**
 * Lo que contesta Zernio a la próxima creación de un post: 'ok'; 'rechazo' (400: no la creó); 'error500' (500: no la creó);
 * 'cae-creado' (la CREA y la conexión se corta antes de la respuesta; si el pedido se repite en la ventana, se corta igual la
 * respuesta del original); '409' (ya había una igual); '429' y '422' (un «no» de Zernio al pedido repetido: no dice nada del
 * original).
 */
let proximoPost: 'ok' | 'rechazo' | 'error500' | 'cae-creado' | '409' | '429' | '422' = 'ok';
/** La ventana del x-request-id de Zernio (~5 min, desde el PRIMER pedido). */
const VENTANA_ZERNIO_MS = 5 * 60_000;
/** Cuántas escrituras (PATCH) de calendario_eventos fallan con un 503 DESPUÉS del próximo post creado: la base cae en el medio. */
let fallarTrasPost = 0;
let fallarPatch = 0;
let nPost = 0;
/** El estado de cada post en Zernio (con la clave de la cuenta que lo creó), para la relectura y el borrado. */
const posts: Record<string, Record<string, unknown>> = {};
/** El x-request-id de cada post creado y cuándo: Zernio no crea dos veces el mismo pedido dentro de su ventana. */
const porPedido: Record<string, { id: string; en: number }> = {};
/** Sin la mig 0342: cualquier lectura o escritura que nombre sus columnas contesta 400, como PostgREST. */
let sinMigracion = false;
/** GET /accounts contesta 500. */
let cuentasCaidas = false;
let cuentasEnPausa = false;
/** Corre justo antes de la PRÓXIMA escritura (PATCH o DELETE) en calendario_eventos: otro pedido que se mete en el medio. */
let antesDeEscribir: (() => void) | null = null;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const COL_0342 = /\b(red|cuenta_red|archivo|archivo_tipo|texto|post_id|publicacion|publicacion_motivo|publicacion_url|publicacion_intento|publicacion_clave)\b/;

/** Las cuentas de la cuenta de Zernio: dos del perfil del ws 3 y una de OTRO negocio (otro perfil). */
const CUENTAS = [
  { _id: 'acc_ig_1', platform: 'instagram', username: 'fiesta.music', profileId: 'prof_ws3', isActive: true },
  { _id: 'acc_yt_1', platform: 'youtube', username: 'canal.fm', profileId: 'prof_ws3', isActive: true },
  { _id: 'acc_ig_otro', platform: 'instagram', username: 'ajena', profileId: 'prof_ws13', isActive: true },
];

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
    if (u.pathname.endsWith('/calendario_eventos') && (metodo === 'PATCH' || metodo === 'DELETE') && antesDeEscribir) {
      const f = antesDeEscribir;
      antesDeEscribir = null;
      f();
    }
    if (u.pathname.endsWith('/calendario_eventos') && metodo === 'PATCH' && fallarPatch > 0) {
      fallarPatch -= 1;
      return json(503, { message: 'Service Unavailable' });
    }
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
    const h = new Headers(init.headers);
    const clave = (h.get('authorization') ?? '').replace(/^Bearer /, '');
    const requestId = h.get('x-request-id');
    zernio.push({ metodo, ruta, requestId, clave, cuerpo });
    if (ruta === '/profiles' && metodo === 'GET') return json(200, { profiles: [{ _id: 'prof_ws3', name: 'mako_ws_3', isDefault: true }] });
    if (ruta === '/accounts' && metodo === 'GET' && cuentasEnPausa) return json(429, { error: 'Rate limit exceeded' });
    if (ruta === '/accounts' && metodo === 'GET') return cuentasCaidas ? json(500, { error: 'Internal error' }) : json(200, { accounts: CUENTAS });
    if (metodo === 'POST' && ruta === '/posts') {
      const modo = proximoPost;
      proximoPost = 'ok';
      const previo = requestId ? porPedido[requestId] : undefined;
      if (previo && reloj - previo.en < VENTANA_ZERNIO_MS) {
        if (modo === 'cae-creado') throw new TypeError('fetch failed');
        if (modo === '429') return json(429, { error: 'Too many requests', type: 'rate_limit_error' });
        if (modo === '422') return json(422, { error: 'Idempotency key reused with a different body', type: 'validation_error' });
        return json(200, { post: posts[previo.id] });
      }
      if (modo === 'rechazo') return json(400, { error: 'Invalid media', type: 'validation_error' });
      if (modo === 'error500') return json(500, { error: 'Internal error', type: 'api_error' });
      if (modo === '409') return json(409, { error: 'Duplicate content', details: { existingPostId: 'post_ya' } });
      nPost += 1;
      const id = `post_${nPost}`;
      posts[id] = { _id: id, status: 'scheduled', clave };
      if (requestId) porPedido[requestId] = { id, en: reloj };
      if (fallarTrasPost > 0) { fallarPatch = fallarTrasPost; fallarTrasPost = 0; }
      if (modo === 'cae-creado') throw new TypeError('fetch failed');
      return json(200, { post: posts[id] });
    }
    const m = ruta.match(/^\/posts\/([^/]+)$/);
    const delOtraCuenta = (id: string) => !posts[id] || (posts[id].clave != null && posts[id].clave !== clave);
    if (m && metodo === 'GET') return delOtraCuenta(m[1]) ? json(404, { error: 'not found' }) : json(200, { post: posts[m[1]] });
    if (m && metodo === 'DELETE') { if (delOtraCuenta(m[1])) return json(404, { error: 'not found' }); delete posts[m[1]]; return json(200, { message: 'deleted' }); }
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
  post_id: null, publicacion: null, publicacion_motivo: null, publicacion_url: null, publicacion_intento: null, publicacion_clave: null, ...x,
});

async function main() {
  const { cifrar } = await import('../lib/cripto-credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const P = await import('../lib/calendario-publicar');
  const C = await import('../lib/calendario');
  const { RUNNERS } = await import('../lib/api-mako/areas/calendario.run');

  const ponerClave = (k: string) => {
    db.credenciales.length = 0;
    db.credenciales.push({ workspace_id: WS, clave: 'ZERNIO_API_KEY', valor_enc: cifrar(k, WS, 'ZERNIO_API_KEY'), servicio: 'zernio' });
  };
  const reset = () => {
    pg.vaciar();
    zernio.length = 0; firmas.length = 0; red.length = 0; proximoPost = 'ok'; sinMigracion = false; cuentasCaidas = false; cuentasEnPausa = false; antesDeEscribir = null;
    reloj = AHORA; fallarTrasPost = 0; fallarPatch = 0;
    for (const k of Object.keys(posts)) delete posts[k];
    for (const k of Object.keys(porPedido)) delete porPedido[k];
    db.workspaces.push({ id: WS, nombre: 'Prueba' });
    db.app_settings.push({ workspace_id: WS, key: 'mako.timezone', value: 'America/Argentina/Buenos_Aires', updated_at: '2026-10-01T00:00:00Z' });
    db.zernio_workspace.push({ workspace_id: WS, profile_id: 'prof_ws3' });
    ponerClave('sk_zernio_prueba');
  };
  const crudo = (id: string) => db.calendario_eventos.find((x) => x.id === id) as Record<string, unknown> | undefined;
  const fila = (id: string) => {
    const f = crudo(id);
    return f ? { publicacion: f.publicacion ?? null, post_id: f.post_id ?? null, estado: f.estado, motivo: f.publicacion_motivo ?? null, url: f.publicacion_url ?? null } : null;
  };
  const posts0 = () => zernio.filter((z) => z.metodo === 'POST' && z.ruta === '/posts');
  const enWs = <T>(f: () => Promise<T>) => runWithWorkspace(WS, f).catch((e) => ({ tira: e instanceof Error ? e.message : String(e) }));
  const TZ = 'America/Argentina/Buenos_Aires';
  const entrada = { titulo: 'Reel', tipo: 'publicacion' as const, formato: 'reel' as const, fecha: '2026-11-04', hora: '10:00', duracionMin: null, notas: '' };
  const op = RUNNERS.programar_publicacion as unknown as { preparar: (i: Record<string, unknown>) => Promise<Record<string, unknown>>; ejecutar: (p: Record<string, unknown>) => Promise<Record<string, unknown>> };
  const out: Record<string, unknown> = {};

  // (a) Un evento listo se programa: el post sale con la hora en UTC, la cuenta, el reel, la media firmada y su x-request-id.
  reset();
  db.calendario_eventos.push(evento('eva'));
  out.a = { r: await enWs(() => P.programarPublicaciones(['eva'])), fila: fila('eva'), post: posts0()[0] ?? null, firmas: [...firmas], clave: crudo('eva')?.publicacion_clave ?? null };

  // (b) Otra vez: ya está programada, y a Zernio no sale nada.
  out.b = { r: await enWs(() => P.programarPublicaciones(['eva'])), posts: posts0().length };

  // (c) Dos pedidos a la vez sobre el mismo evento: un solo post.
  reset();
  db.calendario_eventos.push(evento('evc'));
  const dos = await Promise.all([enWs(() => P.programarPublicaciones(['evc'])), enWs(() => P.programarPublicaciones(['evc']))]);
  out.c = { r: dos, posts: posts0().length, fila: fila('evc') };

  // (d) Zernio la RECHAZA (400: no la creó): queda `fallo` con el motivo, y se vuelve a programar.
  reset();
  db.calendario_eventos.push(evento('evd'));
  proximoPost = 'rechazo';
  const falla = await enWs(() => P.programarPublicaciones(['evd']));
  const trasFalla = fila('evd');
  out.d = { falla, trasFalla, otra: await enWs(() => P.programarPublicaciones(['evd'])), fila: fila('evd') };

  // (e) Uno programado no se mueve ni se borra; se cancela (DELETE en Zernio) y después sí.
  reset();
  db.calendario_eventos.push(evento('eve'));
  await enWs(() => P.programarPublicaciones(['eve']));
  out.e = {
    mover: await enWs(() => C.cambiarEvento('eve', { ...entrada, titulo: 'Reel eve' }, TZ)),
    borrar: await enWs(() => C.borrarEvento('eve')),
    marcar: await enWs(() => C.marcarEvento('eve', true)),
    cancelar: await enWs(() => P.cancelarPublicacion('eve')),
    trasCancelar: fila('eve'),
    deletes: zernio.filter((z) => z.metodo === 'DELETE').map((z) => z.ruta),
    moverDespues: await enWs(() => C.cambiarEvento('eve', { ...entrada, titulo: 'Reel eve' }, TZ)),
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
    mover: await enWs(() => C.cambiarEvento('evj', { ...entrada, titulo: 'Reel evj' }, TZ)),
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
  const prep = await enWs(() => op.preparar({ desde: '2026-11-02', hasta: '2026-11-08' }));
  const antesDeConfirmar = posts0().length;
  const ejec = 'payload' in (prep as object) ? await enWs(() => op.ejecutar((prep as { payload: Record<string, unknown> }).payload)) : null;
  out.i = { prep, antesDeConfirmar, ejec, posts: posts0().map((p) => (p.cuerpo?.metadata as { calendarioEventoId?: string })?.calendarioEventoId), filas: ['ev1', 'ev2', 'ev3', 'ev4', 'ev5'].map(fila) };

  // (i2) El «sí» llega después y el evento CAMBIÓ en el medio (otra hora): ése no se programa con el resumen viejo. Y un «sí» sin
  //      huellas (un payload viejo) no programa nada.
  reset();
  db.calendario_eventos.push(evento('ev1', { inicio: '2026-11-03T13:00:00.000Z' }));
  db.calendario_eventos.push(evento('ev2', { inicio: '2026-11-04T13:00:00.000Z' }));
  const prep2 = await enWs(() => op.preparar({ desde: '2026-11-02', hasta: '2026-11-08' }));
  crudo('ev1')!.inicio = '2026-11-03T15:00:00.000Z';
  const ejec2 = 'payload' in (prep2 as object) ? await enWs(() => op.ejecutar((prep2 as { payload: Record<string, unknown> }).payload)) : null;
  const tras2 = posts0().map((p) => (p.cuerpo?.metadata as { calendarioEventoId?: string })?.calendarioEventoId);
  db.calendario_eventos.push(evento('ev6', { inicio: '2026-11-05T13:00:00.000Z' }));
  const sinHuellas = await enWs(() => op.ejecutar({ eventos: ['ev6'] }));
  out.i2 = { huellas: (prep2 as { payload?: { huellas?: unknown } }).payload?.huellas ?? null, ejec2, posts: tras2, filas: ['ev1', 'ev2'].map(fila), sinHuellas, ev6: fila('ev6'), postsFinal: posts0().length };

  // (j) El 409 de Zernio (el mismo contenido) no es un error: es el post que ya estaba.
  reset();
  db.calendario_eventos.push(evento('evl'));
  proximoPost = '409';
  out.j = { r: await enWs(() => P.programarPublicaciones(['evl'])), fila: fila('evl') };
  // (j2) Y si ese post ya es de OTRA publicación (dos veces iguales de una serie, M6): ésta no se lo queda.
  reset();
  db.calendario_eventos.push(evento('evl'), evento('evl2', { publicacion: 'programada', post_id: 'post_ya' }));
  proximoPost = '409';
  out.j2 = { r: await enWs(() => P.programarPublicaciones(['evl'])), fila: fila('evl') };

  // (k) LA CUENTA ES DEL NEGOCIO: una de otro negocio (otro perfil de la misma cuenta de Zernio) no se guarda ni se programa,
  //     aunque ya esté escrita en la fila; la red sale de la cuenta, no de lo que manda el navegador; y si las cuentas no se
  //     pueden leer, no se programa a ciegas.
  reset();
  db.calendario_eventos.push(evento('evm', { red: null, cuenta_red: null }));
  db.calendario_eventos.push(evento('evn', { cuenta_red: 'acc_ig_otro' }));
  const guardarAjena = await enWs(() => P.guardarPublicacion('evm', { red: 'instagram', cuentaRed: 'acc_ig_otro' }));
  const guardarRedMentida = await enWs(() => P.guardarPublicacion('evm', { red: 'tiktok', cuentaRed: 'acc_ig_1' }));
  const trasAjena = { red: crudo('evm')?.red ?? null, cuenta: crudo('evm')?.cuenta_red ?? null };
  const guardarPropia = await enWs(() => P.guardarPublicacion('evm', { cuentaRed: 'acc_ig_1' }));
  const trasPropia = { red: crudo('evm')?.red ?? null, cuenta: crudo('evm')?.cuenta_red ?? null };
  const programarAjena = await enWs(() => P.programarPublicaciones(['evn']));
  const postsAjena = posts0().length;
  cuentasCaidas = true;
  const programarSinCuentas = await enWs(() => P.programarPublicaciones(['evm']));
  out.k = { guardarAjena, guardarRedMentida, trasAjena, guardarPropia, trasPropia, programarAjena, postsAjena, filaAjena: fila('evn'), programarSinCuentas, postsSinCuentas: posts0().length, filaSinCuentas: fila('evm') };

  // (l) Zernio la CREA y la conexión se corta: queda `dudosa` (no `fallo`), no se mueve ni se cancela, y el reintento de al
  //     momento repite el MISMO x-request-id: Zernio devuelve la que había creado. Un solo post.
  reset();
  db.calendario_eventos.push(evento('evo'));
  proximoPost = 'cae-creado';
  const l1 = await enWs(() => P.programarPublicaciones(['evo']));
  const filaDudosa = fila('evo');
  const moverDudosa = await enWs(() => C.cambiarEvento('evo', { ...entrada, titulo: 'Reel evo' }, TZ));
  const cancelarDudosa = await enWs(() => P.cancelarPublicacion('evo'));
  const l2 = await enWs(() => P.programarPublicaciones(['evo']));
  out.l = { l1, filaDudosa, moverDudosa, cancelarDudosa, l2, fila: fila('evo'), pedidos: posts0().map((p) => p.requestId), creados: Object.keys(posts).length };

  // (l2) Un 500 también deja `dudosa`. Pasados unos minutos, programar NO pide otro (podría duplicarla): espera a que alguien
  //      revise; «No quedó programada» la vuelve a `fallo` y ahí se programa con un pedido NUEVO.
  reset();
  db.calendario_eventos.push(evento('evp'));
  proximoPost = 'error500';
  const p1 = await enWs(() => P.programarPublicaciones(['evp']));
  const fila1 = fila('evp');
  reloj = AHORA + 10 * 60_000;
  const p2 = await enWs(() => P.programarPublicaciones(['evp']));
  const postsTrasP2 = posts0().length;
  const noQuedo = await enWs(() => P.noQuedoProgramada('evp'));
  const trasNoQuedo = fila('evp');
  const p3 = await enWs(() => P.programarPublicaciones(['evp']));
  out.l2 = { p1, fila1, p2, postsTrasP2, noQuedo, trasNoQuedo, p3, fila: fila('evp'), pedidos: posts0().map((p) => p.requestId), noQuedoOtra: await enWs(() => P.noQuedoProgramada('evp')) };

  // (m) Una que quedó `programando` (la función murió en el medio) pasa a `dudosa` a los 10 minutos; una de hace 2, no.
  reset();
  db.calendario_eventos.push(evento('evq', { publicacion: 'programando', publicacion_intento: 'req-q', updated_at: haceMin(15) }));
  db.calendario_eventos.push(evento('evr', { publicacion: 'programando', publicacion_intento: 'req-r', updated_at: haceMin(2) }));
  out.m = { cambiados: await enWs(() => P.releerPublicaciones()), q: fila('evq'), r: fila('evr'), intentoQ: crudo('evq')?.publicacion_intento ?? null, intentoR: crudo('evr')?.publicacion_intento ?? null };

  // (n) LA CLAVE CAMBIÓ (el negocio pegó la de otra cuenta de Zernio): Zernio no encuentra el post con la clave nueva (404) aunque
  //     siga programado en la cuenta de antes. Cancelar NO dice «cancelado», y la relectura no la da por perdida. Con la misma
  //     clave, un 404 sí es «ya no está».
  reset();
  db.calendario_eventos.push(evento('evs'));
  await enWs(() => P.programarPublicaciones(['evs']));
  const claveVieja = crudo('evs')?.publicacion_clave ?? null;
  db.calendario_eventos.push(evento('evt', { inicio: '2026-11-02T11:00:00.000Z', publicacion: 'programada', post_id: 'post_borrado', publicacion_clave: claveVieja }));
  ponerClave('sk_otra_cuenta');
  const cancelarOtraClave = await enWs(() => P.cancelarPublicacion('evs'));
  const deletesOtraClave = zernio.filter((z) => z.metodo === 'DELETE').length;
  const releerOtraClave = await enWs(() => P.releerPublicaciones());
  const evtOtraClave = fila('evt');
  ponerClave('sk_zernio_prueba');
  const releerMisma = await enWs(() => P.releerPublicaciones());
  out.n = {
    claveVieja, cancelarOtraClave, deletesOtraClave, evsOtraClave: fila('evs'), sigueEnZernio: Object.keys(posts),
    releerOtraClave, evtOtraClave, releerMisma, evtMisma: fila('evt'),
    cancelarMisma: await enWs(() => P.cancelarPublicacion('evs')), evsMisma: fila('evs'),
  };

  // (o) LA CARRERA: entre que se decide y se escribe, otro pedido la programa. Mover, borrar y tildar llevan la condición EN la
  //     escritura: no pisan una recién programada.
  reset();
  db.calendario_eventos.push(evento('evu'));
  db.calendario_eventos.push(evento('evv'));
  db.calendario_eventos.push(evento('evw'));
  const programarEnMedio = (id: string) => () => { const f = crudo(id); if (f) { f.publicacion = 'programada'; f.post_id = 'post_carrera'; } };
  antesDeEscribir = programarEnMedio('evu');
  const moverCarrera = await enWs(() => C.cambiarEvento('evu', { ...entrada, titulo: 'Reel evu' }, TZ));
  antesDeEscribir = programarEnMedio('evv');
  const borrarCarrera = await enWs(() => C.borrarEvento('evv'));
  antesDeEscribir = programarEnMedio('evw');
  const marcarCarrera = await enWs(() => C.marcarEvento('evw', true));
  out.o = { moverCarrera, inicioU: crudo('evu')?.inicio ?? null, borrarCarrera, existeV: !!crudo('evv'), marcarCarrera, estadoW: crudo('evw')?.estado ?? null };

  // (p) El «Deshacer» de un borrado devuelve el archivo y el texto, NUNCA la cuenta (se vuelve a elegir entre las del negocio).
  reset();
  db.calendario_eventos.push(evento('evx'));
  const bx = await enWs(() => C.borrarEvento('evx'));
  out.p = { publicacion: (bx as { publicacion?: unknown } | null)?.publicacion ?? null };

  // (q) YouTube: el título del evento es el título público del video, hasta 100 caracteres.
  reset();
  db.calendario_eventos.push(evento('evy', { red: 'youtube', cuenta_red: 'acc_yt_1', formato: 'video', titulo: 'T'.repeat(101) }));
  db.calendario_eventos.push(evento('evz', { red: 'youtube', cuenta_red: 'acc_yt_1', formato: 'video', titulo: 'T'.repeat(100) }));
  out.q = { r: await enWs(() => P.programarPublicaciones(['evy', 'evz'])), posts: posts0().map((p) => (p.cuerpo?.metadata as { calendarioEventoId?: string })?.calendarioEventoId) };

  // ── La segunda verificación (29/10, C:/dev/revisiones/2910-verificacion-zernio-254856316-planes-ddfa645d4.md) ──────────────
  const conIntento = (id: string) => ({ ...fila(id), intento: crudo(id)?.publicacion_intento ?? null });

  // (r) N1: LA VENTANA SE CUENTA DESDE EL PRIMER ENVÍO. Zernio crea y la base no anota «programada» (ni al reintentar la
  //     anotación): queda `programando`. A los 11 minutos la relectura la pasa a la duda SIN el intento, y «Reintentar» a los
  //     12 no repite un x-request-id que Zernio ya olvidó: no sale otro post. Y N1b: crea, la respuesta se corta y la base no
  //     anota la duda; igual.
  reset();
  db.calendario_eventos.push(evento('evN1'));
  db.calendario_eventos.push(evento('evN1b', { inicio: '2026-11-04T13:00:00.000Z' }));
  fallarTrasPost = 2;
  const n1 = await enWs(() => P.programarPublicaciones(['evN1']));
  const n1Fila = conIntento('evN1');
  proximoPost = 'cae-creado';
  fallarTrasPost = 1;
  const n1b = await enWs(() => P.programarPublicaciones(['evN1b']));
  const n1bFila = conIntento('evN1b');
  reloj = AHORA + 11 * 60_000;
  const n1Releer = await enWs(() => P.releerPublicaciones());
  const n1Duda = [conIntento('evN1'), conIntento('evN1b')];
  reloj = AHORA + 12 * 60_000;
  const n1Reintento = await enWs(() => P.programarPublicaciones(['evN1', 'evN1b']));
  out.r = { n1, n1Fila, n1b, n1bFila, n1Releer, n1Duda, n1Reintento, pedidos: posts0().length, creados: Object.keys(posts).length };

  // (r1) Zernio crea y la base falla UNA vez al anotarlo: se reintenta la anotación con el post que ya se conoce.
  reset();
  db.calendario_eventos.push(evento('evR1'));
  fallarTrasPost = 1;
  out.r1 = { r: await enWs(() => P.programarPublicaciones(['evR1'])), fila: conIntento('evR1'), creados: Object.keys(posts).length };

  // (r2) N1c: dos respuestas perdidas seguidas, sin falla de la base. A los 3:54 el reintento repite el pedido (dentro de la
  //      ventana) y la respuesta se vuelve a cortar; a los 7:48 del PRIMER envío ya no se repite: se aclara en Zernio.
  reset();
  db.calendario_eventos.push(evento('evN1c'));
  proximoPost = 'cae-creado';
  const c1 = await enWs(() => P.programarPublicaciones(['evN1c']));
  reloj = AHORA + 3 * 60_000 + 54_000;
  proximoPost = 'cae-creado';
  const c2 = await enWs(() => P.programarPublicaciones(['evN1c']));
  const c2Fila = conIntento('evN1c');
  reloj = AHORA + 7 * 60_000 + 48_000;
  const c3 = await enWs(() => P.programarPublicaciones(['evN1c']));
  out.r2 = { c1, c2, c2Fila, c3, fila: conIntento('evN1c'), pedidos: posts0().map((p) => p.requestId), creados: Object.keys(posts).length };

  // (r3) N2: en el REINTENTO, un 429 o un 422 de Zernio no dice nada del primer pedido: sigue en duda con su intento, y el
  //      reintento siguiente (todavía en la ventana) recupera el post original. Un solo post.
  for (const status of ['429', '422'] as const) {
    reset();
    db.calendario_eventos.push(evento('evN2'));
    proximoPost = 'cae-creado';
    await enWs(() => P.programarPublicaciones(['evN2']));
    const intento0 = crudo('evN2')?.publicacion_intento ?? null;
    reloj = AHORA + 60_000;
    proximoPost = status;
    const a = await enWs(() => P.programarPublicaciones(['evN2']));
    const aFila = conIntento('evN2');
    reloj = AHORA + 2 * 60_000;
    const b = await enWs(() => P.programarPublicaciones(['evN2']));
    out[`r3_${status}`] = { intento0, a, aFila, b, fila: fila('evN2'), pedidos: posts0().map((p) => p.requestId), creados: Object.keys(posts).length };
  }

  // (r4) Ticket #34: un 429 en el PRIMER pedido es un `fallo` (Zernio no la creó) y dice lo que pasó; leer las cuentas en pausa, también.
  reset();
  db.calendario_eventos.push(evento('evP1'));
  proximoPost = '429';
  const primero = await enWs(() => P.programarPublicaciones(['evP1']));
  const trasPausa = fila('evP1');
  proximoPost = 'ok';
  const otraVez = await enWs(() => P.programarPublicaciones(['evP1']));
  reset();
  db.calendario_eventos.push(evento('evP2'));
  cuentasEnPausa = true;
  const sinLeerCuentas = await enWs(() => P.programarPublicaciones(['evP2']));
  const leerCuentas = await enWs(() => P.cuentasParaPublicar());
  out.r4 = { primero, trasPausa, otraVez, fila: fila('evP1'), sinLeerCuentas, leerCuentas };

  // (s) N3: una `dudosa` que SÍ quedó en Zernio y nadie reintentó a tiempo. Tildar, mover y borrar dicen la verdad (no «se tilda
  //     sola» ni «cancela»), y «Ya lo resolví en Zernio» la suelta: sin programar y SIN la cuenta (no vuelve a «Programar las
  //     listas»), con el archivo y el texto, y ahí se tilda a mano.
  reset();
  db.calendario_eventos.push(evento('evN3'));
  proximoPost = 'cae-creado';
  await enWs(() => P.programarPublicaciones(['evN3']));
  reloj = AHORA + 6 * 60_000;
  out.s = {
    marcar: await enWs(() => C.marcarEvento('evN3', true)),
    mover: await enWs(() => C.cambiarEvento('evN3', { ...entrada, titulo: 'Reel evN3' }, TZ)),
    borrar: await enWs(() => C.borrarEvento('evN3')),
    resolver: await enWs(() => P.resolverEnZernio('evN3')),
    tras: { ...fila('evN3'), red: crudo('evN3')?.red ?? null, cuenta: crudo('evN3')?.cuenta_red ?? null, archivo: crudo('evN3')?.archivo ?? null, texto: crudo('evN3')?.texto ?? null, intento: crudo('evN3')?.publicacion_intento ?? null },
    listas: await enWs(() => P.listasParaProgramar('2026-11-02', '2026-11-08', TZ)),
    marcarDespues: await enWs(() => C.marcarEvento('evN3', true)),
    resolverOtra: await enWs(() => P.resolverEnZernio('evN3')),
    creados: Object.keys(posts).length,
  };

  // (s2) N7: programada con una clave y el negocio pega OTRA. Tildar lo dice; «Ya lo resolví en Zernio» la suelta. Con la MISMA
  //      clave no se suelta (MaKo la sigue y la cancela).
  reset();
  db.calendario_eventos.push(evento('evN7'));
  await enWs(() => P.programarPublicaciones(['evN7']));
  const otraClaveDe = () => enWs(async () => P.programadaConOtraClave((await P.leerPublicaciones(['evN7'])).get('evN7')));
  const misma = { otra: await otraClaveDe(), marcar: await enWs(() => C.marcarEvento('evN7', true)), resolver: await enWs(() => P.resolverEnZernio('evN7')) };
  ponerClave('sk_otra_cuenta');
  out.s2 = {
    misma, otra: await otraClaveDe(), marcar: await enWs(() => C.marcarEvento('evN7', true)),
    resolver: await enWs(() => P.resolverEnZernio('evN7')), fila: fila('evN7'), sigueEnZernio: Object.keys(posts).length,
  };

  // (t) N6: LA CARRERA AL REVÉS. Programar lee el evento y, antes de su reclamo, otro pedido lo mueve (y renueva `updated_at`,
  //     como cambiarEvento): el reclamo no gana, y no sale nada a la hora vieja.
  reset();
  db.calendario_eventos.push(evento('evN6'));
  antesDeEscribir = () => { const f = crudo('evN6'); if (f) { f.inicio = '2026-11-07T23:00:00.000Z'; f.updated_at = new Date().toISOString(); } };
  const t1 = await enWs(() => P.programarPublicaciones(['evN6']));
  const tFila = { ...fila('evN6'), inicio: crudo('evN6')?.inicio ?? null };
  const tPosts = posts0().length;
  const t2 = await enWs(() => P.programarPublicaciones(['evN6']));
  out.t = { t1, tFila, tPosts, t2, scheduledFor: posts0().map((p) => p.cuerpo?.scheduledFor ?? null) };

  // (u) N5: el «Deshacer» de un evento que ya volvió (23505) no escribe la publicación encima de uno programado.
  reset();
  db.calendario_eventos.push(evento('evN5', { texto: 'texto que va a salir' }));
  await enWs(() => P.programarPublicaciones(['evN5']));
  const b5 = {
    id: 'evN5', tipo: 'publicacion', formato: 'reel', titulo: 'Reel evN5', notas: '', inicio: '2026-11-03T13:00:00.000Z', fin: null, dia_completo: false,
    estado: 'planeado', origen: 'user', creado_por: null,
    publicacion: { red: null, cuenta_red: null, archivo: `${WS}/calendario/evN5/ffffffffffffffffffffffff.mp4`, archivo_tipo: 'video', texto: 'OTRO texto' },
  };
  const rest5 = await enWs(() => C.restaurarEvento(b5 as never));
  const f5 = crudo('evN5');
  out.u = { rest5: rest5 ?? 'ok', publicacion: f5?.publicacion ?? null, texto: f5?.texto ?? null, archivo: f5?.archivo ?? null };

  out.red = [...red];
  // Se cierra a mano: algún módulo del Calendario deja un temporizador vivo y el padre (execFileSync) esperaba para siempre.
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`, () => process.exit(0));
}

void main().catch((e) => { process.stdout.write(`\n@@RESULTADO@@${JSON.stringify({ tiro: e instanceof Error ? e.stack : String(e) })}`, () => process.exit(0)); });

export {};
