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
// ⚠️ La BÚSQUEDA y el FILTRO viven en la topbar (.lk-top, tanda del 11/10: «Los botones de filtro también en
//    la topbar»; desde v5 una barra de búsqueda y UN botón «Filtro», ./BarraControles.tsx), que NO scrollea:
//    queda arriba siempre, sin sticky. Lo que scrollea es .lk-lienzo, y sólo
//    si el <main> tiene ALTO: lo fija app/dashboard/page.tsx (sin eso scrollea el documento y la topbar
//    se va con la página).
// ⚠️ Las tarjetas leen el TEMA de la hoja por variables (--dash-*, varsDeTema en
//    lib/graficos-temas.ts) con su respaldo: una hoja sin tema se ve como la de MaKo.

export const CSS = `
.lk { --lk-azul: var(--primary); --lk-azul-claro: var(--primary-bg); --lk-verde: var(--good); --lk-verde-claro: var(--good-bg); --lk-tinta: var(--ink); --lk-gris: var(--dim); --lk-borde: var(--border); --lk-barra: var(--surface-2); --lk-lienzo: var(--bg); font-family: 'Geist', system-ui, sans-serif; color: var(--ink); }
.lk button { font-family: inherit; }
.lk-app { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--bg); min-width: 0; }
/* Quien nunca guardó un informe: el lienzo vacío con «Nuevo Dashboard» en el medio (EditorInforme, enBlanco). */
.lk-en-blanco { min-height: calc(100dvh - 200px); padding: 0; }
.lk-en-blanco-crear { display: flex; flex-direction: column; gap: 16px; max-width: 1080px; margin: 0 auto; padding: 36px 24px 56px; box-sizing: border-box; }

/* La TOPBAR, como la de Looker (tanda del 11/10): a la izquierda el emoji y, apilados, el título de la hoja
   (con su ▾) y el subtítulo, donde Looker pone «Archivo · Vista · Página · Ayuda»; a la derecha los
   filtros, Compartir, Editar y el ⋮. Sin filete abajo: una sola superficie con el lienzo (punto 16). No
   scrollea (está afuera de .lk-lienzo), así que los filtros quedan siempre a la vista. El título NO lleva
   nowrap: uno largo baja de renglón, no se corta (es un contentEditable, mide lo que dice). Y el título
   editable no lleva el par padding / margin negativo «para que el foco respire»: si el padre se mide por
   el hijo, el margen negativo se descuenta dos veces (AGENTS.md, «Un ancho que sale de una métrica
   tipográfica…»). */
.lk-top { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 16px; padding: 12px 16px 10px 20px; flex: none; min-width: 0; background: var(--bg); }
/* EDITANDO, la franja de arriba entera (la topbar y la barra de edición) se separa del lienzo: superficie, filete
   y una sombra chica, como el cromo blanco de Looker sobre su lienzo gris (tanda v5, punto 10). Mirando no cambia
   nada, y la topbar tiene el MISMO padding en los dos modos: no salta al apretar Editar. Va sobre los dos
   hermanos (.lk-top y la .lk-barra que sigue) y no sobre un envoltorio: así no depende de cómo los arme la
   pantalla. */
.lk--editando .lk-top { background: var(--surface); }
.lk--editando .lk-barra { background: var(--surface); margin: 0; border-radius: 0; padding: 2px 16px 6px; border-bottom: 1px solid var(--border); box-shadow: 0 2px 6px rgba(18, 21, 27, .06); position: relative; z-index: 2; }
.lk-top-izq { flex: 1 1 280px; min-width: 0; display: flex; align-items: center; gap: 10px; }
.lk-top-emoji { flex: none; display: grid; place-items: center; width: 42px; height: 42px; font-size: 28px; line-height: 1; }
.lk-top-emoji--btn { border: none; border-radius: 10px; background: transparent; cursor: pointer; padding: 0; color: var(--faint); }
.lk-top-emoji--btn:hover, .lk-top-emoji--btn[aria-expanded="true"] { background: var(--velo-hover); }
.lk-top-emoji--btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.lk-top-textos { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.lk-top-fila { display: flex; align-items: center; gap: 2px; min-width: 0; }
.lk-top-tit { margin: 0; min-width: 0; font-size: 21px; font-weight: 600; letter-spacing: -0.015em; line-height: 1.25; color: var(--ink); overflow-wrap: anywhere; }
.lk-top-tit .edin { padding: 1px 4px; border-radius: 6px; }
.lk-top-tit .edin:hover { background: var(--velo-hover); }
.lk-top-tit-btn { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; border: none; background: transparent; padding: 1px 4px; border-radius: 6px; font: inherit; color: inherit; cursor: pointer; text-align: left; }
.lk-top-tit-btn > span { min-width: 0; overflow-wrap: anywhere; }
.lk-top-tit-btn:hover, .lk-top-tit-btn[aria-expanded="true"] { background: var(--velo-hover); }
.lk-top-hojas { flex: none; display: grid; place-items: center; width: 28px; height: 28px; border: none; border-radius: 8px; background: transparent; color: var(--dim); cursor: pointer; padding: 0; }
.lk-top-hojas:hover, .lk-top-hojas[aria-expanded="true"] { background: var(--velo-hover); color: var(--ink); }
.lk-top-hojas:focus-visible, .lk-top-tit-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.lk-top-sub { margin: 0; min-width: 0; font-size: 13px; color: var(--dim); line-height: 1.4; overflow-wrap: anywhere; }
.lk-top-sub .edin { padding: 0 4px; border-radius: 5px; }
.lk-top-sub .edin:hover { background: var(--velo-hover); }
/* Buscar, Filtro, Editar y ⋮ van en UNA fila (12/10/2026: «quedaron todos desfazados»). Con flex: 0 1 auto el
   título (flex: 1 1 280px) se quedaba con el ancho y esta fila se encogía al del buscador: «Filtro» bajaba de
   renglón y Editar y ⋮ quedaban centrados entre los dos. Si no entra al lado del título, la fila ENTERA baja. */
.lk-top-der { display: flex; align-items: center; flex-wrap: nowrap; justify-content: flex-end; gap: 8px; margin-left: auto; min-width: 0; flex: none; }
.lk-top-filtros { display: flex; min-width: 0; }
.lk-top-der .bc-barra { flex-wrap: nowrap; }
.lk-top-filtros:empty { display: none; }
.lk-cab-periodo { margin: 4px 0 0; font-size: 13px; color: var(--dim); }
.lk-pill { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 18px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink); font-size: 13.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.lk-pill:hover:not(:disabled) { background: var(--surface-2); }
.lk-pill:disabled { opacity: .5; cursor: default; }
.lk-pill--azul { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
.lk-pill--azul:hover:not(:disabled) { background: var(--primary-strong); border-color: var(--primary-strong); }
.lk-pill--icono { width: 36px; padding: 0; justify-content: center; }
.lk-pill--rojo { color: var(--bad); }
.lk-mas { position: relative; font-size: 18px; line-height: 1; }

/* El desplegable de las hojas (en un Flotante): «Nueva hoja» primera, y las hojas con su ⋮. */
.lk-hoja-nueva { display: block; padding: 4px 10px 6px; }
/* La FILA entera se pinta (tanda v5, punto 5): el hover y la abierta pintaban sólo el botón de la hoja, y el ⋮,
   el espacio y el margen quedaban con el fondo del panel, una franja blanca. El botón de adentro no tiene fondo
   propio; el ⋮ lleva un velo encima (box-shadow inset: le gana a cualquier fondo) mientras su submenú esté
   abierto. */
.lk-hoja-fila { display: flex; align-items: center; gap: 2px; padding-right: 8px; min-width: 0; }
.lk-hoja-fila:hover, .lk-hoja-fila[data-opciones] { background: var(--velo-hover); }
.lk-hoja-fila[data-activa] { background: var(--primary-bg); }
.lk-hoja-fila .lk-hoja-op, .lk-hoja-fila .lk-hoja-op:hover:not(:disabled), .lk-hoja-fila .lk-hoja-op[aria-checked="true"] { background: transparent; }
.lk-hoja-fila[data-activa] .lk-hoja-op { color: var(--primary); }
.lk-hoja-op { flex: 1 1 auto; min-width: 0; gap: 8px; }
.lk-hoja-marca { flex: none; display: inline-flex; width: 16px; justify-content: center; color: var(--primary); }
.lk-hoja-nombre { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-hoja-mas { flex: none; border: none; background: transparent; width: 26px; height: 28px; border-radius: 8px; color: var(--dim); cursor: pointer; font-size: 16px; opacity: 0; transition: opacity .12s; }
.lk-hoja-fila:hover .lk-hoja-mas, .lk-hoja-fila[data-activa] .lk-hoja-mas, .lk-hoja-mas:focus-visible, .lk-hoja-mas[aria-expanded="true"] { opacity: 1; }
.lk-hoja-mas:hover, .lk-hoja-mas[aria-expanded="true"] { box-shadow: inset 0 0 0 999px var(--velo-hover); color: var(--ink); }
.lk-hoja-input { font: inherit; font-size: 14px; border: 1px solid var(--primary); border-radius: 6px; padding: 6px 8px; margin: 2px 10px; width: calc(100% - 20px); outline: none; background: var(--surface); color: var(--ink); box-sizing: border-box; }
.lk-hojas-vacio { padding: 8px 16px; font-size: 13px; color: var(--dim); }

/* La barra de edición: DEBAJO de la topbar, así la topbar no se mueve al apretar Editar. En el orden de
   la de Looker; lo que se inserta va suelto (un ícono por cosa) y «Estilo de la hoja» a la derecha. */
.lk-barra { display: flex; align-items: center; gap: 2px; background: var(--surface-2); border-radius: 12px; padding: 4px 8px; margin: 0 16px; flex-wrap: wrap; flex: none; }
.lk-herr { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border: none; border-radius: 10px; background: transparent; color: var(--ink); font-size: 13.5px; cursor: pointer; white-space: nowrap; }
.lk-herr:hover:not(:disabled), .lk-herr[aria-expanded="true"] { background: var(--velo-hover); }
.lk-herr:disabled { color: var(--faint); cursor: default; }
.lk-herr:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.lk-herr--icono { width: 34px; padding: 0; justify-content: center; }
.lk-herr--menu { gap: 0; padding: 0 2px 0 8px; }
.lk-herr--fin { margin-left: auto; }
.lk-sep { width: 1px; height: 22px; background: var(--border); margin: 0 6px; }
.lk-insertar { display: inline-flex; align-items: center; }
.lk-ins-sueltos { display: inline-flex; align-items: center; gap: 2px; }
.lk-ins-menu { display: none; }

/* El cuerpo: el lienzo (lo único que scrollea) y, con algo elegido, el panel de propiedades. */
.lk-cuerpo { flex: 1; min-height: 0; display: flex; align-items: stretch; min-width: 0; }
.lk-lienzo { flex: 1; min-width: 0; overflow-y: auto; overflow-x: hidden; background: var(--bg); }
.lk-pagina { padding: 14px 24px 40px; box-sizing: border-box; min-width: 0; }
/* La vista por dispositivo de la edición (./EditorInforme.tsx, DISPOSITIVOS): la página al ancho del dispositivo, con
   su marco. El ancho lo mide el editor (useContainerWidth), así que por debajo de 640 px es la pila del celular. */
.lk-lienzo[data-dispositivo] { background: var(--surface-2); }
.lk-pagina[data-dispositivo] { margin: 18px auto 32px; background: var(--bg); border: 1px solid var(--border-strong); }
.lk-pagina[data-dispositivo="tableta"] { width: 820px; max-width: calc(100% - 32px); border-radius: 22px; padding: 18px 18px 36px; }
.lk-pagina[data-dispositivo="movil"] { width: 390px; max-width: calc(100% - 32px); border-radius: 30px; padding: 16px 12px 36px; }
.lk-disp { display: inline-flex; align-items: center; gap: 2px; }
.lk-disp .lk-herr[aria-pressed="true"] { background: var(--velo-hover); color: var(--primary); }
.lk-vacio { display: grid; place-items: center; gap: 12px; padding: 120px 0; color: var(--dim); font-size: 14px; text-align: center; }
.lk-vacio p { margin: 0; }
.lk-pila { display: flex; flex-direction: column; gap: 12px; }

/* Las tarjetas: las de MaKo, con el tema de la hoja. */
.lk-comp { display: flex; flex-direction: column; gap: 10px; padding: var(--dash-tarjeta-pad, 20px 22px); box-sizing: border-box; background: var(--dash-tarjeta-fondo, var(--surface)); border: 1px solid var(--dash-tarjeta-borde, var(--border)); border-radius: var(--dash-tarjeta-radio, 16px); box-shadow: var(--dash-tarjeta-sombra, none); overflow: hidden; font-family: var(--dash-letra, 'Geist', system-ui, sans-serif); color: var(--ink); min-width: 0; }
.lk-comp--filete { border-top: 3px solid var(--lk-filete, var(--border-strong)); }
.lk-comp--elemento { background: transparent; border-color: transparent; box-shadow: none; padding: 0; }
/* Un bloque de General es una TARJETA DE LA HOJA, como un gráfico (14/10/2026, Martín: «no están interactuando con el
   diseño de la página»): el marco del tema, y adentro el bloque (app/general/bloques/comun.tsx). --gb-fondo es el fondo
   de la tarjeta, para lo que se dibuja ENCIMA de ella (la caja del placeholder, las tarjetas del Plan). Con «Fondo:
   Oscuro» (lib/general-piezas.ts) la tarjeta entera es la isla oscura: los tokens los da vuelta ./ElementoGeneral.tsx. */
.lk-comp--general { gap: 0; --gb-fondo: var(--dash-tarjeta-fondo, var(--surface)); }
.lk-comp--general:has(> .gen-pieza[data-oscuro]) { background: var(--sidebar); border-color: var(--sidebar-line); }
.lk-comp--kpi { justify-content: center; }
.lk--editando .lk-comp { cursor: move; }
.lk--editando .lk-comp:hover { outline: 1px dashed var(--border-strong); outline-offset: -1px; }
.lk-comp--sel, .lk--editando .lk-comp--sel:hover { outline: 2px solid var(--primary) !important; outline-offset: -1px; }
.lk-comp-cab { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }
.lk-comp-tit { flex: 1 1 auto; display: flex; align-items: center; gap: 6px; min-width: 0; font-size: var(--dash-titulo-tam, 19px); font-weight: var(--dash-titulo-peso, 600); text-transform: var(--dash-titulo-mayus, none); letter-spacing: var(--dash-titulo-espacio, -0.015em); line-height: 1.25; color: var(--ink); }
.lk-comp-tit > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-comp--kpi .lk-comp-tit { font-size: 14px; color: var(--dim); }
.lk-comp--mono .lk-comp-tit { font-family: 'Geist Mono', monospace; font-weight: 400; font-size: 13px; text-transform: uppercase; letter-spacing: .1em; color: var(--dim); }
.lk-comp-sub { margin-top: -6px; font-size: 13px; color: var(--faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lk-comp-acciones { flex: none; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; max-width: 70%; cursor: default; }
.lk-mako { display: inline-flex; transition: opacity .15s; }
.lk-comp--kpi .lk-mako { opacity: 0; }
.lk-comp--kpi:hover .lk-mako, .lk-comp--kpi:focus-within .lk-mako { opacity: 1; }
.lk-mini-giro { width: 10px; height: 10px; border: 2px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: lkGiro .8s linear infinite; flex: none; }
@keyframes lkGiro { to { transform: rotate(360deg); } }
.lk .recharts-wrapper *:focus, .lk .recharts-surface:focus { outline: none; }
.lk .react-grid-item.react-grid-placeholder { background: var(--primary); opacity: .15; border-radius: 12px; }
/* Los ocho tiradores (14/10/2026, Martín: «Debería poder editar el tamaño de un bloque desde cualquiera de sus costados...
   Y elimina la flecha que aparece detrás del contorno azul»). La «flecha» era el ::after de react-grid-layout (un ángulo
   girado por lado). Cada lado es una franja de 8 px ADENTRO del borde —la tarjeta recorta con overflow: hidden, afuera no
   se vería— con su cursor; las esquinas, 14 px. Elegida, la tarjeta muestra un cuadradito blanco en cada uno de los ocho,
   como Looker: dice que de ahí se agarra. Sin elegir no se dibuja nada (la franja sigue: el cursor avisa). */
.lk .react-grid-item > .react-resizable-handle { opacity: 1; background: none; transform: none; margin: 0; z-index: 3; }
.lk .react-grid-item > .react-resizable-handle::after { content: none; }
.lk .react-grid-item > .react-resizable-handle-n, .lk .react-grid-item > .react-resizable-handle-s { left: 14px; right: 14px; width: auto; height: 8px; }
.lk .react-grid-item > .react-resizable-handle-n { top: 0; }
.lk .react-grid-item > .react-resizable-handle-s { bottom: 0; }
.lk .react-grid-item > .react-resizable-handle-e, .lk .react-grid-item > .react-resizable-handle-w { top: 14px; bottom: 14px; width: 8px; height: auto; }
.lk .react-grid-item > .react-resizable-handle-e { right: 0; }
.lk .react-grid-item > .react-resizable-handle-w { left: 0; }
.lk .react-grid-item > :is(.react-resizable-handle-ne, .react-resizable-handle-nw, .react-resizable-handle-se, .react-resizable-handle-sw) { width: 14px; height: 14px; z-index: 4; }
.lk .react-grid-item.lk-comp--sel > .react-resizable-handle::after { content: ''; position: absolute; width: 7px; height: 7px; box-sizing: border-box; background: var(--surface); border: 1.5px solid var(--primary); border-radius: 2px; inset: auto; }
.lk .react-grid-item.lk-comp--sel > .react-resizable-handle-n::after { top: 0; left: calc(50% - 3.5px); }
.lk .react-grid-item.lk-comp--sel > .react-resizable-handle-s::after { bottom: 0; left: calc(50% - 3.5px); }
.lk .react-grid-item.lk-comp--sel > .react-resizable-handle-e::after { right: 0; top: calc(50% - 3.5px); }
.lk .react-grid-item.lk-comp--sel > .react-resizable-handle-w::after { left: 0; top: calc(50% - 3.5px); }
.lk .react-grid-item.lk-comp--sel > .react-resizable-handle-ne::after { top: 0; right: 0; }
.lk .react-grid-item.lk-comp--sel > .react-resizable-handle-nw::after { top: 0; left: 0; }
.lk .react-grid-item.lk-comp--sel > .react-resizable-handle-se::after { bottom: 0; right: 0; }
.lk .react-grid-item.lk-comp--sel > .react-resizable-handle-sw::after { bottom: 0; left: 0; }
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
.lk-opcion--mako { position: relative; font-weight: 600; }
.lk-opcion-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.lk-opcion-linea { font-size: 12px; color: var(--dim); }
.lk-opcion .lk-agg, .lk-opcion .lk-tipo-campo { width: 30px; color: var(--dim); }
.lk-sep-h { height: 1px; background: var(--border); margin: 4px 0; }
.lk-buscar { display: flex; align-items: center; gap: 8px; margin: 0 12px 8px; height: 36px; padding: 0 12px; border-radius: 18px; background: var(--surface-2); color: var(--dim); }
.lk-buscar input { flex: 1; min-width: 0; border: none; outline: none; font: inherit; font-size: 14px; background: transparent; color: var(--ink); }
.lk-buscar--lista { margin: 4px 8px 6px; }
.lk-buscar--modal { margin: 0 0 12px; height: 42px; border-radius: 21px; }

/* La galería «Añadir un gráfico». */
.lk-galeria { padding: 4px 12px 10px; }
/* «Bloques de General»: tres por fila, cada uno con su vista previa (el bloque con datos de ejemplo, a escala). La
   escala es fija (el ancho de la tarjeta es fijo: el flotante mide 812): 640 px de bloque en 230 de vista. */
.lk-bloques { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding: 10px 12px 12px; }
@media (max-width: 760px) { .lk-bloques { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.lk-bloque { display: flex; flex-direction: column; gap: 3px; padding: 0; border: none; background: none; text-align: left; cursor: pointer; font: inherit; color: var(--ink); min-width: 0; }
.lk-bloque-vista { position: relative; display: block; height: 150px; margin-bottom: 6px; border-radius: 10px; overflow: hidden; background: var(--surface); box-shadow: 0 0 0 1px var(--border); pointer-events: none; transition: box-shadow .12s; }
.lk-bloque:hover .lk-bloque-vista, .lk-bloque:focus-visible .lk-bloque-vista { box-shadow: 0 0 0 2px var(--primary); }
.lk-bloque-escala { position: absolute; left: 0; top: 0; width: 640px; padding: 18px; box-sizing: border-box; transform: scale(.36); transform-origin: top left; }
.lk-bloque-nombre { font-size: 13.5px; font-weight: 600; }
.lk-bloque-linea { font-size: 12px; color: var(--dim); line-height: 1.35; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.lk-galeria-tit { font-size: 13px; color: var(--ink); margin: 10px 0 6px; font-weight: 600; }
.lk-galeria-fila { display: flex; flex-wrap: wrap; gap: 6px; }
.lk-galeria-tipo { display: grid; place-items: center; width: 50px; height: 42px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); cursor: pointer; padding: 0; color: var(--ink); }
.lk-galeria-tipo:hover { border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary); }
.lk-galeria-tipo[data-actual] { border-color: var(--primary); background: var(--primary-bg); }

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

/* Celular: 16 px de margen y nada de scroll de costado. El panel de propiedades sube desde abajo. */
@media (max-width: 760px) {
  .lk-top { padding: 10px 16px 8px; }
  .lk-top-tit { font-size: 19px; }
  .lk-top-emoji { width: 36px; height: 36px; font-size: 24px; }
  .lk-top-der { margin-left: 0; justify-content: flex-start; flex: 1 1 100%; flex-wrap: wrap; }
  .lk-top-der .bc-barra { flex-wrap: wrap; }
  .lk-barra { margin: 0 16px; }
  .lk--editando .lk-barra { margin: 0; padding: 2px 16px 6px; }
  .lk-ins-sueltos { display: none; }
  .lk-ins-menu { display: inline-flex; }
  .lk-pagina { padding: 10px 16px 32px; }
  .lk-props { position: fixed; left: 0; right: 0; bottom: 0; width: auto; max-height: 62vh; border-left: none; border-top: 1px solid var(--border); border-radius: 16px 16px 0 0; z-index: 50; box-shadow: 0 -10px 30px rgba(0,0,0,.18); }
}

/* El PDF (punto 21): window.print() con todo el cromo escondido. Quedan el título de la hoja (la mitad
   izquierda de la topbar, sin el ▾ ni el placeholder de lo vacío), el período y los gráficos EN SU LUGAR:
   la grilla se imprime como una grilla CSS con las mismas columnas
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
  .lk-top-der, .lk-top-hojas, .lk-barra, .lk-props, .lk-comp-acciones, .lk-sin-imprimir, .lk-cuerpo > .an { display: none !important; }
  .lk-cuerpo, .lk-lienzo { display: block !important; overflow: visible !important; height: auto !important; }
  .lk-top { padding: 0 0 10px; background: transparent !important; box-shadow: none !important; border: 0 !important; }
  .lk-top-emoji--vacio { display: none !important; }
  .lk-top .edin[data-vacio]::before { content: '' !important; }
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
