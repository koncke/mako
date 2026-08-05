// Prueba EN SECO el generador del plan de arranque: genera y muestra, sin escribir.
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probar-plan-arranque.ts --ws=11
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });
import { runWithWorkspace } from '../lib/workspace';
import { generarPlanArranque } from '../lib/todo-seed-ia';

const a = process.argv.find((x) => x.startsWith('--ws='));
const WS = a ? Number(a.slice(5)) : 11;

async function main() {
  await runWithWorkspace(WS, async () => {
    console.log(`Generando el plan de arranque para el ws ${WS} (NO escribe nada)…\n`);
    const r = await generarPlanArranque();
    if (!r.ok) { console.log(`✗ ${r.error}${r.motivo ? ` — ${r.motivo}` : ''}`); return; }
    console.log(`RESUMEN: ${r.plan.resumen}`);
    console.log(`${r.plan.tareas.length} tareas · ${r.ancladas} con título ancla\n`);
    for (const t of r.plan.tareas) {
      console.log(`[${t.prioridad.padEnd(6)}] ${(t.proyecto || '—').padEnd(24).slice(0, 24)} ${t.titulo}${t.yaHecha ? '  (dice que ya está hecha)' : ''}`);
      if (t.porQue) console.log(`           ↳ ${t.porQue.slice(0, 120)}`);
    }
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
