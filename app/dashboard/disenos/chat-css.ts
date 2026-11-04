// =============================================================================
// chat-css — la hoja de estilos del DISEÑO de la hoja Chat Analyst: la copia de Parley, sólo de esta hoja
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco». Es docs/diseno/mockups-dashboard/chat-parley/parley.css (escrita desde lo MEDIDO del demo: valores.json, las capturas,
// los estados de los controles y el INFORME; nada del código de la tienda) con todo adentro de `.parl` y cada clase con el prefijo
// `parl-`, para no tocar nada del resto del Dashboard. Sin el armazón de Parley (la barra lateral): en MaKo lo pone la app. La arma
// scratchpad/parley/armar-parl.py desde la hoja de la copia: se cambia la copia y se vuelve a armar.
//
// Lo que se suma a la copia, y es de la adaptación (chat-parley/mako.html): el período en lugar del buscador, «Ver la grilla» en
// lugar de «Last sync», «Abrir tus chats» en lugar del avatar, los vacíos, el chip que cuenta (sin cambio) y las filas que se abren.
//
// ⚠️ LAS LETRAS SON BRICOLAGE GROTESQUE Y GEIST DE VERDAD: en MaKo «Geist» es Urbanist (app/globals.css), por eso acá se llaman
//    «Parley Bricolage» y «Parley Geist» y se cargan de Google Fonts (como «Kestrel Geist» en Marketing).
// ⚠️ ESTA HOJA ES SÓLO DE CHAT ANALYST: otra hoja con diseño escribe la suya (la de su demo), no reusa ésta.
// ⚠️ EL TELÉFONO VA POR @container (el ancho del lienzo), no por el de la ventana, y DESPUÉS del medio: dos @container que se
//    pisan los decide el orden (docs/hallazgos-templates-dashboard.md §18).
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.
// =============================================================================

export const CSS_CHAT = `
@font-face { font-family: 'Parley Bricolage'; font-style: normal; font-weight: 200 800; font-display: swap; src: url(https://fonts.gstatic.com/s/bricolagegrotesque/v9/3y9K6as8bTXq_nANBjzKo3IeZx8z6up5BeSl9D4dj_x9PpZBMlGGInHEVA.woff2) format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'Parley Bricolage'; font-style: normal; font-weight: 200 800; font-display: swap; src: url(https://fonts.gstatic.com/s/bricolagegrotesque/v9/3y9K6as8bTXq_nANBjzKo3IeZx8z6up5BeSl9D4dj_x9PpZBMlGIInE.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: 'Parley Geist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwSGFWfOw.woff2) format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'Parley Geist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwcGFU.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
.parl {
  container-type: inline-size; container-name: parl;
  --bg: #efe9e1; --bg-2: #e7dfd4; --surface: #fffdf9; --surface-2: #f7f2eb; --line: #ebe3d8; --line-strong: #e0d6ca;
  --ink: #221b26; --ink-2: #554b5a; --ink-3: #6b6071; --rail: #221b26; --cream: #fff6ee;
  --c-tangerine: #e4572e; --c-teal: #1e9a8a; --c-violet: #5b3e8c; --c-tangerine-soft: #f6d6c8; --c-tangerine-deep: #c13d14;
  --c-violet-soft: #e2d9ef; --c-teal-soft: #d4ece7; --good: #176a47; --good-bg: #e2f2e8; --bad: #b3261e; --bad-bg: #f8e1df;
  --font-display: 'Parley Bricolage', ui-sans-serif, system-ui, sans-serif;
  --font-body: 'Parley Geist', ui-sans-serif, system-ui, -apple-system, sans-serif;
  --r-card: 22px; --r-sm: 10px; --gap: 16px; --pad: 22px;
  --shadow: 0 1px 0 #221b260a, 0 12px 32px -18px #221b262e;
  --shadow-hover: 0 1px 0 #221b260a, 0 18px 40px -20px #221b2642;
  --ease-out: cubic-bezier(.22, 1, .36, 1);
  --hatch: repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 5px);
  position: relative; isolation: isolate; color: var(--ink); font: 400 15px/1.45 var(--font-body); -webkit-font-smoothing: antialiased;
  background: radial-gradient(70% 55% at 88% -6%, #f3dccc 0%, #f3dccc00 70%), radial-gradient(45% 35% at -4% 104%, #e8dde9 0%, #e8dde900 70%), var(--bg);
}
.parl *, .parl *::before, .parl *::after { box-sizing: border-box; }
.parl button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
.parl a { color: inherit; text-decoration: none; }
.parl svg.parl-i { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.parl .parl-num { font-variant-numeric: tabular-nums; }
.parl :focus-visible { outline: 2px solid var(--c-violet); outline-offset: 2px; }
.parl .parl-card--dark :focus-visible, .parl .parl-card--hero :focus-visible { outline-color: var(--cream); }

/* ── la copia ──────────────────────────────────────────────────────────────────────────────── */
.parl * { box-sizing: border-box; }
.parl .parl-card--hero :focus-visible { outline-color: var(--cream); }
.parl .parl-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; min-height: 76px; margin-bottom: 16px; }
.parl .parl-top__h { padding-top: 6px; }
.parl .parl-top__title { margin: 0; font: 650 38px/1.1 var(--font-display); letter-spacing: -.02em; }
.parl .parl-top__title .parl-w { display: inline-block; }
.parl .parl-top__sub { margin: 6px 0 0; color: var(--ink-3); font-size: 15px; line-height: 1.45; }
.parl .parl-top__tools { display: flex; align-items: center; gap: 10px; flex: none; margin-top: 18px; }
.parl .parl-search { width: 262px; height: 46px; display: flex; align-items: center; gap: 8px; padding: 0 9px 0 16px; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); transition: border-color .2s, box-shadow .2s; }
.parl .parl-search:focus-within { border-color: var(--c-violet); box-shadow: 0 0 0 3px #5b3e8c24; }
.parl .parl-search .parl-i { width: 17px; height: 17px; color: var(--ink-3); }
.parl .parl-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font: 400 15px/1.45 var(--font-body); color: var(--ink); }
.parl .parl-search input::placeholder { color: var(--ink-3); }
.parl .parl-search kbd { font: 500 11px/1 var(--font-body); color: var(--ink-3); padding: 5px 6px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--line); }
.parl .parl-sync { height: 46px; display: flex; align-items: center; gap: 8px; padding: 0 16px 0 13px; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); text-align: left; transition: border-color .25s, box-shadow .25s; }
.parl .parl-sync:hover { border-color: #d9cfc2; }
.parl .parl-sync .parl-i { width: 20px; height: 20px; color: var(--ink-2); }
.parl .parl-sync__t { display: flex; flex-direction: column; }
.parl .parl-sync__t b { font: 600 13px/1.15 var(--font-body); }
.parl .parl-sync__t small { font: 500 12px/1.15 var(--font-body); color: var(--good); }
.parl .parl-sync, .parl .parl-avatar { flex: none; }
.parl .parl-avatar { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; color: #fff; font: 700 13px/1 var(--font-body); letter-spacing: .04em; background: linear-gradient(120deg, #5f4091, #7a52ac); box-shadow: var(--shadow); }
.parl .parl-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--gap); grid-template-areas: "aud del camp" "aud cred sent" "month month mix" "month month top"; }
.parl .parl-g-aud { grid-area: aud; }
.parl .parl-g-del { grid-area: del; }
.parl .parl-g-camp { grid-area: camp; }
.parl .parl-g-cred { grid-area: cred; }
.parl .parl-g-sent { grid-area: sent; }
.parl .parl-g-month { grid-area: month; }
.parl .parl-g-mix { grid-area: mix; }
.parl .parl-g-top { grid-area: top; }
.parl .parl-card { position: relative; display: flex; flex-direction: column; gap: 14px; min-width: 0; padding: var(--pad); border-radius: var(--r-card); background: var(--surface); border: 1px solid #221b260f; box-shadow: var(--shadow); transition: border-color .25s, box-shadow .25s; }
.parl .parl-card:hover { border-color: #221b261f; box-shadow: var(--shadow-hover); }
.parl .parl-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; min-height: 26px; }
.parl .parl-card__title { margin: 0; display: flex; align-items: center; gap: 8px; font: 600 18px/1.45 var(--font-body); letter-spacing: -.01em; }
.parl .parl-card__title .parl-i { width: 16px; height: 16px; color: var(--ink-2); }
.parl .parl-card__meta { padding-top: 3px; font-size: 13px; line-height: 1.45; color: var(--ink-3); white-space: nowrap; }
.parl .parl-fig { display: flex; align-items: center; gap: 10px; min-width: 0; }
.parl .parl-fig__n { font: 600 40px/1 var(--font-body); letter-spacing: -.03em; }
.parl .parl-fig__u { font: 500 22px/1 var(--font-body); color: var(--ink-3); margin-left: -6px; align-self: flex-end; margin-bottom: 3px; }
.parl .parl-fig__u--slash { margin-left: -2px; }
.parl .parl-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px 3px 7px; border-radius: 99px; font: 600 12px/1 var(--font-body); white-space: nowrap; background: var(--good-bg); color: var(--good); }
.parl .parl-chip svg { width: 11px; height: 11px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.parl .parl-chip--bad { background: var(--bad-bg); color: var(--bad); }
.parl .parl-cells { display: grid; grid-template-columns: repeat(40, minmax(0, 1fr)); gap: 3px; height: 34px; margin-top: auto; }
.parl .parl-cells i { position: relative; border-radius: 3px; background: var(--hatch); color: var(--c-tangerine-soft); overflow: hidden; }
.parl .parl-cells b { position: absolute; inset: 0; border-radius: 3px; background: var(--c-tangerine); transform-origin: 50% 100%; transform: scaleY(0); }
.parl .parl-cells b.parl-on { transform: none; }
.parl .parl-cells--violet i { color: var(--c-violet-soft); }
.parl .parl-cells--violet b { background: var(--c-violet); }
.parl .parl-card--hero { border: 0; color: var(--cream); overflow: hidden; background: radial-gradient(58% 44% at 104% 57%, #e55a2dd9 0%, #e55a2d00 100%), linear-gradient(180deg, #bc3e1b 0%, #ad3819 42%, #9b3216 70%, #852a12 100%); }
.parl .parl-card--hero:hover { border: 0; }
.parl .parl-card--hero .parl-card__title { color: var(--cream); }
.parl .parl-live { display: inline-flex; align-items: center; gap: 8px; font: 600 12px/1.45 var(--font-body); letter-spacing: .04em; text-transform: uppercase; color: #fff6eee6; }
.parl .parl-live i { position: relative; width: 7px; height: 7px; border-radius: 50%; background: #9fe3c4; }
.parl .parl-live i::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: #9fe3c4; animation: parl-ping 2s cubic-bezier(0, 0, .2, 1) infinite; }
@keyframes parl-ping { 0% { opacity: .8; transform: scale(1); } to { opacity: 0; transform: scale(3); } }
.parl .parl-fig__n--hero { font-size: 60px; letter-spacing: -.03em; }
.parl .parl-hero__sub { display: flex; align-items: center; gap: 8px; font-size: 13px; line-height: 1.45; color: #fff6eee6; }
.parl .parl-hero__sub b { font-weight: 400; }
.parl .parl-chip--hero { background: #00000029; color: var(--cream); }
.parl .parl-hbars { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); grid-template-rows: 1fr auto; column-gap: 8px; row-gap: 9px; }
.parl .parl-hbar { position: relative; display: flex; align-items: flex-end; justify-content: center; height: 100%; padding-top: 12px; overflow: hidden; cursor: default; }
.parl .parl-hbar__bar { position: relative; width: 30px; max-width: 100%; border-radius: 15px 15px 0 0; background: var(--cream); transition: background-color .2s; }
.parl .parl-hbar__bar--proj { position: absolute; bottom: 0; left: 50%; margin-left: -15px; background: var(--hatch); color: #fff6eeb3; }
.parl .parl-hbar:hover .parl-hbar__bar:not(.parl-hbar__bar--proj) { background: #fff; }
.parl .parl-hbar__val { position: absolute; top: 7px; left: 0; right: 0; text-align: center; font: 700 11px/1.45 var(--font-body); color: var(--ink); opacity: 0; transition: opacity .2s; }
.parl .parl-hbar:hover .parl-hbar__val, .parl .parl-hbar.parl-is-peak .parl-hbar__val { opacity: 1; }
.parl .parl-hbar__m { text-align: center; font: 500 12px/1.45 var(--font-body); color: #fff6eed1; }
.parl .parl-topup { position: relative; margin: -4px -4px 0 0; }
.parl .parl-topup__btn { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: var(--ink); color: var(--cream); transition: background-color .2s; }
.parl .parl-topup__btn:hover { background: #3a2f40; }
.parl .parl-topup__btn .parl-i { width: 16px; height: 16px; stroke-width: 2; }
.parl .parl-fig__u--soft { font-size: 16.8px; color: var(--ink-3); margin-left: -4px; margin-bottom: 2px; }
.parl .parl-budget { margin-top: auto; display: flex; flex-direction: column; gap: 10px; }
.parl .parl-budget__bar { position: relative; height: 12px; border-radius: 99px; background: var(--hatch); color: var(--c-violet-soft); overflow: hidden; }
.parl .parl-budget__bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; background: var(--c-violet); transform-origin: 0 50%; }
.parl .parl-budget__foot { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; line-height: 1.45; color: var(--ink-3); }
.parl .parl-budget__foot b { color: var(--ink); font-weight: 600; }
.parl .parl-card--dark { color: var(--cream); border-color: #fff6ee14; background: linear-gradient(180deg, #2b2230 0%, #282029 100%); }
.parl .parl-card--dark:hover { border-color: #fff6ee26; }
.parl .parl-seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--line); flex: none; }
.parl .parl-seg button { padding: 5px 10px; border-radius: 9px; font: 600 12px/17px var(--font-body); color: var(--ink-3); transition: color .2s, background-color .2s, box-shadow .2s; }
.parl .parl-seg button:hover { color: var(--ink); }
.parl .parl-seg button.parl-is-on { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px #221b2614, 0 0 0 1px #221b260a; }
.parl .parl-seg--dark { background: #fff6ee0d; border-color: #fff6ee1a; }
.parl .parl-seg--dark button { color: #fff6ee9e; }
.parl .parl-seg--dark button:hover { color: var(--cream); }
.parl .parl-seg--dark button.parl-is-on { background: #fff6ee24; color: var(--cream); box-shadow: none; }
.parl .parl-fig__n--dark { color: var(--cream); }
.parl .parl-sent__sub { margin-top: -4px; display: flex; align-items: center; gap: 8px; font-size: 13px; line-height: 1.45; color: #fff6eec7; }
.parl .parl-chip--dark { background: #fff6ee17; color: #9fe3c4; }
.parl .parl-area { position: relative; height: 101px; }
.parl .parl-area svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.parl .parl-area__axis { display: flex; justify-content: space-between; font: 400 11px/1.45 var(--font-body); color: #fff6ee8c; }
.parl .parl-card--month { gap: 14px; }
.parl .parl-month__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.parl .parl-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 6px; font-size: 13px; line-height: 1.45; color: var(--ink-2); }
.parl .parl-legend span { display: inline-flex; align-items: center; gap: 8px; }
.parl .parl-sw { width: 10px; height: 10px; border-radius: 3px; background: var(--c-tangerine); flex: none; }
.parl .parl-sw--hatch { background: var(--hatch), var(--c-tangerine-soft); color: var(--c-tangerine); }
.parl .parl-mchart { position: relative; flex: 1; min-height: 300px; }
.parl .parl-mchart__plot { position: absolute; left: 34px; right: 0; top: 40px; bottom: 25px; }
.parl .parl-mchart__grid { position: absolute; left: -34px; right: 0; height: 0; }
.parl .parl-mchart__grid::after { content: ''; position: absolute; left: 34px; right: 0; top: 0; border-top: 1px solid var(--line); }
.parl .parl-mchart__grid span { position: absolute; left: 0; top: -6px; font: 400 11px/1.45 var(--font-body); color: var(--ink-3); }
.parl .parl-mchart__cols { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); }
.parl .parl-mcol { position: relative; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; cursor: default; }
.parl .parl-mcol__stack { position: relative; width: 29px; max-width: 58%; display: flex; flex-direction: column; justify-content: flex-end; transform-origin: 50% 100%; transition: opacity .25s; }
.parl .parl-mcol__aw { border-radius: 5px 5px 0 0; background: var(--hatch), var(--c-tangerine-soft); color: #e4572ed9; border-bottom: 2px solid var(--surface); }
.parl .parl-mcol__rep { background: var(--c-tangerine); }
.parl .parl-mcol__stack.parl-solo .parl-mcol__rep { border-radius: 5px 5px 0 0; }
.parl .parl-mcol__x { position: absolute; bottom: -24px; left: 0; right: 0; text-align: center; font: 400 11px/1.45 var(--font-body); color: var(--ink-3); }
.parl .parl-mcol.parl-is-on .parl-mcol__x { color: var(--ink); font-weight: 700; }
.parl .parl-mcol__x .parl-c { display: none; }
.parl .parl-mchart.parl-is-hovering .parl-mcol:not(.parl-is-on) .parl-mcol__stack { opacity: .5; }
.parl .parl-mtip { position: absolute; z-index: 3; width: 133px; padding: 10px 12px 10px; border-radius: 11px; background: var(--ink); color: var(--cream); box-shadow: 0 14px 30px -14px #221b2699; pointer-events: none; transform: translateX(-50%); transition: left .35s var(--ease-out), top .35s var(--ease-out); }
.parl .parl-mtip b { display: block; font: 700 13px/1.5 var(--font-body); white-space: nowrap; margin-bottom: 2px; }
.parl .parl-mtip div { display: flex; align-items: center; gap: 6px; font: 400 12px/1.5 var(--font-body); }
.parl .parl-mtip div span:first-of-type { color: #fff6eebf; flex: 1; display: inline-flex; align-items: center; gap: 6px; }
.parl .parl-mtip .parl-sw { width: 9px; height: 9px; border-radius: 2px; }
.parl .parl-mtip .parl-sw--hatch { background: var(--hatch); color: var(--c-tangerine); }
.parl .parl-donut { flex: 1; display: grid; place-items: center; padding: 11.5px 0 13.5px; }
.parl .parl-donut__w { position: relative; width: 128px; height: 128px; }
.parl .parl-donut svg { width: 128px; height: 128px; transform: rotate(-90deg); overflow: visible; }
.parl .parl-donut__c { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.parl .parl-donut__c b { font: 600 22px/1.1 var(--font-body); letter-spacing: -.02em; }
.parl .parl-donut__c small { font-size: 12px; line-height: 1.45; color: var(--ink-3); }
.parl .parl-mix { display: flex; flex-direction: column; gap: 9px; margin-bottom: -2px; }
.parl .parl-mix li { display: flex; align-items: center; gap: 10px; min-height: 22px; font-size: 13px; line-height: 1.45; }
.parl .parl-mix ul, .parl ul.parl-mix { list-style: none; margin: 0; padding: 0; }
.parl .parl-mix__dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.parl .parl-mix__name { flex: 1; font-weight: 500; }
.parl .parl-mix__pct { font-weight: 600; }
.parl .parl-mix .parl-chip { min-width: 56px; justify-content: center; }
.parl .parl-people { list-style: none; margin: 0 -10px; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.parl .parl-person { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 10px; border-radius: 14px; transition: background-color .2s; }
.parl .parl-person:hover { background: var(--surface-2); }
.parl .parl-person__av { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; font: 700 12px/1 var(--font-body); color: var(--ink); }
.parl .parl-person__mid { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.parl .parl-person__name { display: flex; align-items: baseline; gap: 8px; min-width: 0; font-size: 13px; line-height: 1.45; white-space: nowrap; overflow: hidden; }
.parl .parl-person__name a { font-weight: 600; text-underline-offset: 3px; }
.parl .parl-person__name a:hover { text-decoration: underline; }
.parl .parl-person__name small { font-size: 13px; color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; }
.parl .parl-person__bar { height: 6px; border-radius: 99px; background: var(--surface-2); overflow: hidden; }
.parl .parl-person:hover .parl-person__bar { background: var(--line); }
.parl .parl-person__bar i { display: block; height: 100%; border-radius: 99px; background: var(--c-tangerine); transform-origin: 0 50%; }
.parl .parl-person__n { text-align: right; display: flex; flex-direction: column; }
.parl .parl-person__n b { font: 700 13px/1.3 var(--font-body); }
.parl .parl-person__n small { font: 500 12px/1.3 var(--font-body); color: var(--ink-3); }

/* ── lo de la adaptación ───────────────────────────────────────────────────────────────────── */
.parl .parl-pagina { position: relative; z-index: 1; padding: 20px 20px 40px; }
.parl .parl-top__sub b { color: var(--ink); font-weight: 600; }
.parl .parl-periodo { width: auto; padding: 0 18px 0 16px; color: var(--ink); white-space: nowrap; cursor: default; }
.parl .parl-periodo .parl-i { width: 17px; height: 17px; color: var(--ink-3); }
.parl .parl-avatar { color: #fff; }
.parl .parl-avatar .parl-i { width: 20px; height: 20px; }
.parl .parl-quieta { opacity: .72; pointer-events: none; }
.parl .parl-vacio { flex: 1; display: grid; place-content: center; gap: 4px; padding: 16px; text-align: center; font-size: 13px; line-height: 1.45; color: var(--ink-3); }
.parl .parl-vacio b { display: block; color: var(--ink); font-weight: 600; }
.parl .parl-card--hero .parl-vacio, .parl .parl-card--dark .parl-vacio { color: #fff6eeb3; }
.parl .parl-card--hero .parl-vacio b, .parl .parl-card--dark .parl-vacio b { color: var(--cream); }
.parl .parl-chip--n { background: var(--surface-2); color: var(--ink-3); }
.parl .parl-fila { cursor: pointer; }
.parl .parl-fila:focus-visible { outline-offset: -2px; }
.parl .parl-budget__bar.parl-is-pasa i { background: var(--c-tangerine); }
.parl .parl-hbar__m { white-space: nowrap; }
.parl .parl-mcol__x { white-space: nowrap; }
.parl .parl-mix__n { min-width: 56px; text-align: center; }
.parl .parl-person__name b { font-weight: 600; }
.parl .parl-legend--bajo { margin-top: -15px; }
.parl .parl-area__dot { position: absolute; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; background: #f2835b; box-shadow: 0 0 0 2px #2a212e; }
.parl .parl-mchart__plot .parl-mtip { transform: none; transition: left .35s var(--ease-out), bottom .35s var(--ease-out); }
.parl .parl-card--dark .parl-chip--n { background: #fff6ee17; color: #fff6eec7; }
.parl .parl-card__meta:is(a):hover { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
@container parl (max-width: 980px) {
  .parl .parl-top { flex-wrap: wrap; }
}
@container parl (max-width: 700px) {
  .parl .parl-pagina { padding: 20px 16px 32px; }
  .parl .parl-periodo { flex: 1; }
}

@container parl (max-width: 980px) {
  .parl .parl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-areas: "aud del" "aud camp" "sent cred" "month month" "mix top"; }
}
@container parl (max-width: 700px) {
  .parl { --pad: 18px; --r-card: 20px; --gap: 12px; }
  .parl .parl-top { flex-direction: column; align-items: stretch; gap: 20px; min-height: 0; margin-bottom: 12px; }
  .parl .parl-top__h { padding-top: 2px; }
  .parl .parl-top__tools { margin-top: 0; gap: 11px; }
  .parl .parl-search, .parl .parl-sync, .parl .parl-avatar { height: 44px; }
  .parl .parl-avatar { width: 44px; }
  .parl .parl-top__title { font-size: 26px; }
  .parl .parl-top__sub { font-size: 13px; margin-top: 6px; }
  .parl .parl-search { width: auto; flex: 1; }
  .parl .parl-search kbd { display: none; }
  .parl .parl-sync { width: 44px; padding: 0; justify-content: center; }
  .parl .parl-sync__t { display: none; }
  .parl .parl-grid { grid-template-columns: minmax(0, 1fr); grid-template-areas: "aud" "del" "camp" "sent" "cred" "month" "mix" "top"; }
  .parl .parl-fig__n { font-size: 30px; }
  .parl .parl-fig__n--hero { font-size: 44px; }
  .parl .parl-fig__u { font-size: 16.5px; }
  .parl .parl-fig__u--soft { font-size: 12px; margin-left: -2px; }
  .parl .parl-mcol__x .parl-l { display: none; }
  .parl .parl-mcol__x .parl-c { display: inline; }
  .parl .parl-hbars { flex: none; height: 191px; }
  .parl .parl-cells { height: 30px; }
  .parl .parl-mchart { min-height: 0; flex: none; height: 240px; }
}
@media (prefers-reduced-motion: reduce) { .parl *, .parl *::before, .parl *::after { transition: none !important; animation: none !important; } }
`;
