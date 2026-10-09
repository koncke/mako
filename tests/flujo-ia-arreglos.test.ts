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
import { LISTA_BLANCA_IA, CREAR_IA_SYSTEM_TEMPLATE, EDITAR_IA_SYSTEM_TEMPLATE, deIA, validarIA, type CtxIA } from '../lib/flujo-ia';
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

test('el ejemplo de crear se traduce entero y pasa validarGrafo y validarIA', () => {
  const ctx = ctxBase();
  const r = deIA(ejemploDe(CREAR_IA_SYSTEM_TEMPLATE), ctx, rndDe());
  assert.deepEqual(validarGrafo(r.pasos), []);
  assert.deepEqual(validarIA(r.pasos, ctx), []);
  assert.equal(r.pasos.length, 7);
});
