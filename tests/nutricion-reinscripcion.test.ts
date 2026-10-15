// =============================================================================
// Reagenda (#789): cuándo una inscripción que ya terminó se vuelve a usar
// =============================================================================
// Decisión de Martín (06/10/2026): «b: también con reunión nueva». Un lead que vuelve a agendar
// recibe la post-agenda otra vez si la vez anterior no le llegó nada, Y TAMBIÉN si ya le llegó
// pero es una reunión NUEVA. La fila vieja no se re-inserta (unique (lead_id, secuencia_id)):
// se reusa con compare-and-set. Lo que estos tests fijan, por capa:
//
//   · la regla (`inscripcionReusable`), rama por rama;
//   · la identidad de «una reunión» (`diaDeReunion`: por día y en hora de México);
//   · el reuso (`reactivarInscripcion`): desliga lo viejo ANTES de reclamar, y reclama con
//     compare-and-set — incluido el choque con `uq_wa_borradores_toque` que señaló el refutador;
//   · qué le llegó (`marcasPorInscripcion`);
//   · el cableado en el motor y en el desenlace, sobre el fuente SIN comentarios y por bloque.
//
// Probado rompiéndolo (06/10/2026), con un arnés que restaura de memoria cada archivo:
//   · sin la regla 1 (`reunionNuevaMs == null`)                     → 1 fallo  (22 pasan)
//   · sin el corte de `ESTADOS_TERMINADOS`                           → 1 fallo  (22 pasan)
//   · sin comparar la reunión (`if (false)` en vez de `reunion_at`)  → 2 fallos (21 pasan)
//   · `diaDeReunion` en UTC (sin el offset de México)                → 3 fallos (20 pasan)
//   · la regla 5 sin `nadaLeLlego` / sin `seQuemo`                   → 1 fallo cada una
//   · `reactivarInscripcion` sin desligar los borradores             → 1 fallo  (22 pasan)
//   · sin descartar los pendientes / sin desligar los envíos         → 1 fallo cada una
//   · sin el `lte('created_at', ahora)` de los envíos                → 1 fallo  (22 pasan)
//   · reclamar ANTES de desligar                                     → 1 fallo  (22 pasan)
//   · el reclamo sin `.eq('estado', …)` / sin el desenlace           → 1 fallo cada una
//   · `marcasPorInscripcion` sin leer wa_borradores                  → 1 fallo  (22 pasan)
//   · los trece guards de cableado (dry-run, commit, reactivarReusables, aInscribir,
//     familia, evento, los dos cierres, el estado 'omitido', el paso que no re-anota la
//     reunión, la reunión metida en el avance, encadenar, el orden de la 0205), cada uno
//     roto por separado → 1 fallo cada uno (22 pasan)
// Como está: 23/23.
//
// Revisión adversarial (06/10/2026), cinco tests más, rotos con el mismo arnés:
//   · `reunionQuePreparaMs` devolviendo la más próxima (R1 o R2)     → 1 fallo  (27 pasan)
//   · `reusablesDe` decidiendo con `reunionFuturaMs`                   → 1 fallo  (27 pasan)
//   · el alta del cohorte / la del evento / encadenar / la re-anotación
//     anotando `reunionFuturaMs`                                       → 1 fallo cada una
//   · el commit o el evento reactivando con `ahoraISO()` del momento, o
//     `aInscribir` fechando la decisión DESPUÉS de leer las filas      → 1 fallo cada una
//   · `reactivarInscripcion` sin el corte al descartar los pendientes, o
//     sin el corte al desligar los borradores                          → 1 fallo cada una
// Como está: 28/28.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  inscripcionReusable, diaDeReunion, reunionFuturaMs, reunionQuePreparaMs, camposDeReactivacion, reactivarInscripcion,
  marcasPorInscripcion, SIN_MARCAS, type FilaPrevia,
} from '../lib/nutricion-reinscripcion';

const NUEVA = Date.parse('2026-10-10T16:00:00Z'); // sábado 10/10, 10:00 en México
const fila = (o: Partial<FilaPrevia> = {}): FilaPrevia => ({ estado: 'completada', desenlace: null, reunion_at: null, ...o });

// ── La reunión ───────────────────────────────────────────────────────────────

test('reunionFuturaMs: prefiere la hora exacta, una fecha sola es mediodía de México, y elige la más próxima', () => {
  const ahora = Date.parse('2026-10-10T15:00:00Z'); // 09:00 en México
  // Fecha sola de HOY: mediodía MX (18:00Z) todavía no pasó.
  assert.equal(reunionFuturaMs({ fecha_junta_1: '2026-10-10' }, ahora), Date.parse('2026-10-10T18:00:00Z'));
  // Con la hora exacta, gana la hora exacta (y acá ya pasó).
  assert.equal(reunionFuturaMs({ fecha_junta_1: '2026-10-10', junta_1_at: '2026-10-10T14:00:00Z' }, ahora), null);
  // La R1 pasó, la R2 no: cuenta la R2.
  assert.equal(reunionFuturaMs({ junta_1_at: '2026-10-09T18:00:00Z', junta_2_at: '2026-10-12T18:00:00Z' }, ahora), Date.parse('2026-10-12T18:00:00Z'));
  assert.equal(reunionFuturaMs(null, ahora), null);
});

test('reunionQuePreparaMs: la post-agenda prepara la R1; con la R1 pasada, la R2 NO es una reunión nueva', () => {
  const ahora = Date.parse('2026-10-08T17:00:00Z'); // 11:00 del 8/10 en México
  const r1Hoy = '2026-10-08T16:00:00Z';              // la R1 fue hoy a las 10:00
  const r2Jueves = '2026-10-15T16:00:00Z';           // y en la llamada se agendó la R2
  const lead = { fecha_junta_1: '2026-10-08', junta_1_at: r1Hoy, fecha_junta_2: '2026-10-15', junta_2_at: r2Jueves };
  assert.equal(reunionQuePreparaMs(lead, ahora), null, 'con la R1 pasada no hay reunión que preparar, aunque haya R2');
  // La trampa, tal cual: la otra función se queda con la R2, que es otro día que la R1.
  assert.equal(reunionFuturaMs(lead, ahora), Date.parse(r2Jueves));
  const fila = { estado: 'completada', desenlace: 'logrado', reunion_at: r1Hoy };
  assert.deepEqual(inscripcionReusable({ fila, marcas: { enviados: 2, borradores: 0 }, reunionNuevaMs: reunionFuturaMs(lead, ahora) }), { reusable: true, porque: 'reunion_nueva' });
  assert.deepEqual(inscripcionReusable({ fila, marcas: { enviados: 2, borradores: 0 }, reunionNuevaMs: reunionQuePreparaMs(lead, ahora) }), { reusable: false, porque: 'sin_reunion_futura' });
  // La R1 por delante es la que cuenta, haya o no R2; una fecha sola es mediodía de México.
  assert.equal(reunionQuePreparaMs({ junta_1_at: '2026-10-10T16:00:00Z', junta_2_at: '2026-10-09T16:00:00Z' }, ahora), Date.parse('2026-10-10T16:00:00Z'));
  assert.equal(reunionQuePreparaMs({ fecha_junta_1: '2026-10-08' }, ahora), Date.parse('2026-10-08T18:00:00Z'));
  // Sólo R2: nada que preparar.
  assert.equal(reunionQuePreparaMs({ fecha_junta_2: '2026-10-15', junta_2_at: r2Jueves }, ahora), null);
  assert.equal(reunionQuePreparaMs(null, ahora), null);
});

test('diaDeReunion: el día es el de México, no el de UTC', () => {
  // 19:00 del 10/10 en México es el 11/10 en UTC: sigue siendo el 10/10.
  assert.equal(diaDeReunion(Date.parse('2026-10-11T01:00:00Z')), '2026-10-10');
  // 23:30 del 9/10 en México es el 10/10 en UTC: sigue siendo el 9/10.
  assert.equal(diaDeReunion(Date.parse('2026-10-10T05:30:00Z')), '2026-10-09');
});

// ── La regla, rama por rama ──────────────────────────────────────────────────

test('regla 1: sin reunión futura no se reusa NUNCA, aunque no le haya llegado nada', () => {
  // El cohorte mira `fecha_junta_1 >= hoy` (DATE): el día de una reunión ya pasada el lead sigue
  // adentro, y reusarlo lo haría entrar y salir por «la reunión ya pasó» en cada corrida.
  const v = inscripcionReusable({ fila: fila(), marcas: SIN_MARCAS, reunionNuevaMs: null });
  assert.deepEqual(v, { reusable: false, porque: 'sin_reunion_futura' });
});

test('regla 2: una corrida que no terminó no se reinicia, y una cancelada no se toca', () => {
  for (const estado of ['activa', 'pausada', 'handoff', 'respondio']) {
    assert.deepEqual(inscripcionReusable({ fila: fila({ estado }), marcas: SIN_MARCAS, reunionNuevaMs: NUEVA }), { reusable: false, porque: 'no_termino' }, estado);
  }
  // 'cancelada' es también la baja del email y el «sin email»: reusarla es escribirle a quien dijo que no.
  assert.deepEqual(inscripcionReusable({ fila: fila({ estado: 'cancelada', desenlace: 'cancelado' }), marcas: SIN_MARCAS, reunionNuevaMs: NUEVA }), { reusable: false, porque: 'cancelada' });
  assert.deepEqual(inscripcionReusable({ fila: fila({ desenlace: 'cancelado' }), marcas: SIN_MARCAS, reunionNuevaMs: NUEVA }), { reusable: false, porque: 'cancelada' });
});

test('regla 5 (a): sin saber qué reunión preparaba, se rescata sólo si no le llegó NADA y la corrida se quemó', () => {
  // Las 181-187 del ws1: no_responde/fallo y completada/null, sin un envío ni un borrador.
  assert.deepEqual(inscripcionReusable({ fila: fila({ estado: 'no_responde', desenlace: 'fallo' }), marcas: SIN_MARCAS, reunionNuevaMs: NUEVA }), { reusable: true, porque: 'nada_le_llego' });
  assert.deepEqual(inscripcionReusable({ fila: fila(), marcas: SIN_MARCAS, reunionNuevaMs: NUEVA }), { reusable: true, porque: 'nada_le_llego' });
});

test('regla 5: «no sé qué reunión era» no autoriza a repetirle nada a quien ya recibió algo', () => {
  const noSe = { reusable: false, porque: 'no_se_que_reunion_preparaba' };
  assert.deepEqual(inscripcionReusable({ fila: fila(), marcas: { enviados: 1, borradores: 0 }, reunionNuevaMs: NUEVA }), noSe);
  // Un borrador DESCARTADO también cuenta: una persona decidió no mandarlo.
  assert.deepEqual(inscripcionReusable({ fila: fila(), marcas: { enviados: 0, borradores: 1 }, reunionNuevaMs: NUEVA }), noSe);
  // Un 'logrado' no se quemó: el lead contestó.
  assert.deepEqual(inscripcionReusable({ fila: fila({ desenlace: 'logrado' }), marcas: SIN_MARCAS, reunionNuevaMs: NUEVA }), noSe);
});

test('regla 3: la MISMA reunión no se reusa, ni con otra hora del mismo día ni para «rescatarla»', () => {
  // La hora se refina sola (setIfEmpty('junta_1_at') en lib/leads.ts): la fecha llegó primero
  // como mediodía MX y la hora exacta después. Es la misma reunión: no se le repite el audio.
  const mediodia = new Date(Date.parse('2026-10-10T18:00:00Z')).toISOString();
  assert.deepEqual(inscripcionReusable({ fila: fila({ reunion_at: mediodia }), marcas: { enviados: 2, borradores: 0 }, reunionNuevaMs: NUEVA }), { reusable: false, porque: 'misma_reunion' });
  // Quemada para ESTA reunión (un contacto bloqueado termina con pasos 'omitido'): rescatarla
  // sería un bucle de corridas que vuelven a quemarse.
  assert.deepEqual(inscripcionReusable({ fila: fila({ reunion_at: mediodia }), marcas: SIN_MARCAS, reunionNuevaMs: NUEVA }), { reusable: false, porque: 'misma_reunion' });
  // Mismo día en México aunque en UTC sean dos días distintos.
  assert.deepEqual(inscripcionReusable({ fila: fila({ reunion_at: '2026-10-11T01:00:00Z' }), marcas: SIN_MARCAS, reunionNuevaMs: NUEVA }), { reusable: false, porque: 'misma_reunion' });
});

test('regla 4 (b): otra reunión SÍ, haya recibido lo que haya recibido y haya terminado como haya terminado', () => {
  const ayer = '2026-10-09T18:00:00Z';
  assert.deepEqual(inscripcionReusable({ fila: fila({ reunion_at: ayer, desenlace: 'logrado' }), marcas: { enviados: 2, borradores: 1 }, reunionNuevaMs: NUEVA }), { reusable: true, porque: 'reunion_nueva' });
  assert.deepEqual(inscripcionReusable({ fila: fila({ reunion_at: ayer, estado: 'no_responde', desenlace: 'fallo' }), marcas: { enviados: 1, borradores: 0 }, reunionNuevaMs: NUEVA }), { reusable: true, porque: 'reunion_nueva' });
  // Otro día en México aunque en UTC sea el mismo: 23:30 del 9/10.
  assert.deepEqual(inscripcionReusable({ fila: fila({ reunion_at: '2026-10-10T05:30:00Z' }), marcas: { enviados: 1, borradores: 0 }, reunionNuevaMs: NUEVA }), { reusable: true, porque: 'reunion_nueva' });
});

test('la fila reusada es una inscripción NUEVA con el id viejo: todo lo de la corrida vuelve a cero', () => {
  const c = camposDeReactivacion({ proximoEnvioAt: '2026-10-08T10:00:00Z', reunionAt: '2026-10-10T16:00:00.000Z', ahora: '2026-10-08T09:00:00Z' });
  assert.equal(c.estado, 'activa');
  assert.equal(c.paso_actual, 0);
  assert.equal(c.reunion_at, '2026-10-10T16:00:00.000Z');
  assert.equal(c.inscripto_at, '2026-10-08T09:00:00Z');
  for (const k of ['desenlace', 'desenlace_at', 'ultimo_paso_at', 'conversacion_ultima_at', 'conversacion_cierre', 'conversacion_cerrada_at'] as const) {
    assert.equal(c[k], null, k);
  }
});

// ── El reuso, contra una base en memoria ─────────────────────────────────────

type Fila = Record<string, unknown>;

/** Un cliente falso que sólo sabe hacer `update` con eq/is/lte, y anota el orden de las tablas. */
function fakeDb(tablas: Record<string, Fila[]>, fallar?: string) {
  const orden: string[] = [];
  const db = {
    from(t: string) {
      return {
        update(patch: Fila) {
          const preds: Array<(f: Fila) => boolean> = [];
          const aplicar = () => {
            orden.push(t);
            if (fallar === t) return { data: null, error: { message: 'se cayó la red' } };
            const tocadas = (tablas[t] ?? []).filter((f) => preds.every((p) => p(f)));
            for (const f of tocadas) Object.assign(f, patch);
            return { data: tocadas.map((f) => ({ id: f.id })), error: null };
          };
          const b = {
            eq(c: string, v: unknown) { preds.push((f) => f[c] === v); return b; },
            is(c: string, v: unknown) { preds.push((f) => (f[c] ?? null) === v); return b; },
            lte(c: string, v: string) { preds.push((f) => String(f[c]) <= v); return b; },
            select() { return Promise.resolve(aplicar()); },
            then(ok: (x: unknown) => unknown, mal: (e: unknown) => unknown) { return Promise.resolve(aplicar()).then(ok, mal); },
          };
          return b;
        },
      };
    },
  };
  return { db: db as unknown as SupabaseClient, orden };
}

/**
 * `crearBorrador` del motor contra `uq_wa_borradores_toque`: (workspace, inscripcion, paso), NO
 * parcial (mig 0074), con upsert `ignoreDuplicates`. Un NULL no choca con nada, como en Postgres.
 * Devuelve si quedó escrito.
 */
function toque(borradores: Fila[], b: Fila): boolean {
  const choca = borradores.some((f) => f.inscripcion_id != null && f.inscripcion_id === b.inscripcion_id && f.paso === b.paso);
  if (choca) return false;
  borradores.push(b);
  return true;
}

const AHORA = '2026-10-08T09:00:00.000Z';
const reactivacion = { id: 7, leido: { estado: 'completada', desenlace: null }, proximoEnvioAt: '2026-10-08T10:00:00.000Z', reunionAt: '2026-10-10T16:00:00.000Z', ahora: AHORA };

function base() {
  return {
    nutricion_inscripciones: [
      { id: 7, lead_id: 2400, estado: 'completada', desenlace: null, paso_actual: 2, conversacion_cerrada_at: '2026-10-01T00:00:00Z' },
      { id: 8, lead_id: 2400, estado: 'completada', desenlace: null, paso_actual: 2 },
    ] as Fila[],
    wa_borradores: [
      { id: 1, inscripcion_id: 7, paso: 1, estado: 'descartado', created_at: '2026-10-01T10:00:00Z' },
      { id: 2, inscripcion_id: 7, paso: 2, estado: 'pendiente', created_at: '2026-10-02T10:00:00Z' },
      { id: 3, inscripcion_id: 8, paso: 1, estado: 'pendiente', created_at: '2026-10-02T10:00:00Z' },
    ] as Fila[],
    nutricion_envios: [
      { id: 10, inscripcion_id: 7, lead_id: 2400, secuencia_id: 213, paso: 1, estado: 'enviado', created_at: '2026-10-01T10:00:00Z' },
      { id: 11, inscripcion_id: 7, lead_id: 2400, secuencia_id: 213, paso: 2, estado: 'borrador', created_at: '2026-10-02T10:00:00Z' },
      // De la corrida que ganó el reclamo, escrita DESPUÉS de la decisión: no se toca.
      { id: 12, inscripcion_id: 7, lead_id: 2400, secuencia_id: 213, paso: 1, estado: 'enviado', created_at: '2026-10-08T09:00:05.000Z' },
    ] as Fila[],
  };
}

test('el refutador (4): sin desligar, el borrador de la corrida nueva se descarta en silencio; con el reuso, sale', async () => {
  // La trampa, tal cual: la fila vieja del paso 1 está DESCARTADA y aun así gana el índice.
  const sinReuso = base();
  assert.equal(toque(sinReuso.wa_borradores, { inscripcion_id: 7, paso: 1, estado: 'pendiente' }), false);

  const t = base();
  const { db } = fakeDb(t);
  assert.equal(await reactivarInscripcion(db, reactivacion), true);
  assert.equal(toque(t.wa_borradores, { inscripcion_id: 7, paso: 1, estado: 'pendiente' }), true, 'el borrador nuevo del paso 1 tiene que quedar escrito');
  // Las filas viejas siguen ahí, desligadas: la historia no se borra.
  assert.equal(t.wa_borradores.filter((f) => f.id === 1 || f.id === 2).every((f) => f.inscripcion_id === null), true);
  // Y la de OTRA inscripción no se toca.
  assert.deepEqual(t.wa_borradores.find((f) => f.id === 3), { id: 3, inscripcion_id: 8, paso: 1, estado: 'pendiente', created_at: '2026-10-02T10:00:00Z' });
});

test('el borrador PENDIENTE de la corrida vieja se descarta: con uno pendiente el motor no deja otro', async () => {
  const t = base();
  await reactivarInscripcion(fakeDb(t).db, reactivacion);
  assert.equal(t.wa_borradores.find((f) => f.id === 2)?.estado, 'descartado');
  assert.equal(t.wa_borradores.find((f) => f.id === 1)?.estado, 'descartado');
});

test('los envíos viejos se desligan (con su lead y su secuencia), y lo escrito después de la decisión no', async () => {
  const t = base();
  await reactivarInscripcion(fakeDb(t).db, reactivacion);
  const e = (id: number) => t.nutricion_envios.find((f) => f.id === id)!;
  assert.equal(e(10).inscripcion_id, null);
  assert.equal(e(11).inscripcion_id, null);
  assert.equal(e(10).lead_id, 2400);
  assert.equal(e(10).secuencia_id, 213);
  assert.equal(e(12).inscripcion_id, 7, 'un envío posterior a la decisión es de la corrida que ganó');
  // Y la fila queda como un insert nuevo: activa, paso 0, sin la charla vieja.
  const i = t.nutricion_inscripciones.find((f) => f.id === 7)!;
  assert.equal(i.estado, 'activa');
  assert.equal(i.paso_actual, 0);
  assert.equal(i.conversacion_cerrada_at, null);
});

test('el que PIERDE el reclamo no le toca nada a la corrida que ganó: ni su borrador pendiente ni su envío', async () => {
  // Dos corridas leen la fila terminada a las 09:00:00. La ganadora la reclama y su primer paso
  // sale a las 09:00:05 como borrador. La perdedora llega después: con el corte en el instante
  // de la DECISIÓN (antes de leer), lo de la ganadora queda intacto y recién ahí pierde el CAS.
  const t = base();
  t.nutricion_inscripciones[0].estado = 'activa';
  t.wa_borradores.push({ id: 4, inscripcion_id: 7, paso: 1, estado: 'pendiente', created_at: '2026-10-08T09:00:05.000Z' });
  assert.equal(await reactivarInscripcion(fakeDb(t).db, reactivacion), false);
  assert.deepEqual(t.wa_borradores.find((f) => f.id === 4), { id: 4, inscripcion_id: 7, paso: 1, estado: 'pendiente', created_at: '2026-10-08T09:00:05.000Z' });
  assert.equal(t.nutricion_envios.find((f) => f.id === 12)?.inscripcion_id, 7);
});

test('compare-and-set: si otra corrida movió la fila entre medio, no se reclama ni se pisa', async () => {
  const t = base();
  t.nutricion_inscripciones[0].estado = 'activa'; // otra invocación del mismo tick ya la reclamó
  assert.equal(await reactivarInscripcion(fakeDb(t).db, reactivacion), false);
  assert.equal(t.nutricion_inscripciones[0].paso_actual, 2);

  const t2 = base();
  t2.nutricion_inscripciones[0].desenlace = 'logrado'; // el desenlace la cerró entre medio
  assert.equal(await reactivarInscripcion(fakeDb(t2).db, reactivacion), false);
  assert.equal(t2.nutricion_inscripciones[0].estado, 'completada');
});

test('si desligar falla, TIRA y la inscripción no se reactiva: lo viejo colgado es justo el bug', async () => {
  const t = base();
  const { db, orden } = fakeDb(t, 'wa_borradores');
  await assert.rejects(reactivarInscripcion(db, reactivacion), /borradores/);
  assert.equal(t.nutricion_inscripciones[0].estado, 'completada');
  assert.equal(orden.includes('nutricion_inscripciones'), false, 'no se llegó a reclamar');
});

// ── Qué le llegó ─────────────────────────────────────────────────────────────

function fakeSelect(tablas: Record<string, Fila[]>) {
  return {
    from(t: string) {
      return {
        select() {
          const preds: Array<(f: Fila) => boolean> = [];
          const q = {
            in(c: string, vs: readonly unknown[]) { const s = new Set(vs); preds.push((f) => s.has(f[c])); return q; },
            eq(c: string, v: unknown) { preds.push((f) => f[c] === v); return q; },
            order() { return q; },
            range(desde: number, hasta: number) {
              const out = (tablas[t] ?? []).filter((f) => preds.every((p) => p(f))).sort((a, b) => Number(a.id) - Number(b.id));
              return Promise.resolve({ data: out.slice(desde, hasta + 1), error: null });
            },
          };
          return q;
        },
      };
    },
  } as unknown as SupabaseClient;
}

test('marcasPorInscripcion: envíos enviados, envíos en borrador y borradores de cualquier estado; un fallo no es «le llegó»', async () => {
  const db = fakeSelect({
    nutricion_envios: [
      { id: 1, inscripcion_id: 1, estado: 'enviado' },
      { id: 2, inscripcion_id: 1, estado: 'fallo' },
      { id: 3, inscripcion_id: 2, estado: 'omitido' },
      { id: 4, inscripcion_id: 2, estado: 'simulado' },
      { id: 5, inscripcion_id: 3, estado: 'borrador' },
    ],
    wa_borradores: [
      { id: 1, inscripcion_id: 4, estado: 'descartado' },
    ],
  });
  const m = await marcasPorInscripcion(db, [1, 2, 3, 4, 5]);
  assert.deepEqual(m.get(1), { enviados: 1, borradores: 0 });
  assert.equal(m.has(2), false, 'fallo / omitido / simulado: no le llegó nada');
  assert.deepEqual(m.get(3), { enviados: 0, borradores: 1 });
  assert.deepEqual(m.get(4), { enviados: 0, borradores: 1 }, 'un borrador descartado también cuenta');
  assert.equal(m.has(5), false);
});

// ── El cableado ──────────────────────────────────────────────────────────────

/** Sin comentarios: las líneas PRIMERO, los bloques después (AGENTS.md). Y sin `\r`. */
const sinComentarios = (src: string) => src
  .replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const MOTOR = sinComentarios(readFileSync(new URL('../lib/nutricion.ts', import.meta.url), 'utf8'));
const DESENLACE = sinComentarios(readFileSync(new URL('../lib/nutricion-desenlace.ts', import.meta.url), 'utf8'));

/** El cuerpo de una función: desde su firma hasta la firma de la siguiente de nivel superior. */
function cuerpo(src: string, firma: string): string {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, `no encontré «${firma}»`);
  const sig = src.slice(ini + firma.length).search(/\n(export )?(async )?function |\nconst [a-zA-Z]+ = |\ntype |\nexport type /);
  return src.slice(ini, sig < 0 ? undefined : ini + firma.length + sig);
}

test('el dry-run y el commit deciden con la MISMA función, o el preview miente sobre a quién reusa', () => {
  assert.match(cuerpo(MOTOR, 'export async function planificarInscripciones('), /await aInscribir\(supabase, sec, candidatos\)/);
  const commit = cuerpo(MOTOR, 'export async function comprometerInscripciones(');
  assert.match(commit, /await aInscribir\(supabase, sec, candidatos\)/);
  // Lo reusable se REACTIVA; nunca entra al insert (el unique lo rechazaría y cortaría la corrida).
  assert.match(commit, /creadas \+= await reactivarReusables\(supabase, sec, reusar\);/);
  assert.match(commit, /\.insert\(nuevas\.map\(/);
  assert.match(cuerpo(MOTOR, 'async function reactivarReusables('), /for \(const r of reusar\) \{\s*const reclamada = await reactivarInscripcion\(db, /);
});

test('aInscribir: sólo se reusa en la familia que prepara una reunión, y la fila con fila no se inserta', () => {
  const c = cuerpo(MOTOR, 'async function aInscribir(');
  assert.match(c, /const reusables = reusaInscripciones\(sec\) \?/);
  assert.match(c, /const pendientes = candidatos\.filter\(\(id\) => !conFila\.has\(id\)\)/);
  // (Undécima tanda, M2: «prepara una reunión» por la FORMA del flujo, `preparaReunion` — tests/motor-entrada-etapa.test.ts.)
  const NUTRI_REENTRADA = MOTOR;
  // La «Reentrada» del CRON (14/10/2026): sin guardar, la regla de antes (tests/reentrada.test.ts).
  assert.match(MOTOR, /const reusaInscripciones = \(s: Pick<Secuencia, 'trigger_tipo' \| 'pasos' \| 'etapa' \| 'etapas' \| 'disparadores' \| 'reentrada'>\): boolean =>\s*reentradaDeSecuencia\(s\) !== 'una_vez' && s\.pasos\.length > 0;/);
  assert.match(NUTRI_REENTRADA, /reentradaDe\(s\.reentrada, preparaReunion\(s\)\)/);
});

test('la familia: una fila reusable no bloquea; cualquier otra sí', () => {
  const c = cuerpo(MOTOR, 'async function leadsEnFamiliaPostAgenda(');
  assert.match(c, /for \(const f of filas\) if \(!reusables\.has\(f\.id\)\) set\.add\(f\.lead_id\);/);
});

test('enrolarPorEvento: la exclusión de familia, el reuso con compare-and-set y ningún insert por lote', () => {
  const c = cuerpo(MOTOR, 'export async function enrolarPorEvento(');
  assert.match(c, /\(await leadsEnFamiliaPostAgenda\(\[leadId\]\)\)\.has\(leadId\)/);
  assert.match(c, /if \(previa\) \{\s*const r = reusables\.get\(previa\.id\);\s*if \(!r\) continue;\s*const reclamada = await reactivarInscripcion\(/);
  assert.doesNotMatch(c, /\.insert\(nuevas\)/, 'el insert por lote dejaba al lead sin NINGUNA secuencia apenas una fila existía');
});

test('los cierres SIN envío dejan su fila: «la reunión ya pasó» y el tope de antigüedad', () => {
  const proc = cuerpo(MOTOR, 'export async function procesarEnvios(');
  // Hasta la PRÓXIMA declaración del motor (08/10/2026: detrás vienen `moverConCas` y
  // `avanceDesde`, que no tienen nada que ver con esto y lo inflaban a 2.108).
  const iniAnotar = proc.indexOf('const anotarCierreSinEnvio');
  const anotar = proc.slice(iniAnotar, proc.indexOf('\n  const ', iniAnotar + 10));
  assert.ok(anotar.length > 100 && anotar.length < 1500, `anotarCierreSinEnvio mide ${anotar.length}`);
  assert.match(anotar, /from\('nutricion_envios'\)\.insert\(\{[\s\S]*estado: 'omitido',[\s\S]*error: motivo,/);
  // (08/10/2026: «anclada» = el `ancla` de siempre O la espera «antes de la reunión» del flujo;
  // y «el primero» es `esPrimerPaso`, con el tope de la secuencia o el de su condición de entrada.)
  // (Undécima tanda: `preparaReunion(sec)` por la forma del flujo; el re-anclado de abajo es sólo del `ancla` de siempre.)
  // (14/10/2026: SÓLO el paso anclado, `if (anclada) {`: el resto lo dice la condición visible «Su reunión sigue en pie».)
  const reunion = proc.slice(proc.indexOf('if (anclada) {'), proc.indexOf('if (anclada && minAntes == null) {'));
  assert.match(reunion, /await anotarCierreSinEnvio\(insc, paso, lead, 'la reunión ya pasó'\);\s*continue;/);
  const antig = proc.slice(proc.indexOf('if (esPrimerPaso(sec.pasos, insc.paso_actual) && topeAntig != null'), proc.indexOf("if (paso.requiere === 'ya_contactado'"));
  assert.match(antig, /await anotarCierreSinEnvio\(insc, paso, lead, `llegó hace más de \$\{topeAntig\} h`\);\s*continue;/);
});

test('cada paso que sale re-anota la reunión, en un update APARTE del avance', () => {
  // Si el lead reprograma a mitad de la corrida, la fila tiene que terminar diciendo la reunión
  // NUEVA: con la vieja, el cron siguiente leía «otra reunión» y mandaba la post-agenda de nuevo.
  //
  // Desde el 08/10/2026 el update vive en `anotarReunionDelPaso`, porque son DOS los avances que
  // lo necesitan: el de un mensaje y el de un paso «⚡ Acción», que también hace avanzar la misma
  // corrida de la post-agenda. Probado rompiéndolo (08/10/2026, archivo en 28/0): sacando la
  // llamada del avance del mensaje → 27/1 (éste); sacándola del de la acción → 27/1 (éste).
  const proc = cuerpo(MOTOR, 'export async function procesarEnvios(');
  const iniHelper = proc.indexOf('const anotarReunionDelPaso = async');
  assert.ok(iniHelper > 0, 'no encontré la re-anotación de la reunión');
  const helper = proc.slice(iniHelper, proc.indexOf('\n  };', iniHelper));
  assert.ok(helper.length > 0 && helper.length < 900, `la re-anotación mide ${helper.length}: está mirando otra cosa`);
  assert.match(helper, /const reunionDelPaso = preparaReunion\(sec\) \? reunionQuePreparaMs\(lead\) : null;\s*if \(reunionDelPaso != null\) \{\s*const \{ error: eReunion \} = await supabase\.from\('nutricion_inscripciones'\)\s*\.update\(\{ reunion_at: /);
  // (08/10/2026: lo que sigue sale del GRAFO, `avanceDesde`, no del índice + 1.)
  // (Segunda tanda, 08/10/2026: el avance trae también los hilos que arrancan, `nuevos`.)
  const ini = proc.indexOf('const { campos: avance, yaToca, nuevos: nuevosAlSalir } = avanceDesde(sec, insc.paso_actual, lead);');
  const fin = proc.indexOf("if (estado === 'enviado') res.enviados += 1;", ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré el avance del paso');
  const trozo = proc.slice(ini, fin);
  assert.ok(trozo.length < 1500, `el avance mide ${trozo.length}: está mirando otra cosa`);
  // (08/10/2026, segunda tanda: el avance es la puerta `escribir`; el corte es la re-anotación.)
  const avance = trozo.slice(0, trozo.indexOf('await anotarReunionDelPaso('));
  assert.match(avance, /await escribir\(insc, \{/, 'el avance de un paso que salió no pasa por la puerta de la posición');
  assert.doesNotMatch(avance, /reunion_at/, 'el avance de un paso que ya salió no puede depender de la columna nueva');
  assert.match(trozo.slice(avance.length), /await anotarReunionDelPaso\(insc\.id, sec, lead\);/, 'el mensaje que salió no re-anota la reunión');
  // Y el paso de acción, después del reclamo (si no corrió, no hay nada que anotar).
  const iniAccion = proc.indexOf('if (esPasoAccion(paso)) {');
  const accion = proc.slice(iniAccion, proc.indexOf('pasoConRelleno(paso)', iniAccion));
  // 3.600 desde el 08/10/2026 (medía 3.041): el reclamo compara también `nodo_actual` y el avance
  // sale del grafo. Sigue siendo la rama de la acción: la siguiente rama del motor mide el doble.
  assert.ok(iniAccion > 0 && accion.length > 0 && accion.length < 3600, `la rama de la acción mide ${accion.length}`);
  assert.match(accion, /if \(r\.estado !== 'saltado'\) await anotarReunionDelPaso\(insc\.id, sec, lead\);/, 'la acción avanzó la post-agenda sin re-anotar la reunión');
});

test('la reunión NUEVA del reuso es la R1 (`reunionQuePreparaMs`), nunca «la más próxima»', () => {
  // Con `reunionFuturaMs`, la R2 agendada en la misma llamada de la R1 se leía como «otra
  // reunión» y el cron de la hora siguiente le volvía a mandar la post-agenda.
  const c = cuerpo(MOTOR, 'async function reusablesDe(');
  assert.match(c, /const reunionMs = reunionQuePreparaMs\(juntas\.get\(fila\.lead_id\)\);/);
  assert.doesNotMatch(c, /reunionFuturaMs/);
});

test('lo que se anota en `reunion_at` al inscribir también es la R1: el cohorte, el evento y encadenar', () => {
  assert.match(cuerpo(MOTOR, 'async function aInscribir('), /nuevas: pendientes\.map\(\(id\) => alta\(id, reunionQuePreparaMs\(juntas\.get\(id\)\)\)\),/, 'el alta del cohorte');
  assert.match(cuerpo(MOTOR, 'export async function enrolarPorEvento('), /const reunion = anotaReunion\(s\) \? reunionQuePreparaMs\(juntas\) : null;/, 'el alta por evento');
  assert.match(DESENLACE, /const prepara = preparaReunion\(\{ \.\.\.sig, pasos \}\);\s*const reunion = prepara \? reunionQuePreparaMs\(lead as JuntasLead\) : null;/, 'encadenar');
});

test('el corte de lo que el reuso desliga es el instante de ANTES de leer la fila, no el de la llamada', () => {
  // Con el de la llamada, la corrida que perdía el reclamo le descartaba a la que ganó el
  // borrador que acababa de dejar (ver `Reactivacion.ahora`).
  const ai = cuerpo(MOTOR, 'async function aInscribir(');
  const decA = ai.indexOf('const decididoAt = ahoraISO();');
  assert.ok(decA >= 0 && decA < ai.indexOf('await inscripcionesDe('), 'aInscribir: la decisión se fecha ANTES de leer las filas');
  assert.match(ai, /porque: r\.porque, decididoAt \}/);
  assert.match(cuerpo(MOTOR, 'async function reactivarReusables('), /ahora: r\.decididoAt,/, 'el commit reactiva con la hora de la decisión');
  const ev = cuerpo(MOTOR, 'export async function enrolarPorEvento(');
  const decE = ev.indexOf('const decididoAt = ahoraISO();');
  assert.ok(decE >= 0 && decE < ev.indexOf('const previas = await inscripcionesDe('), 'el evento: la decisión se fecha ANTES de leer las filas');
  // Con «Cada vez que vuelve a entrar» puede no haber reunión (la Reentrada del CRON, 14/10/2026).
  assert.match(ev, /reunionAt: r\.reunionMs == null \? null : new Date\(r\.reunionMs\)\.toISOString\(\), ahora: decididoAt,/);
  // La tercera, desde el 08/10/2026: la inscripción a mano reinicia una que terminó con el
  // MISMO reuso (inscribirEnSecuencia), y también fecha la decisión antes de leer la fila.
  // Probado rompiéndolo: reiniciando con `ahoraISO()`, o fechando DESPUÉS de leer la fila,
  // 1 falla / 27 pasan cada una (28/28 como está).
  const man = cuerpo(MOTOR, 'export async function inscribirEnSecuencia(');
  const decM = man.indexOf('const decididoAt = ahoraISO();');
  assert.ok(decM >= 0 && decM < man.indexOf('await inscripcionesDe('), 'la inscripción a mano: la decisión se fecha ANTES de leer la fila');
  assert.match(man, /proximoEnvioAt: proximo, reunionAt, ahora: decididoAt,/);
  // Y ninguna llamada al reuso toma la hora del momento.
  const llamadas = MOTOR.split('await reactivarInscripcion(').slice(1).map((s) => s.slice(0, s.indexOf('});')));
  assert.equal(llamadas.length, 3, `esperaba tres llamadas al reuso (cron, evento y a mano), hay ${llamadas.length}`);
  for (const l of llamadas) assert.doesNotMatch(l, /ahoraISO\(\)/);
});

test('encadenar NO reusa (lo escrito en su comentario) y sí escribe la reunión que prepara', () => {
  assert.doesNotMatch(DESENLACE, /reactivarInscripcion/);
  assert.match(DESENLACE, /if \(ya\) return 'ya-estuvo-en-la-siguiente';/);
  assert.match(DESENLACE, /\.\.\.\(prepara \? \{ reunion_at:/);
});

test('la 0205 agrega la columna y dice su orden de despliegue', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0205_reagenda.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const sinComentariosSql = sql.replace(/--.*$/gm, '');
  assert.match(sinComentariosSql, /alter table nutricion_inscripciones\s+add column if not exists reunion_at timestamptz;/);
  assert.match(sql, /ORDEN DE DESPLIEGUE: ANTES del deploy/);
  // Sin backfill: un update desde la agenda de hoy le pondría a cada fila la reunión NUEVA.
  assert.doesNotMatch(sinComentariosSql, /\bupdate\b/i);
});
