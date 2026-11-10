// =============================================================================
// Un texto ENTRE CORCHETES en un mensaje de una automatización (10/11/2026)
// =============================================================================
// La auditoría de Automations para un usuario nuevo (Martín: «Leandro lo estuvo intentando utilizar y no lo pudo»):
// «Hola [nombre]» se publicaba y el motor no lo mandaba NUNCA (`pasoConRelleno`: «saltado», reintentado cada 24 h), y
// «[tu link de agenda]» le llegaba literal al lead. Lo que fija este test, ejecutando el código:
//   1. el detector es UNO (lib/flujo-relleno.ts) y lo usan el motor y la API de MaKo, sin copias;
//   2. Publicar (`frenoDelFlujo`, por `faltaEscribir`) frena los dos casos, con su motivo y su tarjeta, y la tarjeta queda
//      marcada (`tarjetasIncompletas`); un mensaje sin corchetes publica igual que siempre;
//   3. NO va en `validarGrafo` (que rechaza un guardado): las semillas nacen con el corchete a propósito.
// Probado rompiéndolo (10/11/2026, base 3/0): sin el corchete en `faltaEscribir` → 1 rojo; con el `[tu link` contado como
// «nunca» → 2 rojos; el motor con su propia regex otra vez → 1 rojo; el corchete metido en `validarGrafo` → 2 rojos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { corcheteDe, pasoConRelleno, problemaDeCorchete } from '../lib/flujo-relleno';
import { frenoDelFlujo, tarjetasIncompletas } from '../lib/flujo-conversacion';
import { validarGrafo, type PasoGrafo } from '../lib/flujo-grafo';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const BASE = { orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, template_wa: null, proveedor: 'no_oficial' } as const;
const msj = (id: string, cuerpo: string, siguiente: string | null = null): PasoGrafo => ({ ...BASE, id, cuerpo, siguiente }) as PasoGrafo;

test('1. el detector: qué no sale nunca y qué le llega literal al lead', () => {
  assert.equal(pasoConRelleno({ cuerpo: 'Hola [nombre], ¿cómo estás?' }), true);
  assert.equal(pasoConRelleno({ cuerpo: 'Hola {{nombre}}' }), false, 'una variable de verdad sale');
  assert.equal(pasoConRelleno({ cuerpo: 'te dejo [tu link de agenda]' }), false, 'el motor manda el [tu link …]');
  assert.equal(pasoConRelleno({ cuerpo: 'x', asunto: 'Hola [nombre]' }), true, 'el asunto de un email cuenta');
  assert.deepEqual(corcheteDe({ cuerpo: 'te dejo [tu link de agenda]' }), { trozo: '[tu link de agenda]', pasa: 'literal' });
  assert.deepEqual(corcheteDe({ cuerpo: 'Hola [nombre] y [tu link]' }), { trozo: '[nombre]', pasa: 'nunca' }, 'lo que no sale manda');
  assert.equal(corcheteDe({ cuerpo: 'Sin corchetes, 100% listo' }), null);
  assert.match(problemaDeCorchete({ cuerpo: 'Hola [nombre]' }, 'Mensaje: Hola')!, /no sale nunca.*usa \{ \}/);
  assert.match(problemaDeCorchete({ cuerpo: '[tu link del video]' }, 'Mensaje')!, /le llegaría así al lead/);
  // Una cosa, un lugar: ni el motor ni la API tienen su copia de la regex.
  for (const f of ['lib/nutricion.ts', 'lib/api-mako/areas/chatbot.run.ts']) {
    assert.doesNotMatch(sinComentarios(leer(f)), /const RX_RELLENO\s*=/, `${f} volvió a tener su propio detector`);
    assert.match(leer(f), /from '@\/lib\/flujo-relleno'/, `${f} importa el detector`);
  }
});

test('2. Publicar frena el corchete con su motivo y su tarjeta, y la tarjeta queda marcada', () => {
  const conRelleno = [msj('a', 'Hola [nombre], te escribo de la tienda')];
  const f1 = frenoDelFlujo(conRelleno);
  assert.ok(f1, 'un mensaje con [nombre] no se publica');
  assert.equal(f1!.tarjeta, 'a');
  assert.match(f1!.error, /\[nombre\].*no sale nunca/);
  assert.ok(tarjetasIncompletas(conRelleno).has('a'), 'la tarjeta se marca en rojo');
  const conLink = [msj('b', 'Agenda acá: [tu link de agenda]')];
  assert.match(frenoDelFlujo(conLink)?.error ?? '', /le llegaría así al lead/);
  assert.equal(frenoDelFlujo([msj('c', 'Hola {{nombre}}, te escribo de la tienda')]), null, 'lo de siempre publica igual');
});

test('3. no va en validarGrafo: guardar un borrador con corchetes (las semillas) sigue andando', () => {
  assert.deepEqual(validarGrafo([msj('a', '[Escribe este mensaje para tu lead]')]), []);
});
