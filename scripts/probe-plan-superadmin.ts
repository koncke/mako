// =============================================================================
// probe-plan-superadmin — foto completa del board /plan del dueño. SOLO LEE.
// =============================================================================
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-plan-superadmin.ts
//   ... --json  → vuelca el JSON crudo para analizarlo con agentes
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';

const JSONOUT = process.argv.includes('--json');

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id, nombre, capa').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number; nombre: string } | undefined;
  if (!ws) throw new Error('no encontré el workspace con capa=superadmin');
  if (!JSONOUT) console.log(`workspace superadmin: #${ws.id} «${ws.nombre}»\n`);

  await runWithWorkspace(ws.id, async () => {
    const db = await getTenantDb();
    const { data: proys } = await db.from('plan_proyectos').select('*').order('orden');
    const { data: tars } = await db.from('plan_tareas').select('*').order('num');
    type P = { id: string; pid: string; name: string; emoji: string | null; color: string | null; score: number | null; detalle: string | null };
    type T = {
      id: string; num: number; title: string; detalle: string | null; score: number | null; priority: string | null;
      progress: number | null; deadline: string | null; labels: string[] | null; fuente: unknown; historial: unknown;
      created_at: string | null; checklist: unknown; argumento: string | null;
    };
    const P = (proys ?? []) as unknown as P[];
    const T = (tars ?? []) as unknown as T[];

    if (JSONOUT) {
      console.log(JSON.stringify({ ws: ws.id, proyectos: P, tareas: T }, null, 1));
      return;
    }

    const nom = new Map(P.map((p) => [p.id, p.name]));
    console.log(`PROYECTOS (${P.length})`);
    for (const p of P) {
      const n = T.filter((t) => (t.labels ?? []).includes(p.id));
      const abiertas = n.filter((t) => (t.progress ?? 0) < 100).length;
      console.log(`  ${(p.pid ?? p.id).padEnd(6)} ${(p.emoji ?? '·')} ${p.name.padEnd(42).slice(0, 42)} score=${String(p.score ?? '-').padStart(3)}  ${String(n.length).padStart(2)} tareas (${abiertas} abiertas)   det=${(p.detalle ?? '').length}`);
    }

    console.log(`\nTAREAS (${T.length} · ${T.filter((t) => (t.progress ?? 0) < 100).length} abiertas)`);
    for (const t of T) {
      const labs = (t.labels ?? []).map((l) => nom.get(l) ?? `?${l}`).join(', ') || '— SIN PROYECTO —';
      const f = t.fuente as { tipo?: string; etiqueta?: string } | null;
      const det = (t.detalle ?? '').replace(/\s+/g, ' ').trim();
      console.log(`\n  #${String(t.num).padStart(3)} [${String(t.score ?? '-').padStart(3)}|${t.priority ?? '?'}|${t.progress ?? 0}%] ${t.title}`);
      console.log(`       proy: ${labs}   fuente: ${f?.tipo ?? '—'}${f?.etiqueta ? ` «${f.etiqueta.slice(0, 40)}»` : ''}   creada: ${(t.created_at ?? '').slice(0, 10)}`);
      console.log(`       detalle (${det.length} car): ${det.slice(0, 220)}${det.length > 220 ? '…' : ''}`);
    }

    // Señales rápidas
    const sinProy = T.filter((t) => !(t.labels ?? []).length);
    const sinDet = T.filter((t) => !(t.detalle ?? '').trim() && (t.progress ?? 0) < 100);
    console.log(`\n──────\nSIN PROYECTO: ${sinProy.length}  ${sinProy.map((t) => `#${t.num}`).join(' ')}`);
    console.log(`SIN DETALLE (abiertas): ${sinDet.length}  ${sinDet.map((t) => `#${t.num}`).join(' ')}`);
    const vacios = P.filter((p) => !T.some((t) => (t.labels ?? []).includes(p.id)));
    console.log(`PROYECTOS VACÍOS: ${vacios.length}  ${vacios.map((p) => `«${p.name}»`).join(' ')}`);
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
