// =============================================================================
// reporte-destino — a QUIÉN le sale un reporte, y si le sale (puro, con test)
// =============================================================================
// Hasta el 06/10/2026 los tres crons de reporte corrían UNA vez, fuera de todo
// `runWithWorkspace`, así que `getWorkspaceActual()` caía al dueño y salía sólo el del
// ws1. El semanal además está en la lista de lo que ve un cliente (AVISOS_DEL_CLIENTE),
// con su interruptor prendido por defecto: los clientes lo veían prendido y no les
// llegaba nada. Decisión de Martín, 06/10/2026: «b: solo el semanal para los clientes».
// Los reportes diario y horario siguen siendo sólo del dueño.
//
// Lo que se decide acá, sin red, para que tenga test:
//   · de dónde salen los destinatarios (la lista del negocio y, si está vacía, el
//     contacto suelto de siempre) — la usan el cron semanal y `despacharReporte`, que
//     antes tenía la regla escrita a mano dos veces en el mismo archivo;
//   · si el reporte sale o se saltea, y por qué.
//
// ⚠️ «APAGADO» SON DOS INTERRUPTORES, y el reporte sale sólo si están los dos prendidos:
// `notification_prefs.semanal.activo` (lo que leía el cron desde julio, y lo que escriben
// los canales del mensaje) y el interruptor del mensaje en la lista de /mensajes (el
// `enabled` de la plantilla, que es el que ve el cliente). Leyendo sólo el primero, un
// cliente que apaga el semanal en SU lista lo seguiría recibiendo.
//
// ⚠️ Y NO SE SALTEA AL QUE NUNCA CONFIGURÓ NADA. `DEFAULT_PREFS` trae el semanal activo
// (lib/perfil.ts) y el catálogo lo nace prendido (`porDefecto: 'on'`): un negocio sin
// fila de preferencias lo ve prendido en su pantalla, así que lo recibe. Lo que lo
// saltea es no tener a quién mandárselo por los canales que tiene elegidos.
//
// Sin `server-only`: lo importan el cron, el despachador y el test.

export type DestinosReporte = { telefonos: string[]; emails: string[] };

/**
 * Los destinatarios de un reporte: la lista del negocio y, si está vacía, el contacto
 * suelto (`user_telefono` / `user_email`), que es a donde iba antes de que hubiera lista.
 */
export function destinosDelReporte(
  lista: DestinosReporte,
  contacto: { telefono: string; email: string },
): DestinosReporte {
  return {
    telefonos: lista.telefonos.length > 0 ? lista.telefonos : (contacto.telefono ? [contacto.telefono] : []),
    emails: lista.emails.length > 0 ? lista.emails : (contacto.email ? [contacto.email] : []),
  };
}

export type DecisionReporte =
  | { sale: true; wa: number; email: number }
  | { sale: false; motivo: 'apagado' | 'sin_destinatario' };

/**
 * ¿Sale el reporte en este negocio? `wa` / `email` son a cuántos les llegaría por cada
 * canal, contando sólo los canales que el negocio tiene prendidos.
 */
export function decidirReporte(e: {
  activo: boolean;
  canal: { wa: boolean; email: boolean };
  destinos: DestinosReporte;
}): DecisionReporte {
  if (!e.activo) return { sale: false, motivo: 'apagado' };
  const wa = e.canal.wa ? e.destinos.telefonos.length : 0;
  const email = e.canal.email ? e.destinos.emails.length : 0;
  if (wa + email === 0) return { sale: false, motivo: 'sin_destinatario' };
  return { sale: true, wa, email };
}

/**
 * Cómo se muestra un destinatario en el `?dry=1` del cron: lo justo para reconocerlo.
 * La respuesta de un cron queda en los logs, y ahí no van teléfonos ni correos enteros.
 */
export function enmascararDestino(d: string): string {
  const s = (d || '').trim();
  const at = s.indexOf('@');
  if (at > 0) return `${s.slice(0, Math.min(2, at))}…${s.slice(at)}`;
  const dig = s.replace(/\D/g, '');
  return dig.length > 4 ? `…${dig.slice(-4)}` : '…';
}
