// =============================================================================
// Hijo de tests/api-mako-plan-tramos.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre los runners REALES de `armar_plan_por_tramos` (área cobros) y `marcar_pago_cobrado` (área crm) —preparar() y
// ejecutar(), lo que hace el «sí»— contra un PostgREST de mentira (tests/_postgrest-de-mentira.ts), en un node aparte con
// `--conditions=react-server` (los runners traen `server-only`), con DOS negocios de prueba (el 3 y el 9; nunca el 1). El caso
// es el del ticket #26 (Mauricio, 29/10/2026): «7500 dólares en 3 pagos, primer pago 28 de octubre, segundo 28 de noviembre y
// tercero 28 de diciembre», sobre un lead GANADO sin monto ni cuotas. Imprime un JSON con lo que devolvió cada paso y lo que
// quedó en la base. Nada sale a la red: lo que no es la base se anota en `red` y tiene que dar vacío.
// =============================================================================

import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

const TABLAS = ['workspaces', 'leads', 'pagos', 'lead_audit', 'app_settings', 'cobros', 'flujo_corridas', 'usuarios', 'lead_funnel', 'funnels', 'mako_acciones_pendientes'] as const;
const ahoraIso = () => new Date().toISOString();
let siguienteId = 9000;
const pg = crearPostgrest({
  tablas: TABLAS,
  defaults: (tabla, f) => {
    if (tabla === 'pagos') return { id: siguienteId++, pagado: false, nacio_cobrada: false, resto_de: null, moneda: null, monto_original: null, created_at: ahoraIso(), ...f };
    if (tabla === 'lead_audit') return { id: siguienteId++, created_at: ahoraIso(), ...f };
    // Creada hace un minuto: el «sí» llega en otro mensaje (el candado anti auto-confirm de `confirmarPendiente`).
    if (tabla === 'mako_acciones_pendientes') return { id: siguienteId++, estado: 'pendiente', created_at: new Date(Date.now() - 60_000).toISOString(), ...f };
    return { ...f };
  },
  unicos: [{ tabla: 'pagos', columnas: ['lead_id', 'numero'], donde: () => true, nombre: 'pagos_lead_numero' }],
});

const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS_A = 3; // el negocio que opera (el de prueba)
const WS_B = 9; // otro: sus leads no existen para A

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const cobros = (await import('../lib/api-mako/areas/cobros.run')).RUNNERS;
  const crm = (await import('../lib/api-mako/areas/crm.run')).RUNNERS;
  const db = pg.db;
  const out: Record<string, unknown> = {};

  const reset = () => {
    pg.vaciar(); red.length = 0;
    db.workspaces.push({ id: WS_A, nombre: 'A', slug: 'a', estado: 'activo', capa: 'completo', created_at: ahoraIso() });
    db.workspaces.push({ id: WS_B, nombre: 'B', slug: 'b', estado: 'activo', capa: 'completo', created_at: ahoraIso() });
    db.app_settings.push({ workspace_id: WS_A, key: 'mako.timezone', value: 'America/Mexico_City', updated_at: '2026-10-01T00:00:00Z' });
    // Fernando Muñoz, como lo vio MaKo: «Quedó en Ganado con $0», sin monto de venta ni cuotas.
    db.leads.push({ id: 301, workspace_id: WS_A, nombre: 'Fernando Muñoz', estado_lead: 'ganado', venta_tipo: 'unico', monto_cierre_usd: null, cobro_inicial_usd: null, monto_cuota_usd: null, total_cuotas: null, dia_de_pago: null, fecha_cierre: '2026-10-28', funnel_id: null, created_at: ahoraIso() });
    db.leads.push({ id: 302, workspace_id: WS_A, nombre: 'Nadia', estado_lead: 'ganado', venta_tipo: 'suscripcion', suscripcion_monto_usd: 4235.29, funnel_id: null, created_at: ahoraIso() });
    db.leads.push({ id: 303, workspace_id: WS_A, nombre: 'Leo', estado_lead: 'ganado', venta_tipo: 'unico', monto_cierre_usd: 1500, cobro_inicial_usd: null, funnel_id: null, created_at: ahoraIso() });
    db.leads.push({ id: 304, workspace_id: WS_A, nombre: 'Mía', estado_lead: 'ganado', venta_tipo: 'unico', monto_cierre_usd: 1200, funnel_id: null, created_at: ahoraIso() });
    db.leads.push({ id: 401, workspace_id: WS_B, nombre: 'Berta', estado_lead: 'ganado', venta_tipo: 'unico', funnel_id: null, created_at: ahoraIso() });
    // Leo: 3 × US$500, la 3 con un link sin pagar.
    for (const [id, numero, fecha] of [[31, 1, '2026-11-10'], [32, 2, '2026-12-10'], [33, 3, '2027-01-10']] as const) {
      db.pagos.push({ id, workspace_id: WS_A, lead_id: 303, numero, monto_usd: 500, fecha_esperada: fecha, pagado: false, nacio_cobrada: false, resto_de: null, moneda: null, monto_original: null });
    }
    db.cobros.push({ id: 77, workspace_id: WS_A, lead_id: 303, pago_id: 33, estado: 'pendiente', monto: 500, moneda: 'USD' });
    // Mía: una cuota de un tramo en pesos, MXN 12.000 = US$600.
    db.pagos.push({ id: 41, workspace_id: WS_A, lead_id: 304, numero: 1, monto_usd: 600, fecha_esperada: '2026-11-01', pagado: false, nacio_cobrada: false, resto_de: null, moneda: 'MXN', monto_original: 12000 });
    // (revisión de 805afb460) Ana: el anticipo #0 ya cobrado (N4). Gus: la #1 cobrada, la #2 y la #3 con un link sin pagar (N2).
    db.leads.push({ id: 305, workspace_id: WS_A, nombre: 'Ana', estado_lead: 'ganado', venta_tipo: 'unico', monto_cierre_usd: 2000, cobro_inicial_usd: 1000, funnel_id: null, created_at: ahoraIso() });
    db.pagos.push({ id: 50, workspace_id: WS_A, lead_id: 305, numero: 0, monto_usd: 1000, fecha_esperada: '2026-10-01', pagado: true, fecha_pago: '2026-10-01', nacio_cobrada: false, resto_de: null, moneda: null, monto_original: null });
    db.leads.push({ id: 306, workspace_id: WS_A, nombre: 'Gus', estado_lead: 'ganado', venta_tipo: 'unico', monto_cierre_usd: 1500, cobro_inicial_usd: null, funnel_id: null, created_at: ahoraIso() });
    for (const [id, numero, fecha, pagado] of [[61, 1, '2026-11-10', true], [62, 2, '2026-12-10', false], [63, 3, '2027-01-10', false]] as const) {
      db.pagos.push({ id, workspace_id: WS_A, lead_id: 306, numero, monto_usd: 500, fecha_esperada: fecha, pagado, fecha_pago: pagado ? fecha : null, nacio_cobrada: false, resto_de: null, moneda: null, monto_original: null });
    }
    db.cobros.push({ id: 78, workspace_id: WS_A, lead_id: 306, pago_id: 63, estado: 'pendiente', monto: 500, moneda: 'USD' });
  };
  const ctx = (ws: number) => ({ ws, canal: 'app' as const, canalKey: 'app:prueba', alcance: 'proponer' as const, rol: 'admin' as const, actor: 'Mauricio' });
  type R = {
    preparar: (i: Record<string, unknown>, c: ReturnType<typeof ctx>) => Promise<Record<string, unknown>>;
    ejecutar: (p: Record<string, unknown>, c: ReturnType<typeof ctx>) => Promise<Record<string, unknown>>;
    faltaParaConfirmar?: (p: Record<string, unknown>, c: ReturnType<typeof ctx>) => Promise<string | { yaNoVale: string } | null>;
  };
  // Lo que contesta `faltaParaConfirmar`, en texto: «yaNoVale: …» es la que se cierra (revisión de 7f79a4e6c, B12).
  const dicho = (f: string | { yaNoVale: string } | null | undefined): string | null => (f && typeof f === 'object' ? `yaNoVale: ${f.yaNoVale}` : f ?? null);
  const armar = cobros.armar_plan_por_tramos as unknown as R;
  const marcar = crm.marcar_pago_cobrado as unknown as R;
  const enA = <T,>(fn: () => Promise<T>) => runWithWorkspace(WS_A, fn);
  const pagosDe = (lead: number): Fila[] => db.pagos.filter((p) => p.lead_id === lead).sort((a, b) => Number(a.numero) - Number(b.numero))
    .map((p) => ({ numero: p.numero, monto_usd: p.monto_usd, fecha_esperada: p.fecha_esperada, pagado: p.pagado, moneda: p.moneda ?? null, monto_original: p.monto_original ?? null }));
  const plan = (lead: number) => { const l = db.leads.find((x) => x.id === lead) ?? {}; return { cobro_inicial_usd: l.cobro_inicial_usd ?? null, monto_cuota_usd: l.monto_cuota_usd ?? null, total_cuotas: l.total_cuotas ?? null, dia_de_pago: l.dia_de_pago ?? null }; };
  const proponerYConfirmar = async (r: R, input: Record<string, unknown>) => {
    const prep = await enA(() => r.preparar(input, ctx(WS_A)));
    if ('error' in prep) return { prep, ejec: null };
    const ejec = await enA(() => r.ejecutar(prep.payload as Record<string, unknown>, ctx(WS_A)));
    return { prep, ejec };
  };
  const FERNANDO = { leadId: 301, primeraCuota: '2026-10-28', tramos: [{ monto: 2500, cuotas: 3, dia: 28 }] };

  // 1) El ticket #26: 3 cuotas de US$2.500, los 28 desde el 28/10.
  {
    reset();
    const r = await proponerYConfirmar(armar, FERNANDO);
    out.fernando = { prep: r.prep, ejec: r.ejec, pagos: pagosDe(301), plan: plan(301), historial: db.lead_audit.filter((h) => h.lead_id === 301).map((h) => `${h.campo}: ${h.valor_nuevo}`), red: [...red] };
    // 2) Lo mismo otra vez (otro «sí», otra pestaña): no cambia nada.
    const otra = await proponerYConfirmar(armar, FERNANDO);
    out.fernandoOtraVez = { ejec: otra.ejec, pagos: pagosDe(301) };
  }
  // 3) Una suscripción no se arma por acá sin pasarla a pago único; pesos sin dólares, tampoco; otro negocio no existe.
  {
    reset();
    const sus = await enA(() => armar.preparar({ leadId: 302, primeraCuota: '2026-11-01', tramos: [{ monto: 300, cada: 'quincena', dia: 1, dia2: 15, cuotas: 24 }] }, ctx(WS_A)));
    const pesos = await enA(() => armar.preparar({ leadId: 301, primeraCuota: '2026-11-01', tramos: [{ monto: 12000, moneda: 'MXN', cuotas: 6 }] }, ctx(WS_A)));
    const ajeno = await enA(() => armar.preparar({ ...FERNANDO, leadId: 401 }, ctx(WS_A)));
    out.rechazos = { sus, pesos, ajeno, pagos: db.pagos.filter((p) => p.lead_id === 301 || p.lead_id === 302 || p.lead_id === 401).length };
  }
  // 4) Dos tramos en pesos («6 meses de 12.000 y luego 10.000») con anticipo en dólares.
  {
    reset();
    const r = await proponerYConfirmar(armar, {
      leadId: 301, primeraCuota: '2026-11-01', anticipo: 1000, anticipoFecha: '2026-10-29',
      tramos: [{ monto: 12000, moneda: 'MXN', montoUsd: 600, cuotas: 6, dia: 1 }, { monto: 10000, moneda: 'MXN', montoUsd: 500, cuotas: 6, dia: 1 }],
    });
    out.pesos = { prep: r.prep, ejec: r.ejec, pagos: pagosDe(301), plan: plan(301) };
  }
  // 5) Acortar a 2 el plan de Leo: la cuota con el link sin pagar no se borra; toma el lugar de una sin proteger.
  {
    reset();
    const r = await proponerYConfirmar(armar, { leadId: 303, primeraCuota: '2026-11-10', tramos: [{ monto: 500, cuotas: 2, dia: 10 }] });
    out.conLink = { prep: r.prep, ejec: r.ejec, pagos: db.pagos.filter((p) => p.lead_id === 303).map((p) => ({ id: p.id, monto_usd: p.monto_usd, fecha_esperada: p.fecha_esperada })) };
  }
  // 6) A1 en el server: cobrar a medias por la API una cuota en pesos, sin los dólares (como la manda MaKo). Antes, lo que MaKo
  //    lee de esa cuota sin cobrar: lo pactado en pesos, no algo que «entró».
  {
    reset();
    const leer = (crm.cobranza_lead as unknown as { leer: (i: Record<string, unknown>, c: ReturnType<typeof ctx>) => Promise<unknown> }).leer;
    const cobranza = await enA(() => leer({ leadId: 304 }, ctx(WS_A))).catch((e) => ({ error: String(e) }));
    out.cobranzaMia = cobranza;
    const r = await proponerYConfirmar(marcar, { pagoId: 41, leadId: 304, pagado: true, fechaPago: '2026-10-29', moneda: 'MXN', montoOriginal: 6000 });
    out.aMedias = { prep: r.prep, ejec: r.ejec, pagos: pagosDe(304) };
  }
  // 7) N1: MaKo propone el plan de Fernando (sin cuotas); antes del «sí», alguien arma en la ficha 6 × US$1.000. Y la variante: en
  //    Leo, se cobra la #2 entre la propuesta y el «sí». El «sí» no pisa nada y lo dice; sin cambios, pasa.
  {
    reset();
    const prep = await enA(() => armar.preparar(FERNANDO, ctx(WS_A)));
    const payload = prep.payload as Record<string, unknown>;
    const sinCambios = dicho(await enA(() => armar.faltaParaConfirmar?.(payload, ctx(WS_A)) ?? Promise.resolve('sin faltaParaConfirmar')));
    for (let i = 0; i < 6; i++) db.pagos.push({ id: 501 + i, workspace_id: WS_A, lead_id: 301, numero: i + 1, monto_usd: 1000, fecha_esperada: `2026-1${1 + Math.min(i, 1)}-0${1 + i}`, pagado: false, nacio_cobrada: false, resto_de: null, moneda: null, monto_original: null });
    const falta = dicho(await enA(() => armar.faltaParaConfirmar?.(payload, ctx(WS_A)) ?? Promise.resolve(null)));
    const ejec = await enA(() => armar.ejecutar(payload, ctx(WS_A)));
    const leo = await enA(() => armar.preparar({ leadId: 303, primeraCuota: '2026-11-10', tramos: [{ monto: 600, cuotas: 3, dia: 10 }] }, ctx(WS_A)));
    const c32 = db.pagos.find((p) => p.id === 32) as Fila;
    Object.assign(c32, { pagado: true, fecha_pago: '2026-10-29' });
    const faltaLeo = dicho(await enA(() => armar.faltaParaConfirmar?.(leo.payload as Record<string, unknown>, ctx(WS_A)) ?? Promise.resolve(null)));
    out.siViejo = { vistas: payload.vistas ?? null, sinCambios, falta, ejec, pagos: pagosDe(301), faltaLeo };
  }
  // 8) N2: Gus tiene la #1 cobrada (US$500) y la #3 con un link sin pagar; se pide 3 × US$700. La propuesta dice lo que QUEDA.
  {
    reset();
    const r = await proponerYConfirmar(armar, { leadId: 306, primeraCuota: '2026-11-10', tramos: [{ monto: 700, cuotas: 3, dia: 10 }] });
    out.queda = { prep: r.prep, ejec: r.ejec, pagos: pagosDe(306) };
  }
  // 9) N4: Ana tiene el anticipo cobrado; pedir otro no se promete. B6: dos «sí» a la vez sobre Fernando.
  {
    reset();
    const ana = await enA(() => armar.preparar({ leadId: 305, primeraCuota: '2026-11-10', tramos: [{ monto: 500, cuotas: 2, dia: 10 }], anticipo: 800 }, ctx(WS_A)));
    const prep = await enA(() => armar.preparar(FERNANDO, ctx(WS_A)));
    const dos = await Promise.all([1, 2].map(() => enA(() => armar.ejecutar(prep.payload as Record<string, unknown>, ctx(WS_A)))));
    out.anticipoCobrado = ana;
    out.dosSi = { dos, pagos: pagosDe(301) };
  }
  // 10) La re-verificación de 7f79a4e6c. B8: entre la propuesta y el «sí», la #2 de Leo pasa en la ficha a MXN 18.000 / US$900,
  //     con el mismo id. B9: una propuesta sin las vistas con su firma (la de 805afb460 no las tenía; la de 7f79a4e6c, sin firma).
  {
    reset();
    const LEO = { leadId: 303, primeraCuota: '2026-11-10', tramos: [{ monto: 600, cuotas: 3, dia: 10 }] };
    const payload = (await enA(() => armar.preparar(LEO, ctx(WS_A)))).payload as Record<string, unknown>;
    Object.assign(db.pagos.find((p) => p.id === 32) as Fila, { monto_usd: 900, moneda: 'MXN', monto_original: 18000 });
    const falta = dicho(await enA(() => armar.faltaParaConfirmar!(payload, ctx(WS_A))));
    const ejec = await enA(() => armar.ejecutar(payload, ctx(WS_A)));
    out.firma = { vistas: payload.vistas, falta, ejec, pagos: pagosDe(303) };
    reset();
    const viejo = (await enA(() => armar.preparar(LEO, ctx(WS_A)))).payload as Record<string, unknown>;
    const deAntes = [];
    for (const vistas of [undefined, [31, 32, 33]]) {
      const p = { ...viejo, vistas };
      deAntes.push({ falta: dicho(await enA(() => armar.faltaParaConfirmar!(p, ctx(WS_A)))), ejec: await enA(() => armar.ejecutar(p, ctx(WS_A))) });
    }
    out.deAntes = { casos: deAntes, pagos: pagosDe(303) };
  }
  // 11) B10: Carla tiene el #0 COBRADO con la columna `cobro_inicial_usd` vacía, y pide un anticipo. B11: Leo tiene la #1 cobrada a
  //     medias (US$250) y su diferencia, la #4, aparte; pide 3 × US$500.
  {
    reset();
    db.leads.push({ id: 307, workspace_id: WS_A, nombre: 'Carla', estado_lead: 'ganado', venta_tipo: 'unico', monto_cierre_usd: 2000, cobro_inicial_usd: null, funnel_id: null, created_at: ahoraIso() });
    for (const [id, numero, monto, fecha, pagado] of [[70, 0, 1000, '2026-10-01', true], [71, 1, 500, '2026-11-10', false], [72, 2, 500, '2026-12-10', false]] as const) {
      db.pagos.push({ id, workspace_id: WS_A, lead_id: 307, numero, monto_usd: monto, fecha_esperada: fecha, pagado, fecha_pago: pagado ? fecha : null, nacio_cobrada: false, resto_de: null, moneda: null, monto_original: null });
    }
    out.carla = await enA(() => armar.preparar({ leadId: 307, primeraCuota: '2026-11-10', tramos: [{ monto: 500, cuotas: 2, dia: 10 }], anticipo: 800 }, ctx(WS_A)));
    reset();
    db.cobros.splice(0);
    Object.assign(db.pagos.find((p) => p.id === 31) as Fila, { pagado: true, fecha_pago: '2026-10-20', monto_usd: 250 });
    db.pagos.push({ id: 34, workspace_id: WS_A, lead_id: 303, numero: 4, monto_usd: 250, fecha_esperada: '2026-11-10', pagado: false, nacio_cobrada: false, resto_de: 31, moneda: null, monto_original: null });
    out.aparte = await enA(() => armar.preparar({ leadId: 303, primeraCuota: '2026-11-10', tramos: [{ monto: 500, cuotas: 3, dia: 10 }] }, ctx(WS_A)));
  }
  // 12) B12, por WhatsApp de punta a punta (`ejecutarOperacion` y `confirmarPendiente`): el «sí» a la propuesta de Fernando llega
  //     después de que se cargó una cuota en la ficha; se pide de nuevo, y el «sí» pelado siguiente no choca con la vieja.
  {
    reset();
    const { ejecutarOperacion } = await import('../lib/api-mako/ejecutar');
    const { confirmarPendiente } = await import('../lib/api-mako/acciones');
    const ctxWa = { ws: WS_A, canal: 'whatsapp' as const, canalKey: 'wa:5215500000000', alcance: 'ejecutar' as const, rol: 'admin' as const, actor: 'Mauricio', mensajeUsuario: 'sí' };
    await enA(() => ejecutarOperacion('armar_plan_por_tramos', FERNANDO, ctxWa as never, 'json'));
    db.pagos.push({ id: 601, workspace_id: WS_A, lead_id: 301, numero: 1, monto_usd: 1000, fecha_esperada: '2026-11-05', pagado: false, nacio_cobrada: false, resto_de: null, moneda: null, monto_original: null });
    const viejo = await enA(() => confirmarPendiente(ctxWa as never, null));
    await enA(() => ejecutarOperacion('armar_plan_por_tramos', FERNANDO, ctxWa as never, 'json'));
    const nuevo = await enA(() => confirmarPendiente(ctxWa as never, null));
    out.cerrada = { viejo, nuevo, estados: db.mako_acciones_pendientes.map((p) => p.estado), pagos: pagosDe(301) };
  }
  out.red = red;
  process.stdout.write(JSON.stringify(out));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
