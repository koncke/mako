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
//  · La barra fija con UN campo: Meta Ad Library y Google Ads Transparency. Busca entre los que ya
//    miras; si no hay nadie, ofrece «Buscarlo y agregarlo» (3/11/2026).
//  · Las migas con el selector y las píldoras de frescura, las pestañas, la banda de tres columnas y la
//    franja con «×»: Foreplay Spyder (de sus capturas: la app pide cuenta y no se entró).
//  · El «+»: el buscador de merrin, sin pestañas (BuscadorAlta.tsx, con su cabecera).
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
import type { NombreIconoMenu } from '../_ui/iconos-menu';
import { dibujarContador } from '@/lib/spy-reglas';
import { caricaturaDeCompetidor, nombreDeTarjeta } from '@/lib/spy-caricatura';
import { caraDeTarjeta } from '@/lib/spy-caricatura-reglas';
import { BrandDefs } from '../_components/ServicioVisual';
import { LogoRed } from './LogoRed';
import { BotonRecorrido, Recorrido, useRecorrido } from '@/app/_ui/Recorrido';
import { PASOS_SPY, RECORRIDO_SPY } from './recorrido-spy';
import type { Sugerido } from '@/lib/spy-sugeridos';
import {
  ORDENES, canalesDe, debeLeerAlAbrir, destinosDe, estadoDeResultados, fechaCorta, filtrarPiezas,
  fraseDeLectura, haceCuanto, opcionesDeContenido, ordenarPiezas, pideConectarMeta,
  type OrdenSpy, type TipoContenido, type ValorDeContenido,
} from '@/lib/spy-vista';
import { cuantasFaltan } from '@/lib/spy-analisis-reglas';
import { avisoDeTraida } from '@/lib/spy-todo-reglas';
import { debeBuscarRedes, marcarRedesBuscadas } from './redes-recordar';
import type { Competidor, LecturaCanalSpy, ResumenPiezas } from '@/lib/spy';
import {
  competidoresAction, guardarAnuncioAction, piezasAction, quitarCanalAction, quitarCompetidorAction,
  revisarAction, sumarCanalAction, sumarCompetidorAction, sumarSugeridoAction, type PiezaVista,
} from './actions';
import type { RedOtra } from '@/lib/spy-otras-redes-reglas';
import type { CandidatoVerificado } from '@/lib/spy-otras-redes';
import { enlaceSusAnuncios } from '@/lib/spy-funnel';
import { SuFunnelTipo } from './SuFunnelTipo';
import { SuOferta } from './SuOferta';
import { SusPaginas } from './SusPaginas';
import { clasificarFunnel, fuentesDeEvidencia } from '@/lib/spy-funnel-tipo';
import type { VistaOferta } from '@/lib/spy-oferta';
import { TarjetaPieza } from './TarjetaPieza';
import { GraficoSpy } from './GraficoSpy';
import { DetallePieza } from './DetallePieza';
import { grupoDe, repartoDePublicaciones } from '@/lib/spy-detalle';
import { PeliculaDeOrden } from './OrdenSpy';
import { BuscadorAlta } from './BuscadorAlta';
import { Flecha, GrillaPiezas } from './GrillaPiezas';
import { MejoresPiezas } from './MejoresPiezas';

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
.spy-campo:focus-within,.spy-campo:focus-visible{box-shadow:inset 0 0 0 1.5px var(--accent),0 0 0 4px var(--mako-bg)}
button.spy-campo{border:0;font:inherit;text-align:left;cursor:text}
button.spy-campo:hover{color:var(--dim)}
.spy-campo__texto{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:var(--fs-md);font-weight:500}
.spy-campo .spy-kbd{display:inline-grid;place-items:center;min-width:24px;height:22px;padding:0 6px;border-radius:7px;
  background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--border);font-size:11px;font-weight:700;color:var(--faint)}
@media (hover:none){.spy-campo .spy-kbd{display:none}}
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
.spy-cols{display:grid;grid-template-columns:minmax(0,1fr) 336px;gap:var(--gap);align-items:stretch}
.spy-cols__izq{display:flex;flex-direction:column;gap:var(--gap);min-width:0}
/* Las dos columnas terminan en la misma línea: si el riel es más alto, se estira la última caja del gráfico (sus formatos); si
   el gráfico es más alto, se estira «Lo que mejor le fue». Nunca queda un hueco al lado de una caja. */
.spy-cols__izq > .spyg{flex:1 1 auto}
.spy-cols__izq > .spyg > .spyg-caja:last-child{flex:1 1 auto}
.spy-riel{display:flex;flex-direction:column;gap:var(--gap);min-width:0}

/* --- Volver a todos: un botón de verdad, con la flecha y las caras de los demás (4/11/2026). --- */
.spy-volver{display:flex;align-items:center;gap:10px;min-width:0;margin:6px 0 18px;flex-wrap:wrap}
.spy-volver__grupo{display:flex;align-items:center;gap:10px;min-width:0;flex-wrap:wrap}
.spy-volver__ayuda{margin-left:auto;display:flex}
.spy-volver__atras{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 8px 0 10px;border:0;border-radius:99px;
  background:var(--surface);box-shadow:inset 0 0 0 1px var(--border);color:var(--ink);font:inherit;font-size:var(--fs-sm);
  font-weight:600;cursor:pointer;transition:box-shadow .15s ease,transform .15s ease}
.spy-volver__atras:hover{box-shadow:inset 0 0 0 1px var(--border-strong,var(--dim))}
.spy-volver__atras:active{transform:scale(.98)}
.spy-volver__atras > span:not(.spy-volver__caras){padding-right:4px}
.spy-volver__caras{display:flex;padding-left:4px}
.spy-volver__caras span{display:grid;place-items:center;width:26px;height:26px;margin-left:-8px;border-radius:50%;overflow:hidden;
  background:var(--surface-2);box-shadow:0 0 0 2px var(--surface);color:var(--dim);font-size:11px;font-weight:700}
.spy-volver__caras span:first-child{margin-left:0}
.spy-volver__caras img{width:100%;height:100%;object-fit:cover}

/* --- La identidad abre el riel, como la .pd-info abre la columna de al lado. --- */
.spy-ficha{position:relative;display:flex;flex-direction:column;gap:12px;padding:18px 20px 20px;border-radius:var(--r-lg);
  background:var(--surface);box-shadow:inset 0 0 0 1px var(--border),var(--sombra-tarjeta)}
.spy-ficha small{display:block;color:var(--faint);font-size:var(--fs-sm);font-weight:600}
.spy-ficha h1{margin:4px 0 0;font-size:var(--fs-kpi);font-weight:600;line-height:1.1;letter-spacing:-.02em}
.spy-ficha__quien{display:flex;align-items:center;gap:14px;min-width:0;padding-right:40px}
.spy-ficha__foto{flex:none;width:56px;height:56px;border-radius:50%;object-fit:cover;background:var(--surface-2);box-shadow:0 0 0 2px var(--surface),0 0 0 3px var(--border)}
.spy-ficha__datos{display:flex;flex-wrap:wrap;gap:6px}
/* El ⋯ arriba a la derecha de la tarjeta, donde se lo busca (Martín, 4/11: «los 3 puntos están abajo, no tiene sentido»). */
.spy-ficha__acciones{position:absolute;top:12px;right:12px;display:flex;gap:8px}
.spy-ficha__acciones .spy-boton:first-child{flex:1}

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
.spy-mix-sub{margin:14px 0 4px;font-size:var(--fs-sm);font-weight:600;color:var(--dim)}
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
.spy-pcard .spy-pcard__tag.spy-pcard__tag--analizando{top:12px;right:14px;left:auto;bottom:auto;padding-left:8px;background:rgba(22,26,25,.82);color:#fff;max-width:none;display:inline-flex;line-height:normal}
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
.spy-sugeridos{margin-top:calc(var(--gap) * 2)}
/* --- Todas sus piezas: a todo el ancho y por páginas (GrillaPiezas.tsx). --- */
.spy-todas{margin-top:calc(var(--gap) * 2)}
.spy-todas__titulo{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.spy-todas__titulo h2{margin:0;font-size:var(--fs-sect);font-weight:600;letter-spacing:-.01em}
.spy-trayendo{display:inline-flex;align-items:center;gap:7px;color:var(--faint);font-size:var(--fs-meta);font-weight:600}
.spy-trayendo i{width:7px;height:7px;border-radius:50%;background:var(--accent);animation:spy-latido 1.4s ease-in-out infinite}
@keyframes spy-latido{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
.spy-pgrid--ancha{gap:16px}
.spy-pgrid__celda{min-width:0;display:flex}
.spy-pgrid__celda > *{flex:1;min-width:0}
.spy-paginas{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:20px;flex-wrap:wrap}
.spy-paginas__cuenta{color:var(--faint);font-size:var(--fs-sm);font-weight:600;font-variant-numeric:tabular-nums}
.spy-paginas__botones{display:flex;align-items:center;gap:4px}
.spy-paginas__n,.spy-paginas__flecha{display:grid;place-items:center;min-width:36px;height:36px;padding:0 8px;border:0;border-radius:10px;
  background:none;color:var(--dim);font:inherit;font-size:var(--fs-sm);font-weight:600;font-variant-numeric:tabular-nums;cursor:pointer;
  transition:background .15s ease,color .15s ease}
.spy-paginas__n:hover,.spy-paginas__flecha:hover:not(:disabled){background:var(--surface-2);color:var(--ink)}
.spy-paginas__n[aria-current="page"]{background:var(--ink);color:var(--bg)}
.spy-paginas__flecha:disabled{opacity:.35;cursor:default}
.spy-paginas__salto{min-width:24px;text-align:center;color:var(--faint)}

/* --- Lo que mejor le fue: cierra el riel y se estira hasta donde terminan los formatos (MejoresPiezas.tsx). --- */
.spy-mejores{position:relative;flex:1 1 auto;min-height:250px}
.spy-mejores__tarjeta{position:absolute;inset:0;display:flex;flex-direction:column;padding:18px 20px 12px;border-radius:var(--r-lg);
  background:var(--surface);box-shadow:inset 0 0 0 1px var(--border),var(--sombra-tarjeta);overflow:hidden}
.spy-mejores h3{margin:0 0 10px;font-size:var(--fs-card);font-weight:600;line-height:1.25}
.spy-mejores ol{margin:0;padding:0;list-style:none;display:flex;flex-direction:column}
.spy-mejores li button{display:flex;align-items:center;gap:12px;width:100%;height:60px;padding:0 8px;margin:0 -8px;border:0;border-radius:12px;
  background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background .15s ease}
.spy-mejores li button:hover{background:var(--surface-2)}
.spy-mejores__mini{position:relative;flex:none;width:44px;height:44px;border-radius:10px;overflow:hidden;background:var(--surface-2)}
.spy-mejores__mini img{width:100%;height:100%;object-fit:cover}
.spy-mejores__red{position:absolute;right:2px;bottom:2px;line-height:0}
.spy-mejores__texto{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.spy-mejores__texto b{font-size:var(--fs-sm);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spy-mejores__texto small{color:var(--faint);font-size:var(--fs-meta);font-weight:600}
.spy-mejores__veces{flex:none;padding:3px 8px;border-radius:99px;background:var(--surface-2);color:var(--dim);font-size:var(--fs-meta);
  font-weight:700;font-variant-numeric:tabular-nums}
.spy-mejores__veces[data-alto="true"]{background:var(--ok-bg,var(--t3));color:var(--ok-ink,var(--t-ink))}
.spy-sugeridos .spy-phead h2{margin:0;font-size:var(--fs-sect);font-weight:600;letter-spacing:-.015em}
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
/* --- Sus otras redes: una PREGUNTA, no un dato. Se ve sólo si hay algo que confirmar.
   UNA PASTILLA DE UN RENGLÓN POR CANAL, en la fila de la miga (4/11/2026, Martín con Víctor Heras: «mira como se bugea todo
   el diseño»). Antes era una caja debajo de la miga, y la regla de su enlace (flex 1 1 220px) —escrita cuando el enlace era hijo
   directo de la fila— quedó adentro de una columna, donde esos 220 px son ALTO: cada canal medía 249 px y empujaba Contenido
   debajo de la pantalla. Ahora: el alto de los botones de la miga (40 px), lo que no entra se corta con «…», y cada pastilla
   ocupa el lugar libre de la fila; sólo con muchas baja de renglón. --- */
.spy-migas .spy-migas-accion{margin-left:auto;color:var(--accent)}
.spy-redes{display:contents}
.spy-redes-fila{display:inline-flex;align-items:center;gap:8px;height:40px;max-width:100%;min-width:0;padding:0 4px 0 6px;
  border-radius:99px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--border);font-size:var(--fs-sm);
  animation:spy-redes-entra .32s cubic-bezier(.2,.8,.2,1) both}
@keyframes spy-redes-entra{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.spy-redes-fila{animation:none}}
.spy-redes-punto{width:10px;height:10px;margin:0 4px;border-radius:99px;flex:0 0 auto}
.spy-redes-cara{width:28px;height:28px;border-radius:50%;object-fit:cover;flex:0 0 auto;background:var(--surface-2)}
.spy-redes-texto{display:flex;align-items:baseline;gap:6px;min-width:0;max-width:300px;white-space:nowrap}
.spy-redes-texto a{min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--ink);font-weight:600;text-decoration:none}
.spy-redes-texto a:hover{text-decoration:underline}
.spy-redes-texto small{flex:0 0 auto;color:var(--faint);font-size:12px}
.spy-redes-fila .spy-boton{height:32px;padding:0 12px;flex:0 0 auto}
@media (max-width:560px){.spy-redes-fila{width:100%}.spy-redes-texto{flex:1 1 auto;max-width:none}.spy-redes-texto small{display:none}}
.spy-aviso--suave{background:none;padding:0;color:var(--dim)}
.spy-vermas{display:flex;justify-content:center;margin:18px 0 6px}
.spy-mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}
.spy-mcard{display:flex;flex-direction:column;gap:8px;min-width:0;color:var(--ink);text-decoration:none}
.spy-mcard__img{position:relative;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:var(--surface-2)}
.spy-mcard__img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.spy-mcard b{font-size:var(--fs-sm);line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.spy-mcard small{color:var(--dim);font-size:12px}
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
/* La pestaña Funnel (tercera vuelta, 4/11): arriba su funnel y su oferta, lado a lado; debajo las notas; al final sus páginas. */
.spy-funnel-tab{display:flex;flex-direction:column;gap:28px;min-width:0}
.spy-funnel-arriba{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:16px;align-items:stretch}
.spy-funnel{display:flex;flex-direction:column;gap:12px;width:100%}
.spy-funnel-fila{display:flex;flex-direction:column;gap:6px;min-width:0}
.spy-funnel-fila>b{color:var(--faint);font-size:var(--fs-sm);font-weight:600}
.spy-funnel-pixel small{color:var(--faint);font-variant-numeric:tabular-nums}
.spy-funnel-nota,.spy-funnel-nada{margin:0;color:var(--faint);font-size:var(--fs-sm)}
.spy-nombre{font-size:var(--fs-card);font-weight:600}

/* ── Modales. ── */
.spy-modal{display:flex;flex-direction:column;gap:14px;padding:22px 24px}
.spy-modal-cabecera{display:flex;align-items:center;gap:10px}
.spy-modal-cabecera h2{flex:1;margin:0;font-size:var(--fs-card);font-weight:600}
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
  /* En una columna sola no hay nada que llenar: la tarjeta fluye y muestra 5 (MejoresPiezas lee la variable). */
  .spy-mejores{--mejores-fluye:1;min-height:0}
  .spy-mejores__tarjeta{position:static}
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
  /* En columna y SIN envolver: con wrap y la base de 280 px de arriba, cada tarjeta del riel quedaba con un hueco abajo
     (medido: los seguidores, 223 px de alto para 107 de contenido). */
  .spy-riel{flex-direction:column;flex-wrap:nowrap}
  .spy-riel > *{flex:0 0 auto}
  .spy-solo-ancho{display:none}
}
`;

/** Dos pestañas y nada más (Martín, 4/11): «Contenido» (el gráfico y sus piezas) y «Funnel» (su web y su oferta). */
type Pestana = 'contenido' | 'funnel';

// ⚠️ LAS FRANJAS DE UNA LÍNEA SE FUERON (4/11/2026). Martín: «elimina textos innecesarios, como "Lo que publica Los días
// los declara el canal; la etapa la calcula MaKo."». Explicaban un criterio nuestro que la pantalla ya no muestra.

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
      <div className="spy-pgrid" aria-busy={leyendo || true}>
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

/** El ícono de cada opción del desplegable de tipos (AGENTS.md: cada opción de un desplegable lleva el suyo). */
const ICONO_TIPO: Record<ValorDeContenido, NombreIconoMenu> = {
  todo: 'ver', reels: 'video', carruseles: 'imagen', largos: 'video', shorts: 'video', anuncios: 'anuncio',
  'agregar-instagram': 'agregar', 'agregar-youtube': 'agregar',
};

const NOMBRE_RED: Record<RedOtra, string> = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram' };
const COLOR_RED: Record<RedOtra, string> = { youtube: 'var(--yt)', tiktok: 'var(--ink)', instagram: 'var(--ig)' };
type BusquedaDeRedes = { buscando: boolean; sumadas: CandidatoVerificado[]; candidatos: CandidatoVerificado[] };

/** La cara de una red encontrada: su foto si la leímos, y si no el punto de su color. */
function CaraDeRed({ k }: { k: CandidatoVerificado }) {
  return k.foto
    // eslint-disable-next-line @next/next/no-img-element -- la sirve el CDN de la red, sin pasar por el optimizador
    ? <img className="spy-redes-cara" src={k.foto} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.remove(); }} />
    : <i className="spy-redes-punto" style={{ background: COLOR_RED[k.red] }} aria-hidden />;
}

/**
 * Sus otras redes, SOLAS (Martín, 4/11: «debe ser automático, no un botón, de última que te muestre opciones y te
 * pregunte si es ese o no»). Lo seguro ya se sumó y se puede deshacer; lo dudoso se pregunta, con su foto y el porqué.
 * Si no encontró nada, no dice nada: no hay nada que hacer.
 */
/** Cuántas veces se vuelve a pedir una búsqueda de redes que sigue corriendo, y cada cuánto. */
const VUELTAS_REDES = 6;
const ESPERA_REDES_MS = 15_000;

function OtrasRedes({ b, ocupado, onSi, onNo, onDeshacer }: {
  b: BusquedaDeRedes | undefined; ocupado: boolean;
  onSi: (k: CandidatoVerificado) => void; onNo: (k: CandidatoVerificado) => void; onDeshacer: (k: CandidatoVerificado) => void;
}) {
  // ⚠️ SIN TEXTO MIENTRAS BUSCA NI CUANDO NO PUDO (Martín, 4/11/2026: «Elimina textos innecesarios como "No pude buscar sus
  // otras redes ahora. Prueba en un rato."»). Se busca en segundo plano; lo que aparece, aparece. Lo que no terminó se vuelve a
  // pedir solo (`pendiente`, lib/spy-google-corrida.ts).
  if (!b || b.buscando) return null;
  if (!b.sumadas.length && !b.candidatos.length) return null;
  // Una pastilla por canal: su cara, «YouTube · su nombre» (el porqué al pasar el mouse, o al lado si es una pregunta) y sus botones.
  const fila = (k: CandidatoVerificado, rotulo: string, porque: string | null, botones: React.ReactNode) => (
    <div key={`${k.red}|${k.ref}`} className="spy-redes-fila" title={k.porque || undefined}>
      <CaraDeRed k={k} />
      <span className="spy-redes-texto">
        <a href={k.url} target="_blank" rel="noreferrer noopener">{rotulo}</a>
        {porque && <small>{porque}</small>}
      </span>
      {botones}
    </div>
  );
  return (
    <section className="spy-redes" aria-label="Sus otras redes">
      {b.sumadas.map((k) => fila(k, `Sumé su ${NOMBRE_RED[k.red]} · ${k.titulo || k.ref}`, null,
        <button type="button" className="spy-boton" disabled={ocupado} onClick={() => onDeshacer(k)}>Deshacer</button>))}
      {b.candidatos.map((k) => fila(k, `¿Es su ${NOMBRE_RED[k.red]}? · ${k.titulo || k.ref}`, k.porque || null, (
        <>
          <button type="button" className="spy-boton spy-boton-primario" disabled={ocupado} onClick={() => onSi(k)}>Es</button>
          <button type="button" className="spy-boton" disabled={ocupado} onClick={() => onNo(k)}>No es</button>
        </>
      )))}
    </section>
  );
}

/**
 * Una cara que no cargó cae a su foto de perfil, y recién sin foto se saca. Antes se sacaba de una: si la caricatura fallaba
 * (vencida, un permiso del bucket), la tarjeta quedaba sin cara aunque tuviera su foto (4/11/2026, el Cerebro con Den Borg).
 */
function caerAFoto(img: HTMLImageElement, foto: string | null | undefined): void {
  if (foto && img.getAttribute('src') !== foto) { img.src = foto; return; }
  img.remove();
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
          const cara = caraDeTarjeta(c, caricaturaDeCompetidor(c));
          // Los competidores que YA estaban se guardaron con lo que se pegó —un @, el id de un
          // canal—, y esas filas no se arreglan solas: se eligió mostrar su nombre de verdad en vez
          // de reescribirle un dato al negocio.
          const titulo = nombreDeTarjeta(c);
          // Cada cara arranca su flote en otro momento. Es por ÍNDICE y no al azar: `Math.random()`
          // en el render daría un número distinto en el servidor y en el navegador, y React avisaría
          // de hidratación desajustada. Un paso de 0,55 s reparte siete segundos entre las primeras
          // trece tarjetas sin que dos vecinas coincidan.
          const flote = `${((i * 0.55) % 7).toFixed(2)}s`;
          const canales = [c.instagram ? 'Instagram' : null, c.youtube_id ? 'YouTube' : null, c.tiktok ? 'TikTok' : null, c.landing_url ? 'Su web' : null].filter(Boolean).join(' · ');
          return (
            <div key={c.id} className="spy-ccard" role="button" tabIndex={0}
              onClick={() => onAbrir(c.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(c.id); } }}>
              <span className="spy-ccard__cara" style={{ '--flote': flote } as CSSProperties} aria-hidden>
                {/* ⚠️ LA CARICATURA PRIMERO (4/11/2026): la que hizo el Runner, después la dibujada de un referente, y recién
                    sin ninguna su foto (`caraDeTarjeta`). Sin la caricatura NO hay cartel ni spinner: la foto y listo. */}
                {cara
                  // eslint-disable-next-line @next/next/no-img-element -- está en nuestro bucket o en /public, no pasa por el optimizador
                  ? <img src={cara} alt="" loading="lazy" onError={(e) => { caerAFoto(e.currentTarget, c.avatar); }} />
                  : inicial(c.nombre)}
              </span>
              <div className="spy-ccard__cuerpo">
                <span>
                  <b className="spy-ccard__nombre" title={titulo}>{titulo}</b>
                  <small className="spy-ccard__sub">{canales || 'Sin canales todavía'}</small>
                </span>
                <div className="spy-ccard__pie">
                  {r && r.vivas + r.idas > 0 && (
                    <span className="spy-pildora"><i className="spy-punto spy-punto-vivo" />{r.vivas} {r.vivas === 1 ? 'pieza' : 'piezas'}{r.idas ? ` · ${r.idas} borradas` : ''}</span>
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

/**
 * «Sugeridos»: los competidores de la plataforma que este negocio todavía no mira (lib/spy-sugeridos.ts). La misma
 * tarjeta que los propios, con «Sumar». Sumarlo copia lo que ya se leyó de él: no gasta nada del negocio.
 */
function RejillaSugeridos({ sugeridos, ocupado, onSumar }: { sugeridos: Sugerido[]; ocupado: boolean; onSumar: (s: Sugerido) => void }) {
  if (!sugeridos.length) return null;
  return (
    <section aria-label="Sugeridos" className="spy-sugeridos">
      <header className="spy-phead"><div className="spy-phead__texto"><h2>Sugeridos</h2></div></header>
      <div className="spy-crejilla">
        {sugeridos.map((s, i) => {
          const canales = [s.instagram ? 'Instagram' : null, s.youtube_id ? 'YouTube' : null, s.tiktok ? 'TikTok' : null, s.landing_url ? 'Su web' : null].filter(Boolean).join(' · ');
          const titulo = nombreDeTarjeta(s);
          return (
            <div key={s.id} className="spy-ccard">
              <span className="spy-ccard__cara" style={{ '--flote': `${((i * 0.55) % 7).toFixed(2)}s` } as CSSProperties} aria-hidden>
                {s.cara
                  // eslint-disable-next-line @next/next/no-img-element -- está en nuestro bucket o en /public, no pasa por el optimizador
                  ? <img src={s.cara} alt="" loading="lazy" onError={(e) => { e.currentTarget.remove(); }} />
                  : inicial(s.nombre)}
              </span>
              <div className="spy-ccard__cuerpo">
                <span>
                  <b className="spy-ccard__nombre" title={titulo}>{titulo}</b>
                  {canales && <small className="spy-ccard__sub">{canales}</small>}
                </span>
                <div className="spy-ccard__pie">
                  <button type="button" className="spy-boton spy-boton-primario" disabled={ocupado} onClick={() => onSumar(s)}>Sumar</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** La serie categórica: el mismo color para el mismo concepto en la barra y en la fila. */
const SERIE = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];

/** Una caja del riel: cabecera, barra apilada y filas. Es el bloque «Where it sells» de merrin. */
function CajaMix({ titulo, pie, filas, total, iconos, otras }: {
  // `pie` admite null porque `fraseDeLectura` devuelve null cuando al competidor no se le leyo nada.
  titulo: string; pie?: string | null; total: number;
  filas: Array<{ rotulo: string; n: number; pct: number }>;
  /** El logo de cada fila (por su rótulo), en vez del punto de color: las redes llevan el de su marca. */
  iconos?: Record<string, React.ReactNode>;
  /** Un segundo reparto debajo, con su subtítulo (los formatos, debajo de las redes). */
  otras?: { titulo: string; filas: Array<{ rotulo: string; n: number; pct: number }> };
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
            <span className="spy-mix-ico" aria-hidden>{iconos?.[f.rotulo] ?? <i style={{ width: 10, height: 10, borderRadius: '50%', background: SERIE[i % 4] }} />}</span>
            <span className="spy-mix-nombre"><b title={f.rotulo}>{f.rotulo}</b><small>{f.pct}% de {total}</small></span>
            <span className="spy-mix-val"><b>{f.n}</b></span>
          </li>
        ))}
      </ul>
      {otras && otras.filas.length > 0 && (
        <>
          <h3 className="spy-mix-sub">{otras.titulo}</h3>
          <ul className="spy-mix-filas">
            {otras.filas.map((f) => (
              <li key={f.rotulo}>
                <span className="spy-mix-nombre"><b title={f.rotulo}>{f.rotulo}</b><small>{f.pct}% de {total}</small></span>
                <span className="spy-mix-val"><b>{f.n}</b></span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * El riel de análisis: hasta dos cajas de 336 px al costado de la rejilla.
 *
 * ⚠️ ANTES ERA UNA BANDA PLEGADA ARRIBA DE LAS PIEZAS, y por eso arrancaba cerrada: tres columnas
 * de listas empujaban la primera pieza fuera de la pantalla. En la referencia (merrin) el análisis
 * nunca compite con el catálogo: vive en una columna propia a la derecha y por eso puede estar
 * siempre abierto. Esto es lo mismo.
 *
 * ⚠️ «CON QUÉ ABRE» SE FUE (4/11/2026). Martín: «"Con qué abre" no se entiende qué significa eso, y la IA ya debería
 * analizar por sí sola todo, sin pedirlo». El gancho que lee la IA ya es el título de cada tarjeta, y el análisis
 * corre solo (/api/competitor-spy/analizar): no hay botón «Leer con IA».
 *
 * La sección sin nada que decir NO EXISTE: no se anuncia su ausencia (Semrush).
 */
function RielAnalisis({ piezas, c }: { piezas: PiezaVista[]; c: Competidor }) {
  // «¿En qué publica?» de verdad: por red (con su logo) y por formato. Nada de «100% videos» (Martín, 4/11).
  const reparto = useMemo(() => repartoDePublicaciones(piezas), [piezas]);
  const destinos = useMemo(() => destinosDe(piezas), [piezas]);
  const frase = fraseDeLectura(piezas, c.mirado_en);
  return (
    <>
      <CajaMix titulo="¿En qué publica?" pie={frase} filas={reparto.redes} total={reparto.total}
        iconos={Object.fromEntries(reparto.redes.map((f) => [f.rotulo, f.red ? <LogoRed red={f.red} box={18} /> : null]))}
        otras={reparto.formatos.length > 1 ? { titulo: 'En qué formato', filas: reparto.formatos } : undefined} />
      <CajaMix titulo="A dónde manda" filas={destinos.slice(0, 6)} total={piezas.length} />
    </>
  );
}

export function SpyApp({ iniciales, resumenInicial, abierto, piezasIniciales = null, errorInicial, puedeBorrar = false, ws = null, sugeridosIniciales = [], conVistaPrevia = false }: {
  iniciales: Competidor[];
  resumenInicial: Record<number, ResumenPiezas>;
  /** El `?competidor=` de la URL. La ficha es una URL: se comparte, se marca y se vuelve. */
  abierto: number | null;
  /** Las piezas del `abierto`, leídas en el server junto con todo lo demás: la ficha dibuja sin otra vuelta al abrir. */
  piezasIniciales?: { id: number; piezas: PiezaVista[] } | null;
  errorInicial: string | null;
  /** Sólo el admin del negocio borra: se lleva lo leído por todo el equipo y no se deshace. */
  puedeBorrar?: boolean;
  /** El negocio: va en la clave de lo que se recuerda en el navegador (`redes-recordar.ts`). */
  ws?: number | null;
  /** Los competidores de la plataforma que este negocio todavía no mira. */
  sugeridosIniciales?: Sugerido[];
  /** La vista previa de sus páginas: la ruta del Diagnóstico del Web Generator pide el admin y esa tab en el plan. */
  conVistaPrevia?: boolean;
}) {
  const [competidores, setCompetidores] = useState<Competidor[]>(iniciales);
  const [sugeridos, setSugeridos] = useState<Sugerido[]>(sugeridosIniciales);
  const [resumen, setResumen] = useState(resumenInicial);
  const [elegido, setElegido] = useState<number | null>(abierto ?? (iniciales.length === 1 ? iniciales[0].id : null));
  // Las del server se usan UNA vez, sólo para el competidor con que se abrió la página.
  const inicialesDePiezas = useRef(piezasIniciales);
  const [piezas, setPiezas] = useState<PiezaVista[]>(() => (piezasIniciales && piezasIniciales.id === (abierto ?? null) ? piezasIniciales.piezas : []));
  const [trayendo, setTrayendo] = useState(false);
  const [leyendo, setLeyendo] = useState<number | null>(null);
  const [ordenando, setOrdenando] = useState<{ id: number; piezas: PiezaVista[] | null } | null>(null);
  /** A quién le está leyendo las piezas la IA, sola y en segundo plano. Sus tarjetas sin análisis dicen «Analizando…». */
  const [autoAnalisis, setAutoAnalisis] = useState<number | null>(null);
  // Su oferta, con el analista de Offer (lib/spy-oferta.ts): la trae sola /api/competitor-spy/oferta.
  const [ofertas, setOfertas] = useState<Record<number, VistaOferta>>({});
  /** A quién se le está trayendo todo lo que publicó, en una corrida larga de Apify. */
  const [trayendoTodo, setTrayendoTodo] = useState<number | null>(null);
  /** Por qué la traída larga no trajo todo, por competidor (4/11/2026: «si una corrida larga no terminó, la pantalla lo dice»). */
  const [avisoTodo, setAvisoTodo] = useState<Record<number, string>>({});
  /** Cuántas tarjetas se dibujan: con cientos de piezas, de a 60 (una grilla de 500 imágenes traba la pantalla). */
  const [lecturas, setLecturas] = useState<Record<number, LecturaCanalSpy[]>>({});
  const [error, setError] = useState<string | null>(errorInicial);
  // El gráfico va primero: es el detalle de cada competidor (punto 7 del 4/11/2026).
  const [pestana, setPestana] = useState<Pestana>('contenido');
  /** La pieza abierta en su detalle, con las de su gráfico (para su puesto). */
  const [abierta, setAbierta] = useState<{ p: PiezaVista; todas: readonly PiezaVista[] } | null>(null);
  // El recorrido de lo nuevo (Martín, 4/11: «la animación que ya tenemos tipo tutorial»). Es el de la casa; sólo con una ficha abierta.
  const recorrido = useRecorrido(RECORRIDO_SPY);
  /** La página que se mira en «Sus páginas»: la elige el desplegable o una cita de su funnel. */
  const [paginaElegida, setPaginaElegida] = useState<string | null>(null);

  const [textoAlta, setTextoAlta] = useState('');
  const [buscar, setBuscar] = useState('');
  const [tipo, setTipo] = useState<TipoContenido>('todo');
  const [orden, setOrden] = useState<OrdenSpy>('mas-vistas');
  const [modal, setModal] = useState<'alta' | 'canal' | 'anuncio' | 'quitar' | null>(null);
  /** «Agregar su YouTube» busca sólo en YouTube; el «Agregar un canal» del menú, en todas sus redes. */
  const [redCanal, setRedCanal] = useState<'instagram' | 'youtube' | null>(null);
  const abrirCanal = (red: 'instagram' | 'youtube' | null) => { setErrorModal(null); setRedCanal(red); setModal('canal'); };
  /** A quién se está por dejar de mirar DESDE LA LISTA. En la ficha eso lo maneja `modal`. */
  const [aBorrar, setABorrar] = useState<Competidor | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  /** Lo que trajo la búsqueda de sus otras redes, por competidor. Lo dudoso vive en la sesión: nunca se guarda sin el «Es». */
  const [redes, setRedes] = useState<Record<number, BusquedaDeRedes>>({});

  // Qué ficha está abierta AHORA: una lectura que tarda no puede pisar la de otro competidor.
  const actual = useRef(elegido);
  actual.current = elegido;
  const yaLeidos = useRef(new Set<number>());
  // La lista de ahora, para lo que se decide DESPUÉS de un await (si le faltan redes): el estado del cierre ya es viejo.
  const listaActual = useRef(competidores);
  listaActual.current = competidores;

  const c = competidores.find((x) => x.id === elegido) ?? null;

  // ⚠️ EL RECORRIDO SE ABRE CON LA FICHA QUIETA, Y MIENTRAS ESTÁ ABIERTO LA PÁGINA NO SE SCROLLEA A MANO (4/11/2026, el Cerebro con
  // Den Borg: «el primer cuadro salió con el texto vacío» y «al hacer scroll, el recorrido sigue pero el foco se pierde; que no se
  // pueda scrollear o que lo siga»). Mientras se traen sus piezas o corre la película, la pantalla cambia debajo de la tarjeta; se
  // espera a que termine. Y con la rueda, el recorte seguía al objetivo hasta afuera de la pantalla: ahora la mueve sólo el
  // recorrido (su `scrollIntoView` funciona igual con `overflow: hidden`).
  const recorridoListo = !!c && !trayendo && ordenando == null;
  const recorridoAbierto = recorrido.abierto && recorridoListo;
  useEffect(() => {
    if (!recorridoAbierto) return;
    const raiz = document.documentElement;
    const antes = raiz.style.overflow;
    raiz.style.overflow = 'hidden';
    return () => { raiz.style.overflow = antes; };
  }, [recorridoAbierto]);

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
      // Lo nuevo lo lee la IA sola, sin que nadie espere (punto 11 del 4/11).
      if (p && cuantasFaltan(p)) void analizarSolo(id);
      // Y todo lo que publicó, en una corrida larga de Apify que no se espera (punto 8 del 4/11).
      void traerTodo(id);
    } catch (e) {
      setOrdenando(null);
      throw e;
    } finally {
      setLeyendo((v) => (v === id ? null : v));
    }
  // `analizarSolo` se declara más abajo y sólo lo usa después de un await: no cambia entre renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recargarLista, traerPiezas]);

  // Abrir una ficha: trae lo guardado y, si hace falta, lee. Sin botón que haya que encontrar.
  useEffect(() => {
    if (elegido == null) return;
    let vivo = true;
    const id = elegido;
    const ini = inicialesDePiezas.current?.id === id ? inicialesDePiezas.current : null;
    inicialesDePiezas.current = null;
    if (!ini) setPiezas([]);
    setError(null); setBuscar(''); setTipo('todo'); setPestana('contenido'); setTrayendo(!ini); setOrdenando(null);
    void (async () => {
      const p = ini ? ini.piezas : await traerPiezas(id);
      if (!vivo) return;
      setTrayendo(false);
      const quien = listaActual.current.find((x) => x.id === id);
      if (quien && debeLeerAlAbrir(quien, p?.length ?? 0, yaLeidos.current.has(id))) await leer(id, !p?.length).catch(() => undefined);
      else {
        if (p && cuantasFaltan(p)) void analizarSolo(id);
        void traerTodo(id);
      }
      // Sus otras redes, solas, DESPUÉS de leer: si no, la búsqueda (que también lee perfiles) compite con la lectura.
      const ahora = listaActual.current.find((x) => x.id === id);
      if (vivo && ahora && debeBuscarRedes(ahora, ws)) void buscarRedes(id);
    })();
    return () => { vivo = false; };
    // `competidores` afuera a propósito (se lee de `listaActual`): cada lectura la reescribe, y esto volvería a abrir la
    // ficha. `buscarRedes` y `analizarSolo` sólo tocan estado.
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
    // El detalle abierto es de una pieza del que se deja: se cierra, y el otro abre en su gráfico.
    setAbierta(null);
    setPaginaElegida(null);
    setPestana('contenido');
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

  // Sus otras redes (puntos 6 del 4/11): se buscan SOLAS, al dar de alta y al abrir la ficha de alguien a quien le falta
  // una (una vez por semana: `redes-recordar.ts`). Por una RUTA y no una action: tarda hasta 40 s y haría fila.
  const buscarRedes = useCallback(async (id: number, vuelta = 0) => {
    if (vuelta === 0) {
      marcarRedesBuscadas(ws, id);
      setRedes((v) => ({ ...v, [id]: { buscando: true, sumadas: [], candidatos: [] } }));
    }
    type Resp = { ok: true; sumadas: CandidatoVerificado[]; candidatos: CandidatoVerificado[]; web?: string | null; pendiente?: boolean } | { ok: false; error: string };
    const r: Resp = await fetch('/api/competitor-spy/redes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), signal: AbortSignal.timeout(125_000),
    }).then((x) => x.json() as Promise<Resp>).catch(() => ({ ok: false as const, error: '' }));
    // Google todavía corre: lo encontrado se muestra y se vuelve a pedir solo, sin texto. La corrida se retoma sin pagar otra.
    const sigue = r.ok && r.pendiente && vuelta < VUELTAS_REDES;
    setRedes((v) => ({
      ...v,
      [id]: r.ok
        ? { buscando: false, sumadas: [...(v[id]?.sumadas ?? []).filter((k) => !r.sumadas.some((x) => x.red === k.red && x.ref === k.ref)), ...r.sumadas], candidatos: r.candidatos }
        : { buscando: false, sumadas: v[id]?.sumadas ?? [], candidatos: [] },
    }));
    if (sigue) setTimeout(() => { if (actual.current === id) void buscarRedes(id, vuelta + 1); }, ESPERA_REDES_MS);
    // Lo que se sumó solo se lee ya: sus piezas tienen que aparecer sin que nadie apriete nada.
    // Su web encontrada también se lee ya (su funnel y su oferta, solos).
    if (r.ok && (r.sumadas.some((k) => k.red !== 'tiktok') || r.web)) {
      await recargarLista();
      yaLeidos.current.delete(id);
      if (actual.current === id) void leer(id, false);
    } else if (r.ok && r.sumadas.length) await recargarLista();
  // `leer` y `recargarLista` son estables (useCallback); `ws` no cambia en la vida de la pantalla.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quitarDeLasRedes = (id: number, sale: (k: CandidatoVerificado) => boolean) =>
    setRedes((v) => (v[id] ? { ...v, [id]: { ...v[id], sumadas: v[id].sumadas.filter((k) => !sale(k)), candidatos: v[id].candidatos.filter((k) => !sale(k)) } } : v));

  const confirmarRed = async (k: CandidatoVerificado) => {
    if (elegido == null) return;
    const id = elegido;
    setOcupado(true); setError(null);
    try {
      // El MISMO camino que pegarlo a mano: nunca pisa una red que ya estaba.
      const r = await sumarCanalAction(id, k.url);
      if (!r.ok) { setError(r.error); return; }
      // De esa red no se ofrece nada más: el resto con su nombre son otras personas.
      quitarDeLasRedes(id, (x) => x.red === k.red);
      // TikTok no se lee: no hay nada que traer, sólo mostrarlo.
      if (k.red === 'tiktok') await recargarLista();
      else await abrirRecienAgregado(id);
    } finally {
      setOcupado(false);
    }
  };

  /** «Deshacer» una red que se sumó sola y no era de él: se saca el canal y sus piezas. */
  const deshacerRed = async (k: CandidatoVerificado) => {
    if (elegido == null) return;
    const id = elegido;
    setOcupado(true); setError(null);
    try {
      const r = await quitarCanalAction(id, k.red);
      if (!r.ok) { setError(r.error); return; }
      quitarDeLasRedes(id, (x) => x.red === k.red && x.ref === k.ref);
      await recargarLista();
      await traerPiezas(id);
    } finally {
      setOcupado(false);
    }
  };

  /**
   * La IA del negocio lee lo que falta, sola (/api/competitor-spy/analizar). La ruta contesta en el acto y el trabajo
   * sigue en el servidor; acá sólo se marca quién está en análisis y la pantalla vuelve a pedir las piezas.
   */
  /**
   * Todo lo que publicó (punto 8 del 4/11: «que traiga muchos más, si puede, todos directamente»): una corrida larga de
   * Apify que empieza el servidor y no se espera (/api/competitor-spy/todo). Si está en marcha, se vuelve a preguntar.
   */
  const traerTodo = useCallback(async (id: number) => {
    type Resp = { ok: boolean; enMarcha?: boolean; nuevas?: number; porque?: string };
    const r: Resp = await fetch('/api/competitor-spy/todo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), signal: AbortSignal.timeout(65_000),
    }).then((x) => x.json() as Promise<Resp>).catch(() => ({ ok: false }));
    if (r.ok && r.enMarcha) setTrayendoTodo(id);
    // El motivo, en palabras: antes se tiraba y la ficha quedaba con lo de la lectura de siempre sin decir por qué.
    const aviso = !r.ok ? null : avisoDeTraida(r.porque, { admin: puedeBorrar });
    setAvisoTodo((v) => { const n = { ...v }; if (aviso) n[id] = aviso; else delete n[id]; return n; });
    return r;
  }, [puedeBorrar]);

  // Mientras la corrida larga está en marcha, se pregunta cada 20 s; al terminar, se traen las piezas nuevas y la IA las
  // lee sola. Se para a los 15 minutos: la corrida sigue en Apify y la próxima apertura la recoge.
  useEffect(() => {
    if (trayendoTodo == null) return;
    const id = trayendoTodo;
    let vivo = true;
    let vueltas = 0;
    let t: ReturnType<typeof setTimeout>;
    const vuelta = async () => {
      if (!vivo || actual.current !== id) { setTrayendoTodo((v) => (v === id ? null : v)); return; }
      vueltas += 1;
      const r = await traerTodo(id);
      if (!vivo) return;
      if (r.ok && r.enMarcha && vueltas < 45) { t = setTimeout(() => { void vuelta(); }, 20_000); return; }
      setTrayendoTodo((v) => (v === id ? null : v));
      // A los 15 minutos la pantalla deja de preguntar; la corrida sigue y la recoge el cron (/api/cron/spy-todo).
      if (r.ok && r.enMarcha) setAvisoTodo((v) => ({ ...v, [id]: 'Sigue trayendo todo lo que publicó: aparece solo.' }));
      if (r.ok && (r.nuevas ?? 0) > 0) {
        await recargarLista();
        const p = await traerPiezas(id);
        if (p && cuantasFaltan(p)) void analizarSolo(id);
      }
    };
    t = setTimeout(() => { void vuelta(); }, 20_000);
    return () => { vivo = false; clearTimeout(t); };
  // `analizarSolo` es estable (useCallback sin dependencias) y se declara más abajo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trayendoTodo, traerTodo, traerPiezas, recargarLista]);

  const analizarSolo = useCallback(async (id: number) => {
    type Resp = { ok: boolean; enMarcha?: boolean; faltan?: number; sinIA?: boolean };
    const r: Resp = await fetch('/api/competitor-spy/analizar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), signal: AbortSignal.timeout(30_000),
    }).then((x) => x.json() as Promise<Resp>).catch(() => ({ ok: false }));
    if (r.ok && r.enMarcha) setAutoAnalisis(id);
  }, []);

  // ── Su oferta (4/11/2026; Martín: «en "Su Funnel" debe "exponer" su OFERTA con el analizador de oferta que ya tenemos
  // construido, y debe traer automáticamente sus web»). Se pide sola al abrir un competidor con web, y se vuelve a preguntar
  // mientras dice «leyendo». El trabajo sigue en el servidor aunque esto se pare o se cierre la pestaña.
  const pedirOferta = useCallback(async (id: number): Promise<VistaOferta | null> => {
    type Resp = { ok: boolean; oferta?: VistaOferta };
    const r: Resp = await fetch('/api/competitor-spy/oferta', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), signal: AbortSignal.timeout(30_000),
    }).then((x) => x.json() as Promise<Resp>).catch(() => ({ ok: false }));
    if (!r.ok || !r.oferta) return null;
    const o = r.oferta;
    setOfertas((v) => ({ ...v, [id]: o }));
    return o;
  }, []);

  // ── Las caricaturas NO se piden desde acá (4/11/2026): entran a la cola al leer al competidor y las hace el Runner con
  // Canva (lib/spy-caricatura-cola.ts). La pantalla sólo dibuja la que ya esté; sin ella, la foto.

  // Mientras la IA lee, se vuelven a pedir las piezas cada 5 s. Se para cuando no falta ninguna, cuando dejó de avanzar
  // (un minuto sin una nueva) o a los 4 minutos. El trabajo del servidor sigue aunque esto se pare o se cierre la pestaña.
  useEffect(() => {
    if (autoAnalisis == null) return;
    const id = autoAnalisis;
    let vivo = true;
    let vueltas = 0;
    let quietas = 0;
    let antes = Number.POSITIVE_INFINITY;
    let t: ReturnType<typeof setTimeout>;
    const terminar = () => { vivo = false; setAutoAnalisis((v) => (v === id ? null : v)); };
    const vuelta = async () => {
      if (!vivo) return;
      if (actual.current !== id) { terminar(); return; }
      vueltas += 1;
      const p = await traerPiezas(id).catch(() => null);
      if (!vivo) return;
      const faltan = p ? cuantasFaltan(p) : antes;
      if (faltan < antes) { quietas = 0; antes = faltan; } else quietas += 1;
      if (faltan === 0) { terminar(); void recargarLista(); return; }
      if (vueltas >= 48 || quietas >= 12) { terminar(); return; }
      t = setTimeout(() => { void vuelta(); }, 5000);
    };
    t = setTimeout(() => { void vuelta(); }, 5000);
    return () => { vivo = false; clearTimeout(t); };
  }, [autoAnalisis, traerPiezas, recargarLista]);

  // Con web (la suya, o una página que se guardó de él), su oferta se pide sola. Cada 8 s mientras lee, hasta 5 minutos.
  const idConWeb = c && (c.landing_url || piezas.some((p) => p.canal === 'landing')) ? c.id : null;
  useEffect(() => {
    if (idConWeb == null) return;
    const id = idConWeb;
    let vivo = true;
    let vueltas = 0;
    let t: ReturnType<typeof setTimeout>;
    const vuelta = async () => {
      if (!vivo || actual.current !== id) return;
      vueltas += 1;
      const o = await pedirOferta(id);
      if (vivo && o?.estado === 'leyendo' && vueltas < 40) t = setTimeout(() => { void vuelta(); }, 8000);
    };
    void vuelta();
    return () => { vivo = false; clearTimeout(t); };
  }, [idConWeb, c?.landing_url, pedirOferta]);

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

  const alta = async (valor: string, nombre?: string, deLaBio?: string | null) => {
    const id = await sumar(valor, nombre, deLaBio);
    if (id == null) return;
    setModal(null);
    // Sus otras redes las busca sola la ficha al abrirse, DESPUÉS de la primera lectura (`debeBuscarRedes`).
    await abrirRecienAgregado(id);
  };

  // Un sugerido se suma copiando lo que ya se leyó de él: se abre su ficha sin leer nada (no gasta la clave del negocio).
  const sumarSugerido = async (sug: Sugerido) => {
    setOcupado(true); setError(null);
    try {
      const r = await sumarSugeridoAction(sug.id);
      if (!r.ok) { setError(r.error); return; }
      setSugeridos((v) => v.filter((x) => x.id !== sug.id));
      await recargarLista();
      irA(r.id);
    } finally {
      setOcupado(false);
    }
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
      setPestana('contenido');
    } finally {
      setOcupado(false);
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

  const abrirAlta = (texto = '') => { setErrorModal(null); setTextoAlta(texto); setModal('alta'); };
  // ⚠️ LA BARRA DE ARRIBA ABRE EL BUSCADOR, igual que el «+» (Martín, 4/11: «La barra principal de búsqueda debería
  // funcionar igual que cuando le doy al "+"... no funciona la funcionalidad de buscar... No hace nada»). Antes filtraba
  // sólo entre los que ya se miran y, sin coincidencias, mostraba un cartel con otro botón: escribir un nombre nuevo no
  // buscaba nada. Ahora es el `.finder` de merrin, que también se abre desde su barra: «Ya los miras» sale primero ahí.
  // El atajo es el de la referencia: «/» o ⌘K.
  useEffect(() => {
    if (c) return;
    const atajo = (e: KeyboardEvent) => {
      if (modal) return;
      const enCampo = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !enCampo)) { e.preventDefault(); abrirAlta(); }
    };
    document.addEventListener('keydown', atajo);
    return () => document.removeEventListener('keydown', atajo);
  // `abrirAlta` se arma en cada render y sólo toca estado: no hace falta en las dependencias.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, modal]);

  const flujo = useMemo(() => piezas.filter((p) => p.canal === 'instagram' || p.canal === 'youtube'), [piezas]);
  const anuncios = useMemo(() => piezas.filter((p) => p.canal === 'anuncios'), [piezas]);
  // La grilla de abajo: lo que publica Y sus anuncios, como un formato más (Martín, 4/11: «los anuncios deberían estar en
  // "Contenido", igual que el resto»). Antes los anuncios eran una sección aparte, al final de todo.
  const contenido = useMemo(() => [...flujo, ...anuncios], [flujo, anuncios]);
  const visibles = useMemo(() => ordenarPiezas(filtrarPiezas(contenido, buscar, tipo), orden), [contenido, buscar, tipo, orden]);
  // Otra búsqueda, otro tipo u otro orden vuelven a las primeras 60.
  const opcionesTipo = useMemo(() => (c ? opcionesDeContenido(contenido, c) : []), [contenido, c]);
  const ofertaDe = c ? ofertas[c.id] : undefined;
  const ofertaConDiagnostico = !!ofertaDe && 'diagnostico' in ofertaDe && !!ofertaDe.diagnostico;
  const paginasLeidas = useMemo(() => (ofertaDe && 'paginas' in ofertaDe ? ofertaDe.paginas : []), [ofertaDe]);
  // Qué funnel usa, con lo que lo delata (lib/spy-funnel-tipo.ts, del catálogo). Se calcula UNA vez: también decide la pestaña.
  const fuentesFunnel = useMemo(() => fuentesDeEvidencia(piezas, paginasLeidas), [piezas, paginasLeidas]);
  const lecturaFunnel = useMemo(() => clasificarFunnel(fuentesFunnel), [fuentesFunnel]);
  // Sus páginas: su web primero y, si es una página de enlaces (Beacons, Linktree), cada página suya que enlaza.
  const susPaginas = useMemo(() => {
    const leidos = ofertaDe && 'enlaces' in ofertaDe ? ofertaDe.enlaces : [];
    return [...new Set([...(c?.landing_url ? [c.landing_url] : []), ...leidos])];
  }, [ofertaDe, c?.landing_url]);
  const titulosDePaginas = useMemo(() => new Map(paginasLeidas.filter((p) => p.titulo?.trim()).map((p) => [p.url, p.titulo])), [paginasLeidas]);
  const filasDeSuWeb = useMemo(() => piezas.filter((p) => p.canal === 'landing').map((p) => p.funnel), [piezas]);
  const verPagina = (url: string) => {
    setPaginaElegida(url);
    const quieto = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => document.getElementById('spy-sus-paginas')?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' }));
  };
  const verPieza = (id: number) => {
    const p = piezas.find((x) => x.id === id);
    if (p) setAbierta({ p, todas: p.canal === 'anuncios' ? anuncios : piezas.filter((x) => grupoDe(x) === grupoDe(p)) });
  };
  // ⚠️ UNA PESTAÑA SIN NADA QUE DECIR NO EXISTE: no aparece vacía, no aparece. Y son DOS (Martín, 4/11): las de antes
  // (Gráfico, Lo que publica, Miniaturas, Su oferta, Su web, Anuncios) partían lo mismo en seis lugares.
  const pestanas: Array<{ key: Pestana; rotulo: string; n?: number }> = c ? [
    ...(flujo.length || anuncios.length || c.instagram || c.youtube_id || !c.landing_url ? [{ key: 'contenido' as const, rotulo: 'Contenido', n: (flujo.length + anuncios.length) || undefined }] : []),
    ...(c.landing_url || c.oferta?.promete || ofertaConDiagnostico || lecturaFunnel.principal ? [{ key: 'funnel' as const, rotulo: 'Funnel' }] : []),
  ] : [];
  const activa: Pestana = pestanas.some((p) => p.key === pestana) ? pestana : (pestanas[0]?.key ?? 'contenido');

  const lecturasDe = elegido != null ? lecturas[elegido] ?? null : null;
  const estaLeyendo = leyendo != null && leyendo === elegido;
  const estado = c
    ? estadoDeResultados({ leyendo: estaLeyendo, trayendo, visibles: visibles.length, total: contenido.length, hayCanales: canalesDe(c), lecturas: lecturasDe })
    : 'hay';

  const desde = useMemo(() => piezas.map((p) => p.visto_primera_vez).sort()[0] ?? null, [piezas]);

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
    c.tiktok ? `TikTok @${c.tiktok}` : null,
    c.landing_url ? 'Su web' : null,
  ].filter(Boolean).join(' · ') : '';

  // Las celdas pastel del riel. Un contador ausente NO es cero: sin dato no hay celda.
  const rc = c ? resumen[c.id] : undefined;
  const celdas = c ? [
    ...(rc && rc.vivas > 0 ? [{ k: 'vivas', rot: 'Piezas', val: String(rc.vivas), pie: 'publicadas' }] : []),
    ...(rc && rc.idas > 0 ? [{ k: 'idas', rot: 'Borradas', val: String(rc.idas), pie: 'las bajó' }] : []),
    ...(c.instagram_seguidores != null ? [{ k: 'ig', rot: 'Seguidores', val: dibujarContador(c.instagram_seguidores), pie: 'en Instagram' }] : []),
    ...(c.youtube_suscriptores != null ? [{ k: 'yt', rot: 'Suscriptores', val: dibujarContador(c.youtube_suscriptores), pie: 'en YouTube' }] : []),
  ] : [];


  const revisarDeNuevo = (
    <button type="button" className="spy-boton" disabled={estaLeyendo || ordenando != null || elegido == null} onClick={() => { if (elegido != null) void leer(elegido); }}>
      Probar de nuevo
    </button>
  );

  const motivos = (
    <>
      {(lecturasDe ?? []).map((l) => <p key={l.canal}>{l.detalle}</p>)}
      {error && <p>{error}</p>}
    </>
  );

  // El riel de la ficha: su nombre, su menú y sus datos. Va al lado del gráfico y de sus piezas, en «Contenido».
  const riel = c ? (
    <aside className="spy-riel">
      {/* La identidad abre el riel, como la `.pd-info` abre la columna de al lado en la
          referencia: ante-título chico, nombre grande, la frescura, y la acción. ⚠️ EL
          RIEL YA NO DEPENDE DE QUE HAYA PIEZAS: si dependiera, un competidor sin nada
          leído se quedaría sin nombre y sin el botón de revisarlo. */}
      <section className="spy-ficha">
        {/* ⚠️ SU FOTO REAL, NO LA CARICATURA (Martín, 4/11, con Sofía Contreras): en la lista va la caricatura —se reconoce
            de un vistazo y es la cara de la tab—; acá, abierta su ficha, va la foto de su perfil, que es la persona. */}
        <div className="spy-ficha__quien">
          {c.avatar && (
            // eslint-disable-next-line @next/next/no-img-element -- está en nuestro bucket, no pasa por el optimizador
            <img className="spy-ficha__foto" src={c.avatar} alt="" onError={(e) => { e.currentTarget.remove(); }} />
          )}
          <div>
            {anteTitulo && <small>{anteTitulo}</small>}
            <h1>{c.nombre}</h1>
          </div>
        </div>
        {identidad && <small className="spy-rango">{identidad}</small>}
        <div className="spy-ficha__acciones" data-recorrido="spy-acciones">
          {/* «Revisar ahora» se fue (Martín, 4/11): se revisa una vez, solo, y lo nuevo entra en segundo plano. */}
          <Dropdown
            ariaLabel="Más acciones"
            value=""
            width={40}
            menuMinAncho={210}
            align="right"
            resetAfterSelect
            sinFlecha
            botonLabel={<span aria-hidden>⋯</span>}
            options={[
              { value: 'canal', label: 'Agregar un canal' },
              { value: 'anuncio', label: 'Guardar un anuncio' },
              // Mismo criterio que el botón de la lista: borrar es del admin, y lo
              // que no se puede hacer no se ofrece.
              ...(puedeBorrar ? [{ value: 'quitar', label: 'Dejar de mirarlo' }] : []),
            ]}
            onChange={(v) => {
              // ⚠️ «Qué vende y qué ataca» se fue el 4/11/2026: la oferta la lee sola la IA del negocio con
              // cada lectura (/api/competitor-spy/analizar). Martín: «sin pedirlo».
              if (v === 'canal') { abrirCanal(null); return; }
              setErrorModal(null);
              setModal(v as 'anuncio' | 'quitar');
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

      {flujo.length > 0 && <RielAnalisis piezas={flujo} c={c} />}
      <MejoresPiezas piezas={flujo} onAbrir={(p) => setAbierta({ p, todas: piezas.filter((x) => grupoDe(x) === grupoDe(p)) })} />
    </aside>
  ) : null;

  return (
    <main className="spy" data-spy>
      <style>{CSS}</style>
      <BrandDefs />

      {/* ── Zona 0: la barra de arriba. ⚠️ SOLO EN LA LISTA. Antes estaba siempre, y en la ficha de
           un competidor era una banda entera para una acción que ahí no se usa. En la referencia (fitlo)
           la ficha no tiene ninguna banda de cabecera — tiene una miga de 18 px.
           ⚠️ BUSCA ENTRE LOS QUE YA SE MIRAN, NO GUARDA NADA. Antes, Enter acá daba de alta sin mostrar
           quién era, que es justo lo que Martín pidió que no pase («súper importante que lo valides»). ── */}
      {!c && (
      <div className="spy-barra">
        <button type="button" className="spy-marca" onClick={() => irA(null)}>
          <Icon name="spy" size={18} /><span>Competitor Spy</span>
        </button>
        <button type="button" className="spy-campo" aria-label="Buscar a quién mirar" aria-haspopup="dialog" onClick={() => abrirAlta()}>
          <Icon name="search" size={14} />
          <span className="spy-campo__texto">Nombre, @, canal de YouTube o sitio</span>
          <span className="spy-kbd" aria-hidden>/</span>
        </button>
        <button type="button" className="spy-mas" aria-label="Mirar a alguien más" title="Mirar a alguien más" onClick={() => abrirAlta()}>
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
            botones={<button type="button" className="spy-boton spy-boton-primario" onClick={() => abrirAlta()}>Buscar a alguien</button>}
          >
            <p>Busca a alguien de tu nicho por su nombre, su @, su canal o su sitio: lo leemos ahora.</p>
          </Vacio>
        )}

        {!c && competidores.length > 0 && <RejillaCompetidores competidores={competidores} resumen={resumen} onAbrir={irA} onBorrar={setABorrar} puedeBorrar={puedeBorrar} />}
        {!c && <RejillaSugeridos sugeridos={sugeridos} ocupado={ocupado} onSumar={(x) => { void sumarSugerido(x); }} />}

        {/* ── MIENTRAS LEE Y ORDENA, NADA MÁS EN PANTALLA (punto 14 del 4/11): ni la miga, ni las pestañas, ni sus redes.
             Primero la criatura sola, después la animación, y recién al terminar el resto. ── */}
        {c && ordenando?.id === c.id && <PeliculaDeOrden nombre={c.nombre} piezas={ordenando.piezas} onTerminar={() => setOrdenando(null)} />}

        {c && ordenando?.id !== c.id && (
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
            {/* ── VOLVER, A LA VISTA (Martín, 4/11/2026: «no queda claro como volver para atrás a todos los competidores, rediseña esa
                 parte»). Era una miga de 18 px en gris. Ahora es un botón de verdad, con la flecha y las caras de los demás —se lee
                 «a todos tus competidores» sin texto de más—, y al lado el cambio directo a otro. Copiado del «←» de la cabecera de un
                 ítem en Shopify y Linear: la vuelta es lo primero de la izquierda. ── */}
            <nav className="spy-volver" aria-label="Dónde estás">
              <span className="spy-volver__grupo" data-recorrido="spy-volver">
              <button type="button" className="spy-volver__atras" onClick={() => irA(null)}>
                <Flecha a="izquierda" size={18} />
                <span>Competidores</span>
                {competidores.length > 1 && (
                  <span className="spy-volver__caras" aria-hidden>
                    {competidores.filter((x) => x.id !== c.id).slice(0, 4).map((x) => {
                      const cara = caraDeTarjeta(x, caricaturaDeCompetidor(x));
                      return (
                        <span key={x.id}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- está en nuestro bucket o en /public */}
                          {cara ? <img src={cara} alt="" onError={(e) => { caerAFoto(e.currentTarget, x.avatar); }} /> : inicial(x.nombre)}
                        </span>
                      );
                    })}
                  </span>
                )}
              </button>
              {competidores.length > 1 && (
                <Dropdown
                  ariaLabel="Cambiar de competidor"
                  value={String(c.id)}
                  width={280}
                  options={competidores.map((x) => ({ value: String(x.id), label: nombreDeTarjeta(x) }))}
                  onChange={(v) => irA(Number(v))}
                  buttonStyle={{ height: 40, borderRadius: 99, padding: '0 14px', fontSize: 'var(--fs-sm)', fontWeight: 600, maxWidth: 320 }}
                />
              )}
              </span>
              {/* Sus otras redes, en la MISMA fila: una pastilla por canal, sin empujar el contenido (ver `.spy-redes`). */}
              <OtrasRedes
                b={redes[c.id]} ocupado={ocupado}
                onSi={(k) => void confirmarRed(k)}
                onNo={(k) => quitarDeLasRedes(c.id, (x) => x.red === k.red && x.ref === k.ref)}
                onDeshacer={(k) => void deshacerRed(k)}
              />
              {/* El recorrido de lo nuevo (recorrido-spy.ts): sale solo la primera vez, y se vuelve a ver con el «?». */}
              <span className="spy-volver__ayuda"><BotonRecorrido onClick={recorrido.reabrir} objetivo="spy-recorrido" /></span>
            </nav>

            {/* Lo que falló al apretar algo se dice acá. El vacío «no pude» ya lo trae entre sus motivos. */}
            {error && !(activa === 'contenido' && estado === 'no-pudo') && <p className="spy-aviso spy-error">{error}</p>}

            {/* ── Pestañas de la referencia: 42 px, subrayado del acento y el conteo en una badge.
                 Vuelven a tener fila propia —la vuelta anterior las había metido entre los chips de
                 filtro para ganar un renglón, y ahí dejaban de leerse como pestañas. El renglón se
                 recupera por otro lado: el análisis ya no está arriba de las piezas. ── */}
            {pestanas.length > 1 && (
              <nav className="spy-pestanas" role="tablist">
                {pestanas.map((p) => (
                  <button key={p.key} type="button" role="tab" aria-selected={activa === p.key} className="spy-pestana" data-activa={activa === p.key} data-recorrido={`spy-tab-${p.key}`} onClick={() => setPestana(p.key)}>
                    {p.rotulo}{p.n != null && <span className="spy-badge">{p.n}</span>}
                  </button>
                ))}
              </nav>
            )}

            {activa === 'contenido' && (
              <>
                {/* ── Arriba, las dos columnas: el gráfico y sus formatos a la izquierda, el riel a la derecha (que termina con «Lo que
                     mejor le fue», estirado hasta donde terminan los formatos). Abajo, a todo el ancho, todas sus piezas por páginas. ── */}
                <div className="spy-cols">
                  <div className="spy-cols__izq">
                    {/* El gráfico: el detalle de cada competidor (punto 7 del 4/11/2026, lib/spy-detalle.ts). */}
                    {(flujo.length > 0 || anuncios.length > 0) && (
                      <GraficoSpy
                        c={c} piezas={piezas} analizando={autoAnalisis === c.id}
                        onAbrir={(p) => setAbierta({ p, todas: piezas.filter((x) => grupoDe(x) === grupoDe(p)) })}
                        onAgregarRed={(red) => abrirCanal(red)}
                        onWeb={() => setPestana('funnel')}
                      />
                    )}

                    {/* ── Un solo estado para toda la zona, jamás uno por canal. Con piezas, la grilla de abajo. ── */}
                    {estado === 'cargando' && !contenido.length && <Esqueleto leyendo={estaLeyendo} />}
                    {estado === 'sin-canales' && (
                      <Vacio titulo={`Dime dónde mirar a ${c.nombre}`} botones={<button type="button" className="spy-boton spy-boton-primario" onClick={() => abrirCanal(null)}>Agregar un canal</button>}>
                        <p>Su @, su canal de YouTube o su sitio.</p>
                      </Vacio>
                    )}
                    {estado === 'leido-sin-nada' && (
                      <Vacio titulo={`No encontré publicaciones de ${c.nombre}`}>
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

                  {riel}
                </div>

                {contenido.length > 0 && (
                  <GrillaPiezas
                    piezas={visibles}
                    reinicio={`${c.id}|${buscar}|${tipo}|${orden}`}
                    tarjeta={(p) => (
                      <TarjetaPieza p={p} analizando={autoAnalisis === c.id && !p.analisis && p.canal !== 'anuncios'}
                        onAbrir={() => setAbierta({ p, todas: p.canal === 'anuncios' ? anuncios : piezas.filter((x) => grupoDe(x) === grupoDe(p)) })} />
                    )}
                    vacio={(
                      <Vacio titulo="Nada coincide" botones={<button type="button" className="spy-boton" onClick={() => { setBuscar(''); setTipo('todo'); }}>Ver todo</button>}>
                        <p>Ninguna de sus {contenido.length} piezas pasa esta búsqueda.</p>
                      </Vacio>
                    )}
                    cabecera={(
                      <>
                        <div className="spy-todas__titulo">
                          <h2>Todas sus piezas</h2>
                          {trayendoTodo === c.id && <span className="spy-trayendo" aria-live="polite"><i aria-hidden />Trayendo más</span>}
                        </div>
                        {trayendoTodo !== c.id && avisoTodo[c.id] && <p className="spy-aviso spy-aviso--suave" aria-live="polite">{avisoTodo[c.id]}</p>}
                        {/* La barra de herramientas de fitlo: campo ancho, el tipo (los anuncios son uno más) y el orden a la derecha. */}
                        <div className="spy-herramientas">
                          <label className="spy-buscar">
                            <Icon name="search" size={16} />
                            <input aria-label="Buscar en sus piezas" placeholder="Buscar en sus piezas" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
                          </label>
                          {/* ⚠️ UN DESPLEGABLE DE TIPOS EN VEZ DE CHIPS (4/11/2026). La red que falta se agrega desde acá: elegirla abre el
                              buscador de esa red. */}
                          <Dropdown
                            ariaLabel="Qué ver"
                            value={tipo}
                            width={250}
                            buttonStyle={{ height: 38, borderRadius: 99, fontSize: 'var(--fs-sm)', fontWeight: 600 }}
                            options={opcionesTipo.map((o) => ({ ...o, icono: ICONO_TIPO[o.value] }))}
                            onChange={(v) => {
                              if (v === 'agregar-instagram' || v === 'agregar-youtube') { abrirCanal(v === 'agregar-youtube' ? 'youtube' : 'instagram'); return; }
                              setTipo(v as TipoContenido);
                            }}
                          />
                          <div className="spy-orden">
                            <Dropdown
                              ariaLabel="Ordenar"
                              value={orden}
                              width={200}
                              align="right"
                              buttonStyle={{ height: 38, borderRadius: 99, fontSize: 'var(--fs-sm)', fontWeight: 600 }}
                              options={[...ORDENES]}
                              onChange={(v) => setOrden(v as OrdenSpy)}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  />
                )}
              </>
            )}

            {/* ⚠️ EL ORDEN ES EL PEDIDO (Martín, 4/11): «la oferta debería ir arriba... Y no pongas nada abajo de las web, porque abajo
                no se verá más nada». Arriba su funnel y su oferta; las notas; y AL FINAL sus páginas, sin nada debajo. */}
            {activa === 'funnel' && (
              <div className="spy-funnel-tab">
                <div className="spy-funnel-arriba">
                  <SuFunnelTipo
                    lectura={lecturaFunnel} hayFuentes={fuentesFunnel.length > 0} filasDeSuWeb={filasDeSuWeb}
                    enlaceAnuncios={enlaceSusAnuncios(c)} onVerPieza={verPieza} onVerPagina={verPagina}
                  />
                  <SuOferta vista={ofertaDe} datos={c.oferta} nombre={c.nombre} onConectado={() => void pedirOferta(c.id)} parte="cabeza" />
                </div>
                <SuOferta vista={ofertaDe} datos={c.oferta} nombre={c.nombre} onConectado={() => void pedirOferta(c.id)} parte="detalle" />
                {estaLeyendo && !susPaginas.length
                  ? <Esqueleto leyendo />
                  : (
                    <SusPaginas competidorId={c.id}
                      enlaces={susPaginas} titulos={titulosDePaginas} elegida={paginaElegida}
                      onElegir={setPaginaElegida} conVistaPrevia={conVistaPrevia}
                    />
                  )}
              </div>
            )}

          </>
        )}
      </div>

      {/* Sólo con una ficha abierta: en la lista no hay qué señalar. Un paso sin su objetivo en pantalla se saltea solo. */}
      {c && <Recorrido id={RECORRIDO_SPY} pasos={PASOS_SPY} abierto={recorridoAbierto} onCerrar={recorrido.onCerrar} />}
      {abierta && c && (
        <DetallePieza
          p={piezas.find((x) => x.id === abierta.p.id) ?? abierta.p} nombre={c.nombre} todas={abierta.todas}
          cara={c.avatar}
          seguidores={abierta.p.canal === 'youtube'
            ? (c.youtube_suscriptores != null ? `${dibujarContador(c.youtube_suscriptores)} suscriptores` : null)
            : (c.instagram_seguidores != null ? `${dibujarContador(c.instagram_seguidores)} seguidores` : null)}
          analizando={autoAnalisis === c.id} onCerrar={() => setAbierta(null)}
        />
      )}
      {modal === 'alta' && (
        <BuscadorAlta
          textoInicial={textoAlta} competidores={competidores} ocupado={ocupado} error={errorModal}
          onClose={() => setModal(null)}
          onAgregar={(v, n, bio) => void alta(v, n, bio)}
          onAbrir={(id) => { setModal(null); irA(id); }}
        />
      )}
      {/* «Agregar su YouTube» es el MISMO buscador de siempre, con su nombre ya escrito y sólo esa red (Martín, 4/11/2026: «Debe ser
          el mismo de siempre para buscar su YouTube, este ni siquiera tiene la funcionalidad de búsqueda»). */}
      {modal === 'canal' && c && (
        <BuscadorAlta
          para={{ nombre: c.nombre, red: redCanal }} competidores={competidores} ocupado={ocupado} error={errorModal}
          onClose={() => setModal(null)}
          onAgregar={(v) => void sumarCanal(v)}
          onAbrir={(id) => { setModal(null); irA(id); }}
        />
      )}
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
