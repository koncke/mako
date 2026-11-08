// =============================================================================
// «Es el negocio número N» contesta por el CLIENTE, no por la agencia (8/11/2026)
// =============================================================================
// Hallazgo confirmado de la revisión de `punta/nada-por-detras` (unánime, 0 de 3 refutadores):
// «En los dos avisos de agencia, "Es el negocio número N" contesta por la AGENCIA y no por el
// cliente del que habla el aviso».
//
// `meta_cuenta_frenada_agencia` y `meta_cuenta_recuperada_agencia` son `plataforma: true` y salen
// por `avisoALasAgencias`, que vuelve a llamar `emitirPorEvento` con el ws de la AGENCIA. Ahí
// `datosDeLaPlataforma(ws)` ponía el número de ella, aunque el aviso habla de su cliente.
//
// Lo que rompía, en concreto: a MaKo le piden dejar de reportarle a una agencia la cuenta frenada
// de UN cliente. El admin escribe «No es el negocio número <el del cliente>» en /automations,
// Publicar lo acepta, y la condición no se cumple nunca: el aviso sigue saliendo con la pantalla
// diciendo que está excluido. Y el error simétrico es peor: poner el número de la AGENCIA apaga el
// aviso para TODOS sus clientes de una, sin que se vea.
//
// Correr: node --import tsx --test tests/aviso-agencia-numero-del-cliente.test.ts
// ROTURAS (8/11/2026, una por vez y restaurada; base 3 / 0): volver el orden del spread como estaba
// → 2 / 1; sacar el `datosDeLaPlataforma(ws)` del aviso a la agencia → 2 / 1; ponerlo DESPUÉS de
// `a.datos` (donde la agencia lo volvería a pisar) → 2 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { datosDeLaPlataforma } from '../lib/aviso-evento';

const src = readFileSync(join(process.cwd(), 'lib/aviso-evento.ts'), 'utf8');

test('el dato calculado es un DEFAULT: lo que el emisor pone a propósito gana', () => {
  assert.match(src, /datos: \{ \.\.\.datosDeLaPlataforma\(ws\), \.\.\.\(opts\.datos \?\? \{\}\) \}/,
    'el calculado va PRIMERO; al revés pisa lo que el emisor puso a propósito');
});

test('el aviso a la agencia lleva el número del CLIENTE, y la agencia no lo pisa', () => {
  const i = src.indexOf('rs.push(await emitirPorEvento(aviso, a.ws');
  assert.ok(i > 0, 'no encontré el emisor del aviso a las agencias');
  const linea = src.slice(i, i + 220);
  assert.match(linea, /\.\.\.datosDeLaPlataforma\(ws\)/,
    'tiene que viajar el número del cliente: adentro se corre con el ws de la agencia');
  assert.ok(linea.indexOf('datosDeLaPlataforma(ws)') < linea.indexOf('...a.datos'),
    'y los datos de la agencia van DESPUÉS sólo con sus propios nombres, sin volver a pisarlo');
});

test('⚠️ y el dato sigue siendo el que la pantalla pregunta', () => {
  // Si alguien le cambia el nombre, la CONDITION de /automations deja de encontrarlo y «no es el
  // negocio número N» pasa a no cumplirse nunca, en silencio.
  assert.deepEqual(datosDeLaPlataforma(77), { negocio_numero: '77' });
});
