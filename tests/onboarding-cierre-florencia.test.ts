// =============================================================================
// El cierre del onboarding no guarda «sin dato» como dato, y el PDF dice lo que ella contó (20/10/2026)
// =============================================================================
// Florencia (ws21, 18/10), medido en producción: «sin dato: en 200 casos, 100% llegó a defender…» llegó a la promesa
// del producto y al brief; el PDF le dijo «Todavía no lo tienes claro» justo sobre ese dato; su escalera (la Meet gratis
// de 1 h) no salió porque la pieza no tenía título; y el producto quedó «pago único» aunque cobra 6 cuotas.
// docs/hallazgos-onboarding.md, «Florencia (ws21, 18/10)».
//
// ROTURAS (20/10/2026, arnés romper-cierre.js del scratchpad; base 4/0): sinMarca sin «sin dato» → 3/1 · el PDF sin
// mirar si trae datos → 3/1 · la escalera sin título → 3/1 · el producto con 'unico' fijo → 3/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cobroDelPrecio, sinMarca } from '../lib/onboarding-arranque';
import { apartadosLoQueVendes } from '../lib/lo-que-vendes-pdf';
import type { PiezasSabidas } from '../lib/offer-marco';

const at = '2026-10-18T22:43:34Z';
const p = (valor: string) => ({ valor, fuente: 'chat' as const, at });

test('«sin dato: …» no es un dato para el producto ni el brief', () => {
  assert.equal(sinMarca('sin dato: en 200 casos, 100% llegó a defender y aprobar'), '');
  assert.equal(sinMarca('Sin dato'), '');
  assert.equal(sinMarca('[completar] la promesa'), '');
  assert.equal(sinMarca('Defienden su tesis en 6 meses'), 'Defienden su tesis en 6 meses');
});

test('el PDF muestra lo que contó aunque venga marcado «sin dato», y la escalera sale con su título', () => {
  const piezas: PiezasSabidas = {
    entregables: p('Acompañamiento de tesis por Meet'),
    resultado: p('sin dato: en 200 casos, 100% llegó a defender y aprobar, pero no dijo el plazo'),
    precio: p('sin dato: depende del cliente'),
    escalera: p('Una Meet gratis de 1 hora antes; el 40% vuelve'),
  };
  const a = apartadosLoQueVendes(piezas);
  const resultado = a.find((x) => x.pieza === 'resultado');
  assert.equal(resultado?.sinDato, false, 'con números, no es «Todavía no lo tienes claro»');
  assert.match(resultado?.texto ?? '', /^en 200 casos/);
  assert.equal(a.find((x) => x.pieza === 'precio')?.sinDato, true, 'un «depende» sin datos sigue diciendo que falta');
  assert.ok(a.some((x) => x.pieza === 'escalera' && x.titulo && x.texto.includes('Meet gratis')), 'la escalera no salía en el PDF');
});

test('cómo cobra sale de lo que dijo del precio', () => {
  assert.deepEqual(cobroDelPrecio('Contrato de 12 meses pagando 6 cuotas mensuales de 150 USD'), { tipo: 'suscripcion', meses: 6 });
  assert.deepEqual(cobroDelPrecio('150 USD por mes'), { tipo: 'suscripcion', meses: null });
  assert.deepEqual(cobroDelPrecio('800 MXN mensuales durante 3 meses'), { tipo: 'suscripcion', meses: 3 });
  assert.deepEqual(cobroDelPrecio('1.500 USD en un solo pago o 3 cuotas'), { tipo: 'unico', meses: null }, 'el pago único manda');
  assert.deepEqual(cobroDelPrecio('Programa de 12 meses, 3.000 USD'), { tipo: 'unico', meses: null }, 'la duración no es el cobro');
  assert.deepEqual(cobroDelPrecio(''), { tipo: 'unico', meses: null });
});

test('el producto del onboarding toma el tipo de cómo cobra', () => {
  const srv = readFileSync(join(__dirname, '..', 'lib/onboarding-arranque-server.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(srv, /const cobro = cobroDelPrecio\(precio\);/);
  assert.match(srv, /tipo: cobro\.tipo,\n\s*monto_usd: null,\n\s*suscripcion_meses: cobro\.meses,/);
});
