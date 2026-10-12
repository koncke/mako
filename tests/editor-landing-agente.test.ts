// =============================================================================
// editor-landing-agente — la propuesta de la IA (diff y aplicación), el orden de «Aceptar» y
// el alcance «No medido» del Análisis
// =============================================================================
// Paquete I2 del editor copiado de Gamma (docs/diseno-editor-landing.md). Fija:
//   · diff-tarjetas.ts (puro): qué secciones se agregan, cambian (con el pedazo de texto que
//     cambió) o se quitan, y cómo se parte una propuesta en reemplazos e inserciones;
//   · que «Aceptar» guarde la versión «Antes de un cambio de IA» ANTES de tocar el documento, y
//     que si la versión no se guardó NO aplique (se lee el fuente de PanelAgente.tsx);
//   · que el alcance por sección sin medir se dibuje «No medido», nunca 0.
//
// Corre: node --import tsx --test tests/editor-landing-agente.test.ts
//
// ── ROTURAS (11/10/2026, arnés que restaura de memoria y verifica el hash; base 19 / 0) ──
//   (pasan / fallan sobre los 19 tests de este archivo; las 12 restauradas con el mismo md5)
//   · huella sin ordenar las claves (un JSON.stringify pelado)                        -> 18 / 1
//   · fragmentoDistinto sin recortar las palabras iguales del final                   -> 18 / 1
//   · una nueva va siempre al ancla por defecto, no después de la que la precede      -> 18 / 1
//   · comoSeccionesNuevas conserva el id de la base (el plan la REEMPLAZARÍA)         -> 18 / 1
//   · comoSeccionesNuevas hereda las notas de la base                                 -> 18 / 1
//   · aceptarPropuesta llama reemplazarTarjetas antes de pedir la versión             -> 17 / 2
//   · aceptarPropuesta sigue aunque `guardarVersion` falló                            -> 18 / 1
//   · aceptarPropuesta no manda lo pendiente (`guardarAhora`) antes de la versión     -> 18 / 1
//   · AskAgent llama reemplazarTarjetas por su cuenta                                 -> 18 / 1
//   · textoDeAlcance devuelve «0 %» para null                                         -> 18 / 1
//   · anchoDeAlcance devuelve 0 (una barra vacía) para null                           -> 18 / 1
//   · el diálogo dibuja `{s.pct ?? 0} %` en vez de textoDeAlcance                     -> 18 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MOTIVO_ANTES_DE_IA, comoSeccionesNuevas, diffTarjetas, fragmentoDistinto, huella, planDeAplicacion,
  resumenDeCambios, tarjetasDelDoc, tocadasDesde,
} from '../app/landing-generator/editor/diff-tarjetas';
import { NO_MEDIDO, anchoDeAlcance, textoDeAlcance } from '../app/landing-generator/editor/dialogos/DialogoAnalitica';
import type { JsonNodo } from '../lib/editor-landing/doc';

const RAIZ = join(import.meta.dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas `//` primero y los bloques después (un `/*` dentro de un `//` no abre nada). */
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Una sección mínima: un título y un párrafo. */
function sec(id: string, titulo: string, texto: string, attrs: Record<string, unknown> = {}): JsonNodo {
  return {
    type: 'tarjeta',
    attrs: { id, diseno: 'sin', notas: '', imagenSrc: null, ...attrs },
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: titulo }] },
      { type: 'paragraph', content: [{ type: 'text', text: texto }] },
    ],
  };
}
const ids = (ts: JsonNodo[]) => ts.map((t) => String(t.attrs?.id));

// ─────────────────────────────────────────────────────────────────────────────
// diffTarjetas
// ─────────────────────────────────────────────────────────────────────────────

test('dos listas iguales: cero cambios, todas iguales', () => {
  const a = [sec('t1', 'Hola', 'uno'), sec('t2', 'Chau', 'dos')];
  const d = diffTarjetas(a, structuredClone(a));
  assert.deepEqual(d.cambios, []);
  assert.equal(d.iguales, 2);
  assert.equal(resumenDeCambios(d), '');
});

test('el orden de las claves de attrs no es un cambio (TipTap no lo garantiza)', () => {
  const a = sec('t1', 'Hola', 'uno');
  const b: JsonNodo = { ...a, attrs: Object.fromEntries(Object.entries(a.attrs!).reverse()) };
  assert.equal(huella(a), huella(b));
  assert.equal(diffTarjetas([a], [b]).iguales, 1);
});

test('cambia el texto: «cambia» con el pedazo distinto, no los primeros caracteres', () => {
  const largo = 'Una frase muy larga que empieza igual en las dos versiones y sigue igual hasta acá';
  const a = sec('t1', 'Título', `${largo} vendemos zapatos rojos para correr.`);
  const b = sec('t1', 'Título', `${largo} vendemos zapatillas azules para correr.`);
  const d = diffTarjetas([a], [b]);
  assert.equal(d.cambiadas, 1);
  const c = d.cambios[0];
  assert.equal(c.tipo, 'cambia');
  if (c.tipo !== 'cambia') return;
  assert.equal(c.soloDiseno, false);
  assert.match(c.antes, /zapatos rojos/);
  assert.match(c.despues, /zapatillas azules/);
  assert.ok(c.antes.startsWith('…'), `el pedazo tiene que arrancar cortado: «${c.antes}»`);
  assert.equal(resumenDeCambios(d), 'Cambia 1 sección');
});

test('mismo texto con otro diseño: «cambia» marcado como sólo diseño', () => {
  const a = sec('t1', 'Título', 'texto');
  const b = sec('t1', 'Título', 'texto', { diseno: 'izquierda' });
  const c = diffTarjetas([a], [b]).cambios[0];
  assert.equal(c.tipo, 'cambia');
  assert.equal(c.tipo === 'cambia' && c.soloDiseno, true);
});

test('agrega y quita: las nuevas en su orden, las quitadas al final', () => {
  const a = [sec('t1', 'A', 'a'), sec('t2', 'B', 'b')];
  const b = [sec('t1', 'A', 'a'), sec('n1', 'Nueva', 'n')];
  const d = diffTarjetas(a, b);
  assert.deepEqual(d.cambios.map((c) => `${c.tipo}:${c.id}`), ['agrega:n1', 'quita:t2']);
  assert.equal(resumenDeCambios(d), 'Agrega 1 sección · quita 1');
});

test('un id repetido en la lista nueva cuenta como agregada la segunda vez', () => {
  const a = [sec('t1', 'A', 'a')];
  const d = diffTarjetas(a, [sec('t1', 'A', 'a'), sec('t1', 'A', 'a')]);
  assert.equal(d.iguales, 1);
  assert.equal(d.agregadas, 1);
});

test('fragmentoDistinto saca lo igual del principio Y del final', () => {
  const f = fragmentoDistinto('uno dos tres cuatro cinco seis siete ocho nueve', 'uno dos tres cuatro CINCO seis siete ocho nueve', 1);
  assert.equal(f.antes, '…cuatro cinco seis…');
  assert.equal(f.despues, '…cuatro CINCO seis…');
});

// ─────────────────────────────────────────────────────────────────────────────
// planDeAplicacion
// ─────────────────────────────────────────────────────────────────────────────

test('una nueva va después de la existente que la precede en la respuesta', () => {
  const actuales = [sec('t1', 'A', 'a'), sec('t2', 'B', 'b'), sec('t3', 'C', 'c')];
  const propuesta = [sec('t2', 'B', 'b2'), sec('n1', 'N1', 'x'), sec('n2', 'N2', 'y')];
  const p = planDeAplicacion(actuales, propuesta);
  assert.deepEqual(ids(p.reemplazos), ['t2']);
  assert.deepEqual(p.inserciones.map((g) => [g.despuesDe, ids(g.tarjetas)]), [['t2', ['n1', 'n2']]]);
  assert.deepEqual(ids(p.resultado), ['t1', 't2', 'n1', 'n2', 't3']);
  assert.equal(textoDeT(p.resultado[1]), 'B\nb2');
});
const textoDeT = (t: JsonNodo) => (t.content ?? []).map((b) => (b.content ?? []).map((x) => x.text).join('')).join('\n');

test('una nueva sin existente antes: después del ancla, o al final si no hay', () => {
  const actuales = [sec('t1', 'A', 'a'), sec('t2', 'B', 'b')];
  const conAncla = planDeAplicacion(actuales, [sec('n1', 'N', 'n')], { anclaNuevas: 't1' });
  assert.deepEqual(ids(conAncla.resultado), ['t1', 'n1', 't2']);
  const sinAncla = planDeAplicacion(actuales, [sec('n1', 'N', 'n')]);
  assert.deepEqual(sinAncla.inserciones.map((g) => g.despuesDe), ['t2']);
  assert.deepEqual(ids(sinAncla.resultado), ['t1', 't2', 'n1']);
  // Un ancla que ya no está en el documento no se usa.
  const anclaVieja = planDeAplicacion(actuales, [sec('n1', 'N', 'n')], { anclaNuevas: 'tX' });
  assert.deepEqual(ids(anclaVieja.resultado), ['t1', 't2', 'n1']);
});

test('sin secciones en el documento: la nueva entra con despuesDe null', () => {
  const p = planDeAplicacion([], [sec('n1', 'N', 'n')]);
  assert.deepEqual(p.inserciones.map((g) => g.despuesDe), [null]);
  assert.deepEqual(ids(p.resultado), ['n1']);
});

test('tarjetasDelDoc lee el doc de TipTap y deja afuera lo que no es sección', () => {
  const doc = { type: 'doc', content: [sec('t1', 'A', 'a'), { type: 'paragraph' }, sec('t2', 'B', 'b')] };
  assert.deepEqual(ids(tarjetasDelDoc(doc)), ['t1', 't2']);
  assert.deepEqual(tarjetasDelDoc(null), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// «agregar una sección» desde el popover
// ─────────────────────────────────────────────────────────────────────────────

test('comoSeccionesNuevas: lo que vuelve con el id de la base es NUEVO, sin sus notas ni su foto', () => {
  const foto = 'https://x.supabase.co/storage/v1/object/public/landing-imagenes/1/a.png';
  const base = sec('t1', 'Base', 'b', { notas: 'notas de la base', imagenSrc: foto, diseno: 'derecha' });
  const vuelta = [
    sec('t1', 'Nueva', 'n', { notas: 'notas de la base', imagenSrc: foto, diseno: 'derecha' }),
    sec('n9', 'Otra', 'o', { notas: 'propias' }),
  ];
  let k = 0;
  const nuevas = comoSeccionesNuevas(vuelta, base, () => `nuevo${++k}`);
  assert.deepEqual(ids(nuevas), ['nuevo1', 'n9']);
  assert.equal(nuevas[0].attrs?.notas, '');
  assert.equal(nuevas[0].attrs?.imagenSrc, null);
  assert.equal(nuevas[0].attrs?.diseno, 'sin');
  assert.equal(nuevas[1].attrs?.notas, 'propias');
  // Y con eso el plan las INSERTA después de la base: no reemplaza nada.
  const p = planDeAplicacion([base, sec('t2', 'B', 'b')], nuevas, { anclaNuevas: 't1' });
  assert.deepEqual(p.reemplazos, []);
  assert.deepEqual(ids(p.resultado), ['t1', 'nuevo1', 'n9', 't2']);
});

test('tocadasDesde: las secciones que se editaron mientras la IA trabajaba', () => {
  const enviadas = [sec('t1', 'A', 'a'), sec('t2', 'B', 'b')];
  const ahora = [sec('t1', 'A', 'a editado'), sec('t2', 'B', 'b')];
  assert.deepEqual(tocadasDesde(enviadas, ahora, ['t1', 't2']), ['t1']);
});

// ─────────────────────────────────────────────────────────────────────────────
// «Aceptar»: la versión ANTES de aplicar (se lee el fuente)
// ─────────────────────────────────────────────────────────────────────────────

const PANEL = sinComentarios(leer('app/landing-generator/editor/paneles/PanelAgente.tsx'));
function cuerpoDe(src: string, firma: string, siguiente: string): string {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf(siguiente, ini + firma.length);
  assert.ok(fin > ini, `no encontré dónde termina «${firma}»`);
  return src.slice(ini, fin);
}
const ACEPTAR = cuerpoDe(PANEL, 'export async function aceptarPropuesta(', 'export function deshacerPropuesta(');

test('el motivo de la versión es «Antes de un cambio de IA»', () => {
  assert.equal(MOTIVO_ANTES_DE_IA, 'Antes de un cambio de IA');
  assert.match(ACEPTAR, /accion: 'guardarVersion'[^}]*motivo: MOTIVO_ANTES_DE_IA/);
});

test('Aceptar: lo pendiente, después la versión, y RECIÉN AHÍ el documento', () => {
  assert.ok(ACEPTAR.length < 4000, `el recorte de aceptarPropuesta mide ${ACEPTAR.length}: está mirando otra cosa`);
  const pendiente = ACEPTAR.indexOf('guardarAhora()');
  const version = ACEPTAR.indexOf("accion: 'guardarVersion'");
  const reemplazo = ACEPTAR.indexOf('reemplazarTarjetas(');
  const insercion = ACEPTAR.indexOf('insertarTarjetas(');
  assert.ok(pendiente >= 0 && version >= 0 && reemplazo >= 0 && insercion >= 0, 'falta alguno de los cuatro pasos');
  assert.ok(pendiente < version, 'la versión se pide antes de mandar lo pendiente');
  assert.ok(version < reemplazo && version < insercion, 'se toca el documento antes de guardar la versión');
});

test('Aceptar: si la versión no se guardó, NO se aplica (vuelve antes de tocar el documento)', () => {
  const version = ACEPTAR.indexOf("accion: 'guardarVersion'");
  const reemplazo = ACEPTAR.indexOf('reemplazarTarjetas(');
  const entre = ACEPTAR.slice(version, reemplazo);
  assert.match(entre, /if \(!v\.ok\) return \{ ok: false,[^}]*sinVersion: true/, 'falta la salida temprana cuando la versión falló');
});

test('nadie más aplica una propuesta: el popover usa `aceptarPropuesta`, no su copia', () => {
  const ask = sinComentarios(leer('app/landing-generator/editor/AskAgent.tsx'));
  assert.doesNotMatch(ask, /reemplazarTarjetas\(|insertarTarjetas\(/, 'AskAgent aplica por su cuenta');
  assert.match(ask, /aceptarPropuesta\(ctxVivo,/);
  // En el panel, el documento se toca sólo adentro de aceptarPropuesta.
  const fuera = PANEL.replace(ACEPTAR, '');
  assert.doesNotMatch(fuera, /reemplazarTarjetas\(|insertarTarjetas\(/, 'PanelAgente toca el documento fuera de aceptarPropuesta');
});

// ─────────────────────────────────────────────────────────────────────────────
// Análisis: el alcance sin medir es «No medido», nunca 0
// ─────────────────────────────────────────────────────────────────────────────

test('textoDeAlcance: null es «No medido»; un número es su %', () => {
  assert.equal(NO_MEDIDO, 'No medido');
  assert.equal(textoDeAlcance(null), 'No medido');
  assert.equal(textoDeAlcance(undefined), 'No medido');
  assert.equal(textoDeAlcance(Number.NaN), 'No medido');
  assert.equal(textoDeAlcance(0), '0 %');
  assert.equal(textoDeAlcance(42.6), '43 %');
  assert.equal(anchoDeAlcance(null), null, 'sin medir no hay barra (ni una vacía)');
  assert.equal(anchoDeAlcance(130), 100);
});

test('el diálogo dibuja todo alcance por textoDeAlcance y nunca convierte un null en 0', () => {
  const src = sinComentarios(leer('app/landing-generator/editor/dialogos/DialogoAnalitica.tsx'));
  const cuerpo = cuerpoDe(src, 'export function DialogoAnalitica(', 'export default DialogoAnalitica');
  assert.match(cuerpo, /textoDeAlcance\(s\.pct\)/);
  assert.match(cuerpo, /anchoDeAlcance\(s\.pct\)/);
  assert.match(cuerpo, /\{NO_MEDIDO\} todavía/, 'la lista entera sin medir no dice «No medido todavía»');
  assert.doesNotMatch(cuerpo, /pct\s*(\?\?|\|\|)\s*0/, 'un pct null se vuelve 0');
  assert.doesNotMatch(cuerpo, /\{s\.pct\}/, 'se dibuja el pct crudo');
});
