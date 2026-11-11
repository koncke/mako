// =============================================================================
// contenido-css — la hoja de estilos del DISEÑO de la hoja Contenido e IA: la copia de Orrery, sólo de esta hoja
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco». Es docs/diseno/mockups-dashboard/contenido-orrery/orrery.css (escrita desde lo MEDIDO del demo: valores.json, las
// capturas a 1440 y 390 y el INFORME; nada del código de la tienda) con todo adentro de `.orr` y cada clase con el prefijo `orr-`,
// para no tocar nada del resto del Dashboard. Sin el armazón de Orrery (la barra lateral y la de arriba): en MaKo lo pone la app.
// La arma scratchpad/orr/armar-orr.py desde la hoja de la copia: se cambia la copia y se vuelve a armar.
//
// Lo que se suma a la copia, y es de la adaptación (contenido-orrery/mako.html): los vacíos, las filas que se abren (con el fondo
// de «Recent requests» al pasar), los nombres largos que se cortan con «…», la lista de personas en el recuadro gris (en lugar del
// código para empezar), el período en la pastilla del gráfico (sin el verde de «Live») y un paso intermedio entre 700 y 1000 px de
// ancho, que Orrery no tiene.
//
// ⚠️ LA LETRA ES GEIST Y GEIST MONO, las de Orrery: acá se llaman «Orrery Geist» y «Orrery Geist Mono», con las URL de Google
//    Fonts, así la hoja no depende de cómo se llame la letra de la app.
// ⚠️ ESTA HOJA ES SÓLO DE CONTENIDO E IA: otra hoja con diseño escribe la suya (la de su demo), no reusa ésta.
// ⚠️ EL TELÉFONO VA POR @container (el ancho del lienzo), no por el de la ventana, y lo de la adaptación va DESPUÉS de los
//    @container de la copia: dos reglas iguales las decide el orden (docs/hallazgos-templates-dashboard.md §18).
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.
// ⚠️ PALETA DOBLE (6/11/2026, Martín: «los que vienen en dark mode deben acompañar siempre el white mode si el usuario lo tiene así en MaKo»):
//    nace clara y, con data-tema="oscuro" en html, la regla de abajo de la raíz cambia las MISMAS variables. Todo color de acá
//    va por variable, así el cambio es de CSS puro y en vivo.
// =============================================================================

export const CSS_CONTENIDO = `
@font-face { font-family: 'Orrery Geist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwSGFWfOw.woff2) format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'Orrery Geist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwcGFU.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: 'Orrery Geist Mono'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrkdmgPn.woff2) format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'Orrery Geist Mono'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrcdmg.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
.orr {
  container-type: inline-size; container-name: orr;
  --font: 'Orrery Geist', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono: 'Orrery Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  --a-950: #1f1a5c; --a-800: #2f2789; --a-700: #4a3dbf; --a-600: #5a4bd1; --a-400: #9488ec; --a-100: #ecebfc;
  --page: #f4f4f6; --panel: #ececf0; --card: #fdfdfd; --side: #f0f0f3; --hair: #e4e4ea; --hair-strong: #d5d5dd;
  --ink: #14141a; --muted: #5e5e6b; --faint: #6b6b78;
  --accent: #4a3dbf; --accent-soft: #ecebfc; --accent-ink: #2f2789; --on-accent: #f6f5ff;
  --good: #1d7745; --good-bg: #e3f3e8; --amber: #96580a; --amber-bg: #fcf0dc; --rose: #bb3434; --rose-bg: #fdeceb;
  --cat-1: #2a78d6; --cat-2: #eb6834; --cat-3: #1baf7a; --cat-4: #eda100;
  --r-lg: 16px; --r-md: 12px; --r-sm: 9px; --gap: 16px;
  --shadow: 0 1px 2px #14141a0a;
  --ease: cubic-bezier(.22, 1, .36, 1);
  --focus: 0 0 0 2px var(--card), 0 0 0 4px var(--a-600);
  --grid: #e8e8ed;
  position: relative; isolation: isolate; color: var(--ink); font: 400 15px/1.5 var(--font); -webkit-font-smoothing: antialiased;
  background: var(--page);
}
/* Modo oscuro de MaKo: las superficies suben de luminosidad, las líneas son opacas y el violeta se aclara sin cambiar de tono. */
.orr:where([data-tema="oscuro"] *) {
  --a-950: #d4d0ff; --a-800: #bdb7fb; --a-700: #9f95f4; --a-600: #a39af5; --a-400: #6f63d6; --a-100: #26234a;
  --page: #0e0e12; --panel: #20202a; --card: #17171c; --side: #131318; --hair: #2a2a33; --hair-strong: #3a3a46;
  --ink: #ededf0; --muted: #a8a8b4; --faint: #8c8c99;
  --accent: #8f84f2; --accent-soft: #8f84f229; --accent-ink: #c4beff; --on-accent: #100c33;
  --good: #5fcf8f; --good-bg: #17301f; --amber: #e8aa4a; --amber-bg: #3a2c10; --rose: #f08585; --rose-bg: #3b1d1f;
  --cat-1: #5a9be8; --cat-2: #f08655; --cat-3: #35c994; --cat-4: #f0b52e;
  --shadow: 0 1px 2px #0008;
  --grid: #2a2a33;
}
.orr *, .orr *::before, .orr *::after { box-sizing: border-box; }
.orr button { font: inherit; color: inherit; cursor: pointer; }
.orr a { color: inherit; text-decoration: none; }
.orr h1, .orr h2, .orr h3, .orr p, .orr ul { margin: 0; }
.orr ul { padding: 0; list-style: none; }
.orr svg.orr-i { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.orr :focus-visible { outline: none; box-shadow: var(--focus); }

/* ── la copia ──────────────────────────────────────────────────────────────────────────────── */
.orr * { box-sizing: border-box; }
.orr .orr-mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.orr .orr-main { padding: 27px 32px 56px; }
.orr .orr-phead { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.orr .orr-phead__k { font-size: 13px; font-weight: 500; line-height: 19.5px; color: var(--faint); }
.orr .orr-phead h1 { margin-top: 4px; font-size: 31px; font-weight: 600; line-height: 35.65px; letter-spacing: -.775px; }
.orr .orr-phead__s { margin-top: 6px; font-size: 15px; line-height: 22.5px; color: var(--muted); }
.orr .orr-phead__acts { display: flex; gap: 9px; }
.orr .orr-btn { height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 14px 0 13px; border-radius: var(--r-sm); border: 1px solid var(--hair-strong); background: var(--card); font-size: 14px; font-weight: 500; line-height: 21px; white-space: nowrap; transition: background-color .2s, border-color .2s; }
.orr .orr-btn svg { width: 16px; height: 16px; }
.orr .orr-btn--ghost:hover { background: var(--panel); }
.orr .orr-btn--acc { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
.orr .orr-btn--acc:hover { background: var(--a-600); }
.orr .orr-card { position: relative; border-radius: var(--r-lg); border: 1px solid var(--hair); background: var(--card); box-shadow: var(--shadow); padding: 19px; min-width: 0; }
.orr .orr-kpis { margin-top: 24px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.orr .orr-kpi { height: 208px; }
.orr .orr-kpi__t { font-size: 14px; font-weight: 500; line-height: 21px; color: var(--muted); }
.orr .orr-kpi__n { margin-top: 6px; font-size: 31px; font-weight: 600; line-height: 35.65px; letter-spacing: -.93px; }
.orr .orr-kpi__d { margin-top: 7px; display: flex; align-items: center; gap: 8px; font-size: 13px; line-height: 19.5px; color: var(--faint); }
.orr .orr-delta { height: 21px; display: inline-flex; align-items: center; gap: 4px; padding: 0 7px; border-radius: 6px; font-size: 13px; font-weight: 600; line-height: 19.5px; }
.orr .orr-delta svg { width: 12px; height: 12px; stroke-width: 2.2; }
.orr .orr-delta--up { background: var(--good-bg); color: var(--good); }
.orr .orr-delta--bad { background: var(--rose-bg); color: var(--rose); }
.orr .orr-kpi__s { position: relative; margin-top: 17px; height: 34px; }
.orr .orr-spark { display: block; width: 100%; height: 34px; overflow: visible; }
.orr .orr-spark__a { fill: var(--accent-soft); }
.orr .orr-spark__l { fill: none; stroke: var(--accent); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
.orr .orr-spark__dot { position: absolute; right: -2px; width: 5px; height: 5px; margin-top: -2.5px; border-radius: 50%; background: var(--accent); }
.orr .orr-kpi__e { margin-top: 8px; font-size: 13px; line-height: 19.5px; color: var(--faint); }
.orr .orr-kpi__s--line { margin-top: 15px; }
.orr .orr-budget { display: block; margin-top: 12px; height: 8px; border-radius: 4px; background: var(--panel); overflow: hidden; }
.orr .orr-budget i { display: block; height: 100%; border-radius: 4px; background: var(--accent); }
.orr .orr-kpi__f { margin-top: 6px; display: flex; justify-content: space-between; font-size: 13px; line-height: 19.5px; color: var(--faint); }
.orr .orr-row1 { margin-top: 16px; display: grid; grid-template-columns: minmax(0, 744fr) minmax(0, 364fr); gap: 16px; height: 475px; }
.orr .orr-row2 { margin-top: 16px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; height: 393px; }
.orr .orr-card__h { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.orr .orr-card__t { font-size: 16px; font-weight: 600; line-height: 24px; letter-spacing: -.16px; }
.orr .orr-card__s { margin-top: 2px; font-size: 14px; line-height: 21px; color: var(--muted); }
.orr .orr-lnk { font-size: 14px; font-weight: 500; line-height: 21px; color: var(--accent); }
.orr .orr-lnk:hover { color: var(--accent-ink); }
.orr .orr-live { margin-top: 1px; height: 24px; display: inline-flex; align-items: center; gap: 6px; padding: 0 10px 0 9px; border-radius: 12px; background: var(--good-bg); font-size: 13px; font-weight: 600; line-height: 19.5px; color: var(--good); }
.orr .orr-live i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.orr .orr-plot { position: relative; margin-top: 28px; height: 333px; margin-left: 46px; }
.orr .orr-plot__svg { display: block; width: 100%; height: 333px; overflow: visible; }
.orr .orr-plot__grid { fill: none; stroke: var(--grid); stroke-width: 1; vector-effect: non-scaling-stroke; }
.orr .orr-plot__line { fill: none; stroke: var(--accent); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
.orr .orr-plot__dot { position: absolute; width: 7px; height: 7px; margin: -3.5px 0 0 -3.5px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 2px var(--card); }
.orr .orr-plot__y { position: absolute; left: -46px; top: 0; bottom: 0; width: 35px; }
.orr .orr-plot__y span { position: absolute; right: 0; transform: translateY(-50%); font-size: 12px; line-height: 18px; color: var(--faint); }
.orr .orr-plot__y span:nth-child(1) { top: 0; }
.orr .orr-plot__y span:nth-child(2) { top: 33.333%; }
.orr .orr-plot__y span:nth-child(3) { top: 66.667%; }
.orr .orr-plot__y span:nth-child(4) { top: 100%; }
.orr .orr-plot__x { position: absolute; left: 0; right: 0; top: calc(100% + 8px); height: 18px; }
.orr .orr-plot__x span { position: absolute; transform: translateX(-50%); font-size: 12px; line-height: 18px; color: var(--faint); white-space: nowrap; }
.orr .orr-plot__x span:nth-child(1) { left: 0; transform: none; }
.orr .orr-plot__x .orr-mx { display: none; }
.orr .orr-plot__x .orr-mx--1 { left: 34.78%; }
.orr .orr-plot__x .orr-mx--2 { left: 69.57%; }
.orr .orr-plot__x span:nth-child(2) { left: 13.04%; }
.orr .orr-plot__x span:nth-child(3) { left: 26.09%; }
.orr .orr-plot__x span:nth-child(4) { left: 39.13%; }
.orr .orr-plot__x span:nth-child(5) { left: 52.17%; }
.orr .orr-plot__x span:nth-child(6) { left: 65.22%; }
.orr .orr-plot__x span:nth-child(7) { left: 78.26%; }
.orr .orr-plot__x span:nth-child(8) { left: 91.3%; }
.orr .orr-plot__x span:nth-child(9) { left: auto; right: 0; transform: none; }
.orr .orr-models { margin-top: 17px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 14.5px; }
.orr .orr-m__h { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 24px; }
.orr .orr-m__n { display: inline-flex; align-items: center; gap: 9px; min-width: 0; font-size: 15px; font-weight: 500; line-height: 22.5px; }
.orr .orr-dot { width: 8px; height: 8px; flex: none; border-radius: 2px; }
.orr .orr-dot--1, .orr .orr-bg--1 { background: var(--cat-1); }
.orr .orr-dot--2, .orr .orr-bg--2 { background: var(--cat-2); }
.orr .orr-dot--3, .orr .orr-bg--3 { background: var(--cat-3); }
.orr .orr-dot--4, .orr .orr-bg--4 { background: var(--cat-4); }
.orr .orr-st { height: 24px; display: inline-flex; align-items: center; gap: 6px; padding: 0 9px 0 8px; border-radius: 12px; font-size: 13px; font-weight: 500; line-height: 19.5px; }
.orr .orr-st svg { width: 14px; height: 14px; }
.orr .orr-st--ok { background: var(--good-bg); color: var(--good); }
.orr .orr-st--warn { background: var(--amber-bg); color: var(--amber); }
.orr .orr-up { margin-top: 7px; display: flex; align-items: flex-end; gap: 3px; height: 22px; }
.orr .orr-up i { height: 100%; }
.orr .orr-up i { flex: 1; border-radius: 2px; background: var(--good); opacity: .7; }
.orr .orr-up i.orr-bad { height: 64%; background: var(--amber); opacity: 1; }
.orr .orr-m__f { margin-top: 8px; display: flex; justify-content: space-between; font-size: 13px; line-height: 19.5px; color: var(--faint); }
.orr .orr-m__f b { font-weight: 500; color: var(--ink); }
.orr .orr-sp { margin-top: 16px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.orr .orr-sp__h { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.orr .orr-sp__h b { font-size: 15px; font-weight: 500; line-height: 22.5px; }
.orr .orr-sp__bar { display: block; margin-top: 5.5px; height: 8px; border-radius: 4px; background: var(--panel); overflow: hidden; }
.orr .orr-sp__bar i { display: block; height: 100%; border-radius: 4px; }
.orr .orr-sp__p { display: block; margin-top: 6.5px; font-size: 13px; line-height: 19.5px; color: var(--faint); }
/* ⚠️ La columna es «minmax(0, 1fr)» y no la de por defecto (11/11/2026): una celda de grilla no se achica debajo de su contenido
   («min-width: auto»), así que un nombre largo («Offer: conversar, diagnosticar y armar la oferta») estiraba la fila 94 px afuera de
   la tarjeta y el «…» de .orr-rq__nom nunca entraba. Lo mismo en .orr-models y .orr-sp. */
.orr .orr-rq { margin-top: 13.5px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
.orr .orr-rq li { height: 32px; display: flex; align-items: center; gap: 10px; }
.orr .orr-rq__t { font-size: 13px; line-height: 19.5px; color: var(--faint); }
.orr .orr-code200 { height: 23px; display: inline-flex; align-items: center; gap: 5px; padding: 0 7px; border-radius: 12px; background: var(--good-bg); font-size: 13px; font-weight: 500; line-height: 19.5px; color: var(--good); }
.orr .orr-code200 svg { width: 14px; height: 14px; }
.orr .orr-rq__m { margin-left: 2px; flex: 1; }
.orr .orr-rq__l { font-size: 13px; line-height: 19.5px; color: var(--muted); }
.orr .orr-quick .orr-card__s { max-width: 130px; }
.orr .orr-tabs { display: flex; padding: 3px; gap: 2px; border-radius: var(--r-sm); background: var(--panel); }
.orr .orr-tabs button { height: 26px; padding: 0 10px; border: 0; border-radius: 7px; background: none; font-size: 13px; font-weight: 500; line-height: 19.5px; color: var(--muted); }
.orr .orr-tabs button[aria-pressed='true'] { background: var(--card); color: var(--ink); box-shadow: 0 0 0 1px var(--hair), var(--shadow); }
.orr .orr-code { position: relative; margin-top: 18px; height: 241px; padding: 46px 18px 16px; border-radius: var(--r-md); background: var(--panel); overflow: hidden; }
.orr .orr-code pre { margin: 0; font-size: 13px; line-height: 22.1px; color: var(--ink); white-space: pre; }
.orr .orr-c-com { color: var(--faint); }
.orr .orr-c-str { color: var(--good); }
.orr .orr-c-fl { color: var(--rose); }
.orr .orr-copy { position: absolute; top: 10px; right: 10px; height: 29px; display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--hair); background: var(--card); font-size: 13px; font-weight: 500; line-height: 19.5px; }
.orr .orr-copy svg { width: 14px; height: 14px; }

@container orr (max-width: 700px) {
  .orr .orr-main { padding: 19px 16px 48px; }
  .orr .orr-phead h1 { font-size: 27px; line-height: 31.05px; letter-spacing: -.675px; }
  .orr .orr-phead { flex-direction: column; align-items: stretch; }
  .orr .orr-phead__acts { margin: 4px 0 0; }
  .orr .orr-phead__acts .orr-btn { flex: 1; }
  .orr .orr-kpis { margin-top: 24px; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .orr .orr-card { padding: 15px; }
  .orr .orr-kpi { height: auto; }
  .orr .orr-kpi__n { margin-top: 6px; font-size: 24px; line-height: 27.6px; letter-spacing: -.72px; }
  .orr .orr-kpi__d { margin-top: 7px; }
  .orr .orr-kpi__s { margin-top: 18px; height: 24px; }
  .orr .orr-spark { height: 24px; }
  .orr .orr-kpi__s--line { margin-top: 18px; }
  .orr .orr-kpi__e { display: none; }
  .orr .orr-kpi__f { flex-direction: column; gap: 8.5px; }
  .orr .orr-budget { margin-top: 12px; }
  .orr .orr-kpi__d span:not(.orr-delta) { display: none; }
  .orr .orr-row1, .orr .orr-row2 { grid-template-columns: minmax(0, 1fr); height: auto; }
  .orr .orr-quick .orr-card__h { flex-direction: column; gap: 0; }
  .orr .orr-quick .orr-card__s { max-width: none; }
  .orr .orr-tabs { margin-top: 13.5px; }
  .orr .orr-code { margin-top: 14px; }
  .orr .orr-plot { margin-top: 23.5px; margin-bottom: 26px; height: 213px; }
  .orr .orr-plot__svg { height: 213px; }
  .orr .orr-plot__x span:nth-child(n+2):nth-child(-n+8) { display: none; }
  .orr .orr-plot__x .orr-mx { display: block; }
}

/* ── lo de la adaptación (DESPUÉS de los @container de la copia: los pisa en el mismo ancho) ──────────── */
.orr .orr-phead__s b { font-weight: 600; color: var(--ink); }
.orr .orr-quieta { opacity: .72; pointer-events: none; }
.orr .orr-vacio { display: grid; place-content: center; gap: 4px; margin-top: 16px; padding: 18px 12px; text-align: center; font-size: 14px; line-height: 21px; color: var(--muted); }
.orr .orr-vacio b { display: block; color: var(--ink); font-weight: 600; }
.orr .orr-row1 .orr-vacio { min-height: 360px; }
.orr .orr-row2 .orr-vacio { min-height: 270px; }
.orr .orr-btn, .orr .orr-lnk { text-decoration: none; }
.orr .orr-lnk { flex: none; white-space: nowrap; }
.orr .orr-lnk:hover { text-underline-offset: 3px; text-decoration: underline; }
.orr [role='button'] { cursor: pointer; }
.orr .orr-rq > li[role='button'], .orr .orr-models > li[role='button'], .orr .orr-sp > li[role='button'] { border-radius: 8px; transition: background-color .15s; }
.orr .orr-rq > li[role='button'] { margin: 0 -8px; padding: 0 8px; }
.orr .orr-models > li[role='button'], .orr .orr-sp > li[role='button'] { margin: -6px -8px; padding: 6px 8px; }
.orr .orr-rq > li[role='button']:hover, .orr .orr-models > li[role='button']:hover, .orr .orr-sp > li[role='button']:hover { background: var(--panel); }
.orr .orr-rq__t { min-width: 46px; text-align: right; }
.orr .orr-code200 { flex: none; min-width: 46px; justify-content: center; }
.orr .orr-rq__m { min-width: 0; }
.orr .orr-rq__nom, .orr .orr-c-nom { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.orr .orr-sp__bar i, .orr .orr-budget i { transform-origin: 0 50%; }
.orr .orr-chart .orr-live { background: var(--accent-soft); color: var(--accent-ink); }
.orr .orr-quick .orr-code { padding-top: 16px; }
.orr .orr-quick .orr-card__s { max-width: none; }
.orr .orr-plot__x .orr-x { position: absolute; font-style: normal; font-size: 12px; line-height: 18px; color: var(--faint); white-space: nowrap; }
.orr .orr-plot__x .orr-x--tel { display: none; }
.orr .orr-c-l { display: block; }
.orr .orr-c-fila { display: flex; justify-content: space-between; gap: 16px; margin: 0 -6px; padding: 0 6px; border-radius: 6px; transition: background-color .15s; }
.orr .orr-c-fila[role='button']:hover { background: var(--card); }
.orr .orr-c-fila .orr-c-str { flex: none; }
@container orr (min-width: 701px) and (max-width: 1000px) {
  .orr .orr-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .orr .orr-row1 { grid-template-columns: minmax(0, 1fr); height: auto; }
  .orr .orr-plot { margin-bottom: 26px; }
  .orr .orr-row2 { grid-template-columns: repeat(2, minmax(0, 1fr)); height: auto; }
  .orr .orr-quick { grid-column: 1 / -1; }
}
@container orr (max-width: 700px) {
  .orr .orr-plot__x .orr-x--tel { display: block; }
  .orr .orr-plot__x .orr-x--fuera { display: none; }
}
@media (prefers-reduced-motion: reduce) { .orr *, .orr *::before, .orr *::after { transition: none !important; animation: none !important; } }
`;
