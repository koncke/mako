'use client';

// =============================================================================
// CanalMaKoPanel — conectar/gestionar la línea propia de WhatsApp de MaKo
// =============================================================================
// Muestra el estado del canal (mako_superadmin), el QR para vincular el número
// dedicado, y el toggle para usar esa línea como la voz de MaKo (avisos/grupos).

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
type Estado = 'desconectado' | 'conectando' | 'conectado' | 'error';
type Info = { estado: Estado; numero: string | null; perfil: string | null; esVozActiva: boolean };

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 };
const btn: CSSProperties = { padding: '11px 20px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { ...btn, background: 'transparent', color: 'var(--dim)', border: '1px solid var(--border-strong)' };

const COLOR: Record<Estado, string> = { conectado: 'var(--good)', conectando: 'var(--warn)', desconectado: 'var(--faint)', error: 'var(--bad)' };
const LABEL: Record<Estado, string> = { conectado: 'Conectado', conectando: 'Esperando escaneo…', desconectado: 'Desconectado', error: 'Error' };

export function CanalMaKoPanel() {
  const [info, setInfo] = useState<Info | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/admin/mako-canal')).json(); if (j.ok) setInfo(j as Info); } catch { /* noop */ }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  // Mientras hay QR en pantalla, poleá el estado hasta conectar.
  useEffect(() => {
    if (!qr) return;
    pollRef.current = setInterval(async () => {
      await cargar();
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [qr, cargar]);
  useEffect(() => { if (info?.estado === 'conectado' && qr) { setQr(null); setFlash('¡Conectado! 🎉'); setTimeout(() => setFlash(null), 3000); } }, [info?.estado, qr]);

  const conectar = async () => {
    setBusy(true); setFlash(null);
    try {
      const j = await (await fetch('/api/admin/mako-canal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'conectar' }) })).json();
      if (j.ok && j.qr?.base64) setQr(j.qr.base64.startsWith('data:') ? j.qr.base64 : `data:image/png;base64,${j.qr.base64}`);
      else setFlash(j.error || 'No se pudo generar el QR');
    } finally { setBusy(false); }
  };
  const usarVoz = async (usar: boolean) => {
    setBusy(true);
    try {
      await fetch('/api/admin/mako-canal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'usar', usar }) });
      await cargar(); setFlash(usar ? 'Listo: MaKo ahora habla desde esta línea ✓' : 'MaKo volvió a la línea por defecto');
      setTimeout(() => setFlash(null), 3000);
    } finally { setBusy(false); }
  };
  const desconectar = async () => {
    setBusy(true);
    try { await fetch('/api/admin/mako-canal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'desconectar' }) }); setQr(null); await cargar(); }
    finally { setBusy(false); }
  };

  const estado = info?.estado ?? 'desconectado';

  return (
    <div>
      <p style={{ color: 'var(--dim)', fontSize: 14.5, lineHeight: 1.5, margin: '0 0 20px', maxWidth: 560 }}>
        La línea de WhatsApp propia de MaKo (SuperAdmin), separada del número de tus clientes. Desde acá MaKo te
        manda los avisos, reportes y alertas — sin la ventana de 24h de la API oficial.
      </p>

      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Estado */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR[estado] }} />
            <span style={{ fontWeight: 600, fontSize: 15.5 }}>{LABEL[estado]}</span>
            {info?.numero && <span style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--dim)' }}>· {info.perfil ? `${info.perfil} · ` : ''}+{info.numero}</span>}
          </div>
          {estado === 'conectado' && info?.esVozActiva && (
            <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 11px', borderRadius: 999, background: 'var(--good-bg)', color: 'var(--good)' }}>Voz activa de MaKo</span>
          )}
        </div>

        {/* QR */}
        {qr && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '10px 0' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR para vincular WhatsApp de MaKo" style={{ width: 260, height: 260, borderRadius: 12, border: '1px solid var(--border)' }} />
            <div style={{ fontSize: 13, color: 'var(--dim)', textAlign: 'center', maxWidth: 380, lineHeight: 1.5 }}>
              Abrí WhatsApp en el teléfono <b>dedicado a MaKo</b> → <b>Dispositivos vinculados</b> → <b>Vincular un dispositivo</b> y escaneá este QR.
            </div>
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {estado !== 'conectado' && (
            <button style={{ ...btn, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={conectar}>
              {busy ? 'Generando…' : qr ? 'Regenerar QR' : 'Conectar por QR'}
            </button>
          )}
          {estado === 'conectado' && !info?.esVozActiva && (
            <button style={{ ...btn, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={() => usarVoz(true)}>Usar esta línea como voz de MaKo</button>
          )}
          {estado === 'conectado' && info?.esVozActiva && (
            <button style={{ ...btnGhost, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={() => usarVoz(false)}>Volver a la línea por defecto</button>
          )}
          {estado === 'conectado' && (
            <button style={{ ...btnGhost, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={desconectar}>Desconectar</button>
          )}
          {flash && <span style={{ fontSize: 13.5, fontWeight: 600, color: flash.includes('✓') || flash.includes('🎉') ? 'var(--good)' : 'var(--dim)' }}>{flash}</span>}
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.6 }}>
        Consejo anti-baneo: usá un número <b>exclusivo</b> para MaKo (no tu personal), dejalo un par de días “calentando”
        antes de mandar volumen, y nada de envíos masivos por esta línea. Es solo el canal MaKo ↔ dueño.
      </div>
    </div>
  );
}
