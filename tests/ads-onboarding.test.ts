// =============================================================================
// El Ads Manager abre en su onboarding mientras falte la cuenta, la página o la primera campaña
// =============================================================================
// Tarea #801 (13/10/2026): la tab que justifica el precio abría sin decir qué faltaba
// conectar. Ahora tiene su entrada en el catálogo (lib/tab-onboarding-catalogo.ts),
// la page deriva los tres pasos de lo que hay (app/ads-manager/onboarding-datos.ts,
// con la regla pura en onboarding-reglas.ts) y abre el wizard con su salida mientras
// falte alguno. Un cliente que ya opera su cuenta lo cumple todo al abrir y no lo ve.
//
// PROBADO ROMPIÉNDOLO el 13/10/2026 (con todo puesto: 7 pasan, 0 fallan). Pasan / fallan:
//   · la campaña cuenta con cero campañas                                    -> 6 / 1
//   · no corta en el primer paso que falta                                    -> 6 / 1
//   (La primera versión repetía la dependencia en cada condición Y en el corte: romper
//   cualquiera de las dos daba 7 / 0, porque la otra la tapaba. Quedó una sola.)
//   · AdsManagerView sin la rama del onboarding                               -> 6 / 1
//   · el wizard sin «Lo configuro después»                                    -> 6 / 1
//   · campaign-create sin marcar am_campana                                   -> 6 / 1
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TAB_ONBOARDINGS } from '../lib/tab-onboarding-catalogo';
import { PASOS_ADS, pasoInicialAds, pasosCumplidos } from '../app/ads-manager/onboarding-reglas';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string =>
  s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el catálogo tiene el Ads Manager con sus tres pasos, con prefijo y sin requisito de otra tab', () => {
  const def = TAB_ONBOARDINGS['ads-manager'];
  assert.ok(def, 'falta la entrada ads-manager');
  assert.deepEqual(def.pasos.map((p) => p.key), [...PASOS_ADS], 'el catálogo y la regla declaran los mismos pasos, en el mismo orden');
  assert.ok(def.pasos.every((p) => p.key.startsWith('am_') && !p.opcional));
  assert.equal(def.requiere, undefined, 'alcanza con Meta: no se encadena con ads-writer');
  assert.equal(def.nombre, 'Ads Manager');
});

test('lo que hay decide qué pasos ya están, en orden y cortando en el primero que falta', () => {
  assert.deepEqual(pasosCumplidos({ cuentaOk: true, paginaOk: true, campanas: 4 }), ['am_cuenta', 'am_pagina', 'am_campana'], 'un cliente que ya opera su cuenta no ve el wizard');
  assert.deepEqual(pasosCumplidos({ cuentaOk: true, paginaOk: true, campanas: 0 }), ['am_cuenta', 'am_pagina']);
  assert.deepEqual(pasosCumplidos({ cuentaOk: true, paginaOk: false, campanas: 9 }), ['am_cuenta'], 'sin página no se salta a la campaña');
  assert.deepEqual(pasosCumplidos({ cuentaOk: false, paginaOk: true, campanas: 9 }), [], 'sin la cuenta leída no vale nada');
});

test('el wizard retoma en el primer paso sin hacer', () => {
  assert.equal(pasoInicialAds({}), 'cuenta');
  assert.equal(pasoInicialAds({ am_cuenta: true }), 'pagina');
  assert.equal(pasoInicialAds({ am_cuenta: true, am_pagina: true }), 'campana');
});

test('la lectura sólo MARCA (un error de hoy no deshace lo que ya anduvo)', () => {
  const src = sinComentarios(leer('../app/ads-manager/onboarding-datos.ts'));
  assert.match(src, /for \(const paso of pasosCumplidos\(\{ cuentaOk: cuenta\.ok, paginaOk: pagina\.ok, campanas \}\)\)/);
  assert.doesNotMatch(src, /marcarPasoTab\([^)]*,\s*false\)/);
  assert.match(src, /e\.name === 'MetaHealthPermisoError'/, 'la falta de permisos se dice como tal');
});

test('la vista abre el onboarding mientras esté pendiente, y si la derivación falla sirve la tabla', () => {
  const src = sinComentarios(leer('../app/ads-manager/AdsManagerView.tsx'));
  const rama = src.indexOf('const onboarding = await onboardingAdsPendiente().catch(() => null);');
  const tabla = src.indexOf('<CampanasBrowser ');
  assert.ok(rama > 0 && tabla > rama, 'la rama del onboarding va antes de la tabla');
  assert.match(src, /if \(onboarding\) \{\n\s*return <OnboardingAdsManager datos=\{onboarding\}/);
});

test('el wizard tiene salida y termina con el asistente de campaña abierto', () => {
  const src = sinComentarios(leer('../app/ads-manager/OnboardingAdsManager.tsx'));
  assert.match(src, /Lo configuro después/);
  assert.match(src, /onClose=\{\(\) => setSalir\(true\)\}/);
  assert.match(src, /onConfirmar=\{\(\) => \{ setAbrirNueva\(true\); setSalir\(true\); \}\}/);
  assert.match(src, /<CampanasBrowser [^>]*abrirNueva=\{abrirNueva\}/);
  const browser = sinComentarios(leer('../app/ads-manager/CampanasBrowser.tsx'));
  assert.match(browser, /const \[nuevaOpen, setNuevaOpen\] = useState\(abrirNueva\);/);
});

test('crear la primera campaña cierra el último paso', () => {
  const src = sinComentarios(leer('../app/api/ads-manager/campaign-create/route.ts'));
  const publicada = src.indexOf("await persist({ status: 'publicada'");
  const marca = src.indexOf("await marcarPasoTab('ads-manager', 'am_campana').catch(() => null);");
  assert.ok(publicada > 0 && marca > publicada, 'se marca después de anotarla como publicada');
});
