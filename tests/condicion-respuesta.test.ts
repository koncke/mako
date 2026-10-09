// =============================================================================
// «Si responde» es una CONDITION; el editor de condiciones, más grande y en árbol (sexta tanda)
// =============================================================================
// Pedidos de Martín (09/10/2026):
//   · «General», punto 12: «Reply ya te dije que tiene que estar dentro de CONDITION»;
//   · «CONDITION», punto 1: «primero selecciono el módulo y ahí me aparecen las clases de ese
//     módulo... Esto para TODO»;
//   · punto 4: los «＋ y» / «＋ o» como el «+ Nuevo disparador» de ManyChat, «uno al lado del otro,
//     pero que ocupen todo el ancho».
//
// Lo que fija este archivo:
//   1. la familia «Respuesta» del catálogo no se ofrece en una condición de la salida y nunca se
//      cumple ahí (`seOfrece`, `evaluar`): la decide el clasificador de siempre cuando el lead escribe;
//   2. una condición VACÍA pasa a escuchar (`condicionARespuesta`) sin flecha de entrada, y no se
//      convierte lo que ya decide algo;
//   3. el dato de #212/#213 (el nodo `respuesta`) NO cambia: se dibuja y se edita como condición;
//   4. el árbol de opciones (curso → módulo → clase) guarda los MISMOS valores que la lista plana;
//   5. el editor: el desplegable principal con el campo grande (48) y los placeholders punteados.
//
// PROBADO ROMPIÉNDOLO (09/10/2026): ver el pie.
//
// Correr: npx tsx --test tests/condicion-respuesta.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CONDICIONES, seOfrece, seccionesDeCondiciones, cumpleCatalogo, arbolDeOpciones, esArbol, opcionesDe,
  SECCION_RESPUESTA, type CatalogosCondicion,
} from '../lib/condiciones-catalogo';
import {
  condicionARespuesta, raizRespuesta, padresDe, validarParaGuardar, validarGrafo, normalizar, textoCasoRespuesta,
  ID_INICIO, type PasoGrafo, type HechosLead,
} from '../lib/flujo-grafo';
import { abrirFlujo, quitarIrA } from '../lib/flujo-legado';
import { EditorCondicion, EditorCondicionDeRespuesta } from '../app/chatbot/EditorCondicion';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const ini = (siguiente: string | null): PasoGrafo => ({ id: ID_INICIO, nodo: 'inicio', siguiente } as PasoGrafo);
const msg = (id: string, siguiente: string | null = null): PasoGrafo =>
  ({ id, canal: 'whatsapp', proveedor: 'no_oficial', tipo: 'texto', cuerpo: `hola ${id}`, delay_horas: 0, asunto: null, template_wa: null, siguiente } as PasoGrafo);
const vacia = (id: string, siguiente: string | null, si_no: string | null = null): PasoGrafo =>
  ({ id, nodo: 'condicion', ramas: [{ id: `${id}r`, modo: 'todas', filas: [], siguiente }], si_no } as PasoGrafo);
const pid = (pasos: readonly PasoGrafo[], id: string) => pasos.find((p) => p.id === id)!;
const rnd = () => { let k = 0; return () => ((k++ * 7919) % 100_000) / 100_000 + 0.00001; };

test('⚠️ la familia «Respuesta» no se ofrece en la SALIDA y nunca se cumple ahí', () => {
  const def = CONDICIONES.find((c) => c.id === 'respuesta_trata_de');
  assert.ok(def, 'falta la condición «Su respuesta trata de»');
  assert.equal(def!.evento, 'respuesta');
  assert.equal(def!.seccion, SECCION_RESPUESTA);
  assert.equal(seOfrece(def!, 'adquisicion'), false);
  assert.equal(seOfrece(def!, 'entrega'), false);
  for (const amb of ['adquisicion', 'entrega'] as const) {
    assert.ok(!seccionesDeCondiciones(amb, {}).some((s) => s.title === SECCION_RESPUESTA), `${amb} ofrece la familia Respuesta`);
  }
  assert.equal(cumpleCatalogo({ campo: 'respuesta_trata_de', valor: 'precio' }, {} as HechosLead), false);
});

test('⚠️ una condición VACÍA pasa a escuchar: lo que la apuntaba sigue en lo que seguía, y no lleva flecha de entrada', () => {
  // CRON → m1 → k (vacía) → m2.
  const base = [msg('m1', 'k'), vacia('k', 'm2'), msg('m2'), ini('m1')];
  const r = condicionARespuesta(base, 'k', rnd());
  assert.ok(!('error' in r), JSON.stringify(r));
  if ('error' in r) return;
  assert.equal(pid(r.pasos, 'm1').siguiente, 'm2', 'm1 sigue en lo que seguía');
  assert.equal(raizRespuesta(r.pasos), 'k');
  assert.deepEqual(padresDe(r.pasos, 'k'), [], 'escucha cuando el lead escribe: nadie la apunta');
  const k = pid(r.pasos, 'k');
  assert.equal(k.nodo, 'respuesta');
  assert.equal(k.casos?.length, 1);
  assert.equal(k.casos![0].siguiente, r.ids.mensaje, 'el primer caso: «MaKo contesta»');
  assert.equal(pid(r.pasos, r.ids.mensaje).tipo, 'ia');
  assert.equal(pid(r.pasos, r.ids.mensaje).revisar, true, 'nace como borrador');
  assert.equal(k.si_no, r.ids.otraCosa);
  assert.equal((pid(r.pasos, r.ids.otraCosa!).accion as { operacion: string }).operacion, 'avisar_al_equipo', 'el «Si no» avisa al equipo, como el hand-off de siempre');
  assert.deepEqual(validarParaGuardar(r.pasos), []);
  assert.ok(validarGrafo(r.pasos).includes('un caso de «Si responde» no tiene nombre o descripción'), 'Publicar pide el nombre del caso');
});

test('no se convierte lo que ya decide algo: con filas, con una ya escuchando, o lo que no es una condición', () => {
  const conFilas = [{ id: 'k', nodo: 'condicion', ramas: [{ id: 'kr', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: null }], si_no: null } as PasoGrafo, ini('k')];
  assert.ok('error' in condicionARespuesta(conFilas, 'k'));
  const resp = { id: 'R', nodo: 'respuesta', casos: [], si_no: null } as PasoGrafo;
  assert.ok('error' in condicionARespuesta([vacia('k', null), resp, ini('k')], 'k'));
  assert.ok('error' in condicionARespuesta([msg('m'), ini('m')], 'm'));
  const conParalelo = [{ ...vacia('k', 'a', 'c'), paralelos_si_no: ['b'] } as PasoGrafo, msg('a'), msg('b'), msg('c'), ini('k')];
  assert.ok('error' in condicionARespuesta(conParalelo, 'k'));
});

test('⚠️ #212/#213 NO CAMBIAN: el nodo «Si responde» se abre tal cual (sin conversión de datos)', () => {
  // La forma de #212: la salida y «Si responde» con dos casos (MaKo contesta) y el «Si no» al equipo.
  const resp = {
    id: 'R', nodo: 'respuesta', si_no: 'acc',
    casos: [
      { id: 'c1', titulo: 'Pregunta el precio', cuando: 'pregunta cuánto sale', siguiente: 'ia1' },
      { id: 'c2', titulo: 'Quiere reagendar', cuando: 'pide otro horario', siguiente: 'ia2' },
    ],
  } as PasoGrafo;
  const ia = (id: string) => ({ ...msg(id), tipo: 'ia', revisar: false } as PasoGrafo);
  const acc = { id: 'acc', canal: 'whatsapp', delay_horas: 0, cuerpo: '', accion: { operacion: 'avisar_al_equipo', params: {} }, siguiente: null } as unknown as PasoGrafo;
  const pasos = [msg('m1', 'e'), { id: 'e', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'm2' } as PasoGrafo, msg('m2'), resp, ia('ia1'), ia('ia2'), acc, ini('m1')];
  const abierto = abrirFlujo(pasos, null);
  assert.equal(abierto.convertida, false);
  assert.deepEqual(abierto.pasos, normalizar(pasos), 'el lienzo abre el dato idéntico: lo que corre en vivo es lo mismo');
  assert.equal(quitarIrA(pasos).convertida, false);
  // Y se DICE como condición.
  assert.equal(textoCasoRespuesta({ titulo: 'Pregunta el precio' }), 'Su respuesta trata de «Pregunta el precio»');
});

// ── El árbol de opciones ──
const CAT: CatalogosCondicion = {
  cursos: [
    {
      productoId: 7, nombre: 'Curso A',
      modulos: [{ clave: 'm1', nombre: 'Módulo 1' }, { clave: 'm2', nombre: 'Módulo 2' }],
      clases: [
        { id: 1, titulo: 'Clase 1', modulo: 'm1', tieneTarea: true },
        { id: 2, titulo: 'Clase 2', modulo: 'm1', tieneTarea: false },
        { id: 3, titulo: 'Clase 3', modulo: 'm2', tieneTarea: false },
        { id: 4, titulo: 'Clase huérfana', modulo: 'mx', tieneTarea: false },
      ],
    },
    { productoId: 8, nombre: 'Curso B', modulos: [{ clave: 'u', nombre: 'Único' }], clases: [{ id: 9, titulo: 'Clase B', modulo: 'u', tieneTarea: true }] },
  ],
};
const valores = (niveles: ReturnType<typeof arbolDeOpciones>): string[] =>
  niveles.flatMap((n) => [...n.options.map((o) => o.value), ...valores(n.grupos ?? [])]).sort();

test('⚠️ el ÁRBOL: curso → módulo → clase, con los MISMOS valores que la lista plana', () => {
  const arbol = arbolDeOpciones('clase', CAT);
  assert.ok(esArbol(arbol));
  assert.deepEqual(arbol.map((n) => n.title), ['Curso A', 'Curso B']);
  const a = arbol[0];
  assert.deepEqual(a.grupos?.map((g) => g.title), ['Módulo 1', 'Módulo 2', 'Sin módulo'], 'la clase de un módulo que ya no está va igual');
  assert.deepEqual(a.grupos![0].options.map((o) => o.label), ['Clase 1', 'Clase 2']);
  // Un curso con UN módulo: el módulo sube (elegirlo sería un clic que no decide nada).
  assert.deepEqual(arbol[1].options.map((o) => o.label), ['Clase B']);
  assert.equal(arbol[1].grupos, undefined);
  const plano = opcionesDe('clase', CAT).flatMap((s) => s.options.map((o) => o.value)).sort();
  assert.deepEqual(valores(arbol), plano, 'el árbol cambia cómo se elige, no qué se guarda');
  // Con tarea: sólo las que la tienen.
  assert.deepEqual(valores(arbolDeOpciones('clase_tarea', CAT)), ['1', '9']);
  // Los módulos, por curso.
  const mod = arbolDeOpciones('modulo', CAT);
  assert.deepEqual(valores(mod), opcionesDe('modulo', CAT).flatMap((s) => s.options.map((o) => o.value)).sort());
});

test('un solo curso con un solo módulo no se dibuja como árbol', () => {
  const uno: CatalogosCondicion = { cursos: [CAT.cursos![1]] };
  const a = arbolDeOpciones('clase', uno);
  assert.equal(esArbol(a), false);
  assert.deepEqual(a, [{ title: '', options: [{ value: '9', label: 'Clase B' }] }]);
});

// ── El editor ──
test('⚠️ EDITOR: una condición vacía muestra «＋ Condición» como placeholder de 48, punteado y a todo el ancho', () => {
  const html = renderToStaticMarkup(createElement(EditorCondicion, {
    paso: { ramas: [{ id: 'r', modo: 'todas', filas: [], siguiente: null }] }, cambiar: () => {}, ambito: 'adquisicion',
    etapas: [], productos: [], busy: false, onQuitarRama: () => {}, catalogos: null, onPasarARespuesta: () => {},
  }));
  assert.match(html, /＋ Condición/);
  assert.match(html, /min-height:48px/);
  assert.match(html, /border:1\.5px dashed var\(--border-strong\)/);
  assert.match(html, /justify-content:center/);
});

test('⚠️ EDITOR: con una fila, el desplegable principal es el campo grande y «＋ y» / «＋ o» van LADO A LADO', () => {
  const html = renderToStaticMarkup(createElement(EditorCondicion, {
    paso: { ramas: [{ id: 'r', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: null }] }, cambiar: () => {}, ambito: 'adquisicion',
    etapas: [], productos: [], busy: false, onQuitarRama: () => {}, catalogos: null,
  }));
  assert.match(html, /＋ y/);
  assert.match(html, /＋ o/);
  // Dos placeholders + el desplegable de la fila: al menos tres con el alto de la casa.
  assert.ok((html.match(/min-height:48px/g) ?? []).length >= 3, 'el desplegable principal no es el campo grande');
  // Lado a lado: los dos en el mismo renglón flex, repartiéndolo.
  const i = html.indexOf('＋ y');
  const j = html.indexOf('＋ o');
  const fila = html.lastIndexOf('display:flex;gap:8px;width:100%', i);
  assert.ok(fila >= 0 && fila < i && i < j, 'los dos placeholders no están en el mismo renglón');
  const src = sinComentarios(leer('app/chatbot/EditorCondicion.tsx'));
  assert.match(src, /<FilaFrase[\s\S]{0,400}?\/>/);
  assert.match(src, /buttonStyle=\{botonGrande\}/, 'el desplegable principal no usa el campo grande');
});

test('⚠️ EDITOR: «Su respuesta trata de» se ofrece SÓLO en una condición vacía y con alguien que la convierta', () => {
  const src = sinComentarios(leer('app/chatbot/EditorCondicion.tsx'));
  assert.match(src, /const secciones: SeccionOpciones\[\] = vacia && onPasarARespuesta\s*\?/);
  assert.match(src, /if \(d\?\.id === ID_RESPUESTA\) \{ onPasarARespuesta\?\.\(\); return; \}/, 'elegirla no puede agregar una fila: convierte la tarjeta');
  assert.match(src, /const deLaSalida = secciones\.filter\(\(s\) => s\.title !== SECCION_RESPUESTA\);/, 'después de una fila sólo va lo de la salida');
});

test('⚠️ EDITOR de la condición que escucha: una frase grande por caso, «o» entre casos, «＋ o» y el «Si no»', () => {
  const html = renderToStaticMarkup(createElement(EditorCondicionDeRespuesta, {
    busy: false,
    r: {
      casos: [{ id: 'c1', titulo: 'Precio', cuando: 'pregunta el precio', siguiente: null }, { id: 'c2', titulo: '', cuando: '', siguiente: null }],
      cambiarCasos: () => {}, onAgregarCaso: () => {}, onQuitarCaso: () => {}, onVerSiNo: () => {},
    },
  }));
  assert.equal((html.match(/Su respuesta trata de/g) ?? []).length, 2);
  assert.match(html, />o</);
  assert.match(html, /＋ o/);
  assert.match(html, /Si no/);
  assert.match(html, /Ver/);
  assert.ok((html.match(/min-height:48px/g) ?? []).length >= 3, 'la frase de cada caso y el «＋ o» van con el campo grande');
});

test('⚠️ el lienzo edita «Si responde» con el editor de CONDITION y GO TO se pasa a flecha (FlujoLienzo)', () => {
  const src = sinComentarios(leer('app/chatbot/FlujoLienzo.tsx'));
  const resp = src.slice(src.indexOf('function EditorRespuesta('), src.indexOf('\n}\n', src.indexOf('function EditorRespuesta(')));
  assert.match(resp, /<EditorCondicionDeRespuesta /);
  const ir = src.slice(src.indexOf('function EditorIrA('), src.indexOf('\n}\n', src.indexOf('function EditorIrA(')));
  assert.match(ir, /quitarIrA\(prev, \{ solo: id \}\)\.pasos/);
  assert.doesNotMatch(ir, /tarjetasParaIrA/, 'GO TO ya no elige destino');
});

// ── Roturas (09/10/2026) ─────────────────────────────────────────────────────────────────────
// Una por vez, restaurada DE MEMORIA (arnés en el scratchpad, tolera CRLF). Base: 11 / 0. Pasan / fallan:
//   R1. `seOfrece` sin mirar `evento` (la familia se ofrece en la salida)              → 10 / 1
//   R2. `condicionARespuesta` no reconecta lo que apuntaba a la condición               → 10 / 1
//   R3. `condicionARespuesta` convierte una condición con filas                         → 10 / 1
//   R4. las clases sin árbol (lista plana)                                              → 10 / 1
//   R5. `colapsar` sube el nivel de adentro con SU nombre (el módulo en vez del curso)  → 10 / 1
//   R6. el placeholder sin el borde punteado                                            → 10 / 1
//   R7. «＋ y» / «＋ o» uno abajo del otro                                              → 10 / 1
//   R8. el desplegable principal sin el campo grande                                    → 10 / 1
//   R9. «Su respuesta trata de» ofrecida también en una condición con filas             → 10 / 1
//   R10. `evaluar` de la familia dice «sí» en la salida                                 → 10 / 1
