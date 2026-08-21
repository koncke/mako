// Re-reparte la pirámide del tablero del dueño y deriva el score de cada proyecto de sus
// tareas. Cero tokens: son dos queries y aritmética.
// Uso: node --conditions react-server --import tsx scripts/recurvar-plan.mts [ws]
import { config } from 'dotenv';
config({ path: '.env.local' });
const ws = Number(process.argv[2] || 9);
const { runWithWorkspace } = await import('../lib/workspace');
const { recurvarPlanOwner, recurvarProyectosOwner } = await import('../lib/plan-board');
// El orden importa: los proyectos se derivan de las tareas YA repartidas.
const t = await runWithWorkspace(ws, () => recurvarPlanOwner());
console.log(`tareas:    redistribuidas ${t.movidas} de ${t.total} abiertas`);
const p = await runWithWorkspace(ws, () => recurvarProyectosOwner());
console.log(`proyectos: movidos ${p.movidos} de ${p.total} · Objetivo Principal → «${p.norte}»`);
