// SIMULACIÓN de las dos reglas de envejecimiento sobre el tablero real. No escribe nada.
// Uso: node --conditions react-server --import tsx scripts/simular-envejecimiento.mts [ws]
import { config } from 'dotenv';
config({ path: '.env.local' });
const ws = Number(process.argv[2] || 9);
const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');
const { curveTaskScores, prioFromScore } = await import('../app/plan/board/types');
const HOY = Date.now(), DIA = 86400000;

// Los dos ajustes, en puntos de RANKING (no de score: el score final lo reparte la curva).
const empujeDeadline = (d: number | null): number => {
  if (d == null) return 0;
  if (d < 0) return 25;      // vencida
  if (d <= 3) return 20;
  if (d <= 7) return 12;
  if (d <= 14) return 6;
  return 0;
};
const castigoQuieta = (dias: number): number => (dias < 30 ? 0 : Math.min(20, dias - 29));

await runWithWorkspace(ws, async () => {
  const db = await getTenantDb();
  const { data } = await db.from('plan_tareas').select('id, title, score, progress, deadline, historial, created_at');
  type H = { ts: number; actor: string };
  const abiertas = ((data ?? []) as Array<{ id: string; title: string; score: number; progress: number; deadline: string | null; historial: H[]; created_at: string }>)
    .filter(t => (t.progress ?? 0) < 100);

  const alDeadline = (d: string | null) => (d ? Math.ceil((new Date(d + 'T12:00:00Z').getTime() - HOY) / DIA) : null);
  const diasQuieta = (t: { historial: H[]; created_at: string }) => {
    const hum = (t.historial ?? []).filter(h => h.actor === 'user').map(h => h.ts);
    return Math.floor((HOY - (hum.length ? Math.max(...hum) : new Date(t.created_at).getTime())) / DIA);
  };

  const conAjuste = abiertas.map(t => {
    const dl = alDeadline(t.deadline), q = diasQuieta(t);
    const emp = empujeDeadline(dl), cas = castigoQuieta(q);
    return { ...t, dl, q, emp, cas, rank: t.score + emp - cas };
  });

  const curva = curveTaskScores(conAjuste.map(t => ({ id: t.id, score: t.rank })));
  const fin = conAjuste.map(t => ({ ...t, nuevo: curva[t.id] ?? t.score }));

  const col = (s: number) => prioFromScore(s);
  const cambian = fin.filter(t => col(t.nuevo) !== col(t.score));
  const suben = cambian.filter(t => t.nuevo > t.score), bajan = cambian.filter(t => t.nuevo < t.score);

  console.log(`\n== ws ${ws} · ${abiertas.length} abiertas ==`);
  console.log(`cambian de COLUMNA: ${cambian.length} (${suben.length} suben, ${bajan.length} bajan)`);
  console.log(`tocadas por el empuje de deadline: ${conAjuste.filter(t => t.emp > 0).length}`);
  console.log(`tocadas por el castigo de quietud: ${conAjuste.filter(t => t.cas > 0).length}`);

  console.log('\n-- LAS 15 QUE MÁS SUBEN --');
  fin.slice().sort((a, b) => (b.nuevo - b.score) - (a.nuevo - a.score)).slice(0, 15)
    .forEach(t => console.log(`  ${String(t.score).padStart(2)} → ${String(t.nuevo).padStart(2)}  ${col(t.score)}→${col(t.nuevo)}  dl:${t.dl ?? '—'}  quieta:${t.q}d  ${t.title.slice(0, 48)}`));
  console.log('\n-- LAS 15 QUE MÁS BAJAN --');
  fin.slice().sort((a, b) => (a.nuevo - a.score) - (b.nuevo - b.score)).slice(0, 15)
    .forEach(t => console.log(`  ${String(t.score).padStart(2)} → ${String(t.nuevo).padStart(2)}  ${col(t.score)}→${col(t.nuevo)}  dl:${t.dl ?? '—'}  quieta:${t.q}d  ${t.title.slice(0, 48)}`));

  console.log('\n-- TOP 15 DESPUÉS (lo que verías arriba de todo) --');
  fin.slice().sort((a, b) => b.nuevo - a.nuevo).slice(0, 15)
    .forEach((t, i) => console.log(`  ${String(i + 1).padStart(2)}. [${t.nuevo}] (era ${t.score}) dl:${t.dl ?? '—'} ${t.title.slice(0, 58)}`));

  console.log('\n-- SOLO EL CASTIGO DE QUIETUD, sin el empuje: qué ALTAS se caerían --');
  const soloCas = abiertas.map(t => ({ ...t, q: diasQuieta(t), rank: t.score - castigoQuieta(diasQuieta(t)) }));
  const c2 = curveTaskScores(soloCas.map(t => ({ id: t.id, score: t.rank })));
  soloCas.filter(t => t.score >= 75 && (c2[t.id] ?? t.score) < 75)
    .forEach(t => console.log(`  ${t.score} → ${c2[t.id]}  quieta ${t.q}d · ${t.title.slice(0, 58)}`));
});
process.exit(0);
