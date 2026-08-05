// =============================================================================
// limpiar-hacelo-en — sacar «Esto se hace en MaKo» de las tareas de desarrollo
// =============================================================================
// Sin --apply solo IMPRIME.
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/limpiar-hacelo-en.ts [--apply]
//
// El Perro leía «Ads Manager» en «rehacer la tabla del Ads Manager» y le ponía el botón
// «andá al Ads Manager»: confundía CONSTRUIR una pantalla con USARLA. En el tablero del
// super-admin TODAS las tareas son de construir el producto, así que ninguna lleva ese
// botón. De acá en adelante no vuelve a pasar (lib/plan-board.ts ya no le pasa la lista
// de capacidades al Perro para este board); esto limpia lo que quedó.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';

const APLICAR = process.argv.includes('--apply');

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id, nombre').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number; nombre: string };
  console.log(`${APLICAR ? '=== APLICANDO ===' : '=== SIMULACIÓN ==='}  ws #${ws.id} «${ws.nombre}»\n`);
  await runWithWorkspace(ws.id, async () => {
    const db = await getTenantDb();
    const { data } = await db.from('plan_tareas').select('id, num, title, hacelo_en').not('hacelo_en', 'is', null);
    const filas = (data ?? []) as Array<{ id: string; num: number; title: string; hacelo_en: string | null }>;
    const conValor = filas.filter((f) => (f.hacelo_en ?? '').trim());
    console.log(`tareas con «se hace en MaKo»: ${conValor.length}`);
    for (const f of conValor.slice(0, 30)) console.log(`  #${f.num} [${f.hacelo_en}] ${f.title.slice(0, 62)}`);
    if (conValor.length > 30) console.log(`  … y ${conValor.length - 30} más`);
    if (!APLICAR) { console.log('\n(simulación — nada se escribió)'); return; }
    let n = 0;
    for (const f of conValor) {
      const { error } = await db.from('plan_tareas').update({ hacelo_en: null, updated_at: new Date().toISOString() }).eq('id', f.id);
      if (error) console.error(`  ✗ #${f.num}: ${error.message}`); else n++;
    }
    console.log(`\n✓ ${n}/${conValor.length} limpiadas`);
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
