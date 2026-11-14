'use client';

// =============================================================================
// Lo que se toca en la portada del sitio: el carrusel de tableros y el sonido de AI Avatar (13/11/2026)
// =============================================================================
// Antes eran scripts sueltos en la página, con la idea de que el sitio no se hidrataba. EN PRODUCCIÓN REACT SÍ TOMA LA PÁGINA (el
// error #418 de TemaSitio lo dejó a la vista): un script que guarda nodos queda colgado si React vuelve a dibujar, y uno que toca el
// texto antes de que React termine provoca justamente un #418. Por eso son componentes con su `onClick`, como cualquier botón de la
// app (tests/ningun-boton-muerto.test.ts, sin excepciones). En el visor estático no hay React: ahí la pista se desliza igual (CSS).
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';

type Tablero = { id: string; nombre: string };

/**
 * Los tableros en un carrusel: el recuadro es la pista (`scroll-snap`: se desliza con el dedo y el trackpad), las flechas a los costados
 * y el nombre y los puntos debajo, todo por fuera (Martín, 13/11/2026). Con el mouse también se arrastra. Pasa solo cada 6 s y se frena
 * 10 s si la persona lo mueve. Cada tablero, al quedar a la vista, corre SU entrada (el video de su componente).
 */
export function TablerosCarrusel({ tableros }: { tableros: readonly Tablero[] }) {
  const n = tableros.length;
  const pista = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [i, setI] = useState(0);
  const [visto, setVisto] = useState(false);
  const frena = useRef(0);
  const arrastre = useRef<{ x: number; s: number; movio: boolean } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  const ir = useCallback((k: number, mano: boolean) => {
    const j = ((k % n) + n) % n;
    if (mano) frena.current = Date.now() + 10_000;
    const el = pista.current;
    if (el) el.scrollTo({ left: j * el.clientWidth, behavior: 'smooth' });
    setI(j);
  }, [n]);

  // Arranca cuando el carrusel se ve.
  useEffect(() => {
    const el = caja.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) setVisto(true); }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // El tablero a la vista corre su entrada; los demás, quietos. Y el siguiente se va cargando.
  useEffect(() => {
    if (!visto) return;
    videos.current.forEach((v, k) => {
      if (!v) return;
      if (k === i) {
        if (!v.getAttribute('src')) v.src = v.dataset.src ?? '';
        try { v.currentTime = 0; } catch { /* sin cargar todavía */ }
        void v.play().catch(() => {});
      } else v.pause();
    });
    // TODOS se cargan apenas el carrusel se ve, no sólo el siguiente (Martín, 14/11/2026: «cuando se scrollea uno pasa demasiado
    // tiempo con la pantalla en blanco antes de la animación»): con el arrastre o los puntos se salta a cualquiera, y ése tenía que
    // bajar recién ahí. Son ~13 × 130 KB.
    videos.current.forEach((v) => { if (v && !v.getAttribute('src')) { v.preload = 'auto'; v.src = v.dataset.src ?? ''; } });
  }, [i, visto, n]);

  // Pasa solo.
  useEffect(() => {
    if (!visto) return;
    // 4,8 s: los 3,8 de la entrada del tablero y un segundo quieto (el audio de feedback del 14/11: «que aparezca la animación de los dashboards»).
    const t = setInterval(() => { if (Date.now() > frena.current) ir(i + 1, false); }, 4800);
    return () => clearInterval(t);
  }, [i, visto, ir]);

  // Al terminar de deslizar, el tablero que quedó es el activo.
  const fin = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alDeslizar = () => {
    const el = pista.current;
    if (!el) return;
    if (fin.current) clearTimeout(fin.current);
    fin.current = setTimeout(() => {
      const k = Math.round(el.scrollLeft / el.clientWidth);
      if (k !== i) { frena.current = Date.now() + 10_000; setI(k); }
    }, 120);
  };

  return (
    <div className="s-tab" ref={caja}>
      <button type="button" className="s-tab-fl" onClick={() => ir(i - 1, true)} aria-label="El tablero anterior">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <div ref={pista} className="s-tab-pista" tabIndex={0} aria-label="Los tableros de MaKo" data-arrastra={arrastrando ? '' : undefined}
        onScroll={alDeslizar}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse' || !pista.current) return;
          arrastre.current = { x: e.clientX, s: pista.current.scrollLeft, movio: false };
          pista.current.setPointerCapture(e.pointerId);
          setArrastrando(true);
        }}
        onPointerMove={(e) => {
          const a = arrastre.current;
          if (!a || !pista.current) return;
          const d = e.clientX - a.x;
          if (Math.abs(d) > 4) a.movio = true;
          pista.current.scrollLeft = a.s - d;
        }}
        onPointerUp={() => {
          const a = arrastre.current;
          arrastre.current = null;
          setArrastrando(false);
          if (!a || !a.movio || !pista.current) return;
          const d = pista.current.scrollLeft - a.s;
          ir(Math.round(a.s / pista.current.clientWidth) + (d > 60 ? 1 : d < -60 ? -1 : 0), true);
        }}>
        {tableros.map((t, k) => (
          // El póster es el PRIMER cuadro de su entrada, no el último (Martín, 14/11/2026: «cuando scrollea el carrusel para el costado…
          // aparece, sin animación, por medio segundo, y después recién comienza»): con el último, se veía el tablero armado mientras
          // se deslizaba y al arrancar volvía a vacío. Así, el video empalma con lo que ya se ve.
          <figure key={t.id} className="s-tab-uno" data-activo={k === i ? 'si' : undefined}>
            <video ref={(v) => { videos.current[k] = v; }} data-src={`/vsl-assets/sitio/tableros/${t.id}.webm`} poster={`/vsl-assets/sitio/tableros/${t.id}.jpg`}
              muted playsInline preload="none" aria-label={`El tablero «${t.nombre}» de MaKo`} />
          </figure>
        ))}
      </div>
      <button type="button" className="s-tab-fl" onClick={() => ir(i + 1, true)} aria-label="El tablero siguiente">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      <p className="s-tab-nombre" aria-live="polite">{tableros[i]?.nombre}</p>
      <div className="s-tab-puntos">
        {tableros.map((t, k) => (
          <button key={t.id} type="button" onClick={() => ir(k, true)} aria-label={t.nombre} aria-current={k === i ? 'true' : undefined} />
        ))}
      </div>
    </div>
  );
}

type VideoAvatar = { id: string; nombre: string };

/**
 * AI Avatar: dos anuncios de verdad, cada uno con la foto de la que salió. Son largos (completos): arrancan recién cuando se ven y se
 * pausan al salir. Mudos de entrada (el navegador no deja otra cosa); el botón de cada uno lo hace sonar y calla al otro.
 */
export function AvatarVideos({ videos }: { videos: readonly VideoAvatar[] }) {
  const refs = useRef<(HTMLVideoElement | null)[]>([]);
  const [sonando, setSonando] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting) void v.play().catch(() => {}); else v.pause();
      }
    }, { threshold: 0.4 });
    for (const v of refs.current) if (v) io.observe(v);
    return () => io.disconnect();
  }, []);

  const sonar = (k: number, id: string) => {
    const v = refs.current[k];
    if (!v) return;
    const prender = sonando !== id;
    refs.current.forEach((o) => { if (o) o.muted = true; });
    if (prender) {
      v.muted = false;
      try { v.currentTime = 0; } catch { /* sin cargar todavía */ }
      void v.play().catch(() => {});
    }
    setSonando(prender ? id : null);
  };

  return (
    <div className="s-av">
      {videos.map((v, k) => (
        <figure key={v.id} className="s-av-par">
          <span className="s-av-foto"><img src={`/vsl-assets/sitio/avatar/${v.id}-foto.jpg`} alt={`La foto de ${v.nombre}`} width={240} height={300} /><small>Foto original</small></span>
          <span className="s-av-tel">
            <video ref={(el) => { refs.current[k] = el; }} src={`/vsl-assets/sitio/avatar/${v.id}.webm`} poster={`/vsl-assets/sitio/avatar/${v.id}.jpg`}
              muted loop playsInline preload="none" aria-label={`El anuncio con IA de ${v.nombre}`} />
            <button type="button" className="s-av-son" onClick={() => sonar(k, v.id)} aria-pressed={sonando === v.id} aria-label={`Escuchar el anuncio de ${v.nombre}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path className="s-av-on" d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /><path className="s-av-off" d="m23 9-6 6M17 9l6 6" /></svg>
            </button>
          </span>
          <figcaption>{v.nombre}</figcaption>
        </figure>
      ))}
    </div>
  );
}
