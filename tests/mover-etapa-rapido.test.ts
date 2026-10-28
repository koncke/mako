// MOVER DE ETAPA NO ESPERA AL PRIMER MENSAJE (27/10/2026). Leila, en la llamada con Martín (Fathom 876470842): «está
// tardando muchísimo en mover una etapa». El tablero ya movía la tarjeta en el acto; la ficha («Mover a…») esperaba a
// `setLeadStageAction`, y ésta a la vía rápida de la automatización de la etapa: MaKo escribiendo el mensaje y el WhatsApp
// no oficial con el HTTP abierto de 1 a 11 s por el tipeo. Ahora, cuando lo mueve una persona, el envío y su línea en el
// historial salen DESPUÉS de contestar (`after`), y el aviso de en qué automatización entró (o por qué no) no cambia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(__dirname, '..');
const nutricion = readFileSync(join(raiz, 'lib', 'nutricion.ts'), 'utf8').replace(/\r\n/g, '\n');

/** El cuerpo de una función de lib/nutricion.ts, hasta la próxima función de primer nivel. */
function cuerpo(nombre: string): string {
  const i = nutricion.indexOf(`async function ${nombre}(`);
  assert.ok(i >= 0, `no está ${nombre}`);
  const fin = nutricion.indexOf('\n}\n', i);
  return nutricion.slice(i, fin);
}

test('una persona que mueve un lead NO espera al primer mensaje: sale después de contestar', () => {
  const enrolar = cuerpo('enrolarPorEvento');
  const diferir = enrolar.indexOf('if (ctx?.persona && (await mandarDespuesDeContestar(leadId, entro))) return arrancadas;');
  const enElActo = enrolar.indexOf('try { await viaRapidaConTurno(leadId); }');
  assert.ok(diferir >= 0, 'la vía rápida de una persona sigue adentro de la acción: la ficha espera el envío');
  assert.ok(enElActo > diferir, 'se manda en el acto antes de mirar si lo movió una persona');
  // En qué automatizaciones entró (y por qué no volvió a una) se decide ANTES: el aviso de la pantalla no cambia.
  const informe = enrolar.indexOf('ctx.informe.entro.push');
  assert.ok(informe >= 0 && informe < diferir, 'el aviso de «entró / no entró» quedó para después de contestar');
  // En lote sigue sin vía rápida (lo manda el tick con el tope de la hora), y eso va antes.
  assert.ok(enrolar.indexOf('if (ctx?.sinViaRapida)') < diferir);
});

test('después de contestar: con el workspace fijado, en fila, y con su línea en el historial', () => {
  const diferir = cuerpo('mandarDespuesDeContestar');
  assert.match(diferir, /const ws = await getWorkspaceActual\(\)\.catch\(\(\) => null\);\n\s+if \(ws == null\) return false;/);
  assert.match(diferir, /colaDespuesDeResponder\.then\(\(\) => runWithWorkspace\(ws, async \(\) => \{/, 'sin el workspace fijado, después de contestar puede no haber cookies');
  assert.match(diferir, /try \{ await viaRapidaConTurno\(leadId\); \}/);
  assert.match(diferir, /await anotarLaEntrada\(leadId, entro\);/, 'el historial no dice si salió o por qué no');
  // Fuera de un pedido (un script, un test) no hay después: devuelve false y se manda en el acto.
  assert.match(diferir, /try \{\n\s+after\(mandar\);\n\s+return true;\n\s+\} catch \{\n\s+return false;\n\s+\}/);
});
