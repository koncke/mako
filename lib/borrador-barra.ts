// =============================================================================
// borrador-barra — lo que quedó en la barra del editor de WhatsApp NO se pierde (décima tanda, WhatsApp 3)
// =============================================================================
// Pedido literal de Martín (11/10/2026): «Si grabo un audio, subo un archivo y lo que sea, y me salgo del
// modal editable, se debe quedar guardado. Siempre como borrador... Incluso si refresco. Esto siempre.
// Alguien puede estar grabando un audio y sin querer refresca o se sale y perdió lo grabado.»
//
// Lo que vivía SÓLO en la memoria del editor (app/automations/EditorMensajeWhatsApp.tsx) y se perdía:
//   · el texto escrito y sin enviar: un mapa del módulo (sobrevivía a tocar otra tarjeta, no a recargar);
//   · el archivo elegido o recién subido (el chip arriba de la barra): estado del componente;
//   · el audio grabado y sin mandar (escuchándolo, o a mitad de grabarlo): adentro de la sesión de voz.
//
// Las dos capas, y por qué dos:
//   1. AL SALIR DEL EDITOR (cerrar el panel, tocar otra tarjeta) lo que quedó en la barra ENTRA AL MENSAJE
//      como una burbuja más (texto, archivo, y el audio después de subirlo a la biblioteca). Así queda en el
//      borrador de la automatización (`pasos_borrador`, mig 0240, app/automations/useBorradorSecuencia.ts),
//      que es lo que el lienzo guarda solo. Nada se publica: sólo «Publicar» publica.
//   2. ANTES DE ESO, EN EL NAVEGADOR, A CADA CAMBIO: el texto y el archivo en `localStorage`, el audio (sus
//      tramos, a cada segundo mientras se graba) en IndexedDB. Es la red para lo que la capa 1 no alcanza:
//      recargar la página, cerrar la pestaña, o cambiar de automatización con el panel abierto (el lienzo se
//      desmonta con el editor y el cambio no llega). Al REABRIR la tarjeta, vuelve a la barra.
//
// ⚠️ LA COPIA LOCAL VALE SÓLO PARA EL MENSAJE COMO ESTABA (`firma`). Si la capa 1 llegó, el mensaje cambió
//    (tiene la burbuja nueva) y la copia ya no se restaura: así no aparece dos veces. Y la clave de la tarjeta
//    (`claveDeTarjeta`: workspace, id y orden) puede repetirse en dos automatizaciones con ids de antes
//    (`o0`, `o1`…): la firma evita restaurar en una lo escrito en la otra (tendrían que ser idénticas).
// ⚠️ PURO Y SIN NAVEGADOR: la pantalla lee y escribe; esto decide qué se guarda y qué se restaura (test).
// =============================================================================

import { partesDe, type PasoConPartes } from './mensaje-partes';

/** Cuánto vive una copia local sin tocarse: después se tira (no se restaura una barra de hace semanas). */
export const VIDA_BORRADOR_MS = 7 * 24 * 3600_000;

/** Lo que espera arriba de la barra (el chip): una REFERENCIA a la biblioteca, ya subida. */
export type AdjuntoBarra = { tipo: 'audio'; audio_id: number } | { tipo: 'media'; media_id: number };

/** La copia local del texto y el archivo de la barra de UNA tarjeta. */
export type BorradorBarra = { firma: string; texto: string; adjunto: AdjuntoBarra | null; editando: number | null; t: number };

/** La copia local del audio sin mandar de UNA tarjeta: sus tramos en orden (se unen al usarlo). */
export type BorradorVoz = { firma: string; tramos: Blob[]; secs: number; dondeIba: number | null; t: number };

/** La clave de `localStorage` de la barra de una tarjeta (`claveDeTarjeta` del editor). */
export const claveLocalBarra = (tarjeta: string): string => `mako.barra.v1:${tarjeta}`;

/** El mensaje COMO ESTÁ: si cambia, la copia local ya no es de este mensaje. */
export function firmaDelMensaje(p: PasoConPartes): string {
  return JSON.stringify(partesDe(p));
}

const idPositivo = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);

function adjuntoValido(v: unknown): AdjuntoBarra | null {
  if (!v || typeof v !== 'object') return null;
  const a = v as Record<string, unknown>;
  if (a.tipo === 'audio') { const id = idPositivo(a.audio_id); return id ? { tipo: 'audio', audio_id: id } : null; }
  if (a.tipo === 'media') { const id = idPositivo(a.media_id); return id ? { tipo: 'media', media_id: id } : null; }
  return null;
}

/** ¿Hay algo que guardar? Una barra vacía no deja copia (y la que había se borra). */
export function borradorAGuardar(firma: string, texto: string, adjunto: AdjuntoBarra | null, editando: number | null, ahora: number): BorradorBarra | null {
  if (!texto.trim() && !adjunto) return null;
  return { firma, texto, adjunto, editando: editando != null && editando >= 0 ? editando : null, t: ahora };
}

/**
 * La copia local que se RESTAURA, o null: tiene que ser legible, reciente y del mensaje como está ahora
 * (`firma`). Lo que no cumple no se restaura (y quien lee lo borra).
 */
export function borradorALeer(raw: unknown, firma: string, ahora: number): BorradorBarra | null {
  let v: unknown = raw;
  if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch { return null; } }
  if (!v || typeof v !== 'object') return null;
  const b = v as Record<string, unknown>;
  if (b.firma !== firma) return null;
  const t = typeof b.t === 'number' ? b.t : 0;
  if (!(ahora - t < VIDA_BORRADOR_MS)) return null;
  const texto = typeof b.texto === 'string' ? b.texto : '';
  const adjunto = adjuntoValido(b.adjunto);
  const editando = typeof b.editando === 'number' && Number.isInteger(b.editando) && b.editando >= 0 ? b.editando : null;
  if (!texto.trim() && !adjunto) return null;
  return { firma, texto, adjunto, editando, t };
}

/** El audio sin mandar que se RESTAURA, o null (las mismas reglas que la barra, y con algo grabado). */
export function vozALeer(raw: unknown, firma: string, ahora: number): BorradorVoz | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  if (b.firma !== firma) return null;
  const t = typeof b.t === 'number' ? b.t : 0;
  if (!(ahora - t < VIDA_BORRADOR_MS)) return null;
  const tramos = Array.isArray(b.tramos) ? b.tramos.filter((x): x is Blob => typeof Blob !== 'undefined' && x instanceof Blob && x.size > 0) : [];
  if (!tramos.length) return null;
  const secs = typeof b.secs === 'number' && b.secs > 0 ? Math.round(b.secs) : 0;
  const dondeIba = typeof b.dondeIba === 'number' && Number.isInteger(b.dondeIba) && b.dondeIba >= 0 ? b.dondeIba : null;
  return { firma, tramos, secs, dondeIba, t };
}
