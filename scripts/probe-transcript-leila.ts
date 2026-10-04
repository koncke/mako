// =============================================================================
// probe-transcript-leila — bajar el transcript de una llamada por recording_id
// =============================================================================
// SOLO LEE. Escribe el transcript a un archivo para poder trabajarlo.
//
// ⚠️ HAY TRES CUENTAS DE FATHOM Y EL CONECTOR MCP APUNTA A LA QUE NO ES. Medido el
// 04/10/2026: `list_meetings` del MCP devuelve 21 reuniones de Optimum y NINGUNA de
// MaKo; pedirle la 188898333 contesta «not found or access denied», que se lee como
// «esa grabación no existe». Existe: sale con `FATHOM_API_KEY_MARTIN` del .env.local.
// Ya estaba escrito en docs/conectores.md y en el registro de customer-success, y se
// volvió a pagar igual — por eso esto es un script y no un comando a mano.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-transcript-leila.ts <recordingId> [salida]
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { writeFileSync } from 'node:fs';

const ID = Number(process.argv[2] || 188898333);
const SALIDA = process.argv[3] || resolve(process.cwd(), `../transcript-${ID}.txt`);
const BASE = 'https://api.fathom.ai/external/v1';

/** Las tres keys que puede haber, en orden. La que sirva, gana — y se dice CUÁL. */
const KEYS: Array<[string, string | undefined]> = [
  ['FATHOM_API_KEY_MARTIN', process.env.FATHOM_API_KEY_MARTIN],
  ['FATHOM_API_KEY', process.env.FATHOM_API_KEY],
];

type Item = { speaker?: { display_name?: string } | string; text?: string; timestamp?: string; recording_timestamp?: string };

async function pedir<T>(ruta: string, key: string): Promise<T> {
  const res = await fetch(`${BASE}${ruta}`, { headers: { 'X-Api-Key': key, accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
  return res.json() as Promise<T>;
}

async function main() {
  for (const [nombre, key] of KEYS) {
    if (!key) { console.log(`${nombre}: no está en .env.local`); continue; }
    try {
      const t = await pedir<{ transcript?: Item[] }>(`/recordings/${ID}/transcript`, key);
      const items = t.transcript ?? [];
      if (!items.length) { console.log(`${nombre}: contestó sin transcript`); continue; }
      const sum = await pedir<{ summary?: { markdown_formatted?: string } }>(`/recordings/${ID}/summary`, key).catch(() => null);

      const lineas = items.map((i) => {
        const quien = typeof i.speaker === 'string' ? i.speaker : (i.speaker?.display_name ?? '?');
        const t0 = i.recording_timestamp ?? i.timestamp ?? '';
        return `[${t0}] ${quien}: ${i.text ?? ''}`;
      });
      const txt = [
        `# recording ${ID} · ${items.length} intervenciones · key ${nombre}`,
        '',
        '## RESUMEN DE FATHOM',
        sum?.summary?.markdown_formatted ?? '(sin resumen)',
        '',
        '## TRANSCRIPT',
        ...lineas,
      ].join('\n');
      writeFileSync(SALIDA, txt, 'utf8');
      console.log(`✅ ${nombre}: ${items.length} intervenciones, ${txt.length} chars → ${SALIDA}`);
      return;
    } catch (e) {
      console.log(`⛔ ${nombre}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log('Ninguna key pudo con esa grabación.');
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
