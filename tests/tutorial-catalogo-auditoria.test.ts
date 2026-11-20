// =============================================================================
// EL CATÁLOGO DE LOS TUTORIALES CONTRA LA AUDITORÍA DE LAS PAUSAS (20/11/2026)
// =============================================================================
// Los arreglos que viven en el catálogo, no en un componente: los `antes` y los `sel` de lib/tutoriales/*.ts y los `sel`,
// `espera_clic` y `cierra_despues` del manifiesto (public/tutoriales/manifiesto.json, que arma scripts/tutorial-animado desde
// guiones.json). Todos esos videos son sólo texto (`soloTexto`): ningún video cambia, sólo cuándo y qué marca el motor.
//   · spy-3/4/5: las pestañas viven adentro de un competidor abierto: el `antes` lo abre; la grilla, el de Contenido;
//   · api-5: «Generar» vive en Tokens: el `antes` la toca;
//   · ticketera-5: «Tus tickets (3)»: el selector «empieza con»;
//   · automations-3: el lienzo con una marca fija (`au-lienzo`), con o sin automatizaciones;
//   · calendar-4, classroom-4, image-3: tocar navega (Llamadas, la vista del alumno, un diseño nuevo): «Mira aquí», sin esperar;
//   · classroom-community-3: «Categorías» abre un modal que tapaba lo siguiente: se cierra después;
//   · report-problem-4/5 y offer-5: lo que marcaban no existe todavía en ese momento: sin marca, la voz lo narra.
// Probado rompiéndolo (20/11/2026, una rotura por vez y restaurada): 3 roturas (el antes de Spy, el «^=» del manifiesto, el
// espera_clic de calendar-4), y cada una tumba su test.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tutorialDe } from '../lib/tutoriales';
import { frasesDe, mismoLugar } from '../lib/tutoriales/videos';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const manifiesto = JSON.parse(leer('public/tutoriales/manifiesto.json')) as { videos: Array<{ key: string; frases?: unknown }> };
const frase = (key: string, n: number) => frasesDe(manifiesto.videos.find((v) => v.key === key)?.frases).find((f) => f.id === `${key}-${n}`);
const paso = (pestana: string, sel: string) => tutorialDe(pestana)?.pasos.find((p) => mismoLugar(p.sel, sel));

test('1. los `antes` del catálogo: el competidor de Spy, Contenido para la grilla, Tokens para Generar', () => {
  assert.equal(paso('spy', '[data-recorrido="spy-tab-anuncios"]')?.antes, '.spy-ccard[role="button"]');
  assert.equal(paso('spy', '[data-recorrido="spy-grilla"] div[role="button"]')?.antes, '[data-recorrido="spy-tab-contenido"]');
  assert.equal(paso('api', '[data-recorrido="tour-api-generar"]')?.antes, '[data-recorrido="tour-api-tokens"]');
  // El motor toma el `antes` del paso que marca lo mismo que la frase: la frase y el paso tienen que coincidir.
  for (const [k, n] of [['spy', 3], ['spy', 5], ['api', 5]] as const) {
    const f = frase(k, n);
    assert.ok(f?.sel && paso(k, f.sel)?.antes, `${k}-${n}: su paso trae el antes`);
  }
  assert.match(leer('app/competitor-spy/SpyApp.tsx'), /className="spy-ccard" role="button"/, 'la tarjeta del competidor que abre');
});

test('2. ticketera-5 y automations-3: los selectores que existen siempre', () => {
  assert.equal(frase('ticketera', 5)?.sel, 'button[aria-label^="Tus tickets"]');
  assert.ok(paso('ticketera', 'button[aria-label^="Tus tickets"]'), 'el paso del catálogo, igual');
  assert.equal(frase('automations', 3)?.sel, '[data-recorrido="au-lienzo"]');
  assert.ok(paso('automations', '[data-recorrido="au-lienzo"]'));
  assert.match(leer('app/automations/SimuladorWhatsApp.tsx'), /<div style=\{ESTILO_LIENZO\} data-recorrido="au-lienzo">/);
});

test('3. lo que navega es «Mira aquí»; lo que abre un modal se cierra; lo que no existe todavía no se marca', () => {
  for (const [k, n] of [['calendar', 4], ['classroom', 4], ['image', 3]] as const) assert.equal(frase(k, n)?.espera_clic, false, `${k}-${n}`);
  assert.equal(frase('classroom-community', 3)?.cierra_despues, true);
  for (const [k, n] of [['report-problem', 4], ['report-problem', 5], ['offer', 5]] as const) assert.equal(frase(k, n)?.sel, null, `${k}-${n}`);
  // El guion de donde sale el manifiesto, igual (si no, la próxima subida lo pisaba).
  const g = JSON.parse(leer('scripts/tutorial-animado/guiones.json')) as Array<{ id: string; pasos: Array<{ sel?: string; tipo?: string; cierra?: boolean }> }>;
  const pg = (id: string, n: number) => g.find((x) => x.id === id)?.pasos[n - 1];
  assert.equal(pg('calendar', 4)?.tipo, 'mira');
  assert.equal(pg('classroom-community', 3)?.cierra, true);
  assert.equal(pg('report-problem', 5)?.sel, undefined);
  assert.equal(pg('automations', 3)?.sel, '[data-recorrido="au-lienzo"]');
  assert.equal(pg('ticketera', 5)?.sel, 'button[aria-label^="Tus tickets"]', 'la Ticketera (los «Tus tickets» de un guion v3 viejo no se suben)');
});
