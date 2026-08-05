// READ-ONLY: tamaño del brief que se le mandaría al modelo + match de títulos del seed.
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { perfilNegocioTexto } from '../lib/onboarding';
import { faseNegocioTexto } from '../lib/fase-store';
import { getPanorama } from '../lib/archivero';
import { getAvatares, avataresTexto } from '../lib/avatares';
import { getRazones } from '../lib/razones';
import { getEntregables, entregablesTexto } from '../lib/entregable';
import { personalidadNegocioTexto } from '../lib/personalidad-store';
import { getPersona } from '../lib/persona';
import { SEED_TAREAS } from '../lib/todo-seeds-data';
import { estadoParaSeed } from '../lib/plan-senales';

const WSS = [1, 3, 5, 10, 11];

async function main() {
  for (const id of WSS) {
    await runWithWorkspace(id, async () => {
      const [brief, fase, pano, avs, razones, entr, pers, persona] = await Promise.all([
        perfilNegocioTexto().catch(() => ''), faseNegocioTexto().catch(() => ''), getPanorama().catch(() => ''),
        getAvatares().catch(() => []), getRazones().catch(() => []), getEntregables().catch(() => []),
        personalidadNegocioTexto().catch(() => ''), getPersona().catch(() => ({ descripcion: '', fotos: [] })),
      ]);
      const piezas: Record<string, number> = {
        brief: brief.length, fase: fase.length, panorama: pano.length,
        avatares: avataresTexto(avs).length,
        razones: razones.map((r) => `${r.nombre}: ${r.descripcion} | ${r.copy}`).join('\n').length,
        entregables: entregablesTexto(entr).length,
        personalidad: pers.length,
        personaDesc: (persona.descripcion ?? '').length,
      };
      const total = Object.values(piezas).reduce((a, b) => a + b, 0);
      console.log(`\nws${id}: total ${total} chars ≈ ${Math.round(total / 3.5)} tokens · ${JSON.stringify(piezas)}`);
      // señales
      try {
        const { senales, ctx } = await estadoParaSeed();
        console.log(`   ctx=${JSON.stringify(ctx)} senales_si=${Object.entries(senales).filter(([, v]) => v).map(([k]) => k).join(',') || '(ninguna)'}`);
      } catch (e) { console.log(`   señales ERR ${(e as Error).message}`); }
      // títulos del seed presentes en el board
      const db = await getTenantDb();
      const { data } = await db.from('experimento_tareas').select('titulo,origen,progreso').limit(1000);
      const titulos = new Set((data ?? []).map((r: { titulo: string }) => r.titulo));
      const hit = SEED_TAREAS.filter((t) => titulos.has(t.titulo));
      console.log(`   board: ${(data ?? []).length} tareas · títulos del SEED presentes: ${hit.length}/${SEED_TAREAS.length}`);
    });
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
