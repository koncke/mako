// =============================================================================
// CREAR CON IA: los arreglos de la revisión de la segunda tanda (09/10/2026)
// =============================================================================
// Cada test persigue UN hallazgo confirmado de la revisión del frente IA (lib/flujo-ia.ts, la ruta
// app/api/chat-agent/secuencias/ia/route.ts y app/chatbot/CrearConIA.tsx). Lo puro se EJECUTA; lo
// que es cableado (la ruta, la pantalla) se fija leyendo el fuente sin comentarios y en LF.
//
// ⚠️ PROBADO ROMPIENDO CADA ARREGLO, 09/10/2026: el arnés FIXIA-romper.mjs (scratchpad de la sesión)
// revierte el arreglo, corre este archivo, cuenta y RESTAURA DE MEMORIA (md5 verificado). El
// resultado de cada rotura está al lado de su test («rotura: …»).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LISTA_BLANCA_IA, CREAR_IA_SYSTEM_TEMPLATE, EDITAR_IA_SYSTEM_TEMPLATE, deIA, validarIA, limpiarTexto, type CtxIA } from '../lib/flujo-ia';
import { validarGrafo } from '../lib/flujo-grafo';
import { porId } from '../lib/api-mako/registro';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const acciones = LISTA_BLANCA_IA.map((id) => {
  const d = porId(id);
  if (!d) throw new Error(`la lista blanca nombra «${id}», que no está en el registro`);
  return { id: d.id, titulo: d.titulo, parametros: d.parametros };
});
const ctxBase = (o: Partial<CtxIA> = {}): CtxIA => ({
  etiquetas: [{ id: 7, nombre: 'Cualificado' }],
  productos: [
    { funnelId: 3, productoId: null, nombre: 'Mentoría', esDefault: true, etapas: [{ value: 'nuevo', label: 'Nuevo' }, { value: 'agendado', label: 'Agendado' }, { value: 'ganado', label: 'Ganado' }] },
    { funnelId: 5, productoId: 11, nombre: 'Curso', etapas: [{ value: 'agendado', label: 'Agendado' }] },
  ],
  disparadores: [{ value: 'trigger:instant_form_sin_agenda', label: 'Formulario sin agenda' }],
  audios: [],
  archivos: [],
  acciones,
  links: { agenda: { url: 'https://cal.com/negocio/llamada', para: 'agendar una llamada' } },
  automatizaciones: [],
  secuenciaId: 99,
  ...o,
});
/** Un generador determinista para `nuevoId`. */
const rndDe = () => { let k = 0; return () => ((k++ * 0.137) % 1); };

// ── asignar_closer_setter: una tarjeta que el lienzo dibuja configurada y nunca hace nada ──
// rotura (volver a sumarla a LISTA_BLANCA_IA): 1 fallo de 1.
test('asignar_closer_setter NO está en la lista blanca: sus nombres no se pueden validar', () => {
  assert.ok(!LISTA_BLANCA_IA.includes('asignar_closer_setter'));
  // Y el bloque ACCIONES del prompt no la ofrece: sale de la lista blanca.
  assert.ok(!acciones.some((a) => a.id === 'asignar_closer_setter'));
});

// ── El ejemplo del prompt contradecía su propia regla 4 («una guía no ofrece días ni horarios») ──
/** El JSON de «LA FORMA (un ejemplo…)» de un prompt, parseado. */
const ejemploDe = (tpl: string) => {
  const i = tpl.indexOf('{', tpl.indexOf('LA FORMA ('));
  const j = tpl.indexOf('\n\nDevuelve EXCLUSIVAMENTE', i);
  return JSON.parse(tpl.slice(i, j)) as { tarjetas?: Array<Record<string, unknown>>; agregar?: Array<{ tarjetas: Array<Record<string, unknown>> }> };
};
// Lo que una guía de «MaKo contesta» no puede hacer: ofrecer un momento. Pedir que elija con el link, sí.
const OFRECE_MOMENTO = /horari|\bd[ií]as?\b|\bhoy\b|ma[ñn]ana|semana|\b\d{1,2}(:\d\d)?\s*(h|hs|am|pm)\b|\blunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo/i;

// rotura (devolver el texto viejo «Ofrécele dos horarios de esta semana…»): 1 fallo de 3, cae éste.
test('el ejemplo del prompt: ninguna guía ofrece días ni horarios', () => {
  for (const tpl of [CREAR_IA_SYSTEM_TEMPLATE, EDITAR_IA_SYSTEM_TEMPLATE]) {
    const ej = ejemploDe(tpl);
    const tarjetas = [...(ej.tarjetas ?? []), ...(ej.agregar ?? []).flatMap((g) => g.tarjetas)];
    assert.ok(tarjetas.length > 0, 'no encontré el ejemplo');
    for (const t of tarjetas) {
      if (t.ia === true) assert.doesNotMatch(String(t.texto), OFRECE_MOMENTO, `una guía ofrece un momento: «${String(t.texto)}»`);
    }
  }
});

// ── Las llaves que RX_VARIABLE no reconocía quedaban crudas y llegaban al lead ──
// rotura (volver a RX_VARIABLE en limpiarTexto, sin la pasada de llaves sueltas): 1 fallo de 7, cae éste.
test('limpiarTexto: toda llave que no es una variable conocida se va, y avisa', () => {
  const casos: Array<[string, string]> = [
    ['Hola {{Nombre del lead}}, ¿cómo estás?', 'Hola, ¿cómo estás?'],
    ['Tu número {{teléfono}} quedó', 'Tu número quedó'],
    ['Paso {{ 1 }} listo', 'Paso listo'],
    ['Hola {nombre completo}', 'Hola'],
    ['Hola {{nombre}}}', 'Hola {{nombre}}'],
    ['Hola {{nombre', 'Hola nombre'],
  ];
  for (const [entra, sale] of casos) {
    const r = limpiarTexto(entra);
    assert.equal(r.texto, sale, entra);
    assert.ok(r.quitado.includes('variable') || entra === 'Hola {{nombre}}}', `sin aviso: ${entra}`);
    assert.doesNotMatch(r.texto.replace(/\{\{(nombre|negocio)\}\}/g, ''), /[{}]/, entra);
  }
  // Las del motor se quedan (y se normalizan a doble llave).
  assert.equal(limpiarTexto('Hola {Nombre} de {{ negocio }}').texto, 'Hola {{nombre}} de {{negocio}}');
});

// rotura (validarIA sin el chequeo de llaves): 1 fallo de 7, cae éste.
test('validarIA rechaza un texto con llaves que no son una variable', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}}' }] }, ctx, rndDe());
  assert.deepEqual(validarIA(r.pasos, ctx), []);
  for (const cuerpo of ['Hola {{Nombre del lead}}', 'Hola {{teléfono}}', 'Hola {{nombre}}}']) {
    const mal = r.pasos.map((p) => ({ ...p, cuerpo }));
    assert.ok(validarIA(mal, ctx).some((e) => /llaves|variable/.test(e)), cuerpo);
  }
});

// ── Un link sin http ni www (calendly.com/juan) pasaba las dos capas ──
// rotura (sin RX_DOMINIO en limpiarTexto): 1 fallo de 7, cae éste.
test('limpiarTexto borra un dominio suelto y deja en paz lo que no es un link', () => {
  for (const t of ['Agenda en calendly.com/juan/30min', 'Entra a cal.com/x', 'Mira Calendly.com/juan', 'Todo en negocio.com.ar/precios']) {
    const r = limpiarTexto(t);
    assert.doesNotMatch(r.texto, /\.(com|ar)\b/, t);
    assert.ok(r.quitado.includes('link'), t);
  }
  for (const t of ['Revisa tus datos.Te escribo', 'Hola.Me alegra', 'Cuesta 1.500 o 2.5', 'Escríbeme a hola@negocio.com', 'Tus datos.Como siempre']) {
    assert.equal(limpiarTexto(t).texto, t, t);
  }
});

// rotura (validarIA sin mirar los dominios sueltos): 1 fallo de 7, cae éste.
test('validarIA rechaza un dominio suelto salvo que sea el host de uno de tus links', () => {
  const ctx = ctxBase();
  const r = deIA({ inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola', link: 'agenda' }] }, ctx, rndDe());
  assert.deepEqual(validarIA(r.pasos, ctx), [], 'el link completo pegado por el código vale');
  const ajeno = r.pasos.map((p) => ({ ...p, cuerpo: 'Agenda en calendly.com/juan' }));
  assert.ok(validarIA(ajeno, ctx).some((e) => e.includes('link')));
  const propio = r.pasos.map((p) => ({ ...p, cuerpo: 'Agenda en cal.com/negocio/llamada' }));
  assert.deepEqual(validarIA(propio, ctx), []);
});

test('el ejemplo de crear se traduce entero y pasa validarGrafo y validarIA', () => {
  const ctx = ctxBase();
  const r = deIA(ejemploDe(CREAR_IA_SYSTEM_TEMPLATE), ctx, rndDe());
  assert.deepEqual(validarGrafo(r.pasos), []);
  assert.deepEqual(validarIA(r.pasos, ctx), []);
  assert.equal(r.pasos.length, 7);
});
