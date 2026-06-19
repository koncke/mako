'use client';

// =============================================================================
// WhatsApp — Conversaciones de leads en Nutrición + Secuencias automáticas
// =============================================================================
// Port fiel del prototipo de diseño (WhatsApp.dc.html). Client Component:
//   - Pestañas: "Conversaciones" (lista / hilo / contexto) y "Secuencias".
//   - Conversaciones: búsqueda + chips de etapa filtran la lista; seleccionar
//     actualiza hilo y contexto; el composer "Enviar" agrega un mensaje;
//     plantillas rápidas precargan el draft. Mensajes auto con badge ⚡.
//   - Secuencias: lista (selección) + editor (renombrar inline, pausar/activar,
//     editar delay/texto de cada paso, eliminar paso, agregar paso, agregar
//     secuencia nueva).
// El <aside> y el wrapper rootStyle los aporta app/layout.tsx; acá solo <main>.
// =============================================================================

import { useState, type CSSProperties, type ChangeEvent } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type StageKey = 'nutri' | 'nopaga' | 'noshow' | 'manual' | 'postagenda';

interface StageInfo {
  label: string;
  dot: string;
  bg: string;
  fg: string;
  bd: string;
}

interface Message {
  from: 'me' | 'them';
  text: string;
  time: string;
  auto?: boolean;
  seq?: string;
}

interface Conversation {
  id: string;
  name: string;
  company: string;
  stage: StageKey;
  phone: string;
  unread: number;
  next: string;
  setter?: string;
  msgs: Message[];
}

interface Step {
  delay: string;
  text: string;
}

interface Sequence {
  key: string;
  name: string;
  stage: StageKey;
  active: boolean;
  steps: Step[];
}

type View = 'chats' | 'sequences';

// ─────────────────────────────────────────────────────────────────────────────
// Metadatos de etapa (idénticos al prototipo)
// ─────────────────────────────────────────────────────────────────────────────

const STAGE: Record<StageKey, StageInfo> = {
  nutri: { label: 'No Agenda', dot: '#6A4BD8', bg: 'rgba(122,90,240,.11)', fg: '#6A4BD8', bd: 'rgba(122,90,240,.28)' },
  nopaga: { label: 'No Paga', dot: '#C7417B', bg: 'rgba(199,65,123,.12)', fg: '#B53A6E', bd: 'rgba(199,65,123,.30)' },
  noshow: { label: 'No Show', dot: '#B5630A', bg: 'rgba(217,119,6,.12)', fg: '#B5630A', bd: 'rgba(217,119,6,.30)' },
  manual: { label: 'Manual', dot: '#4F5BD5', bg: 'rgba(79,91,213,.12)', fg: '#4F5BD5', bd: 'rgba(79,91,213,.30)' },
  postagenda: { label: 'Post Agenda', dot: '#9D4EDD', bg: 'rgba(157,78,221,.12)', fg: '#8B3FC9', bd: 'rgba(157,78,221,.30)' },
};

const STAGE_KEYS: StageKey[] = ['nutri', 'nopaga', 'noshow', 'manual', 'postagenda'];

const QUICK: string[] = ['Reagendar Junta 1', 'Enviar liga de pago', 'Compartir VSL de nuevo'];

// ─────────────────────────────────────────────────────────────────────────────
// Mock data (verbatim del state del prototipo)
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'c1', name: 'German Lagunes', company: 'Lagalm Industrial', stage: 'nutri', phone: '+52 33 1567 0921', unread: 2, next: 'Día 3 · mañana 9:00', msgs: [
      { from: 'me', text: 'Hola German 👋 Vi que dejaste tus datos pero no agendaste tu Junta 1. ¿Te ayudo a encontrar un horario?', time: 'Ayer 10:02', auto: true, seq: 'No Agenda · Día 0' },
      { from: 'them', text: 'Hola, sí, es que se me complicó la semana. ¿Tienen algo el viernes?', time: 'Ayer 14:20' },
      { from: 'me', text: 'Claro, el viernes tengo 11:00 y 4:00pm. ¿Cuál te queda mejor?', time: 'Ayer 14:25', auto: false },
    ],
  },
  {
    id: 'c2', name: 'Ruben De Haro', company: 'RI Supply de México', stage: 'nutri', phone: '+52 55 4821 0093', unread: 0, next: 'Día 7 · jue 18:00', msgs: [
      { from: 'me', text: 'Hola Ruben, te escribo de parte de Mauricio Bustos. Dejaste tus datos pero aún no agendás tu sesión.', time: 'Lun 9:00', auto: true, seq: 'No Agenda · Día 0' },
      { from: 'me', text: '¿Pudiste ver el video? Te dejo el link de nuevo 🎥 bit.ly/vsl-mb', time: 'Mar 9:00', auto: true, seq: 'No Agenda · Día 1' },
    ],
  },
  {
    id: 'c3', name: 'Mario Ramirez', company: 'particular', stage: 'nopaga', phone: '+52 81 3390 5512', unread: 1, next: 'Día 2 · lun 11:00', msgs: [
      { from: 'me', text: 'Mario, quedamos en avanzar con el plan. ¿Cómo vas con el primer pago?', time: 'Mié 11:00', auto: true, seq: 'No Paga · Día 0' },
      { from: 'them', text: 'Sí, ando juntando el primer pago, dame hasta el lunes porfa.', time: 'Mié 12:30' },
    ],
  },
  {
    id: 'c4', name: 'Javier Castro Delgado', company: 'Aguablu SA de CV', stage: 'manual', phone: '+52 33 2210 8841', unread: 0, next: 'Manual · sin programar', setter: 'Andrea Ruiz', msgs: [
      { from: 'me', text: 'Javier, soy Andrea del equipo de Mauricio. Vi tu interés en sistematizar tu prospección 🙌', time: 'Hoy 8:30', auto: false },
      { from: 'them', text: 'Hola Andrea, cuéntame más', time: 'Hoy 9:10' },
    ],
  },
  {
    id: 'c5', name: 'Francisco García', company: 'García Hnos.', stage: 'noshow', phone: '+52 55 7712 3380', unread: 0, next: 'Día 1 · hoy 18:00', msgs: [
      { from: 'me', text: 'Francisco, no te vimos en la Junta 1 😕 ¿Reagendamos? Tengo lugar esta semana.', time: '5 jun 16:40', auto: true, seq: 'No Show · Día 0' },
    ],
  },
  {
    id: 'c6', name: 'Esly Sugey Pereira', company: 'Scarp', stage: 'postagenda', phone: '+52 33 5567 9012', unread: 0, next: 'Día 4 · vie 10:00', msgs: [
      { from: 'me', text: 'Esly, gracias por tu tiempo en la junta. Te dejo el resumen y los siguientes pasos 📋', time: '6 jun 12:05', auto: true, seq: 'Post Agenda · Día 0' },
    ],
  },
];

const INITIAL_SEQUENCES: Sequence[] = [
  {
    key: 'nutri', name: 'Nutrición — No Agenda', stage: 'nutri', active: true, steps: [
      { delay: 'Día 0 · inmediato', text: 'Hola {nombre} 👋 Vi que dejaste tus datos pero no agendaste tu Junta 1. ¿Te ayudo a encontrar un horario?' },
      { delay: 'Día 1 · 9:00', text: '¿Pudiste ver el video? Aquí va de nuevo 🎥 — en 12 min te explico cómo sistematizar tu prospección.' },
      { delay: 'Día 3 · 9:00', text: 'Te aparté un lugar para esta semana, {nombre}. ¿Te queda mañana por la mañana o por la tarde?' },
      { delay: 'Día 7 · 18:00', text: 'Última llamada — hoy cierro tu cupo de esta semana. ¿Avanzamos o lo dejamos para más adelante?' },
    ],
  },
  {
    key: 'nopaga', name: 'Nutrición — No Paga', stage: 'nopaga', active: true, steps: [
      { delay: 'Día 0 · inmediato', text: '{nombre}, quedamos en avanzar con el plan. ¿Cómo vas con el primer pago? Cualquier duda acá estoy.' },
      { delay: 'Día 2 · 11:00', text: 'Te recuerdo que el cupo de onboarding de este mes se cierra pronto. ¿Te ayudo con la liga de pago?' },
      { delay: 'Día 5 · 17:00', text: '¿Hay algo que te esté frenando para arrancar, {nombre}? Lo platicamos y vemos cómo resolverlo.' },
    ],
  },
  {
    key: 'noshow', name: 'Nutrición — No Show', stage: 'noshow', active: true, steps: [
      { delay: 'Día 0 · inmediato', text: '{nombre}, no te vimos en la Junta 1 😕 ¿Reagendamos? Tengo lugar esta semana.' },
      { delay: 'Día 1 · 18:00', text: 'Te dejo dos horarios: mañana 11:00 o jueves 16:00. Respondé con el que te quede.' },
      { delay: 'Día 4 · 10:00', text: 'Imagino que se complicó. ¿Seguís interesado en {empresa}? Si sí, te reagendo en 1 min.' },
    ],
  },
  {
    key: 'manual', name: 'Nutrición — Manual', stage: 'manual', active: false, steps: [
      { delay: 'Manual', text: 'Esta secuencia es manejada por el setter asignado. Sin disparo automático.' },
    ],
  },
  {
    key: 'postagenda', name: 'Nutrición — Post Agenda', stage: 'postagenda', active: true, steps: [
      { delay: 'Día 0 · inmediato', text: '{nombre}, gracias por tu tiempo en la junta 📋 Te dejo el resumen y los siguientes pasos.' },
      { delay: 'Día 4 · 10:00', text: '¿Pudiste revisar la propuesta? Quedo atento a tus dudas para avanzar.' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (réplica de los métodos del prototipo)
// ─────────────────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
}

function stageMeta(k: StageKey): StageInfo {
  return STAGE[k] || STAGE.nutri;
}

function chipStyle(k: StageKey): CSSProperties {
  const s = stageMeta(k);
  return {
    display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600,
    padding: '3px 9px', borderRadius: '999px', background: s.bg, color: s.fg, border: '1px solid ' + s.bd, whiteSpace: 'nowrap',
  };
}

function dotStyle(k: StageKey): CSSProperties {
  return { width: '8px', height: '8px', flex: 'none', borderRadius: '50%', background: stageMeta(k).dot };
}

function avatarStyle(k: StageKey): CSSProperties {
  const s = stageMeta(k);
  return {
    width: '40px', height: '40px', flex: 'none', borderRadius: '50%', background: s.bg, color: s.fg,
    border: '1px solid ' + s.bd, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const [view, setView] = useState<View>('chats');
  const [search, setSearch] = useState<string>('');
  const [chatFilter, setChatFilter] = useState<StageKey | 'todas'>('todas');
  const [selConv, setSelConv] = useState<string>('c1');
  const [selSeq, setSelSeq] = useState<string>('nutri');
  const [draft, setDraft] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [sequences, setSequences] = useState<Sequence[]>(INITIAL_SEQUENCES);

  // ── valores computados (renderVals) ──
  const isChats = view === 'chats';
  const q = search.trim().toLowerCase();
  const cf = chatFilter;

  const tabActive: CSSProperties = { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, background: 'var(--ink)', color: 'var(--on-sidebar)' };
  const tabIdle: CSSProperties = { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 500, background: 'transparent', color: 'var(--dim)' };

  // chat filters
  const filterDefs: { k: StageKey | 'todas'; label: string }[] = [
    { k: 'todas', label: 'Todas' },
    ...STAGE_KEYS.map((k) => ({ k, label: STAGE[k].label })),
  ];
  const chatFilters = filterDefs.map((f) => ({
    k: f.k,
    label: f.label,
    onClick: () => setChatFilter(f.k),
    style: {
      padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '12px', fontWeight: 600,
      border: '1px solid ' + (cf === f.k ? 'var(--ink)' : 'var(--border)'),
      background: cf === f.k ? 'var(--ink)' : 'var(--surface-2)', color: cf === f.k ? 'var(--on-sidebar)' : 'var(--dim)',
    } as CSSProperties,
  }));

  const convs = conversations.filter((c) => {
    if (cf !== 'todas' && c.stage !== cf) return false;
    if (q && !(c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q))) return false;
    return true;
  });

  const selId = convs.some((c) => c.id === selConv) ? selConv : (convs[0] ? convs[0].id : null);

  const convList = convs.map((c) => {
    const last = c.msgs[c.msgs.length - 1];
    const active = c.id === selId;
    return {
      id: c.id,
      name: c.name,
      initials: initials(c.name),
      time: last ? last.time.split(' ').slice(-1)[0] : '',
      preview: last ? ((last.from === 'me' ? 'Vos: ' : '') + last.text) : '',
      stageLabel: stageMeta(c.stage).label,
      stageChip: chipStyle(c.stage),
      stageDot: dotStyle(c.stage),
      avatarStyle: avatarStyle(c.stage),
      unread: c.unread,
      hasUnread: c.unread > 0,
      onSelect: () => setSelConv(c.id),
      rowStyle: {
        display: 'flex', gap: '11px', padding: '11px 12px', borderRadius: '12px', cursor: 'pointer',
        background: active ? 'var(--surface-2)' : 'transparent', border: '1px solid ' + (active ? 'var(--border-strong)' : 'transparent'),
      } as CSSProperties,
    };
  });

  const sel = conversations.find((c) => c.id === selId) || conversations[0];
  const seqForStage = sequences.find((s) => s.key === sel.stage);
  const thread = {
    name: sel.name,
    company: sel.company,
    phone: sel.phone,
    initials: initials(sel.name),
    avatarStyle: avatarStyle(sel.stage),
    stageLabel: stageMeta(sel.stage).label,
    stageChip: chipStyle(sel.stage),
    stageDot: dotStyle(sel.stage),
    seqName: seqForStage ? seqForStage.name : '—',
    nextMsg: sel.next,
    hasSetter: !!sel.setter,
    setter: sel.setter || '',
    msgs: sel.msgs.map((m, i) => {
      const mine = m.from === 'me';
      return {
        key: i,
        text: m.text,
        time: m.time,
        auto: !!m.auto,
        seq: m.seq || '',
        wrapStyle: { display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' } as CSSProperties,
        bubbleStyle: {
          maxWidth: '78%', padding: '10px 13px', borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: m.auto ? 'var(--auto-bubble)' : (mine ? 'var(--wa-bubble)' : 'var(--surface)'),
          border: '1px solid ' + (m.auto ? 'var(--warn-fill)' : (mine ? 'rgba(28,138,84,.30)' : 'var(--border)')),
          boxShadow: '0 1px 2px rgba(23,21,17,.04)',
        } as CSSProperties,
        timeStyle: { fontSize: '10.5px', color: 'var(--faint)', marginTop: '5px', textAlign: mine ? 'right' : 'left' } as CSSProperties,
      };
    }),
  };

  const quickTemplates = QUICK.map((t) => ({ label: t, onUse: () => setDraft(t + ': ') }));

  // sequences view
  const selSeqKey = sequences.some((s) => s.key === selSeq) ? selSeq : sequences[0].key;
  const seqList = sequences.map((s) => {
    const active = s.key === selSeqKey;
    return {
      key: s.key,
      name: s.name,
      stepCount: s.steps.length,
      activeLabel: s.active ? 'activa' : 'pausada',
      dotStyle: dotStyle(s.stage),
      onSelect: () => setSelSeq(s.key),
      rowStyle: {
        display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 12px', borderRadius: '11px', cursor: 'pointer',
        background: active ? 'var(--surface-2)' : 'transparent', border: '1px solid ' + (active ? 'var(--border-strong)' : 'transparent'),
      } as CSSProperties,
    };
  });
  const seqObj = sequences.find((s) => s.key === selSeqKey) || sequences[0];
  const seqDetail = {
    name: seqObj.name,
    dotStyle: dotStyle(seqObj.stage),
    onName: (e: ChangeEvent<HTMLInputElement>) => updSeq(selSeqKey, 'name', e.target.value),
    onToggle: () => toggleSeq(selSeqKey),
    toggleLabel: seqObj.active ? '⏸ Pausar secuencia' : '▶ Activar secuencia',
    toggleStyle: {
      flex: 'none', padding: '9px 16px', borderRadius: '10px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600,
      border: '1px solid ' + (seqObj.active ? 'var(--border-strong)' : 'var(--good)'),
      background: seqObj.active ? 'var(--surface)' : 'var(--good-bg)', color: seqObj.active ? 'var(--dim)' : 'var(--good)',
    } as CSSProperties,
    addStep: () => addStep(selSeqKey),
    steps: seqObj.steps.map((st, i) => ({
      key: i,
      n: i + 1,
      delay: st.delay,
      text: st.text,
      onDelay: (e: ChangeEvent<HTMLInputElement>) => updStep(selSeqKey, i, 'delay', e.target.value),
      onText: (e: ChangeEvent<HTMLTextAreaElement>) => updStep(selSeqKey, i, 'text', e.target.value),
      onDelete: () => deleteStep(selSeqKey, i),
    })),
  };

  // ── handlers (réplica de los métodos del prototipo) ──
  function send() {
    const txt = draft.trim();
    if (!txt) return;
    setConversations((prev) => {
      const id = prev.some((c) => c.id === selConv) ? selConv : prev[0].id;
      return prev.map((c) => c.id === id
        ? { ...c, msgs: [...c.msgs, { from: 'me' as const, text: txt, time: 'ahora', auto: false }] }
        : c);
    });
    setDraft('');
  }

  function updSeq(key: string, field: 'name', val: string) {
    setSequences((prev) => prev.map((x) => (x.key === key ? { ...x, [field]: val } : x)));
  }

  function toggleSeq(key: string) {
    setSequences((prev) => prev.map((x) => (x.key === key ? { ...x, active: !x.active } : x)));
  }

  function updStep(key: string, i: number, field: 'delay' | 'text', val: string) {
    setSequences((prev) => prev.map((x) => (x.key === key
      ? { ...x, steps: x.steps.map((st, si) => (si === i ? { ...st, [field]: val } : st)) }
      : x)));
  }

  function addStep(key: string) {
    setSequences((prev) => prev.map((x) => (x.key === key
      ? { ...x, steps: [...x.steps, { delay: 'Día — · —:—', text: '' }] }
      : x)));
  }

  function deleteStep(key: string, i: number) {
    setSequences((prev) => prev.map((x) => (x.key === key
      ? { ...x, steps: x.steps.filter((_, si) => si !== i) }
      : x)));
  }

  function addSequence() {
    const key = 'seq_' + Date.now();
    setSequences((prev) => [
      ...prev,
      { key, name: 'Nueva secuencia', stage: 'nutri', active: false, steps: [{ delay: 'Día 0 · inmediato', text: '' }] },
    ]);
    setSelSeq(key);
    setView('sequences');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '30px 36px 24px' }}>

      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '7px' }}>
            <h1 style={{ fontWeight: 600, fontSize: '40px', letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>WhatsApp</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px', borderRadius: '999px', background: 'var(--good-bg)', border: '1px solid var(--good)', color: 'var(--good)', fontSize: '12.5px', fontWeight: 600 }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--good)' }}></span>Chatwoot conectado
            </span>
          </div>
          <div style={{ fontSize: '14.5px', color: 'var(--dim)' }}>Conversaciones de los leads en <strong style={{ color: 'var(--ink)' }}>Nutrición</strong> · mensajes automáticos y manuales.</div>
        </div>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px', gap: '4px' }}>
          <button onClick={() => setView('chats')} style={isChats ? tabActive : tabIdle}>Conversaciones</button>
          <button onClick={() => setView('sequences')} style={!isChats ? tabActive : tabIdle}>Secuencias automáticas</button>
        </div>
      </header>

      {/* ============= CONVERSACIONES ============= */}
      {isChats && (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '330px 1fr 290px', gap: '16px' }}>

          {/* LISTA */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar conversación…"
                style={{ width: '100%', padding: '10px 13px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                {chatFilters.map((f) => (
                  <button key={f.k} onClick={f.onClick} style={f.style}>{f.label}</button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px' }}>
              {convList.map((c) => (
                <div key={c.id} onClick={c.onSelect} style={c.rowStyle}>
                  <div style={c.avatarStyle}>{c.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                      <span style={{ flex: 'none', fontSize: '11px', color: 'var(--faint)' }}>{c.time}</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--dim)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.preview}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '7px' }}>
                      <span style={c.stageChip}><span style={c.stageDot}></span>{c.stageLabel}</span>
                      {c.hasUnread && (
                        <span style={{ marginLeft: 'auto', flex: 'none', minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '999px', background: 'var(--good)', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* HILO */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                <div style={thread.avatarStyle}>{thread.initials}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '15.5px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{thread.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{thread.phone}</div>
                </div>
              </div>
              <span style={thread.stageChip}><span style={thread.stageDot}></span>{thread.stageLabel}</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--surface-2)' }}>
              {thread.msgs.map((m) => (
                <div key={m.key} style={m.wrapStyle}>
                  <div style={m.bubbleStyle}>
                    {m.auto && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: "'Geist Mono', monospace", fontSize: '10px', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--warn)', marginBottom: '5px' }}>⚡ Automático · {m.seq}</div>
                    )}
                    <div style={{ fontSize: '14px', lineHeight: 1.45, color: 'var(--ink)' }}>{m.text}</div>
                    <div style={m.timeStyle}>{m.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escribí un mensaje…"
                style={{ flex: 1, minHeight: '44px', maxHeight: '120px', resize: 'none', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', lineHeight: 1.4, outline: 'none' }}
              />
              <button onClick={send} style={{ flex: 'none', height: '44px', padding: '0 20px', borderRadius: '12px', border: 'none', background: 'var(--good)', color: '#fff', fontSize: '14.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>Enviar</button>
            </div>
          </div>

          {/* CONTEXTO */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', padding: '18px' }}>
            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '12px' }}>Lead</div>
            <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--ink)' }}>{thread.name}</div>
            <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '2px' }}>{thread.company}</div>
            <a href="/leads" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>Abrir ficha en CRM →</a>

            <div style={{ height: '1px', background: 'var(--border)', margin: '18px 0' }}></div>
            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '11px' }}>Secuencia activa</div>
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '13px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><span style={thread.stageDot}></span><span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)' }}>{thread.seqName}</span></div>
              <div style={{ fontSize: '12.5px', color: 'var(--dim)', marginTop: '8px' }}>Próximo mensaje</div>
              <div style={{ fontSize: '13.5px', color: 'var(--ink)', fontWeight: 600, marginTop: '2px' }}>{thread.nextMsg}</div>
            </div>
            {thread.hasSetter && (
              <div style={{ marginTop: '14px', background: 'rgba(79,91,213,.08)', border: '1px solid rgba(79,91,213,.25)', borderRadius: '12px', padding: '13px 14px' }}>
                <div style={{ fontSize: '11.5px', color: 'var(--faint)' }}>Setter asignado</div>
                <div style={{ fontSize: '14.5px', color: '#4F5BD5', fontWeight: 600, marginTop: '2px' }}>{thread.setter}</div>
              </div>
            )}
            <div style={{ height: '1px', background: 'var(--border)', margin: '18px 0' }}></div>
            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '11px' }}>Plantillas rápidas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {quickTemplates.map((t) => (
                <button key={t.label} onClick={t.onUse} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13px', cursor: 'pointer' }}>{t.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============= SECUENCIAS ============= */}
      {!isChats && (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px' }}>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Secuencias por etapa</div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {seqList.map((s) => (
                <div key={s.key} onClick={s.onSelect} style={s.rowStyle}>
                  <span style={s.dotStyle}></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--faint)', marginTop: '1px' }}>{s.stepCount} mensajes · {s.activeLabel}</div>
                  </div>
                </div>
              ))}
              <button onClick={addSequence} style={{ marginTop: '4px', padding: '11px', borderRadius: '10px', border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>+ Crear secuencia nueva</button>
            </div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}><span style={seqDetail.dotStyle}></span><input value={seqDetail.name} onChange={seqDetail.onName} style={{ fontWeight: 600, fontSize: '19px', letterSpacing: '-0.01em', color: 'var(--ink)', border: 'none', background: 'transparent', fontFamily: "'Geist', sans-serif", outline: 'none', padding: '2px 0', minWidth: '280px' }} /></div>
                <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '4px' }}>Se dispara cuando el lead entra en esta etapa de nutrición.</div>
              </div>
              <button onClick={seqDetail.onToggle} style={seqDetail.toggleStyle}>{seqDetail.toggleLabel}</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '22px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {seqDetail.steps.map((st) => (
                  <div key={st.key} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', width: '34px' }}>
                      <span style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--auto-bubble)', border: '1px solid var(--warn-fill)', color: 'var(--warn)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', fontFamily: "'Geist Mono', monospace" }}>{st.n}</span>
                      <span style={{ width: '2px', flex: 1, minHeight: '30px', background: 'var(--border)' }}></span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingBottom: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <input value={st.delay} onChange={st.onDelay} style={{ flex: 'none', width: '170px', padding: '7px 11px', borderRadius: '8px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist Mono', monospace", fontSize: '12px', outline: 'none' }} />
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--good)', fontWeight: 600 }}>⚡ WhatsApp</span>
                        <button onClick={st.onDelete} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--faint)', fontSize: '13px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", textDecoration: 'underline' }}>eliminar</button>
                      </div>
                      <textarea value={st.text} onChange={st.onText} style={{ width: '100%', minHeight: '74px', resize: 'vertical', padding: '12px 14px', borderRadius: '11px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', lineHeight: 1.5, outline: 'none' }} />
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ flex: 'none', width: '34px', display: 'flex', justifyContent: 'center' }}><span style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1px dashed var(--border-strong)', color: 'var(--faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>+</span></div>
                  <button onClick={seqDetail.addStep} style={{ flex: 1, textAlign: 'left', padding: '14px', borderRadius: '11px', border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>+ Agregar mensaje a la secuencia</button>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--faint)', marginTop: '14px', paddingLeft: '50px' }}>Usá <code style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '5px', padding: '1px 5px', fontFamily: "'Geist Mono', monospace" }}>{'{nombre}'}</code>, <code style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '5px', padding: '1px 5px', fontFamily: "'Geist Mono', monospace" }}>{'{empresa}'}</code> para personalizar.</div>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
