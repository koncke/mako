// =============================================================================
// curso-css — la hoja de estilos del DISEÑO de la hoja «Curso o comunidad»: la copia de Vitrea, sólo de esta hoja
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco». Es docs/diseno/mockups-dashboard/curso-vitrea/vitrea.css (escrita desde lo MEDIDO del demo: valores.json, las
// capturas a 1440 y 390 y el INFORME; nada del código de la tienda) con todo adentro de `.vit` y cada clase con el prefijo `vit-`,
// para no tocar nada del resto del Dashboard. Sin el armazón de Vitrea (la barra de arriba y la de la izquierda): en MaKo los
// pone la app. La arma scratchpad/vcu/armar-vcu.py desde la hoja de la copia: se cambia la copia y se vuelve a armar.
//
// Lo que se suma a la copia, y es de la adaptación (curso-vitrea/mako.html): los vacíos, la grilla sin «Recent activity» (MaKo no
// mide la actividad del equipo), la barra del avance en lugar de las estrellas, los nombres de los estados en lugar de los números
// del 1 al 5, los tramos de contacto (hasta cinco) en lugar de las cuatro etapas del tren, los rótulos del eje que pone la hoja, las
// filas que se abren y un paso intermedio entre 700 y 1000 px de ancho, que Vitrea no tiene.
//
// ⚠️ LA LETRA ES URBANIST, la de Vitrea: acá se llama «Vitrea Urbanist», con la URL de Google Fonts, así la hoja no depende de
//    cómo se llame la letra de la app.
// ⚠️ ESTA HOJA ES SÓLO DE «CURSO O COMUNIDAD»: otra hoja con diseño escribe la suya (la de su demo), no reusa ésta.
// ⚠️ EL TELÉFONO VA POR @container (el ancho del lienzo), no por el de la ventana, y lo de la adaptación va DESPUÉS de los
//    @container de la copia: dos reglas iguales las decide el orden (docs/hallazgos-templates-dashboard.md §18).
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.
// =============================================================================

export const CSS_CURSO = `
@font-face { font-family: 'Vitrea Urbanist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/urbanist/v18/L0x-DF02iFML4hGCyMqlbS0.woff2) format('woff2'); }
.vit {
  container-type: inline-size; container-name: vit;
  --font: 'Vitrea Urbanist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --bg: #111113; --glass: #1e1e226b; --glass-chrome: #2020245c; --glass-thick: #1c1c20db; --glass-solid: #1d1d21;
  --surface-2: #ffffff14; --well: #c8c8d71a; --line: #ffffff1a; --line-2: #ffffff2e;
  --lens: linear-gradient(180deg, #ffffff52, #ffffff1f);
  --lens-shadow: inset 0 1px 1px #ffffff8c, inset 0 -2px 5px #ffffff1f, inset 0 0 0 .5px #ffffff4d, 0 8px 18px -8px #0009;
  --card-shadow: inset 0 1px 1px #ffffff4d, inset 0 -1px 1px #ffffff1a, inset 3px 4px 12px -6px #ffffff38, inset -4px -6px 14px -8px #ffffff1f, inset 0 -16px 28px -18px #00000073, 0 1px 2px #0000004d, 0 24px 48px -22px #000000bf;
  --text: #f6f8fc; --muted: #c9d1de; --faint: #7d8696;
  --accent: #7aaef0; --on-accent: #071a33; --accent-text: #a9cdfc; --accent-line: #8dbcf6; --ink-mark: #9aa1ad;
  --good: #8fdca8; --good-fill: #5fc483; --warn: #f3cd7e; --warn-fill: #e4b759; --bad: #f6a59c; --bad-fill: #e98278;
  --blue: linear-gradient(160deg, #354a6a, #283953); --on-blue: #eef4fd;
  --teal: linear-gradient(160deg, #31574f, #24433d); --on-teal: #ecf8f5;
  --orange: linear-gradient(160deg, #66503a, #4e3d2b); --on-orange: #fdf3e6;
  --coral: linear-gradient(160deg, #6a423d, #52322e); --on-coral: #fdeeeb;
  --green: linear-gradient(160deg, #375741, #29432f); --on-green: #eef9f1;
  --ink: linear-gradient(160deg, #3b3e46, #2c2e34); --on-ink: #f1f2f5;
  --ico-blue: linear-gradient(160deg, #d2e4ff, #9fc6f8); --ico-teal: linear-gradient(160deg, #c8efe8, #8fd8cc);
  --ico-orange: linear-gradient(160deg, #ffe3bf, #ffc286); --ico-coral: linear-gradient(160deg, #ffd5cd, #ffa99b);
  --ico-green: linear-gradient(160deg, #d0efd9, #98daad); --ico-ink: linear-gradient(160deg, #e6e8ec, #bcc0c8);
  --r-card: 26px; --r-tile: 22px; --gap: 16px;
  --ease: cubic-bezier(.2, .8, .2, 1);
  position: relative; isolation: isolate; overflow: clip; color: var(--text); font: 500 14px/1.45 var(--font); -webkit-font-smoothing: antialiased;
  background: var(--bg);
}
.vit *, .vit *::before, .vit *::after { box-sizing: border-box; }
.vit button { font: inherit; color: inherit; cursor: pointer; }
.vit a { color: inherit; text-decoration: none; }
.vit h1, .vit h2, .vit h3, .vit p, .vit ul { margin: 0; }
.vit ul { padding: 0; list-style: none; }
.vit svg.vit-i { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.vit :focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px; }

/* ── la copia ──────────────────────────────────────────────────────────────────────────────── */
.vit * { box-sizing: border-box; }
.vit .vit-num { font-variant-numeric: tabular-nums; }
.vit .vit-fondo { position: absolute; inset: 0 0 auto 0; height: 900px; overflow: hidden; pointer-events: none; background: radial-gradient(120% 90% at 30% 10%, #2c2c31 0%, #232327 45%, #161618 100%); }
.vit .vit-fondo::after { content: ''; position: absolute; inset: auto 0 0 0; height: 160px; background: linear-gradient(180deg, transparent, var(--bg)); }
.vit .vit-fondo__a { position: absolute; left: 1088px; top: -40px; width: 900px; height: 900px; border-radius: 50%; background: radial-gradient(closest-side, #2a2a2f 70%, #303036 100%); box-shadow: inset 2px 2px 0 #ffffff14; }
.vit .vit-fondo__b { position: absolute; left: -200px; top: 60px; width: 1500px; height: 1500px; border-radius: 50%; border: 1px solid #ffffff10; }
.vit .vit-fondo__c { position: absolute; left: 760px; top: -760px; width: 1200px; height: 1200px; border-radius: 50%; background: #0c0c0e; box-shadow: 0 0 0 1px #ffffff18; }
.vit .vit-fondo__bola { position: absolute; left: 45px; top: 782px; width: 55px; height: 55px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #5a5a60, #1d1d21 70%); box-shadow: inset 0 1px 1px #ffffff40, 0 10px 20px -8px #000; }
.vit .vit-ibtn { position: relative; width: 40px; height: 40px; display: grid; place-items: center; border: 0; border-radius: 50%; background: none; color: var(--text); transition: background-color .15s; }
.vit .vit-ibtn:hover { background: var(--well); }
.vit .vit-main { position: relative; z-index: 1; padding: 10px 23px 56px 103px; }
.vit .vit-head { display: flex; align-items: center; gap: 46px; }
.vit .vit-head__title .vit-w { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: .06em; margin-bottom: -.06em; }
.vit .vit-head__title .vit-w__i { display: inline-block; transform-origin: 0 100%; }
.vit .vit-head__title { width: 170px; font-size: 37.44px; font-weight: 600; line-height: 38.94px; letter-spacing: -.936px; }
.vit .vit-stat { display: flex; align-items: center; gap: 12px; }
.vit .vit-stat__ico { width: 46px; height: 46px; display: grid; place-items: center; flex: none; border-radius: 50%; background: var(--glass-chrome); box-shadow: var(--card-shadow); }
.vit .vit-stat__ico svg { width: 16px; height: 16px; }
.vit .vit-stat__n { display: flex; align-items: center; gap: 10px; font-size: 22px; font-weight: 900; line-height: 31.9px; letter-spacing: -.22px; }
.vit .vit-stat__l { max-width: 150px; font-size: 12.5px; line-height: 16.25px; color: var(--muted); }
.vit .vit-chip { height: 20px; display: inline-flex; align-items: center; padding: 0 7px; border-radius: 6px; font-style: normal; font-size: 11px; font-weight: 700; line-height: 15.95px; letter-spacing: .11px; }
.vit .vit-chip--good { color: var(--good); background: #5fc4832b; }
.vit .vit-chip--bad { color: var(--bad); background: #e982782b; }
.vit .vit-grid { margin-top: 24px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--gap); grid-template-areas: 'chart chart rate' 'apps apps apps' 'train rev today' 'act act act'; }
.vit .vit-ov-chart { grid-area: chart; }
.vit .vit-ov-rate { grid-area: rate; }
.vit .vit-ov-apps { grid-area: apps; }
.vit .vit-ov-train { grid-area: train; }
.vit .vit-ov-rev { grid-area: rev; }
.vit .vit-ov-today { grid-area: today; }
.vit .vit-ov-act { grid-area: act; }
.vit .vit-card { position: relative; min-width: 0; padding: 18px; border-radius: var(--r-card); background: var(--glass); box-shadow: var(--card-shadow); backdrop-filter: blur(14px) saturate(175%) brightness(.95); }
.vit .vit-ov-chart, .vit .vit-ov-rate { height: 396px; }
.vit .vit-ov-apps { height: 266px; }
.vit .vit-ov-train, .vit .vit-ov-rev, .vit .vit-ov-today { height: 534px; }
.vit .vit-ov-act { height: 157px; }
.vit .vit-card__h { min-height: 38px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.vit .vit-card__t { font-size: 15px; font-weight: 600; line-height: 21.75px; letter-spacing: -.075px; }
.vit .vit-card__acts { display: flex; align-items: center; gap: 10px; }
.vit .vit-card__s { font-size: 12.5px; line-height: 18.125px; color: var(--muted); white-space: nowrap; }
.vit .vit-ibtn--ring { width: 38px; height: 38px; box-shadow: inset 0 0 0 1px var(--line-2); }
.vit .vit-ibtn--ring svg { width: 16px; height: 16px; }
.vit .vit-seg { height: 38px; display: inline-flex; align-items: center; gap: 0; padding: 4px; border-radius: 999px; background: var(--well); }
.vit .vit-seg button { height: 30px; padding: 0 14px; border: 0; border-radius: 999px; background: none; font-size: 12.5px; font-weight: 600; line-height: 18.125px; color: var(--muted); }
.vit .vit-seg button[aria-pressed='true'] { color: var(--text); background: var(--lens); box-shadow: var(--lens-shadow); }
.vit .vit-btn { height: 34px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 14px; border: 0; border-radius: 999px; font-size: 12.5px; font-weight: 600; line-height: 18.125px; white-space: nowrap; transition: background-color .15s, filter .15s; }
.vit .vit-btn svg { width: 15px; height: 15px; }
.vit .vit-btn--ghost { background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line-2); }
.vit .vit-btn--ghost:hover { background: var(--well); }
.vit .vit-btn--accent { height: 33px; padding: 0 16px 0 14px; background: var(--accent); color: var(--on-accent); box-shadow: inset 0 1px 1px #ffffff80, 0 8px 18px -8px #7aaef0cc; }
.vit .vit-btn--accent:hover { filter: brightness(1.08); }
.vit .vit-big { margin-top: 16px; display: flex; align-items: baseline; gap: 13px; }
.vit .vit-big b { font-size: 34px; font-weight: 600; line-height: 34px; letter-spacing: -.85px; }
.vit .vit-big span { font-size: 13.5px; line-height: 19.575px; color: var(--muted); }
.vit .vit-big strong { font-weight: 700; color: var(--text); }
.vit .vit-legend { margin-top: 11px; display: flex; gap: 18px; font-size: 12.5px; line-height: 18.125px; color: var(--muted); }
.vit .vit-legend span { display: inline-flex; align-items: center; gap: 7px; }
.vit .vit-legend__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-line); }
.vit .vit-legend__dash { width: 14px; height: 0; border-top: 1.5px dashed var(--ink-mark); }
.vit .vit-plot { position: relative; margin: 19px 12px 0 43px; height: 198px; }
.vit .vit-plot__svg { display: block; width: 100%; height: 198px; overflow: visible; }
.vit .vit-plot__grid { fill: none; stroke: #ffffff1f; stroke-width: 1; stroke-dasharray: 2 4; vector-effect: non-scaling-stroke; }
.vit .vit-plot__line { fill: none; stroke: var(--accent-line); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linecap: round; }
.vit .vit-plot__last { fill: none; stroke: var(--ink-mark); stroke-width: 1.5; stroke-dasharray: 5 4; vector-effect: non-scaling-stroke; }
.vit .vit-plot__y { position: absolute; left: -43px; top: 0; bottom: 0; width: 36px; }
.vit .vit-plot__y span { position: absolute; right: 0; transform: translateY(-50%); font-size: 11px; line-height: 15.95px; color: var(--muted); }
.vit .vit-plot__y span:nth-child(1) { top: 0; }
.vit .vit-plot__y span:nth-child(2) { top: 50%; }
.vit .vit-plot__y span:nth-child(3) { top: 100%; }
.vit .vit-plot__x { position: absolute; left: 0; right: 0; top: calc(100% + 8px); height: 16px; }
.vit .vit-plot__x span { position: absolute; transform: translateX(-50%); font-size: 11px; line-height: 15.95px; color: var(--text); white-space: nowrap; }
.vit .vit-ov-rate { display: flex; flex-direction: column; }
.vit .vit-rate__top { margin-top: 21px; display: flex; align-items: center; gap: 14px; }
.vit .vit-rate__n { font-size: 34px; font-weight: 600; line-height: 34px; letter-spacing: -1.19px; }
.vit .vit-stars { display: flex; gap: 1px; color: var(--warn); }
.vit .vit-stars svg { width: 17px; height: 17px; fill: currentColor; stroke: none; }
.vit .vit-rate__s { margin-top: 5px; font-size: 12px; line-height: 17.4px; color: var(--muted); }
.vit .vit-bars { margin-top: 18px; display: grid; gap: 9.8px; }
.vit .vit-bars li { display: grid; grid-template-columns: 23px minmax(0, 1fr) 44px; align-items: center; font-size: 12px; line-height: 17.4px; }
.vit .vit-bars b { font-weight: 600; }
.vit .vit-bar { height: 6px; border-radius: 3px; background: var(--well); overflow: hidden; }
.vit .vit-bar i { display: block; width: var(--p); height: 100%; border-radius: 3px; }
.vit .vit-bar--acc { background: var(--accent); }
.vit .vit-bar--warn { background: var(--warn-fill); }
.vit .vit-bar--bad { background: var(--bad-fill); }
.vit .vit-bar__p { text-align: right; font-weight: 600; color: var(--muted); }
.vit .vit-rate__f { margin-top: auto; padding-top: 13px; border-top: 1px solid var(--line); font-size: 12.5px; line-height: 18.125px; color: var(--muted); }
.vit .vit-rate__f b { font-weight: 700; color: var(--text); }
.vit .vit-down { font-style: normal; font-weight: 700; color: var(--bad); }
.vit .vit-tiles { margin-top: 16px; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
.vit .vit-ov-tile { position: relative; height: 176px; display: flex; flex-direction: column; padding: 14px 14px 14px 16px; border-radius: var(--r-tile); overflow: hidden; box-shadow: inset 0 1px 0 #ffffffb3, 0 0 0 .5px #141e320f, 0 16px 28px -22px #141e3259; }
.vit .vit-ov-tile::before { content: ''; position: absolute; inset: 0; background: linear-gradient(160deg, #ffffff1f, transparent 55%); pointer-events: none; }
.vit .vit-tone--blue { background: var(--blue); color: var(--on-blue); }
.vit .vit-tone--teal { background: var(--teal); color: var(--on-teal); }
.vit .vit-tone--orange { background: var(--orange); color: var(--on-orange); }
.vit .vit-tone--coral { background: var(--coral); color: var(--on-coral); }
.vit .vit-tone--green { background: var(--green); color: var(--on-green); }
.vit .vit-tone--ink { background: var(--ink); color: var(--on-ink); }
.vit .vit-tile__h { position: relative; display: flex; align-items: center; gap: 8px; }
.vit .vit-tile__ico, .vit .vit-sq { width: 38px; height: 38px; display: grid; place-items: center; flex: none; border-radius: 12px; color: #2a2f38; box-shadow: inset 0 1px 1px #ffffffb3; }
.vit .vit-tile__ico svg { width: 17px; height: 17px; }
.vit .vit-ico--blue { background: var(--ico-blue); color: #2d5a99; }
.vit .vit-ico--teal { background: var(--ico-teal); color: #26685e; }
.vit .vit-ico--orange { background: var(--ico-orange); color: #8a5212; }
.vit .vit-ico--coral { background: var(--ico-coral); color: #9a3a2c; }
.vit .vit-ico--green { background: var(--ico-green); color: #2c6b40; }
.vit .vit-ico--ink { background: var(--ico-ink); color: #3b3f47; }
.vit .vit-rate { height: 26px; display: inline-flex; align-items: center; gap: 4px; padding: 0 9px 0 8px; border-radius: 999px; background: #ffffff21; box-shadow: inset 0 0 0 1px #ffffff2e; font-style: normal; font-size: 12px; font-weight: 700; line-height: 17.4px; }
.vit .vit-rate svg { width: 11px; height: 11px; fill: currentColor; stroke: none; }
.vit .vit-tile__more { margin-left: auto; width: 32px; height: 32px; display: grid; place-items: center; border: 0; border-radius: 50%; background: none; box-shadow: inset 0 0 0 1px #ffffff4d; }
.vit .vit-tile__more svg { width: 15px; height: 15px; }
.vit .vit-tile__n { position: relative; margin-top: 12px; font-size: 20px; font-weight: 600; line-height: 22px; letter-spacing: -.3px; }
.vit .vit-tile__m { position: relative; margin-top: 2px; font-size: 12.5px; line-height: 18.125px; opacity: .85; }
.vit .vit-tile__v { position: relative; margin-top: auto; font-size: 22px; font-weight: 700; line-height: 24.2px; letter-spacing: -.44px; }
.vit .vit-tile__d { position: relative; font-size: 12px; font-weight: 600; line-height: 17.4px; }
.vit .vit-tile__sp { position: absolute; right: 13px; bottom: 15px; width: 54px; height: 24px; overflow: visible; }
.vit .vit-tile__sp path { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.vit .vit-stages { margin-top: 17px; height: 64px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 4px; border-radius: 18px; background: var(--well); }
.vit .vit-stages button { display: grid; place-content: center; justify-items: center; gap: 0; border: 0; border-radius: 14px; background: none; }
.vit .vit-stages button[aria-pressed='true'] { background: var(--lens); box-shadow: var(--lens-shadow); }
.vit .vit-stages b { font-size: 17px; font-weight: 700; line-height: 24.65px; }
.vit .vit-stages span { font-size: 11px; font-weight: 500; line-height: 15.95px; color: var(--muted); }
.vit .vit-rel { margin-top: 10px; }
.vit .vit-rel li { display: flex; align-items: center; gap: 12px; padding: 10.5px 0 9.9px; }
.vit .vit-rel li + li { border-top: 1px solid var(--line); }
.vit .vit-sq { width: 28px; height: 28px; border-radius: 9px; }
.vit .vit-sq svg { width: 14px; height: 14px; }
.vit .vit-rel li > div { flex: 1; min-width: 0; display: grid; }
.vit .vit-rel b, .vit .vit-rev__h b, .vit .vit-agenda b { font-size: 14px; font-weight: 600; line-height: 20.3px; }
.vit .vit-rel li > div > span { font-size: 12.5px; line-height: 18.125px; color: var(--muted); }
.vit .vit-steps { margin-top: 6px; display: grid; grid-template-columns: repeat(5, 33px); gap: 5px; }
.vit .vit-steps i { height: 3px; border-radius: 2px; background: #ffffff1f; }
.vit .vit-steps[data-n='4'] i:nth-child(-n+3), .vit .vit-steps[data-n='3'] i:nth-child(-n+2), .vit .vit-steps[data-n='2'] i:nth-child(-n+1) { background: #6f86a8; }
.vit .vit-steps[data-n='4'] i:nth-child(4), .vit .vit-steps[data-n='3'] i:nth-child(3), .vit .vit-steps[data-n='2'] i:nth-child(2) { background: var(--accent); }
.vit .vit-count { height: 22px; min-width: 26px; display: inline-grid; place-items: center; padding: 0 7px; border-radius: 7px; background: #7aaef02e; font-style: normal; font-size: 11px; font-weight: 700; line-height: 15.95px; letter-spacing: .11px; color: var(--accent-text); }
.vit .vit-revs { margin-top: 16px; display: grid; gap: 10px; }
.vit .vit-ov-review { padding: 12px 14px; border-radius: 18px; background: var(--well); }
.vit .vit-rev__h { display: flex; align-items: center; gap: 8px; }
.vit .vit-mini-stars { margin-left: auto; display: flex; gap: 2px; }
.vit .vit-mini-stars i { width: 11px; height: 11px; background: #ffffff2e; clip-path: polygon(50% 0, 62% 35%, 100% 38%, 70% 61%, 80% 100%, 50% 78%, 20% 100%, 30% 61%, 0 38%, 38% 35%); }
.vit .vit-mini-stars[data-n='1'] i:nth-child(-n+1), .vit .vit-mini-stars[data-n='2'] i:nth-child(-n+2) { background: var(--warn); }
.vit .vit-rev__t { margin-top: 5px; font-size: 13.5px; line-height: 20px; color: var(--muted); }
.vit .vit-rev__f { margin-top: 8px; display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12.5px; line-height: 18.125px; color: var(--muted); }
.vit .vit-btn--sm svg { width: 14px; height: 14px; }
.vit .vit-rev__all { margin-top: 11px; }
.vit .vit-done { margin-top: 15px; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 13px; font-size: 12.5px; line-height: 18.125px; color: var(--muted); }
.vit .vit-done__bar { height: 6px; border-radius: 3px; background: var(--well); overflow: hidden; }
.vit .vit-done__bar i { display: block; width: var(--p); height: 100%; border-radius: 3px; background: var(--accent); }
.vit .vit-agenda { margin-top: 8px; }
.vit .vit-agenda li { display: grid; grid-template-columns: 22px 64px minmax(0, 1fr); align-items: center; column-gap: 10px; padding: 10px 0 10px; }
.vit .vit-agenda li + li { border-top: 1px solid var(--line); }
.vit .vit-tick { width: 22px; height: 22px; display: grid; place-items: center; border-radius: 50%; background: #ffffff0f; box-shadow: inset 0 0 0 1.5px #ffffff38; }
.vit .vit-tick svg { width: 13px; height: 13px; stroke-width: 2.4; }
.vit .vit-is-done .vit-tick { background: var(--accent); color: var(--on-accent); box-shadow: none; }
.vit .vit-agenda__h { font-size: 12.5px; font-weight: 600; line-height: 18.125px; color: var(--muted); white-space: nowrap; }
.vit .vit-agenda li > div { min-width: 0; display: grid; }
.vit .vit-agenda li > div > b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vit .vit-is-done b { color: var(--muted); text-decoration: line-through; }
.vit .vit-agenda li > div > span { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; line-height: 17.4px; color: var(--muted); }
.vit .vit-agenda li > div > span svg { width: 12px; height: 12px; }
.vit .vit-act { margin-top: 17px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); column-gap: 18px; }
.vit .vit-act li { display: flex; gap: 10px; min-width: 0; padding-right: 28px; }
.vit .vit-act li:not(:last-child) { border-right: 1px solid var(--line); }
.vit .vit-ini { width: 28px; height: 28px; display: grid; place-items: center; flex: none; margin-top: 3px; border-radius: 50%; font-size: 11px; font-weight: 700; letter-spacing: .11px; color: #15181d; }
.vit .vit-ini--b { background: #d2e4ff; }
.vit .vit-ini--t { background: #c8efe8; }
.vit .vit-ini--c { background: #ffd5cd; }
.vit .vit-ini--o { background: #ffe3bf; }
.vit .vit-act p { font-size: 13.5px; line-height: 20.5px; }
.vit .vit-act b { font-weight: 700; }
.vit .vit-act li > div > span { font-size: 12px; line-height: 17.4px; color: var(--muted); }

@container vit (max-width: 700px) {
  .vit .vit-fondo__a, .vit .vit-fondo__c { display: none; }
  .vit .vit-fondo__bola { left: 287px; top: 272px; width: 50px; height: 50px; }
  .vit .vit-rate, .vit .vit-tile__sp { display: none; }
  .vit .vit-ov-apps .vit-card__s { display: none; }
  .vit .vit-main { padding: 14px 12px 110px; }
  .vit .vit-head { flex-wrap: wrap; gap: 14px 20px; }
  .vit .vit-head__title { width: 100%; padding-right: calc(100% - 170px); font-size: 28px; line-height: 29.12px; letter-spacing: -.7px; }
  .vit .vit-big b { font-size: 26px; line-height: 26px; }
  .vit .vit-tile__n { font-size: 17px; line-height: 18.7px; }
  .vit .vit-tile__v { font-size: 18px; line-height: 19.8px; }
  .vit .vit-stat { width: calc(50% - 10px); }
  .vit .vit-stat__ico { display: none; }
  .vit .vit-stat__n { font-size: 18px; line-height: 26.1px; }
  .vit .vit-grid { margin-top: 24px; grid-template-columns: minmax(0, 1fr); grid-template-areas: 'chart' 'apps' 'rate' 'train' 'rev' 'today' 'act'; }
  .vit .vit-ov-chart, .vit .vit-ov-rate, .vit .vit-ov-apps, .vit .vit-ov-train, .vit .vit-ov-rev, .vit .vit-ov-today, .vit .vit-ov-act { height: auto; }
  .vit .vit-ov-chart .vit-card__h { flex-direction: column; align-items: flex-start; gap: 12px; }
  .vit .vit-big { flex-direction: column; align-items: flex-start; gap: 4px; }
  .vit .vit-tile__m { margin-top: 4px; }
  .vit .vit-plot { height: 160px; margin-bottom: 28px; }
  .vit .vit-plot__svg { height: 160px; }
  .vit .vit-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .vit .vit-ov-tile { height: 163px; padding: 12px; }
  .vit .vit-act { grid-template-columns: minmax(0, 1fr); }
  .vit .vit-act li { padding-right: 0; }
  .vit .vit-act { margin-top: 22px; }
  .vit .vit-act li:not(:last-child) { border-right: 0; border-bottom: 1px solid var(--line); padding-bottom: 8px; margin-bottom: 8.5px; }
}

/* ── lo de la adaptación (DESPUÉS de los @container de la copia: los pisa en el mismo ancho) ──────────── */
.vit .vit-main { padding: 28px 23px 40px; }
.vit .vit-head { flex-wrap: wrap; row-gap: 14px; }
.vit .vit-head__acts { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.vit .vit-grid { grid-template-areas: 'chart chart rate' 'apps apps apps' 'train rev today'; }
.vit .vit-quieta { opacity: .72; pointer-events: none; }
.vit .vit-vacio { flex: 1; min-height: 120px; display: grid; place-content: center; gap: 4px; margin-top: 12px; padding: 18px 12px; text-align: center; font-size: 13px; line-height: 19px; color: var(--muted); }
.vit .vit-vacio b { display: block; color: var(--text); font-weight: 600; }
.vit .vit-ov-chart, .vit .vit-ov-apps, .vit .vit-ov-train, .vit .vit-ov-rev, .vit .vit-ov-today { display: flex; flex-direction: column; }
.vit .vit-ov-chart .vit-vacio { min-height: 220px; }
.vit [role='button'] { cursor: pointer; }
.vit .vit-btn, .vit .vit-ibtn { text-decoration: none; }
.vit .vit-ibtn--ring:hover { background: var(--well); }
.vit .vit-stat__l { max-width: 170px; }
.vit .vit-stat__n .vit-chip { font-weight: 700; }
.vit .vit-big b { white-space: nowrap; }
.vit .vit-big span { min-width: 0; }
.vit .vit-rate__bar { display: block; width: 132px; margin: 6px 0 2px; }
.vit .vit-bars li { grid-template-columns: minmax(0, 104px) minmax(0, 1fr) 44px; column-gap: 10px; }
.vit .vit-bars b { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.vit .vit-bars li[role='button'] { margin: -3px -8px; padding: 3px 8px; border-radius: 8px; transition: background-color .15s; }
.vit .vit-bars li[role='button']:hover { background: var(--surface-2); }
.vit .vit-rate__f a { color: var(--accent-text); font-weight: 700; }
.vit .vit-ov-tile[role='button'] { transition: filter .15s; }
.vit .vit-ov-tile[role='button']:hover { filter: brightness(1.08); }
.vit .vit-tile__n { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.vit .vit-stages { grid-template-columns: repeat(var(--n, 4), minmax(0, 1fr)); }
.vit .vit-stages span { white-space: nowrap; }
.vit .vit-stages button[data-destacado] { background: var(--lens); box-shadow: var(--lens-shadow); }
.vit .vit-stages button:not([data-destacado]):not(:disabled):hover { background: var(--surface-2); }
.vit .vit-stages button:disabled { cursor: default; }
.vit .vit-rel b, .vit .vit-rel li > div > span, .vit .vit-rev__h b, .vit .vit-rev__f span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.vit .vit-rel .vit-btn { flex: none; }
.vit .vit-rev__t { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.vit .vit-rev__f .vit-btn { flex: none; }
.vit .vit-rev__all { align-self: flex-start; }
.vit .vit-fondo__bola { display: none; }
.vit .vit-plot__x .vit-x--tel { display: none; }
@container vit (min-width: 701px) and (max-width: 1000px) {
  .vit .vit-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-areas: 'chart chart' 'apps apps' 'rate today' 'train rev'; }
  .vit .vit-ov-apps { height: auto; }
  .vit .vit-ov-rate, .vit .vit-ov-today { height: auto; min-height: 396px; }
  .vit .vit-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@container vit (max-width: 700px) {
  .vit .vit-main { padding: 18px 12px 32px; }
  .vit .vit-head__acts { margin-left: 0; width: 100%; }
  .vit .vit-grid { grid-template-areas: 'chart' 'apps' 'rate' 'train' 'rev' 'today'; }
  .vit .vit-ov-rate { min-height: 0; }
  .vit .vit-plot__x .vit-x--tel { display: block; }
  .vit .vit-plot__x .vit-x--fuera { display: none; }
}
@media (prefers-reduced-motion: reduce) { .vit *, .vit *::before, .vit *::after { transition: none !important; animation: none !important; } }
`;
