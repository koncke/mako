// =============================================================================
// /vsl/mako con el DISEÑO de la portada de Holo (https://tryholo.ai/), copiado el 11/11/2026 y vuelto a copiar el 14/11/2026
// =============================================================================
// Los valores (la escala de títulos, el fondo #0A0B14 de la mitad oscura, las tres píldoras de la barra, el hero de dos
// columnas 487/560 con sus chips de vidrio, las tarjetas inclinadas, el «cómo funciona» en círculo, las tarjetas de
// «Proactive», la tarjeta de resultados, las tarjetas blancas de radio 28 con su sombra de tres capas, la sección semana a
// semana, el riel de cajas #F7F7F7, la privacidad sobre el degradado gris, las preguntas en cajas #F5F6F8 y el pie
// #FAFAFA de cuatro columnas) se leyeron con getComputedStyle a 1440 y 390 px: docs/diseno/landings-competencia/mako.md.
// La letra de Holo es «NEXT Book» (propietaria): va Figtree (Google Fonts, OFL), la más parecida medida al lado.
//
// 14/11/2026, noche (Martín: «que la copia salga muy fiel a todas las animaciones… los videos, los hover, todo»). Holo se miró
// de nuevo con Chromium a 1440 y 390, con una parada de 4 s en cada sección, y se leyó su JavaScript (los componentes de Next,
// `_next/static/chunks/*.js`). Lo que se mueve y se copió aquí, con sus números:
//   · la barra: al bajar, la píldora de los links se apaga (opacidad 0, escala ,96) y el botón pasa de borde a lleno; sobre lo
//     blanco, las píldoras son de vidrio claro (rgba(255,255,255,.72), blur 18 px, saturación 1,6);
//   · todo entra con su `Reveal` (opacidad 0 y 24 px abajo → 0, ,6 s cubic-bezier(.16,1,.3,1), al entrar 80 px en la pantalla);
//     el hero con `seo-fade-in` (,7 s, 0,08 / 0,16 / 0,24 s);
//   · los botones NO crecen: brillan (`filter: brightness(1.1)`, ,2 s). La copia del 11/11 los agrandaba;
//   · «Holo runs your…»: las cuatro palabras se encienden letra por letra con el scroll (de ,22 a 1, con un destello de color de
//     0 → 1 → 0), entre que el titular está al 55 % y al 5 % de la pantalla;
//   · los cinco pasos de «How it works» aparecen al entrar (14 px y escala ,95, ,4 s), con las flechas;
//   · «Marketing on autopilot for founders»: 160 svh con la frase pegada, que se ESCRIBE con el scroll, prende un interruptor y al
//     final pasa el fondo de oscuro a blanco con la frase en una píldora oscura; después la última palabra rota cada 2 s;
//   · «Any niche…»: las tarjetas se apilan pegadas a 92 px (72 en el teléfono) y la de abajo se achica a ,9;
//   · «Strategy set…»: cuatro etapas de 5 s, con la raya de progreso y el titular que cambia (,35 s);
//   · «Inside…»: el riel de ocho cajas con video y sus flechas (una caja por toque, apagadas en las puntas);
//   · la cinta de habilidades: dos filas de 52 s y 60 s, en sentidos contrarios, que se arrastran con el mouse;
//   · el cierre: cuatro cursores que pasean (18, 20, 22 y 19 s) y la caja que escribe y borra sola (38 ms por letra, 22 al borrar).
// De MaKo: el logo, el azul #2F6FED y el dorado donde Holo pone su degradado, el caso de Mauricio, los textos y las PANTALLAS: las
// grabaciones reales de public/vsl-assets/sitio/ (las de la portada), cada una con el nombre de lo que muestra.
//
// Secciones de la referencia que NO van, y por qué: la píldora «4.6/5», la tira de redes con su contador, «Security &
// compliance», sus contadores (87 %, 11x, 23 h, 51 %), el carrusel 3D de sus anuncios, «Win rate», sus testimonios, G2, sus
// inversores y «Support 24/7»: son contadores, sellos, premios, inversores o testimonios suyos (la regla de /vsl). Sus muñecos
// (la fábrica del hero, el del sable, el del cierre) tampoco: en su lugar va la grabación o la estrella de MaKo.
// Un <script data-visor> (el visor borra los demás) hace lo que se mueve; sin él, todo se ve quieto y entero. Con «menos
// movimiento», nada se anima.
// =============================================================================

import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, EstrellaMaKo, LogoMaKo, TEXTO_CTA, html, otrasFunciones, TEXTO_CIERRE } from '../marca';
import { FaltaAnimacion } from '../FaltaAnimacion';
import { DIAS_HECHA } from '@/lib/recomendaciones-reglas';

type B<T extends Bloque['tipo']> = Extract<Bloque, { tipo: T }>;

function Ico({ paths, size = 20, grosor = 1.8 }: { paths?: string[]; size?: number; grosor?: number }) {
  if (!paths?.length) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

function Flecha({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6l-6 6" /></svg>;
}

/** Su botón «Try Holo»: la píldora de 50 px con el degradado y el brillo blanco adentro (el degradado, en azul y dorado). */
function Boton({ chico = false }: { chico?: boolean }) {
  return <a href={RUTA_CTA} className={`d-mako-btn${chico ? ' d-mako-btn-chico' : ''}`}>{TEXTO_CTA}<span className="d-mako-btn-f"><Flecha size={chico ? 16 : 18} /></span></a>;
}

/** Una grabación real de la app (public/vsl-assets/sitio/<n>.webm). Arranca el script cuando se ve; sin él, queda el póster. */
function Video({ n, clase, solo = false }: { n: string; clase?: string; solo?: boolean }) {
  return (
    <video className={clase} src={`/vsl-assets/sitio/${n}.webm`} poster={`/vsl-assets/sitio/${n}.jpg`} muted loop playsInline preload={solo ? 'auto' : 'none'} autoPlay={solo || undefined} data-mako-vid="" data-tema-fijo="" />
  );
}

const I = {
  chat: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9'],
  escudo: ['M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3', 'M9 12l2 2l4 -4'],
  lupa: ['M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', 'M21 21l-6 -6'],
  crm: ['M4 4h4v16h-4z', 'M10 4h4v10h-4z', 'M16 4h4v6h-4z'],
  anuncio: ['M3 10.5v3.5h3l6 4.5v-12l-6 4z', 'M16 9a5 5 0 0 1 0 6', 'M18.5 6.5a8.5 8.5 0 0 1 0 11'],
};

// ── Hero: el texto a la izquierda y, donde Holo pone su fábrica de muñecos (un video con máscara redonda y cuatro chips de
//    vidrio unidos por rayitas), el Second Brain REAL del Ops Center (la grabación de la portada, con el negocio de Alex
//    Hormozi) y los chips de las herramientas que el chat de MaKo lee. ───────────────────────────────────────────────────
const CHIPS_HERO = [
  { t: 'Spy', s: 'Lo que hace tu competencia', x: '15%', y: '6%', linea: 'abajo', ico: I.lupa },
  { t: 'CRM', s: 'Tus leads, etapa por etapa', x: '62%', y: '0%', linea: 'abajo', ico: I.crm },
  { t: 'Chats', s: 'Tus conversaciones', x: '79%', y: '58%', linea: 'arriba', ico: I.chat },
  { t: 'Anuncios', s: 'Lo que vendió cada uno', x: '14%', y: '70%', linea: 'arriba', ico: I.anuncio },
] as const;

function Hero({ b }: { b: B<'hero'> }) {
  return (
    <header className="d-mako-hero">
      <div className="d-mako-w d-mako-hero-g">
        <div className="d-mako-hero-txt">
          <div className="d-mako-in" style={{ animationDelay: '.08s' }}>
            <span className="d-mako-etq"><span className="d-mako-etq-ico"><EstrellaMaKo size={14} /></span>{b.etiqueta}</span>
            <h1 className="d-mako-h1" dangerouslySetInnerHTML={html(b.titulo)} />
          </div>
          <p className="d-mako-bajada d-mako-in" style={{ animationDelay: '.16s' }} dangerouslySetInnerHTML={html(b.bajada)} />
          <div className="d-mako-in d-mako-hero-pie" style={{ animationDelay: '.24s' }}>
            <div className="d-mako-hero-cta"><Boton /></div>
            {b.puntos?.length ? (
              <ul className="d-mako-confia">
                {b.puntos.map((p, i) => (
                  <li key={p}><Ico paths={i === 0 ? I.chat : I.escudo} size={24} grosor={1.6} /><span dangerouslySetInnerHTML={html(p)} /></li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <div className="d-mako-hero-vis">
          <a href={RUTA_CTA} className="d-mako-fab" aria-label="El Second Brain de MaKo, con el negocio de Alex Hormozi">
            {CHIPS_HERO.map((c) => (
              <span key={c.t} className={`d-mako-chip d-mako-chip-${c.linea}`} style={{ left: c.x, top: c.y }} aria-hidden="true">
                <span className="d-mako-chip-c"><b><Ico paths={[...c.ico]} size={15} grosor={1.9} />{c.t}</b><small>{c.s}</small></span>
              </span>
            ))}
            <Video n="cerebro" clase="d-mako-fab-v" solo />
          </a>
        </div>
      </div>
    </header>
  );
}

// ── «Ads that sell. Socials that grow. SEO that ranks. Emails that convert.»: cuatro tarjetas inclinadas con su ícono, su
//    título y, abajo, lo que Holo dibuja con su muñeco: aquí la grabación real del departamento de MaKo. ─────────────────────
const VIDEO_DEPARTAMENTO = ['copilot', 'carruseles', 'replicar', 'automations'];
const ICONO_DEPARTAMENTO = [
  ['M18 8a3 3 0 0 1 0 6', 'M10 8v11a1 1 0 0 1 -1 1h-1a1 1 0 0 1 -1 -1v-5', 'M12 8h0l4.524 -3.77a.9 .9 0 0 1 1.476 .692v12.156a.9 .9 0 0 1 -1.476 .692l-4.524 -3.77h-8a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h8'],
  ['M12 4l-8 4l8 4l8 -4l-8 -4', 'M4 12l8 4l8 -4', 'M4 16l8 4l8 -4'],
  ['M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z', 'M3 9h18', 'M7 6.5h.01', 'M10 6.5h.01'],
  I.chat,
];

function Inclinadas({ b }: { b: B<'filas'> }) {
  return (
    <section className="d-mako-s d-mako-oscuro d-mako-incl">
      <h2 className="d-mako-oculto" dangerouslySetInnerHTML={html(b.titulo)} />
      <div className="d-mako-incl-fila">
        {b.items.map((f, i) => (
          <div key={f.titulo} className="d-mako-incl-c d-mako-rv" style={{ ['--rv-d' as string]: `${i * 0.06}s` }}>
            <article className="d-mako-incl-t">
              <span className={`d-mako-incl-ico d-mako-incl-ico-${i % 3}`}><Ico paths={ICONO_DEPARTAMENTO[i] ?? I.chat} size={24} grosor={2} /></span>
              <h3 className="d-mako-incl-h" dangerouslySetInnerHTML={html(f.titulo)} />
              <div className="d-mako-incl-vis"><Video n={VIDEO_DEPARTAMENTO[i] ?? 'copilot'} clase="d-mako-incl-v" /></div>
            </article>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── «How it works?»: los cinco pasos alrededor del centro, en las posiciones de Holo (su escenario de 1140 × 720: el 1 arriba,
//    el 2 y el 5 a los costados, el 3 y el 4 abajo), con sus flechas. En su centro va su muñeco con el sable; aquí, la estrella
//    de MaKo flotando (la curva de su `holo-float`). ─────────────────────────────────────────────────────────────────────
const LUGAR_PASO = [
  { x: 405, y: 0 }, { x: 815, y: 152 }, { x: 690, y: 453 }, { x: 170, y: 453 }, { x: 10, y: 152 },
];

function Como({ b }: { b: B<'pasos'> }) {
  return (
    <section className="d-mako-s d-mako-oscuro d-mako-como" id="como">
      <div className="d-mako-w">
        <div className="d-mako-cab d-mako-rv">
          <h2 className="d-mako-h2" dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className="d-mako-cab-p" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <div className="d-mako-como-esc">
          <svg className="d-mako-como-flechas" viewBox="0 0 1140 720" fill="none" aria-hidden="true">
            <defs><marker id="d-mako-punta" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1l7 4l-7 4" fill="none" stroke="#F5F6F8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></marker></defs>
            <path className="d-mako-rv-f" style={{ ['--rv-d' as string]: '.2s' }} d="M640 40 C 740 46, 800 70, 850 128" markerEnd="url(#d-mako-punta)" />
            <path className="d-mako-rv-f" style={{ ['--rv-d' as string]: '.2s' }} d="M905 262 C 912 330, 880 390, 842 440" markerEnd="url(#d-mako-punta)" />
            <path className="d-mako-rv-f" style={{ ['--rv-d' as string]: '.2s' }} d="M680 560 C 590 600, 480 600, 420 566" markerEnd="url(#d-mako-punta)" />
            <path className="d-mako-rv-f" style={{ ['--rv-d' as string]: '.2s' }} d="M196 440 C 170 400, 150 350, 140 300" markerEnd="url(#d-mako-punta)" />
          </svg>
          <div className="d-mako-como-centro" aria-hidden="true">
            <span className="d-mako-como-aro" />
            <span className="d-mako-como-estrella"><EstrellaMaKo size={86} /></span>
          </div>
          {b.pasos.map((p, i) => {
            const l = LUGAR_PASO[i] ?? LUGAR_PASO[0];
            return (
              <div key={p.titulo} className={`d-mako-como-p d-mako-rv-p d-mako-como-p${i + 1}`} style={{ left: `${(l.x / 1140) * 100}%`, top: `${(l.y / 720) * 100}%` }}>
                <p className="d-mako-como-t">{i + 1}. <span dangerouslySetInnerHTML={html(p.titulo)} /></p>
                <div className="d-mako-como-card" dangerouslySetInnerHTML={html(p.texto)} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── «Holo runs your ads, email, social, and SEO end to end…»: las palabras en <em> se arman letra por letra (cada letra con su
//    color del destello, `--c0` = cuándo se enciende: 0,18 por palabra más su lugar en la palabra × 0,28). ───────────────────
const COLORES_DESTELLO = ['#2F6FED', '#5B8EF5', '#8FB2FA', '#F7C85A', '#F2B01E', '#F5A623'];

function TituloEncendido({ titulo }: { titulo: string }) {
  const partes = titulo.split(/<em>(.*?)<\/em>/g);
  let palabra = -1;
  // El lector de pantalla lee la frase entera (la copia escondida); lo que se ve, letra por letra, va aria-hidden.
  return (
    <h2 className="d-mako-uni-h" data-mako-enc="">
      <span className="d-mako-oculto" dangerouslySetInnerHTML={html(titulo)} />
      <span aria-hidden="true">
      {partes.map((parte, k) => {
        if (k % 2 === 0) return <span key={k} dangerouslySetInnerHTML={html(parte)} />;
        palabra++;
        const letras = Array.from(parte);
        const r = 0.18 * palabra;
        return (
          <span key={k} className="d-mako-uni-pal">
            {letras.map((ch, l) => (
              <span key={l} className="d-mako-uni-l" data-c0={(r + (l / letras.length) * 0.28).toFixed(4)}>
                <span className="d-mako-uni-b">{ch}</span>
                <span className="d-mako-uni-c" aria-hidden="true" style={{ color: COLORES_DESTELLO[(palabra + l) % COLORES_DESTELLO.length] }}>{ch}</span>
              </span>
            ))}
          </span>
        );
      })}
      </span>
    </h2>
  );
}

function Unifica({ b }: { b: B<'tarjetas'> }) {
  return (
    <section className="d-mako-s d-mako-oscuro d-mako-uni">
      <div className="d-mako-w">
        <TituloEncendido titulo={b.titulo} />
        <div className="d-mako-uni-g">
          {b.items.map((it, i) => (
            <div key={it.titulo} className="d-mako-uni-col d-mako-rv" style={{ ['--rv-d' as string]: `${i * 0.08}s` }}>
              <span className="d-mako-uni-ico"><Ico paths={it.icono} size={22} grosor={1.6} /></span>
              <p><b dangerouslySetInnerHTML={html(it.titulo)} /> <span dangerouslySetInnerHTML={html(it.texto)} /></p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** «Proactive. No prompt needed.»: sus seis tarjetas de vidrio con la píldora blanca arriba (sin hover: medido). */
function Proactivo({ b }: { b: B<'tarjetas'> }) {
  return (
    <section className="d-mako-s d-mako-oscuro d-mako-pro" id="sugiere">
      <div className="d-mako-w">
        <div className="d-mako-pro-cab d-mako-rv">
          <div>
            <h2 className="d-mako-h2" dangerouslySetInnerHTML={html(b.titulo)} />
            {b.bajada ? <p className="d-mako-pro-baj" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
          </div>
          <Boton />
        </div>
        <div className="d-mako-pro-g">
          {b.items.map((it, i) => (
            <article key={it.titulo} className="d-mako-pro-t d-mako-rv">
              <span className="d-mako-pro-chip"><span className={`d-mako-pro-chip-i d-mako-pro-chip-i${i % 2}`}><Ico paths={it.icono} size={18} grosor={2} /></span><span className="d-mako-pro-chip-t" dangerouslySetInnerHTML={html(it.titulo)} /></span>
              <p className="d-mako-pro-p" dangerouslySetInnerHTML={html(it.texto)} />
              {it.meta ? <span className="d-mako-pro-meta">{it.meta}</span> : null}
              <span className={`d-mako-pro-art d-mako-pro-art${i % 2}`} aria-hidden="true"><Ico paths={it.icono} size={58} grosor={1.3} /></span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** «Real customer results»: su fila del número grande y la tarjeta de rendimiento, con el caso de Mauricio. */
function Caso() {
  return (
    <section className="d-mako-oscuro d-mako-caso">
      <div className="d-mako-w">
        <div className="d-mako-caso-top d-mako-rv">
          <p className="d-mako-caso-t" dangerouslySetInnerHTML={html(CASO.titulo)} />
          <span className="d-mako-caso-sep" aria-hidden="true" />
          <p className="d-mako-caso-num">{CASO.meses[2].monto}</p>
          <div className="d-mako-caso-barra">
            <span className="d-mako-caso-pista"><span /></span>
            <p className="d-mako-caso-lab">en {CASO.meses[2].mes.toLowerCase()}</p>
          </div>
        </div>
        <div className="d-mako-caso-card d-mako-rv">
          <div className="d-mako-caso-in">
            <div className="d-mako-caso-cab">
              <p className="d-mako-caso-quien">{CASO.quien}</p>
              <span className="d-mako-caso-rol">{CASO.rol}</span>
            </div>
            <div className="d-mako-caso-stats">
              {CASO.meses.map((m, i) => (
                <div key={m.mes} className={`d-mako-caso-st${i === 0 ? ' d-mako-caso-st-on' : ''}`}><span>{m.mes}</span><p>{m.monto}</p></div>
              ))}
            </div>
            <div className="d-mako-caso-cuerpo">
              <video className="d-mako-caso-video" muted loop playsInline preload="none" data-mako-vid="" data-tema-fijo=""><source src={CASO.video} type="video/mp4" /></video>
              <div className="d-mako-caso-hist">
                {CASO.historia.map((h) => <p key={h} dangerouslySetInnerHTML={html(h)} />)}
                <p className="d-mako-caso-res" dangerouslySetInnerHTML={html(CASO.resultado)} />
              </div>
            </div>
          </div>
          <p className="d-mako-caso-pie">{CASO.sub}</p>
        </div>
      </div>
    </section>
  );
}

// ── «Marketing on autopilot for founders» (su `ScrollTyper`): la frase se escribe con el scroll, el interruptor se prende tres
//    letras después de «aprende solo» (el de «Aprende solo» del Second Brain, app/second-brain/AprendeSolo.tsx) y la última
//    palabra rota. Sin «piloto automático»: MaKo no publica solo. ─────────────────────────────────────────────────────────
const FRASE = 'Tu Second Brain aprende solo para';
const FRASE_TRAS_INTERRUPTOR = 'aprende solo';
const FRASE_ROTA = ['coaches', 'agencias', 'consultores', 'inmobiliarias', 'infoproductores'];

function Frase() {
  const texto = `${FRASE} ${FRASE_ROTA[0]}`;
  const corte = FRASE.indexOf(FRASE_TRAS_INTERRUPTOR) + FRASE_TRAS_INTERRUPTOR.length;
  const ultima = FRASE.length + 1;
  return (
    <section className="d-mako-frase" data-tema-fijo="" aria-label={`${FRASE} ${FRASE_ROTA.join(', ')}`}>
      <div className="d-mako-frase-pega">
        <span className="d-mako-frase-pil">
          <span className="d-mako-frase-t" aria-hidden="true">
            {Array.from(texto).map((ch, i) => (
              <span key={i} className={`d-mako-frase-l${i >= ultima ? ' d-mako-frase-ult' : ''}`} data-i={i}>
                {ch}
                {i === corte - 1 ? <span className="d-mako-frase-sw" data-desde={corte}><span /></span> : null}
              </span>
            ))}
            <span className="d-mako-frase-rota">
              {FRASE_ROTA.map((p, i) => <span key={p} className={i === 0 ? 'es-on' : undefined}>{p}</span>)}
            </span>
          </span>
        </span>
      </div>
    </section>
  );
}

// ── «Any niche / Any language / Any integration»: tarjetas blancas que se apilan pegadas arriba. Donde Holo pone su buscador
//    con píldoras, lo real de MaKo: el Second Brain, los logos de lo que se conecta en Integraciones, y el recuadro de lo que
//    falta grabar (los roles del equipo). ──────────────────────────────────────────────────────────────────────────────
const LOGOS_INTEGRACIONES = [
  ['meta.svg', 'Meta'], ['instagram.png', 'Instagram'], ['facebook.png', 'Facebook'], ['whatsapp.svg', 'WhatsApp'],
  ['youtube.png', 'YouTube'], ['calendly.png', 'Calendly'], ['calcom.png', 'Cal.com'], ['zoom.svg', 'Zoom'],
  ['fathom.png', 'Fathom'], ['stripe.png', 'Stripe'], ['mercadopago.svg', 'Mercado Pago'],
] as const;

function VisualNicho({ i }: { i: number }) {
  if (i === 0) return <Video n="cerebro" clase="d-mako-nicho-v" />;
  if (i === 2) {
    return (
      <div className="d-mako-nicho-logos">
        {LOGOS_INTEGRACIONES.map(([f, n]) => (
          // eslint-disable-next-line @next/next/no-img-element
          <span key={f} className="d-mako-nicho-logo" title={n}><img src={`/vsl-assets/logos/integraciones/${f}`} alt={n} width={36} height={36} loading="lazy" decoding="async" /></span>
        ))}
      </div>
    );
  }
  return <FaltaAnimacion que="Los roles de tu equipo en MaKo, tal cual son." />;
}

function Nicho({ b }: { b: B<'tarjetas'> }) {
  return (
    <section className="d-mako-s d-mako-claro d-mako-nicho" data-tema-fijo="" data-mako-tono="claro">
      <div className="d-mako-w">
        <h2 className="d-mako-h2 d-mako-h2-claro d-mako-rv" dangerouslySetInnerHTML={html(b.titulo)} />
        <div className="d-mako-nicho-lista">
          {b.items.map((it, i) => (
            <div key={it.titulo} className="d-mako-nicho-pega">
              <article className="d-mako-nicho-t">
                <div>
                  <h3 className="d-mako-nicho-h" dangerouslySetInnerHTML={html(it.titulo)} />
                  <p className="d-mako-nicho-p" dangerouslySetInnerHTML={html(it.texto)} />
                </div>
                <div className="d-mako-nicho-vis"><VisualNicho i={i} /></div>
              </article>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── «Strategy set, campaigns live»: cuatro etapas de 5 s (las elige una casilla: anda sin JavaScript), el titular y el texto de la
//    activa, la grabación de los tableros y la fila de etapas con la raya gris que crece y la de color sobre la activa. ────────
const ETAPAS = ['Al empezar', 'Al usarlo', 'Al descartar', `A los ${DIAS_HECHA} días`];

function Semanas({ b }: { b: B<'pasos'> }) {
  return (
    <section className="d-mako-s d-mako-claro d-mako-sem" data-tema-fijo="" data-mako-tono="claro">
      <div className="d-mako-w d-mako-sem-raiz">
        {b.pasos.map((_, i) => <input key={i} type="radio" name="d-mako-sem" id={`d-mako-sem-${i}`} className="d-mako-sem-r" defaultChecked={i === 0} aria-label={ETAPAS[i]} />)}
        <div className="d-mako-sem-cab d-mako-rv">
          <div className="d-mako-sem-hs">
            {b.pasos.map((p, i) => i === 0
              ? <h2 key={p.titulo} className="d-mako-sem-h" data-i={i} dangerouslySetInnerHTML={html(p.titulo)} />
              : <p key={p.titulo} className="d-mako-sem-h" data-i={i} role="heading" aria-level={2} dangerouslySetInnerHTML={html(p.titulo)} />)}
          </div>
          <div className="d-mako-sem-xs">
            {b.pasos.map((p, i) => <p key={p.titulo} className="d-mako-sem-x" data-i={i} dangerouslySetInnerHTML={html(p.texto)} />)}
          </div>
        </div>
        <div className="d-mako-sem-vis d-mako-rv" style={{ ['--rv-d' as string]: '.1s' }}><Video n="tableros" clase="d-mako-sem-v" /></div>
        <div className="d-mako-sem-tabs d-mako-rv" style={{ ['--rv-d' as string]: '.1s' }}>
          <span className="d-mako-sem-gris" aria-hidden="true" />
          <span className="d-mako-sem-color" aria-hidden="true" />
          {b.pasos.map((_, i) => <label key={i} htmlFor={`d-mako-sem-${i}`} data-i={i}>{ETAPAS[i]}</label>)}
        </div>
      </div>
    </section>
  );
}

// ── «Inside your new marketing department.»: el riel de cajas #F7F7F7 de 400 × 460 con su video y su leyenda «Título. texto»;
//    las flechas son links (sin JavaScript bajan al riel; con él, corren una caja). ─────────────────────────────────────
const VIDEO_ADENTRO = ['referentes', 'cerebro', 'spy', 'crm-ficha', 'chats', 'cobranza', 'video', 'copywriting'];

function Adentro({ b }: { b: B<'tarjetas'> }) {
  return (
    <section className="d-mako-claro d-mako-dentro" data-tema-fijo="" data-mako-tono="claro">
      <div className="d-mako-dentro-cab">
        <h2 className="d-mako-h2 d-mako-h2-claro d-mako-dentro-h d-mako-rv" dangerouslySetInnerHTML={html(b.titulo)} />
        <div className="d-mako-dentro-flechas">
          <a href="#d-mako-riel" className="d-mako-dentro-fl d-mako-dentro-ant" data-dir="-1" aria-label="Ver la caja anterior"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7l7 7" /></svg></a>
          <a href="#d-mako-riel" className="d-mako-dentro-fl" data-dir="1" aria-label="Ver la caja siguiente"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7l-7 7" /></svg></a>
        </div>
      </div>
      <div className="d-mako-dentro-fila" id="d-mako-riel">
        {b.items.map((it, i) => (
          <article key={it.titulo} className="d-mako-dentro-t" data-reel="">
            <div className="d-mako-dentro-caja"><Video n={VIDEO_ADENTRO[i] ?? 'cerebro'} clase="d-mako-dentro-v" /></div>
            <p className="d-mako-dentro-p"><b dangerouslySetInnerHTML={html(it.titulo + '.')} /> <span dangerouslySetInnerHTML={html(it.texto)} /></p>
          </article>
        ))}
      </div>
    </section>
  );
}

/** La cinta de habilidades: dos filas que corren en sentidos contrarios (52 s y 60 s), con su copia para no cortarse. */
function Cinta({ b }: { b: B<'tarjetas'> }) {
  const mitad = Math.ceil(b.items.length / 2);
  const filas = [b.items.slice(0, mitad), b.items.slice(mitad)];
  return (
    <section className="d-mako-claro d-mako-cinta" data-tema-fijo="" data-mako-tono="claro">
      <h2 className="d-mako-oculto" dangerouslySetInnerHTML={html(b.titulo)} />
      {filas.map((fila, f) => (
        <div key={f} className="d-mako-cinta-fila" data-fila={f}>
          <div className={`d-mako-cinta-pista${f === 1 ? ' d-mako-cinta-reves' : ''}`}>
            {[0, 1].map((copia) => (
              <div key={copia} className="d-mako-cinta-juego" aria-hidden={copia === 1 || undefined}>
                {fila.map((it, i) => (
                  <div key={it.titulo} className="d-mako-cinta-t">
                    <span className="d-mako-chica-chip"><span className={`d-mako-pro-chip-i d-mako-pro-chip-i${(i + f) % 2}`}><Ico paths={it.icono} size={18} grosor={2} /></span><b dangerouslySetInnerHTML={html(it.titulo)} /></span>
                    <p dangerouslySetInnerHTML={html(it.texto)} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/** «With great powers comes great privacy.»: tres tarjetas blancas sobre el degradado gris. */
function Datos({ b }: { b: B<'tarjetas'> }) {
  return (
    <section className="d-mako-s d-mako-datos" id="datos" data-tema-fijo="" data-mako-tono="claro">
      <div className="d-mako-w">
        <h2 className="d-mako-h2 d-mako-h2-claro d-mako-centro d-mako-datos-h d-mako-rv" dangerouslySetInnerHTML={html(b.titulo)} />
        <div className="d-mako-datos-g">
          {b.items.map((it, i) => (
            <article key={it.titulo} className="d-mako-datos-t d-mako-rv" style={{ ['--rv-d' as string]: `${i * 0.08}s` }}>
              <span className="d-mako-datos-ico"><Ico paths={it.icono} size={18} grosor={1.8} /></span>
              <p className="d-mako-datos-tt" dangerouslySetInnerHTML={html(it.titulo)} />
              <p className="d-mako-datos-p" dangerouslySetInnerHTML={html(it.texto)} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** «Skeptical? Good. Read this.»: el título con su línea corta y su botón, y las preguntas en cajas grises. */
function Preguntas({ b }: { b: B<'preguntas'> }) {
  return (
    <section className="d-mako-claro d-mako-faq" id="preguntas" data-tema-fijo="" data-mako-tono="claro">
      <div className="d-mako-faq-w">
        <div className="d-mako-faq-cab d-mako-rv">
          <h2 className="d-mako-h2 d-mako-h2-claro" dangerouslySetInnerHTML={html(b.titulo)} />
          <p className="d-mako-faq-corta">La versión corta: MaKo hace el trabajo y tú tienes la última palabra.</p>
          <div className="d-mako-faq-btn"><Boton /></div>
        </div>
        <div className="d-mako-faq-lista">
          {b.items.map((q) => (
            <details key={q.p} className="d-mako-faq-i d-mako-rv">
              <summary><span>{q.p}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg></summary>
              <p dangerouslySetInnerHTML={html(q.r)} />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// Las dos listas de bloques del mismo tipo, en el orden de Holo.
const ORDEN_TARJETAS = [Unifica, Proactivo, Nicho, Adentro, Cinta, Datos];

function Seccion({ b, i, bloques }: { b: Bloque; i: number; bloques: Bloque[] }) {
  switch (b.tipo) {
    case 'hero': return <Hero b={b} />;
    case 'filas': return <Inclinadas b={b} />;
    case 'pasos': {
      // El primer «pasos» es «How it works?»; el segundo, la sección semana a semana.
      const primero = bloques.findIndex((x) => x.tipo === 'pasos') === i;
      return primero ? <Como b={b} /> : <Semanas b={b} />;
    }
    case 'tarjetas': {
      const n = bloques.slice(0, i).filter((x) => x.tipo === 'tarjetas').length;
      const C = ORDEN_TARJETAS[n] ?? Datos;
      return <C b={b} />;
    }
    // Después de los resultados, la frase que se escribe sola (no es un bloque: no tiene datos más que su frase).
    case 'caso': return <><Caso /><Frase /></>;
    case 'preguntas': return <Preguntas b={b} />;
    default: return null;
  }
}

function Pie({ slug }: { slug: string }) {
  const otras = otrasFunciones(slug);
  const cols = [0, 1, 2].map((c) => otras.slice(Math.ceil(otras.length / 3) * c, Math.ceil(otras.length / 3) * (c + 1)));
  return (
    <footer className="d-mako-pie">
      <div className="d-mako-pie-g">
        <div className="d-mako-pie-marca">
          <LogoMaKo className="d-mako-pie-logo" tamano={26} />
          <p>El mejor software para vender High Ticket.</p>
        </div>
        {cols.map((col, i) => (
          <nav key={i} className="d-mako-pie-col" aria-label={i === 0 ? 'Funciones de MaKo' : undefined}>
            <h2 aria-hidden={i > 0 || undefined}>{i === 0 ? 'Funciones' : ' '}</h2>
            {col.map((o) => <a key={o.href} href={o.href}>{o.nombre}</a>)}
          </nav>
        ))}
      </div>
      <div className="d-mako-pie-abajo">
        <p>© MaKo — Todos los derechos reservados.</p>
        <a href={RUTA_CTA} className="d-mako-pie-cta">{TEXTO_CTA}</a>
      </div>
    </footer>
  );
}

// Los cuatro cursores del cierre: sus recorridos (left/top en seis puntos, el primero igual al último), sus tiempos y, en vez
// de Ads/Socials/Emails/SEO, los cuatro departamentos de las tarjetas inclinadas.
const CURSORES = [
  { t: 'Anuncios', c: '#2F6FED', d: 18 },
  { t: 'Contenido', c: '#D9910B', d: 20 },
  { t: 'Mensajes', c: '#1F57C8', d: 22 },
  { t: 'Landings', c: '#5B8EF5', d: 19 },
];

export default function DisenoMako({ landing }: PropsDiseno) {
  return (
    <div className="d-mako">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="d-mako-nav">
        <LogoMaKo className="d-mako-nav-logo" tamano={24} claro />
        <nav className="d-mako-nav-links" aria-label="Secciones">
          <a href="#como">Cómo funciona</a>
          <a href="#sugiere">Sugerencias</a>
          <a href="#datos">Tus datos</a>
          <a href="#preguntas">Preguntas</a>
        </nav>
        <a href={RUTA_CTA} className="d-mako-nav-cta">{TEXTO_CTA}<Flecha size={15} /></a>
      </div>
      <main>
        {landing.bloques.map((b, i) => <Seccion key={`${b.tipo}-${i}`} b={b} i={i} bloques={landing.bloques} />)}
        <section className="d-mako-claro d-mako-cierre" data-tema-fijo="" data-mako-tono="claro">
          {CURSORES.map((k, i) => (
            <span key={k.t} className={`d-mako-cursor d-mako-cursor-${i + 1}`} style={{ animationDuration: `${k.d}s`, animationDelay: `${i * 0.5}s` }} aria-hidden="true">
              <svg viewBox="0 0 20 24" fill="none"><path d="M1 1.2v17.2l4.7-4.4 3.6 7.7 2.8-1.25-3.65-7.75H16.8L1 1.2z" fill={k.c} /></svg>
              <span style={{ background: k.c }}>{k.t}</span>
            </span>
          ))}
          <div className="d-mako-cierre-in">
            <h2 className="d-mako-h2 d-mako-h2-claro d-mako-centro d-mako-cierre-h d-mako-rv">Pon a trabajar hoy tu departamento de marketing.</h2>
            <div className="d-mako-cierre-caja d-mako-rv" style={{ ['--rv-d' as string]: '.08s' }}>
              <p className="d-mako-cierre-escribe"><span className="d-mako-cierre-txt" data-frases={JSON.stringify(['Cuéntale tu negocio a MaKo'])}>Cuéntale tu negocio a MaKo</span><span className="d-mako-cierre-caret" aria-hidden="true" /></p>
              <p className="d-mako-cierre-nota">{TEXTO_CIERRE}</p>
              <div className="d-mako-cierre-pie">
                <span className="d-mako-cierre-mas" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></span>
                <Boton chico />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Pie slug={landing.slug} />
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </div>
  );
}

const DEG = 'linear-gradient(103.56deg, #F2B01E 5%, #F5A623 13%, #5B8EF5 30%, #2F6FED 62%, #1F57C8 90%)';
const SUAVE = 'cubic-bezier(.16,1,.3,1)';

const CSS = `
@font-face { font-family: 'Figtree'; src: url('/vsl-assets/fuentes/figtree/figtree-latin.woff2') format('woff2'); font-weight: 300 900; font-style: normal; font-display: swap; }
.d-mako { background: #0A0B14; color: #1F2028; font-family: 'Figtree', ui-sans-serif, system-ui, sans-serif; font-size: 18px; line-height: 23.4px; -webkit-font-smoothing: antialiased; overflow-x: clip; }
:where(.d-mako) *, :where(.d-mako) *::before, :where(.d-mako) *::after { box-sizing: border-box; }
:where(.d-mako) :where(p, h1, h2, h3, ul, ol) { margin: 0; padding: 0; }
:where(.d-mako) :where(ul, ol) { list-style: none; }
:where(.d-mako) a { color: inherit; }
.d-mako-w { width: 100%; max-width: min(1080px, calc(100% - 80px)); margin: 0 auto; }
.d-mako-s { padding: 96px 24px; }
.d-mako-oscuro { background: #0A0B14; color: #F5F6F8; }
.d-mako-claro { background: #fff; color: #1F2028; }
.d-mako-centro { text-align: center; }
.d-mako-oculto { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* Lo que entra al bajar (su Reveal): sólo con el script puesto; sin él, todo se ve. */
.d-mako-js .d-mako-rv { opacity: 0; transform: translateY(var(--rv-y, 24px)); transition: opacity .6s ${SUAVE} var(--rv-d, 0s), transform .6s ${SUAVE} var(--rv-d, 0s); }
.d-mako-js .d-mako-rv.es-visto { opacity: 1; transform: none; }
.d-mako-js .d-mako-rv-p { opacity: 0; transform: translateY(14px) scale(.95); transition: opacity .4s ease-out .15s, transform .4s ease-out .15s; }
.d-mako-js .d-mako-rv-p.es-visto { opacity: 1; transform: none; }
.d-mako-js .d-mako-rv-f { opacity: 0; transition: opacity .5s ease-out var(--rv-d, 0s); }
.d-mako-js .d-mako-rv-f.es-visto { opacity: 1; }
.d-mako-in { animation: d-mako-sube .7s ${SUAVE} both; }

/* Títulos: 36,8 / 42,32, -0,552 px, 700; la segunda mitad (<em>) con su degradado gris en lo oscuro y #A5A5AD en lo claro */
.d-mako-h2 { font-size: 36.8px; line-height: 42.32px; letter-spacing: -0.552px; font-weight: 700; color: #F5F6F8; text-wrap: balance; }
.d-mako-h2 em { font-style: normal; background: linear-gradient(#EDEEF2 0%, #B9BAC2 55%, #6D6E76 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.d-mako-h2-claro { color: #1F2028; }
.d-mako-h2-claro em { font-style: normal; background: none; color: #A5A5AD; }
.d-mako-cab { display: flex; justify-content: space-between; align-items: flex-start; gap: 40px; }
.d-mako-cab .d-mako-h2 { max-width: 346px; }
.d-mako-cab-p { width: 380px; flex: none; font-size: 18px; line-height: 23.4px; color: #C7C8CE; }

/* Botón: la píldora de 50 px (10 10 10 20), el degradado y el brillo blanco adentro. Su hover: brightness(1.1) en ,2 s, sin crecer. */
.d-mako-btn { position: relative; display: inline-flex; align-items: center; gap: 10px; height: 50px; padding: 10px 10px 10px 20px; border-radius: 9999px; background: ${DEG}; box-shadow: inset 0 0 10px rgba(255,255,255,.85); color: #FBFBFB; font-size: 17.2px; line-height: 26px; font-weight: 700; text-decoration: none; white-space: nowrap; transition: filter .2s cubic-bezier(.4,0,.2,1); }
.d-mako-btn-f { width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; }
.d-mako-btn:hover { filter: brightness(1.1); }
.d-mako-btn-chico { height: 42px; padding: 8px 8px 8px 20px; font-size: 15px; line-height: 22px; }
.d-mako-btn-chico .d-mako-btn-f { width: 26px; height: 26px; }

/* Barra: tres píldoras de 44 px centradas, fija arriba (12 px). Al bajar, los links se apagan y el botón se llena; sobre lo blanco, vidrio claro. */
.d-mako-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 80; display: flex; justify-content: center; align-items: center; gap: 8px; padding: 12px 24px 0; pointer-events: none; }
.d-mako-nav > * { pointer-events: auto; }
.d-mako-nav-logo { height: 44px; padding: 0 16px 0 12px; border-radius: 9999px; background: #0A0B14; border: 1px solid rgba(255,255,255,.14); transition: background-color .3s, border-color .3s, color .3s; }
.d-mako-nav-links { display: flex; align-items: center; gap: 28px; height: 44px; padding: 0 32px; border-radius: 9999px; border: 1px solid rgba(255,255,255,.14); background: #0A0B14; transition: opacity .3s ${SUAVE}, transform .3s ${SUAVE}, background-color .3s, border-color .3s; }
.d-mako-nav-links a { font-size: 15px; line-height: 19.5px; font-weight: 700; color: #F5F6F8; text-decoration: none; }
.d-mako-nav-cta { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 20px; border-radius: 9999px; border: 1.5px solid transparent; background: linear-gradient(#0A0B14, #0A0B14) padding-box, ${DEG} border-box; color: #F5F6F8; font-size: 15px; line-height: 19.5px; font-weight: 700; text-decoration: none; white-space: nowrap; transition: filter .2s cubic-bezier(.4,0,.2,1); }
.d-mako-nav-cta:hover { filter: brightness(1.1); }
.d-mako-nav.es-baja .d-mako-nav-links { opacity: 0; transform: scale(.96); pointer-events: none; }
.d-mako-nav.es-baja .d-mako-nav-cta { border-color: transparent; background: ${DEG} border-box; color: #fff; box-shadow: inset 0 0 10px rgba(255,255,255,.85); }
.d-mako-nav.es-claro .d-mako-nav-logo, .d-mako-nav.es-claro .d-mako-nav-links { background: rgba(255,255,255,.72); -webkit-backdrop-filter: blur(18px) saturate(1.6); backdrop-filter: blur(18px) saturate(1.6); border-color: rgba(22,23,29,.08); color: #16171D !important; }
.d-mako-nav.es-claro .d-mako-nav-links a { color: #16171D; }

/* Hero: 80 24 24 sobre #0A0B14; la grilla 487 / 560 con 32 de espacio */
.d-mako-hero { background: #0A0B14; color: #F5F6F8; padding: 80px 24px 24px; overflow-x: clip; }
.d-mako-hero-g { display: grid; grid-template-columns: minmax(0, 487fr) minmax(0, 560fr); gap: 32px; align-items: center; margin-top: 24px; }
.d-mako-etq { display: inline-flex; align-items: center; gap: 10px; height: 38px; padding: 6px 14px 6px 8px; border-radius: 9999px; border: 1px solid rgba(255,255,255,.22); font-size: 12.5px; line-height: 16.25px; color: #C7C8CE; }
.d-mako-etq-ico { width: 24px; height: 24px; border-radius: 9999px; background: #1A1712; display: inline-flex; align-items: center; justify-content: center; }
.d-mako-h1 { margin-top: 24px; font-size: 60.64px; line-height: 69.55px; letter-spacing: -0.8px; font-weight: 700; color: #F5F6F8; }
.d-mako-h1 em { font-style: normal; display: inline-block; color: transparent; filter: drop-shadow(0 0 16px rgba(255,255,255,.3)); background-image: linear-gradient(90deg, #fff 0% 34%, #2F6FED 41%, #5B8EF5 45%, #8FB2FA 50%, #F7C85A 55%, #F2B01E 59%, #F5A623 62%, #fff 68% 100%); background-size: 300% 100%; -webkit-background-clip: text; background-clip: text; animation: d-mako-brillo 8s linear infinite; }
.d-mako-bajada { margin-top: 24px; max-width: 336px; font-size: 17px; line-height: 23.375px; font-weight: 600; color: #C7C8CE; }
.d-mako-bajada strong { font-weight: 400; color: #94959D; }
.d-mako-hero-cta { margin-top: 28px; }
.d-mako-confia { margin-top: 20px; display: flex; gap: 32px; flex-wrap: wrap; }
.d-mako-confia li { display: flex; align-items: center; gap: 12px; color: #94959D; font-size: 13px; line-height: 16.25px; }
.d-mako-confia li span { color: #C7C8CE; max-width: 200px; }
.d-mako-confia strong { display: block; font-size: 13.5px; line-height: 16.875px; font-weight: 700; color: #F5F6F8; }
.d-mako-hero-vis { margin-left: -86px; }
/* Su «fábrica»: el video con la máscara redonda y los chips de vidrio unidos por una rayita punteada */
.d-mako-fab { position: relative; display: block; aspect-ratio: 1112 / 834; }
.d-mako-fab-v { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; -webkit-mask-image: radial-gradient(60% 60% at 50% 50%, black 48%, transparent 86%); mask-image: radial-gradient(60% 60% at 50% 50%, black 48%, transparent 86%); }
.d-mako-chip { position: absolute; z-index: 2; display: flex; flex-direction: column; align-items: center; pointer-events: none; }
.d-mako-chip::before, .d-mako-chip::after { content: ''; width: 0; height: 32px; border-left: 1px dashed rgba(255,255,255,.3); }
.d-mako-chip-abajo::before, .d-mako-chip-arriba::after { display: none; }
.d-mako-chip-abajo::after { margin-top: 4px; }
.d-mako-chip-arriba::before { margin-bottom: 4px; }
.d-mako-chip-c { display: flex; flex-direction: column; gap: 2px; padding: 10px 16px; border-radius: 12px; background: rgba(10,11,20,.55); border: 1px solid rgba(255,255,255,.2); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
.d-mako-chip b { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; line-height: 18.2px; font-weight: 700; color: #F5F6F8; }
.d-mako-chip small { white-space: nowrap; font-size: 11.5px; line-height: 14.375px; color: #C7C8CE; }

/* Las tarjetas inclinadas: #0E0F1A, borde blanco 12 %, radio 26, 264 × 462 girando -4°, 2,5°, -2° y 3,5°; sin hover (medido) */
.d-mako-incl { padding: 96px 24px; }
.d-mako-incl-fila { display: flex; justify-content: center; align-items: flex-start; gap: 7px; }
.d-mako-incl-c { flex: none; }
.d-mako-incl-t { width: 264px; height: 462px; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 20px 20px 0; border-radius: 26px; background: #0E0F1A; border: 1px solid rgba(255,255,255,.12); overflow: hidden; }
.d-mako-incl-c:nth-child(1) .d-mako-incl-t { transform: rotate(-4deg); }
.d-mako-incl-c:nth-child(2) .d-mako-incl-t { transform: translateY(21px) rotate(2.5deg); }
.d-mako-incl-c:nth-child(3) .d-mako-incl-t { transform: translateY(7px) rotate(-2deg); }
.d-mako-incl-c:nth-child(4) .d-mako-incl-t { transform: translateY(26px) rotate(3.5deg); }
.d-mako-incl-ico { margin-top: 10px; width: 47px; height: 47px; border-radius: 13px; display: inline-flex; align-items: center; justify-content: center; color: #fff; box-shadow: inset 0 -3px 6px rgba(0,0,0,.18), inset 0 2px 4px rgba(255,255,255,.35); }
.d-mako-incl-ico-0 { background: linear-gradient(160deg, #6E9BF7, #2F6FED); }
.d-mako-incl-ico-1 { background: linear-gradient(160deg, #F7C85A, #E39A0B); }
.d-mako-incl-ico-2 { background: linear-gradient(160deg, #3B3328, #1A1712); }
.d-mako-incl-h { margin-top: 12px; font-size: 21px; line-height: 26.25px; font-weight: 700; color: #F5F6F8; }
.d-mako-incl-vis { margin-top: auto; width: calc(100% + 8px); padding: 8px 8px 0; border-radius: 18px 18px 0 0; background: #fff; transform: translateY(14px); }
.d-mako-incl-v { display: block; width: 100%; aspect-ratio: 960 / 600; height: auto; object-fit: cover; border-radius: 12px 12px 0 0; background: #fff; }

/* How it works: su cabecera (título 346, texto 380 a la derecha) y su escenario de 1140 × 720 con los cinco pasos */
.d-mako-como { padding: 96px 24px 64px; }
.d-mako-como-esc { position: relative; margin-top: 40px; aspect-ratio: 1140 / 720; }
.d-mako-como-flechas { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.d-mako-como-flechas path { stroke: #F5F6F8; stroke-width: 2; stroke-linecap: round; }
.d-mako-como-centro { position: absolute; left: 50%; top: 52%; width: 0; height: 0; }
.d-mako-como-aro { position: absolute; left: 0; top: 0; width: 300px; height: 300px; margin: -150px 0 0 -150px; border-radius: 50%; background: radial-gradient(closest-side, rgba(47,111,237,.32), rgba(47,111,237,.06) 60%, transparent); }
.d-mako-como-estrella { position: absolute; left: -48px; top: -48px; width: 96px; height: 96px; border-radius: 28px; background: #1A1712; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 40px rgba(47,111,237,.45); animation: d-mako-flota 4.2s ease-in-out infinite; }
.d-mako-como-p { position: absolute; width: 230px; }
.d-mako-como-t { font-size: 17px; line-height: 22px; letter-spacing: -0.11px; font-weight: 700; color: #F5F6F8; }
.d-mako-como-card { margin-top: 10px; padding: 12px 14px; border-radius: 12px; background: #fff; color: #1F2028; font-size: 14px; line-height: 19px; box-shadow: 0 18px 40px -16px rgba(0,0,0,.55); }

/* «Holo runs your…»: 41 px centrado (34 caracteres de ancho) y las tres columnas con su raya izquierda al 14 % */
.d-mako-uni { padding: 96px 24px 40px; }
.d-mako-uni-h { max-width: 34ch; margin: 0 auto; text-align: center; font-size: clamp(28px, 0.4rem + 2.5vw, 41px); line-height: 1.25; font-weight: 700; color: #F5F6F8; }
.d-mako-uni-pal { display: inline-block; white-space: nowrap; }
.d-mako-uni-l { position: relative; display: inline-block; }
.d-mako-uni-b { display: inline-block; color: #F5F6F8; }
.d-mako-uni-c { position: absolute; inset: 0; opacity: 0; user-select: none; }
.d-mako-js .d-mako-uni-b { opacity: .22; }
.d-mako-uni-g { margin-top: 80px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.d-mako-uni-col:nth-child(1) { padding-right: 32px; }
.d-mako-uni-col:nth-child(2) { padding: 0 32px; border-left: 1px solid #2A2B33; }
.d-mako-uni-col:nth-child(3) { padding-left: 32px; border-left: 1px solid #2A2B33; }
.d-mako-uni-ico { width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; color: #F5F6F8; }
.d-mako-uni-col p { margin-top: 16px; font-size: 18px; line-height: 23.4px; color: #C7C8CE; }
.d-mako-uni-col b { color: #F5F6F8; }

/* Proactive: 2 columnas de 524 con 32 de espacio; vidrio 3 %, borde 5 %, radio 19,59 y su sombra; sin hover (medido) */
.d-mako-pro { padding: 96px 24px 80px; }
.d-mako-pro-cab { display: flex; justify-content: space-between; align-items: center; gap: 24px; }
.d-mako-pro-cab .d-mako-h2 { max-width: 560px; }
.d-mako-pro-baj { margin-top: 14px; max-width: 560px; font-size: 18px; line-height: 23.4px; color: #C7C8CE; }
.d-mako-pro-baj strong { color: #F5F6F8; font-weight: 700; }
.d-mako-pro-g { margin-top: 44px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px; }
.d-mako-pro-t { position: relative; min-height: 325px; padding: 17px 18px 18px; border-radius: 19.59px; background: rgba(255,255,255,.03); border: 1px solid #16171F; box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 14px 36px rgba(0,0,0,.3); overflow: hidden; }
.d-mako-pro-chip { display: inline-flex; align-items: center; height: 34px; border-radius: 10.4px; background: #fff; overflow: hidden; }
.d-mako-pro-chip-i { width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; color: #fff; }
.d-mako-pro-chip-i0 { background: linear-gradient(160deg, #6E9BF7, #2F6FED); }
.d-mako-pro-chip-i1 { background: linear-gradient(160deg, #F7C85A, #E39A0B); }
.d-mako-pro-chip-t { padding: 0 10.6px 0 7.35px; font-size: 17.96px; line-height: 17.96px; font-weight: 700; color: #16171D; white-space: nowrap; }
.d-mako-pro-p { position: relative; z-index: 1; margin-top: 22px; max-width: 300px; font-size: 16.32px; line-height: 20.4px; font-weight: 700; color: #F5F6F8; }
.d-mako-pro-meta { position: absolute; left: 18px; bottom: 16px; z-index: 1; font-size: 12.24px; line-height: 15.9px; color: #94959D; }
.d-mako-pro-art { position: absolute; right: -14px; bottom: -14px; width: 190px; height: 190px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #F5F6F8; }
.d-mako-pro-art0 { background: radial-gradient(closest-side, rgba(47,111,237,.55), rgba(47,111,237,.12) 70%, transparent); }
.d-mako-pro-art1 { background: radial-gradient(closest-side, rgba(242,176,30,.45), rgba(242,176,30,.1) 70%, transparent); }

/* Real customer results: su fila del número grande (88 px) y la tarjeta de rendimiento (radio 24) */
.d-mako-caso { padding: 80px 24px 96px; }
.d-mako-caso-top { display: grid; grid-template-columns: 260px 1px auto 1fr; align-items: center; column-gap: 46px; }
.d-mako-caso-t { font-size: 22px; line-height: 28.6px; letter-spacing: -0.11px; font-weight: 500; color: #F5F6F8; }
.d-mako-caso-sep { align-self: stretch; background: #24252E; }
.d-mako-caso-num { font-size: 88px; line-height: 88px; font-weight: 700; color: transparent; background: linear-gradient(103.56deg, #2F6FED 10%, #5B8EF5 55%, #A9C4FB 95%); -webkit-background-clip: text; background-clip: text; white-space: nowrap; }
.d-mako-caso-barra { margin-left: -14px; }
.d-mako-caso-pista { display: block; height: 12px; border-radius: 9999px; background: #2B2C35; overflow: hidden; }
.d-mako-caso-pista span { display: block; height: 100%; width: 100%; border-radius: inherit; background: ${DEG}; transform-origin: left; transform: scaleX(1); transition: transform 1.6s ${SUAVE} .3s; }
.d-mako-js .d-mako-caso-top:not(.es-visto) .d-mako-caso-pista span { transform: scaleX(0); }
.d-mako-caso-lab { margin-top: 10px; font-size: 18px; line-height: 23.4px; color: transparent; background: linear-gradient(#EDEEF2 0%, #B9BAC2 55%, #6D6E76 100%); -webkit-background-clip: text; background-clip: text; }
.d-mako-caso-card { margin-top: 40px; border-radius: 24px; background: #0A0B15; border: 1px solid #16171F; box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 14px 36px rgba(0,0,0,.3); overflow: hidden; }
.d-mako-caso-in { padding: 20px 20px 0; }
.d-mako-caso-cab { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.d-mako-caso-quien { font-size: 16px; line-height: 16px; font-weight: 700; color: #F5F5F5; }
.d-mako-caso-rol { display: inline-flex; align-items: center; height: 31px; padding: 6px 12px; border-radius: 5px; border: 1px solid #282931; font-size: 13px; line-height: 16.9px; color: #F5F5F5; }
.d-mako-caso-stats { margin-top: 10px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.d-mako-caso-st { padding: 10px; border-radius: 5px; border: 1px solid transparent; }
.d-mako-caso-st-on { border-color: #282931; }
.d-mako-caso-st span { font-size: 13px; line-height: 19px; font-weight: 700; color: #F5F5F5; }
.d-mako-caso-st p { margin-top: 2px; font-size: 28px; line-height: 28px; color: #F5F5F5; }
.d-mako-caso-cuerpo { margin-top: 14px; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 28px; align-items: center; }
.d-mako-caso-video { display: block; width: 100%; aspect-ratio: 848 / 480; object-fit: cover; border-radius: 12px; background: #000; }
.d-mako-caso-hist { display: flex; flex-direction: column; gap: 12px; font-size: 15px; line-height: 21px; color: #9B9EA6; }
.d-mako-caso-hist strong { color: #F5F5F5; font-weight: 700; }
.d-mako-caso-res { color: #F5F5F5; }
.d-mako-caso-pie { padding: 16px 20px 20px; font-size: 20px; line-height: 25px; font-weight: 700; color: #fff; }

/* La frase que se escribe: 160 svh, pegada arriba a lo alto de la pantalla; el fondo y la píldora los mueve el script */
.d-mako-frase { position: relative; height: 160svh; overflow-x: clip; background: #0A0B14; }
.d-mako-frase-pega { position: sticky; top: 0; height: 100svh; display: flex; align-items: center; justify-content: center; padding: 0 24px; background: #0A0B14; }
.d-mako-frase-pil { position: relative; z-index: 1; margin-top: -10svh; border-radius: 999px; }
.d-mako-frase-t { display: inline-block; text-align: center; font-size: 36.8px; line-height: 42.32px; letter-spacing: -0.552px; font-weight: 700; color: #F5F6F8; transition: transform .2s ease-out; will-change: transform; }
.d-mako-frase-l { transition: color .3s; }
.d-mako-frase-l.es-borde { background-image: ${DEG}; -webkit-background-clip: text; background-clip: text; color: transparent; }
.d-mako-frase-sw { position: relative; display: inline-block; width: 1.1em; height: .62em; margin: 0 .18em 0 .32em; vertical-align: -0.04em; border-radius: 999px; background: rgba(255,255,255,.28); transition: background-color .3s, opacity .3s; }
.d-mako-frase-sw span { position: absolute; top: 7%; left: 5%; height: 86%; aspect-ratio: 1; border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); transition: left .3s; }
.d-mako-frase-sw.es-on { background: #3EDC50; }
.d-mako-frase-sw.es-on span { left: 47%; }
.d-mako-frase-rota { display: none; position: relative; vertical-align: bottom; height: 1lh; overflow: hidden; perspective: 420px; transition: width .4s ${SUAVE}; }
.d-mako-frase-rota span { position: absolute; left: 0; top: 0; white-space: pre; opacity: 0; transform: rotateX(-90deg) translateY(34%); transform-origin: 50% 50% -28px; backface-visibility: hidden; }
.d-mako-frase-rota span.es-on { opacity: 1; transform: none; transition: transform .5s cubic-bezier(.34,1.3,.5,1), opacity .18s; }
.d-mako-frase-rota span.es-sale { opacity: 0; transform: rotateX(90deg) translateY(-34%); transition: transform .45s cubic-bezier(.45,0,.7,.4), opacity .2s .22s; }
.d-mako-frase.es-completa .d-mako-frase-ult { display: none; }
.d-mako-frase.es-completa .d-mako-frase-rota { display: inline-block; }
.d-mako-js .d-mako-frase:not(.es-completa) .d-mako-frase-l:not(.es-escrita) { opacity: 0; }
.d-mako-js .d-mako-frase-sw:not(.es-ve) { opacity: 0; }

/* Any niche: tarjetas blancas de 1080, radio 28, 64 de relleno y la sombra de tres capas; se apilan pegadas a 92 px */
.d-mako-nicho { padding: 40px 24px 56px; }
.d-mako-nicho-lista { margin-top: 40px; }
.d-mako-nicho-pega { position: sticky; top: 92px; margin-bottom: 32px; }
.d-mako-nicho-pega:last-child { margin-bottom: 0; }
.d-mako-nicho-t { display: grid; grid-template-columns: minmax(0, 496.66fr) minmax(0, 397.34fr); gap: 56px; align-items: center; min-height: 498px; padding: 64px; border-radius: 28px; background: #fff; border: 1px solid #F1F1F3; box-shadow: inset 0 1px 0 rgba(255,255,255,.85), 0 1px 2px rgba(16,17,26,.03), 0 12px 32px rgba(16,17,26,.06); transform-origin: center top; }
.d-mako-nicho-h { font-size: 44px; line-height: 50.6px; font-weight: 700; color: #1F2028; }
.d-mako-nicho-h em { font-style: normal; color: #A5A5AD; }
.d-mako-nicho-p { margin-top: 20px; max-width: 448px; font-size: 18px; line-height: 23.4px; color: #6D6E76; }
.d-mako-nicho-v { display: block; width: 100%; height: auto; aspect-ratio: 960 / 600; border-radius: 16px; background: #0E1219; }
.d-mako-nicho-logos { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.d-mako-nicho-logo { display: flex; align-items: center; justify-content: center; aspect-ratio: 1; border-radius: 16px; background: #fff; border: 1px solid #ECECEF; box-shadow: 0 1px 2px rgba(16,17,26,.03), 0 8px 20px rgba(16,17,26,.05); }
.d-mako-nicho-logo img { width: 36px; height: 36px; object-fit: contain; }

/* Semana a semana: el titular de 52 px que cambia, el texto de 360 a la derecha, la grabación y las etapas abajo */
.d-mako-sem { padding: 96px 24px; }
.d-mako-sem-r { position: absolute; opacity: 0; pointer-events: none; }
.d-mako-sem-cab { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 16px; }
.d-mako-sem-hs, .d-mako-sem-xs { display: grid; }
.d-mako-sem-hs { flex: 1; min-height: 190px; }
.d-mako-sem-xs { width: 360px; flex: none; min-height: 76px; }
.d-mako-sem-h, .d-mako-sem-x { grid-area: 1 / 1; opacity: 0; transform: translateY(12px); transition: opacity .35s ${SUAVE}, transform .35s ${SUAVE}; pointer-events: none; }
.d-mako-sem-h { max-width: 18ch; font-size: 52px; line-height: 58.24px; letter-spacing: -0.5px; font-weight: 700; color: #1F2028; }
.d-mako-sem-x { font-size: 18px; line-height: 23.4px; color: #6D6E76; transform: translateY(10px); }
.d-mako-sem-vis { margin-top: 24px; }
.d-mako-sem-v { display: block; width: 100%; height: auto; aspect-ratio: 960 / 600; border-radius: 16px; background: #F7F7F7; }
.d-mako-sem-tabs { position: relative; margin-top: 24px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.d-mako-sem-gris, .d-mako-sem-color { position: absolute; left: 0; right: 0; top: 0; height: 3px; }
.d-mako-sem-gris { background: #D2D2D4; clip-path: inset(0 0 0 0); }
.d-mako-sem-color { background: ${DEG}; clip-path: inset(0 75% 0 0); }
.d-mako-sem-tabs label { padding: 16px 0 4px; font-size: 15px; line-height: 19.5px; color: #6D6E76; cursor: pointer; transition: color .3s; }
${[0, 1, 2, 3].map((i) => `.d-mako-sem-raiz:has(#d-mako-sem-${i}:checked) [data-i="${i}"].d-mako-sem-h, .d-mako-sem-raiz:has(#d-mako-sem-${i}:checked) [data-i="${i}"].d-mako-sem-x { opacity: 1; transform: none; pointer-events: auto; }
.d-mako-sem-raiz:has(#d-mako-sem-${i}:checked) label[data-i="${i}"] { color: #1F2028; }
.d-mako-sem-raiz:has(#d-mako-sem-${i}:checked) .d-mako-sem-color { clip-path: inset(0 ${75 - i * 25}% 0 ${i * 25}%); }`).join('\n')}
.d-mako-sem-tabs label:focus-visible, .d-mako-sem-r:focus-visible ~ .d-mako-sem-tabs { outline: 2px solid #2F6FED; }

/* Inside…: el título a la izquierda con sus flechas y el riel de cajas #F7F7F7 de 400 × 460 (radio 16, 20 de espacio) */
.d-mako-dentro { padding: 96px 0; }
.d-mako-dentro-cab { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 0 max(24px, calc((100% - 1128px) / 2 + 24px)); }
.d-mako-dentro-flechas { display: flex; gap: 12px; flex: none; }
.d-mako-dentro-fl { width: 40px; height: 40px; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; background: #F2F2F2; color: #1F2028; transition: background-color .2s, opacity .2s; }
.d-mako-dentro-fl:hover { background: #ECECEC; }
.d-mako-dentro-fl.es-tope { opacity: .4; pointer-events: none; }
.d-mako-dentro-fila { margin-top: 48px; display: flex; gap: 20px; overflow-x: auto; scrollbar-width: none; padding: 0 24px 0 max(24px, calc((100% - 1128px) / 2 + 24px)); scroll-padding-left: max(24px, calc((100% - 1128px) / 2 + 24px)); user-select: none; }
.d-mako-dentro-fila::-webkit-scrollbar { display: none; }
.d-mako-dentro-t { width: min(82vw, 400px); flex: none; }
.d-mako-dentro-caja { height: 460px; border-radius: 16px; background: #F7F7F7; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 20px; }
.d-mako-dentro-v { display: block; width: 100%; height: auto; aspect-ratio: 960 / 600; border-radius: 12px; background: #fff; box-shadow: 0 1px 2px rgba(16,17,26,.04), 0 16px 36px rgba(16,17,26,.08); pointer-events: none; }
.d-mako-dentro-p { padding: 20px 8px 0 0; font-size: 18px; line-height: 23.4px; color: #6D6E76; }
.d-mako-dentro-p b { color: #1F2028; font-weight: 700; }

/* La cinta: tarjetas de 330 con 16 de espacio, dos filas, 112 px de fundido en los bordes */
.d-mako-cinta { display: flex; flex-direction: column; gap: 16px; padding: 64px 0; overflow: hidden; }
.d-mako-cinta-fila { position: relative; overflow: hidden; touch-action: pan-y; cursor: default; }
.d-mako-cinta-fila::before, .d-mako-cinta-fila::after { content: ''; position: absolute; top: 0; bottom: 0; z-index: 1; width: 112px; pointer-events: none; }
.d-mako-cinta-fila::before { left: 0; background: linear-gradient(90deg, #fff 0%, rgba(255,255,255,0) 100%); }
.d-mako-cinta-fila::after { right: 0; background: linear-gradient(270deg, #fff 0%, rgba(255,255,255,0) 100%); }
.d-mako-cinta-pista { display: flex; width: max-content; animation: d-mako-cinta 52s linear infinite; will-change: transform; }
.d-mako-cinta-reves { animation-duration: 60s; animation-direction: reverse; }
.d-mako-cinta-juego { display: flex; gap: 16px; padding-right: 16px; }
.d-mako-cinta-t { width: 330px; flex: none; padding: 24px; border-radius: 16px; background: #fff; border: 1px solid #EEEEF0; }
.d-mako-cinta-t p { margin-top: 12px; font-size: 14px; line-height: 22.75px; color: #6D6E76; }
.d-mako-chica-chip { display: inline-flex; align-items: center; max-width: 100%; height: 36px; padding-right: 12px; border-radius: 11px; background: #fff; border: 1px solid #E2E2E5; overflow: hidden; }
.d-mako-chica-chip .d-mako-pro-chip-i { width: 36px; height: 36px; margin: -1px 0 -1px -1px; flex: none; }
.d-mako-chica-chip b { padding-left: 10px; font-size: 15px; line-height: 19.5px; font-weight: 700; color: #16171D; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Privacidad: el degradado blanco → #F5F6F8 y tres tarjetas blancas de radio 28 (16 de espacio) */
.d-mako-datos { background: linear-gradient(#fff 0%, #fff 90px, #F5F6F8 340px, #F5F6F8 100%); color: #1F2028; }
.d-mako-datos-h { max-width: 460px; margin: 0 auto; }
.d-mako-datos-g { margin-top: 48px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.d-mako-datos-t { padding: 28px; border-radius: 28px; background: #fff; border: 1px solid #F1F1F3; box-shadow: inset 0 1px 0 rgba(255,255,255,.85), 0 1px 2px rgba(16,17,26,.03), 0 12px 32px rgba(16,17,26,.06); }
.d-mako-datos-ico { width: 32px; height: 32px; border-radius: 9px; border: 1.5px solid #1F2028; display: inline-flex; align-items: center; justify-content: center; color: #1F2028; }
.d-mako-datos-tt { margin-top: 26px; font-size: 22px; line-height: 28.6px; letter-spacing: -0.11px; font-weight: 700; color: #1F2028; }
.d-mako-datos-p { margin-top: 11px; font-size: 18px; line-height: 23.4px; color: #6D6E76; }

/* Skeptical?: 1032 de ancho; las preguntas en cajas #F5F6F8 de radio 12, 14 px en negrita, 12 de espacio */
.d-mako-faq { padding: 96px 24px; }
.d-mako-faq-w { max-width: min(1032px, calc(100% - 80px)); margin: 0 auto; }
.d-mako-faq-cab .d-mako-h2 { max-width: 351px; }
.d-mako-faq-corta { margin-top: 16px; max-width: 380px; font-size: 18px; line-height: 23.4px; color: #6D6E76; }
.d-mako-faq-btn { margin-top: 28px; }
.d-mako-faq-lista { margin-top: 56px; display: flex; flex-direction: column; gap: 12px; }
.d-mako-faq-i { border-radius: 12px; background: #F5F6F8; }
.d-mako-faq-i summary { list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 20px 24px; cursor: pointer; font-size: 14px; line-height: 18.9px; letter-spacing: .14px; font-weight: 700; color: #1F2028; }
.d-mako-faq-i summary::-webkit-details-marker { display: none; }
.d-mako-faq-i summary svg { flex: none; transition: transform .3s; }
.d-mako-faq-i[open] summary svg { transform: rotate(180deg); }
.d-mako-faq-i p { max-width: 768px; padding: 0 24px 20px; font-size: 14px; line-height: 18.9px; letter-spacing: .14px; color: #6D6E76; }

/* El cierre: 144 arriba y 288 abajo, el título centrado de 26 caracteres, la caja que escribe sola y los cursores que pasean */
.d-mako-cierre { position: relative; z-index: 0; padding: 144px 24px 288px; overflow: hidden; }
.d-mako-cierre-in { position: relative; z-index: 2; max-width: 1080px; margin: 0 auto; }
.d-mako-cierre-h { max-width: 26ch; margin: 0 auto; }
.d-mako-cierre-caja { max-width: 560px; margin: 36px auto 0; padding: 24px; border-radius: 28px; background: #fff; border: 1px solid #EBEBED; box-shadow: 0 12px 40px rgba(16,17,26,.06); }
.d-mako-cierre-escribe { min-height: 49px; font-size: 17px; line-height: 24.65px; color: #9A9BA3; }
.d-mako-cierre-caret { display: inline-block; width: 1.5px; height: 1.05em; margin-left: 1px; vertical-align: baseline; transform: translateY(.15em); background: #9A9BA3; }
.d-mako-cierre-nota { margin-top: 8px; font-size: 14px; line-height: 20px; color: #6D6E76; }
.d-mako-cierre-pie { margin-top: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.d-mako-cierre-mas { width: 36px; height: 36px; flex: none; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; background: #F0F0F1; color: #6D6E76; }
.d-mako-cursor { position: absolute; z-index: 1; display: flex; align-items: flex-start; animation-name: d-mako-pasea-1; animation-timing-function: ease-in-out; animation-iteration-count: infinite; animation-fill-mode: both; }
.d-mako-cursor svg { position: relative; z-index: 1; width: 20px; flex: none; }
.d-mako-cursor span { margin: 11px 0 0 -1px; padding: 6px 12px; border-radius: 9999px; font-size: 14px; line-height: 14px; font-weight: 500; color: #fff; white-space: nowrap; }
.d-mako-cursor-1 { animation-name: d-mako-pasea-1; left: 3%; top: 14%; }
.d-mako-cursor-2 { animation-name: d-mako-pasea-2; left: 80%; top: 10%; }
.d-mako-cursor-3 { animation-name: d-mako-pasea-3; left: 4%; top: 58%; }
.d-mako-cursor-4 { animation-name: d-mako-pasea-4; left: 78%; top: 56%; }
@keyframes d-mako-pasea-1 { 0% { left: 3%; top: 14%; } 20% { left: 14%; top: 8%; } 40% { left: 6%; top: 24%; } 60% { left: 16%; top: 12%; } 80% { left: 4%; top: 20%; } 100% { left: 3%; top: 14%; } }
@keyframes d-mako-pasea-2 { 0% { left: 80%; top: 10%; } 20% { left: 88%; top: 22%; } 40% { left: 76%; top: 8%; } 60% { left: 86%; top: 18%; } 80% { left: 82%; top: 14%; } 100% { left: 80%; top: 10%; } }
@keyframes d-mako-pasea-3 { 0% { left: 4%; top: 58%; } 20% { left: 15%; top: 50%; } 40% { left: 7%; top: 64%; } 60% { left: 12%; top: 54%; } 80% { left: 5%; top: 60%; } 100% { left: 4%; top: 58%; } }
@keyframes d-mako-pasea-4 { 0% { left: 78%; top: 56%; } 20% { left: 88%; top: 48%; } 40% { left: 74%; top: 62%; } 60% { left: 84%; top: 52%; } 80% { left: 80%; top: 58%; } 100% { left: 78%; top: 56%; } }

/* Pie: #FAFAFA, la marca a la izquierda (260) y las columnas de 280 en 512 / 816 / 1120 */
.d-mako-pie { background: #FAFAFA; color: #1F2028; padding: 80px 40px 40px; }
.d-mako-pie-g { display: grid; grid-template-columns: minmax(0, 1fr) repeat(3, 280px); gap: 24px; }
.d-mako-pie-marca p { margin-top: 20px; max-width: 260px; font-size: 15px; line-height: 21.75px; color: #1F2028; }
.d-mako-pie-logo { color: #1F2028 !important; }
.d-mako-pie-col { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; }
.d-mako-pie-col h2 { min-height: 14px; margin-bottom: 6px; font-size: 11px; line-height: 14.3px; letter-spacing: 1.54px; font-weight: 600; text-transform: uppercase; color: #6D6E76; }
.d-mako-pie-col a { font-size: 15px; line-height: 19.5px; color: #1F2028; text-decoration: none; transition: color .2s; }
.d-mako-pie-col a:hover { color: #2F6FED; }
.d-mako-pie-abajo { margin-top: 56px; padding-top: 40px; border-top: 1px solid #E8E8EA; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.d-mako-pie-abajo p { font-size: 14px; line-height: 18.2px; color: #6D6E76; }
.d-mako-pie-cta { font-size: 13px; line-height: 16.9px; font-weight: 600; color: #2F6FED !important; text-decoration: none; }

@keyframes d-mako-sube { 0% { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes d-mako-brillo { 0% { background-position: 150% 0; } to { background-position: -150% 0; } }
@keyframes d-mako-flota { 0%, 100% { transform: translateY(0) rotate(-2.5deg); } 50% { transform: translateY(-18px) rotate(2.5deg); } }
@keyframes d-mako-cinta { 0% { transform: translateX(0); } to { transform: translateX(-50%); } }

/* Por debajo de 1024: la grilla del hero y lo ancho se apilan */
@media (max-width: 1023px) {
  .d-mako-hero-g { grid-template-columns: minmax(0, 1fr); }
  .d-mako-hero-vis { margin-left: 0; }
  .d-mako-incl-fila { overflow-x: auto; justify-content: flex-start; padding: 20px 24px 40px; scroll-snap-type: x mandatory; scrollbar-width: none; }
  .d-mako-incl-c { scroll-snap-align: center; }
  .d-mako-pro-g, .d-mako-datos-g { grid-template-columns: minmax(0, 1fr); }
  .d-mako-pie-g { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .d-mako-pie-marca { grid-column: 1 / -1; }
  .d-mako-como-esc { aspect-ratio: auto; display: flex; flex-direction: column; gap: 32px; }
  .d-mako-como-flechas, .d-mako-como-centro { display: none; }
  .d-mako-como-p { position: static; width: auto; max-width: 340px; }
  .d-mako-como-p:nth-of-type(even) { align-self: flex-end; text-align: right; }
  .d-mako-como-p:nth-of-type(even) .d-mako-como-card { text-align: left; }
}

/* 390: lo que Holo hace en el teléfono */
@media (max-width: 767px) {
  .d-mako-w, .d-mako-faq-w { max-width: none; }
  .d-mako-s, .d-mako-incl, .d-mako-como, .d-mako-pro, .d-mako-faq { padding: 64px 24px; }
  .d-mako-nav { justify-content: space-between; padding: 12px 16px 0; }
  .d-mako-nav-links { display: none; }
  .d-mako-hero { padding: 72px 24px 56px; }
  .d-mako-hero-g { margin-top: 8px; gap: 24px; }
  .d-mako-hero-vis { order: -1; margin: 0 -24px; }
  .d-mako-hero-txt { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .d-mako-hero-pie { display: flex; flex-direction: column; align-items: center; }
  .d-mako-etq { display: none; }
  .d-mako-h1 { margin-top: 0; font-size: 31px; line-height: 35.65px; }
  .d-mako-bajada { margin: 24px auto 0; max-width: 30ch; font-size: 15.5px; line-height: 21.31px; }
  .d-mako-confia { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 40px; width: 100%; }
  .d-mako-confia li { flex-direction: column; gap: 10px; text-align: center; }
  .d-mako-confia strong { font-size: 15px; line-height: 18.75px; margin-bottom: 4px; }
  .d-mako-chip-c { padding: 6px 10px; border-radius: 8px; }
  .d-mako-chip b { font-size: 11px; gap: 6px; }
  .d-mako-chip small { display: none; }
  .d-mako-chip::before, .d-mako-chip::after { height: 24px; }
  .d-mako-h2 { font-size: 35.9px; line-height: 41.29px; letter-spacing: -0.5385px; }
  .d-mako-cab { flex-direction: column; gap: 20px; }
  .d-mako-cab-p { width: auto; }
  .d-mako-incl-fila { gap: 16px; }
  .d-mako-incl-t { width: 70vw; max-width: 306px; padding: 32px 20px 0; }
  .d-mako-incl-c:nth-child(n) .d-mako-incl-t { transform: rotate(-1.5deg); }
  .d-mako-uni { padding: 32px 24px 32px; }
  .d-mako-uni-h { display: none; }
  .d-mako-uni-g { margin-top: 0; grid-template-columns: minmax(0, 1fr); gap: 40px; }
  .d-mako-uni-col:nth-child(n) { padding: 0; border: 0; }
  .d-mako-pro-cab { flex-direction: column; align-items: flex-start; }
  .d-mako-pro-g { margin-top: 32px; gap: 16px; }
  .d-mako-pro-t { min-height: 260px; }
  .d-mako-pro-p { max-width: 220px; font-size: 15px; line-height: 18.75px; }
  .d-mako-pro-art { width: 150px; height: 150px; }
  .d-mako-caso { padding: 64px 24px 80px; }
  .d-mako-caso-top { grid-template-columns: 1fr; row-gap: 16px; }
  .d-mako-caso-t { order: 3; font-size: 18px; line-height: 23.4px; }
  .d-mako-caso-sep { display: none; }
  .d-mako-caso-num { order: 1; font-size: 71.8px; line-height: 71.8px; }
  .d-mako-caso-barra { order: 2; margin-left: 0; }
  .d-mako-caso-card { margin-top: 32px; }
  .d-mako-caso-stats { gap: 4px; }
  .d-mako-caso-st { padding: 8px 6px; }
  .d-mako-caso-st p { font-size: 20px; line-height: 22px; }
  .d-mako-caso-cuerpo { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .d-mako-caso-pie { font-size: 18px; line-height: 22.5px; }
  .d-mako-frase-t { font-size: 25px; line-height: 30.5px; }
  .d-mako-frase-pil { border-radius: 28px; }
  .d-mako-nicho { padding: 40px 24px 56px; }
  .d-mako-nicho-pega { top: 72px; }
  .d-mako-nicho-t { grid-template-columns: minmax(0, 1fr); gap: 32px; min-height: 0; padding: 32px 28px; }
  .d-mako-nicho-h { font-size: 28.24px; line-height: 32.48px; }
  .d-mako-sem { padding: 80px 24px; }
  .d-mako-sem-cab { flex-direction: column; gap: 12px; }
  .d-mako-sem-hs { min-height: 0; }
  .d-mako-sem-xs { width: auto; min-height: 0; }
  .d-mako-sem-h { font-size: 41.44px; line-height: 46.41px; }
  .d-mako-sem-tabs label { font-size: 13px; }
  .d-mako-dentro { padding: 96px 0 64px; }
  .d-mako-dentro-cab { align-items: center; }
  .d-mako-dentro-h { font-size: 25px; line-height: 30.5px; letter-spacing: -0.375px; }
  .d-mako-dentro-fila { margin-top: 32px; }
  .d-mako-dentro-caja { height: 420px; }
  .d-mako-cinta { padding: 56px 0; }
  .d-mako-cinta-fila::before, .d-mako-cinta-fila::after { width: 80px; }
  .d-mako-datos { padding: 80px 24px; }
  .d-mako-datos-g { gap: 16px; margin-top: 32px; }
  .d-mako-datos-t { padding: 24px; }
  .d-mako-cierre { padding: 80px 24px 224px; }
  .d-mako-cierre-caja { padding: 20px; }
  .d-mako-cursor span { margin-top: 8px; padding: 5px 10px; font-size: 12px; line-height: 12px; }
  .d-mako-cursor svg { width: 16px; }
  .d-mako-pie { padding: 64px 24px 40px; }
  .d-mako-pie-g { grid-template-columns: minmax(0, 1fr); gap: 36px; }
  .d-mako-pie-col h2:empty, .d-mako-pie-col h2[aria-hidden] { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .d-mako *, .d-mako *::before, .d-mako *::after { animation: none !important; transition: none !important; }
  .d-mako-frase { height: auto; }
  .d-mako-frase-pega { position: static; height: auto; padding: 120px 24px; }
}
`;

// El script (data-visor): lo que se mueve en Holo, con sus números. Limpia lo que dejó una corrida anterior (pulir.mjs guarda
// el DOM con lo que puso el script) y corre una sola vez. Con «menos movimiento» sólo arranca los videos que se ven.
const SCRIPT = `(function(){
function trasHidratar(fn){if(!document.querySelector('script[src*="/_next/"]'))return fn();var t0=Date.now();(function mira(){var h=Object.keys(document.body).some(function(k){return k.indexOf('__reactFiber')===0||k.indexOf('__reactProps')===0;});if(h||Date.now()-t0>6000)fn();else setTimeout(mira,60);})();}
function iniciar(){
  var R=document.querySelector('.d-mako');if(!R||R.__listo)return;R.__listo=1;
  var quieto=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Limpiar lo de una corrida anterior.
  R.classList.remove('d-mako-js');
  [].forEach.call(R.querySelectorAll('.es-visto,.es-escrita,.es-borde,.es-ve,.es-completa,.es-sale,.es-tope'),function(e){e.classList.remove('es-visto','es-escrita','es-borde','es-ve','es-completa','es-sale','es-tope');});
  [].forEach.call(R.querySelectorAll('.d-mako-uni-b,.d-mako-uni-c,.d-mako-nicho-t,.d-mako-frase-pega,.d-mako-frase-pil,.d-mako-frase-t,.d-mako-frase-rota,.d-mako-sem-gris'),function(e){e.removeAttribute('style');});
  var vids=[].slice.call(R.querySelectorAll('video[data-mako-vid]'));
  vids.forEach(function(v){v.muted=true;});
  if('IntersectionObserver' in window){
    var ov=new IntersectionObserver(function(es){es.forEach(function(e){var v=e.target;if(e.isIntersecting){if(v.preload==='none')v.preload='auto';var p=v.play();if(p&&p.catch)p.catch(function(){});}else if(!v.paused)v.pause();});},{threshold:.15});
    vids.forEach(function(v){ov.observe(v);});
  }
  if(quieto||!('IntersectionObserver' in window)||!window.requestAnimationFrame)return;
  R.classList.add('d-mako-js');
  // 1. Lo que entra al bajar: 80 px adentro de la pantalla, una sola vez.
  var orv=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('es-visto');orv.unobserve(e.target);}});},{rootMargin:'-80px 0px -80px 0px',threshold:0});
  [].forEach.call(R.querySelectorAll('.d-mako-rv,.d-mako-rv-p,.d-mako-rv-f'),function(e){orv.observe(e);});
  // 2. La barra: al bajar se apagan los links; sobre una sección clara, vidrio claro.
  var nav=R.querySelector('.d-mako-nav');
  function barra(){if(!nav)return;nav.classList.toggle('es-baja',scrollY>8);var el=document.elementFromPoint(innerWidth/2,30);var s=el&&el.closest?el.closest('[data-mako-tono]'):null;nav.classList.toggle('es-claro',!!s);}
  // 3. Las palabras que se encienden: el titular entre el 55 % y el 5 % de la pantalla.
  var enc=R.querySelector('[data-mako-enc]');var letras=enc?[].map.call(enc.querySelectorAll('.d-mako-uni-l'),function(l){return {c0:parseFloat(l.getAttribute('data-c0')),b:l.firstElementChild,c:l.lastElementChild};}):[];
  function lerp(p,a,b,x,y){if(p<=a)return x;if(p>=b)return y;return x+(y-x)*(p-a)/(b-a);}
  function encender(){if(!enc)return;var r=enc.getBoundingClientRect(),h=innerHeight;var c=h*.55,d=h*.05;var p=Math.min(1,Math.max(0,(c-r.top)/(c-d)));letras.forEach(function(l){l.b.style.opacity=lerp(p,l.c0,l.c0+.03,.22,1);l.c.style.opacity=p<l.c0+.03?lerp(p,l.c0,l.c0+.03,0,1):lerp(p,l.c0+.03,l.c0+.13,1,0);});}
  // 4. La frase: se escribe entre el 15 % de la pantalla y el final de la sección; al 78–92 % el fondo pasa a blanco y la píldora a oscura.
  var fr=R.querySelector('.d-mako-frase');var frL=fr?[].slice.call(fr.querySelectorAll('.d-mako-frase-l')):[];var frSw=fr?fr.querySelector('.d-mako-frase-sw'):null;var frPega=fr?fr.querySelector('.d-mako-frase-pega'):null;var frPil=fr?fr.querySelector('.d-mako-frase-pil'):null;var frT=fr?fr.querySelector('.d-mako-frase-t'):null;var frRota=fr?fr.querySelector('.d-mako-frase-rota'):null;
  var frSuave=0,frN=-1,rotaT=null;
  function mezcla(a,b,t){return 'rgb('+a.map(function(x,i){return Math.round(x+(b[i]-x)*t);}).join(',')+')';}
  function frase(){if(!fr)return;var r=fr.getBoundingClientRect(),h=innerHeight;var ini=h*.15,fin=r.height-h;var p=Math.min(1,Math.max(0,(ini-r.top)/(ini+fin)));frSuave+=(p-frSuave)*.18;var q=frSuave;
    var n=Math.round(Math.min(1,q/.68)*frL.length);if(n!==frN){frN=n;frL.forEach(function(l,i){l.classList.toggle('es-escrita',i<n);l.classList.toggle('es-borde',i<n&&i>=n-3&&n<frL.length);});var desde=frSw?+frSw.getAttribute('data-desde'):0;if(frSw){frSw.classList.toggle('es-ve',n>=desde);frSw.classList.toggle('es-on',n>=desde+3);}
      var lleno=n>=frL.length;fr.classList.toggle('es-completa',lleno);if(lleno&&!rotaT)rotar();if(!lleno&&rotaT){clearInterval(rotaT);rotaT=null;}
      if(frT){var tx=0;if(!lleno&&n<frL.length){var a=frL[n],b=frL[0];if(a&&b&&a.offsetTop===b.offsetTop)tx=(frT.clientWidth-a.offsetLeft)/2;}frT.style.transform='translateX('+tx+'px)';}}
    var t=Math.min(1,Math.max(0,(q-.78)/.14));if(frPega)frPega.style.background=mezcla([10,11,20],[255,255,255],t);if(frPil){frPil.style.background='rgba(16,16,24,'+t+')';var px=innerWidth<768?18:44;frPil.style.padding=(20*t)+'px '+(px*t)+'px';}
  }
  function rotar(){if(!frRota)return;var ws=[].slice.call(frRota.children),k=0;var medir=function(){var w=ws[k].offsetWidth;if(w)frRota.style.width=w+'px';};medir();rotaT=setInterval(function(){var a=ws[k];a.classList.remove('es-on');a.classList.add('es-sale');k=(k+1)%ws.length;var b=ws[k];b.classList.remove('es-sale');void b.offsetWidth;b.classList.add('es-on');medir();setTimeout(function(){a.classList.remove('es-sale');},500);},2000);}
  // 5. Las tarjetas de «Any niche»: la de abajo se achica a ,9 a medida que la siguiente le pasa por encima.
  var pegas=[].slice.call(R.querySelectorAll('.d-mako-nicho-pega'));
  function pila(){for(var i=0;i<pegas.length-1;i++){var t=pegas[i].firstElementChild,a=pegas[i].getBoundingClientRect(),b=pegas[i+1].getBoundingClientRect();var p=Math.min(1,Math.max(0,1-(b.top-a.top)/Math.max(1,a.height)));t.style.transform=p>0?'scale('+(1-.1*p).toFixed(4)+')':'';}}
  var tic=false;function cuadro(){tic=false;barra();encender();frase();pila();if(fr&&Math.abs(frSuave-Math.min(1,Math.max(0,(innerHeight*.15-fr.getBoundingClientRect().top)/(innerHeight*.15+fr.getBoundingClientRect().height-innerHeight))))>.002)pedir();}
  function pedir(){if(!tic){tic=true;requestAnimationFrame(cuadro);}}
  addEventListener('scroll',pedir,{passive:true});addEventListener('resize',pedir);pedir();
  // 6. Semana a semana: cuatro etapas de 5 s, la raya gris que crece y la de color que avanza sobre la activa; un toque elige.
  var sem=R.querySelector('.d-mako-sem-raiz');
  if(sem){var radios=[].slice.call(sem.querySelectorAll('.d-mako-sem-r')),gris=sem.querySelector('.d-mako-sem-gris'),col=sem.querySelector('.d-mako-sem-color'),N=radios.length,DUR=5000,t0=performance.now(),visto=false;
    new IntersectionObserver(function(es){visto=es[0].isIntersecting;if(visto)requestAnimationFrame(paso);},{threshold:0}).observe(sem);
    radios.forEach(function(r,i){r.addEventListener('change',function(){t0=performance.now()-i*DUR;});});
    var paso=function(ahora){if(!visto)return;var x=((ahora-t0)%(DUR*N)+DUR*N)%(DUR*N),i=Math.floor(x/DUR),f=(x-i*DUR)/DUR;if(radios[i]&&!radios[i].checked)radios[i].checked=true;var a=(i+f)/N*100,s=i/N*100;if(gris)gris.style.clipPath='inset(0 '+(100-a)+'% 0 0)';if(col)col.style.clipPath='inset(0 '+(100-a)+'% 0 '+s+'%)';requestAnimationFrame(paso);};}
  // 7. El riel de «Inside…»: cada flecha corre una caja (su ancho + 20) y se apaga en las puntas.
  var riel=R.querySelector('#d-mako-riel');var fls=[].slice.call(R.querySelectorAll('.d-mako-dentro-fl'));
  if(riel){var topes=function(){fls.forEach(function(f){var d=+f.getAttribute('data-dir');f.classList.toggle('es-tope',d<0?riel.scrollLeft<4:riel.scrollLeft+riel.clientWidth>=riel.scrollWidth-4);});};
    fls.forEach(function(f){f.addEventListener('click',function(ev){ev.preventDefault();var c=riel.querySelector('[data-reel]');if(!c)return;var s=c.offsetWidth+20,d=+f.getAttribute('data-dir');riel.scrollTo({left:Math.max(0,Math.round(riel.scrollLeft/s)*s+d*s),behavior:'smooth'});});});
    riel.addEventListener('scroll',topes,{passive:true});topes();}
  // 8. La cinta: corre con su animación CSS (52 s y 60 s) y se arrastra con el mouse; fuera de la pantalla, quieta.
  [].forEach.call(R.querySelectorAll('.d-mako-cinta-fila'),function(fila){var pista=fila.firstElementChild;var an=pista.getAnimations?pista.getAnimations()[0]:null;if(!an)return;
    new IntersectionObserver(function(es){if(es[0].isIntersecting)an.play();else an.pause();},{rootMargin:'200px 0px'}).observe(fila);
    var arr=null;fila.addEventListener('pointerdown',function(e){if(e.button!==0)return;fila.setPointerCapture(e.pointerId);arr={x:e.clientX,t:an.currentTime||0};});
    fila.addEventListener('pointermove',function(e){if(!arr)return;var dur=an.effect.getTiming().duration,w=pista.scrollWidth/2||1,rev=an.effect.getTiming().direction==='reverse';var dt=(e.clientX-arr.x)/w*dur;an.currentTime=((arr.t+(rev?dt:-dt))%dur+dur)%dur;});
    var suelta=function(){arr=null;};fila.addEventListener('pointerup',suelta);fila.addEventListener('pointercancel',suelta);});
  // 9. La caja del cierre: escribe a 38 ms por letra, espera 1,4 s, borra a 22 ms; después la fecha y la hora, y vuelve.
  var caja=R.querySelector('.d-mako-cierre-txt');
  if(caja){var frases=[];try{frases=JSON.parse(caja.getAttribute('data-frases')||'[]');}catch(e){}var base=frases[0]||caja.textContent;caja.textContent='';
    var dormir=function(ms){return new Promise(function(r){setTimeout(r,ms);});};
    var escribir=function(t){var i=0;return new Promise(function(r){(function u(){if(i>t.length)return r();caja.textContent=t.slice(0,i++);setTimeout(u,38);})();});};
    var borrar=function(){return new Promise(function(r){(function u(){var s=caja.textContent;if(!s.length)return r();caja.textContent=s.slice(0,-1);setTimeout(u,22);})();});};
    var fecha=function(){var d=new Date();return d.toLocaleDateString('es',{weekday:'short',day:'numeric',month:'short',year:'numeric'})+' \\u00b7 '+d.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'});};
    (async function(){for(;;){await escribir(base);await dormir(1400);await borrar();await dormir(220);await escribir(fecha());await dormir(1800);await borrar();await dormir(280);}})();}
}
function arrancar(){trasHidratar(iniciar);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrancar);else arrancar();
})();`;
