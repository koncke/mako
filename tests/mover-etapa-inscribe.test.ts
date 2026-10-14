import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Mover un lead de etapa por `setPipelineStage` —el kanban, el ⚡ de un flujo, las confirmaciones de
 * MaKo— lo inscribe en la automatización de esa etapa en el acto, como `setBoardStageOverride`
 * (14/10/2026, inventario «MaKo por detrás» de Automations). Hasta ese día el CRON de la etapa
 * esperaba al barrido de la hora.
 *
 * Verificado rompiéndolo (base 1/0): sin la línea del disparo, 1 fallo.
 */

const LEADS = readFileSync(new URL('../lib/leads.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const cuerpo = (firma: string) => { const i = LEADS.indexOf(firma); assert.ok(i >= 0, `no encontré ${firma}`); const f = LEADS.indexOf('\nexport ', i + 10); return LEADS.slice(i, f < 0 ? undefined : f); };

test('setPipelineStage inscribe en la automatización de la etapa a la que llega, contra la que se veía', () => {
  const fn = cuerpo('export async function setPipelineStage(');
  assert.match(fn, /if \(antes && pipelineStageOf\(antes\) !== stageKey\) \{[\s\S]*?await enrolarPorEtapaDerivada\(id, stageKey, antes\.funnel_id \?\? null\);\s*\}/);
});
