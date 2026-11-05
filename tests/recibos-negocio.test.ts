// =============================================================================
// La tarjeta «Emitir recibo» de Automations (5/11/2026): el recibo que un negocio le manda a su cliente
// =============================================================================
// Martín: «varios templates de factura que nosotros podemos crear y que el usuario pueda elegir qué template quiere enviar».
// Las reglas puras (lib/recibo-negocio-reglas.ts), las plantillas del PDF (lib/recibo-pdf.ts), la tarjeta, la operación de la
// API y las guardas del cableado. La numeración en SQL se prueba con scripts/probar-0399-0400-pglite.mjs.
//
// ⚠️ PROBADO ROMPIÉNDOLO (5/11/2026): ver el final del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  conceptoDeCuota, emisorDelNegocio, fotoDelPago, montoDeCuota, nombreDelPdfNegocio, textoDelRecibo, PLANTILLAS_RECIBO, type CuotaCobrada,
} from '../lib/recibo-negocio-reglas';
import { pdfDelRecibo } from '../lib/recibo-pdf';
import { nodoNuevo, tituloDeTarjeta, esEmitirRecibo, OP_EMITIR_RECIBO, MENU_MAS } from '../lib/flujo-conversacion';
import { plantillaPorId } from '../lib/plantillas-automatizaciones';
import { TRIGGER_PAGO } from '../lib/disparadores';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const CUOTA: CuotaCobrada = {
  id: 55, numero: 2, pagado: true, monto_usd: 97, moneda: 'USD', monto_original: null, fecha_pago: '2026-11-05', pago_hora: '10:30', proveedor: null,
};
const EMISOR = emisorDelNegocio({ nombre: 'Negocio de Prueba SA', id_fiscal: 'XAXX010101000', domicilio: 'Calle 1', correo: null }, 'Negocio de Prueba');
const foto = (o: Partial<Parameters<typeof fotoDelPago>[0]> = {}) => fotoDelPago({
  cuota: CUOTA, aNombre: 'Ana Pérez', emisor: EMISOR, zona: 'America/Mexico_City', producto: null, comprobante: null, plantilla: 'clasico',
  emitidoAt: '2026-11-05T17:00:00.000Z', ...o,
});
const textoDe = async (pdf: Uint8Array): Promise<string> => {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(pdf)), { mergePages: true });
  return String(text);
};

// ── La foto ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('sólo se emite sobre una cuota cobrada', () => {
  assert.throws(() => foto({ cuota: { ...CUOTA, pagado: false } }), /no está cobrada/);
  assert.throws(() => foto({ cuota: { ...CUOTA, fecha_pago: null } }), /no está cobrada/);
});

test('el monto va en la moneda en que se cobró, y el concepto dice qué se pagó', () => {
  assert.deepEqual(montoDeCuota({ monto_usd: 50, moneda: 'MXN', monto_original: 900 }), { monto: 900, moneda: 'MXN' });
  assert.deepEqual(montoDeCuota({ monto_usd: 50, moneda: 'MXN', monto_original: null }), { monto: 50, moneda: 'USD' }, 'sin el monto de su moneda, los dólares');
  assert.equal(conceptoDeCuota({ numero: 3, es_mensualidad: false, nacio_cobrada: false }, null), 'Cuota 3');
  assert.equal(conceptoDeCuota({ numero: 1, es_mensualidad: true }, 'Mentoría'), 'Mensualidad · Mentoría');
  assert.equal(conceptoDeCuota({ numero: null, nacio_cobrada: true }, null), 'Pago');
});

test('el medio y el N.º salen de la pasarela o del comprobante leído; si no, el id del pago', () => {
  assert.deepEqual([foto().pagos[0].medio, foto().pagos[0].referencia], ['otro', 'Pago #55']);
  const conLectura = foto({ comprobante: { medio: 'Binance', operacion: '461213098188603392' } });
  assert.deepEqual([conLectura.pagos[0].medio, conLectura.pagos[0].referencia], ['Binance', '461213098188603392']);
  assert.equal(foto({ cuota: { ...CUOTA, proveedor: 'stripe' } }).pagos[0].medio, 'stripe');
  // La hora es la del negocio: 10:30 en Ciudad de México son las 16:30 UTC.
  assert.equal(foto().pagos[0].fecha, '2026-11-05T16:30:00.000Z');
});

test('el emisor: «Facturado por» si está; si no, el nombre del negocio, sin inventar un dato fiscal', () => {
  assert.equal(EMISOR.documento, 'XAXX010101000');
  const sin = emisorDelNegocio(null, 'Mi Negocio');
  assert.deepEqual([sin.nombre, sin.documento, sin.direccion, sin.correo], ['Mi Negocio', null, null, null]);
});

test('el texto: el del grupo no dice el monto, y el correo dice que no es una factura fiscal', () => {
  const g = textoDelRecibo(3, 'grupo', 'Mi Negocio');
  assert.doesNotMatch(g.pie, /\d+[.,]\d{2}|US\$|\$\s*\d/);
  assert.match(textoDelRecibo(3, 'email', 'Mi Negocio').cuerpo, /no una factura fiscal/);
  assert.equal(nombreDelPdfNegocio(3, 'Ana/Pérez'), 'Recibo 0003 - AnaPérez.pdf');
});

// ── Las plantillas del PDF ────────────────────────────────────────────────────────────────────────────────────────

test('las tres plantillas son distintas, «Clásico» es la de los recibos de MaKo, y todas dicen que no es una factura fiscal', async () => {
  assert.deepEqual(PLANTILLAS_RECIBO.map((p) => p.id), ['clasico', 'compacto', 'marca']);
  const f = { ...foto(), numero: 1 };
  const clasico = await pdfDelRecibo({ ...f, plantilla: 'clasico' });
  const sinPlantilla = await pdfDelRecibo({ ...f, plantilla: undefined });
  assert.deepEqual(Buffer.from(clasico), Buffer.from(sinPlantilla), 'sin plantilla, el layout de siempre (los 0001 y 0002 no cambian)');
  const [tc, tk, tm] = [await textoDe(clasico), await textoDe(await pdfDelRecibo({ ...f, plantilla: 'compacto' })), await textoDe(await pdfDelRecibo({ ...f, plantilla: 'marca' }))];
  assert.match(tc, /Qué se pagó/);
  assert.doesNotMatch(tk, /Qué se pagó/, 'el compacto no tiene tablas');
  assert.match(tk, /Pagado por/);
  assert.match(tm, /NEGOCIO DE PRUEBA SA/, 'la franja con el nombre');
  for (const t of [tc, tk, tm]) assert.match(t, /No es una factura fiscal/);
});

// ── La tarjeta, la operación y la plantilla de flujo ────────────────────────────────────────────────────────────────

test('la tarjeta RECEIPT: la ⚡ Acción `emitir_recibo` sobre el lead del evento, «Clásico» al lead por WhatsApp', () => {
  const p = nodoNuevo('recibo', [], () => 0.5);
  assert.equal(p.accion?.operacion, OP_EMITIR_RECIBO);
  assert.deepEqual(p.accion?.params, { leadId: 'evento', plantilla: 'clasico', canal: 'whatsapp' });
  assert.ok(esEmitirRecibo(p));
  assert.equal(tituloDeTarjeta(p), 'RECEIPT');
  assert.ok(MENU_MAS.find((o) => o.value === 'recibo')?.fueraDeRespuesta);
});

test('la operación: le llega a un tercero (un «sí» puro por WhatsApp), se ofrece en los flujos y no sale por HTTP', () => {
  const d = porId('emitir_recibo');
  assert.ok(d && esAccion(d));
  assert.equal(d.aTerceros, true);
  assert.equal(d.confirmacion, 'chat');
  assert.ok(!d.canales.includes('http'));
  const flujo = leer('lib/api-mako/flujo.ts');
  const bloque = flujo.slice(flujo.indexOf('export const NO_EN_FLUJOS'), flujo.indexOf(']);', flujo.indexOf('export const NO_EN_FLUJOS')));
  assert.ok(!bloque.includes("'emitir_recibo'"));
});

test('la plantilla «Emitir Recibo al Cobrar»: el pago aprobado, una vez por pago', () => {
  const p = plantillaPorId('recibo-al-cobrar');
  assert.ok(p);
  assert.deepEqual(p.cron, { fijo: TRIGGER_PAGO, eventos: ['aprobado'] });
  assert.equal(p.reentrada, 'siempre');
  assert.equal(p.pasos[0].accion?.operacion, OP_EMITIR_RECIBO);
});

// ── Las guardas del cableado ────────────────────────────────────────────────────────────────────────────────────────

test('sale como el negocio: el correo sin `from` (lo firma su remitente) y nunca la llave de MaKo', () => {
  const src = sinComentarios(leer('lib/recibos-negocio.ts'));
  const i = src.indexOf('await sendEmail({');
  assert.ok(i > 0);
  assert.doesNotMatch(src.slice(i, src.indexOf('});', i)), /\bfrom\s*:/);
  assert.doesNotMatch(src, /REMITENTE_MAKO|keyDeLaPlataforma|mandarReciboPorEmail/);
  // Al grupo, copia antes (lib/grupo-app.ts): el grupo de la app recibe todo aunque WhatsApp no lo entregue.
  // Cada punta se afirma existente ANTES de comparar: un `indexOf` que no encuentra da -1, y -1 < cualquiera (AGENTS.md).
  const copia = src.indexOf('await copiarAlGrupo(ws');
  const envio = src.indexOf('await enviarPartesAlGrupoMaKo(ws');
  assert.ok(copia > 0 && envio > 0, 'el grupo se copia y se manda');
  assert.ok(copia < envio, 'copia antes de mandar');
});

test('`emitir_recibo_negocio` (el único que da números de un negocio) lo llama sólo lib/recibos-negocio.ts', () => {
  const salida = execFileSync('git', ['grep', '-l', "emitir_recibo_negocio'", '--', 'lib', 'app', 'scripts'], { cwd: RAIZ, encoding: 'utf8' });
  assert.deepEqual(salida.split('\n').filter(Boolean).sort(), ['lib/recibos-negocio.ts']);
});

test('«Ver ejemplo»: sólo quien ve Automations, en positivo, y sólo lee', () => {
  const src = sinComentarios(leer('app/api/recibos-negocio/ejemplo/route.ts'));
  assert.match(src, /if \(rol !== 'admin' && rol !== 'setter'\) return/);
  assert.match(src, /tabEnCapa\('setting', await getCapaActual\(\)\)/);
  assert.doesNotMatch(src, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(src, /emitirReciboDelLead/);
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO (5/11/2026, base: 12 pases y 0 fallos; cada rotura restaurada de memoria y comprobada con md5). Cada una dio
// UN rojo, el del test que la nombra:
//   · el recibo de una cuota sin cobrar · el monto siempre en dólares · un dato fiscal inventado en el emisor · la hora sin la
//     zona del negocio · el monto en el texto del grupo · el compacto con tablas · «Con tu marca» sin su franja · la tarjeta sin
//     el lead del evento · `emitir_recibo` sin `aTerceros` · el correo firmado por MaKo · la plantilla de flujo una sola vez ·
//     «Ver ejemplo» abierto a cualquier rol.
//   · el grupo SIN `copiarAlGrupo` daba VERDE en la primera versión (el `indexOf` de -1 era «menor»): ahora se afirma que existe.
// ─────────────────────────────────────────────────────────────────────────────
