// READ-ONLY: qué datos del onboarding tiene cargado cada workspace real en PROD.
// NODE_OPTIONS="--conditions=react-server" npx tsx <este archivo>
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, listarWorkspaces, getTenantDb, getWorkspaceActual } from '../lib/workspace';
import { getSetting } from '../lib/settings';

const KEYS = [
  'negocio.fase.diagnostico',
  'mako.onboarding.answers',
  'mako.archivero.manual',
  'mako.archivero.panorama',
  'mako.avatares',
  'mako.avatares.contexto',
  'mako.razones',
  'mako.entregable',
  'mako.persona',
  'mako.personalidad',
  'onboarding.state',
  'onboarding.funnel_tipos',
];

async function count(tabla: string, wsManual = false): Promise<string> {
  try {
    const db = await getTenantDb();
    const ws = await getWorkspaceActual();
    let q = db.from(tabla).select('*', { count: 'exact', head: true });
    if (wsManual && ws != null) q = q.eq('workspace_id', ws);
    const { count: c, error } = await q;
    if (error) return `ERR(${error.message.slice(0, 40)})`;
    return String(c ?? 0);
  } catch (e) { return `EXC(${(e as Error).message.slice(0, 40)})`; }
}

async function main() {
  const wss = await listarWorkspaces();
  console.log(`workspaces: ${wss.map((w) => `${w.id}:${w.nombre}[${(w as unknown as { capa?: string }).capa}/${(w as unknown as { estado?: string }).estado}]`).join(' · ')}`);
  for (const w of wss) {
    await runWithWorkspace(w.id, async () => {
      console.log(`\n================ ws${w.id} — ${w.nombre} (capa ${(w as unknown as { capa?: string }).capa}) ================`);
      for (const k of KEYS) {
        const raw = await getSetting(k).catch(() => null);
        const s = (raw ?? '').trim();
        let resumen = '(vacío)';
        if (s) {
          if (k === 'negocio.fase.diagnostico') {
            try { const d = JSON.parse(s); resumen = `fase=${d.fase} (display ${d.fase + 1}) canal=${d.canal ?? '—'} cuello=${d.cuello} consist=${d.consistencia}% mixto=${d.mixto}`; } catch { resumen = s.slice(0, 120); }
          } else if (k === 'mako.onboarding.answers' || k === 'mako.archivero.manual') {
            try { const o = JSON.parse(s); const ks = Object.keys(o).filter((x) => String(o[x] ?? '').trim()); resumen = `${ks.length} campos: ${ks.join(', ')}`; } catch { resumen = s.slice(0, 120); }
          } else if (k === 'mako.avatares' || k === 'mako.razones' || k === 'mako.entregable') {
            try { const a = JSON.parse(s); resumen = `${Array.isArray(a) ? a.length : '?'} items · ${JSON.stringify(a).slice(0, 200)}`; } catch { resumen = s.slice(0, 120); }
          } else if (k === 'mako.persona') {
            try { const p = JSON.parse(s); resumen = `desc=${(p.descripcion ?? '').length} chars · fotos=${(p.fotos ?? []).length}`; } catch { resumen = s.slice(0, 100); }
          } else if (k === 'mako.personalidad') {
            resumen = `${s.length} chars · ${s.slice(0, 200)}`;
          } else if (k === 'onboarding.state') {
            try { const o = JSON.parse(s); resumen = `status=${o.status} step=${o.step} done=${Object.entries(o.steps ?? {}).filter(([, v]) => (v as { done: boolean }).done).map(([kk]) => kk).join(',')}`; } catch { resumen = s.slice(0, 120); }
          } else {
            resumen = `${s.length} chars · ${s.slice(0, 160).replace(/\n/g, ' ⏎ ')}`;
          }
        }
        console.log(`  ${k.padEnd(32)} → ${resumen}`);
      }
      console.log(`  -- tablas --`);
      console.log(`  archivero_files       → ${await count('archivero_files')}`);
      console.log(`  productos             → ${await count('productos')}`);
      console.log(`  leads                 → ${await count('leads')}`);
      console.log(`  funnel_config(ws)     → ${await count('funnel_config', true)}`);
      console.log(`  tarea_categorias      → ${await count('tarea_categorias')}`);
      console.log(`  experimento_tareas    → ${await count('experimento_tareas')}`);
      console.log(`  plan_propuestas       → ${await count('plan_propuestas')}`);
      console.log(`  closing_analyses      → ${await count('closing_analyses')}`);
      console.log(`  marketing_metrics_daily→ ${await count('marketing_metrics_daily')}`);
      console.log(`  vsl_events            → ${await count('vsl_events')}`);
      console.log(`  nutricion_secuencias  → ${await count('nutricion_secuencias')}`);
    });
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
