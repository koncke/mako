'use client';

// =============================================================================
// Senalar — oscurece la pantalla menos UN elemento, y deja tocarlo
// =============================================================================
// Pedido de Martín (13/10/2026), sobre «solucionar» un dato sin marcar: «me tiene que redirigir
// al dato que falta, ya sea cambiando de tab o desplazando a donde está el dato. Y una vez
// desplazado a donde está el dato, debería ponerse todo opaco y marcarse donde falta, como lo
// hacemos con los tutoriales que creamos en MaKo».
//
// Es el MISMO dibujo que el tutorial (app/_ui/Recorrido.tsx: el velo sale de --sidebar, el
// recorte con su latido), con una diferencia que decide todo: acá la persona tiene que poder
// COMPLETAR el dato, así que la capa no recibe un solo clic (`pointer-events: none`) y se va
// sola con el primer toque o tecla. El tutorial bloquea porque explica; esto señala y se aparta.
//
// Busca el objetivo por `data-recorrido` (la marca del tutorial). Si no aparece en ~1,5 s —la
// tab no lo dibuja, o el dato no tiene campo en la ficha— llama a `onNoEsta` y no pinta nada:
// nunca se oscurece la pantalla para señalar la nada.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCapaModal } from '@/app/_components/pila-modales';
import { necesitaScroll, recorteDe, selectorDe, type Caja } from '@/lib/recorridos';

const ESPERA_MS = 1500;

export function Senalar({ objetivo, texto, onCerrar, onNoEsta }: {
  /** El valor de `data-recorrido` del elemento a señalar. */
  objetivo: string;
  /** Una frase corta al lado del recorte («Falta: Fecha de la Reunión 1»). */
  texto: string;
  onCerrar: () => void;
  /** El elemento no apareció: quien monta decide el respaldo. */
  onNoEsta?: () => void;
}) {
  const [hueco, setHueco] = useState<Caja | null>(null);
  const capa = useCapaModal(true, { anidada: true });
  const cerrarRef = useRef(onCerrar);
  const noEstaRef = useRef(onNoEsta);
  const arribaRef = useRef(capa.esElDeArriba);
  useEffect(() => { cerrarRef.current = onCerrar; noEstaRef.current = onNoEsta; arribaRef.current = capa.esElDeArriba; });

  // Buscar, llevar a la vista y seguirlo mientras la página se mueve.
  useEffect(() => {
    let vivo = true;
    let frame = 0;
    const inicio = performance.now();
    let llevado = false;
    const buscar = () => {
      if (!vivo) return;
      let el: HTMLElement | null = null;
      try { el = document.querySelector<HTMLElement>(selectorDe(objetivo)); } catch { el = null; }
      const visible = el && el.getClientRects().length > 0;
      if (!visible) {
        if (performance.now() - inicio > ESPERA_MS) { noEstaRef.current?.(); cerrarRef.current(); return; }
        frame = requestAnimationFrame(buscar);
        return;
      }
      const r = el!.getBoundingClientRect();
      const ventana = { ancho: window.innerWidth, alto: window.innerHeight };
      const caja = { x: r.left, y: r.top, ancho: r.width, alto: r.height };
      if (!llevado) {
        llevado = true;
        // ⚠️ Sólo si no se ve: `scrollIntoView` scrollea TODOS los ancestros, incluidos los de
        // `overflow: hidden` (la misma guarda que el tutorial, lib/recorridos.ts).
        const n = necesitaScroll(caja, ventana);
        if (n.scroll) el!.scrollIntoView({ block: n.bloque, behavior: 'smooth' });
      }
      setHueco(recorteDe(caja, ventana));
      frame = requestAnimationFrame(buscar);
    };
    frame = requestAnimationFrame(buscar);
    return () => { vivo = false; cancelAnimationFrame(frame); };
  }, [objetivo]);

  // Se aparta con el primer toque o tecla. En CAPTURA y sin `preventDefault`: el toque llega
  // igual a lo que tocó, así que tocar el dato lo abre y además cierra el velo.
  useEffect(() => {
    const irse = () => cerrarRef.current();
    // Escape cierra SÓLO el velo: sin `stopImmediatePropagation`, cerraría también la ficha.
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && arribaRef.current()) e.stopImmediatePropagation(); irse(); };
    document.addEventListener('pointerdown', irse, true);
    document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('pointerdown', irse, true); document.removeEventListener('keydown', tecla, true); };
  }, []);

  if (!hueco || typeof document === 'undefined') return null;
  const abajo = hueco.y + hueco.alto + 10;
  const cabeAbajo = abajo + 40 < window.innerHeight;
  return createPortal(
    <div aria-hidden className="mk-senal" style={{ zIndex: capa.z }}>
      <style>{CSS}</style>
      <div className="mk-senal__hueco" style={{ left: hueco.x, top: hueco.y, width: hueco.ancho, height: hueco.alto }} />
      <div className="mk-senal__txt" style={{ left: Math.max(12, Math.min(hueco.x, window.innerWidth - 300)), top: cabeAbajo ? abajo : Math.max(12, hueco.y - 44) }}>
        {texto}
      </div>
    </div>,
    document.body,
  );
}

// El velo y el recorte son los del tutorial (Recorrido.tsx): mismos tokens, mismo latido.
const CSS = `
.mk-senal { position: fixed; inset: 0; pointer-events: none;
  --senal-velo: color-mix(in srgb, var(--sidebar) 66%, transparent); }
.mk-senal__hueco { position: fixed; border-radius: var(--r-md);
  box-shadow: 0 0 0 2px var(--primary), 0 0 0 200vmax var(--senal-velo); }
.mk-senal__hueco::after { content: ''; position: absolute; inset: -2px; border-radius: inherit;
  animation: mkSenalLatido 1.8s ease-out infinite; }
@keyframes mkSenalLatido {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 45%, transparent); }
  100% { box-shadow: 0 0 0 10px color-mix(in srgb, var(--primary) 0%, transparent); }
}
.mk-senal__txt { position: fixed; max-width: 288px; padding: 8px 12px; border-radius: var(--r-md);
  background: var(--surface); color: var(--ink); border: 1px solid var(--border);
  font-size: 13px; font-weight: 600; box-shadow: 0 10px 28px color-mix(in srgb, var(--sidebar) 30%, transparent); }
`;
