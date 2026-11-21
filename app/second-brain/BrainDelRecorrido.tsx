'use client';
// =============================================================================
// EL SECOND BRAIN DEL RECORRIDO: la animación de la maqueta, sobre el grafo de verdad (21/11/2026)
// =============================================================================
// El Cerebro, con la lista de Martín: «La animación de Second Brain al entrar… cópiala en la app, en el paso del recorrido que abre
// Second Brain». Es la de la maqueta aprobada (C:/dev/artefactos-onboarding/cuerpo.html: `brainHtml`, `programarBrain`, `medirBrain`
// y las reglas `.mq-brain`/`.mq-g-*`), con sus tiempos:
//   · se abre el Second Brain de la portada, entero (./brain-del-recorrido.json, en corto de app/vsl/_sitio/cerebro-ejemplo.json);
//   · a los 1,2 s los nodos se apagan DE A POCO, de los de afuera hacia adentro (hasta 1,6 s de demora);
//   · a los 1,9 s quedan la raíz y uno de las áreas por cosa que MaKo sabe, que se acomodan en un círculo alrededor del negocio, y
//     la cámara se acerca; a los 2,7 s aparece lo que sabe (su nombre, su WhatsApp confirmado, cómo llegó, lo que quiere).
// La nota de la maqueta («Por ahora, esto es lo que sé de ti…») no va: lo dice la tarjeta del recorrido (lib/onboarding-v2/recorrido.ts).
//
// DÓNDE: adentro del marco del grafo (`.cbg-marco`, la marca «Lo que MaKo sabe de ti»), por un portal: el grafo lo arma el servidor y
// no recibe hijos. Por DEBAJO de su barra (z-index 3): la flecha de volver es el paso que sigue y se toca.
// CUÁNDO: sólo mientras corre el recorrido. Terminado u omitido, se desvanece y queda el grafo real del negocio.
// SIEMPRE NEGRO, con `data-tema` y el fondo en el MISMO nodo (app/vsl/_sitio/BrainVivo.tsx, cuidado 2: si no, los títulos no se ven).
// Lo prueba tests/brain-del-recorrido.test.ts.
// =============================================================================
import { useEffect, useMemo, useRef, useState, type CSSProperties, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { usePasoDelMotor, useSenal } from '@/app/_ui/tutorial/store';
import { TUTORIAL_RECORRIDO } from '@/lib/onboarding-v2/recorrido';
import { armarBrain, camaraDe, DEMORA_FASE_MS, type Brain, type CerebroCorto, type LoQueSabe } from '@/lib/onboarding-v2/brain-del-recorrido';
import CEREBRO_JSON from './brain-del-recorrido.json';

const CEREBRO = CEREBRO_JSON as unknown as CerebroCorto;
/** El paso del recorrido que marca el grafo («Lo que MaKo sabe de ti»): al volver a él, la animación se repite. */
const I_GRAFO = TUTORIAL_RECORRIDO.pasos.findIndex((p) => p.sel.includes('sb-grafo'));
/** El teléfono de la maqueta (`angosta`). */
const ANGOSTA = 720;
/** Lo que dura el desvanecerse al terminar el recorrido. */
const SALIDA_MS = 450;
/** Cuánto se busca el marco del grafo (llega del servidor) antes de rendirse. */
const BUSCAR_MARCO_MS = 6000;

const CSS = `
.sbr { position: absolute; inset: 0; z-index: 2; overflow: hidden; background: var(--bg); color: var(--ink); border-radius: inherit; transition: opacity .4s ease; }
.sbr[data-saliendo] { opacity: 0; pointer-events: none; }
.sbr > svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.sbr-a { stroke: var(--border-strong); stroke-width: 2; transition: opacity .5s ease; }
.sbr-n { transition: opacity .5s ease; }
.sbr-et { fill: var(--dim); font-family: inherit; font-weight: 600; font-size: 26px; transition: opacity .4s ease; }
.sbr-todo { transition: transform 1.1s cubic-bezier(.16,.84,.34,1) 1.9s; }
.sbr[data-fase="tuyo"] .sbr-todo { transform: translate(var(--dx, 0px), var(--dy, 0px)) scale(var(--s, 1)); }
.sbr[data-fase="tuyo"] .sbr-n:not(.sbr-queda), .sbr[data-fase="tuyo"] .sbr-a { opacity: 0; }
.sbr[data-fase="tuyo"] .sbr-ej { opacity: 0; transition-delay: 1.7s; }
.sbr-tuyo { opacity: 0; transition: opacity .6s ease 2.7s; }
.sbr[data-fase="tuyo"] .sbr-tuyo { opacity: 1; }
.sbr-k { fill: var(--dim); font-family: inherit; font-weight: 500; font-size: calc(12px / (var(--k, .5) * var(--s, 1))); }
.sbr-v { fill: var(--ink); font-family: inherit; font-weight: 650; font-size: calc(14px / (var(--k, .5) * var(--s, 1))); }
.sbr-v--raiz { font-size: calc(16px / (var(--k, .5) * var(--s, 1))); font-weight: 700; }
.sbr-queda:not(.sbr-raiz) { transition: transform 1.1s cubic-bezier(.16,.84,.34,1) 1.9s; }
.sbr[data-fase="tuyo"] .sbr-queda:not(.sbr-raiz) { transform: translate(var(--tx, 0px), var(--ty, 0px)); }
.sbr-queda circle { transition: r .8s ease 1.9s, fill .6s ease 1.9s; }
.sbr[data-fase="tuyo"] .sbr-queda:not(.sbr-raiz) circle { r: calc(9px / (var(--k, .5) * var(--s, 1))); fill: var(--c); }
.sbr[data-fase="tuyo"] .sbr-raiz circle { r: calc(14px / (var(--k, .5) * var(--s, 1))); }
.sbr-lineas line { stroke: var(--border-strong); stroke-width: calc(1.5px / (var(--k, .5) * var(--s, 1))); }
@media (prefers-reduced-motion: reduce) { .sbr, .sbr-n, .sbr-a, .sbr-et, .sbr-todo, .sbr-tuyo, .sbr-queda, .sbr-queda circle { transition: none; } }
`;

type Camara = { k: number; s: number; dy: number };

/** El dibujo (lo lee el test con renderToStaticMarkup). */
export function SvgDelRecorrido({ brain, camara, svgRef }: { brain: Brain; camara?: Camara | null; svgRef?: Ref<SVGSVGElement> }) {
  const { encuadre: e, cx, cy } = brain;
  const varsSvg = (camara ? { '--k': camara.k.toFixed(4), '--s': camara.s.toFixed(3) } : {}) as CSSProperties;
  const varsTodo = { transformOrigin: `${cx}px ${cy}px`, '--dx': `${brain.dx}px`, '--dy': `${(camara ? camara.dy : brain.dy).toFixed(1)}px` } as CSSProperties;
  return (
    <svg ref={svgRef} viewBox={`${e.x} ${e.y} ${e.lado} ${e.lado}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Lo que MaKo sabe de ti" style={varsSvg}>
      <g className="sbr-todo" style={varsTodo}>
        {brain.aristas.map((a, i) => <line key={i} className="sbr-a" x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} style={{ transitionDelay: `${a.demora}s` }} />)}
        <g className="sbr-tuyo sbr-lineas">
          {brain.lineas.map((l, i) => <line key={i} x1={cx} y1={cy} x2={l.x2} y2={l.y2} />)}
        </g>
        {brain.nodos.map((n) => {
          const clase = ['sbr-n', n.queda && 'sbr-queda', n.esRaiz && 'sbr-raiz'].filter(Boolean).join(' ');
          const estilo = (n.tx != null
            ? { '--tx': `${(n.tx - n.x).toFixed(1)}px`, '--ty': `${((n.ty ?? n.y) - n.y).toFixed(1)}px`, '--c': `var(--grafo-${n.area})` }
            : n.demora != null ? { transitionDelay: `${n.demora}s` } : undefined) as CSSProperties | undefined;
          return (
            <g key={n.id} className={clase} style={estilo}>
              <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} />
              {n.etiqueta != null && <text className={`sbr-et${n.queda ? ' sbr-ej' : ''}`} x={n.x} y={n.y + n.r + 30} textAnchor="middle">{n.etiqueta}</text>}
              {n.esRaiz && (
                <g className="sbr-tuyo"><text className="sbr-v sbr-v--raiz" x={n.x} y={n.y} dy="1.25em" textAnchor="middle" dominantBaseline="hanging">{brain.negocio}</text></g>
              )}
              {n.k != null && (
                <g className="sbr-tuyo">
                  <text className="sbr-k" x={n.x} y={n.y} dy="1.35em" textAnchor="middle" dominantBaseline="hanging">{n.k}</text>
                  <text className="sbr-v" x={n.x} y={n.y} textAnchor="middle" dominantBaseline="hanging">
                    {(n.v ?? []).map((l, i) => <tspan key={i} x={n.x} dy={i ? '1.2em' : '2.45em'}>{l}</tspan>)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** La capa: se monta en la vista del grafo (ChatSecondBrain.tsx) y se ve sólo mientras corre el recorrido. */
export function BrainDelRecorrido({ sabe }: { sabe: LoQueSabe }) {
  const senal = useSenal();
  const corre = senal?.tipo === 'tutorial' && senal.tutorial === TUTORIAL_RECORRIDO;
  const [marco, setMarco] = useState<Element | null>(null);
  const [puesta, setPuesta] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [fase, setFase] = useState<'todo' | 'tuyo'>('todo');
  const [angosta, setAngosta] = useState(false);
  const [camara, setCamara] = useState<Camara | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const brain = useMemo(() => armarBrain(CEREBRO, sabe, { angosta }), [sabe, angosta]);

  // El marco del grafo: llega del servidor, puede tardar un poco más que esta capa.
  useEffect(() => {
    if (!corre) return;
    const desde = Date.now();
    let t = 0;
    const buscar = () => {
      const m = document.querySelector('.cbg-marco');
      if (m) { setMarco(m); return; }
      if (Date.now() - desde < BUSCAR_MARCO_MS) t = window.setTimeout(buscar, 100);
    };
    buscar();
    return () => window.clearTimeout(t);
  }, [corre]);

  // Con el recorrido y el marco, se pone; sin el recorrido, se desvanece y se saca.
  useEffect(() => {
    if (corre && marco) { setPuesta(true); setSaliendo(false); return; }
    if (!puesta) return;
    setSaliendo(true);
    const t = window.setTimeout(() => { setPuesta(false); setSaliendo(false); setFase('todo'); }, SALIDA_MS);
    return () => window.clearTimeout(t);
  }, [corre, marco, puesta]);

  // Al ponerse, arranca directo (21/11: sin el cuadro quieto de antes). Y SE REPITE cada vez que el recorrido vuelve al paso del grafo
  // (21/11, Martín: «quise ir de vuelta para atrás en el paso del second brain para repetir la animación»): vuelve al cuadro de partida.
  const pasoMotor = usePasoDelMotor();
  const enElGrafo = corre && pasoMotor === I_GRAFO;
  const [vuelta, setVuelta] = useState(0);
  const estabaEnElGrafo = useRef(enElGrafo);
  useEffect(() => {
    if (enElGrafo && !estabaEnElGrafo.current) { setFase('todo'); setVuelta((n) => n + 1); }
    estabaEnElGrafo.current = enElGrafo;
  }, [enElGrafo]);
  useEffect(() => {
    if (!puesta) return;
    const t = window.setTimeout(() => setFase('tuyo'), DEMORA_FASE_MS);
    return () => window.clearTimeout(t);
  }, [puesta, vuelta]);

  // La cámara, con el tamaño del lienzo.
  useEffect(() => {
    const svg = svgRef.current;
    if (!puesta || !svg) return;
    const medir = () => {
      const ang = window.innerWidth <= ANGOSTA;
      setAngosta(ang);
      setCamara(camaraDe(svg.clientWidth, svg.clientHeight, brain, ang));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [puesta, brain]);

  if (!puesta || !marco) return null;
  return createPortal(
    <div className="sbr" data-tema="oscuro" data-fase={fase} {...(saliendo ? { 'data-saliendo': '' } : {})}>
      <style>{CSS}</style>
      <SvgDelRecorrido brain={brain} camara={camara} svgRef={svgRef} />
    </div>,
    marco,
  );
}
