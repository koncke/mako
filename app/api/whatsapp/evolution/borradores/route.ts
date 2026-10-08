// =============================================================================
// API interna: cola de BORRADORES del WhatsApp (F2.3)
// =============================================================================
// GET            → { borradores, pendientes } (los que el setter revisa/envía)
// GET ?camino=1  → cada borrador además con `camino`: por dónde puede salir
//                  (empresa / oficial / null + el motivo en una frase). Lo pide
//                  el panel para NO dibujar el botón de enviar cuando no hay por
//                  dónde — fuera de la ventana de 24 h, Meta rechaza el texto
//                  libre y el error se lee como que la app está rota. El cálculo
//                  es SERVIDOR: el cliente nunca decide el canal ni la ventana.
// POST  → { id, action:'enviar' }    → manda el borrador por el canal que puede
//         { id, action:'descartar' } → lo descarta
// Scopeado por getTenantDb; visible/operable por admin/setter que atienden chats.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { listBorradores, contarBorradores, descartarBorrador } from '@/lib/evolution-envio';
import { CAMINO_INDETERMINADO, caminosDeEnvio, enviarBorradorPorSuCanal } from '@/lib/borrador-oficial';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET(req: NextRequest) {
  try {
    const [borradores, pendientes] = await Promise.all([listBorradores(), contarBorradores()]);
    if (new URL(req.url).searchParams.get('camino') !== '1') {
      return Response.json({ ok: true, borradores, pendientes });
    }
    // Un solo viaje para todos: con el no oficial vivo ni se consulta Chatwoot. El audio y el
    // archivo viajan: un borrador que los lleva no tiene camino oficial (manda sólo el pie).
    const caminos = await caminosDeEnvio(borradores.map((b) => ({ id: b.id, telefono: b.telefono, linea: b.linea, audioId: b.audioId, adjuntoId: b.adjuntoId })));
    return Response.json({
      ok: true,
      pendientes,
      // Nunca `null`: un hueco se leería como «todavía no sé» y el panel dejaría
      // el botón en «Comprobando…». Si falta la entrada, el camino es indeterminado.
      borradores: borradores.map((b) => ({ ...b, camino: caminos.get(b.id) ?? CAMINO_INDETERMINADO })),
    });
  } catch (e) {
    console.error(`[api:whatsapp/evolution/borradores GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { id?: unknown; action?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const id = Number(body.id);
  if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });

  try {
    if (body.action === 'enviar') {
      const sesion = await getUsuarioActual();
      // El canal lo elige el servidor y vuelve a verificar la ventana: entre que
      // el botón se dibujó y este clic, la ventana se cierra sola con el reloj.
      const r = await enviarBorradorPorSuCanal(id, sesion?.email ?? 'setter');
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
      return Response.json({ ok: true });
    }
    if (body.action === 'descartar') {
      await descartarBorrador(id);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:whatsapp/evolution/borradores POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
