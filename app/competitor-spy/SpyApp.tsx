'use client';

// =============================================================================
// Competitor Spy — un catálogo de piezas con el análisis en un riel al costado
// =============================================================================
// ⚠️ LA PANTALLA SE COPIA DE UNA REFERENCIA. No se mejora la que estaba: se copia el esqueleto de
// otra que funciona. Martín lo pidió cuatro veces (1/11/2026): «rediseñes toda la tab siguiendo una
// referencia, no que corrijas o intentes mejorar lo que ya hiciste». Las tres vueltas anteriores
// reordenaron las mismas cajas y después les cambiaron los tokens, que es inventar con otro nombre.
//
// LA REFERENCIA, medida con el navegador el 1/11/2026 (docs/diseno/referencia-spy.md):
//   · demo.codeandchill.store/fitlo/#/shop/all → la pantalla entera. Es una tienda: un título
//     grande, pestañas con el conteo en una badge, UNA barra de herramientas y una grilla de
//     tarjetas con el creativo a sangre. Es la misma forma que Spy (un catálogo que se filtra).
//   · demo.codeandchill.store/merrin/ → el riel de 336 px: la barra apilada, las filas con ícono,
//     nombre y valor, y las celdas pastel de datos.
//
// LO QUE CAMBIÓ DE ESQUELETO, y por qué:
//   · El análisis dejó de ser una banda arriba de las piezas y pasó al riel de la derecha. Por eso
//     puede estar SIEMPRE ABIERTO: ya no compite con el catálogo ni lo empuja fuera de la pantalla.
//   · Las seis píldoras grises de la identidad se fueron: los números son celdas de datos en el
//     riel y la frescura es la línea gris debajo del título.
//   · La tarjeta no tiene borde, tiene un TINTE, y el tinte dice de qué canal es.
//
// REHECHA el 31/10/2026 después de que Martín abriera la anterior («lista a la izquierda + cuatro
// acordeones por canal», sacada de la ficha del CRM) y la rechazara. Se midieron once productos de la
// categoría con el navegador; el relevamiento está en docs/hallazgos-competitors-spy.md. De dónde sale
// cada cosa:
//
//  · La barra fija con UN campo: Meta Ad Library y Google Ads Transparency. Ninguno de los once tiene
//    un «Agregar competidor»: tienen un buscador que no se va nunca. Pegar lleva a la ficha.
//  · Las migas con el selector y las píldoras de frescura, las pestañas, la banda de tres columnas, la
//    franja con «×» y el modal del «+» con dos pestañas: Foreplay Spyder (de sus capturas: la app pide
//    cuenta y no se entró).
//  · El bloque único de vacío, que deja todos los controles en su lugar: Google y Meta.
//  · La sección sin nada que decir se BORRA en vez de anunciarse: Semrush, medido con dos dominios.
//  · La tabla de competidores (filas, no tarjetas): Foreplay y BigSpy.
//
// NO HAY ONBOARDING (Martín, 31/10: «nada debe tener onboarding... limitas la experiencia del
// usuario»). Los cuatro pasos siguen en el catálogo porque MaKo los lee, pero los marca EL ACTO
// (lib/spy-actos.ts), no una pantalla.
//
// LAS REGLAS DE PRODUCTO QUE SIGUEN VALIENDO:
//  1. Un contador ausente no es cero (`dibujarContador`, y BigSpy es el contraejemplo: «0 / Likes»
//     sobre marcas con millones de creativos).
//  2. La etapa es NUESTRO criterio y se dice. «No se sabe desde cuándo» NO es «es nuevo».
//  3. Nada de «vs» ni de peleas: la política III.L de YouTube. Lo vigila tests/spy-reglas.test.ts.
//
// CUATRO ESTADOS QUE NO COMPARTEN COMPONENTE: cargando, leímos y no hay, no pudimos leer, cero
// competidores. Quién manda es `estadoDeResultados` (lib/spy-vista.ts), que se puede probar.
//
// ⚠️ NO HAY SEGUIMIENTO SOLO: se lee al agregar y al abrir una ficha de más de un día
// (`debeLeerAlAbrir`). No hay cron, así que no se dibuja nada que pida dos mediciones (deltas, línea
// de tiempo por día) y «Revisado hace 2 h» dice cuándo se leyó, sin prometer que se vigila.
//
// El copy va en español neutro, con «tú»: el producto se usa en México.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../_components/icons';
import { BotonIntegracion } from '../_components/ConectarIntegracion';
import { ConfirmModal } from '../_components/ConfirmModal';
import { ModalShell } from '../_components/ModalShell';
import { Dropdown } from '../components/Dropdown';
import { AVISO_CORTE_VIEWCOUNT, ETAPA_ES_NUESTRO_CRITERIO, NOMBRE_CANAL, cruzaElCorte, dibujarContador } from '@/lib/spy-reglas';
import { caricaturaDeCompetidor, nombreDeTarjeta } from '@/lib/spy-caricatura';
// El buscador del alta de un lead, reusado tal cual: busca por NOMBRE o por @, con fotos y lista.
import { InstagramBuscador } from '@/app/crm/new/InstagramBuscador';
import {
  canalesDe, cumpleFiltro, debeLeerAlAbrir, destinosDe, estadoDeResultados, fechaCorta, filtrarPiezas,
  fraseDeLectura, ganchosDe, haceCuanto, mezclaDeTipos, ordenarPiezas, pideConectarMeta,
  type FiltroSpy, type OrdenSpy,
} from '@/lib/spy-vista';
import type { Competidor, LecturaCanalSpy, ResumenPiezas } from '@/lib/spy';
import {
  analizarAction, competidoresAction, guardarAnuncioAction, piezasAction, quitarCompetidorAction,
  revisarAction, sumarCanalAction, sumarCompetidorAction, vistaPreviaAction, type PiezaVista, type VistaPrevia,
} from './actions';
import { TarjetaPieza } from './TarjetaPieza';
import { PeliculaDeOrden } from './OrdenSpy';

const CSS = `
/* ─────────────────────────────────────────────────────────────────────────────
   COPIADO DE LA REFERENCIA, no inventado. Dos plantillas de demo.codeandchill.store,
   leídas con el navegador el 1/11/2026 (reglas y medidas en docs/diseno/referencia-spy.md):

     · fitlo /shop  → la pantalla entera: título, pestañas con conteo, barra de
       herramientas y la grilla de tarjetas visuales. Es la misma forma que Spy
       (un catálogo de piezas que se filtra), así que se copia su esqueleto.
     · merrin       → el riel de análisis de 336 px: la barra apilada, las filas con
       ícono + nombre + valor, y las celdas pastel de datos.

   Cada clase de acá abajo es la de la referencia con el prefijo spy-, porque este
   bloque se inyecta sin alcance y un .card suelto pisaría media app. El mapeo:
     .card→.spy-caja  .chead→.spy-caja-cabecera  .pgrid→.spy-pgrid  .pcard→.spy-pcard
     .tabs→.spy-pestanas  .toolbar→.spy-herramientas  .kpi→.spy-kpi  .mix__*→.spy-mix-*
     .phead→.spy-phead  .btn→.spy-boton  .chip→.spy-chip  .input→.spy-entrada

   Los valores salen de los tokens de la casa, que ya son este esqueleto con otros
   nombres (--surface=--card, --border=--line, --border-strong=--line-2, --faint=--muted).
   Lo que la casa todavía no nombra se declara acá adentro, en .spy.
   ───────────────────────────────────────────────────────────────────────────── */
.spy{
  /* Las cuatro celdas pastel son las de merrin tal cual (los --tile-1..4 medidos). */
  --t1:#e5e8cd; --t2:#d9e8e1; --t3:#f0e4cc; --t4:#dbe3ef;
  --t-ink:#17181c; --t-dim:#17181ca8;
  /* La serie por categoría lleva el nombre de LO QUE ES, no un número: el mismo color
     en el punto, el tinte de la tarjeta, el segmento de la barra y la fila del riel,
     para no tener que leer ninguna leyenda. Los dos valores son los de la marca que
     ya vive en ServicioVisual.tsx. */
  --ig:#D62976; --yt:#FF0000;
  /* La serie de cuatro para lo que NO es un canal (formatos, destinos): los cuatro
     categoricos medidos de merrin, tal cual. */
  --s1:#64761a; --s2:#c0643c; --s3:#4b6fa3; --s4:#c4952c;
  --gap:18px;
  min-height:100vh;background:var(--bg);color:var(--ink);font-size:var(--fs-md)
}

/* ── La barra de arriba: el campo no se va nunca (Meta Ad Library, Google Ads
      Transparency). Es el .top de la referencia: píldora de búsqueda + botones
      cuadrados de 42. ── */
.spy-barra{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:10px;
  padding:13px 22px;background:var(--bg);border-bottom:1px solid var(--border)}
.spy-marca{display:inline-flex;align-items:center;gap:9px;height:42px;padding:0 14px;border:0;
  background:none;color:var(--ink);font-size:var(--fs-md);font-weight:700;letter-spacing:-.01em;cursor:pointer}
.spy-campo{display:flex;align-items:center;gap:10px;flex:1;min-width:0;max-width:420px;height:42px;
  padding:0 8px 0 14px;border-radius:13px;background:var(--surface);color:var(--faint);
  box-shadow:inset 0 0 0 1px var(--border),var(--sombra-tarjeta)}
.spy-campo:focus-within{box-shadow:inset 0 0 0 1.5px var(--accent),0 0 0 4px var(--mako-bg)}
.spy-campo input{flex:1;min-width:0;border:0;outline:0;background:none;font:inherit;
  font-size:var(--fs-md);font-weight:500;color:var(--ink)}
.spy-mas{display:grid;place-items:center;flex:0 0 auto;width:42px;height:42px;border:0;border-radius:13px;
  background:var(--surface);color:var(--ink);box-shadow:inset 0 0 0 1px var(--border),var(--sombra-tarjeta);cursor:pointer}
.spy-mas:hover{background:var(--surface-2)}

.spy-cuerpo{max-width:var(--pagina-max);margin:0 auto;padding:10px 22px 40px}

/* ── El encabezado de página: .phead. Un título grande y una línea gris. Lo que
      antes eran seis píldoras grises en fila ahora es esa línea. ── */
.spy-phead{display:flex;flex-wrap:wrap;align-items:flex-end;gap:16px;margin:10px 0 20px}
.spy-phead__texto{flex:1 1 260px;min-width:0}
.spy-phead h1{margin:0;font-size:clamp(28px,2.6vw,38px);font-weight:600;line-height:1.04;letter-spacing:-.025em}
.spy-phead p{margin:8px 0 0;max-width:70ch;color:var(--faint);font-size:var(--fs-md)}
.spy-phead__acciones{display:flex;flex-wrap:wrap;align-items:center;gap:8px}

/* ── Pestañas: 42 px, subrayado del acento, conteo en una .badge. ── */
.spy-pestanas{position:relative;display:flex;gap:4px;margin-bottom:20px;overflow-x:auto;
  border-bottom:1px solid var(--border);scrollbar-width:none}
.spy-pestanas::-webkit-scrollbar{display:none}
.spy-pestana{position:relative;display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 12px;
  border:0;background:none;color:var(--faint);font-size:var(--fs-md);font-weight:600;white-space:nowrap;cursor:pointer}
.spy-pestana:hover,.spy-pestana[data-activa=true]{color:var(--ink)}
.spy-pestana[data-activa=true]::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--accent)}
.spy-badge{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 6px;border-radius:99px;
  background:var(--primary-bg);color:var(--dim);font-size:11px;font-weight:700}
.spy-pestana[data-activa=true] .spy-badge{background:var(--mako-bg);color:var(--mako-ink)}

/* ── Las dos columnas de merrin: el catálogo manda y el análisis va a un riel de 336. ── */
.spy-cols{display:grid;grid-template-columns:minmax(0,1fr) 336px;gap:var(--gap);align-items:start}
.spy-riel{display:flex;flex-direction:column;gap:var(--gap);min-width:0}

/* --- La miga: TODA la cabecera de la ficha. 18 px. Copiada de .crumbs--page de fitlo. --- */
.spy-migas{display:flex;align-items:center;gap:8px;min-width:0;margin:8px 0 16px;
  font-size:var(--fs-sm);font-weight:600;color:var(--faint);white-space:nowrap}
.spy-migas button{display:inline-flex;align-items:center;gap:8px;border:0;background:none;padding:0;
  font:inherit;color:inherit;cursor:pointer}
.spy-migas button:hover{color:var(--ink)}
.spy-migas b{min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--ink);font-weight:600}
.spy-migas i{display:inline-block;width:5px;height:5px;border-right:1.5px solid var(--faint);
  border-top:1.5px solid var(--faint);transform:rotate(45deg);flex:0 0 auto}

/* --- La identidad abre el riel, como la .pd-info abre la columna de al lado. --- */
.spy-ficha{display:flex;flex-direction:column;gap:12px;padding:18px 20px 20px;border-radius:var(--r-lg);
  background:var(--surface);box-shadow:inset 0 0 0 1px var(--border),var(--sombra-tarjeta)}
.spy-ficha small{display:block;color:var(--faint);font-size:var(--fs-sm);font-weight:600}
.spy-ficha h1{margin:4px 0 0;font-size:var(--fs-kpi);font-weight:600;line-height:1.1;letter-spacing:-.02em}
.spy-ficha__datos{display:flex;flex-wrap:wrap;gap:6px}
.spy-ficha__acciones{display:flex;gap:8px}
.spy-ficha__acciones .spy-boton:first-child{flex:1}

/* --- La vista previa del modal: quien es, antes de guardarlo. --- */
.spy-previa{display:flex;gap:14px;padding:14px;border-radius:var(--r-lg);background:var(--surface-2);
  box-shadow:inset 0 0 0 1px var(--border)}
.spy-previa__cara{display:grid;place-items:center;flex:0 0 auto;width:56px;height:56px;overflow:hidden;
  border-radius:var(--r-md);background:var(--t1);color:var(--t-ink);font-size:var(--fs-sect);font-weight:700}
.spy-previa__cara img{display:block;width:100%;height:100%;object-fit:cover}
.spy-previa__texto{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.spy-previa__texto b{font-size:var(--fs-card);font-weight:600}
.spy-previa__texto small{color:var(--faint);font-size:var(--fs-sm)}
.spy-previa__bio{color:var(--dim);font-size:var(--fs-sm);line-height:1.45;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}

/* ── Celdas pastel de datos: .kpi. Sin deltas, porque Spy lee UNA vez. ── */
.spy-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.spy-kpi{display:flex;flex-direction:column;min-height:98px;padding:16px 18px 14px;border-radius:var(--r-lg);
  background:var(--t1);color:var(--t-ink);overflow:hidden}
.spy-kpi:nth-child(2){background:var(--t2)}
.spy-kpi:nth-child(3){background:var(--t3)}
.spy-kpi:nth-child(4){background:var(--t4)}
.spy-kpi b{display:flex;align-items:center;gap:8px;color:var(--t-dim);font-size:var(--fs-sm);font-weight:600}
.spy-kpi strong{margin-top:10px;font-size:var(--fs-kpi);font-weight:600;line-height:1.1;letter-spacing:-.01em}
.spy-kpi small{margin-top:auto;padding-top:8px;color:var(--t-dim);font-size:var(--fs-meta);font-weight:600}

/* ── La caja: .card. Un tono MÁS CLARA que el fondo, sin borde duro. ── */
.spy-caja{position:relative;min-width:0;padding:18px 20px 20px;border-radius:var(--r-lg);background:var(--surface);
  box-shadow:inset 0 0 0 1px var(--border),var(--sombra-tarjeta)}
.spy-caja--plana{padding:0}
.spy-caja-cabecera{display:flex;align-items:center;gap:10px;min-height:32px;margin-bottom:14px}
.spy-caja--plana .spy-caja-cabecera{padding:16px 20px 0}
.spy-caja-cabecera div{flex:1;min-width:0}
.spy-caja-cabecera h2{margin:0;font-size:var(--fs-card);font-weight:600;line-height:1.25;letter-spacing:-.005em}
.spy-caja-cabecera p{margin:2px 0 0;color:var(--faint);font-size:var(--fs-sm)}

/* ── El riel de análisis de merrin: barra apilada + filas con ícono, nombre y valor. ── */
.spy-mix-barra{display:flex;gap:3px;height:12px;margin-bottom:14px}
.spy-mix-seg{border-radius:4px;min-width:6px}
.spy-mix-filas{display:flex;flex-direction:column;gap:2px;margin:0;padding:0;list-style:none}
.spy-mix-filas li{display:flex;align-items:center;gap:10px;padding:7px 0}
.spy-mix-ico{display:grid;place-items:center;flex:0 0 auto;width:30px;height:30px;border-radius:9px;
  background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--border)}
.spy-mix-nombre{flex:1;min-width:0}
.spy-mix-nombre b{display:block;font-size:var(--fs-md);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spy-mix-nombre small{color:var(--faint);font-size:var(--fs-meta)}
.spy-mix-val{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex:0 0 auto;font-weight:600}

/* ── La barra de herramientas de fitlo: campo ancho a la izquierda, chips, orden a la derecha. ── */
.spy-herramientas{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:14px}
.spy-buscar{position:relative;display:flex;align-items:center;flex:1 1 170px;max-width:260px}
.spy-buscar svg{position:absolute;left:12px;color:var(--faint);pointer-events:none}
.spy-buscar input{width:100%;height:42px;padding:0 13px 0 38px;border:0;border-radius:12px;background:var(--surface);
  box-shadow:inset 0 0 0 1px var(--border-strong);font:inherit;font-size:var(--fs-md);font-weight:500;color:var(--ink)}
.spy-buscar input:focus{outline:0;box-shadow:inset 0 0 0 1.5px var(--accent),0 0 0 4px var(--mako-bg)}
.spy-chip{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:0;border-radius:99px;
  background:var(--surface);box-shadow:inset 0 0 0 1px var(--border);color:var(--faint);
  font-size:var(--fs-sm);font-weight:600;white-space:nowrap;cursor:pointer}
.spy-chip:hover:not(:disabled){color:var(--ink)}
.spy-chip[data-activo=true]{background:var(--accent);color:var(--on-primary);box-shadow:none}
.spy-chip:disabled{opacity:.45;cursor:not-allowed}
.spy-chip .spy-badge{min-width:18px;height:18px;background:rgba(0,0,0,.06);color:inherit}
.spy-chip[data-activo=true] .spy-badge{background:rgba(255,255,255,.22)}
.spy-chip i{width:8px;height:8px;border-radius:50%;flex:0 0 auto}
.spy-orden{margin-left:0}
.spy-conteo{margin:0 0 12px;color:var(--faint);font-size:var(--fs-sm);font-weight:600}

/* ── LA GRILLA Y LA TARJETA, que es lo que más se ve: .pgrid + .pcard de fitlo.
      La tarjeta no tiene borde: tiene un tinte, el creativo a sangre arriba en 4/5, un
      punto del canal arriba a la izquierda, una píldora sobre la foto y un pie con el
      texto a la izquierda y el número a la derecha. ── */
.spy-pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:var(--gap)}
.spy-pcard{position:relative;display:flex;flex-direction:column;min-width:0;isolation:isolate;overflow:hidden;
  border-radius:var(--r-xl);background:var(--surface-2);color:inherit;text-decoration:none;
  transition:transform .2s var(--ease-out),box-shadow .2s var(--ease-out)}
.spy-pcard[data-canal=instagram]{background:var(--t3)}
.spy-pcard[data-canal=youtube]{background:var(--t4)}
.spy-pcard[data-canal=anuncios]{background:var(--t2)}
.spy-pcard:hover{transform:translateY(-2px);box-shadow:var(--sombra-pop)}
.spy-pcard__media{position:relative;display:block;aspect-ratio:4/5;overflow:hidden}
/* La foto va ENCIMA del texto, no en vez del texto: si no carga, se borra y abajo queda el texto. */
.spy-pcard__foto{position:absolute;inset:0;z-index:1;display:block;width:100%;height:100%;object-fit:cover}
.spy-pcard__texto-creativo{position:absolute;inset:0;display:block;padding:18px 18px 22px;color:var(--t-ink);
  font-size:var(--fs-sm);line-height:1.45;overflow:hidden}
.spy-pcard__puntos{position:absolute;z-index:2;top:16px;left:14px;display:flex}
.spy-pcard__puntos i{width:18px;height:18px;border-radius:50%;
  box-shadow:0 0 0 2px var(--surface),inset 0 0 0 1px #0000001f}
.spy-pcard__tag{position:absolute;z-index:1;bottom:12px;left:14px;display:inline-flex;align-items:center;gap:5px;
  height:26px;padding:0 10px;border-radius:99px;background:var(--surface);color:var(--ink);
  font-size:var(--fs-meta);font-weight:700;box-shadow:var(--sombra-tarjeta)}
.spy-pcard__tag--viva{padding-left:8px;background:rgba(22,26,25,.82);color:#fff}
/* Dos píldoras apiladas, como .pcard__tag + .pcard__fit de la referencia: la segunda sube. */
.spy-pcard__tag + .spy-pcard__tag{bottom:44px;max-width:calc(100% - 28px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;line-height:26px}
.spy-pcard__pie{display:flex;align-items:flex-end;gap:10px;padding:12px 14px 14px 16px}
.spy-pcard__texto{flex:1;min-width:0}
.spy-pcard__texto small{display:block;color:var(--t-dim);font-size:var(--fs-meta);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spy-pcard__texto b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:var(--fs-card);font-weight:600;line-height:1.3;letter-spacing:-.005em}
.spy-pcard__num{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;height:34px;padding:0 13px;
  border-radius:99px;background:var(--ink);color:var(--on-ink);box-shadow:0 8px 18px -10px #11111173}
.spy-pcard__num svg{opacity:.75;flex:0 0 auto}
.spy-pcard__num b{font-size:var(--fs-md);font-weight:700;line-height:1;letter-spacing:-.01em}
.spy-pcard__num--ausente{height:30px;padding:0 11px;background:var(--surface-2);color:var(--faint);
  box-shadow:inset 0 0 0 1px var(--border)}
.spy-pcard__num--ausente b{font-size:var(--fs-sm);font-weight:600}

/* --- La lista: una tarjeta por competidor, con su cara. Misma anatomia que la pieza. --- */
.spy-crejilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:var(--gap)}
/* ⚠️ LA CARA MANDA EN LA TARJETA, no es un avatarcito arriba. Martín, 2/11/2026: «que no esté
   chiquito arriba, que tenga protagonismo en la tarjeta la imagen». Misma anatomía que la tarjeta
   de pieza y que la de los referentes: la imagen a sangre arriba y el texto abajo. */
.spy-ccard{position:relative;display:flex;flex-direction:column;min-width:0;overflow:hidden;
  border-radius:var(--r-lg);background:var(--surface);color:inherit;text-align:left;text-decoration:none;
  border:0;cursor:pointer;box-shadow:inset 0 0 0 1px var(--border),var(--sombra-tarjeta);
  transition:transform .18s var(--ease-out),box-shadow .18s var(--ease-out)}
.spy-ccard:hover{transform:translateY(-2px);box-shadow:var(--sombra-pop)}
.spy-ccard__cara{position:relative;display:grid;place-items:center;aspect-ratio:1/1;width:100%;
  overflow:hidden;background:var(--t1);color:var(--t-ink);font-size:56px;font-weight:700}
/* ⚠️ LA IMAGEN OCUPA LA TARJETA ENTERA, sea foto o caricatura. Martín, 2/11/2026: «las fotos están
   en un cuadrado cuando deberían ocupar todo el ancho de la tarjeta, no estar chiquititas». La
   primera versión le ponía a la caricatura un 10 % de aire y «contain» para que se leyera como
   dibujo: se veía chica y con un marco que nadie pidió. Caricatura y foto se dibujan IGUAL. */
.spy-ccard__cara img{display:block;width:100%;height:100%;object-fit:cover;
  animation:spy-flota 7s ease-in-out infinite;animation-delay:var(--flote,0s);will-change:transform}
/* ⚠️ LA TARJETA SE MUEVE SOLA. Martín, 2/11/2026: «que las tarjetas tengan algún tipo de animación,
   que la figura se mueva o que parpadee, o que digamos flote». Flota: es lo único que se puede
   mirar diez minutos sin molestar — un parpadeo en una rejilla de veinticinco tarjetas es un
   semáforo roto.
   El recorrido es de 6 px sobre una imagen de 248 px (~2,4 %) y el «scale» tapa el borde que
   dejaría el desplazamiento, para que no asome el fondo de la tarjeta arriba o abajo.
   ⚠️ CADA TARJETA ARRANCA EN OTRO MOMENTO («--flote», puesto por índice): sin eso las veinticinco
   suben y bajan a la vez y parece que se mueve la pantalla, no las caras. */
@keyframes spy-flota{
  0%,100%{transform:scale(1.035) translateY(3px)}
  50%    {transform:scale(1.035) translateY(-3px)}
}
.spy-ccard:hover .spy-ccard__cara img{animation-play-state:paused;transform:scale(1.06)}
/* El que no quiere movimiento no lo tiene: no es un adorno opcional, es una preferencia del sistema. */
@media (prefers-reduced-motion:reduce){
  .spy-ccard__cara img{animation:none}
  .spy-ccard:hover .spy-ccard__cara img{transform:none}
  .spy-ccard{transition:none}
  .spy-ccard:hover{transform:none}
}
.spy-ccard__cuerpo{display:flex;flex-direction:column;gap:10px;padding:14px 16px 16px}
.spy-ccard__nombre{display:block;font-size:var(--fs-card);font-weight:600;letter-spacing:-.005em;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spy-ccard__sub{display:block;margin-top:2px;color:var(--faint);font-size:var(--fs-sm)}
.spy-ccard__pie{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
/* El borrar vive EN la tarjeta: para sacar un duplicado ya no hay que entrar al competidor. */
.spy-ccard__borrar{position:absolute;top:12px;right:12px;display:grid;place-items:center;
  width:32px;height:32px;border:0;border-radius:10px;background:var(--surface);color:var(--faint);
  box-shadow:var(--sombra-tarjeta);cursor:pointer;opacity:0;transition:opacity .15s var(--ease-out)}
.spy-ccard:hover .spy-ccard__borrar,.spy-ccard__borrar:focus-visible{opacity:1}
.spy-ccard__borrar:hover{color:var(--bad);background:var(--bad-bg)}
/* En pantalla tactil no hay hover: ahi el borrar se ve siempre o no existe. */
@media (hover:none){.spy-ccard__borrar{opacity:1}}

/* ── La lista de competidores: la tabla de merrin dentro de una caja plana. ── */
.spy-envoltura-tabla{overflow-x:auto}
.spy-tabla{width:100%;border-collapse:collapse;font-size:var(--fs-md)}
.spy-tabla th{padding:10px 14px;text-align:left;color:var(--faint);font-size:var(--fs-meta);font-weight:600;
  letter-spacing:.04em;text-transform:uppercase;border-bottom:1px solid var(--border);white-space:nowrap}
.spy-tabla td{padding:13px 14px;border-bottom:1px solid var(--border);vertical-align:middle}
.spy-tabla tbody tr{cursor:pointer}
.spy-tabla tbody tr:hover td{background:var(--surface-2)}
.spy-tabla tbody tr:last-child td{border-bottom:0}
.spy-tabla th:first-child,.spy-tabla td:first-child{padding-left:20px}
.spy-tabla th:last-child,.spy-tabla td:last-child{padding-right:20px}
.spy-tabla-nombre{display:inline-flex;align-items:center;gap:10px;font-weight:600}
.spy-tabla-canales{display:inline-flex;align-items:center;gap:8px;color:var(--faint)}
.spy-avatar{display:grid;place-items:center;flex:0 0 auto;width:30px;height:30px;border-radius:9px;
  background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--border);font-size:var(--fs-sm);font-weight:700}

/* ── Botones, píldoras y avisos, con los valores de la referencia. ── */
.spy-boton{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 16px;
  border:0;border-radius:12px;background:var(--surface);color:var(--ink);box-shadow:inset 0 0 0 1px var(--border-strong);
  font-size:var(--fs-md);font-weight:600;white-space:nowrap;cursor:pointer;text-decoration:none}
.spy-boton:hover:not(:disabled){background:var(--surface-2)}
.spy-boton:disabled{opacity:.45;cursor:not-allowed}
.spy-boton-primario{background:var(--accent);color:var(--on-primary);box-shadow:0 6px 16px -8px var(--accent)}
.spy-boton-primario:hover:not(:disabled){background:var(--mako-ink);filter:brightness(1.1)}
.spy-x{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:9px;background:none;
  color:var(--faint);cursor:pointer}
.spy-x:hover{background:var(--velo-hover);color:var(--ink)}
.spy-pildora{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:99px;
  background:var(--primary-bg);color:var(--dim);font-size:var(--fs-meta);font-weight:600;white-space:nowrap}
.spy-pildora-gris{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px;border-radius:99px;
  background:var(--surface);box-shadow:inset 0 0 0 1px var(--border);color:var(--dim);
  font-size:var(--fs-sm);font-weight:600;white-space:nowrap}
.spy-punto{width:6px;height:6px;border-radius:50%;background:currentColor;flex:0 0 auto}
.spy-punto-vivo{background:var(--good)}
.spy-rango{color:var(--faint);font-size:var(--fs-sm)}
.spy-aviso{margin:0 0 14px;padding:11px 14px;border-radius:var(--r-md);background:var(--surface-2);
  color:var(--dim);font-size:var(--fs-sm);line-height:1.5}
.spy-error{background:var(--bad-bg);color:var(--bad)}
.spy-franja{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:10px 12px 10px 16px;
  border-radius:var(--r-md);background:var(--surface-2);font-size:var(--fs-sm)}
.spy-franja strong{font-weight:700}
.spy-franja span{flex:1;min-width:0;color:var(--faint)}
.spy-etiquetas{display:flex;flex-wrap:wrap;gap:6px}

/* ── Vacíos y esqueleto. ── */
.spy-vacio{display:flex;flex-direction:column;align-items:center;gap:10px;padding:56px 24px;text-align:center;
  border-radius:var(--r-lg);background:var(--surface);box-shadow:inset 0 0 0 1px var(--border),var(--sombra-tarjeta)}
.spy-vacio-icono{display:grid;place-items:center;width:56px;height:56px;margin-bottom:4px;border-radius:var(--r-md);
  background:var(--t1);color:var(--t-ink)}
.spy-vacio h2{margin:0;font-size:var(--fs-sect);font-weight:600;letter-spacing:-.01em}
.spy-vacio p{margin:0;max-width:52ch;color:var(--faint);font-size:var(--fs-md);line-height:1.55}
.spy-vacio-botones{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:8px}
.spy-esqueleto{aspect-ratio:4/5;border-radius:var(--r-xl);background:var(--surface-2);
  animation:spy-latido 1.4s var(--ease-out) infinite}
@keyframes spy-latido{0%,100%{opacity:1}50%{opacity:.55}}

/* ── Ficha de oferta y de sitio. ── */
.spy-oferta{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:var(--gap)}
.spy-dato{padding:16px 18px;border-radius:var(--r-lg);background:var(--surface);
  box-shadow:inset 0 0 0 1px var(--border),var(--sombra-tarjeta);font-size:var(--fs-md);line-height:1.5}
.spy-dato b{display:block;margin-bottom:6px;color:var(--faint);font-size:var(--fs-sm);font-weight:600}
.spy-sitio{display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:20px;
  border-radius:var(--r-lg);background:var(--surface);box-shadow:inset 0 0 0 1px var(--border),var(--sombra-tarjeta)}
.spy-nombre{font-size:var(--fs-card);font-weight:600}

/* ── Modales. ── */
.spy-modal{display:flex;flex-direction:column;gap:14px}
.spy-modal-cabecera{display:flex;align-items:center;gap:10px}
.spy-modal-cabecera h2{flex:1;margin:0;font-size:var(--fs-card);font-weight:600}
.spy-modal-pestanas{display:flex;gap:4px;border-bottom:1px solid var(--border)}
.spy-modal-pie{display:flex;justify-content:flex-end;gap:8px}
.spy-entrada{width:100%;height:42px;padding:0 13px;border:0;border-radius:12px;background:var(--surface);
  box-shadow:inset 0 0 0 1px var(--border-strong);font:inherit;font-size:var(--fs-md);font-weight:500;color:var(--ink)}
.spy-entrada:focus{outline:0;box-shadow:inset 0 0 0 1.5px var(--accent),0 0 0 4px var(--mako-bg)}

.spy-pie{margin-top:22px;display:flex;flex-direction:column;gap:4px;color:var(--faint);font-size:var(--fs-meta);line-height:1.5}
.spy-pie p{margin:0}

/* ── Celular: el riel baja, la grilla pasa a dos y la barra se aprieta. ── */
@media (max-width:1080px){
  .spy-cols{grid-template-columns:minmax(0,1fr)}
  .spy-riel{flex-direction:row;flex-wrap:wrap}
  .spy-riel > *{flex:1 1 280px}
}
@media (max-width:760px){
  .spy-barra{padding:10px 14px}
  .spy-marca span{display:none}
  .spy-cuerpo{padding:8px 14px 32px}
  .spy-pgrid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
  .spy-pcard__pie{padding:10px 11px 12px 12px}
  .spy-pcard__texto b{font-size:var(--fs-sm)}
  .spy-pcard__num{padding:4px 9px}
  .spy-pcard__num small{display:none}
  .spy-riel{flex-direction:column}
  .spy-solo-ancho{display:none}
}
`;

type Pestana = 'publica' | 'oferta' | 'sitio' | 'anuncios';

/**
 * La franja de una línea que ocupa el lugar del onboarding: lo que Foreplay pone en vez de un wizard.
 * Una por pestaña; se cierra y no vuelve.
 */
const FRANJA: Record<Pestana, { titulo: string; frase: string }> = {
  publica: { titulo: 'Lo que publica', frase: 'Los días los declara el canal; la etapa la calcula MaKo.' },
  oferta: { titulo: 'Su oferta', frase: 'La lee la IA de lo que publica. No es una afirmación suya.' },
  sitio: { titulo: 'Su web', frase: 'Qué piezas tiene su página.' },
  anuncios: { titulo: 'Anuncios', frase: 'Meta no entrega los de América Latina por su API: estos los guardaste tú.' },
};

// `localStorage` puede tirar en una ventana privada: la franja es una comodidad, no un estado.
const franjaCerrada = (t: Pestana): boolean => {
  try { return window.localStorage.getItem(`spy.franja.${t}`) === '1'; } catch { return false; }
};
const cerrarFranja = (t: Pestana): void => {
  try { window.localStorage.setItem(`spy.franja.${t}`, '1'); } catch { /* sin almacenamiento, vuelve la próxima */ }
};

function Franja({ pestana }: { pestana: Pestana }) {
  const [cerrada, setCerrada] = useState(true);
  useEffect(() => { setCerrada(franjaCerrada(pestana)); }, [pestana]);
  if (cerrada) return null;
  const f = FRANJA[pestana];
  return (
    <div className="spy-franja">
      <strong>{f.titulo}</strong>
      <span>{f.frase}</span>
      <button type="button" className="spy-x" aria-label="Cerrar" onClick={() => { cerrarFranja(pestana); setCerrada(true); }}>
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}

const inicial = (nombre: string): string => nombre.replace(/^@/, '').charAt(0).toUpperCase() || '·';

function Vacio({ titulo, children, botones, icono }: { titulo: string; children?: React.ReactNode; botones?: React.ReactNode; icono?: React.ReactNode }) {
  return (
    <div className="spy-vacio">
      {icono && <div className="spy-vacio-icono">{icono}</div>}
      <h2>{titulo}</h2>
      {children}
      {botones && <div className="spy-vacio-botones">{botones}</div>}
    </div>
  );
}

function Esqueleto({ leyendo }: { leyendo: boolean }) {
  return (
    <>
      {leyendo && <p className="spy-aviso">Leyendo sus canales. Tarda unos segundos.</p>}
      <div className="spy-pgrid" aria-busy="true">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="spy-esqueleto" />)}
      </div>
    </>
  );
}

/** Un campo en un modal: agregar un canal o guardar un anuncio. */
function ModalCampo({ titulo, placeholder, boton, ocupado, error, onClose, onEnviar }: {
  titulo: string; placeholder: string; boton: string; ocupado: boolean; error: string | null;
  onClose: () => void; onEnviar: (valor: string) => void;
}) {
  const [valor, setValor] = useState('');
  return (
    <ModalShell w={460} label={titulo} onClose={onClose}>
      <div className="spy-modal">
        <div className="spy-modal-cabecera">
          <h2>{titulo}</h2>
          <button type="button" className="spy-x" aria-label="Cerrar" onClick={onClose}><Icon name="x" size={15} /></button>
        </div>
        <input
          autoFocus className="spy-entrada" placeholder={placeholder} value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && valor.trim() && !ocupado) onEnviar(valor.trim()); }}
        />
        {error && <p className="spy-aviso spy-error">{error}</p>}
        <div className="spy-modal-pie">
          <button type="button" className="spy-boton spy-boton-primario" disabled={!valor.trim() || ocupado} onClick={() => onEnviar(valor.trim())}>
            {ocupado ? 'Un momento…' : boton}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/** El «+»: dos pestañas que se alternan, no dos pasos. La de Foreplay. */
function ModalAlta({ ocupado, error, onClose, onPegar, onAMano }: {
  ocupado: boolean; error: string | null; onClose: () => void;
  /**
   * Lo que la vista previa YA leyó y no se puede perder al guardar:
   * `nombre` = su nombre de verdad («Alex Hormozi», no «alexhormozi»), que es lo que evita la
   * tarjeta duplicada; `deLaBio` = el link de su bio, que es su landing sin buscarla.
   */
  onPegar: (valor: string, nombre?: string, deLaBio?: string | null) => void;
  onAMano: (d: { nombre: string; instagram: string; youtube: string; sitio: string }) => void;
}) {
  const [pestana, setPestana] = useState<'pegar' | 'mano'>('pegar');
  const [pegado, setPegado] = useState('');
  const [d, setD] = useState({ nombre: '', instagram: '', youtube: '', sitio: '' });
  // ⚠️ LA VISTA PREVIA NO SE PIDE EN CADA TECLA: leer un perfil gasta del tope diario de Apify.
  //    Se pide al tocar «Buscar» o con Enter, que es cuando la persona terminó de escribir.
  const [vista, setVista] = useState<VistaPrevia | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [errorVista, setErrorVista] = useState<string | null>(null);

  const listo = pestana === 'pegar' ? !!pegado.trim() : !!(d.instagram.trim() || d.youtube.trim() || d.sitio.trim());

  /**
   * Lo ya buscado en este modal, por lo que se escribió.
   *
   * ⚠️ NO ES UNA OPTIMIZACIÓN: es lo que hace que se pueda buscar solo. Sin esto, borrar una letra
   * y volver a escribirla gasta otra lectura del tope diario de Apify.
   */
  const yaBuscado = useRef(new Map<string, VistaPrevia>());

  const buscar = useCallback(async (crudo: string) => {
    const q = crudo.trim();
    if (!q) return;
    const guardado = yaBuscado.current.get(q);
    if (guardado) { setVista(guardado); setErrorVista(null); return; }
    setBuscando(true); setErrorVista(null); setVista(null);
    const r = await vistaPreviaAction(q);
    setBuscando(false);
    if (!r.ok) { setErrorVista(r.error); return; }
    yaBuscado.current.set(q, r.vista);
    setVista(r.vista);
  }, []);

  /**
   * Busca SOLO cuando dejás de escribir.
   *
   * ⚠️ POR QUÉ NO EN CADA TECLA, que es lo que se pidió literalmente (Martín, 2/11/2026: «cuando
   * vaya escribiendo el arroba... ya me vayan apareciendo opciones»): cada lectura de un perfil
   * gasta del tope DIARIO de Apify (`APIFY_TOPE_POR_DIA`). Escribir «leilahormozi» son trece
   * teclas; con una llamada por tecla, dos o tres altas agotan el día y después NADIE del negocio
   * puede agregar a nadie. Con la espera, escribir un @ entero cuesta UNA lectura y se siente
   * igual: soltás el teclado y aparece quién es.
   *
   * Y no se dispara con cualquier cosa: sólo cuando lo escrito ya parece un @ o un enlace.
   */
  useEffect(() => {
    const q = pegado.trim();
    if (pestana !== 'pegar' || q.length < 3 || vista || buscando) return;
    const esBuscable = /^@?[A-Za-z0-9._]{3,30}$/.test(q) || /^https?:\/\//i.test(q) || /\./.test(q);
    if (!esBuscable) return;
    const t = setTimeout(() => { void buscar(q); }, 900);
    return () => clearTimeout(t);
  }, [pegado, pestana, vista, buscando, buscar]);

  /**
   * El botón de abajo hace una cosa distinta según dónde estás, y en ese orden: cargar a mano
   * guarda, un dato ya confirmado guarda, y un dato sin confirmar BUSCA primero.
   *
   * ⚠️ Nunca se guarda sin haber mostrado quién es. Martín, 2/11/2026: «súper importante que lo
   * valides, que le preguntes al usuario, ¿este es el YouTube de esta persona?, para que no se
   * traiga algo incorrecto».
   */
  const enviar = () => {
    if (pestana === 'mano') { onAMano(d); return; }
    // El nombre y el link de su bio viajan con la confirmación: los pagó esta vista previa, y si no
    // van acá se pierden (ítems 10 y «no pueden haber dos Alex Hormozi»). Sólo existen cuando la
    // vista previa pudo leer el perfil; con un aviso de «no pude leerlo» van vacíos y se agrega igual.
    if (vista) { onPegar(pegado.trim(), vista.nombre?.trim() || undefined, vista.web ?? null); return; }
    void buscar(pegado);
  };

  // Escribir después de haber buscado invalida lo buscado: nunca se confirma a una persona
  // mientras la pantalla todavía muestra a otra.
  const escribir = (v: string) => { setPegado(v); if (vista) setVista(null); if (errorVista) setErrorVista(null); };

  const QUE_ES: Record<string, string> = {
    instagram: 'Instagram', youtube_id: 'canal de YouTube', landing_url: 'sitio', nombre: 'nombre',
  };
  return (
    <ModalShell w={480} label="Mirar a alguien más" onClose={onClose}>
      <div className="spy-modal">
        <div className="spy-modal-cabecera">
          <h2>Mirar a alguien más</h2>
          <button type="button" className="spy-x" aria-label="Cerrar" onClick={onClose}><Icon name="x" size={15} /></button>
        </div>
        <div className="spy-modal-pestanas">
          <button type="button" className="spy-pestana" data-activa={pestana === 'pegar'} onClick={() => setPestana('pegar')}>Pegar un dato</button>
          <button type="button" className="spy-pestana" data-activa={pestana === 'mano'} onClick={() => setPestana('mano')}>Cargar a mano</button>
        </div>
        {pestana === 'pegar'
          ? (
            <>
              {/* ── EL DESPLEGABLE MIENTRAS SE ESCRIBE, Y SIN NECESIDAD DE PONER UN @ ──────────
                   Martín, 2/11/2026: «cuando yo vaya buscando una arroba… ya vaya saliendo ciertos
                   resultados mientras voy escribiendo» y «no necesariamente yo tenga que poner una
                   arroba para que me empiecen a salir resultados».

                   ⚠️ NO SE CONSTRUYÓ UN BUSCADOR NUEVO: éste es el MISMO del alta de un lead
                   (app/crm/new/InstagramBuscador.tsx, 12/10/2026), que ya busca por NOMBRE, muestra
                   fotos, abre la lista en un portal y tiene resueltos Escape y Enter. Hacer otro
                   habría sido mantener dos.
                   ⚠️ Y NO LLAMA EN CADA TECLA: espera 500 ms y pide 3 letras, porque cada búsqueda
                   gasta del tope diario. «Mientras escribo» es SIN APRETAR UN BOTÓN, no una llamada
                   por tecla: «leilahormozi» son trece teclas y dos altas agotarían el día.

                   El campo de texto sigue debajo para lo que NO es un perfil —un canal de YouTube o
                   un sitio—, que el buscador no sabe resolver. */}
              <InstagramBuscador
                valor={null}
                onTexto={escribir}
                textoInicial={pegado}
                onElegir={(p) => {
                  if (!p) return;
                  // Elegir de la lista confirma QUIÉN es: se pone su @ y se pide la vista previa,
                  // que es la que trae su nombre real y el link de su bio.
                  setPegado(`@${p.usuario}`);
                  setVista(null);
                  void buscar(p.usuario);
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="spy-entrada" placeholder="…o pega un canal de YouTube o un sitio" value={pegado}
                  onChange={(e) => escribir(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && listo && !ocupado) enviar(); }}
                />
                <button type="button" className="spy-boton" style={{ flex: '0 0 auto' }} disabled={!pegado.trim() || buscando} onClick={() => void buscar(pegado)}>
                  {buscando ? 'Buscando…' : 'Buscar'}
                </button>
              </div>

              {/* ── QUIÉN ES, ANTES DE GUARDARLO. De la bio sale además el link a su sitio, así que
                   pegar un @ trae también su landing sin buscarla en ningún lado. ── */}
              {vista && (
                <>
                  <div className="spy-previa">
                    <span className="spy-previa__cara" aria-hidden>
                      {vista.foto
                        // eslint-disable-next-line @next/next/no-img-element -- la sirve el CDN de Meta y vence; acá sólo se mira
                        ? <img src={vista.foto} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.remove(); }} />
                        : inicial(vista.nombre || vista.valor)}
                    </span>
                    <span className="spy-previa__texto">
                      <b>{vista.nombre || vista.valor}</b>
                      <small>
                        {QUE_ES[vista.campo]}
                        {vista.campo === 'instagram' ? ` · @${vista.valor}` : ` · ${vista.valor}`}
                        {vista.seguidores != null ? ` · ${dibujarContador(vista.seguidores)} seguidores` : ''}
                      </small>
                      {vista.bio && <span className="spy-previa__bio">{vista.bio}</span>}
                      {vista.web && <small>Su web: {vista.web.replace(/^https?:\/\/(www\.)?/, '')}</small>}
                    </span>
                  </div>
                  {/* Un perfil que no se pudo leer NO frena el alta: se dice y se deja agregar igual. */}
                  {vista.aviso && <p className="spy-aviso">{vista.aviso}</p>}
                  <p className="spy-rango">¿Es esta la persona que querías mirar?</p>
                </>
              )}
              {errorVista && <p className="spy-aviso spy-error">{errorVista}</p>}
            </>
          )
          : (
            <>
              <input className="spy-entrada" placeholder="Nombre" value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} />
              <input className="spy-entrada" placeholder="@ de Instagram" value={d.instagram} onChange={(e) => setD({ ...d, instagram: e.target.value })} />
              <input className="spy-entrada" placeholder="Enlace de su canal de YouTube" value={d.youtube} onChange={(e) => setD({ ...d, youtube: e.target.value })} />
              <input className="spy-entrada" placeholder="Su web" value={d.sitio} onChange={(e) => setD({ ...d, sitio: e.target.value })} />
            </>
          )}
        {error && <p className="spy-aviso spy-error">{error}</p>}
        <div className="spy-modal-pie">
          {pestana === 'pegar' && vista && (
            <button type="button" className="spy-boton" disabled={ocupado} onClick={() => { setVista(null); setPegado(''); }}>No es él</button>
          )}
          <button type="button" className="spy-boton spy-boton-primario" disabled={!listo || ocupado || buscando} onClick={enviar}>
            {ocupado ? 'Un momento…' : pestana === 'mano' ? 'Mirar' : vista ? 'Sí, míralo' : 'Buscar'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function RejillaCompetidores({ competidores, resumen, onAbrir, onBorrar, puedeBorrar }: {
  competidores: Competidor[]; resumen: Record<number, ResumenPiezas>;
  onAbrir: (id: number) => void; onBorrar: (c: Competidor) => void; puedeBorrar: boolean;
}) {
  const desdes = Object.values(resumen).map((r) => r.desde).filter((d): d is string => !!d).sort();
  return (
    <>
      <header className="spy-phead">
        <div className="spy-phead__texto">
          <h1>Competidores</h1>
          <p>
            {competidores.length} {competidores.length === 1 ? 'competidor' : 'competidores'}
            {desdes[0] ? ` · el más viejo desde el ${fechaCorta(desdes[0])}` : ''}
          </p>
        </div>
      </header>

      {/* ── Tarjetas, no filas. Martín, 2/11: «quiero que cada competidor tenga su caricatura,
           como acostumbramos, como tarjetas».
           La cara, por orden: (1) su foto de perfil ya bajada a nuestro bucket (0361 y 0362), que es
           la cara de verdad; (2) si no hay foto, LA CARICATURA QUE YA TENEMOS DIBUJADA de ese
           referente (`caricaturaDeCompetidor`) — 22 están hechas y aprobadas para el Ops Center, y
           Martín pidió reusarlas acá: «ya directamente salen con la caricatura correspondiente»;
           (3) si no es ninguno de los dos, su inicial.
           ⚠️ LAS DOS SE DIBUJAN IGUAL, a sangre y ocupando la tarjeta entera, y SIN ningún cartel
           encima. Probé con un «Inspirado en» y con aire alrededor del dibujo; Martín sacó las dos
           cosas: «que se elimine lo de inspirado en, eso no tiene sentido» y «deberían ocupar todo
           el ancho, no estar chiquititas en un cuadrado». ── */}
      <div className="spy-crejilla">
        {competidores.map((c, i) => {
          const r = resumen[c.id];
          const dibujo = caricaturaDeCompetidor(c);
          // Los competidores que YA estaban se guardaron con lo que se pegó —un @, el id de un
          // canal—, y esas filas no se arreglan solas: se eligió mostrar su nombre de verdad en vez
          // de reescribirle un dato al negocio.
          const titulo = nombreDeTarjeta(c);
          // Cada cara arranca su flote en otro momento. Es por ÍNDICE y no al azar: `Math.random()`
          // en el render daría un número distinto en el servidor y en el navegador, y React avisaría
          // de hidratación desajustada. Un paso de 0,55 s reparte siete segundos entre las primeras
          // trece tarjetas sin que dos vecinas coincidan.
          const flote = `${((i * 0.55) % 7).toFixed(2)}s`;
          const canales = [c.instagram ? 'Instagram' : null, c.youtube_id ? 'YouTube' : null, c.landing_url ? 'Su web' : null].filter(Boolean).join(' · ');
          return (
            <div key={c.id} className="spy-ccard" role="button" tabIndex={0}
              onClick={() => onAbrir(c.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(c.id); } }}>
              <span className="spy-ccard__cara" style={{ '--flote': flote } as CSSProperties} aria-hidden>
                {c.avatar || dibujo
                  // eslint-disable-next-line @next/next/no-img-element -- está en nuestro bucket o en /public, no pasa por el optimizador
                  ? <img src={(c.avatar || dibujo) as string} alt="" loading="lazy" onError={(e) => { e.currentTarget.remove(); }} />
                  : inicial(c.nombre)}
              </span>
              <div className="spy-ccard__cuerpo">
                <span>
                  <b className="spy-ccard__nombre" title={titulo}>{titulo}</b>
                  <small className="spy-ccard__sub">{canales || 'Sin canales todavía'}</small>
                </span>
                <div className="spy-ccard__pie">
                  {r && r.vivas + r.idas > 0 && (
                    <span className="spy-pildora"><i className="spy-punto spy-punto-vivo" />{r.vivas} a la vista{r.idas ? ` · ${r.idas} ya no` : ''}</span>
                  )}
                  {c.mirado_en && <span className="spy-rango">Revisado {haceCuanto(c.mirado_en)}</span>}
                </div>
              </div>
              {/* ⚠️ El botón va DENTRO de la tarjeta y frena el clic: si no, borrar abriría la ficha.
                  Y no se dibuja para quien no puede borrar: un botón que siempre falla es peor que no estar. */}
              {puedeBorrar && <button type="button" className="spy-ccard__borrar" aria-label={`Dejar de mirar a ${c.nombre}`}
                title={`Dejar de mirar a ${c.nombre}`}
                onClick={(e) => { e.stopPropagation(); onBorrar(c); }}>
                <Icon name="trash" size={15} />
              </button>}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** La serie categórica: el mismo color para el mismo concepto en la barra y en la fila. */
const SERIE = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];

/** Una caja del riel: cabecera, barra apilada y filas. Es el bloque «Where it sells» de merrin. */
function CajaMix({ titulo, pie, filas, total }: {
  // `pie` admite null porque `fraseDeLectura` devuelve null cuando al competidor no se le leyo nada.
  titulo: string; pie?: string | null; total: number;
  filas: Array<{ rotulo: string; n: number; pct: number }>;
}) {
  if (!filas.length) return null;
  return (
    <section className="spy-caja">
      <div className="spy-caja-cabecera"><div><h2>{titulo}</h2>{pie && <p>{pie}</p>}</div></div>
      <div className="spy-mix-barra" aria-hidden>
        {filas.map((f, i) => <span key={f.rotulo} className="spy-mix-seg" style={{ flex: Math.max(f.n, 1), background: SERIE[i % 4] }} />)}
      </div>
      <ul className="spy-mix-filas">
        {filas.map((f, i) => (
          <li key={f.rotulo}>
            <span className="spy-mix-ico" aria-hidden><i style={{ width: 10, height: 10, borderRadius: '50%', background: SERIE[i % 4] }} /></span>
            <span className="spy-mix-nombre"><b title={f.rotulo}>{f.rotulo}</b><small>{f.pct}% de {total}</small></span>
            <span className="spy-mix-val"><b>{f.n}</b></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * El riel de análisis: hasta tres cajas de 336 px al costado de la rejilla.
 *
 * ⚠️ ANTES ERA UNA BANDA PLEGADA ARRIBA DE LAS PIEZAS, y por eso arrancaba cerrada: tres columnas
 * de listas empujaban la primera pieza fuera de la pantalla. En la referencia (merrin) el análisis
 * nunca compite con el catálogo: vive en una columna propia a la derecha y por eso puede estar
 * siempre abierto. Esto es lo mismo.
 *
 * La sección sin nada que decir NO EXISTE: no se anuncia su ausencia (Semrush).
 */
function RielAnalisis({ piezas, c, analizando, onAnalizar }: { piezas: PiezaVista[]; c: Competidor; analizando: boolean; onAnalizar: () => void }) {
  const mezcla = useMemo(() => mezclaDeTipos(piezas), [piezas]);
  const destinos = useMemo(() => destinosDe(piezas), [piezas]);
  const ganchos = useMemo(() => ganchosDe(piezas), [piezas]);
  const frase = fraseDeLectura(piezas, c.mirado_en);
  return (
    <>
      <CajaMix titulo="Qué publica" pie={frase} filas={mezcla} total={piezas.length} />
      <CajaMix titulo="A dónde manda" filas={destinos.slice(0, 6)} total={piezas.length} />
      <section className="spy-caja">
        <div className="spy-caja-cabecera"><div><h2>Con qué abre</h2></div></div>
        {ganchos.length
          ? (
            <ul className="spy-mix-filas">
              {ganchos.slice(0, 8).map((g) => (
                <li key={g.gancho}>
                  <span className="spy-mix-nombre"><b title={g.gancho}>{g.gancho}</b></span>
                  {g.dias != null && (
                    <span className="spy-pildora"><i className={g.sigue ? 'spy-punto spy-punto-vivo' : 'spy-punto'} />{g.dias} d</span>
                  )}
                </li>
              ))}
            </ul>
          )
          : (
            // El control apagado de Meta: se ve, dice por qué y trae su salida.
            <button type="button" className="spy-boton" disabled={analizando} onClick={onAnalizar}>
              {analizando ? 'Leyendo con IA…' : 'Leer con IA'}
            </button>
          )}
      </section>
    </>
  );
}

export function SpyApp({ iniciales, resumenInicial, abierto, errorInicial, puedeBorrar = false }: {
  iniciales: Competidor[];
  resumenInicial: Record<number, ResumenPiezas>;
  /** El `?competidor=` de la URL. La ficha es una URL: se comparte, se marca y se vuelve. */
  abierto: number | null;
  errorInicial: string | null;
  /** Sólo el admin del negocio borra: se lleva lo leído por todo el equipo y no se deshace. */
  puedeBorrar?: boolean;
}) {
  const [competidores, setCompetidores] = useState<Competidor[]>(iniciales);
  const [resumen, setResumen] = useState(resumenInicial);
  const [elegido, setElegido] = useState<number | null>(abierto ?? (iniciales.length === 1 ? iniciales[0].id : null));
  const [piezas, setPiezas] = useState<PiezaVista[]>([]);
  const [trayendo, setTrayendo] = useState(false);
  const [leyendo, setLeyendo] = useState<number | null>(null);
  const [ordenando, setOrdenando] = useState<{ id: number; piezas: PiezaVista[] | null } | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [lecturas, setLecturas] = useState<Record<number, LecturaCanalSpy[]>>({});
  const [error, setError] = useState<string | null>(errorInicial);
  const [pestana, setPestana] = useState<Pestana>('publica');

  const [pegado, setPegado] = useState('');
  const [buscar, setBuscar] = useState('');
  const [filtros, setFiltros] = useState<FiltroSpy[]>([]);
  const [orden, setOrden] = useState<OrdenSpy>('mas-tiempo');
  const [modal, setModal] = useState<'alta' | 'canal' | 'anuncio' | 'quitar' | null>(null);
  /** A quién se está por dejar de mirar DESDE LA LISTA. En la ficha eso lo maneja `modal`. */
  const [aBorrar, setABorrar] = useState<Competidor | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const campo = useRef<HTMLInputElement>(null);
  // Qué ficha está abierta AHORA: una lectura que tarda no puede pisar la de otro competidor.
  const actual = useRef(elegido);
  actual.current = elegido;
  const yaLeidos = useRef(new Set<number>());

  const c = competidores.find((x) => x.id === elegido) ?? null;

  const recargarLista = useCallback(async () => {
    const r = await competidoresAction();
    if (r.ok) { setCompetidores(r.competidores); setResumen(r.resumen); }
    return r.ok ? r.competidores : null;
  }, []);

  const traerPiezas = useCallback(async (id: number) => {
    const p = await piezasAction(id);
    if (actual.current !== id) return null;
    if (p.ok) setPiezas(p.piezas);
    else setError(p.error);
    return p.ok ? p.piezas : null;
  }, []);

  // `animada`: la lectura se ve como sus piezas juntándose y repartiéndose en carpetas (./OrdenSpy.tsx). Una relectura sola de una ficha
  // que ya tiene piezas va callada: no le corre la pantalla a quien entró a mirar.
  // `motivo` llega sólo desde el alta: ahí sirve la lectura que ya pagó otro negocio (hasta 24 h),
  // porque no hay NADA en pantalla. El botón «Revisar ahora» nunca lo pasa: pide datos de hoy.
  const leer = useCallback(async (id: number, animada = true, motivo?: 'alta') => {
    yaLeidos.current.add(id);
    setLeyendo(id);
    if (animada) setOrdenando({ id, piezas: null });
    try {
      const r = await revisarAction(id, motivo);
      if (r.error) setError(r.error);
      // Siempre queda algo en `lecturas`, también si la acción falló: es lo que saca a la pantalla
      // del esqueleto, y una lista vacía se dibuja como «no pude», nunca como «no hay».
      setLecturas((prev) => ({ ...prev, [id]: r.canales }));
      await recargarLista();
      const p = await traerPiezas(id);
      // Sin piezas no hay nada que ordenar: se ve el estado de siempre («no encontré», «no pude»).
      if (animada) setOrdenando((v) => (v?.id !== id || actual.current !== id ? null : p?.length ? { id, piezas: p } : null));
    } catch (e) {
      setOrdenando(null);
      throw e;
    } finally {
      setLeyendo((v) => (v === id ? null : v));
    }
  }, [recargarLista, traerPiezas]);

  // Abrir una ficha: trae lo guardado y, si hace falta, lee. Sin botón que haya que encontrar.
  useEffect(() => {
    if (elegido == null) return;
    let vivo = true;
    setPiezas([]); setError(null); setBuscar(''); setFiltros([]); setPestana('publica'); setTrayendo(true); setOrdenando(null);
    void traerPiezas(elegido).then((p) => {
      if (!vivo) return;
      setTrayendo(false);
      const quien = competidores.find((x) => x.id === elegido);
      if (quien && debeLeerAlAbrir(quien, p?.length ?? 0, yaLeidos.current.has(elegido))) void leer(elegido, !p?.length);
    });
    return () => { vivo = false; };
    // `competidores` afuera a propósito: cada lectura la reescribe, y esto volvería a abrir la ficha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegido, traerPiezas, leer]);

  // Volver atrás en el navegador vuelve a la ficha o a la lista.
  useEffect(() => {
    const alVolver = () => {
      const v = Number(new URLSearchParams(window.location.search).get('competidor'));
      setElegido(Number.isInteger(v) && v > 0 ? v : null);
    };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);

  const irA = useCallback((id: number | null) => {
    setElegido(id);
    const url = new URL(window.location.href);
    if (id == null) url.searchParams.delete('competidor');
    else url.searchParams.set('competidor', String(id));
    window.history.pushState(null, '', url);
  }, []);

  const abrirRecienAgregado = async (id: number) => {
    await recargarLista();
    // Se lee aunque la ficha ya estuviera abierta: puede haber sumado un canal.
    yaLeidos.current.delete(id);
    // Recién agregado: va con motivo `'alta'`, que es donde el ítem 13 ahorra de verdad — si otro
    // negocio ya leyó este canal hace poco, no se gasta un crédito en volver a leerlo.
    if (actual.current === id) void leer(id, true, 'alta');
    else irA(id);
  };

  const sumar = async (valor: string, nombre?: string, deLaBio?: string | null): Promise<number | null> => {
    setOcupado(true); setError(null); setErrorModal(null);
    try {
      const r = await sumarCompetidorAction(valor, nombre, deLaBio);
      if (!r.ok) { setError(r.error); setErrorModal(r.error); return null; }
      return r.id;
    } finally {
      setOcupado(false);
    }
  };

  const pegarArriba = async () => {
    const id = await sumar(pegado.trim());
    if (id == null) return;
    setPegado('');
    await abrirRecienAgregado(id);
  };

  const alta = async (valor: string, nombre?: string, deLaBio?: string | null) => {
    const id = await sumar(valor, nombre, deLaBio);
    if (id == null) return;
    setModal(null);
    await abrirRecienAgregado(id);
  };

  const altaAMano = async (d: { nombre: string; instagram: string; youtube: string; sitio: string }) => {
    const ig = d.instagram.trim();
    const datos = [ig && (/^https?:/i.test(ig) || ig.startsWith('@') ? ig : `@${ig}`), d.youtube.trim(), d.sitio.trim()].filter(Boolean) as string[];
    const id = await sumar(datos[0], d.nombre.trim() || undefined);
    if (id == null) return;
    for (const otro of datos.slice(1)) {
      const r = await sumarCanalAction(id, otro);
      if (!r.ok) { setErrorModal(r.error); return; }
    }
    setModal(null);
    await abrirRecienAgregado(id);
  };

  const sumarCanal = async (valor: string) => {
    if (elegido == null) return;
    setOcupado(true); setErrorModal(null);
    try {
      const r = await sumarCanalAction(elegido, valor);
      if (!r.ok) { setErrorModal(r.error); return; }
      setModal(null);
      await abrirRecienAgregado(elegido);
    } finally {
      setOcupado(false);
    }
  };

  const guardarAnuncio = async (valor: string) => {
    if (elegido == null) return;
    setOcupado(true); setErrorModal(null);
    try {
      const r = await guardarAnuncioAction(elegido, valor);
      if (!r.ok) { setErrorModal(r.error); return; }
      setModal(null);
      await traerPiezas(elegido);
      await recargarLista();
      setPestana('anuncios');
    } finally {
      setOcupado(false);
    }
  };

  const analizar = async () => {
    if (elegido == null) return;
    setError(null); setAnalizando(true);
    try {
      const r = await analizarAction(elegido);
      if (!r.ok) { setError(r.error); return; }
      await recargarLista();
      await traerPiezas(elegido);
      setPestana('oferta');
    } finally {
      setAnalizando(false);
    }
  };

  const quitar = async () => {
    if (elegido == null) return;
    const r = await quitarCompetidorAction(elegido);
    setModal(null);
    if (!r.ok) { setError(r.error); return; }
    irA(null);
    await recargarLista();
  };

  /**
   * Dejar de mirar a alguien DESDE LA LISTA, sin entrar a su ficha.
   *
   * ⚠️ Antes esto sólo existía adentro de la ficha, en el menú de los tres puntos: para sacar un
   * duplicado había que abrirlo primero. Martín, 2/11: «no veo la opción de eliminar, porque ya
   * tengo varias "sofia contreras"». No se vuelve a ninguna ficha: ya estamos en la lista.
   */
  const quitarDeLaLista = async (id: number) => {
    const r = await quitarCompetidorAction(id);
    setABorrar(null);
    if (!r.ok) { setError(r.error); return; }
    await recargarLista();
  };

  const flujo = useMemo(() => piezas.filter((p) => p.canal === 'instagram' || p.canal === 'youtube'), [piezas]);
  const anuncios = useMemo(() => piezas.filter((p) => p.canal === 'anuncios'), [piezas]);
  const sitio = useMemo(() => piezas.find((p) => p.canal === 'landing') ?? null, [piezas]);
  const visibles = useMemo(() => ordenarPiezas(filtrarPiezas(flujo, buscar, filtros), orden), [flujo, buscar, filtros, orden]);

  // ⚠️ UNA PESTAÑA SIN NADA QUE DECIR NO EXISTE: no aparece vacía, no aparece.
  const pestanas: Array<{ key: Pestana; rotulo: string; n?: number }> = c ? [
    ...(c.instagram || c.youtube_id || flujo.length || !c.landing_url ? [{ key: 'publica' as const, rotulo: 'Lo que publica', n: flujo.length || undefined }] : []),
    ...(c.oferta?.promete ? [{ key: 'oferta' as const, rotulo: 'Su oferta' }] : []),
    ...(c.landing_url ? [{ key: 'sitio' as const, rotulo: 'Su web' }] : []),
    ...(anuncios.length ? [{ key: 'anuncios' as const, rotulo: 'Anuncios', n: anuncios.length }] : []),
  ] : [];
  const activa: Pestana = pestanas.some((p) => p.key === pestana) ? pestana : (pestanas[0]?.key ?? 'publica');

  const lecturasDe = elegido != null ? lecturas[elegido] ?? null : null;
  const estaLeyendo = leyendo != null && leyendo === elegido;
  const estado = c
    ? estadoDeResultados({ leyendo: estaLeyendo, trayendo, visibles: visibles.length, total: flujo.length, hayCanales: canalesDe(c), lecturas: lecturasDe })
    : 'hay';

  const desde = useMemo(() => piezas.map((p) => p.visto_primera_vez).sort()[0] ?? null, [piezas]);
  const fechasYoutube = flujo.filter((p) => p.canal === 'youtube' && p.publicada_en).map((p) => p.publicada_en as string).sort();
  const hayCorte = fechasYoutube.length > 1 && cruzaElCorte(fechasYoutube[0], fechasYoutube[fechasYoutube.length - 1]);

  // La línea gris de la cabecera: SÓLO frescura. Nunca promete que lo vigilamos.
  const identidad = c
    ? [
      estaLeyendo && c.mirado_en ? 'Actualizando…' : c.mirado_en ? `Revisado ${haceCuanto(c.mirado_en)}` : null,
      desde ? `lo seguimos desde el ${fechaCorta(desde)}` : null,
    ].filter(Boolean).join(' · ')
    : '';

  // El ante-título del riel, el `small` de `.pd-title` en la referencia: de dónde lo leemos.
  const anteTitulo = c ? [
    c.instagram ? `@${String(c.instagram).replace(/^@/, '')}` : null,
    c.youtube_id ? 'YouTube' : null,
    c.landing_url ? 'Su web' : null,
  ].filter(Boolean).join(' · ') : '';

  // Las celdas pastel del riel. Un contador ausente NO es cero: sin dato no hay celda.
  const rc = c ? resumen[c.id] : undefined;
  const celdas = c ? [
    ...(rc && rc.vivas > 0 ? [{ k: 'vivas', rot: 'A la vista', val: String(rc.vivas), pie: 'siguen arriba' }] : []),
    ...(rc && rc.idas > 0 ? [{ k: 'idas', rot: 'Ya no están', val: String(rc.idas), pie: 'las bajó' }] : []),
    ...(c.instagram_seguidores != null ? [{ k: 'ig', rot: 'Seguidores', val: dibujarContador(c.instagram_seguidores), pie: 'en Instagram' }] : []),
    ...(c.youtube_suscriptores != null ? [{ k: 'yt', rot: 'Suscriptores', val: dibujarContador(c.youtube_suscriptores), pie: 'en YouTube' }] : []),
  ] : [];

  const alternar = (f: FiltroSpy) => setFiltros((v) => (v.includes(f) ? v.filter((x) => x !== f) : [...v, f]));
  const cuantas = (f: FiltroSpy) => flujo.filter((p) => cumpleFiltro(p, f)).length;

  const revisarDeNuevo = (
    <button type="button" className="spy-boton" disabled={estaLeyendo || ordenando != null || elegido == null} onClick={() => { if (elegido != null) void leer(elegido); }}>
      Revisar de nuevo
    </button>
  );

  const motivos = (
    <>
      {(lecturasDe ?? []).map((l) => <p key={l.canal}>{l.detalle}</p>)}
      {error && <p>{error}</p>}
    </>
  );

  return (
    <main className="spy" data-spy>
      <style>{CSS}</style>

      {/* ── Zona 0: la barra de pegar. ⚠️ SOLO EN LA LISTA. Antes estaba siempre, y en la ficha de
           un competidor era una banda entera para una acción que ahí no se usa: nadie pega un @
           mientras mira lo que publica otro. En la referencia (fitlo) la ficha no tiene ninguna
           banda de cabecera — tiene una miga de 18 px. ── */}
      {!c && (
      <div className="spy-barra">
        <button type="button" className="spy-marca" onClick={() => irA(null)}>
          <Icon name="spy" size={18} /><span>Competitor Spy</span>
        </button>
        <div className="spy-campo">
          <Icon name="search" size={14} />
          <input
            ref={campo}
            aria-label="Pega un @, un canal de YouTube o un sitio"
            placeholder="Pega un @, un canal de YouTube o un sitio"
            value={pegado}
            onChange={(e) => setPegado(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && pegado.trim() && !ocupado) void pegarArriba(); }}
          />
          {pegado && <button type="button" className="spy-x" aria-label="Limpiar" onClick={() => setPegado('')}><Icon name="x" size={13} /></button>}
        </div>
        <button type="button" className="spy-mas" aria-label="Mirar a alguien más" title="Mirar a alguien más" onClick={() => { setErrorModal(null); setModal('alta'); }}>
          <Icon name="plus" size={17} />
        </button>
      </div>
      )}

      <div className="spy-cuerpo">
        {!c && error && <p className="spy-aviso spy-error">{error}</p>}

        {/* ── Cero competidores: un bloque, cuatro elementos, nunca cuatro cajas. ── */}
        {!c && !competidores.length && (
          <Vacio
            icono={<Icon name="spy" size={28} />}
            titulo="Todavía no estás mirando a nadie"
            botones={<button type="button" className="spy-boton spy-boton-primario" onClick={() => campo.current?.focus()}>Pegar un dato</button>}
          >
            <p>Pega el @ de alguien de tu nicho, su canal o su sitio: lo leemos ahora.</p>
          </Vacio>
        )}

        {!c && competidores.length > 0 && <RejillaCompetidores competidores={competidores} resumen={resumen} onAbrir={irA} onBorrar={setABorrar} puedeBorrar={puedeBorrar} />}

        {c && (
          <>
            {/* ── LA CABECERA ENTERA ES UNA MIGA DE 18 px. Copiada de `.crumbs--page` de la ficha
                 de producto de fitlo, que es la pantalla análoga a ésta: un ítem de un catálogo.
                 Ahí NO hay banda de título ni fila de botones; el nombre, los datos y las acciones
                 viven en la columna de al lado (`.pd-info`), que acá es el riel.

                 Martín, 2/11: «arriba tiene una cantidad impresionante de texto, botones, y es
                 demasiado confuso». Lo que había eran CINCO bandas: barra de marca (68 px) +
                 título con tres botones (85) + pestañas (43) + herramientas (42) + conteo (18).
                 Quedan TRES, y las dos primeras son chicas: miga (18) + pestañas (42) +
                 herramientas (42). El conteo se fue porque la pestaña ya lo dice en su badge. ── */}
            <nav className="spy-migas" aria-label="Dónde estás">
              <button type="button" onClick={() => irA(null)}>Competidores</button>
              <i aria-hidden />
              {competidores.length > 1
                ? (
                  <Dropdown
                    ariaLabel="Cambiar de competidor"
                    value={String(c.id)}
                    options={competidores.map((x) => ({ value: String(x.id), label: x.nombre }))}
                    onChange={(v) => irA(Number(v))}
                    buttonStyle={{ border: 0, background: 'none', padding: 0, height: 18, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--ink)' }}
                  />
                )
                : <b>{c.nombre}</b>}
            </nav>

            {/* Lo que falló al apretar algo se dice acá. El vacío «no pude» ya lo trae entre sus motivos. */}
            {error && !(activa === 'publica' && estado === 'no-pudo') && <p className="spy-aviso spy-error">{error}</p>}

            {/* ── Pestañas de la referencia: 42 px, subrayado del acento y el conteo en una badge.
                 Vuelven a tener fila propia —la vuelta anterior las había metido entre los chips de
                 filtro para ganar un renglón, y ahí dejaban de leerse como pestañas. El renglón se
                 recupera por otro lado: el análisis ya no está arriba de las piezas. ── */}
            {pestanas.length > 1 && (
              <nav className="spy-pestanas" role="tablist">
                {pestanas.map((p) => (
                  <button key={p.key} type="button" role="tab" aria-selected={activa === p.key} className="spy-pestana" data-activa={activa === p.key} onClick={() => setPestana(p.key)}>
                    {p.rotulo}{p.n != null && <span className="spy-badge">{p.n}</span>}
                  </button>
                ))}
              </nav>
            )}

            {/* Sin nada abajo, la franja explicaría una pantalla que no está. */}
            {(activa !== 'publica' || flujo.length > 0) && <Franja pestana={activa} />}

            {ordenando?.id === c.id && activa === 'publica' && <PeliculaDeOrden nombre={c.nombre} piezas={ordenando.piezas} onTerminar={() => setOrdenando(null)} />}

            {activa === 'publica' && ordenando?.id !== c.id && (
              // ── Las dos columnas de merrin: el catálogo manda y el análisis vive a la derecha.
              //    Sin piezas no hay riel, y entonces la grilla ocupa el ancho entero.
              <div className="spy-cols">
                <div>
                  {flujo.length > 0 && (
                    <>
                      {/* La barra de herramientas de fitlo: campo ancho, chips y el orden a la derecha. */}
                      <div className="spy-herramientas">
                        <label className="spy-buscar">
                          <Icon name="search" size={16} />
                          <input aria-label="Buscar en sus piezas" placeholder="Buscar en sus piezas" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
                        </label>
                        {(['instagram', 'youtube'] as const).map((f) => {
                          const cargado = f === 'instagram' ? c.instagram : c.youtube_id;
                          // El control apagado de Meta: un canal sin cargar no se esconde ni miente; dice qué pasa y trae la salida.
                          if (!cargado) {
                            return <button key={f} type="button" className="spy-chip" onClick={() => { setErrorModal(null); setModal('canal'); }}>{NOMBRE_CANAL[f]} · Agregar</button>;
                          }
                          const n = cuantas(f);
                          const motivo = lecturasDe?.find((l) => l.canal === f)?.detalle;
                          return (
                            <button key={f} type="button" className="spy-chip" data-activo={filtros.includes(f)} disabled={!n} title={!n ? motivo : undefined} onClick={() => alternar(f)}>
                              <i style={{ background: f === 'instagram' ? 'var(--ig)' : 'var(--yt)' }} />
                              {NOMBRE_CANAL[f]}{n > 0 && <span className="spy-badge">{n}</span>}
                            </button>
                          );
                        })}
                        <button type="button" className="spy-chip" data-activo={filtros.includes('sigue')} disabled={!cuantas('sigue')} onClick={() => alternar('sigue')}>Sigue a la vista <span className="spy-badge">{cuantas('sigue')}</span></button>
                        <button type="button" className="spy-chip" data-activo={filtros.includes('probado')} disabled={!cuantas('probado')} onClick={() => alternar('probado')}>Probado <span className="spy-badge">{cuantas('probado')}</span></button>
                        <div className="spy-orden">
                          <Dropdown
                            ariaLabel="Ordenar"
                            value={orden}
                            width={240}
                            align="right"
                            buttonStyle={{ height: 38, borderRadius: 99, fontSize: 'var(--fs-sm)', fontWeight: 600 }}
                            options={[
                              { value: 'mas-tiempo', label: 'Más tiempo a la vista' },
                              { value: 'mas-nuevo', label: 'Lo más nuevo' },
                            ]}
                            onChange={(v) => setOrden(v as OrdenSpy)}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Un solo estado para toda la zona de resultados, jamás uno por canal. ── */}
                  {estado === 'hay' && (
                    <>
                      <div className="spy-pgrid">{visibles.map((p) => <TarjetaPieza key={p.id} p={p} />)}</div>
                      <footer className="spy-pie">
                        {c.mirado_en && <p>Lo que se pudo leer de sus canales públicos el {fechaCorta(c.mirado_en)}.</p>}
                        <p>{ETAPA_ES_NUESTRO_CRITERIO}</p>
                        {hayCorte && <p>{AVISO_CORTE_VIEWCOUNT}</p>}
                      </footer>
                    </>
                  )}
                  {estado === 'cargando' && <Esqueleto leyendo={estaLeyendo} />}
                  {estado === 'sin-coincidencias' && (
                    <Vacio titulo="Nada coincide" botones={<button type="button" className="spy-boton" onClick={() => { setBuscar(''); setFiltros([]); }}>Quitar filtros</button>}>
                      <p>Ninguna de sus {flujo.length} piezas pasa esta búsqueda.</p>
                    </Vacio>
                  )}
                  {estado === 'sin-canales' && (
                    <Vacio titulo={`Dime dónde mirar a ${c.nombre}`} botones={<button type="button" className="spy-boton spy-boton-primario" onClick={() => { setErrorModal(null); setModal('canal'); }}>Agregar un canal</button>}>
                      <p>Su @, su canal de YouTube o su sitio.</p>
                    </Vacio>
                  )}
                  {estado === 'leido-sin-nada' && (
                    <Vacio titulo={`No encontré publicaciones de ${c.nombre}`} botones={revisarDeNuevo}>
                      <p>Leímos sus canales {c.mirado_en ? `el ${fechaCorta(c.mirado_en)} ` : ''}y no había nada público.</p>
                    </Vacio>
                  )}
                  {estado === 'no-pudo' && (
                    <Vacio
                      titulo={`No pude leer a ${c.nombre}`}
                      botones={(
                        <>
                          {pideConectarMeta(lecturasDe) && (
                            <BotonIntegracion servicio="meta" className="spy-boton spy-boton-primario" onConectado={() => void leer(c.id)}>
                              <Icon name="plug" size={14} /> Conectar Meta
                            </BotonIntegracion>
                          )}
                          {pideConectarMeta(lecturasDe) && (
                            <BotonIntegracion servicio="apify-instagram" className="spy-boton" onConectado={() => void leer(c.id)}>
                              Conectar Apify
                            </BotonIntegracion>
                          )}
                          {revisarDeNuevo}
                        </>
                      )}
                    >
                      {motivos}
                    </Vacio>
                  )}
                </div>

                <aside className="spy-riel">
                  {/* La identidad abre el riel, como la `.pd-info` abre la columna de al lado en la
                      referencia: ante-título chico, nombre grande, la frescura, y la acción. ⚠️ EL
                      RIEL YA NO DEPENDE DE QUE HAYA PIEZAS: si dependiera, un competidor sin nada
                      leído se quedaría sin nombre y sin el botón de revisarlo. */}
                  <section className="spy-ficha">
                    <div>
                      {anteTitulo && <small>{anteTitulo}</small>}
                      <h1>{c.nombre}</h1>
                    </div>
                    {identidad && <small className="spy-rango">{identidad}</small>}
                    <div className="spy-ficha__acciones">
                      <button type="button" className="spy-boton spy-boton-primario" disabled={estaLeyendo || ordenando != null || !canalesDe(c)} onClick={() => void leer(c.id)}>
                        {estaLeyendo ? 'Revisando…' : 'Revisar ahora'}
                      </button>
                      <Dropdown
                        ariaLabel="Más acciones"
                        value=""
                        width={210}
                        align="right"
                        resetAfterSelect
                        sinFlecha
                        botonLabel={<span aria-hidden>⋯</span>}
                        options={[
                          { value: 'analizar', label: analizando ? 'Leyendo su oferta…' : 'Qué vende y qué ataca' },
                          { value: 'canal', label: 'Agregar un canal' },
                          { value: 'anuncio', label: 'Guardar un anuncio' },
                          // Mismo criterio que el botón de la lista: borrar es del admin, y lo
                          // que no se puede hacer no se ofrece.
                          ...(puedeBorrar ? [{ value: 'quitar', label: 'Dejar de mirarlo' }] : []),
                        ]}
                        onChange={(v) => {
                          // «Qué vende y qué ataca» no abre un modal: corre. Por eso sale antes del setModal.
                          if (v === 'analizar') { if (!analizando && piezas.length) void analizar(); return; }
                          setErrorModal(null);
                          setModal(v as 'canal' | 'anuncio' | 'quitar');
                        }}
                        buttonStyle={{ height: 40, width: 40, justifyContent: 'center', padding: 0, borderRadius: 12 }}
                      />
                    </div>
                  </section>

                  {/* Las celdas pastel de datos. Un dato que no tenemos no deja celda vacía. */}
                  {celdas.length > 0 && (
                    <div className="spy-kpis">
                      {celdas.map((k) => (
                        <div key={k.k} className="spy-kpi"><b>{k.rot}</b><strong>{k.val}</strong><small>{k.pie}</small></div>
                      ))}
                    </div>
                  )}

                  {flujo.length > 0 && <RielAnalisis piezas={flujo} c={c} analizando={analizando} onAnalizar={() => void analizar()} />}
                </aside>
              </div>
            )}

            {activa === 'oferta' && c.oferta && (
              <section className="spy-oferta">
                <div className="spy-dato"><b>Promete</b>{c.oferta.promete}</div>
                {c.oferta.aQuien && <div className="spy-dato"><b>A quién</b>{c.oferta.aQuien}</div>}
                {c.oferta.precio && <div className="spy-dato"><b>Precio que publica</b>{c.oferta.precio}</div>}
                {c.oferta.objecion && <div className="spy-dato"><b>Objeción que ataca</b>{c.oferta.objecion}</div>}
                {!!c.oferta.huecos.length && (
                  <div className="spy-dato">
                    <b>Lo que ataca y tu oferta no menciona</b>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>{c.oferta.huecos.map((h) => <li key={h}>{h}</li>)}</ul>
                  </div>
                )}
              </section>
            )}

            {activa === 'sitio' && c.landing_url && (
              estaLeyendo && !sitio
                ? <Esqueleto leyendo />
                : (
                  <section className="spy-sitio">
                    <a className="spy-nombre" href={c.landing_url} target="_blank" rel="noreferrer noopener" style={{ color: 'inherit', fontSize: 16 }}>{sitio?.titulo ?? c.landing_url}</a>
                    {!!sitio?.piezasDePagina?.length && (
                      <div className="spy-etiquetas">{sitio.piezasDePagina.map((n) => <span key={n} className="spy-pildora-gris">{n}</span>)}</div>
                    )}
                    {!sitio && lecturasDe?.filter((l) => l.canal === 'landing').map((l) => <p key={l.canal} className="spy-aviso">{l.detalle}</p>)}
                    {/* ⚠️ El parámetro es `?analizar=`, el que el Web Generator entiende
                        (`derechaDeQuery`, app/web-generator/panel-reglas.ts). Un `?replicar=` no
                        existe en ese contrato: la query se ignora y el botón parece andar. */}
                    <a href={`/web-generator?analizar=${encodeURIComponent(c.landing_url)}`} className="spy-boton">Analizar y replicar su sitio</a>
                  </section>
                )
            )}

            {activa === 'anuncios' && (
              <div className="spy-pgrid">{anuncios.map((p) => <TarjetaPieza key={p.id} p={p} />)}</div>
            )}
          </>
        )}
      </div>

      {modal === 'alta' && <ModalAlta ocupado={ocupado} error={errorModal} onClose={() => setModal(null)} onPegar={(v, n, bio) => void alta(v, n, bio)} onAMano={(d) => void altaAMano(d)} />}
      {modal === 'canal' && c && <ModalCampo titulo={`Agregar un canal a ${c.nombre}`} placeholder="Su @, su canal de YouTube o su sitio" boton="Agregar" ocupado={ocupado} error={errorModal} onClose={() => setModal(null)} onEnviar={(v) => void sumarCanal(v)} />}
      {modal === 'anuncio' && c && <ModalCampo titulo="Guardar un anuncio" placeholder="Enlace del anuncio en la Biblioteca de Anuncios" boton="Guardar" ocupado={ocupado} error={errorModal} onClose={() => setModal(null)} onEnviar={(v) => void guardarAnuncio(v)} />}
      {aBorrar && (
        <ConfirmModal
          msg={`¿Dejar de mirar a ${aBorrar.nombre}? Se borra lo que se leyó de él.`}
          confirmLabel="Dejar de mirarlo"
          onOk={() => void quitarDeLaLista(aBorrar.id)}
          onCancel={() => setABorrar(null)}
        />
      )}
      {modal === 'quitar' && c && <ConfirmModal msg={`¿Dejar de mirar a ${c.nombre}? Se borra lo que se leyó de él.`} confirmLabel="Dejar de mirarlo" onOk={() => void quitar()} onCancel={() => setModal(null)} />}
    </main>
  );
}
