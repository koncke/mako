'use client';

// =============================================================================
// /m/offer — la franja de abajo: «Tu oferta» y el composer [+] [mensaje] [mic | enviar]
// =============================================================================
// El mismo dibujo que el composer del chat de MaKo del teléfono (app/m/mako/Composer.tsx: el «+», el campo
// redondo de 1 a 5 líneas, el círculo del mic que pasa a la flecha de enviar) con el COMPORTAMIENTO de
// escritorio (app/offer/ChatOffer.tsx), que es otro:
//   · el «+» abre «Adjuntar» con lo que ofrece el clip de escritorio: «Foto o video» y «Documento». Elegir
//     sólo JUNTA (la vista previa de WhatsApp la abre OfferM); recién Enviar sube y lee. Sin el tope de 4 MB
//     de MaKo: acá un archivo va directo a Storage (hasta 25 MB) y se lee con 'leer', como en escritorio;
//   · el mic GRABA UNA NOTA DE VOZ (no dicta): tocar empieza, y la barra queda [tacho] cronómetro
//     [Enviar audio]. La nota se sube como audio y el servidor la transcribe y la guarda (se vuelve a
//     escuchar), igual que en escritorio. Una que no salió vuelve acá para reintentar o tirarla.
//
// ⚠️ ES `position: fixed` Y VA POR PORTAL A #m-pie (lo monta OfferM): adentro de la página se correría con
//    el tirar-para-refrescar (PantallaM le pone `transform`) — LEEME §4.
// ⚠️ EL TECLADO DE iOS no achica el layout: con el campo enfocado, la franja se corre lo que mide el teclado
//    (`altoTeclado`, la misma cuenta del composer de MaKo). Android lo hace solo (`resizes-content`).
// ⚠️ Avisa su alto (con el teclado) para que el hilo deje ese lugar al final.
// =============================================================================

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Icon } from '@/app/_components/icons';
import { Button } from '@/app/_ui/Button';
import { useVoiceRecorder } from '@/app/whatsapp/_shared/VoiceRecorder';
import { ACCEPT_IMPORTAR, EXT_POR_FAMILIA } from '@/lib/formatos-archivo';
import { haptico } from '@/lib/haptico';
import { FilaM, ListaM, SheetM } from '@/app/m/_ui';
import { IconoChat } from '@/app/m/mako/iconos';
import { altoTeclado, duracion } from '@/app/m/mako/chat-ui';
import { ROTULOS } from './modelo';

const ACCEPT_FOTO = [...EXT_POR_FAMILIA.imagen, ...EXT_POR_FAMILIA.video].map((e) => `.${e}`).join(',');
/** El del campo de escritorio (ComposerWhatsApp). */
const PLACEHOLDER = 'Escribe un mensaje…';

export type AudioEnEspera = { url: string; secs: number };

export function ComposerOfferM({
  arriba, texto, onTexto, onEnviar, ocupado, enLinea, onArchivos, puedeAdjuntar, onAudio, audioEnEspera,
  onReenviarAudio, onDescartarAudio, onError, onAltura,
}: {
  /** Lo que va pegado arriba del composer, adentro de la misma franja («Tu oferta», el error del chat). */
  arriba?: ReactNode;
  texto: string;
  onTexto: (v: string) => void;
  onEnviar: () => void;
  /** MaKo contesta, se lee un archivo, se arma la oferta o se cambia de conversación: los botones se apagan (el campo no). */
  ocupado: boolean;
  enLinea: boolean;
  /** El clip junta en la vista previa (no sube ni lee). */
  onArchivos: (fs: File[]) => void;
  /** Con la vista previa llena, el «+» se apaga (la vista tiene el suyo). */
  puedeAdjuntar: boolean;
  /** La nota de voz terminada (Enviar audio). */
  onAudio: (blob: Blob, secs: number) => void;
  /** Una nota que NO salió (se cortó la subida): vuelve para reintentar o descartar. */
  audioEnEspera: AudioEnEspera | null;
  onReenviarAudio: () => void;
  onDescartarAudio: () => void;
  onError: (m: string) => void;
  onAltura: (px: number) => void;
}) {
  const [hojaAdjuntar, setHojaAdjuntar] = useState(false);
  const [enfocado, setEnfocado] = useState(false);
  const [teclado, setTeclado] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const inFoto = useRef<HTMLInputElement>(null);
  const inDoc = useRef<HTMLInputElement>(null);

  const nota = useVoiceRecorder(onAudio, (m) => { onError(m); haptico('error'); });
  const grabando = nota.recording;

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

  // El alto del campo sigue al texto (también cuando lo cambia otro: volver de la vista previa, un envío que no salió).
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = 'auto';
    // 5 líneas de 16 px × 1.4 + el padding: después scrollea adentro.
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
    // También al volver de grabar: el campo se desmontó y renace con una línea.
  }, [texto, grabando, audioEnEspera]);

  const elegidos = (e: ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files ?? []);
    // Se vacía para que elegir el MISMO archivo otra vez vuelva a disparar el cambio.
    e.target.value = '';
    if (fs.length) onArchivos(fs);
  };
  const elegir = (cual: 'foto' | 'doc') => {
    // El click al input va DENTRO del gesto: fuera de él el navegador no abre el selector.
    (cual === 'foto' ? inFoto : inDoc).current?.click();
    setHojaAdjuntar(false);
  };

  const hayTexto = texto.trim().length > 0;
  const puedeEnviar = hayTexto && !ocupado && enLinea;
  const micApagado = ocupado || !enLinea;

  const empezarNota = () => {
    if (micApagado || grabando) return;
    haptico('medium');
    void nota.start();
  };

  return (
    <div ref={raiz} className="m-offer-dock" data-teclado={teclado ? '' : undefined}
      style={teclado ? { transform: `translateY(${-teclado}px)` } : undefined}>
      {arriba}
      {!enLinea && <p className="m-offer-dock__aviso" role="status">Sin conexión: no se puede enviar.</p>}

      {audioEnEspera && !grabando ? (
        <div className="m-offer-dock__fila">
          <button type="button" className="m-offer-circulo" aria-label="Descartar la nota de voz" onClick={onDescartarAudio}>
            <Icon name="trash" size={22} />
          </button>
          <NotaEnEspera url={audioEnEspera.url} secs={audioEnEspera.secs} />
          <Button variant="primary" size="md" disabled={micApagado} onClick={onReenviarAudio}>{ROTULOS.enviarAudio}</Button>
        </div>
      ) : grabando ? (
        <div className="m-offer-dock__fila">
          <button type="button" className="m-offer-circulo" aria-label="Descartar la nota de voz" onClick={() => nota.stop(true)}>
            <Icon name="trash" size={22} />
          </button>
          <div className="m-offer-grabando" aria-live="polite">
            <span className="m-offer-grabando__punto" aria-hidden />
            <span className="m-offer-grabando__tiempo">{duracion(nota.secs)}</span>
          </div>
          <Button variant="primary" size="md" onClick={() => nota.stop(false)}>{ROTULOS.enviarAudio}</Button>
        </div>
      ) : (
        <div className="m-offer-dock__fila">
          <button type="button" className="m-offer-circulo" aria-label="Adjuntar una foto o un documento"
            disabled={!enLinea || !puedeAdjuntar} onClick={() => { setEnfocado(false); setHojaAdjuntar(true); }}>
            <IconoChat nombre="mas" size={22} />
          </button>
          <textarea
            ref={campo}
            className="m-offer-campo"
            rows={1}
            aria-label="Mensaje para MaKo"
            placeholder={PLACEHOLDER}
            value={texto}
            onChange={(e) => onTexto(e.target.value)}
            onFocus={() => setEnfocado(true)}
            onBlur={() => {
              // Tocar un botón de la franja no cuenta como salir.
              window.setTimeout(() => { if (!raiz.current?.contains(document.activeElement)) setEnfocado(false); }, 0);
            }}
          />
          {hayTexto ? (
            <button type="button" className="m-offer-circulo m-offer-circulo--enviar" aria-label="Enviar a MaKo"
              disabled={!puedeEnviar}
              // Que el toque no le saque el foco al campo: el teclado queda abierto.
              onPointerDown={(e) => e.preventDefault()}
              onClick={onEnviar}>
              <Icon name="flecha" size={22} />
            </button>
          ) : (
            <button type="button" className="m-offer-circulo m-offer-mic" aria-label="Grabar una nota de voz"
              disabled={micApagado} onClick={empezarNota}>
              <Icon name="mic" size={22} />
            </button>
          )}
        </div>
      )}

      <input ref={inFoto} type="file" multiple accept={ACCEPT_FOTO} hidden onChange={elegidos} />
      <input ref={inDoc} type="file" multiple accept={ACCEPT_IMPORTAR} hidden onChange={elegidos} />

      <SheetM abierto={hojaAdjuntar} onCerrar={() => setHojaAdjuntar(false)} titulo="Adjuntar" id="adjuntar" snap="medio">
        <ListaM>
          <FilaM navegacion chevron={false} titulo={ROTULOS.fotoVideo}
            leading={<span className="m-offer-opcion-ico"><IconoChat nombre="foto" size={18} /></span>}
            onClick={() => elegir('foto')} />
          <FilaM navegacion chevron={false} titulo={ROTULOS.documento}
            leading={<span className="m-offer-opcion-ico"><IconoChat nombre="archivo" size={18} /></span>}
            onClick={() => elegir('doc')} />
        </ListaM>
      </SheetM>
    </div>
  );
}

/** La nota que no salió: se puede escuchar antes de reenviarla. */
function NotaEnEspera({ url, secs }: { url: string; secs: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [sonando, setSonando] = useState(false);
  return (
    <div className="m-offer-grabando">
      <button type="button" className="m-offer-voz__play m-offer-voz__play--claro" aria-label={sonando ? 'Pausar la nota de voz' : 'Escuchar la nota de voz'}
        onClick={() => { const a = audio.current; if (!a) return; if (a.paused) void a.play(); else a.pause(); }}>
        <Icon name={sonando ? 'pausa' : 'play'} size={18} />
      </button>
      <span className="m-offer-grabando__tiempo">{duracion(secs)}</span>
      <audio ref={audio} src={url} preload="metadata" onPlay={() => setSonando(true)} onPause={() => setSonando(false)} onEnded={() => setSonando(false)} />
    </div>
  );
}
