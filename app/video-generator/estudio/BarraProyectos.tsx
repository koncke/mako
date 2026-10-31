'use client';

// =============================================================================
// El estudio de video — la barra de PROYECTOS (27/10/2026, copiada de la lista de proyectos de Arcads)
// =============================================================================
// «Nuevo anuncio» arriba (el «New Project» de Arcads), los anuncios en curso con en qué anda cada uno (./proyectos.ts →
// filaDeProyecto: la misma regla que abre el centro) y, abajo, los terminados. Un clic abre el proyecto en el centro SIN
// cambiar de ruta. Es una lista de contenido (crece con los anuncios): scrollea adentro, y «Nuevo anuncio» queda fijo arriba.
// ⚠️ Un <section> y no un <aside>: ver EstudioVideo.tsx.
// =============================================================================

import { Icon } from '@/app/_components/icons';
import type { PlanGuardado } from '../video-datos';
import type { AnuncioHecho } from '../anuncios-datos';
import { filaDeProyecto } from './proyectos';

export function BarraProyectos({ historial, anuncios, abierto, onNuevo, onAbrir, onVerAnuncio }: {
  historial: PlanGuardado[];
  anuncios: AnuncioHecho[];
  /** El id del proyecto abierto (null = el anuncio nuevo). */
  abierto: string | null;
  onNuevo: () => void;
  onAbrir: (id: string) => void;
  onVerAnuncio: (a: AnuncioHecho) => void;
}) {
  const filas = historial.map(filaDeProyecto);
  return (
    <section className="vgs-barra" aria-label="Tus anuncios">
      <div className="vgs-barra__cab">
        <span className="vgs-barra__tab">Video Generator</span>
        <button type="button" className="vgs-nuevo" aria-pressed={abierto == null} onClick={onNuevo}>
          <Icon name="plus" size={15} /> Nuevo anuncio
        </button>
      </div>
      <div className="vgs-barra__lista mk-scroll-y">
        <div className="vgs-barra__grupo">En curso</div>
        {filas.length === 0 ? (
          <p className="vgs-barra__vacio">Tus anuncios aparecen aquí.</p>
        ) : (
          <ul className="vgs-lista">
            {filas.map((f) => (
              <li key={f.id}>
                <button type="button" className="vgs-proyecto" aria-current={f.id === abierto ? 'page' : undefined} onClick={() => onAbrir(f.id)}>
                  <span className="vgs-proyecto__titulo">{f.titulo}</span>
                  <span className="vgs-proyecto__detalle" data-tono={f.tono}>{f.detalle}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {anuncios.length > 0 && (
          <>
            <div className="vgs-barra__grupo">Terminados</div>
            <ul className="vgs-lista">
              {anuncios.map((a) => (
                <li key={a.id}>
                  <button type="button" className="vgs-proyecto vgs-proyecto--hecho" onClick={() => onVerAnuncio(a)}>
                    {a.poster ? <img src={a.poster} alt="" className="vgs-proyecto__mini" /> : <span className="vgs-proyecto__mini" />}
                    <span className="vgs-proyecto__texto">
                      <span className="vgs-proyecto__titulo">{a.titulo}</span>
                      <span className="vgs-proyecto__detalle">{Math.floor(a.duracionSeg / 60)}:{String(Math.round(a.duracionSeg % 60)).padStart(2, '0')}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
