'use client';

// =============================================================================
// Preguntale a Koncke™ — copiloto de marketing (PREVIEW con respuestas canned)
// =============================================================================
// Port del prototipo design-reference/Preguntale a Koncke.dc.html.
// Es intencionalmente un PREVIEW: no hay LLM en vivo. send() hace match por
// keywords contra CANNED (ad / salvador / cuello) o cae a DEFAULT_ANSWER;
// ask(key) agrega la Q canned + su respuesta. El layout ya aporta el <aside>
// y el rootStyle, así que esta pantalla devuelve sólo el <main>.
// =============================================================================

import { useState, type CSSProperties } from 'react';

// ---- Tipos -----------------------------------------------------------------

type Tone = 'warn' | 'bad' | 'good';

type DataChip = { label: string; value: string };

type Verdict = { tone: Tone; title: string; text: string };

type Message = {
  role: 'koncke' | 'user';
  text: string;
  data?: DataChip[];
  bullets?: string[];
  verdict?: Verdict;
};

type Canned = {
  q: string;
  text: string;
  data: DataChip[];
  bullets: string[];
  verdict: Verdict;
};

// ---- Datos (VERBATIM del prototipo) ----------------------------------------

const VTONE: Record<Tone, CSSProperties> = {
  warn: { background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', color: '#7A5908' },
  bad: { background: 'var(--bad-bg)', border: '1px solid var(--bad)', color: '#9E3719' },
  good: { background: 'var(--good-bg)', border: '1px solid var(--good)', color: '#15633D' },
};

const CANNED: Record<'ad' | 'salvador' | 'cuello', Canned> = {
  ad: {
    q: '¿Me recomendás apagar el ad "3 ADS RECON Capataz JUNIO 2026"?',
    text: 'Mirá los números antes de apagarlo — la señal es mixta pero tiene lectura clara.',
    data: [
      { label: 'Instant forms', value: '173' },
      { label: 'Agendas', value: '1' },
      { label: 'Gasto', value: '$481 · 10d' },
      { label: 'Intención ≥10', value: '173/10' },
    ],
    bullets: [
      'Genera MUCHOS forms (173) pero casi cero agendas (1). Es el patrón "bolita de nieve": intención altísima sin ritmo para escalar vertical.',
      'El adset ya gastó su techo 3 días seguidos (>199%). Meta ya encontró a quién mostrarlo — no va a escalar más en esta audiencia.',
      'El cuello real no es este ad: es Formulario → Agenda (2.2%). Apagarlo baja volumen pero no arregla la conversión.',
    ],
    verdict: {
      tone: 'warn',
      title: 'No lo apagues todavía',
      text: 'Bajá el presupuesto ~30% y sacá réplicas (bolitas de nieve) para buscar otra audiencia. Primero arreglá el seguimiento post-form (WhatsApp en <5 min) — ahí se está cayendo el volumen.',
    },
  },
  salvador: {
    q: '¿Por qué creés que no pude cerrar al lead Salvador Loza?',
    text: 'Salvador está marcado como Perdido. Juntando su rastro, el cierre se cayó antes de la propuesta:',
    data: [
      { label: 'Etapa', value: 'Perdido' },
      { label: 'Retención VSL', value: '34%' },
      { label: 'Visitas landing', value: '2' },
      { label: 'Origen', value: 'Visionario' },
    ],
    bullets: [
      'Vio solo 34% del VSL — llegó a la R1 sin entender la oferta, así que la reunión se fue en explicar lo básico en vez de cerrar.',
      'Es "particular" (sin empresa): menor presupuesto y ciclo más largo que tu ICP de agencias B2B.',
      'No hubo R2 ni fecha de confirmación: el proceso se cortó tras la R1 — señal de objeción no resuelta (precio o timing).',
    ],
    verdict: {
      tone: 'bad',
      title: 'Diagnóstico',
      text: 'No fue el cierre, fue la calificación. Leads con <50% de VSL deberían pasar por nutrición antes de la R1. Reactivá a Salvador con la secuencia "No Paga" y material de ROI.',
    },
  },
  cuello: {
    q: '¿Cuál es mi mayor cuello de botella esta semana?',
    text: 'Tu cuello está clarísimo en el funnel de este mes:',
    data: [
      { label: 'Form → Agenda', value: '2.2%' },
      { label: 'Benchmark', value: '~8%' },
      { label: 'Click → Form', value: '7.6%' },
    ],
    bullets: [
      'Completan el formulario pero no agendan la R1 (271 forms → 6 agendas).',
      'Click → Formulario también está flojo: el form pide más de lo que el anuncio promete.',
    ],
    verdict: {
      tone: 'warn',
      title: 'Dónde poner el foco',
      text: 'Acortá el instant form y reforzá el seguimiento inmediato (WhatsApp en <5 min). Eso mueve más cierres esta semana que subir presupuesto.',
    },
  },
};

const DEFAULT_ANSWER: { text: string; bullets: string[] } = {
  text: 'Buena pregunta. Estoy cruzando tu funnel en vivo, el CRM y tu histórico de cierres para responderte con números, no con corazonadas.',
  bullets: [
    'Para una respuesta con cifras exactas, asegurate de tener Fathom y Meta conectados (ya lo están ✓).',
    'Probá una de las preguntas sugeridas de abajo para ver un análisis completo con datos.',
  ],
};

const INITIAL_MESSAGES: Message[] = [
  {
    role: 'koncke',
    text:
      'Hola Mauricio 👋 Soy Koncke, tu copiloto de marketing. Tengo tu funnel en vivo, tus 286 leads del CRM y todo mi método cargado.\n\nPreguntame lo que sea: desde "¿apago este ad?" hasta "¿por qué no cerré a X lead?".',
  },
];

const SUGGESTIONS: { key: keyof typeof CANNED; label: string }[] = [
  { key: 'ad', label: '¿Apago el ad "Capataz JUNIO 2026"?' },
  { key: 'salvador', label: '¿Por qué no cerré a Salvador Loza?' },
  { key: 'cuello', label: '¿Mi mayor cuello de botella?' },
];

// ---- Componente ------------------------------------------------------------

export default function KonckePage() {
  const [draft, setDraft] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);

  function ask(key: keyof typeof CANNED) {
    const c = CANNED[key];
    if (!c) return;
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: c.q },
      { role: 'koncke', text: c.text, data: c.data, bullets: c.bullets, verdict: c.verdict },
    ]);
    setDraft('');
  }

  function send() {
    const q = draft.trim();
    if (!q) return;
    const lower = q.toLowerCase();
    let answer: { text: string; data?: DataChip[]; bullets?: string[]; verdict?: Verdict } =
      DEFAULT_ANSWER;
    if (lower.includes('apag') || lower.includes('ad ') || lower.includes('anuncio')) answer = CANNED.ad;
    else if (lower.includes('salvador') || lower.includes('loza') || lower.includes('cerr'))
      answer = CANNED.salvador;
    else if (lower.includes('cuello') || lower.includes('botella') || lower.includes('mejorar'))
      answer = CANNED.cuello;
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: q },
      { role: 'koncke', text: answer.text, data: answer.data, bullets: answer.bullets, verdict: answer.verdict },
    ]);
    setDraft('');
  }

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      <header style={{ width: '100%', maxWidth: 860, padding: '30px 28px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 46, height: 46, flex: 'none', borderRadius: 13, background: 'linear-gradient(150deg,#1F1B12,#3A2E14)', border: '1px solid rgba(240,198,10,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-soft)', fontSize: 22, animation: 'konckeGlow 3s infinite' }}>✦</div>
          <div>
            <h1 style={{ fontWeight: 600, fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Preguntale a Koncke™</h1>
            <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 5 }}>Tu copiloto de marketing — entrenado con el método Koncke + tu data en vivo.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 16 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '5px 11px', borderRadius: 999 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good)' }}></span>Funnel en vivo</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '5px 11px', borderRadius: 999 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good)' }}></span>286 leads · CRM</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '5px 11px', borderRadius: 999 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good)' }}></span>Meta Ads</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '5px 11px', borderRadius: 999 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good)' }}></span>Fathom · llamadas</span>
        </div>
      </header>

      {/* THREAD */}
      <div style={{ flex: 1, minHeight: 0, width: '100%', overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 860, padding: '14px 28px 8px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {messages.map((m, i) => {
            const isKoncke = m.role === 'koncke';
            const hasData = !!(m.data && m.data.length);
            const hasBullets = !!(m.bullets && m.bullets.length);
            const hasVerdict = !!m.verdict;
            const rowStyle: CSSProperties = isKoncke
              ? { display: 'flex', gap: 12, alignItems: 'flex-start' }
              : { display: 'flex', justifyContent: 'flex-end' };
            return (
              <div key={i} style={rowStyle}>

                {!isKoncke && (
                  <div style={{ maxWidth: '80%', padding: '12px 16px', borderRadius: '16px 16px 4px 16px', background: 'var(--ink)', color: 'var(--on-sidebar)', fontSize: 14.5, lineHeight: 1.5 }}>{m.text}</div>
                )}

                {isKoncke && (
                  <>
                    <div style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: 'linear-gradient(150deg,#1F1B12,#3A2E14)', border: '1px solid rgba(240,198,10,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-soft)', fontSize: 16 }}>✦</div>
                    <div style={{ flex: 1, minWidth: 0, maxWidth: 760 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>Koncke</span>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)' }}>copiloto</span>
                      </div>
                      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
                        <div style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink)', whiteSpace: 'pre-line' }}>{m.text}</div>

                        {hasData && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 13 }}>
                            {m.data!.map((d, di) => (
                              <div key={di} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
                                <div style={{ fontSize: 10.5, fontFamily: "'Geist Mono', monospace", letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)' }}>{d.label}</div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{d.value}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {hasBullets && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
                            {m.bullets!.map((b, bi) => (
                              <div key={bi} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                <span style={{ flex: 'none', width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', marginTop: 8 }}></span>
                                <span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--dim)' }}>{b}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {hasVerdict && (
                          <div style={{ ...VTONE[m.verdict!.tone], borderRadius: 12, padding: '13px 15px', marginTop: 14 }}>
                            <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{m.verdict!.title}</div>
                            <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{m.verdict!.text}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

              </div>
            );
          })}
        </div>
      </div>

      {/* COMPOSER */}
      <div style={{ width: '100%', maxWidth: 860, padding: '8px 28px 26px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => ask(s.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ color: 'var(--accent)' }}>✦</span>{s.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: '8px 8px 8px 16px', boxShadow: '0 4px 16px rgba(23,21,17,.06)' }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Preguntale a Koncke sobre tus ads, leads, cierres…"
            style={{ flex: 1, minHeight: 42, maxHeight: 140, resize: 'none', padding: '11px 0', border: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 14.5, lineHeight: 1.45, outline: 'none' }}
          />
          <button
            onClick={() => send()}
            style={{ flex: 'none', height: 42, width: 42, borderRadius: 11, border: 'none', background: 'var(--accent-soft)', color: '#171511', fontSize: 18, cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}
          >
            ↑
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--faint)', marginTop: 9 }}>Koncke usa tu data en vivo. Verificá decisiones de presupuesto antes de aplicarlas.</div>
      </div>

    </main>
  );
}
