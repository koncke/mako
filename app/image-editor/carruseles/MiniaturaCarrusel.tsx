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

import type { CSSProperties } from 'react';
import { ALTO_CARRUSEL, ANCHO_CARRUSEL } from '@/lib/carruseles/documento';

type Obj = Record<string, unknown>;
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const pctX = (v: number) => `${(v / ANCHO_CARRUSEL) * 100}%`;
const pctY = (v: number) => `${(v / ALTO_CARRUSEL) * 100}%`;
const cq = (v: number) => `${(v / ANCHO_CARRUSEL) * 100}cqw`;

function Objeto({ o }: { o: Obj }) {
  const tipo = str(o.type);
  if (tipo === 'textbox') {
    const estilo: CSSProperties = {
      position: 'absolute', left: pctX(num(o.left)), top: pctY(num(o.top)), width: pctX(num(o.width)), margin: 0,
      fontSize: cq(num(o.fontSize, 40)), fontWeight: num(o.fontWeight, 400), fontFamily: str(o.fontFamily, 'inherit'),
      lineHeight: num(o.lineHeight, 1.2), color: str(o.fill, '#111'), textAlign: (str(o.textAlign, 'left') as CSSProperties['textAlign']),
      letterSpacing: `${num(o.charSpacing) / 1000}em`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
    };
    return <p style={estilo}>{str(o.text)}</p>;
  }
  if (tipo === 'rect') {
    return <span style={{ position: 'absolute', left: pctX(num(o.left)), top: pctY(num(o.top)), width: pctX(num(o.width)), height: pctY(num(o.height)), background: str(o.fill), borderRadius: cq(num(o.rx)) }} />;
  }
  if (tipo === 'ellipse') {
    const w = num(o.width); const h = num(o.height);
    return <span style={{ position: 'absolute', left: pctX(num(o.left) - w / 2), top: pctY(num(o.top) - h / 2), width: pctX(w), height: pctY(h), background: str(o.fill), borderRadius: '50%' }} />;
  }
  return null;
}

/** Una página: su fondo y sus objetos, a la proporción del carrusel (4:5). El ancho lo pone quien la monta. */
export function PaginaCarrusel({ pagina, style, etiqueta }: { pagina: Obj; style?: CSSProperties; etiqueta?: string }) {
  const fondo = str((pagina.background as Obj | undefined)?.color, '#fff');
  const objetos = Array.isArray(pagina.objects) ? (pagina.objects as Obj[]) : [];
  return (
    <div role="img" aria-label={etiqueta ?? str(pagina.name, 'Lámina')}
      style={{ position: 'relative', aspectRatio: `${ANCHO_CARRUSEL} / ${ALTO_CARRUSEL}`, containerType: 'inline-size', background: fondo, overflow: 'hidden', borderRadius: 6, ...style }}>
      {objetos.map((o, i) => <Objeto key={str(o.id, String(i))} o={o} />)}
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
