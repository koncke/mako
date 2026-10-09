// =============================================================================
// El paso «⚡ Acción»: el selector por secciones, la línea de qué hace y lo que NO se dibuja
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 7): «El editor de Acción esta muy complejo,
// simplificalo... el desplegable de acciones, como son tantas, debe estar muy bien diseñado. Tener
// barra de busqueda y también que sea modular, como tenemos el desplegable de Plan». Vino con la
// captura de «Avisar al equipo» mostrando «Lead» y «Respuesta» a la vista. Decisión 13 del diseño.
//
// Lo que se EJECUTA: lib/editor-acciones.ts (rótulos, resumen, secciones, reparto, el lead de
// entrada) contra el REGISTRO de verdad, y el formulario del editor renderizado. Lo que se LEE del
// fuente (sin comentarios, CRLF normalizado): que el selector vaya por secciones y que el Select se
// las pase al Dropdown.
//
// ── Roturas (08/10/2026) ── al final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { REGISTRO, porId } from '../lib/api-mako/registro';
import { AREA_INFO, type OperacionDef } from '../lib/api-mako/tipos';
import { LLENA_EL_FLUJO, LEAD_DEL_EVENTO } from '../lib/api-mako/flujo-params';
import {
  rotuloDeParametro, resumenDeAccion, seccionesDeAcciones, repartoDelFormulario, naceSobreElLeadDelEvento,
  MAS_USADAS, SECCION_MAS_USADAS, SECCION_CON_LEAD, SECCION_AVANZADO, TOPE_RESUMEN, pideJsonCrudo,
} from '../lib/editor-acciones';
import { FormularioAccion } from '../app/_components/EditorAccionMako';
import type { AccionEditor } from '../lib/api-mako/flujo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const ACCIONES = REGISTRO.filter((d) => d.tipo === 'accion');
/** Lo mismo que arma `accionesParaFlujo` (lib/api-mako/flujo.ts), sin pasar por la vista. */
const aEditor = (d: OperacionDef): AccionEditor => ({
  id: d.id, area: d.area, areaTitulo: AREA_INFO[d.area]?.titulo ?? d.area, titulo: d.titulo, descripcion: d.descripcion,
  costo: d.costo, reversible: d.tipo === 'accion' ? d.reversible : false, pideLead: d.parametros.some((p) => p.nombre === 'leadId'),
  parametros: d.parametros.map((p) => ({ nombre: p.nombre, tipo: p.tipo, descripcion: p.descripcion, obligatorio: p.obligatorio, enum: p.enum, minimo: p.minimo, maximo: p.maximo, entero: p.entero })),
});
const EDITOR = ACCIONES.map(aEditor);

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
    // «WhatsApp» se escribe así: no es un nombre camelCase sin partir.
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

// ── Las secciones del selector ───────────────────────────────────────────────────────────────

test('las secciones: «Más usadas» y «Con este lead» primero (atajos), una por área y «Avanzado» al final', () => {
  const s = seccionesDeAcciones(EDITOR);
  assert.equal(s[0].titulo, SECCION_MAS_USADAS);
  assert.equal(s[1].titulo, SECCION_CON_LEAD);
  assert.equal(s[s.length - 1].titulo, SECCION_AVANZADO);
  assert.ok(s[0].atajo && s[1].atajo && !s.slice(2).some((x) => x.atajo), 'sólo las dos primeras son atajos (buscar no las repite)');
  assert.deepEqual(s[0].acciones.map((a) => a.id), [...MAS_USADAS], 'la curada, en su orden');
  assert.ok(s[1].acciones.every((a) => a.pideLead && !MAS_USADAS.includes(a.id)));
  assert.ok(s.every((x) => x.acciones.length > 0), 'una sección vacía no se dibuja');
  // Cada acción vive en UNA sección de verdad (no atajo); las de JSON, sólo en «Avanzado».
  const deVerdad = s.filter((x) => !x.atajo).flatMap((x) => x.acciones.map((a) => a.id));
  assert.equal(new Set(deVerdad).size, deVerdad.length, 'una acción en dos secciones');
  assert.deepEqual([...deVerdad].sort(), EDITOR.map((a) => a.id).sort(), 'una acción que no está en ninguna sección no se puede elegir');
  const avanzado = s[s.length - 1].acciones;
  assert.ok(avanzado.length > 0 && avanzado.every(pideJsonCrudo));
  assert.ok(s.slice(0, -1).every((x) => !x.acciones.some(pideJsonCrudo)), 'una acción que pide JSON quedó a la vista');
});

test('«Más usadas» son ids EXACTOS del registro: acciones de un flujo de leads, sin JSON crudo', () => {
  for (const id of MAS_USADAS) {
    const d = porId(id);
    assert.ok(d, `«${id}» no existe en el registro: la sección la tiraría en silencio`);
    assert.equal(d!.tipo, 'accion', id);
    assert.ok(!pideJsonCrudo(aEditor(d!)), id);
  }
});

test('el selector va POR SECCIONES y el Select se las pasa al Dropdown', () => {
  const editor = sinComentarios(leer('app/_components/EditorAccionMako.tsx'));
  const sel = editor.slice(editor.indexOf('<Select\n          value={valor.operacion'), editor.indexOf('/>', editor.indexOf('<Select\n          value={valor.operacion')));
  assert.ok(sel.length > 50, 'no encontré el Select de la acción');
  assert.match(sel, /secciones=\{secciones\}/);
  assert.doesNotMatch(sel, /options=\{/, 'volvió la lista plana');
  assert.match(sel, /\bsearch\b/);
  assert.match(editor, /seccionesDeAcciones\(acciones\)/);
  const select = sinComentarios(leer('app/_ui/Select.tsx'));
  assert.match(select, /secciones=\{secciones\}/, 'Select no le pasa `secciones` al Dropdown');
  const dropdown = sinComentarios(leer('app/components/Dropdown.tsx'));
  assert.match(dropdown, /secciones\?\.filter\(\(g\) => !\(buscando && g\.atajo\)\)/, 'buscando, cada resultado saldría dos veces');
});

// ── Lo que llena el flujo, y el lead de entrada ──────────────────────────────────────────────

test('lo que llena el flujo existe en el registro, y el reparto no lo dibuja', () => {
  for (const [op, campos] of Object.entries(LLENA_EL_FLUJO)) {
    const d = porId(op);
    assert.ok(d, op);
    for (const c of Object.keys(campos)) assert.ok(d!.parametros.some((p) => p.nombre === c), `${op}.${c} no existe`);
  }
  const aviso = aEditor(porId('avisar_al_equipo')!);
  const r = repartoDelFormulario(aviso.parametros, aviso.pideLead, new Set(Object.keys(LLENA_EL_FLUJO.avisar_al_equipo)));
  assert.equal(r.lead?.nombre, 'leadId');
  assert.deepEqual(r.obligatorios.map((p) => p.nombre), ['mensaje']);
  assert.deepEqual(r.opcionales.map((p) => p.nombre), ['titulo'], '«respuesta» la pone el motor');
});

test('el lead del evento es el default al elegir, salvo que la acción tenga OTRO destinatario', () => {
  const de = (id: string) => naceSobreElLeadDelEvento(porId(id)!.parametros);
  assert.equal(de('avisar_al_equipo'), true, 'un aviso recién elegido nacía en «Ninguno», sin el lead');
  assert.equal(de('poner_etiqueta_lead'), true);
  assert.equal(de('crear_borrador_whatsapp_empresa'), false, 'a un teléfono fijo: «el teléfono no coincide» en cada corrida');
  assert.equal(de('bloquear_contacto_whatsapp_empresa'), false);
  assert.equal(naceSobreElLeadDelEvento([{ nombre: 'texto', obligatorio: true }]), false, 'sin lead no hay nada que poner');
});

test('el formulario de «Avisar al equipo»: el lead es una línea, «Respuesta» no está y el título va plegado', () => {
  const aviso = aEditor(porId('avisar_al_equipo')!);
  const dibujar = (params: Record<string, unknown>) => renderToStaticMarkup(createElement(FormularioAccion, {
    accion: aviso, valor: { operacion: aviso.id, params }, params, fijar: () => {},
  }));
  const html = dibujar({ leadId: LEAD_DEL_EVENTO, mensaje: 'Hola' });
  assert.ok(html.includes('Sobre el lead de este flujo') && html.includes('Cambiar'));
  assert.ok(!/>Lead</.test(html), 'el lead del evento no es un formulario');
  assert.ok(!html.includes('Respuesta'), 'el campo que pisa el motor');
  assert.ok(html.includes('>Mensaje<'), 'lo obligatorio a la vista');
  assert.ok(html.includes('Más opciones') && !html.includes('Título'), 'lo opcional, plegado');
  const conTitulo = dibujar({ leadId: LEAD_DEL_EVENTO, mensaje: 'Hola', titulo: 'Ojo' });
  assert.ok(conTitulo.includes('Menos opciones') && conTitulo.includes('Título'), 'plegar lo que ya tiene valor lo esconde');
  const sinLead = dibujar({ mensaje: 'Hola' });
  assert.ok(!sinLead.includes('Sobre el lead de este flujo'), 'un lead opcional vacío es «ninguno»: se muestra el selector');
});

// ── Roturas (08/10/2026) ─────────────────────────────────────────────────────────────────────
// Arnés en el scratchpad (E-v2-romper.mjs): UNA rotura por vez, corre este archivo y restaura de
// memoria. Base: 10 / 10. 12 roturas, 12 cazadas (fallos de 10):
//   A1. el resumen sin sacar los paréntesis                           → 2
//   A2. «titulo» sin su tilde en el diccionario de palabras           → 3
//   A3. las acciones de JSON también en su área (no sólo «Avanzado»)  → 1
//   A4. «Más usadas» sin la marca de atajo                            → 1
//   A5. un id de «Más usadas» que no existe en el registro            → 2
//   A6. el reparto sin sacar lo que llena el flujo («Respuesta»)      → 1
//   A7. el lead del evento como formulario, sin la línea             → 1
//   A8. el lead del evento por default aunque haya un teléfono       → 1
//   A9. Select sin pasarle `secciones` al Dropdown                    → 1
//   A10. el Dropdown sin saltear los atajos al buscar                 → 1
//   A11. el selector de vuelta a la lista plana                       → 1
//   A12. lo opcional siempre a la vista (sin «Más opciones»)          → 1
