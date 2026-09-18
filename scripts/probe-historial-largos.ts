// =============================================================================
// probe-historial-largos — cuenta entradas de historial. SOLO LEE.
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-historial-largos.ts
// =============================================================================
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';
import { leerTodo } from '../lib/supabase-paginado';

type H = { id?: string; ts?: number; actor?: string; text?: string; kind?: string };
const arr = (v: unknown): H[] => (Array.isArray(v) ? (v as H[]) : []);

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id, nombre, capa').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number; nombre: string } | undefined;
  if (!ws) throw new Error('no hay ws superadmin');
  console.log(`ws superadmin #${ws.id} «${ws.nombre}»\n`);

  await runWithWorkspace(ws.id, async () => {
    const db = await getTenantDb();
    // Paginado con el helper y no a mano: el bucle de antes paginaba SIN `.order()`,
    // así que pasadas las 1000 filas el OFFSET de la página 2 caía sobre otro orden
    // y repetía/salteaba filas en silencio (el censo de 17/09 lo marcó como B7).
    const page = (tabla: string, cols: string) => leerTodo<Record<string, unknown>>(db, tabla, cols, { orden: 'id' });
    const P = await page('plan_proyectos', 'id, pid, name, historial');
    const T = await page('plan_tareas', 'id, num, title, historial');

    // ── proyectos ──
    let totalNoTask = 0, totalTodo = 0, maxP = 0, maxPName = '';
    const filas: Array<{ n: string; todo: number; noTask: number }> = [];
    for (const p of P) {
      const h = arr(p.historial);
      const noTask = h.filter((x) => x.kind !== 'task').length;
      totalTodo += h.length; totalNoTask += noTask;
      if (h.length > maxP) { maxP = h.length; maxPName = `${p.pid} ${p.name}`; }
      filas.push({ n: `${p.pid ?? ''} ${String(p.name).slice(0, 38)}`, todo: h.length, noTask });
    }
    console.log(`PROYECTOS: ${P.length}`);
    console.log(`  entradas de historial TOTALES:            ${totalTodo}`);
    console.log(`  entradas con kind!=='task' (las que agrega ProjTabHist): ${totalNoTask}`);
    console.log(`  máximo en UN proyecto: ${maxP}  («${maxPName}»)`);
    console.log(`  proyectos con >40 entradas: ${filas.filter((f) => f.todo > 40).length}`);
    console.log(`  top 12 por entradas:`);
    for (const f of filas.sort((a, b) => b.todo - a.todo).slice(0, 12)) {
      console.log(`    ${String(f.todo).padStart(3)} tot / ${String(f.noTask).padStart(3)} no-task  ${f.n}`);
    }

    // ── tareas ──
    let totalT = 0, maxT = 0, maxTName = '';
    const ft: Array<{ n: string; todo: number }> = [];
    for (const t of T) {
      const h = arr(t.historial);
      totalT += h.length;
      if (h.length > maxT) { maxT = h.length; maxTName = `#${t.num} ${t.title}`; }
      ft.push({ n: `#${t.num} ${String(t.title).slice(0, 44)}`, todo: h.length });
    }
    console.log(`\nTAREAS: ${T.length}`);
    console.log(`  entradas de historial TOTALES: ${totalT}`);
    console.log(`  máximo en UNA tarea: ${maxT}  («${maxTName}»)`);
    console.log(`  tareas con >20 entradas: ${ft.filter((f) => f.todo > 20).length} · >40: ${ft.filter((f) => f.todo > 40).length}`);
    console.log(`  top 10:`);
    for (const f of ft.sort((a, b) => b.todo - a.todo).slice(0, 10)) console.log(`    ${String(f.todo).padStart(3)}  ${f.n}`);
  });

  // ── boards de CLIENTE (todo_*) para comparar ──
  const { data: otros } = await svc.from('workspaces').select('id, nombre, capa').neq('capa', 'superadmin').limit(20);
  for (const w of ((otros ?? []) as Array<{ id: number; nombre: string; capa: string }>)) {
    try {
      await runWithWorkspace(w.id, async () => {
        const db = await getTenantDb();
        const { data: c } = await db.from('todo_categorias').select('id, nombre, historial');
        const { data: t } = await db.from('todo_tareas').select('id, historial');
        const cc = (c ?? []) as unknown as Record<string, unknown>[];
        const tt = (t ?? []) as unknown as Record<string, unknown>[];
        if (!cc.length && !tt.length) return;
        const sumC = cc.reduce((a, x) => a + arr(x.historial).length, 0);
        const maxC = Math.max(0, ...cc.map((x) => arr(x.historial).length));
        const sumT = tt.reduce((a, x) => a + arr(x.historial).length, 0);
        const maxT2 = Math.max(0, ...tt.map((x) => arr(x.historial).length));
        console.log(`\nws #${w.id} «${w.nombre}» (${w.capa}): categorías=${cc.length} hist=${sumC} (max ${maxC}) · tareas=${tt.length} hist=${sumT} (max ${maxT2})`);
      });
    } catch (e) { console.log(`\nws #${w.id}: ${(e as Error).message.slice(0, 90)}`); }
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
