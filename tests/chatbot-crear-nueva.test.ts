// =============================================================================
// «＋ Nueva» y «Armar una» del Chatbot (app/chatbot/ChatAgentApp.tsx + SimuladorWhatsApp.tsx)
// =============================================================================
// Revisión de la segunda tanda del Chatbot (09/10/2026), dos hallazgos del mismo botón:
//
//   1. `crearNueva` no tenía guarda: un doble clic mandaba dos `crear_vacia` (dos filas vacías), y
//      «Armar una» del pie la llamaba DIRECTO, salteando `nueva()` de la lista — la que pregunta por
//      lo no publicado. La fila se creaba primero y «Seguir editando» la dejaba de más.
//   2. Con cero automatizaciones, un «＋ Nueva» fallido escribía `error` (el de la CARGA), y el
//      estado vacío se dibuja sólo con `!error`: desaparecían el estado vacío y su botón hasta F5.
//
// La puerta de la lista se prueba DIBUJANDO (renderToStaticMarkup): el pie recibe `nueva` y lo que
// se le pasa llega a `onNueva`. La guarda del doble clic y el estado propio del fallo viven adentro
// de ChatAgentApp (sin DOM en esta casa): guard del fuente, recortado a `crearNueva`.
//
// PROBADO ROMPIÉNDOLO (09/10/2026; con 6 tests, antes de sumar el de la puerta):
//   · sin la guarda (`if (creandoNueva.current) return;`): 1 fallo, 5 pases;
//   · con «Armar una» llamando a `crearNueva(` otra vez: 1 fallo, 5 pases;
//   · con el fallo de crear yendo a `setError(` de nuevo: 1 fallo, 5 pases;
//   · con el pie recibiendo `() => onNueva()` (pierde el pedido): 1 fallo, 5 pases.
// Y con 7: el pie recibiendo `onNueva` pelado (se saltea la pregunta pero conserva el pedido) dio
// VERDE en el test dibujado —sin DOM `sinPublicar` nunca es true— y 1 fallo, 6 pases en el del fuente.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimuladorWhatsApp } from '../app/chatbot/SimuladorWhatsApp';
import type { SecuenciaDto } from '../app/chatbot/ChatAgentApp';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const SECUENCIA = {
  id: 7, clave: 'bienvenida', nombre: 'Bienvenida', etapa: 'nuevo', trigger_tipo: 'etapa',
  activa: false, pasos: [], inscriptos: 0, enviados: 0, estrategia: null, metricas: {},
} as unknown as SecuenciaDto;

const dibujar = (extra: Record<string, unknown>) => renderToStaticMarkup(createElement(SimuladorWhatsApp, {
  secuencias: [SECUENCIA], objetivos: [], etiquetaEtapa: (k: string) => k, negocio: 'Mi negocio',
  rolAdmin: true, audios: [], canalCaido: false, onAudioNuevo: () => {}, onNueva: () => {}, onReload: () => {},
  productos: [], disparadores: [], tz: null,
  ...extra,
} as Parameters<typeof SimuladorWhatsApp>[0]));

/** El cuerpo de `crearNueva` en ChatAgentApp, hasta su cierre real. */
function crearNueva(): string {
  const src = sinComentarios(leer('app/chatbot/ChatAgentApp.tsx'));
  const ini = src.indexOf('const crearNueva = async (pedido?: string) => {');
  assert.ok(ini >= 0, 'no está crearNueva');
  const fin = src.indexOf('\n  };', ini);
  const cuerpo = src.slice(ini, fin);
  assert.ok(cuerpo.length > 100 && cuerpo.length < 1500, `el recorte mide ${cuerpo.length}`);
  return cuerpo;
}

test('el pie de la lista recibe la PUERTA de crear, y lo que se le pide llega a onNueva', () => {
  let puerta: ((pedido?: string) => void) | null = null;
  const pedidos: Array<string | undefined> = [];
  const html = dibujar({
    onNueva: (p?: string) => { pedidos.push(p); },
    pie: (nueva: (pedido?: string) => void) => { puerta = nueva; return createElement('span', null, 'pie-de-prueba'); },
  });
  assert.ok(html.includes('pie-de-prueba'), 'el pie como función no se dibujó');
  assert.ok(puerta, 'el pie no recibió la puerta');
  // Sin cambios sin publicar, la puerta crea en el acto y con el pedido.
  (puerta as (p?: string) => void)('Una automatización para quien llega a «Agendado»');
  assert.deepEqual(pedidos, ['Una automatización para quien llega a «Agendado»']);
});

test('la puerta pregunta por lo no publicado ANTES de crear, y el pedido sobrevive al Confirm', () => {
  // Sin DOM no se puede prender `sinPublicar` (lo emite el lienzo en un efecto): se fija el fuente.
  const src = sinComentarios(leer('app/chatbot/SimuladorWhatsApp.tsx'));
  assert.match(src, /const nueva = \(pedido\?: string\) => \{\n {4}if \(sinPublicar\) \{ setPendiente\(\{ ir: 'nueva', pedido \}\); return; \}\n {4}onNueva\(pedido\);\n {2}\};/);
  assert.match(src, /if \(p\.ir === 'nueva'\) onNueva\(p\.pedido\);/);
  // El pie y el «＋ Nueva» de la lista reciben ESA puerta, no `onNueva`.
  assert.match(src, /typeof pie === 'function' \? pie\(nueva\) : pie/);
  assert.match(src, /onClick=\{\(\) => nueva\(\)\}/);
});

test('el fallo de crear se dibuja pegado al «＋ Nueva» de la lista', () => {
  const html = dibujar({ errorNueva: 'No se pudo crear' });
  const iNueva = html.indexOf('>Nueva<');
  const iError = html.indexOf('No se pudo crear');
  assert.ok(iNueva >= 0 && iError > iNueva, 'el error no está debajo del botón');
  assert.ok(!dibujar({}).includes('role="alert"'), 'sin error no hay alerta');
});

test('crearNueva ignora los clics mientras hay un POST en vuelo, y se suelta en un finally', () => {
  const c = crearNueva();
  assert.match(c, /^const crearNueva = async \(pedido\?: string\) => \{\n {4}if \(creandoNueva\.current\) return;\n {4}creandoNueva\.current = true;/);
  // Tercera tanda: el finally suelta también la fila de «Nueva» (`creando`): si falló, se va.
  assert.match(c, /finally \{ setCreando\(null\); creandoNueva\.current = false; \}/);
  assert.match(sinComentarios(leer('app/chatbot/ChatAgentApp.tsx')), /const creandoNueva = useRef\(false\);/);
});

test('el fallo de crear NO va a `error` (el de la carga): va a su propio estado', () => {
  const c = crearNueva();
  assert.ok(!/\bsetError\(/.test(c), 'crearNueva vuelve a escribir el error de la carga');
  assert.match(c, /setErrCrear\(/);
});

test('el estado vacío dibuja el fallo de crear al lado de su botón', () => {
  const src = sinComentarios(leer('app/chatbot/ChatAgentApp.tsx'));
  const ini = src.indexOf('Todavía no hay automatizaciones.');
  assert.ok(ini >= 0);
  const bloque = src.slice(ini, src.indexOf('</div>\n      )}', ini));
  assert.match(bloque, /onClick=\{\(\) => void crearNueva\(\)\}/);
  assert.match(bloque, /\{errCrear && <span role="alert"/);
});

test('«Armar una» pasa por la puerta de la lista, no por crearNueva', () => {
  const src = sinComentarios(leer('app/chatbot/ChatAgentApp.tsx'));
  assert.match(src, /pie=\{rolAdmin && huecos\.length > 0 \? \(nueva\) => \(/);
  const ini = src.indexOf('Armar una');
  const boton = src.slice(src.lastIndexOf('<button', ini), ini);
  assert.match(boton, /onClick=\{\(\) => nueva\(`Una automatización para quien llega a/);
  assert.ok(!/crearNueva\(/.test(boton), '«Armar una» volvió a crear sin preguntar');
  assert.match(src, /onNueva=\{\(pedido\) => void crearNueva\(pedido\)\}/);
});
