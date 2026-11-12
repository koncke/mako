// =============================================================================
// El negocio por su nombre: `buscar_negocio` y la agencia por nombre en `ver_mensualidades_agencias` (11/11/2026)
// =============================================================================
// Martín, en el grupo SuperAdmin: «cuanto va a pagar codigo inmobiliario el mes entrante con todos los clientes», y MaKo: «Necesito
// saber a qué me refiero con "código inmobiliario"». El mes que viene y el bloque de la plataforma los trajo el chat de WhatsApp
// (punta/wa-sorda-1011, c88df3ff6, todavía no en main). Esto cuida lo que no depende de eso:
//   · `ver_mensualidades_agencias` acepta la agencia por NOMBRE, sin tildes y SÓLO entre las agencias; con más de una, pregunta;
//   · `buscar_negocio`: número, nombre, capa, pausa, su agencia y, si es agencia, sus clientes; una cartera revocada no cuenta;
//   · las dos, sólo en la plataforma; `buscar_negocio` lee la cartera estricto y sin HTTP.
//
// Probado rompiéndolo (11/11/2026): al pie del archivo.
// Correr: node --import tsx --test tests/buscar-negocio.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { negociosDelPedido } from '../lib/buscar-negocio-reglas';
import { buscarNegocio } from '../lib/diagnostico-negocio';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

const NEGOCIOS = [
  { ws: 3, nombre: 'Cliente de Prueba', capa: 'completo', estado: 'activo' },
  { ws: 9, nombre: 'Martin Koncke', capa: 'superadmin', estado: 'activo' },
  { ws: 13, nombre: 'Codigo Inmobiliario', capa: 'agencia', estado: 'activo' },
  { ws: 15, nombre: 'Brigitte Eberlin', capa: 'completo', estado: 'activo' },
  { ws: 18, nombre: 'Pablo Chavez', capa: 'completo', estado: 'pausado' },
  { ws: 24, nombre: 'Sellers', capa: 'completo', estado: 'activo' },
];
const CARTERA = [
  { agencia_ws: 13, cliente_ws: 24, estado: 'pendiente' },
  { agencia_ws: 13, cliente_ws: 15, estado: 'aprobado' },
  { agencia_ws: 13, cliente_ws: 18, estado: 'aprobado' },
  { agencia_ws: 13, cliente_ws: 3, estado: 'revocado' },
];

test('la agencia, por su nombre y sin tildes: el 13 con sus clientes, y la revocada no', () => {
  for (const pedido of ['Código Inmobiliario', 'codigo inmobiliario', 'CÓDIGO', '13']) {
    const r = negociosDelPedido(pedido, NEGOCIOS, CARTERA);
    assert.deepEqual(r.map((n) => n.ws), [13], pedido);
  }
  const [codigo] = negociosDelPedido('Código Inmobiliario', NEGOCIOS, CARTERA);
  assert.equal(codigo.capa, 'Agencia');
  assert.equal(codigo.agencia, null);
  assert.deepEqual(codigo.clientes.map((c) => [c.ws, c.nombre, c.espera_aprobacion]), [
    [15, 'Brigitte Eberlin', false], [18, 'Pablo Chavez', false], [24, 'Sellers', true],
  ], 'por número; el Cliente de Prueba (revocado) no');
});

test('un cliente, con su agencia y si está en pausa', () => {
  const [pablo] = negociosDelPedido('pablo', NEGOCIOS, CARTERA);
  assert.deepEqual({ ws: pablo.ws, en_pausa: pablo.en_pausa, agencia: pablo.agencia }, { ws: 18, en_pausa: true, agencia: { ws: 13, nombre: 'Codigo Inmobiliario', espera_aprobacion: false } });
  const [prueba] = negociosDelPedido('cliente de prueba', NEGOCIOS, CARTERA);
  assert.equal(prueba.agencia, null, 'la cartera revocada es historia');
  assert.deepEqual(negociosDelPedido('nadie así', NEGOCIOS, CARTERA), []);
  assert.equal(JSON.stringify(negociosDelPedido('Código Inmobiliario', NEGOCIOS, CARTERA)).includes('usd'), false, 'sin montos');
});

test('ver_mensualidades_agencias: la agencia por nombre, sólo entre las agencias, y pregunta si hay más de una', () => {
  const agencias = [{ ws: 13, nombre: 'Codigo Inmobiliario' }, { ws: 31, nombre: 'Codigo Norte' }];
  assert.deepEqual(buscarNegocio('Código Inmobiliario', agencias).map((x) => x.ws), [13]);
  assert.deepEqual(buscarNegocio('código', agencias).map((x) => x.ws), [13, 31], 'dos: se pregunta cuál');
  const run = fuente('lib/api-mako/areas/cobros.run.ts');
  const ver = run.slice(run.indexOf('  ver_mensualidades_agencias: {'), run.indexOf('  marcar_mensualidad_pagada: {'));
  assert.match(ver, /\.filter\(\(w\) => agencias\.some\(\(a\) => a\.ws === Number\(w\.id\)\)\)/, 'sólo entre las agencias');
  assert.match(ver, /const halladas = buscarNegocio\(pedida, conNombre\);\n\s+if \(halladas\.length !== 1\) \{/, 'una sola, o pregunta');
  assert.match(ver, /una = halladas\[0\]\.ws;/);
  const def = fuente('lib/api-mako/areas/cobros.def.ts');
  const d = def.slice(def.indexOf("id: 'ver_mensualidades_agencias'"), def.indexOf("id: 'marcar_mensualidad_pagada'"));
  assert.match(d, /nombre: 'agencia', rotulo: 'Nombre de la agencia', tipo: 'string'/);
});

test('buscar_negocio: sólo la plataforma, sin HTTP, y la cartera leída estricto', () => {
  const def = fuente('lib/api-mako/areas/cs.def.ts');
  const d = def.slice(def.indexOf("id: 'buscar_negocio'"));
  assert.match(d, /gating: \{ rolMinimo: 'admin', soloPlataforma: true \}/);
  assert.match(d, /canales: SIN_HTTP/);
  const run = fuente('lib/api-mako/areas/cs.run.ts');
  const b = run.slice(run.indexOf('  buscar_negocio: {'));
  assert.match(b, /if \(ctx\.ws !== \(await wsSuperAdmin\(\)\)\) return fallo\(/);
  assert.match(b, /if \(w\.error \|\| c\.error\) return fallo\(/, 'una cartera que no se leyó no es «sin agencia»');
});

// Probado rompiéndolo (11/11/2026), una rotura por vez sobre la base en verde (4 / 0), restaurando desde una copia:
//   · contar también la cartera revocada                                       → 2 / 2
//   · la agencia por nombre buscando entre TODOS los negocios                   → 3 / 1
//   · buscar_negocio tolerando que la cartera no se lea                         → 3 / 1
