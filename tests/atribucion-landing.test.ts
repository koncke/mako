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
//
// Y la segunda tanda del 27/09, con el arreglo puesto 9 pasan y 0 fallan:
//   · la URL vuelve a pasar por `txt(300)`          → 8 / 1
//   · `adIdDeLead` vuelve a aceptar 6 dígitos       → 8 / 1
//   · se saca el `case 'landing'` de la ficha       → 8 / 1
//
// ⚠️ La segunda de esas tres NO la cazó el primer intento de rotura, y no porque el
// test fallara: el `perl` no matcheó la línea y el archivo quedó intacto. Una rotura
// que no toca el código no prueba nada — se comprueba con un `grep` de la línea rota.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atribucionDeUrl, conAtribucion, hayAtribucion, ATRIBUCION_VACIA } from '../lib/atribucion-url';
import { adIdDeLead } from '../lib/atribucion-url';

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

test('⚠️ la URL no pasa por el saneador de CAMPOS: el tope de 300 se comía el ad_id', () => {
  // Meta arma la URL de destino con el `fbclid` PRIMERO (150-250 caracteres) y los
  // `utm_*` DESPUÉS, así que `utm_content=` —donde viaja el id del anuncio— arranca
  // alrededor del carácter 298 y su valor de 18 dígitos queda entero afuera de un corte
  // de 300. Medido sobre las 822 visitas de un cliente que traen `utm_content`: 427 lo
  // perdían completo (52%), y a nivel lead 8 de 18.
  //
  // Lo delataba que el MISMO dato estuviera entero en `landing_visits`, que guarda la URL
  // con tope 500: una URL mutilada por una ruta y completa por la otra.
  const r = readFileSync(join(import.meta.dirname, '../app/api/track/optin/route.ts'), 'utf8');
  assert.ok(
    /const atrib = conAtribucion\([^)]*urlTxt\(body\.pagina\)\)/.test(r),
    'la URL tiene que pasar por un tope propio de URL, no por el de un campo de formulario',
  );
  // Y ese tope tiene que superar la URL más larga medida (394 caracteres).
  const tope = Number(/const urlTxt[\s\S]{0,240}?slice\(0, (\d+)\)/.exec(r)?.[1]);
  assert.ok(tope >= 500, `el tope de la URL es ${tope}: la más larga medida en producción es 394`);
});

test('⚠️ un ad_id MUTILADO no puede hacerse pasar por un anuncio', () => {
  // Es la mitad peor del bug de arriba: cuando el corte caía ADENTRO del número, el id
  // truncado se guardaba y `adIdDeLead` lo aceptaba, así que el deep-link llevaba a un
  // anuncio que existe y no es el de este lead. Un null dice «no sé»; esto afirma.
  const mapa = { '120251610513950661': 'Agentes 2 | 15/09' };
  assert.equal(adIdDeLead(null, '120251610513950661', mapa), '120251610513950661', 'el id entero pasa');
  assert.equal(adIdDeLead(null, '1274447207835802', mapa), '1274447207835802', '16 dígitos también es un id de Meta');
  // El mismo id cortado en la posición donde caía el tope de 300.
  assert.equal(adIdDeLead(null, '1202516105', mapa), null, 'un id de 10 dígitos no es un id corto: es uno roto');
  assert.equal(adIdDeLead(null, '123456', mapa), null, 'seis dígitos tampoco');
  // Y lo que NO es un número sigue resolviéndose por nombre, que es el otro camino.
  assert.equal(adIdDeLead(null, 'Agentes 2 | 15/09', mapa), '120251610513950661');
  // El campo propio siempre gana: si Meta ya lo dio, no se adivina.
  assert.equal(adIdDeLead('999', 'Agentes 2 | 15/09', mapa), '999');
});

test('⚠️ cada valor de `origen_lead` tiene su renglón: el default no AFIRMA que llegó solo', () => {
  // «Todos me aparecen como orgánico manual y todos estos vinieron del VSL funnel» —
  // y el dato estaba bien guardado desde siempre. `labelOrigen` no tenía case para
  // 'landing', así que el `default` contestaba por él. Medido el 27/09/2026: 27 leads en
  // todo el producto, 19 de un solo cliente (19 de sus 21).
  //
  // Y ya había pasado con Cal.com, con el comentario puesto al lado. Una lista de cases
  // que crece cuando alguien se queja es una lista que va a volver a fallar: lo que el
  // test fija es que TODO valor que el opt-in escribe tenga el suyo.
  const card = readFileSync(join(import.meta.dirname, '../app/crm/lead-view/OrigenCard.tsx'), 'utf8');
  const cases = new Set([...card.matchAll(/case '([a-z_]+)':/g)].map((m) => m[1]));
  const ruta = readFileSync(join(import.meta.dirname, '../app/api/track/optin/route.ts'), 'utf8');
  const escritos = new Set([...ruta.matchAll(/origen_lead: '([a-z_]+)'/g)].map((m) => m[1]));
  assert.ok(escritos.size > 0, 'no se pudo leer qué origen escribe el opt-in');
  for (const o of escritos) {
    assert.ok(cases.has(o), `el opt-in escribe origen_lead '${o}' y la ficha no tiene su case: ` +
      'se va a dibujar «Orgánico / manual» sobre un lead que llegó por un canal');
  }
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
  //
  // ⚠️ AL MENOS 17, NO EXACTAMENTE 17. Clavarlo en el número de hoy hace que el
  // test falle en el próximo cambio del snippet que no tenga nada que ver con
  // esto — pasó al subir a la v18 — y lo que se termina 'arreglando' es el
  // número del test. Lo que hay que fijar es que ESTA versión ya haya salido.
  const version = Number(/SNIPPET_VERSION = (\d+)/.exec(t)?.[1]);
  assert.ok(version >= 17, `la versión del snippet tiene que ser 17 o más, es ${version}`);
  assert.ok(/^\s*17: '/m.test(t), 'y su novedad, que es lo que el cliente lee');
});
