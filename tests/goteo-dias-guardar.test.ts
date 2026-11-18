// =============================================================================
// Los días del goteo se pueden GUARDAR: la regla, la tuerca y la API de MaKo (18/11/2026, F79)
// =============================================================================
// El 9/11/2026 el motor aprendió a leer `goteo.dias` (gotear sólo de lunes a jueves sin achicar el horario entero:
// tests/goteo-dias-propios.test.ts), pero nadie lo podía guardar: `configParaGuardar` descartaba el `dias` que llegaba, la
// tuerca no tenía la fila y `configurar_automatizacion` no lo aceptaba. Este archivo fija las tres puertas:
//   1. la regla pura (lib/config-automatizacion.ts): `configParaGuardar` con `dias`, `diasDelCambio`, `diasDeGoteoDelTexto`,
//      `alternarDiaDeGoteo` y `diasAlPrenderGoteo`;
//   2. la tuerca (app/automations/ConfigAutomatizacionPanel.tsx): los botones de los días (`BotonesDias`, dibujados) y la fila
//      «Días» en el bloque «Todos los canales», cableada a esas funciones;
//   3. la API de MaKo: el runner REAL de `configurar_automatizacion` y `configuracion_automatizacion` sobre una base en
//      memoria (tests/_email-campana-hijo.ts, escenario «goteo-dias»).
//
// Correr: node --import tsx --test tests/goteo-dias-guardar.test.ts
// PROBADO ROMPIÉNDOLO (18/11/2026), de a una y restaurando; base 7/0:
//   · `configParaGuardar` sin el bloque de los días                        → 4/3 (la regla, el rechazo y la API)
//   · `diasDelCambio` sin rechazar un día que no existe (lo descarta)      → 5/2
//   · aceptar la lista vacía                                                → 5/2
//   · `alternarDiaDeGoteo` dejando sacar el último día                      → 6/1
//   · el runner sin leer `goteoDias`                                        → 5/2
//   · la fila «Días» fuera del bloque de la tuerca                          → 6/1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ERROR_SIN_DIAS, alternarDiaDeGoteo, configParaGuardar, diasAlPrenderGoteo, diasDeGoteoDelTexto, diasDelCambio, sanearConfigAutomatizacion,
  textoDeDiasGoteo,
} from '../lib/config-automatizacion';
import { BotonesDias } from '../app/automations/FilasOpciones';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la regla: los días se guardan (ordenados y sin repetir), «null» los saca, y lo demás del goteo no se toca', () => {
  const r = configParaGuardar({ goteo: { minutos: 5 } }, { goteo: { dias: [4, 1, 2, 3, 1] } });
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.config.goteo, { minutos: 5, dias: [1, 2, 3, 4] });
  // Lo guardado vuelve igual al leerlo: el motor lo aplica con `hoyGotea` (tests/goteo-dias-propios.test.ts).
  assert.deepEqual(r.ok && sanearConfigAutomatizacion(r.valor).goteo, { minutos: 5, dias: [1, 2, 3, 4] });
  // Sólo días: elegir días es configurar el goteo.
  const solo = configParaGuardar({}, { goteo: { dias: [1] } });
  assert.ok(solo.ok && !solo.vacia);
  assert.deepEqual(solo.ok && solo.config.goteo, { dias: [1] });
  // `null` los saca y vuelven los del horario; sin nada más, la clave se borra (`vacia`).
  const sin = configParaGuardar({ goteo: { dias: [1, 2] } }, { goteo: { dias: null } });
  assert.ok(sin.ok && sin.vacia);
  assert.equal(sin.ok && sin.config.goteo, undefined);
  // Cambiar los minutos no borra los días.
  const min = configParaGuardar({ goteo: { dias: [1, 2] } }, { goteo: { minutos: 7 } });
  assert.deepEqual(min.ok && min.config.goteo, { dias: [1, 2], minutos: 7 });
});

test('2. ⚠️ lo que no se entiende se RECHAZA, nunca se guarda una lista a medias ni vacía', () => {
  // Una lista a medias manda los días equivocados sin decirlo; vacía sería «no goteés nunca».
  assert.deepEqual(diasDelCambio([1, 9]), { error: 'Los días van de 0 (domingo) a 6 (sábado).' });
  assert.deepEqual(diasDelCambio([1, 'martes']), { error: 'Los días van de 0 (domingo) a 6 (sábado).' });
  assert.deepEqual(diasDelCambio([]), { error: ERROR_SIN_DIAS });
  assert.deepEqual(diasDelCambio('1,2'), { error: 'Los días del goteo no se entienden.' });
  assert.equal(diasDelCambio(null), null);
  for (const malo of [[1, 9], [], 'lunes', [2.5]]) {
    const r = configParaGuardar({ goteo: { dias: [3] } }, { goteo: { dias: malo } });
    assert.equal(r.ok, false, JSON.stringify(malo));
  }
  // El texto de la API: «horario» los saca; la misma validación.
  assert.deepEqual(diasDeGoteoDelTexto('1, 2,3'), { dias: [1, 2, 3] });
  assert.deepEqual(diasDeGoteoDelTexto(' Horario '), { dias: null });
  assert.equal('error' in diasDeGoteoDelTexto('1,9'), true);
  assert.deepEqual(diasDeGoteoDelTexto(' , '), { error: ERROR_SIN_DIAS });
  assert.equal(textoDeDiasGoteo([1, 2, 3, 4]), 'lunes, martes, miércoles y jueves');
  assert.equal(textoDeDiasGoteo([0]), 'domingo');
  assert.equal(textoDeDiasGoteo([0, 1, 2, 3, 4, 5, 6]), 'todos los días');
});

test('3. la tuerca: prender arranca con los días del horario que vale, y el último día no se puede sacar', () => {
  assert.deepEqual(diasAlPrenderGoteo({ activo: true, desde: 9, hasta: 18, dias: [5, 1, 2] }), [1, 2, 5]);
  assert.deepEqual(diasAlPrenderGoteo({ activo: false, desde: 9, hasta: 18, dias: [1] }), [0, 1, 2, 3, 4, 5, 6], 'sin horario, toda la semana');
  assert.deepEqual(diasAlPrenderGoteo(null), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(alternarDiaDeGoteo([1, 2, 3], 2), [1, 3]);
  assert.deepEqual(alternarDiaDeGoteo([3, 1], 0), [0, 1, 3]);
  assert.equal(alternarDiaDeGoteo([4], 4), null, 'sin ningún día no queda: se dice y no se guarda');
});

test('4. los botones de los días: los siete, de lunes a domingo, y prendidos los elegidos', () => {
  const html = renderToStaticMarkup(createElement(BotonesDias, { dias: [1, 4], onAlternar: () => {} }));
  const botones = [...html.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*aria-label="([^"]+)"/g)].map((m) => [m[2], m[1]]);
  assert.deepEqual(botones.map((b) => b[0]), ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']);
  assert.deepEqual(botones.filter((b) => b[1] === 'true').map((b) => b[0]), ['lunes', 'jueves']);
  assert.match(html, /role="group" aria-label="Días"/);
});

test('5. la tuerca: «Días» es una fila del bloque «Todos los canales», cableada a la regla', () => {
  const src = sinComentarios(leer('app/automations/ConfigAutomatizacionPanel.tsx'));
  const filas = src.slice(src.indexOf('filas: d ? ['), src.indexOf('] : [],', src.indexOf('filas: d ? [')));
  assert.match(filas, /<FilaDias key="dias"/, 'la fila «Días» no está en el bloque del goteo');
  assert.match(filas, /alPrender=\{diasAlPrenderGoteo\(horarioParaMostrar\(d\.config, d\.horarioNegocio\)\)\}/);
  const fila = src.slice(src.indexOf('function FilaDias('), src.indexOf('\n}\n', src.indexOf('function FilaDias(')));
  assert.match(fila, /guardar\(\{ dias: x \? alPrender : null \}\)/, 'apagar los saca (vuelven los del horario)');
  assert.match(fila, /const nuevo = alternarDiaDeGoteo\(dias, dia\);\s*if \(!nuevo\) \{ onInvalido\(ERROR_SIN_DIAS\); return; \}/);
});

// El hijo corre PEREZOSO, adentro de cada test (AGENTS.md: lo que puede tirar no va en una constante del módulo, o un hijo
// que muere tira el archivo entero sin nombrar qué test). Una sola corrida para los dos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let memo: Record<string, any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hijo(): Record<string, any> {
  if (memo) return memo;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_email-campana-hijo.ts'), 'goteo-dias'], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 180_000,
  });
  memo = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length));
  return memo!;
}

test('6. la API: `configurar_automatizacion` con `goteoDias` propone, guarda y `configuracion_automatizacion` lo dice', () => {
  const R = hijo();
  assert.match(String(R.diaQueNoExiste.error), /van de 0 \(domingo\) a 6 \(sábado\)/);
  assert.match(String(R.palabra.error), /van de 0 \(domingo\) a 6 \(sábado\)/);
  assert.equal(R.vacia.error, ERROR_SIN_DIAS);
  assert.deepEqual(R.preparar.payload.cambio, { goteo: { dias: [1, 2, 3, 4] } });
  assert.match(String(R.preparar.resumen), /«Reactivación»: sale sólo lunes, martes, miércoles y jueves/);
  assert.equal(R.ejecutar.ok, true);
  assert.deepEqual(JSON.parse(String(R.guardado)), { goteo: { dias: [1, 2, 3, 4] } });
  assert.equal(R.leido.dias, 'lunes, martes, miércoles y jueves');
  assert.deepEqual(JSON.parse(String(R.trasMinutos)), { goteo: { dias: [1, 2, 3, 4], minutos: 5 } }, 'los minutos no borran los días');
});

test('7. la API: «horario» saca los días y vuelven los de su horario', () => {
  const R = hijo();
  assert.deepEqual(R.prepararHorario.payload.cambio, { goteo: { dias: null } });
  assert.match(String(R.prepararHorario.resumen), /sale los días de su horario/);
  assert.deepEqual(JSON.parse(String(R.trasHorario)), { goteo: { minutos: 5 } });
  assert.equal(R.leidoTrasHorario.dias, 'los de su horario');
  assert.deepEqual(R.otros, [], 'nada sale a la red');
});
