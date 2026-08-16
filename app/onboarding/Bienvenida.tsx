'use client';

// =============================================================================
// La bienvenida — un cerebro que se arma con las manos del usuario
// =============================================================================
// Cuatro tiempos, y los tres primeros los dispara un click:
//
//   0. UN nodo, centrado y grande: «Tus anuncios». Nada más en pantalla. A los 3,2 s sin
//      tocar, una pista discreta.
//   1. (click) Las cinco piezas de las que sale un anuncio.
//   2. (click) Las áreas y sus partes.
//   3. (click) Todo: el cerebro lleno.
//   4. El mapa sube y entra el texto.
//
// ⚠️ ESTE MAPA ES FICCIÓN, Y ESO ES LO CORRECTO. Se probó montar el `Grafo` real de
// /second-brain y el dueño lo bajó con el argumento que cierra la discusión: **el cliente
// nuevo no tiene datos**. Medido contra un workspace reseteado, su cerebro real son 25
// nodos y casi todos son etapas del funnel sembrado — o sea que el mapa «de su negocio»
// que vería es el de un funnel que no armó. Textual: «no hace falta que sean iguales a
// los de Mauricio, si justamente esto es ficción, es un grafo sin info».
//
// Lo que sí es real: la PALETA (`--grafo-*`) y los nombres de las once áreas, que salen de
// `lib/cerebro-modelo.ts`. Así, cuando llegue a su Second Brain de verdad, reconoce lo que
// vio el primer día. Los dos primeros niveles van en segunda persona porque son la
// promesa, no el dato: «Tus anuncios», «Tu Oferta».
//
// ⚠️ Y TODO ESTÁ CONTROLADO A MANO —posición, color, flotación, tiempo de entrada— porque
// la versión con el grafo real «se comportaba de forma muy extraña»: su física de entrada
// y su flotación están hechas para un mapa que se explora, no para una portada de cuatro
// segundos. Acá cada nodo sabe cuándo aparece y cuánto se mueve.
// =============================================================================

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/app/_ui';
import { AREAS } from '@/lib/cerebro-modelo';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

const MS_PISTA = 3200;
/** Lo que tarda el último nivel en asentarse antes de que suba el mapa. */
const MS_CIERRE = 2200;

const FINALES = [
  'crecer tu negocio.',
  'escalar tus anuncios.',
  'cerrar más llamadas.',
  'llenar tu agenda.',
  'que tus leads te respondan.',
];

/** 165 ms por letra son unas 55 palabras por minuto: lo que teclea una persona. El jitter
 *  saca el ritmo de metrónomo, que es la firma de que lo escribe una máquina. */
const MS_LETRA = 165;
const MS_BORRAR = 62;
const MS_JITTER = 70;
const MS_QUIETA = 2600;

// ── El mapa ─────────────────────────────────────────────────────────────────
const CX = 500;
const CY = 470;
const rad = (g: number) => ((g - 90) * Math.PI) / 180;
const px = (r: number, g: number) => CX + r * Math.cos(rad(g));
const py = (r: number, g: number) => CY + r * Math.sin(rad(g));

/** Un hash estable por índice. Nada de `Math.random`: el server pinta el mismo HTML que
 *  el cliente hidrata, y un layout al azar es un mismatch garantizado. */
const h = (n: number) => (Math.sin(n * 127.1) * 43758.5453) % 1;
const az = (n: number) => Math.abs(h(n));

/**
 * ⚠️ EL MOVIMIENTO ES EL DEL GRAFO DE VERDAD, no uno inventado. Los datos de esta pantalla
 * son ficción —un cliente nuevo no tiene nada que mostrar— pero el COMPORTAMIENTO tiene
 * que ser el mismo, o la portada le promete una cosa y el producto entrega otra. Pedido
 * textual: «haz que se comporte igual que nuestro grafo, solo que CONTROLA qué sí y qué no».
 *
 * Portado tal cual de app/second-brain/Grafo.tsx:
 *   · FLOTE = 16 y DOS senoides de 7100 y 11300 ms. Los períodos no son múltiplos entre sí
 *     a propósito: el nodo nunca repite la misma trayectoria y el conjunto no late al
 *     unísono, que es lo que separa «vivo» de «parpadeando».
 *   · La fase sale del hash FNV-1a del id — el MISMO que usa la semilla del layout en el
 *     server— así el nodo flota igual en cada visita en vez de sortearlo al cargar.
 *   · La entrada nace desplazada hacia AFUERA y el desvío decae con (1-u)³ en 900 ms.
 *
 * LO QUE SE CONTROLA, que es la otra mitad del pedido: el reloj de la entrada arranca
 * cuando SE REVELA ESE NIVEL, no al montar. Así cada click tiene su propia llegada en vez
 * de que el mapa entero se rearme —que era el «se comporta de forma muy extraña»— y la
 * amplitud baja con el nivel, porque si el polvo se mueve como los nodos grandes el mapa
 * hierve y deja de leerse.
 */
const FLOTE = 16;

/** FNV-1a, el mismo de Grafo.tsx: la fase del nodo no se sortea, se deriva de su id. */
function hashDe(id: string): number {
  let x = 2166136261;
  for (let i = 0; i < id.length; i++) { x ^= id.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}

/** Las cinco piezas de las que sale un anuncio, en segunda persona. */
const PIEZAS = [
  { id: 'oferta', et: 'Tu Oferta', padre: 'oferta' },
  { id: 'avatar', et: 'Tu Avatar', padre: 'mercado' },
  { id: 'mensaje', et: 'Tu Mensaje', padre: 'mensaje' },
  { id: 'funnel', et: 'Tu Funnel', padre: 'funnel' },
  { id: 'negocio', et: 'Tu Negocio', padre: 'negocio' },
] as const;

type Nodo = {
  id: string; x: number; y: number; r: number; color: string;
  et?: string; nivel: 1 | 2 | 3; demora: number;
  de?: { x: number; y: number };
  /** Lo que necesita el motor de movimiento, precalculado: las dos fases de la flotación,
   *  cuánto se aleja al nacer, y hacia dónde (el versor desde el centro). */
  faseX: number; faseY: number; amp: number; lejos: number; ux: number; uy: number;
};

const nodos: Nodo[] = [];
{
  let s = 0;                                   // semilla incremental, para el hash
  const nuevo = (n: Omit<Nodo, 'faseX' | 'faseY' | 'amp' | 'lejos' | 'ux' | 'uy'>, amp: number): Nodo => {
    s += 1;
    const hh = hashDe(n.id);
    const dx = n.x - CX;
    const dy = n.y - CY;
    const d = Math.hypot(dx, dy) || 1;
    return {
      ...n, amp,
      faseX: (hh % 6283) / 1000,
      faseY: ((hh >>> 7) % 6283) / 1000,
      // Nace desplazado hacia afuera, como en el grafo real. El rango es el mismo.
      lejos: 260 + (hh % 220),
      ux: dx / d, uy: dy / d,
    };
  };

  const paso = 360 / PIEZAS.length;
  PIEZAS.forEach((p, i) => {
    const ang = i * paso;
    const suyas = AREAS.filter((a) => a.padre === p.padre);
    const color = suyas[0]?.color ?? 'var(--grafo-norte)';
    const x = px(168, ang);
    const y = py(168, ang);
    nodos.push(nuevo({ id: p.id, x, y, r: 15, color, et: p.et, nivel: 1, demora: i * 0.09, de: { x: CX, y: CY } }, 1));

    const abanico = Math.min(30, 14 * suyas.length);
    suyas.forEach((a, j) => {
      const off = suyas.length === 1 ? 0 : -abanico + (2 * abanico * j) / (suyas.length - 1);
      const aAng = ang + off;
      const ax = px(292, aAng);
      const ay = py(292, aAng);
      const iA = nodos.filter((n) => n.nivel === 2).length;
      nodos.push(nuevo({ id: a.id, x: ax, y: ay, r: 9, color: a.color, et: a.nombre, nivel: 2, demora: iA * 0.05, de: { x, y } }, 0.68));

      // NIVEL 3: las partes de cada área y su polvo. Es lo que hace que el final se lea
      // como «lleno de cosas mías» en vez de como un diagrama de cinco cajas — el reclamo
      // del dueño sobre la versión anterior fue exactamente ese: «se siente vacío».
      for (let k = 0; k < 4; k++) {
        const bAng = aAng + (k - 1.5) * 7.2;
        const bR = 372 + az(s + k * 3) * 26;
        const bx = px(bR, bAng);
        const by = py(bR, bAng);
        const iB = nodos.filter((n) => n.nivel === 3).length;
        nodos.push(nuevo({ id: `${a.id}-${k}`, x: bx, y: by, r: 5, color: a.color, nivel: 3, demora: iB * 0.004, de: { x: ax, y: ay } }, 0.42));

        for (let m = 0; m < 3; m++) {
          const cAng = bAng + (m - 1) * 3.1;
          const cR = bR + 48 + az(s + m * 7) * 40;
          const iC = nodos.filter((n) => n.nivel === 3).length;
          nodos.push(nuevo({
            id: `${a.id}-${k}-${m}`, x: px(cR, cAng), y: py(cR, cAng),
            r: 2.6 + az(s + m) * 1.2, color: a.color, nivel: 3, demora: iC * 0.006,
            de: { x: bx, y: by },
          }, 0.28));
        }
      }
    });
  });
}

export function Bienvenida({ adminBar, onComenzar }: {
  /** La barra del modo agencia. Se DIBUJA acá adentro, no se tapa: es la única salida del
   *  modo agencia, y taparla deja al dueño sin forma de volver. Ya pasó en este repo. */
  adminBar?: ReactNode;
  onComenzar: () => void;
}) {
  const [paso, setPaso] = useState(0);
  const [pista, setPista] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const conTexto = paso >= 4;

  // ── El motor de movimiento ────────────────────────────────────────────────
  // Un rAF que escribe el `transform` de cada nodo, igual que Grafo.tsx. No es estado de
  // React a propósito: 192 nodos a 60 fps serían 11.520 renders por segundo.
  const refs = useRef(new Map<string, SVGGElement>());
  /** Cuándo se reveló cada nivel. El reloj de la ENTRADA es por nivel y no global: si
   *  fuera uno solo, cada click volvería a lanzar hacia afuera a los que ya llegaron —
   *  que es exactamente el bug que tiene hoy /second-brain al filtrar. */
  const nacido = useRef<Record<number, number>>({});
  useEffect(() => {
    for (let n = 1; n <= 3; n += 1) {
      if (paso >= n && nacido.current[n] == null) nacido.current[n] = performance.now();
    }
  }, [paso]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Quieto en su lugar definitivo: una pantalla que se mueve sola es justo lo que esa
      // preferencia pide evitar.
      for (const n of nodos) refs.current.get(n.id)?.setAttribute('transform', 'translate(0 0)');
      return;
    }
    let raf = 0;
    const latir = () => {
      const t = performance.now();
      for (const n of nodos) {
        const g = refs.current.get(n.id);
        if (!g) continue;
        // LA FLOTACIÓN: dos senoides de períodos que no son múltiplos entre sí, con la
        // fase derivada del hash del id. Es la firma del movimiento del grafo real.
        const fx = FLOTE * n.amp * Math.sin((t / 7100) * Math.PI * 2 + n.faseX);
        const fy = FLOTE * n.amp * Math.sin((t / 11300) * Math.PI * 2 + n.faseY);
        // LA ENTRADA: nace desplazado hacia afuera y el desvío decae. El reloj arranca
        // cuando se reveló SU nivel, así cada click tiene su propia llegada.
        const t0 = nacido.current[n.nivel];
        let lejos = 0;
        if (t0 == null) lejos = n.lejos;                       // todavía no le tocó
        else {
          const u = Math.min(1, Math.max(0, (t - t0 - n.demora * 1000) / 900));
          lejos = n.lejos * (1 - u) ** 3;
        }
        g.setAttribute('transform', `translate(${(fx + n.ux * lejos).toFixed(2)} ${(fy + n.uy * lejos).toFixed(2)})`);
      }
      raf = requestAnimationFrame(latir);
    };
    raf = requestAnimationFrame(latir);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (paso !== 0) { setPista(false); return; }
    const t = setTimeout(() => setPista(true), MS_PISTA);
    return () => clearTimeout(t);
  }, [paso]);

  useEffect(() => {
    if (paso !== 3) return;
    const t = setTimeout(() => setPaso(4), MS_CIERRE);
    return () => clearTimeout(t);
  }, [paso]);

  // Quien pidió menos movimiento entra al RESULTADO, no al camino. Sin esto el CSS le
  // muestra todo pero el botón queda deshabilitado: una pantalla sin salida.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPaso(4);
  }, []);

  const avanzar = useCallback(() => setPaso((p) => (p < 3 ? p + 1 : p)), []);
  const arrancar = useCallback(() => {
    setSaliendo((s) => { if (!s) onComenzar(); return true; });
  }, [onComenzar]);

  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (!conTexto) { avanzar(); return; }
      if (e.key === 'Enter' || e.key === ' ') arrancar();
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [conTexto, avanzar, arrancar]);

  return (
    <div className={`bv bv-p${paso}${saliendo ? ' bv-fuera' : ''}`}>
      <style>{ESTILOS}</style>

      {/* ⚠️ ARRIBA Y EN FLUJO. La barra es sticky con z-index 100 y esta pantalla era fixed
          con 60: le perdía y tapaba la franja de arriba. Dibujarla acá resuelve las dos
          cosas — no la tapa Y el alto lo resuelve el layout, sin un número que se rompe
          cuando la barra envuelve. El stopPropagation no es opcional: sin él, tocar
          «Salir de la vista» avanza el revelado. */}
      {adminBar && (
        <div style={{ flex: 'none', position: 'relative', zIndex: 6 }}
             onPointerUp={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          {adminBar}
        </div>
      )}

      <div className="bv-lienzo" onClick={() => { if (!conTexto) avanzar(); }}>
        <svg viewBox="0 0 1000 940" className="bv-svg" aria-hidden>
          {nodos.map((n) => (
            n.de ? (
              <line
                key={`l-${n.id}`}
                x1={n.de.x} y1={n.de.y} x2={n.x} y2={n.y}
                stroke={n.color}
                className={`bv-linea bv-n${n.nivel}`}
                style={{ animationDelay: `${n.demora}s` }}
              />
            ) : null
          ))}

          {nodos.map((n) => (
            // La ENTRADA va afuera y la FLOTACIÓN adentro: las dos animan `transform`, y en
            // el mismo elemento la segunda pisa a la primera. Este repo ya lo pagó en
            // /second-brain, donde los nodos «no flotaban»: 0,03 px de recorrido medido.
            <g key={n.id} className={`bv-nodo bv-n${n.nivel}`}
               style={{ animationDelay: `${n.demora}s`, transformOrigin: `${n.x}px ${n.y}px` }}>
              <g ref={(el) => { if (el) refs.current.set(n.id, el); else refs.current.delete(n.id); }}>
                <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} />
                {n.et && (
                  <text x={n.x} y={n.y + n.r + 20} textAnchor="middle" className={`bv-et bv-et${n.nivel}`}>
                    {n.et}
                  </text>
                )}
              </g>
            </g>
          ))}

          <g className="bv-centro">
            <g ref={(el) => { if (el) refs.current.set('centro', el); else refs.current.delete('centro'); }}>
              <circle cx={CX} cy={CY} r={30} fill="var(--mako)" />
              <circle cx={CX} cy={CY} r={30} fill="none" stroke="var(--mako)" className="bv-pulso" />
              <text x={CX} y={CY + 62} textAnchor="middle" className="bv-et bv-et0">Tus anuncios</text>
            </g>
          </g>
        </svg>

        <div className={`bv-pista${pista && paso === 0 ? ' bv-pista-on' : ''}`} aria-live="polite">
          Toca en cualquier lugar
        </div>
      </div>

      <div className="bv-pie">
        <h1 className="bv-titulo">Bienvenido a MaKo</h1>
        <p className="bv-golpe">
          Nunca más vas a tener que adivinar qué hacer para <Maquina activo={conTexto} />
        </p>
        <div className="bv-accion">
          <Button variant="primary" size="lg" full className="bv-boton" onClick={arrancar} disabled={!conTexto}>
            Comenzar
          </Button>
        </div>
      </div>
    </div>
  );
}

/** El final de la frase, escribiéndose y borrándose. Arranca con la primera COMPLETA para
 *  que el HTML del server y el del cliente coincidan. */
function Maquina({ activo }: { activo: boolean }) {
  const [i, setI] = useState(0);
  const [largo, setLargo] = useState(FINALES[0].length);
  const [borrando, setBorrando] = useState(false);
  const [quieto, setQuieto] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setQuieto(true);
  }, []);

  useEffect(() => {
    if (!activo || quieto) return;
    const frase = FINALES[i];
    if (!borrando && largo === frase.length) {
      const t = setTimeout(() => setBorrando(true), MS_QUIETA);
      return () => clearTimeout(t);
    }
    if (borrando && largo === 0) {
      const t = setTimeout(() => { setBorrando(false); setI((x) => (x + 1) % FINALES.length); }, 320);
      return () => clearTimeout(t);
    }
    const base = borrando ? MS_BORRAR : MS_LETRA;
    const t = setTimeout(() => setLargo((l) => l + (borrando ? -1 : 1)), base + Math.random() * MS_JITTER);
    return () => clearTimeout(t);
  }, [activo, quieto, i, largo, borrando]);

  return (
    <span className="bv-maq">
      {FINALES[i].slice(0, largo)}
      {!quieto && <span className="bv-cursor" aria-hidden />}
    </span>
  );
}

// Sin comillas invertidas adentro: el CSS vive en un template literal y una comilla en un
// comentario cierra el string y rompe el build entero. Lo cuida tests/bienvenida.test.ts.
const ESTILOS = `
.bv {
  position: fixed; inset: 0;
  /* 100 le empata a la barra de agencia (sticky, 100) y le gana por orden de DOM. Sigue
     por debajo de los modales, que arrancan en 130. */
  z-index: 100;
  display: flex; flex-direction: column;
  background: #14161B; overflow: hidden;
  animation: bv-in 420ms ease both;
}
.bv-fuera { animation: bv-out 420ms ease both; pointer-events: none; }
@keyframes bv-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes bv-out { from { opacity: 1 } to { opacity: 0 } }

/* ⚠️ EL CHIP DE «TEMA EN PRUEBA» NO VA ACÁ. Es una herramienta del taller de diseño
   (app/_components/TemaCandidato.tsx, z-index 5000, montada en el layout raíz) y se
   dibujaba encima de la primera pantalla que ve un cliente. El dueño: «eso NO debería
   saltar aquí, y mucho menos en un onboarding real». Se apaga mientras la bienvenida está
   arriba, sin tocar el componente: cuando ésta se desmonta, el chip vuelve solo. */
body:has(.bv) [data-chip-tema] { display: none !important; }

/* El lienzo se queda con lo que sobra después de la barra, y el pie va EN FLUJO abajo. Con
   el pie flotando en absolute quedaba un colchón negro enorme entre el mapa y el título —
   «pareciera que eso está mal», y tenía razón: sobre negro un hueco no se lee como aire,
   se lee como error. */
.bv-lienzo {
  flex: 1; min-height: 0; position: relative; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.bv-svg {
  width: min(96vw, 900px); height: 100%; max-height: 100%;
  transition: transform 900ms cubic-bezier(.2,.7,.3,1);
  overflow: visible;
}
.bv-p4 .bv-svg { transform: scale(.82) translateY(-2%); }

/* Todo lo que no es el centro nace apagado y entra cuando le toca su nivel. */
.bv-nodo, .bv-linea { opacity: 0; }
.bv-p1 .bv-nodo.bv-n1, .bv-p2 .bv-nodo.bv-n1, .bv-p3 .bv-nodo.bv-n1, .bv-p4 .bv-nodo.bv-n1,
.bv-p2 .bv-nodo.bv-n2, .bv-p3 .bv-nodo.bv-n2, .bv-p4 .bv-nodo.bv-n2,
.bv-p3 .bv-nodo.bv-n3, .bv-p4 .bv-nodo.bv-n3 { animation: bv-pop 520ms cubic-bezier(.34,1.4,.5,1) both; }
.bv-p1 .bv-linea.bv-n1, .bv-p2 .bv-linea.bv-n1, .bv-p3 .bv-linea.bv-n1, .bv-p4 .bv-linea.bv-n1,
.bv-p2 .bv-linea.bv-n2, .bv-p3 .bv-linea.bv-n2, .bv-p4 .bv-linea.bv-n2,
.bv-p3 .bv-linea.bv-n3, .bv-p4 .bv-linea.bv-n3 { animation: bv-traza 560ms cubic-bezier(.4,0,.2,1) both; }
@keyframes bv-pop { from { opacity: 0; transform: scale(.15) } to { opacity: 1; transform: scale(1) } }

.bv-linea { stroke-width: 1.2; stroke-dasharray: 460; stroke-dashoffset: 460; }
@keyframes bv-traza { to { opacity: .3; stroke-dashoffset: 0 } }
.bv-linea.bv-n3 { stroke-width: .8 }
@keyframes bv-traza-fino { to { opacity: .18; stroke-dashoffset: 0 } }

/* La flotación y la entrada las escribe el rAF sobre el <g> de adentro (ver el motor). Va
   en un elemento PROPIO porque la animación de aparición también toca transform, y dos
   animaciones sobre el mismo transform se pisan: gana la segunda. Este repo ya lo pagó en
   /second-brain, donde los nodos «no flotaban» — 0,03 px de recorrido medidos. */

.bv-centro { animation: bv-centro 900ms cubic-bezier(.34,1.3,.5,1) both; transform-origin: 500px 470px; }
@keyframes bv-centro { from { opacity: 0; transform: scale(.4) } to { opacity: 1; transform: none } }
.bv-pulso { stroke-width: 2; transform-origin: 500px 470px; animation: bv-pulso 3s ease-out infinite; }
@keyframes bv-pulso {
  0%   { transform: scale(1); opacity: .6 }
  100% { transform: scale(2.3); opacity: 0 }
}

.bv-et {
  font-family: ${SANS}; fill: #F3F0E7;
  paint-order: stroke; stroke: #14161B; stroke-width: 4px; stroke-linejoin: round;
}
.bv-et0 { font-size: 26px; font-weight: 600; letter-spacing: -0.02em }
.bv-et1 { font-size: 15px; font-weight: 600 }
.bv-et2 { font-size: 11.5px; font-weight: 500; fill: rgba(243,240,231,.66) }

.bv-pista {
  position: absolute; left: 50%; bottom: 4%; transform: translateX(-50%);
  font-family: ${MONO}; font-size: 12px; letter-spacing: .14em; text-transform: uppercase;
  color: rgba(243,240,231,.32);
  opacity: 0; transition: opacity 900ms ease; pointer-events: none;
}
.bv-pista-on { opacity: 1; animation: bv-respira 2.6s ease-in-out 900ms infinite; }
@keyframes bv-respira { 0%,100% { opacity: .32 } 50% { opacity: .68 } }

/* ── El pie, EN FLUJO y pegado al mapa ───────────────────────────────────── */
.bv-pie {
  flex: none; width: min(96vw, 900px); margin: 0 auto; padding: 0 0 40px;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  cursor: default;
}
.bv-accion { width: min(92vw, 440px); margin-top: 26px; }

.bv-titulo, .bv-golpe { opacity: 0; }
.bv .bv-boton { opacity: 0; }
.bv-p4 .bv-titulo   { animation: bv-sube 700ms cubic-bezier(.2,.7,.3,1) both; animation-delay: 120ms }
.bv-p4 .bv-golpe    { animation: bv-sube 700ms cubic-bezier(.2,.7,.3,1) both; animation-delay: 400ms }
.bv.bv-p4 .bv-boton { animation: bv-sube 700ms cubic-bezier(.2,.7,.3,1) both; animation-delay: 680ms }
@keyframes bv-sube { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: none } }

.bv-titulo {
  font-family: ${SANS}; font-size: clamp(38px, 6vw, 74px); font-weight: 600;
  letter-spacing: -0.04em; line-height: 1; margin: 0 0 16px; color: #F8F6F0;
}
/* UNA SOLA LÍNEA: nowrap más un cuerpo que se adapta al ancho en vez de cortar. Con cuerpo
   fijo se partía en dos justo cuando la parte que se tipea es la más larga — o sea A MITAD
   del tipeo, que es lo peor que puede pasarle a un efecto de escritura. */
.bv-golpe {
  font-family: ${SANS}; font-size: clamp(12px, 1.5vw, 19px); line-height: 1.45;
  color: rgba(243,240,231,.66); margin: 0; white-space: nowrap;
}
.bv-maq { color: #F3F0E7; font-weight: 500; }
.bv-cursor {
  display: inline-block; width: 1.5px; height: 1.05em; margin-left: 2px;
  background: var(--mako); vertical-align: text-bottom;
  animation: bv-cursor 1.1s steps(1) infinite;
}
@keyframes bv-cursor { 0%,55% { opacity: 1 } 56%,100% { opacity: 0 } }

@media (max-width: 700px) {
  .bv-golpe { white-space: normal; font-size: 15px; max-width: 32ch; }
  .bv-titulo { font-size: 32px }
}
@media (max-height: 780px) {
  .bv-titulo { font-size: clamp(30px, 4.4vw, 46px); margin-bottom: 10px }
  .bv-accion { margin-top: 18px }
  .bv-pie { padding-bottom: 24px }
}

@media (prefers-reduced-motion: reduce) {
  .bv-nodo, .bv-linea, .bv-centro, .bv-titulo, .bv-golpe, .bv-boton {
    animation: none !important; opacity: 1 !important; transform: none !important;
  }
  .bv-linea { stroke-dashoffset: 0 !important; opacity: .3 !important; }
  .bv-svg { transition: none !important; }
  .bv-pulso { animation: none !important; opacity: 0 !important; }
}
`;
