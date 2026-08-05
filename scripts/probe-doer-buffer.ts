// =============================================================================
// probe-doer-buffer — ¿el candado del lote aguanta la concurrencia? (ws de prueba)
// =============================================================================
// Escribe en una cola FALSA (jid inventado) del workspace del super-admin y la borra
// al final. No toca ningún grupo real ni manda un solo mensaje.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-doer-buffer.ts
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';
import { encolar, reclamar, soltar, pendientes, marcarProcesados, unirMensajes, esperarSilencio } from '../lib/mako-doer-buffer';

const JID = 'probe-buffer@g.us';

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id').eq('capa', 'superadmin');
  const ws = ((wss ?? [])[0] as { id: number } | undefined)?.id;
  if (!ws) throw new Error('sin workspace superadmin');

  await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    await db.from('mako_doer_buffer').delete().eq('grupo_jid', JID);
    await db.from('mako_doer_lock').delete().eq('grupo_jid', JID);

    // 1. Encolar 4 mensajes; el 3º repite el id del 1º (re-entrega de Evolution).
    const r1 = await encolar(JID, { waId: 'A', texto: 'arreglá el filtro de fechas' });
    const r2 = await encolar(JID, { waId: 'B', texto: 'y el orden de la tabla' });
    const r3 = await encolar(JID, { waId: 'A', texto: 'arreglá el filtro de fechas' });
    const r4 = await encolar(JID, { waId: 'C', texto: 'ah, y el export a CSV' });
    console.log(`encolar → A:${r1} B:${r2} A-repetido:${r3} C:${r4}   ${r3 === false ? '✓ el dedup lo frenó' : '✗ DUPLICÓ'}`);

    // 2. Dos invocaciones peleando el candado: solo una puede ganar.
    const [g1, g2] = await Promise.all([reclamar(JID, 'inv-1'), reclamar(JID, 'inv-2')]);
    console.log(`reclamar en paralelo → inv-1:${g1} inv-2:${g2}   ${g1 !== g2 ? '✓ gana uno solo' : '✗ GANARON LOS DOS'}`);

    // 3. Un tercero que llega después tampoco entra mientras el candado esté vivo.
    const g3 = await reclamar(JID, 'inv-3');
    console.log(`reclamar con candado tomado → ${g3}   ${g3 === false ? '✓ encola y se va' : '✗ SE COLÓ'}`);

    // 4. Lo que junta el ganador.
    const cola = await pendientes(JID);
    console.log(`\ncola: ${cola.length} mensajes   ${cola.length === 3 ? '✓' : '✗ esperaba 3'}`);
    console.log('─── así lo ve el agente ───');
    console.log(unirMensajes(cola));

    // 5. La espera corta sola cuando no entra nada nuevo.
    const t0 = Date.now();
    const tras = await esperarSilencio(JID, 4000);
    console.log(`\nesperarSilencio(4s) → cortó a los ${((Date.now() - t0) / 1000).toFixed(1)}s con ${tras.length} mensajes`);

    await marcarProcesados(cola.map((m) => m.id));
    const vacia = await pendientes(JID);
    console.log(`tras marcar procesados → ${vacia.length} pendientes   ${vacia.length === 0 ? '✓' : '✗'}`);

    await soltar(JID, g1 ? 'inv-1' : 'inv-2');
    const g4 = await reclamar(JID, 'inv-4');
    console.log(`reclamar tras soltar → ${g4}   ${g4 ? '✓ el candado se libera' : '✗ QUEDÓ TRABADO'}`);

    await db.from('mako_doer_buffer').delete().eq('grupo_jid', JID);
    await db.from('mako_doer_lock').delete().eq('grupo_jid', JID);
    console.log('\n(cola de prueba borrada)');
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
