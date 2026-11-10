// =============================================================================
// velocidad-css — la hoja de estilos de «Velocidad de llamada» con su diseño propio (la copia de Tend, «Today»)
// =============================================================================
// GENERADA por docs/diseno/mockups-dashboard/velocidad-tend/armar-css.py desde la hoja de la copia (tend.css) y lo de la adaptación
// (adaptacion.css): todo adentro de .vt, cada clase con el prefijo vt-, sin el armazón de Tend (la barra de la izquierda, la de arriba
// y la del teléfono), los resets por etiqueta con :where() y con @container en lugar de @media. No se edita a mano: se cambia la copia
// y se vuelve a correr el armador. Escrita desde lo MEDIDO del demo: nada del código de la tienda.
// Paleta doble: claro por defecto y oscuro bajo [data-tema="oscuro"] de <html> (§36 de hallazgos-templates-dashboard.md).
// ⚠️ En un template literal no va ningún backtick ni un «dólar con llave».
// =============================================================================

export const CSS_VELOCIDAD = `
@font-face { font-family: 'Tend Geist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwSGFWfOw.woff2) format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'Tend Geist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwcGFU.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
.vt { --font: 'Tend Geist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --bg: #eef2ef; --glow-a: #d7efe4; --glow-b: #e6eef6;
  --surface: #fbfcfb; --surface-2: #f4f7f5; --raised: #fff; --well: #10231f0e; --line: #10231f16; --line-2: #10231f29;
  --shadow: 0 1px 2px #10231f0a, 0 14px 34px -22px #10231f38; --shadow-pop: 0 24px 60px -18px #10231f4d, 0 2px 6px #10231f14;
  --text: #10231f; --muted: #586a65; --faint: #8a9994;
  --primary: #0d5c55; --on-primary: #f1fbf7;
  --side: #0f2d29; --on-side: #dcebe7; --side-dim: #dcebe79e; --side-pill: #c4ecd9; --on-side-pill: #0b2925;
  --teal: #138a7e; --mint: #4fbf93; --sky: #4c94dc; --lilac: #8b72d8; --apricot: #e9953f; --coral: #de5539; --sand: #b79a55;
  --ink: #10231f; --good: #1d8656; --warn: #b8700f; --bad: #cf4429; --wa: #1fa855; --on-wa: #fff; --tick: #2b9fe0;
  --soft: 15%;
  --r-card: 22px; --r-tile: 16px; --r-ctl: 999px; --gap: 16px; --side-w: 248px; --gutter: clamp(16px, 1.8vw, 30px);
  --ease: cubic-bezier(.2, .8, .2, 1); }
.vt:where([data-tema="oscuro"] *) { --bg: #0b1414; --glow-a: #0f2622; --glow-b: #101c24;
  --surface: #121d1c; --surface-2: #172423; --raised: #1b2a28; --well: #ffffff0e; --line: #ffffff14; --line-2: #ffffff26;
  --shadow: 0 1px 2px #0000002e, 0 14px 34px -22px #00000099; --shadow-pop: 0 24px 60px -18px #000000b3, 0 2px 6px #00000052;
  --text: #e5efec; --muted: #9db0aa; --faint: #6f817b;
  --primary: #5cd0b4; --on-primary: #06201c;
  --teal: #3cc0ad; --mint: #6fd3a6; --sky: #74b3f0; --lilac: #a996ee; --apricot: #f2aa5f; --coral: #f07a5f; --sand: #d0b878;
  --ink: #e5efec; --good: #4cc488; --warn: #e0a34a; --bad: #f07a5f; --wa: #3fd17a; --on-wa: #052812; }
.vt, .vt * { box-sizing: border-box; }
.vt { font: 500 14px/20.3px var(--font); color: var(--text); -webkit-font-smoothing: antialiased;
  background: radial-gradient(900px 520px at 100% 0, var(--glow-b), transparent 70%), radial-gradient(760px 520px at 18% 0, var(--glow-a), transparent 72%), var(--bg);
  background-attachment: fixed; }
.vt :where(button) { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; padding: 0; }
.vt :where(a) { color: inherit; text-decoration: none; }
.vt :where(h1), .vt :where(h2), .vt :where(h3), .vt :where(p), .vt :where(ul) { margin: 0; }
.vt :where(ul) { padding: 0; list-style: none; }
.vt svg.vt-i { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.vt :focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.vt .vt-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 42px; padding: 0 18px; border-radius: var(--r-ctl); font: 650 13.5px/19.575px var(--font); white-space: nowrap; transition: background-color .15s; }
.vt .vt-btn--primary { background: var(--primary); color: var(--on-primary); box-shadow: 0 10px 22px -12px color-mix(in srgb, var(--primary) 80%, transparent); }
.vt .vt-btn--primary:hover { filter: brightness(1.12); }
.vt:where([data-tema="oscuro"] *) .vt-btn--primary:hover { filter: brightness(.94); }
.vt .vt-btn--wa { background: var(--wa); color: var(--on-wa); }
.vt .vt-btn--wa:hover { filter: brightness(1.06); }
.vt .vt-btn--ghost { background: var(--surface); border: 1px solid var(--line-2); color: var(--text); }
.vt .vt-btn--ghost:hover { background: var(--surface-2); }
.vt .vt-btn--soft { background: color-mix(in srgb, var(--teal) var(--soft), transparent); color: var(--primary); }
.vt .vt-btn--soft:hover { background: color-mix(in srgb, var(--teal) 24%, transparent); }
.vt:where([data-tema="oscuro"] *) .vt-btn--soft { color: var(--primary); }
.vt .vt-btn--sm { height: 34px; padding: 0 14px; font: 650 12.5px/18.125px var(--font); }
.vt .vt-btn--xs { height: 28px; padding: 0 11px; gap: 6px; font: 650 12px/17.4px var(--font); }
.vt .vt-btn--xs svg.vt-i { width: 14px; height: 14px; }
.vt .vt-ibtn { width: 40px; height: 40px; border-radius: 999px; display: grid; place-items: center; border: 1px solid var(--line-2); color: var(--text); flex: none; }
.vt .vt-ibtn:hover { background: var(--well); }
.vt .vt-ibtn:active { background: var(--well); }
.vt .vt-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.vt .vt-head__eyebrow { font: 600 13px/18.85px var(--font); color: var(--muted); margin-bottom: 2px; }
.vt .vt-head__title { font: 700 33.12px/36.432px var(--font); letter-spacing: -1.1592px; }
.vt .vt-head__title .vt-ch { display: inline-block; }
.vt .vt-head__title .vt-pal { display: inline-block; white-space: nowrap; }
.vt .vt-head__actions { display: flex; gap: 10px; }
.vt .vt-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--gap); margin-bottom: 22px; }
.vt .vt-stat { display: grid; align-content: center; gap: 8px; min-height: 128px; padding: 16px 18px; border-radius: var(--r-card); background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); min-width: 0; }
.vt .vt-stat__top { display: flex; align-items: center; gap: 11px; min-width: 0; }
.vt .vt-stat__ico { width: 32px; height: 32px; border-radius: 10px; flex: none; display: grid; place-items: center; background: color-mix(in srgb, var(--teal) var(--soft), transparent); color: var(--primary); }
.vt .vt-stat__l { font: 600 13px/18.85px var(--font); color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vt .vt-stat__v { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 10px; min-width: 0; }
.vt .vt-stat__v b { font: 900 30px/31.5px var(--font); letter-spacing: -1.2px; }
.vt .vt-pill { display: inline-flex; align-items: center; padding: 1.5px 8px; border-radius: 999px; font: 700 11.5px/12.075px var(--font); background: var(--well); color: var(--muted); white-space: nowrap; }
.vt .vt-pill--good { background: color-mix(in srgb, var(--good) var(--soft), transparent); color: var(--good); }
.vt .vt-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--gap); align-items: start; }
.vt .vt-card { position: relative; display: flex; flex-direction: column; min-width: 0; padding: 18px; border-radius: var(--r-card); background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); }
.vt .vt-td-flow { grid-column: 1 / 3; grid-row: 1; }
.vt .vt-td-inbox { grid-column: 3; grid-row: 1 / 3; align-self: stretch; }
.vt .vt-td-line { grid-column: 1 / 3; grid-row: 2; }
.vt .vt-td-rem { grid-column: 1; grid-row: 3; align-self: stretch; }
.vt .vt-td-trend { grid-column: 2 / 4; grid-row: 3; align-self: stretch; }
.vt .vt-td-recall { grid-column: 1; grid-row: 4; align-self: stretch; }
.vt .vt-td-docs { grid-column: 2; grid-row: 4; align-self: stretch; }
.vt .vt-td-act { grid-column: 3; grid-row: 4; align-self: stretch; }
.vt .vt-card__h { display: flex; align-items: center; gap: 10px; min-height: 40px; margin-bottom: 14px; }
.vt .vt-card__t { display: flex; align-items: center; gap: 10px; font: 700 15.5px/22.475px var(--font); letter-spacing: -0.155px; white-space: nowrap; }
.vt .vt-card__t svg.vt-i { color: var(--teal); }
.vt .vt-card__aside { margin-left: auto; font: 500 12.5px/18.125px var(--font); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vt .vt-card__h .vt-ibtn, .vt .vt-card__h .vt-btn { flex: none; }
.vt .vt-card__t + .vt-ibtn, .vt .vt-card__t + .vt-btn { margin-left: auto; }
.vt .vt-av { width: 30px; height: 30px; border-radius: 999px; flex: none; display: grid; place-items: center; font: 700 11px/15.95px var(--font); letter-spacing: 0.11px; color: var(--text);
  background: color-mix(in srgb, var(--av, var(--teal)) 22%, var(--raised)); }
.vt .vt-av--mint { --av: var(--mint); }
.vt .vt-av--sky { --av: var(--sky); }
.vt .vt-av--apricot { --av: var(--apricot); }
.vt .vt-av--sand { --av: var(--sand); }
.vt .vt-av--lilac { --av: var(--lilac); }
.vt .vt-av--teal { --av: var(--teal); }
.vt .vt-av--coral { --av: var(--coral); }
.vt .vt-td-lanes { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; flex: 1; }
.vt .vt-td-lane { display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 10px; border-radius: 18px; background: var(--surface-2); border: 1px solid var(--line); }
.vt .vt-td-lane__h { display: flex; align-items: center; gap: 8px; height: 26px; padding: 0 2px 0 4px; font: 700 13px/18.85px var(--font); }
.vt .vt-td-lane__dot { width: 10px; height: 10px; border-radius: 999px; background: var(--faint); box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 0%, transparent); }
.vt .vt-td-lane--arrived .vt-td-lane__dot { background: var(--apricot); }
.vt .vt-td-lane--in-consult .vt-td-lane__dot { background: var(--sky); }
.vt .vt-td-lane--done .vt-td-lane__dot { background: var(--good); }
.vt .vt-td-lane__n { margin-left: auto; min-width: 28px; height: 22px; padding: 0 8px; border-radius: 999px; display: grid; place-items: center; background: var(--raised); border: 1px solid var(--line); font: 700 12px/20px var(--font); }
.vt .vt-td-card { position: relative; display: grid; gap: 8px; padding: 10px; border-radius: 14px; background: var(--raised); border: 1px solid var(--line); box-shadow: 0 1px 2px #10231f0d; min-width: 0; }
.vt .vt-td-card--arrived { box-shadow: inset 3px 0 0 var(--apricot), 0 1px 2px #10231f0d; }
.vt .vt-td-card--in-consult { box-shadow: inset 3px 0 0 var(--sky), 0 1px 2px #10231f0d; }
.vt .vt-td-card--done { padding: 8px 10px; }
.vt .vt-td-card__open { position: absolute; inset: 0; border-radius: inherit; }
.vt .vt-td-card__who { display: flex; align-items: center; gap: 10px; min-width: 0; }
.vt .vt-td-card__who > span:last-child { min-width: 0; }
.vt .vt-td-card__name { display: block; font: 650 13.5px/19.575px var(--font); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vt .vt-td-card__meta { display: flex; align-items: center; gap: 5px; font: 500 11.5px/16.675px var(--font); color: var(--muted); white-space: nowrap; overflow: hidden; }
.vt .vt-td-card__meta i { width: 7px; height: 7px; border-radius: 999px; flex: none; background: var(--mint); }
.vt .vt-td-card__meta span { overflow: hidden; text-overflow: ellipsis; }
.vt .vt-td-card__foot { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 6px; min-height: 28px; pointer-events: none; }
.vt .vt-td-card__foot > * { pointer-events: auto; }
.vt .vt-td-ok { display: flex; align-items: center; gap: 5px; font: 650 11.5px/16.675px var(--font); color: var(--teal); min-width: 0; padding-left: 4px; }
.vt .vt-td-ok svg.vt-i { width: 14px; height: 14px; }
.vt .vt-td-ok span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vt .vt-td-wait { display: flex; align-items: center; gap: 4px; font: 650 11.5px/16.675px var(--font); color: var(--warn); white-space: nowrap; }
.vt .vt-td-wait svg.vt-i { width: 13px; height: 13px; }
.vt .vt-td-room { display: grid; gap: 3px; min-width: 0; font: 500 11px/15.95px var(--font); color: var(--muted); }
.vt .vt-td-room span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vt .vt-td-room__bar { width: 46px; height: 4px; border-radius: 999px; background: var(--well); overflow: hidden; }
.vt .vt-td-room__bar i { display: block; height: 100%; border-radius: inherit; background: var(--sky); }
.vt .vt-td-more { display: flex; align-items: center; justify-content: center; height: 29px; margin-top: 4px; border-radius: 10px; font: 650 12px/17.4px var(--font); color: var(--muted); }
.vt .vt-td-more:hover { background: var(--well); color: var(--text); }
@container (max-width: 200px) {
.vt .vt-td-ok span { display: none; }
}
.vt .vt-td-lane { container-type: inline-size; }
.vt .vt-td-inbox .vt-card__t svg.vt-i { color: var(--wa); }
.vt .vt-td-chats { display: grid; gap: 2px; margin: -4px -7px 0; }
.vt .vt-td-chat { display: flex; align-items: flex-start; gap: 11px; padding: 10px 8px; border-radius: 14px; min-width: 0; transition: background-color .15s; }
.vt .vt-td-chat:hover { background: var(--surface-2); }
.vt .vt-td-chat.vt-is-urgent { background: color-mix(in srgb, var(--coral) 7%, transparent); }
.vt .vt-td-chat .vt-av { width: 38px; height: 38px; font: 700 13px/18.85px var(--font); letter-spacing: 0.13px; }
.vt .vt-td-chat__body { flex: 1; min-width: 0; display: grid; gap: 2px; }
.vt .vt-td-chat__row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.vt .vt-td-chat__name { font: 650 14px/20.3px var(--font); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vt .vt-td-chat__time { margin-left: auto; flex: none; font: 500 11.5px/16.675px var(--font); color: var(--muted); }
.vt .vt-td-chat.vt-is-unread .vt-td-chat__time { font-weight: 700; color: var(--wa); }
.vt .vt-td-chat__msg { flex: 1; min-width: 0; font: 500 13px/18.85px var(--font); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vt .vt-td-chat.vt-is-unread .vt-td-chat__msg { font-weight: 600; color: var(--text); }
.vt .vt-td-chat__n { flex: none; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; display: grid; place-items: center; background: var(--wa); color: #fff; font: 700 11px/15.95px var(--font); }
.vt .vt-td-chat__lock { flex: none; color: var(--faint); }
.vt .vt-td-chat__lock svg.vt-i { width: 12px; height: 12px; }
.vt .vt-td-tag { justify-self: start; margin-top: 4px; padding: 1px 8px; border-radius: 6px; background: color-mix(in srgb, var(--coral) 18%, transparent); color: color-mix(in srgb, var(--coral) 70%, var(--text)); font: 700 11px/15.95px var(--font); }
.vt .vt-td-inbox__all { margin-top: auto; width: 100%; }
.vt .vt-td-tl { display: grid; grid-template-columns: 130px minmax(0, 1fr); column-gap: 32px; }
.vt .vt-td-tl__hours { grid-column: 2; position: relative; height: 16px; font: 600 11px/15.95px var(--font); color: var(--muted); }
.vt .vt-td-tl__hours span { position: absolute; top: 0; transform: translateX(-50%); }
.vt .vt-td-tl__hours span:first-child { transform: none; }
.vt .vt-td-tl__hours span:last-child { transform: translateX(-100%); }
.vt .vt-td-tl__who { display: flex; align-items: center; gap: 10px; height: 46px; min-width: 0; }
.vt .vt-td-tl__who b { display: block; font: 650 13px/18.85px var(--font); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vt .vt-td-tl__who small { display: block; font: 500 11.5px/16.675px var(--font); color: var(--muted); }
.vt .vt-td-tl__track { position: relative; height: 30px; border-radius: 10px; background: var(--surface-2); }
.vt .vt-td-tl__lunch { position: absolute; top: 0; bottom: 0; background: repeating-linear-gradient(135deg, transparent 0 5px, var(--line) 5px 6px); }
.vt .vt-td-blk { position: absolute; top: 0; height: 30px; min-width: 15px; border-radius: 8px; overflow: hidden; display: flex; align-items: center; padding: 0 6px;
  border: 1px solid color-mix(in srgb, var(--c) 40%, transparent); border-left: 3px solid var(--c);
  background: color-mix(in srgb, var(--c) 22%, var(--raised)); color: color-mix(in srgb, var(--c) 60%, var(--text)); font: 650 11px/15.95px var(--font); white-space: nowrap; }
.vt .vt-td-blk span { overflow: hidden; text-overflow: ellipsis; }
.vt .vt-td-blk--mint { --c: var(--mint); }
.vt .vt-td-blk--teal { --c: var(--teal); }
.vt .vt-td-blk--apricot { --c: var(--apricot); }
.vt .vt-td-blk--lilac { --c: var(--lilac); }
.vt .vt-td-blk--sand { --c: var(--sand); }
.vt .vt-td-blk--coral { --c: var(--coral); }
.vt .vt-td-blk--sky { --c: var(--sky); }
.vt .vt-td-blk.vt-is-done { opacity: .5; }
.vt .vt-td-blk.vt-is-booked { background: color-mix(in srgb, var(--c) 10%, var(--raised)); border-style: dashed; border-left-style: solid; }
.vt .vt-td-blk.vt-is-in-consult { box-shadow: 0 0 0 2px var(--sky); }
.vt .vt-td-blk.vt-is-arrived { box-shadow: 0 0 0 2px var(--apricot); }
.vt .vt-td-tl__now { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--coral); pointer-events: none; z-index: 2; }
.vt .vt-td-tl__now b { position: absolute; top: -25px; left: 50%; transform: translateX(-50%); padding: 1px 7px; border-radius: 999px; background: var(--coral); color: #fff; font: 700 10.5px/15.225px var(--font); white-space: nowrap; }
.vt .vt-td-tl__body { grid-column: 2; position: relative; display: grid; row-gap: 16px; padding: 8px 0; }
.vt .vt-td-legend { grid-column: 2; display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 12px; font: 500 11.5px/16.675px var(--font); color: var(--muted); }
.vt .vt-td-legend span { display: inline-flex; align-items: center; gap: 6px; }
.vt .vt-td-legend i { width: 8px; height: 8px; border-radius: 999px; background: var(--c); }
.vt .vt-td-big { display: flex; align-items: baseline; gap: 8px; margin: 4px 0 12px; }
.vt .vt-td-big b { font: 700 26px/37.7px var(--font); letter-spacing: -0.52px; }
.vt .vt-td-big span { font: 500 13px/18.85px var(--font); color: var(--muted); }
.vt .vt-td-meter { display: grid; grid-template-columns: 112px minmax(0, 1fr) 40px; align-items: center; gap: 10px; height: 29px; font: 500 13px/18.85px var(--font); color: var(--muted); }
.vt .vt-td-meter__track { height: 8px; border-radius: 999px; background: var(--well); overflow: hidden; }
.vt .vt-td-meter__track i { display: block; height: 100%; border-radius: inherit; background: var(--c, var(--teal)); }
.vt .vt-td-meter b { text-align: right; font: 700 13px/18.85px var(--font); color: var(--text); }
.vt .vt-td-rem__foot { margin-top: auto; display: grid; justify-items: start; gap: 12px; padding-top: 18px; }
.vt .vt-td-rem__foot small { font: 500 12.5px/18.125px var(--font); color: var(--muted); }
.vt .vt-td-seg { position: relative; display: inline-flex; padding: 3px; border-radius: 999px; background: var(--well); margin-left: auto; }
.vt .vt-td-seg__pill { position: absolute; top: 3px; bottom: 3px; left: 0; border-radius: 999px; background: var(--raised); box-shadow: 0 1px 2px #10231f1f; transition: translate .3s var(--ease), width .3s var(--ease); }
.vt .vt-td-seg button { position: relative; height: 34px; padding: 0 14px; border-radius: 999px; font: 650 12.5px/18.125px var(--font); color: var(--muted); }
.vt .vt-td-seg button[aria-pressed="true"] { color: var(--text); }
.vt .vt-td-trend__big { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-top: -2px; }
.vt .vt-td-trend__big b { font: 700 32px/32px var(--font); letter-spacing: -0.96px; }
.vt .vt-td-trend__big span { font: 500 13px/18.85px var(--font); color: var(--muted); }
.vt .vt-td-keys { display: flex; gap: 16px; margin: 10px 0 6px; font: 500 12.5px/18.125px var(--font); color: var(--muted); }
.vt .vt-td-keys span { display: inline-flex; align-items: center; gap: 6px; }
.vt .vt-td-keys i { width: 8px; height: 8px; border-radius: 999px; background: var(--c); }
.vt .vt-td-chart { flex: 1; min-height: 173px; position: relative; }
.vt .vt-td-chart svg { display: block; width: 100%; height: 100%; overflow: visible; }
.vt .vt-td-chart text { font: 500 11px var(--font); fill: var(--muted); }
.vt .vt-td-chart .vt-grid-l { stroke: var(--line); stroke-dasharray: 3 4; }
.vt .vt-td-rows { display: grid; }
.vt .vt-td-row { display: flex; align-items: center; gap: 11px; padding: 9px 0; border-top: 1px solid var(--line); min-width: 0; }
.vt .vt-td-row:first-child { border-top: 0; padding-top: 3px; }
.vt .vt-td-row__txt { flex: 1; min-width: 0; }
.vt .vt-td-row__txt b { display: block; font: 650 13.5px/19.575px var(--font); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vt .vt-td-row__txt small { display: block; font: 500 12px/17.4px var(--font); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vt .vt-td-row__txt small em { font-style: normal; font-weight: 650; color: var(--bad); }
.vt .vt-td-load { display: grid; gap: 0; }
.vt .vt-td-load__row { display: flex; align-items: center; gap: 14px; padding: 10px 0; min-width: 0; }
.vt .vt-td-load__row:first-child { padding-top: 4px; }
.vt .vt-td-load .vt-av { width: 40px; height: 40px; font: 700 13px/18.85px var(--font); }
.vt .vt-td-load__txt { flex: 1; min-width: 0; display: grid; gap: 4px; }
.vt .vt-td-load__top { display: flex; align-items: baseline; gap: 8px; }
.vt .vt-td-load__top b { font: 650 13.5px/19.575px var(--font); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vt .vt-td-load__top span { margin-left: auto; flex: none; font: 650 11.5px/16.675px var(--font); color: var(--sky); }
.vt .vt-td-load__bar { height: 6px; border-radius: 999px; background: var(--well); overflow: hidden; }
.vt .vt-td-load__bar i { display: block; height: 100%; border-radius: inherit; background: var(--teal); }
.vt .vt-td-load__txt small { font: 500 12px/17.4px var(--font); color: var(--muted); }
.vt .vt-td-act {  }
.vt .vt-td-feed { display: grid; }
.vt .vt-td-feed li { display: flex; align-items: flex-start; gap: 12px; padding: 7px 0; border-top: 1px solid var(--line); min-width: 0; }
.vt .vt-td-feed li:first-child { border-top: 0; padding-top: 2px; }
.vt .vt-td-feed__ic { width: 28px; height: 28px; border-radius: 9px; flex: none; display: grid; place-items: center; background: var(--surface-2); color: var(--muted); }
.vt .vt-td-feed__ic svg.vt-i { width: 14px; height: 14px; }
.vt .vt-td-feed p { font: 500 13px/18.2px var(--font); min-width: 0; }
.vt .vt-td-feed p b { font-weight: 700; }
.vt .vt-td-feed small { display: block; font: 500 11.5px/16.1px var(--font); color: var(--muted); margin-top: 2px; }
@keyframes vt-flash { 0% { color: var(--teal); } to { color: inherit; } }
@keyframes vt-fade { 0% { opacity: 0; } }
@container vt (max-width: 760px) {
.vt .vt-head { display: block; margin-bottom: 14px; }
.vt .vt-head__title { font-size: 33.12px; }
.vt .vt-head__actions { margin-top: 14px; display: grid; grid-template-columns: auto 1fr; gap: 10px; }
.vt .vt-head__actions .vt-btn { padding: 0 14px; }
.vt .vt-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
.vt .vt-stat { min-height: 0; padding: 11px 13px; gap: 4px; border-radius: 18px; }
.vt .vt-stat__ico { display: none; }
.vt .vt-stat__l { white-space: normal; font-size: 12.5px; line-height: 17px; }
.vt .vt-stat__v b { font-size: 22px; line-height: 24px; letter-spacing: -0.8px; }
.vt .vt-stat__v { gap: 6px 8px; }
.vt .vt-grid { display: flex; flex-direction: column; gap: 18px; align-items: stretch; }
.vt .vt-card { padding: 18px 18px 18px; }
.vt .vt-card__aside { display: none; }
.vt .vt-td-flow .vt-card__h .vt-ibtn { margin-left: auto; }
.vt .vt-td-flow { padding-left: 0; padding-right: 0; overflow: hidden; }
.vt .vt-td-flow .vt-card__h { padding: 0 18px; }
.vt .vt-td-lanes { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 10px; padding: 0 0 0 0; scrollbar-width: none; }
.vt .vt-td-lane { flex: 0 0 270px; scroll-snap-align: start; }
.vt .vt-td-inbox .vt-card__aside, .vt .vt-td-recall .vt-card__aside, .vt .vt-td-flow .vt-card__aside { display: block; }
.vt .vt-td-flow .vt-card__aside { display: none; }
.vt .vt-td-tl { grid-template-columns: 96px minmax(0, 1fr); column-gap: 10px; }
.vt .vt-td-tl .vt-av { display: none; }
.vt .vt-td-meter { grid-template-columns: 96px minmax(0, 1fr) 28px; }
}
@media (prefers-reduced-motion: reduce) {
.vt, .vt *, .vt *::before, .vt *::after { transition: none !important; animation: none !important; }
}
.vt { container: vt / inline-size; min-height: 100%; background-attachment: scroll; }
.vt .vt-cuerpo { padding: 0; }

.vt .vt-sin { color: var(--faint); }

.vt .vt-quieta { pointer-events: none; }
.vt[data-quieta] * { transition: none !important; }

.vt [role="button"] { cursor: pointer; }

.vt .vt-td-flow { container: vtflujo / inline-size; }
@container vtflujo (max-width: 680px) {
  .vt .vt-td-lanes { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
  .vt .vt-td-lane { flex: 0 0 200px; scroll-snap-align: start; }
}

.vt .vt-td-lane:empty { min-height: 120px; }

.vt a.vt-ibtn, .vt a.vt-btn { text-decoration: none; }

@container vt (max-width: 300px) {
  .vt .vt-head__actions { grid-template-columns: minmax(0, 1fr); }
  .vt .vt-pill { white-space: normal; }
  .vt .vt-card__h { flex-wrap: wrap; row-gap: 8px; }
}
`;
