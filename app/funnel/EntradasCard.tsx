'use client';

// =============================================================================
// EntradasCard — «¿cómo entra tu gente?», arriba del editor del funnel
// =============================================================================
// El editor de abajo dibuja el RECORRIDO del lead. Esto declara los ACTIVOS con
// los que ese recorrido existe, que es un dato distinto y que hasta ahora no
// tenía dónde vivir: se podía renombrar la etapa «Lead (Instant form)» sin que
// nada cambiara, porque el nombre de una etapa es texto y nadie lo lee como
// dato.
//
// Por qué está acá y no en el onboarding del Chatbot, que es donde se nota:
// el mismo dato lo consumen los audios, los escenarios del ensayo, las
// secuencias, el generador de landings y el estructurador de campañas de Meta.
// Si viviera en la tab que lo sufre, los otros cuatro se quedarían viejos.
//
// ⚠️ Y por qué NO se guarda solo, como el pipeline de abajo: el editor autoguarda
// con un debounce en cada tecla. Una declaración se confirma; si se guardara al
// tipear, cualquier clic accidental le cambiaría a un cliente qué audios le
// pedimos y qué le decimos a sus leads.

import { useState } from 'react';
import { ENTRADAS, type EntradaId, fechaFijaDelEvento } from '@/lib/pipeline';
import type { CanalId } from '@/lib/fase-diagnostico';
import { declararEntradasAction } from '../crm/actions';

const MONO = "'Geist Mono', ui-monospace, monospace";
const DIAS = [
  { n: 1, l: 'L' }, { n: 2, l: 'M' }, { n: 3, l: 'X' }, { n: 4, l: 'J' },
  { n: 5, l: 'V' }, { n: 6, l: 'S' }, { n: 0, l: 'D' },
];

export type EventoDecl = { lugar: string | null; dias: number[]; hora: string | null; tz: string | null; cupo: number | null };

export function EntradasCard({
  initial, initialEvento, canal,
}: {
  initial: EntradaId[];
  initialEvento: EventoDecl | null;
  canal: CanalId | null;
}) {
  const [sel, setSel] = useState<EntradaId[]>(initial);
  const [lugar, setLugar] = useState(initialEvento?.lugar ?? '');
  const [dias, setDias] = useState<number[]>(initialEvento?.dias ?? []);
  const [hora, setHora] = useState(initialEvento?.hora ?? '');
  const [cupo, setCupo] = useState(initialEvento?.cupo != null ? String(initialEvento.cupo) : '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const declarado = initial.length > 0;
  const pideEvento = fechaFijaDelEvento(canal);
  const sucio = JSON.stringify([...sel].sort()) !== JSON.stringify([...initial].sort())
    || (pideEvento && (lugar !== (initialEvento?.lugar ?? '')
      || hora !== (initialEvento?.hora ?? '')
      || cupo !== (initialEvento?.cupo != null ? String(initialEvento.cupo) : '')
      || JSON.stringify([...dias].sort()) !== JSON.stringify([...(initialEvento?.dias ?? [])].sort())));

  function toggle(id: EntradaId) {
    setMsg(null); setErr(null);
    setSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 3)));
  }

  async function guardar() {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const evento = pideEvento
        ? { lugar: lugar.trim() || null, dias, hora: hora.trim() || null, tz: null, cupo: cupo.trim() ? Number(cupo) : null }
        : null;
      const r = await declararEntradasAction(sel, evento);
      if (r.ok) setMsg('Listo. Con esto ya sabemos qué audios pedirte y qué NO decirle a tu gente.');
      else setErr(r.error);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '18px 20px', marginBottom: 18 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 650, color: 'var(--ink)' }}>¿Cómo entra tu gente?</h2>
      <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6, maxWidth: '70ch' }}>
        Las etapas de abajo dicen por dónde pasa un lead. Esto dice cómo llegó, que es
        otra cosa y es la que usa MaKo para escribirle. Si le dice «vi que dejaste tus
        datos en el anuncio» a alguien a quien le escribiste vos primero, se nota en la
        primera frase.
      </p>

      {!declarado && (
        <div style={{ marginTop: 12, padding: '10px 13px', borderRadius: 10, border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 13, lineHeight: 1.55 }}>
          Todavía no lo declaraste. Hasta que lo hagas, MaKo no te va a pedir audios ni
          escribir mensajes de apertura — prefiere no decir nada antes que inventarlo.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {(Object.values(ENTRADAS)).map((e) => {
          const on = sel.includes(e.id);
          return (
            <button
              key={e.id} type="button" onClick={() => toggle(e.id)} aria-pressed={on}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 11, textAlign: 'left', width: '100%',
                padding: '11px 13px', borderRadius: 11, cursor: 'pointer',
                border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
                background: on ? 'var(--primary-bg, var(--surface-2))' : 'var(--surface)',
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

      <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 8 }}>
        Podés marcar más de una si te llegan por varios lados. Se piden hasta tres.
      </div>

      {/* El evento solo se pregunta donde la fecha la pone el negocio: si el lead
          agenda solo, no hay «todos los miércoles» que declarar. */}
      {pideEvento && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 620, color: 'var(--ink)' }}>Tu sesión</h3>
          <p style={{ margin: '4px 0 10px', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
            Esto entra en el audio que escucha antes de ir. Si no lo cargás, el audio no
            dice ninguna dirección: dice que se la pasás por acá.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)' }}>¿Dónde es?</span>
              <input value={lugar} onChange={(ev) => setLugar(ev.target.value)} placeholder="Huayacán, Cancún"
                style={{ padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, width: '100%', boxSizing: 'border-box' }} />
            </label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)' }}>¿Qué días?</span>
                <div style={{ display: 'flex', gap: 5 }}>
                  {DIAS.map((d) => {
                    const on = dias.includes(d.n);
                    return (
                      <button key={d.n} type="button" aria-pressed={on}
                        onClick={() => setDias((p) => (p.includes(d.n) ? p.filter((x) => x !== d.n) : [...p, d.n]))}
                        style={{
                          width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                          border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
                          background: on ? 'var(--primary)' : 'var(--surface)',
                          color: on ? '#fff' : 'var(--dim)',
                        }}>{d.l}</button>
                    );
                  })}
                </div>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)' }}>¿A qué hora?</span>
                <input value={hora} onChange={(ev) => setHora(ev.target.value)} placeholder="19:00" inputMode="numeric"
                  style={{ padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, width: 90 }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)' }}>¿Hay cupo?</span>
                <input value={cupo} onChange={(ev) => setCupo(ev.target.value.replace(/\D/g, ''))} placeholder="20" inputMode="numeric"
                  style={{ padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, width: 90 }} />
              </label>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void guardar()} disabled={busy || !sel.length || !sucio}
          style={{
            padding: '9px 16px', borderRadius: 10, border: 'none', cursor: busy || !sel.length || !sucio ? 'default' : 'pointer',
            background: 'var(--ink)', color: 'var(--surface)', fontSize: 13.5, fontWeight: 600,
            opacity: busy || !sel.length || !sucio ? 0.45 : 1,
          }}>
          {busy ? 'Guardando…' : declarado ? 'Guardar los cambios' : 'Sí, así entra mi gente'}
        </button>
        {msg && <span style={{ fontSize: 13, color: 'var(--good)' }}>{msg}</span>}
        {err && <span style={{ fontSize: 13, color: 'var(--bad)' }}>{err}</span>}
      </div>
    </section>
  );
}
