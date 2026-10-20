// =============================================================================
// La caja del Ops Center: listas mientras se escribe y el borrador que nunca se pierde (17/10/2026)
// =============================================================================
// Martín (feedback del 17/10, la B): «1. », «- » y «* » se vuelven lista mientras escribe; Enter sigue la lista y un Enter
// en un ítem vacío la corta; también en los mensajes que se ven. Y el borrador nunca se pierde. Lo que se fija
// (lib/centro-caja.ts):
//   1. el guion pasa a viñeta sólo en el renglón donde se escribe, recién tipeado el espacio;
//   2. Enter en una lista arma el ítem siguiente (la viñeta, o el número que sigue) y en un ítem vacío la corta;
//   3. lo que sale es Markdown de verdad, y la burbuja lo dibuja como lista;
//   4. entre el borrador del navegador y el de MaKo gana el más nuevo, aunque esté vacío (se mandó en otro lado).
//
// Probado rompiéndolo (17/10/2026, con la base en 0 fallos):
//   · `conVinetas` sin mirar dónde está el cursor → 1 fallo (1);
//   · `enterEnLista` sin cortar en el ítem vacío → 1 fallo (2);
//   · `textoParaMandar` sin pasar «• » a «- » → 1 fallo (3);
//   · `borradorQueVale` prefiriendo el que tiene texto → 1 fallo (4).
// Y el scroll que acompaña lo que se escribe (18/10/2026, Martín: «la caja crece y el chat no lo acompaña»):
//   · midiendo la conversación DESPUÉS de agrandar la caja → 1 fallo (5); sin devolverle a la caja su scroll → 1 fallo (5);
//   · el teléfono sin seguir abajo al escribir → 1 fallo (5).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bloquesDeMensaje, borradorQueVale, conVinetas, enterEnLista, estaAbajo, leerBorrador, textoParaMandar } from '../lib/centro-caja';

test('1. el guion pasa a viñeta en el renglón donde se escribe, recién tipeado el espacio', () => {
  assert.deepEqual(conVinetas('Hola\n- ', 7), { texto: 'Hola\n• ', cursor: 7 });
  assert.deepEqual(conVinetas('* ', 2), { texto: '• ', cursor: 2 });
  assert.deepEqual(conVinetas('- uno', 5), { texto: '- uno', cursor: 5 }, 'un guion que ya estaba (un texto pegado) no se toca');
  assert.deepEqual(conVinetas('a - b', 4), { texto: 'a - b', cursor: 4 }, 'sólo al principio del renglón');
});

test('2. Enter sigue la lista, y en un ítem vacío la corta', () => {
  assert.deepEqual(enterEnLista('• uno', 5, 5), { texto: '• uno\n• ', cursor: 8 });
  assert.deepEqual(enterEnLista('1. uno', 6, 6), { texto: '1. uno\n2. ', cursor: 10 });
  assert.deepEqual(enterEnLista('  3) tres', 9, 9), { texto: '  3) tres\n  4) ', cursor: 15 }, 'con su sangría y su paréntesis');
  assert.deepEqual(enterEnLista('• uno\n• ', 8, 8), { texto: '• uno\n', cursor: 6 }, 'el ítem vacío corta la lista');
  assert.equal(enterEnLista('Hola', 4, 4), null, 'fuera de una lista, Enter manda');
  assert.equal(enterEnLista('• uno', 1, 4), null, 'con algo seleccionado, lo de siempre');
});

test('3. lo que sale es Markdown, y la burbuja lo dibuja como lista', () => {
  assert.equal(textoParaMandar('Hace esto:\n• uno\n• dos\n'), 'Hace esto:\n- uno\n- dos');
  assert.deepEqual(bloquesDeMensaje('Hace esto:\n- uno\n- dos\n\n1. a\n2. b\nFin'), [
    { tipo: 'parrafo', texto: 'Hace esto:' },
    { tipo: 'lista', numerada: false, items: ['uno', 'dos'], marcas: ['-', '-'] },
    { tipo: 'lista', numerada: true, items: ['a', 'b'], marcas: ['1.', '2.'] },
    { tipo: 'parrafo', texto: 'Fin' },
  ]);
  assert.deepEqual(bloquesDeMensaje('Sólo texto\ncon dos renglones'), [{ tipo: 'parrafo', texto: 'Sólo texto\ncon dos renglones' }]);
});

test('4. entre el borrador del navegador y el de MaKo gana el más nuevo, aunque esté vacío', () => {
  const local = { texto: 'a medio escribir', at: 100 };
  assert.deepEqual(borradorQueVale(local, { texto: 'del teléfono', at: 200 }), { texto: 'del teléfono', at: 200 });
  assert.deepEqual(borradorQueVale(local, { texto: '', at: 300 }), { texto: '', at: 300 }, 'se mandó en el teléfono: acá se vacía');
  assert.deepEqual(borradorQueVale(local, null), local);
  assert.equal(leerBorrador({ texto: 3, at: 1 }), null);
  assert.equal(leerBorrador('x'), null);
});

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

test('5. el scroll acompaña lo que se escribe: la conversación sigue abajo y la caja sigue al cursor', () => {
  assert.equal(estaAbajo({ scrollHeight: 1000, scrollTop: 960, clientHeight: 20 }), true, 'a 20 px del final está abajo');
  assert.equal(estaAbajo({ scrollHeight: 1000, scrollTop: 500, clientHeight: 300 }), false, 'leyendo más arriba no se la mueve');
  const pc = leer('app/admin/operaciones/Conversacion.tsx');
  const efecto = pc.slice(pc.indexOf('const conversacionAbajo'), pc.indexOf('}, [texto]);'));
  assert.ok(efecto.indexOf('const conversacionAbajo = h ? estaAbajo(h) : false;') < efecto.indexOf("el.style.height = 'auto';"), 'se mide ANTES de agrandar la caja');
  assert.match(efecto, /el\.scrollTop = el\.selectionEnd >= el\.value\.length \? el\.scrollHeight : antes;/, 'la caja no pierde su scroll al medirse');
  assert.match(efecto, /if \(h && conversacionAbajo\) h\.scrollTop = h\.scrollHeight;/);
  assert.match(leer('app/m/operaciones/ChatsMovil.tsx'), /estaAbajo\(cuerpo, 160\)\) cuerpo\.scrollTop = cuerpo\.scrollHeight;/, 'el teléfono también');
});
