// =============================================================================
// /analisis — el análisis que Martín le hace a un cliente, sin la reunión
// =============================================================================
// Sale de la reunión Mau <> Martín del 31/07/2026: tres horas mirando los datos
// en vivo, de las cuales **media fue aritmética con la calculadora del celular**.
// Esta pantalla es esa aritmética resuelta, en el mismo orden en que se pregunta.
//
// POR QUÉ NO ES OTRO DASHBOARD, y es la decisión que gobierna el diseño: un
// dashboard muestra métricas y deja que vos armes la historia. Acá el orden ES la
// historia — primero qué pasó, después dónde se va la plata escalón por escalón,
// después la fuga barata (los que asistieron sin calificar), después qué replicar
// y al final qué haría falta para la meta. Un informe que arranca por los
// creativos invita a optimizar el anuncio cuando el agujero está en el show rate.
//
// Y LAS ADVERTENCIAS VAN ARRIBA DE TODO. Si el 46% de las asistencias no tiene
// la calificación marcada, eso hay que saberlo ANTES de leer el número — no
// después de haber sacado una conclusión. Es la misma razón por la que el rango
// de fechas se dice en el encabezado y no se esconde: el «histórico» sin fecha de
// inicio fue lo que en la reunión dejó todos los costos unitarios 33% abajo.
// =============================================================================

import { Pagina, PageHeader } from '@/app/_ui';
import { requireRolWs } from '@/lib/tab-access';
import { analisisNegocio } from '@/lib/analisis-negocio';
import { VistaAnalisis } from './VistaAnalisis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AnalisisPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; cierres?: string; presupuesto?: string }>;
}) {
  await requireRolWs([], { nav: 'analisis' });
  const sp = await searchParams;

  // El rango viaja en la URL para que un análisis se pueda COMPARTIR y volver a
  // abrir igual. Un informe cuyo rango vive en el estado del componente no se
  // puede citar: el que abre el link ve otro número y nadie se entera.
  const n = (v: string | undefined): number | null => {
    const x = Number((v ?? '').trim());
    return Number.isFinite(x) && x > 0 ? x : null;
  };

  let datos: Awaited<ReturnType<typeof analisisNegocio>> | null = null;
  let error = '';
  try {
    datos = await analisisNegocio({
      desde: sp.desde ?? null,
      hasta: sp.hasta ?? null,
      cierresObjetivo: n(sp.cierres),
      presupuestoPropuesto: n(sp.presupuesto),
    });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <Pagina>
      <PageHeader
        titulo="Análisis"
        proposito="Qué pasó en el período, dónde se va la plata escalón por escalón, y qué haría falta para la meta."
      />
      <VistaAnalisis datos={datos} error={error} />
    </Pagina>
  );
}
