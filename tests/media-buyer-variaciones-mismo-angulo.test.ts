// =============================================================================
// Las variaciones del ganador mantienen su ángulo (14/11/2026)
// =============================================================================
// Martín a Julio (13/11, min 00:51:25): las variaciones del anuncio ganador van «con el mismo copy, ángulo, dolor y avatar». El
// pedido a la IA (lib/media-buyer/variaciones-prompt.ts) decía lo contrario: «cada variación prueba un ángulo distinto». Fija que
// conserva el ángulo, el dolor y el avatar, y que lo que cambia es el gancho.
// Correr: node --import tsx --test tests/media-buyer-variaciones-mismo-angulo.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { promptVariaciones } from '../lib/media-buyer/variaciones-prompt';

test('conserva ángulo, dolor y avatar; cambia sólo el gancho', () => {
  for (const tipo of ['texto', 'hook'] as const) {
    const { system } = promptVariaciones({ tipo, textoPrincipal: 'Texto', titulo: null, transcripcion: null, porQueGana: '8 leads', perfilNegocio: '' });
    assert.match(system, /Conserva el ÁNGULO, el DOLOR, el AVATAR/);
    assert.match(system, /cambia es sólo el GANCHO/);
    assert.doesNotMatch(system, /ángulo distinto/, 'la regla vieja pedía lo contrario');
  }
});
