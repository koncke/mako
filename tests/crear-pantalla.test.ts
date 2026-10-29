// =============================================================================
// UN solo diseño para las tabs de Create (29/10/2026): las reglas de la pantalla y lo que nav.ts no puede volver a tener
// =============================================================================
// Martín, 29/10/2026: «para todas las secciones de "create" no quiero otras tabs… En todas las tabs el mismo diseño de la
// barra lateral del chat de MaKo SIEMPRE abierto a la izquierda… En "nueva"… TEMPLATES con la sección de ¿Qué vas a crear
// hoy?». La pieza es app/_crear/PantallaCrear.tsx; esto fija:
//   1. las reglas puras (buscar, qué ocupa el centro, el marco de una plantilla, «hace cuánto»);
//   2. que un ítem de Create no vuelve a tener `secciones` (las pestañas de arriba), salvo los que FALTAN, cada uno con el
//      chat que lo hace: cada migración achica la lista (uno que ya no tiene y sigue anotado falla, para que se lo saque);
//   3. que los ítems de Video e Image siguen con la key que miran las capas y la API ('video-editor', 'image-editor');
//   4. que las páginas de Create montan la pantalla (con la misma lista de las que faltan).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { centroDe, haceCuanto, marcoDe, normalizar, proporcion, proyectosVisibles } from '@/app/_crear/reglas';
import { FAMILIAS } from '@/app/_components/nav';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

const PROYECTOS = [
  { id: '1', nombre: 'Reel de lanzamiento' },
  { id: '2', nombre: 'Anuncio café' },
  { id: '3', nombre: '' },
];

test('buscar: sin tildes ni mayúsculas, y en el orden en que vinieron', () => {
  assert.equal(normalizar('  Reél DE Lanzamiento '), 'reel de lanzamiento');
  assert.deepEqual(proyectosVisibles(PROYECTOS, '').map((p) => p.id), ['1', '2', '3']);
  assert.deepEqual(proyectosVisibles(PROYECTOS, 'CAFÉ').map((p) => p.id), ['2']);
  // Uno sin nombre se busca por lo que se ve: «Sin título».
  assert.deepEqual(proyectosVisibles(PROYECTOS, 'sin tit').map((p) => p.id), ['3']);
  assert.deepEqual(proyectosVisibles(PROYECTOS, 'nada que ver'), []);
});

test('el centro: sin pieza abierta es «¿Qué vas a crear hoy?»; con pieza, «Nuevo …» lo trae encima', () => {
  assert.equal(centroDe(false, false), 'nueva');
  assert.equal(centroDe(false, true), 'nueva');
  assert.equal(centroDe(true, false), 'pieza');
  assert.equal(centroDe(true, true), 'nueva');
});

test('el marco de una plantilla sin imagen: lo ancho se mide por el ancho y lo alto por el alto', () => {
  assert.equal(proporcion('9 / 16'), 9 / 16);
  assert.equal(proporcion('1080/1350'), 1080 / 1350);
  assert.equal(proporcion('roto'), 1);
  assert.equal(proporcion(undefined), 1);
  assert.equal(proporcion('0 / 5'), 1);
  assert.deepEqual(marcoDe('16 / 9'), { width: '72%', aspectRatio: String(16 / 9), maxWidth: 'none' });
  assert.deepEqual(marcoDe('9 / 16'), { height: '72%', aspectRatio: String(9 / 16), maxWidth: 'none' });
  assert.ok('height' in marcoDe('1 / 1'), 'un cuadrado es más alto que 4:3: va por el alto');
});

test('«hace cuánto»', () => {
  const ahora = Date.UTC(2026, 9, 29, 12, 0, 0);
  assert.equal(haceCuanto(null, ahora), '');
  assert.equal(haceCuanto(ahora - 20_000, ahora), 'recién');
  assert.equal(haceCuanto(ahora - 5 * 60_000, ahora), 'hace 5 min');
  assert.equal(haceCuanto(ahora - 3 * 3_600_000, ahora), 'hace 3 h');
  assert.equal(haceCuanto(ahora - 2 * 86_400_000, ahora), 'hace 2 d');
});

/** Los ítems de Create que TODAVÍA tienen pestañas arriba, con el chat que las saca. Sólo se achica. */
const FALTAN_SIN_SECCIONES: Readonly<Record<string, string>> = {
  'ai-avatar': 'chat «AI Avatar = Higgsfield»',
};

const create = FAMILIAS.find((f) => f.key === 'create');

test('Create: ningún ítem con pestañas arriba (`secciones`), salvo los anotados con su chat', () => {
  assert.ok(create, 'la familia Create existe');
  const items = [...create.bloques.flat(), ...(create.grupos ?? []).flatMap((g) => g.items)];
  for (const it of items) {
    const pendiente = FALTAN_SIN_SECCIONES[it.key];
    if (pendiente) {
      assert.ok(it.secciones?.length, `«${it.label}» ya no tiene secciones: sacalo de FALTAN_SIN_SECCIONES (lo hacía el ${pendiente})`);
      continue;
    }
    assert.equal(it.secciones, undefined, `«${it.label}» volvió a tener pestañas arriba: cada tab de Create es UNA pantalla (app/_crear/PantallaCrear.tsx)`);
  }
});

test('Create: Video e Image llevan la key que miran las capas y la API', () => {
  assert.ok(create);
  const items = create.bloques.flat();
  const video = items.find((it) => it.label === 'Video');
  const image = items.find((it) => it.label === 'Image');
  assert.equal(video?.key, 'video-editor');
  assert.equal(image?.key, 'image-editor');
  assert.equal(video?.href, '/video-editor');
  assert.equal(image?.href, '/image-editor');
  // Ni Reels ni Carousels, ni las «pronto» de Image, como ítem de Create.
  const keys = new Set(items.flatMap((it) => [it.key, ...(it.secciones ?? []).map((s) => s.key)]));
  for (const ida of ['reels', 'carousels', 'image-generator', 'thumbnails']) assert.ok(!keys.has(ida), `«${ida}» se deprecó (29/10/2026)`);
});

/** Las páginas de Create y si ya montan la pantalla. Las que faltan, con su chat. Sólo se achica. */
const PAGINAS_CREATE: Readonly<Record<string, string | null>> = {
  'app/video-editor/VideoEditorCliente.tsx': null,
  'app/image-editor/ImageEditorCliente.tsx': 'chat «Create: un solo diseño» (create-shell-2910)',
  'app/ai-avatar/AiAvatarCliente.tsx': 'chat «AI Avatar = Higgsfield»',
};

test('Create: cada página monta PantallaCrear (salvo las anotadas con su chat)', () => {
  for (const [ruta, pendiente] of Object.entries(PAGINAS_CREATE)) {
    if (!existsSync(join(RAIZ, ruta))) continue;
    const usa = /from '@\/app\/_crear\/PantallaCrear'/.test(leer(ruta));
    if (pendiente) assert.ok(!usa, `${ruta} ya monta PantallaCrear: sacala de la lista (lo hacía el ${pendiente})`);
    else assert.ok(usa, `${ruta} no monta PantallaCrear: el chat de MaKo a la izquierda y «Nuevo …» con plantillas`);
  }
});
