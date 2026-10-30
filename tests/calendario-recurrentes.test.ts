// =============================================================================
// Publicaciones que se repiten en el Calendario: la regla, lo que nace, lo que se dibuja y el cron (29/10/2026)
// =============================================================================
// Martín, en la llamada con Thiago (29/10, [19:25]): «podés programarte publicaciones recurrentes». El Cerebro: un «Repetir» en el
// evento, la regla en calendario_eventos (mig 0349), un cron que cree y programe por Zernio cada publicación, y que el Calendario
// dibuje las próximas. Lo de abajo corre lo REAL (tests/_calendario-recurrentes-hijo.ts). Lo que tiene que pasar:
//
//   1. CADA VEZ NACE IGUAL AL MOLDE (la hora, la cuenta, el texto) con SU copia del archivo, y se programa por «Programar».
//   2. NADA HACIA ATRÁS y sólo dos días adelante; una segunda pasada no duplica, y dos pasadas a la vez tampoco (índice único).
//      Lo que el cron ya atendió (`repetir_hasta`) no vuelve: borrar o mover una vez NO la hace renacer (revisión de privacidad,
//      29/10, A1).
//   3. EL CALENDARIO DIBUJA LAS PRÓXIMAS que no nacieron, desde ahora, en la capa «Se repite», de sólo lectura y llevando al molde.
//   4. LA REGLA es la del Plan, sólo en una Publicación y nunca en una vez de una serie (A2: dos posts por día), con el molde completo
//      (texto incluido, M5) y CONFIRMADA en la pantalla; sin la mig 0349, el Calendario sigue andando.
//
// Probado ROMPIÉNDOLO (29/10/2026): ver el pie de este archivo.
//
// Correr: node --import tsx --test tests/calendario-recurrentes.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ES_UNA_VEZ_DE_LA_SERIE, faltaParaRepetir, HORIZONTE_DIAS, reglaDePublicacion, vecesACrear, vecesADibujar } from '../lib/calendario-recurrentes-reglas';

const RAIZ = join(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_calendario-recurrentes-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');

test('el hijo corrió entero y no salió a la red', () => {
  assert.equal(R.tiro, undefined, String(R.tiro));
  assert.deepEqual(R.red, []);
});

test('cada vez nace igual al molde, con SU copia del archivo, y se programa por «Programar»', () => {
  assert.deepEqual(R.a.r, { moldes: 1, creadas: 2, programadas: 2, incompletos: 0, fallidas: [] });
  // Hoy (29) a las 10:00 ya pasó: nada hacia atrás. Nacen el 30 y el 31, a las 10:00 de Buenos Aires (13:00 UTC).
  assert.deepEqual(R.a.hijas.map((h: { inicio: string }) => h.inicio), ['2026-10-30T13:00:00.000Z', '2026-10-31T13:00:00.000Z']);
  for (const h of R.a.hijas) {
    assert.deepEqual({ ...h, inicio: undefined }, {
      inicio: undefined, titulo: 'Reel del jueves', formato: 'reel', red: 'instagram', cuenta_red: 'acc_ig', texto: 'El pie', archivo_tipo: 'video',
      archivoPropio: true, repetir: null,
    });
  }
  assert.deepEqual(R.a.copias, ['3/calendario/evmolde1/abcdef1234567890.mp4', '3/calendario/evmolde1/abcdef1234567890.mp4'], 'el archivo del molde se copia');
  assert.deepEqual(R.a.programadas, [2], 'las dos, en una sola llamada a «Programar»');
  assert.equal(R.a.hasta, '2026-10-31', 'el molde anota hasta dónde nació');
});

test('«Deshacer» el borrado de una vez la devuelve CON su serie: su «Repetir» se rechaza y no hay dos series (N1); el molde, con su marca (N8)', () => {
  assert.deepEqual(R.h.serieAlBorrar, { de: 'evmolde1', hasta: null }, 'el borrado guarda su lugar en la serie');
  assert.deepEqual(R.h.vuelta, { serie_de: 'evmolde1', repetir: null });
  assert.deepEqual(R.h.repetirLaVuelta, { ok: false, error: ES_UNA_VEZ_DE_LA_SERIE });
  assert.deepEqual(R.h.trasVuelta, { moldes: 1, creadas: 0, programadas: 0, incompletos: 0, fallidas: [] }, 'una sola serie, y la vuelta no renace');
  assert.deepEqual(R.h.laFalsa, { existe: true, serie_de: null, repetir_hasta: null }, 'lo que manda el navegador se valida');
  assert.deepEqual(R.h.moldeVuelto, { repetir: null, repetir_hasta: '2026-10-31' }, 'la marca vuelve; la regla, no (se pone con su confirmación)');
});

test('borrar o mover una vez NO la hace renacer, ni se dibuja; al día siguiente nace sólo la que toca (A1)', () => {
  assert.deepEqual(R.g.r, { moldes: 1, creadas: 0, programadas: 0, incompletos: 0, fallidas: [] });
  assert.deepEqual(R.g.dibujadas, ['serie:evmolde1:2026-11-01'], 'ni la del 30 ni la del 31: ya se atendieron');
  assert.deepEqual(R.g.r2, { moldes: 1, creadas: 1, programadas: 1, incompletos: 0, fallidas: [] });
  // La del 1/11 de la serie y la movida (20:00 UTC); ni la del 30 ni la del 31. ⚠️ La zona de la prueba es la por defecto (Tijuana:
  // `mako.timezone` no está cargada), y el 1/11 termina su horario de verano: la MISMA hora local del molde es 14:00 UTC, no 13:00.
  assert.deepEqual(R.g.veces, ['2026-11-01T14:00:00.000Z', '2026-11-01T20:00:00.000Z']);
});

test('una segunda pasada no duplica; dos pasadas a la vez tampoco (el índice único), y un molde incompleto no nace', () => {
  assert.deepEqual(R.b.r, { moldes: 1, creadas: 0, programadas: 0, incompletos: 0, fallidas: [] });
  assert.equal(R.b.total, 3);
  assert.deepEqual(R.f, { r: { moldes: 1, creadas: 1, programadas: 1, incompletos: 0, fallidas: [] }, programadas: [1], borradas: 1, hasta: '2026-10-31' });
  assert.deepEqual(R.c, { moldes: 1, creadas: 0, programadas: 0, incompletos: 1, fallidas: [] });
  assert.deepEqual(R.c2, { moldes: 1, creadas: 0, programadas: 0, incompletos: 1, fallidas: [] }, 'sin el texto no sale sola (M5)');
  const completo = { red: 'instagram', cuenta_red: 'a', archivo: 'x', dia_completo: false, texto: 'El pie' };
  assert.equal(faltaParaRepetir({ ...completo, cuenta_red: null }), 'Elige la cuenta donde se publica.');
  assert.equal(faltaParaRepetir({ ...completo, dia_completo: true }), 'Ponle una hora: cada vez sale a esa hora.');
  assert.equal(faltaParaRepetir({ ...completo, texto: ' ' }), 'Escribe el texto: cada vez sale con él.');
  assert.equal(faltaParaRepetir(completo), null);
});

test('el Calendario dibuja las próximas que no nacieron, desde ahora, de sólo lectura y llevando al molde', () => {
  assert.deepEqual(R.d.map((i: { id: string }) => i.id), ['serie:evmolde1:2026-10-31', 'serie:evmolde1:2026-11-01']);
  for (const i of R.d) {
    assert.equal(i.fuente, 'plan', 'no es una fila que se edite desde acá');
    assert.equal(i.capa, 'recurrentes');
    assert.equal(i.href, '/calendario?vista=semana&fecha=2026-10-22&evento=evmolde1');
    assert.equal(i.detalle, 'Se repite · Todos los días');
  }
  assert.match(leer('lib/calendario.ts'), /import\('\.\/calendario-recurrentes'\)\.then\(\(m\) => m\.seriesParaDibujar\(desde, hasta, desdeIso, tz\)\)/);
});

test('las reglas: el molde es la primera vez, nada hacia atrás, dos días adelante, y lo atendido no vuelve', () => {
  assert.equal(HORIZONTE_DIAS, 2);
  assert.deepEqual(vecesACrear({ regla: 'FREQ=DAILY', ancla: '2026-10-29', hoy: '2026-10-29', atendidaHasta: null }), ['2026-10-30', '2026-10-31']);
  assert.deepEqual(vecesACrear({ regla: 'FREQ=DAILY', ancla: '2026-10-20', hoy: '2026-10-29', atendidaHasta: null }), ['2026-10-29', '2026-10-30', '2026-10-31']);
  assert.deepEqual(vecesACrear({ regla: 'FREQ=WEEKLY;BYDAY=MO', ancla: '2026-10-26', hoy: '2026-10-29', atendidaHasta: null }), []);
  assert.deepEqual(vecesACrear({ regla: 'FREQ=DAILY', ancla: '2026-10-29', hoy: '2026-10-29', atendidaHasta: '2026-10-30' }), ['2026-10-31']);
  // Lo atendido no vuelve aunque su fila ya no esté (la borraron o la movieron): A1.
  assert.deepEqual(vecesACrear({ regla: 'FREQ=DAILY', ancla: '2026-10-29', hoy: '2026-10-29', atendidaHasta: '2026-10-31' }), []);
  // Una marca vieja (de antes de hoy) no corre nada: nada hacia atrás igual.
  assert.deepEqual(vecesACrear({ regla: 'FREQ=DAILY', ancla: '2026-10-20', hoy: '2026-10-29', atendidaHasta: '2026-10-25' }), ['2026-10-29', '2026-10-30', '2026-10-31']);
  assert.deepEqual(vecesADibujar({ regla: 'FREQ=DAILY', ancla: '2026-10-20', desde: '2026-10-26', hasta: '2026-10-31', hoy: '2026-10-29', atendidaHasta: null }),
    ['2026-10-29', '2026-10-30', '2026-10-31'], 'nada del pasado');
  assert.deepEqual(vecesADibujar({ regla: 'FREQ=DAILY', ancla: '2026-10-20', desde: '2026-10-26', hasta: '2026-10-31', hoy: '2026-10-29', atendidaHasta: '2026-10-30' }),
    ['2026-10-31'], 'ni lo que el cron ya atendió');
  assert.equal(reglaDePublicacion('cualquier cosa'), null);
  assert.equal(reglaDePublicacion('FREQ=WEEKLY;BYDAY=MO'), 'FREQ=WEEKLY;BYDAY=MO');
});

test('la regla: sólo en una Publicación, válida, y se saca; sin la mig 0349 se dice en palabras', () => {
  assert.deepEqual(R.e, {
    pone: { ok: true }, guardada: 'FREQ=WEEKLY;BYDAY=MO', mala: { ok: false, error: 'Esa repetición no es válida.' },
    bloque: { ok: false, error: 'Sólo una Publicación se repite.' },
    hija: { ok: false, error: ES_UNA_VEZ_DE_LA_SERIE }, hijaRegla: null,
    sinTexto: { ok: false, error: 'Escribe el texto: cada vez sale con él.' },
    saca: { ok: true }, sacada: null,
    deLaHija: { regla: null, disponible: true, serieHref: '/calendario?vista=semana&fecha=2026-10-22&evento=evmolde1' },
  });
  const s = leer('lib/calendario-recurrentes.ts');
  assert.match(s, /if \(esSinMigracion\(error\.message\) \|\| \/repetir\/\.test\(error\.message\)\) return \{ ok: false, error: FALTA_MIGRACION_RECURRENTES \};/);
  // La lectura del Calendario NO nombra las columnas nuevas: sin la 0349, el Calendario sigue andando.
  assert.doesNotMatch(leer('lib/calendario.ts').match(/const COLS = '[^']*'/)?.[0] ?? '', /repetir|serie_de/);
  // La migración: sólo en una Publicación, y la vez única por molde.
  const mig = leer('supabase/migrations/0349_calendario_publicaciones_que_se_repiten.sql');
  assert.match(mig, /check \(repetir is null or \(tipo = 'publicacion' and char_length\(repetir\) between 1 and 200\)\)/);
  assert.match(mig, /create unique index if not exists calendario_eventos_serie_vez_uidx\n\s+on calendario_eventos \(workspace_id, serie_de, inicio\) where serie_de is not null;/);
  // A2 en la base: una vez no lleva regla. A1: el molde anota hasta dónde atendió.
  assert.match(mig, /check \(repetir is null or serie_de is null\)/);
  assert.match(mig, /alter table calendario_eventos add column if not exists repetir_hasta date;/);
});

test('el «Repetir» del evento, sus acciones con el guard, y el cron registrado', () => {
  const p = leer('app/calendario/PublicarEnRed.tsx');
  assert.match(p, /\{repeticion\?\.disponible && !repeticion\.serieHref && \(/, 'sin la mig 0349, o en una vez de una serie, el control no se muestra');
  // M5: elegir una regla (o sacarla) se CONFIRMA antes de guardarla.
  assert.match(p, /if \(!\(await confirm\(pregunta, \{ title: valor \? 'Repetir la publicación' : 'Que no se repita'[^\n]*\n\s+const r = await guardarRepeticionAction\(id, valor \|\| null\);/);
  assert.match(p, /<Select label="Repetir" value=\{repeticion\.regla \?\? ''\}/);
  assert.match(p, /\{ value: '', label: 'No se repite' \},\n\s+\.\.\.PRESETS\.map/);
  const a = leer('app/calendario/actions.ts');
  for (const n of ['repeticionAction', 'guardarRepeticionAction']) {
    const f = a.slice(a.indexOf(`export async function ${n}(`));
    assert.match(f.slice(0, 200), /\n  await guard\(\);/, `${n} sin el guard del Calendario`);
  }
  const vercel = JSON.parse(leer('vercel.json')) as { crons: Array<{ path: string; schedule: string }> };
  assert.deepEqual(vercel.crons.find((c) => c.path === '/api/cron/calendario-recurrentes'), { path: '/api/cron/calendario-recurrentes', schedule: '15 */6 * * *' });
  const cron = leer('app/api/cron/calendario-recurrentes/route.ts');
  assert.match(cron, /const authFail = checkCronAuth\(request\);/);
  assert.match(cron, /correrPorWorkspace\('zernio', async \(ws\) => \{\n\s+const r = await generarRecurrentes\(\);/);
  // Ninguna otra puerta a la red: el generador programa por `programarPublicaciones`.
  const g = leer('lib/calendario-recurrentes.ts');
  assert.match(g, /const programar = deps\.programar \?\? programarPublicaciones;/);
  assert.doesNotMatch(g, /crearPostZernio|zFetch/);
});

// ── Probado ROMPIÉNDOLO (29/10/2026) ──────────────────────────────────────────
// Corrido junto con tests/zernio-varias-claves.test.ts y tests/zernio-leads-barrido.test.ts: 29 pases y 0 fallos. Rota, una por vez:
//   · crea hacia atrás (las veces que pasaron)                 → 26 / 3
//   · el molde se cuenta dos veces (nace otra el mismo día)    → 28 / 1
//   · las que ya nacieron se crean de nuevo                    → 27 / 2
//   · la vez comparte el archivo del molde (no lo copia)       → 28 / 1
//   · se programa aunque la hora ya pasó                       → 27 / 2
//   · el choque de dos pasadas no borra la copia               → 28 / 1
//   · se dibujan veces del pasado                              → 28 / 1
//   · un molde incompleto igual nace                           → 28 / 1
//   · el «Repetir» sin el guard                                → 28 / 1
//
// ROTO 29/10 noche (la revisión de privacidad, A1, A2 y M5; este test solo: 8 / 0 como está). Una por vez:
//   · A1: el cron no anota hasta dónde nació                   → 5 / 3
//   · A1: la marca no corre lo ya atendido                     → 5 / 3
//   · A2: «Repetir» en una vez de una serie                    → 7 / 1
//   · A2: la base deja una regla en una vez                    → 7 / 1
//   · A2: la vez muestra el Select de Repetir                  → 7 / 1
//   · M5: un molde sin texto sale solo                         → 6 / 2
//   · M5: la regla se guarda sin mirar lo que falta            → 7 / 1
//   · M5: la regla se guarda sin confirmar                     → 7 / 1
//
// ROTO 30/10 madrugada (N1 y N8 de la re-verificación, 2910-reverificacion-zernio-leads-da3cff9f7.md; este test solo: 9 / 0):
//   · N1: el borrado no guarda su lugar en la serie            → 8 / 1
//   · N1: el Deshacer no escribe la serie                      → 8 / 1
//   · N1: el molde del navegador no se valida                  → 8 / 1
//   · N8: el molde vuelve sin su marca                         → 8 / 1
//   · N8: la marca del navegador no se valida                  → 8 / 1
