// =============================================================================
// De dónde puede venir la foto de una persona (6/11/2026)
// =============================================================================
// El agujero: `usuarios.foto_url` lo escribe el cliente (`POST /api/perfil`, abierto a todos
// los roles a propósito) y lo dibuja Martín en la bandeja de tickets. Hasta el 6/11 el único
// filtro era `/^https:\/\//`, así que una foto `https://servidor-suyo/pixel.gif` le decía al
// cliente cuándo Martín abre la bandeja, desde qué IP y con qué navegador.
//
// Lo que fija este archivo son los CUATRO orígenes, y los dos que el arreglo obvio olvida:
// «sólo el storage propio y Google» deja afuera el EMOJI (un `data:`, ni siquiera https) y el
// ÍCONO de Iconify, que son avatares nuestros desde el 26/10.
//
// ⚠️ Probado ROMPIÉNDOLO, cuatro veces (12 casos):
//   (a) `fotoDePersonaSegura` devolviendo `v` siempre (el filtro de antes, cualquier https):
//       **7 pases y 5 FALLOS** — «la foto de un servidor del cliente NO se dibuja», «ni por
//       http», «ni con usuario en la URL», «un dominio que TERMINA en googleusercontent.com
//       no es Google» y «una foto de afuera cae al Gravatar».
//   (b) la lista sin Iconify (el arreglo «storage propio y Google» tal cual): **11 pases y
//       1 FALLO** — «el ícono del selector sigue siendo una foto válida». Ése es el que
//       avisa de que el arreglo obvio rompe el selector de identidad.
//   (c) `deDominio` como `host.endsWith(d)` (sin el punto): **11 pases y 1 FALLO** — «un
//       dominio que TERMINA en googleusercontent.com no es Google».
//   (d) el emoji devuelto tal cual (`return v`) en vez de redibujado: **11 pases y 1 FALLO**
//       — «el emoji se vuelve a dibujar, no se copia».

import test from 'node:test';
import assert from 'node:assert/strict';
import { fotoDePersonaSegura, fotoDeEmoji, emojiDeFoto } from '../lib/foto-perfil';
import { caraDeUsuario, urlGravatar } from '../lib/gravatar';

const STORAGE = 'proyecto123.supabase.co';
const segura = (u: string | null | undefined) => fotoDePersonaSegura(u, { storage: STORAGE });

// ── Lo que NO entra ───────────────────────────────────────────────────────────

test('la foto de un servidor del cliente NO se dibuja', () => {
  // El ataque entero: un pixel en un servidor suyo, y el log le dice cuándo lo miraron.
  assert.equal(segura('https://servidor-suyo.com/pixel.gif'), null);
  assert.equal(segura('https://cdn.cualquiera.net/a/b/foto.png'), null);
});

test('ni por http, ni con otro esquema', () => {
  assert.equal(segura('http://servidor-suyo.com/pixel.gif'), null);
  assert.equal(segura(`http://${STORAGE}/storage/v1/object/public/avatars/u1/a.png`), null);
  assert.equal(segura('javascript:alert(1)'), null);
  assert.equal(segura('data:text/html,<script>1</script>'), null);
});

test('ni con usuario en la URL, que la pide a otro lado', () => {
  // `https://api.iconify.design@servidor-suyo/x.gif` se lee como nuestro y la pide a servidor-suyo.
  assert.equal(segura('https://api.iconify.design@servidor-suyo.com/x.gif'), null);
  assert.equal(segura(`https://${STORAGE}:clave@servidor-suyo.com/x.gif`), null);
});

test('un dominio que TERMINA en googleusercontent.com no es Google', () => {
  // El bug clásico de un endsWith sin el punto.
  assert.equal(segura('https://malgoogleusercontent.com/pixel.gif'), null);
  assert.equal(segura('https://gravatar.com.servidor-suyo.net/pixel.gif'), null);
});

test('vacío, nada y basura son null (las iniciales)', () => {
  assert.equal(segura(''), null);
  assert.equal(segura('   '), null);
  assert.equal(segura(null), null);
  assert.equal(segura(undefined), null);
  assert.equal(segura('no soy una url'), null);
});

// ── Los cuatro orígenes que SÍ ────────────────────────────────────────────────

test('el storage propio pasa', () => {
  const u = `https://${STORAGE}/storage/v1/object/public/avatars/u1/avatar-123.png`;
  assert.equal(segura(u), u);
});

test('la foto del login con Google pasa', () => {
  const u = 'https://lh3.googleusercontent.com/a/ACg8ocK=s96-c';
  assert.equal(segura(u), u);
});

test('el ícono del selector sigue siendo una foto válida', () => {
  // ⚠️ El que rompe el arreglo «sólo el storage propio y Google»: desde el 26/10 un avatar
  // puede ser un ícono de Iconify (`fotoDeCambio`), y sin esto el selector deja de guardar.
  const u = 'https://api.iconify.design/lucide/rocket.svg?color=%232563EB&width=96&height=96';
  assert.equal(segura(u), u);
});

test('el emoji se vuelve a dibujar, no se copia', () => {
  // Es un `data:`, no un https: una lista de hosts sola lo deja afuera.
  const mio = fotoDeEmoji('🚀');
  assert.equal(segura(mio), mio);
  // Lo que entra en ese SVG no es lo que sale: se le lee el emoji y se redibuja.
  const ajeno = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" data-mako-emoji="1"><rect onload="fetch(1)"/><text>🚀</text></svg>',
  )}`;
  const salida = segura(ajeno);
  assert.equal(salida, mio);
  assert.ok(!salida?.includes('onload'), salida ?? 'null');
  assert.equal(emojiDeFoto(salida), '🚀');
});

test('el Gravatar que armamos nosotros pasa por su propio filtro', () => {
  // Si no estuviera en la lista, `caraDeUsuario` se comería su propio respaldo.
  const u = urlGravatar('ana@empresa.com');
  assert.equal(segura(u), u);
});

// ── La capa de arriba: el avatar de toda la app ───────────────────────────────

test('una foto de afuera cae al Gravatar, no se dibuja', () => {
  const cara = caraDeUsuario({ foto_url: 'https://servidor-suyo.com/pixel.gif', email: 'ana@empresa.com' });
  assert.ok(cara?.startsWith('https://www.gravatar.com/avatar/'), cara ?? 'null');
});

test('una foto de afuera sin email son las iniciales', () => {
  assert.equal(caraDeUsuario({ foto_url: 'https://servidor-suyo.com/pixel.gif', email: null }), null);
});
