'use client';

// =============================================================================
// Field · Input · Textarea — el campo, con todo lo que un campo necesita
// =============================================================================
// Hoy hay 269 <input> y 93 <textarea> sueltos en app/, y tres campos distintos
// compitiendo (.mako-field del onboarding, .lead-field de la ficha, y lo que
// cada pantalla escribió a mano). Este es el único.
//
// `Field` es el ENVOLTORIO (label, ayuda, error, contador); `Input`/`Textarea`
// son el control. Se pueden usar juntos o por separado: dentro de una fila de
// tabla a veces querés el control pelado.
//
// Reglas que aplica solo:
// · El error se muestra COMO TEXTO además del borde rojo. El color solo no
//   alcanza: quien no lo distingue se queda sin saber qué campo falló.
// · Ayuda y error no conviven — si hay error, el error reemplaza a la ayuda.
// · El label está conectado al control por id, así que tocar el texto enfoca
//   el campo (y en un teléfono eso es la diferencia entre poder y no poder).

import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

type FieldProps = {
  label?: string;
  /** Marca visual de obligatorio. La validación de verdad la hace el formulario. */
  required?: boolean;
  /** Explica QUÉ poner o de dónde sale el dato. No repite el label. */
  hint?: ReactNode;
  /** Qué está mal y cómo arreglarlo. Si viene, tapa a `hint`. */
  error?: string;
  /** Contador de caracteres: [usados, máximo]. Se pone rojo al pasarse. */
  count?: [number, number];
  children: ReactNode;
  /** id del control, para conectar el <label>. Si no viene, se genera. */
  htmlFor?: string;
  style?: React.CSSProperties;
};

export function Field({ label, required, hint, error, count, children, htmlFor, style }: FieldProps) {
  const pie = error || hint || count;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, ...style }}>
      {label && (
        <label className="mk-label" htmlFor={htmlFor} style={{ marginBottom: 0 }}>
          {label}{required && <span className="mk-req" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {pie && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'space-between' }}>
          {error
            ? <span className="mk-err" role="alert">{error}</span>
            : hint ? <span className="mk-hint">{hint}</span> : <span />}
          {count && (
            <span className={`mk-count${count[0] > count[1] ? ' is-over' : ''}`}>{count[0]}/{count[1]}</span>
          )}
        </div>
      )}
    </div>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & {
  error?: boolean;
  /** Texto o ícono pegado a la izquierda del valor: «$», «https://», una lupa. */
  prefix?: ReactNode;
  /** Ídem a la derecha: «%», «USD», el botón de revelar una credencial. */
  suffix?: ReactNode;
};

export function Input({ error, prefix, suffix, className, ...rest }: InputProps) {
  const cls = ['mk-input', error ? 'is-error' : '', className ?? ''].filter(Boolean).join(' ');
  if (!prefix && !suffix) return <input className={cls} aria-invalid={error || undefined} {...rest} />;
  // Con prefijo/sufijo el anillo de foco lo pinta la CAJA (:focus-within), no el
  // input: de lo contrario se ve un campo adentro de otro campo.
  return (
    <div className={`mk-inputwrap${error ? ' is-error' : ''}`}>
      {prefix && <span className="mk-affix">{prefix}</span>}
      <input className={cls} aria-invalid={error || undefined} {...rest} />
      {suffix && <span className="mk-affix">{suffix}</span>}
    </div>
  );
}

export function Textarea({ error, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  const cls = ['mk-textarea', error ? 'is-error' : '', className ?? ''].filter(Boolean).join(' ');
  return <textarea className={cls} aria-invalid={error || undefined} {...rest} />;
}

/**
 * El caso completo de un tirón: label + control + ayuda/error + contador, con el
 * id ya conectado. Es lo que vas a usar el 90% de las veces.
 */
// `error` se re-declara como STRING (el mensaje), no como el boolean del Input:
// acá el texto es obligatorio. Sin el Omit, la intersección de `boolean` y
// `string` deja el tipo en `never` y no se puede pasar ningún error.
export function TextField({ label, required, hint, error, maxLength, value, prefix, suffix, multiline, style, ...rest }:
  Omit<InputProps, 'style' | 'error'> & { label?: string; hint?: ReactNode; error?: string; multiline?: boolean; style?: React.CSSProperties }) {
  const id = useId();
  const largo = typeof value === 'string' ? value.length : 0;
  const control = multiline
    ? <Textarea id={id} error={!!error} maxLength={maxLength} value={value} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
    : <Input id={id} error={!!error} maxLength={maxLength} value={value} prefix={prefix} suffix={suffix} {...rest} />;
  return (
    <Field label={label} required={required} hint={hint} error={error} htmlFor={id} style={style}
      count={maxLength ? [largo, maxLength] : undefined}>
      {control}
    </Field>
  );
}
