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
  // Los defaults de la base (`pagado` y `nacio_cobrada` en false): sin ellos, una cuota insertada quedaba en null y las
  // escrituras condicionales (`.eq('pagado', false)`) no la encontraban (revisión de 7524ec1c9).
  defaults: (tabla, f) => (tabla === 'pagos' ? { id: siguienteId++, pagado: false, nacio_cobrada: false, resto_de: null, es_mensualidad: false, ...f } : { ...f }),
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
    // La base de mentira contesta también la función de la mig 0318 (tests/_postgrest-de-mentira.ts).
    const r = await pg.responder(u, init);
    g?.despues?.();
    return r;
  }
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const choque = () => new Response(JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint "pagos_lead_numero"', details: null, hint: null }), { status: 409, headers: { 'content-type': 'application/json' } });

const WS = 3;
const cuota = (id: number, x: Record<string, unknown>) => ({
  id, workspace_id: WS, lead_id: 7, numero: id - 9, monto_usd: 500, fecha_esperada: '2026-10-20', pagado: false, fecha_pago: null,
  proveedor: null, cobro_id: null, nacio_cobrada: false, moneda: null, monto_original: null, pago_hora: null, ...x,
});

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { marcarPago, cobrarCuota, registrarCobroDeProveedor, saveLeadPlanManual, savePlanPagos, ajustarPlanPagos, registrarPagoSuelto } = await import('../lib/pagos');
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
    { id: 15, workspace_id: WS, nombre: 'Inés', monto_cierre_usd: 500, total_cobrado_usd: null },
    { id: 16, workspace_id: WS, nombre: 'Juan', monto_cierre_usd: 500, total_cobrado_usd: null },
    { id: 17, workspace_id: WS, nombre: 'Kati', monto_cierre_usd: 1000, total_cobrado_usd: null },
    // (quinta revisión, 21/10) La fecha de cierre al ganar con el plan, el plan uniforme sobre una seña, la cuota que se
    // borra mientras se cobra y el monto de menos de un centavo.
    { id: 18, workspace_id: WS, nombre: 'Lía', venta_tipo: 'suscripcion', estado_lead: 'abierto', fecha_cierre: null, total_cobrado_usd: null },
    { id: 19, workspace_id: WS, nombre: 'Mati', venta_tipo: 'suscripcion', estado_lead: 'ganado', cerro: true, fecha_cierre: '2026-10-01', total_cobrado_usd: null },
    { id: 20, workspace_id: WS, nombre: 'Nora', estado_lead: 'ganado', fecha_cierre: '2026-10-01', total_cobrado_usd: 100 },
    { id: 21, workspace_id: WS, nombre: 'Omar', estado_lead: 'ganado', fecha_cierre: '2026-10-01', total_cobrado_usd: 100 },
    { id: 22, workspace_id: WS, nombre: 'Pía', monto_cierre_usd: 500, total_cobrado_usd: null },
    { id: 23, workspace_id: WS, nombre: 'Quique', monto_cierre_usd: 500, total_cobrado_usd: null },
    { id: 24, workspace_id: WS, nombre: 'Rita', monto_cierre_usd: 500, total_cobrado_usd: null },
    // (revisión de 7524ec1c9) El plan de la ficha sobre una seña cobrada por LINK, y sobre la diferencia de un cobro por
    // menos (con un pago suelto antes y sin él).
    { id: 25, workspace_id: WS, nombre: 'Sofi', estado_lead: 'ganado', fecha_cierre: '2026-10-05', total_cobrado_usd: null },
    { id: 26, workspace_id: WS, nombre: 'Tomás', estado_lead: 'ganado', fecha_cierre: '2026-10-05', total_cobrado_usd: null },
    { id: 27, workspace_id: WS, nombre: 'Úrsula', estado_lead: 'ganado', fecha_cierre: '2026-10-05', total_cobrado_usd: null },
    // (mig 0323) La cuota se edita entre la lectura y el cobro (por menos y entero), y el control sin cambios.
    { id: 28, workspace_id: WS, nombre: 'Vale', monto_cierre_usd: 500, total_cobrado_usd: null },
    { id: 29, workspace_id: WS, nombre: 'Walter', monto_cierre_usd: 500, total_cobrado_usd: null },
    { id: 30, workspace_id: WS, nombre: 'Ximena', monto_cierre_usd: 500, total_cobrado_usd: null },
    // (revisión de e19a5196f) «Registrar el mes cobrado» y «Registrar un pago».
    { id: 31, workspace_id: WS, nombre: 'Yago', venta_tipo: 'suscripcion', total_cobrado_usd: null },
  );
  db.pagos.push(
    cuota(10, { pagado: true, fecha_pago: '2026-10-01' }), // ya cobrada el 1/10
    cuota(11, { nacio_cobrada: true }), // un pago suelto que alguien ya desmarcó
    cuota(12, {}), // impaga: se cobra sin fecha
    cuota(20, { lead_id: 8, numero: 1 }), // la carrera de `marcarPago`
    cuota(21, { lead_id: 9, numero: 1 }), // la carrera de `cobrarCuota`
    cuota(22, { lead_id: 10, numero: 1 }), // el cobro de menos falla en la base
    cuota(23, { lead_id: 11, numero: 1 }), // sincronizar falla una vez, después de tomar la cuota
    cuota(24, { lead_id: 12, numero: 1 }), // otro escritor toma el número de la diferencia (23505)
    cuota(30, { lead_id: 13, numero: 1 }), // la pasarela y un cobro a mano a la vez
    cuota(26, { lead_id: 14, numero: 1 }), // otro la cobra justo antes de la transacción
    cuota(27, { lead_id: 15, numero: 1 }), // la respuesta del cobro de menos se pierde con todo escrito
    cuota(31, { lead_id: 16, numero: 1 }), // la pasarela: sincronizar falla una vez
    cuota(43, { lead_id: 17, numero: 1, fecha_esperada: '2026-10-01' }), // el casamiento por monto: la primera…
    cuota(44, { lead_id: 17, numero: 2, fecha_esperada: '2026-11-01' }), // …y la siguiente del mismo monto
    cuota(45, { lead_id: 20, numero: 1, monto_usd: 100, pagado: true, fecha_pago: '2026-10-05', nacio_cobrada: true }), // una seña suelta, sin plan
    cuota(46, { lead_id: 21, numero: 0, monto_usd: 1000, fecha_esperada: '2026-10-01' }), // un plan (inicial y cuota 1)…
    cuota(47, { lead_id: 21, numero: 1, monto_usd: 1000, fecha_esperada: '2026-11-05' }),
    cuota(48, { lead_id: 21, numero: 2, monto_usd: 100, pagado: true, fecha_pago: '2026-10-05', nacio_cobrada: true }), // …y una seña con el número 2
    cuota(49, { lead_id: 22, numero: 1 }), // se borra mientras se cobra entera
    cuota(50, { lead_id: 23, numero: 1 }), // se borra mientras se cobra por menos
    cuota(51, { lead_id: 24, numero: 1 }), // un monto de menos de un centavo
    cuota(52, { lead_id: 26, numero: 1, monto_usd: 300, pagado: true, fecha_esperada: '2026-10-03', fecha_pago: '2026-10-03', nacio_cobrada: true }), // un pago suelto antes del plan
    cuota(53, { lead_id: 28, numero: 1 }), // se edita a 400 antes del cobro por menos
    cuota(54, { lead_id: 29, numero: 1 }), // se edita a 400 antes del cobro entero
    cuota(55, { lead_id: 30, numero: 1 }), // el control
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

    // (revisión del 21/10) El cobro de menos falla en la base: la transacción no escribe NADA (ni la cuota ni una
    // diferencia fantasma), y el reintento cobra entero, con UNA diferencia.
    const alRpc = (lead: number) => (u: URL, m: string, c: Record<string, unknown> | null) => m === 'POST' && u.pathname.endsWith('/rpc/cobrar_cuota_con_resto') && Number(c?.p_lead) === lead;
    ganchos.push({ cuando: alRpc(10), antes: () => fallar('timeout de la base') });
    r.leerFalla = await cobrarCuota(22, 10, { monto: 300, fecha: '2026-10-20', resto: 'pendiente' }).then(() => 'no tiró', (e) => String(e instanceof Error ? e.message : e));
    r.leerFallaCuota = fila(22);
    r.leerFallaFilas = db.pagos.filter((p) => p.lead_id === 10).length;
    r.leerFallaReintento = await cobrarCuota(22, 10, { monto: 300, fecha: '2026-10-20', resto: 'pendiente' });
    r.leerFallaFilasFin = db.pagos.filter((p) => p.lead_id === 10).map((p) => ({ pagado: p.pagado, monto_usd: p.monto_usd }));

    // La respuesta se pierde con TODO escrito (la función corrió): el reintento ve la cuota cobrada, dice «ya estaba» y
    // la diferencia está UNA vez.
    ganchos.push({ cuando: alRpc(15), despues: () => { throw new TypeError('fetch failed'); } });
    r.ambiguo = await cobrarCuota(27, 15, { monto: 300, fecha: '2026-10-20', resto: 'pendiente' }).then(() => 'no tiró', (e) => String(e instanceof Error ? e.message : e));
    r.ambiguoReintento = await cobrarCuota(27, 15, { monto: 300, fecha: '2026-10-20', resto: 'pendiente' });
    r.ambiguoFilas = db.pagos.filter((p) => p.lead_id === 15).map((p) => ({ pagado: p.pagado, monto_usd: p.monto_usd }));
    r.ambiguoTotal = db.leads.find((l) => l.id === 15)?.total_cobrado_usd ?? null;

    // Sincronizar falla UNA vez después de tomar la cuota: el cobro queda entero y el reintento «ya estaba» lo CURA.
    ganchos.push({ cuando: (u, m) => m === 'PATCH' && u.pathname.endsWith('/leads') && u.searchParams.get('id') === 'eq.11', antes: () => fallar('la base no contestó') });
    r.sincFalla = await cobrarCuota(23, 11, { monto: 500, fecha: '2026-10-20' }).then(() => 'no tiró', (e) => String(e instanceof Error ? e.message : e));
    r.sincFallaTotal = db.leads.find((l) => l.id === 11)?.total_cobrado_usd ?? null;
    r.sincFallaReintento = await cobrarCuota(23, 11, { monto: 500, fecha: '2026-10-20' });
    r.sincCuradoTotal = db.leads.find((l) => l.id === 11)?.total_cobrado_usd ?? null;

    // Otro escritor del lead (un pago suelto) toma el número de la diferencia: la transacción entera falla con 23505 (no
    // escribe nada) y se reintenta una vez con el número siguiente.
    ganchos.push({
      cuando: alRpc(12),
      antes: () => { db.pagos.push(cuota(25, { lead_id: 12, numero: 2, monto_usd: 100, pagado: true, fecha_pago: '2026-10-20', nacio_cobrada: true })); return choque(); },
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

    // Cobrar 300 de la 26 y, justo antes de la transacción, otro la cobra entera: «ya estaba», y no queda ninguna
    // diferencia de un cobro que no fue.
    ganchos.push({
      cuando: alRpc(14),
      antes: () => { Object.assign(db.pagos.find((p) => p.id === 26) as Record<string, unknown>, { pagado: true, fecha_pago: '2026-10-20' }); },
    });
    r.perdio = await cobrarCuota(26, 14, { monto: 300, fecha: '2026-10-20', resto: 'pendiente' });
    r.perdioFilas = db.pagos.filter((p) => p.lead_id === 14).map((p) => ({ id: p.id, pagado: p.pagado, monto_usd: p.monto_usd }));

    // La pasarela marca la 31 y sincronizar falla una vez: corta los recordatorios IGUAL (va primero), y el reintento del
    // webhook («ya estaba») sincroniza y vuelve a cortar.
    ganchos.push({ cuando: (u, m) => m === 'PATCH' && u.pathname.endsWith('/leads') && u.searchParams.get('id') === 'eq.16', antes: () => fallar('la base no contestó') });
    const cortes = () => escrituras.filter((e) => e === 'PATCH flujo_corridas').length;
    const antesDelCorte = cortes();
    const pagoLink = { leadId: 16, cobroId: 78, pagoId: 31, proveedor: 'stripe' as const, proveedorPagoId: 'pi_cura', montoUsd: 500, montoOriginal: 500, moneda: 'USD', fechaPago: '2026-10-20' };
    r.curaFalla = await registrarCobroDeProveedor(pagoLink).then(() => 'no tiró', (e) => String(e instanceof Error ? e.message : e));
    r.curaCortesPrimera = cortes() - antesDelCorte;
    r.curaReintento = await registrarCobroDeProveedor(pagoLink);
    r.curaCortesTotal = cortes() - antesDelCorte;
    r.curaTotal = db.leads.find((l) => l.id === 16)?.total_cobrado_usd ?? null;

    // Un link SIN cuota de 500 casa por monto con la 43 y, antes de que escriba, alguien la cobra a mano: el pago salda
    // la 44 (la siguiente del mismo monto), no entra como cuota nueva.
    ganchos.push({
      cuando: (u, m) => m === 'PATCH' && u.pathname.endsWith('/pagos') && u.searchParams.get('id') === 'eq.43',
      antes: () => { Object.assign(db.pagos.find((p) => p.id === 43) as Record<string, unknown>, { pagado: true, fecha_pago: '2026-10-20' }); },
    });
    r.casa = await registrarCobroDeProveedor({ leadId: 17, cobroId: 79, pagoId: null, proveedor: 'stripe', proveedorPagoId: 'pi_casa', montoUsd: 500, montoOriginal: 500, moneda: 'USD', fechaPago: '2026-10-20' });
    r.casaFilas = db.pagos.filter((p) => p.lead_id === 17).map((p) => ({ id: p.id, pagado: p.pagado, proveedor: p.proveedor }));
    r.casaTotal = db.leads.find((l) => l.id === 17)?.total_cobrado_usd ?? null;

    // (quinta revisión) Lo que gana guardando el plan lleva su fecha de cierre: la del día del negocio si no tenía.
    await saveLeadPlanManual(18, { total_usd: null, duracion_meses: null, fecha_cierre: null, fecha_inicio: null, cuotas: [{ monto_usd: 500, fecha_esperada: '2026-10-20' }] });
    r.cierreNuevo = db.leads.find((l) => l.id === 18)?.fecha_cierre ?? null;
    await saveLeadPlanManual(19, { total_usd: null, duracion_meses: null, fecha_cierre: null, fecha_inicio: null, cuotas: [{ monto_usd: 500, fecha_esperada: '2026-10-01' }] });
    r.cierreQueTenia = db.leads.find((l) => l.id === 19)?.fecha_cierre ?? null;
    // El plan uniforme sobre una seña sin plan: no se arma (la seña tapaba la cuota 1) y se dice.
    const plan = { cobro_inicial_usd: 1000, monto_cuota_usd: 1000, total_cuotas: 3, dia_de_pago: 5 };
    r.unifSena = await savePlanPagos(20, plan).then(() => 'no tiró', (e) => String(e instanceof Error ? e.message : e));
    r.unifSenaFilas = db.pagos.filter((p) => p.lead_id === 20).length;
    // Con un plan y una seña con el número 2: la cuota 2 del plan se arma igual (la seña no la tapa).
    await savePlanPagos(21, plan);
    r.unifPlan = db.pagos.filter((p) => p.lead_id === 21 && !p.pagado).map((p) => Number(p.monto_usd)).reduce((a, b) => a + b, 0);
    r.unifPlanNumeros = db.pagos.filter((p) => p.lead_id === 21).map((p) => p.numero).sort((a, b) => Number(a) - Number(b));
    // La cuota se BORRA entre la lectura y la toma (la reconciliación de un plan): no es «ya estaba cobrada».
    ganchos.push({ cuando: (u, m) => m === 'PATCH' && u.pathname.endsWith('/pagos') && u.searchParams.get('id') === 'eq.49', antes: () => { db.pagos.splice(db.pagos.findIndex((p) => p.id === 49), 1); } });
    r.borradaEntera = await cobrarCuota(49, 22, { monto: 500, fecha: '2026-10-20' }).then((x) => x, (e) => String(e instanceof Error ? e.message : e));
    ganchos.push({ cuando: alRpc(23), antes: () => { db.pagos.splice(db.pagos.findIndex((p) => p.id === 50), 1); } });
    r.borradaMenos = await cobrarCuota(50, 23, { monto: 300, fecha: '2026-10-20', resto: 'pendiente' }).then((x) => x, (e) => String(e instanceof Error ? e.message : e));
    r.borradaMenosFilas = db.pagos.filter((p) => p.lead_id === 23).length;
    // Un monto que no llega a un centavo: no se cobra entero ni en 0.
    r.centavo = await cobrarCuota(51, 24, { monto: 0.004, fecha: '2026-10-20' }).then((x) => x, (e) => String(e instanceof Error ? e.message : e));
    r.centavoCuota = fila(51);

    // (revisión de 7524ec1c9, alta) «Armar el plan» y «Cambiar el plan» de la ficha (`ajustarPlanPagos` con `antes`), de
    // verdad, sobre lo que no es una cuota del plan. Lo impago (la deuda) y los vencimientos de las cuotas.
    const vacio = { cobro_inicial_usd: null, monto_cuota_usd: null, total_cuotas: null, dia_de_pago: null };
    const p5 = { cobro_inicial_usd: 1000, monto_cuota_usd: 1000, total_cuotas: 3, dia_de_pago: 5 };
    const impagas = (lead: number) => db.pagos.filter((p) => p.lead_id === lead && !p.pagado);
    const deuda = (lead: number) => impagas(lead).reduce((s, p) => s + Number(p.monto_usd), 0);
    const vencen = (lead: number) => impagas(lead).filter((p) => p.numero !== 0 && p.resto_de == null).map((p) => String(p.fecha_esperada)).sort();
    // 1) Una seña de US$100 cobrada por un link sin cuota: la fila nace cobrada, y no tapa la cuota 1.
    await registrarCobroDeProveedor({ leadId: 25, cobroId: 80, pagoId: null, proveedor: 'stripe', proveedorPagoId: 'pi_sena', montoUsd: 100, montoOriginal: 100, moneda: 'USD', fechaPago: '2026-10-05' });
    r.senaLinkFila = db.pagos.filter((p) => p.lead_id === 25).map((p) => ({ numero: p.numero, pagado: p.pagado, proveedor: p.proveedor, nacio_cobrada: p.nacio_cobrada }));
    await ajustarPlanPagos(25, p5, '2026-10-05', { antes: vacio });
    r.senaLinkArmado = deuda(25);
    const p1200 = { ...p5, monto_cuota_usd: 1200 };
    await ajustarPlanPagos(25, p1200, '2026-10-05', { antes: p5 });
    r.senaLink1200 = deuda(25);
    await ajustarPlanPagos(25, { ...p1200, dia_de_pago: 10 }, '2026-10-05', { antes: p1200 });
    r.senaLinkDia10 = { deuda: deuda(25), vencen: vencen(25) };
    // 2) La cuota 1 cobrada por 600 (quedan 400), el plan pasa a 4 cuotas y después al día 10: con un pago suelto antes
    //    (la regresión) y sin él (venía de antes).
    const p4 = { ...p5, total_cuotas: 4 };
    for (const lead of [26, 27]) {
      await ajustarPlanPagos(lead, p5, '2026-10-05', { antes: vacio });
      const cuota1 = impagas(lead).find((p) => p.fecha_esperada === '2026-11-05');
      await cobrarCuota(Number(cuota1?.id), lead, { monto: 600, fecha: '2026-11-05', resto: 'pendiente' });
      r[`resto${lead}Fila`] = impagas(lead).filter((p) => p.resto_de != null).map((p) => ({ monto_usd: p.monto_usd, fecha_esperada: p.fecha_esperada, resto_de: p.resto_de === cuota1?.id }));
      await ajustarPlanPagos(lead, p4, '2026-10-05', { antes: p5 });
      r[`resto${lead}Crecio`] = deuda(lead);
      await ajustarPlanPagos(lead, { ...p4, dia_de_pago: 10 }, '2026-10-05', { antes: p4 });
      r[`resto${lead}Dia10`] = { deuda: deuda(lead), vencen: vencen(lead) };
    }

    // (mig 0323) La cuota se edita de 500 a 400 entre la lectura y la toma: no se cobra por lo de antes.
    const editar = (id: number) => () => { Object.assign(db.pagos.find((p) => p.id === id) as Record<string, unknown>, { monto_usd: 400 }); };
    const filasDe = (lead: number) => db.pagos.filter((p) => p.lead_id === lead).map((p) => ({ pagado: p.pagado, monto_usd: p.monto_usd }));
    ganchos.push({ cuando: alRpc(28), antes: editar(53) });
    r.originalMenos = await cobrarCuota(53, 28, { monto: 300, fecha: '2026-10-20', resto: 'pendiente' }).then((x) => x, (e) => String(e instanceof Error ? e.message : e));
    r.originalMenosFilas = filasDe(28);
    ganchos.push({ cuando: (u, m) => m === 'PATCH' && u.pathname.endsWith('/pagos') && u.searchParams.get('id') === 'eq.54', antes: editar(54) });
    r.originalEntero = await cobrarCuota(54, 29, { fecha: '2026-10-20' }).then((x) => x, (e) => String(e instanceof Error ? e.message : e));
    r.originalEnteroFilas = filasDe(29);
    await cobrarCuota(55, 30, { monto: 300, fecha: '2026-10-20', resto: 'pendiente' });
    r.originalControl = filasDe(30);

    // (revisión de e19a5196f) Lo que se registra COMO la mensualidad lleva la marca; un pago, no.
    await registrarPagoSuelto(31, { monto: 1000, fecha: '2026-10-20', mensualidad: true });
    await registrarPagoSuelto(31, { monto: 300, fecha: '2026-10-20' });
    r.mensualidadFilas = db.pagos.filter((p) => p.lead_id === 31).map((p) => ({ monto_usd: p.monto_usd, pagado: p.pagado, es_mensualidad: p.es_mensualidad }));
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
