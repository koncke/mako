'use client';

// =============================================================================
// AgenciaTabs — el WhatsApp de MaKo (SuperAdmin): Chat · Plantillas
// =============================================================================
// El estado del canal ("WhatsApp Admin") vive acá como un botón desplegable en la
// barra de tabs (visible en ambas tabs). NO es preview de ningún cliente: es la
// línea propia de MaKo (conexión por QR + chat de sus grupos + plantillas).

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { MakoStar } from '../_components/MakoBrand';
import { PlantillasView } from './PlantillasView';
import { ChatGruposPanel } from './ChatGruposPanel';
import { CanalMaKoPanel } from './CanalMaKoPanel';

type TabKey = 'chat' | 'plantillas';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'chat', label: 'Chat' },
  { key: 'plantillas', label: 'Plantillas' },
];

type Canal = { estado: string; numero: string | null; perfil: string | null; esVozActiva: boolean };
const COLOR: Record<string, string> = { conectado: 'var(--good)', conectando: 'var(--warn)', desconectado: 'var(--faint)', error: 'var(--bad)' };
const CANAL_LABEL: Record<string, string> = { conectado: 'WhatsApp Admin conectado', conectando: 'WhatsApp Admin conectando…', desconectado: 'WhatsApp Admin desconectado', error: 'WhatsApp Admin con error' };

export function AgenciaTabs({ inicial = 'chat' }: { inicial?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(inicial);
  const [canal, setCanal] = useState<Canal | null>(null);
  const [canalOpen, setCanalOpen] = useState(false);

  const cargarCanal = useCallback(async () => {
    try { const j = await (await fetch('/api/admin/mako-canal')).json(); if (j.ok) setCanal(j as Canal); } catch { /* noop */ }
  }, []);
  useEffect(() => { cargarCanal(); }, [cargarCanal]);

  const paneles: Record<TabKey, ReactNode> = {
    chat: <ChatGruposPanel />,
    plantillas: <PlantillasView />,
  };
  const tabBtn = (on: boolean): CSSProperties => ({
    padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--dim)',
    fontSize: 14, fontWeight: on ? 600 : 500, boxShadow: on ? '0 1px 3px rgba(23,21,17,.08)' : 'none',
    fontFamily: 'inherit', height: 40,
  });
  const estado = canal?.estado ?? 'desconectado';

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <MakoStar size={24} color="var(--primary)" />
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>WhatsApp de MaKo</h1>
      </div>

      {/* Barra: tabs a la izquierda + canal (desplegable) a la derecha, misma altura */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, position: 'relative' }}>
        <div style={{ display: 'inline-flex', gap: 4, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
          {TABS.map((t) => (
            <button key={t.key} type="button" style={tabBtn(tab === t.key)} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button type="button" onClick={() => setCanalOpen((v) => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 9, height: 40, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR[estado], flex: 'none' }} />
            {CANAL_LABEL[estado] ?? 'WhatsApp Admin'}
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

      {paneles[tab]}
    </div>
  );
}
