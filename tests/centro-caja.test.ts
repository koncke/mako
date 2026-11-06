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
//   · `enterEnLista` sin cortar en el ítem vacío → 1 fallo (2); (21/10) siguiendo con UN ítem donde Enter manda → 1 fallo (2);
//     (la segunda revisión) mandando cualquier ítem solo, no sólo la pregunta → 1 fallo (2);
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
import { altoDelCampo, bloquesDeMensaje, borradorQueVale, conVinetas, enterEnLista, estaAbajo, leerBorrador, textoParaMandar } from '../lib/centro-caja';

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
  // En la computadora (Enter manda), con UN solo ítem todavía no hay lista (revisión del 21/10/2026).
  const una = '1. ¿Cuántos leads entraron ayer?';
  assert.equal(enterEnLista(una, una.length, una.length, { conUno: false }), null, '«1. …» y Enter: se manda');
  // Pero se EMPIEZA una lista con Enter (Martín, 17/10; la segunda revisión): sólo un ítem que es una pregunta se manda.
  assert.deepEqual(enterEnLista('- mandale a Ana el link', 23, 23, { conUno: false }), { texto: '- mandale a Ana el link\n- ', cursor: 26 }, 'una lista se empieza con Enter');
  assert.deepEqual(enterEnLista('1. Llamar a Ana', 15, 15, { conUno: false }), { texto: '1. Llamar a Ana\n2. ', cursor: 19 });
  assert.deepEqual(enterEnLista('1. uno\n2. dos', 13, 13, { conUno: false }), { texto: '1. uno\n2. dos\n3. ', cursor: 17 }, 'con dos, la lista sigue');
  assert.deepEqual(enterEnLista('• uno\n• ', 8, 8, { conUno: false }), { texto: '• uno\n', cursor: 6 }, 'y el ítem vacío la corta igual');
  assert.match(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app', '_chat', 'CajaChat.tsx'), 'utf8'),
    /enterEnLista\(texto, e\.currentTarget\.selectionStart, e\.currentTarget\.selectionEnd, \{ conUno: !p\.enterManda \}\)/, 'la caja lo usa donde Enter manda');
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
  // Desde el 20/10/2026 vive en la caja única (app/_chat/CajaChat.tsx); cada pantalla le dice QUÉ sigue abajo.
  const pieza = leer('app/_chat/CajaChat.tsx');
  const efecto = pieza.slice(pieza.indexOf('const h = p.seguir?.()'), pieza.indexOf('}, [texto]);'));
  assert.ok(efecto.indexOf('const abajo = h ? estaAbajo(h) : false;') < efecto.indexOf("el.style.height = 'auto';"), 'se mide ANTES de agrandar la caja');
  assert.match(efecto, /el\.scrollTop = el\.selectionEnd >= el\.value\.length \? el\.scrollHeight : antes;/, 'la caja no pierde su scroll al medirse');
  assert.match(efecto, /if \(h && abajo\) h\.scrollTop = h\.scrollHeight;/);
  assert.match(efecto, /estaAbajo\(h, 160\)\) h\.scrollTop = h\.scrollHeight;/, 'el teléfono también (crece el CSS)');
  assert.match(leer('app/admin/operaciones/Conversacion.tsx'), /seguir=\{seguirHilo\}/, 'la computadora: la conversación');
  assert.match(leer('app/m/operaciones/ChatsMovil.tsx'), /seguir=\{seguirHoja\} altoMax=\{null\}/, 'el teléfono: la hoja');
});

test('6. la caja montada escondida no queda en 0 px: el texto centrado al aparecer (23/10/2026, «Pídele un cambio» quedaba bajo)', () => {
  // Medido en producción, en el chat del lienzo de Automations: `height: 0px` con un `scrollHeight` de 40 (lo midió escondido).
  assert.equal(altoDelCampo(0, 220), '', 'escondido no mide: el alto queda en manos del CSS (un renglón con su relleno)');
  assert.equal(altoDelCampo(40, 220), '40px');
  assert.equal(altoDelCampo(500, 220), '220px', 'con su tope');
  const pieza = leer('app/_chat/CajaChat.tsx');
  assert.doesNotMatch(pieza, /el\.style\.height = `\$\{Math\.min\(el\.scrollHeight/, 'nunca el alto sin pasar por altoDelCampo');
  assert.match(pieza, /if \(!ancho && w\) \{ el\.style\.height = 'auto'; el\.style\.height = altoDelCampo\(el\.scrollHeight, altoMax\); \}/, 'se vuelve a medir al aparecer');
});
// PROBADO ROMPIÉNDOLO (23/10/2026, test 6): `altoDelCampo` devolviendo `${Math.min(medido, tope)}px` siempre → 5/1;
// sin el ResizeObserver de CajaChat → 5/1.

// 6/11/2026 (SB1 de los arreglos de Admin): «Escribe a Chat nuevo». El título de una conversación es `SIN_TITULO` hasta que
// el modelo le pone uno después del primer turno, así que la caja de un chat recién abierto nombraba a «Chat nuevo» como si
// fuera alguien. La regla: un texto armado con un nombre tiene que preguntar si el nombre existe.
test('7. la caja de un chat sin título todavía no nombra a nadie', () => {
  const pieza = leer('app/admin/operaciones/Conversacion.tsx');
  assert.match(pieza, /placeholder=\{chat\.titulo && chat\.titulo !== SIN_TITULO \? `Escribe a \$\{chat\.titulo\}` : 'Escribe lo que necesitas'\}/);
  assert.match(pieza, /import \{ SIN_TITULO \} from '@\/lib\/chat-mako-reglas';/, 'la constante sale de donde vive, no copiada');
  assert.doesNotMatch(pieza, /placeholder=\{`Escribe a \$\{chat\.titulo\}`\}/, 'volvió el placeholder que nombra «Chat nuevo»');
  // El texto de reemplazo es el MISMO que usa la caja de al lado para un chat nuevo: una sola voz.
  assert.match(leer('app/admin/operaciones/CajaChatNuevo.tsx'), /placeholder="Escribe lo que necesitas"/);
  // Y la constante sigue siendo lo que se le pone a una conversación sin título.
  assert.match(leer('lib/chat-mako-reglas.ts'), /export const SIN_TITULO = 'Chat nuevo';/);
});
