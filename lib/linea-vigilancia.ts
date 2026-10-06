// =============================================================================
// linea-vigilancia — cuándo se le avisa a un CLIENTE que se cayó su WhatsApp (puro)
// =============================================================================
// EL CASO: la línea por QR del ws1 estuvo muerta del 03/09 al 29/09/2026 —26 días, medido
// en `wa_mensajes`— sin un solo aviso. La sonda existía (`sondearSocketDetalle`,
// lib/evolution.ts) y la vigilancia también, pero sólo para la VOZ de MaKo
// (lib/canal-vigilante.ts): las líneas de los clientes no las miraba nadie.
//
// Decisión de Martín, 06/10/2026: «c: solo al cliente». Se le avisa al negocio dueño de
// la línea (su grupo de MaKo, por el catálogo: `wa-desconectado`) y a nadie más — no hay
// mail a la agencia. Cadencia: una vez al confirmarse la caída y después cada 24 h
// mientras siga caída.
//
// Lo que decide este módulo, sin red, para que tenga test (tests/linea-vigilancia.test.ts):
//
//   · «NO PUDE PREGUNTAR» NO ES «ESTÁ CAÍDA». Con Evolution inalcanzable la sonda da
//     `sin_respuesta` y acá no se toca ninguna marca: un aviso que manda a re-escanear una
//     línea sana la TUMBA.
//   · LA PRIMERA MEDICIÓN MUERTA NO AVISA: fija el «desde» y espera una segunda, separada
//     por `CONFIRMAR_MIN`. Un reinicio de Evolution deja las instancias unos segundos sin
//     socket (medido con la voz el 11/09/2026: salían «re-escanea» y «volvió» seguidos).
//   · UNA LÍNEA QUE NUNCA SE VINCULÓ NO SE «CAYÓ». Es un alta a medio terminar: la del ws13
//     existe desde el 18/08 con `ultima_conexion_at` en null y la sonda la da muerta.
//   · AL VOLVER se limpian las marcas, sin mensaje: la decisión fue avisar la caída, y un
//     «volvió» pide un mensaje propio en el catálogo (queda anotado como pendiente).
//
// Sin `server-only`: lo importan el vigilante (lib/lineas-vigilante.ts) y el test.

import type { Sondeo } from './evolution-sonda';

/** Lo mínimo entre la primera medición muerta y la que confirma la caída. El cron corre cada 10 min. */
export const CONFIRMAR_MIN = 5;
/** Cada cuánto se repite el aviso mientras la línea siga caída. Decisión del 06/10/2026. */
export const CADA_MIN_LINEA = 24 * 60;
/**
 * Red del dedup del catálogo, por debajo de la cadencia: si las marcas no se pudieran
 * escribir, dos corridas del cron no pueden mandar el mismo aviso. Más corta que
 * `CADA_MIN_LINEA` para no pisarle nunca la cadencia.
 */
export const DEDUP_LINEA_MIN = 20 * 60;

/** Las marcas viven en los settings del workspace DUEÑO de la línea, una por línea. */
export const keyDesde = (linea: string): string => `wa.linea.caida.desde.${linea}`;
export const keyAvisado = (linea: string): string => `wa.linea.caida.avisado.${linea}`;

export type MarcasLinea = { desde: string | null; avisado: string | null };

export type DecisionLinea =
  | { que: 'nada' }
  | { que: 'fijar_desde' }
  | { que: 'avisar' }
  | { que: 'limpiar' };

export function decidirLinea(e: {
  sondeo: Sondeo;
  /** `ultima_conexion_at` de la fila: si alguna vez estuvo conectada. */
  vinculadaAlgunaVez: boolean;
  marcas: MarcasLinea;
  ahoraMs: number;
}): DecisionLinea {
  if (e.sondeo === 'sin_respuesta') return { que: 'nada' };
  if (e.sondeo === 'vivo') return e.marcas.desde || e.marcas.avisado ? { que: 'limpiar' } : { que: 'nada' };
  if (!e.vinculadaAlgunaVez) return { que: 'nada' };
  const desde = e.marcas.desde ? Date.parse(e.marcas.desde) : NaN;
  if (Number.isNaN(desde)) return { que: 'fijar_desde' };
  if (e.ahoraMs - desde < CONFIRMAR_MIN * 60_000) return { que: 'nada' };
  const ultimo = e.marcas.avisado ? Date.parse(e.marcas.avisado) : NaN;
  if (!Number.isNaN(ultimo) && e.ahoraMs - ultimo < CADA_MIN_LINEA * 60_000) return { que: 'nada' };
  return { que: 'avisar' };
}

/** Cómo se nombra la línea en el aviso: el nombre que le puso el negocio, o su número. */
export function lineaLegible(f: { etiqueta: string | null; numero: string | null }): string | null {
  const etiqueta = (f.etiqueta ?? '').trim();
  if (etiqueta) return `«${etiqueta}»`;
  const dig = (f.numero ?? '').replace(/\D/g, '');
  return dig ? `+${dig}` : null;
}

function fechaLegible(iso: string | null, tz: string): string | null {
  const ms = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(ms)) return null;
  try {
    return new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: tz });
  } catch {
    return new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
  }
}

/**
 * El texto del aviso. Dos casos, y sólo uno manda a re-escanear:
 *
 *   · 401 / 403 (`desvinculado`) — WhatsApp cerró la sesión del dispositivo vinculado. No
 *     vuelve sola: la única salida es escanear un QR nuevo. Y el teléfono ESTÁ BIEN, que es
 *     lo que el dueño ve al abrir WhatsApp y lo que lo hizo contestar «no entiendo» al
 *     «estás desconectado» de antes (lib/evolution.ts, `motivoCaida`).
 *   · Cualquier otro motivo, o no saberlo — un corte que puede volver solo. Re-escanear ahí
 *     tumba una sesión que estaba por volver, así que no se manda a hacerlo.
 */
export function textoCaida(e: {
  motivo: { desvinculado: boolean; cuando: string | null } | null;
  /** Desde cuándo la medimos caída nosotros: respaldo de la fecha si Evolution no la dio. */
  desde: string | null;
  linea: string | null;
  link: string;
  tz: string;
}): string {
  const cual = e.linea ? ` (${e.linea})` : '';
  const fecha = fechaLegible(e.motivo?.cuando ?? e.desde, e.tz);
  if (e.motivo?.desvinculado) {
    return `🔴 *Se desconectó tu WhatsApp*${cual}. WhatsApp cerró la sesión del dispositivo vinculado${fecha ? ` el ${fecha}` : ''}: tu teléfono está bien, pero por ese número no entran ni salen mensajes. Vuelve a escanear el QR: ${e.link} — MaKo`;
  }
  return `🔴 *Se cortó tu WhatsApp*${cual}. Por ese número no entran ni salen mensajes${fecha ? ` desde el ${fecha}` : ''}. Puede volver solo; si sigue así, reconéctalo: ${e.link} — MaKo`;
}
