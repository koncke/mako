// Re-reparte la pirámide del tablero del dueño y deriva el score de cada proyecto de sus
// tareas. Cero tokens: son dos queries y aritmética.
// Uso: node --conditions react-server --import tsx scripts/recurvar-plan.mts [ws]
import { config } from 'dotenv';
config({ path: '.env.local' });
const ws = Number(process.argv[2] || 9);
const { runWithWorkspace } = await import('../lib/workspace');
const { recurvarPlanOwner } = await import('../lib/plan-board');
// ⛔ Los PROYECTOS ya no se tocan acá: su prioridad es un juicio del Perro, no una cuenta
// sobre sus tareas. Ver la autopsia en app/plan/board/types.ts.
const t = await runWithWorkspace(ws, () => recurvarPlanOwner());
console.log(`tareas: redistribuidas ${t.movidas} de ${t.total} abiertas · ${t.conDeadline} por fecha · ${t.quietas} por quietud · ${t.frenadas} frenadas`);
