// =============================================================================
// Meta guarda 37 meses: ningún período libre le llega a Meta con un `since` más viejo
// =============================================================================
// #876 (llamada Mau <> Martín del 16/10/2026, 53:01): en la hoja Ads Analyst recién creada, el pop-up de un anuncio
// ganador traía el video y el guion, pero no los números, el diario ni la audiencia. La hoja va con el período «Todo»
// (desde 2020-01-01) y /api/ad-insights se lo pasaba tal cual a Meta, que contesta #3018 («cannot be beyond 37 months»).
// Medido el 17/10/2026 contra un anuncio del ws1: desde 2023-09-18 contesta; desde 2023-09-16 y desde 2020-01-01, #3018.
//
// Correr: node --import tsx --test tests/meta-rango.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026, base 3/0): /api/ad-insights de vuelta con `JSON.stringify({ since: desde, … })`
// → 1 / 2 (el barrido y la puerta); `desdeQueGuardaMeta` sin el tope de 37 meses → 2 / 1; lib/meta-desgloses.ts sin
// `timeRangeMeta` → 1 / 2.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { desdeQueGuardaMeta, timeRangeMeta } from '../lib/meta-rango';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Las lecturas de Meta que NO llevan un período libre, con el porqué. */
const SIN_PERIODO_LIBRE: Record<string, string> = {
  'lib/meta-ads.ts': 'la sincronización diaria pide UN día (since = until = la fecha que sincroniza)',
};

test('el tope: con el período «Todo» se pide desde lo que Meta guarda, con margen', () => {
  // 37 meses antes del 17/10/2026 es el 17/09/2023; Meta aceptó desde el 18 y no desde el 16. Dos días de margen: el 19.
  assert.equal(desdeQueGuardaMeta('2020-01-01', '2026-10-17'), '2023-09-19');
  assert.equal(desdeQueGuardaMeta('2023-09-16', '2026-10-17'), '2023-09-19');
  assert.equal(desdeQueGuardaMeta('2026-01-01', '2026-10-17'), '2026-01-01', 'un período adentro de los 37 meses no se toca');
  assert.equal(timeRangeMeta('2020-01-01', '2026-10-16', '2026-10-17'), '{"since":"2023-09-19","until":"2026-10-16"}');
});

test('toda lectura de Meta con un período libre arma su time_range con timeRangeMeta', () => {
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).map((f) => f.trim()).filter((f) => /\.tsx?$/.test(f) && !f.startsWith('app/admin/dev/'));
  assert.ok(archivos.length > 300, `git ls-files devolvió ${archivos.length} archivos: esto no corrió en el repo`);
  const conRango = archivos.filter((f) => /['"]time_range['"]/.test(sinComentarios(leer(f))));
  assert.ok(conRango.includes('app/api/ad-insights/route.ts'), 'el barrido no encontró /api/ad-insights: no mira nada');
  const malos = conRango.filter((f) => !SIN_PERIODO_LIBRE[f]).filter((f) => {
    const src = sinComentarios(leer(f));
    return !/import \{[^}]*\btimeRangeMeta\b[^}]*\} from '(@\/lib|\.)\/meta-rango'/.test(src) || /JSON\.stringify\(\{\s*since:/.test(src);
  });
  assert.deepEqual(malos, [], 'una lectura de Meta arma su time_range a mano: con un período de más de 37 meses, Meta contesta #3018');
});

test('las tres puertas del período libre: el anuncio, la campaña o el conjunto, y los desgloses de la cuenta', () => {
  for (const f of ['app/api/ad-insights/route.ts', 'app/api/entity-insights/route.ts']) {
    assert.match(sinComentarios(leer(f)), /const timeRange = timeRangeMeta\(desde, hasta\);/, f);
  }
  assert.match(sinComentarios(leer('lib/meta-desgloses.ts')), /u\.searchParams\.set\('time_range', timeRangeMeta\(p\.desde, p\.hasta\)\);/);
});
