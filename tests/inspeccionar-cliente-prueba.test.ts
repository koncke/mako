// =============================================================================
// Inspeccionar el Cliente de Prueba: «Salir» vuelve a donde estabas, el Reset aparece, y la barra no tapa nada
// =============================================================================
// Martín (17/10/2026, desde el Ops Center): «Entré a la vista de "Cliente de prueba" con mi cuenta de SuperAdmin y al
// salir de la vista me llevó a inspeccionar los clientes de Código Inmobiliario, eso no tiene sentido... Y el cliente
// de prueba no se puede reiniciar como antes... que la topbar de "Inspeccionar" no interfiera».
//
// ⚠️ Los dos primeros eran UNA causa, y era un DATO: el ws 3 tiene una fila de Código Inmobiliario (ws 13) en
// `agencia_clientes`, REVOCADA el 28/09 («El ws3 es el Cliente de Prueba, no un cliente de Codigo»). `agenciaDeCliente`
// la contaba como dueña (cualquier estado) y mandaba «Salir» a la cartera de Código; y `wsDePrueba` escondía el panel
// de pruebas (con el Reset) ante CUALQUIER fila. Una revocada es historia: no se borra, se deja de contar.
//
// Correr: npx tsx --test tests/inspeccionar-cliente-prueba.test.ts
//
// PROBADO ROMPIÉNDOLO el 17/10/2026 (base 4/0; pasa/falla):
//   - `esCarteraVigente` vuelve a aceptar 'revocado'                 → 3/1
//   - `agenciaDeCliente` sin el filtro (cualquier estado)            → 3/1
//   - `wsDePrueba` vuelve a esconder el panel ante cualquier fila    → 3/1
//   - el onboarding vuelve a `inset: 0` (debajo de la barra)         → 3/1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esCarteraVigente, ESTADOS_CARTERA } from '../lib/agencia-cartera';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('una fila de cartera revocada es historia: no es dueña de nadie', () => {
  assert.deepEqual(ESTADOS_CARTERA.filter((e) => esCarteraVigente({ estado: e })), ['pendiente', 'aprobado']);
  assert.equal(esCarteraVigente({ estado: 'revocado' }), false);
  assert.equal(esCarteraVigente({ estado: 'cualquier-otra' }), false, 'un estado desconocido no es vigente');
});

test('«Salir de la vista» sólo sube a la agencia si el cliente es suyo HOY', () => {
  const src = sinComentarios(leer('lib/agencia.ts'));
  const i = src.indexOf('export const agenciaDeCliente');
  const cuerpo = src.slice(i, src.indexOf('\n});', i));
  assert.match(cuerpo, /const duenos = \(await agenciasDeCliente\(clienteWs\)\)\.filter\(esCarteraVigente\);/,
    'una fila revocada vuelve a mandar «Salir» a la cartera de otra agencia');
});

test('el panel de pruebas (con el Reset) del Cliente de Prueba no se esconde por una fila revocada', () => {
  const src = sinComentarios(leer('app/api/datos-mau/route.ts'));
  const i = src.indexOf('async function wsDePrueba');
  const cuerpo = src.slice(i, src.indexOf('\n}\n', i));
  assert.match(cuerpo, /if \(\(await agenciasDeCliente\(ws\)\)\.some\(esCarteraVigente\)\) return null;/,
    'el Reset vuelve a desaparecer en el Cliente de Prueba');
  // Y la lista blanca sigue primero: nunca un cliente real.
  assert.ok(cuerpo.indexOf('esClienteDePrueba(ws)') < cuerpo.indexOf('agenciasDeCliente(ws)'));
});

test('el onboarding empieza DEBAJO de la barra de «Inspeccionar»', () => {
  const chat = leer('app/onboarding/ChatArranque.tsx');
  const i = chat.indexOf('.arr-capa {');
  assert.ok(i > 0, 'no encuentro la capa del onboarding');
  const regla = chat.slice(i, chat.indexOf('}', i));
  assert.match(regla, /top: var\(--barra-agencia, 0px\)/, 'la barra vuelve a tapar el encabezado del onboarding');
  assert.doesNotMatch(regla, /inset: 0/);
});
