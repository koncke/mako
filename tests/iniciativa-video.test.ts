// =============================================================================
// MaKo toma la iniciativa en el Video Editor: los subtítulos primero (5/11/2026, T11 de docs/mako-iniciativa/plan.md)
// =============================================================================
// Martín (29/10/2026): «en todos lados que haya un chat de MaKo, que MaKo te vaya guiando dependiendo del template que se eligió,
// o de la situación de la persona… EN LUGAR de botones en la top bar». Lo que se fija:
//   1. la apertura (lib/aperturas/video.ts): con voz, sin subtítulos y con la charla vacía pregunta un HECHO, «¿Lo van a ver sin
//      sonido?»; «No, con sonido» queda para ESE proyecto (alcance `entidad`); con subtítulos, sin sonido, con charla o ya
//      contestada, calla;
//   2. el montaje: «Sí, en el feed» corre el MISMO motor que el botón de Subtítulos (`generarSubtitulos`, sin la app también) y
//      dice el resultado; las píldoras de siempre se esconden mientras la apertura habla; la voz se cuenta en las pistas.
//
// Correr: node --import tsx --test tests/iniciativa-video.test.ts
// PROBADO ROMPIÉNDOLO (base 2/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CON_SONIDO, ID_SIN_SONIDO, aperturaVideo } from '../lib/aperturas/video';
import { PREGUNTA_DE_ACCION, claveApertura, claveValida, problemasDeApertura } from '../lib/aperturas/reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la apertura: con voz y sin subtítulos pregunta un hecho, por proyecto; si no, calla', () => {
  const h = { proyecto: '0f8e2c1a-77b4-4c1e-9d2a-1b2c3d4e5f60', conAudio: true, subtitulos: 0, charlaVacia: true };
  const a = aperturaVideo(h, {})!;
  assert.equal(a.id, ID_SIN_SONIDO);
  assert.match(a.texto, /¿Lo van a ver sin sonido\?$/);
  assert.doesNotMatch(a.texto, PREGUNTA_DE_ACCION);
  assert.deepEqual(problemasDeApertura(a, { primerPaso: true }), []);
  assert.equal(a.alcance, 'entidad', 'lo contestado vale para ESE proyecto');
  assert.ok(claveValida(claveApertura(a.id, a.entidad)), 'la clave con el proyecto pasa la validación de la ruta');
  assert.deepEqual(a.botones.map((b) => b.tipo), ['hacer', 'respuesta', 'callar']);
  assert.equal(aperturaVideo({ ...h, subtitulos: 3 }, {}), null, 'ya tiene subtítulos');
  assert.equal(aperturaVideo({ ...h, conAudio: false }, {}), null, 'sin sonido no hay qué subtitular');
  assert.equal(aperturaVideo({ ...h, charlaVacia: false }, {}), null, 'con la charla empezada, el hilo ya es la conversación');
  assert.equal(aperturaVideo(h, { [ID_SIN_SONIDO]: CON_SONIDO }), null, '«No, con sonido» no vuelve');
  assert.equal(aperturaVideo({ ...h, proyecto: '' }, {}), null);
});

test('2. el montaje: el mismo motor que el botón, las píldoras se esconden, y la voz se cuenta en las pistas', () => {
  const chat = sinComentarios(leer('app/video-editor/_opencut/chat/PanelChat.tsx'));
  assert.match(chat, /void generarSubtitulos\(editorRef\.current\)\.then\(\(r\) => \(r\.ok \? toast\("Subtítulos listos"\) : toast\(textoDeSubtitulos\(r\.motivo\)\)\)\);/,
    'el motor del botón, y el resultado dicho (nunca un «no se pudo» mudo)');
  assert.match(chat, /acciones=\{\{ subtitulos: ponerSubtitulos \}\}/);
  assert.match(chat, /\{hilo\.mensajes\.length === 0 && !estadoApertura\.apertura && \(/, 'las píldoras, sólo sin la apertura');
  assert.match(chat, /subtitulos: subtitulosDe\(tracksVivos\)\.length, charlaVacia: hilo\.mensajes\.length === 0/, 'el detector es subtitulosDe (sinSubtitulos borra)');
  assert.match(chat, /tracksVivos\.main\.elements\.some\(\(e\) => e\.type === "video"\) \|\| tracksVivos\.audio\.some\(\(t\) => t\.elements\.length > 0\)/);
});

// PROBADO ROMPIÉNDOLO (5/11/2026, base 2/0):
//   · la apertura habla aunque ya haya subtítulos             → 1/1 (1)
//   · «Sí, en el feed» no dice el resultado (sin el toast)     → 1/1 (2)
//   · las píldoras siguen a la vista con la apertura           → 1/1 (2)
