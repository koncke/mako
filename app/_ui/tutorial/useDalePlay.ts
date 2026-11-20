'use client';
// =============================================================================
// «{TÍTULO}: DALE PLAY» SOBRE UN VIDEO QUIETO (20/11/2026, V5; las reglas en ./entrada.ts)
// =============================================================================
// La maqueta (cuerpo.html, la marca `invita`; capturas r4-invita-1440/390): mientras el video que llegó está quieto, todo oscuro menos
// él y una tarjeta con «Tu recorrido por MaKo: dale play» y la X. Se usa con el motor (./MotorTutorial.tsx: `senalarDondeTocar`
// con `invita`), así que tiene su barrido, sus tapas y su lugar de la tarjeta (al costado; abajo en el teléfono).
//   · Sólo con el video A LA VISTA (un chat escondido con `display: none` o el video fuera de la pantalla no se marca: si no, la
//     marca ocupaba el motor sin verse) y con el motor libre (no pisa un tutorial ni otra marca: espera).
//   · Se suelta sola cuando el video deja de estar quieto o sale de la vista.
//   · Tocar el video o cerrarla con la X la da por vista: no vuelve en esta página.
// El video del chat lo pide con `<VideoDelMomento dalePlay />`; otro botón de play, con este gancho sobre su elemento.
// =============================================================================
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { senalarDondeTocar, soltarSenal, useSenal } from './store';
import { PARTE_A_LA_VISTA, cerrarDalePlay, dalePlayCerrado, sueltaDalePlay, tituloDalePlay, tocaDalePlay } from './entrada';

/** `clave`: la del video (lo cerrado se recuerda por ella). `activo`: el video está QUIETO (nunca reproducido). */
export function useDalePlay(ref: RefObject<HTMLElement | null>, o: { clave: string; titulo: string; activo: boolean }): void {
  const { clave, titulo, activo } = o;
  const senal = useSenal();
  const marca = useId();
  const [aLaVista, setALaVista] = useState(false);
  const [cerrado, setCerrado] = useState(() => dalePlayCerrado(clave));
  const mia = useRef<number | null>(null);

  // A la vista: más de la mitad del video adentro de la pantalla (y de lo que lo recorta: el hilo con su scroll).
  useEffect(() => {
    const el = ref.current;
    if (!activo || !el || typeof IntersectionObserver === 'undefined') return;
    el.setAttribute('data-dale-play', marca);
    const io = new IntersectionObserver(([e]) => setALaVista(!!e && e.isIntersecting && e.intersectionRatio >= PARTE_A_LA_VISTA), { threshold: [0, PARTE_A_LA_VISTA, 1] });
    io.observe(el);
    return () => { io.disconnect(); setALaVista(false); };
  }, [ref, activo, marca]);

  useEffect(() => {
    // La nuestra ya no está: la persona tocó el video o la X (sus avisos ya corrieron), o el motor tomó otra cosa.
    if (mia.current != null && senal?.id !== mia.current) mia.current = null;
    if (mia.current != null) {
      if (sueltaDalePlay({ activo, aLaVista })) { soltarSenal(mia.current); mia.current = null; }
      return;
    }
    if (!tocaDalePlay({ activo, aLaVista, motorLibre: senal == null, cerrado })) return;
    const visto = () => { mia.current = null; cerrarDalePlay(clave); setCerrado(true); };
    mia.current = senalarDondeTocar(
      { sel: `[data-dale-play="${marca}"]`, titulo: tituloDalePlay(titulo), texto: '', haz: '', lado: 'derecha' },
      visto,
      { invita: true, alOmitir: visto },
    );
  }, [senal, activo, aLaVista, cerrado, clave, titulo, marca]);

  // Al irse (otro chat, otra pestaña), la marca se va con el video.
  useEffect(() => () => { if (mia.current != null) soltarSenal(mia.current); }, []);
}
