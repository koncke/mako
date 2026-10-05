// =============================================================================
// equipo-opciones — las opciones de un desplegable de Closer / Setter
// =============================================================================
// Setter y closer son SIEMPRE alguien del equipo del workspace, nunca texto
// libre. Pero el valor guardado puede ser un nombre viejo que ya no está en el
// equipo (un dato importado, alguien que se fue): ése se ofrece igual, marcado
// «fuera del equipo», porque un desplegable que no tiene el valor actual se abre
// mostrando otra cosa y guardar sin querer lo pisa.
//
// Una sola copia: la usa el formulario de edición y el campo editable de la
// ficha. Con dos, el día que una agregue a alguien la otra lo pierde.

import type { DropdownOption } from '@/app/components/Dropdown';
import type { MiembroEquipo } from './actions';

export function opcionesEquipo(equipo: MiembroEquipo[], actual: string): DropdownOption[] {
  const opts: DropdownOption[] = [{ value: '', label: 'Sin asignar' }];
  for (const m of equipo) opts.push({ value: m.nombre, label: m.nombre, avatar: m.foto_url ?? null });
  const cur = actual.trim();
  if (cur && !equipo.some((m) => m.nombre === cur)) opts.push({ value: cur, label: cur, sub: 'fuera del equipo', avatar: null });
  return opts;
}
