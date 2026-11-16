// =============================================================================
// El contacto de MaKo en el sitio: el WhatsApp de MaKo, en UN solo lugar (16/11/2026)
// =============================================================================
// Martín: «me gustaría que esté flotando el loguito de WhatsApp al costado por si alguien quiere escribir algo y que evidentemente
// lleve al WhatsApp de MaKo. También en la bottom bar y en el tema del contacto, que no solamente esté el email, sino que también
// esté el WhatsApp de MaKo». Lo leen el pie (./Pie.tsx, su renglón de contacto) y el botón flotante (./WhatsappFlotante.tsx):
// cambiar el número es cambiarlo acá.
//
// ⚠️ ES LA LÍNEA DE MaKo (…2605, `mako_superadmin_muylqv8r`), NO EL PERSONAL DE MARTÍN (…3479): el personal es para sus clientes y
// sus chats privados, y nunca va a un sitio público. El número va con su 9 (5491125052605): wa.me lo pide en formato
// internacional completo, y sin el 9 un celular argentino no se encuentra.
// Puro y sin React: lo pueden importar el servidor, los tests y un componente de cliente.
// =============================================================================

/** El WhatsApp de MaKo: `numero` para wa.me (sólo dígitos, con el país y el 9), `visible` como se lee. */
export const WHATSAPP_MAKO = { numero: '5491125052605', visible: '+54 9 11 2505-2605' } as const;

/** El mensaje que ya viene escrito al abrir el chat desde el sitio: corto, y dice de dónde viene. */
export const MENSAJE_WHATSAPP_SITIO = 'Hola, vengo del sitio de MaKo y tengo una pregunta.';

/** El link al chat con MaKo (wa.me abre la app en el teléfono y WhatsApp Web en la computadora), con un mensaje ya escrito. */
export function linkWhatsappMako(texto: string = MENSAJE_WHATSAPP_SITIO): string {
  return `https://wa.me/${WHATSAPP_MAKO.numero}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}

/** El logo de WhatsApp (simple-icons 16.36.0 `whatsapp`, el trazo oficial), para dibujarlo en el color que lleve su `fill`. */
export const GLIFO_WHATSAPP = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';

/** El verde de WhatsApp (simple-icons `whatsapp`). */
export const VERDE_WHATSAPP = '#25D366';
