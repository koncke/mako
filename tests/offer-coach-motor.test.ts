// =============================================================================
// EL OFFER COACH DEL V2 = EL MOTOR DE OFFER (19/11/2026)
// =============================================================================
// Martín (16/11): «el diagnóstico en UN mensaje: la nota general y Descargar PDF»; el Cerebro (18/11): «Offer Coach en la app = el
// MOTOR de Offer (el de la pestaña Offer): subir el documento, las piezas, la nota y el PDF en UN mensaje». Lo que fija:
//   1. /api/offer 'coach': SÓLO con el V2; la conversación guardada o una nueva en el funnel principal; con «Armar mi oferta».
//   2. el Ops Center no la lista dos veces: es la fila de Offer Coach (chatsDeOffer la esconde, sólo a quien tiene los dos coaches).
//   3. el Offer Coach sigue SU conversación de Offer con el motor de Offer (`offerDirecto`, «Armar mi oferta» que dice el servidor),
//      y su presentación va arriba sólo hasta que la persona escribe.
//   4. la oferta armada en UN mensaje (OfertaEnElChat): el nombre, la nota de 100, las dimensiones, lo que más la sube, «Descargar
//      PDF» y «Seguir afinando»; «Guardada» sólo si lo está.
//   5. sólo la ÚLTIMA versión lleva la tarjeta; una anterior, su PDF para bajar.
//   6. el teléfono: la voz de los coaches y el mismo motor.
// Probado rompiéndolo (19/11/2026, base 6 / 0, una rotura por vez y restaurada): sin `s.id !== escondida` cae el 2; con la tarjeta en
// cualquier versión, el 5. Lo aprendido, en docs/hallazgos-onboarding.md («Offer Coach = el motor de Offer»).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '');

test('1. /api/offer «coach»: sólo con el V2, la guardada o una en el funnel principal, con «Armar mi oferta»', () => {
  const r = sinComentarios(leer('app/api/offer/route.ts'));
  assert.match(r, /case 'coach':\n\s*return await delOfferCoach\(ws\);/);
  assert.match(r, /if \(!\(await conDosCoaches\(ws\)\)\) return no\(404,/, 'sin el V2, nada');
  assert.match(r, /return !!usuario && veOnboardingV2\(\{ email: usuario\.email, ws \}\);/, 'el interruptor lo decide el servidor');
  assert.match(r, /const fila = guardada \? await leerFila\(guardada\) : null;\n\s*if \(fila\) return ok\(\{ sesion: await vistaSesion\(fila\), opcionArmar: OPCION_ARMAR \}\);/);
  assert.match(r, /const nueva = \(await sesionVaciaDe\(funnelId, null\)\) \?\? await sesionNueva\(await contextoOffer\(\{ funnelId \}\), \[\], \{ funnelId, ofertaBaseId: null \}\);\n\s*await guardarSesionDelOfferCoach\(nueva\.id\);/);
  // Y aconseja con la cara del Offer Coach (el de oferta, o Hormozi), no con el de anuncios.
  assert.match(r, /const id = wsV2 != null && \(await conDosCoaches\(wsV2\)\) \? referenteDelOfferCoachV2\(elegido\) : elegido;/);
});

test('2. el Ops Center no la lista dos veces: la esconde sólo a quien tiene los dos coaches', () => {
  const i = sinComentarios(leer('lib/chat-mako-indice.ts'));
  assert.match(i, /const escondida = delCoach != null && sesion && veOnboardingV2\(\{ email: sesion\.email, ws \}\) \? delCoach : null;/);
  assert.match(i, /lista\.filter\(\(s\) => s\.id > 0 && s\.id !== escondida && !seEscondeDeOffer\(s, copiada\)\)/);
});

test('3. el Offer Coach sigue SU conversación de Offer con el motor de Offer', () => {
  const m = sinComentarios(leer('app/second-brain/useChatDelCoach.ts'));
  assert.match(m, /const motorOffer = dosCoaches && cual === 'offer';/);
  assert.match(m, /llamarOffer<\{ sesion: OfferSesionVista; opcionArmar\?: string \}>\(\{ action: 'coach' \}, TOPE\.corto\)/);
  assert.match(m, /setOpcionArmar\(r\.opcionArmar \?\? ''\); setElegido\(\{ offer: r\.sesion\.id \}\);/);
  assert.match(m, /opcionArmar, busca: '', caja, desde: de\.desde, tab: de\.tab, quien, offerDirecto: motorOffer \}\)/);
  assert.match(m, /const sinEscribir = motorOffer && k\.cargado && !k\.errorCarga && !!k\.sesionOffer && !k\.sesionOffer\.mensajes\.some\(\(m\) => m\.de === 'yo'\);/);
  const c = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(c, /if \(offerDirecto\) \{ poner\(itemsDeOffer\(s\.mensajes, conWsDeAudio\)\); return; \}/, 'con el id de Offer en cada mensaje');
  const chat = sinComentarios(leer('app/second-brain/ChatDelCoach.tsx'));
  // (20/11, V12: la portada queda siempre arriba, y el hilo lo arma coach-compartido.tsx → useHiloDelCoach: tests/onboarding-v2-coaches-videos.test.ts.)
  assert.match(chat, /useHiloDelCoach\(\{ k, cual, dosCoaches, plan, motorOffer, portada, conVoz, deLaOferta, enPortada, entrada \}\)/);
  assert.match(chat, /<HiloDelCliente k=\{hiloCoach\} enMensaje=\{enMensajeDelHilo\} \/>/);
  assert.match(sinComentarios(leer('app/second-brain/coach-compartido.tsx')), /return conVoz\(false, motorOffer \? \(deLaOferta as never\) : undefined\)\(x\);/, 'con el motor de Offer, la oferta en su mensaje');
});

type Sesion = Record<string, unknown>;
function sesionDePrueba(o: { ofertaId?: number | null } = {}): Sesion {
  const conclusion = {
    version: 2, at: '2026-11-19T10:00:00.000Z', modelo: 'x',
    calculo: { total: 63.4, cuello: 'D3', lista: false },
    diagnostico: { dimensiones: [
      { id: 'D1', nota: 7, porque: '', mejora: 'Di para quién no es.' },
      { id: 'D3', nota: 4, porque: '', mejora: 'Ponle nombre a tu método.' },
    ] },
    propuesta: { nombre: 'Mentoría Agenda Llena', frase: '' },
  };
  return {
    id: 41, titulo: 'Mentoría', ofertaId: o.ofertaId === undefined ? 9 : o.ofertaId, ligada: true, guardadaEn: [{ id: 5, nombre: 'Funnel principal' }],
    versiones: 2, conclusion,
    mensajes: [
      { id: 'm0', de: 'yo', texto: 'Vendo una mentoría', at: '' },
      { id: 'm1', de: 'mako', texto: 'Aquí está la versión 1 de tu oferta, en PDF.', at: '', pdf: { version: 1 } },
      { id: 'm2', de: 'mako', texto: 'Aquí está la versión 2 de tu oferta, en PDF.', at: '', pdf: { version: 2 } },
    ],
  };
}

test('4. la oferta armada en UN mensaje: la nota, las dimensiones, lo que más la sube, Descargar PDF y Seguir afinando', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { createElement } = await import('react');
  const { OfertaEnElChat } = await import('../app/second-brain/OfertaEnElChat');
  const { DIMENSIONES } = await import('../lib/offer-marco');
  const s = sesionDePrueba();
  const html = renderToStaticMarkup(createElement(OfertaEnElChat, { sesion: s as never, conclusion: s.conclusion as never, onSeguir: () => {} }));
  assert.match(html, /Tu oferta/);
  assert.match(html, /Mentoría Agenda Llena/);
  assert.match(html, /<b>63<\/b><span>de 100<\/span>/, 'la nota general, redondeada');
  assert.equal((html.match(/<li>/g) ?? []).length, DIMENSIONES.length, 'todas las dimensiones, en el orden del marco');
  assert.match(html, /Lo que más la sube:<\/b> Ponle nombre a tu método\./, 'la del cuello');
  assert.match(html, /Descargar PDF/);
  assert.match(html, /Seguir afinando/);
  assert.match(html, /Guardada en Funnel principal/);
  assert.doesNotMatch(html, /PDF para tu cliente|Guardar en este funnel/, 'lo que Martín sacó el 16/11');
  // Sin guardar todavía: no dice «Guardada» (la guarda sola al montarse, en el navegador).
  const sin = sesionDePrueba({ ofertaId: null });
  assert.doesNotMatch(renderToStaticMarkup(createElement(OfertaEnElChat, { sesion: sin as never, conclusion: sin.conclusion as never, onSeguir: () => {} })), /Guardada/);
});

test('5. sólo la ÚLTIMA versión lleva la tarjeta; una anterior, su PDF', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { createElement } = await import('react');
  const { useOfertaEnMensaje } = await import('../app/second-brain/coach-compartido');
  const s = sesionDePrueba();
  function Prueba({ id }: { id: string }) {
    const f = useOfertaEnMensaje(s as never, () => {}, false);
    return createElement('div', null, f({ id })?.abajo ?? 'nada');
  }
  const ultima = renderToStaticMarkup(createElement(Prueba, { id: 'of-m2' }));
  assert.match(ultima, /data-oferta-lista="2"/);
  const anterior = renderToStaticMarkup(createElement(Prueba, { id: 'of-m1' }));
  assert.doesNotMatch(anterior, /data-oferta-lista/);
  assert.match(anterior, /Descargar el PDF de la versión 1/);
  assert.equal(renderToStaticMarkup(createElement(Prueba, { id: 'of-m0' })), '<div>nada</div>', 'un mensaje sin PDF, nada');
});

test('6. el teléfono: la voz de los coaches y el mismo motor', () => {
  const h = sinComentarios(leer('app/m/second-brain/HojaDelCoach.tsx'));
  assert.match(h, /const conVoz = vozDelCoach\(k\.items\);/);
  assert.match(h, /enMensaje=\{dosCoaches \? conVoz\(true, portada\.enMensaje as never\) : portada\.enMensaje\}/, 'el saludo, con su voz');
  assert.match(h, /<HiloDelCliente k=\{hiloCoach\} enMensaje=\{enMensajeDelHilo\} \/>/);
  assert.match(h, /useOfertaEnMensaje\(motorOffer \? k\.sesionOffer : null, \(\) => caja\.current\?\.focus\(\), true\)/, 'en el teléfono el PDF baja directo');
  // Sin el panel de la computadora: lo compartido vive aparte.
  assert.doesNotMatch(h, /from '@\/app\/second-brain\/ChatDelCoach'/);
});
