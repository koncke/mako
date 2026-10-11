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
import type { ClaseDisparador } from '../lib/disparadores';

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
  const ini = src.indexOf('const crearNueva = async (clase?: ClaseDisparador) => {');
  assert.ok(ini >= 0, 'no está crearNueva');
  const fin = src.indexOf('\n  };', ini);
  const cuerpo = src.slice(ini, fin);
  assert.ok(cuerpo.length > 100 && cuerpo.length < 1500, `el recorte mide ${cuerpo.length}`);
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
  // Desde el 11/10/2026 la puerta lleva la sección de la galería («＋ Nuevo mensaje» abre en «MaKo en WhatsApp»).
  assert.match(src, /const nueva = \(seccion\?: SeccionGaleria\) => \{\n {4}if \(sinPublicar\) \{ setPendiente\(\{ ir: 'nueva', seccion \}\); return; \}\n {4}onNueva\(seccion\);\n {2}\};/);
  assert.match(src, /if \(p\.ir === 'nueva'\) onNueva\(p\.seccion\);/);
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
  assert.match(c, /^const crearNueva = async \(clase\?: ClaseDisparador\) => \{\n {4}if \(creandoNueva\.current\) return;\n {4}creandoNueva\.current = true;/);
  // Tercera tanda: el finally suelta también la fila de «Nueva» (`creando`): si falló, se va.
  assert.match(c, /finally \{ setCreando\(null\); creandoNueva\.current = false; \}/);
  assert.match(sinComentarios(leer('app/automations/ChatAgentApp.tsx')), /const creandoNueva = useRef\(false\);/);
});

test('el fallo de crear NO va a `error` (el de la carga): va a su propio estado', () => {
  const c = crearNueva();
  assert.ok(!/\bsetError\(/.test(c), 'crearNueva vuelve a escribir el error de la carga');
  assert.match(c, /setErrCrear\(/);
});

test('el estado vacío dibuja el fallo de crear al lado de su botón', () => {
  const src = sinComentarios(leer('app/automations/ChatAgentApp.tsx'));
  const ini = src.indexOf('Todavía no hay automatizaciones.');
  assert.ok(ini >= 0);
  const bloque = src.slice(ini, src.indexOf('</div>\n      )}', ini));
  // «＋ Nueva» abre la galería (10/10/2026); «En blanco» de la galería es `crearNueva`, la de siempre.
  assert.match(bloque, /onClick=\{\(\) => abrirGaleria\(\)\}/);
  assert.match(bloque, /\{errCrear && <span role="alert"/);
  assert.match(src, /onNueva=\{abrirGaleria\}/);
});

test('«＋ Nueva» abre la galería, y «En blanco» crea la vacía de siempre', () => {
  const src = sinComentarios(leer('app/automations/ChatAgentApp.tsx'));
  assert.match(src, /const abrirGaleria = \(seccion\?: SeccionGaleria\) => \{ setErrCrear\(null\); setGaleria\(\{ seccion \}\); \};/);
  assert.match(src, /\{galeria && rolAdmin && \(\s*<GaleriaPlantillas productos=\{productos\} onCerrar=\{\(\) => setGaleria\(false\)\} seccion=\{galeria\.seccion\}\s*onEmpezar=\{\(\) => \{ setGaleria\(false\); void crearNueva\(\); \}\}/, 'la galería no está montada, o «En blanco» no crea la vacía');
  // La creada desde una plantilla se abre DESPUÉS de traer la lista (antes no está para elegirla).
  assert.match(src, /await load\(\);\n {4}setAbrirSec\(\{ id: r\.secuenciaId \}\);/);
});
