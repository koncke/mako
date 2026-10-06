'use client';

// =============================================================================
// Select — el desplegable del sistema (con label, ayuda y error)
// =============================================================================
// Por dentro es el Dropdown de la casa (app/components/Dropdown.tsx), que ya
// resuelve el portal, el cierre por Escape/scroll, los grupos en columnas y —
// desde el rediseño — la BÚSQUEDA cuando hay más de 8 opciones.
//
// NUNCA uses <select> nativo: no se puede estilar igual en los distintos
// navegadores y rompe la coherencia de la app. Si necesitás algo que el
// Dropdown no hace, se lo agregás AL Dropdown, no escribís un segundo.

import { useId, type ReactNode } from 'react';
import { Dropdown, type DropdownOption, type DropdownGroup } from '@/app/components/Dropdown';
import { Field } from './Field';

export type { DropdownOption as SelectOption, DropdownGroup as SelectGroup };

export function Select({
  label, hint, error, required, options, columns, value, onChange, placeholder,
  width, disabled, search, style, ariaLabel, varios, minimo,
}: {
  label?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  options?: DropdownOption[];
  /** Menú en columnas para listas largas con grupos (evita el scroll infinito). */
  columns?: DropdownGroup[][];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number | string;
  disabled?: boolean;
  /** Caja de búsqueda. Por defecto aparece sola pasadas las 8 opciones. */
  search?: boolean;
  style?: React.CSSProperties;
  ariaLabel?: string;
  /** Elegir VARIOS: ver la prop del mismo nombre en app/components/Dropdown.tsx. */
  varios?: string[];
  /** Con `varios`: cuántos tienen que quedar marcados. */
  minimo?: number;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} style={style}>
      <Dropdown
        value={value}
        options={options}
        columns={columns}
        onChange={onChange}
        placeholder={placeholder}
        width={width ?? '100%'}
        disabled={disabled}
        search={search}
        varios={varios}
        minimo={minimo}
        ariaLabel={ariaLabel ?? label}
        buttonStyle={{
          minHeight: 'var(--touch)',
          borderRadius: 'var(--r-md)',
          fontSize: 'var(--fs-md)',
          borderColor: error ? 'var(--bad)' : undefined,
        }}
      />
    </Field>
  );
}
