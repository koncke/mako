// =============================================================================
// /vsl/estrategia — Documento INTERNO de oferta + estrategia de marketing.
// =============================================================================
// NO es una landing de venta: es la síntesis de la estrategia comercial de MaKo
// para presentarle a un mentor/consultor y pedirle opinión.
// Prioridad: minimalista + gráfico, en lenguaje llano y con nombres de sección
// explícitos. Menos prosa, más diagrama.
//
// Revisión 28-jul-2026 (5). Orden = orden del razonamiento:
//   producto → oferta → cómo consigo gente → con qué la engancho →
//   por qué agenda → cuánto da → qué viene después.
//
// Tasas de respuesta MUY distintas por canal, a propósito: en prospección abro
// yo la conversación (20% responde); en campaña escribieron ellos primero
// (70% responde).
//
// Autocontenido (mismo truco que _detalle/FeatureDetail): una capa
// position:fixed a pantalla completa que tapa y oculta el sidebar del layout
// raíz (body:has(.mk-str) aside{display:none}). Mismo lenguaje visual que /vsl:
// Geist, azul #2F6FED, oro MaKo #F2A516. Verde #0E9F6E para plata/neto.

// ── Datos ───────────────────────────────────────────────────────────────────

const TIERS = [
  {
    key: 'solo',
    name: 'MaKo Solo',
    price: '$497',
    badge: 'Peldaño de entrada · rescate',
    acceso: 'Autoservicio — sin respuesta garantizada de Martín',
    incluye: ['MaKo completo', 'Cursos', 'PDFs por función', 'Tutorial', 'Comunidad', 'Grabaciones de clases/mentorías', 'Onboarding 1a1 (regalo)'],
    quien: 'Corre un VSL Funnel pero no califica o no quiere el 1 a 1.',
    fueraPitch: true,
  },
  {
    key: 'grupal',
    name: 'MaKo Grupal',
    price: '$1,500',
    badge: 'Oferta de volumen',
    acceso: 'Grupo de WhatsApp con Martín (franja fija) + sesiones grupales',
    incluye: ['Todo lo del Solo', 'Acompañamiento grupal', 'Onboarding 1a1 (regalo)'],
    quien: 'Quiere acompañamiento sin pagar el 1 a 1.',
    fueraPitch: false,
  },
  {
    key: 'uno',
    name: 'MaKo 1 a 1',
    price: '$4,000',
    badge: 'Oferta principal',
    acceso: 'Mentoría personal — Martín se mete en tu negocio y decide con datos',
    incluye: ['Todo lo anterior', 'Mentoría 1 a 1'],
    quien: 'Quiere que Martín ejecute con él.',
    fueraPitch: false,
  },
] as const;

// Embudo por canal. Los dos terminan en "llamadas agendadas".
type Row = { l: string; v: string; rate?: string; hi?: boolean };

const CANAL_A: Row[] = [
  { l: 'Inversión', v: '$0' },
  { l: 'Conversaciones abiertas', v: '1,000' },
  { l: 'Responden', v: '200', rate: '20% — la abro yo' },
  { l: 'Llamadas agendadas', v: '7', rate: '3.5% de los que responden', hi: true },
];

const CANAL_B: Row[] = [
  { l: 'Inversión', v: '$1,000' },
  { l: 'Conversaciones iniciadas', v: '400', rate: '$2.50 cada una' },
  { l: 'Responden', v: '280', rate: '70% — escribieron ellos' },
  { l: 'Llamadas agendadas', v: '8', rate: '3% de los que responden', hi: true },
];

// Lead magnet: diagnóstico de UN anuncio (no del funnel completo).
const DIAG = [
  'Si el gancho frena el scroll o pasa desapercibido',
  'A qué tipo de cliente le está hablando — y a cuál no',
  'Qué razón de compra está usando',
  'Por qué ese anuncio no le trae agendas',
  'Qué cambiar para la próxima versión',
];

// Qué se analiza en la llamada.
const ANALISIS = [
  { t: 'Anuncios y creativos', w: 'Qué está corriendo hoy, con qué ángulos, y por qué no le trae agendas.' },
  { t: 'Landing', w: 'Si promete lo mismo que el anuncio, y en qué parte se le cae la gente.' },
  { t: 'VSL', w: 'Si retiene, en qué minuto se caen y qué le falta al guion para que pidan la llamada.' },
  { t: 'Mensajes de venta', w: 'Qué se le dice al lead entre que deja el dato y la llamada, y cómo se hace el seguimiento.' },
  { t: 'Oferta y precios', w: 'Qué vende, a cuánto, y por qué en la mayoría de los casos el precio no es el problema.' },
  { t: 'Los números del funnel', w: 'Cuánto le cuesta hoy un lead, una agenda y un cliente. Dónde está el cuello real.' },
];

// Lo que se lleva el prospecto de la llamada.
const LLEVA = [
  'A quién le tenés que vender — los tipos de cliente que hoy estás mezclando en un solo anuncio',
  'Por qué te va a comprar cada uno — las razones reales, no las que suponés',
  'Los guiones de tus anuncios, escritos',
  'Tus creativos, listos para publicar',
  'Con cuánto arrancar, qué publicar primero y cómo saber cuál está funcionando',
];

// Proyección financiera: de las llamadas al dinero.
const CIERRE = [
  { l: 'Llamadas agendadas', v: '15', rate: '7 de prospección + 8 de campaña' },
  { l: 'Llamadas efectivas', v: '12', rate: '80% asiste' },
  { l: 'Ventas', v: '5', rate: '40% cierra', hi: true },
];

const MIX = [
  { q: '1', name: 'MaKo 1 a 1', price: '$4,000 c/u', total: '$4,000', tone: 'uno' },
  { q: '4', name: 'MaKo Grupal', price: '$1,500 c/u', total: '$6,000', tone: 'grupal' },
];

const UNIT = [
  { l: 'Ticket promedio', v: '$2,000' },
  { l: 'Costo por llamada agendada (campaña)', v: '$125' },
  { l: 'Costo por cliente (campaña)', v: '$500' },
  { l: 'Retorno de la campaña', v: '3×' },
];

// Canales que quedan para después de los dos actuales.
const FUTURO = [
  {
    id: 'C',
    name: 'Referidos',
    cost: 'Costo cero',
    costTone: 'zero',
    what: 'Pedir referidos a la red, a los clientes y a cada persona prospectada, tenga o no interés propio.',
  },
  {
    id: 'D',
    name: 'Orgánico + Lead Magnet',
    cost: 'Casi cero',
    costTone: 'low',
    what: 'Los mismos creativos de la campaña, publicados en orgánico. “Comentá [palabra]” → ManyChat → link al diagnóstico → Calendly → CRM.',
  },
  {
    id: 'E',
    name: 'VSL Funnel propio + Ads',
    cost: 'Requiere caja',
    costTone: 'paid',
    what: 'El funnel ya está construido: landing /vsl, VSL, Calendly, diagnóstico y testimonios. Pide un presupuesto mínimo mayor que la campaña de mensajes, así que entra cuando la campaña ya esté dando señal.',
  },
  {
    id: 'F',
    name: 'Webinar',
    cost: 'Requiere caja',
    costTone: 'paid',
    what: 'Webinar de 3 días sobre VSL Funnel con CTA a llamada 1 a 1. Queda para cuando haya ads corriendo: ahí se automatiza, se repite todos los meses y no depende de llenar la sala a pulmón.',
  },
  {
    id: 'G',
    name: 'Asociarse con infoproductores',
    cost: 'Mayor palanca',
    costTone: 'lever',
    what: 'Un infoproductor con cientos de dueños que ya corren ads: un solo sí abre acceso a todos, ya calificados. Caso concreto: Jan.',
  },
] as const;

// ── Iconos mínimos ───────────────────────────────────────────────────────────

function Ic({ d, size = 18 }: { d: string[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}
const I = {
  target: ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0', 'M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'],
  layers: ['M12 3l9 5l-9 5l-9 -5z', 'M3 12l9 5l9 -5', 'M3 17l9 5l9 -5'],
  bolt: ['M13 3v7h6l-8 11v-7h-6z'],
  check: ['M5 12l4 4l10 -10'],
  chev: ['M9 6l6 6l-6 6'],
  chat: ['M8 9h8', 'M8 13h6', 'M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z'],
  megaphone: ['M18 8a3 3 0 0 1 0 6', 'M10 8v11a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-5', 'M12 8h0l4.524 -3.77a.9 .9 0 0 1 1.476 .692v12.156a.9 .9 0 0 1 -1.476 .692l-4.524 -3.77h-8a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h8'],
  video: ['M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z', 'M3 6m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z'],
};

// Escalerita de métricas de un canal.
function Ladder({ rows }: { rows: Row[] }) {
  return (
    <div className="s-mrows">
      {rows.map((r) => (
        <div key={r.l} className={`s-mrow ${r.hi ? 's-mrow-hi' : ''}`}>
          <span className="s-mrow-l">{r.l}</span>
          {r.rate && <span className="s-mrow-r">{r.rate}</span>}
          <span className="s-mrow-v s-num">{r.v}</span>
        </div>
      ))}
    </div>
  );
}

// Mini recorrido de 3 pasos (dentro de una tarjeta).
function Mini({ steps, tone }: { steps: string[]; tone: 'a' | 'b' }) {
  return (
    <div className={`s-mini s-mini-${tone}`}>
      {steps.map((s, i) => (
        <div key={s} className="s-mini-i">
          <span className="s-mini-n s-num">{i + 1}</span>
          <span>{s}</span>
        </div>
      ))}
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function Estrategia() {
  return (
    <div className="mk-str">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Header */}
      <header className="s-hdr">
        <div className="s-hdr-in">
          <div className="s-logo">
            <span className="s-logo-mark">
              <svg width="20" height="20" viewBox="-12 -12 24 24" aria-hidden="true"><path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E" /></svg>
            </span>
            <span className="s-logo-txt">MaKo</span>
            <span className="s-logo-sep" />
            <span className="s-logo-doc">Oferta &amp; Marketing</span>
          </div>
          <span className="s-hdr-meta">Documento interno · rev. 28 jul 2026</span>
        </div>
      </header>

      <main className="s-main">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="s-hero">
          <h1 className="s-h1">Cómo vamos a vender <span className="s-gold">MaKo</span></h1>
          <p className="s-lead">
            El software para vender high ticket con <strong>VSL Funnel</strong>. Una escalera de tres
            ofertas para que <strong>cualquier lead compre algo</strong>, empujada por dos canales:
            <strong> prospección</strong> a costo cero y <strong>campaña de mensajes</strong> a WhatsApp.
          </p>
        </section>

        {/* ── Producto + ICP ───────────────────────────────────────────────── */}
        <section className="s-sec">
          <h2 className="s-h2">El producto y a quién se le vende</h2>
          <div className="s-two">
            <a href="/vsl" className="s-card s-card-accent s-card-link">
              <div className="s-card-ic"><Ic d={I.layers} /></div>
              <h3 className="s-card-h">¿Qué es MaKo?</h3>
              <span className="s-card-link-cta">Verlo en la landing <span className="s-arr">→</span></span>
            </a>
            <div className="s-card">
              <div className="s-card-ic"><Ic d={I.target} /></div>
              <h3 className="s-card-h">El cliente ideal</h3>
              <ul className="s-icp">
                <li>Corre <b>o quiere correr</b> un VSL Funnel pago: coach, consultor o agencia con oferta validada.</li>
                <li>Ya no se exige facturar $10–20k. La base a la que se le puede escribir mañana casi no corre VSL Funnel todavía.</li>
                <li>Puede invertir en ads, aunque sea desde <b>~$20/día</b>.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── La oferta: escalera ──────────────────────────────────────────── */}
        <section className="s-sec s-band">
          <h2 className="s-h2">La oferta: una escalera de tres niveles</h2>
          <div className="s-tiers">
            {TIERS.map((t) => (
              <div key={t.key} className={`s-tier s-tier-${t.key}`}>
                {t.key === 'uno' && <span className="s-tier-ribbon">Principal</span>}
                <div className="s-tier-badge">{t.badge}</div>
                <h3 className="s-tier-name">{t.name}</h3>
                <div className="s-tier-price">
                  <span className="s-num">{t.price}</span>
                  <span className="s-tier-per">{t.key === 'solo' ? '4 meses (a confirmar) · pago único' : '4 meses · hasta 3 cuotas'}</span>
                </div>
                <div className="s-tier-acc">
                  <span className="s-tier-acc-l">Acceso a Martín</span>
                  {t.acceso}
                </div>
                <div className="s-tier-inc">
                  {t.incluye.map((x) => <span key={x} className="s-chip">{x}</span>)}
                </div>
                <div className="s-tier-quien"><b>Para quién:</b> {t.quien}</div>
                {t.fueraPitch && <div className="s-tier-note">Queda fuera del pitch — peldaño evergreen / rescate</div>}
              </div>
            ))}
          </div>
        </section>

        {/* ── Estrategia de adquisición ────────────────────────────────────── */}
        <section className="s-sec">
          <h2 className="s-h2">Estrategia de adquisición</h2>

          <div className="s-flow">
            <div className="s-flow-i">
              <div className="s-flow-ic"><Ic d={I.megaphone} size={26} /></div>
              <span className="s-flow-n">01</span>
              <h3>Prospección + campaña de mensajes</h3>
            </div>
            <div className="s-flow-arrow"><Ic d={I.chev} size={26} /></div>
            <div className="s-flow-i">
              <div className="s-flow-ic"><Ic d={I.chat} size={26} /></div>
              <span className="s-flow-n">02</span>
              <h3>Conversación por WhatsApp</h3>
            </div>
            <div className="s-flow-arrow"><Ic d={I.chev} size={26} /></div>
            <div className="s-flow-i s-flow-end">
              <div className="s-flow-ic"><Ic d={I.video} size={26} /></div>
              <span className="s-flow-n">03</span>
              <h3>Llamada 1 a 1</h3>
            </div>
          </div>

          <div className="s-motors">
            <div className="s-motor s-motor-a">
              <div className="s-motor-hd">
                <span className="s-motor-id">A</span>
                <div>
                  <h3 className="s-motor-name">Prospección</h3>
                  <span className="s-motor-sub">Círculo rojo + leads 100% fríos</span>
                </div>
                <span className="s-motor-cost s-motor-cost-zero">Costo cero</span>
              </div>
              <div className="s-motor-facts">
                <div><b>1,000</b> conversaciones abiertas en agosto</div>
                <div>La prospección es personalizada: <b>un Loom VSL por cada lead</b></div>
              </div>
              <Ladder rows={CANAL_A} />
            </div>

            <div className="s-motor s-motor-b">
              <div className="s-motor-hd">
                <span className="s-motor-id">B</span>
                <div>
                  <h3 className="s-motor-name">Campaña de mensajes</h3>
                  <span className="s-motor-sub">Meta optimizando a WhatsApp</span>
                </div>
                <span className="s-motor-cost s-motor-cost-paid">$1,000</span>
              </div>
              <div className="s-spend">
                <div className="s-sp s-sp-1">
                  <div className="s-sp-hd"><span className="s-sp-n">Fase 1</span><span className="s-sp-t">Ad ganador</span></div>
                  <div className="s-sp-v s-num">$300</div>
                </div>
                <div className="s-sp s-sp-2">
                  <div className="s-sp-hd"><span className="s-sp-n">Fase 2</span><span className="s-sp-t">Escalar</span></div>
                  <div className="s-sp-v s-num">$700</div>
                </div>
              </div>
              <Ladder rows={CANAL_B} />
            </div>
          </div>
        </section>

        {/* ── Lead magnet y nutrición ──────────────────────────────────────── */}
        <section className="s-sec s-band">
          <h2 className="s-h2">El lead magnet y la nutrición personalizada</h2>
          <div className="s-open">
            <div className="s-open-col s-open-b">
              <div className="s-open-hd">
                <span className="s-open-tag">Campaña de mensajes</span>
                <h3>Diagnóstico de anuncios</h3>
              </div>
              <Mini tone="b" steps={['Manda su anuncio', 'MaKo lo analiza', 'Recibe el diagnóstico']} />
              <div className="s-diag">
                <span className="s-diag-l">Qué le decimos de su anuncio</span>
                <ul>
                  {DIAG.map((d) => (
                    <li key={d}><Ic d={I.check} size={14} /><span>{d}</span></li>
                  ))}
                </ul>
              </div>
              <div className="s-bridge">
                <span className="s-bridge-a">Su anuncio</span>
                <Ic d={I.chev} size={16} />
                <span className="s-bridge-b">Su funnel completo, en la llamada</span>
              </div>
              <div className="s-open-rule">
                Diagnosticar <b>un solo anuncio</b> es fácil de vender en frío y se entrega en minutos. Y deja
                el puente servido: el anuncio es la punta, lo demás se ve en la llamada.
              </div>
            </div>

            <div className="s-open-col s-open-a">
              <div className="s-open-hd">
                <span className="s-open-tag">Prospección</span>
                <h3>Un Loom VSL por cada lead</h3>
              </div>
              <Mini tone="a" steps={['Miro su negocio', 'Grabo un video para él', 'Cierro con el link']} />
              <div className="s-diag s-diag-a">
                <span className="s-diag-l">Qué se mira antes de grabar</span>
                <ul>
                  <li><Ic d={I.check} size={14} /><span>Su Instagram y su marca personal</span></li>
                  <li><Ic d={I.check} size={14} /><span>Su biblioteca de anuncios: qué corre y hace cuánto</span></li>
                  <li><Ic d={I.check} size={14} /><span>Su landing, su oferta y a quién le habla hoy</span></li>
                </ul>
                <span className="s-diag-l">Qué se le dice</span>
                <ul>
                  <li><Ic d={I.check} size={14} /><span>A quién le está vendiendo, visto desde afuera</span></li>
                  <li><Ic d={I.check} size={14} /><span>A qué otros clientes les podría vender y no lo hace</span></li>
                  <li><Ic d={I.check} size={14} /><span>Qué haría yo en su lugar, concreto</span></li>
                </ul>
              </div>
              <div className="s-open-rule s-open-rule-a">
                Acá <b>no va recurso gratis</b>: al que te conoce o al que le escribís a mano se le entra por
                lo consultivo, con el análisis ya hecho antes de hablarle.
              </div>
            </div>
          </div>
        </section>

        {/* ── Por qué agenda ───────────────────────────────────────────────── */}
        <section className="s-sec">
          <h2 className="s-h2">Por qué te agenda la llamada</h2>
          <div className="s-egoist">
            <p className="s-egoist-q">“Salís de la llamada con toda tu estrategia para conseguir clientes con anuncios pagos, armada para tu negocio.”</p>
            <ul className="s-lleva">
              {LLEVA.map((x) => (
                <li key={x}><Ic d={I.check} size={15} /><span>{x}</span></li>
              ))}
            </ul>
          </div>

          <div className="s-sub-h">Qué se analiza, punto por punto</div>
          <div className="s-anal">
            {ANALISIS.map((a, i) => (
              <div key={a.t} className="s-anal-i">
                <span className="s-anal-n s-num">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <b>{a.t}</b>
                  <span>{a.w}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Proyección financiera ────────────────────────────────────────── */}
        <section className="s-sec s-band">
          <h2 className="s-h2">Proyección financiera</h2>
          <p className="s-sec-sub">El objetivo es <b>$10,000</b> en el mes. Las 15 llamadas agendadas vienen de los dos canales de adquisición.</p>

          <div className="s-close">
            {CIERRE.map((c) => (
              <div key={c.l} className={`s-close-i ${c.hi ? 's-close-hi' : ''}`}>
                <span className="s-close-l">{c.l}</span>
                <span className="s-close-v s-num">{c.v}</span>
                <span className="s-close-r">{c.rate}</span>
              </div>
            ))}
          </div>

          <div className="s-sub-h">Qué hay que vender</div>
          <div className="s-mix">
            {MIX.map((m) => (
              <div key={m.name} className={`s-mix-row s-mix-${m.tone}`}>
                <span className="s-mix-q s-num">{m.q}×</span>
                <span className="s-mix-n">{m.name}</span>
                <span className="s-mix-p s-num">{m.price}</span>
                <span className="s-mix-t s-num">{m.total}</span>
              </div>
            ))}
            <div className="s-mix-row s-mix-total">
              <span className="s-mix-q s-num">5</span>
              <span className="s-mix-n">ventas en el mes</span>
              <span className="s-mix-p">ticket promedio $2,000</span>
              <span className="s-mix-t s-num">$10,000</span>
            </div>
          </div>

          <div className="s-goal">
            <div className="s-goal-i">
              <span className="s-goal-l">Facturado</span>
              <span className="s-goal-v s-num">$10,000</span>
            </div>
            <span className="s-goal-op">−</span>
            <div className="s-goal-i">
              <span className="s-goal-l">Inversión en ads</span>
              <span className="s-goal-v s-num">$1,000</span>
            </div>
            <span className="s-goal-op">=</span>
            <div className="s-goal-i s-goal-net">
              <span className="s-goal-l">Neto</span>
              <span className="s-goal-v s-num">$9,000</span>
            </div>
          </div>

          <div className="s-sub-h">Números por unidad</div>
          <div className="s-units">
            {UNIT.map((u) => (
              <div key={u.l} className="s-unit">
                <span className="s-unit-v s-num">{u.v}</span>
                <span className="s-unit-l">{u.l}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Canales a futuro ─────────────────────────────────────────────── */}
        <section className="s-sec s-sec-last">
          <h2 className="s-h2">Canales de adquisición a futuro</h2>
          <p className="s-sec-sub">Todos son válidos y ninguno está descartado. Entran después de que los dos canales actuales estén dando señal.</p>
          <div className="s-chs">
            {FUTURO.map((c) => (
              <div key={c.id} className={`s-ch ${c.id === 'G' ? 's-ch-lever' : ''}`}>
                <div className="s-ch-top">
                  <span className="s-ch-id">{c.id}</span>
                  <span className={`s-ch-cost s-ch-cost-${c.costTone}`}>{c.cost}</span>
                </div>
                <h3 className="s-ch-name">{c.name}</h3>
                <p className="s-ch-what">{c.what}</p>
              </div>
            ))}
          </div>

          <div className="s-lever-detail">
            <div className="s-lever-h"><Ic d={I.bolt} size={16} /> Propuesta concreta — Jan</div>
            <div className="s-lever-cols">
              <div>
                <span className="s-lever-k">Qué gana Jan</span>
                <ul>
                  <li>Acceso personal <b>de por vida</b> a MaKo y todas sus versiones futuras.</li>
                  <li><b>Licencia de reventa</b> para todos sus clientes → sube el valor de su oferta.</li>
                  <li>Sus clientes acceden a una <b>prueba gratuita extendida</b>.</li>
                  <li>Cobra una <b>recurrencia</b> a sus clientes sin mover un dedo, solo sumando MaKo.</li>
                  <li><b>Su metodología</b> implementada en el software, para vender exactamente lo que él ofrece.</li>
                  <li>Trabajo para que MaKo se use al <b>100% en productos</b>.</li>
                </ul>
              </div>
              <div>
                <span className="s-lever-k">Qué gano yo</span>
                <ul>
                  <li>Jan me ayuda <b>1a1 con mis ads</b> (RECON).</li>
                  <li>Me recomienda ya con <b>≥3 de sus clientes</b> para mi high ticket. El dinero del cierre va 100% a los ads que Jan me recomiende.</li>
                  <li><b>% de ganancias</b> a futuro con todos sus clientes que usen MaKo.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="s-foot">
        <div className="s-foot-in">
          <span className="s-logo">
            <span className="s-logo-mark"><svg width="18" height="18" viewBox="-12 -12 24 24" aria-hidden="true"><path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E" /></svg></span>
            <span className="s-logo-txt">MaKo</span>
          </span>
          <p className="s-foot-tag">Documento interno de oferta y estrategia de marketing · Martín Koncke</p>
          <p className="s-foot-src">Revisión 28 de julio de 2026. No distribuir.</p>
        </div>
      </footer>
    </div>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const CSS = `
body:has(.mk-str) aside { display: none !important; }

.mk-str {
  position: fixed; inset: 0; z-index: 100;
  overflow-y: auto; overflow-x: hidden;
  background: #FBFCFD; color: #171A21;
  font-family: 'Geist', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.mk-str * { box-sizing: border-box; }
.mk-str ::selection { background: rgba(47,111,237,.15); }
.s-num { font-family: 'Geist Mono', ui-monospace, monospace; font-feature-settings: 'tnum' 1; letter-spacing: -.01em; }
.s-gold { color: #E09612; }

/* Header */
.s-hdr { position: sticky; top: 0; z-index: 40; background: rgba(251,252,253,.85); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-bottom: 1px solid #ECEEF2; }
.s-hdr-in { max-width: 1060px; margin: 0 auto; padding: 0 28px; height: 60px; display: flex; align-items: center; justify-content: space-between; }
.s-logo { display: flex; align-items: center; gap: 9px; }
.s-logo-mark { width: 32px; height: 32px; border-radius: 9px; background: #1A1712; display: flex; align-items: center; justify-content: center; flex: none; }
.s-logo-txt { font-weight: 700; font-size: 22px; letter-spacing: -.02em; color: #171A21; }
.s-logo-sep { width: 1px; height: 20px; background: #D8DCE3; margin: 0 3px; }
.s-logo-doc { font-size: 14px; font-weight: 600; color: #6B7482; }
.s-hdr-meta { font-size: 12.5px; font-weight: 500; color: #9AA3B0; letter-spacing: .01em; }

.s-main { max-width: 1060px; margin: 0 auto; padding: 0 28px; }

/* Hero */
.s-hero { padding: 56px 0 44px; border-bottom: 1px solid #EEF0F4; }
.s-h1 { margin: 0 0 18px; font-size: 52px; line-height: 1.04; letter-spacing: -.03em; font-weight: 600; color: #10131A; text-wrap: balance; }
.s-lead { margin: 0; max-width: 660px; font-size: 19px; line-height: 1.6; color: #5B6472; }
.s-lead strong { font-weight: 600; color: #10131A; }

/* Secciones */
.s-sec { padding: 46px 0; border-bottom: 1px solid #EEF0F4; }
.s-sec-last { border-bottom: none; padding-bottom: 60px; }
.s-band { background: #F1F5FB; box-shadow: 0 0 0 100vmax #F1F5FB; clip-path: inset(0 -100vmax); border-bottom: none; }
.s-h2 { margin: 0 0 8px; font-size: 27px; line-height: 1.15; letter-spacing: -.02em; font-weight: 600; color: #10131A; }
.s-sub-h { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #2F6FED; margin: 32px 0 12px; }
.s-sec-sub { margin: 2px 0 22px; font-size: 16px; line-height: 1.55; color: #5B6472; max-width: 760px; }
.s-sec-sub b { color: #10131A; font-weight: 600; }

/* Cuadro "¿Qué es MaKo?" = link a la landing */
.s-card-link { text-decoration: none; color: inherit; display: flex; flex-direction: column; transition: border-color .18s ease, transform .18s ease; }
.s-card-link:hover { border-color: #BFD3F7; transform: translateY(-2px); }
.s-card-link-cta { margin-top: auto; display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: #2F6FED; }
.s-card-link .s-arr { transition: transform .18s ease; }
.s-card-link:hover .s-arr { transform: translateX(3px); }

/* Cards genéricas */
.s-two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 22px; align-items: stretch; }
.s-card { background: #fff; border: 1px solid #E9EBF0; border-radius: 16px; padding: 22px 24px; }
.s-card-accent { border-color: #D3E0FB; background: linear-gradient(165deg,#F4F8FE,#FFFFFF 60%); }
.s-card-ic { width: 40px; height: 40px; border-radius: 11px; background: #EAF1FE; color: #2F6FED; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
.s-card-h { margin: 0 0 10px; font-size: 17px; font-weight: 600; color: #10131A; }
.s-icp { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 11px; }
.s-icp li { position: relative; padding-left: 18px; font-size: 15px; line-height: 1.5; color: #565E6B; }
.s-icp li::before { content: ''; position: absolute; left: 0; top: 9px; width: 6px; height: 6px; border-radius: 50%; background: #2F6FED; }
.s-icp b { color: #10131A; font-weight: 600; }

/* Niveles */
.s-tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 24px; align-items: stretch; }
.s-tier { position: relative; background: #fff; border: 1px solid #E5E8EE; border-radius: 18px; padding: 24px 22px; display: flex; flex-direction: column; }
.s-tier-grupal { border-color: #C7D9FA; }
.s-tier-uno { border: 1.5px solid #F0C169; background: linear-gradient(172deg,#FFFBF2,#FFFFFF 55%); box-shadow: 0 22px 44px -30px rgba(224,150,18,.5); }
.s-tier-ribbon { position: absolute; top: 16px; right: 16px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #3A2604; background: linear-gradient(135deg,#F2A516,#E0870A); padding: 4px 10px; border-radius: 7px; }
.s-tier-badge { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: #8892A0; margin-bottom: 12px; }
.s-tier-grupal .s-tier-badge { color: #2F6FED; }
.s-tier-uno .s-tier-badge { color: #C77E08; }
.s-tier-name { margin: 0 0 10px; font-size: 20px; font-weight: 600; color: #10131A; }
.s-tier-price { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
.s-tier-price .s-num { font-size: 34px; font-weight: 600; letter-spacing: -.03em; color: #10131A; }
.s-tier-per { font-size: 12px; color: #9AA3B0; }
.s-tier-acc { font-size: 13.5px; line-height: 1.45; color: #454C58; background: #F5F7FA; border-radius: 10px; padding: 11px 13px; margin-bottom: 14px; }
.s-tier-uno .s-tier-acc { background: #FDF6E8; }
.s-tier-grupal .s-tier-acc { background: #F0F5FE; }
.s-tier-acc-l { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #9AA3B0; margin-bottom: 4px; }
.s-tier-inc { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.s-chip { font-size: 12px; font-weight: 500; color: #4B5563; background: #EEF1F5; padding: 4px 10px; border-radius: 7px; }
.s-tier-quien { font-size: 13.5px; line-height: 1.5; color: #565E6B; margin-top: auto; }
.s-tier-quien b { color: #10131A; font-weight: 600; }
.s-tier-note { margin-top: 12px; font-size: 12px; line-height: 1.45; color: #9A6207; background: #FEF6E4; border-radius: 8px; padding: 8px 11px; }

/* Recorrido en 3 pasos */
.s-flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 10px; align-items: stretch; margin-top: 24px; }
.s-flow-i { position: relative; background: #fff; border: 1px solid #E5E8EE; border-radius: 18px; padding: 26px 24px 24px; display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
.s-flow-end { border-color: #F0C169; background: linear-gradient(165deg,#FFFBF2,#FFFFFF 60%); }
.s-flow-ic { width: 48px; height: 48px; border-radius: 14px; background: #EAF1FE; color: #2F6FED; display: flex; align-items: center; justify-content: center; }
.s-flow-end .s-flow-ic { background: #FDF0D8; color: #C77E08; }
.s-flow-n { position: absolute; top: 20px; right: 22px; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 13px; font-weight: 600; color: #C6CCD5; }
.s-flow-i h3 { margin: 0; font-size: 19px; line-height: 1.3; font-weight: 600; letter-spacing: -.015em; color: #10131A; text-wrap: balance; }
.s-flow-arrow { display: flex; align-items: center; justify-content: center; color: #C0C7D2; }

/* Los dos canales */
.s-motors { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; align-items: stretch; }
.s-motor { background: #fff; border: 1px solid #E9EBF0; border-radius: 18px; padding: 22px 24px; display: flex; flex-direction: column; }
.s-motor-a { border-color: #CBEBDC; }
.s-motor-b { border-color: #C7D9FA; }
.s-motor-hd { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.s-motor-hd > div { flex: 1; min-width: 0; }
.s-motor-id { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; font-size: 15px; font-weight: 700; color: #fff; background: #0E9F6E; }
.s-motor-b .s-motor-id { background: #2F6FED; }
.s-motor-name { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -.01em; color: #10131A; }
.s-motor-sub { font-size: 12.5px; color: #8892A0; }
.s-motor-cost { flex: none; font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 7px; }
.s-motor-cost-zero { color: #067A54; background: #DEF4EA; }
.s-motor-cost-paid { color: #1D4FD8; background: #E7EFFE; }
.s-motor-facts { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
.s-motor-facts > div { font-size: 14px; line-height: 1.45; color: #565E6B; background: #F5FAF7; border-radius: 10px; padding: 12px 14px; }
.s-motor-facts b { color: #10131A; font-weight: 600; }

/* Plan de gasto (dentro del canal B) */
.s-spend { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
.s-sp { border: 1px solid #E9EBF0; border-radius: 14px; padding: 15px 17px; }
.s-sp-1 { border-color: #C7D9FA; background: #F7FAFF; }
.s-sp-2 { border-color: #CBEBDC; background: #F5FCF9; }
.s-sp-hd { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; margin-bottom: 8px; }
.s-sp-n { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #fff; background: #2F6FED; padding: 3px 8px; border-radius: 6px; }
.s-sp-2 .s-sp-n { background: #0E9F6E; }
.s-sp-t { font-size: 13.5px; font-weight: 600; color: #10131A; }
.s-sp-v { font-size: 26px; font-weight: 600; letter-spacing: -.03em; color: #10131A; line-height: 1.1; }

/* Embudo por canal */
.s-mrows { display: flex; flex-direction: column; margin-top: auto; }
.s-mrow { display: flex; align-items: baseline; gap: 10px; padding: 11px 0; border-top: 1px solid #F0F2F6; }
.s-mrow:first-child { border-top: none; padding-top: 0; }
.s-mrow-l { flex: 1; min-width: 0; font-size: 14px; color: #565E6B; }
.s-mrow-r { font-size: 11.5px; color: #9AA3B0; white-space: nowrap; }
.s-mrow-v { flex: none; width: 70px; text-align: right; font-size: 17px; font-weight: 600; color: #10131A; }
.s-mrow-hi { margin-top: 6px; padding: 14px 15px; border-top: none; border-radius: 12px; background: #F1F8F5; }
.s-mrow-hi .s-mrow-l { font-weight: 600; color: #10131A; }
.s-mrow-hi .s-mrow-v { color: #067A54; font-size: 22px; }
.s-motor-b .s-mrow-hi { background: #F0F5FE; }
.s-motor-b .s-mrow-hi .s-mrow-v { color: #1D4FD8; }

/* Lead magnet y nutrición */
.s-open { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 22px; align-items: start; }
.s-open-col { background: #fff; border: 1px solid #E9EBF0; border-radius: 18px; padding: 24px 26px; }
.s-open-b { border-color: #C7D9FA; }
.s-open-a { border-color: #CBEBDC; }
.s-open-hd { margin-bottom: 16px; }
.s-open-tag { display: inline-block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding: 3px 9px; border-radius: 6px; margin-bottom: 9px; color: #1D4FD8; background: #E7EFFE; }
.s-open-a .s-open-tag { color: #067A54; background: #DEF4EA; }
.s-open-hd h3 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -.015em; color: #10131A; }

/* Mini recorrido de 3 pasos */
.s-mini { display: flex; gap: 8px; margin-bottom: 16px; }
.s-mini-i { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 7px; background: #F7FAFF; border-radius: 12px; padding: 13px 14px; font-size: 13px; line-height: 1.35; font-weight: 500; color: #454C58; }
.s-mini-a .s-mini-i { background: #F5FAF7; }
.s-mini-n { width: 20px; height: 20px; border-radius: 6px; background: #2F6FED; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.s-mini-a .s-mini-n { background: #0E9F6E; }

/* Listas de diagnóstico */
.s-diag { border-radius: 12px; padding: 16px 18px; background: #F7FAFF; }
.s-diag-a { background: #F5FAF7; }
.s-diag-l { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #1D4FD8; margin-bottom: 10px; }
.s-diag-a .s-diag-l { color: #067A54; }
.s-diag ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.s-diag ul + .s-diag-l { margin-top: 16px; }
.s-diag li { display: flex; gap: 9px; font-size: 13.5px; line-height: 1.45; color: #565E6B; }
.s-diag svg { flex: none; margin-top: 2px; color: #2F6FED; }
.s-diag-a svg { color: #0E9F6E; }

/* Puente anuncio → funnel */
.s-bridge { display: flex; align-items: center; gap: 10px; margin-top: 14px; color: #C0C7D2; }
.s-bridge-a, .s-bridge-b { font-size: 13.5px; font-weight: 600; padding: 10px 14px; border-radius: 10px; }
.s-bridge-a { color: #4E5765; background: #EEF1F5; }
.s-bridge-b { flex: 1; color: #3A2604; background: linear-gradient(120deg,#FDF0D8,#FFF8EA); }

.s-open-rule { margin-top: 14px; font-size: 13px; line-height: 1.55; color: #7A5406; background: #FFF9EC; border: 1px solid #F3E2B5; border-radius: 10px; padding: 12px 14px; }
.s-open-rule b { color: #5C3F04; font-weight: 700; }
.s-open-rule-a { color: #4E5765; background: #F5F7FA; border-color: #E5E8EE; }
.s-open-rule-a b { color: #10131A; }

/* Por qué agenda */
.s-egoist { margin-top: 20px; border: 1px solid #F0C169; border-radius: 18px; padding: 28px 30px; background: linear-gradient(160deg,#FFFBF2,#FFFFFF 60%); }
.s-egoist-q { margin: 0 0 20px; font-size: 23px; line-height: 1.4; font-weight: 600; letter-spacing: -.015em; color: #10131A; text-wrap: balance; }
.s-lleva { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 26px; }
.s-lleva li { display: flex; gap: 9px; font-size: 14.5px; line-height: 1.5; color: #454C58; }
.s-lleva svg { flex: none; margin-top: 3px; color: #0E9F6E; }

/* Qué se analiza en la llamada */
.s-anal { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.s-anal-i { display: flex; gap: 12px; background: #fff; border: 1px solid #E9EBF0; border-radius: 14px; padding: 18px 20px; }
.s-anal-n { flex: none; font-size: 14px; font-weight: 600; color: #C6CCD5; }
.s-anal-i b { display: block; font-size: 15px; font-weight: 600; color: #10131A; margin-bottom: 5px; }
.s-anal-i span:last-child { font-size: 13px; line-height: 1.55; color: #6B7482; }

/* Proyección: de las llamadas a las ventas */
.s-close { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 4px; }
.s-close-i { background: #fff; border: 1px solid #E9EBF0; border-radius: 16px; padding: 20px 22px; display: flex; flex-direction: column; gap: 4px; }
.s-close-hi { border-color: #CBEBDC; background: linear-gradient(160deg,#EAF8F1,#FFFFFF 70%); }
.s-close-l { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #8892A0; }
.s-close-hi .s-close-l { color: #067A54; }
.s-close-v { font-size: 34px; font-weight: 600; letter-spacing: -.03em; color: #10131A; line-height: 1.1; }
.s-close-hi .s-close-v { color: #067A54; }
.s-close-r { font-size: 12.5px; color: #7C8593; }

/* Proyección: mix */
.s-mix { display: flex; flex-direction: column; gap: 8px; }
.s-mix-row { display: flex; align-items: center; gap: 14px; background: #fff; border: 1px solid #E9EBF0; border-radius: 12px; padding: 14px 18px; font-size: 14.5px; color: #565E6B; }
.s-mix-uno { border-color: #F0C169; background: linear-gradient(120deg,#FFFBF2,#FFFFFF 55%); }
.s-mix-grupal { border-color: #C7D9FA; }
.s-mix-q { flex: none; width: 38px; font-size: 17px; font-weight: 600; color: #10131A; }
.s-mix-n { flex: 1; min-width: 0; font-weight: 600; color: #10131A; }
.s-mix-p { font-size: 13px; color: #8892A0; }
.s-mix-t { flex: none; width: 92px; text-align: right; font-size: 17px; font-weight: 600; color: #10131A; }
.s-mix-total { background: #10131A; border-color: #10131A; color: #C6CCD5; }
.s-mix-total .s-mix-q, .s-mix-total .s-mix-n, .s-mix-total .s-mix-t { color: #fff; }
.s-mix-total .s-mix-p { color: #9AA3B0; }

/* Proyección: objetivo */
.s-goal { display: flex; align-items: stretch; gap: 14px; flex-wrap: wrap; margin-top: 16px; }
.s-goal-i { flex: 1; min-width: 150px; background: #fff; border: 1px solid #E9EBF0; border-radius: 16px; padding: 18px 22px; display: flex; flex-direction: column; gap: 4px; }
.s-goal-net { border-color: #CBEBDC; background: linear-gradient(160deg,#EAF8F1,#FFFFFF 70%); }
.s-goal-l { font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #9AA3B0; }
.s-goal-net .s-goal-l { color: #067A54; }
.s-goal-v { font-size: 32px; font-weight: 600; letter-spacing: -.03em; color: #10131A; line-height: 1.1; }
.s-goal-net .s-goal-v { color: #067A54; }
.s-goal-op { display: flex; align-items: center; font-size: 22px; font-weight: 600; color: #C0C7D2; }

.s-units { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.s-unit { background: #fff; border: 1px solid #E9EBF0; border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; gap: 4px; }
.s-unit-v { font-size: 24px; font-weight: 600; letter-spacing: -.02em; color: #2F6FED; }
.s-unit-l { font-size: 12.5px; line-height: 1.4; color: #7C8593; }

/* Canales */
.s-chs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 4px; }
.s-ch { background: #fff; border: 1px solid #E9EBF0; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; }
.s-ch-lever { grid-column: 1 / -1; border-color: #F0C169; background: linear-gradient(120deg,#FFFBF2,#FFFFFF 55%); }
.s-ch-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.s-ch-id { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 9px; background: #10131A; color: #fff; font-size: 14px; font-weight: 700; }
.s-ch-lever .s-ch-id { background: linear-gradient(135deg,#F2A516,#E0870A); color: #3A2604; }
.s-ch-cost { font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 7px; }
.s-ch-cost-zero { color: #067A54; background: #DEF4EA; }
.s-ch-cost-low { color: #1D7A8C; background: #DBF1F5; }
.s-ch-cost-paid { color: #B44708; background: #FDECDD; }
.s-ch-cost-lever { color: #C77E08; background: #FBEBCB; }
.s-ch-name { margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #10131A; }
.s-ch-what { margin: 0; font-size: 13.5px; line-height: 1.55; color: #565E6B; }

/* Detalle de la palanca */
.s-lever-detail { margin-top: 16px; background: #fff; border: 1px solid #E9EBF0; border-radius: 16px; padding: 22px 24px; }
.s-lever-h { display: flex; align-items: center; gap: 9px; font-size: 15px; font-weight: 600; color: #10131A; margin-bottom: 16px; }
.s-lever-h svg { color: #E0870A; }
.s-lever-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; }
.s-lever-k { display: block; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #9AA3B0; margin-bottom: 10px; }
.s-lever-cols ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.s-lever-cols li { position: relative; padding-left: 16px; font-size: 13.5px; line-height: 1.55; color: #565E6B; }
.s-lever-cols li::before { content: ''; position: absolute; left: 0; top: 8px; width: 5px; height: 5px; border-radius: 50%; background: #E0870A; }
.s-lever-cols b { color: #10131A; font-weight: 600; }

/* Footer */
.s-foot { border-top: 1px solid #ECEEF2; background: #F5F7FA; }
.s-foot-in { max-width: 1060px; margin: 0 auto; padding: 30px 28px 40px; }
.s-foot .s-logo { margin-bottom: 12px; }
.s-foot .s-logo-txt { font-size: 18px; }
.s-foot-tag { margin: 0 0 4px; font-size: 14px; color: #565E6B; }
.s-foot-src { margin: 0; font-size: 12.5px; color: #9AA3B0; }

/* Responsive */
@media (max-width: 900px) {
  .s-tiers, .s-chs, .s-units, .s-anal { grid-template-columns: 1fr 1fr; }
  .s-two, .s-lever-cols, .s-motors, .s-open, .s-lleva { grid-template-columns: 1fr; }
  .s-flow { grid-template-columns: 1fr; }
  .s-flow-arrow { transform: rotate(90deg); padding: 2px 0; }
  .s-close { grid-template-columns: 1fr; }
  .s-ch-lever { grid-column: auto; }
  .s-h1 { font-size: 40px; }
  .s-egoist-q { font-size: 20px; }
}
@media (max-width: 560px) {
  .s-main, .s-hdr-in, .s-foot-in { padding-left: 18px; padding-right: 18px; }
  .s-h1 { font-size: 33px; }
  .s-lead { font-size: 17px; }
  .s-h2 { font-size: 23px; }
  .s-logo-doc { display: none; }
  .s-spend, .s-units, .s-tiers, .s-chs, .s-anal { grid-template-columns: 1fr; }
  .s-mini { flex-direction: column; }
  .s-mini-i { flex-direction: row; align-items: center; gap: 10px; }
  .s-mix-row { flex-wrap: wrap; }
  .s-mix-p { width: 100%; }
  .s-goal-op { display: none; }
  .s-bridge { flex-direction: column; align-items: stretch; }
  .s-bridge svg { transform: rotate(90deg); align-self: center; }
  /* La tasa ("3.5% de los que responden") no entra en la misma línea: baja abajo. */
  .s-mrow { flex-wrap: wrap; }
  .s-mrow-l { flex: 1 1 auto; }
  .s-mrow-v { width: auto; }
  .s-mrow-r { order: 3; flex: 1 1 100%; white-space: normal; }
}
`;
