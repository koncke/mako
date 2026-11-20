// =============================================================================
// LOS VIDEOS DE CADA COACH CONTRA LA MAQUETA (20/11/2026: V6, V7, V12, F3 y F4 de la auditoría)
// =============================================================================
// La auditoría del Cerebro (auditoria-onboarding-reto-20-11.md, «Videos») contra la maqueta (cuerpo.html: videosCoachHtml, :1958,
// :4155-4156, :4371; capturas vchat-1-clase y vchat-2-lista):
//   · V6: la lista del ícono de videos, sólo con lo ya elegido y con los títulos de la maqueta; el botón, sólo el ícono;
//   · V7: la clase del funnel principal, como un mensaje de MaKo en su lugar (no clavada arriba del chat); la de la oferta, sólo en la
//     lista;
//   · V12: la presentación del coach y su video quedan siempre al principio del hilo;
//   · F3: un video de la lista que tiene su mensaje en el chat se ve AHÍ (el cuadrito de la esquina, sólo para lo que no está);
//   · F4: el video va arriba del texto.
// La computadora (app/second-brain/ChatDelCoach.tsx) y el teléfono (app/m/second-brain/HojaDelCoach.tsx) usan el mismo hilo
// (coach-compartido.tsx → useHiloDelCoach).
// Probado rompiéndolo (20/11/2026, una rotura por vez y restaurada): con todas las clases en la lista cae el 1; con la clase de la
// oferta sin oferta, el 1; con la clase al final del hilo, el 2; con la portada sólo hasta que escribe, el 3; con la clase otra vez
// clavada arriba, el 3; con el teléfono sin el hilo compartido, el 3; con el video abajo del texto, el 4; con el «dale play» siempre,
// el 4; con el play de la portada de una clase en el centro, el 4; con la lista yendo siempre a la esquina, el 5; con la palabra
// «Videos» en el botón, el 5.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conLaClase, itemClaseFunnel, textoClaseFunnel, videosDelFunnel, videosDelOffer } from '../lib/onboarding-v2/videos-coach';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. V6: la lista de cada coach, sólo con lo que ya eligió y con los títulos de la maqueta', () => {
  assert.deepEqual(videosDelFunnel(null), [{ clave: 'funnel-coach', titulo: 'Bienvenida a Funnel Coach' }], 'sin funnel elegido, sólo la bienvenida');
  assert.deepEqual(videosDelFunnel({ funnel: 'anuncios-a-whatsapp', otros: ['organico', 'anuncios-a-whatsapp'] }), [
    { clave: 'funnel-coach', titulo: 'Bienvenida a Funnel Coach' },
    { clave: 'funnel-clase-anuncios-a-whatsapp', titulo: 'La clase de «Anuncios a WhatsApp»' },
    { clave: 'funnel-clase-organico', titulo: 'La clase de «Orgánico»' },
  ], 'el principal y sus otros, sin repetir');
  assert.deepEqual(videosDelOffer(false), [{ clave: 'offer-coach', titulo: 'Bienvenida a Offer Coach' }], 'sin oferta, sin su clase');
  assert.equal(videosDelOffer(true)[1]?.clave, 'offer-coach-clase');
  const c = sinComentarios(leer('app/second-brain/ChatDelCoach.tsx'));
  assert.match(c, /const videosDeLaLista = cual === 'funnel' \? videosDelFunnel\(plan\) : videosDelOffer\(conOferta\);/);
  assert.match(c, /\{dosCoaches && <VideosDelChat videos=\{videosDeLaLista\} \/>\}/);
});

test('2. V7: la clase del funnel principal, como un mensaje de MaKo, justo después de lo que pasó hasta que se guardó el plan', () => {
  assert.equal(textoClaseFunnel('anuncios-a-whatsapp'), 'Te dejo la clase de «Anuncios a WhatsApp», para cuando quieras: cómo funciona por dentro. No hace falta para seguir.');
  const clase = itemClaseFunnel({ funnel: 'organico', guardadoEn: '2026-11-20T10:00:05Z' });
  assert.deepEqual({ k: clase.k, role: clase.role, id: clase.id }, { k: 'msg', role: 'assistant', id: 'clase-organico' });
  const m = (id: string, at: string | null) => ({ k: 'msg' as const, id, role: 'assistant' as 'user' | 'assistant', texto: id, at });
  const hilo = [m('a', '2026-11-20T09:59:00Z'), m('confirma', '2026-11-20T10:00:04Z'), m('despues', '2026-11-20T10:01:00Z')];
  assert.deepEqual(conLaClase(hilo, clase).map((x) => x.id), ['a', 'confirma', 'clase-organico', 'despues']);
  assert.deepEqual(conLaClase(hilo, { ...clase, at: null }).map((x) => x.id), ['a', 'confirma', 'despues', 'clase-organico'], 'sin hora, al final');
  assert.deepEqual(conLaClase(hilo, null), hilo);
});

test('3. V12 y V7: la portada siempre arriba, la clase en el hilo (nunca clavada arriba), y el teléfono igual que la computadora', () => {
  const h = sinComentarios(leer('app/second-brain/coach-compartido.tsx'));
  assert.match(h, /const clase = useMemo\(\(\) => \(dosCoaches && cual === 'funnel' && plan \? itemClaseFunnel\(plan\) : null\), \[dosCoaches, cual, plan\]\);/);
  assert.match(h, /const hilo = useHiloConPortada\(kConClase, dosCoaches \? portada\.items : null\);/, 'sin la condición de que no haya escrito');
  const c = sinComentarios(leer('app/second-brain/ChatDelCoach.tsx'));
  assert.doesNotMatch(c, /Mírate|co-clase/, 'la clase ya no va clavada arriba del chat');
  assert.match(c, /useHiloDelCoach\(\{ k, cual, dosCoaches, plan, motorOffer, portada, conVoz, deLaOferta \}\)/);
  assert.match(c, /<HiloDelCliente k=\{hiloCoach\} enMensaje=\{enMensajeDelHilo\} \/>/);
  const t = sinComentarios(leer('app/m/second-brain/HojaDelCoach.tsx'));
  assert.match(t, /useHiloDelCoach\(\{ k, cual, dosCoaches, plan, motorOffer, portada, conVoz, deLaOferta \}\)/, 'el teléfono, el mismo hilo');
  assert.match(t, /<HiloDelCliente k=\{hiloCoach\} enMensaje=\{enMensajeDelHilo\} \/>/);
});

test('4. F4: el video arriba del texto, y el «dale play» sólo mientras es la portada', () => {
  const v = sinComentarios(leer('app/second-brain/VideoDelCoach.tsx'));
  assert.match(v, /arriba: cual === 'offer'\s*\? <VideoDelMomento clave="offer-coach" titulo=\{ORIGEN_OFFER_COACH\} revision=\{revision\} dalePlay=\{dalePlay\} \/>/);
  assert.doesNotMatch(v, /abajo: cual === 'offer'/);
  assert.match(sinComentarios(leer('app/second-brain/ChatDelCoach.tsx')), /const portada = useVideoDelCoach\(cual, dosCoaches, saludo, enPortada\);/);
  const h = sinComentarios(leer('app/second-brain/coach-compartido.tsx'));
  assert.match(h, /arriba: <VideoDelMomento clave=\{claveClaseFunnel\(plan\.funnel\)\} titulo=\{tituloClaseFunnel\(plan\.funnel\)\} revision=\{!PARA_TODOS\} \/>/);
  // Las portadas de las clases tienen el título en el centro: el play, abajo a la derecha (el Cerebro, 20/11: en cualquier portada).
  const man = JSON.parse(leer('public/tutoriales/manifiesto.json')) as { videos: { key: string; play?: string }[] };
  for (const k of ['anuncios', 'anuncios-a-whatsapp', 'anuncios-a-vsl', 'organico', 'youtube', 'prospeccion-en-frio'].map((f) => `funnel-clase-${f}`).concat('offer-coach-clase')) {
    assert.equal(man.videos.find((x) => x.key === k)?.play, 'abajo-derecha', k);
  }
});

test('5. F3 y V6: un video de la lista se ve en su mensaje si está; el botón es sólo el ícono', () => {
  const l = sinComentarios(leer('app/_ui/tutorial/VideosDelChat.tsx'));
  assert.match(l, /if \(!verEnSuMensaje\(v\.clave\)\) reproducirFlotante\(v\.clave, v\.titulo, 0\);/);
  assert.match(l, /x\.dataset\.clave === clave && x\.getClientRects\(\)\.length > 0/, 'sólo el del chat que se ve (no uno escondido)');
  assert.match(l, /el\.scrollIntoView\(\{ block: 'center' \}\);/, 'de una: el video ya está a la vista cuando arranca y no pasa a la esquina');
  const boton = l.slice(l.indexOf('className="mk-vchat__boton"'), l.indexOf('</button>', l.indexOf('className="mk-vchat__boton"')));
  // Lo que se lee adentro del botón (sin las etiquetas del ícono): nada.
  assert.equal(boton.slice(boton.indexOf('}>') + 2).replace(/<[^>]*>/g, '').trim(), '', 'sin la palabra: el ícono, como «Tutoriales de MaKo» del reto');
  assert.match(boton, /aria-label=\{`Los videos de este chat/);
});
