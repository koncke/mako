'use client';

// =============================================================================
// Closing Analysis — review automática del desempeño del closer en cada R1/R2
// =============================================================================
// Port del prototipo design-reference/Closing Analysis.dc.html. Datos de
// preview verbatim (state.calls). El filtro de closer cambia la lista visible;
// seleccionar una llamada actualiza el panel de detalle. KPIs computados de las
// llamadas; colores de score vía scoreColor; barras de dimensiones SPIN /
// Ejecución; momentos clave; recomendaciones de coaching.
// =============================================================================

import { useState, type CSSProperties } from 'react';

// ---- Tipos -----------------------------------------------------------------

type OutcomeTone = 'good' | 'warn' | 'bad';
type MomentTone = 'good' | 'bad' | 'neutral';
type DimGroup = 'spin' | 'exec';

type Dim = {
  g: DimGroup;
  label: string;
  score: number;
  note: string;
};

type Moment = {
  t: string;
  tone: MomentTone;
  tag: string;
  quote: string;
};

type Call = {
  id: string;
  lead: string;
  company: string;
  type: string;
  closer: string;
  date: string;
  duration: string;
  score: number;
  outcome: string;
  outcomeTone: OutcomeTone;
  summary: string;
  dims: Dim[];
  moments: Moment[];
  recs: string[];
};

// ---- Datos de preview (verbatim del prototipo) -----------------------------

const CALLS: Call[] = [
  {
    id: 'k1',
    lead: 'Carlos Méndez Ávila',
    company: 'Méndez Consultores',
    type: 'R2',
    closer: 'Mauricio Bustos',
    date: '15/06/2026',
    duration: '42 min',
    score: 8.4,
    outcome: 'Cierre ganado',
    outcomeTone: 'good',
    summary:
      'Llamada de cierre sólida. Mauricio mapeó el contexto rápido, cuantificó el costo de no resolver el problema y ancló el precio contra el costo de un SDR interno. Cerró fecha de primer pago dentro de la misma llamada. Único punto: tardó en pedir el cierre tras resolver la última objeción.',
    dims: [
      { g: 'spin', label: 'Situación', score: 9, note: 'Mapeó el modelo de negocio y volumen de reuniones en los primeros 6 minutos.' },
      { g: 'spin', label: 'Problema', score: 8, note: 'Identificó el dolor central: reuniones que no califican.' },
      { g: 'spin', label: 'Implicación', score: 9, note: 'Cuantificó cuánto cuesta al mes no resolverlo. Excelente.' },
      { g: 'spin', label: 'Necesidad / beneficio', score: 8, note: 'Conectó la solución directamente al ROI esperado.' },
      { g: 'exec', label: 'Presentación de la propuesta', score: 8, note: 'Precio presentado con anclaje claro y estructura simple.' },
      { g: 'exec', label: 'Manejo de objeciones', score: 8, note: 'Rebatió "lo voy a pensar" con un caso de un cliente similar.' },
      { g: 'exec', label: 'CTA / siguientes pasos', score: 9, note: 'Cerró fecha y monto del primer pago en la llamada.' },
    ],
    moments: [
      { t: '06:12', tone: 'good', tag: 'Buena pregunta de situación', quote: '"¿Cuántas reuniones calificadas están cerrando al mes hoy, y cuántas quisieran?"' },
      { t: '21:40', tone: 'good', tag: 'Anclaje de precio', quote: 'Ancló la inversión contra el costo total de un SDR interno a 12 meses.' },
      { t: '34:05', tone: 'bad', tag: 'Cierre tardío', quote: 'Resolvió la objeción pero siguió vendiendo 3 min antes de pedir el cierre.' },
    ],
    recs: [
      'Pedí el cierre apenas resolvés la objeción — ya estaba listo en 31:00.',
      'Replicá este nivel de "implicación" en las R1; es tu mayor fortaleza.',
    ],
  },
  {
    id: 'k2',
    lead: 'Mariana López',
    company: 'Grupo Norte',
    type: 'R1',
    closer: 'Andrea Ruiz',
    date: '14/06/2026',
    duration: '38 min',
    score: 5.6,
    outcome: 'Pasó a R2',
    outcomeTone: 'warn',
    summary:
      'Buena conexión inicial pero la llamada se quedó en la superficie. Andrea identificó el problema pero no cuantificó su impacto, así que la propuesta llegó sin urgencia. La objeción de presupuesto quedó sin rebatir — se pospuso a R2 sin compromiso claro.',
    dims: [
      { g: 'spin', label: 'Situación', score: 7, note: 'Buen rapport y contexto general del negocio.' },
      { g: 'spin', label: 'Problema', score: 6, note: 'Identificó el problema pero sin profundizar en sus causas.' },
      { g: 'spin', label: 'Implicación', score: 4, note: 'No cuantificó el costo de no resolverlo — faltó urgencia.' },
      { g: 'spin', label: 'Necesidad / beneficio', score: 6, note: 'Beneficios genéricos, poco atados al caso del lead.' },
      { g: 'exec', label: 'Presentación de la propuesta', score: 5, note: 'Mencionó precio sin anclaje ni estructura de valor.' },
      { g: 'exec', label: 'Manejo de objeciones', score: 4, note: 'Objeción de presupuesto quedó sin respuesta concreta.' },
      { g: 'exec', label: 'CTA / siguientes pasos', score: 6, note: 'Agendó R2 pero sin compromiso ni tarea para el lead.' },
    ],
    moments: [
      { t: '04:30', tone: 'good', tag: 'Buen rapport', quote: 'Generó confianza rápido mencionando un cliente del mismo rubro.' },
      { t: '19:15', tone: 'bad', tag: 'Faltó implicación', quote: 'El lead dijo "perdemos varias oportunidades" y no se preguntó cuántas ni cuánto valen.' },
      { t: '31:50', tone: 'bad', tag: 'Objeción sin rebatir', quote: '"Está fuera de mi presupuesto ahora" → se aceptó sin explorar.' },
    ],
    recs: [
      'Cuantificá siempre el problema: "¿cuánto te cuesta eso al mes?" abre la urgencia.',
      'Ante "no hay presupuesto", explorá: ¿es timing, prioridad o monto? Cada uno se rebate distinto.',
      'Cerrá la R1 con una micro-tarea para el lead — mantiene el compromiso vivo.',
    ],
  },
  {
    id: 'k3',
    lead: 'Salvador Loza',
    company: 'particular',
    type: 'R1',
    closer: 'Diego Fuentes',
    date: '08/06/2026',
    duration: '26 min',
    score: 3.8,
    outcome: 'Perdido',
    outcomeTone: 'bad',
    summary:
      'El lead llegó sin haber visto el VSL (34% de retención) y la llamada se fue casi entera en explicar lo básico de la oferta. Diego no calificó presupuesto ni timing al inicio, así que descubrió tarde que no había fit. Sin R2 ni siguiente paso.',
    dims: [
      { g: 'spin', label: 'Situación', score: 5, note: 'Contexto incompleto; no confirmó tamaño ni etapa del negocio.' },
      { g: 'spin', label: 'Problema', score: 4, note: 'El lead no tenía un dolor claro y no se ayudó a definirlo.' },
      { g: 'spin', label: 'Implicación', score: 3, note: 'Sin implicación — la conversación nunca llegó al costo del problema.' },
      { g: 'spin', label: 'Necesidad / beneficio', score: 4, note: 'Se explicó la oferta como features, no como solución a un dolor.' },
      { g: 'exec', label: 'Presentación de la propuesta', score: 4, note: 'Precio presentado a un lead no calificado; reacción defensiva.' },
      { g: 'exec', label: 'Manejo de objeciones', score: 3, note: 'No hubo manejo: ante la duda de precio, la llamada se diluyó.' },
      { g: 'exec', label: 'CTA / siguientes pasos', score: 3, note: 'Terminó sin R2 ni compromiso. Lead marcado Perdido.' },
    ],
    moments: [
      { t: '02:10', tone: 'bad', tag: 'No calificó al inicio', quote: 'No preguntó presupuesto ni timing en los primeros minutos.' },
      { t: '11:40', tone: 'bad', tag: 'Explicando lo básico', quote: 'Gran parte de la llamada fue explicar lo que el VSL ya cubre.' },
      { t: '24:00', tone: 'bad', tag: 'Sin cierre', quote: 'Cerró con "cualquier cosa me avisas" — sin siguiente paso definido.' },
    ],
    recs: [
      'Este lead nunca debió llegar a R1 con 34% de VSL — calificá retención antes de agendar.',
      'Abrí siempre con presupuesto y timing: ahorra llamadas a leads sin fit.',
      'Reactivá a Salvador con nutrición y material de ROI antes de otra llamada.',
    ],
  },
  {
    id: 'k4',
    lead: 'Patricia Núñez',
    company: 'Indubel',
    type: 'R2',
    closer: 'Mauricio Bustos',
    date: '15/06/2026',
    duration: '45 min',
    score: 7.9,
    outcome: 'Facturando',
    outcomeTone: 'good',
    summary:
      'Cierre técnico bien llevado. Buen manejo de la objeción de implementación. La propuesta se presentó con opciones (anclaje alto → plan recomendado). Pequeña oportunidad: el resumen de siguientes pasos quedó algo apurado al final.',
    dims: [
      { g: 'spin', label: 'Situación', score: 8, note: 'Retomó el contexto de la R1 sin hacer repetir al lead.' },
      { g: 'spin', label: 'Problema', score: 8, note: 'Reconfirmó el dolor y su evolución desde la R1.' },
      { g: 'spin', label: 'Implicación', score: 7, note: 'Buena, aunque podía empujar más el costo de oportunidad.' },
      { g: 'spin', label: 'Necesidad / beneficio', score: 8, note: 'Atado al caso puntual del lead.' },
      { g: 'exec', label: 'Presentación de la propuesta', score: 9, note: 'Tres opciones con anclaje alto; el plan recomendado se sintió obvio.' },
      { g: 'exec', label: 'Manejo de objeciones', score: 8, note: 'Resolvió la duda de tiempos de implementación con un plan claro.' },
      { g: 'exec', label: 'CTA / siguientes pasos', score: 7, note: 'Cerró, pero el detalle de siguientes pasos quedó algo apurado.' },
    ],
    moments: [
      { t: '12:05', tone: 'good', tag: 'Reconfirmó el dolor', quote: '"Desde que hablamos, ¿el problema creció o se mantuvo?" — gran apertura.' },
      { t: '28:30', tone: 'good', tag: 'Propuesta con anclaje', quote: 'Presentó 3 opciones; el plan medio se volvió la elección natural.' },
      { t: '43:20', tone: 'bad', tag: 'Cierre apurado', quote: 'Los siguientes pasos se enumeraron rápido sobre la hora.' },
    ],
    recs: [
      'Reservá 3-4 min al final para los siguientes pasos; reduce fricción en el cobro.',
      'Empujá un poco más el costo de oportunidad — el lead ya estaba caliente.',
    ],
  },
  {
    id: 'k5',
    lead: 'Hugo Treviño',
    company: 'Treviño y Asoc.',
    type: 'R2',
    closer: 'Andrea Ruiz',
    date: '04/04/2026',
    duration: '40 min',
    score: 8.1,
    outcome: 'Ganado',
    outcomeTone: 'good',
    summary:
      'La mejor llamada de Andrea del trimestre. Estructura SPIN limpia, propuesta clara y un cierre con urgencia genuina (cupo de onboarding). Manejó la objeción de "lo consulto con mi socio" sumando al socio a la decisión.',
    dims: [
      { g: 'spin', label: 'Situación', score: 8, note: 'Contexto retomado con precisión.' },
      { g: 'spin', label: 'Problema', score: 8, note: 'Dolor bien delimitado y validado por el lead.' },
      { g: 'spin', label: 'Implicación', score: 8, note: 'Cuantificó el costo mensual del problema.' },
      { g: 'spin', label: 'Necesidad / beneficio', score: 8, note: 'Beneficios traducidos a números del negocio.' },
      { g: 'exec', label: 'Presentación de la propuesta', score: 8, note: 'Clara y con estructura de valor antes del precio.' },
      { g: 'exec', label: 'Manejo de objeciones', score: 9, note: '"Lo consulto con mi socio" → propuso sumarlo a la decisión ahí mismo.' },
      { g: 'exec', label: 'CTA / siguientes pasos', score: 8, note: 'Cierre con urgencia real por cupo de onboarding.' },
    ],
    moments: [
      { t: '25:10', tone: 'good', tag: 'Objeción convertida', quote: 'Transformó "lo consulto con mi socio" en una decisión conjunta en la llamada.' },
      { t: '36:45', tone: 'good', tag: 'Urgencia genuina', quote: 'Usó el cupo de onboarding como cierre, sin sonar a presión.' },
    ],
    recs: [
      'Documentá esta llamada como referencia de entrenamiento para el equipo.',
      'Replicá la técnica de sumar al decisor faltante en otras R2.',
    ],
  },
];

// ---- Helpers ---------------------------------------------------------------

function scoreColor(s: number): string {
  return s >= 7.5 ? 'var(--good)' : s >= 5 ? 'var(--warn)' : 'var(--bad)';
}

function fmtScore(s: number): string {
  return Number.isInteger(s) ? s + '.0' : String(s);
}

function typeChip(type: string): CSSProperties {
  return {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '6px',
    fontFamily: "'Geist Mono', monospace",
    letterSpacing: '.04em',
    background: type === 'R2' ? 'rgba(14,158,142,.12)' : 'rgba(200,135,12,.12)',
    color: type === 'R2' ? '#0E8E7E' : '#9A6A09',
    border: '1px solid ' + (type === 'R2' ? 'rgba(14,158,142,.28)' : 'rgba(200,135,12,.30)'),
  };
}

const MO_TONE: Record<MomentTone, string> = {
  good: 'var(--good)',
  bad: 'var(--bad)',
  neutral: 'var(--warn)',
};

// ---- Componente ------------------------------------------------------------

export default function ClosingAnalysisPage() {
  const [closerFilter, setCloserFilter] = useState<string>('todos');
  const [selCall, setSelCall] = useState<string>('k1');

  // -- filtros de closer
  const closers = [...new Set(CALLS.map((c) => c.closer))];
  const filterDefs: { k: string; label: string }[] = [
    { k: 'todos', label: 'Todos' },
    ...closers.map((c) => ({ k: c, label: c.split(' ')[0] })),
  ];

  // -- llamadas visibles + selección efectiva
  const visible = CALLS.filter((c) => closerFilter === 'todos' || c.closer === closerFilter);
  const selId = visible.some((c) => c.id === selCall) ? selCall : visible[0] ? visible[0].id : null;

  const sel = CALLS.find((c) => c.id === selId) ?? CALLS[0];

  // -- KPIs
  const avg = CALLS.reduce((a, c) => a + c.score, 0) / CALLS.length;
  const best = CALLS.reduce((a, c) => (c.score > a.score ? c : a), CALLS[0]);

  const kpis: { label: string; value: string; sub: string; color: string }[] = [
    { label: 'Score promedio', value: fmtScore(Math.round(avg * 10) / 10), sub: '/ 10 · últimos 30d', color: scoreColor(avg) },
    { label: 'Llamadas analizadas', value: '28', sub: 'este mes', color: 'var(--ink)' },
    { label: 'Cierre del equipo', value: '64%', sub: 'sobre limpias', color: 'var(--good)' },
    { label: 'Mejor closer', value: best.closer.split(' ')[0], sub: fmtScore(best.score) + ' top score', color: 'var(--accent)' },
  ];

  // -- detalle: grupos de dimensiones
  const groupDefs: { key: DimGroup; label: string }[] = [
    { key: 'spin', label: 'Método SPIN' },
    { key: 'exec', label: 'Ejecución de venta' },
  ];

  const outcomeChip: CSSProperties = {
    display: 'inline-block',
    fontSize: '11.5px',
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: '999px',
    background:
      sel.outcomeTone === 'good' ? 'var(--good-bg)' : sel.outcomeTone === 'warn' ? 'var(--warn-bg)' : 'var(--bad-bg)',
    color: sel.outcomeTone === 'good' ? 'var(--good)' : sel.outcomeTone === 'warn' ? 'var(--warn)' : 'var(--bad)',
    border:
      '1px solid ' +
      (sel.outcomeTone === 'good' ? 'var(--good)' : sel.outcomeTone === 'warn' ? 'var(--warn-fill)' : 'var(--bad)'),
  };

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '30px 36px 22px' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '7px' }}>
            <h1 style={{ fontWeight: 600, fontSize: '40px', letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Closing Analysis</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px', borderRadius: '999px', background: 'var(--good-bg)', border: '1px solid var(--good)', color: 'var(--good)', fontSize: '12.5px', fontWeight: 600 }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--good)' }}></span>Fathom conectado
            </span>
          </div>
          <div style={{ fontSize: '14.5px', color: 'var(--dim)' }}>Review automática del desempeño del closer en cada R1 / R2 — Método SPIN, propuesta, objeciones y CTA.</div>
        </div>
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
          {filterDefs.map((f) => {
            const activeF = closerFilter === f.k;
            return (
              <button
                key={f.k}
                onClick={() => setCloserFilter(f.k)}
                style={{
                  padding: '8px 13px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontFamily: "'Geist', sans-serif",
                  fontSize: '13px',
                  fontWeight: 600,
                  border: '1px solid ' + (activeF ? 'var(--ink)' : 'var(--border-strong)'),
                  background: activeF ? 'var(--ink)' : 'var(--surface)',
                  color: activeF ? 'var(--on-sidebar)' : 'var(--dim)',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* KPIs */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '16px' }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 18px' }}>
            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '9px' }}>{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '27px', fontWeight: 600, color: k.color, fontVariantNumeric: 'tabular-nums' }}>{k.value}</span>
              <span style={{ fontSize: '12.5px', color: 'var(--faint)' }}>{k.sub}</span>
            </div>
          </div>
        ))}
      </section>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '340px 1fr', gap: '16px' }}>
        {/* LISTA DE LLAMADAS */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ padding: '15px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Llamadas analizadas</span>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11.5px', fontWeight: 600, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: '999px' }}>{visible.length}</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px' }}>
            {visible.map((c) => {
              const active = c.id === selId;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelCall(c.id)}
                  style={{
                    padding: '12px 13px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: active ? 'var(--surface-2)' : 'transparent',
                    border: '1px solid ' + (active ? 'var(--border-strong)' : 'transparent'),
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lead}</span>
                    <span style={{ flex: 'none', fontSize: '12.5px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', fontVariantNumeric: 'tabular-nums', color: '#fff', background: scoreColor(c.score) }}>{fmtScore(c.score)}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--dim)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.company}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '9px', flexWrap: 'wrap' }}>
                    <span style={typeChip(c.type)}>{c.type}</span>
                    <span style={{ fontSize: '11.5px', color: 'var(--dim)' }}>{c.closer}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--faint)' }}>{c.date} · {c.duration}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* DETALLE DEL ANÁLISIS */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                <span style={typeChip(sel.type)}>{sel.type}</span>
                <span style={outcomeChip}>{sel.outcome}</span>
              </div>
              <h2 style={{ fontWeight: 600, fontSize: '24px', letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>{sel.lead}</h2>
              <div style={{ fontSize: '13.5px', color: 'var(--dim)', marginTop: '3px' }}>
                {sel.company} · Closer: <strong style={{ color: 'var(--ink)' }}>{sel.closer}</strong> · {sel.date} · {sel.duration}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flex: 'none' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '34px', fontWeight: 600, lineHeight: 1, color: scoreColor(sel.score), fontVariantNumeric: 'tabular-nums' }}>{fmtScore(sel.score)}</div>
                <div style={{ fontSize: '11px', color: 'var(--faint)', fontFamily: "'Geist Mono', monospace" }}>SCORE / 10</div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* resumen */}
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '13px', padding: '16px 18px' }}>
              <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '9px' }}>Resumen del análisis</div>
              <div style={{ fontSize: '14.5px', lineHeight: 1.6, color: 'var(--ink)' }}>{sel.summary}</div>
              <div style={{ display: 'flex', gap: '14px', marginTop: '13px', flexWrap: 'wrap' }}>
                <a href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>▶ Ver grabación en Fathom</a>
                <a href="/leads" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--dim)', textDecoration: 'none' }}>Abrir ficha del lead →</a>
              </div>
            </div>

            {/* dimensiones */}
            {groupDefs.map((g) => (
              <div key={g.key}>
                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '12px' }}>{g.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                  {sel.dims
                    .filter((d) => d.g === g.key)
                    .map((d) => (
                      <div key={d.label}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{d.label}</span>
                          <span style={{ fontSize: '13.5px', fontWeight: 600, color: scoreColor(d.score), fontVariantNumeric: 'tabular-nums' }}>{fmtScore(d.score)} / 10</span>
                        </div>
                        <div style={{ height: '7px', borderRadius: '999px', background: 'var(--surface-2)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: d.score * 10 + '%', background: scoreColor(d.score), borderRadius: '999px' }}></div>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '6px', lineHeight: 1.5 }}>{d.note}</div>
                      </div>
                    ))}
                </div>
              </div>
            ))}

            {/* momentos clave */}
            <div>
              <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '12px' }}>Momentos clave de la transcripción</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sel.moments.map((m, i) => {
                  const accent = MO_TONE[m.tone];
                  return (
                    <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px', borderLeft: '3px solid ' + accent }}>
                      <span style={{ flex: 'none', fontFamily: "'Geist Mono', monospace", fontSize: '12px', fontWeight: 600, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: '7px' }}>{m.t}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13.5px', lineHeight: 1.55, color: 'var(--ink)' }}>{m.quote}</div>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: accent, marginTop: '4px' }}>{m.tag}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* recomendaciones */}
            <div style={{ background: 'rgba(200,135,12,.07)', border: '1px solid rgba(200,135,12,.28)', borderRadius: '13px', padding: '16px 18px' }}>
              <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A6A09', marginBottom: '12px' }}>Coaching · qué mejorar</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sel.recs.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ flex: 'none', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', marginTop: '7px' }}></span>
                    <span style={{ fontSize: '14px', lineHeight: 1.55, color: 'var(--ink)' }}>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
