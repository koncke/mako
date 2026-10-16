// =============================================================================
// /m/experimentos — «Experiments» en el teléfono: Retro · Experiments · Conclusions · Análisis
// =============================================================================
// La tab de escritorio (app/experimentos) destilada: las MISMAS cuatro vistas, en el mismo orden y
// con el mismo nombre (prototipo v3, `experimentos` en docs/prototipos/mako-mobile-tableros.html),
// con las mismas lecturas (`getExperimentosView`, `listRetros`, `analisisNegocio`) y las mismas
// escrituras (/api/experimentos y /api/retro, ver ./api.ts). Lo que se hace acá:
//   · Retro: abrir una, ver su tesis y sus hallazgos, y decidir su plan (aceptar, posponer,
//     descartar con motivo, deshacer);
//   · Experiments: cerrar y concluir, iniciar uno guardado, descartar, y el alta con MaKo (el «+»);
//   · Conclusions: leerlas;
//   · Análisis: el informe en su orden, con los tres rangos.
// En la computadora: generar una Retro nueva y su Detail, ajustar la propuesta de MaKo, las tablas.
// Referencias de apps reales: la tarjeta de un experimento es la de un ticker de la app de Bolsa de
// iOS; decidir el plan copia el Triage de Linear; Conclusions, el feed de Apple Notes.
//
// Quién: la regla del Sidebar para `experimentos` (sólo el admin del negocio), la misma key que
// escritorio (`requireRolWs([], { nav: 'experimentos' })`).
// ⚠️ El workspace es el del request (lo resuelven las libs con getTenantDb); la query sólo trae las
//    claves de escritorio (`QUERY_DE_SECCION`: tab, el rango del análisis y la hipótesis de Offer).
// ⚠️ El análisis es lento: corre SÓLO con `?tab=analisis`, en paralelo con lo demás, y baja ya
//    dibujado (un server component): su tipo nunca cruza al navegador.
// ⚠️ Sin Meta no se leen experimentos ni retros (nadie los va a ver): escritorio hace lo mismo.
// =============================================================================

import './experimentos.css';
import type { ReactNode } from 'react';
import { requireMovil } from '@/lib/movil-guard';
import { getExperimentosView } from '@/lib/experimentos';
import { listRetros, type Retro } from '@/lib/retro';
import { analisisNegocio } from '@/lib/analisis-negocio';
import { integracionConectada } from '@/lib/credenciales';
import { tabDeUrl } from '@/app/experimentos/tabs';
import { PantallaM } from '@/app/m/_ui';
import { AnalisisM } from './AnalisisM';
import { ExperimentosM } from './ExperimentosM';
import { activoM, conclusionM, guardadoM, retroM, type ConclusionM, type ExpActivoM, type ExpGuardadoM } from './modelo';

export const dynamic = 'force-dynamic';
// Lo de escritorio: la medición en vivo de cada experimento (Meta) y, en Análisis, el informe entero.
export const maxDuration = 60;

type Sp = Record<string, string | string[] | undefined>;

/** Un parámetro repetido (`?tab=a&tab=b`) llega como lista: se toma sólo si es UNO. */
const uno = (v: string | string[] | undefined): string | undefined => (typeof v === 'string' ? v : undefined);
const positivo = (v: string | undefined): number | null => {
  const x = Number((v ?? '').trim());
  return Number.isFinite(x) && x > 0 ? x : null;
};

async function informe(sp: Sp): Promise<ReactNode> {
  const desde = uno(sp.desde) ?? null;
  const hasta = uno(sp.hasta) ?? null;
  try {
    const datos = await analisisNegocio({
      desde, hasta, cierresObjetivo: positivo(uno(sp.cierres)), presupuestoPropuesto: positivo(uno(sp.presupuesto)),
    });
    return <AnalisisM datos={datos} error="" desde={desde} hasta={hasta} />;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[m/experimentos] analisisNegocio:', error);
    return <AnalisisM datos={null} error={error} desde={desde} hasta={hasta} />;
  }
}

export default async function ExperimentosPagina({ searchParams }: { searchParams: Promise<Sp> }) {
  await requireMovil({ navKey: 'experimentos' });
  const sp = await searchParams;
  const tab = tabDeUrl(uno(sp.tab));

  // Arranca ya: es lo más lento y no depende de nada de abajo.
  const analisisP = tab === 'analisis' ? informe(sp) : null;

  let sinMeta = false;
  try { sinMeta = !(await integracionConectada('meta')); } catch (e) {
    console.error('[m/experimentos] integración de Meta:', e instanceof Error ? e.message : e);
  }

  let activos: ExpActivoM[] = [];
  let guardados: ExpGuardadoM[] = [];
  let conclusiones: ConclusionM[] = [];
  let retros: Retro[] = [];
  let errorExp = false;
  if (!sinMeta) {
    const [v, r] = await Promise.allSettled([getExperimentosView(), listRetros()]);
    if (v.status === 'fulfilled') {
      activos = v.value.activos.map(activoM);
      guardados = v.value.propuestos.map(guardadoM);
      conclusiones = v.value.aprendizajes.map(conclusionM);
    } else {
      errorExp = true;
      console.error('[m/experimentos] getExperimentosView:', v.reason instanceof Error ? v.reason.message : v.reason);
    }
    // Como escritorio: sin las retros, la tab Retro arranca vacía (no tapa lo demás).
    if (r.status === 'fulfilled') retros = r.value;
    else console.error('[m/experimentos] listRetros:', r.reason instanceof Error ? r.reason.message : r.reason);
  }

  const analisis = analisisP ? await analisisP : null;
  // La hipótesis de un link «Probarlo» (tab Offer), con el tope de escritorio.
  const hipotesis = uno(sp.hipotesis)?.trim().slice(0, 1000) || null;

  return (
    <PantallaM>
      <ExperimentosM sinMeta={sinMeta} errorExp={errorExp} activos={activos} guardados={guardados}
        conclusiones={conclusiones} retros={retros.map(retroM)} analisis={analisis} hipotesis={hipotesis} />
    </PantallaM>
  );
}
