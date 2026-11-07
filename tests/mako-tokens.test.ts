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
  mtDeVideo, mtDeImagenes, segundosQueEntran, alcanzaElSaldo, type Plan,
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
