'use client';

// =============================================================================
// Grabador de nota de voz — hook + barra visual, COMPARTIDO entre inboxes.
// Extraído 1:1 del inbox oficial (WhatsAppApp.tsx: startRec/stopRec/pauseRec/
// resumeRec + la barra con waveform) para que el no oficial lo use IDÉNTICO.
// El hook entrega el Blob grabado; el que llama decide el formato/envío (MP3 para
// Chatwoot, webm/opus para Evolution).
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { WAVE_CSS, IconTrash, IconPause, IconPlay, SendArrow } from './composer-icons';

function fmtDur(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

export type VoiceRecorder = {
  recording: boolean; paused: boolean; secs: number;
  start: () => Promise<void>; stop: (cancel: boolean) => void; pause: () => void; resume: () => void;
};

// onSend recibe el Blob grabado (mimeType nativo del navegador) y los SEGUNDOS
// que duró. onError superficia los mensajes (sin micrófono / grabación vacía).
// Libera el micro al desmontar.
export function useVoiceRecorder(onSend: (blob: Blob, secs: number) => void | Promise<void>, onError?: (msg: string) => void): VoiceRecorder {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [secs, setSecs] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelRef = useRef(false);
  const activeRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Espejo de `secs` en un ref: el onstop de abajo resetea el estado a 0 ANTES
  // de entregar el blob, así que quien leyera `secs` desde onSend recibía
  // siempre 0 — por eso duracion_s quedaba nulo en toda la biblioteca de audios.
  const secsRef = useRef(0);

  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  const arrancarTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setSecs((s) => { secsRef.current = s + 1; return s + 1; }), 1000);
  };

  async function start() {
    if (recording || activeRef.current) return;
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { onError?.('No se pudo acceder al micrófono. Revisa los permisos.'); return; }
    let rec: MediaRecorder;
    try { rec = new MediaRecorder(stream); }
    catch { stream.getTracks().forEach((t) => t.stop()); onError?.('Tu navegador no permite grabar audio.'); return; }
    const thisRec = rec;
    streamRef.current = stream;
    chunksRef.current = [];
    cancelRef.current = false;
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      activeRef.current = false;
      stream.getTracks().forEach((t) => t.stop()); // libera el micrófono
      clearTimer();
      const cancelled = cancelRef.current || recRef.current !== thisRec;
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
      if (recRef.current === thisRec) recRef.current = null;
      // La duración se lee ANTES de resetear el contador, y del ref (el estado
      // acá dentro está congelado en el valor que tenía al crear la clausura).
      const dur = secsRef.current;
      setRecording(false); setPaused(false); setSecs(0);
      if (cancelled || !blob.size) { if (!cancelled) onError?.('La grabación quedó vacía, vuelve a intentarlo.'); return; }
      void onSend(blob, dur);
    };
    recRef.current = rec;
    activeRef.current = true;
    rec.start();
    setRecording(true); setPaused(false); setSecs(0); secsRef.current = 0;
    arrancarTimer();
  }

  function stop(cancel: boolean) {
    cancelRef.current = cancel;
    clearTimer();
    try { recRef.current?.stop(); } catch { /* ya estaba parado */ }
  }
  function pause() {
    try { recRef.current?.pause(); } catch { /* noop */ }
    clearTimer();
    setPaused(true);
  }
  function resume() {
    try { recRef.current?.resume(); } catch { /* noop */ }
    arrancarTimer();
    setPaused(false);
  }

  useEffect(() => () => {
    clearTimer();
    try { recRef.current?.stop(); } catch { /* noop */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  return { recording, paused, secs, start, stop, pause, resume };
}

// Barra de grabación idéntica a la del oficial: papelera, punto rojo, timer,
// waveform de 24 barras, pausa/play, enviar.
export function VoiceRecorderBar({ paused, secs, sending, onCancel, onTogglePause, onSend }: {
  paused: boolean; secs: number; sending: boolean;
  onCancel: () => void; onTogglePause: () => void; onSend: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
      <style>{WAVE_CSS}</style>
      <button onClick={onCancel} title="Eliminar grabación" aria-label="Eliminar grabación" style={{ flex: 'none', width: '38px', height: '38px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--bad)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconTrash /></button>
      <span style={{ flex: 'none', width: '9px', height: '9px', borderRadius: '50%', background: '#e53935', animation: paused ? 'none' : 'mako-blink 1s steps(1) infinite', opacity: paused ? 0.4 : 1 }}></span>
      <span style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', fontSize: '14px', color: 'var(--ink)', minWidth: '42px', textAlign: 'right' }}>{fmtDur(secs)}</span>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '2px', height: '24px', width: '120px', overflow: 'hidden' }}>
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} style={{ flex: 'none', width: '3px', height: '20px', borderRadius: '2px', background: 'var(--good)', transformOrigin: 'center', animation: 'mako-wave .7s ease-in-out infinite alternate', animationDelay: `${(i % 11) * 0.06}s`, animationPlayState: paused ? 'paused' : 'running' }}></span>
        ))}
      </div>
      <button onClick={onTogglePause} title={paused ? 'Reanudar' : 'Pausar'} aria-label={paused ? 'Reanudar grabación' : 'Pausar grabación'} style={{ flex: 'none', width: '38px', height: '38px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{paused ? <IconPlay /> : <IconPause />}</button>
      <button onClick={onSend} disabled={sending} title="Enviar audio" aria-label="Enviar audio" style={{ flex: 'none', width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: 'var(--good)', color: '#fff', cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SendArrow /></button>
    </div>
  );
}
