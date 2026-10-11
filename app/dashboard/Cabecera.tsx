'use client';

// =============================================================================
// Cabecera — la fila de arriba (el ícono, las HOJAS, «Nueva hoja», las acciones) y la cabecera de la hoja
// =============================================================================
// Pedidos de Martín (11/10/2026), en el orden del feedback:
//   1. «El LOGO de la tab, ya lo tenemos en la sidebar, pon ese»: es `<Icon name="graphics" />`, lo mismo
//      que dibuja la barra lateral (app/_components/nav.ts, la entrada `graphics`).
//   2. «Al lado del logo no debería decir "Dashboard" allí deberían estar justamente las "tabs"».
//   4. «Al final de las tabs… otra, tipo placeholder que diga "Nueva hoja"»: el placeholder punteado de
//      Automations (app/automations/NuevoPlaceholder.tsx), importado y no copiado.
//   6. «Debería funcionar si le doy click derecho a una página… también si no estoy editando debería
//      aparecer los 3 puntos»: el ⋮ y el clic derecho abren el MISMO menú, siempre, y sólo si se puede
//      guardar (con la lectura caída, un cambio de hoja se perdería sin aviso).
//  15. «la topbar siempre esté por defecto, con el título y que se pueda agregar un subtitulo. E incluso un
//      EMOJI»: la cabecera de la hoja. El título ES el nombre de la hoja (cambiarlo renombra la pestaña).
//      Sin editar se ve igual, pero no se edita.
//
// ⚠️ La barra de EDICIÓN no vive acá: va DEBAJO de esta fila (punto 7: «las tabs no deberían quedar abajo
//    de la barra con los botones de edición»). Lo fija tests/dashboard-pantalla.test.ts.

import type { ReactNode } from 'react';
import { Icon } from '@/app/_components/icons';
import { EditableInline } from '@/app/_components/EditableInline';
import { EmojiPickerMini } from '@/app/plan/board/EmojiPicker';
import { NuevoPlaceholder } from '@/app/automations/NuevoPlaceholder';
import type { Hoja } from '@/lib/graficos-catalogo';

export function FilaHojas({ hojas, activa, guardable, renombrando, puedeNueva, onIr, onMenu, onRenombrar, onFinRenombre, onNueva, acciones }: {
  hojas: Hoja[];
  activa: string;
  guardable: boolean;
  renombrando: string | null;
  puedeNueva: boolean;
  onIr: (id: string) => void;
  /** El menú de una hoja (Renombrar, Duplicar, Mover, Eliminar), anclado al ⋮ o a la pestaña del clic derecho. */
  onMenu: (ancla: HTMLElement, id: string) => void;
  onRenombrar: (id: string, nombre: string) => void;
  onFinRenombre: () => void;
  onNueva: () => void;
  /** Lo de la derecha: el «?», AI Analyst, Exportar, Editar/Ver y el ⋯. */
  acciones: ReactNode;
}) {
  return (
    <div className="lk-fila">
      <span className="lk-logo" aria-hidden><Icon name="graphics" size={22} /></span>
      <div className="lk-hojas" role="tablist" aria-label="Hojas" data-recorrido="dash-hojas">
        {hojas.map((h) => {
          const esActiva = h.id === activa;
          return (
            <div key={h.id} className="lk-hoja-tab" data-activa={esActiva || undefined}
              onContextMenu={(e) => { if (!guardable) return; e.preventDefault(); onMenu(e.currentTarget, h.id); }}>
              {renombrando === h.id ? (
                <input autoFocus defaultValue={h.nombre} maxLength={40} className="lk-hoja-input" aria-label="Nombre de la hoja"
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== h.nombre) onRenombrar(h.id, v); onFinRenombre(); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') { e.stopPropagation(); onFinRenombre(); }
                  }} />
              ) : (
                <button type="button" role="tab" aria-selected={esActiva} className="lk-hoja-btn" onClick={() => onIr(h.id)} title={h.nombre}>
                  {h.emoji && <span aria-hidden>{h.emoji}</span>}
                  <span className="lk-hoja-nombre">{h.nombre}</span>
                </button>
              )}
              {guardable && renombrando !== h.id && (
                <button type="button" className="lk-hoja-mas" aria-label={`Opciones de ${h.nombre}`} aria-haspopup="menu"
                  data-recorrido={esActiva ? 'dash-menu-hoja' : undefined}
                  onClick={(e) => onMenu(e.currentTarget, h.id)}>⋮</button>
              )}
            </div>
          );
        })}
        {puedeNueva && (
          <span className="lk-hoja-nueva" data-recorrido="dash-nueva-hoja">
            <NuevoPlaceholder chico texto="Nueva hoja" onClick={onNueva} style={{ width: 'auto', height: 30, padding: '0 12px', flex: 'none' }} />
          </span>
        )}
      </div>
      <div className="lk-acciones">{acciones}</div>
    </div>
  );
}

/**
 * La cabecera de la hoja, arriba del lienzo: el emoji, el título (el nombre de la hoja) y el subtítulo.
 * `periodo` es la línea que sólo sale en el PDF (la barra de filtros no se imprime).
 *
 * El emoji va con `EmojiPickerMini` (el panel cuelga del botón): esta cabecera NO es sticky ni tiene
 * overflow, así que el panel no se recorta.
 */
export function CabeceraHoja({ hoja, editando, periodo, onCambiar }: {
  hoja: Hoja;
  editando: boolean;
  periodo: string;
  onCambiar: (p: Partial<Pick<Hoja, 'nombre' | 'emoji' | 'subtitulo'>>) => void;
}) {
  return (
    <header className="lk-cab-hoja" data-recorrido="dash-titulo">
      <div className="lk-cab-fila">
        {editando ? (
          <EmojiPickerMini value={hoja.emoji} onPick={(e) => onCambiar({ emoji: e })} />
        ) : hoja.emoji ? <span className="lk-cab-emoji" aria-hidden>{hoja.emoji}</span> : null}
        <h1 className="lk-cab-tit">
          {editando ? (
            // Un título vacío no se guarda vacío: «Sin título», así la pestaña nunca queda en blanco.
            <EditableInline valor={hoja.nombre} maxLargo={40} titulo="Nombre de la hoja" onGuardar={(v) => onCambiar({ nombre: v || 'Sin título' })} />
          ) : hoja.nombre}
        </h1>
      </div>
      {editando ? (
        <p className="lk-cab-sub">
          <EditableInline valor={hoja.subtitulo} maxLargo={140} placeholder="Agrega un subtítulo" titulo="Subtítulo de la hoja" onGuardar={(v) => onCambiar({ subtitulo: v })} />
        </p>
      ) : hoja.subtitulo ? <p className="lk-cab-sub">{hoja.subtitulo}</p> : null}
      <p className="lk-solo-imprimir lk-cab-periodo">{periodo}</p>
    </header>
  );
}
