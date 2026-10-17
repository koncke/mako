'use client';

// =============================================================================
// ElegirFunnels — «de qué funnels»: uno, varios o todos
// =============================================================================
// La pieza del 17/10/2026 (Martín, a un cliente: «si tienes varios CRM que sea una selección múltiple y que puedas
// seleccionar 1 o varios»). La usan el OKR y el KPI de /general y el bloque «A quién cobrarle»; cualquier otra
// configuración que elija funnels usa ÉSTA, no un desplegable propio (el inventario de dónde falta, en
// docs/hallazgos-objectives.md → «Un OKR que suma varios funnels»).
//
// Es el Dropdown de la casa con `varios` (app/components/Dropdown.tsx), con una regla propia: «Todos» es un renglón
// más, prendido cuando no hay ninguno elegido. Elegir uno apaga «Todos»; apagar el último lo vuelve a prender. Así
// el control nunca muestra «nada elegido», que se leería como «no cuenta nada» cuando quiere decir el negocio entero.
// La regla vive en lib/funnels-elegidos.ts (`alternarFunnel`), con test.
// =============================================================================

import { Dropdown } from './Dropdown';
import { Select } from '@/app/_ui/Select';
import { alternarFunnel } from '@/lib/funnels-elegidos';

export type FunnelElegible = { id: number; nombre: string };

export function ElegirFunnels({ funnels, valor, onCambiar, todos = 'Todos los funnels', label, hint, disabled, ariaLabel }: {
  funnels: readonly FunnelElegible[];
  /** Los elegidos. Vacío = todos. */
  valor: readonly number[];
  onCambiar: (ids: number[]) => void;
  /** Cómo se llama «ninguno elegido» acá («Todo el negocio», «Todos los funnels»). */
  todos?: string;
  /** Con `label`, va como campo de formulario (con su ayuda); sin él, el desplegable solo (el panel de un bloque). */
  label?: string;
  hint?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  // Uno elegido que ya no está (se borró el funnel) se muestra igual, marcado: si no estuviera entre las opciones no
  // se vería, y la persona no sabría por qué el número no le cierra.
  const perdidos = valor.filter((id) => !funnels.some((f) => f.id === id));
  const options = [
    { value: '', label: todos, icono: 'etapa' as const },
    ...funnels.map((f) => ({ value: String(f.id), label: f.nombre, icono: 'etapa' as const })),
    ...perdidos.map((id) => ({ value: String(id), label: 'Un funnel que ya no está', icono: 'cerrar' as const })),
  ];
  const varios = valor.length ? valor.map(String) : [''];
  const tocar = (v: string) => onCambiar(alternarFunnel(valor, v));
  const aria = ariaLabel ?? label ?? 'De qué funnels';
  if (label) {
    return <Select label={label} hint={hint} options={options} value="" varios={varios} onChange={tocar} disabled={disabled} ariaLabel={aria} />;
  }
  return <Dropdown value="" options={options} varios={varios} onChange={tocar} disabled={disabled} width="100%" ariaLabel={aria} />;
}
