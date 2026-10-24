// =============================================================================
// «Contestó» MIENTRAS LE SALE EL MENSAJE, y la RESPUESTA AUTOMÁTICA de su WhatsApp (24/10/2026, la #289 del ws1: el #2502)
// =============================================================================
// Medido en producción: M1 son 3 partes con pausas de 5 s. El #2502 (inscripción 327): la bienvenida de su WhatsApp
// Business a los 4,4 s de la primera parte y la fila del envío a los 19. `pausarPorRespuesta` lo puso en 'respondio',
// `alContestar` no lo tocó (todavía no le había salido nada) y el avance después de mandar, en modo 'fila' (por id, sin
// comparar, con el estado LEÍDO), lo volvió a 'activa': sin aviso al equipo y con M2 programado. Y lo que «contestó» era
// la bienvenida: arreglar sólo la carrera haría que TODAS esas corten la secuencia. Por eso van juntas. Lo que se fija:
//   · `esRespuestaAutomatica` (lib/respuesta-automatica.ts) EJECUTADA: los bordes del umbral, desde la PRIMERA parte, sólo
//     el primer WhatsApp de la inscripción, sin salientes, el entrante antes de todo saliente; y (la revisión del mismo
//     día) la ráfaga es de una inscripción sólo con SU fila del envío —la reclamada sin fila se espera—, quien ya venía
//     hablando cuenta, la 'completada' sin desenlace también se mira, y un borrador aprobado sale a la hora en que se aprobó;
//   · `reconciliarAvance` (lib/nutricion-grafo-motor.ts) EJECUTADA: qué hace el avance que no entró;
//   · el cableado: el reclamo antes de mandar, el avance `avanzarTrasMandar` (compare-and-set + releer + `alContestar`),
//     los hilos con la regla del cursor, y el webhook (la lectura, la espera de la fila).
//
// PROBADO ROMPIÉNDOLO: ver el pie. Correr: node --import tsx --test tests/automations-contesto-mientras-sale.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  esRespuestaAutomatica, textoRespuestaAutomatica, horasDeSalida, inicioDeLaRafaga,
  UMBRAL_RESPUESTA_AUTOMATICA_MS, HUECO_ENTRE_PARTES_MS, VENTANA_LECTURA_MS, TIPEO_MAX_S, RECLAMO_ANTES_DE_LA_PRIMERA_MS,
  FILA_DEL_ENVIO_TRAS_LA_PRIMERA_MAX_MS, SIN_ACTIVIDAD_PARA_LA_BIENVENIDA_MS,
  type InscripcionAlEntrar,
} from '../lib/respuesta-automatica';
import { reconciliarAvance, contestoMientrasSalia, estadoAlEscribir } from '../lib/nutricion-grafo-motor';
import { PAUSA_MAX_S, PAUSA_TOTAL_MAX_S, TOPE_PARTES } from '../lib/mensaje-partes';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const tramo = (src: string, desde: string, hasta: string) => { const i = src.indexOf(desde); assert.ok(i >= 0, `no está «${desde}»`); return src.slice(i, src.indexOf(hasta, i + desde.length)); };

const S = 1000;
// El #2502: la primera parte a las 22:09:17, las otras dos con 5 s de pausa.
const T = Date.parse('2026-10-24T01:09:17Z');
const PARTES = [T, T + 5 * S, T + 10 * S];
/** Entró hace una hora, vencida, y la fila del envío de ESTE mensaje ya se escribió (después de la última parte). */
const conSuFila = (extra: Partial<InscripcionAlEntrar> = {}): InscripcionAlEntrar =>
  ({ id: 327, secuenciaId: 289, estado: 'activa', inscriptoMs: T - 3600 * S, proximoMs: T + 86400 * S, reclamoMs: T + 12 * S, enviosMs: [T + 12 * S], ...extra });
/** El motor la reclamó 2 s antes de la primera parte y las partes todavía están saliendo: vencida y sin fila. */
const reclamada = (extra: Partial<InscripcionAlEntrar> = {}): InscripcionAlEntrar =>
  ({ id: 327, secuenciaId: 289, estado: 'activa', inscriptoMs: T - 3600 * S, proximoMs: T - 30 * S, reclamoMs: T - 2 * S, enviosMs: [], ...extra });
const decide = (recibidoMs: number, salientesMs: number[] = PARTES, inscripciones: InscripcionAlEntrar[] = [conSuFila()], o: { entrantesMs?: number[]; sinEsperar?: boolean } = {}) =>
  esRespuestaAutomatica({ recibidoMs, salientesMs, inscripciones, ...o });

test('el #2502: la bienvenida a los 4,4 s de la primera parte es automática; los bordes del umbral', () => {
  assert.equal(UMBRAL_RESPUESTA_AUTOMATICA_MS, 15_000);
  const v = decide(T + 4400);
  assert.ok(v.automatica, JSON.stringify(v));
  assert.equal(v.automatica && v.ms, 4400);
  assert.equal(v.automatica && v.inscripcionId, 327);
  assert.equal(decide(T + 14 * S).automatica, true, 'a los 14 s');
  assert.equal(decide(T + 15 * S).automatica, true, 'a los 15 s justos, todavía');
  const tarde = decide(T + 16 * S);
  assert.deepEqual(tarde, { automatica: false, porque: 'tarde', ms: 16_000 }, 'a los 16 s es una persona');
  assert.equal(decide(T + 30 * S).automatica, false, 'a los 30 s (el que hoy sí contaba)');
});

test('el #2502 de verdad: la bienvenida llega ANTES de la fila del envío → se espera la fila de la RECLAMADA', () => {
  // A los 4,4 s todavía no hay fila (se escribe a los 19): el motor la reclamó y sus partes están saliendo.
  const espera = decide(T + 4400, PARTES, [reclamada()]);
  assert.deepEqual(espera, { automatica: false, porque: 'esperar-su-fila', ms: 4400, inscripcionId: 327, secuenciaId: 289, hastaMs: T + FILA_DEL_ENVIO_TRAS_LA_PRIMERA_MAX_MS });
  // Llegó su fila (a los 19 s): es suya.
  const conFila = decide(T + 4400, PARTES, [reclamada({ enviosMs: [T + 19 * S] })], { sinEsperar: true });
  assert.ok(conFila.automatica && conFila.inscripcionId === 327, JSON.stringify(conFila));
  // No llegó (la frenó el anti-ban, falló, era de otro): cuenta como respuesta.
  assert.deepEqual(decide(T + 4400, PARTES, [reclamada()], { sinEsperar: true }), { automatica: false, porque: 'no-es-el-primero', ms: 4400 });
  // La espera alcanza para la fila más tardía posible: todas las partes con su «escribiendo…» y las pausas (medido: 24 s).
  assert.ok(FILA_DEL_ENVIO_TRAS_LA_PRIMERA_MAX_MS >= (PAUSA_TOTAL_MAX_S + (TOPE_PARTES - 1) * TIPEO_MAX_S) * S);
  assert.ok(FILA_DEL_ENVIO_TRAS_LA_PRIMERA_MAX_MS >= 24 * S);
  // Una con SU fila gana a una reclamada (no se espera de gusto).
  const dos = decide(T + 4400, PARTES, [reclamada({ id: 1 }), conSuFila({ id: 2 })]);
  assert.ok(dos.automatica && dos.inscripcionId === 2, JSON.stringify(dos));
});

test('el reclamo no atribuye: una vencida sin reclamar, o reclamada hace mucho, no se queda con la ráfaga de OTRO', () => {
  // El freno de la corrida (la revisión, `frenadoPorAntiBan` con `enviadoEnCorrida`): A va por la mitad y le sale M3; a B,
  // vencida y sin nada enviado, la frena el anti-ban (no se reclama). El lead contesta M3 a los 8 s: es una persona.
  const a = conSuFila({ id: 10, secuenciaId: 1, inscriptoMs: T - 3 * 86400 * S, enviosMs: [T - 2 * 86400 * S, T - 86400 * S, T + 12 * S] });
  const b = reclamada({ id: 20, secuenciaId: 2, proximoMs: T - 60 * S, reclamoMs: T - 3 * 86400 * S });
  assert.deepEqual(decide(T + 8 * S, PARTES, [a, b]), { automatica: false, porque: 'no-es-el-primero', ms: 8000 });
  // Una automatización PAUSADA (vencida para siempre) y una persona que escribe desde Chats: tampoco.
  const pausada = reclamada({ proximoMs: T - 5 * 86400 * S, reclamoMs: T - 5 * 86400 * S });
  assert.deepEqual(decide(T + 6 * S, [T], [pausada]), { automatica: false, porque: 'no-es-el-primero', ms: 6000 });
  // El borde del reclamo: hasta `RECLAMO_ANTES_DE_LA_PRIMERA_MS` antes de la primera parte, y nunca después de ella.
  assert.equal(RECLAMO_ANTES_DE_LA_PRIMERA_MS, 60_000);
  const enElBorde = decide(T + 5 * S, PARTES, [reclamada({ reclamoMs: T - RECLAMO_ANTES_DE_LA_PRIMERA_MS })]);
  assert.equal(!enElBorde.automatica && enElBorde.porque, 'esperar-su-fila');
  assert.equal(decide(T + 5 * S, PARTES, [reclamada({ reclamoMs: T - RECLAMO_ANTES_DE_LA_PRIMERA_MS - 1 })]).automatica, false);
  const viejo = decide(T + 5 * S, PARTES, [reclamada({ reclamoMs: T - RECLAMO_ANTES_DE_LA_PRIMERA_MS - 1 })]);
  assert.equal(!viejo.automatica && viejo.porque, 'no-es-el-primero');
  // Escrita DESPUÉS de que empezara la ráfaga (la marcó otra cosa): no es «la está mandando».
  const despues = decide(T + 5 * S, PARTES, [reclamada({ reclamoMs: T + 2 * S })]);
  assert.equal(!despues.automatica && despues.porque, 'no-es-el-primero');
  // Sin vencer (espera su turno de goteo): tampoco.
  const sinVencer = decide(T + 5 * S, PARTES, [reclamada({ proximoMs: T + 600 * S })]);
  assert.equal(!sinVencer.automatica && sinVencer.porque, 'no-es-el-primero');
});

test('se mide desde la PRIMERA parte, no desde la última; y otro mensaje de antes no se junta', () => {
  // A los 16 s de la primera parte, 6 s después de la última: cuenta (la persona leyó la primera).
  assert.equal(decide(T + 16 * S).automatica, false);
  // Un saliente de hace un minuto (otro mensaje: más lejos que el hueco entre partes) no corre el comienzo.
  assert.ok(60 * S > HUECO_ENTRE_PARTES_MS);
  const conOtro = decide(T + 5 * S, [T - 60 * S, ...PARTES]);
  assert.ok(conOtro.automatica && conOtro.ms === 5000, JSON.stringify(conOtro));
  assert.equal(inicioDeLaRafaga(T + 5 * S, [T - 60 * S, ...PARTES]), T);
  // Entre dos partes cabe la pausa más larga y el «escribiendo…» de la siguiente: a 18 s una de otra (5 s de pausa y 11
  // de tipeo) siguen siendo el MISMO mensaje, y a quien contesta a los 20 s de la primera se lo mide desde ella.
  assert.ok(HUECO_ENTRE_PARTES_MS >= (PAUSA_MAX_S + TIPEO_MAX_S) * S);
  assert.deepEqual(decide(T + 20 * S, [T, T + 18 * S]), { automatica: false, porque: 'tarde', ms: 20_000 });
  // La ventana de lectura alcanza para encontrar la primera parte (el umbral y un hueco entero hacia atrás).
  assert.ok(VENTANA_LECTURA_MS >= UMBRAL_RESPUESTA_AUTOMATICA_MS + HUECO_ENTRE_PARTES_MS);
  assert.ok(PAUSA_TOTAL_MAX_S * S <= VENTANA_LECTURA_MS);
});

test('sólo el PRIMER WhatsApp de la inscripción: con algo enviado antes en esta pasada, cuenta', () => {
  // (M1 salió hace 10 minutos; ahora sale M2.)
  const yaLeSalio = conSuFila({ enviosMs: [T - 600 * S, T + 12 * S] });
  assert.deepEqual(decide(T + 5 * S, PARTES, [yaLeSalio]), { automatica: false, porque: 'no-es-el-primero', ms: 5000 });
  // Una reinscripción reusa la fila: lo de la pasada anterior (antes de `inscripto_at`) no cuenta.
  const reinscripta = conSuFila({ inscriptoMs: T - 60 * S, enviosMs: [T - 30 * 86400 * S, T + 12 * S] });
  assert.equal(decide(T + 5 * S, PARTES, [reinscripta]).automatica, true);
  // Entró después de que empezara a salir: el mensaje no es de ella.
  assert.equal(decide(T + 5 * S, PARTES, [conSuFila({ inscriptoMs: T + 3 * S })]).automatica, false);
  // Sin inscripciones, ninguna automatización le mandó nada.
  assert.equal(decide(T + 5 * S, PARTES, []).automatica, false);
});

test('la «Bienvenida» de un solo mensaje: la respuesta llega con la inscripción ya «completada» (sin desenlace) y se mira igual', () => {
  // P1 sale, la fila del envío y el avance (`avanceDesde`: sin siguiente → 'completada') a los milisegundos; la
  // bienvenida a los 5 s. `pausarPorRespuesta` la tomaría por la vía de las tardías y el AI Step le contestaría al bot.
  const una = conSuFila({ estado: 'completada', desenlace: null, proximoMs: null, enviosMs: [T + 300] });
  assert.ok(decide(T + 5 * S, [T], [una]).automatica);
  // Con desenlace ya no escucha, y una cancelada tampoco.
  assert.equal(decide(T + 5 * S, [T], [conSuFila({ estado: 'completada', desenlace: 'logrado', enviosMs: [T + 300] })]).automatica, false);
  assert.equal(decide(T + 5 * S, [T], [conSuFila({ estado: 'cancelada', enviosMs: [T + 300] })]).automatica, false);
  // Una 'completada' no se está mandando: con un reclamo cerca y sin fila, no se espera nada.
  const sinFila = decide(T + 5 * S, [T], [reclamada({ estado: 'completada', desenlace: null })]);
  assert.equal(!sinFila.automatica && sinFila.porque, 'no-es-el-primero');
});

test('si el lead YA VENÍA HABLANDO (14 días), lo rápido cuenta: sin la bienvenida, es una charla', () => {
  // Escribió «hola, llené el formulario», `pausarPorRespuesta` lo dejó en 'respondio' y le salió M1: contesta a los 9 s.
  const respondio = conSuFila({ estado: 'respondio' });
  assert.deepEqual(decide(T + 9 * S, PARTES, [respondio], { entrantesMs: [T - 120 * S] }), { automatica: false, porque: 'ya-hablaban', ms: 9000 });
  // Hace más de 14 días ya no es actividad: la bienvenida vuelve a salir.
  assert.equal(SIN_ACTIVIDAD_PARA_LA_BIENVENIDA_MS, 14 * 86400 * S);
  assert.equal(decide(T + 5 * S, PARTES, [conSuFila()], { entrantesMs: [T - SIN_ACTIVIDAD_PARA_LA_BIENVENIDA_MS - S] }).automatica, true);
  // Un entrante DENTRO de la ráfaga (la primera burbuja de la misma bienvenida) no es «ya hablaban».
  assert.equal(decide(T + 5 * S, PARTES, [conSuFila()], { entrantesMs: [T + 4 * S] }).automatica, true);
});

test('un borrador APROBADO sale a la hora en que se aprobó, no a la de su fila (modo asistido)', () => {
  // La fila del envío de M1 es de cuando se creó el borrador (hace 3 h); se aprobó y salió en T.
  const h = horasDeSalida(
    [{ inscripcionId: 327, paso: 1, estado: 'enviado', creadoMs: T - 3 * 3600 * S }],
    [{ inscripcionId: 327, paso: 1, enviadoMs: T + 200 }],
  );
  assert.deepEqual(h.get(327), [T + 200]);
  assert.ok(decide(T + 5 * S, [T], [conSuFila({ enviosMs: h.get(327) ?? [] })]).automatica);
  // Sin la aprobación (pendiente o descartado): un 'borrador' no salió; una fila 'enviado' sin borrador, a su hora.
  assert.deepEqual(horasDeSalida([{ inscripcionId: 1, paso: 1, estado: 'borrador', creadoMs: T }], []).get(1), undefined);
  assert.deepEqual(horasDeSalida([{ inscripcionId: 1, paso: 2, estado: 'enviado', creadoMs: T }], [{ inscripcionId: 1, paso: 1, enviadoMs: T + 9 }]).get(1), [T]);
  // Aprobado (wa_borradores 'enviado') con la fila todavía en 'borrador' (`anotarPasoEnviado` no corrió): salió.
  assert.deepEqual(horasDeSalida([{ inscripcionId: 1, paso: 1, estado: 'borrador', creadoMs: T - 60 * S }], [{ inscripcionId: 1, paso: 1, enviadoMs: T }]).get(1), [T]);
  // Un borrador de otra pasada (aprobado ANTES de que existiera esta fila) no le cambia la hora.
  assert.deepEqual(horasDeSalida([{ inscripcionId: 1, paso: 1, estado: 'enviado', creadoMs: T }], [{ inscripcionId: 1, paso: 1, enviadoMs: T - 86400 * S }]).get(1), [T]);
});

test('sin salientes, o el entrante ANTES de todo saliente, es una respuesta (le escribió antes de recibir nada)', () => {
  assert.deepEqual(decide(T + 5 * S, []), { automatica: false, porque: 'sin-salientes' });
  // Escribió 10 s antes de que saliera la primera parte: lo de después no cuenta para medirlo.
  assert.deepEqual(decide(T - 10 * S), { automatica: false, porque: 'sin-salientes' });
  // Un segundo de holgura por los relojes (WhatsApp trae segundos truncados).
  assert.equal(decide(T - 500, PARTES, [conSuFila({ enviosMs: [T + 300] })]).automatica, true);
});

test('la línea de la ficha: una LECTURA por la hora, de qué automatización, y que no cuenta como respuesta', () => {
  assert.equal(textoRespuestaAutomatica(4400, 'Bienvenida'), 'Su mensaje llegó a los 4 s del primer mensaje de «Bienvenida»: tan rápido se toma como la respuesta automática de su WhatsApp y no cuenta como respuesta.');
  assert.equal(textoRespuestaAutomatica(300, null), 'Su mensaje llegó en el mismo segundo que el primer mensaje de una automatización: tan rápido se toma como la respuesta automática de su WhatsApp y no cuenta como respuesta.');
  assert.doesNotMatch(textoRespuestaAutomatica(5000, 'X'), /^Respuesta automática/, 'la línea lo afirma como un hecho');
});

test('el avance que no entró: contestó mientras salía → se escribe CONSERVANDO «respondio»; si otro la movió, no se pisa', () => {
  const leido = { estado: 'activa', paso_actual: 1, nodo_actual: 'm1' };
  const fila = (x: Partial<{ estado: string; paso_actual: number; nodo_actual: string | null; proximo_envio_at: string | null }>) =>
    ({ estado: 'activa', paso_actual: 1, nodo_actual: 'm1', proximo_envio_at: '2026-10-24T01:09:00Z', ...x });
  // El #2502: la misma posición, 'activa' → 'respondio' (alContestar no la tocó: no le había salido nada).
  assert.deepEqual(reconciliarAvance(leido, fila({ estado: 'respondio' })), { tipo: 'conservar-respuesta' });
  // Y la escritura que sigue conserva el 'respondio' (la condición «Contestó» lo ve; el desenlace, como logrado).
  assert.equal(estadoAlEscribir('respondio', 'activa'), 'respondio');
  assert.equal(estadoAlEscribir('respondio', 'completada'), 'respondio');
  // La simétrica: llegó después de la fila del envío y `alContestar` la llevó a la rama «Contestó».
  assert.equal(reconciliarAvance(leido, fila({ estado: 'respondio', paso_actual: 3, nodo_actual: 'aviso' })).tipo, 'no-pisar');
  // Sin rama «Contestó», `alContestar` la deja en su lugar y sin próximo envío: también ya decidió (y `escribirHilos`, en
  // la primera conversión a hilos, pregunta lo mismo: ver el cableado).
  assert.equal(reconciliarAvance(leido, fila({ estado: 'respondio', proximo_envio_at: null })).tipo, 'no-pisar');
  // Cerrada o cancelada mientras salía (desde la ficha, otra corrida): no se revive.
  assert.equal(reconciliarAvance(leido, fila({ estado: 'cancelada' })).tipo, 'no-pisar');
  assert.equal(reconciliarAvance(leido, fila({ estado: 'completada' })).tipo, 'no-pisar');
  // Otra corrida ya la avanzó (el cron y la vía rápida): no se pisa.
  assert.equal(reconciliarAvance(leido, fila({ paso_actual: 2, nodo_actual: 'c1' })).tipo, 'no-pisar');
  assert.equal(reconciliarAvance(leido, null).tipo, 'no-pisar');
  // Nada distinto: se reintenta.
  assert.deepEqual(reconciliarAvance(leido, fila({})), { tipo: 'reintentar' });
  // Una 'respondio' del carril (M4) que vuelve a 'activa' por el destrabe de `requiere` cambia de lugar: no se pisa.
  assert.equal(reconciliarAvance({ estado: 'respondio', paso_actual: 1, nodo_actual: 'm1' }, fila({ estado: 'activa', paso_actual: 4, nodo_actual: 'x' })).tipo, 'no-pisar');
  assert.equal(contestoMientrasSalia('activa', 'respondio'), true);
  assert.equal(contestoMientrasSalia(undefined, 'respondio'), true, 'sin estado leído es activa');
  assert.equal(contestoMientrasSalia('respondio', 'respondio'), false);
  assert.equal(contestoMientrasSalia('activa', 'completada'), false);
});

test('cableado del motor: el reclamo antes de mandar; el avance es compare-and-set y reconcilia; los hilos con la regla del cursor', () => {
  const motor = leer('lib/nutricion.ts');
  // EL RECLAMO: después de las guardas que no mandan (el anti-ban, el tope de email), antes del turno del residuo (una que
  // cambió no lo gasta) y antes de despachar. Si cambió, no sale y vuelve a la cola; el toque del carril se devuelve.
  const ante = tramo(motor, "nota: 'tope diario de email' });", 'let estado: \'enviado\' | \'simulado\'');
  assert.match(ante, /const reclamo = await reclamarAntesDeMandar\(insc\);\n\s+if \(reclamo !== 'reclamada'\) \{\n\s+await soltarToque\(carril\);/);
  assert.match(ante, /if \(reclamo === 'cambio'\) \{ vistos\.delete\(insc\.id\); otraVuelta = true; \}\n\s+continue;\n\s+\}\n\n\s+\/\/ ⚠️ EL RESIDUO SALE DE A UNO POR CORRIDA/);
  assert.ok(ante.indexOf('reclamarAntesDeMandar(insc)') < ante.indexOf('residuoEnCorrida += 1;'), 'el reclamo va después del turno del residuo: una que cambió lo gasta');
  const rec = tramo(motor, 'const reclamarAntesDeMandar = async (', '\n  };\n');
  assert.match(rec, /\.update\(\{ updated_at: ahoraISO\(\) \}\)\.eq\('id', insc\.id\)\.eq\('estado', estadoLeido\(insc\)\)/);
  assert.match(rec, /if \(sanearHilos\(insc\.hilos\)\) q = q\.not\('hilos', 'is', null\)\.eq\('hilos_rev', Number\(insc\.hilos_rev\) \|\| 0\);/);
  assert.match(rec, /q = q\.is\('hilos', null\)\.eq\('paso_actual', insc\.paso_actual\);\n\s+q = insc\.nodo_actual == null \? q\.is\('nodo_actual', null\) : q\.eq\('nodo_actual', insc\.nodo_actual\);/);
  // El avance después de mandar ya no es 'fila'.
  assert.doesNotMatch(motor, /\}, \{ modo: 'fila', nuevos: nuevosAlSalir \}\);/, 'el avance volvió a modo fila: pisa el respondio');
  assert.match(motor, /const avanzo = await avanzarTrasMandar\(insc, \{\n\s+\.\.\.avance,/);
  // Contestó mientras salía: ahora sí le salió algo, «Contestó» corta en el acto (sin la vía rápida: esta corrida es el motor).
  assert.match(motor, /if \(avanzo === 'contesto'\) await alContestar\(insc\.lead_id, \[\{ id: insc\.id, secuencia_id: insc\.secuencia_id \}\], \[sec\], \{ sinViaRapida: true \}\);/);
  assert.match(motor, /if \(yaToca \|\| avanzo !== 'escrito'\) \{ vistos\.delete\(insc\.id\); otraVuelta = true; \}/);
  const av = tramo(motor, 'const avanzarTrasMandar = async (', '\n  };\n');
  assert.match(av, /await escribir\(insc, campos, \{ modo: 'cas', nuevos, trasMandar: true \}\)/);
  assert.match(av, /const r = reconciliarAvance\(insc, data as/);
  assert.match(av, /if \(r\.tipo === 'conservar-respuesta'\) insc\.estado = 'respondio';/);
  assert.match(av, /if \(sanearHilos\(insc\.hilos\) \|\| nuevos\.length\) return 'no';/);
  assert.match(av, /\} catch \(e\) \{/, 'el avance tira: la corrida se cae con el mensaje ya mandado');
  // `escribir` le pasa `trasMandar` a los hilos, y `escribirHilos` reintenta contra 'respondio'… salvo que «Contestó» ya
  // la haya sacado: la primera conversión a hilos pregunta lo mismo que el cursor (`reconciliarAvance`).
  const hilos = tramo(motor, 'async function escribirHilos(', '\n}\n');
  assert.match(hilos, /const contesto = fila\.estado !== estadoLeido\(insc\) && !!o\.trasMandar && contestoMientrasSalia\(estadoLeido\(insc\), fila\.estado\);/);
  assert.match(hilos, /if \(contesto && !leido\.hilos && !hs && reconciliarAvance\(insc, fila\)\.tipo === 'no-pisar'\) return false;\n\s+const sigue = /);
  assert.match(hilos, /if \(contesto\) insc\.estado = 'respondio';/);
});

test('cableado del webhook: la automática no llega a `pausarPorRespuesta`; qué se lee; la reclamada se espera', () => {
  const evo = leer('lib/evolution-mensajes.ts');
  const upsert = tramo(evo, 'export async function guardarMensajeUpsert(', '\n}\n');
  assert.match(upsert, /const ya = await esRespuestaAutomaticaDelEntrante\(leadId, recibido, \{ sinEsperar: true \}\);\n\s+if \(ya === true\) return;/);
  assert.match(upsert, /try \{ await pausarPorRespuesta\(leadId, /);
  // ⚠️ La espera de la fila NO va en el webhook (sincrónico para el 1-a-1): se decide después de contestar, en el negocio.
  assert.match(upsert, /if \(ya === 'esperar'\) \{[\s\S]*?try \{ after\(\(\) => runWithWorkspace\(ws, tarde\)\); \} catch \{ await tarde\(\); \}\n\s+return;\n\s+\}\n\s+await pausar\(\);/,
    'el webhook espera la fila de la reclamada en el camino sincrónico');
  const lect = tramo(evo, 'export async function esRespuestaAutomaticaDelEntrante(', '\n}\n');
  assert.match(lect, /\.from\('wa_mensajes'\)\.select\('wa_timestamp'\)\n\s+\.eq\('lead_id', leadId\)\.eq\('from_me', true\)/);
  // Los entrantes de VERDAD de los 14 días de antes de la ráfaga (como la puerta del webhook: sin 'evento' ni 'otro').
  assert.match(lect, /\.eq\('lead_id', leadId\)\.eq\('from_me', false\)\.not\('tipo', 'in', '\(evento,otro\)'\)\n\s+\.gte\('wa_timestamp', new Date\(inicio - SIN_ACTIVIDAD_PARA_LA_BIENVENIDA_MS\)\.toISOString\(\)\)\n\s+\.lt\('wa_timestamp', new Date\(inicio - TOLERANCIA_RELOJ_MS\)\.toISOString\(\)\)/);
  // Las 'completada' (sin desenlace, lo decide la pura) también, con su estado y el reclamo (`updated_at`).
  assert.match(lect, /\.select\('id, secuencia_id, estado, desenlace, inscripto_at, proximo_envio_at, updated_at'\)\n\s+\.eq\('lead_id', leadId\)\.in\('estado', \['activa', 'respondio', 'completada'\]\)/);
  assert.match(lect, /reclamoMs: finito\(aMs\(f\.updated_at\)\),/);
  assert.match(lect, /recibidoMs, salientesMs, entrantesMs, sinEsperar,/, 'los entrantes de antes no llegan a la pura');
  // Sólo WhatsApp, y la hora de salida del borrador aprobado.
  assert.match(lect, /\.eq\('canal', 'whatsapp'\)\.in\('estado', \['enviado', 'simulado', 'borrador'\]\)/);
  assert.match(lect, /\.from\('wa_borradores'\)\.select\('inscripcion_id, paso, enviado_at'\)\n\s+\.in\('inscripcion_id', ids\)\.eq\('origen', 'nutricion'\)\.eq\('estado', 'enviado'\)/);
  assert.match(lect, /enviosMs: salidas\.get\(f\.id\) \?\? \[\],/);
  // La reclamada sin fila: se espera SU fila (cualquier estado) hasta `hastaMs`, y se vuelve a decidir sin esperar.
  assert.match(lect, /if \(!v\.automatica && v\.porque === 'esperar-su-fila'\) \{\n\s+if \(opts\?\.sinEsperar\) return 'esperar';/);
  assert.match(lect, /\.from\('nutricion_envios'\)\.select\('id'\)\.eq\('inscripcion_id', inscripcionId\)\n\s+\.gte\('created_at', new Date\(inicio - TOLERANCIA_RELOJ_MS\)\.toISOString\(\)\)\.limit\(1\);/);
  assert.match(lect, /v = await decidir\(true\);/);
  assert.match(lect, /await logLeadEvent\(leadId, 'Automatización', textoRespuestaAutomatica\(v\.ms, nombre\), 'MaKo'\);/);
});

// ── ROTURAS (24/10/2026; R15 en adelante son de la revisión del mismo día, y R1 a R14 se volvieron a medir) ──────────────
// Con roturas-carrera.mjs del scratchpad: reemplaza el texto, corre ESTE archivo junto con
// tests/automations-contesto-corta.test.ts y tests/nutricion-hilos.test.ts, y lo devuelve de memoria en un finally (nunca
// `git checkout`). Base 39 pasan / 0 fallan (13 de acá, 3 de contesto-corta y 23 de hilos):
//   R1.  el umbral en 20 s (a los 16 s una persona cuenta como automática)                          → 37 / 2
//   R2.  se mide desde la ÚLTIMA parte (sin caminar hacia atrás)                                       → 33 / 6
//   R3.  sin «ya le había salido algo antes» (el segundo mensaje también filtra)                       → 37 / 2
//   R4.  sin «vencida» (una que espera su goteo se queda esperando la ráfaga de otro)                  → 38 / 1
//   R5.  los envíos de la pasada anterior cuentan (una reinscripción nunca filtra)                     → 38 / 1
//   R6.  `reconciliarAvance` sin mirar la posición (pisa la rama «Contestó» de `alContestar`)          → 38 / 1
//   R7.  `reconciliarAvance` sin mirar el próximo envío (pisa el «sale de la automatización»)         → 38 / 1
//   R8.  el avance vuelve a `modo: 'fila'` (el #2502)                                                  → 38 / 1
//   R9.  `avanzarTrasMandar` no conserva 'respondio' al reintentar                                    → 38 / 1
//   R10. no corre `alContestar` después de conservar la respuesta (sin aviso al equipo)               → 38 / 1
//   R11. `escribirHilos` sin `trasMandar` (con hilos el avance se pierde y el mensaje sale dos veces) → 38 / 1
//   R12. el webhook llama a `pausarPorRespuesta` sin preguntar si es automática                        → 38 / 1
//   R13. `alContestar` ignora `sinViaRapida` (el motor anida otra corrida; falla el de contesto-corta) → 38 / 1
//   R14. el hueco entre partes sin el «escribiendo…» (dos partes a 18 s se parten en dos mensajes)      → 38 / 1
//   R15. la reclamada sin fila es automática sin esperar (lo de antes: «vencida y sin envíos»)         → 37 / 2
//   R16. sin el reclamo (cualquier vencida espera la ráfaga de otro: el freno, la pausada, Chats)      → 38 / 1
//   R17. `sinEsperar` ignorado (después de esperar, sigue «esperando»)                                → 38 / 1
//   R18. sin las 'completada' (la «Bienvenida» de un solo mensaje: el AI Step le contesta al bot)     → 38 / 1
//   R19. las 'completada' CON desenlace también                                                       → 38 / 1
//   R20. sin «ya hablaban» (al que escribió antes se le come la respuesta)                            → 38 / 1
//   R21. «ya hablaban» sin el tope de 14 días                                                          → 38 / 1
//   R22. «ya hablaban» cuenta los entrantes de DENTRO de la ráfaga (la primera burbuja de la bienvenida) → 38 / 1
//   R23. `horasDeSalida` sin el borrador aprobado (en asistido la bienvenida vuelve a cortar)         → 38 / 1
//   R24. un 'borrador' sin aprobar cuenta como salido                                                  → 38 / 1
//   R25. la línea de la ficha lo afirma como un hecho («Respuesta automática de su WhatsApp…»)        → 38 / 1
//   R26. sin el reclamo antes de mandar (al que contestó con el lote leído le sale M2)                 → 38 / 1
//   R27. el reclamo sin la posición (no ve a `alContestar` moviéndola)                                → 38 / 1
//   R28. el reclamo que perdió no vuelve a la cola (la rama «Contestó» queda para la otra corrida)    → 38 / 1
//   R29. `escribirHilos` sin la regla del cursor (revive la que «Contestó» sacó)                       → 38 / 1
//   R30. el lector sin las 'completada'                                                                → 38 / 1
//   R31. el lector no le pasa a la pura los entrantes de antes                                         → 38 / 1
//   R32. el lector con la hora de la FILA en vez de la de salida (y sin los borradores)               → 38 / 1
//   R33. después de esperar la fila, vuelve a decidir CON espera                                       → 38 / 1
//   R34. el lector sin `canal = 'whatsapp'` (un email de antes es «ya le había salido algo»)           → 38 / 1
//   R35. el webhook espera la fila en el camino sincrónico (sin `sinEsperar`, sin `after`)             → 38 / 1
//   R36. el lector espera aunque le pidan `sinEsperar`                                                  → 38 / 1
// Y el arnés del ws3 (scripts/arnes-contesto-corta.mts) con R26, la espera del lector apagada y R20 a la vez
// (arnes-carrera-roto.mjs del scratchpad): F2, G y H en rojo (6 fallas); devuelto, TODO VERDE.
