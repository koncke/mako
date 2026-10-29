// =============================================================================
// Copywriter = Notion (BlockNote): el documento guardado ⇄ los bloques del editor (lib/copywriter/notion-bloques.ts)
// =============================================================================
// Fija lo que se rompe sin un error (docs/diseno-copywriter.md, D11):
//   · IDA Y VUELTA SIN PERDER NADA: un documento con todos los bloques (títulos, secciones, listas anidadas, tareas,
//     cita con salto, destacado, desplegable anidado, tabla con encabezado, enlaces y estilos) vuelve igual después de
//     pasar por BlockNote y por el saneo del server: mismo texto, mismos ids, mismas secciones;
//   · EL ID ES ESTABLE: un bloque nuevo de BlockNote (uuid) da SIEMPRE el mismo `bid` válido (MaKo apunta por id);
//   · UNA LISTA SON SUS ÍTEMS: tres viñetas seguidas son UNA lista con el `bid` del primero;
//   · LO QUE EL FORMATO NO ANIDA (un párrafo con hijos, Tab en BlockNote) sale a continuación: no se pierde texto;
//   · UN ID REPETIDO no entra dos veces a BlockNote (exige ids únicos);
//   · un DESPLEGABLE dentro de otro sobrevive al saneo (antes se tiraba con lo escrito).
// Verificado rompiéndolo (29/10/2026, 9 tests): con `bidDe` devolviendo `null` para los uuid, 1 falla (ids estables);
// sin agrupar los ítems (cada uno su lista), 3; con el filtro viejo del desplegable en doc.ts, 1; sin sacar a los hijos
// de un párrafo, 1. Restaurado: 9 de 9.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { BID_RE, bloquesDelDoc, docDeEstructura, sanearContenido, textoDelDoc } from '../lib/copywriter/doc';
import { aBloques, bidDe, deBloques, type BloqueBN } from '../lib/copywriter/notion-bloques';
import type { JsonNodo } from '../lib/copywriter/tipos';

const t = (text: string, marks?: JsonNodo['marks']): JsonNodo => ({ type: 'text', text, ...(marks ? { marks } : {}) });
const p = (...c: JsonNodo[]): JsonNodo => ({ type: 'paragraph', content: c });

/** Un documento con TODOS los bloques, ya saneado (con sus bids). */
function docCompleto(): JsonNodo {
  const crudo: JsonNodo = {
    type: 'doc',
    content: [
      ...docDeEstructura(['GANCHO', 'CTA']).content!,
      { type: 'heading', attrs: { level: 1 }, content: [t('Título grande')] },
      p(t('Un '), t('negrita', [{ type: 'bold' }]), t(' y un '), t('enlace', [{ type: 'link', attrs: { href: 'https://hola-mako.com' } }]), { type: 'hardBreak' }, t('otro renglón')),
      { type: 'bulletList', content: [
        { type: 'listItem', content: [p(t('uno')), { type: 'bulletList', content: [{ type: 'listItem', content: [p(t('uno.a'))] }] }] },
        { type: 'listItem', content: [p(t('dos'))] },
      ] },
      { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [p(t('tres'))] }, { type: 'listItem', content: [p(t('cuatro'))] }] },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p(t('hecha'))] }, { type: 'taskItem', attrs: { checked: false }, content: [p(t('falta'))] }] },
      { type: 'blockquote', content: [p(t('cita uno')), p(t('cita dos'))] },
      { type: 'horizontalRule' },
      { type: 'callout', attrs: { emoji: '🔥' }, content: [p(t('destacado')), p(t('segundo renglón'))] },
      { type: 'toggle', attrs: { abierto: true }, content: [p(t('afuera')), p(t('adentro')),
        { type: 'toggle', attrs: { abierto: true }, content: [p(t('afuera 2')), p(t('adentro 2'))] }] },
      { type: 'table', content: [
        { type: 'tableRow', content: [{ type: 'tableHeader', content: [p(t('A'))] }, { type: 'tableHeader', content: [p(t('B'))] }] },
        { type: 'tableRow', content: [{ type: 'tableCell', content: [p(t('1'))] }, { type: 'tableCell', content: [p(t('2'))] }] },
      ] },
    ],
  };
  const s = sanearContenido(crudo);
  assert.ok(s.ok);
  return s.doc;
}

const vueltaEntera = (doc: JsonNodo): JsonNodo => {
  const { bloques, secciones } = aBloques(doc);
  // Lo que devuelve `editor.document` es JSON: se clona como lo haría el navegador.
  const s = sanearContenido(deBloques(JSON.parse(JSON.stringify(bloques)) as BloqueBN[], secciones));
  assert.ok(s.ok, 'el saneo acepta lo que sale de BlockNote');
  return s.doc;
};

test('ida y vuelta: mismo texto, mismos ids y mismas secciones', () => {
  const doc = docCompleto();
  const vuelta = vueltaEntera(doc);
  assert.equal(textoDelDoc(vuelta), textoDelDoc(doc));
  assert.deepEqual(bloquesDelDoc(vuelta), bloquesDelDoc(doc));
  // Y una segunda vuelta no cambia nada (lo que se guarda es un punto fijo).
  assert.deepEqual(vueltaEntera(vuelta), vuelta);
});

test('ida y vuelta: estilos, enlace, salto y la cita de dos párrafos', () => {
  const vuelta = vueltaEntera(docCompleto());
  const json = JSON.stringify(vuelta);
  assert.match(json, /"text":"negrita","marks":\[\{"type":"bold"\}\]/);
  assert.match(json, /"href":"https:\/\/hola-mako.com"/);
  assert.match(json, /"hardBreak"/);
  assert.match(textoDelDoc(vuelta), /cita uno\ncita dos/);
  assert.match(json, /"type":"tableHeader"/);
  assert.match(json, /"start":3/);
  assert.match(json, /"checked":true/);
});

test('las secciones del guion viajan aparte y vuelven a su Título 2', () => {
  const doc = docDeEstructura(['GANCHO', 'PROBLEMA', 'CTA']);
  const s = sanearContenido(doc);
  assert.ok(s.ok);
  const { bloques, secciones } = aBloques(s.doc);
  assert.deepEqual(Object.values(secciones), ['GANCHO', 'PROBLEMA', 'CTA']);
  const heading = bloques.find((b) => b.type === 'heading');
  assert.equal(heading?.props?.level, 2);
  const vuelta = deBloques(bloques, secciones);
  assert.deepEqual(bloquesDelDoc(vuelta).filter((b) => b.tipo === 'seccion').map((b) => b.seccion), ['GANCHO', 'PROBLEMA', 'CTA']);
  // Sin el mapa, son títulos comunes (no se inventa una sección).
  assert.equal(bloquesDelDoc(deBloques(bloques, {})).filter((b) => b.tipo === 'seccion').length, 0);
});

test('un bloque nuevo de BlockNote (uuid) da siempre el mismo bid válido', () => {
  const uuid = '5f0c6b9e-3a1d-4c2b-9e8f-7a6b5c4d3e2f';
  const a = bidDe(uuid);
  assert.ok(a && BID_RE.test(a), `bid válido: ${a}`);
  assert.equal(bidDe(uuid), a);
  assert.notEqual(bidDe('6f0c6b9e-3a1d-4c2b-9e8f-7a6b5c4d3e2f'), a);
  const bloques: BloqueBN[] = [
    { id: uuid, type: 'paragraph', content: [{ type: 'text', text: 'hola', styles: {} }] },
    { id: 'a1b2c3d4-0000-4000-8000-000000000001', type: 'bulletListItem', content: [{ type: 'text', text: 'x', styles: {} }] },
    { id: 'a1b2c3d4-0000-4000-8000-000000000002', type: 'bulletListItem', content: [{ type: 'text', text: 'y', styles: {} }] },
  ];
  const uno = bloquesDelDoc(deBloques(bloques)).map((b) => b.bid);
  const dos = bloquesDelDoc(deBloques(bloques)).map((b) => b.bid);
  assert.deepEqual(uno, dos);
  assert.equal(uno.length, 2, 'dos viñetas seguidas son UNA lista');
  assert.ok(uno.every((b) => BID_RE.test(b)));
});

test('tres viñetas seguidas son una lista con el bid del primero; otro tipo corta la lista', () => {
  const v = (id: string, text: string): BloqueBN => ({ id, type: 'bulletListItem', content: [{ type: 'text', text, styles: {} }] });
  const doc = deBloques([v('blista0001', 'a'), v('blista0001x1', 'b'), v('blista0001x2', 'c'), { id: 'bparr00001', type: 'paragraph', content: [] }, v('blista0002', 'd')]);
  const tipos = (doc.content ?? []).map((n) => n.type);
  assert.deepEqual(tipos, ['bulletList', 'paragraph', 'bulletList']);
  assert.equal(doc.content![0].attrs?.bid, 'blista0001');
  assert.equal(doc.content![0].content!.length, 3);
});

test('lo que el formato no anida (un párrafo con hijos) sale a continuación, sin perder texto', () => {
  const doc = deBloques([
    { id: 'bpadre0001', type: 'paragraph', content: [{ type: 'text', text: 'padre', styles: {} }], children: [
      { id: 'bhijo00001', type: 'paragraph', content: [{ type: 'text', text: 'hijo', styles: {} }] },
      { id: 'bhijo00002', type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'título hijo', styles: {} }] },
    ] },
    { id: 'bcita00001', type: 'quote', content: [{ type: 'text', text: 'cita', styles: {} }], children: [
      { id: 'bhijo00003', type: 'paragraph', content: [{ type: 'text', text: 'debajo de la cita', styles: {} }] },
    ] },
  ]);
  assert.equal(textoDelDoc(doc), 'padre\nhijo\n\ntítulo hijo\ncita\ndebajo de la cita');
});

test('un id repetido entra una sola vez a BlockNote', () => {
  const doc: JsonNodo = { type: 'doc', content: [
    { type: 'paragraph', attrs: { bid: 'brepetido1' }, content: [t('uno')] },
    { type: 'toggle', attrs: { bid: 'bdespleg01' }, content: [p(t('t')), { type: 'paragraph', attrs: { bid: 'brepetido1' }, content: [t('dos')] }] },
  ] };
  const { bloques } = aBloques(doc);
  const ids: string[] = [];
  const juntar = (bs: readonly BloqueBN[]) => bs.forEach((b) => { if (b.id) ids.push(b.id); juntar(b.children ?? []); });
  juntar(bloques);
  assert.equal(new Set(ids).size, ids.length);
});

test('un desplegable dentro de otro sobrevive al saneo con lo escrito', () => {
  const s = sanearContenido(docCompleto());
  assert.ok(s.ok);
  assert.match(textoDelDoc(s.doc), /afuera 2/);
  assert.match(textoDelDoc(s.doc), /adentro 2/);
});

test('un documento vacío abre con un renglón, y BlockNote vacío guarda un renglón', () => {
  assert.equal(aBloques({ type: 'doc', content: [] }).bloques.length, 1);
  const s = sanearContenido(deBloques([]));
  assert.ok(s.ok);
  assert.equal(s.doc.content!.length, 1);
});
