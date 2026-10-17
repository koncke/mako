// =============================================================================
// El muñeco de cada chat del Second Brain (lib/chat-munecos.ts y lib/chat-munecos-db.ts, tanda 9, 16/10/2026)
// =============================================================================
// Lo que se fija: se guarda por ID (renombrar no cambia la cara), lo de afuera se sanea, el tope tira el más viejo, y la
// escritura es compare-and-set adentro del workspace (sin él, lib/settings.ts cae al ws1).
//
// PROBADO ROMPIÉNDOLO (16/10/2026, base 4 / 0), una rotura por vez, restaurada:
//   M1  `sanearMunecosDeChats` sin filtrar las claves que no son ids                 → 3 / 1
//   M2  el tope tirando también el recién elegido (el de una conversación vieja)      → 3 / 1
//   M3  `conMunecoDeChat` sin sacar el anterior (quitar no quita)                     → 3 / 1
//   M4  la escritura con `setSetting` en vez de `cambiarSettingSi(k, crudo, …)`        → 3 / 1
// ⚠️ La primera versión prometía «se va el elegido hace más tiempo» y probaba el orden de las claves: un objeto de JS
//    ordena solas las claves que son números, así que ese orden no existía. El test cayó en la base, no en una rotura.
//
// Correr: node --import tsx --test tests/chat-munecos.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOPE_MUNECOS_CHATS, conMunecoDeChat, sanearMunecosDeChats } from '../lib/chat-munecos';

const A = { forma: 'gota', color: '--grafo-documentos', cara: 'sonrisa' } as const;
const B = { forma: 'circulo', color: '--grafo-documentos', cara: 'risa' } as const;

test('lo guardado se sanea: ids de conversación y aspectos válidos, nada más', () => {
  assert.deepEqual(sanearMunecosDeChats(null), {});
  assert.deepEqual(sanearMunecosDeChats([A]), {});
  assert.deepEqual(sanearMunecosDeChats({ 12: A, crm: A, '0': A, '-3': A, '1.5': A, 13: { forma: 'rara' } }), { 12: A });
  // Un aspecto viejo con `accesorio` se sigue viendo como se eligió (sin él).
  assert.deepEqual(sanearMunecosDeChats({ 7: { ...A, accesorio: 'gorra' } }), { 7: A });
});

test('elegir, cambiar y quitar: por id (renombrar no cambia la cara)', () => {
  const uno = conMunecoDeChat({}, 12, A);
  assert.deepEqual(uno, { 12: A });
  const dos = conMunecoDeChat(uno, 30, B);
  assert.deepEqual(dos, { 12: A, 30: B });
  const otraVez = conMunecoDeChat(dos, 12, B);
  assert.deepEqual(otraVez, { 12: B, 30: B });
  assert.deepEqual(conMunecoDeChat(otraVez, 30, null), { 12: B }, 'quitar vuelve al de su nombre');
  assert.deepEqual(uno, { 12: A }, 'no toca el de entrada');
});

test('el tope: pasado, se va el de la conversación más vieja, nunca el recién elegido', () => {
  let m = {};
  for (let i = 2; i <= TOPE_MUNECOS_CHATS + 1; i++) m = conMunecoDeChat(m, i, A);
  const mas = conMunecoDeChat(m, 999, B);
  assert.equal(Object.keys(mas).length, TOPE_MUNECOS_CHATS);
  assert.ok(!('2' in mas) && '999' in mas, 'se fue la más vieja');
  // Elegir el de una conversación MÁS vieja que todas no lo tira en el acto.
  const viejo = conMunecoDeChat(m, 1, B);
  assert.equal(Object.keys(viejo).length, TOPE_MUNECOS_CHATS);
  assert.deepEqual(viejo[1], B);
  assert.ok(!('2' in viejo));
  // Lo guardado de más (de antes del tope) se queda con los más nuevos.
  const crudo = Object.fromEntries(Array.from({ length: TOPE_MUNECOS_CHATS + 5 }, (_, i) => [String(i + 1), A]));
  assert.ok(!('1' in sanearMunecosDeChats(crudo)) && (String(TOPE_MUNECOS_CHATS + 5) in sanearMunecosDeChats(crudo)));
});

test('la escritura: compare-and-set sobre lo leído, adentro del workspace, y tira si pierde tres veces', () => {
  const src = readFileSync('lib/chat-munecos-db.ts', 'utf8').replace(/\/\/.*$/gm, '');
  assert.match(src, /await cambiarSettingSi\(k, crudo, valor\)/, 'escribe sólo si sigue valiendo lo que leyó');
  assert.ok(!/\bsetSetting\(/.test(src), 'nunca un set a ciegas');
  assert.match(src, /getSettingEstricto\(/, 'leer estricto: «no pude leer» no es «no hay muñecos»');
  assert.equal((src.match(/return runWithWorkspace\(ws, /g) ?? []).length, 2, 'las dos funciones corren en su workspace');
  assert.match(src, /throw new Error\('Los muñecos cambiaron mientras se guardaban/);
  assert.match(src, /Number\.isInteger\(ws\) \|\| ws <= 0\) throw/, 'sin workspace válido no se toca nada (caería al ws1)');
});
