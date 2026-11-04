// =============================================================================
// marketing-css — la hoja de estilos del DISEÑO de la hoja Marketing: la copia de Kestrel, sólo de esta hoja
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco». Es docs/diseno/mockups-dashboard/marketing-kestrel/kestrel.css (escrita desde lo MEDIDO del demo: valores.json, las
// capturas, los estados de los controles y el INFORME; nada del código de la tienda) con todo adentro de `.kt` y cada clase con
// el prefijo `kt-`, para no tocar nada del resto del Dashboard. Sin la barra lateral ni la de arriba de Kestrel: en MaKo las pone
// la app. La arma scratchpad/kestrel/armar-kt.py desde la hoja de la maqueta: se cambia la maqueta y se vuelve a armar.
//
// Lo que se suma a la copia, y es de la adaptación (marketing-kestrel/mako.html): la fecha en lugar del «Live», los vacíos, las
// filas que se tocan y el medio de 761 a 1040, que Kestrel no tiene medido (sus capturas son 1440 y 390).
//
// ⚠️ LA LETRA ES GEIST, Y EN MaKo «Geist» ES URBANIST (app/globals.css): por eso acá se declara «Kestrel Geist», con los archivos
//    de Google. Cargar la hoja de Google de Geist le cambiaría la letra a TODA la app mientras el Dashboard está abierto.
// ⚠️ ESTA HOJA ES SÓLO DE MARKETING: otra hoja con diseño escribe la suya (la de su demo), no reusa ésta.
// ⚠️ EL TELÉFONO VA POR @container (el ancho del lienzo), no por el de la ventana, y DESPUÉS del medio: dos @container que se
//    pisan los decide el orden (docs/hallazgos-templates-dashboard.md §18).
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.
// =============================================================================

export const CSS_MARKETING = `
@font-face { font-family: 'Kestrel Geist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwSGFWfOw.woff2) format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'Kestrel Geist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwcGFU.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
.kt {
  container-type: inline-size; container-name: kt;
  --font: "Kestrel Geist", system-ui, -apple-system, "Segoe UI", sans-serif;
  --page: #eaeef3; --panel: #f2f5f8; --card: #fbfcfd; --well: #eef2f6; --well-2: #e5eaf1; --hair: #e0e5ec; --hair-strong: #cdd4de;
  --ink: #101827; --muted: #566377; --faint: #677388; --brand: #1d62de; --brand-ink: #1749ab; --on-brand: #fff;
  --brand-soft: color-mix(in oklab, #1d62de 12%, #fbfcfd); --brand-soft-2: color-mix(in oklab, #1d62de 22%, #fbfcfd);
  --s1: #1d62de; --s2: #d4932c; --s3: #d4486f; --other: #97a2b4;
  --good: #1f8a4c; --good-bg: #e2f3e8; --warn: #b56f0b; --warn-bg: #fbefd9; --bad: #c9372c; --bad-bg: #fbe6e3;
  --shadow: 0 1px 2px #1018270a, 0 12px 32px -16px #10182724; --shadow-lg: 0 2px 4px #1018270d, 0 24px 60px -20px #10182740;
  --r-lg: 22px; --r-md: 14px; --r-sm: 9px; --r-xs: 6px;
  --ease: cubic-bezier(.22, 1, .36, 1); --t-fast: .18s; --t-med: .32s;
   --gap: 16px; --pad: 20px;
  --focus: 0 0 0 2px #fbfcfd, 0 0 0 4px #1d62de;
  background: var(--page); color: var(--ink); font-family: var(--font); font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased;
}
.kt *, .kt *::before, .kt *::after { box-sizing: border-box; }
.kt svg.kt-i { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.kt button { font: inherit; color: inherit; }
.kt a { color: inherit; text-decoration: none; }
.kt :focus-visible { box-shadow: var(--focus); outline: none; }
.kt .kt-pagina { padding: 0 var(--pad) 48px; }

/* ── los controles ─────────────────────────────────────────────────────────────────────────── */
.kt .kt-iconbtn { width: 36px; height: 36px; flex: none; display: grid; place-items: center; border: 0; border-radius: 10px; background: none; color: var(--muted); cursor: pointer; transition: background var(--t-fast), color var(--t-fast), transform var(--t-med) var(--ease); }
.kt .kt-iconbtn:hover { background: var(--well); color: var(--ink); }
.kt .kt-iconbtn:active { transform: scale(.94); }
.kt .kt-iconbtn--dots { width: 28px; height: 28px; opacity: .7; }
.kt .kt-iconbtn--dots:hover, .kt .kt-iconbtn--dots[aria-expanded="true"] { opacity: 1; }
.kt .kt-pill { height: 32px; display: inline-flex; align-items: center; gap: 7px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--hair); background: var(--card); color: var(--muted); font-size: 13px; font-weight: 500; line-height: 19.5px; white-space: nowrap; cursor: pointer; transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast), transform var(--t-med) var(--ease); }
.kt .kt-pill:hover { color: var(--ink); border-color: var(--hair-strong); }
.kt .kt-pill--menu:active { transform: scale(.96); }
.kt .kt-pill--range { height: 38px; padding: 0 16px 0 14px; gap: 9px; font-size: 14px; }
.kt .kt-pill[aria-pressed="true"] { color: var(--ink); background: var(--well); }
.kt .kt-chip { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 8px; border-radius: var(--r-xs); font-size: 12px; font-weight: 600; letter-spacing: .12px; line-height: 18px; white-space: nowrap; }
.kt .kt-chip .kt-i { width: 14px; height: 14px; stroke-width: 2; }
.kt .kt-chip--bad { background: var(--bad-bg); color: var(--bad); }
.kt .kt-chip--good { background: var(--good-bg); color: var(--good); }
.kt .kt-chip--warn { background: var(--warn-bg); color: var(--warn); }
.kt .kt-link { color: var(--brand-ink); text-decoration: underline; text-decoration-color: color-mix(in oklab, currentColor 45%, transparent); text-underline-offset: 3px; transition: text-decoration-color var(--t-fast); }
.kt .kt-link:hover { text-decoration-color: currentColor; }
.kt .kt-up { color: var(--good); } .kt-down { color: var(--bad); }

/* ── la página ─────────────────────────────────────────────────────────────────────────────── */
.kt .kt-page { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: var(--gap); align-items: start; }
.kt .kt-pagehead { grid-column: 1 / -1; display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; padding: 20px 4px 5px; }
.kt .kt-pagehead__row { display: flex; align-items: center; gap: 10px; }
.kt .kt-pagehead__title { margin: 0; font-size: 32px; font-weight: 600; letter-spacing: -.64px; line-height: 36.8px; }
.kt .kt-pagehead__sub { margin: 5px 0 0; font-size: 15px; color: var(--muted); line-height: 22.5px; }
.kt .kt-live { display: inline-flex; align-items: center; gap: 6px; margin-top: 4px; color: var(--good); font-size: 13px; font-weight: 600; letter-spacing: .26px; line-height: 19.5px; }
.kt .kt-live__dot { position: relative; width: 6px; height: 6px; border-radius: 50%; background: var(--good); }
.kt .kt-live__dot::after { content: ""; position: absolute; inset: -5px; border-radius: 50%; background: var(--good); opacity: 0; animation: kt-pulso 1.8s ease-out infinite; }
@keyframes kt-pulso { 0% { opacity: .35; transform: scale(.5); } to { opacity: 0; transform: scale(1.6); } }
.kt .kt-col { display: flex; flex-direction: column; gap: var(--gap); min-width: 0; }
.kt .kt-card { background: var(--card); border: 1px solid color-mix(in oklab, var(--hair) 60%, transparent); border-radius: var(--r-lg); box-shadow: var(--shadow); padding: var(--pad); min-width: 0; }
.kt .kt-card__h { display: flex; align-items: center; gap: 8px; }
.kt .kt-card__t { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -.18px; line-height: 27px; display: flex; align-items: center; gap: 10px; }
.kt .kt-card__t .kt-i { width: 18px; height: 18px; }
.kt .kt-card__end { margin-left: auto; display: flex; align-items: center; gap: 8px; }

.kt .kt-kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); padding: 14px 8px; }
.kt .kt-kpi { display: flex; flex-direction: column; gap: 3px; padding: 4px 8px 4px 10px; border-radius: var(--r-sm); border-left: 1px solid var(--hair); min-width: 0; }
.kt .kt-kpi:first-child { border-left-color: transparent; background: color-mix(in oklab, var(--well) 50%, transparent); }
.kt .kt-kpi + .kt-kpi:not(:first-child) { border-left-color: var(--hair); }
.kt .kt-kpi__label { font-size: 14px; color: var(--muted); line-height: 21px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kt .kt-kpi__value { font-size: 22px; font-weight: 600; letter-spacing: -.44px; line-height: 25.3px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.kt .kt-kpi__delta { display: inline-flex; align-items: center; gap: 3px; font-size: 13px; font-weight: 600; line-height: 19.5px; white-space: nowrap; }
.kt .kt-kpi__delta .kt-i { width: 13px; height: 13px; stroke-width: 2.2; }

.kt .kt-trends { height: 352px; display: flex; flex-direction: column; }
.kt .kt-legend { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 14px; font-size: 14px; color: var(--muted); line-height: 21px; }
.kt .kt-legend__item { display: inline-flex; align-items: center; gap: 8px; }
.kt .kt-legend__item i { width: 10px; height: 10px; border-radius: 50%; background: var(--c); }
.kt .kt-chart { position: relative; flex: 1; min-height: 0; margin-top: 8px; }
.kt .kt-chart__plot { position: absolute; inset: 0; }
.kt .kt-chart svg { width: 100%; height: 100%; display: block; overflow: visible; }
.kt .kt-chart .kt-gl { stroke: var(--hair); stroke-width: 1; }
.kt .kt-chart .kt-gl0 { stroke: var(--hair-strong); }
.kt .kt-chart .kt-yl { font: 400 12px var(--font); fill: var(--ink); opacity: .75; }
.kt .kt-chart .kt-xl { font: 400 12px var(--font); fill: var(--faint); letter-spacing: .4px; text-transform: uppercase; }
.kt .kt-chart .kt-xt { stroke: var(--hair-strong); }
.kt .kt-chart .kt-ln { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.kt .kt-chart .kt-end { font: 600 12px var(--font); fill: var(--ink); }
.kt .kt-chart .kt-cross { stroke: var(--hair-strong); stroke-dasharray: 3 3; }
.kt .kt-chart__tip { position: absolute; pointer-events: none; min-width: 150px; padding: 10px 12px; border-radius: 12px; background: var(--ink); color: #fbfcfd; box-shadow: var(--shadow-lg); font-size: 12px; line-height: 18px; transform: translate(-50%, calc(-100% - 12px)); transition: opacity var(--t-fast); }
.kt .kt-chart__tip[hidden] { display: block; opacity: 0; }
.kt .kt-chart__tip b { display: block; font-weight: 600; margin-bottom: 4px; }
.kt .kt-chart__tip-row { display: flex; align-items: center; gap: 8px; }
.kt .kt-chart__tip-row i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
.kt .kt-chart__tip-row strong { margin-left: auto; font-weight: 600; }
.kt .kt-chart__table { position: absolute; inset: 0; overflow: auto; }
.kt .kt-chart__table table { width: 100%; border-collapse: collapse; font-size: 13px; }
.kt .kt-chart__table th, .kt .kt-chart__table td { text-align: right; padding: 6px 8px; border-bottom: 1px solid var(--hair); white-space: nowrap; }
.kt .kt-chart__table th:first-child, .kt .kt-chart__table td:first-child { text-align: left; }
.kt .kt-chart__table th { color: var(--muted); font-weight: 600; position: sticky; top: 0; background: var(--card); }

.kt .kt-leads { padding-top: 14px; }
.kt .kt-tabs { position: relative; display: flex; align-items: center; gap: 2px; border-bottom: 1px solid var(--hair); }
.kt .kt-tabs__list { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; }
.kt .kt-tabs [role=tab] { height: 43px; padding: 0 14px; border: 0; border-radius: 10px 10px 0 0; background: none; color: var(--muted); font-size: 14px; font-weight: 500; line-height: 21px; white-space: nowrap; cursor: pointer; transition: color var(--t-fast), background var(--t-fast); }
.kt .kt-tabs [role=tab]:hover { color: var(--ink); background: var(--well); }
.kt .kt-tabs [role=tab][aria-selected="true"] { color: var(--ink); }
.kt .kt-tabs__ink { position: absolute; left: 0; bottom: -1px; height: 2px; width: 0; border-radius: 2px; background: var(--brand); }
.kt .kt-tabs .kt-iconbtn { margin-left: auto; }
.kt .kt-tbl { width: 100%; border-collapse: collapse; }
.kt .kt-tbl th { height: 50px; padding: 0 6px; text-align: left; font-size: 13px; font-weight: 600; color: var(--muted); line-height: 19.5px; border-bottom: 1px solid var(--hair); white-space: nowrap; }
.kt .kt-tbl td { height: 52.5px; padding: 0 6px; font-size: 14px; line-height: 21px; border-bottom: 1px solid var(--hair); white-space: nowrap; }
.kt .kt-tbl tr.kt-dia td { border-bottom-color: var(--hair-strong); }
.kt .kt-lead { cursor: pointer; transition: background var(--t-fast); }
.kt .kt-lead:hover, .kt .kt-lead:focus-visible { background: var(--well); }
.kt .kt-lead:focus-visible td:first-child { box-shadow: inset 2px 0 0 var(--brand); }
.kt .kt-lead td:first-child { border-radius: 10px 0 0 10px; }
.kt .kt-lead td:last-child { border-radius: 0 10px 10px 0; }
.kt .kt-lead__fecha { color: var(--muted); }
.kt .kt-lead__fecha--hoy { color: var(--ink); font-weight: 600; }
.kt .kt-lead__fecha--hoy::before { content: ""; display: inline-block; width: 6px; height: 6px; margin-right: 8px; border-radius: 50%; background: var(--brand); vertical-align: 2px; }
.kt .kt-lead__fecha:not(.kt-lead__fecha--hoy) { padding-left: 0; }
.kt .kt-lead__emp { font-weight: 500; }
.kt .kt-lead__mail { color: var(--muted); }
.kt .kt-lead__acc { text-align: right; width: 90px; }
.kt .kt-lead__acc > span { display: inline-flex; align-items: center; gap: 10px; color: var(--muted); }
.kt .kt-lead__acc .kt-av { width: 26px; height: 26px; border-radius: 50%; font-size: 10px; font-weight: 600; display: grid; place-items: center; background: #e7d6c6; color: #5b3a20; box-shadow: 0 0 0 2px var(--card); }
.kt .kt-lead__acc .kt-avs { display: inline-flex; }
.kt .kt-lead__acc .kt-av + .kt-av { margin-left: -10px; }
.kt .kt-lead__chev { transition: transform var(--t-med) var(--ease); }

.kt .kt-social { display: flex; flex-direction: column; }
.kt .kt-social__pill { height: 28px; padding: 0 12px; font-size: 13px; }
.kt .kt-tiles { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
.kt .kt-tile { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border-radius: var(--r-md); background: var(--well); min-height: 80px; }
.kt .kt-tile__k { font-size: 14px; color: var(--muted); line-height: 21px; }
.kt .kt-tile__v { display: flex; align-items: flex-start; gap: 8px; }
.kt .kt-tile__v b { font-size: 22px; font-weight: 600; letter-spacing: -.44px; line-height: 33px; font-variant-numeric: tabular-nums; }
.kt .kt-tile__v small { margin-top: 8px; font-size: 13px; font-weight: 600; line-height: 19.5px; }
.kt .kt-tile--ring { min-height: 126px; }
.kt .kt-ring { width: 48px; height: 48px; margin-top: 14px; flex: none; }
.kt .kt-ring circle { fill: none; stroke-width: 5; }
.kt .kt-ring__track { stroke: var(--brand-soft-2); }
.kt .kt-ring__arc { stroke: var(--s1); stroke-linecap: round; transform: rotate(-90deg); transform-origin: 50% 50%; }
.kt .kt-list { margin-top: 7px; }
.kt .kt-list__row { display: flex; align-items: center; justify-content: space-between; gap: 10px; height: 40px; padding: 0 2px; border-bottom: 1px solid var(--hair); font-size: 14px; line-height: 21px; }
.kt .kt-list__row:last-child { border-bottom: 0; }
.kt .kt-list__row span { color: var(--muted); }
.kt .kt-list__row b { font-weight: 600; font-variant-numeric: tabular-nums; display: inline-flex; gap: 10px; }
.kt .kt-list__row b em { font-style: normal; }
.kt .kt-posts__t { margin: 17px 0 12px; font-size: 15px; font-weight: 600; line-height: 22.5px; }
.kt .kt-posts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.kt .kt-post { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
.kt .kt-post__btn { position: relative; width: 100%; aspect-ratio: 4 / 5; border: 0; padding: 0; border-radius: 10px; overflow: hidden; background: var(--well-2); cursor: pointer; transition: box-shadow var(--t-med), transform var(--t-med) var(--ease); }
.kt .kt-post__btn:hover { box-shadow: var(--shadow-lg); transform: translateY(-3px); }
.kt .kt-post__img { position: absolute; inset: 0; background: var(--g); transition: transform .6s var(--ease); }
.kt .kt-post__btn:hover .kt-post__img { transform: scale(1.06); }
.kt .kt-post__img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.kt .kt-post__n { position: absolute; left: 7px; bottom: 6px; display: inline-flex; align-items: center; gap: 3px; color: #fff; font-size: 11px; font-weight: 600; line-height: 16.5px; text-shadow: 0 1px 2px #10182766; }
.kt .kt-post__n .kt-i { width: 10px; height: 10px; fill: currentColor; stroke: none; }
.kt .kt-post small { font-size: 11px; color: var(--faint); line-height: 16.5px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kt .kt-bars { position: relative; height: 112px; margin-top: 18px; }
.kt .kt-bars svg { width: 100%; height: 100%; display: block; overflow: visible; }
.kt .kt-bars .kt-gl { stroke: var(--hair); }
.kt .kt-bars .kt-b { fill: var(--s1); }
.kt .kt-bars .kt-xl { font: 400 12px var(--font); fill: var(--faint); text-anchor: middle; }

/* ── lo de la adaptación ───────────────────────────────────────────────────────────────────── */
.kt .kt-pagehead__fecha { margin-top: 4px; font-size: 13px; font-weight: 600; color: var(--muted); letter-spacing: .26px; line-height: 19.5px; }
.kt .kt-pagehead__sub b { color: var(--ink); font-weight: 600; }
.kt .kt-pagehead__acts { display: flex; align-items: center; gap: 8px; flex: none; }
.kt .kt-pill--quieta, .kt .kt-pill--quieta:hover { cursor: default; color: var(--muted); border-color: var(--hair); }
.kt .kt-legend__nota { margin-left: auto; font-size: 13px; color: var(--faint); }
.kt a.kt-kpi { color: inherit; transition: background var(--t-fast); }
.kt a.kt-kpi:hover { background: var(--well); }
.kt .kt-kpi__delta:not(.kt-up):not(.kt-down) { color: var(--muted); }
.kt .kt-lead__anuncio { display: block; max-width: 180px; overflow: hidden; text-overflow: ellipsis; color: var(--ink); font-weight: 500; }
.kt .kt-lead__emp { max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
.kt .kt-ring__txt { margin-top: 18px; font-size: 12px; line-height: 16px; color: var(--muted); max-width: 72px; }
.kt .kt-ring__txt b { display: block; font-size: 14px; font-weight: 600; color: var(--ink); line-height: 19px; }
.kt .kt-post__img--ini { display: grid; place-items: center; color: #10182799; font-size: 15px; font-weight: 600; letter-spacing: .3px; }
.kt .kt-post__n .kt-i { stroke: currentColor; fill: none; stroke-width: 2.4; }
.kt .kt-tile__v small.kt-nota { margin-top: 9px; font-weight: 500; color: var(--faint); }
.kt .kt-vacio { display: grid; place-items: center; height: 100%; min-height: 120px; color: var(--muted); font-size: 14px; text-align: center; padding: 16px; }
.kt .kt-nota { font-size: 12px; color: var(--faint); line-height: 18px; }
.kt .kt-tbl td.kt-num, .kt .kt-tbl th.kt-num { text-align: right; font-variant-numeric: tabular-nums; }
.kt .kt-fila:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; }
.kt .kt-lead--quieta { cursor: default; }
.kt .kt-lead--quieta:hover { background: none; }
.kt .kt-vacio-fila td { height: 120px; text-align: center; color: var(--muted); white-space: normal; }
.kt .kt-post__img img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* ── el medio (761 a 1040: no está medido en Kestrel) ────────────────────────────────────────── */
@container kt (max-width: 1040px) {
  .kt .kt-page { grid-template-columns: minmax(0, 1fr); }
  .kt .kt-col + .kt-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
  .kt .kt-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 14px; }
  .kt .kt-kpi:nth-child(3n+1) { border-left-color: transparent; }
  .kt .kt-tbl .kt-t-emp { display: none; }
}

/* ── el teléfono (medido a 390) ────────────────────────────────────────────────────────────── */
@container kt (max-width: 760px) {
  .kt .kt-pagina { padding: 0 12px 40px; }
  .kt .kt-col + .kt-col { display: flex; align-items: stretch; }
  .kt .kt-page { grid-template-columns: minmax(0, 1fr); }
  .kt .kt-pagehead { flex-direction: column; align-items: flex-start; gap: 12px; padding: 20px 0 9px; }
  .kt .kt-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 14px; padding: 12px 6px; }
  .kt .kt-kpi { border-left-color: transparent; }
  .kt .kt-kpi:nth-child(2n) { border-left-color: transparent; }
  .kt .kt-tbl .kt-t-emp, .kt .kt-tbl .kt-t-mail, .kt .kt-tbl .kt-t-utm, .kt .kt-tbl .kt-t-pais { display: none; }
  .kt .kt-pagehead__row { flex-wrap: wrap; row-gap: 2px; }
  .kt .kt-pagehead__fecha { width: 100%; margin-top: 0; }
  .kt .kt-tbl td { height: 48px; }
  .kt .kt-tbl col:first-child { width: 116px !important; }
}
@media (prefers-reduced-motion: reduce) { .kt * { transition: none !important; animation: none !important; } }
`;
