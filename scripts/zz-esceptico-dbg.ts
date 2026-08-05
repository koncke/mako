import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });
import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';
/* eslint-disable @typescript-eslint/no-explicit-any */
async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id').eq('capa', 'superadmin');
  const ws = ((wss ?? [])[0] as any).id;
  await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data: all } = await db.from('plan_propuestas').select('id, origen, tareas').order('created_at', { ascending: false }).limit(6);
    for (const p of (all ?? []) as any[]) {
      console.log(`id=«${p.id}» len=${p.id.length} origen=${p.origen} tareas=${Array.isArray(p.tareas) ? p.tareas.length : typeof p.tareas}`);
    }
    const target = ((all ?? []) as any[]).find((p) => p.origen === 'whatsapp');
    console.log(`\n→ usando id=«${target?.id}»`);
    for (const t of (target?.tareas ?? [])) {
      console.log(`  «${t.titulo}» proyecto=«${t.proyecto}» detalle(${(t.detalle ?? '').length}c): ${t.detalle}`);
    }
  });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
