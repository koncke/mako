'use client';

// =============================================================================
// SecuenciaWizard — "Nueva secuencia de mensajes"
// =============================================================================
// Misma pieza que el onboarding (WizardShell fullscreen + el panel negro al
// costado) y no un modal aparte: armar una secuencia es el mismo trabajo que
// hacer el onboarding, contado una vez más. Aprender dos pantallas distintas
// para lo mismo es trabajo que el dueño no tiene por qué hacer.
//
// El recorrido:
//   ① a quién      — la etapa del funnel
//   ② el objetivo  — con el CONTEXTO de esa etapa arriba: qué le pasó a ese lead,
//                    qué recuerda, qué temperatura tiene. El objetivo correcto
//                    depende de eso, y el dueño no lo tiene presente cuando está
//                    armando la secuencia.
//   ③ ¿lead magnet? — gate. Si dice que no, sus pasos ni aparecen.
//   ④ cuál         — desplegable de los que ya tiene, o cargar uno (link/archivo)
//   ⑤ preguntas    — cualificación
//   ⑥ MaKo redacta
//   ⑦ desenlace    — cuándo se logró y cuándo se dio por fallida. Sin esto una
//                    secuencia no sabe parar ni encadenar con la siguiente.
//   ⑧ prueba
//   ⑨ activar

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { WizardShell } from '@/app/_components/WizardShell';
import { PanelMarketing } from '@/app/_components/PanelMarketing';
import { Dropdown } from '../components/Dropdown';
import type { SecuenciaDto, Opcion, PasoSecuenciaDto } from './ChatAgentApp';
import { DESENLACE_VACIO, type Desenlace, type Estrategia } from '@/lib/setting-estrategia';
import { contextoDe } from '@/lib/etapas-contexto';

const MONO = "'Geist Mono', monospace";
const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 11, border: 'none', background: 'var(--ink)', color: 'var(--on-sidebar)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' };
const btnAccent: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--accent-soft)', color: '#171511', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
const inp: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', lineHeight: 1.5, outline: 'none', boxSizing: 'border-box' };
const caja: CSSProperties = { padding: '13px 15px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', textAlign: 'left' };

async function jpost<T>(b: unknown): Promise<T> {
  const r = await fetch('/api/chat-agent/secuencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  return r.json() as Promise<T>;
}

type PasoKey = 'quien' | 'objetivo' | 'usa_lm' | 'lead_magnet' | 'preguntas' | 'redactar' | 'desenlace' | 'probar' | 'activar';

const PREGUNTA: Record<PasoKey, { q: string; sub?: string }> = {
  quien: { q: '¿A quién le hablamos?' },
  objetivo: { q: '¿Cuál es el objetivo?' },
  usa_lm: { q: '¿Esta secuencia entrega algo?' },
  lead_magnet: { q: '¿Qué le entregas?' },
  preguntas: { q: 'Preguntas de cualificación' },
  redactar: { q: 'MaKo escribe los mensajes' },
  desenlace: { q: '¿Cuándo termina esta secuencia?' },
  probar: { q: 'Pruébala en tu teléfono' },
  activar: { q: 'Activar' },
};

export function SecuenciaWizard({ secuenciaId: secInicial, secuencias, objetivos, etapas, leadMagnets, onClose, onDone }: {
  secuenciaId: number | null;
  secuencias: SecuenciaDto[];
  objetivos: Opcion[];
  etapas: Opcion[];
  leadMagnets: Array<{ id: string; nombre: string }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const existente = secInicial != null ? secuencias.find((j) => j.id === secInicial) ?? null : null;
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [secuenciaId, setSecuenciaId] = useState<number | null>(secInicial);
  const [etapa, setEtapa] = useState(existente?.etapa ?? '');
  const [objetivo, setObjetivo] = useState<string>(existente?.estrategia?.objetivo ?? '');
  const [objetivoOtro, setObjetivoOtro] = useState('');
  const [customs, setCustoms] = useState<string[]>([]);
  const [usaLm, setUsaLm] = useState<boolean | null>(existente?.estrategia?.usa_lead_magnet ?? null);
  const [gancho, setGancho] = useState(existente?.estrategia?.gancho ?? '');
  const [leadMagnetId, setLeadMagnetId] = useState<string | null>(existente?.estrategia?.lead_magnet_id ?? null);
  const [lmNuevo, setLmNuevo] = useState<{ nombre: string; enlace: string } | null>(null);
  const [preguntas, setPreguntas] = useState<string[]>(existente?.estrategia?.preguntas ?? []);
  const [pregNueva, setPregNueva] = useState('');
  const [sugerencias, setSugerencias] = useState<string[]>([]);
  const [desenlace, setDesenlace] = useState<Desenlace>(existente?.estrategia?.desenlace ?? { ...DESENLACE_VACIO });
  const [draft, setDraft] = useState<PasoSecuenciaDto[] | null>(null);
  const [prueba, setPrueba] = useState<{ enviadosWa: number; enviadosEmail: number; avisos: string[] } | null>(null);

  const ctx = contextoDe(etapa);

  // Los objetivos que el dueño escribió antes con "Otro" vuelven como opción:
  // si lo escribió una vez, es parte de su vocabulario y no debería reescribirlo.
  useEffect(() => {
    void (async () => {
      try {
        const j = await (await fetch('/api/chat-agent/secuencias/objetivos', { cache: 'no-store' })).json();
        if (j.ok) setCustoms(j.objetivos ?? []);
      } catch { /* sin custom: quedan los del catálogo */ }
    })();
  }, []);

  // El paso del lead magnet DESAPARECE si dijo que no entrega nada (punto 12):
  // no se pinta gris ni se explica, simplemente no está en el recorrido.
  const pasos: PasoKey[] = useMemo(() => {
    const base: PasoKey[] = ['quien', 'objetivo', 'usa_lm'];
    if (usaLm) base.push('lead_magnet');
    return [...base, 'preguntas', 'redactar', 'desenlace', 'probar', 'activar'];
  }, [usaLm]);

  const pasoKey = pasos[Math.min(idx, pasos.length - 1)];
  const enUltimo = idx >= pasos.length - 1;

  const estrategia = (): Estrategia => ({
    objetivo: objetivo || 'agendar',
    gancho: gancho.trim() || null,
    lead_magnet_id: leadMagnetId,
    usa_lead_magnet: !!usaLm,
    preguntas,
    criterio: existente?.estrategia?.criterio ?? { califica: [], descalifica: [] },
    desenlace,
    modo: existente?.estrategia?.modo ?? 'asistido',
    notas: null,
    probada_at: existente?.estrategia?.probada_at ?? null,
  });

  async function persistir(): Promise<number | null> {
    setErr(null);
    let id = secuenciaId;
    if (id == null) {
      const label = etapas.find((e) => e.value === etapa)?.label ?? etapa;
      const j = await jpost<{ ok: boolean; error?: string; secuenciaId?: number }>({ action: 'crear', etapa, nombre: `Secuencia — ${label}` });
      if (!j.ok || !j.secuenciaId) { setErr(j.error || 'No se pudo crear la secuencia.'); return null; }
      id = j.secuenciaId; setSecuenciaId(id);
    }
    const g = await jpost<{ ok: boolean; error?: string }>({ action: 'guardar-estrategia', secuenciaId: id, estrategia: estrategia() });
    if (!g.ok) { setErr(g.error || 'No se pudo guardar la estrategia.'); return null; }
    return id;
  }

  async function sugerir(tipo: 'sugerir-gancho' | 'sugerir-preguntas') {
    setBusy(tipo); setErr(null);
    try {
      const etiqueta = etapas.find((e) => e.value === etapa)?.label ?? etapa;
      const j = await jpost<{ ok: boolean; error?: string; sugerencias?: string[] }>({ action: tipo, objetivo, etapa: etiqueta });
      if (!j.ok) setErr(j.error || 'MaKo no pudo sugerir.');
      else setSugerencias(j.sugerencias ?? []);
    } finally { setBusy(null); }
  }

  async function guardarLmNuevo(): Promise<boolean> {
    if (!lmNuevo?.nombre.trim() || !lmNuevo.enlace.trim()) return false;
    setBusy('lm'); setErr(null);
    try {
      const j = await jpost<{ ok: boolean; error?: string; id?: string }>({
        action: 'crear-lead-magnet', nombre: lmNuevo.nombre.trim(), enlace: lmNuevo.enlace.trim(),
      });
      if (!j.ok || !j.id) { setErr(j.error || 'No se pudo guardar.'); return false; }
      setLeadMagnetId(j.id); setGancho(lmNuevo.nombre.trim()); setLmNuevo(null);
      return true;
    } finally { setBusy(null); }
  }

  async function redactar() {
    setBusy('redactar'); setErr(null);
    try {
      const id = await persistir();
      if (id == null) return;
      const r = await fetch('/api/mako/nutricion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generar', secuenciaId: id }) });
      const j = await r.json();
      if (!j.ok) { setErr(j.error || 'MaKo no pudo redactar.'); return; }
      setDraft(j.pasos as PasoSecuenciaDto[]);
    } finally { setBusy(null); }
  }

  async function guardarCopy(id: number): Promise<boolean> {
    const r = await fetch('/api/mako/nutricion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'aplicar', secuenciaId: id, pasos: draft }) });
    const j = await r.json();
    if (!j.ok) { setErr(j.error || 'No se pudo guardar el copy.'); return false; }
    return true;
  }

  async function probar() {
    if (secuenciaId == null || !draft) return;
    setBusy('probar'); setErr(null);
    try {
      if (!(await guardarCopy(secuenciaId))) return;
      const j = await jpost<{ ok: boolean; error?: string; enviadosWa?: number; enviadosEmail?: number; avisos?: string[] }>({ action: 'probar', secuenciaId });
      if (!j.ok) { setErr(j.error || 'La prueba no salió.'); return; }
      setPrueba({ enviadosWa: j.enviadosWa ?? 0, enviadosEmail: j.enviadosEmail ?? 0, avisos: j.avisos ?? [] });
    } finally { setBusy(null); }
  }

  async function activar() {
    if (secuenciaId == null || !draft) return;
    setBusy('activar'); setErr(null);
    try {
      if (!(await guardarCopy(secuenciaId))) return;
      await jpost({ action: 'guardar-estrategia', secuenciaId, estrategia: estrategia() });
      // Las variantes se generan ACÁ, una sola vez, con el copy ya aprobado. El
      // motor sortea entre ellas en cada envío en vez de mandar siempre el mismo
      // texto — que es lo que WhatsApp busca para restringir un número. Si falla,
      // la secuencia se activa igual: sale el copy original, que es correcto.
      setBusy('variantes');
      await jpost({ action: 'variantes', secuenciaId }).catch(() => {});
      setBusy('activar');
      const r = await fetch('/api/whatsapp/secuencias', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: secuenciaId, activa: true }) });
      const j = await r.json();
      if (!j.ok) { setErr(j.error || 'El copy quedó guardado pero no se pudo activar. Vuelve a intentarlo.'); return; }
      onDone();
    } finally { setBusy(null); }
  }

  const puedeAvanzar = (() => {
    if (busy) return false;
    if (pasoKey === 'quien') return etapa !== '' || secuenciaId != null;
    if (pasoKey === 'objetivo') return !!objetivo;
    if (pasoKey === 'usa_lm') return usaLm !== null;
    if (pasoKey === 'lead_magnet') return !!leadMagnetId || !!gancho.trim();
    if (pasoKey === 'redactar') return draft != null;
    return true;
  })();

  function avanzar() {
    setSugerencias([]);
    if (enUltimo) { void activar(); return; }
    setIdx((i) => i + 1);
  }

  function editPaso(i: number, campo: 'asunto' | 'cuerpo', val: string) {
    setDraft((prev) => prev?.map((p, k) => (k === i ? { ...p, [campo]: val } : p)) ?? prev);
  }

  const opcionesObjetivo: Opcion[] = [
    { value: '', label: 'Elige el objetivo…' },
    ...objetivos,
    ...customs.filter((c) => !objetivos.some((o) => o.value === c)).map((c) => ({ value: c, label: c })),
    { value: '__otro__', label: '✎ Otro (lo escribo yo)' },
  ];

  const slides = [
    { t: 'Una secuencia, un objetivo', d: 'Cuando una secuencia intenta hacer dos cosas a la vez, no logra ninguna. Elige qué buscas acá y el resto viene después.' },
    { t: 'Nada sale sin tu aprobación', d: 'Se arma todo aquí, lo pruebas en tu teléfono y se activa solo cuando lo indiques.' },
  ];

  return (
    <WizardShell
      fullscreen
      embebido
      titulo={existente ? existente.nombre : 'Nueva secuencia de mensajes'}
      total={pasos.length}
      idx={idx}
      pregunta={PREGUNTA[pasoKey].q}
      sub={PREGUNTA[pasoKey].sub}
      error={err}
      puedeAvanzar={puedeAvanzar}
      enUltimo={enUltimo}
      confirmLabel={busy === 'variantes' ? 'Escribiendo variantes…' : 'Activar la secuencia'}
      pending={busy != null}
      atrasLabel="Atrás"
      hideAtras={idx === 0}
      onAtras={() => { setSugerencias([]); setIdx((i) => Math.max(0, i - 1)); }}
      onSiguiente={avanzar}
      onConfirmar={avanzar}
      onClose={onClose}
      extraFooter={<button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 13, cursor: 'pointer' }}>Cerrar</button>}
      escenario={<PanelMarketing servicioKey="whatsapp" nombre="Chat Agent" slides={slides} eyebrow="✦ Armemos tu secuencia" />}
    >
      {/* ① a quién */}
      {pasoKey === 'quien' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
            La secuencia se cuelga de una etapa de tu funnel: entra todo lead que esté parado ahí.
          </div>
          <Dropdown value={etapa} onChange={setEtapa} width="100%" ariaLabel="Etapa del funnel"
            options={[{ value: '', label: 'Elige la etapa…' }, ...etapas]} />
        </div>
      )}

      {/* ② objetivo — con el contexto de la etapa ARRIBA */}
      {pasoKey === 'objetivo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ctx && (
            <div style={caja}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 7 }}>
                En qué situación está este lead
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--dim)', lineHeight: 1.65 }}>{ctx.situacion}</p>
            </div>
          )}

          <Dropdown
            value={objetivo === '' || opcionesObjetivo.some((o) => o.value === objetivo) ? objetivo : '__otro__'}
            onChange={(v) => { if (v === '__otro__') { setObjetivo(''); setObjetivoOtro(' '); } else { setObjetivo(v); setObjetivoOtro(''); } }}
            width="100%" ariaLabel="Objetivo de la secuencia" options={opcionesObjetivo}
          />

          {objetivoOtro !== '' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={objetivoOtro.trim()} autoFocus
                onChange={(e) => setObjetivoOtro(e.target.value || ' ')}
                onBlur={() => {
                  const v = objetivoOtro.trim();
                  if (!v) return;
                  setObjetivo(v);
                  // Queda como opción para la próxima: si lo escribió una vez,
                  // es parte de su vocabulario y no debería reescribirlo.
                  void fetch('/api/chat-agent/secuencias/objetivos', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ objetivo: v }),
                  }).then((r) => r.json()).then((j) => { if (j.ok) setCustoms(j.objetivos ?? []); }).catch(() => {});
                }}
                placeholder="¿Qué buscas conseguir con esta secuencia?"
                style={{ ...inp, flex: 1 }}
              />
            </div>
          )}

          {ctx && !objetivo && (
            <div style={{ fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.55, textAlign: 'left' }}>
              MaKo sugiere <strong style={{ color: 'var(--dim)' }}>{objetivos.find((o) => o.value === ctx.sugerido)?.label ?? ctx.sugerido}</strong>: {ctx.porque}{' '}
              <button onClick={() => setObjetivo(ctx.sugerido)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Usar esa</button>
            </div>
          )}
        </div>
      )}

      {/* ③ ¿entrega algo? — el gate */}
      {pasoKey === 'usa_lm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
            Algunas secuencias mandan algo de valor —una guía, un video, una plantilla— para ganarse la respuesta. Otras solo conversan.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setUsaLm(true)} style={{ ...btnGhost, padding: '11px 18px', ...(usaLm === true ? { background: 'var(--ink)', color: 'var(--on-sidebar)', border: 'none' } : {}) }}>Sí, entrega algo</button>
            <button onClick={() => { setUsaLm(false); setLeadMagnetId(null); }} style={{ ...btnGhost, padding: '11px 18px', ...(usaLm === false ? { background: 'var(--ink)', color: 'var(--on-sidebar)', border: 'none' } : {}) }}>No, solo conversa</button>
          </div>
        </div>
      )}

      {/* ④ cuál lead magnet */}
      {pasoKey === 'lead_magnet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Dropdown
            value={leadMagnetId ?? ''}
            onChange={(v) => {
              if (v === '__nuevo__') { setLmNuevo({ nombre: '', enlace: '' }); setLeadMagnetId(null); return; }
              setLmNuevo(null); setLeadMagnetId(v || null);
              setGancho(leadMagnets.find((l) => l.id === v)?.nombre ?? '');
            }}
            width="100%" ariaLabel="Lead magnet"
            options={[
              { value: '', label: leadMagnets.length ? 'Elige uno…' : 'Todavía no tienes ninguno' },
              ...leadMagnets.map((l) => ({ value: l.id, label: l.nombre })),
              { value: '__nuevo__', label: '＋ Cargar uno nuevo' },
            ]}
          />

          {lmNuevo && (
            <div style={{ ...caja, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <input value={lmNuevo.nombre} onChange={(e) => setLmNuevo({ ...lmNuevo, nombre: e.target.value })} placeholder="¿Cómo se llama? (ej: Guía de 5 pasos)" style={inp} autoFocus />
              <input value={lmNuevo.enlace} onChange={(e) => setLmNuevo({ ...lmNuevo, enlace: e.target.value })} placeholder="Enlace donde lo puede ver o descargar" style={inp} />
              <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.5 }}>
                Se le manda como enlace dentro del mensaje. Súbelo a donde ya lo tengas (Drive, tu web, Notion) y pega la dirección.
              </div>
              <button onClick={() => void guardarLmNuevo()} disabled={busy != null || !lmNuevo.nombre.trim() || !lmNuevo.enlace.trim()}
                style={{ ...btnDark, alignSelf: 'flex-start', opacity: !lmNuevo.nombre.trim() || !lmNuevo.enlace.trim() ? 0.5 : 1 }}>
                {busy === 'lm' ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ⑤ preguntas */}
      {pasoKey === 'preguntas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
            Con estas preguntas sabes si el lead te sirve, sin llamarlo. MaKo las siembra en los mensajes de a una.
          </div>
          <button onClick={() => void sugerir('sugerir-preguntas')} disabled={busy != null} style={{ ...btnAccent, alignSelf: 'flex-start' }}>
            {busy === 'sugerir-preguntas' ? 'Pensando…' : '✨ Que las sugiera MaKo'}
          </button>
          {sugerencias.filter((s) => !preguntas.includes(s)).map((s, i) => (
            <button key={i} onClick={() => setPreguntas((p) => [...p, s])} style={{ ...btnGhost, textAlign: 'left' }}>+ {s}</button>
          ))}
          {preguntas.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)', textAlign: 'left' }}>{i + 1}. {p}</span>
              <button onClick={() => setPreguntas((prev) => prev.filter((_, k) => k !== i))} style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={pregNueva} onChange={(e) => setPregNueva(e.target.value)} placeholder="Agregar una propia…" style={{ ...inp, flex: 1 }}
              onKeyDown={(e) => { if (e.key === 'Enter' && pregNueva.trim()) { setPreguntas((p) => [...p, pregNueva.trim()]); setPregNueva(''); } }} />
            <button onClick={() => { if (pregNueva.trim()) { setPreguntas((p) => [...p, pregNueva.trim()]); setPregNueva(''); } }} style={btnGhost}>Agregar</button>
          </div>
        </div>
      )}

      {/* ⑥ MaKo redacta */}
      {pasoKey === 'redactar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!draft && (
            <button onClick={() => void redactar()} disabled={busy != null} style={{ ...btnDark, alignSelf: 'center' }}>
              {busy === 'redactar' ? 'MaKo está escribiendo…' : '✍️ Que los escriba MaKo'}
            </button>
          )}
          {draft?.map((p, i) => (
            <div key={i} style={{ ...caja }}>
              <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 8 }}>
                {p.canal === 'email' ? '✉️ Email' : `💬 WhatsApp${p.proveedor === 'no_oficial' ? ' (no oficial)' : ''}`} · mensaje {p.orden}
              </div>
              {p.canal === 'email' && (
                <input value={p.asunto ?? ''} onChange={(e) => editPaso(i, 'asunto', e.target.value)} placeholder="Asunto" style={{ ...inp, fontWeight: 600, marginBottom: 8 }} />
              )}
              <textarea value={p.cuerpo} onChange={(e) => editPaso(i, 'cuerpo', e.target.value)} rows={p.canal === 'email' ? 5 : 3} style={{ ...inp, resize: 'vertical' }} />
            </div>
          ))}
          {draft && (
            <button onClick={() => void redactar()} disabled={busy != null} style={{ ...btnGhost, alignSelf: 'center' }}>{busy === 'redactar' ? 'Reescribiendo…' : '↻ Reescribir'}</button>
          )}
        </div>
      )}

      {/* ⑦ desenlace */}
      {pasoKey === 'desenlace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
            Una secuencia tiene que saber cuándo dejó de hacer falta. Si no, sigue escribiéndole a alguien que ya hizo lo que le pedías.
          </div>

          <div style={{ ...caja, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--good)' }}>Objetivo logrado cuando…</div>
            <Dropdown
              value={desenlace.logrado} onChange={(v) => setDesenlace((d) => ({ ...d, logrado: v as Desenlace['logrado'] }))}
              width="100%" ariaLabel="Cuándo se logra"
              options={[
                { value: 'respondio', label: 'El lead responde cualquier cosa' },
                { value: 'agendo', label: 'El lead agenda una reunión' },
                { value: 'pago', label: 'El lead paga' },
                { value: 'ninguno', label: 'No cierra sola: la corto yo' },
              ]}
            />
            {desenlace.logrado !== 'ninguno' && (
              <Dropdown
                value={desenlace.logradoEtapa ?? ''} onChange={(v) => setDesenlace((d) => ({ ...d, logradoEtapa: v || null }))}
                width="100%" ariaLabel="Etapa al lograrlo"
                options={[{ value: '', label: 'Y se queda donde está' }, ...etapas.map((e) => ({ value: e.value, label: `Y pasa a: ${e.label}` }))]}
              />
            )}
          </div>

          <div style={{ ...caja, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--warn)' }}>Se da por fallida cuando…</div>
            <Dropdown
              value={String(desenlace.falloDias)} onChange={(v) => setDesenlace((d) => ({ ...d, falloDias: Number(v) }))}
              width="100%" ariaLabel="Cuándo se da por fallida"
              options={[
                { value: '0', label: 'Nunca: la dejo corriendo' },
                { value: '7', label: 'Pasan 7 días sin respuesta' },
                { value: '14', label: 'Pasan 14 días sin respuesta' },
                { value: '30', label: 'Pasan 30 días sin respuesta' },
              ]}
            />
            {desenlace.falloDias > 0 && (
              <Dropdown
                value={desenlace.falloEtapa ?? ''} onChange={(v) => setDesenlace((d) => ({ ...d, falloEtapa: v || null }))}
                width="100%" ariaLabel="Etapa al fallar"
                options={[{ value: '', label: 'Y se queda donde está' }, ...etapas.map((e) => ({ value: e.value, label: `Y pasa a: ${e.label}` }))]}
              />
            )}
          </div>

          <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.55, textAlign: 'left' }}>
            Mover el lead a otra etapa es lo que encadena una secuencia con la siguiente: si esa etapa tiene su propia secuencia, ahí sigue el trabajo.
          </div>
        </div>
      )}

      {/* ⑧ prueba */}
      {pasoKey === 'probar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
            Te mando la secuencia completa a tu teléfono y a tu correo, marcada [PRUEBA]. No toca a ningún lead ni cuenta en las métricas.
          </div>
          <button onClick={() => void probar()} disabled={busy != null} style={{ ...btnDark, alignSelf: 'center' }}>{busy === 'probar' ? 'Enviando…' : '📲 Mándamela'}</button>
          {prueba && (
            <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--good)', background: 'var(--good-bg)', color: 'var(--good)', fontSize: 13, textAlign: 'left' }}>
              Enviada: {prueba.enviadosWa} por WhatsApp y {prueba.enviadosEmail} por email.
              {prueba.avisos.length > 0 && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--dim)' }}>{prueba.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* ⑨ activar */}
      {pasoKey === 'activar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6, textAlign: 'left' }}>
            Al activar, el motor empieza a inscribir a los leads de esa etapa y manda con el anti-ban de siempre. Los pasos de WhatsApp oficial esperan a que Meta apruebe su plantilla, y nada sale si el envío real del canal está apagado.
          </div>
        </div>
      )}
    </WizardShell>
  );
}
