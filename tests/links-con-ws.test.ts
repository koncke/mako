// =============================================================================
// Los links a MaKo que escribe el modelo salen con el `?ws=` del grupo (17/10/2026)
// =============================================================================
// Medido en producción (mako_doer_conv, última semana): en el ws13 6 de 10 links sin `?ws=`, en el ws15 4 de 4,
// en el ws18 1 de 1. Quien los toca mirando otro workspace los abre en el suyo. lib/links-con-ws.ts los
// completa en la salida del doer de WhatsApp (lib/mako-doer-in.ts).
//
// Probado rompiéndolo (17/10/2026), sobre los 3 de este archivo (base 3 / 0): sin cortar la cola de
// puntuación → 2 / 1; con el doer mandando `enviar` sin pasar por `linksConWs` → 2 / 1; pisando el `ws` que
// el link ya traía → 2 / 1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { linksConWs } from '../lib/links-con-ws';

const BASE = 'https://hola-mako.com';

test('los casos medidos en producción salen con su ?ws=', () => {
  assert.equal(linksConWs('Mírala acá: hola-mako.com/crm/2742', 15, BASE), 'Mírala acá: hola-mako.com/crm/2742?ws=15');
  assert.equal(linksConWs('👉 https://hola-mako.com/crm/2741.', 13, BASE), '👉 https://hola-mako.com/crm/2741?ws=13.');
  assert.equal(linksConWs('Conéctalo en hola-mako.com/integraciones?abrir=calendario.', 18, BASE), 'Conéctalo en hola-mako.com/integraciones?abrir=calendario&ws=18.');
  assert.equal(linksConWs('**1.** hola-mako.com/crm/2732\n\n**2.**', 13, BASE), '**1.** hola-mako.com/crm/2732?ws=13\n\n**2.**');
  assert.equal(linksConWs('(https://www.hola-mako.com/chats?lead=2723)', 13, BASE), '(https://www.hola-mako.com/chats?lead=2723&ws=13)');
});

test('lo que ya está bien, o no es una pantalla, no se toca', () => {
  // Un link que ya trae su ws manda sobre el contexto.
  assert.equal(linksConWs('hola-mako.com/crm/2741?ws=13', 15, BASE), 'hola-mako.com/crm/2741?ws=13');
  // La portada, otro dominio, sin workspace o sin texto.
  assert.equal(linksConWs('Visítanos: https://hola-mako.com/', 13, BASE), 'Visítanos: https://hola-mako.com/');
  assert.equal(linksConWs('https://otro.com/crm/1', 13, BASE), 'https://otro.com/crm/1');
  assert.equal(linksConWs('hola-mako.com/crm/1', null, BASE), 'hola-mako.com/crm/1');
  assert.equal(linksConWs('', 13, BASE), '');
});

test('el doer de WhatsApp pasa TODO lo que manda al grupo por linksConWs', () => {
  const src = readFileSync('lib/mako-doer-in.ts', 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /const enviar = \[\.\.\.partes, \.\.\.paraLaPersona\]\.map\(\(t\) => linksConWs\(t, wsData, APP_URL\)\);/);
});
