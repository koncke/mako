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
// ese olvido. Son asserts sobre el fuente.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r/g, '');

// ⚠️ Hasta el 27/10/2026 este test miraba tres rutas a mano (campaign-create, ad-add, adset-add), las que escribían la tabla.
// Se borraron con el Ads Manager viejo (docs/hallazgos-ads.md → «Las rutas viejas de app/api/ads-manager»), y una lista de
// rutas que ya no existen no protege a la próxima que escriba: ahora se BARRE app/ y lib/. Todo insert lleva su
// `workspace_id:` a la vista y todo update filtra por `.eq('workspace_id'`. El 27/10 nadie inserta (abrirRegistro recibe el
// insert de quien lo llama) y el único update es `reclamarFila`, que filtra.
//   ROTO A PROPÓSITO (27/10/2026): sacando `.eq('workspace_id', ws)` de reclamarFila, pass 1 / fail 1 — éste.
const fuentes = execFileSync('git', ['ls-files', 'app', 'lib'], { encoding: 'utf8' }).split('\n').filter((f) => /\.(ts|tsx)$/.test(f));

test('cada registro de meta_campaign_drafts lleva el workspace, y cada update filtra por él', () => {
  assert.ok(fuentes.length > 500, `el barrido tiene que mirar el repo (vio ${fuentes.length} archivos)`);
  let updates = 0;
  for (const f of fuentes) {
    const src = leer(f);
    if (!src.includes("from('meta_campaign_drafts')")) continue;
    for (const m of src.matchAll(/\.from\('meta_campaign_drafts'\)\s*\.insert\(/g)) {
      const i = m.index ?? 0;
      assert.match(src.slice(i, src.indexOf(')', src.indexOf('}', i))), /workspace_id:/, `${f}: el insert de la posición ${i} escribe el workspace`);
    }
    for (const m of src.matchAll(/\.from\('meta_campaign_drafts'\)\s*\.update\(/g)) {
      updates++;
      const i = m.index ?? 0;
      assert.match(src.slice(i, src.indexOf(';', i)), /\.eq\('workspace_id', /, `${f}: el update de la posición ${i} filtra por workspace`);
    }
  }
  assert.ok(updates >= 1, 'reclamarFila (lib/meta-idempotencia.ts) es un update de la tabla: si el barrido no lo ve, no mira nada');
});

test('la tabla está en TENANT_TABLES: cualquier lectura por getTenantDb queda scopeada', () => {
  assert.match(leer('lib/workspace.ts'), /'meta_campaign_drafts'/);
});
