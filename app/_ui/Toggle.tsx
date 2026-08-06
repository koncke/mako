'use client';

// =============================================================================
// Checkbox · Radio · Switch — los tres controles de encendido/apagado
// =============================================================================
// No son intercambiables, y elegir mal confunde:
//   Checkbox  varias opciones, cada una independiente. Se guarda al confirmar.
//   Radio     una entre varias, excluyentes. Si son más de cinco, va un Select.
//   Switch    prende o apaga algo YA, sin confirmar. Si tu cambio necesita un
//             botón «Guardar» después, no es un switch: es un checkbox.
//
// Los tres usan el control NATIVO por debajo (menos el switch, que es un botón
// con role). Eso conserva el foco por teclado, el anuncio del lector de pantalla
// y el click sobre la etiqueta — lo que se pierde cuando alguien los dibuja con
// <div> y un onClick.

import { useId, type ReactNode } from 'react';

function Marca({ checked, disabled, label, hint, onChange, tipo, name }: {
  checked: boolean; disabled?: boolean; label: ReactNode; hint?: ReactNode;
  onChange: (v: boolean) => void; tipo: 'checkbox' | 'radio'; name?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={`mk-check${disabled ? ' is-disabled' : ''}`}>
      <input id={id} type={tipo} name={name} checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} />
      <span style={{ minWidth: 0 }}>
        {label}
        {hint && <span className="mk-hint" style={{ display: 'block', marginTop: 2 }}>{hint}</span>}
      </span>
    </label>
  );
}

export function Checkbox(p: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return <Marca {...p} tipo="checkbox" />;
}

export function Radio(p: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean; name: string }) {
  return <Marca {...p} tipo="radio" />;
}

/**
 * Grupo de radios. Recibe el valor y las opciones; se encarga del `name`
 * compartido (sin él las flechas del teclado no navegan entre las opciones).
 */
export function RadioGroup({ value, onChange, options, label, disabled }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: ReactNode; hint?: ReactNode }[];
  label?: string;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      {label && <legend className="mk-label" style={{ padding: 0 }}>{label}</legend>}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {options.map((o) => (
          <Radio key={o.value} name={name} checked={value === o.value} disabled={disabled}
            onChange={(on) => { if (on) onChange(o.value); }} label={o.label} hint={o.hint} />
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Switch: aplica el cambio en el momento. Lleva SIEMPRE una etiqueta al lado —
 * un interruptor pelado no dice qué apaga.
 */
export function Switch({ checked, onChange, label, hint, disabled }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const boton = (
    <button type="button" role="switch" aria-checked={checked} aria-label={typeof label === 'string' ? label : undefined}
      disabled={disabled} onClick={() => onChange(!checked)} className="mk-switch" />
  );
  if (!label) return boton;
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 11, minHeight: 'var(--touch)', padding: '4px 0', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      {boton}
      <span style={{ minWidth: 0, fontSize: 'var(--fs-md)', color: 'var(--ink)', lineHeight: 1.4 }}>
        {label}
        {hint && <span className="mk-hint" style={{ display: 'block', marginTop: 2 }}>{hint}</span>}
      </span>
    </label>
  );
}
