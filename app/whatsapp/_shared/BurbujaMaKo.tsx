'use client';

// =============================================================================
// BurbujaMaKo — un mensaje que MANDA el negocio, como se ve en WhatsApp
// =============================================================================
// La anatomía de la burbuja saliente, en UN lugar. Antes vivía copiada a mano en
// dos: `ChatHilo` (el hilo real, solo lectura) y `MensajesChat` (los pasos de una
// secuencia, editables), con un ⚠️ en cada archivo avisando que si alguien cambiaba
// una había que mover la otra. Dos copias con un comentario que pide sincronizarlas
// a mano son dos copias que se van a desincronizar; al sumar la tercera —el texto de
// un aviso en Configuraciones › Notificaciones— se extrajo en vez de copiar de nuevo.
//
// Por qué un mensaje se edita ADENTRO de la burbuja y no en un campo aparte, con las
// palabras de Martín: «el diseño para editar los mensajes tiene que ser tipo CHAT,
// simular el chat que ya tenemos construido, solo editar el mensaje allí mismo». Un
// mensaje de WhatsApp se juzga por cómo SE VE cuando llega — el largo, los saltos de
// línea, cómo se lee de corrido. Un textarea gris no contesta esa pregunta.
//
// Lo que este componente NO hace, a propósito: el mensaje del LEAD. Acá se pinta lo
// que el negocio manda. Inventar la respuesta del otro es otra cosa (el simulador).

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

const SANS = "'Geist', sans-serif";

/**
 * LA FORMA. Mismo radio con la esquina mordida abajo a la derecha, mismo
 * `--wa-bubble`, mismo 78%. Se exporta porque `ChatHilo` pinta sus propias
 * burbujas de solo lectura con su scroll y su lightbox: comparte la FORMA sin
 * heredar el comportamiento.
 */
export const BURBUJA_SALIENTE: CSSProperties = {
  maxWidth: '78%',
  padding: '10px 13px',
  borderRadius: '14px 14px 4px 14px',
  background: 'var(--wa-bubble)',
  border: '1px solid rgba(91,107,214,.30)',
  boxShadow: '0 1px 2px rgba(18,21,27,.04)',
};

/**
 * La píldora del sistema: centrada y sin burbuja. Es lo que NO recibe el lead —
 * cuándo sale, bajo qué condición. Pintarla como burbuja haría creer que al lead
 * le llega un mensaje que dice «Al día siguiente».
 */
export const PILDORA_SISTEMA: CSSProperties = {
  maxWidth: '86%', padding: '6px 13px', borderRadius: 999,
  background: 'var(--surface)', border: '1px dashed var(--border-strong)',
  color: 'var(--faint)', fontSize: 11.5, lineHeight: 1.45, textAlign: 'center',
};

/** Un textarea que crece con el texto: adentro de una burbuja, una barra de scroll es un cuerpo extraño. */
export function Autocrece({ value, onChange, placeholder, autoFocus, onListo }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  onListo: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        // Escape cierra la edición. Enter NO: un mensaje de WhatsApp lleva saltos
        // de línea a propósito, y perderlos al tipear sería el bug.
        if (e.key === 'Escape') { e.preventDefault(); onListo(); }
      }}
      placeholder={placeholder}
      rows={1}
      style={{
        width: '100%', boxSizing: 'border-box', display: 'block', resize: 'none',
        border: 'none', background: 'transparent', outline: 'none', padding: 0, margin: 0,
        color: 'var(--ink)', fontSize: 13.5, lineHeight: 1.55, fontFamily: SANS,
        overflow: 'hidden', minHeight: 21,
      }}
    />
  );
}

/**
 * Una burbuja saliente que se lee y —si `editable`— se edita tocándola.
 *
 * `vacio` es el texto en gris que se muestra cuando no hay nada escrito. Dice qué
 * pasa si se deja así, no «(vacío)»: en un aviso, vacío significa que lo redacta
 * MaKo, y eso hay que decirlo donde se decide.
 */
export function BurbujaMaKo({
  texto, onChange, editando, onEditar, onListo, editable = true, vacio, placeholder, encabezado, pie,
}: {
  texto: string;
  onChange: (v: string) => void;
  editando: boolean;
  onEditar: () => void;
  onListo: () => void;
  editable?: boolean;
  vacio: string;
  placeholder: string;
  encabezado?: ReactNode;
  pie?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ ...BURBUJA_SALIENTE, minWidth: editando ? '78%' : undefined }}>
        {encabezado}
        {editando ? (
          <Autocrece value={texto} onChange={onChange} autoFocus onListo={onListo} placeholder={placeholder} />
        ) : (
          // No es un <button>: un botón trae text-align:center y su propia
          // tipografía, y el mensaje quedaría centrado — el bug que AGENTS.md
          // documenta con el hero del portal de cursos.
          <div
            role={editable ? 'button' : undefined}
            tabIndex={editable ? 0 : undefined}
            onClick={() => editable && onEditar()}
            onKeyDown={(e) => { if (editable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onEditar(); } }}
            title={editable ? 'Editar este mensaje' : undefined}
            style={{
              fontSize: 13.5, lineHeight: 1.55, color: texto.trim() ? 'var(--ink)' : 'var(--faint)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: editable ? 'text' : 'default',
              fontStyle: texto.trim() ? 'normal' : 'italic', outline: 'none',
            }}
          >
            {texto.trim() || vacio}
          </div>
        )}
        {pie}
      </div>
    </div>
  );
}
