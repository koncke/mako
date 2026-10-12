'use client';

// =============================================================================
// ReproductorM — el video 9:16 del teléfono: se toca para reproducir y se toca para pausar
// =============================================================================
// La anatomía del prototipo (docs/prototipos/mako-mobile-v2.html, `.player`): el rótulo arriba a
// la izquierda («Toma 6», «Anuncio entero»), el play redondo al centro mientras está en pausa y
// la línea de avance abajo. Sin los controles del sistema: en un 9:16 de 212 px se comen el cuadro.
//
// ⚠️ `#t=0.1` SIN PÓSTER: iOS no pinta el primer cuadro de un <video> que no se reprodujo, y sin
// él el cuadro queda negro. El fragmento no viaja al server (es del navegador).
// ⚠️ `playsInline`: sin él, el iPhone abre el video a pantalla completa al primer toque.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/app/_components/icons';

export function ReproductorM({ src, poster, marca, clase }: {
  src: string;
  poster?: string | null;
  /** El rótulo de arriba a la izquierda. */
  marca?: string;
  /** Una clase más para el tamaño (la del sheet es más chica). */
  clase?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [sonando, setSonando] = useState(false);
  const [avance, setAvance] = useState(0);
  const [falla, setFalla] = useState(false);

  // Otro video (otra toma, el anuncio entero): vuelve a cero y en pausa.
  useEffect(() => { setSonando(false); setAvance(0); setFalla(false); }, [src]);

  const alternar = () => {
    const v = ref.current;
    if (!v || falla) return;
    if (v.paused || v.ended) {
      if (v.ended) v.currentTime = 0;
      void v.play().catch(() => setSonando(false));
    } else {
      v.pause();
    }
  };

  return (
    <div className={`m-video-player${clase ? ` ${clase}` : ''}`}>
      <video
        ref={ref}
        key={src}
        src={poster ? src : `${src}#t=0.1`}
        poster={poster ?? undefined}
        playsInline
        preload="metadata"
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
        onEnded={() => setSonando(false)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setAvance(v.duration > 0 ? Math.min(1, v.currentTime / v.duration) : 0);
        }}
        onError={() => setFalla(true)}
      />
      {marca && <span className="m-video-player__marca">{marca}</span>}
      <button
        type="button"
        className="m-video-player__toque"
        onClick={alternar}
        aria-label={sonando ? 'Pausar' : 'Reproducir'}
        disabled={falla}
      >
        {falla
          ? <span className="m-video-player__falla">Video no disponible</span>
          : !sonando && <span className="m-video-player__play"><Icon name="play" size={26} /></span>}
      </button>
      <span className="m-video-player__prog" aria-hidden><i style={{ width: `${Math.round(avance * 1000) / 10}%` }} /></span>
    </div>
  );
}
