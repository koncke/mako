// =============================================================================
// Lo que ESCRIBE el estado del onboarding lo lee estricto
// =============================================================================
// `getEstadoOnboarding` es tolerante: con la base caída devuelve el estado INICIAL. Sirve para dibujar y para
// decidir sin escribir. Para escribir es un desastre: el estado se guarda ENTERO, así que un patch sobre esa
// lectura le pone `pending` a un onboarding terminado y el cliente vuelve al arranque, sin un error.
//
// El 16/10/2026 el riesgo dejó de ser chico: el histórico arranca al conectar una integración
// (`arrancarHistoricoEnSegundoPlano`), así que el cron corre sus ticks —que escriben por `patchEstadoOnboarding`
// en cada paso— también sobre negocios que ya lo terminaron. Ese día el chat Offer pasó el cierre
// (`cerrarPasosOnboarding`) a la lectura estricta y señaló las demás; éste es el corte para todas.
//
// Correr: npx tsx --test tests/onboarding-escritura-estricta.test.ts
//
// PROBADO ROMPIÉNDOLO el 16/10/2026, cada rotura restaurada DE MEMORIA (los números, al pie del archivo).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')   // las líneas PRIMERO
  .replace(/\/\*[\s\S]*?\*\//g, ''); // y los bloques después
/** Las funciones de nivel superior del archivo, cada una con su cuerpo (hasta la próxima). */
function funciones(src: string): Array<{ nombre: string; cuerpo: string }> {
  const s = sinComentarios(src);
  const re = /^export (?:async )?function (\w+)|^async function (\w+)|^function (\w+)/gm;
  const marcas = [...s.matchAll(re)].map((m) => ({ nombre: m[1] ?? m[2] ?? m[3], i: m.index ?? 0 }));
  return marcas.map((m, k) => ({ nombre: m.nombre, cuerpo: s.slice(m.i, marcas[k + 1]?.i ?? s.length) }));
}

test('patchEstadoOnboarding lee estricto: es por donde escriben los ticks del histórico', () => {
  const patch = funciones(leer('lib/onboarding-state.ts')).find((f) => f.nombre === 'patchEstadoOnboarding');
  assert.ok(patch, 'no encontré patchEstadoOnboarding');
  assert.match(patch.cuerpo, /await getEstadoOnboardingEstricto\(\)/, 'patchEstadoOnboarding volvió a leer tolerante: con la base caída pisa un onboarding terminado');
  assert.doesNotMatch(patch.cuerpo, /getEstadoOnboarding\(\)/);
});

test('ninguna función que escribe el estado lo lee tolerante', () => {
  for (const archivo of ['lib/onboarding-state.ts', 'lib/onboarding-extract.ts']) {
    const escriben = funciones(leer(archivo)).filter((f) => /setEstadoOnboarding\(/.test(f.cuerpo) && f.nombre !== 'setEstadoOnboarding');
    assert.ok(escriben.length > 0, `${archivo}: no encontré quién escribe el estado (¿cambió la forma del archivo?)`);
    for (const f of escriben) {
      assert.doesNotMatch(f.cuerpo, /getEstadoOnboarding\(\)/, `${archivo} → ${f.nombre} escribe el estado entero sobre la lectura tolerante`);
    }
  }
  assert.match(leer('lib/onboarding-extract.ts'), /const s = estado \?\? await getEstadoOnboardingEstricto\(\);/,
    'iniciarExtraccion (la acción start) lee tolerante');
});

test('un escritor NUEVO del estado tiene que decidir cómo lee', () => {
  // En positivo: quién llama a setEstadoOnboarding, y por qué está bien. Uno nuevo falla acá.
  const ESCRITORES: Record<string, string> = {
    'lib/onboarding-state.ts': 'patchEstadoOnboarding y el cierre, los dos con la lectura estricta',
    'lib/onboarding-extract.ts': 'iniciarExtraccion, con la estricta (o el estado que leyó estricto quien la llama)',
    'lib/alta-cliente.ts': 'el alta de un negocio nuevo: escribe el estado inicial sin leer nada, que es lo correcto',
  };
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith('app/admin/dev/'));
  const escriben = archivos.filter((f) =>
    /\bsetEstadoOnboarding\(/.test(sinComentarios(leer(f)).replace(/export async function setEstadoOnboarding\(/, '')));
  assert.deepEqual(escriben.filter((f) => !(f in ESCRITORES)), [], 'un archivo nuevo escribe el estado del onboarding sin decidir cómo lo lee');
  for (const f of Object.keys(ESCRITORES)) assert.ok(escriben.includes(f), `${f} ya no escribe el estado: sacalo de la lista`);
});

// ROTURAS (16/10/2026), base 3/0:
//   - patchEstadoOnboarding vuelve a leer tolerante                    → 1/2
//   - iniciarExtraccion (la acción start) lee tolerante                → 2/1
//   - una función nueva de onboarding-state lee tolerante y escribe    → 2/1
//   - un archivo nuevo escribe el estado                               → 2/1
