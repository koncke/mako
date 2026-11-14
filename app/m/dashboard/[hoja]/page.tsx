// =============================================================================
// /m/dashboard/[hoja] — una hoja PROPIA del informe, en la forma fija del teléfono
// =============================================================================
// docs/diseno-mako-mobile-v2.md, «Dashboard»: «Las hojas personalizadas se ven, pero en la forma
// fija del teléfono (un gráfico + la lista), no con su layout». De la hoja entran sus cuadros de
// resultados (la lista, con su variación) y su primera serie de tiempo (el gráfico); los bloques,
// las tablas y los demás gráficos quedan en la computadora (./datos.ts → `piezasDeHoja`).
//
// La hoja sale del informe de ESTA persona (`leerTablero`, el mismo de escritorio): el id de la URL
// sólo elige dentro de él. Marketing y Comercial no se abren acá (son el segmentado de
// /m/dashboard), y el closer no tiene otras hojas: los dos vuelven a /m/dashboard.
// =============================================================================

import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { rutaConWs } from '@/lib/workspace';
import { hoyEnTijuana } from '@/lib/date-utils';
import { hojaDeRol } from '@/lib/graficos-plantillas';
import { CabeceraM, ComputadoraM, PantallaM } from '@/app/m/_ui';
import { DashboardM } from '../DashboardM';
import { hojaPropia, hojaPropiaDe, periodoPropio, tableroDelPedido } from '../datos';
import { VOLVER_AL_DASHBOARD } from '../redireccion';
import { periodoDeParam, periodosParaHoja } from '../modelo';
import { conQueAnalizaElClosing, CONECTA_TU_CLAUDE_CLOSING } from '@/lib/closing';
import { avisoDeLaHojaClosing, esHojaClosing } from '@/app/dashboard/aviso-closing';
import { iaCaidaParaLaHoja } from '@/lib/closing-ia-caida';
import { avisoDeIaCaida } from '@/lib/closing-ia-caida-reglas';
import { esEsencialDeLaSesion } from '@/lib/plan-esencial';
import { TEXTO_CLOSING_SOLO_PRO_TELEFONO } from '@/lib/closing-solo-pro';
import '../dashboard.css';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Busqueda = { periodo?: string | string[] };
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function HojaPropiaPagina({ params, searchParams }: {
  params: Promise<{ hoja: string }>;
  searchParams: Promise<Busqueda>;
}) {
  const ctx = await requireMovil({ navKey: 'graphics' });
  // ⚠️ Las dos vueltas las hace ANTES el layout (../layout.tsx, la carga directa: un redirect debajo de ../loading.tsx va
  //    en el stream, React #310); éstas quedan para cuando se llega navegando. La MISMA cuenta en los dos.
  if (hojaDeRol(ctx.rol)) redirect(await rutaConWs(VOLVER_AL_DASHBOARD));

  // El informe sale de `tableroDelPedido`: el layout ya lo leyó para decidir, y no se lee dos veces.
  const [{ hoja: crudo }, p, lectura] = await Promise.all([params, searchParams, tableroDelPedido()]);
  let id = crudo;
  try { id = decodeURIComponent(crudo); } catch { /* un % suelto: se busca tal cual */ }
  const h = hojaPropiaDe(lectura.tablero, id);
  if (!h) redirect(await rutaConWs(VOLVER_AL_DASHBOARD));

  // La hoja Closing es SÓLO de MaKo Pro (14/11/2026, lib/closing-solo-pro.ts): al Esencial, de qué plan es (el teléfono no
  // vende) EN LUGAR de sus datos, que no se leen. Ante la duda, se ve.
  if (esHojaClosing(h) && (await esEsencialDeLaSesion())) {
    return (
      <PantallaM>
        <CabeceraM titulo={h.nombre} />
        <p className="m-dash-aviso" role="status">{TEXTO_CLOSING_SOLO_PRO_TELEFONO}</p>
      </PantallaM>
    );
  }

  const def = periodoPropio(h);
  const periodos = def ? periodosParaHoja(def) : [];
  const periodo = def ? periodoDeParam(uno(p.periodo), periodos, def) : null;
  const [hoja, closing, caida] = await Promise.all([
    hojaPropia(h, periodo, hoyEnTijuana()),
    // La hoja Closing sin con qué analizar (IA12, app/dashboard/aviso-closing.ts). Conectar es en la computadora.
    esHojaClosing(h) ? conQueAnalizaElClosing().catch(() => 'no-se' as const) : null,
    // Y con su clave caída, la causa (27/10/2026, lib/closing-ia-caida.ts).
    esHojaClosing(h) ? iaCaidaParaLaHoja() : null,
  ]);
  const aviso = avisoDeLaHojaClosing(closing, CONECTA_TU_CLAUDE_CLOSING, avisoDeIaCaida(caida));

  return (
    <PantallaM>
      <CabeceraM titulo={h.nombre} />
      {aviso && <p className="m-dash-aviso" role="status">{aviso}</p>}
      <DashboardM hojas={[hoja]} hojaInicial={hoja.id} periodo={periodo} periodos={periodos} fichaLead={false} />
      <ComputadoraM que="La hoja completa" />
    </PantallaM>
  );
}
