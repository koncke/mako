// =============================================================================
// datos-comercial — lo PURO de «A quién cobrarle» y del Outstanding: la ventana y el orden de la cobranza
// =============================================================================
// Martín, 11/10/2026 (punto 5): «En Comercial está diferente la parte de "A quién cobrarle", antes
// era un desplegable... Estoy seguro de que había otro dato de lo cobrado total... Y con las opciones
// de "Marcar como cobrada"». Esto nació como lo puro de los BLOQUES de Comercial del Dashboard (en la
// carpeta `bloques/` del Dashboard hasta el 13/10/2026), con las cuentas de la tab vieja (app/comercial/page.tsx
// hasta 7527b8c2). Los bloques se fueron en v5 y lo que quedó vivo lo usan tres:
//   · el conjunto «Clientes por cobrar» de los gráficos (lib/graficos-datos-extra.ts): `armarCobranza`, `nombreCuota`;
//   · la hoja Comercial del teléfono (lib/datos-comercial-server.ts → app/m/dashboard/datos.ts);
//   · el test (tests/datos-comercial.test.ts).
//
// ⚠️ SIN `server-only` a propósito: lo importa el test. Los tipos de lib/pagos entran con `import type`,
//    que se borra al compilar.
//
// Las CUENTAS de cada número (Sold, Cash, Outstanding) NO viven acá: siguen en lib/queries.ts y
// lib/pagos.ts, que son las mismas que leen los runners de MaKo. Acá sólo se ARMA lo que ya se leyó: el
// orden de «A quién cobrarle» y la ventana del Outstanding.

import type { OutstandingLead } from '@/lib/pagos';
import { finDeMesDeFecha } from '@/lib/date-utils';
import { rangoDe } from '@/lib/graficos-catalogo';

// ── El período ──────────────────────────────────────────────────────────────────────────────

/** Una ventana de vencimientos; `null` en las dos puntas = todo el pipeline (incluidas las cuotas sin fecha). */
export type Ventana = { desde: string | null; hasta: string | null };

/** El `desde` del preset «Todo» del catálogo (sale de `rangoDe`, no se copia: con dos constantes, una se queda vieja). */
export const DESDE_TODO = rangoDe('todo', '2000-01-01').desde;

/**
 * La ventana del Outstanding y de «A quién cobrarle», la MISMA que la tab vieja: mira hacia ADELANTE
 * («lo que falta cobrar»), desde el inicio del período hasta el FIN DE MES de su último día. Con «Todo»
 * (o un inicio igual o anterior), el pipeline entero: cuotas futuras y sin fecha incluidas.
 *
 * ⚠️ Por esto las fechas llegan SIN acotar a hoy (app/m/dashboard/datos.ts): con los presets que terminan
 *    en hoy y un recorte, el Outstanding de «Últimos 30 días» contaba sólo lo ya vencido, y una cuota que
 *    vence el viernes no figuraba en ningún lado.
 * ⚠️ La vieja decidía «todo» con `desde <= 2025-11-01` (el inicio de operación del primer cliente).
 *    Acá se decide con el «Todo» del catálogo: con aquella vara, «Últimos 12 meses» (que hoy arranca el
 *    1/11/2025) contaba como todo el pipeline.
 */
export function ventanaOutstanding(desde: string, hasta: string): Ventana {
  if (desde <= DESDE_TODO) return { desde: null, hasta: null };
  return { desde, hasta: finDeMesDeFecha(hasta) };
}

/** Lo vendido y lo cobrado se miden hasta HOY: un período que termina después se acota (como la vieja y la ruta). */
export function hastaHoy(desde: string, hasta: string, hoy: string): string {
  if (hasta <= hoy) return hasta;
  return hoy < desde ? desde : hoy;
}

// ── A quién cobrarle ────────────────────────────────────────────────────────────────────────

/** `vencida` = el vencimiento ya pasó (la fila va en rojo con URGENTE); `pronto` = vence en 5 días o menos. */
export type Urgencia = 'vencida' | 'pronto' | null;
export const DIAS_PRONTO = 5;

export type FilaCobro = {
  leadId: number;
  nombre: string;
  /** Lo vendido al lead (su monto de cierre). */
  vendido: number | null;
  /** Lo cobrado TOTAL del lead, sin ventana: el «otro dato de lo cobrado» que pidió Martín. */
  cobrado: number;
  /** Lo que falta cobrarle dentro de la ventana. */
  pendiente: number;
  /** La próxima cuota sin pagar: la que se marca con «Marcar cobrado». */
  cuota: { pagoId: number; numero: number; monto: number; vence: string | null } | null;
  /** Días hasta el vencimiento (negativo = vencida hace N días). */
  dias: number | null;
  urgencia: Urgencia;
};

/** Días calendario de `hoy` a `iso` (los dos 'YYYY-MM-DD'); en UTC para no tropezar con el horario de verano. */
export function diasHasta(iso: string | null, hoy: string): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const [hy, hm, hd] = hoy.split('-').map(Number);
  if (![y, m, d, hy, hm, hd].every(Number.isFinite)) return null;
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 86_400_000);
}

export function urgenciaDe(dias: number | null): Urgencia {
  if (dias == null) return null;
  if (dias < 0) return 'vencida';
  return dias <= DIAS_PRONTO ? 'pronto' : null;
}

/** El nombre de una cuota como lo escribe lib/pagos.ts: la 0 es el cobro inicial. */
export const nombreCuota = (n: number) => (n === 0 ? 'cobro inicial' : `cuota ${n}`);

/**
 * Las filas de «A quién cobrarle», como la tabla vieja (app/comercial/CobrarTable.tsx): ordenadas por
 * el vencimiento MÁS CERCANO arriba (lo vencido hace más tiempo primero, las sin fecha al final), con su
 * urgencia y el total pendiente. Los empates van por lo que más se debe y después por nombre, para que
 * el orden no dependa de cómo vino la lectura.
 *
 * El total se suma de las MISMAS filas que se dibujan: así un pie «Total pendiente» no puede contar
 * distinto que la tabla.
 */
export function armarCobranza(items: readonly OutstandingLead[], hoy: string): { filas: FilaCobro[]; total: number } {
  const filas: FilaCobro[] = items.map((it) => {
    const c = it.proxima_cuota;
    const dias = diasHasta(c?.fecha_esperada ?? null, hoy);
    return {
      leadId: it.lead_id,
      nombre: it.lead_nombre,
      vendido: it.vendido_usd,
      cobrado: Number(it.cobrado_usd) || 0,
      pendiente: Number(it.pendiente_usd) || 0,
      cuota: c ? { pagoId: c.pago_id, numero: c.numero, monto: Number(c.monto_usd) || 0, vence: c.fecha_esperada } : null,
      dias,
      urgencia: urgenciaDe(dias),
    };
  });
  filas.sort((a, b) => {
    const fa = a.cuota?.vence ?? null;
    const fb = b.cuota?.vence ?? null;
    if (fa !== fb) {
      if (!fa) return 1;
      if (!fb) return -1;
      return fa < fb ? -1 : 1;
    }
    if (a.pendiente !== b.pendiente) return b.pendiente - a.pendiente;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
  const total = filas.reduce((s, f) => s + f.pendiente, 0);
  return { filas, total };
}
