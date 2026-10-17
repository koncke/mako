// =============================================================================
// Worklist "Datos sin marcar": los dos silencios que dejó el fix de la etapa
// =============================================================================
// Al pasar la rama 'R' (reunión pasada sin desenlace) a mirar la etapa EFECTIVA
// en vez del override crudo, esa rama dejó de ser marginal y empezó a capturar
// leads que antes salían como 'A'. Arrastró dos efectos que nadie pidió:
//
//  1. el item 'R' viajaba con `faltantes: []`, así que esos leads DESAPARECÍAN de
//     BulkHigiene (que arma sus lotes con `m.faltantes`): "asignar Setter a 400
//     leads" perdía justo los que tienen la R1 pasada. Y la fila del worklist
//     dejaba de decir qué cargar.
//  2. `leerTodo` lanza cuando una lectura auxiliar falla; la excepción subía y los
//     dos consumidores la absorbían con `.catch(() => [])`. Resultado: lista vacía
//     con el cartel "✓ Todo marcado — datos al día". Un falso all-clear en la
//     pantalla que el producto trata como autoridad.
//
// Son guards de CABLEADO: el cuerpo de _getPendientesDeMarcar no se puede ejercitar
// sin Supabase, pero SÍ se puede exigir que los cables sigan donde deben.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Normalizado a \n: en Windows el CRLF rompe los cortes por bloque. */
const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('CABLEADO: el item de reunión pasada conserva sus faltantes', () => {
  const src = leer('../lib/queries.ts');
  const i = src.indexOf("tipo: 'R',");
  assert.notEqual(i, -1, "no encontré el item 'R' del worklist");
  const item = src.slice(i, i + 900);
  assert.ok(
    /faltantes:\s*faltan\b/.test(item),
    "el item 'R' tiene que llevar los faltantes reales: con [] se cae de BulkHigiene y de su propio detalle",
  );
  assert.ok(!/faltantes:\s*\[\]/.test(item), "volvió el `faltantes: []` que vaciaba los lotes");
});

test('CABLEADO: los faltantes se calculan ANTES de decidir el tipo de item', () => {
  // Si `faltantesDeLead` vuelve a quedar después del `continue` de la rama 'R',
  // el punto anterior es imposible de cumplir aunque el campo esté escrito.
  const src = leer('../lib/queries.ts');
  const fn = src.slice(src.indexOf('async function _getPendientesDeMarcar'));
  const cuerpo = fn.slice(0, fn.indexOf('\n}\n'));
  const iFaltan = cuerpo.indexOf('const faltanRaw = faltantesDeLead(');
  const iR = cuerpo.indexOf("tipo: 'R',");
  assert.ok(iFaltan > 0 && iR > 0, 'no encontré una de las dos piezas');
  assert.ok(iFaltan < iR, "faltantesDeLead tiene que correr antes de armar el item 'R'");
});

test('CABLEADO: una lectura auxiliar caída no se convierte en "todo al día"', () => {
  const src = leer('../lib/queries.ts');
  const fn = src.slice(src.indexOf('async function _getPendientesDeMarcar'));
  const cuerpo = fn.slice(0, fn.indexOf('\n}\n'));
  // pagos y lead_respuestas son ACCESORIAS: degradan y avisan, no tumban la lista.
  assert.ok(/'pagos'[\s\S]{0,300}?\.catch\(/.test(cuerpo), 'pagos tiene que degradar con aviso');
  assert.ok(/'lead_respuestas'[\s\S]{0,300}?\.catch\(/.test(cuerpo), 'lead_respuestas tiene que degradar con aviso');
  assert.ok(cuerpo.includes('avisos.push('), 'la degradación tiene que quedar dicha, no en silencio');
  assert.ok(/aviso:/.test(cuerpo), 'el aviso tiene que salir en la respuesta');
  // La lectura de leads sí rompe fuerte: sin leads no hay worklist que valga.
  assert.ok(
    /const data = await leerLeadsDePendientes\(supabase\);/.test(cuerpo),
    'la lectura de leads no lleva catch: un worklist sin leads no es un worklist',
  );
});

// ⚠️ LA VISTA «PENDIENTES» SE BORRÓ EL 16/10/2026 (Martín: «Elimina completamente lo de "/crm?pendientes"... Si quiero
// ir a corregir un dato sin marcar se debe abrir la ficha del lead, nunca redirección a otra ruta»). Con ella se fue
// el cartel «✓ Todo marcado» que este test cuidaba; queda que no vuelva, y que la página siga produciendo un aviso.
// Probado rompiéndolo (16/10/2026, base 6/0): devolverle 'pendientes' a CrmVista → 5 / 1; volver a poner
// `showSinMarcar` en el tablero → 5 / 1.
test('CABLEADO: la vista «pendientes» no vuelve, y una lectura caída sigue siendo un aviso', () => {
  const board = leer('../app/crm/CrmBoard.tsx');
  assert.doesNotMatch(board, /function SinMarcar\b|showSinMarcar|params\.set\('pendientes'/, 'volvió la vista de pendientes');
  assert.match(leer('../app/crm/CrmToolbar.tsx'), /export type CrmVista = 'kanban' \| 'tabla';/);
  const page = leer('../app/crm/page.tsx');
  assert.ok(page.includes('marcarAviso'), 'la página tiene que pasarle el aviso al board');
  assert.ok(
    /getPendientesDeMarcar\(hoy\)[\s\S]{0,400}?aviso:/.test(page),
    'el catch de la página tiene que producir un aviso, no una lista vacía muda',
  );
});

test('CABLEADO: el motivo de salida no llega pre-contestado al MOVER', () => {
  // El validador ya repregunta el motivo cuando el lead ENTRA a perdido/descal,
  // pero si el paso abre con la categoría vieja seleccionada la herencia sobrevive
  // igual: el resultado sale "<categoría anterior> - <detalle nuevo>".
  const src = leer('../app/crm/StageMoveDialog.tsx');
  assert.ok(
    /useState\(move\.yaRespondido\?\.motivo \?\? \(completarDatos \? lead\.motivo \?\? '' : ''\)\)/.test(src),
    'lead.motivo (el motivo_perdida persistido) solo puede precargar en "Completar datos"',
  );
});

test('CABLEADO: la etapa de origen se calcula con la regla de vigencia', () => {
  // Con el override CRUDO, un lead apuntando a una etapa que su funnel ya no tiene
  // (cientos en ws1) hacía que "Completar datos" exigiera un motivo nuevo y
  // bloqueara el guardado. La ficha decide la etapa con etapaVigenteDe: el server
  // tiene que usar la MISMA regla o las dos mitades hablan de leads distintos.
  const src = leer('../app/crm/actions.ts');
  const fn = src.slice(src.indexOf('function valoresDeRequisitos'));
  const cuerpo = fn.slice(0, fn.indexOf('\n}\n'));
  assert.ok(/etapaActual:[\s\S]*etapaVigenteDe\(before, stagesMove\)/.test(cuerpo), 'tiene que ir etapaVigenteDe');
  assert.ok(!/etapaActual:[\s\S]*pipelineStageOf/.test(cuerpo), 'el override crudo divergía de la ficha');
});
