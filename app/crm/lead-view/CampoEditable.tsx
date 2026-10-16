'use client';

// =============================================================================
// CampoEditable — los campos de la ficha que NO son texto, editados en el lugar
// =============================================================================
// «Que ya no exista el botón de "editar" … sino que simplemente le doy click
// arriba y ya puedo sobre escribir» (Martín, 05/10/2026).
//
// El texto libre ya tenía su molde y no se toca: `EditableInline` (nombre,
// empresa, email, teléfono). Acá va cada campo con el gesto que le corresponde:
//
//   · fecha   → el click abre el campo de fecha (y su calendario).
//   · tri     → el click abre Sí / No / —, en el mismo renglón.
//   · persona → el click abre el desplegable del equipo.
//   · texto   → el click pone el cursor y se sobrescribe (reusa `EditableInline`).
//   · enlace  → igual que texto, pero el link de Fathom se valida ANTES de pedir
//     nada: un texto cualquiera ahí deja un «Abrir →» que no abre y un análisis
//     de la llamada huérfano.
//
// Todos guardan AL SALIR o al elegir, Escape cancela, y el cambio queda en el
// historial del lead porque pasan por `guardarCampoLeadAction` — el mismo camino
// que «Deshacer» del historial, no uno nuevo.
//
// ⚠️ Y LO QUE NO SE PUEDE EDITAR NO SE DIBUJA CLICKEABLE. Cada primitiva acepta
// `bloqueado`: con eso dibuja el valor de siempre, sin cursor ni título. Un campo
// que invita a editar y rebota se lee como que la app está rota — y acá rebotaría
// de verdad: `updateLead` fuerza «calificado» a null si no asistió a R1, así que
// marcarlo ahí guardaría y volvería solo al valor anterior.

import { useCallback, useEffect, useRef, useState, useTransition, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { useRefrescarFicha } from './ficha-cambio';
import { EditableInline } from '@/app/_components/EditableInline';
import { TelefonoConPais } from '@/app/_components/TelefonoConPais';
import { Toast, useToast } from '@/app/_ui/Toast';
import { Dropdown } from '@/app/components/Dropdown';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { splitTelefono } from '@/lib/paises';
import { deshacerCampoLeadAction, guardarCampoLeadAction } from '../actions';
import { opcionesEquipo } from '../equipo-opciones';
import { esMaKo, MAKO_STAR_URI } from '../mako-setter';
import { ChipTri } from './chip-tri';
import { FATHOM_URL, INGRESO_MAX_USD, montoDeTexto, telefonoAGuardar, usuarioInstagram, type CampoInline, type ValorInline } from '../campo-inline';
import type { MiembroEquipo } from '../actions';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

// ── La tarjeta del campo: un clic en CUALQUIER parte abre la edición ─────────
//
// Pedido de Martín (12/10/2026, punto 7), textual: «En el detalle del lead, solo puedo cambiarle
// la info si le doy click al guion "---" que esta en los campos... Si le doy click a la tarjeta
// debería ya saltarme el cuadro de texto, y debe ser más grande... Basicamente como el ancho de
// esa tarjeta.»
//
// ⚠️ EL DIAGNÓSTICO: el campo de texto (`EditableInline`) es un `inline-block` que mide lo que
// dice. Vacío dice «—»: un blanco de 10 px adentro de una tarjeta de 300. Y la fecha y la persona
// son un botón del tamaño de su texto. Todo lo demás de la tarjeta era aire muerto.
//
// La cura son dos cosas, y viven acá para que valgan en TODAS las tarjetas que usan estas piezas
// (Información principal, Reuniones, Motivo, Plazo, Calificación) y no en una:
//   1. `CajaCampo` — el recuadro de UN campo. Un clic en cualquier punto que no sea ya un control
//      (copiar, WhatsApp, un link) abre el campo de adentro: pone el cursor en el texto, abre el
//      calendario, el desplegable o el sí/no. Cada pieza marca su disparador con `data-campo-abrir`.
//   2. Adentro de una `CajaCampo`, el texto y la caja de edición ocupan el ANCHO de la tarjeta,
//      y al editar se ve el recuadro (el `outline`, que no mueve el layout).
//
// ⚠️ UN CLIC QUE LLEGA POR UN PORTAL NO CUENTA. El menú del desplegable y el toast se dibujan en
// `document.body`, pero React hace burbujear su clic por el árbol de COMPONENTES hasta acá: sin el
// `contains`, elegir una opción del menú volvía a abrirlo.
//
// ⚠️ ES UN COMPONENTE, NO UN ESTILO EXPORTADO: las tarjetas que la montan (ReunionesCard, y hasta el 16/10/2026
// MotivoYPlazoCard y CalificacionCard) no son 'use client', y un VALOR importado de un 'use client'
// llega al server como una referencia de cliente, no como el objeto (AGENTS.md, la frontera).

const INTERACTIVO = 'button, a, input, select, textarea, label, [contenteditable="true"], [role="group"], [role="listbox"], [role="option"], [data-no-abre]';

const CSS_CAJA = `
.campo-caja{ cursor:pointer; }
.campo-caja .edin{ display:block; width:100%; box-sizing:border-box; }
.campo-caja .edin:focus, .campo-caja .edin:focus-visible{ box-shadow:none; outline:1.5px solid var(--primary); outline-offset:5px; border-radius:6px; background:var(--surface); }
.campo-caja input.campo-ancho{ width:100%; box-sizing:border-box; }
`;

/** Abre el campo de adentro de una caja: el texto recibe el cursor al final; lo demás, su clic. */
function abrirCampoEn(caja: HTMLElement): void {
  const el = caja.querySelector<HTMLElement>('[data-campo-abrir], [contenteditable="true"]');
  if (!el) return;
  if (el.isContentEditable) {
    el.focus();
    const sel = window.getSelection();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(r);
    return;
  }
  if (el.matches('button')) { el.click(); return; }
  el.querySelector<HTMLElement>('button')?.click();
}

/**
 * El recuadro de UN campo de la ficha. Un clic en cualquier parte abre la edición (punto 7).
 * `style` es el recuadro de quien la monta (cada tarjeta tiene el suyo). `marca` es el
 * `data-recorrido` que busca «solucionar» un dato sin marcar (`marcaDato`, lib/datos-aviso.ts).
 */
export function CajaCampo({ children, style, marca }: { children: ReactNode; style?: CSSProperties; marca?: string }) {
  /**
   * ⚠️ ¿El campo ya estaba ABIERTO cuando bajó el dedo? Entonces este clic es para SALIR: el
   * `pointerdown` le quita el foco (y el campo guarda y se cierra), y si el `click` que sigue lo
   * volviera a abrir, no habría forma de terminar de editar tocando la propia tarjeta. Se mira en
   * el `pointerdown`, antes de que el campo se cierre.
   */
  const estabaAbierto = useRef(false);
  const alBajar = (e: MouseEvent<HTMLDivElement>) => {
    const caja = e.currentTarget;
    const a = document.activeElement as HTMLElement | null;
    const escribiendo = !!a && caja.contains(a)
      && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || !!a.closest('[role="group"]'));
    estabaAbierto.current = escribiendo || !!caja.querySelector('[aria-expanded="true"], [data-campo-editando]');
  };
  const alTocar = (e: MouseEvent<HTMLDivElement>) => {
    const caja = e.currentTarget;
    const t = e.target as HTMLElement | null;
    const salir = estabaAbierto.current;
    estabaAbierto.current = false;
    if (!t || !caja.contains(t)) return;   // vino por un portal (menú, toast)
    const hit = t.closest(INTERACTIVO);
    if (hit && caja.contains(hit)) return;  // ya es un control: hace lo suyo
    if (salir) return;                      // era para cerrar el que estaba abierto
    abrirCampoEn(caja);
  };
  return (
    <div className="campo-caja" onPointerDownCapture={alBajar} onClick={alTocar} style={style} data-recorrido={marca}>
      <style dangerouslySetInnerHTML={{ __html: CSS_CAJA }} />
      {children}
    </div>
  );
}

/** El botón que ES el valor: sin borde, sin fondo, sin padding. Se saca la CAJA, no la señal. */
const disparador: CSSProperties = {
  background: 'none', border: 0, padding: 0, margin: 0, borderRadius: 4,
  font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};

/**
 * Guardar un campo + el aviso con Deshacer.
 *
 * El deshacer escribe en el SERVER (vuelve a llamar a la action con el valor de
 * antes): revertir sólo la pantalla sería mentir hasta el próximo F5. Es el mismo
 * criterio que `InfoPrincipalCard` ya usa para el nombre y el teléfono.
 *
 * ⚠️ Y NO PISA A OTRO (16/10/2026): manda también lo que este guardado escribió, y el
 * server no deshace si en esos 5 segundos alguien (u otro camino) cambió el campo
 * (`deshacerCampoLeadAction`). Entonces lo dice y relee.
 */
export function useGuardarCampo(leadId: number, campo: CampoInline) {
  const refrescarFicha = useRefrescarFicha();
  const { toast, show, clear } = useToast();
  const [, startGuardar] = useTransition();
  const guardar = (nuevo: ValorInline, antes: ValorInline) => {
    startGuardar(async () => {
      try {
        await guardarCampoLeadAction(leadId, campo, nuevo);
        refrescarFicha();
        show('Guardado', () => {
          startGuardar(async () => {
            try {
              const r = await deshacerCampoLeadAction(leadId, campo, antes, nuevo);
              refrescarFicha();
              if (!r.ok) show(r.error, undefined, 'bad');
            } catch { show('No se pudo deshacer', undefined, 'bad'); }
          });
        });
      } catch (e) {
        show(e instanceof Error ? e.message : 'No se pudo guardar', undefined, 'bad');
      }
    });
  };
  // `show` sale afuera porque hay avisos que NO son el resultado de un guardado:
  // el link de Fathom se rechaza sin pedir nada al server (ver EnlaceFathomEditable).
  return { guardar, toast, clear, show };
}

// ── Fecha ────────────────────────────────────────────────────────────────────

/**
 * Una fecha que se corrige en el lugar.
 *
 * `fallback` existe para UN caso real: la R1 muestra `fecha_junta_1` y, si no la
 * tiene, la fecha de agendamiento (es el lead que reservó y todavía no tiene
 * fecha de junta confirmada). Al abrir el campo, esa fecha viene PRECARGADA y lo
 * que se guarda es `fecha_junta_1` — que es exactamente lo que hace a mano
 * `lib/crm-auto.ts` («R1 sin fecha_junta_1: fijamos la fecha real primero»). Sin
 * precargarla, el click abría un campo vacío sobre una fecha que se estaba
 * viendo, que es la definición de un control que rebota.
 */
export function FechaEditable({ leadId, campo, valor, fallback = null, titulo, vacio = 'sin fecha', bloqueado = false, estilo }: {
  leadId: number;
  campo: Extract<CampoInline, 'fecha_agenda' | 'fecha_junta_1' | 'fecha_junta_2' | 'fecha_confirmacion' | 'nutricion_manual_deadline'>;
  valor: string | null;
  fallback?: string | null;
  titulo: string;
  vacio?: string;
  bloqueado?: boolean;
  estilo?: CSSProperties;
}) {
  const { guardar, toast, clear } = useGuardarCampo(leadId, campo);
  const [abierto, setAbierto] = useState(false);
  const cancelado = useRef(false);
  const mostrado = valor ?? fallback;
  const texto = mostrado ? fmtDDMMYYYY(mostrado) : vacio;

  if (bloqueado) return <span style={estilo}>{texto}</span>;

  const cerrarGuardando = (v: string) => {
    setAbierto(false);
    if (cancelado.current) { cancelado.current = false; return; }
    const nuevo = v.trim() || null;
    if (nuevo === valor) return;
    guardar(nuevo, valor);
  };

  return (
    <>
      {abierto ? (
        <input
          type="date"
          autoFocus
          defaultValue={mostrado ?? ''}
          aria-label={titulo}
          onBlur={(e) => cerrarGuardando(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); return; }
            if (e.key === 'Escape') {
              // ⚠️ `stopPropagation` NO ALCANZA: los Escape de los modales viven en
              // `document` y en captura, así que sin el `stopImmediate` cancelar una
              // fecha cerraría además la ficha entera. Mismo bug que ya se pagó en
              // `EditableInline`.
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              e.preventDefault();
              cancelado.current = true;
              e.currentTarget.blur();
            }
          }}
          // `campo-ancho`: adentro de una `CajaCampo` ocupa el ancho de la tarjeta (punto 7); suelta
          // (al lado del título de una reunión) mide lo suyo, como siempre.
          className="campo-ancho"
          style={{ ...estilo, fontFamily: MONO, fontSize: 12.5, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 7, padding: '2px 6px', outline: 'none' }}
        />
      ) : (
        <button type="button" data-campo-abrir title={titulo} onClick={() => setAbierto(true)} style={{ ...disparador, ...estilo }}>{texto}</button>
      )}
      <Toast state={toast} onClose={clear} />
    </>
  );
}

// ── Tri-estado (sí / no / sin marcar) ────────────────────────────────────────

/**
 * Un sí/no/sin-marcar que se elige en el lugar: el chip es el botón y al tocarlo
 * aparecen los tres, ahí mismo. Sin modal y sin modo de edición.
 */
export function TriEditable({ leadId, campo, valor, si, no, titulo, bloqueado = false }: {
  leadId: number;
  campo: Extract<CampoInline, 'asistio_j1' | 'asistio_j2' | 'calificado'>;
  valor: boolean | null;
  si: string;
  no: string;
  titulo: string;
  bloqueado?: boolean;
}) {
  const { guardar, toast, clear } = useGuardarCampo(leadId, campo);
  const [abierto, setAbierto] = useState(false);

  if (bloqueado) return <ChipTri valor={valor} si={si} no={no} />;

  const elegir = (v: boolean | null) => {
    setAbierto(false);
    if (v === valor) return;
    guardar(v, valor);
  };

  return (
    <>
      {abierto ? (
        <span
          role="group"
          aria-label={titulo}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
          // Elegir con el teclado y salirse sin elegir: el grupo se cierra cuando el
          // foco se va a algo que NO está adentro.
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAbierto(false); }}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            e.preventDefault();
            setAbierto(false);
          }}
        >
          {([true, false, null] as const).map((v, i) => (
            <button key={String(v)} type="button" autoFocus={i === 0} onClick={() => elegir(v)}
              title={v === true ? si : v === false ? no : 'Sin marcar'}
              style={{ ...disparador, opacity: v === valor ? 1 : 0.65 }}>
              <ChipTri valor={v} si={si} no={no} />
            </button>
          ))}
        </span>
      ) : (
        <button type="button" data-campo-abrir title={titulo} onClick={() => setAbierto(true)} style={disparador}>
          <ChipTri valor={valor} si={si} no={no} />
        </button>
      )}
      <Toast state={toast} onClose={clear} />
    </>
  );
}

// ── Tri-estado a la vista (la calificación del Resumen, 16/10/2026) ──────────

/**
 * Los TRES botones siempre a la vista (sí / no / sin marcar), sin abrir nada: el diseño «Tres botones» del bloque
 * `calificacion` (docs/diseno-ficha-bloques.md §3). Escribe por el MISMO camino que `TriEditable`
 * (`guardarCampoLeadAction` → `updateLead`, el único que avisa a Meta) y con el mismo «Deshacer». Bloqueado, se ven
 * los tres apagados con el elegido marcado: la pregunta no se responde, pero tampoco se esconde.
 */
export function TriBotones({ leadId, campo, valor, si, no, titulo, bloqueado = false, marca }: {
  leadId: number;
  campo: Extract<CampoInline, 'asistio_j1' | 'asistio_j2' | 'calificado'>;
  valor: boolean | null;
  si: string;
  no: string;
  titulo: string;
  bloqueado?: boolean;
  /** Lo que busca «Solucionar» (`marcaDato`). */
  marca?: string;
}) {
  const { guardar, toast, clear } = useGuardarCampo(leadId, campo);
  const opciones = [
    { v: true, rotulo: si, clave: 'si' },
    { v: false, rotulo: no, clave: 'no' },
    { v: null, rotulo: 'Sin marcar', clave: 'nada' },
  ] as const;
  return (
    <>
      <span className="fr-seg fr-seg--llena" role="group" aria-label={titulo} data-recorrido={marca}>
        {opciones.map((o) => (
          <button key={o.clave} type="button" data-v={o.clave} aria-pressed={valor === o.v} disabled={bloqueado}
            onClick={() => { if (o.v !== valor) guardar(o.v, valor); }}>
            {o.rotulo}
          </button>
        ))}
      </span>
      <Toast state={toast} onClose={clear} />
    </>
  );
}

// ── Texto libre (motivo de salida) ───────────────────────────────────────────

/**
 * Texto que se sobrescribe con un click. Es la preferencia textual de Martín
 * («o mucho mejor si no conlleva lápiz, sino que como el nombre, simplemente le
 * doy click arriba y ya puedo sobre escribir»).
 *
 * ⚠️ NO ES UN CONTROL NUEVO: envuelve `EditableInline`, el mismo que ya edita el
 * nombre y el teléfono en `InfoPrincipalCard`. Lo único que agrega es el ruteo por
 * `guardarCampoLeadAction` (historial + Deshacer) en vez de `saveLeadMetaAction`.
 */
export function TextoEditable({ leadId, campo, valor, titulo, placeholder = '—', maxLargo = 500, className }: {
  leadId: number;
  campo: Extract<CampoInline, 'motivo_perdida'>;
  valor: string | null;
  titulo: string;
  placeholder?: string;
  maxLargo?: number;
  className?: string;
}) {
  const { guardar, toast, clear } = useGuardarCampo(leadId, campo);
  return (
    <>
      <EditableInline
        valor={valor ?? ''}
        onGuardar={(v) => guardar(v.trim() || null, valor)}
        placeholder={placeholder}
        titulo={titulo}
        maxLargo={maxLargo}
        className={className}
      />
      <Toast state={toast} onClose={clear} />
    </>
  );
}

// ── Enlace de Fathom (la grabación de una reunión) ───────────────────────────

/**
 * El link de la grabación de UNA reunión, pegado en el lugar donde se lee.
 *
 * ⚠️ SE VALIDA ANTES DE PEDIR NADA, y es lo que el formulario NO hacía: ahí el
 * campo era un `<input>` con un placeholder y guardaba cualquier cosa. Un texto
 * que no es una URL de Fathom deja el renglón con un «Abrir →» que no abre y
 * deja al análisis de la llamada sin con qué emparejarse.
 *
 * ⚠️ Y GUARDAR LA R1 NO TOCA LA R2: el parche por slot vive en el server
 * (`ponerLinkFathom`), porque el formulario rearmaba el array entero y perdía
 * todo link con otra etiqueta.
 */
export function EnlaceFathomEditable({ leadId, campo, url, titulo }: {
  leadId: number;
  campo: Extract<CampoInline, 'fathom_r1' | 'fathom_r2'>;
  url: string | null;
  titulo: string;
}) {
  const { guardar, toast, clear, show } = useGuardarCampo(leadId, campo);
  const actual = url?.trim() || null;
  return (
    <>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 140, fontSize: 12.5, color: actual ? 'var(--dim)' : 'var(--faint)', wordBreak: 'break-all', lineHeight: 1.45 }}>
          <EditableInline
            valor={actual ?? ''}
            onGuardar={(v) => {
              const nuevo = v.trim() || null;
              if (nuevo === actual) return;
              // Cinco palabras y dicen qué hacer, no la regla. El porqué vive arriba.
              if (nuevo && !FATHOM_URL.test(nuevo)) { show('Pega un link de Fathom', undefined, 'bad'); return; }
              guardar(nuevo, actual);
            }}
            placeholder="Pega el link de Fathom"
            titulo={titulo}
            maxLargo={500}
          />
        </span>
        {actual && (
          <a href={actual} target="_blank" rel="noopener noreferrer" style={{ flex: 'none', fontSize: 12.5, color: 'var(--accent)', textDecoration: 'none' }}>Abrir →</a>
        )}
      </span>
      <Toast state={toast} onClose={clear} />
    </>
  );
}

// ── Persona (closer / setter) ────────────────────────────────────────────────

/**
 * Closer o setter, elegidos del equipo con un click sobre el nombre.
 *
 * ⚠️ DOS CASOS EN QUE *NO* ES CLICKEABLE, y los dos por la misma regla:
 *  · Sin equipo cargado y sin nadie asignado, el desplegable tendría una sola
 *    opción («Sin asignar»): promete una decisión que no existe. Es el mismo
 *    criterio del selector de producto de la ficha.
 *  · Si el asignado es MaKo, lo escribió el motor al pasar al lead a una nutrición
 *    automática. MaKo no es seleccionable a mano en ningún desplegable de esta
 *    casa, así que tampoco acá.
 */
export function PersonaEditable({ leadId, campo, valor, equipo, hint }: {
  leadId: number;
  campo: Extract<CampoInline, 'closer' | 'setter'>;
  valor: string | null;
  equipo: MiembroEquipo[];
  /** Qué decir cuando no hay nadie (ej. el closer que detectó Fathom). */
  hint?: string;
}) {
  const { guardar, toast, clear } = useGuardarCampo(leadId, campo);
  const actual = valor?.trim() ?? '';

  // ⚠️ ERA UNA PUERTA DE IDA. La condición es correcta —sin equipo y sin valor no hay
  // a quién asignar— y lo que estaba mal es lo que se DIBUJABA: un guión mudo. En un
  // workspace que todavía no cargó su equipo (cualquier cliente nuevo), poner el setter
  // en «Sin asignar» hacía que al recargar el control DESAPARECIERA: el campo quedaba
  // inasignable justo después de vaciarlo. Medido el 05/10/2026 en el ws4 — el closer,
  // que conservó su valor, sobrevivió; el setter no. La única salida era «Restaurar»
  // desde el historial, que ADEMÁS borra esa entrada: recuperar el dato perdiendo el
  // rastro de que se tocó.
  //
  // Un campo que no se puede llenar se EXPLICA y lleva a donde se arregla; uno que
  // desaparece se lee como que la app está rota. Es la regla de la casa: si la única
  // salida vive en otra pantalla, no hay salida.
  if (equipo.length === 0 && !actual) {
    return (
      <Link href="/equipo" style={{ fontSize: 13, fontWeight: 600, color: 'var(--dim)', textDecoration: 'none' }}>
        Carga tu equipo →
      </Link>
    );
  }
  if (esMaKo(actual)) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MAKO_STAR_URI} alt="" width={22} height={22} style={{ borderRadius: '50%', display: 'block' }} title="MaKo — nutrición automática" />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{actual}</span>
      </span>
    );
  }

  return (
    <>
      {/* `data-campo-abrir` en un envoltorio: el botón lo dibuja el Dropdown y no se le puede marcar.
          `CajaCampo` busca el primer botón de adentro. */}
      <span data-campo-abrir style={{ display: 'inline-block', maxWidth: '100%' }}>
        <Dropdown
          value={actual}
          options={opcionesEquipo(equipo, actual)}
          onChange={(v) => { if (v !== actual) guardar(v || null, valor); }}
          placeholder={hint || '—'}
          ariaLabel={campo === 'closer' ? 'Closer asignado' : 'Setter asignado'}
          buttonStyle={{ border: 0, background: 'none', padding: 0, borderRadius: 4, fontSize: 14, fontWeight: 600, fontFamily: SANS, color: actual ? 'var(--ink)' : 'var(--faint)', maxWidth: '100%' }}
        />
      </span>
      <Toast state={toast} onClose={clear} />
    </>
  );
}

// ── Monto (el ingreso estimado) ──────────────────────────────────────────────

const fmtUsd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/**
 * Un monto en USD que se corrige en el lugar: el ingreso ESTIMADO del lead (punto 21 del
 * 12/10/2026, mig 0258). Se lee formateado («$1,500»); el clic abre una caja numérica del ancho de
 * la tarjeta con el número pelado.
 *
 * ⚠️ SE VALIDA ANTES DE PEDIR NADA (con la MISMA `montoDeTexto` que usa el server en
 * `valorDeCampo`): en producción el mensaje de un error de server action no llega a la pantalla, y
 * «1.5k» guardado como nada se leería como que el campo no anda. Vaciarlo es legítimo: borra el
 * estimado, que no es lo mismo que $0.
 */
export function MontoEditable({ leadId, campo, valor, titulo, vacio = '—', estilo }: {
  leadId: number;
  campo: Extract<CampoInline, 'ingreso_estimado'>;
  valor: number | null;
  titulo: string;
  vacio?: string;
  estilo?: CSSProperties;
}) {
  const { guardar, toast, clear, show } = useGuardarCampo(leadId, campo);
  const [abierto, setAbierto] = useState(false);
  const cancelado = useRef(false);

  const cerrarGuardando = (t: string) => {
    setAbierto(false);
    if (cancelado.current) { cancelado.current = false; return; }
    const s = t.trim();
    if (!s) { if (valor != null) guardar(null, valor); return; }
    const n = montoDeTexto(s);
    if (n == null || n < 0 || n > INGRESO_MAX_USD) { show('Monto no válido', undefined, 'bad'); return; }
    const redondo = Math.round(n * 100) / 100;
    if (redondo === valor) return;
    guardar(redondo, valor);
  };

  return (
    <>
      {abierto ? (
        <input
          autoFocus
          inputMode="decimal"
          defaultValue={valor != null ? String(valor) : ''}
          placeholder="1500"
          aria-label={titulo}
          className="campo-ancho"
          onBlur={(e) => cerrarGuardando(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); return; }
            if (e.key === 'Escape') {
              // El mismo freno que la fecha: sin el `stopImmediate`, cancelar cierra la ficha.
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              e.preventDefault();
              cancelado.current = true;
              e.currentTarget.blur();
            }
          }}
          style={{ ...estilo, fontFamily: SANS, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 7, padding: '3px 8px', outline: 'none' }}
        />
      ) : (
        <button type="button" data-campo-abrir title={titulo} onClick={() => setAbierto(true)} style={{ ...disparador, ...estilo, color: valor != null ? 'var(--ink)' : 'var(--faint)' }}>
          {valor != null ? fmtUsd(valor) : vacio}
        </button>
      )}
      <Toast state={toast} onClose={clear} />
    </>
  );
}

// ── Instagram ────────────────────────────────────────────────────────────────

/**
 * El usuario de Instagram del lead (punto 28, mig 0258), corregible en el lugar. Se lee con la @;
 * se acepta la @, el usuario pelado o el link del perfil, y se guarda normalizado
 * (`usuarioInstagram`, la MISMA regla del alta y del server).
 *
 * ⚠️ UN USUARIO QUE NO ES UN USUARIO SE RECHAZA ACÁ y el campo VUELVE a lo que tenía: el texto
 * editable ya se dio por confirmado al salir (`EditableInline`), así que sin el remonte quedaría
 * escrito algo que no se guardó.
 */
export function InstagramEditable({ leadId, valor, titulo = 'Usuario de Instagram' }: {
  leadId: number;
  valor: string | null;
  titulo?: string;
}) {
  const { guardar, toast, clear, show } = useGuardarCampo(leadId, 'instagram');
  const [vuelta, setVuelta] = useState(0);
  const actual = usuarioInstagram(valor);
  return (
    <>
      <EditableInline
        key={vuelta}
        valor={actual ? `@${actual}` : ''}
        onGuardar={(v) => {
          const s = v.trim();
          if (!s) { if (actual) guardar(null, valor); return; }
          const u = usuarioInstagram(s);
          if (!u) { show('Usuario no válido', undefined, 'bad'); setVuelta((n) => n + 1); return; }
          if (u === actual) { setVuelta((n) => n + 1); return; }
          guardar(u, valor);
        }}
        placeholder="—"
        titulo={titulo}
        maxLargo={200}
      />
      <Toast state={toast} onClose={clear} />
    </>
  );
}

// ── Teléfono, con el país primero ────────────────────────────────────────────

/**
 * El teléfono de la ficha, con el desplegable de país y banderas ANTES del número.
 *
 * Pedido de Martín (12/10/2026, punto 5): «siempre en todos lados que pida telefono, primero tiene
 * que ir la numeración que ya tenemos con las banderas, el desplegable». La pieza es la de la casa
 * (`TelefonoConPais`), con el separador de la casa (`splitTelefono`).
 *
 * ⚠️ EL VALOR QUE SE GUARDA NO CAMBIA DE FORMATO, y por eso dos reglas:
 *   · Si los DÍGITOS no cambiaron, no se escribe nada. Un teléfono guardado como lo mandó Calendly
 *     («+52 1 55 5555 5555») se abre partido en lada y número; cerrarlo sin tocarlo no puede
 *     reescribirlo con otro formato ni dejar una línea en el historial.
 *   · Si cambiaron, salen los dígitos de lada + número, que es lo que la pieza emite en todos lados
 *     y lo que el server ya normaliza (`telefono_normalizado`, el match de WhatsApp). Vaciar el
 *     número es borrar el teléfono. La regla es `telefonoAGuardar` (app/crm/campo-inline.ts).
 *
 * Guarda con Enter o al salir de la caja (un clic afuera); Escape descarta. El menú de países se
 * dibuja ADENTRO de la caja (`portalTo`): si se fuera a `document.body`, elegir un país contaría
 * como un clic afuera y guardaría a medio escribir.
 */
export function TelefonoEditable({ valor, onGuardar, titulo = 'Edita el teléfono' }: {
  valor: string | null;
  /** Lo que se guarda: los dígitos, o '' para borrarlo. Lo llama sólo si los dígitos cambiaron. */
  onGuardar: (v: string) => void;
  titulo?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [lada, setLada] = useState('');
  const [numero, setNumero] = useState('');
  // Cómo se ABRIÓ: cerrar con la misma lada y el mismo número no escribe nada (`telefonoAGuardar`).
  const inicial = useRef({ lada: '', resto: '' });
  const caja = useRef<HTMLDivElement | null>(null);
  const [nodo, setNodo] = useState<HTMLDivElement | null>(null);
  // Estable: un ref en línea es una función nueva por render, y con un `setNodo` adentro React
  // lo llamaría con null y con el nodo en cada commit.
  const refCaja = useCallback((el: HTMLDivElement | null) => { caja.current = el; setNodo(el); }, []);

  const abrir = () => {
    const p = splitTelefono(valor ?? '');
    inicial.current = p;
    setLada(p.lada);
    setNumero(p.resto);
    setAbierto(true);
  };

  // Lo último escrito, para el clic afuera (el listener vive mientras está abierto).
  const ultimo = useRef({ lada, numero });
  ultimo.current = { lada, numero };

  const cerrar = (guardarlo: boolean) => {
    setAbierto(false);
    if (!guardarlo) return;
    const { lada: l, numero: n } = ultimo.current;
    // La regla (y su test) en app/crm/campo-inline.ts: null = los dígitos no cambiaron.
    const v = telefonoAGuardar(valor, l, n, inicial.current);
    if (v != null) onGuardar(v);
  };
  const cerrarRef = useRef(cerrar);
  cerrarRef.current = cerrar;

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && caja.current?.contains(t)) return;
      cerrarRef.current(true);
    };
    // En captura: el clic afuera puede caer en un control que frena la propagación.
    document.addEventListener('pointerdown', fuera, true);
    return () => document.removeEventListener('pointerdown', fuera, true);
  }, [abierto]);

  if (!abierto) {
    return (
      <button type="button" data-campo-abrir title={titulo} onClick={abrir}
        style={{ ...disparador, display: 'block', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: valor ? 'var(--ink)' : 'var(--faint)' }}>
        {valor || '—'}
      </button>
    );
  }
  return (
    <div
      ref={refCaja}
      data-campo-editando
      style={{ position: 'relative', width: '100%' }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        e.preventDefault();
        cerrar(false);
      }}
    >
      <TelefonoConPais
        lada={lada} numero={numero} onLada={setLada} onNumero={setNumero}
        onEnter={() => cerrar(true)} autoFocus portalTo={nodo} anchoLada={112}
        inputStyle={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 8, padding: '6px 10px', outline: 'none' }}
      />
    </div>
  );
}
