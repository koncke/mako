// Tests del planificador PURO del CRM automático (lib/crm-auto-plan.ts): las
// reglas T1/T2/T3/T6 que deciden cuándo MaKo mueve un lead solo. Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planLeadAuto, rotuloReunion, AUTO_UMBRALES, type AutoLead } from '../lib/crm-auto-plan';

const HOY = '2026-07-05';
const NOW = Date.parse('2026-07-05T20:00:00Z'); // 20:00 UTC del "hoy"

// created_at a N días exactos antes de HOY (para tests agnósticos al umbral).
const haceDias = (n: number) => {
  const d = new Date(Date.UTC(2026, 6, 5) - n * 86400000);
  return d.toISOString();
};

const AL = (p: Partial<AutoLead>): AutoLead => ({
  id: 1, nombre: 'Lead Test', estado_lead: 'abierto', pipeline_stage: null,
  fecha_agenda: null, fecha_junta_1: null, fecha_junta_2: null, junta_1_at: null, junta_2_at: null,
  asistio_j1: null, asistio_j2: null, nutricion_realizada: false, nutricion_manual_deadline: null,
  created_at: '2026-07-05T00:00:00Z', updated_at: null, ...p,
});
const reglas = (l: AutoLead) => planLeadAuto(l, HOY, NOW).map((a) => a.regla);

test('T2 — lead estancado en instant form sin agendar (>= 2 días) → No Agenda', () => {
  const reciente = haceDias(AUTO_UMBRALES.diasLeadSinAgenda + 1); // pasó el mínimo, todavía no frío
  const [a] = planLeadAuto(AL({ created_at: reciente }), HOY, NOW);
  assert.equal(a.regla, 'T2');
  assert.equal(a.move?.to, 'nutri');
  // Recién llegado (< 2 días) → no dispara.
  assert.deepEqual(reglas(AL({ created_at: haceDias(AUTO_UMBRALES.diasLeadSinAgenda - 1) })), []);
});

test('T2 — lead FRÍO sin agendar (>= diasSinAgendaFrio) → Reactivación, no No Agenda', () => {
  const frio = haceDias(AUTO_UMBRALES.diasSinAgendaFrio + 1);
  const [a] = planLeadAuto(AL({ created_at: frio }), HOY, NOW);
  assert.equal(a.regla, 'T2');
  assert.equal(a.move?.to, 'reactivacion'); // el fix: viejo → Reactivación
  // Justo por debajo del umbral de frío → sigue siendo No Agenda.
  const [b] = planLeadAuto(AL({ created_at: haceDias(AUTO_UMBRALES.diasSinAgendaFrio - 1) }), HOY, NOW);
  assert.equal(b.move?.to, 'nutri');
});

test('T2 — reclasifica un No-Agenda viejo (stage nutri) a Reactivación', () => {
  const frio = haceDias(AUTO_UMBRALES.diasSinAgendaFrio + 5);
  const [a] = planLeadAuto(AL({ pipeline_stage: 'nutri', nutricion_realizada: true, created_at: frio }), HOY, NOW);
  assert.equal(a?.regla, 'T2');
  assert.equal(a?.move?.to, 'reactivacion');
  // Un No-Agenda RECIENTE (< frío) se queda quieto (no lo saca de No Agenda).
  assert.deepEqual(
    reglas(AL({ pipeline_stage: 'nutri', nutricion_realizada: true, created_at: haceDias(AUTO_UMBRALES.diasSinAgendaFrio - 2) })),
    [],
  );
});

test('T1 — reunión pasada por FECHA (lead viejo sin hora)', () => {
  const acc = planLeadAuto(AL({ fecha_junta_1: '2026-07-03' }), HOY, NOW);
  assert.equal(acc.length, 1);
  assert.equal(acc[0].regla, 'T1');
  assert.equal(acc[0].which, 'j1');
  // Reunión de hoy (no pasó el día) → todavía no dispara.
  assert.deepEqual(reglas(AL({ fecha_junta_1: '2026-07-05' })), []);
});

test('T1 — precisión por HORA (junta_1_at): 3 h exactas', () => {
  // Reunión hace 5 h → ya pasaron las 3 h → dispara.
  assert.deepEqual(reglas(AL({ junta_1_at: '2026-07-05T15:00:00Z', fecha_junta_1: '2026-07-05' })), ['T1']);
  // Reunión hace 2 h → todavía no pasaron las 3 h → NO dispara (aunque sea el mismo día).
  assert.deepEqual(reglas(AL({ junta_1_at: '2026-07-05T18:00:00Z', fecha_junta_1: '2026-07-05' })), []);
});

test('T1 — R2: solo tras asistir R1 y con R2 pasada', () => {
  const acc = planLeadAuto(AL({ asistio_j1: true, fecha_junta_2: '2026-07-03' }), HOY, NOW);
  assert.equal(acc.length, 1);
  assert.equal(acc[0].which, 'j2');
});

test('T3 — nutrición manual vencida', () => {
  assert.deepEqual(reglas(AL({ pipeline_stage: 'manual', nutricion_manual_deadline: '2026-07-01' })), ['T3']);
  // Deadline en el futuro → no dispara.
  assert.deepEqual(reglas(AL({ pipeline_stage: 'manual', nutricion_manual_deadline: '2026-07-10' })), []);
});

test('T6 — reactivación de fríos (>= 30 días enfriado)', () => {
  assert.deepEqual(reglas(AL({ estado_lead: 'no_responde', updated_at: '2026-05-01T00:00:00Z' })), ['T6']);
  assert.deepEqual(reglas(AL({ estado_lead: 'perdido', updated_at: '2026-05-01T00:00:00Z' })), ['T6']);
  // Ya está en reactivación → no re-dispara.
  assert.deepEqual(reglas(AL({ estado_lead: 'no_responde', pipeline_stage: 'reactivacion', updated_at: '2026-05-01T00:00:00Z' })), []);
  // Recién enfriado (< 30 días) → no dispara.
  assert.deepEqual(reglas(AL({ estado_lead: 'no_responde', updated_at: '2026-07-01T00:00:00Z' })), []);
});

test('sin acciones para un lead sano en curso', () => {
  // Asistió R1, R2 futura sin marcar → nada que hacer (está en ventana positiva).
  assert.deepEqual(reglas(AL({ asistio_j1: true, fecha_junta_1: '2026-07-01', fecha_junta_2: '2026-07-10' })), []);
});

test('T2 no dispara si ya agendó (tiene fecha_agenda)', () => {
  assert.deepEqual(reglas(AL({ fecha_agenda: '2026-07-05', created_at: '2026-07-01T00:00:00Z' })), []);
});

// ---------------------------------------------------------------------------
// T1 nombra las reuniones como las llamó el DUEÑO en su embudo (tarjeta #40, punto a)
// ---------------------------------------------------------------------------
// El motor escribía «R1»/«R2» a mano. Un negocio que vende con UNA «1ª sesión sin
// costo» (ws11 y ws17, medido el 06/10/2026) no tiene ninguna «R1»: es el nombre
// interno de una columna nuestra. Los rótulos sólo cambian PALABRAS: `which` sigue
// siendo 'j1'/'j2', que es la llave anti-loop de mako_confirmaciones.

const LEAD_R1 = AL({ fecha_junta_1: '2026-07-03' });
const LEAD_R2 = AL({ asistio_j1: true, fecha_junta_2: '2026-07-03' });

test('T1 — con el rótulo del embudo, la descripción nombra la reunión del dueño y no dice R1', () => {
  const [a] = planLeadAuto(LEAD_R1, HOY, NOW, AUTO_UMBRALES, { j1: '1ª sesión sin costo' });
  assert.equal(a.regla, 'T1');
  assert.ok(a.descripcion.includes('1ª sesión sin costo'), `no nombra la reunión del dueño: ${a.descripcion}`);
  assert.ok(!/\bR1\b/.test(a.descripcion), `sigue diciendo R1: ${a.descripcion}`);
  assert.equal(
    a.descripcion,
    '1ª sesión sin costo del 2026-07-03 sin marcar → buscar grabación en Fathom: si aparece asistió (marca todo), si no No Show 1ª sesión sin costo',
  );
  // ⚠️ La llave NO cambia con el rótulo: de `which` cuelga la clave 'T1:j1'.
  assert.equal(a.which, 'j1');
  assert.equal(a.tipo, 'reunion_check');
});

test('T1 — rótulos parciales: la reunión que el embudo no nombra cae a R1/R2', () => {
  // Un embudo de UNA reunión no tiene `j2`: la R2 (si existiera) sigue diciendo R2.
  const [b] = planLeadAuto(LEAD_R2, HOY, NOW, AUTO_UMBRALES, { j1: '1ª sesión sin costo' });
  assert.equal(b.which, 'j2');
  assert.ok(b.descripcion.startsWith('R2 del 2026-07-03'), b.descripcion);
  assert.ok(b.descripcion.endsWith('si no No Show R2'), b.descripcion);
  // Y con las dos nombradas, la R2 usa el SUYO, no el de la R1.
  const [c] = planLeadAuto(LEAD_R2, HOY, NOW, AUTO_UMBRALES, { j1: 'Diagnóstico', j2: 'Cierre' });
  assert.equal(
    c.descripcion,
    'Cierre del 2026-07-03 sin marcar → buscar grabación en Fathom: si aparece asistió → Facturando, si no No Show Cierre',
  );
});

test('T1 — SIN rótulos el resultado es IDÉNTICO al de siempre', () => {
  const R1_HOY = 'R1 del 2026-07-03 sin marcar → buscar grabación en Fathom: si aparece asistió (marca todo), si no No Show R1';
  const R2_HOY = 'R2 del 2026-07-03 sin marcar → buscar grabación en Fathom: si aparece asistió → Facturando, si no No Show R2';
  assert.equal(planLeadAuto(LEAD_R1, HOY, NOW)[0].descripcion, R1_HOY);
  assert.equal(planLeadAuto(LEAD_R2, HOY, NOW)[0].descripcion, R2_HOY);
  // Ausente, vacío, en blanco o null: los cuatro son «el embudo no la nombró».
  for (const rot of [undefined, null, {}, { j1: '', j2: '' }, { j1: '   ', j2: '\t' }]) {
    assert.deepEqual(planLeadAuto(LEAD_R1, HOY, NOW, AUTO_UMBRALES, rot), planLeadAuto(LEAD_R1, HOY, NOW), `rot=${JSON.stringify(rot)}`);
    assert.deepEqual(planLeadAuto(LEAD_R2, HOY, NOW, AUTO_UMBRALES, rot), planLeadAuto(LEAD_R2, HOY, NOW), `rot=${JSON.stringify(rot)}`);
  }
  assert.equal(rotuloReunion('j1'), 'R1');
  assert.equal(rotuloReunion('j2'), 'R2');
  assert.equal(rotuloReunion('j1', { j1: '  1ª sesión  ' }), '1ª sesión', 'el rótulo va recortado');
});

test('T1 — los rótulos no tocan a las otras reglas', () => {
  const rot = { j1: '1ª sesión sin costo', j2: 'Cierre' };
  for (const l of [
    AL({ created_at: haceDias(AUTO_UMBRALES.diasLeadSinAgenda + 1) }),
    AL({ pipeline_stage: 'manual', nutricion_manual_deadline: '2026-07-01' }),
    AL({ estado_lead: 'no_responde', updated_at: '2026-05-01T00:00:00Z' }),
  ]) {
    assert.deepEqual(planLeadAuto(l, HOY, NOW, AUTO_UMBRALES, rot), planLeadAuto(l, HOY, NOW));
  }
});

// Lo de arriba prueba el planificador; esto, que el MOTOR (lib/crm-auto.ts) lo use. Un
// quinto parámetro opcional sin call site compila, pasa los tests y no cambia una letra
// de lo que lee el dueño. Se lee el fuente SIN comentarios: el comentario del motor cita
// justamente «R1»/«R2» y 'T1:j1' para explicar por qué no se tocan.
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')    // las líneas PRIMERO
  .replace(/\/\*[\s\S]*?\*\//g, '');  // y los bloques después
const MOTOR = sinComentarios(readFileSync(new URL('../lib/crm-auto.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n'));

/** El bloque de la regla T1 de `aplicarAccion`, hasta donde arranca T3. */
const T1_MOTOR = (() => {
  const ini = MOTOR.indexOf("if (a.tipo === 'reunion_check')");
  const fin = MOTOR.indexOf("if (a.tipo === 'manual_vencida')", ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré el bloque de T1 en aplicarAccion');
  return MOTOR.slice(ini, fin);
})();

test('CABLEADO: el motor le pasa los rótulos del embudo al planificador', () => {
  assert.match(MOTOR, /planLeadAuto\(l, hoyISO, nowMs, umbrales, rotulos\)/, 'evaluarAutoWorkspace no le pasa los rótulos: la descripción vuelve a decir R1/R2');
  assert.match(MOTOR, /const rotulos = \(await etapasDelWs\(\)\)\?\.reuniones;/, 'los rótulos salen de la caché del embudo');
  // Las reuniones se cuentan con la fuente única del mapeo índice → j1/j2.
  assert.match(MOTOR, /reunionesDe\(stages\)/, 'etapasDelWs tiene que contar las reuniones con reunionesDe (lib/funnel-etapas.ts)');
});

test('CABLEADO: la regla T1 del motor no escribe R1/R2 a mano, y la llave sigue en `which`', () => {
  assert.ok(T1_MOTOR.length < 6000, `el recorte mide ${T1_MOTOR.length}: está mirando otra cosa`);
  assert.match(T1_MOTOR, /const reunion = rotuloReunion\(which, \(await etapasDelWs\(\)\)\?\.reuniones\);/);
  const aMano = T1_MOTOR.match(/\bR[12]\b/g) ?? [];
  assert.equal(aMano.length, 0, `quedaron ${aMano.length} «R1»/«R2» escritos a mano en T1`);
  // ⚠️ Lo que NO se toca: la clave anti-loop, las columnas y las etapas de No Show.
  assert.match(T1_MOTOR, /const clave = `T1:\$\{which\}`;/, 'la clave anti-loop tiene que seguir siendo T1:j1/T1:j2');
  assert.match(T1_MOTOR, /which === 'j1' \? 'asistio_j1' : 'asistio_j2'/);
  assert.match(T1_MOTOR, /which === 'j1' \? 'noshow_r1' : 'noshow_r2'/);
  assert.ok(!/clave[^\n]*reunion/.test(T1_MOTOR), 'la clave no puede colgar del rótulo');
});

// Verificado rompiéndolo el 06/10/2026, una rotura por vez y restaurando cada una de
// memoria (16 tests en total; en verde: 16 pases, 0 fallos):
//   · la descripción de la R1 con `'R1'` fijo en vez del rótulo        → 1 fallo, 15 pases
//   · el fallback de rotuloReunion en «Reunión 1» en vez de «R1»       → 1 fallo, 15 pases
//   · rotuloReunion sin el `.trim()` (un rótulo en blanco ganaba)      → 1 fallo, 15 pases
//   · la R2 nombrada con el rótulo de la R1                            → 2 fallos, 14 pases
//   · evaluarAutoWorkspace sin pasarle `rotulos` + un título de T1
//     con `'R1' : 'R2'` a mano (las dos juntas, cada una tumbó su test) → 2 fallos, 14 pases
//   · la clave anti-loop derivada del rótulo (`T1:${reunion}`)         → 1 fallo, 15 pases
//   · etapasDelWs contando reuniones con su propio filtro por `kind`   → 1 fallo, 15 pases
// ⚠️ Los tests viejos de T1 de este archivo NO miraban la descripción: con el fallback
// cambiado daban verde los diez. El «idéntico a hoy» lo fija sólo el test de arriba.
