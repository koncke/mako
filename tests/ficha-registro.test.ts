// =============================================================================
// Lo que comparten el server y la pantalla de la ficha: el título que se dibuja y quién ve lo privado
// =============================================================================
// lib/ficha/registro.ts. Dos reglas del diseño (docs/diseno-ficha-bloques.md) viven ahí y se prueban
// EJECUTÁNDOLAS:
//   · «Cada bloque toma su título del nombre de la etapa y nunca dice "Reunión 1"» (§3, Reuniones).
//   · Decisión 5: «el puntaje y las recomendaciones de la llamada los ven el admin y el closer de ese lead».
//
// ⚠️ CAMBIADO A PROPÓSITO EL 14/10/2026 (segunda etapa del frente): la primera etapa probaba acá `seDibuja`
//    («lo de sólo lectura sin datos se calla»). Esa regla pasó a cada registro (`estaVacio`, la ejecuta
//    tests/ficha-armador.test.ts) porque un `datos != null` genérico no sabe que el motivo de un lead que no
//    salió no aplica aunque se llene ahí. En su lugar, quién ve lo privado.
//
// Correr: npx tsx --test tests/ficha-registro.test.ts
//
// ⚠️ VERIFICADO ROMPIÉNDOLO (14/10/2026, base 3/0), cada rotura restaurada antes de la siguiente:
//   · `tituloDeBloque` con la etapa por su lugar en la lista y no por ser reunión  → 2 / 1
//   · `esElCloserDelLead` comparando sin sacar tildes ni mayúsculas                → 2 / 1
//   · `vePrivado` dejando ver al closer los leads de OTRO closer                    → 2 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tituloDeBloque, esElCloserDelLead, rolDeFicha, vePrivado } from '../lib/ficha/registro';
import { bloqueDef } from '../lib/ficha/catalogo';

test('las reuniones se titulan con el nombre de SU etapa', () => {
  const etapas = [
    { key: 'lead', label: 'Lead entrante', kind: 'entrada' },
    { key: 'conversando', label: 'Conversación abierta', kind: 'paso' },
    { key: 'agenda', label: '1ª sesión sin costo', kind: 'reunion' },
    { key: 'facturando', label: 'Facturando', kind: 'pago' },
  ];
  assert.equal(tituloDeBloque(bloqueDef('reunion-1')!, etapas), '1ª sesión sin costo');
  assert.equal(tituloDeBloque(bloqueDef('reunion-2')!, etapas), 'Segunda reunión', 'sin segunda etapa de reunión, el del catálogo');
  assert.equal(tituloDeBloque(bloqueDef('cuotas')!, etapas), 'Cuotas');
  assert.equal(tituloDeBloque(bloqueDef('reunion-1')!, null), 'Primera reunión');
});

test('el closer de ESTE lead: por su nombre o su email, sin tildes ni mayúsculas', () => {
  const yo = { nombre: 'Sofía Pérez', email: 'sofi@negocio.com' };
  assert.equal(esElCloserDelLead('sofia perez', yo), true);
  assert.equal(esElCloserDelLead(' SOFI@negocio.com ', yo), true);
  assert.equal(esElCloserDelLead('Juan', yo), false);
  assert.equal(esElCloserDelLead(null, yo), false, 'un closer vacío no es de nadie');
  assert.equal(esElCloserDelLead('Sofía Pérez', null), false);
});

test('lo privado (el coaching de la llamada): el admin siempre, el closer sólo en sus leads', () => {
  const yo = { nombre: 'Sofía', email: 's@x.com' };
  assert.equal(rolDeFicha('admin'), 'admin');
  assert.equal(rolDeFicha(null), 'otro');
  assert.equal(rolDeFicha('usuario'), 'otro');
  assert.equal(vePrivado('admin', 'Juan', yo), true);
  assert.equal(vePrivado('closer', 'Sofía', yo), true);
  assert.equal(vePrivado('closer', 'Juan', yo), false, 'el closer no ve el puntaje de los leads de otro');
  assert.equal(vePrivado('setter', 'Sofía', yo), false);
});
