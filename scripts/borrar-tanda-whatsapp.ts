// =============================================================================
// borrar-tanda-whatsapp — sacar del tablero la tanda que quedó mal ruteada
// =============================================================================
// El 5/8 un mensaje de WhatsApp de 2.687 chars sobre DOS features nuevas (Mindset y
// la Content Machine) terminó con las 5 tareas desparramadas en cuatro proyectos que
// no eran, porque al ruteador nunca le llegaba el `detalle`: veía cinco títulos
// sueltos. Arreglado en lib/mako-guardian.ts; esto limpia lo que quedó para poder
// mandar el mensaje de nuevo.
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/borrar-tanda-whatsapp.ts [--apply]
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';

const APLICAR = process.argv.includes('--apply');
const NUMS = [555, 556, 557, 558, 559];
const BORRADORES = ['propmsgl4cd8byg35'];

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id, nombre').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number; nombre: string };
  console.log(`${APLICAR ? '=== APLICANDO ===' : '=== SIMULACIÓN ==='}  ws ${ws.id} «${ws.nombre}»\n`);
  await runWithWorkspace(ws.id, async () => {
    const db = await getTenantDb();
    const [{ data: pr }, { data: ta }] = await Promise.all([
      db.from('plan_proyectos').select('id, name'),
      db.from('plan_tareas').select('id, num, title, labels, progress, historial').in('num', NUMS),
    ]);
    const nombre = new Map((pr ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
    const filas = (ta ?? []) as Array<{ id: string; num: number; title: string; labels: string[]; progress: number; historial: unknown[] }>;

    for (const t of filas) {
      const proy = (t.labels ?? []).map((id) => nombre.get(id) ?? id).join(' + ') || '(sin proyecto)';
      // GUARDA: si ya la tocaste (avance o historial tuyo), no se borra sola.
      const tocada = t.progress > 0 || (t.historial ?? []).some((h) => (h as { actor?: string }).actor === 'user');
      console.log(`  ${tocada ? '⛔' : '✂'} #${t.num} ${t.title.slice(0, 48).padEnd(50)} ${proy}`);
      if (tocada) { console.log('       (tiene trabajo tuyo encima: NO se borra)'); continue; }
      if (!APLICAR) continue;
      const { error } = await db.from('plan_tareas').delete().eq('id', t.id);
      console.log(error ? `       ✗ ${error.message}` : '       ✓ borrada');
    }
    if (filas.length !== NUMS.length) console.log(`\n  ⚠ esperaba ${NUMS.length} tareas y encontré ${filas.length}`);

    // El borrador vuelve a 'pendiente' NO: se borra. Si queda, el candado por `ref`
    // haría que el mensaje nuevo devuelva ESTE borrador viejo en vez de crear uno.
    for (const id of BORRADORES) {
      console.log(`\n  ✂ borrador ${id}`);
      if (!APLICAR) continue;
      const { error } = await db.from('plan_propuestas').delete().eq('id', id);
      console.log(error ? `       ✗ ${error.message}` : '       ✓ borrado');
    }
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
