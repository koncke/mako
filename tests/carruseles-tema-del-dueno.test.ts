// El TEMA que pide el dueño manda en la réplica de un carrusel (19/11/2026).
//
// La prueba de hacer DENTRO de MaKo los carruseles de ventas que Claude hizo a mano (docs/hallazgos-carruseles.md): con el carrusel
// de @lifeofarjav («Claude + Hormozi = 100M Business») y el pedido «Tema: chatear con Alex Hormozi como tu coach… Voz: «Encontré
// una app que…»… CTA: Comenta “HORMOZI”», el diseño salió fiel y el texto perdió el tema: «MaKo + tu negocio = resultados en
// escala» y los pasos de la referencia traducidos, sin Hormozi. El pedido iba al FINAL del prompt, cortado en 300 letras, y dos
// reglas de arriba decían lo contrario («contar LO MISMO»; «lo que es del original, su gurú, se cambia o se saca»).
//
// Esto fija:
//   1. con pedido, el tema va ARRIBA (antes de las reglas), entero hasta 600 letras, y dice que manda;
//   2. la regla de «lo que es del original se saca» deja pasar lo que el dueño nombró;
//   3. sin pedido, el prompt es el de siempre (sin bloque de tema, «contar LO MISMO»);
//   4. el segundo pedido (los recortes) también recibe el tema;
//   5. lo que manda el navegador llega hasta 600 letras;
//   6. la palabra que el dueño pide comentar la pone el código (la IA puso «MAKO» con el tema pidiendo «HORMOZI»);
//   7. el @ del marco es el de la cuenta de Instagram conectada por Zernio (sin ella, sin @, como siempre);
//   8. un renglón largo que el segundo pedido «adaptó» a una palabra no pisa el texto bueno de la IA principal.
//
// Correr: node --import tsx --test tests/carruseles-tema-del-dueno.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOPE_TEMA, bloqueDelTema, conLaPalabra, leerReplica, palabraDelTema, promptDeCompletar, promptDeReplica, queVaEnLosRenglones, type Replica } from '../lib/carruseles/replica';
import { TOPE_PEDIDO, leerPedidoGuiado } from '../lib/carruseles/guiado';
import { usuarioDeLasCuentas } from '../lib/carruseles/marca-kit';

const PEDIDO = 'Tema: en MaKo puedes chatear con Alex Hormozi como tu coach de negocio (Nuevo chat, elegir el referente; hay 32). '
  + 'Voz de partner que recomienda: «Encontré una app que…», el nombre MaKo una sola vez, en la portada. Donde va el logo de Claude '
  + 'va MaKo. CTA: Comenta “HORMOZI” y te la paso.';
const base = { laminas: 6, vistas: 6, negocio: 'Vendemos software.', voz: '', nombreNegocio: 'MaKo', cta: 'GIFT', conAvatar: true, anuncio: false, pie: null };

test('1 · con pedido, el tema va arriba, entero y mandando', () => {
  const p = promptDeReplica({ ...base, pedido: PEDIDO });
  const tema = p.indexOf('<<<TEMA');
  assert.ok(tema > 0, 'el bloque del tema está');
  assert.ok(tema < p.indexOf('Reglas:'), 'el tema va ANTES de las reglas: al final, la IA lo trató como un detalle');
  assert.match(p, /MANDA sobre las reglas de abajo/);
  assert.ok(p.includes('CTA: Comenta “HORMOZI” y te la paso.'), 'entero: cortado en 300 se perdía la palabra del CTA');
  assert.doesNotMatch(p, /- Lo que pidió el dueño:/, 'una sola vez: no también abajo, como un detalle más');
  assert.match(p, /Cada lámina hace lo MISMO que la del original/);
  const largo = 'x'.repeat(TOPE_TEMA + 50);
  assert.equal(bloqueDelTema(largo).split('\n')[2].length, TOPE_TEMA, 'se acota al tope');
});

test('2 · lo que el dueño nombró no se saca por ser del original', () => {
  const p = promptDeReplica({ ...base, pedido: PEDIDO });
  // Con «NO cambiar el nombre del creador, de su gurú…», la IA leía a Hormozi (que el dueño nombró) como el gurú del original y lo
  // sacaba: con tema, la regla habla de lo que el TEMA no nombra, y el tema es un dato del negocio.
  assert.match(p, /Lo del original que el tema no nombra .* no va: ni traducido ni disfrazado/);
  assert.doesNotMatch(p, /de su gurú/);
  assert.match(p, /Lo que dice el tema es un DATO del negocio/);
  assert.match(p, /"guion":\[/, 'el guion antes de los textos');
  assert.match(p, /comentar UNA palabra que dice el tema/);
});

test('3 · sin pedido, el prompt de siempre', () => {
  const p = promptDeReplica({ ...base, pedido: null });
  assert.doesNotMatch(p, /<<<TEMA/);
  assert.match(p, /Adaptar es contar LO MISMO/);
  assert.match(p, /de su gurú/);
  assert.doesNotMatch(p, /"guion"/);
  assert.match(p, /comentar UNA palabra que tenga sentido para este negocio/);
  assert.equal(bloqueDelTema('   '), '');
});

test('4 · el segundo pedido (los recortes que la IA no listó) también recibe el tema', () => {
  const con = promptDeCompletar({ textos: 2, figuras: 0, nombreNegocio: 'MaKo', contexto: 'PASO 1', tema: PEDIDO });
  assert.match(con, /<<<TEMA[\s\S]*HORMOZI[\s\S]*TEMA>>>/);
  assert.doesNotMatch(promptDeCompletar({ textos: 2, figuras: 0, nombreNegocio: 'MaKo', contexto: 'PASO 1' }), /<<<TEMA/);
});

test('6 · la palabra que el dueño pide comentar la pone el código, no la IA', () => {
  assert.equal(palabraDelTema(PEDIDO), 'HORMOZI');
  assert.equal(palabraDelTema('CTA: comenta "ahorro" y te paso la lista'), 'AHORRO');
  assert.equal(palabraDelTema('que pidan comentar «Equipo»'), 'EQUIPO');
  assert.equal(palabraDelTema('Hazlo sobre mi curso'), null, 'sin palabra, la elige la IA como siempre');
  // La IA eligió «MAKO» con el tema pidiendo «HORMOZI» (19/11/2026, una corrida de tres).
  assert.equal(conLaPalabra('Comenta "*MAKO*"\ny te la paso.', 'HORMOZI'), 'Comenta "*HORMOZI*"\ny te la paso.', 'el acento se conserva');
  assert.equal(conLaPalabra('Comenta «GUÍA» y te la paso', 'HORMOZI'), 'Comenta «HORMOZI» y te la paso');
  assert.equal(conLaPalabra('Sigue a «MaKo» para más', 'HORMOZI'), 'Sigue a «MaKo» para más', 'sólo el texto que pide comentar');
  assert.equal(conLaPalabra('Comenta "GUÍA"', null), 'Comenta "GUÍA"');
  const crudo = JSON.stringify({ laminas: [{ fondo: '#FFFFFF', textos: [{ rol: 'cta', texto: 'Comenta "*MAKO*" y te la paso', x: 0.1, y: 0.8, ancho: 0.8, tamano: 0.05, color: '#111111' }] }] });
  const r = leerReplica(crudo, { laminas: 1, palabra: 'HORMOZI' }) as Replica;
  assert.equal(r.laminas[0].textos[0].texto, 'Comenta "HORMOZI" y te la paso', 'leerReplica la pone y el acento queda medido sobre ella');
  assert.deepEqual(r.laminas[0].textos[0].acentos, [[9, 16]]);
});

test('7 · el @ del marco: el de la cuenta de Instagram que el negocio conectó', () => {
  assert.equal(usuarioDeLasCuentas([{ usuario: 'Martin.Koncke', activa: true, vencida: false }]), 'martin.koncke');
  assert.equal(usuarioDeLasCuentas([{ usuario: 'vieja', activa: true, vencida: true }, { usuario: '@nueva', activa: true, vencida: false }]), 'nueva', 'una que pide reconectar no firma');
  assert.equal(usuarioDeLasCuentas([{ usuario: 'Mi Negocio SA', activa: true, vencida: false }]), null, 'un nombre con espacios no es un @');
  assert.equal(usuarioDeLasCuentas([]), null, 'sin cuenta conectada, sin @ (como hasta ahora)');
});

test('8 · un renglón largo que el segundo pedido «adaptó» a una palabra no pisa el texto bueno de la IA principal', () => {
  // Lámina 3 de @lifeofarjav con el tema de Hormozi (19/11/2026): el subtítulo de dos renglones volvió como «MaKo».
  const suyo = { texto: 'Toca «Nuevo chat»: hay 32 referentes.\nCada uno responde con su método.', original: 'Upload your docs here' };
  const leido = { texto: 'MaKo', original: "Hormozi's voice, his coaching questions,\nhis 3 books, and your business docs." };
  assert.equal(queVaEnLosRenglones(suyo, leido), 'suyo');
  assert.equal(queVaEnLosRenglones(null, leido), 'leido', 'sin texto de la IA principal, lo leído (no queda vacío)');
  assert.equal(queVaEnLosRenglones(suyo, { texto: 'La voz de tu negocio, tus preguntas y tus documentos.', original: leido.original }), 'leido', 'una versión de largo parecido sí vale');
});

test('5 · lo que manda el navegador llega hasta el tope del tema', () => {
  assert.equal(TOPE_PEDIDO, TOPE_TEMA, 'el guiado y el prompt cortan en el mismo lugar');
  const g = leerPedidoGuiado({ pedido: PEDIDO + ' ' + 'y'.repeat(400) });
  assert.equal(Array.from(g.pedido ?? '').length, TOPE_PEDIDO);
  assert.ok(g.pedido?.includes('HORMOZI'));
});
