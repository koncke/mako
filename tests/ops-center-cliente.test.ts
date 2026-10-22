// =============================================================================
// El Ops Center del cliente es el del super admin (21/10/2026)
// =============================================================================
// Martín, con dos capturas lado a lado: «el ops center de los clientes se ve muy mal comparado al de SuperAdmin... Revisalo
// bien, eso debe funcionar». Lo que pidió y lo que fija este test:
//   1. «Los chats cortados a la mitad, sin la foto de perfil del dueño»: el hilo del cliente (HiloMako) va en la columna
//      flex del Ops Center (`.co-hilo__col`, la pone PanelChat.tsx) y sus filas son las del super admin (`FilaMia`, con la
//      foto; `FilaDelChat`). Medido en el ws1: el hilo iba suelto en `.co-hilo` (display: block) y lo de la persona quedaba
//      a la izquierda, con 760 px de ancho, cortado a la mitad.
//   2. «Jamás debes categorizar en desplegables los chats de la sidebar, como "offer" o "antes", y mucho menos "continuar en
//      offer"»: UNA lista (listaDelCliente), y una conversación de Offer o un chat de antes se SIGUE en el Ops Center.
//   4. «El chat principal, al igual que SuperAdmin, debe ser "Cerebro" y tener la criatura de MaKo».
//   5. «La barra de escribir... no está para nada igual»: la caja es la ÚNICA (CajaChat) adentro del MISMO panel.
//
// PROBADO ROMPIÉNDOLO (21/10/2026, base 7/0; cada rotura a mano y vuelta atrás):
//   · el jefe otra vez «Second Brain» → 6/1 (1) · la lista con los de Offer al final y no por actividad → 6/1 (1)
//   · `itemsDeOffer` sin la voz → 6/1 (2) · `respuestaDeOffer` mirando el primer mensaje de MaKo y no el último → 6/1 (2)
//   · el panel sin `.co-hilo__col` → 6/1 (3) · HiloMako con un `<div className="co-yo">` propio → 6/1 (3)
//   · la ruta corriendo el turno de un chat de antes con `persona` en vez de `quien` → 6/1 (5)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JEFE_SECOND_BRAIN, criaturaDeOffer, esFilaDe, listaDelCliente } from '../lib/chat-mako-reglas';
import { aspectoDe, ASPECTO_MAKO, esCriaturaDeMako } from '../lib/centro-munecos';
import { itemsDeOffer, respuestaDeOffer } from '../app/m/mako/chat-ui';
import type { OfferMensaje } from '../lib/offer-marco';

const leer = (r: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const sesion = (id: number, titulo: string | null, updatedAt: string) => ({ id, titulo, pinned: false, updatedAt });

test('1. el jefe es «Cerebro», con la estrella de MaKo, y la lista es UNA: lo más reciente arriba, sin secciones', () => {
  assert.equal(JEFE_SECOND_BRAIN, 'Cerebro');
  assert.ok(esCriaturaDeMako(JEFE_SECOND_BRAIN), 'el Cerebro es la estrella');
  assert.deepEqual(aspectoDe(JEFE_SECOND_BRAIN), ASPECTO_MAKO);
  const lista = listaDelCliente({
    // El más viejo (id 3) es el jefe, aunque se haya movido último.
    sesiones: [sesion(3, 'Primera', '2026-10-21T10:00:00Z'), sesion(8, 'Precios', '2026-10-20T10:00:00Z'), sesion(9, null, '2026-10-18T10:00:00Z')],
    offer: [{ id: 14, titulo: 'Mi oferta', updatedAt: '2026-10-21T09:00:00Z' }],
    antes: [{ id: 2, titulo: 'Fuga entre click y landing', updatedAt: '2026-06-21T10:00:00Z' }],
    busca: '',
  });
  assert.deepEqual(lista.map((f) => f.clave), ['jefe', 'o14', 's8', 's9', 'a2'], 'el Cerebro arriba y el resto por actividad, mezclados');
  assert.deepEqual(lista[0].elegido, { id: 3 });
  assert.equal(lista[0].titulo, 'Cerebro');
  assert.deepEqual(lista.map((f) => f.origen), ['mako', 'offer', 'mako', 'mako', 'antes'], 'cada uno sabe a qué motor va');
  assert.equal(lista[1].criatura, criaturaDeOffer('Mi oferta'), 'la de Offer lleva la criatura de Offer');
  assert.equal(lista[3].titulo, 'Chat nuevo');
  // Sin conversaciones: el Cerebro igual, virtual (se crea con el primer mensaje). La búsqueda no lo esconde.
  const vacia = listaDelCliente({ sesiones: [], offer: [], antes: [], busca: 'precio' });
  assert.deepEqual(vacia.map((f) => f.elegido), [{ virtual: 'jefe' }]);
  assert.deepEqual(listaDelCliente({ sesiones: [sesion(3, 'x', ''), sesion(8, 'Precios', '')], offer: [], antes: [], busca: 'PRECIO' }).map((f) => f.clave), ['jefe', 's8']);
  assert.ok(esFilaDe(lista[1], { offer: 14 }) && !esFilaDe(lista[1], { offer: 15 }) && !esFilaDe(lista[1], null));
  // En la pantalla: ni «Offer» ni «Antes» como secciones que se pliegan, ni «Seguir en Offer» o «Seguir en uno nuevo».
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.doesNotMatch(sb, /co-cuenta__cab|aria-expanded|SECCION_ANTES|AVISO_OFFER|AVISO_ANTES|Seguir en Offer|Seguir en uno nuevo/);
  assert.match(sb, /<FilaDeChat key=\{f\.clave\} titulo=\{f\.titulo\} criatura=\{f\.criatura\}/, 'la fila del super admin');
});

test('2. una conversación de Offer se dibuja con el MISMO hilo: la voz se escucha y las opciones se tocan', () => {
  const ms: OfferMensaje[] = [
    { id: 'a', de: 'mako', texto: '¿Qué vendes?', at: '2026-10-18T22:24:41Z', opciones: ['Un curso', 'Una mentoría'], varias: true },
    { id: 'b', de: 'yo', texto: 'Un curso de inglés', at: '2026-10-18T22:25:00Z', audio: { url: '/api/offer/audio?id=14&m=b', secs: 12 } },
    { id: 'c', de: 'mako', texto: '¿Cuántos clientes tienes por mes?', at: '2026-10-18T22:26:00Z', opciones: ['0', '1 a 5'], pregunta: { tipo: 'diagnostico', id: 'clientes' } },
  ];
  const items = itemsDeOffer(ms, (u) => `${u}&ws=21`);
  // Las opciones son sólo las del ÚLTIMO mensaje de MaKo, como en la tab: las de antes ya no se contestan.
  assert.deepEqual(items.map((x) => x.k), ['msg', 'msg', 'msg', 'bloque']);
  const voz = items[1];
  assert.ok(voz.k === 'msg' && voz.role === 'user' && voz.voz?.url === '/api/offer/audio?id=14&m=b&ws=21' && voz.voz.secs === 12, 'la nota de voz, con el ?ws=');
  assert.ok(voz.k === 'msg' && voz.texto === 'Un curso de inglés', 'la transcripción va de texto');
  const ultima = items[3];
  assert.ok(ultima.k === 'bloque' && ultima.respondida == null && ultima.b.t === 'pregunta' && ultima.b.rapida === true && !ultima.b.varias, 'la última, rápida, abierta y de una');
  const varias = itemsDeOffer(ms.slice(0, 1));
  assert.ok(varias[1]?.k === 'bloque' && varias[1].b.t === 'pregunta' && varias[1].b.varias === true, 'una de varias, si la pide');
  // La opción de una pregunta del diagnóstico manda su índice; una que no es del diagnóstico, sólo el texto.
  assert.deepEqual(respuestaDeOffer(ms, '1 a 5'), { preguntaId: 'clientes', idx: 1 });
  assert.equal(respuestaDeOffer(ms, 'otra cosa'), null);
  assert.equal(respuestaDeOffer(ms.slice(0, 2), 'Un curso'), null);
  // La pregunta rápida no lleva «Elige tú» ni «Saltear» (BloqueHilo.tsx).
  const b = sinComentarios(leer('app/_chat/BloqueHilo.tsx'));
  assert.match(b, /\{!b\.rapida && <button type="button" className="ch-enlace" disabled=\{quieta\} onClick=\{\(\) => responder\(ELIGE_TU_PREGUNTA\)\}>/);
});

test('3. el hilo del cliente va en la columna del Ops Center, con las filas del super admin (la foto incluida)', () => {
  const panel = sinComentarios(leer('app/admin/operaciones/PanelChat.tsx'));
  assert.match(panel, /<div className="co-hilo" ref=\{hilo\} data-recorrido="sb-hilo">\s*<div className="co-hilo__col">\{children\}<\/div>/);
  const hm = sinComentarios(leer('app/_chat/HiloMako.tsx'));
  assert.match(hm, /<FilaMia key=\{x\.id\} m=\{wa\(x\)\} marcas=\{marcas\}/, 'lo de la persona: la fila con su foto');
  assert.match(hm, /return <FilaDelChat m=\{m\} quien=\{\{ titulo: quien\.nombre, aspecto: quien\.aspecto \}\}/, 'lo de MaKo: la fila del chat');
  assert.doesNotMatch(hm, /className="co-yo"|className="co-el"/, 'sin filas propias');
  const hilo = sinComentarios(leer('app/admin/operaciones/Hilo.tsx'));
  assert.match(hilo, /export function FilaMia\([\s\S]*?<Deslizable m=\{m\} className="co-yo">\s*\{children\}\s*\{foto \?\? <MiFoto \/>\}/, 'la foto de quien escribe');
  // Las dos conversaciones montan el MISMO panel.
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/second-brain/ChatSecondBrain.tsx']) {
    const s = sinComentarios(leer(f));
    assert.match(s, /<PanelDeChat hilo=\{hilo\} adjuntos=\{/, f);
    assert.doesNotMatch(s, /<header className="co-cab">|className="co-hilo"/, `${f}: sin cabecera ni hilo propios`);
  }
});

test('4. la caja es la ÚNICA y lo escrito va al motor de cada chat', () => {
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.equal((sb.match(/<CajaChat /g) ?? []).length, 1, 'una caja');
  assert.match(sb, /if \(idOffer != null\) void mandarAOffer\(idU, t\); else void mandar\(idU, t, archivos\);/);
  assert.match(sb, /\{ action: 'send', sessionId: sid, mensaje, \.\.\.\(deAntes \? \{ antes: 1 \} : \{\}\) \}/, 'un chat de antes se sigue');
  assert.match(sb, /placeholder=\{`Escribe a \$\{nombre\}`\}/, 'a quién se le escribe, como en el super admin');
});

test('5. un chat de antes se sigue con la regla de quién lo ve, y el turno corre sobre ESA sesión', () => {
  const r = sinComentarios(leer('app/api/mako/chat/route.ts'));
  const f = r.slice(r.indexOf('async function personaDelChat('), r.indexOf('export async function GET'));
  assert.match(f, /const q = await quienChateaDelRequest\(\);\s*const chartKey = q \? await claveDeAntes\(q, sessionId\) : null;\s*return chartKey \? \{ \.\.\.persona, chartKey \} : null;/);
  const post = r.slice(r.indexOf('export async function POST'));
  assert.match(post, /const quien = await personaDelChat\(persona, sessionId, body\.antes\);\s*if \(!quien\) return json\(\{ ok: false, error: 'No encuentro ese chat\.' \}, 404\);/);
  assert.match(post, /await turnoApp\(quien, sessionId, \{ mensaje, contexto/, 'el turno, con la sesión de antes');
  assert.match(post, /await turnoApp\(quien, sessionId, \{ mensaje, adjuntos: v\.adjuntos/, 'con archivos también');
  assert.match(post, /confirmarDesdeTarjeta\(quien, sessionId, pendienteId\)/);
  assert.doesNotMatch(post, /turnoApp\(persona,/, 'ningún turno salta la regla');
});

// 21/10/2026, Martín: «no se puede dar click derecho como en SuperAdmin, muchas cosas faltan». Lo de WhatsApp de cada mensaje
// es el del super admin (MensajeWA.tsx): el menú, la cita en la caja y en el globo, y las marcas, guardadas por persona.
// PROBADO ROMPIÉNDOLO (base 7/0): el id de un mensaje con su lugar en el hilo (cambia al recargar) → 6/1 (6) · la ruta de las
// marcas sin sanear el cambio → 6/1 (6) · la caja sin la cita al mandar → 6/1 (6) · «Conectar tu Claude» aunque la persona tenga
// su computadora → 6/1 (7) · la caja sin `alFinal` → 6/1 (7).
test('6. el clic derecho, la cita y las marcas del super admin, en cada mensaje del chat con MaKo', async () => {
  const { idWA, mensajeWADe } = await import('../app/m/mako/chat-ui');
  const { esIdMensaje } = await import('../lib/centro-mensajes');
  const a = idWA({ id: 'm3-2026-10-18T04:19:00.000Z', role: 'assistant', at: '2026-10-18T04:19:00.000Z' });
  assert.equal(a, idWA({ id: 'm9-2026-10-18T04:19:00.000Z', role: 'assistant', at: '2026-10-18T04:19:00.000Z' }), 'recargar no le cambia el id');
  assert.notEqual(a, idWA({ id: 'x', role: 'user', at: '2026-10-18T04:19:00.000Z' }), 'lo de la persona y lo de MaKo a la misma hora');
  assert.ok(esIdMensaje(a) && esIdMensaje(idWA({ id: 'u-lnx2-a', role: 'user', at: null })), 'un id que la ruta acepta');
  const m = mensajeWADe({ k: 'msg', id: 'u1', role: 'user', texto: 'hola', at: '2026-10-18T04:19:00.000Z' }, 'Cerebro');
  assert.deepEqual([m.de, m.propio, m.texto], ['Tú', true, 'hola']);
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(sb, /<ContextoWA\.Provider value=\{accionesWA\}>/, 'el hilo con lo de WhatsApp');
  assert.match(sb, /<MenuMensajeWA abierto=\{menuWA\} marcas=\{marcas\} onCerrar=\{\(\) => setMenuWA\(null\)\} onElegir=\{elegirEnMenu\} sin=\{\['reenviar'\]\} \/>/);
  assert.match(sb, /const t = armarConCita\(cita, texto\.trim\(\)\);/, 'la cita sale con el mensaje');
  assert.match(sb, /\{cita && <CitaCaja cita=\{cita\} onQuitar=\{\(\) => setCita\(null\)\} \/>\}/, 'la cita arriba de la caja');
  const hm = sinComentarios(leer('app/_chat/HiloMako.tsx'));
  assert.match(hm, /if \(x\.k === 'msg' && marcas\?\.ocultos\.includes\(idWA\(x\)\)\) return;/, 'eliminar para mí');
  assert.match(hm, /<TextoPlegable texto=\{texto\} className="co-burbuja" pie=\{pie\} arriba=\{cita\} \/>/, 'la cita en el globo');
  // La ruta: las marcas de la persona de la sesión, saneadas, en su negocio.
  const r = sinComentarios(leer('app/api/mako/chat/route.ts'));
  assert.match(r, /if \(body\.action === 'marcar'\) \{\s*const cambio = sanearCambio\(body\.cambio\);\s*if \(!esChatDeMarcas\(body\.chat\) \|\| !cambio\)/);
  assert.match(r, /marcarEnElChat\(persona, body\.chat, cambio\)/);
  const db = sinComentarios(leer('lib/chat-mako-marcas-db.ts'));
  assert.match(db, /return runWithWorkspace\(p\.ws, async \(\) => \{\s*const nuevas = aplicarMarca\(parsear\(await getSettingEstricto\(clave\)\), cambio\);/, 'lee estricto antes de escribir, en su negocio');
  assert.match(db, /createHash\('sha256'\)\.update\(chartKey\)/, 'por persona, sin el email en la clave');
});

test('7. «Conectar tu Claude» al final de la caja, sólo si la persona todavía no conectó su IA, y se abre ahí mismo', () => {
  const r = sinComentarios(leer('app/api/mako/chat/route.ts'));
  const f = r.slice(r.indexOf('async function conSuIA('), r.indexOf('async function personaDelChat('));
  assert.match(f, /if \(persona\.ws === \(await wsSuperAdmin\(\)\)\) return true;/, 'el workspace de la plataforma contesta con la suya');
  assert.match(f, /if \(negocio\.suIA && !negocio\.conPc\) return true;/, 'la clave del negocio');
  assert.match(f, /return \(await pcDe\(persona\.ws, persona\.actor\)\) != null;/, 'o SU computadora');
  assert.match(f, /\} catch \{\s*return true;/, 'sin saberlo, no se le pide');
  const caja = sinComentarios(leer('app/_chat/CajaChat.tsx'));
  assert.ok(caja.indexOf('{p.alFinal}') > caja.indexOf('<textarea') && caja.indexOf('{p.alFinal}') < caja.indexOf('<BotonMandar'), 'al final, antes del botón');
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(sb, /alFinal=\{iaConectada === false && !ops \? \(\s*<button type="button" className="co-chip co-conectar-ia" onClick=\{\(\) => setConectando\(true\)\}>Conectar tu Claude<\/button>/);
  assert.match(sb, /<Modal titulo="Tus cuentas de IA" onCerrar=\{\(\) => \{ setConectando\(false\); mirarSuIA\(\); \}\} ancho=\{640\}>\s*<TusCuentasIA sinCabecera \/>/, 'sin salir de la tab');
});
