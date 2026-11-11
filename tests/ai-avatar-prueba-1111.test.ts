// =============================================================================
// AI Avatar, mirado con capturas (11/11/2026): lo que se arregló en la pantalla
// =============================================================================
// Martín, 11/11: la prueba del 10/11 se hizo leyendo texto y código, no MIRANDO. Mirada con capturas
// (docs/pruebas/ai-avatar-11-11.md), «Nuevo avatar» tenía las 10 plantillas de venta como cajas de texto
// que repetían su nombre arriba y abajo; los presets no pasaban su video a la tarjeta (que ya lo sabía
// mostrar); y el lugar del personaje era un «+» solo, sin decir qué foto sirve.
//
// Correr: node --import tsx --test tests/ai-avatar-prueba-1111.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { PLANTILLAS_AVATAR, plantillaPorId } from '../lib/ai-avatar/plantillas';
import { PLANTILLAS_VENTA_AVATAR, ganchoDeEjemplo } from '../lib/ai-avatar/plantillas-venta';
import { CONSEJO_FOTO, pieDeGenerar } from '../lib/ai-avatar/estudio';

const leer = (r: string) => readFileSync(join(process.cwd(), r), 'utf8');
const estudio = leer('app/ai-avatar/Estudio.tsx');
const telefono = leer('app/m/ai-avatar/EstudioM.tsx');

test('cada plantilla de venta tiene un gancho real para su tarjeta, y no es su nombre', () => {
  assert.equal(PLANTILLAS_VENTA_AVATAR.length, 10);
  for (const p of PLANTILLAS_VENTA_AVATAR) {
    const g = ganchoDeEjemplo(p);
    assert.ok(g.enPantalla.length > 0, `${p.id}: ningún tramo con texto en pantalla`);
    assert.ok(g.dice.length > 20, `${p.id}: sin la primera frase hablada`);
    assert.notEqual(g.enPantalla, p.nombre, `${p.id}: la tarjeta volvería a repetir el nombre`);
    assert.ok(!/^(GANCHO|PROBLEMA|HISTORIA)\b/.test(g.dice), `${p.id}: se coló la etiqueta de la sección`);
  }
});

test('la primera frase es la de la PRIMERA sección del guion, la que se escucha primero', () => {
  const auto = PLANTILLAS_VENTA_AVATAR.find((p) => p.id === 'confesion-auto')!;
  assert.match(ganchoDeEjemplo(auto).dice, /^Esta semana tres personas me dijeron/);
});

test('la tarjeta de venta ya no repite el nombre: hoja con el gancho, o la imagen de su escena', () => {
  assert.ok(!/extracto: `\$\{p\.nombre\}/.test(estudio), 'el extracto empezaba con el nombre, que la tarjeta ya pone abajo');
  assert.match(estudio, /const escena = plantillaPorId\(p\.presetId\);/, 'la imagen sale del preset de la plantilla');
  assert.match(estudio, /imagen \? \{ imagen, video: escena\?\.ejemplo\?\.video \} : \{ extracto: g\.enPantalla \|\| p\.cuando, frase: g\.dice/);
});

test('los presets de «Nuevo avatar» pasan su video a la tarjeta (corre con el mouse encima)', () => {
  const i = estudio.indexOf('...PLANTILLAS_AVATAR.map((p): PlantillaCrear => ({');
  assert.ok(i > 0);
  assert.match(estudio.slice(i, i + 700), /video: p\.ejemplo\?\.video,/);
});

test('el lugar del personaje dice qué foto sirve, en la compu y en el teléfono, mientras no hay ninguna', () => {
  assert.match(CONSEJO_FOTO, /de frente/);
  assert.match(estudio, /\{fotos\.length === 0 && <p className="hf-menu-ayuda">\{CONSEJO_FOTO\}<\/p>\}/);
  assert.match(telefono, /\{fotos\.length === 0 && <p className="m-ai-avatar-pronto">\{CONSEJO_FOTO\}<\/p>\}/);
});

test('⚠️ TODOS los presets tienen su imagen: un degradado gris en producción es una falla, no un pendiente', () => {
  // Martín, 11/11: «miniaturas grises». El 10/11, 31 de los 33 presets eran un degradado sin imagen, anotado como
  // «pendiente» desde el 29/10. Las imágenes son de Flow, con la cara de Martín y el MISMO prompt del producto.
  assert.ok(PLANTILLAS_AVATAR.length >= 33);
  for (const p of PLANTILLAS_AVATAR) {
    assert.ok(p.ejemplo?.poster, `${p.id}: sin imagen, la baldosa es un degradado gris`);
    const archivo = join(process.cwd(), 'public', p.ejemplo.poster);
    assert.ok(existsSync(archivo), `${p.id}: falta ${p.ejemplo.poster}`);
    // Una miniatura, no el original de Flow (768×1376, ~700 KB): 33 de esas son 23 MB en cada carga de la grilla.
    assert.ok(statSync(archivo).size < 200_000, `${p.id}: ${p.ejemplo.poster} pesa ${statSync(archivo).size} B`);
  }
});

test('las 10 plantillas de venta tienen la imagen de su escena', () => {
  for (const v of PLANTILLAS_VENTA_AVATAR) {
    assert.ok(plantillaPorId(v.presetId)?.ejemplo?.poster, `${v.id}: su preset ${v.presetId} no tiene imagen`);
  }
});

test('«Generar» apagado dice lo que falta, en vez de «Gratis»', () => {
  const listo = { preset: true, pasosFaltan: 0, foto: true, flowListo: true };
  assert.equal(pieDeGenerar(listo), 'Gratis');
  assert.equal(pieDeGenerar({ ...listo, preset: false, pasosFaltan: 4 }), 'Falta el preset', 'primero lo que se ve: el preset');
  assert.equal(pieDeGenerar({ ...listo, pasosFaltan: 4 }), 'Faltan 4 pasos');
  assert.equal(pieDeGenerar({ ...listo, pasosFaltan: 1 }), 'Falta 1 paso');
  assert.equal(pieDeGenerar({ ...listo, foto: false }), 'Falta tu foto');
  assert.equal(pieDeGenerar({ ...listo, flowListo: false }), 'Flow no está listo');
  const i = estudio.indexOf('className="hf-generar" disabled={!!falta || enviando}');
  assert.ok(i > 0, 'falta el botón');
  const boton = estudio.slice(i, i + 500);
  assert.match(boton, /title=\{falta \|\| undefined\}/, 'con el mouse encima, la línea entera');
  assert.match(boton, /<small>\{enviando \? 'Gratis' : pieDeGenerar\(\{ preset: !!preset, pasosFaltan: req\.pasos\.filter\(\(x\) => !x\.hecho\)\.length, foto: !!foto, flowListo: puente\.puede \}\)\}<\/small>/,
    'el pie del botón ES pieDeGenerar, con lo que falta de verdad');
  assert.ok(!/<small>Gratis<\/small>/.test(boton), '«Gratis» fijo era el error');
});

test('en el teléfono, las pastillas y «Generar» van en UNA fila y la ranura vacía dice dónde elegir', () => {
  const i = telefono.indexOf('<div className="m-ai-avatar-barra__pie">');
  assert.ok(i > 0, 'falta la fila de abajo');
  const fila = telefono.slice(i, i + 900);
  assert.match(fila, /m-ai-avatar-barra__pastillas/);
  assert.match(fila, /Generar/);
  assert.ok(!/size="lg" full/.test(fila), '«Generar» a todo el ancho es la fila de más');
  assert.match(telefono, /preset \? preset\.nombre : 'Elige arriba'/);
  const css = leer('app/m/ai-avatar/ai-avatar.css');
  assert.match(css, /\.m-ai-avatar-barra__pie \{ display: flex;/);
  assert.match(css, /\.m-ai-avatar-barra__pie \.m-ai-avatar-barra__pastillas \{[^}]*overflow-x: auto/, 'si no entran, corren de costado');
});
