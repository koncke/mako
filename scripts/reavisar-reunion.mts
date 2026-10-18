// =============================================================================
// reavisar-reunion — reenviar por WhatsApp el aviso de una reunión YA leída
// =============================================================================
// Uso:  node --import tsx scripts/reavisar-reunion.mts <recordingId> [ws]
//
// No re-analiza nada (no gasta tokens): lee el borrador que ya existe para esa
// reunión y vuelve a emitir el MISMO aviso que manda el cron, con los mismos datos y
// por el mismo camino (emitirDelCatalogo → la automatización de SuperAdmin del evento
// `reunion_tareas_al_plan` → grupo de MaKo). Desde el 17/10/2026 el TEXTO es el de esa
// automatización: acá se muestran los datos que recibe. Existe porque un aviso que salió con un link equivocado no se puede
// "editar" en WhatsApp: se manda de nuevo.
// =============================================================================
import { config } from 'dotenv';
config({ path: '.env.local' });

const recordingId = Number(process.argv[2]);
const ws = Number(process.argv[3] || 9);
if (!Number.isFinite(recordingId)) { console.error('falta el recordingId'); process.exit(1); }

const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');
const { datosAviso } = await import('../lib/reunion-auto');
const { emitirDelCatalogo } = await import('../lib/avisos');

const salida = await runWithWorkspace(ws, async () => {
  const db = await getTenantDb();
  const { data } = await db.from('plan_propuestas').select('*').eq('ref', `fathom:${recordingId}`).maybeSingle();
  if (!data) return { error: `no hay borrador para fathom:${recordingId} en el ws ${ws}` };
  const row = data as Record<string, unknown>;
  const tareas = (Array.isArray(row.tareas) ? row.tareas : []) as Array<{ esDeOtro?: boolean }>;
  const aplicadas = (Array.isArray(row.aplicadas) ? row.aplicadas : []) as unknown[];
  const mias = tareas.filter((t) => !t.esDeOtro).length + aplicadas.length;
  const otras = tareas.filter((t) => t.esDeOtro).length;
  const resumen = String(row.resumen ?? '');
  const conQuien = (resumen.match(/ con ([^y]+?) y sacó/) || [])[1]?.trim() ?? '';
  return {
    datos: datosAviso([{
      titulo: String(row.fuente_titulo ?? ''), fecha: row.fuente_fecha ? String(row.fuente_fecha) : null,
      conQuien, mias, otras, recordingId, propId: String(row.id ?? ''),
    }], 'America/Montevideo'),
  };
});

if ('error' in salida) { console.error(salida.error); process.exit(1); }
console.log('--- DATOS DEL AVISO ---\n' + JSON.stringify(salida.datos, null, 2) + '\n---------------');
if (process.argv.includes('--mandar')) {
  const r = await emitirDelCatalogo('reunion-tareas-al-plan', { ws, datos: { ...salida.datos } });
  console.log(r.wa ? '✓ enviado por WhatsApp' : `✖ no salió: ${r.waError ?? 'sin detalle'}`);
} else {
  console.log('(ensayo — agregá --mandar para que salga de verdad)');
}
