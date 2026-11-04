// =============================================================================
// La pestaña Chats del teléfono lee la bandeja UNIFICADA de escritorio (17/10/2026)
// =============================================================================
// Hasta el 17/10/2026 el teléfono leía sólo WhatsApp con lead (`getConversacionesNoOficial` en
// app/m/chats/datos.ts): un negocio que vende por Instagram veía «Todavía no hay chats.» con la bandeja de
// la computadora llena, y un aviso de Instagram (/chats?c=ig:…) abría esa lista vacía. Esto fija:
//   · que la lista sale de `listarChats` (lib/chats.ts), la misma de GET /api/chats;
//   · los rótulos de las bandejas y del filtro, cruzados contra el código de escritorio;
//   · el hilo por día con la zona del NEGOCIO (el server corre en UTC);
//   · la ida y vuelta de la URL de una conversación (/chats?c=<clave> ↔ /m/chats/<clave>).
//
// Probado rompiéndolo (17/10/2026, con los 8 tests de ese momento), con `MAKO_TESTS_SIN_ESPERA=1 node --test --import tsx`:
//   · datos.ts de vuelta a `getConversacionesNoOficial` sin `listarChats`: 7 pasan / 1 falla («lee la bandeja unificada»);
//   · «Míos» renombrado a «Mios» en modelo.ts: 7 / 1 («los rótulos son los de escritorio»);
//   · `diaEnZona` con la hora del server (getUTC…) en vez de la zona: 7 / 1 («el día sale de la zona del negocio»);
//   · la rama `/m/chats/<clave>` borrada de `rutaEscritorio`: 7 / 1 («ida y vuelta»).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BANDEJAS_M, MOSTRAR_M, ORDEN_M, CANALES_M, bandejasVisibles, conteoDeBandeja, hiloDelLink, rotuloFiltro, rutaHiloM, segundaLinea,
} from '../app/m/chats/modelo';
import { diasDelHilo, diaEnZona } from '../app/m/chats/hilo-modelo';
import { rutaEscritorio, rutaMovil } from '../lib/movil-rutas';
import type { ConteosBandeja } from '../lib/chats-reglas';
import type { MensajeChat } from '../lib/chats-tipos';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { previewDe } from '../app/chats/lista-reglas';
import { BurbujaChatM } from '../app/m/chats/[clave]/BurbujaChatM';
import { LO_ULTIMO_FUE_COMENTAR, eventoDelComentario } from '../lib/canal-social';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('lee la bandeja unificada de escritorio (WhatsApp, Instagram, Messenger y Email), no sólo WhatsApp', () => {
  const src = sinComentarios(leer('app/m/chats/datos.ts'));
  assert.match(src, /listarChats\(\{[^}]*paginasWhatsapp/, 'la lista sale de listarChats, acotada en páginas de WhatsApp');
  assert.doesNotMatch(src, /getConversacionesNoOficial/, 'leer WhatsApp a mano deja afuera Instagram, Messenger y Email');
  // Y lib/chats.ts pasa el tope al lector del espejo (sin eso, el teléfono pagaba las 20 páginas en serie).
  assert.match(leer('lib/chats.ts'), /getConversacionesNoOficial\([^)]*opts\?\.paginasWhatsapp \? \{ paginas: opts\.paginasWhatsapp \}/);
});

test('los rótulos son los de escritorio (bandejas, Mostrar, Orden, canales)', () => {
  // Desde el 24/10/2026 la Bandeja de escritorio son los chips de FiltrosChats.tsx (docs/diseno-chats.md §8.1), y los
  // nombres de los canales que se conectan viven en ConectarCanal.tsx.
  const filtros = leer('app/chats/FiltrosChats.tsx');
  for (const b of BANDEJAS_M) assert.ok(filtros.includes(`'${b.label}'`), `«${b.label}» no está en las bandejas de escritorio`);
  for (const m of [...MOSTRAR_M, ...ORDEN_M]) assert.ok(filtros.includes(`label: '${m.label}'`), `«${m.label}» no está en el filtro de escritorio`);
  const canales = filtros + leer('app/chats/ConectarCanal.tsx');
  for (const c of CANALES_M) assert.ok(canales.includes(`'${c.label}'`), `«${c.label}» no está en los canales de escritorio`);
  assert.equal(rotuloFiltro({ mostrar: 'abiertas', orden: 'recientes', canal: null }), 'Abiertas, Más recientes');
  assert.equal(rotuloFiltro({ mostrar: 'todas', orden: 'antiguas', canal: 'instagram' }), 'Instagram · Todas, Más antiguas');
});

test('Borradores y Bloqueados aparecen sólo con algo adentro; las fijas, siempre', () => {
  const cero = { abiertas: 0, nuevos: 0 };
  const c: ConteosBandeja = {
    todos: { abiertas: 5, nuevos: 2 }, mios: cero, sinAsignar: cero, mako: cero, borradores: cero, bloqueados: cero,
    porCanal: { whatsapp: cero, instagram: cero, messenger: cero, email: cero }, porCuenta: {}, porEtapa: {}, porFunnel: {}, porEtapaEnFunnel: {},
  };
  assert.deepEqual(bandejasVisibles(c).map((b) => b.id), ['todos', 'mios', 'sin-asignar', 'mako']);
  assert.deepEqual(conteoDeBandeja(c, 'todos'), { n: 2, nuevos: true }, 'la píldora de una bandeja cuenta lo NUEVO');
  const conBloq: ConteosBandeja = { ...c, bloqueados: { abiertas: 3, nuevos: 0 } };
  assert.deepEqual(bandejasVisibles(conBloq).map((b) => b.id).slice(-1), ['bloqueados']);
  assert.deepEqual(conteoDeBandeja(conBloq, 'bloqueados'), { n: 3, nuevos: false }, 'en Bloqueados el número es el total');
});

test('la segunda línea: «Tú: » si lo mandamos, el tipo de un adjunto, y nunca vacía', () => {
  const base = { ultimaFecha: '2026-10-17T12:00:00Z', ultimoTipo: 'text' as const };
  assert.equal(segundaLinea({ ...base, ultimoTexto: 'Hola', ultimoEntrante: true }), 'Hola');
  assert.equal(segundaLinea({ ...base, ultimoTexto: 'Te paso el link', ultimoEntrante: false }), 'Tú: Te paso el link');
  assert.equal(segundaLinea({ ...base, ultimoTipo: 'document', ultimoTexto: 'contrato.pdf', ultimoEntrante: true }), '(Archivo)', 'el rótulo de escritorio (previewDe)');
  assert.equal(segundaLinea({ ultimaFecha: null, ultimoTipo: null, ultimoTexto: null, ultimoEntrante: false }), 'Sin mensajes');
});

test('un link de escritorio que nombra la conversación va directo a ella; el de WhatsApp se busca en la lista', () => {
  assert.equal(hiloDelLink({ tipo: 'clave', clave: 'ig:77' }), '/m/chats/ig%3A77');
  assert.equal(hiloDelLink({ tipo: 'lead', leadId: 12 }), '/m/chats/lead%3A12');
  assert.equal(hiloDelLink({ tipo: 'whatsapp', linea: 'mako_ws3', chat: '5491100000000@s.whatsapp.net' }), null);
  assert.equal(hiloDelLink(null), null);
});

test('ida y vuelta: /chats?c=<clave> ↔ /m/chats/<clave>, también con la @ de un email', () => {
  for (const clave of ['lead:12', 'ig:77', 'fb:5', 'wa:mako_ws13:5491122334455', 'em:juan.perez@ejemplo.com']) {
    const movil = rutaHiloM(clave);
    const escritorio = rutaEscritorio(movil);
    assert.equal(new URL(escritorio, 'https://x').searchParams.get('c'), clave, `${movil} → ${escritorio}`);
    assert.equal(rutaMovil(escritorio), movil, `${escritorio} no vuelve a ${movil}`);
  }
});

const msj = (id: string, fecha: string, extra: Partial<MensajeChat> = {}): MensajeChat => ({
  id, tipo: 'mensaje', canal: 'whatsapp', cuenta: 'mako_ws3', saliente: false, autor: null, texto: 'Hola', formato: 'text',
  mediaUrl: null, mediaMime: null, fecha, status: null, error: null, ...extra,
});

test('el día sale de la zona del negocio, no del reloj del server (UTC)', () => {
  const tz = 'America/Argentina/Buenos_Aires';
  // 01:30 UTC del 17 son las 22:30 del 16 en Buenos Aires.
  assert.equal(diaEnZona(new Date('2026-10-17T01:30:00Z'), tz), '2026-10-16');
  const ahora = new Date('2026-10-17T15:00:00Z');
  const dias = diasDelHilo([msj('wa:1', '2026-10-17T01:30:00Z'), msj('wa:2', '2026-10-17T14:00:00Z')], tz, ahora);
  assert.deepEqual(dias.map((d) => d.etiqueta), ['Ayer', 'Hoy']);
  assert.equal(dias[0].items[0].hora, '22:30');
});

test('el hilo: un documento no repite su nombre como texto, y el canal se dice sólo con más de uno', () => {
  const tz = 'America/Mexico_City';
  const ahora = new Date('2026-10-17T18:00:00Z');
  const solo = diasDelHilo([msj('wa:1', '2026-10-17T16:00:00Z', { formato: 'document', texto: 'contrato.pdf', mediaUrl: 'https://x/c.pdf' })], tz, ahora);
  const it = solo[0].items[0];
  assert.equal(it.texto, null);
  assert.deepEqual(it.media, { tipo: 'archivo', url: 'https://x/c.pdf', nombre: 'contrato.pdf' });
  assert.equal(it.canal, null, 'con un solo canal, decirlo en cada burbuja sobra');
  const dos = diasDelHilo([msj('wa:1', '2026-10-17T16:00:00Z'), msj('ig:2', '2026-10-17T16:05:00Z', { canal: 'instagram', cuenta: 'z1' })], tz, ahora);
  assert.deepEqual(dos[0].items.map((x) => x.canal), ['WhatsApp', 'Instagram']);
  const evento = diasDelHilo([msj('ev:1', '2026-10-17T16:00:00Z', { tipo: 'evento', canal: null, texto: null, partes: [{ t: 'Cerrada por ' }, { t: 'Ana', b: true }] })], tz, ahora);
  assert.equal(evento[0].items[0].texto, 'Cerrada por Ana');
});

test('«WhatsApp» de la ficha del teléfono abre la conversación en Chats, con la función de escritorio', () => {
  // Roto (17/10/2026) volviendo al hilo de sólo WhatsApp (`/m/crm/${p.id}/chat`): 8 / 1.
  const ficha = sinComentarios(leer('app/m/crm/[id]/FichaLead.tsx'));
  assert.match(ficha, /href=\{rutaChatsDeLead\(p\.id\)\} aria-label=\{`WhatsApp con/);
  assert.equal(rutaMovil('/chats?lead=12'), rutaHiloM('lead:12'), 'y en el teléfono ese link es la conversación');
});

// Ticket #50 (Leandro, 4/11/2026): 293 de sus 356 chats de Instagram son gente que sólo comentó. La fila decía «(Mensaje no compatible)» y
// el hilo «Todavía no hay mensajes»: parecía que no cargaban.
// ROMPIÉNDOLO (4/11/2026, base 11 de 11 en este archivo): `ultimoTipo: 'otro'` → 1 fallo («(Mensaje no compatible)»); `eventoDelComentario` sin
// su fecha → 1 fallo (el día no se arma: el evento se pierde); sin el `if` de `comentarioAt` → 1 fallo. Sin efecto (un paréntesis de más): 0 fallos.
test('#50: quien sólo comentó dice «Comentó una publicación» en la fila y en el hilo, en su día', () => {
  assert.equal(previewDe({ ...LO_ULTIMO_FUE_COMENTAR, ultimaFecha: null }), 'Comentó una publicación');
  assert.equal(segundaLinea({ ...LO_ULTIMO_FUE_COMENTAR, ultimaFecha: null, ultimoEntrante: true }), 'Comentó una publicación', 'lo hizo la persona: sin «Tú:»');
  // Un adjunto que de verdad no se reconoce sigue diciéndose por su tipo.
  assert.equal(previewDe({ ultimoTexto: null, ultimoTipo: 'otro', ultimaFecha: null }), '(Mensaje no compatible)');

  assert.equal(eventoDelComentario({ id: 7, comentarioAt: null }), null, 'sin comentario no se inventa');
  const ev = eventoDelComentario({ id: 472, comentarioAt: '2026-11-03T21:03:03.976Z' });
  assert.ok(ev);
  const dias = diasDelHilo([ev], 'America/Buenos_Aires', new Date('2026-11-03T21:10:00Z'));
  assert.deepEqual(dias.map((d) => d.etiqueta), ['Hoy']);
  assert.deepEqual(dias[0].items.map((i) => [i.tipo, i.texto, i.hora]), [['evento', 'Comentó una publicación', '18:03']]);
});

// Ticket #50: la velocidad en el teléfono. ROMPIÉNDOLO (4/11/2026): la burbuja con el `<audio controls>` de antes → 1 fallo.
test('#50: el audio de un chat en el teléfono se escucha con el reproductor de la casa, que tiene la velocidad', () => {
  const [dia] = diasDelHilo([{
    id: 'wa:1', tipo: 'mensaje', canal: 'whatsapp', cuenta: null, saliente: false, autor: null, texto: null, formato: 'audio',
    mediaUrl: 'https://x.test/a.ogg?token=t', mediaMime: 'audio/ogg', fecha: '2026-11-03T20:35:00.000Z', status: null, error: null,
  }], 'America/Buenos_Aires', new Date('2026-11-03T21:10:00Z'));
  const html = renderToStaticMarkup(createElement(BurbujaChatM, { m: dia.items[0] }));
  assert.ok(html.includes('aria-label="Velocidad del audio: 1×"'), html.slice(0, 300));
  assert.ok(!html.includes(' controls'), 'sin los controles nativos');
});
