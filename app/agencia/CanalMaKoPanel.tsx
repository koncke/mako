'use client';

// =============================================================================
// CanalMaKoPanel — conectar/gestionar la línea propia de WhatsApp de MaKo
// =============================================================================
// El WhatsApp que se conecte acá ES, por definición, el canal de MaKo (se fija
// como voz automáticamente al conectar). Sin toggles: conectar / desconectar.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
type Estado = 'desconectado' | 'conectando' | 'conectado' | 'error';
type Info = { estado: Estado; numero: string | null; perfil: string | null; esVozActiva: boolean };

const btn: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: CSSProperties = { ...btn, background: 'transparent', color: 'var(--dim)', border: '1px solid var(--border-strong)' };
const COLOR: Record<Estado, string> = { conectado: 'var(--good)', conectando: 'var(--warn)', desconectado: 'var(--faint)', error: 'var(--bad)' };
const LABEL: Record<Estado, string> = { conectado: 'Conectado', conectando: 'Esperando escaneo…', desconectado: 'Desconectado', error: 'Error' };

export function CanalMaKoPanel({ onCambio }: { onCambio?: () => void } = {}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoVozRef = useRef(false);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/admin/mako-canal')).json(); if (j.ok) setInfo(j as Info); } catch { /* noop */ }
    onCambio?.();
  }, [onCambio]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (!qr) return;
    pollRef.current = setInterval(() => { cargar(); }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [qr, cargar]);
  useEffect(() => { if (info?.estado === 'conectado' && qr) { setQr(null); setFlash('¡Conectado! 🎉'); setTimeout(() => setFlash(null), 3000); } }, [info?.estado, qr]);
  // El WhatsApp conectado ES el canal de MaKo: se fija como voz automáticamente
  // (y agrega el número a todos los grupos), sin toggle manual.
  useEffect(() => {
    if (info?.estado === 'conectado' && !info.esVozActiva && !autoVozRef.current) {
      autoVozRef.current = true;
      fetch('/api/admin/mako-canal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'usar', usar: true }) }).then(() => cargar());
    }
    if (info?.estado !== 'conectado') autoVozRef.current = false;
  }, [info?.estado, info?.esVozActiva, cargar]);

  const conectar = async () => {
    setBusy(true); setFlash(null);
    try {
      const j = await (await fetch('/api/admin/mako-canal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'conectar' }) })).json();
      if (j.ok && j.qr?.base64) setQr(j.qr.base64.startsWith('data:') ? j.qr.base64 : `data:image/png;base64,${j.qr.base64}`);
      else setFlash(j.error || 'No se pudo generar el QR');
    } finally { setBusy(false); }
  };
  const desconectar = async () => {
    setBusy(true);
    try { await fetch('/api/admin/mako-canal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'desconectar' }) }); setQr(null); await cargar(); }
    finally { setBusy(false); }
  };

  if (info === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
        <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
        <span style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTopColor: 'var(--accent-soft)', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
      </div>
    );
  }
  const estado = info.estado;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR[estado], flex: 'none' }} />
        <span style={{ fontWeight: 600, fontSize: 14.5 }}>{LABEL[estado]}</span>
        {info?.numero && <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--dim)' }}>· {info.perfil ? `${info.perfil} · ` : ''}+{info.numero}</span>}
      </div>

      {qr && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR" style={{ width: 240, height: 240, borderRadius: 12, border: '1px solid var(--border)' }} />
          <div style={{ fontSize: 12.5, color: 'var(--dim)', textAlign: 'center', lineHeight: 1.5 }}>
            WhatsApp del teléfono <b>de MaKo</b> → <b>Dispositivos vinculados</b> → <b>Vincular</b> y escaneá.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {estado !== 'conectado' && <button style={{ ...btn, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={conectar}>{busy ? 'Generando…' : qr ? 'Regenerar QR' : 'Conectar por QR'}</button>}
        {estado === 'conectado' && <button style={{ ...btnGhost, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={desconectar}>Desconectar</button>}
        {flash && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--good)' }}>{flash}</span>}
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.5 }}>Usá un número <b>exclusivo</b> para MaKo (no tu personal).</div>
    </div>
  );
}
