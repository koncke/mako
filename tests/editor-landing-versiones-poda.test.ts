// =============================================================================
// Las copias que deja MaKo antes de cada cambio se podan como las automáticas (17/10/2026)
// =============================================================================
// docs/relevo/landing-generator.md, tanda 7: «Las versiones "Antes de un cambio de MaKo" no se podan». Cada edición por
// la API o por WhatsApp deja una fila de hasta 1,5 MB, y también cada «Aplicar» del Diagnóstico; nada las borraba. La
// poda de las automáticas (las últimas `TOPE_VERSIONES_AUTO` por motivo) ahora toma esos dos motivos; las publicadas,
// las manuales y las de antes de restaurar quedan todas.
//
// PROBADO ROMPIÉNDOLO (17/10/2026): sin el motivo de MaKo en la lista, 1 fallo; guardarVersion sin podar, 1 fallo;
// la poda filtrando siempre por «Guardado automático», 1 fallo. Base: 2 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOTIVO, MOTIVOS_QUE_SE_PODAN, sePoda } from '../lib/editor-landing/server-reglas';
import { MOTIVO_ANTES_DE_MAKO } from '../lib/api-mako/areas/landing-contenido.helpers';
import { MOTIVO_ANTES_DE_APLICAR } from '../lib/editor-landing/diagnostico';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('se podan las de la máquina (automática, de MaKo, de Aplicar); las de una persona y las publicadas, no', () => {
  assert.equal(sePoda(MOTIVO.auto), true);
  assert.equal(sePoda(MOTIVO_ANTES_DE_MAKO), true, 'el texto de la API y el de acá son el mismo');
  assert.equal(sePoda(MOTIVO_ANTES_DE_APLICAR), true, 'el del Diagnóstico también');
  for (const m of [MOTIVO.publicada, MOTIVO.manual, MOTIVO.antesDeRestaurar, 'Mi versión buena']) assert.equal(sePoda(m), false, m);
  assert.equal(MOTIVOS_QUE_SE_PODAN.length, 3);
});

test('guardarVersion poda su motivo, y la poda filtra por el motivo que le pasan', () => {
  const src = sinComentarios(leer('lib/editor-landing/server.ts'));
  const guardar = src.slice(src.indexOf('export async function guardarVersion('), src.indexOf('export async function restaurarVersion('));
  assert.match(guardar, /if \(sePoda\(v\.motivo\)\) await podarVersionesAuto\(ws, id, v\.motivo\)/);
  const podar = src.slice(src.indexOf('async function podarVersionesAuto('), src.indexOf('async function versionActual('));
  assert.match(podar, /\.eq\('motivo', motivo\)/);
  assert.match(podar, /if \(!sePoda\(motivo\)\) return;/, 'nunca poda una publicada ni una manual');
});
