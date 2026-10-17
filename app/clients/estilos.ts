// =============================================================================
// Los estilos de la cabecera de Clients: la de un grupo de Skool, con la pinta del CURSO
// =============================================================================
// Martín, 17/10/2026: «conservar el diseño de la tab CURSO que tenemos». La cabecera es el encabezado de un grupo
// de Skool (el programa arriba a la izquierda, la fila de sub-tabs abajo) dibujado con el papel del curso
// (app/_cursos, public/cono-doc/ugc.css): crema, tinta, bordes de 2 px y sombra dura, y el ACENTO y la FUENTE del
// programa, que son los del curso (`curso_estilo`, lib/curso-estilo.ts). Los tokens --u-* los pinta el estilo de
// la raíz (varsDeAcento / varsDeFuente); si no hay, los valores de siempre escritos al lado (un var() sin respaldo
// no falla: HEREDA, y sin nadie arriba resuelve a nada).
//
// ⚠️ ESTA CADENA ES UN TEMPLATE LITERAL: adentro no va ningún acento grave ni la secuencia de interpolación, ni
//    siquiera en un comentario (AGENTS.md: los cortan en silencio y la pantalla sale sin estilo).
// =============================================================================
export const CSS_CLIENTS = `
.cls{
  --cl-papel: var(--u-paper, #f4f1e8); --cl-card: var(--u-card, #fbfaf4); --cl-tinta: var(--u-ink, #16150f);
  --cl-dim: var(--u-ink-60, rgba(22,21,15,.6)); --cl-linea: var(--u-line, #ded9ca);
  --cl-acento: var(--u-lime, #cdf13b); --cl-acento-suave: var(--u-lime-soft, #f5f7e7);
  --cl-letra: var(--ugc-fuente, "Archivo", "Archivo Fallback", system-ui, sans-serif);
  --cl-mono: "JetBrains Mono", ui-monospace, monospace;
  min-width: 0; display: flex; flex-direction: column;
}
.cls *, .cls *::before, .cls *::after{ box-sizing: border-box; }

/* La pantalla de alto completo (Classroom): el curso va embebido y el alto lo da este contenedor, por FLEX
   (AGENTS.md: un porcentaje contra un alto de flex es cero en Safari). */
.cls--alto{ height: calc(100vh - var(--barra-agencia, 0px)); overflow: hidden; }
@supports (height: 100dvh){ .cls--alto{ height: calc(100dvh - var(--barra-agencia, 0px)); } }
.cls-cuerpo{ flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.cls--alto > .cls-cuerpo{ flex: 1 1 0; min-height: 0; }
/* Las sub-tabs de la comunidad van sobre el papel del curso, como el portal del alumno. */
.cls-cuerpo--papel{ background: var(--cl-papel); }

/* ── La cabecera ─────────────────────────────────────────────────────────────── */
.cls-cab{
  flex: none; background: var(--cl-papel); color: var(--cl-tinta); font-family: var(--cl-letra);
  border-bottom: 2px solid var(--cl-tinta); padding: 14px 44px 0;
}
@media (max-width: 760px){ .cls-cab{ padding: 10px 16px 0; } }
.cls-fila{ display: flex; align-items: center; gap: 12px; min-width: 0; }
.cls-der{ margin-left: auto; display: flex; align-items: center; gap: 8px; flex: none; }

/* El programa: su sello (la portada, o la inicial sobre el acento) y su nombre. */
.cls-prog{
  display: inline-flex; align-items: center; gap: 10px; min-width: 0; max-width: 100%;
  padding: 4px 8px 4px 4px; margin-left: -4px; border: 0; border-radius: 12px; background: transparent;
  color: inherit; font: inherit; text-align: left; cursor: default;
}
button.cls-prog{ cursor: pointer; }
button.cls-prog:hover{ background: var(--cl-acento-suave); }
.cls-sello{
  flex: none; width: 36px; height: 36px; border-radius: 10px; border: 2px solid var(--cl-tinta);
  box-shadow: 2px 2px 0 0 var(--cl-tinta); background: var(--cl-acento); background-size: cover;
  background-position: center; display: grid; place-items: center;
  font-weight: 800; font-size: 17px; color: var(--cl-tinta);
}
.cls-nombre{ min-width: 0; font-weight: 800; font-size: 19px; letter-spacing: -.02em; line-height: 1.15;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 760px){ .cls-nombre{ font-size: 17px; } }
.cls-flecha{ flex: none; color: var(--cl-dim); }

/* Los botones de la derecha (Personalizar), en letra de máquina como los rótulos del curso. */
.cls-btn{
  display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 12px;
  border: 2px solid var(--cl-tinta); border-radius: 999px; background: var(--cl-card); color: var(--cl-tinta);
  font: 700 11.5px/1 var(--cl-mono); letter-spacing: .04em; text-transform: uppercase; cursor: pointer;
  box-shadow: 2px 2px 0 0 var(--cl-tinta); transition: transform .12s, box-shadow .12s;
}
.cls-btn:hover{ transform: translate(-1px, -1px); box-shadow: 3px 3px 0 0 var(--cl-tinta); }
.cls-btn[aria-expanded="true"]{ background: var(--cl-acento); }

/* ── Las sub-tabs, como las de un grupo de Skool. Es una barra de navegación: si no entran, BAJAN DE RENGLÓN
   (AGENTS.md, «Una barra de navegación NO lleva scroll horizontal»), aunque Skool las deslice en el teléfono. ── */
.cls-tabs{ display: flex; flex-wrap: wrap; gap: 2px; margin: 10px -8px 0; }
.cls-tab{
  position: relative; flex: none; display: inline-flex; align-items: center; min-height: 42px; padding: 0 12px;
  border: 0; background: transparent; color: var(--cl-dim); text-decoration: none; white-space: nowrap;
  font: 600 14.5px/1 var(--cl-letra); cursor: pointer; border-radius: 10px 10px 0 0;
}
.cls-tab:hover{ color: var(--cl-tinta); background: var(--cl-acento-suave); }
.cls-tab[aria-current="page"]{ color: var(--cl-tinta); font-weight: 800; }
.cls-tab[aria-current="page"]::after{
  content: ""; position: absolute; left: 10px; right: 10px; bottom: 0; height: 4px; border-radius: 4px 4px 0 0;
  background: var(--cl-tinta);
}
.cls-tab[aria-current="page"]::before{
  content: ""; position: absolute; left: 10px; right: 10px; bottom: 4px; height: 3px; border-radius: 3px;
  background: var(--cl-acento);
}

/* ── El desplegable del programa y el panel de Personalizar ─────────────────────────────────── */
.cls-pop{
  position: fixed; z-index: 70; min-width: 240px; max-width: min(360px, calc(100vw - 32px)); max-height: 70vh;
  overflow-y: auto; padding: 8px; border: 2px solid var(--cl-tinta); border-radius: 14px; background: var(--cl-card);
  box-shadow: 4px 4px 0 0 var(--cl-tinta); color: var(--cl-tinta); font-family: var(--cl-letra);
}
.cls-pop-tit{ margin: 4px 6px 8px; font: 700 10.5px/1.2 var(--cl-mono); letter-spacing: .06em; text-transform: uppercase;
  color: var(--cl-dim); }
.cls-opcion{
  display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; padding: 4px 8px; border: 0;
  border-radius: 10px; background: transparent; color: inherit; font: 600 14px/1.2 var(--cl-letra); text-align: left;
  cursor: pointer;
}
.cls-opcion:hover{ background: var(--cl-acento-suave); }
.cls-opcion[aria-current="true"]{ background: var(--cl-acento-suave); font-weight: 800; }
.cls-opcion .cls-sello{ width: 28px; height: 28px; font-size: 13px; border-radius: 8px; box-shadow: none; }
.cls-colores{ display: flex; flex-wrap: wrap; gap: 8px; padding: 2px 6px 10px; }
.cls-color{
  width: 30px; height: 30px; border-radius: 999px; border: 2px solid var(--cl-tinta); cursor: pointer; padding: 0;
}
.cls-color[aria-pressed="true"]{ box-shadow: 0 0 0 3px var(--cl-card), 0 0 0 5px var(--cl-tinta); }
.cls-sep{ height: 1px; background: var(--cl-linea); margin: 4px 6px 10px; }
.cls-nota{ margin: 0 6px 8px; font-size: 12.5px; color: var(--cl-dim); }
`;
