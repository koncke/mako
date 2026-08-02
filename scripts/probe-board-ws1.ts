// =============================================================================
// probe-board-ws1 — cómo quedó el tablero de Mauricio, por proyecto. SOLO LEE.
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-board-ws1.ts
// =============================================================================
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace } from '../lib/workspace';
import { listTareas, listCategorias } from '../lib/todo';

const WS = Number(process.argv[2] || 1);

async function main() {
  await runWithWorkspace(WS, async () => {
    const cats = await listCategorias();
    const tareas = await listTareas();
    console.log(`ws${WS}: ${cats.length} proyectos · ${tareas.length} tareas\n`);
    for (const c of [...cats].sort((a, b) => b.prioridad - a.prioridad)) {
      const suyas = tareas.filter((t) => t.categorias.includes(c.id));
      const deReunion = new Set(suyas.map((t) => (t.fuente as { etiqueta?: string } | null)?.etiqueta).filter(Boolean));
      console.log(`  ${String(suyas.length).padStart(3)} · ${c.emoji} ${c.nombre}`);
      if (deReunion.size) console.log(`        de: ${[...deReunion].map((x) => `«${x}»`).join(' · ')}`);
    }
    const sin = tareas.filter((t) => !t.categorias.length);
    console.log(`\nSin proyecto: ${sin.length}${sin.length ? '' : ' ✓'}`);
    for (const t of sin) console.log(`  #${t.id} ${t.titulo.slice(0, 70)}  (de: ${(t.fuente as { etiqueta?: string } | null)?.etiqueta ?? '—'})`);
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
