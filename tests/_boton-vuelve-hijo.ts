// =============================================================================
// HIJO de tests/boton-vuelve-a-la-condicion.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre la RUTA REAL del webhook de Zernio (app/api/webhooks/zernio/route.ts) y el motor REAL (lib/nutricion.ts,
// lib/zernio-entrante.ts, lib/canal-zernio.ts, lib/zernio.ts) contra dobles: un PostgREST en memoria
// (tests/_postgrest-de-mentira.ts) y un Zernio de mentira en la red que hace lo que hace el de verdad con la Idempotency-Key
// (la misma clave con el mismo pedido = la respuesta guardada, SIN mandar nada; con otro pedido, 422) y con el «¿te
// sigue?» (una respuesta en caché por cuenta y persona, salvo `refresh=true`). Nada sale a la red real.
// Nació con el arnés de la reverificación de Integración (C:/dev/revisiones/scratch-0265/ig-refuta/_hijo.mts).
//
// Corre con: node --conditions=react-server --experimental-test-module-mocks --no-warnings --import tsx tests/_boton-vuelve-hijo.ts <escenario>
// Escenarios: 'gate' (el caso del ticket #29), 'tope' (el tope de toques) y 'publicacion' (la publicación o el Reel del CRON,
// ticket #25: tests/comentario-publicacion.test.ts) y 'duplicadas' / '_texto' / '_ajeno' (el toque de un DM viejo con varias
// automatizaciones copiadas de la misma, ticket #33: tests/boton-dm-viejo.test.ts) y 'dm_y_mencion' (las palabras clave de un DM y la
// mención en una historia, paridad con ManyChat del 10/11/2026: tests/instagram-dm-palabras-mencion.test.ts). Imprime un JSON en la última línea.
// =============================================================================
import { mock } from 'node:test';
import { createHmac, createHash } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const RAIZ = join(__dirname, '..');
const href = (rel: string) => pathToFileURL(join(RAIZ, rel)).href;
const ESC = process.argv[2] ?? 'gate';

async function main(): Promise<void> {

const { crearPostgrest } = await import(href('tests/_postgrest-de-mentira.ts'));
let nextId = 5000;
const now = () => new Date().toISOString();
const pg = crearPostgrest({
  tablas: ['workspaces', 'leads', 'nutricion_secuencias', 'nutricion_inscripciones', 'nutricion_envios', 'ig_conversaciones', 'ig_mensajes',
    'webhook_routing', 'zernio_eventos', 'zernio_workspace', 'app_settings', 'lead_events', 'lead_audit', 'wa_borradores', 'lead_historial'],
  defaults: (t: string, f: Record<string, unknown>) => {
    const b: Record<string, unknown> = { id: nextId++, created_at: now(), updated_at: now() };
    if (t === 'nutricion_inscripciones') Object.assign(b, { inscripto_at: now(), desenlace: null, desenlace_at: null, hilos: null, hilos_rev: 0, nodo_actual: null,
      conversacion_ultima_at: null, conversacion_cerrada_at: null, conversacion_cierre: null, reunion_at: null });
    if (t === 'ig_conversaciones') Object.assign(b, { lead_id: null, comentario_respondido_at: null, ventana_expira_at: null, ultimo_mensaje_at: null,
      comentario_id: null, comentario_post_id: null, comentario_at: null, zernio_conversation_id: null, username: null });
    if (t === 'zernio_eventos') delete b.id;
    return { ...b, ...f };
  },
  unicos: [{ tabla: 'nutricion_inscripciones', columnas: ['lead_id', 'secuencia_id'], donde: () => true, nombre: 'uq_lead_sec' }],
});

// ── Zernio de mentira ──
type Z = { metodo: string; path: string; key: string | null; res: string; texto?: string };
const zlog: Z[] = [];
const claves = new Map<string, { huella: string; resp: unknown }>();
const otros: string[] = [];
// Las publicaciones de la cuenta, como las devuelve GET /v1/accounts/{id}/posts (ticket #25).
const PUBLICACIONES = [
  { id: 'p_reel_guia', platform: 'instagram', message: 'Te dejo la guía de la fiesta 🎉\nComenta GUIA y te la mando', createdTime: '2026-10-28T18:00:00.000Z',
    permalink: 'https://www.instagram.com/reel/GUIA123/', picture: 'https://cdn.test/guia.jpg', mediaType: 'REELS' },
  { id: 'p_reel_2', platform: 'instagram', message: 'Segundo reel', createdTime: '2026-10-29T10:00:00.000Z',
    permalink: 'https://www.instagram.com/reel/DOS222/', picture: 'https://cdn.test/dos.jpg', mediaType: 'REELS' },
  { id: 'p_foto_vieja', platform: 'instagram', message: '', createdTime: '2026-09-01T10:00:00.000Z',
    permalink: 'https://www.instagram.com/p/VIEJA77/', picture: 'https://cdn.test/vieja.jpg', mediaType: 'IMAGE' },
];
const consultasPublicaciones: string[] = [];
/** Lo que contesta Zernio a las publicaciones: 429 es una pausa (ticket #34). */
let estadoPublicaciones = 200;
// «¿Te sigue?»: lo que dice Meta AHORA, y lo que Zernio guardó (por cuenta y persona) la última vez que le preguntó.
let sigueDeVerdad = false;
const cacheSigue = new Map<string, boolean>();
const consultasSigue: string[] = [];
const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...extra } });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const url = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
  // «Quién entró en las últimas 24 h» (el orden de la cola del motor) pide un `or=` que el PostgREST de mentira no entiende, y
  // cada corrida esperaba 7 s de reintentos: nadie nuevo, y la cola va en su orden de siempre.
  if (url.host === 'supa.test' && url.pathname.endsWith('/leads') && url.searchParams.has('or')) return json(200, [], { 'content-range': '*/0' });
  if (url.host === 'supa.test') return pg.responder(url, init);
  if (url.host === 'zernio.com') {
    const path = url.pathname.replace('/api/v1', '');
    const metodo = (init.method ?? 'GET').toUpperCase();
    // La cuenta del negocio y sus publicaciones (ticket #25): lo que lee el selector del CRON.
    if (metodo === 'GET' && path === '/profiles') return json(200, { profiles: [{ _id: 'prof_10', name: 'Fiesta Music', isDefault: true }] });
    if (metodo === 'GET' && path === '/accounts') return json(200, { accounts: [{ _id: 'acc_10', platform: 'instagram', username: 'fiestamusic', isActive: true, profileId: 'prof_10' }] });
    const publicaciones = /^\/accounts\/([^/]+)\/posts$/.exec(path);
    if (publicaciones && metodo === 'GET' && estadoPublicaciones !== 200) return json(estadoPublicaciones, { error: 'Rate limit exceeded' }, { 'Retry-After': '23' });
    if (publicaciones && metodo === 'GET') { consultasPublicaciones.push(publicaciones[1]); return json(200, { status: 'success', posts: PUBLICACIONES }); }
    const seguimiento = /^\/accounts\/([^/]+)\/follow-status\/([^/]+)$/.exec(path);
    if (seguimiento && metodo === 'GET') {
      const k = `${seguimiento[1]}|${seguimiento[2]}`;
      const fresco = url.searchParams.get('refresh') === 'true';
      consultasSigue.push(fresco ? 'fresco' : 'cache');
      if (fresco || !cacheSigue.has(k)) cacheSigue.set(k, sigueDeVerdad);
      return json(200, { isFollower: cacheSigue.get(k), unavailableReason: null });
    }
    const key = new Headers(init.headers).get('Idempotency-Key');
    const raw = String(init.body ?? '');
    const body = raw ? JSON.parse(raw) : {};
    const huella = createHash('sha1').update(`${metodo} ${path} ${raw}`).digest('hex');
    const reg = (res: string) => zlog.push({ metodo, path, key, res, texto: body?.message ?? body?.text });
    if (key && claves.has(key)) {
      const prev = claves.get(key)!;
      if (prev.huella !== huella) { reg('422'); return json(422, { error: 'Idempotency-Key already used with a different request' }); }
      reg('replay'); return json(200, prev.resp, { 'Idempotent-Replayed': 'true' });
    }
    const n = zlog.length + 1;
    const resp = { success: true, messageId: `zm${n}`, commentId: `zc${n}`, data: { messageId: `zm${n}`, commentId: `zc${n}` } };
    if (key) claves.set(key, { huella, resp });
    reg('entregado');
    return json(200, resp);
  }
  otros.push(`${url.host}${url.pathname}`);
  return json(500, { error: 'sin red' });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'srk-prueba';
process.env.ZERNIO_WEBHOOK_SECRET = 'secreto-boton-29';

const sinDefault = (m: Record<string, unknown>) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
// `exports` es de Node 24; los tipos de @types/node todavía no lo tienen (como en tests/_contrato-ruta-hijo.ts).
const con = (exports: Record<string, unknown>) => ({ exports }) as unknown as Parameters<typeof mock.module>[1];

// Dobles ANTES de importar la ruta.
const cred = await import(href('lib/credenciales.ts'));
mock.module(href('lib/credenciales.ts'), con({ ...sinDefault(cred),
  credDelClienteEstricta: async (c: string) => (c === 'ZERNIO_API_KEY' ? 'zk_boton' : null), credWsEstricta: async () => null,
  // Una sola clave de Zernio (sin las extra del 29/10).
  clavesGuardadasConBase: async () => [] }));
const avm = await import(href('lib/avisos.ts'));
mock.module(href('lib/avisos.ts'), con({ ...sinDefault(avm),
  emitirDelCatalogo: async () => ({ ok: true }), emitirEventoDePlataforma: async () => ({ ok: true }) }));
const colaAfter: Array<() => Promise<unknown>> = [];
const ns = pathToFileURL(createRequire(join(RAIZ, 'package.json')).resolve('next/server')).href;
mock.module(ns, con({ after: (fn: () => Promise<unknown>) => { colaAfter.push(fn); } }));

const { POST } = await import(href('app/api/webhooks/zernio/route.ts'));
const { runWithWorkspace } = await import(href('lib/workspace.ts'));
const { payloadDeBoton } = await import(href('lib/botones-social.ts'));
const db = pg.db as Record<string, Array<Record<string, unknown>>>;
const WS = 10;
db.workspaces.push({ id: WS, nombre: 'Fiesta Music', slug: 'fiesta', estado: 'activo', capa: 'completo', created_at: now() });
db.webhook_routing.push({ servicio: 'zernio', identificador: 'prof_10', workspace_id: WS });
db.webhook_routing.push({ servicio: 'zernio_cuenta', identificador: 'acc_10', workspace_id: WS });
// La zona del negocio donde AHORA es de día (sin ella, a la madrugada de Tijuana nada sale solo).
db.app_settings.push({ workspace_id: WS, key: 'mako.timezone', value: 'Asia/Dubai', created_at: now(), updated_at: now() });

// EL FLUJO DE LEANDRO (la 680 de Fiesta Music, leída de la base el 29/10/2026), con «Ya te sigo» volviendo a la PRIMERA
// condición, como dice /docs: comenta → «Obtener recurso» → ¿te sigue? → sí: el link · no: «Seguinos» + «Ya te sigo» → la
// MISMA ¿te sigue?
db.nutricion_secuencias.push({
  id: 680, workspace_id: WS, clave: 's680', nombre: 'Comentario con pruebafm', etapa: null, etapas: null, trigger_tipo: 'instagram', activa: true,
  archivada_at: null, estrategia: null, funnel_id: null, producto_id: null, cron: null, cron_proxima_at: null, instance_name: null, etiqueta_id: null,
  disparadores: [{ id: 'd1', trigger_tipo: 'instagram', subtipo: 'comentario', palabras: ['pruebafm'] }], disparadores_rev: 1, reentrada: 'una_vez',
  created_at: now(), updated_at: now(),
  pasos: [
    { id: 'entrada', nodo: 'inicio', canal: 'instagram', cuerpo: '', siguiente: 'm1' },
    { id: 'm1', canal: 'instagram', cuerpo: 'Te dejo el recurso por el que comentaste:', siguiente: null, botones: [{ id: 'b1', titulo: 'Obtener recurso', siguiente: 'c1' }] },
    { id: 'c1', nodo: 'condicion', canal: 'instagram', cuerpo: '', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'sigue_instagram' }], siguiente: 'm2' }], si_no: 'm3' },
    { id: 'm2', canal: 'instagram', cuerpo: '¡Acá está!', siguiente: null, botones: [{ id: 'b1', titulo: 'Abrir', url: 'https://fiesta.test/guia' }] },
    { id: 'm3', canal: 'instagram', cuerpo: 'Todavía no te veo entre nuestros seguidores. Seguinos y toca el botón de nuevo:', siguiente: null, botones: [{ id: 'b1', titulo: 'Ya te sigo', siguiente: 'c1' }] },
  ],
});

const firma = (raw: string) => createHmac('sha256', process.env.ZERNIO_WEBHOOK_SECRET!).update(raw).digest('hex');
let evN = 0;
async function llega(body: Record<string, unknown>): Promise<void> {
  const raw = JSON.stringify(body);
  const req = { text: async () => raw, nextUrl: new URL('https://app.test/api/webhooks/zernio'),
    headers: new Headers({ 'x-zernio-signature': firma(raw), 'x-zernio-event-id': String(body.id) }) };
  await POST(req as never);
  while (colaAfter.length) await colaAfter.shift()!();
}
const tick = async () => { const { procesarEnvios } = await import(href('lib/nutricion.ts')); return runWithWorkspace(WS, () => procesarEnvios()); };
const ANA = { id: 'ig_ana', username: 'ana', name: 'Ana' };
const CUENTA = { id: 'acc_10', accountId: 'acc_10', profileId: 'prof_10', platform: 'instagram', username: 'fiestamusic' };
const comentario = (post = 'p_reel_1', kid = 'k1', texto = 'pruebafm') => ({
  id: `ev${++evN}`, event: 'comment.received', timestamp: now(),
  comment: { id: kid, postId: null, platformPostId: post, platform: 'instagram', text: texto, createdAt: now(), author: ANA, isReply: false, parentCommentId: null },
  post: { id: null, platformPostId: post, content: null, imageUrl: null, permalink: null }, account: CUENTA });
/** El TOQUE de un botón: un `message.received` con el payload que le pusimos (como llega de Zernio). Sin `insc`, la primera. */
const toque = (nodo: string, titulo: string, inscElegida?: number, payload: 'mako' | 'ninguno' | 'ajeno' = 'mako') => {
  const insc = inscElegida ?? Number(db.nutricion_inscripciones[0]?.id);
  const n = ++evN;
  return {
    id: `ev${n}`, event: 'message.received', timestamp: now(),
    message: { id: `mid${n}`, conversationId: 'conv_ana', platform: 'instagram', platformMessageId: `mid.${n}`, direction: 'incoming', text: titulo,
      attachments: [], sender: ANA, sentAt: now(), isRead: false },
    conversation: { id: 'conv_ana', platformConversationId: 'ig_ana', participantId: 'ig_ana', participantName: 'Ana', status: 'active' },
    // 'ajeno': lo que llegó en producción con el DM viejo (ticket #33): un payload que no es el de MaKo, con el título.
    account: CUENTA, metadata: payload === 'ninguno' ? null : { postbackPayload: payload === 'ajeno' ? 'OBTENER_RECURSO' : payloadDeBoton(insc, nodo, 'b1'), postbackTitle: titulo },
  };
};

/** Lo que le LLEGÓ a Ana (lo que Zernio mandó de verdad, sin las respuestas guardadas), y lo demás de cada paso. */
const pasos: Record<string, unknown> = {};
const anotar = (n: string, extra: Record<string, unknown> = {}) => {
  pasos[n] = {
    ...extra,
    llego: zlog.filter((z) => z.res === 'entregado').map((z) => (z.texto ?? '').slice(0, 30)),
    zernio: zlog.map((z) => `${z.res} ${z.metodo} ${z.path} key=${z.key}`),
    sigue: [...consultasSigue],
    insc: db.nutricion_inscripciones.map((i) => `${i.estado} nodo=${i.nodo_actual}`),
    envios: db.nutricion_envios.map((e) => `${e.nodo_id} ${e.estado}`),
    marca: db.app_settings.find((s) => String(s.key).startsWith('nutricion.boton.'))?.value ?? null,
    historial: db.lead_audit.map((a) => String(a.valor_nuevo ?? '')).filter((t) => t.startsWith('Tocó')),
    // Lo que quedó guardado de lo que vino con cada mensaje (ticket #33).
    metadataZernio: db.ig_mensajes.map((m) => m.metadata_zernio ?? null),
  };
};

if (ESC !== 'publicacion' && !ESC.startsWith('duplicadas') && ESC !== 'dm_y_mencion') {
  await llega(comentario());
  await tick();
  anotar('0_comento');
}

if (ESC === 'gate') {
  // 1. Toca «Obtener recurso» sin seguir la cuenta: el «Seguinos».
  await llega(toque('m1', 'Obtener recurso'));
  anotar('1_obtener_sin_seguir');
  // 2. Toca «Ya te sigo» SIN seguirla todavía: vuelve a la condición y le tiene que LLEGAR otra vez el «Seguinos».
  await llega(toque('m3', 'Ya te sigo'));
  anotar('2_ya_te_sigo_sin_seguir');
  // 3. La sigue y toca «Ya te sigo» otra vez, enseguida (menos de un minuto): el link.
  sigueDeVerdad = true;
  await llega(toque('m3', 'Ya te sigo'));
  anotar('3_la_sigue_y_toca');
  // 4. El doble toque: el mismo botón otra vez, sin que haya salido nada de esa tarjeta. No se manda el link dos veces.
  await llega(toque('m3', 'Ya te sigo'));
  anotar('4_doble_toque');
}

if (ESC === 'tope') {
  // Nunca la sigue, y toca sin parar: «Obtener recurso» y doce «Ya te sigo».
  await llega(toque('m1', 'Obtener recurso'));
  for (let k = 0; k < 12; k++) await llega(toque('m3', 'Ya te sigo'));
  anotar('1_toca_sin_parar');
}

if (ESC === 'publicacion') {
  // La 680 elige el Reel de la guía. ⚠️ Su primer CRON se rearma de las COLUMNAS (`disparadoresDe`): la trampa del #17.
  (db.nutricion_secuencias[0].disparadores as Array<Record<string, unknown>>)[0].publicacion = { id: 'p_reel_guia', texto: 'Te dejo la guía de la fiesta' };
  // 1. Comenta la palabra en OTRA publicación: nada (ni lead, ni inscripción, ni DM).
  await llega(comentario('p_foto_vieja', 'k1'));
  await tick();
  anotar('1_otra_publicacion', { leads: db.leads.length });
  // 2. La comenta en el Reel elegido: entra y le llega el DM.
  await llega(comentario('p_reel_guia', 'k2'));
  await tick();
  anotar('2_la_elegida', { leads: db.leads.length });
  // 3. Lo que muestra el selector, como lo pide (`publicacionesParaElCron`, con la cuenta del negocio).
  const { publicacionesParaElCron } = await import(href('lib/disparadores-canales.ts'));
  const lista = await runWithWorkspace(WS, () => publicacionesParaElCron('instagram'));
  // 4. MaKo con el LINK de otro Reel de la cuenta: lo encuentra y guarda su id y su nombre. Con uno que no es de la cuenta, lo dice.
  const { runnerDe } = await import(href('lib/api-mako/runners.ts'));
  const run = runnerDe('cambiar_crons_secuencia') as unknown as { preparar: (i: Record<string, unknown>) => Promise<Record<string, unknown>> };
  const cron = (publicacion: string) => ({ secuenciaId: 680, crons: [{ trigger_tipo: 'instagram', subtipo: 'comentario', palabras: ['pruebafm'], publicacion }] });
  const conLink = await runWithWorkspace(WS, () => run.preparar(cron('https://instagram.com/reel/DOS222?igsh=abc')));
  const linkAjeno = await runWithWorkspace(WS, () => run.preparar(cron('https://www.instagram.com/reel/AJENO99/')));
  anotar('3_lista_y_api', { lista, conLink, linkAjeno, consultasPublicaciones: [...consultasPublicaciones] });
  // 5. Zernio pide una pausa (ticket #34): TIRA el 429 con su espera, para que la ruta lo diga. Un 500 sigue siendo «no pude leer».
  estadoPublicaciones = 429;
  const conPausa = await runWithWorkspace(WS, () => publicacionesParaElCron('instagram')).then(
    (x: unknown) => ({ devolvio: x }), (e: { status?: number; esperaMs?: number | null }) => ({ status: e.status, esperaMs: e.esperaMs }));
  estadoPublicaciones = 500;
  const conCaida = await runWithWorkspace(WS, () => publicacionesParaElCron('instagram')).then((x: unknown) => ({ devolvio: x }), (e: { status?: number }) => ({ status: e.status }));
  estadoPublicaciones = 200;
  anotar('4_pausa', { conPausa, conCaida });
}

if (ESC.startsWith('duplicadas')) {
  // EL CASO DE LEANDRO (ticket #33, 30/10/2026): cinco copias de la 680 (los MISMOS ids de tarjeta y el mismo botón), cada una con
  // su palabra; la misma cuenta comenta las cinco y recibe cinco DMs con «Obtener recurso». Toca el de un DM VIEJO.
  const base = db.nutricion_secuencias[0];
  const palabras = ['lista', 'marca', 'lanzamiento', 'guia', 'claude'];
  palabras.forEach((w, k) => db.nutricion_secuencias.push({ ...base, id: 707 + k, clave: `s${707 + k}`, nombre: `IG - ${w.toUpperCase()}`, activa: true,
    disparadores: [{ id: 'd1', trigger_tipo: 'instagram', subtipo: 'comentario', palabras: [w] }] }));
  for (const [k, w] of palabras.entries()) { await llega(comentario(`p_reel_${w}`, `k${k + 1}`, w)); await tick(); }
  const insc = (sec: number) => Number(db.nutricion_inscripciones.find((i) => Number(i.secuencia_id) === sec)?.id);
  anotar('0_cinco_dms');
  // Toca el «Obtener recurso» del PRIMER DM (el de LISTA), sin seguir la cuenta: el «Seguinos» de LISTA, y las otras quietas.
  // Antes, una completada más (la del DM más nuevo, que ya recibió su recurso): un toque no la toca.
  const ultima = db.nutricion_inscripciones.find((i) => Number(i.secuencia_id) === 711)!;
  ultima.estado = 'completada'; ultima.nodo_actual = null;
  await llega(toque('m1', 'Obtener recurso', insc(707), ESC === 'duplicadas_texto' ? 'ninguno' : ESC === 'duplicadas_ajeno' ? 'ajeno' : 'mako'));
  anotar('1_toca_el_viejo', { estados: db.nutricion_inscripciones.map((i) => `${i.secuencia_id}:${i.estado}:${i.nodo_actual}`) });
}

if (ESC === 'dm_y_mencion') {
  // LAS PALABRAS DE UN DM Y LA MENCIÓN EN UNA HISTORIA (10/11/2026, paridad con ManyChat), por el webhook REAL.
  // La 680 escucha ahora un DM con «guia»; una segunda (la 681) escucha la mención en una historia.
  const base = db.nutricion_secuencias[0];
  base.disparadores = [{ id: 'd1', trigger_tipo: 'instagram', subtipo: 'dm', palabras: ['guia'] }];
  db.nutricion_secuencias.push({ ...base, id: 681, clave: 's681', nombre: 'Te mencionó', disparadores: [{ id: 'd1', trigger_tipo: 'instagram', subtipo: 'mencion' }],
    pasos: [{ id: 'entrada', nodo: 'inicio', canal: 'instagram', cuerpo: '', siguiente: 'm1' }, { id: 'm1', canal: 'instagram', cuerpo: '¡Gracias por mencionarnos!', siguiente: null }] });
  let n = 900;
  const persona = (id: string, username: string) => ({ id, username, name: username });
  const conv = (p: { id: string; name: string }) => ({ id: `conv_${p.id}`, platformConversationId: p.id, participantId: p.id, participantName: p.name, status: 'active' });
  const dm = (p: { id: string; username: string; name: string }, texto: string) => ({
    id: `ev${++n}`, event: 'message.received', timestamp: now(),
    message: { id: `mid${n}`, conversationId: `conv_${p.id}`, platform: 'instagram', platformMessageId: `mid.${n}`, direction: 'incoming', text: texto, attachments: [], sender: p, sentAt: now(), isRead: false },
    conversation: conv(p), account: CUENTA, metadata: null,
  });
  const mencion = (p: { id: string; username: string; name: string }) => ({
    id: `ev${++n}`, event: 'message.received', timestamp: now(),
    message: { id: `mid${n}`, conversationId: `conv_${p.id}`, platform: 'instagram', platformMessageId: `mid.${n}`, direction: 'incoming', text: null,
      attachments: [{ type: 'share', originalType: 'story_mention', url: 'https://cdn.test/historia' }], sender: p, sentAt: now(), isRead: false },
    conversation: conv(p), account: CUENTA, metadata: null,
  });
  const BETO = persona('ig_beto', 'beto');
  const CARO = persona('ig_caro', 'caro');
  // 1. Un DM sin la palabra: nadie lo escucha, no nace el lead.
  await llega(dm(BETO, 'hola, ¿cómo están?'));
  await tick();
  anotar('1_dm_sin_palabra', { leads: db.leads.length });
  // 2. Un DM con la palabra (con mayúsculas y tilde): nace el lead, se inscribe en la 680 y le llega su DM.
  await llega(dm(BETO, 'Hola! quiero la GUÍA'));
  await tick();
  anotar('2_dm_con_palabra', { leads: db.leads.length, secuencias: db.nutricion_inscripciones.map((i) => Number(i.secuencia_id)) });
  // 3. Otra persona menciona la cuenta en su historia: la 681 la escucha y le contesta por DM.
  await llega(mencion(CARO));
  await tick();
  anotar('3_mencion', { leads: db.leads.length, secuencias: db.nutricion_inscripciones.map((i) => Number(i.secuencia_id)) });
}

process.stdout.write(`\n@@R@@${JSON.stringify({ pasos, otros, sinMock: [...(pg.sinMock ?? [])] })}\n`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
