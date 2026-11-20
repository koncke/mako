// =============================================================================
// LA ENTRADA DE UN VIDEO EN UN CHAT: la pantalla oscura, MaKo escribiendo y el «dale play» (20/11/2026, V5)
// =============================================================================
// La auditoría del Cerebro (auditoria-onboarding-reto-20-11.md, V5): «Ningún video llega con su entrada: ni la pantalla oscura con MaKo
// escribiendo ni el "dale play" marcado». Lo acordado (la maqueta: b-of-entra, el paso «escribe», la marca `invita`): cada coach abre
// como la bienvenida (oscuro, escribe, manda el video) y un video quieto se marca con «{título}: dale play» hasta que lo reproducen
// o lo cierran. La pieza es una (app/_ui/tutorial/entrada.ts, EntradaEscribiendo.tsx, useDalePlay.ts) y la usan el onboarding, los
// coaches y la llegada al Ops Center; el chat del reto la usa para cada día.
// Probado rompiéndolo (20/11/2026, una rotura por vez y restaurada): marcando aunque el motor esté ocupado cae el 1; sin soltarla al
// salir de la vista, el 1; con `soltarSenal` cerrando lo de otro, el 2; sin `invita` en la marca, el 3; con el «Lo hago después» en
// la tarjeta del «dale play», el 3; con el video marcado aunque esté corriendo, el 4; sin `dalePlay` en el video de un coach, el 5;
// sin la entrada en el coach, el 5; con el coach entrando escondido (sin `visible`), el 5; con el play de la portada de un coach en
// el centro, el 5.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PARTE_A_LA_VISTA, anotarEntrada, cerrarDalePlay, dalePlayCerrado, sueltaDalePlay, tituloDalePlay, tocaDalePlay, yaEntro } from '../app/_ui/tutorial/entrada';
import { cerrarTutorial, senalAhora, senalarDondeTocar, soltarSenal } from '../app/_ui/tutorial/store';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. el «dale play»: sólo con el video quieto, a la vista, el motor libre y sin cerrar; se suelta al moverse o irse', () => {
  assert.equal(tituloDalePlay('tu recorrido por MaKo'), 'Tu recorrido por MaKo: dale play', 'la maqueta, textual');
  const base = { activo: true, aLaVista: true, motorLibre: true, cerrado: false };
  assert.equal(tocaDalePlay(base), true);
  assert.equal(tocaDalePlay({ ...base, activo: false }), false, 'corriendo o ya visto: nada');
  assert.equal(tocaDalePlay({ ...base, aLaVista: false }), false, 'un chat escondido (display: none) o el video fuera de la pantalla');
  assert.equal(tocaDalePlay({ ...base, motorLibre: false }), false, 'no pisa un tutorial ni otra marca: espera');
  assert.equal(tocaDalePlay({ ...base, cerrado: true }), false, 'cerrada con la X (o tocado el video) no vuelve');
  assert.equal(sueltaDalePlay({ activo: true, aLaVista: true }), false);
  assert.equal(sueltaDalePlay({ activo: false, aLaVista: true }), true, 'el video arrancó');
  assert.equal(sueltaDalePlay({ activo: true, aLaVista: false }), true, 'bajó en el chat o se fue a otro');
  assert.ok(PARTE_A_LA_VISTA > 0.5, 'medio video asomado no se marca');
  // (Lo que dura MaKo escribiendo, desde el 20/11 la función única de todos los chats: tests/piezas-video-chat.test.ts.)
  assert.equal(yaEntro('x-prueba'), false); anotarEntrada('x-prueba'); assert.equal(yaEntro('x-prueba'), true, 'la entrada sale UNA vez');
  assert.equal(dalePlayCerrado('y-prueba'), false); cerrarDalePlay('y-prueba'); assert.equal(dalePlayCerrado('y-prueba'), true);
});

test('2. el motor: la marca devuelve su id y `soltarSenal` saca SÓLO esa, sin avisarle a nadie', () => {
  let avisos = 0;
  const id = senalarDondeTocar({ sel: '[data-dale-play="a"]', titulo: 'X: dale play', texto: '', haz: '' }, () => { avisos += 1; }, { invita: true, alOmitir: () => { avisos += 1; } });
  const s = senalAhora();
  assert.ok(s && s.tipo === 'marca' && s.id === id && s.invita === true);
  soltarSenal(id + 1);
  assert.equal(senalAhora()?.id, id, 'lo de otro no se toca');
  soltarSenal(id);
  assert.equal(senalAhora(), null);
  assert.equal(avisos, 0, 'soltar no es «hecho» ni «omitido»');
  // Una marca común no lleva `invita`.
  senalarDondeTocar({ sel: '[data-recorrido="x"]', titulo: 't', texto: '', haz: 'Haz clic' }, () => {});
  const c = senalAhora();
  assert.ok(c && c.tipo === 'marca' && !('invita' in c));
  cerrarTutorial();
});

test('3. la tarjeta del «dale play»: sólo el título y la X roja (sin «Lo hago después» ni «Haz clic en…»)', () => {
  const m = sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.match(m, /\{senal\.tipo === 'marca' && senal\.invita\s*\? \(\s*<div className="mk-tuto__invita">\s*<h2 className="mk-rec__tit">\{titulo\}<\/h2>\s*<button type="button" className="mk-tuto__vx" aria-label="Cerrar" onClick=\{\(\) => fin\('omitido'\)\}>/);
  assert.match(m, /if \(senal\.invita \|\| \(!senal\.listo && !senal\.alOmitir\)\) return null;/, 'sin pie');
  const g = sinComentarios(leer('app/_ui/tutorial/useDalePlay.ts'));
  assert.match(g, /\{ sel: `\[data-dale-play="\$\{marca\}"\]`, titulo: tituloDalePlay\(titulo\), texto: '', haz: '', lado: 'derecha' \}/);
  assert.match(g, /\{ invita: true, alOmitir: visto \}/);
  assert.match(g, /tocaDalePlay\(\{ activo, aLaVista, motorLibre: senal == null, cerrado: cerrado \|\| dalePlayCerrado\(clave\) \}\)/);
  assert.match(g, /if \(sueltaDalePlay\(\{ activo, aLaVista \}\)\) \{ soltarSenal\(mia\.current\); mia\.current = null; \}/);
  assert.match(g, /new IntersectionObserver\(/);
  assert.match(g, /useEffect\(\(\) => \(\) => \{ if \(mia\.current != null\) soltarSenal\(mia\.current\); \}, \[\]\);/, 'al irse, la marca se va con el video');
});

test('4. el reproductor del chat lo pide quieto, y el onboarding y la llegada lo usan', () => {
  const v = sinComentarios(leer('app/_ui/tutorial/VideoDelMomento.tsx'));
  assert.match(v, /useDalePlay\(raiz, \{ clave, titulo, activo: dalePlay && !!v && estado === 'quieto' && !flotando \}\);/);
  assert.match(v, /<div ref=\{raiz\} className="mk-vmom"/);
  const a = sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx'));
  assert.match(a, /<VideoDelMomento clave=\{VIDEO_BIENVENIDA\} titulo="Bienvenida a MaKo" revision=\{false\} dalePlay \/>/);
  // El del WhatsApp, con su «dale play» (20/11, tarde): la tarjeta del código llega después, cuando la voz nombra el botón, así que las
  // tapas del «dale play» ya no la tapan. Lo que se marca entonces es «Abrir WhatsApp» (tests/onboarding-mensaje-del-video.test.ts).
  assert.match(a, /<VideoDelMomento clave=\{VIDEO_WHATSAPP\} titulo="Tu WhatsApp con MaKo" revision=\{false\} dalePlay \/>/);
  const l = sinComentarios(leer('app/second-brain/LlegadaAlReto.tsx'));
  assert.match(l, /useDalePlay\(play, \{ clave: 'recorrido', titulo: 'Tu recorrido por MaKo', activo: toca && fase === 'listo' \}\);/);
  assert.match(l, /<button ref=\{play\} type="button" className="sbl-video" onClick=\{empezar\}/);
});

test('5. cada coach entra la primera vez como la bienvenida: oscuro, escribe, y su video con «dale play»', () => {
  const c = sinComentarios(leer('app/second-brain/ChatDelCoach.tsx'));
  assert.match(c, /const enPortada = vacio \|\| \(motorOffer && sinEscribir\);/);
  assert.match(c, /const entrada = useEntrada\(CLAVE_VIDEO_DEL_COACH\[cual\], dosCoaches && visible && enPortada && portada\.conVideo\);/);
  assert.match(c, /: entrada === 'escribe' \? <EntradaEscribiendo foto=\{<Muneco titulo=\{quien\.nombre\} aspecto=\{quien\.aspecto\} animo="despierto" size=\{26\} \/>\} quien=\{titulo\} \/>/);
  const v = sinComentarios(leer('app/second-brain/VideoDelCoach.tsx'));
  // (20/11: `dalePlay={dalePlay}`, sólo mientras el video es la portada del chat vacío.)
  assert.equal((v.match(/<VideoDelMomento [^>]*\bdalePlay=\{dalePlay\} \/>/g) ?? []).length, 2, 'los dos coaches');
  assert.match(v, /return \{ items, enMensaje, conVideo \};/);
  // Su «dale play» señala el play: en el centro tapaba el título de la portada («ningún anuncio la salva»; el Cerebro, 20/11: el play
  // cae sobre un espacio vacío, en cualquier portada). Abajo a la derecha no hay nada (C:/dev/tutoriales-video/pantallas-onboarding/poster.mjs).
  const man = JSON.parse(leer('public/tutoriales/manifiesto.json')) as { videos: { key: string; play?: string }[] };
  for (const k of ['offer-coach', 'funnel-coach']) assert.equal(man.videos.find((x) => x.key === k)?.play, 'abajo-derecha', k);
  // Los dos quedan montados y escondidos: la entrada corre sólo a la vista (si no, se «veía» escondida).
  const lista = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(lista, /<ChatDelCoach referente=\{referente\}.*dosCoaches=\{dosCoaches\} visible=\{verFunnel\} \/>/);
  assert.match(lista, /<ChatDelCoach cual="offer".*visible=\{verOffer\} \/>/);
  const e = sinComentarios(leer('app/_ui/tutorial/EntradaEscribiendo.tsx'));
  assert.match(e, /if \(!activa \|\| yaEntro\(clave\)\) return;\s*anotarEntrada\(clave\);/);
  assert.match(e, /window\.setTimeout\(\(\) => setEscribe\(false\), msEscribiendo\(texto\)\)/);
  assert.match(e, /if \(!hayCaja \|\| !nodo \|\| menosMovimiento\(\)\) return;\s*return barrer\(nodo\);/, 'con el barrido, salvo con menos movimiento');
  assert.match(e, /createPortal\(/, 'el velo afuera de los contextos de apilado del panel');
});
