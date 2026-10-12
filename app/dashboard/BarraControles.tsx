'use client';

// =============================================================================
// BarraControles — la búsqueda y los filtros de la TOPBAR, y los filtros de un gráfico en el panel
// =============================================================================
// Martín, 11/10/2026 (puntos 12-14 del feedback): «El botón de "Añadir control"… es una forma de añadir
// filtros en la vista… siempre configurado en el mismo lugar, como en una topbar», «es importante poder
// agregar un control a cada grafico… revisa que eso no produzca bugs», y la tanda de la topbar (punto 7):
// «que siempre esté disponible el botón de filtro con la barra de busqueda en la topbar… solo que en edición
// puedo elegir agregar o quitar filtros».
//
// Desde la tanda v5 (12/10/2026, puntos 4 y 14) la barra es DOS piezas y nada más:
//   · `BuscarEnHoja` (./BuscarEnHoja.tsx): la barra de búsqueda, SIEMPRE a la vista, que busca en lo
//     dibujado como el Ctrl+F del navegador.
//   · `MenuFiltro` (./MenuFiltro.tsx, `modo="hoja"`): UN botón «Filtro» con el número de filtros activos y
//     su desplegable de navegación (el período primero; editando, «Agregar filtro»).
// Se fueron la fila de un botón por control y el «Restablecer» suelto (va al pie del desplegable), y los
// CHIPS de cada tarjeta (`ChipsControles`): en la tarjeta va el mismo `MenuFiltro` en `modo="tarjeta"`, que
// monta app/dashboard/EditorInforme.tsx (interfaz I1 del contrato v5).
//
// Y queda acá `EditorControlesComp`, lo que la sección «Filtros» del panel de propiedades de un gráfico
// (./Propiedades.tsx) monta: TODOS sus controles (los fijos también: es el único lugar donde se editan), cada
// uno con «lo que muestra de entrada» y quitar, y «Agregar filtro a este gráfico». Cuáles ve quien mira (`fijo`)
// lo decide esa sección («A la vista»), no este componente: dos interruptores para la misma marca se contradicen.
//
// ⚠️ LO QUE SE ELIGE MIRANDO VA A LA VISTA Y NO SE GUARDA (`onVista`): es estado de la vista, como en Looker.
//    Lo único que cambia el INFORME es agregar o quitar un control y «Lo que muestra de entrada»
//    (`onCambiar` / `onCambiarComp`). tests/dashboard-controles.test.ts lo fija leyendo ./MenuFiltro.tsx.
// ⚠️ QUIÉN GANA SOBRE QUIÉN no se decide acá: lo decide `efectivoDe` (lib/graficos-catalogo.ts).

import { useCallback, useEffect, useRef, useState } from 'react';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { hoyEnTijuana } from '@/lib/date-utils';
import { MAX_CONTROLES, efectivoDe, type Bloque, type ControlVista, type Grafico, type Hoja, type ValorControl, type VistaValores } from '@/lib/graficos-catalogo';
import { parcheDeEntrada, rangoCorto, rangoDelControl, resumenControl, tituloControl, type Nivel } from '@/lib/graficos-controles-texto';
import { BuscarEnHoja } from './BuscarEnHoja';
import { Chevron, EstilosControles, ICONO, MenuFiltro, PanelAgregar, PanelDe, Popover, type Contexto } from './MenuFiltro';
import type { Compartido } from './lectura-compartida';

/**
 * La búsqueda y el «Filtro» de la página, en la TOPBAR (./Cabecera.tsx, a la derecha del título). Lo elegido
 * llama `onVista` (no se guarda); «Restablecer» limpia la vista. EDITANDO (y sólo si se puede guardar) el
 * desplegable suma «Agregar filtro» (`onAgregar`, eso SÍ cambia el informe) y, en cada control, «Lo que
 * muestra de entrada» (`onCambiar`) y «Quitar» (`onQuitar`). Mirando no se agrega nada. `compartido`: el link
 * sin sesión, que lee los valores de una lista por su ruta.
 * La firma es la de siempre: la topbar la monta igual que antes de v5.
 */
export function BarraControles({ hoja, vista, editando, guardable, hoy, onVista, onAgregar, onCambiar, onQuitar, onRestablecer, compartido = null }: {
  hoja: Hoja;
  vista: VistaValores;
  editando: boolean;
  guardable: boolean;
  hoy: string;
  onVista: (id: string, valor: ValorControl) => void;
  onAgregar: (c: ControlVista) => void;
  onCambiar: (id: string, parche: Partial<ControlVista>) => void;
  onQuitar: (id: string) => void;
  onRestablecer: () => void;
  compartido?: Compartido | null;
}) {
  return (
    <div className="bc-barra" role="toolbar" aria-label="Buscar y filtrar la página" data-bc="">
      <EstilosControles />
      <BuscarEnHoja />
      <MenuFiltro modo="hoja" hoja={hoja} vista={vista} editando={editando} guardable={guardable} hoy={hoy} compartido={compartido}
        onVista={onVista} onAgregar={onAgregar} onCambiar={onCambiar} onQuitar={onQuitar} onRestablecer={onRestablecer} />
    </div>
  );
}

// ── El panel de propiedades: lo de ENTRADA de cada control del gráfico ────────────────────────

/**
 * Un control en el panel de propiedades: su botón y su panel, siempre «de entrada» (acá no hay vista: lo que
 * se elige cambia el informe). Recién agregado se abre solo, para configurarlo sin buscarlo.
 */
function BotonEntrada({ c, hoy, ctx, onCambiar, autoAbrir, onAutoAbierto }: {
  c: ControlVista; hoy: string; ctx: Contexto;
  onCambiar: (id: string, parche: Partial<ControlVista>) => void;
  autoAbrir?: boolean; onAutoAbierto?: () => void;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const cerrar = useCallback(() => setAncla(null), []);
  const listo = useRef(onAutoAbierto);
  useEffect(() => { listo.current = onAutoAbierto; }, [onAutoAbierto]);
  // En el cuadro siguiente: el botón recién montado ya tiene su lugar, y el panel se mide contra él.
  useEffect(() => {
    if (!autoAbrir) return;
    const id = requestAnimationFrame(() => {
      if (!btn.current) return;
      setAncla(btn.current);
      listo.current?.();
    });
    return () => cancelAnimationFrame(id);
  }, [autoAbrir]);
  const onElegir = (v: ValorControl) => onCambiar(c.id, parcheDeEntrada(c.tipo, v));
  const titulo = tituloControl(c);
  return (
    <>
      <button ref={btn} type="button" className="bc-btn" aria-haspopup="dialog" aria-expanded={!!ancla}
        title={titulo} onClick={() => setAncla((a) => (a ? null : btn.current))}>
        <IconoMenu nombre={ICONO[c.tipo]} size={14} />
        <span className="bc-btn-txt">{resumenControl(c, hoy)}</span>
        <Chevron />
      </button>
      {ancla && (
        <Popover ancla={ancla} etiqueta={titulo} ancho={c.tipo === 'lista' ? 300 : c.tipo === 'periodo' ? 320 : 260} onCerrar={cerrar}>
          <div className="bc-pop-cab">
            <span className="bc-pop-tit">{titulo}</span>
            {c.tipo === 'periodo' && (() => { const r = rangoDelControl(c, hoy); return <span className="bc-dim">{rangoCorto(r.desde, r.hasta, hoy)}</span>; })()}
            <span className="bc-pop-modo">De entrada</span>
          </div>
          <PanelDe c={c} modo="entrada" hoy={hoy} ctx={ctx} onElegir={onElegir} onListo={cerrar} />
        </Popover>
      )}
    </>
  );
}

/** «Agregar filtro a este gráfico»: el botón y el MISMO menú de agregar del desplegable. */
function MenuAgregar({ nivel, texto, onAgregar }: { nivel: Nivel; texto: string; onAgregar: (c: ControlVista) => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const cerrar = useCallback(() => setAncla(null), []);
  const lleno = (nivel.nivel === 'hoja' ? nivel.hoja.controles : nivel.comp.controles).length >= MAX_CONTROLES;
  return (
    <>
      <button ref={btn} type="button" className="bc-btn bc-agregar bc-agregar--ancho" aria-haspopup="dialog" aria-expanded={!!ancla}
        title={lleno ? `Hasta ${MAX_CONTROLES} por gráfico` : undefined} onClick={() => setAncla((a) => (a ? null : btn.current))}>
        <IconoMenu nombre="agregar" size={14} /> <span>{texto}</span>
      </button>
      {ancla && (
        // Cada vez que se abre, de nuevo en los tipos (el panel arranca en su primer paso al montarse).
        <Popover ancla={ancla} etiqueta={texto} ancho={280} onCerrar={cerrar}>
          <PanelAgregar nivel={nivel} onAgregar={(c) => { cerrar(); onAgregar(c); }} />
        </Popover>
      )}
    </>
  );
}

/**
 * La sección «Filtros» del panel de propiedades (./Propiedades.tsx): TODOS los controles del gráfico, los
 * FIJOS incluidos (un filtro de definición, contrato v5: «se edita en la sección "Filtros" del panel»), y
 * «Agregar filtro a este gráfico». Acá todo es «de entrada»: cambia el informe, por `onCambiarComp`.
 *   · La lista que se manda es SIEMPRE la entera: cambiar o quitar uno no se puede llevar a los demás (un fijo
 *     que se pierda cambia el número de la tarjeta).
 *   · Cuáles ve quien mira (`fijo`) no se decide acá: lo decide la sección que lo monta («A la vista»).
 * `hoy` es opcional (el contrato no lo pasa): sin él, el de Tijuana, que es el mismo con el que el server
 * acota las fechas.
 */
export function EditorControlesComp({ comp, hoja, onCambiarComp, hoy: hoyDado }: {
  comp: Grafico | Bloque;
  hoja: Hoja;
  onCambiarComp: (parche: { controles: ControlVista[] }) => void;
  hoy?: string;
}) {
  const [abrirId, setAbrirId] = useState<string | null>(null);
  const soltarAbrir = useCallback(() => setAbrirId(null), []);
  const hoy = hoyDado ?? hoyEnTijuana();
  const efectivo = efectivoDe(comp, hoja, {}, hoy);
  const ctx: Contexto = { desde: efectivo.desde, hasta: efectivo.hasta, fuentes: comp.clase === 'grafico' ? [comp.fuente] : undefined };
  const cambiar = (id: string, parche: Partial<ControlVista>) => onCambiarComp({ controles: comp.controles.map((x) => (x.id === id ? { ...x, ...parche } : x)) });
  const quitar = (id: string) => onCambiarComp({ controles: comp.controles.filter((x) => x.id !== id) });
  return (
    <div className="bc-editor" data-bc="">
      <EstilosControles />
      {comp.controles.length ? (
        <div className="bc-editor-lista">
          {comp.controles.map((c) => (
            <div key={c.id} className="bc-editor-fila">
              <BotonEntrada c={c} hoy={hoy} ctx={ctx} onCambiar={cambiar} autoAbrir={abrirId === c.id} onAutoAbierto={soltarAbrir} />
              <BotonBorrar talla="sm" title={`Quitar «${tituloControl(c)}»`} onClick={() => quitar(c.id)} />
            </div>
          ))}
        </div>
      ) : (
        null
      )}
      {/* Agregar SUMA a la lista (con los fijos): reemplazarla se llevaría el período propio, que desde v5 es un control. */}
      <MenuAgregar nivel={{ nivel: 'componente', comp, hoja }} texto="Agregar filtro a este gráfico"
        onAgregar={(c) => { onCambiarComp({ controles: [...comp.controles, c] }); setAbrirId(c.id); }} />
    </div>
  );
}
