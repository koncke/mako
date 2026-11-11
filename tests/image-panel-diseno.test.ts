// El panel «Diseño» del editor de imágenes sirve las plantillas REALES de MaKo (11/11/2026).
//
// Del 6/11 al 11/11 quedó vacío: un buscador y un «Todas las plantillas» que nunca encontraban nada («Ninguna plantilla
// coincide con “lista”»). La prueba de Image del 10/11 lo marcó (docs/pruebas/image-10-11.md, caso 17). La referencia es
// Canva: su panel «Diseño» lista plantillas. Esto corre el servicio de verdad (app/image-editor/mako/plantillas.ts) y fija:
//   1. lista las mismas plantillas reales de «Nuevo diseño», cada una con su estructura para dibujar la tarjeta;
//   2. el buscador encuentra (sin tildes) y las categorías filtran por grupo;
//   3. abrir una da su ESTRUCTURA con ids nuevos cada vez (aplicarla dos veces no repite ids), y una que no existe se niega;
//   4. la paginación no repite ni pierde ninguna.
//
// Verificado rompiéndolo (11/11/2026, base 4/0): `list` devolviendo vacío → caen 1, 2 y 4; `get` con ids fijos → cae 3; el
// buscador sin sacar las tildes → cae 2.
//
// Correr: node --import tsx --test tests/image-panel-diseno.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { servicioPlantillas } from '../app/image-editor/mako/plantillas';
import { PLANTILLAS_IMAGEN } from '../lib/image-editor/plantillas-reales';

const panel = servicioPlantillas(null);
type DocLigero = { pages?: Array<{ id?: string; objects?: Array<{ id?: string }> }> };
const ids = (d: DocLigero) => (d.pages ?? []).flatMap((p) => [p.id, ...(p.objects ?? []).map((o) => o.id)]).filter(Boolean);

test('1 · lista las plantillas reales de «Nuevo diseño», cada una con su estructura para la tarjeta', async () => {
  const r = await panel.list({ page_size: 100 });
  assert.equal(r.count, PLANTILLAS_IMAGEN.length);
  assert.deepEqual(r.results.map((t) => t.slug).sort(), PLANTILLAS_IMAGEN.map((p) => p.id).sort());
  for (const t of r.results) {
    const paginas = (t.muestra as DocLigero | undefined)?.pages ?? [];
    assert.ok(paginas.length > 0, `«${t.slug}» sin estructura para dibujar`);
    assert.equal(t.thumbnail_url, null);
    assert.ok(t.width > 0 && t.height > 0 && t.page_count > 0);
  }
});

test('2 · el buscador encuentra sin tildes y las categorías filtran por grupo', async () => {
  const miniaturas = (await panel.list({ q: 'miniatura', page_size: 100 })).results;
  assert.ok(miniaturas.length > 0, 'buscar «miniatura» no encontró nada');
  assert.equal((await panel.list({ q: 'públicacion' })).count, (await panel.list({ q: 'publicacion' })).count, 'el buscador distingue tildes');
  const cats = await panel.categories();
  assert.ok(cats.length >= 2);
  for (const c of cats) {
    const deEsa = (await panel.list({ category: c.slug, page_size: 100 })).results;
    assert.equal(deEsa.length, c.template_count, `«${c.name}» dice ${c.template_count} y lista ${deEsa.length}`);
    assert.ok(deEsa.every((t) => t.category?.slug === c.slug));
  }
  assert.equal((await panel.list({ q: 'xyzzy-no-existe' })).count, 0);
});

test('3 · abrir una da su estructura con ids NUEVOS cada vez, y una que no existe se niega', async () => {
  const id = PLANTILLAS_IMAGEN[0].id;
  const a = await panel.get(id);
  const b = await panel.get(id);
  const deA = ids(a.document as unknown as DocLigero);
  assert.ok(deA.length > 0);
  const deB = ids(b.document as unknown as DocLigero);
  assert.deepEqual(deA.filter((x) => deB.includes(x)), [], 'aplicar la misma plantilla dos veces repetiría ids en el diseño');
  assert.equal(a.title, PLANTILLAS_IMAGEN[0].nombre);
  await assert.rejects(() => panel.get('bold-sale-announcement'), /no existe/i);
});

test('4 · la paginación no repite ni pierde ninguna', async () => {
  const vistas: string[] = [];
  for (let pag = 1; ; pag++) {
    const r = await panel.list({ page: pag, page_size: 5 });
    vistas.push(...r.results.map((t) => t.slug));
    if (!r.next) break;
  }
  assert.equal(new Set(vistas).size, vistas.length, 'una plantilla salió dos veces');
  assert.equal(vistas.length, PLANTILLAS_IMAGEN.length);
});
