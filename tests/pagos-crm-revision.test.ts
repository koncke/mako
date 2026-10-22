// =============================================================================
// La revisión adversarial de los pagos por CRM (22/10/2026, punta 05fc52b09, mig 0324): dos altos y seis medios
// =============================================================================
// La revisión (Cerebro › Integración) está en la carpeta de notas del Cerebro: revision-cobros-2210.md. Cada test dice el
// hallazgo, el caso y la rotura con que se lo probó (medido el 22/10/2026: la primera tanda con base 9 / 0 y cada rotura 8 / 1;
// la segunda, con base 13 / 0, abajo). Lo puro se EJECUTA;
// lo que vive en el server se lee del fuente, como tests/pagos-crm.test.ts.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cobradoDeLaVenta, cobrosDelTrato, cobrosSinLosDe, faltaDeLaVenta } from '../lib/pagos-crm';
import { crmEnVista, sinTratoLeido } from '../app/crm/lead-view/ficha/pagos/trato';
import { plata, valoresDelLead } from '../lib/variables-del-lead';
import type { Lead } from '../lib/leads';
import { sanearHoja } from '../lib/graficos-catalogo';
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
  assert.match(sinComentarios(leer('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx')), /\{sinTrato && <Aviso tono="ambar">No pude leer el plan de/);
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
  assert.match(quitar, /if \(await tratoConPlata\(leadId, conPlata\)\) \{\s*throw new Error\(!p\.esCasa\s*\? `Tiene una venta o pagos en/);
  // La guarda va ANTES de borrar nada.
  assert.ok(quitar.indexOf('tratoConPlata(') < quitar.indexOf(".delete()"), 'la guarda va antes del borrado');
  const tp = cuerpo(PAGOS, 'export async function tratoConPlata(');
  assert.match(tp, /\.from\('pagos'\)\.select\('id'\)\.eq\('lead_id', leadId\)\.eq\('funnel_id', crm\)\.limit\(1\)/);
  assert.match(tp, /c\.monto_cierre_usd != null/);
  const fn = sinComentarios(leer('lib/funnels.ts'));
  const borrar = cuerpo(fn, 'export async function eliminarFunnelDefinitivo(');
  // Desde la segunda revisión, la plata de los AGREGADOS de ese CRM (la venta de su casa se va con ellos).
  assert.match(borrar, /if \(\(await leadsConPlataEn\(funnelId, agregadosAca\.map\(\(r\) => Number\(r\.lead_id\)\)\)\)\.size\) \{/);
  assert.ok(borrar.indexOf('leadsConPlataEn(funnelId') < borrar.indexOf("from('leads').update"), 'la guarda va antes del rescate');
});

// M5 · Una mensualidad de Stripe (sin cuota) casaba por monto contra TODOS los CRMs y saldaba la cuota de una renovación.
// Rotura: `getPagosByLead(p.leadId, 'todos')` en el casamiento: 1 fallo.
test('M5: un pago de la pasarela sin cuota casa por monto sólo con las cuotas de la casa', () => {
  const r = cuerpo(PAGOS, 'export async function registrarCobroDeProveedor(');
  // Y sólo si el pago no es de otro CRM (`p.crm`, mig 0326): ese pago no casa con la casa.
  const casamiento = r.slice(r.indexOf('if (!p.pagoId && p.crm == null) {'), r.indexOf('for (const casa of impagas)'));
  assert.match(casamiento, /const impagas = \(await getPagosByLead\(p\.leadId\)\)\s*\.filter/);
});

// M6 · El link de una cuota de la renovación pagado dos veces: el segundo pago entraba sin `funnel_id` y el trigger lo
// mandaba a la casa.
// Rotura: el insert sin `funnel_id: crmDeLaCuota`: 1 fallo.
test('M6: el pago repetido de una cuota entra en el CRM de esa cuota', () => {
  const r = cuerpo(PAGOS, 'export async function registrarCobroDeProveedor(');
  // Sin `funnel_id` en la cuota, el CRM que dijo quien llama (mig 0326, «Vincular cobro»), que sin decirlo es la casa.
  assert.match(r, /crmDeLaCuota = cuota\.data\?\.funnel_id != null \? Number\(cuota\.data\.funnel_id\) : crmDeLaCuota;/);
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

// =============================================================================
// La SEGUNDA revisión (punta c1709cb7c): lo que el lead debe se calculaba con la venta de la casa menos lo cobrado en TODOS
// sus CRMs. Este test prueba el NÚMERO (la revisión: «el del saldo tiene que probar el número de verdad»).
// =============================================================================

// El caso: venta de la casa US$2.000, pagó 1.000 de esa venta y 500 en una renovación (total cobrado 1.500).
// Roturas (base 13 / 0): `cobradoDeLaVenta` con `total_cobrado_usd` (la de antes): 12 / 1. `{{lead_saldo}}` con la cuenta vieja: 12 / 1.
test('2ª · el saldo es la venta de la casa menos lo cobrado de ESA venta: debe 1.000, no 500', () => {
  const caso = { monto_cierre_usd: 2000, total_cobrado_usd: 1500, total_cobrado_casa_usd: 1000 };
  assert.equal(faltaDeLaVenta(caso), 1000);
  assert.equal(cobradoDeLaVenta(caso), 1000);
  // Sin la 0325 (la columna no vino): lo de antes, nunca un cero inventado.
  assert.equal(faltaDeLaVenta({ monto_cierre_usd: 2000, total_cobrado_usd: 1500 }), 500);
  assert.equal(faltaDeLaVenta({ monto_cierre_usd: 2000, total_cobrado_usd: 2500, total_cobrado_casa_usd: 2500 }), 0, 'nunca negativo');
  assert.equal(faltaDeLaVenta({ monto_cierre_usd: null, total_cobrado_usd: 500 }), null, 'sin venta no hay saldo');
  // Quien sólo pagó la renovación: lo cobrado de la venta es CERO (no «no se sabe»), y debe la venta entera.
  assert.equal(faltaDeLaVenta({ monto_cierre_usd: 2000, total_cobrado_usd: 500, total_cobrado_casa_usd: 0 }), 2000);
  // El mensaje al cliente: `{{lead_saldo}}` dice US$1.000.
  const v = valoresDelLead({ nombre: 'Juan Pérez', ...caso } as unknown as Lead);
  assert.equal(v.lead_saldo, plata(1000));
  assert.equal(v.lead_cobrado, plata(1500), '`{{lead_cobrado}}` sigue siendo lo cobrado en total');
});

// Roturas: el filtro «debe» con `vendido - cobrado`: 12 / 1. `listar_leads` sin `falta_cobrar_usd`: 12 / 1.
test('2ª · el filtro «Solo los que deben», el export y listar_leads usan lo cobrado de la venta', () => {
  const acc = sinComentarios(leer('app/crm/actions.ts'));
  assert.match(acc, /case 'debe': if \(!\(\(faltaDeLaVenta\(l\) \?\? 0\) > 0\)\) return false; break;/);
  assert.match(acc, /l\['#falta'\] = faltaDeLaVenta\(l\) \?\? 0;\s*l\['#cobrado'\] = cobradoDeLaVenta\(l\);/);
  assert.match(acc, /'monto_cierre_usd', 'total_cobrado_usd', 'total_cobrado_casa_usd', 'venta_tipo',/);
  assert.match(sinComentarios(leer('app/crm/leads-exportar.ts')), /\['#cobrado', 'Cobrado USD'\], \['#falta', 'Falta cobrar USD'\]/);
  const api = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  assert.match(api, /cobrado_de_la_venta_usd: cobradoDeLaVenta\(conCasa\), falta_cobrar_usd: faltaDeLaVenta\(conCasa\),/);
});

// Roturas: `sincronizarTotalCobrado` sin `total_cobrado_casa_usd`: 12 / 1. La 0325 sin excluir los agregados: 12 / 1.
test('2ª · sincronizar escribe lo cobrado de la casa, y la 0325 lo llena con la regla de esDelTrato', () => {
  const s = cuerpo(PAGOS, 'export async function sincronizarTotalCobrado(');
  assert.match(s, /const deLaCasa = pagados\.filter\(\(p\) => esDelTrato\(p\.funnel_id, null, agregados\)\)/);
  assert.match(s, /total_cobrado_casa_usd: Math\.round\(deLaCasa \* 100\) \/ 100 \}/, 'cero, no null: quien sólo pagó una renovación');
  assert.match(s, /if \(error && \/total_cobrado_casa_usd\/\.test\(error\.message\)\)/, 'sin la 0325, escribe lo de siempre');
  const sql = leer('supabase/migrations/0325_cobrado_de_la_casa.sql');
  assert.match(sql, /alter table leads add column if not exists total_cobrado_casa_usd numeric\(12, 2\);/);
  assert.match(sql, /where p\.pagado and not exists \(\s*select 1 from lead_funnel lf/);
  assert.match(sql, /coalesce\(sum\(p\.monto_usd\) filter \([\s\S]*?\), 0\) as casa/, 'cero, no null, si no pagó nada de la casa');
  assert.match(sql, /and lf\.funnel_id <> coalesce\(l2\.funnel_id,/, 'la fila que repite la casa no la saca de la casa');
});

// Los bajos recomendados. Roturas: `quitarLoteDeProducto` sin la guarda: 12 / 1. La tab con el trato sin leer que deja
// escribir (`sinTratoLeido` siempre false): 12 / 1.
test('2ª · el lote y el rescate no pierden la plata de un CRM, y sin el trato leído la tab no escribe', () => {
  const lf = sinComentarios(leer('lib/lead-funnel.ts'));
  const lote = cuerpo(lf, 'export async function quitarLoteDeProducto(');
  assert.match(lote, /const conPlata = await leadsConPlataEn\(funnelId, leadIds\);/);
  assert.match(lote, /const aQuitar = leadIds\.filter\(\(id\) => !conPlata\.has\(Number\(id\)\)\);/);
  assert.match(cuerpo(lf, 'export async function quitarDeProducto('), /es su CRM principal, y el que tomaría su lugar/, 'la casa tiene su propio texto');
  assert.doesNotMatch(lf, /quita esos pagos primero/, 'no se sugiere borrar pagos');
  const fn = cuerpo(sinComentarios(leer('lib/funnels.ts')), 'export async function eliminarFunnelDefinitivo(');
  assert.match(fn, /leadsConPlataEn\(funnelId, agregadosAca\.map/, 'frena la plata de los AGREGADOS, no la venta de su casa');
  assert.match(fn, /leadsConPlataEn\(idNegocio, \[\.\.\.etapaEnNegocio\.keys\(\)\]\)/, 'y la del rescate');
  assert.ok(fn.indexOf('leadsConPlataEn(idNegocio') < fn.indexOf("from('leads').update"), 'antes de escribir');
  assert.equal(sinTratoLeido({ crm: { id: 29, nombre: 'Renovación' }, data: {} as never }), true);
  assert.equal(sinTratoLeido({ crm: { id: 29, nombre: 'Renovación' }, data: { tratos: [] } as never }), false);
  assert.equal(sinTratoLeido({ crm: null, data: {} as never }), false);
  const bloques = sinComentarios(leer('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx'));
  assert.match(bloques, /const editando = props\.editando \|\| sinTrato;/, 'las cuotas');
  assert.match(bloques, /const editando = personalizando \|\| sinTratoLeido\(ctx\);/, 'la venta');
});

// CO1 (plan del Cerebro del 22/10): la hoja «Cobros» GUARDADA del ws1 no tenía el «Funnel», y escribirla en producción no
// alcanza a la de los demás negocios. Se lo da el saneo al leerla.
// Roturas: `conFunnelDeCobros` que no agrega nada: 13 / 1. Que lo agregue a cualquier hoja (sin mirar la plantilla): 13 / 1.
test('CO1 · una hoja de cobros guardada sin el «Funnel» lo recibe al leerse, una sola vez y con un id estable', () => {
  const guardada = { id: 'gmvbm0t7x5qzp', nombre: 'Cobros', plantilla: 'cobros', controles: [{ id: 'p1', tipo: 'periodo', preset: 'este_mes_completo' }], componentes: [] };
  const h = sanearHoja(guardada, 0)!;
  const f = h.controles.filter((c) => c.tipo === 'lista' && c.campo === 'producto');
  assert.equal(f.length, 1, 'trae el selector de CRM');
  assert.equal(f[0].id, 'gmvbm0t7x5qzp-funnel', 'con un id que sale de la hoja: lo elegido mirando sobrevive a recargar');
  assert.equal(f[0].valores, null, 'en «Todos»: no filtra nada hasta que se elija');
  assert.equal(sanearHoja(h, 0)!.controles.filter((c) => c.campo === 'producto').length, 1, 'leerla otra vez no lo duplica');
  assert.equal(sanearHoja({ ...guardada, plantilla: 'cobranza' }, 0)!.controles.filter((c) => c.campo === 'producto').length, 1, 'la Cobranza del Dashboard también');
  assert.equal(sanearHoja({ ...guardada, plantilla: 'marketing' }, 0)!.controles.filter((c) => c.campo === 'producto').length, 0, 'otra hoja no');
  assert.equal(sanearHoja({ ...guardada, plantilla: undefined }, 0)!.controles.filter((c) => c.campo === 'producto').length, 0, 'una hoja sin plantilla no');
});
