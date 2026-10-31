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
import { DIAS_SIN_REPETIR, MINUTOS_DE_GRACIA, MINUTOS_OFERTA, estadoDeOferta, firmarOferta, leerOferta, ofertaParaLaLanding } from '../lib/oferta-entrada';
import { bajadaDePlanes } from '../lib/compra-plan-reglas';
import { esPruebaDePlan } from '../lib/prueba-plan-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_primer-mes-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

const MIN = 60_000;
const DIA = 86_400_000;
const AHORA = Date.parse('2026-10-30T12:00:00.000Z');
const S = 'secreto-de-prueba';

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

test('un reloj vencido se dice y no crea nada; sólo sigue quien elige el precio normal; la gracia y el token falso', () => {
  assert.equal(R.vencida.status, 409);
  assert.equal(R.vencida.sinOferta, true);
  assert.match(R.vencida.error, /venció/);
  assert.equal(R.vencidaNoCreo, true, 'nunca se cobra lleno sin decirlo');
  assert.equal(R.vencidaSigue.ok, true);
  assert.equal(R.vencidaSigueCobro, 'planes:pro');
  assert.equal(R.graciaCobro, 'planes:pro:primer-mes-50', 'quien tocó el botón a tiempo no lo pierde por llenar el formulario');
  assert.equal(R.falsoCobro, 'planes:pro', 'un token inventado no da nada');
});

test('un descuento por email: ni una cuenta que ya existe, ni quien ya lo pagó, ni quien lo abandonó hace más de 24 h', () => {
  for (const r of [R.cuenta, R.yaPago, R.abandonoViejo]) {
    assert.equal(r.status, 409, JSON.stringify(r));
    assert.equal(r.sinOferta, true);
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
  assert.equal(DESCUENTO_PRIMER_MES_PCT, 50);
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

test('el reloj: firmado, no se reinicia al volver, y arranca otra vez recién a los 30 días', () => {
  const t = firmarOferta(AHORA, S)!;
  assert.equal(leerOferta(t, S), AHORA);
  assert.equal(leerOferta(t, 'otro-secreto'), null);
  assert.equal(leerOferta(t.replace(String(AHORA), String(AHORA + 1)), S), null, 'no se le corre la hora');
  assert.equal(firmarOferta(AHORA, ''), null, 'nunca con un secreto vacío');
  assert.equal(estadoDeOferta(firmarOferta(AHORA + 5 * MIN, S), AHORA, S), null, 'no arranca en el futuro');
  const vivo = estadoDeOferta(t, AHORA + (MINUTOS_OFERTA - 1) * MIN, S)!;
  assert.deepEqual([vivo.vigente, vivo.aceptable], [true, true]);
  const enGracia = estadoDeOferta(t, AHORA + (MINUTOS_OFERTA + 1) * MIN, S)!;
  assert.deepEqual([enGracia.vigente, enGracia.aceptable], [false, true], 'el reloj dice cero, el formulario todavía vale');
  const fuera = estadoDeOferta(t, AHORA + (MINUTOS_OFERTA + MINUTOS_DE_GRACIA + 1) * MIN, S)!;
  assert.deepEqual([fuera.vigente, fuera.aceptable], [false, false]);
  const vuelve = ofertaParaLaLanding(t, AHORA + 2 * 3600_000, S)!;
  assert.equal(vuelve.token, t, 'el MISMO reloj');
  assert.equal(vuelve.vigente, false, 'vencido: no se regala de nuevo');
  const tarde = ofertaParaLaLanding(t, AHORA + (DIAS_SIN_REPETIR + 1) * DIA, S)!;
  assert.notEqual(tarde.token, t);
  assert.equal(tarde.vigente, true);
  assert.equal(ofertaParaLaLanding('o1.123.inventada', AHORA, S)!.vigente, true, 'uno inventado no traba a nadie: arranca uno de verdad');
  assert.equal(ofertaParaLaLanding(null, AHORA, '')?.token, undefined, 'sin secreto, sin cartel');
});

test('el cableado: la ruta pública, el token que viaja, y las pantallas', () => {
  const pub = fuente('lib/rutas-publicas.ts');
  assert.equal(pub.split("'/api/planes/oferta',").length - 1, 2, 'en las dos listas');
  assert.match(fuente('app/api/planes/oferta/route.ts'), /if \(PRUEBA_GRATIS_PRENDIDA\) return Response\.json\(\{ oferta: null \}/);
  assert.match(fuente('app/planes/page.tsx'), /'ref', 'oferta'\]/, 'el token pasa de /planes al plan elegido');
  assert.match(fuente('app/planes/[plan]/CompraPlan.tsx'), /oferta: p\.oferta \?\? null, sinOferta: sinDescuento/);
  assert.match(fuente('app/planes/[plan]/CompraPlan.tsx'), /Seguir con el precio normal/);
  assert.match(fuente('app/api/planes/comprar/route.ts'), /\.\.\.\(r\.sinOferta \? \{ sinOferta: true \} : \{\}\)/);
  assert.match(fuente('app/vsl/Landing.tsx'), /PRUEBA_GRATIS_PRENDIDA \? PRUEBA_DIAS : 'apagada'/, 'una landing publicada no sigue prometiendo días gratis');
  assert.match(fuente('app/configuraciones/plan/page.tsx'), /primerMes: lineaDelPrimerMes\(sus, formatoMonto\)/);
  assert.match(fuente('app/m/configuraciones/plan/page.tsx'), /primerMes: lineaDelPrimerMes\(sus, formatoMonto\)/);
  assert.match(fuente('app/customers/CustomersApp.tsx'), /primer mes a \$\{usdTxt\(f\.primerMesUsd\)\}/);
  assert.match(fuente('app/m/customers/CustomersM.tsx'), /primer mes a \$\{usdTxt\(c\.primerMesUsd\)\}/);
  assert.match(fuente('app/api/cron/cobros-reconciliar/route.ts'), /await conciliarPrimerMes\(\)/);
});

// Roturas (30/10/2026; base 12 / 0), cada una restaurada (pasan / fallan; 0 / 1 = el hijo no pudo seguir el recorrido):
//   · el interruptor prendido                                  -> 0 / 1
//   · Mercado Pago nace a precio lleno                         -> 10 / 2
//   · el primer pago se asienta lleno (no lo veía: el test miraba sólo los dólares; ahora mira también su moneda) -> 11 / 1
//   · el primer pago entra lleno al cash                       -> 11 / 1
//   · el cupón de Stripe no vence; Stripe sin el cupón         -> 11 / 1 cada una
//   · Mercado Pago no sube al primer pago                      -> 10 / 2
//   · el cron pisa una retención; no avisa; no sube            -> 11 / 1 cada una
//   · el reloj vencido regala; cobra lleno sin decirlo         -> 11 / 1 cada una
//   · sin el límite por email; una cuenta que existe lo usa    -> 11 / 1 cada una
//   · un abandono viejo o quien ya pagó vuelve a tenerlo       -> 11 / 1 cada una (el de «ya pagó» no lo veía: la fila tenía más de 24 h y caía por la otra regla)
//   · el cobro guarda la mitad                                 -> 10 / 2
//   · sigue habiendo prueba para las altas nuevas              -> 0 / 1
//   · a quien está en prueba se le quitan los días             -> 11 / 1
//   · una firma cualquiera sirve; sin gracia                   -> 0 / 1 cada una
//   · el reloj se reinicia al volver                           -> 11 / 1
//   · el descuento dura para siempre en Tu plan                -> 11 / 1
//   · la landing sigue prometiendo días gratis                 -> 11 / 1
//   · el token no pasa de /planes                              -> 11 / 1
// Lo que NO corre acá: Stripe y Mercado Pago de verdad. `PUT /preapproval` nunca se midió con claves reales; falta un cobro real, y
// para eso hace falta el sí de Martín. Mercado Pago además necesita los precios en pesos cargados (`preciosLocales`, hoy vacío).
