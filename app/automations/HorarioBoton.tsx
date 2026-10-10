'use client';

// =============================================================================
// HorarioBoton — el horario de envío del negocio, AHÍ MISMO en la lista de Automations
// =============================================================================
// Pedido de Martín (10/10/2026), textual: «El horario de oficina si se configura en la tab de
// configuraciones, pero haz que se pueda configurar allí mismo, sin redirigir.»
//
// Decisión de quien integra (default, avisado a Martín): el control va en la cabecera de la lista,
// en el renglón de «Chatbot» y justo arriba de «＋ Nueva», porque el horario es del NEGOCIO y vale
// para todas las automatizaciones (lo lee el motor de las secuencias, lib/nutricion.ts), no para
// una. Un botón chico con el reloj y su estado corto («Sin horario» o «9 a 21»), que abre un panel
// ANCLADO ahí mismo con el MISMO editor de Configuraciones › Horario (HorarioEnvioPanel). Sólo un
// admin lo abre: el panel de Configuraciones es sólo admin y la acción de guardar lo exige. Un
// no-admin ve el estado y nada más.
//
// ⚠️ ESTE ARCHIVO NO IMPORTA EL PANEL NI LAS ACCIONES, A PROPÓSITO. Los importa HorarioLista.tsx,
// que monta la tab (ChatAgentApp) y le pasa a la lista como `horario`. `horario-actions.ts` arrastra
// `server-only` (lib/tab-access, lib/settings), y los tests que dibujan la lista con
// `renderToStaticMarkup` (chatbot-lista-*, lienzo-sexta-tanda…) la importan bajo `node --import tsx`,
// donde ese paquete tira al importarse. Acá vive lo que se puede probar sin base: el rótulo, la
// cuenta de dónde cae el panel y las dos piezas que dibujan.
//
// Las reglas de un panel anclado de la casa (AGENTS.md, «Montar una PANTALLA adentro de un modal»):
//   · se registra en la pila (`useCapaModal` con `anidada: true`) y frena el Escape con
//     `stopImmediatePropagation`: los Escape de la casa viven todos en `document` y en captura;
//   · vive adentro de una lista con `overflowY: auto`, así que va por `createPortal` al body y se
//     ubica por cuenta (`ubicarAfuera`), midiendo el panel de verdad;
//   · abre hacia AFUERA de la lista, como el «⋯» de las filas: no tapa «＋ Nueva» ni los «⋯».

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useCapaModal } from '@/app/_components/pila-modales';
import { ubicarPanel } from '@/app/_components/PortadaPicker';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { DIAS_PANTALLA, type HorarioEnvio } from '@/lib/horario-envio';

/**
 * Lo que se sabe del horario, de la MISMA lectura que el panel (`getHorarioEnvioAction`).
 * «No pude leer» es un estado aparte: no se dibuja como «Sin horario» (AGENTS.md, «"No pude leer"
 * es un tercer estado»), que afirmaría que manda a cualquier hora sin haberlo leído.
 */
export type EstadoHorario =
  | { t: 'cargando' }
  | { t: 'error' }
  | { t: 'listo'; horario: HorarioEnvio; zona: string };

/**
 * ⚠️ PUENTE: el texto con que HorarioEnvioPanel confirma que guardó (`setAviso('Guardado')`). El
 * panel no avisa a quien lo monta (no tiene un `onGuardado`, y este archivo no lo puede tocar: es de
 * Configuraciones), así que HorarioLista mira cuándo aparece este texto para volver a leer y que el
 * botón cambie al guardar, sin esperar a que se cierre el panel. `tests/automations-horario.test.ts`
 * cruza el contrato: si el panel cambia la palabra, el test cae (y el botón igual se pone al día al
 * cerrar). El día que el panel tenga `onGuardado`, esto se va.
 */
export const AVISO_GUARDADO = 'Guardado';

/** El estado corto del botón. Vacío mientras carga: un «Cargando…» escrito no es un loader. */
export function rotuloHorario(e: EstadoHorario): string {
  if (e.t === 'cargando') return '';
  if (e.t === 'error') return 'Horario';
  if (!e.horario.activo) return 'Sin horario';
  return `${e.horario.desde} a ${e.horario.hasta}`;
}

/** Los días, en el orden en que se dibujan (lunes primero): «todos los días» o «lunes, martes y viernes». */
function diasEnPalabras(dias: readonly number[]): string {
  if (dias.length >= 7) return 'todos los días';
  const nombres = DIAS_PANTALLA.filter((d) => dias.includes(d.dia)).map((d) => d.nombre);
  if (nombres.length <= 1) return nombres[0] ?? '';
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/** El `title` / `aria-label`: una frase con lo que el rótulo corto no dice (los días, la zona). */
export function describirHorario(e: EstadoHorario): string {
  if (e.t === 'cargando') return 'Horario de envío';
  if (e.t === 'error') return 'No pude leer el horario de envío';
  if (!e.horario.activo) return 'Horario de envío: sin horario, mandan a cualquier hora';
  return `Horario de envío: de ${e.horario.desde} a ${e.horario.hasta}, ${diasEnPalabras(e.horario.dias)} (hora de ${e.zona})`;
}

type Caja = { left: number; right: number; top: number; bottom: number };

/** Lo que separa el panel del borde de la lista. */
export const SEPARACION_AFUERA = 10;
/** El ancho del panel: entran los siete días y «De [hora] a [hora]» sin partirse. */
export const ANCHO_PANEL_HORARIO = 392;

/**
 * DÓNDE CAE EL PANEL. Afuera de la lista, a su DERECHA y a la altura del botón —como el «⋯» de las
 * filas—, así no tapa «＋ Nueva» ni los «⋯». Si a la derecha no entra (una ventana angosta), cuelga
 * debajo del botón con la cuenta de la casa (`ubicarPanel`, la del selector de portada). Siempre
 * adentro de la ventana. Pura y exportada para que el test la ejecute.
 *
 * `bordeLista` es el borde derecho de la lista (el `<aside>`), no el del botón: el botón vive a
 * 12 px de ese borde, y medido desde él el panel nacería encima de la lista.
 */
export function ubicarAfuera(
  ancla: Caja,
  bordeLista: number | null,
  panel: { ancho: number; alto: number },
  ventana: { ancho: number; alto: number },
  margen = 10,
): { left: number; top: number } {
  const left = (bordeLista ?? ancla.right) + SEPARACION_AFUERA;
  if (left + panel.ancho > ventana.ancho - margen) return ubicarPanel(ancla, panel, ventana, margen);
  const top = Math.max(margen, Math.min(ancla.top - 6, ventana.alto - panel.alto - margen));
  return { left, top };
}

/**
 * Lo que un estilo en línea no puede: el hover del botón. El fondo va en la CLASE y no en el `style`
 * (un estilo en línea le gana a cualquier `:hover`). Sin backticks acá adentro: es un template literal.
 */
const CSS_HORARIO = `
.chb-horario{background:transparent;color:var(--dim);transition:background .14s ease,color .14s ease,border-color .14s ease}
button.chb-horario:hover,button.chb-horario:focus-visible,button.chb-horario[aria-expanded="true"]{background:var(--surface-2);color:var(--ink);border-color:var(--border-strong)}
`;

/**
 * El botón (o, para quien no es admin, el estado sin botón). Un ícono de línea del set de la casa
 * (el reloj de `IconoMenu`), no un emoji.
 */
export function BotonHorario({ estado, editable, abierto, onAlternar }: {
  estado: EstadoHorario;
  /** Sólo un admin abre el editor (el panel de Configuraciones es sólo admin). */
  editable: boolean;
  abierto: boolean;
  /** Recibe el botón: es el ancla del panel (se pasa el NODO y no un ref leído al dibujar). */
  onAlternar: (boton: HTMLElement) => void;
}) {
  const rotulo = rotuloHorario(estado);
  const frase = describirHorario(estado);
  const estilo: CSSProperties = {
    flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, height: 24, boxSizing: 'border-box',
    padding: rotulo ? '0 9px 0 7px' : '0 6px', borderRadius: 999, border: '1px solid var(--border)',
    fontFamily: "'Geist', sans-serif", fontSize: 11.5, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap',
    color: estado.t === 'error' ? 'var(--bad)' : undefined,
  };
  const adentro = (
    <>
      <IconoMenu nombre="reloj" size={13} />
      {rotulo && <span>{rotulo}</span>}
    </>
  );
  return (
    <>
      <style>{CSS_HORARIO}</style>
      {editable ? (
        <button type="button" className="chb-horario" data-horario-boton
          aria-haspopup="dialog" aria-expanded={abierto} aria-label={frase} title={frase}
          onClick={(e) => onAlternar(e.currentTarget)} style={{ ...estilo, cursor: 'pointer' }}>
          {adentro}
        </button>
      ) : (
        <span className="chb-horario" data-horario-estado title={frase} aria-label={frase} role="img" style={estilo}>
          {adentro}
        </span>
      )}
    </>
  );
}

/**
 * ¿Hay un desplegable ABIERTO adentro (el «De» o el «a» del horario)? Entonces la tecla y el clic
 * son suyos. El `Dropdown` de la casa dibuja su menú por portal —afuera de este panel— y marca su
 * botón con `aria-expanded`: sin esta pregunta, elegir una hora cerraba el panel (el clic cae
 * «afuera»), y Escape para arrepentirse del desplegable cerraba el panel entero.
 */
const hayMenuAbiertoEn = (el: HTMLElement | null): boolean => !!el?.querySelector('[aria-expanded="true"]');

/**
 * EL PANEL ANCLADO, por portal y ubicado por cuenta.
 *
 * ⚠️ SIN EL `montado` DEL SELECTOR DE PORTADA, Y NO ES UN DESCUIDO. Ese patrón (no dibujar el portal
 * en el primer render) existe para el render del server; este panel sólo se monta después de un clic,
 * o sea siempre en el navegador. Sin ese render vacío, el efecto que mide encuentra el panel la
 * primera vez — que es justo la trampa que AGENTS.md documenta («un efecto que mide un nodo montado
 * por un portal depende del estado que monta el portal»).
 */
export function PanelAnclado({ ancla, etiqueta, onCerrar, children }: {
  /** El botón que lo abrió: de ahí cuelga, y se vuelve a medir en cada `scroll` y `resize`. */
  ancla: HTMLElement | null;
  /** Para el lector de pantalla: el panel no dibuja título. */
  etiqueta: string;
  onCerrar: () => void;
  children: ReactNode;
}) {
  const capa = useCapaModal(true, { anidada: true });
  const arriba = capa.esElDeArriba;
  const panel = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  /**
   * `onCerrar` por REF: los listeners se registran UNA vez mientras el panel está abierto. Con
   * `onCerrar` en las dependencias, una identidad nueva re-ejecutaba el efecto del foco y su limpieza
   * lo devolvía al botón a mitad de la edición (AGENTS.md, el foco de `Modal` con un `onCerrar` inestable).
   */
  const cerrarRef = useRef(onCerrar);
  useEffect(() => { cerrarRef.current = onCerrar; }, [onCerrar]);

  useLayoutEffect(() => {
    const recolocar = () => {
      const p = panel.current;
      if (!p) return;
      // Se mide el panel DE VERDAD, no el ancho declarado: en una ventana angosta el `maxWidth` lo achica.
      const caja = p.getBoundingClientRect();
      const ventana = { ancho: window.innerWidth, alto: window.innerHeight };
      const a = ancla?.isConnected ? ancla.getBoundingClientRect() : null;
      if (!a) {
        setPos({ left: Math.max(10, (ventana.ancho - caja.width) / 2), top: Math.max(10, (ventana.alto - caja.height) / 2) });
        return;
      }
      const borde = ancla?.closest('aside')?.getBoundingClientRect().right ?? null;
      setPos(ubicarAfuera(a, borde, { ancho: caja.width, alto: caja.height }, ventana));
    };
    recolocar();
    // El alto cambia al prender «Limitar el horario» (aparecen las horas y los días): se vuelve a ubicar.
    const ro = new ResizeObserver(recolocar);
    if (panel.current) ro.observe(panel.current);
    // EN CAPTURA: lo que scrollea es la lista, y un `scroll` de un contenedor no burbujea a `window`.
    const alScroll = (e: Event) => { if (e.target instanceof Node && panel.current?.contains(e.target)) return; recolocar(); };
    window.addEventListener('resize', recolocar);
    window.addEventListener('scroll', alScroll, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recolocar);
      window.removeEventListener('scroll', alScroll, true);
    };
  }, [ancla]);

  // Clic afuera: la salida de un popover. El ANCLA queda exceptuada —es un interruptor y se cierra
  // sola— y, con un desplegable abierto adentro, el clic es de él. En `pointerdown`: el lienzo de
  // atrás captura el puntero, y un `mousedown` puede no llegar.
  useEffect(() => {
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t || panel.current?.contains(t) || ancla?.contains(t)) return;
      if (hayMenuAbiertoEn(panel.current)) return;
      cerrarRef.current();
    };
    document.addEventListener('pointerdown', fuera, true);
    return () => document.removeEventListener('pointerdown', fuera, true);
  }, [ancla]);

  // Escape. `arriba()` dice si le toca contestar; `stopImmediatePropagation` (y no `stopPropagation`)
  // es lo que impide que la MISMA tecla la conteste además otro listener de `document` en captura.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // El desplegable de adentro se registró DESPUÉS que esto: sin cortar acá, su Escape no llega.
      if (hayMenuAbiertoEn(panel.current)) return;
      if (!arriba()) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      cerrarRef.current();
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      // El foco vuelve al botón que lo abrió: en el aire, el próximo Tab arranca desde arriba de todo.
      const volver = ancla?.isConnected ? ancla : previo;
      if (volver?.isConnected) volver.focus?.({ preventScroll: true });
    };
  }, [ancla, arriba]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div ref={panel} role="dialog" aria-label={etiqueta} tabIndex={-1} data-horario-panel
      // Lo que nace adentro del panel es del panel: sin esto, un Ctrl+Z con el foco en un día del
      // horario deshacía el último cambio del LIENZO de atrás (su pila escucha en `window`).
      onKeyDown={(e) => e.stopPropagation()}
      style={{
        // ⚠️ SIN `display: capa.visible ? …`: en el primer render la capa todavía no está en la pila
        // (se registra en un efecto) y saldría `display: none` justo cuando se mide y se le da el foco.
        // Y encima de este panel no se abre ninguna capa (el editor no tiene modales y el desplegable
        // de la casa no entra a la pila), así que no hay nada que esconder.
        position: 'fixed', zIndex: capa.z,
        left: pos?.left ?? 0, top: pos?.top ?? 0,
        // Hasta que esté medido no se pinta: un frame en la esquina se ve como un salto.
        opacity: pos ? 1 : 0, pointerEvents: pos ? undefined : 'none',
        width: ANCHO_PANEL_HORARIO, maxWidth: 'calc(100vw - 20px)', maxHeight: 'calc(100vh - 20px)', overflowY: 'auto',
        boxSizing: 'border-box', padding: 14, borderRadius: 18, outline: 'none',
        // El fondo de la página y no el de una tarjeta: adentro va la tarjeta del panel de
        // Configuraciones tal cual, y sobre `--surface` sería una caja blanca adentro de otra.
        background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 16px 40px rgba(18,21,27,.22)',
      }}>
      {children}
    </div>,
    document.body,
  );
}
