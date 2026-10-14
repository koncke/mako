// =============================================================================
// editor-landing-insertar — el esquema del editor, los bloques del catálogo y las secciones
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing Generator" un
// editor de landing tipo GAMMA. Replica por completo a Gamma, que se pueda hacer todo lo que ahí
// se hace.» Lo que se prueba acá, en node y con el esquema REAL del editor (getSchema sobre las
// extensiones de app/landing-generator/editor/extensiones, sin montar React):
//
//   · cada IdBloque del catálogo tiene su `case` en insertar.ts y arma un bloque que el esquema
//     del editor acepta adentro de una sección Y que el saneo del server guarda sin descartes
//     (si no, el bloque se ve al insertarlo y desaparece al recargar);
//   · el esquema es IGUAL de permisivo que el saneo: lo que sanearContenido deja pasar se carga
//     en el editor (si fuera más estricto, TipTap abriría un documento vacío sin avisar);
//   · moverTarjeta no pierde ni duplica contenido, en todas las combinaciones;
//   · duplicar deja ids únicos; ante una sección pegada con un id repetido, el que conserva su id
//     es el ORIGINAL (aunque la copia quede arriba);
//   · borrar devuelve el MISMO nodo; combinar y partir no pierden bloques; «---» parte la sección.
//
// ── ROTURAS (11/10/2026, arnés que restaura DE MEMORIA y verifica el hash; base: 13 pasan, 0 fallan) ──
//   · sin el `case 'tabla-4'` en bloqueJson                         -> 11 / 2 (el del fuente y el del esquema)
//   · `columna` con content 'paragraph+' (más estricto que el saneo) -> 9 / 4 (content exacto, plantillas,
//     bloques del catálogo e insertar)
//   · moverTarjeta mide el destino en el documento de ANTES          -> 12 / 1 (moverTarjeta)
//     ⚠️ La PRIMERA corrida dio 13 / 0: todas las secciones del test medían lo mismo y la posición
//        equivocada coincidía con la buena. Se pasó a secciones de tamaños distintos.
//   · ids: gana la primera de arriba (sin mirar quién existía)       -> 12 / 1 (ids únicos)
//   · duplicar con el mismo id                                       -> 12 / 1 (duplicar)
//   · borrar devuelve una copia con otro id                          -> 12 / 1 (borrar)
//   · partirEn no saca la línea «---»                                -> 12 / 1 («---»)
//   · la regla «---» de plugins.ts sin `quitarBloque`                -> 12 / 1 («---», lo lee del fuente)
//   · combinar sin el contenido de la sección de abajo               -> 12 / 1 (combinar y partir)
//   · insertar sin reemplazar la línea vacía                         -> 12 / 1 (insertar un bloque)
//   · el formulario nuevo con dos campos «nombre» (el saneo tira uno) -> 12 / 1 (bloques del catálogo)
// =============================================================================

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proyecto.supabase.co';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSchema } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import type { Schema } from '@tiptap/pm/model';
import { extensionesBase } from '../app/landing-generator/editor/extensiones/esquema';
import { trIdsUnicos } from '../app/landing-generator/editor/extensiones/plugins';
import {
  bloqueJson, seccionesDe, trMoverTarjeta, trDuplicarTarjeta, trBorrarTarjeta, trCombinarConAnterior,
  trPartirTarjeta, trInsertarBloque, trInsertarTarjeta, partirEn,
} from '../app/landing-generator/editor/insertar';
import { BLOQUES } from '../lib/editor-landing/catalogo-bloques';
import { NODO, docPagina, type JsonNodo } from '../lib/editor-landing/doc';
import { sanearContenido, CONTENIDO_TIPTAP } from '../lib/editor-landing/validar';
import { PLANTILLAS, DISENOS_SECCION } from '../lib/editor-landing/plantillas';
import { DISENOS_LANDING, OBJETIVOS_LANDING, landingDesde } from '../lib/editor-landing/disenos-landing';

const RAIZ = join(import.meta.dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const IMG = 'https://proyecto.supabase.co/storage/v1/object/public/landing-imagenes/7/3f2a9c1e-uuid.png';
const VID = 'https://proyecto.supabase.co/storage/v1/object/public/landing-imagenes/7/3f2a9c1e-uuid.mp4';

const schema: Schema = getSchema(extensionesBase());

const p = (t: string): JsonNodo => ({ type: 'paragraph', content: [{ type: 'text', text: t }] });
const seccion = (id: string, ...bloques: JsonNodo[]): JsonNodo => ({ type: NODO.tarjeta, attrs: { id }, content: bloques.length ? bloques : [p(id)] });
const estado = (...tarjetas: JsonNodo[]) => EditorState.create({ schema, doc: schema.nodeFromJSON({ type: 'doc', content: tarjetas }) });
const ids = (s: EditorState) => seccionesDe(s.doc).map((x) => x.id);
const textos = (s: EditorState) => seccionesDe(s.doc).map((x) => x.nodo.textContent);

test('cada IdBloque del catálogo tiene su case en bloqueJson (leído del fuente)', () => {
  const src = sinComentarios(leer('app/landing-generator/editor/insertar.ts'));
  const cuerpo = src.slice(src.indexOf('export function bloqueJson'), src.indexOf('export const PIDEN_ARCHIVO'));
  assert.ok(cuerpo.length > 1000, 'no se encontró el cuerpo de bloqueJson');
  const faltan = BLOQUES.filter((b) => !cuerpo.includes(`case '${b.id}':`)).map((b) => b.id);
  assert.deepEqual(faltan, []);
});

test('cada bloque del catálogo se acepta en una sección y el server lo guarda sin descartes', () => {
  const malos: string[] = [];
  for (const b of BLOQUES) {
    const url = b.id === 'video-subir' ? VID : IMG;
    const json = bloqueJson(b.id, { url });
    if (!json) { malos.push(`${b.id}: null`); continue; }
    try {
      schema.nodeFromJSON({ type: 'doc', content: [seccion('tA', json)] }).check();
    } catch (e) {
      malos.push(`${b.id}: el esquema lo rechaza (${(e as Error).message})`);
      continue;
    }
    // Los insertados entran vacíos a propósito (su NodeView pide el enlace): desde la integración
    // (11/10/2026) el server los guarda como MARCADOR, sin descarte, así que también entran acá.
    const r = sanearContenido({ v: 1, paginas: [{ id: 'p1', titulo: 'Inicio', ruta: '', doc: docPagina([seccion('tA', json)]) }] });
    if (r.descartes.length) malos.push(`${b.id}: ${r.descartes.join(' | ')}`);
  }
  assert.deepEqual(malos, []);
});

test('los bloques de imagen y video no se insertan sin URL', () => {
  for (const id of ['imagen', 'imagen-buscar', 'imagen-url', 'video-subir'] as const) assert.equal(bloqueJson(id), null);
});

test('el content de cada nodo del editor es EXACTAMENTE CONTENIDO_TIPTAP', () => {
  const distintos = Object.entries(CONTENIDO_TIPTAP)
    .filter(([n]) => schema.nodes[n] && !['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'taskList', 'taskItem', 'blockquote', 'table', 'tableRow', 'tableCell', 'tableHeader'].includes(n))
    .filter(([n, c]) => schema.nodes[n].spec.content !== c)
    .map(([n]) => n);
  assert.deepEqual(distintos, []);
  assert.equal(schema.nodes[NODO.boton].spec.marks, '');
});

test('lo que el saneo deja pasar (las plantillas y los diseños de sección) se carga en el editor', () => {
  const rechazados: string[] = [];
  for (const pl of PLANTILLAS) {
    const { contenido } = sanearContenido(pl.contenido());
    for (const pg of contenido.paginas) {
      try { schema.nodeFromJSON(pg.doc).check(); } catch (e) { rechazados.push(`${pl.id}/${pg.ruta || 'inicio'}: ${(e as Error).message}`); }
    }
  }
  for (const d of DISENOS_SECCION) {
    try { schema.nodeFromJSON({ type: 'doc', content: [d.crear()] }).check(); } catch (e) { rechazados.push(`diseño ${d.id}: ${(e as Error).message}`); }
  }
  assert.deepEqual(rechazados, []);
});

// Los cruces diseño × objetivo (14/10/2026: el VSL del diseño mete un insertado en una COLUMNA del hero
// y la pista del proveedor en el insertado vacío). Que el saneo los deje pasar no alcanza: si el esquema
// no los acepta, TipTap abre la landing nueva VACÍA. Y sin perder nodos ni la pista (un atributo que el
// nodo no declara, TipTap lo tira al cargar sin avisar).
// Rotura (14/10/2026, en memoria, restaurada y verificada por hash; base: 14 pasan, 0 fallan): el nodo
// `insertado` de TipTap sin declarar `proveedor` (nodos.ts) → 13 / 1, sólo éste: el esquema carga igual
// y la pista se pierde callada.
test('los cruces de DISENOS_LANDING se cargan en el editor sin perder nodos ni la pista del video', () => {
  const contar = (n: { content?: unknown[] }): number => 1 + (n.content ?? []).reduce<number>((s, h) => s + contar(h as { content?: unknown[] }), 0);
  const mal: string[] = [];
  let pistas = 0;
  for (const d of DISENOS_LANDING) {
    for (const o of OBJETIVOS_LANDING) {
      const { contenido } = sanearContenido(landingDesde(d, o.id)!);
      for (const pg of contenido.paginas) {
        try {
          const doc = schema.nodeFromJSON(pg.doc);
          doc.check();
          const vuelta = doc.toJSON() as JsonNodo;
          if (contar(vuelta) !== contar(pg.doc)) mal.push(`${d.id} × ${o.id}/${pg.ruta || 'inicio'}: ${contar(pg.doc)} nodos → ${contar(vuelta)}`);
          doc.descendants((n) => { if (n.type.name === NODO.insertado && !n.attrs.src && n.attrs.proveedor === 'youtube') pistas++; });
        } catch (e) {
          mal.push(`${d.id} × ${o.id}/${pg.ruta || 'inicio'}: ${(e as Error).message}`);
        }
      }
    }
  }
  assert.deepEqual(mal, []);
  assert.ok(pistas >= DISENOS_LANDING.filter((d) => d.video).length * OBJETIVOS_LANDING.length, `la pista del video se perdió al cargar (${pistas})`);
});

test('moverTarjeta: todas las combinaciones, sin perder ni duplicar', () => {
  const base = ['a', 'b', 'c', 'd', 'e'];
  // Secciones de TAMAÑOS distintos (más letras y más bloques cuanto más abajo): con todas del
  // mismo tamaño, una posición calculada sobre el documento de ANTES de sacar la sección daba
  // igual que la buena, y el test pasaba sobre ese bug (medido en la primera corrida del arnés).
  const textoDe = (x: string, i: number) => `texto ${x.repeat(i * 3 + 1)}`;
  const armar = () => estado(...base.map((x, i) => seccion(`t${x}`, ...Array.from({ length: i + 1 }, () => p(textoDe(x, i))))));
  for (let desde = 0; desde < base.length; desde++) {
    for (let hasta = 0; hasta < base.length; hasta++) {
      const s = armar();
      const tr = trMoverTarjeta(s, desde, hasta);
      if (desde === hasta) { assert.equal(tr, null); continue; }
      assert.ok(tr, `${desde}→${hasta}`);
      const s2 = s.apply(tr!);
      const esperado = [...base];
      const [x] = esperado.splice(desde, 1);
      esperado.splice(hasta, 0, x);
      assert.deepEqual(ids(s2), esperado.map((y) => `t${y}`), `${desde}→${hasta}`);
      // Cada sección conserva su contenido entero (sus bloques y su texto), y no hay de más.
      const textoEsperado = (y: string) => { const i = base.indexOf(y); return textoDe(y, i).repeat(i + 1); };
      assert.deepEqual(textos(s2), esperado.map(textoEsperado), `${desde}→${hasta}`);
      assert.equal(s2.doc.content.size, s.doc.content.size);
    }
  }
  assert.equal(trMoverTarjeta(estado(seccion('ta')), 0, 3), null);
});

test('duplicar: la copia va debajo, con el mismo contenido y un id nuevo', () => {
  const s = estado(seccion('ta', p('uno')), seccion('tb', p('dos')));
  const r = trDuplicarTarjeta(s, 'ta');
  assert.ok(r);
  const s2 = s.apply(r!.tr);
  const lista = ids(s2);
  assert.equal(lista.length, 3);
  assert.equal(new Set(lista).size, 3);
  assert.deepEqual([lista[0], lista[2]], ['ta', 'tb']);
  assert.equal(lista[1], r!.id);
  assert.deepEqual(textos(s2), ['uno', 'uno', 'dos']);
});

test('ids únicos: la sección pegada con un id repetido cambia, el original conserva el suyo', () => {
  const s = estado(seccion('ta', p('original')), seccion('tb', p('otra')));
  const copia = schema.nodeFromJSON(seccion('ta', p('copia')));
  // Pegada ARRIBA del original: la primera de arriba ya no es la que tiene que ganar.
  const tr = s.tr.insert(0, copia);
  const s2 = s.apply(tr);
  const fix = trIdsUnicos([tr], s, s2);
  assert.ok(fix);
  const s3 = s2.apply(fix!);
  const secs = seccionesDe(s3.doc);
  assert.equal(secs.find((x) => x.nodo.textContent === 'original')!.id, 'ta');
  assert.notEqual(secs.find((x) => x.nodo.textContent === 'copia')!.id, 'ta');
  assert.equal(new Set(ids(s3)).size, 3);
  // Y un id inválido (o ninguno) se completa.
  const sinId = EditorState.create({ schema, doc: schema.nodeFromJSON({ type: 'doc', content: [{ type: NODO.tarjeta, content: [p('x')] }] }) });
  const fix2 = trIdsUnicos([], null, sinId);
  assert.ok(fix2);
  assert.match(ids(sinId.apply(fix2!))[0], /^[A-Za-z0-9_-]{1,60}$/);
});

test('borrar devuelve el MISMO nodo; si era la única, queda una en blanco', () => {
  const s = estado(seccion('ta', p('uno')), seccion('tb', p('dos')));
  const r = trBorrarTarjeta(s, 'tb');
  assert.ok(r);
  assert.equal(r!.nodo.attrs.id, 'tb');
  assert.equal(r!.reemplazo, null);
  const s2 = s.apply(r!.tr);
  assert.deepEqual(ids(s2), ['ta']);
  // Deshacer = volver a poner el MISMO nodo en su lugar: el documento queda igual al de antes.
  const s3 = s2.apply(s2.tr.insert(r!.pos, r!.nodo));
  assert.ok(s3.doc.eq(s.doc));
  const unica = estado(seccion('ta', p('sola')));
  const r2 = trBorrarTarjeta(unica, 'ta');
  assert.ok(r2?.reemplazo);
  assert.deepEqual(ids(unica.apply(r2!.tr)), [r2!.reemplazo]);
});

test('combinar con lo anterior junta el contenido; partir lo separa sin perder bloques', () => {
  const s = estado(seccion('ta', p('a1'), p('a2')), seccion('tb', p('b1')));
  const tr = trCombinarConAnterior(s, 'tb');
  assert.ok(tr);
  const s2 = s.apply(tr!);
  assert.deepEqual(ids(s2), ['ta']);
  assert.equal(seccionesDe(s2.doc)[0].nodo.childCount, 3);
  assert.equal(trCombinarConAnterior(s, 'ta'), null);
  // Partir a la altura del bloque «b1» (índice 2): vuelve a haber dos.
  let pos = 0;
  s2.doc.descendants((n, p0) => { if (n.isText && n.text === 'b1') pos = p0; });
  const r = trPartirTarjeta(s2, pos);
  assert.ok(r);
  const s3 = s2.apply(r!.tr);
  assert.deepEqual(ids(s3), ['ta', r!.id]);
  assert.deepEqual(textos(s3), ['a1a2', 'b1']);
});

test('«---» (partirEn quitando la línea) parte la sección y saca la línea', () => {
  const s = estado(seccion('ta', p('arriba'), p('---'), p('abajo')));
  const tr = s.tr;
  const id = partirEn(tr, 0, 1, { quitarBloque: true });
  assert.ok(id);
  const s2 = s.apply(tr);
  assert.deepEqual(textos(s2), ['arriba', 'abajo']);
  assert.equal(new Set(ids(s2)).size, 2);
  // La regla del input rule vive en plugins.ts y llama a partirEn con quitarBloque:
  const src = sinComentarios(leer('app/landing-generator/editor/extensiones/plugins.ts'));
  assert.ok(/find:\s*\/\^---\$\//.test(src), 'la regla «---» no está en plugins.ts');
  assert.ok(/partirEn\(state\.tr,.*quitarBloque:\s*true/.test(src), 'la regla «---» no parte la sección con partirEn');
});

test('insertar un bloque: en una línea vacía la reemplaza; columnas adentro de una columna van después', () => {
  const s = estado(seccion('ta', { type: 'paragraph' }));
  const tr = trInsertarBloque(s, bloqueJson('tabla-2')!, { pos: 2 });
  assert.ok(tr);
  const s2 = s.apply(tr!);
  assert.deepEqual(seccionesDe(s2.doc)[0].nodo.content.content.map((n) => n.type.name), ['table']);
  // Cursor adentro de una columna: unas columnas nuevas no caben ahí y van después del bloque.
  const conCols = estado(seccion('ta', bloqueJson('columnas-2')!));
  let enColumna = 0;
  conCols.doc.descendants((n, p0) => { if (!enColumna && n.type.name === 'paragraph') enColumna = p0 + 1; });
  const tr2 = trInsertarBloque(conCols, bloqueJson('columnas-3')!, { pos: enColumna });
  assert.ok(tr2);
  const hijos = seccionesDe(conCols.apply(tr2!).doc)[0].nodo.content.content.map((n) => n.type.name);
  assert.deepEqual(hijos, [NODO.columnas, NODO.columnas]);
});

test('insertar una sección: un id repetido se reemplaza por uno nuevo', () => {
  const s = estado(seccion('ta'), seccion('tb'));
  const r = trInsertarTarjeta(s, 1, seccion('ta', p('nueva')));
  assert.ok(r);
  assert.notEqual(r!.id, 'ta');
  assert.deepEqual(ids(s.apply(r!.tr)), ['ta', r!.id, 'tb']);
});
