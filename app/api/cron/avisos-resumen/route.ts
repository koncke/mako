// =============================================================================
// /api/cron/avisos-resumen — UN mensaje con todo lo que no necesitaba interrumpirte
// =============================================================================
// Vacía `avisos_cola` (mig 0161): junta lo que quedó esperando desde el resumen anterior y
// lo manda en UN mensaje, por el mismo canal por el que hubiera salido cada aviso.
//
// ⚠️ POR QUÉ NO VA ADENTRO DEL REPORTE DIARIO, que era lo primero que uno piensa. Son tres
// sistemas distintos y confundirlos rompe las tres cosas:
//   · CANAL — los avisos salen por Evolution al grupo «MaKo <> cliente»; el reporte sale
//     por Chatwoot/WABA a un TELÉFONO y sólo dentro de la ventana de 24 h.
//   · DESTINO — grupo vs. `notif_telefonos`.
//   · INQUILINO — `/api/cron/reporte-diario` lee las preferencias SIN `runWithWorkspace`,
//     así que hoy corre sólo para el ws1. Un resumen ahí adentro no lo recibiría ningún
//     cliente, y además lo apagaría el interruptor del reporte, que es otra cosa.
//
// Se manda con `emitirAviso` y no a mano: así el resumen lleva su rótulo, respeta su propio
// interruptor, rutea al grupo que corresponde y deja el turno del doer — que es lo que hace
// que un «sí» del dueño después tenga a qué agarrarse.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { emitirAviso } from '@/lib/avisos';
import { pendientesDeResumen, marcarEnviados } from '@/lib/avisos-cola';
import { textoResumen } from '@/lib/avisos-agrupables';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const noAuth = checkCronAuth(req);
  if (noAuth) return noAuth;
  try {
    const porCanal = await pendientesDeResumen();
    const salida: Array<{ canal: string; n: number; enviado: boolean; motivo?: string }> = [];

    for (const [clave, items] of porCanal) {
      const msg = textoResumen(items);
      if (!msg) continue;
      const { wsId, alDueno } = items[0];
      const res = await emitirAviso({
        tipo: 'avisos-resumen',
        titulo: msg.titulo,
        texto: msg.texto,
        categoria: 'reporte',
        semaforo: 'na',
        link: '/configuraciones?tab=notif',
        ws: wsId,
        alDueno,
      });
      // ⚠️ SE MARCAN SÓLO SI SALIÓ, O SI EL DUEÑO APAGÓ ESTE RESUMEN. Si el WhatsApp falló
      // (línea caída, grupo sin JID), las filas quedan pendientes y entran en el resumen
      // de mañana: un aviso pospuesto que se pierde por un fallo de envío sería el peor de
      // los dos mundos — no llegó en el momento Y tampoco llegó después.
      if (res.wa || res.apagado) await marcarEnviados(wsId, items.map((i) => i.id));
      salida.push({ canal: clave, n: items.length, enviado: !!res.wa, motivo: res.apagado ? 'apagado' : res.waError });
    }

    const total = salida.reduce((n, s) => n + s.n, 0);
    console.log(`[cron avisos-resumen] ${salida.length} resumen(es) · ${total} avisos${salida.length ? ` · ${salida.map((s) => `${s.canal}:${s.n}${s.enviado ? '' : `(${s.motivo ?? 'no salió'})`}`).join(' ')}` : ''}`);
    return NextResponse.json({ ok: true, resumenes: salida, total });
  } catch (err) {
    console.error('[cron avisos-resumen]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
