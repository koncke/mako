// =============================================================================
// Toda caja de chat de MaKo adjunta y arrastra todos los formatos, y MaKo los LEE (ticket #16 de Leila, 27/10/2026)
// =============================================================================
// Leila (ws11): «No me deja adjuntar un documento ni por arrastrar, ni por adjuntar». Martín: «revisa que todos los chats
// acepten todos los formatos». El inventario del 27/10 (docs/hallazgos-second-brain.md): el Second Brain del cliente y el
// Analyst del lead sólo tomaban fotos y PDF; Media Buyer, Dashboard, Image y Video Editor, Soporte y el asesor de WhatsApp no
// adjuntaban nada; y arrastrar sólo andaba en el Ops Center de la plataforma y en Chats. Lo que fija:
//   1. lo puro (lib/chat-formatos.ts): el `accept` de la caja toma TODO lo requerido; el de antes del Second Brain, no;
//      un archivo que MaKo no lee o muy pesado se dice; el path que lee la ruta es sólo de ESE workspace;
//   2. `juntarAdjuntos` (app/_chat/juntar-adjuntos.ts): lo que la pantalla toma va a SUS adjuntos y lo demás a los que lee la caja;
//   3. EL RECORRIDO: cada <CajaChat> de app/ adjunta todo (sólo Chats, que le manda archivos a un lead, va con
//      `sinAdjuntos`), la caja toma lo arrastrado, y la ruta que lee corre con la IA del negocio.
//
// Probado rompiéndolo (27/10/2026): al pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACCEPT_CHAT, REQUERIDOS_EN_EL_CHAT, aceptaArchivo, esArchivoParaLeer, faltanEnAccept, porQueNoSeAdjunta, textoDelArchivo } from '../lib/chat-formatos';
import { ACCEPT_ADJUNTOS_CHAT } from '../lib/mako-adjuntos';
import { juntarAdjuntos } from '../app/_chat/juntar-adjuntos';
import type { AdjuntosDeCaja } from '../app/admin/operaciones/AdjuntosCaja';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const archivo = (name: string, type = '') => ({ name, type }) as File;

test('1. el accept de la caja toma TODO lo requerido; el del Second Brain de antes (fotos y PDF), no', () => {
  assert.deepEqual(faltanEnAccept(ACCEPT_CHAT), []);
  assert.ok(faltanEnAccept(ACCEPT_ADJUNTOS_CHAT).includes('.docx'), 'el accept viejo del Second Brain ya tomaba un .docx: ¿cambió?');
  for (const ext of REQUERIDOS_EN_EL_CHAT) assert.ok(aceptaArchivo(ACCEPT_CHAT, archivo(`x${ext}`)), `${ext} no entra`);
  assert.equal(aceptaArchivo('image/*', archivo('foto.png', 'image/png')), true);
  assert.equal(aceptaArchivo('image/jpeg,application/pdf', archivo('propuesta.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')), false);
  assert.equal(porQueNoSeAdjunta('propuesta.docx', '', 1_000), null);
  assert.equal(porQueNoSeAdjunta('nota.mp3', 'audio/mpeg', 1_000), null);
  assert.match(String(porQueNoSeAdjunta('instalador.exe', '', 1_000)), /no sabe leer/);
  assert.match(String(porQueNoSeAdjunta('video.pdf', 'application/pdf', 30 * 1024 * 1024)), /pesa más de/);
  assert.equal(textoDelArchivo('guion.docx', '  Hola  '), 'Archivo «guion.docx»:\nHola');
});

test('1. la ruta que lee sólo toca un archivo de ESE workspace, subido por ella', () => {
  const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
  assert.equal(esArchivoParaLeer(13, `13/chat-leer/${id}`), true);
  assert.equal(esArchivoParaLeer(13, `14/chat-leer/${id}`), false, 'el de otro negocio');
  assert.equal(esArchivoParaLeer(13, `13/offer/${id}`), false, 'el de otra carpeta');
  assert.equal(esArchivoParaLeer(13, `13/chat-leer/../14/x`), false);
});

const propio = (accept: string): AdjuntosDeCaja & { sumados: string[]; quitados: string[] } => {
  const sumados: string[] = []; const quitados: string[] = [];
  return { items: [{ id: 'p1', file: archivo('foto.png', 'image/png'), tipo: 'image', url: '' }], puede: true, accept, sumados, quitados,
    onSumar: (fs) => { sumados.push(...fs.map((f) => f.name)); }, onQuitar: (id) => { quitados.push(id); } };
};

test('2. lo que la pantalla toma va a SUS adjuntos y lo demás lo lee la caja; sin pantalla, todo lo lee la caja', () => {
  const p = propio(ACCEPT_ADJUNTOS_CHAT);
  const l = propio(ACCEPT_CHAT);
  l.items = [{ id: 'l1', file: archivo('guion.docx'), tipo: 'document', url: '' }];
  const j = juntarAdjuntos(p, l)!;
  assert.deepEqual(faltanEnAccept(j.accept ?? ''), [], 'el «+» y lo arrastrado tienen que ofrecer todo');
  assert.ok((j.accept ?? '').startsWith(ACCEPT_CHAT), 'primero lo que MaKo lee');
  // Lo que la pantalla toma de más sigue en el «+»: el .zip de la carpeta de una landing en Offer.
  const offer = propio(`${ACCEPT_ADJUNTOS_CHAT},.zip`);
  const conZip = juntarAdjuntos(offer, l)!;
  assert.match(conZip.accept ?? '', /,\.zip$/, 'el «+» perdió lo que la pantalla toma de más');
  conZip.onSumar([archivo('landing.zip', 'application/zip')]);
  assert.deepEqual(offer.sumados, ['landing.zip'], 'el .zip va a la pantalla, que lo sabe abrir');
  assert.deepEqual(j.items.map((x) => x.id), ['p1', 'l1']);
  j.onSumar([archivo('foto2.jpg', 'image/jpeg'), archivo('propuesta.docx'), archivo('ventas.xlsx'), archivo('nota.mp3', 'audio/mpeg')]);
  assert.deepEqual(p.sumados, ['foto2.jpg'], 'la foto va a la pantalla (su motor la ve como imagen)');
  assert.deepEqual(l.sumados, ['propuesta.docx', 'ventas.xlsx', 'nota.mp3'], 'lo que la pantalla no toma lo lee la caja');
  j.onQuitar('l1'); j.onQuitar('p1');
  assert.deepEqual([p.quitados, l.quitados], [['p1'], ['l1']]);
  assert.equal(juntarAdjuntos(undefined, l), l, 'sin adjuntos propios, los de la caja');
  assert.equal(juntarAdjuntos(p, undefined), p, 'con `sinAdjuntos`, sólo los de la pantalla');
});

function cajasDeChat(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
    const p = `${dir}/${f.name}`;
    if (f.isDirectory()) { if (!/node_modules|admin\/dev$/.test(p)) out.push(...cajasDeChat(p)); continue; }
    if (/\.tsx$/.test(f.name) && /<CajaChat\b/.test(fuente(p))) out.push(p);
  }
  return out;
}

test('3. EL RECORRIDO: cada caja de chat adjunta todo, salvo Chats (archivos a un lead), y la caja toma lo arrastrado', () => {
  const cajas = cajasDeChat('app');
  assert.ok(cajas.length >= 15, `encontré ${cajas.length} cajas: ¿cambió cómo se monta CajaChat?`);
  const SIN_ADJUNTOS: Record<string, string> = {
    'app/chats/Composer.tsx': 'lo que se le manda a un lead viaja como archivo, nunca leído y pegado como texto',
    // El guiado de replicar un carrusel (9/11/2026): lo escrito contesta la pregunta de MaKo y no va a ninguna IA; un archivo
    // adjunto no lo leería nadie (lib/cajas-de-chat.ts).
    'app/image-editor/carruseles/ReplicarGuiado.tsx': 'apertura guiada: lo escrito es la respuesta del paso, sin IA',
  };
  for (const c of cajas) {
    const usa = /<CajaChat\b[^>]*\bsinAdjuntos\b/.test(sinComentarios(fuente(c)).replace(/\n/g, ' '));
    assert.equal(usa, !!SIN_ADJUNTOS[c], usa ? `${c} apaga los adjuntos sin estar en la lista con su porqué` : `${c} debería ir con sinAdjuntos`);
  }
  const caja = sinComentarios(fuente('app/_chat/CajaChat.tsx'));
  assert.match(caja, /const leidos = useAdjuntosQueSeLeen\(\{ activo: !p\.sinAdjuntos,/, 'la caja no lee lo que la pantalla no toma');
  assert.match(caja, /const deLaCaja = juntarAdjuntos\(p\.adjuntos, p\.sinAdjuntos \? undefined : leidos\.adjuntos\);/);
  // Quieta (saliendo, apagada o bloqueada), los mismos sin quitar ni sumar (28/10/2026, tests/centro-nuevo-con-adjuntos.test.ts).
  assert.match(caja, /const adjuntos = adjuntosQuietos\(deLaCaja, \{ quieta: quieto, saliendo: enviando, onEspera: avisarEspera, pantallaDiceQueNo: !!p\.adjuntos && !p\.adjuntos\.puede \}\);/);
  assert.match(caja, /onDrop=\{\(e\) => \{ if \(!adjuntos \|\| !traeArchivos\(e\.dataTransfer\)\) return; e\.stopPropagation\(\); alSoltar\(e, adjuntos\); \}\}/, 'la caja no toma lo arrastrado');
  assert.match(caja, /<ListaAdjuntos a=\{adjuntos\} apagado=\{quieto\} \/>/);
  // Lo soltado sobre la CONVERSACIÓN (PanelDeChat) va a los adjuntos de la caja, no sólo a los de la pantalla.
  assert.match(caja, /useAvisarAdjuntos\(adjuntos\);/, 'la caja no le avisa al panel cuáles son sus adjuntos');
  const panel = sinComentarios(fuente('app/admin/operaciones/PanelChat.tsx'));
  assert.match(panel, /const destino = \(\) => enLaCaja\.current \?\? adjuntos;/);
  assert.match(panel, /onDrop=\{\(e\) => \{ setSoltando\(false\); alSoltar\(e, destino\(\)\); \}\}/, 'la conversación suelta en los adjuntos de la pantalla');
  assert.match(panel, /<ContextoSoltar\.Provider value=\{enLaCaja\}>/);
  assert.match(caja, /onMandar=\{onMandar\} titulo=/, 'el botón manda sin leer lo adjuntado');
  const ruta = sinComentarios(fuente('app/api/chat/leer-archivo/route.ts'));
  assert.match(ruta, /conSuIADelNegocio\(ws, \(\) => archivoATexto\(file/, 'la lectura no corre con la IA del negocio');
  assert.match(ruta, /if \(!esArchivoParaLeer\(ws, path\)\)/);
  assert.match(ruta, /await storage\.remove\(\[path\]\)/, 'lo subido para leer queda en el almacenamiento');
});

// ── Probado rompiéndolo (27/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado de memoria:
//   1. `ACCEPT_CHAT` con sólo fotos y PDF (el accept de antes del Second Brain) → rojo el 1 (el accept).
//   2. `juntarAdjuntos` mandando TODO a la pantalla (un Word rebota)           → rojo el 2.
//   3. la caja leyendo sólo donde la pantalla no tiene adjuntos propios       → rojo el 3.
//   4. la conversación (PanelDeChat) soltando en los adjuntos de la pantalla  → rojo el 3.
//   5. `esArchivoParaLeer` aceptando el path de otro negocio                → rojo el 1 (la ruta).
//   6. Chats sin `sinAdjuntos` (leería y pegaría lo que se le manda a un lead) → rojo el 3.
//   7. `juntarAdjuntos` con `accept: ACCEPT_CHAT` solo (el .zip de Offer fuera)  → rojo el 2 (y tests/offer-hilo-unico el 4).
