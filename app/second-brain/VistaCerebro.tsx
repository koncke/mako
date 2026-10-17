'use client';

// =============================================================================
// VistaCerebro — la pantalla del Second Brain: la cabecera, el grafo y el editor de un área
// =============================================================================
// El feedback de Martín del 17/10/2026 (puntos 11 y 12) la dejó así:
//   · SIEMPRE EN OSCURO. `data-tema="oscuro"` en la raíz da vuelta los tokens de la casa (app/globals.css) sólo acá
//     adentro, sea cual sea el tema de la app. El fondo va escrito (`--bg`): sin él se vería el de la pantalla de atrás.
//   · ARRIBA, «Second Brain» y «Todo lo que MaKo sabe de tu negocio.», y nada más: se fueron el título «Mapa» de la
//     pantalla del Ops Center y el botón «Conectar a Claude» (el Centro ya conecta a Claude por defecto; el token sigue
//     en /integraciones). «Exportar» va ADENTRO del lienzo, arriba a la derecha (el slot `accion` del grafo).
//   · AL TOCAR UN NODO NO APARECE NADA ABAJO, JAMÁS: el detalle es la barra lateral del grafo. Editar un área es una
//     intención explícita («Editar» en la barra lateral, o un `?area=` de otra pantalla) y abre el editor en una caja
//     encima (AreasHub.tsx), nunca debajo del grafo.
//
// EL FILTRO VIVE ACÁ y no adentro del grafo porque «Exportar» tiene que bajar el MISMO recorte que se está mirando.
// =============================================================================

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { AREAS, type AreaId, type Cerebro } from '@/lib/cerebro-modelo';
import { vistaValida } from '@/lib/secciones-negocio';
import { filtroVacio, type EstadoFiltro } from '@/lib/cerebro-filtro';
import { Icon } from '@/app/_components/icons';
import { Grafo } from './Grafo';
import { AreasHub } from './AreasHub';
import { BotonExportar } from './BotonExportar';
import { useVolverDelGrafo } from './volver';

/** Cada cuánto el grafo se vuelve a pedir mientras la pestaña está a la vista (el grafo VIVO). */
const MS_GRAFO_VIVO = 180_000;

export const TITULO_SECOND_BRAIN = 'Second Brain';
export const SUBTITULO_SECOND_BRAIN = 'Todo lo que MaKo sabe de tu negocio.';
/** La capa del super admin: la construcción de MaKo (lib/cerebro-construccion.ts). */
export const SUBTITULO_CONSTRUCCION = 'Cómo se está construyendo MaKo.';
type Capa = 'negocio' | 'construccion';

export function VistaCerebro({ cerebro: delServidor, construccion = null, funnelPanel }: {
  cerebro: Cerebro;
  /** La construcción de MaKo: sólo para quien opera (el servidor la manda null a todos los demás, pagina.tsx). */
  construccion?: Cerebro<string> | null;
  funnelPanel: ReactNode;
}) {
  // ── EL GRAFO VIVO (punto 13, 17/10/2026) ──────────────────────────────────
  // El grafo llega del servidor y se vuelve a pedir cada 3 minutos mientras la pestaña está a la vista. Con la huella
  // del que ya se tiene: si nada cambió, no viaja el grafo ni se redibuja. Si cambió, los nodos nuevos entran VIAJANDO
  // y lo que ya estaba se desliza a su lugar (Grafo.tsx). Un fallo no hace nada: el grafo que se ve sigue siendo verdad.
  const [cerebro, setCerebro] = useState(delServidor);
  useEffect(() => { setCerebro(delServidor); }, [delServidor]);
  const huella = cerebro.huella ?? null;
  useEffect(() => {
    let vivo = true;
    const t = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const r = await fetch(`/api/second-brain/cerebro${huella ? `?huella=${encodeURIComponent(huella)}` : ''}`, { signal: AbortSignal.timeout(60_000) });
        const j = await r.json() as { ok?: boolean; igual?: boolean; cerebro?: Cerebro };
        if (vivo && j?.ok && !j.igual && j.cerebro) setCerebro(j.cerebro);
      } catch { /* sin red: se queda el que se ve */ }
    }, MS_GRAFO_VIVO);
    return () => { vivo = false; window.clearInterval(t); };
  }, [huella]);

  // `?area=oferta` abre el editor de esa sección de entrada: otras pantallas mandan acá a hacer algo concreto (el
  // selector de oferta del CRM manda a crear una). Se valida contra AREAS: un valor cualquiera no abre nada.
  const params = useSearchParams();
  const areaInicial = AREAS.find((a) => a.id === params?.get('area'))?.id ?? null;
  // `&vista=persona` abre esa sub-pestaña del área (lib/secciones-negocio.ts → rutaSeccion).
  const vistaInicial = areaInicial ? vistaValida(areaInicial, params?.get('vista')) : null;
  const [editando, setEditando] = useState<AreaId | null>(areaInicial);
  const volver = useVolverDelGrafo();

  // ── LAS DOS CAPAS (super admin): el negocio que se mira y la construcción de MaKo. Son dos grafos, no uno mezclado:
  //    la construcción es de la plataforma y el negocio es del workspace. `?capa=construccion` abre en ella. ──
  const [capa, setCapa] = useState<Capa>(() => (construccion && params?.get('capa') === 'construccion' ? 'construccion' : 'negocio'));
  const enObra = capa === 'construccion' && construccion != null;
  const elegirCapa = (c: Capa) => {
    setCapa(c);
    try {
      const u = new URL(window.location.href);
      if (c === 'construccion') u.searchParams.set('capa', c); else u.searchParams.delete('capa');
      // `null` y no el estado de Next: con el `__NA` del router, la URL se pisa (docs/hallazgos-operaciones.md).
      window.history.replaceState(null, '', u);
    } catch { /* es una comodidad */ }
  };
  const [filtroObra, setFiltroObra] = useState<EstadoFiltro>(filtroVacio);

  const [filtro, setFiltro] = useState<EstadoFiltro>(filtroVacio);
  /** Lo que el grafo muestra de verdad (filtro + búsquedas): el rótulo de «Exportar» lo usa. */
  const [verse, setVerse] = useState<{ ids: string[]; recortado: boolean }>({ ids: [], recortado: false });
  const alVerse = useCallback((info: { ids: string[]; recortado: boolean }) => setVerse(info), []);

  return (
    <div className="sb-vista" data-tema="oscuro">
      <style>{`
        .sb-vista {
          flex: 1; min-height: 0; height: 100%; display: flex; flex-direction: column;
          background: var(--bg); color: var(--ink); color-scheme: dark;
        }
        .sb-cab { display: flex; align-items: center; gap: 10px; padding: 18px 22px 12px; flex: none; }
        .sb-cab__titulo { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -.01em; line-height: 1.2; color: var(--ink); }
        .sb-cab__sub { margin: 2px 0 0; font-size: 13.5px; color: var(--dim); line-height: 1.4; }
        .sb-cab__volver {
          display: none; align-items: center; justify-content: center; flex: none;
          width: 36px; height: 36px; border-radius: 10px; border: none; background: none; color: var(--dim); cursor: pointer;
        }
        .sb-cab__volver:hover { background: var(--surface-2); color: var(--ink); }
        .sb-cab__volver:focus-visible { outline: 2px solid var(--mako); outline-offset: 2px; }
        /* El selector de capa del super admin: un segmentado chico, a la derecha de la cabecera. */
        .sb-capas { margin-left: auto; display: inline-flex; padding: 3px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border); flex: none; }
        .sb-capas button {
          border: none; background: transparent; color: var(--dim); font: inherit; font-size: 12.5px; font-weight: 550;
          padding: 6px 12px; border-radius: 999px; cursor: pointer; white-space: nowrap;
        }
        .sb-capas button[aria-selected="true"] { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.3); }
        .sb-capas button:focus-visible { outline: 2px solid var(--mako); outline-offset: 1px; }
        /* El volver es de la ventana angosta: ahí la lista de chats y el panel no entran juntos
           (app/admin/operaciones/centro.css, el mismo corte de 720 px). */
        @media (max-width: 720px) {
          .sb-cab { padding: 12px 12px 8px; }
          .sb-cab__volver { display: inline-flex; }
          .sb-cab__titulo { font-size: 19px; }
          .sb-cab__sub { font-size: 12.5px; }
        }
      `}</style>
      <header className="sb-cab">
        {volver && (
          <button type="button" className="sb-cab__volver" onClick={volver} aria-label="Volver a los chats">
            <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={18} /></span>
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 className="sb-cab__titulo">{TITULO_SECOND_BRAIN}</h1>
          <p className="sb-cab__sub">{enObra ? SUBTITULO_CONSTRUCCION : SUBTITULO_SECOND_BRAIN}</p>
        </div>
        {construccion && (
          <div className="sb-capas" role="tablist" aria-label="Qué grafo ver">
            <button type="button" role="tab" aria-selected={!enObra} onClick={() => elegirCapa('negocio')}>Negocio</button>
            <button type="button" role="tab" aria-selected={enObra} onClick={() => elegirCapa('construccion')}>Construcción</button>
          </div>
        )}
      </header>
      {/* `key`: cambiar de capa es otro grafo (su entrada, su foco y sus vistos), no el mismo con otros datos. La
          construcción no se edita ni se exporta: es la bitácora de MaKo, y cada nodo lleva a la suya. */}
      {enObra ? (
        <Grafo key="construccion" cerebro={construccion} onVerse={alVerse} filtro={filtroObra} onFiltro={setFiltroObra} />
      ) : (
        <Grafo
          key="negocio"
          cerebro={cerebro}
          onEditarArea={setEditando}
          onVerse={alVerse}
          filtro={filtro}
          onFiltro={setFiltro}
          accion={<BotonExportar cerebro={cerebro} filtroMapa={filtro} recorte={verse} />}
        />
      )}
      <AreasHub abierta={editando} onAbrir={setEditando} funnelPanel={funnelPanel} vistaInicial={vistaInicial} />
    </div>
  );
}
