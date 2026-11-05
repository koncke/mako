// =============================================================================
// instagram-css — la hoja de estilos del DISEÑO de la hoja «Instagram y redes»: la copia de Murmura, sólo de esta hoja
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco». Es docs/diseno/mockups-dashboard/instagram-murmura/murmura.css (escrita desde lo MEDIDO del demo: valores.json, las
// capturas a 1440 y 390, los estados y el INFORME; nada del código de la tienda) con todo adentro de `.mur` y cada clase con el
// prefijo `mur-`, para no tocar nada del resto del Dashboard. Sin el armazón de Murmura (el fondo, la barra de arriba, la de la
// izquierda y la barra de abajo del teléfono): en MaKo los pone la app. La arma scratchpad/ig/armar-ig.py desde la hoja de la copia:
// se cambia la copia y se vuelve a armar.
//
// Lo que se suma a la copia, y es de la adaptación (instagram-murmura/mako.html): la frase de arriba, los vacíos, la miniatura de
// un anuncio con su imagen, los íconos de Messenger y WhatsApp, los colores del reparto por género, los rótulos del eje que pone la
// hoja, las filas que se abren y la fila de días con su barra de desplazamiento fina (la copia la esconde; aquí no se esconde nada).
//
// ⚠️ LA LETRA ES URBANIST, la de Murmura: aquí se llama «Murmura Urbanist», con la URL de Google Fonts, así la hoja no depende de cómo
//    se llame la letra de la app.
// ⚠️ ESTA HOJA ES SÓLO DE «INSTAGRAM Y REDES»: otra hoja con diseño escribe la suya (la de su demo), no reusa ésta.
// ⚠️ EL TELÉFONO VA POR @container (el ancho del lienzo), no por el de la ventana, y lo de la adaptación va DESPUÉS de los
//    @container de la copia: dos reglas iguales las decide el orden (docs/hallazgos-templates-dashboard.md §18).
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.
// =============================================================================

export const CSS_INSTAGRAM = `
@font-face { font-family: 'Murmura Urbanist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/urbanist/v18/L0x-DF02iFML4hGCyMqlbS0.woff2) format('woff2'); }
.mur {
  container-type: inline-size; container-name: mur;
  --font: 'Murmura Urbanist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --bg: #f1f2ef; --mesh-a: #cde9e4; --mesh-b: #f3e3c8; --mesh-c: #d3e6f3;
  --glass: #ffffff85; --glass-2: #ffffffb3; --glass-3: #ffffffdb; --solid: #f6f7f4; --float: #fdfdfb;
  --well: #161a1e0f; --line: #161a1e17; --line-2: #161a1e29; --rim: #ffffffd1;
  --shadow: 0 1px 0 #ffffffbf inset, 0 24px 48px -30px #1e282d47; --shadow-pop: 0 24px 60px -18px #14181c4d, 0 2px 6px #14181c14;
  --text: #16191d; --muted: #5b6064; --faint: #696e72; --cream: #f6f7f5;
  --butter: #f2b740; --on-butter: #16191d; --pine: #11745a; --on-pine: #f6f7f5; --coral: #c43c30; --on-coral: #f6f7f5;
  --sea: #1f68a8; --on-sea: #f6f7f5; --lilac: #0b7a87; --ink: #16191d; --on-ink: #f6f7f5;
  --good: #11745a; --bad: #b8382c; --warn: #855c00;
  --n-instagram: #c13584; --n-facebook: #1665d8; --n-x: #16191d; --n-linkedin: #0a66c2; --n-tiktok: #16191d; --n-youtube: #d61f1f; --n-pinterest: #d0021b; --n-threads: #16191d;
  --dock: #16191d; --on-dock: #f6f7f5;
  --r-card: 26px; --r-tile: 22px; --gap: 16px; --ease: cubic-bezier(.2, .8, .2, 1);
  position: relative; isolation: isolate; overflow: clip; color: var(--text); font: 500 14px/1.45 var(--font); -webkit-font-smoothing: antialiased;
  background: var(--bg);
}
.mur *, .mur *::before, .mur *::after { box-sizing: border-box; }
.mur button { font: inherit; color: inherit; cursor: pointer; }
.mur a { color: inherit; text-decoration: none; }
.mur h1, .mur h2, .mur h3, .mur p, .mur ul { margin: 0; }
.mur ul { padding: 0; list-style: none; }
.mur svg.mur-i { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.mur :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

/* ── la copia ──────────────────────────────────────────────────────────────────────────────── */
.mur * { box-sizing: border-box; }
.mur .mur-ibtn { position: relative; width: 42px; height: 42px; display: grid; place-items: center; flex: none; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--text); transition: background-color .15s; }
.mur .mur-ibtn svg { width: 17px; height: 17px; }
.mur .mur-ibtn:hover { background: var(--glass-2); }
.mur .mur-ibtn--ring { box-shadow: inset 0 0 0 1px var(--line-2); }
.mur .mur-ibtn--on-dark { color: var(--cream); box-shadow: inset 0 0 0 1px #ffffff40; }
.mur .mur-ibtn--on-dark:hover { background: #ffffff24; }
.mur .mur-av { width: 36px; height: 36px; display: grid; place-items: center; flex: none; border-radius: 50%; background: #dfe7e4; font-size: 12px; font-weight: 700; color: var(--text); }
.mur .mur-av--sm { width: 28px; height: 28px; font-size: 11px; }
.mur .mur-av--a { background: #e9dccb; }
.mur .mur-av--b { background: #d6e4ea; }
.mur .mur-av--c { background: #e6d4d6; }
.mur .mur-av--d { background: #d9e2d4; }
.mur .mur-av--e { background: #e2dccf; }
.mur .mur-head { height: 93px; margin-bottom: 16px; display: grid; grid-template-columns: 206px 300px 277px minmax(0, 1fr) auto; align-items: center; }
.mur .mur-head__title { max-width: 170px; font-size: 38.88px; font-weight: 600; line-height: 40.4352px; letter-spacing: -.972px; }
.mur .mur-head__title .mur-w { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: .08em; margin-bottom: -.08em; }
.mur .mur-head__title .mur-w__i { display: inline-block; transform-origin: 0 100%; }
.mur .mur-stat { display: flex; align-items: center; gap: 12px; }
.mur .mur-stat__ico { width: 48px; height: 48px; display: grid; place-items: center; flex: none; border-radius: 50%; background: var(--glass-2); box-shadow: var(--shadow); }
.mur .mur-stat__ico svg { width: 18px; height: 18px; }
.mur .mur-stat__t { display: grid; }
.mur .mur-stat__n { display: flex; align-items: center; gap: 10px; }
.mur .mur-stat__n b { font-size: 23px; font-weight: 900; line-height: 33.35px; letter-spacing: -.23px; }
.mur .mur-stat__l { max-width: 150px; font-size: 13px; font-weight: 500; line-height: 16.9px; color: var(--muted); }
.mur .mur-head__actions { grid-column: 5; display: flex; }
.mur .mur-pill { height: 24px; display: inline-flex; align-items: center; gap: 6px; padding: 0 9px; border-radius: 999px; font-style: normal; font-size: 12.5px; font-weight: 700; line-height: 18.125px; letter-spacing: .125px; white-space: nowrap; }
.mur .mur-pill--pine { background: var(--pine); color: var(--on-pine); }
.mur .mur-pill--butter { background: var(--butter); color: var(--on-butter); }
.mur .mur-btn { height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 20px; border: 0; border-radius: 999px; font-size: 15px; font-weight: 600; line-height: 21.75px; white-space: nowrap; transition: filter .15s, background-color .15s; }
.mur .mur-btn svg { width: 16px; height: 16px; }
.mur .mur-btn--ink { background: var(--ink); color: var(--on-ink); }
.mur .mur-btn--ink:hover { filter: brightness(1.15); }
.mur .mur-btn--sm { height: 36px; padding: 0 14px; font-size: 13px; line-height: 18.85px; }
.mur .mur-btn--sm svg { width: 15px; height: 15px; }
.mur .mur-btn--pine { background: #117a5d; color: var(--on-pine); }
.mur .mur-btn--ghost { background: var(--glass); box-shadow: inset 0 0 0 1px var(--line-2); color: var(--text); }
.mur .mur-btn--ghost:hover { background: var(--glass-2); }
.mur .mur-ov { display: grid; gap: 16px; }
.mur .mur-ov-r { display: grid; gap: 16px; align-items: stretch; }
.mur .mur-ov-r--a, .mur .mur-ov-r--b { grid-template-columns: minmax(0, 748fr) minmax(0, 529fr); }
.mur .mur-ov-r--c { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.mur .mur-card { position: relative; min-width: 0; padding: 20px; border: 1px solid #ffffffd1; border-radius: var(--r-card); background: #ffffff85; box-shadow: var(--shadow); backdrop-filter: blur(18px) saturate(140%); }
.mur .mur-card__h { height: 42px; display: flex; align-items: center; gap: 10px; }
.mur .mur-card__t { flex: 1; min-width: 0; font-size: 17px; font-weight: 600; line-height: 24.65px; letter-spacing: -.085px; }
.mur .mur-live { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; line-height: 18.85px; color: var(--muted); }
.mur .mur-live__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--pine); }
.mur .mur-eyebrow { margin-top: 18px; font-size: 13px; font-weight: 700; line-height: 18.85px; letter-spacing: .91px; text-transform: uppercase; color: var(--muted); }
.mur .mur-ph { display: block; background: linear-gradient(150deg, #3a2a1e, #1a1410); }
.mur .mur-ph--cafe { background: radial-gradient(circle at 55% 70%, #c9822e 0 18%, transparent 42%), linear-gradient(160deg, #3b3027 0%, #1b1612 70%); }
.mur .mur-ph--latte { background: radial-gradient(circle at 50% 55%, #f2dcc0 0 22%, #b77a43 23% 36%, transparent 37%), linear-gradient(150deg, #5a3b26, #2a1b12); }
.mur .mur-ph--rose { background: radial-gradient(circle at 50% 55%, #e98aa8 0 24%, transparent 46%), linear-gradient(150deg, #2f3b3a, #151c1d); }
.mur .mur-ph--linen { background: linear-gradient(160deg, #e8e1d6, #b9ad9c); }
.mur .mur-ph--ember { background: radial-gradient(circle at 45% 50%, #e2733a 0 20%, transparent 44%), linear-gradient(150deg, #262321, #0f0e0e); }
.mur .mur-ph--night { background: radial-gradient(circle at 40% 45%, #d8b9a4 0 16%, transparent 38%), linear-gradient(150deg, #2e2523, #141011); }
.mur .mur-ph--oak { background: linear-gradient(160deg, #efe9e1, #c7b9a5); }
.mur .mur-ph--garage { background: radial-gradient(ellipse at 55% 62%, #2c5b5a 0 18%, transparent 40%), radial-gradient(ellipse at 50% 20%, #8fb7c0 0 4%, transparent 22%), linear-gradient(180deg, #1d2629 0%, #0b0f11 100%); }
.mur .mur-thumb { width: 50px; height: 50px; flex: none; border-radius: 12px; }
.mur .mur-thumb--44 { width: 44px; height: 44px; border-radius: 10px; }
.mur .mur-net { width: 26px; height: 26px; display: grid; place-items: center; flex: none; border-radius: 50%; background: #fff; box-shadow: inset 0 0 0 1px var(--line); color: var(--text); }
.mur .mur-net:has(use[href='#n-instagram']) { color: var(--n-instagram); }
.mur .mur-net svg { width: 13px; height: 13px; }
.mur .mur-net--fb { color: var(--n-facebook); }
.mur .mur-net--yt { color: var(--n-youtube); }
.mur .mur-net--pin { color: var(--n-pinterest); }
.mur .mur-net--li { color: var(--n-linkedin); }
.mur .mur-net--ig { color: var(--n-instagram); }
.mur .mur-nets { display: flex; }
.mur .mur-nets .mur-net + .mur-net { margin-left: -6px; }
.mur .mur-nets--sm .mur-net { width: 22px; height: 22px; }
.mur .mur-nets--sm .mur-net svg { width: 11px; height: 11px; }
.mur .mur-nets--leg { gap: 8px; }
.mur .mur-nets--leg .mur-net + .mur-net { margin-left: 0; }
.mur .mur-bdg { width: 26px; height: 26px; display: grid; place-items: center; flex: none; border-radius: 8px; font-style: normal; font-size: 12.5px; font-weight: 700; line-height: 18.125px; letter-spacing: -.25px; color: var(--cream); }
.mur .mur-bdg--coral { background: var(--coral); }
.mur .mur-bdg--ink { background: var(--ink); }
.mur .mur-bdg--pine { background: var(--pine); }
.mur .mur-bdg--sea { background: var(--sea); }
.mur .mur-bdg--butter { background: var(--butter); color: var(--on-butter); }
.mur .mur-brandchip { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; line-height: 20.3px; color: var(--cream); }
.mur .mur-ov-hero { margin-top: 15px; height: 288px; display: grid; grid-template-columns: 203.25px minmax(0, 1fr); gap: 20px; padding: 14px; border-radius: 22px; background: var(--ink); color: var(--cream); }
.mur .mur-ov-hero__media { width: 100%; height: 260px; padding: 0; border: 0; border-radius: 16px; overflow: hidden; background: #ffffff0f; }
.mur .mur-ov-hero__media .mur-ph { width: 100%; height: 100%; }
.mur .mur-ov-hero__b { min-width: 0; display: flex; flex-direction: column; padding: 4px 6px 0 0; }
.mur .mur-ov-hero__top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.mur .mur-ov-hero__k { margin-top: 18px; font-size: 13px; font-weight: 600; line-height: 18.85px; }
.mur .mur-ov-hero__n { margin-top: 4px; font-size: 40.32px; font-weight: 600; line-height: 40.32px; letter-spacing: -1.4112px; }
.mur .mur-ov-hero__w { margin-top: 10px; display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; line-height: 20.3px; }
.mur .mur-ov-hero__w svg { width: 15px; height: 15px; }
.mur .mur-ov-hero__p { margin-top: 12px; font-size: 15px; font-weight: 500; line-height: 21.75px; }
.mur .mur-ov-hero__f { margin-top: auto; display: flex; align-items: flex-end; justify-content: space-between; }
.mur .mur-ov-hero__f .mur-net { box-shadow: none; }
.mur .mur-ov-after { margin-top: 9px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.mur .mur-ov-after__item { min-width: 0; height: 68px; display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 8px; border: 1px solid #161a1e17; border-radius: 18px; background: #ffffffb3; text-align: left; transition: background-color .15s; }
.mur .mur-ov-after__item:hover { background: #fff; }
.mur .mur-ov-after__m { flex: 1; min-width: 0; display: grid; }
.mur .mur-ov-after__m b, .mur .mur-ov-todo__m b { font-size: 14px; font-weight: 600; line-height: 20.3px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mur .mur-ov-after__m span, .mur .mur-ov-todo__m > span { font-size: 13px; font-weight: 500; line-height: 18.85px; color: var(--muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mur .mur-ov-after__r { align-self: stretch; display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; }
.mur .mur-st { height: 22px; display: inline-flex; align-items: center; gap: 6px; padding: 0 8px; border-radius: 999px; background: var(--well); font-style: normal; font-size: 12.5px; font-weight: 600; line-height: 18.125px; white-space: nowrap; }
.mur .mur-st::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--sea); }
.mur .mur-st--butter::before { background: var(--butter); }
.mur .mur-count { min-width: 26px; height: 26px; display: grid; place-items: center; padding: 0 7px; border-radius: 999px; background: var(--coral); color: var(--on-coral); font-style: normal; font-size: 12.5px; font-weight: 700; }
.mur .mur-ov-todos { margin-top: 15px; display: grid; gap: 8px; }
.mur .mur-ov-todo { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 6px 12px; padding: 12px; border: 1px solid #161a1e17; border-radius: 18px; background: #ffffffb3; }
.mur .mur-ov-todo--fail { grid-template-columns: 40px minmax(0, 1fr); }
.mur .mur-ov-todo__m { min-width: 0; display: grid; }
.mur .mur-ov-todo__m > span.mur-wrap { white-space: normal; }
.mur .mur-ov-todo__a { margin-top: 6px; display: flex; gap: 6px; }
.mur .mur-ov-todo__ico { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; background: var(--coral); color: var(--on-coral); }
.mur .mur-ov-more { margin-top: 12px; display: flex; justify-content: center; }
.mur .mur-seg { height: 42px; display: inline-flex; align-items: center; gap: 2px; padding: 4px; border-radius: 999px; background: var(--well); }
.mur .mur-seg__btn { height: 34px; padding: 0 14px; border: 0; border-radius: 999px; background: none; font-size: 13px; font-weight: 600; line-height: 18.85px; color: var(--muted); }
.mur .mur-seg__btn[aria-pressed=true] { background: #fff; color: var(--text); box-shadow: 0 1px 2px #14181c1f; }
.mur .mur-ov-growth__big { margin-top: 10px; display: flex; align-items: baseline; gap: 10px; }
.mur .mur-ov-growth__big b { font-size: 43.2px; font-weight: 600; line-height: 62.64px; letter-spacing: -1.296px; }
.mur .mur-ov-growth__big span { font-size: 13px; font-weight: 500; line-height: 18.85px; color: var(--muted); }
.mur .mur-ov-growth__leg { margin-top: 2px; display: flex; align-items: center; gap: 14px; font-size: 13px; font-weight: 500; line-height: 18.85px; color: var(--muted); }
.mur .mur-ov-growth__leg > span:first-child { display: inline-flex; align-items: center; gap: 7px; }
.mur .mur-lg { width: 8px; height: 8px; border-radius: 50%; background: var(--sea); }
.mur .mur-chart { position: relative; margin: 26px 12px 0 43px; height: 191px; }
.mur .mur-chart__svg { display: block; width: 100%; height: 191px; overflow: visible; }
.mur .mur-chart__grid { fill: none; stroke: #161a1e1f; stroke-width: 1; stroke-dasharray: 2 4; vector-effect: non-scaling-stroke; }
.mur .mur-chart__line { fill: none; stroke: var(--sea); stroke-width: 2.2; vector-effect: non-scaling-stroke; }
.mur .mur-chart__y { position: absolute; left: -43px; top: 0; bottom: 0; width: 34px; }
.mur .mur-chart__y span { position: absolute; right: 0; transform: translateY(-50%); font-size: 12px; font-weight: 500; line-height: 17.4px; color: var(--muted); }
.mur .mur-chart__y span:nth-child(1) { top: 0; }
.mur .mur-chart__y span:nth-child(2) { top: 50%; }
.mur .mur-chart__y span:nth-child(3) { top: 100%; }
.mur .mur-chart__x { position: absolute; left: 0; right: 0; top: calc(100% + 7px); height: 18px; }
.mur .mur-chart__x span { position: absolute; transform: translateX(-50%); font-size: 12px; font-weight: 500; line-height: 17.4px; color: var(--muted); white-space: nowrap; }
.mur .mur-chart__x span:first-child { transform: none; }
.mur .mur-chart__x span:last-child { transform: translateX(-100%); }
.mur .mur-ov-topcard { position: relative; width: 100%; height: 333px; margin-top: 15px; display: block; padding: 0; border: 0; border-radius: 22px; overflow: hidden; color: var(--cream); text-align: left; }
.mur .mur-thumb--top { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 22px; }
.mur .mur-ov-topcard::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 35%, #0b0d0fd9); }
.mur .mur-ov-topcard__tag { position: absolute; z-index: 1; left: 14px; top: 14px; }
.mur .mur-ov-topcard__b { position: absolute; z-index: 1; left: 16px; right: 16px; bottom: 16px; display: grid; gap: 8px; }
.mur .mur-ov-topcard__brand { display: flex; align-items: center; justify-content: space-between; }
.mur .mur-brandchip--sm { font-size: 13px; gap: 6px; }
.mur .mur-brandchip--sm .mur-bdg { width: 22px; height: 22px; border-radius: 6px; font-size: 11.5px; }
.mur .mur-nets--stack .mur-net { width: 24px; height: 24px; box-shadow: 0 0 0 2px #0b0d0f; }
.mur .mur-ov-topcard__t { font-size: 16px; font-weight: 600; line-height: 21.6px; }
.mur .mur-ov-topcard__s { display: flex; gap: 22px; margin-top: 2px; }
.mur .mur-ov-topcard__s span { display: grid; font-size: 13px; font-weight: 500; line-height: 18.85px; color: #f6f7f5cc; }
.mur .mur-ov-topcard__s b { font-size: 22px; font-weight: 700; line-height: 31.9px; letter-spacing: -.44px; color: var(--cream); }
.mur .mur-ov-days { margin-top: 15px; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
.mur .mur-ov-day { min-width: 0; height: 231px; display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px solid #161a1e17; border-radius: 20px; background: #ffffffb3; transition: background-color .15s; }
.mur .mur-ov-day:hover { background: #fff; }
.mur .mur-ov-day.mur-is-today { background: var(--ink); color: var(--cream); border-color: transparent; }
.mur .mur-ov-day__h { display: flex; align-items: baseline; justify-content: space-between; font-size: 14px; font-weight: 600; line-height: 20.3px; }
.mur .mur-ov-day__h b { font-size: 24px; font-weight: 600; line-height: 34.8px; letter-spacing: -.48px; }
.mur .mur-slot { height: 30px; display: flex; align-items: center; justify-content: space-between; padding: 0 4px 0 10px; border-radius: 999px; font-size: 12.5px; font-weight: 700; line-height: 18.125px; color: var(--cream); }
.mur .mur-slot .mur-bdg { width: 22px; height: 22px; border-radius: 7px; font-size: 11.5px; line-height: 16.675px; letter-spacing: -.23px; box-shadow: 0 0 0 1.5px #ffffffd9; }
.mur .mur-slot--coral { background: var(--coral); }
.mur .mur-slot--sea { background: var(--sea); }
.mur .mur-slot--butter { background: var(--butter); color: var(--on-butter); }
.mur .mur-slot--more { justify-content: center; height: 24px; padding: 0; background: var(--well); color: var(--text); }
.mur .mur-ov-day__f { margin-top: auto; font-size: 13px; font-weight: 500; line-height: 18.85px; color: var(--muted); }
.mur .mur-is-today .mur-ov-day__f { color: #f6f7f5b3; }
.mur .mur-ov-netlist { margin-top: 12px; }
.mur .mur-ov-netlist li { display: flex; align-items: center; gap: 12px; padding: 13.5px 0; }
.mur .mur-ov-netlist li + li { border-top: 1px solid var(--line); }
.mur .mur-net--lg { width: 36px; height: 36px; color: var(--text); }
.mur .mur-net--lg svg { width: 16px; height: 16px; }
.mur .mur-ov-net__m { flex: 1; min-width: 0; display: grid; gap: 4px; }
.mur .mur-ov-net__m > span { display: flex; justify-content: space-between; font-size: 14px; font-weight: 500; line-height: 20.3px; }
.mur .mur-ov-net__m b { font-weight: 500; }
.mur .mur-ov-net__m em { font-style: normal; }
.mur .mur-bar { display: block; height: 6px; border-radius: 3px; background: var(--well); overflow: hidden; }
.mur .mur-bar > i { display: block; height: 100%; border-radius: 3px; background: var(--sea); transform-origin: 0 50%; transform: scaleX(var(--v)); }
.mur .mur-ov-net__r { width: 62px; display: grid; justify-items: end; }
.mur .mur-ov-net__r b { font-size: 14px; font-weight: 700; line-height: 20.3px; color: var(--good); }
.mur .mur-ov-net__r span { font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); }
.mur .mur-ov-ib__tiles { margin-top: 12px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.mur .mur-ov-ib__tiles span { height: 80px; display: grid; align-content: center; padding: 0 13px; border: 1px solid #161a1e17; border-radius: 16px; background: #ffffffb3; font-size: 13px; font-weight: 500; line-height: 18.85px; color: var(--muted); }
.mur .mur-ov-ib__tiles b { font-size: 24px; font-weight: 700; line-height: 34.8px; letter-spacing: -.48px; color: var(--text); }
.mur .mur-ov-ib__sent { margin-top: 14px; display: flex; gap: 4px; }
.mur .mur-ov-ib__sent .mur-s { height: 10px; flex: var(--f); border-radius: 5px; transform-origin: 0 50%; }
.mur .mur-s--pos, .mur .mur-d--pos { background: var(--pine); }
.mur .mur-s--neu, .mur .mur-d--neu { background: #6b7176; }
.mur .mur-s--neg, .mur .mur-d--neg { background: var(--coral); }
.mur .mur-ov-ib__leg { margin-top: 8px; display: flex; gap: 14px; font-size: 13px; font-weight: 500; line-height: 18.85px; color: var(--muted); }
.mur .mur-ov-ib__leg span { display: inline-flex; align-items: center; gap: 6px; }
.mur .mur-ov-ib__leg .mur-d { width: 8px; height: 8px; border-radius: 50%; }
.mur .mur-ov-ib__list { margin-top: 16px; display: grid; gap: 4px; }
.mur .mur-ov-ib__row { display: flex; align-items: center; gap: 12px; margin: 0 -8px; padding: 8px; border-radius: 14px; transition: background-color .15s; }
.mur .mur-ov-ib__row:hover { background: var(--well); }
.mur .mur-ov-ib__m { flex: 1; min-width: 0; display: grid; }
.mur .mur-ov-ib__m b { display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 600; line-height: 20.3px; }
.mur .mur-ov-ib__m > span { font-size: 13px; font-weight: 500; line-height: 18.85px; color: var(--muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mur .mur-unread { width: 6px; height: 6px; border-radius: 50%; background: var(--coral); }
.mur .mur-ov-ib__r { display: grid; justify-items: end; gap: 4px; }
.mur .mur-net--sm { width: 22px; height: 22px; }
.mur .mur-net--sm svg { width: 11px; height: 11px; }
.mur .mur-mood { height: 22px; display: inline-flex; align-items: center; gap: 6px; padding: 0 8px; border-radius: 999px; background: var(--well); font-style: normal; font-size: 12px; font-weight: 600; line-height: 17.4px; }
.mur .mur-mood::before { content: ''; width: 7px; height: 7px; border-radius: 50%; }
.mur .mur-mood--pos::before { background: var(--pine); }
.mur .mur-mood--neu::before { background: #6b7176; }
.mur .mur-mood--neg { background: #c43c301f; color: var(--bad); }
.mur .mur-mood--neg::before { background: var(--coral); }
.mur .mur-ov-feed { margin-top: 12px; }
.mur .mur-ov-feed li { display: flex; align-items: flex-start; gap: 12px; padding: 9px 0 10px; }
.mur .mur-ov-feed li + li { border-top: 1px solid var(--line); }
.mur .mur-ov-feed__m { flex: 1; min-width: 0; display: grid; gap: 4px; font-size: 14px; font-weight: 500; line-height: 19.6px; }
.mur .mur-ov-feed__m b { font-weight: 700; }
.mur .mur-ov-feed__m small { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 500; line-height: 17.5px; color: var(--muted); }
.mur .mur-ov-feed__m small svg { width: 13px; height: 13px; }

@container mur (max-width: 760px) {
  .mur .mur-head { height: auto; margin-bottom: 16px; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; }
  .mur .mur-head__title { grid-column: 1 / -1; max-width: none; font-size: 28px; line-height: 29.12px; letter-spacing: -.7px; }
  .mur .mur-stat__ico { display: none; }
  .mur .mur-stat__n { flex-wrap: wrap; gap: 4px 8px; }
  .mur .mur-stat__n b { font-size: 18px; line-height: 26.1px; letter-spacing: -.18px; }
  .mur .mur-stat__l { font-size: 12.5px; line-height: 16.25px; }
  .mur .mur-head__actions { grid-column: 1 / -1; margin-top: 4px; }
  .mur .mur-head__actions .mur-btn { width: 100%; }
  .mur .mur-ov-r--a, .mur .mur-ov-r--b, .mur .mur-ov-r--c { grid-template-columns: minmax(0, 1fr); }
  .mur .mur-card { padding: 16px; }
  .mur .mur-ov-hero { height: auto; grid-template-columns: minmax(0, 1fr); gap: 14px; padding: 12px; }
  .mur .mur-ov-hero__media { height: 163px; }
  .mur .mur-ov-hero__n { font-size: 34px; line-height: 34px; letter-spacing: -1.19px; }
  .mur .mur-ov-hero__f { margin-top: 10px; }
  .mur .mur-ov-hero__top { margin-top: -3px; }
  .mur .mur-ov-hero__k { margin-top: 14px; }
  .mur .mur-ov-hero__n { margin-top: 1px; }
  .mur .mur-ov-hero__p { margin-top: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .mur .mur-ov-after { grid-template-columns: minmax(0, 1fr); }
  .mur .mur-ov-after__item { height: 108px; display: grid; grid-template-columns: 50px minmax(0, 1fr); gap: 6px 12px; padding: 10px; align-items: start; }
  .mur .mur-ov-after__m b { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 15px; line-height: 19.5px; }
  .mur .mur-ov-after__r { grid-column: 2; flex-direction: row; align-items: center; }
  .mur .mur-ov-todo__m b { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 15px; line-height: 21.75px; }
  .mur .mur-ov-todo__m > span { white-space: normal; }
  .mur .mur-ov-todo__a .mur-btn { flex: 1; }
  .mur .mur-ov-growth__big { flex-wrap: wrap; }
  .mur .mur-ov-growth__big b { font-size: 32px; line-height: 46.4px; letter-spacing: -.96px; }
  .mur .mur-ov-growth__big { margin-top: 15px; }
  .mur .mur-ov-growth__leg { flex-wrap: wrap; gap: 8px 10px; margin-top: 8px; }
  .mur .mur-nets--leg { display: contents; }
  .mur .mur-chart { margin-top: 16px; margin-bottom: 26px; }
  .mur .mur-ov-topcard { height: 320px; }
  .mur .mur-ov-days { display: flex; margin-top: 18px; overflow-x: auto; scrollbar-width: none; margin-right: -16px; padding-right: 16px; -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 44px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 44px), transparent); }
  .mur .mur-ov-day { flex: none; width: 126px; height: 237px; }
  .mur .mur-slot { height: 32px; }
  .mur .mur-slot .mur-bdg { width: 26px; height: 26px; }
  .mur .mur-ov-feed__m { font-size: 15px; line-height: 21px; gap: 3px; }
  .mur .mur-ov-feed li { padding: 8px 0 9px; }
  .mur .mur-ov-ib__list { margin-top: 13px; gap: 2px; }
  .mur .mur-ov-net__m > span { font-size: 15px; line-height: 21.75px; }
}

/* ── lo de la adaptación (DESPUÉS de los @container de la copia: los pisa en el mismo ancho) ──────────── */
.mur .mur-dash { padding: 0 24px 40px; }
.mur .mur-quieta { opacity: .72; pointer-events: none; }
.mur .mur-vacio { flex: 1; min-height: 110px; display: grid; place-content: center; gap: 4px; margin-top: 14px; padding: 16px 12px; text-align: center; font-size: 13px; line-height: 19px; color: var(--muted); }
.mur .mur-vacio b { display: block; color: var(--text); font-weight: 600; }
.mur [role='button'] { cursor: pointer; }
.mur a.mur-btn, .mur a.mur-ibtn, .mur a.mur-ov-after__item, .mur a.mur-ov-day, .mur a.mur-ov-hero__media { text-decoration: none; }
.mur .mur-head { height: auto; min-height: 93px; row-gap: 2px; grid-template-columns: max-content 240px 240px minmax(0, 1fr) auto; column-gap: 24px; }
.mur .mur-head__frase { grid-column: 1 / -1; order: 1; padding-bottom: 8px; font-size: 15px; font-weight: 500; line-height: 21px; color: var(--muted); }
.mur .mur-head__title { max-width: none; white-space: nowrap; }
.mur .mur-head__frase b { font-weight: 700; color: var(--text); }
.mur .mur-stat__l small { display: block; color: var(--faint); }
.mur .mur-sin { color: var(--faint); }
.mur .mur-head .mur-stat { min-width: 0; }
.mur .mur-stat__l { white-space: normal; }
.mur .mur-head__actions { display: flex; gap: 10px; justify-content: flex-end; }
.mur .mur-ov-hero__f { justify-content: flex-end; }
.mur .mur-thumb--img { display: block; object-fit: cover; background: var(--well); }
.mur .mur-ov-topcard .mur-thumb--img { position: absolute; inset: 0; width: 100%; height: 100%; }
.mur .mur-ov-topcard { cursor: default; }
.mur .mur-ov-topcard[role='button'] { cursor: pointer; }
.mur .mur-net--ms { color: #6b46e5; } .mur .mur-net--wa { color: #128c4b; }
.mur .mur-s--g0, .mur .mur-d--g0 { background: var(--sea); }
.mur .mur-s--g1, .mur .mur-d--g1 { background: var(--butter); }
.mur .mur-s--g2, .mur .mur-d--g2, .mur .mur-s--g3, .mur .mur-d--g3 { background: #9aa0a4; }
.mur .mur-ov-net__r b.mur-cero { color: var(--muted); }
.mur .mur-ov-net__r { white-space: nowrap; }
.mur .mur-pie { display: flex; justify-content: flex-end; margin-top: 16px; }
.mur .mur-ov-netlist li[role='button'], .mur .mur-ov-feed li[role='button'] { margin: 0 -8px; padding-left: 8px; padding-right: 8px; border-radius: 14px; transition: background-color .15s; }
.mur .mur-ov-netlist li[role='button']:hover, .mur .mur-ov-feed li[role='button']:hover { background: var(--well); }
.mur .mur-ov-ib__tiles span[role='button'] { transition: background-color .15s; }
.mur .mur-ov-ib__tiles span[role='button']:hover { background: #fff; }
.mur .mur-ov-feed__mas { justify-content: center; }
.mur .mur-ov-week__nada { margin-top: 10px; font-size: 13px; line-height: 19px; color: var(--muted); }
.mur .mur-chart__x span { transform: translateX(-50%); }
.mur .mur-chart__x span:first-child { transform: none; }
.mur .mur-chart__x span:last-child { transform: translateX(-100%); }
.mur .mur-chart__x--tel { display: none; }
.mur .mur-ov-after__m b, .mur .mur-ov-todo__m b, .mur .mur-ov-ib__m b { overflow: hidden; text-overflow: ellipsis; }
.mur [data-lift] { transition: transform .5s cubic-bezier(.215, .61, .355, 1); }
.mur [data-lift]:hover { transform: translateY(-4px); transition-duration: .45s; }
@container mur (max-width: 1320px) {
  .mur .mur-head { grid-template-columns: repeat(3, minmax(0, 1fr)) auto; }
  .mur .mur-head__title { grid-column: 1 / -1; }
  .mur .mur-head__frase { order: 0; padding-bottom: 6px; }
  .mur .mur-head__actions { grid-column: auto; }
}
@container mur (max-width: 1000px) {
  .mur .mur-ov-r--c { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mur .mur-ov-team { grid-column: 1 / -1; }
  .mur .mur-ov-after { grid-template-columns: minmax(0, 1fr); }
  .mur .mur-chart__x--pc { display: none; }
  .mur .mur-chart__x--tel { display: block; }
}
@container mur (max-width: 760px) {
  .mur .mur-dash { padding: 0 14px 32px; }
  .mur .mur-head { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 12px; }
  .mur .mur-ov-r--c { grid-template-columns: minmax(0, 1fr); }
  .mur .mur-ov-team { grid-column: auto; }
  .mur .mur-head__actions { grid-column: 1 / -1; }
  .mur .mur-head__frase { order: 0; padding-bottom: 0; }
  .mur .mur-head__actions > * { flex: 1; }
  .mur .mur-pie { justify-content: stretch; }
  .mur .mur-head__title { white-space: normal; }
  .mur .mur-ov-todo__a .mur-btn { min-width: 0; padding-left: 8px; padding-right: 8px; }
  .mur .mur-pie > * { flex: 1; }
  .mur .mur-chart__x--pc { display: none; }
  .mur .mur-chart__x--tel { display: block; }
  .mur .mur-chart__x--tel span, .mur .mur-chart__x--tel span:first-child, .mur .mur-chart__x--tel span:last-child { transform: translateX(-50%); }
  .mur .mur-ov-days { scrollbar-width: thin; }
}
@media (prefers-reduced-motion: reduce) { .mur *, .mur *::before, .mur *::after { transition: none !important; animation: none !important; } }
`;
