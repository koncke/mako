// =============================================================================
// ¿HACE FALTA un proyecto nuevo? El criterio que reemplazó al conteo de tareas
// =============================================================================
// 12/8/2026. El dueño, sobre el filtro que impedía abrir un proyecto con pocas tareas:
//
//   «El filtro NO debe ser porque solo haya 1 tarea… Puede ser que 1 sola tarea justifique
//    un proyecto… El filtro debe ser tener criterio, mejorarlo, y en este caso es evidente
//    que la tarea de analizar a la competencia NO requiere una nueva feature.»
//
// Tenía razón medido contra su propio tablero: de 73 proyectos, 9 tienen CERO tareas y 14
// tienen una sola, casi todos legítimos. Mientras tanto «Feature: Content Machine», que no
// debía nacer, traía DOS, y «Mejoras del Ads Manager» —el ejemplo del «NO» escrito en el
// prompt— traería TRES. El que tenía más tareas era el que estaba peor.
//
// Peor todavía: contar hacía que el veredicto dependiera de con quién viajó la tarjeta en
// el mensaje de WhatsApp. La misma propuesta, sola o en un lote de diez, daba distinto.
//
// Los diez casos de abajo son la especificación. R1-R7 tienen que caer y A1-A3 tienen que
// pasar; si un cambio los mueve, el criterio se rompió aunque los otros tests pasen.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  haceFaltaUnProyecto, traeTareas, esOtroRotulo, esTemaQueAtraviesa,
  presuponeElLugar, mirarNoFunda, esMirar, tokensDeNombre,
} from '../lib/plan-proyecto-necesidad';
import { CATALOGO_PROYECTOS } from '../lib/plan-proyectos-catalogo';

/** La lista de destinos real, que es contra la que corre en producción. */
const DESTINOS = CATALOGO_PROYECTOS.map((p) => ({ nombre: p.nombre }));

const propuesta = (nombre: string, semillas: Array<{ titulo: string; detalle?: string }>) =>
  haceFaltaUnProyecto({ nombre, tareas: semillas.map((_, i) => i) }, semillas, DESTINOS);

// ---------------------------------------------------------------------------
// EL CASO DEL DUEÑO
// ---------------------------------------------------------------------------

test('EL CASO DEL DUEÑO: analizar competencia no funda una feature, y cae aunque la tarea llegue SOLA', () => {
  // Así es como llega de verdad: WhatsApp manda lotes de 1 y 2. Un criterio que necesite
  // ver a las hermanas de lote para acertar no sirve para el camino que más se usa.
  const v = propuesta('Feature: Funnel de Venta', [
    { titulo: 'Analizar SaaS de Leads Acquisition Group y extraer insights de producto/funnel' },
  ]);
  assert.equal(v.ok, false);
  assert.match(v.ok === false ? v.motivo : '', /MIRAR|documento/);
});

test('…y sigue cayendo igual si la mandan con otras nueve: el lote no puede cambiar el veredicto', () => {
  // La regresión que importa. Con el umbral viejo, la MISMA propuesta pasaba o no según
  // cuántas tareas la acompañaran en el mensaje.
  const sola = propuesta('Feature: Funnel de Venta', [{ titulo: 'Analizar el SaaS de la competencia' }]);
  const acompanada = haceFaltaUnProyecto(
    { nombre: 'Feature: Funnel de Venta', tareas: [0] },
    [{ titulo: 'Analizar el SaaS de la competencia' }],
    DESTINOS,
  );
  assert.deepEqual(sola, acompanada);
  assert.equal(sola.ok, false);
});

test('NINGÚN chequeo cuenta tareas: una sola puede abrir un proyecto', () => {
  // El pedido textual. Una feature entera descrita en una sola tarjeta tiene que pasar.
  const v = propuesta('Feature: Facturación', [
    { titulo: 'Construir la tab de Facturación: timbrado, factura automática al cobrar y reporte para el contador' },
  ]);
  assert.equal(v.ok, true);
});

// ---------------------------------------------------------------------------
// LOS DIEZ CASOS, uno por uno
// ---------------------------------------------------------------------------

test('LOS CINCO DEL 11 Y 12/8 caen, y ninguno por cantidad', () => {
  const casos: Array<[string, Array<{ titulo: string; detalle?: string }>, RegExp]> = [
    ['Feature: Funnel de Venta',
      [{ titulo: 'Analizar SaaS de Leads Acquisition Group y extraer insights de producto/funnel' }],
      /MIRAR|documento/],
    ['Feature: Landing',
      [{ titulo: 'Replicar el diseño mobile de la landing de Wendy Mardigian' }],
      /TEMA|MIRAR/],
    ['Feature: Historia del Usuario',
      [{ titulo: 'Recopilar la HISTORIA personal del usuario con estructura de storytelling' }],
      /MIRAR|documento/],
    ['Feature: Focus Tracker',
      [{ titulo: 'Agregar módulo de capacidad operativa en Focus Tracker', detalle: 'un nuevo módulo dentro del Feature: Focus Tracker' }],
      /ADENTRO/],
  ];
  for (const [nombre, semillas, esperado] of casos) {
    const v = propuesta(nombre, semillas);
    assert.equal(v.ok, false, `«${nombre}» pasó y no debería`);
    assert.match(v.ok === false ? v.motivo : '', esperado, `«${nombre}» cayó por otro motivo`);
    assert.doesNotMatch(v.ok === false ? v.motivo : '', /tarea\(s\)|solo 1|cantidad/,
      `«${nombre}» cayó por contar tareas, que es justo lo que se sacó`);
  }
  // El quinto, «Feature: Content Machine», ya no llega hasta acá: cae antes en
  // `puedeSerProyectoNuevo` (está en el catálogo desde el 12/8). Su test vive allá.
});

test('R6 «Mejoras del Ads Manager»: el caso que HOY pasaba las cuatro barreras con TRES tareas', () => {
  // 4 palabras, «Mejoras» no es un verbo de la lista, no está en canon, y traía 3 tareas
  // — más que cualquiera de los legítimos. Es el que refuta el conteo por sí solo.
  const v = propuesta('Mejoras del Ads Manager', [
    { titulo: 'Arreglar el filtro de fechas' },
    { titulo: 'Cambiar el orden de las columnas' },
    { titulo: 'Sumar el botón de duplicar' },
  ]);
  assert.equal(v.ok, false);
  assert.match(v.ok === false ? v.motivo : '', /otro rótulo/);
});

test('A3 «Legal y fiscal» sobrevive con CUATRO tareas de revisar, y no por suerte', () => {
  // Su ausencia ya costó caro: los Términos de Servicio cayeron en «Landing y VSL» y la
  // apertura de la LLC en «Cobros y planes». Un área del negocio se releva, se evalúa y se
  // audita, y sigue faltando. Lo que la salva es que NO lleva prefijo `Feature:`/`Agente:`
  // — es una línea explícita del chequeo, no una casualidad del vocabulario.
  //
  // Se corre contra un catálogo SIN «Legal y fiscal», que es el estado real del día que
  // hizo falta. Con el catálogo de hoy el veredicto sería «ya existe» y el test no
  // probaría nada — que es exactamente lo que pasó la primera vez que lo escribí.
  const sinLegal = DESTINOS.filter((d) => !/legal/i.test(d.nombre));
  const semillas = [
    { titulo: 'Revisar las obligaciones fiscales de la agencia' },
    { titulo: 'Evaluar LLC vs SAS para facturar afuera' },
    { titulo: 'Auditar el cumplimiento de GDPR' },
    { titulo: 'Relevar qué contratos hacen falta' },
  ];
  const v = haceFaltaUnProyecto({ nombre: 'Legal y fiscal', tareas: [0, 1, 2, 3] }, semillas, sinLegal);
  assert.equal(v.ok, true, v.ok === false ? v.motivo : '');
});

test('un lote MIXTO sí funda: YouTube Analyst trae 3 de investigar y 2 de construir', () => {
  // Es uno de los dos únicos proyectos que el Perro abrió con aval en todo el tablero.
  // Por eso el chequeo pide UNANIMIDAD y no mayoría.
  const v = propuesta('Feature: TikTok Analyst', [
    { titulo: 'Investigar qué métricas expone la API' },
    { titulo: 'Analizar los primeros 20 videos' },
    { titulo: 'Construir la tabla de retención por video' },
  ]);
  assert.equal(v.ok, true);
});

// ---------------------------------------------------------------------------
// Las puertas de atrás, una por una
// ---------------------------------------------------------------------------

test('«Análisis de los SaaS» cae igual que «Analizar»: el sustantivo no es una puerta de atrás', () => {
  assert.equal(esMirar('Analizar el SaaS de la competencia'), true);
  assert.equal(esMirar('Análisis de los SaaS de la competencia'), true);
  assert.equal(esMirar('Benchmark de precios del mercado'), true);
  assert.equal(esMirar('Construir la tab de facturación'), false);
});

test('«[Ads] Analizar el creativo» cae igual: un corchete no apaga el chequeo', () => {
  // Por eso se miran las DOS primeras palabras y no solo la primera.
  assert.equal(esMirar('[Ads] Analizar el creativo ganador'), true);
  // Pero no las tres: un verbo de mirar en la mitad de la frase no vuelve «análisis» a
  // una tarea de construcción («Construir el panel que analiza…» sigue construyendo).
  assert.equal(esMirar('Construir el panel que analiza la retención'), false);
});

test('«Feature: Ads-Manager» tampoco esquiva el control: el guion no es un nombre nuevo', () => {
  // El choque de normalizadores. `nucleo()` saca el prefijo pero deja la puntuación;
  // `normTitulo()` saca la puntuación pero no sabe de prefijos. Con uno solo, el rename
  // con guion pasaba.
  assert.deepEqual(tokensDeNombre('Feature: Ads-Manager'), ['ads', 'manager']);
  assert.deepEqual(tokensDeNombre('Feature: Ads Manager'), ['ads', 'manager']);
  assert.equal(esOtroRotulo('Feature: Ads-Manager', DESTINOS).ok, false);
});

test('«AL Focus Tracker» tampoco: las locativas van todas', () => {
  const v = presuponeElLugar('Feature: Focus Tracker', [{ titulo: 'Sumar el módulo AL Focus Tracker' }]);
  assert.equal(v.ok, false);
  assert.equal(presuponeElLugar('Feature: Focus Tracker', [{ titulo: 'Sumar el módulo dentro del Focus Tracker' }]).ok, false);
});

test('«Construir la tab DE Facturación» NO cae por la preposición: «de» es de nombre, no de pertenencia', () => {
  // Si «de» entrara en las locativas, mataría el único ejemplo del «SÍ» que tiene el
  // prompt: es la forma normal de pedir algo que todavía no existe.
  assert.equal(presuponeElLugar('Feature: Facturación', [{ titulo: 'Construir la tab de Facturación' }]).ok, true);
});

// ---------------------------------------------------------------------------
// La asimetría de C1, que es lo que evita que el criterio sea demasiado duro
// ---------------------------------------------------------------------------

test('un MODIFICADOR es la misma tab; un SUSTANTIVO que cambia la cosa es otro lugar', () => {
  // Lo primero rechaza, lo segundo pasa. Un veto por contención genérica rompería el
  // patrón de nombres de la casa, donde «Feature: CRM automático» convive con
  // «Feature: CRM» y «Feature: Landing Analyst» con «Vender MaKo: Landing y VSL».
  for (const n of ['Mejoras del Ads Manager', 'Ads Manager v2', 'Ajustes del Ads Manager', 'Ads Manager avanzado']) {
    assert.equal(esOtroRotulo(n, DESTINOS).ok, false, `«${n}» pasó y es la misma tab`);
  }
  for (const n of ['Feature: Email Analyst', 'Feature: CRM predictivo', 'Feature: Plan Financiero']) {
    assert.equal(esOtroRotulo(n, DESTINOS).ok, true, `«${n}» cayó y es otro lugar`);
  }
});

test('una palabra que vive adentro de varios proyectos es un tema que se reparte', () => {
  const v = esTemaQueAtraviesa('Feature: Landing', DESTINOS);
  assert.equal(v.ok, false);
  assert.match(v.ok === false ? v.motivo : '', /TEMA/);
  // Solo para nombres de UNA palabra: con dos ya no es un tema suelto.
  assert.equal(esTemaQueAtraviesa('Feature: Landing Analyst', DESTINOS).ok, true);
});

test('el catálogo real no se auto-rechaza: ningún proyecto vigente cae por C2', () => {
  // La red contra un umbral mal calibrado. Si bajar el corte de 2 a 1 rompiera destinos
  // que ya existen, este test lo dice antes de que lo diga el tablero.
  const caen = CATALOGO_PROYECTOS.filter((p) => !esTemaQueAtraviesa(p.nombre, DESTINOS).ok);
  assert.deepEqual(caen.map((p) => p.nombre), [],
    'estos proyectos del catálogo se rechazarían a sí mismos si alguien los propusiera hoy');
});

// ---------------------------------------------------------------------------
// C0 y la forma del veredicto
// ---------------------------------------------------------------------------

test('una propuesta sin tareas nace vacía: la regla vivía adentro del umbral que borramos', () => {
  // `0 < Math.min(3, n)` es siempre verdadero, así que el umbral la frenaba de casualidad
  // y se iba con él. «Feature: Landing» nació el 11/8 y quedó con 0 tareas.
  assert.equal(traeTareas([]).ok, false);
  assert.equal(traeTareas([0]).ok, true);
  assert.equal(haceFaltaUnProyecto({ nombre: 'Feature: Loquesea', tareas: [] }, [], DESTINOS).ok, false);
});

test('todo rechazo sale con un motivo legible: es lo que va a leer el dueño en la tarjeta', () => {
  const casos = [
    propuesta('Mejoras del Ads Manager', [{ titulo: 'Arreglar el filtro' }]),
    propuesta('Feature: Landing', [{ titulo: 'Replicar el diseño' }]),
    propuesta('Feature: Funnel de Venta', [{ titulo: 'Analizar el SaaS de la competencia' }]),
    haceFaltaUnProyecto({ nombre: 'Feature: X', tareas: [] }, [], DESTINOS),
  ];
  for (const v of casos) {
    assert.equal(v.ok, false);
    const m = v.ok === false ? v.motivo : '';
    assert.ok(m.length > 30, `motivo demasiado corto para entenderlo: «${m}»`);
    assert.doesNotMatch(m, /undefined|NaN|\[object/);
  }
});

test('sin destinos y sin semillas no explota: solo decide lo que puede decidir', () => {
  assert.equal(haceFaltaUnProyecto({ nombre: 'Feature: Algo', tareas: [0] }, [{ titulo: 'Construir algo' }], []).ok, true);
  assert.equal(mirarNoFunda('Feature: Algo', []).ok, true);
  assert.equal(esOtroRotulo('', DESTINOS).ok, true);
});
