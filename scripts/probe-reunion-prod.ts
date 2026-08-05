// =============================================================================
// probe-reunion-prod — POR QUÉ, en producción, la reunión no queda guardada ni
// se le pueden mandar las tareas a Mauricio. SOLO LEE.
// =============================================================================
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-reunion-prod.ts
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';
import { getSetting } from '../lib/settings';
import { listReunionesRecientes, cacheKeyReunion } from '../lib/plan-fathom';
import { buscarUsuarioPorNombre, buscarUsuarioPorEmail } from '../lib/usuarios';

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id, nombre, capa').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number; nombre: string };
  console.log(`ws superadmin: #${ws.id}\n`);

  await runWithWorkspace(ws.id, async () => {
    const db = await getTenantDb();

    // ── A. ¿Hay borradores de reunión guardados? ────────────────────────────
    const { data: props } = await db.from('plan_propuestas')
      .select('id, ref, estado, created_at, fuente_titulo, tareas, aplicadas')
      .eq('origen', 'fathom').order('created_at', { ascending: false }).limit(15);
    const P = (props ?? []) as Array<{ id: string; ref: string | null; estado: string; created_at: string; fuente_titulo: string | null; tareas: unknown[]; aplicadas: unknown[] }>;
    console.log(`A) BORRADORES de Fathom en plan_propuestas: ${P.length}`);
    for (const p of P) console.log(`   ${p.created_at?.slice(0, 16)} ${String(p.ref).padEnd(22)} ${p.estado.padEnd(10)} t=${(p.tareas ?? []).length} apl=${(p.aplicadas ?? []).length}  «${(p.fuente_titulo ?? '').slice(0, 40)}»`);

    // ── B. Las reuniones de Fathom + qué tiene cada una ─────────────────────
    console.log('\nB) REUNIONES de Fathom (las 10 más recientes):');
    const { reuniones } = await listReunionesRecientes({ limit: 10 });
    for (const r of reuniones) {
      const cache = await getSetting(cacheKeyReunion(r.recordingId)).catch(() => null);
      let nCache = 0; let nPart = 0;
      if (cache) { try { const c = JSON.parse(cache) as { tareas?: unknown[]; participantes?: unknown[] }; nCache = (c.tareas ?? []).length; nPart = (c.participantes ?? []).length; } catch { /* */ } }
      const tieneBorrador = P.some((p) => p.ref === `fathom:${r.recordingId}`);
      console.log(`   #${r.recordingId} ${(r.fecha ?? '').slice(0, 10)} «${r.titulo.slice(0, 34)}»`);
      console.log(`      participantes(meta)=${r.participantes.length} [${r.participantes.map((p) => `${p.nombre || '?'}<${p.email || 'SIN EMAIL'}>`).join(', ').slice(0, 110)}]`);
      console.log(`      cache: ${cache ? `${nCache} tareas, ${nPart} participantes` : 'NO'}  ·  borrador: ${tieneBorrador ? 'SÍ' : 'NO'}`);
    }

    // ── C. ¿Se puede resolver a Mauricio por nombre? ────────────────────────
    console.log('\nC) RESOLUCIÓN POR NOMBRE (lo que arregla el botón de "Cargar en el plan de X"):');
    for (const n of ['Mauricio', 'Mauricio Bustos', 'Martin', 'Leila']) {
      const u = await buscarUsuarioPorNombre(n).catch((e) => { console.log(`   «${n}» → ERROR ${e instanceof Error ? e.message : e}`); return null; });
      console.log(`   «${n}» → ${u ? `${u.email} (ws${u.workspace_id}, ${u.estado})` : 'sin match único'}`);
    }
    const mau = await buscarUsuarioPorEmail('mbustos@elevate.com.mx').catch(() => null);
    console.log(`   por email → ${mau ? `${mau.nombre} ws${mau.workspace_id} ${mau.estado} → puedeCargarPlan=${mau.estado !== 'suspendido' && mau.workspace_id != null}` : 'no está'}`);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
