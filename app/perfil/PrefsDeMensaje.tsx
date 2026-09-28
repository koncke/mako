'use client';

// =============================================================================
// PrefsDeMensaje — lo que se configura de UN mensaje y no vive en su plantilla
// =============================================================================
// Casi todo lo de un mensaje es suyo (el texto, si sale, su flujo) y vive en el
// store de plantillas. Quedan tres cosas que no: por qué CANAL sale un reporte,
// QUÉ TRAE adentro, y si los avisos no urgentes esperan al resumen. Esas viven en
// `notification_prefs`, que es del workspace y no del mensaje.
//
// Antes eran tres secciones sueltas en Configuraciones › Notificaciones, cada una
// hablando de un mensaje que estaba en otra lista. El pedido del dueño fue dejar
// ahí SOLO lo de «Dentro de la app» y que lo demás se configure junto al mensaje
// — que es donde se puede ver de qué se está hablando.
//
// ⚠️ SE RELEE ANTES DE GUARDAR. `/api/perfil` guarda el objeto de preferencias
// ENTERO, y esta pantalla toca un campo. Sin releer, guardar acá pisaría lo que
// el panel de al lado hubiera cambiado mientras tanto.

import { useEffect, useState, type CSSProperties } from 'react';
import type { NotifPrefs, CanalPrefs } from '@/lib/perfil';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

/** Qué mensajes tienen preferencias fuera de su plantilla, y cuáles. */
const REPORTES: Record<string, { key: 'horario' | 'diario' | 'semanal'; secciones: boolean }> = {
  'reporte-horario': { key: 'horario', secciones: false },
  'reporte-diario': { key: 'diario', secciones: true },
  'reporte-semanal': { key: 'semanal', secciones: true },
};
const ES_RESUMEN = 'avisos-resumen';

export function tienePrefs(id: string): boolean {
  return id in REPORTES || id === ES_RESUMEN;
}

const SECCIONES: Array<{ k: keyof NotifPrefs['secciones']; label: string }> = [
  { k: 'semaforo', label: 'Semáforo' },
  { k: 'ads', label: 'Ads' },
  { k: 'wins', label: 'Wins' },
  { k: 'pendientes', label: 'Pendientes' },
];

export function PrefsDeMensaje({ id }: { id: string }) {
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch('/api/perfil').then((r) => r.json())
      .then((j) => { if (vivo && j.ok) setPrefs(j.prefs as NotifPrefs); })
      .catch(() => { /* sin prefs no se pinta nada: es config opcional */ });
    return () => { vivo = false; };
  }, []);

  if (!prefs || !tienePrefs(id)) return null;

  const rep = REPORTES[id];

  async function guardar(cambio: (p: NotifPrefs) => NotifPrefs) {
    setBusy(true);
    setFlash(null);
    try {
      // Releer: el panel guarda el objeto entero y podría haber cambiado.
      const fresco = await fetch('/api/perfil').then((r) => r.json());
      const base = (fresco.ok ? fresco.prefs : prefs) as NotifPrefs;
      const next = cambio(base);
      const j = await (await fetch('/api/perfil', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prefs', prefs: next }),
      })).json();
      if (!j.ok) throw new Error(j.error || 'no se pudo guardar');
      setPrefs(next);
      setFlash('✓');
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  }

  const lbl: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', display: 'block', marginBottom: 6 };
  const pill = (on: boolean): CSSProperties => ({
    padding: '5px 12px', borderRadius: 999, cursor: busy ? 'default' : 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: SANS,
    border: `1px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`,
    background: on ? 'rgba(200,135,12,.12)' : 'var(--surface)',
    color: on ? 'var(--accent)' : 'var(--dim)', opacity: busy ? 0.6 : 1,
  });

  const canal = rep ? (prefs[rep.key] as CanalPrefs) : null;

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {canal && rep && (
        <div>
          <label style={lbl}>Por dónde llega</label>
          <div style={{ display: 'flex', gap: 7 }}>
            {(['wa', 'email'] as const).map((c) => (
              <button
                key={c} type="button" disabled={busy} aria-pressed={canal[c]} style={pill(canal[c])}
                onClick={() => void guardar((p) => ({ ...p, [rep.key]: { ...(p[rep.key] as CanalPrefs), [c]: !(p[rep.key] as CanalPrefs)[c] } }))}
              >
                {canal[c] ? '✓ ' : ''}{c === 'wa' ? 'WhatsApp' : 'Email'}
              </button>
            ))}
          </div>
        </div>
      )}

      {rep?.secciones && (
        <div>
          <label style={lbl}>Qué trae adentro</label>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {SECCIONES.map((s) => (
              <button
                key={s.k} type="button" disabled={busy} aria-pressed={prefs.secciones[s.k]} style={pill(prefs.secciones[s.k])}
                onClick={() => void guardar((p) => ({ ...p, secciones: { ...p.secciones, [s.k]: !p.secciones[s.k] } }))}
              >
                {prefs.secciones[s.k] ? '✓ ' : ''}{s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {id === ES_RESUMEN && (
        <div>
          <label style={lbl}>Cuándo llegan los que no son urgentes</label>
          <button
            type="button" disabled={busy} aria-pressed={prefs.resumenDiario === true} style={pill(prefs.resumenDiario === true)}
            onClick={() => void guardar((p) => ({ ...p, resumenDiario: !p.resumenDiario }))}
          >
            {prefs.resumenDiario === true ? '✓ ' : ''}Juntarlos en este mensaje, una vez al día
          </button>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 7, lineHeight: 1.45 }}>
            Apagado, cada uno llega en el momento. Un lead, una reunión o una cuenta frenada llegan en el momento igual.
          </div>
        </div>
      )}

      {flash && <span style={{ fontSize: 12, fontWeight: 600, color: flash === '✓' ? 'var(--good)' : 'var(--bad)' }}>{flash === '✓' ? 'Guardado ✓' : flash}</span>}
    </div>
  );
}
