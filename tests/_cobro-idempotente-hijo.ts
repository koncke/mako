// =============================================================================
// Hijo de tests/pagos-cobro-idempotente.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre `marcarPago` y `cobrarCuota` (lib/pagos.ts) REALES contra un PostgREST de mentira (tests/_postgrest-de-mentira.ts),
// en un node aparte con `--conditions=react-server` (traen `server-only`), dentro del workspace de prueba (el 3, nunca el
// 1). El reloj queda clavado en el 21/10/2026 02:00 UTC: en México (la zona guardada del negocio) son las 20 h del 20/10,
// y en UTC ya es el 21. Imprime lo que devolvió cada llamada, las filas de `pagos` y cuántas escrituras le llegaron.
//
// LA CARRERA (revisión adversarial del 20/10): dos llamadas a la vez sobre la MISMA cuota, con una barrera que retiene
// la lectura de esa cuota hasta que llegaron las dos. Así las dos leen «impaga» antes de que cualquiera escriba, que es
// el orden que dejaba pasar a las dos.
// Nada sale a la red: lo que no es la base se anota en `red` y tiene que dar vacío.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const AHORA = Date.parse('2026-10-21T02:00:00Z');
const DateReal = Date;
class DateFijo extends DateReal {
  constructor(...a: ConstructorParameters<typeof Date> | []) {
    if (a.length === 0) super(AHORA); else super(...(a as ConstructorParameters<typeof Date>));
  }
  static now() { return AHORA; }
}
globalThis.Date = DateFijo as DateConstructor;

let siguienteId = 900;
// El índice único de `pagos` (lead_id, numero): un insert que choca contesta 23505, como Postgres.
const pg = crearPostgrest({
  tablas: ['pagos', 'leads', 'app_settings', 'workspaces'],
  defaults: (tabla, f) => (tabla === 'pagos' ? { id: siguienteId++, ...f } : { ...f }),
  unicos: [{ tabla: 'pagos', columnas: ['lead_id', 'numero'], donde: () => true, nombre: 'pagos_lead_numero' }],
});
const escrituras: string[] = [];
const red: string[] = [];

/** La barrera: retiene la lectura de la cuota `id` hasta que llegaron `n`. */
const barreras = new Map<string, { faltan: number; esperando: Array<() => void> }>();
const barrera = (id: number, n: number) => barreras.set(`eq.${id}`, { faltan: n, esperando: [] });

/** Un gancho de UNA vez (revisión del 21/10): `antes` puede contestar en lugar de la base (una falla); `despues` toca la
 *  base después de contestar (lo que hizo otro escritor entre una lectura y la escritura que sigue). */
type Gancho = { cuando: (u: URL, metodo: string, cuerpo: Record<string, unknown> | null) => boolean; antes?: (cuerpo: Record<string, unknown> | null) => Response | void; despues?: () => void };
const ganchos: Gancho[] = [];
const fallar = (mensaje: string) => new Response(JSON.stringify({ code: 'XX000', message: mensaje, details: null, hint: null }), { status: 500, headers: { 'content-type': 'application/json' } });

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') {
    const metodo = (init.method ?? 'GET').toUpperCase();
    if (metodo !== 'GET' && metodo !== 'HEAD') escrituras.push(`${metodo} ${u.pathname.split('/').pop()}`);
    const b = metodo === 'GET' && u.pathname.endsWith('/pagos') ? barreras.get(u.searchParams.get('id') ?? '') : undefined;
    if (b && b.faltan > 0) {
      b.faltan -= 1;
      if (b.faltan > 0) await new Promise<void>((ok) => b.esperando.push(ok));
      else for (const ok of b.esperando.splice(0)) ok();
    }
    let cuerpo: Record<string, unknown> | null = null;
    try { cuerpo = typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch { cuerpo = null; }
    const i = ganchos.findIndex((g) => g.cuando(u, metodo, cuerpo));
    const g = i >= 0 ? ganchos.splice(i, 1)[0] : null;
    const enLugar = g?.antes?.(cuerpo);
    if (enLugar) return enLugar;
    const r = await pg.responder(u, init);
    g?.despues?.();
    return r;
  }
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 3;
const cuota = (id: number, x: Record<string, unknown>) => ({
  id, workspace_id: WS, lead_id: 7, numero: id - 9, monto_usd: 500, fecha_esperada: '2026-10-20', pagado: false, fecha_pago: null,
  proveedor: null, cobro_id: null, nacio_cobrada: false, moneda: null, monto_original: null, pago_hora: null, ...x,
});

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { marcarPago, cobrarCuota, registrarCobroDeProveedor } = await import('../lib/pagos');
  const db = pg.db;
  db.workspaces.push({ id: WS, nombre: 'Prueba' });
  db.app_settings.push({ workspace_id: WS, key: 'mako.timezone', value: 'America/Mexico_City', updated_at: '2026-10-01T00:00:00Z' });
  db.leads.push(
    { id: 7, workspace_id: WS, nombre: 'Ana', monto_cierre_usd: 1500, total_cobrado_usd: 500 },
    { id: 8, workspace_id: WS, nombre: 'Beto', monto_cierre_usd: 500, total_cobrado_usd: null },
    { id: 9, workspace_id: WS, nombre: 'Caro', monto_cierre_usd: 500, total_cobrado_usd: null },
    { id: 10, workspace_id: WS, nombre: 'Dani', monto_cierre_usd: 500, total_cobrado_usd: null },
    { id: 11, workspace_id: WS, nombre: 'Eli', monto_cierre_usd: 500, total_cobrado_usd: null },
    { id: 12, workspace_id: WS, nombre: 'Fede', monto_cierre_usd: 500, total_cobrado_usd: null },
    { id: 13, workspace_id: WS, nombre: 'Gabi', monto_cierre_usd: 500, total_cobrado_usd: null },
    { id: 14, workspace_id: WS, nombre: 'Hugo', monto_cierre_usd: 500, total_cobrado_usd: null },
  );
  db.pagos.push(
    cuota(10, { pagado: true, fecha_pago: '2026-10-01' }), // ya cobrada el 1/10
    cuota(11, { nacio_cobrada: true }), // un pago suelto que alguien ya desmarcó
    cuota(12, {}), // impaga: se cobra sin fecha
    cuota(20, { lead_id: 8, numero: 1 }), // la carrera de `marcarPago`
    cuota(21, { lead_id: 9, numero: 1 }), // la carrera de `cobrarCuota`
    cuota(22, { lead_id: 10, numero: 1 }), // leer las cuotas falla una vez
    cuota(23, { lead_id: 11, numero: 1 }), // sincronizar falla una vez, después de tomar la cuota
    cuota(24, { lead_id: 12, numero: 1 }), // otro escritor toma el número de la diferencia
    cuota(30, { lead_id: 13, numero: 1 }), // la pasarela y un cobro a mano a la vez
    cuota(26, { lead_id: 14, numero: 1 }), // otro la cobra entre la diferencia y la toma
  );
  const fila = (id: number) => {
    const f = db.pagos.find((p) => p.id === id);
    return f ? { pagado: f.pagado, fecha_pago: f.fecha_pago, monto_usd: f.monto_usd, moneda: f.moneda, monto_original: f.monto_original } : null;
  };

  const r: Record<string, unknown> = {};
  // Lo que se escribió en `pagos` (el «ya estaba» puede curar lo cobrado del LEAD, pero no toca la cuota).
  const enPagos = () => escrituras.filter((e) => e.endsWith(' pagos')).length;
  await runWithWorkspace(WS, async () => {
    let antes = enPagos();
    r.remarcar = await marcarPago(10, true, '2026-10-20');
    r.remarcarEscrituras = enPagos() - antes;
    antes = enPagos();
    r.redesmarcar = await marcarPago(11, false, null);
    r.redesmarcarEscrituras = enPagos() - antes;
    antes = enPagos();
    r.recobrar = await cobrarCuota(10, 7, { monto: 300, fecha: '2026-10-20', moneda: 'MXN', montoOriginal: 5100 });
    r.recobrarEscrituras = enPagos() - antes;
    r.cobrarSinFecha = await marcarPago(12, true, null);

    // Dos «Marcar cobrada» a la vez (General en la computadora y en el teléfono), con fechas distintas.
    barrera(20, 2);
    r.carreraMarcar = await Promise.all([marcarPago(20, true, '2026-10-20'), marcarPago(20, true, '2026-10-19')]);
    // MaKo cobra 300 (el resto pendiente) mientras la ficha guarda 500 en pesos.
    barrera(21, 2);
    r.carreraCobrar = await Promise.all([
      cobrarCuota(21, 9, { monto: 300, fecha: '2026-10-20', resto: 'pendiente' }),
      cobrarCuota(21, 9, { monto: 500, fecha: '2026-10-19', moneda: 'MXN', montoOriginal: 8600 }),
    ]);

    // (revisión del 21/10) Leer las cuotas del lead falla UNA vez antes de dejar la diferencia: no se toca nada, y el
    // reintento cobra entero.
    ganchos.push({ cuando: (u, m) => m === 'GET' && u.pathname.endsWith('/pagos') && u.searchParams.get('lead_id') === 'eq.10' && !u.searchParams.has('id'), antes: () => fallar('timeout de la base') });
    r.leerFalla = await cobrarCuota(22, 10, { monto: 300, fecha: '2026-10-20', resto: 'pendiente' }).then(() => 'no tiró', (e) => String(e instanceof Error ? e.message : e));
    r.leerFallaCuota = fila(22);
    r.leerFallaFilas = db.pagos.filter((p) => p.lead_id === 10).length;
    r.leerFallaReintento = await cobrarCuota(22, 10, { monto: 300, fecha: '2026-10-20', resto: 'pendiente' });

    // Sincronizar falla UNA vez después de tomar la cuota: el cobro queda entero y el reintento «ya estaba» lo CURA.
    ganchos.push({ cuando: (u, m) => m === 'PATCH' && u.pathname.endsWith('/leads') && u.searchParams.get('id') === 'eq.11', antes: () => fallar('la base no contestó') });
    r.sincFalla = await cobrarCuota(23, 11, { monto: 500, fecha: '2026-10-20' }).then(() => 'no tiró', (e) => String(e instanceof Error ? e.message : e));
    r.sincFallaTotal = db.leads.find((l) => l.id === 11)?.total_cobrado_usd ?? null;
    r.sincFallaReintento = await cobrarCuota(23, 11, { monto: 500, fecha: '2026-10-20' });
    r.sincCuradoTotal = db.leads.find((l) => l.id === 11)?.total_cobrado_usd ?? null;

    // Otro escritor del lead (un pago suelto) toma el número de la diferencia justo antes: se renumera, no se deshace.
    ganchos.push({
      cuando: (u, m, c) => m === 'POST' && u.pathname.endsWith('/pagos') && Number(c?.lead_id) === 12,
      antes: (c) => { db.pagos.push(cuota(25, { lead_id: 12, numero: Number(c?.numero), monto_usd: 100, pagado: true, fecha_pago: '2026-10-20', nacio_cobrada: true })); },
    });
    r.choque = await cobrarCuota(24, 12, { monto: 300, fecha: '2026-10-20', resto: 'pendiente' });
    r.choqueCuota = fila(24);
    r.choqueFilas = db.pagos.filter((p) => p.lead_id === 12).map((p) => ({ id: p.id, numero: p.numero, pagado: p.pagado, monto_usd: p.monto_usd }));

    // La pasarela lee la cuota 30 impaga y, antes de que escriba, un cobro a mano en pesos la toma.
    ganchos.push({
      cuando: (u, m) => m === 'GET' && u.pathname.endsWith('/pagos') && u.searchParams.get('id') === 'eq.30',
      despues: () => { Object.assign(db.pagos.find((p) => p.id === 30) as Record<string, unknown>, { pagado: true, fecha_pago: '2026-10-20', moneda: 'MXN', monto_original: 8600 }); },
    });
    r.pasarela = await registrarCobroDeProveedor({ leadId: 13, cobroId: 77, pagoId: 30, proveedor: 'stripe', proveedorPagoId: 'pi_de_prueba', montoUsd: 500, montoOriginal: 500, moneda: 'USD', fechaPago: '2026-10-20' });
    r.pasarelaFilas = db.pagos.filter((p) => p.lead_id === 13).map((p) => ({ id: p.id, pagado: p.pagado, proveedor: p.proveedor, cobro_id: p.cobro_id, moneda: p.moneda, monto_original: p.monto_original, monto_usd: p.monto_usd }));
    r.pasarelaTotal = db.leads.find((l) => l.id === 13)?.total_cobrado_usd ?? null;

    // Cobrar 300 de la 26 deja su diferencia y, ANTES de tomar la cuota, otro la cobra entera: la diferencia de este
    // cobro, que no fue, se quita (por la reconciliación), y el resultado es «ya estaba».
    ganchos.push({
      cuando: (u, m, c) => m === 'POST' && u.pathname.endsWith('/pagos') && Number(c?.lead_id) === 14,
      despues: () => { Object.assign(db.pagos.find((p) => p.id === 26) as Record<string, unknown>, { pagado: true, fecha_pago: '2026-10-20' }); },
    });
    r.perdio = await cobrarCuota(26, 14, { monto: 300, fecha: '2026-10-20', resto: 'pendiente' });
    r.perdioFilas = db.pagos.filter((p) => p.lead_id === 14).map((p) => ({ id: p.id, pagado: p.pagado, monto_usd: p.monto_usd }));
  });
  const lead = (id: number) => db.leads.find((l) => l.id === id)?.total_cobrado_usd ?? null;
  const delLead = (id: number) => db.pagos.filter((p) => p.lead_id === id).map((p) => ({ id: p.id, pagado: p.pagado, monto_usd: p.monto_usd }));
  process.stdout.write(JSON.stringify({
    ...r, cuotas: { 10: fila(10), 11: fila(11), 12: fila(12), 20: fila(20), 21: fila(21) },
    filas: db.pagos.filter((p) => p.lead_id === 7).length,
    totales: { 8: lead(8), 9: lead(9) }, pagosDe9: delLead(9), red,
  }));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
