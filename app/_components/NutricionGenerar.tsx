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
const segBtn = (active: boolean): CSSProperties => ({ padding: '5px 11px', border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '11.5px', fontWeight: 600, background: active ? 'var(--ink)' : 'transparent', color: active ? 'var(--on-sidebar)' : 'var(--dim)' });

// Estado de la plantilla oficial de un paso (espeja meta-templates status).
const ESTADO_TPL: Record<string, { label: string; color: string; bg: string }> = {
  sin_enviar: { label: 'Sin enviar a Meta', color: 'var(--dim)', bg: 'var(--surface-2)' },
  borrador: { label: 'Borrador', color: 'var(--dim)', bg: 'var(--surface-2)' },
  pending: { label: 'En revisión', color: 'var(--warn)', bg: 'var(--warn-bg)' },
  approved: { label: 'Aprobada ✓', color: 'var(--good)', bg: 'var(--good-bg)' },
  rejected: { label: 'Rechazada', color: 'var(--bad)', bg: 'var(--bad-bg)' },
  paused: { label: 'Pausada', color: 'var(--dim)', bg: 'var(--surface-2)' },
  disabled: { label: 'Deshabilitada', color: 'var(--dim)', bg: 'var(--surface-2)' },
};

function fmtDelay(h: number): string {
  if (h <= 1) return 'al toque';
  if (h < 24) return `a las ${h}h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'al día siguiente' : `a los ${d} días`;
}

// ¿El copy sigue con texto de relleno del seed? ([tu problema], [resultado]…).
// Los [tu link …] no cuentan: esos son placeholders del sistema y quedan así.
const RX_PLACEHOLDER = /\[(?!tu link)[^\]\n]{2,80}\]/i;
const conPlaceholders = (s: Sec): boolean =>
  s.pasos.some((p) => RX_PLACEHOLDER.test(p.cuerpo) || RX_PLACEHOLDER.test(p.asunto ?? ''));

export function NutricionGenerar({ onAplicado }: { onAplicado?: () => void } = {}) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [secs, setSecs] = useState<Sec[] | null>(null);
  const [sel, setSel] = useState<Sec | null>(null);      // secuencia bajo revisión
  const [draft, setDraft] = useState<Paso[]>([]);        // copy editable
  const [previos, setPrevios] = useState<Paso[]>([]);    // copy anterior (antes)
  const [verAntes, setVerAntes] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | 'apply' | null>(null);
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; x: string } | null>(null);
  const [estados, setEstados] = useState<Record<number, string>>({}); // orden → status plantilla
  const [submitting, setSubmitting] = useState<number | null>(null);   // orden en envío a Meta
  const [cola, setCola] = useState<number[]>([]);                      // modo "todas": ids que faltan revisar

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

  function cerrar() {
    // Con una operación en vuelo (generar/aplicar/submit a Meta) el modal no se
    // cierra: la cadena "aprobar y seguir" no debe correr con el modal cerrado.
    if (busy !== null || submitting !== null) return;
    setOpen(false); setSel(null); setMsg(null); setVerAntes(null); setCola([]);
  }

  // Modo "todas" (#46): MaKo escribe secuencia por secuencia y vos las revisás
  // en cadena — genera la primera ya y encola el resto; al aprobar una, sigue
  // sola con la próxima. Prioriza las que siguen con texto de relleno.
  async function escribirTodas() {
    if (!secs || ocupado) return;
    const pendientes = secs.filter((s) => s.pasos.length && conPlaceholders(s));
    const objetivo = pendientes.length ? pendientes : secs.filter((s) => s.pasos.length);
    if (!objetivo.length) return;
    setCola(objetivo.slice(1).map((s) => s.id));
    await generar(objetivo[0]);
  }

  async function generar(sec: Sec) {
    setBusy(sec.id); setMsg(null);
    try {
      const j = await jpost<{ ok: boolean; error?: string; pasos: Paso[]; previos: Paso[] }>('/api/mako/nutricion', { action: 'generar', secuenciaId: sec.id });
      if (!j.ok) throw new Error(j.error || 'No se pudo generar');
      setSel(sec); setDraft(j.pasos); setPrevios(j.previos); setVerAntes(null);
      void cargarEstados(sec.id);
    } catch (e) { setMsg({ t: 'err', x: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(null); }
  }

  async function cargarEstados(secId: number) {
    try {
      const j = await jpost<{ ok: boolean; estados: Array<{ orden: number; status: string }> }>('/api/mako/nutricion', { action: 'estado-plantillas', secuenciaId: secId });
      if (j.ok) { const m: Record<number, string> = {}; for (const e of j.estados) m[e.orden] = e.status; setEstados(m); }
    } catch { /* silencioso: sin estados el chip queda "sin enviar" */ }
  }

  function setProv(i: number, val: 'oficial' | 'no_oficial') {
    // no_oficial (Evolution) manda el texto tal cual → limpiamos la plantilla oficial.
    const orden = draft[i]?.orden;
    setDraft((prev) => prev.map((p, idx) => (idx === i ? { ...p, proveedor: val, ...(val === 'no_oficial' ? { template_wa: null } : {}) } : p)));
    // Al alternar canal el estado de la plantilla anterior deja de aplicar: reseteamos
    // el chip para que no muestre "Aprobada ✓" sobre un paso que ya no tiene plantilla.
    if (orden != null) setEstados((prev) => { const n = { ...prev }; delete n[orden]; return n; });
  }

  // Guarda el copy actual y manda ese paso a aprobar como plantilla de Meta.
  async function mandarAMeta(orden: number) {
    if (!sel) return;
    setSubmitting(orden); setMsg(null);
    try {
      // Persistir primero: la plantilla se arma con el copy que estás viendo.
      const save = await jpost<{ ok: boolean; error?: string }>('/api/mako/nutricion', { action: 'aplicar', secuenciaId: sel.id, pasos: draft });
      if (!save.ok) throw new Error(save.error || 'No se pudo guardar antes de enviar.');
      const j = await jpost<{ ok: boolean; error?: string; name?: string; status?: string; nota?: string }>('/api/mako/nutricion', { action: 'plantilla', secuenciaId: sel.id, orden });
      if (!j.ok) throw new Error(j.error || 'No se pudo enviar a Meta.');
      // El paso quedó enlazado a la plantilla (template_wa) en el backend: reflejarlo local.
      setDraft((prev) => prev.map((p) => (p.orden === orden ? { ...p, proveedor: 'oficial', template_wa: j.name ?? p.template_wa } : p)));
      setMsg({ t: 'ok', x: j.nota || 'Plantilla enviada a Meta.' });
      await cargarEstados(sel.id);
    } catch (e) { setMsg({ t: 'err', x: e instanceof Error ? e.message : String(e) }); }
    finally { setSubmitting(null); }
  }

  async function aplicar() {
    if (!sel) return;
    setBusy('apply'); setMsg(null);
    try {
      const j = await jpost<{ ok: boolean; error?: string }>('/api/mako/nutricion', { action: 'aplicar', secuenciaId: sel.id, pasos: draft });
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
      // Aprobar el copy PRENDE la secuencia (#18): es seguro — los pasos WA
      // oficiales no salen hasta que Meta apruebe su plantilla (guard del motor)
      // y el envío real sigue detrás del interruptor del workspace.
      let activada = false;
      if (!sel.activa) {
        const act = await fetch('/api/whatsapp/secuencias', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sel.id, activa: true }) }).then((r) => r.json()).catch(() => ({ ok: false }));
        activada = Boolean(act?.ok);
        // El copy ya quedó guardado (idempotente): si la activación falló, se
        // corta con error visible — re-aprobar reintenta solo la activación.
        if (!activada) throw new Error(`El copy de «${sel.nombre}» se guardó, pero la secuencia NO se pudo activar. Reintentá con Aprobar, o activala desde la lista de secuencias.`);
      }
      setSecs((prev) => prev?.map((s) => (s.id === sel.id ? { ...s, pasos: draft, activa: s.activa || activada } : s)) ?? prev);
      onAplicado?.();
      setSel(null);
      setMsg({ t: 'ok', x: `Listo — «${sel.nombre}» quedó escrita por MaKo${activada ? ' y activada' : ''}.` });
      // Modo "todas": seguir con la próxima de la cola.
      const [next, ...resto] = cola;
      if (next != null) {
        setCola(resto);
        const prox = secs?.find((x) => x.id === next);
        if (prox) { setBusy(null); await generar(prox); return; }
      }
    } catch (e) { setMsg({ t: 'err', x: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(null); }
  }

  function editPaso(i: number, campo: 'asunto' | 'preheader' | 'cuerpo', val: string) {
    setDraft((prev) => prev.map((p, idx) => (idx === i ? { ...p, [campo]: val } : p)));
  }

  if (!visible) return null;
  // Bloqueo global de acciones: generar/aplicar y el submit a Meta no deben cruzarse
  // (dos escrituras concurrentes, o regenerar el draft en medio de un submit).
  const ocupado = busy !== null || submitting !== null;

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
                <div style={{ fontSize: '13.5px', color: 'var(--dim)', lineHeight: 1.5, margin: '8px 0 12px' }}>
                  MaKo escribe el copy de cada secuencia en la voz de tu negocio, aplicando su metodología de copywriting. Lo revisás, ajustás y aprobás — no se manda nada hasta que vos quieras.
                </div>
                {!!secs?.length && (
                  <div style={{ marginBottom: '16px' }}>
                    <button onClick={() => void escribirTodas()} disabled={ocupado} style={{ ...btnAccent, opacity: ocupado ? 0.6 : 1 }}>
                      {busy !== null ? 'Escribiendo…' : (() => { const n = secs.filter((s) => s.pasos.length && conPlaceholders(s)).length; return n ? `✨ MaKo escribe las ${n} pendientes` : '✨ MaKo reescribe todas'; })()}
                    </button>
                  </div>
                )}
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
                        <button onClick={() => void generar(s)} disabled={ocupado} style={{ ...btnAccent, opacity: ocupado ? 0.6 : 1 }}>
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

                      {p.canal === 'whatsapp' && (
                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11.5px', color: 'var(--faint)' }}>Se manda por:</span>
                            <div style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: '8px', overflow: 'hidden' }}>
                              <button onClick={() => setProv(i, 'oficial')} style={segBtn(p.proveedor !== 'no_oficial')}>Oficial (Meta)</button>
                              <button onClick={() => setProv(i, 'no_oficial')} style={segBtn(p.proveedor === 'no_oficial')}>No oficial</button>
                            </div>
                          </div>

                          {p.proveedor === 'no_oficial' ? (
                            <div style={{ fontSize: '11.5px', color: 'var(--dim)', lineHeight: 1.45 }}>
                              Se manda tal cual por tu número no oficial (Evolution), con el anti-ban. A leads calientes queda como borrador para que un humano lo mande con un clic.
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {(() => { const c = ESTADO_TPL[estados[p.orden]] ?? ESTADO_TPL.sin_enviar; return <span style={chip(c.bg, c.color)}>{c.label}</span>; })()}
                                <button onClick={() => void mandarAMeta(p.orden)} disabled={ocupado || estados[p.orden] === 'pending' || estados[p.orden] === 'approved'}
                                  style={{ ...btnGhost, padding: '5px 11px', fontSize: '11.5px', opacity: (ocupado || estados[p.orden] === 'pending' || estados[p.orden] === 'approved') ? 0.5 : 1 }}>
                                  {submitting === p.orden ? 'Enviando…' : estados[p.orden] === 'rejected' ? '↻ Reenviar a Meta' : '📩 Mandar a aprobar en Meta'}
                                </button>
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--faint)', lineHeight: 1.4 }}>
                                La plantilla oficial reabre la conversación (sin links). El link se manda cuando el lead responde. No se envía a leads hasta que Meta la aprueba.
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={() => { setSel(null); setMsg(null); setVerAntes(null); setCola([]); }} disabled={ocupado} style={{ ...btnGhost, opacity: ocupado ? 0.6 : 1 }}>← Volver</button>
                    {cola.length > 0 && <span style={{ fontSize: '12px', color: 'var(--faint)' }}>quedan {cola.length} por revisar</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => void generar(sel)} disabled={ocupado} style={{ ...btnGhost, opacity: ocupado ? 0.6 : 1 }}>{busy === sel.id ? 'Reescribiendo…' : '↻ Reescribir'}</button>
                    <button onClick={() => void aplicar()} disabled={ocupado} style={{ ...btnDark, opacity: ocupado ? 0.6 : 1 }}>{busy === 'apply' ? 'Guardando…' : cola.length ? 'Aprobar y seguir →' : 'Aprobar y guardar'}</button>
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
