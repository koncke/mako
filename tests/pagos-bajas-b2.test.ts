// =============================================================================
// Las seis fallas BAJAS de la revisión de b2 (Pagos campo por campo, 14/10/2026)
// =============================================================================
// docs/relevo/crm-tanda-b1.md, «Revisión de b2 · Pagos». Lo puro se ejecuta; el cableado se lee del FUENTE, como en
// tests/pagos-escritura.test.ts (lib/pagos.ts, lib/cobros.ts y las acciones son `server-only`):
//   1. una suscripción de la pasarela ACTIVA le gana a la manual cancelada, y un pago de suscripción nuevo la reabre;
//   2. volver a cobrar una cuota a mano limpia la moneda, el monto original, el concepto y el método de la vez anterior;
//   3. el corte de recordatorios que pide una persona dice que falló (el de `marcarPago` sigue sin tirar);
//   4. una suscripción que cobra la pasarela no se cambia desde el CRM (tipo, mensualidad, plazo);
//   5. la moneda del negocio no se escribe sin negocio (caía al ws1, un cliente);
//   6. `cobranza_lead` tiene UN «por cobrar»: sin las cuotas devueltas, como `cobrado.pendiente_usd`.
//
// PROBADO ROMPIÉNDOLO (14/10/2026), una rotura por vez con un script que reemplaza en el fuente, corre y restaura
// byte a byte. Con el código como está: 8 pases, 0 fallos. Rota, cada una da 7 / 1:
//   · cobradoDelLead sin `&& !activaPasarela` (la manual cancelada gana otra vez)
//   · aplicarPagoAprobado sin `reabrirSuscripcionDelLead`
//   · cobrarCuota sin limpiar la moneda de una cuota a mano
//   · cortarRecordatoriosDeCuota sin `{ tirar: true }`
//   · cerrarCorridasDeCuota tragándose el error aunque le pidan tirar
//   · escribirVenta sin la guarda de la pasarela
//   · guardarMonedaDelNegocio sin el corte de negocio
//   · cobranza_lead con el `por_cobrar_usd` de antes
//   · `laCobraLaPasarela` contando también un cobro de suscripción cancelado
// Correr: npx tsx --test tests/pagos-bajas-b2.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cobradoDelLead, PREFIJO_RENOVACION_FALLIDA, type EntradaCobrado } from '../lib/cobrado-lead';
import { laCobraLaPasarela } from '../lib/cobros-reglas';

const RAIZ = join(__dirname, '..');
/** Sin comentarios y con LF (AGENTS.md: las líneas PRIMERO y los bloques después). */
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const PAGOS = fuente('lib/pagos.ts');
const COBROS = fuente('lib/cobros.ts');

/** La función entera, desde su firma hasta la `}` de la columna 0 que la cierra. */
function bloque(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf('\n}\n', i);
  assert.ok(fin > i, `no encontré el cierre de «${firma}»`);
  return src.slice(i, fin + 2);
}

// ── 1 · La suscripción de la pasarela contra la manual cancelada ───────────

const HOY = '2026-10-14';
const suscripcion = (e: Partial<EntradaCobrado>): EntradaCobrado => ({
  ventaTipo: 'suscripcion', montoCierreUsd: null, suscripcionMontoUsd: 100, suscripcionMeses: null,
  fechaCierre: '2026-03-01', pagos: [], hoy: HOY, ...e,
});

test('⚠️ una suscripción de la pasarela ACTIVA le gana a la manual cancelada (y su renovación fallida se ve roja)', () => {
  const vuelve = cobradoDelLead(suscripcion({
    suscripcionCanceladaAt: '2026-03-20T12:00:00Z',
    cobros: [{ tipo: 'suscripcion', estado: 'pagado', suscripcion_estado: 'activa', motivo: null }],
  }));
  assert.equal(vuelve.suscripcion?.estado, 'activa', 'el cliente que volvió por Stripe no está «Cancelado»');
  const rechazo = cobradoDelLead(suscripcion({
    suscripcionCanceladaAt: '2026-03-20T12:00:00Z',
    cobros: [{ tipo: 'suscripcion', estado: 'pagado', suscripcion_estado: 'activa', motivo: `${PREFIJO_RENOVACION_FALLIDA}: sin fondos` }],
  }));
  assert.equal(rechazo.semaforo.tono, 'rojo');
  // Sin pasarela activa, la manual cancelada sigue cancelada.
  const sola = cobradoDelLead(suscripcion({ suscripcionCanceladaAt: '2026-03-20T12:00:00Z' }));
  assert.equal(sola.suscripcion?.estado, 'cancelada');
});

test('⚠️ un pago de suscripción NUEVO reabre la del lead aunque ya esté ganado, antes de ganar y sin tirar', () => {
  const aplicar = bloque(COBROS, 'export async function aplicarPagoAprobado(');
  const iReabrir = aplicar.indexOf("if (actual.lead_id && actual.tipo === 'suscripcion' && nuevo && !renovacion) await reabrirSuscripcionDelLead(actual, autor);");
  const iGanar = aplicar.indexOf('await ganarLead(actual, autor)');
  assert.ok(iReabrir > 0 && iGanar > iReabrir, 'sólo el primer pago (no la renovación ni la reentrega), y antes de ganar');
  const reabrir = bloque(COBROS, 'async function reabrirSuscripcionDelLead(');
  assert.match(reabrir, /suscripcion_cancelada_at: null, suscripcion_meses_antes: null, suscripcion_meses: null,/);
  assert.match(reabrir, /\.eq\('venta_tipo', 'suscripcion'\)/, 'sólo un lead que ya era suscripción');
  assert.match(reabrir, /\} catch \(e\) \{\s*console\.error/, 'la plata ya entró: no tira');
});

// ── 2 · La moneda de un cobro a mano ───────────────────────────────────────

test('⚠️ volver a cobrar una cuota a mano limpia la moneda y la etiqueta de la vez anterior; la de la pasarela no', () => {
  const cobrar = bloque(PAGOS, 'export async function cobrarCuota(');
  assert.match(cobrar, /select\('monto_usd, fecha_esperada, pagado, proveedor'\)/);
  assert.match(cobrar, /const aMano = !fila\.proveedor;/);
  assert.match(cobrar, /else if \(aMano\) \{ upd\.moneda = null; upd\.monto_original = null; \}/);
  assert.match(cobrar, /await etiquetarPago\(pagoId, datos, \{ limpiar: aMano \}\);/);
  assert.match(bloque(PAGOS, 'async function etiquetarPago('), /if \(!e\.concepto && !e\.metodo && !opts\.limpiar\) return;/);
});

// ── 3 · El corte que pide una persona dice que falló ──────────────────────

test('⚠️ «Cortarlo» tira si no pudo escribir; el corte de marcarPago sigue sin tirar', () => {
  assert.match(bloque(PAGOS, 'export async function cortarRecordatoriosDeCuota('), /return cerrarCorridasDeCuota\(ws, pagoId, \{ tirar: true \}\);/);
  assert.match(bloque(PAGOS, 'export async function marcarPago('), /cerrarCorridasDeCuota\(ws, pagoId\);/, 'marcarPago: que falle el corte no tumba el pago');
  const corte = bloque(fuente('lib/flujo-corridas.ts'), 'export async function cerrarCorridasDeCuota(');
  assert.match(corte, /if \(error\) \{\s*if \(opts\.tirar\) throw new Error/);
  assert.match(corte, /\} catch \(e\) \{\s*if \(opts\.tirar\) throw e;/);
});

// ── 4 · La venta de una suscripción que cobra la pasarela ─────────────────

test('laCobraLaPasarela: un cobro de suscripción pagado y no cancelado', () => {
  assert.equal(laCobraLaPasarela([{ tipo: 'suscripcion', estado: 'pagado', suscripcion_estado: 'activa' }]), true);
  assert.equal(laCobraLaPasarela([{ tipo: 'suscripcion', estado: 'pagado', suscripcion_estado: null }]), true);
  assert.equal(laCobraLaPasarela([{ tipo: 'suscripcion', estado: 'pagado', suscripcion_estado: 'cancelada' }]), false);
  assert.equal(laCobraLaPasarela([{ tipo: 'suscripcion', estado: 'pendiente', suscripcion_estado: null }]), false, 'un link sin pagar todavía no cobra');
  assert.equal(laCobraLaPasarela([{ tipo: 'unico', estado: 'pagado', suscripcion_estado: null }]), false);
  assert.equal(laCobraLaPasarela([]), false);
});

test('⚠️ escribirVenta niega tipo, mensualidad y plazo de una suscripción que cobra la pasarela, ANTES de escribir', () => {
  const venta = bloque(PAGOS, 'export async function escribirVenta(');
  const iGuarda = venta.indexOf("if (tipo === 'suscripcion' && cambio.campo !== 'fecha') {");
  const iPasarela = venta.indexOf('if (laCobraLaPasarela(');
  const iPatch = venta.indexOf('patchDeVenta(');
  const iUpdate = venta.indexOf(".from('leads').update(");
  assert.ok(iGuarda > 0 && iPasarela > iGuarda && iPatch > iPasarela && iUpdate > iPatch, `orden guarda → patch → update: ${iGuarda} ${iPasarela} ${iPatch} ${iUpdate}`);
  assert.match(venta.slice(iGuarda, iPasarela), /if \(eC\) return \{ ok: false/, '«no pude leer los cobros» no es «no la cobra la pasarela»');
  // La misma condición en las tres puertas: cancelar a mano (ficha y API) y cambiar la venta.
  assert.match(fuente('app/crm/[id]/pagos-campo-actions.ts'), /if \(laCobraLaPasarela\(cobros\)\) \{/);
  assert.match(fuente('lib/api-mako/areas/cobros.run.ts'), /if \(laCobraLaPasarela\(cobros\)\) \{/);
});

// ── 5 · La moneda del negocio sin negocio ──────────────────────────────────

test('⚠️ la moneda del negocio no se escribe sin negocio (setSetting caería al ws1)', () => {
  const guardar = bloque(PAGOS, 'export async function guardarMonedaDelNegocio(');
  const iCorte = guardar.indexOf('if ((await getWorkspaceActual()) == null) throw new Error(');
  const iSet = guardar.indexOf('await setSetting(');
  assert.ok(iCorte > 0 && iSet > iCorte, 'el corte va antes de escribir');
});

// ── 6 · Un solo «por cobrar» en cobranza_lead ─────────────────────────────

test('⚠️ cobranza_lead: por_cobrar_usd sin las cuotas devueltas, como cobrado.pendiente_usd', () => {
  const run = fuente('lib/api-mako/areas/crm.run.ts');
  assert.match(run, /por_cobrar_usd: suma\(cuotas\.filter\(\(c, i\) => !c\.pagada && !esCuotaDevuelta\(plan\.pagos\[i\]\)\)\),/);
  assert.doesNotMatch(run, /por_cobrar_usd: suma\(cuotas\.filter\(\(c\) => !c\.pagada\)\)/);
});
