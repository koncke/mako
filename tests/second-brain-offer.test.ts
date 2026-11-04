// =============================================================================
// Las conversaciones de Offer llegan al Ops Center del cliente (20/10/2026)
// =============================================================================
// Martín: «Revisa que el chat de OFFER no está llegando al Ops Center, eso está muy mal». Medido ese día (docs/feedback-20-10.md,
// punto 1; docs/hallazgos-second-brain.md): Offer guarda en `offer_sesiones` (por workspace) y el Ops Center leía sólo
// `chart_sessions` con la clave exacta `mako-movil:<persona>`; las 6 conversaciones de Offer (ws1 ×2, ws10, ws11, ws13, ws21)
// no se veían. Ahora el índice las PROYECTA sin copiarlas (la decisión 5 de docs/diseno-mako-ai-native.md). Lo que se fija:
//   1. un mensaje de Offer se lee como uno del chat: 'yo' es la persona, 'mako' es MaKo;
//   2. la proyección se declara con su origen y su alcance, corre DENTRO del workspace y con la puerta de la tab (un closer
//      o un setter sin Offer no la ve), y lee la conversación SIN documentos;
//   3. la API: `?offer=1` y `?offerId=N`, detrás de la puerta de MaKo; una que no es de este negocio, 404;
//   4. la pantalla: una fila por conversación en LA lista, que se sigue en el Ops Center con el motor de Offer (21/10/2026;
//      hasta ese día era una sección «Offer» con «Seguir en Offer»); el jefe sigue mirando sólo la clave exacta;
//   5. en el teléfono, las mismas conversaciones en «Tus chats», que llevan a Offer.
//
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   · `mensajesDeOffer` con los roles al revés → 1 fallo (1);
//   · `wsSiVeOffer` sin la puerta de la tab → 1 fallo (2);
//   · la pantalla sin la sección «Offer» → 1 fallo (4);
//   · Offer sin `?sesion=` en el teléfono → 1 fallo (4);
//   · `chatsDeOffer` sin esconder la del onboarding ya copiada → 1 fallo (6).
// Y el 20/10 a la noche (revisión del Cerebro; chat Onboarding, base 6/0): esconderla para todos sin mirar de quién es la
// copia → 5/1 (6) · `chatsDeOffer` con la persona del setting en vez de la que pide → 5/1 (6).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mensajesDeOffer, offerDelOnboardingCopiada, seEscondeDeOffer, SECCION_OFFER } from '../lib/chat-mako-reglas';
import { puedeVerKey } from '../lib/movil-rutas';

const leer = (r: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', r), 'utf8').replace(/\r\n/g, '\n');

test('1. un mensaje de Offer se lee como uno del chat', () => {
  assert.deepEqual(mensajesDeOffer([
    { de: 'mako', texto: '¿Qué vendes?', at: '2026-10-18T22:24:41Z' },
    { de: 'yo', texto: 'Un curso de inglés', at: '2026-10-18T22:25:00Z' },
    { de: 'mako', texto: '   ', at: '2026-10-18T22:25:10Z' },
  ]), [
    { role: 'assistant', content: '¿Qué vendes?', created_at: '2026-10-18T22:24:41Z' },
    { role: 'user', content: 'Un curso de inglés', created_at: '2026-10-18T22:25:00Z' },
  ], 'lo vacío no se dibuja');
  assert.equal(SECCION_OFFER, 'Offer');
});

test('2. la proyección dice su origen y su alcance, corre en el workspace y con la puerta de la tab', () => {
  const ind = leer('lib/chat-mako-indice.ts');
  // Desde el 22/10 (OC5) son dos proyecciones, cada una con la puerta de SU tab (tests/ops-center-automations.test.ts).
  assert.match(ind, /export const PROYECCIONES = \[\n  \{ origen: 'offer', alcance: 'workspace', tab: 'offer' \},/);
  assert.match(ind, /return rolWs && ws != null && puedeVerKey\(tab, rolWs, capa\) \? ws : null;/, 'la MISMA puerta que la tab');
  assert.equal((ind.match(/await wsSiVe\('offer'\)/g) ?? []).length, 2, 'la lista y el hilo de Offer, con la puerta de Offer');
  assert.match(ind, /runWithWorkspace\(ws, \(\) => Promise\.all\(\[listarSesionesOffer\(\)/, 'la lista, dentro del workspace');
  assert.match(ind, /runWithWorkspace\(ws, \(\) => Promise\.all\(\[\n    leerConversacionOffer\(id\),/, 'el hilo, dentro del workspace');
  // Lo que la puerta deja ver, medido: Offer es de admin; un closer o un setter no la ven.
  assert.equal(puedeVerKey('offer', 'admin', null), true);
  assert.equal(puedeVerKey('offer', 'closer', null), false);
  assert.equal(puedeVerKey('offer', 'setter', null), false);
  // El hilo, SIN documentos ni borrador (pesan, y no son la conversación).
  const lector = leer('lib/offer-sesiones.ts');
  const conv = lector.slice(lector.indexOf('export async function leerConversacionOffer'));
  assert.match(conv, /\.select\('id, titulo, mensajes, updated_at'\)/);
});

test('3. la API: ?offer=1 y ?offerId=N, detrás de la puerta de MaKo; uno de otro negocio no existe', () => {
  const r = leer('app/api/mako/chat/route.ts');
  const get = r.slice(r.indexOf('export async function GET'), r.indexOf('export async function POST'));
  assert.ok(get.indexOf('personaDelRequest()') < get.indexOf("sp.get('offer')"), 'la puerta de MaKo primero');
  assert.match(get, /if \(sp\.get\('offer'\)\) return json\(\{ ok: true, offer: await chatsDeOffer\(\) \}\);/);
  assert.match(get, /if \(!hilo\) return json\(\{ ok: false, error: 'No encuentro esa conversación\.' \}, 404\);/);
});

// 21/10/2026, Martín: «Jamás debes categorizar en desplegables los chats de la sidebar, como "offer" o "antes", y mucho menos
// "continuar en offer", las personas deberían poder continuar lo que quieran siempre desde el Ops Center». La sección «Offer»
// y su «Seguir en Offer» se fueron: cada conversación de Offer es una fila más de la lista (lib/chat-mako-reglas.ts →
// listaDelCliente, con su test en tests/ops-center-cliente.test.ts) y se SIGUE ahí, con el motor de Offer.
test('4. la pantalla: cada conversación de Offer es una fila de la lista, y se sigue en el Ops Center con el motor de Offer', () => {
  const sb = leer('app/second-brain/useChatCliente.ts');
  // Con el grupo de WhatsApp de MaKo desde el 22/10/2026 (OC3): una fila más de LA lista.
  assert.match(sb, /listaDelCliente\(\{ sesiones: sesiones \?\? \[\], offer: offer \?\? \[\], antes: antes \?\? \[\], busca, automations: automations \?\? \[\](?:, editores: editores \?\? \[\])? \}\)/, 'una fila por conversación, en LA lista');
  assert.match(sb, /void abrirOffer\(idOffer\)\.then\(/, 'se abre con el motor de Offer');
  assert.match(sb, /const r = await turnoOffer\(s\.id, mensaje, s\.mensajes, respuestaDeOffer\(s\.mensajes, mensaje\), archivos\.map\(\(a\) => a\.file\), nota\);/, 'lo escrito (y la nota de voz, OC7) va a Offer');
  assert.doesNotMatch(sb, /Seguir en Offer|AVISO_OFFER|\/offer\?sesion=/, 'nunca «Seguir en Offer»');
  const motor = leer('app/second-brain/motor-offer.ts');
  assert.match(motor, /con\.llamar<\{ sesion: OfferSesionVista \}>\(\s*\{ action: 'turno', sesionId: id, texto, docIds,/, 'el turno de la tab');
  assert.match(motor, /\{ action: 'leer-link', sesionId: id, url \}/, 'los links, leídos antes, como en la tab');
  assert.match(motor, /quedoGuardado\(leida\.sesion\.mensajes, antes\.length, \{ texto, audio: !!voz \}\)/, 'un corte no lo manda dos veces');
  assert.doesNotMatch(leer('lib/chat-mako-reglas.ts').slice(leer('lib/chat-mako-reglas.ts').indexOf('export function arbolDelJefe')).split('\n}')[0], /offer/i, 'el jefe sigue mirando sólo la clave exacta');
  // Offer abre ESA conversación con ?sesion=, si es de este negocio (en la computadora y en el teléfono).
  for (const p of ['app/offer/page.tsx', 'app/m/offer/page.tsx']) {
    assert.match(leer(p), /const pedidaSesion = idDeParametro\(q\.sesion\);\n  const pedido = pedidaSesion != null && todasLasSesiones\(leido\.arbol\)\.some\(\(s\) => s\.id === pedidaSesion\)/, p);
  }
});

// 22/10/2026 (OC2): el chat viejo del teléfono (app/m/mako/ChatMako.tsx) se borró. El de ahora (ChatClienteM.tsx) usa el MISMO
// motor que la computadora: las conversaciones de Offer están en LA lista y se siguen ahí, sin ir a /m/offer.
test('5. en el teléfono, las conversaciones de Offer están en LA lista y se siguen ahí', () => {
  const m = leer('app/m/second-brain/ChatClienteM.tsx');
  assert.match(m, /useChatCliente\(\{ elegido, setElegido, /);
  assert.doesNotMatch(m, /\/m\/offer\?sesion=/, 'ya no lleva a /m/offer');
});

test('6. la conversación del onboarding no sale dos veces (acordado con el chat Onboarding)', () => {
  // hiloDelOnboarding la copia a un chat «Onboarding» de UNA persona (`hiloDe`) y deja su id en `hiloChat`: a ESA persona
  // «Offer» no se la lista. A los demás sí (revisión del Cerebro, 20/10: se escondía para todos y desaparecía del Ops Center
  // del super admin mirando).
  const copia = { sesionId: 14, hiloChat: 301, hiloDe: 'mako-movil:u7', hiloAt: '2026-10-21T03:00:00.000Z' };
  assert.deepEqual(offerDelOnboardingCopiada(JSON.stringify(copia), 'mako-movil:u7'), { id: 14, at: '2026-10-21T03:00:00.000Z' });
  assert.equal(offerDelOnboardingCopiada(copia, 'mako-movil:u8'), null, 'otro admin, un closer o el super admin mirando la siguen viendo');
  assert.equal(offerDelOnboardingCopiada(copia, null), null);
  assert.equal(offerDelOnboardingCopiada({ sesionId: 14, hiloChat: 301 }, 'mako-movil:u7'), null, 'sin saber de quién es la copia, no se esconde');
  assert.equal(offerDelOnboardingCopiada({ sesionId: 14, hiloDe: 'mako-movil:u7' }, 'mako-movil:u7'), null, 'sin el chat todavía, se ve en «Offer»');
  assert.equal(offerDelOnboardingCopiada(null, 'mako-movil:u7'), null);
  assert.equal(offerDelOnboardingCopiada('no es json', 'mako-movil:u7'), null);
  // La copia es una FOTO: si la siguió en Offer después, vuelve a listarse (cuarta revisión, 21/10).
  const c = offerDelOnboardingCopiada(copia, 'mako-movil:u7');
  assert.equal(seEscondeDeOffer({ id: 14, updatedAt: '2026-10-21T02:59:00.000Z' }, c), true, 'sin nada nuevo, se esconde');
  assert.equal(seEscondeDeOffer({ id: 14, updatedAt: '2026-10-21T04:10:00.000Z' }, c), false, 'la siguió después: se lista');
  assert.equal(seEscondeDeOffer({ id: 15, updatedAt: '2026-10-21T02:00:00.000Z' }, c), false, 'otra conversación');
  assert.equal(seEscondeDeOffer({ id: 14, updatedAt: '2026-10-21T04:10:00.000Z' }, { id: 14, at: null }), true, 'una copia sin hora, como antes');
  const ind = leer('lib/chat-mako-indice.ts');
  // Desde el 22/10 la lista filtrada se guarda (`filas`) para ponerle el tema a las que se llaman igual, y se devuelve ésa.
  assert.match(ind, /const copiada = offerDelOnboardingCopiada\(arranque, sesion \? chartKeyDePersona\(sesion\) : null\);\n[\s\S]{0,400}?const filas = lista\.filter\(\(s\) => s\.id > 0 && !seEscondeDeOffer\(s, copiada\)\)[\s\S]{0,900}?return filas\.map\(/);
  assert.match(leer('lib/onboarding-arranque-server.ts'), /hiloChat: hilo\.id, hiloDe: chartKey, hiloAt: new Date\(\)\.toISOString\(\),/);
});
