// =============================================================================
// «Clientes por cobrar» también lista las SUSCRIPCIONES (20/10/2026) — EJECUTADO y cableado
// =============================================================================
// Martín, llamada con Leila del 19/10 (docs/investigacion-ops-center-19-10.md): el bloque leía sólo las cuotas impagas,
// y una suscripción no genera cuotas. La regla es la de toda la app (`cobradoDelLead`), en
// lib/suscripciones-por-cobrar.ts: un mes manual sin registrar, una renovación rechazada, o la próxima mensualidad manual
// dentro de la ventana. Una de la pasarela al día no aparece (se cobra sola). El Outstanding no cambia.
//
// PROBADO ROMPIÉNDOLO (20/10/2026), una rotura por vez con un script que reemplaza, corre y restaura byte a byte. Con
// el código como está: 8 pases, 0 fallos. Rota (pases / fallos):
//   · la suscripción de la pasarela al día también aparece (cobrarle lo que se cobra solo)       → 7 / 1
//   · el primer mes sin registrar contado desde el cierre y no desde las cobradas                → 6 / 2
//   · `armarCobranza` sin el vencimiento de la suscripción (la fila sin días ni orden)           → 7 / 1
//   · General vuelve a dejar afuera las filas sin cuota                                           → 7 / 1
//   · la lista del Dashboard sin las suscripciones (`getOutstandingDetalle` a secas)              → 7 / 1
// Correr: npx tsx --test tests/suscripciones-por-cobrar.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { itemDeSuscripcion, textoDeSuscripcion, type LeadSuscripcion } from '../lib/suscripciones-por-cobrar';
import { armarCobranza } from '../lib/datos-comercial';
import { cobroDeFila } from '../app/m/dashboard/modelo';
import { PREFIJO_RENOVACION_FALLIDA } from '../lib/cobrado-lead';

const HOY = '2026-10-20';
const fuente = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const lead = (x: Partial<LeadSuscripcion> = {}): LeadSuscripcion => ({
  id: 2740, nombre: 'Suscripción (prueba de Pagos)', fecha_cierre: '2026-08-17', suscripcion_monto_usd: 800, suscripcion_meses: null,
  suscripcion_cancelada_at: null, ...x,
});
const mes = (fecha: string) => ({ monto_usd: 800, pagado: true, fecha_esperada: fecha, fecha_pago: fecha });
const TODO = { desde: null, hasta: null };

test('⚠️ el caso del ws3 (lead 2740): dos meses registrados de tres → por cobrar, vencido desde el 17/10', () => {
  const it = itemDeSuscripcion({ lead: lead(), pagos: [mes('2026-08-17'), mes('2026-09-17')], cobros: [], hoy: HOY, ventana: TODO });
  assert.ok(it);
  assert.deepEqual(it.suscripcion, { motivo: 'sin-registrar', meses: 1, vence: '2026-10-17' });
  assert.equal(it.pendiente_usd, 800);
  assert.equal(it.cobrado_usd, 1600);
  assert.equal(it.proxima_cuota, null);
  assert.equal(textoDeSuscripcion(it.suscripcion!), 'falta registrar 1 mes');
});

test('una manual al día: la próxima mensualidad, sólo si cae en la ventana', () => {
  const pagos = [mes('2026-08-17'), mes('2026-09-17'), mes('2026-10-17')];
  const todo = itemDeSuscripcion({ lead: lead(), pagos, cobros: [], hoy: HOY, ventana: TODO });
  assert.deepEqual(todo?.suscripcion, { motivo: 'proxima', meses: 1, vence: '2026-11-17' });
  assert.equal(itemDeSuscripcion({ lead: lead(), pagos, cobros: [], hoy: HOY, ventana: { desde: '2026-10-01', hasta: '2026-10-31' } }), null);
});

test('⚠️ la de la pasarela: sólo con la renovación rechazada; al día no aparece (se cobra sola)', () => {
  const pagada = { tipo: 'suscripcion' as const, estado: 'pagado' as const, suscripcion_estado: 'activa' as const, motivo: null };
  assert.equal(itemDeSuscripcion({ lead: lead(), pagos: [mes('2026-08-17'), mes('2026-09-17')], cobros: [pagada], hoy: HOY, ventana: TODO }), null);
  const fallo = { ...pagada, motivo: `${PREFIJO_RENOVACION_FALLIDA}: fondos insuficientes` };
  const it = itemDeSuscripcion({ lead: lead(), pagos: [mes('2026-08-17'), mes('2026-09-17')], cobros: [fallo], hoy: HOY, ventana: TODO });
  assert.deepEqual(it?.suscripcion, { motivo: 'renovacion-fallida', meses: 1, vence: '2026-10-17' });
});

test('cancelada, sin fecha de cierre o sin mensualidad: nada', () => {
  assert.equal(itemDeSuscripcion({ lead: lead({ suscripcion_cancelada_at: '2026-09-30T00:00:00Z' }), pagos: [], cobros: [], hoy: HOY, ventana: TODO }), null);
  assert.equal(itemDeSuscripcion({ lead: lead({ fecha_cierre: null }), pagos: [], cobros: [], hoy: HOY, ventana: TODO }), null);
  assert.equal(itemDeSuscripcion({ lead: lead({ suscripcion_monto_usd: null }), pagos: [], cobros: [], hoy: HOY, ventana: TODO }), null);
});

test('⚠️ `armarCobranza` ordena la suscripción por su vencimiento, con sus días, y sin cuota que marcar', () => {
  const sus = itemDeSuscripcion({ lead: lead(), pagos: [mes('2026-08-17'), mes('2026-09-17')], cobros: [], hoy: HOY, ventana: TODO })!;
  const cuota = {
    lead_id: 7, lead_nombre: 'Ana', vendido_usd: 3000, cobrado_usd: 1000, pendiente_usd: 500,
    proxima_cuota: { pago_id: 99, numero: 2, monto_usd: 500, fecha_esperada: '2026-10-25' }, dias_desde_cierre: 40, fecha_cierre: '2026-09-10',
  };
  const { filas, total } = armarCobranza([cuota, sus], HOY);
  assert.deepEqual(filas.map((f) => f.leadId), [2740, 7], 'lo vencido (17/10) arriba de lo que vence el 25/10');
  assert.equal(filas[0].cuota, null);
  assert.deepEqual(filas[0].suscripcion, { motivo: 'sin-registrar', meses: 1, vence: '2026-10-17' });
  assert.equal(filas[0].dias, -3);
  assert.equal(filas[0].urgencia, 'vencida');
  assert.equal(total, 1300);
});

test('la fila de General y del teléfono: la suscripción sin `pagoId` y con su motivo', () => {
  const fila = { leadId: 2740, nombre: 'Suscripción', pendiente: 800, cuota: null, suscripcion: { motivo: 'sin-registrar' as const, meses: 1, vence: '2026-10-17' }, dias: -3, urgencia: 'vencida' as const };
  assert.deepEqual(cobroDeFila(fila, (n) => `US$${n}`), { leadId: 2740, pagoId: null, nombre: 'Suscripción', linea: 'US$800 · falta registrar 1 mes', urgencia: 'vencida' });
  assert.equal(cobroDeFila({ ...fila, suscripcion: null }, (n) => `US$${n}`), null);
});

test('⚠️ la lista lee las cuotas Y las suscripciones en todos lados; el Outstanding sigue siendo el de las cuotas', () => {
  const server = fuente('lib/datos-comercial-server.ts');
  assert.match(server, /getPorCobrar\(c\.hoy, ventana\.desde, ventana\.hasta\)/);
  assert.match(server, /const \{ items \} = await getPorCobrar\(c\.hoy, null, null\);/);
  assert.match(server, /outstanding: out\.total,/, 'el número de Outstanding no cambia');
  assert.match(fuente('lib/graficos-datos-extra.ts'), /const \{ items \} = await getPorCobrar\(hoy, todo \? null : rg\.desde, todo \? null : rg\.hasta\);/);
  assert.match(fuente('lib/api-mako/areas/metricas.run.ts'), /getPorCobrar\(hoy, filtra \? d : null, filtra \? h : null\)/);
  assert.match(fuente('lib/pagos.ts'), /items: \[\.\.\.detalle\.items, \.\.\.subs\.filter\(\(s\) => !conCuota\.has\(Number\(s\.lead_id\)\)\)\]/);
});

test('las pantallas: una fila sin cuota no ofrece «Cobrada»; en la computadora abre la ficha', () => {
  const gen = fuente('app/general/datos.ts');
  assert.match(gen, /cobroDeFila\(f, \(n\) => fmtValor\(n, 'usd'\)\)/);
  assert.doesNotMatch(gen, /flatMap\(\(f\) => \(f\.cuota \? \[/, 'General no vuelve a tirar las filas sin cuota');
  assert.match(fuente('app/general/Cobranza.tsx'), /<ButtonLink variant="secondary" size="sm" href=\{`\/crm\/\$\{f\.leadId\}\?tab=pagos`\}>Abrir<\/ButtonLink>/);
  assert.match(fuente('app/m/dashboard/CobranzaM.tsx'), /control=\{f\.pagoId != null \? \(/);
});
