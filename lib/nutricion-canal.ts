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

/**
 * ¿Por cuál de los dos WhatsApp sale un paso? — y por qué el default se dio vuelta
 *
 * DECISIÓN DE MARTÍN (05/10/2026), textual: «olvidate de WhatsApp oficial, no
 * entiendo de donde lo sigues sacando, si todo esto es para la no oficial».
 *
 * El saneo de `setSecuenciaPasos` resolvía `p.proveedor === 'no_oficial' ?
 * 'no_oficial' : 'oficial'`, o sea que **la AUSENCIA del campo elegía el
 * oficial**. Y todo lo que nace sin el campo es justo lo que el dueño está
 * armando: el editor de flujos, el wizard de secuencias, la API de MaKo. Esos
 * pasos caían en la rama que exige `template_wa` y morían con «paso sin
 * template_wa», una fila de `fallo` por día, para siempre (`lib/nutricion.ts`,
 * la rama `waOn && canal === 'whatsapp'`). No da error: el mensaje no sale, que
 * es indistinguible de «no había nada que mandar».
 *
 * Esto NO apaga el oficial — los dos canales siguen existiendo y la pared de 24 h
 * rige donde hay WABA (ver AGENTS.md, «El WhatsApp del chatbot es el NO
 * OFICIAL»). Lo que cambia es que el oficial hay que DECLARARLO:
 *
 *   · `proveedor: 'oficial'` explícito manda (lo escribe `vincularPlantilla` y
 *     el toggle de la pantalla).
 *   · un `template_wa` sin proveedor también: el nombre de una plantilla sólo se
 *     escribe sabiendo que existe en Meta, así que es la señal más CARA de
 *     producir, y gana sobre un campo que falta. Eso cubre a los clientes con
 *     WABA cuya fila perdió el `proveedor` en algún guardado.
 *   · la ausencia ya no decide nada: cae al no oficial, que es el canal real.
 */
export function proveedorDelPaso(p: {
  tipo?: string | null;
  audio_id?: unknown;
  proveedor?: string | null;
  template_wa?: string | null;
}): 'oficial' | 'no_oficial' {
  // Un audio SIEMPRE sale por el no oficial: Meta no aprueba plantillas con nota
  // de voz, así que acá el proveedor no es elegible. Va PRIMERO, incluso sobre un
  // 'oficial' explícito, porque la alternativa es un envío que Meta rechaza.
  if (p.tipo === 'audio' && Number(p.audio_id) > 0) return 'no_oficial';
  if (p.proveedor === 'oficial') return 'oficial';
  if (p.proveedor === 'no_oficial') return 'no_oficial';
  return p.template_wa ? 'oficial' : 'no_oficial';
}

/**
 * El texto que sale en ESTE envío: una de las variantes del paso, al azar, o el
 * cuerpo original si no tiene. El sorteo va acá y no en el que llama para que
 * cualquier canal que mande texto lo herede sin acordarse. (Vivía en
 * lib/nutricion.ts; se mudó acá, que no tiene `server-only`, para que tenga test.)
 *
 * ⚠️ UN PASO DE AUDIO NO SORTEA: su `cuerpo` es el PIE —lo que va por escrito junto
 * a la nota de voz, casi siempre un link— y sus variantes, si las tiene, son las del
 * TEXTO que había antes de pasarlo a voz. `setSecuenciaPasos` las conserva por orden
 * (`variantesPrevias`) aunque el paso haya cambiado de tipo, así que un mensaje que
 * se pasaba a voz en el wizard —con el pie vaciado a propósito (lib/guion-audio.ts,
 * `pasoAVoz`, #748)— salía igual con una variante del texto viejo de pie: el lead
 * recibía el audio y además lo mismo por escrito. Con un pie puesto, el sorteo
 * mandaba el link una de cada N veces. La condición es la MISMA que usa el motor
 * para decidir que el paso es una nota de voz.
 */
export function textoDelPaso(paso: {
  tipo?: string | null;
  audio_id?: unknown;
  cuerpo: string;
  variantes?: string[] | null;
}): string {
  if (paso.tipo === 'audio' && Number(paso.audio_id) > 0) return paso.cuerpo;
  const vs = (paso.variantes ?? []).filter((v) => typeof v === 'string' && v.trim());
  if (!vs.length) return paso.cuerpo;
  // El cuerpo original entra al sorteo: es la versión que el dueño aprobó.
  const pool = [paso.cuerpo, ...vs].filter((t) => t.trim());
  return pool[Math.floor(Math.random() * pool.length)];
}
