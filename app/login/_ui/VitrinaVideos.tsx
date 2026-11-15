'use client';

// =============================================================================
// El panel derecho del login: las animaciones de la portada, una detrás de otra
// =============================================================================
// Martín, 15/11/2026, mirando el rediseño: «en lugar de poner el mejor software para vender High Ticket, ahí yo pondría
// los videos que hicimos de las animaciones, o sea, tipo en bucle de todas las cosas que hace MaKo».
//
// Los clips son LOS DE LA PORTADA (`TARJETAS_PORTADA`, app/vsl/_sitio/datos.ts), no una copia: los elige TarjetaLogin en el
// servidor y llegan acá por props. Si mañana la portada cambia una grabación, el login la muestra sin tocar nada.
//
// ⚠️ EN EL TELÉFONO NO SE BAJA NI UN VIDEO. El panel está `display: none` por debajo de 1025 px, pero un <video> con
// `src` se descarga igual aunque no se vea: son 11 clips de 0,25 a 2,7 MB en el 4G de quien sólo quiere entrar. Por eso
// el `src` se pone recién cuando la pantalla es de computadora, y se saca si se achica.
// ⚠️ Y CON «REDUCIR MOVIMIENTO» NO SE REPRODUCE: queda el cuadro fijo del primer clip con su título.
// =============================================================================

import { useEffect, useRef, useState } from 'react';

/** `hasta`: el segundo en que termina el contenido, antes de que la grabación vuelva a su arranque (ver TarjetaLogin). */
export type ClipVitrina = { video: string; poster: string; titulo: string; hasta: number | null };

const ESCRITORIO = '(min-width: 1025px)';
const QUIETO = '(prefers-reduced-motion: reduce)';

export function VitrinaVideos({ clips }: { clips: readonly ClipVitrina[] }) {
  const [i, setI] = useState(0);
  const [modo, setModo] = useState<'nada' | 'quieto' | 'video'>('nada');
  const avanzoRef = useRef<number | null>(null);

  useEffect(() => {
    const esc = window.matchMedia(ESCRITORIO);
    const quieto = window.matchMedia(QUIETO);
    const medir = () => setModo(!esc.matches ? 'nada' : quieto.matches ? 'quieto' : 'video');
    medir();
    esc.addEventListener('change', medir);
    quieto.addEventListener('change', medir);
    return () => { esc.removeEventListener('change', medir); quieto.removeEventListener('change', medir); };
  }, []);

  if (clips.length === 0 || modo === 'nada') return null;
  const clip = clips[i % clips.length];
  // `timeupdate` llega varias veces por segundo: sin esta traba, dos avisos seguidos pasado `hasta` saltean un clip.
  const avanzo = avanzoRef;
  const siguiente = () => {
    if (avanzo.current === i) return;
    avanzo.current = i;
    setI((n) => (n + 1) % clips.length);
  };

  return (
    <figure className="lg-vitrina__pieza">
      <div className="lg-vitrina__pantalla">
        {modo === 'video' ? (
          // `key`: un elemento nuevo por clip, así arranca desde el cuadro 0 y con su propio póster mientras carga.
          // Pasa al siguiente en `hasta`, no en `ended`: el final de cada grabación es la vuelta a su arranque (ver
          // TarjetaLogin, «HASTA DÓNDE»). `ended` queda de red para un clip sin medir.
          <video key={clip.video} src={clip.video} poster={clip.poster} muted playsInline autoPlay preload="auto"
            onTimeUpdate={(e) => { if (clip.hasta != null && e.currentTarget.currentTime >= clip.hasta) siguiente(); }}
            onEnded={siguiente} onError={siguiente} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={clip.poster} alt="" />
        )}
      </div>
      <figcaption key={clip.titulo} className="lg-vitrina__titulo">{clip.titulo}</figcaption>
    </figure>
  );
}
