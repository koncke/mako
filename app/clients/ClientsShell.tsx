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
//   · ⚠️ UN SOLO SELECTOR DE PROGRAMA, ÉSTE (f28: «me cambian los dos al mismo tiempo»; un curso es un producto). Con
//     «+ Nuevo producto» al final de la lista (sólo un admin), que también se mudó del Classroom. Cada programa es un
//     LINK y no un botón: la guarda de la lección a medio guardar del Classroom (`useLeccionAbierta`) ataja los links
//     antes de navegar, y un `router.push` desde un botón se la saltaba.
//
// ⚠️ LA VISTA PREVIA DEL ALUMNO (/clients/classroom/preview) VA SIN CABECERA: tiene su propia barra y es lo que ve
//    un cliente, que no tiene sub-tabs de nadie.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useSearchParams } from 'next/navigation';
import Link, { useRouter } from '@/app/_ui/Link';
import { Toast, useToast } from '@/app/_ui';
import { useCapaModal } from '@/app/_components/pila-modales';
import { ACENTOS, ACENTO_DEFAULT, hexValido, tapaDe, varsDeAcento } from '@/lib/curso-estilo';
import { varsDeFuente } from '@/app/_cursos/fuentes';
import { SelectorFuente, useHojasDeFuentes } from '@/app/_cursos/SelectorFuente';
import { guardarEstiloCursoAction } from '@/app/customer-success/curso/actions';
import { NuevoProducto } from '@/app/customer-success/curso/NuevoProducto';
import {
  SECCIONES_CLIENTS, esSeccionComunidad, esVistaPrevia, hrefConPrograma, hrefSeccion, seccionDeRuta,
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

export function ClientsShell({ programas: programasProp, puedePersonalizar, children }: {
  programas: ProgramaClients[];
  /** Admin del workspace: el guard de verdad lo vuelve a hacer la action. */
  puedePersonalizar: boolean;
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

  if (esVistaPrevia(pathname) || !seccion) return <>{children}</>;

  /** Entre dos pestañas de la comunidad no se navega: la comunidad lee su pestaña de la URL (D5). */
  const alClicTab = (e: MouseEvent<HTMLAnchorElement>, destino: string, id: (typeof SECCIONES_CLIENTS)[number]['id']) => {
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

  const alto = seccion === 'classroom';
  const papel = esSeccionComunidad(seccion);

  return (
    <VarsCtx.Provider value={vars}>
    <div className={`cls${alto ? ' cls--alto' : ''}`} style={vars}>
      <style dangerouslySetInnerHTML={{ __html: CSS_CLIENTS }} />
      <header className="cls-cab">
        <div className="cls-fila">
          <Programa programas={programas} actual={programa} hrefDe={(id) => hrefConPrograma(pathname, search, id)}
            onNuevo={puedePersonalizar ? () => setCreando(true) : null} />
          {puedePersonalizar && programa && (
            <div className="cls-der">
              <Personalizar programa={programa} onProbar={probar} onGuardar={guardar} />
            </div>
          )}
        </div>
        <nav className="cls-tabs" aria-label="Clients">
          {SECCIONES_CLIENTS.map((s) => {
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
      {t.tapa || t.fondo ? null : (p.nombre.trim()[0] ?? '·').toUpperCase()}
    </span>
  );
}

function Programa({ programas, actual, hrefDe, onNuevo }: {
  programas: ProgramaClients[];
  actual: ProgramaClients | null;
  /** El link de cada programa: la MISMA sub-tab con otro `?producto=`. */
  hrefDe: (id: number) => string;
  /** «+ Nuevo producto» (un admin); `null` = no se ofrece. */
  onNuevo: (() => void) | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const ancla = useRef<HTMLButtonElement>(null);
  if (!actual) return <span className="cls-prog"><span className="cls-nombre">Clients</span></span>;
  // Con UN programa y nada que crear no hay desplegable: un botón que abre una lista de uno promete otra cosa.
  if (programas.length < 2 && !onNuevo) {
    return <span className="cls-prog"><Sello p={actual} /><span className="cls-nombre">{actual.nombre}</span></span>;
  }
  return (
    <>
      <button ref={ancla} type="button" className="cls-prog" aria-haspopup="menu" aria-expanded={abierto}
        aria-label={`${actual.nombre}: cambiar de programa`} onClick={() => setAbierto((a) => !a)}>
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
            <Link key={p.id} href={hrefDe(p.id)} scroll={false} role="menuitem" className="cls-opcion"
              aria-current={p.id === actual.id ? 'page' : undefined} onClick={() => setAbierto(false)}>
              <Sello p={p} />
              <span>{p.nombre}</span>
            </Link>
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
