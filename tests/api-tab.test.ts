// =============================================================================
// El plan del negocio también corta la API, y «no está en tu plan» se dice (17/10/2026)
// =============================================================================
// docs/hallazgos-planes-y-cobro.md: «El corte por capa es de PANTALLA, no de API» y «`requireCapa` no puede renderizar
// nada» (el cliente del plan chico veía un redirect mudo). Lo que se fija:
//   1. `tabDeRutaApi` (lib/api-tab.ts, puro): de qué tab es una ruta de app/api, por segmento entero;
//   2. la tabla sólo tiene APIs que usa UNA tab: un barrido de app/ y lib/ busca cada prefijo FUERA de su tab (si
//      mañana otra pantalla la usa, cortarla por tab rompería lo que el plan sí incluye: el test lo dice);
//   3. el cableado: el proxy pone la ruta (y pisa la del cliente), `resolverDesdeCookies` no da workspace a una API
//      fuera del plan, y `requireCapa` manda al cartel en vez de a la casa.
//
// Probado rompiéndolo (17/10/2026; base 5 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · tabDeRutaApi compara con startsWith pelado (/api/chats-x sería de Chats)       -> 4 / 1
//   · /api/crm en TAB_DE_API (la usan componentes compartidos y Automations)         -> 3 / 2
//   · el proxy no pone HEADER_RUTA                                                  -> 4 / 1
//   · resolverDesdeCookies sin apiFueraDelPlan                                      -> 4 / 1
//   · requireCapa vuelve al redirect mudo a homeDeCapa                              -> 4 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { COMPARTIDAS, HEADER_RUTA, TAB_DE_API, tabDeRutaApi } from '../lib/api-tab';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('la tab de una ruta de API, por segmento entero', () => {
  assert.equal(tabDeRutaApi('/api/ads-manager/creative-signurl'), 'ads-manager');
  assert.equal(tabDeRutaApi('/api/ads-manager'), 'ads-manager');
  assert.equal(tabDeRutaApi('/api/meta-write'), 'ads-manager');
  assert.equal(tabDeRutaApi('/api/chats/conversacion'), 'chats');
  assert.equal(tabDeRutaApi('/api/chats-x'), null, 'un prefijo que sólo empieza igual no es de esa tab');
  assert.equal(tabDeRutaApi('/api/crm/leads'), null, '/api/crm es compartida');
  assert.equal(tabDeRutaApi('/ads-manager'), null, 'una página no es una API');
  assert.equal(tabDeRutaApi(null), null);
});

/** Dónde se puede llamar la API de cada tab: su pantalla, su versión del teléfono, el super admin y la API misma. */
const PERMITIDOS: Record<string, string[]> = {
  'ads-manager': ['app/ads-manager/', 'app/m/ads/', 'app/anuncio/', 'app/admin/', 'lib/'],
  crm: ['app/crm/', 'app/m/crm/', 'app/admin/', 'lib/'],
  'landing-writer': ['app/web-generator/', 'app/landing-generator/', 'app/admin/', 'lib/'],
  setting: ['app/automations/', 'app/m/automations/', 'app/admin/', 'lib/'],
  chats: ['app/chats/', 'app/m/chats/', 'app/admin/', 'lib/'],
  copywriter: ['app/copywriter/', 'app/m/copywriter/', 'app/admin/', 'lib/'],
  'lead-magnet-generator': ['app/lead-magnet-generator/', 'app/m/lead-magnet-generator/', 'app/admin/', 'lib/'],
};

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${n}`;
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const st = statSync(join(RAIZ, rel));
    if (st.isDirectory()) { if (rel !== 'app/api') out.push(...archivos(rel)); }
    else if (/\.(tsx?|mjs)$/.test(n)) out.push(rel);
  }
  return out;
}

test('la tabla tiene sólo APIs de UNA tab (nadie más las llama) y ninguna compartida', () => {
  const todos = [...archivos('app'), ...archivos('lib')].map((f) => [f, readFileSync(join(RAIZ, f), 'utf8')] as const);
  const fuera: string[] = [];
  for (const [prefijo, tab] of TAB_DE_API) {
    assert.ok(!COMPARTIDAS.includes(prefijo), `${prefijo} está en las compartidas`);
    assert.ok(PERMITIDOS[tab], `falta decir dónde se usa la tab ${tab}`);
    const patron = new RegExp(`['\`"]${prefijo.replace(/[-/]/g, (c) => `\\${c}`)}(?:[/?'\`"])`);
    for (const [f, src] of todos) {
      if (f === 'lib/api-tab.ts') continue;
      if (patron.test(src) && !PERMITIDOS[tab].some((p) => relative(RAIZ, join(RAIZ, f)).replace(/\\/g, '/').startsWith(p))) fuera.push(`${prefijo} (${tab}) en ${f}`);
    }
  }
  assert.deepEqual(fuera, [], 'una API de la tabla la usa otra tab: cortarla por plan rompería esa pantalla');
});

test('el proxy pone la ruta pedida, y la pisa (no la elige el cliente)', () => {
  assert.equal(HEADER_RUTA, 'x-mako-ruta');
  assert.match(fuente('proxy.ts'), /headers\.set\(HEADER_RUTA, req\.nextUrl\.pathname\);/);
});

test('una API fuera del plan no recibe workspace', () => {
  const ws = fuente('lib/workspace.ts');
  assert.match(ws, /if \(propio != null && \(await apiFueraDelPlan\(propio\)\)\) return null;/);
  assert.match(ws, /const tab = tabDeRutaApi\(ruta\);\s*if \(!tab\) return false;/);
  assert.match(ws, /return fila != null && !tabEnCapa\(tab, fila\.capa\);/);
});

test('«no está en tu plan» se dice: requireCapa manda al cartel, no a la casa', () => {
  const t = fuente('lib/tab-access.ts');
  // Con el interruptor (APAGADO desde la revisión del 17/10: lib/api-tab.ts) vuelve a la casa del plan.
  assert.match(t, /if \(!tabEnCapa\(nav, capa\)\) redirect\(await rutaConWs\(CORTE_POR_PLAN_PRENDIDO \? `\/no-esta-en-tu-plan\?tab=\$\{encodeURIComponent\(nav\)\}` : homeDeCapa\(capa\)\)\);/);
  assert.match(fuente('app/no-esta-en-tu-plan/page.tsx'), /<PermissionState motivo="plan"/);
});

// La revisión adversarial del 17/10 frenó el corte por plan y el cartel (una capa `pm` veía «No está en tu plan» al
// entrar a /general): quedan APAGADOS hasta su arreglo y su revisión. Si alguien lo prende sin eso, esto lo dice.
test('el corte de la API por plan y el cartel están APAGADOS hasta su arreglo', () => {
  assert.match(fuente('lib/api-tab.ts'), /export const CORTE_POR_PLAN_PRENDIDO: boolean = false;/);
  assert.match(fuente('lib/workspace.ts'), /if \(!CORTE_POR_PLAN_PRENDIDO\) return false;/);
});
