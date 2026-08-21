// Correr el Perro sobre proyectos que se crearon sin pasar por él.
// Uso: node --conditions react-server --import tsx scripts/perro-proyectos.mts <P81> <P82>…
import { config } from 'dotenv';
config({ path: '.env.local' });
const pids = process.argv.slice(2);
const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');
const { priorizarNuevasOwner } = await import('../lib/plan-board');
await runWithWorkspace(9, async () => {
  const db = await getTenantDb();
  const { data } = await db.from('plan_proyectos').select('id,pid,name,score').in('pid', pids);
  const ids = (data ?? []).map((p: { id: string }) => p.id);
  console.log('antes:', (data ?? []).map((p: { pid: string; name: string; score: number }) => `${p.pid} ${p.name} = ${p.score}`).join(' | '));
  const r = await priorizarNuevasOwner([], ids, 'Proyectos de CLIENTE recién creados: puntualos contra el resto del tablero, sin heredar ningún número puesto a mano.');
  console.log('perro:', r ? 'ok' : 'no devolvió nada');
  const { data: d2 } = await db.from('plan_proyectos').select('pid,name,score,score_razon').in('pid', pids);
  for (const p of d2 ?? []) console.log(`  ${p.pid} ${p.name} → ${p.score} · ${String(p.score_razon || '').slice(0, 120)}`);
});
