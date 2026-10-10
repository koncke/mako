'use client';

// =============================================================================
// FiltroLista — el botón de filtro de la lista de /automations (quinta tanda, punto 4)
// =============================================================================
// Pedido de Martín, textual: «El filtro al lado del buscador en la sidebar, debería ser más chico,
// con el ícono de filtro como ya lo tenemos en otros lados, así la barra de busqueda tiene más
// espacio. […] Replica el desplegable de Filtro que tenemos en el plan... Por ejemplo, "Quitar
// filtros" es un texto sutil abajo del todo... Y hay secciones».
//
// ⚠️ NO ES UN DESPLEGABLE NUEVO: es el Dropdown de la casa con `secciones` (que es, por su propio
// comentario, el patrón del filtro del Plan: la raíz con las secciones y lo que tiene puesto cada
// una, y adentro se marcan varias) + `varios` (casillas, el menú no se cierra al tocar) + `pie`
// («Quitar filtros», sutil, abajo del todo). La regla de app/_ui/Select.tsx: «si necesitás algo que
// el Dropdown no hace, se lo agregás AL Dropdown, no escribís un segundo». El `FilterMenu` del Plan
// (app/plan/board/BoardShell.tsx) no se puede montar acá: está atado al tablero (sus capas son
// proyectos, origen, orden) y su panel es `position: absolute` — adentro de la lista, que lleva
// `overflow: hidden`, se recortaría. El Dropdown se dibuja por PORTAL.
//
// El botón es SÓLO el ícono (el embudo de la casa, `Icon name="funnel"`), cuadrado y del alto del
// buscador, y con algo marcado se tiñe y lleva el número arriba a la derecha: el molde exacto del
// botón del Plan y del CRM. Tocar el número quita los filtros, como allá.
//
// Las decisiones (qué secciones, qué dice cada una, quién pasa) viven en lib/chatbot-lista-filtro.ts
// con test que las ejecuta: acá sólo se dibuja.

import { Dropdown } from '../components/Dropdown';
import { Icon } from '../_components/icons';
import { alternarFiltro, contarFiltros, seccionesDelFiltro, type FilaFiltrable } from '@/lib/chatbot-lista-filtro';

/** El lado del botón: el alto del buscador de al lado, para que la fila no tenga dos alturas. */
export const LADO_FILTRO = 38;

export function FiltroLista({ filas, valores, onCambio }: {
  /** TODAS las filas de la lista (las cuentas de cada opción van sobre todas, no sobre lo visible). */
  filas: readonly FilaFiltrable[];
  /** Lo marcado, como lo guarda el Dropdown con `varios` (`estado:activas`, `emoji:📅`…). */
  valores: string[];
  onCambio: (valores: string[]) => void;
}) {
  const n = contarFiltros(valores);
  return (
    <span style={{ position: 'relative', flex: 'none', display: 'inline-flex' }}>
      <Dropdown
        value="" varios={valores} onChange={(v) => onCambio(alternarFiltro(valores, v))}
        secciones={seccionesDelFiltro(filas, valores)} search={false} sinFlecha
        // Abre hacia AFUERA de la lista, como el «⋯» de cada fila: la lista queda a la vista
        // mientras se marca, y se ve cómo se filtra.
        align="afuera" menuMinAncho={244} menuAncho={300}
        ariaLabel={n > 0 ? `Filtrar (${n})` : 'Filtrar'}
        botonLabel={<span style={{ display: 'flex' }}><Icon name="funnel" size={16} /></span>}
        pie={n > 0 ? { label: 'Quitar filtros', onClick: () => onCambio([]) } : undefined}
        buttonStyle={{
          width: LADO_FILTRO, height: LADO_FILTRO, padding: 0, justifyContent: 'center', borderRadius: 10,
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
