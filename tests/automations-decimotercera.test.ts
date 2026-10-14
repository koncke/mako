// =============================================================================
// Decimotercera tanda de Automations (12/10/2026): los 8 puntos de Martín con capturas de hola-mako.com/automations
// =============================================================================
// El pedido literal, en el último hito de app/admin/dev/chatbot/bitacora.ts. Lo que se fija acá (lo puro se EJECUTA; el
// cableado, en el fuente sin comentarios y en LF):
//   1. la barra de «Pídeselo a MaKo»: el alto del campo no se colapsa en el primer render del modal (que la pila pinta
//      con `display: none`), y el ejemplo que se escribe solo sigue andando;
//   2. al enviar: la fila nace YA por la puerta de «Nueva» y su lienzo abre con el chat de MaKo y el pedido puesto, que
//      el chat manda como CREAR sobre esa fila;
//   3. «Probar» frena con un medio sin conectar, con la MISMA cuenta que Publicar (`medioQueFrena`);
//   4. el logo de MaKo, no la estrella (en la barra y en el panel del ✦);
//   5. Zernio se conecta con EL modal de Integraciones (lo fija tests/zernio-conectar.test.ts);
//   6. el chat es el hilo de WhatsApp (`ChatHilo`) con los colores de MaKo, sin clip;
//   7. el ✦ de cada tarjeta anota en el chat de MaKo, con la tarjeta;
//   8. el ✦ también en el email y en los DM, y lo que pide cambia por canal.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatMako, BarraPideselo, hiloDeChat, ROTULO_TARJETA, VACIO_CREAR, ESTADO_EN_LINEA, COLORES_MAKO } from '../app/automations/ChatMako';
import { PLACEHOLDER_QUIETO } from '../app/automations/CrearConIA';
import { EditorEmailGmail } from '../app/automations/EditorEmailGmail';
import { decidirVisible } from '../app/_components/pila-modales';
import { sanearMensaje, TOPE_TARJETA_CHAT, type MensajeChatMako } from '../lib/automatizacion-chat';
import { textoDeCreada } from '../lib/flujo-ia-cliente';
import { textoDeCreada as textoDeCreadaServer } from '../lib/flujo-ia-preguntas';
import { medioQueFrena, MOTIVO_MEDIO } from '../lib/medios-automatizacion';
import {
  pedidoDeRedacta, redactaSystem, revisarRedacta, textoDePropuestaParaChat, pedidoParaChat, TOPE_ASUNTO_REDACTA,
} from '../lib/mako-redacta';
import { TOPE_TEXTO_SOCIAL } from '../lib/canal-social';
import { marcasDeVoseo } from '../lib/puestas-data';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const fuente = (r: string) => sinComentarios(leer(r));
const tramo = (src: string, desde: string, hasta: string, tope = 4_000): string => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no está «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no está el cierre «${hasta}»`);
  assert.ok(j - i <= tope, `el tramo de «${desde}» mide ${j - i} (> ${tope})`);
  return src.slice(i, j + hasta.length);
};

const CHAT = fuente('app/automations/ChatMako.tsx');
const PERFIL = fuente('app/automations/SecuenciaPerfil.tsx');
const APP = fuente('app/automations/ChatAgentApp.tsx');
const LISTA = fuente('app/automations/SimuladorWhatsApp.tsx');
const AT = '2026-10-12T05:00:00.000Z';

// ── 1. La barra: el alto del campo y el ejemplo que se escribe ───────────────────────────────────

test('punto 1: el modal se pinta con display:none en su PRIMER render; la barra mide con el borde y no colapsa', () => {
  // ⚠️ La causa (el diagnóstico obvio, «se borró la animación», era el equivocado): un modal recién montado todavía no
  // está en la pila, y la pila lo pinta oculto. El efecto del hijo corre antes y mide un `scrollHeight` de 0.
  assert.equal(decidirVisible([], 'nuevo', new Set(), new Set()), false);
  assert.match(fuente('app/_ui/Modal.tsx'), /display: capa\.visible \? 'flex' : 'none'/);
  // DECIMOCUARTA (punto 2): la barra es la caja del Landing Generator (`CajaPedido`). Escondida no se mide: con un
  // `scrollHeight` de 0 deja el alto natural (rows 2) en vez de fijar 0, y su `min-height` tampoco la deja colapsar.
  const caja = fuente('app/landing-generator/CajaPedido.tsx');
  assert.match(caja, /if \(!t\.scrollHeight\) return;\n\s+t\.style\.height = `\$\{Math\.min\(t\.scrollHeight, 168\)\}px`;/);
  assert.match(caja, /\.gp \.gp-cc-entrada \{ display: block; width: 100%; min-height: 64px;/);
  assert.match(CHAT, /<CajaPedido titulo=\{\{ texto: TITULO_CAJA, nivel: 2 \}\} valor=\{texto\}/);
  assert.doesNotMatch(CHAT, /t\.style\.height = `\$\{Math\.min\(t\.scrollHeight, 132\)\}px`/, 'volvió la medida sin el borde');
  // El ejemplo se escribe en el placeholder (para con el foco y vuelve al salir sin escribir: tests/crear-ia-tercera.test.ts).
  const html = renderToStaticMarkup(createElement(BarraPideselo, { onPedido: () => {} }));
  assert.match(html, /<textarea[^>]*placeholder="Confirmar la reunión un día antes y avisarme si no contesta"/);
  assert.match(html, /aria-label="Qué tiene que hacer la automatización"/, 'el lector de pantalla oye el ejemplo que cambia');
});

// ── 2. Al enviar: la fila YA y el lienzo con MaKo trabajando adentro ─────────────────────────────

test('punto 2: «Pídeselo a MaKo» cierra el modal y crea la fila por la puerta de «Nueva», con el pedido para su chat', () => {
  assert.match(APP, /const pedirAMako = \(pedido: string\) => \{\n {4}setGaleria\(false\);\n {4}void crearNueva\(pedido\);\n {2}\};/);
  const crear = tramo(APP, 'const crearNueva = async (pedido?: string) => {', '\n  };', 1_900);
  // La fila aparece ANTES del POST; el pedido viaja con el id real ANTES del load (la lista la sigue por su clave).
  const iFila = crear.indexOf('setCreando({ temporal, id: null });');
  const iPost = crear.indexOf("fetch('/api/chat-agent/secuencias'");
  const iPedido = crear.indexOf('setAbrirSec({ id, mako: true, pedido })');
  const iLoad = crear.indexOf('await load();');
  assert.ok(iFila >= 0 && iFila < iPost && iPost < iPedido && iPedido < iLoad, 'el orden fila → POST → pedido → load se rompió');
  // Si la fila no se pudo crear, el pedido no se pierde: vuelve a la barra de la galería.
  assert.match(crear, /if \(pedido\) setPedidoSinCrear\(pedido\);/);
  assert.match(APP, /onPedirAMako=\{pedirAMako\} pedidoInicial=\{pedidoSinCrear\}/);
  // La lista pasa el pedido al lienzo de ESA fila, y el lienzo al chat (que se abre por `makoAlAbrir`).
  assert.match(LISTA, /setPedidoPara\(abrir\.pedido \? \{ id: abrir\.id, pedido: abrir\.pedido \} : null\);/);
  assert.match(LISTA, /pedidoAlAbrir=\{pedidoPara\?\.id === sel\.id \? pedidoPara\.pedido : null\}/);
  assert.match(PERFIL, /pedidoInicial=\{pedidoPendiente\} onPedidoInicialUsado=\{\(\) => setPedidoPendiente\(null\)\}/);
  // El chat lo manda UNA vez, como crear sobre esta fila (lienzo vacío), y no pide un chat guardado que no existe.
  const pedidoEf = tramo(CHAT, 'const pedidoInicial = p.pedidoInicial?.trim() || null;', '}, [pedidoInicial]);', 700);
  assert.match(pedidoEf, /if \(!pedidoInicial \|\| pedidoUsado\.current === pedidoInicial\) return;/);
  assert.match(pedidoEf, /void turnoRef\.current\(pedidoInicial, null, 'afuera'\);/);
  // 13/10/2026: crea sólo si TAMBIÉN lo publicado está vacío (si no, el server contesta 409: tests/automations-pendientes-decimotercera.test.ts).
  assert.match(CHAT, /const crea = p\.pasos\.length === 0 && !\(p\.publicadas \?\? 0\);/);
  assert.match(tramo(CHAT, 'const turno = async (', '\n  };', 7_000), /const modo = crea \? 'crear' : 'editar';/);
  assert.match(CHAT, /useEffect\(\(\) => \{\n\s+if \(conPedido\) return;/);
  // La ruta crea SOBRE la fila (vacía y pausada) y anota el turno y el final en SU chat.
  const ruta = fuente('app/api/chat-agent/secuencias/ia/route.ts');
  assert.match(ruta, /const sinId = modo === 'crear' && \(body\.secuenciaId == null \|\| body\.secuenciaId === ''\);/);
  assert.match(ruta, /await anotar\(\[mensajeChat\('mako', textoDeCreada\(r\.nombre\), 'app', \{ avisos: r\.avisos \}\)\]\);/);
  // Lo que dice MaKo al crear lo dice IGUAL el chat de la pantalla y el que guarda el server.
  assert.equal(textoDeCreada('Bienvenida'), textoDeCreadaServer('Bienvenida'));
  assert.match(CHAT, /texto: l\.modo === 'crear' \? textoDeCreada\(l\.nombre\) : textoDeListo\(l\)/);
});

test('punto 2: «que dentro aparezca un loader»: la capa con «Creando tu automatización» en el lienzo vacío', () => {
  const capa = tramo(PERFIL, '{rolAdmin && chatTrabajando && (', '{rolAdmin && editandoIA && (', 1_600);
  assert.match(capa, /\{pasos\.length === 0 && \(\n\s+<div data-creando-mako="" /);
  assert.match(capa, /Creando tu automatización/);
  // Mientras la fila todavía se crea, el lienzo también lo dice (no un «Creando…» a secas).
  assert.match(LISTA, /\{pedidoPara \? 'Creando tu automatización' : 'Creando…'\}/);
  // Sin el chat no hay pedido: el ✦ del título está también con el lienzo vacío.
  assert.match(PERFIL, /\{rolAdmin && \(\n\s+<BotonLogoMako lado=\{ALTO_ACCION\}/);
  // El hilo vacío de una fila nueva dice qué hacer, y la barra lo mismo.
  const html = renderToStaticMarkup(createElement(ChatMako, { secuenciaId: 7, pasos: [], onListo: () => {} }));
  assert.ok(html.includes(VACIO_CREAR));
  assert.match(html, new RegExp(`<textarea[^>]*placeholder="${PLACEHOLDER_QUIETO}"`));
});

// ── 3. «Probar» frena con un medio sin conectar ───────────────────────────────────────────────────

const P = (o: Record<string, unknown>) => ({ canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', ...o }) as unknown as PasoGrafo;

test('punto 3: `medioQueFrena` = la cuenta de Publicar, con la línea de la tarjeta; «no pude» no frena', () => {
  const ig = P({ id: 'a', canal: 'instagram' });
  const wa = P({ id: 'b', linea: 'mako_ws1_b' });
  const sinIg = { instagram: { conectado: false, motivo: MOTIVO_MEDIO.instagram } };
  assert.deepEqual(medioQueFrena([ig], null, [], sinIg), { medio: 'instagram', linea: null, error: 'Conecta tu Instagram' });
  // Sin la lectura, o con «no pude comprobarlo», no frena (conectar no lo arregla).
  assert.equal(medioQueFrena([ig], null, [], undefined), null);
  assert.equal(medioQueFrena([ig], null, [], { instagram: { conectado: null } }), null);
  assert.equal(medioQueFrena([ig], null, [], { instagram: { conectado: true } }), null);
  // El CRON cuenta: un CRON de Instagram con tarjetas de WhatsApp conectado.
  const waOk = { whatsapp: { porDefecto: { conectado: true }, lineas: {} } };
  assert.equal(medioQueFrena([P({ id: 'c' })], null, [{ trigger_tipo: 'instagram' }], { ...waOk, ...sinIg })?.medio, 'instagram');
  // La línea que frena es la de ESA tarjeta (para abrir su QR), no la de la automatización.
  const otraCaida = { whatsapp: { porDefecto: { conectado: true }, lineas: { mako_ws1_b: { conectado: false } } } };
  assert.deepEqual(medioQueFrena([wa], null, [], otraCaida), { medio: 'whatsapp', linea: 'mako_ws1_b', error: MOTIVO_MEDIO.whatsapp });
  // Publicar y Activar (el server) usan la MISMA función.
  assert.match(fuente('lib/disparadores-canales.ts'), /const f = medioQueFrena\(pasos, linea, disparadores, estado\);/);
});

test('punto 3: «Probar» pregunta ANTES de abrir el panel, dice qué falta y abre el modal de ese medio', () => {
  const probar = tramo(PERFIL, 'const probar = (canal: CanalProbar) => {', '\n  };', 700);
  const iFreno = probar.indexOf('medioQueFrena(pasos, lineaSec, crons.lista, estadoMedios)');
  const iAbrir = probar.indexOf('onProbar(canal);');
  assert.ok(iFreno > 0 && iFreno < iAbrir, 'el panel se abre sin mirar los medios');
  // Decimocuarta (punto 4): sin el chip rojo «Conecta tu …» al lado de «Activar»; el modal de ese medio dice qué falta.
  assert.match(probar, /if \(falta\) \{ setErr\(null\); setLineaAConectar\(falta\.linea\); setConectarMedio\(falta\.medio\); return; \}/);
  // La MISMA lectura que el chip «Sin conectar» de la tarjeta, con las tarjetas y el CRON.
  assert.match(PERFIL, /const usaMedios = useMemo\(\(\) => mediosQueUsa\(pasos, crons\.lista\), \[pasos, crons\.lista\]\);/);
  assert.match(PERFIL, /const estadoMedios = useEstadoMedios\(usaMedios, rolAdmin && !!onProbar\);/);
  for (const m of Object.values(MOTIVO_MEDIO)) assert.deepEqual(marcasDeVoseo(m), [], m);
});

// ── 4 y 6. El logo y el chat de WhatsApp ─────────────────────────────────────────────────────────

const yo = (id: string, texto: string, o: Partial<MensajeChatMako> = {}): MensajeChatMako => ({ id, de: 'yo', texto, at: AT, via: 'app', ...o });
const mako = (id: string, texto: string, o: Partial<MensajeChatMako> = {}): MensajeChatMako => ({ id, de: 'mako', texto, at: AT, via: 'app', ...o });

test('punto 6: el chat ES el hilo de WhatsApp (ChatHilo) con los colores de MaKo, el logo, «en línea», y sin clip', () => {
  assert.match(CHAT, /import \{ ChatHilo, type HiloMsg \} from '@\/app\/whatsapp\/_shared\/ChatHilo';/);
  assert.match(CHAT, /<ChatHilo\n\s+mensajes=\{hilo\}/);
  const html = renderToStaticMarkup(createElement(ChatMako, {
    secuenciaId: 7, pasos: [P({ id: 'm1' })], onListo: () => {}, inicial: [yo('y1', 'Cambia el saludo'), mako('m1', 'Cambié 1')],
  }));
  assert.ok(html.includes(`border-top:3px solid ${COLORES_MAKO.cinta}`), 'sin la cinta de MaKo');
  assert.ok(html.includes(`background:${COLORES_MAKO.burbuja};border:1px solid ${COLORES_MAKO.borde}`), 'la burbuja propia no es la de MaKo');
  assert.match(html, /aria-label="MaKo"/, 'sin el logo de MaKo en la cabecera');
  assert.ok(html.includes(`>${ESTADO_EN_LINEA}<`));
  assert.match(html, /aria-label="Emojis"/);
  assert.match(html, /aria-label="Grabar nota de voz"/);
  assert.doesNotMatch(html, /aria-label="Adjuntar archivo"/, 'un clip que MaKo no recibe');
  assert.doesNotMatch(html, />✦</, 'volvió la estrella de texto');
  // La ➤ con el color de MaKo, y la nota de voz se transcribe (no viaja como archivo).
  assert.match(CHAT, /acentoEnviar=\{COLORES_MAKO\.enviar\}/);
  assert.match(CHAT, /onEnviarAudio=\{\(b\) => enviarAudio\(b\)\}/);
  assert.match(tramo(CHAT, 'const enviarAudio = async (blob: Blob)', '\n  };', 700), /const r = await transcribirNota\(blob\);/);
});

// DECIMOCUARTA (punto 2): la caja del modal es la del Landing Generator, sin cabecera (ni logo, ni título, ni «Nace
// pausada»): de este punto queda el panel del ✦ y que la estrella de texto no vuelva.
test('punto 4: el logo de MaKo en el panel del ✦, no la estrella de texto (la caja del modal, sin cabecera)', () => {
  const barra = renderToStaticMarkup(createElement(BarraPideselo, { onPedido: () => {} }));
  assert.doesNotMatch(barra, /Nace pausada/);
  assert.doesNotMatch(barra, />✦</);
  const panel = fuente('app/automations/MakoRedacta.tsx');
  assert.match(panel, /<MakoLogo size=\{20\} animate=\{false\} \/>/);
  assert.doesNotMatch(panel, />✦ MaKo</);
});

// ── 7. El historial del ✦ ────────────────────────────────────────────────────────────────────────

test('punto 7: un pedido del ✦ lleva su tarjeta, y el hilo dice en cuál se apretó', () => {
  // `tarjeta` sobrevive al saneo (con su tope); lo que no es un texto se cae solo, y el mensaje se sigue viendo.
  const m = sanearMensaje({ id: 'y1', de: 'yo', texto: 'Que agende', at: AT, via: 'app', tarjeta: `  WHATSAPP: Hola  ${'x'.repeat(300)}` });
  assert.ok(m?.tarjeta?.startsWith('WHATSAPP: Hola'));
  assert.equal(m?.tarjeta?.length, TOPE_TARJETA_CHAT);
  assert.equal(sanearMensaje({ id: 'y2', de: 'yo', texto: 'x', at: AT, via: 'app', tarjeta: 7 })?.tarjeta, undefined);
  // El hilo: la línea de sistema ANTES del pedido de esa tarjeta, y nada antes de un turno del chat.
  const hilo = hiloDeChat([yo('y1', 'Que agende', { tarjeta: 'WHATSAPP: Hola' }), mako('m1', 'Hola, ¿agendamos?', { tarjeta: 'WHATSAPP: Hola' }), yo('y2', 'Cambia el saludo')]);
  assert.deepEqual(hilo.map((h) => [h.tipo ?? 'burbuja', h.fromMe, h.texto]), [
    ['sistema', false, `${ROTULO_TARJETA} «WHATSAPP: Hola»`],
    ['burbuja', true, 'Que agende'],
    ['burbuja', false, 'Hola, ¿agendamos?'],
    ['burbuja', true, 'Cambia el saludo'],
  ]);
  // Lo que entra al chat: el pedido (o lo que hizo) y lo que propuso, el mismo texto del recuadro.
  assert.equal(pedidoParaChat({ pedido: '  ' }), 'Mejóralo');
  assert.equal(textoDePropuestaParaChat({ mensajes: ['Hola', '¿Agendamos?'], audio: 'Te cuento', asunto: null }), 'Hola\n\n¿Agendamos?\n\nNota de voz: «Te cuento»');
  assert.equal(textoDePropuestaParaChat({ mensajes: ['Cuerpo'], audio: null, asunto: 'Tu visita' }), 'Asunto: Tu visita\n\nCuerpo');
  for (const s of [ROTULO_TARJETA, pedidoParaChat({ pedido: '' }), textoDePropuestaParaChat({ mensajes: [], audio: null, asunto: null })]) {
    assert.deepEqual(marcasDeVoseo(s), [], s);
  }
});

test('punto 7: la ruta del ✦ anota en el chat de ESA automatización (de este workspace) y el chat abierto lo suma', () => {
  const ruta = fuente('app/api/chat-agent/redactar/route.ts');
  assert.match(ruta, /if \(p\.secuenciaId == null \|\| !p\.tarjeta\) return undefined;/);
  assert.match(ruta, /if \(!\(await secuenciaDelWorkspace\(ws, p\.secuenciaId\)\)\) return undefined;/);
  assert.match(ruta, /mensajeChat\('yo', pedidoParaChat\(p\), 'app', \{ tarjeta: p\.tarjeta \}\),\n\s+mensajeChat\('mako', respuesta, 'app', \{ tarjeta: p\.tarjeta \}\),/);
  // También si no pudo (el error queda en el historial).
  assert.match(ruta, /const chat = await anotarEnChat\(ws, p, error\);/);
  assert.match(ruta, /const chat = await anotarEnChat\(ws, p, textoDePropuestaParaChat\(listo\)\);/);
  // La pertenencia la mira la base con el workspace del pedido.
  assert.match(fuente('lib/automatizacion-chat-db.ts'), /\.from\('nutricion_secuencias'\)\.select\('id'\)\n\s+\.eq\('workspace_id', ws\)\.eq\('id', secuenciaId\)\.maybeSingle\(\);/);
  // El panel manda la tarjeta y avisa al chat; el chat escucha a SU automatización.
  const panel = fuente('app/automations/MakoRedacta.tsx');
  assert.match(panel, /\.\.\.\(historial \? \{ secuenciaId: historial\.secuenciaId, tarjeta: historial\.tarjeta \} : \{\}\),/);
  assert.match(panel, /if \(historial && j\?\.chat\) avisarChatMako\(historial\.secuenciaId, j\.chat\);/);
  assert.match(CHAT, /useEscucharChatMako\(secId, useCallback\(\(ms: MensajeChatMako\[\]\) => setMensajes\(\(locales\) => juntarHilo\(locales, ms\)\), \[\]\)\);/);
  // La tarjeta se nombra como se lee en el lienzo, y le llega a los CUATRO editores.
  const flujo = fuente('app/automations/FlujoLienzo.tsx');
  assert.match(flujo, /const chatDe = \(id: string\) => \(pr\.secuenciaId \? \{ secuenciaId: pr\.secuenciaId, tarjeta: nombreDeTarjeta\(pr\.pasos, id\) \} : null\);/);
  assert.match(flujo, /<EditorMako key=\{`mako-\$\{id\}`\} \{\.\.\.pr\} paso=\{paso\} id=\{id\} chatMako=\{chatDe\(id\)\} \/>/);
  assert.match(flujo, /<EditorMensaje \{\.\.\.pr\} paso=\{paso\} id=\{id\} cambiar=\{cambiar\} chatMako=\{chatDe\(id\)\} \/>/);
  assert.equal((flujo.match(/chat: chatDe\(id\) \} : null/g) ?? []).length, 2, 'el email y los DM no anotan');
  assert.match(fuente('app/automations/EditorMensajeWhatsApp.tsx'), /historial=\{chatMako\}/);
});

// ── 8. El ✦ en todos los canales, distinto por canal ─────────────────────────────────────────────

test('punto 8: el pedido trae el canal; la nota de voz es SÓLO de WhatsApp', () => {
  const base = { pedido: 'que agende', actual: '', permiteAudio: true };
  assert.equal(pedidoDeRedacta(base)?.canal, 'whatsapp', 'sin canal, WhatsApp como siempre');
  assert.equal(pedidoDeRedacta(base)?.permiteAudio, true);
  for (const canal of ['email', 'instagram', 'messenger'] as const) {
    const p = pedidoDeRedacta({ ...base, canal });
    assert.equal(p?.canal, canal);
    assert.equal(p?.permiteAudio, false, `${canal} no lleva nota de voz`);
  }
  assert.equal(pedidoDeRedacta({ ...base, canal: 'sms' })?.canal, 'whatsapp', 'un canal que no existe');
  // El historial: el id entero y positivo, y la tarjeta recortada.
  const h = pedidoDeRedacta({ ...base, secuenciaId: '12', tarjeta: 'EMAIL: Tu visita' });
  assert.deepEqual([h?.secuenciaId, h?.tarjeta], [12, 'EMAIL: Tu visita']);
  assert.equal(pedidoDeRedacta({ ...base, secuenciaId: -3 })?.secuenciaId, null);
});

test('punto 8: cada canal su system: el email pide asunto y cuerpo; un DM, corto y sin audio; WhatsApp, el de siempre', () => {
  const wa = redactaSystem('motor', 'whatsapp');
  const email = redactaSystem('motor', 'email');
  const ig = redactaSystem('motor', 'instagram');
  const ms = redactaSystem('motor', 'messenger');
  assert.equal(wa, redactaSystem('motor'), 'WhatsApp cambió');
  assert.match(email, /"asunto"/);
  assert.match(email, /"cuerpo"/);
  assert.doesNotMatch(email, /NOTA DE VOZ|"audio"/);
  assert.match(ig, /DM\) de Instagram/);
  assert.match(ms, /DM\) de Messenger/);
  assert.doesNotMatch(ig, /"audio"/);
  for (const s of [email, ig, ms]) {
    assert.ok(!s.includes('{{variables}}') && !s.includes('{{red}}'), 'quedó un hueco sin llenar');
    assert.ok(s.includes('{{nombre}}'), 'sin los datos del lead');
  }
  // El aviso al EQUIPO sigue con el suyo, por el canal que sea.
  assert.equal(redactaSystem({ destino: 'equipo', conLead: true }, 'email'), redactaSystem({ destino: 'equipo', conLead: true }));
});

test('punto 8: lo que vuelve se revisa por canal (asunto, un cuerpo, DM cortos), con las reglas de siempre', () => {
  const permitido = 'Vendo casas';
  // Email: UN cuerpo y el asunto, sin audio aunque venga.
  const e = revisarRedacta({ asunto: 'Tu  visita\n del lunes', cuerpo: 'Hola {{nombre}},\n\nTe espero.', audio: 'hola' }, permitido, false, 'motor', 'email');
  assert.deepEqual([e.asunto, e.mensajes, e.audio], ['Tu visita del lunes', ['Hola {{nombre}},\n\nTe espero.'], null]);
  // Un asunto con link o con voseo se descarta (el cuerpo queda).
  const malo = revisarRedacta({ asunto: 'Mirá https://x.io', cuerpo: 'Hola' }, permitido, false, 'motor', 'email');
  assert.equal(malo.asunto, null);
  assert.equal(malo.mensajes.length, 1);
  assert.equal(revisarRedacta({ asunto: 'Si querés, agendá', cuerpo: 'Hola' }, permitido, false, 'motor', 'email').asunto, null);
  assert.ok(revisarRedacta({ asunto: 'x'.repeat(400), cuerpo: 'Hola' }, permitido, false, 'motor', 'email').asunto!.length <= TOPE_ASUNTO_REDACTA);
  // DM: hasta dos, cada uno con el tope de un DM; WhatsApp, hasta tres.
  const largos = ['a'.repeat(1_500), 'b', 'c', 'd'];
  const dm = revisarRedacta({ mensajes: largos }, permitido, false, 'motor', 'instagram');
  assert.equal(dm.mensajes.length, 2);
  assert.equal(dm.mensajes[0].length, TOPE_TEXTO_SOCIAL);
  assert.equal(dm.asunto, null);
  assert.equal(revisarRedacta({ mensajes: largos }, permitido, true, 'motor', 'whatsapp').mensajes.length, 3);
  // Lo de siempre vale en todos: un link inventado se descarta con su motivo.
  const link = revisarRedacta({ cuerpo: 'Entra a https://inventado.com' }, permitido, false, 'motor', 'email');
  assert.equal(link.mensajes.length, 0);
  assert.match(link.descartes.join(' '), /link que MaKo no tiene/);
});

test('punto 8: el email y los DM tienen el ✦ (el botón de la casa) y su panel con el canal; sin `mako`, no', () => {
  const props = { asunto: 'Tu visita', cuerpo: 'Hola', onChange: () => {} };
  const con = renderToStaticMarkup(createElement(EditorEmailGmail, { ...props, mako: { disparador: 'Cuando agenda', chat: { secuenciaId: 7, tarjeta: 'EMAIL: Tu visita' } } }));
  assert.match(con, /title="Que MaKo te ayude a escribirlo"/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(EditorEmailGmail, props)), /Que MaKo te ayude a escribirlo/);
  const email = fuente('app/automations/EditorEmailGmail.tsx');
  assert.match(email, /<MakoRedacta canal="email" datos="motor" permiteAudio=\{false\} historial=\{mako\.chat \?\? null\}/);
  // «Usar» pone asunto y cuerpo de UNA vez (un deshacer), en el editor visual.
  assert.match(tramo(email, 'const usarSugerencia = () => {', '\n  };', 700), /onChange\(\{ \.\.\.\(s\.asunto \? \{ asunto: s\.asunto \} : \{\}\), cuerpo_html: html, cuerpo: texto \}\);/);
  const social = fuente('app/automations/EditorMensajeSocial.tsx');
  assert.match(social, /<MakoRedacta canal=\{canal\} datos="motor" permiteAudio=\{false\} historial=\{mako\.chat \?\? null\}/);
  // Decimocuarta (punto 8): el ✦ del DM va en la CABECERA del panel, al lado del desplegable de la cuenta, como en
  // WhatsApp (el mismo botón y el mismo estado por tarjeta).
  assert.match(social, /\{conMako && <BotonMakoWhatsApp clave=\{claveDeTarjeta\(ws, paso\)\} deshabilitado=\{deshabilitado\} \/>\}/);
  assert.match(social, /const panelMako = usePanelMako\(claveMako\) && !!mako;/);
  // «Usar» y «Agregar» con la MISMA función que la barra del WhatsApp.
  assert.match(social, /const sig = propuestaALista\(partesDe\(pasoVivo\.current\), sugerencia\.mensajes, modo\);/);
  // El panel pregunta según el canal, en tú.
  assert.match(fuente('app/automations/MakoRedacta.tsx'), /placeholder=\{PLACEHOLDER_REDACTA\[canal\]\}/);
});

// ── ROTURAS (12/10/2026) ──────────────────────────────────────────────────────────────────────────
// Una por vez, con scratchpad/agente-13/romper.mjs (guarda el original en memoria, rompe, corre ESTE archivo y restaura
// comprobando el sha1; nunca git). Base: 13 pass / 0 fail.
//   R1.  la barra mide sin el borde (la medida vieja)                              → 12 / 1 (punto 1)
//   R2.  la fila nace sin el pedido para su chat                                   → 12 / 1 (punto 2, «Pídeselo»)
//   R3.  el chat edita siempre (no crea sobre la fila vacía)                       → 12 / 1 (punto 2, «Pídeselo»)
//   R4.  el pedido inicial se manda cada vez (sin la guarda)                       → 12 / 1 (punto 2, «Pídeselo»)
//   R5.  «Probar» abre sin mirar los medios                                        → 12 / 1 (punto 3, «Probar»)
//   R6.  `medioQueFrena` sin el CRON                                               → 12 / 1 (punto 3, la cuenta)
//   R7.  el chat con clip (MaKo «recibe» archivos)                                 → 12 / 1 (punto 6)
//   R8.  el hilo sin la línea de la tarjeta                                        → 12 / 1 (punto 7, el hilo)
//   R9.  `sanearMensaje` pierde la tarjeta                                         → 12 / 1 (punto 7, el hilo)
//   R10. la ruta del ✦ anota sin mirar que la automatización sea del workspace     → 12 / 1 (punto 7, la ruta)
//   R11. el email puede proponer nota de voz                                       → 12 / 1 (punto 8, el pedido)
//   R12. el system del DM con `replace` (llena sólo el primer {{red}})             → 12 / 1 (punto 8, el system)
//        (fue un bug de verdad: lo encontró este test en la primera corrida)
//   R13. un DM acepta tres mensajes                                                → 12 / 1 (punto 8, la revisión)
//   R14. el ✦ del email sin `mako` (para quien sólo mira)                          → 12 / 1 (punto 8, los editores)
//   R15. la estrella de texto vuelve a la barra del modal                          → 12 / 1 (punto 4)
//   R16. Publicar (server) y Probar cuentan distinto                               → 12 / 1 (punto 3, la cuenta)
// Restaurado: 13 / 0.
