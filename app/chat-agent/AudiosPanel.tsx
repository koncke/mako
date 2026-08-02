'use client';

// =============================================================================
// AudiosPanel — biblioteca de notas de voz del dueño (tab /setting)
// =============================================================================
// La reunión del 31/07 definió que el setting se hace con AUDIOS grabados por
// el dueño con su propia voz, estandarizados. Acá los graba (mismo grabador del
// inbox: useVoiceRecorder + blobToMp3), los escucha y los borra. Al subir, el
// server los transcribe (STT barato) para que MaKo sepa qué dicen.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useVoiceRecorder, VoiceRecorderBar } from '../whatsapp/_shared/VoiceRecorder';
import { IconMic, IconTrash } from '../whatsapp/_shared/composer-icons';
import type { AudioSetting } from './ChatAgentApp';

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13.5, fontFamily: "'Geist', sans-serif", outline: 'none' };
const btnDark: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--ink)', color: 'var(--on-sidebar)', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' };

async function blobABase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < buf.length; i += CH) bin += String.fromCharCode(...buf.subarray(i, i + CH));
  return btoa(bin);
}

export function AudiosPanel({ audios, onCambio }: { audios: AudioSetting[]; onCambio: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [pend, setPend] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fase, setFase] = useState<string | null>(null);

  useEffect(() => {
    if (!pend) { setUrl(null); return; }
    const u = URL.createObjectURL(pend);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [pend]);

  // Al terminar de grabar NO se sube: queda para escucharlo antes (patrón del inbox).
  const guardarPend = useCallback(async (blob: Blob) => { setPend(blob); }, []);
  const voz = useVoiceRecorder(guardarPend, setErr);

  async function subir() {
    if (!pend || busy) return;
    setBusy(true); setErr(null); setFase('Procesando audio…');
    try {
      const { blobToMp3 } = await import('../whatsapp/audio');
      const mp3 = await blobToMp3(pend);
      setFase('Subiendo y transcribiendo…');
      const r = await fetch('/api/chat-agent/audios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: titulo.trim() || 'Audio sin título', base64: await blobABase64(mp3), mime: 'audio/mpeg' }),
      });
      const j = await r.json();
      if (!j.ok) { setErr(j.error || 'No se pudo guardar el audio.'); return; }
      setPend(null); setTitulo(''); onCambio();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo procesar el audio.');
    } finally {
      setBusy(false); setFase(null);
    }
  }

  async function borrar(id: number) {
    setErr(null);
    try {
      // /api/setting/ NO existe: quedó de cuando la tab se llamaba /setting. El
      // 404 devolvía HTML, .json() reventaba y el catch mostraba "Sin conexión",
      // así que borrar un audio fallaba en silencio con el mensaje equivocado.
      const j = await (await fetch(`/api/chat-agent/audios?id=${id}`, { method: 'DELETE' })).json();
      if (j.ok) onCambio(); else setErr(j.error || 'No se pudo borrar.');
    } catch { setErr('Sin conexión — vuelve a intentarlo.'); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720 }}>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Graba una nota de voz</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.55, marginBottom: 14 }}>
          Con tu voz, un audio por situación (bienvenida, recordatorio, reactivación). Después lo colgás de un paso de la secuencia de mensajes y sale así, tal cual, a cada lead. MaKo lo transcribe para saber qué dice.
        </div>

        {err && <div style={{ marginBottom: 12, padding: '9px 12px', borderRadius: 9, fontSize: 13, border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)' }}>{err}</div>}

        {voz.recording ? (
          <VoiceRecorderBar paused={voz.paused} secs={voz.secs} sending={busy} onCancel={() => voz.stop(true)} onTogglePause={voz.paused ? voz.resume : voz.pause} onSend={() => voz.stop(false)} />
        ) : pend ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setPend(null)} title="Descartar" style={{ flex: 'none', width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--bad)', cursor: 'pointer' }}><IconTrash /></button>
              {url && <audio controls src={url} style={{ flex: 1, height: 40 }} />}
            </div>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="¿Para qué es? (ej: Bienvenida post-agenda)" style={inp} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => void subir()} disabled={busy} style={{ ...btnDark, opacity: busy ? 0.6 : 1 }}>{busy ? (fase ?? 'Guardando…') : 'Guardar en la biblioteca'}</button>
              <button onClick={() => void voz.start()} disabled={busy} style={{ ...btnDark, background: 'transparent', color: 'var(--dim)', border: '1px solid var(--border-strong)' }}>↻ Regrabar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => void voz.start()} style={{ ...btnDark, display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconMic /> Grabar audio</button>
        )}
      </div>

      <div style={{ ...card, padding: audios.length ? '10px 12px' : '16px 18px' }}>
        {audios.length === 0 ? (
          <div style={{ color: 'var(--faint)', fontSize: 13.5 }}>Todavía no hay audios en la biblioteca.</div>
        ) : audios.map((a) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 6px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ minWidth: 0, flex: '1 1 200px' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{a.titulo}</div>
              {a.transcript && <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }}>🎙 {a.transcript}</div>}
            </div>
            {a.url && <audio controls src={a.url} style={{ height: 34, flex: 'none', maxWidth: 240 }} />}
            <button onClick={() => void borrar(a.id)} title="Borrar audio" style={{ flex: 'none', width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--bad)', cursor: 'pointer' }}><IconTrash /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
