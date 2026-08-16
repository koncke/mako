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
import { conOculta, conPagina, esPreviewDeEditor, MAX_OCULTAS, MAX_PAGINAS, mismaPagina, normalizarUrl, parsearOcultas, parsearPaginas, sinPagina } from '../lib/landing-paginas';

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

// ⚠️ EL BUG QUE ESTE TEST CUIDA: los botones de editar y borrar se gateaban con
// `paginas.includes(url)` — string crudo contra lista normalizada. Al guardar
// «tu-pagina.com» la lista pasaba a tener «https://tu-pagina.com», el includes
// daba false y los botones DESAPARECÍAN justo después de guardar.
test('mismaPagina compara normalizado, que es como se guardan', () => {
  assert.ok(mismaPagina('tu-pagina.com', 'https://tu-pagina.com'), 'sin esquema es la misma');
  assert.ok(mismaPagina('https://A.com/', 'https://a.com'), 'ni la barra final ni las mayúsculas la cambian');
  assert.ok(mismaPagina('https://a.com/#registro', 'https://a.com'), 'el hash tampoco');
  assert.ok(!mismaPagina('https://a.com', 'https://b.com'));
  // Sin esto, un `includes` de substring daba por iguales una página y otra que
  // la contiene como prefijo — que es EXACTAMENTE la forma de los previews de
  // Netlify: «6a7f2b--que-es-lidermente.netlify.app» contiene a la real.
  assert.ok(!mismaPagina('https://que-es-lidermente.netlify.app', 'https://6a7f2b--que-es-lidermente.netlify.app'));
  for (const v of [null, undefined, '', 'hola']) assert.ok(!mismaPagina(v, 'https://a.com'), `«${v}» no es nadie`);
});

test('esconder una detectada la saca de la lista y no la repite', () => {
  const o = conOculta(conOculta([], 'https://a.com'), 'https://A.com/');
  assert.deepEqual(o, ['https://a.com'], 'la misma dos veces sigue siendo una');
  // La más nueva primero: si se llena el tope, lo que se pierde es lo más viejo.
  assert.deepEqual(conOculta(['https://a.com'], 'https://b.com'), ['https://b.com', 'https://a.com']);
  assert.deepEqual(conOculta([], 'hola'), [], 'una URL inválida no ensucia la lista');
});

test('las escondidas toleran un JSON roto y tienen su propio tope', () => {
  assert.deepEqual(parsearOcultas('no es json'), []);
  let l: string[] = [];
  for (let i = 0; i < MAX_OCULTAS + 5; i++) l = conOculta(l, `https://p${i}.com`);
  assert.equal(l.length, MAX_OCULTAS);
  // Más alto que el de guardadas a propósito: cada deploy preview es una URL
  // nueva, y son justo las que uno quiere sacar de encima.
  assert.ok(MAX_OCULTAS > MAX_PAGINAS);
});

// =============================================================================
// PREVIEWS DE DEPLOY — siete renglones de la misma página
// =============================================================================
// El caso real: Netlify le da a CADA deploy una URL inmutable con el id adelante,
// y el snippet mide en todas. Una clienta que publicaba varias veces por día veía
// siete renglones idénticos en el desplegable, y su retención repartida entre los
// siete sin que nada lo dijera. El síntoma («se guardan un montón de URLs iguales
// con números adelante») no apuntaba a la deduplicación, que era donde estaba.

test('un preview de deploy de Netlify es la MISMA página', () => {
  const real = 'https://que-es-lidermente.netlify.app';
  for (const id of ['6a7f350eb436ad1a599d0dcb', '6a7f2bbe8653f3b1e806517f', '6a7e28766cf06853a0246d16']) {
    assert.equal(normalizarUrl(`https://${id}--que-es-lidermente.netlify.app/`), real, `el deploy ${id} es la misma página`);
  }
  // Y por lo tanto colapsan a UNA sola entrada, que es el punto.
  const todas = ['6a7f350eb436ad1a599d0dcb', '6a7f2bbe8653f3b1e806517f', '6a7e28766cf06853a0246d16']
    .map((id) => normalizarUrl(`https://${id}--que-es-lidermente.netlify.app`));
  assert.equal(new Set(todas).size, 1);
  assert.deepEqual(parsearPaginas(JSON.stringify([...todas, real])), [real], 'la lista guardada tampoco los repite');
});

test('un deploy POR RAMA no se colapsa: es otro lugar', () => {
  // `staging--sitio` y `preview--sitio` son entornos distintos y fundirlos
  // mezclaría la medición de producción con la de pruebas. Solo se colapsa lo
  // que es inconfundiblemente un id de deploy: 20+ caracteres hexadecimales.
  for (const rama of ['staging', 'preview', 'main', 'feature-nueva', 'deadbeef']) {
    assert.equal(
      normalizarUrl(`https://${rama}--sitio.netlify.app`),
      `https://${rama}--sitio.netlify.app`,
      `«${rama}» no es un id de deploy`,
    );
  }
  // 19 hex: por debajo del umbral, no se toca. El de Netlify tiene 24.
  assert.ok(normalizarUrl('https://0123456789abcdef012--sitio.com')?.includes('0123456789abcdef012--'));
  assert.ok(!normalizarUrl('https://0123456789abcdef0123--sitio.com')?.includes('--'));
});

test('lo que NO es un preview sigue intacto', () => {
  // La regla no puede volverse glotona: un dominio propio no tiene por qué
  // perder nada por parecerse de lejos.
  assert.equal(normalizarUrl('https://hola-mako.com/vsl'), 'https://hola-mako.com/vsl');
  assert.equal(normalizarUrl('https://sitio.netlify.app/gracias'), 'https://sitio.netlify.app/gracias');
  assert.equal(normalizarUrl('https://mi--sitio.com'), 'https://mi--sitio.com', 'dos guiones no son un preview');
});

// =============================================================================
// PREVIEWS DEL EDITOR — se EXCLUYEN, no se colapsan
// =============================================================================
// ⚠️ LA DISTINCIÓN QUE ESTOS TESTS CUIDAN, y que no es obvia: un preview de
// deploy de Netlify es el sitio REAL congelado en una versión, así que colapsarlo
// suma tráfico de verdad. El preview del EDITOR de Lovable es el iframe donde el
// dueño está construyendo la página: colapsarlo metería sus sesiones de
// desarrollo adentro de la tasa de conversión de su landing.
//
// Medido el 15/08/2026 en el ws 1, en UN día y para una sola landing.

test('un preview del editor de Lovable no es una landing', () => {
  for (const u of [
    'https://id-preview--cad30c6f-a943-4b41-82d7-a04fc884799f.lovable.app/?__lovable_sha=abc',
    'https://id-preview-734641ee--cad30c6f-a943-4b41-82d7-a04fc884799f.lovable.app/?forceHideBadge=true',
    'https://cad30c6f-a943-4b41-82d7-a04fc884799f.lovableproject.com/?__lovable_load_id=xyz',
  ]) {
    assert.ok(esPreviewDeEditor(u), `${u} es el editor, no la página publicada`);
  }
  // Sin esquema también: es lo que devuelve una lista guardada a mano.
  assert.ok(esPreviewDeEditor('id-preview--abc.lovable.app'));
});

test('una landing PUBLICADA en Lovable sigue siendo una landing', () => {
  // ⚠️ Un cliente sin dominio propio publica de verdad en `<proyecto>.lovable.app`.
  // Excluir todo Lovable lo dejaría sin una sola página que elegir en el paso 1.
  for (const u of [
    'https://multiplicatusresultados.com',
    'https://mi-proyecto.lovable.app',
    'https://mi-proyecto.lovable.app/gracias',
    'https://que-es-lidermente.netlify.app',
    'https://6a7f350eb436ad1a599d0dcb--que-es-lidermente.netlify.app',
  ]) {
    assert.ok(!esPreviewDeEditor(u), `${u} es una página de verdad`);
  }
  for (const v of ['', 'hola', 'no-tiene-punto']) {
    assert.ok(!esPreviewDeEditor(v), `«${v}» no es nadie, y eso no es un preview`);
  }
});

test('los previews del editor NO se funden con la landing de producción', () => {
  // El otro lado de la decisión: como no se colapsan, sus visitas quedan bajo su
  // propio host en vez de sumarse a las del negocio. Si esto empezara a dar
  // iguales, la conversión de la landing pasaría a incluir el tráfico de edición.
  const real = 'https://multiplicatusresultados.com';
  const editor = 'https://id-preview--cad30c6f-a943-4b41-82d7-a04fc884799f.lovable.app';
  assert.notEqual(normalizarUrl(editor), normalizarUrl(real));
  assert.ok(!mismaPagina(editor, real));
});

test('los parámetros del editor son de la VISITA, no de la página', () => {
  // Cambian en cada recarga del editor: sin sacarlos, una tarde de trabajo deja
  // veinte renglones que son el mismo lugar. Es el mismo caso que `mko_test`.
  const canon = 'https://id-preview--abc.lovable.app';
  for (const q of ['?__lovable_sha=9f2c1a', '?__lovable_load_id=6b1e', '?forceHideBadge=true', '?__lovable_sha=otro&forceHideBadge=true']) {
    assert.equal(normalizarUrl(`${canon}/${q}`), canon, `«${q}» no identifica una página distinta`);
  }
  // Y en una landing publicada valen igual: el badge se puede esconder en cualquiera.
  assert.equal(normalizarUrl('https://mi-proyecto.lovable.app/?forceHideBadge=true'), 'https://mi-proyecto.lovable.app');
  // Lo que SÍ cambia el contenido se conserva, como siempre.
  assert.equal(normalizarUrl('https://mi-proyecto.lovable.app/?plan=pro'), 'https://mi-proyecto.lovable.app?plan=pro');
});
