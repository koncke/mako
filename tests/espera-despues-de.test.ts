// =============================================================================
// La espera «N después de una fecha del lead» (14/10/2026): la reunión, la 1ª, la 2ª o el plazo de nutrición
// =============================================================================
// Pedido de Martín (14/10/2026 03:06, app/admin/dev/crm/bitacora.ts): el CRM automático pasa a plantillas de Automations.
// La regla T1 del motor (lib/crm-auto-plan.ts) mira la reunión «3 horas después» y la T3 el plazo de la nutrición manual:
// sin una espera que cuente desde ESA fecha, ninguna de las dos se arma (esperar N días desde que entró no es lo mismo, y
// preguntar cada día es CONDITION → DELAY → CONDITION, que la casa prohíbe). La espera vive en el modelo
// (`Espera.modo === 'despues_de'`, lib/flujo-grafo.ts), la decide el motor puro (`resolverControl`,
// lib/nutricion-grafo-motor.ts) con las fechas que arma `fechasDespuesDe`, y la cablea lib/nutricion.ts.
//
// Lo que se fija:
//   1. el guardado la conserva con su `de` (la quinta puerta: lo que el saneo no reconstruye se BORRA);
//   2. las fechas: la hora; una cancelada, nada; una fecha sola o editada a mano, el final de ese día EN LA ZONA DEL NEGOCIO;
//      el plazo, el final de su día;
//   3. el motor: espera hasta la fecha + N; si ya pasó, sigue de largo; sin la fecha, cierra ESE hilo con el motivo;
//   4. NO ES DEL CARRIL del recordatorio (tolerancia de 12 min, fuera del anti-ban y del horario): lo de abajo sigue las
//      reglas de siempre;
//   5. la pantalla, Crear con IA y la API la dicen y la conservan (el editor, `deIA`/`aIA`, `cambiar_espera_paso`);
//   6. el parche de Editar con IA (24/10/2026): `desde: null` es «desde ahora», nombrar un ancla corta «antes de la
//      reunión» (un nombre que no existe, no: se dice), «Si agenda más cerca» se conserva, y un `antes_de_reunion: false`
//      de relleno no le saca la fecha a una «después de» (los tests 7 a 10).
//
// PROBADO ROMPIÉNDOLO (14/10/2026 y 24/10/2026): ver «ROTURAS» al pie.
//
// Correr: npx tsx --test tests/espera-despues-de.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolverControl, camposDelFlujo, fechasDespuesDe, finDelDiaEnZonaMs, anclaDeEspera, motivoSinAncla, tieneEsperaDespues,
  tieneCarril, esHiloDelCarril, minutosAntesDeReunion, decidirToqueDelCarril, seMueveEnLaCorrida, RELLENO_CONTROL,
  reintentoSinAncla, GRACIA_SIN_ANCLA_MIN,
} from '../lib/nutricion-grafo-motor';
import { validarGrafo, normalizar, textoEspera, indicePorId, ANCLAS_DESPUES, type PasoGrafo, type Espera } from '../lib/flujo-grafo';
import { problemasDeForma } from '../lib/flujo-forma';
import { iniciar, siguiente } from '../lib/simulador-grafo';
import { deIA, deIAEdicion, aIA, LISTA_BLANCA_IA, type CtxIA } from '../lib/flujo-ia';
import { porId } from '../lib/api-mako/registro';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const H = 3_600_000;
const ctl = (id: string, extra: Partial<PasoGrafo>): PasoGrafo => ({ id, ...RELLENO_CONTROL, ...extra } as PasoGrafo);
const msg = (id: string, extra: Partial<PasoGrafo> = {}): PasoGrafo =>
  ({ id, canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, cuerpo: `hola ${id}`, template_wa: null, revisar: false, ...extra } as PasoGrafo);
const despues = (id: string, minutos: number, de: Extract<Espera, { modo: 'despues_de' }>['de'], siguiente: string): PasoGrafo =>
  ctl(id, { nodo: 'esperar', espera: { modo: 'despues_de', minutos, de }, siguiente });

/** CRON → «3 h después de la reunión» → WhatsApp (el esqueleto de T1). */
const F: PasoGrafo[] = [despues('e1', 180, 'reunion', 'w1'), msg('w1', { siguiente: null })];
const REUNION = '2026-10-14T15:00:00Z';
const T = Date.parse(REUNION);
const MX = 'America/Mexico_City';

test('1. el guardado la conserva con su «de»; un «de» que falta cae a «la reunión»; las otras esperas, igual que antes', () => {
  for (const a of ANCLAS_DESPUES) {
    assert.deepEqual(camposDelFlujo(despues('e', 180, a.id, 'w')).espera, { modo: 'despues_de', minutos: 180, de: a.id }, `«${a.id}» no sobrevive al guardado`);
  }
  assert.deepEqual(camposDelFlujo(ctl('e', { nodo: 'esperar', espera: { modo: 'despues_de', minutos: 60 } as unknown as Espera, siguiente: 'w' })).espera,
    { modo: 'despues_de', minutos: 60, de: 'reunion' });
  assert.deepEqual(camposDelFlujo(ctl('e', { nodo: 'esperar', espera: { modo: 'despues_de', minutos: 60, de: 'la_boda' } as unknown as Espera, siguiente: 'w' })).espera,
    { modo: 'despues_de', minutos: 60, de: 'reunion' }, 'un «de» inventado');
  assert.deepEqual(camposDelFlujo(ctl('e', { nodo: 'esperar', espera: { modo: 'antes_reunion', minutos: 60 }, siguiente: 'w' })).espera, { modo: 'antes_reunion', minutos: 60 });
  assert.deepEqual(camposDelFlujo(ctl('e', { nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'w' })).espera, { modo: 'tiempo', minutos: 60 });
  // Se publica y está armada con las piezas de hoy.
  assert.deepEqual(validarGrafo(normalizar(F)), []);
  assert.deepEqual(problemasDeForma(normalizar(F)), []);
  // La píldora de la tarjeta.
  assert.equal(textoEspera({ modo: 'despues_de', minutos: 180, de: 'reunion' }), '3 h después de la reunión');
  assert.equal(textoEspera({ modo: 'despues_de', minutos: 1440, de: 'reunion_2' }), '1 día después de la 2ª reunión');
  assert.equal(textoEspera({ modo: 'despues_de', minutos: 540, de: 'plazo_nutricion' }), '9 h después de su plazo de nutrición');
});

test('2. las fechas: la hora; cancelada, nada; una fecha sola, el final de SU día en la zona del negocio; el plazo, igual', () => {
  // México no tiene horario de verano desde 2022: el final del 14/10 son las 05:59:59 UTC del 15.
  assert.equal(new Date(finDelDiaEnZonaMs('2026-10-14', MX)).toISOString(), '2026-10-15T05:59:59.000Z');
  assert.equal(new Date(finDelDiaEnZonaMs('2026-10-14', 'America/Argentina/Buenos_Aires')).toISOString(), '2026-10-15T02:59:59.000Z');
  // Madrid cambia de horario el 25/10/2026: ese día y el anterior tienen distinto desfase.
  assert.equal(new Date(finDelDiaEnZonaMs('2026-10-24', 'Europe/Madrid')).toISOString(), '2026-10-24T21:59:59.000Z');
  assert.equal(new Date(finDelDiaEnZonaMs('2026-10-25', 'Europe/Madrid')).toISOString(), '2026-10-25T22:59:59.000Z');
  // Sin zona (o una que no existe), el final del día de México de siempre (`finDeLaReunionMs`).
  assert.equal(new Date(finDelDiaEnZonaMs('2026-10-14', null)).toISOString(), '2026-10-15T05:59:59.000Z');
  assert.equal(new Date(finDelDiaEnZonaMs('2026-10-14', 'Marte/Olympus')).toISOString(), '2026-10-15T05:59:59.000Z');
  assert.ok(Number.isNaN(finDelDiaEnZonaMs('mañana', MX)));

  assert.deepEqual(fechasDespuesDe({ junta_1_at: REUNION, fecha_junta_1: '2026-10-14' }, MX), { r1: T, r2: null, plazo: null });
  assert.deepEqual(fechasDespuesDe({ junta_1_at: REUNION, fecha_junta_1: null }, MX), { r1: null, r2: null, plazo: null }, 'cancelada');
  assert.deepEqual(fechasDespuesDe({ fecha_junta_2: '2026-10-14' }, 'America/Argentina/Buenos_Aires').r2, Date.parse('2026-10-15T02:59:59Z'), 'una fecha sola: en la zona del negocio');
  // La fecha editada a mano a otro día sin cambiar la hora: manda la fecha (la hora quedó vieja).
  assert.equal(fechasDespuesDe({ junta_1_at: REUNION, fecha_junta_1: '2026-10-20' }, MX).r1, Date.parse('2026-10-21T05:59:59Z'));
  assert.equal(fechasDespuesDe({ nutricion_manual_deadline: '2026-10-14' }, MX).plazo, Date.parse('2026-10-15T05:59:59Z'));
  assert.deepEqual(fechasDespuesDe(null, MX), { r1: null, r2: null, plazo: null });

  // «La reunión» es la ÚLTIMA que tiene; la 1ª y la 2ª, la suya.
  const f = { r1: T, r2: T + 7 * 24 * H, plazo: T - H };
  assert.equal(anclaDeEspera(f, 'reunion'), T + 7 * 24 * H);
  assert.equal(anclaDeEspera({ ...f, r2: null }, 'reunion'), T);
  assert.equal(anclaDeEspera(f, 'reunion_1'), T);
  assert.equal(anclaDeEspera(f, 'reunion_2'), T + 7 * 24 * H);
  assert.equal(anclaDeEspera(f, 'plazo_nutricion'), T - H);
  assert.equal(anclaDeEspera({ r1: null, r2: null, plazo: null }, 'reunion'), null);
  assert.equal(anclaDeEspera(undefined, 'reunion'), null);
});

test('3. el motor: espera hasta la fecha + N; si ya pasó, sigue de largo; sin la fecha, cierra ESE hilo con el motivo', () => {
  const fechas = fechasDespuesDe({ junta_1_at: REUNION, fecha_junta_1: '2026-10-14' }, MX);
  // Antes de la reunión: espera a las 3 h DESPUÉS de la reunión (no a las 3 h de ahora).
  // La fila queda EN la espera (23/10/2026: se vuelve a mirar la fecha al vencer) y se mira al menos una vez por día.
  const antes = resolverControl(F, 0, { hechos: null, ahoraMs: T - 2 * H, reunionMs: null, fechasDespues: fechas });
  assert.equal(antes.tipo, 'esperar');
  assert.equal(antes.tipo === 'esperar' && antes.proximoMs, T + 3 * H);
  assert.equal(antes.tipo === 'esperar' && antes.idx, indicePorId(F, 'e1'), 'la fila queda en la espera, no en la tarjeta siguiente');
  const lejos = resolverControl(F, 0, { hechos: null, ahoraMs: T - 48 * H, reunionMs: null, fechasDespues: fechas });
  assert.equal(lejos.tipo === 'esperar' && lejos.proximoMs, T - 24 * H, 'a más de un día, vuelve a mirar a las 24 h');
  // Pasadas las 3 h (al activar una pausada, lo vencido sale enseguida): sigue al WhatsApp en esta misma vuelta.
  const despuesDe = resolverControl(F, 0, { hechos: null, ahoraMs: T + 4 * H, reunionMs: null, fechasDespues: fechas });
  assert.equal(despuesDe.tipo, 'nodo');
  assert.equal(despuesDe.tipo === 'nodo' && despuesDe.idx, indicePorId(F, 'w1'));
  // Sin la reunión (cancelada, o nunca la tuvo), o sin las fechas: cierra ESE hilo, con el motivo; no espera «de nada».
  for (const sin of [fechasDespuesDe({ junta_1_at: REUNION, fecha_junta_1: null }, MX), undefined]) {
    const r = resolverControl(F, 0, { hechos: null, ahoraMs: T, reunionMs: null, fechasDespues: sin });
    assert.deepEqual(r.tipo === 'sin_ancla' ? r.motivo : r.tipo, motivoSinAncla('reunion'));
  }
  // El plazo de nutrición: «9 h después» del final del día del plazo.
  const P: PasoGrafo[] = [despues('e1', 540, 'plazo_nutricion', 'w1'), msg('w1', { siguiente: null })];
  const plazo = fechasDespuesDe({ nutricion_manual_deadline: '2026-10-14' }, MX);
  const r = resolverControl(P, 0, { hechos: null, ahoraMs: T, reunionMs: null, fechasDespues: plazo });
  assert.equal(r.tipo === 'esperar' && new Date(r.proximoMs).toISOString(), '2026-10-15T14:59:59.000Z', '9 h después de las 23:59:59 de México');
  const sinPlazo = resolverControl(P, 0, { hechos: null, ahoraMs: T, reunionMs: null, fechasDespues: fechasDespuesDe({}, MX) });
  assert.deepEqual(sinPlazo.tipo === 'sin_ancla' ? sinPlazo.motivo : sinPlazo.tipo, 'no tiene plazo de nutrición manual');
  // `tieneEsperaDespues`: el motor sólo calcula las fechas si el flujo tiene una.
  assert.equal(tieneEsperaDespues(F), true);
  assert.equal(tieneEsperaDespues([ctl('e', { nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: null })]), false);
});

test('4. NO es del carril del recordatorio: lo que cuelga de ella sigue las reglas de siempre', () => {
  const i = indicePorId(F, 'w1');
  assert.equal(tieneCarril(F), false);
  assert.equal(esHiloDelCarril(F, 0), false, 'la espera');
  assert.equal(esHiloDelCarril(F, i), false, 'el WhatsApp de abajo');
  assert.equal(minutosAntesDeReunion(F, i), null);
  // Sin la tolerancia de 12 min ni el re-ancla del recordatorio: el carril no la decide.
  assert.equal(decidirToqueDelCarril({ leadId: 1, pasos: F, idx: i, juntas: { junta_1_at: REUNION, fecha_junta_1: '2026-10-14' }, ahoraMs: T + 5 * H }), null);
  // Fuera del horario de envío, el WhatsApp de abajo espera a que abra (el carril saldría igual).
  assert.equal(seMueveEnLaCorrida(F, i, { fueraDeHorario: true }), false);
});

test('5. la pantalla y la API la dicen y la conservan', () => {
  // La API: cambiar las horas de una espera «después de» NO le borra de qué fecha cuenta.
  assert.match(sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts')), /espera: \{ \.\.\.\(p\.espera \?\? \{ modo: 'tiempo' as const \}\), minutos: Math\.round\(horas \* 60\) \}/);
  // El editor: el tercer desplegable ofrece «desde ahora» y las cuatro fechas, y cambiar el número conserva el `de`.
  const lienzo = sinComentarios(leer('app/automations/FlujoLienzo.tsx'));
  assert.match(lienzo, /\{ value: 'tiempo', label: 'desde ahora', icono: 'reloj' \}/);
  assert.match(lienzo, /\.\.\.ANCLAS_DESPUES\.map\(\(a\) => \(\{ value: `despues_de:\$\{a\.id\}`, label: `después de \$\{a\.texto\}`/);
  assert.match(lienzo, /const ponerIgual = \(cuanto: number, u: Unidad, apilar: boolean\) => cambiar\(\{ espera: conMinutos\(e, cuanto, u\) \}, apilar\);/);
  // El motor de verdad: calcula las fechas sólo si el flujo tiene una, en la zona del negocio, y cierra el hilo sin ella.
  const motor = sinComentarios(leer('lib/nutricion.ts'));
  assert.match(motor, /const fechasDespues = tieneEsperaDespues\(sec\.pasos\) \? fechasDespuesDe\(lead, await zonaCarril\(\)\) : undefined;/);
  assert.match(motor, /reunionConHoraMs, fechasDespues \}\);/);
  // Sin la fecha: dentro de la gracia vuelve a mirar ESTA espera; pasada, cierra el hilo con el motivo (23/10/2026).
  assert.match(motor, /const otraVez = reintentoSinAncla\(insc\.inscripto_at, Date\.now\(\)\);\s*if \(otraVez == null\) \{ await cerrar\(r\.motivo, true\); continue; \}\s*await escribir\(insc, \{ paso_actual: r\.idx,/);
  assert.match(motor, /estado, desenlace, inscripto_at'\)/, 'la cola no trae cuándo entró');
  assert.match(motor, /estado_lead, nutricion_manual_deadline'\)/, 'la fila del lead no trae el plazo');
});

// LA GRACIA (23/10/2026, la revisión de Automations): el lead entra a la etapa de reunión un instante ANTES de que llegue la
// fecha (lo movieron a mano y la reserva entra por el webhook). Cerrar en el acto le hacía perder la espera para siempre.
// Roturas (base 7/0): `reintentoSinAncla` devolviendo siempre null → 6/1 (cae éste); el motor cerrando en el acto
// (`otraVez = null`) → 6/1 (cae la 5).
// LA FECHA SE MUEVE DESPUÉS DE ENTRAR (23/10/2026, la revisión adversarial de b5): el instante se fijaba al entrar y el hilo
// despertaba en la tarjeta siguiente con la fecha vieja. Ahora la espera se vuelve a resolver con la fecha de cada vuelta.
// Rotura (devolver `idx: j` con el objetivo de la entrada, como antes): 7/2, caen éste y el 3.
test('5d. si la fecha del lead se corre, la espera la vuelve a mirar: plazo alargado, reunión corrida en el día, cancelada', () => {
  const P: PasoGrafo[] = [despues('e1', 540, 'plazo_nutricion', 'w1'), msg('w1', { siguiente: null })];
  const plazo = (d: string | null) => fechasDespuesDe({ nutricion_manual_deadline: d }, MX);
  // Entra con plazo al 20/10: espera EN e1.
  const entra = resolverControl(P, 0, { hechos: null, ahoraMs: Date.parse('2026-10-19T12:00:00Z'), reunionMs: null, fechasDespues: plazo('2026-10-20') });
  assert.equal(entra.tipo === 'esperar' && entra.idx, 0);
  // Al vencer, con el plazo alargado al 25/10: vuelve a esperar (no pasa a la tarjeta siguiente).
  const alVencer = Date.parse('2026-10-21T14:59:59Z');
  const alargado = resolverControl(P, 0, { hechos: null, ahoraMs: alVencer, reunionMs: null, fechasDespues: plazo('2026-10-25') });
  assert.equal(alargado.tipo, 'esperar', 'con el plazo alargado tiene que volver a esperar');
  assert.equal(alargado.tipo === 'esperar' && alargado.idx, 0);
  // Y al vencer el plazo nuevo, sigue al mensaje.
  const nuevo = resolverControl(P, 0, { hechos: null, ahoraMs: Date.parse('2026-10-26T15:00:00Z'), reunionMs: null, fechasDespues: plazo('2026-10-25') });
  assert.equal(nuevo.tipo === 'nodo' && nuevo.idx, 1);
  // Plazo ACORTADO: la vuelta de cada día lo ve y no avisa tarde.
  const acortado = resolverControl(P, 0, { hechos: null, ahoraMs: Date.parse('2026-10-19T16:00:00Z'), reunionMs: null, fechasDespues: plazo('2026-10-18') });
  assert.equal(acortado.tipo === 'nodo' && acortado.idx, 1, 'con el plazo acortado y ya vencido, sale en esa vuelta');
  // La reunión se corre de las 10:00 a las 16:00 del mismo día: a las 13:00 vuelve a esperar hasta las 19:00.
  const r1 = (at: string) => fechasDespuesDe({ junta_1_at: at, fecha_junta_1: '2026-10-14' }, MX);
  const corrida = resolverControl(F, 0, { hechos: null, ahoraMs: Date.parse('2026-10-14T19:00:00Z'), reunionMs: null, fechasDespues: r1('2026-10-14T22:00:00Z') });
  assert.equal(corrida.tipo === 'esperar' && corrida.proximoMs, Date.parse('2026-10-15T01:00:00Z'));
  // Cancelada después de entrar: sin la fecha, `sin_ancla` (y la gracia de 24 h decide si se vuelve a mirar).
  const cancelada = resolverControl(F, 0, { hechos: null, ahoraMs: T + 3 * H, reunionMs: null, fechasDespues: fechasDespuesDe({ junta_1_at: REUNION, fecha_junta_1: null }, MX) });
  assert.equal(cancelada.tipo, 'sin_ancla');
});

test('5c. sin la fecha, en las primeras horas de la inscripción se vuelve a mirar; pasadas, se cierra', () => {
  const ahora = Date.parse('2026-10-23T15:00:00Z');
  const hace = (min: number) => new Date(ahora - min * 60_000).toISOString();
  assert.equal(reintentoSinAncla(hace(5), ahora), ahora + 60 * 60_000, 'recién inscripta: se vuelve a mirar en una hora');
  assert.equal(reintentoSinAncla(hace(GRACIA_SIN_ANCLA_MIN - 1), ahora), ahora + 60 * 60_000, 'todavía en la gracia');
  assert.equal(reintentoSinAncla(hace(GRACIA_SIN_ANCLA_MIN), ahora), null, 'pasada la gracia: se cierra');
  assert.equal(reintentoSinAncla(null, ahora), null, 'sin la fecha de la inscripción no se inventa una gracia');
  assert.equal(reintentoSinAncla('no es una fecha', ahora), null);
  // El resultado del motor lleva QUÉ espera volver a mirar.
  const r = resolverControl(F, 0, { hechos: null, ahoraMs: ahora, reunionMs: null, fechasDespues: fechasDespuesDe({}, MX) });
  assert.equal(r.tipo === 'sin_ancla' ? r.idx : -1, 0);
});

// «PROBAR» (23/10/2026, al portar a main): el simulador trataba toda espera que no fuera «por tiempo» como «antes de la
// reunión», así que «3 h después» llevaba el reloj a la reunión MENOS 3 h y salía antes que un «Esperar 1 h» de otro camino.
// Rotura (volver a la fórmula de antes en lib/simulador-grafo.ts): 5 pass / 1 fail, cae éste.
test('5b. «Probar» lleva el reloj a la reunión MÁS N: lo de «3 h después» sale después de lo de «Esperar 1 h»', () => {
  const pasos: PasoGrafo[] = [
    despues('ed', 180, 'reunion', 'tarde'), msg('tarde', { cuerpo: 'después de la reunión', siguiente: null }),
    ctl('e1', { nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'pronto' }), msg('pronto', { cuerpo: 'en una hora', siguiente: null }),
    ctl('entrada', { nodo: 'inicio', siguiente: 'ed', paralelos: ['e1'] }),
  ];
  const salen: string[] = [];
  let st = iniciar(pasos, { reunionMin: 120 });
  for (let k = 0; k < 60 && !st.terminado; k++) {
    const r = siguiente(pasos, st);
    st = r.estado;
    if (r.evento?.t === 'mensaje') salen.push(r.evento.paso.cuerpo ?? '');
    if (!r.evento && !st.hilos.length) break;
  }
  assert.deepEqual(salen, ['en una hora', 'después de la reunión']);
});

// CREAR Y EDITAR CON IA (23/10/2026, el port de 5129d8dde en lib/flujo-ia.ts, chat de Automations). En la tarjeta va `desde`
// (como la API): `despues_de` ya es, en un tramo de Editar, de qué tarjeta cuelga. Se lee también `despues_de` en la
// tarjeta, el formato del 14/10.
test('6. Crear y Editar con IA la leen, la escriben y no la pierden', () => {
  // Crear con IA: entra con «desde» (o el «despues_de» del 14/10), sale igual (lo que el modelo lee es lo que escribió).
  const acciones = LISTA_BLANCA_IA.map((id) => { const d = porId(id)!; return { id: d.id, titulo: d.titulo, parametros: d.parametros }; });
  const ctx: CtxIA = { etiquetas: [], productos: [], disparadores: [], audios: [], archivos: [], acciones, links: {} };
  const r = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'esperar', horas: 3, desde: 'reunion_1', sigue: 't2' },
    { id: 't2', tipo: 'esperar', horas: 2, desde: 'la boda', sigue: 't3' },
    { id: 't3', tipo: 'esperar', dias: 1, despues_de: 'plazo_nutricion', sigue: 't4' },
    { id: 't4', tipo: 'mensaje', texto: 'Hola {{nombre}}' },
  ] }, ctx, () => 0.5);
  const esperas = r.pasos.filter((p) => p.nodo === 'esperar').map((p) => p.espera);
  assert.deepEqual(esperas, [{ modo: 'despues_de', minutos: 180, de: 'reunion_1' }, { modo: 'tiempo', minutos: 120 }, { modo: 'despues_de', minutos: 1440, de: 'plazo_nutricion' }]);
  assert.ok(r.avisos.some((a) => a.includes('la boda')), `no avisó del «de» inventado: ${r.avisos.join(' | ')}`);
  const vuelta = aIA(r.pasos).tarjetas.find((t) => t.tipo === 'esperar' && t.horas === 3);
  assert.equal(vuelta?.desde, 'reunion_1');
  assert.equal(vuelta?.despues_de, undefined, 'la tarjeta no puede usar la palabra del ancla de un tramo');
  // EDITAR: cambiarle sólo el número la deja contando desde la misma fecha; «desde: ahora» la vuelve por tiempo.
  const base = r.pasos;
  const idDe3h = base.find((p) => p.nodo === 'esperar' && p.espera?.minutos === 180)!.id!;
  const ctxEd = { ...ctx, pedido: 'que sean 5 horas' } as CtxIA;
  const cinco = deIAEdicion({ cambiar: [{ id: idDe3h, horas: 5 }] }, base, ctxEd, () => 0.5);
  assert.deepEqual(cinco.pasos.find((p) => p.id === idDe3h)?.espera, { modo: 'despues_de', minutos: 300, de: 'reunion_1' }, 'cambiar el número le borró de qué fecha cuenta');
  const ahora = deIAEdicion({ cambiar: [{ id: idDe3h, desde: 'ahora' }] }, base, { ...ctx, pedido: 'que cuente desde ahora' } as CtxIA, () => 0.5);
  assert.deepEqual(ahora.pasos.find((p) => p.id === idDe3h)?.espera, { modo: 'tiempo', minutos: 180 });
  const otra = deIAEdicion({ cambiar: [{ id: idDe3h, desde: 'reunion_2' }] }, base, { ...ctx, pedido: 'que cuente desde la segunda reunión' } as CtxIA, () => 0.5);
  assert.deepEqual(otra.pasos.find((p) => p.id === idDe3h)?.espera, { modo: 'despues_de', minutos: 180, de: 'reunion_2' });
  // ⚠️ El system de Crear con IA NO la describe (14/10/2026): con las dos condiciones nuevas del catálogo el prompt quedó
  // en ~3.998 de 4.000 tokens (tests/crear-ia-tercera.test.ts, «techo de Groq»), y la línea de «despues_de» lo pasaba a
  // ~4.029. `deIA` la acepta si el modelo la escribe (lo de arriba), pero Crear no la ENSEÑA: no hay un flujo que leer, y
  // las dos plantillas que la tienen («Una Reunión Sin Marcar», «Venció la Nutrición Manual») no están en
  // PALABRAS_PLANTILLA, así que ningún ejemplo la muestra. Editar sí: el modelo la ve en lo que lee del flujo (`aIA`).
});

// EL PARCHE DE UNA ESPERA (24/10/2026, la revisión adversarial del port de IA, y la del arreglo): formas de perder lo que
// la tarjeta decía sin un aviso, todas en `parcheEspera` (lib/flujo-ia.ts). Un flujo con las tres esperas: «3 h después
// de la 1ª reunión», «1 día antes de la reunión» y otro recordatorio con «Si agenda más cerca: sale igual».
const ACCIONES_IA = LISTA_BLANCA_IA.map((id) => { const d = porId(id)!; return { id: d.id, titulo: d.titulo, parametros: d.parametros }; });
const CTX_IA: CtxIA = { etiquetas: [], productos: [], disparadores: [], audios: [], archivos: [], acciones: ACCIONES_IA, links: {} };
function flujoConEsperas() {
  const r = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'esperar', horas: 3, desde: 'reunion_1', sigue: 't2' },
    { id: 't2', tipo: 'esperar', dias: 1, antes_de_reunion: true, sigue: 't3' },
    { id: 't3', tipo: 'esperar', horas: 6, antes_de_reunion: true, sigue: 't4' },
    { id: 't4', tipo: 'mensaje', texto: 'Hola {{nombre}}' },
  ] }, CTX_IA, () => 0.5);
  const id = (minutos: number) => r.pasos.find((p) => p.nodo === 'esperar' && p.espera?.minutos === minutos)!.id!;
  const [despuesDe, recordatorio, cerca] = [id(180), id(1440), id(360)];
  // «Si agenda más cerca: sale igual» se elige en el lienzo: Crear no lo arma.
  const pasos = r.pasos.map((p) => (p.id === cerca ? { ...p, espera: { modo: 'antes_reunion' as const, minutos: 360, siAgendaCerca: 'sale' as const } } : p));
  const editar = (x: Record<string, unknown>, pedido = 'cambia la espera') => {
    const e = deIAEdicion({ cambiar: [x] }, pasos, { ...CTX_IA, pedido } as CtxIA, () => 0.5);
    return { espera: e.pasos.find((p) => p.id === x.id)?.espera, avisos: e.avisos };
  };
  return { despuesDe, recordatorio, cerca, editar };
}

test('7. «desde»: null (o "") es contar desde ahora, como «link»: null saca el link; no le vuelve a poner la fecha', () => {
  const { despuesDe, recordatorio, editar } = flujoConEsperas();
  assert.deepEqual(editar({ id: despuesDe, horas: 5, desde: null }).espera, { modo: 'tiempo', minutos: 300 }, '«desde»: null le volvió a poner la fecha');
  assert.deepEqual(editar({ id: despuesDe, desde: '' }).espera, { modo: 'tiempo', minutos: 180 });
  assert.deepEqual(editar({ id: despuesDe, horas: 4, despues_de: null }).espera, { modo: 'tiempo', minutos: 240 }, 'la palabra del 14/10');
  // No nombrarla sigue siendo «como estaba» (el test 6).
  assert.deepEqual(editar({ id: despuesDe, horas: 5 }).espera, { modo: 'despues_de', minutos: 300, de: 'reunion_1' });
  // Un recordatorio no cuenta «desde» nada: un null de relleno no lo vuelve «Esperar 2 h».
  assert.deepEqual(editar({ id: recordatorio, horas: 2, desde: null }).espera, { modo: 'antes_reunion', minutos: 120 });
  // ⚠️ Lo de `desde` NO vale para las claves de valor (la revisión, 24/10/2026): un `horas: null` es relleno, «no la
  // nombra». Con `=== undefined` en `tocaTiempo` sumaba 0 minutos y el parche entero se tiraba («la dejaba incompleta»).
  assert.deepEqual(editar({ id: despuesDe, horas: null, desde: 'reunion_2' }), { espera: { modo: 'despues_de', minutos: 180, de: 'reunion_2' }, avisos: [] });
});

test('8. nombrar un ancla en «desde» corta la herencia de «antes de la reunión»; un nombre que no existe, no', () => {
  const { recordatorio, despuesDe, editar } = flujoConEsperas();
  assert.deepEqual(editar({ id: recordatorio, horas: 3, desde: 'reunion' }, 'que sea 3 horas después de la reunión').espera,
    { modo: 'despues_de', minutos: 180, de: 'reunion' }, '«3 h después de la reunión» quedó como un recordatorio');
  assert.deepEqual(editar({ id: recordatorio, desde: 'reunion_1' }).espera, { modo: 'despues_de', minutos: 1440, de: 'reunion_1' });
  assert.deepEqual(editar({ id: recordatorio, desde: 'Reunion 2' }).espera, { modo: 'despues_de', minutos: 1440, de: 'reunion_2' }, 'la normalización de `nodoDe`');
  // ⚠️ Sólo un ANCLA corta (la revisión del arreglo, 24/10/2026): un nombre que no existe no vuelve el recordatorio «Esperar
  // N» por tiempo (salía 1 día después de llegar a la tarjeta, con un aviso gris y MaKo diciendo «Listo»). Queda, y se DICE.
  // Entre ellos, el id de otra tarjeta en `despues_de`: el cruce de palabras que dice `nodoDe`.
  for (const x of [{ desde: 'la boda' }, { horas: 2, desde: 'reunion_en' }, { horas: 2, desde: 'la reunión' }, { horas: 2, despues_de: despuesDe }]) {
    const r = editar({ id: recordatorio, ...x });
    assert.equal(r.espera?.modo, 'antes_reunion', `${JSON.stringify(x)} sacó el recordatorio: ${JSON.stringify(r.espera)}`);
    const nombre = String(x.desde ?? x.despues_de);
    assert.ok(r.avisos.some((a) => a.includes(`«${nombre}»`) && a.includes('antes de la reunión')), `${nombre}: no avisó: ${r.avisos.join(' | ')}`);
  }
  // Un `false` de relleno no tiene nombre que decir: el recordatorio queda, sin un aviso con «».
  assert.deepEqual(editar({ id: recordatorio, desde: false }), { espera: { modo: 'antes_reunion', minutos: 1440 }, avisos: [] });
  // «ahora» no es una fecha: el recordatorio queda, callado (la API tampoco lo cambia por ahí). Y el modo dicho a mano manda.
  assert.deepEqual(editar({ id: recordatorio, desde: 'ahora' }), { espera: { modo: 'antes_reunion', minutos: 1440 }, avisos: [] });
  assert.deepEqual(editar({ id: recordatorio, desde: 'reunion', antes_de_reunion: true }).espera, { modo: 'antes_reunion', minutos: 1440 });
});

test('9. cambiar con IA un recordatorio conserva «Si agenda más cerca»; pasarlo a otro modo lo suelta', () => {
  const { cerca, editar } = flujoConEsperas();
  assert.deepEqual(editar({ id: cerca, horas: 2 }).espera, { modo: 'antes_reunion', minutos: 120, siAgendaCerca: 'sale' }, 'cambiar el número le borró «Si agenda más cerca»');
  assert.deepEqual(editar({ id: cerca, dias: 1, antes_de_reunion: true }).espera, { modo: 'antes_reunion', minutos: 1440, siAgendaCerca: 'sale' });
  // Como el lienzo: pasar a «Esperar» (o a «después de») lo suelta.
  assert.deepEqual(editar({ id: cerca, antes_de_reunion: false }).espera, { modo: 'tiempo', minutos: 360 });
  assert.deepEqual(editar({ id: cerca, desde: 'reunion_2' }).espera, { modo: 'despues_de', minutos: 360, de: 'reunion_2' });
});

test('10. un «antes_de_reunion»: false de relleno, o nombrar el MISMO modo, no le saca la fecha a una «después de»', () => {
  const { despuesDe, editar } = flujoConEsperas();
  // Lo que pasaba (la revisión, 24/10/2026): las dos quedaban «Esperar N» desde ahora, con avisos [].
  assert.deepEqual(editar({ id: despuesDe, horas: 5, antes_de_reunion: false }), { espera: { modo: 'despues_de', minutos: 300, de: 'reunion_1' }, avisos: [] });
  assert.deepEqual(editar({ id: despuesDe, modo: 'despues_de', horas: 4 }).espera, { modo: 'despues_de', minutos: 240, de: 'reunion_1' }, 'nombrar el mismo modo le borró el ancla');
  // Nombrar OTRO modo sí la saca: «por tiempo» o «antes de la reunión».
  assert.deepEqual(editar({ id: despuesDe, modo: 'tiempo', horas: 4 }).espera, { modo: 'tiempo', minutos: 240 });
  assert.deepEqual(editar({ id: despuesDe, horas: 2, antes_de_reunion: true }).espera, { modo: 'antes_reunion', minutos: 120 });
});

// ROTURAS (14/10/2026), una por vez y restaurada desde memoria (scratchpad romper.py). Como está: 5 pasan / 0 fallan.
// Cada rotura (pasan / fallan):
//   R1 el saneo sin «despues_de» (la espera vuelve por tiempo al guardar)                 → 4 / 1 (la 1)
//   R2 `resolverControl` contando desde ahora y no desde la fecha                         → 4 / 1 (la 3)
//   R3 la fecha sola al mediodía de México (`parseFechaJunta`), sin la zona del negocio   → 4 / 1 (la 2)
//   R4 una reunión cancelada cuenta como ancla                                            → 3 / 2 (la 2 y la 3)
//   R5 la espera «después de» metida en el carril (`esEsperaAntes`)                       → 4 / 1 (la 4)
//   R6 «la reunión» = la PRIMERA (Math.min) en vez de la última                           → 4 / 1 (la 2)
//   R7 el motor sin pasarle las fechas a `resolverControl`                                → 4 / 1 (la 5)
//   R8 Crear con IA sin leer «despues_de»                                                 → 4 / 1 (la 5)
//   R9 el editor pierde el `de` al cambiar el número                                      → 4 / 1 (la 5)
//
// ROTURAS de la 7 a la 10 (24/10/2026, `parcheEspera` de lib/flujo-ia.ts; re-medidas con la revisión del arreglo), una
// por vez y restaurada desde memoria en un finally (scratchpad romper-parche-espera-2.mjs, sha1 igual antes y después).
// Como está: 13 pasan / 0 fallan. Cada rotura (pasan / fallan):
//   R10 `desde: null` vuelve a reponer la fecha que tenía (sin `sacaFecha`)                 → 12 / 1 (la 7)
//   R11 nombrar un ancla en `desde` no corta la herencia de «antes de la reunión»            → 11 / 2 (la 8 y la 9)
//   R12 el parche no conserva «Si agenda más cerca»                                         → 12 / 1 (la 9)
//   R13 cualquier `desde` corta la herencia, «ahora» incluido                               → 12 / 1 (la 8)
//   R14 cualquier `desde` que no sea «ahora» corta (el arreglo de antes de la revisión)      → 12 / 1 (la 8)
//   R15 un nombre que no es un ancla deja el recordatorio, pero callado (sin el aviso)       → 12 / 1 (la 8)
//   R16 el aviso sale también con «ahora» o sin nombre (`false`: «No sé contar desde «»»)    → 12 / 1 (la 8)
//   R17 `sacaModo` con el `== null` de antes (un `false` de relleno o el mismo modo la sacan) → 12 / 1 (la 10)
//   R18 `tocaTiempo` con `!== undefined` (un `horas: null` de relleno tira el parche)        → 12 / 1 (la 7)
