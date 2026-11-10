// La biblioteca de carruseles guarda imágenes NUESTRAS, nunca la URL de Instagram (9/11/2026).
//
// Martín, con la grilla de outliers de Image: «no podemos no visualizar bien los carruseles, se rompe todo el diseño. Y hay
// muchos que no tienen el botón para desplazar». Medido en producción: 91 portadas visibles apuntaban al CDN de Instagram (27
// de 60 de una muestra ya daban 403) y 168 carruseles visibles no tenían láminas. La causa: la carga guardaba la URL original
// cuando una imagen no bajaba en los 9 s del tope de Vercel, y la biblioteca nunca vuelve a leer una pieza.
//
// Esto corre el MISMO código que usa la carga (scripts/carruseles-biblioteca.mts → `guardarLeidas`), con bajadores falsos:
//   1. la portada que baja se guarda nuestra;
//   2. la que no baja cae a la lámina 1 ya bajada;
//   3. si no baja nada, la fila va SIN `miniatura` ni `laminas_imagenes`: ninguna URL de Instagram llega a la base;
//   4. láminas a medias no se guardan (cambiarían el carrusel);
//   5. sin la 0404, nunca se manda `laminas_imagenes`;
//   6. el upsert va en grupos con las mismas columnas: una fila sin portada no le pone NULL a la de otra.
//
// Verificado rompiéndolo (cada cambio, el caso que cae):
//   · `portadaNuestra` devuelve la miniatura sin mirar si es nuestra          → 2, 3, 4, 6 y portadaNuestra
//   · sin caer a la lámina 1                                                   → 2, 6 y portadaNuestra
//   · guardar las láminas de Instagram aunque no bajaron todas                 → 1 a 6
//   · `gruposParaUpsert` devuelve una sola lista                               → 6
//
// Correr: node --import tsx --test tests/carruseles-biblioteca-imagenes.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gruposParaUpsert, imagenesANuestroBucket, portadaNuestra, type Bajadores } from '../lib/carruseles/biblioteca-imagenes';

const NUESTRO = 'https://x.supabase.co/storage/v1/object/public/spy-miniaturas/';
const IG = (n: string) => `https://instagram.fsyd10-1.fna.fbcdn.net/v/t51.82787-15/${n}.jpg?oe=6912ABCD`;
const esNuestra: Bajadores['esNuestra'] = (u) => !!u && u.startsWith(NUESTRO);

/** Bajadores falsos: baja lo que está en `bajan` (las URL de Instagram que «todavía sirven»), el resto queda como vino. */
function falsos(bajan: ReadonlySet<string>): Bajadores {
  return {
    esNuestra,
    bajarPortadas: async (piezas) => piezas.map((p) => (p.miniatura && bajan.has(p.miniatura) ? { ...p, miniatura: `${NUESTRO}spy/${p.canal}/${p.ref}.jpg` } : p)),
    bajarLaminas: async (ref, urls) => (urls.every((u) => bajan.has(u)) ? urls.map((_, i) => `${NUESTRO}spy/carruseles/${ref}-${i + 1}.jpg`) : null),
  };
}
const fila = (ref: string, extra: Record<string, unknown> = {}) => ({ ref, medio: 'carrusel', texto: 'Comment NATURE', miniatura: IG(`${ref}-portada`), laminas_imagenes: [IG(`${ref}-1`), IG(`${ref}-2`)], ...extra });
const sinInstagram = (x: unknown) => assert.doesNotMatch(JSON.stringify(x), /fbcdn|cdninstagram/, 'una URL de Instagram llegó a la fila que se guarda');

test('1 · la portada que baja se guarda nuestra, con sus láminas', async () => {
  const f = fila('A');
  const [r] = await imagenesANuestroBucket([f], falsos(new Set([f.miniatura, ...f.laminas_imagenes])), { conLaminas: true });
  assert.equal(r.miniatura, `${NUESTRO}spy/instagram/A.jpg`);
  assert.deepEqual(r.laminas_imagenes, [`${NUESTRO}spy/carruseles/A-1.jpg`, `${NUESTRO}spy/carruseles/A-2.jpg`]);
  assert.equal(r.texto, 'Comment NATURE', 'lo que no es imagen pasa tal cual');
  assert.ok(!('canal' in r), 'el canal es del bajador, no de la tabla: PostgREST rechazaría la fila');
  sinInstagram(r);
});

test('2 · la portada que no baja (403) cae a la lámina 1 ya bajada', async () => {
  const f = fila('B');
  const [r] = await imagenesANuestroBucket([f], falsos(new Set(f.laminas_imagenes)), { conLaminas: true });
  assert.equal(r.miniatura, `${NUESTRO}spy/carruseles/B-1.jpg`);
  sinInstagram(r);
});

test('3 · si no baja nada, la fila va SIN portada ni láminas: nunca con la URL de Instagram', async () => {
  const [r] = await imagenesANuestroBucket([fila('C')], falsos(new Set()), { conLaminas: true });
  assert.ok(!('miniatura' in r), 'sin portada nuestra, la columna no se manda (una que ya estaba se conserva)');
  assert.ok(!('laminas_imagenes' in r));
  assert.equal(r.ref, 'C');
  sinInstagram(r);
});

test('4 · láminas a medias no se guardan, y la portada no sale de una lámina que no es nuestra', async () => {
  const f = fila('D');
  const [r] = await imagenesANuestroBucket([f], falsos(new Set([f.laminas_imagenes[0]])), { conLaminas: true });
  assert.ok(!('laminas_imagenes' in r), 'con una lámina que falta en el medio, el carrusel cambiaría');
  assert.ok(!('miniatura' in r));
  sinInstagram(r);
});

test('5 · sin la 0404 nunca se manda `laminas_imagenes` (PostgREST rechazaría la fila entera)', async () => {
  const f = fila('E');
  const [r] = await imagenesANuestroBucket([f], falsos(new Set([f.miniatura, ...f.laminas_imagenes])), { conLaminas: false });
  assert.ok(!('laminas_imagenes' in r));
  assert.equal(r.miniatura, `${NUESTRO}spy/instagram/E.jpg`);
});

test('6 · el upsert va en grupos con las MISMAS columnas: a nadie le pone NULL en lo que no trae', async () => {
  const a = fila('F');
  const b = fila('G');
  const c = fila('H', { medio: 'imagen', laminas_imagenes: null });
  const bajan = new Set([a.miniatura, ...a.laminas_imagenes, ...b.laminas_imagenes]);
  const filas = await imagenesANuestroBucket([a, b, fila('I'), c], falsos(bajan), { conLaminas: true });
  const grupos = gruposParaUpsert(filas);
  for (const g of grupos) {
    const claves = new Set(g.map((x) => Object.keys(x).sort().join('|')));
    assert.equal(claves.size, 1, `un grupo mezcla columnas: ${[...claves].join(' ≠ ')}`);
  }
  // F y G traen portada y láminas (G con la lámina 1 de portada); I y H no traen ninguna de las dos.
  assert.deepEqual(grupos.map((g) => g.map((x) => x.ref)), [['F', 'G'], ['I', 'H']]);
  assert.equal(grupos.flat().length, 4, 'no se pierde ninguna fila');
  sinInstagram(filas);
});

test('portadaNuestra: la nuestra, si no la lámina 1 nuestra, si no null', () => {
  assert.equal(portadaNuestra(`${NUESTRO}a.jpg`, [IG('x')], esNuestra), `${NUESTRO}a.jpg`);
  assert.equal(portadaNuestra(IG('p'), [`${NUESTRO}l1.jpg`, `${NUESTRO}l2.jpg`], esNuestra), `${NUESTRO}l1.jpg`);
  assert.equal(portadaNuestra(IG('p'), [IG('l1')], esNuestra), null);
  assert.equal(portadaNuestra(null, null, esNuestra), null);
  assert.equal(portadaNuestra(undefined, [], esNuestra), null);
});
