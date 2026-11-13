'use client';

// =============================================================================
// MiniaturaCarrusel — una página de un carrusel de MaKo, dibujada desde SU documento (lib/carruseles/documento.ts)
// =============================================================================
// La regla de Martín (29/10): «las miniaturas reflejan lo que se va a crear, nunca en blanco». Por eso no hay una imagen
// aparte: se dibuja el MISMO documento que abre el editor (los `textbox`, `rect` y `ellipse` que arma `documentoDeCarrusel`),
// con sus posiciones y tamaños en proporción, medidos contra el ancho de la página (`cqw`). Sirve para la tarjeta de
// «Nuevo diseño» (la portada, con las otras láminas asomando detrás) y para «Ver ejemplo» (todas, una al lado de la otra).
//
// Sólo entiende lo que arma `documentoDeCarrusel`; un documento de otra plantilla no pasa por acá.
// =============================================================================

import type { CSSProperties, ReactNode } from 'react';
import { ALTO_CARRUSEL, ANCHO_CARRUSEL } from '@/lib/carruseles/documento';

type Obj = Record<string, unknown>;
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

/**
 * El texto con sus palabras de acento en su color (fabric: `styles[renglón][letra]`, contando los renglones del texto y las
 * letras como `Array.from`, igual que `estilosDeAcento` en lib/carruseles/replica.ts). Sin estilos, el texto tal cual.
 */
export function conSusColores(texto: string, styles: unknown): ReactNode {
  if (!styles || typeof styles !== 'object' || Array.isArray(styles)) return texto;
  const porRenglon = styles as Record<string, Record<string, { fill?: unknown } | undefined> | undefined>;
  return texto.split('\n').flatMap((renglon, i) => {
    const tramos: Array<{ t: string; color?: string }> = [];
    Array.from(renglon).forEach((letra, k) => {
      const fill = porRenglon[i]?.[k]?.fill;
      const color = typeof fill === 'string' ? fill : undefined;
      const ultimo = tramos[tramos.length - 1];
      if (ultimo && ultimo.color === color) ultimo.t += letra;
      else tramos.push({ t: letra, color });
    });
    const nodos: ReactNode[] = tramos.map((x, k) => (x.color ? <span key={`${i}-${k}`} style={{ color: x.color }}>{x.t}</span> : x.t));
    return i ? ['\n', ...nodos] : nodos;
  });
}

/**
 * El fondo de una página: su color, o la IMAGEN de una réplica fiel (la lámina original sin sus letras, lib/carruseles/replica.ts
 * → `laminaFiel`). 13/11/2026: sin ella, «Tu versión está lista» mostraba las láminas en blanco con los textos sueltos encima,
 * y el editor, bien: lo primero que se ve no era lo que se iba a abrir.
 */
export function fondoDePagina(fondo: unknown): CSSProperties {
  const f = fondo && typeof fondo === 'object' ? (fondo as Obj) : {};
  const src = str(f.src);
  if (f.type === 'image' && /^(https:\/\/|data:image\/)/.test(src)) {
    return { backgroundColor: str(f.color, '#fff'), backgroundImage: `url(${JSON.stringify(src)})`, backgroundSize: f.fit === 'contain' ? 'contain' : 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' };
  }
  return { background: str(f.color, '#fff') };
}

function Objeto({ o, alto, ancho = ANCHO_CARRUSEL }: { o: Obj; alto: number; ancho?: number }) {
  const pctX = (v: number) => `${(v / ancho) * 100}%`;
  const cq = (v: number) => `${(v / ancho) * 100}cqw`;
  const pctY = (v: number) => `${(v / alto) * 100}%`;
  const tipo = str(o.type);
  if (tipo === 'textbox') {
    const estilo: CSSProperties = {
      position: 'absolute', left: pctX(num(o.left)), top: pctY(num(o.top)), width: pctX(num(o.width)), margin: 0,
      fontSize: cq(num(o.fontSize, 40)), fontWeight: num(o.fontWeight, 400), fontFamily: str(o.fontFamily, 'inherit'),
      lineHeight: num(o.lineHeight, 1.2), color: str(o.fill, '#111'), textAlign: (str(o.textAlign, 'left') as CSSProperties['textAlign']),
      letterSpacing: `${num(o.charSpacing) / 1000}em`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
    };
    return <p style={estilo}>{conSusColores(str(o.text), o.styles)}</p>;
  }
  if (tipo === 'rect') {
    // Con su borde (el lugar marcado de la persona en una réplica fiel va punteado).
    const borde = str(o.stroke) && num(o.strokeWidth) > 0
      ? { border: `${cq(num(o.strokeWidth))} ${Array.isArray(o.strokeDashArray) && o.strokeDashArray.length ? 'dashed' : 'solid'} ${str(o.stroke)}`, boxSizing: 'border-box' as const }
      : {};
    return <span style={{ position: 'absolute', left: pctX(num(o.left)), top: pctY(num(o.top)), width: pctX(num(o.width)), height: pctY(num(o.height)), background: str(o.fill), borderRadius: cq(num(o.rx)), ...borde }} />;
  }
  if (tipo === 'ellipse') {
    const w = num(o.width); const h = num(o.height);
    return <span style={{ position: 'absolute', left: pctX(num(o.left) - w / 2), top: pctY(num(o.top) - h / 2), width: pctX(w), height: pctY(h), background: str(o.fill), borderRadius: '50%' }} />;
  }
  if (tipo === 'image' && /^https:\/\//.test(str(o.src))) {
    // La foto del cliente en una réplica (lib/carruseles/replica.ts): cubre su lugar como en el editor (sin deformarse).
    const w = num(o.width) * num(o.scaleX, 1); const h = num(o.height) * num(o.scaleY, 1);
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={str(o.src)} alt="" style={{ position: 'absolute', left: pctX(num(o.left)), top: pctY(num(o.top)), width: pctX(w), height: pctY(h), objectFit: 'cover', objectPosition: '50% 25%' }} />;
  }
  return null;
}

/**
 * Una página: su fondo y sus objetos, a la proporción del carrusel (4:5, o la que diga `alto`: una réplica de un anuncio
 * cuadrado es 1080 × 1080). El ancho lo pone quien la monta.
 */
export function PaginaCarrusel({ pagina, style, etiqueta, alto = ALTO_CARRUSEL, ancho = ANCHO_CARRUSEL }: { pagina: Obj; style?: CSSProperties; etiqueta?: string; alto?: number; ancho?: number }) {
  const objetos = Array.isArray(pagina.objects) ? (pagina.objects as Obj[]) : [];
  return (
    <div role="img" aria-label={etiqueta ?? str(pagina.name, 'Lámina')}
      style={{ position: 'relative', aspectRatio: `${ancho} / ${alto}`, containerType: 'inline-size', ...fondoDePagina(pagina.background), overflow: 'hidden', borderRadius: 6, ...style }}>
      {objetos.map((o, i) => <Objeto key={str(o.id, String(i))} o={o} alto={alto} ancho={ancho} />)}
    </div>
  );
}

/**
 * La miniatura de la tarjeta: la portada, centrada en la caja 4:3 de la tarjeta, con dos láminas asomando detrás (se lee
 * como «varias páginas» sin un número de más). Va un poco abajo (19 % arriba): la franja de arriba es de las marcas de la
 * tarjeta (las láminas a la izquierda, «Ver ejemplo» a la derecha), que no pueden tapar la cabecera de la portada.
 */
export function MiniaturaCarrusel({ doc, nombre }: { doc: Record<string, unknown>; nombre: string }) {
  const paginas = Array.isArray(doc.pages) ? (doc.pages as Obj[]) : [];
  const [primera, segunda, tercera] = paginas;
  if (!primera) return null;
  const capa = (p: Obj | undefined, dx: number, z: number, op: number) => p ? (
    <PaginaCarrusel pagina={p} etiqueta="" style={{ position: 'absolute', height: '76%', top: '19%', left: '50%', transform: `translateX(calc(-50% + ${dx}%)) scale(${1 - z * 0.04})`, opacity: op, boxShadow: '0 4px 14px -6px rgba(0,0,0,.35)', zIndex: 3 - z }} />
  ) : null;
  return (
    // `zIndex: 0`: las láminas apiladas (z 1 a 3) quedan adentro, debajo de las marcas y del «Usar plantilla» de la tarjeta.
    <span style={{ position: 'absolute', inset: 0, zIndex: 0 }} aria-label={`${nombre}: portada`} role="img">
      {capa(tercera, 26, 2, 0.55)}
      {capa(segunda, 13, 1, 0.8)}
      {capa(primera, 0, 0, 1)}
    </span>
  );
}
