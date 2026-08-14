// =============================================================================
// Las páginas guardadas del workspace: normalizar, editar y borrar
// =============================================================================
// Antes la lista salía de `landing_visits.landing_url` — las páginas que se
// habían OBSERVADO, no las que el negocio dice tener. No se podía corregir una
// URL mal escrita, ni borrar una dada de baja, ni agregar la que todavía no
// recibió una visita, que es justo la que uno quiere probar.
//
// Lo que se puede equivocar acá es la NORMALIZACIÓN: dos URLs que son la misma
// escritas distinto duplican el renglón, y una edición que no reemplaza deja las
// dos. Por eso vive sin `server-only`.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conPagina, MAX_PAGINAS, normalizarUrl, parsearPaginas, sinPagina } from '../lib/landing-paginas';

test('la misma página escrita distinto es UNA sola', () => {
  const canon = 'https://lidermente.com/clase';
  for (const v of ['https://lidermente.com/clase/', 'https://LiderMente.com/clase', 'https://lidermente.com/clase#top']) {
    assert.equal(normalizarUrl(v), canon, `${v} tendría que normalizar igual`);
  }
  // Sin esquema también: «tu-pagina.com» es lo que la gente escribe.
  assert.equal(normalizarUrl('lidermente.com'), 'https://lidermente.com');
  // El PATH no se baja a minúsculas: hay servidores que lo distinguen.
  assert.equal(normalizarUrl('https://x.com/Clase'), 'https://x.com/Clase');
});

test('lo que no es una página no entra', () => {
  for (const v of ['', '   ', 'hola', 'no-tiene-punto', 'javascript:alert(1)']) {
    assert.equal(normalizarUrl(v), null, `«${v}» no es una página`);
  }
});

test('editar REEMPLAZA y conserva la posición', () => {
  const antes = ['https://a.com', 'https://b.com', 'https://c.com'];
  const despues = conPagina(antes, 'https://bb.com', 'https://b.com');
  // Sin `anterior`, corregir una URL dejaba las dos en la lista.
  assert.deepEqual(despues, ['https://a.com', 'https://bb.com', 'https://c.com']);
  // Y no salta al final: en un desplegable, que un renglón se mueva porque le
  // corregiste una letra es desconcertante.
  assert.equal(despues?.[1], 'https://bb.com');
});

test('agregar la misma dos veces no la duplica', () => {
  const l = conPagina(['https://a.com'], 'https://a.com/');
  assert.deepEqual(l, ['https://a.com']);
});

test('una URL inválida devuelve null, no una lista rota', () => {
  // El caller decide qué decirle a la persona; acá no se inventa un valor para
  // no fallar, que es como se cuelan las entradas basura.
  assert.equal(conPagina(['https://a.com'], 'hola'), null);
});

test('borrar tolera que la escribas distinto', () => {
  assert.deepEqual(sinPagina(['https://a.com', 'https://b.com'], 'https://A.com/'), ['https://b.com']);
});

test('un JSON roto no rompe la pantalla: devuelve lista vacía', () => {
  for (const v of [null, '', 'no es json', '{"no":"un array"}', '[1,2,3]']) {
    assert.deepEqual(parsearPaginas(v), [], `«${v}» tendría que dar []`);
  }
  assert.deepEqual(parsearPaginas('["https://a.com/","https://a.com"]'), ['https://a.com'], 'y saneando de paso');
});

test('la lista tiene tope: un desplegable con 50 páginas no es un desplegable', () => {
  let l: string[] = [];
  for (let i = 0; i < MAX_PAGINAS + 5; i++) l = conPagina(l, `https://p${i}.com`) ?? l;
  assert.equal(l.length, MAX_PAGINAS);
});
