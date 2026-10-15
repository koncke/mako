// =============================================================================
// /api/account-insights — desgloses (edad/género, plataforma, región) de TODA
// la cuenta para un período, directo de Meta.
// =============================================================================
// El resumen de la tab Marketing lo consume para mostrar los mismos gráficos del
// detalle de anuncio (barras + mapa), pero agregando toda la cuenta en vez de un
// solo anuncio. Mismo shape de breakdowns que /api/ad-insights.
//
// El pedido a Meta (credenciales, paginado, caché) vive en lib/meta-desgloses.ts y
// cómo se lee una fila, en lib/graficos-audiencia.ts: los comparte con la audiencia
// del Dashboard (11/10/2026). La respuesta de acá no cambió.

import type { NextRequest } from 'next/server';
import { conversorGastoMeta } from '@/lib/moneda-meta';
import { integracionConectada } from '@/lib/credenciales';
import { desglosesCuenta, FalloMeta, type FilaInsights } from '@/lib/meta-desgloses';
import { conversionesEnLectura, leerFilaMeta, type FilaMeta } from '@/lib/graficos-audiencia';
// Sólo quien administra el workspace: gasto y entrega de Meta en vivo (ver /api/meta-health).
import { guardAdsWs } from '@/lib/ads-guard';

export const dynamic = 'force-dynamic';

const isISO = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
/** Las filas de UNA lectura con sus números (la agenda se decide mirando la lectura entera). */
const leer = (rows: FilaInsights[]): FilaMeta[] => { const con = conversionesEnLectura(rows); return rows.map((r) => leerFilaMeta(r, con)); };

export async function GET(req: NextRequest) {
  const no = await guardAdsWs();
  if (no) return no;
  // El `spend` de Meta viene en la moneda de la CUENTA, que no siempre es MXN (ws13, ws14
  // y ws15 cobran en USD): dividirlo por 17,3 les achicaba el gasto 17 veces.
  const { aUsdNum: usd } = await conversorGastoMeta();
  const desde = req.nextUrl.searchParams.get('desde');
  const hasta = req.nextUrl.searchParams.get('hasta');
  if (!isISO(desde) || !isISO(hasta)) return Response.json({ error: 'fechas inválidas' }, { status: 400 });

  // Fase 1: Meta es la integración global del dueño. Otros workspaces reciben el
  // mismo shape de éxito pero con desgloses vacíos (sin key `error`).
  if (!(await integracionConectada('meta'))) {
    return Response.json({ demograficos: [], plataformas: [], regiones: [] });
  }

  try {
    const [ageArr, platArr, regArr] = await Promise.all([
      desglosesCuenta({ desde, hasta, breakdown: 'age,gender' }),
      desglosesCuenta({ desde, hasta, breakdown: 'publisher_platform' }),
      desglosesCuenta({ desde, hasta, breakdown: 'region' }),
    ]);

    // `agendas ?? 0`: con región Meta no da la agenda, y esta pantalla la mostraba en cero.
    const mapBD = (rows: FilaMeta[], label: (r: FilaMeta) => string) =>
      rows.map((r) => ({ label: label(r), impressions: r.impresiones, reach: r.alcance, agendas: r.agendas ?? 0, spend_usd: usd(r.gastoCuenta) }))
        .filter((x) => x.impressions > 0 || x.spend_usd > 0)
        .sort((a, b) => b.impressions - a.impressions);

    const demograficos = leer(ageArr).map((r) => ({
      age: r.age ?? '—',
      genero: (r.gender === 'male' ? 'H' : r.gender === 'female' ? 'M' : '?') as 'H' | 'M' | '?',
      impressions: r.impresiones, reach: r.alcance, agendas: r.agendas ?? 0, spend_usd: usd(r.gastoCuenta),
    })).filter((x) => x.impressions > 0 || x.spend_usd > 0);
    const plataformas = mapBD(leer(platArr), (r) => r.publisher_platform ?? '—');
    const regiones = mapBD(leer(regArr), (r) => r.region ?? '—').slice(0, 40);

    // Los insights de Meta toleran latencia; el navegador reusa la respuesta por
    // (desde,hasta) al alternar tabs / volver a un rango ya visto en vez de re-pegar.
    return Response.json(
      { demograficos, plataformas, regiones },
      { headers: { 'Cache-Control': 'private, max-age=120' } },
    );
  } catch (err) {
    // Lo mismo que antes contestaba la ruta cuando faltaban el token o la cuenta.
    if (err instanceof FalloMeta && (err.motivo === 'sin_conexion' || err.motivo === 'sin_workspace')) {
      return Response.json({ error: 'Meta no configurado' }, { status: 500 });
    }
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
