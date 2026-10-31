// =============================================================================
// Hijo de tests/limbo-al-cerebro.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La vuelta REAL del cartero del lado del servidor (`cicloCartero`, `leerCarteros`, `hayParaElCartero`, lib/operaciones.ts) sobre un
// PostgREST de mentira: una vuelta del servicio contra una de Runner, sin la mig 0355, y lo que le ofrece al Runner del Cerebro.
// Escribe una línea `@@LIMBO@@<json>` por escena. Los datos son inventados.
// =============================================================================

import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const TOKEN = `mkop_${'t'.repeat(40)}`;
const CUENTA = 'claude3';
const CEREBRO = 'local_11111111-2222-4333-8444-555555555555';
const CRM = 'local_22222222-2222-4333-8444-555555555555';
const CERRADO = 'local_33333333-2222-4333-8444-555555555555';
const CHATS = [
  { local: CEREBRO, titulo: 'Cerebro', vivo: true, runner: true },
  { local: CRM, titulo: 'CRM', vivo: true, runner: true },
  { local: CERRADO, titulo: 'Offer', vivo: false },
];
const uuid = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
const TEXTO = 'Texto del pedido que no tiene que viajar';
const TITULO = 'Título que no tiene que viajar';

const pg = crearPostgrest({
  tablas: ['operaciones_token', 'operaciones_carteros', 'operaciones_pedidos', 'admin_decisiones', 'tickets', 'ticket_eventos', 'centro_turnos'],
  orCompleto: true,
  // Con la migración, una fila nueva trae las dos columnas en null: Postgres las devuelve aunque nadie las haya escrito.
  defaults: (t, f) => (t === 'operaciones_carteros' ? { runner_visto_at: null, servicio: null, ...f } : f),
});

/** Sin la mig 0355: la base contesta como Postgres (al leer) y como PostgREST (al escribir) a lo que nombre esas columnas. */
let sinMigracion = false;
/** La lectura de los chats de las cuentas falla: sólo la pide el cálculo del limbo en estas escenas. */
let falla = false;
const lecturas: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host !== 'supa.test') return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
  const pedido = decodeURIComponent(u.search) + String(init.body ?? '');
  if (u.pathname.endsWith('/operaciones_pedidos')) lecturas.push(u.searchParams.get('select') ?? '');
  if (sinMigracion && u.pathname.endsWith('/operaciones_carteros') && /runner_visto_at|servicio/.test(pedido)) {
    const escribe = (init.method ?? 'GET').toUpperCase() !== 'GET';
    return new Response(JSON.stringify(escribe
      ? { code: 'PGRST204', message: "Could not find the 'runner_visto_at' column of 'operaciones_carteros' in the schema cache", details: null, hint: null }
      : { code: '42703', message: 'column operaciones_carteros.runner_visto_at does not exist', details: null, hint: null }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  if (falla && u.pathname.endsWith('/operaciones_carteros') && u.searchParams.get('select') === 'cuenta,visto_at,chats') {
    return new Response(JSON.stringify({ code: 'XX000', message: 'la base no contesta', details: null, hint: null }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
  return pg.responder(u, init);
}) as typeof fetch;

const VIEJO = new Date(Date.now() - 3 * 86_400_000).toISOString();
const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const DIA = 24 * 60;
const pedido = (n: number, min: number, destino: string, extra: Fila = {}): Fila => ({
  id: uuid(n), created_at: hace(min), updated_at: hace(min), autor: 'martin', destino, destino_cuenta: 'claude2', destino_titulo: TITULO,
  texto: TEXTO, firmado: '{}', firma: 'x', clave_id: 'k', estado: 'escrito', motivo: null, tomado_at: null, entregado_at: null, cerrado_at: null, cierre: null,
  ...extra,
});

function base(fila: Fila = {}): void {
  pg.vaciar();
  lecturas.length = 0;
  pg.db.operaciones_token.push({ id: 1, token_hash: createHash('sha256').update(TOKEN).digest('hex') });
  pg.db.operaciones_carteros.push({ cuenta: CUENTA, version: '1.24.0', chats: CHATS, claves: [], visto_at: VIEJO, runner_visto_at: VIEJO, servicio: null, ...fila });
}

async function vuelta(version: string, extra: Record<string, unknown> = {}) {
  const { cicloCartero } = await import('../lib/operaciones');
  const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
  const store = { afterContext: { after: () => {} } };
  return workAsyncStorage.run(store as never, () => cicloCartero(TOKEN, { cuenta: CUENTA, version, chats: CHATS, entregables: [CEREBRO, CRM], ...extra }));
}
const out = (escena: string, datos: Record<string, unknown>) => console.log(`@@LIMBO@@${JSON.stringify({ escena, ...datos })}`);
const fila = () => pg.db.operaciones_carteros[0];
const SERVICIO = { servicio: { version: '1.26.0', desde: hace(30) }, entregables: [], abre: [] };

async function main() {
  const { hayParaElCartero, leerCarteros } = await import('../lib/operaciones');
  const { carteroVivo } = await import('../lib/operaciones-reglas');
  const { estadoDeLaPc } = await import('../lib/centro-chats');
  const escenas = (process.env.ESCENAS ?? '').split(',').filter(Boolean);
  const corre = (e: string) => !escenas.length || escenas.includes(e);
  const vista = async () => {
    const { carteros } = await leerCarteros();
    const k = carteros[0];
    return { vistoAt: k.vistoAt, noticiasAt: k.noticiasAt, servicio: k.servicio, version: k.version, vivo: carteroVivo(k, Date.now()), cartel: estadoDeLaPc(carteros, pg.db.operaciones_pedidos as never, Date.now())?.tipo ?? null };
  };

  // (1) Una vuelta del servicio: dice que la PC está, y nada más. Aunque traiga una lista, no reclama.
  if (corre('servicio')) {
    base();
    pg.db.operaciones_pedidos.push(pedido(1, 60, CRM), pedido(2, 60, 'nuevo', { destino_cuenta: CUENTA }));
    const s = await vuelta('1.26.0', { ...SERVICIO, entregables: [CEREBRO, CRM], abre: [CUENTA] });
    const f = { ...fila() };
    const v = await vista();
    const hay = await hayParaElCartero([CUENTA], []);
    out('servicio', { salida: { pedidos: s!.pedidos, avisos: s!.avisos, limbo: s!.limbo, tickets: s!.tickets, ticketsNuevos: s!.ticketsNuevos }, version: f.version, runnerVisto: f.runner_visto_at, visto: f.visto_at, viejo: VIEJO, servicio: f.servicio, chats: f.chats, vista: v, hay, estados: pg.db.operaciones_pedidos.map((p) => p.estado) });
  }

  // (2) Una vuelta de Runner, después: sí dice que hay quien entregue.
  if (corre('runner')) {
    base({ servicio: { version: '1.26.0', desde: hace(30), visto_at: hace(1) } });
    const s = await vuelta('1.26.0');
    const f = { ...fila() };
    out('runner', { version: f.version, runnerVisto: f.runner_visto_at, visto: f.visto_at, viejo: VIEJO, servicio: f.servicio, vista: await vista(), error: s!.limboError });
  }

  // (3) La primera vuelta de una cuenta que no tiene fila, del servicio: «hay noticias», no «hubo un Runner».
  if (corre('fila-nueva')) {
    base();
    pg.db.operaciones_carteros.length = 0;
    await vuelta('1.26.0', SERVICIO);
    out('fila-nueva', { vista: await vista(), runnerVisto: fila().runner_visto_at ?? null });
  }

  // (4) Sin la mig 0355: la vuelta y la lectura no se caen, y el servicio igual no pisa la versión.
  if (corre('sin-migracion')) {
    base();
    delete pg.db.operaciones_carteros[0].runner_visto_at;
    delete pg.db.operaciones_carteros[0].servicio;
    sinMigracion = true;
    try {
      await vuelta('1.26.0', SERVICIO);
      const servicio = { version: fila().version, visto: fila().visto_at, columnas: Object.keys(fila()).filter((c) => /runner_visto_at|servicio/.test(c)), vista: await vista() };
      await vuelta('1.26.0');
      out('sin-migracion', { servicio, viejo: VIEJO, runner: { version: fila().version, visto: fila().visto_at, columnas: Object.keys(fila()).filter((c) => /runner_visto_at|servicio/.test(c)), vista: await vista() } });
    } finally { sinMigracion = false; }
  }

  // (5) Lo que MaKo le ofrece al Runner con el Cerebro abierto.
  const elLimbo = () => {
    pg.db.operaciones_pedidos.push(
      pedido(1, DIA, CERRADO),                                                       // a un chat cerrado, de ayer
      pedido(2, DIA, CRM),                                                           // a un chat vivo
      pedido(3, DIA, 'nuevo', { destino_cuenta: 'claude9' }),                        // un chat nuevo: no es de nadie todavía
      pedido(4, 5, CERRADO),                                                         // recién mandado: lo normal es que la PC no haya dado la vuelta
      pedido(5, 13 * DIA, CERRADO),                                                  // le faltan 2 días para vencer
      pedido(6, 16 * DIA, CERRADO),                                                  // ya venció: esta vuelta lo pasa a no_entregado
      pedido(7, DIA, CERRADO, { estado: 'tomado', tomado_at: hace(1) }),             // ya lo tiene la PC
      pedido(8, DIA, CERRADO, { destino_cuenta: null }),                             // sin cuenta en el firmado
      pedido(9, DIA, 'local_44444444-2222-4333-8444-555555555555', { destino_cuenta: 'otra cosa' }), // un chat que no figura en ningún cartero
    );
  };
  if (corre('limbo')) {
    base();
    elLimbo();
    const hay = await hayParaElCartero([CUENTA], []);
    const s = await vuelta('1.26.0');
    out('limbo', { hay, limbo: s!.limbo, error: s!.limboError, pedidos: s!.pedidos.map((p) => p.id), lecturas: [...new Set(lecturas)], estado6: pg.db.operaciones_pedidos.find((p) => p.id === uuid(6))!.estado });
  }

  // (6) Quién no lo recibe: un Runner de antes, sin Cerebro, un Cerebro que no alcanza, y el servicio.
  if (corre('nadie')) {
    const chatsSin = CHATS.filter((c) => c.titulo !== 'Cerebro');
    const casos: Array<[string, () => ReturnType<typeof vuelta>]> = [
      ['viejo', () => vuelta('1.25.0')],
      ['sin-cerebro', () => vuelta('1.26.0', { chats: chatsSin, entregables: [CRM] })],
      ['no-lo-alcanza', () => vuelta('1.26.0', { entregables: [CRM] })],
      ['cerebro-cerrado', () => vuelta('1.26.0', { chats: CHATS.map((c) => (c.local === CEREBRO ? { ...c, vivo: false } : c)), entregables: [CRM] })],
      ['servicio', () => vuelta('1.26.0', SERVICIO)],
    ];
    const r: Record<string, unknown> = {};
    for (const [nombre, correr] of casos) {
      base();
      elLimbo();
      const s = await correr();
      r[nombre] = s!.limbo;
    }
    out('nadie', r);
  }

  // (7) Si el cálculo falla, lo demás sale igual y el error viaja.
  if (corre('falla')) {
    base();
    elLimbo();
    falla = true;
    try {
      const s = await vuelta('1.26.0');
      out('falla', { limbo: s!.limbo, error: s!.limboError, pedidos: s!.pedidos.map((p) => p.id) });
    } finally { falla = false; }
  }
  out('fin', { sinMock: [...pg.sinMock] });
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
