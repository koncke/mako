// =============================================================================
// copiloto-css — la hoja de estilos del Marketing CoPilot nuevo (12/11/2026, vuelta 19 de la maqueta)
// =============================================================================
// Es el CSS de docs/marketing-copilot/rediseno/maqueta-diecinueve.html que usan las pantallas que pasaron a la app (los tres pasos,
// las cinco tarjetas, Oferta y comunicación y el piloto): lo saca la maqueta MIDIENDO qué reglas tocan algo en cada pantalla
// (scratchpad maqueta/sacar-css.mjs → css-a-ts.cjs), sin el marco de la maqueta (la página, la barra, el riel), que pone la app.
// El molde es el de la copia de Fernly (como app/dashboard/disenos/productividad-css.ts, todo dentro de `.frn`), en mono
// (`.frn--mono`, Martín 12/11: «para respetar el diseño de MaKo»). Las variables del modo oscuro van por data-tema en <html>.
// ⚠️ Se REGENERA desde la maqueta: un cambio de diseño se hace en la maqueta y se vuelve a sacar, no a mano acá.
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.
// =============================================================================

export const CSS_COPILOTO = `
@font-face { font-family: "Fernly Jakarta"; font-style: normal; font-weight: 200 800; font-display: swap; src: url("https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko40yyygA.woff2") format("woff2"); unicode-range: U+100-2BA, U+2BD-2C5, U+2C7-2CC, U+2CE-2D7, U+2DD-2FF, U+304, U+308, U+329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: "Fernly Jakarta"; font-style: normal; font-weight: 200 800; font-display: swap; src: url("https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yw.woff2") format("woff2"); unicode-range: U+0-FF, U+131, U+152-153, U+2BB-2BC, U+2C6, U+2DA, U+2DC, U+304, U+308, U+329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
.frn { container: frn / inline-size; --font: 'Fernly Jakarta', system-ui, -apple-system, 'Segoe UI', sans-serif; --page: #e9ebe9; --panel: #f5f6f5; --card: #fdfdfc; --hair: #e3e7e4; --ink: #131a15; --muted: #646d67; --faint: #6c756f; --g-950: #0d3a23; --g-800: #155a37; --g-700: #1d7347; --g-600: #27865a; --g-400: #5dbd8b; --g-100: #e3f2e9; --hatch: #8d9a92; --deep: color-mix(in srgb, #0d3a23 55%, #000); --swirl: color-mix(in srgb, #5dbd8b 22%, transparent); --amber: #98590a; --amber-bg: #fdf3e2; --rose: #c23b3b; --rose-bg: #fdeceb; --r-lg: 26px; --r-md: 20px; --gap: 16px; --shadow: 0 1px 2px #131a150a, 0 8px 24px -12px #131a151a; --ease: cubic-bezier(.22, 1, .36, 1); --focus: 0 0 0 3px var(--card), 0 0 0 5px var(--g-600); --shadow-tip: 0 4px 10px -6px #131a1533; --hero-a: #155a37; --hero-b: #0d3a23; --hero-c: #1d5a3a; --hero-ink: #f1f8f3; --hero-hover: #5dbd8b; --btn-a: #1d7347; --btn-ha: #27865a; --btn-b: #155a37; --btn2-a: #155a37; --btn2-ha: #1d7347; --btn2-b: #0d3a23; --btn-ink: #f2f8f4; --av-1: #f6c6c2; --av-2: #cdeccf; --av-3: #cfd6f7; --av-4: #f5dfb5; --av-fg: #131a15c7; position: relative; isolation: isolate; color: var(--ink); font: 400 14px/1.45 var(--font); -webkit-font-smoothing: antialiased; background: var(--page); }
.frn:where([data-tema="oscuro"] *) { --page: #0e100f; --panel: #151816; --card: #1c211e; --hair: #2b312d; --ink: #ededeb; --muted: #a9b0ab; --faint: #8e9691; --g-950: #2a8c5e; --g-800: #6fcf9f; --g-700: #4fbf86; --g-600: #5fcf96; --g-400: #8fe0b5; --g-100: #1f3a2c; --hatch: #5d6861; --amber: #e5ac45; --amber-bg: #3a2d12; --rose: #f08a8a; --rose-bg: #3d1f1f; --shadow: 0 1px 2px #0008, 0 8px 24px -12px #000c; --shadow-tip: 0 4px 10px -6px #000c; --av-1: #4a2a28; --av-2: #29432c; --av-3: #2a3258; --av-4: #4a3e1f; --av-fg: #ededebe0; }
.frn *, .frn ::before, .frn ::after { box-sizing: border-box; }
.frn button { font: inherit; color: inherit; cursor: pointer; }
.frn h1, .frn h2, .frn h3, .frn p, .frn ol, .frn ul { margin: 0px; }
.frn ol, .frn ul { padding: 0px; list-style: none; }
.frn svg.frn-i { width: 20px; height: 20px; flex: 0 0 auto; fill: none; stroke: currentcolor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.frn .frn-num { font-variant-numeric: tabular-nums; }
.frn :focus-visible { outline: none; box-shadow: var(--focus); }
.frn * { box-sizing: border-box; }
.frn .frn-board { padding: 22px 20px 16px; border-radius: var(--r-lg); background: var(--panel); }
.frn .frn-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.frn .frn-btn { height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 0px 22px; border-radius: 24px; border: 0px; font-size: 16px; font-weight: 500; line-height: 23.2px; white-space: nowrap; transition: background 0.2s, transform 0.2s; }
.frn .frn-btn--primary { min-width: 173px; background: linear-gradient(180deg, var(--btn-a), var(--btn-b)); color: var(--btn-ink); }
.frn .frn-btn--primary:hover { background: linear-gradient(180deg, var(--btn-ha), var(--btn-b)); }
.frn .frn-btn--ghost { min-width: 173px; background: transparent; box-shadow: inset 0 0 0 1.5px var(--ink); color: var(--ink); }
.frn .frn-btn--ghost:hover { background: var(--g-100); }
.frn .frn-btn svg { width: 19px; height: 19px; }
.frn .frn-stats { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, minmax(0px, 1fr)); gap: 16px; }
.frn .frn-card { position: relative; border-radius: var(--r-md); background: var(--card); box-shadow: var(--shadow); padding: 18px 20px; }
.frn .frn-card__t { font-size: 19px; font-weight: 500; line-height: 27.55px; letter-spacing: -0.38px; }
.frn .frn-stat { height: 158px; display: flex; flex-direction: column; }
.frn .frn-stat__t { font-size: 18px; font-weight: 500; line-height: 26.1px; letter-spacing: -0.27px; padding-right: 48px; }
.frn .frn-arrow { position: absolute; top: 18px; right: 20px; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; border: 1.5px solid var(--ink); color: var(--ink); background: transparent; transition: background-color .25s, color .25s, transform .35s var(--ease); }
.frn .frn-arrow:hover { background: var(--ink); color: var(--card); transform: rotate(45deg); }
.frn .frn-arrow svg { width: 15px; height: 15px; }
.frn .frn-stat__n { margin-top: 20px; font-size: 48px; font-weight: 600; line-height: 48px; letter-spacing: -1.92px; }
.frn .frn-stat__s { margin-top: auto; display: flex; align-items: center; gap: 9px; font-size: 13.5px; line-height: 19.575px; color: var(--muted); }
.frn .frn-stat--hero { color: var(--hero-ink); background: linear-gradient(150deg, var(--hero-a) 0%, var(--hero-b) 62%, var(--hero-c) 100%); box-shadow: rgba(13, 58, 35, 0.7) 0px 14px 30px -16px; overflow: hidden; }
.frn .frn-stat--hero::after { content: ""; position: absolute; inset: 0px; background: radial-gradient(120% 90% at 100% 0%, rgba(93, 189, 139, 0.133), transparent 60%); pointer-events: none; }
.frn .frn-stat--hero .frn-stat__s { color: rgb(185, 230, 203); }
.frn .frn-stat--hero .frn-arrow { border-color: transparent; background: rgb(227, 242, 233); color: var(--hero-b); }
.frn .frn-stat--hero .frn-arrow:hover { background: var(--hero-hover); }
.frn .frn-rem { display: flex; flex-direction: column; }
.frn .frn-rem__h { margin-top: 15px; font-size: 24px; font-weight: 600; line-height: 27.6px; letter-spacing: -0.6px; color: var(--g-800); }
.frn .frn-rem .frn-btn { margin-top: auto; width: 100%; background: linear-gradient(180deg, var(--btn2-a), var(--btn2-b)); color: var(--btn-ink); }
.frn .frn-rem .frn-btn:hover { background: linear-gradient(180deg, var(--btn2-ha), var(--btn2-b)); }
.frn .frn-card__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.frn .frn-chip { height: 35px; display: inline-flex; align-items: center; gap: 7px; padding: 0px 14px; border-radius: 18px; border: 1.5px solid var(--ink); background: transparent; font-size: 14px; font-weight: 500; line-height: 20.3px; transition: background-color 0.2s; }
.frn .frn-chip:hover { background: var(--g-100); }
.frn .frn-progress { display: flex; flex-direction: column; }
.frn .frn-gauge { position: relative; width: 250px; height: 149px; margin: 47.5px auto 0px; }
.frn .frn-gauge svg { display: block; width: 250px; height: 149px; overflow: visible; }
.frn .frn-gauge__c { position: absolute; left: 0px; right: 0px; bottom: -2px; text-align: center; }
.frn .frn-gauge__c b { display: block; font-size: 54px; font-weight: 600; line-height: 54px; letter-spacing: -2.7px; }
.frn .frn-gauge__c span { display: block; margin-top: 2px; font-size: 14px; line-height: 20.3px; color: var(--muted); }
@container frn (max-width: 700px) {
.frn .frn-board { margin-top: 0px; padding: 22px 12px 12px; }
.frn .frn-head { flex-direction: column; gap: 0px; padding: 0px 4px; }
.frn .frn-stats { order: 0; grid-template-columns: repeat(2, minmax(0px, 1fr)); gap: 12px; }
.frn .frn-reminder, .frn .frn-rem { order: 2; }
.frn .frn-progress { order: 5; }
.frn .frn-stat { height: 177px; padding: 16px; }
.frn .frn-stat__t { font-size: 14.5px; line-height: 21.025px; letter-spacing: -0.2175px; padding-right: 38px; }
.frn .frn-arrow { top: 16px; right: 16px; width: 30px; height: 30px; }
.frn .frn-arrow svg { width: 13px; height: 13px; }
.frn .frn-stat__n { margin-top: auto; font-size: 42px; line-height: 42px; letter-spacing: -1.68px; }
.frn .frn-stat__s { margin-top: 10px; font-size: 11.5px; line-height: 16.675px; align-items: flex-start; }
.frn .frn-card { padding: 20px; }
.frn .frn-rem { height: 224px; }
.frn .frn-rem__h { margin-top: 26px; font-size: 20px; line-height: 23px; letter-spacing: -0.5px; }
.frn .frn-rem .frn-btn { height: 54px; margin-bottom: 1px; }
.frn .frn-chip { white-space: nowrap; flex: 0 0 auto; }
.frn .frn-gauge { width: 277px; height: 165px; margin-top: 17.5px; }
.frn .frn-gauge svg { width: 277px; height: 165px; }
.frn .frn-gauge__c { bottom: 0px; }
.frn .frn-gauge__c b { font-size: 40px; line-height: 40px; letter-spacing: -2px; }
.frn .frn-gauge__c span { font-size: 13.5px; line-height: 19.575px; }
}
.frn { padding: 12px; }
.frn .frn-btn, .frn .frn-chip, .frn .frn-arrow { text-decoration: none; }
.frn .frn-chip { flex: 0 0 auto; white-space: nowrap; }
.frn [role="button"] { cursor: pointer; }
.frn .frn-rem > * { flex-shrink: 0; }
.frn .frn-rem__h { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
@container frn (max-width: 700px) {
.frn { padding: 10px; }
.frn .frn-rem { height: auto; min-height: 224px; }
}
@media (prefers-reduced-motion: reduce) {
.frn *, .frn ::before, .frn ::after { transition: none !important; animation: auto ease 0s 1 normal none running none !important; }
}
.mq-completo { flex: 1 1 0%; min-width: 0px; min-height: 0px; display: flex; }
.mq-completo > .co-panel { flex: 1 1 0%; }
.mq-logo { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; }
.mq-logo svg { display: block; }
.co-el__md p { margin: 0px 0px 6px; }
.co-el__md p:last-child { margin: 0px; }
.co-preg__punto[aria-current="step"] { background: var(--ink); }
.co-preg__pie { display: flex; justify-content: flex-end; padding: 4px 4px 2px; }
.co-preg__pie[hidden] { display: none; }
.mq-vista { animation: 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) 0s 1 normal both running mqEntra; display: flex; flex-direction: column; gap: 16px; }
@keyframes mqEntra {
0% { opacity: 0; transform: translateY(8px); }
100% { opacity: 1; transform: none; }
}
.mq-solo { flex: 1 1 0%; min-width: 0px; min-height: 0px; overflow-y: auto; background: var(--bg); }
.mq-abierto { padding: 2px 14px 16px; display: flex; flex-direction: column; gap: 10px; animation: 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) 0s 1 normal both running mqEntra; }
.mq-abierto p { margin: 0px; font-size: 14.5px; line-height: 1.55; color: var(--ink); }
.mq-acciones { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
@keyframes gdgRecLatido {
0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 45%, transparent); }
100% { box-shadow: 0 0 0 10px color-mix(in srgb, var(--primary) 0%, transparent); }
}
@keyframes gdgRecEntra {
0% { opacity: 0; transform: translateY(3px); }
100% { opacity: 1; transform: none; }
}
.mq-modal-fondo { position: fixed; inset: 0px; z-index: 70; background: color-mix(in srgb, var(--sidebar) 55%, transparent); display: grid; place-items: center; padding: 16px; animation: 0.2s ease 0s 1 normal both running mqEntra; }
.mq-offer { flex: 1 1 0%; min-width: 0px; display: flex; flex-direction: column; }
.mq-offer > .co-panel { flex: 1 1 0%; min-height: 0px; }
.mq-solo > .frn { padding: 16px; box-sizing: border-box; min-height: 100%; }
.frn .frn-board { max-width: 1240px; margin: 0px auto; }
.frn .frn-head { margin-bottom: 4px; }
.frn .frn-stats--n { grid-template-columns: repeat(var(--n), minmax(0, 1fr)); margin-bottom: 16px; }
.frn .frn-stats--n .frn-stat { cursor: pointer; }
.frn .frn-stat__t .mq-logo { vertical-align: -5px; margin-right: 4px; display: inline-flex; }
.frn .frn-de { font-size: 0.45em; font-weight: 500; letter-spacing: 0px; }
.frn .frn-pila { display: flex; flex-direction: column; gap: 16px; min-width: 0px; }
.frn .frn-card { height: auto; }
.frn .frn-btn--ancho { width: 100%; justify-content: center; }
.frn .frn-btn svg, .frn .frn-chip svg { flex: 0 0 auto; }
.frn .frn-dos { display: grid; grid-template-columns: minmax(0px, 1.55fr) minmax(0px, 1fr); gap: 16px; align-items: stretch; }
.frn .frn-col { display: flex; flex-direction: column; gap: 16px; min-width: 0px; }
.frn .frn-col > :last-child { flex: 1 1 auto; }
.frn .frn-dos > * { align-self: stretch; height: auto; }
.frn .frn-dos > section { display: flex; flex-direction: column; }
.frn .frn-dos > section > .mq-notas--frn { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: space-between; }
.frn .mk-btn { height: 36px; padding: 0px 16px; border-radius: 18px; font-size: 14px; font-weight: 600; border: 0px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.frn .mk-btn--primary { background: linear-gradient(180deg, var(--btn-a, #1d7347), var(--btn-b, #0d3a23)); color: rgb(255, 255, 255); }
.frn .mk-btn--secondary { background: var(--card); color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink); }
.frn .mq-notas--frn { background: none; border: 0px; padding: 4px 0px 0px; }
.frn .mq-notas--frn .of-fila { font-size: 15.5px; padding: 14px 6px; }
.frn .mq-notas--frn .of-fila__label { font-size: 15.5px; font-weight: 500; }
.frn .frn-nota { display: flex; flex-direction: column; gap: 6px; }
.frn .frn-nota .frn-gauge { margin: 8px auto 0px; }
.frn .frn-nota__flojo { text-align: center; color: var(--muted); font-size: 14.5px; margin: 0px 0px 10px; }
.frn .frn-nota__flojo b { color: var(--ink); font-weight: 600; }
.frn .frn-datos { margin: 12px 0px 0px; display: flex; flex-direction: column; gap: 14px; }
.frn .frn-datos dt { font-size: 13px; color: var(--muted); }
.frn .frn-datos dd { margin: 3px 0px 0px; font-size: 16px; line-height: 1.4; color: var(--ink); }
.frn .frn-pill { display: inline-flex; align-items: center; height: 24px; padding: 0px 9px; border-radius: 7px; font-size: 12.5px; font-weight: 600; white-space: nowrap; box-shadow: currentcolor 0px 0px 0px 1px inset; }
.frn .frn-pill--ok { color: var(--g-700); background: var(--g-100); }
.frn .frn-pill--run { color: var(--amber); background: var(--amber-bg); }
.frn .frn-pill--wait { color: var(--rose); background: var(--rose-bg); }
.frn .frn-pill--sin { color: var(--muted); background: var(--panel); }
.frn .wa { margin-top: 12px; }
.frn .frn-rem--ancho { margin-top: 16px; flex-direction: row; align-items: center; justify-content: space-between; gap: 16px; min-height: 0px; padding: 22px 24px; }
.frn .frn-rem--ancho .frn-rem__h { font-size: 28px; margin: 0px; }
.frn .frn-rem--ancho .frn-btn { width: auto; min-width: 240px; height: 54px; margin: 0px; justify-content: center; }
@container frn (max-width: 700px) {
.frn .frn-stats--n { grid-template-columns: repeat(2, minmax(0px, 1fr)); }
.frn .frn-dos, .frn .frn-analista, .frn .frn-analista--chico, .frn .frn-op { grid-template-columns: minmax(0px, 1fr); }
.frn .frn-rem--ancho { flex-direction: column; align-items: stretch; }
.frn .frn-rem--ancho .frn-btn { width: 100%; }
}
.frn.frn--mono { --font: 'Urbanist', system-ui, sans-serif; --page: #efefed; --panel: #f5f5f3; --card: #fcfcfb; --hair: #11111117; --ink: #121212; --muted: #4f4f4c; --faint: #636360; --g-950: #121212; --g-800: #2b2b2b; --g-700: #3a3a38; --g-600: #4f4f4c; --g-400: #8e8e89; --g-100: #ececea; --hero-a: #2b2b2b; --hero-b: #121212; --hero-c: #1f1f1f; --hero-ink: #f6f6f4; --hero-hover: #8e8e89; --btn-a: #2b2b2b; --btn-ha: #3a3a38; --btn-b: #121212; --btn2-a: #2b2b2b; --btn2-ha: #3a3a38; --btn2-b: #121212; --deep: #121212; --swirl: #ffffff14; }
.frn--mono .frn-stat--hero { box-shadow: rgba(0, 0, 0, 0.667) 0px 14px 30px -16px; }
.frn--mono .frn-stat--hero::after { background: none; }
.frn--mono .frn-stat--hero .frn-stat__s { color: rgb(200, 200, 195); }
.frn--mono .frn-pill--ok { color: rgb(34, 115, 92); background: rgb(213, 238, 228); }
.frn--mono .frn-stat--hero .frn-arrow { background: rgb(236, 236, 234); color: rgb(18, 18, 18); }
.frn .frn-embebido { padding: 16px; display: flex; flex-direction: column; gap: 12px; min-width: 0px; }
.frn .frn-embebido .mq-offer { height: 640px; border-radius: var(--r-md); box-shadow: inset 0 0 0 1px var(--hair); overflow: hidden; }
.frn--mono .frn-stat { height: 128px; padding: 16px 18px; }
.frn--mono .frn-stat__t { font-size: 15.5px; line-height: 22px; }
.frn--mono .frn-stat__n { margin-top: 12px; font-size: 36px; line-height: 38px; letter-spacing: -1.3px; }
.frn--mono .frn-card__t { font-size: 17px; line-height: 24px; }
.frn--mono .frn-btn { height: 42px; font-size: 15px; padding: 0px 18px; }
.frn .frn-head--fija { min-height: 52px; align-items: center; }
.frn .frn-btn--chico { height: 34px; padding: 0px 14px; font-size: 14px; }
.frn .frn-ta-lista { display: flex; flex-direction: column; margin-top: 8px; }
.frn .frn-ta { display: grid; grid-template-columns: 24px minmax(0px, 1fr) auto 92px; align-items: center; gap: 14px; padding: 12px 4px; border-top: 1px solid var(--hair); }
@container tareas (max-width: 760px) {
.frn .frn-ta { grid-template-columns: 24px minmax(0px, 1fr) 84px; row-gap: 6px; }
.frn .frn-ta__check { grid-row: 1 / span 2; align-self: center; }
}
.frn .frn-ta__check { width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid var(--muted); background: transparent; display: grid; place-items: center; color: var(--card); padding: 0px; }
.frn .frn-ta__txt { display: flex; flex-direction: column; gap: 2px; min-width: 0px; }
.frn .frn-ta__txt b { font-size: 15px; font-weight: 600; }
.frn .frn-ta__txt span { font-size: 13.5px; color: var(--muted); }
.frn .frn-decs, .frn .frn-evs, .frn .frn-reglas { display: flex; flex-direction: column; margin-top: 10px; }
.frn .frn-dec:first-child, .frn .frn-ev:first-child, .frn .frn-regla:first-child { border-top: 0px; }
.frn .frn-ev { display: grid; grid-template-columns: auto minmax(0px, 1fr) auto; align-items: start; gap: 12px; padding: 12px 0px; border-top: 1px solid var(--hair); }
.frn .frn-ev__h { font-size: 12.5px; color: var(--muted); }
.frn .frn-ev p { font-size: 14px; line-height: 1.45; margin-top: 2px; }
.frn .frn-seg { display: inline-flex; padding: 3px; border-radius: 999px; background: var(--panel); box-shadow: inset 0 0 0 1px var(--hair); }
.frn .frn-seg button { height: 30px; padding: 0px 12px; border: 0px; border-radius: 999px; background: transparent; font-size: 13px; color: var(--muted); white-space: nowrap; }
.frn .frn-seg button[aria-pressed="true"] { background: var(--ink); color: var(--card); }
.frn .frn-aviso { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0px 7px; margin-left: 10px; border-radius: 999px; background: rgb(229, 72, 77); color: rgb(255, 255, 255); font-size: 12.5px; font-weight: 700; letter-spacing: 0px; line-height: 1; vertical-align: 3px; }
.frn .frn-chk { container: tareas / inline-size; }
.frn .frn-chk .frn-ta { grid-template-columns: 24px minmax(0px, 1fr) 84px 176px; }
.frn .frn-chk__grupo { display: flex; align-items: center; gap: 10px; padding: 20px 4px 8px; }
.frn .frn-chk__grupo:first-child { padding-top: 6px; }
.frn .frn-chk__grupo b { font-size: 15px; }
.frn .frn-chk__grupo span { margin-left: auto; font-size: 13px; color: var(--muted); }
.frn .frn-tpl { display: inline-flex; align-self: flex-start; margin-top: 4px; padding: 2px 8px; border-radius: 6px; background: var(--panel); font-size: 12px; color: var(--muted); box-shadow: inset 0 0 0 1px var(--hair); }
.frn .frn-ta__dia { font-size: 13px; color: var(--muted); white-space: nowrap; }
.frn .frn-ta__dia--hoy { color: rgb(229, 72, 77); font-weight: 700; }
.frn .frn-trabajo { display: grid; grid-template-columns: minmax(0px, 1.75fr) minmax(300px, 1fr); gap: 16px; align-items: start; }
.frn .frn-trabajo .frn-embebido .mq-offer { height: 680px; }
.frn .frn-desp { position: relative; }
.frn .frn-desp__btn { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0px 14px; border-radius: 12px; border: 1px solid var(--hair); background: var(--card); font: inherit; color: var(--ink); cursor: pointer; }
.frn .frn-desp__btn span { color: var(--muted); font-size: 13px; }
.frn .frn-desp__btn b { font-size: 15px; }
.frn .frn-desp__menu { position: absolute; z-index: 30; top: calc(100% + 6px); left: 0px; min-width: 260px; padding: 6px; border-radius: 14px; background: var(--card); box-shadow: 0 18px 40px -16px #0006, 0 0 0 1px var(--hair); display: flex; flex-direction: column; }
.frn .frn-desp__menu button { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border: 0px; border-radius: 10px; background: transparent; font: inherit; color: var(--ink); text-align: left; cursor: pointer; }
.frn .frn-desp__menu button:hover, .frn .frn-desp__menu button[aria-selected="true"] { background: var(--panel); }
.frn .frn-desp__menu button span { color: var(--muted); font-size: 12.5px; }
.frn .frn-desp__menu button:last-child { justify-content: flex-start; margin-top: 4px; border-top: 1px solid var(--hair); border-radius: 0px 0px 10px 10px; }
.frn .frn-subtabs { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
@container frn (max-width: 900px) {
.frn .frn-trabajo { grid-template-columns: minmax(0px, 1fr); }
}
@container tareas (max-width: 760px) {
.frn .frn-chk .frn-ta { grid-template-columns: 24px minmax(0px, 1fr) auto; }
.frn .frn-chk .frn-ta__dia { grid-area: 2 / 2; }
}
.frn .frn-chk__grupo { justify-content: flex-start; text-align: left; width: 100%; }
.frn .frn-marca { display: flex; align-items: center; gap: 12px; }
@keyframes mq-hoja-entra {
0% { transform: translateX(40px); opacity: 0; }
100% { transform: none; opacity: 1; }
}
.frn .frn-chk .frn-ta { grid-template-columns: 24px minmax(0px, 1fr) 84px 112px; }
.frn .frn-chk__grupo > span:not(:last-child) { margin-left: 0px; font-size: inherit; color: inherit; }
@container frn (max-width: 700px) {
.frn .frn-ta { grid-template-columns: auto minmax(0px, 1fr) auto; row-gap: 6px; }
.frn--mono .frn-stat { height: 118px; }
}
@container frn (max-width: 700px) {
.frn .frn-stats--n > .frn-stat:last-child:nth-child(2n+1) { grid-column: 1 / -1; }
.frn .frn-embebido .mq-offer { height: 560px; }
}
@media (prefers-reduced-motion: reduce) {
.mq-vista, .mq-nuevo { animation: auto ease 0s 1 normal none running none; }
}
.frn .frn-head__btns { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; }
.frn .frn-head__btns .frn-btn { margin-top: 0px; }
.frn .frn-selfila { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.frn .frn-desp__sub { color: var(--muted); font-size: 12.5px; font-weight: 500; }
.frn .frn-subtabs { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.frn .frn-subtabs__aire { flex: 1 1 auto; }
@keyframes mqHvBarra {
0% { transform: scaleX(0); }
100% { transform: scaleX(1); }
}
.frn .frn-vacio-chat { margin-top: 12px; }
.frn .frn-vacio-chat__item { display: flex; align-items: center; gap: 10px; padding: 12px; border-bottom: 1px solid var(--hair); }
.frn .frn-vacio-chat__item > i { width: 40px; height: 40px; border-radius: 50%; background: var(--panel); flex: 0 0 auto; }
.frn .frn-vacio-chat__item span { flex: 1 1 0%; display: flex; flex-direction: column; gap: 6px; }
.frn .frn-vacio-chat__item b, .frn .frn-vacio-chat__item small { display: block; height: 9px; border-radius: 5px; background: var(--panel); }
.frn .frn-vacio-chat__item small { height: 7px; opacity: 0.7; }
.frn .frn-vacio-chat__hilo { display: grid; place-items: center; min-height: 380px; }
.frn .frn-vacio-chat__centro { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; max-width: 380px; padding: 24px; border-radius: 18px; background: var(--card); box-shadow: rgba(0, 0, 0, 0.35) 0px 12px 40px -18px; }
.frn .frn-vacio-chat__logos { display: flex; gap: 8px; }
.frn .frn-vacio-chat__centro b { font-size: 18px; }
.frn .frn-vacio-chat__centro p { margin: 0px; color: var(--muted); font-size: 14px; }
.frn .frn-vacio-chat__btns { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 6px; }
.frn .frn-ta.frn-ta--d { grid-template-columns: 24px minmax(0px, 1fr) auto; gap: 14px; }
.frn .frn-ta--d .frn-ta__abrir { color-scheme: unset; forced-color-adjust: unset; math-depth: unset; position: unset; position-anchor: unset; text-size-adjust: unset; appearance: unset; color: unset; font: unset; font-palette: unset; font-synthesis: unset; position-area: unset; text-orientation: unset; text-rendering: unset; text-spacing-trim: unset; -webkit-font-smoothing: unset; -webkit-locale: unset; -webkit-text-orientation: unset; -webkit-writing-mode: unset; writing-mode: unset; zoom: unset; accent-color: unset; place-content: unset; place-items: unset; place-self: unset; alignment-baseline: unset; anchor-name: unset; anchor-scope: unset; animation-composition: unset; animation: unset; animation-trigger: unset; app-region: unset; aspect-ratio: unset; backdrop-filter: unset; backface-visibility: unset; background: unset; background-blend-mode: unset; baseline-shift: unset; baseline-source: unset; block-size: unset; border-block: unset; border: unset; border-collapse: unset; border-end-end-radius: unset; border-end-start-radius: unset; border-inline: unset; border-shape: unset; border-start-end-radius: unset; border-start-start-radius: unset; inset: unset; box-decoration-break: unset; box-shadow: unset; box-sizing: unset; break-after: unset; break-before: unset; break-inside: unset; buffered-rendering: unset; caption-side: unset; caret-animation: unset; caret-color: unset; caret-shape: unset; clear: unset; clip: unset; clip-path: unset; clip-rule: unset; color-interpolation: unset; color-interpolation-filters: unset; color-rendering: unset; columns: unset; column-fill: unset; rule-break: unset; rule: unset; rule-inset: unset; rule-visibility-items: unset; column-span: unset; contain: unset; contain-intrinsic-block-size: unset; contain-intrinsic-size: unset; contain-intrinsic-inline-size: unset; container: unset; content: unset; content-visibility: unset; corner-shape: unset; corner-block-end-shape: unset; corner-block-start-shape: unset; counter-increment: unset; counter-reset: unset; counter-set: unset; cx: unset; cy: unset; d: unset; dominant-baseline: unset; dynamic-range-limit: unset; empty-cells: unset; field-sizing: unset; fill: unset; fill-opacity: unset; fill-rule: unset; filter: unset; flex: unset; flex-line-count: unset; flex-wrap: unset; float: unset; flood-color: unset; flood-opacity: unset; frame-sizing: unset; grid: unset; grid-area: unset; height: unset; hyphenate-character: unset; hyphenate-limit-chars: unset; hyphens: unset; image-orientation: unset; image-rendering: unset; initial-letter: unset; inline-size: unset; inset-block: unset; inset-inline: unset; interactivity: unset; interest-delay: unset; interpolate-size: unset; isolation: unset; letter-spacing: unset; lighting-color: unset; line-break: unset; list-style: unset; margin-block: unset; margin: unset; margin-inline: unset; margin-trim: unset; marker: unset; mask: unset; mask-type: unset; math-shift: unset; math-style: unset; max-block-size: unset; max-height: unset; max-inline-size: unset; max-width: unset; min-block-size: unset; min-height: unset; min-inline-size: unset; mix-blend-mode: unset; object-fit: unset; object-position: unset; object-view-box: unset; offset: unset; opacity: unset; order: unset; orphans: unset; outline: unset; outline-offset: unset; overflow-anchor: unset; overflow-block: unset; overflow-clip-margin: unset; overflow-inline: unset; overflow-wrap: unset; overflow: unset; overlay: unset; overscroll-behavior-block: unset; overscroll-behavior-inline: unset; overscroll-behavior: unset; padding-block: unset; padding: unset; padding-inline: unset; page: unset; page-margin-safety: unset; page-orientation: unset; paint-order: unset; perspective: unset; perspective-origin: unset; pointer-events: unset; position-try: unset; position-visibility: unset; print-color-adjust: unset; quotes: unset; r: unset; reading-flow: unset; reading-order: unset; resize: unset; rotate: unset; ruby-align: unset; ruby-overhang: unset; ruby-position: unset; rule-overlap: unset; rx: unset; ry: unset; scale: unset; scroll-axis-lock: unset; scroll-behavior: unset; scroll-initial-target: unset; scroll-margin-block: unset; scroll-margin: unset; scroll-margin-inline: unset; scroll-marker-group: unset; scroll-padding-block: unset; scroll-padding: unset; scroll-padding-inline: unset; scroll-snap-align: unset; scroll-snap-stop: unset; scroll-snap-type: unset; scroll-target-group: unset; scroll-timeline: unset; scrollbar-color: unset; scrollbar-gutter: unset; scrollbar-width: unset; shape-image-threshold: unset; shape-margin: unset; shape-outside: unset; shape-rendering: unset; size: unset; speak: unset; stop-color: unset; stop-opacity: unset; stroke: unset; stroke-dasharray: unset; stroke-dashoffset: unset; stroke-linecap: unset; stroke-linejoin: unset; stroke-miterlimit: unset; stroke-opacity: unset; stroke-width: unset; tab-size: unset; table-layout: unset; text-align: unset; text-align-last: unset; text-anchor: unset; text-autospace: unset; text-box: unset; text-combine-upright: unset; text-decoration: unset; text-decoration-inset: unset; text-decoration-skip-ink: unset; text-emphasis: unset; text-emphasis-position: unset; text-fit: unset; text-indent: unset; text-justify: unset; text-overflow: unset; text-shadow: unset; text-transform: unset; text-underline-offset: unset; text-underline-position: unset; text-wrap: unset; timeline-scope: unset; timeline-trigger: unset; touch-action: unset; transform: unset; transform-box: unset; transform-origin: unset; transform-style: unset; transition: unset; translate: unset; trigger-scope: unset; user-select: unset; vector-effect: unset; vertical-align: unset; view-timeline: unset; view-transition-class: unset; view-transition-group: unset; view-transition-name: unset; view-transition-scope: unset; visibility: unset; border-spacing: unset; -webkit-box-align: unset; -webkit-box-decoration-break: unset; -webkit-box-direction: unset; -webkit-box-flex: unset; -webkit-box-ordinal-group: unset; -webkit-box-orient: unset; -webkit-box-pack: unset; -webkit-box-reflect: unset; -webkit-line-break: unset; -webkit-line-clamp: unset; -webkit-mask-box-image: unset; -webkit-rtl-ordering: unset; -webkit-ruby-position: unset; -webkit-tap-highlight-color: unset; -webkit-text-combine: unset; -webkit-text-decorations-in-effect: unset; -webkit-text-fill-color: unset; -webkit-text-security: unset; -webkit-text-stroke: unset; -webkit-user-drag: unset; white-space-collapse: unset; widows: unset; width: unset; will-change: unset; window-drag: unset; word-break: unset; word-spacing: unset; x: unset; y: unset; z-index: unset; display: flex; flex-direction: column; gap: 2px; min-width: 0px; cursor: pointer; border-radius: 6px; }
.frn .frn-ta--d .frn-ta__abrir:hover b { text-decoration: underline 1px; text-underline-offset: 3px; }
.frn .frn-ta--d .frn-ta__abrir:focus-visible { outline: 2px solid var(--g-600); outline-offset: 3px; }
.frn .frn-ta--d .frn-ta__txt b { font-size: 15px; font-weight: 600; }
.frn .frn-ta--d .frn-ta__txt .frn-tpl { font-size: 13px; color: var(--muted); }
.frn .frn-ta__der { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.frn .frn-ta__der .frn-ta__dia { min-width: 64px; text-align: right; margin-right: 6px; }
.frn .frn-ta__dia2 { display: none; }
.frn .frn-ta__fuera { width: 34px; height: 34px; border-radius: 10px; border: 0px; background: transparent; color: var(--muted); display: grid; place-items: center; cursor: pointer; padding: 0px; }
.frn .frn-ta__fuera:hover { background: var(--rose-bg); color: var(--rose); }
.frn .frn-ta__hazlo { width: 92px; min-width: 0px; padding: 0px 10px; justify-content: center; }
@container tareas (max-width: 620px) {
.frn .frn-ta__der .frn-ta__dia { display: none; }
.frn .frn-ta__dia2 { display: block; margin-top: 2px; }
.frn .frn-ta__hazlo, .frn .frn-ta__hueco { width: auto; }
}
.frn .frn-ev--mako { grid-template-columns: 32px minmax(0px, 1fr) auto; }
.frn .frn-ev__mako { width: 32px; height: 32px; display: grid; place-items: center; }
.frn .frn-ev__dato { display: inline-flex; margin-top: 6px; padding: 3px 9px; border-radius: 999px; background: var(--panel); box-shadow: inset 0 0 0 1px var(--hair); font-size: 12.5px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
:is(.mq-igm, .mq-hv, .mq-ytm, .mq-tarjeta, .mq-clases) .frn-pill { display: inline-flex; align-items: center; height: 22px; padding: 0px 8px; border-radius: 7px; font-size: 12px; font-weight: 600; white-space: nowrap; box-shadow: currentcolor 0px 0px 0px 1px inset; vertical-align: middle; font-family: inherit; line-height: 1; }
:is(.mq-igm, .mq-hv, .mq-ytm, .mq-tarjeta, .mq-clases) .frn-pill--ok { color: rgb(34, 115, 92); background: rgb(213, 238, 228); }
:is(.mq-igm, .mq-hv, .mq-ytm, .mq-tarjeta, .mq-clases) .frn-pill--run { color: rgb(152, 89, 10); background: rgb(253, 243, 226); }
:is(.mq-igm, .mq-hv, .mq-ytm, .mq-tarjeta, .mq-clases) .frn-pill--wait { color: rgb(194, 59, 59); background: rgb(253, 236, 235); }
:is(.mq-igm, .mq-hv, .mq-ytm, .mq-tarjeta, .mq-clases) .frn-pill--sin { color: rgb(100, 109, 103); background: rgb(241, 243, 241); }
.frn .frn-chk__head { min-height: 44px; }
@media (max-width: 640px) {
.frn .frn-head__btns .frn-btn { padding: 0px 12px; }
}
.frn .adl-grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px; margin-top: 14px; }
.frn .adl { --adl-bg: #fff; --adl-line: #dadde1; --adl-t: #1c1e21; --adl-g: #65676b; --adl-btn: #e4e6eb; --adl-btn-h: #d8dadf; --adl-cta: #f0f2f5; background: var(--adl-bg); border: 1px solid var(--adl-line); border-radius: 8px; color: var(--adl-t); font: 400 14px / 1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; cursor: pointer; display: flex; flex-direction: column; overflow: hidden; min-width: 0px; transition: box-shadow 0.15s; }
.frn .adl:hover { box-shadow: rgba(0, 0, 0, 0.12) 0px 2px 12px; }
.frn .adl:focus-visible { outline: rgb(8, 102, 255) solid 2px; outline-offset: 2px; }
.adl__estado { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 14px; }
.adl__estado i { width: 10px; height: 10px; border-radius: 50%; background: rgb(101, 103, 107); }
.adl__estado[data-activo="true"] i { background: rgb(49, 162, 76); }
.adl__plat { display: flex; align-items: center; gap: 6px; }
.adl__plat svg { display: block; }
.adl__ad { border-top: 1px solid var(--adl-line); padding-top: 12px; display: flex; flex-direction: column; gap: 10px; min-width: 0px; }
.adl__quien { display: flex; gap: 8px; align-items: center; padding: 0px 12px; }
.adl__quien div { display: flex; flex-direction: column; }
.adl__quien b { font-size: 14px; font-weight: 600; }
.adl__quien small { font-size: 12px; color: var(--adl-g); }
.adl__av { width: 36px; height: 36px; border-radius: 50%; overflow: hidden; display: block; flex: 0 0 auto; }
.adl__av img { width: 100%; height: 100%; object-fit: cover; display: block; }
.adl__txt { margin: 0px; padding: 0px 12px; font-size: 14px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.adl__media { aspect-ratio: 1 / 1; background: rgb(0, 0, 0); overflow: hidden; }
.adl__media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.adl__cta { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--adl-cta); margin-top: -10px; }
.adl__cta div { flex: 1 1 0%; min-width: 0px; display: flex; flex-direction: column; }
.adl__cta small { font-size: 12px; color: var(--adl-g); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.adl__cta b { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.adl__cta span { flex: 0 0 auto; height: 36px; padding: 0px 12px; border-radius: 6px; background: var(--adl-btn); display: inline-flex; align-items: center; font-weight: 600; font-size: 14px; }
.adl__mako { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--adl-line); font-size: 13px; }
.adl__n { width: 22px; height: 22px; border-radius: 50%; background: var(--adl-t); color: var(--adl-bg); display: grid; place-items: center; font-size: 12px; font-weight: 700; flex: 0 0 auto; }
.adl__num { flex: 1 1 0%; min-width: 0px; color: var(--adl-g); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.adl__num b { color: var(--adl-t); font-weight: 700; }
.frn .frn-trabajo--oferta { align-items: stretch; }
.frn .frn-decs2 { list-style: none; margin: 12px 0px 0px; padding: 0px; display: flex; flex-direction: column; gap: 10px; }
.frn .frn-dec2 { display: grid; grid-template-columns: auto minmax(0px, 1fr) auto auto; gap: 18px; align-items: center; padding: 14px 16px; border-radius: var(--r-md); background: var(--panel); box-shadow: inset 0 0 0 1px var(--hair); }
.frn .frn-dec2:not(:has(.frn-dec2__img)) { grid-template-columns: minmax(0px, 1fr) auto auto; }
.frn .frn-dec2__img { width: 60px; height: 60px; border-radius: 12px; object-fit: cover; display: block; }
.frn .frn-dec2__txt { min-width: 0px; display: flex; flex-direction: column; gap: 4px; }
.frn .frn-dec2__txt b { font-size: 15.5px; font-weight: 600; }
.frn .frn-dec2__txt p { margin: 0px; font-size: 14px; line-height: 1.45; color: var(--muted); }
.frn .frn-dec2__topes { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); }
.frn .frn-dec2__num { display: flex; align-items: baseline; gap: 6px; white-space: nowrap; }
.frn .frn-dec2__num s { color: var(--muted); font-size: 15px; }
.frn .frn-dec2__num > span { color: var(--muted); }
.frn .frn-dec2__num b { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.frn .frn-dec2__num small { font-size: 13px; color: var(--muted); }
.frn .frn-dec2__num em { font-style: normal; font-size: 12.5px; font-weight: 600; padding: 2px 7px; border-radius: 6px; background: var(--g-100); color: var(--g-700); }
.frn .frn-dec2__acc { display: flex; gap: 6px; justify-content: flex-end; }
.frn .frn-ver-mas { margin-top: 12px; }
@container frn (max-width: 820px) {
.frn .frn-dec2, .frn .frn-dec2:not(:has(.frn-dec2__img)) { grid-template-columns: minmax(0px, 1fr); gap: 10px; }
.frn .frn-dec2__img { width: 100%; height: 140px; }
.frn .frn-dec2__acc { justify-content: flex-start; }
.frn .frn-dec2__acc .frn-btn { flex: 1 1 0px; min-width: 0px; }
}
.frn, .frn.frn--mono { padding: 0px !important; }
.frn .frn-board { max-width: none; margin: 0px; border-radius: 0px; min-height: 100%; padding: 18px 28px 96px; }
.frn .frn-head2 { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; min-height: 52px; margin-bottom: 18px; }
.frn .frn-head2 .frn-head__btns { margin-left: auto; }
.frn .frn-tresp { display: inline-flex; align-items: center; gap: 4px; padding: 4px; border-radius: 999px; background: var(--card); box-shadow: inset 0 0 0 1px var(--hair); }
.frn .frn-tresp__b { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0px 16px 0px 6px; border: 0px; border-radius: 999px; background: transparent; color: var(--muted); font: 600 14.5px/1 var(--font); cursor: pointer; white-space: nowrap; transition: background 0.15s, color 0.15s; }
.frn .frn-tresp__b:hover { color: var(--ink); background: var(--panel); }
.frn .frn-tresp__b[aria-current="step"] { background: var(--ink); color: var(--card); }
.frn .frn-tresp__n { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; background: var(--panel); color: var(--ink); }
.frn .frn-tresp__b[aria-current="step"] .frn-tresp__n { background: color-mix(in srgb, var(--card) 18%, transparent); color: var(--card); }
.frn .frn-tresp__b .frn-aviso { margin-left: 2px; }
.frn .frn-mas { position: relative; }
.frn .frn-mas__btn { width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--hair); background: var(--card); color: var(--ink); display: grid; place-items: center; cursor: pointer; }
.frn .frn-mas__btn:hover, .frn .frn-mas__btn[aria-expanded="true"] { background: var(--panel); }
.frn .frn-mas__menu { position: absolute; right: 0px; top: calc(100% + 6px); z-index: 40; min-width: 220px; padding: 6px; border-radius: 14px; background: var(--card); box-shadow: 0 18px 40px -16px #0006, 0 0 0 1px var(--hair); display: flex; flex-direction: column; }
.frn .frn-mas__menu button { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 0px; border-radius: 10px; background: transparent; color: var(--ink); font: 500 14px/1 var(--font); text-align: left; cursor: pointer; }
.frn .frn-mas__menu button:hover { background: var(--panel); }
@keyframes mqChatEntra {
0% { transform: translateX(24px); opacity: 0; }
100% { transform: none; opacity: 1; }
}
.frn .adl--corta .adl__top { display: flex; align-items: center; gap: 8px; padding: 10px 12px; font-size: 13px; }
.frn .adl--corta .adl__top .adl__estado { font-size: 13.5px; }
.frn .adl--corta .adl__desde { color: var(--adl-g); flex: 1 1 0%; min-width: 0px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.frn .adl--corta .adl__plat svg { width: 15px; height: 15px; }
.frn .adl--corta .adl__ad { padding-top: 10px; gap: 8px; }
.frn .adl--corta .adl__av { width: 30px; height: 30px; }
.frn .adl--corta .adl__txt { -webkit-line-clamp: 2; font-size: 13.5px; }
.frn .adl--corta .adl__media { aspect-ratio: 16 / 10; }
.frn .adl--corta .adl__cta { padding: 8px 12px; margin-top: -8px; }
.frn .adl--corta .adl__cta b { font-size: 14px; }
.frn .adl--corta .adl__cta span { height: 32px; font-size: 13px; }
.frn .adl--corta .adl__mako { padding: 8px 12px; }
@media (max-width: 900px) {
.frn .frn-board { padding: 14px 12px 96px; }
.frn .frn-head2 { gap: 10px; }
.frn .frn-tresp { order: 3; width: 100%; overflow-x: auto; }
.frn .frn-tresp__b { flex: 0 0 auto; }
}
.frn .frn-marca--sola { display: inline-grid; place-items: center; width: 44px; height: 44px; flex: 0 0 auto; }
.frn .oc-fila { justify-content: flex-start; }
.frn .oc-seg button { height: 34px; padding: 0px 18px; font-size: 14px; }
.frn--mono .frn-stats--n .frn-stat { height: auto; min-height: 128px; }
.frn .frn-stats--n .frn-arrow { top: 15px; right: 14px; width: 32px; height: 32px; }
.frn .frn-stats--n .frn-arrow svg { width: 13px; height: 13px; }
.frn--mono .frn-stats--n .frn-stat__t { font-size: 15px; padding-right: 34px; letter-spacing: -0.2px; }
@container frn (max-width: 700px) {
.frn--mono .frn-stats--n .frn-stat { min-height: 118px; }
}
.frn .frn-trabajo--oferta { height: 740px; grid-template-rows: minmax(0px, 1fr); }
.frn .frn-trabajo--oferta > .frn-embebido { min-height: 0px; }
.frn .frn-trabajo--oferta .frn-embebido .mq-offer { height: auto; flex: 1 1 auto; min-height: 0px; }
.frn .frn-trabajo--oferta > .oc { min-height: 0px; }
.frn .oc { padding: 18px 20px 0px; display: flex; flex-direction: column; gap: 14px; min-width: 0px; overflow: hidden; }
.frn .oc > .oc-seg { align-self: flex-start; flex: 0 0 auto; max-width: 100%; overflow-x: auto; scrollbar-width: none; }
.frn .oc > .oc-seg::-webkit-scrollbar { display: none; }
.frn .oc-cuerpo { flex: 1 1 auto; min-height: 0px; overflow-y: auto; margin: 0px -12px; padding: 0px 12px 18px; scrollbar-width: thin; }
@container frn (max-width: 900px) {
.frn .frn-trabajo--oferta { height: auto; grid-template-rows: none; }
.frn .frn-trabajo--oferta .frn-embebido .mq-offer { height: 560px; flex: 0 0 auto; }
.frn .frn-trabajo--oferta > .oc { height: 640px; }
}
.frn .oc-grupos { list-style: none; margin: 0px; padding: 0px; display: flex; flex-direction: column; }
.frn .oc-g + .oc-g { border-top: 1px solid var(--hair); }
.frn .oc-g__cab { color-scheme: unset; forced-color-adjust: unset; math-depth: unset; position: unset; position-anchor: unset; text-size-adjust: unset; appearance: unset; color: unset; font: unset; font-palette: unset; font-synthesis: unset; position-area: unset; text-orientation: unset; text-rendering: unset; text-spacing-trim: unset; -webkit-font-smoothing: unset; -webkit-locale: unset; -webkit-text-orientation: unset; -webkit-writing-mode: unset; writing-mode: unset; zoom: unset; accent-color: unset; place-content: unset; place-self: unset; alignment-baseline: unset; anchor-name: unset; anchor-scope: unset; animation-composition: unset; animation: unset; animation-trigger: unset; app-region: unset; aspect-ratio: unset; backdrop-filter: unset; backface-visibility: unset; background: unset; background-blend-mode: unset; baseline-shift: unset; baseline-source: unset; block-size: unset; border-block: unset; border: unset; border-radius: unset; border-collapse: unset; border-end-end-radius: unset; border-end-start-radius: unset; border-inline: unset; border-shape: unset; border-start-end-radius: unset; border-start-start-radius: unset; inset: unset; box-decoration-break: unset; box-shadow: unset; break-after: unset; break-before: unset; break-inside: unset; buffered-rendering: unset; caption-side: unset; caret-animation: unset; caret-color: unset; caret-shape: unset; clear: unset; clip: unset; clip-path: unset; clip-rule: unset; color-interpolation: unset; color-interpolation-filters: unset; color-rendering: unset; columns: unset; column-fill: unset; rule-break: unset; rule: unset; rule-inset: unset; rule-visibility-items: unset; column-span: unset; contain: unset; contain-intrinsic-block-size: unset; contain-intrinsic-size: unset; contain-intrinsic-inline-size: unset; container: unset; content: unset; content-visibility: unset; corner-shape: unset; corner-block-end-shape: unset; corner-block-start-shape: unset; counter-increment: unset; counter-reset: unset; counter-set: unset; cx: unset; cy: unset; d: unset; dominant-baseline: unset; dynamic-range-limit: unset; empty-cells: unset; field-sizing: unset; fill: unset; fill-opacity: unset; fill-rule: unset; filter: unset; flex: unset; flex-flow: unset; flex-line-count: unset; float: unset; flood-color: unset; flood-opacity: unset; frame-sizing: unset; grid-auto-columns: unset; grid-auto-flow: unset; grid-auto-rows: unset; grid-area: unset; grid-template-areas: unset; grid-template-rows: unset; height: unset; hyphenate-character: unset; hyphenate-limit-chars: unset; hyphens: unset; image-orientation: unset; image-rendering: unset; initial-letter: unset; inline-size: unset; inset-block: unset; inset-inline: unset; interactivity: unset; interest-delay: unset; interpolate-size: unset; isolation: unset; justify-items: unset; letter-spacing: unset; lighting-color: unset; line-break: unset; list-style: unset; margin-block: unset; margin: unset; margin-inline: unset; margin-trim: unset; marker: unset; mask: unset; mask-type: unset; math-shift: unset; math-style: unset; max-block-size: unset; max-height: unset; max-inline-size: unset; max-width: unset; min-block-size: unset; min-height: unset; min-inline-size: unset; min-width: unset; mix-blend-mode: unset; object-fit: unset; object-position: unset; object-view-box: unset; offset: unset; opacity: unset; order: unset; orphans: unset; outline: unset; outline-offset: unset; overflow-anchor: unset; overflow-block: unset; overflow-clip-margin: unset; overflow-inline: unset; overflow-wrap: unset; overflow: unset; overlay: unset; overscroll-behavior-block: unset; overscroll-behavior-inline: unset; overscroll-behavior: unset; padding-block: unset; padding-inline: unset; page: unset; page-margin-safety: unset; page-orientation: unset; paint-order: unset; perspective: unset; perspective-origin: unset; pointer-events: unset; position-try: unset; position-visibility: unset; print-color-adjust: unset; quotes: unset; r: unset; reading-flow: unset; reading-order: unset; resize: unset; rotate: unset; ruby-align: unset; ruby-overhang: unset; ruby-position: unset; rule-overlap: unset; rx: unset; ry: unset; scale: unset; scroll-axis-lock: unset; scroll-behavior: unset; scroll-initial-target: unset; scroll-margin-block: unset; scroll-margin: unset; scroll-margin-inline: unset; scroll-marker-group: unset; scroll-padding-block: unset; scroll-padding: unset; scroll-padding-inline: unset; scroll-snap-align: unset; scroll-snap-stop: unset; scroll-snap-type: unset; scroll-target-group: unset; scroll-timeline: unset; scrollbar-color: unset; scrollbar-gutter: unset; scrollbar-width: unset; shape-image-threshold: unset; shape-margin: unset; shape-outside: unset; shape-rendering: unset; size: unset; speak: unset; stop-color: unset; stop-opacity: unset; stroke: unset; stroke-dasharray: unset; stroke-dashoffset: unset; stroke-linecap: unset; stroke-linejoin: unset; stroke-miterlimit: unset; stroke-opacity: unset; stroke-width: unset; tab-size: unset; table-layout: unset; text-align: unset; text-align-last: unset; text-anchor: unset; text-autospace: unset; text-box: unset; text-combine-upright: unset; text-decoration: unset; text-decoration-inset: unset; text-decoration-skip-ink: unset; text-emphasis: unset; text-emphasis-position: unset; text-fit: unset; text-indent: unset; text-justify: unset; text-overflow: unset; text-shadow: unset; text-transform: unset; text-underline-offset: unset; text-underline-position: unset; text-wrap: unset; timeline-scope: unset; timeline-trigger: unset; touch-action: unset; transform: unset; transform-box: unset; transform-origin: unset; transform-style: unset; transition: unset; translate: unset; trigger-scope: unset; user-select: unset; vector-effect: unset; vertical-align: unset; view-timeline: unset; view-transition-class: unset; view-transition-group: unset; view-transition-name: unset; view-transition-scope: unset; visibility: unset; border-spacing: unset; -webkit-box-align: unset; -webkit-box-decoration-break: unset; -webkit-box-direction: unset; -webkit-box-flex: unset; -webkit-box-ordinal-group: unset; -webkit-box-orient: unset; -webkit-box-pack: unset; -webkit-box-reflect: unset; -webkit-line-break: unset; -webkit-line-clamp: unset; -webkit-mask-box-image: unset; -webkit-rtl-ordering: unset; -webkit-ruby-position: unset; -webkit-tap-highlight-color: unset; -webkit-text-combine: unset; -webkit-text-decorations-in-effect: unset; -webkit-text-fill-color: unset; -webkit-text-security: unset; -webkit-text-stroke: unset; -webkit-user-drag: unset; white-space-collapse: unset; widows: unset; will-change: unset; window-drag: unset; word-break: unset; word-spacing: unset; x: unset; y: unset; z-index: unset; box-sizing: border-box; width: 100%; display: grid; grid-template-columns: minmax(0px, 1fr) auto 18px; align-items: center; gap: 12px; padding: 15px 2px; cursor: pointer; }
.frn .oc-g__cab:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; border-radius: 8px; }
.frn .oc-g__t { font-size: 16.5px; font-weight: 600; color: var(--ink); }
.frn .oc-g__e { display: inline-flex; align-items: center; gap: 6px; font-size: 14.5px; font-weight: 600; text-align: right; }
.frn .oc-g__e[data-e="falta"] { color: var(--bad); }
.frn .oc-g__e[data-e="confirmar"] { color: var(--warn); }
.frn .oc-g__cab > svg:last-child { width: 18px; height: 18px; color: var(--faint); transition: transform 0.2s; }
.frn .oc-g--abierto .oc-g__cab > svg:last-child { transform: rotate(180deg); }
.frn .oci-lista { list-style: none; margin: 0px; padding: 0px; display: flex; flex-direction: column; gap: 8px; }
.frn .oci { display: grid; grid-template-columns: 24px minmax(0px, 1fr) auto; align-items: start; gap: 12px; padding: 13px 14px; border-radius: 14px; background: var(--card); box-shadow: inset 0 0 0 1px var(--hair); }
.frn .oci[data-e="vacia"] { background: color-mix(in srgb, var(--bad) 5%, var(--card)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bad) 32%, transparent); }
.frn .oci__check { width: 24px; height: 24px; margin-top: 1px; padding: 0px; border-radius: 50%; border: 1.5px solid var(--muted); background: transparent; display: grid; place-items: center; color: rgb(255, 255, 255); cursor: pointer; transition: background-color 0.15s, border-color 0.15s; }
.frn .oci__check:hover { border-color: var(--ink); }
.frn .oci[data-e="vacia"] .oci__check { border-color: var(--bad); }
.frn .oci[data-e="negocio"] .oci__check { border-color: var(--warn); }
.frn .oci[data-e="confirmada"] .oci__check { background: var(--good); border-color: var(--good); }
.frn .oci__check svg { width: 13px; height: 13px; }
.frn .oci__cuerpo { color-scheme: unset; forced-color-adjust: unset; math-depth: unset; position: unset; position-anchor: unset; text-size-adjust: unset; appearance: unset; color: unset; font: unset; font-palette: unset; font-synthesis: unset; position-area: unset; text-orientation: unset; text-rendering: unset; text-spacing-trim: unset; -webkit-font-smoothing: unset; -webkit-locale: unset; -webkit-text-orientation: unset; -webkit-writing-mode: unset; writing-mode: unset; zoom: unset; accent-color: unset; place-content: unset; place-self: unset; alignment-baseline: unset; anchor-name: unset; anchor-scope: unset; animation-composition: unset; animation: unset; animation-trigger: unset; app-region: unset; aspect-ratio: unset; backdrop-filter: unset; backface-visibility: unset; background: unset; background-blend-mode: unset; baseline-shift: unset; baseline-source: unset; block-size: unset; border-block: unset; border: unset; border-radius: unset; border-collapse: unset; border-end-end-radius: unset; border-end-start-radius: unset; border-inline: unset; border-shape: unset; border-start-end-radius: unset; border-start-start-radius: unset; inset: unset; box-decoration-break: unset; box-shadow: unset; break-after: unset; break-before: unset; break-inside: unset; buffered-rendering: unset; caption-side: unset; caret-animation: unset; caret-color: unset; caret-shape: unset; clear: unset; clip: unset; clip-path: unset; clip-rule: unset; color-interpolation: unset; color-interpolation-filters: unset; color-rendering: unset; columns: unset; column-fill: unset; rule-break: unset; rule: unset; rule-inset: unset; rule-visibility-items: unset; column-span: unset; contain: unset; contain-intrinsic-block-size: unset; contain-intrinsic-size: unset; contain-intrinsic-inline-size: unset; container: unset; content: unset; content-visibility: unset; corner-shape: unset; corner-block-end-shape: unset; corner-block-start-shape: unset; counter-increment: unset; counter-reset: unset; counter-set: unset; cx: unset; cy: unset; d: unset; dominant-baseline: unset; dynamic-range-limit: unset; empty-cells: unset; field-sizing: unset; fill: unset; fill-opacity: unset; fill-rule: unset; filter: unset; flex: unset; flex-line-count: unset; flex-wrap: unset; float: unset; flood-color: unset; flood-opacity: unset; frame-sizing: unset; grid: unset; grid-area: unset; height: unset; hyphenate-character: unset; hyphenate-limit-chars: unset; hyphens: unset; image-orientation: unset; image-rendering: unset; initial-letter: unset; inline-size: unset; inset-block: unset; inset-inline: unset; interactivity: unset; interest-delay: unset; interpolate-size: unset; isolation: unset; justify-items: unset; letter-spacing: unset; lighting-color: unset; line-break: unset; list-style: unset; margin-block: unset; margin: unset; margin-inline: unset; margin-trim: unset; marker: unset; mask: unset; mask-type: unset; math-shift: unset; math-style: unset; max-block-size: unset; max-height: unset; max-inline-size: unset; max-width: unset; min-block-size: unset; min-height: unset; min-inline-size: unset; mix-blend-mode: unset; object-fit: unset; object-position: unset; object-view-box: unset; offset: unset; opacity: unset; order: unset; orphans: unset; outline: unset; outline-offset: unset; overflow-anchor: unset; overflow-block: unset; overflow-clip-margin: unset; overflow-inline: unset; overflow-wrap: unset; overflow: unset; overlay: unset; overscroll-behavior-block: unset; overscroll-behavior-inline: unset; overscroll-behavior: unset; padding-block: unset; padding: unset; padding-inline: unset; page: unset; page-margin-safety: unset; page-orientation: unset; paint-order: unset; perspective: unset; perspective-origin: unset; pointer-events: unset; position-try: unset; position-visibility: unset; print-color-adjust: unset; quotes: unset; r: unset; reading-flow: unset; reading-order: unset; resize: unset; rotate: unset; ruby-align: unset; ruby-overhang: unset; ruby-position: unset; rule-overlap: unset; rx: unset; ry: unset; scale: unset; scroll-axis-lock: unset; scroll-behavior: unset; scroll-initial-target: unset; scroll-margin-block: unset; scroll-margin: unset; scroll-margin-inline: unset; scroll-marker-group: unset; scroll-padding-block: unset; scroll-padding: unset; scroll-padding-inline: unset; scroll-snap-align: unset; scroll-snap-stop: unset; scroll-snap-type: unset; scroll-target-group: unset; scroll-timeline: unset; scrollbar-color: unset; scrollbar-gutter: unset; scrollbar-width: unset; shape-image-threshold: unset; shape-margin: unset; shape-outside: unset; shape-rendering: unset; size: unset; speak: unset; stop-color: unset; stop-opacity: unset; stroke: unset; stroke-dasharray: unset; stroke-dashoffset: unset; stroke-linecap: unset; stroke-linejoin: unset; stroke-miterlimit: unset; stroke-opacity: unset; stroke-width: unset; tab-size: unset; table-layout: unset; text-align: unset; text-align-last: unset; text-anchor: unset; text-autospace: unset; text-box: unset; text-combine-upright: unset; text-decoration: unset; text-decoration-inset: unset; text-decoration-skip-ink: unset; text-emphasis: unset; text-emphasis-position: unset; text-fit: unset; text-indent: unset; text-justify: unset; text-overflow: unset; text-shadow: unset; text-transform: unset; text-underline-offset: unset; text-underline-position: unset; text-wrap: unset; timeline-scope: unset; timeline-trigger: unset; touch-action: unset; transform: unset; transform-box: unset; transform-origin: unset; transform-style: unset; transition: unset; translate: unset; trigger-scope: unset; user-select: unset; vector-effect: unset; vertical-align: unset; view-timeline: unset; view-transition-class: unset; view-transition-group: unset; view-transition-name: unset; view-transition-scope: unset; visibility: unset; border-spacing: unset; -webkit-box-align: unset; -webkit-box-decoration-break: unset; -webkit-box-direction: unset; -webkit-box-flex: unset; -webkit-box-ordinal-group: unset; -webkit-box-orient: unset; -webkit-box-pack: unset; -webkit-box-reflect: unset; -webkit-line-break: unset; -webkit-line-clamp: unset; -webkit-mask-box-image: unset; -webkit-rtl-ordering: unset; -webkit-ruby-position: unset; -webkit-tap-highlight-color: unset; -webkit-text-combine: unset; -webkit-text-decorations-in-effect: unset; -webkit-text-fill-color: unset; -webkit-text-security: unset; -webkit-text-stroke: unset; -webkit-user-drag: unset; white-space-collapse: unset; widows: unset; width: unset; will-change: unset; window-drag: unset; word-break: unset; word-spacing: unset; x: unset; y: unset; z-index: unset; box-sizing: border-box; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0px; cursor: pointer; }
.frn .oci__cuerpo:focus-visible { outline: 2px solid var(--ink); outline-offset: 4px; border-radius: 6px; }
.frn .oci__cuerpo:hover .oci__t { text-decoration: underline; text-underline-offset: 3px; }
.frn .oci__t { font-size: 15.5px; font-weight: 600; color: var(--ink); }
.frn .oci__x { font-size: 14.5px; line-height: 1.45; color: var(--ink); }
.frn .oci__ref { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; margin-top: 4px; padding: 5px 10px; border-radius: 10px; background: var(--panel); box-shadow: inset 0 0 0 1px var(--hair); font-size: 13px; line-height: 1.35; color: var(--muted); }
.frn .oci__ref svg { width: 14px; height: 14px; flex: 0 0 auto; }
.frn .oci__est, .ocm__est { display: inline-flex; align-items: center; height: 26px; padding: 0px 11px; border-radius: 999px; font-size: 13px; font-weight: 700; white-space: nowrap; }
.frn .oci__est[data-e="vacia"], .ocm__est[data-e="vacia"] { color: var(--bad); background: var(--bad-bg); }
.frn .oci__est[data-e="negocio"], .ocm__est[data-e="negocio"] { color: var(--warn); background: var(--warn-bg); }
.frn .oci__est[data-e="confirmada"], .ocm__est[data-e="confirmada"] { color: var(--good); background: var(--good-bg); }
@container frn (max-width: 700px) {
.frn .oc { padding: 16px 14px 0px; }
.frn .oci { grid-template-columns: 24px minmax(0px, 1fr); }
.frn .oci__est { grid-area: 2 / 2; justify-self: start; }
.frn .oc-fila { flex-wrap: wrap; }
.frn .oc-fila .oc-seg { width: 100%; }
.frn .oc-fila .oc-seg button { flex: 1 0 auto; }
}
.frn .oc-dos { min-height: 660px; }
.ocm { width: min(520px, 100%); max-height: calc(-32px + 100vh); overflow: auto; display: flex; flex-direction: column; gap: 18px; padding: 22px 24px 20px; border-radius: 20px; background: var(--surface); color: var(--ink); box-shadow: rgba(0, 0, 0, 0.14) 0px 24px 38px 3px, rgba(0, 0, 0, 0.12) 0px 9px 46px 8px, rgba(0, 0, 0, 0.2) 0px 11px 15px -7px; animation: 0.18s ease 0s 1 normal both running mqEntra; }
.ocm__cab { display: grid; grid-template-columns: minmax(0px, 1fr) auto 36px; align-items: center; gap: 12px; }
.ocm__cab h2 { margin: 0px; font-size: 24px; line-height: 1.2; font-weight: 700; letter-spacing: -0.02em; text-wrap: balance; }
.ocm__x { width: 36px; height: 36px; border-radius: 50%; border: 0px; background: var(--surface-2); color: var(--dim); font-size: 20px; line-height: 1; cursor: pointer; }
.ocm__sec h3 { margin: 0px 0px 8px; font-size: 15px; font-weight: 700; }
.ocm__sec > p { margin: 0px; font-size: 15.5px; line-height: 1.5; color: var(--dim); }
.ocm__sabe { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 14px; background: var(--surface-2); }
.ocm__sabe[data-e="vacia"] { background: var(--bad-bg); }
.ocm__valor { margin: 0px; font-size: 18px; line-height: 1.35; font-weight: 600; color: var(--ink); }
.ocm__sabe[data-e="vacia"] .ocm__valor { color: var(--bad); }
.ocm__nota { margin: 0px; font-size: 14.5px; line-height: 1.45; color: var(--dim); }
.ocm__ref { display: flex; align-items: center; gap: 8px; padding-top: 10px; border-top: 1px solid var(--border-strong); font-size: 14px; line-height: 1.4; color: var(--dim); }
.ocm__ref svg { width: 16px; height: 16px; }
.ocm__ver { margin-left: auto; height: 30px; padding: 0px 14px; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink); font-family: inherit; cursor: pointer; }
.ocm__pie { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 16px; border-top: 1px solid var(--border-strong); }
.ocm__marca { display: inline-flex; align-items: center; gap: 10px; height: 42px; padding: 0px 14px 0px 8px; border-radius: 999px; border: 0px; background: transparent; color: var(--ink); font-family: inherit; cursor: pointer; }
.ocm__marca:hover { background: var(--surface-2); }
.ocm__circ { width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid var(--dim); display: grid; place-items: center; color: rgb(255, 255, 255); }
.ocm__circ[data-listo="true"] { background: var(--good); border-color: var(--good); }
.ocm__circ svg { width: 13px; height: 13px; }
.ocm__ir { height: 42px; padding: 0px 20px; border-radius: 999px; border: 0px; background: var(--ink); color: var(--surface); font-family: inherit; cursor: pointer; }
@media (max-width: 520px) {
.ocm { padding: 18px 16px 16px; }
.ocm__pie { flex-direction: column-reverse; align-items: stretch; }
.ocm__ir { width: 100%; }
}
.frn .oc-grupos { gap: 10px; }
.frn .oc-g + .oc-g { border-top: 0px; }
.frn .oc-g { border-radius: 16px; background: var(--card); box-shadow: inset 0 0 0 1px var(--hair); overflow: hidden; transition: box-shadow 0.15s; }
.frn .oc-g:hover { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 22%, transparent); }
.frn .oc-g--abierto, .frn .oc-g--abierto:hover { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--ink) 30%, transparent); }
.frn .oc-g__cab { padding: 15px 16px; }
.frn .oc-g--abierto .oc-g__cab { background: var(--panel); box-shadow: inset 0 -1px 0 var(--hair); }
.frn .oc-g .oci-lista { gap: 0px; padding: 0px; }
.frn .oc-g .oci { border-radius: 0px; background: transparent; box-shadow: none; padding: 14px 16px; align-items: center; }
.frn .oc-g .oci + .oci { box-shadow: inset 0 1px 0 var(--hair); }
.frn .oc-g .oci[data-e="vacia"] { background: color-mix(in srgb, var(--bad) 6%, transparent); box-shadow: inset 3px 0 0 var(--bad); }
.frn .oc-g .oci[data-e="vacia"] + .oci { box-shadow: inset 0 1px 0 var(--hair); }
.frn .oc-g .oci[data-e="vacia"] + .oci[data-e="vacia"] { box-shadow: inset 3px 0 0 var(--bad), inset 0 1px 0 var(--hair); }
.frn .oc-g .oci + .oci[data-e="vacia"] { box-shadow: inset 3px 0 0 var(--bad), inset 0 1px 0 var(--hair); }
.frn .oc-g .oci[data-e="vacia"] .oci__t { color: var(--ink); }
.frn .oci__x { margin-top: 1px; }
@container frn (max-width: 700px) {
.frn .oc-g__cab { padding: 14px; }
.frn .oc-g .oci { padding: 13px 14px; align-items: start; }
}
.frn .oc-g, .frn .oc-g:hover, .frn .oc-g--abierto, .frn .oc-g--abierto:hover { box-shadow: none; }
.frn .oc-g { border: 1px solid var(--hair); }
.frn .oc-g:hover { border-color: color-mix(in srgb, var(--ink) 22%, transparent); }
.frn .oc-g--abierto, .frn .oc-g--abierto:hover { border-color: color-mix(in srgb, var(--ink) 34%, transparent); }
.frn .oc-g__cab { grid-template-columns: auto minmax(0px, 1fr) 18px; }
.frn .oc-g__t { white-space: nowrap; }
.frn .oc-g__e { justify-content: flex-end; min-width: 0px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.frn .oc-g .oci { align-items: start; }
.frn .oc-g .oci__est { margin-top: -1px; }
.frn .oc-g__corto { display: none; }
@container frn (max-width: 700px) {
.frn .oc-g__largo { display: none; }
.frn .oc-g__corto { display: inline; }
}
`;
