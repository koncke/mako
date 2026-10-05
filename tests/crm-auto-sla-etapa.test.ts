// =============================================================================
// El PLAZO por etapa del CRM automático, y el aviso de que un lead se estancó
// =============================================================================
// Las dos mitades del paquete #800. La primera: el plazo colgaba de las cuatro
// perillas GLOBALES de lib/crm-auto.ts y ahora puede colgar de una etapa del embudo
// (`funnels.data.umbrales.porEtapa`). La segunda: el motor movía y nadie se enteraba.
//
// ⚠️ DOS SUJETOS, NO UNO. Con un solo workspace, una resolución cableada al umbral
// global —`plazoDeEtapa` devolviendo siempre su tercer argumento— pasa casi todas las
// pruebas. Medido: devolviendo `global` a secas quedan 4 fallos y 9 pases, y los 9 que
// siguen en VERDE son justamente los del workspace que no declaró nada más los del
// saneo y el aviso. Los 4 que caen sólo pueden existir con el segundo sujeto.
//
// ⚠️ PROBADO ROMPIÉNDOLO, con los números (13 tests):
//   · `plazoDeEtapa` → `return global`                        → 4 fallos, 9 pases
//   · el `Math.max(plazoEtapa, diasSinAgendaFrio)` de T2 → `diasSinAgendaFrio`
//                                                             → 1 fallo, 12 pases
//   · T6 volviendo a `d >= umbrales.diasReactivacion`         → 2 fallos, 11 pases
//   · `sanearPlazosPorEtapa` sin el cruce contra las etapas   → 1 fallo, 12 pases
//   · `resumenEstancados` devolviendo el conteo sin la etapa  → 1 fallo, 12 pases
//   · el motor empujando TODAS las acciones (también los 'skip') al aviso
//                                                             → 1 fallo, 12 pases
// Cada rotura tira un test distinto: ninguno mide de prestado. La de T6 tira dos —el
// de la regla y el del cableado, que cuenta los call sites de `plazoDeEtapa`— y eso es
// lo correcto: son dos preguntas y la segunda es la que caza que la regla se desenchufe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  planLeadAuto, plazoDeEtapa, sanearPlazosPorEtapa, resumenEstancados,
  AUTO_UMBRALES, type AutoLead, type AutoUmbrales,
} from '../lib/crm-auto-plan';
import { CATALOGO_AVISOS, areaDeAviso } from '../lib/avisos-catalogo';
import { AVISOS_AGRUPABLES } from '../lib/avisos-agrupables';
import { AVISOS_WA_EN_VIVO } from '../lib/notif-catalogo';

const HOY = '2026-07-05';
const NOW = Date.parse('2026-07-05T20:00:00Z');

const haceDias = (n: number) => new Date(Date.UTC(2026, 6, 5) - n * 86400000).toISOString();

const AL = (p: Partial<AutoLead>): AutoLead => ({
  id: 1, nombre: 'Lead Test', estado_lead: 'abierto', pipeline_stage: null,
  fecha_agenda: null, fecha_junta_1: null, fecha_junta_2: null, junta_1_at: null, junta_2_at: null,
  asistio_j1: null, asistio_j2: null, nutricion_realizada: false, nutricion_manual_deadline: null,
  created_at: '2026-07-05T00:00:00Z', updated_at: null, ...p,
});

// ── LOS DOS SUJETOS ─────────────────────────────────────────────────────────
// `SIN` es el workspace que nunca tocó nada: tiene que ver EXACTAMENTE lo que ve hoy.
// `CON` declaró un plazo para dos etapas de su embudo.
const SIN: AutoUmbrales = AUTO_UMBRALES;
const CON: AutoUmbrales = { ...AUTO_UMBRALES, porEtapa: { lead: 5, noresp: 10 } };

const plan = (l: AutoLead, u: AutoUmbrales) => planLeadAuto(l, HOY, NOW, u);

// ---------------------------------------------------------------------------
// El plazo por etapa
// ---------------------------------------------------------------------------

test('El workspace que NO declaró nada se mueve en los mismos días de siempre', () => {
  // Es la mitad que ninguna feature nueva puede romper: sin plazo declarado, los dos
  // cortes de T2 quedan donde están (2 días → No Agenda, 7 → frío).
  const [aDos] = plan(AL({ created_at: haceDias(2) }), SIN);
  assert.equal(aDos.move?.to, 'nutri');
  assert.equal(aDos.plazoDias, AUTO_UMBRALES.diasLeadSinAgenda);
  assert.deepEqual(plan(AL({ created_at: haceDias(1) }), SIN), []);
  const [aSiete] = plan(AL({ created_at: haceDias(7) }), SIN);
  assert.equal(aSiete.move?.to, 'reactivacion');
});

test('El workspace que declaró «Lead entrante: 5 días» no se mueve a los 2', () => {
  assert.deepEqual(plan(AL({ created_at: haceDias(2) }), CON), [], 'a los 2 días el plazo declarado todavía no se cumplió');
  assert.deepEqual(plan(AL({ created_at: haceDias(4) }), CON), []);
  const [a] = plan(AL({ created_at: haceDias(5) }), CON);
  assert.equal(a.move?.to, 'nutri');
  assert.equal(a.plazoDias, 5, 'el plazo que viaja en la acción es el DECLARADO, no el global');
  assert.equal(a.desde, 'lead');
});

test('⚠️ EL PLAZO DECLARADO ES EL PISO: no lo pisa el corte de frío', () => {
  // Con `lead: 10` y el frío global en 7, la versión ingenua movería el lead a
  // Reactivación a los 7 días — o sea que el plazo declarado sería una promesa que el
  // motor no cumple. El `Math.max` es lo que lo evita.
  const diez: AutoUmbrales = { ...AUTO_UMBRALES, porEtapa: { lead: 10 } };
  assert.deepEqual(plan(AL({ created_at: haceDias(8) }), diez), [], 'a los 8 días no sale nada de Lead entrante');
  const [a] = plan(AL({ created_at: haceDias(10) }), diez);
  assert.equal(a.move?.to, 'reactivacion', 'cumplido el plazo y pasado el frío, va directo a Reactivación');
  assert.equal(a.plazoDias, 10);
});

test('T6 — el plazo de la etapa de salida manda sobre los 30 días globales', () => {
  const frio = AL({ estado_lead: 'no_responde', pipeline_stage: 'noresp', updated_at: haceDias(12) });
  // Sin declarar: 12 días todavía no llegan a los 30 de siempre.
  assert.deepEqual(plan(frio, SIN), []);
  // Declarando `noresp: 10`: a los 12 ya se reactiva.
  const [a] = plan(frio, CON);
  assert.equal(a.regla, 'T6');
  assert.equal(a.desde, 'noresp');
  assert.equal(a.plazoDias, 10);
  // Y por debajo del plazo declarado sigue quieto.
  assert.deepEqual(plan(AL({ estado_lead: 'no_responde', pipeline_stage: 'noresp', updated_at: haceDias(9) }), CON), []);
});

test('Un plazo declarado sobre una etapa AJENA no mueve nada de otra etapa', () => {
  // El plazo es de `lead`; un lead en `noresp` no lo hereda.
  const soloLead: AutoUmbrales = { ...AUTO_UMBRALES, porEtapa: { lead: 1 } };
  assert.deepEqual(plan(AL({ estado_lead: 'no_responde', pipeline_stage: 'noresp', updated_at: haceDias(12) }), soloLead), []);
});

test('plazoDeEtapa cae al global ante todo lo que no sea un número útil', () => {
  assert.equal(plazoDeEtapa('lead', { lead: 5 }, 2), 5);
  assert.equal(plazoDeEtapa('lead', {}, 2), 2);
  assert.equal(plazoDeEtapa('lead', null, 2), 2);
  assert.equal(plazoDeEtapa(null, { lead: 5 }, 2), 2);
  assert.equal(plazoDeEtapa('lead', { lead: 0 }, 2), 2);
  assert.equal(plazoDeEtapa('lead', { lead: -3 }, 2), 2);
  assert.equal(plazoDeEtapa('lead', { lead: Number.NaN }, 2), 2);
});

// ---------------------------------------------------------------------------
// El saneo: lo que se descarta queda escrito
// ---------------------------------------------------------------------------

test('Lo que el saneo DESCARTA vuelve con su motivo', () => {
  const etapas = new Set(['lead', 'nutri', 'noresp']);
  const r = sanearPlazosPorEtapa({ lead: 5, agenda: 9, nutri: 'x', noresp: -1 }, etapas);
  assert.deepEqual(r.plazos, { lead: 5 });
  assert.equal(r.descartes.length, 3);
  assert.ok(r.descartes.some((d) => d.startsWith('agenda:')), 'la etapa que el embudo no tiene se nombra');
  assert.ok(r.descartes.some((d) => d.startsWith('nutri:')), 'el valor que no es un número se nombra');
});

test('⚠️ SIN EMBUDO LEÍDO NO SE DESCARTA NADA: un chequeo que no puede mirar se abstiene', () => {
  // Descartar acá apagaría todos los plazos del cliente por una falla de LECTURA.
  const r = sanearPlazosPorEtapa({ lead: 5, agenda: 9 }, null);
  assert.deepEqual(r.plazos, { lead: 5, agenda: 9 });
  assert.deepEqual(r.descartes, []);
});

test('Un `porEtapa` que no es un objeto no tira: devuelve vacío', () => {
  for (const v of [undefined, null, 7, 'cinco', [1, 2]]) {
    assert.deepEqual(sanearPlazosPorEtapa(v).plazos, {}, `${JSON.stringify(v)} tiene que dar {}`);
  }
});

// ---------------------------------------------------------------------------
// El aviso
// ---------------------------------------------------------------------------

test('⚠️ UN MENSAJE POR CORRIDA, y nombra la etapa como la ve el dueño', () => {
  // 30 leads movidos son 30 WhatsApps si el aviso vive adentro del loop.
  const etiqueta = (k: string) => ({ lead: 'Lead entrante', noresp: 'No responde' }[k] ?? k);
  const texto = resumenEstancados([
    { regla: 'T2', desde: 'lead', plazoDias: 5 },
    { regla: 'T2', desde: 'lead', plazoDias: 5 },
    { regla: 'T6', desde: 'noresp', plazoDias: 10 },
  ], etiqueta)!;
  assert.match(texto, /3 leads/);
  assert.match(texto, /2 de \*Lead entrante\* \(plazo 5 días\)/);
  assert.match(texto, /1 de \*No responde\* \(plazo 10 días\)/);
  // El nombre INTERNO no sale nunca: quien abre el WhatsApp no tiene de dónde sacarlo.
  assert.ok(!texto.includes('noresp'), `la key interna no puede salir a pantalla: ${texto}`);
  assert.ok(!texto.includes('"lead"'), 'ni la key de la etapa de entrada');
});

test('El aviso NO afirma lo que no se midió', () => {
  // Nada aplicado → no hay mensaje. Un «moví 0 leads» es ruido en la bandeja del dueño.
  assert.equal(resumenEstancados([]), null);
  // Una acción sin etapa de origen no se puede contar: no se sabe de dónde salió.
  assert.equal(resumenEstancados([{ regla: 'T2' }]), null);
  // Y un solo lead se escribe en singular (un mensaje automático que no concuerda se
  // lee como que lo escribió una máquina rota).
  const uno = resumenEstancados([{ regla: 'T6', desde: 'noresp', plazoDias: 10 }], () => 'No responde')!;
  assert.match(uno, /1 lead\*/);
  assert.ok(!/leads/.test(uno), `en singular no puede decir «leads»: ${uno}`);
});

// ---------------------------------------------------------------------------
// Que no quede decorativo: los CALL SITES
// ---------------------------------------------------------------------------

test('⚠️ EL AVISO ESTÁ CABLEADO, y sólo con lo que de verdad se aplicó', () => {
  // Un guard de cableado contesta «¿está enchufado?», nunca «¿hace lo que dice?» — los
  // tests de arriba contestan la segunda. Éste existe porque una capacidad escrita y sin
  // call site compila, pasa los tests y en pantalla no hace nada.
  const motor = readFileSync(new URL('../lib/crm-auto.ts', import.meta.url), 'utf8');
  // El bloque del loop de aplicación, hasta su `return`: un guard que lee el archivo
  // entero encuentra lo que el archivo dice de sí mismo.
  const ini = motor.indexOf('let auto = 0, confirmaciones = 0');
  const fin = motor.indexOf('return { ws: 0, ok: true', ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré el loop de aplicación');
  const bloque = motor.slice(ini, fin);
  assert.ok(bloque.length < 1600, `el recorte mide ${bloque.length}: está mirando otra cosa`);
  // La condición, no el cuerpo que cuelga de ella: lo que decide qué entra al aviso.
  assert.match(bloque, /r !== 'skip' && a\.desde/, 'al aviso entran los aplicados, nunca los salteados');
  assert.match(motor, /await avisarEstancados\(aplicadas\)/, 'el aviso se emite DESPUÉS del loop, una vez');
  assert.equal(
    (motor.match(/avisarEstancados\(/g) ?? []).length, 2,
    'avisarEstancados tiene que tener su declaración y UN call site',
  );
  // Y el motor resuelve el plazo por etapa en las dos reglas que lo miran.
  const planner = readFileSync(new URL('../lib/crm-auto-plan.ts', import.meta.url), 'utf8');
  assert.equal(
    (planner.match(/plazoDeEtapa\(stage,/g) ?? []).length, 2,
    'plazoDeEtapa se llama en T2 y en T6; si da 1, una de las dos reglas volvió al umbral global',
  );
});

test('El aviso existe en los tres registros, con su rótulo y su interruptor', () => {
  // Un aviso que no está en el catálogo no se puede leer, editar ni apagar; uno que no
  // está en AVISOS_WA_EN_VIVO sale igual y nadie puede apagarlo.
  const cat = CATALOGO_AVISOS.find((c) => c.id === 'crm-lead-estancado');
  assert.ok(cat, 'falta la entrada en CATALOGO_AVISOS');
  assert.equal(cat.categoria, 'aviso', 'no pide un sí: si fuera accion/pregunta no podría agruparse');
  assert.equal(areaDeAviso('crm-lead-estancado'), 'lead', 'habla de contactos, no del sistema');
  assert.ok(AVISOS_WA_EN_VIVO.some((a) => a.id === 'crm-lead-estancado'), 'no se puede apagar');
  assert.ok(AVISOS_AGRUPABLES.has('crm-lead-estancado'), 'el motor ya movió: puede esperar al resumen');
  // El ejemplo del catálogo es copy que ve todo el que abre /mensajes: nada de datos de
  // gente o negocios reales (la regla y su guard viven en tests/variables-aviso.test.ts).
  for (const real of ['Mauricio', 'Leila', 'Martín', 'Código Inmobiliario', 'Negocio que Escala']) {
    assert.ok(!cat.ejemplo.includes(real), `el ejemplo nombra a alguien real: ${real}`);
  }
});
