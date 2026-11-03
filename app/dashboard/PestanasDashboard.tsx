'use client';

// =============================================================================
// PestanasDashboard — la tira de arriba del Dashboard unido: «Focus», las hojas y, ÚLTIMO, el desplegable
// =============================================================================
// El pedido y las reglas, en lib/dashboard-focus.ts. Acá sólo se dibuja:
//   · Una pestaña del editor que está montado cambia de hoja EN EL LUGAR (`onIr`), sin recargar. Una del otro informe es un
//     link (/dashboard?hoja=…): monta el otro editor.
//   · EL ÚLTIMO CHIP ES EL DESPLEGABLE (Martín, 1/11/2026: «el desplegable de "nueva hoja" ya no quiero que esté en el título,
//     quiero que esté arriba en los chips, en el ultimo... Y si hay muchos que en el ultimo se comiencen a juntar las hojas en el
//     desplegable»). Lo que no entra no se corta ni se desliza: va adentro (`chipsQueEntran`). La hoja abierta nunca: es lo que
//     dice dónde estás, ahora que la hoja no tiene título.
//   · «Templates» ya no está: todas las plantillas viven en la galería de «Nueva hoja» (./NuevaHoja.tsx).
// =============================================================================

import { useLayoutEffect, useRef, useState } from 'react';
import Link from '@/app/_ui/Link';
import { chipsQueEntran, type InformeDashboard, type Pestana } from '@/lib/dashboard-focus';
import { SvgFlecha } from './Galeria';

const GAP = 8;

const CSS = `
.dash-pestanas{position:relative;display:flex;align-items:center;gap:${GAP}px;min-width:0;flex:1}
.dash-pestana{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 14px;border-radius:999px;border:1px solid var(--border);
  background:var(--surface);color:var(--dim);font:inherit;font-size:13.5px;font-weight:600;white-space:nowrap;flex:none;cursor:pointer;text-decoration:none}
.dash-pestana:hover{color:var(--ink);border-color:var(--border-strong)}
.dash-pestana[aria-current="page"]{background:var(--primary);border-color:var(--primary);color:var(--on-primary)}
.dash-pestana:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.dash-pestana[aria-expanded="true"]{color:var(--ink);border-color:var(--border-strong)}
.dash-pestanas-regla{position:absolute;left:0;top:0;height:0;display:flex;gap:${GAP}px;overflow:hidden;visibility:hidden;pointer-events:none}
`;

/** Lo que se reserva para el último chip: lo mide con su texto más largo, y así los demás no saltan al cambiar de rótulo. */
const ROTULO_MAS_LARGO = 'Nueva hoja';

export function PestanasDashboard({ pestanas, actual, informe, onIr, conMenu, puedeNueva, menuAbierto, onMenu, detalleActual }: {
  pestanas: Pestana[];
  /** La hoja que se ve (la del editor montado). */
  actual: string;
  /** El informe del editor montado: sus pestañas cambian en el lugar. */
  informe: InformeDashboard;
  onIr: (id: string) => void;
  /** Hay algo que hacer en el desplegable además de lo que no entra. */
  conMenu: boolean;
  puedeNueva: boolean;
  menuAbierto: boolean;
  onMenu: (ancla: HTMLElement) => void;
  /** El subtítulo que alguien le escribió a la hoja: sale al pasar por su chip. */
  detalleActual?: string;
}) {
  const caja = useRef<HTMLElement>(null);
  const regla = useRef<HTMLDivElement>(null);
  const [fuera, setFuera] = useState<readonly number[]>([]);
  const activa = pestanas.findIndex((p) => p.informe === informe && p.id === actual);
  const firma = pestanas.map((p) => `${p.informe}:${p.id}:${p.nombre}`).join('|');

  useLayoutEffect(() => {
    const nodo = caja.current;
    const medida = regla.current;
    if (!nodo || !medida) return;
    const medir = () => {
      const anchos = [...medida.children].map((h) => (h as HTMLElement).offsetWidth);
      const ultimo = anchos.pop() ?? 0;
      const r = chipsQueEntran(anchos, nodo.clientWidth, ultimo, GAP, activa);
      setFuera((f) => (f.join() === r.fuera.join() ? f : r.fuera));
    };
    medir();
    let vivo = true;
    document.fonts?.ready.then(() => { if (vivo) medir(); });
    const ro = new ResizeObserver(medir);
    ro.observe(nodo);
    return () => { vivo = false; ro.disconnect(); };
  }, [firma, activa]);

  const chip = (p: Pestana) => {
    const elegida = p.informe === informe && p.id === actual;
    return p.informe === informe
      ? <button key={`${p.informe}:${p.id}`} type="button" className="dash-pestana" title={elegida ? detalleActual || undefined : undefined} aria-current={elegida ? 'page' : undefined} onClick={() => { if (!elegida) onIr(p.id); }}>{p.nombre}</button>
      : <Link key={`${p.informe}:${p.id}`} href={p.href} className="dash-pestana">{p.nombre}</Link>;
  };
  const rotulo = fuera.length ? `${fuera.length} más` : puedeNueva ? ROTULO_MAS_LARGO : 'Hojas';

  return (
    <nav ref={caja} className="dash-pestanas lk-sin-imprimir" aria-label="Hojas del Dashboard">
      <style>{CSS}</style>
      {pestanas.filter((_, i) => !fuera.includes(i)).map(chip)}
      {(conMenu || fuera.length > 0) && (
        <button type="button" className="dash-pestana" data-recorrido="dash-hojas" aria-haspopup="menu" aria-expanded={menuAbierto} title="Cambiar de hoja o crear una nueva"
          onClick={(e) => onMenu(e.currentTarget)}>
          {rotulo} <SvgFlecha arriba={menuAbierto} />
        </button>
      )}
      <div ref={regla} className="dash-pestanas-regla" aria-hidden inert>
        {pestanas.map((p) => <span key={`${p.informe}:${p.id}`} className="dash-pestana">{p.nombre}</span>)}
        <span className="dash-pestana">{ROTULO_MAS_LARGO} <SvgFlecha /></span>
      </div>
    </nav>
  );
}
