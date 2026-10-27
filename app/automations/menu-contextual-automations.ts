// =============================================================================
// menu-contextual-automations — el clic derecho de una automatización de la lista (puro)
// =============================================================================
// Pedido de Leandro (24/10/2026, f26): el clic derecho «casi que en toda la app». El clic derecho de una fila (y mantenerla
// presionada) ofrece LO MISMO que su «⋯»: las opciones salen de `opcionesDeFila` (SimuladorWhatsApp.tsx), la MISMA función,
// así que una opción nueva del «⋯» aparece sola acá. Lo único que se suma es «Abrir» arriba, que es lo que ya hace tocar la
// fila, y que «Eliminar» va separado y en rojo (en el «⋯» es el último renglón, con la papelera roja de la casa).
// Sólo donde hay «⋯» (un admin, una fila que no se está creando); lo que hace cada opción es `accionFila`, la del «⋯».
// =============================================================================
import type { EntradaMenuContextual } from '@/app/_ui/MenuContextual';
import type { NombreIconoMenu } from '@/app/_ui/iconos-menu';

export function itemsFilaAutomatizacion(
  opciones: ReadonlyArray<{ value: string; label: string; icono: NombreIconoMenu }>,
  ocupada: boolean,
): EntradaMenuContextual[] {
  const out: EntradaMenuContextual[] = [{ id: 'abrir', label: 'Abrir', icono: 'ver' }, null];
  for (const o of opciones) {
    // Mientras una acción de esa fila está en vuelo, su «⋯» se apaga: acá, sus renglones.
    const it = { id: o.value, label: o.label, icono: o.icono, deshabilitado: ocupada };
    if (o.value === 'eliminar') out.push(null, { ...it, peligro: true });
    else out.push(it);
  }
  return out;
}
