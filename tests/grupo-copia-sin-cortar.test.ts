// =============================================================================
// La copia al hilo de la app que pasa el tope no queda suelta (13/11/2026)
// =============================================================================
// Con los grupos de WhatsApp en pausa (el número de MaKo baneado otra vez), el hilo de la app es por donde llega cada aviso, y su push sale de la
// copia (`avisarMiembros`). `copiarAlGrupo` hace esperar a quien manda como mucho `TOPE_DE_LA_COPIA_MS` y la copia sigue sola; pero en Vercel una
// promesa que nadie espera se congela cuando el cron o el webhook contestan: ese aviso no quedaba en el hilo ni sonaba, y no había error.
// Registrada en `after`, la función vive hasta que la copia termina, con su propio tope: una base colgada no la retiene hasta el corte de Vercel
// (y en tests/grupos-ops-avisos.test.ts, la escena de la base colgada se quedaba esperando para siempre).
//
// Probado ROMPIÉNDOLO (13/11/2026): sin el `after`, con el `after` DESPUÉS de la carrera y con el `after` sin su tope, el test da rojo; restaurado, verde.
//
// Correr: node --import tsx --test tests/grupo-copia-sin-cortar.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, '..', 'lib', 'grupo-app.ts'), 'utf8').replace(/\r\n/g, '\n');
const inicio = SRC.indexOf('export async function copiarAlGrupo(');
const COPIA = SRC.slice(inicio, SRC.indexOf('\n}\n', inicio));
const REGISTRO = 'after(() => conTope(trabajo, TOPE_DE_LA_COPIA_DESPUES_MS))';

test('la copia se registra en `after` para que la función no se congele con ella a medias', () => {
  assert.ok(inicio > 0, 'no encontré copiarAlGrupo');
  assert.ok(COPIA.includes(`try { ${REGISTRO}; } catch`), 'falta el registro en `after`, con su tope y dentro de un try');
});

test('se registra ANTES de la carrera con el tope: después, quien manda ya pudo haber seguido', () => {
  const registro = COPIA.indexOf(REGISTRO);
  const carrera = COPIA.indexOf('Promise.race([trabajo, tope])');
  assert.ok(registro > 0 && carrera > 0, 'falta el registro o la carrera');
  assert.ok(registro < carrera, 'el `after` va antes del `Promise.race`');
});

test('los dos topes: quien manda espera 3 s, y la función viva después, 10 s como mucho', () => {
  assert.match(SRC, /export const TOPE_DE_LA_COPIA_MS = 3000;/);
  assert.match(COPIA, /setTimeout\(\(\) => r\(null\), TOPE_DE_LA_COPIA_MS\)/);
  assert.match(SRC, /export const TOPE_DE_LA_COPIA_DESPUES_MS = 10_000;/);
  // El reloj del tope de después no retiene el proceso, y se limpia.
  const conTope = SRC.slice(SRC.indexOf('function conTope<T>('), SRC.indexOf('\n}\n', SRC.indexOf('function conTope<T>(')));
  assert.match(conTope, /unref/);
  assert.match(conTope, /clearTimeout/);
});
