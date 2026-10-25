// =============================================================================
// Cerrar un modal hijo vuelve al padre: «Traer», el Scraper e «Importar» se abren ENCIMA de «Nuevo lead» (24/10/2026)
// =============================================================================
// Martín, textual (punto 19 del 24/10): «Si le doy a "Scraper" o algun boton asi, se me abre el modal nuevo, si me salgo
// haciendo click afuera debería tener abierto el modal anterior. Siempre todos los modales deben tener esa "navegación"
// interna.»
// La casa ya tenía la regla (app/_components/pila-modales.ts: el de abajo se esconde sin desmontarse y vuelve al cerrar el
// de arriba); «Nuevo lead» la salteaba: REEMPLAZABA su contenido por «Traer» y el Scraper, y CERRABA el alta para abrir
// «Importar». Acá se mira que cada uno sea un modal propio, encima, y que cerrarlo no cierre el alta.
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decidirVisible } from '../app/_components/pila-modales';

const leer = (r: string) => readFileSync(join(import.meta.dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const B = sinComentarios(leer('app/crm/CrmBoard.tsx'));

test('la pila de la casa: con un modal encima, el de abajo no se ve; al cerrarlo, vuelve', () => {
  const sinAnidadas = new Set<string>();
  assert.equal(decidirVisible(['alta', 'traer'], 'alta', sinAnidadas, sinAnidadas), false, 'el alta se esconde');
  assert.equal(decidirVisible(['alta', 'traer'], 'traer', sinAnidadas, sinAnidadas), true);
  assert.equal(decidirVisible(['alta'], 'alta', sinAnidadas, sinAnidadas), true, 'cerrado «traer», el alta vuelve');
});

test('«Nuevo lead» es un modal y «Traer»/el Scraper otro, encima; cerrarlos vuelve al alta', () => {
  assert.match(B, /<Modal titulo="Nuevo lead" ancho=\{560\} onCerrar=\{cerrarAlta\}>\s*<NewLeadForm/, 'el alta dejó de ser su propio modal');
  assert.match(B, /\{nuevoLead\?\.traer && \(\s*<Modal\s/, '«Traer» volvió a reemplazar el contenido del alta');
  assert.match(B, /onCerrar=\{volverAlAlta\}/, 'cerrar «Traer» (clic afuera, Escape, la ✕) cierra el alta entera');
  assert.match(B, /const volverAlAlta = useCallback\(\(\) => setNuevoLead\(\(n\) => \(n \? \{ \.\.\.n, traer: false \} : n\)\), \[\]\);/);
  assert.equal((B.match(/onAtras=\{volverAlAlta\}/g) ?? []).length, 2, '«Atrás» de las dos vistas vuelve por el mismo camino');
});

test('«Importar» desde el alta se abre encima y al cerrarlo el alta sigue; al terminar se cierran los dos', () => {
  assert.match(B, /onImportar: \(\) => setImportar\(true\),/, '«Importar» volvió a cerrar el alta');
  assert.doesNotMatch(B, /setNuevoLead\(null\); setImportar\(true\)/);
  assert.match(B, /onClose=\{cerrarImportar\}/);
  assert.match(B, /onListo=\{\(resumen\) => \{ setImportar\(false\); setNuevoLead\(null\);/);
});

// PROBADO ROMPIÉNDOLO (25/10/2026), contra una base de 3 / 0, de a una y restaurando de una copia:
//   · «Traer» con `onCerrar={cerrarAlta}` (clic afuera cierra todo)                       → 2 / 1
//   · «Importar» volviendo a `setNuevoLead(null); setImportar(true)`                      → 2 / 1
