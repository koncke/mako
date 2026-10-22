// =============================================================================
// La revisión adversarial de los pagos por CRM (22/10/2026, punta 05fc52b09, mig 0324): dos altos y seis medios
// =============================================================================
// La revisión (Cerebro › Integración) está en la carpeta de notas del Cerebro: revision-cobros-2210.md. Cada test dice el
// hallazgo, el caso y la rotura con que se lo probó (medido el 22/10/2026: base 9 / 0, cada rotura 8 / 1). Lo puro se EJECUTA;
// lo que vive en el server se lee del fuente, como tests/pagos-crm.test.ts.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cobrosDelTrato, cobrosSinLosDe } from '../lib/pagos-crm';
import { crmEnVista } from '../app/crm/lead-view/ficha/pagos/trato';
import { cobradoDelLead } from '../lib/cobrado-lead';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función de un fuente: desde su firma hasta la próxima `export` o `async function` de primer nivel. */
const cuerpo = (src: string, firma: string) => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré ${firma}`);
  const fin = src.slice(i + firma.length).search(/\n(export |async function |function )/);
  return src.slice(i, fin < 0 ? undefined : i + firma.length + fin);
};
const PAGOS = sinComentarios(leer('lib/pagos.ts'));

// A1 · Juan está en «Venta» y agregado a «Renovación». Se registra un pago suelto de US$500 en la renovación y se deshace:
// reconciliado contra la casa, no se encontraba y quedaba como deuda vencida inventada.
// Rotura: `guardarCuotasPorId(fila.lead_id, [], { vistos: new Set([pagoId]) })` (sin `crm`): 1 fallo.
test('A1: deshacer un pago suelto lo quita de SU trato, no de la casa', () => {
  const q = cuerpo(PAGOS, 'async function quitarSiNacioCobrada(');
  assert.match(q, /const crm = await tratoDelPago\(fila\.lead_id, fila\.funnel_id\);/);
  assert.match(q, /guardarCuotasPorId\(fila\.lead_id, \[\], \{ vistos: new Set\(\[pagoId\]\), crm \}\)/);
  // `marcarPago` lee la fila entera: trae el `funnel_id` que usa lo de arriba.
  assert.match(cuerpo(PAGOS, 'export async function marcarPago('), /\.from\('pagos'\)\s*\.select\('\*'\)\s*\.eq\('id', pagoId\)/);
});

// A2 · En el pop-up, «Agregar a Renovación» sólo refrescaba la ruta: la ficha seguía con los tratos de antes, `crmEnVista`
// daba null y «Armar el plan» escribía el de la casa.
// Roturas: `crmEnVista` que vuelve a pedir el trato leído (`!data.tratos?.some(...)`): 1 fallo. El hook sin
// `onProductosCambiados` en `despues`: 1 fallo.
test('A2: la cabecera dice Renovación → la tab es la renovación, aunque el trato no se haya leído; y se relee al agregar', () => {
  const foto = [{ id: 1, nombre: 'Venta' }, { id: 29, nombre: 'Renovación' }];
  const ren = { id: 29, nombre: 'Renovación', esCasa: false, esta: true };
  assert.deepEqual(crmEnVista({ vista: ren, idEnVista: 29, casaId: 1, foto }, { tratos: [] }), { id: 29, nombre: 'Renovación' }, 'recién agregado: sin trato leído, igual es la renovación');
  assert.deepEqual(crmEnVista({ vista: ren, idEnVista: 29, casaId: 1, foto }, {}), { id: 29, nombre: 'Renovación' }, 'la lectura de los tratos falló');
  assert.equal(crmEnVista({ vista: { ...ren, id: 1, esCasa: true }, idEnVista: 1, casaId: 1, foto }), null, 'la casa');
  assert.equal(crmEnVista({ vista: { ...ren, esta: false }, idEnVista: 29, casaId: 1, foto }), null, 'un CRM donde no está');
  assert.deepEqual(crmEnVista({ vista: null, idEnVista: 29, casaId: 1, foto }), { id: 29, nombre: 'Renovación' }, 'antes de la lista del server: el ?funnel= del tablero');
  const hook = sinComentarios(leer('app/crm/lead-view/ProductoDelLead.tsx'));
  assert.match(hook, /if \(casaCambio\) onCasaCambiada\?\.\(\); else onProductosCambiados\?\.\(\);/);
  assert.match(sinComentarios(leer('app/crm/LeadSheet.tsx')), /onProductosCambiados: releer,/);
  // Sin los tratos leídos, la tab lo dice (no es «sin plan»), y `getLeadFullAction` no los da por vacíos.
  assert.match(sinComentarios(leer('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx')), /\{ctx\.crm && !ctx\.data\.tratos && <Aviso tono="ambar">No pude leer el plan de/);
  assert.match(sinComentarios(leer('app/crm/actions.ts')), /const tratosP = tratosDelLead\(id\)\.catch\([^\n]*return undefined; \}\);/);
});

// M1 · MaKo no podía marcar cobrada la cuota de una renovación, y `cobranza_lead` decía «Pagó todo» de quien la debía.
// Roturas: `marcar_pago_cobrado` con `getPagosByLead(lead.id)`: 1 fallo. `cobranza_lead` sin `...otrosCrms`: 1 fallo.
test('M1: MaKo marca una cuota de cualquier CRM por su id, y su estado de cuenta nombra lo de los otros CRMs', () => {
  const api = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  const marcar = api.slice(api.indexOf('marcar_pago_cobrado: {'), api.indexOf('marcar_pago_cobrado: {') + 1500);
  assert.match(marcar, /const pagos = await getPagosByLead\(lead\.id, 'todos'\)/);
  const cobranza = api.slice(api.indexOf('cobranza_lead: {'), api.indexOf('cobranza_lead: {') + 9000);
  assert.match(cobranza, /tratosDelLead\(lead\.id\)\.catch\(\(\) => null\)/);
  assert.match(cobranza, /\.\.\.otrosCrms,\s*\}\);/);
  assert.match(cobranza, /otros_crms_aviso: 'No pude leer sus otros CRMs/);
});

// M2 · «A quién cobrarle» filtraba la casa de una suscripción por `funnel_id == leads.funnel_id`: un mes cobrado en una
// casa anterior desaparecía y le inventaba deuda.
// Rotura: el filtro de antes (`p.funnel_id == null || Number(p.funnel_id) === ...`): 1 fallo.
test('M2: la suscripción cuenta los meses de la casa con la regla de esDelTrato', () => {
  const subs = cuerpo(PAGOS, 'export async function getSuscripcionesPorCobrar(');
  assert.match(subs, /db\.from\('lead_funnel'\)\.select\('lead_id, funnel_id'\)\.in\('lead_id', ids\)/);
  assert.match(subs, /const agregados = \(agregadosDe\.get\(Number\(l\.id\)\) \?\? \[\]\)\.filter\(\(f\) => f !== casa\);/);
  assert.match(subs, /\.filter\(\(p\) => esDelTrato\(p\.funnel_id, null, agregados\)\)/);
});

// M3 · Una fila de `lead_funnel` que repite la casa (un borrado que falló) la dejaba vacía y daba `crmDelTrato(casa)` = CRM.
// Rotura: `crmsAgregadosDelLead` sin sacar la casa (`return ids;`): 1 fallo.
test('M3: la casa nunca es un CRM agregado, aunque una fila de lead_funnel la repita', () => {
  assert.match(cuerpo(PAGOS, 'export async function crmsAgregadosDelLead('), /const casa = await casaDelLead\(leadId\);\s*return ids\.filter\(\(x\) => x !== casa\);/);
  assert.match(cuerpo(PAGOS, 'export async function crmDelTrato('), /if \(\(await casaDelLead\(leadId\)\) === n\) return null;/);
  assert.match(cuerpo(PAGOS, 'export async function tratosDelLead('), /\.filter\(\(f\) => Number\(f\.funnel_id\) !== casa\)/);
  assert.match(PAGOS, /const agregados = \[\.\.\.\(tratos\.get\(Number\(row\.lead_id\)\)\?\.keys\(\) \?\? \[\]\)\]\.filter\(\(k\) => k !== casa\);/, '«A quién cobrarle» tampoco parte la casa en dos');
});

// M4 · Quitar a alguien de la renovación (o quitarle la casa, que borra la fila que se promueve) perdía la venta y mezclaba
// los pagos con los de la casa; borrar para siempre un CRM con pagos los dejaba sin CRM.
// Roturas: `quitarDeProducto` sin la guarda: 1 fallo. `eliminarFunnelDefinitivo` sin la guarda: 1 fallo.
test('M4: no se quita a nadie de un CRM donde tiene plata, ni se borra para siempre un CRM con pagos', () => {
  const lf = sinComentarios(leer('lib/lead-funnel.ts'));
  const quitar = cuerpo(lf, 'export async function quitarDeProducto(');
  assert.match(quitar, /const conPlata = !p\.esCasa \? funnelId : aQuienPromover\(productos\)\?\.funnelId \?\? null;/);
  assert.match(quitar, /if \(await tratoConPlata\(leadId, conPlata\)\) \{\s*throw new Error\(`Tiene una venta o pagos en/);
  // La guarda va ANTES de borrar nada.
  assert.ok(quitar.indexOf('tratoConPlata(') < quitar.indexOf(".delete()"), 'la guarda va antes del borrado');
  const tp = cuerpo(PAGOS, 'export async function tratoConPlata(');
  assert.match(tp, /\.from\('pagos'\)\.select\('id'\)\.eq\('lead_id', leadId\)\.eq\('funnel_id', crm\)\.limit\(1\)/);
  assert.match(tp, /c\.monto_cierre_usd != null/);
  const fn = sinComentarios(leer('lib/funnels.ts'));
  const borrar = cuerpo(fn, 'export async function eliminarFunnelDefinitivo(');
  assert.match(borrar, /\.from\('pagos'\)\.select\('id'\)\.eq\('funnel_id', funnelId\)\.limit\(1\)/);
  assert.ok(borrar.indexOf("from('pagos')") < borrar.indexOf("from('leads').update"), 'la guarda va antes del rescate');
});

// M5 · Una mensualidad de Stripe (sin cuota) casaba por monto contra TODOS los CRMs y saldaba la cuota de una renovación.
// Rotura: `getPagosByLead(p.leadId, 'todos')` en el casamiento: 1 fallo.
test('M5: un pago de la pasarela sin cuota casa por monto sólo con las cuotas de la casa', () => {
  const r = cuerpo(PAGOS, 'export async function registrarCobroDeProveedor(');
  const casamiento = r.slice(r.indexOf('if (!p.pagoId) {'), r.indexOf('for (const casa of impagas)'));
  assert.match(casamiento, /const impagas = \(await getPagosByLead\(p\.leadId\)\)\s*\.filter/);
});

// M6 · El link de una cuota de la renovación pagado dos veces: el segundo pago entraba sin `funnel_id` y el trigger lo
// mandaba a la casa.
// Rotura: el insert sin `funnel_id: crmDeLaCuota`: 1 fallo.
test('M6: el pago repetido de una cuota entra en el CRM de esa cuota', () => {
  const r = cuerpo(PAGOS, 'export async function registrarCobroDeProveedor(');
  assert.match(r, /crmDeLaCuota = cuota\.data\?\.funnel_id != null \? Number\(cuota\.data\.funnel_id\) : null;/);
  assert.match(r, /nacio_cobrada: true,\s*\.\.\.marca,\s*\.\.\.\(crmDeLaCuota != null \? \{ funnel_id: crmDeLaCuota \} : \{\}\),/);
});

// Los bajos que se arreglaron. Roturas: `cobrosSinLosDe` que devuelve todos: 1 fallo. `ddmm` sin `hoy` en el semáforo: 1 fallo.
test('bajos: los movimientos de la casa sin los de sus renovaciones, el año en el semáforo, y el link de la fila', () => {
  const cobros = [{ id: 7, pago_id: 43 }, { id: 8, pago_id: 90 }, { id: 9, pago_id: null }];
  const deRenovaciones = [{ id: 90, cobro_id: null }];
  assert.deepEqual(cobrosSinLosDe(cobros, deRenovaciones).map((c) => c.id), [7, 9]);
  assert.deepEqual(cobrosDelTrato(cobros, deRenovaciones).map((c) => c.id), [8]);
  // Una suscripción que terminó el año pasado lo dice con el año.
  const c = cobradoDelLead({ ventaTipo: 'suscripcion', montoCierreUsd: null, suscripcionMontoUsd: 100, suscripcionMeses: 2, fechaCierre: '2025-10-10', pagos: [], cobros: [], hoy: '2026-10-22' });
  assert.match(c.semaforo.texto, /de 2025/);
  assert.match(sinComentarios(leer('app/general/Cobranza.tsx')), /href=\{`\/crm\/\$\{f\.leadId\}\$\{f\.funnelId != null \? `\?funnel=\$\{f\.funnelId\}` : ''\}`\}/);
});
