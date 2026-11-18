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
