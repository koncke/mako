// =============================================================================
// Hijo de tests/api-mako-pagos-moneda.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/api-mako/areas/crm.run.ts lleva `server-only`: este archivo corre en un node aparte con
// `--conditions=react-server` y le contesta al test con un JSON (molde: tests/_plan-repriorizar-hijo.ts).
// Corre los runners REALES de `registrar_pago_suelto` y `marcar_pago_cobrado` —preparar() y ejecutar()—
// contra un PostgREST de mentira (tests/_postgrest-de-mentira.ts) con DOS negocios: lo que se prueba es lo que
// quedó escrito en `pagos` (moneda, monto original, concepto, método) y que un id de otro negocio no existe.
// Nada sale a la red: lo que no es la base se anota en `ia` y tiene que dar vacío.
// =============================================================================

import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

const TABLAS = ['workspaces', 'leads', 'pagos', 'lead_audit', 'app_settings', 'cobros', 'flujo_corridas', 'usuarios'] as const;
const ahoraIso = () => new Date().toISOString();
let siguienteId = 9000;
const pg = crearPostgrest({
  tablas: TABLAS,
  defaults: (tabla, f) => {
    if (tabla === 'pagos') return { id: siguienteId++, pagado: false, nacio_cobrada: false, created_at: ahoraIso(), ...f };
    if (tabla === 'lead_audit') return { id: siguienteId++, created_at: ahoraIso(), ...f };
    return { ...f };
  },
});

/** Lo que salió a la red y no fue a la base: tiene que ser nada. */
const ia: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  ia.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS_A = 3; // el negocio que opera
const WS_B = 9; // el otro: sus ids no existen para A

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { RUNNERS } = await import('../lib/api-mako/areas/crm.run');
  const db = pg.db;
  const out: Record<string, unknown> = {};

  const reset = (monedaNegocio: string | null = null) => {
    pg.vaciar(); ia.length = 0;
    db.workspaces.push({ id: WS_A, nombre: 'A', slug: 'a', estado: 'activo', capa: 'completo', created_at: ahoraIso() });
    db.workspaces.push({ id: WS_B, nombre: 'B', slug: 'b', estado: 'activo', capa: 'completo', created_at: ahoraIso() });
    db.leads.push({ id: 101, workspace_id: WS_A, nombre: 'Ana', estado_lead: 'activo', created_at: ahoraIso() });
    db.leads.push({ id: 202, workspace_id: WS_B, nombre: 'Berta', estado_lead: 'activo', created_at: ahoraIso() });
    db.pagos.push({ id: 7, workspace_id: WS_A, lead_id: 101, numero: 1, monto_usd: 500, fecha_esperada: '2026-10-20', pagado: false });
    db.pagos.push({ id: 8, workspace_id: WS_B, lead_id: 202, numero: 1, monto_usd: 900, fecha_esperada: '2026-10-20', pagado: false });
    if (monedaNegocio) db.app_settings.push({ workspace_id: WS_A, key: 'negocio.moneda', value: monedaNegocio });
  };
  const ctx = (ws: number) => ({ ws, canal: 'whatsapp' as const, canalKey: 'wa:prueba', alcance: 'ejecutar' as const, rol: 'admin' as const, actor: 'Martín' });
  type R = { preparar: (i: Record<string, unknown>, c: ReturnType<typeof ctx>) => Promise<Record<string, unknown>>; ejecutar: (p: Record<string, unknown>, c: ReturnType<typeof ctx>) => Promise<Record<string, unknown>> };
  const suelto = RUNNERS.registrar_pago_suelto as unknown as R;
  const marcar = RUNNERS.marcar_pago_cobrado as unknown as R;
  const enA = <T,>(fn: () => Promise<T>) => runWithWorkspace(WS_A, fn);
  const pagosDe = (lead: number): Fila[] => db.pagos.filter((p) => p.lead_id === lead).map((p) => structuredClone(p));
  const historial = (lead: number): string[] => db.lead_audit.filter((h) => h.lead_id === lead).map((h) => String(h.valor_nuevo ?? h.valor ?? ''));
  /** Corre preparar y, si dejó payload, ejecutar (lo que hace el «sí»). */
  const proponerYConfirmar = async (r: R, input: Record<string, unknown>) => {
    const prep = await enA(() => r.preparar(input, ctx(WS_A)));
    if ('error' in prep) return { prep, ejec: null };
    const ejec = await enA(() => r.ejecutar(prep.payload as Record<string, unknown>, ctx(WS_A)));
    return { prep, ejec };
  };

  // 1) UN PAGO EN PESOS: la moneda, lo cobrado, el concepto y el método quedan en la fila.
  {
    reset();
    const r = await proponerYConfirmar(suelto, { leadId: 101, montoUsd: 500, fechaPago: '2026-10-17', moneda: 'mxn', montoOriginal: 8600, concepto: 'Adelanto de octubre', metodo: 'transferencia' });
    const nuevo = pagosDe(101).find((p) => p.id !== 7);
    out.sueltoEnPesos = { prep: r.prep, ejec: r.ejec, fila: nuevo ?? null, lead: db.leads.find((l) => l.id === 101)?.total_cobrado_usd ?? null, historial: historial(101) };
  }
  // 2) SIN MONEDA en un negocio cuya moneda es ARS: va en dólares y el resumen LO DICE antes del «sí».
  {
    reset('ARS');
    const r = await proponerYConfirmar(suelto, { leadId: 101, montoUsd: 300, fechaPago: '2026-10-17' });
    const nuevo = pagosDe(101).find((p) => p.id !== 7);
    out.sueltoSinMonedaEnNegocioArs = { resumen: (r.prep as { resumen?: string }).resumen ?? null, fila: nuevo ?? null };
  }
  // 3) En un negocio en USD no hay aviso.
  {
    reset();
    const r = await enA(() => suelto.preparar({ leadId: 101, montoUsd: 300, fechaPago: '2026-10-17' }, ctx(WS_A)));
    out.sueltoEnUsd = { resumen: (r as { resumen?: string }).resumen ?? null };
  }
  // 4) LO QUE SE RECHAZA, sin escribir nada: pesos sin moneda, moneda sin monto, moneda inexistente.
  {
    reset();
    const sinMoneda = await enA(() => suelto.preparar({ leadId: 101, montoUsd: 500, montoOriginal: 500000, fechaPago: '2026-10-17' }, ctx(WS_A)));
    const sinOriginal = await enA(() => suelto.preparar({ leadId: 101, montoUsd: 500, moneda: 'ARS', fechaPago: '2026-10-17' }, ctx(WS_A)));
    const inexistente = await enA(() => suelto.preparar({ leadId: 101, montoUsd: 500, moneda: 'PESOS', montoOriginal: 5, fechaPago: '2026-10-17' }, ctx(WS_A)));
    out.rechazos = { sinMoneda, sinOriginal, inexistente, pagos: pagosDe(101).length };
  }
  // 5) COBRAR UNA CUOTA en pesos: la cuota queda cobrada con su moneda, y los dólares son los de la cuota.
  {
    reset();
    const r = await proponerYConfirmar(marcar, { pagoId: 7, leadId: 101, pagado: true, fechaPago: '2026-10-17', moneda: 'ARS', montoOriginal: 450000, metodo: 'efectivo' });
    out.cuotaEnPesos = { prep: r.prep, ejec: r.ejec, filas: pagosDe(101), historial: historial(101) };
  }
  // 6) SIN nada de eso, todo como siempre (el camino de marcarPago), y la moneda no se inventa.
  {
    reset();
    const r = await proponerYConfirmar(marcar, { pagoId: 7, leadId: 101, pagado: true, fechaPago: '2026-10-17' });
    out.cuotaComoSiempre = { ejec: r.ejec, filas: pagosDe(101) };
  }
  // 7) Una cuota cobrada por menos Y en otra moneda: la diferencia queda pendiente en dólares.
  {
    reset();
    const r = await proponerYConfirmar(marcar, { pagoId: 7, leadId: 101, pagado: true, fechaPago: '2026-10-17', montoUsd: 300, moneda: 'MXN', montoOriginal: 5400 });
    out.cuotaDeMenosEnPesos = { prep: r.prep, filas: pagosDe(101) };
  }
  // 8) DESMARCAR no lleva moneda; y los ids de OTRO negocio no existen.
  {
    reset();
    db.pagos.find((p) => p.id === 7)!.pagado = true;
    const conMoneda = await enA(() => marcar.preparar({ pagoId: 7, leadId: 101, pagado: false, moneda: 'ARS', montoOriginal: 5 }, ctx(WS_A)));
    const leadAjeno = await enA(() => marcar.preparar({ pagoId: 8, leadId: 202, pagado: true, fechaPago: '2026-10-17', moneda: 'ARS', montoOriginal: 5 }, ctx(WS_A)));
    const cuotaAjena = await enA(() => marcar.preparar({ pagoId: 8, leadId: 101, pagado: true, fechaPago: '2026-10-17' }, ctx(WS_A)));
    const sueltoAjeno = await enA(() => suelto.preparar({ leadId: 202, montoUsd: 100, fechaPago: '2026-10-17' }, ctx(WS_A)));
    out.ajenos = { conMoneda, leadAjeno, cuotaAjena, sueltoAjeno, pagosDeB: pagosDe(202) };
  }
  out.ia = [...ia];
  process.stdout.write(`\n@@JSON@@${JSON.stringify(out)}@@FIN@@\n`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
