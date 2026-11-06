// =============================================================================
// productividad-css — la hoja de estilos del DISEÑO de la hoja Productividad: la copia de Fernly, sólo de esta hoja
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco». Es docs/diseno/mockups-dashboard/productividad-fernly/fernly.css (escrita desde lo MEDIDO del demo: valores.json, las
// capturas a 1440 y 390 y el INFORME; nada del código de la tienda) con todo adentro de `.frn` y cada clase con el prefijo `frn-`,
// para no tocar nada del resto del Dashboard. Sin el armazón de Fernly (la barra lateral y la de arriba): en MaKo lo pone la app.
// La arma scratchpad/frn/armar-frn.py desde la hoja de la copia: se cambia la copia y se vuelve a armar.
//
// Lo que se suma a la copia, y es de la adaptación (productividad-fernly/mako.html): la página sin el armazón, las columnas de
// lo que vence (tantas como semanas), los nombres largos que se cortan con «…», los vacíos, las filas que se abren, la prioridad
// en la tarjeta oscura (en lugar del cronómetro) y un paso intermedio entre 700 y 1000 px de ancho, que Fernly no tiene.
//
// ⚠️ LA LETRA ES PLUS JAKARTA SANS, la de Fernly: acá se llama «Fernly Jakarta», con las URL de Google Fonts, así la hoja no
//    depende de cómo se llame la letra de la app.
// ⚠️ ESTA HOJA ES SÓLO DE PRODUCTIVIDAD: otra hoja con diseño escribe la suya (la de su demo), no reusa ésta.
// ⚠️ EL TELÉFONO VA POR @container (el ancho del lienzo), no por el de la ventana, y lo de la adaptación va DESPUÉS de los
//    @container de la copia: dos reglas iguales las decide el orden (docs/hallazgos-templates-dashboard.md §18).
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.
// ⚠️ PALETA DOBLE (6/11/2026, Martín: «los que vienen en dark mode deben acompañar siempre el white mode si el usuario lo tiene así en MaKo»):
//    nace clara y, con data-tema="oscuro" en html, la regla de abajo de la raíz cambia las MISMAS variables. Las tarjetas verdes
//    oscuras (la del total y el cronómetro) son un acento y quedan iguales en los dos modos: van con variables fijas (hero, btn).
// =============================================================================

export const CSS_PRODUCTIVIDAD = `
@font-face { font-family: 'Fernly Jakarta'; font-style: normal; font-weight: 200 800; font-display: swap; src: url(https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko40yyygA.woff2) format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'Fernly Jakarta'; font-style: normal; font-weight: 200 800; font-display: swap; src: url(https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yw.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
.frn {
  container-type: inline-size; container-name: frn;
  --font: 'Fernly Jakarta', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --page: #e9ebe9; --panel: #f5f6f5; --card: #fdfdfc; --hair: #e3e7e4;
  --ink: #131a15; --muted: #646d67; --faint: #6c756f;
  --g-950: #0d3a23; --g-800: #155a37; --g-700: #1d7347; --g-600: #27865a; --g-400: #5dbd8b; --g-100: #e3f2e9;
  --hatch: #8d9a92; --deep: color-mix(in srgb, #0d3a23 55%, #000); --swirl: color-mix(in srgb, #5dbd8b 22%, transparent);
  --amber: #98590a; --amber-bg: #fdf3e2; --rose: #c23b3b; --rose-bg: #fdeceb;
  --r-lg: 26px; --r-md: 20px; --gap: 16px;
  --shadow: 0 1px 2px #131a150a, 0 8px 24px -12px #131a151a;
  --ease: cubic-bezier(.22, 1, .36, 1);
  --focus: 0 0 0 3px var(--card), 0 0 0 5px var(--g-600);
  --shadow-tip: 0 4px 10px -6px #131a1533;
  --hero-a: #155a37; --hero-b: #0d3a23; --hero-c: #1d5a3a; --hero-ink: #f1f8f3; --hero-hover: #5dbd8b;
  --btn-a: #1d7347; --btn-ha: #27865a; --btn-b: #155a37; --btn2-a: #155a37; --btn2-ha: #1d7347; --btn2-b: #0d3a23; --btn-ink: #f2f8f4;
  --av-1: #f6c6c2; --av-2: #cdeccf; --av-3: #cfd6f7; --av-4: #f5dfb5; --av-fg: #131a15c7;
  position: relative; isolation: isolate; color: var(--ink); font: 400 14px/1.45 var(--font); -webkit-font-smoothing: antialiased;
  background: var(--page);
}
/* Modo oscuro de MaKo: la escala verde se aclara (texto y barras se leen sobre la tarjeta oscura) y las superficies suben de luminosidad. */
.frn:where([data-tema="oscuro"] *) {
  --page: #0e100f; --panel: #151816; --card: #1c211e; --hair: #2b312d;
  --ink: #ededeb; --muted: #a9b0ab; --faint: #8e9691;
  --g-950: #2a8c5e; --g-800: #6fcf9f; --g-700: #4fbf86; --g-600: #5fcf96; --g-400: #8fe0b5; --g-100: #1f3a2c;
  --hatch: #5d6861;
  --amber: #e5ac45; --amber-bg: #3a2d12; --rose: #f08a8a; --rose-bg: #3d1f1f;
  --shadow: 0 1px 2px #0008, 0 8px 24px -12px #000c;
  --shadow-tip: 0 4px 10px -6px #000c;
  --av-1: #4a2a28; --av-2: #29432c; --av-3: #2a3258; --av-4: #4a3e1f; --av-fg: #ededebe0;
}
.frn *, .frn *::before, .frn *::after { box-sizing: border-box; }
.frn button { font: inherit; color: inherit; cursor: pointer; }
.frn a { color: inherit; text-decoration: none; }
.frn h1, .frn h2, .frn h3, .frn p, .frn ol, .frn ul { margin: 0; }
.frn ol, .frn ul { padding: 0; list-style: none; }
.frn svg.frn-i { width: 20px; height: 20px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.frn .frn-num { font-variant-numeric: tabular-nums; }
.frn :focus-visible { outline: none; box-shadow: var(--focus); }

/* ── la copia ──────────────────────────────────────────────────────────────────────────────── */
.frn * { box-sizing: border-box; }
.frn .frn-board { padding: 22px 20px 16px; border-radius: var(--r-lg); background: var(--panel); }
.frn .frn-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.frn .frn-head h1 { font-size: 34px; font-weight: 600; line-height: 37.4px; letter-spacing: -1.19px; }
.frn .frn-head p { margin-top: 3px; font-size: 15px; line-height: 21.75px; color: var(--muted); }
.frn .frn-head__acts { display: flex; gap: 13px; margin-top: 15px; }
.frn .frn-btn { height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 0 22px; border-radius: 24px; border: 0; font-size: 16px; font-weight: 500; line-height: 23.2px; white-space: nowrap; transition: background .2s, transform .2s; }
.frn .frn-btn--primary { min-width: 173px; background: linear-gradient(180deg, var(--btn-a), var(--btn-b)); color: var(--btn-ink); }
.frn .frn-btn--primary:hover { background: linear-gradient(180deg, var(--btn-ha), var(--btn-b)); }
.frn .frn-btn--ghost { min-width: 173px; background: transparent; box-shadow: inset 0 0 0 1.5px var(--ink); color: var(--ink); }
.frn .frn-btn--ghost:hover { background: var(--g-100); }
.frn .frn-btn svg { width: 19px; height: 19px; }
.frn .frn-grid { display: grid; grid-template-columns: minmax(0, 1fr) 266px; gap: 16px; margin-top: 18px; }
.frn .frn-stats { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.frn .frn-card { position: relative; border-radius: var(--r-md); background: var(--card); box-shadow: var(--shadow); padding: 18px 20px; }
.frn .frn-card__t { font-size: 19px; font-weight: 500; line-height: 27.55px; letter-spacing: -.38px; }
.frn .frn-stat { height: 158px; display: flex; flex-direction: column; }
.frn .frn-stat__t { font-size: 18px; font-weight: 500; line-height: 26.1px; letter-spacing: -.27px; padding-right: 48px; }
.frn .frn-arrow { position: absolute; top: 18px; right: 20px; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; border: 1.5px solid var(--ink); color: var(--ink); background: transparent; transition: background-color .25s, color .25s, transform .35s var(--ease); }
.frn .frn-arrow:hover { background: var(--ink); color: var(--card); transform: rotate(45deg); }
.frn .frn-arrow svg { width: 15px; height: 15px; }
.frn .frn-stat__n { margin-top: 20px; font-size: 48px; font-weight: 600; line-height: 48px; letter-spacing: -1.92px; }
.frn .frn-stat__s { margin-top: auto; display: flex; align-items: center; gap: 9px; font-size: 13.5px; line-height: 19.575px; color: var(--muted); }
.frn .frn-stat__chip { height: 16px; padding: 0 4px; display: inline-flex; align-items: center; gap: 2px; border: 1px solid currentColor; border-radius: 4px; font-size: 10.5px; line-height: 16px; }
.frn .frn-stat__chip svg { width: 8px; height: 8px; stroke-width: 2.2; }
.frn .frn-stat__s--ok { color: var(--g-700); }
.frn .frn-stat--hero { color: var(--hero-ink); background: linear-gradient(150deg, var(--hero-a) 0%, var(--hero-b) 62%, var(--hero-c) 100%); box-shadow: 0 14px 30px -16px #0d3a23b3; overflow: hidden; }
.frn .frn-stat--hero::after { content: ''; position: absolute; inset: 0; background: radial-gradient(120% 90% at 100% 0%, #5dbd8b22, transparent 60%); pointer-events: none; }
.frn .frn-stat--hero .frn-stat__s { color: #b9e6cb; }
.frn .frn-stat--hero .frn-arrow { border-color: transparent; background: #e3f2e9; color: var(--hero-b); }
.frn .frn-stat--hero .frn-arrow:hover { background: var(--hero-hover); }
.frn .frn-left { min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.frn .frn-row { display: grid; grid-template-columns: minmax(0, 548fr) minmax(0, 266fr); gap: 16px; height: 292px; }
.frn .frn-row--2 { grid-template-columns: minmax(0, 454fr) minmax(0, 360fr); }
.frn .frn-right { display: flex; flex-direction: column; gap: 16px; }
.frn .frn-bars { position: relative; height: 209px; margin-top: 18px; display: grid; grid-template-columns: repeat(7, 58px); justify-content: space-between; align-items: end; }
.frn .frn-bar { position: relative; display: grid; justify-items: center; gap: 10px; }
.frn .frn-bar__fill { width: 58px; height: calc(var(--h) * 175px); border-radius: 29px; background: var(--g-700); transition: filter .2s; transform-origin: bottom; }
.frn .frn-bar:hover .frn-bar__fill { filter: brightness(1.08); }
.frn .frn-bar--hatch .frn-bar__fill { background: repeating-linear-gradient(135deg, var(--hatch) 0 2.2px, transparent 2.2px 8px), var(--card); box-shadow: inset 0 0 0 1px var(--hair); }
.frn .frn-bar--light .frn-bar__fill { background: var(--g-400); }
.frn .frn-bar--dark .frn-bar__fill { background: var(--g-950); }
.frn .frn-bar__l { font-size: 14px; line-height: 20.3px; color: var(--faint); }
.frn .frn-bar__tip { position: absolute; left: 50%; top: -38px; transform: translateX(-50%); padding: 1px 8px; border-radius: 8px; background: var(--card); box-shadow: 0 0 0 1px var(--hair), var(--shadow-tip); font-size: 11px; font-weight: 600; line-height: 15.95px; white-space: nowrap; }
.frn .frn-bar__tip::after { content: ''; position: absolute; left: 50%; top: 100%; width: 1px; height: 10px; background: var(--hair); }
.frn .frn-rem { display: flex; flex-direction: column; }
.frn .frn-rem__h { margin-top: 15px; font-size: 24px; font-weight: 600; line-height: 27.6px; letter-spacing: -.6px; color: var(--g-800); }
.frn .frn-rem__t { margin-top: 10px; font-size: 14.5px; line-height: 21.025px; color: var(--muted); }
.frn .frn-rem .frn-btn { margin-top: auto; width: 100%; background: linear-gradient(180deg, var(--btn2-a), var(--btn2-b)); color: var(--btn-ink); }
.frn .frn-rem .frn-btn:hover { background: linear-gradient(180deg, var(--btn2-ha), var(--btn2-b)); }
.frn .frn-projects { height: 388px; }
.frn .frn-card__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.frn .frn-chip { height: 35px; display: inline-flex; align-items: center; gap: 7px; padding: 0 14px; border-radius: 18px; border: 1.5px solid var(--ink); background: transparent; font-size: 14px; font-weight: 500; line-height: 20.3px; transition: background-color .2s; }
.frn .frn-chip:hover { background: var(--g-100); }
.frn .frn-chip svg { width: 15px; height: 15px; }
.frn .frn-plist { margin-top: 15px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.frn .frn-plist li { display: flex; align-items: center; gap: 12px; }
.frn .frn-plist__ic { width: 30px; height: 30px; flex: none; margin-left: -1.5px; }
.frn .frn-plist b { display: block; font-size: 15px; font-weight: 500; line-height: 19.5px; }
.frn .frn-plist span { display: block; font-size: 12px; line-height: 17.4px; color: var(--faint); }
.frn .frn-tracker { flex: 1; overflow: hidden; color: var(--hero-ink); background: var(--deep); }
.frn .frn-tracker::after { content: ''; position: absolute; inset: 0; background: repeating-radial-gradient(circle at 0% 100%, transparent 0 16px, var(--swirl) 16px 17px); opacity: .55; pointer-events: none; }
.frn .frn-tracker .frn-card__t { position: relative; z-index: 1; }
.frn .frn-clock { position: relative; z-index: 1; margin-top: 4px; text-align: center; font-size: 46px; font-weight: 600; line-height: 1.45; letter-spacing: -.92px; }
.frn .frn-clock .frn-dg { display: inline-block; height: 1.15em; overflow: hidden; line-height: 1.15; }
.frn .frn-tbtns { position: relative; z-index: 1; display: flex; justify-content: center; gap: 14px; margin-top: 11px; }
.frn .frn-tbtn { width: 50px; height: 50px; border-radius: 50%; display: grid; place-items: center; border: 0; transition: transform .2s; }
.frn .frn-tbtn:hover { transform: scale(1.07); }
.frn .frn-tbtn--play { background: var(--hero-ink); color: #131a15; }
.frn .frn-tbtn--stop { background: #d63a3a; color: var(--hero-ink); }
.frn .frn-tbtn svg { width: 18px; height: 18px; }
.frn .frn-tlist { margin-top: 15px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
.frn .frn-tlist li { display: flex; align-items: center; gap: 14px; }
.frn .frn-av { width: 44px; height: 44px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 13.5px; font-weight: 600; letter-spacing: .27px; color: var(--av-fg); }
.frn .frn-av--pr { background: var(--av-1); }
.frn .frn-av--ms { background: var(--av-2); }
.frn .frn-av--hk { background: var(--av-3); }
.frn .frn-av--om { background: var(--av-4); }
.frn .frn-tlist__txt { flex: 1; min-width: 0; }
.frn .frn-tlist__txt b { display: block; font-size: 15.5px; font-weight: 500; line-height: 22.475px; }
.frn .frn-tlist__txt span { display: block; font-size: 12.5px; line-height: 18.125px; color: var(--faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.frn .frn-tlist__txt em { font-style: normal; font-weight: 600; color: var(--ink); }
.frn .frn-tlist .frn-pill { flex: none; height: 20px; padding: 0 7px; display: inline-flex; align-items: center; border-radius: 6px; border: 1px solid currentColor; font-size: 11px; font-weight: 500; line-height: 15.95px; }
.frn .frn-tlist .frn-pill--ok { color: var(--g-700); background: var(--g-100); }
.frn .frn-tlist .frn-pill--run { color: var(--amber); background: var(--amber-bg); }
.frn .frn-tlist .frn-pill--wait { color: var(--rose); background: var(--rose-bg); }
.frn .frn-progress { display: flex; flex-direction: column; }
.frn .frn-gauge { position: relative; width: 250px; height: 149px; margin: 47.5px auto 0; }
.frn .frn-gauge svg { display: block; width: 250px; height: 149px; overflow: visible; }
.frn .frn-gauge__c { position: absolute; left: 0; right: 0; bottom: -2px; text-align: center; }
.frn .frn-gauge__c b { display: block; font-size: 54px; font-weight: 600; line-height: 54px; letter-spacing: -2.7px; }
.frn .frn-gauge__c span { display: block; margin-top: 2px; font-size: 14px; line-height: 20.3px; color: var(--muted); }
.frn .frn-legend { margin-top: 12px; display: flex; justify-content: center; gap: 18px; font-size: 14px; line-height: 20.3px; color: var(--muted); }
.frn .frn-legend span { display: inline-flex; align-items: center; gap: 8px; }
.frn .frn-legend i { width: 16px; height: 16px; border-radius: 50%; background: var(--g-700); }
.frn .frn-legend i.frn-dk { background: var(--g-950); }
.frn .frn-legend i.frn-ht { background: repeating-linear-gradient(135deg, var(--hatch) 0 1.6px, transparent 1.6px 5px); box-shadow: inset 0 0 0 1px var(--hair); }

@container frn (max-width: 700px) {
  .frn .frn-board { margin-top: 0; padding: 22px 12px 12px; }
  .frn .frn-head p { margin-top: 8px; }
  .frn .frn-head { flex-direction: column; gap: 0; padding: 0 4px; }
  .frn .frn-head h1 { font-size: 30px; line-height: 33px; letter-spacing: -1.05px; }
  .frn .frn-head__acts { margin-top: 16px; width: 100%; gap: 12px; }
  .frn .frn-head__acts .frn-btn { flex: 1; min-width: 0; height: 50px; padding: 0 12px; }
  .frn .frn-grid { display: flex; flex-direction: column; gap: 12px; margin-top: 26px; }
  .frn .frn-left, .frn .frn-right, .frn .frn-row { display: contents; }
  .frn .frn-stats { order: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .frn .frn-analytics { order: 1; height: 264px; }
  .frn .frn-reminder, .frn .frn-rem { order: 2; }
  .frn .frn-projects { order: 3; }
  .frn .frn-team { order: 4; }
  .frn .frn-progress { order: 5; }
  .frn .frn-tracker { order: 6; flex: none; display: flex; flex-direction: column; height: 210px; }
  .frn .frn-clock { margin-top: 22px; font-size: 38px; letter-spacing: -.76px; }
  .frn .frn-tbtns { margin-top: auto; }
  .frn .frn-stat { height: 177px; padding: 16px; }
  .frn .frn-stat__t { font-size: 14.5px; line-height: 21.025px; letter-spacing: -.2175px; padding-right: 38px; }
  .frn .frn-arrow { top: 16px; right: 16px; width: 30px; height: 30px; }
  .frn .frn-arrow svg { width: 13px; height: 13px; }
  .frn .frn-stat__n { margin-top: auto; font-size: 42px; line-height: 42px; letter-spacing: -1.68px; }
  .frn .frn-stat__s { margin-top: 10px; font-size: 11.5px; line-height: 16.675px; align-items: flex-start; }
  .frn .frn-card { padding: 20px; }
  .frn .frn-analytics { display: flex; flex-direction: column; }
  .frn .frn-bars { grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 9px; height: 168px; margin-top: auto; margin-bottom: -1px; }
  .frn .frn-bar__fill { width: 100%; height: calc(var(--h) * 136px); }
  .frn .frn-rem { height: 224px; }
  .frn .frn-rem__h { margin-top: 26px; font-size: 20px; line-height: 23px; letter-spacing: -.5px; }
  .frn .frn-rem__t { margin-top: 11px; }
  .frn .frn-rem .frn-btn { height: 54px; margin-bottom: 1px; }
  .frn .frn-projects { height: auto; }
  .frn .frn-plist { margin-top: 20px; gap: 16px; }
  .frn .frn-tlist { margin-top: 22px; gap: 14px; }
  .frn .frn-chip { white-space: nowrap; flex: none; }
  .frn .frn-gauge { width: 277px; height: 165px; margin-top: 17.5px; }
  .frn .frn-gauge svg { width: 277px; height: 165px; }
  .frn .frn-gauge__c { bottom: 0; }
  .frn .frn-gauge__c b { font-size: 40px; line-height: 40px; letter-spacing: -2px; }
  .frn .frn-gauge__c span { font-size: 13.5px; line-height: 19.575px; }
  .frn .frn-legend { margin-top: 22px; gap: 17px; font-size: 13.5px; line-height: 19.575px; }
}

/* ── lo de la adaptación (DESPUÉS de los @container de la copia: los pisa en el mismo ancho) ──────────── */
.frn { padding: 12px; }
.frn .frn-head p b { font-weight: 600; color: var(--ink); }
.frn .frn-quieta { opacity: .72; pointer-events: none; }
.frn .frn-vacio { display: grid; place-content: center; gap: 4px; min-height: 120px; padding: 18px 12px; text-align: center; font-size: 13px; line-height: 1.45; color: var(--muted); }
.frn .frn-vacio b { display: block; color: var(--ink); font-weight: 600; }
.frn .frn-btn, .frn .frn-chip, .frn .frn-arrow { text-decoration: none; }
.frn .frn-chip { flex: none; white-space: nowrap; }
.frn [role='button'] { cursor: pointer; }
.frn .frn-bars { grid-template-columns: repeat(var(--frn-n, 7), 58px); }
.frn .frn-bar[role='button']:focus-visible { box-shadow: none; outline: 2px solid var(--g-600); outline-offset: 3px; border-radius: 12px; }
.frn .frn-bar__l { white-space: nowrap; }
.frn .frn-rem > * { flex-shrink: 0; }
.frn .frn-rem__t { margin-bottom: 16px; }
.frn .frn-rem__h { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.frn .frn-plist li > div { min-width: 0; }
.frn .frn-plist b, .frn .frn-tlist__txt b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.frn .frn-av--a { background: var(--av-1); } .frn .frn-av--b { background: var(--av-2); } .frn .frn-av--c { background: var(--av-3); } .frn .frn-av--d { background: var(--av-4); }
.frn .frn-tracker { display: flex; flex-direction: column; }
.frn .frn-prio { position: relative; z-index: 1; margin: auto 0; display: flex; justify-content: center; gap: 28px; }
.frn .frn-prio__g { display: grid; justify-items: center; gap: 2px; border-radius: 12px; }
.frn .frn-clock { font-size: 46px; font-weight: 600; line-height: 52.9px; letter-spacing: -.92px; }
.frn .frn-prio__g span { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; line-height: 18.125px; color: #b9d4c3; }
.frn .frn-prio__d { width: 8px; height: 8px; border-radius: 50%; background: var(--g-400); }
.frn .frn-prio__d--alta { background: #e05555; } .frn .frn-prio__d--media { background: #f2a516; }
.frn .frn-prio__fut { position: relative; z-index: 1; margin-top: 6px; text-align: center; font-size: 12.5px; line-height: 18.125px; color: #b9d4c3; }
@media (hover: hover) {
  .frn [data-lift] { transition: transform .45s cubic-bezier(.215, .61, .355, 1); }
  .frn [data-lift]:hover { transform: translateY(-4px); }
}
@container frn (min-width: 701px) and (max-width: 1000px) {
  .frn .frn-grid { grid-template-columns: minmax(0, 1fr); }
  .frn .frn-right { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .frn .frn-projects { height: auto; }
}
@container frn (max-width: 700px) {
  .frn { padding: 10px; }
  .frn .frn-bars { grid-template-columns: repeat(var(--frn-n, 7), minmax(0, 1fr)); }
  .frn .frn-clock { font-size: 38px; line-height: 43.7px; letter-spacing: -.76px; }
  .frn .frn-prio { gap: 22px; }
  .frn .frn-rem { height: auto; min-height: 224px; }
}
@media (prefers-reduced-motion: reduce) { .frn *, .frn *::before, .frn *::after { transition: none !important; animation: none !important; } }
`;
