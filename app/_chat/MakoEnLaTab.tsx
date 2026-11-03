'use client';

// =============================================================================
// MaKo en cada tab: la estrella abajo a la izquierda y, al tocarla, el Cerebro en un panel a la IZQUIERDA (21/10/2026)
// =============================================================================
// Martín (21/10, ~23:10), tres reglas para toda la app:
//   · «el chat de MaKo en las otras tabs se debe abrir siempre a la izquierda» (reemplaza lo del 18/10: «la barra fija a la
//     derecha, patrón Web Generator»);
//   · «los iconos de las criaturas siempre debe ser el icono de MaKo, se envía lo que sea que envíen al cerebro y ya el cerebro se
//     encarga de repartir»: el botón es la ESTRELLA y lo que se escribe cae en el chat «Cerebro» de la persona, el mismo del Ops
//     Center (lib/chat-mako-reglas.ts → JEFE_SECOND_BRAIN), que reparte. No abre un chat suelto por tab;
//   · «las criaturas, siempre, donde sea que estén deben tener su animación de movimiento, y parpadeo» (Muneco.tsx, centro.css).
// Es la conversación del Ops Center del cliente, con SUS piezas: el motor (app/second-brain/useChatCliente.ts), el panel
// (PanelChat.tsx), el hilo y la caja (app/second-brain/PiezasCliente.tsx). Cada tab la monta con `<MakoEnLaTab tab="CRM" />`.
// ⚠️ EL PANEL VA PEGADO A LA BARRA DE LA APP (app/_components/Sidebar.tsx, `[data-sidebar]`, 68 o 244 px), no al borde de la
//    pantalla: se mide al montar y cada vez que la barra cambia de ancho (se fija o se suelta). Desde el 25/10/2026 FLOTA, con
//    el marco del Dashboard (12 px de aire, bordes de 14, sombra; punto 12, «Unifica ese diseño»): ./chat.css.
// ⚠️ ABRIRLO PLIEGA LA BARRA (22/10/2026, Martín: «si abro a MaKo, se debería plegar la sidebar principal, para optimizar
//    espacios. Si antes la tenía desplegada y fija, al cerrar MaKo debe volver a su lugar»): ./mako-abierto.ts. Es un pliegue
//    temporal, como el del Ops Center: no pisa lo que la persona guardó.
// ⚠️ EL MOTOR SE MONTA SÓLO CON EL PANEL ABIERTO. Cerrada, desde el 29/10/2026 la estrella pide DOS cosas livianas, una vez por
//    página: la memoria de las aperturas (/api/aperturas) y si hay app y IA (`?suIA=1`), para su corto y su primera visita. Nada
//    del motor (la lista de chats, el hilo) hasta que se abre.
// ⚠️ ABIERTO, LA TAB LE DEJA EL LUGAR: el panel publica su ancho en `--ancho-panel-mako` (en <html>) y la tab lo usa de margen
//    izquierdo (el CRM, en su <main>); cerrado vuelve a 0. Lo que cada tab suma arriba del hilo (las sugerencias del CRM) va
//    en `arriba`, y su número en la estrella plegada, en `aviso` (pedido del chat CRM, 22/10/2026).
// ⚠️ UN PEDIDO DE LA TAB (`pedido`, chat CRM, 22/10/2026): el «Hacerlo» de una sugerencia que se revisa con MaKo abre el
//    panel y lo manda al Cerebro como un mensaje más, UNA vez por `vez`, cuando el hilo está listo. Cerrar antes lo suelta.
// ⚠️ LO QUE MAKO TERMINÓ EN OTRA TAB (chat Automations, 22/10/2026) suma al globito y, abierta, va arriba del hilo con su link
//    (TrabajosDeMako.tsx). El globito es lo que espera en la tab (`aviso`) más eso.
// ⚠️ La caja es la única: este archivo no arma ninguna (tests/chat-unico.test.ts).
// MAKO TOMA LA INICIATIVA (29/10/2026, docs/mako-iniciativa/): abierto, el hilo lleva la apertura del Cerebro o la de la tab
// (`apertura`), y la pregunta de la guía de la pestaña. CERRADA, la estrella también habla, sin montar el motor: pide UNA vez
// la memoria (/api/aperturas) y la app y la IA (`?suIA=1`), y con eso
//   · la PRIMERA VISITA de la persona a la tab, con algo que decir y nada encima, se abre sola UNA vez (D3 del plan);
//   · si no, dice el `corto` de la apertura en un globo a su lado, como mucho uno por día en toda la app;
//   · la primera vez con la guía de la tab, el globo trae su pregunta («¿Quieres que te ayude…?») con sus botones.
// Las tabs con su propio arranque a la vista (el checklist de Clientes, la charla del Media Buyer, el modal del Calendario, la
// hoja en blanco del Dashboard) no se abren solas ni dicen el corto: serían dos guías en una pantalla.
// `data-mako-chat` en la estrella y en el panel: el velo de la guía les deja un hueco (el chat se sigue viendo).

import '@/app/admin/operaciones/centro.css';
import './chat.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal } from '@/app/_ui';
import { profundidadModales, useCapaModal, useProfundidadModales, zEncimaDeModales } from '@/app/_components/pila-modales';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { BarraFijados, InfoMensaje, MenuMensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { useChatCliente } from '@/app/second-brain/useChatCliente';
import { CajaDelCliente, HiloDelCliente, estadoDelCliente, useAperturaDelCerebro } from '@/app/second-brain/PiezasCliente';
import { useGuia, useGuiaEnElChat } from '@/app/_ui/guia/store';
import { GloboDeLaEstrella } from './GloboDeLaEstrella';
import { anotarApertura, appYIAReciente, leerAppYIA, useMemoriaAperturas } from './aperturas-memoria';
import { aperturaOps, type HechosOps } from '@/lib/aperturas/ops';
import { CLAVE_CORTO, claveApertura, claveEstrella, puedeHablar, respuestasDeMemoria } from '@/lib/aperturas/reglas';
import { ESPERA_PREGUNTA_MS } from '@/lib/guia/reglas';
import { JEFE_SECOND_BRAIN, type ElegidoChat } from '@/lib/chat-mako-reglas';
import { etiquetaDesde, type Desde, type EntidadChat, type ModoChat } from '@/lib/chat-desde';
import { ModosMako } from '@/app/dashboard/ModosMako';
import { BloqueDePreguntas, type PreguntaDeLaTab } from '@/app/admin/operaciones/PreguntasDelChat';
import { marcarMakoAbierto } from './mako-abierto';
import { anotarEstrellaPropia } from './estrella-propia';
import { panelDeLaBarra } from './borde-barra';
import { TrabajosTerminados, useTrabajosSinVer } from './TrabajosDeMako';
import type { TrabajoTerminado } from '@/lib/mako-trabajos';

/** El ancho de la barra de la app plegada: lo que se usa hasta medirla (y en el server). */
const BARRA_PLEGADA = 68;
/** El ancho del panel abierto (el de .ch-tab-panel, app/_chat/chat.css). */
const ANCHO_PANEL = 440;
/** Su aire con la barra y con la tab (el `margin-left` de .ch-tab-panel; 25/10/2026, el marco flotante del Dashboard). */
const AIRE_PANEL = 12;
/** Lo que la tab le deja: el panel y su aire a los dos lados. */
const LUGAR_PANEL = ANCHO_PANEL + 2 * AIRE_PANEL;

/**
 * Dónde empieza el contenido: el borde derecho de la barra de la app, medido; cambia cuando la barra se fija o se suelta.
 * `visible` (24/10/2026, f34): el borde de lo que SE VE, el panel de adentro, que se despliega ENCIMA al pasar el cursor sin
 * que la barra cambie de ancho (app/_components/Sidebar.tsx). Lo usa la estrella: medida con la barra quedaba debajo del panel
 * desplegado, y la criatura que volaba a ella se «escondía detrás» (Martín, la llamada con Leandro, 59:33).
 */
function useBordeDeLaBarra(visible = false): number {
  const [borde, setBorde] = useState(BARRA_PLEGADA);
  useLayoutEffect(() => {
    const barra = document.querySelector('[data-sidebar]');
    const medida = visible ? panelDeLaBarra(barra) : barra;
    const medir = () => setBorde(Math.round(medida?.getBoundingClientRect().right ?? 0));
    medir();
    const ro = medida && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    if (medida) ro?.observe(medida);
    window.addEventListener('resize', medir);
    return () => { ro?.disconnect(); window.removeEventListener('resize', medir); };
  }, [visible]);
  return borde;
}

/** Las tabs con su propio arranque a la vista (plan.md D3): ahí la estrella no se abre sola ni dice su corto. */
const CON_SU_ARRANQUE: ReadonlySet<string> = new Set(['Media Buyer', 'Calendario', 'Clientes', 'Dashboard', 'General']);

/**
 * Lo que la estrella CERRADA tiene para decir (lib/aperturas/ops.ts, la escalera del Cerebro): sin el motor, con la memoria de la
 * página y UNA pregunta por la app y la IA. `abrirSola`: la primera visita a esta tab, con algo que decir. `corto`: si no, lo que
 * dice el globo (uno por día en toda la app; una vez a la vista, se queda en esta visita).
 */
function useEstrellaCerrada(tab: string, cerrada: boolean, callada: boolean): { corto: string | null; abrirSola: boolean; dijo: () => void; callar: () => void } {
  const propio = callada || CON_SU_ARRANQUE.has(tab);
  const mem = useMemoriaAperturas();
  const [hechos, setHechos] = useState<HechosOps | null>(appYIAReciente);
  useEffect(() => {
    if (!cerrada || propio || hechos) return;
    let vivo = true;
    void leerAppYIA().then((h) => { if (vivo && h) setHechos(h); });
    return () => { vivo = false; };
  }, [cerrada, propio, hechos]);
  const [ahora] = useState(() => Date.now());
  const [mostrado, setMostrado] = useState<string | null>(null);
  const [callado, setCallado] = useState(false);
  const m = mem.memoria;
  const a = m && hechos ? aperturaOps(hechos, respuestasDeMemoria(m, 'ops')) : null;
  const habla = !!a && !!m && !propio && puedeHablar(m[claveApertura(a.id)], a.alcance, ahora);
  const abrirSola = habla && !m![claveEstrella(tab)];
  const corto = callado ? null : mostrado ?? (habla && !abrirSola && a!.corto && puedeHablar(m![CLAVE_CORTO], 'negocio', ahora) ? a!.corto : null);
  return {
    corto: cerrada ? corto : null,
    abrirSola: cerrada && abrirSola,
    // A la vista por primera vez en esta visita: cuenta como el corto del día.
    dijo: () => { if (corto && !mostrado) { setMostrado(corto); anotarApertura(CLAVE_CORTO, 'vista'); } },
    callar: () => setCallado(true),
  };
}

export function MakoEnLaTab({ tab, apertura = null, arriba = null, preguntas = null, aviso = 0, pedido = null, entidad = null, modo = null, onModo, pantalla = null, encimaDeModales = false, deLaApp = false }: {
  /** El nombre de la tab («CRM», «Automations»): el `aria-label` y desde dónde va lo que se escribe al Cerebro, que reparte. */
  tab: string;
  /** Lo que la TAB dice primero en el hilo (su apertura, con `useApertura` y `AperturaMako`: plan.md §4): gana sobre la del
   *  Cerebro. Una por pantalla. */
  apertura?: ReactNode | null;
  /** Lo que la pantalla tiene abierto (OC6, lib/chat-desde.ts): el lead de la ficha, la automatización del lienzo. El turno lo
   *  toma por defecto («movelo a Ganado» es ESE lead) y el mensaje lleva su chip «desde CRM › Ana». */
  entidad?: EntidadChat | null;
  /** Lo pone la PANTALLA (mirando → 'analizar'; editando → 'editar'). En «analizar» el servidor no deja nada que escriba. */
  modo?: ModoChat | null;
  /** Si la pantalla deja cambiar de modo sin salir: «Analizar · Editar» arriba del hilo (el slot de Discutir/Editar). */
  onModo?: (m: ModoChat) => void;
  /** Lo que la tab tiene dibujado, en texto (24/10/2026, «que la criatura vea la hoja»): viaja con cada mensaje y el turno lo
   *  lee como datos (`Desde.pantalla`, lib/chat-desde.ts). En el Dashboard, los gráficos de la hoja abierta con su vista. */
  pantalla?: string | null;
  /** Lo de la tab arriba del hilo que NO es una pregunta (el «Calladas» del CRM, un aviso de que no se pudo leer). */
  arriba?: ReactNode;
  /** Lo que la tab le pregunta a la persona (las sugerencias del CRM, con «Hacerlo» y «Ahora no»): va en el MISMO bloque de
   *  preguntas del Ops Center, una por vez arriba de la caja (22/10/2026). Nunca una lista suelta arriba del hilo. */
  preguntas?: readonly PreguntaDeLaTab[] | null;
  /** Cuánto espera a la persona en esta tab (las sugerencias): el globito de la estrella plegada. */
  aviso?: number;
  /** Lo que la tab le manda al Cerebro (el «Hacerlo» de una sugerencia): abre el panel y sale UNA vez por `vez`. */
  pedido?: { texto: string; vez: number } | null;
  /** La tab abre su tarjeta en un MODAL (el Plan, Clientes; CR4, 22/10/2026): con uno abierto, la estrella queda encima de él
   *  (si no, el fondo del modal la tapa y «cerrala» con la tarjeta abierta no se puede pedir), y el panel entra a la pila como
   *  capa `anidada`: la tarjeta de abajo se sigue viendo y el Escape cierra sólo el panel. Sin esto, lo de siempre (z 55). */
  encimaDeModales?: boolean;
  /** La monta la barra en una tab que no tiene la suya (./EstrellaDeLaApp.tsx): está, pero no se abre sola ni dice su corto.
   *  Sin esto, la primera visita a cada una de las tabs nuevas abría el panel encima. */
  deLaApp?: boolean;
}) {
  // La de la tab le avisa a la de la barra que no hace falta: nunca dos estrellas.
  useEffect(() => (deLaApp ? undefined : anotarEstrellaPropia()), [deLaApp]);
  const [abierto, setAbierto] = useState(false);
  // ¿Se abrió con un modal de la tab abierto? Se decide al abrir y queda mientras está abierto (el panel ya está en la pila).
  const [sobre, setSobre] = useState(false);
  const abrir = useCallback(() => { setSobre(encimaDeModales && profundidadModales() > 0); setAbierto(true); }, [encimaDeModales]);
  const prof = useProfundidadModales();
  const borde = useBordeDeLaBarra();
  // La estrella, al lado de lo que SE VE de la barra (f34): con la barra desplegada encima, se corre y no queda debajo.
  const bordeVisible = useBordeDeLaBarra(true);
  // ⚠️ FLOTA, ENCIMA DE LA TAB, Y NO EN LA BARRA (1/11/2026, Martín: «no me gusta que el botoncito de la estrella de MaKo esté en
  //    la sidebar principal. Eso ponerlo como antes que esté flotando»). Del 30/10 al 1/11 vivió en una ranura al pie de la barra
  //    porque tapaba el rincón de abajo a la izquierda de la tab; eso vuelve a pasar y es sabido (docs/hallazgos-chat.md).
  // Lo que MaKo terminó en otra tab sin que nadie lo mirara: suma al globito.
  const trabajos = useTrabajosSinVer();
  const espera = aviso + trabajos.length;
  // El pedido vive acá y no en el panel: el panel se desmonta al cerrar, y uno ya mandado no puede volver a salir al reabrir.
  const [porMandar, setPorMandar] = useState<{ texto: string; vez: number } | null>(null);
  const ultimaVez = useRef<number | null>(null);
  useEffect(() => {
    if (!pedido || ultimaVez.current === pedido.vez) return;
    ultimaVez.current = pedido.vez;
    setPorMandar(pedido);
    abrir();
  }, [pedido]); // eslint-disable-line react-hooks/exhaustive-deps
  const cerrar = useCallback(() => { setAbierto(false); setPorMandar(null); }, []);
  // Abierto, la tab le deja el lugar (su margen izquierdo lee `--ancho-panel-mako`), y la barra de la app se pliega a íconos
  // mientras tanto (./mako-abierto.ts): el panel se pega a su borde, que se mide (`useBordeDeLaBarra`), así que la tab sigue
  // corriéndose lo que mide el panel. Al cerrar, o al salir de la tab con el panel abierto, la barra vuelve a como estaba.
  useEffect(() => {
    const raiz = document.documentElement.style;
    raiz.setProperty('--ancho-panel-mako', abierto ? `${LUGAR_PANEL}px` : '0px');
    marcarMakoAbierto(abierto);
    return () => { raiz.removeProperty('--ancho-panel-mako'); marcarMakoAbierto(false); };
  }, [abierto]);

  // ── La iniciativa con la estrella cerrada ──
  const guia = useGuia();
  const enElChat = useGuiaEnElChat();
  const cerrada = useEstrellaCerrada(tab, !abierto, deLaApp);
  // La guía empezó a señalar (o se pidió el «?»): el chat se abre (guia.md §3.3, «abre el chat si estaba cerrado»).
  const abrirVisto = useRef(guia.abrirChat);
  useEffect(() => {
    if (guia.abrirChat === abrirVisto.current) return;
    abrirVisto.current = guia.abrirChat;
    if (guia.guia) abrir();
  }, [guia.abrirChat]); // eslint-disable-line react-hooks/exhaustive-deps
  // La primera visita a la tab, con algo que decir y nada encima: se abre sola, UNA vez (D3), después de que la tab se dibujó.
  const nadaEncima = prof === 0 && !guia.dice && !guia.objetivo && !guia.esperando;
  useEffect(() => {
    if (!cerrada.abrirSola || !nadaEncima) return;
    const t = window.setTimeout(() => {
      if (profundidadModales() > 0) return;
      anotarApertura(claveEstrella(tab), 'vista');
      abrir();
    }, ESPERA_PREGUNTA_MS);
    return () => window.clearTimeout(t);
  }, [cerrada.abrirSola, nadaEncima]); // eslint-disable-line react-hooks/exhaustive-deps
  // El globo: la pregunta de la guía (la primera vez en la tab) o el corto de la apertura.
  const pregunta = !abierto && guia.guia && enElChat.pregunta && !enElChat.senalando ? enElChat.pregunta : null;
  const corto = !abierto && !pregunta && nadaEncima ? cerrada.corto : null;
  useEffect(() => { if (corto) cerrada.dijo(); }, [corto]); // eslint-disable-line react-hooks/exhaustive-deps
  // Abierto una vez, ya leyó la pregunta entera en el hilo: el corto no vuelve al cerrar.
  useEffect(() => { if (abierto) cerrada.callar(); }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  const zEstrella = encimaDeModales && prof > 0 ? zEncimaDeModales(prof) : undefined;

  const leftGlobo = bordeVisible + 16;
  const globos = (
    <>
      {pregunta?.apertura && (
        <GloboDeLaEstrella left={leftGlobo} texto={pregunta.apertura.texto} apertura={pregunta.apertura} onElegir={pregunta.elegir}
          onAbrir={abrir} onCerrar={() => pregunta.elegir({ tipo: 'callar', rotulo: 'Ahora no' })} zIndex={zEstrella} />
      )}
      {corto && <GloboDeLaEstrella left={leftGlobo} texto={corto} onAbrir={abrir} onCerrar={cerrada.callar} zIndex={zEstrella} />}
    </>
  );
  return abierto
    ? <PanelDelCerebro tab={tab} izquierda={borde} apertura={apertura} arriba={arriba} trabajos={trabajos} preguntas={preguntas} pedido={porMandar} onMandado={() => setPorMandar(null)} entidad={entidad} modo={modo} onModo={onModo} pantalla={pantalla} onCerrar={cerrar} sobre={sobre} apartado={guia.apartar} />
    : (<>
      <button type="button" className="ch-tab-mako" style={{ left: bordeVisible + 16, ...(encimaDeModales && prof > 0 ? { zIndex: zEncimaDeModales(prof) } : {}) }} aria-label={espera > 0 ? `Escríbele a MaKo desde ${tab} (${espera} para ver)` : `Escríbele a MaKo desde ${tab}`}
        title="MaKo" onClick={abrir} data-mako-chat="">
        <Muneco titulo={JEFE_SECOND_BRAIN} animo="despierto" size={40} espera={espera} />
      </button>
      {globos}
    </>);
}

/** El panel abierto: la conversación «Cerebro» de la persona, con el motor del Ops Center, flotando al lado de la barra. */
function PanelDelCerebro({ tab, izquierda, apertura, arriba, trabajos, preguntas, pedido, onMandado, entidad, modo, onModo, pantalla, onCerrar, sobre, apartado = false }: {
  tab: string; izquierda: number; apertura: ReactNode | null; arriba: ReactNode; trabajos: readonly TrabajoTerminado[]; preguntas: readonly PreguntaDeLaTab[] | null;
  pedido: { texto: string; vez: number } | null; onMandado: () => void;
  entidad: EntidadChat | null; modo: ModoChat | null; onModo?: (m: ModoChat) => void; pantalla: string | null; onCerrar: () => void;
  /** Abierto encima de un modal de la tab: es una capa más de la pila (anidada: la de abajo se sigue viendo). */
  sobre: boolean;
  /** La guía señala algo de la tab en una ventana angosta: el panel se aparta SIN desmontarse, y vuelve solo. */
  apartado?: boolean;
}) {
  const capa = useCapaModal(sobre, { anidada: true });
  // Encima de un modal, el Escape sólo si el panel es la capa de arriba: si no, una tecla cerraba el panel Y la tarjeta de abajo.
  const esDeArriba = useCallback(() => !sobre || capa.esElDeArriba(), [sobre, capa]);
  return (
    <div className={apartado ? 'ch-tab-panel ch-tab-panel--apartado' : 'ch-tab-panel'} style={{ left: izquierda, ...(sobre ? { zIndex: capa.z } : {}) }} role="dialog" aria-label={`MaKo en ${tab}`} data-mako-chat="">
      <ConversacionCerebro tab={tab} apertura={apertura} arriba={arriba} trabajos={trabajos} preguntas={preguntas} pedido={pedido} onMandado={onMandado}
        entidad={entidad} modo={modo} onModo={onModo} pantalla={pantalla} onCerrar={onCerrar} esDeArriba={esDeArriba} />
      <button type="button" className="ch-tab-panel__cerrar" aria-label="Cerrar MaKo" title="Cerrar (Esc)" onClick={onCerrar}>×</button>
    </div>
  );
}

/**
 * La conversación «Cerebro» SIN el panel que flota: el motor, el hilo y la caja del Ops Center. La monta el panel de arriba y,
 * fija y sin cerrarse, la tarjeta izquierda de las tabs de Create (app/_crear/PantallaCrear.tsx, 29/10/2026: «el chat de MaKo
 * SIEMPRE abierto a la izquierda»). Una sola copia: si la de Create armara la suya, se quedaría vieja.
 *   · `onCerrar`: el «volver» de la ventana angosta y el Escape. Sin esto (la tarjeta fija), no se cierra.
 *   · `antes`: lo que va antes de la criatura en la cabecera (la «←» a la lista de proyectos de Create).
 */
export function ConversacionCerebro({ tab, apertura: aperturaDeLaTab = null, arriba = null, trabajos = [], preguntas = null, pedido = null, onMandado, entidad = null, modo = null, onModo,
  pantalla = null, onCerrar, esDeArriba, antes, titulo }: {
  tab: string; apertura?: ReactNode | null; arriba?: ReactNode; trabajos?: readonly TrabajoTerminado[]; preguntas?: readonly PreguntaDeLaTab[] | null;
  pedido?: { texto: string; vez: number } | null; onMandado?: () => void;
  entidad?: EntidadChat | null; modo?: ModoChat | null; onModo?: (m: ModoChat) => void; pantalla?: string | null;
  onCerrar?: () => void; esDeArriba?: () => boolean; antes?: ReactNode;
  /** El nombre de la cabecera, si no es el de la conversación («MaKo» en la tarjeta de Create: la persona le habla a MaKo). */
  titulo?: string;
}) {
  const [elegido, setElegido] = useState<ElegidoChat | null>(null);
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  // Desde dónde va lo que se escribe (OC6): la tab, lo que tiene abierto, el modo y lo que tiene dibujado. El mismo objeto
  // mientras no cambien (`useChatCliente` lo lee recién al mandar).
  const idEntidad = entidad?.id ?? null;
  const desde = useMemo<Desde>(() => ({ tab, entidad, modo, ...(pantalla ? { pantalla } : {}) }), [tab, entidad?.tipo, idEntidad, entidad?.titulo, modo, pantalla]); // eslint-disable-line react-hooks/exhaustive-deps
  // Siempre el Cerebro: al llegar la lista lo elige solo (`entrarAlCerebro`).
  const base = useChatCliente({ elegido, setElegido, activo: true, entrarAlCerebro: true, chatInicial: null, opcionArmar: '', busca: '', caja, desde });
  // Con `titulo` («MaKo», la tarjeta de Create) la conversación se NOMBRA así en todos lados: la cabecera, «Escribe a MaKo» en
  // la caja (con «Cerebro», en 340 px partía en dos renglones) y lo fijado. Adentro sigue siendo el Cerebro, que reparte.
  const k = titulo ? { ...base, nombre: titulo } : base;
  // El pedido de la tab sale al Cerebro (no a otro chat) y cuando el hilo está listo y libre: `enviar` dice si salió.
  useEffect(() => {
    if (!pedido || !k.esJefe) return;
    if (k.enviar(pedido.texto)) onMandado?.();
    // `enviar` cambia en cada render; lo que decide es el pedido y que el Cerebro esté abierto, cargado y libre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, k.esJefe, k.cargado, k.trabajo]);
  // Escape lo cierra, como un panel de la casa (si no hay un menú o un modal arriba). Fija (sin `onCerrar`), no escucha.
  const { menuWA, infoWA, conectando } = k;
  useEffect(() => {
    if (!onCerrar) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && !menuWA && !infoWA && !conectando && (esDeArriba?.() ?? true)) onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [menuWA, infoWA, conectando, onCerrar, esDeArriba]);
  // Como un chat: abre en lo último y baja con lo nuevo.
  useLayoutEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [k.items.length, k.trabajo]);
  const seguirHilo = useCallback(() => hilo.current, []);
  // Lo que MaKo dice primero: la de la tab, la de la guía o la del Cerebro. Con algo de la tab en el bloque de preguntas, calla.
  const apertura = useAperturaDelCerebro(k, { libre: !(preguntas && preguntas.length > 0), propia: aperturaDeLaTab });

  return (
    <>
      <PanelDeChat hilo={hilo} adjuntos={k.adjuntosCaja}
        cabecera={{ clave: 'cerebro', titulo: k.nombre, criatura: k.nombreMuneco, animo: k.enCurso ? 'trabajando' : 'despierto', onVolver: onCerrar, antes }}
        arriba={<><TrabajosTerminados trabajos={trabajos} />{arriba}<BarraFijados marcas={k.marcas} lineas={[]} mensajes={k.mensajesWA} titulo={k.nombre} onSoltar={(id) => void k.ponerMarca({ tipo: 'fijar', id, si: false })} /></>}
        despues={<>
          <MenuMensajeWA abierto={k.menuWA} marcas={k.marcas} onCerrar={() => k.setMenuWA(null)} onElegir={k.elegirEnMenu} sin={['reenviar']} />
          {k.infoWA && <Modal titulo="Info del mensaje" onCerrar={() => k.setInfoWA(null)} ancho={460}><InfoMensaje m={k.infoWA} /></Modal>}
        </>}
        caja={<>
          {/* Lo que la tab le pregunta, arriba de la caja y en EL bloque de preguntas (el del Ops Center). */}
          {preguntas && preguntas.length > 0 && <BloqueDePreguntas chat={`tab:${tab}`} deLaTab={preguntas} />}
          <div className="co-caja">
          {/* Desde dónde va lo que se escribe, y en qué modo (OC6): lo mismo que dirá el chip del mensaje. */}
          {(entidad || modo || onModo) && (
            <div className="ch-desde-caja">
              <span>Desde {etiquetaDesde(desde)}{modo === 'analizar' && !onModo ? ' · Analizar' : ''}</span>
              {onModo && <ModosMako modo={modo ?? 'editar'} onModo={onModo} />}
            </div>
          )}
          <CajaDelCliente k={k} campo={caja} seguir={seguirHilo} angosta />
          </div>
        </>}
        estado={estadoDelCliente(k)}>
        <HiloDelCliente k={k} apertura={apertura} />
      </PanelDeChat>
      {k.conectando && (
        <Modal titulo="Tus cuentas de IA" onCerrar={() => { k.setConectando(false); k.mirarSuIA(); }} ancho={640}>
          <TusCuentasIA sinCabecera conectar />
        </Modal>
      )}
    </>
  );
}
