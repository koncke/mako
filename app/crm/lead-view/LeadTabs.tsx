'use client';

// =============================================================================
// LeadTabs — las HOJAS de la ficha del lead: el título con su desplegable, como el Dashboard y General
// =============================================================================
// Genérico: recibe la lista de hojas con su contenido (ReactNode, server components incluidos). Lo monta la ficha
// compartida (./ficha/FichaPorBloques.tsx), la misma en el pop-up y en la ruta /crm/[id].
//
// 17/10/2026 — DE PESTAÑAS A HOJAS. Martín (16/10/2026, punto 5): «que el sistema para cambiar de hoja sea exactamente
// el mismo que tenemos en Dashboard y General, el desplegable del título con las secciones, entonces ahí mismo se
// puede crear otra hoja». Y (punto 9): «Quiero que esté alineado al título del nombre de la persona. No más a la
// izquierda». La fila de pestañas se fue: arriba va el NOMBRE de la hoja abierta con su ▾, a la altura del nombre del
// lead (`sangria`), y el desplegable es el de las hojas del Dashboard (app/dashboard/Cabecera.tsx, `MenuHojas`):
// «＋ Nueva hoja» PRIMERA (el placeholder punteado de Automations), después las hojas con la abierta marcada, el
// buscador pasadas siete, y el ⋮ de cada fila (y el clic derecho) con lo que se le puede hacer, en un segundo
// desplegable.
//
// ⚠️ ES UNA COPIA DE LA ANATOMÍA DE `MenuHojas`, NO UN IMPORT: aquel recibe las hojas de un informe (`Hoja` de
//    lib/graficos-catalogo.ts), su ⋮ trae «Copiar dashboard» y su hoja de estilos vive en la del editor del Dashboard,
//    que no está montada en la ficha. Mismos rótulos, mismo orden y mismas medidas; las clases son `lt-`. Unificarlas
//    es del chat Dashboard (docs/relevo/crm.md lo anota).
// ⚠️ EL NOMBRE SE CAMBIA EN EL TÍTULO (Martín, 16/10/2026: «el Nombre se cambia en el título mismo»), con un clic,
//    como el del Dashboard (`EditableInline`, no un input: un input no mide su texto). Lo que lo permite es
//    `onRenombrar` (sólo el admin) y la hoja `renombrable`. El desplegable se abre con el ▾; sin poder renombrar, el
//    título mismo es el botón. Sin a dónde ir (una sola hoja y sin «Nueva hoja»), no hay ▾.
// ⚠️ LAS HOJAS YA VISITADAS QUEDAN MONTADAS (ocultas con display:none): cambiar de hoja no descarta estado del
//    cliente (un insight recién generado, un chat cargado).

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { EditableInline } from '@/app/_components/EditableInline';
import { NuevoPlaceholder } from '@/app/automations/NuevoPlaceholder';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { conBuscador } from '@/app/components/dropdown-reglas';
import { Flotante } from './ficha/Flotante';

/** Lo que ofrece el ⋮ de una hoja en el desplegable. */
export type OpcionHoja = { texto: string; icono: NombreIconoMenu; onElegir: () => void; deshabilitada?: boolean; peligro?: boolean };

export type LeadTabDef = {
  key: string;
  label: string;
  content: ReactNode;
  badge?: number;
  /** Se le puede cambiar el nombre en el título (con `onRenombrar`). */
  renombrable?: boolean;
  /** El ⋮ de su fila en el desplegable. Sin opciones, sin ⋮. */
  opciones?: OpcionHoja[];
};

export function LeadTabs({ tabs, initial, onChange, actions, fija, irA, onRenombrar, maxNombre = 24, onNueva, sangria, onActiva }: {
  tabs: LeadTabDef[];
  initial?: string;
  onChange?: (key: string) => void;
  /** A la derecha del título (el botón Editar y el «⋯»). */
  actions?: ReactNode;
  /**
   * LA FILA DEL TÍTULO QUEDA PEGADA ARRIBA al scrollear, con el fondo de quien la contiene.
   *
   * Pedido de Martín (12/10/2026, punto 16): «Cuando hago scroll por el modal, las tabs de arriba
   * deben acompañar el scroll. Deben permanecer fijas, como todo lo que esta arriba».
   *
   * ⚠️ UN STICKY SE PEGA A SU ANCESTRO QUE SCROLLEA, y ese ancestro tiene que TENER ALTO (AGENTS.md:
   * un `overflow-y: auto` sin alto crece con su contenido y no scrollea nunca). En el pop-up es el
   * cuerpo de la ficha (`flex: 1; minHeight: 0; overflowY: auto` adentro de un panel con alto
   * topeado); en la ruta /crm/[id], el documento. Por eso esta fila no puede vivir adentro de nada
   * con `overflow`: la raíz de LeadTabs no lleva ninguno.
   */
  fija?: { fondo: string };
  /**
   * Cambiar de hoja DESDE AFUERA: «solucionar» un dato sin marcar lleva a la hoja donde vive su campo
   * (13/10/2026), y una hoja recién creada se abre sola. `n` cambia en cada pedido, así pedir dos veces la
   * misma hoja vuelve a correr el efecto aunque ya se esté ahí.
   */
  irA?: { key: string; n: number } | null;
  /** El nombre nuevo de una hoja `renombrable`, cambiado en el título. Vacío = el de siempre: quien monta decide. */
  onRenombrar?: (key: string, nombre: string) => void;
  /** El largo máximo del nombre. */
  maxNombre?: number;
  /** «＋ Nueva hoja», primera en el desplegable. Sin esto, no se ofrece. */
  onNueva?: () => void;
  /** Cuánto se corre el título a la derecha para quedar a la altura del nombre del lead (un largo de CSS). */
  sangria?: string;
  /** Cada vez que cambia la hoja que se ve (por el desplegable o desde afuera): el chat de edición la necesita. */
  onActiva?: (key: string) => void;
}) {
  const initKey = initial && tabs.some((t) => t.key === initial) ? initial : tabs[0]?.key ?? '';
  const [tab, setTab] = useState<string>(initKey);
  const [visitadas, setVisitadas] = useState<string[]>([initKey]);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
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
  const conHojas = tabs.length > 1 || !!onNueva;
  const editable = !!(activa?.renombrable && onRenombrar);
  const abrir = (e: { currentTarget: HTMLElement }) => { const a = e.currentTarget; setMenu((m) => (m ? null : a)); };
  const flecha = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden style={{ flex: 'none', rotate: menu ? '180deg' : undefined }}>
      <path d="M7 10l5 5 5-5z" />
    </svg>
  );
  const badge = activa?.badge != null && activa.badge > 0 ? <span className="lt-badge">{activa.badge}</span> : null;

  return (
    <div>
      <style>{CSS_HOJAS}</style>
      {/* ⚠️ `minHeight: 'var(--touch)'`: 40 px con mouse y 44 en una pantalla táctil, un iPad con la computadora adaptada
          (app/globals.css, `pointer: coarse`; Martín, 14/10/2026: «La app de MaKo se debe adaptar al tamaño de la
          pantalla siempre»). */}
      <div style={{
        borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, minHeight: 'var(--touch)', paddingLeft: sangria,
        ...(fija ? { position: 'sticky' as const, top: 0, zIndex: 5, background: fija.fondo, paddingTop: 6 } : {}),
      }}>
        <div className="lt-izq">
          {editable && activa ? (
            <>
              <h2 className="lt-tit">
                {/* Un nombre vacío vuelve al de siempre (quien monta lo decide): el desplegable nunca muestra un hueco. */}
                <EditableInline key={activa.key} valor={activa.label} maxLargo={maxNombre} titulo="Nombre de la hoja"
                  onGuardar={(v) => onRenombrar!(activa.key, v)} />
              </h2>
              {badge}
              {conHojas && (
                <button type="button" className="lt-hojas" data-recorrido="fb-hojas" aria-label="Cambiar de hoja" title="Cambiar de hoja"
                  aria-haspopup="menu" aria-expanded={!!menu} onClick={abrir}>{flecha}</button>
              )}
            </>
          ) : conHojas && activa ? (
            <h2 className="lt-tit">
              <button type="button" className="lt-tit-btn" data-recorrido="fb-hojas" title="Cambiar de hoja" aria-haspopup="menu" aria-expanded={!!menu} onClick={abrir}>
                <span>{activa.label}</span>{badge}{flecha}
              </button>
            </h2>
          ) : (
            <h2 className="lt-tit">{activa?.label}{badge}</h2>
          )}
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', flex: 'none' }}>{actions}</div>}
      </div>
      {menu && (
        <Flotante ancla={menu} onCerrar={() => setMenu(null)} ancho={300} etiqueta="Hojas de la ficha">
          <MenuHojasFicha hojas={tabs} activa={activeKey} onNueva={onNueva ? () => { setMenu(null); onNueva(); } : undefined}
            onIr={(key) => { setMenu(null); ir(key); onChange?.(key); }} onCerrar={() => setMenu(null)} />
        </Flotante>
      )}
      <div role="region" aria-label={activa?.label} style={{ marginTop: 20 }}>
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

/**
 * El desplegable de las hojas, con la anatomía de `MenuHojas` del Dashboard: «＋ Nueva hoja» primera, el buscador de la
 * casa pasadas siete (`conBuscador`), las hojas con la abierta marcada y su ⋮ (o clic derecho), que abre un segundo
 * desplegable con sus opciones. Cada opción cierra los dos: subir o bajar MUEVE la fila, y un submenú anclado a una
 * fila que se fue a otro lado señalaría la hoja equivocada.
 */
function MenuHojasFicha({ hojas, activa, onNueva, onIr, onCerrar }: {
  hojas: readonly LeadTabDef[];
  activa: string;
  onNueva?: () => void;
  onIr: (key: string) => void;
  onCerrar: () => void;
}) {
  const [q, setQ] = useState('');
  const [opciones, setOpciones] = useState<{ key: string; ancla: HTMLElement } | null>(null);
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const busca = norm(q.trim());
  const visibles = hojas.filter((h) => !busca || norm(h.label).includes(busca));
  const deOpciones = opciones ? hojas.find((h) => h.key === opciones.key) : undefined;
  const alternar = (key: string, fila: HTMLElement | null) => {
    if (!fila) return;
    setOpciones((o) => (o && o.key === key ? null : { key, ancla: fila }));
  };
  return (
    <div className="lt-lista" role="menu" aria-label="Hojas">
      {onNueva && (
        <span className="lt-nueva">
          <NuevoPlaceholder chico texto="Nueva hoja" onClick={onNueva} style={{ height: 36 }} />
        </span>
      )}
      {conBuscador(hojas.length) && (
        <input className="fb-buscar" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar una hoja" />
      )}
      {visibles.map((h) => {
        const esActiva = h.key === activa;
        const abiertas = opciones?.key === h.key;
        const conMenu = !!h.opciones?.length;
        return (
          <div key={h.key} className="lt-hoja-fila" data-activa={esActiva || undefined} data-opciones={abiertas || undefined}
            onContextMenu={(e) => { if (!conMenu) return; e.preventDefault(); alternar(h.key, e.currentTarget); }}>
            <button type="button" role="menuitemradio" aria-checked={esActiva} className="lt-hoja-op" onClick={() => onIr(h.key)} title={h.label}>
              <span className="lt-hoja-marca">{esActiva && <IconoMenu nombre="check" size={15} />}</span>
              <span className="lt-hoja-nombre">{h.label}</span>
              {h.badge != null && h.badge > 0 && <span className="lt-badge">{h.badge}</span>}
            </button>
            {conMenu && (
              <button type="button" className="lt-hoja-mas" aria-label={`Opciones de ${h.label}`} aria-haspopup="menu" aria-expanded={abiertas}
                onClick={(e) => alternar(h.key, e.currentTarget.parentElement)}>⋮</button>
            )}
          </div>
        );
      })}
      {!visibles.length && busca && <div className="fb-vacio-menu">Ninguna hoja se llama así.</div>}
      {opciones && deOpciones?.opciones && (
        <Flotante ancla={opciones.ancla} onCerrar={() => setOpciones(null)} ancho={220} etiqueta={`Opciones de ${deOpciones.label}`}>
          <div role="menu" aria-label={`Opciones de ${deOpciones.label}`}>
            {deOpciones.opciones.map((o) => (
              <button key={o.texto} type="button" role="menuitem" className={`fb-opcion${o.peligro ? ' lt-peligro' : ''}`} disabled={o.deshabilitada}
                onClick={() => { setOpciones(null); onCerrar(); o.onElegir(); }}>
                <IconoMenu nombre={o.icono} size={16} /> {o.texto}
              </button>
            ))}
          </div>
        </Flotante>
      )}
    </div>
  );
}

// Las medidas de app/dashboard/editor-css.ts (lk-top-tit, lk-top-hojas, lk-hoja-*), con las clases de esta pieza. Sólo
// tokens de la app: se dan vuelta solos en oscuro. Es un template literal: ninguna comilla invertida adentro.
// ⚠️ EL NOMBRE DEL BOTÓN VA EN UN RENGLÓN (`nowrap`, con «…» si no entra; recorrido del 17/10/2026): con `overflow-wrap`
//    («anywhere», y también «break-word»), en el botón (un flex) «Nueva hoja» se partía en dos renglones teniendo lugar de
//    sobra: medido en vivo, el flex le daba 94 px a un texto que pide ~105. Los nombres tienen tope (24): no hace falta
//    partirlos.
const CSS_HOJAS = `
.lt-izq { display: flex; align-items: center; gap: 4px; min-width: 0; flex: 1; }
.lt-tit { margin: 0; min-width: 0; display: inline-flex; align-items: center; gap: 6px; font-family: 'Geist', sans-serif; font-size: 19px; font-weight: 650; letter-spacing: -0.015em; line-height: 1.25; color: var(--ink); overflow-wrap: break-word; }
.lt-tit .edin { padding: 1px 4px; border-radius: 6px; }
.lt-tit .edin:hover { background: var(--velo-hover); }
.lt-tit-btn { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; min-height: var(--touch); border: none; background: transparent; padding: 1px 6px; margin-left: -6px; border-radius: 8px; font: inherit; color: inherit; cursor: pointer; text-align: left; }
.lt-tit-btn > span { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lt-tit-btn:hover, .lt-tit-btn[aria-expanded="true"] { background: var(--velo-hover); }
.lt-hojas { flex: none; display: grid; place-items: center; width: 30px; height: 30px; border: none; border-radius: 8px; background: transparent; color: var(--dim); cursor: pointer; padding: 0; }
.lt-hojas:hover, .lt-hojas[aria-expanded="true"] { background: var(--velo-hover); color: var(--ink); }
.lt-hojas:focus-visible, .lt-tit-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.lt-badge { flex: none; font-size: 11.5px; font-weight: 700; min-width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 0 6px; box-sizing: border-box; background: var(--primary-bg); color: var(--primary); letter-spacing: 0; }
.lt-lista { display: flex; flex-direction: column; }
.lt-nueva { display: block; padding: 4px 10px 6px; }
.lt-hoja-fila { display: flex; align-items: center; gap: 2px; padding-right: 8px; min-width: 0; }
.lt-hoja-fila:hover, .lt-hoja-fila[data-opciones] { background: var(--velo-hover); }
.lt-hoja-fila[data-activa] { background: var(--primary-bg); }
.lt-hoja-op { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 8px; border: none; background: transparent; padding: 8px 14px; font: inherit; font-size: 14px; color: var(--ink); text-align: left; cursor: pointer; min-height: 36px; }
.lt-hoja-fila[data-activa] .lt-hoja-op { color: var(--primary); }
.lt-hoja-marca { flex: none; display: inline-flex; width: 16px; justify-content: center; color: var(--primary); }
.lt-hoja-nombre { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lt-hoja-mas { flex: none; border: none; background: transparent; width: 26px; height: 28px; border-radius: 8px; color: var(--dim); cursor: pointer; font-size: 16px; opacity: 0; transition: opacity .12s; }
.lt-hoja-fila:hover .lt-hoja-mas, .lt-hoja-fila[data-activa] .lt-hoja-mas, .lt-hoja-mas:focus-visible, .lt-hoja-mas[aria-expanded="true"] { opacity: 1; }
.lt-hoja-mas:hover, .lt-hoja-mas[aria-expanded="true"] { box-shadow: inset 0 0 0 999px var(--velo-hover); color: var(--ink); }
.lt-peligro { color: var(--bad); }
@media (hover: none) { .lt-hoja-mas { opacity: 1; } }
@media (pointer: coarse) { .lt-hoja-op { min-height: var(--touch); } .lt-hoja-mas, .lt-hojas { width: var(--touch); height: var(--touch); } }
/* En un teléfono no se personaliza la ficha (decisión de b1, ./ficha/ficha-css.ts): sin «Nueva hoja» ni el ⋮ de cada hoja. */
@media (max-width: 720px) { .lt-tit { font-size: 17px; } .lt-nueva, .lt-hoja-mas { display: none; } }
@media (prefers-reduced-motion: reduce) { .lt-hoja-mas { transition: none; } }
`;
