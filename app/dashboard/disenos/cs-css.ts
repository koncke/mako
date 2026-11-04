// =============================================================================
// cs-css — la hoja de estilos del DISEÑO de la hoja CS Analyst: la copia de Mender, sólo de esta hoja
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco». Es docs/diseno/mockups-dashboard/cs-mender/mender.css (escrita desde lo MEDIDO del demo: valores.json, las
// capturas, los estados de los controles y el INFORME; nada del código de la tienda) con todo adentro de `.mnd` y cada clase con el
// prefijo `mnd-`, para no tocar nada del resto del Dashboard. Sin el armazón de Mender (la barra de arriba y el riel): en MaKo lo
// pone la app. La arma scratchpad/csm/armar-mnd.py desde la hoja de la copia: se cambia la copia y se vuelve a armar.
//
// Lo que se suma a la copia, y es de la adaptación (cs-mender/mako.html): la página sin el armazón, la frase debajo del
// saludo, los carriles que se corren de costado cuando son más de cuatro, «y N más», los vacíos, las tarjetas que se abren y el
// anillo y los medidores con los datos de MaKo.
//
// ⚠️ LA LETRA ES URBANIST, como la de MaKo (app/globals.css la declara «Geist»): acá se llama «Mender Urbanist» con las MISMAS URL,
//    así el navegador no la baja dos veces y la hoja no depende de cómo se llame la letra de la app.
// ⚠️ ESTA HOJA ES SÓLO DE CS ANALYST: otra hoja con diseño escribe la suya (la de su demo), no reusa ésta.
// ⚠️ EL TELÉFONO VA POR @container (el ancho del lienzo), no por el de la ventana, y lo de la adaptación va DESPUÉS de los
//    @container de la copia: dos reglas iguales las decide el orden (docs/hallazgos-templates-dashboard.md §18).
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.
// =============================================================================

export const CSS_CS = `
@font-face { font-family: 'Mender Urbanist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/urbanist/v18/L0x-DF02iFML4hGCyMqrbS10ig.woff2) format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'Mender Urbanist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/urbanist/v18/L0x-DF02iFML4hGCyMqlbS0.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
.mnd {
  container-type: inline-size; container-name: mnd;
  --font: 'Mender Urbanist', ui-sans-serif, system-ui, sans-serif;
  --bg: #e7ece9; --bg-solid: #edf1ef; --glow-a: #177e6024; --glow-b: #e0573f17; --top-bg: #e7ece9db;
  --panel: #ffffff6b; --panel-strong: #ffffff8c; --panel-rim: #ffffffc7;
  --card: #fffc; --card-solid: #f8faf9; --card-rim: #fffffff5; --card-hover: #fffffff5;
  --field: #f2f5f3; --field-rim: #15201c14; --sheet: #ebf0ed; --scrim: #e1e8e49e;
  --ink: #15201c; --ink-2: #3c4843; --ink-3: #56625d; --ink-4: #a6b0ab; --on-ink: #f1f5f3;
  --line: #15201c17; --line-2: #15201c33;
  --emerald: #177e60; --coral: #e0573f; --amber: #e2a127;
  --emerald-ink: #11624a; --coral-ink: #a8361f; --amber-ink: #7d5203;
  --emerald-soft: #177e6021; --coral-soft: #e0573f24; --amber-soft: #e2a12733;
  --mark-pad: #e7ece9;
  --shadow-card: 0 1px 1px #15201c0a, 0 8px 22px -14px #15201c4d;
  --shadow-pop: 0 2px 6px #15201c14, 0 28px 60px -22px #15201c61;
  --shadow-panel: 0 30px 60px -44px #15201c59;
  --ease: cubic-bezier(.22, 1, .36, 1);
  position: relative; isolation: isolate; color: var(--ink); font: 400 14px/1.4 var(--font); -webkit-font-smoothing: antialiased;
  background: radial-gradient(600px 450px at 94px 70px, var(--glow-a), #177e6000), var(--bg);
}
.mnd *, .mnd *::before, .mnd *::after { box-sizing: border-box; }
.mnd button { font: inherit; color: inherit; cursor: pointer; }
.mnd a { color: inherit; text-decoration: none; }
.mnd h1, .mnd h2, .mnd h3, .mnd p, .mnd ol, .mnd ul { margin: 0; }
.mnd ol, .mnd ul { padding: 0; list-style: none; }
.mnd svg.mnd-i { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.mnd .mnd-num { font-variant-numeric: tabular-nums; }
.mnd :focus-visible { outline: 2px solid var(--emerald); outline-offset: 2px; }

/* ── la copia ──────────────────────────────────────────────────────────────────────────────── */
.mnd * { box-sizing: border-box; }
.mnd h2, .mnd h3, .mnd p, .mnd ul { margin: 0; }
.mnd ul { padding: 0; list-style: none; }
.mnd .mnd-iconbtn { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--card); border: 1px solid var(--field-rim); color: var(--ink-2); padding: 0; transition: background-color .2s, color .2s; }
.mnd .mnd-iconbtn:hover { background: var(--card-hover); color: var(--ink); }
.mnd .mnd-page-t { font-size: 33.12px; font-weight: 700; line-height: 36.432px; letter-spacing: -.92736px; padding-left: 4px; margin: 0 0 22px; }
.mnd .mnd-panel { position: relative; background: #ffffff6b; border: 1px solid #ffffffc7; border-radius: 32px; box-shadow: var(--shadow-panel); padding: 20px 22px 24px; backdrop-filter: blur(14px); }
.mnd .mnd-panel-t { font-size: 17px; font-weight: 700; line-height: 23.8px; letter-spacing: -.17px; }
.mnd .mnd-panel-s { margin-top: 1px; font-size: 12.5px; line-height: 17.5px; color: var(--ink-3); }
.mnd .mnd-board-head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; height: 50px; margin-top: -1px; }
.mnd .mnd-board-acts { justify-self: end; display: flex; gap: 9px; }
.mnd .mnd-seg { position: relative; display: flex; padding: 5px 4px; border-radius: 24px; background: var(--card); box-shadow: var(--shadow-card); }
.mnd .mnd-seg__pill { position: absolute; left: 4px; top: 5px; width: 104px; height: 38px; border-radius: 19px; background: var(--ink); transition: transform .5s cubic-bezier(.16, 1, .3, 1); }
.mnd .mnd-seg button { position: relative; width: 104px; height: 38px; border: 0; background: none; padding: 0; font-size: 13.5px; font-weight: 600; line-height: 18.9px; color: var(--ink-2); transition: color .25s; }
.mnd .mnd-seg button:hover { color: var(--ink); }
.mnd .mnd-seg button[aria-selected='true'] { color: var(--on-ink); }
.mnd .mnd-seg .mnd-corto { display: none; }
.mnd .mnd-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 0; padding: 0 15.5px; height: 42px; border-radius: 21px; font-size: 14px; font-weight: 600; line-height: 19.6px; transition: background-color .2s; }
.mnd .mnd-btn--ink { background: var(--ink); color: var(--on-ink); }
.mnd .mnd-btn--ink:hover { background: color-mix(in srgb, var(--ink) 88%, var(--emerald)); }
.mnd .mnd-btn--ink svg { width: 17px; height: 17px; }
.mnd .mnd-btn--ronda { width: 42px; height: 42px; padding: 0; }
.mnd .mnd-iconbtn--sm { width: 42px; height: 42px; }
.mnd .mnd-lanes { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; margin-top: 17px; }
.mnd .mnd-lane__h { height: 46px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid var(--line-2); border-radius: 23px; font-size: 14px; font-weight: 600; line-height: 19.6px; color: var(--ink-2); }
.mnd .mnd-lane__n { min-width: 24px; height: 24px; padding: 0 6px; border-radius: 12px; display: grid; place-items: center; background: var(--card); font-size: 12px; font-weight: 700; line-height: 16.8px; color: var(--ink-2); }
.mnd .mnd-lane__list > li { position: relative; padding-top: 18px; }
.mnd .mnd-lane__list > li::before { content: ''; position: absolute; left: 50%; top: 2px; width: 1px; height: 15px; margin-left: -.5px; background: #15201c2b; }
.mnd .mnd-lane__list > li::after { content: ''; position: absolute; left: 50%; top: 1px; width: 5px; height: 17px; margin-left: -2.5px; background: radial-gradient(circle 2.5px at 2.5px 3.5px, var(--ink-4) 98%, #0000) top / 5px 7px no-repeat, radial-gradient(circle 2.5px at 2.5px 3.5px, var(--ink-4) 98%, #0000) bottom / 5px 7px no-repeat; }
.mnd .mnd-case { position: relative; height: 64px; display: flex; align-items: center; gap: 12px; padding: 0 12px; border-radius: 22px; background: var(--card); box-shadow: var(--shadow-card); transition: background-color .2s; }
.mnd .mnd-case:hover { background: var(--card-hover); }
.mnd .mnd-case__txt { flex: 1; min-width: 0; }
.mnd .mnd-case__title { display: block; font-size: 14.5px; font-weight: 600; line-height: 20.3px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mnd .mnd-case__meta { display: block; font-size: 12.5px; line-height: 17.5px; color: var(--ink-3); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mnd .mnd-late { margin-left: 6px; font-size: 10.5px; font-weight: 800; line-height: 14.7px; letter-spacing: .525px; text-transform: uppercase; color: var(--coral-ink); }
.mnd .mnd-case__act { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; border: 0; background: none; color: var(--ink-3); padding: 0; flex: none; transition: background-color .2s, color .2s; }
.mnd .mnd-case__act:hover { background: var(--line); color: var(--ink); }
.mnd .mnd-case__act svg { width: 17px; height: 17px; }
.mnd .mnd-av { width: 40px; height: 40px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 700; letter-spacing: .2px; }
.mnd .mnd-av--a { background: #d6ece0; color: var(--emerald-ink); }
.mnd .mnd-av--b { background: #e1e6f0; color: #33415e; }
.mnd .mnd-av--c { background: #f7dcd2; color: var(--coral-ink); }
.mnd .mnd-av--d { background: #f5e8cd; color: var(--amber-ink); }
.mnd .mnd-av--e { background: #dfe6e2; color: var(--ink-2); }
.mnd .mnd-case.mnd-is-late .mnd-av { box-shadow: 0 0 0 2px var(--card-solid), 0 0 0 4px var(--coral); }
.mnd .mnd-row2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; margin-top: 18px; }
.mnd .mnd-row2 .mnd-panel { height: 299px; }
.mnd .mnd-p-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.mnd .mnd-seg--sm { padding: 4px; border-radius: 21px; }
.mnd .mnd-seg--sm .mnd-seg__pill { left: 4px; top: 4px; width: 76px; height: 34px; border-radius: 17px; }
.mnd .mnd-seg--sm button { width: 76px; height: 34px; font-size: 12.5px; font-weight: 600; line-height: 17.5px; }
.mnd .mnd-drivers { display: grid; grid-template-columns: 172px 1fr; align-items: center; gap: 38px; margin-top: 25px; padding-left: 12px; }
.mnd .mnd-donut { position: relative; width: 172px; height: 172px; }
.mnd .mnd-donut svg { display: block; width: 172px; height: 172px; transform: rotate(-90deg); }
.mnd .mnd-donut__c { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
.mnd .mnd-donut__c b { font-size: 32px; font-weight: 800; line-height: 32px; letter-spacing: -.96px; }
.mnd .mnd-donut__c span { margin-top: 6px; font-size: 12px; line-height: 16.8px; color: var(--ink-3); }
.mnd .mnd-legend { display: grid; gap: 4px; }
.mnd .mnd-legend__row { width: 100%; display: grid; grid-template-columns: 10px 1fr 96px 42px; align-items: center; gap: 12px; height: 39.6px; padding: 0 12px; border: 0; border-radius: 14px; background: none; text-align: left; transition: background-color .2s; }
.mnd .mnd-legend__row:hover, .mnd .mnd-legend__row:focus-visible { background: var(--card); }
.mnd .mnd-legend__dot { width: 10px; height: 10px; border-radius: 50%; background: var(--tone); }
.mnd .mnd-legend__label { font-size: 14px; font-weight: 600; line-height: 19.6px; }
.mnd .mnd-legend__bar { height: 6px; border-radius: 3px; background: var(--line); overflow: hidden; }
.mnd .mnd-legend__bar i { display: block; height: 100%; border-radius: 3px; background: var(--tone); transform-origin: left; }
.mnd .mnd-legend__row b { text-align: right; font-size: 14px; font-weight: 700; line-height: 19.6px; }
.mnd .mnd-health { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 27px -5.5px 0; }
.mnd .mnd-gauge { display: grid; justify-items: center; text-align: center; }
.mnd .mnd-ring { position: relative; width: 118px; height: 118px; }
.mnd .mnd-ring svg { display: block; width: 118px; height: 118px; transform: rotate(123.6deg); }
.mnd .mnd-ring__track { stroke: #15201c12; }
.mnd .mnd-ring__val { stroke: var(--tone); }
.mnd .mnd-ring b { position: absolute; inset: 0; display: grid; place-items: center; font-size: 26px; font-weight: 800; line-height: 36.4px; letter-spacing: -.78px; }
.mnd .mnd-gauge__l { margin-top: 13px; font-size: 14px; font-weight: 600; line-height: 19.6px; }
.mnd .mnd-gauge__s { margin-top: 4px; font-size: 12px; line-height: 16.8px; color: var(--ink-3); }

@container mnd (max-width: 700px) {
  .mnd .mnd-page-t { font-size: 28px; line-height: 30.8px; letter-spacing: -.84px; padding-left: 4px; margin-bottom: 20px; }
  .mnd .mnd-panel { padding: 16px 14px 18px; border-radius: 26px; }
  .mnd .mnd-board-head { grid-template-columns: 1fr auto; row-gap: 17px; height: auto; margin-top: 1px; }
  .mnd .mnd-board-head .mnd-seg { grid-column: 1 / -1; order: 3; justify-self: stretch; }
  .mnd .mnd-seg__pill, .mnd .mnd-seg button { width: calc((100% - 8px) / 4); }
  .mnd .mnd-seg__pill { width: calc((100vw - 32px - 28px - 2px - 8px) / 4); }
  .mnd .mnd-seg button { flex: 1; font-size: 12.5px; line-height: 17.5px; }
  .mnd .mnd-seg .mnd-largo { display: none; }
  .mnd .mnd-seg .mnd-corto { display: inline; }
  .mnd .mnd-btn--txt span { display: none; }
  .mnd .mnd-btn--txt { width: 42px; padding: 0; }
  .mnd .mnd-lanes { display: flex; gap: 14px; margin-top: 18px; padding-bottom: 9px; overflow-x: auto; scrollbar-width: none; }
  .mnd .mnd-lane { flex: 0 0 276px; min-width: 0; }
  .mnd .mnd-case { height: auto; padding: 11px 12px 11px 11px; gap: 10px; }
  .mnd .mnd-case .mnd-av { width: 34px; height: 34px; font-size: 12px; }
  .mnd .mnd-row2 { grid-template-columns: 1fr; }
  .mnd .mnd-row2 .mnd-panel { height: auto; }
  .mnd .mnd-drivers { grid-template-columns: 1fr; justify-items: center; gap: 18px; margin-top: 18px; padding-left: 0; }
  .mnd .mnd-donut, .mnd .mnd-donut svg { width: 140px; height: 140px; }
  .mnd .mnd-donut circle { stroke-width: 23.3; }
  .mnd .mnd-legend { width: 100%; }
  .mnd .mnd-health { margin: 24px -1.5px 0; }
  .mnd .mnd-ring circle { stroke-width: 11; }
  .mnd .mnd-ring, .mnd .mnd-ring svg { width: 96px; height: 96px; }
  .mnd .mnd-ring b { font-size: 19px; line-height: 26.6px; letter-spacing: -.57px; }
  .mnd .mnd-gauge__l { margin-top: 12px; font-weight: 700; }
  .mnd .mnd-gauge__s { margin-top: 3px; }
}

/* ── lo de la adaptación (DESPUÉS de los @container de la copia: los pisa en el mismo ancho) ──────────── */
.mnd .mnd-pagina { position: relative; z-index: 1; padding: 22px 24px 44px; }
.mnd .mnd-head { margin: 0 0 22px; padding-left: 4px; }
.mnd .mnd-head .mnd-page-t { padding-left: 0; margin: 0; }
.mnd .mnd-lede { margin-top: 6px; font-size: 14.5px; line-height: 20.3px; color: var(--ink-3); }
.mnd .mnd-lede b { color: var(--ink); font-weight: 700; }
.mnd .mnd-quieta { opacity: .72; pointer-events: none; }
.mnd .mnd-vacio { display: grid; place-content: center; gap: 4px; min-height: 140px; padding: 24px 16px; text-align: center; font-size: 13px; line-height: 1.45; color: var(--ink-3); }
.mnd .mnd-vacio b { display: block; color: var(--ink); font-weight: 600; }
.mnd .mnd-btn { text-decoration: none; white-space: nowrap; }
.mnd .mnd-board-acts .mnd-iconbtn { color: var(--ink-2); }
.mnd .mnd-lanes { grid-template-columns: repeat(var(--mnd-carriles, 4), minmax(250px, 1fr)); overflow-x: auto; scrollbar-width: thin; padding-bottom: 4px; margin-bottom: -4px; }
.mnd .mnd-lane { min-width: 0; }
.mnd .mnd-lane__h span:first-child { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; min-width: 0; }
.mnd .mnd-lane__h { padding: 0 14px; }
.mnd .mnd-case[role='button'] { cursor: pointer; }
.mnd .mnd-case[role='button']:focus-visible { outline-offset: -2px; }
.mnd .mnd-case__title { color: var(--ink); }
/* «Debe» no se corta nunca: cede el texto del contacto (en Mender, el «Late» también se cortaba con el renglón). */
.mnd .mnd-case__meta { display: flex; align-items: baseline; min-width: 0; }
.mnd .mnd-case__meta-t { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mnd .mnd-late { flex: none; }
.mnd .mnd-case__ico { width: 28px; height: 28px; flex: none; display: grid; place-items: center; color: var(--ink-3); }
.mnd .mnd-case__ico svg { width: 17px; height: 17px; }
.mnd .mnd-lane__mas { display: flex; align-items: center; justify-content: center; gap: 6px; height: 44px; border-radius: 22px; border: 1px dashed var(--line-2); font-size: 13px; font-weight: 600; color: var(--ink-2); transition: background-color .2s, color .2s; }
.mnd .mnd-lane__mas:hover { background: var(--card); color: var(--ink); }
.mnd .mnd-lane__mas svg { width: 15px; height: 15px; }
.mnd .mnd-lane__vacio { display: grid; place-items: center; height: 64px; border-radius: 22px; border: 1px dashed var(--line-2); font-size: 12.5px; color: var(--ink-3); }
.mnd .mnd-nota { margin-top: 14px; font-size: 12.5px; color: var(--ink-3); text-align: center; }
.mnd .mnd-nota a { color: var(--emerald-ink); font-weight: 600; }
.mnd .mnd-legend__row[role='button'] { cursor: pointer; }
.mnd .mnd-legend__row { cursor: default; }
.mnd .mnd-legend__label { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; min-width: 0; }
.mnd .mnd-donut circle { transition: none; }
.mnd .mnd-ring b.mnd-sin { font-size: 15px; font-weight: 600; color: var(--ink-3); letter-spacing: 0; }
.mnd .mnd-row2 .mnd-panel { min-height: 299px; height: auto; }
@container mnd (max-width: 980px) {
  .mnd .mnd-row2 { grid-template-columns: minmax(0, 1fr); }
}
@container mnd (max-width: 700px) {
  .mnd .mnd-pagina { padding: 15px 16px 32px; }
  .mnd .mnd-head { margin-bottom: 20px; }
  .mnd .mnd-lede { font-size: 13.5px; line-height: 19px; }
  .mnd .mnd-lanes { display: flex; grid-template-columns: none; margin: 18px 0 0; padding-bottom: 9px; scrollbar-width: none; }
  .mnd .mnd-lane { flex: 0 0 276px; }
  .mnd .mnd-board-head .mnd-seg { grid-column: 1 / -1; order: 3; justify-self: stretch; }
  .mnd .mnd-row2 .mnd-panel { min-height: 0; }
  .mnd .mnd-seg--sm button { flex: none; width: 76px; }
  .mnd .mnd-gauge__l { text-wrap: balance; }
}
@media (prefers-reduced-motion: reduce) { .mnd *, .mnd *::before, .mnd *::after { transition: none !important; animation: none !important; } }
`;
