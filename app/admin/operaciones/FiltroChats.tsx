'use client';

// =============================================================================
// FiltroChats — el embudo de la barra del Ops Center, al lado del buscador (22/10/2026, feedback 4)
// =============================================================================
// Martín: la barra del Ops Center «parecida a lo que tenemos en Automations». Es el MISMO botón que el de la lista de
// Automations (app/automations/FiltroLista.tsx): el Dropdown de la casa con `secciones`, casillas (`varios`) y «Quitar
// filtros» abajo; cuadrado, del alto del buscador, teñido y con el número con algo marcado. Lo que cambia son las secciones,
// que viven en lib/ops-center-filtro.ts (con su test): acá sólo se dibuja.

import { Dropdown } from '@/app/components/Dropdown';
import { Icon } from '@/app/_components/icons';
import { alternarFiltroChats, seccionesDelFiltroChats, type ChatFiltrable } from '@/lib/ops-center-filtro';

/** El lado del botón: el alto del buscador de al lado (`.co-buscar`, 36 px). */
const LADO = 36;

export function FiltroChats({ filas, valores, onCambio, conEstado }: {
  /** TODAS las filas (las cuentas van sobre todas, no sobre lo visible). */
  filas: readonly ChatFiltrable[];
  valores: string[];
  onCambio: (valores: string[]) => void;
  /** El super admin, que sabe el estado de cada chat. */
  conEstado: boolean;
}) {
  const n = valores.length;
  return (
    <span className="co-filtro" style={{ position: 'relative', flex: 'none', display: 'inline-flex' }}>
      <Dropdown
        value="" varios={valores} onChange={(v) => onCambio(alternarFiltroChats(valores, v))}
        secciones={seccionesDelFiltroChats(filas, valores, conEstado)} search={false} sinFlecha
        align="afuera" menuMinAncho={244} menuAncho={300}
        ariaLabel={n > 0 ? `Filtrar (${n})` : 'Filtrar'}
        botonLabel={<span style={{ display: 'flex' }}><Icon name="funnel" size={16} /></span>}
        pie={n > 0 ? { label: 'Quitar filtros', onClick: () => onCambio([]) } : undefined}
        buttonStyle={{
          width: LADO, height: LADO, padding: 0, justifyContent: 'center', borderRadius: 10,
          color: n > 0 ? 'var(--primary)' : 'var(--dim)',
          borderColor: n > 0 ? 'var(--primary-weak)' : 'var(--border-strong)',
        }}
      />
      {n > 0 && (
        // `aria-hidden`: el número ya lo dice el nombre del botón, y «Quitar filtros» está en el menú.
        <span aria-hidden onClick={() => onCambio([])} title="Quitar filtros"
          style={{ position: 'absolute', top: -6, right: -6, minWidth: 17, height: 17, padding: '0 4px', boxSizing: 'border-box', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)', cursor: 'pointer' }}>
          {n}
        </span>
      )}
    </span>
  );
}
