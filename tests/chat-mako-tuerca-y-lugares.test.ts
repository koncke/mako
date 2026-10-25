// =============================================================================
// MaKo nombra el ícono y el lugar DE VERDAD de Configuraciones (24/10/2026, f19 y f22 de la llamada con Leandro)
// =============================================================================
// f19 (31:29, Martín): «Maco debería poder enviar íconos o cosas así porque el ícono que te envió no es el correcto... el ícono
// de configuraciones no es el correcto... Fíjate dónde está». Al modelo se le decía «en el «⋯» de esta automatización» (el menú
// de la fila, en la lista), y en el lienzo Configuraciones se abre con la TUERCA del título. Ahora se le dice la tuerca, y el
// globo que habla de Configuraciones lleva esa misma tuerca (`Icon name="config"`), que la abre.
// f22 (36:01): «un bloque para Instagram donde puedes configurar el tope máximo de comentarios», que no existía. La guarda de un
// lugar inventado (`lugarInventado`, lib/flujo-ia-intencion.ts) era sólo de Editar; esa respuesta fue de explicar.
// Correr: node --import tsx --test tests/chat-mako-tuerca-y-lugares.test.ts
// ROTURAS (24/10/2026, una por vez y restaurada; base 4 / 0): `lugarInventado` sin el bloque de un canal → 3 / 1; la ruta de
// explicar sin la guarda → 3 / 1; el globo sin la tuerca → 3 / 1; el prompt con el «⋯» otra vez → 3 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { lugarInventado, errorDeRespuestaEnEditar, LO_QUE_NO_ES_TARJETA } from '../lib/flujo-ia-intencion';
import { hiloUnico } from '../app/automations/ChatMako';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('f22: un lugar de Configuraciones que no existe es un error, en Editar y en explicar', () => {
  for (const r of [
    'Va en Configuraciones › Instagram › Goteo.',
    'En la sección de la área de oficina ya aparece un bloque para Instagram donde puedes configurar el tope máximo de comentarios.',
    'Abre Configuraciones y busca la pestaña de WhatsApp.',
  ]) assert.match(String(lugarInventado(r)), /no existe: Configuraciones es una sola pantalla/, r);
  for (const r of [
    'Va en Configuraciones, «Todos los canales», «Goteo».', 'En Configuraciones › Horario de oficina.', 'Toca ↶ arriba del lienzo.',
    'Por WhatsApp sale uno cada 5 minutos.',
  ]) assert.equal(lugarInventado(r), null, r);
  // Editar la usa (lo de antes sigue: «Configuraciones › Acciones»).
  assert.match(String(errorDeRespuestaEnEditar('que lo llame', 'Va en Configuraciones › Acciones.', { esPregunta: false, charlaConTextos: false })), /«Configuraciones › Acciones» no existe/);
  // Y la ruta de explicar también: un lugar inventado vuelve al modelo como error.
  const ruta = leer('app/api/chat-agent/secuencias/ia/route.ts');
  assert.match(ruta, /const falso = x\.r\.respuesta \? lugarInventado\(x\.r\.respuesta\) : null;\s+return falso \? \{ \.\.\.x, errores: \[\.\.\.x\.errores, falso\] \} : x;/);
  assert.match(ruta, /traducir: traducirRespuesta, motivo: 'Contestar una pregunta sobre una automatización'/);
});

test('f19: al modelo se le dice la tuerca del título, no el «⋯» de la lista', () => {
  assert.match(LO_QUE_NO_ES_TARJETA, /«Configuraciones», la tuerca al lado del nombre de esta automatización/);
  assert.doesNotMatch(LO_QUE_NO_ES_TARJETA, /«⋯»/);
});

test('f19: el globo de MaKo que nombra Configuraciones lleva la tuerca de verdad, y la abre; sin quien la abra, no', () => {
  const m = { id: 'm1', de: 'mako' as const, texto: 'Eso va en Configuraciones, «Todos los canales», «Goteo».', at: '2026-10-25T03:00:00Z', via: 'app' as const };
  const otro = { ...m, id: 'm2', texto: 'Listo, cambié el primer mensaje.' };
  const porId = new Map([['m1', { m, i: 0 }], ['m2', { m: otro, i: 1 }]]);
  let abiertas = 0;
  const base = {
    hilo: [{ id: 'm1' }, { id: 'm2' }] as never, porId: porId as never, extraPorId: new Map(), total: 2, preguntaViva: null, ultimoMako: 1,
    deshabilitado: false, trabajando: false, elegir: () => {}, tocarBurbuja: () => {},
  };
  const con = hiloUnico({ ...base, abrirConfiguraciones: () => { abiertas += 1; } });
  const html = (en: Map<string, { abajo?: unknown }>, id: string) => renderToStaticMarkup(createElement(Fragment, null, en.get(id)?.abajo as never));
  assert.match(html(con.enGlobo, 'm1'), /data-tuerca-mako=""[\s\S]*<svg[\s\S]*Configuraciones/, 'el globo no lleva el ícono de verdad');
  assert.doesNotMatch(html(con.enGlobo, 'm2'), /data-tuerca-mako/, 'la tuerca en un mensaje que no habla de Configuraciones');
  const sin = hiloUnico(base);
  assert.doesNotMatch(html(sin.enGlobo, 'm1'), /data-tuerca-mako/, 'una tuerca que no abre nada');
  void abiertas;
});

test('f19: el lienzo le pasa al chat cómo abrir su Configuraciones, y es el mismo ícono del botón del título', () => {
  const perfil = leer('app/automations/SecuenciaPerfil.tsx');
  assert.match(perfil, /onAbrirConfiguraciones=\{Configuraciones \? \(\) => setConfigAbierta\(true\) : undefined\}/);
  const boton = perfil.slice(perfil.indexOf('export function BotonTuerca('), perfil.indexOf('export function BotonTuerca(') + 700);
  assert.match(boton, /<Icon name="config" size=\{18\} \/>/);
  assert.match(leer('app/automations/ChatMako.tsx'), /function TuercaEnElGlobo[\s\S]{0,400}<Icon name="config" size=\{15\} \/>/);
});
