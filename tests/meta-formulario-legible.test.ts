// =============================================================================
// Lo que contestó en el formulario de Meta: legible, en las dos puertas, y en el aviso
// =============================================================================
// Pedido de Martín (07/10/2026), para los clientes de Código Inmobiliario que no tienen
// landing y corren anuncios a formulario: ver las respuestas en la ficha del lead (el
// pop-up incluido) y un WhatsApp con ellas que nace APAGADO en /chatbot («el whatsapp
// dejalo como borrador, no activado en chatbot»).
//
// Las formas de abajo son las medidas en un workspace real el 07/10/2026 (sin datos
// personales: sólo las dos preguntas propias del formulario).
//
// Correr: npx tsx --test tests/meta-formulario-legible.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (07/10/2026), una por vez y restaurando de memoria. Con todo
// puesto: 7 pases / 0 fallos.
//   · la pregunta vuelve a ser la clave de Meta            → 4 pases / 3 fallos
//   · el texto libre también se «corrige»                  → 4 / 3
//   · la ficha recibe las respuestas crudas                → 5 / 2
//   · el aviso nace PRENDIDO (`porDefecto: 'on'`)          → 6 / 1
//   · el webhook vuelve a mandar el texto armado           → 6 / 1
//   · el pop-up deja de dibujarlas                         → 6 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { preguntaLegible, respuestaLegible, respuestasPropias, resumenRespuestas } from '../lib/meta-leads-campos';
import { CATALOGO_AVISOS } from '../lib/avisos-catalogo';
import { VARIABLES_AVISO } from '../lib/variables-aviso';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios, las líneas PRIMERO y los bloques después (regla de la casa). */
const sinComentarios = (src: string): string => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const MEDIDO = [
  { name: 'correo_electrónico', values: ['x@ejemplo.com'] },
  { name: 'nombre_completo', values: ['Persona de Prueba'] },
  { name: 'phone_number', values: ['+5491100000000'] },
  { name: '¿qué_tipo_de_propiedad_buscas_vender?', values: ['una_casa'] },
  { name: '¿en_que_zona/barrio_se_encuentra_ubicada_la_propiedad_que_desea_vender?', values: ['san telmo'] },
];

test('la pregunta se dibuja como texto, no como la clave que manda Meta', () => {
  assert.equal(preguntaLegible('¿qué_tipo_de_propiedad_buscas_vender?'), '¿Qué tipo de propiedad buscas vender?');
  assert.equal(
    preguntaLegible('¿en_que_zona/barrio_se_encuentra_ubicada_la_propiedad_que_desea_vender?'),
    '¿En que zona/barrio se encuentra ubicada la propiedad que desea vender?',
  );
  assert.equal(preguntaLegible('presupuesto_estimado'), 'Presupuesto estimado');
});

test('una OPCIÓN se vuelve legible; lo que la persona tipeó queda como lo tipeó', () => {
  assert.equal(respuestaLegible('una_casa'), 'Una casa');
  assert.equal(respuestaLegible('un_departamento'), 'Un departamento');
  assert.equal(respuestaLegible('otro'), 'Otro');
  // Texto libre de más de una palabra: no se le corrige ni la mayúscula.
  assert.equal(respuestaLegible('san telmo'), 'san telmo');
  assert.equal(respuestaLegible('Urquiza'), 'Urquiza');
});

test('la ficha recibe sólo las preguntas PROPIAS, ya legibles', () => {
  assert.deepEqual(respuestasPropias(MEDIDO), [
    { pregunta: '¿Qué tipo de propiedad buscas vender?', respuesta: 'Una casa' },
    { pregunta: '¿En que zona/barrio se encuentra ubicada la propiedad que desea vender?', respuesta: 'san telmo' },
  ]);
});

test('el resumen del mensaje: un renglón por pregunta, con tope, y null si no hay nada propio', () => {
  assert.equal(
    resumenRespuestas(MEDIDO),
    '• ¿Qué tipo de propiedad buscas vender?: Una casa\n• ¿En que zona/barrio se encuentra ubicada la propiedad que desea vender?: san telmo',
  );
  assert.equal(resumenRespuestas([{ name: 'full_name', values: ['X'] }]), null, 'sólo contacto: no hay nada que resumir');
  assert.equal(resumenRespuestas(null), null);
  const muchas = Array.from({ length: 9 }, (_, i) => ({ name: `pregunta_${i}`, values: [`opcion_${i}`] }));
  assert.equal(resumenRespuestas(muchas)!.split('\n').length, 6, 'un WhatsApp no es un volcado: seis como mucho');
});

test('⚠️ el aviso del formulario de Meta nace APAGADO y su texto sale de la plantilla', () => {
  const cat = CATALOGO_AVISOS.find((c) => c.id === 'lead-formulario-meta');
  assert.ok(cat, 'falta el aviso en el catálogo');
  // «dejalo como borrador, no activado»: sin porDefecto, ningún negocio lo recibe hasta
  // prenderlo en /chatbot.
  assert.equal(cat!.porDefecto, undefined, 'el aviso tiene que nacer apagado');
  assert.ok(cat!.aporta?.includes('lead'), 'sin `aporta: lead` el editor no ofrece los datos del lead');
  // Todo token del texto por defecto existe en el catálogo de variables: si no, sale crudo.
  const conocidas = new Set(VARIABLES_AVISO.map((v) => v.key));
  const tokens = [...cat!.ejemplo.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  assert.ok(tokens.includes('lead_formulario'), 'el texto por defecto tiene que traer lo que contestó');
  assert.deepEqual(tokens.filter((t) => !conocidas.has(t)), [], 'hay tokens que nadie resuelve');
});

test('⚠️ el webhook manda los DATOS, no el texto armado (si no, /chatbot no gobierna nada)', () => {
  const src = sinComentarios(leer('app/api/webhooks/meta-leads/route.ts'));
  const i = src.indexOf("emitirDelCatalogo('lead-formulario-meta'");
  assert.ok(i > 0, 'el webhook ya no emite el aviso');
  const llamada = src.slice(i, src.indexOf('});', i));
  assert.doesNotMatch(llamada, /\btexto\s*:/, 'con `texto` armado acá, lo escrito en /chatbot no sale nunca');
  assert.match(llamada, /lead:\s*\{\s*id:\s*lead\.id/, 'sin el lead no hay {{link_lead}} ni {{lead_nombre}}');
  assert.match(llamada, /lead_formulario:/, 'lo que contestó viaja en `datos`');
  assert.match(llamada, /lead_telefono:/, 'el teléfono viaja en `datos`, con su «sin teléfono» si falta');
});

test('⚠️ la ruta y el pop-up dibujan la MISMA pieza', () => {
  const ruta = sinComentarios(leer('app/crm/[id]/page.tsx'));
  const popup = sinComentarios(leer('app/crm/LeadSheet.tsx'));
  assert.match(ruta, /<RespuestasFormulario respuestas=\{respuestasForm\}/);
  assert.match(popup, /<RespuestasFormulario respuestas=\{respuestasForm/, 'el pop-up es por donde se abre una ficha casi siempre');
  for (const [nombre, src] of [['ruta', ruta], ['pop-up', popup]] as const) {
    assert.doesNotMatch(src, /Respondió en el formulario/, `la ${nombre} volvió a tener su propia copia de la sección`);
  }
  // Y el pop-up la recibe resuelta del server: no lee el field_data.
  assert.doesNotMatch(popup, /meta_field_data/, 'el pop-up no tiene que leer las respuestas crudas');
  assert.match(sinComentarios(leer('app/crm/actions.ts')), /respuestasForm:\s*respuestasPropias\(lead\.meta_field_data\)/);
});
