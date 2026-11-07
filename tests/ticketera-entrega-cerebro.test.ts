// =============================================================================
// La bandeja dice «Entregado al Cerebro» también de lo que espera a Martín (6/11/2026)
// =============================================================================
// El pendiente (docs/hallazgos-ticketera.md → «Lo que quedó sin hacer»): de la entrega de un ticket que espera la decisión de
// Martín quedaba SÓLO el renglón «llegó al Cerebro» del historial. La bandeja no decía si había salido.
//
// La causa era de DOS piezas, y arreglar una sola no se ve:
//   · `entregaAlCerebro` devolvía null con `despacho = null` (sólo miraba los bugs del triage, `aviso_*`);
//   · y aunque mirara, `COLS` (lib/tickets-db.ts) no pedía las columnas `cerebro_*` de la 0343, así que la fila llegaba sin
//     ellas y no habría nada que dibujar.
//
// La 0343 está en producción desde el 29/10, por eso pedirlas ya no tumba la bandeja (en una base vieja el select falla
// entero: ahí la columna no existe y Supabase devuelve error, no null — el arreglo es aplicar la 0343, no sacarlas).
//
// ⚠️ Probado ROMPIÉNDOLO, tres veces, sobre los 7 casos de acá (base 7/0; los 8 de
// tests/ticketera-movil-y-avisos.test.ts quedaron en verde en las tres):
//   (a) `entregaAlCerebro` con el `if (t.despacho !== 'runner') return null` de antes: **3 pases y 4 ROJOS** — los cuatro que
//       esperan algo de un ticket sin despacho. Los que siguen pasando son los tres que esperan null de todas formas.
//   (b) `COLS` sin las cuatro columnas `cerebro_*`: **6 pases y 1 ROJO** — «COLS pide las columnas de la 0343». Es el que
//       atrapa el arreglo a medias: la función ya decide bien y la fila llega sin los datos.
//   (c) el fallback `?? ESPERA_RUNNER` devuelto como `?? null` (lo que haría pensar «pendiente = nada que decir»):
//       **5 pases y 2 ROJOS** — «'pendiente' dice que espera a un Runner» y el de las dos marcas, que mira ese mismo texto.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENTREGA_MAX_INTENTOS, entregaAlCerebro } from '../lib/tickets-aviso';

const AHORA = Date.parse('2026-11-06T12:00:00.000Z');
const MIN = 60_000;
const hace = (ms: number) => new Date(AHORA - ms).toISOString();

/** Un ticket que espera la decisión de Martín: sin despacho y en un estado nuevo. */
const espera = {
  despacho: null, estado: 'esperando_decision',
  aviso_estado: null, aviso_intentos: 0, aviso_at: null, aviso_motivo: null,
  cerebro_estado: 'pendiente', cerebro_intentos: 0, cerebro_at: null, cerebro_motivo: null,
};

test('entregado: la bandeja lo dice de un ticket que espera a Martín, no sólo de un bug del triage', () => {
  const v = entregaAlCerebro({ ...espera, cerebro_estado: 'entregado', cerebro_at: hace(MIN) }, AHORA);
  assert.deepEqual([v?.tono, v?.texto], ['good', 'Entregado al Cerebro']);
  assert.equal(v?.desde, hace(MIN), 'la fecha sale de cerebro_at, no de aviso_at');
});

test('«pendiente» dice que espera a un Runner, no silencio', () => {
  // Es el estado del 99% del tiempo: si acá se devolviera null, el arreglo no se vería nunca en pantalla.
  const v = entregaAlCerebro(espera, AHORA);
  assert.deepEqual([v?.tono, v?.texto], ['warn', 'Espera a un Runner con el Cerebro abierto']);
  assert.equal(entregaAlCerebro({ ...espera, estado: 'nuevo' }, AHORA)?.tono, 'warn');
});

test('tomado, sin acuse y no llegó: los mismos textos que los del triage', () => {
  assert.equal(entregaAlCerebro({ ...espera, cerebro_estado: 'tomado', cerebro_intentos: 1, cerebro_at: hace(MIN) }, AHORA)?.tono, 'neutral');
  const falla = entregaAlCerebro({ ...espera, cerebro_estado: 'no_entregado', cerebro_intentos: 2, cerebro_motivo: 'el Cerebro no está abierto' }, AHORA);
  assert.deepEqual([falla?.tono, falla?.texto], ['warn', 'No llegó al Cerebro, se reintenta (2 de 5) — el Cerebro no está abierto']);
  const rendido = entregaAlCerebro({ ...espera, cerebro_estado: 'incierto', cerebro_intentos: ENTREGA_MAX_INTENTOS }, AHORA);
  assert.equal(rendido?.tono, 'bad');
  assert.match(rendido?.texto ?? '', /mándaselo a mano/);
});

test('la marca del triage y la de Martín no se cruzan', () => {
  // Un ticket que espera a Martín con `aviso_*` de otra cosa: lo que manda es `cerebro_*`.
  const v = entregaAlCerebro({ ...espera, aviso_estado: 'entregado', aviso_at: hace(99 * MIN) }, AHORA);
  assert.equal(v?.texto, 'Espera a un Runner con el Cerebro abierto', 'aviso_* no decide acá');
  // Y al revés: un bug del triage sigue leyendo `aviso_*` aunque cerebro_* diga otra cosa.
  const bug = entregaAlCerebro(
    { ...espera, despacho: 'runner', estado: 'en_curso', aviso_estado: 'entregado', aviso_at: hace(MIN), cerebro_estado: 'no_entregado', cerebro_intentos: 4 },
    AHORA,
  );
  assert.deepEqual([bug?.tono, bug?.texto], ['good', 'Entregado al Cerebro']);
});

test('lo que Martín ya firmó y lo ya cerrado no pasan por acá', () => {
  assert.equal(entregaAlCerebro({ ...espera, despacho: 'firmado' }, AHORA), null);
  assert.equal(entregaAlCerebro({ ...espera, estado: 'resuelto' }, AHORA), null);
  assert.equal(entregaAlCerebro({ ...espera, estado: 'en_curso' }, AHORA), null, 'en_curso sin despacho no es «espera a Martín»');
});

test('una base SIN la 0343 no inventa un estado', () => {
  // La fila llega sin las columnas: no se dibuja «espera a un Runner» de algo que no se sabe.
  const { cerebro_estado: _e, cerebro_intentos: _i, cerebro_at: _a, cerebro_motivo: _m, ...vieja } = espera;
  assert.equal(entregaAlCerebro(vieja, AHORA), null);
  assert.equal(entregaAlCerebro({ ...vieja, cerebro_estado: null }, AHORA), null);
});

test('COLS pide las columnas de la 0343', () => {
  // ⚠️ La otra mitad del arreglo: sin esto la función decide bien sobre una fila que llega sin los datos.
  const src = readFileSync(join(process.cwd(), 'lib/tickets-db.ts'), 'utf8');
  const cols = /^const COLS = '([^']+)';$/m.exec(src)?.[1] ?? '';
  const pedidas = cols.split(',').map((c) => c.trim());
  for (const c of ['cerebro_estado', 'cerebro_intentos', 'cerebro_motivo', 'cerebro_at']) {
    assert.ok(pedidas.includes(c), `COLS no pide ${c}: la bandeja no puede dibujar la entrega al Cerebro`);
  }
});
