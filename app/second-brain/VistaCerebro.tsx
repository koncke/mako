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
// UN SOLO GRAFO PARA EL SUPER ADMIN (17/10/2026, Martín: «no pongas 2 grafos, todo 1 solo... para eso existen los filtros
// para ver desarrollo o ventas o marketing»). Antes se dibujaban dos `<Grafo>` y un selector «Negocio / Construcción»;
// ahora `unirCerebros` (lib/cerebro-union.ts) junta el negocio y la construcción de MaKo en un `Cerebro`, y las capas son
// un atajo del filtro de carpetas (FiltroMapa.tsx y la barra lateral). El de un cliente no cambia: no trae construcción.
//
// EL TELÉFONO (`movil`): el MISMO grafo en una capa a pantalla entera (app/m/second-brain/SecondBrainM.tsx). Sin cabecera
// (en un teléfono de costado son 340 px de alto), sin editor de áreas (la hoja de áreas del teléfono lo hace: `alEditarArea`)
// y sin «Exportar» (el ZIP es de la computadora).
//
// EL FILTRO VIVE ACÁ y no adentro del grafo porque «Exportar» tiene que bajar el MISMO recorte que se está mirando.
// =============================================================================

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { AREAS, CAPA_CONSTRUCCION, type AreaId, type Cerebro } from '@/lib/cerebro-modelo';
import { vistaValida } from '@/lib/secciones-negocio';
import { filtroDeCapa, filtroVacio, type EstadoFiltro } from '@/lib/cerebro-filtro';
import { filtroDelNegocio, unirCerebros } from '@/lib/cerebro-union';
import { Icon } from '@/app/_components/icons';
import { Grafo } from './Grafo';
import { AreasHub } from './AreasHub';
import { BotonExportar } from './BotonExportar';
import { useVolverDelGrafo } from './volver';

/** Cada cuánto el grafo se vuelve a pedir mientras la pestaña está a la vista (el grafo VIVO). */
const MS_GRAFO_VIVO = 180_000;

export const TITULO_SECOND_BRAIN = 'Second Brain';
export const SUBTITULO_SECOND_BRAIN = 'Todo lo que MaKo sabe de tu negocio.';
/** Lo que se lee del mapa único del super admin, que además trae la construcción de MaKo. */
export const SUBTITULO_CONSTRUCCION = 'Cómo se está construyendo MaKo.';
export const SUBTITULO_UNIDO = 'Tu negocio y cómo se construye MaKo.';

export function VistaCerebro({ cerebro: delServidor, construccion = null, funnelPanel, movil = false, alCerrar, alEditarArea }: {
  cerebro: Cerebro;
  /** La construcción de MaKo: sólo para quien opera (el servidor la manda null a todos los demás, pagina.tsx). */
  construccion?: Cerebro<string> | null;
  funnelPanel: ReactNode;
  /** El teléfono: la capa a pantalla entera (sin cabecera ni editor ni «Exportar»). */
  movil?: boolean;
  /** Sólo en el teléfono: la flecha que vuelve a la lista. */
  alCerrar?: () => void;
  /** Sólo en el teléfono: «Editar» de la barra lateral abre la hoja del área en la lista, no el editor de escritorio. */
  alEditarArea?: (area: AreaId) => void;
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

  // UN SOLO GRAFO: el negocio (vivo) y, para quien opera, la construcción de MaKo (que no cambia entre deploys). Se
  // vuelve a juntar con cada vuelta del grafo vivo; las dos nubes asentadas no se recalculan (lib/cerebro-union.ts).
  const unido = useMemo<Cerebro<string>>(() => (construccion ? unirCerebros(cerebro, construccion) : cerebro), [cerebro, construccion]);
  const tax = unido.taxonomia;

  // `?area=oferta` abre el editor de esa sección de entrada: otras pantallas mandan acá a hacer algo concreto (el
  // selector de oferta del CRM manda a crear una). Se valida contra AREAS: un valor cualquiera no abre nada.
  const params = useSearchParams();
  const areaInicial = AREAS.find((a) => a.id === params?.get('area'))?.id ?? null;
  // `&vista=persona` abre esa sub-pestaña del área (lib/secciones-negocio.ts → rutaSeccion).
  const vistaInicial = areaInicial ? vistaValida(areaInicial, params?.get('vista')) : null;
  const [editando, setEditando] = useState<AreaId | null>(movil ? null : areaInicial);
  const volver = useVolverDelGrafo();

  // `?capa=construccion` (el link de /admin/dev y de las bitácoras) abre el mapa YA filtrado a esa capa.
  const [filtro, setFiltro] = useState<EstadoFiltro>(() => (
    construccion && tax && params?.get('capa') === CAPA_CONSTRUCCION ? filtroDeCapa(filtroVacio(), tax, CAPA_CONSTRUCCION) : filtroVacio()
  ));
  /** Lo que el grafo muestra de verdad (filtro + búsquedas): el rótulo de «Exportar» lo usa. */
  const [verse, setVerse] = useState<{ ids: string[]; recortado: boolean }>({ ids: [], recortado: false });
  const alVerse = useCallback((info: { ids: string[]; recortado: boolean }) => setVerse(info), []);

  // «Exportar» baja el ZIP del NEGOCIO: con el mapa recortado a la construcción no hay nada que bajar, y un filtro
  // vacío bajaría todo el negocio (lo contrario de lo que se mira).
  const filtroExportable = useMemo(() => (tax ? filtroDelNegocio(filtro, tax) : filtro), [filtro, tax]);

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
      {!movil && (
        <header className="sb-cab">
          {volver && (
            <button type="button" className="sb-cab__volver" onClick={volver} aria-label="Volver a los chats">
              <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={18} /></span>
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 className="sb-cab__titulo">{TITULO_SECOND_BRAIN}</h1>
            <p className="sb-cab__sub">{construccion ? SUBTITULO_UNIDO : SUBTITULO_SECOND_BRAIN}</p>
          </div>
        </header>
      )}
      {/* UN solo `<Grafo>`: tests/second-brain-grafo-movil.test.ts falla si vuelve a haber dos. */}
      <Grafo
        cerebro={unido}
        onEditarArea={movil ? alEditarArea : setEditando}
        onVerse={alVerse}
        filtro={filtro}
        onFiltro={setFiltro}
        movil={movil}
        alCerrar={alCerrar}
        accion={!movil && filtroExportable ? <BotonExportar cerebro={cerebro} filtroMapa={filtroExportable} recorte={verse} /> : undefined}
      />
      {!movil && <AreasHub abierta={editando} onAbrir={setEditando} funnelPanel={funnelPanel} vistaInicial={vistaInicial} />}
    </div>
  );
}
