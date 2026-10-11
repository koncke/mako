// =============================================================================
// Lo que encontró la verificación en el navegador del 11/10/2026 (docs/hallazgos-editor-landing.md,
// «La verificación en el navegador»). Cada test fija UNA de las fallas, y el renglón de abajo dice
// qué pasó al romper el arreglo a propósito.
//
// Rotura (contra la base en verde, 5/5), cada una por separado: 4 pases y 1 fallo.
//   · sacar `sinInteractivos` de htmlDeNodo (render.ts) ............ cae «la miniatura…»
//   · sacar el `--gm-cebra` de varsDeFondoPropio (temas.ts) ......... cae «…la cebra»
//   · sacar el `list-style: disc` de css.ts ......................... cae «las listas…»
//   · sacar `View: null` del configure de TablaLanding (nodos.ts) .... cae «la tabla…»
//   · `consultasRelajadas` devolviendo sólo `[t]` .................. cae «las fotos…»
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { htmlDeTarjeta } from '../lib/editor-landing/render';
import { temaPorId, varsDeFondoPropio } from '../lib/editor-landing/temas';
import { CSS_CONTENIDO } from '../lib/editor-landing/css';
import { NODO, parrafo, tarjeta, titulo, type JsonNodo } from '../lib/editor-landing/doc';
import { consultasRelajadas } from '../lib/imagenes-consulta';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(resolve(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

/** Una sección con lo que hacía que el Panel no hidratara: un Botón (un `<a>`), un enlace y un formulario. */
function seccionInteractiva(): JsonNodo {
  const boton: JsonNodo = { type: NODO.boton, attrs: { href: 'https://ejemplo.com', variante: 'primario', nuevaPestana: false }, content: [{ type: 'text', text: 'Agendar' }] };
  const botones: JsonNodo = { type: NODO.botones, attrs: { alinea: 'izquierda' }, content: [boton] };
  const conEnlace: JsonNodo = { type: 'paragraph', content: [{ type: 'text', text: 'ver más', marks: [{ type: 'link', attrs: { href: 'https://ejemplo.com/mas' } }] }] };
  const formulario: JsonNodo = { type: NODO.formulario, attrs: {} };
  return tarjeta([titulo('Hola', 1), parrafo('texto'), conEnlace, botones, formulario], { id: 'tprueba' });
}

test('la miniatura no trae <a>, <form> ni <button>: adentro del <a> de la tarjeta del Panel el parser la parte y la hidratación falla', () => {
  const tema = temaPorId('pewter');
  const mini = htmlDeTarjeta(seccionInteractiva(), tema, { modo: 'miniatura', incluirOcultas: true });
  assert.ok(mini.includes('Agendar'), 'el botón se sigue dibujando');
  assert.doesNotMatch(mini, /<a[\s>]/, 'ningún <a> en la miniatura');
  assert.doesNotMatch(mini, /<form[\s>]/, 'ningún <form> en la miniatura');
  assert.doesNotMatch(mini, /<button[\s>]/, 'ningún <button> en la miniatura');
  assert.doesNotMatch(mini, /\shref=/, 'sin href');
  assert.match(mini, /data-gm-a=""/, 'el enlace conserva su aspecto por data-gm-a');
  // Y la página pública NO cambia: ahí los enlaces y el formulario tienen que andar.
  const pub = htmlDeTarjeta(seccionInteractiva(), tema, { modo: 'publico' });
  assert.match(pub, /<a[\s>]/);
  assert.match(pub, /<form[\s>]/);
  assert.match(CSS_CONTENIDO, /\.gm-doc \[data-gm-a\]/, 'la hoja le da a data-gm-a el aspecto del enlace');
});

test('una sección con fondo propio OSCURO redefine la cebra: si no, las filas pares de una tabla quedaban casi blancas con texto claro', () => {
  const v = varsDeFondoPropio(temaPorId('pewter'), '#292a2e');
  assert.ok(v['--gm-cebra'], 'define --gm-cebra');
  const hex = v['--gm-cebra'].replace('#', '');
  const lum = (parseInt(hex.slice(0, 2), 16) + parseInt(hex.slice(2, 4), 16) + parseInt(hex.slice(4, 6), 16)) / 3;
  assert.ok(lum < 90, `la cebra sobre #292a2e es oscura (promedio ${lum.toFixed(0)})`);
});

test('las listas DECLARAN su viñeta: el preflight de Tailwind las deja sin marca adentro de la app', () => {
  assert.match(CSS_CONTENIDO, /\.gm-doc ul \{ list-style: disc; \}/);
  assert.match(CSS_CONTENIDO, /\.gm-doc ol \{ list-style: decimal; \}/);
  // La lista de tareas sigue sin viñeta (selector más específico).
  assert.match(CSS_CONTENIDO, /\.gm-doc ul\[data-type="taskList"\] \{ list-style: none;/);
});

test('la tabla del editor usa el renderHTML de la landing (View: null): con la TableView de TipTap no tenía la clase .gm-tabla ni bordes', () => {
  const src = leer('app/landing-generator/editor/extensiones/nodos.ts');
  const bloque = src.slice(src.indexOf('export const TablaLanding'), src.indexOf('/** Todos los nodos propios'));
  assert.match(bloque, /\.configure\(\{[^}]*\bView: null\b[^}]*\}\)/);
});

test('las fotos: si la frase entera no trae nada, se prueba sin palabras vacías y después más corto', () => {
  const qs = consultasRelajadas('Book your free call');
  assert.equal(qs[0], 'Book your free call', 'primero la frase tal cual');
  assert.ok(qs.includes('Book free call'), 'sin «your»');
  assert.ok(qs.includes('free call'), 'las dos últimas de contenido');
  assert.equal(new Set(qs).size, qs.length, 'sin repetidas');
  assert.deepEqual(consultasRelajadas('office'), ['office'], 'una palabra: una consulta');
  assert.deepEqual(consultasRelajadas('   '), []);
});
