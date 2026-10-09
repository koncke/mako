// =============================================================================
// condiciones-catalogo — las condiciones de la tarjeta CONDITION (tercera tanda, 09/10/2026)
// =============================================================================
// Lo que fija: que cada condición del catálogo tenga su LECTOR en el motor y su evaluación (una
// condición que el motor no puede evaluar es una mentira de pantalla), que «no sé» no se cumpla ni
// negado, que el filtro por el CRON (adquisición / entrega) sea el que pidió Martín, que el saneo de
// lo que se guarda conserve el operador y la referencia (la quinta puerta), y que el editor nuevo no
// vuelva a los botoncitos «+y +o».
//
// PROBADO ROMPIÉNDOLO (09/10/2026; con todo puesto: 19 pasan, 0 fallan). Cada rotura de a una, con
// un arnés que restaura DE MEMORIA (nunca con `git checkout`). Pasan / fallan:
//   1. `cumpleCatalogo` aplica `no` aunque `evaluar` diga null (sin el `if (si == null)`)  -> 17 / 2
//   2. `sanearFila` sin la línea del `op`                                                 -> 18 / 1
//   3. `hechosDelCatalogo` lee la comunidad sin `pide('comunidad')`                       -> 18 / 1
//   4. `seOfrece` deja pasar las de entrega con un CRON de adquisición                    -> 18 / 1
//   5. el editor vuelve a tener un botón «+ o»                                            -> 18 / 1
//   6. `resumenCursoDeAlumno` saltea las clases sin progreso (se pierde el universo)      -> 18 / 1
//   7. la ruta del catálogo lee `comunidad_posts` sin `clase_id`                          -> 18 / 1
//
// Correr: node --import tsx --test tests/condiciones-catalogo.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CONDICIONES, IDS_CONDICION, condicionPorId, ambitoDeDisparo, seccionesDeCondiciones, fuentesDeFilas, etapasEntregaDeFilas,
  problemaDeFila, textoCondicion, filaNueva, deValorOpcion, armarCursos, nombresCatalogoDe, normalizarTexto,
  type CatalogosCondicion, type HechosCatalogo,
} from '../lib/condiciones-catalogo';
import { CAMPOS_CONDICION, cumpleFila, validarGrafo, textoFila, type HechosLead, type PasoGrafo, type FilaCondicion } from '../lib/flujo-grafo';
import { camposDelFlujo, filasDelFlujo, catalogoDeLead, resumenCursoDeAlumno, resumenPagos, type ClaseParaResumen } from '../lib/nutricion-grafo-motor';

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
const H = (catalogo?: HechosCatalogo, o: Partial<HechosLead> = {}): HechosLead => ({
  etiquetas: new Set(), etapa: null, agendo: false, pago: false, yaContactado: false, respondio: false,
  creadoMs: null, tieneTelefono: true, tieneEmail: false, ahoraMs: AHORA, ...(catalogo ? { catalogo } : {}), ...o,
});
const leadBase = (o: Partial<NonNullable<HechosCatalogo['lead']>> = {}): NonNullable<HechosCatalogo['lead']> => ({
  origen: 'instant_form', estado: 'abierto', calificado: null, deFormularioMeta: true, conVisitante: false, campana: null,
  emailBaja: false, ventaTipo: null, tieneFechaAgenda: false, r1: { fechaMs: null, asistio: null }, r2: { fechaMs: null, asistio: null },
  cerro: null, tieneFechaCierre: false, confirmoCompra: false, proximaReunionMs: null, ...o,
});

// ── El catálogo mismo ──────────────────────────────────────────────────────────

test('cada condición tiene id único, rótulo, fuentes y —salvo las nueve de antes— su evaluación', () => {
  assert.equal(new Set(IDS_CONDICION).size, IDS_CONDICION.length, 'ids repetidos');
  for (const c of CONDICIONES) {
    assert.ok(c.rotulo[0].trim(), `${c.id} sin rótulo`);
    assert.ok(c.fuentes.length > 0, `${c.id} sin fuente: el motor no tendría de dónde leerla`);
    if (c.valor.t === 'legado') assert.equal(c.evaluar, undefined, `${c.id} es de las de antes: la decide cumpleFila`);
    else assert.equal(typeof c.evaluar, 'function', `${c.id} sin evaluar: sería una rama que nadie decide`);
    if (c.negable) assert.ok(c.rotulo[1].trim() && c.rotulo[1] !== c.rotulo[0], `${c.id} negable sin su negación`);
  }
});

test('las nueve de antes son EXACTAMENTE las del `switch` de `cumpleFila` (y siguen valiendo)', () => {
  const legado = CONDICIONES.filter((c) => c.valor.t === 'legado').map((c) => c.id).sort();
  assert.deepEqual(legado, [...CAMPOS_CONDICION].sort());
  const cuerpo = bloque(sinComentarios(leer('../lib/flujo-grafo.ts')), 'export function cumpleFila(', '\n}\n', 2_500);
  const casos = [...cuerpo.matchAll(/case '([a-z_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(casos, legado);
  // Lo que no está en el switch va al catálogo, no a un `return false`.
  assert.match(cuerpo, /default: return cumpleCatalogo\(f, h\)/);
});

test('el motor tiene un LECTOR por cada fuente que el catálogo declara', () => {
  const fuentes = new Set(CONDICIONES.flatMap((c) => c.fuentes));
  // El cierre es un comentario: se recorta sobre el fuente crudo y DESPUÉS se sacan los comentarios.
  const lectores = sinComentarios(bloque(leer('../lib/nutricion.ts'), 'async function hechosDeLeads(', '\n// ── Los HILOS de una inscripción', 30_000));
  for (const f of fuentes) {
    if (f === 'lead') continue;   // la fila de leads se lee siempre: es la que arma el resto
    assert.match(lectores, new RegExp(`pide\\('${f}'\\)`), `la fuente «${f}» no tiene lector (o se lee sin preguntar si hace falta)`);
  }
});

// ── El ámbito del CRON ─────────────────────────────────────────────────────────

test('ambitoDeDisparo: la entrega es entrega; una etapa de venta, una etiqueta o un evento de antes, adquisición', () => {
  assert.equal(ambitoDeDisparo('entrega_actual'), 'entrega');
  for (const t of ['etapa_actual', 'etiqueta_puesta', 'instant_form_sin_agenda', 'manual', null, undefined, '']) assert.equal(ambitoDeDisparo(t), 'adquisicion');
});

const CAT: CatalogosCondicion = {
  etapas: [{ title: 'Etapa', funnelId: 7, options: [{ value: 'agenda', label: 'Agendó' }] }],
  productos: [{ funnelId: 7, productoId: 3, nombre: 'Programa', etapas: [{ value: 'agenda', label: 'Agendó' }], etapasEntrega: [{ value: 'onboarding', label: 'Onboarding' }, { value: 'hito1', label: 'Hito 1' }] }],
  cursos: [{ productoId: 3, nombre: 'Programa', modulos: [{ clave: 'm1', nombre: 'Módulo 1' }], clases: [{ id: 11, titulo: 'Bienvenida', modulo: 'm1', tieneTarea: false }, { id: 12, titulo: 'Diagnóstico', modulo: 'm1', tieneTarea: true }] }],
  posts: [{ id: 50, titulo: 'Bienvenidos' }],
  campanas: ['VSL frío'],
};
const ids = (s: ReturnType<typeof seccionesDeCondiciones>) => new Set(s.flatMap((x) => x.options.map((o) => deValorOpcion(o.value)?.id)));

test('con un CRON de ADQUISICIÓN se ofrece el CRM y nada de Customer Success; con uno de ENTREGA, al revés', () => {
  const adq = seccionesDeCondiciones('adquisicion', CAT);
  const ent = seccionesDeCondiciones('entrega', CAT);
  assert.deepEqual(adq.map((s) => s.title), ['Información del lead', 'Origen y tracking', 'Etapa y pipeline', 'Agenda y llamadas', 'Pagos', 'Mensajes', 'Etiquetas']);
  assert.deepEqual(ent.map((s) => s.title), ['Curso y avance', 'Comunidad', 'Tareas del curso', 'Pagos del cliente', 'Etapa de entrega', 'Mensajes', 'Etiquetas', 'Información del lead']);
  const a = ids(adq);
  const e = ids(ent);
  for (const c of CONDICIONES) {
    if (c.ambito === 'entrega') assert.ok(!a.has(c.id), `${c.id} (entrega) apareció en adquisición`);
    if (c.ambito === 'adquisicion') assert.ok(!e.has(c.id), `${c.id} (adquisición) apareció en entrega`);
  }
  // Lo que antes eran «Eventos» del CRON, ahora son condiciones (punto 4).
  for (const x of ['form_sin_agenda', 'vsl_sin_agendar', 'vsl_poco', 'r1_pendiente', 'asistio_r1', 'calificado_sin_r2', 'r2_sin_cerrar']) assert.ok(a.has(x), `falta ${x}`);
  // Cuarta tanda, punto 6: lo que el CRM no registra no se ofrece (el motor la sigue evaluando abajo).
  assert.ok(!a.has('confirmo_sin_pago'), 'volvió «Confirmó la compra y no pagó»');
  for (const x of ['completo_clase', 'completo_modulo', 'avance_curso', 'comento_post', 'envio_tarea', 'etapa_entrega']) assert.ok(e.has(x), `falta ${x}`);
});

test('una condición de lista sin catálogo NO se ofrece (no hay con qué completarla)', () => {
  const sin = ids(seccionesDeCondiciones('entrega', { productos: [] }));
  for (const x of ['completo_clase', 'completo_modulo', 'avance_curso', 'comento_post', 'envio_tarea', 'etapa_entrega']) assert.ok(!sin.has(x), `${x} se ofreció sin catálogo`);
  assert.ok(sin.has('publico_comunidad'), 'una sin valor se ofrece siempre');
  assert.ok(!ids(seccionesDeCondiciones('adquisicion', {})).has('campana_meta'));
});

// ── Evaluar ────────────────────────────────────────────────────────────────────

test('«no sé» NO se cumple, ni negado: un no-show sólo con la asistencia registrada en false', () => {
  const sinDato = H({ lead: leadBase() });
  assert.equal(cumpleFila({ campo: 'asistio_r1' }, sinDato), false);
  assert.equal(cumpleFila({ campo: 'asistio_r1', no: true }, sinDato), false, 'sin reunión no es un no-show');
  assert.equal(cumpleFila({ campo: 'asistio_r1', no: true }, H({ lead: leadBase({ r1: { fechaMs: AHORA - 1, asistio: false } }) })), true);
  // Sin el bloque leído (la fuente no se pidió), tampoco.
  assert.equal(cumpleFila({ campo: 'calificado', no: true }, H()), false);
  assert.equal(cumpleFila({ campo: 'inventado', no: true }, H({ lead: leadBase() })), false);
  // Sin visitante no se sabe si reprodujo el VSL.
  assert.equal(cumpleFila({ campo: 'reprodujo_vsl', no: true }, H({ vsl: null })), false);
  assert.equal(cumpleFila({ campo: 'reprodujo_vsl', no: true }, H({ vsl: { plays: 0, maxPct: null } })), true);
});

test('las numéricas comparan con su operador, y la negación no aplica', () => {
  const h = H({ pagos: { pagadas: 3, vencidas: 2 } });
  assert.equal(cumpleFila({ campo: 'cuotas_vencidas', op: 'mayor_igual', valor: 2 }, h), true);
  assert.equal(cumpleFila({ campo: 'cuotas_vencidas', op: 'mayor_igual', valor: 3 }, h), false);
  assert.equal(cumpleFila({ campo: 'cuotas_vencidas', op: 'menor_igual', valor: 2 }, h), true);
  assert.equal(cumpleFila({ campo: 'cuotas_pagadas', valor: 3, no: true }, h), true, 'un número no se niega');
  const r = H({ lead: leadBase({ proximaReunionMs: AHORA + 20 * 3_600_000 }) });
  assert.equal(cumpleFila({ campo: 'reunion_en', op: 'menor_igual', valor: 24 }, r), true);
  assert.equal(cumpleFila({ campo: 'reunion_en', op: 'menor_igual', valor: 12 }, r), false);
  assert.equal(cumpleFila({ campo: 'reunion_en', op: 'menor_igual', valor: 24 }, H({ lead: leadBase() })), false, 'sin reunión no hay «en N h»');
});

test('los «eventos» de antes como condiciones: misma regla que sus cohortes', () => {
  assert.equal(cumpleFila({ campo: 'form_sin_agenda' }, H({ lead: leadBase() })), true);
  assert.equal(cumpleFila({ campo: 'form_sin_agenda' }, H({ lead: leadBase({ r1: { fechaMs: AHORA + 1, asistio: null } }) })), false);
  assert.equal(cumpleFila({ campo: 'vsl_poco' }, H({ lead: leadBase(), vsl: { plays: 1, maxPct: 20 } })), true);
  assert.equal(cumpleFila({ campo: 'vsl_sin_agendar' }, H({ lead: leadBase(), vsl: { plays: 1, maxPct: 80 } })), true);
  assert.equal(cumpleFila({ campo: 'r1_pendiente' }, H({ lead: leadBase({ r1: { fechaMs: AHORA + 3_600_000, asistio: null } }) })), true);
  assert.equal(cumpleFila({ campo: 'r1_pendiente' }, H({ lead: leadBase({ r1: { fechaMs: AHORA - 48 * 3_600_000, asistio: null } }) })), false);
  assert.equal(cumpleFila({ campo: 'confirmo_sin_pago' }, H({ lead: leadBase({ confirmoCompra: true }) }, { pago: false })), true);
});

test('curso, comunidad, entrega y respuestas', () => {
  const h = H({
    curso: { completas: new Set([11]), enviadas: new Set([12]), aprobadas: new Set(), modulosCompletos: new Set(['3:m1']), avance: new Map([[3, 50]]) },
    comunidad: { posts: 0, comentarios: 1, comentoPosts: new Set([50]) },
    entrega: new Set(['3:hito1']),
    respuestas: normalizarTexto('Tengo EXPERIÉNCIA en inmuebles'),
    estadoCliente: 'activo',
  });
  assert.equal(cumpleFila({ campo: 'completo_clase', valor: 11 }, h), true);
  assert.equal(cumpleFila({ campo: 'completo_clase', valor: 12, no: true }, h), true);
  assert.equal(cumpleFila({ campo: 'completo_modulo', valor: '3:m1' }, h), true);
  assert.equal(cumpleFila({ campo: 'avance_curso', op: 'mayor_igual', valor: 50, ref: 3 }, h), true);
  assert.equal(cumpleFila({ campo: 'avance_curso', op: 'mayor_igual', valor: 50, ref: 99 }, h), false, 'un curso sin clases no tiene avance');
  assert.equal(cumpleFila({ campo: 'tarea_aprobada', valor: 12, no: true }, h), true);
  assert.equal(cumpleFila({ campo: 'publico_comunidad', no: true }, h), true);
  assert.equal(cumpleFila({ campo: 'comento_post', valor: 50 }, h), true);
  assert.equal(cumpleFila({ campo: 'etapa_entrega', valor: '3:hito1' }, h), true);
  assert.equal(cumpleFila({ campo: 'etapa_entrega', valor: '3:onboarding' }, h), false);
  assert.equal(cumpleFila({ campo: 'respuesta_contiene', valor: 'experiencia' }, h), true);
  assert.equal(cumpleFila({ campo: 'respuesta_contiene', valor: 'experiencia', no: true }, H({ respuestas: '' })), false, 'sin respuestas no se afirma nada');
  assert.equal(cumpleFila({ campo: 'estado_cliente', valor: 'graduado', no: true }, h), true);
});

// ── Validar y guardar ──────────────────────────────────────────────────────────

const cond = (filas: FilaCondicion[]): PasoGrafo[] => [
  { id: 'c', nodo: 'condicion', ramas: [{ id: 'r1', modo: 'todas', filas, siguiente: null }], si_no: null },
];

test('validarGrafo frena lo que la fila necesita y no tiene', () => {
  const errs = (f: Parameters<typeof cond>[0]) => validarGrafo(cond(f)).join(' | ');
  assert.match(errs([{ campo: 'completo_clase' }]), /falta elegir «Completó la clase»/);
  assert.match(errs([{ campo: 'cuotas_vencidas', op: 'mayor_igual' }]), /falta el número/);
  assert.match(errs([{ campo: 'avance_curso', op: 'mayor_igual', valor: 50 }]), /falta elegir el curso/);
  assert.match(errs([{ campo: 'respuesta_contiene', valor: '  ' }]), /falta el texto/);
  assert.match(errs([{ campo: 'inventada' }]), /condición desconocida: inventada/);
  assert.match(errs([{ campo: 'etiqueta' }]), /falta elegir la etiqueta en la condición c/);
  assert.equal(errs([{ campo: 'avance_curso', op: 'menor_igual', valor: 20, ref: 3 }, { campo: 'publico_comunidad', no: true }]), '');
  assert.equal(problemaDeFila({ campo: 'agendo', no: true }), null);
});

test('el saneo de lo que se guarda CONSERVA el operador y la referencia (la quinta puerta)', () => {
  const p = camposDelFlujo({
    id: 'c', nodo: 'condicion', si_no: null,
    ramas: [{ id: 'r1', modo: 'cualquiera', siguiente: null, filas: [
      { campo: 'avance_curso', op: 'menor_igual', valor: 30, ref: '3' },
      { campo: 'cuotas_vencidas', op: 'mayor_igual', valor: 1, no: true },
      { campo: 'completo_clase', valor: 11, no: true },
      { campo: 'inventada', valor: 1 },
      { campo: 'etapa', valor: 'agenda', funnel_id: 7 },
    ] }],
  });
  const f = p.ramas![0].filas;
  assert.deepEqual(f[0], { campo: 'avance_curso', op: 'menor_igual', valor: 30, ref: 3 });
  assert.deepEqual(f[1], { campo: 'cuotas_vencidas', op: 'mayor_igual', valor: 1 }, 'un número no se guarda negado');
  assert.deepEqual(f[2], { campo: 'completo_clase', valor: 11, no: true });
  assert.deepEqual(f[3], { campo: 'etapa', valor: 'agenda', funnel_id: 7 }, 'la desconocida se descarta; las de antes valen tal cual');
  assert.equal(f.length, 4);
  assert.equal(filasDelFlujo([{ id: 'x', cuerpo: 'hola' }, ...cond([{ campo: 'pago' }])]).length, 1);
});

// ── Lo que se lee y cómo se dice ───────────────────────────────────────────────

test('fuentesDeFilas pide sólo lo que las filas usan; la entrega, sólo las etapas nombradas', () => {
  assert.deepEqual([...fuentesDeFilas([{ campo: 'agendo' }])].sort(), ['lead']);
  assert.deepEqual([...fuentesDeFilas([{ campo: 'etiqueta', valor: 1 }, { campo: 'vsl_poco' }])].sort(), ['etiquetas', 'lead', 'vsl']);
  assert.deepEqual(etapasEntregaDeFilas([{ campo: 'etapa_entrega', valor: '3:hito1' }, { campo: 'etapa_entrega', valor: '3:hito1' }, { campo: 'etapa_entrega', valor: 'x' }]), [{ productoId: 3, etapa: 'hito1' }]);
});

test('la tarjeta dice la frase con el nombre de lo elegido', () => {
  const n = nombresCatalogoDe(CAT);
  assert.equal(textoCondicion({ campo: 'completo_clase', valor: 11 }, n), 'Completó la clase «Bienvenida»');
  assert.equal(textoCondicion({ campo: 'cuotas_vencidas', op: 'mayor_igual', valor: 2 }), 'Cuotas vencidas ≥ 2');
  assert.equal(textoCondicion({ campo: 'avance_curso', op: 'menor_igual', valor: 30, ref: 3 }, n), 'Avance del curso ≤ 30 % · Programa');
  assert.equal(textoCondicion({ campo: 'origen', valor: 'calcom', no: true }), 'Origen no es: Cal.com');
  assert.equal(textoFila({ campo: 'etapa_entrega', valor: '3:hito1' }, { catalogo: n }), 'Está en la etapa de entrega «Hito 1»');
  assert.equal(textoFila({ campo: 'agendo', no: true }), 'No agendó', 'las de antes, como siempre');
  assert.deepEqual(filaNueva('vsl_pct', true), { campo: 'vsl_pct', op: 'mayor_igual', valor: 50 });
  assert.deepEqual(filaNueva('completo_clase', true), { campo: 'completo_clase', no: true });
});

test('armarCursos: sólo productos con clases, módulos con clases, en orden', () => {
  const c = armarCursos(
    [{ id: 3, nombre: 'Programa' }, { id: 4, nombre: 'Sin curso' }],
    [{ id: 12, productoId: 3, etapa: 'm2', orden: 1, titulo: 'B', tieneTarea: true }, { id: 11, productoId: 3, etapa: 'm1', orden: 2, titulo: 'A', tieneTarea: false }],
    new Map([[3, [{ clave: 'm1', nombre: 'Uno' }, { clave: 'm2', nombre: 'Dos' }, { clave: 'm3', nombre: 'Vacío' }]]]),
  );
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].modulos.map((m) => m.clave), ['m1', 'm2']);
  assert.deepEqual(c[0].clases.map((k) => k.id), [11, 12]);
});

// ── Los resúmenes del motor (puros) ────────────────────────────────────────────

test('resumenCursoDeAlumno: completas por la regla del portal, módulos enteros y el UNIVERSO de cursos', () => {
  const clase = (id: number, productoId: number, etapa: string, tarea = ''): ClaseParaResumen => ({
    id, productoId, etapa, tarea, campos: [], videoTipo: 'youtube', videoUrl: 'https://youtu.be/x', videoPath: null,
  });
  const clases = [clase(1, 3, 'm1'), clase(2, 3, 'm1', 'Haz X'), clase(3, 3, 'm2'), clase(9, 5, 'a')];
  const r = resumenCursoDeAlumno(clases, new Map([
    [1, { estado: 'pendiente' as const, pct: 95, hechaAt: null }],
    [2, { estado: 'enviada' as const, pct: 0, hechaAt: null }],
    [3, { estado: 'pendiente' as const, pct: 10, hechaAt: null }],
  ]));
  assert.deepEqual([...r.completas].sort(), [1, 2]);
  assert.deepEqual([...r.enviadas], [2]);
  assert.deepEqual([...r.modulosCompletos], ['3:m1']);
  assert.equal(r.avance.get(3), 67);
  assert.equal(r.avance.get(5), 0, 'un curso que no empezó está en 0 %, no ausente');
  assert.equal(resumenCursoDeAlumno(clases, undefined).avance.get(3), 0);
});

test('resumenPagos y catalogoDeLead', () => {
  assert.deepEqual(resumenPagos([
    { pagado: true, fecha_esperada: '2026-09-01' }, { pagado: false, fecha_esperada: '2026-10-01' },
    { pagado: null, fecha_esperada: '2026-10-09' }, { pagado: false, fecha_esperada: null },
  ], '2026-10-09'), { pagadas: 1, vencidas: 1 });
  const l = catalogoDeLead({ origen_lead: 'calcom', meta_lead_id: null, visitor_id: 'v1', fecha_junta_1: '2026-10-10', asistio_j1: null, meta_campaign_name: '  VSL  ' }, AHORA);
  assert.equal(l.origen, 'calcom');
  assert.equal(l.conVisitante, true);
  assert.equal(l.campana, 'VSL');
  assert.ok(l.r1.fechaMs && l.proximaReunionMs === l.r1.fechaMs);
});

// ── La pantalla y la ruta ──────────────────────────────────────────────────────

test('el editor: frases, «＋ Condición» por secciones, «Todas / Cualquiera» y sin los botoncitos «+y +o»', () => {
  const src = sinComentarios(leer('../app/chatbot/EditorCondicion.tsx'));
  assert.doesNotMatch(src, />\s*\+ ?[yo]\s*</, 'volvieron los botones «+ y» / «+ o»');
  assert.match(src, /seccionesDeCondiciones\(ambito, cat\)/);
  assert.match(src, /＋ Condición/);
  assert.match(src, /'Todas'/);
  assert.match(src, /'Cualquiera'/);
  assert.match(src, /＋ Rama/);
  assert.match(src, /maxWidth: ANCHO/);
  assert.doesNotMatch(src, /<select/, 'nada de <select> nativo');
});

test('la ruta del catálogo lee lo mismo que el motor: sin papelera ni hilos de clase', () => {
  const src = sinComentarios(leer('../app/api/chat-agent/condiciones/route.ts'));
  assert.match(src, /'curso_clases'[\s\S]{0,200}is\('borrada_at', null\)/);
  assert.match(src, /from\('comunidad_posts'\)[\s\S]{0,120}is\('clase_id', null\)/);
  assert.match(src, /rol !== 'admin'/);
});
