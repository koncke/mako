// =============================================================================
// automatizaciones-css — la hoja de estilos del DISEÑO de la hoja Automatizaciones: la copia de Noria, sólo de esta hoja
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco». Es docs/diseno/mockups-dashboard/automatizaciones-noria/noria.css (escrita desde lo MEDIDO del demo: valores.json, las
// capturas, los estados de los controles y el INFORME; nada del código de la tienda) con todo adentro de `.nor` y cada clase con el
// prefijo `nor-`, para no tocar nada del resto del Dashboard. Sin el armazón de Noria (la barra lateral, la de arriba y la del
// teléfono): en MaKo lo pone la app. La arma scratchpad/noria/armar-nor.py desde la hoja de la copia: se cambia la copia y se vuelve
// a armar.
//
// Lo que se suma a la copia, y es de la adaptación (automatizaciones-noria/mako.html): la página sin la barra lateral, el período en
// las migas, el ancho del medio (dos columnas), los vacíos, la pastilla de los fallos, las columnas y las filas que se abren, la caja
// de MaKo como un link y las casillas grises (ese día no mandó nada).
//
// ⚠️ LA LETRA ES URBANIST, como la de MaKo (app/globals.css la declara «Geist»): acá se llama «Noria Urbanist» con las MISMAS URL,
//    así el navegador no la baja dos veces y la hoja no depende de cómo se llame la letra de la app.
// ⚠️ ESTA HOJA ES SÓLO DE AUTOMATIZACIONES: otra hoja con diseño escribe la suya (la de su demo), no reusa ésta.
// ⚠️ EL TELÉFONO VA POR @container (el ancho del lienzo), no por el de la ventana, y lo de la adaptación va DESPUÉS de los
//    @container de la copia: dos reglas iguales las decide el orden (docs/hallazgos-templates-dashboard.md §18).
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.
// ⚠️ PALETA DOBLE (6/11/2026, Martín: «los que vienen en dark mode deben acompañar siempre el white mode si el usuario lo tiene así en MaKo»):
//    nace clara y, con data-tema="oscuro" en html, la regla de abajo de la raíz cambia las MISMAS variables. Todo color de acá
//    va por variable, así el cambio es de CSS puro y en vivo.
// =============================================================================

export const CSS_AUTOMATIZACIONES = `
@font-face { font-family: 'Noria Urbanist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/urbanist/v18/L0x-DF02iFML4hGCyMqrbS10ig.woff2) format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'Noria Urbanist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/urbanist/v18/L0x-DF02iFML4hGCyMqlbS0.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
.nor {
  container-type: inline-size; container-name: nor;
  --font: 'Noria Urbanist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --nor-fs-2xs: 11px; --nor-fs-xs: 12px; --nor-fs-sm: 12.5px; --nor-fs-md: 13.5px; --nor-fs-base: 14px; --nor-fs-lg: 15px; --nor-fs-xl: 17px;
  --bg: #eceee9; --glow-a: #d9ebe5; --glow-b: #efe6d2;
  --surface: #fbfcfa; --surface-2: #f3f5f1; --raised: #fff; --well: #14221e0e; --line: #14221e1a; --line-2: #14221e2e;
  --shadow: 0 1px 2px #14221e0d, 0 14px 32px -22px #14221e47;
  --shadow-pop: 0 26px 60px -18px #0e1a1757, 0 2px 6px #0e1a1714;
  --shadow-seg: 0 1px 2px #14221e14, 0 4px 10px -4px #14221e2e;
  --grid: #14221e1f; --rail: #14221e09; --rail-line: #14221e24; --rail-hover: #14221e12; --q0: #14221e0c;
  --on-text: #fff; --on-text-dim: #e3eeeacc; --look-bg: #f2ece7;
  --av-mint: #b6e6dc; --av-rose: #f3c6d2; --av-sand: #f0d9a4; --av-sky: #c4e2f2; --av-peach: #f6d1bd; --av-ink: #11201c;
  --ap-bw-bg: #dce8f4; --ap-bw-bd: #c2d6ec; --ap-bw-fg: #295b91; --ap-dv-bg: #f6e0d6; --ap-dv-bd: #eec7b7; --ap-dv-fg: #9d4e2c;
  --ap-oi-bg: #f2e8cf; --ap-oi-bd: #e7d4a6; --ap-oi-fg: #886620; --ap-pw-bg: #e5e8e7; --ap-pw-bd: #cfd4d3; --ap-pw-fg: #475155;
  --text: #121a17; --muted: #56615c; --faint: #67716c;
  --primary: #0b6b5f; --on-primary: #effcf8; --primary-soft: #0b6b5f1f;
  --side: #10201c; --on-side: #e3eeea; --side-dim: #e3eeea99; --side-hover: #ffffff0f; --side-pill: #e8b54d; --on-side-pill: #241803;
  --good: #1a6e3c; --good-c: #2f9a5a; --bad: #ab311f; --bad-c: #dd5a43; --info: #2a5fc4; --info-c: #3d78e0;
  --warn: #9a5f00; --warn-c: #d99a1e; --idle: #6b7671;
  --teal: #12917f; --brass: #c3922e; --sky: #3a83cf; --ocean: #1f7f99; --rose: #cf4f68; --lime: #5a9a2e; --slate: #66747a; --coral: #e0703f;
  --r-card: 22px; --r-tile: 14px; --gap: 16px; --side-w: 256px;
  --gutter: clamp(16px, 1.8vw, 28px);
  --ease: cubic-bezier(.2, .8, .2, 1);
  position: relative; isolation: isolate; color: var(--text); font: 500 var(--nor-fs-base)/1.45 var(--font); -webkit-font-smoothing: antialiased;
  background: radial-gradient(60% 50% at 0% 0%, var(--glow-a) 0%, color-mix(in srgb, var(--glow-a) 0%, transparent) 70%), radial-gradient(50% 45% at 100% 0%, var(--glow-b) 0%, color-mix(in srgb, var(--glow-b) 0%, transparent) 70%), var(--bg);
}
/* Modo oscuro de MaKo: superficies que suben de luminosidad, líneas opacas a dos escalones del fondo, series con el mismo tono. */
.nor:where([data-tema="oscuro"] *) {
  --bg: #0f1312; --glow-a: #123029; --glow-b: #2b2310;
  --surface: #171c1a; --surface-2: #1e2422; --raised: #262d2a; --well: #232a28; --line: #2b3330; --line-2: #3a4541;
  --shadow: 0 1px 2px #0008, 0 14px 32px -22px #000c;
  --shadow-pop: 0 26px 60px -18px #000c, 0 2px 6px #00000080;
  --shadow-seg: 0 1px 2px #0008, 0 4px 10px -4px #000a;
  --text: #ededeb; --muted: #a9b3ae; --faint: #8e9893;
  --primary: #3dbfa9; --on-primary: #04211c; --primary-soft: #3dbfa933;
  --good: #6fd696; --bad: #f19482; --info: #85abf3; --warn: #e5ac45; --idle: #8a948f;
  --grid: #2b3330; --rail: #1e2522; --rail-line: #323b37; --rail-hover: #252d2a; --q0: #232a28;
  --on-text: #121a17; --on-text-dim: #121a17b3; --look-bg: #2a1e1c;
  --av-mint: #1f4a42; --av-rose: #4a2832; --av-sand: #4a3e1c; --av-sky: #1f3a4a; --av-peach: #4a3022; --av-ink: #e8efec;
  --ap-bw-bg: #1d2a3a; --ap-bw-bd: #2c4057; --ap-bw-fg: #9cc2ef; --ap-dv-bg: #3a2a22; --ap-dv-bd: #55392c; --ap-dv-fg: #f0a98a;
  --ap-oi-bg: #38301a; --ap-oi-bd: #52461f; --ap-oi-fg: #e4c06a; --ap-pw-bg: #272d2b; --ap-pw-bd: #38403d; --ap-pw-fg: #b2bcb8;
}
.nor *, .nor *::before, .nor *::after { box-sizing: border-box; }
.nor button { font: inherit; color: inherit; cursor: pointer; }
.nor a { color: inherit; text-decoration: none; }
.nor svg.nor-i { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.nor .nor-num { font-variant-numeric: tabular-nums; }
.nor :focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

/* ── la copia ──────────────────────────────────────────────────────────────────────────────── */
.nor * { box-sizing: border-box; }
.nor .nor-ibtn { width: 44px; height: 44px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface); display: grid; place-items: center; padding: 0; transition: background-color .15s; }
.nor .nor-ibtn:hover { background: var(--well); }
.nor .nor-av { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; flex: none; font-size: 12.5px; font-weight: 600; letter-spacing: .125px; color: var(--av-ink); }
.nor .nor-av--mint { background: var(--av-mint); }
.nor .nor-av--rose { background: var(--av-rose); }
.nor .nor-av--sand { background: var(--av-sand); }
.nor .nor-av--sky { background: var(--av-sky); }
.nor .nor-av--peach { background: var(--av-peach); }
@keyframes nor-breathe { 0%, to { box-shadow: 0 0 0 0 color-mix(in srgb, var(--info-c) 45%, transparent); } 50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--info-c) 0%, transparent); } }
.nor .nor-btn { height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 19px; border-radius: 14px; border: 1px solid transparent; font-size: var(--nor-fs-md); font-weight: 600; white-space: nowrap; transition: background-color .15s, filter .15s; }
.nor .nor-btn--primary { background: var(--primary); color: var(--on-primary); box-shadow: 0 12px 22px -12px color-mix(in srgb, var(--primary) 70%, transparent); }
.nor .nor-btn--primary:hover { filter: brightness(1.1); }
.nor .nor-btn--ghost { background: var(--surface); border-color: var(--line); color: var(--text); }
.nor .nor-btn--ghost:hover { background: var(--surface-2); }
.nor .nor-btn--xs { height: 30px; padding: 0 12px; border-radius: 10px; font-size: var(--nor-fs-sm); }
.nor .nor-btn--sm { height: 36px; padding: 0 16px; border-radius: 12px; font-size: var(--nor-fs-sm); }
.nor .nor-btn--soft { background: var(--primary-soft); color: var(--primary); }
.nor .nor-btn--soft:hover { background: color-mix(in srgb, var(--primary) 20%, transparent); }
.nor .nor-btn svg { width: 16px; height: 16px; }
.nor .nor-ov__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin: 20px 0 20px; }
.nor .nor-crumbs { display: flex; align-items: center; gap: 6px; font-size: var(--nor-fs-sm); font-weight: 500; color: var(--muted); line-height: 18.125px; }
.nor .nor-crumbs a:hover { color: var(--text); text-decoration: underline; text-underline-offset: 3px; }
.nor .nor-crumbs svg { width: 12px; height: 12px; }
.nor .nor-ov__h1 { margin: 5px 0 7px; font-size: clamp(28px, 2.6vw, 44px); font-weight: 600; line-height: 1.04; letter-spacing: -.025em; }
.nor .nor-ov__lede { margin: 0; font-size: var(--nor-fs-base); color: var(--muted); line-height: 20.3px; }
.nor .nor-ov__lede b { color: var(--text); font-weight: 600; }
.nor .nor-ov__acts { display: flex; gap: 8px; }
.nor .nor-ov { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--gap); align-items: stretch; }
.nor .nor-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); padding: 18px 20px 20px; min-width: 0; }
.nor .nor-ov__pulse { grid-column: span 2; }
.nor .nor-ov__flows { grid-column: span 2; }
.nor .nor-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.nor .nor-card__t { margin: 0; font-size: var(--nor-fs-lg); font-weight: 600; line-height: 19.5px; letter-spacing: -.075px; display: flex; align-items: center; gap: 10px; }
.nor .nor-card__s { margin: 2px 0 0; font-size: var(--nor-fs-sm); color: var(--muted); line-height: 18.125px; }
.nor .nor-card__tools { display: flex; align-items: center; gap: 9px; }
.nor .nor-cnt { min-width: 23px; height: 23px; border-radius: 7px; display: grid; place-items: center; background: var(--bad-c); color: #fff; font-size: 12.5px; font-weight: 700; padding: 0 6px; }
.nor .nor-seg { display: inline-flex; padding: 4px; border-radius: 13px; background: var(--surface-2); gap: 2px; height: 37px; }
.nor .nor-seg__btn { border: 0; background: transparent; height: 29px; padding: 0 12px; border-radius: 10px; font-size: var(--nor-fs-sm); font-weight: 700; color: var(--muted); transition: color .15s; position: relative; }
.nor .nor-seg__btn:hover { color: var(--text); }
.nor .nor-seg__btn.nor-is-on { background: var(--raised); color: var(--text); box-shadow: var(--shadow-seg); }
.nor .nor-ibtn--sm { width: 32px; height: 32px; border-radius: 10px; margin-top: 3px; }
.nor .nor-ibtn--sm svg { width: 15px; height: 15px; }
.nor .nor-kpis { margin-top: 16px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); background: var(--surface-2); border: 1px solid var(--line); border-radius: 16px; min-height: 118px; }
.nor .nor-kpi { padding: 12px 14px 12px; display: flex; flex-direction: column; position: relative; min-width: 0; }
.nor .nor-kpi + .nor-kpi { border-left: 1px solid var(--line); }
.nor .nor-kpi__k { font-size: var(--nor-fs-sm); font-weight: 600; color: var(--muted); line-height: 18.125px; }
.nor .nor-kpi__v { font-size: 22px; font-weight: 900; line-height: 24.2px; letter-spacing: -.22px; }
.nor .nor-kpi__v small { font-size: 15px; font-weight: 600; color: var(--muted); margin-left: 1px; }
.nor .nor-kpi--saved .nor-kpi__v { color: var(--primary); }
.nor .nor-kpi__flash { position: absolute; top: 25px; left: 66px; font-size: 14px; font-weight: 600; color: var(--good); line-height: 20.3px; }
.nor .nor-kpi__n { font-size: var(--nor-fs-xs); color: var(--muted); line-height: 17.4px; margin-top: auto; }
.nor .nor-kpi__n b { color: var(--text); font-weight: 700; }
.nor .nor-kpi--med .nor-kpi__v { margin-top: 8px; }
.nor .nor-kpi--med .nor-kpi__n { margin-top: 18px; }
.nor .nor-kpi--saved .nor-kpi__v { margin-top: 4px; }
.nor .nor-kpi--saved .nor-kpi__n { margin-top: 8px; }
.nor .nor-chip { align-self: flex-start; display: inline-flex; align-items: center; gap: 5px; height: 21px; padding: 0 8px; border-radius: 7px; font-size: 11px; font-weight: 700; margin: 4px 0 8px; }
.nor .nor-chip svg { width: 10px; height: 10px; stroke-width: 2; }
.nor .nor-chip--up { background: #2f9a5a29; color: var(--good); }
.nor .nor-chip--down { background: #dd5a4329; color: var(--bad); }
.nor .nor-pulse { position: relative; margin-top: 21px; height: 367px; }
.nor .nor-pulse__plot { position: absolute; left: 39px; right: 7px; top: 18px; height: 298px; }
.nor .nor-pulse__grid { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--grid); }
.nor .nor-pulse__y { position: absolute; left: -39px; width: 30px; text-align: right; font-size: var(--nor-fs-2xs); font-weight: 600; color: var(--muted); line-height: 15.95px; transform: translateY(-50%); }
.nor .nor-pulse__cols { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(24, 1fr); }
.nor .nor-pcol { position: relative; }
.nor .nor-pcol__rail { position: absolute; left: 50%; width: 16px; margin-left: -8px; top: 0; bottom: 0; border-radius: 8px; background: var(--rail); }
.nor .nor-pcol--fut .nor-pcol__rail { background: transparent; border-left: 1px dashed var(--rail-line); border-right: 1px dashed var(--rail-line); border-radius: 0; }
.nor .nor-pcol__ok, .nor .nor-pcol__ko { position: absolute; left: 50%; width: 16px; margin-left: -8px; border-radius: 7px; transform-origin: bottom; }
.nor .nor-pcol__ok { bottom: 0; background: var(--primary); }
.nor .nor-pcol__ko { background: var(--bad-c); }
.nor .nor-pulse__x { position: absolute; top: calc(100% + 8px); font-size: var(--nor-fs-2xs); font-weight: 600; color: var(--muted); transform: translateX(-50%); line-height: 15.95px; }
.nor .nor-pulse__line { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.nor .nor-pulse__line path { fill: none; stroke: var(--brass); stroke-width: 2; stroke-dasharray: 6 5; stroke-linecap: round; }
.nor .nor-pulse__now { position: absolute; top: -12px; bottom: 0; width: 1.5px; margin-left: -.75px; background: repeating-linear-gradient(to bottom, var(--text) 0 1.5px, transparent 1.5px 5px); }
.nor .nor-pulse__now span { position: absolute; top: -9px; left: .75px; transform: translateX(-50%); height: 19px; padding: 0 7px; border-radius: 99px; background: var(--text); color: var(--on-text); font-size: 11px; font-weight: 700; line-height: 19px; }
.nor .nor-pulse__now i { position: absolute; bottom: -5px; left: -5px; width: 9px; height: 9px; border-radius: 50%; background: var(--text); }
.nor .nor-legend { position: absolute; left: 0; bottom: 0; display: flex; gap: 15px; font-size: var(--nor-fs-sm); color: var(--muted); line-height: 18.125px; }
.nor .nor-legend span { display: inline-flex; align-items: center; gap: 7px; }
.nor .nor-legend i { width: 10px; height: 10px; border-radius: 3px; }
.nor .nor-legend i.nor-l { width: 10px; height: 2px; border-radius: 2px; background: var(--brass) !important; }
.nor .nor-run { margin-top: 14px; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.nor .nor-run__t { font-size: 14px; font-weight: 600; letter-spacing: -.28px; line-height: 20.3px; }
.nor .nor-run__id { font-size: var(--nor-fs-sm); color: var(--muted); letter-spacing: -.125px; }
.nor .nor-pill { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 9px; font-size: var(--nor-fs-sm); font-weight: 700; white-space: nowrap; }
.nor .nor-pill::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.nor .nor-pill--ok { background: #2f9a5a24; color: var(--good); }
.nor .nor-pill--run { background: #3d78e024; color: var(--info); }
.nor .nor-steps { list-style: none; margin: 17px 0 0; padding: 0; position: relative; }
.nor .nor-step { display: grid; grid-template-columns: 28px 28px 1fr auto; column-gap: 10px; align-items: center; height: 28px; margin-bottom: 20px; position: relative; }
.nor .nor-step:last-child { margin-bottom: 0; }
.nor .nor-step::before { content: ''; position: absolute; left: 13px; top: 28px; height: 20px; width: 2px; background: var(--primary); }
.nor .nor-step:last-child::before { display: none; }
.nor .nor-step__ck { width: 28px; height: 28px; border-radius: 50%; background: var(--primary); color: var(--on-primary); display: grid; place-items: center; }
.nor .nor-step__ck svg { width: 13px; height: 13px; stroke-width: 2.4; }
.nor .nor-step--doing .nor-step__ck { background: var(--info-c); box-shadow: inset 0 0 0 3px var(--surface), 0 0 0 1px var(--info-c); }
.nor .nor-step--todo .nor-step__ck { background: transparent; border: 1.5px solid var(--line-2); }
.nor .nor-ap { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-size: 11px; font-weight: 600; letter-spacing: -.22px; border: 1px solid; }
.nor .nor-ap--bw { background: var(--ap-bw-bg); border-color: var(--ap-bw-bd); color: var(--ap-bw-fg); }
.nor .nor-ap--dv { background: var(--ap-dv-bg); border-color: var(--ap-dv-bd); color: var(--ap-dv-fg); }
.nor .nor-ap--oi { background: var(--ap-oi-bg); border-color: var(--ap-oi-bd); color: var(--ap-oi-fg); }
.nor .nor-ap--pw { background: var(--ap-pw-bg); border-color: var(--ap-pw-bd); color: var(--ap-pw-fg); }
.nor .nor-ap--lg { width: 36px; height: 36px; border-radius: 10px; font-size: 12px; letter-spacing: -.24px; }
.nor .nor-step__t { min-width: 0; padding-left: 0; }
.nor .nor-step__t b { display: block; font-size: 13.5px; font-weight: 700; line-height: 16.875px; }
.nor .nor-step__t span { display: block; font-size: var(--nor-fs-xs); color: var(--muted); line-height: 16px; }
.nor .nor-step__ms { font-size: 12px; color: var(--muted); letter-spacing: -.12px; }
.nor .nor-fin { margin-top: 24px; padding: 0 12px; height: 37px; display: flex; align-items: center; border-radius: 12px; background: var(--surface-2); font-size: var(--nor-fs-sm); color: var(--muted); }
.nor .nor-fin b { color: var(--text); font-weight: 700; }
.nor .nor-lbl { margin: 17px 0 5px; font-size: 11px; font-weight: 600; letter-spacing: .88px; text-transform: uppercase; color: var(--muted); }
.nor .nor-jf { list-style: none; margin: 0; padding: 0; }
.nor .nor-jf a { display: grid; grid-template-columns: 74px 1fr auto; column-gap: 14px; align-items: center; height: 37px; box-sizing: border-box; border-top: 1px solid var(--line); font-size: var(--nor-fs-sm); }
.nor .nor-jf li:first-child a { border-top: 0; height: 36px; }
.nor .nor-jf a:hover .nor-jf__n { text-decoration: underline; text-underline-offset: 3px; }
.nor .nor-jf .nor-pill { height: 22px; border-radius: 8px; margin-left: 4px; font-size: 12px; justify-content: flex-start; width: 74px; padding: 0 9px; }
.nor .nor-jf__t { color: var(--muted); font-size: 12.5px; }
.nor .nor-look { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 8px; }
.nor .nor-look__row > div { min-width: 0; }
.nor .nor-look__row { display: grid; grid-template-columns: 34px 1fr; gap: 8px 10px; padding: 10px; border-radius: 14px; background: var(--look-bg); border: 1px solid #dd5a432e; min-height: 117px; }
.nor .nor-look__ic { width: 34px; height: 34px; border-radius: 10px; background: #dd5a4321; color: var(--bad); display: grid; place-items: center; }
.nor .nor-look__ic svg { width: 17px; height: 17px; }
.nor .nor-look__t { font-size: 14px; font-weight: 600; line-height: 19px; }
.nor .nor-look__e { font-size: 12.5px; color: var(--muted); line-height: 16.875px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nor .nor-look__m { font-size: 12px; color: var(--muted); line-height: 16.2px; margin-top: 2px; }
.nor .nor-look__acts { display: flex; gap: 6px; margin-top: 10px; }
.nor .nor-look__ok { width: 32px; height: 30px; border-radius: 10px; border: 1px solid var(--line-2); background: transparent; display: grid; place-items: center; padding: 0; }
.nor .nor-look__ok:hover { background: var(--well); }
.nor .nor-look__ok svg { width: 13px; height: 13px; }
.nor .nor-more { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 12.5px; font-weight: 600; color: var(--primary); }
.nor .nor-more svg { width: 13px; height: 13px; }
.nor .nor-rel { margin-top: 12px; display: grid; }
.nor .nor-rel__row { display: grid; grid-template-columns: minmax(0, 1fr) 138px 52px; align-items: center; column-gap: 12px; height: 33px; margin: 0 -8px; padding: 0 8px; border-radius: 9px; }
.nor .nor-rel__n { font-size: 13.5px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nor .nor-rel__d { display: grid; grid-template-columns: repeat(14, 1fr); gap: 2.5px; height: 18px; }
.nor .nor-rel__d i { border-radius: 3px; }
.nor .nor-rel__p { text-align: right; font-size: 13.5px; font-weight: 500; }
.nor .nor-q1 { background: #2f9a5a; }
.nor .nor-q2 { background: #8fcaa6; }
.nor .nor-q3 { background: #d99a1e; }
.nor .nor-q4 { background: #dd5a43; }
.nor .nor-q0 { background: var(--q0); }
.nor .nor-rel__leg { display: flex; gap: 14px; margin-top: 11px; font-size: 12px; font-weight: 600; color: var(--muted); }
.nor .nor-rel__leg span { display: inline-flex; align-items: center; gap: 6px; }
.nor .nor-rel__leg i { width: 10px; height: 10px; border-radius: 3px; }
.nor .nor-ask__ic { width: 30px; height: 30px; border-radius: 9px; background: var(--primary-soft); color: var(--primary); display: grid; place-items: center; }
.nor .nor-ask__ic svg { width: 15px; height: 15px; }
.nor .nor-ask { margin-top: 17px; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--line-2); border-radius: 16px; padding: 10px 10px 8px 14px; height: 125px; background: var(--surface); transition: border-color .15s, box-shadow .15s; }
.nor .nor-ask:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent); }
.nor .nor-ask textarea { border: 0; outline: 0; resize: none; background: transparent; font: 500 14px/20.3px var(--font); color: var(--text); padding: 8px 2px 0; }
.nor .nor-ask textarea::placeholder { color: var(--faint); }
.nor .nor-ask__foot { display: flex; align-items: center; justify-content: space-between; }
.nor .nor-ask__hint { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
.nor .nor-ask__hint kbd { width: 22px; height: 18px; display: grid; place-items: center; border: 1px solid var(--line-2); border-radius: 6px; background: var(--surface-2); font-size: 10px; }
.nor .nor-sugs { display: grid; gap: 7px; margin-top: 12px; }
.nor .nor-ask__sug { display: flex; align-items: center; gap: 12px; text-align: left; min-height: 38px; padding: 9px 12px 9px 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-2); font-size: var(--nor-fs-sm); font-weight: 600; line-height: 18px; transition: border-color .15s, color .15s; }
.nor .nor-ask__sug:hover { border-color: color-mix(in srgb, var(--primary) 45%, transparent); color: var(--primary); }
.nor .nor-ask__sug svg { width: 14px; height: 14px; color: var(--brass); }
.nor .nor-tbl-wrap { margin: 11px -8px 0 -8px; overflow-x: auto; }
.nor .nor-table { width: 748px; table-layout: fixed; border-collapse: collapse; font-size: var(--nor-fs-sm); }
.nor .nor-table col.nor-w-fl { width: 281px; }
.nor .nor-table col.nor-w-st { width: 74px; }
.nor .nor-table col.nor-w-sp { width: 130px; }
.nor .nor-table col.nor-w-ru { width: 69px; }
.nor .nor-table col.nor-w-pc { width: 80px; }
.nor .nor-table col.nor-w-ag { width: 73px; }
.nor .nor-table col.nor-w-dt { width: 41px; }
.nor .nor-fl > span:last-child { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nor .nor-table th { text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); padding: 10px 10px; border-bottom: 1px solid var(--line); white-space: nowrap; }
.nor .nor-table th.nor-r, .nor .nor-table td.nor-r { text-align: right; }
.nor .nor-table td { padding: 0 10px; height: 62px; border-bottom: 1px solid var(--line); vertical-align: middle; }
.nor .nor-table tbody tr:last-child td { border-bottom: 0; }
.nor .nor-table tbody tr { transition: background-color .15s; cursor: pointer; }
.nor .nor-table tbody tr:hover { background: var(--surface-2); }
.nor .nor-fl { display: flex; align-items: center; gap: 12px; }
.nor .nor-fl b { display: block; font-size: 13.5px; font-weight: 700; line-height: 19.575px; }
.nor .nor-fl b + span { display: block; font-size: 13px; color: var(--muted); line-height: 19px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nor .nor-pill--live { height: 26px; }
.nor .nor-spark { width: 110px; height: 26px; display: block; }
.nor .nor-spark path.nor-a { fill: color-mix(in srgb, var(--primary) 11%, transparent); stroke: none; }
.nor .nor-spark path.nor-l { fill: none; stroke: var(--primary); stroke-width: 1.6; }
.nor .nor-tnum { font-size: 13.5px; font-weight: 600; }
.nor .nor-tpct { font-size: 13.5px; }
.nor .nor-tpct.nor-is-bad { color: var(--bad); font-weight: 600; }
.nor .nor-tago { font-size: 13.5px; color: var(--muted); line-height: 19.575px; width: 56px; }
.nor .nor-tdots { color: var(--text); }
.nor .nor-feed { list-style: none; margin: 21px 0 0; padding: 0; }
.nor .nor-feed__item { display: grid; grid-template-columns: 32px 1fr; gap: 12px; padding: 10px 0 11px; border-top: 1px solid var(--line); }
.nor .nor-feed__item:first-child { border-top: 0; padding-top: 2px; }
.nor .nor-feed__item .nor-av { width: 32px; height: 32px; font-size: 11px; letter-spacing: .11px; margin-top: 2px; }
.nor .nor-feed__item p { margin: 0; font-size: 13.5px; font-weight: 700; line-height: 18.9px; }
.nor .nor-feed__item p a:hover { text-decoration: underline; text-underline-offset: 2px; }
.nor .nor-feed__item time { display: block; font-size: 12px; color: var(--muted); margin-top: 2px; line-height: 16px; }

@container nor (max-width: 700px) {
  .nor .nor-ov__head { flex-direction: column; align-items: stretch; margin: 16px 0 16px; gap: 14px; }
  .nor .nor-ov__acts { display: grid; grid-template-columns: 1fr 1fr; }
  .nor .nor-ov__acts .nor-btn { height: 46px; }
  .nor .nor-ov { grid-template-columns: minmax(0, 1fr); }
  .nor .nor-ov__pulse, .nor .nor-ov__flows { grid-column: auto; }
  .nor .nor-card { padding: 16px 16px 20px; }
  .nor .nor-card__head { flex-wrap: wrap; }
  .nor .nor-ov__pulse .nor-card__tools { width: 100%; }
  .nor .nor-ov__pulse .nor-card__expand { display: none; }
  .nor .nor-ov__h1 { margin-bottom: 4px; }
  .nor .nor-kpis { grid-template-columns: 1fr 1fr; }
  .nor .nor-kpi__v { font-size: 18px; line-height: 19.8px; letter-spacing: -.18px; }
  .nor .nor-kpi--med .nor-kpi__v, .nor .nor-kpi--saved .nor-kpi__v { margin-top: 0; }
  .nor .nor-kpi--med .nor-kpi__n, .nor .nor-kpi--saved .nor-kpi__n { margin-top: 4px; }
  .nor .nor-kpi__flash { display: none; }
  .nor .nor-chip { margin: 2px 0 8px; }
  .nor .nor-pulse { height: 265px; }
  .nor .nor-pulse__plot { height: 196px; }
  .nor .nor-kpi:nth-child(3) { border-left: 0; }
  .nor .nor-kpi:nth-child(n+3) { border-top: 1px solid var(--line); }
  .nor .nor-pulse__plot { left: 31px; }
  .nor .nor-pulse__y { left: -31px; width: 22px; }
  .nor .nor-pcol__rail, .nor .nor-pcol__ok, .nor .nor-pcol__ko { width: 7px; margin-left: -3.5px; border-radius: 4px; }
  .nor .nor-pulse__x:nth-of-type(even) { display: none; }
  .nor .nor-table thead { display: none; }
  .nor .nor-tbl-wrap { margin: 8px 0 0; overflow: visible; }
  .nor .nor-table, .nor .nor-table tbody { display: block; width: auto; table-layout: auto; }
  .nor .nor-table colgroup { display: none; }
  .nor .nor-table tr { display: grid; grid-template-columns: 36px 1fr auto; grid-template-areas: 'av fl dots' '. st pc'; column-gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--line); }
  .nor .nor-table td { display: block; height: auto; padding: 0; border: 0; }
  .nor .nor-table td.nor-c-fl { grid-column: 1 / 3; min-width: 0; overflow: hidden; }
  .nor .nor-table td.nor-c-sp, .nor .nor-table td.nor-c-runs, .nor .nor-table td.nor-c-ago { display: none; }
  .nor .nor-table td.nor-c-st { grid-area: st; justify-self: end; align-self: end; }
  .nor .nor-table td.nor-c-pc { grid-area: pc; text-align: right; }
  .nor .nor-table td.nor-c-pc::before { content: 'Succeeded'; display: block; font-size: 12.5px; color: var(--muted); }
  .nor .nor-table td.nor-c-dots { grid-area: dots; }
}
@media (hover: none) {
  .nor .nor-ibtn:hover, .nor .nor-btn--ghost:hover, .nor .nor-table tbody tr:hover { background: 0 0; }
  .nor .nor-btn--ghost:hover { background: var(--surface); }
  .nor .nor-btn--primary:hover { filter: none; }
  .nor .nor-ibtn:active { background: var(--well); }
}

/* ── lo de la adaptación (DESPUÉS de los @container de la copia: los pisa en el mismo ancho) ──────────── */
.nor .nor-pagina { position: relative; z-index: 1; padding: 22px 24px 44px; }
.nor .nor-ov__head { margin-top: 0; }
.nor .nor-crumbs span { white-space: nowrap; }
.nor .nor-crumbs span:first-child::first-letter { text-transform: uppercase; }
.nor .nor-quieta { opacity: .72; pointer-events: none; }
.nor .nor-vacio { flex: 1; display: grid; place-content: center; gap: 4px; padding: 28px 16px; text-align: center; font-size: 13px; line-height: 1.45; color: var(--muted); }
.nor .nor-vacio b { display: block; color: var(--text); font-weight: 600; }
.nor .nor-card { display: flex; flex-direction: column; }
.nor .nor-fila { cursor: pointer; }
.nor .nor-fila:focus-visible { outline-offset: -2px; }
.nor .nor-pill--bad { background: #dd5a4324; color: var(--bad); }
.nor .nor-pill--idle { background: var(--well); color: var(--muted); }
.nor .nor-pill--bad::before, .nor .nor-pill--idle::before { background: currentColor; }
.nor .nor-pcol { border: 0; background: none; padding: 0; margin: 0; display: block; height: 100%; cursor: default; }
.nor .nor-pcol.nor-fila { cursor: pointer; }
.nor .nor-pcol.nor-fila:hover .nor-pcol__rail { background: var(--rail-hover); }
.nor .nor-pulse__plot.nor-con-marca .nor-pcol:not(.nor-is-on) .nor-pcol__ok, .nor .nor-pulse__plot.nor-con-marca .nor-pcol:not(.nor-is-on) .nor-pcol__ko { opacity: .55; }
.nor .nor-pcol__ok, .nor .nor-pcol__ko { transition: opacity .15s; }
.nor .nor-pulse__tip { position: absolute; z-index: 2; transform: translateX(-50%); white-space: nowrap; padding: 6px 10px; border-radius: 10px; background: var(--text); color: var(--on-text); font-size: 12px; font-weight: 600; line-height: 16px; pointer-events: none; box-shadow: var(--shadow-pop); }
.nor .nor-pulse__tip span { display: block; font-weight: 500; color: var(--on-text-dim); }
.nor .nor-step--todo .nor-step__ck svg { display: none; }
.nor .nor-step--todo::before { background: var(--line-2); }
.nor .nor-ap svg { width: 14px; height: 14px; stroke-width: 1.8; }
.nor .nor-step__n { font-size: 13.5px; font-weight: 700; color: var(--text); letter-spacing: -.12px; }
.nor .nor-jf a .nor-pill { justify-content: flex-start; }
.nor .nor-jf__t { font-weight: 600; }
.nor .nor-look__row.nor-fila:hover { border-color: #dd5a4352; }
.nor .nor-look__acts .nor-btn { text-decoration: none; }
.nor .nor-ok { display: grid; place-items: center; gap: 6px; padding: 26px 12px; border-radius: 14px; background: #2f9a5a14; border: 1px solid #2f9a5a29; text-align: center; color: var(--good); font-size: 13px; }
.nor .nor-ok b { color: var(--text); font-weight: 600; }
.nor .nor-rel__row.nor-fila:hover { background: var(--surface-2); }
.nor .nor-q0 { background: var(--q0); }
.nor .nor-rel__leg i.nor-q0 { box-shadow: inset 0 0 0 1px var(--line); }
.nor .nor-ask { text-decoration: none; cursor: pointer; }
.nor .nor-ask:hover { border-color: color-mix(in srgb, var(--primary) 45%, transparent); }
.nor .nor-ask__ph { padding: 8px 2px 0; font-size: 14px; line-height: 20.3px; color: var(--faint); }
.nor .nor-ask .nor-btn { pointer-events: none; }
.nor .nor-ask__sug { text-decoration: none; color: var(--text); }
.nor .nor-ask__sug b { font-weight: 700; }
.nor .nor-table { width: 100%; min-width: 760px; }
.nor .nor-table col.nor-w-fl { width: auto; }
.nor .nor-table col.nor-w-st { width: 112px; }
.nor .nor-table col.nor-w-ag { width: 96px; }
.nor .nor-table col.nor-w-dt { width: 36px; }
.nor .nor-table td.nor-c-go { color: var(--muted); }
.nor .nor-table td.nor-c-go svg { width: 15px; height: 15px; }
.nor .nor-table tbody tr:hover td.nor-c-go { color: var(--primary); }
.nor .nor-tpct.nor-sin, .nor .nor-tnum.nor-sin { color: var(--faint); font-weight: 500; }
.nor .nor-feed__item.nor-fila:hover p { text-decoration: underline; text-underline-offset: 2px; }
.nor .nor-feed__item p b { color: var(--primary); }
@container nor (max-width: 980px) {
  .nor .nor-ov { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .nor .nor-ov__pulse, .nor .nor-ov__flows { grid-column: span 2; }
}
@container nor (max-width: 700px) {
  .nor .nor-pagina { padding: 18px 14px 32px; }
  .nor .nor-ov { grid-template-columns: minmax(0, 1fr); }
  .nor .nor-ov__pulse, .nor .nor-ov__flows { grid-column: auto; }
  .nor .nor-ov__acts .nor-btn { min-width: 0; }
  .nor .nor-table { min-width: 0; }
  .nor .nor-table td.nor-c-pc::before { content: 'Salieron bien'; }
  .nor .nor-table td.nor-c-go { grid-area: dots; justify-self: end; }
  .nor .nor-table td.nor-c-resp { display: none; }
  .nor .nor-ov__pulse .nor-card__expand { display: none; }
}
@media (prefers-reduced-motion: reduce) { .nor *, .nor *::before, .nor *::after { transition: none !important; animation: none !important; } }
`;
