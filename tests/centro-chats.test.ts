// =============================================================================
// El Centro como app de chats — lo que, roto, no da error y muestra otra cosa
// =============================================================================
// Martín (15/10/2026) pidió el Centro como Grok: una lista de chats con su punto y lo de cada uno adentro.
// Lo que se fija acá (las mediciones, en docs/hallazgos-operaciones.md):
//
//   1. Un chat es una SESIÓN: dos chats con el mismo título no se juntan, y lo anotado sin sesión queda
//      aparte («por nombre»), nunca pegado a un chat del cartero.
//   2. El punto tiene edad: con el cartero quieto, el estado es una foto (`viejo`) y no ordena la lista.
//   3. Un pedido que pasó por dos chats está en los dos, cada uno con lo suyo; y el chat donde se pidió lo
//      sabe aunque lo haya trabajado otro.
//   4. Un trabajo firmado va a la sesión de destino aunque el cartero no la vea ahora.

import test from 'node:test';
import assert from 'node:assert/strict';
import { chatsDelCentro, claveDeNombre, cuentasConCartero, historialDelChat, pasosDelChat, type CarteroP } from '../lib/centro-chats';
import { cadenas, type AreaP, type HitoP } from '../lib/progreso-reglas';

const AHORA = Date.parse('2026-10-15T16:00:00Z'); // 13:00 en Argentina
const S = (n: number) => `local_${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;
const hito = (hora: string, tipo: string, chat: string, extra: Partial<HitoP> = {}): HitoP =>
  ({ fecha: '15 oct', hora, chat, cuenta: 'claude1', actor: tipo === 'prompt' ? 'martin' : 'claude', tipo, titulo: `${tipo} ${hora}`, puntos: [], ...extra });
const chat = (n: number, titulo: string, vivo: boolean, estado: 'busy' | 'idle' | null = null) =>
  ({ local: S(n), titulo, cuenta: 'claude1', vivo, estado, actividad: '2026-10-15T15:00:00Z' });
const sinPedidos = { pedidos: [], trabajos: [], ahora: AHORA };

test('un chat es una sesión: dos «CRM» son dos, y lo anotado sin sesión queda aparte', () => {
  // Probado rompiéndolo: juntando los chats del cartero por título, 3 pasan y falla éste.
  const carteros: CarteroP[] = [{ cuenta: 'claude1', vistoAt: '2026-10-15T15:59:00Z', chats: [chat(1, 'CRM', true, 'busy'), chat(2, 'CRM', false)] }];
  const areas: AreaP[] = [{ slug: 'crm', titulo: 'CRM', bitacora: [
    hito('10:00', 'implementacion', 'CRM'), // sin sesión: NO es ninguno de los dos
    hito('11:00', 'implementacion', 'CRM', { sesion: S(2) }), // con sesión: es el 2
  ] }];
  const cs = chatsDelCentro({ carteros, areas, ...sinPedidos });
  assert.equal(cs.length, 3, 'dos sesiones con el mismo título y un chat «por nombre»');
  const porNombre = cs.find((c) => c.clave === claveDeNombre('CRM'));
  assert.ok(porNombre?.porNombre && porNombre.sesion === null && porNombre.estado === 'sin_dato');
  assert.equal(cs.find((c) => c.clave === S(2))?.actividad, Date.parse('2026-10-15T15:00:00Z'), 'el hito de las 11 (14 UTC) no le gana a lo que ve la app');
  assert.equal(cs.find((c) => c.clave === S(1))?.estado, 'trabajando');
  assert.deepEqual(cuentasConCartero(carteros), ['claude1']);
});

test('el punto tiene edad: con el cartero quieto el estado es una foto y no ordena la lista', () => {
  // Probado rompiéndolo: ordenando por estado aunque el dato sea viejo, el ocupado de hace 3 h queda primero
  // (3 pasan y falla éste).
  const fresco: CarteroP[] = [{ cuenta: 'claude1', vistoAt: '2026-10-15T15:58:00Z', chats: [chat(1, 'Viejo ocupado', true, 'busy'), chat(2, 'Libre', true, 'idle')] }];
  const quieto: CarteroP[] = [{ cuenta: 'claude1', vistoAt: '2026-10-15T13:00:00Z', chats: [
    { ...chat(1, 'Viejo ocupado', true, 'busy'), actividad: '2026-10-15T12:00:00Z' },
    { ...chat(2, 'Libre', true, 'idle'), actividad: '2026-10-15T12:59:00Z' },
  ] }];
  const f = chatsDelCentro({ carteros: fresco, areas: [], ...sinPedidos });
  assert.equal(f[0].titulo, 'Viejo ocupado', 'con el dato fresco, el que trabaja va primero');
  assert.equal(f[0].viejo, false);
  const q = chatsDelCentro({ carteros: quieto, areas: [], ...sinPedidos });
  assert.ok(q.every((c) => c.viejo), 'tres horas sin vuelta: foto vieja');
  assert.equal(q[0].titulo, 'Libre', 'con la foto vieja ordena la actividad, no un «trabajando» de hace tres horas');
  assert.equal(q[0].vistoAt, Date.parse('2026-10-15T13:00:00Z'));
});

test('un pedido repartido está en cada chat con lo suyo, y el chat donde se pidió lo sabe', () => {
  const EST = S(9);
  const area: AreaP = { slug: 'x', titulo: 'X', bitacora: [
    hito('09:00', 'prompt', 'Estrategia', { sesion: EST, pedido: 'Hacelo en los dos' }),
    hito('10:00', 'implementacion', 'Landing', { sesion: S(1) }),
    hito('11:00', 'implementacion', 'Video', { sesion: S(2) }),
  ] };
  const pedidos = cadenas(area, AHORA);
  const cs = chatsDelCentro({ carteros: [], areas: [area], pedidos, trabajos: [], ahora: AHORA });
  const [landing, video, est] = [S(1), S(2), EST].map((k) => cs.find((c) => c.clave === k)!);
  assert.deepEqual([landing.pedidos, video.pedidos], [[pedidos[0].id], [pedidos[0].id]]);
  assert.deepEqual(pasosDelChat(pedidos[0], S(1)).map((s) => s.chat), ['Landing'], 'cada uno ve sólo sus pasos');
  assert.deepEqual(est.pidioAca, [pedidos[0].id], 'Estrategia lo pidió y lo trabajaron otros');
  assert.equal(est.estado, 'sin_dato', 'ningún cartero vio estas sesiones: sin estado, que no es «cerrado»');
  // La conversación de cada uno: en Landing, el pedido con SU paso y de dónde vino; en Estrategia, a quién fue.
  const porId = new Map(pedidos.map((p) => [p.id, p]));
  const [l] = historialDelChat(landing, porId, []);
  assert.ok(l.tipo === 'pedido' && l.desde === 'Estrategia' && l.pasos.length === 1);
  const [e] = historialDelChat(est, porId, []);
  assert.ok(e.tipo === 'derivado' && e.trabajaron.join() === 'Landing,Video');
});

test('un trabajo firmado va a su sesión aunque el cartero no la vea, y lo quieto de hace semanas no entra', () => {
  const area: AreaP = { slug: 'x', titulo: 'X', bitacora: [{ ...hito('10:00', 'implementacion', 'Hace un mes'), fecha: '10 sep' }] };
  const cs = chatsDelCentro({
    carteros: [], areas: [area], pedidos: [], ahora: AHORA,
    trabajos: [{ id: 't1', destino: S(5), destino_titulo: 'Plan - Perro Guardián', destino_cuenta: 'claude1', created_at: '2026-10-15T12:00:00Z' }],
  });
  assert.deepEqual(cs.map((c) => [c.titulo, c.trabajos]), [['Plan - Perro Guardián', ['t1']]]);
});

test('la lista se agrupa como una app de chat: trabajando ahora arriba (sólo con dato fresco), después por día', async () => {
  // Probado rompiéndolo: tomando «trabajando» aunque el dato sea viejo, falla éste.
  const { grupoDeChat } = await import('../lib/centro-chats');
  const t = (iso: string) => Date.parse(iso);
  const g = (estado: 'trabajando' | 'abierto', viejo: boolean, actividad: string | null) =>
    grupoDeChat({ estado, viejo, actividad: actividad ? t(actividad) : null }, AHORA);
  assert.equal(g('trabajando', false, '2026-10-15T15:00:00Z'), 'ahora');
  assert.equal(g('trabajando', true, '2026-10-15T15:00:00Z'), 'hoy', 'una foto vieja no es «ahora»');
  assert.equal(g('abierto', false, '2026-10-14T20:00:00Z'), 'ayer');
  assert.equal(g('abierto', false, '2026-10-10T20:00:00Z'), 'semana');
  assert.equal(g('abierto', false, '2026-09-30T20:00:00Z'), 'antes');
  assert.equal(g('abierto', false, null), 'antes');
});
