// =============================================================================
// Un cliente nuevo no tiene que traer una API para arrancar
// =============================================================================
// Decisión de Martín (15/10/2026, Ticketera `clientes-usan-su-claude`, opción A): los
// clientes usan SU Claude o su ChatGPT para lo conversacional, el crédito de API de Claude
// Max entra por la key propia, y lo que contesta en vivo sigue con API. La parte del
// onboarding: el wizard del primer ingreso ya no exige una key de IA.
//
// Hasta ese día el paso `gemini` frenaba (`puedeAvanzar = geminiConectada`) con un
// porqué que había dejado de ser cierto: «sin una key, lo de después falla con "no hay
// IA"». Lo de después, en las dos capas que tienen el paso, es El Archivero, Productos y
// el plan de arranque, y los tres corren con la red de la plataforma.
//
// Este test fija las dos mitades JUNTAS: que el paso no frene, y que todo lo que viene
// después tenga red. Con la primera sola, un paso nuevo con IA sin red deja a un cliente
// sin keys trabado tres pantallas después, que es justo lo que el freno evitaba.
//
// Correr: npx tsx --test tests/onboarding-sin-api.test.ts
//
// PROBADO ROMPIÉNDOLO el 15/10/2026, cada rotura restaurada DE MEMORIA. Base: 4 pasan, 0 fallan.
//   - vuelve `p.key === 'gemini' ? geminiConectada` al puedeAvanzar           → 3/1
//   - el título del paso deja de decir «(opcional)»                             → 3/1
//   - vuelve la frase «Sin ella, MaKo no puede analizar nada»                   → 3/1
//   - el plan de arranque (lib/todo-seed-ia.ts) sin redDePlataforma              → 3/1
//   - Productos (lib/productos-ia.ts) sin redDePlataforma                        → 3/1
//   - un paso con IA nuevo (`avatares`) en una capa que tiene el paso de la IA   → 3/1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAPAS } from '../lib/capas';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const WIZARD = leer('app/onboarding/OnboardingWizard.tsx');

/** La sentencia entera del `puedeAvanzar`: desde su `const` hasta el `;` de fin de línea. */
function puedeAvanzar(): string {
  const ini = WIZARD.indexOf('const puedeAvanzar =');
  assert.ok(ini > 0, 'no encuentro `puedeAvanzar` en el wizard');
  const fin = WIZARD.indexOf(';\n', ini);
  const b = WIZARD.slice(ini, fin);
  // Contra un recorte desbocado: medido el 15/10/2026, la sentencia son ~2.100 caracteres.
  assert.ok(b.length > 300 && b.length < 6000, `el recorte de puedeAvanzar mide ${b.length}: está mirando otra cosa`);
  return sinComentarios(b);
}

test('el paso de la IA no frena el wizard', () => {
  assert.doesNotMatch(puedeAvanzar(), /'gemini'/, 'el paso de la IA volvió a exigir una key para avanzar');
  // Y se dice que es opcional, en el título del paso.
  assert.match(WIZARD, /key: 'gemini', paso, pregunta: '[^']*\(opcional\)'/);
});

test('la pantalla ya no afirma que sin key MaKo no puede analizar nada', () => {
  // Era la frase del recuadro de antes, y con el paso opcional pasa a ser falsa.
  assert.doesNotMatch(sinComentarios(WIZARD), /no puede analizar nada/);
});

// Lo que cada paso con IA llama, y dónde vive. Un paso que no está acá ni en SIN_IA
// hace fallar el test de abajo: sumarlo es decidir si tiene red.
const CON_IA: Record<string, string[]> = {
  archivero: ['app/api/onboarding/archivero/route.ts', 'lib/onboarding.ts'],
  productos: ['lib/productos-ia.ts'],
};
// fase: preguntas y un cálculo · tabs: el teléfono de los reportes · integraciones: Meta y compañía.
const SIN_IA = new Set(['fase', 'gemini', 'tabs', 'integraciones']);

test('todo lo que viene después del paso de la IA corre con la red de la plataforma', () => {
  const conPaso = Object.values(CAPAS).filter((c) => c.onboarding.includes('gemini'));
  assert.ok(conPaso.length >= 1, 'ninguna capa tiene el paso de la IA: este test quedó mirando nada');
  for (const capa of conPaso) {
    for (const paso of capa.onboarding) {
      if (SIN_IA.has(paso)) continue;
      const archivos = CON_IA[paso];
      assert.ok(archivos, `capa ${capa.id}: el paso «${paso}» no está clasificado. Si usa IA, necesita redDePlataforma (un cliente sin keys llega hasta acá)`);
      for (const f of archivos) {
        assert.match(leer(f), /redDePlataforma: true/, `${f} (paso ${paso}) no tiene red: un cliente sin keys se traba ahí`);
      }
    }
  }
});

test('el plan de arranque, que corre al cerrar el wizard, también tiene red', () => {
  const src = leer('lib/todo-seed-ia.ts');
  const ini = src.indexOf("feature: 'plan-seed-ia'");
  assert.ok(ini > 0, 'no encuentro la llamada del plan de arranque');
  const llamada = sinComentarios(src.slice(src.lastIndexOf('chatCheapCascade({', ini), src.indexOf('});', ini)));
  assert.match(llamada, /redDePlataforma: true/, 'sin red, un cliente sin keys termina el wizard sin su plan');
});
