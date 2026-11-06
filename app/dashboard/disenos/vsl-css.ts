// =============================================================================
// vsl-css — la hoja de estilos de la hoja «VSL y YouTube» con su diseño propio (la copia de Pelago)
// =============================================================================
// GENERADA por el armador del chat de los dashboards (scratchpad/tools/armar-pel.py) desde la hoja de la copia
// (docs/diseno/mockups-dashboard/vsl-pelago/pelago.css): todo adentro de .pel, cada clase con el prefijo pel-, sin el armazón de Pelago
// (la barra de la izquierda, la de arriba y la del teléfono, el interruptor de comparar con el año pasado), los resets por etiqueta con
// :where() y con @container en lugar de @media. Lo de la adaptación va al final (el paso del medio, los vacíos y lo que se toca). Se
// escribió desde lo MEDIDO del demo: nada del código de la tienda.
// Paleta doble (6/11/2026, Martín: «los que vienen en dark mode deben acompañar siempre el white mode si el usuario lo tiene así en MaKo, y si
// tiene dark mode, automáticamente pasarse a allí»): claro por defecto y oscuro bajo [data-tema="oscuro"] de <html>, sólo con variables.
// ⚠️ En un template literal no va ningún backtick (ni en un comentario) ni un «dólar con llave».
// =============================================================================

export const CSS_VSL = `
@font-face { font-family: 'Pelago Manrope'; font-style: normal; font-weight: 200 800; font-display: swap; src: url(https://fonts.gstatic.com/s/manrope/v23/xn7gYHE41ni1AdIRggexSg.woff2) format('woff2'); }
@font-face { font-family: 'Pelago Geist Mono'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrcdmg.woff2) format('woff2'); }
.pel {
  container-type: inline-size; container-name: pel;
  --font: 'Pelago Manrope', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono: 'Pelago Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  --bg: #eeebe4;
  --glow-a: #dcebe6;
  --glow-b: #f5e7cc;
  --surface: #fcfbf8;
  --surface-2: #f4f2ed;
  --raised: #fffefb;
  --well: #201c160f;
  --line: #201c1617;
  --line-2: #201c162b;
  --shadow: 0 1px 1px #201c160a, 0 10px 26px -18px #201c1647;
  --shadow-pop: 0 24px 60px -18px #201c164d, 0 2px 6px #201c1614;
  --text: #1b1a17;
  --muted: #5d5a53;
  --faint: #7a766e;
  --primary: #136469;
  --on-primary: #f2faf8;
  --glaze-a: #1a7a7d;
  --glaze-b: #0e4448;
  --side: #f8f6f1;
  --on-side: #2a2823;
  --side-dim: #6c685f;
  --pill: #e3ece9;
  --petrol: #136469;
  --ochre: #c88e1c;
  --clay: #b85a36;
  --rose: #c4425a;
  --sand: #9a7b4f;
  --moss: #5a8a2c;
  --sky: #2b78b0;
  --slate: #6c737c;
  --good: #156b41;
  --warn: #7a5103;
  --bad: #b8344c;
  --av-rose: #f2d3da;
  --av-ochre: #f3e1bd;
  --av-sea: #d4ece8;
  --av-moss: #dfeccf;
  --paid-ink: #17403f;
  --dial-sp: #3a3732;
  --dial-dot: #d6d3cc;
  --ly: #5d5a53;
  --r-card: 22px;
  --r-tile: 14px;
  --gap: 16px;
  --side-w: 256px;
  --gutter: clamp(16px, 1.8vw, 30px);
  --ease: cubic-bezier(.2, .8, .2, 1);
  position: relative; padding: 4px 26px 56px; color: var(--text); background: radial-gradient(1200px 520px at 100% -10%, var(--glow-b), transparent 60%), radial-gradient(900px 600px at 30% -20%, var(--glow-a), transparent 60%), var(--bg); font: 500 15px/22.5px var(--font); -webkit-font-smoothing: antialiased;
}
/* Oscuro: la tarjeta esmaltada (pel-glazed) y el botón primario conservan su verde petróleo en los dos modos; todo lo demás sube de luz. */
.pel:where([data-tema="oscuro"] *) {
  --bg: #121110;
  --glow-a: #14211f;
  --glow-b: #221c10;
  --surface: #1b1a17;
  --surface-2: #232220;
  --raised: #2c2b27;
  --well: #262521;
  --line: #2e2c28;
  --line-2: #403d37;
  --shadow: 0 1px 1px #00000066, 0 10px 26px -18px #000000cc;
  --shadow-pop: 0 24px 60px -18px #000000e6, 0 2px 6px #00000080;
  --text: #ece9e2;
  --muted: #aaa69d;
  --faint: #8d897f;
  --primary: #45b4b7;
  --petrol: #45b4b7;
  --ochre: #e0aa3a;
  --clay: #dc7d54;
  --rose: #e5667e;
  --sand: #bd9a6b;
  --moss: #86b755;
  --sky: #5ca8db;
  --slate: #99a1aa;
  --good: #5fcf92;
  --warn: #e6b350;
  --bad: #f27a8e;
  --av-rose: #4b2a33;
  --av-ochre: #4a3a1b;
  --av-sea: #1f3f3c;
  --av-moss: #2f3f22;
  --paid-ink: #c3e6e4;
  --dial-sp: #c9c6be;
  --dial-dot: #4a4843;
  --ly: #aaa69d;
}

/* ── la copia ─────────────────────────────────────────────────────────────────────────────────────── */
.pel *, .pel *::before, .pel *::after { box-sizing: border-box; }
.pel :where(button) { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; padding: 0; }
.pel :where(a) { color: inherit; text-decoration: none; }
.pel :where(h1), .pel :where(h2), .pel :where(h3), .pel :where(p), .pel :where(ul), .pel :where(table) { margin: 0; }
.pel :where(ul) { padding: 0; list-style: none; }
.pel svg.pel-i { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.pel :focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.pel .pel-av { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border-radius: 50%; font-size: 12px; font-weight: 800; letter-spacing: .12px; color: var(--text); }
.pel .pel-ibtn { position: relative; width: 46px; height: 46px; display: grid; place-items: center; border-radius: 50%; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); transition: background-color .15s; }
.pel .pel-ibtn:hover { background: var(--surface-2); }
.pel .pel-btn { height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 0 20px; border-radius: 99px; font-size: 16px; font-weight: 700; line-height: 24px; white-space: nowrap; transition: transform .3s var(--ease); }
.pel .pel-btn:active { filter: brightness(.93); }
.pel .pel-btn--primary { background: linear-gradient(180deg, var(--glaze-a), var(--glaze-b)); color: var(--on-primary); box-shadow: inset 0 -2px 0 #00000024, inset 0 1px 0 #ffffff26, 0 10px 22px -12px var(--glaze-b); }
.pel .pel-btn--primary:hover { filter: brightness(1.1); }
.pel .pel-btn--ghost { background: var(--surface); color: var(--text); border: 1px solid var(--line-2); }
.pel .pel-btn--ghost:hover { background: var(--surface-2); }
.pel .pel-btn--xs { height: 32px; padding: 0 13px; gap: 7px; font-size: 14px; }
.pel .pel-btn--soft { background: color-mix(in srgb, var(--primary) 17%, transparent); color: var(--primary); border: 0; }
.pel .pel-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-top: 22px; }
.pel .pel-head__date { font-size: 15px; font-weight: 650; line-height: 22.5px; color: var(--muted); }
.pel .pel-head__title { margin-top: 4px; font-size: 37.44px; font-weight: 800; line-height: 40.4352px; letter-spacing: -1.4976px; }
.pel .pel-head__lede { margin-top: 17px; max-width: 730px; font-size: 16px; font-weight: 500; line-height: 24px; color: var(--muted); }
.pel .pel-head__lede b { font-weight: 750; color: var(--text); }
.pel .pel-head__actions { display: flex; align-items: center; gap: 10px; margin-bottom: 61px; }
.pel .pel-ov { display: grid; gap: var(--gap); margin-top: 19px; }
.pel .pel-ov__r1 { display: grid; grid-template-columns: minmax(0, 462fr) minmax(0, 367fr) minmax(0, 271fr); gap: var(--gap); }
.pel .pel-ov__r3 { display: grid; grid-template-columns: minmax(0, 654fr) minmax(0, 462fr); gap: var(--gap); }
.pel .pel-ov__r4 { display: grid; grid-template-columns: minmax(0, 462fr) minmax(0, 654fr); gap: var(--gap); }
.pel .pel-card { position: relative; min-width: 0; padding: 20px; border-radius: var(--r-card); background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); }
.pel .pel-card__h { display: flex; align-items: center; gap: 12px; min-height: 38px; }
.pel .pel-card__ic { width: 32px; height: 32px; flex: none; display: grid; place-items: center; border-radius: 10px; background: color-mix(in srgb, var(--primary) 11%, transparent); color: var(--primary); }
.pel .pel-card__t { font-size: 18px; font-weight: 800; line-height: 27px; letter-spacing: -.36px; white-space: nowrap; }
.pel .pel-card__h > .pel-card__aside { margin-left: auto; }
.pel .pel-card__sub { margin-left: auto; font-size: 14px; font-weight: 600; color: var(--muted); }
.pel .pel-ov-rev, .pel .pel-ov-today, .pel .pel-ov-kiln { height: 506px; }
.pel .pel-glazed { overflow: hidden; color: var(--on-primary); border-color: transparent; background: radial-gradient(260px 200px at 30% 22%, #ffffff1f, transparent 70%), linear-gradient(165deg, #237f82 0%, var(--glaze-a) 30%, #13585b 70%, var(--glaze-b) 100%); box-shadow: inset 0 1px 0 #ffffff2e, inset 0 -3px 0 #00000029, 0 22px 40px -24px var(--glaze-b); }
.pel .pel-glazed::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 6px 6px, #ffffff24 1.1px, transparent 1.7px) 0 0 / 11px 11px; }
.pel .pel-glazed > * { position: relative; }
.pel .pel-rev__h { display: flex; align-items: center; justify-content: space-between; min-height: 38px; }
.pel .pel-rev__t { font-size: 17px; font-weight: 750; line-height: 25.5px; letter-spacing: -.34px; }
.pel .pel-rev__p { font-size: 14px; font-weight: 600; color: #f3f5ffc2; }
.pel .pel-rev__big { display: flex; align-items: center; gap: 14px; margin-top: 10px; }
.pel .pel-rev__v { font-size: 63.36px; font-weight: 800; line-height: 60.192px; letter-spacing: -3.4848px; }
.pel .pel-rev__chg { height: 30px; display: inline-flex; align-items: center; gap: 6px; padding: 0 11px; border-radius: 99px; background: #ecf3f2; color: #1d6b45; font-size: 14px; font-weight: 800; }
.pel .pel-rev__chg svg.pel-i { width: 14px; height: 14px; stroke-width: 2.2; }
.pel .pel-rev__vs { margin-top: 6px; font-size: 14px; font-weight: 600; line-height: 21px; color: #f3f5ffc2; }
.pel .pel-rev__bars { display: flex; align-items: flex-end; gap: 3px; height: 120px; margin-top: 20px; }
.pel .pel-rev__bars i { flex: 1; min-width: 0; border-radius: 3px 3px 1px 1px; background: #ffffff52; transform-origin: bottom; }
.pel .pel-rev__bars i.pel-is-hi { background: #f2c25a; }
.pel .pel-rev__mix { display: flex; gap: 4px; height: 12px; margin-top: 20px; }
.pel .pel-rev__mix span { border-radius: 99px; transform-origin: left; }
.pel .pel-rev__leg { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 10px; font-size: 14px; font-weight: 600; line-height: 21px; color: #f3f5ffd1; }
.pel .pel-rev__leg span { display: inline-flex; align-items: center; gap: 7px; }
.pel .pel-rev__leg i { width: 8px; height: 8px; border-radius: 2px; }
.pel .pel-rev__leg b { font-weight: 800; color: #fff; }
.pel .pel-rev__stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; margin-top: 12px; padding-top: 17px; border-top: 1px solid #ffffff2b; }
.pel .pel-rev__stats span { display: block; font-size: 13px; font-weight: 650; line-height: 19.5px; color: #f3f5ffb8; }
.pel .pel-rev__stats b { display: block; margin-top: 1px; font-size: 22px; font-weight: 800; line-height: 33px; letter-spacing: -.66px; color: var(--on-primary); }
.pel .pel-t-sea { background: #e6f4f1; }
.pel .pel-t-gold { background: #f2c25a; }
.pel .pel-t-salmon { background: #f2a07a; }
.pel .pel-ov-today { display: flex; flex-direction: column; }
.pel .pel-dial { position: relative; width: 280px; height: 250px; margin: 4px auto 0; flex: none; }
.pel .pel-dial svg { width: 100%; height: 100%; overflow: visible; }
.pel .pel-dial__lab { font: 700 11px var(--font); fill: var(--text); }
.pel .pel-dial__ring { fill: none; stroke: var(--line-2); stroke-width: 1.4; stroke-dasharray: 1 5; stroke-linecap: round; }
.pel .pel-dial__sp { stroke: var(--dial-sp); stroke-width: 7; stroke-linecap: round; transition: opacity .2s; }
.pel .pel-dial__sp.pel-is-now { stroke: var(--primary); }
.pel .pel-dial__dot { fill: var(--dial-dot); }
.pel .pel-dial__pulse { fill: none; stroke: var(--primary); animation: pel-dial-pulse 1.8s var(--ease) infinite; }
.pel .pel-dial__mid { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; pointer-events: none; }
.pel .pel-dial__mid b { font-size: 36px; font-weight: 800; line-height: 36px; letter-spacing: -1.44px; }
.pel .pel-dial__mid span { margin-top: 5px; font-size: 14px; font-weight: 650; line-height: 21px; color: var(--muted); }
.pel .pel-today__foot { margin-top: auto; padding: 0 0 1px; text-align: center; font-size: 14px; font-weight: 500; line-height: 21px; color: var(--muted); }
.pel .pel-today__foot b { font-weight: 700; color: var(--text); }
.pel .pel-ov-kiln { overflow: hidden; }
.pel .pel-kiln__lab { margin-top: 16px; font-size: 13px; font-weight: 750; line-height: 19.5px; letter-spacing: .91px; text-transform: uppercase; color: var(--muted); }
.pel .pel-kiln__lab + .pel-kiln__list { margin: 4px -23px 0 -6px; }
.pel .pel-kiln__lab--2 { margin-top: 7px; }
.pel .pel-kiln__list > div { display: grid; grid-template-columns: minmax(0, 1fr) 32px; align-items: center; column-gap: 8px; height: 60px; }
.pel .pel-kiln__row { width: 100%; min-width: 0; height: 56px; display: flex; align-items: center; gap: 12px; padding: 0 0 0 6px; text-align: left; border-radius: 12px; }
.pel .pel-kiln__row:active { background: var(--well); }
.pel .pel-kiln__th { width: 34px; height: 34px; flex: none; border-radius: 9px; }
.pel .pel-kiln__row b { display: block; font-size: 15px; font-weight: 700; line-height: 18.75px; white-space: nowrap; }
.pel .pel-kiln__row small { display: block; margin-top: 4px; font-size: 13px; font-weight: 500; line-height: 16px; color: var(--muted); }
.pel .pel-kiln__list .pel-ibtn { width: 32px; height: 32px; box-shadow: none; background: transparent; border-color: var(--line-2); color: var(--text); }
.pel .pel-kiln__list .pel-ibtn--add { color: var(--primary); border-color: color-mix(in srgb, var(--primary) 30%, transparent); }
.pel .pel-gl-tide { background: radial-gradient(circle at 32% 28%, #8fd3cf 0, #2f8f8f 34%, #0f4a4d 78%); }
.pel .pel-gl-celadon { background: radial-gradient(circle at 32% 28%, #e3f1df 0, #a9cf9d 40%, #6f9f64 85%); }
.pel .pel-gl-tenmoku { background: radial-gradient(circle at 70% 26%, #f2a065 0, #b65a29 38%, #4a1d0e 82%); }
.pel .pel-gl-oat { background: radial-gradient(circle, #a9875f55 1px, transparent 1.6px) 0 0 / 6px 6px, linear-gradient(160deg, #f1dcc0, #d9b98f); }
.pel .pel-gl-stone { background: radial-gradient(circle, #6e6a6366 1px, transparent 1.6px) 0 0 / 6px 6px, linear-gradient(160deg, #cfccc6, #a8a49c); }
.pel .pel-ov-demand { height: 576px; }
.pel .pel-dem__h { display: flex; align-items: center; gap: 12px; min-height: 38px; }
.pel .pel-dem__leg { margin-left: auto; display: flex; align-items: center; gap: 15px; font-size: 14px; font-weight: 600; color: var(--muted); }
.pel .pel-dem__leg span { display: inline-flex; align-items: center; gap: 7px; }
.pel .pel-dem__leg i { width: 10px; height: 10px; border-radius: 3px; }
.pel .pel-dem__leg i.pel-dash { background: none; border: 1.5px dashed var(--faint); }
.pel .pel-dem__body { display: grid; grid-template-columns: 236px minmax(0, 1fr) 270px; gap: 0; margin-top: 15px; height: 476px; }
.pel .pel-rail { position: relative; display: grid; align-content: start; gap: 2px; }
.pel .pel-rail__pill { position: absolute; left: 0; top: 0; width: 100%; height: 51px; border-radius: 16px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line-2); transition: transform .35s var(--ease); }
.pel .pel-rail__item { position: relative; height: 51px; display: flex; align-items: center; gap: 12px; padding: 0 12px 0 10px; border-radius: 16px; text-align: left; }
.pel .pel-rail__item:hover { background: var(--well); }
.pel .pel-rail__item[aria-selected='true']:hover { background: none; }
.pel .pel-rail__ic { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border-radius: 10px; }
.pel .pel-rail__item b { display: block; font-size: 15px; font-weight: 700; line-height: 18.75px; white-space: nowrap; }
.pel .pel-rail__item[aria-selected='true'] b { font-weight: 800; }
.pel .pel-rail__item small { display: block; font-size: 13px; font-weight: 600; line-height: 16.25px; color: var(--muted); }
.pel .pel-rail__sp { margin-left: auto; width: 56px; height: 22px; flex: none; }
.pel .pel-chart { position: relative; margin: 0 26px 0 14px; }
.pel .pel-chart svg { display: block; width: 100%; height: 100%; overflow: visible; }
.pel .pel-chart__ax { font: 600 12px var(--font); fill: var(--muted); }
.pel .pel-chart__x { font: 650 12px var(--font); fill: var(--muted); }
.pel .pel-chart__x.pel-is-hi { font-weight: 800; fill: var(--text); }
.pel .pel-chart__grid { stroke: var(--line-2); stroke-dasharray: 1 5; stroke-linecap: round; }
.pel .pel-chart__col { cursor: pointer; }
.pel .pel-chart__col .pel-seg-dot { opacity: 1; transition: opacity .2s; }
.pel .pel-chart__col .pel-seg-solid { opacity: 0; transition: opacity .2s; }
.pel .pel-chart__col:hover .pel-seg-dot, .pel .pel-chart__col.pel-is-hi .pel-seg-dot { opacity: 0; }
.pel .pel-chart__col:hover .pel-seg-solid, .pel .pel-chart__col.pel-is-hi .pel-seg-solid { opacity: 1; }
.pel .pel-chart__ly { fill: none; stroke: var(--ly); stroke-width: 1.3; stroke-dasharray: 3 3; }
.pel .pel-chart__pace { fill: none; stroke: var(--primary); stroke-width: 1.6; stroke-dasharray: 4 3; }
.pel .pel-chart__tip { position: absolute; transform: translate(-50%, -100%); padding: 5px 10px; border-radius: 99px; background: var(--text); color: var(--bg); font-size: 14px; font-weight: 900; line-height: 21px; white-space: nowrap; pointer-events: none; transition: left .3s var(--ease), top .3s var(--ease); }
.pel .pel-chart__tip::after { content: ''; position: absolute; left: 50%; bottom: -5px; width: 10px; height: 10px; background: inherit; transform: translateX(-50%) rotate(45deg); border-radius: 2px; z-index: -1; }
.pel .pel-mp { border-left: 1px solid var(--line); padding: 0 0 0 20px; display: flex; flex-direction: column; }
.pel .pel-mp__h { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 15px; font-weight: 750; line-height: 22.5px; }
.pel .pel-mp__soft { height: 24px; display: inline-flex; align-items: center; padding: 0 9px; border-radius: 99px; background: color-mix(in srgb, var(--good) 13%, transparent); color: var(--good); font-size: 13px; font-weight: 750; }
.pel .pel-mp__cat { margin-top: 6px; font-size: 15px; font-weight: 500; line-height: 22.5px; color: var(--muted); }
.pel .pel-mp__v { margin-top: 9px; font-size: 40px; font-weight: 800; line-height: 40px; letter-spacing: -1.8px; }
.pel .pel-mp__chg { align-self: flex-start; height: 26px; display: inline-flex; align-items: center; gap: 6px; margin-top: 7px; padding: 0 11px; border-radius: 99px; background: color-mix(in srgb, var(--bad) 14%, transparent); color: var(--bad); font-size: 13px; font-weight: 750; }
.pel .pel-mp__chg svg.pel-i { width: 13px; height: 13px; stroke-width: 2.2; }
.pel .pel-mp__ch { margin-top: 15px; display: grid; gap: 10.5px; }
.pel .pel-mp__row { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; column-gap: 10px; align-items: center; font-size: 15px; font-weight: 600; line-height: 18px; color: var(--muted); }
.pel .pel-mp__row i { width: 10px; height: 10px; border-radius: 3px; }
.pel .pel-mp__row b { font-weight: 800; color: var(--text); }
.pel .pel-mp__row .pel-meter { grid-column: 2 / 4; height: 6px; margin-top: 6px; border-radius: 99px; background: var(--well); overflow: hidden; }
.pel .pel-mp__row .pel-meter span { display: block; height: 100%; border-radius: inherit; transform-origin: left; }
.pel .pel-mp__stub { position: relative; margin-top: 14px; display: grid; gap: 8px; padding: 12px 14px; height: 97px; border-radius: 16px; background: var(--surface-2); border: 1px solid var(--line); }
.pel .pel-mp__stub + .pel-mp__stub { margin-top: 8px; }
.pel .pel-mp__stub::before, .pel .pel-mp__stub::after { content: ''; position: absolute; top: 50%; width: 10px; height: 14px; margin-top: -7px; background: var(--surface); border: 1px solid var(--line); }
.pel .pel-mp__stub::before { left: -1px; border-left: 0; border-radius: 0 8px 8px 0; }
.pel .pel-mp__stub::after { right: -1px; border-right: 0; border-radius: 8px 0 0 8px; }
.pel .pel-mp__lab { font-size: 13px; font-weight: 750; line-height: 16px; letter-spacing: .91px; text-transform: uppercase; color: var(--muted); }
.pel .pel-mp__who { display: flex; align-items: center; gap: 12px; }
.pel .pel-mp__who .pel-av { width: 40px; height: 40px; font-size: 14px; background: var(--av-moss); }
.pel .pel-mp__who .pel-kiln__th { width: 40px; height: 40px; border-radius: 10px; }
.pel .pel-mp__who b { display: block; font-size: 15px; font-weight: 700; line-height: 20px; }
.pel .pel-mp__who small { display: block; margin-top: 2px; font-size: 14px; font-weight: 500; line-height: 20px; color: var(--muted); }
.pel .pel-ov-orders, .pel .pel-ov-best { height: 524px; }
.pel .pel-table { width: calc(100% + 12px); margin: 20px -6px 0; border-collapse: collapse; }
.pel .pel-table th { height: 37px; padding: 6px 12px 0; text-align: left; font-size: 13px; font-weight: 750; line-height: 19.5px; letter-spacing: .78px; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--line); vertical-align: top; }
.pel .pel-table th:last-child, .pel .pel-table td:last-child { text-align: right; }
.pel .pel-table td { height: 64.6px; padding: 0 12px; border-bottom: 1px solid var(--line); font-size: 15px; font-weight: 650; line-height: 22.5px; }
.pel .pel-table tr:last-child td { border-bottom: 0; }
.pel .pel-table tbody tr { cursor: pointer; transition: background-color .15s; }
.pel .pel-table tbody tr:hover { background: var(--surface-2); }
.pel .pel-table tbody tr:active { background: var(--well); }
.pel .pel-ord { display: flex; align-items: center; gap: 12px; }
.pel .pel-ord .pel-av { width: 28px; height: 28px; font-size: 11px; }
.pel .pel-ord code { display: block; font: 700 13.8px/20.7px var(--mono); letter-spacing: -.138px; }
.pel .pel-ord small { display: block; font-size: 14px; font-weight: 500; line-height: 21px; color: var(--muted); }
.pel .pel-chan { display: inline-flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 500; color: var(--muted); }
.pel .pel-chan svg.pel-i { width: 13px; height: 13px; color: var(--primary); }
.pel .pel-paid { height: 30px; display: inline-flex; align-items: center; gap: 7px; padding: 0 11px; border-radius: 99px; background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--paid-ink); font-size: 14px; font-weight: 700; }
.pel .pel-paid i { width: 6px; height: 6px; border-radius: 50%; background: var(--primary); }
.pel .pel-td-total { font-weight: 800; }
.pel .pel-av.pel-t-rose { background: var(--av-rose); }
.pel .pel-av.pel-t-ochre { background: var(--av-ochre); }
.pel .pel-av.pel-t-sea { background: var(--av-sea); }
.pel .pel-best { margin-top: 14px; display: grid; gap: 0; }
.pel .pel-best__row { width: 100%; height: 71px; display: grid; grid-template-columns: 22px 38px minmax(0, 1fr); align-items: center; column-gap: 12px; padding: 0 6px 0 4px; text-align: left; border-radius: 14px; }
.pel .pel-best__row:active { background: var(--well); }
.pel .pel-best__n { text-align: center; font-size: 15px; font-weight: 800; color: var(--muted); }
.pel .pel-best__row .pel-kiln__th { width: 38px; height: 38px; border-radius: 10px; }
.pel .pel-best__m { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; row-gap: 5px; }
.pel .pel-best__m b { font-size: 15px; font-weight: 650; line-height: 18px; }
.pel .pel-best__m em { font-style: normal; font-size: 15px; font-weight: 800; line-height: 18px; }
.pel .pel-best__m .pel-meter { grid-column: 1 / 3; height: 5px; border-radius: 99px; background: var(--well); overflow: hidden; }
.pel .pel-best__m .pel-meter span { display: block; height: 100%; border-radius: inherit; background: var(--primary); transform-origin: left; }
.pel .pel-best__m small { grid-column: 1 / 3; font-size: 13px; font-weight: 500; line-height: 16px; color: var(--muted); }
.pel .pel-ov-margin, .pel .pel-ov-feed { height: 488px; }
.pel .pel-mg__big { display: flex; align-items: baseline; gap: 12px; margin-top: 15px; }
.pel .pel-mg__big b { font-size: 40px; font-weight: 800; line-height: 40px; letter-spacing: -2px; color: var(--good); }
.pel .pel-mg__big span { max-width: 240px; font-size: 15px; font-weight: 500; line-height: 20.25px; color: var(--muted); }
.pel .pel-mg__bar { display: flex; gap: 3px; height: 22px; margin-top: 18px; }
.pel .pel-mg__bar span { border-radius: 6px; transform-origin: left; }
.pel .pel-mg__bar .pel-keep { background: repeating-linear-gradient(135deg, #5f9a7e 0 4px, #a8cdb9 4px 8px); }
.pel .pel-mg__leg { display: grid; grid-template-columns: 201px minmax(0, 1fr); column-gap: 34px; margin-top: 11px; }
.pel .pel-mg__leg li { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; column-gap: 8px; align-items: center; height: 28.5px; font-size: 15px; font-weight: 600; color: var(--muted); }
.pel .pel-mg__leg i { width: 9px; height: 9px; border-radius: 2px; }
.pel .pel-mg__leg b { font-weight: 800; color: var(--text); }
.pel .pel-feed { margin-top: 16px; }
.pel .pel-feed li { display: flex; gap: 12px; height: 65.5px; padding-top: 11px; border-bottom: 1px solid var(--line); }
.pel .pel-feed li:last-child { border-bottom: 0; }
.pel .pel-feed__ic { width: 32px; height: 32px; flex: none; display: grid; place-items: center; margin-top: -1px; border-radius: 50%; background: var(--well); color: var(--text); }
.pel .pel-feed__ic svg.pel-i { width: 14px; height: 14px; }
.pel .pel-feed a { display: block; font-size: 15px; font-weight: 650; line-height: 22.5px; }
.pel .pel-feed a:hover { text-decoration: underline; }
.pel .pel-feed small { display: block; margin-top: 4px; font-size: 14px; font-weight: 500; line-height: 18px; color: var(--muted); }
.pel .pel-tone-petrol { background: var(--petrol); }
.pel .pel-tone-ochre { background: var(--ochre); }
.pel .pel-tone-clay { background: var(--clay); }
.pel .pel-tone-rose { background: var(--rose); }
.pel .pel-tone-sand { background: var(--sand); }
.pel .pel-tone-sky { background: var(--sky); }
.pel .pel-tone-slate { background: var(--slate); }
.pel .pel-tone-moss { background: var(--moss); }
@keyframes pel-breathe { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--good) 45%, transparent); } 70%, to { box-shadow: 0 0 0 7px #0000; } }
@keyframes pel-dial-pulse { 0% { opacity: .9; stroke-width: 3px; } to { opacity: 0; stroke-width: .5px; } }
@container pel (max-width: 760px) {
  .pel .pel-head { display: flex; flex-direction: column; align-items: stretch; gap: 0; margin-top: 21px; }
  .pel .pel-head > div:first-child { display: contents; }
  .pel .pel-head__date { order: 1; }
  .pel .pel-head__title { order: 2; }
  .pel .pel-head__actions { order: 3; }
  .pel .pel-head__lede { order: 4; }
  .pel .pel-head__date { font-size: 14px; line-height: 21px; }
  .pel .pel-head__title { margin-top: 4px; font-size: 27px; line-height: 30px; letter-spacing: -.9px; }
  .pel .pel-head__actions { display: grid; gap: 10px; margin: 13px 0 0; }
  .pel .pel-head__actions .pel-btn--ghost { width: 100%; }
  .pel .pel-head__lede { margin-top: 8px; font-size: 15px; line-height: 23px; }
  .pel .pel-ov { gap: 12px; margin-top: 22px; }
  .pel .pel-ov__r1, .pel .pel-ov__r3, .pel .pel-ov__r4 { display: contents; }
  .pel .pel-ov-rev { order: 1; height: 394px; padding: 16px; }
  .pel .pel-ov-today { order: 2; height: 376px; padding: 16px; }
  .pel .pel-ov-demand { order: 3; height: 1024px; padding: 16px; }
  .pel .pel-ov-kiln { order: 4; height: 498px; padding: 16px; }
  .pel .pel-ov-orders { order: 5; height: 731px; padding: 16px; }
  .pel .pel-ov-best { order: 6; height: 510px; padding: 16px; }
  .pel .pel-ov-margin { order: 7; height: 394px; padding: 16px; }
  .pel .pel-ov-feed { order: 8; height: 615px; padding: 16px; }
  .pel .pel-rev__v { font-size: 46px; line-height: 46px; letter-spacing: -2.4px; }
  .pel .pel-rev__bars { height: 56px; margin-top: 16px; gap: 2px; }
  .pel .pel-rev__mix { margin-top: 20px; }
  .pel .pel-rev__leg { gap: 6px 16px; margin-top: 10px; }
  .pel .pel-rev__stats { margin-top: 16px; padding-top: 14px; }
  .pel .pel-rev__stats b { font-size: 19px; line-height: 26px; }
  .pel .pel-dem__h { flex-wrap: wrap; row-gap: 8px; column-gap: 12px; }
  .pel .pel-dem__h .pel-card__t { flex: 1 0 calc(100% - 44px); }
  .pel .pel-dem__leg { order: 3; width: 100%; margin: 0; flex-wrap: wrap; gap: 7px 16px; }
  .pel .pel-dem__h > .pel-btn { order: 2; }
  .pel .pel-dem__body { display: block; height: auto; margin-top: 11px; }
  .pel .pel-rail { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; margin: 0 -16px; padding: 0 16px; }
  .pel .pel-rail__ic { width: 30px; height: 30px; }
  .pel .pel-rail__pill { display: none; }
  .pel .pel-rail__item { flex: none; gap: 10px; padding: 0 6px 0 7px; }
  .pel .pel-rail__sp { display: none; }
  .pel .pel-chart { height: 310px; margin: 10px 0 0; }
  .pel .pel-chart__sc { position: absolute; inset: 0; overflow-x: auto; scrollbar-width: none; }
  .pel .pel-chart__axis { position: absolute; left: 0; top: 0; width: 52px; height: 100%; pointer-events: none; }
  .pel .pel-chart__sc svg { width: auto; height: 100%; }
  .pel .pel-chart .pel-chart__axis { width: 52px; }
  .pel .pel-mp { display: block; border-left: 0; border-top: 1px solid var(--line); margin-top: 11px; padding: 16px 0 0; }
  .pel .pel-mp__v { display: inline-block; vertical-align: middle; }
  .pel .pel-mp__chg { display: inline-flex; vertical-align: middle; margin: 0 0 0 10px; }
  .pel .pel-mp__stub { display: grid; }
  .pel .pel-kiln__lab + .pel-kiln__list { margin: 4px 7px 0 -6px; }
  .pel .pel-table { display: block; width: auto; margin: 16px 0 0; }
  .pel .pel-table thead { display: none; }
  .pel .pel-table tbody, .pel .pel-table tr { display: block; }
  .pel .pel-table tr { position: relative; padding: 15px 0 13px; border-bottom: 1px solid var(--line); }
  .pel .pel-table td { display: block; height: auto; padding: 0; border: 0; }
  .pel .pel-table td:nth-child(2) { display: none; }
  .pel .pel-table td:nth-child(3) { margin-top: 6px; }
  .pel .pel-table td:nth-child(4) { position: absolute; right: 0; bottom: 12px; }
  .pel .pel-table td:nth-child(5) { position: absolute; right: 0; top: 22px; }
  .pel .pel-mg__leg { grid-template-columns: 1fr; }
  .pel .pel-ov-orders .pel-card__h { flex-wrap: wrap; row-gap: 8px; }
  .pel .pel-ov-orders .pel-card__aside { order: 3; width: 100%; margin-left: 0; }
  .pel .pel-feed li { height: auto; min-height: 88px; padding: 10px 0 4px; }
}

/* ── la adaptación con MaKo (6/11/2026) ──────────────────────────────────────────────────────────────────────── */
/* Los altos de Pelago son los de SU contenido: aquí son el mínimo, y lo que trae más (un nombre largo, lo que escribió MaKo) estira la
   tarjeta en vez de cortarse. */
.pel .pel-ov-rev, .pel .pel-ov-today, .pel .pel-ov-kiln { height: auto; min-height: 506px; }
.pel .pel-ov-demand { height: auto; min-height: 576px; }
.pel .pel-dem__body { height: auto; min-height: 476px; grid-template-rows: minmax(476px, auto); }
.pel .pel-ov-orders, .pel .pel-ov-best { height: auto; min-height: 524px; }
.pel .pel-ov-margin, .pel .pel-ov-feed { height: auto; min-height: 488px; }

/* Lo que la copia no tiene: el vacío, lo que no llegó y lo que se toca. */
.pel .pel-sin { opacity: .5; }
.pel .pel-vacio { margin-top: 14px; font-size: 14px; font-weight: 500; line-height: 21px; color: var(--muted); }
.pel .pel-c-vacia { margin-top: 19px; }
.pel .pel-c-vacia .pel-vacio { max-width: 560px; }
.pel .pel-rev__nada { margin: auto; font-size: 14px; font-weight: 600; color: #f3f5ffc2; }
.pel .pel-quieta { cursor: default; pointer-events: none; }
.pel [role='button'] { cursor: pointer; }
.pel .pel-kiln__tx, .pel .pel-rail__tx, .pel .pel-mp__txt { min-width: 0; }
.pel .pel-kiln__row b, .pel .pel-kiln__row small, .pel .pel-mp__who b, .pel .pel-mp__who small, .pel .pel-best__m b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pel .pel-kiln__row:hover { background: var(--surface-2); }
.pel .pel-best__th { display: grid; place-items: center; background: color-mix(in srgb, var(--primary) 11%, transparent); color: var(--primary); font-size: 11.5px; font-weight: 800; letter-spacing: -.23px; }
.pel .pel-feed li { height: auto; min-height: 65.5px; padding-bottom: 10px; }
.pel .pel-feed li > div { min-width: 0; }
.pel .pel-feed__t { display: block; font-size: 15px; font-weight: 650; line-height: 22.5px; }
.pel .pel-mp__chg--up { background: color-mix(in srgb, var(--good) 13%, transparent); color: var(--good); }
.pel .pel-mp__who .pel-av { font-size: 13px; letter-spacing: -.3px; }
.pel .pel-mg__leg { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.pel .pel-mg__leg li { min-width: 0; white-space: nowrap; }
.pel .pel-mg__leg i.pel-keep { background: repeating-linear-gradient(135deg, #5f9a7e 0 2px, #a8cdb9 2px 4px); }
.pel .pel-tel { display: none; }

/* El paso del medio: con la barra de MaKo al lado, el contenido mide ~900 px y las tres columnas de arriba no entran (el reloj mide 280). */
@container pel (max-width: 1100px) {
  .pel .pel-ov__r1 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .pel .pel-ov-rev { grid-column: 1 / -1; min-height: 0; }
  .pel .pel-dem__h { flex-wrap: wrap; row-gap: 8px; }
  .pel .pel-dem__body { grid-template-columns: 236px minmax(0, 1fr); grid-template-rows: 476px auto; }
  .pel .pel-mp { grid-column: 1 / -1; border-left: 0; border-top: 1px solid var(--line); margin-top: 16px; padding: 16px 0 0; }
  /* El panel del tramo, abajo y a lo ancho: lo del tramo a la izquierda, los dos talones a la derecha. */
  .pel .pel-mp { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 24px; align-content: start; }
  .pel .pel-mp > * { grid-column: 1; }
  .pel .pel-mp__chg { justify-self: start; }
  .pel .pel-mp > .pel-mp__stub { grid-column: 2; grid-row: 1 / span 3; align-self: start; margin-top: 4px; }
  .pel .pel-mp > .pel-mp__stub + .pel-mp__stub { grid-row: 4 / span 2; margin-top: 8px; }
  .pel .pel-mg__leg { grid-template-columns: minmax(0, 1fr); }
  .pel .pel-ov__r3 { grid-template-columns: minmax(0, 1fr); }
  .pel .pel-ov-orders, .pel .pel-ov-best { min-height: 0; }
}

/* El teléfono: los altos de la captura de 390 son el mínimo, y la tabla no esconde los play. */
@container pel (max-width: 760px) {
  .pel .pel-ov-rev { min-height: 394px; }
  .pel .pel-ov-today { min-height: 376px; }
  .pel .pel-ov-demand, .pel .pel-ov-kiln, .pel .pel-ov-orders, .pel .pel-ov-best, .pel .pel-ov-margin, .pel .pel-ov-feed { min-height: 0; }
  .pel .pel-dem__body { min-height: 0; grid-template-rows: none; }
  .pel .pel-mp { display: block; margin-top: 11px; }
  .pel .pel-mp > .pel-mp__stub { display: grid; margin-top: 14px; }
  .pel .pel-mp > .pel-mp__stub + .pel-mp__stub { margin-top: 8px; }
  /* El margen de la copia en el teléfono es de 14 px (el de MaKo, 26). */
  .pel .pel-head, .pel .pel-ov, .pel .pel-c-vacia { margin-left: -12px; margin-right: -12px; }
  .pel .pel-tel { display: inline; }
  .pel .pel-table td:nth-child(2) { display: block; margin-top: 6px; font-size: 14px; font-weight: 600; color: var(--muted); }
  .pel .pel-table td:nth-child(3) { display: none; }
  .pel .pel-c-vacia { margin-top: 22px; padding: 16px; }
}

/* Con «reducir movimiento», y en la miniatura de «Nueva hoja», quietas. */
@media (prefers-reduced-motion: reduce) {
  .pel .pel-dial__pulse { animation: none; opacity: 0; }
  .pel .pel-rail__pill, .pel .pel-chart__tip { transition: none; }
}
.pel[data-quieta] .pel-dial__pulse { animation: none; opacity: 0; }
`;
