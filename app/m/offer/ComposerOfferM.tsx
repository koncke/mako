'use client';

// =============================================================================
// /m/offer — la franja de abajo: «Tu oferta» y la caja única del Ops Center (22/10/2026, OF4)
// =============================================================================
// La caja es la MISMA del Ops Center del teléfono (app/_chat/CajaChat.tsx con la fila de app/m/operaciones: el «+», los
// emojis, el campo que crece y UN botón), con la nota de voz (`voz`): sin nada escrito, el micrófono GRABA (no dicta), con lo
// de O10 («Abriendo el micrófono…», el rojo que late y la onda que sigue el nivel real). Hasta el 22/10 era una caja propia,
// con el composer del chat de MaKo del teléfono.
//   · el «+» trae Documento, Fotos, Cámara y Pegar. Elegir sólo JUNTA: la vista previa a pantalla completa la abre OfferM
//     (la del chat de MaKo, VistaAdjuntosM) y recién Enviar sube y lee. Sin el tope de 4 MB de MaKo: acá un archivo va
//     directo a Storage (hasta 25 MB) y se lee con 'leer', como en la computadora, también el .zip de una carpeta;
//   · la nota de voz tiene los pasos de la computadora (la barra de la grabación de la caja): se termina, se escucha y recién
//     «Enviar audio» la manda. Se sube como audio y el servidor la transcribe y la guarda. Una que no salió vuelve a la barra
//     (`pendiente`) para reintentar o tirarla.
//
// ⚠️ NADA SALE AL SOLTAR (Martín, 09/10, en VoiceRecorder.tsx: «que no se escape nunca un audio indeseado»): la barra de la
//    caja termina, deja escuchar y recién ahí manda. Lo fija tests/m-offer.test.ts.
// ⚠️ La grabación guarda el `onAudio` del micrófono: lo escuchado no viaja a otra conversación porque OfferM monta esto con
//    `key={sesion.id}` (cambiar de conversación lo descarta).
//
// ⚠️ ES `position: fixed` Y VA POR PORTAL A #m-pie (lo monta OfferM): adentro de la página se correría con el
//    tirar-para-refrescar (PantallaM le pone `transform`) — LEEME §4.
// ⚠️ EL TECLADO DE iOS no achica el layout: con el campo enfocado, la franja se corre lo que mide el teclado (`altoTeclado`,
//    la misma cuenta del composer de MaKo). Android lo hace solo (`resizes-content`).
// ⚠️ Avisa su alto (con el teclado) para que el hilo deje ese lugar al final.
// =============================================================================

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CajaChat } from '@/app/_chat/CajaChat';
import type { AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import { ACCEPT_IMPORTAR } from '@/lib/formatos-archivo';
import { haptico } from '@/lib/haptico';
import { altoTeclado } from '@/app/m/mako/chat-ui';
import { ROTULOS } from './modelo';
import '@/app/admin/operaciones/centro.css';
import '@/app/m/operaciones/operaciones.css';

/** Lo que Offer sabe leer, y el .zip de la carpeta de una landing (lo mismo que la computadora: OfferApp → ACCEPT_OFFER). */
const ACCEPT_OFFER = `${ACCEPT_IMPORTAR},.zip`;
const nada = () => {};

export type AudioEnEspera = { url: string; secs: number };

export function ComposerOfferM({
  arriba, texto, onTexto, onEnviar, ocupado, enLinea, onArchivos, puedeAdjuntar, onAudio, audioEnEspera,
  onReenviarAudio, onDescartarAudio, onError, onAltura,
}: {
  /** Lo que va pegado arriba de la caja, adentro de la misma franja («Tu oferta», el error del chat). */
  arriba?: ReactNode;
  texto: string;
  onTexto: (v: string) => void;
  onEnviar: () => void;
  /** MaKo contesta, se lee un archivo, se arma la oferta o se cambia de conversación: el botón gira y no manda (el campo no). */
  ocupado: boolean;
  enLinea: boolean;
  /** El «+» junta en la vista previa (no sube ni lee). */
  onArchivos: (fs: File[]) => void;
  /** Con la vista previa llena, el «+» se apaga (la vista tiene el suyo). */
  puedeAdjuntar: boolean;
  /** La nota de voz ya escuchada (terminar y después «Enviar audio»): nunca al terminar de grabar. */
  onAudio: (blob: Blob, secs: number) => void;
  /** Una nota que NO salió (se cortó la subida): vuelve para reintentar o descartar. */
  audioEnEspera: AudioEnEspera | null;
  onReenviarAudio: () => void;
  onDescartarAudio: () => void;
  onError: (m: string) => void;
  onAltura: (px: number) => void;
}) {
  const [enfocado, setEnfocado] = useState(false);
  const [teclado, setTeclado] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);

  // El teclado de iOS no achica el layout: se corre la franja lo que mide.
  useEffect(() => {
    const vv = window.visualViewport;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!vv || !enfocado) { setTeclado(0); return; }
    const medir = () => setTeclado(altoTeclado(window.innerHeight, vv));
    medir();
    vv.addEventListener('resize', medir);
    vv.addEventListener('scroll', medir);
    return () => { vv.removeEventListener('resize', medir); vv.removeEventListener('scroll', medir); };
  }, [enfocado]);

  // El hilo deja lugar para la franja (y el teclado).
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const avisar = () => onAltura(el.offsetHeight + teclado);
    avisar();
    const ro = new ResizeObserver(avisar);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onAltura, teclado]);

  // Lo elegido en el «+» (o pegado) va a la vista previa a pantalla completa: la caja no muestra miniaturas acá.
  const adjuntos: AdjuntosDeCaja = {
    items: [],
    puede: enLinea && puedeAdjuntar,
    onSumar: onArchivos,
    onQuitar: nada,
    accept: ACCEPT_OFFER,
    onSinImagen: (puedeLeer) => onError(puedeLeer ? 'No hay una imagen copiada.' : 'Este teléfono no deja pegar desde aquí.'),
    onNoPuede: () => onError(enLinea ? 'Ya juntaste el máximo de archivos.' : 'Sin conexión: no se puede enviar.'),
  };
  const errorDeVoz = (m: string) => { onError(m); haptico('error'); };

  return (
    <div ref={raiz} className="m-offer-dock" data-teclado={teclado ? '' : undefined}
      style={teclado ? { transform: `translateY(${-teclado}px)` } : undefined}
      onFocus={(e) => { if (e.target instanceof HTMLTextAreaElement) setEnfocado(true); }}
      onBlur={() => {
        // Tocar un botón de la franja no cuenta como salir.
        window.setTimeout(() => { if (!(document.activeElement instanceof HTMLTextAreaElement && raiz.current?.contains(document.activeElement))) setEnfocado(false); }, 0);
      }}>
      {arriba}
      {!enLinea && <p className="m-offer-dock__aviso" role="status">Sin conexión: no se puede enviar.</p>}
      <div className="m-operaciones-caja">
        {/* La caja ÚNICA, la del teléfono del Ops Center: Enter baja de renglón y se manda con el botón. */}
        <CajaChat texto={texto} onTexto={onTexto} onMandar={() => { if (enLinea) onEnviar(); }} ocupado={ocupado}
          placeholder="Escríbele a MaKo" altoMax={null} fila="m-operaciones-caja__fila" adjuntos={adjuntos} onErrorMic={onError}
          voz={{
            onAudio, onError: errorDeVoz, rotuloEnviar: ROTULOS.enviarAudio, apagada: ocupado || !enLinea,
            pendiente: audioEnEspera ? { url: audioEnEspera.url, secs: audioEnEspera.secs, onBorrar: onDescartarAudio, onDejar: onReenviarAudio } : null,
          }} />
      </div>
    </div>
  );
}
