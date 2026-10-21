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

const pg = crearPostgrest({ tablas: ['pagos', 'leads', 'app_settings', 'workspaces'] });
const escrituras: string[] = [];
const red: string[] = [];

/** La barrera: retiene la lectura de la cuota `id` hasta que llegaron `n`. */
const barreras = new Map<string, { faltan: number; esperando: Array<() => void> }>();
const barrera = (id: number, n: number) => barreras.set(`eq.${id}`, { faltan: n, esperando: [] });

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
    return pg.responder(u, init);
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
  const { marcarPago, cobrarCuota } = await import('../lib/pagos');
  const db = pg.db;
  db.workspaces.push({ id: WS, nombre: 'Prueba' });
  db.app_settings.push({ workspace_id: WS, key: 'mako.timezone', value: 'America/Mexico_City', updated_at: '2026-10-01T00:00:00Z' });
  db.leads.push(
    { id: 7, workspace_id: WS, nombre: 'Ana', monto_cierre_usd: 1500, total_cobrado_usd: 500 },
    { id: 8, workspace_id: WS, nombre: 'Beto', monto_cierre_usd: 500, total_cobrado_usd: null },
    { id: 9, workspace_id: WS, nombre: 'Caro', monto_cierre_usd: 500, total_cobrado_usd: null },
  );
  db.pagos.push(
    cuota(10, { pagado: true, fecha_pago: '2026-10-01' }), // ya cobrada el 1/10
    cuota(11, { nacio_cobrada: true }), // un pago suelto que alguien ya desmarcó
    cuota(12, {}), // impaga: se cobra sin fecha
    cuota(20, { lead_id: 8, numero: 1 }), // la carrera de `marcarPago`
    cuota(21, { lead_id: 9, numero: 1 }), // la carrera de `cobrarCuota`
  );
  const fila = (id: number) => {
    const f = db.pagos.find((p) => p.id === id);
    return f ? { pagado: f.pagado, fecha_pago: f.fecha_pago, monto_usd: f.monto_usd, moneda: f.moneda, monto_original: f.monto_original } : null;
  };

  const r: Record<string, unknown> = {};
  await runWithWorkspace(WS, async () => {
    let antes = escrituras.length;
    r.remarcar = await marcarPago(10, true, '2026-10-20');
    r.remarcarEscrituras = escrituras.length - antes;
    antes = escrituras.length;
    r.redesmarcar = await marcarPago(11, false, null);
    r.redesmarcarEscrituras = escrituras.length - antes;
    antes = escrituras.length;
    r.recobrar = await cobrarCuota(10, 7, { monto: 300, fecha: '2026-10-20', moneda: 'MXN', montoOriginal: 5100 });
    r.recobrarEscrituras = escrituras.length - antes;
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
