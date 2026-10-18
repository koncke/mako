'use client';

// =============================================================================
// EntradaMako — la entrada de MaKo al onboarding: aparece, saluda y espera que la toques
// =============================================================================
// Martín (17/10/2026, Ops Center): «En el onboarding elimina la animación del grafo... haz una buena entrada de la
// criatura de MaKo tipo motion graphics, y que al clickearla recién pase al siguiente mensaje, que la animación no sea
// automática». Reemplaza a IntroMako.tsx (el grafo de los tres tiempos, del 16/10).
//
// Tres tiempos, todos en CSS:
//   1. La entrada: MaKo cae desde abajo, crece con un rebote y se asienta, con dos anillos que se abren y chispas
//      alrededor (un «pop» de motion graphics).
//   2. El saludo: «Hola, soy MaKo» y, abajo, «Tócame para empezar», que late. MaKo flota y parpadea.
//   3. NO avanza solo: recién al tocarla (o con Enter/espacio, es un botón) vuela a su lugar de foto del chat
//      (`[data-mako-foto]`) y aparece el primer mensaje.
// Con movimiento reducido: MaKo quieta, el saludo y el botón; al tocarla, el chat.
// ⚠️ La capa empieza DEBAJO de la barra de «Inspeccionar» (`--barra-agencia`), como el chat.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { CriaturaMako } from './CriaturaMako';

const MS_VUELO = 700;
const CURVA = 'cubic-bezier(.16,.84,.34,1)';
const CHISPAS = [0, 60, 120, 180, 240, 300];

/** Lleva un elemento fijo de su caja actual a la de destino (FLIP a mano; molde: app/video-generator/PreviaVolante.tsx). */
function volar(el: HTMLElement, hasta: DOMRect, alTerminar: () => void) {
  const desde = el.getBoundingClientRect();
  const escala = desde.width === 0 ? 1 : hasta.width / desde.width;
  const dx = hasta.left + hasta.width / 2 - (desde.left + desde.width / 2);
  const dy = hasta.top + hasta.height / 2 - (desde.top + desde.height / 2);
  // La animación de entrada (CSS, con `both`) le gana a un estilo en línea: se apaga antes de volar.
  el.style.animation = 'none';
  const anim = el.animate(
    [{ transform: 'translate(0, 0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${escala})` }],
    { duration: MS_VUELO, easing: CURVA, fill: 'forwards' },
  );
  anim.addEventListener('finish', alTerminar, { once: true });
  anim.addEventListener('cancel', alTerminar, { once: true });
}

export function EntradaMako({ onFin }: { onFin: () => void }) {
  const [saliendo, setSaliendo] = useState(false);
  const cuerpo = useRef<HTMLSpanElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const terminado = useRef(false);
  // El padre puede volver a dibujarse durante la entrada: el temporizador no se reinicia por eso.
  const alFin = useRef(onFin);
  useEffect(() => { alFin.current = onFin; });

  const empezar = useCallback(() => {
    if (terminado.current) return;
    terminado.current = true;
    setSaliendo(true);
    const el = cuerpo.current;
    const destino = document.querySelector<HTMLElement>('[data-mako-foto]')?.getBoundingClientRect();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!el || !destino || destino.width === 0 || reduce) { alFin.current(); return; }
    volar(el, destino, () => alFin.current());
  }, []);

  // ESPERA EL CLIC (18/10/2026, 14:00, Martín: la animación vuelve a pedir el clic). El avance solo a los 2,4 s
  // (ffd0ea3ef) se revirtió; la estrella y la entrada quedan igual. El foco va al botón: Enter o espacio también empiezan.
  useEffect(() => {
    const t = setTimeout(() => boton.current?.focus({ preventScroll: true }), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`en-capa${saliendo ? ' en-capa--sale' : ''}`} role="presentation">
      <style>{CSS_ENTRADA}</style>
      <div className="en-centro">
        {/* Sin los anillos azules alrededor (18/10/2026, Martín: «sin el círculo azul alrededor»). */}
        {CHISPAS.map((g) => <span key={g} className="en-chispa" aria-hidden style={{ ['--g' as string]: `${g}deg` }} />)}
        <button ref={boton} type="button" className="en-boton" onClick={empezar} aria-label="Empezar con MaKo">
          <span ref={cuerpo} className="en-cuerpo"><CriaturaMako size={120} reaccion="escucha" /></span>
        </button>
      </div>
      <p className="en-hola">Hola, soy MaKo</p>
      <p className="en-toca" aria-hidden>Tócame para empezar</p>
    </div>
  );
}

const CSS_ENTRADA = `
.en-capa {
  position: fixed; top: var(--barra-agencia, 0px); right: 0; bottom: 0; left: 0; z-index: 120;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 24px 16px;
  background: var(--bg); transition: background-color .45s ease;
}
.en-capa--sale { background-color: transparent; pointer-events: none; }
.en-capa--sale .en-hola, .en-capa--sale .en-toca, .en-capa--sale .en-anillo, .en-capa--sale .en-chispa { animation: en-va .3s ease forwards; }
.en-centro { position: relative; width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; }
.en-boton {
  position: relative; z-index: 1; border: 0; padding: 0; background: none; cursor: pointer; border-radius: 50%;
  -webkit-tap-highlight-color: transparent;
}
.en-boton:focus-visible { outline: 3px solid var(--primary); outline-offset: 8px; }
.en-cuerpo { display: inline-flex; animation: en-entra .9s cubic-bezier(.34,1.56,.64,1) both, en-flota 3.2s ease-in-out .9s infinite; }
.en-boton:hover .en-cuerpo { filter: brightness(1.04); }
.en-anillo {
  position: absolute; inset: 40px; border-radius: 50%; border: 2px solid var(--grafo-avatares);
  opacity: 0; animation: en-anillo 1.1s cubic-bezier(.16,.84,.34,1) .35s both;
}
.en-anillo--2 { animation-delay: .55s; border-color: var(--primary); }
.en-chispa {
  position: absolute; left: 50%; top: 50%; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%;
  background: var(--grafo-avatares); opacity: 0; animation: en-chispa .9s ease-out .45s both;
}
.en-hola { margin: 0; font-size: clamp(22px, 5vw, 30px); font-weight: 700; letter-spacing: -0.02em; color: var(--ink); animation: en-sube .5s ease .7s both; }
.en-toca { margin: 0; font-size: 14px; color: var(--dim); animation: en-sube .5s ease 1.2s both, en-late 1.6s ease-in-out 1.8s infinite; }
@keyframes en-entra {
  0% { opacity: 0; transform: translateY(70px) scale(.2) rotate(-18deg); }
  55% { opacity: 1; transform: translateY(-12px) scale(1.12) rotate(6deg); }
  78% { transform: translateY(2px) scale(.96) rotate(-2deg); }
  100% { opacity: 1; transform: none; }
}
@keyframes en-flota { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes en-anillo { 0% { opacity: .7; transform: scale(.4); } 100% { opacity: 0; transform: scale(1.5); } }
@keyframes en-chispa {
  0% { opacity: 0; transform: rotate(var(--g)) translateX(20px) scale(.4); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: rotate(var(--g)) translateX(96px) scale(1); }
}
@keyframes en-sube { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes en-late { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
@keyframes en-va { to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .en-cuerpo, .en-anillo, .en-chispa, .en-hola, .en-toca { animation: none !important; opacity: 1; }
  .en-anillo, .en-chispa { display: none; }
}
`;
