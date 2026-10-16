// =============================================================================
// «Exportar» de la ficha del lead: sus datos en un CSV de dos columnas (Campo, Valor)
// =============================================================================
// Feedback de Martín del 16/10/2026 (punto 10 del CRM): el «⋯» de la ficha, como el del Dashboard, «para exportar esa
// hoja del lead». Es el «Datos (CSV)» del ⋮ del Dashboard (app/dashboard/EditorInforme.tsx) con la celda de la casa
// (lib/csv-celda.ts: sin fórmulas, comillas cuando hacen falta) y el BOM para Excel. Va VERTICAL: un lead es una
// ficha, no una tabla. Sin montos: lo privado del cierre no sale en un archivo que se reenvía.
// El PDF (la impresión, como el del Dashboard) queda pendiente: pide una hoja de impresión propia de la ficha.

import { BOM_CSV, celdaCsv, SEPARADOR_CSV } from '@/lib/csv-celda';

export type FilaLead = readonly [string, string | number | null | undefined];

/** El CSV de una ficha: «Campo,Valor» y una fila por dato; las vacías no salen. */
export function csvDelLead(filas: readonly FilaLead[]): string {
  const lineas = [`Campo${SEPARADOR_CSV}Valor`];
  for (const [campo, valor] of filas) {
    if (valor == null || (typeof valor === 'string' && !valor.trim())) continue;
    lineas.push(`${celdaCsv(campo)}${SEPARADOR_CSV}${celdaCsv(valor)}`);
  }
  return BOM_CSV + lineas.join('\r\n') + '\r\n';
}

/** El nombre del archivo: «lead-412-maria-perez.csv» (sin tildes ni espacios). */
export function nombreArchivoLead(id: number, nombre: string | null | undefined): string {
  const limpio = (nombre ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `lead-${id}${limpio ? `-${limpio}` : ''}.csv`;
}
