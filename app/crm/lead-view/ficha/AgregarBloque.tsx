'use client';

// =============================================================================
// AgregarBloque — el catálogo de UNA tab, con buscador (el «Añadir un gráfico» del Dashboard)
// =============================================================================
// Ofrece sólo lo que tiene componente y no está puesto (`ofrecerEnAgregar`, ./armar.ts): un bloque que
// todavía no existe no se ofrece con un «pronto». El bloque entra después del elegido, o al final.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { NOMBRE_TAB, type BloqueId, type TabFicha } from '@/lib/ficha/catalogo';
import type { BloquePuesto } from '@/lib/ficha/config';
import { ofrecerEnAgregar } from './armar';
import { entradaDe } from './registro';
import { Flotante } from './Flotante';

export function AgregarBloque({ ancla, tab, lista, verPrivado, onElegir, onCerrar }: {
  ancla: HTMLElement;
  tab: TabFicha;
  lista: readonly BloquePuesto[];
  verPrivado: boolean;
  onElegir: (id: BloqueId) => void;
  onCerrar: () => void;
}) {
  const [buscar, setBuscar] = useState('');
  const input = useRef<HTMLInputElement>(null);
  // `autoFocus` adentro de un portal recién montado no siempre llega: el foco va en un efecto.
  useEffect(() => { input.current?.focus(); }, []);
  const opciones = ofrecerEnAgregar(tab, lista, { registrado: (id) => !!entradaDe(id), verPrivado, buscar });
  return (
    <Flotante ancla={ancla} onCerrar={onCerrar} ancho={300} etiqueta={`Agregar un bloque a ${NOMBRE_TAB[tab]}`}>
      <input ref={input} className="fb-buscar" type="search" value={buscar} placeholder="Buscar un bloque" aria-label="Buscar un bloque"
        onChange={(e) => setBuscar(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && opciones[0]) { e.preventDefault(); onElegir(opciones[0].id); } }} />
      <div role="menu">
        {opciones.map((def) => (
          <button key={def.id} type="button" role="menuitem" className="fb-opcion" onClick={() => onElegir(def.id)}>
            <IconoMenu nombre={def.icono} size={16} /> {def.titulo}
            {def.tab !== tab && <span className="fb-opcion-linea">de {NOMBRE_TAB[def.tab]}</span>}
          </button>
        ))}
        {!opciones.length && <div className="fb-vacio-menu">{buscar.trim() ? 'Ninguno con ese nombre.' : 'Ya están todos.'}</div>}
      </div>
    </Flotante>
  );
}
