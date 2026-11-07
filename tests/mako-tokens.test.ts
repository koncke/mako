// =============================================================================
// MaKo Tokens: que no se pueda gastar en IA más de lo que ya se cobró (7/11/2026)
// =============================================================================
// Martín, 7/11: «quiero que me siga saliendo rentable… podemos vender MaKo Tokens», y sobre la caja, «no lo
// tengo que comprar con mi dinero». El medidor es lo que convierte eso en una propiedad del sistema: si una
// generación sólo corre con saldo, y el saldo entra con el pago, no se puede gastar antes de cobrar.
//
// Esto prueba la CONDUCTA, no los números: que redondee a favor del negocio, que falle CERRADO, y que el cupo
// alcance para competir. Si mañana cambian los precios de los proveedores —y esta semana ya cambiaron dos
// veces—, sigue en verde mientras esas tres cosas se cumplan.
//
// Correr: node --import tsx --test tests/mako-tokens.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MT_POR_USD, mtDeUsd, usdDeMt, CUPO_MENSUAL, USD_POR_SEGUNDO, USD_POR_IMAGEN,
  mtDeVideo, mtDeImagenes, segundosQueEntran, alcanzaElSaldo, alcanzaParaVideo, VIDEOS_POR_MES, type Plan,
} from '../lib/mako-tokens-reglas';

test('la conversión redondea SIEMPRE a favor del negocio', () => {
  assert.equal(mtDeUsd(1), MT_POR_USD, 'US$1 tiene que ser 1.000 MT');
  // ⚠️ Un medio token no existe: cobrar de menos regala margen en CADA llamada, y son miles por mes.
  assert.equal(mtDeUsd(0.0001), 1, 'un costo mínimo no puede costar 0 MT');
  assert.equal(mtDeUsd(0.0305), 31, 'tiene que redondear hacia arriba, no al más cercano');
  assert.equal(usdDeMt(mtDeUsd(0.03)), 0.03, 'ida y vuelta de un valor exacto tiene que cerrar');
});

test('el saldo falla CERRADO: lo que no se pudo leer no alcanza', () => {
  // Si un error de base dejara pasar la llamada, el medidor no protege nada justo el día que la base anda mal.
  for (const malo of [null, NaN, Infinity]) {
    const v = alcanzaElSaldo(malo as number | null, 100);
    assert.equal(v.alcanza, false, `un saldo «${String(malo)}» no puede alcanzar`);
    assert.ok('motivo' in v && v.motivo.length > 0, 'tiene que decir por qué');
  }
});

test('con saldo justo alcanza, y con uno menos no', () => {
  const justo = alcanzaElSaldo(500, 500);
  assert.equal(justo.alcanza, true);
  assert.equal('queda' in justo && justo.queda, 0, 'gastar todo el saldo deja cero, no negativo');

  const corto = alcanzaElSaldo(499, 500);
  assert.equal(corto.alcanza, false);
  assert.equal('falta' in corto && corto.falta, 1, 'tiene que decir cuánto falta, no sólo que no alcanza');
});

test('una acción gratis no consume saldo ni se bloquea por saldo cero', () => {
  const v = alcanzaElSaldo(0, 0);
  assert.equal(v.alcanza, true, 'lo que no cuesta no puede frenarse por falta de saldo');
});

test('el modelo normal es MÁS BARATO que el premium: ahí vive el margen', () => {
  assert.ok(USD_POR_SEGUNDO.normal < USD_POR_SEGUNDO.premium, 'el default tiene que ser el barato');
  assert.ok(USD_POR_IMAGEN.normal < USD_POR_IMAGEN.premium, 'el default tiene que ser el barato');
  assert.ok(mtDeVideo(60, 'normal') < mtDeVideo(60, 'premium'), 'el premium tiene que costar más tokens');
  assert.ok(mtDeImagenes(10, 'normal') < mtDeImagenes(10, 'premium'));
});

test('los cupos crecen con el plan, y el de pago alcanza para competir', () => {
  const orden: Plan[] = ['free', 'pro', 'growth'];
  for (let i = 1; i < orden.length; i++) {
    assert.ok(CUPO_MENSUAL[orden[i]] > CUPO_MENSUAL[orden[i - 1]], `${orden[i]} tiene que dar más que ${orden[i - 1]}`);
  }

  // ⚠️ EL NÚMERO QUE DEFINE SI SOMOS COMPETITIVOS, medido el 7/11: Creatify Pro da 15 minutos de video por
  // US$99 y Higgsfield Ultra 25. Un reel de 60 s se arma con ~32 s generados, así que 15 reels son 480 s.
  // Si el cupo de Growth no alcanza para eso, el plan no compite y hay que subirlo o abaratar el modelo.
  const seg = segundosQueEntran(CUPO_MENSUAL.growth, 'normal');
  assert.ok(seg >= 480, `Growth da ${seg} s de video y hacen falta 480 para 15 reels: no compite con Creatify`);

  // Y el Free tiene que dar para UNA prueba, no para cero (Martín: «1 video de prueba al mes»).
  assert.ok(segundosQueEntran(CUPO_MENSUAL.free, 'normal') >= 32, 'el Free no alcanza ni para un video de prueba');
});

test('las imágenes son baratas: el Free puede ser generoso con ellas', () => {
  // Martín, 7/11: «imágenes le podemos ofrecer muchas más». Esto lo fija: 100 imágenes normales tienen que
  // entrar cómodas en el cupo Free, o la promesa no se cumple.
  assert.ok(mtDeImagenes(100, 'normal') <= CUPO_MENSUAL.free, '100 imágenes no entran en el Free');
});

test('el cupo de Growth no regala margen: su costo tiene que ser una fracción del precio', () => {
  // ⚠️ Esta es la guarda del NEGOCIO, no del código. Si alguien sube los cupos sin mirar, esto se pone rojo.
  const PRECIO_GROWTH = 97;
  const costoMaximo = usdDeMt(CUPO_MENSUAL.growth);
  assert.ok(costoMaximo <= PRECIO_GROWTH * 0.30,
    `el cupo de Growth permite gastar US$${costoMaximo} sobre un precio de US$${PRECIO_GROWTH}: más del 30 % no deja margen`);
});

test('el escalón entre planes existe: el de US$47 no da el video del de US$97', () => {
  // ⚠️ LA GUARDA DEL PRECIO. El cupo solo NO alcanza: topea gasto, no cantidad. Sin VIDEOS_POR_MES, un Pro
  // se gastaba el cupo entero en video (~9 reels) y los dos planes daban lo MISMO por dólar — los dos cupos
  // son el 25 % del precio. Martín, 7/11: «el de 47 sólo le ofreceremos 1 video de prueba al mes».
  assert.ok(VIDEOS_POR_MES.pro < VIDEOS_POR_MES.growth,
    'Pro y Growth dan la misma cantidad de video: no hay razón para subir de plan');
  assert.ok(VIDEOS_POR_MES.free < VIDEOS_POR_MES.pro,
    'el Free da tanto video como el Pro: el primer video es lo que se paga al pasar a Pro');
});

test('con el tope del mes agotado no se dispara la generación, por más saldo que sobre', () => {
  const caro = mtDeVideo(30, 'normal');
  // Saldo de sobra a propósito: lo que frena acá NO es la plata.
  const v = alcanzaParaVideo('pro', 1, 999_999, caro);
  assert.equal(v.alcanza, false, 'un Pro que ya usó su video del mes pudo generar otro');
});

test('al que se le acabaron los videos NO se le dice que le falta saldo', () => {
  // Mandarlo a comprar tokens que no le van a servir es peor que no dejarlo pasar: le cobra por nada.
  const v = alcanzaParaVideo('pro', 1, 999_999, mtDeVideo(30));
  assert.equal(v.alcanza, false);
  if (!v.alcanza) {
    assert.ok(!/token|saldo/i.test(v.motivo), `el motivo habla de saldo cuando el problema es el tope: «${v.motivo}»`);
    assert.ok(/plan|growth|pro/i.test(v.motivo), `el motivo no dice qué hacer: «${v.motivo}»`);
  }
});

test('el tope de videos falla CERRADO: un conteo que no se pudo leer no habilita', () => {
  // Misma regla que el saldo. Si un error de base dejara pasar la generación, el tope no protege nada
  // justo el día que la base anda mal.
  for (const conteo of [null, NaN, Infinity]) {
    const v = alcanzaParaVideo('pro', conteo as number | null, 999_999, 10);
    assert.equal(v.alcanza, false, `un conteo ${String(conteo)} dejó generar`);
  }
});

test('el Growth no se frena por el tope: ahí el límite es el cupo', () => {
  const cuesta = mtDeVideo(30, 'normal');
  assert.equal(alcanzaParaVideo('growth', 50, CUPO_MENSUAL.growth, cuesta).alcanza, true,
    'un Growth con saldo no pudo generar su video número 51');
  // …pero el cupo SÍ lo frena, que es lo que protege el margen.
  assert.equal(alcanzaParaVideo('growth', 50, cuesta - 1, cuesta).alcanza, false,
    'un Growth sin saldo igual generó: el cupo no está frenando nada');
});

test('el precio del video vive en el rango de lo real: un número inventado se pone rojo', () => {
  // ⚠️ ESTE TEST EXISTE POR UN BUG QUE YA PASÓ. `normal` decía 0,030 porque lo copié del tarifario de un
  // proveedor en vez de medirlo; lo real era 0,0384, un 28 % más — y salía del margen en CADA generación.
  // Ningún test lo cachó: los otros miran que normal < premium y que el cupo alcance, y las dos cosas se
  // cumplen igual con un número mentido HACIA ABAJO. Con 0,001 pasaban los 13.
  //
  // Un test no puede saber el precio de hoy sin llamar al proveedor (y entonces cuesta plata y se cae sin red).
  // Lo que SÍ puede es exigir que el número esté donde viven los precios de verdad. Si el proveedor baja de
  // golpe, este test se pone rojo y obliga a MEDIRLO y a anotar la fecha, que es justo lo que faltó.
  const PISO = 0.010;   // más barato que esto en 2026 no existe: es un número tipeado, no medido
  const TECHO = 0.200;  // más caro que esto no lo podemos poner de default sin fundir el plan
  for (const [calidad, usd] of Object.entries(USD_POR_SEGUNDO)) {
    assert.ok(usd >= PISO,
      `US$${usd}/s para «${calidad}» está por debajo de cualquier precio real: medilo contra el proveedor y anotá la fecha`);
    assert.ok(usd <= TECHO,
      `US$${usd}/s para «${calidad}» es demasiado caro para un default: 480 s saldrían US$${(usd * 480).toFixed(2)}`);
  }
  // Y las imágenes, por lo mismo: a US$0 el medidor deja pasar generaciones gratis que sí se pagan.
  for (const [calidad, usd] of Object.entries(USD_POR_IMAGEN)) {
    assert.ok(usd > 0, `una imagen «${calidad}» no puede costar US$${usd}: el medidor la dejaría pasar gratis`);
  }
});
