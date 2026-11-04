// =============================================================================
// visitas-momento — el DÍA DE LA SEMANA y la FRANJA HORARIA de una visita, en la zona del negocio
// =============================================================================
// Lo pidió la copia de Corbel para la hoja Landing (4/11/2026; docs/diseno/mockups-dashboard/landing-corbel/): su «Visits by
// time» es una grilla de 4 franjas × 7 días. En MaKo son dos dimensiones de la fuente `visitas` (lib/graficos-catalogo.ts) que
// cualquier gráfico puede usar, con su orden fijo (lunes primero; la madrugada arriba), y las calcula `filasVisitas`
// (lib/graficos-datos.ts) con la zona del NEGOCIO: la hora de una visita es la de quien atiende la página, no la de la app.
//
// Puro y sin `server-only`: lo usan el catálogo, el lector de datos, el diseño de la hoja y el test.
// =============================================================================

/** Los días, en el orden de la grilla (lunes primero, como en Corbel). */
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;
/** Las cuatro franjas de Corbel (12 AM – 8 AM, 8 AM – 12 PM, 12 PM – 4 PM, 4 PM – 12 AM), con el reloj de 24 horas. */
export const FRANJAS_HORA = ['0 a 8 h', '8 a 12 h', '12 a 16 h', '16 a 24 h'] as const;

const DIA_INGLES: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const formatos = new Map<string, Intl.DateTimeFormat>();
const formatoDe = (tz: string): Intl.DateTimeFormat => {
  let f = formatos.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', hourCycle: 'h23' });
    formatos.set(tz, f);
  }
  return f;
};

/** La franja de una hora del día (0 a 23). */
export function franjaDeHora(h: number): (typeof FRANJAS_HORA)[number] {
  return h < 8 ? FRANJAS_HORA[0] : h < 12 ? FRANJAS_HORA[1] : h < 16 ? FRANJAS_HORA[2] : FRANJAS_HORA[3];
}

/**
 * El día y la franja de un instante (ISO) en una zona. `null` si el instante no se puede leer o la zona no existe: una visita
 * sin hora no se reparte en una franja inventada.
 */
export function momentoDeVisita(iso: unknown, tz: string): { dia: (typeof DIAS_SEMANA)[number]; franja: (typeof FRANJAS_HORA)[number] } | null {
  if (typeof iso !== 'string' || !iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  let partes: Intl.DateTimeFormatPart[];
  try { partes = formatoDe(tz).formatToParts(new Date(ms)); } catch { return null; }
  const d = DIA_INGLES[partes.find((p) => p.type === 'weekday')?.value ?? ''];
  const h = Number(partes.find((p) => p.type === 'hour')?.value);
  if (d == null || !Number.isFinite(h)) return null;
  return { dia: DIAS_SEMANA[d], franja: franjaDeHora(h % 24) };
}
