// =============================================================================
// Los chats del Image Editor y del Video Editor en el Ops Center (22/10/2026, OC8)
// =============================================================================
// Cada editor guarda su chat con MaKo en su tabla (image_editor_chats, mig 0303; video_editor_chats, mig 0298), uno por persona y
// por diseño o proyecto, y el índice no los leía. TB2 midió que sí guardan (hasta ese día nadie los había usado).
//   1. en la lista: «Image Editor › <diseño>» y «Video Editor › <proyecto>», agrupados, cada uno con su clave (persona|id);
//   2. por PERSONA: el admin ve los del negocio, los demás sólo los suyos; con la puerta de cada tab (`image-editor`, `video-editor`);
//   3. se LEEN acá y se siguen en el editor; lo que se escribe no sale;
//   4. y el origen de lo que midió TB1: `landing:` es del Web Generator, y la clave de otra persona se reconoce igual;
//   5. el de OTRA persona del equipo (el admin los ve) se lee acá sin «Seguir en el editor»: el editor abre el hilo de la
//      persona de la sesión, y el link llevaba a otro (la revisión de Integración).
//
// Correr: node --import tsx --test tests/ops-center-editores.test.ts
// PROBADO ROMPIÉNDOLO (base 5/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AVISO_EDITOR, AVISO_EDITOR_AJENO, EDITORES, claveDeEditor, listaDelCliente, mensajesDeEditor, origenDeClave, partesDeClaveDeEditor } from '../lib/chat-mako-reglas';
import { partesDelNombre, porJefe } from '../lib/centro-chats';
import { puedeVerKey } from '../lib/movil-rutas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// Lo que dejó TB2 en el ws3 (persona u1): un diseño y el proyecto de video «1022».
const DISENO = '75e60d6f-fa28-4fb0-890e-7d049472617b';
const PROYECTO = '99ea7dc3-466b-41d4-b624-73561b291c44';

test('1. en la lista, «Image Editor › …» y «Video Editor › …», agrupados, con su clave de persona y diseño', () => {
  const lista = listaDelCliente({
    sesiones: [], offer: [], antes: [], busca: '',
    editores: [
      { tipo: 'imagen', clave: claveDeEditor('u1', DISENO), titulo: 'Portada del Sprint', updatedAt: '2026-10-22T15:00:00Z', propio: true },
      { tipo: 'video', clave: claveDeEditor('u1', PROYECTO), titulo: '1022', updatedAt: '2026-10-22T14:00:00Z', propio: true },
      { tipo: 'imagen', clave: claveDeEditor('u1', 'otro-diseno'), titulo: null, updatedAt: '2026-10-21T10:00:00Z', propio: true },
    ],
  });
  const filas = lista.slice(1);
  assert.deepEqual(filas.map((f) => f.titulo), ['Image Editor › Portada del Sprint', 'Video Editor › 1022', 'Image Editor › Sin nombre']);
  assert.deepEqual(filas[0].elegido, { editor: 'imagen', clave: `u1|${DISENO}` });
  assert.equal(filas[0].origen, 'editor');
  assert.deepEqual(porJefe(filas).map((g) => [g.jefe, g.subs.map((f) => partesDelNombre(f.titulo).sub)]), [
    ['Image Editor', ['Portada del Sprint', 'Sin nombre']], ['Video Editor', ['1022']],
  ]);
  assert.deepEqual(partesDeClaveDeEditor(`u1|${DISENO}`), { persona: 'u1', id: DISENO });
  assert.deepEqual(partesDeClaveDeEditor('ana@x.com|abc'), { persona: 'ana@x.com', id: 'abc' }, 'una persona por email');
  assert.equal(partesDeClaveDeEditor('u1|../otro'), null, 'un id raro no abre nada');
  assert.equal(EDITORES.imagen.ruta(DISENO), `/image-editor/${DISENO}`);
  assert.equal(EDITORES.video.ruta(PROYECTO), `/video-editor/${PROYECTO}`);
  assert.deepEqual(mensajesDeEditor([
    { de: 'yo', texto: 'sacale el fondo', c: Date.parse('2026-10-22T15:00:00Z') },
    { de: 'mako', texto: '  ', c: 1 },
    { de: 'mako', texto: 'Listo, sin fondo.', c: Date.parse('2026-10-22T15:00:09Z') },
  ]), [
    { role: 'user', content: 'sacale el fondo', created_at: '2026-10-22T15:00:00.000Z' },
    { role: 'assistant', content: 'Listo, sin fondo.', created_at: '2026-10-22T15:00:09.000Z' },
  ]);
});

test('2. por persona y con la puerta de cada tab: el admin ve los del negocio; los demás, los suyos', () => {
  assert.equal(puedeVerKey('image-editor', 'admin', null), true);
  assert.equal(puedeVerKey('video-editor', 'admin', null), true);
  const indice = sinComentarios(leer('lib/chat-mako-indice.ts'));
  assert.match(indice, /\{ origen: 'image-editor', alcance: 'persona', tab: 'image-editor' \}/);
  assert.match(indice, /\{ origen: 'video-editor', alcance: 'persona', tab: 'video-editor' \}/);
  assert.match(indice, /if \(!q\.admin\) consulta = consulta\.eq\('persona', q\.persona\);/, 'la lista: los suyos');
  assert.match(indice, /if \(!q\.admin && partes\.persona !== q\.persona\) return null;/, 'el hilo: uno de otro no se abre');
  assert.match(indice, /const ws = await wsSiVe\(t\.tab\);/);
  assert.match(indice, /tipo === 'imagen' \? hiloImagenAlAbrir\(fila\.mensajes\) : hiloVideoAlAbrir\(fila\.mensajes\)/, 'con el saneo de cada editor');
});

test('3. se leen acá y se siguen en el editor; lo que se escribe no sale', () => {
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(motor, /if \(esAutomatizacion \|\| esEditor \|\| \(!t && !archivos\.length\)/);
  assert.match(motor, /const hrefEditor = deEditor && idDelEditor && editorPropio \? conWs\(EDITORES\[deEditor\.editor\]\.ruta\(idDelEditor\), ws\) : null;/);
  const piezas = sinComentarios(leer('app/second-brain/PiezasCliente.tsx'));
  assert.match(piezas, /if \(k\.esEditor\) \{\n\s*return k\.hrefEditor\n\s*\? <p className="co-solo-lectura" role="note">\{AVISO_EDITOR\} <a className="ch-enlace" href=\{k\.hrefEditor\}>Seguir en el editor<\/a><\/p>/);
  assert.match(AVISO_EDITOR, /se sigue ahí/);
  const ruta = sinComentarios(leer('app/api/mako/chat/route.ts'));
  assert.match(ruta, /return json\(\{ ok: true, editores: q \? await chatsDeLosEditores\(q\) : \[\] \}\);/);
  assert.match(ruta, /const hilo = q && tipo \? await hiloDeEditor\(q, tipo, String\(sp\.get\('editorClave'\)\)\) : null;/);
});

test('4. el origen de lo que midió TB1: `landing:` es del Web Generator, y la clave de otra persona se reconoce', () => {
  assert.equal(origenDeClave('landing:31'), 'Web Generator');
  assert.equal(origenDeClave('persona:u5:dashboard:gmvjxtei82ve3'), 'Dashboard');
  assert.equal(origenDeClave('persona:ana@x.com:landing:31'), 'Web Generator');
  assert.equal(origenDeClave('dashboard:gmvjxtei82ve3'), 'Dashboard', 'el de siempre, igual');
});

test('5. el de otra persona del equipo se lee acá, sin «Seguir en el editor» (abriría el de quien mira)', () => {
  const indice = sinComentarios(leer('lib/chat-mako-indice.ts'));
  assert.match(indice, /propio: persona === q\.persona \}\);/, 'cada fila dice si es de quien mira');
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(motor, /const editorPropio = !!deEditor && \(editores \?\? \[\]\)\.some\(\(e\) => e\.tipo === deEditor\.editor && e\.clave === deEditor\.clave && e\.propio\);/);
  const piezas = sinComentarios(leer('app/second-brain/PiezasCliente.tsx'));
  assert.match(piezas, /: <p className="co-solo-lectura" role="note">\{AVISO_EDITOR_AJENO\}<\/p>;/);
  assert.match(AVISO_EDITOR_AJENO, /de otra persona del equipo: se lee aquí/);
  assert.doesNotMatch(AVISO_EDITOR_AJENO, /se sigue/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 5/0):
//   · la lista sin los editores                  → 3/1 (1)
//   · un miembro ve los de otros                 → 3/1 (2)
//   · el hilo de otro se abre                    → 3/1 (2)
//   · enviar no frena un chat de editor          → 3/1 (3)
//   · `landing:` sin origen                      → 3/1 (4)
//   · la clave de otra persona sin reconocer     → 3/1 (4)
//   · «Seguir en el editor» en el de otra persona → 4/1 (5)
//   · la fila sin decir de quién es              → 4/1 (5)
