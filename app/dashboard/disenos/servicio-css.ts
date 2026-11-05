// =============================================================================
// servicio-css — la hoja de estilos del DISEÑO de la hoja «Agencia o servicio»: la copia de Sunrow, sólo de esta hoja
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco». Es docs/diseno/mockups-dashboard/servicio-sunrow/sunrow.css (escrita desde lo MEDIDO del demo: valores.json, las
// capturas a 1440 y 390 y el INFORME; nada del código de la tienda) con todo adentro de `.srw` y cada clase con el prefijo `srw-`,
// para no tocar nada del resto del Dashboard. Sin el armazón de Sunrow (la barra de arriba, la de la izquierda, el fondo y el
// botón de la IA): en MaKo los pone la app. La arma scratchpad/srv/armar-srv.py desde la hoja de la copia: se cambia la copia y se
// vuelve a armar.
//
// Lo que se suma a la copia, y es de la adaptación (servicio-sunrow/mako.html): los vacíos, el arco sin agenda, la tarjeta de los
// días del mes sin las flechas (el Calendario de General trae dos semanas), la casilla de una tarea como botón, los rótulos del eje
// que pone la hoja, la marca «Hoy» al final de la curva, las filas que se abren y dos pasos intermedios (hasta 1280 y hasta 1000 px
// de ancho) que Sunrow no tiene.
//
// ⚠️ LA LETRA ES URBANIST, la de Sunrow: aquí se llama «Sunrow Urbanist», con la URL de Google Fonts, así la hoja no depende de cómo
//    se llame la letra de la app.
// ⚠️ ESTA HOJA ES SÓLO DE «AGENCIA O SERVICIO»: otra hoja con diseño escribe la suya (la de su demo), no reusa ésta.
// ⚠️ EL TELÉFONO VA POR @container (el ancho del lienzo), no por el de la ventana, y lo de la adaptación va DESPUÉS de los
//    @container de la copia: dos reglas iguales las decide el orden (docs/hallazgos-templates-dashboard.md §18).
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.
// =============================================================================

export const CSS_SERVICIO = `
@font-face { font-family: 'Sunrow Urbanist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/urbanist/v18/L0x-DF02iFML4hGCyMqlbS0.woff2) format('woff2'); }
.srw {
  container-type: inline-size; container-name: srw;
  --font: 'Sunrow Urbanist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --bg: #eceff0; --surface: #ffffffbd; --surface-2: #ffffffe6; --raised: #fbfcfb; --solid: #f9fafa; --rim: #ffffffdb;
  --well: #14242c0e; --line: #14242c17; --line-2: #14242c2b;
  --shadow: 0 1px 0 #ffffffbf inset, 0 22px 44px -30px #1c3a4252; --shadow-pop: 0 24px 60px -18px #14283052, 0 2px 6px #14283014;
  --text: #15232b; --muted: #4b5960; --faint: #66737a; --primary: #1b2a32; --on-primary: #f3f7f5; --accent-text: #0c6878;
  --dock: #1b2a32; --on-dock: #f3f7f5; --focus: #2f6fd0;
  --t-mint: #a7e2c9; --on-mint: #0e2e26; --t-blush: #f6bdb5; --on-blush: #3b1612; --t-lemon: #f1df97; --on-lemon: #2e2606;
  --tile-good: #1d5429; --tile-warn: #6e3a0e; --tile-bad: #842030;
  --sun: #1993aa; --ember: #e3925a; --jade: #3f8a4c; --cobalt: #4b6bd2; --rose: #cf5a64; --sky: #6a8cb0; --slate: #7c878c; --ink: #1b2a32;
  --good: #2a6735; --warn: #8a4c1d; --bad: #a3333e; --info: #2f4ca6;
  --ai-a: #15303b; --ai-b: #1d5560; --on-ai: #eef7f6; --ai-good: #9fdcaf; --ai-bad: #f6a8a6; --ai-sun: #8fd6e2;
  --av-sun: #bfe3ea; --av-text: #172028;
  --r-card: 22px; --r-tile: 14px; --gap: 16px; --ease: cubic-bezier(.2, .8, .2, 1);
  position: relative; isolation: isolate; overflow: clip; color: var(--text); font: 500 14px/1.45 var(--font); -webkit-font-smoothing: antialiased;
  background: var(--bg);
}
.srw *, .srw *::before, .srw *::after { box-sizing: border-box; }
.srw button { font: inherit; color: inherit; cursor: pointer; }
.srw a { color: inherit; text-decoration: none; }
.srw h1, .srw h2, .srw h3, .srw p, .srw ul { margin: 0; }
.srw ul { padding: 0; list-style: none; }
.srw svg.srw-i { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.srw :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

/* ── la copia ──────────────────────────────────────────────────────────────────────────────── */
.srw * { box-sizing: border-box; }
.srw .srw-live-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--jade); box-shadow: 0 0 0 3px #3f8a4c26; animation: srw-breathe 2.4s ease-in-out infinite; }
@keyframes srw-breathe { 50% { box-shadow: 0 0 0 7px #3f8a4c0f; } }
.srw .srw-ibtn { position: relative; width: 38px; height: 38px; display: grid; place-items: center; border: 0; border-radius: 50%; background: none; color: var(--text); transition: background-color .15s; }
.srw .srw-ibtn:hover { background: var(--well); }
.srw .srw-ibtn svg { width: 17px; height: 17px; }
.srw .srw-ibtn--sm { width: 32px; height: 32px; box-shadow: inset 0 0 0 1px var(--line); }
.srw .srw-ibtn--sm svg { width: 15px; height: 15px; }
.srw .srw-ibtn--plain { box-shadow: none; }
.srw .srw-dash { padding: 0 23px 96px 103px; display: grid; grid-template-columns: minmax(0, 1fr) 315px; gap: 16px; align-items: start; }
.srw .srw-dash__main { min-width: 0; display: grid; gap: 16px; }
.srw .srw-dash__aside { display: grid; gap: 16px; }
.srw .srw-card, .srw .srw-hero, .srw .srw-kpi { position: relative; min-width: 0; border: 1px solid #ffffffdb; border-radius: var(--r-card); background: var(--surface); box-shadow: var(--shadow); backdrop-filter: blur(16px) saturate(140%); }
.srw .srw-card { padding: 18px; }
.srw .srw-card__h { min-height: 38px; display: flex; align-items: center; gap: 10px; }
.srw .srw-card__ico { width: 36px; height: 36px; display: grid; place-items: center; flex: none; border-radius: 50%; background: #1993aa26; color: var(--accent-text); }
.srw .srw-card__ico svg { width: 17px; height: 17px; }
.srw .srw-card__t { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; line-height: 18.75px; letter-spacing: -.075px; }
.srw .srw-card__tools { display: flex; align-items: center; gap: 10px; }
.srw .srw-card__more { display: inline-flex; align-items: center; gap: 4px; padding: 6px 6px; border: 0; background: none; font-size: 12.5px; font-weight: 600; line-height: 18.125px; color: var(--accent-text); white-space: nowrap; }
.srw .srw-card__more svg { width: 14px; height: 14px; }
.srw .srw-card__more:hover { text-underline-offset: 3px; text-decoration: underline; }
.srw .srw-card__more--block { width: 100%; justify-content: center; margin-top: 10px; padding: 9.5px 0; }
.srw .srw-eyebrow { font-size: 12px; font-weight: 700; line-height: 17.4px; letter-spacing: .6px; text-transform: uppercase; color: var(--muted); }
.srw .srw-pill { height: 22px; display: inline-flex; align-items: center; gap: 4px; padding: 0 8px; border-radius: 999px; font-style: normal; font-size: 12px; font-weight: 700; line-height: 16.2px; white-space: nowrap; }
.srw .srw-pill svg { width: 12px; height: 12px; }
.srw .srw-pill--good { background: #2a673526; color: var(--good); }
.srw .srw-pill--bad { background: #a3333e1f; color: var(--bad); }
.srw .srw-pill--warn { background: #e3925a2b; color: var(--warn); }
.srw .srw-btn { height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 16px; border: 0; border-radius: 999px; font-size: 12.5px; font-weight: 600; line-height: 18.125px; white-space: nowrap; transition: filter .15s, background-color .15s; }
.srw .srw-btn svg { width: 15px; height: 15px; }
.srw .srw-btn--primary { background: var(--primary); color: var(--on-primary); }
.srw .srw-btn--primary:hover { filter: brightness(1.18); }
.srw .srw-hero { padding: 22px; display: grid; grid-template-columns: minmax(0, 1fr) 337px; gap: 18px; }
.srw .srw-hero__l { display: grid; grid-template-columns: 270px minmax(0, 1fr); gap: 20px; }
.srw .srw-hero__eyebrow { display: flex; align-items: center; gap: 8px; margin-top: 2px; font-size: 12.5px; font-weight: 600; line-height: 18.125px; color: var(--muted); }
.srw .srw-hero__eyebrow svg { width: 15px; height: 15px; }
.srw .srw-hero__title { margin-top: 6px; max-width: 260px; font-size: 37.44px; font-weight: 600; line-height: 38.94px; letter-spacing: -.936px; }
.srw .srw-hero__title .srw-w { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: .08em; margin-bottom: -.08em; }
.srw .srw-hero__title .srw-w__i { display: inline-block; transform-origin: 0 100%; }
.srw .srw-hero__sub { margin-top: 8px; font-size: 13.5px; font-weight: 500; line-height: 19.575px; color: var(--muted); }
.srw .srw-hchips { margin-top: 13px; display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px; }
.srw .srw-hchip { height: 33px; display: inline-flex; align-items: center; gap: 7px; padding: 0 11px; border: 1px solid var(--line); border-radius: 10px; background: #ffffffb3; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); white-space: nowrap; }
.srw .srw-hchip svg { width: 15px; height: 15px; color: var(--text); }
.srw .srw-hchip b { font-weight: 700; color: var(--text); }
.srw .srw-hchip--live { color: var(--good); font-weight: 600; }
.srw .srw-day { position: relative; align-self: start; height: 120px; margin-top: 93px; }
.srw .srw-day__arc { position: absolute; left: 4px; right: 4px; top: 0; width: calc(100% - 8px); height: 80px; overflow: visible; }
.srw .srw-day__track { fill: none; stroke: #66737a59; stroke-width: 1.6; stroke-dasharray: 4 5; vector-effect: non-scaling-stroke; }
.srw .srw-day__done { fill: none; stroke: var(--ember); stroke-width: 2.6; stroke-linecap: round; vector-effect: non-scaling-stroke; }
.srw .srw-day__sunp { position: absolute; width: 0; height: 0; }
.srw .srw-day__sunp::before { content: ''; position: absolute; left: -12px; top: -12px; width: 24px; height: 24px; border-radius: 50%; background: #e3925a3d; }
.srw .srw-day__sunp::after { content: ''; position: absolute; left: -6.5px; top: -6.5px; width: 13px; height: 13px; border-radius: 50%; background: var(--ember); box-shadow: 0 0 0 2px #fff; }
.srw .srw-day__a, .srw .srw-day__b { position: absolute; top: 76px; font-size: 12px; font-weight: 600; color: var(--text); }
.srw .srw-day__a { left: 0; }
.srw .srw-day__b { right: 0; }
.srw .srw-day__mid { position: absolute; left: 0; right: 0; top: 46px; display: grid; justify-items: center; text-align: center; }
.srw .srw-day__mid span { font-size: 12px; font-weight: 600; line-height: 17.4px; color: var(--muted); }
.srw .srw-day__mid span:last-child { font-size: 12.5px; font-weight: 500; }
.srw .srw-day__mid b { font-size: 22px; font-weight: 700; line-height: 26.4px; letter-spacing: -.55px; }
.srw .srw-ai-card { position: relative; display: grid; gap: 10px; padding: 16px; border-radius: 18px; background: linear-gradient(140deg, var(--ai-a) 10%, var(--ai-b)); color: var(--on-ai); box-shadow: 0 20px 40px -24px #0e2830cc; }
.srw .srw-ai-card__h { display: flex; align-items: center; gap: 10px; }
.srw .srw-ai-card__h b { font-size: 14px; font-weight: 900; line-height: 20.3px; }
.srw .srw-ai-card__ico { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; background: var(--t-mint); color: var(--on-mint); }
.srw .srw-ai-card__ico svg { width: 15px; height: 15px; }
.srw .srw-ai-card__mid { display: grid; grid-template-columns: 112px minmax(0, 1fr); align-items: center; gap: 16px; }
.srw .srw-gauge { position: relative; height: 106px; }
.srw .srw-gauge svg { width: 112px; height: 100px; overflow: visible; }
.srw .srw-gauge__track { fill: none; stroke: #ffffff2e; stroke-width: 5; stroke-linecap: round; }
.srw .srw-gauge__fill { fill: none; stroke: var(--jade); stroke-width: 5; stroke-linecap: round; }
.srw .srw-gauge__ticks { fill: none; stroke: #eef7f640; stroke-width: 1.4; stroke-linecap: round; }
.srw .srw-gauge__needle { stroke: var(--on-ai); stroke-width: 2.2; stroke-linecap: round; }
.srw .srw-gauge__n { position: absolute; left: 0; right: 0; top: 54px; text-align: center; font-size: 26px; font-weight: 700; line-height: 26px; letter-spacing: -.65px; font-style: italic; }
.srw .srw-gauge__l { position: absolute; left: 0; right: 0; top: 84px; text-align: center; font-size: 11px; font-weight: 600; line-height: 15.95px; color: #eef7f6bd; }
.srw .srw-ai-card__t b { display: block; font-size: 14px; font-weight: 600; line-height: 20.3px; }
.srw .srw-ai-card__t p { margin-top: 3px; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: #eef7f6bd; }
.srw .srw-ai-card__tip { display: flex; align-items: flex-start; gap: 10px; padding: 9px 12px; border: 1px solid #ffffff24; border-radius: 12px; background: #ffffff0f; font-size: 12.5px; font-weight: 500; line-height: 17.5px; transition: background-color .15s; }
.srw .srw-ai-card__tip:hover { background: #ffffff1a; }
.srw .srw-ai-card__tip svg { width: 15px; height: 15px; margin-top: 2px; }
.srw .srw-ai-card__tip b { display: block; font-weight: 700; }
.srw .srw-ai-card .srw-btn { width: 100%; }
.srw .srw-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 12px; }
.srw .srw-kpi { height: 115px; display: flex; flex-direction: column; padding: 14px 15px; transition: transform .3s var(--ease); }
.srw .srw-kpi__h { display: flex; align-items: center; gap: 10px; }
.srw .srw-kpi__ico { width: 30px; height: 30px; display: grid; place-items: center; flex: none; border-radius: 50%; background: #14242c0e; }
.srw .srw-kpi__ico svg { width: 15px; height: 15px; }
.srw .srw-kpi__l { font-size: 12.5px; font-weight: 600; line-height: 15.625px; color: var(--muted); }
.srw .srw-kpi__n { margin-top: auto; font-size: 22px; font-weight: 700; line-height: 22px; letter-spacing: -.55px; }
.srw .srw-kpi__d { margin-top: 3px; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; line-height: 17.4px; color: var(--good); }
.srw .srw-kpi__d svg { width: 13px; height: 13px; }
.srw .srw-kpi__d--flat { color: var(--muted); }
.srw .srw-tile--mint { background: var(--t-mint); border-color: transparent; color: var(--on-mint); }
.srw .srw-tile--mint .srw-kpi__l { color: #0e2e26bd; }
.srw .srw-tile--mint .srw-kpi__d { color: var(--tile-good); }
.srw .srw-tile--mint .srw-kpi__ico { background: #ffffff4d; }
.srw .srw-tile--blush { background: var(--t-blush); border-color: transparent; color: var(--on-blush); }
.srw .srw-tile--blush .srw-kpi__l, .srw .srw-tile--blush .srw-kpi__d { color: #3b1612bd; }
.srw .srw-tile--blush .srw-kpi__ico { background: #ffffff4d; }
.srw .srw-tile--lemon { background: var(--t-lemon); border-color: transparent; color: var(--on-lemon); }
.srw .srw-tile--lemon .srw-kpi__l { color: #2e2606bd; }
.srw .srw-tile--lemon .srw-kpi__d { color: var(--tile-warn); }
.srw .srw-tile--lemon .srw-kpi__ico { background: #ffffff4d; }
.srw .srw-select { width: 190px; height: 36px; display: inline-flex; align-items: center; justify-content: space-between; padding: 0 12px 0 14px; border: 1px solid var(--line-2); border-radius: 12px; background: #ffffffe6; font-size: 14px; font-weight: 500; line-height: 20.3px; }
.srw .srw-select svg { width: 15px; height: 15px; }
.srw .srw-card__expand { width: 32px; height: 32px; }
.srw .srw-legend { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 16px; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); }
.srw .srw-legend span { display: inline-flex; align-items: center; gap: 6px; }
.srw .srw-lg { width: 9px; height: 9px; border-radius: 2px; }
.srw .srw-lg--sun { background: var(--sun); }
.srw .srw-lg--ink { background: var(--ink); }
.srw .srw-lg--dash { width: 14px; height: 0; border-radius: 0; border-top: 2px dashed; }
.srw .srw-lg--cobalt { border-color: var(--cobalt); }
.srw .srw-lg--slate { border-color: var(--slate); }
.srw .srw-chart { position: relative; margin: 22px 8px 0 46px; height: 168px; }
.srw .srw-chart__svg { display: block; width: 100%; height: 168px; overflow: visible; }
.srw .srw-chart__grid { fill: none; stroke: #14242c1f; stroke-width: 1; stroke-dasharray: 2 4; vector-effect: non-scaling-stroke; }
.srw .srw-chart__plan { fill: none; stroke: var(--sun); stroke-width: 2; vector-effect: non-scaling-stroke; }
.srw .srw-chart__act { fill: none; stroke: var(--ink); stroke-width: 2; vector-effect: non-scaling-stroke; }
.srw .srw-chart__fc { fill: none; stroke: var(--cobalt); stroke-width: 1.6; stroke-dasharray: 5 4; vector-effect: non-scaling-stroke; }
.srw .srw-chart__base { fill: none; stroke: var(--slate); stroke-width: 1.6; stroke-dasharray: 5 4; vector-effect: non-scaling-stroke; }
.srw .srw-chart__y { position: absolute; left: -46px; top: 0; bottom: 0; width: 34px; }
.srw .srw-chart__y span { position: absolute; right: 0; transform: translateY(-50%); font-size: 11px; font-weight: 600; line-height: 15.95px; color: var(--text); }
.srw .srw-chart__y span:nth-child(1) { top: 0; }
.srw .srw-chart__y span:nth-child(2) { top: 25%; }
.srw .srw-chart__y span:nth-child(3) { top: 50%; }
.srw .srw-chart__y span:nth-child(4) { top: 75%; }
.srw .srw-chart__y span:nth-child(5) { top: 100%; }
.srw .srw-chart__today { position: absolute; top: 0; bottom: 0; width: 0; border-left: 1.5px dashed #15232b8c; }
.srw .srw-chart__today i { position: absolute; left: 0; top: -15px; transform: translateX(-50%); height: 18px; display: grid; place-items: center; padding: 0 7px; border-radius: 6px; background: var(--primary); color: var(--on-primary); font-style: normal; font-size: 11px; font-weight: 700; line-height: 15.95px; }
.srw .srw-chart__x { position: absolute; left: 0; right: 0; top: calc(100% + 8px); height: 16px; }
.srw .srw-chart__x span { position: absolute; transform: translateX(-50%); font-size: 11px; font-weight: 600; line-height: 15.95px; color: var(--text); white-space: nowrap; }
.srw .srw-chart__x span:first-child { transform: none; }
.srw .srw-chart__x span:last-child { transform: translateX(-100%); }
.srw .srw-read { margin-top: 47px; padding-top: 0; border-top: 1px solid var(--line); display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.srw .srw-read span { display: block; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); }
.srw .srw-read b { font-size: 17px; font-weight: 600; line-height: 24.65px; letter-spacing: -.34px; }
.srw .srw-read .srw-up { color: var(--good); }
.srw .srw-dash__row3 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.srw .srw-dash__row3--lists > .srw-dash-dead { grid-column: 1 / -1; }
.srw .srw-bud { margin-top: 21px; display: grid; grid-template-columns: 120px minmax(0, 1fr); align-items: center; gap: 26px; }
.srw .srw-donut { position: relative; width: 120px; height: 120px; }
.srw .srw-donut svg { width: 120px; height: 120px; transform: rotate(-90deg); }
.srw .srw-donut__bg { fill: none; stroke: #c8cfd2; stroke-width: 18; }
.srw .srw-donut__seg { fill: none; stroke-width: 18; }
.srw .srw-donut__seg--sun { stroke: var(--sun); }
.srw .srw-donut__seg--cobalt { stroke: var(--cobalt); }
.srw .srw-donut__c { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); }
.srw .srw-donut__c b { font-size: 22px; font-weight: 700; line-height: 24.2px; letter-spacing: -.55px; color: var(--text); }
.srw .srw-bud__leg { display: grid; gap: 9px; }
.srw .srw-bud__leg li { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 500; line-height: 18.125px; }
.srw .srw-bud__leg b { margin-left: auto; font-weight: 600; }
.srw .srw-sq { width: 9px; height: 9px; flex: none; border-radius: 2px; }
.srw .srw-sq--ink { background: var(--ink); }
.srw .srw-sq--sun { background: var(--sun); }
.srw .srw-sq--cobalt { background: var(--cobalt); }
.srw .srw-sq--slate { background: #c8cfd2; }
.srw .srw-bud__trend { margin-top: 22px; display: flex; align-items: center; gap: 10px; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); }
.srw .srw-bud__trend .srw-pill { height: 23px; }
.srw .srw-bud__top { margin-top: 14px; padding: 14px 0 1px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); display: grid; gap: 10px; }
.srw .srw-bars2 { display: grid; gap: 11px; }
.srw .srw-bars2 li { display: grid; grid-template-columns: minmax(0, 1fr) auto; row-gap: 5px; font-size: 12.5px; line-height: 18.125px; }
.srw .srw-bars2 span { font-weight: 600; }
.srw .srw-bars2 em { font-style: normal; font-weight: 500; color: var(--muted); }
.srw .srw-bar2 { grid-column: 1 / -1; height: 6px; display: flex; border-radius: 3px; background: var(--well); overflow: hidden; }
.srw .srw-bar2 > i { display: block; height: 100%; transform-origin: 0 50%; }
.srw .srw-bar2__a { background: var(--sun); }
.srw .srw-bar2__b { background: var(--cobalt); border-radius: 0 3px 3px 0; }
.srw .srw-sites { margin-top: 12px; }
.srw .srw-sites li + li { border-top: 1px solid var(--line); }
.srw .srw-list__row { display: flex; align-items: center; gap: 12px; }
.srw .srw-site { padding: 10px 0; }
.srw .srw-tic { width: 38px; height: 38px; display: grid; place-items: center; flex: none; border-radius: 12px; }
.srw .srw-tic svg { width: 17px; height: 17px; }
.srw .srw-tic--sm { width: 34px; height: 34px; border-radius: 10px; }
.srw .srw-tic--sm svg { width: 15px; height: 15px; }
.srw .srw-tic--sun { background: #1993aa26; color: #0c6878; }
.srw .srw-tic--cobalt { background: #4b6bd226; color: #2f4ca6; }
.srw .srw-tic--jade { background: #3f8a4c26; color: #2a6735; }
.srw .srw-tic--ember { background: #e3925a2b; color: #8a4c1d; }
.srw .srw-tic--rose { background: #cf5a6426; color: #a3333e; }
.srw .srw-tic--slate { background: #7c878c21; color: #4b5960; }
.srw .srw-site__m { flex: 1; min-width: 0; display: grid; }
.srw .srw-site__m b, .srw .srw-list__m b { font-size: 14px; font-weight: 600; line-height: 20.3px; transition: color .15s; }
.srw .srw-site__m > span, .srw .srw-list__m > span { font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.srw .srw-meter { display: block; height: 6px; margin-top: 6px; border-radius: 3px; background: var(--well); overflow: hidden; }
.srw .srw-meter__fill { display: block; height: 100%; border-radius: 3px; transform-origin: 0 50%; transform: scaleX(var(--v)); }
.srw .srw-meter__fill--good { background: var(--jade); }
.srw .srw-meter__fill--bad { background: var(--rose); }
.srw .srw-site__r { display: grid; justify-items: end; gap: 6px; flex: none; min-width: 70px; }
.srw .srw-site__r strong { font-size: 13.5px; font-weight: 600; line-height: 19.575px; }
.srw .srw-quick { padding: 14px 18px; display: flex; align-items: center; gap: 16px; overflow: hidden; }
.srw .srw-quick__t { flex: none; font-size: 15px; font-weight: 600; line-height: 18.75px; letter-spacing: -.075px; }
.srw .srw-quick__l { min-width: 0; display: flex; gap: 8px; padding: 2px 0; overflow-x: auto; scrollbar-width: none; mask-image: linear-gradient(90deg, #000 92%, transparent); }
.srw .srw-quick__a { flex: none; height: 46px; display: inline-flex; align-items: center; gap: 10px; padding: 0 14px 0 7px; border: 1px solid var(--line); border-radius: 14px; background: #ffffffe6; font-size: 12.5px; font-weight: 600; line-height: 18.125px; white-space: nowrap; transition: background-color .15s; }
.srw .srw-quick__i { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 10px; background: var(--well); transition: background-color .15s; }
.srw .srw-quick__i svg { width: 15px; height: 15px; }
.srw .srw-quick__a:hover .srw-quick__i { background: #1993aa30; }
.srw .srw-quick__i--ai { background: #4b6bd226; color: var(--info); }
.srw .srw-list { margin-top: 12px; }
.srw .srw-list li + li { border-top: 1px solid var(--line); }
.srw .srw-list .srw-list__row { padding: 10px 0; }
.srw .srw-list__m { flex: 1; min-width: 0; display: grid; }
.srw .srw-list__r { flex: none; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); }
.srw .srw-grow { flex: 1; min-width: 0; display: grid; }
.srw .srw-grow b { font-size: 14px; font-weight: 600; line-height: 20.3px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; transition: color .15s; }
.srw .srw-grow:hover b { color: var(--accent-text); }
.srw .srw-grow span { font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.srw .srw-date { width: 42px; height: 46px; display: grid; place-content: center; justify-items: center; flex: none; border-radius: 10px; background: #1993aa1f; }
.srw .srw-date small { font-size: 11px; font-weight: 600; line-height: 11.55px; letter-spacing: .44px; text-transform: uppercase; color: var(--accent-text); }
.srw .srw-date b { font-size: 20px; font-weight: 700; line-height: 21px; letter-spacing: -.5px; }
.srw .srw-dash-dead .srw-list .srw-list__row { padding: 10px 0; gap: 14px; }
.srw .srw-cal__m { margin-top: 8px; display: flex; align-items: center; justify-content: space-between; }
.srw .srw-cal__m b { font-size: 14px; font-weight: 600; line-height: 20.3px; }
.srw .srw-cal__m span { display: flex; gap: 6px; }
.srw .srw-cal__grid { margin-top: 10px; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); row-gap: 2px; justify-items: center; }
.srw .srw-cal__w { height: 20px; font-size: 11px; font-weight: 700; line-height: 15.95px; color: var(--muted); }
.srw .srw-cal__d { position: relative; width: 38px; height: 38px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 10px; background: none; font-size: 12.5px; font-weight: 600; line-height: 18.125px; color: var(--text); font-style: normal; transition: background-color .15s; }
.srw .srw-cal__d.srw-is-past { color: var(--faint); }
.srw .srw-cal__d.srw-is-today { background: var(--primary); color: var(--on-primary); box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--sun); font-weight: 700; }
.srw .srw-dots { position: absolute; left: 0; right: 0; bottom: 3px; display: flex; justify-content: center; gap: 2px; }
.srw .srw-dots i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
.srw .srw-d--sun { background: var(--sun) !important; }
.srw .srw-d--jade { background: var(--jade) !important; }
.srw .srw-d--cobalt { background: var(--cobalt) !important; }
.srw .srw-d--ember { background: var(--ember) !important; }
.srw .srw-d--slate { background: var(--slate) !important; }
.srw .srw-cal__day { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line); display: grid; gap: 4px; }
.srw .srw-cal__day p { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12.5px; line-height: 18.125px; color: var(--muted); }
.srw .srw-cal__day p b { font-weight: 700; color: var(--text); }
.srw .srw-cal__ev { display: flex; align-items: center; gap: 9px; height: 28px; font-size: 12.5px; font-weight: 500; line-height: 18.125px; }
.srw .srw-cal__ev i { width: 7px; height: 7px; flex: none; border-radius: 2px; }
.srw .srw-todos { margin-top: 12px; }
.srw .srw-todo { display: flex; align-items: flex-start; gap: 11px; padding: 9.5px 0; }
.srw .srw-todo + .srw-todo { border-top: 1px solid var(--line); }
.srw .srw-check { appearance: none; width: 20px; height: 20px; flex: none; margin: 2px 0 0; border: 1px solid var(--line-2); border-radius: 6px; background: #ffffffe6; cursor: pointer; }
.srw .srw-check:checked { background: var(--primary); border-color: var(--primary); }
.srw .srw-todo label { flex: 1; min-width: 0; display: grid; cursor: pointer; }
.srw .srw-todo label b { font-size: 13.5px; font-weight: 600; line-height: 17.55px; }
.srw .srw-todo label span { margin-top: 1px; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); }
.srw .srw-todo.srw-is-done label b { color: var(--muted); text-decoration: line-through; }
.srw .srw-notes { margin-top: 13px; }
.srw .srw-notes li + li { border-top: 1px solid var(--line); }
.srw .srw-notes .srw-list__row { align-items: flex-start; padding: 10px 0; }
.srw .srw-note__m { flex: 1; min-width: 0; display: grid; }
.srw .srw-note__m b { font-size: 12.5px; font-weight: 600; line-height: 16.875px; transition: color .15s; }
.srw .srw-note__m span { margin-top: 0; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); }
.srw .srw-unread { display: inline-block; width: 6px; height: 6px; margin-left: 6px; vertical-align: 2px; border-radius: 50%; background: var(--rose); }

@container srw (max-width: 700px) {
  .srw .srw-dash { padding: 17px 14px 110px; grid-template-columns: minmax(0, 1fr); }
  .srw .srw-hero { grid-template-columns: minmax(0, 1fr); padding: 18px; gap: 16px; }
  .srw .srw-hero__l { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .srw .srw-hero__title { max-width: none; font-size: 28px; line-height: 29.12px; letter-spacing: -.7px; }
  .srw .srw-day { height: 106px; margin: 0 32px; }
  .srw .srw-ai-card { gap: 12px; }
  .srw .srw-day__mid b { font-size: 20px; line-height: 24px; letter-spacing: -.5px; }
  .srw .srw-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .srw .srw-card { padding: 15px; }
  .srw .srw-dash__row3 { grid-template-columns: minmax(0, 1fr); }
  .srw .srw-dash-time .srw-card__h { flex-wrap: wrap; }
  .srw .srw-dash-time .srw-card__tools { order: 3; width: 100%; }
  .srw .srw-dash-time .srw-card__expand { display: none; }
  .srw .srw-list, .srw .srw-todos, .srw .srw-notes, .srw .srw-sites { margin-top: 10px; }
  .srw .srw-legend { margin-top: 10px; }
  .srw .srw-chart { height: 168px; margin-left: 40px; }
  .srw .srw-read b { font-size: 13.5px; line-height: 19.575px; letter-spacing: -.27px; }
  .srw .srw-bud { grid-template-columns: minmax(0, 1fr); justify-items: center; gap: 20px; }
  .srw .srw-bud__trend { margin-top: 10px; }
  .srw .srw-bud__top { padding-bottom: 0; }
  .srw .srw-card__more--block { margin-top: 0; padding: 9px 0; }
  .srw .srw-donut { width: 106px; height: 106px; }
  .srw .srw-donut svg { width: 106px; height: 106px; }
  .srw .srw-bud__leg { width: 100%; }
  .srw .srw-quick { display: grid; gap: 10px; padding: 14px 18px; }
  .srw .srw-cal__w { height: 23.5px; }
  .srw .srw-cal__grid { row-gap: 3px; }
  .srw .srw-cal__d { width: 44px; height: 44px; }
  .srw .srw-quick__l { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); mask-image: none; }
  .srw .srw-quick__a { width: 100%; }
}

/* ── lo de la adaptación (DESPUÉS de los @container de la copia: los pisa en el mismo ancho) ──────────── */
.srw .srw-dash { padding: 24px 23px 40px; }
.srw .srw-quieta { opacity: .72; pointer-events: none; }
.srw .srw-vacio { flex: 1; min-height: 110px; display: grid; place-content: center; gap: 4px; margin-top: 12px; padding: 16px 12px; text-align: center; font-size: 13px; line-height: 19px; color: var(--muted); }
.srw .srw-vacio b { display: block; color: var(--text); font-weight: 600; }
.srw .srw-ai-card .srw-vacio { min-height: 0; margin: 0; color: #eef7f6bd; }
.srw .srw-ai-card .srw-vacio b { color: var(--on-ai); }
.srw [role='button'] { cursor: pointer; }
.srw [role='button'].srw-list__row:hover b { color: var(--accent-text); }
.srw .srw-btn, .srw .srw-card__more, .srw .srw-ibtn { text-decoration: none; }
.srw .srw-hchip--btn { cursor: pointer; transition: background-color .15s; }
.srw .srw-hchip--btn:hover { background: #fff; }
.srw .srw-hero__sub { max-width: 270px; }
.srw .srw-day__vacio { position: absolute; left: 0; right: 0; top: 46px; display: grid; justify-items: center; gap: 2px; text-align: center; font-size: 12.5px; font-weight: 500; line-height: 18px; color: var(--muted); }
.srw .srw-day__vacio b { font-size: 15px; font-weight: 700; color: var(--text); }
.srw .srw-day__mid span:last-child { max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.srw .srw-ai-card__tip span { min-width: 0; }
.srw .srw-pill--neutral { background: var(--well); color: var(--muted); }
.srw .srw-kpi__n { white-space: nowrap; }
.srw .srw-kpi__d--malo { color: var(--bad); }
.srw .srw-tile--mint .srw-kpi__d--malo { color: var(--tile-bad); }
.srw .srw-select--quieto { width: auto; gap: 8px; }
.srw .srw-chart__act { stroke-dasharray: 1 0; }
.srw .srw-chart__today i { white-space: nowrap; }
.srw .srw-chart__today--fin i { transform: translateX(-100%); }
.srw .srw-chart__x span.srw-x--tel { display: none; }
.srw .srw-bars2 li[role='button'] { margin: -3px -8px; padding: 3px 8px; border-radius: 8px; transition: background-color .15s; }
.srw .srw-bars2 li[role='button']:hover { background: var(--surface-2); }
.srw .srw-bars2 span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.srw .srw-site__m b, .srw .srw-list__m b, .srw .srw-note__m b { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.srw .srw-site__r strong.srw-al-dia { color: var(--good); }
.srw .srw-list__r--malo { color: var(--bad); font-weight: 600; }
.srw .srw-cal__ev { min-width: 0; }
.srw .srw-cal__ev span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.srw .srw-cal__ev b { flex: none; font-weight: 700; }
.srw a.srw-cal__ev:hover span { color: var(--accent-text); }
.srw .srw-check { display: grid; place-items: center; padding: 0; color: var(--on-primary); }
.srw .srw-check svg { width: 14px; height: 14px; }
.srw .srw-check[aria-checked='true'] { background: var(--primary); border-color: var(--primary); }
.srw .srw-check:disabled { cursor: default; }
.srw .srw-todo.srw-is-done .srw-todo__t b { color: var(--muted); text-decoration: line-through; }
.srw .srw-todo__t { flex: 1; min-width: 0; display: grid; }
.srw .srw-todo__t b { font-size: 13.5px; font-weight: 600; line-height: 17.55px; }
.srw .srw-todo__t span { margin-top: 1px; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); }
.srw .srw-quick__l { scrollbar-width: thin; }
.srw button.srw-quick__a { cursor: pointer; color: var(--text); }
@media (hover: hover) {
  .srw .srw-kpi[data-lift] { transition: transform .5s cubic-bezier(.215, .61, .355, 1); }
  .srw .srw-kpi[data-lift]:hover { transform: translateY(-4px); transition-duration: .45s; }
}
@container srw (max-width: 1280px) {
  .srw .srw-hero__l { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .srw .srw-hero__sub { max-width: none; }
  .srw .srw-day { width: min(100%, 300px); justify-self: center; margin-top: 4px; }
}
@container srw (max-width: 1000px) {
  .srw .srw-dash { grid-template-columns: minmax(0, 1fr); }
  .srw .srw-dash__aside { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
  .srw .srw-dash__aside > .srw-cal { grid-row: span 2; }
}
@container srw (max-width: 700px) {
  .srw .srw-dash { padding: 17px 14px 40px; }
  .srw .srw-dash__aside { grid-template-columns: minmax(0, 1fr); }
  .srw .srw-dash__aside > .srw-cal { grid-row: auto; }
  .srw .srw-day { width: auto; justify-self: stretch; margin: 0 32px; }
  .srw .srw-chart__x span.srw-x--tel { display: block; }
  .srw .srw-chart__x span.srw-x--fuera { display: none; }
}
@media (prefers-reduced-motion: reduce) { .srw *, .srw *::before, .srw *::after { transition: none !important; animation: none !important; } }
`;
