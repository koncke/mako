// =============================================================================
// Las herramientas con que MaKo escribe en el guion (lib/copywriter/operaciones.ts) y cómo se ve construyéndose
// =============================================================================
// Fija:
//   · el SANEO de lo que devuelve la IA: lo que no está en el catálogo, un id que no existe, una sección sin etiqueta o
//     una operación sin texto se DESCARTAN con su motivo (nada se tira callado), y las propiedades sólo con ids de la
//     biblioteca;
//   · APLICAR por id: «escribir_seccion» reemplaza el cuerpo de ESA sección (hasta el próximo título de sección) y no
//     toca las demás; una sección que no existe va al final con su título; reemplazar, insertar y borrar apuntan por id,
//     nunca por posición; una operación sobre lo que borró otra anterior se descarta;
//   · CONSTRUYÉNDOSE: los cuadros terminan EXACTAMENTE en el resultado, los bloques aparecen de a uno y su texto crece
//     (cortado en palabras enteras), y con muchos cuadros se respeta el tope (segundos, no minutos).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { aplicarOperacion, aplicarTodo, bloqueAJson, cuadrosDeConstruccion, sanearOperaciones, truncarBloque, TOPE_CUADROS, type OperacionIA } from '../lib/copywriter/operaciones';
import { bloquesDelDoc, docDeEstructura, sanearContenido, textoDeNodo } from '../lib/copywriter/doc';
import type { JsonNodo } from '../lib/copywriter/tipos';

const cat = { angulos: new Set(['dolor']), estructuras: new Set(['pas']) };
const bids = (d: JsonNodo) => (d.content ?? []).map((b) => b.attrs?.bid as string);

/** Un guion PAS con algo escrito en cada sección. */
function guionPas(): JsonNodo {
  const d = docDeEstructura(['GANCHO', 'PROBLEMA', 'CTA']);
  let i = 0;
  for (const b of d.content ?? []) if (b.type === 'paragraph') b.content = [{ type: 'text', text: `texto viejo ${++i}` }];
  return d;
}

test('el saneo descarta lo que no es del catálogo, lo que apunta a la nada y lo vacío, con su motivo', () => {
  const doc = guionPas();
  const [, p1] = bids(doc);
  const r = sanearOperaciones([
    { op: 'borrar_todo' },
    { op: 'reemplazar_bloque', bid: 'bnoexiste1', bloques: [{ tipo: 'texto', texto: 'x' }] },
    { op: 'escribir_seccion', seccion: 'gancho', bloques: [{ tipo: 'texto', texto: 'Nuevo gancho' }] },
    { op: 'escribir_seccion', seccion: 'CTA', bloques: [{ tipo: 'nada', texto: 'x' }] },
    { op: 'insertar_despues', bid: p1, bloques: [{ tipo: 'vinetas', items: ['a', '', 'b'] }] },
    // Un párrafo (el TÍTULO de una sección ya no se borra: tests/copywriter.test.ts, 13/11/2026).
    { op: 'borrar_bloque', bid: p1 },
    { op: 'propiedades', angulo: 'inventado', estructura: 'pas', duracion: 30 },
    { op: 'propiedades', angulo: 'inventado', tipo: 'podcast' },
    { op: 'titulo', texto: '  Un   título  ' },
  ], doc, cat);
  assert.deepEqual(r.ops.map((o) => o.op), ['escribir_seccion', 'insertar_despues', 'borrar_bloque', 'propiedades', 'titulo']);
  assert.equal((r.ops[0] as Extract<OperacionIA, { op: 'escribir_seccion' }>).seccion, 'GANCHO', 'la etiqueta va en MAYÚSCULA');
  const { bid, ...vinetas } = (r.ops[1] as Extract<OperacionIA, { op: 'insertar_despues' }>).bloques[0];
  assert.deepEqual(vinetas, { tipo: 'vinetas', items: ['a', 'b'] });
  assert.match(String(bid), /^b[a-z0-9]{6,16}$/, 'el id del bloque lo pone el saneo');
  assert.deepEqual(r.ops[3], { op: 'propiedades', estructura: 'pas', duracion: 30 }, 'un ángulo que no está en la biblioteca no entra');
  assert.deepEqual(r.ops[4], { op: 'titulo', texto: 'Un título' });
  assert.equal(r.descartadas.length, 4);
  assert.ok(r.descartadas.every((d) => d.motivo.length > 5), 'cada descarte dice por qué');
});

test('el TIPO entra por propiedades y llega a la página (13/11/2026: un reel en una «Página en blanco» quedaba «Página»)', () => {
  const doc = docDeEstructura(['GANCHO']);
  const r = sanearOperaciones([{ op: 'propiedades', tipo: 'reel' }], doc, cat);
  assert.deepEqual(r.ops, [{ op: 'propiedades', tipo: 'reel' }]);
  assert.deepEqual(aplicarTodo(doc, r.ops).props, { tipo: 'reel' });
});

test('escribir una sección reemplaza SU cuerpo y no toca las otras', () => {
  const doc = guionPas();
  const r = aplicarOperacion(doc, { op: 'escribir_seccion', seccion: 'PROBLEMA', bloques: [{ tipo: 'texto', texto: 'uno' }, { tipo: 'texto', texto: 'dos' }] });
  const leidos = bloquesDelDoc(r.doc);
  assert.deepEqual(leidos.filter((b) => b.seccion === 'PROBLEMA' && b.tipo !== 'seccion').map((b) => b.texto), ['uno', 'dos']);
  assert.deepEqual(leidos.filter((b) => b.seccion === 'GANCHO' && b.tipo !== 'seccion').map((b) => b.texto), ['texto viejo 1']);
  assert.deepEqual(leidos.filter((b) => b.seccion === 'CTA' && b.tipo !== 'seccion').map((b) => b.texto), ['texto viejo 3']);
  assert.equal(r.nuevos.length, 2);
  assert.equal(textoDeNodo(doc.content?.[3]), 'texto viejo 2', 'el documento de entrada no se toca');
});

test('una sección que el guion no tiene va al final, con su título', () => {
  const r = aplicarOperacion(guionPas(), { op: 'escribir_seccion', seccion: 'PRUEBA', bloques: [{ tipo: 'texto', texto: 'un caso' }] });
  const ult = bloquesDelDoc(r.doc).slice(-2);
  assert.deepEqual(ult.map((b) => [b.tipo, b.seccion, b.texto]), [['seccion', 'PRUEBA', 'Prueba'], ['texto', 'PRUEBA', 'un caso']]);
  assert.equal(r.nuevos.length, 2);
});

test('en una página vacía (la de «Replicar»), la primera sección ocupa el renglón vacío (11/11, quedaba «Escribe "/"…» arriba)', () => {
  const vacia: JsonNodo = { type: 'doc', content: [{ type: 'paragraph', attrs: { bid: 'bvacio1' } }] };
  const r = aplicarOperacion(vacia, { op: 'escribir_seccion', seccion: 'GANCHO', bloques: [{ tipo: 'texto', texto: 'un gancho' }] });
  assert.deepEqual(bloquesDelDoc(r.doc).map((b) => [b.tipo, b.texto]), [['seccion', 'Gancho'], ['texto', 'un gancho']]);
  // Con algo escrito, nada se borra: la sección va al final.
  const conTexto: JsonNodo = { type: 'doc', content: [{ type: 'paragraph', attrs: { bid: 'bcon1' }, content: [{ type: 'text', text: 'mi nota' }] }] };
  const r2 = aplicarOperacion(conTexto, { op: 'escribir_seccion', seccion: 'GANCHO', bloques: [{ tipo: 'texto', texto: 'un gancho' }] });
  assert.deepEqual(bloquesDelDoc(r2.doc).map((b) => b.texto), ['mi nota', 'Gancho', 'un gancho']);
});

test('reemplazar, insertar y borrar apuntan por id; una sobre lo que borró otra se descarta', () => {
  const doc = guionPas();
  const [, p1, , p2] = bids(doc);
  const r = aplicarTodo(doc, [
    { op: 'borrar_bloque', bid: p2 },
    { op: 'reemplazar_bloque', bid: p2, bloques: [{ tipo: 'texto', texto: 'no va' }] },
    { op: 'insertar_despues', bid: p1, bloques: [{ tipo: 'destacado', texto: 'ojo', emoji: '🔥' }] },
    { op: 'insertar_despues', bid: null, bloques: [{ tipo: 'titulo1', texto: 'Arriba de todo' }] },
    { op: 'titulo', texto: 'El nuevo' },
  ]);
  assert.equal(r.descartadas.length, 1);
  assert.equal(r.titulo, 'El nuevo');
  assert.equal(r.doc.content?.[0].type, 'heading');
  assert.equal(r.doc.content?.[0].attrs?.level, 1);
  const i = bids(r.doc).indexOf(p1);
  assert.equal(r.doc.content?.[i + 1].type, 'callout');
  assert.equal(r.doc.content?.[i + 1].attrs?.emoji, '🔥');
  assert.ok(!bids(r.doc).includes(p2));
  assert.equal(r.nuevos.length, 2);
  // Lo que arma la IA lo acepta el saneo del server tal cual (no se pierde nada al guardar).
  const s = sanearContenido(r.doc);
  assert.ok(s.ok);
  assert.deepEqual(bids(s.doc), bids(r.doc));
});

test('los bloques de la IA salen con la forma del esquema (listas con ítems, tareas sin marcar)', () => {
  const t = bloqueAJson({ tipo: 'tareas', items: ['grabar', 'editar'] });
  assert.equal(t.type, 'taskList');
  assert.deepEqual(t.content?.map((i) => i.attrs?.checked), [false, false]);
  const p = bloqueAJson({ tipo: 'texto', texto: 'línea uno\nlínea dos' });
  assert.deepEqual(p.content?.map((n) => n.type), ['text', 'hardBreak', 'text']);
});

test('construyéndose: los cuadros terminan EXACTAMENTE en el resultado, de a un bloque y con el texto creciendo', () => {
  const doc = guionPas();
  const ops: OperacionIA[] = [
    { op: 'escribir_seccion', seccion: 'GANCHO', bloques: [{ tipo: 'texto', texto: 'una frase bastante larga para que crezca por partes' }, { tipo: 'texto', texto: 'otra frase' }] },
  ];
  const cuadros = cuadrosDeConstruccion(doc, ops);
  assert.equal(cuadros.length, 6, 'dos bloques, tres pasos cada uno');
  const final = aplicarOperacion(doc, ops[0]).doc;
  assert.deepEqual(bloquesDelDoc(cuadros[cuadros.length - 1]).map((b) => b.texto), bloquesDelDoc(final).map((b) => b.texto));
  // El primer cuadro: el primer bloque a un tercio, y el segundo todavía no está.
  const primero = bloquesDelDoc(cuadros[0]);
  assert.equal(primero.length, bloquesDelDoc(final).length - 1);
  const t0 = primero.find((b) => b.seccion === 'GANCHO' && b.tipo === 'texto')!.texto;
  assert.ok(t0.length > 0 && t0.length < 'una frase bastante larga para que crezca por partes'.length);
  const original = 'una frase bastante larga para que crezca por partes';
  assert.ok(original.startsWith(t0), 'el corte va desde el principio');
  assert.ok(!/\s$/.test(t0));
  assert.ok([undefined, ' '].includes(original[t0.length]), `el corte va en una palabra entera, no en «${t0}|${original.slice(t0.length)}»`);
});

test('saneadas, construir y aplicar dan el MISMO documento, con los mismos ids (si no, las marcas no encuentran nada)', () => {
  const doc = guionPas();
  const s = sanearOperaciones([
    { op: 'escribir_seccion', seccion: 'GANCHO', bloques: [{ tipo: 'texto', texto: 'nuevo gancho' }] },
    { op: 'escribir_seccion', seccion: 'PRUEBA', bloques: [{ tipo: 'texto', texto: 'un caso' }] },
  ], doc, cat);
  const final = aplicarTodo(doc, s.ops);
  const cuadros = cuadrosDeConstruccion(doc, s.ops);
  assert.deepEqual(cuadros[cuadros.length - 1], final.doc);
  const ultimo = new Set(bids(cuadros[cuadros.length - 1]));
  assert.equal(final.nuevos.length, 3, 'el bloque del gancho, y el título y el texto de la sección nueva');
  for (const b of final.nuevos) assert.ok(ultimo.has(b), `el bloque nuevo ${b} no está en lo que se ve`);
});

test('truncar corta en una palabra entera (nunca a la mitad de una)', () => {
  // 13 letras a la mitad = 7: «abc def|gh». Lo correcto es «abc».
  const b = bloqueAJson({ tipo: 'texto', texto: 'abc defgh ijk' });
  assert.equal(textoDeNodo(truncarBloque(b, 0.5)), 'abc');
});

test('truncar deja la forma del bloque entera y sólo corta el texto', () => {
  const lista = bloqueAJson({ tipo: 'vinetas', items: ['primero largo', 'segundo largo'] });
  const t = truncarBloque(lista, 0.3);
  assert.equal(t.type, 'bulletList');
  assert.equal(t.content?.length, 2, 'los ítems siguen (vacíos si no llegó el texto)');
  assert.ok(sanearContenido({ type: 'doc', content: [t] }).ok);
});

test('con muchísimos bloques, los cuadros respetan el tope y el último es el resultado', () => {
  const doc = guionPas();
  const muchos = Array.from({ length: 50 }, (_, i) => ({ tipo: 'texto' as const, texto: `bloque ${i} con algunas palabras` }));
  const ops: OperacionIA[] = [{ op: 'escribir_seccion', seccion: 'PROBLEMA', bloques: muchos }, { op: 'escribir_seccion', seccion: 'CTA', bloques: muchos }];
  const cuadros = cuadrosDeConstruccion(doc, ops);
  // El número va escrito acá y no leído de la constante: con 110 ms por cuadro (app/copywriter/editor/propuesta.ts), 90 cuadros son ~10 s (segundos, no minutos).
  assert.equal(TOPE_CUADROS, 90);
  assert.ok(cuadros.length <= 90);
  const fin = aplicarTodo(doc, ops).doc;
  assert.deepEqual(bloquesDelDoc(cuadros[cuadros.length - 1]).map((b) => b.texto), bloquesDelDoc(fin).map((b) => b.texto));
});

// ── La tabla (29/10/2026, plantillas reales: docs/plantillas-reales/copywriter.md, trampa 2) ──────────────────
// Sin el bloque `tabla`, «adaptar» la HISTORIA del Reel, el CONTEXTO de las Stories, las SLIDES del Carrusel o los
// GANCHOS convertía la tabla en párrafos, sin un error.

test('la tabla de la IA: se sanea con sus topes, las filas cortas se completan y lo vacío se cae', () => {
  const r = sanearOperaciones([
    { op: 'escribir_seccion', seccion: 'GANCHO', bloques: [{ tipo: 'tabla', filas: [['Escena', 'Locución', 'Cámara'], [1, 'Hola'], ['', '', ''], 'no es fila'] }] },
    { op: 'escribir_seccion', seccion: 'CTA', bloques: [{ tipo: 'tabla', filas: [] }] },
    { op: 'escribir_seccion', seccion: 'PROBLEMA', bloques: [{ tipo: 'tabla', filas: Array.from({ length: 50 }, () => Array.from({ length: 12 }, () => 'x'.repeat(1_500))) }] },
  ], guionPas(), cat);
  assert.equal(r.ops.length, 2, 'una tabla sin filas no es un bloque');
  const b0 = (r.ops[0] as { bloques: { filas: string[][] }[] }).bloques[0];
  assert.deepEqual(b0.filas, [['Escena', 'Locución', 'Cámara'], ['1', 'Hola', '']]);
  const grande = (r.ops[1] as { bloques: { filas: string[][] }[] }).bloques[0].filas;
  assert.deepEqual([grande.length, grande[0].length, grande[0][0].length], [30, 8, 1_000]);
});

test('la tabla sale con la forma de las de las plantillas, pasa el saneo, y escribir la sección la deja tabla', () => {
  const doc = guionPas();
  const tabla = bloqueAJson({ tipo: 'tabla', filas: [['Slide', 'Texto'], ['1 · Portada', '7 preguntas']] });
  assert.deepEqual(tabla.content?.map((f) => f.content?.map((c) => c.type)), [['tableHeader', 'tableHeader'], ['tableCell', 'tableCell']]);
  const fin = aplicarTodo(doc, [{ op: 'escribir_seccion', seccion: 'PROBLEMA', bloques: [{ tipo: 'tabla', filas: [['Slide', 'Texto'], ['1 · Portada', '7 preguntas']] }] }]).doc;
  const s = sanearContenido(fin);
  assert.ok(s.ok);
  const enProblema = bloquesDelDoc(s.ok ? s.doc : fin).filter((b) => b.seccion === 'PROBLEMA' && b.tipo !== 'seccion');
  assert.deepEqual(enProblema.map((b) => b.tipo), ['tabla'], 'la tabla se volvía párrafos');
  assert.match(enProblema[0].texto, /Slide \| Texto\n1 · Portada \| 7 preguntas/);
  // Construyéndose: la tabla aparece con todas sus celdas y el texto crece.
  const medio = truncarBloque(tabla, 0.34);
  assert.deepEqual(medio.content?.map((f) => f.content?.length), [2, 2]);
});
