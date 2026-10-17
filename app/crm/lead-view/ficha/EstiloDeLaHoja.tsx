'use client';

// =============================================================================
// «Estilo de la hoja» de la ficha del lead: el desplegable de la barra de edición
// =============================================================================
// Feedback de Martín del 16/10/2026 (punto 4 del CRM): «"Vista épica" debería ser el desplegable de "Estilo de la
// hoja" que ya tenemos en otros lugares... "Estilo" ya dijimos dónde debería ir». Es el mismo botón que el del
// Dashboard (app/dashboard/EditorInforme.tsx, «Estilo de la hoja»), con lo que vivía en la barra lateral de
// «Personalizar»: la vista épica de ESTA tab, el tamaño de las tarjetas y el tema (el mismo PanelEstilo del Dashboard).
//
// Se dibuja por portal y anclado al botón (como el «Ver» de datos sin marcar): la ficha tiene `overflow: hidden` y un
// panel en flujo se cortaría contra su borde. Escape cierra sólo el desplegable (`useCapaModal` anidada).

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Switch } from '@/app/_ui/Toggle';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { useCapaModal } from '@/app/_components/pila-modales';
import { ubicarPanel } from '@/app/_components/PortadaPicker';
import { PanelEstilo } from '@/app/dashboard/PanelEstilo';
import { DENSIDADES, type LugarFicha } from '@/lib/ficha/catalogo';
import { lugarDe, type CambioFicha, type FichaEfectiva } from '@/lib/ficha/config';

// Desde el 17/10/2026 `tab` es una de las cuatro tabs o una hoja propia (`LugarFicha`): la épica se lee y se cambia igual.
export function EstiloDeLaHoja({ ef, tab, onCambio }: { ef: FichaEfectiva; tab: LugarFicha; onCambio: (c: CambioFicha) => void }) {
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={botonRef} type="button" className="fb-herr" aria-haspopup="dialog" aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}>
        <IconoMenu nombre="configurar" size={15} /> Estilo de la hoja <span aria-hidden>▾</span>
      </button>
      {abierto && <Panel ancla={botonRef.current} ef={ef} tab={tab} onCambio={onCambio} onCerrar={() => setAbierto(false)} />}
    </>
  );
}

function Panel({ ancla, ef, tab, onCambio, onCerrar }: {
  ancla: HTMLElement | null; ef: FichaEfectiva; tab: LugarFicha; onCambio: (c: CambioFicha) => void; onCerrar: () => void;
}) {
  const [montado, setMontado] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const capa = useCapaModal(true, { anidada: true });
  const arriba = capa.esElDeArriba;
  const onCerrarRef = useRef(onCerrar);
  useEffect(() => { onCerrarRef.current = onCerrar; });
  useEffect(() => { setMontado(true); }, []);

  const recolocar = useCallback(() => {
    const p = panelRef.current;
    if (!p) return;
    const caja = p.getBoundingClientRect();
    const a = ancla?.isConnected ? ancla.getBoundingClientRect() : null;
    const ventana = { ancho: window.innerWidth, alto: window.innerHeight };
    setPos(a ? ubicarPanel(a, { ancho: caja.width, alto: caja.height }, ventana)
      : { left: Math.max(10, (ventana.ancho - caja.width) / 2), top: Math.max(10, (ventana.alto - caja.height) / 2) });
  }, [ancla]);

  useEffect(() => {
    recolocar();
    window.addEventListener('resize', recolocar);
    window.addEventListener('scroll', recolocar, true);
    return () => { window.removeEventListener('resize', recolocar); window.removeEventListener('scroll', recolocar, true); };
  }, [recolocar, montado]);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t || panelRef.current?.contains(t) || ancla?.contains(t)) return;
      onCerrarRef.current();
    };
    // `stopImmediatePropagation`: el Escape de la ficha vive en `document` y en captura (AGENTS.md, popovers anclados).
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !arriba()) return;
      e.stopImmediatePropagation(); e.preventDefault(); onCerrarRef.current();
    };
    document.addEventListener('mousedown', fuera, true);
    document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('mousedown', fuera, true); document.removeEventListener('keydown', tecla, true); };
  }, [ancla, arriba]);

  if (!montado) return null;
  return createPortal(
    <div ref={panelRef} role="dialog" aria-label="Estilo de la hoja" tabIndex={-1} onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', zIndex: capa.z, left: pos?.left ?? 0, top: pos?.top ?? 0,
        opacity: pos ? 1 : 0, pointerEvents: pos ? undefined : 'none',
        width: 320, maxWidth: 'calc(100vw - 20px)', maxHeight: 'min(560px, calc(100vh - 20px))', overflowY: 'auto',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13,
        boxShadow: '0 16px 40px rgba(18,21,27,.18)', padding: '12px 14px',
      }}>
      <div className="lk-estilo-tit">Esta tab</div>
      <div className="fb-aviso">
        <Switch label="Vista épica" checked={lugarDe(ef, tab).epica} onChange={(v) => onCambio({ op: 'epica', tab, epica: v })} />
      </div>
      <div className="lk-estilo-tit" style={{ marginTop: 12 }}>Tarjetas</div>
      <div className="fb-segmentos" role="group" aria-label="Tamaño de las tarjetas">
        {DENSIDADES.map((d) => (
          <button key={d.id} type="button" className="fb-herr" aria-pressed={ef.estilo.densidad === d.id}
            onClick={() => { if (ef.estilo.densidad !== d.id) onCambio({ op: 'densidad', densidad: d.id }); }}>
            {d.nombre}
          </button>
        ))}
      </div>
      {/* Con los ajustes encima de la plantilla (fondo, esquinas, borde, sombra, títulos), los del Dashboard (17/10/2026). */}
      <PanelEstilo tema={ef.estilo.tema} onCambiar={(tema) => onCambio({ op: 'tema', tema })} ajustes />
    </div>,
    document.body,
  );
}
