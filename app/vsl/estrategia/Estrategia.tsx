// =============================================================================
// /vsl/estrategia — Documento INTERNO de oferta + estrategia de marketing.
// =============================================================================
// NO es una landing de venta: es la síntesis de la estrategia comercial de MaKo
// para presentarle a un mentor/consultor y pedirle opinión.
// Prioridad: minimalista + gráfico.
//
// Revisión 28-jul-2026 (2): tras la consultoría con Juanfran (27-jul).
//   · El webinar deja de ser el motor y pasa a "canales a futuro".
//   · La adquisición se divide en dos motores: prospección (costo cero) y
//     campaña de mensajes a WhatsApp ($1,000 en agosto).
//   · Se agrega el inventario priorizado de funcionalidades que faltan.
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

// Motor A — prospección a mano, sin pauta.
const PROSP_STEPS = [
  { label: 'Mensajes enviados', val: '550', w: 100, conv: '' },
  { label: 'Llamadas agendadas', val: '11', w: 26, conv: '2% de agenda' },
  { label: 'Ventas', val: '3', w: 9, conv: '25–30% de cierre' },
];

// Canales que quedan para después de los dos motores actuales.
const FUTURO = [
  {
    id: 'C',
    name: 'Referidos',
    cost: 'Costo cero',
    costTone: 'zero',
    what: 'Pedir referidos a la red, a los clientes y a cada persona prospectada, tenga o no interés propio. Se activa solo cuando haya conversaciones corriendo.',
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
      { t: 'Origen y atribución de cada lead', w: 'Distinguir si vino de campaña de mensajes, de VSL o de carga manual — y hasta de qué creativo, qué quién y qué razón. Sin esto no se puede declarar un anuncio ganador.' },
      { t: 'Definir el trial', w: 'La app entrega el 80% de su valor en los primeros segundos. Hay que decidir qué se limita: bloquea el lead magnet, la demo y el entregable de la llamada.' },
    ],
  },
  {
    p: 'Prioridad 2',
    label: 'Para operar el volumen y decidir con datos',
    tone: 'p2',
    items: [
      { t: 'Setting Analyst', w: 'Evaluar cómo está respondiendo el bot y ver las métricas de mensajes, que son las que gobiernan la campaña.' },
      { t: 'Métricas de campaña de mensajes', w: 'Costo por conversación iniciada, por respuesta, por lead calificado, por agenda y por venta. Son otras que las del funnel de VSL.' },
      { t: 'Cola diaria del setter', w: 'A quién le escribo hoy, en qué paso de la secuencia está cada uno y a quién le toca el follow-up. Sin la cola, el volumen no se sostiene.' },
      { t: 'Análisis de la competencia', w: 'Scraping de landings, Instagram y biblioteca de anuncios para personalizar el mensaje de prospección y alimentar la demo.' },
      { t: 'Guion del audio de prospección', w: 'MaKo escribe el audio a partir del perfil del lead y de sus anuncios. Es el activo con más peso de toda la secuencia de contacto.' },
      { t: 'Checklist con deadline', w: 'La corrección “doer”: MaKo muestra muy bien el dato del mercado, pero no le dice al cliente qué tiene que hacer él y para cuándo.' },
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
      { t: 'Entregable de la llamada', w: 'Poder darle al prospecto su matriz de 3×3 en PDF o link, sin entregarle la app completa.' },
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
  chev: ['M9 6l6 6l-6 6'],
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
        <section className="s-sec s-band">
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
        <section className="s-sec">
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

          {/* Los dos motores */}
          <div className="s-sub-h">Los dos motores</div>
          <div className="s-motors">
            {/* Motor A — Prospección */}
            <div className="s-motor s-motor-a">
              <div className="s-motor-hd">
                <span className="s-motor-id">A</span>
                <div>
                  <h3 className="s-motor-name">Prospección</h3>
                  <span className="s-motor-sub">Círculo rojo y tibio, a mano</span>
                </div>
                <span className="s-motor-cost s-motor-cost-zero">Costo cero</span>
              </div>
              <p className="s-motor-w">
                Ex-alumnos, asistentes de eventos y contactos propios. No se vende MaKo en frío: se ofrece
                el diagnóstico de su funnel y se lleva a una llamada. Es el motor que no depende de nada
                ni de nadie y puede arrancar hoy.
              </p>

              <div className="s-funnel">
                {PROSP_STEPS.map((st) => (
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
                <span className="s-neto-nota">25 mensajes por día · 22 días</span>
              </div>
              <div className="s-motor-note">
                Las conversiones son referencias tomadas de un equipo que manda 400 mensajes por día:
                sirven para dimensionar, no como promesa.
              </div>
            </div>

            {/* Motor B — Campaña de mensajes */}
            <div className="s-motor s-motor-b">
              <div className="s-motor-hd">
                <span className="s-motor-id">B</span>
                <div>
                  <h3 className="s-motor-name">Campaña de mensajes</h3>
                  <span className="s-motor-sub">Meta optimizando a WhatsApp</span>
                </div>
                <span className="s-motor-cost s-motor-cost-paid">$1,000 en agosto</span>
              </div>
              <p className="s-motor-w">
                El tipo de campaña más barato de todos y el que da señal casi inmediata. Un lead magnet
                funciona como excusa para que escriban: no escriben por un servicio, escriben por el
                recurso, y eso baja muchísimo la fricción. No hace falta landing.
              </p>

              <div className="s-spend">
                <div className="s-sp s-sp-1">
                  <div className="s-sp-hd">
                    <span className="s-sp-n">Fase 1</span>
                    <span className="s-sp-t">Encontrar el ganador</span>
                  </div>
                  <div className="s-sp-v s-num">$300</div>
                  <div className="s-sp-m">72 horas · $100 por día</div>
                  <p>Se largan las <b>9 celdas</b> de la matriz (3 quiénes × 3 razones) al mismo tiempo, cada una con su propia palabra clave, para medir intención real por mensajes en vez de por landing.</p>
                </div>
                <div className="s-sp s-sp-2">
                  <div className="s-sp-hd">
                    <span className="s-sp-n">Fase 2</span>
                    <span className="s-sp-t">Escalar</span>
                  </div>
                  <div className="s-sp-v s-num">$700</div>
                  <div className="s-sp-m">El resto del mes</div>
                  <p>Solo la celda ganadora queda corriendo. Si sostiene el costo por agenda, se sube el presupuesto o se pasa a VSL Funnel.</p>
                </div>
              </div>
              <div className="s-motor-note">
                Se puede probar más de un lead magnet dentro del RECON y quedarse con el que baje el costo
                por conversación.
              </div>
            </div>
          </div>
        </section>

        {/* ── Canales a futuro ─────────────────────────────────────────────── */}
        <section className="s-sec">
          <div className="s-sec-hd">
            <h2 className="s-h2">Canales de adquisición a futuro</h2>
            <Tag k="rec" />
          </div>
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
          </div>
        </section>

        {/* ── Funcionalidades que faltan ───────────────────────────────────── */}
        <section className="s-sec s-band s-sec-last">
          <div className="s-sec-hd">
            <h2 className="s-h2">Funcionalidades que faltan en MaKo</h2>
            <Tag k="rec" />
          </div>
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

/* Etiquetas de estatus */
.s-tag { display: inline-flex; align-items: center; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 3px 8px; border-radius: 6px; vertical-align: middle; white-space: nowrap; }
.s-tag-ok { color: #1D4FD8; background: #E7EFFE; }
.s-tag-rec { color: #9A6207; background: #FEF3DA; }
.s-tag-open { color: #5A6472; background: #EDEFF3; }

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
/* Banda de fondo full-width para separar visualmente las secciones (trick box-shadow + clip-path). */
.s-band { background: #F1F5FB; box-shadow: 0 0 0 100vmax #F1F5FB; clip-path: inset(0 -100vmax); border-bottom: none; }
.s-sec-hd { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.s-h2 { margin: 0; font-size: 27px; line-height: 1.15; letter-spacing: -.02em; font-weight: 600; color: #10131A; }
.s-sub-h { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #2F6FED; margin: 34px 0 2px; }
.s-sec-sub { margin: 2px 0 22px; font-size: 16px; line-height: 1.5; color: #5B6472; }
.s-sec-sub em { font-style: italic; color: #3A4150; }

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

/* Modelo del funnel */
.s-wmodel { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 20px; color: #C0C7D2; }
.s-wmodel-step { font-size: 13.5px; color: #454C58; background: #fff; border: 1px solid #E5E8EE; border-radius: 9px; padding: 9px 14px; }
.s-wmodel-step b { color: #10131A; font-weight: 600; }

/* Razón egoísta */
.s-egoist { margin-top: 14px; border: 1px solid #F0C169; border-radius: 16px; padding: 22px 24px; background: linear-gradient(160deg,#FFFBF2,#FFFFFF 60%); }
.s-egoist-q { margin: 0 0 12px; font-size: 19px; line-height: 1.45; font-weight: 600; letter-spacing: -.01em; color: #10131A; text-wrap: balance; }
.s-egoist-w { margin: 0; font-size: 14.5px; line-height: 1.6; color: #565E6B; }
.s-egoist-w b { color: #10131A; font-weight: 600; }
.s-egoist-w em { font-style: italic; color: #7A5406; }

/* Los dos motores */
.s-motors { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 14px; align-items: start; }
.s-motor { background: #fff; border: 1px solid #E9EBF0; border-radius: 18px; padding: 22px 24px; display: flex; flex-direction: column; }
.s-motor-a { border-color: #CBEBDC; }
.s-motor-b { border-color: #C7D9FA; }
.s-motor-hd { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.s-motor-hd > div { flex: 1; min-width: 0; }
.s-motor-id { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; font-size: 15px; font-weight: 700; color: #fff; background: #0E9F6E; }
.s-motor-b .s-motor-id { background: #2F6FED; }
.s-motor-name { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -.01em; color: #10131A; }
.s-motor-sub { font-size: 12.5px; color: #8892A0; }
.s-motor-cost { flex: none; font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 7px; }
.s-motor-cost-zero { color: #067A54; background: #DEF4EA; }
.s-motor-cost-paid { color: #1D4FD8; background: #E7EFFE; }
.s-motor-w { margin: 0 0 18px; font-size: 14px; line-height: 1.6; color: #565E6B; }
.s-motor-note { margin-top: 12px; font-size: 12.5px; line-height: 1.55; color: #7C8593; background: #F5F7FA; border-radius: 10px; padding: 12px 14px; }

/* Funnel */
.s-funnel { display: flex; flex-direction: column; }
.s-fstep { display: flex; flex-direction: column; }
.s-fconv { font-size: 11.5px; font-weight: 600; color: #9AA3B0; padding: 5px 0; text-align: center; }
.s-fbar-row { display: flex; align-items: center; gap: 12px; }
.s-fbar-track { flex: 1; min-width: 0; }
.s-fbar { height: 38px; border-radius: 8px; background: linear-gradient(90deg,#3B79EE,#5B92F4); min-width: 8%; }
.s-fstep:nth-child(2) .s-fbar { background: linear-gradient(90deg,#4A83EF,#6E9FF6); }
.s-fstep:nth-child(3) .s-fbar { background: linear-gradient(90deg,#0E9F6E,#16B57F); }
.s-fbar-lbl { font-size: 13px; color: #6B7482; white-space: nowrap; flex: none; }
.s-fbar-lbl b { color: #10131A; font-size: 16px; margin-left: 3px; }

.s-neto { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-top: 18px; padding: 14px 16px; border-radius: 12px; background: linear-gradient(160deg,#EAF8F1,#F6FCF9); border: 1px solid #CBEBDC; }
.s-neto-l { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #067A54; }
.s-neto-v { font-size: 25px; font-weight: 600; color: #067A54; }
.s-neto-nota { font-size: 11.5px; color: #4E9B7C; margin-left: auto; }

/* Plan de gasto (dentro del motor B) */
.s-spend { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.s-sp { border: 1px solid #E9EBF0; border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; }
.s-sp-1 { border-color: #C7D9FA; background: #F7FAFF; }
.s-sp-2 { border-color: #CBEBDC; background: #F5FCF9; }
.s-sp-hd { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; margin-bottom: 10px; }
.s-sp-n { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #fff; background: #2F6FED; padding: 3px 8px; border-radius: 6px; }
.s-sp-2 .s-sp-n { background: #0E9F6E; }
.s-sp-t { font-size: 14px; font-weight: 600; color: #10131A; }
.s-sp-v { font-size: 28px; font-weight: 600; letter-spacing: -.03em; color: #10131A; line-height: 1.1; }
.s-sp-m { font-size: 12px; color: #8892A0; margin-bottom: 10px; }
.s-sp p { margin: 0; font-size: 12.5px; line-height: 1.55; color: #565E6B; }
.s-sp p b { color: #10131A; font-weight: 600; }

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
  .s-tiers, .s-chs { grid-template-columns: 1fr; }
  .s-two, .s-lever-cols, .s-motors, .s-fg-items { grid-template-columns: 1fr; }
  .s-ch-lever { grid-column: auto; }
  .s-h1 { font-size: 40px; }
}
@media (max-width: 560px) {
  .s-main, .s-hdr-in, .s-foot-in { padding-left: 18px; padding-right: 18px; }
  .s-h1 { font-size: 33px; }
  .s-lead { font-size: 17px; }
  .s-h2 { font-size: 23px; }
  .s-logo-doc { display: none; }
  .s-spend { grid-template-columns: 1fr; }
}
`;
