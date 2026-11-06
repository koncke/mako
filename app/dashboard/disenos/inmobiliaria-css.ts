// =============================================================================
// inmobiliaria-css — la hoja de estilos de la hoja «Inmobiliaria» con su diseño propio (la copia de Torque)
// =============================================================================
// GENERADA por el armador del chat de los dashboards (scratchpad/tools/armar-tq.py) desde la hoja de la copia
// (docs/diseno/mockups-dashboard/inmobiliaria-torque/torque.css): todo adentro de .tq, cada clase con el prefijo tq-, sin el armazón de Torque
// (la barra de la izquierda, la de arriba, la del reloj y las dos del teléfono), los resets por etiqueta con
// :where() y con @container en lugar de @media. Lo de la adaptación va al final (el paso del medio, los vacíos y lo que se toca). Se
// escribió desde lo MEDIDO del demo: nada del código de la tienda.
// Paleta doble (6/11/2026, Martín: «los que vienen en dark mode deben acompañar siempre el white mode si el usuario lo tiene así en MaKo, y si
// tiene dark mode, automáticamente pasarse a allí»): claro por defecto y oscuro bajo [data-tema="oscuro"] de <html>, sólo con variables.
// ⚠️ En un template literal no va ningún backtick (ni en un comentario) ni un «dólar con llave».
// =============================================================================

export const CSS_INMOBILIARIA = `
@font-face { font-family: 'Torque Geist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/geist/v4/gyByhwUxId8gMEwcGFWNOITd.woff2) format('woff2'); }
@font-face { font-family: 'Torque Geist Mono'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/geistmono/v4/or3nQ6H-1_WfwkMZI_qYFrcdmhHkjko.woff2) format('woff2'); }
.tq {
  container-type: inline-size; container-name: tq;
  --font: 'Torque Geist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono: 'Torque Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  --bg: #ecebe6;
  --glow-a: #f6dfcb;
  --glow-b: #e2e6eb;
  --surface: #fffefc;
  --surface-2: #f6f5f1;
  --raised: #fff;
  --well: #1c1a160f;
  --line: #1c1a161a;
  --line-2: #1c1a162e;
  --shadow: 0 1px 2px #1c1a160d, 0 12px 30px -18px #1c1a1642;
  --shadow-pop: 0 24px 60px -18px #1c1a1652, 0 2px 6px #1c1a1614;
  --text: #17181b;
  --muted: #5c5f66;
  --faint: #75787f;
  --primary: #c2410c;
  --on-primary: #fff7f1;
  --soft-ink: #a33a0f;
  --side: #17181b;
  --on-side: #e8e8ea;
  --side-dim: #e8e8ea99;
  --side-pill: #ff9a3c;
  --on-side-pill: #1d1003;
  --orange: #e2611b;
  --amber: #d6940a;
  --sky: #3a86d4;
  --teal: #13907c;
  --violet: #7a66d4;
  --rose: #d6455c;
  --lime: #4f9a2c;
  --slate: #66717f;
  --good: #2c8a47;
  --warn: #a86a08;
  --bad: #c9382a;
  --ink: #17181b;
  --on-ink: #ecebe6;
  --pill-mix: #000;
  --stage-hi: #fff;
  --post: #cfcdc6;
  --av-in: #d4e4f7;
  --av-cr: #f8cfae;
  --av-ta: #c8ebe2;
  --av-lb: #d9ecc6;
  --av-jk: #e2dcf7;
  --r-card: 20px;
  --r-tile: 14px;
  --gap: 16px;
  --side-w: 248px;
  --gutter: clamp(16px, 1.8vw, 30px);
  --ease: cubic-bezier(.2, .8, .2, 1);
  position: relative; padding: 4px 26px 56px; color: var(--text); background: radial-gradient(900px 520px at 0 0, var(--glow-a), transparent 60%), radial-gradient(1100px 600px at 100% 0, var(--glow-b), transparent 60%), var(--bg); font: 500 15px/22.5px var(--font); -webkit-font-smoothing: antialiased;
}
/* Oscuro: grafito con las superficies subiendo de luz; los acentos conservan su tono y suben de luminosidad. La placa del auto queda blanca (es un objeto). */
.tq:where([data-tema="oscuro"] *) {
  --bg: #101114;
  --glow-a: #1f1812;
  --glow-b: #14181d;
  --surface: #191a1e;
  --surface-2: #212227;
  --raised: #27282d;
  --well: #25262b;
  --line: #2c2d33;
  --line-2: #3e3f46;
  --shadow: 0 1px 2px #00000080, 0 12px 30px -18px #000000d9;
  --shadow-pop: 0 24px 60px -18px #000000e6, 0 2px 6px #00000080;
  --text: #ecebe8;
  --muted: #a9aaaf;
  --faint: #8b8c92;
  --primary: #f27a3e;
  --on-primary: #1b0c03;
  --soft-ink: #ff9d62;
  --orange: #f27a3e;
  --amber: #e8a92a;
  --sky: #61a5ea;
  --teal: #33bda3;
  --violet: #a28ff2;
  --rose: #ef6c82;
  --lime: #7fc557;
  --slate: #929daa;
  --good: #5ecb86;
  --warn: #e8b04c;
  --bad: #f26d5e;
  --ink: #ecebe6;
  --on-ink: #17181b;
  --pill-mix: #fff;
  --stage-hi: #ffffff12;
  --post: #4a4b52;
  --av-in: #1f3350;
  --av-cr: #523521;
  --av-ta: #1d4339;
  --av-lb: #2f4420;
  --av-jk: #382f58;
}

/* ── la copia ─────────────────────────────────────────────────────────────────────────────────────── */
.tq *, .tq *::before, .tq *::after { box-sizing: border-box; }
.tq :where(button) { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; padding: 0; }
.tq :where(a) { color: inherit; text-decoration: none; }
.tq :where(h1), .tq :where(h2), .tq :where(h3), .tq :where(p), .tq :where(ul) { margin: 0; }
.tq :where(ul) { padding: 0; list-style: none; }
.tq svg.tq-i { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.tq :focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.tq .tq-ibtn { position: relative; width: 46px; height: 46px; display: grid; place-items: center; border-radius: 50%; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); transition: background-color .15s; }
.tq .tq-ibtn:hover { background: var(--surface-2); }
.tq .tq-btn { height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 0 22px; border-radius: 999px; font-size: 16px; font-weight: 650; line-height: 24px; white-space: nowrap; transition: transform .3s var(--ease); }
.tq .tq-btn--primary { background: var(--primary); color: var(--on-primary); box-shadow: 0 10px 22px -12px color-mix(in srgb, var(--primary) 80%, transparent); }
.tq .tq-btn--primary:hover { filter: brightness(1.12); }
.tq .tq-btn--ghost { background: var(--surface); color: var(--text); border: 1px solid var(--line-2); }
.tq .tq-btn--ghost:hover { background: var(--surface-2); }
.tq .tq-btn--soft { background: color-mix(in srgb, var(--orange) 20%, transparent); color: var(--soft-ink); }
.tq .tq-btn--soft:hover { background: color-mix(in srgb, var(--orange) 24%, transparent); }
.tq .tq-btn--dark { background: var(--ink); color: var(--on-ink); }
.tq .tq-btn--dark:hover { filter: brightness(1.25); }
.tq .tq-btn--sm { height: 38px; padding: 0 16px; gap: 8px; font-size: 14px; }
.tq .tq-btn--xs { height: 32px; padding: 0 10px; gap: 6px; font-size: 14px; }
.tq .tq-btn svg.tq-i { width: 15px; height: 15px; }
.tq .tq-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-top: 23px; }
.tq .tq-head__eyebrow { font-size: 15px; font-weight: 600; line-height: 22.5px; color: var(--muted); }
.tq .tq-head__title { margin-top: 3px; font-size: 37.44px; font-weight: 700; line-height: 40.4352px; letter-spacing: -1.3104px; }
.tq .tq-head__actions { display: flex; gap: 10px; margin-bottom: -1px; }
.tq .tq-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--gap); margin-top: 20px; }
.tq .tq-stat { height: 145px; padding: 18px 20px; border-radius: var(--r-card); background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); display: grid; align-content: start; gap: 8px; }
.tq .tq-stat__h { display: flex; align-items: center; gap: 12px; font-size: 15px; font-weight: 600; line-height: 22.5px; color: var(--muted); }
.tq .tq-ic { width: 32px; height: 32px; flex: none; display: grid; place-items: center; border-radius: 10px; background: color-mix(in srgb, var(--orange) 15%, transparent); color: var(--primary); }
.tq .tq-stat__v { margin-top: 2px; font-size: 34px; font-weight: 900; line-height: 35.7px; letter-spacing: -1.02px; }
.tq .tq-stat__v small { margin-left: 6px; font-size: 17px; font-weight: 600; line-height: 17.85px; letter-spacing: 0; color: var(--muted); }
.tq .tq-chip { margin-top: 2px; justify-self: start; display: inline-flex; align-items: center; height: 21px; padding: 0 8px; border-radius: 99px; font-size: 13px; font-weight: 700; line-height: 13.65px; background: var(--well); color: var(--muted); }
.tq .tq-chip--warn { background: color-mix(in srgb, var(--warn) 18%, transparent); color: var(--warn); }
.tq .tq-chip--good { background: color-mix(in srgb, var(--good) 15%, transparent); color: var(--good); }
.tq .tq-card { position: relative; min-width: 0; padding: 20px; border-radius: var(--r-card); background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); }
.tq .tq-card__h { display: flex; align-items: center; gap: 12px; min-height: 40px; }
.tq .tq-card__t { font-size: 18px; font-weight: 700; line-height: 27px; letter-spacing: -.27px; white-space: nowrap; }
.tq .tq-card__aside { margin-left: auto; font-size: 14px; font-weight: 500; line-height: 21px; color: var(--muted); }
.tq .tq-fl-bays { margin-top: 22px; height: 406px; }
.tq .tq-fl-board { margin-top: 16px; height: 827px; }
.tq .tq-fl-r3 { display: grid; grid-template-columns: minmax(0, 369fr) minmax(0, 466fr) minmax(0, 273fr); gap: var(--gap); margin-top: 15px; }
.tq .tq-fl-r4 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--gap); margin-top: 16px; }
.tq .tq-fl-r3 > .tq-card { height: 575px; }
.tq .tq-fl-r4 > .tq-card { height: 576px; }
.tq .tq-bays { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; margin-top: 15px; }
.tq .tq-bay { position: relative; height: 310px; display: flex; flex-direction: column; padding: 12px; border-radius: 18px; background: var(--raised); border: 1px solid var(--line); box-shadow: inset 0 3px 0 var(--tone, var(--sky)), 0 1px 2px #1c1a160d; }
.tq .tq-bay--approval { --tone: var(--amber); }
.tq .tq-bay--diagnosis { --tone: var(--violet); }
.tq .tq-bay__h { display: flex; align-items: center; gap: 8px; height: 25px; }
.tq .tq-bay__n { font-size: 16px; font-weight: 700; line-height: 24px; letter-spacing: .64px; text-transform: uppercase; }
.tq .tq-pill { margin-left: auto; height: 25px; display: inline-flex; align-items: center; gap: 6px; padding: 0 9px; border-radius: 99px; font-size: 13px; font-weight: 650; line-height: 19.5px; background: color-mix(in srgb, var(--tone, var(--sky)) 15%, transparent); color: color-mix(in srgb, var(--tone, var(--sky)) 72%, var(--pill-mix)); }
.tq .tq-pill i { width: 6px; height: 6px; border-radius: 50%; background: var(--tone, var(--sky)); }
.tq .tq-bay__stage { position: relative; height: 92px; margin-top: 9px; border-radius: 12px; background: radial-gradient(120px 60px at 50% 40%, var(--stage-hi), transparent 70%), var(--surface-2); overflow: hidden; }
.tq .tq-bay__stage svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.tq .tq-bay__car { display: block; margin-top: 12px; font-size: 17px; font-weight: 700; line-height: 25.5px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tq .tq-bay__who { display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 14px; font-weight: 500; color: var(--muted); }
.tq .tq-plate { display: inline-flex; align-items: center; height: 21px; padding: 0 5px; border-radius: 6px; border: 1.5px solid #1b2a55; background: #fff; font: 600 13px/13px var(--mono); letter-spacing: .52px; color: #1b2a55; }
.tq .tq-av { width: 22px; height: 22px; flex: none; display: grid; place-items: center; border-radius: 50%; font-size: 11px; font-weight: 700; letter-spacing: .22px; color: var(--text); }
.tq .tq-t-in { background: var(--av-in); }
.tq .tq-t-cr { background: var(--av-cr); }
.tq .tq-t-ta { background: var(--av-ta); }
.tq .tq-t-lb { background: var(--av-lb); }
.tq .tq-t-jk { background: var(--av-jk); }
.tq .tq-bay__time { display: flex; align-items: center; gap: 8px; margin-top: 8px; height: 34px; }
.tq .tq-bay__time svg.tq-i { width: 12px; height: 12px; color: var(--good); }
.tq .tq-bay__time b { font: 700 17px/25.5px var(--mono); letter-spacing: -.34px; }
.tq .tq-ring { position: relative; margin-left: auto; width: 34px; height: 34px; }
.tq .tq-ring svg { width: 34px; height: 34px; transform: rotate(-90deg); }
.tq .tq-ring span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 12px; font-weight: 700; line-height: 18px; color: var(--muted); }
.tq .tq-bay__wait { display: flex; align-items: center; gap: 6px; margin-top: 3px; font-size: 14px; font-weight: 650; color: var(--warn); }
.tq .tq-bay__act { margin-top: auto; }
.tq .tq-bay__act .tq-btn { width: 100%; }
.tq .tq-bay__note { margin-top: auto; height: 38px; display: flex; align-items: center; gap: 6px; padding-left: 2px; white-space: nowrap; font-size: 14px; font-weight: 500; color: var(--muted); }
.tq .tq-bay--free { background: var(--surface-2); box-shadow: none; }
.tq .tq-bay--free .tq-bay__n + small { font-size: 14px; font-weight: 500; color: var(--muted); }
.tq .tq-bay__stage.tq-is-free { display: grid; justify-items: center; align-content: start; padding-top: 30px; font-size: 14px; font-weight: 700; letter-spacing: 1.96px; text-transform: uppercase; color: var(--muted); }
.tq .tq-bay--free .tq-bay__note { margin-top: 22px; height: auto; padding: 0; white-space: normal; }
.tq .tq-bay__stage.tq-is-free svg { z-index: 0; }
.tq .tq-bay__stage.tq-is-free span { position: relative; z-index: 1; }
.tq .tq-bay--free .tq-bay__act { margin-top: auto; }
.tq .tq-lanes { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-top: 16px; height: 729px; }
.tq .tq-lane { display: flex; flex-direction: column; gap: 8px; padding: 10px; border-radius: 18px; background: var(--surface-2); border: 1px solid var(--line); min-width: 0; }
.tq .tq-lane__h { display: flex; align-items: center; gap: 8px; height: 27px; padding: 0 2px 0 4px; font-size: 15px; font-weight: 700; line-height: 22.5px; white-space: nowrap; }
.tq .tq-lane__h i { width: 8px; height: 8px; border-radius: 50%; background: var(--tone, var(--slate)); }
.tq .tq-lane__h b { margin-left: auto; min-width: 22px; height: 22px; display: grid; place-items: center; padding: 0 6px; border-radius: 99px; background: var(--raised); border: 1px solid var(--line); font-size: 14px; font-weight: 700; line-height: 20px; }
.tq .tq-lane--diag { --tone: var(--violet); }
.tq .tq-lane--appr { --tone: var(--amber); }
.tq .tq-lane--repair { --tone: var(--sky); }
.tq .tq-lane--ready { --tone: var(--lime); }
.tq .tq-jc { position: relative; height: 162px; display: grid; align-content: start; gap: 4px; padding: 10px; border-radius: 14px; background: var(--raised); border: 1px solid var(--line); box-shadow: 0 1px 2px #1c1a160d; cursor: grab; transition: transform .3s var(--ease); }
.tq .tq-jc--short { height: 158px; }
.tq .tq-jc__top { display: flex; align-items: center; gap: 6px; height: 21px; }
.tq .tq-jc__bay { margin-left: auto; height: 21px; padding: 0 6px; display: grid; place-items: center; border-radius: 6px; background: var(--well); font-size: 13px; font-weight: 700; color: var(--muted); }
.tq .tq-jc__tag { width: 21px; height: 21px; display: grid; place-items: center; border-radius: 6px; }
.tq .tq-jc__tag svg.tq-i { width: 12px; height: 12px; }
.tq .tq-jc__tag--rush { background: color-mix(in srgb, var(--rose) 13%, transparent); color: var(--rose); }
.tq .tq-jc__tag--walk { background: color-mix(in srgb, var(--warn) 18%, transparent); color: var(--warn); }
.tq .tq-jc__name { margin-top: 0; font-size: 16px; font-weight: 700; line-height: 24px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tq .tq-jc__own { font-size: 14px; font-weight: 500; line-height: 21px; color: var(--muted); margin-top: 2px; }
.tq .tq-jc__st { margin-top: -1px; display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 650; line-height: 21px; color: var(--muted); }
.tq .tq-jc__st svg.tq-i { width: 13px; height: 13px; }
.tq .tq-jc__st--good { color: var(--good); }
.tq .tq-jc__st--warn { color: var(--warn); }
.tq .tq-jc__foot { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; height: 32px; }
.tq .tq-jc__foot .tq-av { width: 24px; height: 24px; }
.tq .tq-jc__empty { width: 22px; height: 22px; border-radius: 50%; border: 1.5px dashed var(--line-2); }
.tq .tq-arr { margin-top: 13px; }
.tq .tq-arr li { display: grid; grid-template-columns: 90px minmax(0, 1fr) auto; align-items: center; column-gap: 0; height: 68px; border-bottom: 1px solid var(--line); }
.tq .tq-arr li:last-child { border-bottom: 0; }
.tq .tq-arr__t { font-size: 15px; font-weight: 700; line-height: 22.5px; letter-spacing: -.15px; }
.tq .tq-arr__who { min-width: 0; text-align: left; }
.tq .tq-arr__who b { display: block; font-size: 16px; font-weight: 700; line-height: 24px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tq .tq-arr__who > span { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 14px; font-weight: 500; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tq .tq-plate--us { padding: 0 5px 0 0; gap: 5px; }
.tq .tq-plate--us em { font: 800 9px/9px var(--font); font-style: normal; writing-mode: vertical-rl; transform: rotate(180deg); padding: 0 1px; border-right: 1.5px solid #1b2a55; height: 100%; display: grid; place-items: center; color: var(--muted); letter-spacing: .3px; }
.tq .tq-arr li .tq-btn { margin-left: 10px; }
.tq .tq-seg { position: relative; margin-left: auto; display: flex; padding: 3px; border-radius: 99px; background: var(--well); }
.tq .tq-seg__pill { position: absolute; top: 3px; left: 0; height: 34px; border-radius: 99px; background: var(--surface); box-shadow: 0 1px 2px #1c1a1614, 0 4px 10px -6px #1c1a1640; transition: transform .35s var(--ease), width .35s var(--ease); }
.tq .tq-seg__btn { position: relative; height: 34px; padding: 0 15px; border-radius: 99px; font-size: 14px; font-weight: 700; color: var(--muted); }
.tq .tq-seg__btn[aria-pressed='true'] { color: var(--text); }
.tq .tq-card__h .tq-ibtn { width: 40px; height: 40px; box-shadow: none; background: transparent; border-color: var(--line-2); }
.tq .tq-sales__v { margin-top: 17px; font-size: 34px; font-weight: 700; line-height: 34px; letter-spacing: -.68px; }
.tq .tq-sales__sub { margin-top: 5px; font-size: 14px; font-weight: 500; line-height: 21px; color: var(--muted); }
.tq .tq-leg { display: flex; gap: 16px; margin-top: 8px; font-size: 14px; font-weight: 500; line-height: 21px; color: var(--muted); }
.tq .tq-leg span { display: inline-flex; align-items: center; gap: 6px; }
.tq .tq-leg i { width: 8px; height: 8px; border-radius: 50%; }
.tq .tq-chart { position: relative; height: 195px; margin-top: 7px; }
.tq .tq-chart svg { display: block; width: 100%; height: 100%; overflow: visible; }
.tq .tq-chart__ax { font: 500 13px var(--font); fill: var(--text); }
.tq .tq-chart__x { font: 500 13px var(--font); fill: var(--muted); }
.tq .tq-chart__grid { stroke: var(--line-2); stroke-dasharray: 2 4; }
.tq .tq-techs { margin-top: 11px; display: grid; gap: 0; }
.tq .tq-tech { display: grid; grid-template-columns: 40px minmax(0, 1fr); column-gap: 10px; align-items: center; height: 96.5px; }
.tq .tq-tech .tq-av { width: 40px; height: 40px; font-size: 14px; letter-spacing: .28px; }
.tq .tq-tech__h { display: flex; align-items: center; gap: 8px; }
.tq .tq-tech__h b { font-size: 15px; font-weight: 700; line-height: 22.5px; }
.tq .tq-tech__state { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 650; line-height: 21px; color: var(--sky); white-space: nowrap; }
.tq .tq-tech__state:hover { text-decoration: underline; }
.tq .tq-tech__state svg.tq-i { width: 12px; height: 12px; }
.tq .tq-tech__state--ok { color: var(--good); }
.tq .tq-tech__bar { height: 6px; margin-top: 4px; border-radius: 99px; background: var(--well); overflow: hidden; }
.tq .tq-tech__bar span { display: block; height: 100%; border-radius: inherit; transform-origin: left; }
.tq .tq-tech small { display: block; margin-top: 4px; font-size: 14px; font-weight: 500; line-height: 21px; color: var(--muted); }
.tq .tq-stock { margin-top: 18px; }
.tq .tq-stock li { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 12px; align-items: center; height: 76px; border-bottom: 1px solid var(--line); }
.tq .tq-stock li:last-child { border-bottom: 0; }
.tq .tq-stock b { display: block; font-size: 15px; font-weight: 650; line-height: 22.5px; }
.tq .tq-stock code { display: block; margin-top: 2px; font: 500 12.88px/19.32px var(--mono); letter-spacing: .1288px; color: var(--muted); }
.tq .tq-stock code em { font-style: normal; font-family: var(--font); font-size: 14px; font-weight: 650; color: var(--sky); }
.tq .tq-stock__bar { grid-column: 1; height: 4px; margin-top: 6px; border-radius: 99px; background: var(--well); overflow: hidden; }
.tq .tq-stock__bar span { display: block; height: 100%; border-radius: inherit; transform-origin: left; }
.tq .tq-stock__n { grid-row: 1 / span 2; grid-column: 2; font-size: 22px; font-weight: 700; line-height: 33px; }
.tq .tq-stock__n small { font-size: 14px; font-weight: 600; color: var(--muted); }
.tq .tq-stock__n.tq-is-bad { color: var(--bad); }
.tq .tq-stock__n.tq-is-warn { color: var(--warn); }
.tq .tq-fl-load { display: flex; flex-direction: column; }
.tq .tq-gauge { position: relative; width: 210px; height: 180px; margin: 36px auto 0; }
.tq .tq-gauge svg { width: 100%; height: 100%; overflow: visible; }
.tq .tq-gauge__mid { position: absolute; left: 0; right: 0; top: 116px; text-align: center; }
.tq .tq-gauge__mid b { display: block; font-size: 30px; font-weight: 700; line-height: 30px; letter-spacing: -.9px; }
.tq .tq-gauge__mid span { display: block; margin-top: 4px; font-size: 13px; font-weight: 500; line-height: 19.5px; color: var(--muted); }
.tq .tq-load__tiles { margin-top: auto; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.tq .tq-load__tiles div { height: 122px; padding: 10px; border-radius: var(--r-tile); background: var(--surface-2); border: 1px solid var(--line); }
.tq .tq-load__tiles span { display: block; font-size: 13px; font-weight: 600; line-height: 16.25px; color: var(--muted); }
.tq .tq-load__tiles b { display: block; margin-top: 10px; font-size: 21px; font-weight: 700; line-height: 31.5px; }
.tq .tq-load__tiles b small { font-size: 14px; font-weight: 600; color: var(--muted); }
.tq .tq-feed { margin-top: 18px; }
.tq .tq-feed li { display: flex; gap: 12px; padding: 9px 0 8px; border-bottom: 1px solid var(--line); }
.tq .tq-feed li:last-child { border-bottom: 0; }
.tq .tq-feed__ic { width: 28px; height: 28px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--well); color: var(--primary); }
.tq .tq-feed__ic svg.tq-i { width: 13px; height: 13px; }
.tq .tq-feed p { font-size: 15px; font-weight: 500; line-height: 21px; }
.tq .tq-feed p b { font-weight: 700; }
.tq .tq-feed code { font: 500 14px/19.6px var(--mono); border-bottom: 1px dashed var(--line-2); }
.tq .tq-feed small { display: block; margin-top: 1px; font-size: 14px; font-weight: 500; line-height: 19.6px; color: var(--muted); }
.tq .tq-tone-orange { background: var(--orange); }
.tq .tq-tone-sky { background: var(--sky); }
.tq .tq-tone-teal { background: var(--teal); }
.tq .tq-tone-violet { background: var(--violet); }
.tq .tq-tone-lime { background: var(--lime); }
.tq .tq-tone-bad { background: var(--bad); }
.tq .tq-tone-amber { background: var(--amber); }
@keyframes tq-flash { 0% { color: var(--primary); } to { color: inherit; } }
@container tq (max-width: 760px) {
  .tq .tq-head { flex-direction: column; align-items: stretch; gap: 0; margin-top: 18px; }
  .tq .tq-head__eyebrow { font-size: 14px; line-height: 21px; }
  .tq .tq-head__title { font-size: 34px; line-height: 37px; letter-spacing: -1.2px; }
  .tq .tq-head__actions { display: grid; grid-template-columns: 1fr 1fr; margin: 14px 0 0; }
  .tq .tq-head__actions .tq-btn { height: 44px; font-size: 16px; }
  .tq .tq-fl-board .tq-card__h .tq-ibtn, .tq .tq-fl-sales .tq-card__h .tq-ibtn { display: none; }
  .tq .tq-stats { grid-template-columns: 1fr 1fr; gap: 11px 10px; margin-top: 22px; }
  .tq .tq-stat { height: 94px; padding: 11px 13px; border-radius: 18px; gap: 4px; }
  .tq .tq-stat .tq-ic { display: none; }
  .tq .tq-stat__h { font-size: 13px; line-height: 19.5px; }
  .tq .tq-stat__v { font-size: 24px; line-height: 26px; letter-spacing: -.6px; }
  .tq .tq-stat__v small { font-size: 14px; }
  .tq .tq-chip { height: 18px; font-size: 12px; padding: 0 6px; }
  .tq .tq-fl-bays { height: 410px; margin-top: 22px; }
  .tq .tq-bays { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; margin: 14px -21px 0; padding: 0 3px; }
  .tq .tq-bay { flex: none; width: 243px; }
  .tq .tq-card__aside { font-size: 13px; }
  .tq .tq-fl-board { height: 829px; margin-top: 15px; }
  .tq .tq-lanes { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; margin: 15px -21px 0; padding: 0 3px; }
  .tq .tq-lane { flex: none; width: 250px; }
  .tq .tq-fl-board .tq-card__aside { display: none; }
  .tq .tq-fl-r3, .tq .tq-fl-r4 { display: contents; }
  .tq .tq-fl-r3 > .tq-card, .tq .tq-fl-r4 > .tq-card { margin-top: 16px; }
  .tq .tq-fl-arr { height: 550px !important; }
  .tq .tq-fl-sales { height: 418px !important; }
  .tq .tq-fl-techs { height: 470px !important; }
  .tq .tq-fl-load { height: 466px !important; order: 1; }
  .tq .tq-fl-stock { height: 473px !important; order: 2; }
  .tq .tq-fl-feed { height: 576px !important; order: 3; }
  .tq .tq-arr { margin-top: 16px; }
  .tq .tq-arr li { grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto; align-content: center; height: 91px; }
  .tq .tq-arr__t { grid-column: 1; grid-row: 1; font-size: 13px; line-height: 18px; color: var(--primary); }
  .tq .tq-arr__who { grid-column: 1; grid-row: 2; }
  .tq .tq-arr li .tq-btn { grid-column: 2; grid-row: 1 / span 2; }
  .tq .tq-tech { height: 75.5px; }
  .tq .tq-tech small { margin-top: 2px; }
  .tq .tq-gauge { margin-top: 18px; }
  .tq .tq-load__tiles { grid-template-columns: 1fr; gap: 0; border-radius: var(--r-tile); overflow: hidden; border: 1px solid var(--line); }
  .tq .tq-load__tiles div { height: 46px; display: flex; align-items: center; justify-content: space-between; border: 0; border-radius: 0; border-bottom: 1px solid var(--line); }
  .tq .tq-load__tiles b { margin: 0; font-size: 16px; }
}

/* ── la adaptación con MaKo (6/11/2026) ──────────────────────────────────────────────────────────────────────── */
/* Los altos de Torque son los de SU contenido: aquí son el mínimo, y lo que trae más (un nombre largo, un proyecto más) estira la tarjeta
   en vez de cortarse. El tablero mide lo que mide su columna más llena. */
.tq .tq-fl-bays { height: auto; min-height: 406px; }
.tq .tq-fl-board { height: auto; }
.tq .tq-lanes { height: auto; min-height: 260px; }
.tq .tq-fl-r3 > .tq-card { height: auto; min-height: 575px; }
.tq .tq-fl-r4 > .tq-card { height: auto; min-height: 576px; }

/* Lo que la copia no tiene: el vacío, lo que no llegó y lo que se toca. */
.tq .tq-sin { opacity: .5; }
.tq .tq-vacio { margin-top: 14px; font-size: 14px; font-weight: 500; line-height: 21px; color: var(--muted); }
.tq .tq-c-vacia { margin-top: 22px; }
.tq .tq-c-vacia .tq-vacio { max-width: 560px; }
.tq .tq-quieta { cursor: default; pointer-events: none; }
.tq [role='button'] { cursor: pointer; }
.tq .tq-chip--nada { background: transparent; padding: 0; color: var(--faint); font-weight: 600; }
.tq .tq-card__btn { margin-left: auto; }
.tq .tq-bay__u { font-size: 13px; font-weight: 600; color: var(--muted); }
.tq .tq-lane__n { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.tq .tq-lane__nada { padding: 6px 4px; font-size: 13px; font-weight: 500; line-height: 19.5px; color: var(--muted); }
.tq .tq-jc__tag--ok { background: color-mix(in srgb, var(--good) 15%, transparent); color: var(--good); }
.tq .tq-jc__own { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tq .tq-tech__h b { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tq .tq-feed li[role='button']:hover p b, .tq .tq-stock li[role='button']:hover b { text-decoration: underline; }
.tq .tq-head__title > span > span { will-change: transform; }
.tq .tq-stat__h { white-space: nowrap; min-width: 0; }
.tq .tq-stock li { height: auto; min-height: 76px; padding: 8px 0; }
.tq .tq-card__t { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.tq .tq-card__h > .tq-btn, .tq .tq-card__h > .tq-seg { flex: none; }
.tq .tq-seg__btn { white-space: nowrap; }
.tq .tq-fl-sales .tq-card__t { min-width: 0; overflow: hidden; text-overflow: ellipsis; }

/* El paso del medio: con la barra de MaKo al lado, el contenido mide ~900 px. Las cuatro tarjetas van de a dos, los proyectos de a tres,
   el tablero se corre de costado (cada columna, 212 px como en Torque) y «Quién vende» va a lo ancho. */
@container tq (max-width: 1100px) {
  .tq .tq-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tq .tq-bays { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tq .tq-lanes { display: flex; overflow-x: auto; scrollbar-width: thin; }
  .tq .tq-lane { flex: none; width: 212px; }
  .tq .tq-fl-r3 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .tq .tq-fl-techs { grid-column: 1 / -1; }
  .tq .tq-fl-r3 > .tq-fl-techs { min-height: 0; }
  .tq .tq-fl-r4 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .tq .tq-fl-feed { grid-column: 1 / -1; }
  .tq .tq-fl-r4 > .tq-fl-feed { min-height: 0; }
}

/* El teléfono: los altos de la captura de 390 son el mínimo; el orden de la copia (la carga antes del stock). */
@container tq (max-width: 760px) {
  .tq .tq-cuerpo { display: flex; flex-direction: column; margin: 0 -12px; }
  .tq .tq-stats { grid-template-columns: 1fr 1fr; }
  .tq .tq-bays { display: flex; }
  .tq .tq-lanes { display: flex; }
  .tq .tq-lane { width: 250px; }
  .tq .tq-fl-r3 > .tq-fl-arr { height: auto !important; min-height: 550px; }
  .tq .tq-fl-r3 > .tq-fl-sales { height: auto !important; min-height: 418px; }
  .tq .tq-fl-r3 > .tq-fl-techs { height: auto !important; min-height: 0; }
  .tq .tq-fl-r4 > .tq-fl-load { height: auto !important; min-height: 466px; }
  .tq .tq-fl-r4 > .tq-fl-stock { height: auto !important; min-height: 0; }
  .tq .tq-fl-r4 > .tq-fl-feed { height: auto !important; min-height: 0; }
  .tq .tq-c-vacia { padding: 16px; }
}

/* Con «reducir movimiento», y en la miniatura de «Nueva hoja», quietas. */
@media (prefers-reduced-motion: reduce) {
  .tq .tq-seg__pill, .tq .tq-btn, .tq .tq-jc { transition: none; }
}

/* La cabecera de «Los que avanzan»: el número no se parte ni le come el título. */
.tq .tq-card__aside { white-space: nowrap; flex: none; }
`;
