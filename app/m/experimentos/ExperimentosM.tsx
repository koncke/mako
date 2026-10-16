'use client';

// =============================================================================
// /m/experimentos — el shell de la pantalla: las cuatro tabs de escritorio y el «+» de la cabecera
// =============================================================================
// Retro · Experiments · Conclusions · Análisis, como app/experimentos/ExperimentosApp.tsx, con la
// tab en `?tab=` (la misma clave de escritorio: un link de la computadora abre la misma tab).
//
// ⚠️ LA TAB SE LEE DE LA URL (`useSearchParams`), NO DE UN ESTADO COPIADO DEL SERVER. Retro,
//    Experiments y Conclusions ya bajaron con la página: cambiar entre ellas es un `replaceState`
//    (Next lo integra a su router, sin viaje). Análisis es distinta, como en escritorio: el informe
//    lo calcula el server (`analisisNegocio` es lenta) sólo cuando la URL lo pide, así que ir a
//    Análisis sin el informe en la mano es un `router.replace` en una transición, con esqueleto.
//    Escritorio guardaba la tab en un estado y el «atrás» pintaba otra (revisión del 11/10): acá la
//    pantalla y la URL no se pueden separar.
// ⚠️ SIN META, Retro, Experiments y Conclusions no tienen contra qué medir (escritorio pone su panel
//    de activación en su lugar); Análisis sale del CRM y sigue andando.
// ⚠️ El link «Probarlo» de Offer trae `?hipotesis=`: abre el alta con la hipótesis escrita, UNA vez.
//    Se mira en la URL del navegador (no en la prop): volver «atrás» a esta entrada restaura el árbol
//    viejo con la prop puesta, y la reabriría (lo que le pasó a escritorio, ExperimentsTab.tsx).
// =============================================================================

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { CabeceraM, ComputadoraM, ErrorM, SegmentadoM, SkeletonFilas, VacioM } from '@/app/m/_ui';
import { tabDeUrl } from '@/app/experimentos/tabs';
import {
  R, VISTAS_EXPERIMENTOS, urlCon,
  type ConclusionM, type ExpActivoM, type ExpGuardadoM, type RetroM, type TabExperimentos,
} from './modelo';
import { NuevoExperimentoM } from './NuevoExperimentoM';
import { VistaConclusionsM } from './VistaConclusionsM';
import { VistaExperimentsM } from './VistaExperimentsM';
import { VistaRetroM } from './VistaRetroM';

export function ExperimentosM({
  sinMeta, errorExp, activos, guardados, conclusiones, retros, analisis, hipotesis,
}: {
  sinMeta: boolean;
  /** No se pudieron leer los experimentos (la base): Análisis sigue andando. */
  errorExp: boolean;
  activos: ExpActivoM[];
  guardados: ExpGuardadoM[];
  conclusiones: ConclusionM[];
  retros: RetroM[];
  /** El informe de Análisis, dibujado en el server. null = esta request no lo pidió. */
  analisis: ReactNode | null;
  /** La hipótesis del link «Probarlo» de Offer. */
  hipotesis: string | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const tabUrl = tabDeUrl(sp.get('tab') ?? undefined);

  // Análisis sin el informe: la tab se muestra YA y el informe llega con la transición.
  const [pedida, setPedida] = useState<TabExperimentos | null>(null);
  const [trayendo, empezar] = useTransition();
  useEffect(() => { if (!trayendo) setPedida(null); }, [trayendo]);
  const tab = pedida ?? tabUrl;

  const elegir = (t: TabExperimentos) => {
    if (t === tab) return;
    const destino = urlCon(window.location.href, { tab: t, retro: null, sheet: null });
    if (t === 'analisis' && analisis == null) {
      setPedida(t);
      empezar(() => router.replace(destino, { scroll: false }));
      return;
    }
    setPedida(null);
    window.history.replaceState(null, '', destino);
  };

  // ── El alta de un experimento: el «+» de la cabecera, el vacío y el link de Offer ──
  const [nuevo, setNuevo] = useState<{ abierto: boolean; n: number; hipotesis: string }>({ abierto: false, n: 0, hipotesis: '' });
  const abrirNuevo = (h = '') => setNuevo((x) => ({ abierto: true, n: x.n + 1, hipotesis: h }));

  const usada = useRef(false);
  useEffect(() => {
    if (!hipotesis || usada.current || sinMeta || errorExp) return;
    usada.current = true;
    let enUrl = false;
    try { enUrl = new URL(window.location.href).searchParams.has('hipotesis'); } catch { /* sin URL */ }
    if (!enUrl) return;
    window.history.replaceState(null, '', urlCon(window.location.href, { hipotesis: null, tab: 'experiments' }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    abrirNuevo(hipotesis);
  }, [hipotesis, sinMeta, errorExp]);

  const midiendo = !sinMeta && !errorExp;
  const accion = useMemo(() => (tab === 'experiments' && midiendo ? (
    <button type="button" className="m-cabecera__accion" aria-label={R.nuevo} onClick={() => abrirNuevo()}>
      <Icon name="plus" size={24} />
    </button>
  ) : null), [tab, midiendo]);

  let cuerpo: ReactNode;
  if (tab === 'analisis') {
    cuerpo = analisis != null && !trayendo ? analisis : <SkeletonFilas filas={6} />;
  } else if (sinMeta) {
    cuerpo = (
      <>
        <VacioM frase="Meta no está conectado en este negocio." />
        <ComputadoraM que="Conectar Meta en Integraciones" />
      </>
    );
  } else if (errorExp) {
    cuerpo = <ErrorM frase="No pude leer los experimentos. No es nada tuyo." />;
  } else if (tab === 'retro') {
    cuerpo = <VistaRetroM retros={retros} />;
  } else if (tab === 'experiments') {
    cuerpo = <VistaExperimentsM activos={activos} guardados={guardados} onNuevo={() => abrirNuevo()} />;
  } else {
    cuerpo = <VistaConclusionsM conclusiones={conclusiones} />;
  }

  return (
    <div className="m-experimentos">
      <CabeceraM accion={accion} />
      <div className="m-experimentos-vistas">
        <SegmentadoM<TabExperimentos> etiqueta="Vista" valor={tab} onCambio={elegir}
          opciones={VISTAS_EXPERIMENTOS.map((v) => ({ id: v.id, label: v.label }))} />
      </div>
      {cuerpo}
      {midiendo && (
        <NuevoExperimentoM key={nuevo.n} abierto={nuevo.abierto} hipotesisInicial={nuevo.hipotesis}
          onCerrar={() => setNuevo((x) => ({ ...x, abierto: false }))} />
      )}
    </div>
  );
}
