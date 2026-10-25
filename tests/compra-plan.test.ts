// =============================================================================
// El checkout público de los planes de MaKo (23/10/2026): lib/planes-mako.ts, lib/compra-plan-reglas.ts y su cableado
// =============================================================================
// Pedido de Martín (22/10/2026): «si alguien paga se ingresa automáticamente a la app con el email de bienvenida». Lo
// que se fija acá: el precio y la capa salen del PLAN (nunca del pedido), un setting roto no vende un plan a medio
// escribir, el origen de la landing se limpia, la pasarela se elige bien, y la ruta pública mira el Origin, tiene topes
// y no lee la sesión.
//
// Probado rompiéndolo (23/10/2026; base 11 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · `planValido` acepta la capa `superadmin`                                        -> 10 / 1
//   · `planesDeSetting` devuelve [] con un setting sin planes buenos                  -> 10 / 1
//   · `precioEn` inventa un precio en ARS con el de USD                               -> 10 / 1
//   · `pasarelaDeLaCompra` elige sola entre dos                                       -> 10 / 1
//   · la ruta sin el chequeo de Origin                                                -> 10 / 1
//   · `iniciarCompraDePlan` sin `altaCapa: plan.capa`                                 -> 10 / 1
//   (una clave de origen fuera de la lista no tiene rotura: `origenLimpio` recorre SÓLO la lista)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLANES_MAKO_DEFAULT, planValido, planesDeSetting, precioEn } from '../lib/planes-mako';
import { codigoRefLimpio, leerPedidoCompra, origenLimpio, pasarelaDeLaCompra } from '../lib/compra-plan-reglas';
import { esPublica, esPublicaSoloLeer } from '../lib/rutas-publicas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '');

test('las ofertas del 23/10: Esencial 47 (completo), Pro 97 (agencia), Continuidad 297 sin publicar; la baja de cada uno', () => {
  const ids = PLANES_MAKO_DEFAULT.map((p) => `${p.id}:${p.precioUsd}:${p.capa}:${p.activo ? 'publico' : 'oculto'}`);
  assert.deepEqual(ids, ['esencial:47:completo:publico', 'pro:97:agencia:publico', 'continuidad:297:agencia:oculto']);
  const [esencial, pro] = PLANES_MAKO_DEFAULT;
  assert.deepEqual(esencial.retencion, { pausa: { meses: 1 } });
  assert.deepEqual(pro.retencion, { descuento: { pct: 50, meses: 2 }, bajarA: 'esencial' });
  assert.equal(planValido({ id: 'x', nombre: 'X', capa: 'pm', precioUsd: 5, retencion: { descuento: { pct: 100, meses: 2 } } })?.retencion, null, 'un 100% no es una oferta');
});

test('un plan escrito a mano pasa entero o no existe; la capa superadmin nunca se vende', () => {
  assert.equal(planValido({ id: 'x', nombre: 'X', capa: 'superadmin', precioUsd: 10 }), null);
  assert.equal(planValido({ id: 'X MAL', nombre: 'X', capa: 'pm', precioUsd: 10 }), null);
  assert.equal(planValido({ id: 'x', nombre: 'X', capa: 'pm', precioUsd: 0 }), null);
  const p = planValido({ id: 'lite', nombre: 'Lite', capa: 'pm', precioUsd: '19.999', preciosLocales: { ARS: 19000, usd: 3, MXN: -1 } });
  assert.ok(p);
  assert.equal(p!.precioUsd, 20);
  assert.deepEqual(p!.preciosLocales, { ARS: 19000 });
});

test('un setting roto o vacío deja los planes de hoy; uno bueno manda y sin ids repetidos', () => {
  assert.equal(planesDeSetting('{no es json').length, PLANES_MAKO_DEFAULT.length);
  assert.equal(planesDeSetting(JSON.stringify([{ id: 'x', capa: 'superadmin' }])).length, PLANES_MAKO_DEFAULT.length);
  const s = planesDeSetting(JSON.stringify([{ id: 'a', nombre: 'A', capa: 'pm', precioUsd: 5 }, { id: 'a', nombre: 'A2', capa: 'pm', precioUsd: 6 }]));
  assert.deepEqual(s.map((p) => `${p.id}:${p.precioUsd}`), ['a:5']);
});

test('el precio es el de la moneda de la pasarela; sin precio local, no se ofrece (nunca una tasa inventada)', () => {
  const pro = planesDeSetting(null)[0];
  assert.equal(precioEn(pro, 'USD'), 47);
  assert.equal(precioEn(pro, 'ARS'), null);
  assert.equal(precioEn({ ...pro, preciosLocales: { ARS: 47000 } }, 'ars'), 47000);
});

test('el origen de la landing se limpia: sólo las claves de la lista, slugs donde van slugs', () => {
  assert.equal(origenLimpio(null), null);
  assert.equal(origenLimpio({ hackeo: 'x' }), null);
  assert.deepEqual(origenLimpio({ landing: 'Inmobiliarias-CRM', avatar: 'con espacios', funcionalidad: 'crm', utm_source: 'fb\nads', otra: 'x' }),
    { landing: 'inmobiliarias-crm', funcionalidad: 'crm', utm_source: 'fbads' });
});

test('el código de partner: minúsculas, 3 a 32, sin nada raro', () => {
  assert.equal(codigoRefLimpio(' Juan-Perez '), 'juan-perez');
  assert.equal(codigoRefLimpio('ab'), null);
  assert.equal(codigoRefLimpio('a b c'), null);
});

test('el pedido no trae precio ni capa; el campo trampa es un bot', () => {
  const r = leerPedidoCompra({ plan: 'pro', nombre: '  Ana  Gómez ', email: 'ANA@x.com', monto: 1, capa: 'superadmin', pasarela: 'paypal' });
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(Object.keys(r.pedido).sort(), ['diagnostico', 'email', 'nombre', 'origen', 'pasarela', 'periodo', 'plan', 'quiero', 'ref', 'sinPrueba', 'whatsapp']);
    assert.equal(r.pedido.diagnostico, null, 'sin diagnóstico (sólo lo manda el Acelerador)');
    assert.equal(r.pedido.periodo, 'mensual', 'sin pedirlo, por mes');
    assert.equal(r.pedido.quiero, false, 'sin pedirlo, es una compra');
    assert.equal(r.pedido.email, 'ana@x.com');
    assert.equal(r.pedido.nombre, 'Ana Gómez');
    assert.equal(r.pedido.pasarela, null);
  }
  const bot = leerPedidoCompra({ plan: 'pro', nombre: 'Ana', email: 'a@x.com', web: 'http://spam' });
  assert.equal(!bot.ok && bot.bot, true);
  assert.equal(leerPedidoCompra({ plan: 'pro', nombre: 'Ana', email: 'no-es-email' }).ok, false);
});

test('la pasarela: la pedida si sirve, la única si hay una, y con dos se pregunta', () => {
  assert.deepEqual(pasarelaDeLaCompra({ pedida: null, sirven: [] }), { ok: false, motivo: 'sin-pasarela' });
  assert.deepEqual(pasarelaDeLaCompra({ pedida: null, sirven: ['stripe'] }), { ok: true, pasarela: 'stripe' });
  assert.deepEqual(pasarelaDeLaCompra({ pedida: null, sirven: ['stripe', 'mercadopago'] }), { ok: false, motivo: 'elegir' });
  assert.deepEqual(pasarelaDeLaCompra({ pedida: 'mercadopago', sirven: ['stripe'] }), { ok: false, motivo: 'no-sirve' });
  assert.deepEqual(pasarelaDeLaCompra({ pedida: 'mercadopago', sirven: ['stripe', 'mercadopago'] }), { ok: true, pasarela: 'mercadopago' });
});

test('las rutas públicas: /planes y /r sólo leen; el POST del checkout es exacto', () => {
  for (const r of ['/planes', '/planes/pro', '/r/juan']) {
    assert.equal(esPublica(r), true, r);
    assert.equal(esPublicaSoloLeer(r), true, `${r} es una página: sólo GET`);
  }
  assert.equal(esPublica('/api/planes/comprar'), true);
  assert.equal(esPublicaSoloLeer('/api/planes/comprar'), false);
  assert.equal(esPublica('/api/planes'), false);
  assert.equal(esPublica('/planesx'), false);
});

test('la ruta del checkout mira el Origin, tiene topes y no lee la sesión', () => {
  const ruta = fuente('app/api/planes/comprar/route.ts');
  assert.match(ruta, /origenDelPago\(/);
  assert.match(ruta, /origen\.tipo !== 'mako'/);
  assert.match(ruta, /rateLimit\(`planes-comprar:ip:/);
  assert.match(ruta, /rateLimit\(`planes-comprar:email:/);
  assert.doesNotMatch(ruta, /mako_session|getWorkspaceActual|requireSesion|cookies\(\)/);
});

test('el cobro del checkout da el alta con la capa DEL PLAN, en la plataforma', () => {
  const lib = fuente('lib/compra-plan.ts');
  assert.match(lib, /altaCapa: plan\.capa/);
  assert.match(lib, /tipo: 'suscripcion'/);
  assert.match(lib, /runWithWorkspace\(ws,/);
  assert.match(lib, /const ws = await wsSuperAdmin\(\)/);
});
