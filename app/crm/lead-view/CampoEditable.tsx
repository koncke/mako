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

import { useRef, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { EditableInline } from '@/app/_components/EditableInline';
import { Toast, useToast } from '@/app/_ui/Toast';
import { Dropdown } from '@/app/components/Dropdown';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { guardarCampoLeadAction } from '../actions';
import { opcionesEquipo } from '../equipo-opciones';
import { esMaKo, MAKO_STAR_URI } from '../mako-setter';
import { ChipTri } from './chip-tri';
import { FATHOM_URL, type CampoInline, type ValorInline } from '../campo-inline';
import type { MiembroEquipo } from '../actions';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

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
 */
function useGuardarCampo(leadId: number, campo: CampoInline) {
  const router = useRouter();
  const { toast, show, clear } = useToast();
  const [, startGuardar] = useTransition();
  const guardar = (nuevo: ValorInline, antes: ValorInline) => {
    startGuardar(async () => {
      try {
        await guardarCampoLeadAction(leadId, campo, nuevo);
        router.refresh();
        show('Guardado', () => {
          startGuardar(async () => {
            try { await guardarCampoLeadAction(leadId, campo, antes); router.refresh(); }
            catch { show('No se pudo deshacer', undefined, 'bad'); }
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
          style={{ ...estilo, fontFamily: MONO, fontSize: 12.5, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 7, padding: '2px 6px', outline: 'none' }}
        />
      ) : (
        <button type="button" title={titulo} onClick={() => setAbierto(true)} style={{ ...disparador, ...estilo }}>{texto}</button>
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
        <button type="button" title={titulo} onClick={() => setAbierto(true)} style={disparador}>
          <ChipTri valor={valor} si={si} no={no} />
        </button>
      )}
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

  if (equipo.length === 0 && !actual) return <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--faint)' }}>{hint || '—'}</span>;
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
      <Dropdown
        value={actual}
        options={opcionesEquipo(equipo, actual)}
        onChange={(v) => { if (v !== actual) guardar(v || null, valor); }}
        placeholder={hint || '—'}
        ariaLabel={campo === 'closer' ? 'Closer asignado' : 'Setter asignado'}
        buttonStyle={{ border: 0, background: 'none', padding: 0, borderRadius: 4, fontSize: 14, fontWeight: 600, fontFamily: SANS, color: actual ? 'var(--ink)' : 'var(--faint)', maxWidth: '100%' }}
      />
      <Toast state={toast} onClose={clear} />
    </>
  );
}
