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

for (const ruta of ['app/api/ads-manager/campaign-create/route.ts', 'app/api/ads-manager/ad-add/route.ts']) {
  test(`${ruta}: el registro de la campaña lleva el workspace, y el update filtra por él`, () => {
    const src = leer(ruta);
    const insert = src.slice(src.indexOf(".from('meta_campaign_drafts').insert("));
    assert.match(insert.slice(0, 400), /workspace_id: wsDraft,/, 'el insert tiene que escribir el workspace explícito');
    //   ROTO A PROPÓSITO (2026-09-11): sacando esa línea de campaign-create, pass 2 / fail 1 —
    //   el insert habría fallado por not null y la campaña no habría dejado ningún registro.
    assert.match(src, /\.from\('meta_campaign_drafts'\)\.update\([^)]*\)[^;]*\.eq\('workspace_id', wsDraft\)/, 'el update tiene que filtrar por workspace');
    assert.match(src, /const wsDraft = \(await getWorkspaceActual\(\)\) \?\? OWNER_WS;/);
  });
}

test('la tabla está en TENANT_TABLES: cualquier lectura por getTenantDb queda scopeada', () => {
  assert.match(leer('lib/workspace.ts'), /'meta_campaign_drafts'/);
});
