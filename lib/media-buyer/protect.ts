// =============================================================================
// Media Buyer — Protect: lo que se rompió en la cuenta, antes de que salga caro (PURO: lo prueban los tests)
// =============================================================================
// El «Protect» de AdAmigo (adamigo.ai/protect: «spend spikes, setup mistakes, rejected ads... tells you before small
// problems get expensive»). Se mira en la corrida diaria, que ya leyó la cuenta entera, y queda en su resumen
// (`ultimaCorridaInfo.alertas`): la pantalla las muestra sin volver a leer Meta, y las graves van al aviso del negocio.
// No mueve nada: avisa. Lo que hay que hacer lo propone el agente que corresponde (Stop Loss pausa lo que gasta sin traer).
//
// ⚠️ «Meta cuenta leads y al CRM no llega ninguno» es la falla más cara y la más silenciosa: el formulario o la conexión
//    se cortó, los anuncios siguen gastando y el negocio cree que no le escriben. Por eso es `alta`.
// =============================================================================

import type { NodoMB, SenalMB } from './motor';

export type Alerta = { id: string; tipo: 'rechazado' | 'gasto' | 'seguimiento' | 'tope'; gravedad: 'alta' | 'media'; titulo: string; detalle: string };

const RECHAZO = new Set(['DISAPPROVED', 'WITH_ISSUES', 'PENDING_BILLING_INFO']);

export function alertasProtect(x: {
  arbol: readonly NodoMB[];
  /** Las señales de los últimos 3 y 7 días (las ventanas del motor, terminan ayer). */
  corta: readonly SenalMB[];
  larga: readonly SenalMB[];
  /** La suma de los presupuestos diarios de lo prendido y el tope de la cuenta, en la unidad del gasto. */
  totalActivo: number;
  presupuestoMaxDia: number | null;
  /** Pasa de la unidad del gasto a dólares (para los mínimos), y escribe un monto. */
  aUsd: (u: number) => number;
  fmt: (u: number) => string;
}): Alerta[] {
  const out: Alerta[] = [];
  const porId = new Map(x.arbol.map((n) => [n.id, n] as const));
  const prendido = (n: NodoMB): boolean => { let y: NodoMB | undefined = n; while (y) { if (y.configurado !== 'ACTIVE') return false; if (!y.parentId) return true; y = porId.get(y.parentId); } return false; };

  const rechazados = x.arbol.filter((n) => n.nivel === 'ad' && n.configurado === 'ACTIVE' && RECHAZO.has(n.entrega));
  if (rechazados.length) {
    out.push({
      id: 'rechazado', tipo: 'rechazado', gravedad: rechazados.some(prendido) ? 'alta' : 'media',
      titulo: rechazados.length === 1 ? `Meta frenó el anuncio «${rechazados[0].nombre}»` : `Meta frenó ${rechazados.length} anuncios`,
      detalle: `${rechazados.slice(0, 3).map((n) => `«${n.nombre}»`).join(', ')}${rechazados.length > 3 ? '…' : ''}: rechazados o con problemas. No entregan hasta que se corrijan.`,
    });
  }

  const sum = (ss: readonly SenalMB[], k: 'gasto' | 'leadsMeta' | 'leadsCrm') => ss.reduce((s, y) => s + y[k], 0);
  const diario3 = sum(x.corta, 'gasto') / 3;
  const diario7 = sum(x.larga, 'gasto') / 7;
  if (diario7 > 0 && x.aUsd(diario3) >= 20 && diario3 > diario7 * 1.8) {
    out.push({
      id: 'gasto', tipo: 'gasto', gravedad: diario3 > diario7 * 3 ? 'alta' : 'media',
      titulo: `El gasto se disparó: ${Math.round((diario3 / diario7 - 1) * 100)}% arriba de tu semana`,
      detalle: `Los últimos 3 días gastaste ${x.fmt(diario3)} por día; tu promedio de 7 días es ${x.fmt(diario7)}. Revisa si alguien subió un presupuesto o prendió algo.`,
    });
  }

  const leadsMeta = sum(x.larga, 'leadsMeta');
  const leadsCrm = sum(x.larga, 'leadsCrm');
  if (leadsMeta >= 5 && leadsCrm === 0) {
    out.push({
      id: 'seguimiento', tipo: 'seguimiento', gravedad: 'alta',
      titulo: 'Tus leads no están llegando al CRM',
      detalle: `Meta cuenta ${leadsMeta} leads en 7 días y a tu CRM no llegó ninguno. Revisa la conexión del formulario: los anuncios siguen gastando.`,
    });
  }

  if (x.presupuestoMaxDia != null && x.totalActivo > x.presupuestoMaxDia * 1.01) {
    out.push({
      id: 'tope', tipo: 'tope', gravedad: 'media',
      titulo: 'Lo prendido pasa tu tope diario',
      detalle: `Tus campañas prendidas suman ${x.fmt(x.totalActivo)} por día y tu tope es ${x.fmt(x.presupuestoMaxDia)}. MaKo no sube nada hasta que vuelva abajo.`,
    });
  }
  return out.sort((a, b) => (a.gravedad === b.gravedad ? 0 : a.gravedad === 'alta' ? -1 : 1));
}
