'use client';

// =============================================================================
// MenuContextual — el CLIC DERECHO en toda la tab Dashboard
// =============================================================================
// Martín (13/10/2026), textual: «te pido que implementes el click derecho en toda la tab, con diferentes acciones».
// Qué opciones salen lo decide `opcionesContextuales` (pura, con test) según DÓNDE se hizo el clic (un gráfico, otro
// elemento o el lienzo) y en qué MODO (mirando, editando, sólo lectura); qué hace cada una, la pantalla
// (app/dashboard/EditorInforme.tsx, que ya tiene cada acción: este menú no inventa ninguna, las junta donde está el cursor).
//   · Un link compartido NO tiene menú propio: ahí sale el del navegador (no hay nada que hacer más que mirar).
//   · Un campo de texto (un input, un título que se edita en el lugar) tampoco: copiar y pegar son del navegador.
//   · Ninguna opción es destructiva sin estar editando, y «Eliminar» va al final, en rojo y separada (el tacho de la casa).

import type { NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { IconoMenu } from '@/app/_ui/iconos-menu';

export type IdOpcion =
  | 'editar' | 'mako_chat' | 'duplicar' | 'cambiar_tipo' | 'mako_config' | 'mako_quitar' | 'mako_agregar' | 'conectar' | 'borrar'
  | 'agregar_grafico' | 'insertar_texto' | 'estilo' | 'terminar'
  | 'editar_hoja' | 'nueva_hoja' | 'copiar_dashboard' | 'compartir' | 'analista' | 'csv' | 'pdf';

/** Dónde se hizo el clic y qué se puede: lo que decide el menú. */
export type ContextoMenu = {
  sobre: 'grafico' | 'elemento' | 'lienzo';
  editando: boolean;
  /** Se puede guardar (no el closer, no un link, no con la lectura caída). */
  guardable: boolean;
  /** El closer o el setter: mira su hoja y exporta. */
  soloMirar: boolean;
  compartido: boolean;
  /** El gráfico lleva el botón de MaKo (`conMako`) y ya tiene datos (para «Preguntarle a MaKo»). */
  conMako?: boolean;
  conDatos?: boolean;
  /** Se está editando un pop-up (adentro no hay conectores). */
  enPopup?: boolean;
  puedeNuevaHoja?: boolean;
  /**
   * El editor está en la tab General (14/10/2026): ahí no se copia el informe con un token ni se comparte (los dos hablan
   * del informe del Dashboard).
   */
  enGeneral?: boolean;
};

/** Las opciones, en orden. `null` = un separador. Vacío = no hay menú propio (sale el del navegador). */
export function opcionesContextuales(c: ContextoMenu): Array<IdOpcion | null> {
  if (c.compartido) return [];
  const exportar: Array<IdOpcion | null> = ['csv', 'pdf'];
  if (c.soloMirar || !c.guardable) return exportar;
  if (!c.editando) {
    if (c.sobre === 'lienzo') {
      const delDashboard: IdOpcion[] = c.enGeneral ? [] : ['copiar_dashboard', 'compartir'];
      return ['editar_hoja', ...(c.puedeNuevaHoja ? ['nueva_hoja' as const] : []), ...delDashboard, 'analista', null, ...exportar];
    }
    return ['editar', ...(c.sobre === 'grafico' && c.conMako && c.conDatos ? ['mako_chat' as const] : []), null, ...exportar];
  }
  if (c.sobre === 'lienzo') return ['agregar_grafico', 'insertar_texto', 'estilo', null, 'terminar'];
  const conectar: IdOpcion[] = c.enPopup ? [] : ['conectar'];
  if (c.sobre === 'elemento') return ['editar', 'duplicar', ...conectar, null, 'borrar'];
  const mako: IdOpcion[] = c.conMako ? ['mako_config', 'mako_quitar'] : ['mako_agregar'];
  return ['editar', 'duplicar', 'cambiar_tipo', null, ...mako, ...conectar, null, 'borrar'];
}

/** Cómo se lee y con qué ícono va cada opción (el set de la casa: AGENTS.md, «un desplegable lleva ícono»). */
export const OPCION: Readonly<Record<IdOpcion, { texto: string; icono: NombreIconoMenu }>> = {
  editar: { texto: 'Editar', icono: 'editar' },
  mako_chat: { texto: 'Preguntarle a MaKo', icono: 'mako' },
  duplicar: { texto: 'Duplicar', icono: 'duplicar' },
  cambiar_tipo: { texto: 'Cambiar el tipo', icono: 'grafico' },
  mako_config: { texto: 'Configurar MaKo', icono: 'configurar' },
  mako_quitar: { texto: 'Quitar el botón de MaKo', icono: 'quitar' },
  mako_agregar: { texto: 'Poner el botón de MaKo', icono: 'mako' },
  conectar: { texto: 'Conectar con…', icono: 'link' },
  borrar: { texto: 'Eliminar', icono: 'borrar' },
  agregar_grafico: { texto: 'Añadir un gráfico', icono: 'grafico' },
  insertar_texto: { texto: 'Insertar texto', icono: 'texto' },
  estilo: { texto: 'Estilo de la página', icono: 'configurar' },
  terminar: { texto: 'Terminar de editar', icono: 'check' },
  editar_hoja: { texto: 'Editar', icono: 'editar' },
  nueva_hoja: { texto: 'Nueva hoja', icono: 'agregar' },
  copiar_dashboard: { texto: 'Copiar dashboard', icono: 'copiar' },
  compartir: { texto: 'Compartir', icono: 'enviar' },
  analista: { texto: 'AI Analyst', icono: 'mako' },
  csv: { texto: 'Descargar datos (CSV)', icono: 'descargar' },
  pdf: { texto: 'Descargar PDF', icono: 'archivo' },
};

export function MenuContextual({ opciones, onElegir }: { opciones: ReadonlyArray<IdOpcion | null>; onElegir: (id: IdOpcion) => void }) {
  return (
    <div className="lk-lista" role="menu" aria-label="Acciones" data-menu-contextual="">
      {opciones.map((id, i) => {
        if (!id) return <div key={`sep${i}`} className="lk-sep-h" />;
        const o = OPCION[id];
        return (
          <button key={id} type="button" role="menuitem" className={`lk-opcion${id === 'borrar' ? ' lk-opcion--peligro' : ''}`}
            onClick={() => onElegir(id)}>
            <IconoMenu nombre={o.icono} size={17} /> <span>{o.texto}</span>
          </button>
        );
      })}
    </div>
  );
}
