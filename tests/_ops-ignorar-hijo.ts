// =============================================================================
// Hijo de tests/ops-center-ignorar.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Lo REAL del servidor sobre un PostgREST de mentira: la vuelta del Runner (`cicloCartero`, lib/operaciones.ts) con una respuesta
// firmada de una pregunta IGNORADA en la cola, «Ignorar» y «Volver a mostrar» (lib/centro-preguntas-chat-db.ts), y la respuesta que
// se cancela al ignorar (`cancelarRespuestasDe`). Escribe una línea `@@IGNORAR@@<json>` por escena. Los datos son inventados.
// =============================================================================

import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { crearPostgrest, type Fila } from './_postgrest-de-mentira';
import { textoDeRespuesta, type PreguntaChat } from '../lib/centro-preguntas-chat';

(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const TOKEN = `mkop_${'t'.repeat(40)}`;
const CUENTA = 'claude3';
const PLATAFORMA = 9;
const CRM = 'local_22222222-2222-4333-8444-555555555555';
const CHATS = [{ local: CRM, titulo: 'CRM', vivo: true, runner: true }];
const uuid = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
const pregunta = (id: string, extra: Partial<PreguntaChat> = {}): PreguntaChat => ({
  id, local: CRM, pregunta: `¿Reviso la ${id.slice(-1)}?`, contexto: null,
  opciones: [{ titulo: 'Sí', detalle: null }, { titulo: 'No', detalle: null }], recomendada: 0, varias: false,
  at: '2026-10-30T12:00:00.000Z', respuesta: null, ...extra,
});
const IGNORADA = pregunta('bbbbbbbb-0000-4000-8000-000000000001', { ignorada: '2026-11-05T10:00:00.000Z' });
const ABIERTA = pregunta('bbbbbbbb-0000-4000-8000-000000000002');

const pg = crearPostgrest({
  tablas: ['operaciones_token', 'operaciones_carteros', 'operaciones_pedidos', 'admin_decisiones', 'tickets', 'ticket_eventos', 'centro_turnos', 'app_settings', 'workspaces'],
  orCompleto: true,
  defaults: (t, f) => (t === 'operaciones_carteros' ? { runner_visto_at: null, servicio: null, ...f } : f),
});

/** Las preguntas no se pueden leer (la base no contesta a `app_settings`). */
let fallaSettings = false;
/** La base sin la mig 0394: PostgREST contesta PGRST204 a una escritura que nombra `ignorada_at`. */
let sinColumna = false;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host !== 'supa.test') return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
  if (fallaSettings && u.pathname.endsWith('/app_settings')) {
    return new Response(JSON.stringify({ code: 'XX000', message: 'la base no contesta', details: null, hint: null }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
  if (sinColumna && u.pathname.endsWith('/admin_decisiones') && (init.method ?? 'GET').toUpperCase() !== 'GET' && /ignorada_at/.test(String(init.body ?? ''))) {
    return new Response(JSON.stringify({ code: 'PGRST204', message: "Could not find the 'ignorada_at' column of 'admin_decisiones' in the schema cache", details: null, hint: null }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  return pg.responder(u, init);
}) as typeof fetch;

const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const pedido = (n: number, min: number, texto: string): Fila => ({
  id: uuid(n), created_at: hace(min), updated_at: hace(min), autor: 'martin', destino: CRM, destino_cuenta: CUENTA, destino_titulo: 'CRM',
  texto, firmado: '{}', firma: 'x', clave_id: 'k', estado: 'escrito', motivo: null, tomado_at: null, entregado_at: null, cerrado_at: null, cierre: null,
});

function base(): void {
  pg.vaciar();
  fallaSettings = false;
  pg.db.workspaces.push({ id: PLATAFORMA, nombre: 'MaKo', slug: 'mako', estado: 'activo', capa: 'superadmin' });
  pg.db.operaciones_token.push({ id: 1, token_hash: createHash('sha256').update(TOKEN).digest('hex') });
  pg.db.operaciones_carteros.push({ cuenta: CUENTA, version: '1.26.1', chats: CHATS, claves: [], visto_at: hace(1), runner_visto_at: hace(1), servicio: null });
  pg.db.app_settings.push({ workspace_id: PLATAFORMA, key: `operaciones.preguntas.${CRM}`, value: JSON.stringify([IGNORADA, ABIERTA]) });
  // En el orden de la cola: la respuesta de la ignorada (la más vieja), la de la abierta, y un mensaje común.
  pg.db.operaciones_pedidos.push(
    pedido(1, 30, textoDeRespuesta(IGNORADA, [0], null)),
    pedido(2, 20, textoDeRespuesta(ABIERTA, [1], null)),
    pedido(3, 10, 'Sigue con el filtro del CRM'),
  );
}

async function vuelta() {
  const { cicloCartero } = await import('../lib/operaciones');
  const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
  const store = { afterContext: { after: () => {} } };
  return workAsyncStorage.run(store as never, () => cicloCartero(TOKEN, { cuenta: CUENTA, version: '1.26.1', chats: CHATS, entregables: [CRM] }));
}
const estado = (n: number) => { const f = pg.db.operaciones_pedidos.find((p) => p.id === uuid(n))!; return { estado: f.estado, motivo: f.motivo }; };
const out = (escena: string, datos: unknown) => process.stdout.write(`@@IGNORAR@@${JSON.stringify({ escena, ...(datos as object) })}\n`);
const guardadas = (): PreguntaChat[] => JSON.parse(String(pg.db.app_settings.find((f) => f.key === `operaciones.preguntas.${CRM}`)?.value ?? '[]'));
const abiertas = (): unknown => JSON.parse(String(pg.db.app_settings.find((f) => f.key === 'operaciones.preguntas-abiertas')?.value ?? '{}'));

async function main() {
  // 1. La vuelta del Runner: la respuesta de la ignorada NO sale (se cancela con su motivo); las otras dos, sí, en su orden.
  base();
  const s1 = await vuelta();
  out('vuelta', { entregados: s1!.pedidos.map((p) => p.id), p1: estado(1), p2: estado(2), p3: estado(3) });

  // 2. Sin poder leer las preguntas: la respuesta de la ignorada NO sale (tampoco la de la abierta: no se sabe), el mensaje común sí.
  base();
  fallaSettings = true;
  const s2 = await vuelta();
  out('sin-leer', { entregados: s2!.pedidos.map((p) => p.id), p1: estado(1), p2: estado(2), p3: estado(3) });

  // 3. «Ignorar» de verdad (la db) sobre la abierta, y su respuesta que esperaba se cancela; después «Volver a mostrar».
  base();
  const { ignorarPregunta } = await import('../lib/centro-preguntas-chat-db');
  const { cancelarRespuestasDe } = await import('../lib/operaciones');
  pg.db.app_settings.push({ workspace_id: PLATAFORMA, key: 'operaciones.preguntas-abiertas', value: JSON.stringify({ [CRM]: 1 }) });
  const ig = await ignorarPregunta(CRM, ABIERTA.id, true);
  const canceladas = await cancelarRespuestasDe(CRM, ABIERTA.id);
  const trasIgnorar = { ok: ig.ok, ignorada: guardadas().find((p) => p.id === ABIERTA.id)?.ignorada ?? null, abiertas: abiertas(), canceladas, p1: estado(1), p2: estado(2), p3: estado(3) };
  // Contestada en otro dispositivo con la pantalla vieja: no se marca (su respuesta no se entrega).
  const { marcarContestada } = await import('../lib/centro-preguntas-chat-db');
  const marcar = await marcarContestada(CRM, ABIERTA.id, { elegidas: [1], otra: null, at: new Date().toISOString(), trabajo: uuid(2) });
  const otraVez = await ignorarPregunta(CRM, ABIERTA.id, true);
  const vuelve = await ignorarPregunta(CRM, ABIERTA.id, false);
  out('ignorar', {
    ...trasIgnorar, otraVez: otraVez.ok ? null : otraVez.error,
    marcar: marcar.ok ? 'marcada' : { error: marcar.error, ignorada: marcar.ignorada ?? false }, respuestaGuardada: guardadas().find((p) => p.id === ABIERTA.id)?.respuesta ?? null,
    vuelve: vuelve.ok, trasVolver: guardadas().find((p) => p.id === ABIERTA.id)?.ignorada ?? null, abiertasTrasVolver: abiertas(),
  });

  // 4. Una decisión de la Ticketera (mig 0394): ignorarla no la contesta, ignorada no se contesta, y vuelta se contesta como siempre.
  base();
  const { ignorarDecision, guardarRespuesta } = await import('../lib/admin-decisiones');
  const fila = (id: number, extra: Fila = {}): Fila => ({
    id, ref: `d-${id}`, chat: 'CRM', destino: CRM, pregunta: `¿Decisión ${id}?`, opciones: [{ clave: 'A', texto: 'Sí' }, { clave: 'B', texto: 'No' }],
    urgencia: 'criterio', orden: 1, respuesta: null, respuesta_texto: null, respondida_at: null, recogida_at: null, archivada_at: null,
    ignorada_at: null, creada_at: '2026-10-30T12:00:00.000Z', ...extra,
  });
  pg.db.admin_decisiones.push(fila(1), fila(2, { respuesta: 'A', respondida_at: '2026-11-01T10:00:00.000Z' }));
  const d1 = await ignorarDecision(1, true);
  const marcada = pg.db.admin_decisiones.find((f) => f.id === 1)!;
  const ignoradaAt = typeof marcada.ignorada_at === 'string';
  const contestarIgnorada = await guardarRespuesta(1, 'A', '');
  const respuestaTrasIntento = marcada.respuesta ?? null;
  const dosVeces = await ignorarDecision(1, true);
  const contestada = await ignorarDecision(2, true);
  const volver = await ignorarDecision(1, false);
  const contestarVuelta = await guardarRespuesta(1, 'B', '');
  out('decision', {
    ignorar: d1.ok, ignoradaAt,
    contestarIgnorada: contestarIgnorada.ok ? null : contestarIgnorada.error, respuestaTrasIntento,
    dosVeces: dosVeces.ok ? null : dosVeces.error, contestada: contestada.ok ? null : contestada.error,
    volver: volver.ok, trasVolver: pg.db.admin_decisiones.find((f) => f.id === 1)!.ignorada_at ?? null,
    contestarVuelta: contestarVuelta.ok, respuestaFinal: pg.db.admin_decisiones.find((f) => f.id === 1)!.respuesta ?? null,
  });

  // 5. Sin la mig 0394: PostgREST no conoce la columna. Lo dice, y no cambia nada.
  base();
  pg.db.admin_decisiones.push(fila(1));
  sinColumna = true;
  const sin = await ignorarDecision(1, true);
  sinColumna = false;
  out('sin-migracion', { ok: sin.ok, error: sin.ok ? null : sin.error, respuesta: pg.db.admin_decisiones.find((f) => f.id === 1)!.respuesta ?? null });
}

main().then(() => process.exit(0), (e) => { process.stderr.write(String(e?.stack ?? e)); process.exit(1); });
