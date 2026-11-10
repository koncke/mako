// =============================================================================
// Hijo de tests/tickets-api.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La Ticketera por la API de MaKo (10/11/2026), por las funciones REALES del server y sobre un PostgREST de mentira:
// `ejecutarOperacion` (lo que corre /api/v1 con un token clásico), `aplicarEnElActo` (lo que corre con un token detallado de
// «Lectura y escritura») y `confirmarPendiente` (la bandeja /mako/pendientes). El triage es el de siempre: el ws 10 es el de
// Leandro, con la vía libre de Martín (lib/tickets-reglas.ts → APROBADOS_POR_REGLA), y el ws 3 es un negocio sin regla.
// Escribe una línea `@@TICKETS_API@@<json>` por escena.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

let n = 500;
const pg = crearPostgrest({
  tablas: ['tickets', 'ticket_eventos', 'mako_acciones_pendientes', 'usuarios', 'workspaces', 'app_settings'],
  defaults: (t, f) => {
    const ahora = new Date().toISOString();
    if (t === 'tickets') return { id: ++n, created_at: ahora, updated_at: ahora, ...f };
    if (t === 'ticket_eventos') return { id: ++n, at: ahora, ...f };
    if (t === 'mako_acciones_pendientes') return { id: ++n, created_at: ahora, estado: 'pendiente', ...f };
    return { id: ++n, ...f };
  },
});

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host !== 'supa.test') return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
  return pg.responder(u, init);
}) as typeof fetch;

const DUENA = 'duena@fiesta-ficticia.com';
const OTRA = 'cerrador@fiesta-ficticia.com';
const SIN_REGLA = 'dueno@negocio-de-prueba.com';

function base(): void {
  pg.vaciar();
  pg.db.workspaces.push(
    { id: 9, nombre: 'Plataforma', capa: 'superadmin', estado: 'activo' },
    { id: 10, nombre: 'Fiesta ficticia', capa: 'completo', estado: 'activo' },
    { id: 3, nombre: 'Negocio de prueba', capa: 'completo', estado: 'activo' },
  );
  pg.db.usuarios.push(
    { id: 70, email: DUENA, nombre: 'Ana Duarte', rol: 'cliente', rol_ws: 'admin', workspace_id: 10, estado: 'activo', perfil: {} },
    { id: 71, email: OTRA, nombre: 'Beto Cierra', rol: 'cliente', rol_ws: 'closer', workspace_id: 10, estado: 'activo', perfil: {} },
    { id: 72, email: SIN_REGLA, nombre: 'Caro Prueba', rol: 'cliente', rol_ws: 'admin', workspace_id: 3, estado: 'activo', perfil: {} },
  );
}

type CtxHttp = Record<string, unknown>;
const http = (ws: number, extra: CtxHttp = {}): CtxHttp => ({ ws, canal: 'http', canalKey: `http:${ws}`, rol: 'admin', ...extra });
/** Un token DETALLADO con «Lectura y escritura» en el área mako, creado por `persona`. */
const detallado = (ws: number, persona: string, nombre = 'Claude de Ana') =>
  http(ws, { alcance: 'ejecutar', permisos: { mako: 'escritura' }, token: { id: 'tk1', nombre }, actor: `API · token «${nombre}»`, persona });
/** El token CLÁSICO (el de la skill): sin persona, con su alcance. */
const clasico = (ws: number, alcance = 'ejecutar') => http(ws, { alcance });
const bandeja = (ws: number, email: string) => ({ ws, canal: 'app', canalKey: 'app:bandeja', alcance: 'ejecutar', rol: 'admin', bandeja: true, actor: email });

const salida = (nombre: string, datos: unknown) => console.log(`@@TICKETS_API@@${JSON.stringify({ nombre, ...(datos as object) })}`);
const leerJson = (r: unknown): unknown => {
  const x = r as { ok?: boolean; resultado?: unknown };
  return typeof x.resultado === 'string' ? JSON.parse(x.resultado) : x;
};

async function main() {
  const { ejecutarOperacion } = await import('../lib/api-mako/ejecutar');
  const { aplicarEnElActo } = await import('../lib/api-mako/flujo');
  const { confirmarPendiente } = await import('../lib/api-mako/acciones');
  const { porId } = await import('../lib/api-mako/registro');
  const { runWithWorkspace } = await import('../lib/workspace');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (id: string) => porId(id) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comoCtx = (c: CtxHttp) => c as any;

  // ── 1. Un token detallado de Leandro levanta un ticket: lo firma la PERSONA del token, entra por su vía libre ──
  base();
  const alta = { tipo: 'bug', titulo: 'No se guarda el texto de la tarjeta de Instagram', descripcion: 'Cambio el texto y al volver está el de antes.' };
  const r1 = await runWithWorkspace(10, () => aplicarEnElActo(def('levantar_ticket'), alta, comoCtx(detallado(10, DUENA)), { ws: 10, origen: 'api:tk1' }));
  const t1 = pg.db.tickets.at(-1) ?? null;
  salida('detallado', { r: r1, ticket: t1 && { usuario_email: t1.usuario_email, canal: t1.canal, estado: t1.estado, despacho: t1.despacho, regla: (t1.triage as { regla?: string } | null)?.regla ?? null, contexto: t1.contexto } });

  // ── 2. El nombre del token trae una «@»: NO firma con eso (sin persona, no firma nadie) ──
  base();
  const r2 = await runWithWorkspace(10, () => aplicarEnElActo(def('levantar_ticket'), alta,
    comoCtx(http(10, { alcance: 'ejecutar', permisos: { mako: 'escritura' }, token: { id: 'tk2', nombre: OTRA }, actor: `API · token «${OTRA}»` })), { ws: 10, origen: 'api:tk2' }));
  salida('nombre-con-arroba', { r: r2, tickets: pg.db.tickets.length, pendientes: pg.db.mako_acciones_pendientes.map((p) => p.estado) });

  // ── 3. El token clásico propone; por HTTP no se confirma (no hay quién firme); en la bandeja firma quien confirma ──
  base();
  const r3 = await runWithWorkspace(10, () => ejecutarOperacion('levantar_ticket', alta, comoCtx(clasico(10)), 'json'));
  const pend = pg.db.mako_acciones_pendientes.at(-1);
  const id = Number(pend?.id);
  const c3 = await runWithWorkspace(10, () => confirmarPendiente(comoCtx(clasico(10)), id));
  const trasHttp = { estado: pg.db.mako_acciones_pendientes.find((p) => Number(p.id) === id)?.estado, tickets: pg.db.tickets.length };
  const c3b = await runWithWorkspace(10, () => confirmarPendiente(comoCtx(bandeja(10, DUENA)), id));
  const t3 = pg.db.tickets.at(-1) ?? null;
  salida('clasico', { r: r3, payload: pend?.payload ?? null, confirmaPorHttp: c3, trasHttp, confirmaEnBandeja: c3b, ticket: t3 && { usuario_email: t3.usuario_email, canal: t3.canal, estado: t3.estado } });

  // ── 4. Un negocio SIN vía libre: el pedido espera la decisión del equipo ──
  base();
  const pedido = { tipo: 'pedido', titulo: 'Quiero exportar los leads a Excel', descripcion: 'Se podría tener un botón para bajar la lista.' };
  const r4 = await runWithWorkspace(3, () => aplicarEnElActo(def('levantar_ticket'), pedido, comoCtx(detallado(3, SIN_REGLA)), { ws: 3, origen: 'api:tk1' }));
  salida('sin-regla', { r: r4, estado: pg.db.tickets.at(-1)?.estado ?? null });

  // ── 5. Listar, ver y contestar ──
  base();
  const hace = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  pg.db.tickets.push(
    { id: 21, created_at: hace(90), updated_at: hace(5), workspace_id: 10, usuario_email: DUENA, usuario_nombre: 'Ana Duarte', tipo: 'bug', titulo: 'El botón no anda', descripcion: 'No pasa nada al tocarlo.', canal: 'api', contexto: {}, estado: 'esperando_cliente', prioridad: 'media', triage: { v: 1, tipo: 'bug', autoArreglo: true, regla: 'Leandro', confianza: 'media', prioridad: 'media', porque: ['Aprobado por regla'] }, respuesta: '¿En qué tarjeta?', despacho: 'runner', ref: null },
    { id: 22, created_at: hace(80), updated_at: hace(60), workspace_id: 10, usuario_email: OTRA, usuario_nombre: 'Beto Cierra', tipo: 'pedido', titulo: 'Otro color', descripcion: 'Que sea azul.', canal: 'chat_app', contexto: {}, estado: 'resuelto', prioridad: 'baja', triage: { v: 1, tipo: 'pedido', autoArreglo: false, confianza: 'media', prioridad: 'baja', porque: ['lo decide Martín'] }, respuesta: 'Listo.', despacho: null, ref: null, resuelto_at: hace(60) },
    { id: 23, created_at: hace(70), updated_at: hace(65), workspace_id: 10, usuario_email: DUENA, usuario_nombre: 'Ana Duarte', tipo: 'bug', titulo: 'MaKo no pudo mover el lead', descripcion: '', canal: 'sistema', contexto: {}, estado: 'esperando_decision', prioridad: 'media', triage: null, respuesta: null, despacho: null, ref: 'np:10:abc' },
    { id: 40, created_at: hace(70), updated_at: hace(65), workspace_id: 3, usuario_email: SIN_REGLA, usuario_nombre: 'Caro Prueba', tipo: 'bug', titulo: 'De otro negocio', descripcion: 'secreto', canal: 'chat_app', contexto: {}, estado: 'nuevo', prioridad: 'media', triage: null, respuesta: null, despacho: null, ref: null },
  );
  pg.db.ticket_eventos.push(
    { id: 1, ticket_id: 21, at: hace(10), actor: 'martin', tipo: 'comentario', texto: '¿En qué tarjeta?', datos: null },
    { id: 2, ticket_id: 21, at: hace(9), actor: 'triage', tipo: 'clasificado', texto: 'NOTA INTERNA DEL TRIAGE', datos: null },
  );
  const lista = leerJson(await runWithWorkspace(10, () => ejecutarOperacion('listar_tickets', {}, comoCtx(detallado(10, DUENA)), 'query')));
  const abiertos = leerJson(await runWithWorkspace(10, () => ejecutarOperacion('listar_tickets', { estado: 'abiertos' }, comoCtx(clasico(10, 'proponer')), 'query')));
  const ver = leerJson(await runWithWorkspace(10, () => ejecutarOperacion('ver_ticket', { numero: '21' }, comoCtx(clasico(10, 'proponer')), 'query')));
  const ajeno = await runWithWorkspace(10, () => ejecutarOperacion('ver_ticket', { numero: 40 }, comoCtx(detallado(10, DUENA)), 'query'));
  const resp = await runWithWorkspace(10, () => aplicarEnElActo(def('responder_ticket'), { numero: 21, texto: 'En la de Instagram del Reel.' }, comoCtx(detallado(10, DUENA)), { ws: 10, origen: 'api:tk1' }));
  const t21 = pg.db.tickets.find((t) => t.id === 21);
  const ev = pg.db.ticket_eventos.filter((e) => e.ticket_id === 21 && e.tipo === 'comentario' && e.actor === 'cliente');
  const cerrado = await runWithWorkspace(10, () => aplicarEnElActo(def('responder_ticket'), { numero: 22, texto: 'Gracias' }, comoCtx(detallado(10, DUENA)), { ws: 10, origen: 'api:tk1' }));
  const deOtro = await runWithWorkspace(10, () => aplicarEnElActo(def('responder_ticket'), { numero: 40, texto: 'hola' }, comoCtx(detallado(10, DUENA)), { ws: 10, origen: 'api:tk1' }));
  salida('leer-y-contestar', {
    lista, abiertos, ver, ajeno, resp, estado21: t21?.estado, comentario: ev.at(-1) ?? null, cerrado, deOtro,
    eventos40: pg.db.ticket_eventos.filter((e) => e.ticket_id === 40).length,
  });
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
