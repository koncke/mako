// =============================================================================
// probe-dedup-borrador — qué crearía HOY el borrador pendiente de un workspace
// =============================================================================
// SOLO LEE. Corre el mismo filtro que aplicarPropuestas (esDeOtro + `aplicadas` +
// el nuevo anti-duplicado contra el tablero) sobre un borrador real, y muestra qué
// tarjetas entrarían y cuáles se frenan por ya existir.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-dedup-borrador.ts <ws>
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace } from '../lib/workspace';
import { listTareas } from '../lib/todo';
import { mismaTarea } from '../lib/plan-fathom';
import { listPropuestasPendientes } from '../lib/plan-propuesta';

const WS = Number(process.argv[2] || 11);

async function main() {
  await runWithWorkspace(WS, async () => {
    const pend = await listPropuestasPendientes();
    const abiertas = (await listTareas()).filter((t) => t.progreso < 100).map((t) => t.titulo);
    console.log(`ws${WS}: ${pend.length} borrador(es) pendiente(s) · ${abiertas.length} tareas abiertas en el tablero\n`);
    for (const p of pend) {
      const mias = p.tareas.filter((t) => !t.esDeOtro);
      const ajenas = p.tareas.length - mias.length;
      const yaHechas = new Set((p.aplicadas ?? []).map((a) => a.titulo.trim().toLowerCase()));
      const sinRepetir = mias.filter((t) => !yaHechas.has(t.titulo.trim().toLowerCase()));
      const nuevas = sinRepetir.filter((t) => !abiertas.some((x) => mismaTarea(x, t.titulo)));
      const frenadas = sinRepetir.filter((t) => abiertas.some((x) => mismaTarea(x, t.titulo)));
      console.log(`«${p.fuenteTitulo}» (${p.id}) — ${p.tareas.length} tareas: ${ajenas} de otras personas, ${mias.length} tuyas`);
      console.log(`  ANTES creaba ${sinRepetir.length} · AHORA crea ${nuevas.length} (${frenadas.length} frenadas por ya existir)\n`);
      for (const t of frenadas) {
        const cual = abiertas.find((x) => mismaTarea(x, t.titulo));
        console.log(`  ✗ ${t.titulo}\n      ya está como: ${cual}`);
      }
      console.log('');
      for (const t of nuevas) console.log(`  + ${t.titulo}${t.minuto != null ? ` (min ${t.minuto})` : ' (SIN minuto)'}`);
    }
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error('ERROR:', e); process.exit(1); });
