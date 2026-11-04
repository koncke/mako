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
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { conElDominioDeMaKo, linksConWs } from '../lib/links-con-ws';

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

// ── 27/10/2026: TODO lo que sale al grupo de un negocio, no sólo lo del modelo ─────────────────────────────────────────
// Leila (ws11) reenvió el aviso «Mira el resumen del lead: hola-mako.com/crm/482/resumen» y al abrirlo: «Este lead no es de
// esta cuenta». El link que arma el código (`linkApp`) lleva su `ws` desde el 06/10 (e307a6a6e); uno escrito a mano en una
// tarjeta («MaKo en WhatsApp», «Avisar al equipo») podía salir pelado. Ahora lo completa el envío al grupo
// (lib/mako-grupo.ts). Roturas (base 4 / 0): `enviarAlGrupoMaKo` sin `linksConWs` → 3 / 1; `enviarPartesAlGrupoMaKo` sin
// `partesConLinksDeWs` → 3 / 1; `partesConLinksDeWs` sin el pie de un archivo → 3 / 1.
test('el link de un aviso al grupo sale con el ws del negocio: el texto y el pie de un archivo', async () => {
  const { partesConLinksDeWs } = await import('../lib/links-con-ws');
  assert.equal(linksConWs('📋 Mira el resumen del lead: hola-mako.com/crm/482/resumen', 11, BASE), '📋 Mira el resumen del lead: hola-mako.com/crm/482/resumen?ws=11');
  const partes = partesConLinksDeWs([
    { tipo: 'texto', texto: 'Entró Ana: https://hola-mako.com/crm/482/resumen' },
    { tipo: 'audio', base64: 'x', mime: 'audio/ogg' },
    { tipo: 'media', base64: 'x', caption: 'El PDF: hola-mako.com/crm/482' },
  ], 11, BASE);
  assert.deepEqual(partes.map((p) => ('texto' in p ? p.texto : 'caption' in p ? p.caption : p.tipo)), [
    'Entró Ana: https://hola-mako.com/crm/482/resumen?ws=11', 'audio', 'El PDF: hola-mako.com/crm/482?ws=11',
  ]);
  // Los dos envíos al grupo de un negocio pasan por ahí.
  const src = readFileSync('lib/mako-grupo.ts', 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /const texto = linksConWs\(texto0, ws, APP_BASE_URL\);/);
  assert.match(src, /const r = await enviarPartesAJid\(jid, partesConLinksDeWs\(partes, ws, APP_BASE_URL\), d\);/);
});

// ── El dominio que el modelo inventa (28/10/2026, «hola-malo.com/crm/2761» a Código Inmobiliario, conv 1502) ─────────────
test('un dominio a una o dos letras del de MaKo se corrige; uno distinto de verdad o propio, no', () => {
  const B = 'https://hola-mako.com';
  assert.equal(conElDominioDeMaKo('la ficha: hola-malo.com/crm/2761.', B), 'la ficha: hola-mako.com/crm/2761.');
  assert.equal(conElDominioDeMaKo('https://www.holamako.com/integraciones', B), 'https://www.hola-mako.com/integraciones');
  assert.equal(conElDominioDeMaKo('entra a hola-mako.co/plan', B), 'entra a hola-mako.com/plan');
  for (const t of ['google.com/maps', 'https://codigoinmobiliario.com.ar/x', 'mako.com/y', 'hola-mako.com/crm/1', 'makodigital.app/z']) {
    assert.equal(conElDominioDeMaKo(t, B, ['makodigital.app']), t, `«${t}» se tocó`);
  }
  assert.equal(conElDominioDeMaKo('', B), '');
});

test('el turno real: lo que sale al grupo y lo que queda en la memoria llevan el dominio de MaKo', () => {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_link-inventado-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 280_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@LINK@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  const o = JSON.parse(linea.slice('@@LINK@@'.length));
  assert.equal(o.error, undefined, String(o.error));
  assert.deepEqual(o.salio, ['Aquí está la ficha: hola-mako.com/crm/2761?ws=13. Conecta Meta en https://www.hola-mako.com/integraciones?ws=13 y mira el local en google.com/maps.']);
  assert.deepEqual(o.memoria, ['Aquí está la ficha: hola-mako.com/crm/2761. Conecta Meta en https://www.hola-mako.com/integraciones y mira el local en google.com/maps.'], 'el dominio inventado quedó en el historial');
});

// ── Probado rompiéndolo (28/10/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   D1 `conElDominioDeMaKo` sin la distancia (no corrige nada)                          → fallan el 4 y el 5
//   D2 la distancia sin tope (corrige mako.com y google.com)                             → fallan el 4 y el 5
//   D3 el doer sin `conElDominioDeMaKo` en `partes`                                      → falla el 5
