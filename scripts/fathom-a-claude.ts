// =============================================================================
// fathom-a-claude — sacar la extracción de reuniones del override a Gemini
// =============================================================================
// Sin --apply solo IMPRIME. Deja backup en mako.backup.modelos.fathom.
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/fathom-a-claude.ts [--apply]
//
// POR QUÉ. La feature `plan-fathom` declara claude-sonnet-5 en el catálogo
// (lib/model-registry.ts), pero en app_settings 'mako.modelos' había un override a
// gemini-flash-latest — y `leerOverrides()` lo lee SIEMPRE del workspace del dueño, así
// que aplicaba a TODOS. Medido sobre las últimas 25 llamadas: 25/25 corrieron en Gemini.
//
// Sacar un action item con citas textuales de quién lo dijo y en qué minuto NO es
// clasificación contra una rúbrica: es REDACCIÓN, que es lo que Flash hace peor. Los
// detalles salían de 111-154 caracteres cuando el prompt pide 600+. Y encima el
// `effort:'high'` se perdía al delegar (eso se arregló en lib/anthropic.ts).
//
// El costo es acotado: la extracción corre UNA vez por reunión y queda cacheada.
// El Perro (mako-guardian) y el checklist-coach SIGUEN en Gemini: ahí sí es
// clasificación y la calidad ya se midió mejor.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';
import { getSetting, setSetting } from '../lib/settings';

const APLICAR = process.argv.includes('--apply');
const KEY = 'mako.modelos';
const FEATURE = 'plan-fathom';

async function main() {
  console.log(APLICAR ? '=== APLICANDO ===\n' : '=== SIMULACIÓN (sin --apply no escribe) ===\n');
  const svc = getSupabaseServer();
  // El override vive en el workspace del DUEÑO (OWNER_WS = 1): es de plataforma.
  const { data: wss } = await svc.from('workspaces').select('id, nombre, capa').order('id');
  const ws = (wss ?? []) as Array<{ id: number; nombre: string; capa: string | null }>;
  console.log(`workspaces: ${ws.map((w) => `#${w.id} ${w.nombre}${w.capa ? ` (${w.capa})` : ''}`).join(' · ')}\n`);

  for (const w of ws) {
    await runWithWorkspace(w.id, async () => {
      const raw = await getSetting(KEY).catch(() => null);
      if (!raw) return;
      let obj: Record<string, unknown>;
      try { obj = JSON.parse(raw) as Record<string, unknown>; } catch { console.log(`  ws${w.id}: ${KEY} corrupto`); return; }
      const claves = Object.keys(obj);
      console.log(`ws${w.id} ${KEY}: ${claves.length} override(s) — ${claves.join(', ')}`);
      if (!(FEATURE in obj)) { console.log(`  · ${FEATURE}: sin override (usa el catálogo) ✓`); return; }
      console.log(`  · ${FEATURE}: ${JSON.stringify(obj[FEATURE])}  ← se saca`);
      if (!APLICAR) return;
      await setSetting(`mako.backup.modelos.fathom.ws${w.id}`, raw);
      delete obj[FEATURE];
      await setSetting(KEY, JSON.stringify(obj));
      console.log(`  ✓ ws${w.id}: override de ${FEATURE} borrado (backup en mako.backup.modelos.fathom.ws${w.id})`);
    });
  }
  if (!APLICAR) console.log('\n(simulación — nada se escribió)');
}

main().catch((e) => { console.error(e); process.exit(1); });
