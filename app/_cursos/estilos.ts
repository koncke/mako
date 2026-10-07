/**
 * Lo que el dibujo de un curso (./CursoUgc.tsx) tiene y la hoja del origen no: el estado de cada
 * módulo (hecho, actual, con candado), los chips por tono, los controles de quien edita, el modo
 * EMBEBIDO adentro de la app y el menú del teléfono.
 *
 * Por qué acá y no en public/cono-doc/ugc.css: esa hoja la ARMA scripts/avatarhype-css.mjs desde
 * un CSS capturado del origen, y lo escrito a mano va en su cola. Esto no es del origen —es de las
 * pantallas que montan CursoUgc— y vive al lado de su componente, que lo pinta en un <style>
 * adentro del curso. Va DESPUÉS de la hoja del origen en el documento (ella está en el <head>), así
 * que con la misma especificidad gana; contra un `!important` de la cola, lleva el suyo.
 *
 * ⚠️ TODO VA BAJO `.ahdoc.ahdoc--ugc`: CursoReplica (Conocimientos) comparte la hoja del origen y
 *    NO monta este dibujo. Sin el acote, el menú del teléfono le escondería la barra a una
 *    pantalla que no tiene el botón para abrirla.
 * ⚠️ Esta cadena es un template literal: ni un acento grave ni la secuencia de interpolación, ni
 *    siquiera en un comentario (AGENTS.md). Los cortan en silencio y la pantalla sale sin estilo.
 */
export const CSS_UGC = `
/* ── El estado de cada modulo: hecho, actual, con candado ─────────────────────── */
.ahdoc.ahdoc--ugc .ugc .ugc-ico { display: block; flex: none; }
.ahdoc.ahdoc--ugc .ugc .ugc-nav-item.is-bloqueada { opacity: .42; cursor: not-allowed; }
.ahdoc.ahdoc--ugc .ugc .ugc-nav-item.is-bloqueada:hover { transform: none; background: transparent; }
.ahdoc.ahdoc--ugc .ugc .ugc-nav-candado { display: inline-flex; align-items: center; }
.ahdoc.ahdoc--ugc .ugc .ugc-nav-item.is-hecha:not(.on) .ugc-nav-num {
  background: var(--u-lime); border-color: var(--u-lime); color: var(--u-ink);
}
/* La etapa en la que esta el alumno se ve aunque no sea la abierta: es la respuesta a por donde sigo. */
.ahdoc.ahdoc--ugc .ugc .ugc-nav-item.is-actual:not(.on) { box-shadow: inset 0 0 0 1.5px var(--u-lime); }

.ahdoc.ahdoc--ugc .ugc .ugc-modcard.is-bloqueada { cursor: not-allowed; }
.ahdoc.ahdoc--ugc .ugc .ugc-modcard.is-bloqueada:hover { transform: none; box-shadow: none; border-color: var(--u-line); }
.ahdoc.ahdoc--ugc .ugc .ugc-modcard.is-bloqueada .ugc-modcard-cover { filter: grayscale(1); opacity: .5; }
.ahdoc.ahdoc--ugc .ugc .ugc-modcard.is-actual { border-color: var(--u-ink); box-shadow: var(--u-sh-md); }
.ahdoc.ahdoc--ugc .ugc .ugc-modcard-candado,
.ahdoc.ahdoc--ugc .ugc .ugc-modcard-ok {
  position: absolute; top: 10px; right: 10px; z-index: 3;
  width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--u-ink);
  display: grid; place-items: center; color: var(--u-ink);
}
.ahdoc.ahdoc--ugc .ugc .ugc-modcard-candado { background: var(--u-card); }
.ahdoc.ahdoc--ugc .ugc .ugc-modcard-ok { background: var(--u-lime); }
.ahdoc.ahdoc--ugc .ugc .ugc-modcard-lock {
  display: inline-flex; align-items: center; gap: 6px; margin-top: 8px;
  font-family: var(--font-jetbrains), monospace; font-size: 10.5px; color: var(--u-ink-60);
}
.ahdoc.ahdoc--ugc .ugc .ugc-modcard-prog { margin-top: 10px; }
.ahdoc.ahdoc--ugc .ugc .ugc-bloqueado { display: flex; flex-direction: column; align-items: center; gap: 10px; }

/* ── Los chips de una clase, por tono ──────────────────────────────────────────── */
.ahdoc.ahdoc--ugc .ugc .ugc-modcard-body .ugc-chips { margin-top: 10px; }
.ahdoc.ahdoc--ugc .ugc .ugc-chip { white-space: nowrap; box-shadow: none; padding: 4px 9px; }
.ahdoc.ahdoc--ugc .ugc .ugc-chip--lima { background: var(--u-lime); }
.ahdoc.ahdoc--ugc .ugc .ugc-chip--aviso { background: #ffe2a3; }
.ahdoc.ahdoc--ugc .ugc .ugc-chip--tinta { background: var(--u-ink); color: var(--u-paper); }
.ahdoc.ahdoc--ugc .ugc .ugc-chip--neutro { background: var(--u-card-2); color: var(--u-ink-60); border-color: var(--u-ink-40); }

/* ── La cabecera del modulo abierto: su nombre y sus acciones ─────────────────── */
.ahdoc.ahdoc--ugc .ugc .ugc-rail-head { flex-wrap: wrap; }
.ahdoc.ahdoc--ugc .ugc .ugc-rail-acciones { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-left: auto; }

/* ── Lo que trae cada pantalla: arriba, una entrada propia, debajo del video ──── */
.ahdoc.ahdoc--ugc .ugc .ugc-side-pie {
  flex: none; padding: 12px 18px 16px; border-top: 1.5px solid var(--u-night-line);
  font: 600 10px/1.4 var(--font-jetbrains), monospace; letter-spacing: .06em; color: var(--u-night-mut);
}
.ahdoc.ahdoc--ugc .ugc .ugc-arriba {
  flex: 0 0 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 0 0 16px;
}
.ahdoc.ahdoc--ugc .ugc .ugc-extra { padding: 0 0 28px; }
.ahdoc.ahdoc--ugc .ugc .ugc-debajo { margin-top: 16px; display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.ahdoc.ahdoc--ugc .ugc .ugc-paper > * + * { margin-top: 12px; }
.ahdoc.ahdoc--ugc .ugc .ugc-paper .ugc-paper-title { margin: 0 0 4px; }
.ahdoc.ahdoc--ugc .ugc .ugc-paper .ugc-doc-p { white-space: pre-wrap; overflow-wrap: anywhere; }

/* ── Los botones de la APP adentro del curso ───────────────────────────────────
 * La hoja del origen resetea todo button de .ahdoc (sin fondo, sin borde, color heredado), y le
 * gana a la clase de un Button de la app: la tarea, las notas y el avance quedaban con un Enviar
 * que se leia como texto suelto. Se visten como los botones del curso. */
.ahdoc.ahdoc--ugc .mk-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  min-height: 36px; padding: 0 14px; border-radius: 9px; cursor: pointer;
  font: 600 12px/1 var(--font-jetbrains), monospace; color: var(--u-ink);
  background: var(--u-card-2); border: 2px solid var(--u-ink); box-shadow: var(--u-sh-sm);
  transition: transform .12s, box-shadow .12s;
}
.ahdoc.ahdoc--ugc .mk-btn--primary { background: var(--u-lime); font-weight: 800; }
.ahdoc.ahdoc--ugc .mk-btn--danger { background: #f6c9c1; }
.ahdoc.ahdoc--ugc .mk-btn--tertiary { background: transparent; border-color: transparent; box-shadow: none; }
.ahdoc.ahdoc--ugc .mk-btn:hover:not(:disabled) { transform: translate(-1px, -1px); box-shadow: var(--u-sh-md); }
.ahdoc.ahdoc--ugc .mk-btn--tertiary:hover:not(:disabled) { transform: none; box-shadow: none; background: var(--u-card-2); }
.ahdoc.ahdoc--ugc .mk-btn:disabled { opacity: .5; cursor: default; transform: none; box-shadow: none; }

/* ── Quien edita: ordenar, borrar y agregar ────────────────────────────────────── */
.ahdoc.ahdoc--ugc .ugc .ugc-editable { position: relative; display: flex; min-width: 0; }
.ahdoc.ahdoc--ugc .ugc .ugc-editable > .ugc-modcard { width: 100%; }
.ahdoc.ahdoc--ugc .ugc .ugc-editable-ctrls {
  position: absolute; top: 10px; right: 10px; z-index: 4; display: flex; gap: 4px;
  opacity: 0; transition: opacity .12s;
}
.ahdoc.ahdoc--ugc .ugc .ugc-editable:hover .ugc-editable-ctrls,
.ahdoc.ahdoc--ugc .ugc .ugc-editable:focus-within .ugc-editable-ctrls { opacity: 1; }
/* Sin mouse no hay hover: en una pantalla tactil los controles estan siempre. */
@media (hover: none) { .ahdoc.ahdoc--ugc .ugc .ugc-editable-ctrls { opacity: 1; } }
.ahdoc.ahdoc--ugc .ugc .ugc-editable-btn {
  width: 28px; height: 28px; display: grid; place-items: center; padding: 0;
  border: 2px solid var(--u-ink); border-radius: 8px; background: var(--u-card); color: var(--u-ink);
  font: 800 13px/1 var(--font-jetbrains), monospace; cursor: pointer; box-shadow: var(--u-sh-sm);
}
.ahdoc.ahdoc--ugc .ugc .ugc-editable-btn:disabled { opacity: .35; cursor: default; box-shadow: none; }
.ahdoc.ahdoc--ugc .ugc .ugc-editable-btn--borrar:hover:not(:disabled) { background: #f6c9c1; }
.ahdoc.ahdoc--ugc .ugc .ugc-modcard--nueva {
  min-height: 190px; align-items: center; justify-content: center;
  background: transparent; border: 2px dashed var(--u-ink-40); box-shadow: none;
}
.ahdoc.ahdoc--ugc .ugc .ugc-modcard--nueva:hover { border-color: var(--u-ink); background: var(--u-card); }
.ahdoc.ahdoc--ugc .ugc .ugc-modcard--nueva:disabled { opacity: .5; cursor: default; transform: none; }
.ahdoc.ahdoc--ugc .ugc .ugc-modcard-nueva-t { font: 700 13px/1 var(--font-jetbrains), monospace; }
.ahdoc.ahdoc--ugc .ugc .ugc-ltitle-fila { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.ahdoc.ahdoc--ugc .ugc .ugc-ltitle-editar:disabled { opacity: .5; cursor: default; }

/* ── Embebido: el curso vive adentro de una pantalla de la app ─────────────────
 * La cola del origen lo arma como una app de 100vh y traba el scroll del documento
 * (html:has(.ahdoc)). Adentro de la app eso deja sin scroll a todo lo que esta arriba
 * del curso: aca el alto lo da el CONTENEDOR (un flex en columna con alto) y el documento
 * scrollea como siempre.
 * El alto baja por FLEX, nunca por porcentaje: contra el alto de un hijo de flex, Safari
 * resuelve un 100% en cero y el curso queda en blanco (AGENTS.md, dos reglas de layout).
 * Y con base 0, no auto: con auto la base es el contenido entero y el curso empuja la pagina. */
html:has(.ahdoc--embebido), body:has(.ahdoc--embebido) { overflow: visible !important; height: auto !important; }
.ahdoc.ahdoc--ugc.ahdoc--embebido {
  height: auto !important; flex: 1 1 0; min-height: 0; display: flex; flex-direction: column;
}
.ahdoc.ahdoc--ugc.ahdoc--embebido > .ugc {
  height: auto !important; flex: 1 1 0; min-height: 0; display: flex; flex-direction: column;
}
.ahdoc.ahdoc--ugc.ahdoc--embebido .ugc .ugc-shell { height: auto !important; flex: 1 1 0; min-height: 0 !important; }
.ahdoc.ahdoc--ugc.ahdoc--embebido .ugc .ugc-side,
.ahdoc.ahdoc--ugc.ahdoc--embebido .ugc .ugc-main { height: auto !important; max-height: none !important; align-self: stretch !important; }
.ahdoc.ahdoc--ugc.ahdoc--embebido .ugc .ugc-content > .ugc-split > .ugc-pcol { max-height: none !important; }

/* ── El telefono: la barra se vuelve una franja con un menu ────────────────────
 * La hoja del origen deja la barra de 268px al lado del contenido en cualquier ancho; a 390px
 * el contenido se queda con 120. Aca la marca y el boton de los modulos van arriba, y la lista
 * se despliega debajo de ellos. Nada scrollea de costado. */
.ahdoc.ahdoc--ugc .ugc .ugc-side-menu { display: none; }
@media (max-width: 760px) {
  .ahdoc.ahdoc--ugc .ugc .ugc-shell { flex-direction: column !important; }
  .ahdoc.ahdoc--ugc .ugc .ugc-side {
    position: relative !important; flex: 0 0 auto !important; width: 100% !important;
    height: auto !important; max-height: none !important; overflow: visible !important;
    flex-direction: row !important; flex-wrap: wrap; align-items: center; z-index: 30;
  }
  .ahdoc.ahdoc--ugc .ugc .ugc-side-brand {
    flex: 1 1 0 !important; width: auto !important; min-width: 0;
    justify-content: flex-start !important; text-align: left !important;
    padding: 12px 16px !important; border-bottom: 0 !important;
  }
  .ahdoc.ahdoc--ugc .ugc .ugc-side-name { font-size: 19px !important; overflow-wrap: anywhere; }
  .ahdoc.ahdoc--ugc .ugc .ugc-side-menu {
    display: inline-flex; align-items: center; gap: 8px; flex: none; margin: 0 16px 0 0;
    min-height: 44px; padding: 0 14px; border-radius: 10px; cursor: pointer;
    background: transparent; color: var(--u-night-ink); border: 1.5px solid var(--u-night-line);
    font: 700 11px/1 var(--font-spline-mono), monospace; letter-spacing: .08em; text-transform: uppercase;
  }
  .ahdoc.ahdoc--ugc .ugc .ugc-side-menu[aria-expanded="true"] { background: var(--u-lime); color: var(--u-ink); border-color: var(--u-lime); }
  .ahdoc.ahdoc--ugc .ugc .ugc-side-exit { flex: 1 1 100%; margin: 0 16px 12px !important; }
  .ahdoc.ahdoc--ugc .ugc .ugc-side-pie { display: none; }
  .ahdoc.ahdoc--ugc .ugc .ugc-nav {
    display: none !important; position: absolute; top: 100%; left: 0; right: 0;
    max-height: 70dvh; overflow-y: auto !important; overflow-x: hidden !important;
    padding: 10px 12px 14px !important; mask-image: none !important;
    background: var(--u-night); border-top: 1.5px solid var(--u-night-line);
    box-shadow: 0 18px 30px rgba(22, 21, 15, .35);
  }
  .ahdoc.ahdoc--ugc .ugc .ugc-side--abierta .ugc-nav { display: block !important; }
  .ahdoc.ahdoc--ugc .ugc .ugc-side--abierta .ugc-nav-h { display: block !important; }
  .ahdoc.ahdoc--ugc .ugc .ugc-nav-item { width: 100% !important; white-space: normal !important; }
  .ahdoc.ahdoc--ugc .ugc .ugc-main {
    height: auto !important; flex: 1 1 auto !important; min-height: 0 !important;
    padding: 14px 16px 0 !important;
  }
  .ahdoc.ahdoc--ugc .ugc .ugc-split { flex-direction: column !important; }
  /* La cola les da flex 1 1 0 a las dos columnas, que lado a lado las reparte; apiladas en un
     alto que sale del contenido, base 0 las deja en CERO y el papel se dibuja encima del titulo. */
  .ahdoc.ahdoc--ugc .ugc .ugc-split > .ugc-vcol,
  .ahdoc.ahdoc--ugc .ugc .ugc-split > .ugc-pcol { flex: 0 0 auto !important; }
  .ahdoc.ahdoc--ugc .ugc .ugc-content > .ugc-split > .ugc-pcol { max-height: none !important; overflow: visible !important; }
  .ahdoc.ahdoc--ugc .ugc .ugc-paper { padding: 22px 16px; }
  .ahdoc.ahdoc--ugc .ugc .ugc-hero-body { padding: 22px 18px; }
}
`;
