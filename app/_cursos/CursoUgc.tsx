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
 *
 * ⚠️ Y UNA QUE TODAVÍA NO: app/conocimientos/CursoReplica.tsx, de donde salió este dibujo, sigue
 *    con SU copia del DOM. Mudarla es el paso que falta para que haya un solo dibujo — tiene
 *    alumnos y links compartidos, así que se hace aparte y con el `key` de cada módulo por NOMBRE
 *    (los `#mod=` que ya circulan lo llevan). Hasta entonces, lo que se le cambie a una se mira
 *    en la otra.
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
 *       .ugc-content   índice, grilla o lección — lo único que scrollea
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

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { usePosicion, type Posicion } from '@/app/conocimientos/posicion';
import { Miniatura } from '@/app/conocimientos/Miniatura';
import { PortadaModulo } from '@/app/conocimientos/PortadaModulo';
import type { ClaseUgc, CursoUgcProps, EdicionUgc, LeccionUgc, ModuloUgc, PortadaUgc, TextosUgc, TonoChip } from './tipos';
import { CSS_UGC } from './estilos';
import {
  TEXTOS_DEFAULT, abrible, clasesVisibles, moduloMarcado, pctAvance, puedeMoverPorPosicion,
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
 * La cabecera de pestañas del papel. Controlada: quien la usa decide cuál está abierta.
 * La usa CursoUgc para `leccion().pestanas`, y la usa CursoReplica para las suyas, que
 * llegan de a una por fetch. Una sola pieza: las dos pantallas no pueden dibujar pestañas
 * distintas.
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

/** La clase de estado de un módulo, para la barra y la tarjeta. Vacía sin estado (Conocimientos). */
const claseEstado = (m: ModuloUgc) => (m.estado ? ` is-${m.estado}` : '');

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
    edicion, arriba, pieBarra, onSalir, modo = 'pagina',
  } = props;
  const t: TextosUgc = useMemo(() => ({ ...TEXTOS_DEFAULT, ...props.textos }), [props.textos]);
  const cssListo = useCssUgc();
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

  return (
    // `ahdoc--ugc` acota lo propio de este dibujo (./estilos.ts): CursoReplica comparte la hoja
    // del origen y no tiene, por ejemplo, el menú del teléfono.
    <div className={`ahdoc ahdoc--ugc${modo === 'embebido' ? ' ahdoc--embebido' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS_UGC }} />
      <div className="paper-bg" aria-hidden />
      <div className="grain" aria-hidden />
      <div className="ugc">
        <div className="ugc-shell">
          <aside className={`ugc-side${menu ? ' ugc-side--abierta' : ''}`} aria-label="Navegacion del curso">
            {/* ⚠️ LA MARCA ES UN BOTÓN sólo si hay a dónde ir. Es donde todo el mundo hace
                click para volver al principio; pero en un share de UN curso no hay nada
                arriba, y un botón que no lleva a ningún lado promete una salida que no está.
                Ahí queda como rótulo. El corte de color es el de la casa: `resaltado` en lima. */}
            {marca.onClick ? (
              <button type="button" className="ugc-side-brand ugc-side-brand-btn"
                onClick={marca.onClick} aria-label={marca.ariaLabel ?? `${marca.texto}${marca.resaltado ?? ''}`}>
                <span className="ugc-side-name">{marca.texto}{marca.resaltado != null && <span>{marca.resaltado}</span>}</span>
              </button>
            ) : (
              <div className="ugc-side-brand">
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
            <nav className="ugc-nav" id={idNav}>
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
                return (
                  <button key={m.key} type="button"
                    className={`ugc-nav-item${marcado === m.key ? ' on' : ''}${claseEstado(m)}`}
                    onClick={bloqueado ? undefined : () => ir({ mod: m.key })}
                    disabled={bloqueado || undefined}
                    title={bloqueado ? `${m.nombre}. ${t.bloqueada}` : m.nombre}>
                    <span className="ugc-nav-num">{m.n}</span>
                    <span className="ugc-nav-label">{m.nombre}</span>
                    {bloqueado
                      ? <span className="ugc-nav-count ugc-nav-candado"><IconoCandado /></span>
                      : <span className="ugc-nav-count">{textoBarraModulo(m)}</span>}
                  </button>
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
              {/* De QUÉ curso es esta pantalla: al otro extremo de la marca, donde se lee como
                  contexto y no como identidad. Pedido de Martín. */}
              <div className="ugc-topbar-curso">
                <span className="ugc-topbar-curso-t">{titulo}</span>
                <span className="ugc-topbar-curso-n">{subtitulo ?? `${clases.length} ${t.clases}`}</span>
              </div>
            </div>
            {arriba != null && <div className="ugc-arriba">{arriba}</div>}

            <div className="ugc-content">
              {clase ? (
                <Leccion key={clase.id} clase={clase} l={leccion(clase)} nombreModulo={modulo(clase.moduloKey)?.nombre}
                  {...vecinas(clases, clase.id)} abrirClase={abrirClase} edicion={edicion} t={t} />
              ) : extra ? (
                <div className="ugc-extra">{extra.cuerpo}</div>
              ) : pos.recursos && recursos ? (
                recursos.render({ abierto: pos.r, abrir: (slug) => ir({ recursos: true, r: slug }), cerrar: () => ir({ recursos: true }) })
              ) : filtradas ? (
                <Grilla clases={filtradas} total={clases.length} mod={mod} modulo={modulo(mod)} t={t}
                  abrirClase={abrirClase} edicion={edicion} puede={puede} />
              ) : (
                <Indice portada={portada} clases={clases} modulos={modulos} t={t}
                  onAbrir={abrirClase} onModulo={(m) => ir({ mod: m.key })} />
              )}
            </div>
          </div>
        </div>
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
function Indice({ portada, clases, modulos, t, onAbrir, onModulo }: {
  portada?: PortadaUgc; clases: ClaseUgc[]; modulos: ModuloUgc[]; t: TextosUgc;
  onAbrir: (id: number) => void; onModulo: (m: ModuloUgc) => void;
}) {
  const destino = portada ? (clases.find((c) => c.id === portada.claseId) ?? clases[0]) : undefined;
  return (
    <>
      {portada && destino && (
        <button
          type="button"
          className="ugc-hero"
          onClick={() => onAbrir(destino.id)}
          /* El rótulo se declara: con la descripción adentro, el nombre accesible del botón
             sería el párrafo entero. */
          aria-label={`Abrir ${destino.titulo}`}
        >
          {portada.tapa && <Miniatura className="ugc-hero-img" src={portada.tapa} />}
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
      <div className="ugc-rail-head"><h2>{t.losModulos}</h2></div>
      <div className="ugc-rail">
        {modulos.map((m) => <TarjetaModulo key={m.key} m={m} t={t} onAbrir={() => onModulo(m)} />)}
      </div>
    </>
  );
}

/**
 * La tarjeta de un módulo. Bloqueado: se DIBUJA (con candado y su cuenta de clases) y no se
 * abre. Esconderlo haría que el curso pareciera más corto de lo que es, y la persona no
 * sabría que falta algo por delante.
 */
function TarjetaModulo({ m, t, onAbrir }: { m: ModuloUgc; t: TextosUgc; onAbrir: () => void }) {
  const bloqueado = !abrible(m);
  return (
    <button type="button" className={`ugc-modcard${claseEstado(m)}`}
      onClick={bloqueado ? undefined : onAbrir} disabled={bloqueado || undefined}>
      <span className="ugc-modcard-cover">
        {/* ⚠️ LA LÁMINA VA SIEMPRE Y VA PRIMERA: `portada` puede ser una ruta construida y no
            comprobada. Si carga, la tapa la cubre entera; si da 404, la lámina ya estaba. */}
        <PortadaModulo n={m.n} titulo={m.nombre} rotulo={t.modulo} />
        {m.portada && <Miniatura src={m.portada} />}
        <span className="shade" aria-hidden />
        <span className="ugc-modcard-n" aria-hidden>{m.n}</span>
        {bloqueado && <span className="ugc-modcard-candado" aria-hidden><IconoCandado /></span>}
        {m.estado === 'hecha' && <span className="ugc-modcard-ok" aria-hidden><IconoCheck /></span>}
      </span>
      <span className="ugc-modcard-body">
        <span className="ugc-modcard-t">{m.nombre}</span>
        <span className="ugc-modcard-meta">{textoTarjetaModulo(m, t)}</span>
        {bloqueado && <span className="ugc-modcard-lock"><IconoCandado /> {t.bloqueada}</span>}
        {!bloqueado && m.progreso && <BarraAvance p={m.progreso} className="ugc-modcard-prog" />}
      </span>
    </button>
  );
}

function TarjetaClase({ clase, onAbrir }: { clase: ClaseUgc; onAbrir: () => void }) {
  return (
    <button type="button" className="ugc-modcard" onClick={onAbrir}>
      <span className="ugc-modcard-cover">
        {clase.tapa && <Miniatura src={clase.tapa} />}
        <span className="shade" aria-hidden />
        {/* El número de la clase DENTRO de su módulo (`vn`): arranca en 1 en cada uno, que es
            la única numeración que le sirve a quien estudia. */}
        <span className="ugc-modcard-n" aria-hidden>{clase.vn ?? clase.id}</span>
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
function Grilla({ clases, total, mod, modulo, t, abrirClase, edicion, puede }: {
  clases: ClaseUgc[]; total: number; mod: string | null; modulo?: ModuloUgc; t: TextosUgc;
  abrirClase: (id: number) => void; edicion?: EdicionUgc;
  puede: (id: number, dir: 'arriba' | 'abajo') => boolean;
}) {
  // Un módulo con candado que llega por URL no se abre: se dice por qué.
  if (modulo && !abrible(modulo)) {
    return (
      <>
        <div className="ugc-rail-head"><h2>{modulo.nombre}</h2></div>
        <div className="ugc-soon ugc-bloqueado"><IconoCandado /><p>{t.bloqueada}</p></div>
      </>
    );
  }
  // Mover y agregar son gestos de un MÓDULO: en una búsqueda el orden no es el del curso.
  const editando = !!edicion && !!mod;
  return (
    <>
      {/* Filtrando por módulo, el título dice DE QUÉ módulo: «12 de 404» no dice dónde estás. */}
      <div className="ugc-rail-head">
        <h2>{rotuloGrilla(mod ? (modulo?.nombre ?? mod) : null, clases.length, total, t)}</h2>
        {modulo?.acciones != null && <div className="ugc-rail-acciones">{modulo.acciones}</div>}
      </div>
      <div className="ugc-rail">
        {clases.map((c) => (editando ? (
          <div key={c.id} className="ugc-editable">
            <TarjetaClase clase={c} onAbrir={() => abrirClase(c.id)} />
            <div className="ugc-editable-ctrls" role="group" aria-label={`Ordenar ${c.titulo}`}>
              <button type="button" className="ugc-editable-btn" title="Subir" aria-label="Subir"
                disabled={edicion!.ocupado || !puede(c.id, 'arriba')} onClick={() => edicion!.onMover(c.id, 'arriba')}>&uarr;</button>
              <button type="button" className="ugc-editable-btn" title="Bajar" aria-label="Bajar"
                disabled={edicion!.ocupado || !puede(c.id, 'abajo')} onClick={() => edicion!.onMover(c.id, 'abajo')}>&darr;</button>
              <button type="button" className="ugc-editable-btn ugc-editable-btn--borrar" title="Borrar" aria-label="Borrar"
                disabled={edicion!.ocupado} onClick={() => edicion!.onBorrar(c.id)}>&times;</button>
            </div>
          </div>
        ) : (
          <TarjetaClase key={c.id} clase={c} onAbrir={() => abrirClase(c.id)} />
        )))}
        {editando && (
          <button type="button" className="ugc-modcard ugc-modcard--nueva" disabled={edicion!.ocupado}
            onClick={() => edicion!.onNueva(mod!)}>
            <span className="ugc-modcard-nueva-t">{t.nueva}</span>
          </button>
        )}
      </div>
    </>
  );
}

/**
 * La lección: video a la izquierda, papel a la derecha, y lo que la pantalla quiera abajo.
 * Se monta con `key` = la clase, así que cambiar de clase vuelve todo a cero (la pestaña
 * abierta, lo que el hueco tenga en estado).
 */
function Leccion({ clase, l, nombreModulo, anterior, siguiente, abrirClase, edicion, t }: {
  clase: ClaseUgc; l: LeccionUgc; nombreModulo?: string;
  anterior: ClaseUgc | null; siguiente: ClaseUgc | null;
  abrirClase: (id: number) => void; edicion?: EdicionUgc; t: TextosUgc;
}) {
  const [tab, setTab] = useState<string | null>(null);
  const nombres = (l.pestanas ?? []).map((p) => p.nombre);
  const activa = tab && nombres.includes(tab) ? tab : nombres[0] ?? null;
  const pastilla = <span className="ugc-pill">{clase.pastilla ?? nombreModulo ?? ''}</span>;

  return (
    <>
      <div className="ugc-split">
        <div className="ugc-vcol">
          <div className="ugc-ltitle">
            {edicion ? (
              <div className="ugc-ltitle-fila">
                {pastilla}
                <button type="button" className="ugc-btn ugc-ltitle-editar" disabled={edicion.ocupado}
                  onClick={() => edicion.onEditar(clase.id)}>{t.editar}</button>
              </div>
            ) : pastilla}
            <h1>{clase.titulo}</h1>
          </div>
          {l.video && (
            <div className="ugc-vcard">
              <div className="ugc-vframe" style={{ aspectRatio: '16 / 9', width: '100%' }}>{l.video.cuerpo}</div>
              {l.video.barra != null && <div className="ugc-vbar">{l.video.barra}</div>}
            </div>
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

        <div className="ugc-pcol">
          {l.pestanas && l.pestanas.length > 0 ? (
            <>
              <CabeceraPestanas nombres={nombres} activa={activa} onCambiar={setTab} />
              {l.pestanas.find((p) => p.nombre === activa)?.cuerpo}
            </>
          ) : l.papel}
        </div>
      </div>
      {l.despues}
    </>
  );
}
