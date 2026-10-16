// =============================================================================
// Un cliente nuevo no tiene que traer una API para arrancar
// =============================================================================
// Decisión de Martín (15/10/2026, Ticketera `clientes-usan-su-claude`, opción A): los
// clientes usan SU Claude o su ChatGPT para lo conversacional, el crédito de API de Claude
// Max entra por la key propia, y lo que contesta en vivo sigue con API. La parte del
// onboarding: el arranque no exige una key de IA.
//
// Desde el 16/10/2026 el onboarding es el CHAT DE ARRANQUE (app/onboarding/ChatArranque.tsx, reglas en
// lib/onboarding-arranque.ts): el paso `gemini` salió de las capas. Este test fija las dos mitades JUNTAS:
// que nada pida una key para arrancar, y que todo lo que llama IA en el arranque tenga red. Con la primera
// sola, un paso nuevo con IA sin red deja a un cliente sin keys trabado en la conversación.
// (Hasta el 16/10 este archivo leía el wizard viejo, que se borró; sus reglas siguen acá, sobre el chat.)
//
// Correr: npx tsx --test tests/onboarding-sin-api.test.ts
//
// PROBADO ROMPIÉNDOLO el 16/10/2026 (arnés romper-arranque.mjs en el scratchpad, restaura de memoria). Base:
// 4 pasan, 0 fallan (pasa / falla).
//   - vuelve el paso 'gemini' a la capa completo                                 → 2/2
//   - un paso con IA nuevo ('avatares') en la capa completo, sin clasificar      → 3/1
//   - la conversación de la oferta (lib/offer-ia.ts) sin su red de plataforma    → 3/1
//   - vuelve el corte «sin IA → carga tu key» a lib/offer-ia.ts                  → 3/1
//   - el plan de arranque (lib/todo-seed-ia.ts) sin redDePlataforma              → 2/2

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAPAS } from '../lib/capas';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el arranque no pide una key de IA: ninguna capa tiene el paso de la IA y el chat no la nombra', () => {
  for (const capa of Object.values(CAPAS)) {
    assert.ok(!capa.onboarding.includes('gemini'), `capa ${capa.id}: volvió el paso de la IA al onboarding`);
  }
  for (const f of ['app/onboarding/ChatArranque.tsx', 'lib/onboarding-arranque.ts']) {
    assert.doesNotMatch(sinComentarios(leer(f)), /GEMINI_API_KEY|API key|Conectar Claude|no puede analizar nada/, `${f} le pide una IA propia a quien arranca`);
  }
});

// Lo que cada paso con IA llama, dónde vive y cómo es su red. Un paso que no está acá ni en SIN_IA hace
// fallar el test de abajo: sumarlo es decidir si tiene red.
const CON_IA: Record<string, Array<{ archivo: string; red: RegExp }>> = {
  // La conversación de la oferta: `pedir` corre su propia red (y el crédito de Claude del onboarding).
  productos: [{ archivo: 'lib/offer-ia.ts', red: /provsGratisDePlataforma\(\)/ }],
  // El plan de arranque, que se escribe al cerrar.
  plan: [{ archivo: 'lib/todo-seed-ia.ts', red: /redDePlataforma: true/ }],
};
// negocio: el chat pregunta y escribe el brief con lo que dijo (sin IA) · fase: preguntas y un cálculo ·
// tabs: el teléfono de los reportes · integraciones: Meta, después y desde su tab.
const SIN_IA = new Set(['negocio', 'fase', 'tabs', 'integraciones']);

test('toda la lista de pasos de cada capa está clasificada, y lo que llama IA tiene red', () => {
  let mirados = 0;
  for (const capa of Object.values(CAPAS)) {
    for (const paso of capa.onboarding) {
      mirados++;
      if (SIN_IA.has(paso)) continue;
      const archivos = CON_IA[paso];
      assert.ok(archivos, `capa ${capa.id}: el paso «${paso}» no está clasificado. Si usa IA, necesita red (un cliente sin keys llega hasta acá)`);
      for (const { archivo, red } of archivos) {
        assert.match(sinComentarios(leer(archivo)), red, `${archivo} (paso ${paso}) no tiene red: un cliente sin keys se traba ahí`);
      }
    }
  }
  assert.ok(mirados >= 5, `sólo ${mirados} pasos en todas las capas: el test quedó mirando nada`);
});

test('NADA corta antes de la red: ningún «sin IA propia → carga tu key» en el camino del arranque', () => {
  // ⚠️ Una versión anterior de este test sólo miraba que la red estuviera escrita, y daba VERDE con El
  // Archivero cortando ANTES: tres `if (!(await docsIADisponible()))` devolvían «Carga tu API key de
  // Gemini» y la red no corría nunca (medido el 16/10/2026).
  const archivos = [...new Set([...Object.values(CON_IA).flat().map((x) => x.archivo), 'app/api/offer/route.ts'])];
  for (const f of archivos) {
    const src = sinComentarios(leer(f));
    assert.doesNotMatch(src, /if \(!\(await (docsIADisponible|cheapDisponible|sttDisponible)\(\)/,
      `${f} corta a quien no tiene IA propia ANTES de probar la red: un cliente nuevo sin API se traba ahí`);
  }
});

test('el plan de arranque, que corre al cerrar el onboarding, también tiene red', () => {
  const src = leer('lib/todo-seed-ia.ts');
  const ini = src.indexOf("feature: 'plan-seed-ia'");
  assert.ok(ini > 0, 'no encuentro la llamada del plan de arranque');
  const llamada = sinComentarios(src.slice(src.lastIndexOf('chatCheapCascade({', ini), src.indexOf('});', ini)));
  assert.match(llamada, /redDePlataforma: true/, 'sin red, un cliente sin keys termina el onboarding sin su plan');
});
