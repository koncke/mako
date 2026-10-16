'use client';

// =============================================================================
// OfferApp — la tab Offer (v2): un funnel, una oferta, un chat con MaKo y un PDF
// =============================================================================
// v1 (11/10/2026): «Implementa completamente la funcionalidad de "Offer Analyst" y "Offer
// Generator" pero todo en una misma tab… algo simple como un chat con una IA… y que el resultado
// final sea que te dé un PDF con la conclusión. Y que se pueda visualizar allí también.»
//
// v2 (11/10/2026, el mismo día), lo que cambia en la pantalla:
//   · ARRIBA, EN EL LUGAR DEL TÍTULO, EL SELECTOR DEL FUNNEL en árbol (./SelectorFunnel.tsx):
//     funnel → sus ofertas → sus conversaciones; «＋ Nueva oferta» en cada funnel y «＋ Analizar» en
//     cada oferta (POST 'nueva'). Reemplaza al botón de «Ofertas anteriores» y a «Nueva oferta».
//   · EL CHAT ES EL DE WHATSAPP DE LA CASA (./ChatOffer.tsx): burbujas, emoji, clip, micrófono con su
//     grabación; MaKo con su foto (la estrella sola sobre negro, ./AvatarMako.tsx).
//   · LAS PREGUNTAS DEL DIAGNÓSTICO (`m.pregunta`) se ven como cualquier pregunta de MaKo, con sus
//     opciones; tocar la opción N manda `respuesta: { preguntaId, idx: N }`. El RESULTADO del
//     diagnóstico no se dibuja: va al PDF.
//   · UN LINK EN EL MENSAJE (la web, la landing) se lee con 'leer-link' antes del turno y viaja como
//     un documento más: «si partimos de un documento o un link de su web… sería mucho más fácil».
//   · UNA NOTA DE VOZ se sube como un archivo (subir-url → PUT) y el turno la lleva en `audio`; el
//     servidor la transcribe y el `texto` del mensaje es la transcripción.
//   · LOS ARCHIVOS SE LEEN AL ENVIAR, NO AL ELEGIR (pedido de Martín, 11/10/2026: «No se si apenas lo
//     subí ya lo quiso analizar, eso estaría mal. Solo cuando le doy a ENVIAR debería... Sino, debería
//     salir la vista previa del documento que acabo de subir, como lo tiene whatsapp»). Elegir (clip o
//     soltar) abre la vista previa de la casa (app/whatsapp/_shared/VistaAdjuntos.tsx) sobre el chat; ahí
//     se suman más y se escribe el mensaje. Recién Enviar sube y lee cada uno (./adjuntos-envio.ts,
//     «Leyendo «X»…») y después manda el turno. Se fue el chip con el ✓ de «leído» de arriba de la barra.
// Lo que estaba bien en la v1 se queda: el riel de piezas, la vista Generando, la Conclusión con su
// PDF, los topes de cada llamada y el reintento.
//
// ⚠️ EL CHAT NO DESAPARECE NUNCA (16/10/2026). Hasta ese día había tres vistas que se reemplazaban
// (chat · generando · conclusión) y armar la oferta te sacaba del chat. Martín, en la llamada con Leila
// del 12/10: «en lugar de que cambie el chat, que siga manteniendo el mismo chat pero que MaKo te envíe un
// mensaje diciéndote ya estoy trabajando» y «yo de hecho quisiera que jamás se salga el recuadro del
// chat… de última que haya como una preview de un pop-up». Ahora armar es un mensaje más del hilo
// (`armando` de ChatOffer) y la oferta se ve en una ventana ENCIMA del chat (Modal), desde «Ver mi
// oferta» del PDF o del riel. Sin conversación abierta, una bienvenida de una línea que manda al selector.
//
// MODO ARRANQUE (`arranque`): el mismo motor es el ONBOARDING de MaKo (app/onboarding/ChatArranque.tsx).
// Sin selector ni bienvenida: la conversación nace sola en el funnel principal, y alrededor de ella van
// los mensajes del arranque (quién es, el CRM, el teléfono), que contesta el arranque y no Offer.
//
// El motor vive en app/api/offer/route.ts y lib/offer-sesiones.ts; acá sólo se llama al contrato
// (./offer-api.ts) y se dibuja lo que vuelve.
//
// ⚠️ TODA CONVERSACIÓN EXISTE ANTES DEL PRIMER MENSAJE ('nueva' la crea con el primer mensaje de
// MaKo). Por eso la coordinación de la v1 para no crear dos sesiones con dos archivos elegidos a la
// vez ya no hace falta: sin `sesionId` no se escribe nada.
// ⚠️ CAMBIAR DE CONVERSACIÓN DESCARTA LO QUE ESTABA EN VUELO (`epoca`). Lo que el servidor ya
// recibió se guarda igual en la de antes; lo que no puede pasar es que su respuesta se dibuje acá.
// ⚠️ LO QUE LLAMA UNA SESIÓN DE VOZ CORRE CON LAS PROPS DEL RENDER EN QUE SE APRETÓ EL 🎤
// (ComposerWhatsApp guarda ese `onAudio`). Por eso `mandar` y `mandarAudio` deciden con REFS
// (`sesionRef`, `enviando`, `leyendoRef`), nunca con el estado de su render.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Banner, Button, ButtonLink, Modal, Spinner } from '@/app/_ui';
import { ACCEPT_IMPORTAR, MAX_ARCHIVO_BYTES, porQueNoPuedo, puedeLeerse } from '@/lib/formatos-archivo';
import type { AdjuntoVista, ArbolOffer, OfferMensaje, OfferSesionVista } from '@/lib/offer-marco';
import { VistaAdjuntos, useListaAdjuntos } from '@/app/whatsapp/_shared/VistaAdjuntos';
import { MAX_ADJUNTOS, type ItemAdjunto } from '@/app/whatsapp/_shared/adjuntos-vista';
import { AvatarMako } from './AvatarMako';
import { ChatOffer } from './ChatOffer';
import { Conclusion } from './Conclusion';
import type { PasoGeneracion } from './Generando';
import { BarraPiezasMovil, RielPiezas, type AccionesPiezas } from './PiezasRail';
import { SelectorFunnel } from './SelectorFunnel';
import { leerAdjuntos } from './adjuntos-envio';
import { arbolSeguro, arbolVacio, conSesionEnArbol, leerValor } from './arbol';
import {
  ACTUALIZAR_PDF, TOPE_MENSAJE, bienvenidaDe, esOpcionArmar, etiquetaArmar, linksDe, quedoGuardado, reemplaza,
  resumenDe, type AvisoGuardado,
} from './ayudas';
import { CSS_OFFER } from './estilos';
import { ErrorOfferApi, TOPE, esRechazoDefinitivo, llamarOffer, mensajeDeError, subirArchivo } from './offer-api';

type EstadoGeneracion = { paso: PasoGeneracion; corriendo: boolean; error: string | null };
const GEN_QUIETA: EstadoGeneracion = { paso: 'diagnostico', corriendo: false, error: null };
/** Cada cuánto se relee la conversación mientras el servidor arma la oferta. */
const RELEER_ARMADO_MS = 4_000;

/** Una nota de voz grabada: el binario, cuánto dura y su URL `blob:` (la del reproductor mientras sale). */
/**
 * Una nota de voz de la barra. `path` es dónde quedó subida en Storage, y existe para que un REINTENTO
 * no la vuelva a subir: el servidor conserva el binario a propósito cuando la IA falla («el binario NO se
 * borra: la pantalla puede reintentar con el mismo audio»), y la pantalla lo subía de nuevo igual — cada
 * reintento dejaba un archivo huérfano pagando en Storage. Mismo trato que los documentos, que ya se
 * recordaban en `docsLeidos` justamente para no releerlos.
 */
type AudioGrabado = { blob: Blob; secs: number; url: string; path?: string };

/** Lo que se manda en un turno. */
type Envio = {
  texto: string;
  docs: AdjuntoVista[];
  respuesta?: { preguntaId: string; idx: number };
  audio?: AudioGrabado;
  /** Qué está leyendo MaKo mientras contesta («tu respuesta», «2 archivos»…). */
  fuente: string;
};

/**
 * Cómo terminó un envío, para quien lo mandó:
 *   · 'salio'  — MaKo contestó, o el mensaje YA quedó guardado: no se devuelve nada (reenviarlo lo duplicaría);
 *   · 'volver' — no salió y vale reintentar (un corte, un 502): el texto, los archivos o el audio vuelven;
 *   · 'tirar'  — el servidor ya dijo que mandar LO MISMO no sirve (413, 415, 422: un audio sin voz, uno
 *                que pesa de más) o el audio no se puede convertir. El texto igual vuelve al composer
 *                (se puede corregir); un AUDIO se descarta y queda dicho por qué (revisión del 11/10:
 *                volverlo a mandar corría otra vez la cascada de transcripción entera, con su escalón pago).
 */
type Resultado = 'salio' | 'volver' | 'tirar';

/**
 * Los topes del navegador para lo que entra a la vista previa: que se pueda leer (lib/formatos-archivo.ts)
 * y que no pase de 25 MB (el tope de la subida directa a Storage). Se validan ANTES de subir y dicen por
 * qué no: un rebote mudo deja a la persona esperando un archivo que nunca va a llegar.
 * Sin `accept` acá a propósito: `validar` dice el motivo PROPIO de cada formato («los .pages no se pueden
 * leer: expórtalo a PDF»), y el rebote genérico del `accept` lo taparía. El «+» igual lleva el `accept`.
 */
const TOPES_OFFER = {
  maxBytes: MAX_ARCHIVO_BYTES,
  maxArchivos: MAX_ADJUNTOS,
  validar: (f: { name: string; type: string }): string | null => (puedeLeerse(f.name, f.type) ? null : `«${f.name}» ${porQueNoPuedo(f.name) || 'no se puede leer.'}`),
};

const cuantosArchivos = (n: number): string => `${n} ${n === 1 ? 'archivo' : 'archivos'}`;

/**
 * Un audio que no se puede convertir no se arregla reintentando: es la MISMA grabación. Se distingue
 * de un corte de red para que no vuelva a la barra con «Enviar audio» (ver `Resultado`).
 */
class AudioInservible extends Error {}

/** La nota de voz en MP3: lo que el transcriptor y cualquier navegador aceptan (el webm de Chrome no). */
async function aMp3(blob: Blob): Promise<Blob> {
  if (blob.type === 'audio/mpeg') return blob;
  try {
    // Perezoso, como ChatHilo: el codificador (lamejs) sólo se baja al mandar una nota de voz.
    const { blobToMp3 } = await import('@/app/whatsapp/audio');
    return await blobToMp3(blob);
  } catch {
    throw new AudioInservible('No se pudo procesar el audio. Grábalo de nuevo.');
  }
}

/**
 * El onboarding de MaKo es este chat (app/onboarding/ChatArranque.tsx): lo que el arranque le pasa al motor.
 * Las reglas del arranque viven en lib/onboarding-arranque.ts; acá sólo se enchufan.
 */
export type ArranqueOffer = {
  /** Los mensajes del arranque antes y después de la conversación de la oferta (ids `arr-…`). */
  antes: OfferMensaje[];
  despues: OfferMensaje[];
  /** La etapa NO es la de la oferta: el composer y las opciones del último mensaje van al arranque. */
  manda: boolean;
  /** Mandar un texto al arranque; true = salió (si no, vuelve al composer). */
  onTexto: (t: string) => Promise<boolean>;
  /** Una opción del último mensaje del arranque. */
  onOpcion: (idx: number) => void;
  /** El arranque está guardando una respuesta. */
  ocupado: boolean;
  /** Las tarjetas del arranque (el CRM, el teléfono, el cierre), adentro de su burbuja. */
  extra: (m: OfferMensaje) => ReactNode | null;
  /** La foto de MaKo (su muñeco). */
  avatar: (animar: boolean) => ReactNode;
  /** El funnel principal: si todavía no hay conversación y toca la oferta, se abre una ahí. */
  abrirEnFunnel: number | null;
  /** Ya están las piezas y el diagnóstico: arranca a armar la oferta (una vez, por detrás). */
  armar: boolean;
  /** Cada vez que la conversación cambia. */
  onSesion: (s: OfferSesionVista) => void;
  /** «Tu oferta» al costado: sólo desde que empieza la conversación de la oferta. */
  conRiel: boolean;
  placeholder?: string;
  /** Una conversación vacía para dibujar los mensajes del arranque antes de que exista la de la oferta. */
  vacia: OfferSesionVista;
  /** Lo que va debajo de un error del chat (la salida para conectar una IA propia, si la de MaKo no contesta). */
  errorExtra?: ReactNode;
};

export function OfferApp({ arbolInicial, sesionInicial, arbolFallo, opcionArmar, opcionActualizar = ACTUALIZAR_PDF, analizarAlAbrir = null, arranque = null }: {
  /** El modo onboarding (ver `ArranqueOffer`). null = la tab Offer. */
  arranque?: ArranqueOffer | null;
  arbolInicial: ArbolOffer;
  /** Un link que nombra una oferta sin conversación todavía (`entradaDelLink`, ./arbol.ts): se abre una para analizarla. */
  analizarAlAbrir?: { funnelId: number; ofertaBaseId: number | null } | null;
  /** La conversación más reciente, abierta. null = la bienvenida. */
  sesionInicial: OfferSesionVista | null;
  /** El server no pudo leer el árbol (la pantalla igual abre). */
  arbolFallo: boolean;
  /** La respuesta rápida que dispara la generación (lib/offer-reglas.ts → OPCION_ARMAR). */
  opcionArmar: string;
  /**
   * El botón de armar cuando ya hay una versión («Actualizar el PDF»). Default de la pantalla hasta que el
   * motor tenga su constante (ayudas.ts → ACTUALIZAR_PDF); si MaKo lo ofrece como respuesta rápida, también arma.
   */
  opcionActualizar?: string;
}) {
  const [arbol, setArbol] = useState<ArbolOffer>(arbolInicial);
  const [sesion, setSesion] = useState<OfferSesionVista | null>(sesionInicial);
  /** La oferta abierta en su ventana, ENCIMA del chat (el chat no se va: ver la cabecera). */
  const [verConclusion, setVerConclusion] = useState(false);
  const [texto, setTexto] = useState('');
  /** Los archivos de la vista previa: elegidos y SIN subir ni leer hasta que se aprieta Enviar. */
  const lista = useListaAdjuntos(TOPES_OFFER);
  /** Subiendo y leyendo los archivos de la vista (antes del turno). */
  const [leyendo, setLeyendo] = useState(false);
  /** En cuál va: «Leyendo «precios.pdf»…». */
  const [estadoVista, setEstadoVista] = useState<string | null>(null);
  const [errorVista, setErrorVista] = useState<string | null>(null);
  /** El archivo cuya lectura falló: su miniatura va marcada. */
  const [falloId, setFalloId] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<OfferMensaje | null>(null);
  const [fuente, setFuente] = useState('tu respuesta');
  const [errorChat, setErrorChat] = useState<string | null>(null);
  /** Reintentando la respuesta de MaKo: hay espera, pero ningún mensaje nuevo que dibujar. */
  const [reintentando, setReintentando] = useState(false);
  const [gen, setGen] = useState<EstadoGeneracion>(GEN_QUIETA);
  /** Abriendo o creando una conversación desde el selector. */
  const [cambiando, setCambiando] = useState(false);
  const [errorSelector, setErrorSelector] = useState<string | null>(null);
  /**
   * ¿El árbol se pudo LEER? «No pude leer» no es «no hay funnels» (AGENTS.md): con el árbol caído la
   * bienvenida no puede mandar a crear un funnel a un negocio que tiene tres. Pasa a true sólo cuando
   * una lectura sale bien; una que falla no lo baja (si ya había un árbol, sigue sirviendo).
   */
  const [arbolLeido, setArbolLeido] = useState(!arbolFallo);
  const [recargando, setRecargando] = useState(false);
  /** Una nota de voz que no llegó a salir: vuelve a la barra para reintentar o tirarla. */
  const [audioEnEspera, setAudioEnEspera] = useState<AudioGrabado | null>(null);

  const sesionRef = useRef<OfferSesionVista | null>(sesionInicial);
  const sesionId = useRef<number | null>(sesionInicial?.id ?? null);
  const epoca = useRef(0);
  const generando = useRef(false);
  const enviando = useRef(false);
  /** Leyendo los archivos de la vista: lo mira una nota de voz que llega en el medio (decide con refs). */
  const leyendoRef = useRef(false);
  /** Los links ya leídos en ESTA conversación: reenviar el mismo mensaje no lo vuelve a leer. */
  const linksLeidos = useRef(new Map<string, AdjuntoVista>());
  /**
   * Los archivos de la vista YA leídos, por el id de la vista: si después falla otro (o el turno), al
   * reintentar no se vuelven a subir ni a leer (cada lectura es un pedido de IA).
   */
  const docsLeidos = useRef(new Map<string, AdjuntoVista>());

  // ── Las URL `blob:` de las notas de voz: se sueltan al sacarlas y al salir ──
  // (Las de los archivos de la vista previa las crea y las suelta VistaAdjuntos, por elemento.)
  const urls = useRef(new Set<string>());
  const crearUrl = (b: Blob): string => { const u = URL.createObjectURL(b); urls.current.add(u); return u; };
  const soltarUrl = (u: string | null | undefined) => {
    if (!u || !urls.current.has(u)) return;
    urls.current.delete(u);
    try { URL.revokeObjectURL(u); } catch { /* ya no estaba */ }
  };
  useEffect(() => {
    const todas = urls.current;
    return () => { for (const u of todas) { try { URL.revokeObjectURL(u); } catch { /* noop */ } } todas.clear(); };
  }, []);

  // ── La conversación que vuelve del servidor ────────────────────────────────
  const ponerSesion = (s: OfferSesionVista | null) => { sesionRef.current = s; setSesion(s); };
  const aplicarSesion = useCallback((nueva: OfferSesionVista, e: number) => {
    if (e !== epoca.current) return;
    if (!reemplaza(sesionRef.current, nueva)) return;
    sesionId.current = nueva.id;
    sesionRef.current = nueva;
    setSesion(nueva);
    setArbol((a) => conSesionEnArbol(a, nueva, resumenDe(nueva)));
  }, []);

  /** Deja la pantalla limpia para otra conversación. */
  const reiniciar = () => {
    epoca.current += 1;
    sesionId.current = null;
    enviando.current = false;
    linksLeidos.current = new Map();
    lista.vaciar();
    docsLeidos.current = new Map();
    leyendoRef.current = false;
    setLeyendo(false);
    setEstadoVista(null);
    setErrorVista(null);
    setFalloId(null);
    setAudioEnEspera((a) => { if (a) soltarUrl(a.url); return null; });
    setPendiente(null);
    setTexto('');
    setErrorChat(null);
    setReintentando(false);
    setGen(GEN_QUIETA);
  };

  const refrescarArbol = useCallback(async (): Promise<boolean> => {
    try {
      const r = await llamarOffer<{ arbol: unknown }>({ action: 'arbol' }, TOPE.corto);
      setArbol(arbolSeguro(r.arbol));
      setArbolLeido(true);
      return true;
    } catch {
      // Queda el árbol que había: sigue sirviendo para elegir. Si nunca se leyó, la bienvenida lo dice.
      return false;
    }
  }, []);

  /** «Volver a cargar» de la bienvenida y del aviso: el árbol que no se pudo leer. */
  const recargarArbol = async () => {
    if (recargando) return;
    setRecargando(true);
    setErrorSelector(null);
    try {
      if (!(await refrescarArbol())) setErrorSelector('No cargaron tus funnels. Prueba de nuevo en un momento.');
    } finally {
      setRecargando(false);
    }
  };

  // Otra pestaña pudo haber creado una conversación: al volver a ésta, el árbol se vuelve a pedir.
  const conArbol = !arranque;
  useEffect(() => {
    if (!conArbol) return;
    const alVolver = () => { if (document.visibilityState === 'visible') void refrescarArbol(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [refrescarArbol, conArbol]);

  // ── Mandar un turno ────────────────────────────────────────────────────────
  /**
   * Manda un mensaje (texto, archivos ya leídos, una respuesta a una pregunta o una nota de voz).
   * Devuelve cómo terminó (`Resultado`): quien lo mandó decide qué vuelve al composer.
   */
  const mandar = async (envio: Envio): Promise<Resultado> => {
    const id = sesionId.current;
    const s = sesionRef.current;
    if (id == null || !s || enviando.current) return 'volver';
    if (!envio.texto.trim() && !envio.docs.length && !envio.audio) return 'volver';
    enviando.current = true;
    const e = epoca.current;
    const antes = s.mensajes.length;
    setErrorChat(null);
    setFuente(envio.fuente);
    // Optimista: el mensaje del dueño se dibuja ya (una nota de voz, con su URL local), mientras MaKo contesta.
    setPendiente({
      id: 'pendiente', de: 'yo', texto: envio.texto, at: new Date().toISOString(),
      ...(envio.docs.length ? { adjuntos: envio.docs } : {}),
      ...(envio.audio ? { audio: { url: envio.audio.url, secs: envio.audio.secs } } : {}),
    });
    let avisoLink: string | null = null;
    try {
      const docIds = envio.docs.map((d) => d.id);
      // 1) Los links del mensaje, leídos como un documento más (y una sola vez por conversación).
      for (const url of linksDe(envio.texto)) {
        const ya = linksLeidos.current.get(url);
        if (ya) { if (!docIds.includes(ya.id)) docIds.push(ya.id); continue; }
        setFuente('tu link');
        try {
          const r = await llamarOffer<{ sesion: OfferSesionVista; doc: AdjuntoVista }>(
            { action: 'leer-link', sesionId: id, url, funnelId: s.funnelId },
            TOPE.leer,
            'Leer el link tardó demasiado.',
          );
          if (e !== epoca.current) return 'volver';
          aplicarSesion(r.sesion, e);
          if (r.doc?.id) { linksLeidos.current.set(url, r.doc); docIds.push(r.doc.id); }
        } catch (err) {
          if (e !== epoca.current) return 'volver';
          // Un link que no abre no frena el mensaje: el texto lo nombra igual y MaKo pregunta. El motivo va
          // TAL CUAL lo manda el servidor (ya es una frase entera: «Entré a tu página pero casi no encontré
          // texto…»); con un prefijo nuestro adelante se leía como dos frases pegadas.
          if (err instanceof ErrorOfferApi && err.sesion) aplicarSesion(err.sesion, e);
          avisoLink = mensajeDeError(err);
        }
      }
      // 2) La nota de voz: a MP3 y a Storage, como un archivo (no pasa por una server action, que topea en 1 MB).
      let audio: { path: string; mime: string; secs: number } | undefined;
      if (envio.audio) {
        setFuente('tu audio');
        // Si ya se subió en un intento anterior, se reusa: el binario sigue ahí (el servidor lo conserva
        // cuando falla la IA) y volver a subirlo deja el primero huérfano.
        let path = envio.audio.path;
        if (!path) {
          const mp3 = await aMp3(envio.audio.blob);
          path = await subirArchivo(new File([mp3], 'nota-de-voz.mp3', { type: 'audio/mpeg' }), 'audio/mpeg');
          envio.audio.path = path;
        }
        if (e !== epoca.current) return 'volver';
        audio = { path, mime: 'audio/mpeg', secs: Math.max(1, Math.round(envio.audio.secs)) };
      }
      setFuente(envio.fuente);
      const r = await llamarOffer<{ sesion: OfferSesionVista }>(
        {
          action: 'turno', sesionId: id, texto: envio.texto, docIds,
          ...(audio ? { audio } : {}),
          ...(envio.respuesta ? { respuesta: envio.respuesta } : {}),
        },
        TOPE.turno,
        'MaKo tardó demasiado en contestar. Prueba de nuevo.',
      );
      aplicarSesion(r.sesion, e);
      if (avisoLink && e === epoca.current) setErrorChat(avisoLink);
      return e === epoca.current ? 'salio' : 'volver';
    } catch (err) {
      if (e !== epoca.current) return 'volver';
      setErrorChat(mensajeDeError(err));
      // El mensaje quedó guardado aunque MaKo no contestó: se dibuja la sesión que mandó el servidor
      // y lo enviado NO vuelve al composer. La salida es «Reintentar», que corre la IA sobre lo guardado.
      if (err instanceof ErrorOfferApi && err.sesion) { aplicarSesion(err.sesion, e); return 'salio'; }
      // El servidor ya dijo que lo mismo no va a entrar (o el audio no se puede convertir): no se relee
      // ni se ofrece reintentar ESO. El motivo ya quedó en la línea de error.
      if (err instanceof AudioInservible || (err instanceof ErrorOfferApi && esRechazoDefinitivo(err.status))) return 'tirar';
      // Sin sesión en el error (un corte de red, un 504): antes de devolver lo enviado se relee la
      // conversación. Si el mensaje ya quedó guardado, devolverlo haría que se mande dos veces.
      try {
        const r = await llamarOffer<{ sesion: OfferSesionVista }>({ action: 'abrir', id }, TOPE.corto);
        if (e !== epoca.current) return 'volver';
        aplicarSesion(r.sesion, e);
        if (quedoGuardado(r.sesion.mensajes, antes, { texto: envio.texto, audio: !!envio.audio })) return 'salio';
      } catch { /* sin conexión: se devuelve lo enviado, que es lo seguro */ }
      return 'volver';
    } finally {
      if (e === epoca.current) {
        setPendiente(null);
        enviando.current = false;
      }
    }
  };

  /** Vuelve a pedirle la respuesta a MaKo para el último mensaje, que quedó sin contestar. */
  const reintentarRespuesta = async () => {
    const id = sesionId.current;
    if (id == null || enviando.current) return;
    enviando.current = true;
    const e = epoca.current;
    setErrorChat(null);
    setFuente('tu último mensaje');
    setReintentando(true);
    try {
      const r = await llamarOffer<{ sesion: OfferSesionVista }>(
        { action: 'turno', sesionId: id, reintentar: true },
        TOPE.turno,
        'MaKo tardó demasiado en contestar. Prueba de nuevo.',
      );
      aplicarSesion(r.sesion, e);
    } catch (err) {
      if (e === epoca.current) {
        setErrorChat(mensajeDeError(err));
        if (err instanceof ErrorOfferApi && err.sesion) aplicarSesion(err.sesion, e);
      }
    } finally {
      if (e === epoca.current) { setReintentando(false); enviando.current = false; }
    }
  };

  const respondiendo = pendiente != null || reintentando;
  const puedeMandar = !!sesion && !respondiendo && !leyendo && !gen.corriendo && !cambiando;
  const hayAlgo = texto.trim().length > 0;

  /**
   * Manda lo del composer (sólo texto: con archivos juntados la barra queda debajo de la vista previa, y
   * ahí manda `enviarVista`). Si no sale, el texto VUELVE al composer: perder lo que alguien escribió
   * porque se cortó la conexión es peor que el corte.
   */
  const enviarComposer = async () => {
    // En el arranque, fuera de la etapa de la oferta, el texto es la respuesta a SU pregunta (el nombre, un
    // código): lo contesta el arranque, no Offer. Si no salió, vuelve al composer.
    if (arranque?.manda) {
      const t = texto.trim();
      if (!t || arranque.ocupado) return;
      setTexto('');
      if (!(await arranque.onTexto(t))) setTexto((ahora) => (ahora.trim() ? ahora : t));
      return;
    }
    if (lista.ref.current.length) { void enviarVista(); return; }
    if (!puedeMandar || !hayAlgo) return;
    if (texto.length > TOPE_MENSAJE) { setErrorChat('Tu mensaje es muy largo. Pártelo en dos.'); return; }
    const t = texto.trim();
    const e = epoca.current;
    setTexto('');
    // Con 'tirar' el texto también vuelve: un texto rechazado se puede corregir (un audio, no).
    const res = await mandar({ texto: t, docs: [], fuente: linksDe(t).length ? 'tu link' : 'tu respuesta' });
    if (res === 'salio') return;
    if (e === epoca.current) setTexto((ahora) => (ahora.trim() ? ahora : t));
  };

  // ── Archivos: la vista previa ──────────────────────────────────────────────
  /** Sube y lee UN archivo de la vista (subir-url → PUT → 'leer'). Sólo lo llama `enviarVista`. */
  const leerUno = async (it: ItemAdjunto, id: number, funnelId: number | null, e: number): Promise<AdjuntoVista> => {
    const mime = it.file.type || 'application/octet-stream';
    const path = await subirArchivo(it.file, mime);
    if (e !== epoca.current) throw new Error('Cambiaste de conversación.');
    const r = await llamarOffer<{ sesion: OfferSesionVista; doc: AdjuntoVista }>(
      { action: 'leer', sesionId: id, path, nombre: it.file.name, mime, ...(funnelId != null ? { funnelId } : {}) },
      TOPE.leer,
      'Leer el archivo tardó demasiado.',
    );
    aplicarSesion(r.sesion, e);
    return r.doc;
  };

  /**
   * Enviar de la vista previa. Recién ACÁ se sube y se lee cada archivo (./adjuntos-envio.ts), en orden y
   * diciendo en cuál va; con todos leídos, la vista se cierra y sale el turno con los docs y el texto
   * (`mandar`: el link del texto, el 502 con la sesión guardada y el reintento siguen ahí). Si una lectura
   * falla, NO sale el turno: la vista queda con el error y el archivo marcado, y los ya leídos no se
   * vuelven a leer al reintentar. Si el turno no sale, la vista vuelve con todo (y los docs ya leídos).
   */
  const enviarVista = async () => {
    const items = lista.ref.current;
    if (!items.length || leyendoRef.current || !puedeMandar) return;
    if (texto.length > TOPE_MENSAJE) { setErrorVista('Tu mensaje es muy largo. Pártelo en dos.'); return; }
    const id = sesionId.current;
    const s = sesionRef.current;
    if (id == null || !s) return;
    const e = epoca.current;
    // El texto que se manda es el de cuando se apretó Enviar. Si se sigue escribiendo mientras se leen los
    // archivos, eso queda en la barra (no se pisa ni se pierde).
    const t = texto.trim();
    leyendoRef.current = true;
    setLeyendo(true);
    setErrorVista(null);
    setErrorChat(null);
    setFalloId(null);
    let lectura: Awaited<ReturnType<typeof leerAdjuntos>>;
    try {
      lectura = await leerAdjuntos(items, docsLeidos.current, {
        leer: (it) => leerUno(it, id, s.funnelId, e),
        alEmpezar: (it) => { if (e === epoca.current) setEstadoVista(`Leyendo «${it.file.name}»…`); },
        vigente: () => e === epoca.current,
      });
    } finally {
      if (e === epoca.current) { leyendoRef.current = false; setLeyendo(false); setEstadoVista(null); }
    }
    if (e !== epoca.current || (!lectura.ok && lectura.cortado)) return;
    if (!lectura.ok) {
      setErrorVista(lectura.error);
      setFalloId(lectura.falloId);
      return;
    }
    setTexto((ahora) => (ahora.trim() === t ? '' : ahora));
    lista.vaciar();
    const res = await mandar({ texto: t, docs: lectura.docs, fuente: cuantosArchivos(lectura.docs.length) });
    if (res === 'salio') { for (const it of items) docsLeidos.current.delete(it.id); return; }
    // No salió (un corte, un rechazo): vuelve la vista con lo que había, y el error del turno (que `mandar`
    // dejó en `errorChat`) se ve ahí. Los docs siguen en `docsLeidos`: reintentar no los relee.
    if (e === epoca.current) {
      setTexto((ahora) => (ahora.trim() ? ahora : t));
      lista.poner([...items, ...lista.ref.current.filter((x) => !items.some((y) => y.id === x.id))]);
    }
  };

  /** El clip o soltar: abre (o suma a) la vista previa. NO sube ni lee nada. */
  const agregarArchivos = (archivos: File[]) => {
    if (sesionId.current == null) return;
    const abierta = lista.ref.current.length > 0;
    const errores = lista.agregar(archivos);
    const msg = errores.length ? errores.join(' ') : null;
    // Con la vista abierta, el motivo va en la vista; si no se abrió (nada entró), en la línea del chat.
    if (lista.ref.current.length) {
      setErrorVista(msg);
      if (!abierta) setErrorChat(null);
    } else {
      setErrorChat(msg);
    }
  };
  const quitarArchivo = (idArchivo: string) => {
    lista.quitar(idArchivo);
    docsLeidos.current.delete(idArchivo);
    if (idArchivo === falloId) { setFalloId(null); setErrorVista(null); }
  };
  /** La ✕ de la vista o Escape: descarta los archivos (el texto queda en la barra). */
  const cerrarVista = () => {
    if (leyendoRef.current) return;
    lista.vaciar();
    docsLeidos.current = new Map();
    setErrorVista(null);
    setFalloId(null);
  };

  // ── Notas de voz ───────────────────────────────────────────────────────────
  /** Manda una nota de voz. Si no sale, vuelve a la barra de escucharla (no se pierde lo grabado). */
  const enviarAudio = async (a: AudioGrabado) => {
    const e = epoca.current;
    if (sesionId.current == null || enviando.current || generando.current || leyendoRef.current) {
      // Llegó con algo en curso (se grabó mientras MaKo contestaba): espera en la barra.
      setAudioEnEspera(a);
      return;
    }
    const res = await mandar({ texto: '', docs: [], audio: a, fuente: 'tu audio' });
    if (e !== epoca.current) { soltarUrl(a.url); return; }
    // Sólo un fallo que se arregla reintentando devuelve el audio a la barra. Uno rechazado como
    // definitivo (sin voz, demasiado pesado, imposible de convertir) se descarta: el motivo ya está dicho.
    if (res === 'volver') { setAudioEnEspera(a); return; }
    // Salió, o el rechazo es definitivo: la grabación no vuelve a la barra.
    soltarUrl(a.url);
    // Sólo el rechazo definitivo ('tirar') suelta el binario. El 422 «no le entendí nada» ya lo borra el
    // servidor; los otros (413, 415, imposible de convertir) no. Pedir el borrado dos veces no rompe.
    // ⚠️ NUNCA con 'salio' (16/10/2026): ese path es el que guarda el mensaje y el que firma GET
    // /api/offer/audio para reproducirlo; borrarlo dejaba muda la nota de voz que sí se mandó.
    if (res === 'tirar') descartarSubida(a.path);
  };

  /**
   * Le avisa al servidor que un binario subido ya no se va a usar. No espera ni muestra nada: que un
   * archivo quede suelto es plata, no algo que el dueño pueda arreglar, y un error acá taparía lo que
   * sí le importa. Sin `path` no hay nada que borrar (la grabación nunca llegó a subirse).
   * Va con `TOPE.corto`: es un borrado, no una lectura de IA.
   */
  const descartarSubida = (path?: string) => {
    if (!path) return;
    void llamarOffer({ action: 'descartar-subida', path }, TOPE.corto, '').catch(() => null);
  };
  const mandarAudio = (blob: Blob, secs: number) => { void enviarAudio({ blob, secs, url: crearUrl(blob) }); };
  const reenviarAudio = () => {
    const a = audioEnEspera;
    if (!a) return;
    setAudioEnEspera(null);
    void enviarAudio(a);
  };
  const descartarAudio = () => {
    setAudioEnEspera((a) => { if (a) { soltarUrl(a.url); descartarSubida(a.path); } return null; });
  };

  // ── Armar la oferta ────────────────────────────────────────────────────────
  /**
   * Le pide al SERVIDOR que arme la oferta (16/10/2026). Antes el navegador esperaba los dos pasos (diagnóstico
   * y oferta) y, si la persona cerraba la pestaña en el primero, la oferta no se hacía nunca. Ahora 'armar'
   * contesta al toque y el servidor corre los dos pasos solo (y avisa al terminar, el evento `oferta_lista`); lo
   * que se ve sale de lo GUARDADO (`sesion.armando`, ver el efecto de abajo), así que una recarga o la pestaña
   * que vuelve muestran el mismo armado. El reintento es el mismo pedido: el servidor arranca desde el paso que
   * falló. `generando` (un ref, no un estado) impide dispararlo dos veces con un doble clic, y el servidor
   * tampoco arranca otro si ya hay uno corriendo.
   */
  const armar = async () => {
    const id = sesionId.current;
    if (id == null || generando.current) return;
    generando.current = true;
    const e = epoca.current;
    // Sin cambiar de vista: el armado es un mensaje más del hilo (`armando`) y el chat sigue ahí.
    setGen({ paso: sesionRef.current?.armando?.paso ?? 'diagnostico', corriendo: true, error: null });
    try {
      const r = await llamarOffer<{ sesion: OfferSesionVista }>({ action: 'armar', sesionId: id, origen: arranque ? 'arranque' : 'tab' }, TOPE.corto);
      if (e !== epoca.current) return;
      aplicarSesion(r.sesion, e);
    } catch (err) {
      if (e !== epoca.current) return;
      setGen((g) => ({ ...g, corriendo: false, error: mensajeDeError(err) }));
    } finally {
      generando.current = false;
    }
  };

  // Lo que se ve del armado sale de lo guardado: en curso (con su paso), fallido (con su error) o terminado.
  const armado = sesion?.armando ?? null;
  const armadoPaso = armado?.paso ?? null;
  const armadoCorre = !!armado?.corriendo;
  const armadoError = armado?.error ?? null;
  useEffect(() => {
    if (armadoPaso) { setGen({ paso: armadoPaso, corriendo: armadoCorre, error: armadoError }); return; }
    // Sin armado guardado: si había uno a la vista, terminó (la oferta ya está en el chat como un mensaje).
    setGen((g) => (g.corriendo ? { paso: 'listo', corriendo: false, error: null } : g));
  }, [armadoPaso, armadoCorre, armadoError]);
  // Mientras el servidor arma, la conversación se relee: la conclusión aparece sola, y una pestaña que se
  // durmió se pone al día al despertar. Un fallo de red no corta nada: se reintenta en la vuelta siguiente.
  const idSesionArmando = armadoCorre ? (sesion?.id ?? null) : null;
  useEffect(() => {
    if (idSesionArmando == null) return;
    const e = epoca.current;
    const releer = async () => {
      try {
        const r = await llamarOffer<{ sesion: OfferSesionVista }>({ action: 'abrir', id: idSesionArmando }, TOPE.corto);
        aplicarSesion(r.sesion, e);
      } catch { /* sin conexión: la próxima vuelta */ }
    };
    const t = setInterval(() => { void releer(); }, RELEER_ARMADO_MS);
    const alVolver = () => { if (document.visibilityState === 'visible') void releer(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver); };
  }, [idSesionArmando, aplicarSesion]);

  /** Una respuesta rápida de MaKo (`idx` = su lugar en `opciones` del último mensaje). */
  const elegirOpcion = (idx: number) => {
    const s = sesionRef.current;
    const ultimo = s?.mensajes[s.mensajes.length - 1];
    if (!s || ultimo?.de !== 'mako') return;
    const op = (ultimo.opciones ?? [])[idx]?.trim();
    if (!op) return;
    if (!ultimo.pregunta && (esOpcionArmar(op, opcionArmar) || esOpcionArmar(op, opcionActualizar)) && s.puedeConcluir) { void armar(); return; }
    if (!puedeMandar) return;
    // (Los archivos ya no viajan con una respuesta rápida: con archivos juntados, la vista previa tapa el
    // chat y sus opciones; se mandan con su propio Enviar.)
    void mandar({
      texto: op,
      docs: [],
      // La opción N de una pregunta del diagnóstico ES la respuesta N: el motor la anota sin adivinar.
      ...(ultimo.pregunta ? { respuesta: { preguntaId: ultimo.pregunta.id, idx } } : {}),
      fuente: 'tu respuesta',
    });
  };

  // ── El selector: abrir una conversación o empezar una ──────────────────────
  const abrirSesion = async (id: number) => {
    // La que ya está abierta no se vuelve a pedir: re-abrirla descartaría lo que esté en vuelo
    // (un turno, un archivo) sobre esa misma conversación.
    if (sesionRef.current?.id === id) return;
    setCambiando(true);
    setErrorSelector(null);
    try {
      const r = await llamarOffer<{ sesion: OfferSesionVista }>({ action: 'abrir', id }, TOPE.corto);
      reiniciar();
      sesionId.current = r.sesion.id;
      ponerSesion(r.sesion);
      setArbol((a) => conSesionEnArbol(a, r.sesion, resumenDe(r.sesion)));
      setVerConclusion(false);
    } catch (err) {
      setErrorSelector(mensajeDeError(err));
    } finally {
      setCambiando(false);
    }
  };

  const nuevaSesion = async (funnelId: number, ofertaBaseId: number | null) => {
    setCambiando(true);
    setErrorSelector(null);
    try {
      const r = await llamarOffer<{ sesion: OfferSesionVista }>(
        { action: 'nueva', funnelId, ofertaBaseId },
        TOPE.turno,
        'Tardó demasiado en abrir. Prueba de nuevo.',
      );
      // 'nueva' puede devolver la MISMA conversación abierta: el servidor reusa la que sigue vacía
      // (`sesionVaciaDe`), y «vacía» incluye una a la que se le está transcribiendo un audio o leyendo
      // un archivo. Reiniciar ahí descartaba lo que estaba en vuelo sobre esa misma conversación — y un
      // texto con un link se perdía entero (revisión del 11/10). Es la guarda de `abrirSesion`.
      if (r.sesion.id === sesionRef.current?.id) {
        setVerConclusion(false);
        return;
      }
      reiniciar();
      sesionId.current = r.sesion.id;
      ponerSesion(r.sesion);
      setArbol((a) => conSesionEnArbol(a, r.sesion, resumenDe(r.sesion)));
      setVerConclusion(false);
      // En el arranque no hay selector: el árbol no se dibuja y no hace falta pedirlo.
      if (!arranque) void refrescarArbol();
    } catch (err) {
      setErrorSelector(mensajeDeError(err));
    } finally {
      setCambiando(false);
    }
  };

  const elegir = (valor: string) => {
    const el = leerValor(valor);
    if (!el || cambiando || generando.current) return;
    if (el.tipo === 'sesion') void abrirSesion(el.id);
    else void nuevaSesion(el.funnelId, el.ofertaBaseId);
  };

  // El link del CRM a una oferta sin conversación abre la nueva UNA vez. El ref sobrevive al doble
  // efecto de React en desarrollo: sin él, se pedirían dos (el server reusa la vacía, pero igual).
  const alAbrir = useRef(analizarAlAbrir);
  useEffect(() => {
    const p = alAbrir.current;
    if (!p) return;
    alAbrir.current = null;
    void nuevaSesion(p.funnelId, p.ofertaBaseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- corre al montar y nunca más
  }, []);

  // ── El arranque (el onboarding): lo que el motor hace solo ──────────────────
  // 1. La conversación de la oferta nace sola en el funnel principal cuando le toca (una vez: el server
  //    además reusa la vacía, `sesionVaciaDe`).
  const abriendoArranque = useRef(false);
  const funnelArranque = arranque?.abrirEnFunnel ?? null;
  useEffect(() => {
    if (funnelArranque == null || sesionRef.current || abriendoArranque.current) return;
    abriendoArranque.current = true;
    void nuevaSesion(funnelArranque, null).finally(() => { abriendoArranque.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `nuevaSesion` cambia en cada render; manda el funnel
  }, [funnelArranque]);
  // 2. Con las piezas y el diagnóstico, la oferta se arma POR DETRÁS mientras el arranque sigue (el CRM, el
  //    teléfono). Una sola vez: si falla, el reintento es del botón de su mensaje, no un bucle.
  const armoArranque = useRef(false);
  const armarArranque = !!arranque?.armar;
  useEffect(() => {
    if (!armarArranque || armoArranque.current || !sesion || sesion.conclusion || sesion.armando?.corriendo || generando.current) return;
    armoArranque.current = true;
    void armar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `armar` cambia en cada render
  }, [armarArranque, sesion]);
  // 3. El arranque mira la conversación (las piezas, si ya está armada) para saber en qué etapa está.
  const onSesionArranque = arranque?.onSesion;
  useEffect(() => { if (sesion && onSesionArranque) onSesionArranque(sesion); }, [sesion, onSesionArranque]);

  const guardarOferta = async (): Promise<AvisoGuardado | null> => {
    const id = sesionRef.current?.id;
    if (id == null) return null;
    const e = epoca.current;
    const r = await llamarOffer<{ ofertaId: number; sesion: OfferSesionVista; aviso?: unknown; avisoReintentable?: unknown }>({ action: 'guardar-oferta', sesionId: id }, TOPE.corto);
    aplicarSesion(r.sesion, e);
    // Guardarla la liga al funnel y puede mover la conversación de rama (de «oferta nueva» a la oferta).
    void refrescarArbol();
    // `avisoReintentable` en positivo: sólo un `true` explícito vuelve a ofrecer el botón (un aviso de un
    // servidor que no lo manda se trata como no reintentable: no se invita a repetir a ciegas).
    return typeof r.aviso === 'string' && r.aviso.trim() ? { texto: r.aviso, reintentable: r.avisoReintentable === true } : null;
  };

  // ── Lo que se dibuja ───────────────────────────────────────────────────────
  const conclusion = sesion?.conclusion ?? null;
  const puedeConcluir = !!sesion?.puedeConcluir;
  // En el arranque, fuera de la oferta, lo que ocupa es guardar SU respuesta: la oferta que se arma por
  // detrás no frena contestar el CRM o el teléfono.
  const ocupado = arranque?.manda
    ? arranque.ocupado || leyendo || cambiando
    : respondiendo || leyendo || gen.corriendo || cambiando;
  const verOferta = () => { if (conclusion) setVerConclusion(true); };
  const acciones: AccionesPiezas = {
    puedeConcluir,
    hayConclusion: !!conclusion,
    etiquetaArmar: etiquetaArmar(!!conclusion, opcionArmar, opcionActualizar),
    ocupado,
    onArmar: () => void armar(),
    onVer: verOferta,
  };
  // «Reintentar» se CALCULA del estado (el último mensaje es del dueño y nadie está contestando), no
  // se dispara desde el error: así también aparece si el fallo pasó en otra pestaña o antes de recargar.
  const ultimo = sesion?.mensajes[sesion.mensajes.length - 1];
  const sinContestar = !!sesion && !respondiendo && ultimo?.de === 'yo' && !arranque?.manda;
  const bienvenida = bienvenidaDe(arbolLeido, arbolVacio(arbol));
  // La vista previa, sobre el área del chat, mientras haya archivos juntados. Su error: el de la vista
  // (un archivo que no entró o no se pudo leer) o, si el turno no salió, el que dejó `mandar`.
  const vistaAdjuntos = lista.items.length ? (
    <VistaAdjuntos
      items={lista.items}
      onAgregar={agregarArchivos}
      onQuitar={quitarArchivo}
      onCerrar={cerrarVista}
      texto={texto}
      onTexto={setTexto}
      onEnviar={() => void enviarVista()}
      accept={ACCEPT_IMPORTAR}
      maxArchivos={MAX_ADJUNTOS}
      enviando={leyendo}
      puedeEnviar={puedeMandar}
      estado={estadoVista}
      error={errorVista ?? errorChat}
      conError={falloId}
    />
  ) : null;

  // En el arranque, la conversación que se dibuja lleva alrededor los mensajes del arranque. Antes de que
  // exista la de la oferta, se dibujan sobre una vacía.
  // Memo: un arreglo nuevo en cada tecla del composer haría que el hilo se vuelva a desplazar con cada letra.
  const arrAntes = arranque?.antes ?? null;
  const arrDespues = arranque?.despues ?? null;
  const arrVacia = arranque?.vacia ?? null;
  const visible = useMemo<OfferSesionVista | null>(() => (arrAntes && arrDespues && arrVacia
    ? { ...(sesion ?? arrVacia), mensajes: [...arrAntes, ...(sesion?.mensajes ?? []), ...arrDespues] }
    : sesion), [sesion, arrAntes, arrDespues, arrVacia]);
  const ultimoVisible = visible?.mensajes[visible.mensajes.length - 1];
  // La opción del último mensaje: si es del arranque, la contesta el arranque; si no, Offer.
  const alElegirOpcion = (idx: number) => {
    if (arranque && ultimoVisible?.id.startsWith('arr-')) { arranque.onOpcion(idx); return; }
    elegirOpcion(idx);
  };
  const opcionesHabilitadas = arranque && ultimoVisible?.id.startsWith('arr-') ? !arranque.ocupado : puedeMandar;
  const armandoEnChat = gen.corriendo || gen.error
    ? { paso: gen.paso, corriendo: gen.corriendo, error: gen.error, onReintentar: () => void armar() }
    : null;
  const conRiel = !arranque || arranque.conRiel;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <style>{CSS_OFFER}</style>
      {!arranque && (
        <header className="of-cabecera">
          {/* El título se fue (pedido de Martín): en su lugar manda el selector. Queda para el lector de pantalla. */}
          <h1 className="of-sr">Offer</h1>
          <SelectorFunnel arbol={arbol} sesion={sesion} ocupado={cambiando || gen.corriendo} onElegir={elegir} />
          {cambiando && <span role="status" aria-label="Abriendo" style={{ display: 'inline-flex', color: 'var(--dim)' }}><Spinner size={18} /></span>}
        </header>
      )}

      {/* Sin conversación, la bienvenida ya lo dice con su botón; con una abierta, el aviso de arriba. */}
      {!arranque && !arbolLeido && sesion && (
        <div style={{ flex: 'none', marginBottom: 12 }}>
          <Banner tono="warn" accion={{ label: 'Volver a cargar', onClick: () => void recargarArbol() }}>No cargaron tus funnels.</Banner>
        </div>
      )}
      {errorSelector && (
        <div style={{ flex: 'none', marginBottom: 12 }}>
          {/* En el arranque no hay selector para volver a pedirla: si abrir la conversación falló, el
              reintento va acá (sin él, el composer quedaba muerto sin decir nada). */}
          <Banner tono="bad" onCerrar={() => setErrorSelector(null)}
            accion={arranque && funnelArranque != null && !sesion
              ? { label: 'Reintentar', onClick: () => { setErrorSelector(null); void nuevaSesion(funnelArranque, null); } }
              : undefined}>
            {errorSelector}
          </Banner>
        </div>
      )}

      {!visible && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', maxWidth: 420 }}>
            <AvatarMako size={56} />
            {bienvenida === 'no-cargo' && (
              <>
                <p style={{ margin: 0, fontSize: 'var(--fs-card)', lineHeight: 1.5, color: 'var(--ink)' }}>No cargaron tus funnels.</p>
                <Button variant="primary" loading={recargando} onClick={() => void recargarArbol()}>Volver a cargar</Button>
              </>
            )}
            {bienvenida === 'sin-funnels' && (
              <>
                <p style={{ margin: 0, fontSize: 'var(--fs-card)', lineHeight: 1.5, color: 'var(--ink)' }}>Para empezar, crea un funnel en el CRM.</p>
                <ButtonLink href="/crm" variant="primary">Ir al CRM</ButtonLink>
              </>
            )}
            {bienvenida === 'elegir' && (
              <p style={{ margin: 0, fontSize: 'var(--fs-card)', lineHeight: 1.5, color: 'var(--ink)' }}>Elige un funnel arriba para crear o analizar una oferta.</p>
            )}
          </div>
        </div>
      )}

      {visible && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {conRiel && sesion && <BarraPiezasMovil piezas={sesion.piezas} acciones={acciones} />}
            <ChatOffer
              sesion={visible}
              pendiente={pendiente}
              respondiendo={respondiendo || !!arranque?.ocupado}
              fuente={fuente}
              opcionArmar={opcionArmar}
              opcionActualizar={opcionActualizar}
              opcionesHabilitadas={opcionesHabilitadas}
              onOpcion={alElegirOpcion}
              onReintentar={sinContestar ? () => void reintentarRespuesta() : null}
              texto={texto}
              onTexto={setTexto}
              onEnviar={() => void enviarComposer()}
              ocupado={ocupado}
              vista={vistaAdjuntos}
              onArchivos={agregarArchivos}
              onAudio={mandarAudio}
              audioEnEspera={audioEnEspera ? { url: audioEnEspera.url, secs: audioEnEspera.secs } : null}
              onReenviarAudio={reenviarAudio}
              onDescartarAudio={descartarAudio}
              error={errorChat}
              onError={setErrorChat}
              armando={armandoEnChat}
              onVerOferta={conclusion ? verOferta : null}
              avatar={arranque?.avatar}
              extra={arranque?.extra}
              soloTexto={!!arranque?.manda}
              placeholder={arranque?.placeholder}
              errorExtra={arranque?.errorExtra}
            />
          </div>
          {conRiel && sesion && <RielPiezas piezas={sesion.piezas} acciones={acciones} />}
        </div>
      )}

      {/* La oferta, en su ventana ENCIMA del chat: cerrarla vuelve a la conversación tal como estaba.
          La key la remonta con cada versión nueva (vuelve a abrir en «Diagnóstico»). */}
      {sesion && conclusion && verConclusion && (
        <Modal titulo="Tu oferta" ancho={860} onCerrar={() => setVerConclusion(false)}>
          <Conclusion
            key={`${sesion.id}-${conclusion.version}`}
            sesion={sesion}
            conclusion={conclusion}
            onSeguir={() => setVerConclusion(false)}
            onGuardar={guardarOferta}
            conProbar={!arranque}
          />
        </Modal>
      )}
    </div>
  );
}
