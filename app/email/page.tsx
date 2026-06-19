'use client';

// =============================================================================
// Email Marketing — secuencias por etapa + broadcasts
// Port fiel de design-reference/Email Marketing.dc.html.
// El layout (app/layout.tsx) ya aporta el <aside> y el rootStyle, así que
// esta pantalla devuelve SÓLO el <main>.
// =============================================================================

import { useState, type CSSProperties, type ChangeEvent } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type StageKey = 'nutri' | 'nopaga' | 'noshow' | 'manual' | 'postagenda';

type View = 'sequences' | 'broadcasts';

interface EmailStep {
  delay: string;
  subject: string;
  preview: string;
  body: string;
  sent: number;
  open: string;
  click: string;
}

interface Sequence {
  key: string;
  name: string;
  stage: StageKey;
  active: boolean;
  steps: EmailStep[];
}

type BroadcastStatus = 'enviado' | 'programado';

interface Broadcast {
  id: string;
  subject: string;
  date: string;
  segment: string;
  sent: string;
  open: string;
  click: string;
  status: BroadcastStatus;
}

interface Kpi {
  label: string;
  value: string;
  delta: string;
  deltaColor: string;
}

interface StageInfo {
  label: string;
  dot: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Datos estáticos (verbatim del prototipo)
// ─────────────────────────────────────────────────────────────────────────────

const STAGE: Record<StageKey, StageInfo> = {
  nutri: { label: 'No Agenda', dot: '#6A4BD8' },
  nopaga: { label: 'No Paga', dot: '#C7417B' },
  noshow: { label: 'No Show', dot: '#B5630A' },
  manual: { label: 'Manual', dot: '#4F5BD5' },
  postagenda: { label: 'Post Agenda', dot: '#9D4EDD' },
};

const KPIS: Kpi[] = [
  { label: 'Suscriptores activos', value: '214', delta: '▲ 18', deltaColor: 'var(--good)' },
  { label: 'Tasa de apertura', value: '42%', delta: '▲ 3pp', deltaColor: 'var(--good)' },
  { label: 'Tasa de clic', value: '9.1%', delta: '▼ 0.4pp', deltaColor: 'var(--bad)' },
  { label: 'Emails enviados (mes)', value: '1,872', delta: '▲ 12%', deltaColor: 'var(--good)' },
];

const INITIAL_SEQUENCES: Sequence[] = [
  {
    key: 'nutri',
    name: 'Nutrición — No Agenda',
    stage: 'nutri',
    active: true,
    steps: [
      { delay: 'Día 0 · inmediato', subject: '{nombre}, te aparté un lugar', preview: 'Tu sesión sigue disponible esta semana', body: 'Hola {nombre},\n\nVi que dejaste tus datos pero todavía no agendaste tu Junta 1. Te aparté un lugar para esta semana — agendá en 1 clic acá.', sent: 214, open: '48%', click: '11%' },
      { delay: 'Día 1 · 9:00', subject: 'El video que te va a ahorrar 3 meses', preview: '12 minutos que cambian tu prospección', body: 'En este video te muestro el sistema exacto que usamos para llenar la agenda de reuniones calificadas.', sent: 198, open: '41%', click: '9%' },
      { delay: 'Día 3 · 9:00', subject: '¿Lo dejamos para más adelante?', preview: 'Cierro tu cupo hoy', body: '{nombre}, no quiero insistir de más. Si este no es el momento, decime y lo pausamos. Si sí, agendá acá.', sent: 171, open: '39%', click: '7%' },
    ],
  },
  {
    key: 'nopaga',
    name: 'Nutrición — No Paga',
    stage: 'nopaga',
    active: true,
    steps: [
      { delay: 'Día 0 · inmediato', subject: '{nombre}, tu lugar de onboarding', preview: 'Activamos tu arranque esta semana', body: 'Quedamos en avanzar. Te dejo la liga de pago para asegurar tu lugar de onboarding de este mes.', sent: 42, open: '55%', click: '21%' },
      { delay: 'Día 2 · 11:00', subject: '¿Te ayudo con algo para arrancar?', preview: 'Cualquier duda, acá estoy', body: 'A veces lo que frena no es el precio sino una duda concreta. ¿Cuál es la tuya? La resolvemos hoy.', sent: 38, open: '47%', click: '15%' },
    ],
  },
  {
    key: 'noshow',
    name: 'Nutrición — No Show',
    stage: 'noshow',
    active: true,
    steps: [
      { delay: 'Día 0 · inmediato', subject: 'Te perdiste la junta — reagendemos', preview: 'Tengo lugar esta semana', body: '{nombre}, no te vimos en la Junta 1. Sé que se complica la agenda — acá tenés dos horarios nuevos.', sent: 57, open: '44%', click: '12%' },
      { delay: 'Día 1 · 18:00', subject: 'Último intento de reagenda', preview: '¿Seguís interesado?', body: 'Si {empresa} sigue buscando bajar su costo por reunión, dame 1 minuto y te reagendo.', sent: 51, open: '38%', click: '8%' },
    ],
  },
  {
    key: 'manual',
    name: 'Nutrición — Manual',
    stage: 'manual',
    active: false,
    steps: [
      { delay: 'Manual', subject: '(manejado por el setter)', preview: 'Sin disparo automático', body: 'Esta secuencia la maneja el setter asignado desde el CRM.', sent: 0, open: '—', click: '—' },
    ],
  },
  {
    key: 'postagenda',
    name: 'Nutrición — Post Agenda',
    stage: 'postagenda',
    active: true,
    steps: [
      { delay: 'Día 0 · inmediato', subject: 'Resumen de tu junta + siguientes pasos', preview: 'Todo lo que vimos, en un lugar', body: 'Gracias por tu tiempo, {nombre}. Te dejo el resumen de la junta y los siguientes pasos para avanzar.', sent: 31, open: '61%', click: '24%' },
      { delay: 'Día 4 · 10:00', subject: '¿Pudiste revisar la propuesta?', preview: 'Quedo atento a tus dudas', body: 'Cualquier ajuste a la propuesta lo vemos juntos. ¿Te late que hablemos 10 min esta semana?', sent: 28, open: '52%', click: '18%' },
    ],
  },
];

const INITIAL_BROADCASTS: Broadcast[] = [
  { id: 'b1', subject: 'Nuevo caso: de 4 a 11 cierres en 60 días', date: '14 jun 2026', segment: 'Todos los activos', sent: '214', open: '46%', click: '12%', status: 'enviado' },
  { id: 'b2', subject: 'Webinar en vivo: sistema de prospección', date: '8 jun 2026', segment: 'No Agenda + No Show', sent: '118', open: '51%', click: '19%', status: 'enviado' },
  { id: 'b3', subject: 'Cierre de mes — últimos cupos', date: '2 jun 2026', segment: 'No Paga', sent: '42', open: '58%', click: '27%', status: 'enviado' },
  { id: 'b4', subject: 'Encuesta: ¿qué te frena hoy?', date: 'Programado 22 jun', segment: 'Todos los activos', sent: '—', open: '—', click: '—', status: 'programado' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function dotStyle(k: StageKey): CSSProperties {
  return {
    width: '8px',
    height: '8px',
    flex: 'none',
    borderRadius: '50%',
    background: (STAGE[k] || STAGE.nutri).dot,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export default function Page() {
  const [view, setView] = useState<View>('sequences');
  const [selSeq, setSelSeq] = useState<string>('nutri');
  const [sequences, setSequences] = useState<Sequence[]>(INITIAL_SEQUENCES);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>(INITIAL_BROADCASTS);

  // ── computeds (renderVals) ──────────────────────────────────────────────────
  const isSeq = view === 'sequences';
  const showSeq = isSeq;
  const showBroad = !isSeq;

  const tabActive: CSSProperties = { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, background: 'var(--ink)', color: 'var(--on-sidebar)' };
  const tabIdle: CSSProperties = { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 500, background: 'transparent', color: 'var(--dim)' };
  const seqTabStyle = isSeq ? tabActive : tabIdle;
  const broadTabStyle = !isSeq ? tabActive : tabIdle;

  const selKey = sequences.some((s) => s.key === selSeq) ? selSeq : sequences[0].key;
  const seqObj = sequences.find((s) => s.key === selKey) as Sequence;
  const totalSent = seqObj.steps.reduce((a, s) => a + (typeof s.sent === 'number' ? s.sent : 0), 0);

  // ── mutadores (helpers de DCLogic) ──────────────────────────────────────────
  const updSeq = (key: string, field: 'name', val: string) =>
    setSequences((s) => s.map((x) => (x.key === key ? { ...x, [field]: val } : x)));

  const toggleSeq = (key: string) =>
    setSequences((s) => s.map((x) => (x.key === key ? { ...x, active: !x.active } : x)));

  const updStep = (key: string, i: number, field: 'delay' | 'subject' | 'preview' | 'body', val: string) =>
    setSequences((s) =>
      s.map((x) =>
        x.key === key ? { ...x, steps: x.steps.map((st, si) => (si === i ? { ...st, [field]: val } : st)) } : x,
      ),
    );

  const addStep = (key: string) =>
    setSequences((s) =>
      s.map((x) =>
        x.key === key
          ? { ...x, steps: [...x.steps, { delay: 'Día — · —:—', subject: '', preview: '', body: '', sent: 0, open: '—', click: '—' }] }
          : x,
      ),
    );

  const deleteStep = (key: string, i: number) =>
    setSequences((s) =>
      s.map((x) => (x.key === key ? { ...x, steps: x.steps.filter((_, si) => si !== i) } : x)),
    );

  const addSequence = () => {
    const key = 'seq_' + Date.now();
    setSequences((s) => [
      ...s,
      { key, name: 'Nueva secuencia', stage: 'nutri', active: false, steps: [{ delay: 'Día 0 · inmediato', subject: '', preview: '', body: '', sent: 0, open: '—', click: '—' }] },
    ]);
    setSelSeq(key);
  };

  const addBroadcast = () => {
    const id = 'b_' + Date.now();
    setBroadcasts((s) => [
      { id, subject: 'Nuevo broadcast', date: 'Borrador', segment: 'Todos los activos', sent: '—', open: '—', click: '—', status: 'programado' },
      ...s,
    ]);
  };

  // ── meta del detalle ────────────────────────────────────────────────────────
  const metaLine = `${seqObj.steps.length} emails · ${totalSent.toLocaleString('en-US')} enviados · se dispara al entrar a la etapa`;
  const toggleLabel = seqObj.active ? '⏸ Pausar' : '▶ Activar';
  const toggleStyle: CSSProperties = {
    flex: 'none',
    padding: '9px 16px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontFamily: "'Geist', sans-serif",
    fontSize: '13.5px',
    fontWeight: 600,
    border: '1px solid ' + (seqObj.active ? 'var(--border-strong)' : 'var(--good)'),
    background: seqObj.active ? 'var(--surface)' : 'var(--good-bg)',
    color: seqObj.active ? 'var(--dim)' : 'var(--good)',
  };

  // ───────────────────────────────────────────────────────────────────────────
  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '30px 36px 24px' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <h1 style={{ fontWeight: 600, fontSize: '40px', letterSpacing: '-0.025em', lineHeight: 1, margin: '0 0 7px', color: 'var(--ink)' }}>Email Marketing</h1>
          <div style={{ fontSize: '14.5px', color: 'var(--dim)' }}>
            Secuencias y broadcasts a tus leads en <strong style={{ color: 'var(--ink)' }}>Nutrición</strong>.
          </div>
        </div>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px', gap: '4px' }}>
          <button onClick={() => setView('sequences')} style={seqTabStyle}>Secuencias</button>
          <button onClick={() => setView('broadcasts')} style={broadTabStyle}>Broadcasts</button>
        </div>
      </header>

      {/* KPIs */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '18px' }}>
        {KPIS.map((k) => (
          <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 18px' }}>
            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '9px' }}>{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '27px', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{k.value}</span>
              <span style={{ fontSize: '12.5px', color: k.deltaColor }}>{k.delta}</span>
            </div>
          </div>
        ))}
      </section>

      {/* ============= SECUENCIAS ============= */}
      {showSeq && (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px' }}>
          {/* Lista de secuencias */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Secuencias por etapa</div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sequences.map((s) => {
                const active = s.key === selKey;
                const rowStyle: CSSProperties = {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '11px 12px',
                  borderRadius: '11px',
                  cursor: 'pointer',
                  background: active ? 'var(--surface-2)' : 'transparent',
                  border: '1px solid ' + (active ? 'var(--border-strong)' : 'transparent'),
                };
                return (
                  <div key={s.key} onClick={() => setSelSeq(s.key)} style={rowStyle}>
                    <span style={dotStyle(s.stage)}></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--faint)', marginTop: '1px' }}>{s.steps.length} emails · {s.active ? 'activa' : 'pausada'}</div>
                    </div>
                  </div>
                );
              })}
              <button onClick={addSequence} style={{ marginTop: '4px', padding: '11px', borderRadius: '10px', border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>+ Crear secuencia nueva</button>
            </div>
          </div>

          {/* Editor de secuencia */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <span style={dotStyle(seqObj.stage)}></span>
                  <input
                    value={seqObj.name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updSeq(selKey, 'name', e.target.value)}
                    style={{ fontWeight: 600, fontSize: '19px', letterSpacing: '-0.01em', color: 'var(--ink)', border: 'none', background: 'transparent', fontFamily: "'Geist', sans-serif", outline: 'none', padding: '2px 0', minWidth: '280px' }}
                  />
                </div>
                <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '4px' }}>{metaLine}</div>
              </div>
              <button onClick={() => toggleSeq(selKey)} style={toggleStyle}>{toggleLabel}</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '22px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {seqObj.steps.map((st, i) => (
                  <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', width: '34px' }}>
                      <span style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(200,135,12,.12)', border: '1px solid rgba(200,135,12,.32)', color: '#9A6A09', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', fontFamily: "'Geist Mono', monospace" }}>{i + 1}</span>
                      <span style={{ width: '2px', flex: 1, minHeight: '30px', background: 'var(--border)' }}></span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingBottom: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '9px' }}>
                        <input
                          value={st.delay}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => updStep(selKey, i, 'delay', e.target.value)}
                          style={{ flex: 'none', width: '160px', padding: '7px 11px', borderRadius: '8px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist Mono', monospace", fontSize: '12px', outline: 'none' }}
                        />
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>✉ Email</span>
                        <button onClick={() => deleteStep(selKey, i)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--faint)', fontSize: '13px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", textDecoration: 'underline' }}>eliminar</button>
                      </div>
                      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--surface-2)' }}>
                        <div style={{ padding: '11px 13px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                          <input
                            value={st.subject}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => updStep(selKey, i, 'subject', e.target.value)}
                            placeholder="Asunto del email…"
                            style={{ width: '100%', padding: '6px 0', border: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '15px', fontWeight: 600, outline: 'none' }}
                          />
                          <input
                            value={st.preview}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => updStep(selKey, i, 'preview', e.target.value)}
                            placeholder="Texto de vista previa (preheader)…"
                            style={{ width: '100%', padding: 0, border: 'none', background: 'transparent', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: '13px', outline: 'none' }}
                          />
                        </div>
                        <textarea
                          value={st.body}
                          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updStep(selKey, i, 'body', e.target.value)}
                          placeholder="Cuerpo del email…"
                          style={{ width: '100%', minHeight: '84px', resize: 'vertical', padding: '12px 13px', border: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', lineHeight: 1.55, outline: 'none' }}
                        ></textarea>
                        <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                          <div style={{ flex: 1, padding: '9px 13px', borderRight: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '10.5px', color: 'var(--faint)', fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: '.06em' }}>Enviados</div>
                            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{typeof st.sent === 'number' ? st.sent.toLocaleString('en-US') : st.sent}</div>
                          </div>
                          <div style={{ flex: 1, padding: '9px 13px', borderRight: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '10.5px', color: 'var(--faint)', fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: '.06em' }}>Apertura</div>
                            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--good)', fontVariantNumeric: 'tabular-nums' }}>{st.open}</div>
                          </div>
                          <div style={{ flex: 1, padding: '9px 13px' }}>
                            <div style={{ fontSize: '10.5px', color: 'var(--faint)', fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: '.06em' }}>Clic</div>
                            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{st.click}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ flex: 'none', width: '34px', display: 'flex', justifyContent: 'center' }}>
                    <span style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1px dashed var(--border-strong)', color: 'var(--faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>+</span>
                  </div>
                  <button onClick={() => addStep(selKey)} style={{ flex: 1, textAlign: 'left', padding: '14px', borderRadius: '11px', border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>+ Agregar email a la secuencia</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============= BROADCASTS ============= */}
      {showBroad && (
        <div style={{ flex: 1, minHeight: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <h2 style={{ fontWeight: 600, fontSize: '20px', margin: 0, color: 'var(--ink)' }}>Broadcasts</h2>
              <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '3px' }}>Envíos puntuales a un segmento.</div>
            </div>
            <button onClick={addBroadcast} style={{ padding: '10px 17px', borderRadius: '11px', border: 'none', background: 'var(--accent-soft)', color: '#171511', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>+ Crear broadcast</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.3fr 1fr 1fr 1fr 0.9fr', gap: '12px', padding: '13px 22px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--dim)' }}>
            <span>Campaña</span>
            <span>Segmento</span>
            <span>Enviados</span>
            <span>Apertura</span>
            <span>Clic</span>
            <span style={{ textAlign: 'right' }}>Estado</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {broadcasts.map((b) => {
              const statusStyle: CSSProperties = {
                display: 'inline-block',
                fontSize: '11.5px',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '999px',
                background: b.status === 'enviado' ? 'var(--good-bg)' : 'var(--warn-bg)',
                color: b.status === 'enviado' ? 'var(--good)' : 'var(--warn)',
                border: '1px solid ' + (b.status === 'enviado' ? 'var(--good)' : 'var(--warn-fill)'),
              };
              return (
                <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.3fr 1fr 1fr 1fr 0.9fr', gap: '12px', padding: '16px 22px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.subject}</div>
                    <div style={{ fontSize: '12px', color: 'var(--faint)' }}>{b.date}</div>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--dim)' }}>{b.segment}</div>
                  <div style={{ fontSize: '14px', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{b.sent}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--good)', fontVariantNumeric: 'tabular-nums' }}>{b.open}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{b.click}</div>
                  <div style={{ textAlign: 'right' }}><span style={statusStyle}>{b.status}</span></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
