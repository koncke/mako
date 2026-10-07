'use client';

// =============================================================================
// AgenciaTabs — el WhatsApp de MaKo (SuperAdmin)
// =============================================================================
// El canal propio de MaKo: su línea por QR + el chat de sus grupos. NO es
// preview de ningún cliente.
//
// Ya no hay tabs: las plantillas se mudaron a /mensajes, que tiene lugar propio
// en la barra. Quedó una sola vista, así que la barra de tabs se fue con ellas
// — una tab sola es un rótulo que no lleva a ningún lado.

import { useCallback, useEffect, useState } from 'react';
import { MakoStar } from '../_components/MakoBrand';
import { ChatGruposPanel } from './ChatGruposPanel';
import { CanalMaKoPanel } from './CanalMaKoPanel';

type Canal = { estado: string; numero: string | null; perfil: string | null; esVozActiva: boolean | null };
const COLOR: Record<string, string> = { conectado: 'var(--good)', conectando: 'var(--warn)', sin_confirmar: 'var(--warn)', desconectado: 'var(--faint)', error: 'var(--bad)' };
const CANAL_LABEL: Record<string, string> = { conectado: 'WhatsApp Admin conectado', conectando: 'WhatsApp Admin conectando…', sin_confirmar: 'WhatsApp Admin sin confirmar', desconectado: 'WhatsApp Admin desconectado', error: 'WhatsApp Admin con error' };

export function AgenciaTabs() {
  const [canal, setCanal] = useState<Canal | null>(null);
  const [canalOpen, setCanalOpen] = useState(false);

  const cargarCanal = useCallback(async () => {
    // Sólo el canal: el chip no necesita sondear el número nuevo ni el tuyo.
    try { const j = await (await fetch('/api/admin/mako-canal?parte=canal')).json(); if (j.ok) setCanal(j as Canal); } catch { /* noop */ }
  }, []);
  useEffect(() => { cargarCanal(); }, [cargarCanal]);

  // `?canal=1` abre el panel de la línea: es a donde llevan la alerta de la voz caída y el
  // mail del vigilante. Sin esto el botón «Reconectar ahora» caía en una pantalla con el
  // panel escondido detrás de un chip (revisión del 11/09/2026).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('canal') === '1') setCanalOpen(true);
  }, []);

  const estado = canal?.estado ?? 'desconectado';

  return (
    <div style={{ width: '100%', maxWidth: 1080, margin: '0 auto', flex: 1, minWidth: 0, padding: '28px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <MakoStar size={24} color="var(--primary)" />
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>WhatsApp de MaKo</h1>
      </div>

      {/* El estado del canal, a la derecha */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, position: 'relative' }}>
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button type="button" onClick={() => setCanalOpen((v) => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 9, height: 40, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {canal === null ? (
              <>
                <style>{'@keyframes mako-pulse{0%,100%{opacity:.35}50%{opacity:1}}'}</style>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--faint)', flex: 'none', animation: 'mako-pulse 1.1s infinite' }} />
                WhatsApp Admin…
              </>
            ) : (
              <>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR[estado] ?? 'var(--faint)', flex: 'none' }} />
                {CANAL_LABEL[estado] ?? 'WhatsApp Admin'}
              </>
            )}
            <span style={{ color: 'var(--faint)', fontSize: 11, transform: canalOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
          </button>
          {canalOpen && (
            <>
              <div onClick={() => setCanalOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 41, width: 460, maxWidth: '90vw', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 14, boxShadow: '0 18px 44px rgba(23,21,17,.24)', padding: 18 }}>
                <CanalMaKoPanel onCambio={cargarCanal} />
              </div>
            </>
          )}
        </div>
      </div>

      <ChatGruposPanel />
    </div>
  );
}
