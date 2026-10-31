// =============================================================================
// /api/automations/metricas — la pestaña «Métricas» de una automatización (lib/automatizacion-metricas.ts)
// =============================================================================
//   GET  ?id=<secuencia>                          → { ok, tablero, version, deMaKo, lecturaFallo, datos, hoy, automatizacion }
//   POST { accion: 'llevar', id, hojaId? }        → { ok, hojaId, nombre }  (una hoja NUEVA en el Dashboard de quien mira)
//
// Lo demás del editor (los datos de cada gráfico al cambiar la vista, y el autoguardado con `?informe=automatizacion:<id>`)
// va por /api/graficos, como el Dashboard y General. Sólo el admin: como el Dashboard (app/api/graficos/route.ts).
// =============================================================================
import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { esQuienes, quienesDeAutomatizacion } from '@/lib/automatizacion-quienes';
import { hoyEnTijuana } from '@/lib/date-utils';
import { datosDeGraficos } from '@/lib/graficos-datos';
import { ocultosPorPlegado, plegadasDeEntrada } from '@/lib/graficos-secciones';
import { pedidosDeHoja } from '@/app/dashboard/exportar';
import { llevarAlDashboard, metricasParaMostrar } from '@/lib/automatizacion-metricas-server';
import { hojaPropia } from '@/app/m/dashboard/datos';
import { periodoDe } from '@/app/m/dashboard/modelo';

export const dynamic = 'force-dynamic';

const no = (status: number, error: string) => Response.json({ ok: false, error }, { status });

async function puerta(): Promise<Response | null> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  return ws == null || rol !== 'admin' ? no(403, 'Solo el admin del workspace.') : null;
}

export async function GET(req: NextRequest) {
  const cerrada = await puerta();
  if (cerrada) return cerrada;
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isSafeInteger(id) || id <= 0) return no(400, 'id inválido');
  // «Respondieron 8», ¿quiénes? (31/10/2026, lib/automatizacion-quienes.ts).
  const quienes = req.nextUrl.searchParams.get('quienes');
  if (quienes != null) {
    if (!esQuienes(quienes)) return no(400, 'Eso no se puede listar.');
    try {
      return Response.json({ ok: true, ...(await quienesDeAutomatizacion(id, quienes)) });
    } catch (e) {
      console.error(`[metricas] quiénes ${id}: ${e instanceof Error ? e.message : String(e)}`);
      return no(500, 'No pude leer quiénes son: prueba de nuevo.');
    }
  }
  try {
    const m = await metricasParaMostrar(id);
    if (!m) return no(404, 'No existe esa automatización.');
    const hoy = hoyEnTijuana();
    const hoja = m.tablero.hojas[0];
    // El teléfono (app/m/automations/MetricasM.tsx): la MISMA hoja pasada por el conversor del Dashboard del teléfono.
    if (req.nextUrl.searchParams.get('movil') === '1') {
      if (!hoja) return no(404, 'Sin métricas.');
      return Response.json({ ok: true, hoja: await hojaPropia(hoja, periodoDe('ult30'), hoy) });
    }
    const pedidos = hoja ? pedidosDeHoja(hoja, {}, hoy, 0, ocultosPorPlegado(hoja.componentes, plegadasDeEntrada(hoja.componentes))).graficos : [];
    const datos = await datosDeGraficos(pedidos.map(({ pedido }) => pedido));
    return Response.json({
      ok: true, tablero: m.tablero, version: m.version, deMaKo: m.deMaKo, lecturaFallo: m.estado === 'error',
      datos, hoy, automatizacion: m.automatizacion,
    });
  } catch (e) {
    console.error(`[metricas] GET ${id}: ${e instanceof Error ? e.message : String(e)}`);
    return no(500, 'No pude leer las métricas: prueba de nuevo.');
  }
}

export async function POST(req: NextRequest) {
  const cerrada = await puerta();
  if (cerrada) return cerrada;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return no(400, 'body inválido'); }
  if (body.accion !== 'llevar') return no(400, 'Acción desconocida.');
  const id = Number(body.id);
  if (!Number.isSafeInteger(id) || id <= 0) return no(400, 'id inválido');
  const hojaId = typeof body.hojaId === 'string' ? body.hojaId.slice(0, 40) : null;
  try {
    const r = await llevarAlDashboard(id, hojaId);
    return r.ok ? Response.json(r) : Response.json(r, { status: r.conflicto ? 409 : 400 });
  } catch (e) {
    console.error(`[metricas] llevar ${id}: ${e instanceof Error ? e.message : String(e)}`);
    return no(500, 'No pude llevarla al Dashboard: prueba de nuevo.');
  }
}
