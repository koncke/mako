// =============================================================================
// Lo que no se arregla reintentando: el teléfono que falta, y los leads de prueba de Meta (23/10/2026)
// =============================================================================
// La #198 del ws1 reintentaba cada 4 h y cada 24 h, para siempre, a leads de la Lead Ads Testing Tool de Meta («<test lead:
// dummy data for PHONE>»): un fallo por corrida que iba a fallar igual. Ahora el motor cierra la inscripción con su motivo
// (`terminal`) y a un lead de prueba no le escribe por ningún canal (lib/lead-sin-arreglo.ts).
//
// Correr: node --import tsx --test tests/lead-sin-arreglo.test.ts
// Probado rompiéndolo (23/10/2026, base 3/0): ver el pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esLeadDePruebaDeMeta, telefonoSinArreglo, MOTIVO_PRUEBA_META } from '../lib/lead-sin-arreglo';

const NUT = readFileSync(new URL('../lib/nutricion.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('el lead de prueba de Meta se reconoce por el nombre que le pone Meta, y nada más', () => {
  assert.equal(esLeadDePruebaDeMeta('<test lead: dummy data for full_name>'), true);
  assert.equal(esLeadDePruebaDeMeta('  <Test Lead: dummy data for FULL_NAME>'), true);
  assert.equal(esLeadDePruebaDeMeta('María del Carmen'), false);
  assert.equal(esLeadDePruebaDeMeta('Probando <test lead: dummy data>'), false, 'sólo si EMPIEZA así');
  assert.equal(esLeadDePruebaDeMeta(null), false);
});

test('el teléfono sin arreglo: vacío o sin ningún dígito; uno con dígitos sigue su camino', () => {
  assert.equal(telefonoSinArreglo(null), 'lead sin teléfono');
  assert.equal(telefonoSinArreglo('   '), 'lead sin teléfono');
  assert.equal(telefonoSinArreglo('<test lead: dummy data for PHONE>'), 'teléfono inválido');
  assert.equal(telefonoSinArreglo('526862506026'), null);
  // Uno de 10 dígitos sin código de país se arregla configurando la línea: no es de acá.
  assert.equal(telefonoSinArreglo('6862506026'), null);
});

test('el motor cierra (terminal) en vez de reintentar, en los dos WhatsApp, y el lead de prueba va primero', () => {
  assert.match(NUT, /if \(esLeadDePruebaDeMeta\(lead\?\.nombre\)\) \{[^}]*estado = 'fallo'; nota = MOTIVO_PRUEBA_META; terminal = true;\s*\} else if \(canalApagado\) \{/);
  const cierres = NUT.match(/if \(!lead\?\.telefono \|\| telefonoSinArreglo\(lead\.telefono\)\) \{[^]*?terminal = true;/g) ?? [];
  assert.equal(cierres.length, 2, 'uno de los dos WhatsApp (no oficial u oficial) sigue reintentando');
  assert.doesNotMatch(NUT, /nota = 'lead sin teléfono'; backoffHoras = 24;/, 'volvió el reintento diario del no oficial');
  assert.doesNotMatch(NUT, /backoffHoras = 24; \/\/ casi-permanente: 1 reintento\/día por si le cargan el teléfono/, 'volvió el del oficial');
  assert.ok(MOTIVO_PRUEBA_META.length > 10);
});

// ── Probado rompiéndolo (23/10/2026), de a una y restaurando. Base 3/0 ──
// R1 `telefonoSinArreglo` sin la regla de los dígitos                        → 2/1
// R2 el no oficial vuelve a `backoffHoras = 24` sin `terminal`               → 2/1
// R3 sin el corte del lead de prueba de Meta                                 → 2/1
