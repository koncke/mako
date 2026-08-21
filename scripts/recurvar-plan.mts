// Re-reparte la pirámide del tablero del dueño. Cero tokens.
// Uso: node --conditions react-server --import tsx scripts/recurvar-plan.mts [ws]
import { config } from 'dotenv';
config({ path: '.env.local' });
const ws = Number(process.argv[2] || 9);
const { runWithWorkspace } = await import('../lib/workspace');
const { recurvarPlanOwner } = await import('../lib/plan-board');
const r = await runWithWorkspace(ws, () => recurvarPlanOwner());
console.log(`redistribuidas ${r.movidas} de ${r.total} tareas abiertas`);
