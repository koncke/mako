// =============================================================================
// GET /api/agente/metricas — los NÚMEROS del negocio, por período, para el agente
// =============================================================================
// La pregunta que lo motivó, textual: «quiero ver un trimestre por ejemplo:
// inversión en Meta, impresiones, llegadas al landing VSL, juntas agendadas,
// juntas 1 realizadas, j2 realizadas… ¿puedo bajar la data?».
//
// Hasta acá la skill de Claude tenía CERO datos vivos: `/api/agente/contexto`
// devuelve el negocio (oferta, avatares, voz, catálogo) y `/api/agente/plan` el
// tablero, y las dos son SNAPSHOTS de configuración. Nada en toda la superficie
// del agente sabía cuánto se invirtió, cuánta gente llegó ni cuántas reuniones
// se hicieron — que es justo lo que se pregunta cuando se quiere decidir algo.
//
// Auth: `Authorization: Bearer <token de /integraciones>`, igual que el resto de
// /api/agente. Sin cookies: corre en la compu del cliente.
//
// ⚠️ ESTA RUTA VA EN `lib/rutas-publicas.ts` O NO EXISTE EN PRODUCCIÓN. El
// middleware corta con «no autenticado» ANTES de que nadie mire el bearer, y en
// local no se nota porque `gateConfigurado()` es false y el proxy hace no-op:
// contra localhost anda perfecto y falla solo en prod. Ya pasó con las cuatro
// rutas originales del agente — está escrito en la cabecera de ese archivo.
//
// TRES FORMATOS, y el default NO es JSON: `md` (tabla markdown) es lo que un
// agente lee mejor y lo que se puede pegar en un mensaje; `csv` es la respuesta
// literal a «¿puedo bajar la data?»; `json` es para cuando hay que calcular
// encima. El que decide es quien llama, no esta ruta.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { bearerDe, wsPorAgenteToken } from '@/lib/agente-token';
import { runWithWorkspace } from '@/lib/workspace';
import {
  reporteMetricas, metricasACsv, metricasAMarkdown, GRANOS, type Grano,
} from '@/lib/metricas-negocio';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// El barrido pagina tres tablas grandes. 60 s es el techo de la casa para lo que
// no es un cron; con el rango tope (5 años) hay que quedarse adentro.
export const maxDuration = 60;

const FORMATOS = ['md', 'csv', 'json'] as const;
type Formato = (typeof FORMATOS)[number];

export async function GET(req: NextRequest) {
  const ws = await wsPorAgenteToken(bearerDe(req));
  if (ws == null) {
    return NextResponse.json({ ok: false, error: 'token inválido o revocado' }, { status: 401 });
  }

  const q = req.nextUrl.searchParams;
  const formato = (q.get('formato') ?? 'md').trim().toLowerCase();
  if (!FORMATOS.includes(formato as Formato)) {
    // Se contesta con la lista y no con un 404 mudo: el agente se corrige solo en
    // vez de reintentar a ciegas. Mismo criterio que ?seccion= en /contexto.
    return NextResponse.json(
      { ok: false, error: `formato desconocido: ${formato}`, disponibles: FORMATOS },
      { status: 400 },
    );
  }

  const granoRaw = (q.get('grano') ?? 'mes').trim().toLowerCase();
  if (!GRANOS.includes(granoRaw as Grano)) {
    return NextResponse.json(
      { ok: false, error: `grano desconocido: ${granoRaw}`, disponibles: GRANOS },
      { status: 400 },
    );
  }

  try {
    const reporte = await runWithWorkspace(ws, () =>
      reporteMetricas({ desde: q.get('desde'), hasta: q.get('hasta'), grano: granoRaw as Grano }));

    if (formato === 'json') return NextResponse.json({ ok: true, ...reporte });

    if (formato === 'csv') {
      const { desde, hasta, grano } = reporte.periodo;
      const nombre = `metricas-${desde}_a_${hasta}-por-${grano}.csv`;
      return new NextResponse(metricasACsv(reporte), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${nombre}"`,
          // Las salvedades NO entran en un CSV (una planilla no tiene dónde
          // ponerlas) y sin ellas el archivo se lee como si cada número fuera
          // exacto. Van en cabeceras para que quien baje por API las vea igual.
          'X-Advertencias': String(reporte.advertencias.length),
          'X-Filas': String(reporte.filas.length),
        },
      });
    }

    return new NextResponse(metricasAMarkdown(reporte), {
      status: 200,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  } catch (err) {
    // Un rango mal formado es culpa de quien llama (400) y el mensaje dice qué
    // hacer; cualquier otra cosa es nuestra (500). Devolverlos todos como 500
    // manda al agente a reintentar algo que nunca va a andar.
    const msg = err instanceof Error ? err.message : String(err);
    const esDelCliente = /fecha válida|al revés|tope es/.test(msg);
    return NextResponse.json({ ok: false, error: msg }, { status: esDelCliente ? 400 : 500 });
  }
}
