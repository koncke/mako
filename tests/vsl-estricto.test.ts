// =============================================================================
// «No reprodujo el VSL» no se cumple para todos cuando la base no contesta (6/11/2026)
// =============================================================================
// `getVslEngagementMap` (lib/leads.ts) atrapaba el error y devolvía el mapa VACÍO. El motor de Automations lo lee para la
// cohorte «vio poco el VSL» y para la condición «No reprodujo el VSL» (lib/nutricion.ts): con el mapa vacío, una base caída
// hacía que TODOS «no lo vieron», y les salía el mensaje. Ahora el motor lo pide `estricto` y la lectura TIRA; la pantalla
// (lib/queries.ts) sigue tolerante.
//
// PROBADO ROMPIÉNDOLO (base 2 / 0):
//   · `getVslEngagementMap` sin el `if (opts.estricto) throw e;`                  → 1 / 1
//   · la condición del motor (`leerVsl`) sin `{ estricto: true }`                  → 1 / 1
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

test('ejecutando (tests/_vsl-estricto-hijo.ts): con la base caída, tolerante da vacío y estricto tira', () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_vsl-estricto-hijo.ts')], { cwd: RAIZ, encoding: 'utf8', timeout: 90_000 });
  const r = JSON.parse(salida) as { tolerante?: { tamano: number }; estricto?: { tiro: boolean }; fallo?: string };
  assert.equal(r.fallo, undefined, `el hijo falló: ${r.fallo}`);
  assert.equal(r.tolerante?.tamano, 0, 'la pantalla sigue tolerante: un mapa vacío');
  assert.equal(r.estricto?.tiro, true, 'quien decide con esto se entera de que no se pudo leer');
});

test('CABLEADO: el motor lo pide estricto en la condición y en las dos cohortes del VSL', () => {
  const src = leer('lib/nutricion.ts');
  assert.match(src, /const leerVsl = async \(\) => \(pide\('vsl'\) \? getVslEngagementMap\(visitantes, \{ estricto: true \}\) : null\);/);
  assert.equal((src.match(/getVslEngagementMap\(rows\.map\(\(r\) => r\.visitor_id\), \{ estricto: true \}\)/g) ?? []).length, 2, 'vio_vsl_sin_agendar y vio_poco_vsl');
  assert.doesNotMatch(src, /getVslEngagementMap\(rows\.map\(\(r\) => r\.visitor_id\)\);/, 'ninguna cohorte tolerante');
});

// Y el alcance (la revisión del 6/11/2026): una cohorte que no se pudo leer saltea ESA automatización, no corta las demás
// ni los envíos del negocio. Probado rompiéndolo (sin el try/catch alrededor de la cohorte): 2 / 1.
test('una cohorte que no se pudo leer saltea esa automatización, no el negocio', () => {
  const src = leer('lib/nutricion.ts');
  const c = src.slice(src.indexOf('export async function comprometerInscripciones('), src.indexOf('async function reclamarOcurrenciaExtra('));
  assert.ok(c.length > 1000, 'encontré comprometerInscripciones');
  assert.match(c, /try \{\n\s*cohorte = await leadsDeCohorte\(/);
  assert.match(c, /\} catch \(e\) \{\n\s*console\.error\(`\[nutricion\] la cohorte de la automatización #\$\{sec\.id\} no se pudo leer[^`]*`\);\n\s*continue;/);
});
