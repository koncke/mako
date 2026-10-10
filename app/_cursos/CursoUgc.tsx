'use client';

/**
 * EL DIBUJO de un curso con el diseño de Conocimientos: barra oscura con los módulos,
 * buscador arriba, índice (portada + tarjetas de módulos), grilla de clases y lección
 * (video a la izquierda, papel a la derecha). Es la pantalla que se replicó del origen de
 * Avatar Hype (scripts/ah-html) y que hoy pinta todos los cursos de /conocimientos.
 *
 * NO SABE DE DÓNDE SALE EL CURSO. Recibe un modelo neutral (./tipos.ts) y HUECOS de render:
 * qué va en el reproductor, qué va en el papel, qué va abajo. Lo montan, cada una con su
 * adaptador:
 *   · app/compartido/curso/[token]/PortalAlumno.tsx   el portal del alumno: el reproductor
 *                                                      medido y la tarea (07/10/2026)
 *   · app/customer-success/curso/CursoApp.tsx         la tab Curso: lo mismo + `edicion`
 *   · app/conocimientos/CursoConocimientos.tsx        los cursos de Conocimientos (el super admin
 *                                                      con `edicion`, y los links compartidos), con
 *                                                      el `key` de cada módulo por NOMBRE: los `#mod=`
 *                                                      que ya circulan lo llevan (08/10/2026)
 *
 * (Hasta el 08/10/2026 Conocimientos tenía SU copia de este DOM, app/conocimientos/CursoReplica.tsx,
 * de donde salió este dibujo. Se borró al mudarse acá.)
 *
 * ⚠️ «Dos componentes para la misma pantalla» es el error que esto viene a cerrar: pasó con
 *    CursoPortal y CursoReplica, y lo que se agregaba a uno no aparecía en el otro. Si una
 *    pantalla necesita algo que este dibujo no tiene, se le agrega ACÁ como hueco o como
 *    prop — nunca se copia el DOM a otro archivo.
 *
 * El molde, que exige la hoja del origen:
 *
 *   .ahdoc > .ugc > .ugc-shell
 *     aside.ugc-side   marca, salida, Inicio, Recursos, entradas propias, MÓDULOS
 *     .ugc-main
 *       .ugc-topbar    buscador + el curso
 *       .ugc-arriba    (opcional) lo fijo de la pantalla: un selector, un saludo
 *       .ugc-content   índice, grilla o lección — lo único que scrollea (en la lección, cada
 *                      columna scrollea la suya, salvo con `unSoloScroll`: ver ./tipos.ts)
 *
 * ⚠️ NADA DE CARACTERES DE 3 BYTES EN EL TEXTO DE ESTE ARCHIVO (flechas, puntos
 *    suspensivos, tildes de check). Un reemplazo hecho con PowerShell rompió una vez la
 *    codificación de CursoReplica y los caracteres de 3 bytes quedaron como rombos negros en
 *    pantalla: compilaba, y ni el typecheck ni los tests lo vieron. Van como escape
 *    (`'←'`) o como entidad (`&rarr;`). Lo fija tests/cursos-ugc.test.ts.
 *
 * La navegación es la de siempre: TODA la posición vive en el hash y su único dueño es
 * app/conocimientos/posicion.ts (`#curso=&mod=<key>&q=&v=recursos&clase=<id>&r=&x=<extra>`).
 */

import { Fragment, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { usePosicion, type Posicion } from '@/app/conocimientos/posicion';
import { Miniatura } from '@/app/conocimientos/Miniatura';
import { PortadaModulo } from '@/app/conocimientos/PortadaModulo';
// Las láminas diseñadas (item 5) y el arrastre (item 7): ver sus cabeceras.
import { Lamina, conChipDeNumero } from './laminas';
import { useArrastreCurso, type ArrastreCurso } from './arrastre-curso';
import type { ControlMenuUgc } from './tipos';
import type { ClaseUgc, CursoUgcProps, DisposicionUgc, EdicionUgc, LeccionUgc, ModuloUgc, PortadaUgc, TextosUgc, TonoChip } from './tipos';
import { CSS_UGC } from './estilos';
import { varsDeAcento } from '@/lib/curso-estilo';
// La fuente del curso (item 3 del 08/10/2026): las variables que pinta y la hoja que la trae.
import { varsDeFuente } from './fuentes';
import { useHojasDeFuentes } from './SelectorFuente';
import {
  OPCIONES_DISPOSICION, TEXTOS_DEFAULT, abrible, claseDelSplit, clasesVisibles, moduloMarcado, pctAvance, puedeMoverPorPosicion,
  rotuloGrilla, textoBarraModulo, textoTarjetaModulo, vecinas,
} from './reglas';

const FLECHA_IZQ = '\u2190';
const FLECHA_DER = '\u2192';

/**
 * Carga la hoja del origen y avisa CUANDO ESTÁ. Las dos mitades importan.
 *
 * ⚠️ Sin esperar el `load` hay varios segundos de contenido crudo apilado. Medido a 1440x900
 *    con la caché apagada: durante más de 4 s el shell renderiza con `display: block` y la
 *    barra queda en y=984 midiendo 120x984 — o sea, la pantalla se ve exactamente igual que
 *    cuando el CSS no matchea. Es el cuadro que el dueño reportó tres veces como «no se ve
 *    nada». Una pantalla a medio vestir y una rota son indistinguibles desde afuera, así que
 *    se prefiere no mostrar nada.
 *
 * El `load` se engancha aunque el <link> ya exista de una visita anterior: en ese caso
 * `sheet` ya está y se contesta al toque, sin esperar un evento que no va a volver.
 */
export function useCssUgc() {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    const ya = document.getElementById('ahdoc-css') as HTMLLinkElement | null;
    if (ya) { if (ya.sheet) { setListo(true); return; } ya.addEventListener('load', () => setListo(true), { once: true }); return; }
    const l = document.createElement('link');
    l.id = 'ahdoc-css';
    l.rel = 'stylesheet';
    l.href = '/cono-doc/ugc.css';
    l.addEventListener('load', () => setListo(true), { once: true });
    // Si la hoja no carga, el curso sin estilo es mejor que nada: el material sigue siendo
    // legible. Lo que no puede pasar es quedarse en blanco.
    l.addEventListener('error', () => setListo(true), { once: true });
    document.head.appendChild(l);
  }, []);
  return listo;
}

export type { TonoChip } from './tipos';

/**
 * Un chip de la tarjeta de una clase (o de donde haga falta): el estado de la tarea, el %
 * visto. Es UNA pieza para que el alumno y quien dicta vean el mismo chip; el texto lo trae
 * el adaptador desde las reglas de lib/curso.ts (`ROTULO_TAREA`, `ROTULO_SIN_MEDIR`), que es
 * donde se decide qué significa cada estado.
 */
export function ChipUgc({ tono = 'neutro', title, children }: { tono?: TonoChip; title?: string; children: ReactNode }) {
  return <span className={`ugc-chip ugc-chip--${tono}`} title={title}>{children}</span>;
}

/**
 * La cabecera de pestañas de un papel con VARIAS hojas. Controlada: quien la usa decide cuál está
 * abierta. La usa CursoReplica para las suyas, que llegan de a una por fetch, y la va a usar el papel
 * de Conocimientos cuando monte este dibujo. Una sola pieza: dos pantallas no pueden dibujar
 * pestañas distintas.
 *
 * ⚠️ La lección de un curso del equipo (portal y tab Curso) NO tiene pestañas desde el 08/10/2026
 *    (item 14): la descripción y la tarea van juntas en un papel (ver `LeccionUgc`).
 */
export function CabeceraPestanas({ nombres, activa, onCambiar, extra }: {
  nombres: string[];
  activa: string | null;
  onCambiar: (nombre: string) => void;
  /** A la derecha de las pestañas (el aviso de «Copiado»). */
  extra?: ReactNode;
}) {
  return (
    <div className="ugc-tabs">
      <div className="ugc-tablist" role="tablist" aria-label="Contenido de la leccion">
        {nombres.map((n) => (
          <button key={n} type="button" role="tab" aria-selected={activa === n}
            className={`ugc-tab${activa === n ? ' on' : ''}`} onClick={() => onCambiar(n)}>{n}</button>
        ))}
      </div>
      {extra}
    </div>
  );
}

const IconoCandado = () => (
  <svg className="ugc-ico" width="12" height="12" viewBox="0 0 16 16" aria-hidden focusable="false">
    <rect x="3" y="7" width="10" height="7.5" rx="1.6" fill="currentColor" />
    <path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" fill="none" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);
const IconoCheck = () => (
  <svg className="ugc-ico" width="12" height="12" viewBox="0 0 16 16" aria-hidden focusable="false">
    <path d="M3.2 8.6l3.1 3L12.8 4.6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * La clase de estado de un módulo, para la barra y la tarjeta. Vacía sin estado (Conocimientos). Lleva
 * también `is-atenuado`: lo oculto que sólo ve el super admin (`ModuloUgc.atenuado`).
 */
const claseEstado = (m: ModuloUgc) => `${m.estado ? ` is-${m.estado}` : ''}${m.atenuado ? ' is-atenuado' : ''}`;

function BarraAvance({ p, className }: { p: { hechas: number; total: number }; className: string }) {
  return (
    <span className={className}>
      <span className="ugc-prog-track" role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.hechas}>
        <span className="ugc-prog-fill" style={{ width: `${pctAvance(p)}%` }} />
      </span>
      <span className="n">{p.hechas}/{p.total}</span>
    </span>
  );
}

export default function CursoUgc(props: CursoUgcProps) {
  const {
    titulo, subtitulo, marca, modulos, clases, portada, leccion, recursos, entradasExtra,
    edicion, arriba, pieBarra, onSalir, modo = 'pagina', acento, disposicion, fuente, unSoloScroll,
  } = props;
  const t: TextosUgc = useMemo(() => ({ ...TEXTOS_DEFAULT, ...props.textos }), [props.textos]);
  const cssListo = useCssUgc();
  // La hoja de la fuente elegida (la de siempre no carga nada). Antes del `return` de abajo: es un hook.
  useHojasDeFuentes([fuente]);
  const idNav = useId();

  /**
   * TODA la navegación sale de `usePosicion`, el dueño único de la URL. El porqué —tres
   * dueños de la misma dirección y `pushState` que no avisa— está en posicion.ts.
   *
   * El CURSO viaja adentro de la posición, así que cada paso lo conserva: sin esto, abrir
   * una clase te sacaría del curso.
   */
  const { pos, ir: irPos } = usePosicion();
  /** El menú de módulos del TELÉFONO (en escritorio la barra está siempre a la vista). */
  const [menu, setMenu] = useState(false);
  /** El desplegable de la MARCA (`marca.menu`): cambiar de producto, el color. */
  const [marcaAbierta, setMarcaAbierta] = useState(false);
  const marcaRef = useRef<HTMLButtonElement>(null);
  const idMenuMarca = useId();
  const ir = (v: Posicion, o?: { reemplazar?: boolean }) => {
    setMenu(false);
    irPos({ curso: pos.curso, ...v }, o?.reemplazar ? 'reemplazar' : 'empujar');
  };

  /**
   * ⚠️ EL BUSCADOR SÍ ES ESTADO LOCAL, y a propósito: se escribe letra por letra, y empujar
   *    una entrada por tecla haría que salir de una búsqueda de 12 letras cueste 12 clicks
   *    en el Atrás. Lo que va a la URL es la búsqueda ya hecha, con `reemplazar`.
   */
  const [q, setQ] = useState(pos.q ?? '');
  useEffect(() => { setQ(pos.q ?? ''); }, [pos.q]);

  // Sale de la URL, no de `useState`: es una POSICIÓN, y tiene que sobrevivir al Atrás.
  const mod = pos.mod ?? null;
  const filtradas = useMemo(() => clasesVisibles(clases, modulos, mod, q), [clases, modulos, mod, q]);

  // ── El editor de la ESTRUCTURA (items 6, 7 y 12): el menú «…» y el arrastre ──
  /** El desplegable «…» abierto: de qué módulo o clase, y de qué botón cuelga. */
  const [opciones, setOpciones] = useState<
    { tipo: 'modulo'; key: string; ancla: HTMLElement } | { tipo: 'clase'; id: number; ancla: HTMLElement } | null
  >(null);
  const idOpciones = useId();
  /** Los módulos que se pueden mover, en el orden en que se dibujan: los que no armó la pantalla. */
  const movibles = useMemo(() => modulos.filter((m) => !m.sinEdicion).map((m) => m.key), [modulos]);
  const arr = useArrastreCurso({
    modulos: movibles,
    clasesDe: (k) => clases.filter((c) => c.moduloKey === k).map((c) => c.id),
    recibeClases: (k) => modulos.some((m) => m.key === k && !m.sinEdicion),
    onOrdenarModulos: edicion?.onOrdenarModulos,
    onLlevarClase: edicion?.onLlevarClase,
  });

  // El menú del teléfono se cierra con Escape: es un desplegable, y uno que sólo se cierra
  // tocando el botón que lo abrió es una trampa para el teclado.
  useEffect(() => {
    if (!menu) return;
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, [menu]);

  // Hasta que la hoja del origen esté, el curso NO se dibuja: ver `useCssUgc`.
  if (!cssListo) {
    return (
      <div style={{ minHeight: modo === 'embebido' ? 240 : '60vh', display: 'grid', placeItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{titulo}</span>
        <span style={{ opacity: 0.6, fontSize: 13 }}>{'Abriendo el curso\u2026'}</span>
      </div>
    );
  }

  /**
   * ⚠️ ABRIR UNA CLASE CONSERVA EL LUGAR DEL QUE SALISTE (el bug que reportó Martín). Con
   *    el módulo o la búsqueda adentro de la posición de la clase, el Atrás devuelve
   *    exactamente ahí: `#mod=M7&clase=12` → Atrás → `#mod=M7`.
   */
  const contexto = { mod: pos.mod, q: pos.q };
  const abrirClase = (id: number) => ir({ ...contexto, clase: id });
  /** El «Volver» de una clase: al listado del que salió, no al índice pelado. */
  const volverAlListado = () => ir(contexto);

  const clase = pos.clase ? clases.find((c) => c.id === pos.clase) : undefined;
  const extra = !clase && pos.extra ? entradasExtra?.find((e) => e.key === pos.extra) : undefined;
  const marcado = moduloMarcado(clase, mod);
  const modulo = (key: string | null | undefined) => (key ? modulos.find((m) => m.key === key) : undefined);
  const puede = (id: number, dir: 'arriba' | 'abajo') =>
    (edicion?.puedeMover ? edicion.puedeMover(id, dir) : puedeMoverPorPosicion(clases, id, dir));

  // El menú «…»: el botón y el desplegable son del dibujo; lo de adentro lo arma la pantalla.
  const abrirOpciones = (o: { tipo: 'modulo'; key: string } | { tipo: 'clase'; id: number }, ancla: HTMLElement) =>
    setOpciones((a) => (a && a.ancla === ancla ? null : { ...o, ancla }));
  const cerrarOpciones = () => setOpciones(null);
  const mOpc = opciones?.tipo === 'modulo' ? modulo(opciones.key) : undefined;
  const cOpc = opciones?.tipo === 'clase' ? clases.find((c) => c.id === opciones.id) : undefined;
  const ctlOpc: ControlMenuUgc = {
    cerrar: cerrarOpciones,
    ancla: opciones?.ancla ?? null,
    // Renombrar desde el menú pone a editar el MISMO texto que se edita con un clic (en la tarjeta del
    // índice o en la cabecera del módulo abierto: nunca están los dos a la vez).
    renombrar: mOpc && edicion?.onTexto && !mOpc.sinEdicion ? () => { cerrarOpciones(); enfocarTexto(`modulo:${mOpc.key}`); } : undefined,
  };
  const contenidoOpciones = mOpc && edicion?.menuModulo ? edicion.menuModulo(mOpc, ctlOpc)
    : cOpc && edicion?.menuClase ? edicion.menuClase(cOpc, ctlOpc) : null;
  /** Lo que el índice y la grilla necesitan del editor de la estructura. */
  const estructura: Estructura = { arr, abrirOpciones, conMenuModulo: !!edicion?.menuModulo, conMenuClase: !!edicion?.menuClase };

  return (
    // `ahdoc--ugc` acota lo propio de este dibujo (./estilos.ts): CursoReplica comparte la hoja
    // del origen y no tiene, por ejemplo, el menú del teléfono. `ahdoc--un-scroll`: la lección con un
    // solo scroll (`unSoloScroll`, ./tipos.ts), la vista del alumno.
    <div className={`ahdoc ahdoc--ugc${modo === 'embebido' ? ' ahdoc--embebido' : ''}${unSoloScroll ? ' ahdoc--un-scroll' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS_UGC }} />
      <div className="paper-bg" aria-hidden />
      <div className="grain" aria-hidden />
      {/* El acento y la fuente van en `.ugc` y no acá: ver `varsDeAcento` (lib/curso-estilo.ts) y
          `varsDeFuente` (./fuentes.ts). Sin ninguno de los dos elegido, sin `style`. */}
      <div className="ugc" style={(acento || fuente ? { ...varsDeAcento(acento), ...varsDeFuente(fuente) } : undefined) as CSSProperties | undefined}>
        <div className="ugc-shell">
          <aside className={`ugc-side${menu ? ' ugc-side--abierta' : ''}`} aria-label="Navegacion del curso">
            {/* ⚠️ LA MARCA ES UN BOTÓN sólo si hay a dónde ir. Es donde todo el mundo hace
                click para volver al principio; pero en un share de UN curso no hay nada
                arriba, y un botón que no lleva a ningún lado promete una salida que no está.
                Ahí queda como rótulo. El corte de color es el de la casa: `resaltado` en lima. */}
            {marca.menu ? (
              // ⚠️ CON `menu` LA MARCA ES UN DESPLEGABLE (cambiar de producto, el color): pedido de
              //    Martín al sacar la barra de arriba de la tab Curso, «el desplegable debería ser
              //    "Negocio que Escala" de la sidebar, que tiene parte en verde» (07/10/2026).
              <button ref={marcaRef} type="button" className="ugc-side-brand ugc-side-brand-btn ugc-side-brand--menu" data-recorrido="marca"
                aria-expanded={marcaAbierta} aria-controls={idMenuMarca} onClick={() => setMarcaAbierta((v) => !v)}
                aria-label={marca.ariaLabel ?? `${marca.texto}${marca.resaltado ?? ''}`}>
                <span className="ugc-side-name">{marca.texto}{marca.resaltado != null && <span>{marca.resaltado}</span>}</span>
                <span className="ugc-side-brand-chev" aria-hidden>&#9662;</span>
              </button>
            ) : marca.onClick ? (
              <button type="button" className="ugc-side-brand ugc-side-brand-btn" data-recorrido="marca"
                onClick={marca.onClick} aria-label={marca.ariaLabel ?? `${marca.texto}${marca.resaltado ?? ''}`}>
                <span className="ugc-side-name">{marca.texto}{marca.resaltado != null && <span>{marca.resaltado}</span>}</span>
              </button>
            ) : (
              <div className="ugc-side-brand" data-recorrido="marca">
                <span className="ugc-side-name">{marca.texto}{marca.resaltado != null && <span>{marca.resaltado}</span>}</span>
              </div>
            )}
            {/* El botón que abre la lista en el TELÉFONO. En escritorio no se dibuja (CSS):
                ahí la barra entera está a la vista. Ver la cola de scripts/avatarhype-css.mjs. */}
            <button type="button" className="ugc-side-menu" aria-expanded={menu} aria-controls={idNav}
              onClick={() => setMenu((v) => !v)}>
              <span>{t.menu}</span>
              <span className="ugc-side-menu-chev" aria-hidden>&#9662;</span>
            </button>
            {/*
              ⚠️ UN SOLO BOTÓN DE SALIDA, y cambia según dónde estés: fuera de una clase lleva
                 al nivel de arriba; adentro, al listado del que saliste. Dos salidas en dos
                 lugares para la misma intención hacían que el ojo no supiera dónde buscar.
            */}
            {clase ? (
              <button type="button" className="ugc-side-exit" onClick={volverAlListado}>
                <span className="ugc-side-exit-label">{FLECHA_IZQ} {t.todasLasClases}</span>
              </button>
            ) : onSalir && (
              <button type="button" className="ugc-side-exit" onClick={onSalir}>
                <span className="ugc-side-exit-label">{FLECHA_IZQ} {t.salir}</span>
              </button>
            )}
            {/* La barra es una ZONA del arrastre (./arrastre-curso.ts): un módulo se reordena acá
                también, y una clase soltada sobre un módulo se muda a ése. */}
            <nav className="ugc-nav" id={idNav} data-recorrido="barra-modulos" {...arr.zona('barra')}>
              {/* El `!q` no sobra: sin él, «Inicio» seguía marcado mientras un módulo
                  filtraba, y quedaban DOS renglones en lima. Una barra que marca dos lugares
                  a la vez dice menos que ninguna. */}
              <button type="button" className={`ugc-nav-item${!clase && !pos.recursos && !extra && !q && !mod ? ' on' : ''}`}
                onClick={() => ir({})}>
                <span className="ugc-nav-label">{t.inicio}</span>
              </button>
              {recursos && recursos.cuantos > 0 && (
                <button type="button" className={`ugc-nav-item${pos.recursos ? ' on' : ''}`}
                  onClick={() => ir({ recursos: true })}>
                  <span className="ugc-nav-label">{t.recursos}</span>
                  <span className="ugc-nav-count">{recursos.cuantos}</span>
                </button>
              )}
              {entradasExtra?.map((e) => (
                <button key={e.key} type="button" className={`ugc-nav-item${extra?.key === e.key ? ' on' : ''}`}
                  onClick={() => ir({ extra: e.key })}>
                  <span className="ugc-nav-label">{e.nombre}</span>
                  {e.cuenta != null && <span className="ugc-nav-count">{e.cuenta}</span>}
                </button>
              ))}
              <div className="ugc-nav-h">{t.modulos}</div>
              {modulos.map((m) => {
                const bloqueado = !abrible(m);
                // Se arrastra sólo con `onOrdenarModulos` (quien edita) y si existe como módulo.
                const movible = !!edicion?.onOrdenarModulos && !m.sinEdicion && !bloqueado;
                const iMov = movibles.indexOf(m.key);
                return (
                  <Fragment key={m.key}>
                    {iMov >= 0 && arr.huecoEn('barra', iMov) && <div className="ugc-hueco ugc-hueco--fila" aria-hidden />}
                    <button type="button"
                      className={`ugc-nav-item${marcado === m.key ? ' on' : ''}${claseEstado(m)}${movible ? ' ugc-arrastrable' : ''}${arr.esDestino(m.key) ? ' is-destino' : ''}`}
                      onClick={bloqueado ? undefined : () => ir({ mod: m.key })}
                      disabled={bloqueado || undefined}
                      title={bloqueado ? `${m.nombre}. ${m.motivo ?? t.bloqueada}` : m.nombre}
                      data-arr={movible ? m.key : undefined}
                      data-arr-modulo={m.key}
                      draggable={movible || undefined}
                      onPointerDownCapture={movible ? arr.marcarOrigen : undefined}
                      onDragStart={movible ? (e) => arr.agarrar(e, { tipo: 'modulo', key: m.key }) : undefined}
                      onDragEnd={movible ? arr.terminar : undefined}>
                      <span className="ugc-nav-num">{m.n}</span>
                      <span className="ugc-nav-label">{m.nombre}</span>
                      {bloqueado
                        ? <span className="ugc-nav-count ugc-nav-candado"><IconoCandado /></span>
                        : <span className="ugc-nav-count">{textoBarraModulo(m)}</span>}
                    </button>
                    {/* «Al final» es después del último que se mueve, no después de «Sin módulo». */}
                    {iMov >= 0 && iMov === movibles.length - 1 && arr.huecoEn('barra', movibles.length) && <div className="ugc-hueco ugc-hueco--fila" aria-hidden />}
                  </Fragment>
                );
              })}
            </nav>
            {pieBarra != null && <div className="ugc-side-pie">{pieBarra}</div>}
          </aside>

          <div className="ugc-main">
            <div className="ugc-topbar">
              <div className="ugc-search">
                {/* Buscar te saca de donde estés y queda en la URL, pero REEMPLAZANDO. */}
                <input value={q} onChange={(e) => { setQ(e.target.value); ir({ q: e.target.value || undefined }, { reemplazar: true }); }}
                  placeholder={t.buscar} aria-label="Buscar en el curso" />
              </div>
              {props.topbarExtra != null && <div className="ugc-topbar-extra">{props.topbarExtra}</div>}
              {/* De QUÉ curso es esta pantalla: al otro extremo de la marca, donde se lee como
                  contexto y no como identidad. Pedido de Martín.
                  ⚠️ QUIEN EDITA VE SUS ACCIONES EN ESE LUGAR, no el nombre (item 14 del 08/10/2026: «Vista
                  de alumnos, invitar a alumno y ? deberían estar donde hoy está "Negocio que escala" 106
                  clases... el editor ve esos 3 botones»). El nombre ya lo tiene en la marca y en la
                  portada; el alumno (portal y vista previa) sigue viendo el nombre acá. */}
              {props.acciones != null ? (
                <div className="ugc-topbar-acciones">{props.acciones}</div>
              ) : (
                <div className="ugc-topbar-curso">
                  <span className="ugc-topbar-curso-t">{titulo}</span>
                  <span className="ugc-topbar-curso-n">{subtitulo ?? `${clases.length} ${t.clases}`}</span>
                </div>
              )}
            </div>
            {arriba != null && <div className="ugc-arriba">{arriba}</div>}

            <div className="ugc-content">
              {clase ? (
                <Leccion key={clase.id} clase={clase} l={leccion(clase)} nombreModulo={modulo(clase.moduloKey)?.nombre}
                  {...vecinas(clases, clase.id)} abrirClase={abrirClase} edicion={edicion} disposicion={disposicion} t={t}
                  opciones={estructura.conMenuClase ? (a) => abrirOpciones({ tipo: 'clase', id: clase.id }, a) : undefined} />
              ) : extra ? (
                <div className="ugc-extra">{extra.cuerpo}</div>
              ) : pos.recursos && recursos ? (
                recursos.render({ abierto: pos.r, abrir: (slug) => ir({ recursos: true, r: slug }), cerrar: () => ir({ recursos: true }) })
              ) : filtradas ? (
                <Grilla clases={filtradas} total={clases.length} mod={mod} modulo={modulo(mod)} t={t}
                  abrirClase={abrirClase} edicion={edicion} puede={puede} estructura={estructura} />
              ) : (
                <Indice portada={portada} clases={clases} modulos={modulos} t={t} edicion={edicion}
                  onAbrir={abrirClase} onModulo={(m) => ir({ mod: m.key })} estructura={estructura} />
              )}
            </div>
          </div>
        </div>
        {marcaAbierta && marca.menu && (
          <MenuMarca id={idMenuMarca} etiqueta={`${marca.texto}${marca.resaltado ?? ''}`} ancla={marcaRef.current} onCerrar={() => setMarcaAbierta(false)}>
            {marca.menu(() => setMarcaAbierta(false))}
          </MenuMarca>
        )}
        {opciones && contenidoOpciones != null && (
          <MenuMarca id={idOpciones} ancla={opciones.ancla} onCerrar={cerrarOpciones}
            etiqueta={`${t.opciones}: ${mOpc?.nombre ?? cOpc?.titulo ?? ''}`}>
            {contenidoOpciones}
          </MenuMarca>
        )}
      </div>
    </div>
  );
}

/**
 * El índice: la portada (por dónde empezar) y los módulos.
 *
 * ⚠️ NO va abajo una lista con TODAS las clases. Estaba, y contradecía a la barra: allí se
 *    veían 3 módulos y abajo aparecían las 30 clases sueltas, así que el curso parecía tener
 *    dos organizaciones a la vez. Un módulo se abre y muestra LAS SUYAS.
 */
function Indice({ portada, clases, modulos, t, edicion, onAbrir, onModulo, estructura }: {
  portada?: PortadaUgc; clases: ClaseUgc[]; modulos: ModuloUgc[]; t: TextosUgc; edicion?: EdicionUgc;
  onAbrir: (id: number) => void; onModulo: (m: ModuloUgc) => void; estructura: Estructura;
}) {
  const { arr } = estructura;
  /** Los que se mueven, en orden: el índice del hueco se cuenta sobre ésos (ver ./arrastre-curso.ts). */
  const movibles = modulos.filter((m) => !m.sinEdicion);
  const arrastra = !!edicion?.onOrdenarModulos;
  const destino = portada ? (clases.find((c) => c.id === portada.claseId) ?? clases[0]) : undefined;
  const editando = !!edicion && (!!edicion.onTexto || !!edicion.onPortada);
  // La tapa: la foto le gana al degradado (un degradado no puede 404ear; una foto sí, y entonces
  // `Miniatura` se retira y queda el fondo de la casa).
  const tapa = portada && (portada.tapa
    ? <Miniatura className="ugc-hero-img" src={portada.tapa} />
    : portada.fondo ? <span className="ugc-hero-img ugc-fondo" style={{ background: portada.fondo }} aria-hidden /> : null);
  return (
    <>
      {portada && destino && !editando && (
        <button
          type="button"
          className="ugc-hero"
          onClick={() => onAbrir(destino.id)}
          /* El rótulo se declara: con la descripción adentro, el nombre accesible del botón
             sería el párrafo entero. */
          aria-label={`Abrir ${destino.titulo}`}
        >
          {tapa}
          <span className="ugc-hero-shade" aria-hidden />
          <span className="ugc-hero-body">
            {portada.eyebrow !== undefined && <span className="ugc-hero-eyebrow">{portada.eyebrow}</span>}
            <span className="ugc-hero-title">{portada.titulo}</span>
            {portada.resumen && <span className="ugc-hero-resumen">{portada.resumen}</span>}
            {/* El botón es una PASTILLA con su acompañante: la clase a la que lleva. Así la
                fila dice a dónde vas antes de tocarla. */}
            <span className="ugc-hero-arranque">
              <span className="ugc-hero-cta">{t.empezar} <span aria-hidden>&rarr;</span></span>
              <span className="ugc-hero-primera">{destino.titulo}</span>
            </span>
            {portada.progreso && <BarraAvance p={portada.progreso} className="ugc-hero-prog" />}
          </span>
        </button>
      )}
      {portada && editando && (
        // ⚠️ EDITANDO, LA PORTADA NO ES UN BOTÓN: adentro hay textos que se editan con un clic, y
        //    un clic en un texto de un <button> abriría la clase. El único botón que lleva a la
        //    clase es la pastilla de «Empezar».
        // `data-recorrido`: los puntos que señala el recorrido de la pantalla (app/_ui/Recorrido.tsx).
        <div className="ugc-hero ugc-hero--edicion" data-recorrido="portada">
          {tapa}
          <span className="ugc-hero-shade" aria-hidden />
          <span className="ugc-hero-body">
            {portada.eyebrow !== undefined && <span className="ugc-hero-eyebrow">{portada.eyebrow}</span>}
            {edicion?.onTexto ? (
              <TextoEditable className="ugc-hero-title" valor={portada.titulo} etiqueta="Nombre del curso" recorrido="titulo"
                onGuardar={(v) => edicion.onTexto!({ tipo: 'curso-titulo' }, v)} />
            ) : <span className="ugc-hero-title">{portada.titulo}</span>}
            {edicion?.onTexto ? (
              <TextoEditable className="ugc-hero-resumen" valor={portada.resumen ?? ''} vacio={t.sinResumen} etiqueta="Descripción del curso"
                onGuardar={(v) => edicion.onTexto!({ tipo: 'curso-resumen' }, v)} />
            ) : portada.resumen && <span className="ugc-hero-resumen">{portada.resumen}</span>}
            {destino && (
              <button type="button" className="ugc-hero-arranque" onClick={() => onAbrir(destino.id)} aria-label={`Abrir ${destino.titulo}`}>
                <span className="ugc-hero-cta">{t.empezar} <span aria-hidden>&rarr;</span></span>
                <span className="ugc-hero-primera">{destino.titulo}</span>
              </button>
            )}
            {portada.progreso && <BarraAvance p={portada.progreso} className="ugc-hero-prog" />}
          </span>
          {edicion?.onPortada && (
            <button type="button" className="ugc-portada-btn" onClick={(e) => edicion.onPortada!({ tipo: 'curso' }, e.currentTarget)}>
              <IconoImagen /> {t.portada}
            </button>
          )}
        </div>
      )}
      <div className="ugc-rail-head"><h2>{t.losModulos}</h2></div>
      {/* El riel es una ZONA del arrastre (./arrastre-curso.ts): soltar un módulo acá lo reordena. */}
      <div className="ugc-rail" {...arr.zona('rail')}>
        {/* «+ Nuevo módulo» PRIMERO (item 12, «que aparezcan primero, no por último»). No entra en
            las medidas del arrastre (no lleva `data-arr`): el hueco 0 es el del primer MÓDULO. */}
        {edicion?.onNuevoModulo && (
          <NuevoModulo t={t} opcion={edicion.opcionNuevoModulo} tope={edicion.topeNombreModulo} ocupado={edicion.ocupado} onCrear={edicion.onNuevoModulo} />
        )}
        {modulos.map((m) => {
          const iMov = movibles.indexOf(m);
          const editable = !!edicion && !m.sinEdicion;
          const renombrar = edicion?.onTexto && !m.sinEdicion ? (v: string) => edicion.onTexto!({ tipo: 'modulo', key: m.key }, v) : undefined;
          return (
            <Fragment key={m.key}>
              {iMov >= 0 && arr.huecoEn('rail', iMov) && <Hueco alto={arr.alto} />}
              {editable ? (
                // ⚠️ LO QUE SE ARRASTRA ES EL ENVOLTORIO y la copia que sigue al cursor es la tarjeta
                //    (`data-arr-copia`): con el envoltorio, que no tiene fondo, la copia salía con un
                //    rectángulo gris detrás de las esquinas redondeadas.
                <div className={`ugc-editable${arrastra ? ' ugc-arrastrable' : ''}`}
                  data-arr={arrastra ? m.key : undefined} data-recorrido={iMov === 0 ? 'modulo' : undefined}
                  draggable={arrastra || undefined}
                  onPointerDownCapture={arrastra ? arr.marcarOrigen : undefined}
                  onDragStart={arrastra ? (e) => arr.agarrar(e, { tipo: 'modulo', key: m.key }) : undefined}
                  onDragEnd={arrastra ? arr.terminar : undefined}>
                  <TarjetaModulo m={m} t={t} onAbrir={() => onModulo(m)} renombrar={renombrar} />
                  {/* Los controles van AL LADO de la tarjeta (un botón adentro de otro no es HTML
                      válido) y no arrastran (`data-nodrag`). */}
                  {(edicion.onPortada || estructura.conMenuModulo) && (
                    <div className="ugc-editable-ctrls" role="group" aria-label={`${t.opciones} de ${m.nombre}`} data-nodrag>
                      {edicion.onPortada && (
                        <button type="button" className="ugc-editable-btn" title={t.portada} aria-label={`${t.portada} de ${m.nombre}`}
                          disabled={edicion.ocupado} onClick={(e) => edicion.onPortada!({ tipo: 'modulo', key: m.key }, e.currentTarget)}>
                          <IconoImagen />
                        </button>
                      )}
                      {estructura.conMenuModulo && (
                        <BotonOpciones t={t} nombre={m.nombre} recorrido={iMov === 0 ? 'menu-modulo' : undefined}
                          onAbrir={(a) => estructura.abrirOpciones({ tipo: 'modulo', key: m.key }, a)} />
                      )}
                    </div>
                  )}
                </div>
              ) : <TarjetaModulo m={m} t={t} onAbrir={() => onModulo(m)} />}
              {/* «Al final» es después del último que se mueve (no después de «Sin módulo»). */}
              {iMov >= 0 && iMov === movibles.length - 1 && arr.huecoEn('rail', movibles.length) && <Hueco alto={arr.alto} />}
            </Fragment>
          );
        })}
      </div>
    </>
  );
}

/**
 * La tarjeta de un módulo. Bloqueado: se DIBUJA (con candado y su cuenta de clases) y no se
 * abre. Esconderlo haría que el curso pareciera más corto de lo que es, y la persona no
 * sabría que falta algo por delante.
 */
function TarjetaModulo({ m, t, onAbrir, renombrar }: {
  m: ModuloUgc; t: TextosUgc; onAbrir: () => void;
  /** Editando: el NOMBRE se cambia con un clic en la tarjeta (item 6), y entonces la tarjeta no es un botón. */
  renombrar?: (v: string) => Promise<boolean>;
}) {
  const bloqueado = !abrible(m);
  const tapa = (
    <span className="ugc-modcard-cover">
      {/* ⚠️ LA LÁMINA VA SIEMPRE Y VA PRIMERA: `portada` puede ser una ruta construida y no
          comprobada. Si carga, la tapa la cubre entera; si da 404, la lámina ya estaba. La
          diseñada (`lamina`, item 5) va en el lugar del cuaderno de siempre. */}
      {m.lamina
        ? <Lamina diseno={m.lamina.diseno} n={m.n} rotulo={t.modulo} texto={m.lamina.texto} nombre={m.nombre} a={m.lamina.a} b={m.lamina.b} />
        : <PortadaModulo n={m.n} titulo={m.nombre} rotulo={t.modulo} />}
      {m.fondo && !m.portada && <span className="ugc-fondo" style={{ background: m.fondo }} aria-hidden />}
      {m.portada && <Miniatura src={m.portada} />}
      <span className="shade" aria-hidden />
      {/* ⚠️ El chip del número tapa la esquina de cinco de los siete diseños (los que ya dibujan el
          número grande): va sólo con los que la dejan libre (`conChipDeNumero`). */}
      {conChipDeNumero(m.portada || m.fondo ? null : m.lamina) && <span className="ugc-modcard-n" aria-hidden>{m.n}</span>}
      {bloqueado && <span className="ugc-modcard-candado" aria-hidden><IconoCandado /></span>}
      {m.estado === 'hecha' && <span className="ugc-modcard-ok" aria-hidden><IconoCheck /></span>}
      {m.aviso && <span className="ugc-modcard-aviso" title={m.aviso}><IconoCandado /> {m.aviso}</span>}
    </span>
  );
  const resto = (
    <>
      <span className="ugc-modcard-meta">{textoTarjetaModulo(m, t)}</span>
      {bloqueado && <span className="ugc-modcard-lock"><IconoCandado /> {m.motivo ?? t.bloqueada}</span>}
      {!bloqueado && m.progreso && <BarraAvance p={m.progreso} className="ugc-modcard-prog" />}
    </>
  );
  if (renombrar) {
    // ⚠️ EDITANDO, LA TARJETA ES UN DIV: adentro va el nombre que se edita con un clic, y un clic en
    //    un texto de un <button> abriría el módulo (la misma regla que la portada del curso). El botón
    //    que lo abre es la TAPA; un clic en el resto de la tarjeta también lo abre.
    return (
      <div className={`ugc-modcard ugc-modcard--edicion${claseEstado(m)}`} data-arr-copia
        onClick={(e) => { if ((e.target as Element).closest('button, [data-nodrag]')) return; onAbrir(); }}>
        <button type="button" className="ugc-modcard-abrir" onClick={onAbrir} aria-label={`Abrir ${m.nombre}`}>{tapa}</button>
        <span className="ugc-modcard-body">
          <span className="ugc-modcard-t" data-nodrag>
            <TextoEditable valor={m.nombre} etiqueta={`Nombre de ${m.nombre}`} marca={`modulo:${m.key}`} onGuardar={renombrar} />
          </span>
          {resto}
        </span>
      </div>
    );
  }
  return (
    <button type="button" className={`ugc-modcard${claseEstado(m)}`} data-arr-copia
      onClick={bloqueado ? undefined : onAbrir} disabled={bloqueado || undefined}>
      {tapa}
      <span className="ugc-modcard-body">
        <span className="ugc-modcard-t">{m.nombre}</span>
        {resto}
      </span>
    </button>
  );
}

function TarjetaClase({ clase, onAbrir }: { clase: ClaseUgc; onAbrir: () => void }) {
  return (
    <button type="button" className={`ugc-modcard${clase.atenuado ? ' is-atenuado' : ''}`} onClick={onAbrir} data-arr-copia>
      <span className="ugc-modcard-cover">
        {/* Una lámina diseñada (item 5) sólo sin tapa: el adaptador no pone la miniatura del video
            cuando se eligió una. Su número es el de la clase en su módulo, el mismo del chip. */}
        {clase.lamina && !clase.tapa && !clase.fondo && (
          <Lamina diseno={clase.lamina.diseno} n={Number(clase.vn ?? 1) || 1} rotulo="Clase" texto={clase.lamina.texto}
            nombre={clase.titulo} a={clase.lamina.a} b={clase.lamina.b} />
        )}
        {clase.fondo && !clase.tapa && <span className="ugc-fondo" style={{ background: clase.fondo }} aria-hidden />}
        {clase.tapa && <Miniatura src={clase.tapa} />}
        <span className="shade" aria-hidden />
        {/* El número de la clase DENTRO de su módulo (`vn`): arranca en 1 en cada uno, que es
            la única numeración que le sirve a quien estudia. */}
        {conChipDeNumero(clase.tapa || clase.fondo ? null : clase.lamina) && <span className="ugc-modcard-n" aria-hidden>{clase.vn ?? clase.id}</span>}
        {/* El triángulo dice que es un VIDEO: sin él, una tapa se lee como una imagen suelta. */}
        {clase.conVideo && <span className="ugc-modcard-play" aria-hidden>{'\u25b6'}</span>}
      </span>
      <span className="ugc-modcard-body">
        <span className="ugc-modcard-t">{clase.titulo}</span>
        {clase.meta != null && <span className="ugc-modcard-meta">{clase.meta}</span>}
        {clase.chips != null && <span className="ugc-chips">{clase.chips}</span>}
      </span>
    </button>
  );
}

/** Las clases de un módulo, o el resultado de una búsqueda. */
function Grilla({ clases, total, mod, modulo, t, abrirClase, edicion, puede, estructura }: {
  clases: ClaseUgc[]; total: number; mod: string | null; modulo?: ModuloUgc; t: TextosUgc;
  abrirClase: (id: number) => void; edicion?: EdicionUgc;
  puede: (id: number, dir: 'arriba' | 'abajo') => boolean;
  estructura: Estructura;
}) {
  const { arr } = estructura;
  // Un módulo con candado que llega por URL no se abre: se dice por qué.
  if (modulo && !abrible(modulo)) {
    return (
      <>
        <div className="ugc-rail-head"><h2>{modulo.nombre}</h2></div>
        <div className="ugc-soon ugc-bloqueado"><IconoCandado /><p>{modulo.motivo ?? t.bloqueada}</p></div>
      </>
    );
  }
  // Mover y agregar son gestos de un MÓDULO: en una búsqueda el orden no es el del curso.
  const editando = !!edicion && !!mod;
  return (
    <>
      {/* Filtrando por módulo, el título dice DE QUÉ módulo: «12 de 404» no dice dónde estás. */}
      <div className="ugc-rail-head">
        {/* Editando, el NOMBRE del módulo se cambia con un clic acá, que es donde se lo lee
            entero (la tarjeta es un botón: un clic en ella abre el módulo). */}
        {edicion?.onTexto && modulo && !modulo.sinEdicion ? (
          <h2>
            <TextoEditable valor={modulo.nombre} etiqueta={`Nombre de ${modulo.nombre}`} marca={`modulo:${modulo.key}`}
              onGuardar={(v) => edicion.onTexto!({ tipo: 'modulo', key: modulo.key }, v)} />
            {` · ${clases.length} ${clases.length === 1 ? t.leccion : t.lecciones}`}
            {/* El mismo menú «…» que en su tarjeta del índice: adentro del módulo es donde se lo mira. */}
            {estructura.conMenuModulo && (
              <BotonOpciones t={t} nombre={modulo.nombre} recorrido="menu-modulo"
                onAbrir={(a) => estructura.abrirOpciones({ tipo: 'modulo', key: modulo.key }, a)} />
            )}
          </h2>
        ) : <h2>{rotuloGrilla(mod ? (modulo?.nombre ?? mod) : null, clases.length, total, t)}</h2>}
        {modulo?.acciones != null && <div className="ugc-rail-acciones">{modulo.acciones}</div>}
      </div>
      {/* Un módulo abierto y VACÍO, para quien no edita (item 16): un estado corto, como el «coming
          soon» de Skool, en vez de un riel vacío que se lee como que no cargó. */}
      {!edicion && mod && modulo && !clases.length && t.moduloVacio && (
        <div className="ugc-soon ugc-vacio"><p>{t.moduloVacio}</p></div>
      )}
      {/* La grilla de un módulo es una ZONA del arrastre: soltar una clase acá la reordena. */}
      <div className="ugc-rail" {...(editando ? arr.zona('grilla') : {})}>
        {/* «+ Nueva clase» PRIMERO (item 12). Sin `data-arr`: el hueco 0 es el de la primera CLASE. */}
        {editando && !modulo?.sinEdicion && edicion!.onNueva && (
          <button type="button" className="ugc-modcard ugc-modcard--nueva" disabled={edicion!.ocupado} data-recorrido="nueva-clase"
            onClick={() => edicion!.onNueva?.(mod!)}>
            <span className="ugc-modcard-nueva-t">{t.nueva}</span>
          </button>
        )}
        {clases.map((c, i) => {
          // Una clase de «Sin módulo» se arrastra igual: soltada sobre un módulo de la barra, se muda
          // ahí (es la salida de una huérfana). Lo que no hace es reordenarse entre las suyas.
          const arrastra = editando && !!edicion!.onLlevarClase;
          return (
            <Fragment key={c.id}>
              {arr.huecoEn('grilla', i) && <Hueco alto={arr.alto} />}
              {editando ? (
                <div className={`ugc-editable${arrastra ? ' ugc-arrastrable' : ''}`} data-arr={arrastra ? String(c.id) : undefined}
                  draggable={arrastra || undefined}
                  onPointerDownCapture={arrastra ? arr.marcarOrigen : undefined}
                  onDragStart={arrastra ? (e) => arr.agarrar(e, { tipo: 'clase', id: c.id, moduloKey: c.moduloKey }) : undefined}
                  onDragEnd={arrastra ? arr.terminar : undefined}>
                  <TarjetaClase clase={c} onAbrir={() => abrirClase(c.id)} />
                  <div className="ugc-editable-ctrls" role="group" aria-label={`Ordenar ${c.titulo}`} data-nodrag>
                    <button type="button" className="ugc-editable-btn" title="Subir" aria-label="Subir"
                      disabled={edicion!.ocupado || !puede(c.id, 'arriba')} onClick={() => edicion!.onMover(c.id, 'arriba')}>&uarr;</button>
                    <button type="button" className="ugc-editable-btn" title="Bajar" aria-label="Bajar"
                      disabled={edicion!.ocupado || !puede(c.id, 'abajo')} onClick={() => edicion!.onMover(c.id, 'abajo')}>&darr;</button>
                    {edicion!.onPortada && (
                      <button type="button" className="ugc-editable-btn" title={t.portada} aria-label={`${t.portada} de ${c.titulo}`}
                        disabled={edicion!.ocupado} onClick={(e) => edicion!.onPortada!({ tipo: 'clase', id: c.id }, e.currentTarget)}>
                        <IconoImagen />
                      </button>
                    )}
                    {/* Con el menú «…», borrar vive adentro (con el candado, por área y mover a otro
                        módulo): una × suelta al lado de tres controles se tocaba sin querer. */}
                    {estructura.conMenuClase ? (
                      <BotonOpciones t={t} nombre={c.titulo} recorrido={i === 0 ? 'menu-clase' : undefined}
                        onAbrir={(a) => estructura.abrirOpciones({ tipo: 'clase', id: c.id }, a)} />
                    ) : (
                      <button type="button" className="ugc-editable-btn ugc-editable-btn--borrar" title="Borrar" aria-label="Borrar"
                        disabled={edicion!.ocupado} onClick={() => edicion!.onBorrar(c.id)}><IconoBorrar size={14} /></button>
                    )}
                  </div>
                </div>
              ) : (
                <TarjetaClase clase={c} onAbrir={() => abrirClase(c.id)} />
              )}
            </Fragment>
          );
        })}
        {arr.huecoEn('grilla', clases.length) && <Hueco alto={arr.alto} />}
      </div>
    </>
  );
}

/**
 * La lección: el video y el papel (la descripción y debajo la tarea), y lo que la pantalla quiera
 * abajo. Se monta con `key` = la clase, así que cambiar de clase vuelve todo a cero (lo que los
 * huecos tengan en estado).
 *
 * ⚠️ DOS DISPOSICIONES (item 16, `disposicion`): al costado (video a la izquierda, papel a la
 *    derecha) o abajo (el video y, debajo, el papel, todo a lo ancho). Las dos con el MISMO DOM y
 *    otra clase en el contenedor (`claseDelSplit`): una pantalla distinta para «abajo» sería el
 *    segundo dibujo de lo mismo.
 * ⚠️ SIN «Editar» Y SIN PESTAÑAS desde el 08/10/2026 (items 14 y 16): cada parte se edita en su
 *    lugar (el título acá, el resto en lo que trae la pantalla) y el papel es uno solo.
 * ⚠️ SIN VIDEO, QUIEN EDITA VE UN RECUADRO PUNTEADO (`sinVideo`), nunca un marco negro vacío: se
 *    leería como un reproductor roto. El alumno no recibe nada en ese lugar.
 * ⚠️ «TEXTO AL COSTADO / TEXTO ABAJO» VA ADENTRO DEL PAPEL, arriba de todo (item 13 del 08/10/2026:
 *    «debería estar dentro del recuadro de la descripción y la tarea, arriba de todo, arriba de la
 *    descripción»). Estaba al lado de la pastilla del título, lejos de lo que mueve. El interruptor lo
 *    arma ESTE dibujo (las opciones son suyas) y se lo pasa al papel (`LeccionUgc.papel` como función);
 *    un papel que no lo recibe (uno que es un nodo) lo lleva arriba suyo, así nunca se pierde.
 * ⚠️ `data-recorrido` en el título y en el video: son pasos del recorrido de la lección (app/_ui/Recorrido).
 * ⚠️ EL TÍTULO VA ARRIBA DE LAS DOS COLUMNAS, no adentro de la del video (audio del 08/10/2026, item 19,
 *    11:00: «el video y el párrafo del costado tienen que estar alineados, sí o sí… No puede estar el
 *    párrafo de la descripción muy arriba»). Adentro, el video arrancaba debajo de la pastilla y del h1
 *    —unos 110 px— y el papel de al lado arrancaba arriba de todo. Con el título afuera, los dos bordes
 *    de arriba quedan a la misma altura con texto al costado; abajo y en el teléfono no cambia nada (el
 *    título ya iba primero). Vale para el alumno también: es el mismo dibujo.
 * ⚠️ EL MENÚ «…» DE LA CLASE, AL LADO DEL TÍTULO (quien edita): «Obligatoria para avanzar» vive ahí desde el
 *    audio del 08/10/2026 (item 7), y sin el botón en la lección había que salir de la clase para tocarla.
 */
function Leccion({ clase, l, nombreModulo, anterior, siguiente, abrirClase, edicion, disposicion, t, opciones }: {
  clase: ClaseUgc; l: LeccionUgc; nombreModulo?: string;
  anterior: ClaseUgc | null; siguiente: ClaseUgc | null;
  abrirClase: (id: number) => void; edicion?: EdicionUgc; disposicion?: DisposicionUgc;
  t: TextosUgc;
  /** Abre el menú «…» de ESTA clase (el de su tarjeta). Ausente = sin menú (el alumno, o sin `menuClase`). */
  opciones?: (ancla: HTMLElement) => void;
}) {
  const pastilla = <span className="ugc-pill">{clase.pastilla ?? nombreModulo ?? ''}</span>;
  const actual: DisposicionUgc = disposicion === 'abajo' ? 'abajo' : 'costado';
  // El interruptor cambia el ajuste del CURSO: lo dice su rótulo de accesibilidad.
  const dispo = edicion?.onDisposicion ? (
    <div className="ugc-dispo" role="group" aria-label="Dónde va el texto, en todo el curso">
      {OPCIONES_DISPOSICION.map((o) => (
        <button key={o.valor} type="button" className="ugc-dispo-op" aria-pressed={actual === o.valor}
          disabled={edicion.ocupado} onClick={() => { if (actual !== o.valor) edicion.onDisposicion!(o.valor); }}>
          {o.texto}
        </button>
      ))}
    </div>
  ) : null;
  const papel = typeof l.papel === 'function' ? l.papel(dispo) : <>{dispo}{l.papel}</>;

  return (
    <>
      <div className="ugc-ltitle">
        {pastilla}
        {edicion?.onTexto
          ? (
            <h1 style={opciones ? { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } : undefined}>
              <TextoEditable valor={clase.titulo} etiqueta="Título de la clase" recorrido="leccion-titulo" onGuardar={(v) => edicion.onTexto!({ tipo: 'clase', id: clase.id }, v)} />
              {opciones && <BotonOpciones t={t} nombre={clase.titulo} recorrido="menu-clase" onAbrir={opciones} />}
            </h1>
          )
          : <h1>{clase.titulo}</h1>}
      </div>
      <div className={claseDelSplit(actual)}>
        <div className="ugc-vcol">
          {l.video ? (
            <div className="ugc-vcard" data-recorrido="leccion-video">
              <div className="ugc-vframe" style={{ aspectRatio: '16 / 9', width: '100%' }}>{l.video.cuerpo}</div>
              {l.video.barra != null && <div className="ugc-vbar">{l.video.barra}</div>}
            </div>
          ) : l.sinVideo != null && (
            <div className="ugc-vvacio" data-recorrido="leccion-video">{l.sinVideo}</div>
          )}
          {l.debajoDelVideo != null && <div className="ugc-debajo">{l.debajoDelVideo}</div>}
          {/* ⚠️ ANTERIOR / SIGUIENTE VAN DEBAJO DEL VIDEO, no arriba: son lo que se usa
              DESPUÉS de ver, y arriba competían con el título por el primer golpe de vista. */}
          {(anterior || siguiente) && (
            <nav className="ugc-lecnav ugc-lecnav-pie">
              {anterior && <button type="button" className="ugc-btn" onClick={() => abrirClase(anterior.id)}>{FLECHA_IZQ} {anterior.titulo}</button>}
              {siguiente && <button type="button" className="ugc-btn" onClick={() => abrirClase(siguiente.id)}>{siguiente.titulo} {FLECHA_DER}</button>}
            </nav>
          )}
        </div>

        <div className="ugc-pcol">{papel}</div>
      </div>
      {l.despues}
    </>
  );
}

const IconoImagen = () => (
  <svg className="ugc-ico" width="13" height="13" viewBox="0 0 16 16" aria-hidden focusable="false">
    <rect x="1.5" y="2.5" width="13" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="5.6" cy="6.3" r="1.4" fill="currentColor" />
    <path d="M2.5 12l3.6-3.6 2.6 2.4 2.2-2 2.6 2.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

/**
 * Un texto que se edita CON UN CLIC, en el lugar (pedido de Martín: «los títulos solo con darle
 * click»). Enter o salir guarda; Escape vuelve al de antes. Si quien guarda contesta `false`
 * (el server no lo aceptó), también vuelve.
 *
 * ⚠️ `contentEditable` Y NO UN `<input>`: un input no mide su texto —su ancho sale de `size` y de
 *    la fuente— y un título de 44 px adentro de la portada se cortaba o sobraba. Un span editable
 *    ocupa exactamente lo que dice (AGENTS.md, «un ancho que sale de una métrica tipográfica»).
 * ⚠️ SE LEE `textContent` Y SE PEGA SÓLO TEXTO: lo que se guarda es una línea; un pegado con
 *    formato dejaría en pantalla negritas y saltos que no se guardaron.
 * ⚠️ El `key` del valor rearma el span cuando el valor cambia de afuera (lo que contestó el
 *    server): sin eso React no toca un nodo que la persona editó a mano, y quedaría lo tipeado.
 */
function TextoEditable({ valor, onGuardar, etiqueta, vacio, className, marca, recorrido }: {
  valor: string;
  onGuardar: (v: string) => Promise<boolean>;
  /** Para el lector de pantalla: qué texto es. */
  etiqueta: string;
  /** Lo que se lee cuando está vacío (en gris). */
  vacio?: string;
  className?: string;
  /** Con qué se lo encuentra para ponerlo a editar desde afuera («Renombrar» del menú «…»). */
  marca?: string;
  /** El punto del recorrido de la pantalla que es este texto (`data-recorrido`). */
  recorrido?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [guardando, setGuardando] = useState(false);
  const volver = () => { if (ref.current) ref.current.textContent = valor; };
  // ⚠️ SI LO GUARDADO ES IGUAL A LO QUE YA ESTABA, EL `key` NO CAMBIA y el span no se rearma: vaciar
  //    el título de un curso que ya mostraba su nombre por default dejaba la portada EN BLANCO (lo
  //    tipeado). Sin el foco, lo que se ve tiene que ser `valor` (revisión del 07/10/2026).
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== valor) el.textContent = valor;
  }, [valor, guardando]);
  const confirmar = async () => {
    const el = ref.current;
    if (!el) return;
    const nuevo = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (nuevo === valor.trim()) { volver(); return; }
    setGuardando(true);
    let ok = false;
    try { ok = await onGuardar(nuevo); } catch { ok = false; }
    setGuardando(false);
    if (!ok) volver();
  };
  return (
    <span
      key={valor}
      ref={ref}
      className={`ugc-texto-editable${guardando ? ' is-guardando' : ''}${className ? ` ${className}` : ''}`}
      contentEditable={!guardando}
      suppressContentEditableWarning
      role="textbox"
      aria-label={etiqueta}
      data-vacio={vacio}
      data-texto={marca}
      data-recorrido={recorrido}
      spellCheck
      onKeyDown={(e) => {
        // Nada de lo que se tipea acá sube: ni un Escape que cierre otra cosa, ni un Enter.
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); ref.current?.blur(); }
        if (e.key === 'Escape') { e.preventDefault(); volver(); ref.current?.blur(); }
      }}
      onPaste={(e) => {
        e.preventDefault();
        const txt = e.clipboardData.getData('text/plain').replace(/\s+/g, ' ');
        document.execCommand('insertText', false, txt);
      }}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => { void confirmar(); }}
    >
      {valor}
    </span>
  );
}

/**
 * El desplegable de la marca. Va FIJO debajo de ella y adentro de `.ugc` (lo viste la hoja del
 * curso), no en un portal al `body`: ahí perdería el `.ahdoc .ugc` del que cuelgan sus estilos.
 * `position: fixed` lo saca del `overflow` de la barra, que lo recortaría.
 *
 * Se cierra con Escape (frenando a los demás: AGENTS.md, «un popover anclado también es una
 * capa») y con un clic afuera.
 */
function MenuMarca({ id, etiqueta, ancla, onCerrar, children }: {
  id: string; etiqueta: string; ancla: HTMLElement | null; onCerrar: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  // ⚠️ EL FOCO ENTRA AL ABRIR: el menú se dibuja al final del curso, y sin esto el Tab desde la
  //    marca recorría la barra entera antes de llegar a él (revisión del 07/10/2026).
  // ⚠️ Y RECIÉN CUANDO ESTÁ UBICADO: hasta medirse va con `visibility: hidden`, y un elemento oculto
  //    no recibe el foco — la primera versión lo pedía al montar y el foco se quedaba en el body
  //    (medido en el navegador, no en el código).
  const enfocado = useRef(false);
  useEffect(() => {
    if (!pos || enfocado.current) return;
    enfocado.current = true;
    ref.current?.querySelector<HTMLElement>('button, a[href], input')?.focus();
  }, [pos]);
  useEffect(() => {
    const medir = () => {
      if (!ancla) return;
      const r = ancla.getBoundingClientRect();
      const width = Math.max(260, r.width - 24);
      // ⚠️ ENCAJADO EN LA VENTANA: colgado del «…» de una tarjeta del borde derecho (08/10/2026) el
      //    menú salía 230 px afuera de la pantalla, con sus últimas opciones fuera de alcance. Y si
      //    abajo del botón no entra y arriba sí, va arriba (una tarjeta de la última fila).
      const left = Math.max(8, Math.min(r.left + 12, window.innerWidth - width - 8));
      const alto = ref.current?.offsetHeight ?? 0;
      // ⚠️ Y SI NO ENTRA NI ABAJO NI ARRIBA (08/10/2026: el menú «…» de un módulo creció con el acceso y
      //    el interruptor del kanban, 447 px, colgado de una tarjeta a media pantalla), se corre hacia arriba
      //    lo justo para que su final quede adentro: abajo de todo estaba «Eliminar módulo», cortado.
      const cabeAbajo = r.bottom + 4 + alto <= window.innerHeight - 8;
      const top = !alto || cabeAbajo ? r.bottom + 4
        : r.top - 4 - alto >= 8 ? r.top - 4 - alto : Math.max(8, window.innerHeight - 8 - alto);
      setPos({ left, top, width });
    };
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => { window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true); };
  }, [ancla]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onCerrar();
      ancla?.focus();
    };
    const afuera = (e: MouseEvent) => {
      const n = e.target as Node;
      if (ref.current?.contains(n) || ancla?.contains(n)) return;
      onCerrar();
    };
    document.addEventListener('keydown', tecla, true);
    document.addEventListener('mousedown', afuera, true);
    return () => { document.removeEventListener('keydown', tecla, true); document.removeEventListener('mousedown', afuera, true); };
  }, [ancla, onCerrar]);
  return (
    // Sin `role="menu"`: ese rol promete las flechas del teclado, y esto se recorre con Tab.
    <div ref={ref} id={id} className="ugc-menu" role="group" aria-label={etiqueta}
      style={pos ? { left: pos.left, top: pos.top, width: pos.width } : { visibility: 'hidden' }}
      onBlur={(e) => {
        // Se cierra cuando el foco se va AFUERA (Tab). Sin destino (`null`) no: es el selector de
        // color del sistema, que se abre encima y le saca el foco a la página.
        const n = e.relatedTarget as Node | null;
        if (n && !ref.current?.contains(n) && !ancla?.contains(n)) onCerrar();
      }}>
      {children}
    </div>
  );
}

/** Un renglón del menú de la marca. Con `activo` va marcado (el producto que se está viendo). */
export function ItemMenuUgc({ activo, onClick, children, title, disabled, peligro }: {
  activo?: boolean; onClick: () => void; children: ReactNode; title?: string;
  /** Apagado se DIBUJA igual (con su `title` diciendo por qué): uno que desaparece no explica nada. */
  disabled?: boolean;
  /** Borrar: se tiñe al pasar el cursor. */
  peligro?: boolean;
}) {
  return (
    <button type="button" className={`ugc-menu-item${activo ? ' on' : ''}${peligro ? ' ugc-menu-item--peligro' : ''}`} aria-current={activo || undefined}
      title={title} onClick={onClick} disabled={disabled || undefined}>
      {children}
    </button>
  );
}

/** El rótulo de una sección del menú de la marca. */
export function TituloMenuUgc({ children }: { children: ReactNode }) {
  return <div className="ugc-menu-h">{children}</div>;
}

// ── El editor de la ESTRUCTURA (items 6, 7 y 12) ─────────────────────────────────

/** Lo que el índice y la grilla reciben del editor de la estructura. */
type Estructura = {
  arr: ArrastreCurso;
  abrirOpciones: (o: { tipo: 'modulo'; key: string } | { tipo: 'clase'; id: number }, ancla: HTMLElement) => void;
  conMenuModulo: boolean;
  conMenuClase: boolean;
};

/**
 * EL HUECO: donde cae lo que se arrastra, del alto de la tarjeta que se agarró (el molde del Plan:
 * una celda de la grilla con el borde punteado). Con un piso, por si la medida llegó en cero.
 */
function Hueco({ alto }: { alto: number }) {
  return <div className="ugc-hueco" style={{ minHeight: Math.max(120, alto) }} aria-hidden />;
}

/** El «…» de un módulo o una clase. Va con los controles de la tarjeta y no arrastra. */
function BotonOpciones({ t, nombre, onAbrir, recorrido }: {
  t: TextosUgc; nombre: string; onAbrir: (ancla: HTMLElement) => void;
  /** El punto del recorrido que es este botón (`data-recorrido`): el del primer módulo y el de la primera clase. */
  recorrido?: string;
}) {
  return (
    <button type="button" className="ugc-editable-btn ugc-editable-btn--menu" data-nodrag data-recorrido={recorrido}
      title={t.opciones} aria-label={`${t.opciones} de ${nombre}`} aria-haspopup="true"
      onClick={(e) => { e.stopPropagation(); onAbrir(e.currentTarget); }}>
      &hellip;
    </button>
  );
}

/** Pone a editar un `TextoEditable` desde afuera (por su `marca`), con el texto entero seleccionado. */
function enfocarTexto(marca: string) {
  const el = [...document.querySelectorAll<HTMLElement>('[data-texto]')].find((n) => n.dataset.texto === marca);
  if (!el) return;
  el.focus();
  try {
    const r = document.createRange();
    r.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  } catch { /* sin selección queda el foco, que alcanza para escribir */ }
}

/**
 * «+ Nuevo módulo» (item 12): la primera tarjeta del índice, y al tocarla SE VUELVE UN CAMPO — el
 * nombre se pide en su lugar, no en un modal. Enter crea; Escape (o salir con el campo vacío) vuelve
 * a la tarjeta. Salir con algo escrito NO crea: crear un módulo puede crear una etapa del kanban, y
 * eso no puede pasar por un clic que se fue a otro lado.
 */
function NuevoModulo({ t, opcion, tope = 80, ocupado, onCrear }: {
  t: TextosUgc;
  opcion?: string;
  /** El tope del server (`EdicionUgc.topeNombreModulo`): el campo no deja escribir más. */
  tope?: number;
  ocupado?: boolean;
  onCrear: (nombre: string, conOpcion: boolean) => Promise<boolean>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [conOpcion, setConOpcion] = useState(true);
  const [creando, setCreando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const cerrar = () => { setAbierto(false); setNombre(''); setConOpcion(true); };
  const crear = async () => {
    const n = nombre.replace(/\s+/g, ' ').trim();
    if (!n || creando) return;
    setCreando(true);
    let ok = false;
    try { ok = await onCrear(n, conOpcion); } catch { ok = false; }
    setCreando(false);
    if (ok) cerrar();
  };
  if (!abierto) {
    return (
      <button type="button" className="ugc-modcard ugc-modcard--nueva" data-recorrido="nuevo-modulo"
        disabled={ocupado} onClick={() => setAbierto(true)}>
        <span className="ugc-modcard-nueva-t">{t.nuevoModulo}</span>
      </button>
    );
  }
  return (
    <div ref={caja} className="ugc-nuevo-modulo" data-recorrido="nuevo-modulo"
      onBlur={(e) => {
        const n = e.relatedTarget as Node | null;
        if (!creando && !nombre.trim() && !(n && caja.current?.contains(n))) cerrar();
      }}>
      <input type="text" autoFocus value={nombre} maxLength={tope} placeholder={t.nombreModulo} aria-label={t.nombreModulo}
        disabled={creando}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); void crear(); }
          if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
        }} />
      <div className="ugc-nuevo-pie">
        {opcion && (
          <label className="ugc-nuevo-check">
            <input type="checkbox" checked={conOpcion} disabled={creando} onChange={(e) => setConOpcion(e.target.checked)} />
            {opcion}
          </label>
        )}
        <button type="button" className="ugc-btn" disabled={creando || !nombre.trim()} onClick={() => void crear()}>
          {creando ? 'Creando\u2026' : 'Crear'}
        </button>
      </div>
    </div>
  );
}
