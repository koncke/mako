'use client';

// =============================================================================
// Marca — lo que se dibuja en el redondel de una cosa
// =============================================================================
// Una marca es UNA pregunta con tres respuestas posibles y un respaldo, y la
// regla de precedencia vive acá y en ningún otro lado:
//
//     icono (foto)  →  icono (del catálogo)  →  emoji  →  las iniciales
//
// ⚠️ ESTA PRECEDENCIA ES CÓDIGO Y NO PROSA, y por eso existe este archivo. Los
// mismos cuatro casos los dibujan la ficha del cliente, el detalle de un
// proyecto, la card de la grilla y el modal de «MaKo cargó»: cuatro copias de un
// `if` encadenado es cómo tres de ellas se quedan viejas el día que se agregue un
// caso. Ya pasó en este repo con el `Avatar`, que existe tres veces y se ve
// distinto según quién lo monte.
//
// ⚠️ Y `emoji` NUNCA GUARDA UNA URL. La columna `emoji` la leen como TEXTO el
// prompt de extracción de reuniones, el export a Markdown, el CSV, los
// desplegables y la API de MaKo; lo que se elige en el selector nuevo va a
// `icono`, que es una columna aparte (mig 0174). Acá se leen las dos y la
// pantalla decide; los consumidores de texto siguen leyendo un glifo.

import { esFoto, urlPortada, glifoDeIcono } from '@/lib/portadas';
import { urlIcono, esIcono } from '@/lib/iconos-catalogo';

const inicialesDe = (nombre: string) =>
  nombre.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

export function Marca({ icono, emoji, nombre = '', tam = 40, y, color, cuadrado = false, sinFondo = false }: {
  /** La columna `icono` (mig 0174): una URL del bucket o `icon:<set>:<nombre>`. */
  icono?: string | null;
  /** La columna `emoji`: un glifo. Es el respaldo de un proyecto. */
  emoji?: string | null;
  /** Para las iniciales, que son el respaldo de un cliente. */
  nombre?: string;
  tam?: number;
  /** El encuadre de la foto dentro del redondel, 0-100 (mig 0174). */
  y?: number | null;
  /** El color de la entidad: tiñe el fondo y las iniciales. */
  color?: string;
  /** Esquinas suaves en vez de círculo: es lo que usan los proyectos. */
  cuadrado?: boolean;
  /** Sin caja detrás: para cuando ya hay una superficie que lo contiene. */
  sinFondo?: boolean;
}) {
  const c = color ?? 'var(--primary)';
  const radio = cuadrado ? Math.round(tam * 0.26) : 999;
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
    width: tam, height: tam, borderRadius: radio, overflow: 'hidden',
    background: sinFondo ? 'transparent' : `color-mix(in srgb, ${c} 16%, var(--surface))`,
    color: c, fontWeight: 700, letterSpacing: '.02em', fontSize: Math.round(tam * 0.36),
    lineHeight: 1,
  };

  const foto = urlPortada(icono);
  if (foto) {
    return (
      <span aria-hidden style={base}>
        {/* Sin `next/image`: la foto vive en el bucket público y el optimizador la
            volvería a servir por nuestra función, cobrando por cada tarjeta. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foto} alt="" draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `center ${y ?? 50}%` }} />
      </span>
    );
  }

  if (esIcono(icono)) {
    // El color va por query: son SVG monocromos servidos con el `stroke` cableado,
    // así que no hay `currentColor` posible — es un `img`, no un SVG inline.
    const url = urlIcono(icono, { color: c, tam: Math.round(tam * 0.56) });
    return (
      <span aria-hidden style={base}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt="" width={Math.round(tam * 0.56)} height={Math.round(tam * 0.56)} /> : null}
      </span>
    );
  }

  // El glifo puede venir en `icono` (un cliente, que no tiene columna `emoji`) o en
  // `emoji` (un proyecto, que sí la tiene). El porqué, en `glifoDeIcono`.
  const glifo = glifoDeIcono(icono) ?? (emoji ?? '').trim();
  if (glifo) {
    // ⚠️ UN EMOJI NO LLEVA EL COLOR DE LA ENTIDAD: ya tiene el suyo. Teñirlo con
    // `color` no hace nada en la mayoría de las fuentes y sí rompe los pocos
    // glifos monocromos, que quedarían del color del proyecto sin que nadie lo
    // pidiera. Va al tamaño del redondel y nada más.
    return <span aria-hidden style={{ ...base, color: undefined, fontSize: Math.round(tam * 0.55) }}>{glifo}</span>;
  }

  return <span aria-hidden title={nombre} style={base}>{inicialesDe(nombre)}</span>;
}

/** ¿Hay algo elegido? Lo usa quien decide si dibujar «Quitar». */
export const hayMarca = (icono?: string | null, emoji?: string | null): boolean =>
  esFoto(icono) || esIcono(icono) || !!glifoDeIcono(icono) || !!(emoji ?? '').trim();
