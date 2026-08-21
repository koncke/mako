// DRY RUN de los dos umbrales de envejecimiento, contra los datos reales del tablero.
// No escribe nada. Uso: node --conditions react-server --import tsx scripts/medir-envejecimiento.mts [ws]
import { config } from 'dotenv';
config({ path: '.env.local' });
const ws = Number(process.argv[2] || 9);
const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');
const HOY = Date.now();
const DIA = 86400000;

await runWithWorkspace(ws, async () => {
  const db = await getTenantDb();
  const { data } = await db.from('plan_tareas').select('id, title, score, progress, deadline, historial, created_at, updated_at, labels');
  type H = { ts: number; actor: string; text: string };
  const abiertas = ((data ?? []) as Array<{ id: string; title: string; score: number; progress: number; deadline: string | null; historial: H[]; created_at: string; updated_at: string }>)
    .filter(t => (t.progress ?? 0) < 100);

  const tocada = (t: { historial: H[]; created_at: string }) => {
    const humanas = (t.historial ?? []).filter(h => h.actor === 'user').map(h => h.ts);
    // Sin rastro humano, cuenta desde que nació: una tarea que nadie tocó NUNCA es el caso
    // que más importa, y descartarla por falta de dato sería mirar para otro lado.
    return humanas.length ? Math.max(...humanas) : new Date(t.created_at).getTime();
  };
  const dias = (ms: number) => Math.floor((HOY - ms) / DIA);
  const alDeadline = (d: string | null) => (d ? Math.ceil((new Date(d + 'T12:00:00Z').getTime() - HOY) / DIA) : null);

  console.log(`\n== ws ${ws} · ${abiertas.length} tareas abiertas ==`);

  // ── 1. SIN TOCAR ──
  const sinTocar = abiertas.map(t => ({ ...t, d: dias(tocada(t)) })).sort((a, b) => b.d - a.d);
  console.log('\n-- ¿Cuántas caen en cada corte de "sin tocar"? --');
  for (const corte of [7, 14, 21, 30, 45, 60, 90, 120]) {
    const n = sinTocar.filter(t => t.d >= corte).length;
    const altas = sinTocar.filter(t => t.d >= corte && t.score >= 75).length;
    console.log(`  >= ${String(corte).padStart(3)} días: ${String(n).padStart(3)} tareas (${Math.round(100 * n / abiertas.length)}%) · de ellas ${altas} están hoy en ALTA`);
  }
  const conRastroHumano = abiertas.filter(t => (t.historial ?? []).some(h => h.actor === 'user')).length;
  console.log(`  ⚠️  con rastro humano en el historial: ${conRastroHumano}/${abiertas.length} (el resto cuenta desde created_at)`);
  console.log('\n  LAS 8 MÁS VIEJAS EN ALTA (las que el corte de 30 bajaría):');
  sinTocar.filter(t => t.score >= 75).slice(0, 8).forEach(t => console.log(`    ${String(t.d).padStart(4)}d  [${t.score}]  ${t.title.slice(0, 62)}`));

  // ── 2. DEADLINE CERCA ──
  const conDl = abiertas.filter(t => t.deadline).map(t => ({ ...t, f: alDeadline(t.deadline)! }));
  console.log(`\n-- Deadlines: ${conDl.length}/${abiertas.length} tareas abiertas tienen fecha --`);
  for (const [lo, hi, et] of [[-9999, -1, 'VENCIDAS'], [0, 3, '0-3 días'], [4, 7, '4-7 días'], [8, 14, '8-14 días'], [15, 30, '15-30 días'], [31, 9999, '+30 días']] as Array<[number, number, string]>) {
    const en = conDl.filter(t => t.f >= lo && t.f <= hi);
    const yaAltas = en.filter(t => t.score >= 75).length;
    console.log(`  ${et.padEnd(10)}: ${String(en.length).padStart(3)} · ya en ALTA ${String(yaAltas).padStart(3)} · SUBIRÍAN ${en.length - yaAltas}`);
  }
  console.log('\n  LAS QUE SUBIRÍAN CON EL CORTE DE 7 DÍAS (hoy no están en Alta):');
  conDl.filter(t => t.f <= 7 && t.score < 75).sort((a, b) => a.f - b.f).slice(0, 15)
    .forEach(t => console.log(`    ${String(t.f).padStart(4)}d  [${String(t.score).padStart(2)}]  ${t.title.slice(0, 62)}`));

  // ── 3. EL CHOQUE: ¿cuántas caen en los DOS a la vez? ──
  const choque = sinTocar.filter(t => t.d >= 30 && t.deadline && alDeadline(t.deadline)! <= 7);
  console.log(`\n-- Choque (sin tocar 30+ días Y deadline a <=7): ${choque.length} tareas --`);
  choque.slice(0, 10).forEach(t => console.log(`    ${String(t.d).padStart(4)}d sin tocar · deadline en ${alDeadline(t.deadline)}d · [${t.score}] ${t.title.slice(0, 50)}`));

  // ── 4. VENCIDAS: el caso que nadie pidió pero está ahí ──
  const vencidas = conDl.filter(t => t.f < 0);
  console.log(`\n-- Vencidas: ${vencidas.length} · la más vieja hace ${vencidas.length ? Math.min(...vencidas.map(t => t.f)) * -1 : 0} días --`);
  vencidas.sort((a, b) => a.f - b.f).slice(0, 8).forEach(t => console.log(`    ${String(t.f).padStart(5)}d  [${String(t.score).padStart(2)}]  ${t.title.slice(0, 62)}`));
});
process.exit(0);
