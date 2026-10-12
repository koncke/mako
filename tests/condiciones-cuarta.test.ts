// =============================================================================
// condiciones-cuarta — la CONDITION de la cuarta tanda de /automations (09/10/2026)
// =============================================================================
// Lo que fija, por punto del pedido de Martín (app/admin/dev/chatbot/bitacora.ts, 9 oct 11:02):
//   · 7. «＋ y» / «＋ o» por FILA: cada fila guarda con qué se une a la de arriba (ausente = el `modo`
//        de la rama, así lo guardado evalúa igual), las «y» atan más que las «o», el saneo la conserva,
//        el texto de la tarjeta la dice, y lo que se mira al inscribir (`antiguedadDeEntrada`) la lee
//        igual que la evaluación. Sin «＋ Rama» ni «Todas / Cualquiera».
//   · 5. La reunión, UNA familia acotable a etapas: el lugar de la ficha sale del ORDEN de las reuniones
//        del embudo (nunca del nombre), sólo si el lead está en ese embudo; una tercera da «no sé»; las
//        de R1/R2 se siguen evaluando.
//   · 6. «No pagó la cuota N»: el estado POR cuota (`pagos.numero`), leído en batch.
//
// PROBADO ROMPIÉNDOLO (09/10/2026), corriendo este archivo junto con tests/condiciones-catalogo.test.ts:
// con todo puesto 41 pasan / 0 fallan. Cada rotura de a una, con un arnés que restaura DE MEMORIA (nunca
// con `git checkout`). Pasan / fallan:
//    1. `unionDe` ignora la unión de la fila (vuelve al `modo` de la rama)                  -> 36 / 5
//    2. `gruposDeRama` con la precedencia al revés (la «y» abre grupo)                     -> 37 / 4
//    3. `sanearFila` sin la línea de la unión                                             -> 40 / 1
//    4. `sanearFila` sin las reuniones                                                    -> 40 / 1
//    5. `antiguedadDeEntrada` mira sólo el primer grupo                                   -> 40 / 1
//    6. `textoRama` con el separador del `modo` de la rama                                -> 40 / 1
//    7. `lugaresDeFila` sin mirar si el lead está en el embudo                            -> 40 / 1
//    8. `lugaresDeFila` toma siempre la primera reunión (sin el orden)                    -> 38 / 3
//    9. `asistioA`: una asistencia gana sobre un no-show                                  -> 40 / 1
//   10. `pagoDeFila`: una cuota sin vencer cuenta como «no pagó»                          -> 40 / 1
//   11. `estadoDeCuotas` vence el mismo día (`<=` hoy)                                    -> 39 / 2
//   12. `fuentesDeFilas` no pide los pagos para la cuota                                  -> 40 / 1
//   13. la ruta lee las reuniones sin su propio catch                                     -> 40 / 1
//   14. el motor no tira si el embudo no se lee (caería al pipeline de fábrica)           -> 40 / 1
//   15. el editor agrega la fila sin su unión                                             -> 40 / 1
//   16. el editor vuelve a ofrecer «＋ Rama»                                               -> 40 / 1
//   17. «Asistió a la R1» vuelve a ofrecerse (sin `retirada`)                             -> 39 / 2
//   18. el separador cambia el modo de la rama ENTERA (el bug de «+y» de la tercera tanda) -> 40 / 1
//   19. la tarjeta no nombra las reuniones elegidas                                       -> 40 / 1
//   20. la tercera reunión se ofrece como elegible                                        -> 40 / 1
// ⚠️ La 11 dio 41 / 0 en la primera vuelta: ninguna cuota del caso vencía HOY. Se sumó la cuota 5 y
// un quinto de fechas en HOY al diferencial: el borde es justo donde dos reglas de «vencida» se separan.
//
// Correr: npx tsx --test tests/condiciones-cuarta.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  condicionPorId, seccionesDeCondiciones, fuentesDeFilas, embudosDeReunionDeFilas, reunionesParaEditor, opcionesDe,
  textoCondicion, nombresCatalogoDe, problemaDeFila, estadoDeCuotas, pagoDeFila, cuotaDeFila, deValorOpcion,
  TOPE_REUNIONES, type HechosCatalogo, type CatalogosCondicion,
} from '../lib/condiciones-catalogo';
import {
  cumpleFila, cumpleRama, gruposDeRama, unionDe, textoRama, textoFila, antiguedadDeEntrada, validarGrafo,
  type HechosLead, type FilaCondicion, type RamaCondicion, type PasoGrafo,
} from '../lib/flujo-grafo';
import { camposDelFlujo, resumenPagos } from '../lib/nutricion-grafo-motor';
import { reunionesDe } from '../lib/funnel-etapas';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas ANTES que los bloques (AGENTS.md: un `/*` adentro de un `//` se come código).
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, abre: string, cierra: string, tope: number): string => {
  const ini = src.indexOf(abre);
  assert.ok(ini >= 0, `no encontré «${abre}»`);
  const fin = src.indexOf(cierra, ini + abre.length);
  assert.ok(fin > ini, `no encontré el cierre «${cierra}»`);
  const b = src.slice(ini, fin);
  assert.ok(b.length < tope, `el recorte mide ${b.length}: está mirando otra cosa`);
  return b;
};

const AHORA = Date.parse('2026-10-09T12:00:00Z');
const HORA = 3_600_000;
const leadBase = (o: Partial<NonNullable<HechosCatalogo['lead']>> = {}): NonNullable<HechosCatalogo['lead']> => ({
  origen: 'instant_form', estado: 'abierto', calificado: null, deFormularioMeta: true, conVisitante: false, campana: null,
  emailBaja: false, ventaTipo: null, tieneFechaAgenda: false, r1: { fechaMs: null, asistio: null }, r2: { fechaMs: null, asistio: null },
  cerro: null, tieneFechaCierre: false, confirmoCompra: false, proximaReunionMs: null, ...o,
});
const H = (catalogo?: HechosCatalogo, o: Partial<HechosLead> = {}): HechosLead => ({
  etiquetas: new Set(), etapa: null, agendo: false, pago: false, yaContactado: false, respondio: false,
  creadoMs: null, tieneTelefono: true, tieneEmail: false, ahoraMs: AHORA, ...(catalogo ? { catalogo } : {}), ...o,
});

// ═════════════════════════════════════════════════════════════════════════════
// Punto 7 — «＋ y» / «＋ o» por fila
// ═════════════════════════════════════════════════════════════════════════════

const E = (id: number, union?: 'y' | 'o'): FilaCondicion => ({ campo: 'etiqueta', valor: id, ...(union ? { union } : {}) });
const rama = (filas: FilaCondicion[], modo: RamaCondicion['modo'] = 'todas'): RamaCondicion => ({ id: 'r', modo, filas, siguiente: null });
const conEtiquetas = (...ids: number[]) => H(undefined, { etiquetas: new Set(ids) });

test('7: las «y» atan más que las «o»: «A y B o C» es «(A y B) o C»', () => {
  const r = rama([E(1), E(2, 'y'), E(3, 'o')]);
  assert.deepEqual(gruposDeRama(r).map((g) => g.map((f) => f.valor)), [[1, 2], [3]]);
  assert.equal(cumpleRama(r, conEtiquetas(1, 2)), true, 'el primer grupo entero');
  assert.equal(cumpleRama(r, conEtiquetas(3)), true, 'el segundo grupo solo');
  assert.equal(cumpleRama(r, conEtiquetas(1)), false, 'medio grupo no alcanza');
  assert.equal(cumpleRama(r, conEtiquetas(2, 3)), true);
  // «A o B y C» es «A o (B y C)».
  const r2 = rama([E(1), E(2, 'o'), E(3, 'y')]);
  assert.equal(cumpleRama(r2, conEtiquetas(1)), true);
  assert.equal(cumpleRama(r2, conEtiquetas(2)), false);
  assert.equal(cumpleRama(r2, conEtiquetas(2, 3)), true);
});

test('7: sin unión guardada, la rama de ANTES evalúa con su `modo` (lo guardado no cambia)', () => {
  assert.equal(cumpleRama(rama([E(1), E(2)], 'todas'), conEtiquetas(1)), false);
  assert.equal(cumpleRama(rama([E(1), E(2)], 'cualquiera'), conEtiquetas(1)), true);
  assert.equal(unionDe(rama([E(1), E(2)], 'cualquiera'), 1), 'o');
  assert.equal(unionDe(rama([E(1), E(2)], 'todas'), 1), 'y');
  // La unión de la fila MANDA sobre el modo, en las dos direcciones.
  assert.equal(cumpleRama(rama([E(1), E(2, 'o')], 'todas'), conEtiquetas(2)), true);
  assert.equal(cumpleRama(rama([E(1), E(2, 'y')], 'cualquiera'), conEtiquetas(2)), false);
  // Una rama sin filas nunca se cumple.
  assert.equal(cumpleRama(rama([]), conEtiquetas(1)), false);
});

test('7: la tarjeta dice la unión de CADA fila, la misma que evalúa', () => {
  const n = { etiqueta: (id: number) => `T${id}` };
  assert.equal(textoRama(rama([E(1), E(2, 'y'), E(3, 'o')]), n), 'Tiene «T1» y Tiene «T2» o Tiene «T3»');
  assert.equal(textoRama(rama([E(1), E(2)], 'cualquiera'), n), 'Tiene «T1» o Tiene «T2»', 'las de antes, como siempre');
  assert.equal(textoRama(rama([E(1), E(2)], 'todas'), n), 'Tiene «T1» y Tiene «T2»');
});

test('7: al inscribir, una «o» con un grupo que no exige la antigüedad deja entrar por ése', () => {
  const ant = (h: number, union?: 'y' | 'o'): FilaCondicion => ({ campo: 'antiguedad', valor: h, ...(union ? { union } : {}) });
  const flujo = (filas: FilaCondicion[], modo: RamaCondicion['modo'] = 'todas'): PasoGrafo[] => [
    { id: 'c', nodo: 'condicion', ramas: [{ id: 'r', modo, filas, siguiente: 'm' }], si_no: null },
    { id: 'm', cuerpo: 'hola', siguiente: null },
  ];
  assert.equal(antiguedadDeEntrada(flujo([ant(72), E(1, 'y')])), 72, 'con «y» la exige siempre');
  // Con `modo: 'todas'` y una fila nueva unida con «o»: antes se leía «todas» y dejaba afuera a quien
  // entraba por la etiqueta.
  assert.equal(antiguedadDeEntrada(flujo([ant(72), E(1, 'o')])), null);
  assert.equal(antiguedadDeEntrada(flujo([ant(72), ant(24, 'o')])), 72, 'las dos alternativas la exigen: el máximo');
  assert.equal(antiguedadDeEntrada(flujo([ant(72), E(1)], 'cualquiera')), null, 'las de antes, como siempre');
});

test('7: el saneo de lo que se guarda CONSERVA la unión (si no, el primer guardado vuelve «o» a «y»)', () => {
  const p = camposDelFlujo({
    id: 'c', nodo: 'condicion', si_no: null,
    ramas: [{ id: 'r', modo: 'todas', siguiente: null, filas: [
      { campo: 'agendo' }, { campo: 'pago', union: 'o' }, { campo: 'agendo', union: 'y' }, { campo: 'agendo', union: 'tal vez' },
    ] }],
  });
  const filas = p.ramas![0].filas;
  assert.deepEqual(filas.map((f) => f.union), [undefined, 'o', 'y', undefined], 'una unión que no es «y» ni «o» se descarta');
  // «Agendó o pagó», guardada: con `modo: 'todas'` y sin la unión, pedía las dos.
  assert.equal(cumpleRama({ ...p.ramas![0], filas: filas.slice(0, 2) }, H(undefined, { pago: true })), true, 'después de guardar sigue siendo «o»');
});

test('7: el editor — «＋ Condición» la primera, «＋ y» / «＋ o» guardan la unión de SU fila, el separador se cambia tocándolo', () => {
  const src = sinComentarios(leer('../app/automations/EditorCondicion.tsx'));
  const agregar = bloque(src, 'const agregar = (union', 'const setFila', 600);
  assert.match(agregar, /filas: \[\.\.\.filas, filas\.length && union \? \{ \.\.\.f, union \} : f\]/);
  assert.match(src, /texto="＋ Condición"[^>]*onElegir=\{agregar\(null\)\}/);
  // El separador cambia la unión de ESA fila (y de ninguna otra): el bug de la tercera tanda era que un
  // botón cambiaba el modo de la rama entera.
  assert.match(src, /<Union union=\{unionDe\(rama, fi\)\}[^>]*onCambiar=\{\(u\) => setFila\(fi, \{ \.\.\.f, union: u \}, true\)\}/);
  assert.doesNotMatch(src, /\.\.\.rama, modo/, 'el editor vuelve a cambiar el modo de la rama entera');
  // Cambiar la pregunta de una fila no le cambia cómo se une.
  assert.match(src, /onCambiar\(fila\.union \? \{ \.\.\.f, union: fila\.union \} : f, true\)/);
});

// ═════════════════════════════════════════════════════════════════════════════
// Punto 5 — la reunión, por etapas del kanban
// ═════════════════════════════════════════════════════════════════════════════

// Un embudo (7) con tres reuniones marcadas en el CRM, y otro (9) con una sola.
const ETAPAS_7 = [
  { key: 'lead', label: 'Lead', kind: 'entrada' }, { key: 'disc', label: 'Descubrimiento', kind: 'reunion' },
  { key: 'demo', label: 'Demo', kind: 'reunion' }, { key: 'tercera', label: 'Tercera', kind: 'reunion' },
  { key: 'ganado', label: 'Ganado', kind: 'cierre' },
];
const ORDEN = new Map<number, readonly string[]>([[7, reunionesDe(ETAPAS_7)], [9, ['auditoria']]]);
const enEmbudo = (...fids: number[]) => ({ etapasPorProducto: new Map(fids.map((f) => [f, 'x'])) });
const R = (campo: string, reuniones: string[] = [], o: Partial<FilaCondicion> = {}): FilaCondicion => ({ campo, ...(reuniones.length ? { reuniones } : {}), ...o });

test('5: «No asistió a la reunión» exige la asistencia REGISTRADA en false, no la falta de reunión', () => {
  const sinDato = H({ lead: leadBase() });
  assert.equal(cumpleFila(R('asistio_reunion', [], { no: true }), sinDato), false, 'sin reunión no es un no-show');
  assert.equal(cumpleFila(R('asistio_reunion'), sinDato), false);
  const falto = H({ lead: leadBase({ r1: { fechaMs: AHORA - HORA, asistio: false } }) });
  assert.equal(cumpleFila(R('asistio_reunion', [], { no: true }), falto), true);
  assert.equal(cumpleFila(R('asistio_reunion'), falto), false);
  const fue = H({ lead: leadBase({ r1: { fechaMs: AHORA - HORA, asistio: true } }) });
  assert.equal(cumpleFila(R('asistio_reunion'), fue), true);
  assert.equal(cumpleFila(R('asistio_reunion', [], { no: true }), fue), false);
  // Una no-asistencia registrada MANDA: fue a una y faltó a la otra → «No asistió» (reagendar).
  const mixto = H({ lead: leadBase({ r1: { fechaMs: AHORA - 48 * HORA, asistio: true }, r2: { fechaMs: AHORA - HORA, asistio: false } }) });
  assert.equal(cumpleFila(R('asistio_reunion', [], { no: true }), mixto), true);
  assert.equal(cumpleFila(R('asistio_reunion'), mixto), false);
});

test('5: la etapa elegida va a su lugar POR ORDEN dentro de SU embudo, nunca por el nombre', () => {
  // Faltó a la PRIMERA reunión (r1) y fue a la SEGUNDA (r2).
  const lead = leadBase({ r1: { fechaMs: AHORA - 48 * HORA, asistio: false }, r2: { fechaMs: AHORA - HORA, asistio: true } });
  const h = H({ lead, reuniones: ORDEN }, enEmbudo(7));
  assert.equal(cumpleFila(R('asistio_reunion', ['7:disc'], { no: true }), h), true, '«disc» es la primera reunión del embudo 7');
  assert.equal(cumpleFila(R('asistio_reunion', ['7:demo']), h), true, '«demo» es la segunda');
  assert.equal(cumpleFila(R('asistio_reunion', ['7:demo'], { no: true }), h), false);
  // Si el CRM marca otra reunión ANTES, todo se corre un lugar: «demo» pasa a ser la tercera.
  const corrido = new Map(ORDEN);
  corrido.set(7, ['nueva', 'disc', 'demo']);
  const h2 = H({ lead, reuniones: corrido }, enEmbudo(7));
  assert.equal(cumpleFila(R('asistio_reunion', ['7:disc']), h2), true, '«disc» ahora es la segunda (r2)');
  assert.equal(cumpleFila(R('asistio_reunion', ['7:demo']), h2), false, '«demo» es la tercera: no sé');
  assert.equal(cumpleFila(R('asistio_reunion', ['7:demo'], { no: true }), h2), false, '«no sé» no se cumple ni negado');
});

test('5: una tercera reunión, una etapa que ya no es reunión o un embudo del que el lead no es parte dan «no sé»', () => {
  const lead = leadBase({ r1: { fechaMs: AHORA - HORA, asistio: false }, r2: { fechaMs: AHORA - HORA, asistio: false } });
  const h = H({ lead, reuniones: ORDEN }, enEmbudo(7));
  for (const f of [R('asistio_reunion', ['7:tercera'], { no: true }), R('asistio_reunion', ['7:ganado'], { no: true }), R('asistio_reunion', ['9:auditoria'], { no: true })]) {
    assert.equal(cumpleFila(f, h), false, `${f.reuniones} no debería decidir`);
  }
  // Con una de las elegidas que SÍ tiene lugar, ésa decide.
  assert.equal(cumpleFila(R('asistio_reunion', ['7:tercera', '7:disc'], { no: true }), h), true);
  // Sin el orden leído (la fuente no se pidió), «no sé».
  assert.equal(cumpleFila(R('asistio_reunion', ['7:disc'], { no: true }), H({ lead }, enEmbudo(7))), false);
});

test('5: «Tiene reunión agendada» y «Próxima reunión en», acotadas a las etapas elegidas', () => {
  const lead = leadBase({ r1: { fechaMs: AHORA - 24 * HORA, asistio: true }, r2: { fechaMs: AHORA + 10 * HORA, asistio: null }, proximaReunionMs: AHORA + 10 * HORA });
  const h = H({ lead, reuniones: ORDEN }, enEmbudo(7));
  assert.equal(cumpleFila(R('reunion_agendada', ['7:demo']), h), true);
  assert.equal(cumpleFila(R('reunion_agendada', ['7:disc']), h), true, 'pasada también cuenta, como «Tiene R2 agendada»');
  const sinSegunda = H({ lead: leadBase({ r1: { fechaMs: AHORA - HORA, asistio: true } }), reuniones: ORDEN }, enEmbudo(7));
  assert.equal(cumpleFila(R('reunion_agendada', ['7:demo'], { no: true }), sinSegunda), true, 'sin la segunda: «Sin reunión agendada»');
  assert.equal(cumpleFila(R('reunion_agendada', [], { no: true }), H({ lead: leadBase() })), true, 'cualquiera, sin ninguna');
  // «Próxima reunión en ≤ 12 h»: la demo está a 10 h; la de descubrimiento ya pasó.
  assert.equal(cumpleFila(R('reunion_en', ['7:demo'], { op: 'menor_igual', valor: 12 }), h), true);
  assert.equal(cumpleFila(R('reunion_en', ['7:disc'], { op: 'menor_igual', valor: 12 }), h), false, 'la elegida ya pasó: no hay «en N h»');
  assert.equal(cumpleFila(R('reunion_en', [], { op: 'menor_igual', valor: 12 }), h), true, 'sin etapas, la próxima de siempre');
});

test('5: las de R1 / R2 se siguen evaluando para los flujos que ya las tienen', () => {
  const h = H({ lead: leadBase({ r1: { fechaMs: AHORA - HORA, asistio: false } }) });
  assert.equal(cumpleFila({ campo: 'asistio_r1', no: true }, h), true);
  for (const id of ['r1_pendiente', 'asistio_r1', 'asistio_r2', 'agendo_r2', 'r1_sin_avanzar', 'calificado_sin_r2', 'r2_sin_cerrar']) {
    assert.equal(condicionPorId(id)?.retirada, true, `${id} no quedó retirada`);
    assert.equal(validarGrafo([{ id: 'c', nodo: 'condicion', ramas: [{ id: 'r', modo: 'todas', filas: [{ campo: id }], siguiente: null }], si_no: null }]).length, 0, `${id} ya guardada no se puede volver a guardar`);
  }
});

test('5: se leen el orden de los embudos y en cuáles está el lead SÓLO si la fila elige etapas', () => {
  assert.deepEqual([...fuentesDeFilas([R('asistio_reunion')])].sort(), ['lead']);
  assert.deepEqual([...fuentesDeFilas([R('asistio_reunion', ['7:disc'])])].sort(), ['lead', 'productos', 'reuniones']);
  assert.deepEqual(embudosDeReunionDeFilas([R('asistio_reunion', ['7:disc', '7:demo']), R('reunion_en', ['9:auditoria']), R('etiqueta', ['3:x'])]).sort(), [7, 9]);
});

test('5: el saneo CONSERVA las etapas elegidas, sólo donde se admiten, válidas y con tope', () => {
  const muchas = Array.from({ length: TOPE_REUNIONES + 5 }, (_, i) => `7:e${i}`);
  const p = camposDelFlujo({
    id: 'c', nodo: 'condicion', si_no: null,
    ramas: [{ id: 'r', modo: 'todas', siguiente: null, filas: [
      { campo: 'asistio_reunion', no: true, reuniones: ['7:disc', '7:disc', 'x:y', '0:a', 5, '9:auditoria'] },
      { campo: 'etiqueta', valor: 1, reuniones: ['7:disc'] },
      { campo: 'reunion_en', op: 'menor_igual', valor: 24, reuniones: muchas },
      { campo: 'reunion_agendada', reuniones: [] },
    ] }],
  });
  const f = p.ramas![0].filas;
  assert.deepEqual(f[0], { campo: 'asistio_reunion', no: true, reuniones: ['7:disc', '9:auditoria'] });
  assert.equal(f[1].reuniones, undefined, 'una condición que no es de reunión no las guarda');
  assert.equal(f[2].reuniones?.length, TOPE_REUNIONES);
  assert.equal('reuniones' in f[3], false, 'vacío = sin el campo (cualquiera)');
});

test('5: el editor recibe las reuniones por embudo; la tercera se VE pero no se elige', () => {
  const r = reunionesParaEditor([
    { funnelId: 7, nombre: 'Programa', stages: ETAPAS_7 },
    { funnelId: 8, nombre: 'Sin reuniones', stages: [{ key: 'lead', kind: 'entrada' }] },
    { funnelId: 9, nombre: 'Auditoría', stages: [{ key: 'auditoria', label: ' ', kind: 'reunion' }] },
  ]);
  assert.deepEqual(r.map((e) => e.funnelId), [7, 9], 'un embudo sin reuniones no va');
  assert.deepEqual(r[0].etapas.map((e) => [e.key, e.sinLugar]), [['disc', false], ['demo', false], ['tercera', true]]);
  assert.equal(r[1].etapas[0].label, 'auditoria', 'sin rótulo, la key');
  const cat: CatalogosCondicion = { reuniones: r };
  const ops = opcionesDe('reunion', cat);
  assert.deepEqual(ops.map((s) => s.title), ['Programa', 'Auditoría'], 'con dos embudos, por embudo');
  assert.deepEqual(ops[0].options.find((o) => o.value === '7:tercera'), { value: '7:tercera', label: 'Tercera', disabled: true, sub: 'Sin dato en la ficha' });
  // La tarjeta dice las elegidas por su nombre.
  const n = nombresCatalogoDe(cat);
  assert.equal(textoCondicion(R('asistio_reunion', ['7:disc'], { no: true }), n), 'No asistió a la reunión «Descubrimiento»');
  assert.equal(textoCondicion(R('reunion_agendada', ['7:disc', '7:demo']), n), 'Tiene reunión agendada «Descubrimiento» o «Demo»');
  assert.equal(textoCondicion(R('reunion_en', ['7:demo'], { op: 'menor_igual', valor: 24 }), n), 'Próxima reunión en ≤ 24 h · «Demo»');
  assert.equal(textoCondicion(R('asistio_reunion', ['7:disc', '7:demo'])), 'Asistió a la reunión una reunión', 'sin catálogo, el genérico una vez');
  assert.equal(textoCondicion(R('asistio_reunion', [], { no: true })), 'No asistió a la reunión', 'cualquiera');
});

test('5: el desplegable ofrece la familia nueva y nada con «R1» / «R2»', () => {
  const ids = new Set(seccionesDeCondiciones('adquisicion', {}).flatMap((s) => s.options.map((o) => deValorOpcion(o.value)?.id)));
  for (const x of ['asistio_reunion', 'reunion_agendada', 'reunion_en']) assert.ok(ids.has(x), `falta ${x}`);
  assert.equal(condicionPorId('asistio_reunion')?.reuniones, true);
  assert.equal(condicionPorId('reunion_en')?.reuniones, true);
});

// ═════════════════════════════════════════════════════════════════════════════
// Punto 6 — «No pagó la cuota N»
// ═════════════════════════════════════════════════════════════════════════════

const HOY = '2026-10-09';
const CUOTAS = [
  { numero: 0, pagado: true, fecha_esperada: '2026-08-01' },
  { numero: 1, pagado: true, fecha_esperada: '2026-09-01' },
  { numero: 2, pagado: false, fecha_esperada: '2026-10-01' },
  { numero: 3, pagado: null, fecha_esperada: '2026-11-01' },
  { numero: 4, pagado: false, fecha_esperada: null },
  // Vence HOY: todavía no está vencida (la regla de `resumenPagos` es «antes de hoy»).
  { numero: 5, pagado: false, fecha_esperada: HOY },
];
const conCuotas = (o: Partial<HechosLead> = {}) => H({ pagos: { ...resumenPagos(CUOTAS, HOY), cuotas: estadoDeCuotas(CUOTAS, HOY) } }, o);

test('6: el estado de cada cuota, con la MISMA regla de vencida que `resumenPagos`', () => {
  const e = estadoDeCuotas(CUOTAS, HOY);
  assert.deepEqual([...e], [[0, 'pagada'], [1, 'pagada'], [2, 'vencida'], [3, 'pendiente'], [4, 'pendiente'], [5, 'pendiente']]);
  // Diferencial: las dos funciones cuentan lo mismo (pagadas y vencidas) sobre muchas listas.
  let semilla = 7;
  const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2 ** 31; return semilla / 2 ** 31; };
  for (let k = 0; k < 200; k++) {
    const lista = Array.from({ length: Math.floor(azar() * 8) }, (_, i) => ({
      numero: i, pagado: azar() < 0.3 ? true : azar() < 0.5 ? false : null,
      // Un quinto de las fechas es HOY: el borde donde una regla de «vencida» copiada mal se separa.
      fecha_esperada: azar() < 0.2 ? null : azar() < 0.2 ? HOY : `2026-${String(1 + Math.floor(azar() * 12)).padStart(2, '0')}-${String(1 + Math.floor(azar() * 28)).padStart(2, '0')}`,
    }));
    const r = resumenPagos(lista, HOY);
    const est = [...estadoDeCuotas(lista, HOY).values()];
    assert.equal(est.filter((x) => x === 'pagada').length, r.pagadas);
    assert.equal(est.filter((x) => x === 'vencida').length, r.vencidas);
  }
});

test('6: «No pagó la cuota N»: pagada = pagó, vencida e impaga = no pagó, lo demás = «no sé»', () => {
  const h = conCuotas();
  assert.equal(cumpleFila({ campo: 'pago', valor: 1 }, h), true, 'la cuota 1 está pagada');
  assert.equal(cumpleFila({ campo: 'pago', valor: 1, no: true }, h), false);
  assert.equal(cumpleFila({ campo: 'pago', valor: 2, no: true }, h), true, 'la cuota 2 venció y no se pagó');
  assert.equal(cumpleFila({ campo: 'pago', valor: 2 }, h), false);
  for (const n of [3, 4, 5, 9]) {
    assert.equal(cumpleFila({ campo: 'pago', valor: n, no: true }, h), false, `cuota ${n}: no venció, sin fecha o no existe`);
    assert.equal(cumpleFila({ campo: 'pago', valor: n }, h), false);
  }
  // Sin las cuotas leídas (la fuente no se pidió), «no sé».
  assert.equal(cumpleFila({ campo: 'pago', valor: 2, no: true }, H()), false);
  assert.equal(pagoDeFila({ campo: 'pago', valor: 'x' }, h), null, 'una cuota que no es un número no decide');
});

test('6: sin cuota, «Pagó / No pagó» es lo de siempre (lo guardado no cambia)', () => {
  assert.equal(cumpleFila({ campo: 'pago' }, H(undefined, { pago: true })), true);
  assert.equal(cumpleFila({ campo: 'pago', no: true }, H(undefined, { pago: false })), true);
  assert.equal(cumpleFila({ campo: 'pago', valor: '' }, H(undefined, { pago: true })), true);
});

test('6: la cuota pide la fuente de pagos, se valida al guardar y se dice en la tarjeta', () => {
  assert.deepEqual([...fuentesDeFilas([{ campo: 'pago' }])].sort(), ['lead']);
  assert.deepEqual([...fuentesDeFilas([{ campo: 'pago', valor: 1, no: true }])].sort(), ['lead', 'pagos']);
  assert.equal(problemaDeFila({ campo: 'pago' }), null);
  assert.equal(problemaDeFila({ campo: 'pago', valor: 3 }), null);
  assert.match(problemaDeFila({ campo: 'pago', valor: 0 }) ?? '', /cuota/);
  assert.match(problemaDeFila({ campo: 'pago', valor: 1.5 }) ?? '', /cuota/);
  assert.equal(cuotaDeFila({ valor: '2' }), 2);
  assert.equal(textoFila({ campo: 'pago', valor: 1, no: true }), 'No pagó la cuota 1');
  assert.equal(textoFila({ campo: 'pago', valor: 2 }), 'Pagó la cuota 2');
  assert.equal(textoFila({ campo: 'pago', no: true }), 'No pagó', 'sin cuota, como siempre');
});

// ═════════════════════════════════════════════════════════════════════════════
// Lo que lee el motor y lo que da la ruta (en batch, y «no pude leer» aparte)
// ═════════════════════════════════════════════════════════════════════════════

test('el motor lee el orden de los embudos NOMBRADOS y el número de cada cuota, una vez por lote', () => {
  const src = sinComentarios(bloque(leer('../lib/nutricion.ts'), 'async function hechosDelCatalogo(', '\n// ── Los HILOS de una inscripción', 20_000));
  const reuniones = bloque(src, 'const leerReuniones', 'const leerCurso', 1_500);
  assert.match(reuniones, /if \(!pide\('reuniones'\)\) return null;/);
  assert.match(reuniones, /for \(const id of embudosDeReunionDeFilas\(filas\)\)/, 'una lectura por embudo nombrado, no por lead');
  assert.match(reuniones, /cfg\.origen === 'error'\) throw/, 'con el pipeline de fábrica, «la primera reunión» sería otra');
  assert.match(reuniones, /reunionesDe\(cfg\.stages\)/);
  assert.match(src, /if \(reuniones\) c\.reuniones = reuniones;/);
  assert.match(src, /'pagos', 'id, lead_id, numero, pagado, fecha_esperada'/);
  assert.match(src, /cuotas: estadoDeCuotas\(suyas, hoy\)/);
});

// Duodécima tanda (12/10/2026): la LECTURA se mudó a lib/condiciones-catalogo-datos.ts (`catalogosRemotos`), que usan
// la ruta y «Crear con IA». Las reglas se miran donde viven; la ruta contesta lo que devuelve.
// Probado rompiéndolo (12/10/2026, en un espejo): sacar el `.catch` de las reuniones en lib/condiciones-catalogo-datos.ts
// → 21 pass / 1 fail (base 22 / 0), cae éste.
test('la ruta del catálogo suma las reuniones APARTE: si fallan, null y lo demás sigue', () => {
  const datos = sinComentarios(leer('../lib/condiciones-catalogo-datos.ts'));
  assert.match(datos, /reunionesPorEmbudo\(\)\.catch\(\(e: unknown\) => \{[\s\S]{0,200}?return null; \}\)/);
  assert.match(datos, /if \(cfg\.origen === 'error'\) return null;/);
  assert.match(datos, /return reunionesParaEditor\(embudos\);/);
  assert.match(datos, /return \{ cursos, posts, campanas, reuniones \};/);
  const ruta = sinComentarios(leer('../app/api/chat-agent/condiciones/route.ts'));
  assert.match(ruta, /const \{ cursos, posts, campanas, reuniones \} = await catalogosRemotos\(\);/);
  assert.match(ruta, /Response\.json\(\{ ok: true, cursos, posts, campanas, reuniones \}\)/);
});

test('el editor: el selector de reuniones (varios, vacío = cualquiera) y la cuota opcional', () => {
  const src = sinComentarios(leer('../app/automations/EditorCondicion.tsx'));
  assert.match(src, /\{def\?\.reuniones && <SelectorReuniones /);
  const sel = bloque(src, 'function SelectorReuniones(', 'function SelectorDeLista(', 3_000);
  assert.match(sel, /varios=\{elegidas\}/);
  assert.match(sel, /nuevas\.length \? \{ \.\.\.fila, reuniones: nuevas \} : sin\(fila, 'reuniones'\)/, 'vacío = sin el campo');
  assert.match(sel, /'Cualquier reunión'/);
  // La cuota vacía BORRA la clave: un 0 guardado sería «la cuota 0».
  assert.match(src, /t === '' \? sin\(fila, 'valor'\) : \{ \.\.\.fila, valor: Math\.round\(Number\(t\)\) \}/);
  assert.match(src, /placeholder="Cualquiera"/);
});
