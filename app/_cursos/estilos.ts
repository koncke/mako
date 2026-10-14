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
/* Lo OCULTO que solo ve el super admin en Conocimientos: atenuado y abrible (no es un candado). El aviso
   y el chip dicen por que; la opacidad sola no lo explica. */
.ahdoc.ahdoc--ugc .ugc .ugc-modcard.is-atenuado .ugc-modcard-cover > :not(.ugc-modcard-aviso),
.ahdoc.ahdoc--ugc .ugc .ugc-modcard.is-atenuado .ugc-modcard-body > :not(.ugc-chips) { opacity: .45; }
.ahdoc.ahdoc--ugc .ugc .ugc-nav-item.is-atenuado:not(.on) { opacity: .5; }
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

/* ── La leccion: el recuadro del video que falta, y donde va el texto ──────────────
 * SIN VIDEO, quien edita ve un recuadro PUNTEADO del mismo 16:9, nunca el marco negro: un
 * rectangulo negro vacio se lee como un reproductor roto (item 16 del 07/10/2026). Puede crecer si
 * lo de adentro no entra (un telefono angosto con el campo del link abierto). */
.ahdoc.ahdoc--ugc .ugc .ugc-vvacio {
  position: relative; width: 100%; aspect-ratio: 16 / 9; min-height: 180px; box-sizing: border-box;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  padding: 18px; text-align: center; color: var(--u-ink);
  background: var(--u-card-2); border: 2px dashed var(--u-ink-40); border-radius: 18px;
}
/* El interruptor de la disposicion: dos botones pegados, el elegido en el acento. */
.ahdoc.ahdoc--ugc .ugc .ugc-dispo { flex: none; display: inline-flex; border: 2px solid var(--u-ink); border-radius: 9px; overflow: hidden; }
.ahdoc.ahdoc--ugc .ugc .ugc-dispo-op {
  min-height: 30px; padding: 6px 11px; white-space: nowrap; cursor: pointer;
  background: var(--u-card-2); color: var(--u-ink); font: 600 11.5px/1 var(--font-jetbrains), monospace;
}
.ahdoc.ahdoc--ugc .ugc .ugc-dispo-op + .ugc-dispo-op { border-left: 2px solid var(--u-ink); }
.ahdoc.ahdoc--ugc .ugc .ugc-dispo-op[aria-pressed="true"] { background: var(--u-lime); font-weight: 800; }
.ahdoc.ahdoc--ugc .ugc .ugc-dispo-op:disabled { opacity: .6; cursor: default; }
/* TEXTO ABAJO: el video y, debajo, el papel, todo a lo ancho. La cola les da flex 1 1 0 a las dos
 * columnas: apiladas en un alto que sale del contenido, base 0 las deja en CERO y el papel se dibuja
 * encima del titulo (ya paso en el telefono, ver mas abajo). Y el papel deja su scroll propio: abajo
 * scrollea la pagina entera, como en el telefono. */
.ahdoc.ahdoc--ugc .ugc .ugc-split.ugc-split--abajo { flex-direction: column !important; align-items: stretch !important; }
.ahdoc.ahdoc--ugc .ugc .ugc-split.ugc-split--abajo > .ugc-vcol,
.ahdoc.ahdoc--ugc .ugc .ugc-split.ugc-split--abajo > .ugc-pcol { flex: 0 0 auto !important; width: 100% !important; }
.ahdoc.ahdoc--ugc .ugc .ugc-content > .ugc-split.ugc-split--abajo > .ugc-pcol { max-height: none !important; overflow: visible !important; }

/* ── Lo de la APP adentro del curso: campos, casillas, interruptores ──────────────
 * La hoja del origen pone en cero el margen y el relleno de todo lo de .ahdoc, y deja sin fondo ni
 * borde a todo button: la respuesta de una tarea se escribia pegada al borde de su caja y un
 * interruptor quedaba invisible (solo la bolita). Se devuelve lo que la app les da. */
.ahdoc.ahdoc--ugc .mk-input, .ahdoc.ahdoc--ugc .mk-textarea { padding: 10px 12px; }
.ahdoc.ahdoc--ugc .mk-check { padding: 4px 0; }
.ahdoc.ahdoc--ugc .mk-check input { margin: 1px 0 0; }
.ahdoc.ahdoc--ugc .mk-switch { background: var(--u-ink-40); }
.ahdoc.ahdoc--ugc .mk-switch[aria-checked="true"] { background: var(--u-ink); }
.ahdoc.ahdoc--ugc .mk-iconbtn { background: transparent; border: 1px solid transparent; color: var(--u-ink-60); }
/* El texto rico (la descripcion): los enlaces se ven como enlaces, y en el editor se puede
 * seleccionar (el papel del origen apaga la seleccion de lo que se lee). */
.ahdoc.ahdoc--ugc .mk-rico a { color: var(--u-ink); text-decoration: underline; text-underline-offset: 2px; }
.ahdoc.ahdoc--ugc .mk-rico a.mk-adjunto { text-decoration: none; }
.ahdoc.ahdoc--ugc .ugc .ugc-paper .mk-editor-rico { user-select: text; }

/* ── El editor de la estructura: nuevo modulo, arrastrar, el menu de cada uno ──
 * Lo que se arrastra se nota SOLO para quien edita (cursor de agarrar): el alumno no tiene nada
 * que mover. La tarjeta de adentro es un boton con su cursor propio, y tambien lo lleva. */
.ahdoc.ahdoc--ugc .ugc .ugc-arrastrable,
.ahdoc.ahdoc--ugc .ugc .ugc-arrastrable .ugc-modcard,
.ahdoc.ahdoc--ugc .ugc .ugc-arrastrable .ugc-modcard-abrir { cursor: grab; }
.ahdoc.ahdoc--ugc .ugc .ugc-nav-item.ugc-arrastrable { cursor: grab; }
/* EL HUECO: del alto de la tarjeta que se agarro (va en el style), punteado y con el acento. Es lo
 * que dice DONDE cae; la tarjeta de origen no cambia nada mientras viaja (AGENTS.md). */
.ahdoc.ahdoc--ugc .ugc .ugc-hueco {
  border-radius: 16px; border: 2px dashed var(--u-ink-40); background: var(--u-lime-a12);
}
.ahdoc.ahdoc--ugc .ugc .ugc-hueco--fila { height: 36px; border-radius: 10px; margin-bottom: 4px; border-color: var(--u-lime-a50); }
/* Una clase sobre un modulo de la barra: el modulo entero es el destino. */
.ahdoc.ahdoc--ugc .ugc .ugc-nav-item.is-destino { box-shadow: inset 0 0 0 2px var(--u-lime); background: var(--u-lime-a18); }
/* La COPIA de un renglon de la barra va colgada del .ugc (no de la barra oscura): sin su fondo, el
 * texto claro quedaba sobre nada. Le gana al fondo en linea que le pone la copia. */
.ahdoc.ahdoc--ugc .ugc > .ugc-nav-item { background: var(--u-night) !important; border-radius: 10px; }

/* La tarjeta de un modulo EDITANDO es un div: adentro va su nombre, que se edita con un clic, y un
 * texto adentro de un boton abriria el modulo. La tapa es el boton que lo abre. */
/* En COLUMNA y no en bloque: la tapa es un span, y adentro de un bloque queda en linea, donde el
 * aspect-ratio no aplica y la tapa se aplasta a cero (medido en el arnes: tarjetas sin tapa y con el
 * chip del numero encima del nombre). En la tarjeta de siempre la blockifica el flex de .ugc-modcard. */
.ahdoc.ahdoc--ugc .ugc .ugc-modcard-abrir {
  display: flex; flex-direction: column; width: 100%; padding: 0; margin: 0; border: 0; background: none; color: inherit;
  font: inherit; text-align: inherit; cursor: pointer;
}
.ahdoc.ahdoc--ugc .ugc .ugc-modcard--edicion .ugc-modcard-t .ugc-texto-editable { display: inline-block; max-width: 100%; }
/* El candado que le puso el equipo, sobre la tapa: no cierra nada, avisa. */
.ahdoc.ahdoc--ugc .ugc .ugc-modcard-aviso {
  position: absolute; left: 10px; bottom: 10px; z-index: 3; max-width: calc(100% - 20px);
  display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 999px;
  background: var(--u-card); border: 1.5px solid var(--u-ink); color: var(--u-ink);
  font: 700 10px/1.2 var(--font-jetbrains), monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* «+ Nuevo modulo»: la primera tarjeta; al tocarla se vuelve un campo. */
.ahdoc.ahdoc--ugc .ugc .ugc-nuevo-modulo {
  min-height: 190px; display: flex; flex-direction: column; justify-content: center; gap: 10px;
  padding: 18px 16px; border-radius: 16px; border: 2px dashed var(--u-ink); background: var(--u-card);
}
.ahdoc.ahdoc--ugc .ugc .ugc-nuevo-modulo input[type="text"] {
  width: 100%; min-height: 40px; padding: 8px 11px; border-radius: 10px; border: 2px solid var(--u-ink);
  background: var(--u-card-2); color: var(--u-ink); font: 700 15px/1.2 var(--font-archivo), system-ui, sans-serif;
}
.ahdoc.ahdoc--ugc .ugc .ugc-nuevo-modulo input[type="text"]:focus { outline: none; box-shadow: 0 0 0 3px var(--u-lime-a50); }
.ahdoc.ahdoc--ugc .ugc .ugc-nuevo-check {
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  font: 600 11.5px/1.3 var(--font-jetbrains), monospace; color: var(--u-ink-60);
}
.ahdoc.ahdoc--ugc .ugc .ugc-nuevo-pie { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.ahdoc.ahdoc--ugc .ugc .ugc-nuevo-pie .ugc-btn { padding: 7px 12px; }

/* El «...» de un modulo o una clase, y el de la cabecera del modulo abierto. */
.ahdoc.ahdoc--ugc .ugc .ugc-editable-btn--menu { font-size: 15px; letter-spacing: .05em; }
.ahdoc.ahdoc--ugc .ugc .ugc-rail-head h2 { display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ahdoc.ahdoc--ugc .ugc .ugc-rail-head .ugc-editable-btn { flex: none; }

/* Los campos adentro del menu (el candado y sus datos): sobre el fondo de noche del menu. */
.ahdoc.ahdoc--ugc .ugc .ugc-menu-bloque { display: flex; flex-direction: column; gap: 8px; padding: 4px 10px 8px; }
.ahdoc.ahdoc--ugc .ugc .ugc-menu-campo { display: flex; flex-direction: column; gap: 5px; font: 600 11px/1.3 var(--font-jetbrains), monospace; color: var(--u-night-mut); }
.ahdoc.ahdoc--ugc .ugc .ugc-menu-campo select,
.ahdoc.ahdoc--ugc .ugc .ugc-menu-campo input {
  width: 100%; min-height: 34px; padding: 6px 9px; border-radius: 9px; border: 1.5px solid var(--u-night-line);
  background: rgba(255, 255, 255, .06); color: var(--u-night-ink); font: 600 13px/1.25 var(--font-archivo), system-ui, sans-serif;
}
.ahdoc.ahdoc--ugc .ugc .ugc-menu-campo select option { color: #16150f; background: #fffdf6; }
.ahdoc.ahdoc--ugc .ugc .ugc-menu-check { display: flex; align-items: flex-start; gap: 9px; cursor: pointer; font: 600 13px/1.3 var(--font-archivo), system-ui, sans-serif; color: var(--u-night-ink); }
.ahdoc.ahdoc--ugc .ugc .ugc-menu-check input { margin-top: 2px; flex: none; }
/* La consecuencia de un cambio, PEGADA a su control y en tinta normal (AGENTS.md: lo irreversible
 * se dice antes del clic, no en gris abajo). */
.ahdoc.ahdoc--ugc .ugc .ugc-menu-nota { margin: 2px 0 0; font: 500 12px/1.4 var(--font-archivo), system-ui, sans-serif; color: var(--u-night-ink); opacity: .85; }
.ahdoc.ahdoc--ugc .ugc .ugc-menu-error { margin: 2px 10px 6px; font: 600 12px/1.35 var(--font-archivo), system-ui, sans-serif; color: #ffb4a6; }
.ahdoc.ahdoc--ugc .ugc .ugc-menu-item:disabled { opacity: .45; cursor: default; }
.ahdoc.ahdoc--ugc .ugc .ugc-menu-item--peligro:hover:not(:disabled) { background: rgba(246, 201, 193, .18); color: #ffd2c9; }

/* Los botones de la barra de arriba: el hueco de al lado del buscador (Compartir, en Conocimientos) y,
 * para quien EDITA el curso, sus acciones EN EL LUGAR del nombre del curso, arriba a la derecha (Vista
 * del alumno, Invitar alumnos y el ?; item 14 del 08/10/2026). Si no entran, la barra baja de renglon:
 * nunca scrollea de costado (AGENTS.md). Las acciones NO se esconden en el telefono, a diferencia del
 * nombre del curso (la cola lo saca debajo de 640 px): sin ellas no habria como invitar desde ahi. */
.ahdoc.ahdoc--ugc .ugc .ugc-topbar { flex-wrap: wrap; }
.ahdoc.ahdoc--ugc .ugc .ugc-topbar-extra { flex: none; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ahdoc.ahdoc--ugc .ugc .ugc-topbar-acciones {
  flex: 0 1 auto; min-width: 0; margin-left: auto;
  display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap;
}
.ahdoc.ahdoc--ugc .ugc .ugc-topbar-extra .ugc-btn,
.ahdoc.ahdoc--ugc .ugc .ugc-topbar-acciones .ugc-btn { display: inline-flex; align-items: center; min-height: 36px; white-space: nowrap; font-family: var(--font-jetbrains), monospace; }
/* El ? del recorrido, con la piel de los botones de AL LADO. SOLO en la barra de arriba (revision final
 * del 08/10/2026): escrita para todo .mk-iconbtn del curso, pisaba la de mas arriba (la de la app
 * adentro del curso) y las flechas y la cruz del formulario de una tarea salian de 36 px con borde
 * grueso y sombra (medido en el banco de la leccion). Dos reglas para el mismo selector: gana la
 * ultima, y la primera mentia. */
.ahdoc.ahdoc--ugc .ugc .ugc-topbar-extra .mk-iconbtn,
.ahdoc.ahdoc--ugc .ugc .ugc-topbar-acciones .mk-iconbtn {
  width: 36px; height: 36px; display: grid; place-items: center; padding: 0; cursor: pointer;
  border-radius: 9px; border: 2px solid var(--u-ink); background: var(--u-card-2); color: var(--u-ink); box-shadow: var(--u-sh-sm);
}

/* ── La FUENTE del curso (item 3 del 08/10/2026) ──────────────────────────────────
 * La elegida la pinta varsDeFuente (app/_cursos/fuentes.ts) en el style de .ugc: redefine
 * --font-archivo, que es con lo que la hoja del origen escribe todo .ugc, y --ugc-fuente. Sin elegir,
 * --ugc-fuente es la letra de siempre del curso.
 * Las piezas de la APP adentro del curso no heredan: los campos de la app (.mk-input, .mk-textarea)
 * traen Geist escrito, y un select o un input nativos traen la del sistema. Eran justo la descripcion
 * y la tarea con otra letra que el resto (Martin: «Los textos de la descripcion y tarea deben seguir
 * la misma tipografia»). Van con la del curso, pero SOLO adentro del contenido: el buscador y los
 * botones siguen en la de maquina, que es el acento del diseno.
 * Con :where() para no subir la especificidad: un campo que pida su propia letra con una regla mas
 * especifica (el nombre de un modulo nuevo) la sigue teniendo. Uno por selector y no una lista adentro
 * de un solo :where(): el guard de tests/cursos-ugc.test.ts parte los selectores por la coma. */
.ahdoc.ahdoc--ugc .ugc { --ugc-fuente: var(--font-archivo), system-ui, sans-serif; }
.ahdoc.ahdoc--ugc .ugc .ugc-content :where(.mk-input),
.ahdoc.ahdoc--ugc .ugc .ugc-content :where(.mk-textarea),
.ahdoc.ahdoc--ugc .ugc .ugc-content :where(.mk-rico),
.ahdoc.ahdoc--ugc .ugc .ugc-content :where(.mk-editor-rico),
.ahdoc.ahdoc--ugc .ugc .ugc-content :where(select),
.ahdoc.ahdoc--ugc .ugc .ugc-content :where(textarea),
.ahdoc.ahdoc--ugc .ugc .ugc-content :where(input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="range"]):not([type="file"])) {
  font-family: var(--ugc-fuente);
}
/* El desplegable de la fuente en el menu de la marca (14/10/2026): el Dropdown de la casa, con cada fuente
 * escrita con ella misma, como el de Google Docs (app/_cursos/SelectorFuente.tsx). Solo el aire alrededor. */
.ahdoc.ahdoc--ugc .ugc .ugc-fuentes { padding: 2px 4px 6px; }

/* ── Mientras corre un RECORRIDO (app/_ui/Recorrido.tsx, que se monta en el body como .mk-rec) ──────
 * Los controles que aparecen al pasar el cursor (el ... de una tarjeta, Portada) se muestran: el
 * recorrido los señala, y un recorte sobre un boton transparente es una flecha a la nada. */
.ahdoc.ahdoc--ugc:is(body:has(> .mk-rec) *) .ugc .ugc-editable-ctrls,
.ahdoc.ahdoc--ugc:is(body:has(> .mk-rec) *) .ugc .ugc-portada-btn { opacity: 1; }

/* ── El acento elegido, donde la hoja del origen lo tiene FIJO ─────────────────
 * La hoja pinta con var(--u-lime) casi todo, pero varios tintes llevan el lima escrito a mano
 * (rgba 204,240,58): sin esto, con otro color quedarian manchas verdes sueltas.
 * Los tintes son VARIABLES con el lima por default; con otro acento las calcula varsDeAcento
 * (lib/curso-estilo.ts) y van en el style de .ugc. NO con color-mix: un color-mix con una
 * variable adentro que el navegador no entiende no cae a la regla de antes, deja la propiedad
 * en su valor inicial (sin fondo, sin anillo) en el telefono viejo de un alumno. */
.ahdoc.ahdoc--ugc .ugc {
  --u-lime-a12: rgba(205, 241, 59, .12); --u-lime-a18: rgba(205, 241, 59, .18); --u-lime-a22: rgba(205, 241, 59, .22);
  --u-lime-a30: rgba(205, 241, 59, .3); --u-lime-a45: rgba(205, 241, 59, .45); --u-lime-a50: rgba(205, 241, 59, .5);
}
.ahdoc.ahdoc--ugc .ugc .ugc-nav-item:hover { background: var(--u-lime-a12); }
.ahdoc.ahdoc--ugc .ugc .ugc-search:focus-within { box-shadow: 0 0 0 3px var(--u-lime-a50); }
.ahdoc.ahdoc--ugc .ugc .ugc-modcard-cover {
  background: radial-gradient(110% 130% at 80% 15%, var(--u-lime-a22), transparent 50%),
    repeating-linear-gradient(45deg, rgba(255,255,255,.03), rgba(255,255,255,.03) 12px, transparent 12px, transparent 24px), var(--u-night);
}
.ahdoc.ahdoc--ugc .ugc .ugc-hero-cta { box-shadow: 0 2px 12px var(--u-lime-a18); }
.ahdoc.ahdoc--ugc .ugc .ugc-hero:hover .ugc-hero-cta,
.ahdoc.ahdoc--ugc .ugc .ugc-hero-arranque:hover .ugc-hero-cta { box-shadow: 0 3px 18px var(--u-lime-a30); }

/* ── La marca como desplegable, y su menu ────────────────────────────────────── */
.ahdoc.ahdoc--ugc .ugc .ugc-side-brand--menu { gap: 10px; }
.ahdoc.ahdoc--ugc .ugc .ugc-side-brand-chev { flex: none; font-size: 13px; color: var(--u-night-mut); transition: transform .15s; }
.ahdoc.ahdoc--ugc .ugc .ugc-side-brand--menu[aria-expanded="true"] .ugc-side-brand-chev { transform: rotate(180deg); color: var(--u-lime); }
.ahdoc.ahdoc--ugc .ugc .ugc-menu {
  position: fixed; z-index: 70; max-height: 72vh; overflow-y: auto; padding: 8px;
  background: var(--u-night); color: var(--u-night-ink); border: 1.5px solid var(--u-night-line);
  border-radius: 14px; box-shadow: 0 22px 44px rgba(22, 21, 15, .45);
}
.ahdoc.ahdoc--ugc .ugc .ugc-menu-h {
  padding: 10px 10px 6px; font: 600 9.5px/1 var(--font-jetbrains), monospace;
  letter-spacing: .14em; text-transform: uppercase; color: var(--u-night-mut);
}
.ahdoc.ahdoc--ugc .ugc .ugc-menu-item {
  display: flex; align-items: center; gap: 10px; width: 100%; min-height: 38px; padding: 8px 10px;
  border-radius: 9px; text-align: left; cursor: pointer; text-decoration: none;
  font: 600 13px/1.25 var(--font-archivo), system-ui, sans-serif; color: var(--u-night-ink); background: transparent;
}
.ahdoc.ahdoc--ugc .ugc .ugc-menu-item:hover { background: var(--u-lime-a12); }
.ahdoc.ahdoc--ugc .ugc .ugc-menu-item.on { background: var(--u-lime); color: var(--u-ink); font-weight: 800; }
.ahdoc.ahdoc--ugc .ugc .ugc-menu-sep { height: 1.5px; margin: 8px 4px; background: var(--u-night-line); }
.ahdoc.ahdoc--ugc .ugc .ugc-swatches { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 10px 8px; align-items: center; }
.ahdoc.ahdoc--ugc .ugc .ugc-swatch {
  width: 26px; height: 26px; padding: 0; border-radius: 50%; cursor: pointer;
  border: 2px solid var(--u-night-line); box-shadow: inset 0 0 0 2px var(--u-night);
}
.ahdoc.ahdoc--ugc .ugc .ugc-swatch[aria-pressed="true"], .ahdoc.ahdoc--ugc .ugc .ugc-swatch.on { border-color: var(--u-night-ink); }
.ahdoc.ahdoc--ugc .ugc .ugc-swatch--otro { position: relative; overflow: hidden; background: conic-gradient(#ff6b6b, #ffd43b, #69db7c, #4dabf7, #b197fc, #ff6b6b); }
.ahdoc.ahdoc--ugc .ugc .ugc-swatch--otro input { position: absolute; inset: 0; opacity: 0; cursor: pointer; border: 0; padding: 0; }

/* ── Un texto que se edita con un clic ──────────────────────────────────────────── */
.ahdoc.ahdoc--ugc .ugc .ugc-texto-editable {
  outline: none; border-radius: 6px; cursor: text; min-width: 2ch;
  box-shadow: 0 0 0 0 transparent; transition: box-shadow .12s, background .12s;
}
.ahdoc.ahdoc--ugc .ugc .ugc-texto-editable:hover { box-shadow: 0 0 0 3px var(--u-lime-a45); }
.ahdoc.ahdoc--ugc .ugc .ugc-texto-editable:focus { box-shadow: 0 0 0 3px var(--u-lime); }
.ahdoc.ahdoc--ugc .ugc .ugc-texto-editable:empty::before { content: attr(data-vacio); opacity: .45; }
.ahdoc.ahdoc--ugc .ugc .ugc-texto-editable.is-guardando { opacity: .6; cursor: progress; }
.ahdoc.ahdoc--ugc .ugc .ugc-hero-title.ugc-texto-editable, .ahdoc.ahdoc--ugc .ugc .ugc-hero-resumen.ugc-texto-editable { display: block; }

/* ── La portada editando: no es un boton; el que lleva a la clase es la pastilla ── */
.ahdoc.ahdoc--ugc .ugc .ugc-hero--edicion { cursor: default; }
.ahdoc.ahdoc--ugc .ugc .ugc-hero--edicion:hover { transform: none; }
.ahdoc.ahdoc--ugc .ugc .ugc-hero--edicion .ugc-hero-arranque { padding: 0; cursor: pointer; text-align: left; font: inherit; color: inherit; }
.ahdoc.ahdoc--ugc .ugc .ugc-portada-btn {
  position: absolute; top: 14px; right: 14px; z-index: 4; display: inline-flex; align-items: center; gap: 7px;
  min-height: 32px; padding: 0 12px; border-radius: 9px; cursor: pointer;
  font: 700 11px/1 var(--font-jetbrains), monospace; letter-spacing: .04em;
  color: var(--u-night-ink); background: rgba(22, 21, 15, .62); border: 1.5px solid rgba(244, 241, 232, .35);
  opacity: 0; transition: opacity .12s;
}
.ahdoc.ahdoc--ugc .ugc .ugc-hero--edicion:hover .ugc-portada-btn,
.ahdoc.ahdoc--ugc .ugc .ugc-hero--edicion:focus-within .ugc-portada-btn { opacity: 1; }
@media (hover: none) { .ahdoc.ahdoc--ugc .ugc .ugc-portada-btn { opacity: 1; } }

/* ── Una tapa que no es foto (un degradado del selector de portadas) ───────────── */
.ahdoc.ahdoc--ugc .ugc .ugc-modcard-cover .ugc-fondo { position: absolute; inset: 0; }

/* ── Pagina: el alto es la VENTANA menos la franja de la agencia ────────────────
 * La cola mide 100vh y traba el scroll del documento. Con la barra de la agencia (o la alerta de
 * voz) el body baja 50 a 114 px y el curso se salia por abajo ese mismo tanto: el pie de cada
 * columna que scrollea quedaba fuera de alcance, sin forma de llegar (revision del 07/10/2026).
 * Y 100dvh y no 100vh, que en el telefono es el alto con la barra del navegador escondida.
 * El alto va en una variable con respaldo: dvh dentro de un calc con var() en un navegador que no
 * lo entiende no cae a la regla de antes, deja el alto en su valor inicial. */
.ahdoc.ahdoc--ugc { --alto-ventana: 100vh; }
@supports (height: 100dvh) { .ahdoc.ahdoc--ugc { --alto-ventana: 100dvh; } }
.ahdoc.ahdoc--ugc:not(.ahdoc--embebido),
.ahdoc.ahdoc--ugc:not(.ahdoc--embebido) .ugc,
.ahdoc.ahdoc--ugc:not(.ahdoc--embebido) .ugc .ugc-shell { height: calc(var(--alto-ventana) - var(--barra-agencia, 0px)) !important; }
@media (min-width: 761px) {
  .ahdoc.ahdoc--ugc:not(.ahdoc--embebido) .ugc .ugc-side,
  .ahdoc.ahdoc--ugc:not(.ahdoc--embebido) .ugc .ugc-main { height: calc(var(--alto-ventana) - var(--barra-agencia, 0px)) !important; max-height: none !important; }
}

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

/* ── Un solo scroll en la leccion (unSoloScroll en ./tipos.ts): la vista del alumno ──────
 * Punto 4 del audio del 08/10 a la noche: «hay dos scroll... tengo que poner el cursor aca para que pueda
 * deslizar». La cola del origen hace de cada columna de la leccion un contenedor de scroll con
 * overscroll-behavior: contain, y el contenido scrollea aparte. Medido a 1440x900 antes del arreglo: con el
 * cursor sobre el papel la rueda movia SOLO el papel y al final se trababa (el contain no la deja pasar al
 * contenido); en la vista previa, con el papel sin desborde, NO MOVIA NADA: un contenedor con contain frena
 * la rueda aunque no tenga nada que scrollear. Con el cursor en el titulo o al costado si scrolleaba.
 * Aca las columnas crecen con lo suyo y lo unico que scrollea es .ugc-content. El split no se encoge: si se
 * encogiera, lo de abajo (los comentarios) se dibujaria ENCIMA del papel que desborda. El video queda pegado
 * arriba mientras se lee al costado, solo al costado y en escritorio: abajo o en el telefono va primero y se
 * va con el scroll. Desde el 13/10 la tab Curso tambien la lleva; Conocimientos no: sigue con una columna que scrollea. */
.ahdoc.ahdoc--ugc.ahdoc--un-scroll .ugc .ugc-content > .ugc-split { flex: 0 0 auto !important; }
.ahdoc.ahdoc--ugc.ahdoc--un-scroll .ugc .ugc-split > .ugc-vcol,
.ahdoc.ahdoc--ugc.ahdoc--un-scroll .ugc .ugc-split > .ugc-pcol { overflow: visible !important; max-height: none !important; }
@media (min-width: 761px) {
  .ahdoc.ahdoc--ugc.ahdoc--un-scroll .ugc .ugc-split:not(.ugc-split--abajo) > .ugc-vcol {
    position: sticky !important; top: 0 !important; align-self: flex-start !important;
  }
}

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
  /* En el telefono la leccion va SIEMPRE apilada: el interruptor de la disposicion no cambiaria
     nada, y un control que no hace nada se lee como que la app esta rota. */
  .ahdoc.ahdoc--ugc .ugc .ugc-dispo { display: none; }
  .ahdoc.ahdoc--ugc .ugc .ugc-paper { padding: 22px 16px; }
  .ahdoc.ahdoc--ugc .ugc .ugc-hero-body { padding: 22px 18px; }
}
`;
