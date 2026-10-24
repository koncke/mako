'use client';

// =============================================================================
// LeadTabs — las HOJAS de la ficha del lead, como TABS: todas del mismo rango, la abierta subrayada
// =============================================================================
// Genérico: recibe la lista de hojas con su contenido (ReactNode, server components incluidos). Lo monta la ficha
// compartida (./ficha/FichaPorBloques.tsx), la misma en el pop-up y en la ruta /crm/[id].
//
// 24/10/2026 — DE «TÍTULO CON DESPLEGABLE» A TABS. Martín, con la captura de un lead de Mauricio: «rediseña el estilo de las
// tabs, me refiero a los botones de las tabs, donde está el desplegable en la primera... No creo que sea el mejor diseño ese,
// mira como lo hacen otras apps». El problema era de JERARQUÍA: «Resumen ▾» (19 px, en negrita, con flecha) se leía como el
// título de la página con un desplegable, y las otras cuatro como links sueltos al lado. Venía de dos pedidos que este
// reemplaza: el 16/10 («el sistema para cambiar de hoja exactamente el mismo que tenemos en Dashboard y General, el desplegable
// del título») y el 22/10 (Mauricio no encontraba «Pagos» adentro del desplegable, y se sumaron las otras como atajos).
// Ahora es lo que hacen Stripe, HubSpot y Notion en la ficha de un registro:
//   · las hojas son TABS iguales (mismo texto, mismo peso); la abierta va en tinta con un subrayado azul sobre la línea;
//   · «＋ Nueva hoja» al FINAL de la fila (el «+» de las vistas de Notion), no adentro de un desplegable;
//   · lo que hacía el desplegable con cada hoja (Templates, Duplicar, Subir, Bajar, Eliminar) va en el menú de ESA tab: clic
//     derecho sobre cualquiera, o la flechita que aparece en la abierta al pasar el cursor (siempre, en una pantalla táctil);
//   · el nombre se sigue cambiando EN LA TAB MISMA, con un clic sobre la abierta (Martín, 17/10: «el Nombre se cambia en el
//     título mismo»), o desde su menú, «Cambiar nombre». Sin doble clic;
//   · si no entran, la fila se desplaza de costado con un fundido en el borde, y la abierta se trae a la vista. En el
//     teléfono es la misma fila (sin «Nueva hoja» ni el menú: ahí no se personaliza la ficha).
// ⚠️ LAS HOJAS YA VISITADAS QUEDAN MONTADAS (ocultas con display:none): cambiar de hoja no descarta estado del cliente (un
//    insight recién generado, un chat cargado).

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { EditableInline } from '@/app/_components/EditableInline';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { Flotante } from './ficha/Flotante';

/** Lo que ofrece el menú de una hoja. */
export type OpcionHoja = { texto: string; icono: NombreIconoMenu; onElegir: () => void; deshabilitada?: boolean; peligro?: boolean };

export type LeadTabDef = {
  key: string;
  label: string;
  content: ReactNode;
  badge?: number;
  /** Se le puede cambiar el nombre en la tab (con `onRenombrar`). */
  renombrable?: boolean;
  /** El menú de su tab. Sin opciones (y sin poder renombrarla), sin menú. */
  opciones?: OpcionHoja[];
};

export function LeadTabs({ tabs, initial, onChange, actions, fija, irA, onRenombrar, maxNombre = 24, onNueva, sangria, onActiva }: {
  tabs: LeadTabDef[];
  initial?: string;
  onChange?: (key: string) => void;
  /** A la derecha de las tabs (el botón Editar y el «⋯»). */
  actions?: ReactNode;
  /**
   * LA FILA DE TABS QUEDA PEGADA ARRIBA al scrollear, con el fondo de quien la contiene.
   *
   * Pedido de Martín (12/10/2026, punto 16): «Cuando hago scroll por el modal, las tabs de arriba
   * deben acompañar el scroll. Deben permanecer fijas, como todo lo que esta arriba».
   *
   * ⚠️ UN STICKY SE PEGA A SU ANCESTRO QUE SCROLLEA, y ese ancestro tiene que TENER ALTO (AGENTS.md:
   * un `overflow-y: auto` sin alto crece con su contenido y no scrollea nunca). En el pop-up es el
   * cuerpo de la ficha (`flex: 1; minHeight: 0; overflowY: auto` adentro de un panel con alto
   * topeado); en la ruta /crm/[id], el documento. Por eso esta fila no puede vivir adentro de nada
   * con `overflow`: la raíz de LeadTabs no lleva ninguno (el desplazamiento de costado es de la lista de tabs, adentro).
   *
   * `arriba`: dónde se pega. En la ruta (pegada a la VENTANA) va debajo de la barra de inspección (#850); en el pop-up,
   * que scrollea adentro, en 0.
   */
  fija?: { fondo: string; arriba?: string };
  /**
   * Cambiar de hoja DESDE AFUERA: «solucionar» un dato sin marcar lleva a la hoja donde vive su campo
   * (13/10/2026), y una hoja recién creada se abre sola. `n` cambia en cada pedido, así pedir dos veces la
   * misma hoja vuelve a correr el efecto aunque ya se esté ahí.
   */
  irA?: { key: string; n: number } | null;
  /** El nombre nuevo de una hoja `renombrable`, cambiado en su tab. Vacío = el de siempre: quien monta decide. */
  onRenombrar?: (key: string, nombre: string) => void;
  /** El largo máximo del nombre. */
  maxNombre?: number;
  /** «＋ Nueva hoja», al final de la fila. Sin esto, no se ofrece. */
  onNueva?: () => void;
  /** Cuánto se corren las tabs a la derecha para quedar a la altura del nombre del lead (un largo de CSS). */
  sangria?: string;
  /** Cada vez que cambia la hoja que se ve (por una tab o desde afuera): el chat de edición la necesita. */
  onActiva?: (key: string) => void;
}) {
  const initKey = initial && tabs.some((t) => t.key === initial) ? initial : tabs[0]?.key ?? '';
  const [tab, setTab] = useState<string>(initKey);
  const [visitadas, setVisitadas] = useState<string[]>([initKey]);
  /** El menú abierto: de qué tab y anclado a qué. */
  const [menu, setMenu] = useState<{ key: string; ancla: HTMLElement } | null>(null);
  /** «Cambiar nombre» pedido desde el menú: cuando esa tab esté abierta, se pone a editar su nombre. */
  const [aRenombrar, setARenombrar] = useState<string | null>(null);
  const lista = useRef<HTMLDivElement>(null);
  /** Hay tabs tapadas a la izquierda o a la derecha: ese borde se funde. */
  const [bordes, setBordes] = useState<{ izq: boolean; der: boolean }>({ izq: false, der: false });
  const base = useId();
  const idTab = (key: string) => `${base}-tab-${key}`;
  const idPanel = `${base}-hoja`;

  const ir = useCallback((key: string) => {
    setTab(key);
    setVisitadas((v) => (v.includes(key) ? v : [...v, key]));
  }, []);
  useEffect(() => {
    if (!irA || !tabs.some((t) => t.key === irA.key)) return;
    ir(irA.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo cuando llega un pedido nuevo
  }, [irA?.n]);

  const activa = tabs.find((t) => t.key === tab) ?? tabs[0];
  const activeKey = activa?.key ?? '';
  useEffect(() => { if (activeKey) onActiva?.(activeKey); }, [activeKey, onActiva]);
  const elegir = (key: string) => { setMenu(null); ir(key); onChange?.(key); };
  const puedeRenombrar = (t: LeadTabDef) => !!(t.renombrable && onRenombrar);
  const conMenu = (t: LeadTabDef) => !!t.opciones?.length || puedeRenombrar(t);

  // Los bordes que se funden: cuando hay tabs tapadas de ese lado (al desplazar, al cambiar el ancho, al sumar una hoja).
  useEffect(() => {
    const el = lista.current;
    if (!el) return;
    const medir = () => setBordes({ izq: el.scrollLeft > 2, der: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    return () => { el.removeEventListener('scroll', medir); ro?.disconnect(); };
  }, [tabs.length]);

  // La abierta, a la vista. A mano y sólo de costado: `scrollIntoView` también movería la página para arriba o abajo.
  useEffect(() => {
    const el = lista.current;
    const t = el?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(activeKey)}"]`);
    if (!el || !t) return;
    const izq = t.offsetLeft - el.offsetLeft;
    if (izq < el.scrollLeft) el.scrollLeft = Math.max(0, izq - 24);
    else if (izq + t.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollLeft = izq + t.offsetWidth - el.clientWidth + 24;
  }, [activeKey]);

  // «Cambiar nombre» desde el menú: con la tab ya abierta, su nombre pasa a editarse con el texto elegido.
  useEffect(() => {
    if (!aRenombrar || aRenombrar !== activeKey) return;
    const campo = lista.current?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(aRenombrar)}"] .edin`);
    setARenombrar(null);
    if (!campo) return;
    campo.focus();
    const sel = window.getSelection();
    sel?.selectAllChildren(campo);
  }, [aRenombrar, activeKey]);

  // El teclado de unas tabs de verdad (WAI-ARIA): flechas, Inicio y Fin cambian de hoja. Mientras se escribe un nombre, no.
  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).isContentEditable) return;
    const i = tabs.findIndex((t) => t.key === activeKey);
    const destino = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
    if (destino == null || !tabs.length) return;
    e.preventDefault();
    const t = tabs[(destino + tabs.length) % tabs.length];
    elegir(t.key);
    requestAnimationFrame(() => document.getElementById(idTab(t.key))?.focus());
  };

  const pastilla = (n?: number) => (n != null && n > 0 ? <span className="lt-badge">{n}</span> : null);
  const deMenu = menu ? tabs.find((t) => t.key === menu.key) : undefined;

  return (
    <div>
      <style>{CSS_TABS}</style>
      {/* ⚠️ `minHeight: 'var(--touch)'`: 40 px con mouse y 44 en una pantalla táctil, un iPad con la computadora adaptada
          (app/globals.css, `pointer: coarse`; Martín, 14/10/2026: «La app de MaKo se debe adaptar al tamaño de la
          pantalla siempre»). */}
      {/* La sangría va por variable: en el escritorio el TEXTO de la primera tab queda a la altura del nombre del lead (se le
          resta el padding de la tab), y en el teléfono la fila arranca al borde, como las tarjetas de abajo. */}
      <div className="lt-fila" style={{
        ['--lt-sangria' as string]: sangria ?? '0px',
        borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'stretch', gap: 12, minHeight: 'var(--touch)',
        ...(fija ? { position: 'sticky' as const, top: fija.arriba ?? 0, zIndex: 5, background: fija.fondo, paddingTop: 6 } : {}),
      }}>
        <div ref={lista} role="tablist" aria-label="Hojas de la ficha" className="lt-tabs" data-recorrido="fb-hojas"
          data-izq={bordes.izq || undefined} data-der={bordes.der || undefined} onKeyDown={teclas}>
          {tabs.map((t) => {
            const esActiva = t.key === activeKey;
            const abierto = menu?.key === t.key;
            return (
              <div key={t.key} className="lt-tab" data-tab={t.key} data-activa={esActiva || undefined}
                onContextMenu={(e) => { if (!conMenu(t)) return; e.preventDefault(); setMenu({ key: t.key, ancla: e.currentTarget }); }}>
                {esActiva && puedeRenombrar(t) ? (
                  // La abierta, si se puede renombrar: su nombre ES el campo (un clic y se escribe; Enter guarda, Escape no).
                  <div id={idTab(t.key)} role="tab" aria-selected aria-controls={idPanel} tabIndex={-1} className="lt-tab-btn">
                    <EditableInline key={t.key} valor={t.label} maxLargo={maxNombre} titulo="Cambiar el nombre de la hoja"
                      onGuardar={(v) => onRenombrar!(t.key, v)} />
                    {pastilla(t.badge)}
                  </div>
                ) : (
                  <button type="button" id={idTab(t.key)} role="tab" aria-selected={esActiva} aria-controls={idPanel} tabIndex={esActiva ? 0 : -1}
                    className="lt-tab-btn" onClick={() => elegir(t.key)}>
                    <span className="lt-tab-nombre">{t.label}</span>{pastilla(t.badge)}
                  </button>
                )}
                {esActiva && conMenu(t) && (
                  <button type="button" className="lt-tab-mas lt-accion" aria-label={`Opciones de ${t.label}`} title="Opciones de la hoja"
                    aria-haspopup="menu" aria-expanded={abierto} onClick={(e) => { const a = e.currentTarget.parentElement; if (a) setMenu((m) => (m ? null : { key: t.key, ancla: a })); }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden style={{ rotate: abierto ? '180deg' : undefined }}><path d="M7 10l5 5 5-5z" /></svg>
                  </button>
                )}
              </div>
            );
          })}
          {onNueva && (
            <button type="button" className="lt-nueva-tab lt-accion" onClick={() => { setMenu(null); onNueva(); }}>
              <IconoMenu nombre="agregar" size={15} /> Nueva hoja
            </button>
          )}
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', flex: 'none' }}>{actions}</div>}
      </div>
      {menu && deMenu && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={230} etiqueta={`Opciones de ${deMenu.label}`}>
          <div role="menu" aria-label={`Opciones de ${deMenu.label}`}>
            {puedeRenombrar(deMenu) && (
              <button type="button" role="menuitem" className="fb-opcion"
                onClick={() => { setMenu(null); if (deMenu.key !== activeKey) elegir(deMenu.key); setARenombrar(deMenu.key); }}>
                <IconoMenu nombre="renombrar" size={16} /> Cambiar nombre
              </button>
            )}
            {(deMenu.opciones ?? []).map((o) => (
              <button key={o.texto} type="button" role="menuitem" className={`fb-opcion${o.peligro ? ' lt-peligro' : ''}`} disabled={o.deshabilitada}
                onClick={() => { setMenu(null); o.onElegir(); }}>
                <IconoMenu nombre={o.icono} size={16} /> {o.texto}
              </button>
            ))}
          </div>
        </Flotante>
      )}
      <div id={idPanel} role="tabpanel" aria-labelledby={activa ? idTab(activa.key) : undefined} style={{ marginTop: 20 }}>
        {tabs
          .filter((t) => t.key === activeKey || visitadas.includes(t.key))
          .map((t) => (
            <div key={t.key} style={{ display: t.key === activeKey ? 'flex' : 'none', flexDirection: 'column', gap: 18 }}>
              {t.content}
            </div>
          ))}
      </div>
    </div>
  );
}

// Sólo tokens de la app: se dan vuelta solos en oscuro. Es un template literal: ninguna comilla invertida adentro.
// ⚠️ EL SUBRAYADO VA EN EL BOTÓN Y NO EN LA TAB: la abierta lleva además la flechita de su menú, y un subrayado de la tab
//    entera quedaría más largo que el nombre. Y va ADENTRO (bottom: 0), no sobre la línea de la fila: la lista desplaza de
//    costado (`overflow-x: auto`), y eso recorta también lo que asome para abajo.
// ⚠️ UN NOMBRE VA EN UN RENGLÓN (`nowrap`, con «…» pasados los 220 px): los nombres tienen tope (24), no hace falta partirlos.
const CSS_TABS = `
.lt-tabs { flex: 1 1 auto; min-width: 0; display: flex; align-items: stretch; gap: 2px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; overscroll-behavior-x: contain; }
.lt-tabs::-webkit-scrollbar { display: none; }
.lt-tabs[data-der] { mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent); }
.lt-tabs[data-izq] { mask-image: linear-gradient(to left, #000 calc(100% - 32px), transparent); }
.lt-tabs[data-izq][data-der] { mask-image: linear-gradient(to right, transparent, #000 32px, #000 calc(100% - 32px), transparent); }
.lt-fila { --lt-pad: 11px; padding-left: max(0px, calc(var(--lt-sangria) - var(--lt-pad))); }
.lt-tab { flex: none; position: relative; display: inline-flex; align-items: center; }
.lt-tab-btn { position: relative; display: inline-flex; align-items: center; gap: 6px; height: 100%; min-height: var(--touch); padding: 0 11px; border: none; background: transparent; font: inherit; font-family: 'Geist', sans-serif; font-size: 14px; font-weight: 600; letter-spacing: -0.005em; color: var(--dim); cursor: pointer; white-space: nowrap; border-radius: 8px 8px 0 0; }
.lt-tab-btn::after { content: ''; position: absolute; left: 11px; right: 11px; bottom: 0; height: 2px; border-radius: 2px 2px 0 0; background: transparent; }
.lt-tab-btn:hover { color: var(--ink); }
.lt-tab[data-activa] .lt-tab-btn { color: var(--ink); }
.lt-tab[data-activa] .lt-tab-btn::after { background: var(--primary); }
.lt-tab-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.lt-tab-nombre { max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
.lt-tab .edin { padding: 2px 4px; margin: 0 -4px; border-radius: 6px; cursor: text; white-space: nowrap; }
.lt-tab .edin:hover { background: var(--velo-hover); }
.lt-tab-mas { position: absolute; right: -10px; top: 50%; translate: 0 -50%; z-index: 1; display: grid; place-items: center; width: 20px; height: 24px; border: none; border-radius: 6px; background: transparent; color: var(--faint); cursor: pointer; padding: 0; opacity: 0; transition: opacity .12s; }
.lt-tabs:hover .lt-tab-mas, .lt-tab-mas:focus-visible, .lt-tab-mas[aria-expanded="true"] { opacity: 1; }
.lt-tab-mas:hover, .lt-tab-mas[aria-expanded="true"] { background: var(--velo-hover); color: var(--ink); }
.lt-tab-mas:focus-visible, .lt-nueva-tab:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.lt-nueva-tab { flex: none; align-self: center; display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; margin-left: 6px; border: none; border-radius: 8px; background: transparent; font: inherit; font-family: 'Geist', sans-serif; font-size: 13px; font-weight: 600; color: var(--faint); cursor: pointer; white-space: nowrap; }
.lt-nueva-tab:hover { background: var(--velo-hover); color: var(--ink); }
.lt-badge { flex: none; font-size: 11.5px; font-weight: 700; min-width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 0 6px; box-sizing: border-box; background: var(--primary-bg); color: var(--primary); letter-spacing: 0; }
.lt-peligro { color: var(--bad); }
@media (hover: none) { .lt-tab-mas { opacity: 1; } }
@media (pointer: coarse) { .lt-tab-mas { width: 28px; height: var(--touch); right: -14px; } }
/* En un teléfono no se personaliza la ficha (decisión de b1, ./ficha/ficha-css.ts): sin «Nueva hoja» ni el menú de cada hoja. */
@media (max-width: 720px) { .lt-fila { --lt-pad: 10px; padding-left: 0; } .lt-tabs { margin-left: calc(-1 * var(--lt-pad)); } .lt-tab-btn { padding: 0 10px; } .lt-tab-btn::after { left: 10px; right: 10px; } .lt-accion { display: none; } }
@media (prefers-reduced-motion: reduce) { .lt-tab-mas { transition: none; } }
`;
