'use client';

// =============================================================================
// /m/offer — el hilo: los mensajes con MaKo, el PDF de cada versión y las respuestas rápidas
// =============================================================================
// El dibujo es el del chat de MaKo del teléfono (app/m/mako/ChatMako.tsx: tu burbuja azul llena, la de MaKo
// en --surface con borde, sin hora debajo ni la estrella en cada mensaje); lo que se dibuja es lo de
// escritorio (app/offer/ChatOffer.tsx):
//   · MaKo escribe Markdown (negrita, listas): su texto va por el <Markdown> de la casa, el mismo de escritorio;
//   · después de cada armado MaKo manda el PDF de ESA versión (`pdf: { version }`): un documento de WhatsApp
//     adentro de su burbuja, que baja esa versión (la v1 sigue bajando la v1 aunque exista la v3);
//   · los archivos que viajaron con un mensaje, adentro de su burbuja; una nota de voz, con su reproductor y
//     la transcripción debajo (lo que MaKo leyó);
//   · las respuestas rápidas cuelgan del último mensaje de MaKo; la que arma la oferta va en dorado;
//   · en una pregunta de varias (`varias`), cada opción se marca y «Enviar (N)» las manda juntas. Lo marcado cuelga
//     del id del mensaje: con el mensaje siguiente arranca vacío solo, sin un efecto que lo limpie.
//
// ⚠️ El `<audio src>` de una nota lleva el `?ws=` de la pestaña (`conWs`): no es un fetch, el parche de
//    WsFetch no lo toca, y sin él el super admin que mira a un cliente recibe 403 (lib/offer-marco.ts).
// ⚠️ La descarga del PDF va por `descargarPdf` de escritorio (fetch, no un link): un 403 o un 404 se dice en
//    el chat en vez de bajar un JSON con nombre de PDF.
// =============================================================================

import { useRef, useState } from 'react';
import { Icon } from '@/app/_components/icons';
import { Markdown } from '@/app/_components/Markdown';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { GRAMATICA } from '@/lib/mako-gramatica';
import { familiaDeArchivo } from '@/lib/formatos-archivo';
import type { AdjuntoVista, OfferMensaje } from '@/lib/offer-marco';
import { nombrePdfVersion } from '@/app/offer/ayudas';
import { descargarPdf, mensajeDeError } from '@/app/offer/offer-api';
import { IconoChat } from '@/app/m/mako/iconos';
import { duracion } from '@/app/m/mako/chat-ui';
import { ROTULOS, alternarMarcada, versionDelPdf, type OpcionRapida } from './modelo';

export function HiloOfferM({
  sesionId, mensajes, pendiente, respondiendo, fuente, opciones, opcionesHabilitadas, onOpcion, onVarias, onReintentar, onError,
}: {
  sesionId: number;
  mensajes: readonly OfferMensaje[];
  /** El mensaje tuyo ya dibujado mientras MaKo contesta (optimista). */
  pendiente: OfferMensaje | null;
  respondiendo: boolean;
  /** Qué está leyendo MaKo («tu respuesta», «tu audio», «2 archivos»). */
  fuente: string;
  opciones: OpcionRapida[];
  /** Falso mientras MaKo contesta o se lee un archivo: un toque ahí mandaría a medias. */
  opcionesHabilitadas: boolean;
  onOpcion: (idx: number) => void;
  /** Las marcadas de una pregunta de varias, en el orden en que están: salen como UNA respuesta. */
  onVarias: (idxs: number[]) => void;
  /** «Reintentar» la respuesta al último mensaje; null = no hay nada sin contestar. */
  onReintentar: (() => void) | null;
  onError: (m: string) => void;
}) {
  const ws = useWs();
  const [marcadas, setMarcadas] = useState<{ de: string; idxs: number[] }>({ de: '', idxs: [] });
  const ultimoId = mensajes[mensajes.length - 1]?.id ?? '';
  const varias = opciones.some((o) => o.marcable);
  const marcadasAhora = varias && marcadas.de === ultimoId ? marcadas.idxs : [];
  const tocar = (o: OpcionRapida) => {
    if (!o.marcable) { onOpcion(o.idx); return; }
    setMarcadas({ de: ultimoId, idxs: alternarMarcada(marcadasAhora, o.idx) });
  };
  return (
    <ol className="m-offer-hilo" aria-label="Conversación con MaKo">
      {mensajes.map((m) => <Mensaje key={m.id} m={m} sesionId={sesionId} ws={ws} onError={onError} />)}
      {pendiente && <Mensaje m={pendiente} sesionId={sesionId} ws={ws} onError={onError} enviando />}
      {respondiendo && (
        <li className="m-offer-msg m-offer-msg--mk" role="status" aria-live="polite">
          <div className="m-offer-burbuja m-offer-trabajo">
            <span className="m-offer-trabajo__rotulo">{GRAMATICA.analizando.rotulo} · {fuente}</span>
            <span className="m-offer-trabajo__barra" aria-hidden><i /></span>
          </div>
        </li>
      )}
      {onReintentar && (
        <li className="m-offer-falla" role="status">
          {ROTULOS.noContesto} <button type="button" onClick={onReintentar}>Reintentar la respuesta</button>
        </li>
      )}
      {opciones.length > 0 && (
        <li className="m-offer-opciones" role="group" aria-label={varias ? 'Respuestas rápidas: puedes marcar varias' : 'Respuestas rápidas'}>
          {varias && <span className="m-offer-opciones__ayuda">{ROTULOS.marcarVarias}</span>}
          {opciones.map((o) => {
            const marcada = o.marcable && marcadasAhora.includes(o.idx);
            return (
              <button key={`${o.idx}-${o.t}`} type="button"
                className={`m-offer-opcion${o.armar ? ' m-offer-opcion--mako' : ''}${marcada ? ' m-offer-opcion--marcada' : ''}`}
                disabled={!opcionesHabilitadas} onClick={() => tocar(o)} {...(o.marcable ? { 'aria-pressed': marcada } : {})}>
                {o.armar && <Icon name="mako" size={16} />}
                {marcada && <Icon name="check" size={16} />}
                {o.t}
              </button>
            );
          })}
          {marcadasAhora.length > 0 && (
            <button type="button" className="m-offer-enviar" disabled={!opcionesHabilitadas}
              onClick={() => { onVarias(marcadasAhora); setMarcadas({ de: '', idxs: [] }); }}>
              Enviar ({marcadasAhora.length})
            </button>
          )}
        </li>
      )}
    </ol>
  );
}

function Mensaje({ m, sesionId, ws, onError, enviando = false }: {
  m: OfferMensaje; sesionId: number; ws: number | null; onError: (msg: string) => void; enviando?: boolean;
}) {
  const tuyo = m.de === 'yo';
  const version = tuyo ? null : versionDelPdf(m);
  const texto = m.texto.trim();
  return (
    <li className={`m-offer-msg ${tuyo ? 'm-offer-msg--yo' : 'm-offer-msg--mk'}`} data-estado={enviando ? 'enviando' : undefined}>
      <div className="m-offer-burbuja">
        {version != null && <DocumentoPdf sesionId={sesionId} version={version} onError={onError} />}
        {tuyo && !!m.adjuntos?.length && <Adjuntos lista={m.adjuntos} />}
        {/* La pendiente trae su URL `blob:` local; `conWs` sólo le pega el `?ws=` a una ruta de la app. */}
        {m.audio?.url && <NotaDeVoz url={conWs(m.audio.url, ws)} secs={m.audio.secs} />}
        {texto && (m.audio?.url
          ? <div className="m-offer-transcripcion">{texto}</div>
          : tuyo
            ? <div className="m-offer-texto">{m.texto}</div>
            : <div className="m-offer-md"><Markdown text={m.texto} compacto /></div>)}
        {!tuyo && !!m.adjuntos?.length && <Adjuntos lista={m.adjuntos} />}
      </div>
    </li>
  );
}

/** El PDF de una versión, como un documento de WhatsApp adentro de la burbuja de MaKo: tocarlo baja ESA versión. */
function DocumentoPdf({ sesionId, version, onError }: { sesionId: number; version: number; onError: (m: string) => void }) {
  const [bajando, setBajando] = useState(false);
  const bajar = async () => {
    if (bajando) return;
    setBajando(true);
    try { await descargarPdf(sesionId, version); } catch (e) { onError(mensajeDeError(e)); } finally { setBajando(false); }
  };
  return (
    <button type="button" className="m-offer-doc" onClick={() => void bajar()} disabled={bajando} aria-busy={bajando || undefined}
      aria-label={`Descargar el PDF de tu oferta, versión ${version}`}>
      <span className="m-offer-doc__ico" aria-hidden>PDF</span>
      <span className="m-offer-doc__txt">
        <span className="m-offer-doc__nombre">{nombrePdfVersion(version)}</span>
        <span className="m-offer-doc__meta">PDF</span>
      </span>
      <span className="m-offer-doc__ir" aria-hidden>{bajando ? <span className="mk-spin" /> : <Icon name="descargar" size={20} />}</span>
    </button>
  );
}

/** Los archivos que viajaron con un mensaje: el nombre con su ícono y, si quedó a medias, por qué. */
function Adjuntos({ lista }: { lista: readonly AdjuntoVista[] }) {
  return (
    <ul className="m-offer-adjuntos">
      {lista.map((a) => (
        <li key={a.id} className="m-offer-adjunto" data-aviso={a.aviso ? '' : undefined}>
          <span className="m-offer-adjunto__ico" aria-hidden><IconoDeAdjunto nombre={a.nombre} via={a.via} /></span>
          <span className="m-offer-adjunto__txt">
            <span className="m-offer-adjunto__nombre">{a.nombre}</span>
            {a.aviso && <span className="m-offer-adjunto__aviso">{a.aviso}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** El ícono según la familia del archivo (nunca un emoji). La «Transcripción del audio» (`via: 'audio'`), como audio. */
function IconoDeAdjunto({ nombre, via }: { nombre: string; via?: string }) {
  const f = via === 'audio' ? 'audio' : familiaDeArchivo(nombre);
  if (f === 'audio') return <Icon name="sonido" size={16} />;
  if (f === 'video') return <Icon name="video" size={16} />;
  if (f === 'imagen') return <IconoChat nombre="foto" size={16} />;
  return <IconoChat nombre="archivo" size={16} />;
}

function NotaDeVoz({ url, secs }: { url: string; secs: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [sonando, setSonando] = useState(false);
  return (
    <div className="m-offer-voz">
      <button type="button" className="m-offer-voz__play" aria-label={sonando ? 'Pausar la nota de voz' : 'Escuchar la nota de voz'}
        onClick={() => { const a = audio.current; if (!a) return; if (a.paused) void a.play().catch(() => setSonando(false)); else a.pause(); }}>
        <Icon name={sonando ? 'pausa' : 'play'} size={18} />
      </button>
      <span className="m-offer-voz__dur">{duracion(secs)}</span>
      <audio ref={audio} src={url} preload="none" onPlay={() => setSonando(true)} onPause={() => setSonando(false)} onEnded={() => setSonando(false)} />
    </div>
  );
}
