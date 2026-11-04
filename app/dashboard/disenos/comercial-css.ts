// =============================================================================
// comercial-css — la hoja de estilos del DISEÑO de la hoja Comercial: la copia de Selvar, sólo de esta hoja
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco». Es docs/diseno/mockups-dashboard/comercial-selvar/selvar.css (escrita desde lo MEDIDO del demo: valores.json, las
// capturas y el INFORME; nada del código de la tienda) con todo adentro de `.cm` y cada clase con el prefijo `cm-`, para no
// tocar nada del resto del Dashboard. Sin la barra lateral ni la de arriba de Selvar: en MaKo las pone la app.
//
// Lo que se suma a la copia, y es de la adaptación (comercial-selvar/mako.html): los vacíos, las filas que se tocan y el
// medio de 761 a 1040, que Selvar no tiene medido (sus capturas son 1440 y 390).
//
// ⚠️ ESTA HOJA ES SÓLO DE COMERCIAL: otra hoja con diseño escribe la suya (la de su demo), no reusa ésta.
// ⚠️ EL TELÉFONO VA POR @container (el ancho del lienzo), no por el de la ventana, y DESPUÉS del medio: dos @container que se
//    pisan los decide el orden (docs/hallazgos-templates-dashboard.md §18).
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.
// =============================================================================

export const CSS_COMERCIAL = `
.cm {
  container-type: inline-size; container-name: cm;
  --font: "Urbanist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --bg: #eceef2; --card: #fbfbfc; --card-2: #f3f4f7; --well: #151c2e0e; --line: #151c2e14; --line-2: #151c2e26;
  --shadow: 0 1px 2px #151c2e0a, 0 12px 32px -22px #151c2e47;
  --text: #151a26; --muted: #586073; --faint: #767e90; --primary: #2a4fd0; --on-primary: #f6f8ff; --ink: #151a26; --on-ink: #f3f4f7;
  --c-cobalt: #2f56d6; --c-amber: #e3952a; --c-amber-solid: #ec9f33; --c-sky: #6b98ee; --c-coral: #e0705a; --c-teal: #17948a; --c-slate: #8890a3;
  --c-good: #138a70; --c-bad: #cf4436;
  --t-good: #0a6853; --t-bad: #ad3327; --t-amber: #875100;
  --tile-feature: #2a4fd0; --tile-feature-top: #3a62e6; --on-feature: #f4f6fd; --on-feature-dim: #f4f6fdc7;
  --av-cobalt: #d7defa; --av-cobalt-t: #233f9e; --av-amber: #f6e2bb; --av-amber-t: #6f4400; --av-sky: #d9e7fd; --av-sky-t: #24508f;
  --av-coral: #f7d8cf; --av-coral-t: #8f3320; --av-teal: #cfe9e5; --av-teal-t: #0b5c54; --av-sand: #eee2cf; --av-sand-t: #634621;
  --av-slate: #e0e3ea; --av-slate-t: #3e4658;
  --r-card: 22px; --r-tile: 18px; --r-ctl: 12px; --gap: 16px; --gutter: clamp(16px, 2vw, 32px);
  --ease: cubic-bezier(.2, .8, .2, 1);
  background: var(--bg); color: var(--text); font-family: var(--font); font-size: 14px; -webkit-font-smoothing: antialiased;
}
.cm *, .cm *::before, .cm *::after { box-sizing: border-box; }
.cm svg.cm-i { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.cm button { font: inherit; color: inherit; }
.cm a { color: inherit; text-decoration: none; }
.cm .cm-page { padding: 24px var(--gutter) 64px; }

/* ── los controles ─────────────────────────────────────────────────────────────────────────── */
.cm .cm-btn { height: 40px; display: inline-flex; align-items: center; gap: 8px; padding: 0 16px; border-radius: var(--r-ctl); border: 1px solid var(--line); background: var(--card); color: var(--text); font-size: 13.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.cm .cm-btn:hover:not(:disabled) { background: var(--card-2); }
.cm .cm-btn--primary { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
.cm .cm-btn--primary:hover:not(:disabled) { background: color-mix(in srgb, var(--primary) 88%, var(--text)); }
.cm .cm-btn--ink { background: var(--ink); border-color: var(--ink); color: var(--on-ink); }
.cm .cm-btn--ink:hover:not(:disabled) { background: color-mix(in srgb, var(--ink) 86%, var(--bg)); }
.cm .cm-btn--sm { height: 32px; padding: 0 12px; border-radius: 10px; font-size: 12.5px; gap: 7px; }
.cm .cm-ibtn { width: 32px; height: 32px; flex: none; display: grid; place-items: center; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--text); cursor: pointer; }
.cm .cm-ibtn:hover { background: var(--card-2); border-color: var(--line-2); }
.cm .cm-ibtn--lg { width: 40px; height: 40px; border-radius: var(--r-ctl); }
.cm .cm-xbtn { width: 28px; height: 28px; display: grid; place-items: center; border: 0; background: none; border-radius: 8px; color: var(--text); cursor: pointer; }
.cm .cm-xbtn:hover { background: var(--well); }
.cm .cm-av { width: 24px; height: 24px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 10px; font-weight: 700; letter-spacing: -.1px; background: var(--b, var(--av-cobalt)); color: var(--t, var(--av-cobalt-t)); }
.cm .cm-av--lg { width: 32px; height: 32px; font-size: 11px; letter-spacing: -.11px; }
.cm .cm-chip { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.cm .cm-chip--bad { background: color-mix(in srgb, var(--c-bad) 14%, transparent); color: var(--t-bad); }
.cm .cm-chip--good { background: color-mix(in srgb, var(--c-good) 14%, transparent); color: var(--t-good); }
.cm .cm-chip--dot::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.cm .cm-chip--lg { height: 24px; padding: 0 10px; font-size: 12px; }
.cm .cm-seg { display: inline-flex; padding: 3px; border-radius: var(--r-ctl); background: var(--card-2); }
.cm .cm-seg__opt { height: 32px; padding: 0 14px; border: 0; border-radius: 9px; background: none; color: var(--muted); font-size: 13.5px; font-weight: 600; cursor: pointer; }
.cm .cm-seg__opt:hover { color: var(--text); }
.cm .cm-seg__opt[aria-pressed="true"] { background: var(--card); color: var(--text); box-shadow: 0 1px 2px #151c2e1f; }
.cm .cm-up { color: var(--t-good); } .cm-down { color: var(--t-bad); }

/* ── la página ─────────────────────────────────────────────────────────────────────────────── */
.cm .cm-hero { display: flex; align-items: flex-end; gap: 24px; padding: 3px 0 0; min-height: 126px; margin-bottom: 16px; }
.cm .cm-hero__txt { flex: 1; min-width: 0; }
.cm .cm-hero__date { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; color: var(--muted); line-height: 18.125px; }
.cm .cm-hero h1 { margin: 9px 0 8px; font-size: 37.44px; font-weight: 600; line-height: 38.94px; letter-spacing: -.936px; }
.cm .cm-hero p { margin: 0; max-width: 540px; font-size: 14px; font-weight: 500; line-height: 20.3px; color: var(--muted); }
.cm .cm-hero p b { color: var(--text); font-weight: 600; }
.cm .cm-hero__btns { display: flex; gap: 8px; padding-bottom: 6px; }
.cm .cm-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: var(--gap); grid-template-areas: "run run run run cop cop" "t1 t2 t3 t4 cop cop" "boo boo boo boo whe whe"; }
.cm .cm-row4 { display: grid; grid-template-columns: 365fr 460fr 270fr; gap: var(--gap); margin-top: var(--gap); }
.cm .cm-card { background: var(--card); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); padding: 20px; min-width: 0; }
.cm .cm-card__h { display: flex; align-items: flex-start; gap: 12px; }
.cm .cm-card__h > div:first-child { flex: 1; min-width: 0; }
.cm .cm-card h2 { margin: 0; font-size: 15px; font-weight: 600; line-height: 18.75px; letter-spacing: -.075px; }
.cm .cm-card__sub { margin-top: 3px; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); }

/* el trimestre */
.cm .cm-runway { grid-area: run; padding: 24px 24px 20px; display: flex; flex-direction: column; }
.cm .cm-runway__top { display: flex; justify-content: space-between; gap: 16px; }
.cm .cm-runway__k { display: flex; align-items: center; gap: 10px; font-size: 13.5px; font-weight: 500; color: var(--muted); }
.cm .cm-runway__big { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; }
.cm .cm-runway__big strong { font-size: 34px; font-weight: 600; line-height: 34px; letter-spacing: -.85px; }
.cm .cm-runway__vs { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 500; color: var(--muted); }
.cm .cm-runway__vs b { font-weight: 700; }
.cm .cm-runway__quota { text-align: right; font-size: 12px; font-weight: 500; color: var(--muted); line-height: 15px; }
.cm .cm-runway__quota strong { display: block; margin: 0; font-size: 22px; font-weight: 600; line-height: 27.5px; letter-spacing: -.22px; color: var(--text); }
.cm .cm-track { position: relative; margin-top: 54px; height: 54px; }
.cm .cm-track__bar { position: absolute; inset: 0; display: flex; border-radius: 27px; overflow: hidden; background: repeating-linear-gradient(135deg, #e3e6ec 0 6px, #eef0f4 6px 12px); }
.cm .cm-track__seg { position: relative; height: 100%; }
.cm .cm-track__seg i { position: absolute; top: 20%; bottom: 20%; width: 1px; background: #ffffff59; }
.cm .cm-track__seg--won { background: var(--c-cobalt); } .cm-track__seg--commit { background: var(--c-amber); }
.cm .cm-track__seg--best { background: #bccdf5; box-shadow: inset -2px 0 0 var(--c-sky); }
.cm .cm-track__pace { position: absolute; top: -13px; bottom: -11px; width: 2px; margin-left: -1px; background: var(--ink); }
.cm .cm-track__pace::before { content: ""; position: absolute; top: -5px; left: -4px; width: 10px; height: 10px; border-radius: 50%; background: var(--ink); }
.cm .cm-track__pace span { position: absolute; top: calc(100% + 2px); left: 8px; white-space: nowrap; font-size: 12px; font-weight: 700; line-height: 17.4px; }
.cm .cm-track__pace small { display: block; font-weight: 500; color: var(--muted); }
.cm .cm-track__fc { position: absolute; top: -34px; height: 17px; border-radius: 9px; border: 1px dashed var(--c-amber); background: color-mix(in srgb, var(--c-amber) 20%, var(--card)); }
.cm .cm-track__fc::after { content: ""; position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; background: var(--c-amber); box-shadow: 0 0 0 2px #fff; }
.cm .cm-track__fc span { position: absolute; bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%); white-space: nowrap; font-size: 12px; font-weight: 700; color: var(--t-amber); }
.cm .cm-track__flag { position: absolute; right: 15px; top: -11px; color: var(--text); }
.cm .cm-legend { display: flex; flex-wrap: wrap; gap: 8px 24px; margin-top: 46px; font-size: 13.5px; font-weight: 500; color: var(--muted); }
.cm .cm-legend span { display: inline-flex; align-items: center; gap: 8px; }
.cm .cm-legend b { color: var(--text); font-weight: 600; }
.cm .cm-sw { width: 12px; height: 12px; border-radius: 3px; background: var(--c, var(--c-cobalt)); flex: none; }
.cm .cm-sw--hatch { background: repeating-linear-gradient(135deg, #cfd3dc 0 2px, #eef0f4 2px 4px); }
.cm .cm-sw--dash { width: 12px; height: 2px; border-radius: 1px; background: var(--ink); }
.cm .cm-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; margin: 22px 0 0; border: 1px solid var(--line); border-radius: 16px; background: var(--line); overflow: hidden; }
.cm .cm-stats > div { background: var(--card); padding: 12px 16px; }
.cm .cm-stats dt { font-size: 12px; font-weight: 600; color: var(--muted); line-height: 17.4px; }
.cm .cm-stats dd { margin: 4px 0 0; font-size: 22px; font-weight: 600; line-height: 31.9px; letter-spacing: -.22px; }
.cm .cm-stats dd small { line-height: 1; margin-left: 6px; font-size: 12px; font-weight: 500; color: var(--muted); letter-spacing: 0; }

/* el copiloto */
.cm .cm-copilot { grid-area: cop; display: flex; flex-direction: column; gap: 14px; background: linear-gradient(180deg, #e8ebf9 0%, var(--card) 42%); }
.cm .cm-copilot__h { display: flex; align-items: center; gap: 12px; }
.cm .cm-copilot__h > div { flex: 1; }
.cm .cm-copilot__orb { width: 40px; height: 40px; flex: none; }
.cm .cm-copilot__say { margin: 2px 0 20px; font-size: 17px; font-weight: 600; line-height: 22.95px; letter-spacing: -.17px; }
.cm .cm-sigs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.cm .cm-sig { display: flex; gap: 12px; padding: 12px; border-radius: 16px; background: var(--card); border: 1px solid var(--line); }
.cm .cm-sig__ico { width: 34px; height: 34px; flex: none; border-radius: 10px; display: grid; place-items: center; }
.cm .cm-sig__ico--bad { background: color-mix(in srgb, var(--c-bad) 14%, transparent); color: var(--t-bad); }
.cm .cm-sig__ico--good { background: color-mix(in srgb, var(--c-good) 14%, transparent); color: var(--t-good); }
.cm .cm-sig__b { flex: 1; min-width: 0; }
.cm .cm-sig__t { font-size: 13.5px; font-weight: 600; line-height: 17.55px; }
.cm .cm-sig__m { display: flex; align-items: center; gap: 8px; height: 22px; margin: 10px 0 6px; font-size: 12px; font-weight: 500; color: var(--muted); }
.cm .cm-sig__a { display: flex; align-items: center; gap: 12px; }
.cm .cm-ask { margin-top: auto; display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 6px 0 14px; border-radius: 16px; border: 1px solid var(--line-2); background: var(--card); }
.cm .cm-ask .cm-i { color: var(--c-cobalt); }
.cm .cm-ask input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font: 500 13.5px var(--font); color: var(--text); }
.cm .cm-ask input::placeholder { color: var(--muted); }
.cm .cm-ask .cm-btn--ink { width: 36px; height: 36px; padding: 0; justify-content: center; border-radius: 10px; }

/* los cuatro números */
.cm .cm-tile { display: grid; align-content: start; gap: 6px; padding: 16px 16px 10px; border-radius: var(--r-tile); background: var(--card); border: 1px solid var(--line); box-shadow: var(--shadow); min-width: 0; }
.cm .cm-tile--feature { background: linear-gradient(180deg, var(--tile-feature-top), var(--tile-feature)); border-color: transparent; color: var(--on-feature); }
.cm .cm-tile__k { display: flex; align-items: center; gap: 10px; font-size: 12.5px; font-weight: 600; color: var(--muted); line-height: 18.125px; }
.cm .cm-tile--feature .cm-tile__k { color: var(--on-feature-dim); }
.cm .cm-tile__ico { width: 30px; height: 30px; flex: none; border-radius: 9px; display: grid; place-items: center; background: var(--av-cobalt); color: var(--av-cobalt-t); }
.cm .cm-tile--feature .cm-tile__ico { background: #ffffff26; color: var(--on-feature); }
.cm .cm-tile__v { margin-top: 0; font-size: 22px; font-weight: 600; line-height: 31.9px; letter-spacing: -.22px; }
.cm .cm-tile__d { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-size: 12px; font-weight: 500; color: var(--muted); line-height: 17.4px; }
.cm .cm-tile__d b { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; }
.cm .cm-tile--feature .cm-tile__d { color: var(--on-feature-dim); } .cm-tile--feature .cm-tile__d b { color: var(--on-feature); }
.cm .cm-tile__p { margin-top: 2px; font-size: 12px; font-weight: 500; color: var(--muted); line-height: 17.4px; }
.cm .cm-tile__spark { display: block; width: 100%; height: 26px; margin-top: 5px; overflow: visible; }
.cm .cm-tile__spark path { fill: none; stroke: var(--c-cobalt); stroke-width: 2; stroke-linecap: round; }
.cm .cm-tile--feature .cm-tile__spark path { stroke: #ffffffe6; }
.cm .cm-t1 { grid-area: t1; } .cm-t2 { grid-area: t2; } .cm-t3 { grid-area: t3; } .cm-t4 { grid-area: t4; }

/* las ventas por semana */
.cm .cm-book { grid-area: boo; padding-bottom: 30px; }
.cm .cm-book .cm-legend { margin: 16px 0 15px; font-size: 12.5px; gap: 8px 16px; }
.cm .cm-chart { position: relative; height: 245px; }
.cm .cm-chart svg { width: 100%; height: 100%; overflow: visible; }
.cm .cm-chart .cm-gl { stroke: var(--line-2); stroke-dasharray: 2 4; }
.cm .cm-chart .cm-yl { font: 500 11px var(--font); fill: var(--muted); }
.cm .cm-chart .cm-xl { font: 500 12px var(--font); fill: var(--muted); text-anchor: middle; }
.cm .cm-chart .cm-b1 { fill: var(--c-cobalt); } .cm-chart .cm-b2 { fill: var(--c-amber); } .cm-chart .cm-b3 { fill: var(--c-sky); }
.cm .cm-chart .cm-pace { stroke: var(--ink); stroke-opacity: .6; stroke-width: 1.5; stroke-dasharray: 6 5; }
.cm .cm-chart g.col:hover rect { filter: brightness(1.08); }

/* dónde están */
.cm .cm-where { grid-area: whe; display: flex; flex-direction: column; }
.cm .cm-stages { list-style: none; margin: 22px 0 0; padding: 0; }
.cm .cm-stage { display: grid; grid-template-columns: minmax(0, 1fr) 138px 70px; align-items: center; gap: 12px; }
.cm .cm-stage__n { font-size: 13.5px; font-weight: 600; line-height: 16.2px; }
.cm .cm-stage__n small { display: block; font-size: 12px; font-weight: 500; color: var(--muted); line-height: 14.4px; }
.cm .cm-stage__bar { height: 11px; border-radius: 6px; background: var(--card-2); overflow: hidden; }
.cm .cm-stage__bar i { display: block; height: 100%; border-radius: 6px; background: var(--c, var(--c-slate)); }
.cm .cm-stage__v { text-align: right; font-size: 14px; font-weight: 600; }
.cm .cm-stage__mv { display: flex; align-items: center; gap: 6px; height: 32px; padding-left: 8px; font-size: 12px; font-weight: 500; color: var(--muted); }
.cm .cm-stages { margin-bottom: 20px; }
.cm .cm-where__foot { margin-top: auto; display: flex; align-items: center; gap: 8px; padding-top: 14px; border-top: 1px solid var(--line); font-size: 12.5px; font-weight: 500; color: var(--muted); }

/* hoy */
.cm .cm-today .cm-card__h { margin-bottom: 14px; }
.cm .cm-ag { list-style: none; margin: 0; padding: 0; }
.cm .cm-ag__row { display: grid; grid-template-columns: 74px 4px minmax(0, 1fr) 24px; align-items: center; gap: 12px; height: 54px; }
.cm .cm-ag__row.is-past { opacity: .55; }
.cm .cm-ag__t { font-size: 14px; font-weight: 600; line-height: 18.2px; }
.cm .cm-ag__t small, .cm .cm-ag__w small { display: block; font-size: 12px; font-weight: 500; color: var(--muted); line-height: 15.6px; }
.cm .cm-ag__bar { height: 34px; border-radius: 2px; background: var(--c, var(--c-slate)); }
.cm .cm-ag__w { min-width: 0; font-size: 14px; font-weight: 600; line-height: 18.2px; }
.cm .cm-ag__w b, .cm .cm-ag__w small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: inherit; }
.cm .cm-ag__w small { font-weight: 500; }
.cm .cm-ag__now { display: flex; align-items: center; gap: 8px; height: 25px; font-size: 12px; font-weight: 700; color: var(--t-bad); }
.cm .cm-ag__now::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--c-bad); }
.cm .cm-ag__now::after { content: ""; flex: 1; height: 2px; background: var(--c-bad); }

/* los que te necesitan */
.cm .cm-deals .cm-card__h { margin-bottom: 14px; }
.cm .cm-dl { list-style: none; margin: 0; padding: 0; }
.cm .cm-dl__row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto 24px; align-items: center; gap: 12px; height: 55px; border-top: 1px solid var(--line); }
.cm .cm-dl__row:first-child { border-top: 0; }
.cm .cm-dl__n { min-width: 0; font-size: 14px; font-weight: 600; line-height: 18.2px; }
.cm .cm-dl__n b, .cm .cm-dl__n small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: inherit; }
.cm .cm-dl__n small { font-size: 12px; font-weight: 500; color: var(--muted); line-height: 15.6px; }
.cm .cm-dl__v { text-align: right; font-size: 14px; font-weight: 600; line-height: 18.2px; }
.cm .cm-dl__v small { display: block; font-size: 12px; font-weight: 500; color: var(--muted); line-height: 15.6px; white-space: nowrap; }
.cm .cm-dl .cm-chip { height: 24px; padding: 0 10px; gap: 6px; font-size: 12px; }

/* la carrera */
.cm .cm-race .cm-card__h { margin-bottom: 13px; }
.cm .cm-rc { list-style: none; margin: 0; padding: 0; }
.cm .cm-rc__row { display: grid; grid-template-columns: 16px 32px minmax(0, 1fr) 40px; align-items: center; gap: 12px; height: 48px; }
.cm .cm-rc__pos { text-align: center; font-size: 12px; font-weight: 700; color: var(--muted); }
.cm .cm-rc__pos .cm-i { color: #a8700f; }
.cm .cm-rc__n { min-width: 0; font-size: 14px; font-weight: 600; line-height: 18px; }
.cm .cm-rc__bar { margin-top: 6px; height: 6px; border-radius: 3px; background: var(--card-2); overflow: hidden; }
.cm .cm-rc__bar i { display: block; height: 100%; border-radius: 3px; background: var(--c, var(--c-good)); }
.cm .cm-rc__v { text-align: right; font-size: 13.5px; font-weight: 600; }

/* ── lo de la adaptación ───────────────────────────────────────────────────────────────────── */
.cm .cm-vacio { padding: 14px 2px 4px; color: var(--muted); font-size: 13.5px; font-weight: 500; line-height: 19.575px; }
.cm .cm-fila { cursor: pointer; border-radius: 10px; transition: background-color .15s; }
.cm .cm-fila:hover { background: var(--card-2); }
.cm .cm-dl__row.fila { margin-left: -8px; margin-right: -8px; padding-left: 8px; padding-right: 8px; }
.cm .cm-rc__row.fila { margin-left: -8px; margin-right: -8px; padding-left: 8px; padding-right: 8px; }
.cm .cm-hero p a { color: var(--text); font-weight: 600; text-decoration: underline; text-decoration-color: var(--line-2); text-underline-offset: 3px; }
.cm .cm-hero p b { color: var(--text); font-weight: 600; }
.cm .cm-fila:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.cm .cm-chart g.cm-col { cursor: default; }

/* ── el medio (761 a 1040: no está medido en Selvar) ─────────────────────────────────────────── */
@container cm (max-width: 1040px) {
  .cm .cm-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-areas: "run run run run" "t1 t2 t3 t4" "cop cop whe whe" "boo boo boo boo"; }
  .cm .cm-row4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cm .cm-row4 > .cm-race { grid-column: 1 / -1; }
}

/* Sin la entrada de la página: el INFORME de Selvar no la trae (vive en un chunk que no muestra) y no se inventa. */

/* ── el teléfono (medido a 390) ────────────────────────────────────────────────────────────── */
@container cm (max-width: 760px) {
  .cm .cm-page { padding: 0 16px 40px; }
  .cm .cm-ibtn { width: 44px; height: 44px; border-radius: 12px; }
  .cm .cm-hero { display: block; min-height: 0; margin: 14px 0 20px; }
  .cm .cm-hero h1 { font-size: 28px; line-height: 29.12px; letter-spacing: -.7px; margin: 6px 0 10px; }
  .cm .cm-hero__btns { margin-top: 16px; padding: 0; }
  .cm .cm-hero__btns .cm-btn { flex: 1; justify-content: center; }
  .cm .cm-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; grid-template-areas: "run run" "t1 t2" "t3 t4" "cop cop" "boo boo" "whe whe"; }
  .cm .cm-row4 { grid-template-columns: minmax(0, 1fr); gap: 12px; margin-top: 12px; }
  .cm .cm-card { border-radius: 20px; padding: 16px; }
  .cm .cm-runway { padding: 18px 16px 16px; }
  .cm .cm-runway__top { flex-direction: column; gap: 6px; }
  .cm .cm-runway__quota { text-align: left; display: flex; align-items: baseline; gap: 8px; }
  .cm .cm-runway__quota strong { display: inline; font-size: 17px; margin: 0; }
  .cm .cm-runway__big strong { font-size: 30px; }
  .cm .cm-track { margin-top: 60px; height: 42px; }
  .cm .cm-track__bar { border-radius: 10px; }
  .cm .cm-legend { margin-top: 44px; gap: 6px 16px; font-size: 12.5px; }
  .cm .cm-stats { grid-template-columns: 1fr 1fr; margin-top: 18px; }
  .cm .cm-stats > div:last-child { grid-column: 1 / -1; }
  .cm .cm-stats dd { font-size: 17px; line-height: 24.65px; }
  .cm .cm-tile { padding: 14px 14px 8px; }
  .cm .cm-copilot { padding: 16px; }
  .cm .cm-copilot__say { font-size: 15px; line-height: 20.3px; letter-spacing: -.075px; }
  .cm .cm-sig { padding: 12px 12px 14px; }
  .cm .cm-sig__m { margin: 8px 0 12px; }
  .cm .cm-book .cm-card__h { flex-direction: column; gap: 12px; }
  .cm .cm-chart { height: 245px; }
  .cm .cm-stage { grid-template-columns: minmax(0, 1fr) 96px 60px; }
  .cm .cm-dl__row { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "n v" "c c"; height: auto; padding: 12px 0; row-gap: 8px; }
  .cm .cm-dl__row .cm-dl__n { grid-area: n; } .cm-dl__row .cm-dl__v { grid-area: v; } .cm-dl__row .cm-chip { grid-area: c; justify-self: start; } .cm-dl__row .cm-av { display: none; }
}
@media (prefers-reduced-motion: reduce) { .cm * { transition: none !important; } }
`;
