// =============================================================================
// De qué anuncio vino un lead de landing
// =============================================================================
// MEDIDO EN PRODUCCIÓN el 27/09/2026, y es lo que justifica todo este archivo:
//
//   ws 13 · Código Inmobiliario ·   21 leads · anuncio 0 · campaña 0 · UTM 0
//                                   21 de 21 AGENDADOS sin un solo dato de origen
//   ws  1 · Mauricio            · 1000 leads · anuncio 951 · campaña 995
//
// La diferencia no es el CRM — es por dónde entra el lead. Los de Mauricio vienen
// del instant form de Meta, que entrega el ad_id. Los de Código Inmobiliario
// vienen de un FORMULARIO DE LANDING, y ese camino no llevaba nada: el snippet
// mandaba `nombre/email/telefono/empresa/pagina` y la ruta leía `body.utm_*`, que
// nunca existían. Cuatro campos escritos en el server y jamás alimentados.
//
// Probado rompiéndolo (6 pases y 0 fallos con el código como está):
//   · `conAtribucion` deja de mirar la URL          → 4 / 2
//   · la URL le gana al body                        → 5 / 1
//   · la ruta vuelve a leer `body.utm_*` directo    → 5 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atribucionDeUrl, conAtribucion, hayAtribucion, ATRIBUCION_VACIA } from '../lib/atribucion-url';

const leer = (p: string) => readFileSync(join(import.meta.dirname, p), 'utf8')
  .replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('los parámetros se leen de la URL de aterrizaje', () => {
  const a = atribucionDeUrl('https://landing.com/oferta?utm_source=fb&utm_campaign=Enero&utm_content=video3&fbclid=ABC123');
  assert.equal(a.utm_source, 'fb');
  assert.equal(a.utm_campaign, 'Enero');
  assert.equal(a.utm_content, 'video3');
  assert.equal(a.fbclid, 'ABC123');
});

test('una URL rota no puede tumbar el alta de un lead', () => {
  // El lead vale mucho más que saber de dónde vino: si la atribución no se puede
  // leer, se pierde la atribución — nunca la persona.
  for (const basura of [null, undefined, '', 'no-soy-una-url', 'javascript:alert(1)']) {
    assert.deepEqual(atribucionDeUrl(basura), ATRIBUCION_VACIA, `«${basura}» tendría que dar vacío, no tirar`);
  }
  // Y un querystring suelto igual se lee: el snippet manda `location.href`, pero
  // un cliente puede mandar otra cosa.
  assert.equal(atribucionDeUrl('?utm_campaign=suelto').utm_campaign, 'suelto');
});

test('lo que manda el cliente GANA: la URL sólo rellena huecos', () => {
  // ⚠️ No es un detalle. El snippet captura los parámetros en la PRIMERA página;
  // la URL del opt-in puede ser la de un paso posterior, donde ya se perdieron.
  // Si la URL pisara al body, un formulario en la página 3 borraría el origen.
  const a = conAtribucion(
    { utm_campaign: 'la-que-capturo-el-snippet', utm_source: null },
    'https://landing.com/gracias?utm_campaign=otra&utm_source=ig',
  );
  assert.equal(a.utm_campaign, 'la-que-capturo-el-snippet', 'el body manda');
  assert.equal(a.utm_source, 'ig', 'y el hueco lo llena la URL');
});

test('un snippet VIEJO igual recupera el origen', () => {
  // Es la mitad que no depende de nadie: el snippet vive pegado en la página del
  // cliente y cambiarlo obliga a que cada uno vuelva a copiar el código. `pagina`
  // viaja desde la v1, así que leer los UTM de ahí le devuelve el origen a todos
  // los que ya están instalados, hoy.
  const a = conAtribucion({}, 'https://codigoinmobiliario.com/?utm_source=fb&utm_campaign=Remarketing&utm_content=carrusel-2');
  assert.ok(hayAtribucion(a), 'sin un solo campo en el body, la URL alcanza');
  assert.equal(a.utm_campaign, 'Remarketing');
  assert.equal(a.utm_content, 'carrusel-2');
});

test('la ruta del opt-in usa la atribución resuelta, no el body crudo', () => {
  const r = leer('../app/api/track/optin/route.ts');
  assert.ok(/const atrib = conAtribucion\(/.test(r), 'se resuelve una vez');
  assert.ok(!/utm_source: txt\(body\.utm_source\)/.test(r), 'ya no se lee el body crudo: nunca traía nada');
  // Y en los DOS caminos: el alta directa y la propuesta.
  assert.equal((r.match(/utm_source: atrib\.utm_source/g) ?? []).length, 2, 'el alta directa y la propuesta');
});

test('el snippet manda el origen y lo que la persona contestó', () => {
  const t = readFileSync(join(import.meta.dirname, '../lib/landing-token.ts'), 'utf8');
  assert.ok(/utm_source: ORIGEN\.utm_source/.test(t), 'el origen viaja explícito');
  assert.ok(/respuestas: d\.respuestas \|\| null/.test(t), 'y lo que completó en el formulario');
  // ⚠️ Se capturan al ATERRIZAR, no al enviar: el formulario puede estar en otra
  // página y ahí los parámetros ya no están.
  assert.ok(/sessionStorage\.setItem\(CLAVE/.test(t), 'se guardan al aterrizar');
  assert.ok(!/localStorage\.setItem\(CLAVE/.test(t), 'sessionStorage: una visita es una sesión, no para siempre');
  // Y la versión subió, que es lo único que le avisa al cliente que repegue.
  assert.ok(/SNIPPET_VERSION = 17/.test(t), 'la versión sube con el cambio');
  assert.ok(/^\s*17: '/m.test(t), 'y su novedad, que es lo que el cliente lee');
});
