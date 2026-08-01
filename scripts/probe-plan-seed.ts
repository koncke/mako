// =============================================================================
// probe-plan-seed — qué plan de arranque le sembraría MaKo a cada workspace HOY
// =============================================================================
// SOLO LEE. Corre las mismas funciones que el seed real (leerSenales +
// contextoDelNegocio + seedRelevante) contra los datos de producción y muestra
// el board que saldría, sin insertar nada.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-plan-seed.ts
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace } from '../lib/workspace';
import { leerSenales, contextoDelNegocio, type SenalId } from '../lib/plan-senales';
import { seedRelevante, senalesCumplidas, SEED_TAREAS, SEED_CATEGORIAS } from '../lib/todo-seeds-data';

const WS = [
  { id: 1, nombre: 'Mauricio (agencia)' },
  { id: 10, nombre: 'Leandro Tejado' },
  { id: 11, nombre: 'Team Leila Fittipaldi' },
];

async function main() {
  for (const w of WS) {
    await runWithWorkspace(w.id, async () => {
      const [senales, ctx] = await Promise.all([leerSenales(), contextoDelNegocio()]);
      const { proyectos, tareas } = seedRelevante(ctx);
      const hechas = tareas.filter((t) => senalesCumplidas(t, senales));
      const si = (Object.keys(senales) as SenalId[]).filter((k) => senales[k]);

      console.log(`\n═══ ws${w.id} · ${w.nombre} ═══`);
      console.log(`fase: ${ctx.fase ?? 'sin diagnóstico'} · canal: ${ctx.canal ?? '—'}`);
      console.log(`señales en verde (${si.length}/13): ${si.join(', ') || '(ninguna)'}`);
      console.log(`board: ${proyectos.length}/${SEED_CATEGORIAS.length} proyectos · ${tareas.length}/${SEED_TAREAS.length} tareas · ${hechas.length} nacen hechas`);
      const fuera = SEED_CATEGORIAS.filter((p) => !proyectos.some((q) => q.key === p.key));
      if (fuera.length) console.log(`  no le tocan: ${fuera.map((p) => p.nombre).join(' · ')}`);
      for (const p of proyectos) {
        const suyas = tareas.filter((t) => t.cat === p.key);
        const ok = suyas.filter((t) => senalesCumplidas(t, senales)).length;
        const recortadas = SEED_TAREAS.filter((t) => t.cat === p.key).length - suyas.length;
        console.log(`  ${p.emoji} ${p.nombre} — ${suyas.length} tareas (${ok} hechas${recortadas ? `, ${recortadas} no aplican a su canal` : ''})${ok === suyas.length ? '  ← nace completo' : ''}`);
        for (const t of suyas.filter((x) => senalesCumplidas(x, senales))) console.log(`      ✓ ${t.titulo}`);
      }
    });
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('ERROR:', e); process.exit(1); });
