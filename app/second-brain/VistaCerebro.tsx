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

import { useCallback, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { AREAS, type AreaId, type Cerebro } from '@/lib/cerebro-modelo';
import { vistaValida } from '@/lib/secciones-negocio';
import { filtroVacio, type EstadoFiltro } from '@/lib/cerebro-filtro';
import { Icon } from '@/app/_components/icons';
import { Grafo } from './Grafo';
import { AreasHub } from './AreasHub';
import { BotonExportar } from './BotonExportar';
import { useVolverDelGrafo } from './volver';

export const TITULO_SECOND_BRAIN = 'Second Brain';
export const SUBTITULO_SECOND_BRAIN = 'Todo lo que MaKo sabe de tu negocio.';

export function VistaCerebro({ cerebro, funnelPanel }: { cerebro: Cerebro; funnelPanel: ReactNode }) {
  // `?area=oferta` abre el editor de esa sección de entrada: otras pantallas mandan acá a hacer algo concreto (el
  // selector de oferta del CRM manda a crear una). Se valida contra AREAS: un valor cualquiera no abre nada.
  const params = useSearchParams();
  const areaInicial = AREAS.find((a) => a.id === params?.get('area'))?.id ?? null;
  // `&vista=persona` abre esa sub-pestaña del área (lib/secciones-negocio.ts → rutaSeccion).
  const vistaInicial = areaInicial ? vistaValida(areaInicial, params?.get('vista')) : null;
  const [editando, setEditando] = useState<AreaId | null>(areaInicial);
  const volver = useVolverDelGrafo();

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
          <p className="sb-cab__sub">{SUBTITULO_SECOND_BRAIN}</p>
        </div>
      </header>
      <Grafo
        cerebro={cerebro}
        onEditarArea={setEditando}
        onVerse={alVerse}
        filtro={filtro}
        onFiltro={setFiltro}
        accion={<BotonExportar cerebro={cerebro} filtroMapa={filtro} recorte={verse} />}
      />
      <AreasHub abierta={editando} onAbrir={setEditando} funnelPanel={funnelPanel} vistaInicial={vistaInicial} />
    </div>
  );
}
