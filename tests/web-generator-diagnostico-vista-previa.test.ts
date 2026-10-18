// =============================================================================
// El Diagnóstico del Web Generator: la vista previa se puede pausar y scrollear (#861), y no dice «nada que señalar»
// sobre una landing con hallazgos (#863). Las dos vinieron de la revisión con Código Inmobiliario (16/10/2026, Fathom
// 863534246, 01:23 y 01:34).
// =============================================================================
// #863. EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO: no fue la IA ni el scraper. La fila de landing_analyses de su landing
// tenía 3 hallazgos con cita, escritos por el Landing Analyst (el análisis automático del Pixel), que no guarda
// comentarios. Al abrir, el panel LISTA: veredicto sí, comentarios cero, y no analiza solo porque ya hay veredicto.
// Medido en producción el 17/10: ws 11, 13 y 14, 3 hallazgos cada una y 0 comentarios. Lo que se fija:
//   1. `hallazgosSinComentario` (puro): lo que falta pasar, por la MISMA clave que deduplica al guardar;
//   2. `listar` de una de afuera pasa esos hallazgos a comentarios (el server es server-only: se lee el fuente);
//   3. el panel ya no afirma «nada que señalar».
// #861. La vista de una landing nuestra iba entera con `inert` (no se pausaba el VSL que arrancaba con sonido) y el
// recorrido tapaba la pantalla entera con una capa que se comía la rueda y los clics. Lo que se fija:
//   4. `htmlParaVistaPrevia` (puro): sin el permiso de arrancar con sonido, y un video que arranca solo con controles;
//   5. VistaNuestra sin `inert` y con el freno del clic y del envío; la hoja deja vivo sólo el iframe de un video;
//   6. el recorrido: la capa no recibe el mouse, la tarjeta sí.
//
// PROBADO ROMPIÉNDOLO (17/10/2026): los números al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { claveSugerencia, hallazgosSinComentario, type HallazgoDiagnostico } from '../lib/editor-landing/diagnostico';
import { htmlDeFragmento } from '../lib/editor-landing/render';
import { NODO, type JsonNodo } from '../lib/editor-landing/doc';
import { ALLOW_EMBED } from '../lib/embeds';
import { SELECTOR_SIN_CLIC, htmlParaVistaPrevia } from '../app/web-generator/diagnostico/vista';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const h = (titulo: string, cita: string): HallazgoDiagnostico => ({ titulo, severidad: 'alta', seccion: 'Hero', cita, por_que: 'p', arreglo: 'a' });
const URL_CI = { url: 'https://landingvsl.vercel.app' };

// ── 1. Lo que falta pasar a comentarios ─────────────────────────────────────

test('#863: los hallazgos del análisis guardado que no son comentarios, por la clave de guardar', () => {
  const tres = [h('Promesa vaga', 'Vende más'), h('Sin prueba', 'Clientes felices'), h('Dos CTA', 'Agenda ya')];
  // Sin comentarios guardados: los tres (el caso de producción).
  assert.deepEqual(hallazgosSinComentario(URL_CI, [], tres).map((x) => x.titulo), ['Promesa vaga', 'Sin prueba', 'Dos CTA']);
  // Uno ya guardado (también uno DESCARTADO: tiene fila y no vuelve), dicho con otras comillas y mayúsculas.
  const guardadas = [{ hallazgo: h('promesa vaga', '«Vende más»') }];
  assert.equal(claveSugerencia(URL_CI, guardadas[0].hallazgo), claveSugerencia(URL_CI, tres[0]), 'la clave es la de guardar');
  assert.deepEqual(hallazgosSinComentario(URL_CI, guardadas, tres).map((x) => x.titulo), ['Sin prueba', 'Dos CTA']);
  // El mismo hallazgo repetido en el análisis sale una vez.
  assert.equal(hallazgosSinComentario(URL_CI, [], [tres[1], tres[1]]).length, 1);
});

// ── 2. listar de una de afuera ──────────────────────────────────────────────

test('#863: abrir una landing de afuera ya analizada pasa sus hallazgos a comentarios (y nunca tira por eso)', () => {
  const src = sinComentarios(leer('lib/editor-landing/diagnostico-server.ts'));
  const listar = src.slice(src.indexOf('export async function listar'), src.indexOf('export async function analizar('));
  assert.ok(listar.length > 200);
  assert.match(listar, /analisisGuardado\(ws, obj\.url\)/, 'listar lee el análisis guardado de su workspace');
  assert.match(listar, /sugerenciasDeAfuera\(ws, obj, guardado\?\.hallazgos/, 'y con sus hallazgos arma la lista');
  const guardado = src.slice(src.indexOf('async function analisisGuardado'), src.indexOf('async function sugerenciasDeAfuera'));
  assert.match(guardado, /select\('[^']*\bhallazgos\b[^']*'\)/, 'el select trae los hallazgos');
  assert.match(guardado, /\.eq\('workspace_id', ws\)/, 'acotado al workspace, como el resto del archivo');
  assert.match(guardado, /normalizarHallazgos\(/, 'con el MISMO saneo que un análisis nuevo (sin cita no es hallazgo)');
  const pasar = src.slice(src.indexOf('async function sugerenciasDeAfuera'), src.indexOf('async function resumenDeNuestra'));
  assert.match(pasar, /hallazgosSinComentario\(obj, sugerencias, hallazgos\)/);
  assert.match(pasar, /guardarHallazgos\(ws, obj,/);
  assert.match(pasar, /catch/, 'si guardar falla, la lista sale como estaba');
});

// ── 3. El panel ──────────────────────────────────────────────────────────────

test('#863: el panel no afirma que la landing está bien cuando no hay comentarios', () => {
  const src = sinComentarios(leer('app/web-generator/diagnostico/PanelDiagnostico.tsx'));
  assert.doesNotMatch(src, /nada que señalar/i);
  assert.match(src, /no dejó comentarios/);
});

// ── 4. El HTML de la vista previa ────────────────────────────────────────────

test('#861: en la vista previa ningún video arranca con sonido, y el que arranca solo se puede pausar', () => {
  const insertado: JsonNodo = { type: NODO.insertado, attrs: { src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } };
  const crudo = htmlDeFragmento(insertado, { modo: 'exportar' });
  assert.match(crudo, /<iframe\b[^>]*\sallow="[^"]*autoplay/, 'la publicada sí delega autoplay (si esto cambia, revisar la vista)');
  const vista = htmlParaVistaPrevia(crudo);
  const allow = /<iframe\b[^>]*\sallow="([^"]*)"/.exec(vista)?.[1] ?? null;
  assert.ok(allow !== null, 'el iframe sigue teniendo su allow');
  assert.doesNotMatch(allow, /autoplay/);
  // Lo demás del permiso queda: pantalla completa, imagen en imagen.
  for (const p of ALLOW_EMBED.split(';').map((x) => x.trim()).filter((x) => x && x !== 'autoplay')) assert.ok(allow.includes(p), p);
  // Nuestro <video autoplay> va mudo y SIN controles en la publicada: en la vista lleva controles. Uno que ya los
  // tiene no se toca.
  assert.match(htmlParaVistaPrevia('<figure class="gm-video"><video src="a.mp4" autoplay="" muted="" playsinline=""></video></figure>'), /<video controls src="a\.mp4"/);
  const conControles = '<video src="a.mp4" controls="" preload="metadata"></video>';
  assert.equal(htmlParaVistaPrevia(conControles), conControles);
  assert.equal(htmlParaVistaPrevia('<p>sin videos</p>'), '<p>sin videos</p>');
});

// ── 5. VistaNuestra y su hoja ────────────────────────────────────────────────

test('#861: la vista ya no es inert: frena el clic y el envío, y deja vivo sólo el iframe de un video', () => {
  const vista = sinComentarios(leer('app/web-generator/diagnostico/VistaNuestra.tsx'));
  assert.doesNotMatch(vista, /\binert\b/, 'inert apaga también el reproductor');
  assert.match(vista, /htmlParaVistaPrevia\(html\)/, 'lo que se pinta pasa por htmlParaVistaPrevia');
  assert.match(vista, /onClickCapture=\{frenar\}/);
  assert.match(vista, /onSubmitCapture=/);
  assert.match(vista, /closest\(SELECTOR_SIN_CLIC\)/);
  for (const s of ['a', 'button', 'input', 'form', 'summary']) assert.ok(SELECTOR_SIN_CLIC.split(',').map((x) => x.trim()).includes(s), s);
  const hoja = leer('app/web-generator/diagnostico/PanelDiagnostico.tsx');
  assert.match(hoja, /\.gdg-vista--nuestra \.gdg-lienzo iframe \{ pointer-events: none; \}/, 'ningún iframe se aprieta (agenda, HTML personalizado)…');
  assert.match(hoja, /\.gdg-vista--nuestra \.gdg-lienzo \.gm-insertado\[data-clase="video"\] iframe \{ pointer-events: auto; \}/, '…salvo el del video');
  assert.match(hoja, /\.gdg-vista--nuestra \.gdg-lienzo :is\(a, button, input/, 'los links y botones no se aprietan');
});

// ── 6. El recorrido ──────────────────────────────────────────────────────────

test('#861: con el recorrido abierto la vista se sigue scrolleando y el video se pausa (la capa no se come el mouse)', () => {
  const src = leer('app/web-generator/diagnostico/RecorridoDiagnostico.tsx');
  assert.match(src, /\.gdg-rec \{[^}]*pointer-events: none;/, 'la capa de pantalla entera no recibe el mouse');
  assert.match(src, /\.gdg-rec__tarjeta \{ pointer-events: auto; \}/, 'la tarjeta sí (sus botones)');
});

// =============================================================================
// ROTURAS (17/10/2026). Arnés del scratchpad: reemplaza UNA ocurrencia exacta, corre este archivo, restaura DE
// MEMORIA y compara el sha256. Base: 6 pasan / 0 fallan. pasan / fallan:
//   R1  hallazgosSinComentario no mira lo guardado ...................... 5 / 1 (lo que falta pasar)
//   R2  listar vuelve a leer sólo la lista ............................... 5 / 1 (listar de afuera)
//   R3  el select del análisis guardado sin los hallazgos ................ 5 / 1 (listar de afuera)
//   R4  el panel vuelve a decir «nada que señalar» ....................... 5 / 1 (el panel)
//   R5  el allow del iframe conserva autoplay ............................ 5 / 1 (el HTML de la vista)
//   R6  el <video> que arranca solo, sin controles ....................... 5 / 1 (el HTML de la vista)
//   R7  la vista vuelve a ser inert ...................................... 5 / 1 (VistaNuestra)
//   R8  sin frenar el clic ............................................... 5 / 1 (VistaNuestra)
//   R9  el iframe del video tampoco se aprieta ........................... 5 / 1 (la hoja)
//   R10 la capa del recorrido se come el mouse ........................... 5 / 1 (el recorrido)
// Restaurado: 6 / 0, sha256 igual al de antes en los diez.
// =============================================================================
