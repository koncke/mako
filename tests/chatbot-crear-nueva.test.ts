// =============================================================================
// «＋ Nueva» del Chatbot (app/automations/ChatAgentApp.tsx + SimuladorWhatsApp.tsx)
// =============================================================================
// Revisión de la segunda tanda del Chatbot (09/10/2026), dos hallazgos del mismo botón:
//
//   1. `crearNueva` no tenía guarda: un doble clic mandaba dos `crear_vacia` (dos filas vacías), y
//      «Armar una» del pie la llamaba DIRECTO, salteando `nueva()` de la lista — la que pregunta por
//      lo no publicado. La fila se creaba primero y «Seguir editando» la dejaba de más.
//   2. Con cero automatizaciones, un «＋ Nueva» fallido escribía `error` (el de la CARGA), y el
//      estado vacío se dibuja sólo con `!error`: desaparecían el estado vacío y su botón hasta F5.
//
// ⚠️ EL PIE «N etapas sin secuencia · Armar una» SALIÓ EL 10/10/2026 (restos de versiones anteriores,
// grupo «lista»): era del modelo de UNA secuencia por etapa de nutrición y contaba sólo el primer CRON.
// Con él se fueron el `pie` de la lista y el `pedido` que «Armar una» le dejaba a Crear con IA. El test
// de abajo fija que no vuelvan por la puerta de atrás (el GET de los huecos, el `pedidoIA`).
//
// La guarda del doble clic y el estado propio del fallo viven adentro de ChatAgentApp (sin DOM en esta
// casa): guard del fuente, recortado a `crearNueva`.
//
// PROBADO ROMPIÉNDOLO (09/10/2026; con 6 tests, antes de sumar el de la puerta):
//   · sin la guarda (`if (creandoNueva.current) return;`): 1 fallo, 5 pases;
//   · con «Armar una» llamando a `crearNueva(` otra vez: 1 fallo, 5 pases;
//   · con el fallo de crear yendo a `setError(` de nuevo: 1 fallo, 5 pases.
// Y el 10/10/2026, con el pie afuera (base 6 pases / 0 fallos, restaurando de memoria):
//   · la puerta creando sin preguntar (`onNueva()` sin el `if (sinPublicar)`): 1 fallo, 5 pases;
//   · el GET volviendo a mandar `huecos`: 1 fallo, 5 pases;
//   · la lista volviendo a aceptar un `pie`: 1 fallo, 5 pases.
// Y con la galería enchufada (10/10/2026, base 7 / 0):
//   · «En blanco» sin `crearNueva` (sólo cierra la galería): 1 fallo, 6 pases;
//   · la creada desde una plantilla abierta ANTES de `load()`: 1 fallo, 6 pases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimuladorWhatsApp } from '../app/automations/SimuladorWhatsApp';
import type { SecuenciaDto } from '../app/automations/ChatAgentApp';
// (Acá se importaba `ClaseDisparador`: `crearNueva` recibía el tipo de CRON de «¿Qué la dispara?», que se fue en la
// décima tanda, 11/10/2026.)

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
  const src = sinComentarios(leer('app/automations/ChatAgentApp.tsx'));
  // Decimotercera tanda (punto 2): `pedido` es el de «Pídeselo a MaKo», que entra por esta MISMA puerta.
  const ini = src.indexOf('const crearNueva = async (pedido?: string) => {');
  assert.ok(ini >= 0, 'no está crearNueva');
  const fin = src.indexOf('\n  };', ini);
  const cuerpo = src.slice(ini, fin);
  assert.ok(cuerpo.length > 100 && cuerpo.length < 1900, `el recorte mide ${cuerpo.length}`);
  return cuerpo;
}

test('el pie de antes («N etapas sin secuencia · Armar una») no vuelve, ni sus datos', () => {
  const tab = sinComentarios(leer('app/automations/ChatAgentApp.tsx'));
  const lista = sinComentarios(leer('app/automations/SimuladorWhatsApp.tsx'));
  const ruta = sinComentarios(leer('app/api/chat-agent/secuencias/route.ts'));
  assert.doesNotMatch(tab, /huecos|Armar una|sin secuencia/, 'la tab volvió a armar el pie de las etapas');
  assert.doesNotMatch(lista, /\bpie\b|pedidoIA/, 'la lista volvió a aceptar un pie o un pedido para Crear con IA');
  // (El import de `lib/secuencias-huecos` se queda: de ahí salen archivar y desarchivar.)
  assert.doesNotMatch(ruta, /huecosDeSecuencias|[{,\s]huecos[\s,:}]/, 'el GET de la tab volvió a calcular los huecos (nadie los dibuja)');
  // Y lo que se dibuja: ni el pie ni el texto de «secuencia».
  const html = dibujar({});
  assert.ok(!/sin secuencia|Armar una/.test(html), 'la lista dibuja el pie de las etapas');
  assert.ok(html.includes('aria-label="Tus automatizaciones"'), 'la lista volvió a llamarse «Tus secuencias»');
});

test('la puerta pregunta por lo no publicado ANTES de crear', () => {
  // Sin DOM no se puede prender `sinPublicar` (lo emite el lienzo en un efecto): se fija el fuente.
  const src = sinComentarios(leer('app/automations/SimuladorWhatsApp.tsx'));
  // (Del 11/10/2026 a la undécima tanda la puerta llevaba la sección de la galería, por «＋ Nuevo mensaje». Se fue
  // con ese botón, punto 9: una sola lista. Rotura N1 de wf-undecima/w1-lista-ui/romper.mjs, la puerta sin preguntar:
  // base 7 / 0 → 6 / 1.)
  assert.match(src, /const nueva = \(\) => \{\n {4}if \(sinPublicar\) \{ setPendiente\(\{ ir: 'nueva' \}\); return; \}\n {4}onNueva\(\);\n {2}\};/);
  assert.match(src, /if \(p\.ir === 'nueva'\) onNueva\(\);/);
  // El «＋ Nueva» de la lista recibe ESA puerta, no `onNueva`.
  assert.match(src, /onClick=\{\(\) => nueva\(\)\}/);
});

test('el fallo de crear se dibuja pegado al «＋ Nueva» de la lista', () => {
  const html = dibujar({ errorNueva: 'No se pudo crear' });
  const iNueva = html.indexOf('>Nueva automatización<');
  const iError = html.indexOf('No se pudo crear');
  assert.ok(iNueva >= 0 && iError > iNueva, 'el error no está debajo del botón');
  assert.ok(!dibujar({}).includes('role="alert"'), 'sin error no hay alerta');
});

test('crearNueva ignora los clics mientras hay un POST en vuelo, y se suelta en un finally', () => {
  const c = crearNueva();
  assert.match(c, /^const crearNueva = async \(pedido\?: string\) => \{\n {4}if \(creandoNueva\.current\) return;\n {4}creandoNueva\.current = true;/);
  // Tercera tanda: el finally suelta también la fila de «Nueva» (`creando`): si falló, se va.
  assert.match(c, /finally \{ setCreando\(null\); creandoNueva\.current = false; \}/);
  assert.match(sinComentarios(leer('app/automations/ChatAgentApp.tsx')), /const creandoNueva = useRef\(false\);/);
});

test('el fallo de crear NO va a `error` (el de la carga): va a su propio estado', () => {
  const c = crearNueva();
  assert.ok(!/\bsetError\(/.test(c), 'crearNueva vuelve a escribir el error de la carga');
  assert.match(c, /setErrCrear\(/);
});

// ⚠️ DUODÉCIMA TANDA (12/10/2026, decisión 11): el cartel «Todavía no hay automatizaciones», con su «＋ Nueva» y su
// fallo, se fue. Con la lista vacía se monta igual la lista, que trae «＋ Nueva automatización» y dibuja el fallo de
// crear (`errorNueva`) pegado a ese botón. Lo que se fija acá es que el fallo llegue a la lista también VACÍA.
test('la lista vacía dibuja el fallo de crear al lado de su botón', () => {
  const src = sinComentarios(leer('app/automations/ChatAgentApp.tsx'));
  assert.doesNotMatch(src, /Todavía no hay automatizaciones/, 'volvió el cartel vacío');
  // La lista se monta con la lista vacía (sólo un error de carga la saca), con «＋ Nueva» y su fallo.
  assert.match(src, /\{visibles !== null && !error && \(\s*<SimuladorWhatsApp/);
  // «＋ Nueva» abre la galería (10/10/2026); «En blanco» de la galería es `crearNueva`, la de siempre.
  assert.match(src, /onNueva=\{abrirGaleria\} errorNueva=\{errCrear\}/);
  const lista = sinComentarios(leer('app/automations/SimuladorWhatsApp.tsx'));
  assert.match(lista, /\{rolAdmin && errorNueva && <div role="alert"/);
});

test('«＋ Nueva» abre la galería, y «Lienzo en blanco» crea la vacía de siempre', () => {
  const src = sinComentarios(leer('app/automations/ChatAgentApp.tsx'));
  assert.match(src, /const abrirGaleria = \(\) => \{ setErrCrear\(null\); setGaleria\(true\); \};/);
  assert.match(src, /\{galeria && rolAdmin && \(\s*<GaleriaPlantillas productos=\{productos\} onCerrar=\{\(\) => setGaleria\(false\)\}\s*onBlanco=\{\(\) => \{ setGaleria\(false\); void crearNueva\(\); \}\}/, 'la galería no está montada, o «Lienzo en blanco» no crea la vacía');
  // «Pídeselo a MaKo» (decimotercera tanda, punto 2): el modal se cierra AL ENVIAR y la fila nace YA por ESTA puerta
  // (`crearNueva(pedido)`), con su lienzo abierto, el chat de MaKo y el pedido puesto (lo fija también
  // tests/automations-decimotercera.test.ts). Si la fila no se pudo crear, el pedido vuelve a la barra.
  assert.match(src, /onPedirAMako=\{pedirAMako\} pedidoInicial=\{pedidoSinCrear\} \/>/);
  assert.match(src, /const pedirAMako = \(pedido: string\) => \{\n {4}setGaleria\(false\);\n {4}void crearNueva\(pedido\);\n {2}\};/);
  assert.doesNotMatch(src, /alCrearConIA\(|onCreadaIA=/, 'volvió crear ADENTRO del modal');
  const c = crearNueva();
  assert.match(c, /if \(pedido\) \{ setPedidoSinCrear\(null\); setAbrirSec\(\{ id, mako: true, pedido \}\); \}\n {6}await load\(\);/);
  assert.match(c, /setErrCrear\(r\?\.error \?\? 'No se pudo crear'\); if \(pedido\) setPedidoSinCrear\(pedido\); return;/);
  // La creada desde una plantilla se abre DESPUÉS de traer la lista (antes no está para elegirla).
  assert.match(src, /await load\(\);\n {4}setAbrirSec\(\{ id: r\.secuenciaId \}\);/);
});
