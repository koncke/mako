'use client';

// =============================================================================
// PrefsDeMensaje — lo que se configura de UN mensaje además de su texto
// =============================================================================
// Antes eran tres secciones sueltas en Configuraciones › Notificaciones, cada una
// hablando de un mensaje que estaba en otra lista. El pedido del dueño fue dejar
// ahí SOLO lo de «Dentro de la app» y que lo demás se configure junto al mensaje
// — que es donde se puede ver de qué se está hablando.
//
// Hoy son tres cosas: POR DÓNDE llega, QUÉ TRAE adentro (sólo los reportes) y si
// los avisos no urgentes esperan al resumen.
//
// ⚠️ «POR DÓNDE LLEGA» ES DE TODOS, Y SE GUARDA EN DOS TIENDAS DISTINTAS. Los tres
// reportes lo tienen en `notification_prefs` (lo leen sus crons); los avisos, en su
// entrada del store de plantillas (lo lee el choke point de lib/avisos.ts). Cuál es
// cuál NO se decide acá: sale de `lib/mensaje-canales.ts`, que es el único lugar que
// lo sabe. Si cada pantalla lo dedujera por su cuenta, terminarían dos interruptores
// diciendo cosas distintas sobre el mismo mensaje — que es el bug que esta tab ya
// pagó una vez.
//
// ⚠️ SE RELEE ANTES DE GUARDAR. `/api/perfil` guarda el objeto de preferencias
// ENTERO, y esta pantalla toca un campo. Sin releer, guardar acá pisaría lo que
// el panel de al lado hubiera cambiado mientras tanto.

import { useEffect, useState, type CSSProperties } from 'react';
import type { NotifPrefs, CanalPrefs } from '@/lib/perfil';
import { claveDeReporte, canalesDeMensaje } from '@/lib/mensaje-canales';
import { CanalToggle } from '../_components/CanalToggle';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const ES_RESUMEN = 'avisos-resumen';

/** Los reportes que además eligen QUÉ TRAEN adentro. */
const CON_SECCIONES = new Set(['reporte-diario', 'reporte-semanal']);

const SECCIONES: Array<{ k: keyof NotifPrefs['secciones']; label: string }> = [
  { k: 'semaforo', label: 'Semáforo' },
  { k: 'ads', label: 'Ads' },
  { k: 'wins', label: 'Wins' },
  { k: 'pendientes', label: 'Pendientes' },
];

export function PrefsDeMensaje({ id, titulo, endpoint = '/api/admin/plantillas', onCanales }: {
  id: string;
  /** El nombre del mensaje, para que el lector de pantalla lea la fila completa. */
  titulo: string;
  /** Mismo protocolo, distinto guard: el del cliente o el de la agencia. */
  endpoint?: string;
  /** Avisa al padre que los canales cambiaron, para que refresque su lista. */
  onCanales?: () => void;
}) {
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [canales, setCanales] = useState<{ wa: boolean; email: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const claveRep = claveDeReporte(id);

  useEffect(() => {
    let vivo = true;
    // Las dos tiendas, en paralelo. La de plantillas también trae el texto y el
    // interruptor, pero acá sólo se usa `canales`: el resto ya lo tiene el detalle.
    void Promise.all([
      fetch('/api/perfil').then((r) => r.json()).catch(() => null),
      fetch(`${endpoint}?id=${encodeURIComponent(id)}`).then((r) => r.json()).catch(() => null),
    ]).then(([jp, jt]) => {
      if (!vivo) return;
      const p = jp?.ok ? (jp.prefs as NotifPrefs) : null;
      setPrefs(p);
      setCanales(canalesDeMensaje(id, jt?.ok ? jt.plantilla : null, p));
    });
    return () => { vivo = false; };
  }, [id, endpoint]);

  async function guardarPrefs(cambio: (p: NotifPrefs) => NotifPrefs) {
    setBusy(true); setFlash(null);
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
    } finally { setBusy(false); }
  }

  /** El canal de un mensaje: a la tienda que le corresponda, decidida en un solo lugar. */
  async function cambiarCanal(c: 'wa' | 'email', on: boolean) {
    if (claveRep) {
      await guardarPrefs((p) => ({ ...p, [claveRep]: { ...(p[claveRep] as CanalPrefs), [c]: on, activo: true } }));
      setCanales((v) => (v ? { ...v, [c]: on } : v));
      onCanales?.();
      return;
    }
    setBusy(true); setFlash(null);
    try {
      const j = await (await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'canales', id, canales: { [c]: on } }),
      })).json();
      if (!j.ok) throw new Error(j.error || 'no se pudo guardar');
      setCanales({ wa: j.plantilla?.canales?.wa ?? true, email: j.plantilla?.canales?.email ?? false });
      setFlash('✓');
      onCanales?.();
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally { setBusy(false); }
  }

  if (!canales) return null;

  const lbl: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', display: 'block', marginBottom: 6 };
  const pill = (on: boolean): CSSProperties => ({
    padding: '5px 12px', borderRadius: 999, cursor: busy ? 'default' : 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: SANS,
    border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`,
    background: on ? 'var(--primary-bg)' : 'var(--surface)',
    color: on ? 'var(--primary)' : 'var(--dim)', opacity: busy ? 0.6 : 1,
  });

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={lbl}>Por dónde llega</label>
        {/* ⚠️ El MISMO chip que los interruptores de canal del panel, no una copia con
            los mismos números escritos a mano: acá había una réplica de la anatomía de
            `CanalToggle` (radio 999, 12.5, el ✓, el dorado) que se dibujaba en esta misma
            pantalla a un click de distancia de su gemelo. Dos cosas que tienen que verse
            igual tienen que ser el mismo componente. */}
        <div style={{ display: 'flex', gap: 7 }}>
          <CanalToggle
            icono="whatsapp" label="WhatsApp" fila={titulo}
            estado={canales.wa ? 'on' : 'off'} onChange={(v) => void cambiarCanal('wa', v)}
          />
          <CanalToggle
            icono="email" label="Email" fila={titulo}
            estado={canales.email ? 'on' : 'off'} onChange={(v) => void cambiarCanal('email', v)}
          />
        </div>
        {!canales.wa && !canales.email && (
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 7, lineHeight: 1.45 }}>
            Sin ningún canal no se manda. Queda guardado su texto.
          </div>
        )}
      </div>

      {prefs && CON_SECCIONES.has(id) && (
        <div>
          <label style={lbl}>Qué trae adentro</label>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {SECCIONES.map((s) => (
              <button
                key={s.k} type="button" disabled={busy} aria-pressed={prefs.secciones[s.k]} style={pill(prefs.secciones[s.k])}
                onClick={() => void guardarPrefs((p) => ({ ...p, secciones: { ...p.secciones, [s.k]: !p.secciones[s.k] } }))}
              >
                {prefs.secciones[s.k] ? '✓ ' : ''}{s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {prefs && id === ES_RESUMEN && (
        <div>
          <label style={lbl}>Cuándo llegan los que no son urgentes</label>
          <button
            type="button" disabled={busy} aria-pressed={prefs.resumenDiario === true} style={pill(prefs.resumenDiario === true)}
            onClick={() => void guardarPrefs((p) => ({ ...p, resumenDiario: !p.resumenDiario }))}
          >
            {prefs.resumenDiario === true ? '✓ ' : ''}Juntarlos en este mensaje, una vez al día
          </button>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 7, lineHeight: 1.45 }}>
            Apagado, cada uno llega en el momento. Un lead, una reunión o una cuenta frenada llegan en el momento igual.
          </div>
        </div>
      )}

      {flash && (
        <div style={{ fontSize: 12, fontWeight: 600, color: flash === '✓' ? 'var(--good)' : 'var(--bad)' }}>{flash}</div>
      )}
    </div>
  );
}
