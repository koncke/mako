// =============================================================================
// email-eventos-crm-reglas — a qué columna pasa la tarjeta cuando sale, se abre o se cliquea un email (puro)
// =============================================================================
// La campaña de email de Mauricio (4/11/2026), lo que se le dijo en la llamada: «si ya lo abrió me lo pones aquí», el clic
// en el botón «pasa a otra», y una columna para el que compró. Las columnas se eligen por automatización
// (`columnasEmail`, lib/config-automatizacion.ts) y las mueve lib/email-eventos-crm.ts. Acá, las dos decisiones, sin base:
//   · `decidirMovimiento`: si la tarjeta pasa a la columna del evento. NUNCA HACIA ATRÁS (quien ya hizo clic no vuelve a
//     «Abrió» porque abrió otro email) y NUNCA DESDE UNA TERMINAL (a quien ganó, perdió o se descalificó no lo mueve un email).
//   · `dejaDeRecibir` (punto 6): quien compró o ya no está abierto, en ese CRM o como lead, no recibe el email siguiente.
// =============================================================================

import { terminalEstadoFor } from './pipeline';
import type { ColumnasEmail, EventoColumna } from './config-automatizacion';

/** La columna configurada para un evento, o null (sin columnas, o sin ésa). */
export function columnaDelEvento(c: ColumnasEmail | undefined, evento: EventoColumna): string | null {
  const k = c?.[evento];
  return typeof k === 'string' && k.trim() ? k.trim() : null;
}

/**
 * LA COLUMNA DE LOS REBOTADOS (13/11/2026, ticket #93). Mauricio: «debemos poner en una columna o fase del CRM los correos
 * rebotados para sacarlos de la secuencia pero no apagarla». La elegida (`columnasEmail.rebote`) o, sin elegir, la columna
 * del CRM que se llame «Rebotado/s» o «Rebote/s» (la primera): así alcanza con crear la columna, sin configurar cada
 * automatización. null = ese CRM no tiene dónde ponerlos (el lead igual sale de la secuencia: la baja del email).
 */
export function columnaDeRebote(c: ColumnasEmail | undefined, etapas: ReadonlyArray<{ key: string; label?: string | null }>): string | null {
  const elegida = columnaDelEvento(c, 'rebote');
  if (elegida) return elegida;
  return etapas.find((e) => /(^|[^\p{L}])rebot/iu.test(String(e.label ?? '')))?.key ?? null;
}

/** ¿La automatización eligió alguna columna? Sin ninguna, nada de esto corre (ni el movimiento ni el corte del punto 6). */
export function tieneColumnasEmail(c: ColumnasEmail | undefined): boolean {
  return (['enviado', 'abrio', 'clic'] as const).some((e) => columnaDelEvento(c, e) != null);
}

export type Movimiento =
  | { mover: true }
  | { mover: false; motivo: 'no-esta' | 'columna-que-no-existe' | 'terminal' | 'ya-esta' | 'atras' };

/**
 * ¿La tarjeta pasa de `actual` a `destino`? `etapas`: las columnas del CRM, en el orden del tablero. `actual` null = el lead
 * no está en ese CRM.
 */
export function decidirMovimiento(o: { etapas: ReadonlyArray<{ key: string }>; actual: string | null; destino: string; evento?: EventoColumna }): Movimiento {
  if (o.actual == null) return { mover: false, motivo: 'no-esta' };
  const iDestino = o.etapas.findIndex((e) => e.key === o.destino);
  if (iDestino < 0) return { mover: false, motivo: 'columna-que-no-existe' };
  if (terminalEstadoFor(o.actual) !== 'abierto') return { mover: false, motivo: 'terminal' };
  if (o.actual === o.destino) return { mover: false, motivo: 'ya-esta' };
  // UN REBOTE NO ES AVANZAR (#93): la dirección no existe, esté donde esté la tarjeta. Va a «Rebotado» aunque la columna quede
  // antes en el tablero; de una terminal (quien ya compró), no.
  if (o.evento === 'rebote') return { mover: true };
  const iActual = o.etapas.findIndex((e) => e.key === o.actual);
  // Una columna que el tablero ya no tiene no tiene lugar: no se sabe si el destino es adelante. No se mueve.
  if (iActual < 0 || iDestino < iActual) return { mover: false, motivo: 'atras' };
  return { mover: true };
}

/**
 * PUNTO 6: ¿este lead deja de recibir los emails de la automatización? Sí si como lead ya no está abierto (ganó, perdió, se
 * descalificó) o si en el CRM de la automatización está en una terminal (llegó a Ganado ahí). `etapaEnCrm` null = no está en
 * ese CRM: decide su estado de lead.
 */
export function dejaDeRecibir(o: { estadoLead: string | null | undefined; etapaEnCrm: string | null }): boolean {
  if ((o.estadoLead ?? 'abierto') !== 'abierto') return true;
  return o.etapaEnCrm != null && terminalEstadoFor(o.etapaEnCrm) !== 'abierto';
}
