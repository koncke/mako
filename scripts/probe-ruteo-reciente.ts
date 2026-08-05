// Read-only: las últimas cargas del tablero del super-admin, con su proyecto.
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });
import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id, nombre').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number };
  await runWithWorkspace(ws.id, async () => {
    const db = await getTenantDb();
    const [{ data: p }, { data: t }] = await Promise.all([
      db.from('plan_proyectos').select('id, pid, name, created_at').order('created_at', { ascending: false }),
      db.from('plan_tareas').select('id, num, title, labels, created_at, fuente').order('created_at', { ascending: false }).limit(60),
    ]);
    const nombre = new Map((p ?? []).map((x: any) => [x.id, x.name]));
    console.log(`PROYECTOS (${(p ?? []).length}) — los 12 más nuevos:`);
    for (const x of (p ?? []).slice(0, 12) as any[]) console.log(`  ${x.pid ?? '--'} ${String(x.name).padEnd(46)} ${String(x.created_at).slice(0, 16)}`);
    console.log(`\nÚLTIMAS 45 TAREAS:`);
    for (const x of (t ?? []).slice(0, 45) as any[]) {
      const proys = (x.labels ?? []).map((id: string) => nombre.get(id) ?? id).join(' + ') || '(sin proyecto)';
      console.log(`  #${String(x.num).padEnd(4)} ${String(x.title).slice(0, 56).padEnd(58)} → ${proys}`);
    }
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
