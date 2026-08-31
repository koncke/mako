// =============================================================================
// Qué se le dice a alguien cuando Google Flow no pudo
// =============================================================================
// El defecto que motivó este archivo: la pantalla ADIVINABA la causa aplicando
// expresiones sobre el texto del error… que el propio server ya había traducido
// al castellano. Medido, ocho de los nueve mensajes posibles caían en «no sé», y
// el peor caso decía «Google no pudo hacer la imagen y no dijo por qué / tus
// créditos están bien» cuando la instrucción que lo arreglaba en dos segundos
// —«Recárgala (F5)»— estaba escrita palabra por palabra en la misma fila.
//
// De ahí las dos cosas que se fijan acá: que el mapa de motivos esté COMPLETO, y
// que la frase del server le gane a la constante.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { causaFlow, causaDeMotivo, textoFlow, cuandoPaso } from '../lib/flow-fallo-texto';

// ── El mapa de motivos está completo ────────────────────────────────────────

/**
 * Los motivos que el server puede escribir, leídos del FUENTE.
 *
 * ⚠️ Se extraen de `MotivoFalla` en vez de escribirlos acá: una lista copiada a
 * mano se queda vieja el día que alguien agrega un motivo, que es justamente el
 * día en que este test tiene que fallar. Es la regla de la casa —una cosa, un
 * lugar— aplicada a su propio test.
 */
function motivosDelFuente(): string[] {
  const src = readFileSync(join(process.cwd(), 'lib/flow-protocolo.ts'), 'utf8');
  const i = src.indexOf('export type MotivoFalla =');
  assert.ok(i > 0, 'MotivoFalla ya no está en lib/flow-protocolo.ts: el test quedó viejo');
  const fin = src.indexOf(';', i);
  return [...src.slice(i, fin).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

test('TODO motivo que el server puede escribir tiene su causa', () => {
  const motivos = motivosDelFuente();
  assert.ok(motivos.length >= 8, `se leyeron ${motivos.length} motivos: la extracción falló`);
  const huerfanos = motivos.filter((m) => causaDeMotivo(m) === undefined);
  assert.deepEqual(
    huerfanos, [],
    `sin causa: ${huerfanos.join(', ')}. Un motivo fuera del mapa cae a adivinar por texto, `
    + 'que es exactamente lo que este mapa vino a reemplazar.',
  );
});

test('un motivo desconocido NO inventa una causa: devuelve undefined', () => {
  // El mapa es cerrado a propósito. Contestar algo sobre un motivo que no se
  // conoce sería la misma adivinanza con otra cara.
  assert.equal(causaDeMotivo('algo_que_no_existe'), undefined);
  assert.equal(causaDeMotivo(''), undefined);
});

test('la pestaña muda NO es un problema de créditos ni de Google', () => {
  // El caso exacto que el dueño vio en pantalla.
  assert.equal(causaDeMotivo('puente_dormido'), 'puente');
  const t = textoFlow('puente', 'la imagen del escenario 1');
  assert.match(t.titulo, /puente|Flow/i);
  assert.doesNotMatch(t.detalle, /créditos están bien/i, 'no puede hablar de créditos');
  assert.doesNotMatch(t.titulo, /no dijo por qué/i);
});

// ── La frase del server le gana a la constante ──────────────────────────────

test('cuando el server escribió una instrucción, se muestra la del server', () => {
  // El server vio el error crudo y muchas veces sabe algo que acá no se puede
  // saber: qué pestaña, qué campo, qué hay que apretar. Reemplazarla por un texto
  // genérico es tirar la única parte accionable del mensaje.
  const delServer = 'La pestaña de Google Flow está abierta pero no responde. Recárgala (F5) y vuelve a intentar.';
  const t = textoFlow('puente', 'la toma 3', undefined, new Date(), delServer);
  assert.equal(t.detalle, delServer);
});

test('sin frase del server queda la constante, no un vacío', () => {
  const t = textoFlow('puente', 'la toma 3', undefined, new Date(), '   ');
  assert.ok(t.detalle.length > 30);
  assert.match(t.detalle, /extensi[oó]n/i);
});

test('la fecha se antepone también a la frase del server', () => {
  // Las dos mitades tienen que convivir: un error de hace tres días presentado
  // como si acabara de ocurrir es una mentira, venga el texto de donde venga.
  const hace3dias = new Date(Date.now() - 3 * 24 * 3600_000).toISOString();
  const t = textoFlow('puente', 'la toma 3', hace3dias, new Date(), 'Recárgala (F5).');
  assert.match(t.detalle, /hace 3 días/);
  assert.match(t.detalle, /Recárgala/);
});

// ── La fecha ────────────────────────────────────────────────────────────────

test('un error de recién NO se fecha, y uno viejo SÍ', () => {
  const ahora = new Date('2026-08-30T12:00:00Z');
  assert.equal(cuandoPaso(new Date('2026-08-30T11:00:00Z').toISOString(), ahora), '');
  assert.equal(cuandoPaso(new Date('2026-08-29T11:00:00Z').toISOString(), ahora), 'Esto pasó ayer.');
  assert.match(cuandoPaso(new Date('2026-08-27T11:00:00Z').toISOString(), ahora), /hace 3 días/);
});

test('una fecha ilegible no rompe ni inventa', () => {
  assert.equal(cuandoPaso('no es una fecha', new Date()), '');
  assert.equal(cuandoPaso(undefined, new Date()), '');
});

// ── El clasificador por texto, que queda de red ─────────────────────────────

test('el 400 de forma sigue siendo culpa NUESTRA y no del cliente', () => {
  assert.equal(causaFlow('Invalid JSON payload received. Unknown name "userInput"'), 'nuestra');
  const t = textoFlow('nuestra', 'la imagen del escenario 1');
  assert.doesNotMatch(t.detalle, /revisa tus/i, 'no puede mandar a tocar las credenciales del cliente');
  assert.equal(t.arreglaEn, undefined, 'y no lleva link a configuración');
});

test('la cuota gana sobre la sesión: un 403 por créditos trae las dos señales', () => {
  assert.equal(causaFlow('HTTP 403 · RESOURCE_EXHAUSTED: quota exceeded'), 'sin_creditos');
});
