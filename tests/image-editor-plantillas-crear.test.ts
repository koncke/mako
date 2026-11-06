// =============================================================================
// «Nuevo diseño» del Image Editor: las plantillas de «¿Qué vas a crear hoy?», las mismas en la computadora y el teléfono
// =============================================================================
// Martín, 29/10/2026: «En "nueva" dependiendo de qué tab, deberías ponerme TEMPLATES con la sección de ¿Qué vas a crear
// hoy?» y «prefiero deprecar antes que conservar» (Carousels se fue: su DISEÑO vive acá). Lo que fija, sin pantalla:
//   1. la lista (app/image-editor/plantillas-crear.ts): los tamaños con nombre en blanco, con su marco y su medida; el
//      carrusel de Instagram de varias páginas; las plantillas con diseño, con su miniatura que existe; ids únicos;
//   2. los tamaños son los de la lista ÚNICA del editor (Redimensionar, _doory/editor/dialogs/resizeSizes.ts): uno
//      inventado acá abriría un diseño de una medida que el editor no conoce por nombre;
//   3. el documento en blanco trae una página por id (el carrusel, cinco) y lo acepta la regla del server;
//   4. la acción busca el id en la lista (no confía en medidas del navegador) y arma el documento sin el motor;
//   5. la computadora y el teléfono usan la MISMA lista y la MISMA acción (ninguno se arma la suya);
//   6. los ejemplos de la caja son pedidos cortos, en tú.
//
// Correr: node --import tsx --test tests/image-editor-plantillas-crear.test.ts
// PROBADO ROMPIÉNDOLO (29/10/2026): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EJEMPLOS_NUEVO_DISENO, ID_CARRUSEL, PAGINAS_CARRUSEL, PLANTILLAS_NUEVO_DISENO, plantillaNueva,
} from '../app/image-editor/plantillas-crear';
import { TAMANOS_API } from '../lib/image-editor/tamanos';
import { documentoEnBlanco, resumirDoc } from '../lib/image-editor/reglas';
import { catalogoPlantillas } from '../app/image-editor/mako/plantillas';
import { RESIZE_SIZES } from '../app/image-editor/_doory/editor/dialogs/resizeSizes';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const enBlanco = PLANTILLAS_NUEVO_DISENO.filter((p) => !p.plantilla);
const conDiseno = PLANTILLAS_NUEVO_DISENO.filter((p) => p.plantilla);

test('1: los tamaños en blanco, con su marco «ancho / alto» y su medida «ancho × alto», y una página', () => {
  for (const [id, t] of Object.entries(TAMANOS_API)) {
    const p = plantillaNueva(id);
    assert.ok(p, `falta el tamaño «${t.nombre}» en «Nuevo diseño»`);
    assert.equal(p.nombre, t.nombre);
    assert.deepEqual([p.ancho, p.alto, p.paginas], [t.ancho, t.alto, 1], `${id}: medidas o páginas`);
    assert.equal(p.formato, `${t.ancho} / ${t.alto}`, `${id}: el marco de la tarjeta`);
    assert.equal(p.rotulo, `${t.ancho} × ${t.alto}`, `${id}: el rótulo de la tarjeta`);
    assert.equal(p.imagen, undefined, `${id}: uno en blanco no tiene miniatura (se dibuja su marco)`);
  }
});

test('1: el carrusel de Instagram: 1080 × 1350, varias páginas, en blanco y al lado de las publicaciones', () => {
  const c = plantillaNueva(ID_CARRUSEL);
  assert.ok(c, 'falta «Carrusel de Instagram»: la tab Carousels se deprecó y su diseño vive acá');
  assert.equal(c.nombre, 'Carrusel de Instagram');
  assert.deepEqual([c.ancho, c.alto], [1080, 1350]);
  assert.ok(c.paginas > 1 && c.paginas === PAGINAS_CARRUSEL, 'un carrusel trae varias páginas');
  assert.equal(c.plantilla, undefined);
  const i = PLANTILLAS_NUEVO_DISENO.indexOf(c);
  assert.equal(PLANTILLAS_NUEVO_DISENO[i - 1]?.id, 'publicacion_vertical', 'va después de la publicación 4:5, que es su tamaño');
});

test('1: las plantillas con diseño, todas, con la miniatura que existe en public/', () => {
  const cat = catalogoPlantillas();
  assert.equal(conDiseno.length, cat.length, 'cada plantilla del editor está en «Nuevo diseño»');
  for (const p of cat) {
    const n = conDiseno.find((x) => x.plantilla === p.slug);
    assert.ok(n, `falta «${p.titulo}»`);
    assert.equal(n.nombre, p.titulo);
    assert.deepEqual([n.ancho, n.alto, n.paginas], [p.ancho, p.alto, p.paginas]);
    assert.equal(n.imagen, `/cv/plantillas/${p.slug}.webp`);
    assert.ok(existsSync(join(RAIZ, 'public', n.imagen)), `${n.imagen} no existe: la tarjeta saldría rota`);
  }
  // Primero lo en blanco, después lo que trae diseño (las tarjetas con miniatura no se mezclan con los marcos).
  const primeraConDiseno = PLANTILLAS_NUEVO_DISENO.findIndex((p) => p.plantilla);
  assert.equal(primeraConDiseno, enBlanco.length);
});

test('1: ids únicos, y uno que no está no es ninguna', () => {
  const ids = PLANTILLAS_NUEVO_DISENO.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'dos tarjetas con el mismo id: la acción crearía la equivocada');
  assert.equal(plantillaNueva('inventada'), null);
  assert.equal(plantillaNueva(''), null);
  assert.equal(plantillaNueva('__proto__'), null);
});

test('2: los tamaños en blanco son de la lista ÚNICA del editor (Redimensionar)', () => {
  for (const p of enBlanco) {
    assert.ok(RESIZE_SIZES.some((s) => s.width === p.ancho && s.height === p.alto), `«${p.nombre}» (${p.ancho} × ${p.alto}) no está en resizeSizes.ts`);
  }
});

test('3: el documento en blanco: una página por id, y la regla del server lo acepta', () => {
  const ids = Array.from({ length: PAGINAS_CARRUSEL }, (_, i) => `p${i}`);
  const doc = documentoEnBlanco(1080, 1350, ids) as { pages: { id: string; objects: unknown[] }[] };
  assert.deepEqual(doc.pages.map((p) => p.id), ids);
  assert.ok(doc.pages.every((p) => Array.isArray(p.objects) && p.objects.length === 0));
  assert.deepEqual(resumirDoc(doc), { ancho: 1080, alto: 1350, paginas: PAGINAS_CARRUSEL });
  // Con un id suelto, como siempre (la API de MaKo y el teléfono lo llamaban así).
  assert.equal((documentoEnBlanco(1080, 1080, 'x') as { pages: unknown[] }).pages.length, 1);
});

test('4: la acción busca el id en la lista, arma el documento sin el motor y lo crea con el nombre de la tarjeta', () => {
  const src = sinComentarios(leer('app/image-editor/actions.ts'));
  assert.match(src, /^'use server';/);
  assert.match(src, /const p = await puerta\(\);\s*if \(p instanceof Response\)/, 'la puerta del editor antes que nada');
  assert.match(src, /const pl = plantillaNueva\(id\);\s*if \(!pl\) return/, 'el id se busca en la lista; uno de afuera no entra');
  assert.match(src, /pl\.plantilla\s*\?\s*await documentoDePlantilla\(pl\.plantilla\)\s*:\s*documentoEnBlanco\(pl\.ancho, pl\.alto, Array\.from\(\{ length: Math\.max\(1, pl\.paginas\) \}/);
  // El nombre sale de la tarjeta (o del que ella declara para el diseño: «Carrusel · Lista o tips»), nunca del navegador.
  assert.match(src, /crearDiseno\(p\.ws, p\.quien, \{ titulo: pl\.tituloDiseno \?\? pl\.nombre, doc \}\)/);
  assert.doesNotMatch(src, /_doory/, 'el motor es sólo de cliente');
});

test('5: la computadora y el teléfono, con la MISMA lista y la MISMA acción', () => {
  const escritorio = sinComentarios(leer('app/image-editor/ImageEditorCliente.tsx'));
  // Delante, las plantillas PROPIAS del negocio y las de la comunidad (6/11/2026, app/creaciones/usePlantillasPropias.ts):
  // son de escritorio por ahora (docs/relevo/nube-plantillas.md); la lista de MaKo sigue siendo la misma de los dos.
  assert.match(escritorio, /plantillasNuevo = useMemo\(\(\) => \[\.\.\.propias\.plantillas, \.\.\.PLANTILLAS_NUEVO_DISENO\]/);
  assert.match(escritorio, /plantillas=\{plantillasNuevo\}/);
  assert.match(escritorio, /ejemplos=\{EJEMPLOS_NUEVO_DISENO\}/);
  assert.match(escritorio, /await crearDisenoNuevoAction\(p\.id\)/);
  const telefono = sinComentarios(leer('app/m/image-editor/InicioImagenM.tsx'));
  assert.match(telefono, /PLANTILLAS_NUEVO_DISENO\.map\(/);
  assert.match(telefono, /await crearDisenoNuevoAction\(p\.id\)/);
  assert.match(telefono, /titulo="¿Qué vas a crear hoy\?"/);
  assert.match(telefono, /etiqueta="Nuevo diseño"/);
  // Ni la lista de tamaños vieja del teléfono ni su acción propia de crear.
  assert.doesNotMatch(telefono + sinComentarios(leer('app/m/image-editor/page.tsx')), /TAMANOS_API|crearDisenoMAction/);
  assert.doesNotMatch(sinComentarios(leer('app/m/image-editor/actions.ts')), /crearDiseno/);
});

test('6: los ejemplos de la caja: tres o cuatro pedidos cortos, en tú', () => {
  assert.ok(EJEMPLOS_NUEVO_DISENO.length >= 3 && EJEMPLOS_NUEVO_DISENO.length <= 4);
  for (const e of EJEMPLOS_NUEVO_DISENO) {
    assert.ok(e.length <= 60, `«${e}» es largo para escribirse solo en la caja`);
    assert.doesNotMatch(e, /\b(vos|tenés|querés|podés|hacé|armá|tu negocio vos)\b/i, `«${e}» va en tú`);
  }
});

// PROBADO ROMPIÉNDOLO (29/10/2026, base 9/0; de a una, restaurando y comparando con `cmp`):
//   · la lista sin el carrusel (`[...TAMANOS, ...CON_DISENO]`)                 → 8/1 (el del carrusel);
//   · la acción con `plantillaNueva(id) ?? { …medidas inventadas }`              → 8/1 (4: el id se busca en la lista);
//   · la hoja del teléfono titulada «Crear un diseño»                             → 8/1 (5: la misma lista y la misma acción).
// Restaurado: 9/0.
