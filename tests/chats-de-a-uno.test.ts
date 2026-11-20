// Los chats con MaKo, de a uno y con sus puntitos (20/11/2026; la auditoría de chats del Cerebro: coaches-1 a 8 y ops-center-4 a 7 y 9):
// la respuesta de un turno sale de a una pieza; el saludo de cada coach espera el momento del video que lo nombra; el saludo del Second
// Brain y del gurú y la apertura, con sus puntitos y su pieza después; el scroll de cada uno, por la clave de su última fila; ChatOffer
// baja con cada mensaje nuevo. (Los grupos: tests/grupos-ops-pantalla.test.ts, 15, lo prueba con el hook de verdad.)
//
// Probado rompiéndolo (20/11/2026, base 5/0; cada rotura da 4/1): la respuesta del turno con setItems; el historial con puntitos; el
// bloque como texto de MaKo; quien dibuja recibe todo; el saludo del coach sin esperar al video; la clase nueva arriba; el coach sin
// bajar al volver del plan; el teléfono sin la portada de Offer; un video del coach sin marcar frases; los arranques junto al saludo;
// el gurú sin bajar al volver a verse; las pestañas sin `seguir`; las píldoras de ChatOffer junto al mensaje; la espera del servidor
// que no cuenta; el turno de Offer sin la cola. (Los botones de la apertura, la apertura sin cola y lo ya dicho que se repite:
// tests/aperturas.test.ts 7. La pieza sin su pausa: tests/cola-de-salida.test.ts 6. El grupo de una: grupos-ops-pantalla 15.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. ops-center-6 y coaches-5: la respuesta de un turno sale de a una pieza; lo que se carga con la conversación, de una', async () => {
  const { filaDeItem } = await import('../app/_chat/fila-del-hilo');
  const msg = (role: 'assistant' | 'user', texto: string) => ({ k: 'msg', id: `m-${role}`, role, texto, at: null }) as never;
  assert.deepEqual(filaDeItem(msg('assistant', 'Hola'), true), { id: 'm-assistant', de: 'mako', texto: 'Hola' }, 'el texto de MaKo, con sus puntitos');
  assert.equal(filaDeItem(msg('user', 'Yo'), true).de, 'yo', 'lo de la persona, ya');
  assert.equal(filaDeItem({ k: 'bloque', id: 'b', b: { t: 'pregunta', pregunta: '', opciones: [] } } as never, true).de, 'pieza', 'el bloque con opciones, en la pausa');
  assert.equal(filaDeItem({ k: 'aviso', id: 'v', texto: 'Ojo', tono: 'mako' } as never, true).de, 'mako', 'un aviso de MaKo, con puntitos');
  assert.equal(filaDeItem({ k: 'aviso', id: 'v', texto: 'Caído', tono: 'plataforma' } as never, true).de, 'pieza');
  assert.equal(filaDeItem(msg('assistant', 'Del historial'), false).de, 'ya', 'el historial, de una');
  const c = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.equal((c.match(/conLoNuevo\(\(xs\) => \{\n\s*const vistas = new Set/g) ?? []).length, 2, 'las dos respuestas de turno (texto y nota de voz)');
  assert.match(c, /const poner = \(xs: ItemHilo\[\]\) => \(turno \? conLoNuevo\(\(\) => xs\) : setItems\(xs\)\);/, 'el turno de Offer, también');
  assert.match(c, /if \(a\.ok\) await ponerOffer\(a\.sesion, true\);/);
  assert.match(c, /items: itemsVisibles, [^\n]*enCurso: enCurso \|\| cola\.escribiendo/, 'quien dibuja recibe lo ya soltado, y los puntitos mientras escribe');
});

test('2. coaches-1, 4 y 6: el saludo del coach espera que la voz nombre «la primera pregunta»; la clase nueva va al final; la caja se marca', async () => {
  const { DICE_EL_COACH } = await import('../app/second-brain/coach-compartido');
  const man = JSON.parse(leer('public/tutoriales/manifiesto.json')) as { videos: { key: string; frases?: { t_inicio: number; texto: string }[] }[] };
  const { momentoDelVideo } = await import('../app/_ui/tutorial/useMensajeDelVideo');
  assert.equal(momentoDelVideo(man.videos.find((v) => v.key === 'offer-coach')?.frases ?? [], DICE_EL_COACH), 18.5);
  assert.equal(momentoDelVideo(man.videos.find((v) => v.key === 'funnel-coach')?.frases ?? [], DICE_EL_COACH), 26.34);
  const h = sinComentarios(leer('app/second-brain/coach-compartido.tsx'));
  assert.match(h, /clave: claveVideo, dice: DICE_EL_COACH, esperaPlay: MS_SIN_PLAY,/);
  assert.match(h, /retenido: \(id\) => conVideoPortada && saludoFase !== 'listo' && idsPortada\.has\(id\) && id !== idVideo,/);
  assert.match(h, /if \(motorOffer\) return x\.k === 'msg' \? \{ id: x\.id, de: x\.role === 'assistant' \? 'mako' : 'yo', texto: textoDe\(x\) \} : \{ id: x\.id, de: 'pieza', texto: '' \};/, 'en Offer Coach, su primer mensaje después del saludo');
  assert.match(h, /items: claseNueva \? \[\.\.\.k\.items, clase\] : conLaClase<ItemHilo>\(k\.items, clase\)/, 'coaches-4: la clase nueva, al final');
  assert.match(h, /if \(claseNueva && clase && x\.id === clase\.id\) return \{ id: x\.id, de: 'mako', texto: textoDe\(x\) \};/, 'con sus puntitos');
  const coach = sinComentarios(leer('app/second-brain/ChatDelCoach.tsx'));
  assert.match(coach, /useHiloDelCoach\(\{ k, cual, dosCoaches, plan, motorOffer, portada, conVoz, deLaOferta, enPortada, entrada \}\)/);
  assert.match(sinComentarios(leer('app/m/second-brain/HojaDelCoach.tsx')), /enPortada: vacio \|\| \(motorOffer && sinEscribir\) \}\)/, 'el teléfono, igual');
  assert.equal((sinComentarios(leer('app/second-brain/VideoDelCoach.tsx')).match(/dalePlay=\{dalePlay\} marcarFrases \/>/g) ?? []).length, 2, 'coaches-6: los dos coaches');
});

test('3. coaches-2 y 3: el coach baja al volver a verse (de otro chat, del plan, del Second Brain del gurú) y con lo de abajo', () => {
  const coach = sinComentarios(leer('app/second-brain/ChatDelCoach.tsx'));
  assert.match(coach, /const ultimaFila = `\$\{hiloCoach\.items\[hiloCoach\.items\.length - 1\]\?\.id \?\? ''\}\|\$\{hiloCoach\.enCurso \? 'escribe' : ''\}\|\$\{entrada\}\|\$\{alFinal \? 'final' : ''\}\|\$\{visible\}\|\$\{mostrandoPlan\}\|\$\{mostrandoCerebro\}`;/);
});

test('4. ops-center-4, 5 y 7: el Second Brain, el gurú y las pestañas bajan por la última fila; el saludo y la apertura, con sus puntitos', () => {
  const sb = sinComentarios(leer('app/second-brain/ChatDelSecondBrain.tsx'));
  assert.match(sb, /const dicho = useDichoConPuntitos\(filasSaludo\);/);
  assert.match(sb, /\{conArranques && <div className="ch-arranques sb-chat__arranques">/, 'los arranques, después del saludo');
  assert.match(sb, /seguir=\{\{ clave: ultimaFila \}\}/);
  assert.doesNotMatch(sb, /scrollTop = el\.scrollHeight/);
  const r = sinComentarios(leer('app/second-brain/ChatDelReferente.tsx'));
  assert.match(r, /escribiendo=\{dicho\.escribiendo \? \{ segs: 0 \} : null\}/);
  assert.match(r, /\|\$\{visible\}\|\$\{viendoCerebro\}`;/, 'también al volver a verse');
  assert.doesNotMatch(r, /scrollTop = el\.scrollHeight/);
  const t = sinComentarios(leer('app/_chat/MakoEnLaTab.tsx'));
  assert.match(t, /<PanelDeChat hilo=\{hilo\} adjuntos=\{k\.adjuntosCaja\} seguir=\{\{ clave: ultimaFila \}\}/);
  assert.doesNotMatch(t, /el\.scrollTop = el\.scrollHeight; \}, \[k\.items\.length/);
  const a = sinComentarios(leer('app/_chat/AperturaMako.tsx'));
  assert.match(a, /const dicho = useDichoConPuntitos\(filas\);/);
  assert.match(a, /\{conBotones && <div className="ch-apertura__botones"/, 'los botones, en la pausa');
  assert.match(a, /useEffect\(\(\) => \{ if \(a\) avisarMensajeNuevo\(\); \}/, 'vive fuera de la lista: avisa al hilo');
});

test('5. coaches-7 y 8: ChatOffer baja con cada mensaje nuevo, y el primer mensaje y las píldoras salen a su tiempo', () => {
  const o = sinComentarios(leer('app/offer/ChatOffer.tsx'));
  assert.match(o, /useBajarAlUltimo\(seguirHilo, `\$\{sesion\.id\}\|\$\{itemsVisibles\[itemsVisibles\.length - 1\]\?\.id \?\? ''\}\|/);
  assert.doesNotMatch(o, /abajo\.current|estaAbajo/, 'ya no baja sólo si estaba abajo');
  assert.match(o, /const recienCreada = mensajes\.length > 0 && mensajes\.every\(\(m\) => m\.de === 'mako'\);/, 'una conversación recién creada: su primer mensaje con puntitos');
  assert.match(o, /const conPildoras = !ultimo \|\| cola\.conPieza\(`of-\$\{ultimo\.id\}`\);/);
  assert.match(o, /\{opciones\.length > 0 && conPildoras && \(/, 'las píldoras, en la pausa');
  assert.match(o, /useEffect\(\(\) => \{ if \(respondiendo\) empezoLaEspera\(\); \}, \[respondiendo, empezoLaEspera\]\);/, 'lo que tardó el servidor cuenta');
});
