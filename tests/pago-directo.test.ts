// =============================================================================
// «Transferencia o Binance» al precio de lista, y las pasarelas con +5 %, en el checkout, para todos (18/11/2026, Martín)
// =============================================================================
// Lo puro (el recargo de pasarela, los montos, los textos del comprobante, los medios disponibles), el pedido (el medio viaja, el MONTO nunca) y
// la pantalla dibujada (la fila se ve sólo con datos cargados; nada dice «se activa sola»).
// Probado rompiendo: al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RECARGO_PASARELA, canalDelPago } from '../lib/partners-reglas';
import {
  CLAVE_PAGO_DIRECTO, conRecargoDePasarela, DATOS_VACIOS, datosDeSetting, datosLimpios, mediosDisponibles, montoDelMedio, textoDelComprobante, urlDeEmail, urlDeWhatsApp,
  type DatosDePagoDirecto,
} from '../lib/pago-directo-reglas';
import { leerPedidoCompra } from '../lib/compra-plan-reglas';
import { CompraPlan } from '../app/planes/[plan]/CompraPlan';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const DATOS: DatosDePagoDirecto = { binancePayId: 'PAYID-DE-PRUEBA', linkBinance: 'https://app.binance.com/uni-qr/ejemplo', linkTransferencia: 'https://mpago.la/ejemplo', alias: 'alias.de.prueba', cvu: null, titular: 'Titular de prueba', whatsapp: '5491100000000', email: 'cobros@ejemplo.com' };

test('el modelo (18/11, tarde): el precio de lista es el de transferencia o Binance; la pasarela cobra lista + 5 % (RECARGO_PASARELA), para todos', () => {
  assert.equal(RECARGO_PASARELA, 0.05);
  assert.match(fuente('lib/partners-reglas.ts'), /export const RECARGO_PASARELA = 0\.05;/);
  assert.doesNotMatch(fuente('lib/partners-reglas.ts'), /DESCUENTO_PAGO_DIRECTO/, 'ya no hay descuento por pagar directo');
  // Dólares: a centavos. Pesos: al millar hacia arriba.
  assert.equal(conRecargoDePasarela(97, 'USD'), 101.85);
  assert.equal(conRecargoDePasarela(47, 'USD'), 49.35);
  assert.equal(conRecargoDePasarela(166000, 'ARS'), 175000, '174.300 → 175.000');
  assert.equal(conRecargoDePasarela(81000, 'ARS'), 86000, '85.050 → 86.000');
  assert.equal(conRecargoDePasarela(100000, 'ARS'), 105000, 'justo en un millar: no sube de más');
  assert.equal(conRecargoDePasarela(1000, 'MXN'), 1050, 'otra moneda local: a centavos, sin el millar de los pesos argentinos');
});

test('transferencia y Binance cobran el precio de LISTA, sin descuento: Pro 97 USDT, Essential 47, los pesos tal cual', () => {
  assert.deepEqual(montoDelMedio('binance', { precioUsd: 97, precioArs: 166000 }), { monto: 97, moneda: 'USD' });
  assert.deepEqual(montoDelMedio('binance', { precioUsd: 47, precioArs: 81000 }), { monto: 47, moneda: 'USD' });
  assert.deepEqual(montoDelMedio('transferencia', { precioUsd: 97, precioArs: 166000 }), { monto: 166000, moneda: 'ARS' });
  assert.equal(montoDelMedio('transferencia', { precioUsd: 97, precioArs: null }), null, 'sin precio en pesos, no hay transferencia');
});

test('LO QUE SE MUESTRA ES LO QUE SE COBRA: el recargo se aplica en UN punto (`ofertaDelPlan`), del que sale el monto de la página y el del cobro', () => {
  const c = fuente('lib/compra-plan.ts');
  assert.match(c, /monto: lista == null \? null : conRecargoDePasarela\(lista, m\.moneda\)/, 'la oferta trae lista + 5 %');
  assert.match(c, /const via = pasarelas\.find\(\(x\) => x\.pasarela === eleccion\.pasarela\)!;/, 'el cobro sale de esa misma oferta');
  assert.match(c, /monto: via\.monto, moneda: via\.moneda, montoUsd: conRecargoDePasarela\(plan\.precioUsd, 'USD'\)/, 'y lo que entra en dólares lleva el recargo');
});

test('los datos de MaKo NO se inventan: sin ninguno la opción no se ofrece, y cada medio pide su dato', () => {
  assert.deepEqual(mediosDisponibles(DATOS_VACIOS), [], 'el repo no trae ningún dato cargado');
  assert.ok(Object.values(DATOS_VACIOS).every((v) => v === null));
  assert.deepEqual(datosDeSetting(null), DATOS_VACIOS, 'sin setting, sin datos');
  assert.deepEqual(datosDeSetting('esto no es json'), DATOS_VACIOS, 'un setting roto no muestra nada');
  assert.deepEqual(mediosDisponibles({ ...DATOS, alias: null, cvu: null, linkTransferencia: null }), ['binance']);
  assert.deepEqual(mediosDisponibles({ ...DATOS, binancePayId: null, alias: null, cvu: null, linkTransferencia: null }), ['binance'], 'con sólo un link de Binance Pay alcanza');
  assert.deepEqual(mediosDisponibles({ ...DATOS, binancePayId: null, linkBinance: null, alias: null, cvu: null }), ['transferencia'], 'con sólo el link de Mercado Pago alcanza');
  assert.deepEqual(mediosDisponibles({ ...DATOS, binancePayId: null, linkBinance: null }), ['transferencia']);
  assert.deepEqual(mediosDisponibles({ ...DATOS, binancePayId: null, linkBinance: null, linkTransferencia: null, alias: null, cvu: '0000003100000000000001' }), ['transferencia']);
});

test('los datos viven en un SETTING editable (no en una constante) y se limpian: lo que no se entiende no se muestra a un cliente', () => {
  assert.equal(CLAVE_PAGO_DIRECTO, 'planes.pago_directo');
  const l = datosLimpios({ binancePayId: '  123 456  ', linkBinance: 'https://app.binance.com/uni-qr/68G3kuwL', linkTransferencia: 'https://mpago.la/abc', alias: 'mako.cobros', cvu: '', titular: 'MaKo SRL', whatsapp: '+54 9 11 2233-4455', email: 'COBROS@Mako.com' });
  assert.deepEqual(l, { binancePayId: '123 456', linkBinance: 'https://app.binance.com/uni-qr/68G3kuwL', linkTransferencia: 'https://mpago.la/abc', alias: 'mako.cobros', cvu: null, titular: 'MaKo SRL', whatsapp: '5491122334455', email: 'cobros@mako.com' });
  const m = datosLimpios({ whatsapp: '12345', email: 'no-es-email', alias: 42 });
  assert.equal(m.whatsapp, null, 'un WhatsApp con pocos dígitos');
  assert.equal(m.email, null);
  assert.equal(m.alias, null);
  assert.deepEqual(datosDeSetting(JSON.stringify(l)), l);
  // Quién lo lee y lo guarda: la página pública con el cliente de servicio; Settings › Payments sólo el super admin.
  const srv = fuente('lib/pago-directo.ts');
  assert.match(srv, /\.eq\('workspace_id', ws\)\.eq\('key', CLAVE_PAGO_DIRECTO\)/);
  assert.match(srv, /no se muestra/, 'si no se puede leer, la opción no se muestra');
  const acc = fuente('app/admin/cobros/actions.ts');
  const a = acc.slice(acc.indexOf('export async function guardarPagoDirectoAction'));
  assert.match(a.slice(0, 220), /const admin = await getSesionAdmin\(\);\s+if \(!admin\) return/, 'getSesionAdmin en la primera línea');
  assert.match(fuente('app/admin/_polar/web/Settings/OrganizationPaymentSettings.tsx'), /guardarPagoDirectoAction\(valores as unknown/);
});

test('Binance: el QR personal de «Recibir» (permanente, quien paga pone el monto): monto en USDT grande, QR en la PC, botón en el teléfono, Pay ID siempre', () => {
  assert.equal(datosLimpios({ linkBinance: 'https://app.binance.com/uni-qr/68G3kuwL' }).linkBinance, 'https://app.binance.com/uni-qr/68G3kuwL');
  assert.equal(datosLimpios({ linkBinance: 'http://app.binance.com/uni-qr/x' }).linkBinance, null, 'sólo https');
  assert.equal(datosLimpios({ linkBinance: 'javascript:alert(1)' }).linkBinance, null);
  assert.deepEqual(mediosDisponibles({ ...DATOS_VACIOS, linkBinance: 'https://app.binance.com/uni-qr/x' }), ['binance'], 'con sólo el link alcanza');
  const f = fuente('app/planes/[plan]/CompraPlan.tsx');
  assert.match(f, /PAGAR CON BINANCE/);
  assert.match(f, /Ingresa exactamente <b>\{formatoDelMonto\(montoDirecto\)\}<\/b> en USDT/, 'quien paga pone el monto: va escrito');
  assert.match(f, /<img src=\{p\.directo\.qrBinance\}/, 'el QR dibujado desde el link');
  assert.match(f, /@media \(min-width:768px\)\{\.ck-binance-qr\{display:flex\}\.ck-binance-movil\{display:none!important\}\}/, 'QR en la PC, botón en el teléfono');
  assert.match(f, /<DatoCopiable etiqueta="Binance Pay ID"/, 'el Pay ID con «Copiar» queda siempre');
  assert.doesNotMatch(f, /linkDeBinance|linksBinance/, 'ya no hay un link por plan: los «payment request» vencen a los 30 días');
  const p = fuente('app/planes/[plan]/page.tsx');
  assert.match(p, /QRCode\.toDataURL\(datosDirectos\.linkBinance/, 'el QR se dibuja en el servidor');
  assert.match(p, /nombrePlan: plan\.nombre, qrBinance \}/);
});

test('los botones del comprobante: wa.me y mailto con el texto armado, y sin el contacto no hay botón', () => {
  const texto = textoDelComprobante({ nombre: 'Ana Pérez', plan: 'MaKo Pro', medio: 'binance', monto: { monto: 97, moneda: 'USD' } });
  assert.match(texto, /Ana Pérez/);
  assert.match(texto, /MaKo Pro/);
  assert.match(texto, /Binance: US\$ 97/);
  assert.doesNotMatch(texto, /descuento/i, 'ya no hay descuento: es el precio de lista');
  assert.equal(urlDeWhatsApp(DATOS.whatsapp, texto), `https://wa.me/5491100000000?text=${encodeURIComponent(texto)}`);
  assert.equal(urlDeWhatsApp(null, texto), null);
  assert.match(urlDeEmail(DATOS.email, 'Comprobante', texto)!, /^mailto:cobros@ejemplo\.com\?subject=Comprobante&body=/);
  assert.equal(urlDeEmail(null, 'x', texto), null);
});

test('el pedido: viaja el MEDIO (nunca el monto) y entra como «Quiero»; un medio raro se ignora', () => {
  const base = { plan: 'pro', nombre: 'Ana', email: 'ana@ejemplo.com', whatsapp: '5491122334455' };
  const a = leerPedidoCompra({ ...base, medioDirecto: 'binance', monto: 1 });
  assert.ok(a.ok && a.pedido.quiero && a.pedido.medioDirecto === 'binance');
  assert.ok(!('monto' in (a.ok ? a.pedido : {})), 'el pedido nunca trae precio');
  const b = leerPedidoCompra({ ...base, medioDirecto: 'transferencia' });
  assert.ok(b.ok && b.pedido.quiero && b.pedido.medioDirecto === 'transferencia');
  const c = leerPedidoCompra({ ...base, medioDirecto: 'paypal', pasarela: 'mercadopago' });
  assert.ok(c.ok && !c.pedido.quiero && c.pedido.medioDirecto == null);
  const d = leerPedidoCompra({ ...base, whatsapp: '', medioDirecto: 'binance' });
  assert.ok(!d.ok, 'sin WhatsApp no se da de alta a nadie');
});

test('el aviso al equipo lleva el medio y el monto de lista, y dice que falta VERIFICAR (no promete activar solo)', () => {
  const c = fuente('lib/compra-plan.ts');
  assert.match(c, /const directo = p\.medioDirecto && elegido/);
  assert.match(c, /montoDelMedio\(p\.medioDirecto, \{ precioUsd: elegido\.precioUsd, precioArs: precioEnPesos\(elegido\) \}\)/, 'el monto sale del plan, no del cliente');
  assert.match(c, /Falta VERIFICAR que la plata entró \(todavía no se verifica sola\) y darle de alta a mano\./);
  assert.match(c, /detalle: `Quiere \$\{nombrePlan\}\$\{dePago\}`/, '«Quieren entrar» también lo dice');
});

test('a un referido que paga así le cuenta el canal directo; y por pasarela también el 30 % de la lista (el canal es sólo un dato)', () => {
  assert.equal(canalDelPago({ proveedor: null, metodo: 'cripto' }), 'directo', 'Binance');
  assert.equal(canalDelPago({ proveedor: null, metodo: 'transferencia' }), 'directo');
});

test('la pantalla: la fila «Transferencia o Binance» (sin chip de descuento) sólo se dibuja con datos; las pasarelas dicen que incluyen su costo; ningún texto dice que se activa sola', () => {
  const props = { plan: 'pro', ladaInicial: '54', pasarelas: [{ pasarela: 'mercadopago' as const, moneda: 'ARS', monto: 166000 }], origen: null, refCodigo: null };
  const sin = renderToStaticMarkup(createElement(CompraPlan, props));
  assert.doesNotMatch(sin, /Transferencia o Binance/, 'sin datos de MaKo, no hay fila');
  const con = renderToStaticMarkup(createElement(CompraPlan, {
    ...props, directo: { medios: ['binance', 'transferencia'], montos: { binance: { monto: 97, moneda: 'USD' }, transferencia: { monto: 166000, moneda: 'ARS' } }, datos: DATOS, nombrePlan: 'MaKo Pro', qrBinance: null },
  }));
  assert.match(con, /Transferencia o Binance/);
  assert.doesNotMatch(con, /OFF|descuento/, 'sin chip ni texto de descuento');
  assert.match(con, /Incluye el costo de la pasarela/, 'la línea chica de cada pasarela');
  assert.doesNotMatch(con, /se activa sola|activa automáticamente/i);
  const f = fuente('app/planes/[plan]/CompraPlan.tsx');
  assert.match(f, /ENVIAR COMPROBANTE POR WHATSAPP/);
  assert.match(f, /Enviar por email/);
  assert.match(f, /Confirmar mi pedido/);
  assert.match(f, /quiero: true, medioDirecto,/, 'al confirmar entra por el flujo de «Quiero»');
  assert.doesNotMatch(f.slice(f.indexOf('quiero: true, medioDirecto,'), f.indexOf('quiero: true, medioDirecto,') + 200), /monto/, 'el monto no viaja');
  const p = fuente('app/planes/[plan]/page.tsx');
  assert.match(p, /const directo: OpcionDirecta \| undefined = mediosDirectos\.length \?/, 'sin medio con dato y monto, no hay opción');
});

// Roturas (18/11/2026), cada una restaurada: ver el hallazgo en docs/hallazgos-pagos.md.
