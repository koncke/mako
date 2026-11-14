'use client';

// =============================================================================
// ClientsShell — la cabecera de Clients: el programa arriba y las sub-tabs de un grupo de Skool
// =============================================================================
// Martín, 17/10/2026: «Quiero unificar completamente la tab de "Cursos" con "Comunidad" y con "Clientes"… Como lo
// tiene Skool, con una tab más de "Classroom", pero quiero conservar el diseño de la tab CURSO… que el diseño de la
// comunidad tipo Skool… se parezca a lo que hicimos en CURSO, y que sea personalizable».
//
// COPIADO DEL ENCABEZADO DE UN GRUPO DE SKOOL: el grupo (su sello y su nombre, con el desplegable para cambiar de
// grupo) arriba a la izquierda, y abajo la fila de pestañas (Community · Classroom · Calendar · Members ·
// Leaderboards · About; acá adelante va Clients, D1 de docs/diseno-clients.md). Lo que NO es de Skool es la pinta:
// es la del CURSO (./estilos.ts), con el acento y la fuente del programa.
//
// Qué decide esta pieza y nada más:
//   · QUÉ PROGRAMA se mira: `?producto=` (o el primero). Cambiarlo navega a la misma sub-tab con el otro producto:
//     cada pantalla de abajo lo lee en el server, como siempre.
//   · LA SUB-TAB: sale del pathname (`seccionDeRuta`). Entre las cinco de la comunidad, el cambio es
//     `history.pushState` (D5): la comunidad ya tiene sus datos y lee su pestaña de la URL (ComunidadEquipo).
//   · «Personalizar» (sólo un admin): el color (la paleta y «Otro color») y la fuente del programa, con su «Deshacer».
//     Es EL ÚNICO lugar donde se eligen desde el 24/10/2026 (f27 de la llamada con Leandro: «que toda la
//     configuración de diseño se vaya al botón de personalizar»): el menú de la marca del Classroom se fue. Es el
//     ajuste que ve el alumno en su portal (`guardarEstiloCursoAction`, `curso_estilo`): uno por programa.
//   · EL MENÚ DE CADA PROGRAMA (f25 y f26, 24/10/2026): su «…» en la lista y su clic derecho (también el del programa
//     que se mira): Renombrar y Eliminar (./menu-contextual-clients.ts, puro y con test). ⚠️ SÓLO ACÁ: el título de la
//     barra negra del Classroom es TEXTO, sin clic derecho (Martín, 25/10/2026: «no debe ser un desplegable»). Eliminar ARCHIVA (como el CRM: app/customer-success/eliminar-programa.ts), pregunta
//     sólo si hay alumnos o clases, con la cuenta, y navega DURO (cambió QUÉ EXISTE, AGENTS.md); el «Deshacer» cruza
//     la recarga en `sessionStorage` (`NOTA_DESHACER`).
//   · ⚠️ UN SOLO SELECTOR DE PROGRAMA, ÉSTE (f28: «me cambian los dos al mismo tiempo»; un curso es un producto). Con
//     «+ Nuevo producto» al final de la lista (sólo un admin), que también se mudó del Classroom. Cada programa es un
//     LINK y no un botón: la guarda de la lección a medio guardar del Classroom (`useLeccionAbierta`) ataja los links
//     antes de navegar, y un `router.push` desde un botón se la saltaba.
//
// ⚠️ LA VISTA PREVIA DEL ALUMNO (/classroom/preview) VA SIN CABECERA: tiene su propia barra y es lo que ve
//    un cliente, que no tiene sub-tabs de nadie.

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useSearchParams } from 'next/navigation';
import Link, { useRouter, useWs } from '@/app/_ui/Link';
import { Button, Field, Input, Modal, Toast, useConfirm, useToast } from '@/app/_ui';
import { MenuContextual } from '@/app/_ui/MenuContextual';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { conWs } from '@/lib/ws-tab';
import { useCapaModal } from '@/app/_components/pila-modales';
import { ACENTOS, ACENTO_DEFAULT, TOPE_TITULO_CURSO, hexValido, tapaDe, varsDeAcento } from '@/lib/curso-estilo';
import { SIN_NOMBRE_EQUIPO } from '@/lib/curso-nombre';
// La inicial del sello, de la pieza de la casa: `trim()[0]` de «🎸 Fiesta» es media pieza del emoji (React #418).
import { iniciales } from '@/lib/unicode-seguro';
import { varsDeFuente } from '@/app/_cursos/fuentes';
import { SelectorFuente, useHojasDeFuentes } from '@/app/_cursos/SelectorFuente';
import { guardarEstiloCursoAction } from '@/app/customer-success/curso/actions';
import { NuevoProducto } from '@/app/customer-success/curso/NuevoProducto';
import { useCerrarEstable, useFocoInicial } from '@/app/customer-success/curso/dialogo-foco';
import {
  duplicarServicioAction, eliminarServicioAction, previaEliminarServicioAction, restaurarServicioAction,
} from '@/app/customer-success/actions';
import { avisoDeCopia, preguntaAlEliminar, type DeshacerEliminar } from '@/app/customer-success/eliminar-programa';
import { TextoConPasarAPro } from '@/app/_components/CartelSoloPro';
import { esOpcionPrograma, itemsPrograma, opcionesPrograma } from './menu-contextual-clients';
import {
  esSeccionComunidad, esVistaPrevia, hrefConPrograma, hrefSeccion, seccionDeRuta, seccionesDe, type SeccionClients,
} from '@/lib/clients-rutas';
import { CSS_CLIENTS } from './estilos';

/** Un programa (un producto con su curso), como lo dibuja la cabecera. Lo arma ./layout.tsx. */
export type ProgramaClients = {
  id: number;
  /** El nombre del CURSO (el de su oferta), nunca el del producto del CRM (lib/curso-nombre.ts). */
  nombre: string;
  acento: string | null;
  fuente: string | null;
  /** La portada del curso (lib/portadas.ts), para el sello. */
  portada: string | null;
  /** El título puesto a mano (`curso_estilo`), si hay: lo de antes del «Deshacer» de Renombrar. */
  titulo: string | null;
  /** El producto del embudo principal: no se elimina, y su menú no lo ofrece. */
  principal: boolean;
  /** Tiene un embudo vivo: eliminarlo lo archiva y vuelve desde «Productos eliminados» del CRM. */
  conEmbudo: boolean;
};

/** Abre el menú de un programa en un punto de la ventana: el «…» de su fila y el clic derecho en la cabecera. */
type AbrirMenuPrograma = (productoId: number, punto: { x: number; y: number }) => void;

/**
 * El «Deshacer» de Eliminar CRUZA LA RECARGA: eliminar navega duro (cambió qué existe), y el aviso con su botón se
 * perdería con la página. Se anota acá y la cabecera nueva lo muestra al montar, si no pasaron 12 segundos.
 */
const NOTA_DESHACER = 'clients:deshacer-eliminar';
/**
 * Lo que se deshace: un programa eliminado vuelve (`restaurar`), o una copia recién hecha se va (`quitarCopia`, y se
 * vuelve al original). Duplicar también navega duro: lo que cambió es qué existe.
 */
type NotaDeshacer = {
  texto: string;
  accion: { tipo: 'restaurar'; id: number; deshacer: DeshacerEliminar } | { tipo: 'quitarCopia'; id: number; volverA: number };
  hasta: number;
};

/** Lo que «Personalizar» guarda: el color o la fuente del programa. */
type AjusteVisual = { tipo: 'acento' } | { tipo: 'fuente' };

/** La hoja de la letra de siempre del curso y de la de máquina: la cabecera vive fuera del curso (que las trae). */
const HOJA_BASE = 'https://fonts.googleapis.com/css2?family=Archivo:wght@400..900&family=JetBrains+Mono:wght@500;700&display=swap';

function useHojaBase() {
  useEffect(() => {
    if (document.getElementById('clients-letra')) return;
    const l = document.createElement('link');
    l.id = 'clients-letra';
    l.rel = 'stylesheet';
    l.href = HOJA_BASE;
    document.head.appendChild(l);
  }, []);
}

/** Las variables del programa (acento y fuente) para el `style` de una raíz: la cabecera y la comunidad. */
export function varsDelPrograma(p: Pick<ProgramaClients, 'acento' | 'fuente'> | null): CSSProperties | undefined {
  if (!p) return undefined;
  const v = { ...(varsDeAcento(p.acento) ?? {}), ...(varsDeFuente(p.fuente) ?? {}) };
  return Object.keys(v).length ? (v as CSSProperties) : undefined;
}

/** Las variables del programa, para lo que va por portal al `body` (fuera de la raíz que las pinta). */
const VarsCtx = createContext<CSSProperties | undefined>(undefined);

export function ClientsShell({ programas: programasProp, puedePersonalizar, plataforma = false, children }: {
  programas: ProgramaClients[];
  /** Admin del workspace: el guard de verdad lo vuelve a hacer la action. */
  puedePersonalizar: boolean;
  /** El super admin en su propio workspace: ve también Methodology (lo que sabe MaKo). La página se cuida sola. */
  plataforma?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const sp = useSearchParams();
  const search = sp?.toString() ?? '';
  const router = useRouter();
  const { toast, show, clear } = useToast();
  useHojaBase();

  // Lo que se cambia acá se ve en el acto; cuando llega otra lista del server, ésa manda.
  const [base, setBase] = useState(programasProp);
  const [programas, setProgramas] = useState(programasProp);
  if (base !== programasProp) { setBase(programasProp); setProgramas(programasProp); }

  const pedido = Number(sp?.get('producto'));
  const programa = programas.find((p) => p.id === pedido) ?? programas[0] ?? null;
  useHojasDeFuentes([programa?.fuente]);

  const seccion = seccionDeRuta(pathname);
  const vars = useMemo(() => varsDelPrograma(programa), [programa]);
  /** «+ Nuevo producto»: el diálogo del nombre (`NuevoProducto` navega DURO al curso nuevo al crearlo). */
  const [creando, setCreando] = useState(false);
  const cerrarCreando = useCallback(() => setCreando(false), []);
  const ws = useWs();
  const { confirm, confirmNode } = useConfirm();
  /** El menú de un programa (f25/f26), abierto en un punto; y el programa que se está renombrando. */
  const [menu, setMenu] = useState<{ id: number; punto: { x: number; y: number } } | null>(null);
  const [renombrando, setRenombrando] = useState<ProgramaClients | null>(null);
  const cerrarRenombrar = useCallback(() => setRenombrando(null), []);
  const abrirMenu = useCallback<AbrirMenuPrograma>((id, punto) => setMenu({ id, punto }), []);

  /** Deshace lo de la nota y abre el programa que corresponde (navega duro: cambió qué existe). */
  const deshacerNota = useCallback(async (n: NotaDeshacer) => {
    const a = n.accion;
    const r = await (a.tipo === 'restaurar' ? restaurarServicioAction(a.id, a.deshacer) : eliminarServicioAction(a.id))
      .catch(() => ({ ok: false as const, error: 'Sin conexión.' }));
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    const destino = a.tipo === 'restaurar' ? a.id : a.volverA;
    window.location.href = conWs(hrefConPrograma(window.location.pathname, window.location.search.slice(1), destino), ws);
  }, [show, ws]);
  /** Anota el «Deshacer» para después de la recarga (ver `NOTA_DESHACER`). Sin `sessionStorage`, no hay: se dice igual. */
  const anotarDeshacer = (texto: string, accion: NotaDeshacer['accion']) => {
    try { window.sessionStorage.setItem(NOTA_DESHACER, JSON.stringify({ texto, accion, hasta: Date.now() + 12_000 } satisfies NotaDeshacer)); }
    catch { /* sin «Deshacer»: lo eliminado vuelve desde el CRM, y una copia se elimina desde su menú */ }
  };

  // El «Deshacer» de un Eliminar de antes de la recarga (ver `NOTA_DESHACER`). Se lee y se borra: una sola vez.
  useEffect(() => {
    let nota: NotaDeshacer | null = null;
    try {
      nota = JSON.parse(window.sessionStorage.getItem(NOTA_DESHACER) ?? 'null') as NotaDeshacer | null;
      window.sessionStorage.removeItem(NOTA_DESHACER);
    } catch { nota = null; }
    if (!nota || typeof nota.hasta !== 'number' || nota.hasta < Date.now() || !nota.accion || typeof nota.texto !== 'string') return;
    const n = nota;
    show(n.texto, () => { void deshacerNota(n); });
  }, [show, deshacerNota]);

  if (esVistaPrevia(pathname) || !seccion) return <>{children}</>;

  /** Entre dos pestañas de la comunidad no se navega: la comunidad lee su pestaña de la URL (D5). */
  const alClicTab = (e: MouseEvent<HTMLAnchorElement>, destino: string, id: SeccionClients) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (!esSeccionComunidad(seccion) || !esSeccionComunidad(id)) return;
    e.preventDefault();
    if (id !== seccion) window.history.pushState(null, '', destino);
  };

  /** Lo que se ve en el acto (el «Otro color» mientras se mueve, antes de guardarse). */
  const probar = (ajuste: AjusteVisual, valor: string | null) => {
    if (!programa) return;
    const campo = ajuste.tipo === 'acento' ? 'acento' : 'fuente';
    setProgramas((ps) => ps.map((p) => (p.id === programa.id ? { ...p, [campo]: valor } : p)));
  };

  /**
   * Guarda el color o la fuente. `antes` (lo que había al empezar): con él, el aviso trae su «Deshacer», que vuelve a
   * guardar por este MISMO camino (item 18 del 08/10/2026: un deshacer que sólo revierte la pantalla miente hasta el
   * próximo F5). El deshacer no ofrece deshacerse.
   */
  const guardar = async (ajuste: AjusteVisual, valor: string | null, antes?: string | null) => {
    if (!programa) return;
    const previo = programas;
    probar(ajuste, valor);
    const r = await guardarEstiloCursoAction(programa.id, ajuste, valor).catch(() => ({ ok: false as const, error: 'Sin conexión.' }));
    if (!r.ok) { setProgramas(previo); show(r.error, undefined, 'bad'); return; }
    if (antes !== undefined && antes !== valor) {
      show(ajuste.tipo === 'acento' ? 'Color cambiado' : 'Fuente cambiada', () => { void guardar(ajuste, antes); });
    }
    // Las pantallas de abajo (el Classroom, la comunidad) leen el estilo en el server.
    router.refresh();
  };

  /**
   * Eliminar un programa (f25): pregunta sólo si tiene alumnos o clases (con la cuenta), archiva como el CRM y navega
   * DURO a la misma sub-tab sin `?producto=` (el que se miraba puede ser el que se fue). El «Deshacer», en `NOTA_DESHACER`.
   */
  const eliminar = async (p: ProgramaClients) => {
    const previa = await previaEliminarServicioAction(p.id).catch(() => ({ ok: false as const, error: 'Sin conexión.' }));
    if (!previa.ok) { show(previa.error, undefined, 'bad'); return; }
    const q = preguntaAlEliminar({ nombre: p.nombre, alumnos: previa.alumnos, clases: previa.clases, conEmbudo: p.conEmbudo });
    if (q && !(await confirm(q.texto, { title: q.titulo, confirmLabel: 'Eliminar' }))) return;
    const r = await eliminarServicioAction(p.id).catch(() => ({ ok: false as const, error: 'Sin conexión.' }));
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    if (r.deshacer) anotarDeshacer(`«${p.nombre}» eliminado`, { tipo: 'restaurar', id: p.id, deshacer: r.deshacer });
    const q2 = new URLSearchParams(search);
    for (const k of ['producto', 'cliente', 'post']) q2.delete(k);
    window.location.href = conWs(`${pathname}${q2.toString() ? `?${q2.toString()}` : ''}`, ws);
  };

  /**
   * Duplicar un programa (25/10/2026): la copia con su curso entero y sin alumnos (lib/curso-duplicar.ts). Navega DURO a
   * la copia, en la misma sub-tab; su «Deshacer» la elimina y vuelve al original. Mientras copia, lo dice: puede tardar.
   */
  const duplicar = async (p: ProgramaClients) => {
    show(`Duplicando «${p.nombre}»…`);
    const r = await duplicarServicioAction(p.id).catch(() => ({ ok: false as const, error: 'Sin conexión.' }));
    // El tope de cursos del plan (lib/tope-cursos.ts): no es un error, es el plan. El aviso con «Pasar a Pro», sin rojo.
    if (!r.ok && 'pasarAPro' in r && r.pasarAPro) { show(<TextoConPasarAPro texto={r.error} />, undefined, 'warn'); return; }
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    anotarDeshacer(avisoDeCopia(r.copia), { tipo: 'quitarCopia', id: r.copia.productoId, volverA: p.id });
    window.location.href = conWs(hrefConPrograma(pathname, search, r.copia.productoId), ws);
  };

  const elegirEnPrograma = (id: string) => {
    const p = programas.find((x) => x.id === menu?.id);
    setMenu(null);
    if (!p || !esOpcionPrograma(id)) return;
    if (id === 'renombrar') setRenombrando(p);
    else if (id === 'duplicar') void duplicar(p);
    else void eliminar(p);
  };
  const programaDelMenu = menu ? programas.find((x) => x.id === menu.id) ?? null : null;
  const itemsDelMenu = programaDelMenu ? itemsPrograma(opcionesPrograma({ admin: puedePersonalizar, principal: programaDelMenu.principal })) : [];

  /** Renombrado: se ve en el acto, con su «Deshacer» por el MISMO camino; las pantallas de abajo lo leen del server. */
  const renombrado = async (p: ProgramaClients, titulo: string | null) => {
    setRenombrando(null);
    if (titulo != null) setProgramas((ps) => ps.map((x) => (x.id === p.id ? { ...x, nombre: titulo, titulo } : x)));
    if ((p.titulo ?? null) !== titulo) {
      show('Nombre cambiado', () => {
        void guardarEstiloCursoAction(p.id, { tipo: 'titulo' }, p.titulo).then((r) => {
          if (!r.ok) { show(r.error, undefined, 'bad'); return; }
          setProgramas((ps) => ps.map((x) => (x.id === p.id ? { ...x, nombre: p.nombre, titulo: p.titulo } : x)));
          router.refresh();
        });
      });
    }
    router.refresh();
  };

  const alto = seccion === 'classroom';
  const papel = esSeccionComunidad(seccion);
  /** Sin nada que ofrecer (no es admin) no hay menú: el clic derecho es el del navegador. */
  const conMenu = puedePersonalizar;

  return (
    <VarsCtx.Provider value={vars}>
    <div className={`cls${alto ? ' cls--alto' : ''}`} style={vars}>
      <style dangerouslySetInnerHTML={{ __html: CSS_CLIENTS }} />
      <header className="cls-cab">
        <div className="cls-fila">
          <Programa programas={programas} actual={programa} hrefDe={(id) => hrefConPrograma(pathname, search, id)}
            onNuevo={puedePersonalizar ? () => setCreando(true) : null} onMenu={conMenu ? abrirMenu : null} />
          {puedePersonalizar && programa && (
            <div className="cls-der">
              <Personalizar programa={programa} onProbar={probar} onGuardar={guardar} />
            </div>
          )}
        </div>
        <nav className="cls-tabs" aria-label="Classroom">
          {seccionesDe(plataforma).map((s) => {
            const href = hrefSeccion(s.id, search);
            return (
              <Link key={s.id} href={href} className="cls-tab" aria-current={seccion === s.id ? 'page' : undefined}
                scroll={false} onClick={(e) => alClicTab(e, href, s.id)}>
                {s.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className={`cls-cuerpo${papel ? ' cls-cuerpo--papel' : ''}`}>{children}</div>
      {/* El nombre se pide afuera de todo (la hoja del curso le saca la piel a los botones de un diálogo). */}
      {creando && <NuevoProducto onCerrar={cerrarCreando} />}
      {menu && programaDelMenu && itemsDelMenu.length > 0 && (
        <MenuContextual punto={menu.punto} items={itemsDelMenu} etiqueta={`Opciones de ${programaDelMenu.nombre}`}
          titulo={programaDelMenu.nombre} onElegir={elegirEnPrograma} onCerrar={() => setMenu(null)} />
      )}
      {renombrando && (
        <RenombrarPrograma programa={renombrando} onCerrar={cerrarRenombrar} onListo={(t) => void renombrado(renombrando, t)} />
      )}
      {confirmNode}
      <Toast state={toast} onClose={clear} />
    </div>
    </VarsCtx.Provider>
  );
}

/** El sello del programa: su portada, o la inicial sobre el acento (el «logo» de un grupo de Skool). */
function Sello({ p }: { p: ProgramaClients }) {
  const t = tapaDe(p.portada);
  const fondo: CSSProperties = t.tapa ? { backgroundImage: `url("${t.tapa}")` } : t.fondo ? { background: t.fondo } : {};
  const color = hexValido(p.acento) ?? ACENTO_DEFAULT;
  return (
    <span className="cls-sello" aria-hidden style={{ backgroundColor: color, ...fondo }}>
      {t.tapa || t.fondo ? null : iniciales(p.nombre, 1, '·')}
    </span>
  );
}

function Programa({ programas, actual, hrefDe, onNuevo, onMenu }: {
  programas: ProgramaClients[];
  actual: ProgramaClients | null;
  /** El link de cada programa: la MISMA sub-tab con otro `?producto=`. */
  hrefDe: (id: number) => string;
  /** «+ Nuevo producto» (un admin); `null` = no se ofrece. */
  onNuevo: (() => void) | null;
  /** El menú de un programa (su «…» y su clic derecho); `null` = sin menú. */
  onMenu: AbrirMenuPrograma | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const ancla = useRef<HTMLButtonElement>(null);
  if (!actual) return <span className="cls-prog"><span className="cls-nombre">Classroom</span></span>;
  // El clic derecho en el programa que se mira abre SU menú (el mismo del «…» de su fila).
  const clicDerecho = onMenu ? (e: MouseEvent<HTMLElement>) => { e.preventDefault(); onMenu(actual.id, { x: e.clientX, y: e.clientY }); } : undefined;
  // Con UN programa y nada que crear no hay desplegable: un botón que abre una lista de uno promete otra cosa.
  if (programas.length < 2 && !onNuevo) {
    return <span className="cls-prog" onContextMenu={clicDerecho}><Sello p={actual} /><span className="cls-nombre">{actual.nombre}</span></span>;
  }
  return (
    <>
      <button ref={ancla} type="button" className="cls-prog" aria-haspopup="menu" aria-expanded={abierto}
        aria-label={`${actual.nombre}: cambiar de programa`} onClick={() => setAbierto((a) => !a)} onContextMenu={clicDerecho}>
        <Sello p={actual} />
        <span className="cls-nombre">{actual.nombre}</span>
        <svg className="cls-flecha" width="14" height="14" viewBox="0 0 16 16" aria-hidden>
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {abierto && (
        <Pop ancla={ancla.current} onCerrar={() => setAbierto(false)} etiqueta="Programas">
          <p className="cls-pop-tit">Programas</p>
          {programas.map((p) => (
            // La fila: el link y, para un admin, su «…» (un botón adentro de un link no es HTML válido). El clic
            // derecho en cualquier parte de la fila abre el mismo menú, en el punto del cursor.
            <div key={p.id} className="cls-fila-prog"
              onContextMenu={onMenu ? (e) => { e.preventDefault(); onMenu(p.id, { x: e.clientX, y: e.clientY }); } : undefined}>
              <Link href={hrefDe(p.id)} scroll={false} role="menuitem" className="cls-opcion"
                aria-current={p.id === actual.id ? 'page' : undefined} onClick={() => setAbierto(false)}>
                <Sello p={p} />
                <span>{p.nombre}</span>
              </Link>
              {onMenu && (
                <button type="button" className="cls-mas" aria-label={`Opciones de ${p.nombre}`} title="Opciones"
                  onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onMenu(p.id, { x: r.left, y: r.bottom + 4 }); }}>
                  &hellip;
                </button>
              )}
            </div>
          ))}
          {onNuevo && (
            <>
              <div className="cls-sep" />
              <button type="button" role="menuitem" className="cls-opcion cls-opcion--nuevo" onClick={() => { setAbierto(false); onNuevo(); }}>
                + Nuevo producto
              </button>
            </>
          )}
        </Pop>
      )}
    </>
  );
}

/**
 * «Renombrar» un programa desde su menú: el NOMBRE DEL CURSO (el título puesto a mano, `curso_estilo`), el mismo que
 * se cambia con un clic en la portada del Classroom. Nunca el producto del CRM (lib/curso-nombre.ts: el producto no
 * nombra un curso). Vacío = vuelve al de su oferta.
 */
function RenombrarPrograma({ programa, onCerrar, onListo }: {
  programa: ProgramaClients;
  onCerrar: () => void;
  onListo: (nombre: string | null) => void;
}) {
  const id = useId();
  const [nombre, setNombre] = useState(programa.nombre === SIN_NOMBRE_EQUIPO ? '' : programa.nombre);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const cerrar = useCerrarEstable(onCerrar, guardando);
  useFocoInicial(id);
  const guardar = async () => {
    if (guardando) return;
    setGuardando(true);
    setError('');
    const r = await guardarEstiloCursoAction(programa.id, { tipo: 'titulo' }, nombre.trim() || null)
      .catch(() => ({ ok: false as const, error: 'Sin conexión.' }));
    setGuardando(false);
    if (!r.ok) { setError(r.error); return; }
    onListo(r.valor);
  };
  return (
    <Modal titulo="Renombrar" ancho={440} onCerrar={cerrar}
      pie={(
        <>
          <Button variant="secondary" disabled={guardando} onClick={onCerrar}>No cambiar</Button>
          <Button variant="primary" loading={guardando} onClick={() => void guardar()}>Guardar nombre</Button>
        </>
      )}>
      <Field label="Nombre del curso" htmlFor={id} hint="Lo ven tus alumnos. Vacío, vuelve al de su oferta.">
        <Input id={id} value={nombre} placeholder={SIN_NOMBRE_EQUIPO} disabled={guardando} maxLength={TOPE_TITULO_CURSO}
          onChange={(e) => { setNombre(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void guardar(); } }} />
      </Field>
      {error && <p style={{ margin: '10px 0 0', color: 'var(--bad)', fontSize: 13 }} role="alert">{error}<ReportarASoporte /></p>}
    </Modal>
  );
}

function Personalizar({ programa, onProbar, onGuardar }: {
  programa: ProgramaClients;
  onProbar: (ajuste: AjusteVisual, valor: string | null) => void;
  onGuardar: (ajuste: AjusteVisual, valor: string | null, antes?: string | null) => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const ancla = useRef<HTMLButtonElement>(null);
  const acento = hexValido(programa.acento) ?? ACENTO_DEFAULT;
  // «Otro color»: el selector nativo dispara un cambio por movimiento; se VE en el acto y se guarda al quedarse quieto.
  // El «Deshacer» vuelve al color de ANTES del primer movimiento, no a un tono a mitad de camino.
  const timer = useRef<number | undefined>(undefined);
  const otroAntes = useRef<{ v: string | null } | null>(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const elegirAcento = (hex: string) => {
    // Un color de la paleta CANCELA el «otro» que esperaba guardarse (si no, a los 450 ms lo pisaba).
    window.clearTimeout(timer.current);
    const antes = otroAntes.current ? otroAntes.current.v : programa.acento;
    otroAntes.current = null;
    void onGuardar({ tipo: 'acento' }, hex === ACENTO_DEFAULT ? null : hex, antes);
  };
  const probarOtro = (hex: string) => {
    if (!otroAntes.current) otroAntes.current = { v: programa.acento };
    onProbar({ tipo: 'acento' }, hex);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const antes = otroAntes.current?.v ?? null;
      otroAntes.current = null;
      void onGuardar({ tipo: 'acento' }, hex, antes);
    }, 450);
  };
  const enPaleta = ACENTOS.some((a) => a.hex.toLowerCase() === acento.toLowerCase());
  return (
    <>
      <button ref={ancla} type="button" className="cls-btn" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
        Personalizar
      </button>
      {abierto && (
        <Pop ancla={ancla.current} onCerrar={() => setAbierto(false)} etiqueta="Personalizar" alinear="derecha">
          <p className="cls-pop-tit">Color</p>
          <div className="cls-colores">
            {ACENTOS.map((a) => (
              <button key={a.hex} type="button" className="cls-color" title={a.nombre} aria-label={a.nombre}
                aria-pressed={a.hex.toLowerCase() === acento.toLowerCase()} style={{ background: a.hex }}
                onClick={() => elegirAcento(a.hex)} />
            ))}
            {/* Cualquier otro color. Uno muy oscuro vuelve aclarado: el acento es FONDO de texto oscuro (`acentoLegible`). */}
            <label className="cls-color cls-color--otro" title="Otro color" data-on={!enPaleta}>
              <input type="color" value={acento} aria-label="Otro color" onChange={(e) => probarOtro(e.target.value)} />
            </label>
          </div>
          <div className="cls-sep" />
          <p className="cls-pop-tit">Fuente</p>
          <div style={{ padding: '0 6px 6px' }}>
            <SelectorFuente actual={programa.fuente} onElegir={(id) => void onGuardar({ tipo: 'fuente' }, id, programa.fuente)} />
          </div>
          <p className="cls-nota">Se ve en todo el programa: Classroom, Community y el portal de tus clientes.</p>
        </Pop>
      )}
    </>
  );
}

/**
 * Un panel anclado. Va por portal al `body` (adentro de la cabecera lo recortaría cualquier `overflow`), anotado
 * en la pila de modales (AGENTS.md: «un popover anclado también es una capa») y con su propio Escape, que frena
 * con `stopImmediatePropagation` para que no cierre lo de abajo.
 */
function Pop({ ancla, onCerrar, etiqueta, alinear = 'izquierda', children }: {
  ancla: HTMLElement | null;
  onCerrar: () => void;
  etiqueta: string;
  alinear?: 'izquierda' | 'derecha';
  children: ReactNode;
}) {
  const capa = useCapaModal(true, { anidada: true });
  const vars = useContext(VarsCtx);
  const caja = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const cerrar = useRef(onCerrar);
  useEffect(() => { cerrar.current = onCerrar; }, [onCerrar]);

  useEffect(() => {
    const ubicar = () => {
      const r = ancla?.getBoundingClientRect();
      const c = caja.current;
      if (!r || !c) return;
      const w = c.offsetWidth;
      const h = c.offsetHeight;
      let left = alinear === 'derecha' ? r.right - w : r.left;
      left = Math.max(16, Math.min(left, window.innerWidth - w - 16));
      let top = r.bottom + 8;
      if (top + h > window.innerHeight - 16 && r.top - 8 - h > 16) top = r.top - 8 - h;
      setPos({ top, left });
    };
    ubicar();
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    return () => { window.removeEventListener('resize', ubicar); window.removeEventListener('scroll', ubicar, true); };
  }, [ancla, alinear]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !capa.esElDeArriba()) return;
      e.stopImmediatePropagation();
      cerrar.current();
    };
    const afuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (caja.current?.contains(t) || ancla?.contains(t)) return;
      cerrar.current();
    };
    document.addEventListener('keydown', tecla, true);
    document.addEventListener('pointerdown', afuera, true);
    return () => { document.removeEventListener('keydown', tecla, true); document.removeEventListener('pointerdown', afuera, true); };
  }, [capa, ancla]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    // `ugc-menu`: el desplegable de la fuente (SelectorFuente) monta su lista adentro del menú que lo contiene. Sin
    // esto la lista va al `body`, y un clic en una fuente contaba como un clic AFUERA: cerraba el panel sin elegir.
    <div ref={caja} className="cls cls-pop ugc-menu" role="menu" aria-label={etiqueta}
      style={{ ...vars, zIndex: capa.z, top: pos?.top ?? 0, left: pos?.left ?? 0, opacity: pos ? 1 : 0 }}>
      {children}
    </div>,
    document.body,
  );
}
