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
//   · lo que hacía el desplegable con cada hoja (Templates, Duplicar, mover, Eliminar) va en el menú de ESA tab (clic
//     derecho sobre cualquiera) y, la de la abierta, en el «⋯» de al lado de «Editar» (./ficha/menu-contextual-ficha.ts);
//   · el nombre se sigue cambiando EN LA TAB MISMA, con un clic sobre la abierta (Martín, 17/10: «el Nombre se cambia en el
//     título mismo»), o desde su menú, «Cambiar nombre». Sin doble clic.
//
// 24/10/2026, la misma noche, segunda vuelta. Martín: «que las paginas comiencen a la izquierda del todo, no alineado al
// nombre. Y no pongas la flechita con esas opciones, para eso ya tenemos los 3 puntos al lado de "editar"... Y llegará un
// punto donde "nueva hoja" ya no se vea bien, ahí si deberías poner la ultima hoja con un desplegable, algo como "Ver más"».
//   · el texto de la primera tab arranca en el borde del contenido (ya no a la altura del nombre del lead);
//   · sin la flechita de la abierta: su menú es el «⋯» de al lado de «Editar» (y el clic derecho sobre la tab);
//   · la fila NO se desplaza de costado: lo que no entra va a «Ver más ▾», al final, con «＋ Nueva hoja» adentro, como el
//     «Más» de las tabs de GitHub. La abierta se ve siempre. Lo puro: ./tabs-que-entran.ts. En el teléfono, igual (sin
//     «Nueva hoja»: ahí no se personaliza la ficha).
// ⚠️ LAS HOJAS YA VISITADAS QUEDAN MONTADAS (ocultas con display:none): cambiar de hoja no descarta estado del cliente (un
//    insight recién generado, un chat cargado).

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { EditableInline } from '@/app/_components/EditableInline';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { Flotante } from './ficha/Flotante';
import { tabsQueEntran } from './tabs-que-entran';

/** El hueco entre dos tabs (el `gap` de `.lt-tabs`): la cuenta de lo que entra lo usa. */
const GAP_TABS = 2;

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

export function LeadTabs({ tabs, initial, onChange, actions, fija, irA, onRenombrar, maxNombre = 24, onNueva, onActiva, renombrar }: {
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
  /** «＋ Nueva hoja», al final de la fila (o adentro de «Ver más», si no entra). Sin esto, no se ofrece. */
  onNueva?: () => void;
  /** Cada vez que cambia la hoja que se ve (por una tab o desde afuera): el chat de edición la necesita. */
  onActiva?: (key: string) => void;
  /**
   * «Cambiar nombre» pedido DESDE AFUERA (el «⋯» de la ficha, 24/10/2026): la tab de `key`, si es la abierta, pone a editar
   * su nombre. `n` cambia en cada pedido, como `irA`.
   */
  renombrar?: { key: string; n: number } | null;
}) {
  const initKey = initial && tabs.some((t) => t.key === initial) ? initial : tabs[0]?.key ?? '';
  const [tab, setTab] = useState<string>(initKey);
  const [visitadas, setVisitadas] = useState<string[]>([initKey]);
  /** El menú abierto: de qué tab y anclado a qué. */
  const [menu, setMenu] = useState<{ key: string; ancla: HTMLElement } | null>(null);
  /** «Cambiar nombre» pedido desde el menú: cuando esa tab esté abierta, se pone a editar su nombre. */
  const [aRenombrar, setARenombrar] = useState<string | null>(null);
  const lista = useRef<HTMLDivElement>(null);
  /** La copia invisible de la fila de donde se miden las tabs, «Nueva hoja» y «Ver más». */
  const medidor = useRef<HTMLDivElement>(null);
  /** Lo medido: el ancho de cada tab (por clave), el de «Nueva hoja» y «Ver más», y lo que mide la fila. */
  const [medidas, setMedidas] = useState<{ anchos: Record<string, number>; nueva: number; verMas: number; disponible: number } | null>(null);
  /** «Ver más» abierto, anclado a su botón. */
  const [verMas, setVerMas] = useState<HTMLElement | null>(null);
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
  const elegir = (key: string) => { setMenu(null); setVerMas(null); ir(key); onChange?.(key); };
  useEffect(() => {
    if (renombrar && renombrar.key === activeKey) setARenombrar(renombrar.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo cuando llega un pedido nuevo
  }, [renombrar?.n]);
  const puedeRenombrar = (t: LeadTabDef) => !!(t.renombrable && onRenombrar);
  const conMenu = (t: LeadTabDef) => !!t.opciones?.length || puedeRenombrar(t);

  // ── LO QUE ENTRA EN LA FILA (24/10/2026, «Ver más») ──────────────────────────────────────────────────────────────────
  // Se mide una copia INVISIBLE de la fila entera (todas las tabs, «Nueva hoja» y «Ver más»), y lo que mide la fila de
  // verdad. Se vuelve a medir al cambiar el ancho (ResizeObserver) y al cambiar las hojas o sus nombres. Antes del layout,
  // para no pintar primero la fila cortada.
  // ⚠️ «NUEVA HOJA» MIDE 0 EN EL TELÉFONO: lleva `.lt-accion`, que ahí no se dibuja. Así la cuenta no le guarda un lugar
  //    que no ocupa.
  const firma = tabs.map((t) => `${t.key}\u0001${t.label}\u0001${t.badge ?? ''}`).join('\u0002') + (onNueva ? '+' : '');
  const medir = useCallback(() => {
    const m = medidor.current;
    const el = lista.current;
    if (!m || !el) return;
    const anchos: Record<string, number> = {};
    m.querySelectorAll<HTMLElement>('[data-medir-tab]').forEach((x) => { anchos[x.dataset.medirTab ?? ''] = x.offsetWidth; });
    const nueva = m.querySelector<HTMLElement>('[data-medir="nueva"]')?.offsetWidth ?? 0;
    const verMasAncho = m.querySelector<HTMLElement>('[data-medir="ver-mas"]')?.offsetWidth ?? 0;
    const disponible = el.clientWidth;
    setMedidas((p) => (p && p.disponible === disponible && p.nueva === nueva && p.verMas === verMasAncho
      && Object.keys(anchos).length === Object.keys(p.anchos).length && Object.entries(anchos).every(([k, v]) => p.anchos[k] === v)
      ? p : { anchos, nueva, verMas: verMasAncho, disponible }));
  }, []);
  useLayoutEffect(() => { medir(); }, [medir, firma]);
  useEffect(() => {
    const el = lista.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(() => medir());
    ro.observe(el);
    return () => ro.disconnect();
  }, [medir]);
  const iActiva = Math.max(0, tabs.findIndex((t) => t.key === activeKey));
  const reparto = tabsQueEntran({
    anchos: tabs.map((t) => medidas?.anchos[t.key] ?? 0),
    disponible: medidas && tabs.every((t) => medidas.anchos[t.key] != null) ? medidas.disponible : 0,
    gap: GAP_TABS, anchoNueva: onNueva ? medidas?.nueva ?? 0 : 0, anchoVerMas: medidas?.verMas ?? 0, activa: iActiva,
  });
  const enFila = reparto.visibles.map((i) => tabs[i]);
  const enVerMas = reparto.ocultas.map((i) => tabs[i]);

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
      {/* El TEXTO de la primera tab arranca en el borde del contenido, como las tarjetas de abajo (24/10/2026: «que las
          paginas comiencen a la izquierda del todo, no alineado al nombre»): la lista se corre a la izquierda lo que mide el
          padding de una tab. */}
      <div className="lt-fila" style={{
        position: 'relative',
        borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'stretch', gap: 12, minHeight: 'var(--touch)',
        ...(fija ? { position: 'sticky' as const, top: fija.arriba ?? 0, zIndex: 5, background: fija.fondo, paddingTop: 6 } : {}),
      }}>
        {/* La copia invisible de donde se miden las tabs (no se lee ni se toca). */}
        <div ref={medidor} aria-hidden className="lt-medidor">
          {tabs.map((t) => (
            <span key={t.key} data-medir-tab={t.key} className="lt-tab-btn"><span className="lt-tab-nombre">{t.label}</span>{pastilla(t.badge)}</span>
          ))}
          {onNueva && <span data-medir="nueva" className="lt-nueva-tab lt-accion"><IconoMenu nombre="agregar" size={15} /> Nueva hoja</span>}
          {/* Con el número más grande que puede llevar (el de todas): mejor que sobre un poco a que se corte. */}
          <span data-medir="ver-mas" className="lt-ver-mas">Ver más {pastilla(tabs.reduce((n, t) => n + (t.badge ?? 0), 0))}<IconoMenu nombre="abajo" size={13} /></span>
        </div>
        <div ref={lista} role="tablist" aria-label="Hojas de la ficha" className="lt-tabs" data-recorrido="fb-hojas" onKeyDown={teclas}>
          {enFila.map((t) => {
            const esActiva = t.key === activeKey;
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
              </div>
            );
          })}
          {/* ⚠️ SIN LA FLECHITA DE LA ABIERTA (24/10/2026, «no pongas la flechita con esas opciones, para eso ya tenemos los 3
              puntos al lado de "editar"»): su menú es el «⋯» de la ficha, y el clic derecho sobre la tab. */}
          {onNueva && reparto.nuevaEnLinea && (
            <button type="button" className="lt-nueva-tab lt-accion" onClick={() => { setMenu(null); onNueva(); }}>
              <IconoMenu nombre="agregar" size={15} /> Nueva hoja
            </button>
          )}
          {/* «Ver más»: las que no entran, y «Nueva hoja» adentro. Lleva el número de una oculta con algo pendiente (los
              pagos sin cobrar): escondida, no se vería. */}
          {reparto.verMas && (
            <button type="button" className="lt-ver-mas" aria-haspopup="menu" aria-expanded={!!verMas}
              title={enVerMas.length ? `${enVerMas.length} hoja${enVerMas.length === 1 ? '' : 's'} más` : 'Nueva hoja'}
              onClick={(e) => { setMenu(null); const a = e.currentTarget; setVerMas((v) => (v ? null : a)); }}>
              Ver más {pastilla(enVerMas.reduce((n, t) => n + (t.badge ?? 0), 0))}<IconoMenu nombre="abajo" size={13} style={{ rotate: verMas ? '180deg' : undefined }} />
            </button>
          )}
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', flex: 'none' }}>{actions}</div>}
      </div>
      {verMas && (
        <Flotante ancla={verMas} onCerrar={() => setVerMas(null)} ancho={240} etiqueta="Más hojas">
          <div role="menu" aria-label="Más hojas">
            {enVerMas.map((t) => (
              <button key={t.key} type="button" role="menuitem" className="fb-opcion" onClick={() => elegir(t.key)}
                onContextMenu={(e) => { if (!conMenu(t)) return; e.preventDefault(); setVerMas(null); setMenu({ key: t.key, ancla: e.currentTarget }); }}>
                <IconoMenu nombre="archivo" size={16} /> <span className="lt-tab-nombre" style={{ flex: 1 }}>{t.label}</span>{pastilla(t.badge)}
              </button>
            ))}
            {onNueva && !reparto.nuevaEnLinea && (
              <>
                {enVerMas.length > 0 && <div role="separator" className="lt-raya" />}
                <button type="button" role="menuitem" className="fb-opcion lt-accion" onClick={() => { setVerMas(null); onNueva(); }}>
                  <IconoMenu nombre="agregar" size={16} /> Nueva hoja
                </button>
              </>
            )}
          </div>
        </Flotante>
      )}
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
// ⚠️ EL SUBRAYADO VA EN EL BOTÓN Y NO EN LA TAB, y ADENTRO (bottom: 0), no sobre la línea de la fila: la lista recorta lo que
//    se sale (`overflow: hidden`), también lo que asome para abajo.
// ⚠️ UN NOMBRE VA EN UN RENGLÓN (`nowrap`, con «…» pasados los 220 px): los nombres tienen tope (24), no hace falta partirlos.
// ⚠️ LA LISTA NO SE DESPLAZA (24/10/2026): lo que no entra va a «Ver más» (./tabs-que-entran.ts). El `overflow: hidden` es
//    sólo para el instante antes de medir.
// ⚠️ EL MEDIDOR (`.lt-medidor`) LLEVA LAS MISMAS CLASES que la fila: si una tab cambia de letra o de padding acá, la copia
//    cambia igual y la cuenta no se desfasa.
const CSS_TABS = `
.lt-tabs { flex: 1 1 auto; min-width: 0; display: flex; align-items: stretch; gap: 2px; overflow: hidden; margin-left: calc(-1 * var(--lt-pad)); }
.lt-fila { --lt-pad: 11px; }
.lt-medidor { position: absolute; left: 0; top: 0; width: max-content; height: 0; overflow: hidden; visibility: hidden; pointer-events: none; display: flex; white-space: nowrap; }
.lt-medidor > * { flex: none; }
.lt-ver-mas { flex: none; align-self: center; display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; margin-left: 4px; border: none; border-radius: 8px; background: transparent; font: inherit; font-family: 'Geist', sans-serif; font-size: 14px; font-weight: 600; color: var(--dim); cursor: pointer; white-space: nowrap; }
.lt-ver-mas:hover, .lt-ver-mas[aria-expanded="true"] { background: var(--velo-hover); color: var(--ink); }
.lt-ver-mas:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.lt-raya { height: 1px; background: var(--border); margin: 5px 6px; }
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
.lt-nueva-tab:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.lt-nueva-tab { flex: none; align-self: center; display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; margin-left: 6px; border: none; border-radius: 8px; background: transparent; font: inherit; font-family: 'Geist', sans-serif; font-size: 13px; font-weight: 600; color: var(--faint); cursor: pointer; white-space: nowrap; }
.lt-nueva-tab:hover { background: var(--velo-hover); color: var(--ink); }
.lt-badge { flex: none; font-size: 11.5px; font-weight: 700; min-width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 0 6px; box-sizing: border-box; background: var(--primary-bg); color: var(--primary); letter-spacing: 0; }
.lt-peligro { color: var(--bad); }
@media (pointer: coarse) { .lt-ver-mas { height: var(--touch); } }
/* En un teléfono no se personaliza la ficha (decisión de b1, ./ficha/ficha-css.ts): sin «Nueva hoja». «Ver más» sí: es cómo
   se llega a las hojas que no entran. */
@media (max-width: 720px) { .lt-fila { --lt-pad: 10px; } .lt-tab-btn { padding: 0 10px; } .lt-tab-btn::after { left: 10px; right: 10px; } .lt-accion { display: none; } }
`;
