// =============================================================================
// /vsl/estrategia — Documento INTERNO de oferta + estrategia de marketing.
// =============================================================================
// NO es una landing de venta: es la síntesis de la estrategia comercial de MaKo
// para presentarle a un mentor/consultor y pedirle opinión.
// Prioridad: minimalista + gráfico, en lenguaje llano (sin jerga interna).
//
// Revisión 28-jul-2026 (3):
//   · Se sacan las etiquetas de estatus (Decidido / Recomendado).
//   · "Los dos motores" y "Proyección financiera" quedan separados.
//   · La proyección se calcula HACIA ATRÁS desde un objetivo de $10,000, con
//     tasas propias por canal (responden, agendan, asisten, cierran).
//   · Nuevo apartado: con qué se abre cada canal (lead magnet con A/B en la
//     campaña; video personalizado en la prospección).
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

// Lo que se lleva el prospecto de la llamada, en criollo.
const LLEVA = [
  'A quién le tenés que vender — los tipos de cliente que hoy estás mezclando en un solo anuncio',
  'Por qué te va a comprar cada uno — las razones reales, no las que suponés',
  'Los guiones de tus anuncios, escritos',
  'Tus creativos, listos para publicar',
  'Con cuánto arrancar, qué publicar primero y cómo saber cuál está funcionando',
];

// Proyección: se calcula hacia atrás desde el objetivo.
type Row = { l: string; v: string; rate?: string; hi?: boolean };

const CANAL_A: Row[] = [
  { l: 'Inversión', v: '$0' },
  { l: 'Mensajes enviados', v: '550', rate: '25 por día · 22 días' },
  { l: 'Conversaciones', v: '248', rate: '45% responde' },
  { l: 'Llamadas agendadas', v: '20', rate: '8% agenda' },
  { l: 'Llamadas efectivas', v: '15', rate: '75% asiste' },
  { l: 'Ventas', v: '4', rate: '30% cierra', hi: true },
];

const CANAL_B: Row[] = [
  { l: 'Inversión', v: '$1,000' },
  { l: 'Conversaciones iniciadas', v: '333', rate: '$3 por conversación' },
  { l: 'Conversaciones activas', v: '200', rate: '60% responde' },
  { l: 'Llamadas agendadas', v: '10', rate: '5% agenda' },
  { l: 'Llamadas efectivas', v: '7', rate: '70% asiste' },
  { l: 'Ventas', v: '2', rate: '25% cierra', hi: true },
];

const MIX = [
  { q: '1', name: 'MaKo 1 a 1', price: '$4,000', total: '$4,000', tone: 'uno' },
  { q: '4', name: 'MaKo Grupal', price: '$1,500', total: '$6,000', tone: 'grupal' },
  { q: '1', name: 'MaKo Solo', price: '$497', total: '$497', tone: 'solo' },
];

const UNIT = [
  { l: 'Ticket promedio', v: '$1,750' },
  { l: 'Costo por llamada agendada (campaña)', v: '$100' },
  { l: 'Costo por cliente (campaña)', v: '$500' },
  { l: 'Retorno de la campaña', v: '3.5×' },
];

// Lead magnets a probar en la campaña de mensajes.
const MAGNETS = [
  { t: 'El diagnóstico de tu funnel', w: 'Lo genera MaKo con lo que el lead cuenta de su negocio. Es el que mejor se conecta con lo que se vende después.' },
  { t: 'Acceso a la comunidad y los cursos', w: 'Ya existe. Formato “mucho qué, poco cómo”: le muestra todo lo que tendría que estar haciendo y no está haciendo.' },
  { t: 'La biblioteca de material traducido', w: 'Los libros y recursos de referencia del mercado, traducidos. Costo cero de producción y percepción de valor alta.' },
];

// Canales que quedan para después de los dos motores actuales.
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
    what: 'Webinar de 3 días sobre VSL Funnel con CTA a llamada 1 a 1. Queda para cuando haya ads corriendo: ahí se automatiza, se repite todos los meses y no depende de llenar la sala a pulmón. El contenido se aprovecha antes como video corto pre-llamada.',
  },
  {
    id: 'G',
    name: 'Asociarse con infoproductores',
    cost: 'Mayor palanca',
    costTone: 'lever',
    what: 'Un infoproductor con cientos de dueños que ya corren ads: un solo sí abre acceso a todos, ya calificados. Caso concreto: Jan.',
  },
] as const;

// Inventario de funcionalidades que faltan, por prioridad.
type Feat = { t: string; w: string };
type Group = { p: string; label: string; tone: 'p1' | 'p2' | 'p3'; items: Feat[] };

const FEATURES: Group[] = [
  {
    p: 'Prioridad 1',
    label: 'Sin esto no se puede vender ni correr la campaña',
    tone: 'p1',
    items: [
      { t: 'Fábrica de creativos en video e imagen', w: 'La última funcionalidad grande que falta. Es lo que se muestra en la llamada y lo que produce los propios anuncios de la campaña.' },
      { t: 'Nutrición completa + Setter que califica solo', w: 'Hoy la nutrición está a medias. Tiene que pasar a ser un setter que califique leads automáticamente por WhatsApp; después Gmail e Instagram.' },
      { t: 'MaKo adaptado a campañas de mensajes', w: 'Todo el producto asume hoy un VSL Funnel. La campaña de mensajes tiene otro recorrido, otros estados y otras métricas.' },
      { t: 'Carga masiva de leads al CRM', w: 'Subir las listas de prospección en frío en bloque, sin cargarlas de a una.' },
      { t: 'Origen y atribución de cada lead', w: 'Distinguir si vino de campaña de mensajes, de VSL o de carga manual — y hasta de qué anuncio. Sin esto no se puede declarar un ganador.' },
      { t: 'Definir el trial', w: 'La app entrega el 80% de su valor en los primeros segundos. Hay que decidir qué se limita: bloquea el lead magnet, la demo y el entregable de la llamada.' },
    ],
  },
  {
    p: 'Prioridad 2',
    label: 'Para operar el volumen y decidir con datos',
    tone: 'p2',
    items: [
      { t: 'Setting Analyst', w: 'Evaluar cómo está respondiendo el bot y ver las métricas de mensajes, que son las que gobiernan la campaña.' },
      { t: 'Métricas de campaña de mensajes', w: 'Costo por conversación, por respuesta, por lead calificado, por agenda y por venta. Son otras que las del funnel de VSL.' },
      { t: 'Cola diaria del setter', w: 'A quién le escribo hoy, en qué paso está cada uno y a quién le toca el seguimiento. Sin la cola, el volumen no se sostiene.' },
      { t: 'Análisis de la competencia', w: 'Scraping de landings, Instagram y biblioteca de anuncios para personalizar el mensaje de prospección y alimentar la demo.' },
      { t: 'Guion del video personalizado', w: 'MaKo arma el análisis del negocio del prospecto a partir de su perfil y sus anuncios, listo para grabar.' },
      { t: 'Checklist con deadline', w: 'MaKo muestra muy bien el dato del mercado, pero no le dice al cliente qué tiene que hacer él y para cuándo.' },
      { t: 'Pruebas A/B', w: 'De mensajes, de campañas, de creativos y de lead magnets. Todo lo que se larga tiene que poder compararse.' },
    ],
  },
  {
    p: 'Prioridad 3',
    label: 'Para escalar la base de clientes',
    tone: 'p3',
    items: [
      { t: 'Más de un funnel por cuenta', w: 'Hoy un cliente se cataloga como “VSL Funnel”. Si además corre campaña de mensajes, el CRM tiene que separar los leads de cada uno.' },
      { t: 'Productos y lead magnets configurables', w: 'Saber qué oferta se vendió cuando hay varias, y tratar a los lead magnets como producto gratuito con su propia medición.' },
      { t: 'Checkout y alta automática', w: 'Que pagar cree el workspace y mande los accesos solo. Hoy el alta de cliente es a mano y no aguanta un mes con varias ventas.' },
      { t: 'Entregable de la llamada', w: 'Poder darle al prospecto su estrategia en PDF o link, sin entregarle la app completa.' },
      { t: 'Cursos, PDFs y comunidad', w: 'Es lo que promete la escalera en los tres niveles y todavía no existe.' },
      { t: 'Módulo de Customer Success', w: 'Onboarding, tableros, bitácora, fases configurables, testimonios y comunidad. Vive en su propio roadmap.' },
    ],
  },
];

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
            ofertas para que <strong>cualquier lead compre algo</strong>, empujada por dos motores de
            adquisición: <strong>prospección</strong> a costo cero y <strong>campaña de mensajes</strong> a WhatsApp.
          </p>
          <div className="s-rev">
            <span className="s-rev-l">Qué cambió en esta revisión</span>
            <p>
              El motor anterior era un webinar pago en agosto. <b>Pasa a canales a futuro</b>: rinde cuando
              hay ads corriendo y se puede repetir todos los meses, no a pulmón. En su lugar entran
              prospección manual y campaña de mensajes, que cuestan una fracción y dan señal antes.
            </p>
          </div>
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

        {/* ── Cómo se corre la escalera en la llamada ──────────────────────── */}
        <section className="s-sec">
          <h2 className="s-h2">Cómo se corre la escalera en la llamada</h2>
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
        </section>

        {/* ── Por qué agenda ───────────────────────────────────────────────── */}
        <section className="s-sec s-band">
          <h2 className="s-h2">Por qué te agenda la llamada</h2>
          <div className="s-egoist">
            <p className="s-egoist-q">“Salís de la llamada con toda tu estrategia para conseguir clientes con anuncios pagos, armada para tu negocio.”</p>
            <ul className="s-lleva">
              {LLEVA.map((x) => (
                <li key={x}><Ic d={I.check} size={15} /><span>{x}</span></li>
              ))}
            </ul>
            <p className="s-egoist-w">
              No se pitchea el software. Al que ya corre anuncios, un creativo suelto no lo impresiona:
              <em> “esa imagen la podría haber hecho yo”</em>. Lo que no tiene es claridad de <b>a quién le está
              vendiendo y por qué le compran</b>. Eso es lo que se le entrega, y se arma en vivo durante la
              llamada, compartiendo pantalla.
            </p>
          </div>
        </section>

        {/* ── Los dos motores ──────────────────────────────────────────────── */}
        <section className="s-sec">
          <h2 className="s-h2">Los dos motores</h2>
          <div className="s-wmodel">
            <span className="s-wmodel-step">Prospección + <b>campaña de mensajes</b></span>
            <Ic d={I.chev} size={14} />
            <span className="s-wmodel-step">Conversación por <b>WhatsApp</b></span>
            <Ic d={I.chev} size={14} />
            <span className="s-wmodel-step">Video corto <b>pre-llamada</b></span>
            <Ic d={I.chev} size={14} />
            <span className="s-wmodel-step">Llamada <b>1 a 1</b> · 2 ofertas</span>
          </div>

          <div className="s-motors">
            <div className="s-motor s-motor-a">
              <div className="s-motor-hd">
                <span className="s-motor-id">A</span>
                <div>
                  <h3 className="s-motor-name">Prospección</h3>
                  <span className="s-motor-sub">Círculo rojo y tibio, a mano</span>
                </div>
                <span className="s-motor-cost s-motor-cost-zero">Costo cero</span>
              </div>
              <div className="s-motor-facts">
                <div><b>25</b> mensajes por día</div>
                <div><b>Sin</b> lead magnet</div>
                <div>Se abre con un <b>video personalizado</b></div>
              </div>
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
                  <div className="s-sp-hd"><span className="s-sp-n">Fase 1</span><span className="s-sp-t">Encontrar el ganador</span></div>
                  <div className="s-sp-v s-num">$300</div>
                  <div className="s-sp-m">72 horas · $100 por día · todos los anuncios juntos</div>
                </div>
                <div className="s-sp s-sp-2">
                  <div className="s-sp-hd"><span className="s-sp-n">Fase 2</span><span className="s-sp-t">Escalar</span></div>
                  <div className="s-sp-v s-num">$700</div>
                  <div className="s-sp-m">El resto del mes · solo el ganador</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Con qué se abre cada canal ───────────────────────────────────── */}
        <section className="s-sec s-band">
          <h2 className="s-h2">Con qué se abre cada conversación</h2>
          <div className="s-open">
            <div className="s-open-col s-open-b">
              <div className="s-open-hd">
                <span className="s-open-tag">Campaña de mensajes</span>
                <h3>Lead magnet, con prueba A/B</h3>
              </div>
              <p>
                El anuncio no vende el servicio: vende el recurso gratis. El que escribe no está pidiendo
                información de un programa, está pidiendo algo que quiere — y eso baja muchísimo la
                fricción. Se largan varios a la vez y gana el que consiga conversaciones más baratas.
              </p>
              <div className="s-magnets">
                {MAGNETS.map((m, i) => (
                  <div key={m.t} className="s-magnet">
                    <span className="s-magnet-n s-num">{String.fromCharCode(65 + i)}</span>
                    <div>
                      <b>{m.t}</b>
                      <span>{m.w}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="s-open-rule">
                <b>Regla:</b> no se entrega apenas lo piden. El recurso es la excusa para conversar y para
                nutrir; lo ideal es que agenden antes de recibirlo.
              </div>
            </div>

            <div className="s-open-col s-open-a">
              <div className="s-open-hd">
                <span className="s-open-tag">Prospección</span>
                <h3>Video personalizado, sin lead magnet</h3>
              </div>
              <p>
                Acá no va recurso gratis: al que te conoce o al que le escribís a mano se le entra por lo
                consultivo. La nutrición es un video corto grabado para esa persona, con el análisis de su
                negocio hecho antes de hablarle.
              </p>
              <div className="s-vid">
                <span className="s-vid-l">Qué se mira antes de grabar</span>
                <ul>
                  <li>Su Instagram y su marca personal</li>
                  <li>Su biblioteca de anuncios: qué está corriendo y hace cuánto</li>
                  <li>Su landing, su oferta y a quién le está hablando hoy</li>
                </ul>
                <span className="s-vid-l">Qué se le dice</span>
                <ul>
                  <li>Qué se ve desde afuera y a quién le está vendiendo hoy</li>
                  <li>A qué otros tipos de cliente les podría vender y no lo está haciendo</li>
                  <li>Qué haría yo en su lugar, concreto</li>
                </ul>
                <div className="s-vid-cta">Cierre: link para agendar.</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Proyección financiera ────────────────────────────────────────── */}
        <section className="s-sec">
          <h2 className="s-h2">Proyección financiera</h2>
          <p className="s-sec-sub">El objetivo es <b>$10,000</b>. Los números se calculan hacia atrás desde ahí: cuánto hay que vender, cuántas llamadas hacen falta y cuántos contactos hay que mover en cada canal.</p>

          <div className="s-goal">
            <div className="s-goal-i">
              <span className="s-goal-l">Facturado</span>
              <span className="s-goal-v s-num">$10,497</span>
            </div>
            <span className="s-goal-op">−</span>
            <div className="s-goal-i">
              <span className="s-goal-l">Inversión en ads</span>
              <span className="s-goal-v s-num">$1,000</span>
            </div>
            <span className="s-goal-op">=</span>
            <div className="s-goal-i s-goal-net">
              <span className="s-goal-l">Neto</span>
              <span className="s-goal-v s-num">$9,497</span>
            </div>
          </div>

          {/* Qué hay que vender */}
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
              <span className="s-mix-q s-num">6</span>
              <span className="s-mix-n">ventas en el mes</span>
              <span className="s-mix-p">ticket promedio $1,750</span>
              <span className="s-mix-t s-num">$10,497</span>
            </div>
          </div>

          {/* De dónde salen las llamadas */}
          <div className="s-sub-h">De dónde salen las llamadas</div>
          <div className="s-metrics">
            <div className="s-mcol s-mcol-a">
              <div className="s-mcol-hd"><span className="s-mcol-id">A</span> Prospección</div>
              <Ladder rows={CANAL_A} />
            </div>
            <div className="s-mcol s-mcol-b">
              <div className="s-mcol-hd"><span className="s-mcol-id">B</span> Campaña de mensajes</div>
              <Ladder rows={CANAL_B} />
            </div>
          </div>

          <div className="s-tot">
            <div><span>Llamadas agendadas</span><b className="s-num">30</b></div>
            <div><span>Llamadas efectivas</span><b className="s-num">22</b></div>
            <div><span>Ventas</span><b className="s-num">6</b></div>
            <div><span>Cierre global</span><b className="s-num">27%</b></div>
          </div>

          {/* Unidad económica */}
          <div className="s-sub-h">Números por unidad</div>
          <div className="s-units">
            {UNIT.map((u) => (
              <div key={u.l} className="s-unit">
                <span className="s-unit-v s-num">{u.v}</span>
                <span className="s-unit-l">{u.l}</span>
              </div>
            ))}
          </div>

          <div className="s-assume">
            Ninguna de estas tasas está medida todavía: son el objetivo con el que se arranca. Se corrigen
            con los primeros 100 mensajes y con las primeras 72 horas de campaña. Las dos variables que más
            mueven el resultado son el <b>costo por conversación</b> y la <b>tasa de cierre en la llamada</b>.
          </div>
        </section>

        {/* ── Canales a futuro ─────────────────────────────────────────────── */}
        <section className="s-sec s-band">
          <h2 className="s-h2">Canales de adquisición a futuro</h2>
          <p className="s-sec-sub">Todos son válidos y ninguno está descartado. Entran después de que los dos motores actuales estén dando señal.</p>
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

        {/* ── Funcionalidades que faltan ───────────────────────────────────── */}
        <section className="s-sec s-sec-last">
          <h2 className="s-h2">Funcionalidades que faltan en MaKo</h2>
          <p className="s-sec-sub">Inventario completo, ordenado por lo que desbloquea la venta y la campaña.</p>
          <div className="s-feats">
            {FEATURES.map((g) => (
              <div key={g.p} className={`s-fg s-fg-${g.tone}`}>
                <div className="s-fg-hd">
                  <span className="s-fg-p">{g.p}</span>
                  <span className="s-fg-l">{g.label}</span>
                </div>
                <div className="s-fg-items">
                  {g.items.map((f) => (
                    <div key={f.t} className="s-feat">
                      <b>{f.t}</b>
                      <span>{f.w}</span>
                    </div>
                  ))}
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

/* Hero */
.s-hero { padding: 56px 0 44px; border-bottom: 1px solid #EEF0F4; }
.s-h1 { margin: 0 0 18px; font-size: 52px; line-height: 1.04; letter-spacing: -.03em; font-weight: 600; color: #10131A; text-wrap: balance; }
.s-lead { margin: 0; max-width: 660px; font-size: 19px; line-height: 1.6; color: #5B6472; }
.s-lead strong { font-weight: 600; color: #10131A; }
.s-rev { margin-top: 26px; max-width: 720px; background: #fff; border: 1px solid #E5E8EE; border-left: 3px solid #E0870A; border-radius: 12px; padding: 16px 20px; }
.s-rev-l { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #C77E08; margin-bottom: 7px; }
.s-rev p { margin: 0; font-size: 14.5px; line-height: 1.6; color: #565E6B; }
.s-rev b { color: #10131A; font-weight: 600; }

/* Secciones */
.s-sec { padding: 46px 0; border-bottom: 1px solid #EEF0F4; }
.s-sec-last { border-bottom: none; padding-bottom: 60px; }
.s-band { background: #F1F5FB; box-shadow: 0 0 0 100vmax #F1F5FB; clip-path: inset(0 -100vmax); border-bottom: none; }
.s-h2 { margin: 0 0 8px; font-size: 27px; line-height: 1.15; letter-spacing: -.02em; font-weight: 600; color: #10131A; }
.s-sub-h { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #2F6FED; margin: 32px 0 12px; }
.s-sec-sub { margin: 2px 0 22px; font-size: 16px; line-height: 1.55; color: #5B6472; max-width: 760px; }
.s-sec-sub em { font-style: italic; color: #3A4150; }
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

/* Por qué agenda */
.s-egoist { margin-top: 20px; border: 1px solid #F0C169; border-radius: 18px; padding: 26px 28px; background: linear-gradient(160deg,#FFFBF2,#FFFFFF 60%); }
.s-egoist-q { margin: 0 0 18px; font-size: 22px; line-height: 1.4; font-weight: 600; letter-spacing: -.015em; color: #10131A; text-wrap: balance; }
.s-lleva { list-style: none; margin: 0 0 18px; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
.s-lleva li { display: flex; gap: 9px; font-size: 14.5px; line-height: 1.5; color: #454C58; }
.s-lleva svg { flex: none; margin-top: 3px; color: #0E9F6E; }
.s-egoist-w { margin: 0; padding-top: 18px; border-top: 1px solid #F3E6CB; font-size: 14.5px; line-height: 1.6; color: #565E6B; }
.s-egoist-w b { color: #10131A; font-weight: 600; }
.s-egoist-w em { font-style: italic; color: #7A5406; }

/* Modelo del funnel */
.s-wmodel { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 20px; color: #C0C7D2; }
.s-wmodel-step { font-size: 13.5px; color: #454C58; background: #fff; border: 1px solid #E5E8EE; border-radius: 9px; padding: 9px 14px; }
.s-wmodel-step b { color: #10131A; font-weight: 600; }

/* Los dos motores */
.s-motors { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 18px; align-items: stretch; }
.s-motor { background: #fff; border: 1px solid #E9EBF0; border-radius: 18px; padding: 22px 24px; display: flex; flex-direction: column; }
.s-motor-a { border-color: #CBEBDC; }
.s-motor-b { border-color: #C7D9FA; }
.s-motor-hd { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
.s-motor-hd > div { flex: 1; min-width: 0; }
.s-motor-id { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; font-size: 15px; font-weight: 700; color: #fff; background: #0E9F6E; }
.s-motor-b .s-motor-id { background: #2F6FED; }
.s-motor-name { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -.01em; color: #10131A; }
.s-motor-sub { font-size: 12.5px; color: #8892A0; }
.s-motor-cost { flex: none; font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 7px; }
.s-motor-cost-zero { color: #067A54; background: #DEF4EA; }
.s-motor-cost-paid { color: #1D4FD8; background: #E7EFFE; }
.s-motor-facts { display: flex; flex-direction: column; gap: 10px; margin-top: auto; }
.s-motor-facts > div { font-size: 14px; line-height: 1.45; color: #565E6B; background: #F5FAF7; border-radius: 10px; padding: 12px 14px; }
.s-motor-facts b { color: #10131A; font-weight: 600; }

/* Plan de gasto (dentro del motor B) */
.s-spend { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: auto; }
.s-sp { border: 1px solid #E9EBF0; border-radius: 14px; padding: 16px 18px; }
.s-sp-1 { border-color: #C7D9FA; background: #F7FAFF; }
.s-sp-2 { border-color: #CBEBDC; background: #F5FCF9; }
.s-sp-hd { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; margin-bottom: 10px; }
.s-sp-n { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #fff; background: #2F6FED; padding: 3px 8px; border-radius: 6px; }
.s-sp-2 .s-sp-n { background: #0E9F6E; }
.s-sp-t { font-size: 14px; font-weight: 600; color: #10131A; }
.s-sp-v { font-size: 28px; font-weight: 600; letter-spacing: -.03em; color: #10131A; line-height: 1.1; }
.s-sp-m { font-size: 12px; line-height: 1.45; color: #8892A0; margin-top: 4px; }

/* Con qué se abre cada canal */
.s-open { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 22px; align-items: start; }
.s-open-col { background: #fff; border: 1px solid #E9EBF0; border-radius: 18px; padding: 24px 26px; }
.s-open-b { border-color: #C7D9FA; }
.s-open-a { border-color: #CBEBDC; }
.s-open-hd { margin-bottom: 12px; }
.s-open-tag { display: inline-block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding: 3px 9px; border-radius: 6px; margin-bottom: 9px; color: #1D4FD8; background: #E7EFFE; }
.s-open-a .s-open-tag { color: #067A54; background: #DEF4EA; }
.s-open-hd h3 { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -.01em; color: #10131A; }
.s-open-col > p { margin: 0 0 18px; font-size: 14px; line-height: 1.6; color: #565E6B; }
.s-magnets { display: flex; flex-direction: column; gap: 10px; }
.s-magnet { display: flex; gap: 12px; background: #F7FAFF; border-radius: 12px; padding: 13px 15px; }
.s-magnet-n { flex: none; width: 24px; height: 24px; border-radius: 7px; background: #2F6FED; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.s-magnet b { display: block; font-size: 14.5px; font-weight: 600; color: #10131A; margin-bottom: 3px; }
.s-magnet span { font-size: 12.5px; line-height: 1.5; color: #6B7482; }
.s-open-rule { margin-top: 14px; font-size: 13px; line-height: 1.55; color: #7A5406; background: #FFF9EC; border: 1px solid #F3E2B5; border-radius: 10px; padding: 12px 14px; }
.s-open-rule b { color: #5C3F04; font-weight: 700; }
.s-vid { background: #F5FAF7; border-radius: 12px; padding: 16px 18px; }
.s-vid-l { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #067A54; margin-bottom: 8px; }
.s-vid ul { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 7px; }
.s-vid ul:last-of-type { margin-bottom: 14px; }
.s-vid li { position: relative; padding-left: 16px; font-size: 13.5px; line-height: 1.5; color: #565E6B; }
.s-vid li::before { content: ''; position: absolute; left: 0; top: 8px; width: 5px; height: 5px; border-radius: 50%; background: #0E9F6E; }
.s-vid-cta { font-size: 13.5px; font-weight: 600; color: #10131A; padding-top: 12px; border-top: 1px dashed #CBEBDC; }

/* Proyección: objetivo */
.s-goal { display: flex; align-items: stretch; gap: 14px; flex-wrap: wrap; margin-top: 4px; }
.s-goal-i { flex: 1; min-width: 150px; background: #fff; border: 1px solid #E9EBF0; border-radius: 16px; padding: 18px 22px; display: flex; flex-direction: column; gap: 4px; }
.s-goal-net { border-color: #CBEBDC; background: linear-gradient(160deg,#EAF8F1,#FFFFFF 70%); }
.s-goal-l { font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #9AA3B0; }
.s-goal-net .s-goal-l { color: #067A54; }
.s-goal-v { font-size: 32px; font-weight: 600; letter-spacing: -.03em; color: #10131A; line-height: 1.1; }
.s-goal-net .s-goal-v { color: #067A54; }
.s-goal-op { display: flex; align-items: center; font-size: 22px; font-weight: 600; color: #C0C7D2; }

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

/* Proyección: métricas por canal */
.s-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.s-mcol { background: #fff; border: 1px solid #E9EBF0; border-radius: 18px; padding: 20px 22px; }
.s-mcol-a { border-color: #CBEBDC; }
.s-mcol-b { border-color: #C7D9FA; }
.s-mcol-hd { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 600; color: #10131A; margin-bottom: 14px; }
.s-mcol-id { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 8px; font-size: 13px; font-weight: 700; color: #fff; background: #0E9F6E; }
.s-mcol-b .s-mcol-id { background: #2F6FED; }
.s-mrows { display: flex; flex-direction: column; }
.s-mrow { display: flex; align-items: baseline; gap: 10px; padding: 11px 0; border-top: 1px solid #F0F2F6; }
.s-mrow:first-child { border-top: none; padding-top: 0; }
.s-mrow-l { flex: 1; min-width: 0; font-size: 14px; color: #565E6B; }
.s-mrow-r { font-size: 11.5px; color: #9AA3B0; white-space: nowrap; }
.s-mrow-v { flex: none; width: 68px; text-align: right; font-size: 17px; font-weight: 600; color: #10131A; }
.s-mrow-hi { margin-top: 4px; padding: 13px 14px; border-top: none; border-radius: 12px; background: #F1F8F5; }
.s-mrow-hi .s-mrow-l { font-weight: 600; color: #10131A; }
.s-mrow-hi .s-mrow-v { color: #067A54; font-size: 20px; }
.s-mcol-b .s-mrow-hi { background: #F0F5FE; }
.s-mcol-b .s-mrow-hi .s-mrow-v { color: #1D4FD8; }

.s-tot { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 14px; }
.s-tot > div { background: #fff; border: 1px solid #E9EBF0; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 3px; }
.s-tot span { font-size: 12px; color: #8892A0; }
.s-tot b { font-size: 22px; font-weight: 600; letter-spacing: -.02em; color: #10131A; }

.s-units { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.s-unit { background: #fff; border: 1px solid #E9EBF0; border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; gap: 4px; }
.s-unit-v { font-size: 24px; font-weight: 600; letter-spacing: -.02em; color: #2F6FED; }
.s-unit-l { font-size: 12.5px; line-height: 1.4; color: #7C8593; }

.s-assume { margin-top: 20px; font-size: 13.5px; line-height: 1.6; color: #7C8593; background: #F5F7FA; border-radius: 12px; padding: 14px 17px; }
.s-assume b { color: #10131A; font-weight: 600; }

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

/* Funcionalidades que faltan */
.s-feats { display: flex; flex-direction: column; gap: 16px; }
.s-fg { background: #fff; border: 1px solid #E9EBF0; border-radius: 18px; padding: 22px 24px; }
.s-fg-p1 { border-color: #F0C169; background: linear-gradient(150deg,#FFFBF2,#FFFFFF 40%); }
.s-fg-p2 { border-color: #C7D9FA; }
.s-fg-hd { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #EEF0F4; }
.s-fg-p { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #fff; background: #8892A0; padding: 4px 10px; border-radius: 6px; }
.s-fg-p1 .s-fg-p { background: linear-gradient(135deg,#F2A516,#E0870A); color: #3A2604; }
.s-fg-p2 .s-fg-p { background: #2F6FED; }
.s-fg-l { font-size: 14px; font-weight: 600; color: #565E6B; }
.s-fg-items { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 26px; }
.s-feat b { display: block; font-size: 15px; font-weight: 600; color: #10131A; margin-bottom: 4px; line-height: 1.35; }
.s-feat span { font-size: 13px; line-height: 1.55; color: #6B7482; }

/* Footer */
.s-foot { border-top: 1px solid #ECEEF2; background: #F5F7FA; }
.s-foot-in { max-width: 1060px; margin: 0 auto; padding: 30px 28px 40px; }
.s-foot .s-logo { margin-bottom: 12px; }
.s-foot .s-logo-txt { font-size: 18px; }
.s-foot-tag { margin: 0 0 4px; font-size: 14px; color: #565E6B; }
.s-foot-src { margin: 0; font-size: 12.5px; color: #9AA3B0; }

/* Responsive */
@media (max-width: 900px) {
  .s-tiers, .s-chs, .s-tot, .s-units { grid-template-columns: 1fr 1fr; }
  .s-two, .s-lever-cols, .s-motors, .s-fg-items, .s-open, .s-metrics, .s-lleva { grid-template-columns: 1fr; }
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
  .s-spend, .s-tot, .s-units { grid-template-columns: 1fr; }
  .s-mix-row { flex-wrap: wrap; }
  .s-mix-p { width: 100%; }
  .s-goal-op { display: none; }
}
`;
