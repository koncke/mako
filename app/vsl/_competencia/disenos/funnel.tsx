// =============================================================================
// /vsl/funnel con el DISEÑO de la portada de Hyros (https://hyros.com/), copiado de nuevo el 14/11/2026 (noche)
// =============================================================================
// Hyros publicó una portada nueva el 14/11/2026 (13:52 UTC): la copia del 11/11 ya no se parecía. Se miró con Chromium a 1440 y
// 390 (capturas, video del scroll con una parada en cada sección, getAnimations, MutationObserver, hovers medidos antes y después;
// notas de la sesión: referencias-landings/funnel/) y se leyó su componente (NewClConcepts.mjs: los tiempos, las curvas, los
// fotogramas clave). Los valores, en docs/diseno/landings-competencia/funnel.md.
//
// Lo que se copió tal cual (con el azul de MaKo #2F6FED donde va su violeta #5150F6 y sus tintes llevados al azul):
//   · el hero: el titular de dos renglones con la palabra que rota cada 2,4 s (sale en ,28 s bajando 8 px), la bajada, la tarjeta
//     con los dos botones y el panel lila con sus ondas, donde una ventana turna escenas (entra en ,55 s con ,18 s de espera, sube
//     14 px y crece de ,985; al final de cada una la ventana crece 1,14 y el pie se agranda con su segunda frase resaltada);
//   · la línea de prueba con sus fichas (sin hover, como las suyas);
//   · «Brands that add Hyros see»: la línea acotada, el título con su caja que se pinta de izquierda a derecha, el marco con sus
//     cuatro esquinas, las cuatro tarjetas que entran de a una (la del medio sube 10 px con su sombra de placa) y su pie;
//   · «Hyros Custom»: el texto pegado a la izquierda y el cubo de capas en isométrico que cae capa por capa, con la baldosa de la
//     marca en el centro, y que después cambia una capa o una ficha cada 3,4 s;
//   · «All / All / None»; la banda de modelos de negocio (filas que entran desde la derecha de a 70 ms y se corren 5 px con el mouse);
//   · la lámina («What Could You Build…»): el papel cuadriculado, el marco con zonas y marcas de registro que se dibuja, las reglas, la
//     ventana de la app y la tabla que se escribe sola; el botón partido (sube 2 px y la flecha se corre);
//   · el panel del cierre y la píldora flotante de abajo que aparece al pasar el 80 % de la primera pantalla.
// Lo que NO va (MaKo no lo tiene): su aviso de Black Friday, la cita de Tony Robbins, sus cifras, su App Store, su MCP, su garantía y
// los menús desplegables de su barra (la barra copiada se oculta: arriba va la del sitio). Ver el comentario de ../funnel.ts.
// Las pantallas son grabaciones de la app REAL (public/vsl-assets/funnel/, banco C:/dev/bancos-portada/banco-funnel-landing).
// El script va con data-visor (el visor borra los demás), limpia su estado (pulir.mjs guarda el DOM después de correrlo) y respeta
// prefers-reduced-motion: sin él, todo se ve quieto en su lugar.
// =============================================================================

import type { ReactNode } from 'react';
import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, LogoMaKo, TEXTO_CTA, TEXTO_CIERRE, html, otrasFunciones } from '../marca';
import { CIERRE_FUNNEL, CUBO_FUNNEL, ESCENAS_HERO, PALABRAS_HERO } from '../funnel';
import { FUNNELS_SITIO } from '../../_sitio/funnels-datos';

type Hero = Extract<Bloque, { tipo: 'hero' }>;
type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;
type Filas = Extract<Bloque, { tipo: 'filas' }>;

const P = 'd-funnel';
const c = (s: string) => `${P}-${s}`;
const V = '/vsl-assets/funnel';
/** Las imágenes dentro del SVG del cubo (<image href>) no las reescribe el visor (sí el src de un <img>): van con la dirección
 *  entera del sitio, que sirve la misma carpeta public/ (docs/hallazgos-landing.md, «Cobranza como Rebill»). */
const LOGOS = 'https://hola-mako.com/vsl-assets/logos/integraciones';

const ESTRELLA = 'M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z';

/** Las ondas de fondo (su patrón `eo-zp`, dibujado acá: cintas onduladas giradas -18°), del color y la opacidad de cada panel. */
function Ondas({ color, opacidad }: { color: string; opacidad: number }) {
  const cintas: string[] = [];
  for (let i = 0; i < 8; i++) {
    const y = -60 + i * 104, a = 22 + (i % 3) * 8, t = 30 + ((i * 7) % 4) * 12, s = i % 2 ? -1 : 1;
    cintas.push(`M-260 ${y} C -80 ${y - a * s} 120 ${y + a * s} 300 ${y} S 700 ${y - a * s} 880 ${y} S 1200 ${y + a * s} 1300 ${y} L 1300 ${y + t} C 1200 ${y + t + a * s} 1060 ${y + t - a * s} 880 ${y + t} S 480 ${y + t + a * s} 300 ${y + t} S -80 ${y + t - a * s} -260 ${y + t} Z`);
  }
  return (
    <svg className={c('ondas')} viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill={color} opacity={opacidad} transform="rotate(-18 400 300)">{cintas.map((d) => <path key={d} d={d} />)}</g>
    </svg>
  );
}

function Barra() {
  return (
    <header className={c('barra')}>
      <div className={c('barra-in')}>
        <LogoMaKo className={c('logo')} tamano={24} />
        <nav className={c('barra-der')} aria-label="Secciones">
          <a href="#eventos" className={c('link')}>Cómo funciona</a>
          <a href="#editar" className={`${c('link')} ${c('link-hot')}`}>Editar con MaKo</a>
          <a href="#tipos" className={c('link')}>Tipos de funnel</a>
          <a href="/login" className={c('login')}>Iniciar sesión</a>
          <a href={RUTA_CTA} className={c('cta-barra')}>{TEXTO_CTA}</a>
        </nav>
      </div>
    </header>
  );
}

/** El hero: el titular con su palabra que rota, la bajada, la tarjeta con los dos botones y el panel con las escenas. */
function HeroD({ b }: { b: Hero }) {
  return (
    <section className={c('hero')}>
      <div className={c('cx')}>
        <div className={c('cx-izq')}>
          <h1 className={c('h1')} data-palabras={JSON.stringify(PALABRAS_HERO)} dangerouslySetInnerHTML={html(b.titulo)} />
          <p className={c('cx-sub')} dangerouslySetInnerHTML={html(b.bajada)} />
          <div className={c('cx-card')}>
            <a href={RUTA_CTA} className={c('cx-osc')} data-tema-fijo="">{TEXTO_CTA}</a>
            <a href="#eventos" className={c('cx-suave')}>{b.etiqueta}<i aria-hidden="true">↓</i></a>
          </div>
        </div>
        <div className={c('panel')} data-tema-fijo="">
          <Ondas color="#2F6FED" opacidad={0.09} />
          {ESCENAS_HERO.map((e, i) => (
            <div key={e.video} className={`${c('esc')}${i === 0 ? ' is-on' : ''}`}>
              <div className={c('win')}>
                <div className={c('winbar')} aria-hidden="true"><i /><i /><i /><span>{e.url}</span></div>
                <div className={c('win-cuerpo')}>
                  {/* La app real grabada (banco-funnel-landing); el póster es su PRIMER cuadro. */}
                  <video src={`${V}/${e.video}.webm`} poster={`${V}/${e.video}.jpg`} muted playsInline preload={i === 0 ? 'auto' : 'metadata'}
                    autoPlay={i === 0} loop={i === 0} aria-label={e.pie.replace(/<[^>]+>/g, '')} />
                </div>
                <p className={c('cap')} dangerouslySetInnerHTML={html(e.pie)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** «Tracking $5B+ in ad spend for:»: la línea centrada y las fichas (el caso de Mauricio, sus tres meses y su video). */
function Prueba() {
  return (
    <section className={c('prueba')}>
      <p className={c('prueba-l')}><span dangerouslySetInnerHTML={html(CASO.titulo)} /> {CASO.sub}</p>
      <ul className={c('chips')}>
        <li className={`${c('chip')} ${c('chip-video')}`}>
          <video muted autoPlay loop playsInline preload="metadata" aria-label={`${CASO.quien}, en video`}><source src={CASO.video} type="video/mp4" /></video>
          {CASO.quien}
        </li>
        {CASO.meses.map((m, i) => <li key={m.mes} className={`${c('chip')}${i === CASO.meses.length - 1 ? ` ${c('chip-b')}` : ''}`}>{m.mes} {m.monto}</li>)}
      </ul>
    </section>
  );
}

/** La escala de cada tarjeta (su lugar del sparkline): el paso del embudo donde sale ese evento. */
const PASOS_ESCALA = ['Anuncio', 'Agenda', 'Llamada', 'Pago'];
function Escala({ paso, claro }: { paso: number; claro: boolean }) {
  const ancho = 216, x0 = 4, seg = (ancho - 8) / 4;
  const linea = claro ? 'rgba(255,255,255,.7)' : '#9A988F', relleno = claro ? '#FFFFFF' : '#2F6FED', fondo = claro ? 'rgba(255,255,255,.18)' : '#F1EFE7';
  return (
    <svg className="sc" viewBox={`0 0 ${ancho} 40`} aria-hidden="true">
      <rect x={x0} y={6} width={ancho - 8} height={10} fill={fondo} stroke={linea} strokeWidth={1} />
      <rect x={x0 + seg * paso} y={6} width={seg} height={10} fill={relleno} />
      {[0, 1, 2, 3, 4].map((k) => <path key={k} d={`M${x0 + seg * k} 18 V${k % 4 === 0 ? 25 : 23}`} stroke={linea} strokeWidth={1} />)}
      {PASOS_ESCALA.map((t, k) => (
        <text key={t} x={x0 + seg * k + seg / 2} y={35} textAnchor="middle" fontFamily="'Geist Mono', ui-monospace, monospace" fontSize={8.5} letterSpacing=".6"
          fill={k === paso ? (claro ? '#FFFFFF' : '#2F6FED') : (claro ? 'rgba(255,255,255,.75)' : '#8A8880')}>{t.toUpperCase()}</text>
      ))}
    </svg>
  );
}

/** «Brands that add Hyros see»: la línea acotada, el título, la bajada y el marco con las cuatro tarjetas (lo que se le avisa a Meta). */
function Eventos({ b }: { b: Tarjetas }) {
  const hero = b.items.length - 1;
  return (
    <section className={c('sx')} id="eventos">
      <div className={c('sx-in')}>
        <div className={c('sx-head')} data-rv="">
          {b.etiqueta ? <div className={c('dim')}><i /><span>{b.etiqueta}</span><i /></div> : null}
          <h2 className={c('sx-h2')} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={c('sx-lede')} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <div className={c('sx-frame')} data-rv="">
          <i className={`${c('cm')} tl`} /><i className={`${c('cm')} tr`} /><i className={`${c('cm')} br`} /><i className={`${c('cm')} bl`} />
          <div className={c('sx-meta')}><span>Evento por evento</span><span>{b.items.length} eventos</span></div>
          <div className={c('sx-grid')}>
            {b.items.map((it, i) => (
              <div key={it.titulo} className={`${c('sx-card')}${i === hero ? ' is-hero' : ''}`} data-rv="" style={{ ['--i' as string]: i }} {...(i === hero ? { 'data-tema-fijo': '' } : {})}>
                <div className="k"><span>{it.meta}</span><em>0{i + 1}</em></div>
                <div className="v"><span dangerouslySetInnerHTML={html(it.titulo)} /><i className={c('ar')} aria-hidden="true"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 7.5l5-5M3.5 2.5h4v4" /></svg></i></div>
                <div className="l" dangerouslySetInnerHTML={html(it.texto)} />
                <Escala paso={i} claro={i === hero} />
              </div>
            ))}
          </div>
          <div className={c('sx-foot')}>
            <span className="g"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#2F6FED" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 6.8l2.6 2.6 5.4-5.6" /></svg> Con el monto de cada venta</span>
            <span>Sale de tu CRM, no de lo que reporta la plataforma</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── El cubo isométrico (su `Pn`): las mismas cuentas de proyección, cajas y textos sobre cada cara ─────────────────────────────
const ML = 0.8660254, HL = 0.5;
const gl = (x: number, y: number, z: number, cx = 480, cy = 404): [number, number] => [cx + (x - y) * ML, cy + (x + y) * HL - z];
const TONOS = {
  tech: ['#FBFAF6', '#F1EFE7', '#E7E5DC', '#9A988F'],
  base: ['#ECEAE1', '#E1DFD5', '#D6D4CA', '#9A988F'],
  chip: ['#FFFFFF', '#EEECE4', '#E3E1D8', '#9A988F'],
  br: ['#6E9AF2', '#2F6FED', '#1F57C8', '#1F57C8'],
} as const;
const MONO = "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace";
const SANS = "'DFu Inter', Inter, 'Helvetica Neue', sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

function Caja({ x, y, z, w, d, h, tono, izq, der, arriba }: { x: number; y: number; z: number; w: number; d: number; h: number; tono: keyof typeof TONOS; izq?: ReactNode; der?: ReactNode; arriba?: ReactNode }) {
  const m = (a: number, b: number, z2: number) => gl(a, b, z2).map((n) => +n.toFixed(2)).join(',');
  const [top, f1, f2, st] = TONOS[tono];
  const [v, vy] = gl(x, y + d, z + h), [te, ne] = gl(x + w, y + d, z + h), [re, ie] = gl(x, y, z + h);
  return (
    <g>
      <polygon points={[m(x, y + d, z), m(x + w, y + d, z), m(x + w, y + d, z + h), m(x, y + d, z + h)].join(' ')} fill={f1} stroke={st} strokeLinejoin="round" />
      <polygon points={[m(x + w, y, z), m(x + w, y + d, z), m(x + w, y + d, z + h), m(x + w, y, z + h)].join(' ')} fill={f2} stroke={st} strokeLinejoin="round" />
      <polygon points={[m(x, y, z + h), m(x + w, y, z + h), m(x + w, y + d, z + h), m(x, y + d, z + h)].join(' ')} fill={top} stroke={st} strokeLinejoin="round" />
      {izq ? <g transform={`matrix(${ML},${HL},0,1,${v.toFixed(2)},${vy.toFixed(2)})`}>{izq}</g> : null}
      {der ? <g transform={`matrix(${ML},-0.5,0,1,${te.toFixed(2)},${ne.toFixed(2)})`}>{der}</g> : null}
      {arriba ? <g transform={`matrix(${ML},${HL},-0.8660254,${HL},${re.toFixed(2)},${ie.toFixed(2)})`}>{arriba}</g> : null}
    </g>
  );
}

/** Las 8 baldosas visibles de la grilla de 3 × 3 (la del medio es la de la marca). */
const CASILLAS = [0, 1, 2, 3, 5, 6, 7, 8];

function Cubo({ telefono }: { telefono?: boolean }) {
  const s = telefono ? 19 : 18, cc = telefono ? 15 : 13.5;
  const etiqueta = (t: string) => (telefono ? undefined : <text x={304} y={22} textAnchor="end" fontFamily={MONO} fontSize={10.5} letterSpacing="1.2" fill="#8A8880">{t}</text>);
  const capas = [...CUBO_FUNNEL.capas.slice(0, 3), CUBO_FUNNEL.arriba];
  const m = gl(160, 160, 250), h = gl(320, 0, 228)[1], g = gl(0, 320, 120);
  const [tarjetaArriba, tarjetaNombre, tarjetaBajada] = CUBO_FUNNEL.tarjeta;
  const d = (t: string) => ({ ['--d' as string]: t });
  return (
    <svg className={`${c('svg')} ${telefono ? 'is-ph' : 'is-desk'}`} viewBox={telefono ? '196 100 568 628' : '-36 0 936 740'} aria-hidden="true">
      <g className={`${c('el')} ${c('lay')}`} style={d('0s')}>
        <Caja x={0} y={0} z={0} w={320} d={320} h={48} tono="base"
          izq={<text x={18} y={24 + cc * 0.36} fontFamily={MONO} fontSize={cc} letterSpacing="2.2" fill="#1F1E1D">{CUBO_FUNNEL.base}</text>}
          der={telefono ? undefined : <text x={304} y={28} textAnchor="end" fontFamily={MONO} fontSize={10.5} letterSpacing="1.2" fill="#8A8880">BASE</text>} />
      </g>
      {capas.map((t, i) => {
        const ultima = i === 3;
        return (
          <g key={i} className={`${c('el')} ${c('lay')}`} data-capa={ultima ? undefined : i} style={d(`${0.3 + i * 0.22}s`)}>
            <Caja x={0} y={0} z={48 + i * 36} w={320} d={320} h={36} tono="tech"
              izq={<text className={c('capa-t')} x={18} y={18 + (ultima ? (s + 2.5) * 0.36 : s * 0.36)} fontFamily={ultima ? SERIF : SANS} fontSize={ultima ? s + 2.5 : s} fontWeight={500} fill={ultima ? '#2F6FED' : '#1F1E1D'}>{t}</text>}
              der={etiqueta(`L${i + 1}`)} />
          </g>
        );
      })}
      <g className={`${c('el')} ${c('lay')}`} style={d('1.25s')}>
        <Caja x={0} y={0} z={192} w={320} d={320} h={36} tono="tech"
          izq={<text x={18} y={18 + cc * 0.36} fontFamily={MONO} fontSize={cc} letterSpacing="2.2" fill="#1F1E1D">{CUBO_FUNNEL.integraciones}</text>} der={etiqueta('L5')} />
      </g>
      {CASILLAS.map((e, n) => {
        const f = CUBO_FUNNEL.fichas[n];
        return (
          <g key={e} className={`${c('el')} ${c('chip3d')}`} data-ficha={n} style={d(`${(1.6 + n * 0.09).toFixed(2)}s`)}>
            <Caja x={14 + (e % 3) * 104} y={14 + Math.floor(e / 3) * 104} z={228} w={84} d={84} h={9} tono="chip"
              arriba={telefono
                ? <image className={c('ficha-img')} href={`${LOGOS}/${f.logo}`} x={24} y={24} width={36} height={36} preserveAspectRatio="xMidYMid meet" />
                : <>
                    <image className={c('ficha-img')} href={`${LOGOS}/${f.logo}`} x={27} y={14} width={30} height={30} preserveAspectRatio="xMidYMid meet" />
                    <text className={c('ficha-t')} x={42} y={72} textAnchor="middle" fontFamily={MONO} fontSize={f.n.length > 9 ? 9 : 10.5} letterSpacing=".8" fill="#1F1E1D">{f.n.toUpperCase()}</text>
                  </>} />
          </g>
        );
      })}
      <g className={`${c('el')} ${c('hy')}`} style={d('2.5s')}>
        <Caja x={118} y={118} z={228} w={84} d={84} h={22} tono="br"
          arriba={<g transform="translate(42 42) scale(2.3)"><path d={ESTRELLA} fill="#F2B01E" /></g>} />
      </g>
      {telefono ? null : (
        <>
          <g className={`${c('el')} ${c('aux')}`} style={d('3.1s')} stroke="#9A988F" strokeWidth={1} fill="none">
            <path d={`M787.13,${h} V404`} />
            <path d={`M782.13,${h} H792.13 M782.13,404 H792.13`} />
            {[1, 2, 3, 4].map((k) => <path key={k} d={`M784.13,${356 - k * 36} H790.13`} />)}
            <text transform={`translate(803.13,${(h + 404) / 2}) rotate(90)`} textAnchor="middle" fontFamily={MONO} fontSize={9} letterSpacing="1.6" fill="#8A8880" stroke="none">{CUBO_FUNNEL.costado}</text>
          </g>
          <g className={`${c('el')} ${c('aux')}`} style={d('3.1s')}>
            <text x={-24} y={312} fontFamily={MONO} fontSize={10.5} letterSpacing="1.6" fill="#8A8880">{CUBO_FUNNEL.siguen}</text>
            {CUBO_FUNNEL.capas.slice(3).map((t, k) => (
              <g key={k}>
                <rect x={-24} y={324 + k * 44} width={226} height={34} rx={8} fill="#FFFFFF" stroke="#9A988F" />
                <text className={c('sig-t')} data-sig={k} x={89} y={346 + k * 44} textAnchor="middle" fontFamily={SANS} fontSize={14} fontWeight={500} fill="#1F1E1D">{t}</text>
              </g>
            ))}
            <path d={`M89,402 V${g[1].toFixed(2)} H${(g[0] - 4).toFixed(2)}`} fill="none" stroke="#9A988F" strokeWidth={1} strokeDasharray="4 4" />
            <circle cx={g[0] - 4} cy={g[1]} r={2.5} fill="#9A988F" />
          </g>
          <g className={`${c('el')} ${c('card')}`} style={d('2.85s')}>
            <path d={`M${m[0].toFixed(2)},${m[1].toFixed(2)} V60 H596`} fill="none" stroke="#2F6FED" strokeWidth={1.5} strokeDasharray="4 4" />
            <circle cx={m[0]} cy={m[1]} r={4.5} fill="#2F6FED" stroke="#FFFFFF" strokeWidth={1.5} />
            <rect x={596} y={18} width={298} height={84} rx={10} fill="#FFFFFF" stroke="#9A988F" />
            <circle cx={616} cy={40} r={3} fill="#2F6FED" />
            <text x={626} y={44} fontFamily={MONO} fontSize={10.5} letterSpacing="1.4" fill="#2F6FED">{tarjetaArriba.toUpperCase()}</text>
            <text x={616} y={68} fontFamily={SANS} fontSize={17} fontWeight={600} fill="#1F1E1D">{tarjetaNombre}</text>
            <text x={616} y={88} fontFamily={SANS} fontSize={12.5} fill="#6B6963">{tarjetaBajada}</text>
          </g>
        </>
      )}
    </svg>
  );
}

/** «Hyros Custom»: el texto pegado a la izquierda y el cubo a la derecha (en el teléfono, su cubo visto de arriba y la tarjeta abajo). */
function Editar({ b }: { b: Filas }) {
  return (
    <section className={c('hf')}>
      <div className={c('hf-in')}>
        <div className={c('hf-izq')} data-rv="">
          {b.etiqueta ? <span className={c('pill')} style={{ ['--i' as string]: 0 }}>{b.etiqueta}</span> : null}
          <h2 className={c('hf-h2')} style={{ ['--i' as string]: 1 }} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={c('hf-p')} style={{ ['--i' as string]: 2 }} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <div className={c('vis')} data-rv="" data-tema-fijo="" data-capas={JSON.stringify(CUBO_FUNNEL.capas)} data-fichas={JSON.stringify(CUBO_FUNNEL.fichas)} data-logos={LOGOS}>
          <Cubo />
          <Cubo telefono />
          <div className={c('pcard')}><i /><div><span>{CUBO_FUNNEL.tarjeta[0]}</span><b>{CUBO_FUNNEL.tarjeta[1]}</b><em>{CUBO_FUNNEL.tarjeta[2]}</em></div></div>
        </div>
      </div>
    </section>
  );
}

/** «All / All / None»: el renglón chico y las tres filas grandes. */
function Libro({ b }: { b: Tarjetas }) {
  return (
    <section className={c('hp')} aria-label={b.titulo}>
      <div className={c('hp-in')}>
        {b.etiqueta ? <div className={c('kick')}>{b.etiqueta}</div> : null}
        <div className={c('ledger')}>
          {b.items.map((it, i) => (
            <div key={i} className={`${c('hp-row')}${i === b.items.length - 1 ? ' is-none' : ''}`}>
              <div className={c('hp-big')}>{it.titulo}</div>
              <div className={c('hp-rest')} dangerouslySetInnerHTML={html(it.texto)} />
              <div className={c('hp-tag')}>{it.meta}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** El logo del canal de cada funnel (en su cuadro blanco, donde Hyros pone a Sven). */
const LOGO_FUNNEL: Readonly<Record<string, string>> = { vsl: '/vsl-assets/logos/vsl.png', whatsapp: '/vsl-assets/logos/whatsapp.png', instagram: '/vsl-assets/logos/integraciones/instagram.png', youtube: '/vsl-assets/logos/youtube.png' };

/** «See how Hyros Works. Pick your business model.»: la banda azul, el título a la izquierda y las filas a la derecha. */
function Modelos({ b }: { b: Tarjetas }) {
  return (
    <section className={c('pd')} id="tipos" data-tema-fijo="">
      <Ondas color="#FFFFFF" opacidad={0.09} />
      <div className={c('pd-in')}>
        <div className={c('pd-head')} data-rv="">
          {b.etiqueta ? <div className={c('pd-k')}>{b.etiqueta}</div> : null}
          <h2 className={c('pd-h2')} dangerouslySetInnerHTML={html(b.titulo)} />
        </div>
        <div className={c('pd-list')} data-rv="">
          {b.items.map((it, i) => {
            const propio = i === 0;
            const id = (it.meta ?? '').replace('/vsl/funnels/', '');
            const f = FUNNELS_SITIO.find((x) => x.id === id);
            return (
              <a key={it.titulo} href={it.meta} className={`${c('pd-row')}${propio ? ' is-custom' : ''}`} style={{ ['--i' as string]: i }}>
                <i className={c('pd-n')}>{propio ? '★' : `0${i}`}</i>
                <span className={c('pd-sv')}>
                  {propio
                    ? <><svg width="30" height="30" viewBox="-12 -12 24 24" aria-hidden="true"><path d={ESTRELLA} fill="#FFFFFF" /></svg><i className={c('pd-spark')} /></>
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={LOGO_FUNNEL[f?.id ?? ''] ?? '/vsl-assets/logos/landing.svg'} alt="" width={34} height={34} />}
                </span>
                <span>
                  <span className={c('pd-t')}>{it.titulo}{propio ? <i className={c('pd-new')}>IA</i> : null}</span>
                  <span className={c('pd-s')} dangerouslySetInnerHTML={html(it.texto)} />
                </span>
                <span className={c('pd-go')}>Ver cómo <em>{propio ? '↓' : '→'}</em></span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** «What Could You Build With Hyros Custom?»: la lámina con su cuadrícula, el marco con zonas, la ventana con la grabación REAL de
 *  «Editar con MaKo» y la tabla de lo que se le pidió, que se escribe sola. */
function Lamina({ b }: { b: Filas }) {
  return (
    <section className={c('hb')} id="editar">
      <div className={c('hb-paper')} data-rv="" />
      <div className={c('hb-sheet')} data-rv="" aria-hidden="true">
        <i className={`${c('rg')} tl`} /><i className={`${c('rg')} tr`} /><i className={`${c('rg')} bl`} /><i className={`${c('rg')} br`} />
        <div className={`${c('zn')} ${c('zt')}`}>{['1', '2', '3', '4', '5', '6'].map((z) => <span key={z}>{z}</span>)}</div>
        <div className={`${c('zn')} ${c('zl')}`}>{['A', 'B', 'C', 'D'].map((z) => <span key={z}>{z}</span>)}</div>
      </div>
      <div className={c('hb-in')}>
        <div className={c('hb-head')} data-rv="">
          {b.etiqueta ? <div className={`${c('dim')} ${c('hb-dim')}`}><i /><span>{b.etiqueta}</span><i /></div> : null}
          <h2 className={c('hb-h2')} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={c('hb-sub')} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
          <div className={c('hb-btnrow')}><a className={c('hb-split')} href={RUTA_CTA}><span>{TEXTO_CTA}</span><i><b>→</b></i></a></div>
        </div>
        <div className={c('hb-grid')}>
          <div className={c('hb-fig')} data-rv="">
            <div className={c('hb-rt')} aria-hidden="true">{[0, 100, 200, 300, 400, 500].map((n) => <span key={n} style={{ left: n }}>{n}</span>)}</div>
            <div className={c('hb-rl')} aria-hidden="true" />
            <div className={c('hb-frame')}>
              <i className={`${c('cm2')} tl`} /><i className={`${c('cm2')} tr`} /><i className={`${c('cm2')} br`} /><i className={`${c('cm2')} bl`} />
              <div className={c('hb-app')} data-tema-fijo="">
                <div className={c('winbar')} aria-hidden="true"><i /><i /><i /><span>Tu Dashboard · Editar con MaKo</span></div>
                <video src={`${V}/editar.webm`} poster={`${V}/editar.jpg`} muted playsInline loop preload="metadata" aria-label="Editar con MaKo: le pides un gráfico y lo agrega a tu hoja" />
              </div>
            </div>
          </div>
          <div>
            <div className={c('hb-tbl')} data-rv="">
              <div className={c('hb-th')}><span>Nº</span><span>Gráfico</span><span>Estado</span></div>
              {b.items.map((it, i) => (
                <div key={it.titulo} className={`${c('hb-tr')} is-done`} style={{ ['--i' as string]: i }}>
                  <span className={c('hb-no')}>0{i + 1}</span>
                  <div className={c('hb-td')}>
                    <div className={c('hb-t')}><span dangerouslySetInnerHTML={html(it.titulo)} /><em className={c('hb-tag')}><i />En tu hoja</em></div>
                    <div className={c('hb-b')} data-texto={it.texto} aria-label={it.texto}>{it.texto}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className={c('hb-tb')} aria-hidden="true">
              <span><em>Proyecto</em>Tu Dashboard</span><span><em>Fig.</em>01 · Editar con MaKo</span><span><em>Escala</em>1 : 1</span><span><em>Hoja</em>Marketing</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** El panel del cierre (el de su garantía, sin la garantía). */
function Cierre() {
  return (
    <section className={c('fin')}>
      <div className={c('finpanel')}>
        <svg className={c('fin-ico')} width="30" height="30" viewBox="-12 -12 24 24" aria-hidden="true"><path d={ESTRELLA} fill="#1F1E1D" /></svg>
        <div className={c('fin-kick')}>{CIERRE_FUNNEL.kick}</div>
        <h2 className={c('fin-h2')} dangerouslySetInnerHTML={html(CIERRE_FUNNEL.titulo)} />
        <p className={c('fin-lede')}>{CIERRE_FUNNEL.bajada}</p>
        <div className={c('btns')}>
          <a href={RUTA_CTA} className={c('btn-osc')} data-tema-fijo="">{TEXTO_CTA}</a>
          <a href="#tipos" className={c('btn-suave')}>Mira cómo funciona</a>
        </div>
        <p className={c('fin-quiet')} dangerouslySetInnerHTML={html(TEXTO_CIERRE)} />
      </div>
    </section>
  );
}

function PieD({ slug }: { slug: string }) {
  const otras = otrasFunciones(slug);
  const tercio = Math.ceil(otras.length / 3);
  const cols = [otras.slice(0, tercio), otras.slice(tercio, 2 * tercio), otras.slice(2 * tercio)];
  return (
    <footer className={c('pie')}>
      <div className={c('fgrid')}>
        <div>
          <LogoMaKo tamano={22} />
          <p className={c('ftag')}>El mejor software para vender High Ticket.</p>
        </div>
        {cols.map((col, i) => (
          <div key={i}>
            <div className={c('fh')}>{i === 0 ? 'Funciones de MaKo' : ' '}</div>
            <div className={c('fl')}>{col.map((f) => <a key={f.href} href={f.href}>{f.nombre}</a>)}</div>
          </div>
        ))}
        <div>
          <div className={c('fh')}>Tipos de funnel</div>
          <div className={c('fl')}>{FUNNELS_SITIO.map((f) => <a key={f.id} href={`/vsl/funnels/${f.id}`}>{f.nombre}</a>)}</div>
        </div>
      </div>
      <div className={c('fbot')}><div>© MaKo — Todos los derechos reservados.</div><div><a href={RUTA_CTA}>Precios</a><a href="/login">Iniciar sesión</a></div></div>
    </footer>
  );
}

export default function DisenoFunnel({ landing }: PropsDiseno) {
  let tarjetas = 0, filas = 0;
  return (
    <div className={P}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra />
      <main>
        {landing.bloques.map((b, i) => {
          switch (b.tipo) {
            case 'hero': return <HeroD key={i} b={b} />;
            case 'caso': return <Prueba key={i} />;
            // Las tarjetas, en el orden de la referencia: la ventana de cifras («Brands that add Hyros see»), «All / All / None» y
            // la banda de modelos de negocio.
            case 'tarjetas': { const n = tarjetas++; return n === 0 ? <Eventos key={i} b={b} /> : n === 1 ? <Libro key={i} b={b} /> : <Modelos key={i} b={b} />; }
            // Las filas: «Hyros Custom» (el cubo) y la lámina («What Could You Build…»).
            case 'filas': return filas++ === 0 ? <Editar key={i} b={b} /> : <Lamina key={i} b={b} />;
            default: return null;
          }
        })}
        <Cierre />
      </main>
      <PieD slug={landing.slug} />
      <a className={c('float')} href={RUTA_CTA} aria-label={TEXTO_CTA}>
        <svg width="18" height="18" viewBox="-12 -12 24 24" aria-hidden="true"><path d={ESTRELLA} fill="#F2B01E" /></svg>
        <span>{TEXTO_CTA}</span><i aria-hidden="true">→</i>
      </a>
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </div>
  );
}

// =============================================================================
// El CSS: los valores de su componente (NewClConcepts.mjs) con el azul de MaKo. Sus filetes al 11 % van OPACOS (#E2E0DA y familia):
// el sol y la luna borra los bordes translúcidos en el modo claro (docs/hallazgos-landing.md, «AI Avatar como HeyGen»).
// Lo que entra al bajar sólo se esconde con `.is-live` (lo pone el script): sin JavaScript, todo está en su lugar.
// =============================================================================
const AZUL = '#2F6FED';
const AZUL_OSC = '#1F57C8';
const TINTE = '#EAF0FD';
const TINTA = '#1F1E1D';
const GRIS = '#55534E';
const FILETE = '#E2E0DA';
const E = 'cubic-bezier(.2,.8,.2,1)';
const CSS = `
@font-face{font-family:'DFu Inter';src:url('/vsl-assets/fuentes/inter/inter-latin-var.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:swap}
.${P}{background:#FAF9F5;color:${TINTA};font-family:${SANS};-webkit-font-smoothing:antialiased;overflow-x:clip}
.${P} *,.${P} *:before,.${P} *:after{box-sizing:border-box}
:where(.${P}) :where(h1,h2,h3,p,ul,ol,li){margin:0;padding:0}
:where(.${P}) :where(ul,ol){list-style:none}
:where(.${P}) :where(a){text-decoration:none;color:inherit}
:where(.${P}) :where(i,em){font-style:normal}

/* La barra (se oculta: arriba va la del sitio). */
.${P}-barra{height:56px;position:relative;z-index:60}
.${P}-barra-in{max-width:1180px;height:100%;margin:0 auto;padding:0 32px;display:flex;align-items:center;justify-content:space-between}
.${P}-barra-der{display:flex;align-items:center;gap:20px}
.${P}-link{font-size:12px;color:rgba(31,30,29,.78);white-space:nowrap;transition:color .15s ease}
.${P}-link:hover{color:${TINTA}}
.${P}-link-hot{background:${TINTE};color:${AZUL};font-weight:500;padding:6px 11px;border-radius:999px;transition:background .15s ease}
.${P}-link-hot:hover{color:${AZUL};background:#DCE6FB}
.${P}-login{font-size:12.5px;line-height:1;color:rgba(31,30,29,.85);border:1px solid #D7D5CF;border-radius:6px;padding:7px 11px;margin-left:6px;white-space:nowrap}
.${P}-cta-barra{background:${TINTA};color:#FFF;font-size:12.5px;line-height:1;padding:8px 11px;border-radius:6px;white-space:nowrap;margin-left:-12px}

/* El hero (cx-wrap): 500 px de texto centrado y el panel a la derecha, 52 px entre los dos. */
.${P}-cx{max-width:1180px;margin:0 auto;padding:52px 32px 0;display:grid;grid-template-columns:500px 1fr;gap:52px;align-items:center}
.${P}-cx-izq{text-align:center}
.${P}-h1{font-family:${SERIF};font-weight:400;font-size:50px;line-height:1.12;letter-spacing:-.01em;color:${TINTA};white-space:nowrap}
.${P}-h1 em{display:inline-block;min-width:2.75em;text-align:left;color:${AZUL};transition:opacity .28s ease,transform .28s ease}
.${P}-h1 em.is-out{opacity:0;transform:translateY(8px)}
.${P}-cx-sub{margin-top:20px;font-size:18px;line-height:1.55;color:${GRIS}}
.${P}-cx-card{margin:30px auto 0;max-width:336px;background:#FCFBF8;border:1px solid #DBD9D3;border-radius:16px;padding:18px;box-shadow:0 12px 34px -26px rgba(31,30,29,.35)}
.${P}-cx-osc{display:block;text-align:center;background:${TINTA};color:#FFF;font-size:15px;line-height:1;padding:13px 16px;border-radius:7px}
.${P}-cx-suave{display:block;text-align:center;margin-top:10px;background:#FFF;border:1px solid #D2D0CA;color:rgba(31,30,29,.9);font-size:15px;line-height:1;padding:12px 16px;border-radius:7px}
.${P}-cx-suave i{font-size:12px;color:rgba(31,30,29,.5);margin-left:6px}

/* El panel lila con sus escenas (hseq): cada una entra en ,55 s con ,18 s de espera; al final, la ventana crece 1,14. */
.${P}-panel{position:relative;min-height:600px;border:1px solid #D9E3F8;border-radius:14px;background:${TINTE};overflow:hidden}
.${P}-ondas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.${P}-esc{position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;padding:40px;opacity:0;transform:translateY(14px) scale(.985);transition:opacity .55s ease,transform .55s ease;pointer-events:none}
.${P}-esc.is-on{opacity:1;transform:none;transition-delay:.18s}
.${P}-win{width:100%;max-width:480px;background:#FFF;border:1px solid ${FILETE};border-radius:12px;box-shadow:0 26px 60px -30px rgba(31,30,29,.4);overflow:hidden;text-align:left;transition:transform .9s cubic-bezier(.2,.7,.2,1)}
.${P}-winbar{position:relative;display:flex;align-items:center;gap:7px;padding:13px 18px;border-bottom:1px solid ${FILETE};background:#FFF}
.${P}-winbar i{width:9px;height:9px;border-radius:50%;background:#EDEBE3}
.${P}-winbar span{position:absolute;left:50%;transform:translateX(-50%);font-family:${MONO};font-size:11.5px;color:#5E5D59;white-space:nowrap}
.${P}-win-cuerpo{transition:opacity .6s ease}
.${P}-win-cuerpo video{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;background:#F4F5F7}
.${P}-cap{padding:12px 18px 14px;font-size:12.5px;line-height:1.45;color:${GRIS};border-top:1px solid ${FILETE};transition:font-size .7s ease,padding .7s ease,color .7s ease}
.${P}-cap b{font-weight:400;color:${AZUL};padding:1px 0;border-radius:6px;transition:background .6s ease,padding .6s ease;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.${P}-esc.at-d .${P}-win{transform:scale(1.14) translateY(-16px);transform-origin:50% 100%}
.${P}-esc.at-d .${P}-win-cuerpo{opacity:.28}
.${P}-esc.at-d .${P}-cap{font-size:15px;padding:16px 18px 18px;color:${TINTA}}
.${P}-esc.at-d .${P}-cap b{background:${TINTE};padding:2px 7px}

/* La línea de prueba y sus fichas (sin hover, como las suyas). */
.${P}-prueba{max-width:1180px;margin:0 auto;padding:56px 32px 0;text-align:center}
.${P}-prueba-l{font-size:13px;line-height:1.5;color:${GRIS}}
.${P}-chips{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;margin-top:14px}
.${P}-chip{display:inline-flex;align-items:center;gap:8px;background:#FFF;border:1px solid ${FILETE};border-radius:10px;padding:9px 15px;font-size:13px;line-height:15px;color:rgba(31,30,29,.75);white-space:nowrap}
.${P}-chip-b{color:${AZUL}}
.${P}-chip-video{padding:4px 15px 4px 4px}
.${P}-chip-video video{width:46px;height:26px;border-radius:6px;object-fit:cover;background:${TINTA};display:block}

/* «Brands that add Hyros see» (sx). */
.${P}-sx-in{max-width:1180px;margin:0 auto;padding:92px 32px 48px;text-align:center}
.${P}-dim{display:flex;align-items:center;gap:12px;max-width:820px;margin:0 auto 26px;font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#6B6963}
.${P}-dim i{flex:1;min-width:18px;border-top:1px solid #9A988F;position:relative}
.${P}-dim i:before,.${P}-dim i:after{content:"";position:absolute;top:-5px;width:1px;height:11px;background:#9A988F}
.${P}-dim i:before{left:0}
.${P}-dim i:after{right:0}
.${P}-dim i:first-child{transform-origin:100% 50%}
.${P}-dim i:last-child{transform-origin:0 50%}
.${P}-dim span{white-space:nowrap}
.${P}-sx-h2{font-family:${SERIF};font-weight:400;font-size:clamp(34px,4.3vw,58px);line-height:1.1;letter-spacing:-.012em;color:${TINTA}}
.${P}-sx-h2 b,.${P}-hf-h2 b,.${P}-hb-h2 b{display:inline-block;font-weight:400;color:#FFF;background:${AZUL} no-repeat 0 0/100% 100%;border-radius:.2em;padding:.03em .2em .09em;margin:0 .03em;white-space:nowrap}
.${P}-sx-lede{font-size:17px;line-height:1.6;color:${GRIS};max-width:560px;margin:20px auto 0;text-wrap:balance}
.${P}-sx-head>:nth-child(2){--i:1}
.${P}-sx-head>:nth-child(3){--i:2}
.${P}-sx-frame{position:relative;max-width:1100px;margin:46px auto 0;padding:18px 20px 16px}
.${P}-cm{position:absolute;width:18px;height:18px;border:2px solid ${TINTA}}
.${P}-cm.tl{left:0;top:0;border-right:0;border-bottom:0}
.${P}-cm.tr{right:0;top:0;border-left:0;border-bottom:0;--i:1}
.${P}-cm.br{right:0;bottom:0;border-left:0;border-top:0;--i:2}
.${P}-cm.bl{left:0;bottom:0;border-right:0;border-top:0;--i:3}
.${P}-sx-meta{display:flex;justify-content:space-between;gap:12px;padding:2px 4px 16px;font-family:${MONO};font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6B6963}
.${P}-sx-meta span:last-child{color:${AZUL}}
.${P}-sx-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;align-items:stretch}
.${P}-sx-card{position:relative;background:#FFF;border:1px solid ${FILETE};border-radius:14px;padding:18px 18px 16px;text-align:left}
.${P}-sx-card .k{display:flex;justify-content:space-between;gap:8px;font-family:${MONO};font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#6B6963}
.${P}-sx-card .k em{color:#A9A7A0}
.${P}-sx-card .v{display:flex;align-items:center;gap:10px;margin-top:16px;font-family:${SERIF};font-size:clamp(28px,2.9vw,42px);line-height:1;letter-spacing:-.02em;color:${TINTA};white-space:nowrap}
.${P}-sx-card .l{margin-top:9px;font-size:13.5px;line-height:1.45;color:${GRIS}}
.${P}-sx-card .sc{display:block;width:100%;height:auto;margin-top:18px}
.${P}-ar{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:${TINTE};color:${AZUL};flex:none}
.${P}-sx-card.is-hero{background:${AZUL};border-color:${AZUL};box-shadow:var(--plate,8px) var(--plate,8px) 0 #C5D6FA;transform:translateY(var(--lift,-10px))}
.${P}-sx-card.is-hero .k,.${P}-sx-card.is-hero .k em{color:rgba(255,255,255,.78)}
.${P}-sx-card.is-hero .v{color:#FFF}
.${P}-sx-card.is-hero .l{color:rgba(255,255,255,.86)}
.${P}-sx-card.is-hero .${P}-ar{background:#FFF}
.${P}-sx-foot{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:18px;padding:13px 4px 0;border-top:1px solid #C9C7C0;font-size:13px;color:#6B6963;text-align:left}
.${P}-sx-foot .g{display:inline-flex;align-items:center;gap:8px;color:${TINTA};font-weight:500;white-space:nowrap}

/* «Hyros Custom» (hf): el texto pegado a 96 px y el cubo. */
.${P}-hf{position:relative;overflow:hidden;padding:40px 32px 104px}
.${P}-hf-in{max-width:1160px;margin:0 auto;display:grid;grid-template-columns:1fr 1.85fr;gap:32px;align-items:start}
.${P}-hf-izq{position:sticky;top:96px;min-width:0}
.${P}-pill{display:inline-flex;align-items:center;gap:8px;background:${TINTE};color:${AZUL};border-radius:999px;padding:7px 13px;font-size:13px;font-weight:500;letter-spacing:.01em;line-height:1.3}
.${P}-pill:before{content:"";flex:none;width:6px;height:6px;border-radius:50%;background:${AZUL}}
.${P}-hf-h2{margin-top:18px;font-family:${SERIF};font-weight:400;font-size:clamp(28px,3.3vw,46px);line-height:1.12;letter-spacing:-.02em;color:${TINTA}}
.${P}-hf-h2 span{display:block;white-space:nowrap}
.${P}-hf-h2 b{padding:.03em .24em .09em;margin:.1em 0 0;line-height:1.08}
.${P}-hf-p{margin-top:22px;max-width:390px;font-size:17px;line-height:1.6;color:${GRIS};text-wrap:pretty}
.${P}-hf-p b{font-weight:600;color:${TINTA}}
.${P}-vis{position:relative;min-width:0}
.${P}-svg{display:block;width:100%;height:auto;overflow:visible}
.${P}-svg.is-ph,.${P}-pcard{display:none}
.${P}-el{transform-box:fill-box;transform-origin:50% 50%}
.${P}-pcard{align-items:flex-start;gap:10px;margin:16px auto 0;max-width:380px;padding:12px 14px;border:1px solid #9A988F;border-radius:10px;background:#FFF;text-align:left}
.${P}-pcard>i{flex:none;width:7px;height:7px;border-radius:50%;background:${AZUL};margin-top:5px}
.${P}-pcard span{display:block;font-family:${MONO};font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${AZUL}}
.${P}-pcard b{display:block;font-size:15px;font-weight:600;color:${TINTA};margin-top:4px}
.${P}-pcard em{display:block;font-size:12px;color:#6B6963;margin-top:2px}

/* «All / All / None» (hp). */
.${P}-hp{padding:96px 32px 72px}
.${P}-hp-in{max-width:1100px;margin:0 auto;text-align:center}
.${P}-kick{font-family:${MONO};font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:${AZUL}}
.${P}-ledger{margin-top:28px;text-align:left;border-top:1px solid ${FILETE}}
.${P}-hp-row{display:grid;grid-template-columns:260px 1fr 150px;gap:36px;align-items:center;padding:38px 0;border-bottom:1px solid ${FILETE}}
.${P}-hp-big{font-family:${SERIF};font-size:96px;line-height:.9;letter-spacing:-.03em;color:${AZUL}}
.${P}-hp-row.is-none .${P}-hp-big{color:${TINTA}}
.${P}-hp-rest{font-family:${SERIF};font-weight:400;font-size:34px;line-height:1.18;letter-spacing:-.015em;color:${TINTA}}
.${P}-hp-tag{font-family:${MONO};font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:${GRIS};text-align:right}

/* La banda de modelos de negocio (pd). */
.${P}-pd{position:relative;overflow:hidden;background:${AZUL};padding:92px 32px 100px}
.${P}-pd-in{position:relative;z-index:1;max-width:1180px;margin:0 auto;display:grid;grid-template-columns:.82fr 1.18fr;gap:64px;align-items:center}
.${P}-pd-k{font-family:${MONO};font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#D3E0FC}
.${P}-pd-h2{font-family:${SERIF};font-weight:400;font-size:clamp(34px,3.3vw,44px);line-height:1.1;letter-spacing:-.012em;color:#FFF;margin-top:14px}
.${P}-pd-h2 b{font-weight:400;color:#CFDDFB}
.${P}-pd-h2 span{white-space:nowrap}
.${P}-pd-row{display:grid;grid-template-columns:auto 60px 1fr auto;align-items:center;gap:18px;padding:15px 18px 15px 20px;border:1px solid rgba(255,255,255,.3);border-radius:16px;background:rgba(255,255,255,.09);transition:background .2s,border-color .2s,transform .25s ${E}}
.${P}-pd-row+.${P}-pd-row{margin-top:12px}
.${P}-pd-row:hover{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.7);transform:translateX(5px)}
.${P}-pd-n{font-family:${MONO};font-size:11px;letter-spacing:.1em;color:#CFDDFB}
.${P}-pd-sv{position:relative;display:flex;align-items:center;justify-content:center;width:60px;height:60px;border-radius:12px;background:#FFF}
.${P}-pd-sv img{width:34px;height:34px;object-fit:contain;display:block}
.${P}-pd-t{display:block;font-family:${SERIF};font-weight:400;font-size:23px;line-height:1.15;letter-spacing:-.005em;color:#FFF}
.${P}-pd-s{display:block;font-size:14px;line-height:1.45;color:rgba(255,255,255,.8);margin-top:3px}
.${P}-pd-go{display:inline-flex;align-items:center;gap:8px;background:#FFF;color:${TINTA};border-radius:999px;padding:10px 16px;font-size:13.5px;font-weight:500;white-space:nowrap}
.${P}-pd-go em{color:${AZUL}}
.${P}-pd-row.is-custom{position:relative;isolation:isolate;background:#FFF;border-color:#FFF;padding:18px 18px 18px 20px;box-shadow:0 22px 44px -22px rgba(11,31,77,.75)}
.${P}-pd-row.is-custom+.${P}-pd-row{margin-top:16px}
.${P}-pd-row.is-custom:before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background-image:linear-gradient(rgba(47,111,237,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(47,111,237,.09) 1px,transparent 1px);background-size:18px 18px;-webkit-mask-image:linear-gradient(90deg,transparent 38%,#000);mask-image:linear-gradient(90deg,transparent 38%,#000)}
.${P}-pd-row.is-custom:hover{background:#FFF;border-color:#FFF;box-shadow:0 26px 48px -20px rgba(11,31,77,.85)}
.${P}-pd-row.is-custom .${P}-pd-n{display:inline-block;width:15.4px;text-align:center;font-size:15px;line-height:1;letter-spacing:0;color:${AZUL}}
.${P}-pd-row.is-custom .${P}-pd-sv{background:${AZUL}}
.${P}-pd-spark{position:absolute;right:7px;top:7px;width:7px;height:7px;background:#CFDDFB}
.${P}-pd-spark:after{content:"";position:absolute;right:9px;top:9px;width:4px;height:4px;background:#FFF}
.${P}-pd-row.is-custom .${P}-pd-t{color:${TINTA}}
.${P}-pd-row.is-custom .${P}-pd-s{color:${GRIS}}
.${P}-pd-row.is-custom .${P}-pd-s b{font-weight:600;color:${AZUL}}
.${P}-pd-new{display:inline-block;vertical-align:.3em;margin-left:8px;font-family:${MONO};font-weight:500;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;line-height:1;color:${AZUL};background:${TINTE};border-radius:999px;padding:5px 8px 4px}
.${P}-pd-row.is-custom .${P}-pd-go{background:${AZUL};color:#FFF}
.${P}-pd-row.is-custom .${P}-pd-go em{color:#FFF}

/* La lámina (hb). */
.${P}-hb{position:relative;overflow:hidden;background:#FFF;border-top:1px solid ${FILETE};padding:112px 64px 76px}
.${P}-hb-paper{position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(47,111,237,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(47,111,237,.13) 1px,transparent 1px),linear-gradient(rgba(47,111,237,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(47,111,237,.06) 1px,transparent 1px);background-size:120px 120px,120px 120px,24px 24px,24px 24px;background-position:50% 44px;-webkit-mask-image:radial-gradient(ellipse 46% 240px at 50% 250px,transparent 0,transparent 55%,#000 100%);mask-image:radial-gradient(ellipse 46% 240px at 50% 250px,transparent 0,transparent 55%,#000 100%)}
.${P}-hb-sheet{position:absolute;inset:22px;border:1px solid #B9B7B1;pointer-events:none}
.${P}-zn{position:absolute;display:grid;font-family:${MONO};font-size:9.5px;letter-spacing:.08em;color:#6B6963;background:#FFF}
.${P}-zt{left:0;right:0;top:0;height:18px;grid-template-columns:repeat(6,1fr);border-bottom:1px solid #B9B7B1}
.${P}-zl{left:0;top:18px;bottom:0;width:18px;grid-template-rows:repeat(4,1fr);border-right:1px solid #B9B7B1}
.${P}-zn span{display:grid;place-items:center}
.${P}-zt span+span{border-left:1px solid #B9B7B1}
.${P}-zl span+span{border-top:1px solid #B9B7B1}
.${P}-rg{position:absolute;width:20px;height:20px;border:1px solid #6B6963;border-radius:50%;background:#FFF;z-index:1}
.${P}-rg:before,.${P}-rg:after{content:"";position:absolute;background:#6B6963}
.${P}-rg:before{left:-8px;right:-8px;top:50%;height:1px;margin-top:-.5px}
.${P}-rg:after{top:-8px;bottom:-8px;left:50%;width:1px;margin-left:-.5px}
.${P}-rg.tl{left:-10px;top:-10px}
.${P}-rg.tr{right:-10px;top:-10px}
.${P}-rg.bl{left:-10px;bottom:-10px}
.${P}-rg.br{right:-10px;bottom:-10px}
.${P}-hb-in{position:relative;z-index:1;max-width:1180px;margin:0 auto}
.${P}-hb-head{text-align:center;max-width:900px;margin:0 auto}
.${P}-hb-dim{max-width:520px;margin-bottom:24px;font-size:10.5px;letter-spacing:.14em}
.${P}-hb-h2{font-family:${SERIF};font-weight:400;font-size:clamp(34px,4.3vw,60px);line-height:1.1;letter-spacing:-.015em;color:${TINTA}}
.${P}-hb-h2 span{display:block;white-space:nowrap}
.${P}-hb-h2 b{padding:.03em .22em .09em;margin-left:.02em;border-radius:.18em;line-height:1.08;box-shadow:0 16px 30px -18px rgba(47,111,237,.75)}
.${P}-hb-sub{margin:20px auto 0;max-width:640px;font-size:18px;line-height:1.5;color:${GRIS};text-wrap:balance}
.${P}-hb-sub b{font-weight:600;color:${TINTA}}
.${P}-hb-btnrow{display:flex;justify-content:center;margin-top:30px}
.${P}-hb-split{display:inline-flex;align-items:stretch;background:${TINTA};color:#FFF;border-radius:5px;overflow:hidden;font-size:15.5px;font-weight:500;line-height:1;white-space:nowrap;box-shadow:0 14px 26px -16px rgba(31,30,29,.7);transition:transform .25s ${E},box-shadow .25s}
.${P}-hb-split span{display:flex;align-items:center;padding:17px 20px 17px 22px}
.${P}-hb-split i{display:grid;place-items:center;width:52px;background:${AZUL};font-size:16px;transition:width .25s ${E}}
.${P}-hb-split i b{display:block;font-weight:400;transition:transform .25s ${E}}
.${P}-hb-split:hover{transform:translateY(-2px);box-shadow:0 20px 30px -16px rgba(31,30,29,.75)}
.${P}-hb-split:hover i{width:62px}
.${P}-hb-split:hover i b{transform:translateX(3px)}
.${P}-hb-grid{display:grid;grid-template-columns:1.18fr 1fr;gap:56px;align-items:center;margin-top:56px;text-align:left}
.${P}-hb-grid>*{min-width:0}
.${P}-hb-fig{display:grid;grid-template-columns:18px minmax(0,1fr);grid-template-rows:20px auto}
.${P}-hb-rt{grid-column:2;position:relative;margin:0 14px;overflow:hidden;border-bottom:1px solid #8A8880;background:linear-gradient(90deg,#8A8880 1px,transparent 1px) 0 100%/100px 11px repeat-x,linear-gradient(90deg,#8A8880 1px,transparent 1px) 0 100%/50px 7px repeat-x,linear-gradient(90deg,#B5B3AB 1px,transparent 1px) 0 100%/10px 4px repeat-x}
.${P}-hb-rt span{position:absolute;top:0;margin-left:4px;font-family:${MONO};font-size:8.5px;line-height:1;color:#6B6963}
.${P}-hb-rl{grid-column:1;grid-row:2;margin:14px 0;border-right:1px solid #8A8880;background:linear-gradient(#8A8880 1px,transparent 1px) 100% 0/11px 100px repeat-y,linear-gradient(#8A8880 1px,transparent 1px) 100% 0/7px 50px repeat-y,linear-gradient(#B5B3AB 1px,transparent 1px) 100% 0/4px 10px repeat-y}
.${P}-hb-frame{grid-column:2;grid-row:2;position:relative;padding:14px;background:#FFF}
.${P}-cm2{position:absolute;width:18px;height:18px;border:0 solid ${TINTA}}
.${P}-cm2.tl{top:0;left:0;border-top-width:2px;border-left-width:2px}
.${P}-cm2.tr{top:0;right:0;border-top-width:2px;border-right-width:2px}
.${P}-cm2.bl{bottom:0;left:0;border-bottom-width:2px;border-left-width:2px}
.${P}-cm2.br{bottom:0;right:0;border-bottom-width:2px;border-right-width:2px}
.${P}-hb-app{max-width:500px;margin:0 auto;background:#FFF;border:1px solid ${FILETE};border-radius:12px;overflow:hidden;box-shadow:0 30px 60px -28px rgba(31,30,29,.45)}
.${P}-hb-app video{display:block;width:100%;aspect-ratio:620/714;object-fit:cover;background:#EEEEEB}
.${P}-hb-tbl{background:#FFF;border:1px solid #B9B7B1}
.${P}-hb-th{display:grid;grid-template-columns:52px 1fr auto;align-items:center;border-bottom:1.5px solid ${TINTA};font-family:${MONO};font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#6B6963}
.${P}-hb-th span{padding:10px 16px}
.${P}-hb-th span:first-child{padding:10px 0;text-align:center}
.${P}-hb-th span+span{border-left:1px solid ${FILETE}}
.${P}-hb-th span:last-child{border-left:0}
.${P}-hb-tr{display:grid;grid-template-columns:52px 1fr}
.${P}-hb-tr+.${P}-hb-tr{border-top:1px solid ${FILETE}}
.${P}-hb-no{display:grid;place-items:start center;padding-top:22px;font-family:${MONO};font-size:12px;letter-spacing:.1em;color:${AZUL};transition:color .3s}
.${P}-hb-tr.is-queued .${P}-hb-no,.${P}-hb-tr.is-queued .${P}-hb-t>span{color:#A3A199}
.${P}-hb-td{padding:18px 16px 20px;border-left:1px solid ${FILETE};min-width:0}
.${P}-hb-t{display:flex;align-items:center;justify-content:space-between;gap:14px;font-family:${SERIF};font-weight:400;font-size:22px;line-height:1.25;letter-spacing:-.01em;color:${TINTA}}
.${P}-hb-t>span{transition:color .3s}
.${P}-hb-tag{flex:none;display:inline-flex;align-items:center;gap:7px;font-family:${MONO};font-size:10px;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;color:#8A8880}
.${P}-hb-tag i{width:7px;height:7px;border:1px solid currentColor}
.is-done .${P}-hb-tag{color:${AZUL}}
.is-done .${P}-hb-tag i{background:currentColor}
.is-typing .${P}-hb-tag{color:${TINTA}}
.is-typing .${P}-hb-tag i{width:5px;height:11px;border:0;background:currentColor}
.${P}-hb-b{margin-top:8px;font-family:${MONO};font-size:13.5px;line-height:1.7;color:#3A3936}
.${P}-hb-gh{color:rgba(31,30,29,.2)}
.${P}-hb-caret{display:inline-block;width:.5em;height:1.02em;margin:0 1px -.16em 3px;background:${AZUL};border-radius:1px}
.${P}-hb-tb{display:grid;grid-template-columns:repeat(4,auto);width:max-content;max-width:100%;margin:34px 0 0 auto;border:1px solid #B9B7B1;background:#FFF;font-family:${MONO};font-size:11.5px;color:${TINTA}}
.${P}-hb-tb span{padding:8px 16px 9px;white-space:nowrap}
.${P}-hb-tb span+span{border-left:1px solid #B9B7B1}
.${P}-hb-tb em{display:block;font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:#8A8880;margin-bottom:3px}

/* El cierre (bx-fin) y el pie. */
.${P}-fin{max-width:1180px;margin:0 auto;padding:88px 32px 0}
.${P}-finpanel{border:1px solid ${FILETE};border-radius:14px;background:#F6F5F0;padding:72px 32px 68px;text-align:center}
.${P}-fin-ico{display:block;margin:0 auto}
.${P}-fin-kick{font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#5E5D59;margin-top:14px}
.${P}-fin-h2{font-family:${SERIF};font-weight:400;font-size:44px;line-height:1.1;letter-spacing:-.012em;color:${TINTA};margin-top:10px}
.${P}-fin-h2 b{font-weight:400;color:${AZUL}}
.${P}-fin-lede{font-size:15.5px;line-height:1.6;color:${GRIS};max-width:620px;margin:16px auto 0}
.${P}-btns{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:30px}
.${P}-btn-osc{display:inline-flex;align-items:center;gap:9px;background:${TINTA};color:#FFF;font-size:15px;line-height:1;padding:13px 22px;border-radius:7px;white-space:nowrap}
.${P}-btn-suave{display:inline-flex;align-items:center;gap:9px;background:#EAE8E0;color:rgba(31,30,29,.9);font-size:15px;line-height:1;padding:13px 20px;border-radius:7px;white-space:nowrap}
.${P}-fin-quiet{font-size:13px;color:${GRIS};margin-top:22px}
.${P}-pie{max-width:1180px;margin:96px auto 0;padding:40px 32px 36px;border-top:1px solid ${FILETE};text-align:left}
.${P}-fgrid{display:grid;grid-template-columns:1.6fr repeat(4,1fr);gap:32px}
.${P}-ftag{font-size:13.5px;line-height:1.5;color:${GRIS};margin-top:14px;max-width:220px}
.${P}-fh{font-size:12.5px;color:${TINTA};margin-bottom:12px;min-height:1em}
.${P}-fl{font-size:13px;line-height:2;color:${GRIS}}
.${P}-fl a{display:block;color:${GRIS};transition:color .15s ease}
.${P}-fl a:hover{color:${TINTA}}
.${P}-fbot{display:flex;justify-content:space-between;align-items:center;margin-top:40px;padding-top:18px;border-top:1px solid ${FILETE};font-size:12px;color:${GRIS}}
.${P}-fbot a{color:${GRIS};transition:color .15s ease}
.${P}-fbot a+a{margin-left:18px}
.${P}-fbot a:hover{color:${TINTA}}

/* La píldora flotante (su pop.js): abajo al centro, sube 16 px y aparece en ,28 s al pasar el 80 % de la primera pantalla. */
.${P}-float{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:2147482000;display:inline-flex;align-items:center;gap:10px;padding:11px 18px 11px 14px;border-radius:999px;background:#0B1F4D;color:#FFF;font:600 15px/1 ${SANS};letter-spacing:-.01em;white-space:nowrap;box-shadow:0 14px 34px -14px rgba(11,31,77,.6),inset 0 0 0 1px rgba(255,255,255,.08);opacity:0;transform:translate(-50%,16px);pointer-events:none;transition:opacity .28s ease,transform .28s ease,background .15s}
.${P}-float.is-on{opacity:1;transform:translate(-50%,0);pointer-events:auto}
.${P}-float:hover{background:#12306F}
.${P}-float i{color:#9DBBF7;font-size:15px;line-height:1;margin-left:-2px}

/* Lo que entra al bajar (su Cn: data-rv → is-seen), sólo con el script prendido (.is-live). */
@keyframes dFuIn{to{opacity:1;transform:none}}
@keyframes dFuWipe{0%{background-size:0% 100%;color:${TINTA}}50%{color:${TINTA}}68%{color:#fff}100%{background-size:100% 100%;color:#fff}}
@keyframes dFuPop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}
@keyframes dFuHero{0%{opacity:0;transform:translateY(14px);box-shadow:0 0 0 #C5D6FA}52%{opacity:1;transform:none;box-shadow:0 0 0 #C5D6FA}100%{opacity:1;transform:translateY(var(--lift,-10px));box-shadow:var(--plate,8px) var(--plate,8px) 0 #C5D6FA}}
@keyframes dFuPd{from{opacity:0;transform:translateX(64px)}}
@keyframes dFuHsIn{from{opacity:0;transform:translateY(-34px)}to{opacity:1;transform:none}}
@keyframes dFuHsDrop{from{opacity:0;transform:translateY(-70px)}60%{opacity:1;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes dFuHsPop{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}
@keyframes dFuLayOut{to{opacity:0;transform:translate(-64px,37px)}}
@keyframes dFuLayIn{from{opacity:0;transform:translate(-64px,37px)}to{opacity:1;transform:none}}
@keyframes dFuChipOut{to{opacity:0;transform:translateY(-46px)}}
@keyframes dFuChipIn{from{opacity:0;transform:translateY(-46px)}to{opacity:1;transform:none}}
@keyframes dFuHbPop{0%{transform:none;box-shadow:0 0 0 0 rgba(47,111,237,.45)}40%{transform:scale(1.05) rotate(-.6deg);box-shadow:0 0 0 12px rgba(47,111,237,0)}100%{transform:none;box-shadow:0 16px 30px -18px rgba(47,111,237,.75)}}
@keyframes dFuNudge{0%,70%,100%{transform:none}82%{transform:translateX(5px)}}
@keyframes dFuLive{0%{transform:scale(.7);opacity:.3}60%{transform:scale(1.12)}100%{transform:none;opacity:1}}
@keyframes dFuCaret{50%{opacity:0}}
.${P}.is-live .${P}-sx-head>*{opacity:0;transform:translateY(12px)}
.${P}.is-live .${P}-sx-head.is-seen>*{animation:dFuIn .4s ${E} both;animation-delay:calc(var(--i,0) * .07s)}
.${P}.is-live .${P}-sx-head .${P}-dim i{transform:scaleX(0);transition:transform .5s ${E} .1s}
.${P}.is-live .${P}-sx-head.is-seen .${P}-dim i{transform:none}
.${P}.is-live .${P}-sx-h2 b{color:${TINTA};background-size:0% 100%}
.${P}.is-live .${P}-sx-head.is-seen .${P}-sx-h2 b{animation:dFuWipe .45s ${E} .28s forwards}
.${P}.is-live .${P}-cm,.${P}.is-live .${P}-ar{opacity:0;transform:scale(.4)}
.${P}.is-live .${P}-sx-frame.is-seen .${P}-cm{animation:dFuPop .28s cubic-bezier(.2,.9,.3,1.3) both;animation-delay:calc(var(--i,0) * .05s)}
.${P}.is-live .${P}-sx-meta,.${P}.is-live .${P}-sx-foot{opacity:0}
.${P}.is-live .${P}-sx-frame.is-seen .${P}-sx-meta{animation:dFuIn .35s ease both}
.${P}.is-live .${P}-sx-frame.is-seen .${P}-sx-foot{animation:dFuIn .35s ease .3s both}
.${P}.is-live .${P}-sx-card{opacity:0;transform:translateY(14px)}
.${P}.is-live .${P}-sx-card.is-seen{animation:dFuIn .4s ${E} both;animation-delay:calc(var(--i,0) * .07s)}
.${P}.is-live .${P}-sx-card.is-hero{box-shadow:0 0 0 #C5D6FA}
.${P}.is-live .${P}-sx-card.is-hero.is-seen{animation:dFuHero .78s ${E} .07s both}
.${P}.is-live .${P}-sx-card.is-seen .${P}-ar{animation:dFuPop .3s cubic-bezier(.2,.9,.3,1.3) both;animation-delay:calc(var(--i,0) * .09s + .66s)}
.${P}.is-live .${P}-hf-izq>*{opacity:0;transform:translateY(14px)}
.${P}.is-live .${P}-hf-izq.is-seen>*{animation:dFuIn .55s ${E} both;animation-delay:calc(var(--i,0) * .12s)}
.${P}.is-live .${P}-hf-h2 b{color:${TINTA};background-size:0% 100%}
.${P}.is-live .${P}-hf-izq.is-seen .${P}-hf-h2 b{animation:dFuWipe .55s ${E} .5s forwards}
.${P}.is-live .${P}-el{opacity:0}
.${P}.is-live .${P}-vis.is-seen .${P}-el{animation:dFuHsIn .7s ${E} both;animation-delay:var(--d,0s)}
.${P}.is-live .${P}-vis.is-seen .${P}-hy{animation-name:dFuHsDrop;animation-duration:.8s}
.${P}.is-live .${P}-vis.is-seen .${P}-card,.${P}.is-live .${P}-vis.is-seen .${P}-aux{animation-name:dFuHsPop;animation-duration:.5s}
.${P}.is-live .${P}-vis.is-done .${P}-el{animation:none;opacity:1}
.${P}.is-live .${P}-vis.is-done .${P}-lay.is-out{animation:dFuLayOut .5s cubic-bezier(.4,0,.8,.4) forwards}
.${P}.is-live .${P}-vis.is-done .${P}-lay.is-in{animation:dFuLayIn .6s ${E} both}
.${P}.is-live .${P}-vis.is-done .${P}-chip3d.is-out{animation:dFuChipOut .45s cubic-bezier(.4,0,.8,.4) forwards}
.${P}.is-live .${P}-vis.is-done .${P}-chip3d.is-in{animation:dFuChipIn .55s ${E} both}
.${P}.is-live .${P}-pd-head{opacity:0;transform:translateY(14px);transition:opacity .4s,transform .4s ${E}}
.${P}.is-live .${P}-pd-head.is-seen{opacity:1;transform:none}
.${P}.is-live .${P}-pd-list:not(.is-seen) .${P}-pd-row{opacity:0}
.${P}.is-live .${P}-pd-list.is-seen .${P}-pd-row{animation:dFuPd .4s ${E} backwards;animation-delay:calc(var(--i,0) * 70ms)}
.${P}.is-live .${P}-hb-paper{opacity:0;transition:opacity 1.4s ease .2s}
.${P}.is-live .${P}-hb-paper.is-seen{opacity:1}
.${P}.is-live .${P}-hb-sheet{clip-path:inset(-20px 100% 100% -20px);transition:clip-path 1.1s cubic-bezier(.5,0,.2,1)}
.${P}.is-live .${P}-hb-sheet.is-seen{clip-path:inset(-20px -20px -20px -20px)}
.${P}.is-live .${P}-rg{opacity:0;transform:scale(.3);transition:opacity .3s,transform .4s cubic-bezier(.2,.9,.3,1.4)}
.${P}.is-live .${P}-hb-sheet.is-seen .${P}-rg{opacity:1;transform:none}
.${P}.is-live .${P}-rg.tl{transition-delay:.05s}
.${P}.is-live .${P}-rg.tr,.${P}.is-live .${P}-rg.bl{transition-delay:.55s}
.${P}.is-live .${P}-rg.br{transition-delay:1s}
.${P}.is-live .${P}-hb-head .${P}-dim i{transform:scaleX(0);transition:transform .8s ${E} .15s}
.${P}.is-live .${P}-hb-head.is-seen .${P}-dim i{transform:none}
.${P}.is-live .${P}-hb-head .${P}-dim span,.${P}.is-live .${P}-hb-h2>span,.${P}.is-live .${P}-hb-sub,.${P}.is-live .${P}-hb-btnrow{opacity:0;transform:translateY(16px)}
.${P}.is-live .${P}-hb-head.is-seen .${P}-dim span{animation:dFuIn .5s ${E} both}
.${P}.is-live .${P}-hb-head.is-seen .${P}-hb-h2>span{animation:dFuIn .6s ${E} both}
.${P}.is-live .${P}-hb-head.is-seen .${P}-hb-h2>span+span{animation-delay:.1s}
.${P}.is-live .${P}-hb-h2 b{color:${TINTA};background-size:0% 100%;box-shadow:none}
.${P}.is-live .${P}-hb-head.is-seen .${P}-hb-h2 b{animation:dFuWipe .6s ${E} .45s forwards,dFuHbPop .7s ${E} 1.05s forwards}
.${P}.is-live .${P}-hb-head.is-seen .${P}-hb-sub{animation:dFuIn .55s ${E} .3s both}
.${P}.is-live .${P}-hb-head.is-seen .${P}-hb-btnrow{animation:dFuIn .55s ${E} .4s both}
.${P}.is-live .${P}-hb-head.is-seen .${P}-hb-split i b{animation:dFuNudge 2.6s ease 1.4s infinite}
.${P}.is-live .${P}-hb-rt{clip-path:inset(0 100% 0 0);transition:clip-path .9s ${E} .1s}
.${P}.is-live .${P}-hb-rl{clip-path:inset(0 0 100% 0);transition:clip-path .9s ${E} .25s}
.${P}.is-live .${P}-hb-fig.is-seen .${P}-hb-rt,.${P}.is-live .${P}-hb-fig.is-seen .${P}-hb-rl{clip-path:inset(0 0 0 0)}
.${P}.is-live .${P}-cm2{opacity:0;transform:scale(.4);transition:opacity .35s,transform .35s cubic-bezier(.2,.9,.3,1.3)}
.${P}.is-live .${P}-hb-fig.is-seen .${P}-cm2{opacity:1;transform:none}
.${P}.is-live .${P}-cm2.tl{transition-delay:.5s}
.${P}.is-live .${P}-cm2.tr{transition-delay:.58s}
.${P}.is-live .${P}-cm2.br{transition-delay:.66s}
.${P}.is-live .${P}-cm2.bl{transition-delay:.74s}
.${P}.is-live .${P}-hb-app{opacity:0;transform:translateY(18px);transition:opacity .6s .3s,transform .6s ${E} .3s}
.${P}.is-live .${P}-hb-fig.is-seen .${P}-hb-app{opacity:1;transform:none}
.${P}.is-live .${P}-hb-tbl{opacity:0;transform:translateY(16px);transition:opacity .55s,transform .55s ${E}}
.${P}.is-live .${P}-hb-tbl.is-seen{opacity:1;transform:none}
.${P}.is-live .${P}-hb-tr{opacity:0}
.${P}.is-live .${P}-hb-tbl.is-seen .${P}-hb-tr{animation:dFuIn .45s ease both;animation-delay:calc(.25s + var(--i,0) * .12s)}
.${P}.is-live .is-done .${P}-hb-tag{animation:dFuLive .5s cubic-bezier(.2,.9,.3,1.4)}
.${P}-hb-caret{animation:dFuCaret 1s steps(1) infinite}

@media (max-width:1100px){
  .${P}-cx{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .${P}-h1{font-size:44px}
}
@media (max-width:980px){
  .${P}-sx-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .${P}-sx-card.is-hero{--lift:0px}
}
/* Su versión de teléfono (sus cortes a 760 y 380 px). */
@media (max-width:760px){
  .${P}-barra-der{display:none}
  .${P}-barra-in{padding:0 20px}
  .${P}-cx{grid-template-columns:1fr;gap:28px;padding:24px 20px 0}
  .${P}-h1{font-size:40px;line-height:1.1;white-space:normal}
  .${P}-cx-sub{font-size:16px;line-height:1.5;margin-top:14px}
  .${P}-cx-card{max-width:none;margin-top:22px}
  .${P}-panel{min-height:0;height:440px}
  .${P}-esc{padding:14px}
  .${P}-winbar span{font-size:10px}
  .${P}-esc.at-d .${P}-win{transform:scale(1.04) translateY(-8px)}
  .${P}-prueba{padding:40px 20px 0}
  .${P}-chips{gap:6px}
  .${P}-chip{padding:8px 12px;font-size:12.5px}
  .${P}-chip-video{padding:3px 12px 3px 3px}
  .${P}-sx-in{padding:60px 18px 36px}
  .${P}-sx-h2{font-size:34px}
  .${P}-sx-lede{font-size:15.5px;margin-top:16px}
  .${P}-dim{gap:8px;margin-bottom:20px;font-size:9px;letter-spacing:.05em}
  .${P}-dim i{min-width:10px}
  .${P}-sx-frame{margin-top:30px;padding:14px 12px 12px}
  .${P}-sx-meta{font-size:9.5px;padding-bottom:12px}
  .${P}-sx-grid{grid-template-columns:1fr;gap:10px}
  .${P}-sx-card{padding:15px 15px 13px;--i:0 !important}
  .${P}-sx-card .v{margin-top:12px;font-size:36px}
  .${P}-sx-card .l{margin-top:8px;font-size:12.5px}
  .${P}-sx-card .sc{margin-top:14px}
  .${P}-sx-card.is-hero{--plate:6px}
  .${P}-sx-foot{flex-direction:column;align-items:flex-start;gap:6px;font-size:12px}
  .${P}-hf{padding:24px 20px 72px}
  .${P}-hf-in{grid-template-columns:1fr;gap:18px}
  .${P}-hf-izq{position:static;text-align:center}
  .${P}-pill{font-size:12px}
  .${P}-hf-h2{font-size:clamp(30px,9.4vw,36px)}
  .${P}-hf-p{margin-left:auto;margin-right:auto;font-size:16px}
  .${P}-svg.is-desk{display:none}
  .${P}-svg.is-ph{display:block}
  .${P}-pcard{display:flex}
  .${P}-hp{padding:60px 20px 72px}
  .${P}-hp-row{grid-template-columns:1fr;gap:8px;padding:26px 0}
  .${P}-hp-big{font-size:60px}
  .${P}-hp-rest{font-size:24px}
  .${P}-hp-tag{text-align:left;margin-top:4px}
  .${P}-pd{padding:60px 20px 68px}
  .${P}-pd-in{grid-template-columns:1fr;gap:26px}
  .${P}-pd-head{text-align:center}
  .${P}-pd-h2{font-size:30px}
  .${P}-pd-row,.${P}-pd-row.is-custom{grid-template-columns:52px 1fr auto;gap:13px;padding:12px}
  .${P}-pd-n,.${P}-pd-row.is-custom .${P}-pd-n{display:none}
  .${P}-pd-sv{width:52px;height:52px}
  .${P}-pd-sv img{width:30px;height:30px}
  .${P}-pd-t{font-size:19px}
  .${P}-pd-s{font-size:12.5px}
  .${P}-pd-go{font-size:0;gap:0;width:36px;height:36px;padding:0;justify-content:center}
  .${P}-pd-go em{font-size:16px}
  .${P}-pd-new{margin-left:6px;font-size:9px;padding:4px 7px 3px}
  .${P}-hb{padding:66px 20px 50px}
  .${P}-hb-sheet{inset:12px}
  .${P}-zl{display:none}
  .${P}-zt{grid-template-columns:repeat(4,1fr);height:15px;font-size:8.5px}
  .${P}-zt span:nth-child(n+5){display:none}
  .${P}-rg{width:14px;height:14px}
  .${P}-rg.tl,.${P}-rg.bl{left:-7px}
  .${P}-rg.tr,.${P}-rg.br{right:-7px}
  .${P}-rg.tl,.${P}-rg.tr{top:-7px}
  .${P}-rg.bl,.${P}-rg.br{bottom:-7px}
  .${P}-rg:before{left:-4px;right:-4px}
  .${P}-rg:after{top:-4px;bottom:-4px}
  .${P}-hb-paper{-webkit-mask-image:radial-gradient(ellipse 90% 200px at 50% 190px,transparent 0,transparent 60%,#000 100%);mask-image:radial-gradient(ellipse 90% 200px at 50% 190px,transparent 0,transparent 60%,#000 100%)}
  .${P}-hb-dim{max-width:300px;margin-bottom:18px}
  .${P}-hb-h2{font-size:clamp(27px,8.4vw,34px)}
  .${P}-hb-sub{font-size:16px;margin-top:14px}
  .${P}-hb-btnrow{margin-top:24px}
  .${P}-hb-split{font-size:13.5px}
  .${P}-hb-split span{padding:15px 14px 15px 16px}
  .${P}-hb-grid{grid-template-columns:1fr;gap:30px;margin-top:36px}
  .${P}-hb-fig{grid-template-columns:12px minmax(0,1fr);grid-template-rows:18px auto}
  .${P}-hb-rt{margin:0 10px}
  .${P}-hb-rt span:nth-child(n+4){display:none}
  .${P}-hb-rl{margin:10px 0}
  .${P}-hb-frame{padding:10px}
  .${P}-hb-th{grid-template-columns:38px 1fr auto}
  .${P}-hb-th span{padding:9px 12px}
  .${P}-hb-tr{grid-template-columns:38px 1fr}
  .${P}-hb-td{padding:15px 12px 17px}
  .${P}-hb-no{padding-top:19px}
  .${P}-hb-t{font-size:20px}
  .${P}-hb-b{font-size:12.5px}
  .${P}-hb-tb{grid-template-columns:1fr 1fr;width:100%;margin-top:26px}
  .${P}-hb-tb span:nth-child(3){border-left:0}
  .${P}-hb-tb span:nth-child(n+3){border-top:1px solid #B9B7B1}
  .${P}-btns{flex-direction:column;align-items:stretch}
  .${P}-btn-osc,.${P}-btn-suave{justify-content:center}
  .${P}-fin{padding:56px 20px 0}
  .${P}-finpanel{padding:44px 22px 40px}
  .${P}-fin-h2{font-size:34px}
  .${P}-fin-lede{font-size:15px}
  .${P}-fin-quiet{font-size:12.5px}
  .${P}-pie{margin-top:56px;padding:32px 20px 28px}
  .${P}-fgrid{grid-template-columns:1fr 1fr;gap:26px 20px}
  .${P}-fgrid>div:first-child{grid-column:1/-1}
  .${P}-fl{font-size:13.5px;line-height:1.95}
  .${P}-fbot{flex-direction:column;align-items:flex-start;gap:12px;margin-top:32px}
}
@media (prefers-reduced-motion:reduce){
  .${P} *,.${P} *:before,.${P} *:after{animation:none!important;transition:none!important}
  .${P}-pd-row:hover{transform:none}
}
/* El sol y la luna: el pie y lo pintado con ::before se escriben a mano en el oscuro (TemaSitio no los lee). */
html[data-sitio-modo="oscuro"] .${P}-hb-paper{opacity:.5}
html[data-sitio-modo="oscuro"] .${P}-cx-osc,html[data-sitio-modo="oscuro"] .${P}-btn-osc{background:#F5F4EF;color:${TINTA}}
`;

// =============================================================================
// El script (data-visor). Hace lo que hacen sus componentes: la palabra que rota (`te`, cada 2,4 s), el panel de escenas (`Le`: una
// grabación por escena; al terminar, la ventana crece y el pie se resalta 3 s, y pasa a la siguiente), lo que entra al bajar (`Cn`:
// data-rv → is-seen con un IntersectionObserver al -8 %), el cubo (`Kn`: 4,3 s después de verse queda armado y a los 5,6 s empieza a
// cambiar una capa o una ficha cada 3,4 s), la tabla que se escribe (`In`: 20 ms por letra, 560 ms entre filas, al verse el 55 %) y
// la píldora flotante (su pop.js). Limpia su estado antes de empezar (pulir.mjs guarda el DOM después de correrlo) y no corre dos
// veces. Con «menos movimiento», todo queda quieto en su lugar (la primera escena con su póster).
// =============================================================================
const SCRIPT = `(function(){
var P='${P}';
function trasHidratar(fn){if(!document.querySelector('script[src*="/_next/"]'))return fn();var t0=Date.now();(function mira(){var h=Object.keys(document.body).some(function(k){return k.indexOf('__reactFiber')===0||k.indexOf('__reactProps')===0;});if(h||Date.now()-t0>6000)fn();else setTimeout(mira,60);})();}
function q(s,r){return (r||document).querySelector(s);}
function qa(s,r){return [].slice.call((r||document).querySelectorAll(s));}
function iniciar(){
  var R=q('.'+P);if(!R||R.__listo)return;R.__listo=1;
  var quieto=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  R.classList.remove('is-live');
  qa('.is-seen,.at-d,.is-out,.is-in,.is-done,.is-typing,.is-queued',R).forEach(function(e){e.classList.remove('is-seen','at-d','is-out','is-in','is-done','is-typing','is-queued');});
  qa('.'+P+'-hb-tr',R).forEach(function(e){e.classList.add('is-done');var b=q('.'+P+'-hb-b',e),tg=q('.'+P+'-hb-tag',e);if(b)b.textContent=b.getAttribute('data-texto')||'';if(tg&&tg.lastChild)tg.lastChild.textContent='En tu hoja';});
  // El cubo vuelve a sus capas y sus fichas de nacimiento (la foto del visor puede haberlo guardado a mitad de un cambio).
  var cubo0=q('.'+P+'-vis',R);
  if(cubo0){try{var c0=JSON.parse(cubo0.getAttribute('data-capas')),f0=JSON.parse(cubo0.getAttribute('data-fichas')),b0=cubo0.getAttribute('data-logos')||'';
    qa('[data-capa]',cubo0).forEach(function(g){var t=q('.'+P+'-capa-t',g);if(t)t.textContent=c0[+g.getAttribute('data-capa')];});
    qa('[data-sig]',cubo0).forEach(function(t){t.textContent=c0[3+(+t.getAttribute('data-sig'))];});
    qa('[data-ficha]',cubo0).forEach(function(g){var f=f0[+g.getAttribute('data-ficha')],im=q('.'+P+'-ficha-img',g),t=q('.'+P+'-ficha-t',g);if(im)im.setAttribute('href',b0+'/'+f.logo);if(t){t.textContent=f.n.toUpperCase();t.setAttribute('font-size',f.n.length>9?'9':'10.5');}});
  }catch(x){}}
  var esc=qa('.'+P+'-esc',R);esc.forEach(function(e,i){e.classList.toggle('is-on',i===0);});
  var flota=q('.'+P+'-float',R);if(flota)flota.classList.remove('is-on');
  // La palabra que rota.
  var h1=q('.'+P+'-h1',R),em=h1&&q('em',h1),pal=[];try{pal=JSON.parse(h1.getAttribute('data-palabras')||'[]');}catch(x){}
  if(em&&pal.length){em.textContent=pal[0];if(!quieto){var ip=0;setInterval(function(){em.classList.add('is-out');setTimeout(function(){ip=(ip+1)%pal.length;em.textContent=pal[ip];em.classList.remove('is-out');},290);},2400);}}
  // Las escenas del hero.
  var vids=qa('video',R);vids.forEach(function(v){v.muted=true;});
  if(quieto){vids.forEach(function(v){v.removeAttribute('autoplay');try{v.pause();}catch(x){}});}
  else if(esc.length){
    var tA=0,tB=0;
    var ir=function(n){
      clearTimeout(tA);clearTimeout(tB);
      esc.forEach(function(e,j){e.classList.toggle('is-on',j===n);e.classList.remove('at-d');var w=q('video',e);if(w&&j!==n){try{w.pause();}catch(x){}}});
      var e=esc[n],v=q('video',e),hecho=false;
      var fin=function(){if(hecho)return;hecho=true;clearTimeout(tA);e.classList.add('at-d');tB=setTimeout(function(){ir((n+1)%esc.length);},3000);};
      if(v){v.loop=false;v.removeAttribute('loop');try{v.currentTime=0;}catch(x){}var p=v.play();if(p&&p.catch)p.catch(function(){});v.onended=fin;var d=(v.duration&&isFinite(v.duration))?v.duration:7;tA=setTimeout(fin,(d+1.5)*1000);}
      else tA=setTimeout(fin,6000);
    };
    ir(0);
  }
  if(quieto||!('IntersectionObserver' in window))return;
  // Lo que entra al bajar.
  R.classList.add('is-live');
  var cubo=q('.'+P+'-vis',R),tabla=q('.'+P+'-hb-tbl',R);
  var alVer=function(el){if(el===cubo)armarCubo();};
  var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('is-seen');io.unobserve(x.target);alVer(x.target);}});},{threshold:0,rootMargin:'0px 0px -8% 0px'});
  var H=window.innerHeight||800;
  qa('[data-rv]',R).forEach(function(el){var r=el.getBoundingClientRect();if(r.top<H*.92&&r.bottom>0){el.classList.add('is-seen');alVer(el);}else io.observe(el);});
  // El cubo: queda armado a los 4,3 s y desde los 5,6 s cambia una capa o una ficha cada 3,4 s.
  function armarCubo(){
    if(!cubo||cubo.__vivo)return;cubo.__vivo=1;
    var capas=[],fichas=[],base=cubo.getAttribute('data-logos')||'';try{capas=JSON.parse(cubo.getAttribute('data-capas'));fichas=JSON.parse(cubo.getAttribute('data-fichas'));}catch(x){return;}
    var rota=function(l,i,j){var r=l.slice(),v=r[i];r[i]=r[j];r.splice(j,1);r.push(v);return r;};
    var pintarCapas=function(){qa('[data-capa]',cubo).forEach(function(g){var t=q('.'+P+'-capa-t',g);if(t)t.textContent=capas[+g.getAttribute('data-capa')];});qa('[data-sig]',cubo).forEach(function(t){t.textContent=capas[3+(+t.getAttribute('data-sig'))];});};
    var pintarFichas=function(){qa('[data-ficha]',cubo).forEach(function(g){var f=fichas[+g.getAttribute('data-ficha')];var im=q('.'+P+'-ficha-img',g),t=q('.'+P+'-ficha-t',g);if(im)im.setAttribute('href',base+'/'+f.logo);if(t){t.textContent=f.n.toUpperCase();t.setAttribute('font-size',f.n.length>9?'9':'10.5');}});};
    var paso=0;
    var turno=function(){
      if(paso%2===0){var e=(paso>>1)%3,gs=qa('[data-capa="'+e+'"]',cubo);gs.forEach(function(g){g.classList.add('is-out');});
        setTimeout(function(){capas=rota(capas,e,3);pintarCapas();gs.forEach(function(g){g.classList.remove('is-out');g.classList.add('is-in');});setTimeout(function(){gs.forEach(function(g){g.classList.remove('is-in');});},700);},560);}
      else{var e2=((paso>>1)*3)%8,gf=qa('[data-ficha="'+e2+'"]',cubo);gf.forEach(function(g){g.classList.add('is-out');});
        setTimeout(function(){fichas=rota(fichas,e2,8);pintarFichas();gf.forEach(function(g){g.classList.remove('is-out');g.classList.add('is-in');});setTimeout(function(){gf.forEach(function(g){g.classList.remove('is-in');});},650);},520);}
      paso++;setTimeout(turno,3400);
    };
    setTimeout(function(){cubo.classList.add('is-done');},4300);setTimeout(turno,5600);
  }
  // La tabla de la lámina se escribe sola cuando se ve el 55 %.
  if(tabla){
    var filas=qa('.'+P+'-hb-tr',tabla);
    var esc2=function(s){return s.replace(/[&<>]/g,function(c){return c==='&'?'&amp;':c==='<'?'&lt;':'&gt;';});};
    var poner=function(f,n,estado){var b=q('.'+P+'-hb-b',f),t=b.getAttribute('data-texto')||'';f.classList.remove('is-done','is-typing','is-queued');f.classList.add(estado);b.innerHTML=(n>0?'<span aria-hidden="true">'+esc2(t.slice(0,n))+'</span>':'')+(estado==='is-typing'?'<i class="'+P+'-hb-caret"></i>':'')+(n<t.length?'<span class="'+P+'-hb-gh" aria-hidden="true">'+esc2(t.slice(n))+'</span>':'');var tag=q('.'+P+'-hb-tag',f);if(tag)tag.lastChild.textContent=estado==='is-done'?'En tu hoja':estado==='is-typing'?'Escribiendo':'En cola';};
    var ob2=new IntersectionObserver(function(es){if(!es.some(function(x){return x.isIntersecting;}))return;ob2.disconnect();
      filas.forEach(function(f){poner(f,0,'is-queued');});
      var t0=800;filas.forEach(function(f){var t=(q('.'+P+'-hb-b',f).getAttribute('data-texto')||'');var ini=t0;for(var k=1;k<=t.length;k++){(function(k){setTimeout(function(){poner(f,k,'is-typing');},ini+k*20);})(k);}setTimeout(function(){poner(f,t.length,'is-done');},ini+t.length*20+20);t0=ini+t.length*20+560;});
    },{threshold:.55});
    ob2.observe(tabla);
  }
  // La píldora flotante.
  if(flota){var mira=function(){var y=window.scrollY||window.pageYOffset||0;flota.classList.toggle('is-on',y>Math.max(320,(window.innerHeight||800)*.8));};addEventListener('scroll',mira,{passive:true});addEventListener('resize',mira);mira();}
  // La grabación de la lámina corre sólo mientras se ve.
  var app=q('.'+P+'-hb-app video',R);if(app){new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){var p=app.play();if(p&&p.catch)p.catch(function(){});}else app.pause();});},{threshold:.25}).observe(app);}
}
function arrancar(){trasHidratar(iniciar);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrancar);else arrancar();
})();`;
