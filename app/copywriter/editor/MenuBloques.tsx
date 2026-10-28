'use client';

// =============================================================================
// MenuBloques — el menú «/» del Copywriter, dibujado como el de Notion
// =============================================================================
// El motor (dónde está la «/», qué se escribió después, cuándo se cierra) es el del Web Generator
// (app/web-generator/editor/extensiones/barra.ts, con `buscar` de este catálogo). Esto sólo lo DIBUJA, leyendo el
// estado del plugin con `useEditorState`, y contesta las flechas, Enter y Tab (`registrarTeclasBarra`).
// Lo de Notion: la tarjeta flotante debajo del renglón, el título gris de cada grupo, el cuadrito de 46 px con el
// ícono, el nombre y la descripción gris, y el atajo a la derecha. Lo escrito filtra; sin nada, «Sin resultados».
// Se monta ADENTRO de la raíz `.nt` (fixed): sus colores salen de los tokens de esa raíz.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { cerrarBarra, estadoBarra, registrarTeclasBarra } from '@/app/web-generator/editor/extensiones/barra';
import { gruposDeMenu, type DefBloqueCopy } from './bloques';
import { aplicarBloque } from './acciones';

export function MenuBloques({ editor, catalogo, alMako }: { editor: Editor; catalogo: readonly DefBloqueCopy[]; alMako: () => void }) {
  const estado = useEditorState({ editor, selector: ({ editor: e }) => (e ? estadoBarra(e.state) : null) });
  const consulta = estado?.consulta ?? '';
  const grupos = useMemo(() => gruposDeMenu(consulta, catalogo), [consulta, catalogo]);
  const planos = useMemo(() => grupos.flatMap((g) => g.bloques), [grupos]);
  const [activa, setActiva] = useState(0);
  const lista = useRef<HTMLDivElement>(null);
  useEffect(() => { setActiva(0); }, [consulta]);

  const elegir = (b: DefBloqueCopy) => {
    const e = estadoBarra(editor.state);
    if (!e) return;
    // Primero se borra la «/consulta»; después se aplica el bloque al renglón que quedó.
    editor.chain().focus().deleteRange({ from: e.desde, to: e.hasta }).run();
    cerrarBarra(editor);
    aplicarBloque(editor, b.id, alMako);
  };

  // Las teclas mientras está abierto (el plugin las pasa acá).
  const vivo = useRef({ planos, activa, elegir });
  vivo.current = { planos, activa, elegir };
  useEffect(() => {
    if (!estado) return;
    const view = editor.view;
    registrarTeclasBarra(view, (ev) => {
      const { planos: ps, activa: a, elegir: el } = vivo.current;
      if (ev.key === 'ArrowDown') { setActiva((a + 1) % Math.max(1, ps.length)); return true; }
      if (ev.key === 'ArrowUp') { setActiva((a - 1 + Math.max(1, ps.length)) % Math.max(1, ps.length)); return true; }
      if (ev.key === 'Enter' || ev.key === 'Tab') {
        const b = ps[a];
        if (!b) return false;
        el(b);
        return true;
      }
      return false;
    });
    return () => registrarTeclasBarra(view, null);
  }, [!!estado, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // La fila activa, a la vista.
  useEffect(() => {
    lista.current?.querySelector('[data-activa]')?.scrollIntoView({ block: 'nearest' });
  }, [activa]);

  if (!estado || editor.isDestroyed) return null;
  let coords: { left: number; bottom: number; top: number };
  try { coords = editor.view.coordsAtPos(estado.desde); } catch { return null; }
  const abajo = typeof window !== 'undefined' ? window.innerHeight - coords.bottom : 400;
  const estilo = abajo > 260
    ? { left: Math.max(8, Math.min(coords.left, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 332)), top: coords.bottom + 6 }
    : { left: Math.max(8, coords.left), bottom: (typeof window !== 'undefined' ? window.innerHeight : 800) - coords.top + 6 };

  let i = -1;
  return (
    <div className="nt-menu" ref={lista} style={estilo} role="listbox" aria-label="Bloques" onMouseDown={(e) => e.preventDefault()}>
      {planos.length === 0 && <div className="nt-menu-vacio">Sin resultados</div>}
      {grupos.map((g) => (
        <div key={g.categoria} role="group" aria-label={g.categoria}>
          <div className="nt-menu-grupo">{g.categoria}</div>
          {g.bloques.map((b) => {
            i += 1;
            const k = i;
            return (
              <button key={b.id} type="button" role="option" aria-selected={k === activa} className="nt-menu-fila" data-activa={k === activa ? '' : undefined}
                onMouseEnter={() => setActiva(k)} onClick={() => elegir(b)}>
                <span className="nt-menu-cuadro" aria-hidden>{b.icono}</span>
                <span className="nt-menu-textos">
                  <span className="nt-menu-nombre">{b.nombre}</span>
                  <span className="nt-menu-desc">{b.descripcion}</span>
                </span>
                {b.atajo && <span className="nt-menu-atajo">{b.atajo}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
