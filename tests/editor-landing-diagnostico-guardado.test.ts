// =============================================================================
// El Diagnóstico de una landing NUESTRA (tanda 6): el puntaje guardado, todas las páginas y la lectura
// =============================================================================
// Pendientes de la tanda 2 (docs/hallazgos-editor-landing.md): «Sólo se analiza la página de inicio y el
// puntaje de una landing nuestra no se guarda». Y de las piezas de la tanda 6: una landing nuestra
// ignoraba la lectura del navegador (el corte del `docId` iba antes de mirarla). Lo que fija:
//   1. el puntaje va a `landing_docs.diagnostico` (mig 0281) saneado con la escala del Landing Analyst y
//      vuelve igual; la columna que falta se reconoce al LEER (42703) y al ESCRIBIR (PGRST204);
//   2. el texto que se analiza es el de TODAS las páginas (inicio primero, cada una con su renglón) y
//      cada cita se ubica en su sección aunque sea de otra página;
//   3. la lectura del navegador suma lo probado, y el texto sigue saliendo del documento;
//   4. el cableado de diagnostico-server.ts (server-only: se lee del FUENTE, sin comentarios).
//
// PROBADO ROMPIÉNDOLO (14/10/2026): base en verde (11 pasan / 0 fallan), una rotura por vez, restaurada
// de memoria (sha256 igual después de cada una). Pasan / fallan:
//   · aColumna guarda el score crudo, sin `resumenDeAnalisis`                       -> 10 / 1
//   · esColumnaQueFalta mira sólo el 42703 (el update sin la 0281 tira)             -> 10 / 1
//   · deColumna devuelve un puntaje vacío en vez de null                            -> 10 / 1
//   · textoDeLanding sólo con la página de inicio (lo de antes)                     -> 8 / 3
//   · textoDeLanding en el orden guardado (el inicio no va primero)                 -> 9 / 2
//   · textoDeLanding sin el renglón «— Página «X» —»                                -> 9 / 2
//   · las palabras cuentan los renglones de página                                  -> 10 / 1
//   · el tope deja afuera también la página de inicio                               -> 10 / 1
//   · paginaDeNuestra tira la lectura                                               -> 10 / 1
//   · server: analizarNuestra recibe null en vez de la lectura                      -> 10 / 1
//   · server: el corte del docId vuelve a ir antes de sanear la lectura (lo de antes) -> 10 / 1
//   · server: el puntaje no se guarda (lo de antes)                                 -> 10 / 1
//   · server: guardar el puntaje TIRA con otro error                                -> 10 / 1
//   · server: listar de una nuestra vuelve a `resumen: null` (lo de antes)          -> 10 / 1
//   · server: leer el puntaje tolera cualquier error, no sólo la columna            -> 10 / 1
//   · la 0281 sin `if not exists`                                                   -> 10 / 1
// Dos dieron VERDE la primera vez y se corrigió el TEST: el PGRST204 lo atrapaba igual el mensaje
// (ahora hay un caso sin mensaje) y el tope de 120 no alcanzaba a cortar el inicio (ahora uno de 10).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  aColumna, deColumna, esColumnaQueFalta, paginaDeNuestra, paginaDeSeccion, renglonDePagina, textoDeLanding,
} from '../lib/editor-landing/diagnostico-guardado';
import { bloquesDeTexto, paginaPrincipal, textoParaAnalisis, ubicarCitaEnBloques } from '../lib/editor-landing/diagnostico';
import { NODO, type JsonNodo, type LandingContenido } from '../lib/editor-landing/doc';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const sinComentariosSql = (s: string) => s.replace(/^\s*--.*$/gm, '');

const t = (texto: string): JsonNodo => ({ type: 'text', text: texto });
const p = (texto: string): JsonNodo => ({ type: 'paragraph', content: [t(texto)] });
const tarjeta = (id: string, hijos: JsonNodo[], oculta = false): JsonNodo => ({ type: NODO.tarjeta, attrs: { id, oculta }, content: hijos });
const pagina = (id: string, titulo: string, ruta: string, tarjetas: JsonNodo[]) => ({ id, titulo, ruta, doc: { type: 'doc' as const, content: tarjetas } });

/** Tres páginas: la de gracias PRIMERA en la lista (el inicio igual va primero), una vacía y una oculta. */
const CONTENIDO: LandingContenido = {
  v: 1,
  paginas: [
    pagina('p2', 'Gracias', 'gracias', [tarjeta('tg', [p('Gracias por tu compra, te escribimos hoy mismo.')])]),
    pagina('p1', 'Inicio', '', [
      tarjeta('t1', [p('Vende más con tu landing y convierte visitas en clientes.')]),
      tarjeta('t2', [p('Esto está oculto')], true),
    ]),
    pagina('p3', '', 'vacia', [tarjeta('tv', [p('Sólo oculto')], true)]),
    pagina('p4', '', 'precios', [tarjeta('tp', [p('El plan anual cuesta menos que dos meses de anuncios.')])]),
  ],
};

// ── 1. El puntaje guardado ────────────────────────────────────────────────────

test('el puntaje va a la columna saneado (0-10 con una décima) y vuelve igual, también pasando por jsonb', () => {
  const fecha = '2026-10-14T15:00:00.000Z';
  const col = aColumna({ score: 6.84, veredicto: '  Promesa clara,   prueba floja ', resumen: 'Hace bien X.', hallazgos: [{ titulo: 'no va' }] }, fecha);
  assert.deepEqual(col, { score: 6.8, veredicto: 'Promesa clara, prueba floja', resumen: 'Hace bien X.', analyzed_at: fecha });
  assert.deepEqual(deColumna(JSON.parse(JSON.stringify(col))), { score: 6.8, veredicto: 'Promesa clara, prueba floja', resumen: 'Hace bien X.', analizado: fecha });
  // Fuera de escala se acota; uno ilegible queda null, nunca un número inventado.
  assert.equal(aColumna({ score: 72 }, fecha).score, 10);
  assert.equal(aColumna({ score: 'siete' }, fecha).score, null);
  assert.equal(aColumna({ score: null, veredicto: 'x' }, fecha).score, null);
});

test('lo que no es un puntaje guardado se lee como «sin puntaje», y una fecha rota no se inventa', () => {
  for (const raro of [null, undefined, 'texto', 7, [], {}, { score: null, veredicto: '', resumen: '' }]) {
    assert.equal(deColumna(raro), null, JSON.stringify(raro));
  }
  assert.deepEqual(deColumna({ score: 5, analyzed_at: 'ayer' }), { score: 5, veredicto: null, resumen: null, analizado: null });
});

test('la columna que falta: 42703 al leer, PGRST204 al escribir; otro error no es eso', () => {
  assert.equal(esColumnaQueFalta({ code: '42703', message: 'column landing_docs.diagnostico does not exist' }), true);
  assert.equal(esColumnaQueFalta({ code: 'PGRST204', message: "Could not find the 'diagnostico' column of 'landing_docs' in the schema cache" }), true);
  // Por el CÓDIGO, no sólo por el mensaje (el mensaje de PostgREST cambia entre versiones).
  assert.equal(esColumnaQueFalta({ code: 'PGRST204', message: '' }), true);
  assert.equal(esColumnaQueFalta({ message: 'column landing_docs.diagnostico does not exist' }), true, 'sin código, por el mensaje');
  assert.equal(esColumnaQueFalta({ code: '42P01', message: 'relation "landing_docs" does not exist' }), false, 'la TABLA no es la columna');
  assert.equal(esColumnaQueFalta({ code: '', message: 'fetch failed' }), false);
  assert.equal(esColumnaQueFalta(null), false);
});

// ── 2. Todas las páginas ──────────────────────────────────────────────────────

test('se analizan TODAS las páginas: inicio primero, cada una con su renglón, sin las vacías ni lo oculto', () => {
  const r = textoDeLanding(CONTENIDO);
  assert.deepEqual(r.bloques.map((b) => b.id), ['t1', 'tg', 'tp']);
  assert.equal(r.texto, [
    renglonDePagina('Inicio'), 'Vende más con tu landing y convierte visitas en clientes.',
    renglonDePagina('Gracias'), 'Gracias por tu compra, te escribimos hoy mismo.',
    renglonDePagina('/precios'), 'El plan anual cuesta menos que dos meses de anuncios.',
  ].join('\n\n'));
  assert.equal(renglonDePagina('Gracias'), '— Página «Gracias» —');
  assert.equal(r.paginas, 3);
  assert.equal(r.afuera, 0);
  // Las palabras son las del COPY: los renglones de página no inflan el piso del análisis.
  assert.equal(r.palabras, 10 + 8 + 10);
  assert.doesNotMatch(r.texto, /oculto/i);
});

test('cada cita se ubica en SU sección aunque viva en otra página, y el recorrido sabe a cuál saltar', () => {
  const { bloques } = textoDeLanding(CONTENIDO);
  assert.equal(ubicarCitaEnBloques('«cuesta menos que dos meses de anuncios»', bloques), 'tp');
  assert.equal(ubicarCitaEnBloques('Gracias por tu compra', bloques), 'tg');
  assert.equal(ubicarCitaEnBloques('Esto está oculto', bloques), null);
  assert.equal(paginaDeSeccion(CONTENIDO, 'tp')?.id, 'p4');
  assert.equal(paginaDeSeccion(CONTENIDO, 't1')?.id, 'p1');
  assert.equal(paginaDeSeccion(CONTENIDO, 'no-existe'), null);
  assert.equal(paginaDeSeccion(CONTENIDO, null), null);
});

test('una landing de UNA página se analiza igual que antes (sin renglón), y el tope deja afuera páginas enteras', () => {
  const una: LandingContenido = { v: 1, paginas: [CONTENIDO.paginas[1]] };
  const r = textoDeLanding(una);
  assert.equal(r.texto, textoParaAnalisis(bloquesDeTexto(paginaPrincipal(una))));
  assert.doesNotMatch(r.texto, /Página «/);
  // Con un tope chico entra el inicio (siempre) y lo que no cabe queda afuera ENTERO, contado.
  const chico = textoDeLanding(CONTENIDO, 120);
  assert.deepEqual(chico.bloques.map((b) => b.id), ['t1']);
  assert.equal(chico.afuera, 2);
  // Aunque el inicio solo ya pase el tope: sin él no hay nada que diagnosticar.
  assert.deepEqual(textoDeLanding(CONTENIDO, 10).bloques.map((b) => b.id), ['t1']);
  assert.equal(textoDeLanding({ v: 1, paginas: [] }).texto, '');
  assert.equal(textoDeLanding(null).palabras, 0);
});

// ── 3. La lectura del navegador ───────────────────────────────────────────────

test('la página que va al análisis: el texto del documento, y lo probado en el navegador si lo hay', () => {
  const lectura = { texto: 'OTRO TEXTO que dibujó la página', interacciones: [{ tipo: 'boton', texto: 'Agenda', destino: 'https://cal.com/x' }], fuente: 'navegador' as const };
  const conLectura = paginaDeNuestra({ titulo: 'Mi landing', seoTitulo: 'SEO', seoDescripcion: 'desc', url: 'https://x.com/oferta', texto: 'El copy del documento', palabras: 4, lectura });
  assert.equal(conLectura.texto, 'El copy del documento', 'el texto lo pone el documento, no la lectura');
  assert.deepEqual(conLectura.leidaEnNavegador, { interacciones: lectura.interacciones });
  assert.equal(conLectura.url, 'https://x.com/oferta');
  assert.equal(conLectura.titulo, 'SEO');
  assert.equal(conLectura.bloqueada, false);
  const sin = paginaDeNuestra({ titulo: 'Mi landing', url: null, texto: 'x', palabras: 1, lectura: null });
  assert.equal('leidaEnNavegador' in sin, false);
  assert.equal(sin.url, 'Borrador sin publicar: «Mi landing»');
  assert.equal(sin.titulo, 'Mi landing');
  assert.equal(sin.descripcion, '');
});

// ── 4. El cableado (diagnostico-server.ts es server-only) ─────────────────────

const SERVER = 'lib/editor-landing/diagnostico-server.ts';
const funcion = (src: string, nombre: string) => {
  const i = src.indexOf(`function ${nombre}(`);
  assert.ok(i >= 0, `falta ${nombre}`);
  const j = src.indexOf('\nexport ', i + 1);
  const k = src.indexOf('\nasync function ', i + 1);
  return src.slice(i, Math.min(...[j, k, src.length].filter((x) => x > 0)));
};

test('la lectura se sanea ANTES de separar los caminos y llega a la landing nuestra', () => {
  const src = sinComentarios(leer(SERVER));
  const analizar = funcion(src, 'analizar');
  const saneo = analizar.indexOf('sanearLectura(p.lectura)');
  const corte = analizar.indexOf("if ('docId' in obj)");
  assert.ok(saneo > 0 && corte > 0 && saneo < corte, 'el corte del docId tira la lectura sin mirarla');
  assert.match(analizar, /if \('docId' in obj\) return analizarNuestra\(ws, obj, lectura\);/);
  const nuestra = funcion(src, 'analizarNuestra');
  assert.match(nuestra, /paginaDeNuestra\(\{[\s\S]*?\blectura\b[\s\S]*?\}\)/);
});

test('una landing nuestra se analiza con TODAS sus páginas y guarda su puntaje sin tumbar nada', () => {
  const src = sinComentarios(leer(SERVER));
  const nuestra = funcion(src, 'analizarNuestra');
  assert.match(nuestra, /textoDeLanding\(doc\.contenido\)/);
  assert.doesNotMatch(src, /paginaPrincipal\(/, 'volvió a analizarse sólo la página de inicio');
  assert.match(nuestra, /ubicarCitaEnBloques\(h\.cita, bloques\)/);
  assert.match(nuestra, /await guardarResumenDeNuestra\(ws, obj\.docId, res\.analysis, fecha\)/);
  // Guardar: un update de la columna sola, que no tira (el análisis ya se pagó y los comentarios ya están).
  const guardar = funcion(src, 'guardarResumenDeNuestra');
  assert.match(guardar, /\.update\(\{ diagnostico: aColumna\(analysis, fecha\) \}\)\.eq\('workspace_id', ws\)\.eq\('id', docId\)/);
  assert.match(guardar, /esColumnaQueFalta\(error\)/);
  assert.doesNotMatch(guardar, /throw /);
  assert.doesNotMatch(guardar, /version|updated_at/, 'diagnosticar no es editar');
});

test('el puntaje se lee en un select APARTE (nunca en el del Panel), tolerando sólo la columna que falta', () => {
  const src = sinComentarios(leer(SERVER));
  const leerResumen = funcion(src, 'resumenDeNuestra');
  assert.match(leerResumen, /\.select\('diagnostico'\)\.eq\('workspace_id', ws\)\.eq\('id', docId\)/);
  assert.match(leerResumen, /if \(!esColumnaQueFalta\(error\)\) throw new Error\(error\.message\);/);
  assert.match(leerResumen, /return deColumna\(/);
  const listar = funcion(src, 'listar');
  assert.match(listar, /resumenDeNuestra\(ws, obj\.docId\)/);
  assert.doesNotMatch(listar, /resumen: null/, 'una landing nuestra volvió a listarse sin su puntaje');
  // Ni el Panel ni el editor piden la columna: sin la 0281 su consulta entera se caería.
  const editor = sinComentarios(leer('lib/editor-landing/server.ts'));
  for (const cols of ['COLS_RESUMEN', 'COLS_DOC']) {
    const m = new RegExp(`const ${cols} = '([^']*)'`).exec(editor);
    assert.ok(m, `falta ${cols}`);
    assert.doesNotMatch(m[1], /diagnostico/, cols);
  }
});

test('la migración agrega la columna sin tumbar nada (if not exists, jsonb, con su comentario)', () => {
  const crudo = leer('supabase/migrations/0281_landing_docs_diagnostico.sql');
  const sql = sinComentariosSql(crudo);
  assert.match(sql, /alter table landing_docs add column if not exists diagnostico jsonb;/);
  assert.match(sql, /comment on column landing_docs\.diagnostico is '/);
  assert.doesNotMatch(sql, /drop |not null/i);
  assert.match(crudo.slice(0, 600), /ORDEN DE DESPLIEGUE/);
});
