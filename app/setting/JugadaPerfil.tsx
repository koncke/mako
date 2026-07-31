'use client';

// =============================================================================
// JugadaPerfil — perfil + edición de una jugada (réplica de TemplateDetalleModal)
// =============================================================================
// Cubre TODO el chat (inline, como en SuperAdmin). Explica CÓMO JUEGA (diagrama
// de pasos), deja editar la estrategia (objetivo/gancho/preguntas), activar/
// pausar, abrir el wizard para que MaKo redacte, y probarla DE VERDAD (te llega
// a tu teléfono/mail). Setter = solo lectura (sin botones de escritura).

import { useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import type { JugadaDto, Opcion } from './SettingApp';
import type { Objetivo } from '@/lib/setting-estrategia';

const btn: CSSProperties = { padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: CSSProperties = { ...btn, background: 'transparent', color: 'var(--dim)', border: '1px solid var(--border-strong)' };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13.5, fontFamily: "'Geist', sans-serif", outline: 'none' };

function Paso({ icono, titulo, detalle, tono = 'neutro' }: { icono: string; titulo: string; detalle?: string; tono?: 'neutro' | 'mako' | 'dueno' }) {
  const bg = tono === 'mako' ? 'var(--primary-bg)' : 'var(--surface-2)';
  const bd = tono === 'mako' ? 'var(--primary-weak)' : 'var(--border)';
  return (
    <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 12, background: bg, border: `1px solid ${bd}` }}>
      <span style={{ fontSize: 18, flex: 'none', lineHeight: 1.2 }}>{icono}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{titulo}</div>
        {detalle && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.45 }}>{detalle}</div>}
      </div>
    </div>
  );
}
const Flecha = () => <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--faint)', fontSize: 14, margin: '2px 0' }}>↓</div>;

async function api(body: unknown): Promise<{ ok: boolean; error?: string; enviadosWa?: number; enviadosEmail?: number; avisos?: string[] }> {
  try { return await (await fetch('/api/setting/jugadas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); } catch { return { ok: false, error: 'sin conexión' }; }
}

const EMOJI_OBJ: Record<Objetivo, string> = { agendar: '📅', reactivar: '🧲', cualificar: '❓', confirmar_pago: '💳' };

export function JugadaPerfil({ jugada, objetivos, etiquetaEtapa, rolAdmin, onClose, onCambio, onWizard }: {
  jugada: JugadaDto;
  objetivos: Opcion[];
  etiquetaEtapa: (key: string) => string;
  rolAdmin: boolean;
  onClose: () => void;
  onCambio: () => void;
  onWizard: () => void;
}) {
  const est = jugada.estrategia;
  const [objetivo, setObjetivo] = useState<Objetivo>(est?.objetivo ?? 'agendar');
  const [gancho, setGancho] = useState(est?.gancho ?? '');
  const [preguntas, setPreguntas] = useState((est?.preguntas ?? []).join('\n'));
  const [activa, setActiva] = useState(jugada.activa);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const flashOk = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 2600); };

  const guardar = async () => {
    setBusy('save'); setErr(null);
    const r = await api({
      action: 'guardar-estrategia', secuenciaId: jugada.id,
      estrategia: {
        objetivo, gancho: gancho.trim() || null, lead_magnet_id: est?.lead_magnet_id ?? null,
        preguntas: preguntas.split('\n').map((p) => p.trim()).filter(Boolean),
        notas: est?.notas ?? null, probada_at: est?.probada_at ?? null,
      },
    });
    if (r.ok) { flashOk('Guardado ✓'); onCambio(); } else setErr(r.error || 'No se pudo guardar.');
    setBusy(null);
  };

  const toggle = async () => {
    setBusy('toggle'); setErr(null);
    try {
      const r = await (await fetch('/api/whatsapp/secuencias', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: jugada.id, activa: !activa }) })).json();
      if (r.ok) { setActiva(!activa); flashOk(!activa ? 'Activada ✓' : 'Pausada ✓'); onCambio(); } else setErr(r.error || 'No se pudo cambiar.');
    } catch { setErr('Sin conexión — probá de nuevo.'); }
    setBusy(null);
  };

  const probar = async () => {
    setBusy('probar'); setErr(null);
    const r = await api({ action: 'probar', secuenciaId: jugada.id });
    if (r.ok) flashOk(`Prueba enviada ✓ (${r.enviadosWa ?? 0} WhatsApp · ${r.enviadosEmail ?? 0} email)${r.avisos?.length ? ` — ${r.avisos[0]}` : ''}`);
    else setErr(r.error || 'La prueba no salió.');
    setBusy(null);
  };

  const nPreg = preguntas.split('\n').filter((p) => p.trim()).length;
  const pasosWa = jugada.pasos.filter((p) => p.canal === 'whatsapp').length;
  const pasosEmail = jugada.pasos.filter((p) => p.canal === 'email').length;

  return (
    <div style={{ height: '100%', width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Topbar fija (no scrollea) — patrón TemplateDetalleModal */}
      <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onClose} title="Volver" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', fontSize: 14, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>← Volver al chat</button>
        {rolAdmin && <button onClick={probar} disabled={busy === 'probar'} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: busy === 'probar' ? 0.5 : 1 }}>{busy === 'probar' ? 'Enviando…' : '📲 Probar de verdad (te llega a vos)'}</button>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>

          <div style={{ display: 'flex', gap: 11, alignItems: 'center', minWidth: 0, marginBottom: 18 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{est ? EMOJI_OBJ[est.objetivo] : '⚑'}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{jugada.nombre}</div>
              <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{etiquetaEtapa(jugada.etapa)} · {pasosWa} WhatsApp · {pasosEmail} email{est?.probada_at ? ' · probada ✓' : ''}</div>
            </div>
            <div style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: activa ? 'var(--good)' : 'var(--dim)' }}>{activa ? 'Activa' : 'Pausada'}</span>
              {rolAdmin && (
                <button onClick={toggle} disabled={busy === 'toggle'} aria-pressed={activa} title={activa ? 'Pausar' : 'Activar'}
                  style={{ width: 42, height: 24, borderRadius: 999, border: 'none', padding: 2, background: activa ? 'var(--good)' : 'var(--border-strong)', cursor: 'pointer', flex: 'none', transition: 'background .15s' }}>
                  <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: activa ? 'translateX(18px)' : 'none', transition: 'transform .15s' }} />
                </button>
              )}
            </div>
          </div>

          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 10 }}>¿Cómo juega?</div>
          <div style={{ marginBottom: 20 }}>
            <Paso icono="⚡" titulo="Se dispara cuando…" detalle={`El lead está parado en la etapa «${etiquetaEtapa(jugada.etapa)}» de tu funnel.`} />
            <Flecha />
            <Paso icono="💬" titulo={`MaKo le manda la secuencia (${jugada.pasos.length} mensajes)`} detalle="Con el anti-ban de siempre; los pasos de WhatsApp oficial esperan la plantilla aprobada por Meta." tono="mako" />
            {nPreg > 0 && (<><Flecha /><Paso icono="❓" titulo={`Cualifica con ${nPreg} pregunta${nPreg === 1 ? '' : 's'}`} detalle="Sembradas con naturalidad en la charla — y la base del Setter IA." tono="mako" /></>)}
            <Flecha />
            <Paso icono="✅" titulo={objetivos.find((o) => o.value === objetivo)?.label ?? objetivo} detalle={gancho.trim() ? `Gancho: ${gancho.trim()}` : undefined} tono="dueno" />
          </div>

          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>La estrategia</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Dropdown value={objetivo} onChange={(v) => setObjetivo(v as Objetivo)} width={230} ariaLabel="Objetivo de la jugada"
                options={objetivos.map((o) => ({ value: o.value, label: `${EMOJI_OBJ[o.value as Objetivo] ?? ''} ${o.label}` }))} />
              <input value={gancho} onChange={(e) => setGancho(e.target.value)} placeholder="Gancho (lead magnet / oferta)…" style={{ ...inp, width: 'auto', flex: 1, minWidth: 180 }} disabled={!rolAdmin} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 6 }}>Preguntas de cualificación — una por línea (el Setter y el simulador las usan en este orden):</div>
              <textarea value={preguntas} onChange={(e) => setPreguntas(e.target.value)} rows={5} placeholder={'¿Facturás más de …?\n¿Tenés equipo?'} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} disabled={!rolAdmin} />
            </div>
          </div>

          {err && <div style={{ marginBottom: 12, padding: '9px 12px', borderRadius: 9, fontSize: 13, border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)' }}>{err}</div>}

          {rolAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              {flash && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--good)', marginRight: 'auto' }}>{flash}</span>}
              <button onClick={onWizard} style={btnGhost}>✍️ MaKo redacta (wizard)</button>
              <button onClick={guardar} disabled={busy === 'save'} style={{ ...btn, opacity: busy === 'save' ? 0.5 : 1 }}>{busy === 'save' ? 'Guardando…' : 'Guardar'}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
