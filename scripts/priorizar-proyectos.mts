// El Perro juzga TODOS los proyectos del plan del dueño, con su metodología completa.
// Uso: node --conditions react-server --import tsx scripts/priorizar-proyectos.mts [ws] [--aplicar]
import { config } from 'dotenv';
config({ path: '.env.local' });
const ws = Number(process.argv[2] || 9);
const aplicar = process.argv.includes('--aplicar');
const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');

const antes = await runWithWorkspace(ws, async () => {
  const db = await getTenantDb();
  const { data } = await db.from('plan_proyectos').select('id,name,score,score_razon');
  return (data ?? []) as Array<{ id: string; name: string; score: number; score_razon: string | null }>;
});
console.log(`\n-- ANTES: top 12 de ${antes.length} proyectos --`);
antes.slice().sort((a, b) => b.score - a.score).slice(0, 12)
  .forEach((p, i) => console.log(`  ${String(i + 1).padStart(2)}. [${String(p.score).padStart(3)}] ${p.name.slice(0, 42).padEnd(42)} ${(p.score_razon ?? '—').slice(0, 70)}`));

if (!aplicar) { console.log('\n(dry run · pasá --aplicar para que el Perro los juzgue)'); process.exit(0); }

const { priorizarProyectosOwner } = await import('../lib/plan-board');
const r = await runWithWorkspace(ws, () => priorizarProyectosOwner('Repriorización completa de proyectos'));
console.log(`\n${r.error ? `✗ ${r.error}` : `✓ ${r.movidos}/${r.total} movidos · norte → «${r.norte}»`}`);
if (r.fallas) console.log(`\nAUDITORÍA:\n${r.fallas}`);

const despues = await runWithWorkspace(ws, async () => {
  const db = await getTenantDb();
  const [p, t] = await Promise.all([
    db.from('plan_proyectos').select('id,name,score,score_razon,escalon,desbloquea,impacto,esfuerzo'),
    db.from('plan_tareas').select('progress,labels'),
  ]);
  const abiertas = new Map<string, number>();
  for (const r of (t.data ?? []) as any[]) { if ((r.progress ?? 0) < 100) for (const l of r.labels ?? []) abiertas.set(l, (abiertas.get(l) ?? 0) + 1); }
  return { proys: (p.data ?? []) as any[], abiertas };
});
const ESC = ['', '1 cobrar', '2 conversación', '3 no perder', '4 convertir', '5 construir'];
console.log(`\n-- DESPUÉS: top 15 --`);
despues.proys.slice().sort((a, b) => b.score - a.score).slice(0, 15).forEach((p, i) => {
  const ant = antes.find(x => x.id === p.id)?.score ?? 0;
  console.log(`  ${String(i + 1).padStart(2)}. [${String(p.score).padStart(3)}] (era ${String(ant).padStart(3)}) esc.${ESC[p.escalon ?? 0] || '?'} · ${despues.abiertas.get(p.id) ?? 0} abiertas · ${p.name.slice(0, 38)}`);
  console.log(`        ${(p.score_razon ?? '—').slice(0, 150)}`);
});
console.log(`\n-- EL FONDO: los 6 últimos --`);
despues.proys.slice().sort((a, b) => a.score - b.score).slice(0, 6).forEach(p =>
  console.log(`  [${String(p.score).padStart(3)}] esc.${ESC[p.escalon ?? 0] || '?'} ${p.name.slice(0, 40).padEnd(40)} ${(p.score_razon ?? '—').slice(0, 90)}`));
const scores = despues.proys.map(p => p.score);
console.log(`\nrango: ${Math.min(...scores)}-${Math.max(...scores)} · empates: ${scores.length - new Set(scores).size} · >=80: ${scores.filter(s => s >= 80).length}/${scores.length}`);
const esc = new Map<number, number>(); for (const p of despues.proys) esc.set(p.escalon ?? 0, (esc.get(p.escalon ?? 0) ?? 0) + 1);
console.log('escalones:', [...esc].sort((a, b) => a[0] - b[0]).map(([e, n]) => `${e || '?'}:${n}`).join(' '));
process.exit(0);
