'use client';

// =============================================================================
// EntradaApp — la criatura de MaKo desde que se toca el ícono hasta que la app está lista (22/10/2026)
// =============================================================================
// Martín, desde su Android con MaKo instalada: «Al entrar en Mobile, me sigue apareciendo eso, cuando te pedí que solo sea
// la criatura de MaKo... Luego de ese logo recién aparece la criatura... Y lo peor es que entre medio, se ve el ops center
// por unos segundos y luego viene la animación de la criatura».
//
// ⚠️ VA EN EL PRIMER HTML. La de antes (la EntradaMako del onboarding) se cargaba con `dynamic(..., { ssr: false })`: no
// existía hasta que React hidrataba y bajaba su chunk, y mientras tanto se veía el Centro que mandó el server, quieto y sin
// hidratar (medido el 22/10, 09:45: el documento tardó 3 s y la primera acción del Centro salió 0,7 s después). Ésta la
// dibuja el server, con CSS en línea: arranca en el primer pintado, sin esperar JavaScript, y tapa todo hasta que React
// hidrató Y la página terminó de llegar por el stream (`paginaLista`: en las rutas con `loading.tsx` el shell hidrata antes
// de que llegue la página). Recién ahí se va (vuela a su lugar en la barra) con una transición corta. ShellM la pone PRIMERA
// en el HTML: si Chrome pinta antes de terminar de leer el documento, lo primero que tiene es la capa.
//
// EL PRIMER CUADRO ES EL SPLASH DEL SISTEMA (que no se puede sacar): mismo fondo, la baldosa oscura del ícono maskable con
// la chispa, mismo lugar y tamaño (app/m/_ui/entrada.ts tiene las medidas y de dónde salen). Después:
//   0–250 ms   quieto, igual al splash (Chrome lo levanta con un fundido);
//   250–800    la baldosa se achica y se va; la chispa se apaga y en su lugar nace la criatura, con un rebote;
//   420–1120   seis chispitas salen del centro;
//   desde 800  flota y parpadea (el primero a los 0,9 s), hasta que la app está lista (y nunca antes de 1 s: que se lea).
// Con movimiento reducido: la baldosa se funde en la criatura, QUIETA (sin rebote, sin flotar, sin parpadeo).
//
// No es un botón ni espera el toque (la del onboarding sí): se va sola cuando la app está lista. Si JavaScript no llega
// nunca, el CSS la saca a los 15 s (`ea-seguro`) y queda la pantalla del server.
// ⚠️ Sin `.css` importado (los tests de node importan app/m/_ui) y sin `Criatura` (ella sí trae uno): `Muneco`, que dibuja
// el server, con el aspecto de MaKo. Colores fijos del tema claro: el splash es claro aunque la persona use el oscuro.
// =============================================================================

import { useEffect, useRef } from 'react';
// El movimiento de la salida es UNO para todos los loaders con la criatura (23/10/2026): app/_ui/vuelo-mako.ts.
import { MS_SALIDA, trayecto, volar } from '@/app/_ui/vuelo-mako';
export { MS_SALIDA, trayecto };
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import {
  ARTE_ARRANQUE, ATTR_ENTRADA_VISTA, CHISPA_EN_ARTE, CLAVE_ENTRADA_MOVIL, CRIATURA_ARRANQUE, FONDO_ARRANQUE, FORMA_ARRANQUE,
  VAR_BARRAS, trazoForma,
} from './entrada';

/** La chispa de MaKo (app/icon.svg, app/_components/MakoBrand.tsx → SPARK): ±11 unidades. */
const CHISPA = 'M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z';
const ESCALA_CHISPA = ((ARTE_ARRANQUE * CHISPA_EN_ARTE) / 2 / 11).toFixed(3);
const MEDIO = ARTE_ARRANQUE / 2;
const FORMA = trazoForma(FORMA_ARRANQUE / 2);
const CHISPITAS = [0, 60, 120, 180, 240, 300];

/** Lo mínimo que se ve la criatura, desde el primer pintado: la entrada entera (nace a los 800 ms) y un parpadeo. */
export const MS_MINIMO = 1000;
/** Lo máximo: el CSS la saca solo a esta altura (`ea-seguro`, por si JavaScript no llega) y el efecto deja de esperar. */
export const MS_SEGURO = 15000;
/** Cada cuánto se vuelve a mirar si la página terminó de llegar. */
const MS_SONDEO = 100;

/** ¿Ya salió en esta apertura? Sin sessionStorage no se sabe: como el script de antes de pintar, se da por vista. */
export function entradaYaVista(): boolean {
  try { return !!sessionStorage.getItem(CLAVE_ENTRADA_MOVIL); } catch { return true; }
}

/** Cuánto falta para que se pueda ir, si la app quedó lista cuando la entrada llevaba `transcurrido` ms en pantalla. */
export function esperaParaSalir(transcurrido: number): number {
  return Math.max(0, MS_MINIMO - transcurrido);
}

/**
 * ¿El server ya mandó la página entera y está a la vista? (revisión del 22/10/2026). Hidratar el SHELL no alcanza: en
 * una ruta con `loading.tsx` —la entrada de los clientes (/second-brain), /crm, /inbox, /plan…— el server manda primero
 * el layout (ShellM, esta entrada) con el esqueleto, React lo hidrata enseguida, y la página llega DESPUÉS por el stream.
 * Con sólo el efecto, la criatura se iba al segundo y quedaba a la vista el esqueleto del Ops Center a medio cargar.
 * Lista = el documento terminó de llegar (`readyState` ya no es 'loading') y ningún borde de Suspense del server espera
 * (`<!--$?-->`, su contenido no llegó) ni está por revelarse (`<!--$~-->`: React 19.2 junta las revelaciones y las suelta
 * hasta 300 ms después).
 */
export function paginaLista(doc: Document): boolean {
  if (doc.readyState === 'loading') return false;
  const raiz = doc.body ?? doc.documentElement;
  if (!raiz) return true;
  const w = doc.createTreeWalker(raiz, 128 /* NodeFilter.SHOW_COMMENT */);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const d = (n as Comment).data;
    if (d === '$?' || d === '$~') return false;
  }
  return true;
}

/** Lo que la salida necesita del navegador, inyectable: el test corre `programarSalida` con un reloj falso. */
export type EntornoSalida = {
  /** Cuánto lleva la entrada en pantalla (ms). */
  lleva: () => number;
  /** ¿La página terminó de llegar y está a la vista? (`paginaLista`) */
  lista: () => boolean;
  esperar: (fn: () => void, ms: number) => void;
  /** Dos cuadros: que el navegador pinte lo que React acaba de hidratar (y lo que el stream acaba de revelar). */
  dosCuadros: (fn: () => void) => void;
};

/**
 * Cuándo destapar: nunca antes de `MS_MINIMO`; después, cuando la página está lista, y como mucho a `MS_SEGURO` (a esa
 * altura el CSS ya la sacó: no se queda esperando una página que no termina nunca).
 */
export function programarSalida(e: EntornoSalida, salir: () => void): void {
  const intentar = () => {
    const lleva = e.lleva();
    const falta = esperaParaSalir(lleva);
    if (falta > 0) { e.esperar(intentar, falta); return; }
    if (lleva < MS_SEGURO && !e.lista()) { e.esperar(intentar, MS_SONDEO); return; }
    e.dosCuadros(salir);
  };
  intentar();
}

/**
 * La entrada terminó en ESTE documento: se marca <html> como lo hace el script de antes de pintar, así un ShellM que se
 * vuelve a montar navegando (ida y vuelta por /mi-curso, /onboarding…) la encuentra apagada por CSS desde el primer
 * cuadro. Sin esto se pintaba un cuadro de la baldosa antes de que el efecto la sacara (el efecto corre después de pintar).
 */
export function marcarDocumento(doc: Pick<Document, 'documentElement'>): void {
  try { doc.documentElement.setAttribute(ATTR_ENTRADA_VISTA, ''); } catch { /* sin DOM */ }
}


// El vuelo a la barra (`trayecto`) vive en app/_ui/vuelo-mako.ts desde el 23/10/2026: lo comparten todos los loaders.

/**
 * Cuánto lleva la entrada en pantalla: el reloj de la animación CSS de la propia capa (`ea-seguro`, que arranca cuando la
 * capa se pinta y no termina hasta los 15 s; las de la criatura terminan y su reloj se queda quieto). Sirve igual si vino
 * en el HTML del server (la app recién abierta) o si ShellM se montó navegando (después del login): con el primer pintado
 * de la página, la segunda se iba en el acto. Sin animaciones legibles, el primer pintado.
 */
function enPantalla(capa: HTMLElement | null): number {
  try {
    const t = capa?.getAnimations()[0]?.currentTime;
    if (typeof t === 'number') return t;
  } catch { /* sin getAnimations */ }
  try {
    const p = performance.getEntriesByType('paint');
    const e = p.find((x) => x.name === 'first-contentful-paint') ?? p.find((x) => x.name === 'first-paint');
    return performance.now() - (e ? e.startTime : 0);
  } catch { return MS_MINIMO; }
}

export function EntradaApp({ destino, onFin }: {
  /** Adónde vuela al irse: la criatura del Ops Center en la barra. Sin ella (otra barra, una pantalla sin barra), se funde. */
  destino: string;
  /** La entrada terminó (o ya se había visto): ShellM pone la marca y la desmonta. */
  onFin: () => void;
}) {
  const capa = useRef<HTMLDivElement>(null);
  const vuelo = useRef<HTMLDivElement>(null);
  const cuerpo = useRef<HTMLDivElement>(null);
  const alFin = useRef(onFin);
  useEffect(() => { alFin.current = onFin; });

  // Este efecto corre cuando React hidrató el shell. Antes no hay nada que correr: lo de hasta acá es CSS. Se va cuando,
  // además, la página terminó de llegar del server y está a la vista (`paginaLista`), nunca antes de 1 s y, como mucho,
  // a los 15 s (lo mismo que el CSS).
  useEffect(() => {
    // Al irse marca el DOCUMENTO (`marcarDocumento`), después avisa a ShellM.
    const terminar = () => { marcarDocumento(document); alFin.current(); };
    if (entradaYaVista()) { terminar(); return; }
    let quieta = false;
    try { quieta = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* sin matchMedia: con movimiento */ }
    const timers: number[] = [];
    let viva = true;
    const salir = () => {
      if (!viva) return;
      const el = capa.current;
      const v = vuelo.current;
      if (!el || !v) { terminar(); return; }
      el.setAttribute('data-sale', '');
      const t = quieta ? null : trayecto(cuerpo.current?.getBoundingClientRect(), document.querySelector(destino)?.getBoundingClientRect(), v.getBoundingClientRect());
      const ms = volar(v, t, quieta);
      timers.push(window.setTimeout(terminar, ms + 30));
    };
    programarSalida({
      lleva: () => enPantalla(capa.current),
      lista: () => paginaLista(document),
      esperar: (fn, ms) => { timers.push(window.setTimeout(() => { if (viva) fn(); }, ms)); },
      dosCuadros: (fn) => requestAnimationFrame(() => requestAnimationFrame(fn)),
    }, salir);
    return () => { viva = false; timers.forEach((t) => window.clearTimeout(t)); };
  }, [destino]);

  return (
    <div ref={capa} className="ea-capa" role="presentation" aria-hidden>
      <style>{CSS_ENTRADA_APP}</style>
      <div className="ea-centro">
        <svg className="ea-baldosa" width={ARTE_ARRANQUE} height={ARTE_ARRANQUE} viewBox={`${-MEDIO} ${-MEDIO} ${ARTE_ARRANQUE} ${ARTE_ARRANQUE}`}>
          <defs>
            <linearGradient id="ea-fondo" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2A251C" />
              <stop offset="1" stopColor="#171511" />
            </linearGradient>
            <clipPath id="ea-forma"><path d={FORMA} /></clipPath>
          </defs>
          <rect x={-MEDIO} y={-MEDIO} width={ARTE_ARRANQUE} height={ARTE_ARRANQUE} fill="url(#ea-fondo)" clipPath="url(#ea-forma)" />
        </svg>
        <svg className="ea-sello" width={ARTE_ARRANQUE} height={ARTE_ARRANQUE} viewBox={`${-MEDIO} ${-MEDIO} ${ARTE_ARRANQUE} ${ARTE_ARRANQUE}`}>
          <defs>
            <linearGradient id="ea-oro" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F6D365" />
              <stop offset="1" stopColor="#EF9F27" />
            </linearGradient>
          </defs>
          <path d={CHISPA} transform={`scale(${ESCALA_CHISPA})`} fill="url(#ea-oro)" />
        </svg>
        <div className="ea-chispitas">
          {CHISPITAS.map((g) => <span key={g} className="ea-chispita" style={{ ['--g' as string]: `${g}deg` }} />)}
        </div>
        <div ref={vuelo} className="ea-vuelo">
          <div ref={cuerpo} className="ea-cria">
            <Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo="despierto" size={CRIATURA_ARRANQUE} />
          </div>
        </div>
      </div>
    </div>
  );
}

// La capa va por encima de todo lo de la app (toasts, hojas, avisos). El centro se corrige hacia arriba lo que la barra de
// estado corre la página respecto del splash, sólo si la página llega hasta abajo (ver ARRANQUE_ANTES_DE_PINTAR).
// `.mun-cuerpo` y `.mun-ojos--parpadeo` traen animaciones globales de app/admin/operaciones/centro.css: acá se pisan.
export const CSS_ENTRADA_APP = `
.ea-capa {
  position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center;
  background-color: ${FONDO_ARRANQUE}; transition: background-color .3s ease;
  --mako: #F2B01E; --criatura-tinta: #22262E; --criatura-rubor: #C0414D;
  animation: ea-seguro .3s ease ${MS_SEGURO / 1000}s forwards;
}
html[${ATTR_ENTRADA_VISTA}] .ea-capa { display: none; }
.ea-capa[data-sale] { background-color: transparent; pointer-events: none; }
.ea-capa[data-sale] .ea-chispitas { opacity: 0; transition: opacity .2s ease; }
.ea-centro {
  position: relative; flex: none; width: ${ARTE_ARRANQUE}px; height: ${ARTE_ARRANQUE}px;
  transform: translateY(calc(-1 * min(env(safe-area-inset-bottom, 0px) * 1000, var(${VAR_BARRAS}, 0px) / 2)));
}
.ea-baldosa, .ea-sello, .ea-chispitas, .ea-vuelo { position: absolute; inset: 0; }
.ea-baldosa, .ea-sello { display: block; overflow: visible; }
.ea-baldosa { animation: ea-baldosa .38s cubic-bezier(.55, 0, .45, 1) .25s both; }
.ea-sello { animation: ea-apaga .3s ease .3s both; }
.ea-vuelo { display: flex; align-items: center; justify-content: center; }
.ea-cria { display: flex; animation: ea-nace .5s cubic-bezier(.34, 1.56, .64, 1) .3s both, ea-flota 3.2s ease-in-out .8s infinite; }
.ea-capa .mun-cuerpo { animation: none; }
.ea-capa .mun-ojos--parpadeo { animation: ea-parpadeo 3.4s ease .78s infinite; }
.ea-chispita {
  position: absolute; left: 50%; top: 50%; width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; border-radius: 50%;
  background: #F2B01E; opacity: 0; animation: ea-chispita .7s ease-out .42s both;
}
@keyframes ea-baldosa { 0% { opacity: 1; transform: scale(1); } 55% { opacity: .2; } 100% { opacity: 0; transform: scale(.6); } }
@keyframes ea-apaga { from { opacity: 1; } to { opacity: 0; } }
@keyframes ea-aparece { from { opacity: 0; } to { opacity: 1; } }
@keyframes ea-nace {
  0% { opacity: 0; transform: scale(.94); }
  45% { opacity: 1; transform: scale(1.07); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes ea-flota { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
@keyframes ea-parpadeo { 0%, 6%, 100% { transform: scaleY(1); } 3% { transform: scaleY(.1); } }
@keyframes ea-chispita {
  0% { opacity: 0; transform: rotate(var(--g)) translateX(46px) scale(.4); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: rotate(var(--g)) translateX(128px) scale(1); }
}
@keyframes ea-seguro { to { opacity: 0; visibility: hidden; } }
@media (prefers-reduced-motion: reduce) {
  .ea-capa { transition-duration: .15s; }
  .ea-baldosa, .ea-sello { animation: ea-apaga .2s linear .25s both; }
  .ea-cria { animation: ea-aparece .2s linear .25s both; }
  .ea-chispitas { display: none; }
  .ea-capa .mun-cuerpo, .ea-capa .mun-ojos--parpadeo { animation: none !important; }
}
`;
