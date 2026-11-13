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
import { itemsDeOffer, itemsDeSesion, opcionesDeOffer, respuestaDeOffer } from '../app/m/mako/chat-ui';
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
  // Se lee «Ops Center» desde el 1/11/2026 (Martín: «ya no se llama cerebro»); la estrella sigue saliendo de `JEFE_SECOND_BRAIN`.
  assert.equal(lista[0].titulo, 'Ops Center');
  assert.equal(lista[0].criatura, JEFE_SECOND_BRAIN);
  assert.deepEqual(lista.map((f) => f.origen), ['mako', 'offer', 'mako', 'mako', 'antes'], 'cada uno sabe a qué motor va');
  assert.equal(lista[1].criatura, criaturaDeOffer('Mi oferta'), 'la de Offer lleva la criatura de Offer');
  assert.equal(lista[3].titulo, 'Chat nuevo');
  // Sin conversaciones: el Cerebro igual, virtual (se crea con el primer mensaje). La búsqueda no lo esconde.
  const vacia = listaDelCliente({ sesiones: [], offer: [], antes: [], busca: 'precio' });
  assert.deepEqual(vacia.map((f) => f.elegido), [{ virtual: 'jefe' }]);
  assert.deepEqual(listaDelCliente({ sesiones: [sesion(3, 'x', ''), sesion(8, 'Precios', '')], offer: [], antes: [], busca: 'PRECIO' }).map((f) => f.clave), ['jefe', 's8']);
  assert.ok(esFilaDe(lista[1], { offer: 14 }) && !esFilaDe(lista[1], { offer: 15 }) && !esFilaDe(lista[1], null));
  // En la pantalla: ni «Offer» ni «Antes» como secciones que se pliegan, ni «Seguir en Offer» o «Seguir en uno nuevo».
  // En las dos pantallas (la computadora y el teléfono, 22/10/2026), con el MISMO motor (useChatCliente.ts).
  for (const f of ['app/second-brain/ChatSecondBrain.tsx', 'app/m/second-brain/ChatClienteM.tsx', 'app/second-brain/useChatCliente.ts']) {
    assert.doesNotMatch(sinComentarios(leer(f)), /co-cuenta__cab|aria-expanded|SECCION_ANTES|AVISO_OFFER|AVISO_ANTES|Seguir en Offer|Seguir en uno nuevo|\/offer\?sesion=|\/m\/offer\?sesion=/, f);
  }
  assert.match(sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx')), /<FilaDeChat key=\{f\.clave\} titulo=\{f\.titulo\} criatura=\{f\.criatura\}/, 'la fila del super admin');
  assert.match(sinComentarios(leer('app/m/second-brain/ChatClienteM.tsx')), /<Muneco titulo=\{f\.criatura\} aspecto=\{f\.aspecto\}/, 'en el teléfono, cada fila con su criatura');
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
  // Lo que se DIBUJA es la proyección (hiloDeOffer: con el arranque del onboarding y sus notas de voz, chat Onboarding 22/10), y
  // sus opciones vigentes se suman al final; la nota de voz de la proyección también se escucha, con el ?ws= de quien mira.
  const proy = itemsDeSesion([
    { role: 'user', content: 'Vendo un curso', created_at: '2026-10-18T22:25:00Z', audio: { url: '/api/offer/audio?id=14&m=b', secs: 9 } },
  ], [], [], (u) => `${u}&ws=21`);
  assert.ok(proy[0].k === 'msg' && proy[0].voz?.url === '/api/offer/audio?id=14&m=b&ws=21' && proy[0].texto === 'Vendo un curso', 'la voz de la proyección');
  assert.equal(opcionesDeOffer(ms)?.k, 'bloque', 'las vigentes');
  assert.equal(opcionesDeOffer(ms.slice(0, 2)), null, 'el último es de la persona: ninguna');
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(motor, /const l = await pedir<\{ mensajes: MensajeChat\[\] \}>\(`\$\{RUTA\}\?offerId=\$\{s\.id\}`\);/, 'se dibuja la proyección');
  assert.match(motor, /setItems\(\[\.\.\.itemsDeSesion\(l\.datos\.mensajes \?\? \[\], \[\], \[\], conWsDeAudio\), \.\.\.\(op \? \[op\] : \[\]\)\]\);/);
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
  const piezas = sinComentarios(leer('app/second-brain/PiezasCliente.tsx'));
  assert.equal((piezas.match(/<CajaChat /g) ?? []).length, 1, 'una caja');
  assert.match(piezas, /placeholder=\{`Escribe a \$\{k\.nombre\}`\}/, 'a quién se le escribe, como en el super admin');
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(motor, /if \(idOffer != null\) void mandarAOffer\(idU, t, archivos\); else void mandar\(idU, t, archivos\);/);
  assert.match(motor, /\{ action: 'send', sessionId: sid, mensaje, \.\.\.\(deAntes \? \{ antes: 1 \} : \{\}\)(?:, \.\.\.\(desdeTab \? \{ desde: desdeTab \} : \{\}\))?(?:, \.\.\.\(ia \? \{ ia \} : \{\}\))? \}/, 'un chat de antes se sigue (y con qué IA, 8b: tests/ops-center-ia-del-chat.test.ts)');
  // La computadora y el teléfono montan la MISMA caja y el MISMO hilo (el teléfono, la caja del suyo: `movil`).
  assert.match(sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx')), /<CajaDelCliente k=\{k\} campo=\{caja\} seguir=\{seguirHilo\} \/>/);
  assert.match(sinComentarios(leer('app/m/second-brain/ChatClienteM.tsx')), /<CajaDelCliente k=\{k\} campo=\{caja\} seguir=\{seguirHoja\} movil avisosArriba \/>/);
  for (const f of ['app/second-brain/ChatSecondBrain.tsx', 'app/m/second-brain/ChatClienteM.tsx']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /<HiloDelCliente k=\{k\}(?: apertura=\{apertura\})? \/>/, `${f}: el hilo (con lo que MaKo dice primero, 29/10/2026)`);
    assert.match(src, /useChatCliente\(\{ elegido, setElegido, /, `${f}: el motor`);
    assert.doesNotMatch(src, /<CajaChat |<HiloMako |fetch\(/, `${f}: sin caja, hilo ni pedidos propios`);
  }
});

test('5. un chat de antes se sigue con la regla de quién lo ve, y el turno corre sobre ESA sesión', () => {
  const r = sinComentarios(leer('app/api/mako/chat/route.ts'));
  const f = r.slice(r.indexOf('async function personaDelChat('), r.indexOf('export async function GET'));
  // Y si no es de antes, uno de una tab de ESTA persona (OC4, 22/10/2026: tests/ops-center-origen.test.ts).
  assert.match(f, /const q = await quienChateaDelRequest\(\);\s*const chartKey = \(q \? await claveDeAntes\(q, sessionId\) : null\) \?\? await claveDeTab\(persona, sessionId\);\s*return chartKey \? \{ \.\.\.persona, chartKey \} : null;/);
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
  const piezas = sinComentarios(leer('app/second-brain/PiezasCliente.tsx'));
  // El grupo de WhatsApp de MaKo, sin el menú (OC3, 22/10/2026: se lee, no se responde; tests/ops-center-grupo-mako.test.ts).
  assert.match(piezas, /<ContextoWA\.Provider value=\{k\.esAutomatizacion(?: \|\| k\.esEditor)? \? null : k\.accionesWA\}>/, 'el hilo con lo de WhatsApp');
  assert.match(piezas, /\{k\.cita && <CitaCaja cita=\{k\.cita\} onQuitar=\{\(\) => k\.setCita\(null\)\} \/>\}/, 'la cita arriba de la caja');
  for (const f of ['app/second-brain/ChatSecondBrain.tsx', 'app/m/second-brain/ChatClienteM.tsx']) {
    assert.match(sinComentarios(leer(f)), /<MenuMensajeWA abierto=\{k\.menuWA\} marcas=\{k\.marcas\} onCerrar=\{\(\) => k\.setMenuWA\(null\)\} onElegir=\{k\.elegirEnMenu\} sin=\{\['reenviar'\]\}(?: reportable=\{esRespuestaDeMaKo\})? \/>/, f);
  }
  assert.match(sinComentarios(leer('app/second-brain/useChatCliente.ts')), /const t = armarConCita\(cita, texto\.trim\(\)\);/, 'la cita sale con el mensaje');
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
  // En la caja ancha, al final; en la angosta, arriba del campo (tests/ops-center-caja-angosta.test.ts).
  assert.match(sinComentarios(leer('app/second-brain/PiezasCliente.tsx')), /const conectar = k\.iaConectada === false && !avisosArriba\n\s*\? <button type="button" className="co-chip co-conectar-ia" onClick=\{\(\) => k\.setConectando\(true\)\}(?: \{\.\.\.ancla\('mk-conectar'\)\})?>Conectar tu IA<\/button> : null;/);
  // Sólo se pregunta fuera del Ops Center del super admin (`activo`): ahí contesta la IA de la plataforma.
  assert.match(sinComentarios(leer('app/second-brain/useChatCliente.ts')), /useEffect\(\(\) => \{ if \(activo\) mirarSuIA\(\); \}, \[activo, mirarSuIA\]\);/);
  assert.match(sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx')), /<Modal titulo="Tus cuentas de IA" onCerrar=\{\(\) => \{ k\.setConectando\(false\); k\.mirarSuIA\(\); \}\} ancho=\{640\}>\s*<TusCuentasIA sinCabecera conectar \/>/, 'sin salir de la tab (IA4: abre directo «¿Qué IA usas?»)');
  // En el teléfono, adentro de la hoja del chat (una hoja sobre otra la cerraría), con su «‹».
  assert.match(sinComentarios(leer('app/m/second-brain/ChatClienteM.tsx')), /\{panel === 'conectar' && <TusCuentasIA sinCabecera conectar \/>\}/, 'el teléfono, en la misma hoja');
});

// 22/10/2026: «Computadora Y teléfono». El teléfono del cliente es el del super admin (app/m/operaciones/ChatsMovil.tsx): la
// pantalla es la lista y cada chat se abre en su hoja, con el mismo motor de la computadora.
// PROBADO ROMPIÉNDOLO (base 8/0): la página volviendo a montar ChatMako → 7/1 (8) · la hoja del chat con su propio hilo → 7/1 (4).
test('8. el teléfono: la lista es la pantalla y cada chat se abre en su hoja, como el Ops Center del super admin', () => {
  const page = sinComentarios(leer('app/m/second-brain/page.tsx'));
  assert.match(page, /\{centro \? <SecondBrainCentroM centro=\{centro\} chat=\{chat\} \/> : <ChatClienteM \{\.\.\.chat\} \/>\}/);
  assert.doesNotMatch(page, /ChatMako/, 'el chat de antes del teléfono ya no se monta');
  const m = sinComentarios(leer('app/m/second-brain/ChatClienteM.tsx'));
  // Desde el 13/11/2026 (el prototipo aprobado): la conversación a pantalla completa y «Nuevo chat» como el «+» de WhatsApp (tests/m-chat-pantalla.test.ts).
  assert.match(m, /<PantallaChatM abierto=\{abierta && elegido != null\} onCerrar=\{cerrar\} id="chat-cliente"/, 'la conversación, a pantalla completa');
  assert.match(m, /<NuevoChatFlotante onClick=\{\(\) => abrir\(\{ virtual: 'nuevo' \}\)\} \/>/, '«Nuevo chat», el «+» flotante');
  // Desde el 22/10, agrupados por su origen con `porJefe` (tests/ops-center-lista-cliente.test.ts), en la misma lista.
  // Desde el 4/11/2026, entre los dos, el coach con sus conversaciones de oferta (tests/coaches-ops-center.test.ts, 15).
  assert.match(m, /\{cerebro && coincide\(cerebro\.titulo, busca\) && fila\(cerebro\)\}\s*\{verCoach && coincide\(ORIGEN_FUNNEL_COACH, busca\) && \([\s\S]{0,700}?\.map\(\(f\) => fila\(f, true\)\)\}\s*(?:\{\}\s*)?\{porJefe\(corte\)\.flatMap\(/, 'el Cerebro, el coach y después todos, en la MISMA lista');
});

// 21/10/2026 (~23:10), tres reglas de Martín para toda la app: el chat de MaKo de cada tab a la IZQUIERDA, con la estrella y al
// Cerebro; y las criaturas siempre vivas. PROBADO ROMPIENDOLO (base 9/0): la pieza con su propio hilo → 8/1 · las criaturas
// quietas fuera de «trabajando» → 8/1 · el desfase igual para todas → 8/1. Lo del CRM (22/10): la estrella sin su número → 8/1 ·
// la tab sin dejarle el lugar → 8/1 · sin lo de la tab arriba del hilo → 8/1.
test('9. MaKo en cada tab (la estrella, a la izquierda, al Cerebro) y las criaturas siempre vivas', async () => {
  const t = sinComentarios(leer('app/_chat/MakoEnLaTab.tsx'));
  assert.match(t, /<Muneco titulo=\{JEFE_SECOND_BRAIN\} animo="despierto" size=\{40\}/, 'el botón es la estrella de MaKo');
  assert.match(t, /useChatCliente\(\{ elegido, setElegido, activo: true, entrarAlCerebro: true,/, 'lo escrito va al Cerebro');
  assert.match(t, /<HiloDelCliente k=\{k\}(?: apertura=\{apertura\})? \/>/);
  assert.doesNotMatch(t, /<CajaChat |<HiloMako |fetch\(/, 'sin caja, hilo ni pedidos propios');
  // Encima de un modal de la tab, con el z de la pila (CR4, 22/10/2026): `sobre`.
  // Con la guía señalando en una ventana angosta, se aparta sin desmontarse (29/10/2026): la clase, no otro panel.
  assert.match(t, /className=\{apartado \? 'ch-tab-panel ch-tab-panel--apartado' : 'ch-tab-panel'\} style=\{\{ left: izquierda, \.\.\.\(sobre \? \{ zIndex: capa\.z \} : \{\}\) \}\}/, 'el panel, pegado a la barra de la app');
  // Lo que pidió el CRM: lo suyo arriba del hilo, su número en la estrella, y que la tab le deje el lugar.
  assert.match(t, /arriba=\{<><TrabajosTerminados trabajos=\{trabajos\} \/>\{arriba\}<BarraFijados /);
  assert.match(t, /<Muneco titulo=\{JEFE_SECOND_BRAIN\} animo="despierto" size=\{40\} espera=\{espera\} \/>/);
  assert.match(t, /raiz\.setProperty\('--ancho-panel-mako', abierto \? `\$\{LUGAR_PANEL\}px` : '0px'\);/);
  // Flota desde el 25/10/2026 (el marco del Dashboard): tests/mako-en-la-tab-flota.test.ts.
  assert.match(leer('app/_chat/chat.css'), /\.ch-tab-panel \{\s*position: fixed; top: calc\(var\(--barra-agencia, 0px\) \+ 12px\); bottom: 12px;/);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { createElement } = await import('react');
  const { Muneco } = await import('../app/admin/operaciones/Muneco');
  const html = (titulo: string, animo: 'despierto' | 'dormido') => renderToStaticMarkup(createElement(Muneco, { titulo, animo }));
  assert.match(html('CRM', 'despierto'), /class="mun-ojos mun-ojos--parpadeo"/, 'despierta también parpadea');
  assert.notEqual(/--mun-desfase:([^;"]+)/.exec(html('CRM', 'despierto'))?.[1], /--mun-desfase:([^;"]+)/.exec(html('Pagos', 'despierto'))?.[1], 'cada una a su ritmo');
  const css = leer('app/admin/operaciones/centro.css');
  assert.match(css, /\.mun-cuerpo \{ animation: mun-flota 3\.8s ease-in-out var\(--mun-desfase, 0s\) infinite; \}/, 'flota en cualquier ánimo');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.mun-cuerpo, \.mun-ojos--parpadeo \{ animation: none !important; \} \}/);
});
