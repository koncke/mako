// =============================================================================
// reparar-senal-funnel — deshacer los cierres que se apoyaron en una señal falsa
// =============================================================================
// `funnel-cargado` daba VERDE para todos los workspaces porque la tabla vieja
// (`funnel_config`) no estaba en TENANT_TABLES y el conteo veía las filas de todos los
// inquilinos. Toda tarea que MaKo cerró citando esa evidencia en un workspace SIN
// funnel propio está cerrada con una mentira en el historial. Sin --apply solo imprime.
//
// ⚠️ EL CRITERIO CAMBIÓ CON LA MIG 0170. «Tiene funnel propio» ya no es «hay fila»:
// la migración le dio una a los 9 workspaces, así que contar filas volvería a dar
// verde para todos — el mismo falso positivo por otro camino. Lo que distingue es
// `declarado = true`, que es lo que escribe guardar desde /funnel.
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/reparar-senal-funnel.ts [--apply]
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';

const APLICAR = process.argv.includes('--apply');
type Hist = { id?: string; ts?: number; actor?: string; text?: string };

async function main() {
  const svc = getSupabaseServer();
  const [{ data: wss }, { data: fun }] = await Promise.all([
    svc.from('workspaces').select('id, nombre').order('id'),
    svc.from('funnels').select('workspace_id').eq('declarado', true),
  ]);
  const conFunnel = new Set((fun ?? []).map((f) => Number((f as { workspace_id: number }).workspace_id)));
  console.log(`${APLICAR ? '=== APLICANDO ===' : '=== SIMULACIÓN ==='}  workspaces con funnel DECLARADO: ${[...conFunnel].join(', ') || '(ninguno)'}\n`);

  for (const w of (wss ?? []) as Array<{ id: number; nombre: string }>) {
    if (conFunnel.has(w.id)) { console.log(`ws ${w.id} «${w.nombre}» — declaró su funnel, nada que reparar`); continue; }
    await runWithWorkspace(w.id, async () => {
      const db = await getTenantDb();
      const { data } = await db.from('experimento_tareas').select('id, titulo, progreso, historial').eq('progreso', 100);
      const filas = (data ?? []) as Array<{ id: number; titulo: string; progreso: number; historial: Hist[] | null }>;
      const mentirosas = filas.filter((f) => (f.historial ?? []).some((h) => /MaKo la marcó hecha/i.test(h.text ?? '') && /funnel/i.test(h.text ?? '')));
      console.log(`ws ${w.id} «${w.nombre}» — ${filas.length} hechas · ${mentirosas.length} cerradas con la señal falsa`);
      for (const f of mentirosas) console.log(`   #${f.id} ${f.titulo.slice(0, 60)}`);
      if (!APLICAR || !mentirosas.length) return;
      for (const f of mentirosas) {
        const hist: Hist[] = [...(f.historial ?? []), {
          id: `fix${f.id}`, ts: Date.now(), actor: 'ia',
          text: 'MaKo la reabrió: la había marcado hecha por error — leía el funnel de otra cuenta, no el tuyo.',
        }];
        const { error } = await db.from('experimento_tareas').update({ progreso: 0, estado: 'pendiente', hecho_at: null, historial: hist }).eq('id', f.id);
        console.log(error ? `   ✗ #${f.id}: ${error.message}` : `   ✓ #${f.id} reabierta`);
      }
    });
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
