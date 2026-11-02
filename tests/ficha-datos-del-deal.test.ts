// =============================================================================
// Lo que se vendió también elige sus datos (30/10/2026), y el buscador de Instagram tiene por dónde traer la foto
// =============================================================================
// El resto del punto 12 del 24/10: «en general revisá que todo sea editable». Datos fiscales, Servicio y Promesa dibujaban
// todos sus datos: sólo se podía sacar el bloque entero. Y el 21: la Meta de la plataforma nunca se le preguntaba al buscador,
// y la lectura de LA función de Instagram no pedía la foto.
//
// Correr: node --import tsx --test tests/ficha-datos-del-deal.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (ver docs/hallazgos-crm.md, «Lo que quedaba de los puntos 12 a 21»).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bloqueDef, DATOS_FISCALES, DATOS_PROMESA, DATOS_SERVICIO, type BloqueId } from '../lib/ficha/catalogo';
import { avisaDelPuesto, datosDelPuesto } from '../lib/ficha/config';
import { CAMPOS_DEAL } from '../lib/pagos-campo';
import { CAMPOS_PERFIL } from '../lib/instagram-perfil';

const leer = (r: string) => readFileSync(r, 'utf8').replace(/\r\n/g, '\n');
const CASOS: Array<[BloqueId, typeof DATOS_FISCALES, string]> = [
  ['datos-fiscales', DATOS_FISCALES, 'fiscal'], ['servicio-vendido', DATOS_SERVICIO, 'servicio'], ['promesa-y-garantia', DATOS_PROMESA, 'promesa'],
];

test('1. los tres bloques eligen sus datos, y de entrada traen todos: una ficha guardada se ve igual', () => {
  for (const [id, datos] of CASOS) {
    const def = bloqueDef(id)!;
    assert.deepEqual(def.opciones, ['datos'], id);
    assert.equal(def.datos, datos, id);
    assert.deepEqual([...datos.deEntrada].sort(), datos.todos.map((t) => t.id).sort(), `${id}: de entrada, todos`);
    assert.deepEqual(datosDelPuesto(def, undefined), [...datos.deEntrada], id);
  }
});

test('2. cada campo que el bloque dibuja se puede elegir: uno nuevo en CAMPOS_DEAL no queda afuera', () => {
  for (const [id, datos, seccion] of CASOS) {
    const ids = new Set(datos.todos.map((t) => t.id));
    for (const c of Object.keys(CAMPOS_DEAL[seccion as keyof typeof CAMPOS_DEAL])) assert.ok(ids.has(c), `${id}: falta ${c}`);
  }
});

test('3. el aviso va con su dato: sin él adentro no se pide ahí; con el bloque entero, se pide lo mismo que antes', () => {
  const fiscal = bloqueDef('datos-fiscales')!;
  assert.deepEqual(avisaDelPuesto(fiscal, undefined), ['dealFiscal', 'dealFiscalDoc']);
  assert.deepEqual(avisaDelPuesto(fiscal, { datos: ['razon'] }), ['dealFiscal']);
  assert.deepEqual(avisaDelPuesto(fiscal, { datos: ['documento'] }), ['dealFiscalDoc']);
  assert.deepEqual(avisaDelPuesto(bloqueDef('servicio-vendido')!, { datos: ['duracion'] }), []);
  assert.deepEqual(avisaDelPuesto(bloqueDef('promesa-y-garantia')!, undefined), ['dealPromesa']);
});

test('4. la pantalla obedece: filtra por lo elegido y marca las filas para su ✕ (el cuerpo del bloque es `inert`)', () => {
  const s = leer('app/crm/lead-view/ficha/pagos/bloques-deal.tsx');
  for (const seccion of ['fiscal', 'servicio', 'promesa']) assert.match(s, new RegExp(`Object\\.keys\\(CAMPOS_DEAL\\.${seccion}\\)\\.filter\\(\\(c\\) => va\\.has\\(c\\)\\)`), seccion);
  assert.match(s, /<div key=\{c\} data-dato=\{c\} data-dato-nombre=\{rotulos\[c\]\}/);
  for (const d of ['facturado_por', 'documento', 'arranco', 'que_es', 'resultado', 'garantia']) {
    assert.match(s, new RegExp(`va\\.has\\('${d}'\\) && <\\w+ [^>]*data-dato="${d}"`), d);
  }
});

test('5. Instagram: LA función pide la foto, y el buscador le pregunta a la Meta de la plataforma antes que a Apify', () => {
  assert.match(CAMPOS_PERFIL, /\bprofile_picture_url\b/);
  // ⚠️ 2/11/2026 — LA LISTA EXACTA YA NO SE FIJA ACÁ. Lo que este test cuida es el ORDEN: la Meta de
  // la plataforma antes que Apify, porque una lectura de Meta no gasta un crédito. Al sumar la
  // fuente `apify-spy` (la única que prueba la clave que hoy existe) este `match` se puso rojo sin
  // que el orden hubiera cambiado. Ahora se mide el orden, que es lo que dice el título del test.
  const fuentes = /leerPerfilInstagram\(u, \{ ws, fuentes: \[([^\]]*)\] \}\)/.exec(leer('app/api/crm/instagram-buscar/route.ts'));
  assert.ok(fuentes, 'el buscador tiene que leer el perfil por @ exacto con la función compartida');
  const orden = [...fuentes[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(orden.includes('meta-plataforma'), `${JSON.stringify(orden)} no pregunta a la Meta de la plataforma`);
  assert.ok(
    orden.indexOf('meta-plataforma') < orden.findIndex((f) => f.startsWith('apify')),
    `la Meta de la plataforma va ANTES que cualquier Apify (no gasta un crédito), y acá está ${JSON.stringify(orden)}`,
  );
  assert.match(leer('app/crm/new/InstagramBuscador.tsx'), /conexion === 'sin-instagram' && !encontrados\?\.length/, 'no dice «sin Instagram» arriba de la cuenta encontrada');
});
