// El interruptor del onboarding V2 (lib/onboarding-v2/revision.ts) y el video chico de cada tutorial (lib/tutoriales/videos.ts),
// 18/11/2026. Lo nuevo lo ve sólo la revisión de Martín; un video que no es de /tutoriales nunca se muestra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EMAILS_REVISION, PARA_TODOS, WS_REVISION_V2, esRevision, veOnboardingV2 } from '../lib/onboarding-v2/revision';
import { videoDe } from '../lib/tutoriales/videos';

test('el onboarding V2 lo ve sólo la revisión de Martín (sus cuentas y el Cliente de Prueba)', () => {
  assert.equal(PARA_TODOS, false, 'prenderlo para todos lo decide Martín: este test se cambia con él');
  assert.ok(EMAILS_REVISION.includes('martinkoncke@gmail.com'));
  assert.deepEqual([...WS_REVISION_V2], [3]);
  assert.equal(veOnboardingV2({ email: 'MartinKoncke@gmail.com ' }), true, 'el email, sin importar mayúsculas ni espacios');
  assert.equal(veOnboardingV2({ email: 'otra@cliente.com', ws: 3 }), true, 'cualquiera adentro del Cliente de Prueba');
  assert.equal(veOnboardingV2({ email: 'otra@cliente.com', ws: 9 }), false);
  assert.equal(veOnboardingV2({}), false);
  assert.equal(esRevision(true), true, 'mientras no está para todos, lo que ve es una revisión');
  assert.equal(esRevision(false), false);
});

test('el video de cada tutorial sale del manifiesto, y sólo de /tutoriales', () => {
  const m = [
    { key: 'crm', archivo: 'crm.mp4', duracion_s: 40, poster: 'crm.jpg' },
    { key: 'offer', archivo: '/tutoriales/offer.webm' },
    { key: 'landing', archivo: 'https://otro.sitio/vsl.mp4' },
    { key: 'raro', archivo: '../secreto.mp4' },
  ];
  assert.deepEqual(videoDe(m, 'crm'), { key: 'crm', archivo: '/tutoriales/crm.mp4', duracion_s: 40, poster: '/tutoriales/crm.jpg' });
  assert.equal(videoDe(m, 'offer')?.archivo, '/tutoriales/offer.webm');
  assert.equal(videoDe(m, 'landing'), null, 'un video de otro lado no se muestra (nunca el de la landing)');
  assert.equal(videoDe(m, 'raro'), null);
  assert.equal(videoDe(m, 'settings'), null, 'sin video para esa pestaña, ninguno');
  assert.equal(videoDe({ videos: m }, 'crm')?.archivo, '/tutoriales/crm.mp4', 'también con la forma { videos: [...] }');
  assert.equal(videoDe(null, 'crm'), null);
});

test('el motor se monta sólo para la revisión, y la guía no pregunta donde él se ocupa', () => {
  const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /\{sesion && veV2 && <MotorTutorial revision=\{esRevision\(veV2\)\} \/>\}/);
  const guia = readFileSync(new URL('../app/_ui/guia/useGuiaDeLaTab.ts', import.meta.url), 'utf8');
  assert.match(guia, /if \(motorSeOcupa\(window\.location\.pathname\)\)/);
  const motor = readFileSync(new URL('../app/_ui/tutorial/MotorTutorial.tsx', import.meta.url), 'utf8');
  const hoja = motor.slice(motor.indexOf('const CSS_TUTORIAL = `') + 22);
  assert.equal(hoja.slice(0, hoja.indexOf('`;')).includes('`'), false, 'la hoja es un template literal: sin comillas invertidas adentro');
});

test('el video y la marca van juntos: las frases del manifiesto, con su pausa y su cierre (Martín, 18/11)', async () => {
  const { frasesDe, fraseParaMarcar, mismoLugar } = await import('../lib/tutoriales/videos');
  const f = frasesDe([
    { id: 'b', t_inicio: 6, t_fin: 8, texto: 'Toca aquí, en Ver info.', sel: '[data-recorrido="tour-crm-ver-info"]', cierra_despues: true },
    { id: 'a', t_inicio: 0, t_fin: 5, texto: 'Este es tu CRM.' },
    { id: 'c', t_inicio: 9, t_fin: 11, texto: 'Mira el lienzo.', sel: '.lienzo', espera_clic: false },
    { id: 'rara', t_inicio: 'x', texto: 'sin tiempo' },
  ]);
  assert.deepEqual(f.map((x) => x.id), ['a', 'b', 'c'], 'en orden de tiempo, sin las raras');
  assert.equal(f[0].espera_clic, false, 'sin sel no hay nada que esperar');
  assert.equal(f[1].espera_clic, true, 'con sel y sin el campo: pausa hasta el clic');
  assert.equal(f[1].cierra_despues, true);
  assert.equal(f[2].espera_clic, false, '«Mira aquí»: marca sin pausar');
  assert.equal(f[2].cierra_despues, false, 'sin el campo, no cierra nada');
  assert.equal(frasesDe([{ id: 'qr', t_inicio: 1, t_fin: 2, texto: 'Escanea el QR', sel: 'img.aj-telefono__qr', espera_clic: false, espera_siguiente: true }])[0].espera_clic, true, 'espera_siguiente: una «mira» que espera');
  const nada = new Set<string>();
  assert.equal(fraseParaMarcar(f, 3, nada), null, 'una frase sin sel no marca');
  assert.equal(fraseParaMarcar(f, 6.2, nada)?.id, 'b');
  assert.equal(fraseParaMarcar(f, 9.5, new Set(['b']))?.id, 'c');
  assert.equal(fraseParaMarcar(f, 12, new Set(['b'])), null, 'una «Mira aquí» que ya pasó no se marca tarde');
  assert.equal(fraseParaMarcar(f, 12, nada)?.id, 'b', 'la que espera el clic sigue esperando');
  assert.ok(mismoLugar('[data-recorrido="tour-crm-reuniones"], .m-crm-arriba .crm-reus', '.m-crm-arriba .crm-reus'), 'un sel de lista «computadora, teléfono»');
  assert.equal(videoDe({ videos: [{ key: 'crm', archivo: 'crm.mp4', frases: [{ id: 'x', t_inicio: 1, t_fin: 2, texto: 'hola', sel: '#a' }] }] }, 'crm')?.frases?.[0]?.espera_clic, true, 'videoDe trae las frases');
  const motor = readFileSync(new URL('../app/_ui/tutorial/MotorTutorial.tsx', import.meta.url), 'utf8');
  assert.match(motor, /fraseParaMarcar\(/, 'el motor marca al ritmo del video');
  assert.match(motor, /if \(!e\.isTrusted\) return;/, 'el Escape con el que el motor cierra un panel no omite el tutorial');
  assert.doesNotMatch(motor, />×</, 'la X del video es un SVG, nunca la letra');
});

test('los videos de los momentos del onboarding: sus keys, el recorrido la primera vez y el nombre de lo marcado (18/11)', async () => {
  const { nombreDeFrase, hazDeFrase } = await import('../lib/tutoriales/videos');
  assert.equal(nombreDeFrase('Toca aquí, en el Objetivo Principal: el perro del Plan te dice por qué.'), 'Objetivo Principal');
  assert.equal(nombreDeFrase('Mira aquí, el lienzo: ahí se arma cada una.'), 'El lienzo');
  assert.equal(hazDeFrase('Toca aquí, en la primera de tus cinco tareas, para ver qué te toca.'), 'Haz clic en la primera de tus cinco tareas');
  assert.equal(hazDeFrase('Toca aquí, en Ver info, para abrir la ficha.'), 'Haz clic en Ver info');
  assert.equal(nombreDeFrase('Imagina un equipo que trabaja para tu negocio.'), null, 'una frase sin «aquí» no nombra nada');
  const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');
  const motor = leer('app/_ui/tutorial/MotorTutorial.tsx');
  // 18/11, Martín: la primera vez en el Ops Center, el recorrido APROBADO, y su video sólo si sigue sus pasos.
  assert.match(motor, /mostrarTutorial\(t\.pestana === 'ops-center' \? TUTORIAL_RECORRIDO : t,/, 'la primera vez en el Ops Center, el recorrido aprobado');
  // Martín, 18/11, noche: sin la tarjeta al entrar a una pestaña (su video, directo) y el «?» que lo vuelve a abrir.
  assert.match(motor, /\.\.\.\(t\.pestana === 'ops-center' \? \{\} : \{ directo: true \}\)/, 'una pestaña abre directo su video');
  assert.match(motor, /onClick=\{\(\) => mostrarTutorial\(t, \{ directo: true \}\)\}/, 'el «?» vuelve a abrir el video de la pestaña');
  assert.match(motor, /VIDEO_FIEL\.has\(senal\.tutorial\.pestana\) && !sigueLosPasos\(/, 'un video que no sigue los pasos no se usa');
  // La pausa al FINAL de la frase, no al empezar (la voz terminaba la frase con la marca ya en la siguiente).
  assert.match(motor, /if \(t >= frase\.t_fin - 0\.05\) \{ if \(frase\.espera_clic\)/, 'la pausa en el t_fin');
  assert.doesNotMatch(motor, /if \(f\.espera_clic\) v\.pause\(\);/, 'nunca la pausa en el t_inicio');
  const chat = leer('app/onboarding/ChatArranque.tsx');
  for (const k of ['onboarding-bienvenida', 'onboarding-whatsapp', 'onboarding-seguir-pc']) assert.match(chat, new RegExp(`clave[=:] ?["']${k}["']`), `el lugar de ${k}`);
  assert.match(leer('app/onboarding/page.tsx'), /videos=\{v2 \? \{ revision: esRevision\(v2\) \} : null\}/, 'sólo el onboarding V2 tiene los videos');
  assert.doesNotMatch(leer('app/_ui/tutorial/VideoDelMomento.tsx'), /landing|vsl/i, 'nunca otro video en su lugar');
});

test('el recorrido aprobado en la app: sus pasos, sus marcas en los componentes y su video sólo si los sigue (Martín, 18/11)', async () => {
  const { TUTORIAL_RECORRIDO } = await import('../lib/onboarding-v2/recorrido');
  const { sigueLosPasos, frasesDe } = await import('../lib/tutoriales/videos');
  assert.deepEqual(TUTORIAL_RECORRIDO.pasos.map((p) => p.titulo), ['El reto de 7 días de MaKo', 'Tu panel', 'Tu Second Brain', 'Lo que MaKo sabe de ti', 'Vuelve a tus chats', 'La Ticketera'], 'el GUION aprobado de la maqueta, en su orden');
  assert.doesNotMatch(JSON.stringify(TUTORIAL_RECORRIDO), /Funnel Coach|Offer Coach/, '«no tiene sentido mostrarle por primera vez el Funnel Coach»');
  const fiel = frasesDe([
    { id: '1', t_inicio: 0, t_fin: 4, texto: '¡Hola de nuevo!' },
    { id: '2', t_inicio: 5, t_fin: 10, texto: 'reto', sel: '[data-recorrido="sb-reto-chat"]', espera_clic: false },
    { id: '3', t_inicio: 11, t_fin: 14, texto: 'panel', sel: 'aside[data-sidebar]', espera_clic: false },
    { id: '4', t_inicio: 15, t_fin: 18, texto: 'Toca Second Brain', sel: '[data-recorrido="sb-second-brain"]' },
    { id: '5', t_inicio: 19, t_fin: 22, texto: 'grafo', sel: '[data-recorrido="sb-grafo"]', espera_clic: false },
    { id: '6', t_inicio: 23, t_fin: 25, texto: 'la flecha', sel: '[data-recorrido="sb-brain-volver"], button.cbg-atras' },
    { id: '7', t_inicio: 26, t_fin: 32, texto: 'Ticketera', sel: '[data-recorrido="sb-ticketera"]', espera_clic: false },
  ]);
  assert.ok(sigueLosPasos(fiel, TUTORIAL_RECORRIDO.pasos), 'el video rehecho sigue los pasos');
  const deLaManana = frasesDe([
    { id: 'a', t_inicio: 10, t_fin: 15, texto: 'Funnel Coach', sel: 'button[title="Funnel Coach"]' },
    { id: 'b', t_inicio: 16, t_fin: 21, texto: 'Uso', sel: '[data-recorrido="sb-uso"]' },
  ]);
  assert.equal(sigueLosPasos(deLaManana, TUTORIAL_RECORRIDO.pasos), false, 'el de la mañana (Funnel Coach, Uso…) no se usa');
  const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');
  assert.equal((leer('app/second-brain/ChatSecondBrain.tsx').match(/data-recorrido="sb-second-brain"/g) ?? []).length, 2, 'la marca en los dos «Second Brain»');
  const grafo = leer('app/second-brain/Grafo.tsx');
  assert.match(grafo, /className="cbg-marco" data-recorrido="sb-grafo"/);
  assert.match(grafo, /aria-label="Volver a la lista" data-recorrido="sb-brain-volver"/);
});

test('el video siempre a la vista y el del día paso a paso (Martín, 18/11)', async () => {
  const { DIAS_RETO, tutorialDelDia } = await import('../lib/reto/dias');
  const t2 = tutorialDelDia(DIAS_RETO[1]);
  assert.equal(t2.pestana, 'reto-dia-2', 'el tutorial del día lleva la key de su video');
  assert.ok(t2.pasos.length >= 4 && t2.pasos.every((p) => p.sel && p.titulo), 'sus pasos son las marcas de sus tareas, en orden');
  const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');
  const reto = leer('app/second-brain/reto/ChatDelReto.tsx');
  assert.match(reto, /mostrarTutorial\(tutorialDelDia\(dia\), \{ video: dia\.video, directo: true, alTocar: onTocado \}\)/, 'con frases, el video del día lo pasa el motor');
  assert.match(reto, /useVideoQueFlota\(ref, v \? dia\.video : null/, 'el del día flota al salir de la vista');
  assert.match(leer('app/_ui/tutorial/VideoDelMomento.tsx'), /useVideoQueFlota\(ref, v \? clave : null, titulo\)/, 'los del onboarding también');
  const motor = leer('app/_ui/tutorial/MotorTutorial.tsx');
  assert.match(motor, /senal\.tipo === 'video' && <VideoFlotante/, 'el flotante lo dibuja el motor');
  // 20/11 (la auditoría de las pausas): ya no se espera con el video quieto en el t_inicio de la frase («un lugar de otra página se
  // espera 4 s»: cortaba la voz). Después del clic que navega, el video espera en el SILENCIO de la frase tocada a que llegue lo
  // marcado (app/_ui/tutorial/pausas.ts; tests/tutorial-pausas.test.ts).
  assert.match(motor, /soltarRetencion\(r, \{/, 'un lugar de otra página se espera en el silencio de la frase tocada');
});
