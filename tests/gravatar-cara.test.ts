// =============================================================================
// La cara de una persona: qué gana sobre qué
// =============================================================================
// «Si agrego el email, sería bueno que ya ponga la foto de perfil de ese email
// automáticamente en la card, y en todo caso que yo la pueda modificar»
// (27/09/2026). Eso son DOS cosas y el orden entre ellas es toda la regla: lo que
// la persona eligió gana sobre lo que su email trae, y sin ninguna de las dos no
// se dibuja una cara inventada.
//
// Vive en `lib/gravatar.ts`, que NO lleva `server-only` justamente para que este
// archivo lo pueda importar — mismo criterio que `lib/agencia-cartera.ts`.
//
// ⚠️ Probado ROMPIÉNDOLO, dos veces, de 8/8:
//   (a) dando vuelta la precedencia a `urlGravatar(email) || foto_url` —el orden
//       que se escribe solo cuando uno piensa «primero el automático»— quedan
//       **6 pases y 2 FALLOS**: «la foto elegida GANA…» y «una foto elegida gana
//       aunque el email también tenga».
//   (b) sacando el `d=404` de la URL (el default de Gravatar, que dibuja un
//       monigote del hash) quedan **7 pases y 1 FALLO**: «pide 404 y no un
//       monigote inventado». Ése es el que impide ponerle a alguien una cara que
//       no es suya, y se lee en pantalla como si lo fuera.

import test from 'node:test';
import assert from 'node:assert/strict';
import { hashGravatar, urlGravatar, caraDeUsuario } from '../lib/gravatar';

test('la foto elegida GANA sobre la del email', () => {
  const u = { foto_url: 'https://x.test/mia.png', email: 'ana@empresa.com' };
  assert.equal(caraDeUsuario(u), 'https://x.test/mia.png');
});

test('sin foto elegida, la del email', () => {
  const cara = caraDeUsuario({ foto_url: null, email: 'ana@empresa.com' });
  assert.ok(cara?.startsWith('https://www.gravatar.com/avatar/'), cara ?? 'null');
});

test('sin email no hay cara, y eso es null (las iniciales)', () => {
  // `null` es lo que hace que `Marca` dibuje las iniciales. Un string vacío ahí
  // sería un <img src=""> que el navegador resuelve contra la página actual.
  assert.equal(caraDeUsuario({ foto_url: null, email: null }), null);
  assert.equal(caraDeUsuario({}), null);
  assert.equal(caraDeUsuario({ foto_url: '   ', email: '   ' }), null);
});

test('una foto elegida gana aunque el email también tenga', () => {
  // El caso que la precedencia al revés rompe sin avisar: los dos existen.
  const u = { foto_url: 'https://x.test/mia.png', email: 'con-gravatar@empresa.com' };
  assert.equal(caraDeUsuario(u), 'https://x.test/mia.png');
  assert.notEqual(caraDeUsuario(u), urlGravatar(u.email));
});

test('el hash ignora mayúsculas y espacios: es el mismo email', () => {
  assert.equal(hashGravatar('  Ana@Empresa.COM '), hashGravatar('ana@empresa.com'));
});

test('dos emails distintos, dos hashes distintos', () => {
  assert.notEqual(hashGravatar('ana@empresa.com'), hashGravatar('luis@empresa.com'));
});

test('la URL pide 404 y no un monigote inventado', () => {
  // Sin `d=404` Gravatar dibuja una figura derivada del hash. Eso le pone una cara
  // a quien no tiene ninguna, y en pantalla se lee como que ES su foto — que es
  // peor que unas iniciales, no mejor.
  assert.match(urlGravatar('ana@empresa.com'), /[?&]d=404(&|$)/);
});

test('el tamaño viaja en la URL y se puede pedir otro', () => {
  assert.match(urlGravatar('ana@empresa.com'), /[?&]s=120(&|$)/);
  assert.match(urlGravatar('ana@empresa.com', 96), /[?&]s=96(&|$)/);
  assert.match(caraDeUsuario({ email: 'ana@empresa.com' }, 96) ?? '', /[?&]s=96(&|$)/);
});
