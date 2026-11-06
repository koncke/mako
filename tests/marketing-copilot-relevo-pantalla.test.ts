// =============================================================================
// Marketing CoPilot — la pantalla dice lo que hace el relevo y el botón de una variación (6/11/2026)
// =============================================================================
// Lo dejó anotado el chat de anuncios para Thiago (docs/relevo/nube-thiago-anuncios.md → «Para el chat Marketing CoPilot»): el
// relevo (táctica Ganador + pausar, lib/media-buyer/motor.ts) se pintaba como «Anuncio ganador» / «probar textos nuevos», en rojo y
// con «Frenar el gasto que no trae leads» (el original no gasta sin traer: le ganó su variación); y una variación de BOTÓN
// (lib/media-buyer/variacion-boton.ts) se veía igual que el original, porque la tarjeta no decía qué botón lleva.
// Las funciones y la tarjeta se EJECUTAN (renderToStaticMarkup), no se leen.
// Probado rompiéndolo: al pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { impactoEsperado, mensajeDeHoy, rotuloDe, tonoDe } from '../app/ads-manager/mb-modelo';
import { TarjetaAccion } from '../app/ads-manager/Autopilot';
import type { Decision } from '../lib/media-buyer/tipos';

const D = (x: Partial<Decision>): Decision => ({
  id: 'd1', ws: 3, clave: 'k', tipo: 'pausar', tactica: 'ganador', nivel: 'ad', entidadId: 'a1', entidadNombre: 'Original · Video 1',
  campanaNombre: 'Mentoría', titulo: 'Pausar el original', titular: 'Su variación cuesta 25% menos', porque: [], numeros: [],
  antes: { estado: 'ACTIVE' }, despues: { estado: 'PAUSED' }, moneda: 'USD', estado: 'abierta', creada: '2026-11-06T10:00:00Z',
  origen: null, aplicadaPor: null, aplicadaAt: null, deshechaPor: null, deshechaAt: null, canal: null, error: null, nota: null,
  motivoDescarte: null, estrellas: null, creados: [], anuncioBase: null, ...x,
} as Decision);

test('el relevo se nombra como lo que es: el original que su variación superó, en verde', () => {
  const relevo = D({});
  assert.equal(rotuloDe(relevo), 'Le gana su variación');
  assert.equal(tonoDe(relevo), 'bien', 'pausar el original porque la variación le gana es una buena noticia');
  const impacto = impactoEsperado(relevo, 'agenda').join(' · ');
  assert.match(impacto, /variación que ya rinde más/);
  assert.doesNotMatch(impacto, /no trae/, 'el original no gasta sin traer: le ganó su variación');
  assert.match(mensajeDeHoy([relevo], 'agenda'), /pausar el original que ya superó su variación/);
  assert.doesNotMatch(mensajeDeHoy([relevo], 'agenda'), /probar textos nuevos/);
  // Las otras decisiones del Ganador siguen como estaban.
  assert.equal(rotuloDe(D({ tipo: 'variaciones_texto' })), 'Anuncio ganador');
  assert.equal(rotuloDe(D({ tipo: 'variaciones_hook' })), 'Video ganador');
  assert.equal(tonoDe(D({ tipo: 'variaciones_texto' })), 'mako');
  assert.equal(tonoDe(D({ tactica: 'stop_loss' })), 'mal', 'un pausar de Stop loss sigue siendo una pérdida');
  assert.match(impactoEsperado(D({ tactica: 'stop_loss' }), 'agenda').join(' '), /no trae agendas/);
});

test('una variación de botón dice qué botón lleva; una de texto, no', () => {
  const d = D({ tipo: 'variaciones_texto', antes: {}, despues: {}, variaciones: [
    { id: 'v1', textoPrincipal: 'Agenda tu llamada', elegida: true },
    { id: 'v2', textoPrincipal: 'Agenda tu llamada', gancho: 'Mismo texto, otro botón', elegida: true, cta: 'APPLY_NOW' },
    { id: 'v3', textoPrincipal: 'Agenda tu llamada', elegida: true, cta: 'CODIGO_RARO' },
  ] });
  const html = renderToStaticMarkup(createElement(TarjetaAccion, {
    d, kpi: 'lead', producto: null, ocupada: false, encendido: true, ajustesHref: '#',
    onAplicar: async () => true, onBorrar: () => {}, onPreguntar: () => {}, onDeshacer: () => {}, onReabrir: () => {}, onCalificar: () => {}, onHooksAVideo: () => {},
  }));
  assert.match(html, /Botón: (<!-- -->)?Solicitar ahora/, 'el nombre del botón como lo dice Meta en español');
  assert.match(html, /Botón: (<!-- -->)?CODIGO_RARO/, 'un botón sin nombre en la tabla sale tal cual, no desaparece');
  assert.equal((html.match(/Botón: /g) ?? []).length, 2, 'la variación de texto no dice botón');
});

// ── Probado rompiéndolo (6/11/2026) ──────────────────────────────────────────────────────────────────────────────────────
// · rotuloDe sin el caso `pausar` del Ganador → rojo el 1 («Anuncio ganador»).
// · tonoDe sin la línea del relevo → rojo el 1 ('mal').
// · impactoEsperado sin la rama del Ganador → rojo el 1 («Frenar el gasto que no trae…»).
// · POR_TACTICA.ganador sin el caso `pausar` → rojo el 1 («probar textos nuevos»).
// · Autopilot sin la línea de `v.cta` → rojo el 2.
