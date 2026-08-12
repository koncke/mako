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
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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

// ---------------------------------------------------------------------------
// Un fallback que no cobra es una degradación silenciosa
// ---------------------------------------------------------------------------
// 12/8/2026. La MISMA llamada de Fathom, leída por dos workspaces con 65 segundos de
// diferencia: ws1 corrió sus 7 partes en `gemini-flash` y ws9 las suyas en
// `mistral-small`, porque el 429 de la cuota compartida lo mandó cascada abajo. Mismo
// prompt, mismo transcript: 74% de precisión contra 46%, 2 tareas inventadas contra 12.
// La tab decía «Gemini» y decía la verdad sobre la config — lo que corrió fue otra cosa.
//
// El cobro silencioso al menos deja rastro en la factura. Este no deja nada.

test('las features cuyo error ESCONDE trabajo no se pueden degradar de modelo', () => {
  // Extraer los compromisos de una reunión y decidir si dos tareas son la misma son
  // JUICIOS que después nadie revisa: un modelo peor no rompe, contesta mal, y una
  // respuesta mal hecha se ve igual que una bien hecha. Antes que degradar, se paga.
  for (const f of ['plan-fathom', 'mako-guardian']) {
    const fila = CATALOGO_MODELOS.find((x) => x.feature === f);
    assert.ok(fila, `desapareció la feature ${f}`);
    assert.deepEqual(fila!.fallback, [], `${f} volvió a poder caerse a cualquier proveedor`);
  }
});

test('la lista de proveedores de la cascada es la misma que la de ai-cheap', () => {
  // `ProvCascada` está copiada en el catálogo porque `lib/ai-cheap.ts` es `server-only` y
  // este archivo lo lee el test. Copiada sin guarda, el día que se agregue un proveedor
  // esta lista se queda vieja y un `fallback` podría nombrar a alguien que ya no existe.
  const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'ai-cheap.ts'), 'utf8');
  const m = src.match(/export type ProvName\s*=\s*([^;]+);/);
  assert.ok(m, 'no pude leer ProvName de lib/ai-cheap.ts');
  const deAllá = [...m![1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]).sort();
  const src2 = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'model-catalogo.ts'), 'utf8');
  const m2 = src2.match(/export type ProvCascada\s*=\s*([^;]+);/);
  assert.ok(m2, 'no pude leer ProvCascada de lib/model-catalogo.ts');
  const deAcá = [...m2![1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(deAcá, deAllá);
});

test('un `fallback` declarado solo nombra proveedores que existen', () => {
  const validos = new Set(['groq', 'openai', 'gemini', 'cerebras', 'mistral', 'openrouter']);
  for (const f of CATALOGO_MODELOS) {
    for (const p of f.fallback ?? []) {
      assert.ok(validos.has(p), `${f.feature}: «${p}» no es un proveedor de la cascada`);
    }
  }
});
