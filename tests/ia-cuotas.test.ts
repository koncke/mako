// =============================================================================
// La cuota se mide POR CUENTA, y el tope tiene que ser un tope que exista
// =============================================================================
// Dos defectos distintos se sumaban para producir el mismo síntoma, y el síntoma es
// el peor que puede tener esta pantalla: **conectar más keys empeoraba el mensaje.**
// El dueño lo reportó así, con tres cuentas de Gemini cargadas:
//
//   «No puede ser que tengo 3 API de gemini conectadas y me dice que me quedé sin
//    tokens...»
//
//   1. `claveCuenta(p, 1)` devolvía el nombre PELADO del proveedor — el mismo
//      casillero donde se acumula el total. La fila «cuenta 1» del panel mostraba la
//      SUMA de las tres keys contra el tope de UNA.
//   2. `tokensDia: 250_000` de Gemini es el tope por MINUTO (TPM) puesto como tope
//      del DÍA: 1440 veces más chico que la realidad.
//
// Los números de acá son REALES, medidos contra `anthropic_usage` el 19/09/2026
// (scripts/diag-gemini-cuotas.mjs), no inventados para que el test pase.
//
// PROBADO ROMPIÉNDOLO (19/09/2026), que es lo único que dice si mide algo:
//
//   claveCuenta(p,1) devolviendo el nombre pelado .......... 3 fallan, 3 pasan
//   tokensDia: 250_000 de vuelta en gemini ................. 2 fallan, 4 pasan
//   LOS DOS (el estado real de producción hasta hoy) ....... 5 fallan, 1 pasa
//
// Cada defecto se caza solo, que es lo que importa: si mañana vuelve uno de los
// dos, no hace falta que vuelva el otro para que esto se ponga rojo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GEMINI_PAGO,
  LIMITES_PROVEEDOR,
  UMBRAL,
  claveCuenta,
  pctDe,
  plegarUso,
  usoDeCuenta,
  type FilaUso,
} from '../lib/ia-cuotas-calculo';

/** El día real de ws9 (2026-09-18): la cuenta 1 no atendió NADA. */
const DIA_REAL_WS9: FilaUso[] = [
  ...Array.from({ length: 10 }, (): FilaUso => ({ provider: 'gemini', cuenta: 2, input_tokens: 39_872, output_tokens: 1 })),
  ...Array.from({ length: 11 }, (): FilaUso => ({ provider: 'gemini', cuenta: 3, input_tokens: 40_253, output_tokens: 1 })),
];

test('la cuenta 1 tiene casillero propio y NO es el del total del proveedor', () => {
  // Si estos dos vuelven a ser la misma string, el total se pisa con la cuenta 1 y
  // todo lo de abajo se cae en silencio.
  assert.notEqual(claveCuenta('gemini', 1), 'gemini');
  assert.equal(claveCuenta('gemini', 1), 'gemini#1');
  assert.equal(claveCuenta('gemini', 2), 'gemini#2');
});

test('una cuenta que no atendió ninguna llamada figura en CERO, no con la suma de las otras', () => {
  const uso = plegarUso(DIA_REAL_WS9);

  // Lo que el panel mostraba en la fila «cuenta 1»: 21 pedidos y 841k tokens que
  // nunca pasaron por esa key.
  assert.deepEqual(usoDeCuenta(uso, 'gemini', 1), { requests: 0, tokens: 0 });
  assert.equal(usoDeCuenta(uso, 'gemini', 2).requests, 10);
  assert.equal(usoDeCuenta(uso, 'gemini', 3).requests, 11);

  // El agregado sigue existiendo y sigue siendo la suma: es lo que contesta
  // «cuánto consumí hoy», que es una pregunta legítima y distinta.
  assert.equal(uso.gemini.requests, 21);
  assert.equal(uso.gemini.tokens, 398_730 + 442_794);
});

test('el día real de ws9 NO agota la cuota de Gemini: 21 pedidos contra 250', () => {
  const uso = plegarUso(DIA_REAL_WS9);
  const lim = LIMITES_PROVEEDOR.gemini;

  // Ninguna de las tres cuentas llega al umbral. Antes, las tres lo pasaban: la 2 y
  // la 3 por sus propios tokens y la 1 por cargar la suma de las otras dos.
  for (const cuenta of [1, 2, 3]) {
    const pct = pctDe(usoDeCuenta(uso, 'gemini', cuenta), lim);
    assert.ok(pct < UMBRAL, `cuenta ${cuenta} da ${(pct * 100).toFixed(1)}%, y no debería estar cerca del tope`);
  }

  // Y el proveedor entero tampoco: 21/250 pedidos.
  assert.ok(pctDe(uso.gemini, lim) < UMBRAL);
});

test('Gemini no tiene tope de tokens por DÍA: el 250k era el de por MINUTO', () => {
  // Medido: veinte días-workspace pasaron ese "tope" (de 139% a 469%) y Google
  // contestó TODAS las llamadas. Un tope que se revienta a diario sin una sola queja
  // del proveedor no es un tope.
  assert.equal(LIMITES_PROVEEDOR.gemini.tokensDia, undefined);
  assert.equal(GEMINI_PAGO.tokensDia, undefined);
  assert.equal(LIMITES_PROVEEDOR.gemini.rpd, 250, 'los PEDIDOS sí los limita Gemini por día');

  // El peor día medido (ws9, 05/08: 1.171.928 tokens en 144 pedidos) tiene que
  // seguir siendo "hay cuota", porque lo fue: esas 144 llamadas se contestaron.
  const peorDia = { requests: 144, tokens: 1_171_928 };
  assert.ok(pctDe(peorDia, LIMITES_PROVEEDOR.gemini) < UMBRAL);
});

test('a Groq no se le tocó el tope: ese sí es por día y está medido', () => {
  // El bug era de Gemini. Groq sigue con su límite diario de tokens del plan gratis.
  assert.equal(LIMITES_PROVEEDOR.groq.tokensDia, 500_000);
  assert.ok(pctDe({ requests: 3, tokens: 480_000 }, LIMITES_PROVEEDOR.groq) >= UMBRAL);
});

test('las filas viejas sin columna `cuenta` (pre mig 0132) se leen como la cuenta 1', () => {
  const uso = plegarUso([{ provider: 'gemini', cuenta: null, input_tokens: 100, output_tokens: 20 }]);
  assert.equal(usoDeCuenta(uso, 'gemini', 1).tokens, 120);
  assert.equal(uso.gemini.tokens, 120);
});
