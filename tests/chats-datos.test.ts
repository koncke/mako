// =============================================================================
// La tab Chats por DENTRO: claves, contactos, estado, no leídos, filtros, contadores y su base
// =============================================================================
// Pedido de Martín (14/10/2026): «tener en UNA sola tab centralizado absolutamente todos los chats, WhatsApp,
// Instagram, Messenger». El plano es docs/diseno-chats.md. Lo que se prueba es lo PURO (lib/chats-reglas.ts) y
// los cableados que lo hacen verdad, porque ninguno de estos errores da un síntoma en el momento:
//
//   · una clave que no se lee como se arma abre OTRA conversación (o ninguna) desde un link;
//   · la clave de WhatsApp tiene que ser la MISMA regla que `claveTel` (lib/evolution-mensajes.ts), con la que el
//     espejo agrupa los mensajes: si no, la fila de la lista no encuentra su hilo;
//   · las identidades de un lead van en UN contacto, y los placeholders de «Nutrición - Manual» que trae cada
//     lectura POR LÍNEA no se multiplican en el selector de canal;
//   · una cerrada se reabre sola si el contacto escribe después; una pospuesta vuelve al vencer o si escribe;
//   · «Míos», «Sin asignar», «Atiende MaKo», «Bloqueados»: un bloqueado vive SÓLO en su bandeja;
//   · el contador del panel y la lista cuentan con la MISMA regla (si no, el panel dice 12 y la lista 11);
//   · la migración 0284: las tres tablas con `workspace_id` sin `default 1`, RLS y revoke, y en las DOS listas de
//     inquilino (sin TENANT_TABLES getTenantDb es PASSTHROUGH: un negocio vería cerradas las de otro);
//   · las rutas pasan TODAS por `puertaChats` (esconder la tab no protege), y WhatsApp se lee SIEMPRE con línea.
//
// Probado ROMPIÉNDOLO (14/10/2026): un arnés aplica cada rotura sobre el texto, corre este archivo y restaura de
// memoria (nunca git; los md5 de los cinco archivos tocados, iguales antes y después). Base en verde: 17 pases /
// 0 fallos. Rota (pases / fallos, y cuál cae):
//   · `parsearClave` acepta `lead:0` (`id >= 0`)                                   → 16 / 1  (las claves)
//   · `idWhatsapp` con `d.length >= 10` (distinta de `claveTel`)                    → 16 / 1  (paridad con claveTel)
//   · agrupar sin `lead:` (cada fuente con su clave sin lead)                        → 14 / 3  (los tres de agrupar)
//   · los placeholders sin filtrar (`f.total > 0 || f === queda` → `true`)          → 16 / 1  (placeholders)
//   · una cerrada que NO se reabre con un entrante posterior                        → 16 / 1  (estadoEfectivo)
//   · una pospuesta que no vence (`hasta <= ahoraMs` → `false`)                      → 16 / 1  (estadoEfectivo)
//   · «Míos» sólo por el asignado (sin el closer)                                    → 16 / 1  (las bandejas)
//   · un bloqueado que se cuela en «Todos» (sin `if (c.bloqueado) return false`)    → 15 / 2  (bandejas, contador = lista)
//   · `ordenarChats` con las sin fecha PRIMERO                                       → 15 / 2  (bandejas, orden)
//   · `contarBandejas` sin el Set de cuentas (cuenta dos veces la misma línea)      → 16 / 1  (contador = lista)
//   · `'chat_leidos'` fuera de TENANT_TABLES (lib/workspace.ts)                      → 16 / 1  (listas de inquilino)
//   · la mig 0284 con `workspace_id … not null default 1 references …`            → 16 / 1  (migración)
//   · el `check` de `chat_eventos.tipo` sin 'reanudada'                              → 16 / 1  (migración)
//   · app/api/chats/contacto sin el `if (!puerta.ok) return …`                      → 16 / 1  (la puerta)
//   · `getConversacionesNoOficial(600, false)` sin la línea en lib/chats.ts          → 16 / 1  (WhatsApp por línea)
// Restaurado: 17 / 0.
//
// Correr: node --import tsx --test tests/chats-datos.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  agruparPorContacto, atiendeMako, autorLegible, CAMPOS_AUDIT_DEL_HILO, claveCuenta, claveLead, claveSocial, claveWhatsapp,
  coincideBusqueda, contarBandejas, enCanal, enMostrar, enVista, esMio, estadoEfectivo, estaSinAsignar, FILTRO_INICIAL,
  filtrarChats, formatoDe, formatoDeAdjunto, idWhatsapp, ordenarChats, parsearClave, partesDeAudit, partesDeEvento,
  sinLeer, statusDe, textoDePartes, TIPOS_EVENTO_CHAT, TOPE_CLAVE,
  type ContextoContactos, type FiltroChats, type FuenteChat, type LeadDelChat, type VistaChats,
} from '../lib/chats-reglas';
import type { CanalChat, ChatResumen, IdentidadCanal } from '../lib/chats-tipos';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** El CÓDIGO, sin la prosa: los comentarios de bloque y de línea fuera (las cabeceras nombran lo que el código no hace). */
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

const AHORA = Date.parse('2026-10-14T12:00:00Z');
const H = (hhmm: string, dia = '14') => `2026-10-${dia}T${hhmm}:00.000Z`;

// ── Armadores ─────────────────────────────────────────────────────────────────────

function ident(o: Partial<IdentidadCanal> & Pick<IdentidadCanal, 'canal' | 'ref'>): IdentidadCanal {
  return {
    cuenta: null, rotulo: 'X', destino: null, telefono: null, ultimaFecha: null,
    puedeEscribir: true, motivoNoEscribir: null, bloqueado: false, ...o,
  };
}

type Extra = { leadId?: number | null; total?: number; entrante?: boolean; bloqueado?: boolean; nombre?: string };

/** Una conversación de WhatsApp de UNA línea, como la arma lib/chats.ts. */
function wa(linea: string, tel: string, fecha: string | null, x: Extra = {}): FuenteChat {
  const entrante = x.entrante ?? true;
  const jid = `${tel}@s.whatsapp.net`;
  return {
    identidad: ident({ canal: 'whatsapp', cuenta: linea, ref: jid, telefono: tel, ultimaFecha: fecha, bloqueado: !!x.bloqueado }),
    leadId: x.leadId ?? null,
    claveSinLead: claveWhatsapp(linea, tel, jid),
    nombre: x.nombre ?? tel,
    empresa: null,
    ultimoTexto: fecha ? 'hola' : null,
    ultimoTipo: fecha ? 'text' : null,
    ultimaFecha: fecha,
    ultimoEntrante: fecha ? entrante : false,
    ultimaEntrante: fecha && entrante ? fecha : null,
    total: x.total ?? (fecha ? 1 : 0),
  };
}

/** Una persona de Instagram o Messenger. */
function social(canal: 'instagram' | 'messenger', convId: number, fecha: string | null, x: Extra = {}): FuenteChat {
  const entrante = x.entrante ?? true;
  return {
    identidad: ident({ canal, cuenta: 'acc1', ref: String(convId), destino: '@persona', ultimaFecha: fecha }),
    leadId: x.leadId ?? null,
    claveSinLead: claveSocial(canal, convId),
    nombre: x.nombre ?? '@persona',
    empresa: null,
    ultimoTexto: 'hola', ultimoTipo: 'text', ultimaFecha: fecha,
    ultimoEntrante: entrante, ultimaEntrante: entrante ? fecha : null,
    total: x.total ?? 1,
  };
}

const LEAD7: LeadDelChat = {
  id: 7, nombre: 'Ana Pérez', empresa: 'Café Ana', telefono: '5215512345678', setter: 'Lucía', closer: null,
  etapaKey: 'agenda', etapaLabel: 'Agenda',
};

function ctx(o: Partial<ContextoContactos> = {}): ContextoContactos {
  return {
    leads: new Map(), estados: new Map(), leidos: new Map(),
    borradores: { leadIds: new Set(), tels: new Set() },
    lineaDefault: 'mako_ws3', ahoraMs: AHORA, ...o,
  };
}

function chat(o: Partial<ChatResumen> & { clave: string }): ChatResumen {
  return {
    leadId: null, nombre: o.clave, empresa: null, avatarTel: null,
    canales: [ident({ canal: 'whatsapp', cuenta: 'mako_ws3', ref: `${o.clave}@s.whatsapp.net` })],
    canalUltimo: 'whatsapp', ultimoTexto: 'hola', ultimoTipo: 'text', ultimaFecha: H('10:00'), ultimoEntrante: true,
    etapaKey: null, etapaLabel: null, asignado: null, closer: null, estado: 'abierta', pospuestaHasta: null,
    sinLeer: false, borrador: false, bloqueado: false, ...o,
  };
}

// ── Claves ────────────────────────────────────────────────────────────────────────

test('las claves: se leen como se arman, y lo que viene del navegador se valida', () => {
  assert.deepEqual(parsearClave(claveLead(7)), { tipo: 'lead', leadId: 7 });
  assert.deepEqual(parsearClave(claveSocial('instagram', 40)), { tipo: 'instagram', convId: 40 });
  // Messenger es `fb:` (en la base la plataforma es 'facebook'; en el contrato el canal es 'messenger').
  assert.equal(claveSocial('messenger', 41), 'fb:41');
  assert.deepEqual(parsearClave('fb:41'), { tipo: 'messenger', convId: 41 });
  const k = claveWhatsapp('mako_ws13_k3x9qa', '+52 1 55 1234 5678', '5215512345678@s.whatsapp.net');
  assert.equal(k, 'wa:mako_ws13_k3x9qa:5512345678');
  assert.deepEqual(parsearClave(k), { tipo: 'whatsapp', linea: 'mako_ws13_k3x9qa', id: '5512345678' });
  // Sin número (un grupo, un @lid): el jid crudo, con su @ y sus puntos.
  const g = claveWhatsapp('mako_ws3', null, '120363025@g.us');
  assert.equal(g, 'wa:mako_ws3:120363025@g.us');
  assert.deepEqual(parsearClave(g), { tipo: 'whatsapp', linea: 'mako_ws3', id: '120363025@g.us' });

  for (const mala of ['', 'lead:', 'lead:0', 'lead:-3', 'lead:abc', 'lead:7x', 'ig:0', 'ig:', 'fb:1.5', 'wa:', 'wa:mako_ws3',
    'wa::5512345678', 'wa:mako ws3:5512345678', 'wa:mako_ws3:', 'wa:mako_ws3:55 12', 'x:1', 'LEAD:7', `lead:${'1'.repeat(16)}`,
    `wa:mako_ws3:${'1'.repeat(TOPE_CLAVE)}`]) {
    assert.equal(parsearClave(mala), null, `«${mala}» no es una clave`);
  }
  for (const noTexto of [null, undefined, 7, {}, ['lead:7']]) assert.equal(parsearClave(noTexto), null);
  assert.equal(claveCuenta('whatsapp', 'mako_ws3'), 'whatsapp:mako_ws3');
  assert.equal(claveCuenta('instagram', null), 'instagram:');
});

test('la clave de WhatsApp es la MISMA regla que `claveTel` del espejo (si no, la fila no encuentra su hilo)', () => {
  // `claveTel` vive en un módulo `server-only`: se lee su fuente y se corre su cuerpo (es JS sin tipos adentro).
  const fuente = leer('lib/evolution-mensajes.ts');
  const m = fuente.match(/export function claveTel\(tel: string \| null, jid: string\): string \{\n([\s\S]*?)\n\}/);
  assert.ok(m, 'no encontré `claveTel` en lib/evolution-mensajes.ts: si cambió de forma, actualiza este test');
  const claveTel = new Function('tel', 'jid', m![1]) as (tel: string | null, jid: string) => string;
  const casos: Array<[string | null, string]> = [
    ['5215512345678', 'x@s.whatsapp.net'], ['+52 55 1234 5678', 'x'], ['12345678', 'j'], ['1234567', 'j@lid'],
    [null, '120363025@g.us'], ['', 'j'], ['abc', 'j'], ['549 11 5555-4444', 'j'], ['123456789', 'j'],
  ];
  for (const [tel, jid] of casos) assert.equal(idWhatsapp(tel, jid), claveTel(tel, jid), `tel=${tel} jid=${jid}`);
});

// ── Agrupar por contacto ──────────────────────────────────────────────────────────

test('agrupar: las identidades de un lead van en UN contacto; sin lead, cada identidad es el suyo', () => {
  const fuentes = [
    wa('mako_ws3', '5215512345678', H('10:00'), { leadId: 7, total: 5 }),
    wa('mako_ws3_b', '5215512345678', H('11:00'), { leadId: 7, total: 3, entrante: false }),
    social('instagram', 40, H('09:00'), { leadId: 7 }),
    wa('mako_ws3', '5219998887777', H('08:00', '13'), { total: 2, nombre: 'Pepe' }),
    social('messenger', 41, H('07:00')),
    social('instagram', 42, H('06:00')),
  ];
  const lista = agruparPorContacto(fuentes, ctx({ leads: new Map([[7, LEAD7]]) }));
  assert.deepEqual(lista.map((c) => c.clave), ['lead:7', 'fb:41', 'ig:42', 'wa:mako_ws3:9998887777']);
  const ana = lista[0];
  assert.equal(ana.leadId, 7);
  assert.equal(ana.nombre, 'Ana Pérez', 'el nombre del lead gana al de la fuente');
  assert.equal(ana.empresa, 'Café Ana');
  assert.deepEqual(ana.canales.map((i) => `${i.canal}:${i.cuenta}`), ['whatsapp:mako_ws3_b', 'whatsapp:mako_ws3', 'instagram:acc1']);
  assert.equal(ana.canalUltimo, 'whatsapp');
  assert.equal(ana.ultimaFecha, H('11:00'));
  assert.equal(ana.ultimoEntrante, false, 'el último fue nuestro, por la otra línea');
  assert.equal(ana.asignado, 'Lucía');
  assert.equal(ana.etapaKey, 'agenda');
  assert.equal(ana.avatarTel, '5215512345678');
  // Lo último del contacto fue a las 10:00 por mako_ws3: sin marca de leído, está sin leer.
  assert.equal(ana.sinLeer, true);
  const pepe = lista.find((c) => c.clave.startsWith('wa:'))!;
  assert.equal(pepe.nombre, 'Pepe');
  assert.equal(pepe.asignado, null);
  assert.equal(pepe.etapaKey, null);
  // La misma identidad leída dos veces (dos lecturas que se pisan) no se duplica.
  const doble = agruparPorContacto([fuentes[3], { ...fuentes[3] }], ctx());
  assert.equal(doble.length, 1);
  assert.equal(doble[0].canales.length, 1);
});

test('agrupar: los placeholders sin historial no se multiplican por línea', () => {
  // Con historial por una línea, el placeholder de la otra (la lectura por línea lo agrega igual) sobra.
  const conHistoria = agruparPorContacto([
    wa('mako_ws3', '5215512345678', null, { leadId: 9 }),
    wa('mako_ws3_b', '5215512345678', H('10:00'), { leadId: 9, total: 4 }),
  ], ctx());
  assert.deepEqual(conHistoria[0].canales.map((i) => i.cuenta), ['mako_ws3_b']);
  // Sólo placeholders (un lead de Instagram con teléfono): queda UNO, el de la línea por default.
  const soloPlaceholders = agruparPorContacto([
    wa('mako_ws3_b', '5215512345678', null, { leadId: 9 }),
    wa('mako_ws3', '5215512345678', null, { leadId: 9 }),
    social('instagram', 50, H('10:00'), { leadId: 9 }),
  ], ctx({ lineaDefault: 'mako_ws3' }));
  assert.deepEqual(soloPlaceholders[0].canales.map((i) => `${i.canal}:${i.cuenta}`), ['instagram:acc1', 'whatsapp:mako_ws3']);
  // Un contacto que es SÓLO un placeholder (buscado en el CRM, sin mensajes) sigue existiendo.
  const solo = agruparPorContacto([wa('mako_ws3', '5215512345678', null, { leadId: 9 })], ctx());
  assert.equal(solo.length, 1);
  assert.equal(solo[0].ultimaFecha, null);
});

test('agrupar: estado, leídos, borradores y bloqueo se buscan por la clave del CONTACTO', () => {
  const fuentes = [
    wa('mako_ws3', '5215512345678', H('10:00'), { leadId: 7 }),
    social('instagram', 40, H('11:00'), { leadId: 7, entrante: false }),
    wa('mako_ws3', '5219998887777', H('09:00'), { bloqueado: true }),
  ];
  const r = agruparPorContacto(fuentes, ctx({
    leads: new Map([[7, LEAD7]]),
    // Cerrada a las 10:30: lo último DEL CONTACTO fue a las 10:00 (lo de las 11:00 fue nuestro) → sigue cerrada.
    estados: new Map([['lead:7', { estado: 'cerrada', cerrada_at: H('10:30'), pospuesta_hasta: null, pospuesta_at: null }]]),
    leidos: new Map([['lead:7', H('10:15')]]),
    borradores: { leadIds: new Set(), tels: new Set(['9998887777']) },
  }));
  const ana = r.find((c) => c.clave === 'lead:7')!;
  assert.equal(ana.estado, 'cerrada');
  assert.equal(ana.sinLeer, false, 'leyó a las 10:15 lo de las 10:00');
  assert.equal(ana.borrador, false);
  const otro = r.find((c) => c.clave === 'wa:mako_ws3:9998887777')!;
  assert.equal(otro.estado, 'abierta');
  assert.equal(otro.borrador, true, 'el borrador de MaKo se encuentra por los últimos 10 dígitos');
  assert.equal(otro.bloqueado, true);
  // Por lead también.
  const conBorrador = agruparPorContacto(fuentes.slice(0, 2), ctx({ borradores: { leadIds: new Set([7]), tels: new Set() } }));
  assert.equal(conBorrador[0].borrador, true);
});

// ── Estado efectivo y no leídos ───────────────────────────────────────────────────

test('estadoEfectivo: una cerrada se reabre con un entrante posterior; una pospuesta vence o se reanuda', () => {
  const cerrada = { estado: 'cerrada' as const, cerrada_at: H('10:00'), pospuesta_hasta: null, pospuesta_at: null };
  assert.deepEqual(estadoEfectivo(null, H('09:00'), AHORA), { estado: 'abierta', pospuestaHasta: null });
  assert.equal(estadoEfectivo(cerrada, H('09:00'), AHORA).estado, 'cerrada');
  assert.equal(estadoEfectivo(cerrada, null, AHORA).estado, 'cerrada');
  assert.equal(estadoEfectivo(cerrada, H('10:00'), AHORA).estado, 'cerrada', 'el mismo instante no reabre');
  assert.equal(estadoEfectivo(cerrada, H('10:01'), AHORA).estado, 'abierta', 'respond.io: «Conversation opened by Contact»');

  const pospuesta = { estado: 'abierta' as const, cerrada_at: null, pospuesta_hasta: H('18:00'), pospuesta_at: H('10:00') };
  assert.deepEqual(estadoEfectivo(pospuesta, H('09:00'), AHORA), { estado: 'pospuesta', pospuestaHasta: H('18:00') });
  assert.equal(estadoEfectivo(pospuesta, H('11:00'), AHORA).estado, 'abierta', 'escribió después de posponer');
  assert.equal(estadoEfectivo(pospuesta, H('09:00'), Date.parse(H('18:00'))).estado, 'abierta', 'venció');
  assert.equal(estadoEfectivo({ ...pospuesta, pospuesta_hasta: 'basura' }, null, AHORA).estado, 'abierta');
  assert.equal(estadoEfectivo({ estado: 'abierta', cerrada_at: null, pospuesta_hasta: null, pospuesta_at: null }, null, AHORA).estado, 'abierta');
});

test('sinLeer: hay algo DEL CONTACTO después de MI marca', () => {
  assert.equal(sinLeer(null, null), false, 'sin entrantes no hay nada que leer');
  assert.equal(sinLeer(H('10:00'), null), true, 'sin marca, lo del contacto está sin leer');
  assert.equal(sinLeer(H('10:00'), H('10:05')), false);
  assert.equal(sinLeer(H('10:10'), H('10:05')), true);
  assert.equal(sinLeer(H('10:00'), 'basura'), true);
});

// ── Filtros de la pantalla ────────────────────────────────────────────────────────

const YO = { nombre: 'Martín' };
const LISTA: ChatResumen[] = [
  chat({ clave: 'lead:1', leadId: 1, asignado: 'Martín', etapaKey: 'agenda', ultimaFecha: H('10:00'), sinLeer: true }),
  chat({ clave: 'lead:2', leadId: 2, closer: 'Martín', etapaKey: 'agenda', ultimaFecha: H('11:00'), ultimoEntrante: false }),
  chat({ clave: 'lead:3', leadId: 3, asignado: 'Lucía', etapaKey: 'cierre', ultimaFecha: H('09:00') }),
  chat({
    clave: 'ig:4', canalUltimo: 'instagram', estado: 'cerrada', ultimaFecha: H('08:00'),
    canales: [ident({ canal: 'instagram', cuenta: 'acc1', ref: '4' })],
  }),
  chat({ clave: 'lead:5', leadId: 5, asignado: 'MaKo', borrador: true, estado: 'pospuesta', pospuestaHasta: H('20:00'), ultimaFecha: H('07:00') }),
  chat({ clave: 'wa:mako_ws3:5511112222', bloqueado: true, ultimaFecha: H('12:00'), sinLeer: true }),
  chat({
    clave: 'fb:7', canalUltimo: 'messenger', ultimaFecha: null, sinLeer: true,
    canales: [ident({ canal: 'messenger', cuenta: 'pag1', ref: '7' })],
  }),
  chat({
    clave: 'lead:8', leadId: 8, asignado: 'Lucía', ultimaFecha: H('06:00'),
    canales: [
      ident({ canal: 'whatsapp', cuenta: 'mako_ws3', ref: 'a' }), ident({ canal: 'whatsapp', cuenta: 'mako_ws3', ref: 'b' }),
      ident({ canal: 'whatsapp', cuenta: 'mako_ws3_b', ref: 'c' }), ident({ canal: 'instagram', cuenta: 'acc1', ref: '9' }),
    ],
  }),
];
const claves = (cs: readonly ChatResumen[]) => cs.map((c) => c.clave);
const todas = (vista: VistaChats): FiltroChats => ({ ...FILTRO_INICIAL, vista, mostrar: 'todas' });

test('las bandejas: Míos (asignado o closer), Sin asignar (ni uno ni otro), MaKo, Borradores, Bloqueados', () => {
  assert.deepEqual(claves(filtrarChats(LISTA, todas('mios'), YO)), ['lead:2', 'lead:1']);
  assert.deepEqual(claves(filtrarChats(LISTA, todas('sin-asignar'), YO)), ['ig:4', 'fb:7']);
  assert.deepEqual(claves(filtrarChats(LISTA, todas('mako'), YO)), ['lead:5']);
  assert.deepEqual(claves(filtrarChats(LISTA, todas('borradores'), YO)), ['lead:5']);
  // Un bloqueado vive SÓLO en «Bloqueados» (respond.io: Blocked Contacts), aunque no tenga asignado.
  assert.deepEqual(claves(filtrarChats(LISTA, todas('bloqueados'), YO)), ['wa:mako_ws3:5511112222']);
  assert.ok(!claves(filtrarChats(LISTA, todas('todos'), YO)).includes('wa:mako_ws3:5511112222'));
  assert.equal(filtrarChats(LISTA, todas('todos'), YO).length, LISTA.length - 1);
  // Por NOMBRE, con espacios de más; y un yo sin nombre no es dueño de lo que no tiene asignado.
  assert.equal(esMio({ asignado: ' Martín ', closer: null }, YO), true);
  assert.equal(esMio({ asignado: null, closer: null }, { nombre: '' }), false);
  assert.equal(esMio({ asignado: '', closer: '' }, { nombre: '' }), false);
  assert.equal(estaSinAsignar({ asignado: '  ', closer: null }), true);
  assert.equal(estaSinAsignar({ asignado: null, closer: 'Martín' }), false, 'con closer no está «sin asignar» (el SIN_ASIGNAR del CRM)');
  assert.equal(atiendeMako({ asignado: 'MaKo' }), true);
  assert.equal(enVista(LISTA[0], 'todos', YO), true);
});

test('canal y cuenta, etapa, Mostrar, Sin responder y el buscador local', () => {
  assert.equal(enCanal(LISTA[7], 'instagram', null), true);
  assert.equal(enCanal(LISTA[7], 'whatsapp', 'mako_ws3_b'), true);
  assert.equal(enCanal(LISTA[7], 'whatsapp', 'otra'), false);
  assert.equal(enCanal(LISTA[7], 'messenger', null), false);
  assert.equal(enCanal(LISTA[7], null, 'cualquiera'), true, 'sin canal no se mira la cuenta');
  assert.deepEqual(claves(filtrarChats(LISTA, { ...todas('todos'), canal: 'instagram' }, YO)), ['ig:4', 'lead:8']);
  assert.deepEqual(claves(filtrarChats(LISTA, { ...todas('todos'), canal: 'messenger', cuenta: 'pag1' }, YO)), ['fb:7']);
  assert.deepEqual(claves(filtrarChats(LISTA, { ...todas('todos'), etapa: 'agenda' }, YO)), ['lead:2', 'lead:1']);
  assert.equal(enMostrar({ estado: 'pospuesta' }, 'abiertas'), false);
  assert.deepEqual(claves(filtrarChats(LISTA, { ...todas('todos'), mostrar: 'cerradas' }, YO)), ['ig:4']);
  assert.deepEqual(claves(filtrarChats(LISTA, { ...todas('todos'), mostrar: 'pospuestas' }, YO)), ['lead:5']);
  // Lo que se ve al entrar: «Abiertas, Más recientes».
  assert.equal(FILTRO_INICIAL.mostrar, 'abiertas');
  assert.equal(FILTRO_INICIAL.vista, 'todos');
  assert.ok(!claves(filtrarChats(LISTA, FILTRO_INICIAL, YO)).includes('ig:4'));
  // «Sin responder»: lo último lo escribió el contacto.
  assert.ok(!claves(filtrarChats(LISTA, { ...todas('todos'), sinResponder: true }, YO)).includes('lead:2'));
  assert.equal(coincideBusqueda(LISTA[0], '  '), true);
  assert.equal(coincideBusqueda({ nombre: 'Ana Pérez', empresa: 'Café', canales: [] }, 'café'), true);
  assert.equal(coincideBusqueda({ nombre: 'x', empresa: null, canales: [ident({ canal: 'instagram', ref: '1', destino: '@ana.cafe' })] }, '@ana'), true);
  assert.equal(coincideBusqueda({ nombre: 'x', empresa: null, canales: [ident({ canal: 'whatsapp', ref: '1', telefono: '5215512345678' })] }, '55 1234'), true);
  assert.equal(coincideBusqueda({ nombre: 'x', empresa: null, canales: [ident({ canal: 'whatsapp', ref: '1', telefono: '5215512345678' })] }, '55'), false, 'menos de 4 dígitos no busca teléfonos');
});

test('orden: Más recientes y Más antiguas; lo que no tiene fecha va SIEMPRE al final', () => {
  const r = claves(ordenarChats(LISTA, 'recientes'));
  const a = claves(ordenarChats(LISTA, 'antiguas'));
  assert.equal(r[0], 'wa:mako_ws3:5511112222');
  assert.equal(r[r.length - 1], 'fb:7');
  assert.equal(a[0], 'lead:8');
  assert.equal(a[a.length - 1], 'fb:7');
  assert.deepEqual(claves(LISTA), claves(LISTA.slice()), 'ordenar no toca la lista original');
});

// ── Contadores del panel ──────────────────────────────────────────────────────────

test('el contador del panel y la lista cuentan con la MISMA regla', () => {
  const k = contarBandejas(LISTA, YO);
  const vistas: Array<[VistaChats, keyof typeof k]> = [
    ['todos', 'todos'], ['mios', 'mios'], ['sin-asignar', 'sinAsignar'], ['mako', 'mako'], ['borradores', 'borradores'],
  ];
  for (const [vista, campo] of vistas) {
    const abiertas = filtrarChats(LISTA, { ...FILTRO_INICIAL, vista }, YO);
    const nuevos = filtrarChats(LISTA, todas(vista), YO).filter((c) => c.sinLeer);
    assert.deepEqual(k[campo], { abiertas: abiertas.length, nuevos: nuevos.length }, `bandeja ${vista}`);
  }
  assert.deepEqual(k.bloqueados, { abiertas: 1, nuevos: 0 }, 'en Bloqueados el número es el total');
  for (const canal of ['whatsapp', 'instagram', 'messenger'] as CanalChat[]) {
    assert.equal(k.porCanal[canal].abiertas, filtrarChats(LISTA, { ...FILTRO_INICIAL, canal }, YO).length, `canal ${canal}`);
  }
  for (const [canal, cuenta] of [['whatsapp', 'mako_ws3'], ['whatsapp', 'mako_ws3_b'], ['instagram', 'acc1'], ['messenger', 'pag1']] as Array<[CanalChat, string]>) {
    const n = filtrarChats(LISTA, { ...FILTRO_INICIAL, canal, cuenta }, YO).length;
    assert.equal(k.porCuenta[claveCuenta(canal, cuenta)]?.abiertas ?? 0, n, `cuenta ${canal}:${cuenta}`);
  }
  for (const etapa of ['agenda', 'cierre']) {
    assert.equal(k.porEtapa[etapa]?.abiertas ?? 0, filtrarChats(LISTA, { ...FILTRO_INICIAL, etapa }, YO).length, `etapa ${etapa}`);
  }
  // lead:8 tiene dos identidades por mako_ws3: suma UNA vez en esa línea.
  assert.equal(k.porCuenta['whatsapp:mako_ws3'].abiertas, 4);
});

// ── Los eventos del hilo ──────────────────────────────────────────────────────────

test('los eventos del hilo en partes, con las negritas marcadas', () => {
  const c = partesDeEvento('cerrada', 'Martín', { nota: ' Ya compró ' });
  assert.deepEqual(c, [{ t: 'Cerrada' }, { t: ' por ' }, { t: 'Martín', b: true }, { t: ': Ya compró' }]);
  assert.equal(textoDePartes(c), 'Cerrada por Martín: Ya compró');
  assert.equal(textoDePartes(partesDeEvento('pospuesta', 'Lucía', { hasta: H('18:00') }, () => 'mar 14/10, 15:00')), 'Pospuesta hasta mar 14/10, 15:00 por Lucía');
  assert.equal(textoDePartes(partesDeEvento('reabierta', null, null)), 'Reabierta');
  assert.equal(textoDePartes(partesDeEvento('reanudada', '  ', {})), 'Reanudada');
  assert.equal(textoDePartes(partesDeAudit('Etapa', 'agenda', 'Lucía', () => 'Agenda')!), 'Etapa cambiada a Agenda por Lucía');
  assert.equal(textoDePartes(partesDeAudit('Setter', '', 'Lucía')!), 'Asignación quitada por Lucía');
  assert.equal(textoDePartes(partesDeAudit('Setter', 'Martín', null)!), 'Asignada a Martín');
  assert.equal(partesDeAudit('Teléfono', '55', 'x'), null, 'lo demás del historial no entra al hilo');
  assert.equal(partesDeAudit('Etapa', '', 'x'), null);
  assert.ok(CAMPOS_AUDIT_DEL_HILO.includes('Nota'));
  assert.equal(autorLegible('lucia@negocio.com'), 'lucia');
  assert.equal(autorLegible('MaKo'), 'MaKo');
  assert.equal(autorLegible('  '), null);
});

test('formatos y estados de envío en el idioma del contrato', () => {
  assert.equal(formatoDe(null), 'text');
  assert.equal(formatoDe('image'), 'image');
  assert.equal(formatoDe('reaction'), 'otro');
  assert.equal(formatoDeAdjunto('photo'), 'image');
  assert.equal(formatoDeAdjunto('ig_reel'), 'video');
  assert.equal(formatoDeAdjunto('file'), 'document');
  assert.equal(formatoDeAdjunto(undefined), 'otro');
  assert.equal(statusDe('read'), 'read');
  assert.equal(statusDe('pending'), null);
});

// ── La base: migración 0284 y las listas de inquilino ─────────────────────────────

const TABLAS = ['chat_estado', 'chat_leidos', 'chat_eventos'] as const;

test('las tres tablas de Chats están en las DOS listas de inquilino', () => {
  for (const t of TABLAS) assert.ok((TABLAS_DE_INQUILINO as readonly string[]).includes(t), `${t} falta en TABLAS_DE_INQUILINO`);
  // TENANT_TABLES es un Set NO exportado de un módulo server-only: se lee el texto (molde: cobros-contrato).
  const m = leer('lib/workspace.ts').match(/const TENANT_TABLES = new Set<string>\(\[([\s\S]*?)\]\)/);
  assert.ok(m, 'no encontré TENANT_TABLES en lib/workspace.ts');
  const tenant = [...m![1].replace(/\/\/[^\n]*/g, '').matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]);
  for (const t of TABLAS) assert.ok(tenant.includes(t), `${t} falta en TENANT_TABLES: getTenantDb sería PASSTHROUGH`);
});

test('la migración 0284: workspace sin default, RLS con revoke, claves primarias y los tipos de evento del código', () => {
  const archivos = readdirSync(join(RAIZ, 'supabase/migrations')).filter((f) => f.startsWith('0284_'));
  assert.deepEqual(archivos, ['0284_chats.sql'], 'el número 0284 es de una sola migración');
  const sql = leer('supabase/migrations/0284_chats.sql').replace(/--.*$/gm, '').toLowerCase();
  const crear = (t: string) => {
    const r = sql.match(new RegExp(`create table if not exists ${t} \\(([\\s\\S]*?)\\n\\);`));
    assert.ok(r, `falta el create table idempotente de ${t}`);
    return r![1];
  };
  for (const t of TABLAS) {
    const cuerpo = crear(t);
    assert.match(cuerpo, /workspace_id\s+bigint not null references workspaces\(id\) on delete cascade/, `${t}.workspace_id`);
    assert.doesNotMatch(cuerpo, /workspace_id[^,\n]*default/, `${t}.workspace_id no lleva default: el 1 es un cliente`);
    assert.ok(sql.includes(`alter table ${t} enable row level security;`), `${t} sin RLS`);
    assert.ok(sql.includes(`revoke all on ${t} from anon, authenticated;`), `${t} sin revoke`);
  }
  assert.match(crear('chat_estado'), /primary key \(workspace_id, clave\)/);
  // Una pospuesta se guarda 'abierta' + pospuesta_hasta: el check NO tiene 'pospuesta'.
  assert.match(crear('chat_estado'), /check \(estado in \('abierta', 'cerrada'\)\)/);
  const leidos = crear('chat_leidos');
  assert.match(leidos, /usuario_id\s+bigint not null references usuarios\(id\)/, 'usuario_id es usuarios.id (bigint)');
  assert.match(leidos, /primary key \(workspace_id, usuario_id, clave\)/);
  // El check de `chat_eventos.tipo` y los tipos que escribe el código son la MISMA lista.
  const check = crear('chat_eventos').match(/check \(tipo in \(([^)]*)\)\)/);
  assert.ok(check, 'falta el check de chat_eventos.tipo');
  const enSql = [...check![1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(enSql, [...TIPOS_EVENTO_CHAT].sort());
});

// ── Los cableados: la puerta de las rutas y WhatsApp por línea ────────────────────

function archivosDe(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(RAIZ, rel)).isDirectory()) out.push(...archivosDe(rel));
    else if (n === 'route.ts') out.push(rel);
  }
  return out;
}

test('toda ruta de app/api/chats pasa PRIMERO por puertaChats (esconder la tab no protege)', () => {
  const rutas = archivosDe('app/api/chats');
  assert.ok(rutas.length >= 9, `faltan rutas del plano §2.2: ${rutas.map((r) => relative('app/api/chats', r)).join(', ')}`);
  for (const r of rutas) {
    const code = sinComentarios(leer(r));
    const handlers = [...code.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)].length;
    const conPuerta = [...code.matchAll(/export async function (?:GET|POST|PUT|PATCH|DELETE)\([^)]*\) \{\s*const puerta = await puertaChats\(\);\s*if \(!puerta\.ok\) return /g)].length;
    assert.ok(handlers > 0, `${r} no exporta ningún handler`);
    assert.equal(conPuerta, handlers, `${r}: cada handler abre con la puerta`);
  }
  const lib = sinComentarios(leer('lib/chats.ts'));
  assert.match(lib, /tabEnCapa\('chats', await getCapaActual\(\)\)/, 'la puerta mira la tab en la capa del negocio');
});

/** Los argumentos de primer nivel de cada llamada a `fn(` en el código. */
function argumentosDe(code: string, fn: string): string[][] {
  const out: string[][] = [];
  let i = code.indexOf(`${fn}(`);
  while (i >= 0) {
    let j = i + fn.length + 1;
    let prof = 1; let actual = ''; const args: string[] = [];
    for (; j < code.length && prof > 0; j++) {
      const ch = code[j];
      if (ch === '(' || ch === '[' || ch === '{') prof++;
      if (ch === ')' || ch === ']' || ch === '}') prof--;
      if (prof === 0) break;
      if (ch === ',' && prof === 1) { args.push(actual.trim()); actual = ''; } else actual += ch;
    }
    if (actual.trim()) args.push(actual.trim());
    out.push(args);
    i = code.indexOf(`${fn}(`, j);
  }
  return out;
}

test('lib/chats.ts lee WhatsApp SIEMPRE con la línea (sin ella se funden los hilos de dos números)', () => {
  const code = sinComentarios(leer('lib/chats.ts')).replace(/^import[\s\S]*?;$/gm, '');
  for (const fn of ['getConversacionesNoOficial', 'getMensajesDeChat']) {
    const llamadas = argumentosDe(code, fn);
    assert.ok(llamadas.length > 0, `lib/chats.ts ya no llama a ${fn}: actualiza este test`);
    for (const a of llamadas) assert.equal(a.length, 3, `${fn}(${a.join(', ')}) sin la línea`);
  }
});
