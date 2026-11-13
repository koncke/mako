// =============================================================================
// B-roll sin Pexels: los archivos del propio proyecto (12/11/2026)
// =============================================================================
// Probando la tab Video en el negocio de MaKo, «B-roll de MaKo» quedó en «Conectar Pexels para las imágenes» y sólo
// cambios de plano. Ese negocio no tiene clave, ni ningún otro, ni la plataforma (Pexels es de cada negocio:
// lib/pexels.ts, y se miró en la base y en Vercel). Mientras no la conecte, el B-roll sale de lo que la persona YA subió a
// Multimedia, y la sección dice cómo conseguir la clave.
//
// Correr: node --import tsx --test tests/video-editor-broll-propio.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brollPropio, MOTIVO_PROPIO, type MedioPropio } from '../app/video-editor/_opencut/broll/pistas';
import { avisoFaltaPexels, resumenDeBroll, textoSinPexels } from '../app/video-editor/_opencut/broll/resultado';
import type { HuecoBroll } from '../lib/editor-video/broll';
import type { SceneTracks } from '../app/video-editor/_opencut/timeline/types';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const hueco = (i: number, inicio: number, fin: number, puntaje: number): HuecoBroll => ({ i, inicio, fin, frase: `frase ${i}`, palabras: [], puntaje });
const HUECOS = [hueco(0, 2, 5, 3), hueco(1, 10, 16, 9), hueco(2, 20, 23, 5), hueco(3, 30, 33, 1)];
const tracks = (main: string[], encima: string[] = []): SceneTracks =>
  ({
    main: { id: 'pm', type: 'video', name: 'Principal', elements: main.map((m, i) => ({ id: `p${i}`, type: 'video', mediaId: m, startTime: 0, duration: 1, params: {} })) },
    overlay: encima.length ? [{ id: 'po', type: 'video', name: 'Mía', elements: encima.map((m, i) => ({ id: `o${i}`, type: 'image', mediaId: m, startTime: 0, duration: 1, params: {} })) }] : [],
    audio: [],
  }) as unknown as SceneTracks;
const video = (id: string, duracion: number): MedioPropio => ({ id, nombre: `${id}.mp4`, tipo: 'video', duracion });
const foto = (id: string): MedioPropio => ({ id, nombre: `${id}.jpg`, tipo: 'image', duracion: null });

test('P1: lo que ya está en la línea de tiempo no va de B-roll (la cara, ni lo que ya está encima)', () => {
  const pares = brollPropio({ medios: [video('cara', 60), foto('logo'), foto('local')], tracks: tracks(['cara'], ['logo']), huecos: HUECOS, objetivo: 3 });
  assert.deepEqual(pares.map((p) => p.medio.id), ['local']);
  assert.equal(pares[0].hueco.i, 1, 'en el hueco de más peso');
  assert.deepEqual(brollPropio({ medios: [video('cara', 60)], tracks: tracks(['cara']), huecos: HUECOS, objetivo: 3 }), [], 'sólo la toma: nada');
});

test('P2: cada archivo una vez, en los huecos de más peso y en el orden del video', () => {
  const pares = brollPropio({ medios: [foto('a'), foto('b'), foto('c'), foto('d'), foto('e')], tracks: tracks(['cara']), huecos: HUECOS, objetivo: 3 });
  assert.deepEqual(pares.map((p) => p.hueco.i), [0, 1, 2], 'los 3 de más peso (9, 5 y 3), ordenados por tiempo');
  assert.equal(new Set(pares.map((p) => p.medio.id)).size, 3, 'no se repite ninguno');
});

test('P3: un video va sólo donde alcanza su largo; una foto, en cualquiera', () => {
  // El hueco 0 dura 6 s: el video de 4 s no alcanza y va la foto; el de 4 s entra en el de 3 s.
  const pares = brollPropio({ medios: [video('corto', 4), foto('f')], tracks: tracks(['cara']), huecos: [hueco(0, 10, 16, 9), hueco(1, 20, 23, 5)], objetivo: 2, margen: 0.1 });
  assert.deepEqual(pares.map((p) => [p.hueco.i, p.medio.id]), [[0, 'f'], [1, 'corto']]);
  assert.deepEqual(brollPropio({ medios: [video('justo', 3)], tracks: tracks(['cara']), huecos: [hueco(0, 20, 23, 5)], objetivo: 1, margen: 0.1 }), [], 'con el margen, no');
});

test('P4: los textos dicen cómo conseguir la clave y qué hizo MaKo mientras tanto', () => {
  assert.match(textoSinPexels(0), /pexels\.com\/api/);
  assert.match(textoSinPexels(0), /importa tus clips a Multimedia/);
  assert.match(textoSinPexels(2), /salió de tus archivos de Multimedia/);
  assert.match(avisoFaltaPexels('fotos', 2), /^usé 2 archivos tuyos de Multimedia; para las fotos de stock, conecta Pexels/);
  assert.match(avisoFaltaPexels('fotos', 1), /^usé un archivo tuyo/);
  assert.equal(resumenDeBroll({ ok: true, broll: 3, planos: 8, propios: 3, aviso: null, faltaPexels: true }), 'Propuestas: 3 archivos tuyos y 8 cambios de plano. Deja o saca cada una.');
  assert.equal(resumenDeBroll({ ok: true, broll: 2, planos: 0, aviso: null, faltaPexels: false }), 'Propuestas: 2 imágenes. Deja o saca cada una.');
});

test('P5: «Proponer» usa los propios SÓLO sin Pexels, sin pagar la IA, y la sección lo dice', () => {
  const proponer = sinComentarios(leer('app/video-editor/_opencut/broll/proponer.ts'));
  const iPropios = proponer.indexOf('brollPropio({');
  assert.ok(iPropios > 0);
  assert.match(proponer, /if \(faltaPexels && huecos\.length && objetivo\) \{/);
  assert.match(proponer, /\[PARAM_MOTIVO\]: MOTIVO_PROPIO,/);
  assert.match(proponer, /if \(propios\) brollRehecho = true;/, 'los propios reemplazan lo pendiente');
  assert.ok(!/accion: "elegir"/.test(proponer.slice(iPropios, proponer.indexOf('const capas'))), 'sin IA');
  assert.match(MOTIVO_PROPIO, /Multimedia/);
  const vista = sinComentarios(leer('app/video-editor/_opencut/broll/components/broll-view.tsx'));
  assert.match(vista, /\{textoSinPexels\(propios\)\}/);
  // La Edición automática no se saltea si hubo propios.
  assert.match(sinComentarios(leer('app/video-editor/_opencut/enjambre/correr.ts')), /if \(esBroll && r\.faltaPexels && !r\.propios\) \{/);
});

test('P6: sólo los cambios de plano (la Edición automática los corre aparte) no borran el aviso de Pexels de la sección', () => {
  const proponer = sinComentarios(leer('app/video-editor/_opencut/broll/proponer.ts'));
  assert.match(proponer, /const pexelsAntes = \{ faltaPexels: trabajo\.faltaPexels, propios: trabajo\.propios \};/);
  assert.match(proponer, /\.\.\.\(conBroll \|\| !r\.ok\s*\? \{ faltaPexels: r\.ok \? r\.faltaPexels : false, propios: r\.ok \? \(r\.propios \?\? 0\) : 0 \}\s*: pexelsAntes\),/);
});
