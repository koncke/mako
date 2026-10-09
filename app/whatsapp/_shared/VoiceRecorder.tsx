'use client';

// =============================================================================
// Grabador de nota de voz — hook + barra visual, COMPARTIDO entre inboxes.
// Extraído 1:1 del inbox oficial (WhatsAppApp.tsx: startRec/stopRec/pauseRec/
// resumeRec + la barra con waveform) para que el no oficial lo use IDÉNTICO.
// El hook entrega el Blob grabado; el que llama decide el formato/envío (webm/opus para
// Evolution; el MP3 era para el oficial, Chatwoot, que se borró el 09/10/2026).
// =============================================================================
//
// ⚠️ DESMONTAR A MITAD DE UNA GRABACIÓN NO ENTREGA EL AUDIO (08/10/2026). El cleanup llamaba
// a `stop()` sin marcar la grabación como cancelada, y el `onstop` del MediaRecorder disparaba
// `onSend` igual: cerrar el panel de un mensaje del lienzo o cambiar de nodo a mitad de una
// grabación subía el audio, se lo asignaba al paso y publicaba la secuencia con un `pasos` de un
// render viejo. Ahora el desmontaje CANCELA lo que está grabando; lo que la persona ya terminó
// (apretó la flecha) se entrega aunque el componente se vaya antes de que el navegador lo cierre.
//
// La lógica vive en `crearGrabadorVoz`, sin React, para que un test la pueda EJECUTAR con un
// MediaRecorder falso (tests/composer-whatsapp.test.ts). El hook sólo la envuelve.

import { useEffect, useState, type ReactNode } from 'react';
import { WAVE_CSS, IconTrash, IconPause, IconPlay, SendArrow } from './composer-icons';

function fmtDur(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

export type VoiceRecorder = {
  recording: boolean; paused: boolean; secs: number;
  start: () => Promise<void>; stop: (cancel: boolean) => void; pause: () => void; resume: () => void;
};

export type EstadoGrabacion = { recording: boolean; paused: boolean; secs: number };

/** Lo que el grabador necesita del navegador: se inyecta para poder probarlo sin uno. */
export type EntornoGrabador = {
  pedirMicrofono: () => Promise<MediaStream>;
  crearRecorder: (s: MediaStream) => MediaRecorder;
};

const entornoDelNavegador: EntornoGrabador = {
  pedirMicrofono: () => navigator.mediaDevices.getUserMedia({ audio: true }),
  crearRecorder: (s) => new MediaRecorder(s),
};

export type GrabadorVoz = {
  /** `onSend` y `onError` se pasan EN CADA `start`: los de ese momento (ver el hook). */
  start: (onSend: (blob: Blob, secs: number) => void | Promise<void>, onError?: (msg: string) => void) => Promise<void>;
  stop: (cancel: boolean) => void;
  pause: () => void;
  resume: () => void;
  /** El componente se va: cancela lo que esté GRABANDO y suelta el micrófono. */
  soltar: () => void;
};

/**
 * El grabador, sin React. `alEstado` recibe cada cambio (grabando, pausado, segundos).
 *
 * ⚠️ `soltar` NO es un «muerto para siempre»: en desarrollo, StrictMode monta, desmonta y vuelve
 *    a montar, y un grabador que quedara inservible tras el primer desmontaje no grabaría nunca.
 *    Sólo cancela lo que está en curso.
 */
export function crearGrabadorVoz(alEstado: (e: EstadoGrabacion) => void, entorno: EntornoGrabador = entornoDelNavegador): GrabadorVoz {
  let rec: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let cancelado = false;
  let activo = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  // Los segundos en una variable y no sólo en el estado: el `onstop` resetea el estado a 0 ANTES
  // de entregar el blob, y quien leía `secs` desde onSend recibía siempre 0 (por eso `duracion_s`
  // quedaba nulo en toda la biblioteca de audios).
  let secs = 0;
  let pausado = false;

  const avisar = () => alEstado({ recording: activo, paused: pausado, secs });
  const pararTimer = () => { if (timer) { clearInterval(timer); timer = null; } };
  const arrancarTimer = () => {
    if (timer) return;
    timer = setInterval(() => { secs += 1; avisar(); }, 1000);
  };

  return {
    async start(onSend, onError) {
      if (activo) return;
      let s: MediaStream;
      try { s = await entorno.pedirMicrofono(); }
      catch { onError?.('No se pudo acceder al micrófono. Revisa los permisos.'); return; }
      let r: MediaRecorder;
      try { r = entorno.crearRecorder(s); }
      catch { s.getTracks().forEach((t) => t.stop()); onError?.('Tu navegador no permite grabar audio.'); return; }
      const este = r;
      stream = s;
      chunks = [];
      cancelado = false;
      r.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      r.onstop = () => {
        s.getTracks().forEach((t) => t.stop()); // libera el micrófono
        pararTimer();
        const anulada = cancelado || rec !== este;
        const blob = new Blob(chunks, { type: este.mimeType || 'audio/webm' });
        if (rec === este) rec = null;
        // La duración se lee ANTES de resetear el contador.
        const dur = secs;
        activo = false; pausado = false; secs = 0;
        avisar();
        if (anulada || !blob.size) { if (!anulada) onError?.('La grabación quedó vacía, vuelve a intentarlo.'); return; }
        void onSend(blob, dur);
      };
      rec = r;
      activo = true; pausado = false; secs = 0;
      r.start();
      avisar();
      arrancarTimer();
    },
    stop(cancel) {
      cancelado = cancel;
      pararTimer();
      try { rec?.stop(); } catch { /* ya estaba parado */ }
    },
    pause() {
      try { rec?.pause(); } catch { /* noop */ }
      pararTimer();
      pausado = true;
      avisar();
    },
    resume() {
      try { rec?.resume(); } catch { /* noop */ }
      arrancarTimer();
      pausado = false;
      avisar();
    },
    soltar() {
      pararTimer();
      // GRABANDO (o en pausa) = se cancela. Ya parado por la persona = se deja terminar: el
      // `onstop` todavía no corrió y lo que se entrega es lo que ella pidió mandar.
      if (rec && rec.state !== 'inactive') {
        cancelado = true;
        try { rec.stop(); } catch { /* noop */ }
      }
      stream?.getTracks().forEach((t) => t.stop());
    },
  };
}

// onSend recibe el Blob grabado (mimeType nativo del navegador) y los SEGUNDOS
// que duró. onError superficia los mensajes (sin micrófono / grabación vacía).
// Libera el micro al desmontar, y lo que se estaba grabando se descarta.
export function useVoiceRecorder(onSend: (blob: Blob, secs: number) => void | Promise<void>, onError?: (msg: string) => void): VoiceRecorder {
  const [estado, setEstado] = useState<EstadoGrabacion>({ recording: false, paused: false, secs: 0 });
  // Un grabador por componente, creado UNA vez (estado perezoso, no un ref leído en el render).
  const [grabador] = useState(() => crearGrabadorVoz(setEstado));
  useEffect(() => () => grabador.soltar(), [grabador]);
  return {
    ...estado,
    // `onSend` el de ESTE render, como antes: si la persona cambia de chat a mitad de una
    // grabación, el audio va al chat donde empezó a grabar.
    start: () => grabador.start(onSend, onError),
    stop: grabador.stop,
    pause: grabador.pause,
    resume: grabador.resume,
  };
}

/** El ✓ de «terminar de grabar» cuando el audio no sale todavía (se escucha antes de usarlo). */
export function IconListo() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

// Barra de grabación idéntica a la del oficial: papelera, punto rojo, timer,
// waveform de 24 barras, pausa/play, enviar. `rotuloListo`/`iconoListo`: el botón
// final cuando el audio NO sale al soltarlo (se escucha antes): no es «Enviar».
export function VoiceRecorderBar({ paused, secs, sending, onCancel, onTogglePause, onSend, rotuloListo = 'Enviar audio', iconoListo }: {
  paused: boolean; secs: number; sending: boolean;
  onCancel: () => void; onTogglePause: () => void; onSend: () => void;
  rotuloListo?: string; iconoListo?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
      <style>{WAVE_CSS}</style>
      <button onClick={onCancel} title="Eliminar grabación" aria-label="Eliminar grabación" style={{ flex: 'none', width: '38px', height: '38px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--bad)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconTrash /></button>
      <span style={{ flex: 'none', width: '9px', height: '9px', borderRadius: '50%', background: '#e53935', animation: paused ? 'none' : 'mako-blink 1s steps(1) infinite', opacity: paused ? 0.4 : 1 }}></span>
      <span style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', fontSize: '14px', color: 'var(--ink)', minWidth: '42px', textAlign: 'right' }}>{fmtDur(secs)}</span>
      <div style={{ flex: '0 1 120px', minWidth: 0, display: 'flex', alignItems: 'center', gap: '2px', height: '24px', width: '120px', overflow: 'hidden' }}>
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} style={{ flex: 'none', width: '3px', height: '20px', borderRadius: '2px', background: 'var(--good)', transformOrigin: 'center', animation: 'mako-wave .7s ease-in-out infinite alternate', animationDelay: `${(i % 11) * 0.06}s`, animationPlayState: paused ? 'paused' : 'running' }}></span>
        ))}
      </div>
      <button onClick={onTogglePause} title={paused ? 'Reanudar' : 'Pausar'} aria-label={paused ? 'Reanudar grabación' : 'Pausar grabación'} style={{ flex: 'none', width: '38px', height: '38px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{paused ? <IconPlay /> : <IconPause />}</button>
      <button onClick={onSend} disabled={sending} title={rotuloListo} aria-label={rotuloListo} style={{ flex: 'none', width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: 'var(--good)', color: '#fff', cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{iconoListo ?? <SendArrow />}</button>
    </div>
  );
}
