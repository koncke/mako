// =============================================================================
// Dashboard — una hoja con diseño dice lo que FALTA CONECTAR, una vez y arriba (app/dashboard/falta-conectar.ts)
// =============================================================================
// 11/11/2026, Martín: «Una hoja vacía o con "Sin datos" en producción también es una falla». En el ws 3 (sin grabador ni Meta),
// Closing y Anuncio ganador eran tarjetas con «Todavía no hay datos»; el lector sabía la causa y nadie la decía.
//
// Probado ROMPIÉNDOLO, de a una y restaurando:
//   · `faltaConectarDeHoja` sin mirar `sinConexion` (cualquier error)      -> 1 / 1
//   · sin deduplicar (el mismo texto dos veces)                             -> 1 / 1
//   · `aEstado` sin pasar `sinConexion`                                     -> 1 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { faltaConectarDeHoja } from '../app/dashboard/falta-conectar';

const GRABADOR = 'Conecta tu grabador de reuniones (Fathom, tl;dv, Fireflies, Zoom…) en Integraciones';
const META = 'Conecta Meta en Integraciones';

test('los textos de «falta conectar» de la hoja: sin repetir, en orden, y sólo los que son «falta conectar»', () => {
  const datos = {
    a: { error: GRABADOR, sinConexion: true as const },
    b: { error: GRABADOR, sinConexion: true as const },
    c: { error: 'No pude leer los datos' },
    d: { error: META, sinConexion: true as const },
    e: undefined,
  };
  assert.deepEqual(faltaConectarDeHoja(['a', 'b', 'c', 'd', 'e'], datos), [GRABADOR, META]);
  assert.deepEqual(faltaConectarDeHoja(['c', 'e'], datos), [], 'una falla de verdad no es «falta conectar»');
  assert.deepEqual(faltaConectarDeHoja(['x'], datos), []);
});

test('el editor: el estado lleva `sinConexion` y la franja lo dice en una hoja con diseño', () => {
  const ed = readFileSync(join(__dirname, '..', 'app', 'dashboard', 'EditorInforme.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(ed, /error: d\.error, \.\.\.\(d\.sinConexion \? \{ sinConexion: true as const \} : \{\}\)/, '`aEstado` pierde el «falta conectar»');
  assert.match(ed, /const faltaConectar = useMemo\(\(\) => faltaConectarDeHoja\(lienzo\.componentes\.filter\(esGrafico\)\.map\(\(c\) => c\.id\), datos\)/);
  assert.match(ed, /\{faltaConectar\.length > 0 && hoja\.diseno && !dueno && !enBlanco && !compartido && \(/);
  const lector = readFileSync(join(__dirname, '..', 'lib', 'graficos-datos.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(lector, /e instanceof SinConexionError\s*\?\s*\{ ok: false, error: e\.message, sinConexion: true \}/, 'el lector dejó de marcar «falta conectar»');
});
