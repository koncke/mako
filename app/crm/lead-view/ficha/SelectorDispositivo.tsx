'use client';

// =============================================================================
// SelectorDispositivo — Escritorio · Tablet · Celular mientras se personaliza la ficha
// =============================================================================
// Martín (14/10/2026): «En la edición, tal como lo tenemos en la edición de Landing Generator, tienes que
// poder visualizar en la versión mobile... Eso es importante que se diseñe todo siempre pensado para ambos
// dispositivos». Es el grupo «Vista por dispositivo» del editor del Dashboard (app/dashboard/EditorInforme.tsx,
// `DISPOSITIVOS`, que copió el del Web Generator): los mismos tres, con los mismos nombres y los mismos íconos.
// Los íconos van copiados de app/dashboard/Galeria.tsx (`SvgEscritorio`, `SvgTableta`, `SvgCelular`): importar
// aquel archivo arrastra la galería entera de gráficos al pop-up de la ficha (lo mismo que ./Flotante.tsx).
// Lo que hace cada uno (angostar la ficha real) está en ./FichaPorBloques.tsx y ./ficha-css.ts.
// =============================================================================

import type { ReactNode } from 'react';
import { DISPOSITIVOS_FICHA, type DispositivoFicha } from './armar';

const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }} aria-hidden>{d}</svg>
);
const ICONO: Readonly<Record<DispositivoFicha, ReactNode>> = {
  escritorio: svg(<><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M9 20h6M12 16v4" /></>),
  tableta: svg(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M11 18h2" /></>),
  movil: svg(<><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></>),
};

export function SelectorDispositivo({ valor, onCambiar }: { valor: DispositivoFicha; onCambiar: (d: DispositivoFicha) => void }) {
  return (
    <div className="fb-disp" role="group" aria-label="Vista por dispositivo">
      {DISPOSITIVOS_FICHA.map((d) => (
        <button key={d.id} type="button" className="fb-herr fb-herr--icono" title={d.nombre} aria-label={d.nombre}
          aria-pressed={valor === d.id} onClick={() => onCambiar(d.id)}>
          {ICONO[d.id]}
        </button>
      ))}
    </div>
  );
}
