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
import { chatDeClave, chatsDelCentro, claveDeNombre, cuentasConCartero, historialDelChat, pasosDelChat, type CarteroP } from '../lib/centro-chats';
import { cadenas, type AreaP, type HitoP } from '../lib/progreso-reglas';

const AHORA = Date.parse('2026-10-15T16:00:00Z'); // 13:00 en Argentina
const S = (n: number) => `local_${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;
const hito = (hora: string, tipo: string, chat: string, extra: Partial<HitoP> = {}): HitoP =>
  ({ fecha: '15 oct', hora, chat, cuenta: 'claude1', actor: tipo === 'prompt' ? 'martin' : 'claude', tipo, titulo: `${tipo} ${hora}`, puntos: [], ...extra });
const chat = (n: number, titulo: string, vivo: boolean, estado: 'busy' | 'idle' | null = null) =>
  ({ local: S(n), titulo, cuenta: 'claude1', vivo, estado, actividad: '2026-10-15T15:00:00Z' });
const sinPedidos = { pedidos: [], trabajos: [], ahora: AHORA };

test('un chat es un NOMBRE: los «CRM» de las tres cuentas son uno, y se le escribe a la sesión abierta', () => {
  // Martín (15/10/2026): «todos los chats de todas las cuentas se llamen igual»; el Centro los une por nombre.
  // Probado rompiéndolo (15/10/2026): sin `unirPorNombre` → 2 fallos (éste y el del renombrado); eligiendo la sesión más reciente aunque
  // esté cerrada → 1 fallo (éste).
  const carteros: CarteroP[] = [
    { cuenta: 'claude1', vistoAt: '2026-10-15T15:59:00Z', chats: [{ ...chat(2, 'CRM', false), actividad: '2026-10-15T15:30:00Z' }] },
    { cuenta: 'claude3', vistoAt: '2026-10-15T15:59:00Z', chats: [{ ...chat(1, 'crm', true, 'busy'), cuenta: 'claude3' }] },
  ];
  const areas: AreaP[] = [{ slug: 'crm', titulo: 'CRM', bitacora: [
    hito('10:00', 'implementacion', 'CRM'), // sin sesión: se suma por el nombre
    hito('11:00', 'implementacion', 'CRM', { sesion: S(2) }),
  ] }];
  const cs = chatsDelCentro({ carteros, areas, ...sinPedidos });
  assert.equal(cs.length, 1, 'dos sesiones con el mismo nombre (sin mayúsculas) y lo anotado sin sesión: UN chat');
  const [crm] = cs;
  assert.equal(crm.sesion, S(1), 'se le escribe a la que trabaja, aunque la cerrada se haya movido más tarde');
  assert.equal(crm.cuenta, 'claude3');
  assert.equal(crm.estado, 'trabajando');
  assert.deepEqual(crm.sesiones.map((s) => [s.sesion, s.cuenta]), [[S(1), 'claude3'], [S(2), 'claude1']]);
  assert.deepEqual([...crm.miembros].sort(), [S(1), S(2), claveDeNombre('CRM')].sort());
  assert.equal(crm.porNombre, false);
  assert.equal(chatDeClave(cs, S(2))?.clave, crm.clave, 'un link viejo con la sesión abre el chat unido');
  assert.deepEqual(cuentasConCartero(carteros), ['claude1', 'claude3']);
});

test('un chat renombrado no se parte: lo que anotó con su sesión va al nombre que tiene HOY', () => {
  const carteros: CarteroP[] = [{ cuenta: 'claude3', vistoAt: '2026-10-15T15:59:00Z', chats: [{ ...chat(4, 'CRM › Lead Detail', true), cuenta: 'claude3' }] }];
  const areas: AreaP[] = [{ slug: 'crm', titulo: 'CRM', bitacora: [hito('11:00', 'implementacion', 'Ficha del lead', { sesion: S(4) })] }];
  const cs = chatsDelCentro({ carteros, areas, ...sinPedidos });
  assert.deepEqual(cs.map((c) => c.titulo), ['CRM › Lead Detail'], 'el hito con su sesión no deja un «Ficha del lead» aparte');
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
  const [landing, video, est] = [S(1), S(2), EST].map((k) => chatDeClave(cs, k)!);
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

// ── La caja de escribir (16/10/2026) ───────────────────────────────────────────────────────────
// Martín: «NO es funcional, no puedo mandar un prompt por allí a mis otras cuentas». Lo que se fija acá es lo que,
// roto, no da error: una caja que manda algo que la PC va a rechazar, o que dice «sale ya» sobre algo que espera.

test('la caja: sin sesión no hay a quién; sin clave, se crea; con la clave que la PC no acepta, no manda', async () => {
  // Probado rompiéndolo: aceptando la clave aunque ningún cartero la tenga, falla el tercer assert (y los
  // demás pasan); mirando sólo al cartero de LA cuenta del chat, falla el de «otro cartero la vio».
  const { comoSale } = await import('../lib/centro-chats');
  const chat = { sesion: S(1), cuenta: 'claude1', estado: 'abierto' as const };
  const fresco = '2026-10-15T15:59:00Z';
  assert.deepEqual(comoSale({ ...chat, sesion: null }, [], 'k1', AHORA), { puede: false, por: 'sin_direccion' });
  assert.deepEqual(comoSale(chat, [], undefined, AHORA), { puede: false, por: 'leyendo_clave' });
  assert.deepEqual(comoSale(chat, [], null, AHORA), { puede: false, por: 'sin_clave' });
  const sinLaClave = [{ cuenta: 'claude1', vistoAt: fresco, claves: ['otra'] }];
  assert.deepEqual(comoSale(chat, sinLaClave, 'k1', AHORA), { puede: false, por: 'clave_no_aceptada' }, 'la PC la va a rechazar');
  // Las claves son de la PC: alcanza con que un cartero la haya visto, aunque el de esta cuenta tenga la foto vieja.
  const otroLaVio = [{ cuenta: 'claude1', vistoAt: fresco, claves: [] }, { cuenta: 'claude3', vistoAt: fresco, claves: ['k1'] }];
  assert.equal(comoSale(chat, otroLaVio, 'k1', AHORA).puede, true, 'otro cartero la vio');
  // Sin ningún cartero que haya informado, no se sabe: sale, y espera al cartero.
  assert.deepEqual(comoSale(chat, [], 'k1', AHORA), { puede: true, espera: 'cartero', cuenta: 'claude1' });
});

test('la caja dice qué espera: el cartero quieto, el chat cerrado (con su cuenta), o nada si sale ya', async () => {
  // Probado rompiéndolo: sin mirar la edad del cartero, el primer assert da «sale ya» sobre un cartero de hace
  // tres horas (falla éste).
  const { comoSale, textoDeEnvio } = await import('../lib/centro-chats');
  const k = (vistoAt: string) => [{ cuenta: 'claude3', vistoAt, claves: ['k1'] }];
  const abierto = { sesion: S(1), cuenta: 'claude3', estado: 'abierto' as const };
  const quieto = comoSale(abierto, k('2026-10-15T13:00:00Z'), 'k1', AHORA);
  assert.deepEqual(quieto, { puede: true, espera: 'cartero', cuenta: 'claude3' });
  assert.equal(textoDeEnvio(quieto), 'Abre el chat Runner en la app de Claude para que salga.');
  const cerrado = comoSale({ ...abierto, estado: 'cerrado' }, k('2026-10-15T15:59:00Z'), 'k1', AHORA);
  assert.equal(textoDeEnvio(cerrado), 'Abre este chat en la cuenta 3 para que lo reciba.', 'dice la cuenta: puede ser otra que la abierta');
  const ya = comoSale(abierto, k('2026-10-15T15:59:00Z'), 'k1', AHORA);
  assert.deepEqual(ya, { puede: true, espera: null, cuenta: 'claude3' });
  assert.equal(textoDeEnvio(ya), null);
});

test('la lista se rehace en la pantalla con la MISMA función: base de las bitácoras + lo que sube el cartero', async () => {
  // Probado rompiéndolo: si completarChats no resetea el estado de la base, un chat que el cartero dejó de ver
  // sigue «trabajando» en el refresco (8 pasan y falla éste). ⚠️ La primera versión refrescaba con el cartero
  // viéndolo todavía, y así la rotura daba 9 en verde: el estado se pisaba igual.
  const { chatsDeBitacoras, completarChats } = await import('../lib/centro-chats');
  const area: AreaP = { slug: 'x', titulo: 'X', bitacora: [hito('10:00', 'implementacion', 'CRM', { sesion: S(1) })] };
  const carteros: CarteroP[] = [{ cuenta: 'claude1', vistoAt: '2026-10-15T15:59:00Z', chats: [chat(1, 'CRM renombrado', true, 'busy'), chat(2, 'Otro', true, 'idle')] }];
  const trabajos = [{ id: 't1', destino: S(3), destino_titulo: 'Plan', destino_cuenta: 'claude2', created_at: '2026-10-15T12:00:00Z' }];
  const deUna = chatsDelCentro({ carteros, areas: [area], pedidos: [], trabajos, ahora: AHORA });
  const enDos = completarChats(chatsDeBitacoras({ areas: [area], pedidos: [], ahora: AHORA }), { carteros, trabajos, ahora: AHORA });
  assert.deepEqual(enDos, deUna, 'el server y la pantalla arman la misma lista');
  assert.equal(chatDeClave(enDos, S(1))?.titulo, 'CRM renombrado', 'el título es el de la app (se puede renombrar)');
  // El refresco, con el cartero que ya no ve al chat 1 (se cerró la app de esa cuenta): no puede seguir «trabajando».
  const despues = completarChats(enDos, { carteros: [{ ...carteros[0], chats: [chat(2, 'Otro', true, 'idle')] }], trabajos: [], ahora: AHORA });
  assert.equal(chatDeClave(despues, S(1))?.estado, 'sin_dato');
});

test('el segundo renglón de la fila es lo ÚLTIMO que pasó: un trabajo con su tick, o el paso de un chat', async () => {
  // Probado rompiéndolo: quedándose con la PRIMERA línea en vez de la más nueva, falla el primer assert.
  const { vistaPrevia } = await import('../lib/centro-chats');
  const w = { id: 't1', destino: S(1), destino_titulo: 'CRM', destino_cuenta: 'claude1', created_at: '2026-10-15T15:00:00Z', texto: 'Arregla el filtro\ny lo demás', estado: 'entregado' as const };
  const p = vistaPrevia([
    { tipo: 'trabajo', instante: Date.parse('2026-10-15T12:00:00Z'), trabajo: { ...w, texto: 'Uno viejo', estado: 'hecho' } },
    { tipo: 'trabajo', instante: Date.parse(w.created_at), trabajo: w },
  ]);
  assert.deepEqual(p, { texto: 'Arregla el filtro', propio: true, tick: 'entregado', instante: Date.parse(w.created_at) }, 'el último, en un renglón');
  const conCierre = vistaPrevia([{ tipo: 'trabajo', instante: Date.parse(w.created_at), trabajo: { ...w, estado: 'hecho', cerrado_at: '2026-10-15T15:30:00Z', cierre: { decidido: '', hecho: 'Filtro arreglado', comprobado: '', sigue: '', prueba: null } } }]);
  assert.equal(conCierre?.texto, 'Filtro arreglado', 'el cierre es lo último: lo que contestó el chat');
  assert.equal(conCierre?.propio, false);
  assert.equal(vistaPrevia([]), null);
});

test('la barra: UNA lista sin cuentas, y lo que no tiene ninguna sesión aparte, al final', async () => {
  // Martín (15/10/2026): «No quiero que exista "cuenta 1, cuenta 2, 3" en la sidebar de chats».
  // Probado rompiéndolo (15/10/2026): dejando lo «por nombre» en la lista → 1 fallo.
  const { seccionesDeChats, chatsDeBitacoras, completarChats } = await import('../lib/centro-chats');
  const area: AreaP = { slug: 'x', titulo: 'X', bitacora: [hito('10:00', 'implementacion', 'CRM'), hito('10:30', 'implementacion', 'Viejo sin sesión')] };
  const carteros: CarteroP[] = [
    { cuenta: 'claude1', vistoAt: '2026-10-15T15:59:00Z', chats: [chat(1, 'CRM', false)] },
    { cuenta: 'claude3', vistoAt: '2026-10-15T15:59:00Z', chats: [{ ...chat(3, 'Graphics', true, 'idle'), cuenta: 'claude3' }] },
  ];
  const cs = completarChats(chatsDeBitacoras({ areas: [area], pedidos: [], ahora: AHORA }), { carteros, trabajos: [], ahora: AHORA });
  const secs = seccionesDeChats(cs);
  assert.deepEqual(secs.map((s) => s.titulo), [null, 'Antes del 16/10'], 'una lista sin título, y lo de antes aparte');
  assert.deepEqual(secs[0].chats.map((c) => c.titulo), ['Graphics', 'CRM'], 'el abierto primero; el «CRM» sin sesión se sumó al de la cuenta 1');
  assert.deepEqual(secs[1].chats.map((c) => c.titulo), ['Viejo sin sesión']);
});

test('el chat jefe: «CRM › Lead Detail» va adentro de «CRM», y un sub-chat sin jefe en la lista igual se agrupa', async () => {
  // Martín (15/10/2026): «quiero que cada chat esté englobado en su chat "jefe" que siempre se debe llamar como la tab».
  // Probado rompiéndolo (15/10/2026): partiendo sólo por «›» (sin «>») → 1 fallo; tomando el jefe del sub-chat como
  // un grupo aparte del jefe real → 1 fallo.
  const { porJefe, partesDelNombre, unirPorNombre } = await import('../lib/centro-chats');
  assert.deepEqual(partesDelNombre('CRM › Lead Detail'), { jefe: 'CRM', sub: 'Lead Detail' });
  assert.deepEqual(partesDelNombre('CRM > Funnels'), { jefe: 'CRM', sub: 'Funnels' });
  assert.deepEqual(partesDelNombre('Offer'), { jefe: 'Offer', sub: null });
  const c = (titulo: string) => ({ ...unirPorNombre([{ clave: titulo, sesion: null, porNombre: true, titulo, cuenta: null, estado: 'sin_dato' as const, vistoAt: null, viejo: false, actividad: null, pedidos: [], pidioAca: [], trabajos: [], miembros: [titulo], sesiones: [] }])[0] });
  const grupos = porJefe(['CRM › Lead Detail', 'Offer', 'crm', 'Graphics › Portadas', 'CRM > Funnels'].map(c));
  assert.deepEqual(grupos.map((g) => [g.jefe, g.chat?.titulo ?? null, g.subs.map((s) => s.titulo)]), [
    ['crm', 'crm', ['CRM › Lead Detail', 'CRM > Funnels']],
    ['Offer', 'Offer', []],
    ['Graphics', null, ['Graphics › Portadas']],
  ], 'el grupo va donde aparece el primero de los suyos');
});
