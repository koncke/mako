'use client';

// =============================================================================
// EntradaOps — la criatura de MaKo mientras entra el Ops Center en la computadora (23/10/2026, feedback 5b)
// =============================================================================
// Martín: «al entrar al Ops Center en la computadora tarda, y el diseño se traba uno o dos segundos. Poné la animación de la
// criatura de MaKo que ya tenemos en el teléfono: aparece y se acomoda en su lugar mientras carga». Es la del teléfono
// (app/m/_ui/EntradaApp.tsx), con sus mismas piezas (`programarSalida`, `paginaLista`, `trayecto`), sin el splash del sistema:
//   · nace y flota sobre el Ops Center desde el primer pintado (la dibuja el server: en loading.tsx espera, en la página se va);
//   · se va cuando la página llegó entera Y la conversación se dibujó (o, sin conversación, a los 3 s), nunca antes de 1 s;
//   · al irse vuela a SU LUGAR, la criatura de la cabecera del chat (`.co-cab__muneco`), mientras el fondo se funde.
// Una vez por documento: volver al Ops Center navegando no la repite (ya cargó). Con movimiento reducido, quieta y se funde.
// En una sola columna (≤ 720 px) no va: ahí entra la del teléfono.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { MS_SALIDA, paginaLista, programarSalida, trayecto } from '@/app/m/_ui/EntradaApp';

/** Adónde vuela al irse: la criatura de la cabecera del chat abierto. */
export const DESTINO_ENTRADA_OPS = '.co-cab__muneco';
/** Ya llegó la página pero no hay conversación (la Ticketera, el grafo): como mucho esto, y se va. */
export const MS_TOPE_SIN_HILO = 3000;
/** La marca de que ya nació (la del loading.tsx): la de la página sigue flotando, sin volver a nacer. */
const ATTR_NACIO = 'data-eo-nacio';

/**
 * ¿Ya se puede ir? La página entera y la conversación dibujada; o, con la página entera, `MS_TOPE_SIN_HILO` después.
 * `desde`: cuándo se vio la página entera por primera vez (null todavía). Devuelve lo nuevo de `desde`.
 */
export function listaParaSalir(pagina: boolean, hilo: boolean, ahora: number, desde: number | null): { lista: boolean; desde: number | null } {
  if (!pagina) return { lista: false, desde: null };
  const d = desde ?? ahora;
  return { lista: hilo || ahora - d >= MS_TOPE_SIN_HILO, desde: d };
}

/** ¿La conversación (o su portada) ya se dibujó? */
const hiloDibujado = (doc: Document) => !!doc.querySelector('.co-panel .co-hilo__col > *, .co-panel .co-portada');

/** Cuánto lleva en pantalla: el reloj de la animación de la propia capa (arranca al pintarse). */
function enPantalla(capa: HTMLElement | null): number {
  try {
    const t = capa?.getAnimations()[0]?.currentTime;
    if (typeof t === 'number') return t;
  } catch { /* sin getAnimations */ }
  return performance.now();
}

/** La entrada se vio en este documento: navegando de vuelta al Ops Center no se repite. */
let yaEntro = false;

export function EntradaOps({ espera = false }: {
  /** La del loading.tsx: nace y espera (la de la página la reemplaza y es la que se va). */
  espera?: boolean;
}) {
  const [ver, setVer] = useState(() => !yaEntro);
  const capa = useRef<HTMLDivElement>(null);
  const vuelo = useRef<HTMLDivElement>(null);
  const cuerpo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ver) return;
    try { document.documentElement.setAttribute(ATTR_NACIO, ''); } catch { /* sin DOM */ }
    if (espera) return;
    let viva = true;
    let desde: number | null = null;
    const timers: number[] = [];
    let quieta = false;
    try { quieta = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* con movimiento */ }
    const terminar = () => { yaEntro = true; if (viva) setVer(false); };
    const salir = () => {
      if (!viva) return;
      const el = capa.current;
      const v = vuelo.current;
      if (!el || !v) { terminar(); return; }
      el.setAttribute('data-sale', '');
      const ms = quieta ? 150 : MS_SALIDA;
      const t = quieta ? null : trayecto(cuerpo.current?.getBoundingClientRect(), document.querySelector(DESTINO_ENTRADA_OPS)?.getBoundingClientRect(), v.getBoundingClientRect());
      if (typeof v.animate === 'function') {
        if (t) {
          v.style.transformOrigin = t.origen;
          v.animate(
            [{ transform: 'none', opacity: 1 }, { transform: t.fin, opacity: 1, offset: 0.85 }, { transform: t.fin, opacity: 0 }],
            { duration: ms, easing: 'cubic-bezier(.16,.84,.34,1)', fill: 'forwards' },
          );
        } else {
          v.animate([{ transform: 'none', opacity: 1 }, { transform: quieta ? 'none' : 'scale(.85)', opacity: 0 }], { duration: ms, easing: 'ease-out', fill: 'forwards' });
        }
      }
      timers.push(window.setTimeout(terminar, ms + 30));
    };
    programarSalida({
      lleva: () => enPantalla(capa.current),
      lista: () => { const r = listaParaSalir(paginaLista(document), hiloDibujado(document), performance.now(), desde); desde = r.desde; return r.lista; },
      esperar: (fn, ms) => { timers.push(window.setTimeout(() => { if (viva) fn(); }, ms)); },
      dosCuadros: (fn) => requestAnimationFrame(() => requestAnimationFrame(fn)),
    }, salir);
    return () => { viva = false; timers.forEach((x) => window.clearTimeout(x)); };
  }, [ver, espera]);

  if (!ver) return null;
  return (
    <div ref={capa} className="eo-capa" role="presentation" aria-hidden>
      <div ref={vuelo} className="eo-vuelo">
        <div ref={cuerpo} className="eo-cria">
          <Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo="despierto" size={76} />
        </div>
      </div>
    </div>
  );
}
