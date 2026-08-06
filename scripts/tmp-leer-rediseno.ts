// TEMPORAL — solo lee las tareas del rediseño del board del dueño.
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/tmp-leer-rediseno.ts
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';

const DESDE = Number(process.argv[2] ?? 516);
const HASTA = Number(process.argv[3] ?? 535);

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id, nombre, capa').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number; nombre: string } | undefined;
  if (!ws) throw new Error('no encontré el workspace superadmin');

  await runWithWorkspace(ws.id, async () => {
    const db = await getTenantDb();
    const { data: proys } = await db.from('plan_proyectos').select('id, name, emoji');
    const nom = new Map(((proys ?? []) as unknown as { id: string; name: string }[]).map((p) => [p.id, p.name]));
    const { data: tars } = await db.from('plan_tareas').select('num, title, detalle, score, priority, progress, labels, deadline, checklist').gte('num', DESDE).lte('num', HASTA).order('num');
    type T = { num: number; title: string; detalle: string | null; score: number | null; priority: string | null; progress: number | null; labels: string[] | null; deadline: string | null; checklist: unknown };
    for (const t of ((tars ?? []) as unknown as T[])) {
      const labs = (t.labels ?? []).map((l) => nom.get(l) ?? `?${l}`).join(', ');
      console.log(`\n\n═══ #${t.num} · [score ${t.score ?? '-'} · ${t.priority ?? '?'} · ${t.progress ?? 0}%] ${t.title}`);
      console.log(`proyecto: ${labs}${t.deadline ? ` · deadline ${t.deadline}` : ''}`);
      const ck = t.checklist as { texto?: string; hecho?: boolean }[] | null;
      if (Array.isArray(ck) && ck.length) console.log(`checklist: ${ck.map((c) => `${c.hecho ? '[x]' : '[ ]'} ${c.texto}`).join(' | ')}`);
      console.log(`---\n${t.detalle ?? '(sin detalle)'}`);
    }
    console.log(`\n\n(${(tars ?? []).length} tareas entre #${DESDE} y #${HASTA})`);
  });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
