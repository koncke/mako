// =============================================================================
// MaKo toma la iniciativa en el Web Generator: la página sin publicar (5/11/2026, T13 de docs/mako-iniciativa/plan.md)
// =============================================================================
// Martín (29/10/2026): «que MaKo te vaya guiando… dependiendo del template que se eligió, o de la situación de la persona». Lo
// que se fija:
//   1. la apertura (lib/aperturas/web.ts): con la página sin publicar y la charla vacía pregunta un HECHO, «¿Ya está lista para
//      que la vean?», por página (alcance `entidad`); publicada o con charla, calla;
//   2. el montaje: «Sí, ya está» abre el diálogo de «Publicar» (que mira la dirección, el tope del plan y el cobro: publicar por
//      fuera se los saltearía); la pieza entra con `next/dynamic` desde ./ChatAgente.tsx (AperturaMako trae el CSS del hilo) y
//      mientras habla el saludo y las sugerencias se esconden.
//
// Correr: node --import tsx --test tests/iniciativa-web.test.ts
// PROBADO ROMPIÉNDOLO (base 2/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ID_LISTA, aperturaWeb } from '../lib/aperturas/web';
import { PREGUNTA_DE_ACCION, claveApertura, claveValida, problemasDeApertura } from '../lib/aperturas/reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la apertura: sin publicar y sin charla pregunta un hecho, por página; publicada o con charla, calla', () => {
  const h = { pagina: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', publicada: false, charlaVacia: true };
  const a = aperturaWeb(h, {})!;
  assert.equal(a.id, ID_LISTA);
  assert.equal(a.texto, '¿Ya está lista para que la vean?');
  assert.doesNotMatch(a.texto, PREGUNTA_DE_ACCION);
  assert.deepEqual(problemasDeApertura(a, { primerPaso: true }), []);
  assert.equal(a.alcance, 'entidad');
  assert.ok(claveValida(claveApertura(a.id, a.entidad)));
  assert.deepEqual(a.botones[0], { tipo: 'hacer', rotulo: 'Sí, ya está', accion: 'publicar' });
  assert.equal(aperturaWeb({ ...h, publicada: true }, {}), null, 'ya publicada');
  assert.equal(aperturaWeb({ ...h, charlaVacia: false }, {}), null, 'con la charla empezada');
});

test('2. el montaje: «Sí» abre el diálogo de Publicar, la pieza entra con next/dynamic y el saludo se esconde mientras habla', () => {
  const panel = sinComentarios(leer('app/web-generator/editor/paneles/PanelAgente.tsx'));
  assert.match(panel, /onPublicar=\{\(\) => ctx\.setDialogo\('publicar'\)\}/, 'el diálogo de siempre, no un publicar por fuera');
  assert.match(panel, /hechos=\{\{ pagina: docId != null \? String\(docId\) : null, publicada: ctx\.urlPublica != null, charlaVacia: true \}\}/);
  assert.match(panel, /const AperturaAgente = dynamic\(\(\) => import\('\.\/ChatAgente'\)\.then\(\(m\) => m\.AperturaAgente\)\);/,
    'con next/dynamic: AperturaMako trae el CSS del hilo y tumbaría los tests que cargan el panel');
  assert.doesNotMatch(panel, /from '@\/app\/_chat\/AperturaMako'/);
  assert.match(panel, /\{hilo\.mensajes\.length === 0 && !aperturaHabla && \(\n\s*<>\n\s*<div className="gma-ag-burbuja" data-de="mako">/,
    'el saludo y sus sugerencias, sólo sin la apertura');
  const chat = sinComentarios(leer('app/web-generator/editor/paneles/ChatAgente.tsx'));
  assert.match(chat, /useEffect\(\(\) => \{ onHabla\(habla\); return \(\) => onHabla\(false\); \}, \[habla, onHabla\]\);/, 'al irse, el saludo vuelve');
  assert.match(chat, /acciones=\{\{ publicar: onPublicar \}\}/);
});

// PROBADO ROMPIÉNDOLO (5/11/2026, base 2/0):
//   · la apertura también con la página publicada                      → 1/1 (1)
//   · el saludo sigue a la vista con la apertura (sin `!aperturaHabla`) → 1/1 (2)
