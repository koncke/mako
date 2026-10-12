// =============================================================================
// /experimentos — la única vista con verdades, y con datos
// =============================================================================
// Cuatro tabs: Retro · Experiments · Conclusions · Análisis.
//   Retro        → MaKo lee el funnel + experimentos + conclusiones + tareas de un
//                  período y deja un reporte + un plan (prueba esto / haz esto).
//   Experiments  → hipótesis → prueba medible contra el dato real → cierre.
//   Conclusions  → las verdades validadas (aprendizajes cerrados con dato).
//   Análisis     → el informe del negocio en el orden en que se pregunta: la
//                  cascada de costos, la fuga de los que no calificaban, los
//                  creativos y qué haría falta para la meta (VistaAnalisis.tsx).
//                  Era su propia tab de la barra (/analisis, que hoy redirige
//                  acá) hasta el 11/10/2026, cuando Martín pidió llevarla adentro
//                  de Experiments.
// El tablero To-do vive en su propia ruta /todo.
//
// En el resto del dashboard MaKo sugiere abrir un experimento; solo acá se
// declaran verdades. La página solo lee (resiliente: en local sin Supabase cae a
// datos DEMO en desarrollo; en producción, dato real).
//
// La tab viaja en `?tab=` y se lee ACÁ, en el server, con `tabDeUrl` (./tabs, un
// módulo puro: NUNCA un valor exportado de ExperimentosApp, que es 'use client').
// Hace falta saberla de este lado por Análisis: `analisisNegocio` es lenta, así
// que sólo corre cuando la URL pide esa tab, y su informe baja a ExperimentosApp
// ya dibujado (un ReactNode), con el rango de la URL —desde/hasta/cierres/
// presupuesto, para que un análisis se pueda compartir y volver a abrir igual—.
//
// EL CORTE DE META YA NO TAPA LA PANTALLA. Retro, Experiments y Conclusions miden
// contra los números de Meta y sin ellos salen vacíos, así que antes la page
// devolvía el PanelActivacion en lugar de todo. Con Análisis adentro eso se la
// escondía a los negocios sin Meta, y Análisis no lo necesita: la cascada sale
// del CRM. Ahora la page monta SIEMPRE el shell y le pasa el panel; el shell lo
// dibuja en el lugar de esas tres tabs y deja Análisis andando. Sin Meta tampoco
// se leen experimentos ni retros: nadie los va a ver.
// =============================================================================

import type { ReactNode } from 'react';
import { getExperimentosView, type ExperimentosView } from '@/lib/experimentos';
import { listRetros, type Retro } from '@/lib/retro';
import { analisisNegocio } from '@/lib/analisis-negocio';
import { ExperimentosApp } from './ExperimentosApp';
import { VistaAnalisis } from './VistaAnalisis';
import { tabDeUrl } from './tabs';
import { requireRolWs } from '@/lib/tab-access';
import { integracionConectada } from '@/lib/credenciales';
import { PanelActivacion } from '../_components/PanelActivacion';
import { tabActivacion } from '@/lib/tab-activacion';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EMPTY_VIEW: ExperimentosView = {
  activos: [], propuestos: [], aprendizajes: [], descartados: [],
  counts: { activos: 0, propuestos: 0, cerrados: 0, validadas: 0 },
};

/** Un parámetro repetido (`?tab=a&tab=b`) llega como lista: se toma sólo si es UNO. */
const uno = (v: string | string[] | undefined): string | undefined => (typeof v === 'string' ? v : undefined);

/** Lo que tarda el análisis corre en paralelo con lo de Meta y los experimentos. */
async function informeAnalisis(sp: Record<string, string | string[] | undefined>): Promise<ReactNode> {
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
      desde: uno(sp.desde) ?? null,
      hasta: uno(sp.hasta) ?? null,
      cierresObjetivo: n(uno(sp.cierres)),
      presupuestoPropuesto: n(uno(sp.presupuesto)),
    });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return <VistaAnalisis datos={datos} error={error} />;
}

export default async function ExperimentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRolWs([], { nav: 'experimentos' });
  const sp = await searchParams;
  const tab = tabDeUrl(uno(sp.tab));

  // Arranca ya: es lo más lento de la pantalla y no depende de nada de abajo.
  const analisisP: Promise<ReactNode> | null = tab === 'analisis' ? informeAnalisis(sp) : null;

  // La Retro (el corazón de esta tab) necesita métricas de Meta para tener
  // contra qué medir; sin ellas sale vacía. El panel pide Meta y ofrece correrla.
  const tabExp = tabActivacion('experimentos');
  const panelSinMeta = tabExp && !(await integracionConectada('meta')) ? <PanelActivacion tab={tabExp} /> : null;

  let view: ExperimentosView = EMPTY_VIEW;
  let retros: Retro[] = [];
  let errorMsg: string | null = null;
  let demo = false;

  if (!panelSinMeta) {
    let dbDown = false;
    try { view = await getExperimentosView(); } catch (err) { errorMsg = err instanceof Error ? err.message : String(err); dbDown = true; }
    try { retros = await listRetros(); } catch { /* tab Retro arranca vacía */ }

    if (dbDown && process.env.NODE_ENV !== 'production') {
      const d = await import('./_demo');
      view = d.demoView; retros = d.demoRetros; demo = true; errorMsg = null;
    }
  }

  const analisis = analisisP ? await analisisP : null;
  // La hipótesis de un link «Probarlo» (tab Offer). Con tope: es el texto de una
  // propuesta, no un documento, y un link roto no tiene por qué llenar el alta.
  const hipotesis = uno(sp.hipotesis)?.trim().slice(0, 1000) || null;

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 70px' }}>
      <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: '0 0 22px', color: 'var(--ink)' }}>Experiments</h1>
      <ExperimentosApp exp={view} retros={retros} errorMsg={errorMsg} demo={demo}
        tabInicial={tab} analisis={analisis} panelSinMeta={panelSinMeta} hipotesisInicial={hipotesis} />
    </main>
  );
}
