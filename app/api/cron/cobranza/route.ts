// =============================================================================
// CRON: la cobranza por WhatsApp (una vez por día)
// =============================================================================
// Cierra la primera mitad de la tarjeta #19: «Una cuota que vence dispara sola el
// primer mensaje de cobranza por WhatsApp». Los datos estaban completos desde la mig
// 0060 —`pagos` guarda una fila por movimiento y `getCuotasPendientes` ya devuelve
// vencidas y por vencer, y las lee el dashboard— y lo que faltaba era el brazo que
// actúa: `cuota-vencida` figuraba en el catálogo como `parcial` y `cuota-por-vencer`
// como `no`, y NINGUNO de los dos emitía nada.
//
// ⚠️ ESTO SÓLO DA LA ENTRADA. Lo que viene después lo decide el FLUJO del mensaje, que
// se edita en el lienzo de /mensajes: «para eso estamos configurando el chatbot, que
// cada usuario lo pueda editar». Y el corte al cobrar lo hace `marcarPago`. Acá no hay
// un solo número de cadencia, a propósito.
//
// ⚠️ Y VA UNA VEZ POR DÍA, no cada cinco minutos. Una cuota entra una sola vez (dedup
// por cuota, 120 días), así que un tick cada cinco minutos serían 288 lecturas de
// `pagos` por workspace para descubrir lo mismo.

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { listarWorkspaces, runWithWorkspace } from '@/lib/workspace';
import { getCuotasPendientes } from '@/lib/pagos';
import { emitirDelCatalogo } from '@/lib/avisos';
import { correrFlujoDe } from '@/lib/flujos';
import { disparosDeCobranza, TTL_UNA_POR_CUOTA_MIN, DIAS_ANTES } from '@/lib/cobranza';
import { hoyEnWorkspace } from '@/lib/timezone';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  const dry = new URL(req.url).searchParams.get('dry') === '1';

  let workspaces: Array<{ id: number; nombre: string; estado?: string }> = [];
  try {
    workspaces = (await listarWorkspaces()) as typeof workspaces;
  } catch (e) {
    console.error('[cron:cobranza] no pude listar workspaces:', msg(e));
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
  const activos = workspaces.filter((w) => (w.estado ?? 'activo') === 'activo');

  const detalle: Array<{ ws: number; entraron: number; cuotas?: string[]; error?: string }> = [];

  // Uno por uno y con su propio try: que un workspace roto no le apague la corrida a
  // los demás. Es la regla que sigue el resto de los crons del repo.
  for (const w of activos) {
    try {
      await runWithWorkspace(w.id, async () => {
        // El «hoy» es el del NEGOCIO, no el del servidor: una cuota que vence el 10 no
        // venció todavía a las 21:00 del 9 en Tijuana, y avisar ahí es cobrarle a
        // alguien antes de la fecha.
        const hoy = await hoyEnWorkspace();
        const pend = await getCuotasPendientes(hoy, DIAS_ANTES);
        const disparos = disparosDeCobranza(pend);
        const hechos: string[] = [];
        for (const d of disparos) {
          if (dry) { hechos.push(`${d.avisoId}:${d.cuota.pago_id}`); continue; }
          const r = await emitirDelCatalogo(d.avisoId, {
            ws: w.id,
            // El lead, para que el mensaje pueda nombrarlo y linkear su ficha.
            lead: { id: d.cuota.lead_id, nombre: d.cuota.lead_nombre },
            // Y los números EXACTOS de esta cuota, por código: un monto que pasa por un
            // modelo deja de ser exacto, y acá el dato exacto es plata que alguien debe.
            datos: d.datos,
            dedupKey: d.dedupKey, dedupTtlMin: TTL_UNA_POR_CUOTA_MIN,
            // La cuota (11/10/2026): desde que `cuota-vencida` es un evento de MaKo (lib/aviso-evento.ts),
            // su cadencia corre en la automatización del negocio, y una corrida dormida se CORTA al marcar
            // el pago por esta clave (`cerrarCorridasDeCuota`, lib/flujo-corridas.ts).
            cuotaId: d.cuota.pago_id,
          });
          // `deduped` no es un fallo: es «esta cuota ya entró», que es el caso normal
          // de todos los días siguientes al primero.
          if (r.ok && !r.deduped) {
            hechos.push(`${d.avisoId}:${d.cuota.pago_id}`);
            // Y recién acá arranca la CADENCIA que el dueño editó en el lienzo (sólo la de un aviso que no
            // es un evento de MaKo: `cuota-por-vencer`; la de `cuota-vencida` ya corrió adentro de la
            // entrada, y `correrFlujoDe` contesta false para ella). Va
            // después de la entrada y sólo si la entrada salió: un flujo que corre
            // sobre un aviso que el dedup descartó insistiría sobre un mensaje que
            // nadie recibió. El `cuotaId` viaja en el ctx porque es lo que permite
            // CORTAR la secuencia cuando se marque el pago.
            await correrFlujoDe(d.avisoId, w.id, {
              ws: w.id, leadId: d.cuota.lead_id, leadNombre: d.cuota.lead_nombre,
              // Los ESTABLES, no todos: `cuota_dias` es la foto de hoy y los pasos
              // siguientes salen en 48 y 120 horas. Ver `datosEstables`.
              cuotaId: d.cuota.pago_id, datos: d.datosEstables,
            });
          }
        }
        detalle.push({ ws: w.id, entraron: hechos.length, cuotas: hechos });
      });
    } catch (e) {
      console.error(`[cron:cobranza] ws${w.id}:`, msg(e));
      detalle.push({ ws: w.id, entraron: 0, error: msg(e) });
    }
  }

  // Los dos números, no sólo el de éxito: «no había ninguna cuota que avisar» y «había
  // y no pude» se ven iguales desde un `{ ok: true }`.
  return Response.json({
    ok: true, dry,
    workspaces: activos.length,
    entraron: detalle.reduce((a, d) => a + d.entraron, 0),
    conError: detalle.filter((d) => d.error).length,
    detalle,
  });
}
