// =============================================================================
// CUÁNDO TERMINÓ UNA REUNIÓN es UNA regla (24/10/2026, M3 y M6 de la revisión del b5): la espera «N después de la
// reunión» y las condiciones «Asistencia sin marcar» / «Su reunión sigue en pie» miran el MISMO instante
// =============================================================================
// Los marcó el chat de CRM en la revisión del b5 («para Automations: tocan flujos en producción»). Hasta hoy la espera
// contaba desde `anclaDeReunion` (lib/nutricion-grafo-motor.ts: una fecha sin hora, el final de SU día en la zona del
// NEGOCIO; una fecha editada a mano, manda la fecha) y la condición desde `lugarDeFicha` con su propia regla
// (`finDeLaReunionMs(at ?? fecha)`: el final del día de MÉXICO, y la hora vieja). Con las dos reglas:
//
//   M3. Al este de México (7 negocios en Buenos Aires, Salta, Asunción, Cancún, Madrid), con una fecha SIN hora, durante
//       la diferencia horaria la condición daba «no sé»: «1 h después de la reunión» en Buenos Aires vencía a las
//       03:59:59Z y la reunión recién «pasaba» a las 05:59:59Z. El hilo salía por «si no» y la pregunta no salía NUNCA
//       (la plantilla «Una Reunión Sin Marcar» con sus 3 h, en Madrid: 7 h de diferencia).
//   M6. Con la fecha ADELANTADA a mano (la ficha escribe `fecha_junta_X` y nunca `junta_X_at`), la espera vencía por la
//       fecha nueva y la condición miraba la hora vieja, futura: «no sé», y la reunión real no se preguntaba nunca.
//
// Lo que se fija (ejecutando lo puro, salvo el cableado del lector):
//   1. el `finMs` de la ficha ES el ancla de la espera, para cada forma de la reunión y cada zona;
//   2. M3: la plantilla con «1 h después» en Buenos Aires y la de 3 h en Madrid avisan al vencer la espera (y al oeste
//      de México, igual que antes);
//   3. en el borde, «sigue en pie» y «sin marcar» se pasan la posta en el mismo segundo (nunca los dos «no»);
//   4. M6: con la fecha adelantada a mano, avisa por la fecha nueva (las dos veces); atrasada, igual que antes;
//   5. el lector del motor le pasa a la condición la MISMA zona que al ancla (`zonaDeLaReunion`).
//
// Medido en producción el 24/10/2026 (solo lectura): NINGUNA automatización usa «Asistencia sin marcar» ni la espera
// «después de» (ni en `pasos` ni en `pasos_borrador`, 522 secuencias); «Su reunión sigue en pie» la usa UNA activa (#213
// del ws1, Tijuana), delante de TRES tarjetas: el aviso al equipo, el audio y la IA (con la fecha atrasada a mano pasan
// a salir; hoy, 0 casos). Ver docs/hallazgos-chatbot.md → «La espera "después de"», el punto «Cuándo terminó la reunión».
//
// PROBADO ROMPIÉNDOLO (24/10/2026): ver «ROTURAS» al pie.
//
// Correr: node --import tsx --test tests/reunion-termino-una-regla.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogoDeLead, fechasDespuesDe, anclaDeEspera, resolverControl, siguienteIndice, type FilaLeadCatalogo } from '../lib/nutricion-grafo-motor';
import { cumpleCatalogo } from '../lib/condiciones-catalogo';
import { plantillaPorId, pasosDePlantilla } from '../lib/plantillas-automatizaciones';
import { normalizar, raizSalida, indicePorId, type PasoGrafo, type HechosLead } from '../lib/flujo-grafo';
import { conEtapasDelCron, type Disparador } from '../lib/disparadores';
import { hoyEnTz } from '../lib/date-utils';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const MX = 'America/Mexico_City';
const BA = 'America/Argentina/Buenos_Aires';
const MADRID = 'Europe/Madrid';
const TIJUANA = 'America/Tijuana';
const H = 3_600_000;
const DIA = 24 * H;
const iso = (ms: number) => new Date(ms).toISOString();

const CRON: Disparador[] = [{ id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agenda', etapas: null, funnel_id: 5 }];
/** Los hechos del lead como los arma el motor: el catálogo con el día y la zona del negocio, y el CRON. */
function hechos(fila: FilaLeadCatalogo, ahora: number, tz: string): HechosLead {
  return conEtapasDelCron({
    etiquetas: new Set(), etapa: 'agenda', etapasPorProducto: new Map([[5, 'agenda']]), agendo: true, pago: false,
    yaContactado: false, respondio: false, creadoMs: null, tieneTelefono: true, tieneEmail: false, ahoraMs: ahora,
    catalogo: { lead: catalogoDeLead(fila, ahora, hoyEnTz(tz, new Date(ahora)), tz) },
  }, CRON);
}

/** «Una Reunión Sin Marcar», con la espera de N minutos «después de la reunión» (la de la galería son 180). */
function plantilla(minutos = 180): PasoGrafo[] {
  const p = plantillaPorId('reunion-sin-marcar')!;
  return normalizar(pasosDePlantilla(p).map((x) => (x.id === 'rm_e' && x.espera?.modo === 'despues_de' ? { ...x, espera: { ...x.espera, minutos } } : x)));
}

/**
 * CORRE EL FLUJO como el motor (las vueltas de `correr`, tests/plantillas-crm-auto.test.ts): `resolverControl` con los
 * hechos de cada instante y las fechas de `fechasDespuesDe` en la MISMA zona; cada tarjeta que sale, con su hora.
 */
function avisos(pasos: readonly PasoGrafo[], fila: FilaLeadCatalogo, tz: string, desde: number, hasta: number): string[] {
  const out: string[] = [];
  let idx = indicePorId(pasos, raizSalida(pasos));
  let ahora = desde;
  for (let vuelta = 0; vuelta < 40 && idx >= 0; vuelta++) {
    const r = resolverControl(pasos, idx, { hechos: hechos(fila, ahora, tz), ahoraMs: ahora, reunionMs: null, fechasDespues: fechasDespuesDe(fila, tz) });
    if (r.tipo === 'esperar') { if (r.proximoMs > hasta) break; ahora = r.proximoMs; idx = r.idx; continue; }
    if (r.tipo !== 'nodo') break;
    out.push(`${pasos[r.idx].id}@${iso(ahora)}`);
    idx = siguienteIndice(pasos, r.idx);
  }
  return out;
}

const SIN_MARCAR = { campo: 'asistencia_sin_marcar' };
const EN_PIE = { campo: 'reunion_en_pie' };
/** El veredicto de «Asistencia sin marcar»: true / false, o «no sé» (ni la afirmada ni la negada). */
function sinMarcar(fila: FilaLeadCatalogo, ahora: number, tz: string): boolean | 'no sé' {
  const h = hechos(fila, ahora, tz);
  const si = cumpleCatalogo(SIN_MARCAR, h);
  const no = cumpleCatalogo({ ...SIN_MARCAR, no: true }, h);
  return si ? true : no ? false : 'no sé';
}

test('1. UNA regla: el `finMs` de la ficha ES el ancla de la espera, en cada forma de la reunión y en cada zona', () => {
  const formas: Array<[string, FilaLeadCatalogo]> = [
    ['con hora', { junta_1_at: '2026-10-14T15:00:00Z', fecha_junta_1: '2026-10-14' }],
    ['sin hora', { fecha_junta_1: '2026-10-14' }],
    ['la R2 sin hora', { junta_1_at: '2026-10-07T15:00:00Z', fecha_junta_1: '2026-10-07', asistio_j1: true, fecha_junta_2: '2026-10-14' }],
    ['adelantada a mano', { junta_1_at: '2026-10-20T15:00:00Z', fecha_junta_1: '2026-10-14' }],
    ['atrasada a mano', { junta_1_at: '2026-10-14T15:00:00Z', fecha_junta_1: '2026-10-20' }],
    ['la R2 adelantada a mano', { fecha_junta_2: '2026-10-14', junta_2_at: '2026-10-21T15:00:00Z' }],
    ['cancelada', { junta_1_at: '2026-10-14T15:00:00Z', fecha_junta_1: null }],
    ['la hora sin la fecha leída', { junta_1_at: '2026-10-14T15:00:00Z' }],
    ['sin reunión', {}],
  ];
  const ahora = Date.parse('2026-10-10T12:00:00Z');
  for (const tz of [MX, BA, MADRID, TIJUANA, 'America/Cancun']) {
    for (const [nombre, fila] of formas) {
      const ficha = catalogoDeLead(fila, ahora, null, tz);
      const f = fechasDespuesDe(fila, tz);
      assert.equal(ficha.r1.finMs ?? null, f.r1, `${nombre} (${tz}): la R1 de la condición no es la de la espera`);
      assert.equal(ficha.r2.finMs ?? null, f.r2, `${nombre} (${tz}): la R2 de la condición no es la de la espera`);
    }
  }
  // SIN ZONA (el motor siempre la manda: sólo la llamaba sin ella scripts/migrar-cron-de-antes.mts, retirado) NO ES
  // «como antes» del todo (revisión, 24/10/2026). Una fecha sin hora sí: el final del día de México, lo que daba antes.
  assert.equal(iso(catalogoDeLead({ fecha_junta_1: '2026-10-14' }, ahora).r1.finMs!), '2026-10-15T05:59:59.000Z');
  // Pero `fechaCoincide` mira la fecha sólo en Tijuana: el «reagendar» de Buenos Aires el 15 a las 00:30 (en Tijuana, el
  // 14) cuenta como editado a mano y cierra al final del 15 de México (antes, a su hora). Con la zona, su hora.
  const reagendadaEnBA: FilaLeadCatalogo = { junta_1_at: '2026-10-15T03:30:00Z', fecha_junta_1: '2026-10-15' };
  assert.equal(iso(catalogoDeLead(reagendadaEnBA, ahora).r1.finMs!), '2026-10-16T05:59:59.000Z', 'sin zona, la fecha que no coincide en Tijuana manda');
  assert.equal(iso(catalogoDeLead(reagendadaEnBA, ahora, null, BA).r1.finMs!), '2026-10-15T03:30:00.000Z');
});

test('2. M3: al este de México avisa cuando vence la espera (1 h en Buenos Aires, 3 h en Madrid); al oeste, como antes', () => {
  const desde = Date.parse('2026-10-14T12:00:00Z');
  // Buenos Aires, «1 h después», la R1 del 14 sin hora: el día termina a las 02:59:59Z del 15 → la pregunta a las 03:59:59Z.
  assert.deepEqual(avisos(plantilla(60), { estado_lead: 'abierto', fecha_junta_1: '2026-10-14' }, BA, desde, desde + 10 * DIA),
    ['rm_mk@2026-10-15T03:59:59.000Z', 'rm_mk2@2026-10-17T03:59:59.000Z'], 'Buenos Aires con 1 h: la pregunta no sale');
  assert.equal(sinMarcar({ fecha_junta_1: '2026-10-14' }, Date.parse('2026-10-15T03:59:59Z'), BA), true, 'hasta las 05:59:59Z decía «no sé»');
  // Madrid, la plantilla de la galería (3 h), el 24 sin hora (el día antes del cambio de horario: termina a las 21:59:59Z).
  const enMadrid = Date.parse('2026-10-24T08:00:00Z');
  assert.deepEqual(avisos(plantilla(), { estado_lead: 'abierto', fecha_junta_1: '2026-10-24' }, MADRID, enMadrid, enMadrid + 10 * DIA),
    ['rm_mk@2026-10-25T00:59:59.000Z', 'rm_mk2@2026-10-27T00:59:59.000Z'], 'Madrid con 3 h: la pregunta no sale');
  // México y al oeste (Tijuana, la zona por defecto): salía y sigue saliendo, a la hora del día del negocio.
  assert.deepEqual(avisos(plantilla(60), { estado_lead: 'abierto', fecha_junta_1: '2026-10-14' }, MX, desde, desde + 3 * DIA), ['rm_mk@2026-10-15T06:59:59.000Z', 'rm_mk2@2026-10-17T06:59:59.000Z']);
  assert.deepEqual(avisos(plantilla(60), { estado_lead: 'abierto', fecha_junta_1: '2026-10-14' }, TIJUANA, desde, desde + 3 * DIA), ['rm_mk@2026-10-15T07:59:59.000Z', 'rm_mk2@2026-10-17T07:59:59.000Z']);
  // Con hora, la hora (nada cambia): a la hora + 1 h, en cualquier zona.
  assert.deepEqual(avisos(plantilla(60), { estado_lead: 'abierto', junta_1_at: '2026-10-14T15:00:00Z', fecha_junta_1: '2026-10-14' }, BA, desde, desde + 1 * DIA), ['rm_mk@2026-10-14T16:00:00.000Z']);
});

test('3. en el borde, «sigue en pie» y «sin marcar» se pasan la posta en el MISMO segundo (nunca «no» a las dos)', () => {
  const fila: FilaLeadCatalogo = { fecha_junta_1: '2026-10-14' };
  for (const tz of [BA, MADRID, MX, TIJUANA]) {
    const fin = fechasDespuesDe(fila, tz).r1!;
    for (const t of [fin - 3 * H, fin - 1_000, fin, fin + 1_000, fin + 3 * H]) {
      const enPie = cumpleCatalogo(EN_PIE, hechos(fila, t, tz));
      const sm = sinMarcar(fila, t, tz);
      assert.equal(enPie, t < fin, `${tz} ${iso(t)}: «sigue en pie» dice ${enPie}`);
      assert.equal(sm, t < fin ? 'no sé' : true, `${tz} ${iso(t)}: «sin marcar» dice ${String(sm)}`);
    }
  }
});

test('4. M6: con la fecha ADELANTADA a mano pregunta por la fecha nueva (las dos veces); atrasada, la pregunta como antes y «sigue en pie» hasta el día nuevo', () => {
  const desde = Date.parse('2026-10-14T12:00:00Z');
  // La R1 era el 20 a las 15:00Z; alguien la pasó al 14 en la ficha (la hora quedó vieja). La del 14 terminó a las
  // 05:59:59Z del 15 en México: la pregunta a las 08:59:59Z, y la segunda a los 2 días.
  const adelantada: FilaLeadCatalogo = { estado_lead: 'abierto', junta_1_at: '2026-10-20T15:00:00Z', fecha_junta_1: '2026-10-14' };
  assert.deepEqual(avisos(plantilla(), adelantada, MX, desde, desde + 10 * DIA), ['rm_mk@2026-10-15T08:59:59.000Z', 'rm_mk2@2026-10-17T08:59:59.000Z'],
    'la condición miraba la hora vieja (el 20): «no sé», y la reunión real no se preguntaba');
  assert.equal(sinMarcar(adelantada, Date.parse('2026-10-15T08:59:59Z'), MX), true);
  // Ya marcada (vino o no vino): no pregunta, con la fecha editada igual.
  assert.deepEqual(avisos(plantilla(), { ...adelantada, asistio_j1: false }, MX, desde, desde + 10 * DIA), []);
  // Atrasada a mano (la hora vieja ya pasó): la espera vence por la fecha nueva y la condición también lo ve (salía igual).
  const atrasada: FilaLeadCatalogo = { estado_lead: 'abierto', junta_1_at: '2026-10-14T15:00:00Z', fecha_junta_1: '2026-10-20' };
  assert.deepEqual(avisos(plantilla(), atrasada, MX, desde, desde + 12 * DIA), ['rm_mk@2026-10-21T08:59:59.000Z', 'rm_mk2@2026-10-23T08:59:59.000Z']);
  // Y «sigue en pie» hasta el final del día nuevo, no hasta la hora vieja. ⚠️ Esto SÍ cambia lo que sale (revisión,
  // 24/10/2026): en #213 del ws1 «Sigue en pie» va delante del aviso al equipo, el audio y la IA, que con la atrasada
  // pasan de «nada» a salir; el aviso, sin su renglón «Nuevo agendado» (docs/hallazgos-chatbot.md, «Cuándo terminó…»).
  assert.equal(cumpleCatalogo(EN_PIE, hechos(atrasada, Date.parse('2026-10-18T12:00:00Z'), MX)), true, 'atrasada: la reunión del 20 sigue en pie');
  assert.equal(cumpleCatalogo(EN_PIE, hechos(adelantada, Date.parse('2026-10-16T12:00:00Z'), MX)), false, 'adelantada: la del 14 ya pasó');
});

test('5. el lector del motor le pasa a la condición la MISMA zona que al ancla de la espera', () => {
  const src = sinComentarios(leer('lib/nutricion.ts'));
  assert.match(src, /const zonaCarril = async \(\): Promise<string> => \(tzCarril \?\?= await zonaDeLaReunion\(\)\);/);
  assert.match(src, /fechasDespuesDe\(lead, await zonaCarril\(\)\)/, 'el ancla de la espera ya no lee la zona del negocio');
  assert.match(src, /hoy, zona, reuniones, \[social, sigue\]\] = await Promise\.all\(\[[\s\S]*?leerHoy\(\),\s*zonaDeLaReunion\(\), leerReuniones\(\)/);
  assert.match(src, /lead: catalogoDeLead\(f, ahoraMs, hoy \|\| null, zona\)/, 'la condición no recibe la zona del negocio');
});

// ── ROTURAS (24/10/2026) ───────────────────────────────────────────────────────────────────────────
// Una por vez (reemplazar el texto, correr este archivo y los vecinos —condiciones-crm-auto, condicion-reunion-en-pie,
// espera-despues-de, plantillas-crm-auto—, devolverlo de memoria con un script node que guarda el original en una
// variable y lo reescribe en un finally). Base 5 pasan / 0 fallan (vecinos 6/0, 5/0, 9/0, 10/0). Pasan / fallan:
//   R1. `lugarDeFicha` con la regla de antes (`finDeLaReunionMs(x)`: México y la hora vieja)      → 1 / 4 (1, 2, 3, 4)
//   R2. `lugarDeFicha` sin la zona (`anclaDeReunion(at, fecha, null)`): sólo M3                  → 2 / 3 (1, 2, 3)
//   R3. `lugarDeFicha` con la hora aunque la fecha no coincida (`at ? msJunta(at) : …`): sólo M6 → 3 / 2 (1, 4)
//   R4. `catalogoDeLead` sin la zona en la R2 (`lugarDeFicha(…asistio_j2, null)`)                 → 4 / 1 (1)
//   R5. el lector sin la zona (`catalogoDeLead(f, ahoraMs, hoy || null)`)                         → 4 / 1 (5), y la 6 de
//       tests/condiciones-crm-auto.test.ts (5 / 1)
//   R6. [revisión, 24/10] SIN zona «como antes» exacto (`tz ? anclaDeReunion(…) : finDeLaReunionMs(x)`) → 4 / 1 (1: la
//       reunión reagendada en Buenos Aires, que sin zona cierra por la fecha)
// Ninguna rotura la ve un vecino salvo R5: los vecinos corren SIN zona (o en México), donde las dos reglas coinciden.
// Corridas otra vez el 24/10 con R6 (la base: 5/0 y los vecinos 6/0, 5/0, 9/0, 10/0, motor-carril-recordatorio 8/0):
// R1 a R5 dan lo mismo de arriba.
