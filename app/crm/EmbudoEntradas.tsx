'use client';

// =============================================================================
// EmbudoEntradas — «¿Cómo entra tu gente?», ahora adentro del pop-up del CRM
// =============================================================================
// Las etapas dicen por dónde PASA un lead. Esto dice cómo LLEGÓ, que es otro dato
// y es el que usa MaKo para escribirle: si le dice «vi que dejaste tus datos en el
// anuncio» a alguien a quien le escribió el negocio primero, se nota en la primera
// frase. Lo consumen los audios, los escenarios del ensayo, las secuencias, el
// generador de landings y el estructurador de campañas de Meta.
//
// ⚠️ VIVÍA EN `app/funnel/EntradasCard.tsx`, arriba del editor completo, y se mudó
// acá el 29/09/2026 cuando Martín pidió eliminar también esa pantalla: «Tienes que
// eliminar esto, ya te lo habia pedido». Con el editor fuera, el pop-up del CRM es
// el ÚNICO lugar donde se configura un embudo — y esta declaración tenía que venir
// con él o se quedaba sin pantalla, que es como se pierde un dato que cinco cosas
// leen.
//
// ⚠️ Y NO SE AUTOGUARDA, a diferencia de las etapas. Cada etapa es una operación
// que la persona pidió; esto es una DECLARACIÓN sobre el negocio, y guardarla al
// primer clic le cambiaría a un cliente qué audios le pedimos y qué le decimos a
// sus leads por un toque accidental. Se confirma.

import { useState } from 'react';
import { ENTRADAS, type EntradaId, fechaFijaDelEvento } from '@/lib/pipeline';
import type { CanalId } from '@/lib/fase-diagnostico';
import { declararEntradasAction } from './actions';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', ui-monospace, monospace";
const DIAS = [
  { n: 1, l: 'L' }, { n: 2, l: 'M' }, { n: 3, l: 'X' }, { n: 4, l: 'J' },
  { n: 5, l: 'V' }, { n: 6, l: 'S' }, { n: 0, l: 'D' },
];

export type EventoDecl = { lugar: string | null; dias: number[]; hora: string | null; tz: string | null; cupo: number | null };

export function EmbudoEntradas({ initial, initialEvento, canal, funnelId, onGuardado }: {
  initial: EntradaId[];
  initialEvento: EventoDecl | null;
  canal: CanalId | null;
  /** Cuál embudo declara esto. `undefined` = el del NEGOCIO. */
  funnelId?: number;
  onGuardado?: () => void;
}) {
  const [sel, setSel] = useState<EntradaId[]>(initial);
  const [lugar, setLugar] = useState(initialEvento?.lugar ?? '');
  const [dias, setDias] = useState<number[]>(initialEvento?.dias ?? []);
  const [hora, setHora] = useState(initialEvento?.hora ?? '');
  const [cupo, setCupo] = useState(initialEvento?.cupo != null ? String(initialEvento.cupo) : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const declarado = initial.length > 0;
  const pideEvento = fechaFijaDelEvento(canal);
  const sucio = JSON.stringify([...sel].sort()) !== JSON.stringify([...initial].sort())
    || (pideEvento && (lugar !== (initialEvento?.lugar ?? '')
      || hora !== (initialEvento?.hora ?? '')
      || cupo !== (initialEvento?.cupo != null ? String(initialEvento.cupo) : '')
      || JSON.stringify([...dias].sort()) !== JSON.stringify([...(initialEvento?.dias ?? [])].sort())));

  function toggle(id: EntradaId) {
    setErr(null);
    setSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 3)));
  }

  async function guardar() {
    setBusy(true); setErr(null);
    try {
      const evento = pideEvento
        ? { lugar: lugar.trim() || null, dias, hora: hora.trim() || null, tz: null, cupo: cupo.trim() ? Number(cupo) : null }
        : null;
      const r = await declararEntradasAction(sel, evento, funnelId);
      if (r.ok) onGuardado?.();
      else setErr(r.error);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Un aviso sólo cuando FALTA. Sin declarar, MaKo se abstiene de escribir la
          apertura — y eso hay que decirlo, porque el silencio se lee como que está roto. */}
      {!declarado && (
        <div style={{ marginBottom: 14, padding: '10px 13px', borderRadius: 10, border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 13, lineHeight: 1.55 }}>
          Sin esto MaKo no escribe el primer mensaje: prefiere no decir nada antes que inventarlo.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(Object.values(ENTRADAS)).map((e) => {
          const on = sel.includes(e.id);
          return (
            <button
              key={e.id} type="button" onClick={() => toggle(e.id)} aria-pressed={on}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 11, textAlign: 'left', width: '100%',
                padding: '10px 13px', borderRadius: 10, cursor: 'pointer', fontFamily: SANS,
                border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
                background: on ? 'var(--primary-weak)' : 'var(--surface-2)',
              }}
            >
              <span aria-hidden style={{
                flex: 'none', width: 17, height: 17, marginTop: 1, borderRadius: 5,
                border: '1.5px solid ' + (on ? 'var(--primary)' : 'var(--border-strong)'),
                background: on ? 'var(--primary)' : 'transparent',
                color: '#fff', fontSize: 12, lineHeight: '15px', textAlign: 'center',
              }}>{on ? '✓' : ''}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{e.label}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>{e.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* El evento sólo se pregunta donde la fecha la pone el NEGOCIO: si el lead
          agenda solo, no hay «todos los miércoles» que declarar. */}
      {pideEvento && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <span style={{ display: 'block', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 10 }}>Tu sesión</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>¿Dónde es?</span>
              <input value={lugar} onChange={(ev) => setLugar(ev.target.value)} placeholder="Huayacán, Cancún"
                style={{ padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13.5, width: '100%', boxSizing: 'border-box', fontFamily: SANS }} />
            </label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>¿Qué días?</span>
                <div style={{ display: 'flex', gap: 5 }}>
                  {DIAS.map((d) => {
                    const on = dias.includes(d.n);
                    return (
                      <button key={d.n} type="button" aria-pressed={on} aria-label={`Día ${d.l}`}
                        onClick={() => setDias((pv) => (pv.includes(d.n) ? pv.filter((x) => x !== d.n) : [...pv, d.n]))}
                        style={{
                          width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: SANS,
                          border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border-strong)'),
                          background: on ? 'var(--primary)' : 'var(--surface-2)',
                          color: on ? '#fff' : 'var(--dim)',
                        }}>{d.l}</button>
                    );
                  })}
                </div>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>¿A qué hora?</span>
                <input value={hora} onChange={(ev) => setHora(ev.target.value)} placeholder="19:00" inputMode="numeric"
                  style={{ padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13.5, width: 90, fontFamily: SANS }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>¿Hay cupo?</span>
                <input value={cupo} onChange={(ev) => setCupo(ev.target.value.replace(/\D/g, ''))} placeholder="20" inputMode="numeric"
                  style={{ padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13.5, width: 90, fontFamily: SANS }} />
              </label>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void guardar()} disabled={busy || !sel.length || !sucio}
          style={{
            padding: '9px 16px', borderRadius: 10, border: 'none', fontFamily: SANS,
            cursor: busy || !sel.length || !sucio ? 'default' : 'pointer',
            background: 'var(--ink)', color: 'var(--surface)', fontSize: 13.5, fontWeight: 600,
            opacity: busy || !sel.length || !sucio ? 0.45 : 1,
          }}>
          {busy ? 'Guardando…' : declarado ? 'Guardar los cambios' : 'Así entra mi gente'}
        </button>
        <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>Marca hasta tres.</span>
        {err && <span style={{ fontSize: 13, color: 'var(--bad)' }}>{err}</span>}
      </div>
    </div>
  );
}
