// =============================================================================
// Los BORDES del paso «⚡ Acción»: lo que lo rodea y asumía que todo paso es un mensaje
// =============================================================================
// Decisión de Martín (08/10/2026): un paso de un flujo «que pueda hacer todo, sin
// limitaciones» (lib/api-mako/flujo.ts). El paso existe en los dos lienzos; estos guards
// cuidan a los vecinos que lo trataban como un mensaje vacío o lo perdían:
//   · la PRUEBA de una secuencia mandaba un WhatsApp «[PRUEBA n/N] » en blanco por cada acción;
//   · el GENERADOR le pedía copy al modelo para un paso sin texto;
//   · las tools de MaKo que reescriben pasos (chat y email) los perdían o les ponían audio;
//   · un «ya está así» alarmaba al dueño en cada evento repetido;
//   · un paso de acción de la plataforma se heredaba y corría en el negocio de cada cliente.
//
// Verificado rompiéndolo (08/10/2026), cada rotura de a una y restaurada de memoria:
//   · probarSecuencia vuelve a recorrer sec.pasos: 1 fallo.
//   · el generador vuelve a mandar sec.pasos al modelo: 1 fallo.
//   · asignar_audio_paso sin el rechazo de la acción: 1 fallo.
//   · editar_pasos_secuencia_mensajes sin conservar la acción: 1 fallo.
//   · editar_pasos_secuencia_email sin el rechazo: 1 fallo.
//   · el ejecutor de flujos vuelve a `ok: false` en un «ya está»: 1 fallo.
//   · ejecutarOperacion deja de propagar `yaEstaba`: 1 fallo.
//   · la herencia vuelve a copiar el flujo entero: 1 fallo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de un bloque: desde `ini` hasta el primer `fin` que viene después. */
const bloque = (src: string, ini: string, fin: string): string => {
  const i = src.indexOf(ini);
  assert.ok(i >= 0, `no encontré «${ini}»`);
  const j = src.indexOf(fin, i + ini.length);
  assert.ok(j > i, `no encontré el cierre «${fin}» después de «${ini}»`);
  return src.slice(i, j);
};

test('la prueba de una secuencia manda sólo los MENSAJES: una acción no se prueba', () => {
  const src = sinComentarios(leer('../lib/setting-secuencias.ts'));
  const prueba = bloque(src, 'export async function probarSecuencia', '\n}\n');
  assert.match(prueba, /const mensajes = sec\.pasos\.filter\(\(p\) => !esPasoAccion\(p\)\)/);
  assert.match(prueba, /for \(const paso of mensajes\)/, 'el bucle vuelve a recorrer las acciones y manda un WhatsApp en blanco por cada una');
  assert.match(prueba, /mensajes\.every\(\(p\) => p\.canal === 'whatsapp'\)/);
});

test('el generador no le pide copy al modelo para un paso de acción, y lo devuelve tal cual', () => {
  const src = sinComentarios(leer('../lib/nutricion-generator.ts'));
  const gen = bloque(src, 'export async function generarSecuencia', '\n}\n');
  assert.match(gen, /pasos: JSON\.stringify\(aEscribir\.map\(pasoParaPrompt\)/, 'el modelo vuelve a recibir los pasos de acción');
  assert.match(gen, /if \(esPasoAccion\(orig\)\) return orig;/);
});

test('las tools de MaKo que tocan pasos no pierden ni rompen una acción', () => {
  const chat = sinComentarios(leer('../lib/api-mako/areas/chatbot.run.ts'));
  const audio = bloque(chat, '  asignar_audio_paso: {', '\n  },\n');
  assert.match(audio, /esPasoAccion\(s\.pasos\.find\(\(p\) => p\.orden === orden\)\)\) return \{ error:/, 'un paso de acción recibe un audio que el saneo tira en silencio');
  const editar = bloque(chat, '  editar_pasos_secuencia_mensajes: {', '\n  },\n');
  assert.match(editar, /if \(previo && esPasoAccion\(previo\)\) \{\n\s+pasos\.push\(\{ \.\.\.previo,/, 'la acción no se conserva al reescribir por chat');
  assert.match(editar, /conAcciones && entrada\.length !== s\.pasos\.length/, 'agregar o quitar un paso corre las acciones a otro lugar (el merge es posicional)');
  const ficha = bloque(chat, '  ficha_secuencia_mensajes: {', '\n  },\n');
  assert.match(ficha, /esPasoAccion\(p\) \? \(\{[\s\S]*?tipo: 'accion'[\s\S]*?accion: p\.accion,/, 'MaKo ve la acción como un texto vacío');
  const email = sinComentarios(leer('../lib/api-mako/areas/email.run.ts'));
  const pasosEmail = bloque(email, '  editar_pasos_secuencia_email: {', '\n  },\n');
  assert.match(pasosEmail, /if \(s\.pasos\.some\(esPasoAccion\)\) return \{ error:/, 'la tool de email arma los pasos de cero y borra las acciones');
});

test('«ya está así» es un éxito para un flujo: no le manda una alarma al dueño', () => {
  const flujo = sinComentarios(leer('../lib/api-mako/flujo.ts'));
  assert.match(flujo, /if \(!r\.ok\) return \{ ok: r\.yaEstaba === true, resumen: r\.error, via: 'ninguna' \};/);
  const ejecutar = sinComentarios(leer('../lib/api-mako/ejecutar.ts'));
  assert.match(ejecutar, /\.\.\.\(prep\.yaEstaba \? \{ yaEstaba: true \} : \{\}\)/, 'ejecutarOperacion se come la marca y el flujo vuelve a alarmar');
  // Y las operaciones que un flujo pide más seguido la ponen.
  const crm = sinComentarios(leer('../lib/api-mako/areas/crm.run.ts'));
  for (const op of ['agregar_lead_a_producto', 'quitar_lead_de_producto', 'mover_lead_en_producto']) {
    assert.match(bloque(crm, `  ${op}: {`, '    ejecutar:'), /yaEstaba: true/, `${op} no marca su «ya está»`);
  }
  const chat = sinComentarios(leer('../lib/api-mako/areas/chatbot.run.ts'));
  assert.match(bloque(chat, '  inscribir_lead_secuencia: {', '    ejecutar:'), /v\.porque === 'en_curso' \? \{ yaEstaba: true \}/);
});

test('un paso de acción de la plataforma NO se hereda: el cliente hereda los mensajes', () => {
  const src = sinComentarios(leer('../lib/plantillas.ts'));
  const par = bloque(src, 'async function leerPar', '\n}\n');
  assert.match(par, /if \(!propio\[id\]\?\.flujo && heredable\.flujo\?\.pasos\?\.some\(\(x\) => x\.tipo === 'accion'\)\) \{\n\s+heredable\.flujo = \{ \.\.\.heredable\.flujo, pasos: heredable\.flujo\.pasos\.filter\(\(x\) => x\.tipo !== 'accion'\) \};/);
  // Y se saca ANTES de armar lo efectivo, no después: el orden de la línea importa.
  assert.ok(par.indexOf("heredable.flujo.pasos.filter") < par.indexOf('efectivo[id] = { ...heredable'), 'el filtro corre después de armar lo efectivo y no saca nada');
});
