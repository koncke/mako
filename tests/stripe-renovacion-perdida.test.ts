// =============================================================================
// La renovación de Stripe cuyo aviso se perdió la asienta el cron (6/11/2026)
// =============================================================================
// EL HUECO (docs/relevo/pendientes-barrido.md): el mes 2 en adelante de una suscripción entra SÓLO por su `invoice.paid`, y
// `reconciliarCobros` mira la sesión del checkout, que ya está pagada. Si ese aviso se perdía, la plata entraba en Stripe y MaKo
// no asentaba la cuota: ni la ganancia del partner (el 2º mes), ni la cuota que mira el corte por falta de pago.
//
// LO QUE SE CUIDA ACÁ (`renovacionesQueFaltan`, lib/cobros-eventos.ts, y `renovacionesPerdidasStripe`, lib/cobros.ts):
//   · sólo los CICLOS: la primera factura (`subscription_create`) nunca es una renovación;
//   · ni el primer pago del cobro ni una que ya tiene cuota (la vuelta de cada día no repite);
//   · ni una de otro cobro u otra suscripción; ni una en cero;
//   · ni una de hace menos de 4 días (Stripe reintenta su aviso 3); las de hace más de 14, a un ticket, no solas;
//   · ni una sin valor en dólares (el CRM no la asienta nunca: no es una renovación perdida);
//   · con el mismo id que el aviso, y sólo cobros CON LEAD (su cuota es lo que dice «ya está»).
//
// PROBADO ROMPIÉNDOLO (base 5 / 0), una por vez, restaurando:
//   · sin el corte de `subscription_cycle` (la primera factura entraría como renovación)   → 4 / 1
//   · sin mirar `conocidas` (cada vuelta repetiría la cuota y el aviso)                    → 4 / 1
//   · sin el margen                                                                         → 4 / 1
//   · sin el tope de 14 días (un pago viejo dispararía el CRON «Pagos» hoy)                 → 4 / 1
//   · el cron sin `.not('lead_id', 'is', null)`                                             → 4 / 1
//   · el cron sin llamarla en la vuelta del día                                             → 4 / 1
//   · (la revisión) sin el corte de valor en dólares                                        → 4 / 1
//   · (la revisión) el margen otra vez en 2 h                                               → 4 / 1
//   · (la revisión) sin rotar el arranque por día                                           → 4 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renovacionesQueFaltan, MARGEN_AVISO_RENOVACION_MS, MAX_EDAD_RENOVACION_MS } from '../lib/cobros-eventos';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

const TOKEN = 'TokenDelCobroDeMaKo0123456789abc';
const AHORA = Date.parse('2026-11-06T12:00:00Z');
const DIA = 86_400_000;
const hace = (ms: number) => new Date(AHORA - ms).toISOString();

/** Una factura como la deja `facturasPagadasStripe` (lib/stripe-api.ts). */
const f = (id: string, p: { motivo?: string; monto?: number; hace: number; token?: string; sub?: string }) => ({
  id, estado: 'paid', montoPagado: p.monto ?? 97, moneda: 'USD', motivo: p.motivo ?? 'subscription_cycle',
  suscripcion: p.sub ?? 'sub_1', metadata: { mako_cobro: p.token ?? TOKEN }, pagadoAt: hace(p.hace),
});
const COBRO_USD = { monto_usd: 97, monto: 97, moneda: 'USD' };
const base = { token: TOKEN, suscripcion: 'sub_1', primera: 'in_mes1', conocidas: new Set<string>(['in_mes1']), ahoraMs: AHORA, cobro: COBRO_USD };

test('asienta el ciclo que falta, de la más vieja a la más nueva, con el id de la factura', () => {
  // Stripe las da de la más nueva a la más vieja.
  const facturas = [f('in_mes3', { hace: 5 * DIA }), f('in_mes2', { hace: 8 * DIA }), f('in_mes1', { motivo: 'subscription_create', hace: 38 * DIA })];
  const r = renovacionesQueFaltan(facturas, base);
  assert.deepEqual(r.asentar.map((x) => x.proveedorPagoId), ['in_mes2', 'in_mes3']);
  assert.deepEqual(r.asentar[0], { proveedorPagoId: 'in_mes2', monto: 97, moneda: 'USD', suscripcionId: 'sub_1', pagadoAt: hace(8 * DIA) });
  assert.deepEqual(r.viejas, []);
});

test('no repite ni inventa: la primera, las que ya tienen cuota, otra suscripción, otro cobro, en cero', () => {
  const r = renovacionesQueFaltan([
    f('in_ya', { hace: 6 * DIA }),
    f('in_otra_sub', { hace: 6 * DIA, sub: 'sub_vieja' }),
    f('in_otro_cobro', { hace: 6 * DIA, token: 'OtroCobroDeMaKo0123456789abcdefg' }),
    f('in_cero', { hace: 6 * DIA, monto: 0 }),
    // Un cobro viejo que guardó otro id para su primer pago: la factura de la creación no es una renovación.
    f('in_creacion', { hace: 6 * DIA, motivo: 'subscription_create' }),
  ], { ...base, primera: 'cs_sesion_vieja', conocidas: new Set(['cs_sesion_vieja', 'in_ya']) });
  assert.deepEqual(r.asentar, []);
  // Y en una prueba, el primer pago (el día 8) ES un ciclo: no se cuenta como renovación.
  assert.deepEqual(renovacionesQueFaltan([f('in_dia8', { hace: 6 * DIA })], { ...base, primera: 'in_dia8', conocidas: new Set() }).asentar, []);
});

// La revisión del 6/11/2026: una venta externa en pesos nace sin valor en dólares, el CRM no le escribe la cuota y la «renovación
// perdida» se volvía a aplicar cada día, con un ticket falso al final.
test('sin valor en dólares no hay cuota: ni se asienta ni va al ticket', () => {
  const pesos = { ...base, cobro: { monto_usd: null, monto: 1500, moneda: 'MXN' } };
  const mxn = (id: string, hace: number) => ({ ...f(id, { hace }), moneda: 'MXN', montoPagado: 1500 });
  const r = renovacionesQueFaltan([mxn('in_mxn', 6 * DIA), mxn('in_mxn_vieja', 30 * DIA)], pesos);
  assert.deepEqual(r, { asentar: [], viejas: [] });
  // Con su valor en dólares declarado (y la misma moneda), sí.
  const conUsd = renovacionesQueFaltan([mxn('in_mxn', 6 * DIA)], { ...base, cobro: { monto_usd: 80, monto: 1500, moneda: 'MXN' } });
  assert.deepEqual(conUsd.asentar.map((x) => x.proveedorPagoId), ['in_mxn']);
});

test('el tiempo: mientras Stripe reintenta su aviso (3 días) se espera; una de hace más de 14 días va a un ticket, no sola', () => {
  assert.ok(MARGEN_AVISO_RENOVACION_MS > 3 * DIA, 'Stripe reintenta un aviso hasta 3 días: si el cron la asienta antes, el reintento la repite');
  const r = renovacionesQueFaltan([
    f('in_recien', { hace: MARGEN_AVISO_RENOVACION_MS - 60_000 }),
    f('in_vieja', { hace: MAX_EDAD_RENOVACION_MS + DIA }),
    f('in_justa', { hace: MARGEN_AVISO_RENOVACION_MS + 60_000 }),
  ], base);
  assert.deepEqual(r.asentar.map((x) => x.proveedorPagoId), ['in_justa']);
  assert.deepEqual(r.viejas, ['in_vieja']);
});

test('CABLEADO: sólo cobros con lead, con la regla y el camino del aviso, una vez por día', () => {
  const cobros = fuente('lib/cobros.ts');
  const i = cobros.indexOf('export async function renovacionesPerdidasStripe(');
  const fn = cobros.slice(i, cobros.indexOf('\n}\n', i));
  assert.ok(i > 0 && fn.length > 1500, 'encontré renovacionesPerdidasStripe');
  assert.match(fn, /eq: \{ workspace_id: ws, proveedor: 'stripe', tipo: 'suscripcion', suscripcion_estado: 'activa' \}/);
  assert.match(fn, /q\.in\('estado', \['pagado', 'reembolsado'\]\)\.not\('lead_id', 'is', null\)\.not\('proveedor_suscripcion_id', 'is', null\)/, 'sin lead no hay cuota que diga «ya está»');
  assert.doesNotMatch(fn, /\.limit\(/, 'un tope antes del filtro deja sin mirar a las más nuevas');
  assert.match(fn, /leerTodo<[^>]+>\(\s*db, 'pagos'/, 'las cuotas se leen enteras (más de 1000 filas no da error: corta)');
  assert.match(fn, /const giro = tocan\.length \? Math\.floor\(ahoraMs \/ 86_400_000\) % tocan\.length : 0;/, 'cada día se arranca por otra');
  assert.match(fn, /primera: c\.proveedor_pago_id,\s*conocidas: deCadaUno\.get\(c\.id\)\?\.ids \?\? new Set<string>\(\), ahoraMs, cobro: c,/);
  assert.match(fn, /for \(const f of viejas\) await avisarRenovacionVieja\(ws, c, f\);/);
  assert.match(fn, /for \(const r of asentar\) \{\s*const x = await aplicarPagoAprobado\(c, r\);/);
  const cron = fuente('app/api/cron/cobros-reconciliar/route.ts');
  assert.match(cron, /if \(delDia\) await runWithWorkspace\(ws, \(\) => renovacionesPerdidasStripe\(ws, \{ hasta: /);
});
