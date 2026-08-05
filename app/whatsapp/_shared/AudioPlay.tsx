'use client';

// =============================================================================
// AudioPlay — <audio controls> que SÍ sabe cuánto dura
// =============================================================================
// Los audios que graba el dueño se encodean en el navegador con lamejs
// (app/whatsapp/audio.ts) porque es el único formato que Meta entrega. Ese
// encoder escribe un MP3 CBR **sin header Xing/Info**, y sin ese header el
// navegador no puede saber la duración sin bajarse el archivo entero: Chrome
// reporta `duration` como Infinity y pinta «0:00» con la barra de progreso
// muerta. El archivo está perfecto —se escucha— pero se ve roto, no se puede
// arrastrar para adelante y parece que no se puede descargar.
//
// El arreglo es el truco conocido para blobs de MediaRecorder: pedirle un seek
// absurdo obliga al navegador a recorrer el stream hasta el final, ahí calcula
// la duración real, y se vuelve al principio. Después de eso los controles
// nativos funcionan como con cualquier MP3.
//
// Va como componente compartido y no como parche suelto porque el mismo audio
// se pinta en cinco lugares (el paso de los audios, el control de cada mensaje,
// las burbujas del hilo, las dos bandejas) y el bug se veía en todos.

import { useEffect, useRef, type CSSProperties } from 'react';

export function AudioPlay({ src, style }: { src: string; style?: CSSProperties }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let hecho = false;

    const alVolver = () => {
      el.removeEventListener('timeupdate', alVolver);
      // `currentTime = 0` sobre un elemento recién escaneado puede tirar en
      // Safari si el buffer todavía no está listo; no es fatal.
      try { el.currentTime = 0; } catch { /* queda donde está */ }
    };

    const forzarDuracion = () => {
      // Solo cuando de verdad falta: un MP3 con header correcto no se toca.
      if (hecho || (Number.isFinite(el.duration) && el.duration > 0)) return;
      hecho = true;
      el.addEventListener('timeupdate', alVolver);
      try { el.currentTime = 1e101; } catch { el.removeEventListener('timeupdate', alVolver); }
    };

    el.addEventListener('loadedmetadata', forzarDuracion);
    if (el.readyState >= 1) forzarDuracion();
    return () => {
      el.removeEventListener('loadedmetadata', forzarDuracion);
      el.removeEventListener('timeupdate', alVolver);
    };
  }, [src]);

  return <audio ref={ref} controls preload="metadata" src={src} style={style} />;
}
