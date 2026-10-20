// =============================================================================
// Para los negocios, la tab /second-brain se llama «Ops Center» (18/10/2026, Martín por el Cerebro)
// =============================================================================
// Los textos de MaKo que nombran el lugar («Ops Center → Persona», y lo que el chat le dice a MaKo de dónde está) usan
// el nombre que el negocio VE; la ruta (`/second-brain`), las keys y las constantes internas no cambian.
//
// Y al revés, el GRAFO sí se llama «Second Brain» (Martín, llamada con Florencia del 18/10 [00:50:28]: «no debería
// llamarse mapa, debería llamarse second brain»): el botón que lo abre en el Ops Center de un negocio y la fila del teléfono.
//
// Verificado ROMPIÉNDOLO (18/10 y 20/10/2026), contra la base en verde (4 / 0):
//   · `SB.tab` de vuelta en «Second Brain»: 3 / 1.
//   · el texto del chat diciendo «el Second Brain de MaKo»: 3 / 1.
//   · la ruta cambiada a «/ops-center»: 3 / 1.
//   · el botón de la computadora diciendo «Mapa» otra vez: 3 / 1.
//   · la fila del teléfono diciendo «Mapa» otra vez: 3 / 1.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DONDE_SE_EDITA, lugarSeccion, rutaSeccion } from '../lib/secciones-negocio';
import { CONTEXTO_SECOND_BRAIN } from '../lib/chat-mako-reglas';

test('el lugar se nombra «Ops Center» en todas las secciones', () => {
  for (const [s, d] of Object.entries(DONDE_SE_EDITA)) assert.equal(d.tab, 'Ops Center', s);
  assert.equal(lugarSeccion('archivero'), 'Ops Center → Documentos');
});

test('MaKo sabe que el chat central se llama «Ops Center»', () => {
  assert.match(CONTEXTO_SECOND_BRAIN, /el Ops Center de MaKo/);
  assert.ok(!/Second Brain/.test(CONTEXTO_SECOND_BRAIN), 'ningún «Second Brain» en lo que MaKo puede repetir');
});

test('la ruta y las keys siguen iguales', () => {
  assert.equal(rutaSeccion('persona'), '/second-brain?area=voz&vista=persona');
  assert.match(readFileSync(join(__dirname, '..', 'lib/chat-mako-reglas.ts'), 'utf8'), /export const CONTEXTO_SECOND_BRAIN = /);
});

test('el botón que abre el grafo se llama «Second Brain», en la computadora y en el teléfono', () => {
  const sb = readFileSync(join(__dirname, '..', 'app/second-brain/ChatSecondBrain.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const i = sb.indexOf('{veMapa && listaSB && (');
  const boton = sb.slice(i, sb.indexOf('</button>', i));
  assert.ok(i > 0, 'el botón del grafo en la barra');
  assert.match(boton, /size=\{17\} \/>Second Brain\n/);
  assert.ok(!/\/>Mapa/.test(boton), 'nunca «Mapa»');
  const tel = readFileSync(join(__dirname, '..', 'app/m/mako/ChatMako.tsx'), 'utf8');
  assert.match(tel, /<FilaM navegacion titulo="Second Brain" icono="cerebro" href=\{hrefMapa\} \/>/);
});
