// =============================================================================
// Hijo de tests/admin-ingresos-libro.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Admin › Revenue con el libro de la mensualidad de las agencias, sobre un PostgREST de mentira. Corre REAL lib/admin-ingresos.ts
// (`vistaDeIngresos`), con sus lecturas de verdad: los pagos y los leads del CRM de la plataforma, los cobros, el libro en
// `app_settings`, los cobros de los recibos (`recibo_pagos`), la historia de las suscripciones. Nada va de mentira salvo la base.
// Imprime el resultado de cada escena después de `@@RESULTADO@@`. Necesita `--conditions=react-server`.
//
// Los nombres son de mentira (AGENTS.md: nada de datos reales en tests/). Los montos, las fechas y la orden, los medidos el 10/11.

import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

process.env.SUPABASE_URL = 'https://supa.test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
process.env.SUPABASE_SERVICE_KEY = 'clave-de-prueba';

const pg = crearPostgrest({
  tablas: ['workspaces', 'pagos', 'leads', 'cobros', 'app_settings', 'recibo_pagos', 'lead_funnel', 'funnels', 'suscripcion_movimientos'],
});
const db = pg.db;
const PLATAFORMA = 9;
const AGENCIA = 13;
const CLIENTE = 22;
const ORDEN_ENTRADA = '464765031875870720';
db.workspaces = [
  { id: PLATAFORMA, nombre: 'Plataforma', capa: 'superadmin', estado: 'activo' },
  { id: AGENCIA, nombre: 'Agencia Norte', capa: 'agencia', estado: 'activo' },
  { id: CLIENTE, nombre: 'Cliente Sur', capa: 'completo', estado: 'activo' },
];
// La ficha de la agencia en el CRM de la plataforma, y su mensualidad cargada a mano hasta noviembre (#115, #135, #136).
db.leads = [{ id: 1, workspace_id: PLATAFORMA, nombre: 'Juan Ejemplo', empresa: null, email: null, cliente_ws: AGENCIA, venta_tipo: null, estado_lead: 'ganado', fecha_cierre: '2026-10-20', monto_cierre_usd: null, suscripcion_monto_usd: null, suscripcion_meses: null, suscripcion_cancelada_at: null, funnel_id: null }];
const pagoCrm = (id: number, fecha: string, usd: number, mensualidad = true): Fila => ({
  id, workspace_id: PLATAFORMA, lead_id: 1, funnel_id: null, monto_usd: usd, fecha_pago: fecha, fecha_esperada: fecha, pagado: true, numero: id,
  es_mensualidad: mensualidad, nacio_cobrada: true, resto_de: null, metodo: 'cripto', proveedor: null, cobro_id: null, concepto: null, proveedor_pago_id: null,
});
const PAGOS_CRM = [pagoCrm(115, '2026-10-20', 146), pagoCrm(135, '2026-11-03', 94), pagoCrm(136, '2026-11-04', 144)];
const libro = (k: string, v: unknown): Fila => ({ workspace_id: PLATAFORMA, key: `agencia.mensualidad.${AGENCIA}.${k}`, value: JSON.stringify(v) });
const orden = (num: string, montoUsd: number, fecha: string, aplicado: Array<{ clave: string; montoUsd: number }>): Fila =>
  libro(`orden.${num}`, { orden: num, monto: montoUsd, moneda: 'USDT', montoUsd, fecha, comprobante: null, aplicado });
// La entrada de la cliente: 40 USDT recibidos por los 40,73 que se debían (lib/agencia-mes.ts → marcarEntradaPagada).
const LIBRO_NOVIEMBRE = [
  libro('config', { desde: '2026-12', entradasDesde: '2026-11-06', medio: 'Binance', prendidaPor: 'super', prendidaAt: '2026-11-06T12:00:00Z' }),
  orden(ORDEN_ENTRADA, 40, '2026-11-09T14:20:00', [{ clave: `entrada:${CLIENTE}`, montoUsd: 40.73 }]),
  libro(`entrada.${CLIENTE}`, { ws: CLIENTE, desde: '2026-11-09', montoUsd: 40.73, pagadoUsd: 40.73, pagadoEl: '2026-11-09', ordenes: [ORDEN_ENTRADA], marcadoPor: 'super', recibo: true }),
  libro('aviso.2026-11', { at: '2026-11-01T12:00:00Z', totalUsd: 238 }),
  // Una fila que no es del libro: no tiene que entrar.
  { workspace_id: PLATAFORMA, key: 'mako.timezone', value: 'America/Argentina/Buenos_Aires' },
];
// Diciembre: la mensualidad ya la lleva el libro, pagada en DOS partes con 9 días entre ellas (150 el 3/12 y 150 el 12/12): el
// MRR es el del mes (300), no el de la última parte.
const LIBRO_DICIEMBRE = [
  orden('555555555555555555', 150, '2026-12-03T10:00:00', [{ clave: 'mes:2026-12', montoUsd: 150 }]),
  orden('555555555555555556', 150, '2026-12-12T10:00:00', [{ clave: 'mes:2026-12', montoUsd: 150 }]),
  libro('pago.2026-12', { mes: '2026-12', pagadoEl: '2026-12-12', totalUsd: 300, pagadoUsd: 300, ordenes: ['555555555555555555', '555555555555555556'] }),
];

/** Lo que falla a propósito en cada escena: la lectura del libro o la de los recibos (un 500 de verdad, no una tabla vacía). */
let falla: 'libro' | 'recibos' | null = null;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host !== 'supa.test') throw new Error(`fetch sin mock: ${u.href}`);
  const tabla = u.pathname.replace('/rest/v1/', '');
  const esLibro = tabla === 'app_settings' && (u.searchParams.get('key') ?? '').startsWith('like.agencia.mensualidad.');
  if ((falla === 'libro' && esLibro) || (falla === 'recibos' && tabla === 'recibo_pagos')) {
    return new Response(JSON.stringify({ code: '57014', message: 'canceling statement due to statement timeout' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
  return pg.responder(u, init);
}) as typeof fetch;

// Sin `await` de primer nivel: tsx compila este archivo a CommonJS.
async function main(): Promise<void> {
  const { vistaDeIngresos } = await import('../lib/admin-ingresos');

  const escena = async (hoy: string) => {
    const v = await vistaDeIngresos(new Date(`${hoy}T15:00:00Z`));
    return {
      mrr: v.mrr, cobradoEsteMes: v.cobradoEsteMes, cobradoTotal: v.cobradoTotal, avisos: v.avisos,
      clientes: v.clientes.map((c) => ({ clave: c.clave, nombre: c.nombre, ws: c.ws, leadId: c.leadId, total: c.total, mrr: c.mrr, estado: c.estado })),
      entradas: v.entradas, movimientos: v.movimientos, porCobrar: v.porCobrar,
    };
  };

  const R: Record<string, unknown> = {};
  const reset = () => {
    db.pagos = PAGOS_CRM.map((p) => ({ ...p }));
    db.app_settings = LIBRO_NOVIEMBRE.map((f) => ({ ...f }));
    db.recibo_pagos = [];
    falla = null;
  };

  // 1. Noviembre: la entrada de la cliente aparece sola.
  reset();
  R.noviembre = await escena('2026-11-10');
  // Lee sin escribir: ni un pago nuevo en el CRM ni una fila del libro tocada.
  R.noEscribio = { pagos: db.pagos.length, libroIgual: JSON.stringify(db.app_settings) === JSON.stringify(LIBRO_NOVIEMBRE) };
  // 2. La misma orden, atada a un pago del CRM por «Cargar pago» (mig 0408): una sola vez.
  reset();
  db.pagos.push({ ...pagoCrm(200, '2026-11-09', 40, false), concepto: 'Recibo N.º 0003: Entrada' });
  db.recibo_pagos = [{ id: 1, recibo_id: 3, medio: 'binance', referencia: ORDEN_ENTRADA, fecha: '2026-11-09T14:20:00Z', monto: 40, moneda: 'USDT', monto_usd: 40, anulado: false, pago_id: 200 }];
  R.atada = await escena('2026-11-10');
  // 3. El recibo de la orden existe pero no está atado a un pago (lo normal en el libro): cuenta el libro.
  reset();
  db.recibo_pagos = [{ id: 1, recibo_id: 3, medio: 'binance', referencia: ORDEN_ENTRADA, fecha: '2026-11-09T14:20:00Z', monto: 40, moneda: 'USDT', monto_usd: 40, anulado: false, pago_id: null }];
  R.reciboSinAtar = await escena('2026-11-10');
  // 4. El libro no se puede leer: aviso, no un cero escondido.
  reset();
  falla = 'libro';
  R.libroCaido = await escena('2026-11-10');
  // 5. No se sabe qué órdenes están en el CRM: tampoco se cuenta el libro, y se dice.
  reset();
  falla = 'recibos';
  R.recibosCaidos = await escena('2026-11-10');
  // 6. Diciembre: el mes pagado por el libro es el MRR, y la mensualidad del CRM no se cuenta dos veces.
  reset();
  db.app_settings.push(...LIBRO_DICIEMBRE.map((f) => ({ ...f })));
  R.diciembre = await escena('2026-12-14');

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(R)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
