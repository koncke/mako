// =============================================================================
// La tarjeta de Apify dice el tope REAL de Competitors Spy (18/11/2026, F78)
// =============================================================================
// La slide «Corre con tu cuenta» de `apify-instagram` (lib/servicio-slides.ts), que dibuja el carrusel del modal
// de /integraciones, decía «MaKo no pasa de 40 lecturas por día» escrito a mano. El tope de Spy
// (`TOPE_LECTURAS_SPY_POR_DIA`, lib/instagram-perfil.ts) subió de 40 a 150 el 4/11/2026 y la slide siguió
// prometiendo cuatro veces menos. El 6/11 se arregló la nota del campo (lib/metodo-catalogo.ts) y no ésta.
//
// La regla: un número que la pantalla le promete al cliente sale de la constante que lo hace cumplir.
// El test EJECUTA el catálogo: importa SLIDES y la constante, y compara lo que se dibuja.
//
// Probado rompiéndolo (18/11/2026): con la slide vuelta a «MaKo no pasa de 40 lecturas por día» escrito a mano,
// base 2/0 → 0/2 (los dos casos caen: no dice el tope de Spy, y promete el del buscador del CRM). Se compara contra
// el valor importado y no contra «150»: el día que el tope cambie, el test sigue a la constante.
//
// Correr: node --import tsx --test tests/apify-slide-tope.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLIDES } from '../lib/servicio-slides';
import { APIFY_TOPE_POR_DIA, TOPE_LECTURAS_SPY_POR_DIA } from '../lib/instagram-perfil';

const slidesApify = SLIDES['apify-instagram'] ?? [];

test('la slide de Apify dice el tope de lecturas de Competitors Spy, el que hace cumplir el código', () => {
  assert.ok(slidesApify.length >= 2, `la tarjeta de Apify tiene ${slidesApify.length} slides: el import quedó viejo`);
  const conTope = slidesApify.filter((s) => /por d[ií]a/.test(s.d));
  assert.equal(conTope.length, 1, 'una sola slide habla del tope por día');
  const numeros = (conTope[0].d.match(/\d+/g) ?? []).map(Number);
  assert.deepEqual(numeros, [TOPE_LECTURAS_SPY_POR_DIA], `la slide de Apify no dice el tope de Spy (${TOPE_LECTURAS_SPY_POR_DIA}): «${conTope[0].d}»`);
});

test('no le promete el tope de la OTRA lectura (la del buscador del alta del CRM) ni se lo atribuye a «MaKo» entero', () => {
  // Si algún día los dos topes vuelven a coincidir, este caso no mide nada: lo dice el mensaje en vez de dar un verde mudo.
  assert.notEqual(APIFY_TOPE_POR_DIA, TOPE_LECTURAS_SPY_POR_DIA, 'los dos topes coinciden: este caso no distingue nada');
  const textos = slidesApify.map((s) => s.d).join(' ');
  assert.ok(!new RegExp(`(?<!\\d)${APIFY_TOPE_POR_DIA}(?!\\d)`).test(textos), 'la slide promete el tope del buscador del CRM');
  // La misma clave la usa también el buscador de @ del alta del CRM con su propio tope: «MaKo no pasa de N» es falso.
  assert.ok(!/MaKo no pasa de/.test(textos), 'la slide le atribuye a MaKo entero el tope de Spy');
});
