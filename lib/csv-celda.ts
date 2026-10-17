// =============================================================================
// Una celda de CSV para Excel y Google Sheets — UNA regla, un lugar
// =============================================================================
// Vivía en app/dashboard/exportar.ts (el CSV de una hoja del Dashboard, con su porqué completo ahí) y se mudó acá el
// 16/10/2026 cuando la ficha del lead también exportó (app/crm/lead-view/ficha/exportar-lead.ts): importarla del
// Dashboard metía los gráficos enteros en la ficha. El Dashboard la sigue exportando con el mismo nombre.
//   · Separador COMA y números con PUNTO, sin miles ni símbolo (Excel de México y Google Sheets los leen como números).
//   · Comillas cuando el campo trae el separador, una comilla, un salto de línea o espacios en los bordes.
//   · ⚠️ INYECCIÓN DE FÓRMULAS: un TEXTO que empieza con = + - @ se abre en Excel como fórmula: se le antepone un
//     apóstrofo. A un NÚMERO negativo no: es un número.
// =============================================================================

export const SEPARADOR_CSV = ',';
/** El BOM UTF-8: sin él, Excel abre «Campaña» como «CampaÃ±a». Con su código: el carácter es invisible. */
export const BOM_CSV = String.fromCharCode(0xfeff);

/** Un número para el CSV: con punto, hasta 4 decimales, sin ceros de más. */
export function numeroCsv(n: number): string {
  if (!Number.isFinite(n)) return '';
  const r = Math.round(n * 10_000) / 10_000;
  return Object.is(r, -0) ? '0' : String(r);
}

/** Una celda: los números tal cual; los textos con comillas cuando hacen falta y sin fórmulas. */
export function celdaCsv(v: string | number | null | undefined, sep = SEPARADOR_CSV): string {
  if (v == null) return '';
  if (typeof v === 'number') return numeroCsv(v);
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  const comillas = s.includes(sep) || /["\r\n]/.test(s) || /^\s|\s$/.test(s);
  return comillas ? `"${s.replace(/"/g, '""')}"` : s;
}
