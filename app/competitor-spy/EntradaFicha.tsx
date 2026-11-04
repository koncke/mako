'use client';

// =============================================================================
// EntradaFicha — entrar a un competidor ES el loader (4/11/2026)
// =============================================================================
// Martín (por el Cerebro), mirando `competidor=17`: «al entrar en un competidor se ve así… Eso es lo que no quiero en diseño… Me
// imagino que la tarjeta que hice click, la de la caricatura se pone grande en el medio y de esa caricatura salen todas las
// tarjetitas de los reels y youtube… Eso funciona como un loader». Antes se veía la columna de la derecha y el resto vacío mientras
// se traían sus piezas y se bajaban sus miniaturas.
//
// La coreografía (la dirige SpyApp.tsx; acá sólo la caricatura):
//   1. «esperando»: su caricatura sale de la tarjeta tocada (o del centro, si se entró por un link) y crece hasta el medio de la
//      pantalla, sobre el fondo de la página. Ahí flota mientras la ficha, escondida debajo, trae lo suyo.
//   2. «saliendo»: con el gráfico listo, sus tarjetitas salen de este centro hasta su día y sus vistas (GraficoSpy, `desde`), y la
//      caricatura se achica hasta la foto de la ficha y se funde en ella. Ahí termina: la ficha en su sitio.
//
// ⚠️ SÓLO `transform` y `opacity` (Web Animations API): nada de layout por cuadro. Con «reducir movimiento» no se monta (SpyApp).
// ⚠️ EN UN PORTAL AL `body`: un `position: fixed` adentro de un contenedor con `transform` se ubica mal (AGENTS.md).
// =============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type Caja = { left: number; top: number; width: number; height: number };
export type FaseEntrada = 'esperando' | 'saliendo';

/** El tamaño de la caricatura en el centro: grande, pero que entre en un teléfono. */
export const ladoEnElCentro = (ancho: number, alto: number): number => Math.round(Math.min(220, ancho * 0.46, alto * 0.32));
/** Dónde queda en el centro (y de dónde salen las tarjetitas). Un poco arriba del medio: abajo va el gráfico. */
export function cajaDelCentro(ancho: number, alto: number): Caja {
  const lado = ladoEnElCentro(ancho, alto);
  return { left: (ancho - lado) / 2, top: alto * 0.42 - lado / 2, width: lado, height: lado };
}
export const centroDe = (c: Caja) => ({ x: c.left + c.width / 2, y: c.top + c.height / 2 });

/** De una caja a otra, con `transform` sobre un elemento que vive en `destino`. */
const desdeHasta = (de: Caja, a: Caja) => `translate(${de.left - a.left}px,${de.top - a.top}px) scale(${de.width / a.width},${de.height / a.height})`;

const CURVA = 'cubic-bezier(.32,.72,0,1)';
/** La misma caja, achicada desde su centro (el `transform-origin` es la esquina: hace falta para ir de una caja a otra). */
const achicada = (c: Caja, k: number): Caja => ({ left: c.left + (c.width * (1 - k)) / 2, top: c.top + (c.height * (1 - k)) / 2, width: c.width * k, height: c.height * k });

export function EntradaFicha({ src, inicial, origen, fase, destino, onFin }: {
  /** La caricatura (o su foto, si no tiene). null = su inicial. */
  src: string | null;
  inicial: string;
  /** La caja de la tarjeta tocada. null = se entró por un link: nace en el centro. */
  origen: Caja | null;
  fase: FaseEntrada;
  /** Adónde termina: la foto de la ficha. null o fuera de la pantalla = se funde en el centro. */
  destino: () => Element | null;
  onFin: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [montado, setMontado] = useState(false);
  const fin = useRef(onFin);
  fin.current = onFin;
  // eslint-disable-next-line react-hooks/set-state-in-effect -- el portal necesita el `body`: no existe en el server
  useEffect(() => { setMontado(true); }, []);

  // 1. Crecer hasta el centro.
  useLayoutEffect(() => {
    const n = el.current;
    if (!montado || !n) return;
    const centro = cajaDelCentro(innerWidth, innerHeight);
    Object.assign(n.style, { left: `${centro.left}px`, top: `${centro.top}px`, width: `${centro.width}px`, height: `${centro.height}px` });
    const a = origen
      ? n.animate([{ transform: desdeHasta(origen, centro) }, { transform: 'none' }], { duration: 520, easing: CURVA, fill: 'both' })
      : n.animate([
        { transform: desdeHasta(achicada(centro, 0.6), centro), opacity: 0 },
        { transform: 'none', opacity: 1 },
      ], { duration: 420, easing: CURVA, fill: 'both' });
    return () => a.cancel();
  }, [montado, origen]);

  // 2. Salir: hasta la foto de la ficha, y se funde en ella.
  useEffect(() => {
    const n = el.current;
    if (!montado || !n || fase !== 'saliendo') return;
    const centro = cajaDelCentro(innerWidth, innerHeight);
    const d = destino()?.getBoundingClientRect();
    const visible = d && d.width > 0 && d.bottom > 0 && d.top < innerHeight;
    const flote = n.querySelector<HTMLElement>('.spye-flota');
    if (flote) flote.style.animation = 'none';
    const foto: Caja | null = visible ? { left: d.left, top: d.top, width: d.width, height: d.height } : null;
    const a = foto
      ? n.animate([
        { transform: 'none', opacity: 1 },
        { transform: desdeHasta(foto, centro), opacity: 1, offset: 0.82 },
        { transform: desdeHasta(foto, centro), opacity: 0 },
      ], { duration: 640, easing: CURVA, fill: 'forwards' })
      : n.animate([{ transform: 'none', opacity: 1 }, { transform: desdeHasta(achicada(centro, 0.7), centro), opacity: 0 }], { duration: 360, easing: CURVA, fill: 'forwards' });
    a.onfinish = () => fin.current();
    return () => a.cancel();
  }, [montado, fase, destino]);

  if (!montado) return null;
  return createPortal(
    <div className="spye" ref={el} aria-hidden>
      <style>{CSS}</style>
      {/* Tres capas: la de afuera viaja (transform), la del medio flota, la de adentro es el marco redondo con su sombra. */}
      <div className="spye-flota">
        <div className="spye-marco">
          {src
            // eslint-disable-next-line @next/next/no-img-element -- está en nuestro bucket o en /public
            ? <img src={src} alt="" draggable={false} />
            : <span>{inicial}</span>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const CSS = `
.spye{position:fixed;z-index:60;pointer-events:none;will-change:transform,opacity;transform-origin:0 0}
.spye-flota{width:100%;height:100%;animation:spyeFlota 2.6s ease-in-out .55s infinite}
.spye-marco{width:100%;height:100%;border-radius:30%;overflow:hidden;background:var(--surface-2);
  box-shadow:0 24px 60px -18px rgba(18,21,27,.35)}
.spye img{display:block;width:100%;height:100%;object-fit:cover}
.spye span{display:grid;place-items:center;width:100%;height:100%;font-size:64px;font-weight:700;color:var(--dim)}
@keyframes spyeFlota{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@media (prefers-reduced-motion:reduce){.spye-flota{animation:none}}
`;
