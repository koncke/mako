// =============================================================================
// El área `imagen` de la API de MaKo (el Image Editor, 15/10/2026)
// =============================================================================
// Lo que la API hace sin el motor de Doory, y que se rompería en silencio:
//   1. el documento en blanco tiene la forma del que arma el editor (`createBlankDocument`);
//   2. cambiar textos respeta las mayúsculas del motor (`textCase` + `caseSource`), entra en grupos y no
//      inventa: lo que no encuentra lo devuelve;
//   3. cada plantilla, cargada del lado del server, pasa la validación del guardado (si no, «crear desde una
//      plantilla» fallaría con 422 recién al confirmar);
//   4. las siete operaciones llevan el permiso de la tab (`image-editor`) y de admin, como toda tab.
//
// PROBADO ROMPIÉNDOLO (15/10/2026): sin `rolMinimo` en GATING de imagen.def.ts, el 4 falla (0/1); con
// `o.text = nuevo` en lugar del `caseSource` para las mayúsculas, el 2 falla (0/1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createBlankDocument } from '../app/image-editor/_doory/lib/document';
import { cambiarTextos, documentoEnBlanco, resumirDoc, srcsLocales, textosDe, TOPE_DOC_BYTES } from '../lib/image-editor/reglas';
import { DEFS } from '../lib/api-mako/areas/imagen.def';
import { catalogoPlantillas, documentoDePlantilla } from '../app/image-editor/mako/plantillas';

const RAIZ = join(import.meta.dirname, '..');

test('1: el documento en blanco tiene la forma del que arma el editor', () => {
  const nuestro = documentoEnBlanco(1080, 1350, 'p1') as { pages: { id: string }[] };
  const motor = createBlankDocument(1080, 1350) as unknown as { pages: { id: string }[]; meta?: unknown };
  const sinIds = (d: { pages: { id: string }[] }) => ({ ...d, pages: d.pages.map((p) => ({ ...p, id: 'x' })) });
  const { meta: _meta, ...motorSinMeta } = motor;
  assert.deepEqual(sinIds(nuestro), sinIds(motorSinMeta as { pages: { id: string }[] }));
  assert.deepEqual(resumirDoc(nuestro), { ancho: 1080, alto: 1350, paginas: 1 });
});

test('2: cambiar textos respeta las mayúsculas del motor, entra en grupos y dice lo que no encontró', () => {
  const doc = {
    pages: [
      { objects: [
        { type: 'textbox', text: 'Hola mundo' },
        { type: 'textbox', text: 'FIN DE TEMPORADA', textCase: 'upper', caseSource: 'Fin de temporada' },
        { type: 'group', objects: [{ type: 'textbox', text: 'Dentro del grupo' }] },
        { type: 'rect', text: 'no es texto' },
      ] },
    ],
  };
  const r = cambiarTextos(doc, [
    { actual: 'hola   MUNDO', nuevo: 'Chau' },
    { actual: 'Fin de temporada', nuevo: 'Liquidación' },
    { actual: 'Dentro del grupo', nuevo: 'Cambiado' },
    { actual: 'No existe', nuevo: 'x' },
  ]);
  assert.equal(r.cambiados, 3);
  assert.deepEqual(r.noEncontrados, ['No existe']);
  const objs = (r.doc as typeof doc).pages[0].objects as Record<string, unknown>[];
  assert.equal(objs[0].text, 'Chau');
  assert.equal(objs[1].caseSource, 'Liquidación');
  assert.equal(objs[1].text, 'LIQUIDACIÓN', 'el visible sale en mayúsculas, como lo haría el motor');
  assert.equal((objs[2].objects as Record<string, unknown>[])[0].text, 'Cambiado');
  assert.equal(objs[3].text, 'no es texto', 'un objeto que no es texto no se toca');
  assert.equal(doc.pages[0].objects[0].text, 'Hola mundo', 'el original no se modifica');
  assert.deepEqual(textosDe(r.doc), [{ pagina: 1, nombre: null, textos: ['Chau', 'LIQUIDACIÓN', 'Cambiado'] }]);
});

test('3: cada plantilla, cargada del lado del server, se puede guardar como diseño', async () => {
  const lista = catalogoPlantillas();
  assert.equal(lista.length, 10);
  for (const p of lista) {
    const doc = await documentoDePlantilla(p.slug);
    assert.ok(doc, `${p.slug}: no cargó`);
    const r = resumirDoc(doc);
    assert.ok(r, `${p.slug}: no tiene forma de diseño`);
    assert.equal(r.ancho, p.ancho, `${p.slug}: el ancho del catálogo no es el del documento`);
    assert.deepEqual(srcsLocales(doc), [], `${p.slug}: tiene imágenes locales y el server la rechazaría`);
    assert.ok(JSON.stringify(doc).length < TOPE_DOC_BYTES, `${p.slug}: pasa el tope del documento`);
  }
  assert.equal(await documentoDePlantilla('no-existe'), null);
});

test('4: las operaciones del área llevan el permiso de la tab y de admin, y la definición no arrastra el server', () => {
  assert.equal(DEFS.length, 7);
  for (const d of DEFS) {
    assert.equal(d.area, 'imagen');
    assert.deepEqual(d.gating, { tab: 'image-editor', rolMinimo: 'admin' }, `${d.id}: el permiso es el de la tab, como toda tab`);
  }
  const src = readFileSync(join(RAIZ, 'lib/api-mako/areas/imagen.def.ts'), 'utf8');
  const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ['../tipos', '@/lib/image-editor/tamanos'], 'una .def.ts sólo importa tipos y datos sin dependencias');
});

test('5: por WhatsApp, un pedido de crear un diseño llega con las herramientas del editor, y no se roba otros pedidos', async () => {
  // 15/10/2026: «creame un flyer…» salía `capturar` dudosa (sin herramientas) aunque `imagen` estaba en AREA_KEYWORDS.
  // PROBADO ROMPIÉNDOLO: sin la regla 6-bis-bis de clasificarIntencion, 0/1.
  const { clasificarIntencion } = await import('../lib/mako-intencion');
  const crea = ['creame un flyer de la inauguración', 'armame un diseño para la promo del viernes', 'diseñame un banner para la web', 'quiero un volante para la feria'];
  for (const t of crea) {
    const v = clasificarIntencion(t, {});
    assert.equal(v.intencion, 'actuar', `«${t}» tiene que ser actuar`);
    assert.deepEqual(v.areas, ['imagen'], `«${t}» tiene que traer el área imagen`);
  }
  for (const t of ['creame una tarea para el flyer', 'haceme una reunión para ver el diseño', 'creame una automatización para los que bajan el flyer']) {
    assert.ok(!(clasificarIntencion(t, {}).areas ?? []).includes('imagen'), `«${t}» no es un diseño`);
  }
});
