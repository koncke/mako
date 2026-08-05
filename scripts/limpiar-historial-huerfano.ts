// =============================================================================
// limpiar-historial-huerfano — sacar los renglones que apuntan a tarjetas borradas
// =============================================================================
// Al borrar la tanda de WhatsApp mal ruteada quedaron 4 renglones de historial en los
// proyectos que la habían recibido: «MaKo ruteó 1 tarea acá (en vez de crear un proyecto
// nuevo): «Diseñar módulo de Diagnóstico de Mindset»». Esas tarjetas ya no existen, así
// que el renglón cuenta una historia que no pasó.
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/limpiar-historial-huerfano.ts [--apply]
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';

const APLICAR = process.argv.includes('--apply');
/** Los títulos de las tareas borradas: un renglón que los nombre es huérfano. */
const BORRADAS = ['Diagnóstico de Mindset', 'matriz de impacto Mindset', 'herramientas prácticas de Mindset', 'arquitectura de la Content Machi', 'repositorio de ideas y referencias'];
type Hist = { id?: string; ts?: number; actor?: string; text?: string };

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number };
  console.log(`${APLICAR ? '=== APLICANDO ===' : '=== SIMULACIÓN ==='}  ws ${ws.id}\n`);
  await runWithWorkspace(ws.id, async () => {
    const db = await getTenantDb();
    const { data } = await db.from('plan_proyectos').select('id, name, historial');
    for (const p of (data ?? []) as Array<{ id: string; name: string; historial: Hist[] | null }>) {
      const hist = p.historial ?? [];
      const huerfanos = hist.filter((h) => /MaKo ruteó/i.test(h.text ?? '') && BORRADAS.some((t) => (h.text ?? '').includes(t)));
      if (!huerfanos.length) continue;
      console.log(`  [${p.name}] ${huerfanos.length} renglón(es):`);
      for (const h of huerfanos) console.log(`     ✂ ${String(h.text).slice(0, 92)}`);
      if (!APLICAR) continue;
      const limpio = hist.filter((h) => !huerfanos.includes(h));
      const { error } = await db.from('plan_proyectos').update({ historial: limpio, updated_at: new Date().toISOString() }).eq('id', p.id);
      console.log(error ? `     ✗ ${error.message}` : '     ✓ limpio');
    }
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
