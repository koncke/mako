// =============================================================================
// operacion-css — la hoja de estilos del DISEÑO de la hoja «Operación diaria»: la copia de Moorly, sólo de esta hoja
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco». Es docs/diseno/mockups-dashboard/operacion-moorly/moorly.css (escrita desde lo MEDIDO del demo: valores.json, las
// capturas y el INFORME; nada del código de la tienda) con todo adentro de `.mo` y cada clase con el prefijo `mo-`, para no
// tocar nada del resto del Dashboard. Sin la barra de arriba ni la de abajo de Moorly: en MaKo las pone la app. Lo que era del
// `body` (el cielo, el sol y el mar de cuatro olas) es de `.mo`, y el mar sube lo que medía la barra de arriba (122 px) para
// caer detrás del gráfico como en el demo.
//
// Lo que se suma a la copia, y es de la adaptación (operacion-moorly/mako.html): los vacíos («No pude leer…») y el medio de
// 761 a 1040, que Moorly no tiene medido (sus capturas son 1440 y 390).
//
// ⚠️ ESTA HOJA ES SÓLO DE «OPERACIÓN DIARIA»: otra hoja con diseño escribe la suya (la de su demo), no reusa ésta.
// ⚠️ EL TELÉFONO VA POR @container (el ancho del lienzo), no por el de la ventana. Su corte es el de Moorly (760, medido a 390).
// ⚠️ PALETA DOBLE (6/11/2026, Martín: «los que vienen en dark mode deben acompañar siempre el white mode si el usuario lo tiene
//    así en MaKo, y si tiene dark mode, automáticamente pasarse a allí»): la base es la clara de Moorly (cielo y mar de día) y
//    `data-tema="oscuro"` la da vuelta (el mismo mar, de noche). Todo color de una regla sale de una variable de las dos paletas.
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.
// =============================================================================

export const CSS_OPERACION = `
.mo {
  container-type: inline-size; container-name: mo;
  --font: "Urbanist", system-ui, -apple-system, "Segoe UI", sans-serif;
  --gap: 16px;
  --bg: oklch(95% .018 215);
  --glass: #ffffff9e; --glass-strong: #fafcfdd6; --glass-rim: #ffffffb3; --glass-hi: #fffffff2; --blur: 22px;
  --card: #ffffffdb; --card-2: oklch(45% .04 220/.055); --card-3: oklch(45% .04 220/.1);
  --ink: oklch(22% .025 230); --ink-2: oklch(36% .025 230); --muted: oklch(47% .02 230);
  --line: oklch(30% .03 230/.09); --line-2: oklch(30% .03 230/.16);
  --shadow: 0 1px 1px oklch(30% .05 230/.04), 0 12px 32px -18px oklch(35% .06 225/.32);
  --shadow-lg: 0 2px 6px oklch(30% .05 230/.06), 0 32px 70px -26px oklch(30% .07 225/.45);
  --accent: oklch(50% .09 205); --accent-hi: oklch(54% .095 205); --accent-ink: #fff; --accent-soft: oklch(50% .09 205/.13); --accent-text: oklch(44% .085 205);
  --warm: oklch(74% .13 62); --warm-text: oklch(52% .11 55); --warm-soft: oklch(74% .13 62/.18);
  --good: oklch(50% .11 155); --warn: oklch(52% .11 68); --bad: oklch(52% .16 25); --info: oklch(50% .12 250);
  --good-soft: oklch(60% .12 155/.15); --warn-soft: oklch(75% .13 75/.22); --bad-soft: oklch(60% .16 25/.13); --info-soft: oklch(60% .12 250/.13);
  --c-hull: oklch(56% .12 250); --c-cargo: oklch(64% .13 78); --c-marina: oklch(60% .11 165); --c-build: oklch(62% .13 40); --c-fish: oklch(64% .11 125); --c-charter: oklch(62% .13 8);
  --tile-sea: oklch(88% .06 195/.62); --tile-sand: oklch(92% .06 80/.66); --tile-coral: oklch(89% .06 40/.62); --tile-sky: oklch(89% .05 245/.62);
  --tile-ink: oklch(22% .025 230); --tile-muted: oklch(22% .025 230/.68);
  --sky1: oklch(97.5% .012 230); --sky2: oklch(94.5% .03 210); --sun: oklch(93% .075 70);
  --w1: oklch(90% .045 195); --w2: oklch(86% .06 205); --w3: oklch(82% .07 215); --w4: oklch(78% .075 228); --crest: #ffffffbf;
  --rim: inset 0 1px 0 #fffffff2, inset 0 0 0 1px #ffffffb3;
  --ease: cubic-bezier(.22, 1, .36, 1);
  --ctl: #fff; --card-bg: #ffffff9e; --up-t: rgb(23, 97, 59); --spark-a: oklch(22% .025 230/.12); --btn-sombra: oklch(30% .05 230/.06);
  --salud-rojo: oklch(90% .05 25); --salud-ambar: oklch(91% .05 75); --salud-verde: oklch(91% .04 155);
}
.mo:where([data-tema="oscuro"] *) {
  /* Moorly de noche: el mismo cielo y el mismo mar, hondos; las tarjetas de vidrio suben de luminosidad */
  --bg: oklch(17% .022 232);
  --glass: #1a2a32cc; --glass-strong: #172229d6; --glass-rim: #ffffff1f; --glass-hi: #ffffff26;
  --card: #1b2830db; --card-2: oklch(90% .02 220/.07); --card-3: oklch(90% .02 220/.12);
  --ink: oklch(94% .01 230); --ink-2: oklch(84% .015 230); --muted: oklch(74% .02 230);
  --line: oklch(90% .02 230/.1); --line-2: oklch(90% .02 230/.2);
  --shadow: 0 1px 1px #00000040, 0 12px 32px -18px #000000b3;
  --shadow-lg: 0 2px 6px #00000059, 0 32px 70px -26px #000000d9;
  --accent: oklch(66% .1 205); --accent-hi: oklch(72% .105 205); --accent-ink: oklch(16% .03 220); --accent-soft: oklch(66% .1 205/.2); --accent-text: oklch(80% .09 205);
  --warm: oklch(76% .13 62); --warm-text: oklch(82% .12 72); --warm-soft: oklch(74% .13 62/.2);
  --good: oklch(78% .13 155); --warn: oklch(82% .12 78); --bad: oklch(74% .15 25); --info: oklch(76% .11 250);
  --good-soft: oklch(70% .12 155/.2); --warn-soft: oklch(75% .13 75/.2); --bad-soft: oklch(68% .16 25/.2); --info-soft: oklch(70% .12 250/.2);
  --c-hull: oklch(68% .12 250); --c-cargo: oklch(78% .13 78); --c-marina: oklch(72% .11 165); --c-build: oklch(72% .13 40); --c-fish: oklch(74% .11 125); --c-charter: oklch(72% .13 8);
  --tile-sea: oklch(34% .06 195/.7); --tile-sand: oklch(36% .06 80/.7); --tile-coral: oklch(34% .06 40/.7); --tile-sky: oklch(34% .06 245/.7);
  --tile-ink: oklch(95% .01 230); --tile-muted: oklch(95% .01 230/.74);
  --sky1: oklch(19% .03 238); --sky2: oklch(22% .045 222); --sun: oklch(38% .07 70);
  --w1: oklch(27% .05 200); --w2: oklch(24% .055 207); --w3: oklch(21% .058 217); --w4: oklch(18.5% .058 230); --crest: #ffffff29;
  --rim: inset 0 1px 0 #ffffff1f, inset 0 0 0 1px #ffffff14;
  --ctl: oklch(30% .03 228); --card-bg: oklch(24% .028 228/.74); --up-t: oklch(82% .13 155); --spark-a: oklch(95% .01 230/.14); --btn-sombra: #00000059;
  --salud-rojo: oklch(40% .1 25); --salud-ambar: oklch(42% .08 75); --salud-verde: oklch(38% .07 155);
}
.mo { position: relative; overflow: hidden; min-height: 100%; color: var(--ink); font: 500 14px/1.45 var(--font); -webkit-font-smoothing: antialiased;
  background: radial-gradient(420px 300px at 76% 208px, color-mix(in srgb, var(--sun) 80%, transparent), transparent 70%),
    linear-gradient(180deg, var(--sky1), var(--sky2) 318px, var(--bg) 318px); }
.mo * { box-sizing: border-box; }
.mo :where(h1, h2, p, ul, li) { margin: 0; padding: 0; }
.mo :where(ul) { list-style: none; }
.mo :where(button) { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
.mo :where(a) { color: inherit; text-decoration: none; }
.mo :where(a, button, [role=button]):focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 8px; }
.mo svg.mo-i { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
/* El mar: los 900 px de Moorly, subidos lo que medía su barra de arriba (122 px; 62 en el teléfono) */
.mo .mo-sea { position: absolute; z-index: 0; left: 0; top: -122px; width: 100%; height: 900px; pointer-events: none; }
.mo .mo-sea path { vector-effect: non-scaling-stroke; }
.mo .mo-page { position: relative; z-index: 1; max-width: 1560px; margin: 0 auto; padding: 0 32px 48px; }

.mo .mo-hero { display: flex; align-items: flex-end; gap: 16px; margin-top: 28px; margin-bottom: 17px; }
.mo .mo-hero h1 { font-size: 37.44px; font-weight: 600; line-height: 38.94px; letter-spacing: -.936px; }
.mo .mo-hero p { max-width: 580px; margin-top: 9px; color: var(--muted); font-size: 14px; font-weight: 500; line-height: 20.3px; }
.mo .mo-hero p b { color: var(--ink); font-weight: 600; }
.mo .mo-hero__acts { margin-left: auto; display: flex; gap: 8px; }
.mo .mo-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 40px; padding: 0 16px; border-radius: 12px; font-size: 14px; font-weight: 600; white-space: nowrap; background: var(--ctl); box-shadow: inset 0 0 0 1px var(--line-2), 0 1px 2px var(--btn-sombra); transition: background-color .15s; }
.mo .mo-btn:hover { background: var(--card-2); }
.mo .mo-btn--primary { background: linear-gradient(180deg, var(--accent-hi), var(--accent)); color: var(--accent-ink); box-shadow: inset 0 1px 0 #ffffff33, 0 8px 18px -10px var(--accent); }
.mo .mo-btn--primary:hover { background: linear-gradient(180deg, var(--accent-hi), var(--accent-hi)); }

.mo .mo-grid { display: grid; gap: var(--gap); }
.mo .mo-kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.mo .mo-kpi { position: relative; height: 126px; padding: 16px 18px 14px; border-radius: 16px; background: var(--tile); color: var(--tile-ink); box-shadow: var(--rim), var(--shadow); backdrop-filter: blur(var(--blur)); overflow: hidden; }
.mo .mo-kpi--sea { --tile: var(--tile-sea); }
.mo .mo-kpi--sand { --tile: var(--tile-sand); }
.mo .mo-kpi--sky { --tile: var(--tile-sky); }
.mo .mo-kpi--coral { --tile: var(--tile-coral); }
.mo .mo-kpi__l { display: flex; align-items: center; gap: 8px; color: var(--tile-muted); font-size: 12.5px; font-weight: 600; line-height: 18.125px; }
.mo .mo-kpi__l svg.mo-i { width: 14px; height: 14px; }
.mo .mo-kpi__v { margin-top: 9px; font-size: 22px; font-weight: 600; line-height: 24.2px; letter-spacing: -.22px; font-variant-numeric: tabular-nums; }
.mo .mo-kpi__f { position: absolute; left: 18px; bottom: 14px; display: flex; align-items: center; gap: 8px; color: var(--tile-muted); font-size: 12px; font-weight: 600; line-height: 17.4px; }
.mo .mo-up { display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border-radius: 10px; background: var(--ctl); color: var(--up-t); font-size: 11px; font-weight: 700; }
.mo .mo-spark { position: absolute; right: 18px; bottom: 14px; width: 90px; height: 30px; overflow: visible; }
.mo .mo-spark .mo-a { fill: var(--spark-a); }
.mo .mo-spark .mo-l { fill: none; stroke: var(--tile-ink); stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; opacity: .8; }

.mo .mo-row2 { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: var(--gap); }
.mo .mo-row2 > .mo-desk__chart { grid-column: span 2; }
.mo .mo-row3 { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: var(--gap); }
.mo .mo-card { position: relative; min-width: 0; padding: 18px 20px 20px; border-radius: 16px; background: var(--card-bg); box-shadow: var(--rim), var(--shadow); backdrop-filter: blur(var(--blur)); }
.mo .mo-card__h { display: flex; align-items: flex-start; gap: 12px; }
.mo .mo-card__h > div { min-width: 0; }
.mo .mo-card__t { font-size: 15px; font-weight: 600; line-height: 18.75px; letter-spacing: -.075px; }
.mo .mo-card__s { margin-top: 3px; color: var(--muted); font-size: 12.5px; font-weight: 500; line-height: 18.125px; }
.mo .mo-linkbtn { margin-left: auto; color: var(--accent-text); font-size: 12.5px; font-weight: 600; line-height: 18.125px; white-space: nowrap; }
.mo .mo-linkbtn:hover { text-decoration: underline; text-underline-offset: 3px; }
.mo .mo-desk__chart, .mo .mo-desk__wait { height: 426px; }
.mo .mo-row3 > .mo-card { height: 406px; }

/* Premium on the water */
.mo .mo-tabs { margin-left: auto; display: inline-flex; padding: 3px; border-radius: 12px; background: var(--card-2); box-shadow: inset 0 0 0 1px var(--line); }
.mo .mo-tabs button { height: 30px; padding: 0 11px; border-radius: 9px; color: var(--muted); font-size: 13.5px; font-weight: 600; }
.mo .mo-tabs button:hover { color: var(--ink); }
.mo .mo-tabs button[aria-selected=true] { background: var(--ctl); color: var(--ink); box-shadow: 0 1px 2px var(--btn-sombra); }
.mo .mo-chart { position: relative; height: 254px; margin-top: 14px; }
.mo .mo-chart svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.mo .mo-chart .mo-gl { stroke: var(--line-2); stroke-dasharray: 3 3; }
.mo .mo-chart text { fill: var(--muted); font: 600 11px var(--font); }
.mo .mo-cstats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 15px; padding-top: 14px; border-top: 1px solid var(--line); }
.mo .mo-cstats p { color: var(--muted); font-size: 12px; font-weight: 500; line-height: 17.4px; }
.mo .mo-cstats b { display: block; margin-top: 4px; font-size: 17px; font-weight: 600; line-height: 24.65px; letter-spacing: -.17px; font-variant-numeric: tabular-nums; }

/* Waiting on you */
.mo .mo-wait { margin-top: 12px; }
.mo .mo-wait li { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; column-gap: 12px; align-items: center; height: 55.8px; }
.mo .mo-tile { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9px; background: var(--t, var(--card-2)); color: var(--tc, var(--ink-2)); }
.mo .mo-tile svg.mo-i { width: 14px; height: 14px; }
.mo .mo-wait b, .mo .mo-ren b { display: block; font-size: 14px; font-weight: 600; line-height: 20.3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mo .mo-wait small, .mo .mo-ren small { display: block; color: var(--muted); font-size: 12px; font-weight: 500; line-height: 17.4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mo .mo-pill { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px; border-radius: 11px; background: var(--ps, var(--card-2)); color: var(--pc, var(--muted)); font-size: 12px; font-weight: 600; line-height: 17.4px; white-space: nowrap; }
.mo .mo-pill i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.mo .mo-pill--warn { --ps: var(--warm-soft); --pc: var(--warn); }
.mo .mo-pill--bad { --ps: var(--bad-soft); --pc: var(--bad); }
.mo .mo-pill--info { --ps: var(--accent-soft); --pc: var(--accent-text); }
.mo .mo-pill--good { --ps: var(--good-soft); --pc: var(--good); }
.mo .mo-pill--blue { --ps: var(--info-soft); --pc: var(--info); }

/* Pipeline */
.mo .mo-pipe { margin-top: 14px; }
.mo .mo-pipe li { display: grid; grid-template-columns: 26px 90px minmax(0, 1fr) 50px; column-gap: 12px; align-items: center; height: 46px; }
.mo .mo-pipe .mo-n { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; background: var(--ctl); box-shadow: inset 0 0 0 1px var(--line-2); font-size: 12.5px; font-weight: 700; }
.mo .mo-pipe span { font-size: 13.5px; font-weight: 600; }
.mo .mo-pipe .mo-bar { height: 8px; border-radius: 4px; background: var(--card-2); overflow: hidden; }
.mo .mo-pipe .mo-bar i { display: block; height: 100%; border-radius: 4px; background: var(--accent); }
.mo .mo-pipe em { font-style: normal; text-align: right; font-size: 13.5px; font-weight: 600; font-variant-numeric: tabular-nums; }

/* Renewal tide */
.mo .mo-tide { position: relative; height: 136px; margin-top: 10px; }
.mo .mo-tide svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.mo .mo-tide .mo-gl { stroke: var(--line-2); stroke-dasharray: 3 3; }
.mo .mo-tide text { fill: var(--muted); font: 600 11px var(--font); }
.mo .mo-ren { margin-top: 12px; }
.mo .mo-ren li { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; column-gap: 12px; align-items: center; height: 52px; }
.mo .mo-days { text-align: center; }
.mo .mo-days b { display: block; font-size: 17px; font-weight: 600; line-height: 17.85px; }
.mo .mo-days small { display: block; margin-top: 2px; color: var(--muted); font-size: 11px; font-weight: 600; line-height: 11.55px; }

/* Book by program */
.mo .mo-mixbar { display: flex; gap: 2px; height: 14px; margin-top: 16px; border-radius: 7px; overflow: hidden; }
.mo .mo-mixbar i { background: var(--c); }
.mo .mo-mix ul { margin-top: 12px; border-top: 1px solid var(--line); }
.mo .mo-mix li { display: grid; grid-template-columns: 10px minmax(0, 1fr) 50px 56px; column-gap: 8px; align-items: center; height: 34.8px; border-bottom: 1px solid var(--line); font-size: 13.5px; font-weight: 500; }
.mo .mo-mix li:last-child { border-bottom: 0; }
.mo .mo-mix li i { width: 8px; height: 8px; border-radius: 2px; background: var(--c); }
.mo .mo-mix li em { font-style: normal; text-align: right; color: var(--muted); font-variant-numeric: tabular-nums; }
.mo .mo-mix li b { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }

/* To-dos */
.mo .mo-add { display: flex; align-items: center; height: 42px; margin-top: 16px; padding: 0 12px; border-radius: 12px; background: var(--ctl); box-shadow: inset 0 0 0 1px var(--line-2); color: var(--muted); font-size: 14px; font-weight: 500; }
.mo .mo-add input { width: 100%; outline: none; }
.mo .mo-add input::placeholder { color: var(--muted); }
.mo .mo-todos ul { margin-top: 8px; }
.mo .mo-todo { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; column-gap: 11px; align-items: center; min-height: 37.2px; padding: 8.45px 0; border-top: 1px solid var(--line); }
.mo .mo-todo span { font-size: 14px; font-weight: 600; line-height: 20.3px; }
.mo .mo-todo button { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 6px; background: var(--ctl); box-shadow: inset 0 0 0 1.5px var(--line-2); color: var(--ctl); }
.mo .mo-todo button[aria-checked=true] { background: var(--accent); box-shadow: none; color: var(--accent-ink); }
.mo .mo-todo button svg.mo-i { width: 12px; height: 12px; stroke-width: 2.4; }
.mo .mo-todo.mo-is-done span { color: var(--muted); text-decoration: line-through; text-decoration-color: var(--line-2); text-decoration-thickness: 1.5px; }
.mo .mo-todo small { color: var(--muted); font-size: 12px; font-weight: 500; }

/* Activity */
.mo .mo-feed { margin-top: 12px; }
.mo .mo-feed li { display: grid; grid-template-columns: 26px minmax(0, 1fr); column-gap: 10px; align-items: start; padding: 7px 0; }
.mo .mo-feed .mo-av { width: 26px; height: 26px; margin-top: 1px; background: var(--c); font-size: 10px; }
.mo .mo-feed b { display: block; font-size: 13.5px; font-weight: 600; line-height: 18.2px; }
.mo .mo-feed small { display: block; color: var(--muted); font-size: 12px; font-weight: 500; line-height: 17.4px; }

/* Next agency bill */
.mo .mo-bill__v { margin-top: 16px; font-size: 26px; font-weight: 600; line-height: 28.6px; letter-spacing: -.52px; }
.mo .mo-bill__s { margin-top: 2px; color: var(--muted); font-size: 12.5px; font-weight: 500; }
.mo .mo-billbar { display: flex; gap: 2px; height: 12px; margin-top: 18px; border-radius: 6px; overflow: hidden; }
.mo .mo-billbar i { background: var(--c); }
.mo .mo-leg { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 10px; color: var(--muted); font-size: 12px; font-weight: 500; }
.mo .mo-leg span { display: inline-flex; align-items: center; gap: 6px; }
.mo .mo-leg i { width: 10px; height: 10px; border-radius: 3px; background: var(--c); }
.mo .mo-bill .mo-btn { width: 100%; margin-top: 16px; }

/* ── el teléfono (medido a 390) ────────────────────────────────────────────────────────────── */
@container mo (max-width: 760px) {
  .mo .mo-page { --gap: 12px; padding: 0 12px 40px; }
  .mo .mo-hero { flex-direction: column; align-items: stretch; gap: 16px; margin-top: 22px; margin-bottom: 14px; }
  .mo .mo-hero h1 { font-size: 28.08px; line-height: 29.2px; letter-spacing: -.7px; }
  .mo .mo-hero p { margin-top: 8px; }
  .mo .mo-hero__acts { margin-left: 0; }
  .mo .mo-desk__chart .mo-card__h { flex-wrap: wrap; row-gap: 12px; }
  .mo .mo-desk__chart .mo-tabs { margin-left: 0; }
  .mo .mo-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mo .mo-kpi { height: auto; min-height: 112px; padding: 14px 14px 12px; }
  .mo .mo-kpi__f { position: relative; left: auto; bottom: auto; max-width: 86px; margin-top: 5px; }
  .mo .mo-spark { right: 14px; bottom: 12px; width: 70px; }
  .mo .mo-row2, .mo .mo-row3 { grid-template-columns: minmax(0, 1fr); }
  .mo .mo-row2 > .mo-desk__chart { grid-column: auto; }
  .mo .mo-card { padding: 16px; }
  .mo .mo-desk__chart, .mo .mo-desk__wait, .mo .mo-row3 > .mo-card { height: auto; }
  .mo .mo-cstats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mo .mo-chart { height: 250px; margin-top: 18px; }
  .mo .mo-tide { height: 150px; }
  .mo .mo-bill .mo-btn { margin-top: 10px; }
  .mo .mo-add { font-size: 16px; }
  .mo .mo-todo { grid-template-columns: 24px minmax(0, 1fr) auto; column-gap: 12px; padding: 11px 0; }
  .mo .mo-todo button { width: 24px; height: 24px; border-radius: 7px; }
  .mo .mo-kpi__f .mo-vs { display: none; }
}

/* ── lo de la adaptación ───────────────────────────────────────────────────────────────────── */
.mo .mo-hero { margin-top: 26px; }
.mo .mo-vacio { padding: 14px 2px 4px; color: var(--muted); font-size: 13.5px; font-weight: 500; line-height: 19.575px; }
.mo .mo-wait a:hover b, .mo .mo-ren a:hover b { text-decoration: underline; text-underline-offset: 3px; }
.mo .mo-fila { display: contents; }
.mo .mo-todo span { overflow-wrap: anywhere; }
.mo .mo-pipe span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mo .mo-mix li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mo .mo-av { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: var(--c); color: var(--ink); font-size: 12px; font-weight: 700; }
.mo .mo-feed .mo-av svg.mo-i { width: 13px; height: 13px; }
.mo .mo-ibtn { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: var(--ctl); box-shadow: inset 0 0 0 1px var(--line-2), 0 1px 2px var(--btn-sombra); color: var(--ink); transition: background-color .15s; }
.mo .mo-ibtn:hover { background: var(--card-2); }

/* ── el medio (761 a 1040: no está medido en Moorly) ───────────────────────────────────────────── */
@container mo (max-width: 1040px) {
  .mo .mo-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mo .mo-row2 { grid-template-columns: minmax(0, 1fr); }
  .mo .mo-row2 > .mo-desk__chart { grid-column: auto; }
  .mo .mo-row3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mo .mo-row3 > :last-child:nth-child(odd) { grid-column: 1 / -1; }
  .mo .mo-desk__wait { height: auto; }
}
@container mo (max-width: 760px) {
  .mo .mo-sea { top: -62px; }
  .mo .mo-row3 { grid-template-columns: minmax(0, 1fr); }
  .mo .mo-row3 > :last-child:nth-child(odd) { grid-column: auto; }
}

/* Sin la entrada de la página: el INFORME de Moorly no la trae (vive en un chunk que no muestra) y no se inventa. */
@media (prefers-reduced-motion: reduce) { .mo * { transition: none !important; } }
`;
