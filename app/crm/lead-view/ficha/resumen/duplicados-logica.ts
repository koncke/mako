// =============================================================================
// ficha/resumen/duplicados-logica — lo que dice el bloque «Posibles duplicados» de cada ficha parecida (puro, con test)
// =============================================================================
// 23/10/2026, Martín: «ese bloque en el detail requiere más info... ¿En que CRM aparece duplicada? etc...». Lo ejecuta
// tests/ficha-unificar.test.ts.
// =============================================================================

import type { DondeEsta } from './bloques-actions';

/** «Sprint 3 días › Prospección activa · Negocio que ESCALA › Lead entrante» (la casa primero, ya ordenada). */
export function dondeEnUnaLinea(donde: readonly DondeEsta[]): string {
  return donde.map((d) => (d.etapa ? `${d.crm} › ${d.etapa}` : d.crm)).join(' · ');
}

/** «Existe desde el 22 oct 2026», en la zona del negocio. Sin fecha válida, vacío. */
export function desdeCuando(iso: string, tz: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const f = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz }).format(d).replace(/\./g, '');
  return `Existe desde el ${f}`;
}
