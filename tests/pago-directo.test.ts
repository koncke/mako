// =============================================================================
// «Transferencia o Binance · 5% OFF» en el checkout, para todos (18/11/2026, Martín)
// =============================================================================
// Lo puro (el descuento, los montos, los textos del comprobante, los medios disponibles), el pedido (el medio viaja, el MONTO nunca) y
// la pantalla dibujada (la fila se ve sólo con datos cargados; nada dice «se activa sola»).
// Probado rompiendo: al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DESCUENTO_PAGO_DIRECTO, canalDelPago } from '../lib/partners-reglas';
import {
  CHIP_PAGO_DIRECTO, DATOS_DE_PAGO_DIRECTO, mediosDisponibles, montoDelMedio, pesosConDescuento, textoDelComprobante, urlDeEmail, urlDeWhatsApp, usdConDescuento,
  type DatosDePagoDirecto,
} from '../lib/pago-directo-reglas';
import { leerPedidoCompra } from '../lib/compra-plan-reglas';
import { CompraPlan } from '../app/planes/[plan]/CompraPlan';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const DATOS: DatosDePagoDirecto = { binancePayId: 'PAYID-DE-PRUEBA', alias: 'alias.de.prueba', cvu: null, titular: 'Titular de prueba', whatsapp: '5491100000000', email: 'cobros@ejemplo.com' };

test('el descuento es UNO para todos: 5 %, y sale en una constante junto a las de Partners', () => {
  assert.equal(DESCUENTO_PAGO_DIRECTO, 0.05);
  assert.equal(CHIP_PAGO_DIRECTO, '5% OFF');
  assert.match(fuente('lib/partners-reglas.ts'), /export const DESCUENTO_PAGO_DIRECTO = 0\.05;/);
});

test('los montos con el 5 %: Pro 92,15 y Essential 44,65 en USDT; los pesos al millar hacia arriba', () => {
  assert.equal(usdConDescuento(97), 92.15);
  assert.equal(usdConDescuento(47), 44.65);
  assert.equal(pesosConDescuento(166000), 158000, '157.700 → 158.000');
  assert.equal(pesosConDescuento(81000), 77000, '76.950 → 77.000');
  assert.equal(pesosConDescuento(100000), 95000, 'justo en un millar: no sube de más');
  assert.deepEqual(montoDelMedio('binance', { precioUsd: 97, precioArs: 166000 }), { monto: 92.15, moneda: 'USD' });
  assert.deepEqual(montoDelMedio('transferencia', { precioUsd: 97, precioArs: 166000 }), { monto: 158000, moneda: 'ARS' });
  assert.equal(montoDelMedio('transferencia', { precioUsd: 97, precioArs: null }), null, 'sin precio en pesos, no hay transferencia');
});

test('los datos de MaKo NO se inventan: sin ninguno la opción no se ofrece, y cada medio pide su dato', () => {
  assert.deepEqual(mediosDisponibles(DATOS_DE_PAGO_DIRECTO), [], 'el repo no trae ningún dato cargado');
  assert.ok(Object.values(DATOS_DE_PAGO_DIRECTO).every((v) => v === null));
  assert.deepEqual(mediosDisponibles({ ...DATOS, alias: null, cvu: null }), ['binance']);
  assert.deepEqual(mediosDisponibles({ ...DATOS, binancePayId: null }), ['transferencia']);
  assert.deepEqual(mediosDisponibles({ ...DATOS, binancePayId: null, alias: null, cvu: '0000003100000000000001' }), ['transferencia']);
});

test('los botones del comprobante: wa.me y mailto con el texto armado, y sin el contacto no hay botón', () => {
  const texto = textoDelComprobante({ nombre: 'Ana Pérez', plan: 'MaKo Pro', medio: 'binance', monto: { monto: 92.15, moneda: 'USD' } });
  assert.match(texto, /Ana Pérez/);
  assert.match(texto, /MaKo Pro/);
  assert.match(texto, /Binance: US\$ 92,15/);
  assert.match(texto, /5% de descuento/);
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

test('el aviso al equipo lleva el medio y el monto con descuento, y dice que falta VERIFICAR (no promete activar solo)', () => {
  const c = fuente('lib/compra-plan.ts');
  assert.match(c, /const directo = p\.medioDirecto && elegido/);
  assert.match(c, /montoDelMedio\(p\.medioDirecto, \{ precioUsd: elegido\.precioUsd, precioArs: precioEnPesos\(elegido\) \}\)/, 'el monto sale del plan, no del cliente');
  assert.match(c, /Falta VERIFICAR que la plata entró \(todavía no se verifica sola\) y darle de alta a mano\./);
  assert.match(c, /detalle: `Quiere \$\{nombrePlan\}\$\{dePago\}`/, '«Quieren entrar» también lo dice');
});

test('a un referido que paga así le cuenta el canal directo (30 %), sobre lo que pagó con el descuento', () => {
  assert.equal(canalDelPago({ proveedor: null, metodo: 'cripto' }), 'directo', 'Binance');
  assert.equal(canalDelPago({ proveedor: null, metodo: 'transferencia' }), 'directo');
});

test('la pantalla: la fila «Transferencia o Binance» con «5% OFF» sólo se dibuja con datos; ningún texto dice que se activa sola', () => {
  const props = { plan: 'pro', ladaInicial: '54', pasarelas: [{ pasarela: 'mercadopago' as const, moneda: 'ARS', monto: 166000 }], origen: null, refCodigo: null };
  const sin = renderToStaticMarkup(createElement(CompraPlan, props));
  assert.doesNotMatch(sin, /Transferencia o Binance/, 'sin datos de MaKo, no hay fila');
  const con = renderToStaticMarkup(createElement(CompraPlan, {
    ...props, directo: { medios: ['binance', 'transferencia'], montos: { binance: { monto: 92.15, moneda: 'USD' }, transferencia: { monto: 158000, moneda: 'ARS' } }, datos: DATOS, nombrePlan: 'MaKo Pro' },
  }));
  assert.match(con, /Transferencia o Binance/);
  assert.match(con, /5% OFF/);
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
