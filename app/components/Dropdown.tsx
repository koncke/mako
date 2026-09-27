'use client';

// =============================================================================
// Dropdown — desplegable estilizado (reemplaza el <select> nativo plano)
// =============================================================================
// Botón + menú flotante con ítems de hasta dos líneas (título + subtítulo) y un
// punto de color opcional. Cierra por click afuera, Escape, scroll o resize.
// El menú se renderiza en un PORTAL (position: fixed sobre document.body) para
// que NO lo recorte ningún contenedor con overflow (ej. el scroll del modal de
// detalle): antes, dentro de un modal scrolleable el menú se cortaba al abrir.

import { useEffect, useRef, useState, type CSSProperties , type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const SANS = "'Geist', sans-serif";

// Avatar de una opción-persona: foto de perfil o iniciales. Se muestra cuando la
// opción trae la prop `avatar` (string = foto · null = persona sin foto → iniciales).
const optIniciales = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
// `cuadrado` = imagen rectangular con esquinas apenas redondeadas (banderas de
// país): una bandera recortada en círculo pierde la mitad del diseño.
function OptAvatar({ url, name, size = 22, cuadrado = false }: { url: string | null | undefined; name: string; size?: number; cuadrado?: boolean }) {
  const radio = cuadrado ? 3 : '50%';
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={cuadrado ? Math.round(size * 0.75) : size} style={{ borderRadius: radio, display: 'block', flex: 'none', objectFit: 'cover' }} referrerPolicy="no-referrer" />;
  }
  return <span aria-hidden style={{ width: size, height: size, borderRadius: radio, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.42), fontWeight: 700, background: 'var(--primary)', color: '#fff' }}>{optIniciales(name)}</span>;
}

// Botón de una opción del menú (compartido por la lista plana y las columnas).
// En columnas el `sub` se omite: el título del grupo ya da ese contexto.
function renderOption(
  o: DropdownOption,
  value: string,
  resetAfterSelect: boolean,
  onChange: (v: string) => void,
  close: () => void,
  enColumna: boolean,
) {
  const on = !resetAfterSelect && o.value === value;
  const cuerpo = (
    <>
      {o.avatar !== undefined && <OptAvatar url={o.avatar} name={o.label} size={22} cuadrado={o.avatarCuadrado} />}
      {o.color && <span style={{ width: 9, height: 9, borderRadius: '50%', background: o.color, flex: 'none' }} />}
      {o.crear && <span aria-hidden style={{ flex: 'none', fontSize: 13, lineHeight: 1 }}>＋</span>}
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
        {!enColumna && o.sub && <span style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginTop: 1, lineHeight: 1.3 }}>{o.sub}</span>}
      </span>
      {on && <span style={{ flex: 'none', color: 'var(--primary)', fontSize: 13 }}>✓</span>}
    </>
  );
  const estilo: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    padding: '9px 11px', borderRadius: 8, border: 'none',
    cursor: o.disabled ? 'default' : 'pointer',
    background: on ? 'var(--surface-2)' : 'transparent',
    color: o.crear ? 'var(--faint)' : 'var(--ink)',
    fontFamily: SANS, fontSize: 13.5,
    opacity: o.disabled ? 0.45 : o.crear ? 0.8 : 1,
    // La línea la separa de las opciones de verdad sin gastar un título.
    ...(o.crear ? { borderTop: '1px solid var(--border)', borderRadius: 0, marginTop: 4, paddingTop: 11 } : null),
    transition: 'color .12s, opacity .12s',
  };
  const elegir = () => { if (!o.disabled) { onChange(o.value); close(); } };

  // Sin acciones, el renglón es EXACTAMENTE el de siempre: un solo <button>. Se
  // deja intacto a propósito — este componente lo usan decenas de pantallas y la
  // variante nueva no tiene por qué tocarles el marcado.
  if (!o.acciones?.length) {
    return (
      <button key={o.value} type="button" disabled={o.disabled} onClick={elegir}
        // El de CREAR no cambia de fondo: se enciende. Apagado dice «esto todavía no
        // existe»; encendido, «esto se puede hacer».
        onMouseEnter={(e) => {
          if (o.disabled || on) return;
          if (o.crear) { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.opacity = '1'; }
          else e.currentTarget.style.background = 'var(--surface-2)';
        }}
        onMouseLeave={(e) => {
          if (o.crear) { e.currentTarget.style.color = 'var(--faint)'; e.currentTarget.style.opacity = '0.8'; return; }
          if (!on) e.currentTarget.style.background = 'transparent';
        }}
        style={estilo}>
        {cuerpo}
      </button>
    );
  }

  // ⚠️ CON ACCIONES, el renglón NO puede ser un botón: un <button> adentro de otro
  // es marcado inválido y el click del de afuera se dispara igual, así que
  // «borrar» además seleccionaría lo que se acaba de borrar. Van como hermanos
  // dentro de una fila, y el hover lo maneja la fila.
  return (
    <div key={o.value} data-fila-opcion
      onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--surface-2)'; }}
      onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
      style={{ display: 'flex', alignItems: 'center', gap: 2, borderRadius: 8, paddingRight: 5, background: on ? 'var(--surface-2)' : 'transparent' }}>
      <button type="button" disabled={o.disabled} onClick={elegir} style={{ ...estilo, background: 'transparent', minWidth: 0, flex: 1 }}>
        {cuerpo}
      </button>
      {o.acciones.map((a) => (
        <button key={a.title} type="button" title={a.title} aria-label={a.title}
          // stopPropagation Y preventDefault: el menú se cierra por un listener de
          // click en el documento, así que sin esto la acción corre y el panel
          // desaparece — que se lee como que no pasó nada.
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); a.onClick(); }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ flex: 'none', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: a.tone === 'bad' ? 'var(--bad)' : 'var(--dim)' }}>
          {a.icono}
        </button>
      ))}
    </div>
  );
}

/**
 * Un botón de acción DENTRO de un renglón del menú (corregir, quitar…).
 *
 * Existe porque una colección que se elige de un desplegable es también una
 * colección que hay que mantener, y hacerlo desde afuera solo alcanza para la
 * que está seleccionada: con 40 renglones, «quitá el que sobra» obligaba a
 * seleccionarlo primero — o sea, a elegir lo que se quiere sacar.
 */
export type DropdownAccion = { icono: ReactNode; title: string; tone?: 'bad'; onClick: () => void };

export type DropdownOption = { value: string; label: string; sub?: string; color?: string; disabled?: boolean; /** Avatar de persona: URL de foto, o null = sin foto (iniciales). undefined = no es persona (no muestra avatar). */ avatar?: string | null; /** true = imagen rectangular con esquinas suaves (banderas), no círculo. */ avatarCuadrado?: boolean; /** Acciones propias del renglón. Con esto el renglón deja de ser un <button>. */ acciones?: DropdownAccion[];
  /**
   * La salida para CREAR uno nuevo, no una opción más de la lista.
   *
   * Se dibuja APAGADA —`--faint`, con su `＋` y una línea que la separa— y se ILUMINA
   * al pasar el cursor. Es el mismo molde que «＋ Nueva tarea» del tablero del plan
   * (`app/plan/board/BoardShell.tsx`), y el pedido fue textual: «que sea algo
   * transparente, opaco, como queriendo agregar uno nuevo, y que al pasar el cursor se
   * ilumine, ya lo hicimos un montón de veces».
   *
   * Por qué es un flag del primitive y no un estilo en cada llamador: con el mismo peso
   * que las opciones reales, «crear» compite con ellas justo cuando lo que se está
   * haciendo es elegir entre las que ya existen. Eso vale para todo desplegable, no
   * para éste — y si vive en el llamador, el próximo nace sin él.
   */
  crear?: boolean };
/** Grupo con título para menús en columnas (ver prop `columns`). */
export type DropdownGroup = { title: string; options: DropdownOption[] };

type MenuPos = { top?: number; bottom?: number; left?: number; right?: number; width: number };

export function Dropdown({
  value,
  options,
  columns,
  onChange,
  placeholder = 'Seleccionar…',
  width,
  align = 'left',
  buttonStyle,
  resetAfterSelect = false,
  ariaLabel,
  disabled = false,
  search,
  portalTo,
  icono,
}: {
  value: string;
  options?: DropdownOption[];
  /**
   * Menú en columnas lado a lado (evita el scroll de listas largas): cada
   * columna es una lista de grupos {título, opciones}. Si se pasa, `options`
   * se ignora. En pantallas angostas las columnas hacen wrap a una sola.
   */
  columns?: DropdownGroup[][];
  onChange: (value: string) => void;
  placeholder?: string;
  width?: number | string;
  align?: 'left' | 'right';
  buttonStyle?: CSSProperties;
  /** Para selects-acción (ej. "Mover a…"): no refleja la selección, vuelve al placeholder. */
  resetAfterSelect?: boolean;
  ariaLabel?: string;
  /** Deshabilita TODO el desplegable (no se puede abrir): p.ej. mientras cargan las opciones. */
  disabled?: boolean;
  /**
   * Caja de búsqueda arriba del menú. Sin pasar nada aparece SOLA cuando hay más
   * de 8 opciones — que es el punto en que scrollear deja de ser razonable y el
   * documento de rediseño pide combobox. `false` la apaga a mano.
   */
  search?: boolean;
  /**
   * Dónde se monta el menú. Por defecto `document.body`, que es lo correcto en toda la
   * app.
   *
   * ⚠️ EXISTE POR LA PANTALLA COMPLETA. Cuando un elemento entra al *top layer* del
   * navegador con `requestFullscreen()`, TODO lo que esté fuera de ese subárbol deja de
   * pintarse — incluido un portal a `document.body`. El menú se abre, existe en el DOM,
   * responde al teclado… y no se ve. Sin error y sin warning, que es lo que lo vuelve
   * caro de diagnosticar. El lienzo del grafo usa esa API, así que ahí hay que pasarle
   * `document.fullscreenElement ?? document.body`.
   */
  portalTo?: HTMLElement | null;
  /** Icono fijo a la izquierda del rótulo — el que dice QUÉ hace este control, no qué
   *  está elegido. Va acá y no en cada `option` porque no cambia con la selección: un
   *  desplegable de filtro tiene que leerse como filtro incluso cuando dice «todo». */
  icono?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Calcula la posición fija del menú a partir del rect del botón. Abre hacia
  // arriba si abajo no hay lugar (sin empujar el layout). En coordenadas de
  // viewport porque el menú vive en un portal con position: fixed.
  const place = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < 300 && r.top > below;
    const vertical = up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 };
    // Con columnas el ancho del menú es conocido → clampear al viewport para
    // que en pantallas angostas no se salga por el lado del anclaje.
    if (columns) {
      const w = Math.min(500, window.innerWidth - 24);
      const left = Math.min(Math.max(12, align === 'right' ? r.right - w : r.left), window.innerWidth - 12 - w);
      setPos({ width: r.width, ...vertical, left });
      return;
    }
    setPos({
      width: r.width,
      ...vertical,
      ...(align === 'right' ? { right: window.innerWidth - r.right } : { left: r.left }),
    });
  };
  const toggle = () => {
    if (disabled) return;
    // El filtro se limpia AL ABRIR y no al cerrar: el menú solo existe abierto,
    // y limpiarlo al cerrar obligaría a un setState por cada camino de cierre
    // (click afuera, Escape, scroll, elegir una opción).
    if (!open) { place(); setQ(''); }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    /**
     * ⚠️ EN CAPTURA, Y CORTANDO EL EVENTO. Un `<select>` nativo se come el Escape mientras
     * su popup está abierto; este menú no lo hacía, así que abrir un desplegable adentro de
     * un modal y apretar Escape para arrepentirse **cerraba el modal entero**. Medido el
     * 25/09/2026 con la barra de selección del /plan adentro del detalle de un proyecto: el
     * `onKey` del modal (`BoardShell.tsx`) también vive en `document` y también en burbuja,
     * y como se registró al montarse corre ANTES que éste — así que un `stopPropagation`
     * desde acá no llega a tiempo, y un `stopImmediatePropagation` en burbuja tampoco.
     * La captura corre antes que TODA la fase de burbuja del documento, así que es el único
     * lugar desde donde este menú puede quedarse con la tecla.
     *
     * Sólo mientras está abierto: el efecto entero sale con `if (!open) return`, así que un
     * desplegable cerrado no toca el Escape de nadie.
     */
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      setOpen(false);
      // El foco vuelve al botón que abrió: si se queda en el aire, el siguiente Tab
      // arranca desde el principio del documento.
      ref.current?.querySelector('button')?.focus();
    };
    // Al scrollear/redimensionar el menú fijo se despegaría del botón → cerrar.
    // PERO si el scroll ocurre DENTRO del propio menú (lista larga), NO cerrar.
    const onScrollResize = (e?: Event) => {
      if (e && e.type === 'scroll' && e.target instanceof Node && menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc, true);
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc, true);
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [open]);

  const flat = columns ? columns.flat().flatMap((g) => g.options) : (options ?? []);
  const selected = resetAfterSelect ? undefined : flat.find((o) => o.value === value);

  // Búsqueda: aparece sola pasadas las 8 opciones. Filtra por título Y subtítulo
  // (en las listas de personas el dato que uno recuerda suele ser el subtítulo).
  const conBusqueda = search ?? flat.length > 8;
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const coincide = (o: DropdownOption) => !q.trim() || norm(`${o.label} ${o.sub ?? ''}`).includes(norm(q.trim()));
  const optsVisibles = (options ?? []).filter(coincide);
  const colsVisibles = columns?.map((col) => col.map((g) => ({ ...g, options: g.options.filter(coincide) })).filter((g) => g.options.length));
  const sinResultados = q.trim().length > 0 && (columns ? !colsVisibles?.some((c) => c.length) : optsVisibles.length === 0);

  // El foco entra solo en la búsqueda: con el menú abierto ya se puede escribir,
  // sin tener que ir a buscar el campo con el mouse.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  const btn: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '10px 12px', borderRadius: 11, border: '1px solid var(--border-strong)',
    background: 'var(--surface)', color: selected ? 'var(--ink)' : 'var(--dim)',
    fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', outline: 'none',
    width: width ?? 'auto', opacity: disabled ? 0.6 : 1, ...buttonStyle,
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', width: width ?? 'auto' }}>
      <button type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-disabled={disabled} disabled={disabled} onClick={toggle} style={btn}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {icono && <span style={{ flex: 'none', display: 'flex', color: 'var(--faint)' }}>{icono}</span>}
          {selected?.avatar !== undefined && <OptAvatar url={selected.avatar} name={selected.label} size={20} cuadrado={selected.avatarCuadrado} />}
          {selected?.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: selected.color, flex: 'none' }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected ? selected.label : placeholder}</span>
        </span>
        <span style={{ flex: 'none', fontSize: 10, color: 'var(--faint)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
      </button>
      {open && pos && createPortal(
        <div ref={menuRef} role="listbox" style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right, zIndex: 1000, minWidth: pos.width, width: columns ? 'min(500px, calc(100vw - 24px))' : 'max-content', maxWidth: columns ? undefined : 360, maxHeight: columns ? 'min(480px, calc(100dvh - 40px))' : 340, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(18,21,27,.22)', padding: 6 }}>
          {conBusqueda && (
            // Queda PEGADA arriba: en una lista larga el buscador tiene que
            // seguir a la vista mientras se scrollea, o deja de servir.
            <div style={{ position: 'sticky', top: -6, zIndex: 1, background: 'var(--surface)', padding: '2px 2px 6px', margin: '-2px -2px 0' }}>
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar…" aria-label="Buscar opción" className="mk-input"
                onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }}
                style={{ minHeight: 34, padding: '7px 10px', fontSize: 13.5, borderRadius: 9 }} />
            </div>
          )}
          {columns ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(colsVisibles ?? columns).map((col, ci) => (
                <div key={ci} style={{ flex: '1 1 190px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {col.map((g) => (
                    <div key={g.title}>
                      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', padding: '8px 11px 4px' }}>{g.title}</div>
                      {g.options.map((o) => renderOption(o, value, resetAfterSelect, onChange, () => setOpen(false), true))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <>
              {optsVisibles.map((o) => renderOption(o, value, resetAfterSelect, onChange, () => setOpen(false), false))}
              {(options ?? []).length === 0 && <div style={{ padding: '9px 11px', fontSize: 13, color: 'var(--faint)' }}>Sin opciones</div>}
            </>
          )}
          {/* «No hay resultados» NO es lo mismo que «no hay opciones»: acá hay
              datos y el filtro no encontró nada. Confundirlos hace pensar que
              la lista está vacía. */}
          {sinResultados && (
            <div style={{ padding: '10px 11px', fontSize: 13, color: 'var(--faint)', lineHeight: 1.5 }}>
              Nada coincide con «{q.trim()}».
            </div>
          )}
        </div>,
        portalTo ?? document.body,
      )}
    </div>
  );
}
