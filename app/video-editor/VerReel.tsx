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

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@/app/_ui/Modal';
// Directo, no desde el índice de app/_ui (ver el ⚠️ de CargandoMako.tsx).
import { CargandoMako } from '@/app/_ui/CargandoMako';
import o from './outliers.module.css';

/** Lo más que se espera, después del `load` del iframe, el aviso del reproductor de que ya dibujó el reel. */
const TOPE_TRAS_CARGAR_MS = 8_000;

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
  // El reproductor de la red tarda unos segundos en llegar y mientras tanto la caja quedaba en blanco, sin decir nada
  // (prueba en producción del 12/11/2026): el loader de la app la tapa hasta que el reproductor se DIBUJA.
  const [cargado, setCargado] = useState(false);
  // 13/11/2026, mirado en producción: el `load` del iframe llega con el documento del reproductor VACÍO, y el reel se dibuja
  // ~5 s después; el loader se iba antes y la caja seguía en blanco. El reproductor de Instagram avisa al dibujarse con un
  // `postMessage` a la página («MEASURE»): ése apaga el loader. Si no llega (otra red, otra versión), un tope después del `load`.
  const marco = useRef<HTMLIFrameElement>(null);
  const [documento, setDocumento] = useState(false);
  useEffect(() => {
    if (!abierto || cargado) return;
    const alMensaje = (e: MessageEvent) => {
      if (marco.current && e.source === marco.current.contentWindow) setCargado(true);
    };
    window.addEventListener('message', alMensaje);
    const tope = documento ? setTimeout(() => setCargado(true), TOPE_TRAS_CARGAR_MS) : null;
    return () => {
      window.removeEventListener('message', alMensaje);
      if (tope) clearTimeout(tope);
    };
  }, [abierto, cargado, documento]);
  if (!embed) {
    return <a href={url} target="_blank" rel="noopener noreferrer" className={clase} aria-label={etiqueta}>{children}</a>;
  }
  return (
    <>
      <button
        type="button"
        className={`${clase} ${o.verBoton}`}
        aria-label={etiqueta}
        onClick={() => {
          setCargado(false);
          setDocumento(false);
          setAbierto(true);
        }}
      >
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
                ref={marco}
                src={embed}
                title={titulo}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => setDocumento(true)}
              />
              {!cargado && <CargandoMako cubre que="el reel" size={56} />}
            </div>
            <div className={o.verInfo}>{detalle}</div>
          </div>
        </Modal>,
        document.body,
      )}
    </>
  );
}
