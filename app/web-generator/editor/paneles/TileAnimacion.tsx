'use client';

// =============================================================================
// paneles/TileAnimacion — una tile del panel «Animar»: el nombre debajo de una mini sección que se mueve
// =============================================================================
// Pedido de Martín (14/10/2026): «las dos cosas» (animaciones de página y video de fondo). Decidido el 15/10: cada
// efecto se reproduce solo al pasar el mouse por encima, como en el Image Editor y en Canva.
//
// FUENTE COPIADA: app/image-editor/_doory/editor/panels/AnimateThumb.tsx (la baldosa: el rótulo debajo de la
// imagen, se reproduce con el puntero encima o con foco, quieta con «reducir movimiento», `aria-pressed` la elegida
// y el `title` «<nombre>. Pasa el cursor o enfoca para previsualizar.» de animation/strings.ts `panel.preview`) y la
// ayuda de Canva («To preview an animation, hover your mouse cursor over it», https://www.canva.com/help/animate-designs/).
//
// LO QUE CAMBIA, a propósito: AnimateThumb dibuja en un <canvas> con su propio motor; acá la imagen es una mini
// sección del DOM (`.gm-doc` > `.gm-tarjeta` > `.gm-tarjeta-cuerpo` con barra de título, dos renglones y un botón)
// con los colores del tema de la landing, y se anima con la MISMA hoja que la publicada (css.ts, bloque 16:
// `.gm-doc .gm-tarjeta[data-anim].gm-reproducir`). Lo que se ve en la tile es lo que se publica, sin una segunda
// copia de los efectos. La escena mide 300 × 206 y se achica a un tercio: los efectos están en px (Deslizar mueve
// 48 px), y en una tile de 100 px de verdad se verían el triple de bruscos que en una sección.
// Con «Palabras» y «Máquina de escribir» el título va partido en `span.gm-u` (lo que en la publicada hace el script).
// =============================================================================

import { memo, useEffect, useRef, type CSSProperties } from 'react';
import type { DatosAnimacion } from '@/lib/editor-landing/animaciones';
import { BLOQUES_TILE, PIEZAS_TILE, duracionDeVista, repetirMientras } from '../animacion-reglas';

export type PropsTile = {
  nombre: string;
  datos: DatosAnimacion;
  seleccionada: boolean;
  onElegir: () => void;
  /** Las variables del tema de la landing (`varsDeTema`): la mini sección se pinta con sus colores. */
  vars: CSSProperties;
  /** El sistema pide menos movimiento: la tile no se mueve (y el `title` no invita a previsualizar). */
  quieta: boolean;
};

export const TileAnimacion = memo(function TileAnimacion({ nombre, datos, seleccionada, onElegir, vars, quieta }: PropsTile) {
  const seccion = useRef<HTMLSpanElement>(null);
  const cortar = useRef<(() => void) | null>(null);
  const encima = useRef(false);
  const t = datos['data-anim-texto'];
  const por = t === 'palabra' || t === 'letra' ? t : null;
  const piezas = por ? PIEZAS_TILE[por] : 0;
  const ms = duracionDeVista(datos, BLOQUES_TILE, piezas);
  const vivo = useRef({ ms, quieta });
  vivo.current = { ms, quieta };

  const detener = () => { cortar.current?.(); cortar.current = null; };
  const jugar = () => {
    detener();
    const el = seccion.current;
    if (!el || vivo.current.quieta || vivo.current.ms <= 0) return;
    cortar.current = repetirMientras(el, vivo.current.ms);
  };

  // Si cambia lo que muestra con el mouse encima (otra dirección, «reducir movimiento»), vuelve a empezar.
  const clave = JSON.stringify(datos) + (quieta ? ':quieta' : '');
  useEffect(() => { if (encima.current) jugar(); }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => detener(), []);

  const entrar = () => { encima.current = true; jugar(); };
  const salir = () => { encima.current = false; detener(); };

  return (
    <button
      type="button"
      className="gmp-anim-tile"
      aria-pressed={seleccionada}
      aria-label={nombre}
      title={quieta || ms <= 0 ? nombre : `${nombre}. Pasa el cursor o enfoca para previsualizar.`}
      onClick={onElegir}
      onPointerEnter={entrar}
      onPointerLeave={salir}
      onFocus={entrar}
      onBlur={salir}
    >
      <span className="gmp-anim-ventana" style={vars} aria-hidden="true">
        <span className="gm-doc gmp-anim-escena" data-modo="miniatura">
          <span ref={seccion} className="gm-tarjeta" {...datos}>
            <span className="gm-tarjeta-fondo" />
            <span className="gm-tarjeta-cuerpo">
              <h3 className="gmp-anim-titulo" data-piezas={por ?? undefined}>
                {Array.from({ length: piezas || 3 }, (_, i) => (
                  <span key={i} className={por ? 'gm-u' : undefined} style={por ? ({ '--gm-u': i } as CSSProperties) : undefined} />
                ))}
              </h3>
              <span className="gmp-anim-renglon" />
              <span className="gmp-anim-renglon gmp-anim-renglon-corto" />
              <span className="gmp-anim-boton" />
            </span>
          </span>
        </span>
      </span>
      <span className="gmp-anim-tile-nombre">{nombre}</span>
    </button>
  );
});

export default TileAnimacion;
