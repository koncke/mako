// =============================================================================
// El funnel de lanzamiento en el cobro: prueba gratis apagada, 50% del primer mes y se paga antes de entrar (30/10/2026)
// =============================================================================
// docs/estrategia-lanzamiento-low-to-high.md §3, §4 y §5. Lo que se cuida: el primer pago sale a mitad y el segundo vuelve al precio
// lleno por los dos caminos (Stripe y Mercado Pago); `cobro.monto` sigue siendo la mensualidad; un reloj vencido no regala nada y
// no cobra lleno sin decirlo; y a quien ya está en prueba no se le toca nada. Corre con el código real sobre una base y unas
// pasarelas de mentira (tests/_primer-mes-hijo.ts).
//
// Probado rompiéndolo: al pie del archivo.
// Correr: node --import tsx --test tests/primer-mes.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESCUENTO_PRIMER_MES_PCT, PLANES_MAKO_DEFAULT, PRUEBA_DIAS, PRUEBA_GRATIS_PRENDIDA, textoDespuesDeLaPrueba } from '../lib/planes-mako';
import { creadoPorPrimerMes, lineaDelPrimerMes, montoDelPrimerPago, pctDelPrimerMes, usdDelPrimerPago, usdPrimerMesVigente } from '../lib/primer-mes-reglas';
import { PROMO_ENTRADA } from '../lib/promo-entrada-reglas';
import { bajadaDePlanes } from '../lib/compra-plan-reglas';
import { esPruebaDePlan } from '../lib/prueba-plan-reglas';
import { plataTxt } from '../app/admin/clientes/customers-vista';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_primer-mes-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

const DIA = 86_400_000;
const AHORA = Date.parse('2026-10-30T12:00:00.000Z');

test('el interruptor está APAGADO y es uno solo; se puede volver a prender', () => {
  assert.equal(PRUEBA_GRATIS_PRENDIDA, false);
  assert.equal(PRUEBA_DIAS, 7, 'no se borró');
  assert.equal(textoDespuesDeLaPrueba(97, 'mes', false), 'Pagas al empezar y cancelas cuando quieras.');
  assert.match(textoDespuesDeLaPrueba(97, 'mes', true), /antes del día 8/, 'prendida, vuelve a decir lo de antes');
  assert.match(bajadaDePlanes(true, false), /Pagas al empezar/);
  assert.doesNotMatch(bajadaDePlanes(false, false), /gratis/);
  assert.match(bajadaDePlanes(true, true), /7 días gratis/);
});

test('sin reloj: el precio de lista, sin prueba y sin cupón; se paga antes de entrar', () => {
  assert.equal(R.sinToken.ok, true);
  assert.deepEqual(R.sinTokenCobro, { creado_por: 'planes:pro', monto: 97, inicio_at: null });
  assert.equal(R.sinTokenCupones, 0);
  assert.deepEqual(R.sinTokenSesion, { descuento: null, prueba: null, monto: '9700' });
});

test('con el reloj vivo: el 50% de un solo cobro en Stripe, y el cobro sigue valiendo la mensualidad', () => {
  assert.equal(R.conToken.ok, true);
  assert.deepEqual(R.conTokenCobro, { creado_por: 'planes:pro:primer-mes-50', monto: 97, monto_usd: 97 });
  assert.deepEqual(R.cupon, { pct: '50', duracion: 'once' }, '`once`: Stripe vuelve solo al precio de lista');
  assert.equal(R.sesion.monto, '9700', 'el precio de la suscripción es el de lista');
  assert.ok(R.sesion.cupon);
  assert.equal(R.sesion.prueba, null, 'las dos juntas no: el motivo 1 de Martín');
});

test('un reloj vencido se dice a quien lo vio y no crea nada; la gracia, la cookie falsa y el interruptor apagado', () => {
  assert.equal(R.vencida.status, 409);
  assert.equal(R.vencida.sinPromo, true);
  assert.match(R.vencida.error, /venció/);
  assert.equal(R.vencidaNoCreo, true, 'nunca se cobra lleno sin decirlo');
  assert.equal(R.vencidaSigue.ok, true);
  assert.equal(R.vencidaSigueCobro, 'planes:pro');
  assert.equal(R.graciaCobro, 'planes:pro:primer-mes-50', 'quien tocó el botón a tiempo no lo pierde por llenar el formulario');
  assert.equal(R.noLoVioCobro, 'planes:pro', 'quien no lo vio en la página: precio normal, sin preguntar (el contrato de Landings)');
  assert.equal(R.falsoCobro, 'planes:pro', 'una cookie inventada no da nada');
  assert.equal(R.apagadaCobro, 'planes:pro', 'con `PROMO_ENTRADA_ACTIVA` apagado no hay descuento');
});

test('un descuento por email: ni una cuenta que ya existe, ni quien ya lo pagó, ni quien lo abandonó hace más de 24 h', () => {
  for (const r of [R.cuenta, R.yaPago, R.abandonoViejo]) {
    assert.equal(r.status, 409, JSON.stringify(r));
    assert.equal(r.sinPromo, true);
  }
  assert.match(R.cuenta.error, /negocios nuevos/);
  assert.match(R.yaPago.error, /ya usó/);
  assert.equal(R.cuentaNoCreo, true);
  assert.equal(R.abandonoReciente.ok, true, 'dentro de las 24 h rearma el pago: se le cerró la pestaña, no lo perdió');
});

test('lo que entra: el primer pago a mitad y la renovación entera, en el cash y en dólares', () => {
  assert.deepEqual(R.pagosStripe.map((p: { id: string; usd: number; original: number }) => [p.id, Number(p.usd), Number(p.original)]), [['in_1', 48.5, 48.5], ['in_2', 97, 97]]);
  assert.equal(Number(R.pagosMp[0].original), 48500, 'en su moneda');
  assert.equal(R.stripeMontoCobro, 97, 'la mensualidad no se toca: la deuda y Tu plan salen de acá');
});

test('se paga antes de entrar: abrir el pago no da de alta a nadie; el pago sí, con su onboarding pendiente', () => {
  assert.equal(R.usuarioAntesDePagar, 0);
  assert.equal(R.usuarioDespuesDePagar, 1);
  assert.match(String(R.onboardingDelAlta), /pending/, 'la primera pantalla es el onboarding: ahí va la pregunta del WhatsApp');
});

test('Mercado Pago: nace a mitad y sube al entrar el primer pago', () => {
  assert.equal(R.mpNace, 48500);
  assert.equal(R.mpTrasElPrimero, 97000);
});

test('el cron arregla lo que quedó rebajado, avisa si no puede, no repite y no pisa una retención', () => {
  assert.equal(R.cronAntes, 48500, 'la llamada del pago falló');
  assert.ok(R.cronCaido.errores >= 1);
  assert.ok(R.cronMails.some((m: string) => /precio del primer mes/.test(m)), R.cronMails.join(' | '));
  assert.equal(R.cronSube.restaurados, 1);
  assert.equal(R.cronDespues, 97000);
  assert.equal(R.cronOtraVuelta.restaurados, 0);
  assert.equal(R.retenidaSigue, 48500, '«2 meses al 50%» está rebajado a propósito');
});

test('a quien ya está en prueba no se le toca nada: su cobro sigue siendo una prueba, con sus 7 días y sus topes', () => {
  assert.deepEqual(R.pruebaAbierta, { dias: '7', cupon: null });
  assert.equal(R.pruebaEstado, true);
  assert.equal(R.pruebaFreno, false);
  assert.equal(esPruebaDePlan({ tipo: 'suscripcion', alta_capa: 'agencia', creado_por: creadoPorPrimerMes('pro') }), false, 'un descuento no es una prueba');
});

test('las reglas del primer mes', () => {
  assert.equal(DESCUENTO_PRIMER_MES_PCT, PROMO_ENTRADA.pct, 'el cartel y el cobro, del mismo número');
  assert.deepEqual([...PROMO_ENTRADA.planes], ['esencial', 'pro']);
  assert.equal(creadoPorPrimerMes('pro'), 'planes:pro:primer-mes-50');
  assert.equal(pctDelPrimerMes('planes:pro:primer-mes-50'), 50);
  for (const v of [null, '', 'planes:pro', 'planes:pro:prueba', 'planes:pro:primer-mes-0', 'x:primer-mes-50']) assert.equal(pctDelPrimerMes(v), null, String(v));
  const precios = PLANES_MAKO_DEFAULT.filter((p) => p.activo).map((p) => montoDelPrimerPago({ monto: p.precioUsd, creado_por: creadoPorPrimerMes(p.id) }));
  assert.deepEqual(precios, [23.5, 48.5], '47 y 97');
  assert.equal(montoDelPrimerPago({ monto: 97, creado_por: 'planes:pro' }), 97);
  assert.equal(usdDelPrimerPago({ monto_usd: 97, creado_por: 'planes:pro:primer-mes-50' }), 48.5);
  assert.equal(usdDelPrimerPago({ monto_usd: null, creado_por: 'planes:pro:primer-mes-50' }), null, 'nunca se inventa una tasa');
  const c = { monto: 97, moneda: 'USD', creado_por: 'planes:pro:primer-mes-50', monto_usd: 97, pagado_at: new Date(AHORA - 10 * DIA).toISOString() };
  const f = (m: number, mon: string) => `${mon} ${m}`;
  assert.equal(lineaDelPrimerMes(c, f, AHORA), 'Tu primer mes costó USD 48.5. Desde el segundo, USD 97 por mes.');
  assert.equal(lineaDelPrimerMes({ ...c, pagado_at: new Date(AHORA - 32 * DIA).toISOString() }, f, AHORA), null, 'pasado el mes, no se dice más');
  assert.equal(lineaDelPrimerMes({ ...c, pagado_at: null }, f, AHORA), null, 'sin pagar, no');
  assert.equal(usdPrimerMesVigente(c, AHORA), 48.5);
  assert.equal(usdPrimerMesVigente({ ...c, creado_por: 'planes:pro' }, AHORA), null);
});

test('las tarjetas, dibujadas: con el reloj vivo dicen el primer mes de los dos planes; sin él, no lo prometen', async () => {
  const React = await import('react');
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { VitrinaPlanes } = await import('../app/planes/Vitrina');
  const ofertas = PLANES_MAKO_DEFAULT.filter((p) => p.activo).map((plan) => ({ plan, cobrable: true }));
  const dibujar = (promoVigente: boolean) => renderToStaticMarkup(React.createElement(VitrinaPlanes, { ofertas, sufijo: '', promoVigente }))
    .replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const conReloj = dibujar(true);
  assert.ok(conReloj.includes('Tu primer mes: US$ 23,50'), 'Esencial');
  assert.ok(conReloj.includes('Tu primer mes: US$ 48,50'), 'Pro');
  assert.ok(conReloj.includes('Después, el precio de siempre.'));
  assert.ok(conReloj.includes('US$ 47 / mes'), 'el precio de lista sigue a la vista');
  assert.doesNotMatch(dibujar(false), /Tu primer mes/);
});

test('el cableado: la cookie del reloj, lo que viaja, y las pantallas', () => {
  assert.match(fuente('app/planes/page.tsx'), /promoVigente=\{relojVivo\(\(await cookies\(\)\)\.get\(COOKIE_PROMO\)\?\.value\)\}/, 'las tarjetas de /planes');
  assert.match(fuente('app/planes/[plan]/page.tsx'), /PROMO_ENTRADA\.planes\.includes\(plan\.id\) && relojVivo/, 'la página del plan sabe del descuento');
  assert.match(fuente('app/vsl/PreciosLanding.tsx'), /<TarjetasPlanes promoVigente=\{promoVigente\}/, 'las tarjetas de la landing');
  assert.match(fuente('app/planes/Tarjetas.tsx'), /Tu primer mes: US\$ \{textoUsd\(precioPrimerMes\(p\.precioUsd\)\)\}/);
  assert.match(fuente('app/planes/[plan]/CompraPlan.tsx'), /promo: !!p\.promo, sinPromo: sinDescuento/);
  assert.match(fuente('app/planes/[plan]/CompraPlan.tsx'), /Seguir con el precio normal/);
  assert.match(fuente('app/api/planes/comprar/route.ts'), /\.\.\.\(r\.sinPromo \? \{ sinPromo: true \} : \{\}\)/);
  assert.match(fuente('app/vsl/Landing.tsx'), /PRUEBA_GRATIS_PRENDIDA \? PRUEBA_DIAS : 'apagada'/, 'una landing publicada no sigue prometiendo días gratis');
  assert.match(fuente('app/configuraciones/plan/page.tsx'), /primerMes: lineaDelPrimerMes\(sus, formatoMonto\)/);
  assert.match(fuente('app/m/configuraciones/plan/page.tsx'), /primerMes: lineaDelPrimerMes\(sus, formatoMonto\)/);
  assert.equal(plataTxt({ mrrUsd: 47, primerMesUsd: 23.5, prueba: false, planAManoTxt: null }), 'US$ 47 por mes · primer mes a US$ 23,5', 'la ficha de Customers');
  assert.match(fuente('app/m/customers/CustomersM.tsx'), /primer mes a \$\{usdTxt\(c\.primerMesUsd\)\}/);
  assert.match(fuente('app/api/cron/cobros-reconciliar/route.ts'), /await conciliarPrimerMes\(\)/);
});

// Roturas (31/10/2026; sobre la cookie de lib/promo-entrada.ts; base 13 / 0), cada una restaurada (pasan / fallan; 0 / 1 = el hijo no pudo seguir el recorrido):
//   · Mercado Pago nace a precio lleno                                -> 11 / 2
//   · el primer pago se asienta lleno                                 -> 12 / 1 (al principio no lo veía: el test miraba sólo los dólares)
//   · el cupón de Stripe no vence                                     -> 12 / 1
//   · un reloj vencido regala (la ruta no mira la cookie)             -> 11 / 2
//   · la ruta no lee la cookie; sin gracia                            -> 0 / 1 cada una
//   · la gracia también para quien no lo vio                          -> 12 / 1
//   · un reloj vencido cobra lleno sin decirlo                        -> 12 / 1
//   · el descuento fuera de los planes del cartel                     -> 0 / 1
//   · quien eligió seguir igual recibe el error                       -> 0 / 1
//   · las tarjetas no lo dicen; lo dicen siempre                      -> 12 / 1 cada una
//   · la página del plan no lo sabe                                   -> 12 / 1
//   · el cartel y el cobro con dos números                            -> 10 / 3
// Y sobre el token anterior, las reglas que no cambiaron (base 12 / 0): el interruptor prendido 0 / 1; el primer pago entra lleno al cash, Stripe sin el
// cupón, el cron pisa una retención, no avisa o no sube, sin el límite por email, una cuenta que existe lo usa, un abandono viejo o quien ya pagó vuelve a
// tenerlo (éste no lo veía: la fila tenía más de 24 h y caía por la otra regla), a quien está en prueba se le quitan los días, el descuento para siempre
// en Tu plan, la landing promete días gratis: 11 / 1 cada una. Mercado Pago no sube al primer pago y el cobro guarda la mitad: 10 / 2 cada una.
// Sigue habiendo prueba para las altas nuevas: 0 / 1.
// Lo que NO corre acá: Stripe y Mercado Pago de verdad. `PUT /preapproval` nunca se midió con claves reales; falta un cobro real, y
// para eso hace falta el sí de Martín. Mercado Pago además necesita los precios en pesos cargados (`preciosLocales`, hoy vacío).
