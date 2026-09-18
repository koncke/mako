// =============================================================================
// ¿El WhatsApp no oficial puede mandar AHORA? — lo que decide el motor
// =============================================================================
// El motor de nutrición decidía con `evolution_instancias.estado === 'conectado'`,
// o sea con la FILA. Y la fila es el campo que este repo ya tiene medido mintiendo
// en las dos direcciones (commit 60e8bd93; `lib/canal-vigilante.ts`): una
// instancia en `open` que contesta «Connection Closed» a toda operación real, y
// una en `close` que funcionaba.
//
// Las dos mentiras cuestan distinto en el motor:
//
//   · fila «conectado» sobre una sesión muerta → intenta mandar, el proveedor
//     falla, queda un `fallo` con el error de Evolution. Ruido, pero honesto.
//   · fila «desconectado» sobre una sesión VIVA → no intenta nunca, y marca
//     `fallo` «WhatsApp de empresa no conectado» cada 24 h para siempre. Un
//     canal que anda, apagado por un registro viejo, sin que nada lo diga.
//
// Por eso decide la SONDA (`sondearSocket`, una operación que exige el socket) y
// la fila queda sólo para cuando la sonda no pudo contestar.
//
// Puro, sin red y sin `server-only`: se testea con los tres veredictos medidos.

import type { Sondeo } from './evolution-sonda';

export type CanalNoOficial = {
  listo: boolean;
  /** De dónde salió la decisión: la sonda viva, o la fila porque la sonda no contestó. */
  fuente: 'sonda' | 'fila';
  /** Lo que queda escrito en el `fallo` cuando no está listo. */
  motivo: string | null;
};

export function canalNoOficial(sondeo: Sondeo | null, estadoFila: string | null | undefined): CanalNoOficial {
  if (sondeo === 'vivo') return { listo: true, fuente: 'sonda', motivo: null };
  if (sondeo === 'muerto') {
    // Medido: WhatsApp dijo que la sesión está cerrada. Es la causa de verdad,
    // y el texto lo dice así para que quien lea el fallo sepa qué pasó.
    return { listo: false, fuente: 'sonda', motivo: 'WhatsApp de empresa desconectado (la sesión no contesta: hay que volver a vincular el QR)' };
  }
  // `sin_respuesta` o no se pudo sondear: no sabemos. La fila es lo único que
  // hay, y se usa sabiendo que es de segunda mano. Si dice conectado se INTENTA
  // mandar — el peor caso es un `fallo` con el error real del proveedor, que es
  // más informativo que no intentar.
  const listo = estadoFila === 'conectado';
  return { listo, fuente: 'fila', motivo: listo ? null : 'WhatsApp de empresa no conectado (según el último registro; no se pudo comprobar en vivo)' };
}
