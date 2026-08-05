// =============================================================================
// mover-legales — las tareas de papeles al proyecto que les corresponde
// =============================================================================
// El Perro repartió lo legal y lo fiscal por palabra suelta porque el catálogo no
// tenía dónde ponerlo: los Términos de Servicio cayeron en «Vender MaKo: Landing y
// VSL», la apertura de la LLC en «Cobros y planes» y el marco de responsabilidad en
// «Seguridad y multi-inquilino». Ninguna de esas tres pantallas tiene nada que ver:
// eso no se programa, se firma y se paga. El catálogo ya tiene «Legal y fiscal»
// (lib/plan-proyectos-catalogo.ts); esto reubica lo que quedó mal.
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/mover-legales.ts [--apply]
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';
import { delCatalogo } from '../lib/plan-proyectos-catalogo';

const APLICAR = process.argv.includes('--apply');
const DESTINO = 'Legal y fiscal';
const MOVER = [550, 551, 552, 553];  // marco legal · ToS/privacidad · LLC/fiscal · contractual del programa
const uid = (p: string) => p + Math.random().toString(36).slice(2, 9);

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number };
  await runWithWorkspace(ws.id, async () => {
    const db = await getTenantDb();
    const [{ data: pr }, { data: ta }] = await Promise.all([
      db.from('plan_proyectos').select('id, pid, name, orden'),
      db.from('plan_tareas').select('id, num, title, labels, historial').in('num', MOVER),
    ]);
    const proys = (pr ?? []) as Array<{ id: string; pid: string; name: string; orden: number }>;
    const nombre = new Map(proys.map((p) => [p.id, p.name]));
    let destino = proys.find((p) => p.name === DESTINO);

    console.log(`${APLICAR ? '=== APLICANDO ===' : '=== SIMULACIÓN ==='}  ws ${ws.id}`);
    if (!destino) {
      const maxPid = proys.reduce((m, p) => Math.max(m, parseInt(/^P(\d+)$/i.exec(p.pid ?? '')?.[1] ?? '0', 10)), 0);
      const cat = delCatalogo(DESTINO)!;
      const fila = {
        id: uid('p'), pid: `P${maxPid + 1}`, emoji: cat.emoji, name: DESTINO, color: '#98A0AC',
        score: 55, detalle: cat.que, orden: proys.length,
        historial: [{ id: uid('h'), ts: Date.now(), actor: 'ia', text: 'MaKo lo abrió: los papeles del negocio no se resuelven en ninguna pantalla del producto, así que estaban repartidos donde no iban.' }],
        updated_at: new Date().toISOString(),
      };
      console.log(`  CREAR proyecto «${DESTINO}» (${fila.pid})`);
      if (APLICAR) {
        const { error } = await db.from('plan_proyectos').insert(fila);
        if (error) throw new Error(error.message);
      }
      destino = fila as unknown as typeof destino;
    } else console.log(`  «${DESTINO}» ya existe (${destino.pid})`);

    for (const t of (ta ?? []) as Array<{ id: string; num: number; title: string; labels: string[]; historial: unknown[] }>) {
      const antes = (t.labels ?? []).map((id) => nombre.get(id) ?? id).join(' + ') || '(sin proyecto)';
      console.log(`  #${t.num} ${t.title.slice(0, 52).padEnd(54)} ${antes} → ${DESTINO}`);
      if (!APLICAR) continue;
      const hist = [{ id: uid('h'), ts: Date.now(), actor: 'ia', text: `MaKo la movió de «${antes}» a «${DESTINO}»: es un trámite, no se resuelve en esa pantalla.` }, ...(t.historial ?? [])];
      const { error } = await db.from('plan_tareas').update({ labels: [destino!.id], historial: hist, hacelo_en: null, updated_at: new Date().toISOString() }).eq('id', t.id);
      console.log(error ? `     ✗ ${error.message}` : '     ✓');
    }
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
