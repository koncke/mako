// =============================================================================
// /vsl/estrategia — Documento INTERNO de oferta + estrategia de marketing.
// =============================================================================
// NO es una landing de venta: es la síntesis de la estrategia comercial de MaKo
// para presentarle a un mentor/consultor y pedirle opinión. Prioridad:
// minimalista + gráfico, sin omitir las restricciones incómodas (caja, tiempo,
// prueba social) — un mentor no puede aconsejar sobre lo que no ve.
//
// Revisión 28-jul-2026: reescrito tras la consultoría con Juanfran (27-jul) y a
// la luz de la llamada con el cliente actual (08-jul).
//   · El webinar de agosto queda DIFERIDO (era el motor de la versión anterior).
//   · Entra prospección manual + campaña de mensajes a WhatsApp como motor.
//   · Se agregan: punto de partida (números reales), plan de gasto RECON,
//     foco de producto, riesgos y decisiones abiertas.
//
// Autocontenido (mismo truco que _detalle/FeatureDetail): una capa
// position:fixed a pantalla completa que tapa y oculta el sidebar del layout
// raíz (body:has(.mk-str) aside{display:none}). Mismo lenguaje visual que /vsl:
// Geist, azul #2F6FED, oro MaKo #F2A516. Verde #0E9F6E para plata/neto.
// Sin CTA de venta (es interno).
//
// Convención de estatus, representada como etiqueta:
//   Decidido (azul) · Recomendado (ámbar) · Abierto (gris).

type Status = 'ok' | 'rec' | 'open';

function Tag({ k }: { k: Status }) {
  const map: Record<Status, string> = { ok: 'Decidido', rec: 'Recomendado', open: 'Abierto' };
  return <span className={`s-tag s-tag-${k}`}>{map[k]}</span>;
}

// ── Datos ───────────────────────────────────────────────────────────────────

// Punto de partida: los números duros con los que se planifica.
const FACTS = [
  { k: 'Ingreso mensual', v: '$1,500', n: '100% de un solo cliente', tone: 'warn' },
  { k: 'Costo de vida', v: '$500', n: 'Fijo', tone: 'plain' },
  { k: 'Deuda a pagar', v: '$350', n: 'Este mes', tone: 'plain' },
  { k: 'Libre para invertir', v: '$650', n: 'No los $1,000 planificados', tone: 'key' },
  { k: 'Clientes pagos de MaKo', v: '1', n: 'El mismo que da el ingreso', tone: 'warn' },
  { k: 'Casos de éxito publicables', v: '0', n: 'En construcción con el cliente actual', tone: 'warn' },
] as const;

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

// Secuencia de contacto (estructura probada por el consultor, ~2% de agenda).
type Step = { n: string; kind: 'Escrito' | 'Audio'; title: string; body: string; hi?: boolean };

const SEQ: Step[] = [
  {
    n: '1',
    kind: 'Escrito',
    title: 'Hola [nombre], ¿cómo estás?',
    body: 'Literal, sin contexto y sin pitch. Es el mensaje con más respuesta porque el otro asume que sos un cliente potencial suyo.',
  },
  {
    n: '2',
    kind: 'Escrito',
    title: 'El gancho de curiosidad',
    body: '“Me crucé con tu perfil y me surgió una curiosidad. ¿Te molesta si te mando un audio?” Acá no se vende nada.',
  },
  {
    n: '3',
    kind: 'Audio',
    title: 'El audio',
    body: 'El activo central de toda la estrategia. Escrito con IA desde su perfil y su biblioteca de anuncios, leído palabra por palabra, actuado como si fuera improvisado.',
    hi: true,
  },
  {
    n: '4',
    kind: 'Escrito',
    title: 'Pitch de agenda + razón egoísta',
    body: 'No se pitchea el software: se pitchea el entregable. “Salís de la llamada con tu matriz hecha.”',
  },
];

// Matemática de agosto: prospección a mano, sin pauta.
const AGO_STEPS = [
  { label: 'Mensajes enviados', val: '550', w: 100, conv: '' },
  { label: 'Llamadas agendadas', val: '11', w: 26, conv: '2% de agenda' },
  { label: 'Ventas', val: '3', w: 9, conv: '25–30% de cierre' },
];

const CHANNELS = [
  {
    id: 'A',
    name: 'Prospección manual',
    cost: 'Costo cero',
    costTone: 'zero',
    estado: 'Motor de agosto',
    estadoTone: 'now',
    what: 'Círculo rojo y tibio, a mano: ex-alumnos, asistentes de eventos, contactos propios. No se vende MaKo — se ofrece el diagnóstico de su funnel y se lleva a una llamada.',
  },
  {
    id: 'B',
    name: 'Campaña de mensajes a WhatsApp',
    cost: 'Desde $300',
    costTone: 'low',
    estado: 'Motor de septiembre',
    estadoTone: 'next',
    what: 'Meta optimizando directo a WhatsApp, con un lead magnet como excusa para que escriban. Es el tipo de campaña más barato y da señal casi inmediata. Reemplaza al webinar como motor pago.',
  },
  {
    id: 'C',
    name: 'Referidos',
    cost: 'Costo cero',
    costTone: 'zero',
    estado: 'Motor de agosto',
    estadoTone: 'now',
    what: 'Pedir referidos a la red y a cada persona prospectada, tenga o no interés propio.',
  },
  {
    id: 'D',
    name: 'Orgánico + Lead Magnet',
    cost: 'Casi cero',
    costTone: 'low',
    estado: 'Oportunista',
    estadoTone: 'later',
    what: 'Los mismos creativos de la campaña, publicados en orgánico. “Comentá [palabra]” → link al diagnóstico → llamada.',
  },
  {
    id: 'E',
    name: 'VSL Funnel propio + Ads',
    cost: 'Requiere caja',
    costTone: 'paid',
    estado: 'Diferido',
    estadoTone: 'later',
    what: 'El funnel ya está construido (landing /vsl + VSL + Calendly + diagnóstico). Requiere presupuesto mínimo mayor que la campaña de mensajes, así que espera.',
  },
  {
    id: 'F',
    name: 'Asociarse con infoproductores',
    cost: 'Mayor palanca',
    costTone: 'lever',
    estado: 'Post primeras ventas',
    estadoTone: 'later',
    what: 'Un infoproductor con cientos de dueños que ya corren ads: un solo sí abre acceso a todos, ya calificados. Caso concreto: Jan. Se activa cuando haya prueba social propia.',
  },
] as const;

// Foco de producto: solo entra lo que sirve al cliente actual Y a la venta propia.
const BUILD = [
  { t: 'Fábrica de creativos', w: 'Es la palanca declarada del cliente actual y son los anuncios propios. Sirve dos veces.' },
  { t: 'Nutrición y setter de WhatsApp', w: 'Los leads del cliente hoy no se nutren, y es el motor de los follow-ups propios. Sirve dos veces.' },
  { t: 'Checklist con deadline (corrección “doer”)', w: 'Lo pidió el cliente textual: MaKo le muestra el dato del mercado pero no le dice qué tiene que hacer él.' },
] as const;

const DEFER = [
  'Análisis de la competencia',
  'MaKo adaptado a campañas de mensajes',
  'Correr más de un funnel por cuenta',
  'Productos y lead magnets como entidad',
  'Pruebas A/B',
  'Setting Analyst',
  'Módulo de Customer Success completo',
] as const;

const RISKS = [
  {
    t: 'Ingreso concentrado en un solo cliente',
    w: 'Los $1,500 vienen los dos servicios de la misma persona. Si se va, el ingreso es cero. Es el argumento más fuerte para prospectar ya, y también para entregar impecable.',
  },
  {
    t: 'Cero prueba social propia',
    w: 'Se sale a vender un software sin usuarios pagos. Los 5 casos de éxito que se están construyendo con el cliente actual son también la prueba social de MaKo.',
  },
  {
    t: 'Capacidad',
    w: 'Entrega + prospección + desarrollo en la misma semana. 100 mensajes por día no existe; el plan asume 20–30.',
  },
  {
    t: 'Bloqueo de la cuenta de WhatsApp',
    w: 'Volumen en frío desde el mismo número con el que se atiende a clientes deja sin operación. Hay que separar números y definir el techo diario.',
  },
  {
    t: 'El trial sin definir',
    w: 'La app entrega el 80% de su valor en los primeros segundos. Sin decidir qué se limita, no hay lead magnet, ni demo, ni prueba durante la llamada.',
  },
] as const;

// Lo que se lleva a la consultoría.
const QUESTIONS = [
  {
    q: '¿Cuál es la métrica de corte del RECON?',
    w: 'Costo por conversación iniciada, por respuesta o por lead calificado. Con $300 no hay volumen para esperar a la venta.',
  },
  {
    q: '¿WhatsApp o Instagram DM como destino del anuncio?',
    w: 'WhatsApp ahorra un paso y responde mejor; Instagram podría ser más barato por CPM. Nadie lo midió todavía.',
  },
  {
    q: '¿Cuál es el lead magnet, y se prueban varios a la vez?',
    w: 'Hay comunidad, cursos y material propio disponibles. La idea es probar dos o tres en el RECON y quedarse con el que baje el costo por conversación.',
  },
  {
    q: '¿Se ofrece el nivel de $497 para financiar la pauta?',
    w: 'La regla comercial dice que no se ofrece. La caja dice que es el instrumento que la destraba. Choque directo.',
  },
  {
    q: '¿Se sale a vender con la app sin terminar?',
    w: 'Faltan dos funcionalidades. Lo que se muestra en la llamada — diagnóstico, matriz, ángulos — ya funciona hoy.',
  },
  {
    q: '¿Cómo se resuelve la dependencia de un solo cliente?',
    w: 'Es a la vez el ingreso, el único caso de éxito y la mitad de la semana.',
  },
  {
    q: '¿Qué se limita en el trial?',
    w: 'Bloquea el lead magnet, la demo y el entregable de la llamada.',
  },
  {
    q: '¿Se sale sin prueba social o se consiguen uno o dos casos primero?',
    w: 'Conseguirlos cuesta tiempo que hoy no sobra; no tenerlos encarece cada conversación en frío.',
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
  alert: ['M12 9v4', 'M12 17h.01', 'M10.24 3.96l-8.15 14.1a2 2 0 0 0 1.74 3h16.34a2 2 0 0 0 1.74 -3l-8.15 -14.1a2 2 0 0 0 -3.52 0'],
  chev: ['M9 6l6 6l-6 6'],
  ask: ['M12 19h.01', 'M9 9a3 3 0 1 1 4.2 2.75c-.8 .4 -1.2 1.1 -1.2 2.25'],
};

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
            ofertas para que <strong>cualquier lead compre algo</strong>, empujada por prospección a mano
            en agosto y por campañas de mensajes pagas desde septiembre.
          </p>
          <div className="s-rev">
            <span className="s-rev-l">Qué cambió en esta revisión</span>
            <p>
              El motor anterior era un webinar pago en agosto. Queda <b>diferido</b>. En su lugar entran
              prospección manual y campaña de mensajes a WhatsApp, que cuestan una fracción y dan señal
              antes. El resto del documento parte de los números reales de caja y de tiempo.
            </p>
          </div>
        </section>

        {/* ── Punto de partida ─────────────────────────────────────────────── */}
        <section className="s-sec">
          <div className="s-sec-hd">
            <h2 className="s-h2">El punto de partida</h2>
          </div>
          <div className="s-facts">
            {FACTS.map((f) => (
              <div key={f.k} className={`s-fact s-fact-${f.tone}`}>
                <span className="s-fact-k">{f.k}</span>
                <span className="s-fact-v s-num">{f.v}</span>
                <span className="s-fact-n">{f.n}</span>
              </div>
            ))}
          </div>
          <div className="s-cap">
            <span className="s-cap-l">Reparto de la semana</span>
            <div className="s-cap-rows">
              <div className="s-cap-row">
                <div className="s-cap-bar" style={{ width: '50%' }} />
                <span><b>50%</b> Entrega al cliente actual — dos servicios en paralelo. Es la caja y el único caso.</span>
              </div>
              <div className="s-cap-row">
                <div className="s-cap-bar s-cap-bar-b" style={{ width: '30%' }} />
                <span><b>30%</b> Prospección propia — unas 2 h por día, 20 a 30 mensajes.</span>
              </div>
              <div className="s-cap-row">
                <div className="s-cap-bar s-cap-bar-c" style={{ width: '20%' }} />
                <span><b>20%</b> Producto — solo lo que sirve al cliente actual y a la venta propia.</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Producto + ICP ───────────────────────────────────────────────── */}
        <section className="s-sec s-band">
          <div className="s-sec-hd">
            <h2 className="s-h2">El producto y a quién se le vende</h2>
            <Tag k="ok" />
          </div>
          <div className="s-two">
            <a href="/vsl" className="s-card s-card-accent s-card-link">
              <div className="s-card-ic"><Ic d={I.layers} /></div>
              <h3 className="s-card-h">¿Qué es MaKo?</h3>
              <span className="s-card-link-cta">Verlo en la landing <span className="s-arr">→</span></span>
            </a>
            <div className="s-card">
              <div className="s-card-ic"><Ic d={I.target} /></div>
              <h3 className="s-card-h">El cliente ideal (ICP)</h3>
              <ul className="s-icp">
                <li>Corre <b>o quiere correr</b> un VSL Funnel pago: coach, consultor o agencia con oferta validada.</li>
                <li>El ICP se <b>amplió</b>: ya no exige facturar $10–20k. El círculo rojo disponible casi no corre VSL Funnel todavía.</li>
                <li>Puede invertir en ads, aunque sea desde <b>~$20/día</b>.</li>
              </ul>
              <div className="s-card-note">Ampliar el ICP fue obligado: exigir $10k de facturación dejaba afuera a casi toda la base a la que se le puede escribir mañana.</div>
            </div>
          </div>
        </section>

        {/* ── La oferta: escalera ──────────────────────────────────────────── */}
        <section className="s-sec">
          <div className="s-sec-hd">
            <h2 className="s-h2">La oferta: una escalera de tres niveles</h2>
            <Tag k="ok" />
          </div>

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

        {/* ── Cómo se corre la escalera en la llamada ──────────────────────── */}
        <section className="s-sec s-band">
          <div className="s-sec-hd">
            <h2 className="s-h2">Cómo se corre la escalera en la llamada</h2>
            <Tag k="rec" />
          </div>
          <p className="s-sec-sub">Siempre se pitchea primero el 1 a 1. El descenso no es descuento: es <em>“tengo algo para tu situación”</em>.</p>
          <div className="s-ladder">
            <div className="s-rung s-rung-1">
              <div className="s-rung-hd"><span className="s-rung-n">1</span> Pitch principal — <span className="s-num">$4,000</span></div>
              <p>“Necesitás que alguien se meta de verdad en tu funnel y tome, con datos, las decisiones correctas. Eso es el 1 a 1: MaKo completo y yo trabajando tu VSL Funnel con vos.”</p>
            </div>
            <div className="s-rung-if">Si “me encanta, pero no tengo esa plata ahora” ↓</div>
            <div className="s-rung s-rung-2">
              <div className="s-rung-hd"><span className="s-rung-n">2</span> Grupal — <span className="s-num">$1,500</span></div>
              <p>“Para eso tengo otra opción. Te llevás MaKo completo igual, más un grupo donde te acompaño en tus decisiones. $1,500 por cuatro meses.”</p>
            </div>
            <div className="s-rung-if">Si tampoco ↓</div>
            <div className="s-rung s-rung-3">
              <div className="s-rung-hd"><span className="s-rung-n">3</span> Solo — <span className="s-num">$497</span></div>
              <p>“Sin problema. Te llevás MaKo completo con los cursos y tutoriales para que lo corras vos. Cuando el funnel te dé, subís.”</p>
            </div>
          </div>
          <div className="s-rule">
            <Ic d={I.bolt} size={16} />
            <span><b>Regla:</b> al que califica y tiene plata, se le sostiene el 1 a 1 (no bajar por comodidad). El descenso es solo para el que de verdad no puede.</span>
          </div>
          <div className="s-rule s-rule-open">
            <Ic d={I.ask} size={16} />
            <span><b>En discusión:</b> la regla dice que el $497 ni se menciona. La caja dice que es lo que financia la primera pauta. Hoy el choque no está resuelto.</span>
          </div>
        </section>

        {/* ── La decisión: webinar diferido ────────────────────────────────── */}
        <section className="s-sec">
          <div className="s-sec-hd">
            <h2 className="s-h2">La decisión que reordenó el plan</h2>
            <Tag k="ok" />
          </div>
          <div className="s-swap">
            <div className="s-swap-col s-swap-out">
              <span className="s-swap-l">Antes</span>
              <div className="s-swap-h">Webinar pago de 3 días → llamada</div>
              <div className="s-swap-nums">Dos webinars (ago + sep) · ~$74,000 proyectados</div>
            </div>
            <div className="s-swap-arrow"><Ic d={I.chev} size={20} /></div>
            <div className="s-swap-col s-swap-in">
              <span className="s-swap-l">Ahora</span>
              <div className="s-swap-h">Prospección y mensajes → llamada</div>
              <div className="s-swap-nums">Sin fecha fija · sin entrada que cobrar · sin landing nueva</div>
            </div>
          </div>
          <div className="s-why">
            <div className="s-why-i"><b>El webinar existía para nutrir.</b> La prospección con diagnóstico ya nutre: se llega con el análisis de su negocio y su matriz hecha.</div>
            <div className="s-why-i"><b>Cobrar $47 en frío es más difícil que agendar una llamada.</b> Suma fricción justo donde no hay que sumarla.</div>
            <div className="s-why-i"><b>La fecha fija mata los follow-ups.</b> El caso de referencia del consultor tardó un mes desde el primer mensaje hasta el pago.</div>
            <div className="s-why-i"><b>El webinar rinde con ads,</b> cuando corre solo y se repite todos los meses. No a pulmón, con cero presupuesto.</div>
          </div>
          <div className="s-keep">
            <Ic d={I.bolt} size={16} />
            <span>El contenido no se pierde: se convierte en un <b>video corto pregrabado</b> que el lead ve antes de la llamada, para que entre nutrido.</span>
          </div>
        </section>

        {/* ── Estrategia de adquisición ────────────────────────────────────── */}
        <section className="s-sec s-band">
          <div className="s-sec-hd">
            <h2 className="s-h2">Estrategia de adquisición</h2>
            <Tag k="ok" />
          </div>

          <div className="s-wmodel">
            <span className="s-wmodel-step">Prospección + <b>campaña de mensajes</b></span>
            <Ic d={I.chev} size={14} />
            <span className="s-wmodel-step">Conversación por <b>WhatsApp</b></span>
            <Ic d={I.chev} size={14} />
            <span className="s-wmodel-step">Video corto <b>pre-llamada</b></span>
            <Ic d={I.chev} size={14} />
            <span className="s-wmodel-step">Llamada <b>1 a 1</b> · 2 ofertas</span>
          </div>

          {/* La razón egoísta */}
          <div className="s-sub-h">La razón egoísta para agendar</div>
          <div className="s-egoist">
            <p className="s-egoist-q">“Salís de la llamada con tu matriz de 3×3 hecha — tus tres quiénes y sus razones de compra — lista para correr anuncios.”</p>
            <p className="s-egoist-w">
              No se pitchea el software. El creativo personalizado solo tiene bajo valor percibido en gente
              que ya corre ads: <em>“esa imagen la podría haber hecho yo”</em>. El valor está en <b>a quién le
              vende y por qué le compran</b>, que es justo lo que no sabe que no sabe. La llamada se corre
              compartiendo pantalla con el diagnóstico de MaKo en vivo.
            </p>
          </div>

          {/* Secuencia de contacto */}
          <div className="s-sub-h">La secuencia de contacto</div>
          <div className="s-seq">
            {SEQ.map((s) => (
              <div key={s.n} className={`s-step ${s.hi ? 's-step-hi' : ''}`}>
                <div className="s-step-n">{s.n}</div>
                <div className="s-step-body">
                  <div className="s-step-hd">
                    <span className="s-step-t">{s.title}</span>
                    <span className={`s-step-kind s-step-kind-${s.kind === 'Audio' ? 'a' : 'w'}`}>{s.kind}</span>
                  </div>
                  <p>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="s-seq-after">
            <div className="s-seq-a">
              <span className="s-seq-a-l">Protocolo de 24 horas</span>
              Al círculo rojo no se le entra vendiendo. Día 1: conversación consultiva y se corta sin vender nada. Día 2: el audio y el pitch.
            </div>
            <div className="s-seq-a">
              <span className="s-seq-a-l">Follow-ups</span>
              Tres, alternando escrito y audio. Es donde se cierra: el caso de referencia tardó un mes.
            </div>
            <div className="s-seq-a">
              <span className="s-seq-a-l">Referencia de conversión</span>
              ~<b>2%</b> de agenda sobre mensajes enviados (equipo con 400 msj/día). El peor setter del equipo, 0,57%.
            </div>
          </div>

          {/* Matemática de agosto */}
          <div className="s-sub-h">La matemática de agosto</div>
          <div className="s-wb">
            <div className="s-wb-top">
              <div>
                <span className="s-wb-tag">Agosto</span>
                <span className="s-wb-when">Prospección a mano</span>
              </div>
              <div className="s-wb-srcs">
                <span className="s-wb-src">25 mensajes por día · 22 días</span>
                <span className="s-wb-ads s-wb-ads-zero">Ads $0</span>
              </div>
            </div>

            <div className="s-funnel">
              {AGO_STEPS.map((st) => (
                <div key={st.label} className="s-fstep">
                  {st.conv && <div className="s-fconv">↓ {st.conv}</div>}
                  <div className="s-fbar-row">
                    <div className="s-fbar-track">
                      <div className="s-fbar" style={{ width: `${st.w}%` }} />
                    </div>
                    <span className="s-fbar-lbl">{st.label} <b className="s-num">{st.val}</b></span>
                  </div>
                </div>
              ))}
            </div>

            <div className="s-neto">
              <span className="s-neto-l">Escenario conservador</span>
              <span className="s-neto-v s-num">$2,000 – $2,500</span>
              <span className="s-neto-nota">Mezcla probable: 1 Grupal + 1 o 2 Solo</span>
            </div>
            <div className="s-wb-upsell">
              <b>El objetivo de agosto no es facturar.</b> Es pagar la deuda, dejar los guiones probados con
              gente real y financiar el primer presupuesto de pauta. Las conversiones de arriba son
              supuestos tomados de un equipo con mucho más volumen: sirven para dimensionar, no como promesa.
            </div>
          </div>
        </section>

        {/* ── Plan de gasto ────────────────────────────────────────────────── */}
        <section className="s-sec">
          <div className="s-sec-hd">
            <h2 className="s-h2">Plan de gasto en pauta</h2>
            <Tag k="rec" />
          </div>
          <div className="s-spend">
            <div className="s-sp s-sp-1">
              <div className="s-sp-hd">
                <span className="s-sp-n">Fase 1</span>
                <span className="s-sp-t">Encontrar el ángulo ganador</span>
              </div>
              <div className="s-sp-v s-num">$300</div>
              <div className="s-sp-m">72 horas · $100 por día</div>
              <p>Se largan las <b>9 celdas</b> de la matriz (3 quiénes × 3 razones) al mismo tiempo, cada una con su propia palabra clave para medir intención real por mensajes en vez de por landing.</p>
              <div className="s-sp-cut">
                <span className="s-sp-cut-l">Criterio de corte</span>
                Se mata la celda por costo por conversación iniciada. <b>La métrica exacta está sin decidir</b> — con $300 no hay volumen para esperar a la venta.
              </div>
            </div>
            <div className="s-sp s-sp-2">
              <div className="s-sp-hd">
                <span className="s-sp-n">Fase 2</span>
                <span className="s-sp-t">Escalar el ganador</span>
              </div>
              <div className="s-sp-v s-num">$350 – $700</div>
              <div className="s-sp-m">El resto del mes</div>
              <p>Solo la celda ganadora queda corriendo. Recién si sostiene el costo por agenda se evalúa subir el presupuesto o pasar a VSL Funnel.</p>
              <div className="s-sp-cut">
                <span className="s-sp-cut-l">De dónde sale la plata</span>
                El presupuesto real hoy es <b>$650</b>, no $1,000. La diferencia sale de la primera venta: un solo cierre del Grupal financia el ciclo completo.
              </div>
            </div>
          </div>
        </section>

        {/* ── Canales ──────────────────────────────────────────────────────── */}
        <section className="s-sec s-band">
          <div className="s-sec-hd">
            <h2 className="s-h2">Canales de adquisición</h2>
            <Tag k="ok" />
          </div>
          <div className="s-chs">
            {CHANNELS.map((c) => (
              <div key={c.id} className={`s-ch ${c.id === 'F' ? 's-ch-lever' : ''}`}>
                <div className="s-ch-top">
                  <span className="s-ch-id">{c.id}</span>
                  <span className={`s-ch-cost s-ch-cost-${c.costTone}`}>{c.cost}</span>
                </div>
                <h3 className="s-ch-name">{c.name}</h3>
                <p className="s-ch-what">{c.what}</p>
                <span className={`s-ch-motor s-ch-motor-${c.estadoTone}`}>{c.estado}</span>
              </div>
            ))}
          </div>

          {/* Propuesta concreta con el infoproductor aliado (Jan) */}
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
            <div className="s-lever-when">Se activa después de las primeras ventas propias: llegar sin ningún caso de éxito debilita la propuesta.</div>
          </div>
        </section>

        {/* ── Foco de producto ─────────────────────────────────────────────── */}
        <section className="s-sec">
          <div className="s-sec-hd">
            <h2 className="s-h2">Qué se construye y qué espera</h2>
            <Tag k="rec" />
          </div>
          <p className="s-sec-sub">Solo entra al mes lo que sirve <em>al cliente actual</em> y <em>a la venta propia</em> al mismo tiempo. Todo lo demás se difiere de forma explícita, no por default.</p>
          <div className="s-focus">
            <div className="s-focus-col s-focus-build">
              <span className="s-focus-l">Se construye ahora</span>
              {BUILD.map((b) => (
                <div key={b.t} className="s-focus-i">
                  <b>{b.t}</b>
                  <span>{b.w}</span>
                </div>
              ))}
            </div>
            <div className="s-focus-col s-focus-defer">
              <span className="s-focus-l">Espera hasta después de la primera venta</span>
              <ul className="s-defer">
                {DEFER.map((d) => <li key={d}>{d}</li>)}
              </ul>
              <div className="s-focus-note">
                No se cancelan. Se corren a septiembre–octubre, cuando haya ingresos que paguen el tiempo
                de construirlas y ventas reales que digan cuál importa primero.
              </div>
            </div>
          </div>
        </section>

        {/* ── Riesgos ──────────────────────────────────────────────────────── */}
        <section className="s-sec s-band">
          <div className="s-sec-hd">
            <h2 className="s-h2">Riesgos</h2>
          </div>
          <div className="s-risks">
            {RISKS.map((r) => (
              <div key={r.t} className="s-risk">
                <div className="s-risk-ic"><Ic d={I.alert} size={16} /></div>
                <div>
                  <b>{r.t}</b>
                  <p>{r.w}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Decisiones abiertas ──────────────────────────────────────────── */}
        <section className="s-sec s-sec-last">
          <div className="s-sec-hd">
            <h2 className="s-h2">Decisiones abiertas</h2>
            <Tag k="open" />
          </div>
          <p className="s-sec-sub">Lo que se lleva a la consultoría. Ninguna de estas está resuelta hoy.</p>
          <div className="s-qs">
            {QUESTIONS.map((q, i) => (
              <div key={q.q} className="s-q">
                <span className="s-q-n s-num">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <b>{q.q}</b>
                  <p>{q.w}</p>
                </div>
              </div>
            ))}
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

/* Etiquetas de estatus */
.s-tag { display: inline-flex; align-items: center; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 3px 8px; border-radius: 6px; vertical-align: middle; white-space: nowrap; }
.s-tag-ok { color: #1D4FD8; background: #E7EFFE; }
.s-tag-rec { color: #9A6207; background: #FEF3DA; }
.s-tag-open { color: #5A6472; background: #EDEFF3; }

/* Hero */
.s-hero { padding: 56px 0 44px; border-bottom: 1px solid #EEF0F4; }
.s-h1 { margin: 0 0 18px; font-size: 52px; line-height: 1.04; letter-spacing: -.03em; font-weight: 600; color: #10131A; text-wrap: balance; }
.s-lead { margin: 0; max-width: 640px; font-size: 19px; line-height: 1.6; color: #5B6472; }
.s-lead strong { font-weight: 600; color: #10131A; }
.s-rev { margin-top: 26px; max-width: 720px; background: #fff; border: 1px solid #E5E8EE; border-left: 3px solid #E0870A; border-radius: 12px; padding: 16px 20px; }
.s-rev-l { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #C77E08; margin-bottom: 7px; }
.s-rev p { margin: 0; font-size: 14.5px; line-height: 1.6; color: #565E6B; }
.s-rev b { color: #10131A; font-weight: 600; }

/* Secciones */
.s-sec { padding: 46px 0; border-bottom: 1px solid #EEF0F4; }
.s-sec-last { border-bottom: none; padding-bottom: 60px; }
/* Banda de fondo full-width para separar visualmente las secciones (trick box-shadow + clip-path). */
.s-band { background: #F1F5FB; box-shadow: 0 0 0 100vmax #F1F5FB; clip-path: inset(0 -100vmax); border-bottom: none; }
.s-sec-hd { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.s-h2 { margin: 0; font-size: 27px; line-height: 1.15; letter-spacing: -.02em; font-weight: 600; color: #10131A; }
.s-sub-h { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #2F6FED; margin: 34px 0 2px; }
.s-sec-sub { margin: 2px 0 22px; font-size: 16px; line-height: 1.5; color: #5B6472; }
.s-sec-sub em { font-style: italic; color: #3A4150; }

/* Punto de partida — números duros */
.s-facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 24px; }
.s-fact { background: #fff; border: 1px solid #E9EBF0; border-radius: 14px; padding: 18px 20px; display: flex; flex-direction: column; gap: 5px; }
.s-fact-k { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: #8892A0; }
.s-fact-v { font-size: 30px; font-weight: 600; letter-spacing: -.03em; color: #10131A; line-height: 1.1; }
.s-fact-n { font-size: 12.5px; line-height: 1.45; color: #7C8593; }
.s-fact-key { border-color: #CBEBDC; background: linear-gradient(160deg,#EAF8F1,#FFFFFF 65%); }
.s-fact-key .s-fact-v { color: #067A54; }
.s-fact-key .s-fact-n { color: #4E9B7C; }
.s-fact-warn { border-color: #F3D9C4; background: linear-gradient(160deg,#FEF4EC,#FFFFFF 65%); }
.s-fact-warn .s-fact-v { color: #B44708; }
.s-fact-warn .s-fact-n { color: #A9714A; }

/* Reparto de la semana */
.s-cap { margin-top: 16px; background: #fff; border: 1px solid #E9EBF0; border-radius: 14px; padding: 20px 22px; }
.s-cap-l { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #9AA3B0; margin-bottom: 14px; }
.s-cap-rows { display: flex; flex-direction: column; gap: 12px; }
.s-cap-row { display: flex; align-items: center; gap: 14px; font-size: 13.5px; line-height: 1.45; color: #565E6B; }
.s-cap-row > span { flex: 1; min-width: 0; }
.s-cap-row b { color: #10131A; font-weight: 600; }
.s-cap-bar { height: 26px; border-radius: 7px; background: linear-gradient(90deg,#3B79EE,#5B92F4); flex: none; max-width: 180px; }
.s-cap-bar-b { background: linear-gradient(90deg,#0E9F6E,#16B57F); }
.s-cap-bar-c { background: linear-gradient(90deg,#F2A516,#E0870A); }

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
.s-card-note { margin-top: 14px; font-size: 12.5px; line-height: 1.5; color: #7C8593; background: #F5F7FA; border-radius: 8px; padding: 10px 12px; }
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

/* Escalera en la llamada */
.s-ladder { display: flex; flex-direction: column; gap: 0; margin-top: 6px; }
.s-rung { border-radius: 14px; padding: 16px 20px; border: 1px solid #E5E8EE; background: #fff; }
.s-rung-1 { border-color: #F0C169; background: linear-gradient(172deg,#FFFBF2,#FFFFFF 70%); }
.s-rung-2 { border-color: #C7D9FA; }
.s-rung-hd { font-size: 15px; font-weight: 600; color: #10131A; margin-bottom: 6px; }
.s-rung-hd .s-num { color: #10131A; }
.s-rung-n { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; background: #10131A; color: #fff; font-size: 12px; font-weight: 700; margin-right: 8px; }
.s-rung-1 .s-rung-n { background: #E0870A; color: #3A2604; }
.s-rung p { margin: 0; font-size: 14px; line-height: 1.55; font-style: italic; color: #565E6B; }
.s-rung-if { font-size: 13px; font-weight: 600; color: #9AA3B0; padding: 9px 0 9px 20px; }

/* Regla */
.s-rule { display: flex; align-items: flex-start; gap: 11px; margin-top: 20px; background: #FFF9EC; border: 1px solid #F3E2B5; border-radius: 12px; padding: 14px 17px; font-size: 14.5px; line-height: 1.5; color: #7A5406; }
.s-rule svg { flex: none; margin-top: 1px; color: #D4930C; }
.s-rule b { color: #5C3F04; font-weight: 700; }
.s-rule-open { margin-top: 10px; background: #F3F5F8; border-color: #DFE3EA; color: #4E5765; }
.s-rule-open svg { color: #8892A0; }
.s-rule-open b { color: #2C333E; }

/* Swap: la decisión (antes / ahora) */
.s-swap { display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: center; margin-top: 24px; }
.s-swap-col { border-radius: 16px; padding: 20px 22px; border: 1px solid #E9EBF0; background: #fff; }
.s-swap-l { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 9px; color: #9AA3B0; }
.s-swap-h { font-size: 17px; font-weight: 600; color: #10131A; line-height: 1.3; margin-bottom: 8px; }
.s-swap-nums { font-size: 13px; line-height: 1.45; color: #7C8593; }
.s-swap-out { background: #F5F6F8; }
.s-swap-out .s-swap-h { color: #8892A0; text-decoration: line-through; text-decoration-color: #C6CCD5; }
.s-swap-in { border-color: #CBEBDC; background: linear-gradient(160deg,#EAF8F1,#FFFFFF 70%); }
.s-swap-in .s-swap-l { color: #067A54; }
.s-swap-arrow { color: #C0C7D2; display: flex; align-items: center; justify-content: center; }
.s-why { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 18px; }
.s-why-i { font-size: 14px; line-height: 1.55; color: #565E6B; background: #fff; border: 1px solid #E9EBF0; border-radius: 12px; padding: 14px 17px; }
.s-why-i b { color: #10131A; font-weight: 600; }
.s-keep { display: flex; align-items: flex-start; gap: 11px; margin-top: 14px; background: #EAF1FE; border: 1px solid #CFDFFA; border-radius: 12px; padding: 14px 17px; font-size: 14.5px; line-height: 1.5; color: #26497F; }
.s-keep svg { flex: none; margin-top: 1px; color: #2F6FED; }
.s-keep b { color: #12315F; font-weight: 600; }

/* Modelo del funnel */
.s-wmodel { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 20px; color: #C0C7D2; }
.s-wmodel-step { font-size: 13.5px; color: #454C58; background: #fff; border: 1px solid #E5E8EE; border-radius: 9px; padding: 9px 14px; }
.s-wmodel-step b { color: #10131A; font-weight: 600; }

/* Razón egoísta */
.s-egoist { margin-top: 14px; background: #fff; border: 1px solid #F0C169; border-radius: 16px; padding: 22px 24px; background: linear-gradient(160deg,#FFFBF2,#FFFFFF 60%); }
.s-egoist-q { margin: 0 0 12px; font-size: 19px; line-height: 1.45; font-weight: 600; letter-spacing: -.01em; color: #10131A; text-wrap: balance; }
.s-egoist-w { margin: 0; font-size: 14.5px; line-height: 1.6; color: #565E6B; }
.s-egoist-w b { color: #10131A; font-weight: 600; }
.s-egoist-w em { font-style: italic; color: #7A5406; }

/* Secuencia de contacto */
.s-seq { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.s-step { display: flex; gap: 14px; background: #fff; border: 1px solid #E9EBF0; border-radius: 14px; padding: 16px 18px; }
.s-step-hi { border-color: #F0C169; background: linear-gradient(150deg,#FFFBF2,#FFFFFF 60%); }
.s-step-n { flex: none; width: 28px; height: 28px; border-radius: 8px; background: #10131A; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.s-step-hi .s-step-n { background: linear-gradient(135deg,#F2A516,#E0870A); color: #3A2604; }
.s-step-body { min-width: 0; }
.s-step-hd { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 5px; }
.s-step-t { font-size: 15px; font-weight: 600; color: #10131A; }
.s-step-kind { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 3px 8px; border-radius: 6px; }
.s-step-kind-w { color: #5A6472; background: #EDEFF3; }
.s-step-kind-a { color: #B44708; background: #FDECDD; }
.s-step p { margin: 0; font-size: 13.5px; line-height: 1.55; color: #565E6B; }
.s-seq-after { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
.s-seq-a { font-size: 13px; line-height: 1.55; color: #565E6B; background: #fff; border: 1px solid #E9EBF0; border-radius: 12px; padding: 14px 16px; }
.s-seq-a-l { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #2F6FED; margin-bottom: 6px; }
.s-seq-a b { color: #10131A; font-weight: 600; }

/* Funnel de agosto */
.s-wb { background: #fff; border: 1px solid #E9EBF0; border-radius: 18px; padding: 22px 22px 20px; display: flex; flex-direction: column; margin-top: 14px; }
.s-wb-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
.s-wb-tag { font-size: 16px; font-weight: 700; color: #10131A; margin-right: 8px; }
.s-wb-when { font-size: 13px; color: #8892A0; }
.s-wb-srcs { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
.s-wb-src { font-size: 12.5px; color: #6B7482; }
.s-wb-ads { font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 6px; }
.s-wb-ads-zero { color: #067A54; background: #DEF4EA; }

.s-funnel { display: flex; flex-direction: column; }
.s-fstep { display: flex; flex-direction: column; }
.s-fconv { font-size: 11.5px; font-weight: 600; color: #9AA3B0; padding: 5px 0; text-align: center; }
.s-fbar-row { display: flex; align-items: center; gap: 12px; }
.s-fbar-track { flex: 1; min-width: 0; }
.s-fbar { height: 40px; border-radius: 8px; background: linear-gradient(90deg,#3B79EE,#5B92F4); min-width: 6%; }
.s-fstep:nth-child(2) .s-fbar { background: linear-gradient(90deg,#4A83EF,#6E9FF6); }
.s-fstep:nth-child(3) .s-fbar { background: linear-gradient(90deg,#0E9F6E,#16B57F); }
.s-fbar-lbl { font-size: 13.5px; color: #6B7482; white-space: nowrap; flex: none; }
.s-fbar-lbl b { color: #10131A; font-size: 16px; margin-left: 3px; }

.s-neto { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-top: 20px; padding: 14px 16px; border-radius: 12px; background: linear-gradient(160deg,#EAF8F1,#F6FCF9); border: 1px solid #CBEBDC; }
.s-neto-l { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #067A54; }
.s-neto-v { font-size: 26px; font-weight: 600; color: #067A54; }
.s-neto-nota { font-size: 11.5px; color: #4E9B7C; margin-left: auto; }
.s-wb-upsell { margin-top: 12px; font-size: 13px; line-height: 1.55; color: #6B7482; background: #F5F7FA; border-radius: 10px; padding: 13px 15px; }
.s-wb-upsell b { color: #10131A; font-weight: 600; }

/* Plan de gasto */
.s-spend { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; }
.s-sp { background: #fff; border: 1px solid #E9EBF0; border-radius: 18px; padding: 22px 24px; display: flex; flex-direction: column; }
.s-sp-1 { border-color: #C7D9FA; }
.s-sp-2 { border-color: #CBEBDC; }
.s-sp-hd { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.s-sp-n { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #fff; background: #2F6FED; padding: 4px 9px; border-radius: 6px; }
.s-sp-2 .s-sp-n { background: #0E9F6E; }
.s-sp-t { font-size: 16px; font-weight: 600; color: #10131A; }
.s-sp-v { font-size: 34px; font-weight: 600; letter-spacing: -.03em; color: #10131A; line-height: 1.1; }
.s-sp-m { font-size: 12.5px; color: #8892A0; margin-bottom: 14px; }
.s-sp p { margin: 0 0 14px; font-size: 13.5px; line-height: 1.6; color: #565E6B; }
.s-sp p b { color: #10131A; font-weight: 600; }
.s-sp-cut { margin-top: auto; font-size: 12.5px; line-height: 1.55; color: #565E6B; background: #F5F7FA; border-radius: 10px; padding: 12px 14px; }
.s-sp-cut b { color: #10131A; font-weight: 600; }
.s-sp-cut-l { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #9AA3B0; margin-bottom: 5px; }

/* Canales */
.s-chs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 22px; }
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
.s-ch-what { margin: 0 0 12px; font-size: 13.5px; line-height: 1.55; color: #565E6B; }
.s-ch-motor { font-size: 11.5px; font-weight: 600; padding: 4px 10px; border-radius: 7px; align-self: flex-start; margin-top: auto; }
.s-ch-motor-now { color: #067A54; background: #DEF4EA; }
.s-ch-motor-next { color: #2F6FED; background: #EAF1FE; }
.s-ch-motor-later { color: #5A6472; background: #EDEFF3; }

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
.s-lever-when { margin-top: 18px; padding-top: 14px; border-top: 1px dashed #E5E8EE; font-size: 13px; line-height: 1.55; color: #7C8593; }

/* Foco de producto */
.s-focus { display: grid; grid-template-columns: 1.15fr 1fr; gap: 16px; margin-top: 6px; align-items: start; }
.s-focus-col { border-radius: 16px; padding: 22px 24px; border: 1px solid #E9EBF0; background: #fff; }
.s-focus-build { border-color: #CBEBDC; background: linear-gradient(165deg,#F3FBF7,#FFFFFF 55%); }
.s-focus-l { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #9AA3B0; margin-bottom: 14px; }
.s-focus-build .s-focus-l { color: #067A54; }
.s-focus-i { padding: 12px 0; border-top: 1px solid #E4EFE9; }
.s-focus-i:first-of-type { border-top: none; padding-top: 0; }
.s-focus-i b { display: block; font-size: 15px; font-weight: 600; color: #10131A; margin-bottom: 4px; }
.s-focus-i span { font-size: 13px; line-height: 1.55; color: #565E6B; }
.s-defer { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.s-defer li { position: relative; padding-left: 18px; font-size: 14px; line-height: 1.45; color: #7C8593; }
.s-defer li::before { content: ''; position: absolute; left: 0; top: 9px; width: 8px; height: 1.5px; border-radius: 2px; background: #C6CCD5; }
.s-focus-note { margin-top: 16px; font-size: 12.5px; line-height: 1.55; color: #7C8593; background: #F5F7FA; border-radius: 10px; padding: 12px 14px; }

/* Riesgos */
.s-risks { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 24px; }
.s-risk { display: flex; gap: 12px; background: #fff; border: 1px solid #E9EBF0; border-radius: 14px; padding: 16px 18px; }
.s-risk-ic { flex: none; width: 30px; height: 30px; border-radius: 9px; background: #FDECDD; color: #C0570D; display: flex; align-items: center; justify-content: center; }
.s-risk b { display: block; font-size: 15px; font-weight: 600; color: #10131A; margin-bottom: 5px; }
.s-risk p { margin: 0; font-size: 13.5px; line-height: 1.55; color: #565E6B; }

/* Decisiones abiertas */
.s-qs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 6px; }
.s-q { display: flex; gap: 14px; background: #fff; border: 1px solid #E9EBF0; border-radius: 14px; padding: 18px 20px; }
.s-q-n { flex: none; font-size: 15px; font-weight: 600; color: #C0C7D2; }
.s-q b { display: block; font-size: 15px; font-weight: 600; color: #10131A; line-height: 1.4; margin-bottom: 6px; }
.s-q p { margin: 0; font-size: 13.5px; line-height: 1.55; color: #565E6B; }

/* Footer */
.s-foot { border-top: 1px solid #ECEEF2; background: #F5F7FA; }
.s-foot-in { max-width: 1060px; margin: 0 auto; padding: 30px 28px 40px; }
.s-foot .s-logo { margin-bottom: 12px; }
.s-foot .s-logo-txt { font-size: 18px; }
.s-foot-tag { margin: 0 0 4px; font-size: 14px; color: #565E6B; }
.s-foot-src { margin: 0; font-size: 12.5px; color: #9AA3B0; }

/* Responsive */
@media (max-width: 900px) {
  .s-tiers, .s-chs, .s-facts { grid-template-columns: 1fr; }
  .s-two, .s-lever-cols, .s-why, .s-spend, .s-focus, .s-risks, .s-qs { grid-template-columns: 1fr; }
  .s-seq-after { grid-template-columns: 1fr; }
  .s-swap { grid-template-columns: 1fr; }
  .s-swap-arrow { transform: rotate(90deg); }
  .s-ch-lever { grid-column: auto; }
  .s-h1 { font-size: 40px; }
}
@media (max-width: 560px) {
  .s-main, .s-hdr-in, .s-foot-in { padding-left: 18px; padding-right: 18px; }
  .s-h1 { font-size: 33px; }
  .s-lead { font-size: 17px; }
  .s-h2 { font-size: 23px; }
  .s-logo-doc { display: none; }
  .s-cap-bar { max-width: 90px; }
}
`;
