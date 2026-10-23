// =============================================================================
// Lo que MaKo terminó en otra tab: el globito de la estrella y la línea con su link (22/10/2026)
// =============================================================================
// Martín: «Se debe ejecutar en segundo plano», y si se va a otra tab, que le avise cuando MaKo termine. El Cerebro: «la estrella
// con su globito alcanza». El chat Automations deja lo que terminó sin que nadie mirara en lib/mako-trabajos.ts y avisa con un
// evento de `window`.
//   1. la línea dice dónde terminó y qué, y si fue con un error; el más nuevo primero, cada uno con su link;
//   2. la estrella lo lee al montar y con cada evento, y lo suma a su globito;
//   3. el link es el de la casa: pone el `?ws=` y no recarga (la lista vive en la pestaña).
//
// Correr: node --import tsx --test tests/ops-center-trabajos-mako.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrabajosTerminados, textoDelTrabajo } from '../app/_chat/TrabajosDeMako';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const trabajo = (titulo: string, href: string, ok = true, at = 1) => ({ tab: 'Automations', titulo, href, ok, texto: 'Listo: quedó pausada', at });

test('1. la línea dice dónde terminó y qué, y si fue con un error; el más nuevo primero, con su link', () => {
  assert.equal(textoDelTrabajo(trabajo('Sprint · apertura', '/automations?sec=289')), 'MaKo terminó en Automations › Sprint · apertura');
  assert.equal(textoDelTrabajo(trabajo('Sprint · apertura', '/automations?sec=289', false)), 'MaKo no pudo terminar en Automations › Sprint · apertura');
  assert.equal(renderToStaticMarkup(createElement(TrabajosTerminados, { trabajos: [] })), '', 'sin nada, nada');
  const html = renderToStaticMarkup(createElement(TrabajosTerminados, {
    trabajos: [trabajo('Sprint · apertura', '/automations?sec=289', true, 1), trabajo('Reactivación', '/automations?sec=301', false, 2)],
  }));
  assert.match(html, /^<ul class="ch-trabajos" aria-label="Lo que MaKo terminó">/);
  const links = [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(links, [
    ['/automations?sec=301', 'MaKo no pudo terminar en Automations › Reactivación'],
    ['/automations?sec=289', 'MaKo terminó en Automations › Sprint · apertura'],
  ], 'el más nuevo primero');
  assert.match(html, /data-ok="no"/, 'el que falló se distingue');
});

test('2. la estrella lo lee al montar y con cada evento, y lo suma a su globito', () => {
  const pieza = sinComentarios(leer('app/_chat/TrabajosDeMako.tsx'));
  assert.match(pieza, /setTrabajos\(trabajosSinVer\(\)\);\n\s*const oir = /, 'al montar: lo que ya había');
  assert.match(pieza, /window\.addEventListener\(EVENTO_TRABAJO_MAKO, oir\);\n\s*return \(\) => window\.removeEventListener\(EVENTO_TRABAJO_MAKO, oir\);/);
  const tab = sinComentarios(leer('app/_chat/MakoEnLaTab.tsx'));
  assert.match(tab, /const trabajos = useTrabajosSinVer\(\);\n\s*const espera = aviso \+ trabajos\.length;/);
  assert.match(tab, /<Muneco titulo=\{JEFE_SECOND_BRAIN\} animo="despierto" size=\{40\} espera=\{espera\} \/>/, 'el globito');
  assert.match(tab, /aria-label=\{espera > 0 \? `Escríbele a MaKo desde \$\{tab\} \(\$\{espera\} para ver\)`/);
  assert.match(tab, /arriba=\{<><TrabajosTerminados trabajos=\{trabajos\} \/>\{arriba\}/, 'abierta, arriba del hilo');
});

test('3. el link es el de la casa: pone el ?ws= y no recarga', () => {
  const pieza = sinComentarios(leer('app/_chat/TrabajosDeMako.tsx'));
  assert.match(pieza, /import Link from '@\/app\/_ui\/Link';/);
  assert.doesNotMatch(pieza, /next\/link|<a /, 'ni next/link ni un <a> a mano');
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 3/0):
//   · el globito sin lo terminado                      → 2/1 (2)
//   · sin leer lo que ya había al montar               → 2/1 (2)
//   · el más viejo primero                             → 2/1 (1)
//   · un error dice «terminó»                          → 2/1 (1)
//   · un <a> a mano                                    → 2/1 (3)
