// =============================================================================
// numero-whatsapp — el número TAL COMO se le pasa a Evolution (puro)
// =============================================================================
// EL CASO (20/10/2026, ws11, Leila): en la ficha del lead #2313, «WhatsApp no oficial» → «Ese número no tiene WhatsApp».
// El lead tiene el número en 10 dígitos, sin el 52, y `enviarTexto` sólo sacaba lo que no es dígito y lo mandaba tal cual:
// Evolution contesta `exists:false` (medido el 21/08/2026: 542233550684 existe, 2233550684 no). Medido en producción: 53 de
// los 70 leads del ws11 están así, y 27 de los 32 borradores pendientes (los recordatorios de la sesión de mañana) fallarían
// igual al aprobarlos. Los datos del cliente NO se tocan: el número se completa EN EL ENVÍO, con el país de la LÍNEA que manda.
//
// La regla, en positivo:
//  · el «00» del principio es el prefijo de salida internacional, no parte del número: se saca;
//  · un número con el largo LOCAL del país de la línea (10 en México, Argentina, Colombia, Venezuela y Estados Unidos/Canadá;
//    9 en España, Chile y Perú) se completa con el código de ese país;
//  · lo que ya trae país (52…, 521…, 54…, 1…) NO se toca: es más largo que el local;
//  · sin línea conocida (su número no está guardado, o es de un país que no está en la tabla) y con 10 dígitos —el largo
//    que puede ser de cualquier país— NO se adivina: «A este número le falta el código de país».
//
// PURO y sin `server-only`: lo usa lib/evolution.ts (los tres envíos y la consulta del @lid) y tests/numero-whatsapp.test.ts.
// =============================================================================

import { PAISES } from './paises';

/** Lo que se dice cuando no hay forma de completar el número sin adivinar. */
export const SIN_CODIGO_DE_PAIS = 'A este número le falta el código de país.';

/** Lo que se le agrega al motivo «Ese número no tiene WhatsApp» cuando el número sigue sin existir aunque se completó. */
export const REVISA_CODIGO_DE_PAIS = 'Revisa que tenga el código de país.';

/**
 * Cuántos dígitos tiene un número LOCAL (sin el código de país), por código de país. Sólo los países donde el largo es UNO:
 * donde varía (Brasil: 10 u 11) completar sería adivinar. Estados Unidos, Canadá y el Caribe de plan norteamericano son
 * todos el «1».
 */
const LARGO_LOCAL: Readonly<Record<string, number>> = { '52': 10, '54': 10, '57': 10, '58': 10, '1': 10, '34': 9, '56': 9, '51': 9 };

const soloDigitos = (s: string | null | undefined): string => (s ?? '').replace(/\D/g, '');

const POR_LARGO = [...PAISES].sort((a, b) => b.dial.length - a.dial.length);

/**
 * El código de país del NÚMERO DE LA LÍNEA que manda (el dueño de la instancia: `evolution_instancias.numero`), o null si no
 * se sabe. La lada más larga que coincide gana, como en `splitTelefono`; pero acá un número que no coincide con ninguna es
 * null y NO México (`splitTelefono` cae a México para hidratar un selector; para enviar eso sería adivinar).
 */
export function codigoDePaisDeLinea(numeroDeLaLinea: string | null | undefined): string | null {
  const d = soloDigitos(numeroDeLaLinea);
  if (!d) return null;
  const p = POR_LARGO.find((x) => d.startsWith(x.dial.slice(1)));
  if (!p) return null;
  return p.dial.startsWith('+1') ? '1' : p.dial.slice(1);
}

export type NumeroParaWhatsApp = { ok: true; numero: string } | { ok: false; error: string };

/**
 * Los dígitos que se le pasan a Evolution para mandarle a `telefono` por la línea `numeroDeLaLinea`.
 *
 * Vacío → `teléfono inválido` (lo mismo que decían los envíos). Un número de 10 dígitos que no se puede completar → el error,
 * nunca un número inventado. Todo lo demás se pasa como venía (sin el «00»): lo que ya trae país o es de otro largo se manda
 * tal cual y, si no existe, Evolution lo dice.
 */
export function numeroParaWhatsApp(telefono: string | null | undefined, numeroDeLaLinea?: string | null): NumeroParaWhatsApp {
  const d = soloDigitos(telefono).replace(/^0{2,}/, '');
  if (!d) return { ok: false, error: 'teléfono inválido' };
  const cc = codigoDePaisDeLinea(numeroDeLaLinea);
  if (cc && LARGO_LOCAL[cc] === d.length) return { ok: true, numero: `${cc}${d}` };
  if (d.length === 10 && !(cc && LARGO_LOCAL[cc])) return { ok: false, error: SIN_CODIGO_DE_PAIS };
  return { ok: true, numero: d };
}

/** El motivo de un envío que falló, con la pista del código de país cuando el número no existe en WhatsApp. */
export function motivoConPista(motivo: string): string {
  return /^Ese número no tiene WhatsApp\.?$/.test(motivo.trim()) ? `Ese número no tiene WhatsApp. ${REVISA_CODIGO_DE_PAIS}` : motivo;
}
