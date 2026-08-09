// =============================================================================
// Un default que cobra es un cobro silencioso
// =============================================================================
// El caso que lo probó llegó como un reclamo: «el Perro sigue utilizando a Claude
// para tareas simples». El Perro no tenía nada que ver — hacía meses que corría en
// Gemini. Lo que cobraba era `plan-fathom`, la extracción de tareas de una reunión:
// corre SOLA en cada reunión nueva, parte el transcript en 4 pedazos de ~40k tokens
// y nunca tuvo override, así que caía en su default (`SONNET`) y facturaba ~US$1
// por reunión sin decirlo en ningún lado. Con ella, otras cuatro.
//
// La causa NO fue un bug: `/modelos-ia` solo escribe un override cuando alguien
// toca el botón, y a esas cinco nadie se las tocó. O sea: la regla «esto va en
// Gemini» vivía en un botón, y una regla que vive en un botón no es una regla
// (AGENTS.md → «Una regla en un prompt no es una regla»).
//
// Estos tests son la segunda capa. El default de una feature es gratis, y si cobra
// tiene que decir por qué.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO_MODELOS, PROVEEDORES_PAGOS } from '../lib/model-catalogo';

const pagos = () => CATALOGO_MODELOS.filter((f) => PROVEEDORES_PAGOS.includes(f.def.provider));

test('EL PEDIDO: ninguna feature cobra por default sin decir por qué', () => {
  const mudas = pagos().filter((f) => !f.pagoPorque?.trim());
  assert.deepEqual(
    mudas.map((f) => f.feature),
    [],
    `Estas features cobran por default y no justifican el gasto. O les ponés un ` +
    `proveedor gratis en \`def\`, o les escribís \`pagoPorque\` explicando qué se ` +
    `compra con esa plata:\n  ${mudas.map((f) => f.feature).join('\n  ')}`,
  );
});

test('la justificación es una frase de verdad, no un placeholder', () => {
  for (const f of pagos()) {
    assert.ok(
      (f.pagoPorque ?? '').length >= 60,
      `${f.feature}: \`pagoPorque\` tiene que explicar qué se compra, no ser un rótulo (${f.pagoPorque?.length ?? 0} caracteres)`,
    );
  }
});

test('las tres que sí valen la plata siguen siendo esas tres', () => {
  // Si esta lista crece, que sea a propósito y que se vea en el diff. Son los
  // análisis pesados sobre datos reales, lo único que el cliente paga a sabiendas.
  assert.deepEqual(pagos().map((f) => f.feature).sort(), ['closing', 'experimentos', 'lead_insights']);
});

test('el Perro y su coach NUNCA vuelven a un modelo pago por default', () => {
  // Son las dos llamadas que más se disparan del producto: cada lote de tareas las
  // invoca, y un lote son 40 tareas. Y no llevan PII — miran títulos y detalles de
  // tareas del propio negocio, no datos de clientes.
  for (const feature of ['mako-guardian', 'checklist-coach', 'plan-fathom']) {
    const f = CATALOGO_MODELOS.find((x) => x.feature === feature);
    assert.ok(f, `falta la feature ${feature} en el catálogo`);
    assert.ok(
      !PROVEEDORES_PAGOS.includes(f.def.provider),
      `${feature} volvió a un proveedor pago (${f.def.provider}/${f.def.model}). Es lo que disparó el reclamo.`,
    );
  }
});

test('cada feature tiene feature, label y grupo — la UI los pinta', () => {
  const vistos = new Set<string>();
  for (const f of CATALOGO_MODELOS) {
    assert.ok(f.feature.trim(), 'feature vacío');
    assert.ok(f.label.trim(), `${f.feature} sin label`);
    assert.ok(f.grupo.trim(), `${f.feature} sin grupo`);
    assert.ok(f.def.provider && f.def.model, `${f.feature} sin modelo por default`);
    assert.ok(!vistos.has(f.feature), `feature duplicada: ${f.feature}`);
    vistos.add(f.feature);
  }
});
