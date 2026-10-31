// =============================================================================
// menu-contextual-partners — QUÉ ofrece el clic derecho de un partner en la tabla de MaKo Partners (puro)
// =============================================================================
// Pedido de Leandro (24/10/2026, f26): el clic derecho «casi que en toda la app». La tabla del programa (la del super admin,
// ProgramaPartners.tsx) tiene UNA acción por fila: «Marcar pagado», cuando se le debe algo. El menú ofrece ésa y nada más;
// sin deuda, no hay menú (y el clic derecho es el del navegador). La tabla del partner (PanelPartner.tsx) no tiene ninguna
// acción por negocio: ahí no hay menú.
// =============================================================================
import type { EntradaMenuContextual } from '@/app/_ui/MenuContextual';

export function itemsPartnerPrograma(p: { aCobrarUsd: number }, anotando: boolean): EntradaMenuContextual[] {
  // La MISMA condición que el botón de la fila: sólo si hay algo a pagar. Apagado mientras se anota.
  return p.aCobrarUsd > 0 ? [{ id: 'marcar_pagado', label: 'Marcar pagado', icono: 'dinero', deshabilitado: anotando }] : [];
}
