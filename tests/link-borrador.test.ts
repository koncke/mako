// El link del borrador: que el id no dependa de que un modelo copie 17 caracteres.
//
// Los casos salen de lo medido en prod: un link que no existía («Este borrador ya no
// existe») y otro que resolvía a un borrador REAL pero equivocado — el peor, porque
// abre una pantalla que parece la correcta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { corregirLinkBorrador, idDeLinkRevisar } from '../lib/link-borrador';

const OK = 'https://hola-mako.com/plan/revisar/propmskgpno0rxldp';

test('un id con un carácter cambiado se corrige', () => {
  const t = `Te dejé 3 tareas para revisar: https://hola-mako.com/plan/revisar/propmskgpno0rxldq`;
  assert.equal(corregirLinkBorrador(t, OK), 'Te dejé 3 tareas para revisar: ' + OK);
});

test('el caso real: apuntaba a OTRO borrador que sí existe', () => {
  // propmskbhwqr6mk8v existe de verdad (1 tarea sobre un Reel) y no es el que había
  // que revisar. Sin esto, la pantalla abre el borrador equivocado y nadie se entera.
  const t = `Listo, mirá acá: https://hola-mako.com/plan/revisar/propmskbhwqr6mk8v`;
  assert.equal(idDeLinkRevisar(corregirLinkBorrador(t, OK)), 'propmskgpno0rxldp');
});

test('si el modelo NO puso el link, se agrega', () => {
  const t = 'Te armé un borrador con 3 tareas y 2 preguntas.';
  const out = corregirLinkBorrador(t, OK);
  assert.ok(out.startsWith(t));
  assert.ok(out.includes(OK));
  assert.equal(idDeLinkRevisar(out), 'propmskgpno0rxldp');
});

test('si ya estaba bien, no se toca el texto', () => {
  const t = `Anoté 3 tareas. Revisalas acá: ${OK}`;
  assert.equal(corregirLinkBorrador(t, OK), t);
});

test('sin link canónico no se inventa nada', () => {
  const t = 'No armé ningún borrador, era una consulta.';
  assert.equal(corregirLinkBorrador(t, null), t);
  assert.equal(corregirLinkBorrador(t, ''), t);
});

test('un link repetido queda UNA sola vez', () => {
  const t = `Mirá ${OK} y confirmá en ${OK}`;
  const out = corregirLinkBorrador(t, OK);
  assert.equal(out.split('/plan/revisar/').length - 1, 1);
});

test('tolera el host cambiado o sin protocolo', () => {
  for (const malo of [
    'hola-mako.com/plan/revisar/propXXXX',
    'https://makodigital.app/plan/revisar/propXXXX',
    'http://localhost:3000/plan/revisar/propXXXX',
  ]) {
    assert.equal(idDeLinkRevisar(corregirLinkBorrador(`Acá: ${malo}`, OK)), 'propmskgpno0rxldp');
  }
});

test('no toca otros links del mensaje', () => {
  const t = `Mirá el reel https://instagram.com/reel/ABC y el borrador ${OK}`;
  const out = corregirLinkBorrador(t, OK);
  assert.ok(out.includes('https://instagram.com/reel/ABC'));
});

test('idDeLinkRevisar', () => {
  assert.equal(idDeLinkRevisar(OK), 'propmskgpno0rxldp');
  assert.equal(idDeLinkRevisar('sin links acá'), null);
});
