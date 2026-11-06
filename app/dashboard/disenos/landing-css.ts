// =============================================================================
// landing-css — la hoja de estilos del DISEÑO de la hoja Landing: la copia de Corbel, sólo de esta hoja
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco». Es docs/diseno/mockups-dashboard/landing-corbel/corbel.css (escrita desde lo MEDIDO del demo: valores.json, las
// capturas, los estados de los controles y el INFORME; nada del código de la tienda) con todo adentro de `.cb` y cada clase con
// el prefijo `cb-`, para no tocar nada del resto del Dashboard. Sin el armazón de Corbel (la marca, las pestañas, el dock): en MaKo
// lo pone la app. La arma scratchpad/corbel/armar-cb.py desde la hoja de la maqueta: se cambia la maqueta y se vuelve a armar.
//
// Lo que se suma a la copia, y es de la adaptación (landing-corbel/mako.html): el período en lugar del selector de canal, la frase
// en lugar de la fecha, el «hoy» en lugar del «live now», los vacíos, los links que son botones y el medio de 761 a 1040, que
// Corbel no tiene medido (sus capturas son 1440 y 390). El fondo que se mueve (las tres manchas) va acá, adentro de la hoja.
//
// ⚠️ LA LETRA ES URBANIST, que en MaKo se llama «Geist» (app/globals.css): por eso acá dice 'Geist' y no carga nada.
// ⚠️ ESTA HOJA ES SÓLO DE LANDING: otra hoja con diseño escribe la suya (la de su demo), no reusa ésta.
// ⚠️ PALETA DOBLE (6/11/2026, Martín: «los que vienen en dark mode deben acompañar siempre el white mode si el usuario lo tiene
//    así en MaKo, y si tiene dark mode, automáticamente pasarse a allí»): claro por defecto (el de Corbel) y, con
//    data-tema="oscuro" en <html>, la regla que viene justo después de la raíz redefine las MISMAS variables. Sólo CSS: cambia
//    en vivo. El oscuro es nuestro (no se midió en Corbel).
// ⚠️ EL TELÉFONO VA POR @container (el ancho del lienzo), no por el de la ventana, y DESPUÉS del medio: dos @container que se
//    pisan los decide el orden (docs/hallazgos-templates-dashboard.md §18).
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.
// =============================================================================

export const CSS_LANDING = `
.cb {
  container-type: inline-size; container-name: cb;
  --font: 'Geist', ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --bg: #efefed; --mesh-a: #e1e1de; --mesh-b: #f9f9f7; --mesh-c: #e6e6e3;
  --glass: #ffffffa3; --glass-2: #ffffffc7; --glass-3: #fffffff0; --rim: #ffffffeb; --well: #1111110f; --line: #11111117; --line-2: #1111112b;
  --text: #121212; --muted: #4f4f4c; --faint: #636360; --ink: #121212; --on-ink: #f6f6f4;
  --t1: #121212; --t2: #fff; --t3: #e2e2de; --t4: #d2d2cd; --on-tile: #14202a; --on-dark: #f3f7f8; --oc-2: #8e8e89;
  --c1: #121212; --c2: #b4b4af; --c3: #6a6a66; --c4: #8e8e89; --c5: #c8c8c3;
  --hatch: #00000029; --hatch-bg: #00000009;
  --heat-0: #e8e8e5; --heat-1: #d0d0cc; --heat-2: #a6a6a1; --heat-3: #696965; --heat-4: #121212;
  --up: #22735c; --up-soft: #d5eee4; --down: #b1412a; --down-soft: #f8e1da;
  --shadow-card: inset 0 0 0 1px #ffffffeb, inset 0 1px 0 #fffc, 0 22px 44px -30px #00000038;
  --shadow-pop: 0 24px 60px -18px #14283857, 0 2px 6px #14283814;
  --r: 22px; --r-sm: 14px; --r-xs: 8px; --ease: cubic-bezier(.2, .8, .2, 1);
   --gap: 16px;
  --gut: 24px;
  /* lo que antes estaba escrito en hex dentro de las reglas */
  --pill: #fff; --ink-hover: #2b2b2b; --tile-2: #14202ac2; --tile-3: #14202ab3; --tile-line: #14202a33; --tile-track: #14202a17;
  --thin-bg: #00000012; --thin-b: #14202a61; --tile-delta-bg: #ffffffb3; --tile-up: #1b5e4a; --tile-down: #8f3220; --dot: #fff;
  --grid: #11111126; --fore-line: #11111170; --fore-hatch: #00000014; --avg-a: #11111166; --avg-b: #1111113d; --avg-bg: #1111110f;
  --avg-ink: #3f3f3c; --tip-bg: #121212; --tip-ink: #f6f6f4;
  position: relative; isolation: isolate; overflow: hidden; background: var(--bg); color: var(--text); font-family: var(--font); font-size: 14px; line-height: 1.45; -webkit-font-smoothing: antialiased;
}
/* En oscuro las superficies SUBEN de luminosidad al elevarse (fondo < tarjeta < baldosa), las líneas son colores opacos a dos
   pasos del fondo y el vidrio pasa a ser una superficie sólida. La baldosa 1, la tarjeta del puntaje y el tooltip son acentos
   oscuros en los dos modos (llevan su texto claro escrito en la regla): en oscuro sólo suben un escalón para despegarse. */
.cb:where([data-tema="oscuro"] *) {
  --bg: #0c0c0b; --mesh-a: #161615; --mesh-b: #1f1f1d; --mesh-c: #191918;
  --glass: #1b1b1a; --glass-2: #222220; --glass-3: #2a2a28; --rim: #2c2c2a; --well: #262625; --line: #2c2c2a; --line-2: #3c3c39;
  --text: #ededeb; --muted: #a8a8a3; --faint: #8c8c87; --ink: #ededeb; --on-ink: #121212;
  --t1: #2f2f2c; --t2: #1b1b1a; --t3: #212120; --t4: #272726; --on-tile: #ededeb;
  --c1: #ededeb; --c2: #6f6f6a; --c3: #b0b0ab; --c4: #93938e; --c5: #62625d;
  --hatch: #6a6a65; --hatch-bg: #1f1f1e;
  --heat-0: #222221; --heat-1: #3a3a37; --heat-2: #6e6e69; --heat-3: #9a9a95; --heat-4: #ededeb;
  --up: #5ee6b4; --up-soft: #12332a; --down: #f2a08a; --down-soft: #3a1c15;
  --shadow-card: inset 0 0 0 1px #2c2c2a, 0 22px 44px -30px #000000b0;
  --shadow-pop: 0 24px 60px -18px #000000b3, 0 2px 6px #00000066;
  --pill: #3a3a37; --ink-hover: #ffffff; --tile-2: #c9c9c5; --tile-3: #b4b4b0; --tile-line: #4a4a46; --tile-track: #3a3a37;
  --thin-bg: #2e2e2b; --thin-b: #8a8a85; --tile-delta-bg: #12332a; --tile-up: #5ee6b4; --tile-down: #f2a08a; --dot: #1b1b1a;
  --grid: #2c2c2a; --fore-line: #6e6e69; --fore-hatch: #2a2a28; --avg-a: #77776f; --avg-b: #4a4a46; --avg-bg: #2a2a28;
  --avg-ink: #c4c4bf; --tip-bg: #3a3a37; --tip-ink: #f6f6f4;
}
.cb *, .cb *::before, .cb *::after { box-sizing: border-box; }
.cb svg.cb-i { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.cb button { font: inherit; color: inherit; border: 0; background: none; padding: 0; cursor: pointer; }
.cb a { color: inherit; text-decoration: none; }
.cb :focus-visible { outline: 2px solid var(--text); outline-offset: 2px; border-radius: 6px; }
.cb .cb-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* ── los controles ─────────────────────────────────────────────────────────────────────────── */
.cb .cb-seg { position: relative; display: inline-flex; padding: 3px; border-radius: 999px; background: var(--well); }
.cb .cb-seg__pill { position: absolute; top: 3px; left: 0; height: calc(100% - 6px); border-radius: 999px; background: var(--pill); box-shadow: 0 1px 2px #0000001a, 0 4px 10px -6px #00000040; transition: transform .55s cubic-bezier(.16, 1, .3, 1), width .55s cubic-bezier(.16, 1, .3, 1); }
.cb .cb-seg button { position: relative; z-index: 1; white-space: nowrap; height: 32px; padding: 0 18px; border-radius: 999px; font-size: 12.5px; font-weight: 600; line-height: 18.125px; color: var(--muted); transition: color .2s; }
.cb .cb-seg button:hover, .cb .cb-seg button[aria-pressed="true"] { color: var(--text); }
.cb .cb-seg--sm button { height: 28px; padding: 0 12px; font-size: 12px; line-height: 17.4px; }
.cb .cb-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 40px; padding: 0 16px; border-radius: 999px; font-size: 13.5px; font-weight: 600; line-height: 19.575px; background: var(--glass-2); box-shadow: inset 0 0 0 1px var(--rim), 0 10px 24px -18px #0000004d; transition: background-color .2s, color .2s, box-shadow .2s; }
.cb .cb-btn:hover { background: var(--glass-3); }
.cb .cb-btn--dark { background: var(--ink); color: var(--on-ink); box-shadow: none; }
.cb .cb-btn--dark:hover { background: var(--ink-hover); }
.cb .cb-info { width: 14px; height: 14px; color: var(--faint); }
.cb .cb-link { font-size: 12.5px; font-weight: 600; line-height: 18.125px; text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor 35%, transparent); text-underline-offset: 4px; text-decoration-thickness: 1px; transition: text-decoration-color .2s; }
.cb .cb-link:hover { text-decoration-color: currentColor; }
.cb .cb-delta { font-style: normal; display: inline-flex; align-items: center; gap: 3px; height: 20px; padding: 0 7px 0 6px; border-radius: 999px; font-size: 11px; font-weight: 700; line-height: 15.95px; color: var(--up); background: var(--up-soft); }
.cb .cb-delta svg { width: 11px; height: 11px; stroke-width: 2.2; transition: transform .5s cubic-bezier(.34, 1.56, .64, 1); }
.cb .cb-delta.cb-is-down { color: var(--down); background: var(--down-soft); }
.cb .cb-delta.cb-is-down svg { transform: rotate(180deg); }

/* ── la página ─────────────────────────────────────────────────────────────────────────────── */
.cb .cb-head { display: flex; align-items: center; justify-content: space-between; margin-top: 28px; }
.cb .cb-head h1 { margin: 0; font-size: 37.44px; font-weight: 600; line-height: 38.94px; letter-spacing: -.936px; }
.cb .cb-live { display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px 0 9px; border-radius: 999px; background: var(--glass-2); box-shadow: inset 0 0 0 1px var(--rim); font-size: 13.5px; line-height: 19.575px; color: var(--on-tile); }
.cb .cb-live__dot { position: relative; width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid var(--text); display: grid; place-items: center; }
.cb .cb-live__dot::after { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--text); }
.cb .cb-live__dot::before { content: ""; position: absolute; inset: -1.5px; border-radius: 50%; background: var(--text); opacity: 0; animation: cb-ping 2.4s cubic-bezier(0, 0, .2, 1) infinite; }
.cb .cb-live__n { font-weight: 600; display: inline-flex; }
.cb .cb-live__n .cb-odo { display: inline-block; height: 19.575px; overflow: hidden; }
.cb .cb-live__n .cb-odo span { display: block; transition: transform .9s cubic-bezier(.16, 1, .3, 1); }
.cb .cb-live__n .cb-odo span i { display: block; font-style: normal; height: 19.575px; }
.cb .cb-live__w { font-weight: 500; }
@keyframes cb-ping { 0% { opacity: .9; transform: scale(.4); } 80%, to { opacity: 0; transform: scale(1.5); } }
.cb .cb-bar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; margin-top: 25px; height: 40px; }
.cb .cb-bar > .cb-seg { justify-self: start; }
.cb .cb-bar__fecha { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--faint); }
.cb .cb-bar__acc { justify-self: end; display: flex; gap: 8px; }
.cb .cb-board { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--gap); margin-top: var(--gap); }
.cb .cb-tile { grid-column: span 3; position: relative; display: flex; flex-direction: column; padding: 18px 20px 16px; border-radius: var(--r); background: var(--t2); color: var(--on-tile); }
.cb .cb-tile--1 { background: var(--t1); color: var(--on-dark); }
.cb .cb-tile--3 { background: var(--t3); }
.cb .cb-tile--4 { background: var(--t4); }
.cb .cb-tile__head { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; line-height: 18.125px; color: var(--tile-2); }
.cb .cb-tile--1 .cb-tile__head { color: #f3f7f8c7; }
.cb .cb-tile--1 .cb-info { color: #f3f7f8b3; }
.cb .cb-tile__body { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-top: 12px; }
.cb .cb-tile__val { display: block; font-size: 26px; font-weight: 600; line-height: 28.6px; letter-spacing: -.52px; font-variant-numeric: tabular-nums; }
.cb .cb-tile__dif { display: flex; align-items: center; gap: 8px; margin-top: 6px; height: 22px; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--tile-3); }
.cb .cb-tile--1 .cb-tile__dif { color: #f3f7f8b3; }
.cb .cb-tile .cb-delta { background: var(--tile-delta-bg); color: var(--tile-up); }
.cb .cb-tile .cb-delta.cb-is-down { color: var(--tile-down); }
.cb .cb-tile--2 .cb-delta { background: transparent; padding-left: 4px; }
.cb .cb-tile--1 .cb-delta { background: #8fe3c424; color: #8fe3c4; }
.cb .cb-tile__foot { margin-top: 9.5px; padding-top: 10px; border-top: 1px dashed var(--tile-line); }
.cb .cb-tile--1 .cb-tile__foot { border-top-color: #f3f7f833; }
.cb .cb-tile__vis { flex: none; display: block; margin-bottom: 1px; }
.cb .cb-minibars { display: flex; gap: 5px; height: 42px; }
.cb .cb-minibars i { position: relative; width: 13px; height: 100%; border-radius: 999px; background: #ffffff1f; overflow: hidden; }
.cb .cb-minibars b { position: absolute; left: 0; right: 0; bottom: 0; border-radius: 999px; background: var(--oc-2); transform-origin: 50% 100%; }
.cb .cb-minibars i:last-child b { background: var(--on-dark); }
.cb .cb-spark { width: 80px; height: 40px; overflow: visible; }
.cb .cb-spark__line { fill: none; stroke: var(--on-tile); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.cb .cb-spark__area { fill: url(#cb-area); }
.cb .cb-spark__dot { fill: var(--dot); stroke: var(--on-tile); stroke-width: 2; transform-box: fill-box; transform-origin: center; }
.cb .cb-ring { position: relative; width: 40px; height: 40px; margin-bottom: 2px; }
.cb .cb-ring svg { width: 40px; height: 40px; transform: rotate(-90deg); }
.cb .cb-ring circle { fill: none; stroke-width: 4.5; }
.cb .cb-ring__track { stroke: var(--tile-track); }
.cb .cb-ring__fill { stroke: var(--on-tile); stroke-linecap: round; }
.cb .cb-ring__pct { position: absolute; inset: 0; display: grid; place-items: center; font-size: 11px; font-weight: 600; line-height: 15.95px; }
.cb .cb-thin { display: flex; gap: 3px; height: 42px; }
.cb .cb-thin i { position: relative; width: 5px; height: 100%; border-radius: 999px; background: var(--thin-bg); overflow: hidden; }
.cb .cb-thin b { position: absolute; left: 0; right: 0; bottom: 0; border-radius: 999px; background: var(--thin-b); transform-origin: 50% 100%; }
.cb .cb-thin i:last-child b { background: var(--on-tile); }
.cb .cb-card { position: relative; display: flex; flex-direction: column; padding: 20px; border-radius: var(--r); background: var(--glass); box-shadow: var(--shadow-card); backdrop-filter: blur(22px) saturate(1.15); min-width: 0; }
.cb .cb-card--dark { background: var(--t1); color: var(--on-dark); box-shadow: none; backdrop-filter: none; }
.cb .cb-card__head { display: flex; align-items: center; gap: 8px; min-height: 32px; }
.cb .cb-card__head h2 { margin: 0; font-size: 15px; font-weight: 600; line-height: 21.75px; letter-spacing: -.075px; }
.cb .cb-card--dark .cb-info { color: #f3f7f8b3; }
.cb .cb-card__sub { font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--faint); margin-left: 4px; }
.cb .cb-card__head .cb-seg { margin-left: auto; }
.cb .cb-score { grid-column: span 4; min-height: 354px; }
.cb .cb-gauge { position: relative; display: block; width: 300px; height: 160px; margin: 22px auto 0; }
.cb .cb-gauge > svg { position: absolute; inset: 0; width: 300px; height: 160px; overflow: visible; }
.cb .cb-gauge__track { fill: none; stroke: #ffffff1f; stroke-width: 20; stroke-linecap: round; }
.cb .cb-gauge__fill { fill: none; stroke: url(#cb-gauge); stroke-width: 20; stroke-linecap: round; }
.cb .cb-gauge__tick { stroke: #f3f7f8d9; stroke-width: 2.2; stroke-linecap: round; transition: stroke .3s; }
.cb .cb-gauge__tick.cb-is-off { stroke: #ffffff2e; }
.cb .cb-gauge__knob { fill: var(--t1); stroke: var(--on-dark); stroke-width: 4; }
.cb .cb-gauge__knob-c { fill: var(--on-dark); }
.cb .cb-gauge__mid { position: absolute; left: 0; right: 0; bottom: -1px; display: flex; flex-direction: column; align-items: center; }
.cb .cb-gauge__num { display: flex; align-items: center; gap: 9px; }
.cb .cb-gauge__num b { font-size: 34px; font-weight: 600; line-height: 34px; letter-spacing: -1.19px; font-variant-numeric: tabular-nums; }
.cb .cb-gauge__num .cb-delta { background: #8fe3c424; color: #8fe3c4; letter-spacing: .22px; }
.cb .cb-gauge__of { font-size: 12px; font-weight: 500; line-height: 17.4px; color: #f3f7f8b3; }
.cb .cb-note { margin-top: 15px; }
.cb .cb-note h3 { margin: 0; font-size: 14px; font-weight: 600; line-height: 20.3px; }
.cb .cb-note p { margin: 5px 0 0; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: #f3f7f8c7; }
.cb .cb-score .cb-link { margin-top: auto; align-self: flex-start; }
.cb .cb-rev { grid-column: span 8; min-height: 354px; }
.cb .cb-chart { position: relative; display: grid; grid-template-columns: 37px minmax(0, 1fr); column-gap: 7px; margin-top: 14px; }
.cb .cb-chart__y { position: relative; height: 238px; }
.cb .cb-chart__y span { position: absolute; right: 0; transform: translateY(-50%); font-size: 11px; font-weight: 500; line-height: 15.95px; color: var(--faint); white-space: nowrap; }
.cb .cb-chart__plot { position: relative; height: 238px; }
.cb .cb-chart__gl { position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed var(--grid); transform-origin: 0 50%; }
.cb .cb-chart__cols { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); }
.cb .cb-col { position: relative; display: flex; justify-content: center; align-items: flex-end; height: 100%; }
.cb .cb-col b { position: relative; width: 30px; border-radius: 999px; background: repeating-linear-gradient(-45deg, var(--hatch) 0 1.6px, var(--hatch-bg) 1.6px 6.6px); transform-origin: 50% 100%; overflow: hidden; }
.cb .cb-col.cb-is-now b { background: linear-gradient(to bottom, #8a8e8d, var(--ink) 57%); }
.cb .cb-col.cb-is-fore b { border: 1px dashed var(--fore-line); border-radius: 4px 4px 2px 2px; background: repeating-linear-gradient(-45deg, var(--fore-hatch) 0 1.6px, transparent 1.6px 6.6px); }
.cb .cb-chart__x { grid-column: 2; display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); margin-top: 9px; }
.cb .cb-chart__x span { text-align: center; font-size: 11px; font-weight: 500; line-height: 15.95px; color: var(--faint); }
.cb .cb-chart__x span.cb-is-now { font-weight: 600; color: var(--text); }
.cb .cb-avg { position: absolute; left: 0; right: 0; height: 5px; border-top: 1px dashed var(--avg-a); border-bottom: 1px dashed var(--avg-b); pointer-events: none; }
.cb .cb-avg span { position: absolute; right: 2px; bottom: 6px; padding: 0 6px; border-radius: 6px; background: var(--avg-bg); font-size: 11px; font-weight: 600; line-height: 15.95px; color: var(--avg-ink); white-space: nowrap; }
.cb .cb-tip { position: absolute; z-index: 2; top: -10px; width: 164px; padding: 10px 12px; border-radius: 12px; background: var(--tip-bg); color: var(--tip-ink); box-shadow: var(--shadow-pop); pointer-events: none; transform-origin: 50% 100%; }
.cb .cb-tip__t { font-size: 12px; font-weight: 600; line-height: 17.4px; margin-bottom: 7.4px; }
.cb .cb-tip__r { display: flex; justify-content: space-between; font-size: 12px; font-weight: 500; line-height: 17.4px; margin-top: 4px; }
.cb .cb-tip__r span { color: #f6f6f4ad; }
.cb .cb-tip__r b { font-weight: 600; }
.cb .cb-tip__r b.cb-is-up { color: #5ee6b4; }
.cb .cb-heat { grid-column: span 7; min-height: 258px; }
.cb .cb-heat__ley { margin-left: auto; display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 500; line-height: 15.95px; color: var(--faint); }
.cb .cb-heat__ley i { width: 14px; height: 14px; border-radius: 4px; }
.cb .cb-heat__ley span { margin: 0 4px; }
.cb .cb-heat__g { display: grid; grid-template-columns: 98px repeat(7, minmax(0, 1fr)); column-gap: 7px; row-gap: 8px; margin-top: 14px; }
.cb .cb-heat__d { text-align: center; font-size: 11px; font-weight: 500; line-height: 15.95px; color: var(--faint); }
.cb .cb-heat__r { align-self: center; font-size: 11px; font-weight: 500; line-height: 15.95px; color: var(--faint); white-space: nowrap; }
.cb .cb-heat__c { height: 31px; border-radius: var(--r-xs); background: var(--heat-0); transition: transform .35s cubic-bezier(.3, 1.4, .5, 1); }
.cb .cb-heat__c:hover { transform: scale(1.04); }
.cb .cb-heat__c[data-n="1"] { background: var(--heat-1); }
.cb .cb-heat__c[data-n="2"] { background: var(--heat-2); }
.cb .cb-heat__c[data-n="3"] { background: var(--heat-3); }
.cb .cb-heat__c[data-n="4"] { background: var(--heat-4); }
.cb .cb-heat__g .cb-heat__d:first-child { visibility: hidden; }
.cb .cb-heat__r .cb-s { display: none; }
.cb .cb-visits { grid-column: span 5; min-height: 258px; }
.cb .cb-visits__body { display: grid; grid-template-columns: minmax(0, 1fr) 152px; column-gap: 42px; padding-right: 8px; margin-top: 20px; align-items: center; }
.cb .cb-visits__n { display: block; font-size: 26px; font-weight: 600; line-height: 28.6px; letter-spacing: -.52px; font-variant-numeric: tabular-nums; }
.cb .cb-visits__dif { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--tile-3); }
.cb .cb-visits__ley { list-style: none; margin: 13px 0 0; padding: 0; }
.cb .cb-visits__ley li { display: flex; align-items: center; gap: 9px; height: 32px; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--muted); }
.cb .cb-visits__ley i { width: 10px; height: 10px; border-radius: 3px; flex: none; }
.cb .cb-visits__ley b { margin-left: auto; font-size: 13.5px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
.cb .cb-donut { position: relative; width: 152px; height: 152px; align-self: start; margin-top: 0; }
.cb .cb-donut svg { width: 152px; height: 152px; transform: rotate(-90deg); }
.cb .cb-donut circle { fill: none; stroke-width: 20; }
.cb .cb-donut__mid { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
.cb .cb-donut__mid b { font-size: 26px; font-weight: 600; line-height: 28.6px; letter-spacing: -.78px; }
.cb .cb-donut__mid span { font-size: 12px; font-weight: 500; line-height: 17.4px; color: var(--faint); }
.cb [data-lift] { will-change: transform; }

/* ── lo de la adaptación ───────────────────────────────────────────────────────────────────── */
/* El período en lugar del selector de canal (un solo valor: la pastilla blanca), la frase en lugar de la fecha y el «hoy» en lugar del
   «live now». Lo demás: los vacíos, lo que no se pudo leer, los links que son botones y las filas que se tocan. */
.cb .cb-seg__solo { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 16px 0 13px; border-radius: 999px; background: var(--pill); box-shadow: 0 1px 2px #0000001a, 0 4px 10px -6px #00000040; font-size: 12.5px; font-weight: 600; line-height: 18.125px; color: var(--text); white-space: nowrap; }
/* El período como BOTÓN (6/11/2026): abre el de la hoja. Sin el borde ni la letra que el navegador le pone a un botón. */
.cb button.cb-seg__solo { border: 0; font-family: inherit; cursor: pointer; }
.cb button.cb-seg__solo:hover { color: var(--ink-hover, var(--text)); }
.cb .cb-bar__frase { min-width: 0; display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--faint); }
.cb .cb-bar__frase span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cb .cb-bar__frase b { color: var(--text); font-weight: 600; }
.cb button.cb-link { cursor: pointer; text-align: left; }
.cb .cb-vacio { flex: 1; display: grid; place-items: center; align-content: center; gap: 6px; padding: 18px 12px; text-align: center; font-size: 12.5px; font-weight: 500; line-height: 18.125px; color: var(--faint); }
.cb .cb-vacio b { font-size: 14px; font-weight: 600; color: var(--text); }
.cb .cb-card--dark .cb-vacio { color: #f3f7f8b3; }
.cb .cb-chart__x span i { font-style: normal; margin-left: 3px; }
.cb .cb-col { cursor: default; }
.cb .cb-col:hover b { filter: brightness(.94); }
.cb .cb-visits__ley li[role="button"] { cursor: pointer; border-radius: 8px; transition: background-color .2s; }
.cb .cb-visits__ley li[role="button"]:hover { background: var(--well); }
.cb .cb-visits__ley li[role="button"]:focus-visible { outline: 2px solid var(--text); outline-offset: -2px; }
.cb .cb-tile__val.cb-is-nada, .cb .cb-gauge__num b.cb-is-nada { color: inherit; opacity: .45; }
.cb .cb-pagina { position: relative; z-index: 1; padding: 6px var(--gut) 40px; }
.cb .cb-head { margin-top: 0; }
.cb .cb-fondo { position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.cb .cb-fondo i { position: absolute; border-radius: 50%; filter: blur(70px); opacity: .9; animation: cb-mancha 14s cubic-bezier(.445, .05, .55, .95) infinite alternate; }
.cb .cb-fondo i:nth-child(1) { width: 720px; height: 720px; left: -160px; top: -240px; background: var(--mesh-b); --mx: 60px; --my: 40px; --ms: 1.08; }
.cb .cb-fondo i:nth-child(2) { width: 640px; height: 640px; right: -180px; top: 160px; background: var(--mesh-a); --mx: -50px; --my: -60px; --ms: .94; animation-duration: 18s; }
.cb .cb-fondo i:nth-child(3) { width: 820px; height: 620px; left: 28%; bottom: -320px; background: var(--mesh-c); --mx: 40px; --my: 50px; --ms: 1.1; animation-duration: 22s; }
@keyframes cb-mancha { to { transform: translate(var(--mx), var(--my)) scale(var(--ms)); } }
.cb[data-quieta] .cb-fondo i { animation: none; }
.cb .cb-fila:focus-visible { outline: 2px solid var(--text); outline-offset: -2px; }
.cb .cb-link--quieta { text-decoration: none; opacity: .72; }
.cb .cb-info-w { display: inline-grid; place-items: center; cursor: help; }
.cb .cb-delta { white-space: nowrap; flex: none; }
/* Entre 1041 y 1240 (el lienzo de MaKo al lado de la barra lateral): los cuatro números siguen en fila y «vs. el anterior» se va,
   como en el teléfono de Corbel; el chip con su flecha alcanza. */
@container cb (max-width: 1240px) {
  .cb .cb-tile__dif > span { display: none; }
}

/* ── el medio (761 a 1040: no está medido en Corbel) ────────────────────────────────────────── */
@container cb (max-width: 1040px) {
  .cb .cb-tile { grid-column: span 6; }
  .cb .cb-score { grid-column: span 5; }
  .cb .cb-rev { grid-column: span 7; }
  .cb .cb-heat, .cb .cb-visits { grid-column: 1 / -1; }
  .cb .cb-col b { width: 22px; }
  .cb .cb-bar { height: auto; grid-template-columns: auto 1fr; row-gap: 12px; }
  .cb .cb-bar__frase { grid-column: 1 / -1; grid-row: 2; }
  .cb .cb-bar__frase span { white-space: normal; }
}
/* ── el teléfono (medido a 390) ────────────────────────────────────────────────────────────── */
@container cb (max-width: 760px) {
  .cb .cb-pagina { padding: 6px 14px 40px; }
  .cb .cb-head { margin-top: 33px; }
  .cb .cb-head h1 { font-size: 28.5px; line-height: 30px; letter-spacing: -.71px; }
  .cb .cb-tile__val { font-size: 22.5px; line-height: 24.75px; letter-spacing: -.45px; }
  .cb .cb-live__w { display: none; }
  .cb .cb-bar { grid-template-columns: 1fr; height: auto; gap: 11px; margin-top: 24px; }
  .cb .cb-bar > .cb-seg { display: flex; justify-self: stretch; }
  .cb .cb-bar .cb-seg button { flex: 1; }
  .cb .cb-bar__fecha { display: none; }
  .cb .cb-seg--uno .cb-seg__solo { flex: 1; justify-content: center; }
  .cb .cb-bar__acc { justify-self: stretch; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .cb .cb-board { grid-template-columns: 1fr 1fr; gap: 9px 10px; }
  .cb .cb-tile { grid-column: span 1; padding: 14px; }
  .cb .cb-tile__vis, .cb .cb-tile__dif > span { display: none; }
  .cb .cb-tile__body { margin-top: 6px; }
  .cb .cb-tile__dif { margin-top: 8px; }
  .cb .cb-tile__foot { margin-top: 6px; padding-top: 7px; }
  .cb .cb-score, .cb .cb-rev, .cb .cb-heat, .cb .cb-visits { grid-column: 1 / -1; padding: 16px; min-height: 0; margin-top: 7px; }
  .cb .cb-score { text-align: center; }
  .cb .cb-score .cb-card__head { justify-content: center; }
  .cb .cb-score .cb-note { text-align: left; }
  .cb .cb-score .cb-link { align-self: center; margin-top: 10px; }
  .cb .cb-rev .cb-card__head { flex-wrap: wrap; }
  .cb .cb-rev .cb-card__sub { order: 3; width: 100%; margin: 4px 0 0; }
  .cb .cb-rev { padding-bottom: 19px; }
  .cb .cb-chart { grid-template-columns: 30px minmax(0, 1fr); column-gap: 6px; margin-top: 12px; }
  .cb .cb-chart__y, .cb .cb-chart__plot { height: 210px; }
  .cb .cb-col b { width: 18px; }
  .cb .cb-chart__x span { font-size: 10.5px; }
  .cb .cb-heat__g { grid-template-columns: 49px repeat(7, minmax(0, 1fr)); column-gap: 5px; row-gap: 5px; margin-top: 14px; }
  .cb .cb-heat__c { height: 26px; border-radius: 7px; }
  .cb .cb-heat__r .cb-l { display: none; }
  .cb .cb-heat__r .cb-s { display: inline; }
  .cb .cb-heat__ley i:nth-of-type(n+3) { display: none; }
  .cb .cb-visits__body { grid-template-columns: 1fr; padding: 0 16px 0 1px; margin-top: 22px; }
  .cb .cb-donut { order: -1; justify-self: center; width: 144px; height: 144px; margin-bottom: 26px; }
  .cb .cb-donut svg { width: 144px; height: 144px; }
  .cb .cb-head { margin-top: 0; }
  .cb .cb-chart__x span i { display: none; }
}
@media (prefers-reduced-motion: reduce) { .cb *, .cb *::before, .cb *::after { transition: none !important; animation: none !important; } }
`;
