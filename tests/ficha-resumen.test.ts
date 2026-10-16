// =============================================================================
// El Resumen NATIVO de la ficha del lead: lo que dice cada bloque, cuándo se calla, sus plantillas y su cableado
// =============================================================================
// Martín, 16/10/2026: «completamente diferente en diseño y funcionalidad... NO tengas miedo a ELIMINAR todo lo que
// existe hoy... Los datos de los leads se van a guardar». Cada bloque del Resumen dejó de envolver una tarjeta de antes
// y es una pieza propia (app/crm/lead-view/ficha/resumen/), con lo que DICE en un módulo puro (resumen/logica.ts) y
// cuándo se calla en reglas-resumen.ts. Se prueba EJECUTANDO eso; el montaje (que cada bloque reciba `epico`, que la
// siguiente acción lleve a donde se resuelve) se lee del fuente, sin comentarios.
//
// Correr: node --import tsx --test tests/ficha-resumen.test.ts
//
// ⚠️ VERIFICADO ROMPIÉNDOLO (16/10/2026, base 8/0), cada rotura restaurada de memoria antes de la siguiente:
//   · `estadoReuniones` sin mirar lo que la etapa pide (una asistencia pedida no tiene dónde marcarse)   → 7 / 1
//   · `yaPaso` sin hora con el día de HOY como pasado («¿vino?» a la mañana)                         → 7 / 1
//   · la siguiente acción con la próxima reunión ANTES que la asistencia sin marcar                 → 7 / 1
//   · `tiempoEnEtapa` inventando días sin saber desde cuándo                                         → 7 / 1
//   · el ámbar del plazo desde la mitad (y no el último cuarto)                                      → 7 / 1
//   · `respuestasPorFuente` sin lo que contestó al agendar                                           → 7 / 1
//   · `respuestaA` distinguiendo tildes y signos                                                     → 7 / 1
//   · el ingreso estimado dibujado en un ganado                                                      → 7 / 1
//   · una plantilla del Resumen sin un bloque de la lista de su tipo (`resumen-carrito` sin notas)   → 7 / 1
//   · un tipo de funnel sin plantilla de Resumen sugerida (`resumen-charla` sin `sugeridaPara`)      → 7 / 1
//   · la siguiente acción sin `ctx.solucionar` («Completar» no lleva a ningún lado)                  → 7 / 1
//   · la API sin `opciones` en la traducción                                                         → 7 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { bloqueDef, vaEnTab } from '../lib/ficha/catalogo';
import { IDS_PLANTILLA, listaDePlantilla, plantillaFicha } from '../lib/ficha/plantillas';
import { plantillaTabDeEntrada, plantillasDeTab } from '../lib/ficha/plantillas-tab';
import { PLANTILLAS_TAB_RESUMEN } from '../lib/ficha/plantillas-resumen';
import { fichaEfectiva, RESPALDO_VACIO } from '../lib/ficha/config';
import { cambioDeInputApi } from '../lib/ficha/api';
import {
  canalDeEntrada, cuandoRelativo, estadoReuniones, origenDelLead, paginaLegible, preguntasDelLead, respuestaA, respuestasPorFuente,
  siguienteAccionDe, tiempoEnEtapa, yaPaso, type EstadoReuniones,
} from '../app/crm/lead-view/ficha/resumen/logica';
import { REGLAS_RESUMEN, siguienteDelCtx } from '../app/crm/lead-view/ficha/reglas-resumen';
import type { CtxFicha } from '../app/crm/lead-view/ficha/tipos';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const ids = (l: ReadonlyArray<{ id: string }>) => l.map((b) => b.id);

const HOY = '2026-10-16';
const AHORA = Date.parse('2026-10-16T15:00:00Z');

/** Un lead de prueba, con lo que leen las reglas. */
function ctxDe(lead: Record<string, unknown> = {}, data: Record<string, unknown> = {}, etapa = 'lead'): CtxFicha {
  return {
    data: { respuestasForm: [], respuestasLanding: [], respuestas: { R1: [], R2: [] }, campana: { texto: null, tooltip: null }, adNombre: null, adId: null, insights: [], ...data },
    lead: { id: 1, nombre: 'Ana', estado_lead: 'abierto', ...lead }, stages: [], etapa, hoy: HOY, rol: 'admin', esAdmin: true, verPrivado: true,
    releer: () => {}, parchear: () => {}, irATab: () => {}, solucionar: () => {},
  } as unknown as CtxFicha;
}
const vacio = (id: keyof typeof REGLAS_RESUMEN, ctx: CtxFicha, opciones?: Record<string, unknown>): boolean => {
  const r = REGLAS_RESUMEN[id] as { estaVacio?: (c: CtxFicha, p: never) => boolean };
  return !!r.estaVacio?.(ctx, { id, ancho: 12, diseno: '', ...(opciones ? { opciones } : {}) } as never);
};

test('las reuniones: la que viene, la que pasó sin marcar y la fecha que la etapa pide', () => {
  // La R1 mañana con hora: viene, en un día.
  const e = estadoReuniones({ fecha_junta_1: '2026-10-17', junta_1_at: '2026-10-17T16:00:00Z', junta_1_url: 'https://meet.x/1' }, { ahoraMs: AHORA, hoy: HOY, pide: [] });
  assert.equal(e.proxima?.cual, 'r1');
  assert.equal(e.proxima?.dias, 1);
  assert.equal(e.proxima?.url, 'https://meet.x/1');
  assert.deepEqual(e.sinMarcar, []);
  // La R1 de ayer sin asistencia: «¿Vino?», y la R2 que viene es la próxima.
  const ayer = estadoReuniones({ fecha_junta_1: '2026-10-15', asistio_j1: null, fecha_junta_2: '2026-10-20' }, { ahoraMs: AHORA, hoy: HOY, pide: [] });
  assert.deepEqual(ayer.sinMarcar.map((r) => r.cual), ['r1']);
  assert.equal(ayer.proxima?.cual, 'r2');
  // ⚠️ La asistencia que la etapa PIDE tiene dónde marcarse aunque el reloj no diga que pasó: «Solucionar» la busca acá.
  const pedida = estadoReuniones({ fecha_junta_1: '2026-10-17', asistio_j1: null }, { ahoraMs: AHORA, hoy: HOY, pide: ['asistenciaR1'] });
  assert.deepEqual(pedida.sinMarcar.map((r) => r.cual), ['r1']);
  assert.equal(pedida.proxima, null, 'una reunión no es la próxima y la pendiente a la vez');
  // La fecha de la junta pedida: la R1 sólo agendada (sin fecha de junta) la pide; con fecha, no.
  assert.deepEqual(estadoReuniones({ fecha_agenda: '2026-10-20' }, { ahoraMs: AHORA, hoy: HOY, pide: ['fechaJ1'] }).fechasPedidas, ['r1']);
  assert.deepEqual(estadoReuniones({ fecha_junta_1: '2026-10-20' }, { ahoraMs: AHORA, hoy: HOY, pide: ['fechaJ1'] }).fechasPedidas, []);
  // Sin hora, la de HOY no pasó (preguntar «¿vino?» a la mañana sería preguntar antes de tiempo); la de ayer, sí.
  assert.equal(yaPaso({ cual: 'r1', fecha: HOY, at: null, url: null, asistio: null }, AHORA, HOY), false);
  assert.equal(yaPaso({ cual: 'r1', fecha: '2026-10-15', at: null, url: null, asistio: null }, AHORA, HOY), true);
  assert.deepEqual([0, 1, -1, 3, -4].map(cuandoRelativo), ['hoy', 'mañana', 'ayer', 'en 3 días', 'hace 4 días']);
});

test('la siguiente acción: la primera que exista gana, y el botón lleva a donde se resuelve', () => {
  const nombre = (c: 'r1' | 'r2') => (c === 'r1' ? 'Agenda R1' : 'Agenda R2');
  const sinNada: EstadoReuniones = { proxima: null, sinMarcar: [], fechasPedidas: [] };
  const base = { nombreReunion: nombre, hora: () => '10:00', pasoLlamada: null, proximaAccion: null, faltan: [] };
  assert.equal(siguienteAccionDe({ ...base, reuniones: sinNada }), null, 'sin nada escrito, no se inventa una');
  const r1 = { cual: 'r1' as const, fecha: '2026-10-15', at: null, url: null, asistio: null };
  const r2 = { cual: 'r2' as const, fecha: '2026-10-20', at: '2026-10-20T16:00:00Z', url: 'https://meet.x/2', asistio: null, dias: 4 };
  const todo = { ...base, reuniones: { proxima: r2, sinMarcar: [r1], fechasPedidas: [] }, pasoLlamada: 'Mandar la propuesta', proximaAccion: 'Llamar', faltan: [{ id: 'telefono' as const, label: 'Teléfono' }] };
  const a = siguienteAccionDe(todo)!;
  assert.equal(a.clase, 'asistencia', 'lo que pasó sin marcar va primero');
  assert.equal(a.titulo, '¿Vino a Agenda R1?');
  assert.deepEqual(a.boton?.accion, { tipo: 'solucionar', paso: 'asistenciaR1' });
  const b = siguienteAccionDe({ ...todo, reuniones: { ...todo.reuniones, sinMarcar: [] } })!;
  assert.equal(b.titulo, 'Agenda R2 en 4 días');
  assert.deepEqual(b.boton?.accion, { tipo: 'entrar', url: 'https://meet.x/2' });
  const c = siguienteAccionDe({ ...todo, reuniones: sinNada })!;
  assert.deepEqual([c.clase, c.detalle, c.boton?.accion], ['llamada', 'Mandar la propuesta', { tipo: 'tab', tab: 'reuniones' }]);
  const d = siguienteAccionDe({ ...todo, reuniones: sinNada, pasoLlamada: null })!;
  assert.deepEqual([d.clase, d.boton?.accion], ['insight', { tipo: 'tab', tab: 'insights' }]);
  const f = siguienteAccionDe({ ...base, reuniones: sinNada, faltan: [{ id: 'telefono', label: 'Teléfono' }, { id: 'empresa', label: 'Empresa' }] })!;
  assert.deepEqual([f.titulo, f.detalle, f.boton?.accion], ['Faltan 2 datos', 'Teléfono · Empresa', { tipo: 'solucionar', paso: 'telefono' }]);
  // El bloque se calla con la MISMA regla (`siguienteDelCtx`): un lead sin nada, vacío; con un dato sin marcar, no.
  assert.equal(vacio('siguiente-accion', ctxDe()), true);
  assert.equal(vacio('siguiente-accion', ctxDe({}, { datos: { avisar: [{ id: 'telefono', label: 'Teléfono' }], ocultos: [] } })), false);
  assert.equal(siguienteDelCtx(ctxDe({}, { insights: [{ next_step: 'Mandar la propuesta' }] }))?.clase, 'llamada');
});

test('cuánto lleva en la etapa: contra el plazo, y sin historial no se afirma un número', () => {
  assert.equal(tiempoEnEtapa(null, 10, AHORA), null, 'sin saber desde cuándo, no hay número');
  assert.deepEqual(tiempoEnEtapa('2026-10-14T15:00:00Z', null, AHORA), { dias: 2, plazo: null, tono: 'gris', pct: null });
  assert.equal(tiempoEnEtapa('2026-10-14T15:00:00Z', 10, AHORA)?.tono, 'verde');
  assert.equal(tiempoEnEtapa('2026-10-08T15:00:00Z', 10, AHORA)?.tono, 'ambar', 'en el último cuarto del plazo');
  assert.equal(tiempoEnEtapa('2026-10-09T15:00:00Z', 10, AHORA)?.tono, 'verde', 'a la mitad todavía va bien');
  assert.deepEqual(tiempoEnEtapa('2026-10-01T15:00:00Z', 10, AHORA), { dias: 15, plazo: 10, tono: 'rojo', pct: 100 });
  assert.equal(vacio('tiempo-en-etapa', ctxDe({}, {}, 'ganado')), true, 'una etapa que terminó no tiene reloj');
  assert.equal(vacio('tiempo-en-etapa', ctxDe({}, {}, 'agenda')), false);
});

test('lo que contestó: las tres fuentes en su orden, y una respuesta destacada sin mirar tildes', () => {
  const d = {
    respuestasForm: [{ pregunta: '¿Cuál es tu presupuesto?', respuesta: 'USD 120.000' }, { pregunta: 'Zona', respuesta: ' ' }],
    respuestasLanding: [{ pregunta: 'Zona', respuesta: 'Palermo' }],
    respuestas: { R1: [{ q: '¿Qué buscas?', a: 'Vender' }] },
  };
  assert.deepEqual(respuestasPorFuente(d).map((f) => [f.fuente, f.respuestas.length]), [['meta', 1], ['landing', 1], ['agenda', 1]], 'una respuesta vacía no cuenta');
  assert.deepEqual(respuestasPorFuente(d, ['agenda', 'meta']).map((f) => f.fuente), ['agenda', 'meta'], 'en el orden elegido');
  assert.deepEqual(preguntasDelLead(d), ['¿Cuál es tu presupuesto?', 'Zona', '¿Qué buscas?']);
  assert.equal(respuestaA(d, 'cual es tu PRESUPUESTO')?.respuesta, 'USD 120.000');
  assert.equal(respuestaA(d, 'zona')?.fuente, 'landing', 'de la primera fuente que la tenga contestada');
  assert.equal(respuestaA(d, null), null);
  assert.equal(vacio('respuesta-destacada', ctxDe({}, d)), true, 'sin la pregunta elegida, no hay nada que destacar');
  assert.equal(vacio('respuesta-destacada', ctxDe({}, d), { pregunta: 'Zona' }), false);
  assert.equal(vacio('lo-que-contesto', ctxDe({}, d), { fuentes: ['landing'] }), false);
  assert.equal(vacio('lo-que-contesto', ctxDe({}, { respuestasForm: d.respuestasForm }), { fuentes: ['landing'] }), true, 'con su única fuente apagada se calla');
});

test('de dónde vino, la página y cómo entró: sin atribución se calla, y el default no afirma nada', () => {
  assert.equal(origenDelLead({}, {}), null);
  const o = origenDelLead({ origen_lead: 'landing', utm_source: 'ig', utm_content: 'Video verano', meta_campaign_name: 'Verano' }, { adId: '123' })!;
  assert.deepEqual([o.canal.texto, o.fuente, o.campana, o.anuncio, o.href], ['Formulario de tu landing', 'Instagram', 'Verano', 'Video verano', '/ads-manager/123']);
  assert.equal(origenDelLead({ utm_content: '1234567890' }, {})?.anuncio, null, 'un utm_content numérico es un id, no un nombre');
  assert.equal(canalDeEntrada('inventado').texto, 'Sin dato de origen');
  assert.equal(paginaLegible('https://www.mako.com/vsl/'), 'mako.com/vsl');
  assert.equal(vacio('pagina-de-registro', ctxDe()), true);
  assert.equal(vacio('pagina-de-registro', ctxDe({ pagina_registro: 'mako.com/vsl' })), false);
  assert.equal(vacio('publicacion-de-entrada', ctxDe({ entrada_social: { canal: 'instagram', como: 'comentario', texto: 'INFO' } })), false);
  assert.equal(vacio('publicacion-de-entrada', ctxDe({ entrada_social: { canal: 'tiktok', como: 'x' } })), true, 'lo guardado se sanea al leerlo');
});

test('cuándo se callan los demás: el ingreso en un ganado, el motivo sin salida, el plazo fuera de la nutrición', () => {
  assert.equal(vacio('ingreso-estimado', ctxDe({ estado_lead: 'ganado' })), true, 'no es una venta');
  assert.equal(vacio('ingreso-estimado', ctxDe()), false);
  assert.equal(vacio('motivo-de-salida', ctxDe()), true);
  assert.equal(vacio('motivo-de-salida', ctxDe({ estado_lead: 'descalificado' })), false, 'se dibuja aunque esté vacío');
  assert.equal(vacio('plazo-nutricion', ctxDe({}, {}, 'manual')), false);
  assert.equal(vacio('posibles-duplicados', ctxDe()), true, 'sin email ni teléfono no se busca');
  assert.equal(vacio('posibles-duplicados', ctxDe({ email: 'ana@x.com' })), false);
  assert.equal(vacio('redes-y-web', ctxDe(), { redes: [] }), true, 'sin ninguna red elegida');
  assert.equal(vacio('proxima-reunion', ctxDe()), true);
  assert.equal(vacio('proxima-reunion', ctxDe({ fecha_junta_1: '2099-01-01' })), false);
  // Los diseños que declara cada componente existen en el catálogo (el primero es el de entrada).
  for (const [id, r] of Object.entries(REGLAS_RESUMEN)) {
    const def = bloqueDef(id)!;
    for (const d of (r as { disenos?: readonly string[] }).disenos ?? []) assert.ok(def.disenos.some((x) => x.id === d), `«${id}» declara el diseño «${d}», que el catálogo no tiene`);
  }
});

test('las plantillas del Resumen: válidas, sugeridas para los nueve tipos, y sin perder un bloque de la lista de su tipo', () => {
  const galeria = plantillasDeTab('resumen');
  assert.equal(galeria[0].id, 'resumen-en-blanco');
  assert.deepEqual(galeria.slice(1).map((p) => p.id), PLANTILLAS_TAB_RESUMEN.map((p) => p.id), 'la galería del Resumen es la armada');
  assert.ok(galeria.some((p) => p.id === 'resumen-epica' && p.epico), 'la épica (el mismo id del marco)');
  for (const p of PLANTILLAS_TAB_RESUMEN) {
    assert.equal(p.tab, 'resumen');
    assert.ok(p.nombre.length <= 22 && p.bajada.length > 0);
    for (const b of p.bloques) {
      const def = bloqueDef(b.id);
      assert.ok(def && vaEnTab(def, 'resumen'), `«${p.id}»: ${b.id} no va en el Resumen`);
      if (b.ancho) assert.ok(def!.anchos.includes(b.ancho), `«${p.id}»: ${b.id} no va de ${b.ancho}`);
      if (b.diseno) assert.ok(def!.disenos.some((d) => d.id === b.diseno), `«${p.id}»: ${b.id} no tiene el diseño ${b.diseno}`);
      const sabe = (REGLAS_RESUMEN as Record<string, { disenos?: readonly string[] }>)[b.id]?.disenos;
      if (sabe && b.diseno) assert.ok(sabe.includes(b.diseno), `«${p.id}»: el componente de ${b.id} no dibuja «${b.diseno}»`);
    }
    assert.equal(new Set(ids(p.bloques)).size, p.bloques.length, `«${p.id}» repite un bloque`);
  }
  for (const tipo of IDS_PLANTILLA) {
    const entrada = plantillaTabDeEntrada('resumen', tipo);
    assert.equal(PLANTILLAS_TAB_RESUMEN.filter((p) => p.sugeridaPara?.includes(tipo)).length, 1, `el tipo «${tipo}» tiene una plantilla de Resumen sugerida`);
    assert.ok(PLANTILLAS_TAB_RESUMEN.includes(entrada), `«${tipo}» entra con una del Resumen armado`);
    // ⚠️ La plantilla del FUNNEL decide los avisos: cada bloque de la lista de su tipo está en el Resumen de entrada,
    //    así ningún aviso prendido se queda sin dónde llenarse.
    const faltan = listaDePlantilla(plantillaFicha(tipo), 'resumen').filter((id) => !ids(entrada.bloques).includes(id));
    assert.deepEqual(faltan, [], `«${tipo}» perdió bloques de la lista de su tipo`);
    assert.deepEqual(ids(fichaEfectiva(tipo, {}, RESPALDO_VACIO).tabs.resumen).filter((id) => !['direccion', 'sexo'].includes(id)).length > 0, true);
  }
  assert.ok(!PLANTILLAS_TAB_RESUMEN.find((p) => p.id === 'resumen-epica')!.sugeridaPara, 'la épica se elige, no se sugiere');
});

test('CABLEADO: cada bloque recibe la vista épica, la siguiente acción lleva a donde se resuelve, y las opciones', () => {
  const carpeta = 'app/crm/lead-view/ficha/resumen';
  const fuente = readdirSync(resolve(RAIZ, carpeta)).filter((f) => f.endsWith('.tsx')).map((f) => sinComentarios(leer(`${carpeta}/${f}`))).join('\n');
  const reg = sinComentarios(leer('app/crm/lead-view/ficha/registro-resumen.tsx'));
  const componentes = [...reg.matchAll(/\{ Componente: (\w+),/g)].map((m) => m[1]);
  assert.equal(componentes.length, Object.keys(REGLAS_RESUMEN).length);
  for (const c of new Set(componentes)) {
    const m = fuente.match(new RegExp(`export function ${c}\\(\\{([^}]*)\\}: PropsBloque\\)`));
    assert.ok(m, `no encontré el bloque ${c}`);
    assert.match(m![1], /\bepico\b/, `${c} no recibe la vista épica`);
  }
  for (const vieja of ['InfoPrincipalCard', 'CalificacionCard', 'RespuestasFormulario', 'OrigenCard', 'MotivoCard', 'PlazoNutricionCard']) {
    assert.ok(!reg.includes(vieja) && !fuente.includes(`<${vieja}`), `el Resumen volvió a montar ${vieja}`);
  }
  // La siguiente acción: «Completar» es el MISMO camino que la cabecera, y «Ver llamada» cambia de tab.
  assert.match(fuente, /else if \(a\.tipo === 'tab'\) ctx\.irATab\(a\.tab\);\s*else ctx\.solucionar\(a\.paso\);/);
  const ficha = sinComentarios(leer('app/crm/lead-view/ficha/FichaPorBloques.tsx'));
  assert.match(ficha, /irATab: \(clave\) => setIrA\(\{ key: clave, n: Date\.now\(\) \}\),/);
  assert.match(ficha, /solucionar: \(paso\) => solucionar\(paso, Date\.now\(\)\),/);
  assert.match(ficha, /if \(pedido\) solucionar\(pedido\.id, pedido\.n\);/, 'la cabecera y los bloques: un solo camino');
  // Un bloque que lee lo suyo al montarse y no tiene nada no deja hueco (los duplicados).
  assert.match(leer('app/crm/lead-view/ficha/ficha-css.ts'), /\.fb:not\(\.fb--editando\) \.fb-bloque:has\(> \.fb-cuerpo:empty\) \{ display: none; \}/);
  // Las opciones de un bloque, en «Personalizar» y en la API de MaKo (lo que hace la pantalla lo hace MaKo).
  const armador = sinComentarios(leer('app/crm/lead-view/ficha/Armador.tsx'));
  assert.match(armador, /onCambio\(\{ op: 'opciones', tab, bloque: id, n: b\.n, opciones: o \}\)/);
  assert.match(armador, /preguntas=\{b\.def\.opciones\?\.includes\('pregunta'\) \? preguntasDelLead\(ctx\.data\) : \[\]\}/);
  assert.deepEqual(cambioDeInputApi({ cambio: 'opciones', tab: 'resumen', bloque: 'redes-y-web', opcion: 'web, LinkedIn' }), { op: 'opciones', tab: 'resumen', bloque: 'redes-y-web', opciones: { redes: ['web', 'linkedin'] } });
  assert.deepEqual(cambioDeInputApi({ cambio: 'opciones', tab: 'resumen', bloque: 'lo-que-contesto', opcion: 'agenda' }), { op: 'opciones', tab: 'resumen', bloque: 'lo-que-contesto', opciones: { fuentes: ['agenda'] } });
  assert.deepEqual(cambioDeInputApi({ cambio: 'opciones', tab: 'resumen', bloque: 'respuesta-destacada', opcion: 'Zona' }), { op: 'opciones', tab: 'resumen', bloque: 'respuesta-destacada', opciones: { pregunta: 'Zona' } });
  const mala = cambioDeInputApi({ cambio: 'opciones', tab: 'resumen', bloque: 'redes-y-web', opcion: 'tiktok' });
  assert.ok('error' in mala && (mala.disponibles as string[]).includes('linkedin'), 'una red que no existe vuelve con las que hay');
  assert.ok('error' in cambioDeInputApi({ cambio: 'opciones', tab: 'resumen', bloque: 'notas', opcion: 'x' }), 'un bloque sin opciones');
});
