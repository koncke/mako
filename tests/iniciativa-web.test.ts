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
  const h = { pagina: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', publicada: false, charlaVacia: true, aCompletar: 0 };
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
  // Prueba en producción del 10/11/2026: recién creada desde una plantilla, con sus «[…]» sin completar, ya preguntaba.
  assert.equal(aperturaWeb({ ...h, aCompletar: 30 }, {}), null, 'con textos por completar');
  assert.equal(aperturaWeb({ ...h, aCompletar: 1 }, {}), null, 'con UNO solo por completar');
});

test('1b. los hechos que arma el panel: los «[…]» del editor, y despublicada en esta visita no vuelve a preguntar', () => {
  const panel = sinComentarios(leer('app/web-generator/editor/paneles/PanelAgente.tsx'));
  assert.match(panel, /hechos=\{\{ pagina, publicada, charlaVacia: true, aCompletar: aCompletar \?\? 1 \}\}/,
    'sin medir todavía no pregunta (si no, asomaba un instante al abrir)');
  assert.match(panel, /const \[n, setN\] = useState<number \| null>\(null\);/);
  assert.match(panel, /const aCompletar = useACompletar\(editor, hilo\.mensajes\.length === 0\);/, 'medido sólo mientras la apertura puede hablar');
  assert.match(panel, /setN\(rangosACompletar\(d\.textBetween\(0, d\.content\.size, '\\n', '\\n'\)\)\.length\);/,
    'la misma regla de los «[…]» que marca el editor (especificacion.ts), con los bloques separados');
  assert.match(panel, /editor\.on\('update', alCambiar\);/, 'se vuelve a medir al escribir');
  assert.match(panel, /const publicada = ctx\.urlPublica != null \|\| \(pagina != null && vistaPublicada === pagina\);/,
    'anular la publicación no la vuelve «lista para que la vean»');
});

test('2. el montaje: «Sí» abre el diálogo de Publicar, la pieza entra con next/dynamic y el saludo se esconde mientras habla', () => {
  const panel = sinComentarios(leer('app/web-generator/editor/paneles/PanelAgente.tsx'));
  assert.match(panel, /onPublicar=\{\(\) => ctx\.setDialogo\('publicar'\)\}/, 'el diálogo de siempre, no un publicar por fuera');
  assert.match(panel, /const AperturaAgente = dynamic\(\(\) => import\('\.\/ChatAgente'\)\.then\(\(m\) => m\.AperturaAgente\)\);/,
    'con next/dynamic: AperturaMako trae el CSS del hilo y tumbaría los tests que cargan el panel');
  assert.doesNotMatch(panel, /from '@\/app\/_chat\/AperturaMako'/);
  // (12/11/2026: sin la burbuja «Pídeme que edite…» que iba primero: fuera los textos que explican. Quedan las sugerencias.)
  assert.match(panel, /\{hilo\.mensajes\.length === 0 && !aperturaHabla && \(\r?\n\s*<>\r?\n(?:\s*\{\s*\}\r?\n)?\s*<div className="gma-ag-pildoras">/,
    'las sugerencias, sólo sin la apertura');
  assert.doesNotMatch(panel, /Pídeme que edite, cree o diseñe/);
  const chat = sinComentarios(leer('app/web-generator/editor/paneles/ChatAgente.tsx'));
  assert.match(chat, /useEffect\(\(\) => \{ onHabla\(habla\); return \(\) => onHabla\(false\); \}, \[habla, onHabla\]\);/, 'al irse, el saludo vuelve');
  assert.match(chat, /acciones=\{\{ publicar: onPublicar \}\}/);
});

// PROBADO ROMPIÉNDOLO (5/11/2026, base 2/0):
//   · la apertura también con la página publicada                      → 1/1 (1)
//   · el saludo sigue a la vista con la apertura (sin `!aperturaHabla`) → 1/1 (2)
// Y el 10/11/2026 (base 3/0, restaurado y verificado por hash):
//   · la apertura ignorando `aCompletar`                                → 2/1 (1)
//   · `publicada` sin la despublicada en esta visita                    → 2/1 (1b)
//   · sin volver a medir los «[…]» al escribir (`editor.on('update')`)  → 2/1 (1b)
//   · sin medir todavía contando como 0 (`aCompletar ?? 0`)            → 2/1 (1b)
