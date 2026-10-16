'use client';

// =============================================================================
// IntroMako — la animación del principio del onboarding: MaKo arma tu cerebro y se sienta en el chat
// =============================================================================
// Pedido de Martín (16/10/2026): «Si puede estar el grafo. Pero toda la animación del principio no. En su
// lugar prefiero una animación de los mismos 3 pasos que incluya al muñequito de MaKo… Y que al terminar
// la animación se posicione en su lugar como "foto de perfil" y que aparezca el chat.»
//
// Los MISMOS TRES TIEMPOS de la bienvenida de antes (el centro → las cinco piezas → las áreas), pero solos,
// sin clics, y con MaKo como el centro del grafo:
//   1. MaKo aparece en el medio.
//   2. Salen de él las cinco piezas (Tu Oferta, Tu Avatar, Tu Mensaje, Tu Funnel, Tu Negocio).
//   3. Se llenan las áreas, y MaKo trabaja (parpadea).
//   Fin: el grafo se va, el fondo se aclara y MaKo VUELA a su lugar de foto de perfil del chat
//   (`[data-mako-foto]`), con un FLIP a mano (el molde es `volar` de app/video-generator/PreviaVolante.tsx).
//
// El grafo es FICCIÓN a propósito, como el de antes: un cliente nuevo no tiene datos. Lo real son los
// nombres de las áreas y su paleta (lib/cerebro-modelo.ts), así reconoce su Second Brain después.
//
// ⚠️ Un clic o una tecla la saltean (vuela al toque). Con movimiento reducido no corre: aparece el chat.
// ⚠️ Dura ~4 s: el onboarding tiene que ser ágil (pedido de Martín), y esto es una portada, no un paso.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { AREAS } from '@/lib/cerebro-modelo';
import { MunecoMako } from './MunecoMako';

const PIEZAS = [
  { id: 'negocio', et: 'Tu Negocio', color: 'var(--grafo-norte)' },
  { id: 'oferta', et: 'Tu Oferta', color: 'var(--grafo-oferta)' },
  { id: 'mercado', et: 'Tu Avatar', color: 'var(--grafo-cliente)' },
  { id: 'mensaje', et: 'Tu Mensaje', color: 'var(--grafo-razones)' },
  { id: 'funnel', et: 'Tu Funnel', color: 'var(--grafo-funnel)' },
] as const;

const C = 300;
const R1 = 150;
const R2 = 252;
const rad = (g: number) => (g * Math.PI) / 180;
const px = (r: number, g: number) => C + r * Math.cos(rad(g));
const py = (r: number, g: number) => C + r * Math.sin(rad(g));

/** Las piezas en un círculo, empezando arriba, y las áreas en abanico detrás de su pieza. */
const NODOS1 = PIEZAS.map((p, i) => ({ ...p, ang: -90 + i * 72 }));
const NODOS2 = NODOS1.flatMap((p) => {
  const suyas = AREAS.filter((a) => a.padre === p.id);
  const abanico = Math.min(26, 13 * suyas.length);
  return suyas.map((a, j) => {
    const off = suyas.length === 1 ? 0 : -abanico + (2 * abanico * j) / (suyas.length - 1);
    return { id: a.id, et: a.nombre, color: a.color, ang: p.ang + off, padre: p };
  });
});

const MS_PIEZAS = 1000;
const MS_AREAS = 2100;
const MS_FIN = 3500;
const MS_VUELO = 750;
const CURVA = 'cubic-bezier(.16,.84,.34,1)';

/**
 * Anima un elemento fijo de su caja actual a la de destino. El destino se escribe ANTES y la animación va
 * al revés (del lugar viejo al nuevo): si algo la interrumpe, ya está donde tiene que estar.
 */
function volar(el: HTMLElement, hasta: DOMRect, alTerminar: () => void) {
  const desde = el.getBoundingClientRect();
  const escala = desde.width === 0 ? 1 : hasta.width / desde.width;
  const dx = hasta.left + hasta.width / 2 - (desde.left + desde.width / 2);
  const dy = hasta.top + hasta.height / 2 - (desde.top + desde.height / 2);
  // La animación de entrada (CSS, con `both`) le gana a un estilo en línea: se apaga antes de volar, o al
  // terminar el vuelo el muñeco saltaría de vuelta a su tamaño de entrada.
  el.style.animation = 'none';
  el.style.left = `${hasta.left + hasta.width / 2}px`;
  el.style.top = `${hasta.top + hasta.height / 2}px`;
  el.style.transform = `translate(-50%, -50%) scale(${escala})`;
  const anim = el.animate(
    [
      { transform: `translate(calc(-50% - ${dx}px), calc(-50% - ${dy}px)) scale(1)` },
      { transform: `translate(-50%, -50%) scale(${escala})` },
    ],
    { duration: MS_VUELO, easing: CURVA, fill: 'none' },
  );
  anim.addEventListener('finish', alTerminar, { once: true });
  anim.addEventListener('cancel', alTerminar, { once: true });
}

export function IntroMako({ onFin }: { onFin: () => void }) {
  const [tiempo, setTiempo] = useState(0);
  const [saliendo, setSaliendo] = useState(false);
  const muneco = useRef<HTMLDivElement>(null);
  const terminado = useRef(false);
  const onFinRef = useRef(onFin);
  useEffect(() => { onFinRef.current = onFin; }, [onFin]);

  const terminar = () => {
    if (terminado.current) return;
    terminado.current = true;
    setSaliendo(true);
    const el = muneco.current;
    const destino = document.querySelector<HTMLElement>('[data-mako-foto]')?.getBoundingClientRect();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!el || !destino || destino.width === 0 || reduce) { onFinRef.current(); return; }
    volar(el, destino, () => onFinRef.current());
  };
  const terminarRef = useRef(terminar);
  terminarRef.current = terminar;

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { onFinRef.current(); return; }
    const t = [
      setTimeout(() => setTiempo(1), MS_PIEZAS),
      setTimeout(() => setTiempo(2), MS_AREAS),
      setTimeout(() => terminarRef.current(), MS_FIN),
    ];
    const saltar = () => terminarRef.current();
    window.addEventListener('keydown', saltar);
    return () => { t.forEach(clearTimeout); window.removeEventListener('keydown', saltar); };
  }, []);

  const leyenda = tiempo === 0 ? 'Hola, soy MaKo' : tiempo === 1 ? 'Entiendo tu negocio' : 'y lo dejo listo';

  return (
    <div className={`im-capa${saliendo ? ' im-capa--sale' : ''}`} onClick={() => terminarRef.current()} role="presentation">
      <style>{CSS_INTRO}</style>
      <svg className="im-grafo" viewBox="0 0 600 600" aria-hidden>
        {tiempo >= 1 && NODOS1.map((p, i) => (
          <g key={p.id} style={{ animationDelay: `${i * 90}ms` }} className="im-n1">
            <line x1={C} y1={C} x2={px(R1, p.ang)} y2={py(R1, p.ang)} stroke={p.color} strokeOpacity={0.55} strokeWidth={1.6} className="im-linea" style={{ animationDelay: `${i * 90}ms` }} />
            <circle cx={px(R1, p.ang)} cy={py(R1, p.ang)} r={14} fill={p.color} className="im-punto" style={{ animationDelay: `${i * 90 + 260}ms` }} />
            <text x={px(R1, p.ang)} y={py(R1, p.ang) + 32} textAnchor="middle" className="im-et" style={{ animationDelay: `${i * 90 + 320}ms` }}>{p.et}</text>
          </g>
        ))}
        {tiempo >= 2 && NODOS2.map((a, i) => (
          <g key={a.id}>
            <line x1={px(R1, a.padre.ang)} y1={py(R1, a.padre.ang)} x2={px(R2, a.ang)} y2={py(R2, a.ang)} stroke={a.color} strokeOpacity={0.4} strokeWidth={1.2} className="im-linea" style={{ animationDelay: `${i * 50}ms` }} />
            <circle cx={px(R2, a.ang)} cy={py(R2, a.ang)} r={8} fill={a.color} className="im-punto" style={{ animationDelay: `${i * 50 + 220}ms` }} />
            <text x={px(R2, a.ang)} y={py(R2, a.ang) + 22} textAnchor="middle" className="im-et im-et--chica" style={{ animationDelay: `${i * 50 + 280}ms` }}>{a.et}</text>
          </g>
        ))}
      </svg>
      <div ref={muneco} className="im-muneco">
        <MunecoMako size={104} animo={tiempo >= 2 ? 'trabajando' : 'despierto'} />
      </div>
      <p key={leyenda} className="im-leyenda" aria-live="polite">{leyenda}</p>
    </div>
  );
}

const CSS_INTRO = `
.im-capa {
  position: fixed; inset: 0; z-index: 120; background: var(--sidebar); cursor: pointer;
  display: flex; align-items: center; justify-content: center; overflow: hidden;
  transition: background-color .5s ease;
}
.im-capa--sale { background-color: transparent; pointer-events: none; }
.im-grafo { width: min(92vmin, 640px); height: min(92vmin, 640px); transition: opacity .4s ease, transform .4s ease; }
.im-capa--sale .im-grafo { opacity: 0; transform: scale(.96); }
.im-muneco {
  position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
  animation: im-pop .55s cubic-bezier(.34,1.56,.64,1) both;
}
.im-leyenda {
  position: fixed; left: 0; right: 0; bottom: max(9vh, 48px); margin: 0; text-align: center;
  font-size: clamp(20px, 3.2vw, 30px); font-weight: 600; letter-spacing: -0.02em; color: var(--on-sidebar);
  animation: im-sube .45s ease both;
}
.im-capa--sale .im-leyenda { opacity: 0; transition: opacity .25s ease; }
.im-linea { stroke-dasharray: 260; stroke-dashoffset: 260; animation: im-trazo .5s ease forwards; }
.im-punto { transform-box: fill-box; transform-origin: center; animation: im-pop-punto .45s cubic-bezier(.34,1.56,.64,1) both; }
.im-et { fill: var(--on-sidebar); font-size: 15px; font-weight: 600; opacity: 0; animation: im-aparece .4s ease forwards; }
.im-et--chica { font-size: 11px; font-weight: 500; fill: var(--sidebar-text); }
@keyframes im-pop { from { transform: translate(-50%, -50%) scale(.3); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
@keyframes im-pop-punto { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes im-trazo { to { stroke-dashoffset: 0; } }
@keyframes im-aparece { to { opacity: 1; } }
@keyframes im-sube { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (max-width: 640px) { .im-et--chica { display: none; } }
@media (prefers-reduced-motion: reduce) {
  .im-muneco, .im-leyenda, .im-linea, .im-punto, .im-et { animation: none !important; opacity: 1 !important; stroke-dashoffset: 0 !important; }
}
`;
