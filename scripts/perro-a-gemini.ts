// =============================================================================
// perro-a-gemini — mover el Perro a Gemini también en el OVERRIDE guardado
// =============================================================================
// Cambiar el default del catálogo NO alcanza: el override que el dueño dejó puesto
// desde /modelos-ia gana sobre el default (es lo correcto — la tab es la fuente de
// verdad). El Perro estaba pineado a claude-sonnet-5 ahí, así que seguía cobrando
// Claude por más que el código dijera Gemini.
//
// Sin --apply solo muestra. Con --apply escribe (y deja backup del override anterior).
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/perro-a-gemini.ts
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/perro-a-gemini.ts --apply
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, OWNER_WS } from '../lib/workspace';
import { getSetting, setSetting } from '../lib/settings';
import { modeloDeFeature } from '../lib/model-registry';

const APLICAR = process.argv.includes('--apply');
const KEY = 'mako.modelos';
const DEL_PERRO = ['mako-guardian', 'checklist-coach'];

async function main() {
  await runWithWorkspace(OWNER_WS, async () => {
    const raw = (await getSetting(KEY)) ?? '{}';
    let overrides: Record<string, { provider: string; model: string }> = {};
    try { overrides = JSON.parse(raw); } catch { /* corrupto → arrancamos limpio */ }

    for (const f of DEL_PERRO) {
      const efectivo = await modeloDeFeature(f);
      console.log(`${f.padEnd(16)} override=${overrides[f] ? `${overrides[f].provider}/${overrides[f].model}` : '(ninguno)'}  →  efectivo hoy: ${efectivo?.provider}/${efectivo?.model}`);
    }

    if (!APLICAR) { console.log('\n(sin --apply no escribe nada)'); return; }

    await setSetting('mako.backup.modelos', raw);
    const next = { ...overrides };
    for (const f of DEL_PERRO) next[f] = { provider: 'gemini', model: process.env.GEMINI_MODEL || 'gemini-flash-latest' };
    await setSetting(KEY, JSON.stringify(next));
    console.log(`\nbackup → mako.backup.modelos`);
    for (const f of DEL_PERRO) {
      const efectivo = await modeloDeFeature(f);
      console.log(`✓ ${f} → ${efectivo?.provider}/${efectivo?.model}`);
    }
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
