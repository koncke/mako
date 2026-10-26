// =============================================================================
// MaKo recomienda (26/10/2026): la memoria de lo que decidió el negocio, escrita como corresponde
// =============================================================================
// La revisión del tren-l (hallazgos 10, 11, 14 y 15) encontró que:
//   10. el compare-and-set comparaba el JSON ENTERO en la URL (PostgREST manda los filtros ahí): a unas 35 decisiones ningún
//       botón guardaba más nada, para siempre;
//   14. una recomendación que la IA armó con varias señales se decidía sólo sobre la primera, y la otra volvía enseguida;
//   15. la misma decisión repetida (otra pestaña con la lista vieja) sumaba otra fila;
//   11. WhatsApp se leía con un `.limit(6000)` que PostgREST corta en 1000 sin avisar.
// Los tres primeros se miden con `decidirRecomendacion` REAL contra una base de mentira (tests/_recomienda-memoria-hijo.ts);
// el cuarto, en el fuente (la base de mentira no corta en 1000).
//
// Probado rompiéndolo (26/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_recomienda-memoria-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 180_000, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as {
  error?: string; bytesAntes: number; senalesTipos: string[];
  r1: { ok: boolean }; patches1: string[]; ultimas1: string[]; total1: number;
  r2: { ok: boolean }; patches2: number; ultimas2: string[]; total2: number;
  r3: { ok: boolean }; patches3: number; total3: number;
};
const S1 = 'respuesta-lenta|negocio', S2 = 'esperando-respuesta|negocio';

test('11. los grupos no se comen el tope de lectura: con 6.100 mensajes de grupos de ayer, las charlas con leads se leen', () => {
  assert.equal(R.error, undefined, String(R.error));
  assert.ok(R.senalesTipos.includes('respuesta-lenta') && R.senalesTipos.includes('esperando-respuesta'), `señales: ${R.senalesTipos.join(', ')}`);
});

test('10. con una memoria grande (más de 20 KB) la decisión se guarda, y la escritura compara `updated_at`, nunca el valor', () => {
  assert.ok(R.bytesAntes > 20_000, `la memoria de prueba pesa ${R.bytesAntes} bytes`);
  assert.deepEqual(R.r1, { ok: true });
  assert.equal(R.patches1.length, 1);
  assert.match(R.patches1[0], /updated_at=eq\./, 'el compare-and-set no compara la versión');
  assert.doesNotMatch(R.patches1[0], /value=eq\./, 'el JSON entero viaja en la URL: a unas 35 decisiones ya no entra');
});

test('14. la pantalla manda la tarjeta que se VIO: con una redacción vieja guardada, no se decide sobre otra señal', () => {
  assert.deepEqual(R.ultimas1, [`landing-no-convierte|landing:https://negocio-de-prueba.com/pagina-79=ahora-no`, `${S1}=ahora-no`], 'se anotó algo sobre una señal que la persona no vio');
  assert.equal(R.total1, 81);
});

test('14. sin claves (la API), se expande sólo con la redacción que SE MUESTRA hoy (la misma huella)', () => {
  assert.deepEqual(R.r2, { ok: true });
  assert.equal(R.patches2, 1);
  assert.deepEqual(R.ultimas2, [`${S1}=no-aplica`, `${S2}=no-aplica`]);
  assert.equal(R.total2, 83);
});

test('15. la misma decisión otra vez, mientras sigue vigente, no escribe nada y contesta ok', () => {
  assert.deepEqual(R.r3, { ok: true }, 'la pantalla tiene que poder sacar la tarjeta igual');
  assert.equal(R.patches3, 0, 'repetir la decisión volvió a escribir');
  assert.equal(R.total3, 83);
});

test('11. WhatsApp se lee PAGINADO (PostgREST corta en 1000 sin avisar), sólo PERSONAS, del más nuevo al más viejo y con la PK al final', () => {
  const src = fuente('lib/recomendaciones.ts');
  assert.doesNotMatch(src, /from\('wa_mensajes'\)[^;]*\.limit\(/, 'un `.limit(N)` no sube el techo de 1000: el borde de lo leído nunca se activaba');
  assert.match(src, /leerPorPaginas<MensajeSenal>\(db, 'wa_mensajes', 'id, [^']*'/);
  assert.match(src, /orden: \[\{ col: 'wa_timestamp', asc: false \}, \{ col: 'id', asc: false \}\]/);
  assert.match(src, /return msgs\.length < MAX_MENSAJES;/, 'el tope se corta en el call-site, devolviendo false');
  assert.match(src, /\.or\(FILTRO_PERSONAS_WA\)/);
});

// ── Probado rompiéndolo (26/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano en lib/recomendaciones.ts, corrido y restaurado de memoria:
//   1. `guardarMemoria` con `cambiarSettingSi(CLAVE_MEMORIA, <el valor leído>, …)` (el compare-and-set por valor) → rojo «10.».
//   2. `clavesDeLaRecomendacion` devolviendo sólo `[clave]`                          → rojo «14.».
//   3. `decidirRecomendacion` sin el `decisionVigente` (anota siempre)              → rojo «15.».
//   4. la lectura de WhatsApp con `.limit(MAX_MENSAJES)` de vuelta                   → rojo «11.».
