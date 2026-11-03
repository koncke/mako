// =============================================================================
// El chat del Second Brain: la columna derecha del grafo es una conversación con MaKo (23/10/2026)
// =============================================================================
// Martín: «quiero que Second Brain, la sidebar que tiene a la derecha sea reemplazada por un chat con MaKo, que tenga la criatura
// de MaKo... Que se guarde el historial claro, pero que si no hay nada que MaKo mande el mensaje "Hola NOMBRE. Este es tu Second
// Brain, aquí está toda la información de tu negocio. ¿Qué quieres saber hoy?"».
//   1. el saludo, textual, con el nombre de pila;
//   2. SU conversación: una por persona y negocio (`mako-movil:<persona>:second-brain`), que el Ops Center lista como «Second
//      Brain» y sigue como las de las tabs; la ruta la lee sin crearla y la crea sólo con el primer mensaje;
//   3. la pantalla: el MISMO chat del Ops Center en la columna del grafo, y el detalle de un punto encima.
//
// Correr: node --import tsx --test tests/second-brain-chat-mako.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORIGEN_SECOND_BRAIN, TABS_CON_CHAT_PROPIO, TAB_SECOND_BRAIN, esTabConChatPropio, origenDeClave, referenteDeTab, saludoDelSecondBrain } from '../lib/chat-mako-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. el saludo de MaKo con el chat vacío, textual, con el nombre de pila de quien mira', () => {
  assert.equal(saludoDelSecondBrain('Leandro Tejado'), 'Hola Leandro. Este es tu Second Brain, aquí está toda la información de tu negocio. ¿Qué quieres saber hoy?');
  assert.equal(saludoDelSecondBrain('  Mauricio '), 'Hola Mauricio. Este es tu Second Brain, aquí está toda la información de tu negocio. ¿Qué quieres saber hoy?');
  assert.equal(saludoDelSecondBrain(null), 'Hola. Este es tu Second Brain, aquí está toda la información de tu negocio. ¿Qué quieres saber hoy?', 'sin nombre, sin «NOMBRE»');
});

test('2. una conversación por persona y negocio, que el Ops Center lista como «Second Brain» y que sólo se crea con el primer mensaje', () => {
  assert.equal(TAB_SECOND_BRAIN, 'second-brain');
  // La lista es en POSITIVO: una tab nueva entra a propósito. El 27/10/2026 entró el estudio de Video Generator (su chat al
  // costado, tests/video-estudio-chat.test.ts).
  assert.deepEqual([...TABS_CON_CHAT_PROPIO], ['second-brain', 'video-generator', 'funnel-coach'], 'la ruta no crea conversaciones de una tab cualquiera');
  assert.equal(origenDeClave('mako-movil:u8:second-brain'), ORIGEN_SECOND_BRAIN, 'el grupo del Ops Center (y `claveDeTab` la deja seguir)');
  assert.equal(origenDeClave('mako-movil:u8'), null, 'las de la persona no son de una tab');
  assert.equal(origenDeClave('mako-movil:u8:otra-cosa'), null);
  const srv = sinComentarios(leer('lib/mako-turno-app.ts'));
  const f = srv.slice(srv.indexOf('export async function sesionDeTab('), srv.indexOf('export async function sesionDeTab(') + 700);
  // 3/11/2026 (#16): la guarda es `esTabConChatPropio`, que suma la conversación con cada GURÚ (`referente-<id>`) a la lista fija,
  // y sólo la de un gurú que existe: la ruta sigue sin crear conversaciones de una tab cualquiera.
  assert.match(f, /if \(!esTabConChatPropio\(tab\)\) return null;/);
  for (const t of TABS_CON_CHAT_PROPIO) assert.ok(esTabConChatPropio(t), t);
  assert.ok(esTabConChatPropio('referente-julian-alborna'), 'la conversación con un gurú es una tab con chat propio');
  assert.ok(!esTabConChatPropio('referente-nadie'), 'un gurú que no existe no abre una conversación');
  assert.ok(!esTabConChatPropio('x:referente-julian-alborna'), 'una clave entera no es una tab');
  assert.ok(!esTabConChatPropio('otra-cosa'));
  assert.equal(origenDeClave('mako-movil:u8:referente-julian-alborna'), 'Julián Alborna', 'sin origen, `claveDeTab` no la deja escribir');
  assert.equal(referenteDeTab('mako-movil:u8:referente-emilio-puigrredon'), 'emilio-puigrredon', 'el servidor saca al gurú de la CLAVE');
  assert.equal(referenteDeTab('mako-movil:u8'), null);
  // Y el servidor lo usa: lo que hace gurú a un chat es la clave de su conversación, no la pantalla (retomada desde la lista,
  // sigue siendo con él). Con su ficha en el contexto y su id para que el turno traiga su curso.
  const rutaGuru = sinComentarios(leer('app/api/mako/chat/route.ts'));
  assert.match(rutaGuru, /const guru = referenteDeTab\(quien\.chartKey\);\s*if \(guru\) return \{ contexto: `\$\{CONTEXTO_SECOND_BRAIN\}\\n\\n\$\{contextoDeReferente\(guru\)\}`, referente: guru \};/,
    'el chat de un gurú no lleva su ficha o no le pasa su id al turno');
  // Y la herramienta que pide una clase por id la encuentra: sin `conLosCursosDe`, el id `ref:` que el turno muestra devuelve el índice.
  assert.match(sinComentarios(leer('lib/api-mako/areas/negocio.run.ts')), /recuperar\(await conLosCursosDe\(await grafoParaChat\(\), ids\), \{/,
    'recuperar_del_segundo_cerebro no cuelga el curso del gurú que se le pide por id');
  assert.match(f, /const clave = `\$\{persona\.chartKey\}:\$\{tab\}`;/, 'la clave sale de la persona de la sesión, no del pedido');
  assert.match(f, /return runWithWorkspace\(persona\.ws,/, 'en el negocio de la sesión');
  assert.match(f, /return crear \? aSesion\(await createSession\(clave, null, ''\)\) : null;/);
  const ruta = sinComentarios(leer('app/api/mako/chat/route.ts'));
  assert.match(ruta, /if \(sp\.has\('deTab'\)\) return json\(\{ ok: true, sesion: await sesionDeTab\(persona, sp\.get\('deTab'\) \?\? '', false\) \}\);/, 'leerla no la crea');
  assert.match(ruta, /typeof body\.tab === 'string' \? await sesionDeTab\(persona, body\.tab, true\) : null;/, 'el primer mensaje la crea');
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.equal((motor.match(/postJson<\{ sesion: SesionChat \}>\(\{ action: 'new', \.\.\.\(tabPropia \? \{ tab: tabPropia \} : \{\}\) \}\)/g) ?? []).length, 2, 'con un mensaje y con una nota de voz');
  assert.equal((motor.match(/if \(tabPropia\) setElegido\(\{ antes: sid \}\);/g) ?? []).length, 2, 'se sigue como las de las tabs');
  assert.equal((motor.match(/const deAntes = idAntes != null \|\| tabPropia != null;/g) ?? []).length, 2);
});

test('3. la pantalla: el chat del Ops Center en la columna del grafo, con la estrella, y el detalle de un punto encima', () => {
  const vista = sinComentarios(leer('app/second-brain/VistaCerebro.tsx'));
  assert.match(vista, /const ChatDelSecondBrain = dynamic\(\(\) => import\('\.\/ChatDelSecondBrain'\), \{ ssr: false \}\);/, 'aparte: trae CSS');
  assert.match(vista, /lateral=\{<ChatDelSecondBrain movil=\{movil\} \/>\}/, 'en la computadora y en el teléfono');
  const chat = sinComentarios(leer('app/second-brain/ChatDelSecondBrain.tsx'));
  assert.match(chat, /useChatCliente\(\{ elegido, setElegido, activo: false, entrarAlCerebro: false, [^}]*tab: TAB_SECOND_BRAIN \}\)/, 'el motor del Ops Center');
  assert.match(chat, /<PanelDeChat /, 'el panel del Ops Center');
  assert.match(chat, /<CajaDelCliente k=\{k\}/, 'la caja única');
  assert.match(chat, /aspecto: ASPECTO_MAKO/, 'la criatura de MaKo');
  assert.match(chat, /saludoDelSecondBrain\(nombre\)/);
  assert.match(chat, /fetch\(`\/api\/mako\/chat\?deTab=\$\{TAB_SECOND_BRAIN\}`/, 'su conversación, si ya habló');
  const g = sinComentarios(leer('app/second-brain/Grafo.tsx'));
  assert.match(g, /\{lateral \? \(\n\s*<div className="cbg-detalle cbg-chat"[^>]*>\n\s*\{lateral\}\n\s*\{detalleDelNodo\('cbg-det cbg-det--encima'\)\}/, 'el detalle de un punto, encima del chat');
  assert.match(g, /\) : nodoSel \? \(\n\s*detalleDelNodo\('cbg-detalle cbg-det'\)/, 'sin chat, el detalle de siempre');
});

// PROBADO ROMPIÉNDOLO (23/10/2026, base 3/0):
//   · el saludo sin el «¿Qué quieres saber hoy?»                       → 2/1 (1)
//   · `origenDeClave` sin la regla del Second Brain                    → 2/1 (2)
//   · el GET `deTab` creándola (`true`)                                → 2/1 (2)
//   · VistaCerebro sin `lateral`                                       → 2/1 (3)
