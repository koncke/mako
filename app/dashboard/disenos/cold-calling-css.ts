// =============================================================================
// cold-calling-css — la hoja de estilos de la hoja «Cold Calling» con su diseño propio (la copia de Corvane)
// =============================================================================
// GENERADA por el armador del chat de los dashboards (scratchpad/tools/armar-cv.py) desde la hoja de la copia
// (docs/diseno/mockups-dashboard/cold-calling-corvane/corvane.css): todo adentro de .cv, cada clase con el prefijo cv-, sin el armazón de
// Corvane (la barra de la izquierda, la de arriba y la de abajo del teléfono), los resets por etiqueta con :where() y con @container en
// lugar de @media. Lo de la adaptación va al final (los vacíos, lo que se toca y la grabadora). Se escribió desde lo MEDIDO del demo:
// nada del código de la tienda.
// Paleta doble (6/11/2026, Martín: «los que vienen en dark mode deben acompañar siempre el white mode si el usuario lo tiene así en MaKo, y si
// tiene dark mode, automáticamente pasarse a allí»): claro por defecto y oscuro bajo [data-tema="oscuro"] de <html>, sólo con variables.
// ⚠️ En un template literal no va ningún backtick (ni en un comentario) ni un «dólar con llave».
// =============================================================================

export const CSS_COLD_CALLING = `
@font-face { font-family: 'Corvane Urbanist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/urbanist/v18/L0x-DF02iFML4hGCyMqrbS10ig.woff2) format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'Corvane Urbanist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/urbanist/v18/L0x-DF02iFML4hGCyMqlbS0.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
.cv {
  container-type: inline-size; container-name: cv;
  --font: 'Corvane Urbanist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --fs-2xs: 11px;
  --fs-xs: 12px;
  --fs-sm: 12.5px;
  --fs-md: 13.5px;
  --fs-base: 14px;
  --fs-lg: 15px;
  --fs-xl: 17px;
  --fs-2xl: 20px;
  --fs-3xl: 22px;
  --fs-4xl: 26px;
  --fs-display: 34px;
  --bg: #f1f0ec;
  --card: #fbfaf7;
  --card-2: #f5f4f0;
  --well: #1c1a160d;
  --line: #1c1a1614;
  --line-2: #1c1a1626;
  --shadow: 0 1px 2px #28221a0d, 0 12px 32px -22px #28221a47;
  --shadow-pop: 0 24px 60px -18px #1e1a1452, 0 2px 6px #1e1a1414;
  --text: #1c1c1e;
  --muted: #64625e;
  --faint: #8a8781;
  --ink: #1d1e20;
  --on-ink: #f6f4ef;
  --accent: #b0521f;
  --accent-text: #9c4518;
  --on-accent: #fff8f2;
  --accent-soft: #f3e3d6;
  --good: #1d7448;
  --warn: #8f5a00;
  --bad: #b3303d;
  --info: #2c5e9f;
  --soft: 13%;
  --t-sand: #ecdfcd;
  --t-sage: #dce5d9;
  --t-mist: #dbe3ea;
  --t-clay: #efd9d0;
  --on-tile: #1c1c1e;
  --av-a: #e7d3c3;
  --av-b: #cfe0d5;
  --av-c: #d4dceb;
  --av-d: #eedcb6;
  --av-e: #e3d0d4;
  --av-f: #d2e3e3;
  --on-av: #2a2622;
  --amex-bg: #dcebf0;
  --amex-ink: #1f5f7a;
  --mc-ink: #8a3a12;
  --visa-bg: #dfe4f3;
  --visa-ink: #1f3f9a;
  --r-card: 18px;
  --r-ctl: 11px;
  --side-w: 248px;
  --rail-w: 88px;
  --gap: 16px;
  --gutter: clamp(16px, 2vw, 32px);
  position: relative; padding: 4px 26px 56px; color: var(--text); background: var(--bg); font: 500 14px/20.3px var(--font); -webkit-font-smoothing: antialiased;
}
/* Oscuro: tinta cálida con las superficies subiendo de luz; los mosaicos y avatares pastel pasan a tonos hondos con texto claro. */
.cv:where([data-tema="oscuro"] *) {
  --bg: #121110;
  --card: #1b1a18;
  --card-2: #232220;
  --well: #262422;
  --line: #2d2b28;
  --line-2: #3e3b36;
  --shadow: 0 1px 2px #00000080, 0 12px 32px -22px #000000d9;
  --shadow-pop: 0 24px 60px -18px #000000e6, 0 2px 6px #00000080;
  --text: #eceae6;
  --muted: #aba8a2;
  --faint: #8e8b85;
  --ink: #ecebe6;
  --on-ink: #17161a;
  --accent: #e8874d;
  --accent-text: #f19b66;
  --on-accent: #1d0e05;
  --accent-soft: #3a2619;
  --good: #5ecb8b;
  --warn: #e4af4d;
  --bad: #f17a8b;
  --info: #7cb1ef;
  --t-sand: #3a3326;
  --t-sage: #2a3529;
  --t-mist: #2a3441;
  --t-clay: #3d2a24;
  --on-tile: #eceae6;
  --av-a: #4a382c;
  --av-b: #2e4437;
  --av-c: #333f55;
  --av-d: #4d4224;
  --av-e: #4b3338;
  --av-f: #2c4444;
  --on-av: #f1eee9;
  --amex-bg: #1e3a46;
  --amex-ink: #8fcce3;
  --mc-ink: #f2a478;
  --visa-bg: #26335a;
  --visa-ink: #adc0f6;
}

/* ── la copia ─────────────────────────────────────────────────────────────────────────────────────── */
.cv *, .cv *::before, .cv *::after { box-sizing: border-box; }
.cv :where(button) { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; padding: 0; }
.cv :where(a) { color: inherit; text-decoration: none; }
.cv :where(h1), .cv :where(h2), .cv :where(h3), .cv :where(p), .cv :where(ul) { margin: 0; }
.cv :where(ul) { padding: 0; list-style: none; }
.cv svg.cv-i { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.cv :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }
.cv .cv-btn { height: 40px; padding: 0 16px; display: inline-flex; align-items: center; gap: 8px; border-radius: var(--r-ctl); font: 600 13.5px/19.575px var(--font); background: var(--card); box-shadow: inset 0 0 0 1px var(--line-2); white-space: nowrap; }
.cv .cv-btn:hover { background: var(--card-2); }
.cv .cv-btn--primary { background: var(--ink); color: var(--on-ink); box-shadow: none; }
.cv .cv-btn--primary:hover { background: color-mix(in srgb, var(--ink) 88%, var(--accent)); }
.cv .cv-btn--ghost { background: none; box-shadow: none; padding: 0 10px; }
.cv .cv-btn--ghost:hover { background: var(--well); }
.cv .cv-btn__n { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; display: grid; place-items: center; font: 900 11px/15.95px var(--font); color: var(--on-accent); background: var(--accent); }
.cv .cv-head { display: flex; align-items: flex-end; gap: 16px; margin-bottom: 20px; }
.cv .cv-head__eyebrow { font: 600 12.5px/18.125px var(--font); color: var(--muted); }
.cv .cv-head__title { margin-top: 4px; font: 600 clamp(28px, 2.6vw, 40px)/1.04 var(--font); letter-spacing: -0.025em; }
.cv .cv-head__sub { margin-top: 9px; font: 500 14px/20.3px var(--font); color: var(--muted); }
.cv .cv-head__sub b { font-weight: 700; color: var(--text); }
.cv .cv-head__actions { margin-left: auto; display: flex; gap: 10px; }
.cv .cv-card { background: var(--card); border-radius: var(--r-card); box-shadow: var(--shadow); padding: 20px; min-width: 0; }
.cv .cv-card__h { display: flex; align-items: center; gap: 10px; }
.cv .cv-card__t { font: 600 15px/21.75px var(--font); letter-spacing: -0.075px; }
.cv .cv-card__aside { margin-left: auto; font: 500 12.5px/18.125px var(--font); color: var(--muted); }
.cv .cv-link { font: 600 13.5px/19.575px var(--font); color: var(--accent-text); }
.cv .cv-link:hover { text-underline-offset: 3px; text-decoration: underline; }
.cv .cv-r1 { display: grid; grid-template-columns: minmax(0, 2.1fr) minmax(0, 1fr); gap: var(--gap); }
.cv .cv-r2 { margin-top: var(--gap); display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--gap); }
.cv .cv-r3 { margin-top: var(--gap); display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 1fr); gap: var(--gap); align-items: start; }
.cv .cv-seg { position: relative; display: inline-flex; padding: 3px; border-radius: var(--r-ctl); background: var(--well); }
.cv .cv-seg__pill { position: absolute; top: 3px; left: 3px; height: 30px; border-radius: 8px; background: var(--card); box-shadow: 0 1px 2px #28221a1f, inset 0 0 0 1px var(--line); transition: translate .28s cubic-bezier(.3, 1.4, .5, 1), width .28s cubic-bezier(.3, 1.4, .5, 1); }
.cv .cv-seg__opt { position: relative; z-index: 1; height: 30px; padding: 0 12px; border-radius: 8px; font: 600 13px/18.85px var(--font); color: var(--muted); }
.cv .cv-seg__opt[aria-pressed='true'] { color: var(--text); }
.cv .cv-seg__opt:hover { color: var(--text); }
.cv .cv-hero__head { display: flex; align-items: flex-start; gap: 16px; }
.cv .cv-hero__segs { margin-left: auto; display: flex; gap: 8px; }
.cv .cv-hero__big { margin-top: 4px; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.cv .cv-hero__big b { font: 600 34px/35.7px var(--font); letter-spacing: -0.85px; }
.cv .cv-chg { display: inline-flex; align-items: center; gap: 3px; font: 700 12px/17.4px var(--font); }
.cv .cv-chg--bad { color: var(--bad); }
.cv .cv-chg--good { color: var(--good); }
.cv .cv-chg svg.cv-i { width: 12px; height: 12px; stroke-width: 2.2; }
.cv .cv-hero__vs { font: 500 12.5px/18.125px var(--font); color: var(--muted); }
.cv .cv-hero__stats { margin-top: 8px; display: flex; gap: 18px; font: 500 12.5px/18.125px var(--font); color: var(--muted); }
.cv .cv-hero__stats b { font-weight: 600; color: var(--text); }
.cv .cv-chart { position: relative; margin-top: 10px; height: 248px; }
.cv .cv-chart svg { display: block; width: 100%; height: 100%; overflow: visible; }
.cv .cv-chart text { font: 500 11px var(--font); fill: var(--muted); }
.cv .cv-chart .cv-grid { stroke: var(--line); stroke-width: 1; }
.cv .cv-hero__foot { margin-top: 10px; font: 500 12px/17.4px var(--font); color: var(--muted); }
.cv .cv-needs { margin-top: 14px; display: grid; gap: 8px; }
.cv .cv-needs__item { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 14px; background: var(--card-2); box-shadow: inset 0 0 0 1px var(--line); transition: box-shadow .2s; }
.cv .cv-needs__item:hover { box-shadow: inset 0 0 0 1px var(--line-2); }
.cv .cv-needs__ic { width: 40px; height: 40px; flex: none; border-radius: 10px; display: grid; place-items: center; }
.cv .cv-needs__ic svg.cv-i { width: 17px; height: 17px; stroke-width: 1.9; }
.cv .cv-needs__ic--warn { background: color-mix(in srgb, var(--warn) var(--soft), var(--card)); color: var(--warn); }
.cv .cv-needs__ic--bad { background: color-mix(in srgb, var(--bad) var(--soft), var(--card)); color: var(--bad); }
.cv .cv-needs__ic--info { background: color-mix(in srgb, var(--info) var(--soft), var(--card)); color: var(--info); }
.cv .cv-needs__item b { display: block; font: 600 14px/20.3px var(--font); }
.cv .cv-needs__item small { display: block; margin-top: 1px; font: 500 12px/17.4px var(--font); color: var(--muted); }
.cv .cv-needs__go { margin-left: auto; color: var(--faint); }
.cv .cv-kpi { position: relative; display: grid; gap: 4px; padding: 16px 18px; border-radius: var(--r-card); color: var(--on-tile); }
.cv .cv-kpi--sage { background: var(--t-sage); }
.cv .cv-kpi--sand { background: var(--t-sand); }
.cv .cv-kpi--clay { background: var(--t-clay); }
.cv .cv-kpi--mist { background: var(--t-mist); }
.cv .cv-kpi__l { font: 600 12.5px/18.125px var(--font); }
.cv .cv-kpi__v { font: 600 22px/25.3px var(--font); letter-spacing: -0.22px; }
.cv .cv-kpi__s { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 26px; font: 600 12px/17.4px var(--font); }
.cv .cv-kpi__spark { width: 80px; height: 26px; flex: none; }
.cv .cv-kpi__spark path { fill: none; stroke: color-mix(in srgb, var(--on-tile) 62%, transparent); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.cv .cv-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--good); animation: cv-breathe 2.4s ease-out infinite; }
.cv .cv-feed { margin-top: 13px; }
.cv .cv-feed li { display: flex; align-items: center; gap: 12px; padding: 9px 0; }
.cv .cv-feed li + li { border-top: 1px solid var(--line); }
.cv .cv-chip { width: 38px; height: 22px; flex: none; border-radius: 6px; display: grid; place-items: center; font: 700 9.5px/13.775px var(--font); letter-spacing: 0.38px; }
.cv .cv-chip--amex { background: var(--amex-bg); color: var(--amex-ink); }
.cv .cv-chip--pay { background: var(--ink); color: var(--on-ink); }
.cv .cv-chip--mc { background: var(--accent-soft); color: var(--mc-ink); }
.cv .cv-chip--visa { background: var(--visa-bg); color: var(--visa-ink); }
.cv .cv-feed__who b { display: block; font: 600 14px/20.3px var(--font); }
.cv .cv-feed__who small { display: block; font: 500 12px/17.4px var(--font); color: var(--muted); }
.cv .cv-feed__amt { margin-left: auto; display: grid; justify-items: end; gap: 3px; font: 600 15px/21.75px var(--font); }
.cv .cv-pill { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 999px; font: 600 12px/17.4px var(--font); }
.cv .cv-pill--warn { color: var(--warn); background: color-mix(in srgb, var(--warn) var(--soft), var(--card)); }
.cv .cv-pill i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.cv .cv-feed__more { display: inline-flex; align-items: center; gap: 6px; margin-top: 9px; font: 600 14px/20.3px var(--font); color: var(--accent-text); }
.cv .cv-feed__more svg.cv-i { width: 13px; height: 13px; }
.cv .cv-bars { margin-top: 14px; display: grid; gap: 14px; }
.cv .cv-bars__top { display: flex; justify-content: space-between; gap: 10px; font: 600 13.5px/19.575px var(--font); }
.cv .cv-bars__top b { font-weight: 900; }
.cv .cv-bars__track { margin-top: 6px; height: 8px; border-radius: 99px; background: var(--well); overflow: hidden; }
.cv .cv-bars__fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 55%, var(--card)), var(--accent)); }
.cv .cv-money__big { margin-top: 12px; font: 600 26px/37.7px var(--font); letter-spacing: -0.52px; }
.cv .cv-money__sub { font: 500 12px/17.4px var(--font); color: var(--muted); }
.cv .cv-stack { margin-top: 17px; display: flex; gap: 4px; height: 11px; }
.cv .cv-stack span { border-radius: 4px; }
.cv .cv-legend { margin-top: 12px; display: grid; gap: 6.4px; }
.cv .cv-legend li { display: flex; align-items: center; gap: 9px; font: 500 13px/18.85px var(--font); color: var(--muted); }
.cv .cv-legend i { width: 9px; height: 9px; border-radius: 2px; }
.cv .cv-legend b { margin-left: auto; font: 600 13.5px/19.575px var(--font); color: var(--text); }
.cv .cv-batch { margin-top: 15px; display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 14px; background: var(--accent-soft); color: var(--accent-text); }
.cv .cv-batch b { display: block; font: 600 14px/20.3px var(--font); }
.cv .cv-batch small { display: block; font: 500 12px/17.4px var(--font); }
.cv .cv-batch svg.cv-i:last-child { margin-left: auto; }
.cv .cv-batch:hover { background: color-mix(in srgb, var(--accent) 18%, var(--card)); }
@keyframes cv-breathe { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--good) 45%, transparent); } 80%, to { box-shadow: 0 0 0 8px #0000; } }
@container cv (max-width: 980px) {
  .cv .cv-r3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cv .cv-r3 > .cv-ov__feed { grid-row: span 2; }
}
@container cv (max-width: 720px) {
  .cv .cv-head { display: block; margin-bottom: 16px; }
  .cv .cv-head__title { margin-top: 6px; }
  .cv .cv-head__sub { margin-top: 7px; }
  .cv .cv-head__actions { margin: 16px 0 0; }
  .cv .cv-card { padding: 16px; }
  .cv .cv-r1, .cv .cv-r3 { grid-template-columns: minmax(0, 1fr); }
  .cv .cv-r3 > .cv-ov__feed { grid-row: auto; }
  .cv .cv-r2 { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .cv .cv-hero__head { flex-wrap: wrap; }
  .cv .cv-hero__head > div:first-child { flex: 1 0 100%; }
  .cv .cv-hero__segs { margin: 0; }
  .cv .cv-chart { margin-top: 11px; }
  .cv .cv-needs { margin-top: 12px; }
  .cv .cv-needs__item { gap: 10px; }
  .cv .cv-kpi { padding: 14px 12px; }
  .cv .cv-kpi__v { font-size: 18px; line-height: 20.7px; letter-spacing: -0.18px; }
  .cv .cv-kpi__s { min-height: 0; }
  .cv .cv-kpi__spark { display: none; }
  .cv .cv-hero__big b { font-size: 30px; line-height: 31.5px; letter-spacing: -0.75px; }
}

/* ── la adaptación con MaKo (6/11/2026) ──────────────────────────────────────────────────────────────────────── */
/* Lo que la copia no tiene: el vacío, lo que no llegó y lo que se toca. */
.cv .cv-sin { opacity: .5; }
.cv .cv-vacio { margin-top: 14px; font: 500 13.5px/19.575px var(--font); color: var(--muted); }
.cv .cv-chart .cv-vacio { margin: 0; padding-top: 96px; text-align: center; }
.cv .cv-c-vacia .cv-vacio { max-width: 560px; }
.cv .cv-quieta { cursor: default; pointer-events: none; }
.cv [role='button'] { cursor: pointer; }
.cv .cv-card__h-seg, .cv .cv-card__link { margin-left: auto; }
.cv .cv-card__t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cv .cv-card__aside { white-space: nowrap; flex: none; }
/* Una fila que abre su detalle se pinta al pasar, como la fila de una tabla de Corvane (.table tbody tr:hover td). */
.cv .cv-feed li[role='button'] { margin: 0 -10px; padding-left: 10px; padding-right: 10px; border-radius: 12px; }
.cv .cv-feed li[role='button']:hover, .cv .cv-legend li[role='button']:hover { background: var(--card-2); }
.cv .cv-legend li[role='button'] { margin: 0 -8px; padding: 0 8px; border-radius: 8px; }
.cv .cv-bars li[role='button']:hover .cv-bars__top span { text-decoration: underline; text-underline-offset: 3px; }
.cv .cv-feed__who { min-width: 0; }
.cv .cv-feed__who b, .cv .cv-feed__who small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cv .cv-bars__top span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cv .cv-batch--ok { background: var(--well); color: var(--muted); }
.cv .cv-batch--ok:hover { background: var(--well); }
.cv .cv-hero__segs { flex-wrap: wrap; justify-content: flex-end; }
@container cv (max-width: 720px) {
  .cv .cv-cuerpo { margin: 0 -10px; }
  .cv .cv-hero__segs { justify-content: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  .cv .cv-dot { animation: none; }
  .cv .cv-seg__pill { transition: none; }
}
/* Cuatro números en una fila necesitan ~240 px cada uno (el texto y la línea): más angosto, de a dos. Y «Quién llamó» con su selector
   necesita ~330 px: la fila de abajo pasa a dos columnas en el mismo ancho (la copia lo hace en su @media de 1180). */
@container cv (max-width: 980px) {
  .cv .cv-r2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  /* y el gráfico grande deja sus selectores abajo del número, como en el teléfono */
  .cv .cv-hero__head { flex-wrap: wrap; }
  .cv .cv-hero__head > div:first-child { flex: 1 0 100%; }
  .cv .cv-hero__segs { margin: 0; justify-content: flex-start; }
}
`;
