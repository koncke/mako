// =============================================================================
// Hijo de tests/tickets-al-cerebro.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La vuelta REAL del cartero del lado del servidor (`cicloCartero` y `hayParaElCartero`, lib/operaciones.ts: las llama
// app/api/operaciones/cartero/route.ts) y el cierre REAL del cron (`cerrarLosDesplegados`, lib/tickets-cierre.ts), sobre un
// PostgREST de mentira con la Ticketera de la noche del 29/10/2026: tickets esperando a Martín que no le llegaban nunca al
// Cerebro, y el #15 (Video Editor de Leila) que no se cerró aunque su arreglo se desplegó con `tickets: [15]`.
// `after` (next/server) necesita un request: la vuelta corre adentro de un `workAsyncStorage` de mentira que sólo anota lo
// diferido (el Plan de los chats, que no es de este test).
// Escribe una línea `@@TICKETS@@<json>` por escena.
// =============================================================================

import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

// Next arma su AsyncLocalStorage con el global que pone su servidor: sin él, cargar `next/server` tira «Invariant:
// AsyncLocalStorage accessed in runtime where it is not available». Antes de cargar lib/operaciones (los import de abajo son dinámicos).
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const TOKEN = `mkop_${'t'.repeat(40)}`;
const CUENTA = 'claude3';
const CEREBRO = 'local_11111111-2222-4333-8444-555555555555';
const CRM = 'local_22222222-2222-4333-8444-555555555555';
const CHATS = [
  { local: CEREBRO, titulo: 'Cerebro', vivo: true, runner: true },
  { local: CRM, titulo: 'CRM', vivo: true, runner: true },
];

let n = 1000;
const pg = crearPostgrest({
  tablas: ['operaciones_token', 'operaciones_carteros', 'operaciones_pedidos', 'admin_decisiones', 'tickets', 'ticket_eventos'],
  defaults: (t, f) => ({ id: ++n, ...(t === 'ticket_eventos' ? { at: new Date().toISOString() } : {}), ...f }),
  orCompleto: true,
});

/** Sin la migración de `cerebro_*`: la base contesta como Postgres a cualquier pedido que nombre una de esas columnas. */
let sinMigracion = false;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host !== 'supa.test') return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
  if (sinMigracion && u.pathname.endsWith('/tickets') && /cerebro_/.test(decodeURIComponent(u.search) + String(init.body ?? ''))) {
    return new Response(JSON.stringify({ code: '42703', message: 'column tickets.cerebro_estado does not exist', details: null, hint: null }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  return pg.responder(u, init);
}) as typeof fetch;

const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
/** Un ticket como lo deja `crearTicket` (lib/tickets-db.ts) y, con la migración, su marca `cerebro_*` en 'pendiente'. */
const ticket = (id: number, estado: string, despacho: string | null, extra: Fila = {}): Fila => ({
  id, created_at: hace(100 - id % 100), updated_at: hace(100 - id % 100), workspace_id: 11, titulo: `ticket ${id}`, estado, despacho,
  respuesta: null, duplicado_de: null, triage: { v: 1, tipo: 'pedido', autoArreglo: despacho === 'runner', confianza: 'media', porque: [] },
  aviso_id: null, aviso_estado: null, aviso_at: null, aviso_intentos: 0, aviso_motivo: null,
  cerebro_id: null, cerebro_estado: 'pendiente', cerebro_at: null, cerebro_intentos: 0, cerebro_motivo: null,
  ...extra,
});

function base(version: string): void {
  pg.vaciar();
  pg.db.operaciones_token.push({ id: 1, token_hash: createHash('sha256').update(TOKEN).digest('hex') });
  pg.db.operaciones_carteros.push({ cuenta: CUENTA, version, chats: CHATS, visto_at: hace(1) });
  pg.db.tickets.push(
    ticket(31, 'esperando_decision', null),          // los de esa noche: esperan a Martín y no le llegaban
    ticket(32, 'en_curso', 'runner'),                // un bug del triage: su camino de siempre (`aviso_*`)
    ticket(33, 'resuelto', null),                    // cerrado: nada
    ticket(34, 'esperando_decision', null, { cerebro_estado: 'entregado', cerebro_intentos: 1 }), // ya le llegó
    ticket(35, 'en_curso', 'firmado'),               // Martín lo aprobó: le llegó con su firma
    ticket(36, 'esperando_cliente', null),           // ya lo decidió alguien: se le preguntó al cliente
    ticket(37, 'nuevo', null),
  );
}

const diferidos: unknown[] = [];
/** La vuelta como la corre la ruta: dentro de un request (para `after`). */
async function vuelta(version: string, extra: Record<string, unknown> = {}) {
  const { cicloCartero } = await import('../lib/operaciones');
  const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
  const store = { afterContext: { after: (t: unknown) => { diferidos.push(t); } } };
  return workAsyncStorage.run(store as never, () => cicloCartero(TOKEN, { cuenta: CUENTA, version, chats: CHATS, entregables: [CEREBRO, CRM], ...extra }));
}
const fila = (id: number) => pg.db.tickets.find((t) => Number(t.id) === id)!;
const marca = (id: number) => { const f = fila(id); return { estado: f.estado, despacho: f.despacho, cerebro: f.cerebro_estado, intentos: f.cerebro_intentos, aviso: f.aviso_estado }; };
const out = (escena: string, datos: Record<string, unknown>) => console.log(`@@TICKETS@@${JSON.stringify({ escena, ...datos })}`);

async function main() {
  const { hayParaElCartero } = await import('../lib/operaciones');
  const { cerrarLosDesplegados } = await import('../lib/tickets-cierre');
  const escenas = (process.env.ESCENAS ?? '').split(',').filter(Boolean);
  const corre = (e: string) => !escenas.length || escenas.includes(e);

  // (1) La vuelta de un cartero que los entiende: los nuevos van APARTE, con su marca, y los del triage como siempre.
  if (corre('entrega')) {
    base('1.23.0');
    const hayAntes = await hayParaElCartero([CUENTA], []);
    const s = await vuelta('1.23.0');
    const hayDespues = await hayParaElCartero([CUENTA], []);
    const marcas = Object.fromEntries([31, 32, 33, 34, 35, 36, 37].map((id) => [id, marca(id)]));
    // (2) El acuse: uno llegó, el otro no (se reintenta en la misma vuelta, con un intento más).
    const [a31, a37] = [s!.ticketsNuevos.find((t) => t.numero === 31)!, s!.ticketsNuevos.find((t) => t.numero === 37)!];
    const s2 = await vuelta('1.23.0', { acuses: [{ id: a31.id, estado: 'entregado' }, { id: a37.id, estado: 'no_entregado', motivo: 'El Cerebro se cerró antes de avisarle' }] });
    out('entrega', {
      hayAntes, hayDespues,
      nuevos: s!.ticketsNuevos, tickets: s!.tickets.map((t) => t.numero), error: s!.ticketsNuevosError,
      marcas,
      triage31: fila(31).triage, acuses2: s2!.acuses, nuevos2: s2!.ticketsNuevos.map((t) => t.numero),
      marcas2: { 31: marca(31), 37: marca(37) },
      eventos: pg.db.ticket_eventos.map((e) => ({ ticket: e.ticket_id, tipo: e.tipo, texto: e.texto })),
    });
  }

  // (3) Un cartero de antes (1.22.1) no los recibe, y la marca no se toca: si los reclamara, se quemarían los intentos.
  if (corre('viejo')) {
    base('1.22.1');
    const hay = await hayParaElCartero([CUENTA], []);
    const s = await vuelta('1.22.1');
    out('viejo', { hay, nuevos: s!.ticketsNuevos, tickets: s!.tickets.map((t) => t.numero), marca31: marca(31) });
  }

  // (4) Sin la migración: la vuelta no se cae, los del triage salen igual y el error viaja para que el cartero lo diga.
  if (corre('sin-migracion')) {
    base('1.23.0');
    sinMigracion = true;
    try {
      const hay = await hayParaElCartero([CUENTA], []).catch((e: unknown) => `tiró: ${e instanceof Error ? e.message : e}`);
      const s = await vuelta('1.23.0', { acuses: [{ id: '0b9c2a9e-1111-4222-8333-444455556666', estado: 'entregado' }] });
      out('sin-migracion', { hay, nuevos: s!.ticketsNuevos, tickets: s!.tickets.map((t) => t.numero), error: s!.ticketsNuevosError, ticketsError: s!.ticketsError, acuses: s!.acuses });
    } finally { sinMigracion = false; }
  }

  // (5) El cierre del cron: el deploy trae el hito con `tickets: [n]` y se cierra lo que esté ABIERTO, espere a quien espere.
  if (corre('cierre')) {
    pg.vaciar();
    pg.db.tickets.push(
      ticket(15, 'esperando_decision', null), ticket(42, 'en_curso', 'runner'), ticket(43, 'esperando_cliente', null),
      ticket(44, 'rechazado', null), ticket(45, 'nuevo', null), ticket(46, 'arreglado', 'firmado'), ticket(47, 'duplicado', null),
    );
    const hito = { area: 'video-editor', titulo: 'El Video Editor guarda el proyecto' };
    const cerrados = await cerrarLosDesplegados(new Map([15, 42, 43, 44, 45, 46, 47].map((id) => [id, hito])));
    out('cierre', {
      cerrados: cerrados.sort((a, b) => a - b),
      estados: Object.fromEntries([15, 42, 43, 44, 45, 46, 47].map((id) => [id, { estado: fila(id).estado, avisado: fila(id).avisado_at ?? null, respuesta: fila(id).respuesta }])),
    });
  }
  out('fin', { sinMock: [...pg.sinMock] });
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
