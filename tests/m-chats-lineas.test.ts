// =============================================================================
// Chats en el teléfono: un renglón por NÚMERO de WhatsApp en el filtro, como el chip «Canales» de escritorio (18/11/2026)
// =============================================================================
// O48 de docs/pendientes-verificados-17-11.md. Martín (24/10/2026): «que simplemente pueda cambiar entre mi número y el de
// MaKo». La computadora lo hizo ese día (app/chats/FiltrosChats.tsx: una opción por línea, que fija `canal` Y `cuenta`); el
// teléfono armaba su propia lista con un renglón por CANAL (app/m/chats/ListaChats.tsx, siempre `cuenta: null`), así que
// su número y el de MaKo eran el mismo «WhatsApp». Desde acá los dos arman sus renglones con la MISMA función,
// `opcionesDeCanal` (lib/chats-reglas.ts). Esto fija:
//   1. la lista: cada línea con su rótulo y su cuenta, el Instagram por cuenta, el canal entero sin cuenta leída, el Email;
//   2. elegir el renglón de MaKo deja sólo las conversaciones de esa línea (con `filtrarChats`, la regla de escritorio);
//   3. lo que dice el renglón y el botón del filtro (el rótulo de la línea elegida, «Desconectado», «2 sin leer»);
//   4. el cableado: los dos lados llaman a la función y el teléfono la recibe ya armada del server.
//
// PROBADO ROMPIÉNDOLO (18/11/2026, base 4/0), de a una y restaurado:
//   · `opcionesDeCanal` con `cuenta: null` en las líneas (lo del teléfono de antes)  → 1 / 3 (1, 2 y 3: las dos líneas se funden)
//   · `rotuloFiltro` sin el rótulo del renglón (vuelve a «WhatsApp · …»)              → 3 / 1 (3)
//   · app/m/chats/datos.ts de vuelta a `canalesPresentes`                            → 3 / 1 (4)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contarBandejas, filtrarChats, FILTRO_INICIAL, LINEA_CANAL_MAKO, opcionesDeCanal, type FiltroChats } from '../lib/chats-reglas';
import type { CanalChat, ChatResumen, CuentaSocial, IdentidadCanal, LineaChat } from '../lib/chats-tipos';
import { opcionElegida, rotuloFiltro, segundaDeCanal } from '../app/m/chats/modelo';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const identidad = (canal: CanalChat, cuenta: string | null, ref: string): IdentidadCanal => ({
  canal, cuenta, rotulo: canal, destino: null, ref, telefono: null, ultimaFecha: '2026-11-18T10:00:00Z',
  puedeEscribir: true, motivoNoEscribir: null, bloqueado: false,
});
const chat = (clave: string, canales: IdentidadCanal[], extra: Partial<ChatResumen> = {}): ChatResumen => ({
  clave, leadId: null, nombre: clave, empresa: null, avatarTel: null, canales, canalUltimo: canales[0].canal,
  ultimoTexto: 'Hola', ultimoTipo: null, ultimaFecha: '2026-11-18T10:00:00Z', ultimoEntrante: true,
  etapaKey: null, etapaLabel: null, asignado: null, closer: null, estado: 'abierta', pospuestaHasta: null,
  sinLeer: false, borrador: false, bloqueado: false, ...extra,
});

// El super admin: su número (una línea del negocio de la plataforma) y el de MaKo (`lib/chats.ts` lo suma como una línea más).
const LINEAS: LineaChat[] = [
  { linea: 'mako_ws9', rotulo: 'Tu número', estado: 'conectado', esDefault: true },
  { linea: LINEA_CANAL_MAKO, rotulo: 'MaKo', estado: 'conectado', esDefault: false },
];
const SOCIALES: CuentaSocial[] = [{ canal: 'instagram', cuenta: 'zr-1', rotulo: '@marca' }];
const CHATS: ChatResumen[] = [
  chat('wa:mako_ws9:1', [identidad('whatsapp', 'mako_ws9', 'a@s.whatsapp.net')], { sinLeer: true }),
  chat('wa:canal_mako:g1', [identidad('whatsapp', LINEA_CANAL_MAKO, 'g1@g.us')], { sinLeer: true }),
  chat('wa:canal_mako:g2', [identidad('whatsapp', LINEA_CANAL_MAKO, 'g2@g.us')], { sinLeer: true }),
  chat('ig:5', [identidad('instagram', 'zr-1', '5')]),
  chat('em:x@ejemplo.com', [identidad('email', null, 'x@ejemplo.com')]),
];

test('1. un renglón por número de WhatsApp (con su cuenta), el Instagram por cuenta y el Email', () => {
  const ops = opcionesDeCanal(LINEAS, SOCIALES, CHATS);
  assert.deepEqual(ops.map((o) => [o.canal, o.cuenta, o.label]), [
    ['whatsapp', 'mako_ws9', 'WhatsApp (Tu número)'],
    ['whatsapp', LINEA_CANAL_MAKO, 'WhatsApp (MaKo)'],
    ['instagram', 'zr-1', 'Instagram'],
    ['email', null, 'Email'],
  ]);
  // Una sola línea se llama «WhatsApp», sin el nombre (lo de escritorio, `rotuloWhatsapp`).
  assert.deepEqual(opcionesDeCanal([LINEAS[0]], [], []).map((o) => o.label), ['WhatsApp']);
  // Hay conversaciones de Messenger y su cuenta no se pudo leer: el canal entero, sin cuenta.
  const fb = opcionesDeCanal([], [], [chat('fb:1', [identidad('messenger', 'zr-9', '1')])]);
  assert.deepEqual(fb.map((o) => [o.canal, o.cuenta]), [['messenger', null]]);
  // Sin conversaciones de email, no hay renglón de Email (no se ofrece un filtro que no deja nada).
  assert.equal(opcionesDeCanal(LINEAS, [], CHATS.slice(0, 3)).some((o) => o.canal === 'email'), false);
});

test('2. elegir el renglón de MaKo deja sólo sus conversaciones (la regla de escritorio, filtrarChats)', () => {
  const ops = opcionesDeCanal(LINEAS, SOCIALES, CHATS);
  const mako = ops.find((o) => o.cuenta === LINEA_CANAL_MAKO);
  assert.ok(mako, 'el número de MaKo tiene su renglón');
  const filtro: FiltroChats = { ...FILTRO_INICIAL, canal: mako.canal, cuenta: mako.cuenta };
  assert.deepEqual(filtrarChats(CHATS, filtro, { nombre: 'Martín' }).map((c) => c.clave).sort(), ['wa:canal_mako:g1', 'wa:canal_mako:g2']);
  const suyo: FiltroChats = { ...FILTRO_INICIAL, canal: 'whatsapp', cuenta: 'mako_ws9' };
  assert.deepEqual(filtrarChats(CHATS, suyo, { nombre: 'Martín' }).map((c) => c.clave), ['wa:mako_ws9:1']);
});

test('3. lo que dice el renglón y el botón del filtro', () => {
  const ops = opcionesDeCanal(LINEAS, SOCIALES, CHATS);
  const conteos = contarBandejas(CHATS, { nombre: 'Martín' });
  const mako = ops[1];
  assert.equal(segundaDeCanal(mako, conteos), '2 sin leer', 'los no leídos de ESA línea, no los de todo WhatsApp');
  assert.equal(segundaDeCanal(ops[0], conteos), '1 sin leer');
  assert.equal(segundaDeCanal(ops[2], conteos), undefined, 'sin nada que mirar, el renglón no dice nada');
  assert.equal(segundaDeCanal({ ...ops[0], desconectado: true }, conteos), 'Desconectado');
  const filtro: FiltroChats = { ...FILTRO_INICIAL, canal: 'whatsapp', cuenta: LINEA_CANAL_MAKO };
  assert.equal(opcionElegida(ops, filtro)?.label, 'WhatsApp (MaKo)');
  assert.equal(rotuloFiltro(filtro, opcionElegida(ops, filtro)?.label), 'WhatsApp (MaKo) · Abiertas, Más recientes');
  assert.equal(opcionElegida(ops, FILTRO_INICIAL), null, '«Todos» no tiene renglón elegido');
  assert.equal(rotuloFiltro(FILTRO_INICIAL, null), 'Abiertas, Más recientes');
});

test('4. el cableado: escritorio y teléfono arman los renglones con la MISMA función', () => {
  assert.match(sinComentarios(leer('app/chats/FiltrosChats.tsx')), /opcionesDeCanal\(lineas, cuentasSociales, chats\)/, 'el chip «Canales» de escritorio');
  const datos = sinComentarios(leer('app/m/chats/datos.ts'));
  assert.match(datos, /canales: opcionesDeCanal\(lista\.lineas, lista\.cuentasSociales, lista\.chats\)/, 'el server del teléfono arma los renglones con TODAS las conversaciones leídas');
  const lista = sinComentarios(leer('app/m/chats/ListaChats.tsx'));
  assert.match(lista, /onClick=\{\(\) => poner\(\{ canal: o\.canal, cuenta: o\.cuenta \}\)\}/, 'tocar un renglón fija el canal Y la cuenta');
  assert.doesNotMatch(lista, /CANALES_M/, 'la lista de canales sueltos del teléfono no vuelve');
});
