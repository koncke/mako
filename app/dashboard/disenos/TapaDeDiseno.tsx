'use client';

// =============================================================================
// TapaDeDiseno — la tapa de un bloque de diseño editando, y el campo para cambiar un texto de la tarjeta (9/11/2026)
// =============================================================================
// Editando, una tapa transparente toma el clic del bloque (./EditorInforme.tsx): elegirlo no abre lo que la tarjeta abre y
// arrastrar lo mueve. Martín (9/11/2026, «no son editables»): los textos de la tarjeta no se podían cambiar. Desde ese día,
// DOS TOQUES sobre un texto abren un campo encima, del tamaño y la letra del texto; Enter (o salir del campo) lo guarda en el
// bloque (`Elemento.diseno.textos`, lib/disenos-textos.ts) y Escape lo deja como estaba. Vaciarlo vuelve al texto del diseño.
// =============================================================================

import { useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { TOPE_TEXTO_NUEVO, type TextosDeBloque } from '@/lib/disenos-textos';
import { textoEnPunto } from './textos-de-bloque';

type Abierto = { original: string; valor: string; estilo: CSSProperties };

export function TapaDeDiseno({ textos, onTexto }: { textos?: TextosDeBloque; onTexto: (original: string, nuevo: string) => void }) {
  const tapa = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState<Abierto | null>(null);
  const cerrado = useRef(false);

  const alDobleClic = (ev: ReactMouseEvent<HTMLDivElement>) => {
    const comp = tapa.current?.parentElement;
    const raiz = comp?.querySelector<HTMLElement>('.lk-diseno');
    if (!comp || !raiz) return;
    const t = textoEnPunto(raiz, ev.clientX, ev.clientY, tapa.current);
    if (!t) return;
    ev.stopPropagation();
    ev.preventDefault();
    const base = comp.getBoundingClientRect();
    // La letra del texto tocado: el campo se ve como el texto, no como un formulario.
    const el = raiz.ownerDocument.elementsFromPoint(t.caja.left + 1, t.caja.top + t.caja.height / 2).find((x) => raiz.contains(x)) as HTMLElement | undefined;
    const cs = el ? getComputedStyle(el) : null;
    const ancho = Math.min(Math.max(t.caja.width + 28, 140), base.width - 8);
    const izq = Math.min(Math.max(t.caja.left - base.left - 6, 4), base.width - ancho - 4);
    cerrado.current = false;
    setAbierto({
      original: t.original,
      valor: textos?.[t.original] ?? t.original,
      estilo: {
        left: izq, top: Math.max(t.caja.top - base.top - 4, 2), width: ancho, height: Math.max(t.caja.height + 8, 28),
        fontSize: cs?.fontSize, fontWeight: cs?.fontWeight as CSSProperties['fontWeight'], fontFamily: cs?.fontFamily, letterSpacing: cs?.letterSpacing,
      },
    });
  };

  const guardar = () => {
    if (!abierto || cerrado.current) return;
    cerrado.current = true;
    const nuevo = abierto.valor.trim();
    const antes = textos?.[abierto.original] ?? abierto.original;
    if (nuevo !== antes) onTexto(abierto.original, nuevo);
    setAbierto(null);
  };
  const cancelar = () => { cerrado.current = true; setAbierto(null); };
  const parar = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <>
      <div ref={tapa} className="lk-diseno-tapa" aria-hidden onDoubleClick={alDobleClic} title="Dos toques sobre un texto para cambiarlo" />
      {abierto && (
        <input
          className="lk-diseno-texto lk-no-arrastrar" autoFocus value={abierto.valor} maxLength={TOPE_TEXTO_NUEVO} style={abierto.estilo}
          aria-label={`Cambiar «${abierto.original}»`} placeholder={abierto.original}
          onChange={(e) => setAbierto({ ...abierto, valor: e.target.value })}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); guardar(); }
            else if (e.key === 'Escape') { e.preventDefault(); cancelar(); }
          }}
          onBlur={guardar} onPointerDown={parar} onMouseDown={parar} onClick={parar} onDoubleClick={parar}
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
    </>
  );
}
