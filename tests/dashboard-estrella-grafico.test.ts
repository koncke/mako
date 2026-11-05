// =============================================================================
// El MaKo de un gráfico del Dashboard le pregunta a la ESTRELLA de la tab, con la hoja y en «analizar» (22/10/2026, TB3)
// =============================================================================
// Martín, 22/10: «quiero que todos los chats de MaKo en las tabs sean el del Ops Center». Y la regla del 21/10: el chat de
// MaKo de una tab se abre a la izquierda, con la estrella, y lo que se escribe va al Cerebro. El botón de MaKo de cada
// gráfico y el «Preguntarle a MaKo» del clic derecho abrían un modal con su chat propio (`MakoChat`); ahora mandan el gráfico
// a la estrella (app/dashboard/pregunta-grafico.ts), que monta el editor con la hoja como entidad (OC6) y en «analizar»: en
// vista, MaKo asesora y no toca la hoja (lo que edita es «Editar con MaKo», el único escritor de la hoja abierta).
//
// ⚠️ PROBADO ROMPIENDOLO (22/10/2026, base 4/0): el botón volviendo a abrir su modal (`CapaChatMako`) → 3/1; la estrella con
// `modo="editar"` → 3/1; `textoDePregunta` sin el contexto del gráfico → 3/1; `preguntaDelEvento` aceptando un detalle sin
// título → 3/1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EVENTO_PREGUNTA_GRAFICO, entidadDeHoja, preguntaDelEvento, preguntarDelGrafico, textoDePregunta,
} from '../app/dashboard/pregunta-grafico';
import { sanearDesde } from '../lib/chat-desde';

const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (p: string) => sinComentarios(readFileSync(p, 'utf8'));

test('lo que sale al Cerebro: el pedido y, abajo, lo que el gráfico muestra; la hoja es una entidad que OC6 acepta', () => {
  const t = textoDePregunta({ titulo: 'Leads por semana', contexto: 'Gráfico: Leads por semana (barras).\n- Semana 1: 12' });
  assert.match(t, /^Analiza el gráfico «Leads por semana»/);
  assert.match(t, /\n\nGráfico: Leads por semana \(barras\)\.\n- Semana 1: 12$/);
  assert.equal(textoDePregunta({ titulo: '  ', contexto: '' }), 'Analiza el gráfico «este gráfico»: qué es lo más importante y qué haría esta semana.');
  assert.ok(textoDePregunta({ titulo: 'x', contexto: 'y'.repeat(20_000) }).length < 6_200, 'el contexto con tope');
  const e = entidadDeHoja({ id: 'gmvjxtei82ve3', nombre: 'Página 1' });
  assert.deepEqual(sanearDesde({ tab: 'Dashboard', entidad: e, modo: 'analizar' }), { tab: 'Dashboard', entidad: e, modo: 'analizar' });
  assert.equal(entidadDeHoja({ id: 'h1', nombre: '' }).titulo, 'Hoja');
});

test('el evento: el botón lo despacha y el editor lo lee; un detalle que no es una pregunta se ignora', () => {
  const g = globalThis as unknown as { window?: EventTarget };
  const antes = g.window;
  g.window = new EventTarget();
  try {
    const recibidos: unknown[] = [];
    g.window.addEventListener(EVENTO_PREGUNTA_GRAFICO, (ev) => recibidos.push(preguntaDelEvento(ev)));
    preguntarDelGrafico({ titulo: 'Ventas', contexto: 'c' });
    g.window.dispatchEvent(new CustomEvent(EVENTO_PREGUNTA_GRAFICO, { detail: { contexto: 'sin título' } }));
    assert.deepEqual(recibidos, [{ titulo: 'Ventas', contexto: 'c' }, null]);
  } finally {
    g.window = antes;
  }
});

test('el botón del gráfico pregunta a la estrella y no abre un chat propio', () => {
  const pa = leer('app/dashboard/PanelAnalista.tsx');
  const boton = pa.slice(pa.indexOf('export function ChatMakoGrafico('));
  assert.match(boton.slice(0, 400), /onClick=\{\(\) => preguntarDelGrafico\(\{ titulo, contexto \}\)\}/);
  assert.doesNotMatch(pa, /CapaChatMako|ChatMakoAbierto|<MakoChat\b/, 'volvió el modal con su chat propio');
});

test('el editor monta la estrella con la hoja, en «analizar», fuera de un link compartido, y oye a sus gráficos', () => {
  const ed = leer('app/dashboard/EditorInforme.tsx');
  // (23/10/2026: ni en las Métricas de una automatización, que viven en /automations, con su propio chat de MaKo.)
  // (24/10/2026: y con lo que hay en pantalla, `pantallaMako`: tests/estrella-ve-la-hoja.test.ts.)
  assert.match(ed, /const conEstrella = !compartido && !esAutomatizacion;/);
  // La apertura de MaKo (5/11/2026, `apertura=`) va antes de la entidad sin cambiar lo que esto cuida.
  assert.match(ed, /\{conEstrella && <MakoEnLaTab tab=\{esGeneral \? 'General' : 'Dashboard'\} (?:apertura=\{aperturaTab\} )?entidad=\{entidadDeHoja\(hoja\)\} modo="analizar" pedido=\{pedidoMako\} pantalla=\{pantallaMako\} \/>\}/);
  assert.match(ed, /window\.addEventListener\(EVENTO_PREGUNTA_GRAFICO, oir\);/);
  assert.match(ed, /preguntarAMako\(\{ titulo: tituloDe\(c\), contexto: contextoDeGrafico\(c, r, efectivoDe\(c, lienzo, vista, hoy\)\) \}\);/, 'el clic derecho también');
  assert.doesNotMatch(ed, /ChatMakoAbierto|setChatMako/);
});
