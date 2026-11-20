// =============================================================================
// EL TUTORIAL DE CHATS VACÍO (20/11/2026; el Cerebro: «es lo que ve TODA cuenta nueva del onboarding»)
// =============================================================================
// Sin ningún canal conectado, /chats es sólo «Conecta un canal…» con los botones de cada canal: no hay bandeja ni «Canal», y el
// tutorial de siempre decía «toca aquí, en Todos» y «en Canal» sin marcar nada (leído en el código: app/chats/ChatsApp.tsx →
// `sinCanales`). Ese estado tiene su tutorial (lib/tutoriales/chats-vacio.ts), con su video `chats-vacio`. El motor lo elige cuando
// está la marca del vacío (`variante`, MotorTutorial.tsx → useVariante); cada uno anota su «visto» aparte.
// Probado rompiéndolo (20/11/2026, una rotura por vez y restaurada): sin la variante en Chats cae el 1; sin la marca en el vacío, el
// 1; con el tutorial del vacío marcando la bandeja, el 2; con el motor sin useVariante, el 3; con la frase de WhatsApp del video
// marcando otra cosa, el 4.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TUTORIALES, tutorialDe, tutorialDeRuta } from '../lib/tutoriales';
import { TUTORIAL_CHATS_VACIO } from '../lib/tutoriales/chats-vacio';
import { MARCA } from '../lib/tutoriales/marcas';
import { frasesDe, mismoLugar, sigueLosPasos } from '../lib/tutoriales/videos';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. Chats trae su variante: la marca que existe SÓLO sin canales, y el tutorial del vacío', () => {
  const chats = tutorialDe('chats');
  assert.equal(chats?.variante?.si, `[data-recorrido="${MARCA.chatsSinCanales}"]`);
  assert.equal(chats?.variante?.tutorial, TUTORIAL_CHATS_VACIO);
  // La marca va en el vacío de «sin canales» (no en los otros vacíos de la lista: buscando, cargando).
  const app = sinComentarios(leer('app/chats/ChatsApp.tsx'));
  const bloque = app.slice(app.indexOf('if (sinCanales) {'), app.indexOf('</main>', app.indexOf('if (sinCanales) {')));
  assert.match(bloque, /<div className="rio-vacio" data-recorrido=\{MARCA\.chatsSinCanales\}>/);
  assert.equal((app.match(/MARCA\.chatsSinCanales/g) ?? []).length, 1, 'sólo ahí');
});

test('2. el tutorial del vacío marca sólo lo que existe en ese estado (el botón WhatsApp), y no es otra pestaña', () => {
  assert.equal(TUTORIAL_CHATS_VACIO.pestana, 'chats-vacio', 'su video y su «visto» propios');
  assert.deepEqual(TUTORIAL_CHATS_VACIO.pasos.map((p) => p.sel), [`[data-recorrido="${MARCA.chatsWhatsapp}"]`]);
  assert.equal(TUTORIAL_CHATS_VACIO.pasos[0]?.clic, true, 'espera el clic en WhatsApp');
  // El botón WhatsApp está en ese vacío (BotonesCanales, sólo para el admin).
  assert.match(sinComentarios(leer('app/chats/ChatsApp.tsx')), /\{esAdmin && <BotonesCanales onElegir=\{conectarUno\} \/>\}/);
  // La ruta sigue dando el de siempre, y la variante no es una pestaña más (el catálogo no la lista dos veces).
  assert.equal(tutorialDeRuta('/chats')?.pestana, 'chats');
  assert.ok(!TUTORIALES.some((t) => t.pestana === 'chats-vacio'));
});

test('3. el motor elige la variante con la pantalla ya pintada, y cada una lleva su «visto»', () => {
  const m = sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.match(m, /const t = useVariante\(tutorialDeRuta\(ruta\)\);/);
  assert.match(m, /return t \? <><PrimeraVez key=\{t\.pestana\} t=\{t\} \/><BotonDelVideo t=\{t\} \/><\/> : null;/, 'otra key: otro «visto»');
  assert.match(m, /const mirar = \(\) => \{ cuadro = 0; setEsta\(!!lugarDe\(si\)\); \};/);
  assert.match(m, /const mo = new MutationObserver\(pedir\);/, 'los datos de Chats llegan después del primer pintado');
  assert.match(m, /return t\?\.variante && esta \? t\.variante\.tutorial : t;/);
});

test('4. su video `chats-vacio` (guion aprobado por el Cerebro, 20/11): en el manifiesto, con su marca, y siguiendo los pasos', () => {
  const man = JSON.parse(leer('public/tutoriales/manifiesto.json')) as { videos: Array<{ key: string; formato?: number; dice_el_guion?: boolean; frases?: unknown }> };
  const v = man.videos.find((x) => x.key === 'chats-vacio');
  assert.ok(v, 'en el manifiesto');
  assert.equal(v?.formato, 4);
  assert.equal(v?.dice_el_guion, true, 'la voz dice el guion');
  const frases = frasesDe(v?.frases);
  const conMarca = frases.filter((f) => f.sel);
  assert.equal(conMarca.length, 1, 'una sola marca: la única que existe sin canales');
  assert.ok(mismoLugar(conMarca[0]!.sel!, TUTORIAL_CHATS_VACIO.pasos[0]!.sel));
  assert.ok(sigueLosPasos(frases, TUTORIAL_CHATS_VACIO.pasos));
  for (const f of ['chats-vacio.mp4', 'chats-vacio.jpg']) assert.ok(existsSync(join(RAIZ, 'public/tutoriales', f)), f);
  // La frase 4 dice que MaKo sugiere qué contestar: el botón MaKo de la caja de Chats, en WhatsApp, sin plan (el Cerebro pidió
  // comprobarlo: nunca prometer en un tutorial lo que la app no hace).
  const composer = sinComentarios(leer('app/chats/Composer.tsx'));
  assert.match(composer, /const makoDisponible = esWa && !motivo && !esCanalMaKo\(ident\);/);
  assert.doesNotMatch(composer, /soloPro|useSoloPro|setter-ia/, 'sugerir no es del plan Pro');
});
