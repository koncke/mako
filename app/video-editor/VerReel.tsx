'use client';

// =============================================================================
// Ver un reel AHÍ MISMO, sin salir de MaKo (11/11/2026)
// =============================================================================
// Martín, con la captura de la portada: «los videos ni siquiera se pueden reproducir ahí mismo, que sí deberían: siempre te
// redirige». Tocar la miniatura abre una caja con el reproductor OFICIAL de su red (el embed de Instagram, el de YouTube sin
// cookies: lib/video-outliers.ts → `embedDeReel`) y, al lado, lo que enseña ese reel. Nunca una copia nuestra del video: el
// reproductor es el de la red, con su crédito. Probado el 11/11/2026: el embed de Instagram reproduce adentro, sin abrir otra
// pestaña. Sin reproductor para esa red, la tarjeta abre el original como antes.
// =============================================================================

import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@/app/_ui/Modal';
import o from './outliers.module.css';

export function VerReel({
  embed,
  url,
  titulo,
  red,
  clase,
  etiqueta,
  detalle,
  pie,
  children,
}: {
  /** El reproductor oficial; null = la red no tiene uno y se abre el original. */
  embed: string | null;
  url: string;
  titulo: string;
  /** «Instagram», «YouTube»: el nombre de la red, para «Abrir en …». */
  red: string;
  clase: string;
  etiqueta: string;
  /** Lo que va al lado del video: quién, el múltiplo, lo que enseña, la receta. */
  detalle: ReactNode;
  /** Los botones de la caja (antes de «Abrir en …»). */
  pie?: ReactNode;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  if (!embed) {
    return <a href={url} target="_blank" rel="noopener noreferrer" className={clase} aria-label={etiqueta}>{children}</a>;
  }
  return (
    <>
      <button type="button" className={`${clase} ${o.verBoton}`} aria-label={etiqueta} onClick={() => setAbierto(true)}>
        {children}
      </button>
      {/* POR PORTAL al body (11/11/2026, mirado a 1440): la tarjeta tiene una animación de entrada con `transform` (`entra`,
          `both`), y un `position: fixed` adentro de ella queda encerrado en la tarjeta: la caja salía de 200 px sobre su columna. */}
      {abierto && createPortal(
        <Modal
          titulo={titulo}
          ancho={900}
          alto="min(92vh, 860px)"
          completaEnCelular
          onCerrar={() => setAbierto(false)}
          pie={(
            <div className={o.verPie}>
              {pie}
              <a href={url} target="_blank" rel="noopener noreferrer" className={o.verAbrir}>Abrir en {red}</a>
            </div>
          )}
        >
          <div className={o.ver}>
            <div className={o.verVideo}>
              <iframe
                src={embed}
                title={titulo}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <div className={o.verInfo}>{detalle}</div>
          </div>
        </Modal>,
        document.body,
      )}
    </>
  );
}
