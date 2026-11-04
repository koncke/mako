// =============================================================================
// mako-linea-tope — cuántos números NUEVOS puede tocar la línea de MaKo por workspace
// =============================================================================
// La línea de WhatsApp de MaKo (`instanciaVoz`, lib/mako-grupo.ts) es UNA para toda la
// plataforma. Auditoría de seguridad del 14/10/2026: cualquier admin de cualquier workspace la
// hacía agregar a su grupo —o mandarle una invitación por DM— a cualquier número, sin tope, con
// un bucle sobre /api/onboarding o /api/chat-agent/onboarding/prueba. Cada número nuevo era un
// desconocido recibiendo un mensaje de MaKo, y el baneo de esa línea lo pagan TODOS los clientes.
//
// El tope es por WORKSPACE y cuenta CONTACTOS NUEVOS: código por DM, alta en el grupo e
// invitación. Se reclama con `reclamarEspaciado` (compare-and-set: de dos pedidos que compiten
// por el último lugar gana uno), igual que la prueba real del simulador (lib/prueba-paso.ts).
//
// Volver a tocar un número que ya se tocó dentro de la ventana NO gasta: guardar la lista de
// destinatarios dos veces vuelve a «agregar» a los mismos (Evolution contesta que ya están), y
// eso no puede agotar el cupo de alguien que no hizo nada raro. Lo que sí gasta siempre es el
// CÓDIGO (`siempre`): reenviarlo es otro mensaje a esa persona.
//
// SIN `server-only`: la decisión se EJECUTA en tests/seguridad-tokens-linea-ssrf.test.ts con
// el almacén de mentira; lib/mako-grupo.ts le pasa el de verdad (lib/espaciado.ts).
// =============================================================================

/** Contactos nuevos por workspace dentro de la ventana. */
export const TOPE_LINEA_MAKO = 5;
/** La ventana, en minutos. */
export const VENTANA_LINEA_MIN = 60;

/**
 * ⚠️ Y EL TOPE DE ALTAS POR LÍNEA (3/11/2026). El de arriba es por workspace y la línea es UNA: el día del ban la línea tocó 3 números en 3
 * minutos, repartidos en 2 negocios, y el tope de cada uno ni se enteró. Éste cuenta altas en grupos e invitaciones de TODA la línea. El código de
 * verificación no gasta acá: un cliente que lo pide dos veces no puede quedarse sin onboarding por lo que hizo otro negocio.
 * Se paga con esto: el 21/10 un negocio guardó 3 números de una vez; hoy el tercero recibiría el link para pasarlo a mano.
 */
export const TOPE_ALTAS_POR_LINEA = 2;
export const VENTANA_ALTAS_LINEA_MIN = 10;
/**
 * ⚠️ Y POR DÍA (4/11/2026). 2 cada 10 minutos dejaba sumar 288 personas en un día por la misma línea. Una cuenta que WhatsApp
 * restringe pierde justo esto («agregar miembros», FAQ «About restricted accounts»). El número es nuestro: Meta no publica un tope.
 * Lo que se gasta acá es lo mismo que arriba (altas e invitaciones, de todos los negocios), y el mismo número no gasta dos veces.
 */
export const TOPE_ALTAS_DIA_LINEA = 10;
export const VENTANA_ALTAS_DIA_LINEA_MIN = 24 * 60;
export const SIN_CUPO_ALTAS_LINEA = 'Esta línea ya sumó gente recién. Prueba en unos minutos, o pásale tú el link del grupo.';

/** Lo que el tope necesita de la base (en producción, lib/espaciado.ts). */
export type AlmacenTope = {
  /** ¿Este número ya se tocó dentro de la ventana? Lectura sola. */
  tocadoReciente(num: string): Promise<boolean>;
  /** Reclama el casillero `i` del cupo del workspace. false = ocupado. Tira si no pudo contar. */
  reclamarCasillero(i: number): Promise<boolean>;
  /** Anota que el número se tocó ahora. */
  marcar(num: string): Promise<void>;
};

/**
 * ¿Puede la línea de MaKo tocar a `num` ahora? true = sí (y ya quedó contado).
 * Tira si no pudo contar: quien llama NO manda (sin poder contar, no sale; es la línea de todos).
 */
export async function reclamarContactoLinea(alm: AlmacenTope, num: string, opts: { siempre?: boolean; tope?: number } = {}): Promise<boolean> {
  if (!num) return false;
  if (!opts.siempre && await alm.tocadoReciente(num)) return true;
  const tope = opts.tope ?? TOPE_LINEA_MAKO;
  let hay = false;
  for (let i = 0; i < tope && !hay; i++) hay = await alm.reclamarCasillero(i);
  if (!hay) return false;
  await alm.marcar(num);
  return true;
}

/** El texto cuando se acabó el cupo. Lo lee el cliente: corto y sin culpas. */
export const SIN_CUPO_LINEA = 'Ya se enviaron varios mensajes a números nuevos en la última hora. Espera un rato y vuelve a intentarlo.';
