// =============================================================================
// Los recibos de MaKo (5/11/2026): las reglas puras, el PDF determinista y las guardas del cableado
// =============================================================================
// Pedido de Martín: «es súper importante que hagas un template que eso se envíe siempre por email de los recibos de compra [...] y
// también por WhatsApp [...] guardando dentro de SuperAdmin [...] para que tengamos un registro». El diseño y sus agujeros están en
// docs/relevo/recibos-encargo.md; la numeración en SQL se prueba contra un Postgres de verdad en scripts/probar-0397-pglite.mjs.
//
// ⚠️ PROBADO ROMPIÉNDOLO (5/11/2026, base 0 fallos): ver el final del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  claveDeRecibo, claveDeEnvio, correosDelRecibo, decidirCorreo, decidirWa, destinoDelRecibo, diferencia, emisorDe, esConcurrenteDeResend, leyendaDelMedio,
  lineaDeImpuesto, nombreDelPdf, numeroEnTexto, pieWhatsApp, referenciaNormal, rotulosDelDocumento, textoCorreo, textoDeOcupado, totalesDelRegistro,
  transicionRecibo, validarDestinoManual, fechaConHora, HORAS_23, instanteDeLaFecha, devolucionPorAvisar, sniffComprobante,
} from '../lib/recibos-reglas';
import { pdfDelRecibo, medidaDeImagen, type FotoRecibo } from '../lib/recibo-pdf';
import { porId } from '../lib/api-mako/registro';
import { esAccion, esLectura } from '../lib/api-mako/tipos';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// ── La referencia y la clave ───────────────────────────────────────────────────────────────────────────────────

test('la orden de Binance se normaliza a sus dígitos: un espacio de más no la vuelve «otra orden»', () => {
  assert.equal(referenciaNormal('binance', ' 4638 6966 0353 1345 92 '), '463869660353134592');
  assert.equal(referenciaNormal('binance', '4638-6966-0353-1345-92'), '463869660353134592');
  assert.equal(referenciaNormal('binance', 'abc'), null);
  assert.equal(referenciaNormal('mercadopago', '12345'), '12345');
  assert.equal(referenciaNormal('mercadopago', 'pi_123'), null);
  assert.equal(referenciaNormal('transferencia', '  CBU   123  '), 'CBU 123');
  assert.equal(referenciaNormal('otro', '   '), null);
});

test('las claves del recibo: el formulario usa su uuid, nunca la del mes', () => {
  assert.equal(claveDeRecibo({ tipo: 'pago', medio: 'creem', id: 'tran_1' }), 'pago:creem:tran_1');
  assert.equal(claveDeRecibo({ tipo: 'mensualidad', agenciaWs: 13, mes: '2026-11' }), 'mensualidad:13:2026-11');
  assert.equal(claveDeRecibo({ tipo: 'diferencial', agenciaWs: 13, clienteWs: 20, mes: '2026-11' }), 'diferencial:13:20:2026-11');
  assert.equal(claveDeRecibo({ tipo: 'form', uuid: 'AAAAAAAA-1111-4222-8333-444444444444' }), 'form:aaaaaaaa-1111-4222-8333-444444444444');
  assert.throws(() => claveDeRecibo({ tipo: 'mensualidad', agenciaWs: 13, mes: '2026-13' }));
  assert.throws(() => claveDeRecibo({ tipo: 'form', uuid: 'no-es-uuid' }));
});

// ── A quién le llega: un caso por renglón de «A quién le llega» ─────────────────────────────────────────────────

const sinAgencia = { agenciaWs: null, clienteWs: null, altaWs: null, email: 'Ana@Ejemplo.com', nombreCobro: 'Ana Pérez' } as const;

test('quien paga solo, sin cuenta: sólo correo, al correo del cobro', () => {
  const d = destinoDelRecibo({ ...sinAgencia });
  assert.equal(d.paga, 'solo');
  if (!('destinoWs' in d)) throw new Error('sin destino');
  assert.equal(d.destinoWs, null);
  assert.equal(d.emailSuelto, 'ana@ejemplo.com');
  assert.equal(d.soloCorreo, true);
  assert.equal(d.aNombre, 'Ana Pérez');
});

test('quien paga solo, con cuenta: a los admins de su cuenta (no al correo del cobro, que puede ser viejo) y a su grupo', () => {
  const d = destinoDelRecibo({ ...sinAgencia, altaWs: 40 });
  assert.equal(d.paga, 'solo');
  if (!('destinoWs' in d)) throw new Error('sin destino');
  assert.equal(d.destinoWs, 40);
  assert.equal(d.emailSuelto, null);
  assert.equal(d.soloCorreo, false);
});

test('cliente de agencia que paga él: a su cuenta, SÓLO correo (su grupo lo ven los admins de la agencia), a su nombre', () => {
  const d = destinoDelRecibo({ agenciaWs: 13, clienteWs: 20, quienPaga: 'cliente', altaWs: 20, email: 'x@y.com', nombreCobro: 'Codigo Inmobiliario', nombreAgencia: 'Código', nombreCliente: 'Sergio' });
  assert.equal(d.paga, 'cliente');
  if (!('destinoWs' in d)) throw new Error('sin destino');
  assert.equal(d.destinoWs, 20);
  assert.equal(d.soloCorreo, true);
  assert.equal(d.aNombre, 'Sergio');
});

test('cliente de agencia que paga la agencia: a la agencia y su grupo, NUNCA al correo del cobro (es del cliente), con el cliente en el renglón', () => {
  for (const quienPaga of ['agencia', null] as const) {
    const d = destinoDelRecibo({ agenciaWs: 13, clienteWs: 20, quienPaga, altaWs: 20, email: 'sergio@cliente.com', nombreCobro: 'Ficha de la agencia', nombreAgencia: 'Código Inmobiliario', nombreCliente: 'Sergio' });
    assert.equal(d.paga, 'agencia');
    if (!('destinoWs' in d)) throw new Error('sin destino');
    assert.equal(d.destinoWs, 13);
    assert.equal(d.emailSuelto, null);
    assert.equal(d.soloCorreo, false);
    assert.equal(d.aNombre, 'Código Inmobiliario');
    assert.equal(d.clienteEnElRenglon, 'Sergio');
  }
});

test('si no se pudo leer quién paga, TIRA: el recibo espera, nunca cae a «no es de agencia»', () => {
  assert.throws(() => destinoDelRecibo({ agenciaWs: 13, clienteWs: 20, quienPaga: undefined, altaWs: 20, email: 'x@y.com', nombreCobro: null }), /quién paga/);
});

test('con UNO solo de agencia o cliente es un cobro roto: sin destino (nunca el correo del cobro)', () => {
  assert.equal(destinoDelRecibo({ ...sinAgencia, agenciaWs: 13 }).paga, 'sin_destino');
  assert.equal(destinoDelRecibo({ ...sinAgencia, clienteWs: 20 }).paga, 'sin_destino');
});

test('los correos: los admins mandan sobre el correo suelto, en minúsculas y sin repetir', () => {
  assert.deepEqual(correosDelRecibo(['A@x.com', 'a@x.com', 'b@x.com'], 'otro@x.com'), ['a@x.com', 'b@x.com']);
  assert.deepEqual(correosDelRecibo([], 'Otro@x.com'), ['otro@x.com']);
  assert.deepEqual(correosDelRecibo([], null), []);
  assert.deepEqual(correosDelRecibo(['no es un correo'], null), []);
});

test('cargar a mano a una cuenta que paga su agencia se rechaza; la que se paga sola con agencia va sólo por correo', () => {
  assert.deepEqual(validarDestinoManual({ agencias: [], quienPaga: null }), { ok: true, soloCorreo: false });
  assert.deepEqual(validarDestinoManual({ agencias: [{ agenciaWs: 13, nombre: 'Código' }], quienPaga: 'cliente' }), { ok: true, soloCorreo: true });
  const r = validarDestinoManual({ agencias: [{ agenciaWs: 13, nombre: 'Código' }], quienPaga: null });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /la paga Código/);
});

// ── Lo que dice el documento ───────────────────────────────────────────────────────────────────────────────────

test('con Creem (merchant of record) el documento es una «Confirmación de pago» y lo dice; con Binance, un recibo', () => {
  assert.equal(rotulosDelDocumento(['creem']).titulo, 'Confirmación de pago');
  assert.equal(rotulosDelDocumento(['creem']).total, 'Total pagado');
  assert.equal(rotulosDelDocumento(['binance']).titulo, 'Recibo de pago');
  assert.equal(rotulosDelDocumento(['mercadopago']).nombre, 'Recibimos de');
  assert.match(leyendaDelMedio(['creem']) ?? '', /CREEM\.IO\* STORE/);
  assert.equal(leyendaDelMedio(['mercadopago', 'binance']), null);
});

test('el impuesto se dice sólo si es mayor que cero', () => {
  assert.equal(lineaDeImpuesto(0, 'USD', ['creem']), null);
  assert.equal(lineaDeImpuesto(null, 'USD', ['creem']), null);
  assert.match(lineaDeImpuesto(9.87, 'USD', ['creem']) ?? '', /Impuesto incluido: US\$ 9,87, lo cobra y remite Creem/);
});

test('el número, el nombre del PDF y la diferencia', () => {
  assert.equal(numeroEnTexto(3), '0003');
  assert.equal(nombreDelPdf({ numero: 3, mes: 'noviembre', aNombre: 'Código/Inmobiliario' }), 'MaKo - Recibo 0003 - noviembre - CódigoInmobiliario.pdf');
  assert.equal(diferencia(144, 'USDT', [{ moneda: 'USDT', monto: 146 }]), 2);
  assert.equal(diferencia(144, 'USD', [{ moneda: 'USDT', monto: 146 }]), null);
});

test('el correo dice que no es una factura fiscal, y el pie de WhatsApp NO dice el monto (el grupo lo ven otros)', () => {
  const c = textoCorreo({ numero: 3, monto: 'US$ 47', concepto: 'Plan Pro', fecha: '5/11', medio: 'Creem', aNombre: 'Ana', leyenda: leyendaDelMedio(['creem']), contacto: 'hola@ejemplo.com', titulo: 'Confirmación de pago' });
  assert.equal(c.asunto, 'Tu confirmación de pago de MaKo N.º 0003');
  assert.match(c.cuerpo, /no una factura fiscal/);
  assert.match(c.cuerpo, /US\$ 47 por Plan Pro, el 5\/11, por Creem/);
  assert.match(c.cuerpo, /CREEM\.IO/);
  const editado = textoCorreo({ numero: 3, monto: 'x', concepto: 'y', fecha: 'z', medio: 'w', aNombre: 'Ana', leyenda: null, contacto: 'c', titulo: 'Recibo de pago', asunto: 'Recibo {{numero}} de {{nombre}}' });
  assert.equal(editado.asunto, 'Recibo 0003 de Ana');
  assert.match(editado.cuerpo, /no una factura fiscal/);
  const pie = pieWhatsApp(3);
  assert.equal(pie.split('\n')[0], 'Recibo de pago N.º 0003. El detalle está en el PDF.');
  assert.doesNotMatch(pie, /\d+\s*(USD|USDT|US\$)|\$\s*\d/);
});

test('la base contesta con marcas, y la persona lee una frase', () => {
  assert.equal(textoDeOcupado('RECIBO_OCUPADO 2 463869660353134592'), 'Esa orden (463869660353134592) ya está en el recibo N.º 0002.');
  assert.equal(textoDeOcupado('otra cosa'), null);
});

test('el emisor sin datos es «MaKo · hola-mako.com» y nunca se inventa un dato fiscal', () => {
  const e = emisorDe(null);
  assert.equal(e.nombre, 'MaKo · hola-mako.com');
  assert.equal(e.documento, null);
  assert.equal(emisorDe('{"nombre":"  Mi Empresa  ","documento":"CUIT 1"}').documento, 'CUIT 1');
});

// ── El envío: cuándo se toma, cuándo se rinde ──────────────────────────────────────────────────────────────────

const AHORA = Date.parse('2026-11-05T20:00:00Z');
const hace = (ms: number) => new Date(AHORA - ms).toISOString();

test('el correo: pendiente se toma; un enviando de 10 min se retoma; uno de más de 23 h se rinde; un anulado no sale', () => {
  const base = { estado: 'emitido', correo_intentos: 0, correo_tomado_at: null as string | null, updated_at: hace(0) };
  assert.equal(decidirCorreo({ ...base, correo_estado: 'pendiente' }, AHORA), 'tomar');
  assert.equal(decidirCorreo({ ...base, correo_estado: 'enviando', correo_tomado_at: hace(60_000), updated_at: hace(60_000) }, AHORA), 'nada');
  assert.equal(decidirCorreo({ ...base, correo_estado: 'enviando', correo_tomado_at: hace(11 * 60_000), updated_at: hace(11 * 60_000) }, AHORA), 'tomar');
  assert.equal(decidirCorreo({ ...base, correo_estado: 'enviando', correo_tomado_at: hace(HORAS_23 + 1), updated_at: hace(11 * 60_000) }, AHORA), 'rendirse');
  assert.equal(decidirCorreo({ ...base, correo_estado: 'fallo', correo_intentos: 2, correo_tomado_at: hace(3600_000), updated_at: hace(31 * 60_000) }, AHORA), 'tomar');
  assert.equal(decidirCorreo({ ...base, correo_estado: 'fallo', correo_intentos: 5, correo_tomado_at: hace(3600_000), updated_at: hace(31 * 60_000) }, AHORA), 'nada');
  for (const estado of ['anulado', 'devuelto']) assert.equal(decidirCorreo({ ...base, estado, correo_estado: 'pendiente' }, AHORA), 'nada');
});

test('WhatsApp: una vez y sin reintento; un enviando de 10 min es «no sé si salió»', () => {
  assert.equal(decidirWa({ estado: 'emitido', wa_estado: 'pendiente', wa_tomado_at: null }, AHORA), 'tomar');
  assert.equal(decidirWa({ estado: 'emitido', wa_estado: 'fallo', wa_tomado_at: hace(3600_000) }, AHORA), 'nada');
  assert.equal(decidirWa({ estado: 'emitido', wa_estado: 'enviando', wa_tomado_at: hace(11 * 60_000) }, AHORA), 'rendirse');
  assert.equal(decidirWa({ estado: 'anulado', wa_estado: 'pendiente', wa_tomado_at: null }, AHORA), 'nada');
});

test('la clave de envío es una por destinatario y cambia con el lote; el 409 concurrente se reintenta', () => {
  assert.notEqual(claveDeEnvio(3, 1, 'a@x.com'), claveDeEnvio(3, 1, 'b@x.com'));
  assert.notEqual(claveDeEnvio(3, 1, 'a@x.com'), claveDeEnvio(3, 2, 'a@x.com'));
  assert.equal(claveDeEnvio(3, 1, 'A@x.com '), claveDeEnvio(3, 1, 'a@x.com'));
  assert.equal(esConcurrenteDeResend(409, 'concurrent_idempotent_requests'), true);
  assert.equal(esConcurrenteDeResend(409, 'invalid_idempotent_request'), false);
});

// ── La máquina de estados de la devolución ─────────────────────────────────────────────────────────────────────

test('devolución: parcial y después total avisan dos veces y nunca más; si el original no salió, no se avisa', () => {
  const r0 = { estado: 'emitido' as const, correo_estado: 'enviado', devolucion_avisada: null };
  const p = transicionRecibo(r0, { tipo: 'devolucion', total: false });
  assert.deepEqual(p, { estado: 'devuelto_parcial', avisar: 'devuelto_parcial' });
  const t = transicionRecibo({ ...r0, estado: 'devuelto_parcial', devolucion_avisada: 'devuelto_parcial' }, { tipo: 'devolucion', total: true });
  assert.deepEqual(t, { estado: 'devuelto', avisar: 'devuelto' });
  assert.deepEqual(transicionRecibo({ ...r0, estado: 'devuelto', devolucion_avisada: 'devuelto' }, { tipo: 'devolucion', total: true }), { estado: 'devuelto', avisar: null });
  assert.deepEqual(transicionRecibo({ ...r0, estado: 'devuelto', devolucion_avisada: 'devuelto' }, { tipo: 'devolucion', total: false }), { estado: 'devuelto', avisar: null });
  assert.deepEqual(transicionRecibo({ ...r0, correo_estado: 'no_va' }, { tipo: 'devolucion', total: true }), { estado: 'devuelto', avisar: null });
});

test('devolución fallida vuelve a emitido sólo si no sigue devuelto; un anulado no cambia nunca', () => {
  const dev = { estado: 'devuelto' as const, correo_estado: 'enviado', devolucion_avisada: 'devuelto' };
  assert.equal(transicionRecibo(dev, { tipo: 'devolucion_fallida', sigueDevuelto: false }).estado, 'emitido');
  assert.equal(transicionRecibo(dev, { tipo: 'devolucion_fallida', sigueDevuelto: true }).estado, 'devuelto');
  assert.equal(transicionRecibo({ ...dev, estado: 'anulado' }, { tipo: 'devolucion', total: true }).estado, 'anulado');
});

test('contracargo: sin saber si la plata salió no cambia; resuelto a favor no pisa un devuelto', () => {
  const r = { estado: 'emitido' as const, correo_estado: 'enviado', devolucion_avisada: null };
  assert.equal(transicionRecibo(r, { tipo: 'contracargo', plataAfuera: null }).estado, 'emitido');
  assert.equal(transicionRecibo(r, { tipo: 'contracargo', plataAfuera: true }).estado, 'contracargo');
  assert.equal(transicionRecibo({ ...r, estado: 'contracargo' }, { tipo: 'contracargo', plataAfuera: false }).estado, 'emitido');
  assert.equal(transicionRecibo({ ...r, estado: 'devuelto' }, { tipo: 'contracargo', plataAfuera: false }).estado, 'devuelto');
  assert.equal(transicionRecibo(r, { tipo: 'contracargo', plataAfuera: true }).avisar, null);
});

test('el total del registro: sin anulados, los devueltos aparte, y sin el impuesto que cobra Creem', () => {
  const t = totalesDelRegistro([
    { estado: 'emitido', totales_recibido: [{ moneda: 'USDT', monto: 238 }], impuesto: null, medios: ['binance'] },
    { estado: 'emitido', totales_recibido: [{ moneda: 'USD', monto: 56.87 }], impuesto: 9.87, medios: ['creem'] },
    { estado: 'anulado', totales_recibido: [{ moneda: 'USDT', monto: 1000 }], impuesto: null, medios: ['binance'] },
    { estado: 'devuelto', totales_recibido: [{ moneda: 'ARS', monto: 73555 }], impuesto: null, medios: ['mercadopago'] },
  ]);
  assert.deepEqual(t.vigentes, { USDT: 238, USD: 47 });
  assert.deepEqual(t.devueltos, { ARS: 73555 });
});

// ── El PDF ────────────────────────────────────────────────────────────────────────────────────────────────────

const PNG = new Uint8Array(readFileSync(new URL('../public/icon-maskable-512.png', import.meta.url)));
const foto = (o: Partial<FotoRecibo> = {}): FotoRecibo => ({
  numero: 2, aNombre: 'Código Inmobiliario', emitidoAt: '2026-11-05T19:07:00Z', zona: 'America/Argentina/Buenos_Aires', emisor: emisorDe(null),
  lineas: [{ concepto: 'Plan Pro', mes: 'noviembre', monto: 97, moneda: 'USD' }, { concepto: 'Brigitte 🙂', mes: 'noviembre', monto: 47, moneda: 'USD' }],
  totalDetalle: 144, monedaDetalle: 'USD', totales: [{ moneda: 'USDT', monto: 238 }], impuesto: null,
  pagos: [
    { medio: 'binance', referencia: '463869660353134592', fecha: '2026-11-05T01:42:23Z', monto: 94, moneda: 'USDT' },
    { medio: 'binance', referencia: '463975050149208064', fecha: '2026-11-05T15:20:19Z', monto: 144, moneda: 'USDT' },
  ],
  notaPdf: 'Cubre hasta el 4/12/2026. Desde el 5/12 entra en el pago de diciembre.', ...o,
});

async function textoDe(pdf: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(pdf)), { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : text;
}

test('el PDF es determinista: dos renders, los mismos bytes (si no, Resend contesta 409 al reintentar)', async () => {
  const a = await pdfDelRecibo(foto(), [{ bytes: PNG, mime: 'image/png', fecha: '2026-11-05T01:42:23Z', medio: 'binance' }]);
  await new Promise((r) => setTimeout(r, 1100));
  const b = await pdfDelRecibo(foto(), [{ bytes: PNG, mime: 'image/png', fecha: '2026-11-05T01:42:23Z', medio: 'binance' }]);
  assert.equal(Buffer.compare(Buffer.from(a), Buffer.from(b)), 0);
});

test('el PDF se lee: número, totales, las órdenes, la nota, «No es una factura fiscal» y la página de comprobantes', async () => {
  const pdf = await pdfDelRecibo(foto(), [{ bytes: PNG, mime: 'image/png', fecha: '2026-11-05T01:42:23Z', medio: 'binance' }]);
  const texto = (await textoDe(pdf)).replace(/\s+/g, ' ');
  for (const esperado of ['Recibo de pago', 'N.º 0002', 'Recibimos de', 'Código Inmobiliario', 'Total recibido', '238 USDT', 'Qué se pagó', 'US$ 144',
    'Cómo se pagó', 'Order ID', '463975050149208064', 'Cubre hasta el 4/12/2026', 'No es una factura fiscal', 'Comprobante de Binance']) {
    assert.ok(texto.includes(esperado), `falta «${esperado}» en el PDF`);
  }
  // Las horas en la zona del negocio (ART), no en la de la máquina.
  assert.ok(texto.includes(fechaConHora('2026-11-05T15:20:19Z', 'America/Argentina/Buenos_Aires')));
  assert.ok(texto.includes('05/11/2026 12:20:19'));
});

test('el PDF de Creem es una «Confirmación de pago», con la línea del impuesto y la leyenda', async () => {
  const pdf = await pdfDelRecibo(foto({
    numero: 3, aNombre: 'Ana', lineas: [{ concepto: 'Plan Pro', monto: 47, moneda: 'USD' }], totalDetalle: 47, monedaDetalle: 'USD',
    totales: [{ moneda: 'USD', monto: 56.87 }], impuesto: 9.87, pagos: [{ medio: 'creem', referencia: 'tran_1', fecha: '2026-11-05T15:20:19Z', monto: 56.87, moneda: 'USD' }], notaPdf: null,
  }));
  const texto = (await textoDe(pdf)).replace(/\s+/g, ' ');
  assert.ok(texto.includes('Confirmación de pago'));
  assert.ok(texto.includes('Total pagado'));
  assert.ok(texto.includes('Impuesto incluido: US$ 9,87'));
  assert.ok(texto.includes('CREEM.IO* STORE'));
  assert.ok(!texto.includes('Recibimos de'));
});

test('lee las medidas de un PNG y de un JPEG por sus bytes', () => {
  assert.deepEqual(medidaDeImagen(PNG), { w: 512, h: 512 });
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x00, 0xc8, 0x03, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(medidaDeImagen(jpeg), { w: 200, h: 300 });
  assert.equal(medidaDeImagen(new Uint8Array([1, 2, 3])), null);
});

// ── El cableado: lo que el código tiene que seguir haciendo ───────────────────────────────────────────────────

test('`emitir_recibo` (el único que da números) lo llama sólo lib/recibos.ts', () => {
  // Las LLAMADAS (por PostgREST o por SQL), no las menciones en un comentario.
  const salida = execFileSync('git', ['grep', '-lE', "rpc\\('emitir_recibo'|from emitir_recibo\\(", '--', 'lib', 'app', 'scripts'], { cwd: RAIZ, encoding: 'utf8' });
  const archivos = salida.split('\n').filter(Boolean).filter((f) => !f.endsWith('.md'));
  // El script de carga de 0001 y 0002 también la llama: con número forzado, que sólo acepta un número ya gastado y libre.
  // Y la prueba de la 0397 contra un Postgres de verdad (PGlite, scripts/probar-0397-pglite.mjs), que no toca ninguna base.
  assert.deepEqual(archivos.sort(), ['lib/recibos.ts', 'scripts/probar-0397-pglite.mjs', 'scripts/recibos-cargar-codigo.mts'].sort());
});

test('el texto que el PDF imprime y el pie fijo: «No es una factura fiscal» no es editable', () => {
  const src = leer('lib/recibos-reglas.ts');
  assert.match(src, /export const PIE_FIJO = \(aNombre: string\): string => `Este recibo acredita el pago\. No es una factura fiscal\./);
  assert.match(leer('lib/recibo-pdf.ts'), /PIE_FIJO\(f\.aNombre\)/);
});

test('un invitado del grupo no ve el recibo (la fila ni el push): trae lo que pagó la agencia', async () => {
  const { laVeUnInvitado } = await import('../lib/grupo-reglas');
  assert.equal(laVeUnInvitado({ id: 10, aviso_tipo: 'recibo' }, 0), false);
  assert.equal(laVeUnInvitado({ id: 10, aviso_tipo: null }, 0), true);
  // Y el conteo de no leídos del invitado resta los mismos (lib/grupo-app.ts).
  assert.match(leer('lib/grupo-app.ts'), /const deAgencia = \[\.\.\.avisosParaAgencia\(\), \.\.\.AVISOS_QUE_NO_VE_UN_INVITADO\];/);
});

test('las fechas sin zona del formulario son la hora de la plataforma, también en el salto de horario', () => {
  assert.equal(instanteDeLaFecha('2026-11-05T12:20', 'America/Argentina/Buenos_Aires'), '2026-11-05T15:20:00.000Z');
  assert.equal(instanteDeLaFecha('2026-11-05T12:20:19-03:00', 'UTC'), '2026-11-05T15:20:19.000Z');
  // Tijuana el 8/3 a las 9:00 es el día del salto (lib/cron-aviso.ts): con una sola pasada daba las 10.
  assert.equal(instanteDeLaFecha('2026-03-08T09:00', 'America/Tijuana'), '2026-03-08T16:00:00.000Z');
  assert.equal(instanteDeLaFecha('cualquier cosa', 'UTC'), null);
});

test('el aviso de devolución que falta: una vez por estado y sólo si el original salió', () => {
  assert.equal(devolucionPorAvisar({ estado: 'devuelto', correo_estado: 'enviado', devolucion_avisada: null }), 'devuelto');
  assert.equal(devolucionPorAvisar({ estado: 'devuelto', correo_estado: 'enviado', devolucion_avisada: 'devuelto_parcial' }), 'devuelto');
  assert.equal(devolucionPorAvisar({ estado: 'devuelto', correo_estado: 'enviado', devolucion_avisada: 'devuelto' }), null);
  assert.equal(devolucionPorAvisar({ estado: 'devuelto_parcial', correo_estado: 'enviado', devolucion_avisada: null }), 'devuelto_parcial');
  assert.equal(devolucionPorAvisar({ estado: 'devuelto', correo_estado: 'reboto', devolucion_avisada: null }), null);
  assert.equal(devolucionPorAvisar({ estado: 'emitido', correo_estado: 'enviado', devolucion_avisada: null }), null);
});

test('un comprobante es SÓLO JPEG o PNG por sus bytes', () => {
  assert.equal(sniffComprobante(PNG), 'image/png');
  assert.equal(sniffComprobante(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffComprobante(new TextEncoder().encode('GIF89a')), null);
  assert.equal(sniffComprobante(new TextEncoder().encode('RIFF....WEBP')), null);
});

test('el gancho en el cobro: el recibo se emite ANTES del CRM y sale al FINAL; las devoluciones no tiran', () => {
  const src = leer('lib/cobros.ts');
  const ini = src.indexOf('export async function aplicarPagoAprobado(');
  const cuerpo = src.slice(ini, src.indexOf('\n}\n', ini));
  const emite = cuerpo.indexOf('await reciboDeEstePago(actual, p, renovacion)');
  const crm = cuerpo.indexOf('await prepararTratoDelPago(');
  const sale = cuerpo.indexOf('await despacharRecibo(reciboId)');
  const aviso = cuerpo.indexOf('await avisarPagoRecibido(');
  for (const [n, i] of [['emite', emite], ['crm', crm], ['sale', sale], ['aviso', aviso]] as const) assert.ok(i > 0, `no encontré «${n}» en aplicarPagoAprobado`);
  assert.ok(emite < crm, 'el recibo se emite antes del CRM (que puede tirar)');
  assert.ok(sale > aviso, 'el recibo sale después del aviso y del CRON: si Resend se cuelga, eso ya pasó');
  assert.match(cuerpo, /const reciboId = await reciboDeEstePago\(actual, p, renovacion\)\s*\.catch\(/, 'un recibo nunca frena un pago');
  // Sólo la plataforma y pagos reales, en positivo.
  const helper = src.slice(src.indexOf('async function reciboDeEstePago('), src.indexOf('export async function cobradoEnLaPasarela('));
  assert.match(helper, /if \(c\.modo !== 'real'\) return null;\s*if \(c\.workspace_id !== \(await wsSuperAdmin\(\)\)\) return null;/);
  for (const fn of ['aplicarReembolso', 'aplicarReembolsoFallido', 'aplicarContracargo']) {
    const i = src.indexOf(`export async function ${fn}(`);
    assert.match(src.slice(i, i + 900), /await conElReciboDelPago\(c, /, `${fn} no toca el recibo`);
  }
  const con = src.slice(src.indexOf('async function conElReciboDelPago('), src.indexOf('/** ¿La cuota de un link ya estaba cobrada'));
  assert.match(con, /try \{\s*if \(c\.modo !== 'real' \|\| c\.workspace_id !== \(await wsSuperAdmin\(\)\)\) return;/);
  assert.match(con, /\} catch \(e\) \{/);
});

test('la red: el cron de cobros emite lo que falta y despacha lo pendiente, sin cortar la respuesta', () => {
  const src = leer('app/api/cron/cobros-reconciliar/route.ts');
  assert.match(src, /recibosQueFaltan\(\{ hasta, leerCobro: getCobro, releer: cobradoEnLaPasarela \}\)/);
  assert.match(src, /despacharPendientes\(\{ hasta \}\)/);
  assert.match(src, /\}\)\(\)\.catch\(\(e\) => \(\{ error: msg\(e\) \}\)\);/);
});

test('la API de MaKo: los recibos son sólo de la plataforma, sin HTTP, y lo que escribe se confirma en pantalla y no va en un flujo', () => {
  const ver = porId('ver_recibos');
  assert.ok(ver && esLectura(ver), 'ver_recibos es una lectura');
  for (const id of ['ver_recibos', 'cargar_pago_a_mano', 'reenviar_recibo']) {
    const d = porId(id);
    assert.ok(d, `falta «${id}» en el registro`);
    assert.deepEqual(d.gating, { rolMinimo: 'admin', soloPlataforma: true }, `«${id}» es sólo del super admin de la plataforma`);
    assert.ok(!d.canales.includes('http'), `«${id}» no sale por HTTP: son los pagos de todos los negocios`);
  }
  for (const id of ['cargar_pago_a_mano', 'reenviar_recibo']) {
    const d = porId(id)!;
    assert.ok(esAccion(d) && d.confirmacion === 'pantalla', `«${id}» se confirma en una pantalla, nunca con un «sí» del chat`);
  }
  const flujo = leer('lib/api-mako/flujo.ts');
  const bloque = flujo.slice(flujo.indexOf('export const NO_EN_FLUJOS'), flujo.indexOf(']);', flujo.indexOf('export const NO_EN_FLUJOS')));
  for (const id of ['cargar_pago_a_mano', 'reenviar_recibo']) assert.ok(bloque.includes(`'${id}'`), `«${id}» no va en un flujo: se confirmaría solo`);
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO (5/11/2026, base: 36 pases y 0 fallos; cada rotura restaurada de memoria y comprobada con md5):
//   · `destinoDelRecibo` mandando `emailSuelto` también con agencia → 1 rojo «paga la agencia… NUNCA al correo del cobro».
//   · `destinoDelRecibo` sin el `throw` de la lectura que falla → 1 rojo «si no se pudo leer quién paga, TIRA».
//   · `decidirCorreo` sin el corte de las 23 h → 1 rojo «el correo: … uno de más de 23 h se rinde».
//   · `decidirCorreo` sin mirar `estado !== 'emitido'` → 1 rojo, el mismo caso (un anulado salía).
//   · `transicionRecibo` avisando aunque el original no salió → 1 rojo «si el original no salió, no se avisa».
//   · `pdfDelRecibo` sin `setCreationDate` ni `setFileId` → 1 rojo «el PDF es determinista».
//   · `rotulosDelDocumento` con el título de siempre para Creem → 2 rojos (la regla y el PDF).
//   · `pieWhatsApp` con el monto en el segundo renglón → 1 rojo «el pie de WhatsApp NO dice el monto».
//   · `totalesDelRegistro` sumando los anulados → 1 rojo «el total del registro».
//   · `AVISOS_QUE_NO_VE_UN_INVITADO` vacía → 1 rojo «un invitado del grupo no ve el recibo».
//   · `sniffComprobante` aceptando un GIF → 1 rojo «SÓLO JPEG o PNG».
//   · `reciboDeEstePago` sin el corte de la plataforma → 1 rojo «el gancho en el cobro».
//   · `ver_recibos` con `http`, y los recibos sacados de `NO_EN_FLUJOS` → 1 rojo cada uno «la API de MaKo».
//   El arnés: un .mjs que reemplaza un ancla única, corre este archivo y escribe el original de vuelta (no se versiona).
// ─────────────────────────────────────────────────────────────────────────────
