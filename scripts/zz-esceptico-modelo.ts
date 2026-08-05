// READ-ONLY. ¿En qué modelo corre DE VERDAD el Perro para el ws 9?
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });
import { runWithWorkspace } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';
import { modeloDeFeature } from '../lib/model-registry';

/* eslint-disable @typescript-eslint/no-explicit-any */
async function main() {
  const svc = getSupabaseServer();
  const { data } = await svc.from('app_settings').select('workspace_id, key, value')
    .in('key', ['mako.modelos', 'mako.prompts']).order('workspace_id');
  console.log('FILAS CRUDAS de app_settings (todas las ws):');
  for (const r of (data ?? []) as any[]) {
    const v = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
    if (r.key === 'mako.modelos') {
      console.log(`  ws=${r.workspace_id} mako.modelos → guardian=${JSON.stringify(v?.['mako-guardian'])} doer-in=${JSON.stringify(v?.['mako-doer-in'])} (${Object.keys(v ?? {}).length} features)`);
    } else {
      console.log(`  ws=${r.workspace_id} mako.prompts → keys=${Object.keys(v ?? {}).join(',') || '(vacío)'}`);
    }
  }
  for (const ws of [9]) {
    await runWithWorkspace(ws, async () => {
      const g = await modeloDeFeature('mako-guardian');
      const d = await modeloDeFeature('mako-doer-in');
      const c = await modeloDeFeature('checklist-coach');
      console.log(`\n✅ EFECTIVO ws ${ws}:  mako-guardian → ${g?.provider}/${g?.model}`);
      console.log(`                     mako-doer-in  → ${d?.provider}/${d?.model}`);
      console.log(`                     checklist-coach → ${c?.provider}/${c?.model}`);
    });
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
