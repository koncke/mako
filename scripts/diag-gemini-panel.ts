// =============================================================================
// diag-gemini-panel — QUÉ dice el panel de /integraciones, sin abrir el navegador
// =============================================================================
// Llama a `cuotasProveedores()` igual que lo hace app/integraciones/page.tsx y
// pinta lo que el board pintaría. SOLO LECTURA: la reconciliación de incidentes
// —lo único que ese render ESCRIBE— vive en la página, no acá.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/diag-gemini-panel.ts [ws]
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

import { cuotasProveedores } from '../lib/ia-cuotas';
import { runWithWorkspace } from '../lib/workspace';

const WS = Number(process.argv[2] || 9);

const fmt = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

async function main(): Promise<void> {
  const cuotas = await runWithWorkspace(WS, () => cuotasProveedores());
  console.log(`\n▶ /integraciones · workspace ${WS}\n`);
  for (const c of cuotas) {
    const metrica = c.tokensDia != null && c.tokens / c.tokensDia >= c.requests / (c.rpd || Infinity)
      ? `${fmt(c.tokens)} / ${fmt(c.tokensDia)} tok`
      : `${c.requests} / ${c.rpd ?? '—'} pedidos`;
    const rotulo = c.agotado
      ? 'sin cuota hoy'
      : (c.cuentas ?? []).filter((k) => k.agotado).length
        ? `${(c.cuentas ?? []).filter((k) => k.agotado).length} de ${(c.cuentas ?? []).length} cuentas sin cuota`
        : 'cuánto queda hoy';
    console.log(`  ${c.label.padEnd(11)} ${rotulo.padEnd(28)} ${metrica}`);
    for (const k of c.cuentas ?? []) {
      const pct = Math.min(100, Math.round(k.pct * 100));
      console.log(`      cuenta ${k.cuenta}  ${k.agotado ? 'sin cuota' : `${pct}%`.padStart(9)}   ${k.requests} pedidos · ${fmt(k.tokens)} tok`);
    }
  }
  console.log('');
}

main().catch((e) => { console.error(e); process.exit(1); });
