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
//   · NI UNA QUE EL NEGOCIO DESVINCULÓ. «Desvincular» (`desconectar`, lib/evolution.ts) borra
//     la instancia en Evolution y, si era la de por default, deja su fila en «desconectado»
//     con `ultima_conexion_at` puesto: la sonda contesta 404 «does not exist», que también es
//     `muerto`. Sin este corte, quien soltó su número a propósito recibía «se cortó tu
//     WhatsApp» cada 24 h para siempre (revisión del 06/10/2026). La caída de verdad —la
//     zombi del 403, el corte— deja la instancia viva en Evolution: medido el 25/09/2026, una
//     llevaba 22 días así. Lo que distingue las dos es `esInstanciaInexistente`
//     (lib/evolution-sonda.ts).
//   · AL VOLVER se limpian las marcas, y si ya se le había avisado la caída sale un «volvió»
//     (`wa-reconectado`). Decisión de Martín, 09/10/2026 al cerrar el Chatbot («las dos
//     cosas»: que el cliente pueda apagar el aviso y que haya un «volvió»). Es la contracara de
//     la insistencia, igual que `meta-cuenta-recuperada`: si MaKo avisó «se cortó» cada 24 h y
//     después se calla, el negocio no sabe si volvió o si el aviso se rompió. Si la caída nunca
//     se llegó a avisar (se cortó y volvió entre dos corridas), no hay nada que desmentir: se
//     limpia en silencio. Y una línea DESVINCULADA tampoco «vuelve»: se limpia sin mensaje.
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
  | { que: 'limpiar' }
  /** Volvió una línea cuya caída YA se avisó: se limpian las marcas y sale el «volvió». */
  | { que: 'volvio' };

export function decidirLinea(e: {
  sondeo: Sondeo;
  /** `ultima_conexion_at` de la fila: si alguna vez estuvo conectada. */
  vinculadaAlgunaVez: boolean;
  /**
   * La sonda contestó que la instancia NO EXISTE en Evolution (`esInstanciaInexistente`). Es
   * una línea que el negocio desvinculó, no una que se cayó: no hay sesión que reconectar.
   * Obligatorio a propósito: un vigilante que se olvide de pasarlo vuelve a avisarle al que
   * soltó su número.
   */
  sinInstancia: boolean;
  marcas: MarcasLinea;
  ahoraMs: number;
}): DecisionLinea {
  const hayMarcas = !!(e.marcas.desde || e.marcas.avisado);
  if (e.sondeo === 'sin_respuesta') return { que: 'nada' };
  if (e.sondeo === 'vivo') {
    if (e.marcas.avisado) return { que: 'volvio' };
    return hayMarcas ? { que: 'limpiar' } : { que: 'nada' };
  }
  // Va antes que todo lo de «muerto»: si la línea estaba caída y avisada y después el negocio
  // la desvinculó para volver a escanear, las marcas se van — el próximo «se cayó» empieza de cero.
  if (e.sinInstancia) return hayMarcas ? { que: 'limpiar' } : { que: 'nada' };
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
export type HechosCaida = {
  motivo: { desvinculado: boolean; cuando: string | null } | null;
  /** Desde cuándo la medimos caída nosotros: respaldo de la fecha si Evolution no la dio. */
  desde: string | null;
  linea: string | null;
  link: string;
  tz: string;
};

/**
 * LOS DATOS DEL AVISO, por nombre (15/10/2026: «un Mensaje de MaKo ES una automatización»). Los citan las automatizaciones
 * de la plataforma («{{linea_numero}}», «{{linea_fecha}}», «{{linea_link}}», lib/variables-aviso.ts). Desde el 16/10/2026 el
 * código no arma ningún texto: el de cada caso es literal en su fila.
 * ⚠️ SIN número ni etiqueta, `linea_numero` FALTA (no viene vacío): un dato vacío es un valor para `textoConDatos`, y el
 * renglón «📱» quedaba solo; uno que falta se lleva su renglón entero.
 */
export function datosCaida(e: HechosCaida): Record<'linea_titulo' | 'linea_motivo' | 'linea_link', string> & { linea_numero?: string; linea_fecha?: string } {
  const fecha = fechaLegible(e.motivo?.cuando ?? e.desde, e.tz);
  // `linea_fecha` (16/10/2026): el dato que citan los textos literales de las dos filas. `linea_titulo` y `linea_motivo`
  // quedan sólo para la #253 de antes, hasta la mudanza (lib/variables-aviso.ts los oculta).
  const base = { ...(e.linea ? { linea_numero: e.linea } : {}), ...(fecha ? { linea_fecha: fecha } : {}), linea_link: e.link };
  if (e.motivo?.desvinculado) {
    return {
      ...base, linea_titulo: 'Se desconectó tu WhatsApp',
      linea_motivo: `WhatsApp cerró la sesión del dispositivo vinculado${fecha ? ` el ${fecha}` : ''}: tu teléfono está bien, pero por ese número no entran ni salen mensajes. Vuelve a escanear el QR:`,
    };
  }
  return {
    ...base, linea_titulo: 'Se cortó tu WhatsApp',
    linea_motivo: `Por ese número no entran ni salen mensajes${fecha ? ` desde el ${fecha}` : ''}. Puede volver solo; si sigue así, reconéctalo:`,
  };
}

/**
 * ¿CUÁL DE LOS DOS AVISOS? (16/10/2026): WhatsApp cerró la sesión (`wa-desvinculado`, evento `whatsapp_desvinculado`) o se
 * cortó (`wa-desconectado`, evento `whatsapp_caido`). Cada uno tiene su texto literal en su automatización de SuperAdmin.
 * ⚠️ `textoCaida` y `textoVolvio` SE BORRARON ese día: eran el camino viejo, el que salía sin la fila.
 */
export const avisoDeCaida = (e: Pick<HechosCaida, 'motivo'>): 'wa-desvinculado' | 'wa-desconectado' =>
  (e.motivo?.desvinculado ? 'wa-desvinculado' : 'wa-desconectado');

/** Los datos del «volvió»: sólo la línea (un negocio con dos números tiene que saber cuál). Sin ella, nada. */
export function datosVolvio(e: { linea: string | null }): { linea_numero?: string } {
  return e.linea ? { linea_numero: e.linea } : {};
}


