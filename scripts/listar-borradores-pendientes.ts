// Read-only: los borradores pendientes del tablero del super-admin.
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });
import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id, nombre').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number; nombre: string };
  await runWithWorkspace(ws.id, async () => {
    const db = await getTenantDb();
    const { data } = await db.from('plan_propuestas').select('id, estado, origen, resumen, tareas, ref, created_at').order('created_at', { ascending: false }).limit(20);
    for (const p of (data ?? []) as any[]) {
      const n = Array.isArray(p.tareas) ? p.tareas.length : 0;
      console.log(`${p.estado.padEnd(11)} ${String(p.origen ?? '').padEnd(12)} ${n.toString().padStart(3)} tareas  ${String(p.created_at).slice(0,16)}  ${p.id}`);
      console.log(`            ${String(p.resumen ?? '').slice(0, 90)}${p.ref ? `   [ref ${p.ref}]` : ''}`);
    }
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
