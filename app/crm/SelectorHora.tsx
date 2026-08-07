'use client';

// =============================================================================
// SelectorHora — elegir una hora tocando, no tipeando
// =============================================================================
// Reemplaza al <input type="time"> nativo, que es el control más incómodo del
// CRM: cambia de aspecto y de teclado en cada navegador, obliga a acertarle a
// un spinner de dos dígitos y al AM/PM, y en el celular abre una ruedita.
// Reagendar una reunión —la acción más frecuente del worklist— terminaba siendo
// la más lenta.
//
// La observación que lo simplifica: las reuniones no caen en cualquier minuto.
// Caen en horas y medias horas de la jornada laboral. Entonces se muestran esos
// horarios como botones (un toque = elegido) y el campo libre queda detrás de
// "Otro horario", para el caso raro (las 7:15, un cliente en otro huso).
//
// Mismo criterio que el resto de la app: se toca, no se tipea. Vive suelto en
// app/crm/ para poder usarlo en cualquier lado donde se pida una hora.
//
// -----------------------------------------------------------------------------
// Disponibilidad real (Google Calendar)
// -----------------------------------------------------------------------------
// El componente sigue siendo PURO: no hace fetch ni importa acciones. Quien lo
// usa consulta la agenda y le pasa `slots` ya resueltos. Tres reglas que no se
// negocian, porque son las que hacen que la ayuda nunca estorbe:
//
//  1. Sin `slots` (undefined o null) se comporta EXACTAMENTE como antes: grilla
//     completa, todos los horarios elegibles. Es el modo al que se cae cuando no
//     hay agenda conectada, cuando Google falla o cuando el permiso no alcanza.
//     Perder la ayuda no puede impedir reagendar.
//     OJO: un ARRAY VACÍO no es lo mismo que null. Vacío significa "ese día no
//     tiene horarios" (ej: es hoy y ya pasaron todos) y se dice con todas las
//     letras; leerlo como "no se sabe" era pintar la jornada entera disponible y
//     dejar reagendar para una hora que ya pasó.
//  2. Un horario ocupado se ve distinto y NO se elige de un toque: el primer
//     click lo "arma" y explica por qué está ocupado; el segundo lo confirma. La
//     agenda informa, no prohíbe — el usuario siempre puede forzarlo.
//  3. Los ocupados NO se esconden. Si desaparece el horario de siempre, nadie
//     entiende por qué se fue, y además la grilla salta de tamaño.

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** Jornada laboral por defecto: de 9:00 a 19:00, en bloques de 30 minutos. */
export const HORA_DESDE = 9;
export const HORA_HASTA = 19;
const PASO_MIN = 30;

/**
 * Un horario de la grilla con su estado real según la agenda.
 * `motivo` es opcional: si no viene, se explica con una frase genérica.
 */
export type SlotHora = {
  /** "HH:MM" — el mismo formato que emite el input nativo. */
  hora: string;
  /** false = hay algo en la agenda que se pisa con la reunión completa. */
  libre: boolean;
  /** Por qué está ocupado, si se sabe. Ej: "Llamada con Acme". */
  motivo?: string;
};

/** "09:30" → "9:30 AM". La grilla se lee como la lee una persona, no en 24h. */
export function horaLegible(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? '').trim());
  if (!m) return hhmm ?? '';
  const h = Number(m[1]);
  const sufijo = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${sufijo}`;
}

/** Los horarios de la grilla, en formato "HH:MM" (el mismo valor que emite el input nativo). */
function horariosFrecuentes(desde: number, hasta: number): string[] {
  const out: string[] = [];
  for (let min = desde * 60; min <= hasta * 60; min += PASO_MIN) {
    out.push(`${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`);
  }
  return out;
}

const TECLAS_NAV = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

export function SelectorHora({
  value,
  onChange,
  desde = HORA_DESDE,
  hasta = HORA_HASTA,
  ariaLabel = 'Hora',
  slots = null,
  cargando = false,
  nota = null,
}: {
  /** "HH:MM" o '' si todavía no se eligió. */
  value: string;
  onChange: (v: string) => void;
  /** Solo se usan cuando NO llegan `slots`: con slots manda la grilla que armó el server. */
  desde?: number;
  hasta?: number;
  ariaLabel?: string;
  /**
   * La grilla con su disponibilidad. `null` / `undefined` = no se sabe: se
   * dibuja la grilla de siempre y todo queda elegible. Un array VACÍO = ese día
   * no tiene ni un horario, y se dice; no se inventa una grilla.
   */
  slots?: SlotHora[] | null;
  /** true mientras se consulta la agenda: la grilla queda apagada y no clickeable. */
  cargando?: boolean;
  /** Aviso arriba de la grilla (sin conexión, error de la API, zona horaria). */
  nota?: ReactNode;
}) {
  // Con slots mandan los slots: si el server calculó la grilla, la UI tiene que
  // mostrar ESA y no una propia, o los horarios no coinciden con lo que se guarda.
  const conSlots = Array.isArray(slots) && slots.length > 0;
  /** El server contestó y ese día NO tiene horarios: no se dibuja grilla inventada. */
  const sinHorarios = Array.isArray(slots) && slots.length === 0;
  const opciones = useMemo(
    () => (conSlots ? slots!.map((s) => s.hora) : sinHorarios ? [] : horariosFrecuentes(desde, hasta)),
    [conSlots, sinHorarios, slots, desde, hasta],
  );
  const porHora = useMemo(() => {
    const m = new Map<string, SlotHora>();
    if (conSlots) for (const s of slots!) m.set(s.hora, s);
    return m;
  }, [conSlots, slots]);

  const ocupado = (h: string): boolean => porHora.get(h)?.libre === false;
  const motivoDe = (h: string): string =>
    porHora.get(h)?.motivo?.trim() || 'Ya hay algo agendado en ese horario.';

  // "Otro horario" se abre solo si el valor que llega NO está en la grilla: al
  // reabrir el formulario con las 7:15 ya cargadas, el campo libre tiene que
  // estar visible con su valor, no escondido detrás de un botón.
  // Es DERIVADO y no un initializer: con horarios que cambian por día, un
  // useState(() => …) se quedaba con la respuesta del primer render.
  const [libreManual, setLibreManual] = useState(false);
  const libre = libreManual || (!!value && !opciones.includes(value));

  // Confirmación en dos toques para los ocupados: el primero arma, el segundo elige.
  const [armado, setArmado] = useState<string | null>(null);
  // Foco visible solo cuando se navega con teclado (los estilos son inline: no
  // hay forma de escribir :focus-visible sin una hoja aparte).
  const [foco, setFoco] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const elegir = (h: string) => {
    if (cargando) return;
    if (ocupado(h) && armado !== h && value !== h) { setArmado(h); return; }
    setArmado(null);
    setLibreManual(false);
    onChange(h);
  };

  // Flechas para moverse por la grilla sin tabular 21 veces. Las columnas las
  // decide auto-fill y no se saben acá, así que arriba/abajo se tratan como
  // anterior/siguiente: es predecible y nunca deja el foco en la nada.
  const navTeclado = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!TECLAS_NAV.includes(e.key)) return;
    const botones = Array.from(gridRef.current?.querySelectorAll<HTMLButtonElement>('button[data-chip]') ?? []);
    if (botones.length === 0) return;
    const i = botones.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const j =
      e.key === 'Home' ? 0
      : e.key === 'End' ? botones.length - 1
      : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? Math.min(i + 1, botones.length - 1)
      : Math.max(i - 1, 0);
    botones[j]?.focus();
  };

  const anillo = (on: boolean): CSSProperties =>
    on ? { outline: '2px solid var(--primary)', outlineOffset: 2 } : { outline: 'none' };

  const chip = (activo: boolean): CSSProperties => ({
    padding: '9px 12px', borderRadius: 10, fontFamily: SANS, fontSize: 13.5, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
    background: activo ? 'var(--ink)' : 'var(--surface)',
    border: '1px solid ' + (activo ? 'var(--ink)' : 'var(--border-strong)'),
    color: activo ? '#F3F5F8' : 'var(--ink)',
  });

  const chipHora = (h: string): CSSProperties => {
    const activo = !libre && value === h;
    const ocup = ocupado(h);
    const base = chip(activo);
    if (activo) return base;
    if (armado === h) {
      return { ...base, background: 'var(--surface-2)', border: '1px dashed var(--warn)', color: 'var(--warn)' };
    }
    if (ocup) {
      // Apagado y con borde punteado: se lee "no es para vos" de un vistazo,
      // pero sigue estando (y sigue siendo clickeable).
      return { ...base, background: 'var(--surface-2)', border: '1px dashed var(--border)', color: 'var(--faint)', textDecoration: 'line-through' };
    }
    return base;
  };

  const etiqueta = (h: string): string => {
    if (armado === h) return `${horaLegible(h)}, ocupado. Volvé a tocar para elegirlo igual`;
    if (ocupado(h)) return `${horaLegible(h)}, ocupado`;
    return `${horaLegible(h)}, disponible`;
  };

  const elegidoOcupado = !libre && !!value && ocupado(value);

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      aria-busy={cargando || undefined}
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {cargando && (
        <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--dim)', letterSpacing: '.02em' }}>
          Leyendo tu agenda…
        </div>
      )}
      {!cargando && nota ? (
        <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.45 }}>{nota}</div>
      ) : null}
      {!cargando && sinHorarios && !nota ? (
        <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.45 }}>
          Ese día no tiene horarios disponibles: elegí otro día o cargá la hora a mano.
        </div>
      ) : null}

      {/* auto-fill y no una fila con scroll: la grilla completa a la vista es lo
          que permite elegir de un toque sin buscar. */}
      <div
        ref={gridRef}
        onKeyDown={navTeclado}
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 7,
          opacity: cargando ? 0.5 : 1, transition: 'opacity .15s ease',
        }}
      >
        {opciones.map((h) => {
          const activo = !libre && value === h;
          const ocup = ocupado(h);
          return (
            <button
              key={h} type="button" data-chip
              aria-pressed={activo}
              aria-label={etiqueta(h)}
              aria-disabled={ocup && !activo ? true : undefined}
              disabled={cargando}
              onClick={() => elegir(h)}
              onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setFoco(h); }}
              onBlur={() => setFoco((f) => (f === h ? null : f))}
              style={{
                ...chipHora(h),
                ...anillo(foco === h),
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                cursor: cargando ? 'default' : 'pointer',
              }}
            >
              <span>{horaLegible(h)}</span>
              {armado === h && !activo && (
                <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '.04em' }}>
                  ELEGIR IGUAL
                </span>
              )}
              {ocup && armado !== h && !activo && (
                <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 600, letterSpacing: '.04em' }}>
                  ocupado
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Un solo canal para explicar lo que pasa con el horario ocupado, y se
          anuncia: el color y el tachado no le llegan a un lector de pantalla. */}
      <div role="status" aria-live="polite" style={{ minHeight: armado || elegidoOcupado ? undefined : 0 }}>
        {armado && (
          <div style={{ fontSize: 12.5, color: 'var(--warn)', lineHeight: 1.45 }}>
            {horaLegible(armado)} está ocupado: {motivoDe(armado)} Tocá otra vez para elegirlo igual.
          </div>
        )}
        {!armado && elegidoOcupado && (
          <div style={{ fontSize: 12.5, color: 'var(--warn)', lineHeight: 1.45 }}>
            Elegiste {horaLegible(value)}, que se superpone con otro evento de tu agenda.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" aria-pressed={libre}
          onClick={() => { setArmado(null); setLibreManual(true); onChange(''); }}
          onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setFoco('__libre'); }}
          onBlur={() => setFoco((f) => (f === '__libre' ? null : f))}
          style={{ ...chip(libre), ...anillo(foco === '__libre'), borderStyle: libre ? 'solid' : 'dashed' }}>
          Otro horario
        </button>
        {libre && (
          <input type="time" value={value} autoFocus aria-label={`${ariaLabel} (libre)`}
            onChange={(e) => { setArmado(null); onChange(e.target.value); }}
            onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setFoco('__input'); }}
            onBlur={() => setFoco((f) => (f === '__input' ? null : f))}
            style={{ flex: '0 1 140px', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, ...anillo(foco === '__input') }} />
        )}
      </div>
    </div>
  );
}
