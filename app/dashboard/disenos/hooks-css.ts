// =============================================================================
// hooks-css — la hoja de estilos de la hoja «Hooks y retención» con su diseño propio (la copia de Ondra)
// =============================================================================
// GENERADA por scratchpad/ond/armar-ond.py desde la hoja de la copia (docs/diseno/mockups-dashboard/hooks-ondra/ondra.css): todo
// adentro de `.ond`, cada clase con el prefijo `ond-`, sin el armazón de Ondra (la barra de la izquierda, la de arriba y la de abajo
// del teléfono, el logo, que es su dibujo, el interruptor de las campañas y los filtros por canal) y con @container en lugar de
// @media. Lo de la adaptación va al final (el paso de 1000 px, los vacíos y las filas que se tocan). Se escribió desde lo MEDIDO del
// demo: nada del código de la tienda.
// ⚠️ En un template literal no va ningún backtick (ni en un comentario) ni un «dólar con llave».
// =============================================================================

export const CSS_HOOKS = `
@font-face { font-family: 'Ondra Urbanist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/urbanist/v18/L0x-DF02iFML4hGCyMqlbS0.woff2) format('woff2'); }
.ond {
  container-type: inline-size; container-name: ond;
  --font: 'Ondra Urbanist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --bg: #eef0ec;
  --surface: #fbfcfa;
  --surface-2: #f3f5f1;
  --raised: #fff;
  --well: #14261f0e;
  --line: #14261f14;
  --line-2: #14261f29;
  --rim: inset 0 0 0 1px #14261f13;
  --shadow: 0 1px 2px #14261f0a, 0 10px 28px -20px #14261f4d;
  --text: #15201c;
  --muted: #4f5c56;
  --faint: #5f6c66;
  --primary: #c4461d;
  --on-primary: #fff;
  --primary-soft: #c4461d1a;
  --side: oklch(25% .035 165);
  --side-2: oklch(29% .04 165);
  --on-side: #e7efe9;
  --side-dim: #e7efe99e;
  --side-hover: #ffffff12;
  --ember: oklch(64% .16 42);
  --steel: oklch(60% .12 250);
  --gold: oklch(74% .14 78);
  --sea: oklch(61% .1 192);
  --moss: oklch(63% .13 138);
  --rose: oklch(62% .15 10);
  --slate: oklch(58% .035 240);
  --pine: oklch(53% .09 165);
  --clay: oklch(60% .08 55);
  --good: oklch(47% .12 150);
  --warn: oklch(52% .11 70);
  --bad: oklch(52% .18 25);
  --info: oklch(50% .12 250);
  --side-accent: oklch(80% .1 45);
  --r-card: 20px;
  --r-tile: 14px;
  --r-ctl: 12px;
  --gap: 16px;
  --ease: cubic-bezier(.2, .8, .2, 1);
  position: relative; padding: 4px 26px 56px; color: var(--text); background: var(--bg); font: 500 14px/20.3px var(--font); -webkit-font-smoothing: antialiased;
}
.ond *, .ond *::before, .ond *::after { box-sizing: border-box; }
.ond button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; padding: 0; }
.ond a { color: inherit; text-decoration: none; }
.ond h1, .ond h2, .ond h3, .ond p, .ond ul { margin: 0; }
.ond ul { padding: 0; list-style: none; }
.ond svg.ond-i { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.ond :focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

/* ── la copia ──────────────────────────────────────────────────────────────────────────────── */
.ond * { box-sizing: border-box; }
.ond .ond-btn { height: 44px; display: inline-flex; align-items: center; gap: 8px; padding: 0 18px; border-radius: 14px; font-size: 13.5px; font-weight: 600; line-height: 19.575px; white-space: nowrap; }
.ond .ond-btn--primary { background: var(--primary); color: var(--on-primary); box-shadow: 0 12px 24px -14px color-mix(in srgb, var(--primary) 90%, transparent); }
.ond .ond-btn--primary:hover { filter: brightness(1.12); }
.ond .ond-btn--ghost { background: var(--surface); box-shadow: var(--rim), var(--shadow); color: var(--text); }
.ond .ond-btn--ghost:hover { background: var(--surface-2); }
.ond .ond-ov__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin: 23px 0 22px; }
.ond .ond-ov__date { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--text); }
.ond .ond-ov__date .ond-i { width: 14px; height: 14px; color: var(--muted); }
.ond .ond-ov__title { margin-top: 2px; font-size: 37.44px; font-weight: 600; line-height: 38.9376px; letter-spacing: -.936px; }
.ond .ond-ov__title .ond-l { display: inline-block; }
.ond .ond-ov__lede { max-width: 500px; margin-top: 6px; font-size: 13.5px; font-weight: 500; line-height: 19.575px; color: var(--muted); }
.ond .ond-ov__lede b { color: var(--text); font-weight: 600; }
.ond .ond-ov__lede a { color: var(--primary); font-weight: 600; text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 3px; }
.ond .ond-ov__actions { display: flex; gap: 10px; }
.ond .ond-ov__grid { display: grid; gap: var(--gap); }
.ond .ond-ov__r1 { grid-template-columns: 747fr 365fr; align-items: start; }
.ond .ond-ov__r2 { grid-template-columns: 651fr 461fr; }
.ond .ond-ov__r3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.ond .ond-card { position: relative; min-width: 0; padding: 20px; border-radius: var(--r-card); background: var(--surface); box-shadow: var(--rim), 0 1px 2px #14261f0a, 0 10px 28px -20px #14261f4d; }
.ond .ond-ov__hero { min-height: 508px; }
.ond .ond-ov__mix { min-height: 525px; }
.ond .ond-ov__r2 > .ond-card { min-height: 476px; }
.ond .ond-ov__r3 > .ond-card { min-height: 570px; }
.ond .ond-card__h { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.ond .ond-card__t { font-size: 15px; font-weight: 600; line-height: 18.75px; letter-spacing: -.075px; }
.ond .ond-card__s { margin-top: 3px; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); }
.ond .ond-card__more { font-size: 12.5px; font-weight: 600; line-height: 18.125px; color: var(--primary); white-space: nowrap; }
.ond .ond-card__more:hover { text-decoration: underline; text-underline-offset: 3px; }
.ond .ond-seg { position: relative; display: inline-flex; gap: 2px; padding: 3px; border-radius: var(--r-ctl); background: var(--surface-2); box-shadow: var(--rim); }
.ond .ond-seg__pill { position: absolute; z-index: 0; top: 3px; left: 3px; height: 32px; border-radius: 9px; background: var(--raised); box-shadow: 0 1px 2px #14261f14, 0 6px 14px -8px #14261f4d; }
.ond .ond-seg__btn { position: relative; z-index: 1; height: 32px; padding: 0 12px; border-radius: 9px; font-size: 12.5px; font-weight: 600; line-height: 18.125px; color: var(--muted); transition: color .2s; }
.ond .ond-seg__btn[aria-pressed='true'] { color: var(--text); }
.ond .ond-seg--full { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); width: 100%; margin-top: 12px; }
.ond .ond-kpis { position: relative; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 12px; padding: 6px; border-radius: 18px; background: var(--surface-2); box-shadow: var(--rim); }
.ond .ond-kpis__bar { position: absolute; z-index: 0; top: 6px; left: 6px; width: calc((100% - 36px) / 4); height: 108px; border-radius: 14px; background: var(--raised); box-shadow: 0 1px 2px #14261f0f, 0 8px 18px -10px #14261f4d; }
.ond .ond-kpi { position: relative; z-index: 1; height: 108px; display: grid; align-content: start; gap: 4px; padding: 12px 14px; border-radius: 14px; text-align: left; }
.ond .ond-kpi__l { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; line-height: 18.125px; color: var(--muted); }
.ond .ond-kpi[aria-pressed='true'] .ond-kpi__l { color: var(--text); }
.ond .ond-kpi__i { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 7px; background: var(--well); color: var(--muted); }
.ond .ond-kpi__i .ond-i { width: 13px; height: 13px; }
.ond .ond-kpi[aria-pressed='true'] .ond-kpi__i { background: var(--tone); color: #fff; }
.ond .ond-kpi__v { font-size: 22px; font-weight: 600; line-height: 24.2px; letter-spacing: -.33px; }
.ond .ond-kpi__d { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; line-height: 17.4px; color: var(--muted); }
.ond .ond-chg { display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; border-radius: 6px; font-size: 12px; font-weight: 700; line-height: 17.4px; }
.ond .ond-chg .ond-i { width: 11px; height: 11px; stroke-width: 2.4; }
.ond .ond-chg--up { color: var(--good); background: color-mix(in srgb, var(--good) 12%, transparent); }
.ond .ond-chg--down { color: var(--bad); background: color-mix(in srgb, var(--bad) 10%, transparent); }
.ond .ond-kpi--ember { --tone: var(--ember); }
.ond .ond-kpi--pine { --tone: var(--pine); }
.ond .ond-kpi--steel { --tone: var(--steel); }
.ond .ond-kpi--gold { --tone: var(--gold); }
.ond .ond-chart { position: relative; height: 262px; margin-top: 16px; }
.ond .ond-chart svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.ond .ond-chart__ax { font: 600 12px var(--font); fill: var(--text); }
.ond .ond-chart__x { font: 500 12px var(--font); fill: var(--muted); }
.ond .ond-chart__pin circle { fill: var(--surface); stroke-width: 2.6; transition: r .2s var(--ease); }
.ond .ond-chart__pin:hover circle { fill: var(--c); }
.ond .ond-legend { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 0; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--text); }
.ond .ond-legend span { display: inline-flex; align-items: center; gap: 7px; }
.ond .ond-legend i { width: 10px; height: 10px; border-radius: 3px; background: var(--ember); }
.ond .ond-legend i.ond-dash { width: 14px; height: 2px; border-radius: 0; background: linear-gradient(90deg, var(--muted) 0 5px, transparent 5px 9px, var(--muted) 9px 14px); }
.ond .ond-legend i.ond-ring { width: 10px; height: 10px; border-radius: 50%; background: none; border: 2px solid var(--ember); }
.ond .ond-mix__bar { display: flex; gap: 4px; height: 14px; margin-top: 14px; }
.ond .ond-mix__bar span { border-radius: 4px; transform-origin: 0 50%; }
.ond .ond-mix__rows { display: grid; gap: 16px; margin-top: 18px; }
.ond .ond-mix__row { display: grid; grid-template-columns: minmax(0, 1fr) auto 34px; align-items: baseline; column-gap: 12px; row-gap: 6px; }
.ond .ond-mix__n { display: flex; align-items: baseline; gap: 6px; min-width: 0; font-size: 14px; font-weight: 600; line-height: 20.3px; }
.ond .ond-mix__n::before { content: ''; width: 7px; height: 7px; margin-right: 2px; border-radius: 50%; background: var(--c); transform: translateY(-2px); }
.ond .ond-mix__n small { font-size: 12px; font-weight: 500; color: var(--muted); }
.ond .ond-mix__v { font-size: 14px; font-weight: 600; line-height: 20.3px; }
.ond .ond-mix__p { font-size: 12px; font-weight: 600; line-height: 17.4px; color: var(--muted); text-align: right; }
.ond .ond-mix__track { grid-column: 1 / -1; height: 6px; border-radius: 99px; background: var(--well); overflow: hidden; }
.ond .ond-mix__track i { display: block; height: 100%; border-radius: 99px; background: var(--c); transform-origin: 0 50%; }
.ond .ond-mix__foot { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line); font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); }
.ond .ond-mix__foot b { color: var(--text); font-weight: 600; }
.ond .ond-t-gold { --c: var(--gold); }
.ond .ond-t-moss { --c: var(--moss); }
.ond .ond-t-sea { --c: var(--sea); }
.ond .ond-t-steel { --c: var(--steel); }
.ond .ond-t-slate { --c: var(--slate); }
.ond .ond-t-rose { --c: var(--rose); }
.ond .ond-t-ember { --c: var(--ember); }
.ond .ond-t-pine { --c: var(--pine); }
.ond .ond-t-clay { --c: var(--clay); }
.ond .ond-live { margin-top: 18px; }
.ond .ond-live__row { display: grid; grid-template-columns: 40px minmax(0, 1fr) 124px 62px 76px 44px; align-items: center; gap: 16px; padding: 11.5px 0; border-top: 1px dashed var(--line-2); }
.ond .ond-live__row:first-child { border-top: 0; padding-top: 7px; }
.ond .ond-live__ic { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; background: color-mix(in srgb, var(--c) 16%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 28%, transparent); color: color-mix(in srgb, var(--c) 70%, var(--text)); }
.ond .ond-live__name { min-width: 0; text-align: left; }
.ond .ond-live__name b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; line-height: 20.3px; }
.ond .ond-live__name small { display: block; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); }
.ond .ond-live__bud { display: grid; gap: 6px; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); }
.ond .ond-live__bud i { display: block; height: 4px; border-radius: 99px; background: var(--well); overflow: hidden; }
.ond .ond-live__bud i span { display: block; height: 100%; border-radius: 99px; background: var(--c); transform-origin: 0 50%; }
.ond .ond-live__fig { text-align: right; }
.ond .ond-live__fig b { display: block; font-size: 14px; font-weight: 600; line-height: 16.8px; }
.ond .ond-live__fig small { display: block; font-size: 11px; font-weight: 500; line-height: 13.2px; color: var(--muted); }
.ond .ond-fun { display: grid; margin-top: 10px; }
.ond .ond-fun__step { display: grid; grid-template-columns: 112px minmax(0, 1fr) 70px; align-items: center; gap: 12px; min-height: 40px; }
.ond .ond-fun__l { font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--text); }
.ond .ond-fun__l small { display: block; font-size: 11px; font-weight: 600; line-height: 14px; color: var(--bad); }
.ond .ond-fun__track { display: flex; justify-content: center; }
.ond .ond-fun__bar { height: 30px; border-radius: 8px; background: color-mix(in srgb, var(--ember) calc(100% - var(--k, 0) * 14%), var(--surface)); transform-origin: 50% 50%; }
.ond .ond-fun__v { text-align: right; }
.ond .ond-fun__v b { display: block; font-size: 14px; font-weight: 600; line-height: 16.1px; }
.ond .ond-fun__v small { display: block; font-size: 12px; font-weight: 600; line-height: 13.8px; color: var(--muted); }
.ond .ond-fun__step.ond-is-leak { min-height: 44px; }
.ond .ond-fun__step.ond-is-leak .ond-fun__v small { color: var(--bad); }
.ond .ond-hot { display: grid; gap: 2px; margin-top: 14px; }
.ond .ond-hot__row { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto 36px; align-items: center; gap: 12px; height: 57px; margin: 0 -12px; padding: 0 12px; border-radius: 14px; text-align: left; transition: background-color .25s var(--ease); }
.ond .ond-hot__row:hover { background: var(--surface-2); }
.ond .ond-av { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; background: color-mix(in srgb, var(--c) 22%, var(--surface)); font-size: 12.5px; font-weight: 700; line-height: 18.125px; letter-spacing: .125px; color: var(--text); }
.ond .ond-hot__n { min-width: 0; }
.ond .ond-hot__n b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; line-height: 20.3px; }
.ond .ond-hot__n small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 500; line-height: 17.4px; color: var(--muted); }
.ond .ond-hot__v { display: grid; justify-items: end; gap: 3px; }
.ond .ond-hot__v b { font-size: 14px; font-weight: 600; line-height: 20.3px; }
.ond .ond-tag { display: inline-flex; align-items: center; gap: 5px; padding: 0 7px; border-radius: 99px; background: color-mix(in srgb, var(--gold) 16%, transparent); font-size: 11px; font-weight: 600; line-height: 15.95px; color: color-mix(in srgb, var(--gold) 55%, var(--text)); }
.ond .ond-tag::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: var(--gold); }
.ond .ond-ring { position: relative; width: 36px; height: 36px; display: grid; place-items: center; font-size: 11px; font-weight: 700; line-height: 15.95px; }
.ond .ond-ring svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.ond .ond-gauge { position: relative; width: 258px; margin: 16px auto 0; }
.ond .ond-gauge svg { display: block; width: 100%; height: auto; overflow: visible; }
.ond .ond-gauge__v { margin-top: -3px; text-align: center; font-size: 26px; font-weight: 700; line-height: 27.3px; letter-spacing: -.65px; }
.ond .ond-gauge__s { text-align: center; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); }
.ond .ond-pace__note { margin: 14px auto 0; max-width: 250px; text-align: center; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); }
.ond .ond-pace__note b { color: var(--text); font-weight: 600; }
.ond .ond-pace { display: grid; gap: 8px; margin-top: 13px; padding-top: 12px; border-top: 1px dashed var(--line-2); }
.ond .ond-pace li { display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; font-weight: 500; line-height: 18.125px; }
.ond .ond-pace li span { display: inline-flex; align-items: center; gap: 8px; }
.ond .ond-pace li span::before { content: ''; width: 7px; height: 7px; border-radius: 2px; background: var(--c); }
.ond .ond-pace li b { font-size: 12px; font-weight: 700; line-height: 17.4px; }
.ond .ond-ok { color: var(--good); }
.ond .ond-over { color: var(--bad); }
.ond .ond-under { color: var(--warn); }
.ond .ond-feed { display: grid; margin-top: 14px; }
.ond .ond-feed li { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 14px; padding: 10px 0; border-top: 1px dashed var(--line-2); }
.ond .ond-feed li:first-child { border-top: 0; }
.ond .ond-feed .ond-av { width: 30px; height: 30px; font-size: 11px; line-height: 15.95px; letter-spacing: .11px; }
.ond .ond-feed p { font-size: 13.5px; font-weight: 500; line-height: 19.575px; }
.ond .ond-feed small { display: flex; align-items: center; gap: 6px; margin-top: 2px; font-size: 12px; font-weight: 500; line-height: 17.4px; color: var(--muted); }
.ond .ond-feed small .ond-i { width: 13px; height: 13px; }

@container ond (max-width: 760px) {
  .ond { --gap: 12px; }
  .ond .ond-ov__head { display: block; margin: 20px 0 20px; }
  .ond .ond-ov__title { margin-top: 4px; }
  .ond .ond-ov__title { font-size: 26px; line-height: 27.04px; letter-spacing: -.65px; }
  .ond .ond-ov__actions { display: grid; grid-template-columns: auto minmax(0, 1fr); margin-top: 14px; }
  .ond .ond-ov__r1, .ond .ond-ov__r2, .ond .ond-ov__r3 { grid-template-columns: minmax(0, 1fr); }
  .ond .ond-card { padding: 16px; }
  .ond .ond-ov__hero, .ond .ond-ov__mix, .ond .ond-ov__r2 > .ond-card, .ond .ond-ov__r3 > .ond-card { min-height: 0; }
  .ond .ond-card__h--seg { flex-wrap: wrap; }
  .ond .ond-card__h--seg .ond-seg { order: 3; }
  .ond .ond-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ond .ond-kpis__bar { width: calc((100% - 20px) / 2); height: 91px; }
  .ond .ond-kpi { height: 91px; padding: 10px; }
  .ond .ond-kpi__i { display: none; }
  .ond .ond-kpi__v { font-size: 18px; line-height: 19.8px; letter-spacing: -.27px; }
  .ond .ond-card__h--seg .ond-seg__btn, .ond .ond-card__h--seg .ond-seg__pill { height: 28px; }
  .ond .ond-chart { height: 224px; }
  .ond .ond-live__row { grid-template-columns: 36px minmax(0, 1fr) 54px 44px; gap: 8px; padding: 12px 0; }
  .ond .ond-live__row:first-child { padding-top: 10px; }
  .ond .ond-fun { gap: 4px; }
  .ond .ond-fun__step.ond-is-leak { min-height: 40px; }
  .ond .ond-live__ic { width: 36px; height: 36px; }
  .ond .ond-hot__v .ond-tag { display: none; }
  .ond .ond-live__bud, .ond .ond-live__fig--rev { display: none; }
  .ond .ond-fun__step { grid-template-columns: 96px minmax(0, 1fr) 56px; }
}

/* ── lo de la adaptación (DESPUÉS de los @container de la copia: los pisa en el mismo ancho) ──────────── */
.ond .ond-ov__r2, .ond .ond-ov__r3 { margin-top: var(--gap); }
.ond .ond-quieta { opacity: .72; pointer-events: none; }
.ond .ond-sin { color: var(--faint); }
.ond .ond-vacio { min-height: 120px; display: grid; place-content: center; padding: 12px; text-align: center; font-size: 12.5px; line-height: 18.125px; color: var(--muted); }
.ond .ond-chart .ond-vacio { height: 100%; }
.ond [role='button'] { cursor: pointer; }
.ond a.ond-btn { text-decoration: none; }
.ond .ond-c-vacia { min-height: 180px; display: grid; align-content: center; justify-items: center; gap: 6px; text-align: center; }
.ond .ond-kpi { cursor: pointer; }
.ond .ond-kpi__d { flex-wrap: wrap; }
.ond .ond-mix__n { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ond .ond-live__row[role='button'] { margin: 0 -8px; padding-left: 8px; padding-right: 8px; border-radius: 12px; transition: background-color .25s var(--ease); }
.ond .ond-live__row[role='button']:hover { background: var(--surface-2); }
.ond .ond-live__bud b { color: var(--text); font-weight: 600; }
.ond .ond-live__ir { width: 32px; height: 32px; display: grid; place-items: center; justify-self: end; border-radius: 10px; color: var(--muted); box-shadow: var(--rim); transition: color .2s; }
.ond .ond-live__row[role='button']:hover .ond-live__ir { color: var(--text); }
.ond .ond-feed small { display: block; }
.ond .ond-feed .ond-av .ond-i { width: 14px; height: 14px; color: color-mix(in srgb, var(--c) 70%, var(--text)); }
.ond .ond-pace li b { color: var(--muted); }
.ond .ond-pace li b.ond-ok { color: var(--good); }
.ond .ond-pace li b.ond-over { color: var(--bad); }
@container ond (max-width: 1000px) {
  .ond .ond-ov__r1, .ond .ond-ov__r2 { grid-template-columns: minmax(0, 1fr); }
  .ond .ond-ov__r3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ond .ond-ov__r3 > .ond-card:last-child { grid-column: 1 / -1; }
  .ond .ond-ov__hero, .ond .ond-ov__mix, .ond .ond-ov__r2 > .ond-card, .ond .ond-ov__r3 > .ond-card { min-height: 0; }
}
@container ond (max-width: 760px) {
  .ond { padding: 0 14px 40px; }
  .ond .ond-ov__r3 { grid-template-columns: minmax(0, 1fr); }
  .ond .ond-ov__r3 > .ond-card:last-child { grid-column: auto; }
  .ond .ond-live__ir { display: none; }
  .ond .ond-live__row { grid-template-columns: 36px minmax(0, 1fr) 54px 54px; }
  .ond .ond-live__fig--rev { display: block; }
}
.ond .ond-mix__bar span { background: var(--c); }
.ond .ond-ov__r3 > .ond-card { min-height: 0; }
@media (prefers-reduced-motion: reduce) { .ond *, .ond *::before, .ond *::after { transition: none !important; animation: none !important; } }
`;
