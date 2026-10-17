// =============================================================================
// El paso «⚡ Acción»: la lista corta, el control de cada campo y los campos que dependen de otro
// =============================================================================
// Tercera tanda (09/10/2026, punto 16), textual: «Le puse "Mover un lead de etapa" y me pide un campo
// abierto para colocar el nombre de la etapa? En lugar de un desplegable…? Y abajo me aparece "Monto" y
// "Motivo", no tiene nada de sentido… También siento que pusiste muchísimas acciones que tal vez no son
// necesarias». Decisión 16 del diseño (docs/chatbot-flujo-ramas-diseno.md).
// Segunda tanda (08/10/2026, punto 7), lo que sigue valiendo: los rótulos con tildes, la línea de qué
// hace, lo que llena el flujo no se dibuja, el lead del evento es una línea, lo opcional plegado.
//
// Lo que se EJECUTA: lib/editor-acciones.ts (lista corta, rótulos, resumen, secciones, controles,
// visibilidad, lo que pide una etapa) contra el REGISTRO de verdad, y el formulario del editor
// renderizado con renderToStaticMarkup. Lo que se LEE del fuente (sin comentarios, CRLF normalizado):
// que el selector vaya por secciones y que `accionesParaFlujo` aplique la lista corta.
//
// ── Roturas (09/10/2026) ── al final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { REGISTRO, porId } from '../lib/api-mako/registro';
import { AREA_INFO, type OperacionDef } from '../lib/api-mako/tipos';
import { LLENA_EL_FLUJO, LEAD_DEL_EVENTO } from '../lib/api-mako/flujo-params';
import { DEFAULT_PIPELINE } from '../lib/pipeline';
import { buildFunnel } from '../lib/funnel-fila';
import {
  rotuloDeParametro, resumenDeAccion, seccionesDeAcciones, FUERA_DEL_SELECTOR, repartoDelFormulario, naceSobreElLeadDelEvento,
  ACCIONES_DEL_FLUJO, GRUPOS_ACCION, AREAS_ACCION, AREA_DE_GRUPO, ICONO_AREA, SECCION_PUESTA, TOPE_RESUMEN, accionDelFlujo, controlDe, monedaDe,
  datosQuePideLaEtapa, visibilidadDe, productoDeLaEtapa, faltanDelFormulario, type OpcionesAccion, type ProductoDeAccion,
} from '../lib/editor-acciones';
import { esIconoMenu } from '../app/_ui/iconos-menu';
import { FormularioAccion } from '../app/_components/EditorAccionMako';
import type { AccionEditor } from '../lib/api-mako/flujo';
import { frenoDelFlujo, type PasoParaGrafo } from '../lib/flujo-conversacion';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const ACCIONES = REGISTRO.filter((d) => d.tipo === 'accion');
/** Lo mismo que arma `accionesParaFlujo` (lib/api-mako/flujo.ts), sin pasar por la vista. */
const aEditor = (d: OperacionDef): AccionEditor => {
  const lista = accionDelFlujo(d.id);
  return {
    id: d.id, area: d.area, areaTitulo: AREA_INFO[d.area]?.titulo ?? d.area, titulo: lista?.titulo ?? d.titulo, descripcion: d.descripcion,
    costo: d.costo, reversible: d.tipo === 'accion' ? d.reversible : false, pideLead: d.parametros.some((p) => p.nombre === 'leadId'),
    parametros: d.parametros.map((p) => ({ nombre: p.nombre, tipo: p.tipo, descripcion: p.descripcion, obligatorio: p.obligatorio, enum: p.enum, minimo: p.minimo, maximo: p.maximo, entero: p.entero })),
    curada: lista != null, grupo: lista?.grupo ?? null, que: lista?.que ?? null,
  };
};
const EDITOR = ACCIONES.map(aEditor);
const ed = (id: string) => aEditor(porId(id)!);

// ── La lista corta ───────────────────────────────────────────────────────────────────────────

test('⚠️ LA LISTA DEL LIENZO: ids exactos del registro, acciones de UN lead, gratis, sin JSON crudo, con su ícono', () => {
  // Sexta tanda (ACTION 1): «Faltan muchas acciones posibles que podríamos agregar». El piso es lo que
  // ofrece la sexta tanda (14 con las dos que el selector no ofrece; eran 10); el techo frena que la lista
  // vuelva a ser el registro entero (la tercera tanda: «pusiste muchísimas acciones que tal vez no son necesarias»).
  assert.ok(ACCIONES_DEL_FLUJO.length >= 14 && ACCIONES_DEL_FLUJO.length <= 30, `son ${ACCIONES_DEL_FLUJO.length}`);
  const ids = ACCIONES_DEL_FLUJO.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, 'una acción repetida');
  for (const a of ACCIONES_DEL_FLUJO) {
    const d = porId(a.id);
    assert.ok(d, `«${a.id}» no existe en el registro: el catálogo la tiraría en silencio`);
    assert.equal(d!.tipo, 'accion', a.id);
    assert.ok(d!.parametros.some((p) => p.nombre === 'leadId'), `«${a.id}» no es sobre un lead: no tiene sentido corriendo sola en un flujo`);
    // Las de FUERA_DEL_SELECTOR no se editan con el formulario genérico: «MaKo en WhatsApp» tiene su
    // propio editor (el de WhatsApp, undécima tanda), así que sus `partes` (object[]) no las escribe nadie a mano.
    if (!FUERA_DEL_SELECTOR.has(a.id)) assert.ok(!d!.parametros.some((p) => p.tipo === 'object' || p.tipo === 'object[]'), `«${a.id}» pide JSON a mano`);
    // «las de plata NO»: ni dinero ni IA, que corren y gastan en cada lead que pasa.
    assert.ok(d!.costo !== 'dinero' && d!.costo !== 'ia', `«${a.id}» cuesta (${d!.costo})`);
    assert.ok((GRUPOS_ACCION as readonly string[]).includes(a.grupo), a.id);
    assert.ok(esIconoMenu(a.icono), `«${a.id}» sin un ícono del set de la casa`);
    assert.ok(a.titulo.length <= 34 && a.que.length <= 50, `texto que se dibuja demasiado largo: ${a.id}`);
    // TAG 1: «En lugar de "Poner" y "Sacar"... "Agregar" y "Eliminar". Revisa que no esté ese error en otro lado».
    assert.doesNotMatch(`${a.titulo} ${a.que}`, /(?<!\p{L})(poner|pone|sacar|saca)(?!\p{L})/iu, `«${a.titulo}» dice poner o sacar`);
  }
  // Las que piden un valor FIJO que en un flujo miente, las que gastan y las que repiten una tarjeta, no están.
  // `mover_lead_en_producto`: mueve sólo en un producto AGREGADO, y cuál es el principal depende del lead.
  for (const id of ['mover_a_nutricion_manual', 'proponer_agendar_agenda', 'editar_contacto_lead', 'proponer_tareas_plan', 'marcar_pago_cobrado', 'generar_insight_lead', 'crear_borrador_whatsapp_empresa', 'mover_lead_en_producto']) {
    assert.equal(accionDelFlujo(id), null, `«${id}» volvió a la lista del lienzo`);
  }
  // Cada bloque cae en un área que el selector dibuja.
  for (const g of GRUPOS_ACCION) assert.ok((AREAS_ACCION as readonly string[]).includes(AREA_DE_GRUPO[g]), g);
});

test('⚠️ CADA CAMPO DE LA LISTA CORTA TIENE SU CONTROL: ningún id se tipea', () => {
  const malos: string[] = [];
  for (const a of ACCIONES_DEL_FLUJO) for (const p of porId(a.id)!.parametros) {
    const c = controlDe(p);
    if (p.nombre !== 'leadId' && /Id$|^etapa$|^closer$|^setter$/.test(p.nombre) && ['texto', 'numero', 'texto_largo'].includes(c)) malos.push(`${a.id}.${p.nombre} → ${c}`);
  }
  assert.deepEqual(malos, []);
  assert.equal(controlDe(porId('proponer_cambio_etapa')!.parametros.find((p) => p.nombre === 'etapa')!), 'etapa', 'la etapa volvió a ser un campo abierto');
  assert.equal(controlDe({ nombre: 'secuenciaId', tipo: 'number' }), 'secuencia');
  assert.equal(controlDe({ nombre: 'closer', tipo: 'string' }), 'persona');
  assert.equal(controlDe({ nombre: 'embudoId', tipo: 'number' }), 'producto');
  assert.equal(controlDe({ nombre: 'calificado', tipo: 'boolean', obligatorio: true }), 'si_no', 'un sí/no obligatorio no es una casilla destildada');
  assert.equal(controlDe({ nombre: 'deadline', tipo: 'string', descripcion: 'YYYY-MM-DD: hasta cuándo' }), 'fecha');
  assert.equal(monedaDe({ nombre: 'monto', tipo: 'number', descripcion: 'monto de cierre en USD' }), 'USD');
  assert.equal(monedaDe({ nombre: 'monto_cuota_usd', tipo: 'number' }), 'USD');
  assert.equal(monedaDe({ nombre: 'orden', tipo: 'number' }), null);
});

// ── Lo que pide una etapa ────────────────────────────────────────────────────────────────────

test('lo que pide una etapa sale de la regla del CRM, no de una lista de nombres', () => {
  const f = buildFunnel(DEFAULT_PIPELINE, [], { origen: 'sin-fila' });
  assert.deepEqual(datosQuePideLaEtapa(f.stages, 'ganado'), ['monto']);
  assert.deepEqual(datosQuePideLaEtapa(f.stages, 'perdido'), ['motivo']);
  assert.deepEqual(datosQuePideLaEtapa(f.stages, 'descal'), ['motivo']);
  for (const k of ['lead', 'agenda', 'facturando', 'noresp', 'manual']) assert.deepEqual(datosQuePideLaEtapa(f.stages, k), [], k);
  // Un funnel cuya etapa de cierre no se llama «ganado»: el monto va donde está el cierre.
  const propio = [{ key: 'lead', kind: 'entrada' }, { key: 'cerrado', kind: 'cierre' }, { key: 'ganado' }];
  assert.deepEqual(datosQuePideLaEtapa(propio, 'cerrado'), ['monto']);
});

// ── Las secciones del selector ───────────────────────────────────────────────────────────────

test('el selector ofrece SÓLO la lista del lienzo, en ÁRBOL por área; la puesta de afuera va primero', () => {
  const s = seccionesDeAcciones(EDITOR);
  // Cuarta tanda, punto 11: «Avisar al equipo» (es la tarjeta MaKo) e «Inscribir en otra automatización»
  // (se hace con una etiqueta) no se ofrecen; el área que queda vacía no se dibuja.
  const ofrecidas = ACCIONES_DEL_FLUJO.filter((a) => !FUERA_DEL_SELECTOR.has(a.id));
  // Sexta tanda (ACTION 1, «siempre con el arbol»): un ÁREA por sección, en el orden de AREAS_ACCION, con su ícono.
  assert.deepEqual(s.map((x) => x.titulo), AREAS_ACCION.filter((ar) => ofrecidas.some((a) => AREA_DE_GRUPO[a.grupo] === ar)), 'un área por sección, en orden');
  assert.deepEqual(s.map((x) => x.titulo), ['CRM', 'Customer Success', 'WhatsApp']);
  assert.ok(s.every((x) => x.icono === ICONO_AREA[x.titulo as keyof typeof ICONO_AREA]), 'cada área con su ícono');
  const enOrden = AREAS_ACCION.flatMap((ar) => ofrecidas.filter((a) => AREA_DE_GRUPO[a.grupo] === ar));
  assert.deepEqual(s.flatMap((x) => x.acciones.map((a) => a.id)), enOrden.map((a) => a.id), 'la lista, en su orden por área, y nada más');
  // Los bloques de un área quedan JUNTOS (quien dibuja pone la línea donde cambia el bloque).
  const crm = s.find((x) => x.titulo === 'CRM')!.acciones.map((a) => a.grupo);
  assert.deepEqual(crm, [...crm].sort((x, y) => GRUPOS_ACCION.indexOf(x!) - GRUPOS_ACCION.indexOf(y!)), 'un bloque partido en dos');
  assert.ok(!s.flatMap((x) => x.acciones.map((a) => a.id)).some((id) => id === 'avisar_al_equipo' || id === 'inscribir_lead_secuencia'), 'volvieron «Avisar al equipo» o «Inscribir»');
  const conAviso = seccionesDeAcciones(EDITOR, 'inscribir_lead_secuencia');
  assert.deepEqual([conAviso[0].titulo, conAviso[0].acciones.map((a) => a.id)], [SECCION_PUESTA, ['inscribir_lead_secuencia']], 'un paso que ya la tiene se sigue viendo');
  assert.ok(s.flatMap((x) => x.acciones).every((a) => a.titulo === accionDelFlujo(a.id)!.titulo), 'el nombre de lienzo, no el del registro');
  const conPuesta = seccionesDeAcciones(EDITOR, 'mover_lead_en_producto');
  assert.equal(conPuesta[0].titulo, SECCION_PUESTA);
  assert.deepEqual(conPuesta[0].acciones.map((a) => a.id), ['mover_lead_en_producto'], 'un paso guardado con una de afuera se sigue viendo');
  assert.equal(seccionesDeAcciones(EDITOR, 'proponer_cambio_etapa')[0].titulo, AREAS_ACCION[0], 'una de la lista no se duplica arriba');
});

test('el selector va POR SECCIONES y `accionesParaFlujo` aplica la lista corta', () => {
  const editor = sinComentarios(leer('app/_components/EditorAccionMako.tsx'));
  // Desde la cuarta tanda (punto 1) es el `Dropdown` y no el `Select` de app/_ui (que fija su propio
  // alto de 40); desde la sexta (CONDITION 3, «para todos lados»), el PRINCIPAL de la casa.
  const ini = editor.indexOf('<Dropdown\n          value={valor.operacion');
  const sel = editor.slice(ini, editor.indexOf('/>', ini));
  assert.ok(ini >= 0 && sel.length > 50, 'no encontré el desplegable de la acción');
  assert.match(sel, /width="100%"/, 'el desplegable de la acción va de ancho completo');
  assert.match(sel, /variante="principal"/, 'el desplegable de la acción no es el principal');
  assert.match(sel, /secciones=\{secciones\}/);
  assert.doesNotMatch(sel, /options=\{/, 'volvió la lista plana');
  assert.match(editor, /seccionesDeAcciones\(acciones, valor\.operacion\)/, 'sin la puesta, un paso viejo no muestra su acción');
  // El árbol lleva el ícono del área y el de cada acción, y la línea donde cambia el bloque.
  const arbol = editor.slice(editor.indexOf('const secciones = useMemo('), editor.indexOf('const params = valor.params'));
  assert.ok(arbol.length > 200 && arbol.length < 2_500, `el recorte del árbol mide ${arbol.length}`);
  assert.match(arbol, /icono: s\.icono \?\? 'check'/, 'el área sin su ícono');
  assert.match(arbol, /icono: accionDelFlujo\(a\.id\)\?\.icono \?\? 'accion'/, 'la acción sin su ícono');
  assert.match(arbol, /i > 0 && a\.grupo !== s\.acciones\[i - 1\]\.grupo \? \{ lineaArriba: true \}/, 'los bloques sin su línea');
  const flujo = sinComentarios(leer('lib/api-mako/flujo.ts'));
  const cat = flujo.slice(flujo.indexOf('export async function accionesParaFlujo'));
  assert.match(cat, /accionDelFlujo\(d\.id\)/);
  assert.match(cat, /curada: lista != null/);
  assert.match(cat, /titulo: lista\?\.titulo \?\? d\.titulo/);
});

// ── Los rótulos ──────────────────────────────────────────────────────────────────────────────

test('el rótulo de un parámetro: el de la def gana, después el diccionario, después el nombre con tildes', () => {
  assert.equal(rotuloDeParametro({ nombre: 'secuenciaId', rotulo: 'Secuencia' }), 'Secuencia', 'el `rotulo` de la def manda');
  assert.equal(rotuloDeParametro({ nombre: 'secuenciaId' }), 'Automatización');
  assert.equal(rotuloDeParametro({ nombre: 'anio' }), 'Año');
  assert.equal(rotuloDeParametro({ nombre: 'titulo' }), 'Título', 'antes salía «Titulo»');
  assert.equal(rotuloDeParametro({ nombre: 'fechaTermino' }), 'Fecha término');
  assert.equal(rotuloDeParametro({ nombre: 'proyectoId' }), 'Proyecto', 'el id es cómo se guarda, no qué es');
  assert.equal(rotuloDeParametro({ nombre: 'leadId', rotulo: '  ' }), 'Lead', 'un rótulo en blanco no cuenta');
});

test('las 200 acciones del registro: ningún rótulo sale pegado, en minúscula o sin la tilde conocida', () => {
  const malos: string[] = [];
  for (const d of ACCIONES) for (const p of d.parametros) {
    const r = rotuloDeParametro(p);
    if (/_|[a-zá-ú][A-Z]/.test(r.replace(/WhatsApp/g, 'Whatsapp')) || !/^[A-ZÁÉÍÓÚÑ0-9]/.test(r) || /(^| )(titulo|razon|descripcion|anio|telefono|duracion|despues|modulo|categoria|automatizacion)( |$)/i.test(r)) {
      malos.push(`${d.id}.${p.nombre} → «${r}»`);
    }
  }
  assert.deepEqual(malos, []);
});

// ── La línea de qué hace ─────────────────────────────────────────────────────────────────────

test('la línea de qué hace: sin «PROPONE», sin paréntesis, sin mayúsculas de énfasis y con tope', () => {
  assert.equal(resumenDeAccion('Propone crear (sin id) o editar (con id) un objetivo del año: título, métrica y meta.'), 'Crear o editar un objetivo del año',
    'antes cortaba en el primer paréntesis y quedaba «Crear»');
  assert.equal(resumenDeAccion('PROPONE apagar un KPI activo ya identificado (queda pendiente hasta el «sí»).'), 'Apagar un KPI activo ya identificado',
    'el «sí» de una persona no existe en un flujo: la acción corre sola');
  assert.equal(resumenDeAccion('Cambia el avance (0-99 %) de UNA tarea y deja rastro; la columna se deriva.'), 'Cambia el avance de una tarea y deja rastro');
  const largo = resumenDeAccion(`Hace ${'muchísimas cosas distintas '.repeat(8)}.`);
  assert.ok(largo.length <= TOPE_RESUMEN && largo.endsWith('…'), largo);
});

test('las 200 acciones del registro tienen una línea que se lee sola', () => {
  const malas = EDITOR.map((a) => [a.id, resumenDeAccion(a.descripcion)] as const)
    .filter(([, r]) => r.length < 12 || r.length > TOPE_RESUMEN || /propone|\(|«sí»/i.test(r));
  assert.deepEqual(malas, []);
});

// ── Lo que llena el flujo, y el lead de entrada ──────────────────────────────────────────────

test('lo que llena el flujo existe en el registro, y el reparto no lo dibuja', () => {
  for (const [op, campos] of Object.entries(LLENA_EL_FLUJO)) {
    const d = porId(op);
    assert.ok(d, op);
    for (const c of Object.keys(campos)) assert.ok(d!.parametros.some((p) => p.nombre === c), `${op}.${c} no existe`);
  }
  const aviso = ed('avisar_al_equipo');
  const r = repartoDelFormulario(aviso.parametros, aviso.pideLead, new Set(Object.keys(LLENA_EL_FLUJO.avisar_al_equipo)));
  assert.equal(r.lead?.nombre, 'leadId');
  assert.deepEqual(r.obligatorios.map((p) => p.nombre), ['mensaje']);
  // (15/10/2026: `fueraDeHorario` es de la tarjeta «MaKo en WhatsApp», que lo dibuja en su editor propio; este reparto es
  // el del formulario genérico, que esta operación no usa en el lienzo.)
  // (16/10/2026: y «Por dónde» y el asunto de «MaKo por email», que también dibuja ese editor propio.)
  // (17/10/2026: y «Sin grupo de MaKo», la opción de la tarjeta que dibuja ese mismo editor, lib/mako-tarjeta.ts.)
  assert.deepEqual(r.opcionales.map((p) => p.nombre), ['titulo', 'partes', 'fueraDeHorario', 'canal', 'asunto', 'sinGrupo'], '«respuesta» la pone el motor');
  assert.equal(r.plegar, true);
});

test('el lead del evento es el default al elegir, salvo que la acción tenga OTRO destinatario', () => {
  const de = (id: string) => naceSobreElLeadDelEvento(porId(id)!.parametros);
  assert.equal(de('avisar_al_equipo'), true, 'un aviso recién elegido nacía en «Ninguno», sin el lead');
  assert.equal(de('poner_etiqueta_lead'), true);
  assert.equal(de('crear_borrador_whatsapp_empresa'), false, 'a un teléfono fijo: «el teléfono no coincide» en cada corrida');
  assert.equal(de('bloquear_contacto_whatsapp_empresa'), false);
  assert.equal(naceSobreElLeadDelEvento([{ nombre: 'texto', obligatorio: true }]), false, 'sin lead no hay nada que poner');
});

// ── Los campos que dependen de otro ──────────────────────────────────────────────────────────

const PROD = (embudoId: number, nombre: string, esDefault: boolean): ProductoDeAccion => ({
  embudoId, nombre, esDefault,
  etapas: [
    { value: 'agenda', label: 'Agendó', pide: [] },
    { value: 'ganado', label: 'Ganado', pide: ['monto'] },
    { value: 'perdido', label: 'Perdido', pide: ['motivo'] },
  ],
});
const OPCIONES: OpcionesAccion = { productos: [PROD(1, 'Mentoría', true)], equipo: ['Ana', 'Bruno'], secuencias: [{ id: 7, nombre: 'Bienvenida' }] };

test('⚠️ MONTO Y MOTIVO SÓLO CON UNA ETAPA QUE LOS PIDE (y ahí obligatorios)', () => {
  const mover = ed('proponer_cambio_etapa');
  const v = (nombre: string, params: Record<string, unknown>, opciones: OpcionesAccion | null = OPCIONES) =>
    visibilidadDe(mover.parametros.find((p) => p.nombre === nombre)!, mover.parametros, { accionId: mover.id, params, opciones });
  assert.equal(v('monto', {}), 'oculto', 'sin etapa elegida no hay monto');
  assert.equal(v('motivo', { etapa: 'agenda' }), 'oculto');
  assert.equal(v('monto', { etapa: 'ganado' }), 'obligatorio');
  assert.equal(v('motivo', { etapa: 'ganado' }), 'oculto');
  assert.equal(v('motivo', { etapa: 'perdido' }), 'obligatorio');
  assert.equal(v('monto', { etapa: 'ganado' }, null), 'oculto', 'sin poder leer las etapas no se inventa');
  assert.equal(v('monto', { etapa: 'agenda', monto: 500 }), 'opcional', 'lo que ya tiene valor se ve, para poder borrarlo');
  // El estado de un cliente: el motivo para una baja (obligatorio) o una pausa.
  const cs = ed('marcar_estado_cliente_cs');
  const m = (estado?: string) => visibilidadDe(cs.parametros.find((p) => p.nombre === 'motivo')!, cs.parametros, { accionId: cs.id, params: estado ? { estado } : {} });
  assert.equal(m('baja'), 'obligatorio');
  assert.equal(m('pausado'), 'opcional');
  assert.equal(m('graduado'), 'oculto');
  assert.equal(m(), 'oculto');
});

test('lo que falta: lo declarado y lo que pide lo elegido (el monto de Ganado), nunca el lead', () => {
  const mover = ed('proponer_cambio_etapa');
  assert.deepEqual(faltanDelFormulario(mover.id, mover.parametros, { leadId: LEAD_DEL_EVENTO }, OPCIONES), ['etapa']);
  assert.deepEqual(faltanDelFormulario(mover.id, mover.parametros, { etapa: 'ganado' }, OPCIONES), ['monto'], 'Ganado sin monto rebota en cada lead');
  assert.deepEqual(faltanDelFormulario(mover.id, mover.parametros, { etapa: 'ganado', monto: 900 }, OPCIONES), []);
  assert.deepEqual(faltanDelFormulario(mover.id, mover.parametros, { etapa: 'agenda' }, OPCIONES), []);
  const cs = ed('marcar_estado_cliente_cs');
  assert.deepEqual(faltanDelFormulario(cs.id, cs.parametros, { estado: 'baja' }), ['motivo']);
});

// Integración de la tercera tanda: «Probar» y «Publicar» se frenan con lo MISMO que dibuja el formulario
// (`frenoDelFlujo(pasos, faltanEnAccion)`, el que arma `useFaltanEnAcciones` en el editor).
// Rotura (sacar la vuelta de las acciones en `frenoDelFlujo`): 1 fallo.
test('⚠️ un «Mover a Ganado» sin monto frena Publicar y abre esa tarjeta', () => {
  const mover = ed('proponer_cambio_etapa');
  const faltan = (op: string, params: Record<string, unknown>) => (op === mover.id ? faltanDelFormulario(op, mover.parametros, params, OPCIONES) : []);
  const paso = (params: Record<string, unknown>): PasoParaGrafo => ({ id: 'a1', canal: 'whatsapp', delay_horas: 0, cuerpo: '', accion: { operacion: mover.id, params: { leadId: LEAD_DEL_EVENTO, ...params } } });
  assert.deepEqual(frenoDelFlujo([paso({ etapa: 'ganado' })], faltan)?.tarjeta, 'a1', 'se publicaba y rebotaba en cada lead');
  assert.match(frenoDelFlujo([paso({ etapa: 'ganado' })], faltan)?.error ?? '', /^Falta completar «/);
  assert.equal(frenoDelFlujo([paso({ etapa: 'ganado', monto: 900 })], faltan), null);
  assert.equal(frenoDelFlujo([paso({ etapa: 'agenda' })], faltan), null);
  // Sin el catálogo todavía (null), sólo lo de siempre: no se frena por algo que no se pudo mirar.
  assert.equal(frenoDelFlujo([paso({ etapa: 'ganado' })], null), null);
});

test('el producto de una etapa: el elegido, el que la tiene (el principal primero) o el principal', () => {
  const ps = [PROD(2, 'Curso', false), PROD(1, 'Mentoría', true)];
  assert.equal(productoDeLaEtapa(ps, 2, 'ganado')?.nombre, 'Curso');
  assert.equal(productoDeLaEtapa(ps, undefined, 'ganado')?.nombre, 'Mentoría');
  assert.equal(productoDeLaEtapa(ps, undefined, undefined)?.nombre, 'Mentoría');
  assert.equal(productoDeLaEtapa(ps, 99, 'ganado'), null, 'un producto que ya no está no se reemplaza por otro');
});

// ── El formulario renderizado ────────────────────────────────────────────────────────────────

/** `'cargando'` = las listas todavía no llegaron (un `undefined` acá activaría el default del parámetro). */
const dibujar = (id: string, params: Record<string, unknown>, opciones: OpcionesAccion | 'cargando' = OPCIONES) => {
  const accion = ed(id);
  return renderToStaticMarkup(createElement(FormularioAccion, {
    accion, valor: { operacion: id, params }, params, cambiar: () => {}, opciones: opciones === 'cargando' ? undefined : opciones,
  }));
};

test('⚠️ «MOVER DE ETAPA» DIBUJA EL SELECTOR DE ETAPA Y NO MONTO/MOTIVO HASTA ELEGIR GANADO O PERDIDO', () => {
  const html = dibujar('proponer_cambio_etapa', { leadId: LEAD_DEL_EVENTO });
  assert.ok(html.includes('>Etapa<') && html.includes('Elige la etapa'), 'la etapa es un desplegable');
  assert.ok(!/<input[^>]*type="text"|<input(?![^>]*type=)/.test(html), 'quedó un campo abierto');
  assert.ok(!html.includes('Monto') && !html.includes('Motivo'), '«Monto» y «Motivo» a la vista sin haber elegido nada');
  assert.ok(!html.includes('>Producto<'), 'con un solo producto el paso del producto no está');
  const ganado = dibujar('proponer_cambio_etapa', { leadId: LEAD_DEL_EVENTO, etapa: 'ganado' });
  assert.ok(ganado.includes('>Ganado<') && ganado.includes('Monto') && ganado.includes('USD'), 'el monto, con su moneda');
  assert.ok(!ganado.includes('Motivo'));
  assert.ok(!ganado.includes('Más opciones'), 'el monto de Ganado es obligatorio: no va plegado');
  const perdido = dibujar('proponer_cambio_etapa', { leadId: LEAD_DEL_EVENTO, etapa: 'perdido' });
  assert.ok(perdido.includes('Motivo') && !perdido.includes('Monto'));
  const dos = dibujar('proponer_cambio_etapa', { leadId: LEAD_DEL_EVENTO }, { ...OPCIONES, productos: [PROD(1, 'Mentoría', true), PROD(2, 'Curso', false)] });
  assert.ok(dos.includes('>Producto<') && dos.includes('Mentoría'), 'con dos productos, primero el producto');
  const cargando = dibujar('proponer_cambio_etapa', { leadId: LEAD_DEL_EVENTO, etapa: 'ganado' }, 'cargando');
  assert.ok(cargando.includes('Cargando') && !cargando.includes('Monto'), 'sin las etapas todavía, no se adivina el monto');
});

test('la automatización, la persona y el sí/no se ELIGEN de la lista del negocio', () => {
  const insc = dibujar('inscribir_lead_secuencia', { leadId: LEAD_DEL_EVENTO, secuenciaId: 7 });
  assert.ok(insc.includes('Bienvenida') && !insc.includes('type="number"'), 'la automatización por su nombre, no por id');
  const asig = dibujar('asignar_closer_setter', { leadId: LEAD_DEL_EVENTO, closer: 'Ana' });
  assert.ok(asig.includes('>Closer<') && asig.includes('>Setter<') && asig.includes('Ana'), 'los dos a la vista (ninguno es obligatorio, pero uno hace falta)');
  const vacio = dibujar('asignar_closer_setter', { leadId: LEAD_DEL_EVENTO });
  assert.ok(vacio.includes('>Closer<') && !/Más opciones|Menos opciones/.test(vacio), 'plegados, el formulario recién elegido quedaba vacío');
  const viejo = dibujar('asignar_closer_setter', { leadId: LEAD_DEL_EVENTO, closer: 'Carla' });
  assert.ok(viejo.includes('Carla (ya no está)'), 'lo puesto entra a las opciones aunque ya no esté en el equipo');
  const cal = dibujar('marcar_calificado', { leadId: LEAD_DEL_EVENTO, calificado: false });
  assert.ok(cal.includes('>No<') && !cal.includes('type="checkbox"'), 'un sí/no obligatorio no es una casilla');
  const prod = dibujar('agregar_lead_a_producto', { leadId: LEAD_DEL_EVENTO, embudoId: 1 });
  assert.ok(prod.includes('Mentoría') && !prod.includes('type="number"'), 'el producto por su nombre');
  const sinLeer = dibujar('inscribir_lead_secuencia', { leadId: LEAD_DEL_EVENTO, secuenciaId: 7 }, { ...OPCIONES, secuencias: null });
  assert.ok(sinLeer.includes('No se pudo leer'), '«no pude leer» no es «no hay»');
});

test('el formulario de «Avisar al equipo»: el lead del flujo NO se dibuja, «Respuesta» no está y el título va plegado', () => {
  const html = dibujar('avisar_al_equipo', { leadId: LEAD_DEL_EVENTO, mensaje: 'Hola' });
  // Sexta tanda, ACTION 2: «Elimina lo de "Sobre el lead de este flujo - cambiar", siempre es sobre el lead del flujo».
  assert.ok(!html.includes('Sobre el lead de este flujo') && !html.includes('Cambiar'), 'volvió la línea del lead');
  assert.ok(!/>Lead</.test(html) && !html.includes('De qué lead'), 'el lead del evento no es un formulario');
  // Lo que YA está guardado de otra forma (un lead fijo de antes) se sigue viendo, para poder volverlo al del flujo.
  const fijo = dibujar('agregar_nota_lead', { leadId: 42, texto: 'x' });
  assert.ok(fijo.includes('Otro lead (por id)') && fijo.includes('value="42"'), 'un lead fijo de antes quedaría corriendo sin que se vea');
  assert.ok(!html.includes('Respuesta'), 'el campo que pisa el motor');
  assert.ok(html.includes('>Mensaje<'), 'lo obligatorio a la vista');
  assert.ok(html.includes('Más opciones') && !html.includes('Título'), 'lo opcional, plegado');
  const conTitulo = dibujar('avisar_al_equipo', { leadId: LEAD_DEL_EVENTO, mensaje: 'Hola', titulo: 'Ojo' });
  assert.ok(conTitulo.includes('Menos opciones') && conTitulo.includes('Título'), 'plegar lo que ya tiene valor lo esconde');
  const sinLead = dibujar('avisar_al_equipo', { mensaje: 'Hola' });
  assert.ok(!sinLead.includes('Sobre el lead de este flujo'), 'un lead opcional vacío es «ninguno»: se muestra el selector');
});

// ── Roturas (09/10/2026) ─────────────────────────────────────────────────────────────────────
// Arnés en el scratchpad (D-romper.mjs): UNA rotura por vez, corre este archivo y restaura de
// memoria. Base: 16 / 16. 12 roturas, 12 cazadas (fallos de 16):
//   R1. la lista corta suma una acción con fecha fija (mover_a_nutricion_manual)  → 1
//   R2. la etapa vuelve a ser un campo abierto (sin la rama de `controlDe`)       → 3
//   R3. monto y motivo siempre como los declara la def                           → 2
//   R4. lo que pide una etapa por NOMBRE («ganado»/«perdido») y no por la regla   → 1
//   R5. sin la sección «La que tiene puesta»                                     → 1
//   R6. `accionesParaFlujo` marca todo como curado                               → 1
//   R7. el paso del producto con un solo producto                                → 1
//   R8. lo opcional siempre plegado (asignar closer/setter quedaba vacío)         → 1
//      (la primera versión del test NO la cazaba: lo probaba con un closer puesto, y lo puesto
//      abre lo plegado solo. Ahora mira el formulario recién elegido.)
//   R9. lo puesto no entra a las opciones                                        → 1
//   R10. un sí/no obligatorio como casilla                                       → 2
//   R11. la etapa elegida inventada cuando las opciones no llegaron               → 2
//   R12. «no pude leer» las automatizaciones como lista vacía                     → 1
//
// SEXTA TANDA (09/10/2026, parte «editores»). Arnés scratchpad/editores-v6/romper.mjs, corriendo este
// archivo junto con dropdown-reglas, editor-etiqueta, editores-control y flujo-lienzo-paralelos.
// Base: 51 / 0. Restaurado: 51 / 0. Pasan / fallan con cada una:
//   B11. una acción de la lista con un ícono que no existe en el set              → 50 / 1
//   B12. vuelve «Poner una etiqueta» a la lista                                    → 50 / 1
//   B13. las áreas del árbol en otro orden                                          → 50 / 1
//   B14. el desplegable de la acción sin `variante="principal"`                     → 49 / 2 (acá y editores-control)
//   B15. vuelve la línea «Sobre el lead de este flujo · Cambiar»                    → 50 / 1
//   B16. un lead FIJO de antes deja de verse (FilaLead devuelve null siempre)       → 50 / 1
