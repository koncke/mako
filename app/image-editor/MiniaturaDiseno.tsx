'use client';
// =============================================================================
// MiniaturaDiseno — un documento del Image Editor dibujado en SVG, sin el motor (6/11/2026)
// =============================================================================
// Para la tarjeta de «Nuevo diseño» y para «Ver ejemplo» de las plantillas reales (lib/image-editor/plantillas-reales.ts):
// la tarjeta muestra lo que se va a crear (la ESTRUCTURA) y «Ver ejemplo», la misma composición llena. Dibuja lo que esas
// plantillas usan (`textbox`, `rect`, `ellipse`, `path`, el marco vacío de una foto, fondos lisos y degradados) y NO carga
// Fabric: el motor del editor es sólo del editor (la pantalla de «Nuevo diseño» no lo trae).
// Lo que no sabe dibujar (una imagen, un grupo), lo deja como un marco gris: es una miniatura, no el render.
// Las fuentes de los textos se piden al catálogo del editor (../mako/fuentes.ts, el mismo jsDelivr) y se suman a
// `document.fonts` una vez por familia y peso: sin ellas, «Anton 260» cae a la del sistema y el texto se sale del marco.
// =============================================================================

import { useEffect, useId } from 'react';
import { FUENTES } from './mako/fuentes';

type Obj = Record<string, unknown>;
type Pagina = { background?: Obj; objects?: Obj[] };
/** Cualquier documento del editor (un `DoryDocument` o el JSON guardado): se lee con cuidado, campo por campo. */
type Doc = { width: number; height: number; pages: readonly object[] };
const paginasDe = (doc: Doc) => (Array.isArray(doc.pages) ? doc.pages : []) as Pagina[];

const num = (x: unknown, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
const str = (x: unknown, d = '') => (typeof x === 'string' ? x : d);

function giro(o: Obj): string | undefined {
  const a = num(o.angle);
  return a ? `rotate(${a} ${num(o.left)} ${num(o.top)})` : undefined;
}

/** Arriba a la izquierda de un objeto, según su origen (Fabric guarda `left`/`top` del punto de origen). */
function esquina(o: Obj, w: number, h: number): { x: number; y: number } {
  const x = num(o.left) - (o.originX === 'center' ? w / 2 : o.originX === 'right' ? w : 0);
  const y = num(o.top) - (o.originY === 'center' ? h / 2 : o.originY === 'bottom' ? h : 0);
  return { x, y };
}

function Objeto({ o, pagina }: { o: Obj; pagina: { w: number; h: number } }) {
  const w = num(o.width, 0) * Math.abs(num(o.scaleX, 1));
  const h = num(o.height, 0) * Math.abs(num(o.scaleY, 1));
  const { x, y } = esquina(o, w, h);
  const t = giro(o);
  const opacidad = num(o.opacity, 1);
  const stroke = typeof o.stroke === 'string' && num(o.strokeWidth) > 0 && o.type !== 'textbox' ? o.stroke : undefined;
  if (o.type === 'textbox') {
    return (
      // Como Fabric: una palabra más ancha que la caja no se parte, se sale (el motor ensancha la caja). Por eso el
      // `foreignObject` deja ver lo que se sale y el texto no lleva `overflowWrap`.
      <foreignObject x={x} y={y} width={Math.max(1, w)} height={Math.max(h, num(o.fontSize, 20) * 1.4) + 4} transform={t} opacity={opacidad} overflow="visible" style={{ overflow: 'visible' }}>
        <div style={{
          fontFamily: str(o.fontFamily, 'sans-serif'), fontSize: num(o.fontSize, 20), fontWeight: num(o.fontWeight, 400) as number,
          fontStyle: str(o.fontStyle, 'normal'), lineHeight: num(o.lineHeight, 1.2), textAlign: str(o.textAlign, 'left') as 'left',
          color: str(o.fill, '#111'), textDecoration: o.linethrough ? 'line-through' : undefined, whiteSpace: 'pre-wrap',
          letterSpacing: `${num(o.charSpacing) / 1000}em`, background: str(o.textBackgroundColor) || undefined,
        }}>{str(o.text)}</div>
      </foreignObject>
    );
  }
  if (o.type === 'rect' && o.isPlaceholder) {
    const grande = w * h > pagina.w * pagina.h * 0.5;
    const fs = Math.max(14, Math.min(w, h) / (grande ? 16 : 9));
    return (
      <g transform={t} opacity={opacidad}>
        <rect x={x} y={y} width={w} height={h} rx={num(o.maskRadius, num(o.rx))} fill="#E9E6E1" />
        {/* En un marco que ocupa casi toda la página, el rótulo va abajo a la derecha y tenue: en el medio pisaría los
            textos y arriba, la etiqueta de la pieza (medido en las 9 plantillas reales). */}
        <text x={grande ? x + w - fs * 0.6 : x + w / 2} y={grande ? y + h - fs * 0.8 : y + h / 2} opacity={grande ? 0.6 : 1}
          textAnchor={grande ? 'end' : 'middle'} dominantBaseline="middle" fontSize={fs} fill="#8C857C" fontFamily="sans-serif">Tu foto</text>
      </g>
    );
  }
  if (o.type === 'rect') {
    return <rect x={x} y={y} width={w} height={h} rx={num(o.rx)} ry={num(o.ry)} fill={str(o.fill, 'none') || 'none'} stroke={stroke} strokeWidth={stroke ? num(o.strokeWidth) : undefined} transform={t} opacity={opacidad} />;
  }
  if (o.type === 'ellipse') {
    const rx = num(o.rx) * Math.abs(num(o.scaleX, 1));
    const ry = num(o.ry) * Math.abs(num(o.scaleY, 1));
    // El centro sale de su origen con el ancho de la elipse (2 rx), aunque no traiga `width`.
    const c = esquina(o, rx * 2, ry * 2);
    return <ellipse cx={c.x + rx} cy={c.y + ry} rx={rx} ry={ry} fill={str(o.fill, 'none') || 'none'} stroke={stroke} strokeWidth={stroke ? num(o.strokeWidth) : undefined} transform={t} opacity={opacidad} />;
  }
  if (o.type === 'path' && Array.isArray(o.path)) {
    // Las plantillas guardan el camino en las coordenadas de la página (lib/image-editor/plantillas-reales.ts).
    const d = (o.path as unknown[]).map((c) => (Array.isArray(c) ? c.join(' ') : '')).join(' ');
    return <path d={d} fill={str(o.fill) || 'none'} stroke={str(o.stroke) || undefined} strokeWidth={num(o.strokeWidth) || undefined} strokeLinecap="round" strokeLinejoin="round" transform={t} opacity={opacidad} />;
  }
  if (w > 0 && h > 0) return <rect x={x} y={y} width={w} height={h} fill="#E9E6E1" transform={t} />;
  return null;
}

/** El fondo de una página: liso o degradado (una foto de fondo, gris). */
function Fondo({ fondo, w, h, idGrad }: { fondo?: Obj; w: number; h: number; idGrad: string }) {
  if (fondo?.type === 'gradient' && Array.isArray(fondo.stops)) {
    const a = (num(fondo.angle, 180) - 90) * (Math.PI / 180);
    const x2 = 0.5 + Math.cos(a) / 2; const y2 = 0.5 + Math.sin(a) / 2;
    return (
      <>
        <defs>
          <linearGradient id={idGrad} x1={1 - x2} y1={1 - y2} x2={x2} y2={y2}>
            {(fondo.stops as Obj[]).map((s, i) => <stop key={i} offset={num(s.offset)} stopColor={str(s.color, '#fff')} />)}
          </linearGradient>
        </defs>
        <rect width={w} height={h} fill={`url(#${idGrad})`} />
      </>
    );
  }
  const color = fondo?.type === 'solid' ? str(fondo.color, '#fff') : fondo?.type === 'image' ? '#D9D4CC' : '#fff';
  return <rect width={w} height={h} fill={color} />;
}

const pedidas = new Set<string>();

/** La familia que se pide: la primera de la pila CSS que guarda el motor («"Anton", sans-serif» → «Anton»). */
export function familiaPrincipal(pila: unknown): string {
  return str(pila).split(',')[0].trim().replace(/^["']|["']$/g, '');
}

/** Pide las fuentes que usan los textos de las páginas (una vez por familia, peso y estilo, para toda la pestaña). */
function pedirFuentes(doc: Doc): void {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return;
  for (const p of paginasDe(doc)) {
    for (const o of p.objects ?? []) {
      if (o.type !== 'textbox') continue;
      const familia = familiaPrincipal(o.fontFamily);
      const peso = num(o.fontWeight, 400);
      const estilo = o.fontStyle === 'italic' ? 'italic' : 'normal';
      const clave = `${familia}|${peso}|${estilo}`;
      if (!familia || pedidas.has(clave)) continue;
      pedidas.add(clave);
      const v = FUENTES.find((f) => f.family === familia)?.variants.find((x) => x.weight === peso && x.style === estilo);
      if (!v) continue;
      const cara = new FontFace(familia, `url(${v.url})`, { weight: String(peso), style: estilo });
      cara.load().then((c) => document.fonts.add(c)).catch(() => { pedidas.delete(clave); });
    }
  }
}

/** La miniatura de la tarjeta de «Nuevo diseño»: la primera página, centrada debajo de la franja de las marcas. */
export function MiniaturaTarjetaDiseno({ doc, nombre }: { doc: Doc; nombre: string }) {
  return (
    // `zIndex: 0`: la página queda debajo de las marcas y del «Usar plantilla» de la tarjeta (como los carruseles).
    <span style={{ position: 'absolute', inset: '17% 7% 5%', zIndex: 0, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.28))' }}>
      <MiniaturaDiseno doc={doc} titulo={`${nombre}: lo que se crea`} />
    </span>
  );
}

export function MiniaturaDiseno({ doc, pagina = 0, className, titulo }: { doc: Doc; pagina?: number; className?: string; titulo?: string }) {
  const idGrad = useId().replace(/:/g, '');
  useEffect(() => { pedirFuentes(doc); }, [doc]);
  const w = num(doc.width, 1080);
  const h = num(doc.height, 1080);
  const paginas = paginasDe(doc);
  const p = paginas[Math.min(Math.max(0, pagina), paginas.length - 1)];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} role="img" aria-label={titulo ?? 'Diseño'} preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', width: '100%', height: '100%' }}>
      <Fondo fondo={p?.background} w={w} h={h} idGrad={idGrad} />
      {(p?.objects ?? []).map((o, i) => <Objeto key={str(o.id, String(i))} o={o} pagina={{ w, h }} />)}
    </svg>
  );
}
