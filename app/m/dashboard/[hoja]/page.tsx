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
import { leerTablero } from '@/lib/graficos-tablero';
import { hojaDeRol, hojaDestino } from '@/lib/graficos-plantillas';
import { CabeceraM, ComputadoraM, PantallaM } from '@/app/m/_ui';
import { DashboardM } from '../DashboardM';
import { entraEnTelefono, esHojaInicial, hojaPropia, periodoPropio } from '../datos';
import { periodoDeParam, periodosParaHoja } from '../modelo';
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
  const volver = '/m/dashboard';
  if (hojaDeRol(ctx.rol)) redirect(await rutaConWs(volver));

  const [{ hoja: crudo }, p, lectura] = await Promise.all([params, searchParams, leerTablero()]);
  let id = crudo;
  try { id = decodeURIComponent(crudo); } catch { /* un % suelto: se busca tal cual */ }
  // El id exacto, o el nombre de una plantilla (`closing`, `landing`…) como lo resuelve escritorio
  // con `?hoja=` (hojaDestino): los links de escritorio llegan así por rutaMovil. Si escritorio
  // tendría que AGREGAR la hoja, el teléfono no la agrega (eso escribe el informe): vuelve.
  const destino = hojaDestino(lectura.tablero, id);
  const h = destino.agregar ? undefined : lectura.tablero.hojas.find((x) => x.id === destino.hojaId);
  if (!h || esHojaInicial(h) || !entraEnTelefono(h)) redirect(await rutaConWs(volver));

  const def = periodoPropio(h);
  const periodos = def ? periodosParaHoja(def) : [];
  const periodo = def ? periodoDeParam(uno(p.periodo), periodos, def) : null;
  const hoja = await hojaPropia(h, periodo, hoyEnTijuana());

  return (
    <PantallaM>
      <CabeceraM titulo={h.nombre} />
      <DashboardM hojas={[hoja]} hojaInicial={hoja.id} periodo={periodo} periodos={periodos} fichaLead={false} />
      <ComputadoraM que="La hoja completa" />
    </PantallaM>
  );
}
