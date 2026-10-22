// =============================================================================
// El motor de Offer, visto desde el Ops Center del cliente (21/10/2026)
// =============================================================================
// Martín: «las personas deberían poder continuar lo que quieran siempre desde el Ops Center», y nunca «Esta conversación sigue
// en Offer» ni «Seguir en Offer». Una conversación de Offer se abre y se SIGUE en el Ops Center con el motor que le
// corresponde: /api/offer ('abrir' y 'turno', app/api/offer/route.ts), por la llamada de la tab (app/offer/offer-api.ts →
// llamarOffer). Lo que se escribe queda en ESA conversación, con su diagnóstico y sus piezas, igual que si se escribiera en
// la tab. Lo que hace la tab y se hace igual acá:
//   · los links del mensaje se leen antes, como un documento más (`leer-link`); el que no abre viaja en `linksSinLeer`, para
//     que MaKo no diga que lo vio (20/10/2026, Florencia);
//   · tocar una opción de una pregunta del DIAGNÓSTICO manda su índice (`respuesta`, app/m/mako/chat-ui.ts → respuestaDeOffer);
//   · los archivos del «+» se suben y se leen antes, como en la tab (subir-url → PUT → 'leer'), y viajan como `docIds` (OC7,
//     22/10/2026: hasta ese día el Ops Center los dejaba afuera sin decirlo). Si uno no se pudo leer, el turno NO sale;
//   · un turno que falló sin decir nada (un corte, un 504) se relee antes de dar el mensaje por perdido (`quedoGuardado`): si
//     quedó guardado, devolverlo haría que se mande dos veces.
// ⚠️ La puerta es la de Offer (`adminDeWorkspaceActual`): la lista del Ops Center sólo muestra Offer a quien ve la tab.

import { ErrorOfferApi, TOPE, llamarOffer, mensajeDeError, subirArchivo } from '@/app/offer/offer-api';
import { quedoGuardado } from '@/app/offer/ayudas';
import { linksDe } from '@/lib/links-texto';
import type { AdjuntoVista, OfferMensaje, OfferSesionVista } from '@/lib/offer-marco';

export type LeidoOffer = { ok: true; sesion: OfferSesionVista } | { ok: false; error: string; sesion?: OfferSesionVista };

/** La conversación entera (con sus opciones, sus audios y sus PDF). */
export async function abrirOffer(id: number): Promise<LeidoOffer> {
  try {
    const r = await llamarOffer<{ sesion: OfferSesionVista }>({ action: 'abrir', id }, TOPE.corto);
    return { ok: true, sesion: r.sesion };
  } catch (e) {
    return { ok: false, error: mensajeDeError(e) };
  }
}

/**
 * «Armar mi oferta» (la opción con que MaKo lo ofrece): el SERVIDOR arma la oferta por detrás y la conversación dice que se
 * está armando (`armando`); quien la mira la relee hasta que aparece, con su PDF (app/offer/OfferApp.tsx → armar).
 */
export async function armarOffer(id: number): Promise<LeidoOffer> {
  try {
    const r = await llamarOffer<{ sesion: OfferSesionVista }>({ action: 'armar', sesionId: id, origen: 'tab' }, TOPE.corto);
    return { ok: true, sesion: r.sesion };
  } catch (e) {
    return { ok: false, error: mensajeDeError(e) };
  }
}

/** Lo ya leído de cada archivo (su doc en Offer): el reintento del mismo mensaje no lo vuelve a subir ni a leer. */
const leidos = new WeakMap<File, string>();

/** Con qué se sube y se lee (los de la tab; el test pasa los suyos). */
export type ParaLeer = { subir: (f: File, mime: string) => Promise<string>; llamar: typeof llamarOffer };

/**
 * LOS ARCHIVOS DEL «+», LEÍDOS EN LA CONVERSACIÓN (OC7, 22/10/2026), uno por uno y en orden, como la tab
 * (app/offer/OfferApp.tsx → leerUno). Si uno falla, para ahí y lo dice: MaKo contestaría sin ese documento. Lo ya leído queda
 * anotado (`leidos`), así el reintento sólo lee lo que falta.
 */
export async function leerArchivosDeOffer(id: number, archivos: readonly File[], con: ParaLeer = { subir: subirArchivo, llamar: llamarOffer }):
  Promise<{ ok: true; docIds: string[]; sesion?: OfferSesionVista } | { ok: false; error: string }> {
  const docIds: string[] = [];
  let sesion: OfferSesionVista | undefined;
  for (const f of archivos) {
    const ya = leidos.get(f);
    if (ya) { docIds.push(ya); continue; }
    try {
      const mime = f.type || 'application/octet-stream';
      const path = await con.subir(f, mime);
      const r = await con.llamar<{ sesion: OfferSesionVista; doc: AdjuntoVista }>(
        { action: 'leer', sesionId: id, path, nombre: f.name, mime }, TOPE.leer, 'Leer el archivo tardó demasiado.');
      sesion = r.sesion;
      if (r.doc?.id) { leidos.set(f, r.doc.id); docIds.push(r.doc.id); }
    } catch (e) {
      return { ok: false, error: `No pude leer «${f.name}»: ${mensajeDeError(e)}` };
    }
  }
  return { ok: true, docIds, ...(sesion ? { sesion } : {}) };
}

/**
 * Un mensaje de la persona a una conversación de Offer, y lo que contestó MaKo. `respuesta`: la opción tocada de una pregunta
 * del diagnóstico. Si falló pero el mensaje quedó guardado, vuelve la conversación con el error (`sesion`): se dibuja lo
 * guardado y lo escrito NO vuelve a la caja.
 */
export async function turnoOffer(id: number, texto: string, antes: readonly OfferMensaje[], respuesta: { preguntaId: string; idx: number } | null,
  archivos: readonly File[] = []): Promise<LeidoOffer> {
  // Primero los archivos: si uno no se pudo leer, el turno no sale (el mensaje queda con «Reintentar»).
  const docs = await leerArchivosDeOffer(id, archivos);
  if (!docs.ok) return { ok: false, error: docs.error };
  const docIds: string[] = [...docs.docIds];
  const sinLeer: string[] = [];
  let ultima: OfferSesionVista | undefined = docs.sesion;
  for (const url of linksDe(texto)) {
    try {
      const r = await llamarOffer<{ sesion: OfferSesionVista; doc: AdjuntoVista }>({ action: 'leer-link', sesionId: id, url }, TOPE.leer, 'Leer el link tardó demasiado.');
      ultima = r.sesion;
      if (r.doc?.id) docIds.push(r.doc.id);
    } catch (e) {
      if (e instanceof ErrorOfferApi && e.sesion) ultima = e.sesion;
      sinLeer.push(url);
    }
  }
  try {
    const r = await llamarOffer<{ sesion: OfferSesionVista }>(
      { action: 'turno', sesionId: id, texto, docIds, ...(respuesta ? { respuesta } : {}), ...(sinLeer.length ? { linksSinLeer: sinLeer } : {}) },
      TOPE.turno, 'MaKo tardó demasiado en contestar. Prueba de nuevo.',
    );
    return { ok: true, sesion: r.sesion };
  } catch (e) {
    const error = mensajeDeError(e);
    if (e instanceof ErrorOfferApi && e.sesion) return { ok: false, error, sesion: e.sesion };
    // Sin la conversación en el error: se relee. Si el mensaje ya quedó, se dibuja lo guardado.
    const leida = await abrirOffer(id);
    if (leida.ok && quedoGuardado(leida.sesion.mensajes, antes.length, { texto, audio: false })) return { ok: false, error, sesion: leida.sesion };
    return { ok: false, error, ...(ultima ? { sesion: ultima } : {}) };
  }
}
