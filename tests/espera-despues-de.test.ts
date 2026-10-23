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
//   5. la pantalla, Crear con IA y la API la dicen y la conservan (el editor, `deIA`/`aIA`, `cambiar_espera_paso`).
//
// PROBADO ROMPIÉNDOLO (14/10/2026): ver «ROTURAS» al pie.
//
// Correr: npx tsx --test tests/espera-despues-de.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolverControl, camposDelFlujo, fechasDespuesDe, finDelDiaEnZonaMs, anclaDeEspera, motivoSinAncla, tieneEsperaDespues,
  tieneCarril, esHiloDelCarril, minutosAntesDeReunion, decidirToqueDelCarril, seMueveEnLaCorrida, RELLENO_CONTROL,
} from '../lib/nutricion-grafo-motor';
import { validarGrafo, normalizar, textoEspera, indicePorId, ANCLAS_DESPUES, type PasoGrafo, type Espera } from '../lib/flujo-grafo';
import { problemasDeForma } from '../lib/flujo-forma';
import { iniciar, siguiente } from '../lib/simulador-grafo';
import { deIA, aIA, LISTA_BLANCA_IA, type CtxIA } from '../lib/flujo-ia';
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
  const antes = resolverControl(F, 0, { hechos: null, ahoraMs: T - 24 * H, reunionMs: null, fechasDespues: fechas });
  assert.equal(antes.tipo, 'esperar');
  assert.equal(antes.tipo === 'esperar' && antes.proximoMs, T + 3 * H);
  assert.equal(antes.tipo === 'esperar' && antes.idx, indicePorId(F, 'w1'));
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
  assert.match(motor, /if \(r\.tipo === 'sin_ancla'\) \{ await cerrar\(r\.motivo, true\); continue; \}/);
  assert.match(motor, /estado_lead, nutricion_manual_deadline'\)/, 'la fila del lead no trae el plazo');
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

// ⚠️ CREAR CON IA (23/10/2026): lib/flujo-ia.ts lo tiene Automations en vuelo, así que su parte del port de 5129d8dde
// (leer y escribir «despues_de» en deIA / aIA / parcheEspera) queda para su chat. Hasta entonces, editar con IA un flujo con
// una espera «después de» la vuelve «por tiempo». Cuando entre, se le saca el `todo`.
test('6. Crear con IA la lee y la escribe', { todo: 'Automations: el port de lib/flujo-ia.ts (5129d8dde)' }, () => {
  // Crear con IA: entra con «despues_de», sale igual (lo que el modelo lee de un flujo es lo que escribió).
  const acciones = LISTA_BLANCA_IA.map((id) => { const d = porId(id)!; return { id: d.id, titulo: d.titulo, parametros: d.parametros }; });
  const ctx: CtxIA = { etiquetas: [], productos: [], disparadores: [], audios: [], archivos: [], acciones, links: {} };
  const r = deIA({ inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'esperar', horas: 3, despues_de: 'reunion_1', sigue: 't2' },
    { id: 't2', tipo: 'esperar', horas: 2, despues_de: 'la boda', sigue: 't3' },
    { id: 't3', tipo: 'mensaje', texto: 'Hola {{nombre}}' },
  ] }, ctx, () => 0.5);
  const esperas = r.pasos.filter((p) => p.nodo === 'esperar').map((p) => p.espera);
  assert.deepEqual(esperas, [{ modo: 'despues_de', minutos: 180, de: 'reunion_1' }, { modo: 'tiempo', minutos: 120 }]);
  assert.ok(r.avisos.some((a) => a.includes('la boda')), `no avisó del «de» inventado: ${r.avisos.join(' | ')}`);
  const vuelta = aIA(r.pasos).tarjetas.find((t) => t.tipo === 'esperar' && t.horas === 3);
  assert.equal(vuelta?.despues_de, 'reunion_1');
  // ⚠️ El system de Crear con IA NO la describe (14/10/2026): con las dos condiciones nuevas del catálogo el prompt quedó
  // en ~3.998 de 4.000 tokens (tests/crear-ia-tercera.test.ts, «techo de Groq»), y la línea de «despues_de» lo pasaba a
  // ~4.029. Se lee y se escribe igual (lo de arriba): el modelo la ve en lo que lee de un flujo que ya la tiene.
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
