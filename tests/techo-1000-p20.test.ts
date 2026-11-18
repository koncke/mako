// =============================================================================
// P20: las lecturas que cortaban en 1000 filas leen TODO (18/11/2026)
// =============================================================================
// PostgREST devuelve como mucho 1000 filas por pedido y contesta 200: no hay error, no hay aviso. Estas funciones
// hacían un `.select()` plano sobre tablas que pasan o pueden pasar ese número, y desde el P20 (docs/pendientes-
// verificados-17-11.md) pasan por `leerTodo` / `leerPorPaginas` (lib/supabase-paginado.ts).
//
// Aquí se EJECUTAN las funciones reales contra un PostgREST de mentira que hace lo que hace el de verdad: corta cada
// pedido en 1000 filas y respeta el `offset` de `.range()` (el de tests/_postgrest-de-mentira.ts devuelve todo de una y
// no mira el offset, así que una lectura plana pasaría igual). Con 1.500 filas, una lectura que no pagina devuelve
// 1.000 y el test da rojo.
//
// Se carga en este mismo proceso, con `Module._load`: `server-only` vacío, `lib/workspace` de mentira (getTenantDb
// devuelve el cliente de supabase-js con el fetch de abajo) y los módulos de IA y de plata de mentira. El resto es el
// código de verdad.
// Correr: node --import tsx --test tests/techo-1000-p20.test.ts
// =============================================================================

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { createClient } from '@supabase/supabase-js';
import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

const TECHO = 1000;
const N = 1500;

const pg = crearPostgrest({
  tablas: ['wa_bloqueados', 'wa_ocultos', 'pagos', 'experimento_tareas', 'plan_tareas', 'plan_proyectos'],
});

/** Cuántos pedidos GET llegaron por tabla: una lectura paginada de 1.500 filas hace 2. */
const pedidos = new Map<string, number>();

/**
 * Postgres no promete en qué orden salen las filas EMPATADAS, y de un pedido al otro las puede repartir distinto: por
 * eso el orden de un barrido tiene que terminar en una columna única. Aquí se imita mezclando la tabla antes de cada
 * pedido (con una semilla fija, para que el test sea repetible): con un orden único no cambia nada; con uno que empata,
 * la página 2 sale de otro reparto y aparecen filas repetidas y salteadas.
 */
let semilla = 1;
const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
function mezclar(filas: Fila[]): void {
  for (let i = filas.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [filas[i], filas[j]] = [filas[j], filas[i]]; }
}

/** El PostgREST de mentira con el techo de 1000 y el `offset` de `.range()`, como el de verdad. */
async function fetchConTecho(entrada: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const metodo = (init.method ?? 'GET').toUpperCase();
  const uno = (new Headers(init.headers).get('Accept') ?? '').includes('vnd.pgrst.object');
  if (metodo !== 'GET' || uno) return pg.responder(u, init);
  const tabla = u.pathname.replace('/rest/v1/', '');
  pedidos.set(tabla, (pedidos.get(tabla) ?? 0) + 1);
  if (pg.db[tabla]) mezclar(pg.db[tabla]);
  const offset = Number(u.searchParams.get('offset') ?? 0) || 0;
  const limit = u.searchParams.has('limit') ? Number(u.searchParams.get('limit')) : Infinity;
  u.searchParams.delete('offset');
  u.searchParams.delete('limit');
  const r = await pg.responder(u, init);
  if (!r.ok) return r;
  const todas = (await r.json()) as Fila[];
  const pagina = todas.slice(offset, offset + Math.min(limit, TECHO));
  return new Response(JSON.stringify(pagina), { status: 200, headers: { 'content-type': 'application/json' } });
}

const db = createClient('http://pg.test', 'clave-de-mentira', {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchConTecho as typeof fetch },
});

const workspace = {
  getTenantDb: async () => db,
  runWithWorkspace: async (_ws: number, f: () => Promise<unknown>) => f(),
  getWorkspaceActual: async () => 9,
  wsSuperAdmin: async () => 9,
  WS_NINGUNO: -1,
};
const falsosDeObjectives: Record<string, unknown> = {
  './ventas-crm': { firmadoEnCrms: async () => ({ usd: 0, cierres: 0 }), ventasDeCrms: async () => [] },
  './moneda-meta': { conversorGastoMeta: async () => ({ aUsd: (n: number) => n }) },
  './funnels-elegidos-server': { ubicarLeads: async () => ({ casas: new Map(), agregados: new Map() }), idsDeLeads: () => [] },
};
const sinDefinir = new Proxy({}, {
  get: (_t, k) => (k === '__esModule' ? true : typeof k === 'string' ? (() => { throw new Error(`mock sin definir: ${k}`); }) : undefined),
});

type Cargador = (pedido: string, padre: { filename?: string } | null, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const original = M._load;
M._load = ((pedido: string, padre: { filename?: string } | null, esMain: boolean) => {
  if (pedido === 'server-only') return {};
  if (pedido === '@/lib/workspace' || pedido === './workspace') return workspace;
  const de = padre?.filename ?? '';
  if (/[\\/]lib[\\/]objectives-fuentes\.ts$/.test(de) && pedido in falsosDeObjectives) return falsosDeObjectives[pedido];
  // plan-proyecto-vacio: sólo su lectura importa; la IA, el borrador y el resto, de mentira.
  if (/[\\/]lib[\\/]plan-proyecto-vacio\.ts$/.test(de) && pedido.startsWith('@/lib/') && pedido !== '@/lib/supabase-paginado') return sinDefinir;
  return Reflect.apply(original, Module, [pedido, padre, esMain]);
}) as Cargador;

beforeEach(() => {
  pg.vaciar();
  semilla = 1;
  pedidos.clear();
  console.error = () => undefined;
});

const tel = (i: number) => `52155${String(i).padStart(8, '0')}`;

test('el PostgREST de mentira corta en 1000 como el de verdad (sin esto, nada de lo de abajo prueba nada)', async () => {
  for (let i = 1; i <= N; i++) pg.db.wa_bloqueados.push({ id: i, telefono: tel(i) });
  const { data } = await db.from('wa_bloqueados').select('telefono');
  assert.equal(data?.length, TECHO, 'un `.select()` plano sobre 1.500 filas tiene que volver con 1.000');
});

test('telefonosBloqueados y telefonosOcultos marcan a los 1.500, no a los primeros 1.000', async () => {
  for (let i = 1; i <= N; i++) {
    pg.db.wa_bloqueados.push({ id: i, telefono: tel(i) });
    pg.db.wa_ocultos.push({ id: i, telefono: tel(i) });
  }
  const { telefonosBloqueados, telefonosOcultos } = await import('../lib/evolution-block');
  const bloq = await telefonosBloqueados();
  assert.equal(bloq.size, N, 'los bloqueados del workspace son 1.500');
  assert.ok(bloq.has(tel(N)), 'el bloqueado 1.500 tiene que salir marcado');
  assert.equal(pedidos.get('wa_bloqueados'), 2, 'leyó en dos páginas');
  const ocu = await telefonosOcultos();
  assert.equal(ocu.size, N, 'los ocultos del workspace son 1.500');
  assert.ok(ocu.has(tel(1234)), 'el oculto 1.234 no puede volver a la bandeja');
});

test('telefonosBloqueados con la lectura caída: la lista vacía, como antes', async () => {
  pg.faltan.add('wa_bloqueados');
  const { telefonosBloqueados } = await import('../lib/evolution-block');
  const bloq = await telefonosBloqueados();
  assert.equal(bloq.size, 0);
});

test('el cash del KPI suma las 1.500 cuotas cobradas del período, no las primeras 1.000', async () => {
  // (Lo firmado, `sold_usd`, sigue sin paginar a propósito: ver el porqué arriba de `soldUsd` en lib/objectives-fuentes.ts.)
  for (let i = 1; i <= N; i++) pg.db.pagos.push({ id: i, pagado: true, fecha_pago: '2026-11-10', monto_usd: 10 });
  // Una de afuera del período y una sin cobrar: no cuentan.
  pg.db.pagos.push({ id: N + 1, pagado: true, fecha_pago: '2026-10-01', monto_usd: 999 });
  pg.db.pagos.push({ id: N + 2, pagado: false, fecha_pago: '2026-11-10', monto_usd: 999 });
  const { leerFuente } = await import('../lib/objectives-fuentes');
  const cash = await leerFuente('cash_usd', '2026-11-01', '2026-11-30');
  assert.deepEqual(cash, { valor: N * 10 }, 'el cash son las 1.500 cuotas, no las primeras 1.000');
  assert.equal(pedidos.get('pagos'), 2, 'leyó en dos páginas');
});

test('el cash con la lectura caída es null con su motivo, nunca un cero', async () => {
  pg.faltan.add('pagos');
  const { leerFuente } = await import('../lib/objectives-fuentes');
  const cash = await leerFuente('cash_usd', '2026-11-01', '2026-11-30');
  assert.equal(cash.valor, null);
  assert.match(cash.error ?? '', /pagos/);
});

test('listTareasConTope lee las 1.500 tareas, `leidas` cuenta ANTES de filtrar y el orden del tablero se conserva', async () => {
  // Todas con el MISMO `orden` y la misma fecha: sin el `id` al final del orden, el reparto entre páginas no está definido.
  for (let i = 1; i <= N; i++) {
    pg.db.experimento_tareas.push({ id: i, titulo: `T${i}`, orden: 0, created_at: '2026-11-01T00:00:00Z', retro_id: i > 1200 ? 7 : null });
  }
  const { listTareasConTope } = await import('../lib/todo');
  const todo = await listTareasConTope();
  assert.equal(todo.leidas, N);
  assert.equal(todo.tareas.length, N);
  assert.equal(new Set(todo.tareas.map((t) => t.id)).size, N, 'ninguna repetida, ninguna salteada');
  assert.deepEqual(todo.tareas.slice(0, 3).map((t) => t.id), [1, 2, 3], 'el empate se resuelve por `id`');
  const plan = await listTareasConTope({ soloDelPlan: true });
  assert.equal(plan.leidas, N, '`leidas` son las filas leídas ANTES de sacar las de la Retro');
  assert.equal(plan.tareas.length, 1200, 'sin las 300 de la Retro');
});

test('proyectosSinTareas no da por vacío a ningún proyecto con trabajo abierto, aunque su tarea esté pasada la fila 1.000', async () => {
  // 900 proyectos (menos de 1000: los proyectos se leen con un `.select()` plano, y no son lo que se prueba aquí) y
  // 1.500 tareas abiertas: los 600 primeros tienen dos y los 300 últimos UNA. Cortadas en 1.000, alguno de los de una
  // sola queda sin su tarea y se da por vacío, en cualquier orden que salgan.
  const PROYS = 900;
  for (let k = 1; k <= PROYS; k++) pg.db.plan_proyectos.push({ id: `p${k}`, name: `Proyecto ${k}`, emoji: '📁', detalle: '', score: 50 });
  for (let i = 1; i <= N; i++) {
    const proy = i <= PROYS ? i : i - PROYS;
    pg.db.plan_tareas.push({ id: `t${String(i).padStart(5, '0')}`, progress: 0, labels: [`p${proy}`] });
  }
  const { proyectosSinTareas } = await import('../lib/plan-proyecto-vacio');
  const vacios = await proyectosSinTareas();
  assert.deepEqual(vacios.map((p) => p.id), [], 'los 900 proyectos tienen trabajo abierto: ninguno está vacío');
  assert.equal(pedidos.get('plan_tareas'), 2, 'leyó las tareas en dos páginas');
});

test('proyectosSinTareas con la lectura de tareas caída NO da a todos por vacíos: tira, y la API lo cuenta como falla', async () => {
  // «No pude leer» no es «no hay tareas»: con la lista vacía de antes, los 3 proyectos salían vacíos, y proponerles
  // tareas paga IA por cada uno.
  for (let k = 1; k <= 3; k++) pg.db.plan_proyectos.push({ id: `p${k}`, name: `Proyecto ${k}`, emoji: '📁', detalle: '', score: 50 });
  pg.faltan.add('plan_tareas');
  const { proyectosSinTareas } = await import('../lib/plan-proyecto-vacio');
  await assert.rejects(proyectosSinTareas(), /No pude leer las tareas del plan/);
});

// -----------------------------------------------------------------------------
// Probado ROMPIÉNDOLO (18/11/2026; base: 7 pasan / 0 fallan). Una rotura por vez, restaurando (pasan / fallan, y qué dijo):
//   · telefonosBloqueados vuelve a `.from('wa_bloqueados').select('telefono')`        -> 6 / 1 (size 1000, no 1500)
//   · cashUsd vuelve al `.select('monto_usd').eq('pagado', true)…` plano               -> 6 / 1 (valor 10000, no 15000)
//   · listTareasConTope vuelve al `.select(COLS).order('orden').order('created_at')`   -> 6 / 1 (leidas 1000, no 1500)
//   · listTareasConTope ordena por `['orden', 'created_at']`, sin el `id` único        -> 6 / 1 (1174 distintas de 1500:
//     repetidas y salteadas entre páginas, por los empates que mezcla el PostgREST de mentira)
//   · proyectosSinTareas vuelve a `db.from('plan_tareas').select('progress, labels')`  -> 6 / 1 (proyectos con trabajo
//     dados por vacíos)
//   · (después) `tareasDelPlan` vuelve a devolver `[]` con la lectura caída                -> 7 / 1 (no tiró: los 3
//     proyectos salían vacíos)
// Restaurado: 8 / 0.
// -----------------------------------------------------------------------------
