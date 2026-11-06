// =============================================================================
// El lector del primer contacto (lib/primer-contacto-server.ts), EJECUTADO contra una base de mentira
// =============================================================================
// Lo que cada canal aporta y quién lo mandó: WhatsApp con su marca (y sin la columna de la 0396, todo «No se sabe»), email por su
// `autor`, Instagram/Messenger y las llamadas como una persona; lo que falló, un evento o una llamada de prueba no cuenta; una
// tabla que todavía no existe no tumba la lectura. `server-only`, la base y el canal social se reemplazan con Module._load.
// Probado rompiéndolo (5/11/2026, base 4/0):
//   · leer la marca de WhatsApp como «persona» siempre (`automatico: false`)   → 2/2 (el 1 y el 2);
//   · tirar cuando falta la columna `automatico` en vez de releer sin ella    → 3/1 (el 2);
//   · contar las llamadas de prueba                                           → 3/1 (el 3);
//   · tirar cuando falta la tabla de las llamadas grabadas                    → 3/1 (el 4).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';

type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
type Fila = Record<string, unknown>;

const DATOS: Record<string, Fila[]> = {};
const faltaTabla = new Set<string>();
let faltaColumna = false;

/** `leerTodo` de mentira: aplica los filtros `.in` y `.eq` que arma el lector, y falla como PostgREST si falta algo. */
async function leerTodo(_db: unknown, tabla: string, cols: string, opts: { filtros?: (q: unknown) => unknown } = {}): Promise<Fila[]> {
  if (faltaTabla.has(tabla)) throw new Error(`Error leyendo ${tabla} (página 1): relation "public.${tabla}" does not exist`);
  if (tabla === 'wa_mensajes' && faltaColumna && cols.includes('automatico')) throw new Error('Error leyendo wa_mensajes (página 1): column wa_mensajes.automatico does not exist');
  const filtros: Array<[string, string, unknown]> = [];
  const q = { in(c: string, v: unknown) { filtros.push(['in', c, v]); return q; }, eq(c: string, v: unknown) { filtros.push(['eq', c, v]); return q; } };
  opts.filtros?.(q);
  const pedidas = cols.split(',').map((c) => c.trim());
  return (DATOS[tabla] ?? [])
    .filter((r) => filtros.every(([op, c, v]) => (op === 'in' ? (v as unknown[]).includes(r[c]) : r[c] === v)))
    // Como PostgREST: sólo las columnas del `select`.
    .map((r) => Object.fromEntries(pedidas.filter((c) => c in r).map((c) => [c, r[c]])));
}

const STUBS: Record<string, unknown> = {
  'server-only': {},
  './workspace': { getTenantDb: async () => ({}) },
  './supabase-paginado': { leerTodo },
  './canal-zernio': {
    salientesSocialesDeLeads: async (ids: number[]) => new Map(ids.includes(3) ? [[3, [{ t: Date.parse('2026-11-03T16:00:00Z'), canal: 'instagram' as const }]]] : []),
  },
};

const M = Module as unknown as { _load: Cargador };
const original = M._load;
const conStubs = ((pedido: string, padre: unknown, esMain: boolean) => {
  const archivo = String((padre as { filename?: string } | null)?.filename ?? '').replace(/\\/g, '/');
  if (archivo.endsWith('/lib/primer-contacto-server.ts') && pedido in STUBS) return STUBS[pedido];
  return Reflect.apply(original, Module, [pedido, padre, esMain]);
}) as Cargador;
let cargado: Promise<typeof import('../lib/primer-contacto-server')> | null = null;
const lector = () => (cargado ??= (async () => {
  M._load = conStubs;
  try { return await import('../lib/primer-contacto-server'); } finally { M._load = original; }
})());

const ENTRO = '2026-11-03T15:00:00Z';
const lead = (id: number, origen: string | null = 'instant_form') => ({ id, nombre: `Lead ${id}`, entro: ENTRO, origen, setter: null, funnelId: null });
const t = (min: number) => new Date(Date.parse(ENTRO) + min * 60_000).toISOString();
const wa = (lead_id: number, min: number, automatico: boolean | null, extra: Fila = {}) => ({ id: Math.random(), lead_id, from_me: true, wa_timestamp: t(min), created_at: t(min), tipo: 'text', status: 'sent', automatico, ...extra });

function sembrar() {
  for (const k of Object.keys(DATOS)) delete DATOS[k];
  faltaTabla.clear();
  faltaColumna = false;
  DATOS.wa_mensajes = [
    wa(1, 1, true), wa(1, 45, false), // lead 1: la bienvenida automática al minuto, una persona a los 45
    wa(2, 2, false, { status: 'failed' }), wa(2, 3, false, { tipo: 'evento' }), // lead 2: nada cuenta
    wa(9, 5, false), // de otro lead que no se pidió
    wa(6, 7, false, { from_me: false }), // lo que escribió el lead 6: no es un saliente
  ];
  DATOS.email_mensajes = [
    { id: 1, lead_id: 2, created_at: t(10), autor: null, estado: 'ok', direccion: 'saliente' }, // automático
    { id: 2, lead_id: 2, created_at: t(20), autor: 'ana@negocio.test', estado: 'fallido', direccion: 'saliente' }, // no salió
    { id: 3, lead_id: 2, created_at: t(90), autor: 'ana@negocio.test', estado: 'ok', direccion: 'saliente' }, // una persona, a la hora y media
  ];
  DATOS.llamadas_grabadas = [{ id: 'g1', lead_id: 4, created_at: t(200) }];
  DATOS.closing_analyses = [
    { recording_id: 1, lead_id: 5, started_at: t(30), call_date: '2026-11-03', category: 'test' }, // de prueba (y antes): no cuenta
    { recording_id: 2, lead_id: 5, started_at: t(300), call_date: '2026-11-03', category: 'venta' },
  ];
}

test('1 · cada canal con quién lo mandó: la automática no cuenta, la persona sí; lo que falló o es un evento, no', async () => {
  const { primerContactoDeLeads } = await lector();
  sembrar();
  const r = await primerContactoDeLeads([lead(1), lead(2), lead(3), lead(6)], new Date(t(5 * 24 * 60)));
  const de = (id: number) => r.find((x) => x.id === id)!.pc;
  assert.deepEqual([de(1).estado, de(1).minutos, de(1).canal, de(1).automaticoMinutos], ['contactado', 45, 'whatsapp', 1]);
  assert.deepEqual([de(2).estado, de(2).minutos, de(2).canal, de(2).automaticoMinutos], ['contactado', 90, 'email', 10]);
  assert.deepEqual([de(3).estado, de(3).minutos, de(3).canal], ['contactado', 60, 'instagram']);
  assert.equal(de(6).estado, 'sin_contactar');
});

test('2 · sin la migración 0396 (no existe la columna): se relee sin ella y los WhatsApp quedan «No se sabe», sin tirar', async () => {
  const { primerContactoDeLeads } = await lector();
  sembrar();
  faltaColumna = true;
  const [x] = await primerContactoDeLeads([lead(1)], new Date(t(5 * 24 * 60)));
  assert.equal(x.pc.estado, 'no_se_sabe');
});

test('3 · las llamadas: la grabada y la reunión del grabador cuentan como una persona; la de prueba, no', async () => {
  const { primerContactoDeLeads } = await lector();
  sembrar();
  const r = await primerContactoDeLeads([lead(4), lead(5)], new Date(t(5 * 24 * 60)));
  assert.deepEqual(r.map((x) => [x.id, x.pc.estado, x.pc.minutos, x.pc.canal]), [[4, 'contactado', 200, 'llamada'], [5, 'contactado', 300, 'llamada']]);
});

test('4 · una tabla que todavía no existe (la 0390) no tumba la lectura; los leads que no llegan solos ni se leen', async () => {
  const { primerContactoDeLeads } = await lector();
  sembrar();
  faltaTabla.add('llamadas_grabadas');
  const r = await primerContactoDeLeads([lead(4), lead(1, 'importacion'), lead(2, 'carga_manual')], new Date(t(5 * 24 * 60)));
  assert.deepEqual(r.map((x) => [x.id, x.pc.estado]), [[4, 'sin_contactar']]);
});
