// =============================================================================
// El chat del onboarding escribe en la caja ÚNICA del Ops Center (20/10 → 21/10/2026)
// =============================================================================
// Martín (pedido del 18/10, punto 3): «el composer del chat del onboarding es el del Ops Center TAL CUAL: + para adjuntar,
// el micrófono para grabar audio, los adjuntos arriba, arrastrar y soltar, sin el enviar verde. Copiá el componente del Ops
// Center; no hagas uno nuevo». El 20/10 la caja del Ops Center vivía adentro de Conversacion.tsx y el onboarding tenía una
// copia de su fila (app/offer/CajaDelCentro.tsx), comparada pieza por pieza. El 21/10 llegó a main la caja ÚNICA
// (app/_chat/CajaChat.tsx, de Ops Center 3), con la nota de voz y la línea de estado que el onboarding necesitaba: el
// onboarding la usa y la copia se borró. Ya no hay nada que comparar; lo que fija este test es que el onboarding escribe en
// ESA pieza, con lo suyo (la voz, el estado, lo que Offer sabe leer). Desde el 22/10/2026 (OF4) la tab Offer también: la
// barra de WhatsApp se fue, OfferApp arma UNA caja para las dos y ChatOffer la dibuja.
//
// ROTURAS (21/10/2026, romper.js + roturas-caja-unica.json del scratchpad, con onboarding-caja-voz; base 7/0): vuelve una
// caja propia → 6/1 · «Documento» con lo del Ops Center → 6/1 · con sólo texto se adjunta → 6/1 · arrastrar con sólo texto
// abre el archivo → 6/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la tab y el onboarding escriben en la caja ÚNICA, y la copia se fue', () => {
  const app = sinComentarios(leer('app/offer/OfferApp.tsx'));
  assert.match(app, /import type \{ PropsCajaChat \} from '@\/app\/_chat\/CajaChat';/);
  assert.match(app, /const caja: PropsCajaChat = \{/);
  assert.match(app, /caja=\{caja\}/);
  const chat = sinComentarios(leer('app/offer/ChatOffer.tsx'));
  assert.match(chat, /import \{ CajaChat \} from '@\/app\/_chat\/CajaChat';/);
  assert.match(chat, /<div key=\{sesion\.id\} className="co-caja-wrap" style=\{SIN_VERDE\}>\s*<div className="co-caja"><CajaChat \{\.\.\.caja\} \/><\/div>/);
  assert.equal(existsSync(join(__dirname, '..', 'app/offer/CajaDelCentro.tsx')), false, 'volvió la copia de la caja');
});

test('con lo del onboarding: la línea de estado, lo que Offer sabe leer, y sin adjuntos con sólo texto', () => {
  const app = sinComentarios(leer('app/offer/OfferApp.tsx'));
  assert.match(app, /adjuntos: sinAdjuntos \? undefined : adjuntosCaja, estado: estadoVista,/, 'con sólo texto (el nombre, un código) no se adjunta');
  assert.match(app, /const sinAdjuntos = !!arranque\?\.manda;/);
  // Lo de Offer (ACCEPT_IMPORTAR) más un .zip (22/10/2026, la carpeta de una landing).
  assert.match(app, /accept: ACCEPT_OFFER,/, '«Documento» con lo del Ops Center no deja subir el audio ni el video de una llamada');
  assert.match(app, /const ACCEPT_OFFER = `\$\{ACCEPT_IMPORTAR\},\.zip`;/);
  assert.match(app, /onSinImagen: \(puedeLeer\) => setErrorChat\(/, '«Pegar» sin una imagen copiada no dice nada');
  // Los archivos van arriba del texto, en las miniaturas de la caja: ni en el onboarding ni en la tab una vista tapa el chat.
  assert.doesNotMatch(app, /<VistaAdjuntos\b/);
  const chat = sinComentarios(leer('app/offer/ChatOffer.tsx'));
  assert.doesNotMatch(chat, /<ComposerWhatsApp\b|<ChatHilo\b/, 'volvió la barra (o el hilo) de WhatsApp');
});

test('el «+», pegar y soltar suman a la MISMA lista, que se lee al mandar', () => {
  const app = sinComentarios(leer('app/offer/OfferApp.tsx'));
  assert.match(app, /onSumar: agregarArchivos,/);
  assert.match(app, /onQuitar: quitarArchivo,/);
  assert.match(app, /if \(lista\.ref\.current\.length\) \{ void enviarVista\(\); return; \}/, 'mandar con algo juntado tiene que leerlo antes del turno');
  const chat = sinComentarios(leer('app/offer/ChatOffer.tsx'));
  assert.match(chat, /if \(!soloTexto && !ocupado\) onArchivos\(Array\.from\(e\.dataTransfer\.files\)\);/);
});

test('con sólo texto, un archivo arrastrado no se suma pero tampoco lo abre el navegador', () => {
  // Revisión del Cerebro (20/10): con `soloTexto` los dos manejadores salían SIN preventDefault y Chrome abría el archivo
  // en la pestaña: el dueño perdía el onboarding en la pregunta del nombre.
  const chat = sinComentarios(leer('app/offer/ChatOffer.tsx'));
  const arrastrar = chat.match(/const alArrastrar = [\s\S]*?\n {2}\};/)?.[0] ?? '';
  const soltar = chat.match(/const alSoltar = [\s\S]*?\n {2}\};/)?.[0] ?? '';
  for (const [nombre, f] of [['alArrastrar', arrastrar], ['alSoltar', soltar]]) {
    const antes = f.slice(0, f.indexOf('e.preventDefault();'));
    assert.ok(f.includes('e.preventDefault();'), `${nombre} sin preventDefault`);
    assert.doesNotMatch(antes, /soloTexto|ocupado/, `${nombre} sale antes de frenar el archivo: el navegador lo abre`);
  }
  assert.match(chat, /\{encima && <div className="co-soltar" aria-hidden>Suelta para adjuntar<\/div>\}/);
});

test('lo que un test dibuja en node no carga la caja: el PDF de la versión vive aparte de ChatOffer', () => {
  // ChatOffer monta la caja (22/10/2026, OF4), que trae su .css: node no lo carga. Lo que tests/offer-pulir-pdf.test.ts dibuja
  // con renderToStaticMarkup (el PDF de una versión) se mudó a DocumentoPdf.tsx, sin la caja.
  const pdf = sinComentarios(leer('app/offer/DocumentoPdf.tsx'));
  assert.doesNotMatch(pdf, /from '@\/app\/_chat\/|from '@\/app\/admin\/operaciones\/|\.css';/);
  assert.match(sinComentarios(leer('app/offer/ChatOffer.tsx')), /import \{ DocumentoPdf \} from '\.\/DocumentoPdf';/);
});
