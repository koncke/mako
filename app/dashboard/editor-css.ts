// =============================================================================
// editor-css — la hoja de estilos del Dashboard (el cromo del editor y las tarjetas)
// =============================================================================
// Pedidos de Martín (11/10/2026): «el lienzo aparece como dentro de un recuadro, detrás un BG, y
// separado de la topbar de las pestañas... Todo se debe sentir como uno mismo» (punto 16) y «el
// usuario puede habilitar el darkmode y se debe adaptar los colores» (punto 17).
//
// ⚠️ SÓLO TOKENS DE LA APP. Ni un color en hexadecimal: var(--surface), var(--ink), var(--border)…
//    se dan vuelta solos con html[data-tema="oscuro"] (app/globals.css). Las --lk-* que quedan son
//    ALIAS de tokens, para lo que todavía las nombre. Lo fija tests/dashboard-pantalla.test.ts.
// ⚠️ UNA SOLA SUPERFICIE: el fondo es var(--bg) de punta a punta. Sin el gris del lienzo de Looker,
//    sin la página blanca con sombra, sin el borde entre las hojas y el lienzo.
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni en un comentario (la parte a
//    la mitad y la pantalla contesta 200 sin estilos), y el signo de pesos seguido de llave tampoco.
// ⚠️ La barra de CONTROLES es position: sticky contra .lk-lienzo, que es el que scrollea: entre los dos
//    no puede haber ningún ancestro con overflow (AGENTS.md, «un eje en hidden…»). Y .lk-lienzo sólo
//    scrollea si el <main> tiene ALTO: lo fija app/dashboard/page.tsx (sin eso scrollea el documento).
// ⚠️ Las tarjetas leen el TEMA de la hoja por variables (--dash-*, varsDeTema en
//    lib/graficos-temas.ts) con su respaldo: una hoja sin tema se ve como la de MaKo.

export const CSS = `
.lk { --lk-azul: var(--primary); --lk-azul-claro: var(--primary-bg); --lk-verde: var(--good); --lk-verde-claro: var(--good-bg); --lk-tinta: var(--ink); --lk-gris: var(--dim); --lk-borde: var(--border); --lk-barra: var(--surface-2); --lk-lienzo: var(--bg); font-family: 'Geist', system-ui, sans-serif; color: var(--ink); }
.lk button { font-family: inherit; }
.lk-app { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--bg); min-width: 0; }

/* La fila de arriba: el ícono de la tab, las hojas, la de «Nueva hoja» y las acciones. */
.lk-fila { display: flex; align-items: center; gap: 8px; padding: 8px 16px 0; flex: none; flex-wrap: wrap; min-width: 0; }
.lk-logo { display: grid; place-items: center; width: 32px; height: 32px; flex: none; color: var(--ink); }
.lk-hojas { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; min-width: 0; flex: 1 1 240px; }
.lk-hoja-tab { display: inline-flex; align-items: center; position: relative; min-width: 0; max-width: 240px; }
.lk-hoja-btn { display: inline-flex; align-items: center; gap: 6px; min-width: 0; border: none; background: transparent; padding: 8px 8px 7px 10px; font-size: 14px; color: var(--dim); cursor: pointer; border-bottom: 2px solid transparent; }
.lk-hoja-nombre { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-hoja-btn:hover { color: var(--ink); }
.lk-hoja-tab[data-activa] .lk-hoja-btn { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
.lk-hoja-mas { flex: none; border: none; background: transparent; width: 24px; height: 28px; border-radius: 8px; color: var(--dim); cursor: pointer; font-size: 16px; opacity: 0; transition: opacity .12s; }
.lk-hoja-tab:hover .lk-hoja-mas, .lk-hoja-tab[data-activa] .lk-hoja-mas, .lk-hoja-mas:focus-visible { opacity: 1; }
.lk-hoja-mas:hover { background: var(--velo-hover); color: var(--ink); }
.lk-hoja-input { font: inherit; font-size: 14px; border: 1px solid var(--primary); border-radius: 6px; padding: 5px 8px; width: 160px; max-width: 60vw; outline: none; background: var(--surface); color: var(--ink); }
.lk-hoja-nueva { display: inline-flex; margin-left: 6px; flex: none; }
.lk-acciones { display: flex; align-items: center; gap: 8px; margin-left: auto; flex-wrap: wrap; justify-content: flex-end; }
.lk-analista { display: inline-flex; flex: none; }
.lk-pill { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 18px; border: 1px solid var(--border); background: var(--surface); color: var(--ink); font-size: 13.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.lk-pill:hover:not(:disabled) { background: var(--surface-2); }
.lk-pill:disabled { opacity: .5; cursor: default; }
.lk-pill--azul { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
.lk-pill--azul:hover:not(:disabled) { background: var(--primary-strong); border-color: var(--primary-strong); }
.lk-pill--icono { width: 36px; padding: 0; justify-content: center; }
.lk-pill--rojo { color: var(--bad); }

/* La barra de edición: DEBAJO de las hojas (punto 7), así las hojas no se mueven al apretar Editar. */
.lk-barra { display: flex; align-items: center; gap: 2px; background: var(--surface-2); border-radius: 12px; padding: 4px 8px; margin: 6px 16px 0; flex-wrap: wrap; flex: none; }
.lk-herr { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border: none; border-radius: 10px; background: transparent; color: var(--ink); font-size: 13.5px; cursor: pointer; white-space: nowrap; }
.lk-herr:hover:not(:disabled), .lk-herr[aria-expanded="true"] { background: var(--velo-hover); }
.lk-herr:disabled { color: var(--faint); cursor: default; }
.lk-herr--icono { width: 34px; padding: 0; justify-content: center; }
.lk-sep { width: 1px; height: 22px; background: var(--border); margin: 0 6px; }

/* El cuerpo: el lienzo (lo único que scrollea) y, con algo elegido, el panel de propiedades. */
.lk-cuerpo { flex: 1; min-height: 0; display: flex; align-items: stretch; min-width: 0; }
.lk-lienzo { flex: 1; min-width: 0; overflow-y: auto; overflow-x: hidden; background: var(--bg); }
.lk-cab-hoja { padding: 18px 24px 4px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.lk-cab-fila { display: flex; align-items: center; gap: 10px; min-width: 0; }
.lk-cab-emoji { font-size: 26px; line-height: 1; flex: none; }
.lk-cab-tit { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; color: var(--ink); font-family: var(--dash-letra, 'Geist', system-ui, sans-serif); min-width: 0; overflow-wrap: anywhere; }
.lk-cab-sub { margin: 0; font-size: 14px; color: var(--dim); line-height: 1.45; overflow-wrap: anywhere; }
.lk-cab-periodo { margin: 4px 0 0; font-size: 13px; color: var(--dim); }
.lk-controles { position: sticky; top: 0; z-index: 20; background: var(--bg); padding: 8px 24px; }
.lk-controles:empty { display: none; }
.lk-pagina { padding: 6px 24px 40px; box-sizing: border-box; min-width: 0; }
.lk-vacio { display: grid; place-items: center; gap: 12px; padding: 120px 0; color: var(--dim); font-size: 14px; text-align: center; }
.lk-vacio p { margin: 0; }
.lk-pila { display: flex; flex-direction: column; gap: 12px; }

/* Las tarjetas: las de MaKo, con el tema de la hoja. */
.lk-comp { display: flex; flex-direction: column; gap: 10px; padding: var(--dash-tarjeta-pad, 20px 22px); box-sizing: border-box; background: var(--dash-tarjeta-fondo, var(--surface)); border: 1px solid var(--dash-tarjeta-borde, var(--border)); border-radius: var(--dash-tarjeta-radio, 16px); box-shadow: var(--dash-tarjeta-sombra, none); overflow: hidden; font-family: var(--dash-letra, 'Geist', system-ui, sans-serif); color: var(--ink); min-width: 0; }
.lk-comp--filete { border-top: 3px solid var(--lk-filete, var(--border-strong)); }
.lk-comp--elemento { background: transparent; border-color: transparent; box-shadow: none; padding: 0; }
.lk-comp--kpi { justify-content: center; }
.lk--editando .lk-comp { cursor: move; }
.lk--editando .lk-comp:hover { outline: 1px dashed var(--border-strong); outline-offset: -1px; }
.lk-comp--sel, .lk--editando .lk-comp--sel:hover { outline: 2px solid var(--primary) !important; outline-offset: -1px; }
.lk-comp-cab { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }
.lk-comp-tit { flex: 1 1 auto; display: flex; align-items: center; gap: 6px; min-width: 0; font-size: var(--dash-titulo-tam, 19px); font-weight: var(--dash-titulo-peso, 600); text-transform: var(--dash-titulo-mayus, none); letter-spacing: var(--dash-titulo-espacio, -0.015em); line-height: 1.25; color: var(--ink); }
.lk-comp-tit > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-comp--kpi .lk-comp-tit { font-size: 14px; color: var(--dim); }
.lk-comp--mono .lk-comp-tit { font-family: 'Geist Mono', monospace; font-weight: 400; font-size: 12px; text-transform: uppercase; letter-spacing: .1em; color: var(--dim); }
.lk-comp-sub { margin-top: -6px; font-size: 13px; color: var(--faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lk-comp-acciones { flex: none; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; max-width: 70%; cursor: default; }
.lk-mako { display: inline-flex; transition: opacity .15s; }
.lk-comp--kpi .lk-mako { opacity: 0; }
.lk-comp--kpi:hover .lk-mako, .lk-comp--kpi:focus-within .lk-mako { opacity: 1; }
.lk-mini-giro { width: 10px; height: 10px; border: 2px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: lkGiro .8s linear infinite; flex: none; }
@keyframes lkGiro { to { transform: rotate(360deg); } }
.lk .recharts-wrapper *:focus, .lk .recharts-surface:focus { outline: none; }
.lk .react-grid-item.react-grid-placeholder { background: var(--primary); opacity: .15; border-radius: 12px; }
.lk .react-grid-item > .react-resizable-handle { opacity: 0; }
.lk .react-grid-item.lk-comp--sel > .react-resizable-handle { opacity: 1; }
.lk .react-grid-item > .react-resizable-handle::after { border-right-color: var(--dim); border-bottom-color: var(--dim); }
@media (hover: none) { .lk-hoja-mas, .lk-comp--kpi .lk-mako { opacity: 1; } }

/* Mientras corre un recorrido, lo que aparece al pasar el cursor se ve (si no, el recorte señala la nada). */
.lk:is(body:has(> .mk-rec) *) .react-grid-item > .react-resizable-handle, .lk:is(body:has(> .mk-rec) *) .lk-hoja-mas, .lk:is(body:has(> .mk-rec) *) .lk-mako { opacity: 1; }

/* El panel de propiedades: sólo con algo elegido (punto 10). */
.lk-props { flex: none; width: 300px; background: var(--surface); border-left: 1px solid var(--border); overflow-y: auto; box-sizing: border-box; padding: 0 0 16px; color: var(--ink); }
.lk-props-cab { display: flex; align-items: center; gap: 8px; padding: 12px 10px 8px 16px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--surface); z-index: 1; }
.lk-props-nombre { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-props-linea { margin: 0; padding: 10px 16px 0; font-size: 12.5px; color: var(--dim); line-height: 1.45; }
.lk-tipo-btn { display: inline-flex; align-items: center; gap: 2px; border: none; background: transparent; font-size: 15px; font-weight: 600; color: var(--ink); padding: 4px 6px; border-radius: 6px; cursor: pointer; min-width: 0; }
.lk-tipo-btn:hover { background: var(--velo-hover); }
.lk-secciones { display: flex; flex-direction: column; }
.lk-seccion { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.lk-seccion-tit { font-size: 12px; font-weight: 600; color: var(--dim); }
.lk-sub { font-size: 12px; color: var(--dim); margin-top: 2px; }
.lk-ayuda { margin: 4px 0 0; font-size: 12.5px; color: var(--dim); line-height: 1.45; }
.lk-elegir { display: flex; width: 100%; border: none; background: transparent; padding: 0; text-align: left; cursor: pointer; min-width: 0; color: inherit; }
.lk-fuente { display: flex; align-items: center; gap: 8px; width: 100%; font-size: 14px; color: var(--ink); padding: 6px 8px; border-radius: 8px; border: 1px solid var(--border); min-width: 0; box-sizing: border-box; }
.lk-fuente-nom { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-elegir:hover .lk-fuente { background: var(--surface-2); }
.lk-fuente-ico { width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; background: var(--primary-bg); color: var(--primary); flex: none; }
.lk-fuente-ico--chico { width: 18px; height: 18px; border-radius: 5px; }
.lk-fichas { display: flex; flex-direction: column; gap: 6px; }
.lk-ficha-fila { display: flex; align-items: center; gap: 4px; }
.lk-ficha-fila .lk-elegir { flex: 1; }
.lk-ficha { display: flex; align-items: center; width: 100%; height: 30px; border-radius: 15px; overflow: hidden; font-size: 13.5px; min-width: 0; }
.lk-ficha--dim { background: var(--good-bg); color: var(--good); }
.lk-ficha--met { background: var(--primary-bg); color: var(--primary); }
.lk-ficha-ico { display: grid; place-items: center; min-width: 34px; height: 100%; padding: 0 6px; box-sizing: border-box; border-right: 1px solid var(--border); }
.lk-ficha-txt { padding: 0 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-elegir:hover .lk-ficha { box-shadow: inset 0 0 0 999px var(--velo-hover); }
.lk-agg, .lk-tipo-campo { font-size: 10px; font-weight: 700; letter-spacing: .02em; }
.lk-agregar { display: inline-flex; align-items: center; height: 28px; padding: 0 4px; font-size: 13.5px; color: var(--primary); font-weight: 600; border: none; background: none; cursor: pointer; align-self: flex-start; }
.lk-quitar { flex: none; width: 26px; height: 26px; border: none; border-radius: 50%; background: transparent; color: var(--dim); cursor: pointer; font-size: 13px; }
.lk-quitar:hover { background: var(--velo-hover); color: var(--ink); }
.lk-radios { display: flex; flex-direction: column; gap: 6px; font-size: 13.5px; }
.lk-radios label, .lk-check { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--ink); }
.lk-radios input, .lk-check input { accent-color: var(--primary); margin: 0; }
.lk-input { width: 100%; box-sizing: border-box; height: 34px; border: 1px solid var(--border); border-radius: 8px; padding: 0 10px; font: inherit; font-size: 14px; color: var(--ink); background: var(--surface); }
.lk-input:focus { outline: none; border-color: var(--primary); }
.lk-select { display: inline-flex; align-items: center; justify-content: space-between; width: 100%; height: 34px; border: 1px solid var(--border); border-radius: 8px; padding: 0 6px 0 10px; font-size: 14px; color: var(--ink); box-sizing: border-box; }
.lk-campo-num { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13.5px; }
.lk-campo-num .lk-input { width: 130px; }
.lk-fechas { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; color: var(--dim); }
.lk-fechas label { display: flex; flex-direction: column; gap: 3px; }
.lk-botones { display: flex; gap: 10px; padding: 16px; align-items: center; flex-wrap: wrap; }

/* Los menús flotantes (portaleados al body: llevan la clase .lk ellos mismos). */
.lk-flotante { position: fixed; z-index: 580; background: var(--surface); color: var(--ink); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.18); padding: 6px 0; overflow-y: auto; box-sizing: border-box; max-width: calc(100vw - 16px); }
.lk-lista { display: flex; flex-direction: column; }
.lk-lista-grupo { font-size: 11.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dim); padding: 10px 16px 4px; }
.lk-opcion { display: flex; align-items: center; gap: 10px; width: 100%; border: none; background: transparent; padding: 8px 16px; font-size: 14px; color: var(--ink); text-align: left; cursor: pointer; }
.lk-opcion:hover:not(:disabled) { background: var(--velo-hover); }
.lk-opcion:disabled { color: var(--faint); cursor: default; }
.lk-opcion[aria-selected="true"], .lk-opcion[aria-checked="true"] { background: var(--primary-bg); color: var(--primary); }
.lk-opcion--peligro { color: var(--bad); }
.lk-opcion-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.lk-opcion-linea { font-size: 12px; color: var(--dim); }
.lk-opcion .lk-agg, .lk-opcion .lk-tipo-campo { width: 30px; color: var(--dim); }
.lk-sep-h { height: 1px; background: var(--border); margin: 4px 0; }
.lk-buscar { display: flex; align-items: center; gap: 8px; margin: 0 12px 8px; height: 36px; padding: 0 12px; border-radius: 18px; background: var(--surface-2); color: var(--dim); }
.lk-buscar input { flex: 1; min-width: 0; border: none; outline: none; font: inherit; font-size: 14px; background: transparent; color: var(--ink); }
.lk-buscar--lista { margin: 4px 8px 6px; }
.lk-buscar--modal { margin: 0 0 12px; height: 42px; border-radius: 21px; }

/* La galería «Añadir un gráfico», con los bloques de MaKo al final. */
.lk-galeria { padding: 4px 12px 10px; }
.lk-galeria-tit { font-size: 13px; color: var(--ink); margin: 10px 0 6px; font-weight: 600; }
.lk-galeria-fila { display: flex; flex-wrap: wrap; gap: 6px; }
.lk-galeria-tipo { display: grid; place-items: center; width: 50px; height: 42px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); cursor: pointer; padding: 0; color: var(--ink); }
.lk-galeria-tipo:hover { border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary); }
.lk-galeria-tipo[data-actual] { border-color: var(--primary); background: var(--primary-bg); }
.lk-bloques { display: flex; flex-direction: column; gap: 4px; }
.lk-bloque-op { display: flex; align-items: center; gap: 10px; width: 100%; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding: 8px 10px; text-align: left; cursor: pointer; color: var(--ink); }
.lk-bloque-op:hover { border-color: var(--primary); }
.lk-bloque-nom { font-size: 13.5px; font-weight: 600; }
.lk-bloque-linea { font-size: 12px; color: var(--dim); }

/* El estilo de la hoja (punto 8): plantillas con su muestra, el color y la letra. */
.lk-estilo { padding: 6px 14px 12px; display: flex; flex-direction: column; gap: 4px; }
.lk-estilo-tit { font-size: 12px; font-weight: 600; color: var(--dim); margin: 8px 0 4px; }
.lk-plantillas { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.lk-plantilla { display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg); padding: 8px; cursor: pointer; text-align: left; color: var(--ink); }
.lk-plantilla:hover { border-color: var(--primary); }
.lk-plantilla[aria-pressed="true"] { border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary); }
.lk-plantilla-nom { font-size: 13px; font-weight: 600; }
.lk-muestra { height: 58px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; padding: 7px 8px; overflow: hidden; }
.lk-muestra-tit { font-size: 10px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lk-muestra-barras { display: flex; align-items: flex-end; gap: 3px; height: 26px; }
.lk-muestra-barras span { flex: 1; display: block; }
.lk-colores { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.lk-color { width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--surface); box-shadow: 0 0 0 1px var(--border); cursor: pointer; padding: 0; }
.lk-color[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--ink); }
.lk-color-otro { position: relative; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 1px dashed var(--border-strong); border-radius: 14px; font-size: 12.5px; color: var(--dim); cursor: pointer; }
.lk-color-otro input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
.lk-letras { display: flex; flex-direction: column; }
.lk-letra { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; width: 100%; border: none; background: transparent; padding: 7px 8px; border-radius: 8px; cursor: pointer; color: var(--ink); text-align: left; }
.lk-letra:hover { background: var(--velo-hover); }
.lk-letra[aria-pressed="true"] { background: var(--primary-bg); color: var(--primary); }
.lk-letra-nom { font-size: 16px; }
.lk-letra-tipo { font-size: 11.5px; color: var(--dim); }

/* «Añadir datos». */
.lk-dato { display: flex; align-items: center; gap: 14px; width: 100%; border: none; background: transparent; padding: 10px 12px; border-radius: 10px; text-align: left; cursor: pointer; color: var(--ink); }
.lk-dato:hover { background: var(--velo-hover); }
.lk-dato-txt { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lk-dato-nom { font-size: 15px; }
.lk-dato-desc { font-size: 13px; color: var(--dim); }
.lk-dato-mas { font-size: 13.5px; color: var(--primary); font-weight: 600; }
.lk-darea-tit { font-size: 11.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dim); padding: 12px 12px 4px; }

/* Las tablas que dibuja app/dashboard/Grafico.tsx. */
.lk-tabla { flex: 1; min-height: 0; overflow: auto; }
.lk-tabla table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.lk-tabla th { text-align: right; font-family: 'Geist Mono', monospace; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: .08em; color: var(--dim); padding: 8px 10px; border-bottom: 1px solid var(--border); background: var(--dash-tarjeta-fondo, var(--surface)); position: sticky; top: 0; white-space: nowrap; }
.lk-tabla td { text-align: right; padding: 9px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--ink); }
.lk-tabla .lk-tabla-izq { text-align: left; max-width: 240px; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
.lk-tabla tbody tr:hover td { background: var(--surface-2); }
.lk-tabla-total td { font-weight: 600; border-bottom: none; border-top: 1px solid var(--border-strong); }
.lk-tabla-fuerte { font-weight: 600; }
.lk-tabla-barra { min-width: 130px; }
.lk-celda-barra { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
.lk-celda-num { flex: none; min-width: 52px; text-align: right; }
.lk-celda-pista { flex: 1; min-width: 50px; max-width: 120px; height: 10px; display: flex; background: var(--surface-2); border-radius: 5px; overflow: hidden; }
.lk-celda-pista span { display: block; height: 100%; border-radius: 5px; }
.lk-tabla-mas { margin: 8px 10px 0; font-family: 'Geist Mono', monospace; font-size: 12px; color: var(--faint); }

/* Celular: 16 px de margen y nada de scroll de costado. El panel de propiedades sube desde abajo. */
@media (max-width: 760px) {
  .lk-fila { padding: 8px 16px 0; }
  .lk-barra { margin: 6px 16px 0; }
  .lk-cab-hoja { padding: 14px 16px 4px; }
  .lk-cab-tit { font-size: 21px; }
  .lk-controles { padding: 8px 16px; }
  .lk-pagina { padding: 6px 16px 32px; }
  .lk-props { position: fixed; left: 0; right: 0; bottom: 0; width: auto; max-height: 62vh; border-left: none; border-top: 1px solid var(--border); border-radius: 16px 16px 0 0; z-index: 50; box-shadow: 0 -10px 30px rgba(0,0,0,.18); }
  .lk-hoja-tab { max-width: 180px; }
}

/* El PDF (punto 21): window.print() con todo el cromo escondido. Quedan la cabecera de la hoja, el
   período y los gráficos EN SU LUGAR: la grilla se imprime como una grilla CSS con las mismas columnas
   y filas que react-grid-layout (12 columnas, filas de 30 px, 16 px de espacio), para que cada tarjeta
   pueda no partirse entre dos páginas (break-inside no vale para lo que va en posición absoluta). Antes
   de imprimir la pantalla pasa el lienzo a 1040 px (lk--imprimir), el ancho útil de una A4 apaisada,
   así los gráficos se dibujan ya con su medida de papel. */
.lk-solo-imprimir { display: none; }
.lk--imprimir .lk-pagina { width: 1040px; padding-left: 0; padding-right: 0; }
/* Lo que imprimen los elementos (app/dashboard/Elemento.tsx y ElementoInsertado.tsx): la dirección de un
   enlace debajo de su texto, y en lugar de un reproductor o una página insertada, un recuadro con su
   título y su proveedor. SIN display acá: lo da el bloque de impresión, si no se vería en pantalla. */
.lk-imp-enlace { font-size: 11px; font-weight: 400; color: var(--dim); margin-top: 2px; overflow-wrap: anywhere; letter-spacing: 0; }
.lk-imp-caja { flex: 1; min-height: 0; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 10px; box-sizing: border-box; border: 1.5px dashed var(--border-strong); border-radius: var(--dash-tarjeta-radio, 16px); color: var(--dim); font-size: 13px; text-align: center; overflow: hidden; }
.lk-imp-tit { font-weight: 600; color: var(--ink); }
@media print {
  @page { size: A4 landscape; margin: 10mm; }
  aside[data-sidebar] { display: none !important; }
  body * { visibility: hidden !important; }
  .lk-app, .lk-app * { visibility: visible !important; }
  html, body { height: auto !important; overflow: visible !important; background: var(--bg) !important; }
  main:has(> .lk-app) { height: auto !important; overflow: visible !important; }
  .lk-app { position: absolute; left: 0; top: 0; width: 1040px; height: auto !important; display: block !important; }
  .lk-fila, .lk-barra, .lk-props, .lk-controles, .lk-comp-acciones, .lk-sin-imprimir, .lk-cuerpo > .an { display: none !important; }
  .lk-cuerpo, .lk-lienzo { display: block !important; overflow: visible !important; height: auto !important; }
  .lk-cab-hoja { padding: 0 0 10px; }
  .lk-solo-imprimir { display: block !important; }
  .lk-solo-imprimir.lk-imp-caja { display: flex !important; }
  .lk-comp--elemento iframe, .lk-comp--elemento video { display: none !important; }
  .lk-pagina { width: 1040px; padding: 0 !important; }
  .lk .react-grid-layout { display: grid !important; grid-template-columns: repeat(12, minmax(0, 1fr)); grid-auto-rows: 30px; gap: 16px; height: auto !important; }
  .lk .react-grid-item { position: relative !important; transform: none !important; left: auto !important; top: auto !important; width: auto !important; height: auto !important; grid-column: var(--lk-col); grid-row: var(--lk-fila); break-inside: avoid; page-break-inside: avoid; }
  .lk .react-resizable-handle, .lk .react-grid-placeholder { display: none !important; }
  .lk-comp { box-shadow: none !important; outline: none !important; }
  .lk-app * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
