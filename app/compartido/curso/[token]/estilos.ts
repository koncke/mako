// =============================================================================
// Los estilos de lo que el portal pone ADENTRO del curso: el reproductor y la tarea
// =============================================================================
// El curso se dibuja con el diseño de Conocimientos (app/_cursos/CursoUgc.tsx, con su hoja). Lo que
// ese dibujo no trae —el formulario de la tarea, la versión de la IA, el video medido— lleva estos
// estilos, que viven aparte para que la tab Curso los use igual cuando muestra la tarea tal como la
// ve el alumno (app/customer-success/curso/CursoApp.tsx).
//
// Los colores son los TOKENS de la casa y los tamaños de letra los --fs-*, que suben solos en
// pantalla chica. Nada scrollea de costado: la tabla se da vuelta en bloques en el teléfono.
// ⚠️ Adentro de esta cadena no va ningún acento grave ni la secuencia de interpolación: la cortan.
// =============================================================================
export const CSS_PORTAL = `
.cp-video{ position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000; overflow: hidden; }
.cp-video iframe, .cp-video video{ position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.cp-video--nativo video{ object-fit: contain; background: #000; }
.cp-afuera{ display: flex; }
.cp-nota{ margin: 0; font-size: var(--fs-sm); color: var(--faint); }
.cp-eyebrow{ font-family: 'Geist Mono', ui-monospace, monospace; font-size: var(--fs-meta);
  letter-spacing: .12em; text-transform: uppercase; color: var(--faint); }

.cp-area{ display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.cp-area + .cp-area{ margin-top: 18px; }
.cp-area-nom{ margin: 0; padding-top: 12px; border-top: 1px solid var(--border); font-size: var(--fs-md); font-weight: 600; overflow-wrap: anywhere; }
.cp-area:first-child .cp-area-nom{ padding-top: 0; border-top: 0; }

.cp-campos{ list-style: none; margin: 0; padding: 0; }
.cp-tarea{ border-top: 1px dashed var(--border-strong); padding-top: 16px; display: flex; flex-direction: column; gap: 14px; min-width: 0; }
/* Arriba de todo en el papel, la linea punteada separaria la tarea de nada. */
.ugc-paper > .cp-tarea:first-child, .cp-area > .cp-tarea{ border-top: 0; padding-top: 0; }
.cp-tarea-instr{ margin: 0; font-size: var(--fs-md); line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
.cp-campo{ padding: 14px 0; border-top: 1px solid var(--border); min-width: 0; }
.cp-campo:first-child{ border-top: 0; padding-top: 0; }
.cp-preg{ display: block; margin: 0 0 6px; padding: 0; font-size: var(--fs-md); font-weight: 600; line-height: 1.45; overflow-wrap: anywhere; }
.cp-req{ color: var(--bad); }
.cp-ayuda{ margin: 0 0 8px; font-size: var(--fs-sm); line-height: 1.5; color: var(--dim); }
.cp-fieldset{ border: 0; margin: 0; padding: 0; min-width: 0; display: flex; flex-direction: column; }

.cp-tabla-caja{ display: flex; flex-direction: column; align-items: flex-start; gap: 8px; min-width: 0; width: 100%; }
.cp-tabla{ width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
.cp-tabla th{ text-align: left; font-size: var(--fs-meta); font-weight: 600; color: var(--faint);
  padding: 0 8px 6px; letter-spacing: .04em; }
.cp-tabla td{ border-top: 1px solid var(--border); padding: 0; vertical-align: top; }
.cp-fija{ display: block; padding: 10px 8px; font-weight: 600; }
.cp-celda{ width: 100%; min-height: var(--touch); border: 0; background: none; padding: 10px 8px;
  font: inherit; font-size: var(--fs-md); color: var(--ink); }
.cp-celda:focus{ outline: none; background: var(--primary-bg); }
@media (max-width: 640px){
  .cp-tabla thead{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .cp-tabla, .cp-tabla tbody, .cp-tabla tr, .cp-tabla td{ display: block; width: 100%; }
  .cp-tabla tr{ border-top: 1px solid var(--border); padding: 8px 0; }
  .cp-tabla td{ border: 0; }
  .cp-tabla td::before{ content: attr(data-col); display: block; padding: 6px 0 0; font-size: var(--fs-meta);
    color: var(--faint); font-weight: 600; }
  .cp-tabla td[data-col=""]::before{ display: none; }
  .cp-fija, .cp-celda{ padding-left: 0; padding-right: 0; }
  .cp-celda{ border-bottom: 1px solid var(--border); }
}

/* La version de la IA (paso 5): debajo de la suya, en una caja tenue para que se lea como otra. */
.cp-prop{ display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 12px;
  background: var(--primary-bg); border: 1px solid var(--border); min-width: 0; }
.cp-prop-tit{ margin: 0; font-size: var(--fs-md); font-weight: 600; color: var(--ink); }

.cp-aviso{ margin: 0; font-size: var(--fs-sm); font-weight: 500; }
.cp-aviso--falta{ color: var(--warn); }
.cp-aviso--ok{ color: var(--good); }
.cp-aviso--error{ color: var(--bad); }
.cp-tarea-pie{ display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.cp-guardado{ font-size: var(--fs-meta); color: var(--faint); }
.cp-guardado--guardado{ color: var(--good); }
.cp-guardado--error{ color: var(--bad); }

/* Marcar como hecha (una clase sin tarea): debajo de la descripcion, con la misma linea punteada que
   separa la tarea. Arriba de todo en el papel no hay nada que separar. */
.cp-hecha{ display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding-top: 16px; border-top: 1px dashed var(--border-strong); }
.ugc-paper > .cp-hecha:first-child{ border-top: 0; padding-top: 0; }
.cp-hecha .ugc-btn:disabled{ opacity: .6; cursor: default; }

/* La comunidad del producto, en su pantalla: afuera del curso (la hoja del curso le sacaria el fondo
   y el borde a sus botones). La franja de arriba lleva la marca y las dos pestanas del programa, con
   la paleta del portal; cada color con su respaldo, porque aca no esta la hoja que los define. */
.cp-com{ min-height: 100dvh; background: var(--u-paper, #f4f1e8); color: var(--u-ink, #16150f); }
.cp-com-barra{ position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 20px;
  padding: 12px 20px; background: var(--u-night, #16150f); color: var(--u-night-ink, #f4f1e8); }
.cp-com-marca{ font-weight: 800; font-size: 19px; letter-spacing: -.02em; overflow-wrap: anywhere; }
.cp-com-marca span{ color: var(--u-lime, #cdf13b); }
.cp-com-tabs{ display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; }
.cp-com-tab{ display: inline-flex; align-items: center; min-height: 38px; padding: 0 14px; border-radius: 999px; cursor: pointer;
  border: 1.5px solid rgba(244, 241, 232, .35); background: transparent; color: inherit;
  font: 700 12px/1 'Geist Mono', ui-monospace, monospace; letter-spacing: .04em; }
.cp-com-tab[aria-current="page"]{ cursor: default; background: var(--u-lime, #cdf13b); color: #16150f; border-color: transparent; }
.cp-com-cuerpo{ max-width: 1180px; margin: 0 auto; padding: 22px 16px 60px; }
`;
