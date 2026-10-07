// =============================================================================
// meta_campaign_drafts es POR CLIENTE: toda escritura lleva su workspace
// =============================================================================
// La 0045 creaba la tabla sin `workspace_id` y nunca se aplicó; la 0157 (aplicada el
// 2026-09-11) la creó con la columna `not null` y SIN default, a propósito: un
// default 1 le atribuiría a Mauricio la campaña de otro cliente. Verificado en la
// base ese día: un insert sin workspace_id se RECHAZA.
//
// Con eso, una ruta que se olvide del workspace no mezcla clientes — pierde el
// registro en silencio, porque el insert es best-effort. Este test es la red para
// ese olvido. Son asserts sobre el fuente (las rutas no se pueden importar en node:test).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r/g, '');

// adset-add se sumó el 07/10/2026 (tarea #59): hasta ahí no dejaba registro, y un corte
// con un segundo clic dejaba dos conjuntos sin que nada lo supiera. El modo simple de
// ad-add también registra desde ese día.
//   ROTO A PROPÓSITO (07/10/2026): sacando `workspace_id: wsDraft,` del insert de
//   adset-add, pass 3 / fail 1 — el de adset-add.
//
// ⚠️ Se miran TODOS los inserts y TODOS los updates de cada ruta, no el primero (revisión
// de la #59). ad-add tiene dos de cada uno —el modo simple, arriba, y el lote—, y desde que
// el simple registra, su insert pasó a ser el primero del archivo: el del lote quedó sin
// red. Medido sobre una copia de HEAD (código y tests): sin el workspace en el insert del
// lote, y aparte sin el `.eq` en su persist, pass 11 / fail 0 las dos veces (este archivo y
// tests/ads-video-procesando.test.ts). Y sin el workspace el insert falla
// por not null: con la clave puesta eso es un 503 a TODA publicación del lote.
// [ruta, cuántos inserts, cuántos updates]: si mañana aparece otro, el número lo dice.
const RUTAS: Array<[string, number, number]> = [
  ['app/api/ads-manager/campaign-create/route.ts', 1, 1],
  ['app/api/ads-manager/ad-add/route.ts', 2, 2],
  ['app/api/ads-manager/adset-add/route.ts', 1, 1],
];
for (const [ruta, nInserts, nUpdates] of RUTAS) {
  test(`${ruta}: cada registro lleva el workspace, y cada update filtra por él`, () => {
    const src = leer(ruta);
    const inserts = [...src.matchAll(/\.from\('meta_campaign_drafts'\)\.insert\(/g)];
    assert.equal(inserts.length, nInserts, 'cuántos inserts tiene la ruta');
    for (const m of inserts) {
      // Hasta el cierre del objeto: `}).select(`.
      const i = m.index ?? 0;
      const fila = src.slice(i, src.indexOf('}).select(', i));
      assert.match(fila, /workspace_id: wsDraft,/, `el insert de la posición ${i} tiene que escribir el workspace explícito`);
    }
    //   ROTO A PROPÓSITO (2026-09-11): sacando esa línea de campaign-create, pass 2 / fail 1 —
    //   el insert habría fallado por not null y la campaña no habría dejado ningún registro.
    const updates = [...src.matchAll(/\.from\('meta_campaign_drafts'\)\.update\(/g)];
    assert.equal(updates.length, nUpdates, 'cuántos updates tiene la ruta');
    for (const m of updates) {
      const i = m.index ?? 0;
      const sentencia = src.slice(i, src.indexOf(';', i));
      assert.match(sentencia, /\.eq\('workspace_id', wsDraft\)/, `el update de la posición ${i} tiene que filtrar por workspace`);
    }
    assert.match(src, /const wsDraft = \(await getWorkspaceActual\(\)\) \?\? OWNER_WS;/);
  });
}
//   ROTO A PROPÓSITO (07/10/2026), con este barrido, de a una: sin el workspace en el
//   insert del lote de ad-add → pass 3 / fail 1 (el de ad-add); sin el `.eq` del persist
//   del lote → pass 3 / fail 1 (el de ad-add).

test('la tabla está en TENANT_TABLES: cualquier lectura por getTenantDb queda scopeada', () => {
  assert.match(leer('lib/workspace.ts'), /'meta_campaign_drafts'/);
});
