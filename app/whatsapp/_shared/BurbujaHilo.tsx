'use client';

// =============================================================================
// BurbujaHilo — un mensaje de WhatsApp tal como LLEGA
// =============================================================================
// El render de la burbuja que vivía adentro de ChatHilo (imagen, documento, video, audio con su
// transcripción, texto con las marcas de WhatsApp), sacado para que lo dibujen IGUAL los tres que
// muestran un mensaje: el hilo (ChatHilo: simulador, ensayo, plantillas, grupos de MaKo), la
// tarjeta del mensaje en el lienzo (`compacta`) y la vista previa del editor del mensaje. Con tres
// copias, la del lienzo pintaba el texto crudo (los `*` a la vista) y el audio sin su pie.
//
// ⚠️ EL TEXTO SE PINTA CON SUS MARCAS (`TextoMarcas`). Un mensaje de WhatsApp llega con
//    `*negrita*`, `_itálica_` y `~tachado~`: mostrarlos crudos hace las dos cosas mal — no se ve
//    cómo llega, y los asteriscos se leen como un error de tipeo. Y los `{{tokens}}` salen
//    coloreados, enteros (su guión bajo no abre una itálica).
// ⚠️ UN DOCUMENTO NO PINTA SU TEXTO APARTE: en el espejo de WhatsApp el `texto` de un documento es
//    su NOMBRE, y ChatHilo lo usaba como título del archivo. Quien quiera un caption debajo pasa
//    `nombre` en la media y `texto` aparte.

import type { CSSProperties, ReactNode } from 'react';
import { TextoMarcas } from '@/app/_components/TextoMarcas';
import { AudioPlay } from './AudioPlay';
import { IconClip, IconDoc } from './composer-icons';

export type ContenidoBurbuja = {
  /** El texto, el pie del audio o el caption del archivo. */
  texto?: string;
  audio?: { url: string | null; titulo?: string; transcript?: string | null; duracion_s?: number | null } | null;
  media?: {
    url: string | null; mime: string; nombre?: string | null;
    /** Qué es, si se sabe (el espejo lo trae). Sin esto, sale del `mime`. */
    tipo?: 'image' | 'video' | 'document' | 'sticker';
  } | null;
  /** MaKo lo reescribe para cada lead: la burbuja lo marca. */
  ia?: boolean;
};

export type BurbujaHiloProps = {
  contenido: ContenidoBurbuja;
  /** Saliente (del negocio, a la derecha) o entrante. */
  saliente?: boolean;
  /** Versión chica, para la tarjeta del lienzo. */
  compacta?: boolean;
  /** Firma de la burbuja (el nombre del negocio). */
  autor?: string;
  hora?: string;
  pie?: ReactNode;
  /** El fondo de la burbuja saliente (el acento del canal). Default: el del no oficial. */
  fondo?: string;
  /** Tocar una imagen: el lightbox del hilo. Sin esto (o compacta), la imagen no es un botón. */
  onVerImagen?: (url: string) => void;
  /** Lo que se dibuja cuando no hay nada que mostrar («Sin escribir» en el editor). */
  vacio?: ReactNode;
  /**
   * El tope de ancho de la burbuja. Default: 78% (el hilo) y 100% (la compacta). El editor del lienzo
   * pasa `100%`: ahí el tope lo pone la FILA (los botones de editar y borrar van pegados), y un 78%
   * de una caja que se ajusta a la burbuja dejaba un hueco de un cuarto de fila entre los botones y
   * el mensaje (sexta tanda, WhatsApp 4: «el icono de editar y borrar están muy despegados»).
   */
  maxAncho?: string;
  /** Los renglones del texto en la compacta antes del «…» (default 5). */
  lineas?: number;
};

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

/** El ancho del reproductor en una burbuja normal: en px (ver el comentario del render). */
export const ANCHO_AUDIO = 240;

/** Qué es la media: lo que dice el espejo, y si no, el tipo del archivo. */
export function tipoDeMedia(m: NonNullable<ContenidoBurbuja['media']>): 'image' | 'video' | 'document' | 'sticker' {
  if (m.tipo) return m.tipo;
  const mime = (m.mime || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'document';
}

export function BurbujaHilo({ contenido, saliente = true, compacta = false, autor, hora, pie, fondo, onVerImagen, vacio, maxAncho, lineas = 5 }: BurbujaHiloProps) {
  const { texto, audio, media, ia } = contenido;
  // 240 como en el hilo, pero nunca más que la burbuja: en el editor del lienzo (328 px) una foto
  // de 240 se salía por el costado.
  const ancho = compacta ? '100%' : 'min(240px, 100%)';
  const sep = (hay: boolean) => (hay ? (compacta ? 4 : 6) : 0);
  const tipo = media ? tipoDeMedia(media) : null;
  const esPdf = !!media && ((media.mime || '').includes('pdf') || (media.nombre || '').toLowerCase().endsWith('.pdf'));
  const conTexto = !!texto && tipo !== 'document';
  const nada = !texto && !audio && !media;

  const caja: CSSProperties = {
    maxWidth: maxAncho ?? (compacta ? '100%' : '78%'),
    minWidth: 0,
    padding: compacta ? '8px 10px' : '10px 13px',
    borderRadius: saliente ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
    background: saliente ? (fondo ?? 'var(--wa-noof-bubble)') : 'var(--surface)',
    border: '1px solid ' + (saliente ? 'rgba(91,107,214,.30)' : 'var(--border)'),
    boxShadow: '0 1px 2px rgba(18,21,27,.04)',
    overflow: compacta ? 'hidden' : undefined,
  };

  return (
    <div style={caja}>
      {!saliente && autor && <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--primary-strong)', marginBottom: 2 }}>{autor}</div>}

      {media?.url && (tipo === 'image' || tipo === 'sticker') && (
        onVerImagen && !compacta ? (
          <button type="button" onClick={() => onVerImagen(media.url!)} title="Ver imagen" style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'block', marginBottom: sep(conTexto) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={media.url} alt="adjunto" style={{ maxWidth: ancho, maxHeight: tipo === 'sticker' ? 140 : 280, borderRadius: 10, display: 'block' }} />
          </button>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.url} alt="adjunto" style={{ maxWidth: ancho, maxHeight: compacta ? 120 : 280, borderRadius: compacta ? 8 : 10, display: 'block', marginBottom: sep(conTexto), objectFit: 'cover' }} />
        )
      )}
      {media?.url && tipo === 'video' && (
        compacta
          ? <video src={media.url} muted preload="metadata" style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 8, marginBottom: sep(conTexto), display: 'block' }} />
          : <video controls src={media.url} style={{ maxWidth: ancho, borderRadius: 10, marginBottom: sep(conTexto), display: 'block' }} />
      )}
      {media?.url && tipo === 'document' && (() => {
        const nombre = media.nombre || texto || (esPdf ? 'Documento PDF' : 'Documento');
        const fila = (
          <>
            <span style={{ flex: 'none', color: 'var(--dim)' }}><IconDoc size={compacta ? 18 : 22} /></span>
            <span style={{ minWidth: 0, textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: compacta ? 12 : 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>
              {!compacta && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--primary)' }}>Abrir en pestaña nueva</span>}
            </span>
          </>
        );
        const estilo: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, padding: compacta ? '7px 9px' : '9px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', textDecoration: 'none', maxWidth: ancho, marginBottom: sep(!!media.nombre && !!texto) };
        // En la tarjeta del lienzo, un link se comería el clic que abre el editor.
        return compacta
          ? <div style={estilo}>{fila}</div>
          : <a href={media.url} target="_blank" rel="noreferrer" style={estilo}>{fila}</a>;
      })()}
      {media && !media.url && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--faint)', fontStyle: 'italic', marginBottom: sep(conTexto) }}>
          <IconClip /> {media.nombre || texto || tipo} (no disponible)
        </span>
      )}

      {/* ⚠️ EL ANCHO DEL REPRODUCTOR VA EN PX, NO EN %: la burbuja se ajusta a su contenido, y un
          `min(240px, 100%)` ahí es un porcentaje cíclico que el navegador resolvía a CERO — el audio
          «que no se podía escuchar» (AudioPlay.tsx, la medición). La compacta vive en una tarjeta de
          ancho conocido: ahí sí el 100%. */}
      {audio && (audio.url
        ? <AudioPlay src={audio.url} compacto={compacta} duracion={audio.duracion_s ?? null}
            style={{ width: compacta ? '100%' : ANCHO_AUDIO, maxWidth: '100%', marginBottom: sep(conTexto || !!audio.transcript) }} />
        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--faint)', fontStyle: 'italic', marginBottom: sep(conTexto) }}><IconClip /> {audio.titulo || 'audio'} (no disponible)</span>)}
      {audio?.titulo && audio.url && compacta && (
        <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: sep(conTexto || !!audio.transcript) }}>{audio.titulo}{audio.duracion_s ? ` · ${fmtDur(audio.duracion_s)}` : ''}</div>
      )}
      {audio?.transcript && (
        <div style={{ fontSize: compacta ? 11 : 12, color: 'var(--faint)', lineHeight: 1.45, marginBottom: sep(conTexto) }}>
          Dice: «{audio.transcript.slice(0, compacta ? 90 : 140)}{audio.transcript.length > (compacta ? 90 : 140) ? '…' : ''}»
        </div>
      )}

      {(conTexto || (tipo === 'document' && !!media?.nombre && !!texto)) && (
        <div style={{
          fontSize: compacta ? 12.5 : 14, lineHeight: 1.45, color: 'var(--ink)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
          ...(compacta ? { display: '-webkit-box', WebkitLineClamp: lineas, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}),
        }}><TextoMarcas texto={texto!} /></div>
      )}
      {nada && vacio}

      {(hora || pie || ia) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: saliente ? 'flex-end' : 'flex-start', gap: 5, marginTop: 3 }}>
          {ia && <span title="Lo adapta MaKo para cada persona" aria-label="Lo adapta MaKo" style={{ fontSize: 11, fontWeight: 700, color: 'var(--mako-ink)', marginRight: 'auto' }}>✦</span>}
          {hora && <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{hora}</span>}
          {pie}
        </div>
      )}
    </div>
  );
}
