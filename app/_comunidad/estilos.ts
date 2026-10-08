// =============================================================================
// Los estilos de la comunidad (equipo y alumno): UNA hoja, dos temas
// =============================================================================
// Las pantallas son las mismas para los dos; lo que cambia es la piel, y la piel son TOKENS
// (AGENTS.md: «una pantalla distinta se hace redefiniendo tokens, no reglas»):
//   · `.cmu--equipo` apunta a los tokens de la app (--surface, --ink, --primary…): se ve como el
//     resto de MaKo, al lado del Curso y de Clientes.
//   · `.cmu--alumno` apunta a la paleta del portal del curso (papel, tinta, lima, bordes de 2 px y
//     sombra dura, la de app/_cursos y public/cono-doc/ugc.css). Toma los `--u-*` si la comunidad se
//     monta adentro del curso, y si no, los mismos valores escritos al lado (un `var()` sin respaldo
//     no falla: HEREDA, y sin nadie arriba resuelve a nada).
//
// Los tamaños de letra son los --fs-* de la casa (suben solos en pantalla chica). Nada scrollea de
// costado: las filas bajan de renglón.
//
// ⚠️ ESTA CADENA ES UN TEMPLATE LITERAL: adentro no va ningún acento grave ni la secuencia de
//    interpolación, ni siquiera en un comentario. Los cortan en silencio y la pantalla sale sin estilo.
// =============================================================================
export const CSS_COMUNIDAD = `
.cmu{
  --cm-card: var(--surface); --cm-card-2: var(--surface-2); --cm-ink: var(--ink); --cm-dim: var(--dim);
  --cm-faint: var(--faint); --cm-line: var(--border); --cm-acento: var(--primary); --cm-acento-ink: var(--on-primary);
  --cm-acento-suave: var(--primary-bg); --cm-enlace: var(--primary); --cm-radio: var(--r-lg); --cm-radio-sm: var(--r-md);
  --cm-borde: 1px solid var(--border); --cm-sombra: none; --cm-sombra-hover: 0 6px 18px rgba(18,21,27,.08);
  --cm-mono: 'Geist Mono', ui-monospace, monospace; --cm-bien: var(--good);
  color: var(--cm-ink); font-size: var(--fs-md); line-height: 1.5; min-width: 0;
}
.cmu--alumno{
  --cm-card: var(--u-card, #fbfaf4); --cm-card-2: var(--u-card-2, #f8f6ee); --cm-ink: var(--u-ink, #16150f);
  --cm-dim: var(--u-ink-60, rgba(22,21,15,.6)); --cm-faint: var(--u-ink-40, rgba(22,21,15,.42)); --cm-line: var(--u-line, #ded9ca);
  --cm-acento: var(--u-lime, #cdf13b); --cm-acento-ink: var(--u-ink, #16150f); --cm-acento-suave: var(--u-lime-soft, #f5f7e7);
  --cm-enlace: var(--u-ink, #16150f); --cm-radio: 16px; --cm-radio-sm: 10px;
  --cm-borde: 2px solid var(--u-ink, #16150f); --cm-sombra: 3px 3px 0 0 var(--u-ink, #16150f);
  --cm-sombra-hover: 5px 5px 0 0 var(--u-ink, #16150f); --cm-bien: #2f7d32;
}
.cmu *, .cmu *::before, .cmu *::after{ box-sizing: border-box; }

/* ── Las pestanas: Comunidad, Ranking, Miembros ─────────────────────────────── */
.cmu-tabs{ display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 0 0 18px; }
.cmu-tab{
  display: inline-flex; align-items: center; gap: 8px; min-height: var(--touch); padding: 0 16px;
  border: 1px solid transparent; border-radius: 999px; background: transparent; color: var(--cm-dim);
  font: inherit; font-size: var(--fs-md); font-weight: 600; cursor: pointer;
}
.cmu-tab:hover{ color: var(--cm-ink); background: var(--cm-card-2); }
.cmu-tab[data-on="true"]{ background: var(--cm-ink); color: var(--cm-card); }
.cmu--alumno .cmu-tab[data-on="true"]{ background: var(--cm-acento); color: var(--cm-acento-ink); border: var(--cm-borde); box-shadow: var(--cm-sombra); }
.cmu-tabs-extra{ margin-left: auto; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

/* ── El layout de Skool: el feed y una columna al costado ─────────────────────── */
.cmu-grid{ display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 24px; align-items: start; }
@media (max-width: 960px){ .cmu-grid{ grid-template-columns: minmax(0, 1fr); } }
.cmu-main{ display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.cmu-aside{ display: flex; flex-direction: column; gap: 14px; min-width: 0; }

.cmu-card{ background: var(--cm-card); border: var(--cm-borde); border-radius: var(--cm-radio); box-shadow: var(--cm-sombra); padding: 16px 18px; min-width: 0; }
.cmu-card-tit{ margin: 0 0 4px; font-size: var(--fs-card); font-weight: 700; overflow-wrap: anywhere; }
.cmu-dim{ color: var(--cm-dim); }
.cmu-faint{ color: var(--cm-faint); }
.cmu-mono{ font-family: var(--cm-mono); font-size: var(--fs-meta); letter-spacing: .02em; }
.cmu-chico{ font-size: var(--fs-sm); }
.cmu-meta{ font-size: var(--fs-meta); color: var(--cm-faint); }
.cmu-error{ margin: 0; font-size: var(--fs-sm); color: var(--bad); }
.cmu-vacio{ padding: 36px 18px; text-align: center; color: var(--cm-dim); }
.cmu-vacio b{ display: block; color: var(--cm-ink); font-size: var(--fs-card); margin-bottom: 4px; }

/* ── Escribir algo ──────────────────────────────────────────────────────────── */
.cmu-escribir{ display: flex; align-items: center; gap: 12px; }
.cmu-escribir-btn{
  flex: 1; min-width: 0; min-height: 44px; padding: 0 16px; text-align: left; cursor: text;
  border: 1px solid var(--cm-line); border-radius: 999px; background: var(--cm-card-2); color: var(--cm-faint);
  font: inherit; font-size: var(--fs-md);
}
.cmu--alumno .cmu-escribir-btn{ border: 2px solid var(--cm-line); }
.cmu-escribir-btn:hover:not(:disabled){ border-color: var(--cm-dim); color: var(--cm-dim); }
.cmu-escribir-btn:disabled{ cursor: not-allowed; }

/* ── Chips de categoria y el orden ──────────────────────────────────────────── */
.cmu-barra{ display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.cmu-chips{ display: flex; flex-wrap: wrap; gap: 6px; flex: 1; min-width: 0; }
.cmu-chip{
  display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px;
  border: 1px solid var(--cm-line); border-radius: 999px; background: var(--cm-card); color: var(--cm-dim);
  font: inherit; font-size: var(--fs-sm); font-weight: 600; cursor: pointer; white-space: nowrap;
}
.cmu-chip:hover{ color: var(--cm-ink); border-color: var(--cm-dim); }
.cmu-chip[data-on="true"]{ background: var(--cm-ink); color: var(--cm-card); border-color: var(--cm-ink); }
.cmu--alumno .cmu-chip[data-on="true"]{ background: var(--cm-acento); color: var(--cm-acento-ink); border: 2px solid var(--cm-ink); }
.cmu-orden{ min-width: 150px; }

/* ── La tarjeta de un post ──────────────────────────────────────────────────── */
.cmu-post{
  position: relative; display: flex; gap: 16px; padding: 16px 18px; cursor: pointer;
  background: var(--cm-card); border: var(--cm-borde); border-radius: var(--cm-radio); box-shadow: var(--cm-sombra);
  transition: box-shadow .12s, transform .12s;
}
.cmu-post:hover{ box-shadow: var(--cm-sombra-hover); }
.cmu--alumno .cmu-post:hover{ transform: translate(-1px, -1px); }
.cmu-post[data-fijado="true"]{ border-color: var(--cm-ink); }
.cmu-post-cuerpo{ flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.cmu-post-cab{ display: flex; align-items: center; gap: 10px; min-width: 0; }
.cmu-post-quien{ min-width: 0; display: flex; flex-direction: column; }
.cmu-post-meta{ font-size: var(--fs-meta); color: var(--cm-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmu-post-tit{ margin: 0; font-size: var(--fs-card); font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
.cmu-post-ext{ margin: 0; color: var(--cm-dim); font-size: var(--fs-sm); overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cmu-post-pie{ display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; }
.cmu-post-thumb{ flex: none; width: 112px; height: 84px; border-radius: var(--cm-radio-sm); object-fit: cover; border: 1px solid var(--cm-line); background: var(--cm-card-2); }
@media (max-width: 560px){ .cmu-post-thumb{ width: 72px; height: 56px; } }
.cmu-fijado{ display: inline-flex; align-items: center; gap: 5px; font-size: var(--fs-meta); font-weight: 700; color: var(--cm-ink); }
.cmu-tag{ display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 999px; font-size: var(--fs-meta); font-weight: 600;
  background: var(--cm-card-2); color: var(--cm-dim); border: 1px solid var(--cm-line); white-space: nowrap; }
.cmu--alumno .cmu-tag--equipo{ background: var(--cm-ink); color: var(--cm-card); border-color: var(--cm-ink); }
.cmu-tag--equipo{ background: var(--cm-acento-suave); color: var(--cm-enlace); border-color: transparent; }

/* ── Like, comentarios, menu ────────────────────────────────────────────────── */
.cmu-accion{
  display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 8px; margin-left: -8px;
  border: 0; border-radius: var(--cm-radio-sm); background: transparent; color: var(--cm-dim);
  font: inherit; font-size: var(--fs-sm); font-weight: 600; cursor: pointer;
}
.cmu-accion:hover:not(:disabled){ background: var(--cm-card-2); color: var(--cm-ink); }
.cmu-accion:disabled{ cursor: default; opacity: .55; }
.cmu-accion[data-on="true"]{ color: var(--cm-enlace); }
.cmu--alumno .cmu-accion[data-on="true"] svg{ fill: var(--cm-acento); }
.cmu-accion + .cmu-accion{ margin-left: 0; }

.cmu-menu{ position: relative; flex: none; }
.cmu-menu-btn{ width: 32px; height: 32px; display: grid; place-items: center; border: 0; border-radius: var(--cm-radio-sm);
  background: transparent; color: var(--cm-faint); cursor: pointer; }
.cmu-menu-btn:hover{ background: var(--cm-card-2); color: var(--cm-ink); }
.cmu-menu-lista{ position: absolute; right: 0; top: 36px; z-index: 30; min-width: 170px; padding: 6px;
  background: var(--cm-card); border: var(--cm-borde); border-radius: var(--cm-radio-sm); box-shadow: 0 12px 30px rgba(18,21,27,.18); }
.cmu--alumno .cmu-menu-lista{ box-shadow: var(--cm-sombra); }
.cmu-menu-item{ display: flex; width: 100%; align-items: center; gap: 8px; min-height: 36px; padding: 0 10px; border: 0; border-radius: 8px;
  background: transparent; color: var(--cm-ink); font: inherit; font-size: var(--fs-sm); text-align: left; cursor: pointer; }
.cmu-menu-item:hover{ background: var(--cm-card-2); }
.cmu-menu-item--peligro{ color: var(--bad); }

/* ── La cara: avatar con la insignia de nivel ──────────────────────────────── */
.cmu-av{ position: relative; flex: none; display: inline-block; line-height: 0; }
.cmu-av-img{ display: block; border-radius: 50%; object-fit: cover; background: var(--cm-card-2); }
.cmu-av-ini{ display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 700; line-height: 1;
  background: var(--cm-acento); color: var(--cm-acento-ink); }
.cmu--alumno .cmu-av-ini{ background: var(--cm-ink); color: var(--cm-card); }
.cmu--alumno .cmu-av-img, .cmu--alumno .cmu-av-ini{ box-shadow: 0 0 0 2px var(--cm-ink); }
.cmu-av-nivel{ position: absolute; right: -3px; bottom: -3px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center; font: 800 10px/1 var(--cm-mono);
  background: var(--cm-acento); color: var(--cm-acento-ink); border: 2px solid var(--cm-card); }
.cmu--alumno .cmu-av-nivel{ border-color: var(--cm-ink); }
.cmu-nombre{ font-weight: 700; color: var(--cm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmu-nombre-btn{ border: 0; padding: 0; background: none; font: inherit; cursor: pointer; text-align: left; color: inherit; min-width: 0; }
.cmu-nombre-btn:hover .cmu-nombre{ text-decoration: underline; }

/* ── El texto de un post o comentario: saltos de linea, links, menciones ───── */
.cmu-texto{ margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.cmu-link{ color: var(--cm-enlace); text-decoration: underline; text-underline-offset: 2px; }
.cmu-mencion{ font-weight: 700; color: var(--cm-enlace); background: var(--cm-acento-suave); border-radius: 4px; padding: 0 2px; }

/* ── Video, imagen, adjunto ─────────────────────────────────────────────────── */
.cmu-video{ position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000; border-radius: var(--cm-radio-sm); overflow: hidden; }
.cmu-video iframe{ position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.cmu-img{ display: block; width: 100%; max-height: 520px; object-fit: contain; border-radius: var(--cm-radio-sm); background: var(--cm-card-2); border: 1px solid var(--cm-line); }
.cmu-adjunto{ display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--cm-line); border-radius: var(--cm-radio-sm);
  background: var(--cm-card-2); color: var(--cm-ink); text-decoration: none; min-width: 0; }
.cmu-adjunto:hover{ border-color: var(--cm-dim); }
.cmu-adjunto-nombre{ flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; font-size: var(--fs-sm); }

/* ── La encuesta ────────────────────────────────────────────────────────────── */
.cmu-encuesta{ display: flex; flex-direction: column; gap: 8px; }
.cmu-opcion{ position: relative; display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; padding: 0 12px; overflow: hidden;
  border: 1px solid var(--cm-line); border-radius: var(--cm-radio-sm); background: var(--cm-card); color: var(--cm-ink);
  font: inherit; font-size: var(--fs-sm); text-align: left; cursor: pointer; }
.cmu--alumno .cmu-opcion{ border: 2px solid var(--cm-ink); }
.cmu-opcion:hover:not(:disabled){ border-color: var(--cm-dim); }
.cmu-opcion:disabled{ cursor: default; }
.cmu-opcion-barra{ position: absolute; inset: 0 auto 0 0; background: var(--cm-acento-suave); pointer-events: none; }
.cmu--alumno .cmu-opcion-barra{ background: var(--cm-acento); opacity: .55; }
.cmu-opcion > span{ position: relative; }
.cmu-opcion-texto{ flex: 1; min-width: 0; overflow-wrap: anywhere; }
.cmu-opcion[data-mio="true"]{ font-weight: 700; }

/* ── El post abierto y sus comentarios ─────────────────────────────────────── */
.cmu-detalle{ display: flex; flex-direction: column; gap: 14px; }
.cmu-detalle-pie{ display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; padding: 8px 0; border-top: 1px solid var(--cm-line); border-bottom: 1px solid var(--cm-line); }
.cmu-coms{ display: flex; flex-direction: column; gap: 14px; }
.cmu-com{ display: flex; gap: 10px; min-width: 0; }
.cmu-com-cuerpo{ flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.cmu-com-burbuja{ padding: 8px 12px; border-radius: var(--cm-radio-sm); background: var(--cm-card-2); min-width: 0; }
.cmu-com-cab{ display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.cmu-com-acc{ display: flex; flex-wrap: wrap; align-items: center; gap: 2px 10px; padding-left: 4px; }
.cmu-resps{ display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
.cmu-nuevo-com{ display: flex; gap: 10px; align-items: flex-start; }
.cmu-nuevo-com .cmu-campo{ flex: 1; min-width: 0; }

/* ── Campo con @menciones ───────────────────────────────────────────────────── */
.cmu-campo{ position: relative; display: flex; flex-direction: column; gap: 6px; }
.cmu-area{ width: 100%; min-height: 44px; resize: vertical; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--cm-radio-sm);
  background: var(--cm-card); color: var(--cm-ink); font: inherit; font-size: var(--fs-md); line-height: 1.5; }
.cmu--alumno .cmu-area{ border: 2px solid var(--cm-line); }
.cmu-area:focus{ outline: none; border-color: var(--cm-enlace); box-shadow: var(--focus-ring); }
.cmu--alumno .cmu-area:focus{ border-color: var(--cm-ink); box-shadow: none; }
.cmu-sug{ position: absolute; left: 0; right: 0; top: 100%; z-index: 40; margin-top: 4px; padding: 4px; max-height: 260px; overflow-y: auto;
  background: var(--cm-card); border: var(--cm-borde); border-radius: var(--cm-radio-sm); box-shadow: 0 12px 30px rgba(18,21,27,.18); }
.cmu-sug-item{ display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; padding: 4px 8px; border: 0; border-radius: 8px;
  background: transparent; color: var(--cm-ink); font: inherit; font-size: var(--fs-sm); text-align: left; cursor: pointer; }
.cmu-sug-item[data-on="true"], .cmu-sug-item:hover{ background: var(--cm-card-2); }

/* ── El compositor ──────────────────────────────────────────────────────────── */
.cmu-comp{ display: flex; flex-direction: column; gap: 12px; }
.cmu-comp-titulo{ width: 100%; border: 0; border-bottom: 1px solid var(--cm-line); padding: 8px 0; background: transparent; color: var(--cm-ink);
  font: inherit; font-size: var(--fs-sect); font-weight: 700; }
.cmu-comp-titulo:focus{ outline: none; border-bottom-color: var(--cm-ink); }
.cmu-comp-herr{ display: flex; flex-wrap: wrap; gap: 6px; }
.cmu-comp-op{ display: flex; gap: 8px; align-items: center; }
.cmu-comp-op .mk-input{ flex: 1; min-width: 0; }
.cmu-barra-prog{ height: 4px; border-radius: 999px; background: var(--cm-card-2); overflow: hidden; }
.cmu-barra-prog > i{ display: block; height: 100%; background: var(--cm-enlace); }

/* ── Columna lateral ────────────────────────────────────────────────────────── */
.cmu-stats{ display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 10px; }
.cmu-stat b{ display: block; font-size: var(--fs-card); }
.cmu-stat span{ font-size: var(--fs-meta); color: var(--cm-faint); }
.cmu-punto{ display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--cm-bien); flex: none; }

/* ── Ranking ────────────────────────────────────────────────────────────────── */
.cmu-rank-cab{ display: grid; grid-template-columns: minmax(0, 300px) minmax(0, 1fr); gap: 18px; align-items: start; }
@media (max-width: 860px){ .cmu-rank-cab{ grid-template-columns: minmax(0, 1fr); } }
.cmu-yo{ display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.cmu-niveles{ display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px 18px; }
.cmu-nivel{ display: flex; align-items: flex-start; gap: 10px; padding: 6px 0; min-width: 0; }
.cmu-nivel-num{ flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font: 800 12px/1 var(--cm-mono);
  background: var(--cm-card-2); color: var(--cm-dim); border: 1px solid var(--cm-line); }
.cmu-nivel[data-mio="true"] .cmu-nivel-num{ background: var(--cm-acento); color: var(--cm-acento-ink); border-color: var(--cm-ink); }
.cmu-nivel-txt{ min-width: 0; }
.cmu-nivel-nom{ font-weight: 700; overflow-wrap: anywhere; }
.cmu-tablas{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
@media (max-width: 860px){ .cmu-tablas{ grid-template-columns: minmax(0, 1fr); } }
.cmu-fila{ display: flex; align-items: center; gap: 10px; padding: 7px 0; min-width: 0; }
.cmu-fila + .cmu-fila{ border-top: 1px solid var(--cm-line); }
.cmu-puesto{ flex: none; width: 22px; font: 700 var(--fs-meta)/1 var(--cm-mono); color: var(--cm-faint); text-align: center; }
.cmu-fila-nom{ flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.cmu-mas{ flex: none; font: 700 var(--fs-sm)/1 var(--cm-mono); color: var(--cm-enlace); }

/* ── Miembros ───────────────────────────────────────────────────────────────── */
.cmu-miembro{ display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 4px; border: 0; background: transparent;
  color: inherit; font: inherit; text-align: left; cursor: pointer; min-width: 0; }
.cmu-miembro + .cmu-miembro{ border-top: 1px solid var(--cm-line); }
.cmu-miembro:hover .cmu-nombre{ text-decoration: underline; }
.cmu-miembro-txt{ flex: 1; min-width: 0; }
.cmu-miembro-bio{ font-size: var(--fs-sm); color: var(--cm-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmu-miembro-der{ flex: none; text-align: right; font-size: var(--fs-meta); color: var(--cm-faint); display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.cmu-en-linea{ display: inline-flex; align-items: center; gap: 6px; color: var(--cm-bien); font-weight: 600; }

/* ── Perfil ─────────────────────────────────────────────────────────────────── */
.cmu-perfil{ display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
.cmu-links{ display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }

/* ── La linea del onboarding de la tab (equipo) ─────────────────────────────── */
.cmu-onb{ display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; padding: 10px 14px; border-radius: var(--cm-radio-sm);
  background: var(--cm-acento-suave); font-size: var(--fs-sm); }
.cmu-onb-paso{ display: inline-flex; align-items: center; gap: 6px; }
.cmu-onb-paso[data-hecho="true"]{ color: var(--cm-dim); text-decoration: line-through; }

/* ── La barra de arriba: buscar y la campana ────────────────────────────────── */
.cmu-icono-btn{ position: relative; width: 40px; height: 40px; display: grid; place-items: center; border: 0; border-radius: 999px;
  background: transparent; color: var(--cm-dim); cursor: pointer; flex: none; }
.cmu-icono-btn:hover{ background: var(--cm-card-2); color: var(--cm-ink); }
.cmu-globito{ position: absolute; top: 3px; right: 2px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center; font: 800 10px/1 var(--cm-mono);
  background: var(--bad); color: #fff; border: 2px solid var(--cm-card); }
.cmu-campana{ position: relative; flex: none; }
.cmu-campana-panel{ position: absolute; right: 0; top: 46px; z-index: 35; width: min(380px, calc(100vw - 32px)); max-height: min(70vh, 560px);
  display: flex; flex-direction: column; background: var(--cm-card); border: var(--cm-borde); border-radius: var(--cm-radio-sm);
  box-shadow: 0 16px 40px rgba(18,21,27,.2); overflow: hidden; }
.cmu--alumno .cmu-campana-panel{ box-shadow: var(--cm-sombra); }
.cmu-campana-cab{ display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px 6px 14px; flex-wrap: wrap; }
.cmu-campana-lista{ overflow-y: auto; padding: 0 6px 6px; }
.cmu-aviso{ display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 9px 8px; border: 0; border-radius: 8px; background: transparent;
  color: var(--cm-ink); font: inherit; font-size: var(--fs-sm); text-align: left; cursor: pointer; }
.cmu-aviso:hover{ background: var(--cm-card-2); }
.cmu-aviso[data-leida]{ color: var(--cm-dim); }
.cmu-aviso-ico{ flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--cm-acento-suave); color: var(--cm-enlace); }
.cmu-aviso-txt{ flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; overflow-wrap: anywhere; }
.cmu-aviso-punto{ flex: none; width: 9px; height: 9px; margin-top: 6px; border-radius: 50%; background: var(--cm-enlace); }
.cmu--alumno .cmu-aviso-punto{ background: var(--cm-ink); }
.cmu-menu-lista[data-arriba]{ top: auto; bottom: 46px; }

/* ── Calendario ─────────────────────────────────────────────────────────────── */
.cmu-cal{ display: flex; flex-direction: column; gap: 10px; }
.cmu-cal-cab{ display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.cmu-cal-nav{ display: flex; align-items: center; gap: 4px; flex: 1 1 250px; min-width: 0; }
.cmu-cal-mes{ font-size: var(--fs-card); margin: 0 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.cmu-mes{ display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-top: 1px solid var(--cm-line); border-left: 1px solid var(--cm-line); transition: opacity .15s; }
.cmu-mes[data-cargando]{ opacity: .45; }
.cmu-mes-dow{ padding: 6px; font-size: var(--fs-meta); color: var(--cm-faint); text-align: center; text-transform: capitalize;
  border-right: 1px solid var(--cm-line); border-bottom: 1px solid var(--cm-line); }
.cmu-dia{ position: relative; min-height: 96px; padding: 4px; display: flex; flex-direction: column; gap: 3px; min-width: 0; cursor: pointer;
  border-right: 1px solid var(--cm-line); border-bottom: 1px solid var(--cm-line); }
.cmu-dia:hover{ background: var(--cm-card-2); }
.cmu-dia[data-fuera]{ background: var(--cm-card-2); }
.cmu-dia[data-fuera] .cmu-dia-num{ color: var(--cm-faint); }
.cmu-dia[data-elegido]{ box-shadow: inset 0 0 0 2px var(--cm-enlace); }
.cmu--alumno .cmu-dia[data-elegido]{ box-shadow: inset 0 0 0 2px var(--cm-ink); }
.cmu-dia-num{ align-self: flex-start; min-width: 24px; height: 24px; padding: 0 4px; border-radius: 999px; display: inline-flex; align-items: center;
  justify-content: center; font-size: var(--fs-sm); font-weight: 600; }
.cmu-dia[data-hoy] .cmu-dia-num{ background: var(--cm-acento); color: var(--cm-acento-ink); }
.cmu-dia-evs{ display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cmu-dia-ev{ display: block; width: 100%; padding: 2px 5px; border: 0; border-radius: 5px; background: var(--cm-acento-suave); color: var(--cm-ink);
  font: inherit; font-size: var(--fs-meta); text-align: left; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmu-dia-ev:hover{ filter: brightness(.96); }
.cmu-dia-ev[data-cerrado]{ background: var(--cm-card-2); color: var(--cm-dim); }
.cmu-dia-ev-tit{ font-weight: 600; }
.cmu-dia-punto{ display: none; width: 6px; height: 6px; border-radius: 50%; background: var(--cm-enlace); margin: auto auto 2px; }
.cmu--alumno .cmu-dia-punto{ background: var(--cm-ink); }
@media (max-width: 640px){
  .cmu-dia{ min-height: 46px; align-items: center; padding: 3px 0; }
  .cmu-dia-num{ align-self: center; }
  .cmu-dia-evs{ display: none; }
  .cmu-dia-punto{ display: block; }
}
.cmu-dia-lista{ display: flex; flex-direction: column; gap: 6px; padding-top: 6px; }
.cmu-proximos{ display: flex; flex-direction: column; gap: 12px; }
.cmu-ev-fila{ display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px; border: 1px solid var(--cm-line); border-radius: var(--cm-radio-sm);
  background: var(--cm-card); color: inherit; font: inherit; text-align: left; cursor: pointer; min-width: 0; flex-wrap: wrap; }
.cmu--alumno .cmu-ev-fila{ border: 2px solid var(--cm-line); }
.cmu-ev-fila:hover{ border-color: var(--cm-dim); }
.cmu-ev-mini{ flex: none; width: 44px; height: 44px; border-radius: 10px; display: grid; place-items: center; }
.cmu-ev-mini--vacia{ background: var(--cm-acento-suave); color: var(--cm-enlace); }
.cmu-ev-fila-txt{ flex: 1; min-width: 140px; display: flex; flex-direction: column; gap: 2px; }
.cmu-ev{ display: flex; flex-direction: column; gap: 10px; }
.cmu-ev-portada{ height: 140px; border-radius: var(--cm-radio-sm); background: var(--cm-card-2); }
.cmu-ev-portada--editor{ height: 110px; display: flex; align-items: flex-end; justify-content: flex-end; padding: 10px;
  border: 1px dashed var(--cm-line); }
.cmu-ev-dato{ display: flex; align-items: flex-start; gap: 10px; min-width: 0; overflow-wrap: anywhere; }
.cmu-ev-dato > svg{ margin-top: 2px; color: var(--cm-dim); }
.cmu-ev-cerrado{ color: var(--cm-dim); font-weight: 600; }

/* ── Formularios (evento, About, sacar) ─────────────────────────────────────── */
.cmu-form{ display: flex; flex-direction: column; gap: 12px; }
.cmu-form-fila{ display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; align-items: end; }
.cmu-campo-l{ display: flex; flex-direction: column; gap: 5px; min-width: 0; font-size: var(--fs-sm); font-weight: 600; color: var(--cm-dim); }
.cmu-campo-l > *{ font-weight: 400; }

/* ── About y búsqueda ───────────────────────────────────────────────────────── */
.cmu-about{ display: flex; flex-direction: column; gap: 12px; }
.cmu-about-tit{ margin: 0; font-size: var(--fs-sect); font-weight: 700; overflow-wrap: anywhere; }
.cmu-buscar{ display: flex; flex-direction: column; gap: 14px; }

/* ── Los botones de la app, con la piel del portal ──────────────────────────── */
.cmu--alumno .mk-btn{ border-radius: 10px; border: 2px solid var(--cm-ink); box-shadow: var(--cm-sombra); color: var(--cm-ink); background: var(--cm-card-2); font-weight: 700; }
.cmu--alumno .mk-btn--primary{ background: var(--cm-acento); color: var(--cm-acento-ink); }
.cmu--alumno .mk-btn--tertiary{ border-color: transparent; box-shadow: none; background: transparent; }
.cmu--alumno .mk-btn--danger{ background: #f6c9c1; }
.cmu--alumno .mk-btn:hover:not(:disabled){ box-shadow: var(--cm-sombra-hover); }
.cmu--alumno .mk-btn--tertiary:hover:not(:disabled){ box-shadow: none; background: var(--cm-card-2); }
.cmu--alumno .mk-modal{ border: 2px solid var(--cm-ink); box-shadow: 6px 7px 0 0 var(--cm-ink); background: var(--cm-card); }
.cmu--alumno .mk-modal__pie{ background: var(--cm-card); }
`;
