// Inspiración: qué links de Instagram trae un mensaje y si «pide algo» con ellos (lib/inspiracion/links.ts, 19/11/2026).
// Los casos salen de los 76 links que Martín mandó el 19/11 (C:/dev/inspiracion/links-martin-19-11.txt): posts, reels, cuentas
// enteras y uno repetido.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { linksDeInstagram, paraInspiracion, pideAlgo, sinLinksDeInstagram } from '../lib/inspiracion/links';
import { clasificarIntencion } from '../lib/mako-intencion';

test('encuentra todos los links del texto, en orden, aunque no empiece con uno', () => {
  const t = 'mirá estos https://www.instagram.com/reel/DfEg2aWA4uw/ y https://www.instagram.com/p/DfmYi-fj1kv/?igsh=abc123';
  assert.deepEqual(linksDeInstagram(t), [
    { ref: 'DfEg2aWA4uw', url: 'https://www.instagram.com/reel/DfEg2aWA4uw/', tipo: 'reel' },
    { ref: 'DfmYi-fj1kv', url: 'https://www.instagram.com/p/DfmYi-fj1kv/', tipo: 'post' },
  ]);
});

test('el repetido cuenta una vez (el 74 de Martín repetía el 64)', () => {
  const t = 'https://www.instagram.com/reel/DegSH0wymBj/\nhttps://www.instagram.com/reel/DegSH0wymBj/';
  assert.equal(linksDeInstagram(t).length, 1);
});

test('reels, tv y el link con @usuario delante son videos; /p/ es un post', () => {
  assert.equal(linksDeInstagram('instagram.com/tv/AbCdEf123/')[0].tipo, 'reel');
  assert.equal(linksDeInstagram('https://instagram.com/reels/AbCdEf123')[0].tipo, 'reel');
  assert.deepEqual(linksDeInstagram('https://www.instagram.com/paralisisaldormir/reel/Dfcuww4N5MG/'), [
    { ref: 'Dfcuww4N5MG', url: 'https://www.instagram.com/reel/Dfcuww4N5MG/', tipo: 'reel' },
  ]);
});

test('una cuenta entera es una cuenta; las rutas de Instagram y las historias no', () => {
  assert.deepEqual(linksDeInstagram('https://www.instagram.com/paralisisaldormir'), [
    { ref: '@paralisisaldormir', url: 'https://www.instagram.com/paralisisaldormir/', tipo: 'cuenta' },
  ]);
  assert.deepEqual(linksDeInstagram('https://www.instagram.com/marvix.motion/ buenísimo').map((l) => l.ref), ['@marvix.motion']);
  assert.deepEqual(linksDeInstagram('https://www.instagram.com/explore/'), []);
  assert.deepEqual(linksDeInstagram('https://www.instagram.com/stories/alguien/3412341234/'), []);
  assert.deepEqual(linksDeInstagram('https://www.instagram.com/p/DfmYi-fj1kv/').map((l) => l.tipo), ['post']);
});

test('sin dominio no hay link (un shortcode suelto puede ser cualquier palabra)', () => {
  assert.deepEqual(linksDeInstagram('DfmYi-fj1kv'), []);
  assert.deepEqual(linksDeInstagram('https://www.youtube.com/shorts/abc'), []);
});

test('lo que queda sin los links es la nota', () => {
  assert.equal(sinLinksDeInstagram('para la serie de ventas https://www.instagram.com/reel/DfEg2aWA4uw/?igsh=x'), 'para la serie de ventas');
});

test('un comentario no pide nada; un pedido o una pregunta sí', () => {
  for (const t of ['', 'mirá este', 'buenísimo', 'para la serie de ventas', 'otro para carruseles', 'inspo']) assert.equal(pideAlgo(t), false, t);
  for (const t of ['replicá este reel', 'hacé un carrusel como este', 'transcribime esto', '¿qué opinás?', 'qué te parece', 'escribime un guion así', 'cómo lo hago']) {
    assert.equal(pideAlgo(t), true, t);
  }
});

test('paraInspiracion: guarda con su nota, o deja pasar el pedido al turno de siempre', () => {
  const r = paraInspiracion('para la serie 3 https://www.instagram.com/reel/DfEg2aWA4uw/');
  assert.equal(r?.links.length, 1);
  assert.equal(r?.nota, 'para la serie 3');
  assert.equal(paraInspiracion('replicá este https://www.instagram.com/reel/DfEg2aWA4uw/'), null);
  assert.equal(paraInspiracion('hola, ¿cómo va?'), null);
});

// ── El enganche en el turno de WhatsApp (lib/mako-doer-in.ts) ──────────────────────────────────────────────────────
// El 19/11 el link 77 de Martín llegó por WhatsApp y terminó en el ticket #117: un link sin pedido lo agarra la regla 6
// (`capturar`, al Plan) o el clasificador con IA. Por eso Inspiración corta ANTES de los dos, y sólo para quien administra.

test('sin el corte, un link pelado se iría a capturar (al Plan): por eso corta antes', () => {
  assert.equal(clasificarIntencion('https://www.instagram.com/reel/Df2yJ3iB4Oq/').intencion, 'capturar');
});

test('el corte está antes de la memoria y del clasificador del turno, y no corre para el equipo ni un invitado', () => {
  const doer = readFileSync(new URL('../lib/mako-doer-in.ts', import.meta.url), 'utf8');
  const corte = doer.indexOf('paraInspiracion(sinPrefijoDeLote(texto))');
  assert.ok(corte > 0, 'falta el corte de Inspiración en procesarDoer');
  assert.ok(corte < doer.indexOf('await clasificarConIA({'), 'tiene que ir antes del clasificador con IA');
  assert.ok(corte < doer.indexOf('const memoria = hayInvitado'), 'tiene que ir antes de leer la memoria');
  assert.match(doer.slice(corte - 200, corte), /!hayInvitado && veInspiracion\(\{ ws: wsData \}\)/);
});
