// =============================================================================
// La configuración es POR LANDING, no por workspace
// =============================================================================
// Con una página, guardar todo a nivel workspace funciona. Con dos, todo lo que
// la pantalla afirma es mentira la mitad de las veces: el código puede estar al
// día en una y viejo en la otra, y Clarity conectado en una y no en la otra.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conLanding, landingDe, MAX_LANDINGS, parsearConfig, sinLanding, urlsDe, type LandingConfig } from '../lib/landing-config';

test('⚠️ MIGRA el formato viejo sin perder nada', () => {
  // Hasta hoy se guardaba una lista de strings. Una migración que exija convertir
  // la base primero deja a alguien sin sus páginas el día del despliegue — y acá
  // tolerar las dos formas cuesta una línea.
  assert.deepEqual(parsearConfig('["https://a.com/","https://b.com"]'),
    [{ url: 'https://a.com' }, { url: 'https://b.com' }]);
  // Y el formato nuevo, con su config propia.
  assert.deepEqual(parsearConfig('[{"url":"https://a.com","clarityProjectId":"ABC123"}]'),
    [{ url: 'https://a.com', clarityProjectId: 'abc123' }]);
  // Mezclados, que es como va a estar la base durante la transición.
  assert.equal(parsearConfig('["https://a.com",{"url":"https://b.com"}]').length, 2);
});

test('un JSON roto no deja al cliente sin páginas', () => {
  for (const v of [null, '', 'no es json', '{"no":"un array"}', '[1,2,3]', '[null]']) {
    assert.deepEqual(parsearConfig(v), [], `«${v}» tendría que dar []`);
  }
});

test('la URL es la identidad: normalizada y sin repetir', () => {
  assert.equal(parsearConfig('["https://A.com/","https://a.com"]').length, 1);
  assert.equal(landingDe([{ url: 'https://a.com' }], 'https://A.com/')?.url, 'https://a.com');
  assert.equal(landingDe([{ url: 'https://a.com' }], 'https://b.com'), null);
  assert.equal(landingDe([], null), null);
});

test('cada landing lleva SU proyecto de Clarity', () => {
  // ⚠️ Un proyecto de Clarity es de un sitio. Guardarlo por workspace hacía que
  // la segunda landing escribiera en el proyecto de la primera, mezclando las
  // grabaciones de dos negocios distintos en un mismo panel.
  let l: LandingConfig[] = [];
  l = conLanding(l, 'https://a.com', { clarityProjectId: 'aaa111' }) ?? l;
  l = conLanding(l, 'https://b.com') ?? l;
  assert.equal(landingDe(l, 'https://a.com')?.clarityProjectId, 'aaa111');
  assert.equal(landingDe(l, 'https://b.com')?.clarityProjectId, undefined);
  // Conectar la segunda no toca la primera.
  l = conLanding(l, 'https://b.com', { clarityProjectId: 'bbb222' }) ?? l;
  assert.equal(landingDe(l, 'https://a.com')?.clarityProjectId, 'aaa111');
  assert.equal(landingDe(l, 'https://b.com')?.clarityProjectId, 'bbb222');
});

// ⚠️ LA MISMA REGLA QUE YA MORDIÓ CON `esVsl` EN LOS VIDEOS: `undefined` es «no
// lo toques», no «borralo». Corregir la URL de una landing no puede
// desconectarle Clarity, porque renombrar no contesta esa pregunta.
test('corregir la URL NO desconecta Clarity', () => {
  const antes = [{ url: 'https://a.com', clarityProjectId: 'aaa111' }];
  const despues = conLanding(antes, 'https://nueva.com', {}, 'https://a.com');
  assert.equal(despues?.[0].url, 'https://nueva.com');
  assert.equal(despues?.[0].clarityProjectId, 'aaa111', 'renombrar no contesta «cuál es tu proyecto»');
  // Y desconectar explícitamente sí se puede.
  const sin = conLanding(antes, 'https://a.com', { clarityProjectId: '' });
  assert.equal(sin?.[0].clarityProjectId, undefined);
});

test('editar conserva la POSICIÓN', () => {
  // En un desplegable, que un renglón salte al final porque le corregiste una
  // letra es desconcertante.
  const antes = [{ url: 'https://a.com' }, { url: 'https://b.com' }, { url: 'https://c.com' }];
  const d = conLanding(antes, 'https://bb.com', {}, 'https://b.com');
  assert.deepEqual(urlsDe(d ?? []), ['https://a.com', 'https://bb.com', 'https://c.com']);
});

test('una URL inválida devuelve null, no una lista rota', () => {
  assert.equal(conLanding([], 'hola'), null);
});

test('borrar saca una y deja el resto', () => {
  const l = [{ url: 'https://a.com' }, { url: 'https://b.com' }];
  assert.deepEqual(urlsDe(sinLanding(l, 'https://A.com/')), ['https://b.com']);
  assert.deepEqual(urlsDe(sinLanding(l, 'no-existe')), ['https://a.com', 'https://b.com']);
});

test('hay tope', () => {
  let l: LandingConfig[] = [];
  for (let i = 0; i < MAX_LANDINGS + 5; i++) l = conLanding(l, `https://p${i}.com`) ?? l;
  assert.equal(l.length, MAX_LANDINGS);
});

test('lo que se guarda vuelve a leerse igual', () => {
  const orig = conLanding(conLanding([], 'https://a.com', { clarityProjectId: 'aaa111' }) ?? [], 'https://b.com') ?? [];
  assert.deepEqual(parsearConfig(JSON.stringify(orig)), orig);
});
