// =============================================================================
// Qué etapas cubre una automatización: TODOS sus CRON (lib/secuencias-cobertura.ts)
// =============================================================================
// Restos de versiones anteriores, grupo «lista» (10/10/2026). `huecosDeSecuencias` —la operación
// `huecos_secuencias` de la API de MaKo, y hasta ese día el pie «N etapas sin secuencia · Armar una» de
// /automations— leía sólo `etapa` y `trigger_tipo` (el PRIMER CRON) y no leía el `error` de la consulta:
// una automatización que arranca en una etapa por su segundo CRON contaba como hueco, y con la lectura
// caída todas las etapas salían como huecos.
//
// PROBADO ROMPIÉNDOLO (10/10/2026, restaurando de memoria; base 5 pases / 0 fallos):
//   · `etapasCubiertas` mirando sólo las columnas (sin `disparadoresDe`)          → 2 fallos, 3 pases;
//   · sin las `etapas` del CRON «Producto» (sólo `d.etapa`)                        → 1 fallo, 4 pases;
//   · sin saltear las archivadas                                                  → 1 fallo, 4 pases;
//   · `huecosDeSecuencias` sin el `if (error) throw`                              → 1 fallo, 4 pases;
//   · `huecosDeSecuencias` sin `disparadores` en el select                        → 1 fallo, 4 pases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { etapasCubiertas, type FilaCobertura } from '../lib/secuencias-cobertura';

const LEGACY = { no_show_j1: ['noshow_r1'], confirmado_sin_pago: ['nopaga'] } as const;
const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el SEGUNDO CRON también cubre su etapa (mig 0241)', () => {
  const fila: FilaCobertura = {
    trigger_tipo: 'etapa_actual', etapa: 'nutri', etapas: null,
    disparadores: [
      { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'nutri' },
      { id: 'd2', trigger_tipo: 'etapa_actual', etapa: 'noshow_r1' },
    ],
  };
  const c = etapasCubiertas([fila], LEGACY);
  assert.ok(c.has('nutri'), 'el primero dejó de cubrir');
  assert.ok(c.has('noshow_r1'), 'el segundo CRON no cuenta: su etapa sale como hueco');
});

test('un CRON con VARIAS etapas las cubre todas (mig 0230), también sin la columna de la 0241', () => {
  const c = etapasCubiertas([{ trigger_tipo: 'etapa_actual', etapa: 'nutri', etapas: ['nutri', 'nopaga'] }], LEGACY);
  assert.deepEqual([...c].sort(), ['nopaga', 'nutri']);
});

test('una archivada no cubre nada; una pausada sí (no hay columna de pausa: cuenta igual)', () => {
  const c = etapasCubiertas([
    { trigger_tipo: 'etapa_actual', etapa: 'nutri', archivada_at: '2026-10-01T00:00:00Z' },
    { trigger_tipo: 'etapa_actual', etapa: 'nopaga', archivada_at: null },
  ], LEGACY);
  assert.deepEqual([...c], ['nopaga']);
});

test('un disparador de antes cubre lo de su trigger, y la columna `etapa` sigue contando como antes', () => {
  const c = etapasCubiertas([{ trigger_tipo: 'no_show_j1', etapa: 'noshow' }], LEGACY);
  assert.ok(c.has('noshow_r1'), 'el trigger de antes dejó de cubrir su etapa');
  assert.ok(c.has('noshow'), 'una etapa que antes salía cubierta pasaría a ser un hueco');
});

test('huecosDeSecuencias lee los CRON enteros y una lectura caída TIRA (no son «todas huecos»)', () => {
  const src = sinComentarios(leer('lib/secuencias-huecos.ts'));
  const ini = src.indexOf('export async function huecosDeSecuencias(');
  const cuerpo = src.slice(ini, src.indexOf('\n}\n', ini));
  assert.ok(ini >= 0 && cuerpo.length > 200 && cuerpo.length < 2000, `el recorte mide ${cuerpo.length}`);
  assert.match(cuerpo, /\.select\('etapa, etapas, trigger_tipo, disparadores, archivada_at'\)/);
  assert.match(cuerpo, /if \(error\) throw new Error\(`huecosDeSecuencias: \$\{error\.message\}`\);/);
  assert.match(cuerpo, /etapasCubiertas\(\(data \?\? \[\]\) as FilaCobertura\[\], LEGACY_TRIGGER_CUBRE\)/);
});
