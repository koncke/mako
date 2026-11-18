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
