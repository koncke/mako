// =============================================================================
// /vsl/estrategia — Documento INTERNO de oferta + estrategia de marketing.
// =============================================================================
// NO es una landing de venta: es la síntesis del brief maestro
// (MaKo_Brief_Oferta_y_Marketing.md) para presentarle a un consultor y ayudar a
// vender MaKo. Prioridad: minimalista + gráfico, sin omitir nada del brief.
//
// Autocontenido (mismo truco que _detalle/FeatureDetail): una capa
// position:fixed a pantalla completa que tapa y oculta el sidebar del layout
// raíz (body:has(.mk-str) aside{display:none}). Mismo lenguaje visual que /vsl:
// Geist, azul #2F6FED, oro MaKo #F2A516. Verde #0E9F6E para plata/neto.
// Sin CTA de venta (es interno). Los guiones largos van en <details> nativos.
//
// Convención de estatus del brief, representada como etiqueta:
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
    badge: 'Oferta de volumen del webinar',
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

type FStep = { label: string; val: string; w: number; conv?: string };
type Webinar = {
  tag: string; when: string; src: string; ads: string;
  adsTone: 'zero' | 'paid'; upsell?: string;
  steps: FStep[]; rev: { l: string; v: string }[];
  neto: string; netoNota: string;
};

const WEBINARS: Webinar[] = [
  {
    tag: 'Webinar 1',
    when: 'Agosto 2026',
    src: 'Prospección + Referidos',
    ads: 'Ads $0',
    adsTone: 'zero',
    steps: [
      { label: 'Asistentes', val: '50', w: 100 },
      { label: 'Llamadas', val: '25', w: 50, conv: '50% agenda' },
      { label: 'Ventas', val: '12', w: 24, conv: '50% cierre' },
    ],
    rev: [
      { l: '2 × 1 a 1', v: '$8,000' },
      { l: '10 × Grupal', v: '$15,000' },
      { l: 'Venta de entradas · $47 c/u', v: '$2,000' },
    ],
    neto: '$25,000',
    netoNota: 'Sin ads → todo margen',
  },
  {
    tag: 'Webinar 2',
    when: 'Septiembre 2026',
    src: 'VSL Funnel + Ads',
    ads: 'Ads $15,000',
    adsTone: 'paid',
    upsell: 'Upsells pre-webinar: Sala VIP + entregables de MaKo',
    steps: [
      { label: 'Asistentes', val: '300', w: 100 },
      { label: 'Llamadas', val: '60', w: 20, conv: '20% agenda' },
      { label: 'Ventas', val: '25', w: 8, conv: '40% cierre' },
    ],
    rev: [
      { l: '5 × 1 a 1', v: '$20,000' },
      { l: '20 × Grupal', v: '$30,000' },
      { l: 'Venta de entradas · $47 c/u', v: '$14,000' },
    ],
    neto: '$49,000',
    netoNota: 'Bruto $64,000 − Ads $15,000',
  },
];

type Channel = {
  id: string; name: string; cost: string;
  costTone: 'zero' | 'low' | 'paid' | 'lever';
  motor: string | null; what: string;
};

const CHANNELS: Channel[] = [
  {
    id: 'A',
    name: 'Prospección (outbound)',
    cost: 'Costo cero',
    costTone: 'zero',
    motor: 'Motor del Webinar 1',
    what: 'Al ICP: no vender MaKo en frío. Ofrecer el diagnóstico gratis de su VSL Funnel y llevar a una llamada.',
  },
  {
    id: 'B',
    name: 'Referidos',
    cost: 'Costo cero',
    costTone: 'zero',
    motor: 'Motor del Webinar 1',
    what: 'Boca a boca. Pedir referidos a clientes y red. Junto con prospección, mueve el primer webinar.',
  },
  {
    id: 'C',
    name: 'VSL Funnel propio + Ads',
    cost: 'Requiere caja',
    costTone: 'paid',
    motor: 'Motor del Webinar 2',
    what: 'El funnel ya está construido (landing /vsl + VSL + Calendly + diagnóstico + testimonios). Falta caja para pautar.',
  },
  {
    id: 'D',
    name: 'Orgánico + Lead Magnet',
    cost: 'Casi cero',
    costTone: 'low',
    motor: null,
    what: 'Los mismos creativos de ads, publicados en orgánico. "Comentá [palabra]" → ManyChat → link al diagnóstico → Calendly → CRM.',
  },
  {
    id: 'E',
    name: 'Asociarse con Infoproductores',
    cost: 'Mayor palanca',
    costTone: 'lever',
    motor: 'Cientos de clientes',
    what: 'Infoproductores con cientos de dueños que ya corren ads: un solo sí abre acceso a todos, ya calificados. Caso concreto: Jan.',
  },
];

const DECISIONES = [
  'Precios finales de los tres niveles (los de este doc son los últimos indicados).',
  'Duración de MaKo Solo: ¿4 meses o no?',
  'Single-pay de por vida: ¿sí o no?',
  'Presupuesto inicial de ads (septiembre en adelante).',
  'Modelo de la sociedad: rev-share 30–40% para arrancar, o bundle directo.',
  'Nombre real del aliado de ads.',
  'Palabra disparadora del lead magnet (ej. FUNNEL / DIAGNOSTICO).',
  'Cómo y cuándo pasar a evergreen.',
];

const PREOCUPACIONES = [
  'No quiere hacer webinars todos los meses → prefiere evergreen.',
  'MaKo no está adaptado a webinars: no puede usarlo para su propia adquisición.',
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
  check: ['M5 12l5 5l10 -10'],
  circle: ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0'],
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
          <span className="s-hdr-meta">Documento interno · Jul 2026</span>
        </div>
      </header>

      <main className="s-main">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="s-hero">
          <h1 className="s-h1">Cómo vamos a vender <span className="s-gold">MaKo</span></h1>
          <p className="s-lead">
            El software para vender high ticket con <strong>VSL Funnel</strong>. Una escalera de tres
            ofertas para que <strong>cualquier lead compre algo</strong>, empujada por un webinar y cinco
            canales de adquisición.
          </p>
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
                <li><b>Ya corre</b> un VSL Funnel pago (coach, consultor, agencia con oferta validada).</li>
                <li>Factura <b>$10–20k USD/mes</b>. No principiantes: gente ya en la cancha.</li>
                <li>Invierte en ads desde <b>~$50/día</b>.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── La oferta: escalera ──────────────────────────────────────────── */}
        <section className="s-sec s-band">
          <div className="s-sec-hd">
            <h2 className="s-h2">La oferta: una escalera de tres niveles</h2>
            <Tag k="ok" />
          </div>

          {/* Cards de nivel */}
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
                {t.fueraPitch && <div className="s-tier-note">Queda fuera del pitch del webinar — peldaño evergreen / rescate</div>}
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

        {/* ── Estrategia de Adquisición: webinar ───────────────────────────── */}
        <section className="s-sec s-band">
          <div className="s-sec-hd">
            <h2 className="s-h2">Estrategia de Adquisición</h2>
            <Tag k="ok" />
          </div>
          <div className="s-sub-h">Webinar</div>
          <div className="s-wmodel">
            <span className="s-wmodel-step">Webinar de <b>3 días</b> sobre VSL Funnel</span>
            <Ic d={I.chev} size={14} />
            <span className="s-wmodel-step">CTA: agendar <b>llamada 1 a 1</b></span>
            <Ic d={I.chev} size={14} />
            <span className="s-wmodel-step">En la llamada, <b>2 ofertas</b>: 1 a 1 + Grupal</span>
          </div>

          <div className="s-wbs">
            {WEBINARS.map((w) => (
              <div key={w.tag} className="s-wb">
                <div className="s-wb-top">
                  <div>
                    <span className="s-wb-tag">{w.tag}</span>
                    <span className="s-wb-when">{w.when}</span>
                  </div>
                  <div className="s-wb-srcs">
                    <span className="s-wb-src">{w.src}</span>
                    <span className={`s-wb-ads s-wb-ads-${w.adsTone}`}>{w.ads}</span>
                  </div>
                </div>

                <div className="s-funnel">
                  {w.steps.map((st) => (
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

                <div className="s-rev">
                  {w.rev.map((r) => (
                    <div key={r.l} className="s-rev-row">
                      <span>{r.l}</span>
                      <span className="s-num s-rev-v">{r.v}</span>
                    </div>
                  ))}
                </div>

                <div className="s-neto">
                  <span className="s-neto-l">Neto</span>
                  <span className="s-neto-v s-num">{w.neto}</span>
                  <span className="s-neto-nota">{w.netoNota}</span>
                </div>
                {w.upsell && <div className="s-wb-upsell">{w.upsell}</div>}
              </div>
            ))}
          </div>

          <div className="s-total">
            <span>Dos webinars (Ago + Sep)</span>
            <span className="s-total-v s-num">~$74,000 netos</span>
          </div>
        </section>

        {/* ── Canales de adquisición ───────────────────────────────────────── */}
        <section className="s-sec">
          <div className="s-sec-hd">
            <h2 className="s-h2">Cinco canales de adquisición</h2>
            <Tag k="ok" />
          </div>
          <div className="s-chs">
            {CHANNELS.map((c) => (
              <div key={c.id} className={`s-ch ${c.id === 'E' ? 's-ch-lever' : ''}`}>
                <div className="s-ch-top">
                  <span className="s-ch-id">{c.id}</span>
                  <span className={`s-ch-cost s-ch-cost-${c.costTone}`}>{c.cost}</span>
                </div>
                <h3 className="s-ch-name">{c.name}</h3>
                <p className="s-ch-what">{c.what}</p>
                {c.motor && <span className="s-ch-motor">{c.motor}</span>}
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

        {/* ── Decisiones abiertas ──────────────────────────────────────────── */}
        <section className="s-sec s-band">
          <div className="s-sec-hd">
            <h2 className="s-h2">Lo que falta definir</h2>
            <Tag k="open" />
          </div>
          <div className="s-two">
            <div>
              <span className="s-open-k">Decisiones pendientes</span>
              <ul className="s-open-list">
                {DECISIONES.map((d) => <li key={d}><Ic d={I.circle} size={15} />{d}</li>)}
              </ul>
            </div>
            <div>
              <span className="s-open-k">Preocupaciones planteadas</span>
              <ul className="s-open-list s-open-warn">
                {PREOCUPACIONES.map((p) => <li key={p}><Ic d={I.circle} size={15} />{p}</li>)}
              </ul>
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
          <p className="s-foot-src">Fuente: brief maestro + llamada Martín&nbsp;+&nbsp;Leila (17 jul 2026). No distribuir.</p>
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

/* Secciones */
.s-sec { padding: 46px 0; border-bottom: 1px solid #EEF0F4; }
/* Banda de fondo full-width para separar visualmente las secciones (trick box-shadow + clip-path). */
.s-band { background: #F1F5FB; box-shadow: 0 0 0 100vmax #F1F5FB; clip-path: inset(0 -100vmax); border-bottom: none; }
.s-sec-hd { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.s-h2 { margin: 0; font-size: 27px; line-height: 1.15; letter-spacing: -.02em; font-weight: 600; color: #10131A; }
.s-sub-h { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #2F6FED; margin: 20px 0 2px; }
.s-sec-sub { margin: 2px 0 22px; font-size: 16px; line-height: 1.5; color: #5B6472; }
.s-sec-sub em { font-style: italic; color: #3A4150; }
/* Cuadro "¿Qué es MaKo?" = link a la landing */
.s-card-link { text-decoration: none; color: inherit; display: flex; flex-direction: column; transition: border-color .18s ease, transform .18s ease; }
.s-card-link:hover { border-color: #BFD3F7; transform: translateY(-2px); }
.s-card-link-cta { margin-top: auto; display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: #2F6FED; }
.s-card-link .s-arr { transition: transform .18s ease; }
.s-card-link:hover .s-arr { transform: translateX(3px); }

/* Cards genéricas */
.s-two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 22px; }
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

/* Modelo del webinar */
.s-wmodel { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 20px; color: #C0C7D2; }
.s-wmodel-step { font-size: 13.5px; color: #454C58; background: #fff; border: 1px solid #E5E8EE; border-radius: 9px; padding: 9px 14px; }
.s-wmodel-step b { color: #10131A; font-weight: 600; }

/* Funnels del webinar */
.s-wbs { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 18px; }
.s-wb { background: #fff; border: 1px solid #E9EBF0; border-radius: 18px; padding: 22px 22px 20px; display: flex; flex-direction: column; }
.s-wb-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
.s-wb-tag { font-size: 16px; font-weight: 700; color: #10131A; margin-right: 8px; }
.s-wb-when { font-size: 13px; color: #8892A0; }
.s-wb-srcs { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
.s-wb-src { font-size: 12.5px; color: #6B7482; }
.s-wb-ads { font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 6px; }
.s-wb-ads-zero { color: #067A54; background: #DEF4EA; }
.s-wb-ads-paid { color: #B44708; background: #FDECDD; }

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

.s-rev { margin-top: 20px; padding-top: 16px; border-top: 1px dashed #E5E8EE; display: flex; flex-direction: column; gap: 9px; }
.s-rev-row { display: flex; align-items: center; justify-content: space-between; font-size: 13.5px; color: #565E6B; }
.s-rev-v { color: #10131A; font-weight: 600; }

.s-neto { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-top: 16px; padding: 14px 16px; border-radius: 12px; background: linear-gradient(160deg,#EAF8F1,#F6FCF9); border: 1px solid #CBEBDC; }
.s-neto-l { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #067A54; }
.s-neto-v { font-size: 26px; font-weight: 600; color: #067A54; }
.s-neto-nota { font-size: 11.5px; color: #4E9B7C; margin-left: auto; }
.s-wb-upsell { margin-top: 12px; font-size: 12.5px; line-height: 1.45; color: #6B7482; background: #F5F7FA; border-radius: 8px; padding: 9px 12px; }

.s-total { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-top: 16px; padding: 20px 26px; border-radius: 16px; background: linear-gradient(120deg,#0B8F63,#0A7D57); color: #fff; }
.s-total > span:first-child { font-size: 16px; font-weight: 600; }
.s-total-v { font-size: 30px; font-weight: 700; letter-spacing: -.02em; }

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
.s-ch-motor { font-size: 11.5px; font-weight: 600; color: #2F6FED; background: #EAF1FE; padding: 4px 10px; border-radius: 7px; align-self: flex-start; margin-top: auto; }
.s-ch-lever .s-ch-motor { color: #C77E08; background: #FBEBCB; }

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
.s-lever-cols .s-num { color: #10131A; font-weight: 600; }

/* Decisiones abiertas */
.s-open-k { display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #6B7482; margin-bottom: 14px; }
.s-open-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 11px; }
.s-open-list li { display: flex; align-items: flex-start; gap: 10px; font-size: 14.5px; line-height: 1.5; color: #454C58; }
.s-open-list svg { flex: none; margin-top: 2px; color: #A9B2BF; }
.s-open-warn li { color: #7A5406; }
.s-open-warn svg { color: #D4930C; }

/* Footer */
.s-foot { border-top: 1px solid #ECEEF2; background: #F5F7FA; }
.s-foot-in { max-width: 1060px; margin: 0 auto; padding: 30px 28px 40px; }
.s-foot .s-logo { margin-bottom: 12px; }
.s-foot .s-logo-txt { font-size: 18px; }
.s-foot-tag { margin: 0 0 4px; font-size: 14px; color: #565E6B; }
.s-foot-src { margin: 0; font-size: 12.5px; color: #9AA3B0; }

/* Responsive */
@media (max-width: 900px) {
  .s-tiers, .s-chs, .s-wbs { grid-template-columns: 1fr; }
  .s-two, .s-lever-cols { grid-template-columns: 1fr; }
  .s-ch-lever { grid-column: auto; }
  .s-h1 { font-size: 40px; }
}
@media (max-width: 560px) {
  .s-main, .s-hdr-in, .s-foot-in { padding-left: 18px; padding-right: 18px; }
  .s-h1 { font-size: 33px; }
  .s-lead { font-size: 17px; }
  .s-h2 { font-size: 23px; }
  .s-logo-doc { display: none; }
}
`;
