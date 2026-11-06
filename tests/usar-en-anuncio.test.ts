// «Usar en un anuncio» desde los editores de Create y el AI Avatar (lo prometido a la agencia de Thiago,
// docs/promesas/2910-llamada-thiago.md, [30:17] y [31:25]). Corre de verdad lib/anuncio-desde-pieza.ts (lo que entra por la
// dirección de /anuncio/nuevo y lo que se le propone a la API), la validación de `proponer_crear_campana` sobre esa entrada, y
// lib/ai-avatar/proyectos.ts (la toma del video de una toma). Del cableado, que los cuatro lugares tengan el botón y que el
// final sea una PROPUESTA (nunca crear en Meta desde acá).
//
// Probado rompiéndolo (6/11/2026), base 9/0:
//   · `leerPieza` aceptando cualquier path como archivo (sin `esPathDeStaging`) → 1 fallo, 8 pases;
//   · `entradaParaProponer` mandando el formulario con el objetivo web → 1 fallo, 8 pases;
//   · la ruta corriendo otra operación que `proponer_crear_campana` → 1 fallo, 8 pases;
//   · `videosDelLook` sin `primeraToma` → 1 fallo, 8 pases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { avisoDeZernio, entradaParaProponer, leerPieza, nombreSugerido, rutaUsarEnAnuncio, TOPE_TEXTO_ANUNCIO } from '../lib/anuncio-desde-pieza';
import { validarInput } from '../lib/api-mako/validar';
import { porId } from '../lib/api-mako/registro';
import { videosDelLook } from '../lib/ai-avatar/proyectos';
import type { PlanGuardado } from '../app/video-generator/video-datos';

const PLAN = '3f2a9c1e-1111-4222-8333-444455556666';
const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const desde = (ruta: string) => leerPieza(Object.fromEntries(new URL(ruta, 'https://x').searchParams));

test('ida y vuelta por la dirección: archivo del staging, video de MaKo y toma del AI Avatar', () => {
  const a = desde(rutaUsarEnAnuncio({ origen: 'image', titulo: 'Promo', creativo: { tipo: 'archivo', path: 'nueva/1700000000000-ab-x.png', media: 'imagen' } }));
  assert.deepEqual(a.creativo, { tipo: 'archivo', path: 'nueva/1700000000000-ab-x.png', media: 'imagen' });
  assert.equal(a.origen, 'image');
  const g = desde(rutaUsarEnAnuncio({ origen: 'video', creativo: { tipo: 'generado', ref: 'montaje:77' } }));
  assert.deepEqual(g.creativo, { tipo: 'generado', ref: 'montaje:77' });
  const t = desde(rutaUsarEnAnuncio({ origen: 'avatar', texto: 'Hola, soy tu avatar.', creativo: { tipo: 'toma', plan: PLAN, toma: 1 } }));
  assert.deepEqual(t.creativo, { tipo: 'toma', plan: PLAN, toma: 1 });
  assert.equal(t.texto, 'Hola, soy tu avatar.');
});

test('lo de afuera no se usa: un path que no es del staging, una ref inventada o un plan con barras quedan sin creativo', () => {
  for (const q of [{ archivo: '../secreto/x.mp4' }, { archivo: 'https://otro.com/a.mp4' }, { ref: 'https://otro.com/v.mp4' }, { plan: '../x', toma: '1' }, { plan: PLAN, toma: '0' }]) {
    assert.equal(leerPieza(q).creativo, null, JSON.stringify(q));
  }
  assert.equal(leerPieza({ origen: 'cualquiera' }).origen, 'video', 'un origen desconocido no se dibuja');
});

test('el texto de un guion largo se corta al tope del texto principal, sin partir un emoji', () => {
  const largo = `${'a'.repeat(TOPE_TEXTO_ANUNCIO - 1)}😀😀`;
  const p = desde(rutaUsarEnAnuncio({ origen: 'copywriter', texto: largo }));
  assert.equal(Array.from(p.texto).length, TOPE_TEXTO_ANUNCIO);
  assert.ok(p.texto.endsWith('😀'));
});

test('la entrada que se propone es la de `proponer_crear_campana`, y la valida su propio validador', () => {
  const f = { nombre: 'Promo', objetivo: 'web', presupuestoDia: 20, formularioId: '999', pixelId: '123', evento: 'LEAD', url: 'https://hola.com', hasta: '', lugares: [], texto: 'Compra ya', titulo: '', boton: '' };
  const e = entradaParaProponer(f, { tipo: 'archivo', path: 'nueva/1700000000000-ab-x.mp4', media: 'video' });
  assert.deepEqual(e, {
    nombre: 'Promo', objetivo: 'web', presupuestoDia: 20, texto: 'Compra ya', url: 'https://hola.com', lugares: [],
    pixelId: '123', evento: 'LEAD', creativoTipo: 'archivo', archivoPath: 'nueva/1700000000000-ab-x.mp4', archivoMedia: 'video',
  });
  assert.equal(Object.hasOwn(e, 'formularioId'), false, 'con objetivo web no viaja el formulario');
  const def = porId('proponer_crear_campana')!;
  const v = validarInput(def.parametros, e, 'json');
  assert.ok(!('error' in v), `el validador de la API la acepta: ${'error' in v ? v.error : ''}`);
  const g = entradaParaProponer({ ...f, objetivo: 'formulario' }, { tipo: 'generado', ref: 'montaje:77' });
  assert.deepEqual([g.creativoTipo, g.creativoRef, g.formularioId, g.pixelId], ['generado', 'montaje:77', '999', undefined]);
  assert.ok(!('error' in validarInput(def.parametros, g, 'json')));
});

test('el nombre de partida y el aviso mientras publicar por Zernio no está probado', () => {
  assert.equal(nombreSugerido({ origen: 'avatar', titulo: '' }), 'Anuncio desde AI Avatar');
  assert.equal(nombreSugerido({ origen: 'copywriter', titulo: 'Black November' }), 'Black November');
  assert.ok(avisoDeZernio(false)?.includes('nace en pausa'));
  assert.equal(avisoDeZernio(true), null);
});

test('la ruta PROPONE por el choke point de la API: nunca crea en Meta por su cuenta', () => {
  const r = leer('app/api/anuncio-desde-pieza/route.ts');
  assert.match(r, /ejecutarOperacion\('proponer_crear_campana', entrada, ctx, 'json'\)/);
  assert.doesNotMatch(r, /crearCampana\(|crearCampanaPorZernio|crearAnuncioPorZernio/, 'lanzar la confirma una persona en /mako/revisar');
  assert.match(r, /const ws = await wsDeAdsManager\(\);/, 'la puerta del Ads Manager');
  // La API resuelve el video de MaKo en el negocio (la url no viaja desde el navegador).
  const run = leer('lib/api-mako/areas/ads.run.ts');
  assert.match(run, /if \(tipo === 'generado'\) \{\n\s*const ref = leerRefCreativo\(str\(input, 'creativoRef'\)\);/);
});

test('los cuatro lugares ofrecen «Usar en un anuncio» al lado de «Publicar en redes»', () => {
  assert.match(leer('app/copywriter/editor/EditorGuion.tsx'), /data-usar-en-anuncio="" onClick=\{usarEnAnuncio\}/);
  assert.match(leer('app/image-editor/_doory/editor/dialogs/DownloadDialog.tsx'), /onClick=\{\(\) => void usarEnAnuncio\(\)\}/);
  assert.match(leer('app/video-editor/_opencut/export/dialogo-exportar.tsx'), /onClick=\{\(\) => void usarEnAnuncio\(videoListo\)\}/);
  const estudio = leer('app/ai-avatar/Estudio.tsx');
  assert.equal((estudio.match(/>Usar en un anuncio<\/ButtonLink>/g) ?? []).length, 2, 'el video recién filmado y los de antes');
});

test('el Image Editor no importa un VALOR de un módulo use client (el cliente de «Usar en un anuncio» no lo es)', () => {
  const c = leer('app/_crear/usar-en-anuncio.ts');
  assert.doesNotMatch(c.split('\n').slice(0, 3).join('\n'), /use client/);
  assert.doesNotMatch(c, /from 'react'/);
});

test('el AI Avatar sabe qué toma es la del video de una toma', () => {
  const h = [{
    id: PLAN, pedido: 'Hola', at: '2026-11-01T10:00:00Z',
    plan: { clips: [{ n: 3 }] } as unknown as PlanGuardado['plan'],
    imagenes: { '1': { elegida: 'u', elegidaId: 'med-1', confirmada: true } } as unknown as PlanGuardado['imagenes'],
    video: { '3': { url: 'https://x/v.mp4' } } as unknown as PlanGuardado['video'],
  } as PlanGuardado];
  const [v] = videosDelLook(h, 'med-1');
  assert.deepEqual([v.tomas, v.listas, v.primeraToma], [1, 1, 3]);
});
