'use client';

// =============================================================================
// PantallaCrear — UN solo diseño para todas las tabs de Create (29/10/2026)
// =============================================================================
// Martín, 29/10/2026, textual en lo central: «para todas las secciones de "create" no quiero otras tabs... En todas las tabs
// el mismo diseño de la barra lateral del chat de MaKo SIEMPRE abierto a la izquierda, y que los diferentes proyectos sean
// todos como en "Web generator" que estén al costado en la tab de chat con la flecha para ver a todos y que se pueda crear una
// nueva... En "nueva" dependiendo de qué tab, deberías ponerme TEMPLATES con la sección de ¿Qué vas a crear hoy?... que en
// varias ya las tienes».
//
// Es la tarjeta izquierda del Web Generator (app/web-generator/editor/EditorLanding.tsx, `.gma-izq`), sacada a una pieza:
//   · la tarjeta FLOTA a la izquierda y NO se cierra (24/10/2026 en el Web Generator: «La sidebar del chat de MaKo NO se debe
//     poder cerrar nunca»). En un EDITOR (Video, Image: `plegable`) se pliega a una barra fina con la estrella, que la abre con
//     un clic (29/10/2026, tarde: «el chat a la izquierda le come lugar al editor»); se recuerda por tab y el chat sigue
//     montado detrás. De entrada es el chat de MaKo: la conversación «Cerebro» de la persona
//     (`ConversacionCerebro`, app/_chat/MakoEnLaTab.tsx), la MISMA del Ops Center, que reparte. Una tab con un chat propio
//     que edita lo abierto (el Video Editor) lo pasa en `chat`;
//   · la «←» de su cabecera da vuelta la tarjeta a la LISTA de proyectos SIN navegar (paneles/PanelLandings.tsx): buscar, la
//     estrella para volver al chat, «Nuevo …» como primer renglón y los proyectos;
//   · «Nuevo …» NO navega: el centro muestra «¿Qué vas a crear hoy?» (la caja de siempre, `CajaPedido`) con las PLANTILLAS de
//     la tab, y la pieza abierta queda montada detrás (volver es instantáneo). Sin nada abierto, el centro ES eso: la portada
//     de la tab es elegir qué crear, como el Panel del Web Generator. Cada tarjeta muestra el EJEMPLO lleno de un negocio
//     ficticio (./TarjetaPlantilla.tsx, 29/10/2026), en una sección por `grupo`;
//   · lo que se escribe en la caja va al chat de MaKo (sale al Cerebro, que crea) salvo que la tab lo tome (`onPedido`).
// Sin tabs internas en la barra de arriba (nav.ts: Create sin `secciones`) y sin onboarding: la plantilla es el arranque.
// En el teléfono no entran las dos columnas: arriba el interruptor «MaKo | <la tab>» y se ve una por vez (crear.css).
// Las reglas puras (qué se ve al buscar, qué ocupa el centro): ./reglas.ts, con tests/crear-pantalla.test.ts.
// =============================================================================

import './crear.css';
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { PlegarChatCtx } from '@/app/admin/operaciones/PanelChat';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { ConversacionCerebro } from '@/app/_chat/MakoEnLaTab';
import { CajaPedido, CSS_CAJA_PEDIDO, CSS_TOKENS_CASA, TITULO_CAJA } from '@/app/web-generator/CajaPedido';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { useAppDeEscritorio } from '@/app/_chat/useAppDeEscritorio';
import type { EntidadChat } from '@/lib/chat-desde';
import {
  SIN_NOMBRE, centroDe, haceCuanto, proyectosVisibles, seccionesDeCrear,
  type AccionProyecto, type CaraTarjeta, type PlantillaCrear, type ProyectoCrear, type VistaMovil,
} from './reglas';
import { TarjetaPlantilla } from './TarjetaPlantilla';

export type { AccionProyecto, PlantillaCrear, ProyectoCrear } from './reglas';
// ⚠️ `ESTILO_PAGINA_CREAR` NO se re-exporta desde acá: lo usan las <Pagina> de los server components, y un VALOR de un módulo
//    'use client' llega al server como una referencia de cliente, no como el objeto (AGENTS.md, «'use client' es una frontera
//    de DATOS»). Se importa de './reglas'.

export type PropsPantallaCrear = {
  /** El nombre de la tab en la barra («Video», «Image»): el interruptor del teléfono y desde dónde le escribe a MaKo. */
  tab: string;
  /** El primer renglón de la lista y el título de la portada vacía: «Nuevo video», «Nuevo diseño». */
  nuevo: string;
  /** Los proyectos de la tab; `null` mientras cargan. */
  proyectos: readonly ProyectoCrear[] | null;
  /** «No pude leerlos» no es «no tenés ninguno»: se dice y se ofrece reintentar. */
  errorProyectos?: string | null;
  onReintentar?: () => void;
  /** El id del proyecto abierto (su renglón queda marcado). */
  actual?: string | null;
  /** Abrir un proyecto sin `href` (los que viven en el navegador y abren sin cambiar de ruta). */
  onAbrir?: (p: ProyectoCrear) => void;
  /** Lo que va al pie de la lista («Ver todo», la papelera), si la tab tiene algo. */
  pieLista?: ReactNode;
  /** Las plantillas de «¿Qué vas a crear hoy?». Una tarjeta crea con esa plantilla (`onPlantilla`). */
  plantillas: readonly PlantillaCrear[];
  /** Crear con una plantilla. Si devuelve un error (texto), se muestra; mientras corre, la tarjeta dice «Creando». */
  onPlantilla: (p: PlantillaCrear) => void | string | null | Promise<void | string | null>;
  /** El título de la grilla («Plantillas», «Tamaños»); con `grupo`, el de las que no traen ninguno. */
  tituloPlantillas?: string;
  /** La miniatura propia de una tab (Video dibuja la plantilla con `MiniaturaPlantilla`): si devuelve algo, va en lugar de
   *  la hoja, la imagen o el marco. `activa`: el mouse o el foco está sobre esa tarjeta. */
  miniatura?: (p: PlantillaCrear, activa: boolean) => ReactNode;
  /** Los ejemplos que se escriben solos en la caja («Un reel de 30 s sobre…»). */
  ejemplos: readonly string[];
  /** Lo que la tab pone entre la caja y las plantillas de «¿Qué vas a crear hoy?» (Image: los carruseles que funcionan,
   *  4/11/2026). Sin esto, nada: las demás tabs se ven igual. */
  arribaDePlantillas?: ReactNode;
  /** «Ver ejemplo» de una plantilla con `verEjemplo` (Image: los carruseles por tipo). Sin esto, no se dibuja el botón. */
  onVerEjemplo?: (p: PlantillaCrear) => void;
  /** Lo escrito en la caja. Sin esto, va al chat de MaKo (al Cerebro, que crea) y la tarjeta vuelve al chat. Si devuelve un
   *  texto, es un error y se muestra debajo de la caja; si no, «Nuevo …» se cierra como al usar una plantilla. */
  onPedido?: (texto: string) => void | string | null | Promise<void | string | null>;
  /** En el teléfono, qué se ve después de crear: la pieza (un editor) o el chat (Offer, donde MaKo pregunta). */
  trasCrear?: VistaMovil;
  /** Un chat propio en vez del Cerebro (el del Video Editor, que edita lo abierto): recibe la «←» para su cabecera. */
  chat?: (volver: ReactNode) => ReactNode;
  /** Lo que la pantalla tiene abierto, para el Cerebro (el chip «desde Video › Mi reel»). */
  entidad?: EntidadChat | null;
  /**
   * Lo que MaKo dice PRIMERO en la tarjeta del Cerebro (5/11/2026, docs/mako-iniciativa/plan.md T4): la apertura de la tab
   * (`<AperturaMako>` de app/_chat/AperturaMako.tsx), que `ConversacionCerebro` ya sabe dibujar. Sin esto, la del Ops Center.
   */
  apertura?: ReactNode;
  /** «Nuevo …» desde afuera (un `?nuevo=` en la URL): la pantalla arranca mostrando las plantillas. */
  creandoInicial?: boolean;
  /** Un EDITOR (Video, Image): con una pieza abierta, la tarjeta se puede plegar a una barra fina para darle el ancho. */
  plegable?: boolean;
  /** La pieza abierta (el editor). Sin esto, el centro es «¿Qué vas a crear hoy?». */
  children?: ReactNode;
};

/**
 * La tarjeta plegada, por tab y en el navegador (`mk-crear-plegada:<tab>`): Martín la pliega una vez en el Video Editor y
 * queda así. Sin almacenamiento (ventana privada), se recuerda mientras dure la página. `useSyncExternalStore`, como la
 * sidebar (app/_components/Sidebar.tsx): el server dibuja la tarjeta abierta y nadie hace `setState` en un efecto.
 */
const clavePlegada = (tab: string) => `mk-crear-plegada:${tab}`;
const plegadaEnMemoria = new Map<string, boolean>();
const avisosPlegada = new Set<() => void>();
function leerPlegada(tab: string): boolean {
  try {
    const v = window.localStorage.getItem(clavePlegada(tab));
    if (v != null) return v === 'si';
  } catch { /* sin almacenamiento: lo de la memoria */ }
  return plegadaEnMemoria.get(tab) ?? false;
}
function guardarPlegada(tab: string, v: boolean) {
  plegadaEnMemoria.set(tab, v);
  try { window.localStorage.setItem(clavePlegada(tab), v ? 'si' : 'no'); } catch { /* sin almacenamiento: vale la memoria */ }
  for (const avisar of avisosPlegada) avisar();
}
/**
 * Abre la tarjeta de una tab que se plegó (9/11/2026, la tab Video): cuando MaKo tiene una pregunta para la persona (un paso de
 * una plantilla guiada) y la tarjeta está plegada, la pregunta quedaba adentro de una sección escondida y no se veía nada. Lo
 * llama quien pregunta; la persona la puede volver a plegar.
 */
export function desplegarCrear(tab: string): void {
  if (leerPlegada(tab)) guardarPlegada(tab, false);
}

function usePlegada(tab: string): boolean {
  return useSyncExternalStore(
    (avisar) => { avisosPlegada.add(avisar); return () => { avisosPlegada.delete(avisar); }; },
    () => leerPlegada(tab),
    () => false,
  );
}

const IconoMas = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
);
const IconoPieza = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" /></svg>
);

export function PantallaCrear(p: PropsPantallaCrear) {
  const { tab, nuevo, children } = p;
  const hayPieza = children != null && children !== false;
  const [cara, setCara] = useState<CaraTarjeta>('chat');
  const [creando, setCreando] = useState(!!p.creandoInicial);
  // En el teléfono, de entrada la pieza (lo que se vino a hacer); sin nada abierto, las plantillas, que también son «la pieza».
  const [movil, setMovil] = useState<VistaMovil>('pieza');
  // Lo escrito en «¿Qué vas a crear hoy?» sale al Cerebro UNA vez por `vez` (el mismo contrato que `MakoEnLaTab`).
  const [pedido, setPedido] = useState<{ texto: string; vez: number } | null>(null);
  const centro = centroDe(hayPieza, creando);
  // Otro proyecto abierto (un renglón, un link, «Generar con IA» que vuelve): «Nuevo …» se cierra. Sólo al CAMBIAR: un
  // `creandoInicial` no se pisa al montar.
  const actualAntes = useRef(p.actual ?? null);
  useEffect(() => {
    if (actualAntes.current === (p.actual ?? null)) return;
    actualAntes.current = p.actual ?? null;
    setCreando(false);
  }, [p.actual]);

  // Volver al chat es volver a la pieza abierta: «Nuevo …» se cierra (el mismo gesto que el Web Generator).
  const alChat = useCallback(() => { setCara('chat'); if (hayPieza) setCreando(false); }, [hayPieza]);
  const alNuevo = useCallback(() => { setCreando(true); setMovil('pieza'); }, []);
  const { onPedido, trasCrear = 'pieza' } = p;
  /** Creado (con una plantilla o con lo escrito): «Nuevo …» se cierra y la tarjeta vuelve al chat, el del proyecto nuevo. */
  const alCreado = useCallback(() => { setCreando(false); setCara('chat'); setMovil(trasCrear); }, [trasCrear]);
  const alPedido = useCallback(async (texto: string): Promise<string | null> => {
    if (onPedido) {
      const r = await onPedido(texto);
      if (typeof r === 'string' && r) return r;
      alCreado();
      return null;
    }
    // Sin prefijo: el Cerebro ya sabe desde qué tab se le escribe (`desde`, el chip del mensaje).
    setPedido({ texto, vez: Date.now() });
    setCara('chat');
    setMovil('mako');
    return null;
  }, [onPedido, alCreado]);

  // ¿Quién está en la tarjeta? El chat propio de la tab habla de lo ABIERTO (el Video Editor edita el proyecto): mientras se
  // crea algo nuevo y la tab no toma lo escrito (`onPedido`), la tarjeta es el Cerebro, que crea y reparte. Si no, lo escrito
  // en «¿Qué vas a crear hoy?» se perdía (iba a un Cerebro que no estaba montado) o editaba lo abierto.
  const conCerebro = !p.chat || (centro === 'nueva' && !onPedido);

  // Plegada sólo con la pieza a la vista: en «Nuevo …» la tarjeta es el chat que crea, y sin pieza no hay a quién darle el ancho.
  const sePliega = !!p.plegable && hayPieza && centro === 'pieza';
  const plegada = usePlegada(tab) && sePliega;
  const plegar = useCallback(() => guardarPlegada(tab, true), [tab]);

  const volver = (
    <button type="button" className="cr-volver" onClick={() => setCara('lista')} title={`Ver tus proyectos de ${tab}`} aria-label={`Ver tus proyectos de ${tab}`}>←</button>
  );

  return (
    <div className="cr" data-movil={movil}>
      <div className="cr-movil" role="group" aria-label="Qué ver">
        <button type="button" className="cr-movil__boton" aria-pressed={movil === 'mako'} onClick={() => setMovil('mako')}>
          <Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo="despierto" size={20} /> MaKo
        </button>
        <button type="button" className="cr-movil__boton" aria-pressed={movil === 'pieza'} onClick={() => setMovil('pieza')}>{tab}</button>
      </div>

      {/* Un <section> y no un <aside>: con la barra de la agencia, `[data-barra-agencia] aside` (app/globals.css) le fuerza a
          todo <aside> el alto de la ventana y la caja quedaba fuera de la vista (medido en el Web Generator, 22/10/2026). */}
      {plegada && (
        // La barra fina ENTERA abre el chat: un clic en cualquier parte, como el riel plegado de la sidebar.
        <button type="button" className="cr-riel" onClick={() => guardarPlegada(tab, false)} title="Abrir el chat con MaKo" aria-label="Abrir el chat con MaKo">
          <Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo="despierto" size={30} />
          <span className="cr-riel__rotulo">MaKo</span>
        </button>
      )}
      <section role="complementary" className="cr-tarjeta" hidden={plegada} aria-label={cara === 'chat' ? `MaKo en ${tab}` : `Tus proyectos de ${tab}`}>
        <PlegarChatCtx.Provider value={sePliega ? plegar : null}>
        {cara === 'lista' ? (
          <ListaDeProyectos {...p} creando={centro === 'nueva'} onNuevo={alNuevo} onChat={alChat}
            onElegido={() => { setCreando(false); setCara('chat'); setMovil('pieza'); }} />
        ) : !conCerebro && p.chat ? p.chat(volver) : (
          // «MaKo» en la cabecera, como el chat propio de cada tab (el Image Editor, Offer): adentro es el Cerebro, que reparte.
          <ConversacionCerebro tab={tab} titulo="MaKo" antes={volver} apertura={p.apertura ?? null} entidad={p.entidad ?? null} pedido={pedido} onMandado={() => setPedido(null)} />
        )}
        </PlegarChatCtx.Provider>
      </section>

      <div className="cr-centro">
        {hayPieza && <div className="cr-pieza" hidden={centro === 'nueva'}>{children}</div>}
        {centro === 'nueva' && (
          <NuevaCrear tab={tab} plantillas={p.plantillas} onPlantilla={p.onPlantilla} titulo={p.tituloPlantillas} miniatura={p.miniatura}
            ejemplos={p.ejemplos} onPedido={alPedido} onCreado={alCreado} arriba={p.arribaDePlantillas} onVerEjemplo={p.onVerEjemplo} />
        )}
      </div>
    </div>
  );
}

/** La otra cara de la tarjeta: la lista de proyectos (copiada de paneles/PanelLandings.tsx del Web Generator). */
function ListaDeProyectos({ tab, nuevo, proyectos, errorProyectos, onReintentar, actual, onAbrir, pieLista, creando, onNuevo, onChat, onElegido }: PropsPantallaCrear & {
  creando: boolean; onNuevo: () => void; onChat: () => void; onElegido: () => void;
}) {
  const [busca, setBusca] = useState('');
  const visibles = useMemo(() => proyectosVisibles(proyectos ?? [], busca), [proyectos, busca]);
  // El «hace cuánto» se calcula una vez por apertura: no hace falta que corra solo.
  const [ahora] = useState(() => Date.now());
  return (
    <div className="cr-lista">
      <div className="cr-lista__cab">
        <input className="cr-lista__busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label={`Buscar en tus proyectos de ${tab}`} />
        <button type="button" className="cr-lista__mako" onClick={onChat} title="Volver al chat con MaKo" aria-label="Volver al chat con MaKo">
          <Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo="despierto" size={26} />
        </button>
      </div>
      <nav className="cr-lista__items" aria-label={`Tus proyectos de ${tab}`}>
        <button type="button" className="cr-item cr-item--nuevo" aria-current={creando ? 'true' : undefined} onClick={onNuevo}>
          <span className="cr-item__ico"><IconoMas /></span><span className="cr-item__nombre">{nuevo}</span>
        </button>
        {errorProyectos ? (
          <p className="cr-lista__aviso" role="alert">
            No pude leer tus proyectos.{' '}
            {onReintentar && <button type="button" className="cr-item" style={{ display: 'inline-flex', width: 'auto', minHeight: 28 }} onClick={onReintentar}>Reintentar</button>}
            <ReportarASoporte />
          </p>
        ) : proyectos === null ? (
          <p className="cr-lista__aviso">Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className="cr-lista__aviso">{busca.trim() ? 'Ninguno se llama así.' : 'Todavía no hay ninguno.'}</p>
        ) : visibles.map((x) => {
          const marcado = !creando && x.id === actual;
          const dentro = (
            <>
              <span className="cr-item__ico"><IconoPieza /></span>
              <span className="cr-item__nombre">{x.nombre || SIN_NOMBRE}</span>
              {x.cuando ? <span className="cr-item__cuando">{haceCuanto(x.cuando, ahora)}</span> : null}
            </>
          );
          // El abierto no navega: vuelve a él (cierra «Nuevo …» y la tarjeta vuelve al chat).
          if (x.id === actual) {
            const abierto = <button type="button" className="cr-item" aria-current={marcado ? 'true' : undefined} onClick={onElegido} title={x.nombre || SIN_NOMBRE}>{dentro}</button>;
            return x.menu?.length
              ? <div key={x.id} className="cr-fila">{abierto}<MenuProyecto nombre={x.nombre || SIN_NOMBRE} acciones={x.menu} /></div>
              : <Fragment key={x.id}>{abierto}</Fragment>;
          }
          const renglon = x.href
            // Al irse a otro, la tarjeta vuelve al chat (el de ESE proyecto), como en el Web Generator.
            ? <Link href={x.href} className="cr-item" title={x.nombre || SIN_NOMBRE} onClick={onElegido}>{dentro}</Link>
            : <button type="button" className="cr-item" onClick={() => { onAbrir?.(x); onElegido(); }} title={x.nombre || SIN_NOMBRE}>{dentro}</button>;
          return x.menu?.length
            ? <div key={x.id} className="cr-fila">{renglon}<MenuProyecto nombre={x.nombre || SIN_NOMBRE} acciones={x.menu} /></div>
            : <Fragment key={x.id}>{renglon}</Fragment>;
        })}
      </nav>
      {pieLista ? <div className="cr-lista__pie">{pieLista}</div> : null}
    </div>
  );
}

/** El «⋯» de un renglón: un menú chico con las acciones del proyecto. Eliminar va en rojo y pide confirmar. */
function MenuProyecto({ nombre, acciones }: { nombre: string; acciones: readonly AccionProyecto[] }) {
  const [abierto, setAbierto] = useState(false);
  const [haciendo, setHaciendo] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('pointerdown', fuera);
    window.addEventListener('keydown', tecla);
    return () => { window.removeEventListener('pointerdown', fuera); window.removeEventListener('keydown', tecla); };
  }, [abierto]);
  const hacer = async (a: AccionProyecto) => {
    if (a.confirmar && !window.confirm(a.confirmar)) return;
    setAbierto(false);
    setHaciendo(true);
    try { await a.hacer(); } finally { setHaciendo(false); }
  };
  return (
    <div className="cr-menu" ref={raiz}>
      <button type="button" className="cr-menu__boton" aria-haspopup="menu" aria-expanded={abierto} disabled={haciendo}
        aria-label={`Más opciones de ${nombre}`} title="Más opciones" onClick={() => setAbierto((v) => !v)}>
        {haciendo ? <span className="cr-giro" /> : '⋯'}
      </button>
      {abierto && (
        <div className="cr-menu__lista" role="menu">
          {acciones.map((a) => (
            <button key={a.rotulo} type="button" role="menuitem" className="cr-menu__item" data-peligro={a.peligro ? 'si' : undefined} onClick={() => { void hacer(a); }}>{a.rotulo}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** «¿Qué vas a crear hoy?»: la caja de siempre (`CajaPedido`, la del Web Generator, Automations y el Dashboard) y las plantillas. */
export function NuevaCrear({ tab, plantillas, onPlantilla, titulo = 'Plantillas', miniatura, ejemplos, onPedido, onCreado, arriba, onVerEjemplo }: {
  tab: string; plantillas: readonly PlantillaCrear[]; onPlantilla: PropsPantallaCrear['onPlantilla']; titulo?: string;
  /** Lo de la tab entre la caja y las plantillas (`arribaDePlantillas`). */
  arriba?: ReactNode;
  /** «Ver ejemplo» de una plantilla con `verEjemplo`. */
  onVerEjemplo?: PropsPantallaCrear['onVerEjemplo'];
  miniatura?: PropsPantallaCrear['miniatura'];
  ejemplos: readonly string[];
  /** Lo escrito en la caja; un texto de vuelta es un error. */
  onPedido: (texto: string) => Promise<string | null>;
  /** Una plantilla creó bien: quien monta cierra «Nuevo …». */
  onCreado?: () => void;
}) {
  const [valor, setValor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [usando, setUsando] = useState<string | null>(null);
  // La tarjeta con el mouse o el foco encima: la miniatura de una tab (Video) y el video de AI Avatar se mueven sólo ahí.
  const [activa, setActiva] = useState<string | null>(null);
  const secciones = useMemo(() => seccionesDeCrear(plantillas), [plantillas]);
  const idGrilla = useId();
  // Sin la app de escritorio no se escribe (25/10/2026, Martín: «En ningun chat, no solo en Ops Center»): la caja, quieta.
  const appEscritorio = useAppDeEscritorio();
  useEffect(() => { setError(null); }, [plantillas]);
  const usar = async (pl: PlantillaCrear) => {
    if (usando) return;
    setUsando(pl.id);
    setError(null);
    try {
      const r = await onPlantilla(pl);
      if (typeof r === 'string' && r) setError(r);
      else onCreado?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUsando(null);
    }
  };
  return (
    <div className="cr-nueva" role="region" aria-label={`Nuevo en ${tab}`}>
      <div className="cr-nueva__col">
        <div className="gp cp-casa">
          <style>{CSS_TOKENS_CASA + CSS_CAJA_PEDIDO}</style>
          <CajaPedido titulo={{ texto: TITULO_CAJA, nivel: 1 }} valor={valor} onValor={setValor}
            onEnviar={() => {
              const t = valor.trim();
              if (!t) return;
              setError(null);
              void onPedido(t).then((e) => { if (e) setError(e); else setValor(''); });
            }}
            ejemplos={ejemplos} animar placeholderQuieto="Pídeselo a MaKo" etiqueta={`Qué quieres crear en ${tab}`} onError={setError}
            bloqueo={appEscritorio.bloqueo} />
        </div>
        {error && <p className="cr-error" role="alert">{error}<ReportarASoporte /></p>}
        {arriba ?? null}
        {/* Una sección por `grupo`, en el orden en que llegan; sin grupos, una sola con el título de la grilla. */}
        {secciones.map((s, i) => (
          <section key={s.titulo ?? ''} className="cr-plantillas" aria-labelledby={`${idGrilla}-${i}`}>
            <h2 id={`${idGrilla}-${i}`} className="cr-plantillas__titulo">{s.titulo ?? titulo}</h2>
            <div className="cr-plantillas__grilla">
              {s.plantillas.map((pl) => {
                const tarjeta = (
                  <TarjetaPlantilla key={pl.id} pl={pl} activa={activa === pl.id} usando={usando} miniatura={miniatura}
                    onUsar={() => { void usar(pl); }} onActiva={(si) => setActiva((a) => (si ? pl.id : a === pl.id ? null : a))} />
                );
                // «Ver ejemplo» va AL LADO de la tarjeta (un botón no va adentro de otro), en la esquina de su miniatura.
                return pl.verEjemplo && onVerEjemplo ? (
                  <div key={pl.id} className="cr-plantilla-con">
                    {tarjeta}
                    <button type="button" className="cr-plantilla__ver" disabled={!!usando} onClick={() => onVerEjemplo(pl)}
                      aria-label={`Ver un ejemplo de ${pl.nombre}`}>Ver ejemplo</button>
                  </div>
                ) : tarjeta;
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
