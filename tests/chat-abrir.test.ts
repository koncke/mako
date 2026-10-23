// =============================================================================
// «Abrir en la app», y lo confirmado afuera vuelve al hilo (20/10/2026, ola 1, pieza 1.8)
// =============================================================================
// docs/ops-center-principal.md §2.6. Hecho = «Una edición de video deja "Abrir en el editor"; "mandale un WhatsApp a
// Juan: mañana te llamo" deja "Borrador para Juan" con "Abrir en Chats" en ESA conversación; lo que se confirma en
// /mako/revisar aparece en el hilo». Lo que se fija:
//   1. la propuesta del Video Editor y el borrador de WhatsApp quedan en el hilo con su botón, y abren ESA propuesta y
//      ESA conversación (con su query, sin el `ws`);
//   2. una tarjeta confirmada trae su «Abrir en <tab>» del link que devolvió la acción (nunca uno de afuera), y la
//      pantalla lo pone en la tarjeta (`conTarjeta`);
//   3. lo que se confirma o se descarta en /mako/revisar queda en el hilo de donde salió, por el camino real
//      (tests/_revisar-hilo-hijo.ts), y nunca en el chat de otro negocio;
//   4. las pantallas dibujan el botón: la tarjeta, la propuesta de pantalla, el teléfono y el MaKo Analyst de la ficha.
//
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   · `linksDeUnaAccion` sin mirar las propuestas de pantalla (sólo /revisar/, como antes) → 1 fallo (1);
//   · `rutaConQuery` que deja pasar un host de afuera → 1 fallo (2);
//   · `aplicarPropuestaGenerica` sin anotar en el hilo → 1 fallo (3);
//   · la propuesta sin la clave de su chat → 1 fallo (3);
//   · la tarjeta sin el botón «Abrir» → 1 fallo (4).

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { linkApp } from '../lib/app-url';
import { REGISTRO } from '../lib/api-mako/registro';
import { abrirDeResultado, linksDeUnaAccion, propuestaDePantalla, rutaConQuery } from '../lib/mako-turno-app-reglas';
import type { ResultadoTarjeta, TarjetaPendiente } from '../lib/mako-turno-app-reglas';
import { conTarjeta, type ItemHilo } from '../app/m/mako/chat-ui';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
/** Lo que el turno ve cuando una acción deja una propuesta (lib/api-mako/ejecutar.ts): `extra` primero, después el link. */
const salidaDePropuesta = (url: string, extra: Record<string, unknown> = {}) => JSON.stringify({ ...extra, ok: true, url, link: url, nueva: true, instruccion: '…' });

test('1. la edición de video y el borrador de WhatsApp dejan su botón, y abren ESA propuesta y ESA conversación', () => {
  const video = REGISTRO.find((d) => d.area === 'video' && d.tipo === 'accion' && d.confirmacion === 'pantalla' && d.pantalla === '/video-editor');
  assert.ok(video, 'hay operaciones del Video Editor que se aceptan en el editor');
  const [ed] = linksDeUnaAccion(video!.id, {}, salidaDePropuesta(linkApp('/video-editor/proy-1?propuesta=abc123', 3)));
  assert.ok(ed, 'la propuesta de video se captura (antes sólo se capturaba /revisar/)');
  const pv = propuestaDePantalla(ed);
  assert.equal(pv.escritorio, '/video-editor/proy-1?propuesta=abc123', 'abre ESA propuesta, sin el ws (lo pone el Link)');
  assert.equal(pv.boton, 'Abrir en el editor');
  assert.equal(pv.titulo, video!.titulo);

  const chat = '5491155556666@s.whatsapp.net';
  const [wa] = linksDeUnaAccion('crear_borrador_whatsapp_empresa', { leadId: 7, texto: 'mañana te llamo' },
    salidaDePropuesta(linkApp(`/whatsapp?canal=no-oficial&chat=${encodeURIComponent(chat)}`, 3), { para: 'Juan', nota: 'Quedó en la cola…' }));
  const pw = propuestaDePantalla(wa);
  assert.equal(pw.titulo, 'Borrador para Juan');
  assert.equal(pw.boton, 'Abrir en Chats');
  assert.equal(new URLSearchParams(pw.escritorio.split('?')[1]).get('chat'), chat, 'en ESA conversación');
  assert.match(pw.nota, /No se mandó nada/);

  // Lo de siempre no cambia: la pantalla de revisión.
  const [rev] = linksDeUnaAccion('editar_contacto_lead', {}, salidaDePropuesta(linkApp('/mako/revisar/p-1', 3)));
  assert.deepEqual([propuestaDePantalla(rev).escritorio, propuestaDePantalla(rev).boton], ['/mako/revisar/p-1', 'Abrir para revisar']);
  assert.deepEqual(linksDeUnaAccion('listar_leads', {}, salidaDePropuesta(linkApp('/video-editor/x?propuesta=y', 3))), [], 'una lectura no deja link');
});

test('2. la tarjeta confirmada trae su «Abrir en <tab>», sólo de un link de la app', () => {
  const landing = REGISTRO.find((d) => d.area === 'landing' && d.tipo === 'accion');
  const a = abrirDeResultado(landing!.id, { link: linkApp('/web-generator/l-1', 3) });
  assert.ok(a && a.href === '/web-generator/l-1' && /^Abrir en \S/.test(a.titulo), JSON.stringify(a));
  assert.equal(abrirDeResultado(landing!.id, { link: 'https://otro.com/web-generator/l-1' }), null, 'un link de afuera no');
  assert.equal(rutaConQuery('https://otro.com/x'), null);
  assert.equal(abrirDeResultado(landing!.id, { id: 3 }), null, 'sin link, sin botón');

  const t = { pendienteId: 5, titulo: 'X', resumen: 'Hacer X', consecuencia: null, escribe: null, deshacer: true, venceAt: '', vence: '', detalle: [] } as TarjetaPendiente;
  const xs: ItemHilo[] = [{ k: 'propuesta', id: 'p5', t, estado: 'aplicando' }];
  const r: ResultadoTarjeta = { ok: true, resumen: 'Hecho', paraLaPersona: ['Ojo con Y'], abrir: { titulo: 'Abrir en Web Generator', href: '/web-generator/l-1' } };
  const sig = conTarjeta(xs, 5, 'hecho', undefined, r);
  assert.deepEqual(sig[0], { k: 'propuesta', id: 'p5', t, estado: 'hecho', nota: undefined, abrir: r.ok ? r.abrir : undefined }, 'la tarjeta queda con su botón');
  assert.equal(sig[1]?.k, 'aviso', 'y lo que vuelve, debajo');
  assert.deepEqual(conTarjeta(xs, 5, 'aplicando'), [{ ...xs[0], nota: undefined }], 'sin respuesta, sólo el estado');
});

test('3. lo confirmado o descartado en /mako/revisar queda en el hilo de donde salió (y nunca en el de otro negocio)', () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_revisar-hilo-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const r = JSON.parse(salida) as {
    confirmada: { ok: boolean }; ajena: { ok: boolean }; datosDeLaPropuesta: Record<string, unknown> | null;
    hilo: { session_id: number; role: string; content: string }[]; red: string[];
  };
  assert.deepEqual(r.red, [], 'nada sale a la red');
  assert.ok(r.confirmada.ok && r.ajena.ok, 'las dos se ejecutaron');
  assert.equal(r.datosDeLaPropuesta?.canalKey, 'app:77', 'la propuesta guarda el chat de donde salió');
  assert.deepEqual(r.hilo.map((m) => [m.session_id, m.content.split(':')[0]]), [[77, 'Hecho'], [77, 'No se ejecutó (se descartó en su pantalla)']],
    'el «Hecho» y el descarte, en el chat 77; nada en el chat del otro negocio');
});

test('4. las pantallas dibujan el botón', () => {
  assert.match(sinComentarios(leer('app/_chat/TarjetaAccion.tsx')), /x\.estado === 'hecho' && x\.abrir && <div className="ch-tarjeta__botones"><Link className="ch-abrir" href=\{x\.abrir\.href\}>\{x\.abrir\.titulo\}<\/Link>/, 'la tarjeta');
  assert.match(sinComentarios(leer('app/_chat/HiloMako.tsx')), /<p className="ch-tarjeta__nota">\{x\.p\.nota\}<\/p>\s*<div className="ch-tarjeta__botones"><Link className="ch-abrir" href=\{x\.p\.escritorio\}>\{x\.p\.boton\}<\/Link>/, 'la propuesta de pantalla');
  // El de la ficha dibuja con el MISMO hilo desde el 22/10/2026 (CR3): la tarjeta y la pantalla son las de arriba.
  assert.match(sinComentarios(leer('app/crm/lead-view/MakoAnalystLead.tsx')), /<HiloMako key=\{leadId\} items=\{items\} quien=\{QUIEN\}/, 'el MaKo Analyst de la ficha');
  for (const f of ['app/second-brain/useChatCliente.ts', 'app/crm/lead-view/MakoAnalystLead.tsx']) {
    assert.match(sinComentarios(leer(f)), /setItems\(\(xs\) => conTarjeta\(xs, pendienteId, estado, nota, r\)\);/, `${f}: el estado de la tarjeta, con conTarjeta`);
  }
});
