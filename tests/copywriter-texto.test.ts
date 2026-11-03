// =============================================================================
// El Copywriter: un guion que llega como TEXTO (la API) y el «@» de la caja de MaKo
// =============================================================================
// Fija:
//   · el texto de la API se vuelve bloques con el contrato de la casa: una etiqueta en MAYÚSCULA en su renglón abre su
//     sección (y exportar de vuelta da el MISMO texto de secciones), las viñetas seguidas son UNA lista, «[x] » es una
//     tarea hecha, «# » un encabezado; y lo que sale lo acepta el saneo del server tal cual;
//   · el «@»: se abre SÓLO cuando lo escrito termina en «@algo» después de un espacio (un mail no la abre), busca sin
//     tildes, no repite lo elegido, elegir borra el «@algo» y respeta el tope; lo que llega al server se sanea.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { bloquesDeTexto, docDeTexto } from '../lib/copywriter/texto';
import { bloquesDelDoc, sanearContenido, textoDelDoc } from '../lib/copywriter/doc';
import { parsearSecciones } from '../lib/guion-secciones';
import { buscarReferencias, consultaArroba, elegirReferencia, REF_OFERTA, sanearReferencias, TOPE_REFERENCIAS, type Referencia } from '../lib/copywriter/referencias-reglas';

test('el texto de la API: las etiquetas abren secciones y exportar devuelve las mismas secciones', () => {
  const texto = 'GANCHO\nSi cada lunes arrancas sin clientes…\nPROBLEMA:\nPublicas y nadie compra.\nCTA\nAgenda hoy.';
  const doc = docDeTexto(texto);
  const leidos = bloquesDelDoc(doc);
  assert.deepEqual(leidos.filter((b) => b.tipo === 'seccion').map((b) => b.seccion), ['GANCHO', 'PROBLEMA', 'CTA']);
  assert.deepEqual(parsearSecciones(textoDelDoc(doc)).map((s) => [s.titulo, s.texto]), [
    ['GANCHO', 'Si cada lunes arrancas sin clientes…'], ['PROBLEMA', 'Publicas y nadie compra.'], ['CTA', 'Agenda hoy.'],
  ]);
  const s = sanearContenido(doc);
  assert.ok(s.ok);
  assert.equal(s.doc.content?.length, doc.content?.length);
});

test('el texto de la API: listas juntas, tareas hechas y encabezados', () => {
  const b = bloquesDeTexto('# Notas\n- uno\n- dos\n[x] grabar\n[] editar\n1. a\n2. b\n> una cita\nUn párrafo con Mayúsculas');
  assert.deepEqual(b.map((x) => x.type), ['heading', 'bulletList', 'taskList', 'orderedList', 'blockquote', 'paragraph']);
  assert.equal(b[1].content?.length, 2, 'las viñetas seguidas son UNA lista');
  assert.deepEqual(b[2].content?.map((i) => i.attrs?.checked), [true, false]);
  assert.equal(b[0].attrs?.level, 1);
});

test('una frase en mayúsculas que no es una etiqueta de sección no abre una sección', () => {
  const b = bloquesDeTexto('ESTO ES UNA FRASE MUY LARGA QUE GRITA Y NO ES UNA SECCIÓN');
  assert.equal(b[0].type, 'paragraph');
});

test('el «@»: sólo al final y después de un espacio (un mail no la abre)', () => {
  assert.equal(consultaArroba('escribe como en @reel'), 'reel');
  assert.equal(consultaArroba('@'), '');
  assert.equal(consultaArroba('mándalo a ana@ejemplo.com'), null);
  assert.equal(consultaArroba('usa @reel y algo más'), null);
});

test('el «@»: busca sin tildes, no repite lo elegido; elegir borra el «@algo» y respeta el tope', () => {
  const todas: Referencia[] = [
    { tipo: 'guion', id: 'ga111111', nombre: 'Promoción de verano', tipoGuion: 'reel' },
    { tipo: 'archivo', id: 'f1', nombre: 'Lo que vendes.pdf' },
    REF_OFERTA,
  ];
  assert.deepEqual(buscarReferencias('promocion', todas, []).map((r) => r.id), ['ga111111']);
  assert.deepEqual(buscarReferencias('', todas, [REF_OFERTA]).map((r) => r.id), ['ga111111', 'f1']);
  const e = elegirReferencia('usa el tono de @promo', todas[0], []);
  assert.equal(e.texto, 'usa el tono de ');
  assert.equal(e.elegidas.length, 1);
  const llenas = Array.from({ length: TOPE_REFERENCIAS }, (_, i): Referencia => ({ tipo: 'archivo', id: `a${i}`, nombre: `a${i}` }));
  assert.equal(elegirReferencia('@x', REF_OFERTA, llenas).elegidas.length, TOPE_REFERENCIAS);
});

test('lo que llega al server se sanea (tipo, id, tope)', () => {
  const s = sanearReferencias([{ tipo: 'guion', id: 'ga1', nombre: 'x' }, { tipo: 'otra', id: 'y' }, { tipo: 'oferta' }, { tipo: 'archivo' }, ...Array(10).fill({ tipo: 'oferta' })]);
  assert.deepEqual(s.map((r) => r.tipo), ['guion', 'oferta', 'oferta'], 'se miran los primeros del tope, y lo malo se cae');
});
