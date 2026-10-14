'use client';

// =============================================================================
// CrmToolbar — los controles del tablero del CRM (header + barra de filtros)
// =============================================================================
// Se separó de CrmBoard.tsx por una razón concreta: la barra crecía por acumulación
// (un botón nuevo = una fila nueva) y terminó ocupando tres renglones con tres
// jerarquías distintas de acciones mezcladas. Acá viven las piezas y sus reglas de
// layout; CrmBoard solo las compone y les pasa el estado.
//
// Reglas de layout que NO se pueden romper (se rompieron antes):
//  · Nada de flexWrap:'wrap' junto a marginLeft:'auto' en la misma fila: al envolver,
//    el "auto" empuja al último elemento y queda un hueco enorme en el medio. La fila
//    va en nowrap, cada control con flex:'none' y UN solo elástico (<span flex:1/>).
//  · Los estilos inline no soportan @media: los breakpoints se inyectan como clases
//    en <CrmToolbarStyles/> y ahí el elástico se apaga antes de permitir el wrap.
//  · Los valores de "origen" salen de los datos del cliente y pueden ser larguísimos
//    (URLs de campaña enteras): toda opción y todo chip lleva maxWidth + ellipsis +
//    title con el valor completo.

import Link, { useRouter, useWs } from '@/app/_ui/Link';
import { ICONO_VISTA } from '@/app/_ui/iconos-vista';
import { conWs } from '@/lib/ws-tab';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { useEffect, useLayoutEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { BAND_LABEL, CATEGORY, bandToCategory, type Stage, type StageBand } from '@/lib/pipeline';
import { nombreVisible } from '@/lib/lead-funnel-reglas';

const MONO = "'Geist Mono', monospace";
import { Modal } from '@/app/_ui/Modal';

import { CANALES } from '@/lib/fase-diagnostico';
import { ENTRADAS, ENTRADAS_OFRECIDAS, type EntradaId } from '@/lib/pipeline';
import { crearProductoAction, declararEntradasAction, embudosArchivadosAction, restaurarEmbudoAction, eliminarEmbudoDefinitivoAction } from './actions';
import { alternarGrupo, alternarHijo, conGrupoAbierto } from './arbol-seleccion';
import { ANCHO_PANEL, MARGEN_VENTANA, lugarDelPanel } from './filtro-panel';
import { Confirm } from '@/app/_ui/Confirm';
import { LapizIcon } from './iconos';
import { BANDAS_KANBAN } from './filtros-guardados';
// El CUBO del desplegable de funnels (punto 24): el ícono `producto` del set de los menús, el
// mismo que dibuja un funnel en el resto de la app. No se dibuja uno propio.
import { IconoMenu } from '@/app/_ui/iconos-menu';

const SANS = "'Geist', sans-serif";

/** Vista del tablero. "pendientes" (datos sin marcar) es UNA VISTA: reemplaza el board entero. */
export type CrmVista = 'kanban' | 'tabla' | 'pendientes';
/** Categorías del menú de filtros. El buscador NO es una categoría (no genera chip). */
export type FiltroCat = 'banda' | 'etapa' | 'origen' | 'creativo' | 'orden';

/**
 * «Estado» del menú: las tres bandas del Kanban (Activo · Nutrición · Descartado).
 *
 * Pedido de Martín (12/10/2026, punto 25): «Que los botones de "Activo, nutrición, descartado"
 * sean un desplegable dentro de filtros». Eran tres botones sueltos en la barra (`BandasToggle`,
 * que se fue). Sólo viaja en el KANBAN: son las columnas que se dibujan, y la tabla no tiene
 * columnas por etapa (igual que «Ordenar»). La regla de que siempre quede una prendida sigue
 * siendo del tablero (`toggleBand`); acá sólo se la respeta al dibujar.
 */
export type BandasFiltro = {
  activas: Set<StageBand>;
  alternar: (b: StageBand) => void;
  /** Cuántos leads (de lo que los otros filtros dejan) hay en esa banda. */
  conteo: (b: StageBand) => number;
  /** «Limpiar filtros»: las tres a la vista. */
  prenderTodas: () => void;
};
/** El orden en que se dibujan y se ofrecen: la MISMA lista que guarda los filtros. */
const ORDEN_BANDAS: readonly StageBand[] = BANDAS_KANBAN;

/**
 * «Ordenar» (mig 0200): UNA opción a la vez, y su BASE. Con un orden manual guardado la base
 * es «Manual», así que «Limpiar filtros» vuelve a las posiciones que se arrastraron y el número
 * del botón no cuenta como filtro el orden que la persona misma armó. Martín (06/10/2026):
 * «si quiero volver a la posición que había dejado las tarjetas es simplemente quitar filtros».
 */
export type OrdenFiltro = {
  valor: string;
  base: string;
  opciones: Record<string, string>;
  elegir: (v: string) => void;
};

/**
 * Una categoría del menú que es una LISTA de valores con su conteo (campaña, creativo).
 *
 * Pedido de Martín (06/10/2026): «en el CRM pon un filtro por creativo o por campaña, para
 * ver de qué ads vinieron los leads». Va genérica para que las dos —y la próxima— pasen por
 * el mismo dibujo del menú y del chip, en vez de sumar dos pares de props por categoría.
 */
export type ListaFiltro = {
  cat: FiltroCat;
  label: string;
  /** El resumen sin nada elegido («Todas» / «Todos»). */
  todas: string;
  opciones: { value: string; label: string; n: number }[];
  sel: Set<string>;
  set: (s: Set<string>) => void;
  /**
   * Si está, la lista se dibuja como ÁRBOL: cada opción es un grupo (una campaña) y adentro
   * van sus hijos (sus anuncios), con su propia selección. `sel` es la del grupo ENTERO.
   * Lo pidió Martín el 10/10/2026: campaña y anuncio en un solo filtro, como árbol.
   */
  hijos?: {
    de: Record<string, { value: string; label: string; n: number }[]>;
    sel: Set<string>;
    set: (s: Set<string>) => void;
  };
};
/** Estado del panel de filtros: null = cerrado; 'root' = las categorías; el resto = drill-down. */
export type FiltroAbierto = 'root' | FiltroCat | null;

// Alto común de los controles de la barra: si cada uno elige el suyo, la fila
// queda escalonada y se nota más que cualquier otro detalle de la pantalla.
const CTRL_H = 40;

// ── clases para lo que los estilos inline no pueden hacer (breakpoints) ───────
export function CrmToolbarStyles() {
  return (
    <style>{`
      /* Debajo de 980px la fila no entra: recién ahí se permite envolver, y el
         elástico se APAGA primero — si quedara vivo, al envolver dejaría un hueco
         del ancho de la fila entre el filtro y lo que sigue. */
      @media (max-width: 980px) {
        .crm-tb { flex-wrap: wrap !important; }
        .crm-tb-elastico { display: none !important; }
        .crm-tb-buscar { flex: 1 1 200px !important; }
      }
      @media (max-width: 760px) {
        .crm-acciones { flex-wrap: wrap !important; justify-content: flex-end; }
      }
    `}</style>
  );
}

// ── iconos ───────────────────────────────────────────────────────────────────
function UploadIcon({ size = 17 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>;
}
function DownloadIcon({ size = 17 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>;
}
function FunnelIcon({ size = 17 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>;
}

function KebabIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" /></svg>;
}
function LupaIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ position: 'absolute', left: 13, pointerEvents: 'none' }}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;
}

// Cerrar con Escape. Se registra solo mientras el panel está abierto para no dejar
// listeners sueltos escuchando toda la vida de la pantalla. El callback va por ref:
// si entrara en las deps, el listener se daría de baja y de alta en CADA render del
// tablero (que re-renderiza con cada drag).
function useEscape(activo: boolean, cerrar: () => void) {
  const ref = useRef(cerrar);
  useEffect(() => { ref.current = cerrar; });
  useEffect(() => {
    if (!activo) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') ref.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activo]);
}

// =============================================================================
// A) Acciones — el clúster de la DERECHA de la barra: «+ Nuevo lead» y el «⋯»
// =============================================================================
// "+ Nuevo lead" es el ÚNICO botón primario. Importar y Exportar bajan al kebab: los
// dos iconos que tenían eran la misma bandeja con la flecha para el otro lado y no se
// distinguían sin pasar el mouse por encima — además, con cada acción nueva el header
// crecía a lo ancho.
//
// ⚠️ EL «⋯» VA A LA DERECHA DEL TODO, DESPUÉS DE «+ Nuevo lead» (punto 26 del 12/10/2026:
// «Que los 3 puntos estén a la derecha del todo, no antes de "Nuevo lead"»). Y ya no hay
// header aparte: el título «CRM» con su ícono se fue (punto 22) y estas dos piezas viven en
// la MISMA fila que el selector de funnel, la vista, el buscador y «Filtrar» (punto 23:
// «Sube la topbar del todo»).

/**
 * Un renglón del menú: el ícono y el rótulo, nada más.
 *
 * ⚠️ SIN SUBTÍTULO (14/10/2026). Cada renglón llevaba debajo una línea gris que repetía el
 * rótulo con otras palabras («Baja los leads a planilla o documento»). Martín: «elimina todos
 * los subtitulos de los botones de los 3 puntos». El rótulo tiene que alcanzar solo; si no
 * alcanza, se cambia el rótulo, no se le cuelga otra línea. Por eso el renglón ni siquiera
 * acepta un `desc`: lo fija tests/crm-kebab-14-10.test.ts.
 *
 * ⚠️ EL HOVER SE QUEDA EN ESTADO DE REACT aunque el velo global ya exista
 * (`.crm-hover button:hover` en app/_ui/ui.css): acá el hover no es solo el fondo, también
 * tiñe el ícono a --primary, que el velo no puede hacer.
 *
 * (Hasta el 14/10 había un segundo tipo de renglón, el del interruptor «CRM automático», y
 * por eso el layout vivía en un hook compartido. Se fue con el interruptor.)
 */
function MenuItem({ icon, label, onClick, href }: {
  icon: ReactNode; label: string; onClick?: () => void; href?: string;
}) {
  const [hover, setHover] = useState(false);
  const style: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
    padding: '9px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: hover ? 'var(--surface-2)' : 'transparent', fontFamily: SANS, textDecoration: 'none',
  };
  const handlers = { onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) };
  const inner = (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, flex: 'none', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: hover ? 'var(--primary)' : 'var(--dim)' }}>{icon}</span>
      <span style={{ minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
    </>
  );
  return href
    ? <Link href={href} style={style} onClick={onClick} {...handlers}>{inner}</Link>
    : <button type="button" onClick={onClick} style={style} {...handlers}>{inner}</button>;
}

export function AccionesHeader({ onImportar, onExportar, onNuevo, onEditarEtapas }: {
  onImportar: () => void;
  onExportar: () => void;
  onNuevo: () => void;
  /** Abre el pop-up de etapas del funnel que el tablero está dibujando. */
  onEditarEtapas: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEscape(open, () => setOpen(false));

  return (
    <div className="crm-acciones" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 'none' }}>
      {/* ⚠️ UN BOTÓN, NO UN LINK (27/09/2026). Navegaba a /crm/new y al volver se
          perdían el filtro, la búsqueda y el scroll, y se releían los 1.142 leads —
          por un form de seis campos. Todo el resto del CRM ya son modales.
          La ruta sigue existiendo para un link directo; el form es el mismo. */}
      <button type="button" onClick={onNuevo} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: 'none', height: CTRL_H, padding: '0 18px', borderRadius: 10, border: 'none', background: 'var(--ink)', color: '#F3F5F8', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
        + Nuevo lead
      </button>

      {/* ⚠️ ACÁ HABÍA UN BOTÓN «Importar CSV» CON EL CRM VACÍO, y se fue el 29/09/2026.
          «Elimina el botón de "Importar csv", para eso ya están los 3 puntos de arriba
          del todo». Era la MISMA acción que el renglón del menú, con el mismo handler.
          De paso se lleva un bug: su condición era `total === 0`, y `total` no son los
          leads del workspace sino los del embudo que se está mirando, así que un
          producto nuevo hacía aparecer el botón con 1.146 leads en la base. */}

      {/* El «⋯», el ÚLTIMO de la fila (punto 26). Su menú abre hacia la izquierda
          (`right: 0`), así que pegado al borde no se sale de la ventana. */}
      <span style={{ position: 'relative', flex: 'none', display: 'inline-flex' }}>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Más acciones del CRM" aria-expanded={open}
          title="Importar, exportar y editar las etapas"
          // CTRL_H y no 38: ahora comparte la fila con los controles de 40 (era del header).
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: CTRL_H, height: CTRL_H, flex: 'none', borderRadius: 10, border: `1px solid ${open ? 'var(--primary)' : 'var(--border-strong)'}`, background: open ? 'var(--surface-2)' : 'var(--surface)', color: open ? 'var(--primary)' : 'var(--dim)', cursor: 'pointer', padding: 0 }}>
          <KebabIcon />
        </button>
        {open && <>
          <span onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div role="menu" style={{ position: 'absolute', top: CTRL_H + 6, right: 0, zIndex: 41, width: 306, maxWidth: 'calc(100vw - 32px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13, boxShadow: '0 16px 40px rgba(18,21,27,.18)', padding: 7, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* «Que ya no se llame "Importar csv"... Que simplemente sea "Importar
                leads"»: el pop-up ya se llamaba así, era el menú el que prometía un
                formato cuando el importador lee planilla, PDF, foto y documento. */}
            <MenuItem icon={<UploadIcon size={15} />} label="Importar leads"
              onClick={() => { setOpen(false); onImportar(); }} />
            <MenuItem icon={<DownloadIcon size={15} />} label="Exportar leads"
              onClick={() => { setOpen(false); onExportar(); }} />
            <span style={{ height: 1, background: 'var(--border)', margin: '5px 6px' }} />
            {/* ⚠️ ABRE UN POP-UP, NO UNA PANTALLA. «Quiero eliminar la ruta de funnel, que
                todo se edite como un pop-up dentro del mismo CRM». Editar las etapas
                mirando el tablero que esas etapas dibujan es la mitad del arreglo: antes
                había que irse, cambiar a ciegas y volver a ver si había quedado bien. */}
            <MenuItem icon={<FunnelIcon size={15} />} label="Editar las etapas"
              onClick={() => { setOpen(false); onEditarEtapas(); }} />
            {/* ⚠️ ACÁ HABÍA TRES RENGLONES MÁS, y se fueron el 14/10/2026. Martín: «ya
                eliminarías en los 3 puntos los botones de "avisos y resumen"... Y elimina el
                botón de "CRM Automático", para eso ya llevamos todo a Automations».
                  · «Avisos de datos sin marcar» y «Qué muestra el Resumen»: los dos modales
                    se siguen abriendo desde el engranaje de la ficha (LeadSheet,
                    LeadDetailBody, InfoPrincipalCard) hasta que llegue el constructor por
                    bloques que los reemplaza. Dos puertas al mismo modal era una de más.
                  · El interruptor «CRM automático»: se va la PERILLA, no el motor. lib/crm-auto*,
                    el cron y /api/crm-auto siguen, y el flag se prende y apaga por
                    `activar_crm_automatico` hasta que las plantillas de Automations lo
                    reemplacen. */}
          </div>
        </>}
      </span>
    </div>
  );
}

// ⚠️ ACÁ VIVÍA `DivisorHeader`, el divisor entre el pill del CRM automático y el clúster
// de acciones. Se fue con el pill (29/09: el interruptor pasó a ser un renglón del menú, y
// el 14/10 se fue también de ahí), así que en el header no quedan dos cosas que separar.

// =============================================================================
// B) Barra: selector de vista, buscador, bandas
// =============================================================================

export function VistaSelector({ vista, onVista, pendientes }: {
  vista: CrmVista;
  onVista: (v: CrmVista) => void;
  /** cuántos leads tienen datos sin marcar (0 = el segmento va sin badge). */
  pendientes: number;
}) {
  const seg = (activo: boolean): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 15px', borderRadius: 8,
    border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 14,
    fontWeight: activo ? 600 : 500,
    background: activo ? 'var(--ink)' : 'transparent',
    // `--on-ink`, no `--on-sidebar`. Coincidían en el tema por defecto, pero el
    // segundo significa «se lee sobre LA BARRA»: con la barra clara, esto quedó
    // tinta sobre tinta —ratio 1,00, el botón activo INVISIBLE— y se veía igual
    // en claro y en oscuro, así que ningún vistazo lo iba a encontrar.
    color: activo ? 'var(--on-ink)' : 'var(--dim)',
  });
  return (
    <>
    <div style={{ display: 'inline-flex', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: 4, gap: 4 }}>
      {/* ⚠️ LOS ÍCONOS SALEN DE UN SOLO LUGAR (app/_ui/iconos-vista), no de una copia.
          Son los mismos que usa el tablero de Customer Success, y el pedido fue
          justamente que el toggle se vea IGUAL en las dos pantallas: dos SVG
          «parecidos» divergen en cuanto alguien ajusta uno. El estilo del botón sí es
          de cada barra — acá el segmento con `--ink`, allá su `.bc-toggle`. */}
      {(['kanban', 'tabla'] as const).map((v) => (
        <button key={v} type="button" onClick={() => onVista(v)} style={seg(vista === v)}
          title={ICONO_VISTA[v].titulo} aria-label={ICONO_VISTA[v].titulo} aria-pressed={vista === v}>
          {ICONO_VISTA[v].icono}
        </button>
      ))}
    </div>
    </>
  );
}

// -- «Sin marcar» se mudó al panel de abajo a la derecha ---------------------
// Acá vivía `PendientesAtajo`, un chip con su contador al lado del toggle. Primero
// fue la TERCERA PESTAÑA del toggle y Martín la sacó de ahí (las otras dos muestran
// los mismos leads de otra forma; ésta mostraba una lista distinta). El 05/10 pidió
// el paso que faltaba: «"Sin marcar" ya no debería existir, debe vivir en el
// desplegable de abajo a la derecha de "MaKo movió 3 leads"».
//
// Es el mismo criterio llevado hasta el final: la barra de arriba contesta «¿cómo
// miro esto?» y el panel de abajo «¿qué me falta revisar?». Son dos preguntas y
// ahora cada una tiene su lugar — por eso el panel pasó a llamarse «A revisar».
//
// ⚠️ LA PUERTA NO SE VA CON EL CHIP. `?pendientes=1` tiene que seguir teniendo cómo
// llegar, o la cola se vuelve invisible: es el caso clásico de esta casa, sacar un
// patrón y llevarse puesto lo único que lo mostraba. Vive ahora en
// `app/_components/MakoConfirmGate.tsx`, que lee el contador de
// `/api/datos-sin-marcar-count` por su cuenta — está montado en el layout y no
// recibe props, y ésa era la razón por la que esto no se había mudado antes.

// El input NO filtra: solo reporta lo tipeado. El filtrado vive en CrmBoard y usa
// `coincideBusqueda` de lib/buscar-texto.ts — misma regla que el board del plan:
// sin acentos, por palabras sueltas en cualquier orden, y «#412» / «412» como
// pedido EXACTO del lead por su número. El placeholder tiene que DECIRLO: nadie
// prueba escribir un # en un campo que dice «Buscar…».
const BUSCAR_AYUDA = 'Buscar por nombre, empresa, email o teléfono. Para un lead puntual, su número: #412 (no distingue mayúsculas ni acentos).';

export function Buscador({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="crm-tb-buscar" style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '0 1 260px', minWidth: 110 }}>
      <LupaIcon />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar o #número de lead"
        aria-label={BUSCAR_AYUDA}
        title={BUSCAR_AYUDA}
        style={{ width: '100%', height: CTRL_H, padding: value ? '0 34px 0 36px' : '0 14px 0 36px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' }}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Limpiar la búsqueda" title="Limpiar la búsqueda"
          style={{ position: 'absolute', right: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 999, border: 'none', background: 'var(--surface-2)', color: 'var(--dim)', fontSize: 13, lineHeight: 1, cursor: 'pointer', fontFamily: SANS }}>
          ×
        </button>
      )}
    </div>
  );
}

// ── Acá vivía `BandasToggle` ──────────────────────────────────────────────────
// Los tres botones «Activo · Nutrición · Descartado» con su conteo, sueltos en la barra. Desde
// el 12/10/2026 (punto 25: «que sean un desplegable dentro de filtros») son la categoría
// «Estado» de `CrmFilterMenu`, con el mismo conteo, el mismo color de cada banda y la misma
// regla: la última prendida no se apaga.

// =============================================================================
// C) Filtros — un único menú "Filtrar (N)" (mismo patrón que el board del plan)
// =============================================================================
// Drill-down: en 'root' se ven las categorías con su resumen; al tocar una, su
// contenido reemplaza el panel EN EL MISMO LUGAR con un "‹ volver". Nunca hay más
// de una categoría en pantalla, así el panel no crece con el catálogo del cliente.

export function CrmFilterMenu({ stages, etapas, setEtapas, origenes, origen, setOrigen, listas = [], orden, bandas, abierto, setAbierto }: {
  stages: Stage[];
  etapas: Set<string>;
  setEtapas: (s: Set<string>) => void;
  origenes: string[];
  origen: Set<string>;
  setOrigen: (s: Set<string>) => void;
  /** Las categorías de lista (campaña, creativo). Una sin opciones no se ofrece. */
  listas?: ListaFiltro[];
  /** «Ordenar». Sólo en el kanban: la tabla se ordena por sus columnas. */
  orden?: OrdenFiltro;
  /** «Estado» (las bandas del Kanban). Sólo en el kanban, como «Ordenar». */
  bandas?: BandasFiltro;
  abierto: FiltroAbierto;
  setAbierto: (v: FiltroAbierto) => void;
}) {
  const open = abierto !== null;
  const [buscar, setBuscar] = useState('');
  const cerrar = () => { setAbierto(null); setBuscar(''); };
  useEscape(open, cerrar);

  // Un filtro de lista sin ninguna opción es un control que no puede cambiar nada: no se
  // dibuja (p. ej. un negocio sin Meta no tiene campañas).
  const vivas = listas.filter((l) => l.opciones.length > 0);
  const ordenOn = !!orden && orden.valor !== orden.base;
  // Cada banda APAGADA cuenta como un filtro: es lo que esconde leads del tablero.
  const bandasApagadas = bandas ? ORDEN_BANDAS.filter((b) => !bandas.activas.has(b)).length : 0;
  const elegidosDe = (l: ListaFiltro) => l.sel.size + (l.hijos?.sel.size ?? 0);
  const n = bandasApagadas + etapas.size + origen.size + listas.reduce((a, l) => a + elegidosDe(l), 0) + (ordenOn ? 1 : 0);
  const limpiar = () => { bandas?.prenderTodas(); setEtapas(new Set()); setOrigen(new Set()); for (const l of listas) { l.set(new Set()); l.hijos?.set(new Set()); } orden?.elegir(orden.base); };
  // Los grupos del árbol que la persona abrió o cerró a mano. Por defecto van ABIERTOS si
  // son pocos (con una o dos campañas, cerrarlas sólo esconde los anuncios detrás de un
  // clic) y cerrados si son muchos.
  const [alternados, setAlternados] = useState<Set<string>>(() => new Set());
  // El panel abre pegado al botón y NUNCA pasa el borde de la ventana: si lo pasara aparece
  // el scroll lateral de la página. «Bajo ningún motivo debe tener scroll hacia la derecha»
  // (Martín, 10/10/2026). Se mide al abrir y al cambiar la ventana; la cuenta es pura y con
  // test (app/crm/filtro-panel.ts). Va en layout effect para que no se pinte primero en el
  // lugar equivocado.
  const anclaRef = useRef<HTMLSpanElement>(null);
  const [lugar, setLugar] = useState<{ ancho: number; izq: number }>({ ancho: ANCHO_PANEL, izq: 0 });
  useLayoutEffect(() => {
    if (!open) return;
    const medir = () => {
      const r = anclaRef.current?.getBoundingClientRect();
      // El tope izquierdo es el borde del CONTENIDO: corrido hasta la ventana, el panel
      // queda debajo de la barra lateral.
      const contenido = anclaRef.current?.closest('main')?.getBoundingClientRect().left ?? 0;
      if (r) setLugar(lugarDelPanel(r.left, document.documentElement.clientWidth, Math.max(0, contenido) + MARGEN_VENTANA));
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [open]);
  const toggleEtapa = (k: string) => { const c = new Set(etapas); if (c.has(k)) c.delete(k); else c.add(k); setEtapas(c); };
  const toggleOrigen = (o: string) => { const c = new Set(origen); if (c.has(o)) c.delete(o); else c.add(o); setOrigen(c); };

  const check = (on: boolean): CSSProperties => ({ width: 14, height: 14, borderRadius: 4, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' });
  const rowBtn: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '7px 9px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: 'var(--ink)', textAlign: 'left', fontFamily: SANS };
  const catRow: CSSProperties = { ...rowBtn, justifyContent: 'space-between', padding: '10px 9px' };
  const resumenTxt = (activo: boolean): CSSProperties => ({ fontSize: 12, color: activo ? 'var(--primary)' : 'var(--faint)', fontWeight: activo ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 });
  const backBtn: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 6px 10px', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 700, marginBottom: 4 };
  const texto: CSSProperties = { minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  // El ancho del chevron de una campaña: los anuncios lo dejan libre a su derecha para que
  // su número quede en la misma columna que el de la campaña.
  const CHEVRON = 26;

  const etapaLabel = (k: string) => stages.find((s) => s.key === k)?.label ?? k;
  const resumen = (sel: Set<string>, label: (v: string) => string) =>
    sel.size === 0 ? 'Todas' : sel.size === 1 ? label([...sel][0]) : `${sel.size} elegidas`;

  const cats: Array<{ key: FiltroCat; label: string; resumen: string; activo: boolean }> = [
    // Primero: es lo que antes se veía a la vista en la barra, y decide qué COLUMNAS hay.
    ...(bandas ? [{
      key: 'banda' as const, label: 'Estado', activo: bandasApagadas > 0,
      resumen: bandasApagadas === 0 ? 'Todos' : ORDEN_BANDAS.filter((b) => bandas.activas.has(b)).map((b) => BAND_LABEL[b]).join(' · '),
    }] : []),
    { key: 'etapa', label: 'Etapa', resumen: resumen(etapas, etapaLabel), activo: etapas.size > 0 },
    { key: 'origen', label: 'Origen', resumen: origen.size === 0 ? 'Todos' : origen.size === 1 ? [...origen][0] : `${origen.size} elegidos`, activo: origen.size > 0 },
    ...vivas.map((l) => {
      const total = elegidosDe(l);
      const unico = total === 1
        ? (l.sel.size === 1
          ? l.opciones.find((o) => o.value === [...l.sel][0])?.label
          : Object.values(l.hijos?.de ?? {}).flat().find((h) => l.hijos?.sel.has(h.value))?.label)
        : undefined;
      return { key: l.cat, label: l.label, activo: total > 0, resumen: total === 0 ? l.todas : total === 1 ? (unico ?? '1 elegida') : `${total} elegidas` };
    }),
    ...(orden ? [{ key: 'orden' as const, label: 'Ordenar', resumen: orden.opciones[orden.valor] ?? orden.valor, activo: ordenOn }] : []),
  ];
  const lista = vivas.find((l) => l.cat === abierto) ?? null;
  const textoBuscar = buscar.trim().toLowerCase();
  const opcionesLista = lista
    ? lista.opciones.filter((o) => !textoBuscar || o.label.toLowerCase().includes(textoBuscar) || o.value.includes(textoBuscar))
    : [];
  const toggleLista = (v: string) => {
    if (!lista) return;
    const c = new Set(lista.sel);
    if (c.has(v)) c.delete(v); else c.add(v);
    lista.set(c);
  };

  // ── el ÁRBOL (una lista con hijos) ──
  const arbol = lista?.hijos ?? null;
  const hijosDe = (g: string) => arbol?.de[g] ?? [];
  const totalHijos = arbol ? Object.values(arbol.de).reduce((a, h) => a + h.length, 0) : 0;
  const coincide = (label: string, value: string) => !textoBuscar || label.toLowerCase().includes(textoBuscar) || value.includes(textoBuscar);
  // Con búsqueda, un grupo se ve si él o alguno de sus hijos coincide; y si coincide él,
  // se ven todos sus hijos (buscar la campaña es querer ver sus anuncios).
  const gruposArbol = arbol && lista
    ? lista.opciones.filter((g) => coincide(g.label, g.value) || hijosDe(g.value).some((h) => coincide(h.label, h.value)))
    : [];
  const abiertoPorDefecto = (lista?.opciones.length ?? 0) <= 3;
  const abiertoGrupo = (g: string) => !!textoBuscar || abiertoPorDefecto !== alternados.has(g);
  const alternar = (g: string) => setAlternados((prev) => { const c = new Set(prev); if (c.has(g)) c.delete(g); else c.add(g); return c; });
  // Qué tildar y destildar en el árbol lo decide app/crm/arbol-seleccion.ts (puro y con test):
  // acá sólo se lee el estado y se escribe lo que devuelve.
  const aplicar = (r: { grupos: Set<string>; hijos: Set<string> }) => { lista?.set(r.grupos); arbol?.set(r.hijos); };
  const toggleGrupo = (g: string) => {
    if (!lista || !arbol) return;
    // Lo que hace este toque: tildar la campaña entera, o destildarla.
    const elegir = !lista.sel.has(g);
    aplicar(alternarGrupo({ grupos: lista.sel, hijos: arbol.sel }, g, hijosDe(g).map((h) => h.value)));
    // Tildarla la DESPLIEGA y destildarla la PLIEGA: «Si clickeo una campaña […] quiero que
    // se abra el desplegable» y «si deselecciono se debe volver a plegar» (Martín,
    // 10/10/2026). Se ven los anuncios que acaba de elegir, y desde ahí se destilda uno.
    if (hijosDe(g).length > 0) setAlternados((prev) => conGrupoAbierto(prev, g, elegir, abiertoPorDefecto));
  };
  const toggleHijo = (g: string, h: string) => {
    if (lista && arbol) aplicar(alternarHijo({ grupos: lista.sel, hijos: arbol.sel }, g, h, hijosDe(g).map((x) => x.value)));
  };

  return (
    <span ref={anclaRef} style={{ position: 'relative', flex: 'none', display: 'inline-flex' }}>
      <button type="button" onClick={() => setAbierto(open ? null : 'root')} aria-expanded={open}
        title={n > 0 ? `${n} filtro${n === 1 ? '' : 's'} activo${n === 1 ? '' : 's'}` : 'Filtrar por etapa u origen'}
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7, flex: 'none', height: CTRL_H, padding: '0 14px', borderRadius: 10, border: `1px solid ${n > 0 ? 'var(--primary-weak)' : 'var(--border-strong)'}`, background: open ? 'var(--surface-2)' : 'var(--surface)', color: n > 0 ? 'var(--primary)' : 'var(--dim)', fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <FunnelIcon size={13} />Filtrar
        {n > 0 && (
          <span onClick={(e) => { e.stopPropagation(); limpiar(); }} title="Limpiar los filtros"
            style={{ position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>
            {n}
          </span>
        )}
      </button>
      {open && <>
        <span onClick={cerrar} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div data-filtro-panel style={{ position: 'absolute', top: 46, left: lugar.izq, zIndex: 41, width: lugar.ancho, boxSizing: 'border-box', maxHeight: 420, overflowY: 'auto', overflowX: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(18,21,27,.16)', padding: 8 }}>
          {abierto === 'root' ? (
            <>
              {/* Sin hover propio: el velo global (`.crm-hover button:hover` en
                  app/_ui/ui.css) ya lo pone. Escribirlo acá con e.currentTarget.style
                  le gana a la regla y quedan dos hovers peleando. */}
              {cats.map((c) => (
                <button key={c.key} type="button" onClick={() => { setBuscar(''); setAbierto(c.key); }} style={catRow}>
                  <span style={{ fontWeight: 600 }}>{c.label}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={resumenTxt(c.activo)} title={c.resumen}>{c.resumen}</span>
                    <span aria-hidden style={{ color: 'var(--faint)', fontSize: 16, lineHeight: 1 }}>›</span>
                  </span>
                </button>
              ))}
              {n > 0 && (
                <button type="button" onClick={limpiar}
                  style={{ ...rowBtn, justifyContent: 'center', marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 10, color: 'var(--primary)', fontWeight: 600 }}>
                  Limpiar filtros ({n})
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" onClick={() => { setBuscar(''); setAbierto('root'); }} style={backBtn}>
                <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>‹</span>
                {abierto === 'banda' ? 'Estado' : abierto === 'etapa' ? 'Etapa' : abierto === 'origen' ? 'Origen' : abierto === 'orden' ? 'Ordenar' : (lista?.label ?? '')}
              </button>
              {/* VARIAS a la vez, como los tres botones que reemplaza: el menú no vuelve a la
                  raíz al tocar. Cada banda con SU color (el del borde de sus columnas) y su
                  conteo. La última prendida no se apaga — con cero bandas el tablero se vaciaba
                  entero sin nada que explicara por qué —, y se dice en su `title`. */}
              {abierto === 'banda' && bandas && ORDEN_BANDAS.map((b) => {
                const on = bandas.activas.has(b);
                const ultima = on && bandas.activas.size === 1;
                return (
                  <button key={b} type="button" onClick={() => bandas.alternar(b)} style={{ ...rowBtn, cursor: ultima ? 'default' : 'pointer' }} aria-pressed={on}
                    title={ultima ? 'Tiene que quedar al menos uno a la vista' : on ? `Ocultar ${BAND_LABEL[b]}` : `Mostrar ${BAND_LABEL[b]}`}>
                    <span style={check(on)}>{on ? '✓' : ''}</span>
                    <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY[bandToCategory(b)].c, flex: 'none' }} />
                    <span style={{ ...texto, flex: 1 }}>{BAND_LABEL[b]}</span>
                    <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{bandas.conteo(b)}</span>
                  </button>
                );
              })}
              {/* UNA opción a la vez: elegir vuelve a la raíz, donde se ve el resumen. */}
              {abierto === 'orden' && orden && Object.entries(orden.opciones).map(([k, label]) => (
                <button key={k} type="button" onClick={() => { orden.elegir(k); setAbierto('root'); }} style={rowBtn} aria-pressed={orden.valor === k}>
                  <span style={{ ...check(orden.valor === k), borderRadius: 999 }}>{orden.valor === k ? '✓' : ''}</span>
                  <span style={texto}>{label}</span>
                </button>
              ))}
              {/* Con muchas campañas o anuncios, buscar es lo que hace usable la lista. */}
              {lista && lista.opciones.length + totalHijos > 8 && (
                <input autoFocus value={buscar} onChange={(e) => setBuscar(e.target.value)}
                  placeholder={`Buscar ${lista.label.toLowerCase()}`} aria-label={`Buscar ${lista.label.toLowerCase()}`}
                  style={{ width: '100%', boxSizing: 'border-box', margin: '2px 0 6px', padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 12.5, outline: 'none' }} />
              )}
              {lista && arbol && (gruposArbol.length === 0
                ? <div style={{ padding: '10px 9px', fontSize: 12.5, color: 'var(--faint)' }}>Ninguna con esa búsqueda.</div>
                : gruposArbol.map((g) => {
                  const hijos = hijosDe(g.value).filter((h) => !textoBuscar || coincide(g.label, g.value) || coincide(h.label, h.value));
                  const entero = lista.sel.has(g.value);
                  const parcial = !entero && hijosDe(g.value).some((h) => arbol.sel.has(h.value));
                  const abierto = abiertoGrupo(g.value);
                  return (
                    <div key={g.value}>
                      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                        {/* La fila elige la campaña entera (y la despliega, o la pliega al
                            destildarla); el chevron, a la DERECHA siempre («El botón de
                            desplegar debe estar a la derecha», Martín, 10/10/2026), sólo abre o
                            cierra. No comparten botón: abrir o cerrar para mirar los anuncios no
                            puede filtrar por accidente. */}
                        <button type="button" onClick={() => toggleGrupo(g.value)} style={{ ...rowBtn, flex: 1 }} title={g.label} aria-pressed={entero}>
                          <span style={check(entero || parcial)}>{entero ? '✓' : parcial ? '–' : ''}</span>
                          <span style={{ ...texto, flex: 1, fontWeight: 600 }}>{g.label}</span>
                          <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{g.n}</span>
                        </button>
                        <button type="button" onClick={() => alternar(g.value)} disabled={hijos.length === 0}
                          aria-label={abierto ? `Cerrar ${g.label}` : `Abrir ${g.label}`} aria-expanded={abierto}
                          style={{ flex: 'none', width: CHEVRON, height: 28, border: 'none', background: 'transparent', cursor: hijos.length ? 'pointer' : 'default', color: 'var(--faint)', fontSize: 15, padding: 0, visibility: hijos.length ? 'visible' : 'hidden' }}>
                          <span aria-hidden style={{ display: 'inline-block', transform: abierto ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform .12s' }}>›</span>
                        </button>
                      </div>
                      {abierto && hijos.map((h) => {
                        const on = entero || arbol.sel.has(h.value);
                        return (
                          <button key={h.value} type="button" onClick={() => toggleHijo(g.value, h.value)} style={{ ...rowBtn, paddingLeft: 32, paddingRight: 9 + CHEVRON }} title={h.label} aria-pressed={on}>
                            <span style={check(on)}>{on ? '✓' : ''}</span>
                            <span style={{ ...texto, flex: 1 }}>{h.label}</span>
                            <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{h.n}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                }))}
              {lista && !arbol && (opcionesLista.length === 0
                ? <div style={{ padding: '10px 9px', fontSize: 12.5, color: 'var(--faint)' }}>Ninguna con esa búsqueda.</div>
                : opcionesLista.map((o) => (
                  <button key={o.value} type="button" onClick={() => toggleLista(o.value)} style={rowBtn} title={o.label}>
                    <span style={check(lista.sel.has(o.value))}>{lista.sel.has(o.value) ? '✓' : ''}</span>
                    <span style={{ ...texto, flex: 1 }}>{o.label}</span>
                    <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{o.n}</span>
                  </button>
                )))}
              {abierto === 'etapa' && stages.map((s) => (
                <button key={s.key} type="button" onClick={() => toggleEtapa(s.key)} style={rowBtn} title={s.label}>
                  <span style={check(etapas.has(s.key))}>{etapas.has(s.key) ? '✓' : ''}</span>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flex: 'none' }} />
                  <span style={texto}>{s.label}</span>
                </button>
              ))}
              {abierto === 'origen' && (origenes.length === 0
                ? <div style={{ padding: '10px 9px', fontSize: 12.5, color: 'var(--faint)' }}>Todavía no hay orígenes cargados.</div>
                : origenes.map((o) => (
                  <button key={o} type="button" onClick={() => toggleOrigen(o)} style={rowBtn} title={o}>
                    <span style={check(origen.has(o))}>{origen.has(o) ? '✓' : ''}</span>
                    <span style={texto}>{o}</span>
                  </button>
                )))}
            </>
          )}
        </div>
      </>}
    </span>
  );
}

// ── Sin chips de filtros activos ──────────────────────────────────────────────
// Hubo una fila de chips (uno por categoría) debajo de la barra, con su «Limpiar». Se sacó el
// 10/10/2026 a pedido de Martín: el número sobre «Filtrar» ya dice que hay filtros, y el
// «Limpiar filtros» vive abajo del menú, como en el Plan. tests/crm-filtro-ads.test.ts frena
// que vuelva.

// ── Qué funnel dibuja el tablero ─────────────────────────────────────────────
// Acá vivía «1.142 de 1.142», que repetía los conteos de las bandas que están al
// lado y no se usaba para nada. Pedido del dueño (26/09): ese lugar es para
// elegir la oferta/funnel. Cambiar de funnel es cambiar de página (`?funnel=`):
// las etapas se leen en el server, no hay estado que sincronizar.
/** Valor centinela del renglón que no es un funnel sino una salida. */
const NUEVA = '__nueva';
/** El otro renglón que no es un funnel sino una salida: los que se eliminaron. */
const ARCHIVADOS = '__archivados';

export function SelectorFunnel({ funnels, activo, onEditarEtapas }: {
  funnels: { id: number; nombre: string; esDefault: boolean; producto?: string | null }[];
  activo: number | null;
  /** Abre el pop-up de etapas de UN funnel de la lista, que no tiene por qué ser el activo. */
  onEditarEtapas: (funnelId: number, nombre: string) => void;
}) {
  const router = useRouter();
  const ws = useWs();
  const [creando, setCreando] = useState(false);
  const [archivados, setArchivados] = useState(false);
  const [hayArchivados, setHayArchivados] = useState(false);
  // ⚠️ SE RE-PREGUNTA CUANDO CAMBIA LA LISTA DE EMBUDOS, no sólo al montar. Medido en el
  // navegador el 29/09/2026: se eliminó «Prueba 2» —la fila quedó `activo=false` en la base,
  // correcto— y el renglón «Embudos eliminados» NO apareció, porque este efecto había
  // corrido una sola vez con cero archivados. O sea que la puerta de vuelta se volvía
  // invisible justo después de la ÚNICA acción que crea algo para recuperar, y el archivado
  // quedaba indistinguible de un borrado.
  //
  // `funnels` baja del server, así que cambia exactamente cuando hay algo nuevo que contar.
  const cuantosFunnels = funnels.length;
  useEffect(() => {
    let vivo = true;
    void embudosArchivadosAction().then((f) => { if (vivo) setHayArchivados(f.length > 0); }).catch(() => {});
    return () => { vivo = false; };
  }, [cuantosFunnels]);
  if (funnels.length === 0) return null;
  const actual = funnels.find((f) => f.id === activo) ?? funnels.find((f) => f.esDefault) ?? funnels[0];
  // ⚠️ SE MUESTRA EL PRODUCTO, NO EL FUNNEL. «Funnel principal» es el nombre que
  // puso la migración y es el mismo en todos los workspaces: no le dice nada a
  // nadie y encima obliga a pensar en la estructura en vez de en lo que se vende.
  // Sin producto asociado se cae al nombre del funnel, que es lo que había.
  const comoSeLlama = nombreVisible;
  // Sin `sub`: el nombre del producto ya dice qué es. «el de tu negocio» debajo del
  // único producto que hay era un renglón para no decir nada.
  // ⚠️ CADA FILA LLEVA SU LAPIZ, y es lo que pidio Martin: «al lado de cada uno debe
  // aparecer el boton de editar, para editar las etapas de ese funnel». El `Dropdown` ya
  // sabe dibujar acciones por renglon (`acciones`), asi que no hizo falta tocar el
  // primitive — lo que faltaba era usarlo.
  //
  // ⚠️ EL LAPIZ ABRE UN POP-UP Y NO NAVEGA, y eso saca de raiz el bug que estaba escrito
  // aca: el CRM viaja con `?funnel=` y /funnel leia `?f=`, asi que pasar el id con el
  // nombre equivocado abria el funnel del negocio en silencio. Sin URL en el medio no hay
  // dos convenciones que mantener de acuerdo.
  //
  // ⚠️ Y SE ABRE EL DE ESA FILA, no el del tablero. Desde «Curso» se puede editar el
  // embudo de «Mentoria» sin cambiar de tablero: por eso el pop-up va a buscar las etapas
  // del funnel que se le nombra en vez de usar las que la pantalla ya tiene.
  // ⚠️ EL QUE SE ESTÁ MIRANDO VA PRIMERO: «el producto que estoy parado debería estar
  // primero en las opciones». Es el ancla de la lista — abrir un desplegable y tener que
  // buscar dónde quedó lo que ya está elegido es trabajo que la pantalla puede ahorrar.
  const enOrden = [actual, ...funnels.filter((f) => f.id !== actual.id)];
  const opciones: DropdownOption[] = enOrden.map((f) => ({
    value: String(f.id),
    label: comoSeLlama(f),
    acciones: [{
      icono: <LapizIcon />,
      title: `Editar las etapas de ${comoSeLlama(f)}`,
      onClick: () => onEditarEtapas(f.id, comoSeLlama(f)),
    }],
  }));
  // ⚠️ `crear`, NO `color`. El intento anterior fue `color: 'var(--faint)'` creyendo que
  // teñía el texto: `color` en un DropdownOption dibuja un PUNTO de 9 px, así que el
  // renglón salió con una bolita gris al lado y el texto igual de negro que los demás.
  // El flag `crear` es el que apaga la fila y la enciende al pasar el cursor.
  //
  // ⚠️ SE LLAMA «NUEVO CRM» Y VA ARRIBA DE TODO (13/10/2026). Martín: «que ya no se llame
  // "Funnels" sino que "Nuevo CRM", así es más entendible y fácil... Y que la opción de
  // nuevo esté arriba del desplegable, no abajo». El que se está mirando sigue siendo el
  // primero de los TABLEROS: la salida para crear no es un tablero.
  opciones.unshift({ value: NUEVA, label: 'Nuevo CRM', crear: true });
  // ⚠️ LA PUERTA DE VUELTA. Eliminar un producto lo ARCHIVA —la fila y sus leads quedan
  // enteros— pero sin una pantalla que los nombre, para la persona desapareció igual: una
  // copia de seguridad que nadie puede ver no es una copia de seguridad. El renglón sólo
  // se dibuja cuando hay alguno, para no ofrecer una lista vacía todos los días.
  //
  // ⚠️ Y VA `sutil`, NO `crear`: «debe ser mucho más sutil, solo un texto» (Martín,
  // 30/09/2026). Con `crear` salía con el mismo `＋` y el mismo peso que «Nuevo producto»,
  // y dos renglones con el mismo peso son dos acciones con el mismo peso — pero una se usa
  // todas las semanas y la otra casi nunca.
  if (hayArchivados) opciones.push({ value: ARCHIVADOS, label: 'CRM eliminados', sutil: true });
  // ⚠️ EL ANCHO VA EN EL DROPDOWN, NO EN UN ENVOLTORIO. Estaba `<span minWidth:190>`
  // alrededor de un Dropdown sin `width`, que se dibuja del tamaño de su contenido:
  // el span medía 190 y el botón 166,7, así que quedaban 23,3 px muertos a la derecha
  // y el control no llegaba al borde. Medido el 27/09/2026 reproduciendo las dos filas
  // del CRM en el navegador: 23,3 px de desfase con el envoltorio, 0 con el ancho en el
  // Dropdown. Se reportó DOS veces como «no está alineado con Nuevo lead».
  //
  //
  // ⚠️ VA PRIMERO EN LA FILA, a la izquierda del todo y antes de «Kanban/Tabla» (punto 24 del
  // 12/10/2026: «Que el desplegable de FUNNELS esté a la izquierda del todo, previo a los
  // botones de "Kanban/tabla". Y que siempre tenga el ícono del cubo»). Antes era el último,
  // alineado con «+ Nuevo lead» del header, que ya no existe: el funnel es QUÉ tablero se mira,
  // y eso se lee antes que cómo se lo mira.
  //
  // ⚠️ EL CUBO VA EN `icono`, NO EN CADA OPCIÓN: es el ícono de lo que el control ES (un
  // funnel), fijo, diga lo que diga el elegido. En las opciones no va: cada funnel lo nombra
  // el negocio, y un mismo dibujo repetido en cada renglón no distingue a ninguno (regla de
  // app/_ui/iconos-menu.tsx).
  return (
    <span style={{ flex: 'none' }}>
      <Dropdown
        value={String(actual.id)}
        options={opciones}
        width={190}
        icono={<IconoMenu nombre="producto" size={15} />}
        ariaLabel="CRM que dibuja el tablero"
        onChange={(v) => {
          // ⚠️ SE RESUELVE ACÁ, NO EN OTRA PANTALLA. Hasta el 27/09/2026 esto hacía
          // `router.push('/second-brain?area=oferta')`: sacaba a la persona del CRM,
          // le pedía armar la oferta en el cerebro y que volviera. «No tiene sentido
          // que al apretar nuevo producto me lleve al second brain, todo se debe
          // resolver dentro del CRM».
          if (v === NUEVA) { setCreando(true); return; }
          if (v === ARCHIVADOS) { setArchivados(true); return; }
          const f = funnels.find((x) => x.id === Number(v));
          // El del negocio va sin parámetro: la URL del CRM no se ensucia por defecto.
          router.push(f?.esDefault ? '/crm' : `/crm?funnel=${v}`);
        }}
      />
      {creando && (
        <NuevoProductoModal
          onCerrar={() => setCreando(false)}
          onCreado={(funnelId) => { setCreando(false); router.push(`/crm?funnel=${funnelId}`); }}
        />
      )}
      {archivados && (
        <ArchivadosModal
          onCerrar={() => setArchivados(false)}
          // ⚠️ NAVEGACIÓN DURA, igual que al eliminar y por lo mismo: con `push + refresh()` la
          // lista quedaba UN PASO ATRÁS y la recuperación parecía no haber pasado, con la fila
          // ya en `activo=true` en la base. Lo que cambia es QUÉ EMBUDOS EXISTEN, no una tarjeta.
          onRestaurado={(funnelId) => { window.location.href = conWs(`/crm?funnel=${funnelId}`, ws); }}
        />
      )}
    </span>
  );
}

/** Una opción de una lista de elegir: la misma caja para «cómo lo vendes» y «cómo te llega». */
function Opcion({ label, desc, on, onClick }: { label: string; desc?: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '11px 14px', borderRadius: 10, fontFamily: SANS,
        border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border-strong)'),
        background: on ? 'var(--primary-weak)' : 'var(--surface-2)',
      }}>
      <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
      {desc && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>{desc}</span>}
    </button>
  );
}

/**
 * Alta de un producto: TRES preguntas, UNA POR PANTALLA.
 *
 * ⚠️ ERAN LAS TRES JUNTAS Y SE PARTIÓ: «Nuevo producto hazlo modular el formulario, en 3
 * pasos, no todo junto» (29/09/2026). Las tres son hechos del negocio que quien crea el
 * producto sabe de memoria —cómo se llama, cómo lo vende, cómo le llega la gente— pero
 * juntas son once cajas de una sola vez, y once cajas se leen como un formulario.
 *
 * ⚠️ Y EL ALTO ES FIJO. Los tres pasos miden distinto (un input contra cinco opciones), así
 * que sin esto la caja se encoge y se estira a cada «Siguiente»: es lo mismo que el dueño
 * pidió dos veces para la ficha —«JAMÁS achiques el tamaño de un detail según lo que
 * contenga dentro»— y acá pasa entre dos pantallas de la misma tarea.
 *
 * ⚠️ Y CADA PASO VALIDA LO SUYO. Un error que se descubre al final manda a buscar cuál de
 * las tres preguntas fue; validando al avanzar, el aviso sale en la pantalla donde se
 * arregla.
 */
function NuevoProductoModal({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: (funnelId: number) => void }) {
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState('');
  // ⚠️ SIN DEFAULT. Preseleccionar «Llamada de venta» haría que el 90% cree su tablero con
  // las etapas de otro negocio sin darse cuenta — que es exactamente el bug que esto viene
  // a cerrar, con un paso más de por medio. Se elige, o no hay producto.
  const [canal, setCanal] = useState<string>('');
  // ⚠️ CÓMO ENTRA LA GENTE SE PREGUNTA ACÁ, al crear el producto. Era una subtab del
  // pop-up y se mudó: «eso debería estar como un paso al momento de crear un nuevo
  // producto». Sigue editándose después, desde el lápiz de la etapa de entrada.
  const [entradas, setEntradas] = useState<EntradaId[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [guardando, startGuardar] = useTransition();

  const crear = () => {
    setErr(null);
    startGuardar(async () => {
      const r = await crearProductoAction(nombre.trim(), canal);
      if ('error' in r) { setErr(r.error); return; }
      // Las entradas se declaran DESPUÉS de que el embudo existe: son suyas, no del
      // negocio, y hasta que hay fila no hay dónde escribirlas. Si esto falla, el
      // producto igual quedó creado — se declara desde su lápiz.
      await declararEntradasAction(entradas, null, r.funnelId).catch(() => {});
      onCreado(r.funnelId);
    });
  };

  /** Avanzar valida ESTE paso. El último crea. */
  const seguir = () => {
    if (paso === 0 && !nombre.trim()) { setErr('Ponle un nombre.'); return; }
    if (paso === 1 && !canal) { setErr('Elige una.'); return; }
    if (paso === 2 && !entradas.length) { setErr('Elige al menos una.'); return; }
    setErr(null);
    if (paso === 2) crear(); else setPaso(paso + 1);
  };

  const titulos = [
    { t: '¿Cómo se llama?', s: undefined as string | undefined },
    { t: '¿Cómo lo vendes?', s: 'De esto salen las etapas de su tablero.' },
    { t: '¿Cómo te llega la gente?', s: 'Hasta tres.' },
  ];

  return (
    <Modal
      titulo={titulos[paso].t}
      encabezado={`Nuevo CRM · ${paso + 1} de 3`}
      etiqueta={`Nuevo CRM, paso ${paso + 1} de 3: ${titulos[paso].t}`}
      ancho={560}
      alto="min(80vh, 520px)"
      sinFiletes
      onCerrar={onCerrar}
      pie={(<>
        {/* Atrás va a la izquierda del todo y sólo cuando hay adónde volver: un botón
            apagado en el primer paso se lee como que la pantalla está rota. */}
        {paso > 0 && (
          <button type="button" onClick={() => { setErr(null); setPaso(paso - 1); }} disabled={guardando}
            style={{ marginRight: 'auto', padding: '10px 16px', fontSize: 14, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: SANS }}>Atrás</button>
        )}
        <button type="button" onClick={onCerrar} disabled={guardando}
          style={{ padding: '10px 16px', fontSize: 14, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
        <button type="button" onClick={seguir} disabled={guardando}
          style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: guardando ? 'default' : 'pointer', fontFamily: SANS, opacity: guardando ? 0.7 : 1 }}>
          {paso < 2 ? 'Siguiente' : guardando ? 'Creando…' : 'Crear CRM'}
        </button>
      </>)}
    >
      {/* ⚠️ UN SOLO HIJO DIRECTO. `.mk-modal__cuerpo > *` le pone 18 px arriba y abajo a
          CADA hijo del cuerpo: con la aclaración y las opciones sueltas quedaban ~48 px
          de hueco en el medio, que se lee como que falta algo ahí. */}
      <div>
      {titulos[paso].s && <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--faint)' }}>{titulos[paso].s}</p>}

      {paso === 0 && (
        <input
          type="text" value={nombre} autoFocus aria-label="Nombre del CRM"
          onChange={(e) => { setErr(null); setNombre(e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter') seguir(); }}
          // ⚠️ EL PLACEHOLDER NO NOMBRA A UN CLIENTE. Decía «Sistema DOS™», que es el
          // producto de Mauricio: «eso está muy mal. Jamás lo hagas». Un ejemplo tiene
          // que ser genérico, o no ser un ejemplo.
          placeholder="Mentoría, curso, consultoría…"
          style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
        />
      )}

      {/* ⚠️ DE ACÁ SALEN LAS ETAPAS del tablero de este producto, y por eso se pregunta.
          Hasta el 28/09/2026 no se preguntaba nada y el funnel nacía sin etapas, así que
          caía a la plantilla genérica — que en un workspace que nunca tocó su funnel es
          IDÉNTICA a la del negocio. Tres productos nuevos se veían los tres iguales, y se
          reportó tres veces como «no cambió absolutamente nada». */}
      {paso === 1 && (
        <div style={{ display: 'grid', gap: 7 }}>
          {CANALES.map((c) => (
            <Opcion key={c.id} label={c.label} desc={c.desc} on={canal === c.id}
              onClick={() => { setErr(null); setCanal(c.id); }} />
          ))}
        </div>
      )}

      {/* ⚠️ Y ESTO NO ES LO MISMO que «cómo lo vendes»: una dice por dónde LLEGA y la otra
          cómo se CIERRA. De ésta salen los audios que MaKo pide y lo que dice en la primera
          frase — sin declararla se abstiene de escribir, que es lo correcto y también lo
          que se lee como que no anda. */}
      {paso === 2 && (
        <div style={{ display: 'grid', gap: 7 }}>
          {ENTRADAS_OFRECIDAS.map((id) => ENTRADAS[id]).filter(Boolean).map((e) => (
            <Opcion key={e.id} label={e.label} on={entradas.includes(e.id)}
              onClick={() => { setErr(null); setEntradas((pv) => (pv.includes(e.id) ? pv.filter((x) => x !== e.id) : [...pv, e.id].slice(0, 3))); }} />
          ))}
        </div>
      )}

      {err && (
        <div style={{ marginTop: 12, borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 600, background: 'var(--bad-bg)', color: 'var(--bad)' }}>{err}</div>
      )}
      </div>
    </Modal>
  );
}
// ── vacío por filtros (kanban): antes solo la tabla avisaba ──────────────────
export function SinResultados({ hayFiltros, onLimpiar }: { hayFiltros: boolean; onLimpiar: () => void }) {
  // ⚠️ SIN FILTROS NO DIBUJA NADA. «Elimina todo el recuadro de "Todavía no hay leads
  // para mostrar / Importa un CSV o carga tu primer lead para empezar"». Un tablero vacío
  // ya se ve vacío, y las dos salidas que el cartel nombraba («+ Nuevo lead», «Importar
  // leads») están arriba a la derecha, a la vista.
  //
  // La rama de FILTROS se queda: filtrar hasta cero y no recibir ningún aviso se lee como
  // que el tablero se rompió, y es el único lugar donde se cuenta que se puede buscar por
  // número de lead.
  if (!hayFiltros) return null;
  return (
    <div style={{ padding: '44px 30px', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
        Sin resultados para estos filtros
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 5 }}>
        {/* El momento en que uno está trabado es EL momento para contar que se puede
            buscar por número: decirlo solo en el placeholder llega tarde. */}
        Prueba con menos filtros, otras palabras sueltas, o el número del lead (#412).
      </div>
      <button type="button" onClick={onLimpiar}
        style={{ marginTop: 16, padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
        Limpiar filtros
      </button>
    </div>
  );
}

/**
 * Los embudos eliminados, para recuperarlos.
 *
 * ⚠️ ESTO ES LA MITAD QUE HACE QUE «ELIMINAR» NO SEA UN BORRADO. Archivar deja la fila
 * entera —el pipeline, las entradas, las nutriciones, y los leads con su `funnel_id`
 * apuntando ahí— pero eso sólo vale si existe la puerta de vuelta. Pedido de Martín:
 * «siempre guardando una copia de seguridad... por si el usuario lo quiere recuperar».
 */
function ArchivadosModal({ onCerrar, onRestaurado }: { onCerrar: () => void; onRestaurado: (funnelId: number) => void }) {
  const [filas, setFilas] = useState<Array<{ id: number; nombre: string; leads: number }> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [trabajando, startTrabajo] = useTransition();
  /** Cuál se va a borrar PARA SIEMPRE. El diálogo es lo único que separa de lo irreversible. */
  const [borrar, setBorrar] = useState<{ id: number; nombre: string; leads: number } | null>(null);

  useEffect(() => {
    let vivo = true;
    void embudosArchivadosAction().then((f) => { if (vivo) setFilas(f); }).catch((e) => { if (vivo) setErr(String(e)); });
    return () => { vivo = false; };
  }, []);

  const restaurar = (id: number) => {
    startTrabajo(async () => {
      const r = await restaurarEmbudoAction(id);
      if (!r.ok) { setErr(r.error); return; }
      onRestaurado(id);
    });
  };

  return (
    <Modal
      titulo="CRM eliminados"
      ancho={520}
      onCerrar={onCerrar}
      pie={(
        <button type="button" onClick={onCerrar}
          style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
          Cerrar
        </button>
      )}
    >
      {filas === null && !err && <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: 0 }}>Cargando…</p>}
      {filas?.length === 0 && (
        <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: 0 }}>No eliminaste ningún funnel.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(filas ?? []).map((f) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <span style={{ flex: 1, minWidth: 0, fontFamily: SANS, fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.nombre}</span>
            {/* El número es el dato que decide cuál recuperar, y es lo único que se dibuja
                al lado del nombre. Un -1 significa que no se pudo contar: no se inventa un 0. */}
            {f.leads >= 0 && (
              <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 999 }}>
                {f.leads} {f.leads === 1 ? 'lead' : 'leads'}
              </span>
            )}
            <button type="button" disabled={trabajando} onClick={() => restaurar(f.id)}
              style={{ flex: 'none', padding: '7px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: trabajando ? 'default' : 'pointer' }}>
              Recuperar
            </button>
            {/* ⚠️ BORRAR DE VERDAD VA COMO TEXTO ROJO, no como botón: es el mismo criterio
                que «Eliminar producto» en el pop-up del embudo. Dos botones del mismo peso
                en una fila dejan la acción irreversible a la misma distancia que la que se
                deshace sola, y acá una de las dos no tiene vuelta. */}
            <button type="button" disabled={trabajando} onClick={() => { setErr(null); setBorrar(f); }}
              style={{ flex: 'none', background: 'none', border: 'none', padding: 0, color: 'var(--bad)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: trabajando ? 'default' : 'pointer' }}>
              Borrar
            </button>
          </div>
        ))}
      </div>
      {err && (
        <div style={{ marginTop: 12, borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 600, background: 'var(--bad-bg)', color: 'var(--bad)' }}>{err}</div>
      )}

      {/* ⚠️ LA CONSECUENCIA VA PEGADA AL BOTÓN Y NOMBRA A LA GENTE. Borrar el producto no
          borra a sus leads —son personas, no configuración— pero SÍ los cambia de tablero,
          y eso hay que decirlo antes, no después. Lo que sí se pierde para siempre son sus
          etapas y sus secuencias de nutrición. */}
      {borrar && (
        <Confirm
          title={`Borrar «${borrar.nombre}» para siempre`}
          message={borrar.leads > 0
            ? `Sus ${borrar.leads} ${borrar.leads === 1 ? 'lead pasa' : 'leads pasan'} a tu funnel principal. Se pierden sus etapas y su nutrición, y esto no se puede deshacer.`
            : 'Se pierden sus etapas y su nutrición, y esto no se puede deshacer.'}
          confirmLabel="Borrar para siempre"
          onCancel={() => setBorrar(null)}
          onConfirm={() => {
            const f = borrar;
            startTrabajo(async () => {
              const r = await eliminarEmbudoDefinitivoAction(f.id);
              if (!r.ok) { setErr(r.error); setBorrar(null); return; }
              setBorrar(null);
              setFilas((p) => (p ?? []).filter((x) => x.id !== f.id));
              // Si su gente cambió de tablero, el de atrás está mostrando otra cosa.
              if (r.rescatados > 0) onRestaurado(f.id);
            });
          }}
          loading={trabajando}
        />
      )}
    </Modal>
  );
}
