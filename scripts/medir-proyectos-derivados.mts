// DRY RUN: qué pasaría si el score de cada proyecto se derivara de sus tareas.
// No escribe nada. Uso: node --conditions react-server --import tsx scripts/medir-proyectos-derivados.mts [ws]
import { config } from 'dotenv';
config({ path: '.env.local' });
const ws = Number(process.argv[2] || 9);
const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');

await runWithWorkspace(ws, async () => {
  const db = await getTenantDb();
  const [t, p] = await Promise.all([
    db.from('plan_tareas').select('title, score, progress, labels'),
    db.from('plan_proyectos').select('id, name, score'),
  ]);
  const proyectos = (t2 => t2)((p.data ?? []) as Array<{ id: string; name: string; score: number }>);
  const tareas = ((t.data ?? []) as Array<{ title: string; score: number; progress: number; labels: string[] }>).filter(x => (x.progress ?? 0) < 100);

  const porProy = new Map<string, Array<{ titulo: string; score: number }>>();
  for (const x of tareas) for (const pid of (x.labels ?? [])) {
    const a = porProy.get(pid); const it = { titulo: x.title, score: x.score ?? 0 };
    if (a) a.push(it); else porProy.set(pid, [it]);
  }

  const calc = proyectos.map(pr => {
    const ts = (porProy.get(pr.id) ?? []).slice().sort((a, b) => b.score - a.score);
    if (!ts.length) return { ...pr, nuevo: 1, max: 0, n: 0, top: '—' };
    const max = ts[0].score;
    const dens = Math.round(((ts[0]?.score ?? 0) + (ts[1]?.score ?? 0) + (ts[2]?.score ?? 0)) / 50);
    return { ...pr, nuevo: Math.min(100, max + dens), max, n: ts.length, top: ts[0].titulo };
  });

  const conTareas = calc.filter(c => c.n > 0);
  const sobrepasanAntes = tareas.filter(x => (x.labels ?? []).some(pid => { const pr = proyectos.find(q => q.id === pid); return pr && (x.score ?? 0) > pr.score; })).length;
  const sobrepasanDespues = tareas.filter(x => (x.labels ?? []).some(pid => { const c = calc.find(q => q.id === pid); return c && (x.score ?? 0) > c.nuevo; })).length;

  const antes = proyectos.slice().sort((a, b) => b.score - a.score);
  const despues = calc.slice().sort((a, b) => b.nuevo - a.nuevo || b.n - a.n);
  const empatesAntes = proyectos.length - new Set(proyectos.map(x => x.score)).size;
  const empatesDespues = conTareas.length - new Set(conTareas.map(x => x.nuevo)).size;

  console.log(`\n== ws ${ws} · ${proyectos.length} proyectos · ${tareas.length} tareas abiertas ==`);
  console.log(`tareas que superan a su proyecto:  ANTES ${sobrepasanAntes}   ·   DESPUÉS ${sobrepasanDespues}`);
  console.log(`empates de score entre proyectos:  ANTES ${empatesAntes}   ·   DESPUÉS ${empatesDespues} (sobre ${conTareas.length} con trabajo abierto)`);
  console.log(`proyectos vacíos: ${calc.length - conTareas.length} (antes iban de ${Math.min(...calc.filter(c => !c.n).map(c => c.score))} a ${Math.max(...calc.filter(c => !c.n).map(c => c.score))}, ahora todos en 1)`);

  console.log('\n-- TOP 12 ANTES --');
  antes.slice(0, 12).forEach((x, i) => { const c = calc.find(q => q.id === x.id)!; console.log(`${String(i + 1).padStart(2)}. [${String(x.score).padStart(3)}] ${x.name}  · ${c.n} pendientes, mejor tarea ${c.max || '—'}`); });
  console.log('\n-- TOP 12 DESPUÉS --');
  despues.slice(0, 12).forEach((x, i) => console.log(`${String(i + 1).padStart(2)}. [${String(x.nuevo).padStart(3)}] ${x.name}  · ${x.n} pendientes · «${x.top.slice(0, 50)}» (${x.max})`));

  console.log('\n-- LOS 10 QUE MÁS SUBEN --');
  calc.slice().sort((a, b) => (b.nuevo - b.score) - (a.nuevo - a.score)).slice(0, 10).forEach(x => console.log(`  ${String(x.score).padStart(3)} → ${String(x.nuevo).padStart(3)}  (${x.n} pend.)  ${x.name}`));
  console.log('\n-- LOS 10 QUE MÁS BAJAN --');
  calc.slice().sort((a, b) => (a.nuevo - a.score) - (b.nuevo - b.score)).slice(0, 10).forEach(x => console.log(`  ${String(x.score).padStart(3)} → ${String(x.nuevo).padStart(3)}  (${x.n} pend.)  ${x.name}`));
});
process.exit(0);
