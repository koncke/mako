'use client';

// =============================================================================
// NutricionGenerar — "MaKo escribe tu nutrición" (F3.2 generar + F3.4 aprobar)
// =============================================================================
// Chip + modal. Lista las secuencias del workspace; por cada una, MaKo escribe el
// copy en la voz del negocio (guía F3.1) + metodología + ejemplos. El resultado se
// muestra editable (revisar) y recién al Aplicar se persiste. Autocontenido y
// admin-only: el GET da 403 al resto → el chip se oculta.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';

type Paso = {
  orden: number; canal: 'email' | 'whatsapp'; delay_horas: number;
  asunto: string | null; preheader?: string | null; cuerpo: string;
  proveedor?: 'oficial' | 'no_oficial'; template_wa: string | null;
  template_categoria?: string; template_idioma?: string; template_param?: string;
};
type Sec = { id: number; clave: string; nombre: string; etapa: string; trigger_tipo: string; activa: boolean; pasos: Paso[]; inscriptos: number; enviados: number };

async function jget<T>(url: string): Promise<{ status: number; body: T }> {
  const r = await fetch(url, { cache: 'no-store' });
  return { status: r.status, body: (await r.json()) as T };
}
async function jpost<T>(url: string, b: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  return r.json() as Promise<T>;
}

const btnGhost: CSSProperties = { padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' };
const btnDark: CSSProperties = { padding: '9px 16px', borderRadius: '10px', border: 'none', background: 'var(--ink)', color: 'var(--on-sidebar)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' };
const btnAccent: CSSProperties = { padding: '9px 16px', borderRadius: '10px', border: 'none', background: 'var(--accent-soft)', color: '#171511', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' };
const inp: CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13px', lineHeight: 1.5, outline: 'none' };
const chip = (bg: string, color: string): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999, background: bg, color, fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' });

function fmtDelay(h: number): string {
  if (h <= 1) return 'al toque';
  if (h < 24) return `a las ${h}h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'al día siguiente' : `a los ${d} días`;
}

export function NutricionGenerar() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [secs, setSecs] = useState<Sec[] | null>(null);
  const [sel, setSel] = useState<Sec | null>(null);      // secuencia bajo revisión
  const [draft, setDraft] = useState<Paso[]>([]);        // copy editable
  const [previos, setPrevios] = useState<Paso[]>([]);    // copy anterior (antes)
  const [verAntes, setVerAntes] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | 'apply' | null>(null);
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; x: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const { status, body } = await jget<{ ok: boolean; secuencias: Sec[]; error?: string }>('/api/mako/nutricion');
      if (status === 403 || status === 400) { setVisible(false); return; }
      setVisible(true);
      if (body.ok) setSecs(body.secuencias);
      else { setSecs([]); setMsg({ t: 'err', x: body.error || 'No se pudieron cargar las secuencias.' }); } // no dejar "Cargando…" colgado
    } catch { /* red → sin chip */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function cerrar() { setOpen(false); setSel(null); setMsg(null); setVerAntes(null); }

  async function generar(sec: Sec) {
    setBusy(sec.id); setMsg(null);
    try {
      const j = await jpost<{ ok: boolean; error?: string; pasos: Paso[]; previos: Paso[] }>('/api/mako/nutricion', { action: 'generar', secuenciaId: sec.id });
      if (!j.ok) throw new Error(j.error || 'No se pudo generar');
      setSel(sec); setDraft(j.pasos); setPrevios(j.previos); setVerAntes(null);
    } catch (e) { setMsg({ t: 'err', x: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(null); }
  }

  async function aplicar() {
    if (!sel) return;
    setBusy('apply'); setMsg(null);
    try {
      const j = await jpost<{ ok: boolean; error?: string }>('/api/mako/nutricion', { action: 'aplicar', secuenciaId: sel.id, pasos: draft });
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
      setSecs((prev) => prev?.map((s) => (s.id === sel.id ? { ...s, pasos: draft } : s)) ?? prev);
      setSel(null);
      setMsg({ t: 'ok', x: `Listo — «${sel.nombre}» quedó escrita por MaKo.` });
    } catch (e) { setMsg({ t: 'err', x: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(null); }
  }

  function editPaso(i: number, campo: 'asunto' | 'preheader' | 'cuerpo', val: string) {
    setDraft((prev) => prev.map((p, idx) => (idx === i ? { ...p, [campo]: val } : p)));
  }

  if (!visible) return null;

  return (
    <>
      <button onClick={() => { setOpen(true); setMsg(null); }} style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        title="MaKo escribe tu nutrición en la voz de tu negocio">
        ✍️ Nutrición
      </button>

      {open && (
        <div onClick={cerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ fontSize: '19px', fontWeight: 600, color: 'var(--ink)' }}>{sel ? sel.nombre : 'MaKo escribe tu nutrición'}</div>
              <button onClick={cerrar} title="Cerrar" style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--faint)', cursor: 'pointer' }}>✕</button>
            </div>

            {msg && <div style={{ margin: '12px 0', padding: '9px 12px', borderRadius: '9px', fontSize: '13px', border: '1px solid ' + (msg.t === 'ok' ? 'var(--good)' : 'var(--bad)'), background: msg.t === 'ok' ? 'var(--good-bg)' : 'var(--bad-bg)', color: msg.t === 'ok' ? 'var(--good)' : 'var(--bad)' }}>{msg.x}</div>}

            {/* ── Modo LISTA: elegir secuencia ──────────────────────────────── */}
            {!sel && (
              <>
                <div style={{ fontSize: '13.5px', color: 'var(--dim)', lineHeight: 1.5, margin: '8px 0 16px' }}>
                  MaKo escribe el copy de cada secuencia en la voz de tu negocio, aplicando su metodología de copywriting. Lo revisás, ajustás y aprobás — no se manda nada hasta que vos quieras.
                </div>
                {!secs ? (
                  <div style={{ color: 'var(--faint)', fontSize: '13px' }}>Cargando secuencias…</div>
                ) : secs.length === 0 ? (
                  <div style={{ color: 'var(--dim)', fontSize: '13.5px' }}>Todavía no hay secuencias de nutrición en este workspace.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {secs.map((s) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '12px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{s.nombre}</div>
                          <div style={{ fontSize: '12px', color: 'var(--faint)', marginTop: '2px' }}>{s.pasos.length} {s.pasos.length === 1 ? 'mensaje' : 'mensajes'} · {s.etapa}{s.enviados ? ` · ${s.enviados} enviados` : ''}</div>
                        </div>
                        {!s.activa && <span style={chip('var(--surface-2)', 'var(--dim)')}>pausada</span>}
                        <button onClick={() => void generar(s)} disabled={busy !== null} style={{ ...btnAccent, opacity: busy !== null ? 0.6 : 1 }}>
                          {busy === s.id ? 'Escribiendo…' : '✨ MaKo la escribe'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Modo REVISIÓN: editar y aprobar ───────────────────────────── */}
            {sel && (
              <>
                <div style={{ fontSize: '13px', color: 'var(--dim)', lineHeight: 1.5, margin: '8px 0 16px' }}>
                  Revisá lo que escribió MaKo. Los links de agenda/pago se completan solos al enviar. Ajustá lo que quieras y aprobá.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {draft.map((p, i) => (
                    <div key={i} style={{ padding: '14px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <span style={chip(p.canal === 'email' ? 'var(--primary-bg)' : 'var(--good-bg)', p.canal === 'email' ? 'var(--primary)' : 'var(--good)')}>
                          {p.canal === 'email' ? '✉️ Email' : `💬 WhatsApp${p.proveedor === 'no_oficial' ? ' (no oficial)' : ''}`}
                        </span>
                        <span style={{ fontSize: '11.5px', color: 'var(--faint)' }}>Mensaje {p.orden} · {fmtDelay(p.delay_horas)}</span>
                        <button onClick={() => setVerAntes(verAntes === i ? null : i)} style={{ ...btnGhost, marginLeft: 'auto', padding: '4px 9px', fontSize: '11.5px' }}>
                          {verAntes === i ? 'Ocultar original' : 'Ver original'}
                        </button>
                      </div>

                      {verAntes === i && (
                        <div style={{ marginBottom: '10px', padding: '10px 12px', borderRadius: '9px', border: '1px dashed var(--border-strong)', background: 'var(--surface)', fontSize: '12.5px', color: 'var(--dim)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {previos[i]?.canal === 'email' && previos[i]?.asunto ? `Asunto: ${previos[i]?.asunto}\n\n` : ''}{previos[i]?.cuerpo ?? '—'}
                        </div>
                      )}

                      {p.canal === 'email' && (
                        <>
                          <input value={p.asunto ?? ''} onChange={(e) => editPaso(i, 'asunto', e.target.value)} placeholder="Asunto" style={{ ...inp, fontWeight: 600, marginBottom: '8px' }} />
                          <input value={p.preheader ?? ''} onChange={(e) => editPaso(i, 'preheader', e.target.value)} placeholder="Preheader (vista previa)" style={{ ...inp, marginBottom: '8px' }} />
                        </>
                      )}
                      <textarea value={p.cuerpo} onChange={(e) => editPaso(i, 'cuerpo', e.target.value)} rows={p.canal === 'email' ? 5 : 3} style={{ ...inp, resize: 'vertical' }} />
                      {p.canal === 'whatsapp' && p.proveedor !== 'no_oficial' && p.template_wa && (
                        <div style={{ marginTop: '8px', fontSize: '11.5px', color: 'var(--warn)', lineHeight: 1.45 }}>
                          ⚠️ Este paso usa una plantilla de WhatsApp aprobada por Meta («{p.template_wa}»): hoy se envía esa plantilla. Este texto queda como base para actualizarla en Meta (próximo hito).
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '18px' }}>
                  <button onClick={() => { setSel(null); setMsg(null); setVerAntes(null); }} style={btnGhost}>← Volver</button>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => void generar(sel)} disabled={busy !== null} style={{ ...btnGhost, opacity: busy !== null ? 0.6 : 1 }}>{busy === sel.id ? 'Reescribiendo…' : '↻ Reescribir'}</button>
                    <button onClick={() => void aplicar()} disabled={busy !== null} style={{ ...btnDark, opacity: busy !== null ? 0.6 : 1 }}>{busy === 'apply' ? 'Guardando…' : 'Aprobar y guardar'}</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
