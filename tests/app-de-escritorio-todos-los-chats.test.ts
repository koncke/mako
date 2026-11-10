// =============================================================================
// Sin la app de escritorio no se escribe en NINGÚN chat con MaKo (25/10/2026)
// =============================================================================
// Martín: «Ni en la cuenta de Mauricio ni en la mia tengo instalado aun la app de escritorio de MaKo y aún así me sigue dejando
// enviar mensajes... No debería. En ningun chat, no solo en Ops Center». El 24/10 el bloqueo vivía sólo en la caja del chat común
// (CajaDelCliente: el Ops Center del cliente y la estrella de cada tab). Esto fija:
//   1. EL INVENTARIO: toda pantalla que dibuja una caja de MaKo (CajaChat o CajaPedido) monta el bloqueo
//      (app/_chat/useAppDeEscritorio.tsx), lo recibe de su motor, o está en EXENTAS con su porqué. Una caja nueva que no está en
//      ninguna lista es un rojo: o se bloquea, o se explica por qué no;
//   2. cada una corta también su envío por fuera de la caja (una sugerencia, un pedido que llega de otra pantalla);
//   3. el servidor: el negocio de la plataforma ya no queda afuera, y `?app=1` contesta sólo eso;
//   4. la caja de pedido bloqueada: la frase en el campo, «Instalar MaKo» en el lugar del micrófono, sin ↑ ni «+»;
//   5. la respuesta del servidor: sin saberla, no bloquea.
//
// Correr: node --import tsx --test tests/app-de-escritorio-todos-los-chats.test.ts
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CajaPedido } from '../app/web-generator/CajaPedido';
import { FRASE_APP, leerRespuestaApp } from '../app/_chat/app-de-escritorio';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/** Las cajas con el bloqueo adentro: la pantalla llama al hook y le pasa `bloqueo` a su caja. */
const CON_EL_BLOQUEO: readonly string[] = [
  'app/_components/MakoChat.tsx', // el chat de un gráfico (ChartIA, el Analista del Dashboard, el diagnóstico del Web Generator)
  'app/automations/ChatMako.tsx', // la caja de pedido de la galería de Automations («Crear con IA»)
  'app/crm/lead-view/MakoAnalystLead.tsx', // MaKo en la ficha del lead
  'app/crm/lead-view/ficha/GaleriaTab.tsx', // la hoja nueva de la ficha
  'app/dashboard/NuevaHoja.tsx', // la hoja nueva del Dashboard
  'app/dashboard/PanelEditarMako.tsx', // «Editar con MaKo» del Dashboard
  'app/image-editor/mako/chat/PanelMakoIA.tsx',
  'app/video-editor/_opencut/chat/PanelChat.tsx',
  'app/web-generator/CajaCrear.tsx', // «¿Qué vas a crear hoy?»
  'app/_crear/PantallaCrear.tsx', // «¿Qué vas a crear hoy?» de toda tab de Create (29/10/2026)
  'app/whatsapp/WhatsAppAdvisor.tsx',
  'app/ads-manager/ArranqueMediaBuyer.tsx', // el arranque del Media Buyer (la charla de Offer con la calculadora)
  'app/ads-manager/PrimeraEntrada.tsx', // la primera entrada del Marketing CoPilot (6/11/2026): el mismo marco y la misma caja que el arranque
  'app/ads-manager/Hoy.tsx', // la caja de órdenes del Media Buyer (arriba del árbol de HOY, y la de «¿En qué te ayudo hoy?»)
  'app/newsletters/NewslettersApp.tsx', // la apertura del Newsletter (las respuestas rápidas siguen andando, como en el Media Buyer)
];

/** Cajas que dibujan lo que les arma su MOTOR (las props llegan armadas): el bloqueo vive en el motor. */
const DE_SU_MOTOR: Readonly<Record<string, string>> = {
  'app/automations/ChatMakoVista.tsx': 'app/automations/ChatMako.tsx', // el chat del lienzo de Automations
  'app/offer/ChatOffer.tsx': 'app/offer/OfferApp.tsx',
  'app/web-generator/editor/paneles/ChatAgente.tsx': 'app/web-generator/editor/paneles/PanelAgente.tsx',
};

/** Las que NO se bloquean, con su porqué. */
const EXENTAS: Readonly<Record<string, string>> = {
  'app/second-brain/PiezasCliente.tsx': 'el chat común (Ops Center del cliente, la estrella de cada tab): bloquea con lo que le dice su propio motor (`k.app`, `?suIA=1`), tests/app-de-escritorio-primero.test.ts',
  'app/_chat/grupo/CajaDelGrupo.tsx': 'el grupo de un negocio (3/11/2026; Martín: «tipo grupos de WhatsApp»): personas hablando entre ellas y MaKo corre como en WhatsApp, no en la computadora de nadie. El pedido es posterior a la regla del 25/10 y pide sin fricción',
  'app/chats/Composer.tsx': 'la tab Chats: la persona le escribe a SUS leads por WhatsApp, no a MaKo',
  'app/tickets/soporte/PiezasSoporte.tsx': 'la Ticketera (Soporte): le escribe al equipo de MaKo, no a su IA (23/10)',
  'app/admin/operaciones/Conversacion.tsx': 'el Ops Center del super admin: le escribe a los chats de Claude Code de la PC de Martín por el cartero, no a la IA de MaKo',
  'app/m/operaciones/ChatsMovil.tsx': 'lo mismo, en el teléfono del super admin',
  'app/admin/operaciones/CajaChatNuevo.tsx': 'el chat nuevo del Ops Center (28/10): su primer mensaje abre un chat de Claude Code en la PC de Martín, no le escribe a la IA de MaKo',
  'app/m/offer/ComposerOfferM.tsx': 'el teléfono: ahí no se instala, así que nunca bloquea (`en-la-computadora`)',
  'app/image-editor/carruseles/ReplicarGuiado.tsx': 'el guiado de replicar un carrusel (9/11/2026): lo escrito contesta la pregunta de MaKo y no va a ninguna IA; la IA del negocio corre recién al generar, por su ruta',
};

function archivos(dir: string, fuera: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== 'node_modules') archivos(p, fuera); } else if (n.endsWith('.tsx')) fuera.push(p);
  }
  return fuera;
}

test('1. toda caja de MaKo se bloquea sin la app, la recibe de su motor, o dice por qué no', () => {
  const conCaja = archivos(join(RAIZ, 'app'))
    .filter((p) => /<(CajaChat|CajaPedido)\b/.test(sinComentarios(readFileSync(p, 'utf8'))))
    .map((p) => relative(RAIZ, p).replace(/\\/g, '/'))
    .sort();
  const conocidas = new Set([...CON_EL_BLOQUEO, ...Object.keys(DE_SU_MOTOR), ...Object.keys(EXENTAS)]);
  const nuevas = conCaja.filter((f) => !conocidas.has(f));
  assert.deepEqual(nuevas, [], `cajas de MaKo sin decidir: o montan useAppDeEscritorio, o van a EXENTAS con su porqué`);
  const viejas = [...conocidas].filter((f) => !conCaja.includes(f));
  assert.deepEqual(viejas, [], 'una caja de la lista ya no está: sacala de la lista');

  for (const f of CON_EL_BLOQUEO) {
    const src = sinComentarios(leer(f));
    assert.match(src, /import \{ useAppDeEscritorio \} from '@\/app\/_chat\/useAppDeEscritorio';|import \{ useAppDeEscritorio \} from "@\/app\/_chat\/useAppDeEscritorio";/, `${f}: sin el hook`);
    assert.match(src, /const appEscritorio = useAppDeEscritorio\(\);/, `${f}: sin el hook`);
    assert.match(src, /bloqueo=\{appEscritorio\.bloqueo\}/, `${f}: la caja sin su bloqueo (deja escribir)`);
  }
  for (const [caja, motor] of Object.entries(DE_SU_MOTOR)) {
    assert.doesNotMatch(sinComentarios(leer(caja)), /bloqueo=\{/, `${caja}: el bloqueo lo pone su motor`);
    const src = sinComentarios(leer(motor));
    assert.match(src, /const appEscritorio = useAppDeEscritorio\(\);/, `${motor}: sin el hook`);
    assert.match(src, /bloqueo(=\{|: [^,\n]*)appEscritorio\.bloqueo/, `${motor}: la caja sin su bloqueo`);
  }
});

test('2. cada una corta también lo que no pasa por la caja (una sugerencia, un pedido de otra pantalla)', () => {
  const cortes: Readonly<Record<string, RegExp>> = {
    'app/_components/MakoChat.tsx': /if \(\(!txt && !conArchivos\) \|\| pensando \|\| !sessionId \|\| adj\.preparando \|\| appEscritorio\.bloqueada\) return;/,
    'app/automations/ChatMako.tsx': /if \(trabajando \|\| p\.deshabilitado \|\| sinApp\) return/,
    'app/crm/lead-view/MakoAnalystLead.tsx': /const enviar = \(e: Envio\) => \{\n\s*if \(ocupadoRef\.current \|\| !listo \|\| errorCarga \|\| appEscritorio\.bloqueada\) return;/,
    'app/crm/lead-view/ficha/GaleriaTab.tsx': /if \(pensando \|\| !texto \|\| appEscritorio\.bloqueada\) return;/,
    'app/dashboard/NuevaHoja.tsx': /if \(pensando \|\| !listo \|\| appEscritorio\.bloqueada\) return;/,
    'app/dashboard/PanelEditarMako.tsx': /if \(\(!mensaje && !conArchivos\) \|\| pensando \|\| adj\.preparando \|\| appEscritorio\.bloqueada\) return;/,
    'app/image-editor/mako/chat/PanelMakoIA.tsx': /if \(hilo\.corriendo \|\| \(!instruccion\.trim\(\) && !archivos\.length\) \|\| !disenoId \|\| appEscritorio\.bloqueada\) return;/,
    'app/video-editor/_opencut/chat/PanelChat.tsx': /if \(hilo\.corriendo \|\| \(!instruccion\.trim\(\) && !op\.archivos\?\.length\) \|\| !proyectoId \|\| appEscritorio\.bloqueada\) return;/,
    'app/web-generator/CajaCrear.tsx': /const enviar = \(\) => \{\n\s*if \(appEscritorio\.bloqueada\) return;/,
    'app/whatsapp/WhatsAppAdvisor.tsx': /if \(\(!txt && !conArchivos\) \|\| pensando \|\| adj\.preparando \|\| appEscritorio\.bloqueada\) return;/,
    'app/offer/OfferApp.tsx': /if \(id == null \|\| !s \|\| enviando\.current \|\| sinApp\) return 'volver';/,
    'app/web-generator/editor/paneles/PanelAgente.tsx': /if \(hilo\.corriendo \|\| !instruccion\.trim\(\) \|\| appEscritorio\.bloqueada\) return;/,
  };
  for (const [f, re] of Object.entries(cortes)) assert.match(sinComentarios(leer(f)), re, `${f}: manda aunque falte la app`);
  // Automations: el motor (que cargan los tests en node) usa el hook, que no trae CSS.
  assert.match(sinComentarios(leer('app/automations/ChatMako.tsx')), /const sinApp = appEscritorio\.bloqueada;/);
  // Offer: el ONBOARDING no (es lo primero de un cliente nuevo y corre con el crédito de MaKo); la tab sí.
  const offer = sinComentarios(leer('app/offer/OfferApp.tsx'));
  assert.match(offer, /const sinApp = !arranque && appEscritorio\.bloqueada;/);
  assert.match(offer, /bloqueo: arranque \? undefined : appEscritorio\.bloqueo/);
});

test('2b. «Editar con IA» de cada sección, la caja de MaKo que no es CajaChat ni CajaPedido (30/10/2026)', () => {
  const src = sinComentarios(leer('app/web-generator/editor/AskAgent.tsx'));
  assert.match(src, /const appEscritorio = useAppDeEscritorio\(\);/, 'sin el hook');
  assert.match(src, /if \(appEscritorio\.bloqueo\) \{\n\s*return marco\(<div className="gma-ask-sinapp"><span>\{appEscritorio\.bloqueo\.frase\}<\/span>\{appEscritorio\.bloqueo\.boton\}<\/div>\);/, 'bloqueada dibuja la frase y el botón, sin el campo ni las acciones');
  assert.match(src, /const correrEdicion = async \(pedido: string, crear: boolean\) => \{\n\s*if \(appEscritorio\.bloqueada\) return;/, 'editar manda aunque falte la app');
  assert.match(src, /const correrDisenos = async \(\) => \{\n\s*if \(appEscritorio\.bloqueada\) return;/, 'los diseños mandan aunque falte la app');
  // «Probar nuevo diseño» arranca solo: tiene que esperar la respuesta, o el pedido sale antes de saberla.
  assert.match(src, /const puedePedir = app !== null && app !== 'bloquea';/);
  assert.match(src, /if \(modo !== 'disenos' \|\| !puedePedir \|\| arranco\.current\) return;/, 'el arranque solo no espera a saber si tiene la app');
});

test('3. el servidor: la plataforma ya no queda afuera, y `?app=1` contesta sólo la app', () => {
  const ruta = sinComentarios(leer('app/api/mako/chat/route.ts'));
  assert.match(ruta, /if \(sp\.get\('app'\)\) return json\(\{ ok: true, app: await laApp\(persona, req\) \}\);/);
  const laApp = ruta.slice(ruta.indexOf('async function laApp('), ruta.indexOf('async function conSuIA('));
  assert.doesNotMatch(laApp, /wsSuperAdmin|plataforma/, '«ni en la mia... No debería»: la plataforma volvió a quedar afuera');
  const reglas = sinComentarios(leer('lib/chat-mako-reglas.ts'));
  assert.match(reglas, /export function appDeEscritorio\(p: \{ conComputadora: boolean; telefono: boolean \}\): AppDeEscritorio \{\n\s*if \(p\.conComputadora\) return 'tiene';/);
  // El cliente pregunta UNA vez por página y relee cada 8 s mientras bloquea.
  const pura = sinComentarios(leer('app/_chat/app-de-escritorio.ts'));
  assert.match(pura, /fetch\('\/api\/mako\/chat\?app=1', \{ cache: 'no-store' \}\)/);
  assert.match(pura, /if \(estado !== 'bloquea' \|\| !oyentes\.size\) return;\n\s*reloj = setInterval\(\(\) => \{ if \(document\.visibilityState === 'visible'\) void mirarApp\(\); \}, 8_000\);/);
  assert.match(pura, /if \(oyentes\.size === 1\) void mirarApp\(\); else programar\(\);/);
  assert.doesNotMatch(pura, /\.css'/, 'la mitad pura sin CSS: la cargan motores que los tests dibujan en node');
  assert.doesNotMatch(sinComentarios(leer('app/_chat/useAppDeEscritorio.tsx')), /\.css'|from '\.\/InstalarMaKo'/, 'el botón (con CSS) entra con next/dynamic');
});

test('4. la caja de pedido bloqueada: la frase, «Instalar MaKo» en el lugar del micrófono, sin ↑ ni «+»', () => {
  const props = {
    valor: 'una landing', onValor: () => {}, onEnviar: () => {}, ejemplos: ['x'], animar: true, placeholderQuieto: 'Escribe',
    etiqueta: 'Qué', onError: () => {}, antes: createElement('button', { type: 'button', 'data-mas': '' }, '+'),
  };
  const libre = renderToStaticMarkup(createElement(CajaPedido, props));
  assert.match(libre, /class="gp-cc-enviar"/);
  assert.match(libre, /data-mas=""/);
  const bloqueada = renderToStaticMarkup(createElement(CajaPedido, {
    ...props, bloqueo: { frase: FRASE_APP, boton: createElement('button', { type: 'button', 'data-instalar': '' }, 'Instalar MaKo') },
  }));
  assert.doesNotMatch(bloqueada, /class="gp-cc-enviar"/, 'con el ↑ se podía mandar');
  assert.doesNotMatch(bloqueada, /data-mas=""/, 'el «+» no tiene sentido sin la app');
  assert.match(bloqueada, /<span class="gp-cc-mic"><button type="button" data-instalar="">Instalar MaKo<\/button><\/span>/, 'en el lugar del micrófono');
  assert.match(bloqueada, new RegExp(`placeholder="${FRASE_APP}"`), 'el campo dice qué falta');
  assert.match(bloqueada, /<textarea[^>]* disabled=""/, 'el campo apagado');
});

test('5. la respuesta del servidor: sólo `bloquea` bloquea; sin saberla, no', () => {
  assert.equal(leerRespuestaApp(true, { ok: true, app: 'bloquea' }), 'bloquea');
  assert.equal(leerRespuestaApp(true, { ok: true, app: 'en-la-computadora' }), 'en-la-computadora');
  assert.equal(leerRespuestaApp(true, { ok: true, app: 'tiene' }), 'tiene');
  assert.equal(leerRespuestaApp(false, { app: 'bloquea' }), 'tiene', 'un error del servidor no le tapa el chat a nadie');
  assert.equal(leerRespuestaApp(true, null), 'tiene');
  assert.equal(leerRespuestaApp(true, { app: 'otra' }), 'tiene');
});

// PROBADO ROMPIÉNDOLO (25/10/2026, base 5/0), de a una y restaurando:
//   · el asesor de WhatsApp sin `bloqueo` en su caja                       → 4/1 (1)
//   · una pantalla nueva con <CajaChat> que no está en ninguna lista       → 4/1 (1)
//   · `laApp` dejando otra vez afuera a la plataforma                      → 4/1 (3)
//   · la caja de pedido bloqueada con su ↑                                 → 4/1 (4)
//   · Offer bloqueando también el onboarding                               → 4/1 (2)
// (30/10/2026, base 6/0):
//   · «Probar nuevo diseño» arrancando sin esperar la respuesta            → 5/1 (2b)
//   · AskAgent dibujando el campo aunque falte la app                      → 5/1 (2b)
