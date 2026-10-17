// =============================================================================
// La ficha por bloques de ESCRITORIO en todas las pantallas: el corte de columnas y lo táctil
// =============================================================================
// Martín (14/10/2026, desde un iPad): «La app de MaKo se debe adaptar al tamaño de la pantalla siempre», y
// «diseñar todo pensado para ambos dispositivos». La ficha de escritorio (el pop-up del tablero y /crm/[id])
// a 1024×768 y 820×1180 (el iPad recibe la computadora adaptada) y a 390: la grilla de 12 cae a menos
// columnas donde no entra, y la vista por dispositivo de «Personalizar» muestra lo mismo. El corte es puro
// (app/crm/lead-view/ficha/armar.ts) y se EJECUTA; la hoja de estilos se lee (ficha-css.ts).
//
// Correr: node --import tsx --test tests/ficha-pantallas.test.ts
//
// ⚠️ VERIFICADO ROMPIÉNDOLO (15/10/2026, base 6/0), cada rotura restaurada de memoria antes de la siguiente:
//   · `anchoEnDispositivo` dejando el ¼ en la tablet (sin pasar a ½)                                → 5 / 1
//   · `spansPorDispositivo` repartiendo la tablet con los anchos de escritorio                       → 5 / 1
//   · el @media de la tablet a 900 px (no cubre un iPad acostado de 1024)                           → 4 / 2
//   · la vista «Tablet» de «Personalizar» sin su regla (muestra los anchos de escritorio)            → 5 / 1
//   · el ancho del bloque de vuelta en `gridColumn` en línea (le gana a todo @media)                 → 5 / 1
//   · «Personalizar» visible en una pantalla de celular                                              → 5 / 1
//   · sin campos de 16 px en una pantalla táctil                                                      → 5 / 1
//   · las pestañas sin `--touch`                                                                       → 5 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BloquePuesto } from '../lib/ficha/config';
import {
  CORTE_MOVIL, CORTE_TABLETA, anchoEnDispositivo, bloquesDeLaGrilla, compartiendoFila, spansPorDispositivo,
} from '../app/crm/lead-view/ficha/armar';
import { reglasDe } from '../app/crm/lead-view/ficha/reglas';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');
const css = sinComentarios(leer('app/crm/lead-view/ficha/ficha-css.ts'));
/** Las declaraciones de una regla, tal cual (el texto entre las llaves). */
const regla = (texto: string, selector: string): string | undefined => {
  const i = texto.indexOf(`${selector} {`);
  return i < 0 ? undefined : texto.slice(i + selector.length + 2, texto.indexOf('}', i)).trim();
};
/** Los cuerpos de TODOS los @media con esa condición, juntos (cada uno hasta la llave que lo cierra). */
const media = (texto: string, cond: string): string | undefined => {
  const cuerpos: string[] = [];
  for (let i = texto.indexOf(`@media ${cond} {`); i >= 0; i = texto.indexOf(`@media ${cond} {`, i + 1)) {
    const abre = texto.indexOf('{', i);
    let prof = 0;
    for (let k = abre; k < texto.length; k++) {
      if (texto[k] === '{') prof++;
      else if (texto[k] === '}' && --prof === 0) { cuerpos.push(texto.slice(abre + 1, k)); break; }
    }
  }
  return cuerpos.length ? cuerpos.join('\n') : undefined;
};

test('el corte de columnas: en la tablet ¼ y ⅓ pasan a ½, en el celular uno abajo del otro', () => {
  for (const a of [3, 4, 6, 12]) assert.equal(anchoEnDispositivo(a, 'escritorio'), a, 'en escritorio, el ancho que eligió el admin');
  assert.deepEqual([3, 4, 6, 12].map((a) => anchoEnDispositivo(a, 'tableta')), [6, 6, 6, 12]);
  assert.deepEqual([3, 4, 6, 12].map((a) => anchoEnDispositivo(a, 'movil')), [12, 12, 12, 12]);

  // Cuatro de ¼: una fila en escritorio, dos en la tablet, cuatro en el celular.
  assert.deepEqual(spansPorDispositivo([3, 3, 3, 3]), { escritorio: [3, 3, 3, 3], tableta: [6, 6, 6, 6], movil: [12, 12, 12, 12] });
  // La fila de la tablet se reparte con los anchos de la tablet: tres de ⅓ son dos filas, y la que queda sola se estira.
  assert.deepEqual(spansPorDispositivo([4, 4, 4]).tableta, [6, 6, 12]);
  assert.deepEqual(spansPorDispositivo([3, 6, 3]), { escritorio: [3, 6, 3], tableta: [6, 6, 12], movil: [12, 12, 12] });
  // Lo que ya era de una fila entera (la plantilla de respaldo, la ficha de antes) queda igual en todas.
  assert.deepEqual(spansPorDispositivo([12, 4, 12]).tableta, [12, 12, 12]);

  // El armador le da a cada bloque los dos anchos ya repartidos.
  const lista: BloquePuesto[] = [
    { id: 'calificacion', ancho: 3, diseno: 'botones' }, { id: 'plazo-nutricion', ancho: 3, diseno: 'fecha' },
    { id: 'origen', ancho: 6, diseno: 'linea' },
  ];
  const b = bloquesDeLaGrilla(lista, { reglasDe, vacio: () => false, editando: false, verPrivado: true });
  assert.deepEqual(b.map((x) => [x.span, x.spanTableta]), [[3, 6], [3, 6], [6, 12]]);
  assert.equal(compartiendoFila(b[0], 'escritorio'), true);
  assert.equal(compartiendoFila(b[2], 'tableta'), false, 'en la tablet el origen quedó solo en su fila: la raya de soltar va arriba');
  assert.equal(compartiendoFila(b[0], 'movil'), false);
});

test('la hoja corta por el ancho de la VENTANA (la tablet y el celular de verdad), con los cortes del armador', () => {
  assert.equal(CORTE_TABLETA, 1024, 'un iPad acostado mide 1024: tiene que caer en la tablet');
  assert.equal(regla(css, '.fb-bloque')?.includes('grid-column: span var(--fb-span, 12);'), true, 'en escritorio, el ancho de escritorio');
  assert.equal(regla(media(css, `(max-width: ${CORTE_TABLETA}px)`) ?? '', '.fb-bloque'), 'grid-column: span var(--fb-span-t, 12);');
  assert.equal(regla(media(css, `(max-width: ${CORTE_MOVIL}px)`) ?? '', '.fb-bloque'), 'grid-column: 1 / -1;');
  // ⚠️ El ancho NO va en un style en línea: le ganaría a todo @media y la tablet no cortaría nunca.
  const armador = sinComentarios(leer('app/crm/lead-view/ficha/Armador.tsx'));
  assert.doesNotMatch(armador, /gridColumn/);
  assert.match(armador, /style=\{\{ '--fb-span': b\.span, '--fb-span-t': b\.spanTableta \} as CSSProperties\}/);
});

test('la vista por dispositivo de «Personalizar» corta IGUAL que la tablet y el celular de verdad', () => {
  // Se angosta la ficha y no la ventana: los @media no disparan, así que cada corte va también por `data-dispositivo`.
  assert.equal(regla(css, '.fb-pagina[data-dispositivo="tableta"] .fb-bloque'), regla(media(css, `(max-width: ${CORTE_TABLETA}px)`) ?? '', '.fb-bloque'));
  assert.equal(regla(css, '.fb-pagina[data-dispositivo="movil"] .fb-bloque'), regla(media(css, `(max-width: ${CORTE_MOVIL}px)`) ?? '', '.fb-bloque'));
  const ficha = sinComentarios(leer('app/crm/lead-view/ficha/FichaPorBloques.tsx'));
  assert.match(ficha, /dispositivo=\{dispositivo\} \/>/, 'el armador sabe con qué dispositivo se mira (la raya de soltar)');
});

test('«Personalizar» no va en una pantalla de celular (como en HubSpot); si ya se está, «Ver» sigue a mano', () => {
  const movil = media(css, `(max-width: ${CORTE_MOVIL}px)`) ?? '';
  assert.match(movil, /\.fb-personalizar:not\(\[aria-pressed="true"\]\) \{ display: none; \}/);
});

test('en una pantalla TÁCTIL (un iPad): 44 px de toque y campos de 16 px, por capacidad y no por ancho', () => {
  const tactil = media(css, '(pointer: coarse)') ?? '';
  assert.ok(tactil, 'la ficha no tiene reglas para una pantalla táctil');
  assert.match(regla(tactil, '.fb-personalizar') ?? '', /min-height: var\(--touch\)/);
  assert.match(regla(tactil, '.fb-herr, .fb-barra .fb-herr') ?? '', /height: var\(--touch\)/);
  assert.match(regla(tactil, '.fb-opcion') ?? '', /min-height: var\(--touch\)/);
  assert.match(regla(tactil, '.fb input, .fb textarea, .fb select, .fb-flotante input') ?? '', /font-size: 16px !important/, 'iOS hace zoom al enfocar un campo de menos de 16 px');
  // Las pestañas y la cabecera son de las dos puertas: también van a 44 en una pantalla táctil.
  assert.match(sinComentarios(leer('app/crm/lead-view/LeadTabs.tsx')), /minHeight: 'var\(--touch\)'/);
  assert.match(leer('app/crm/lead-view/CabeceraLead.tsx'), /@media \(pointer: coarse\)\{\s*\.cl-cab \.cl-acc button\{ min-height:var\(--touch\); \}/);
});

// ⚠️ REESCRITO EL 17/10/2026: ya no hay fila de pestañas (las hojas van en el desplegable del título, como el
//    Dashboard). Lo que se fija es lo mismo: el nombre de la hoja baja de renglón y nada scrollea de costado.
test('el título de la hoja no se corta: baja de renglón, nunca scrollea de costado', () => {
  const tabs = sinComentarios(leer('app/crm/lead-view/LeadTabs.tsx'));
  assert.match(tabs, /\.lt-tit \{[^}]*overflow-wrap: anywhere;/);
  assert.match(tabs, /\.lt-hoja-nombre \{[^}]*text-overflow: ellipsis;/, 'en el desplegable, un nombre largo se corta con «…»');
  assert.doesNotMatch(tabs, /overflowX|overflow-x/);
});
