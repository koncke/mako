// DRY RUN del reparto completo: score_base + envejecimiento + dependencias + curva.
// No escribe nada. Uso: node --conditions react-server --import tsx scripts/simular-reparto.mts [ws]
import { config } from 'dotenv';
config({ path: '.env.local' });
const ws = Number(process.argv[2] || 9);
const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');
const { curveTaskScores, prioFromScore, sanearHist } = await import('../app/plan/board/types');
const { sanearDep, resolverDeps, estaBloqueada } = await import('../app/plan/board/dependencias');
const { diasQuieta, diasAlDeadline, ajusteTemporal } = await import('../app/plan/board/envejecer');
const AHORA = Date.now();

await runWithWorkspace(ws, async () => {
  const db = await getTenantDb();
  const [t, d] = await Promise.all([
    db.from('plan_tareas').select('id, num, title, score, score_base, progress, labels, deadline, historial, created_at').order('num', { ascending: true }),
    db.from('plan_dependencias').select('entidad, de_id, a_id, clase, razon, origen, confianza'),
  ]);
  const deps = (d.data ?? []).map(sanearDep).filter((x): x is NonNullable<typeof x> => x != null);
  const filas = ((t.data ?? []) as any[]).filter(r => (r.progress ?? 0) < 100).map(r => {
    const base = r.score_base ?? r.score;
    const dl = diasAlDeadline(r.deadline || undefined, AHORA);
    const q = diasQuieta(sanearHist(r.historial), r.created_at, AHORA);
    const aj = ajusteTemporal({ quieta: q, alDeadline: dl });
    return { id: r.id, num: r.num, title: r.title, base, dl, q, aj, score: Math.max(1, Math.min(100, base + aj.delta)), progress: r.progress, labels: r.labels ?? [], mostrado: r.score };
  });
  const est = resolverDeps({ tareas: filas, deps });
  const curva = curveTaskScores(est.orden.map(x => ({ id: x.id, score: est.urgencia[x.id] ?? x.score })));
  const fin = filas.map(f => ({ ...f, nuevo: curva[f.id] ?? f.mostrado }));

  const col = (s: number) => prioFromScore(s);
  const cambCol = fin.filter(f => col(f.nuevo) !== col(f.mostrado));
  console.log(`\n== ws ${ws} · ${filas.length} abiertas · ${deps.length} aristas ==`);
  console.log(`cambian de COLUMNA: ${cambCol.length}  (${cambCol.filter(f=>f.nuevo>f.mostrado).length} suben, ${cambCol.filter(f=>f.nuevo<f.mostrado).length} bajan)`);
  console.log(`empujadas por fecha: ${fin.filter(f=>f.aj.delta>0).length} · castigadas por quietud: ${fin.filter(f=>f.aj.delta<0).length} · frenadas: ${fin.filter(f=>estaBloqueada(f.id,est)).length}`);

  console.log('\n-- TOP 15 DESPUÉS --');
  fin.slice().sort((a,b)=>b.nuevo-a.nuevo).slice(0,15).forEach((f,i)=>
    console.log(`  ${String(i+1).padStart(2)}. [${String(f.nuevo).padStart(2)}] era ${String(f.mostrado).padStart(2)} ${estaBloqueada(f.id,est)?'🔒':'  '} ${f.title.slice(0,48).padEnd(48)} ${f.aj.razon}`));
  console.log('\n-- LAS 12 QUE MÁS SUBEN --');
  fin.slice().sort((a,b)=>(b.nuevo-b.mostrado)-(a.nuevo-a.mostrado)).slice(0,12).forEach(f=>
    console.log(`  ${String(f.mostrado).padStart(2)} → ${String(f.nuevo).padStart(2)}  ${col(f.mostrado)}→${col(f.nuevo)}  ${f.title.slice(0,44).padEnd(44)} ${f.aj.razon}`));
  console.log('\n-- LAS 12 QUE MÁS BAJAN --');
  fin.slice().sort((a,b)=>(a.nuevo-a.mostrado)-(b.nuevo-b.mostrado)).slice(0,12).forEach(f=>
    console.log(`  ${String(f.mostrado).padStart(2)} → ${String(f.nuevo).padStart(2)}  ${col(f.mostrado)}→${col(f.nuevo)}  ${f.title.slice(0,44).padEnd(44)} ${f.aj.razon}`));
});
process.exit(0);
