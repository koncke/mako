// =============================================================================
// Lo que una pantalla recuerda de lo que se escribió para UN negocio lleva el negocio en la clave
// =============================================================================
// 24/10/2026. AGENTS.md ya lo decía («Lo que se guarda en el NAVEGADOR lleva el workspace en la clave», por el Video
// Editor) y se encontraron dos más: la calculadora de presupuesto (lo fija tests/calculadora-sin-cuenta.test.ts) y el
// borrador de «Nueva campaña» del Ads Manager, que lleva presupuesto, lugares, página, audiencias y destino. Sin el
// negocio en la clave, el super admin que abre dos clientes en el mismo navegador veía en uno lo del otro.
//
// Probado rompiéndolo (24/10/2026): la clave del borrador sin el negocio → 2 pasan / 1 falla; sin borrar la clave vieja
// → 2 / 1; el `ws={ws}` de NuevaCampanaModal quitado → 2 / 1. Base: 3 / 0.
//
// Correr: node --import tsx --test tests/navegador-por-negocio.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const MODAL = sinComentarios(leer('../app/ads-manager/NuevaCampanaModal.tsx'));

test('el borrador de «Nueva campaña» se guarda y se lee con el negocio en la clave', () => {
  assert.match(MODAL, /const draftKey = \(ws: number \| null\) => `mako\.nuevaCampana\.draft\.v3:\$\{ws \?\? '-'\}`;/);
  assert.ok(!/wsDeBusqueda|useWs\(/.test(MODAL), 'el negocio llega del server, no del ?ws= de la pestaña');
  const usos = MODAL.match(/localStorage\.(getItem|setItem|removeItem)\(([^,)]+)/g) ?? [];
  assert.ok(usos.length >= 3);
  for (const u of usos) assert.ok(/\(draftKey\(|\(DRAFT_KEY_VIEJA/.test(u), `un acceso al borrador sin el negocio: ${u}`);
});

test('el negocio sale del SERVER y baja hasta el borrador y la calculadora', () => {
  const vista = sinComentarios(leer('../app/ads-manager/AdsManagerView.tsx'));
  assert.match(vista, /const ws = await getWorkspaceActual\(\)/);
  assert.match(vista, /<OnboardingAdsManager ws=\{ws\}/);
  assert.match(vista, /<CampanasBrowser ws=\{ws\}/);
  assert.match(sinComentarios(leer('../app/ads-manager/CampanasBrowser.tsx')), /<NuevaCampanaModal ws=\{ws\}/);
});

test('el borrador viejo (sin negocio) no se migra: se borra, porque no se sabe de quién era', () => {
  assert.match(MODAL, /window\.localStorage\.removeItem\(DRAFT_KEY_VIEJA\)/);
  assert.ok(!/getItem\(DRAFT_KEY_VIEJA\)/.test(MODAL), 'leer el borrador viejo es restaurar el de otro negocio');
});
