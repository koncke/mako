'use client';

// =============================================================================
// FlujoAviso — lo que MaKo te dice A VOS, dibujado como flujo y editable ahí
// =============================================================================
// El pedido apuntando a Configuraciones › Notificaciones: «una pantalla tipo
// flujo, y ahí se edita todo». Y la segunda tanda, punto por punto: el lienzo
// ocupa todo el recuadro, las tarjetas se arrastran, se pueden agregar pasos, el
// disparador ofrece los eventos que existen, y el nodo «te llega» se va porque
// «es un paso que no hace nada».
//
// ── UN SOLO DUEÑO DEL FLUJO ────────────────────────────────────────────────
// Este componente lee y escribe el `Flujo` del mensaje —disparador, `insistir` y
// los pasos— y es el único que lo hace. Antes el paso `insistir` lo escribía
// `Recordatorios` por su cuenta: con el lienzo tocando también el disparador,
// eso eran dos dueños del MISMO objeto y `setFlujo` reemplaza el flujo entero, así
// que el segundo en guardar se llevaba puesto lo del primero. Aquel componente se
// absorbió acá con todo lo suyo (las dos opciones, los números, el techo dicho y
// el aviso de WhatsApp apagado).
//
// ── QUÉ CORRE DE VERDAD, Y QUÉ LO DICE ─────────────────────────────────────
// El aviso sale por su camino de siempre (su call site o su cron). Lo que este
// flujo agrega lo ejecuta `dispararEvento` (lib/flujos.ts), y SÓLO cuando pasa uno
// de los cinco eventos cableados. O sea:
//   · el `insistir` corre por los DOS caminos (el choke point de avisos lo lee);
//   · un paso de acción o un mensaje al lead corren sólo por el del EVENTO.
// Por eso un paso agregado sin evento elegido se dibuja con su advertencia en vez
// de en silencio: un paso que no corre y no lo dice es el control que se dibuja y
// no hace nada.
//
// ── LAS PIEZAS DE UNA AUTOMATIZACIÓN (10/10/2026, restos de versiones anteriores) ──
// Martín abrió /automations y este lienzo seguía con lo de antes de la sexta tanda. Desde acá usa las
// piezas del lienzo de una automatización: la tarjeta CRON con sus cajitas (`CuerpoCron`), el círculo
// «Entonces / Siguiente paso» con el ＋ adentro y el menú de la casa (`MENU_MAS`), el DELAY sobre la
// flecha, la CONDITION con sus dos filas, el tacho en la cabecera del panel, el click derecho y
// «Acomodar», el CRON con botones gigantes y el Recurrente de Google Calendar (`EditorRecurrente`), y la
// cabecera «MaKo en WhatsApp» con su ✦. El grafo, en lib/flujo-aviso.ts. Lo que no se pudo reusar tal
// cual (está privado en otro archivo) se dice en docs/hallazgos-chatbot.md, «Restos de versiones
// anteriores, grupo avisos».

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Lienzo, TarjetaNodo, IconoAcomodar, inpLienzo, rotuloLienzo, campoGrande, type ItemMenuLienzo } from '@/app/_components/Lienzo';
import { usePilaDeshacer } from '@/app/_ui/usePilaDeshacer';
import { TextoMarcas } from '@/app/_components/TextoMarcas';
import { BurbujaHilo } from '@/app/whatsapp/_shared/BurbujaHilo';
import { MakoLogo } from '@/app/_components/MakoBrand';
// La papelera de la casa, roja siempre (sexta tanda, general 9).
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { Icon } from '@/app/_components/icons';
import { Spinner } from '@/app/_ui';
import { Dropdown } from '../components/Dropdown';
import { ALTO_PRINCIPAL } from '../components/dropdown-reglas';
import { EditorMensajeGrupo, CabeceraMakoEnWhatsApp } from '@/app/automations/EditorMensajeWhatsApp';
// La tarjeta CRON y los renglones de la burbuja: los MISMOS de una automatización.
import { CuerpoCron, renglonesDeTarjeta } from '@/app/automations/FlujoLienzo';
import { EditorRecurrente } from '@/app/automations/EditorRecurrente';
import { IconoDisparador } from '@/app/automations/IconosDisparador';
import { BotonDictar } from '@/app/plan/board/CrearTareaModal';
import { PopoverWA, insertarEnCursor } from '@/app/whatsapp/_shared/ComposerWhatsApp';
import { ArbolDeDatos } from '@/app/_components/SelectorDatos';
import {
  grafoDeAviso, podarPosiciones, esInsistir, pasosDibujados, insertarPasoTras, quitarPasoDibujado, disparadoresDeAviso,
  cabezaDeCadena, pasoDeTarjeta, segundosDeEspera, horasDeEspera, unidadDeEsperaAviso, UNIDADES_ESPERA_AVISO, ESPERA_AVISO_MAX_S,
  type AvisoParaGrafo, type Posiciones,
} from '@/lib/flujo-aviso';
import { sanearCron, type CronAviso } from '@/lib/cron-aviso';
import { CRON_DEFAULT } from '@/app/_components/EditorCron';
import { variablesOfrecidas } from '@/lib/variables-aviso';
import { guardarCanalDeMensaje } from '@/lib/mensaje-canales';
import {
  EVENTOS, EVENTOS_SIN_EMISOR, INSISTIR_MAX_VECES, INSISTIR_MIN_MINUTOS, sanearInsistir,
  type Flujo, type Paso, type PasoAccion, type EventoFlujo,
  operacionDelPaso, pasoDeAccion, rotuloOperacion, SIN_ACCION,
  ACUSES, UNIDADES_RECORDATORIO, cadaDeMin, aMinutos, type UnidadRecordatorio,
} from '@/lib/flujos-tipos';
import { EditorAccionMako, useTitulosAcciones, type ValorAccion } from '@/app/_components/EditorAccionMako';
// Las condiciones que el motor SABE evaluar, y sus rótulos: el editor del CONDITION ofrece ésas y
// ninguna otra (tests/flujo-condicional.test.ts cruza las dos listas).
import { CONDICIONES_FLUJO, ROTULO_CONDICION } from '@/lib/flujo-pasos';
// El menú del ＋ de la casa (los nombres y los íconos de una automatización) y las piezas del email.
import {
  MENU_MAS, MARCO_MAIL, RENGLON_ASUNTO, RENGLON_CUERPO_MAIL, SEP_MAIL, RENGLONES_EMAIL, type QueAgregar,
} from '@/lib/flujo-conversacion';
import { editorDeTarjeta, type NodoFlujo, type Muelles, type TipoNodo } from '@/lib/lienzo-grafo';
import { SEGUNDOS_DE, rotuloUnidad, type UnidadEspera } from '@/lib/espera-duracion';
import { GRAMATICA } from '@/lib/mako-gramatica';
import type { NombreIconoMenu } from '@/app/_ui/iconos-menu';

const SANS = "'Geist', sans-serif";

/** El ancho del panel sin `muelles` (Configuraciones y /mensajes): «la sección de edición del mensaje tiene que ser MUCHO más grande». */
const PANEL_AVISO = 460;

// La tarjeta del lienzo dice QUÉ acción corre el paso: el título sale de `useTitulosAcciones`
// (la misma lectura y la misma caché que el desplegable del editor). Mientras no llega, o si
// falla, la tarjeta dice el id legible: nunca queda en blanco.

/**
 * Lo que el panel de un «⚡ Acción» tiene escrito y todavía no guardó (el respiro de 700 ms),
 * para que el tablero lo TOME antes de cambiar el flujo por otro camino. Sin esto, el guardado
 * diferido salía DESPUÉS, armado sobre el flujo de antes: un deshacer quedaba pisado, y un paso
 * insertado antes corría los índices y lo escrito para una acción caía en la de al lado.
 */
type PanelPendiente = { tomar: () => { original: Paso; nuevo: Paso } | null };

const FLUJO_VACIO: Flujo = { version: 1, activo: true, disparador: { tipo: 'manual' }, pasos: [] };

/** El ícono de cada evento que dispara un mensaje (general 10: un ícono en cada opción de un desplegable). */
const ICONO_EVENTO: Record<(typeof EVENTOS)[number]['key'], NombreIconoMenu> = {
  'lead.agendo': 'calendario',
  'lead.cancelo': 'cerrar',
  'reunion.ocurrio': 'check',
  'lead.form_meta': 'nota',
  'lead.wa_entrante': 'whatsapp',
};

/** Lo que una pasada de deshacer restaura: el tablero entero, no un campo. */
type FotoTablero = { flujo: Flujo | null; pos: Posiciones };

/** Lo que el ＋ crea como PASO (los canales se prenden, no son pasos: ver `agregarTras`). */
const OPCIONES_PASO: ReadonlySet<QueAgregar> = new Set<QueAgregar>(['esperar', 'condicion', 'accion']);

/** El tamaño del editor de cada tarjeta, como en una automatización: los mensajes, el grande. */
const tallaDe = (n: NodoFlujo | null | undefined): TipoNodo | null => {
  if (!n) return null;
  if (n.id === 'mensaje' || n.id === 'mensaje-email' || n.tipo === 'mako') return 'mensaje';
  return n.tipo;
};

export function FlujoAviso({
  id, disparador, frecuenciaMin, texto, canales, posiciones, endpoint, editable, textoEditable, guardando,
  asunto, onAsunto, onAsuntoGuardar, tituloMensaje, aporta = [],
  onTexto, onCambio, probando, prueba, onProbar, chrome, pie, insetIzq: insetIzqDado, muelles,
}: {
  id: string;
  /**
   * Lo que tapa una pieza apoyada sobre el borde izquierdo: la lista de /automations, que desde la
   * quinta tanda (punto 5) muestra este lienzo para los Mensajes de MaKo. Va tal cual al
   * `insetIzq` del lienzo. Ausente = 0 (la tab de /mensajes, sin nada encima).
   */
  insetIzq?: number;
  /**
   * DÓNDE VA CADA COSA QUE FLOTA en /automations (`muelles`, lib/lienzo-grafo.ts), como en una
   * automatización: con esto el editor de cada tarjeta tiene el tamaño de su tipo (`editorDeTarjeta`:
   * el de un mensaje, el grande) y los insets salen de la misma cuenta. Sin esto, el panel de columna
   * de siempre (`PANEL_AVISO`) e `insetIzq`.
   */
  muelles?: Muelles | null;
  disparador: string;
  frecuenciaMin: number;
  texto: string;
  canales: { wa: boolean; email: boolean };
  /** El asunto del email (vacío = se usa el título). Vive en el nodo EMAIL. */
  asunto?: string;
  /** Cómo se llama el mensaje. Es el asunto por default, así que la tarjeta lo dibuja. */
  tituloMensaje?: string;
  /** Qué entidades trae el disparador de este mensaje. Sale del catálogo (`aporta`). */
  aporta?: ReadonlyArray<'lead' | 'cuota'>;
  onAsunto?: (v: string) => void;
  onAsuntoGuardar?: () => void;
  posiciones: Posiciones;
  endpoint: string;
  /** Los avisos que redacta MaKo no dejan editar su TEXTO: son hechos exactos. */
  editable: boolean;
  /**
   * ¿Se puede escribir el MENSAJE? Ausente = lo mismo que `editable`. Es otra pregunta (sexta tanda,
   * 09/10/2026): en un aviso del cliente cuyo texto arma el código (`textoDelCodigo`) el flujo sigue
   * siendo suyo —el ＋, el CRON por evento, los pasos— y lo que no se ofrece es escribir un mensaje
   * que nunca se manda así. Con un solo booleano, apagar el texto apagaba también el ＋.
   */
  textoEditable?: boolean;
  guardando: boolean;
  onTexto: (v: string) => void;
  onCambio?: () => void;
  probando: boolean;
  prueba: string | null;
  onProbar: (contexto?: string) => void;
  /** El título, el interruptor y la salida: flotan SOBRE el lienzo. */
  chrome?: React.ReactNode;
  /** Lo que va abajo a la derecha del lienzo. Hoy es «Publicar», y lo pone el
   *  detalle porque es él el que sabe qué está sin publicar. */
  pie?: React.ReactNode;
}) {
  const [sel, setSel] = useState<string | null>(null);
  /**
   * La tarjeta cuyo ✦ de MaKo está abierto (sexta tanda, WhatsApp 3 y MaKo en WhatsApp 2: el ✦ en la
   * cabecera del panel, al lado del título). Es POR TARJETA y se cierra al elegir otra: abrir la misma
   * otra vez no trae un panel que se dejó abierto en otra cosa.
   */
  const [redactaEn, setRedactaEn] = useState<string | null>(null);
  const elegirTarjeta = (s: string | null) => { setSel(s); setRedactaEn(null); };
  const panelPendiente = useRef<PanelPendiente | null>(null);
  const [flujo, setFlujo] = useState<Flujo | null>(null);
  /** El agendado por TIEMPO vive en su TABLA, no en el store del mensaje: el store
   *  se hereda del dueño y lo reescribe el navegador entero (ver la mig 0183). */
  const [cron, setCron] = useState<CronAviso | null>(null);
  const [tz, setTz] = useState<string | null>(null);
  /** Las palabras que cortan los recordatorios. Son del NEGOCIO, no del mensaje: el
   *  webhook que las compara recibe un mensaje del grupo y no sabe a cuál de los
   *  avisos le está contestando. La pantalla lo dice donde se editan. */
  const [acusesTxt, setAcusesTxt] = useState('');
  const [pos, setPos] = useState<Posiciones>(posiciones);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const insetIzq = muelles ? muelles.insets.izq : insetIzqDado;
  const textoEdit = textoEditable ?? editable;

  const api = useCallback(async (body: unknown) => {
    try {
      const r = await (await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })).json();
      if (!r?.ok) setErr(r?.error || 'No se pudo guardar');
      return r;
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo guardar'); return { ok: false }; }
  }, [endpoint]);

  useEffect(() => {
    let vivo = true;
    void api({ action: 'flujo-get', id }).then((r) => { if (vivo) setFlujo((r?.flujo as Flujo | null) ?? null); });
    void api({ action: 'acuses-get', id }).then((r) => {
      if (vivo) setAcusesTxt(((r?.acuses as string[] | undefined) ?? ACUSES).join(', '));
    });
    void api({ action: 'cron-get', id }).then((r) => {
      if (!vivo) return;
      const p = r?.programado as { cron?: unknown; tz?: string } | null | undefined;
      setCron(sanearCron(p?.cron ?? null));
      setTz(p?.tz ?? null);
    });
    return () => { vivo = false; };
  }, [api, id]);

  /** Agenda o desagenda. El saneo y la zona los resuelve el server, que es el único
   *  que puede: `tzDeWorkspace` sale a la red y no vive en el navegador. */
  /** Se escribe al SOLTAR el campo, no en cada tecla: son palabras separadas por
   *  coma y guardar a mitad de una deja «ok, gr» en la lista del negocio. */
  async function guardarAcuses(v: string, soloPintar = false) {
    setAcusesTxt(v);
    if (soloPintar) return;
    const r = await api({ action: 'acuses-set', id, acuses: v });
    // Se repinta con lo que el server SANEÓ: si alguien escribió una palabra de 40
    // caracteres, el campo tiene que mostrar que no entró — no dejarla escrita.
    if (r?.ok) setAcusesTxt(((r.acuses as string[] | undefined) ?? ACUSES).join(', '));
  }

  async function guardarCron(c: CronAviso | null): Promise<boolean> {
    // ⚠️ SE REVIERTE SI FALLA, y esta regla viene heredada del control que esta
    // sección reemplazó (`Disparador.tsx`, que hacía `setMin(previo)`): sin ella el
    // desplegable queda diciendo un horario que no se guardó, y no hay forma de
    // saberlo mirando la pantalla. Es lo único que ese componente tenía de propio y
    // que no era el campo que se sacó.
    const previo = cron;
    setBusy(true); setErr(null);
    setCron(c);   // optimista: el desplegable tiene que responder en el frame
    const r = await api({ action: 'cron-set', id, cron: c });
    const p = r?.programado as { cron?: unknown; tz?: string } | null | undefined;
    if (r?.ok) { setCron(sanearCron(p?.cron ?? null)); setTz(p?.tz ?? null); }
    else setCron(previo);
    setBusy(false);
    return !!r?.ok;
  }

  /**
   * ⚠️ EL CHOKE POINT DEL TABLERO, Y POR ESO ES DONDE SE APILA EL DESHACER.
   *
   * Pedido el 04/10/2026: «agrega los botones de deshacer y rehacer, y que funcione el
   * ctrl z / y». Todas las mutaciones del flujo pasan por acá —prender y apagar el
   * recordatorio, cambiar su cadencia, insertar un paso, quitarlo, cambiar su acción—,
   * así que apilar en este lugar le da deshacer a las seis y al paso que se agregue
   * mañana. Puesto en cada handler cubriría sólo los que existen hoy, que es la regla
   * de la casa sobre lo que vale para TODOS los cambios.
   *
   * ⚠️ Y DESHACER ESCRIBE EN EL SERVER, no sólo en la pantalla: este cambio YA se
   * guardó, así que revertir sólo el estado de React es mentir hasta el próximo F5.
   * Por eso `aplicarFoto` vuelve a llamar a este mismo camino con el valor anterior.
   */
  async function guardarFlujo(f: Flujo | null, opts: { apilar?: boolean } = {}) {
    if (opts.apilar !== false) apilar({ flujo, pos });
    setBusy(true); setErr(null);
    const r = await api({ action: 'flujo-set', id, flujo: f });
    if (r?.ok) setFlujo((r.flujo as Flujo | null) ?? null);
    setBusy(false);
  }

  /**
   * Restaura una foto del tablero y DEVUELVE la que estaba, que es lo que la pila de
   * rehacer necesita. Las posiciones se escriben acá mismo y no por el debounce de
   * `mover`: un deshacer tiene que quedar guardado aunque la persona cierre enseguida.
   */
  const aplicarFoto = (foto: FotoTablero): FotoTablero => {
    const antes: FotoTablero = { flujo, pos };
    // Lo que el panel no alcanzó a guardar se DESCARTA: deshacer es volver atrás, y un guardado
    // diferido que sale después del deshacer lo revierte.
    panelPendiente.current?.tomar();
    elegirTarjeta(null);
    setPos(foto.pos);
    void api({ action: 'posiciones', id, posiciones: foto.pos });
    void guardarFlujo(foto.flujo, { apilar: false });
    return antes;
  };

  const { apilar, deshacer, rehacer, puedeDeshacer, puedeRehacer } = usePilaDeshacer<FotoTablero>(
    aplicarFoto,
    // `activa` cuelga de `editable`: en un aviso que redacta MaKo no hay nada que
    // deshacer, y un atajo que no hace nada es peor que ninguno.
    { activa: editable },
  );

  const insistir = (flujo?.pasos ?? []).find(esInsistir) ?? null;
  const pasosExtra = pasosDibujados(flujo?.pasos ?? []);
  // El catálogo se pide sólo si alguna tarjeta tiene una acción que nombrar.
  const titulos = useTitulosAcciones(pasosExtra.some((p) => p.tipo === 'accion' && operacionDelPaso(p) !== null));
  /** Lo que dice la tarjeta de un paso «⚡ Acción»: el título de la acción, o que falta elegirla. */
  const detalleDe = (n: NodoFlujo): string | undefined => {
    if (n.tipo !== 'accion') return n.detalle;
    const p = pasosExtra[n.orden ?? -1];
    const op = p?.tipo === 'accion' ? operacionDelPaso(p) : null;
    return op ? (titulos?.get(op) ?? rotuloOperacion(op)) : SIN_ACCION;
  };

  const aviso: AvisoParaGrafo = {
    // El id: con él el grafo sabe si el código corre los pasos de este aviso (la cobranza) y no los
    // dibuja como rotos por «no tener un evento» (`correSuFlujo`, lib/avisos-catalogo.ts).
    id,
    disparador, frecuenciaMin, texto, canales, posiciones: pos, cron, tz,
    // El asunto va al grafo para que la tarjeta EMAIL lo muestre: una tarjeta que no
    // dice qué asunto sale es una tarjeta que hay que abrir para saber qué hace.
    asunto, titulo: tituloMensaje,
    insistir: insistir ? { cadaMin: insistir.cadaMin, veces: insistir.veces } : null,
    evento: flujo?.disparador ?? null,
    pasos: pasosExtra,
    // «＋ Nuevo CRON» en la tarjeta, sólo para quien puede elegirlo (y el grafo lo saca con uno elegido).
    nuevoCron: editable,
  };
  const grafo = grafoDeAviso(aviso);
  const cabeza = cabezaDeCadena(canales);
  /** Lo que el texto del mensaje alcanza a mostrar en su tarjeta antes del «…» (WhatsApp 12). */
  const lineasMensaje = renglonesDeTarjeta(pasoDeTarjeta(texto) as unknown as Parameters<typeof renglonesDeTarjeta>[0], 0);

  // ⚠️ EL GUARDADO DE LA POSICIÓN ES OPTIMISTA Y SE DEBE. Arrastrar tiene que
  // responder en el frame; esperar el POST deja la tarjeta volviendo a su lugar
  // cada vez. Si falla, se dice — no se revierte: revertir una posición a mitad de
  // una sesión de acomodar es más desconcertante que un cartel.
  const guardarPos = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * ⚠️ EL ARRASTRE APILA UNA VEZ POR GESTO, NO POR PÍXEL. `mover` se llama decenas de
   * veces por segundo: apilar en cada una haría que Ctrl+Z devolviera la tarjeta un
   * píxel y hubiera que apretarlo cuarenta veces para volver donde uno estaba. El
   * gesto se reconoce por el hueco: si pasaron más de 450 ms desde el último `mover`,
   * esto es el PRIMER movimiento de un arrastre nuevo. Es el mismo umbral del debounce
   * que ya guarda la posición, así que no hay un segundo número que mantener.
   */
  const ultimoMover = useRef(0);
  function mover(nodoId: string, x: number, y: number) {
    const ahora = performance.now();
    if (ahora - ultimoMover.current > 450) apilar({ flujo, pos });
    ultimoMover.current = ahora;
    const sig = podarPosiciones({ ...pos, [nodoId]: { x, y } }, grafo.nodos.map((n) => n.id));
    setPos(sig);
    if (guardarPos.current) clearTimeout(guardarPos.current);
    guardarPos.current = setTimeout(() => { void api({ action: 'posiciones', id, posiciones: sig }); }, 450);
  }

  /**
   * «ACOMODAR» (sexta tanda, punto 14: «pon un botón de ícono para "acomodar" todas las tarjetas»): todas
   * vuelven a su lugar calculado. Entra a la pila como cualquier arrastre, así que se deshace con Ctrl+Z.
   */
  const hayPosiciones = Object.keys(pos).length > 0;
  const acomodar = () => {
    if (!hayPosiciones) return;
    apilar({ flujo, pos });
    if (guardarPos.current) { clearTimeout(guardarPos.current); guardarPos.current = null; }
    setPos({});
    void api({ action: 'posiciones', id, posiciones: {} });
  };

  /**
   * ⚠️ EL ＋ PREGUNTA QUE CREAR, Y DOS DE LAS OPCIONES NO SON UN PASO.
   *
   * Pedido el 04/10/2026: «si le doy al botón de +, antes de crear una tarjeta
   * debería salir un desplegable que me pregunte qué quiero crear… otro "WhatsApp" o
   * un "Email" o una "Acción" que es lo que sale por defecto ahora».
   *
   * MaKo en WhatsApp y Email NO son pasos: las tarjetas de canal se DERIVAN de
   * `canales:{wa,email}`, dos booleanos del mensaje, y en el motor `CanalPaso` sólo
   * tiene `aviso_dueno | wa_lead` — no hay ninguna rama que mande mail. Elegirlos
   * PRENDE el canal, que es lo que hace aparecer su tarjeta. Es la decisión de
   * siempre: por dónde sale un mensaje es un campo, no un nodo. Por eso se ofrecen sólo
   * en el círculo de la tarjeta del mensaje (`opcionesEn`), que es donde aparece la suya:
   * ofrecidos desde un paso, señalaban un lugar y la tarjeta caía en otro.
   *
   * ⚠️ Y VA POR `guardarCanalDeMensaje`, NO ESCRIBIENDO `canales` DERECHO. Los tres
   * reportes tienen su canal en OTRA tienda (`notification_prefs`) y ese módulo es el
   * que sabe cuál mirar: escribir el store a mano los dejaría con el tablero diciendo
   * una cosa y el correo saliendo igual.
   *
   * Los nombres y los íconos son los de una automatización (`MENU_MAS`: «Esperar»,
   * «Condición», «Acción», «MaKo en WhatsApp», «Email»), y DÓNDE entra sale del id del
   * nodo: los pasos del grafo son `paso-<i>`, así que el ＋ de `paso-2` inserta en la
   * posición 3 y el de la tarjeta del mensaje, al principio. El de la fila de una
   * CONDITION inserta después de ella: la rama del «sí» (el «Si no» no ofrece ＋).
   */
  async function agregarTras(nodoId: string, que: string) {
    const canal = que === 'mako' ? 'wa' : que === 'email' ? 'email' : null;
    // Lo escrito en el panel abierto se TOMA y entra en el mismo guardado, y el panel se cierra:
    // el paso nuevo corre los índices, y con el panel abierto lo de una acción caía en otra.
    const pend = canal ? null : panelPendiente.current?.tomar() ?? null;
    if (!canal) { setSel(null); setRedactaEn(null); }
    if (canal) {
      if (!id) return;
      setBusy(true); setErr(null);
      const r = await guardarCanalDeMensaje(id, canal, true, endpoint);
      if (!r.ok) setErr(r.error ?? 'No pude prender el canal');
      setBusy(false);
      onCambio?.();
      return;
    }
    const sinPend = flujo ?? FLUJO_VACIO;
    const base = pend ? { ...sinPend, pasos: sinPend.pasos.map((p) => (p === pend.original ? pend.nuevo : p)) } : sinPend;
    /**
     * ⚠️ LOS TRES SON PASOS DE VERDAD Y EL MOTOR LOS CORRE. El `esperar` existía en el
     * tipo desde el día uno y hacía `break`: con `flujo_corridas` (mig 0186) el motor
     * se duerme y un cron lo despierta, y recién por eso estas dos tarjetas se pueden
     * ofrecer. La regla de la casa es que sólo se dibuja la rama que el motor EJECUTA,
     * y `tests/flujo-condicional.test.ts` falla si alguna se separa de la otra.
     *
     * Y el condicional nace en `contestaron`, que es la única señal que este motor
     * puede ver: el acuse en el grupo de MaKo, el mismo que corta las insistencias.
     *
     * ⚠️ LA ACCIÓN NACE SIN ACCIÓN, a propósito. Corre sola (decisión de Martín,
     * 08/10/2026), así que un default elegido acá sería algo que el flujo hace sin que
     * nadie lo haya elegido. Hasta ese día nacía en `crear_tarea`, que no corría nunca.
     * Sin operación el motor no la corre y la tarjeta dice «Elige una acción».
     */
    const nuevo: Paso =
      que === 'esperar' ? { tipo: 'esperar', horas: 24 }
      : que === 'condicion' ? { tipo: 'condicional', condicion: 'contestaron' }
      : { tipo: 'accion' };
    void guardarFlujo({ ...base, activo: true, pasos: insertarPasoTras(base.pasos, nodoId, nuevo) });
  }

  /**
   * QUÉ OFRECE EL ＋ DE CADA LUGAR: el menú de una automatización (`MENU_MAS`, con sus nombres, sus
   * íconos y sus grupos), recortado a lo que un mensaje de MaKo puede tener. Los canales, sólo en el
   * círculo de la tarjeta del mensaje y si están apagados (un canal prendido no es una opción: su
   * tarjeta ya está); en el medio de una flecha, nunca (un canal se prende para el mensaje entero, no
   * entre dos pasos).
   */
  const opcionesEn = (nodo: string, puerto: string | undefined, medio: boolean) => {
    // El ＋ «en paralelo» del círculo de la cabeza (lib/flujo-aviso.ts, `canalPorPrender`): sólo prende un
    // canal, que sale a la vez. Un paso en paralelo no tiene lugar en una lista.
    const enParalelo = (puerto ?? '').startsWith('par');
    return MENU_MAS
      .filter((o) => (o.value === 'mako' ? !medio && nodo === cabeza && !canales.wa
        : o.value === 'email' ? !medio && nodo === cabeza && !canales.email
          : OPCIONES_PASO.has(o.value) && !enParalelo))
      .map(({ fueraDeRespuesta, ...o }) => { void fueraDeRespuesta; return o; });
  };

  /**
   * BORRAR UN PASO: el tacho de la cabecera del panel (sexta tanda, general 9) y el click derecho. Hasta
   * acá era un link rojo «Quitar este paso» al pie de cada editor. Lo escrito en el panel se DESCARTA:
   * se armó sobre el paso que se va, y guardado después lo devolvería.
   */
  const borrarPaso = (nodoId: string) => {
    const m = /^paso-(\d+)$/.exec(nodoId);
    if (!m) return;
    panelPendiente.current?.tomar();
    elegirTarjeta(null);
    const base = flujo ?? FLUJO_VACIO;
    void guardarFlujo({ ...base, pasos: quitarPasoDibujado(base.pasos, Number(m[1])) });
  };
  /** DUPLICAR UN PASO (click derecho, sexta tanda, punto 2): la copia va justo después, con lo pendiente adentro. */
  const duplicarPaso = (nodoId: string) => {
    const m = /^paso-(\d+)$/.exec(nodoId);
    if (!m) return;
    const pend = panelPendiente.current?.tomar() ?? null;
    elegirTarjeta(null);
    const sinPend = flujo ?? FLUJO_VACIO;
    const base = pend ? { ...sinPend, pasos: sinPend.pasos.map((p) => (p === pend.original ? pend.nuevo : p)) } : sinPend;
    const original = pasosDibujados(base.pasos)[Number(m[1])];
    if (!original) return;
    void guardarFlujo({ ...base, pasos: insertarPasoTras(base.pasos, nodoId, JSON.parse(JSON.stringify(original)) as Paso) });
  };

  /**
   * EL CLICK DERECHO (sexta tanda, punto 2): en un paso, duplicar y eliminar; en el fondo, «Acomodar» (el
   * lienzo suma «Centrar»). Lo que NO se ofrece, a propósito: crear una tarjeta suelta y arrastrar o borrar
   * una flecha. Los pasos de un mensaje son una LISTA que el motor recorre en orden (`decidir`): una
   * tarjeta sin flecha o una flecha a otro lado no tienen cómo guardarse.
   */
  const menuNodo = editable ? (nodoId: string): ItemMenuLienzo[] => (/^paso-\d+$/.test(nodoId) ? [
    { id: 'duplicar', label: 'Duplicar', icono: <Icon name="copy" size={16} />, onElegir: () => duplicarPaso(nodoId) },
    { id: 'eliminar', label: 'Eliminar', grupo: 1, peligro: true, icono: <IconoBorrar size={16} />, onElegir: () => borrarPaso(nodoId) },
  ] : []) : undefined;
  const menuLienzo = editable ? (): ItemMenuLienzo[] => [
    { id: 'acomodar', label: 'Acomodar', grupo: 90, icono: <IconoAcomodar />, deshabilitado: !hayPosiciones, onElegir: acomodar },
  ] : undefined;

  // El tamaño del panel de la tarjeta abierta (con `muelles`): por su TIPO, nunca por su contenido.
  const nodoSel = sel ? grafo.nodos.find((n) => n.id === sel) ?? null : null;
  const talla = muelles ? editorDeTarjeta(muelles, tallaDe(nodoSel)) : null;
  /**
   * LA CABECERA DEL PANEL DE «MaKo en WhatsApp» (sexta tanda, MaKo en WhatsApp 1 y 2): el logo y «MaKo en
   * WhatsApp», como la tarjeta MAKO de una automatización (`CabeceraMakoEnWhatsApp`), y el ✦ al lado del
   * título en el mensaje que MaKo puede escribir. Hasta acá era el ícono y «MAKO EN WHATSAPP» en
   * mayúsculas, con el botón de IA metido adentro del editor.
   */
  const cabeceraMaKo = nodoSel?.tipo === 'mako';

  return (
    <>
      <Lienzo
        grafo={grafo} seleccion={sel} onSeleccion={elegirTarjeta} onMover={mover}
        onAgregarTras={editable ? ((nodoId, que) => void agregarTras(nodoId, que)) : undefined}
        opcionesEn={opcionesEn}
        // El círculo de la tarjeta del mensaje (la cabeza de la cadena) y el de cada paso. El del CRON no:
        // lo que sigue al CRON es el mensaje, y su salida va llena.
        puedeAgregarTras={(idNodo) => idNodo === cabeza || /^paso-\d+$/.test(idNodo)}
        agregarOcupado={busy}
        onBorrar={editable ? borrarPaso : undefined}
        puedeBorrar={(idNodo) => /^paso-\d+$/.test(idNodo)}
        menuNodo={menuNodo} menuLienzo={menuLienzo}
        panelAncho={talla ? talla.ancho : PANEL_AVISO}
        panelForma={muelles?.editorForma === 'apaisado' ? 'apaisado' : 'columna'}
        panelAlto={talla?.alto}
        chrome={chrome}
        herramientas={editable ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <BotonPila titulo="Deshacer (Ctrl+Z)" onClick={deshacer} activo={puedeDeshacer}>↶</BotonPila>
            <BotonPila titulo="Rehacer (Ctrl+Y)" onClick={rehacer} activo={puedeRehacer}>↷</BotonPila>
            <BotonPila titulo="Acomodar" onClick={acomodar} activo={hayPosiciones}><IconoAcomodar /></BotonPila>
          </div>
        ) : undefined}
        sinMarco alto="100%" insetIzq={insetIzq}
        insetDer={muelles?.insets.der} insetDerChrome={muelles?.insets.derChrome} insetDerAbajo={muelles?.insets.derAbajo}
        renderNodo={(n, activo) => {
          // El DELAY que no va en una flecha (al final de la cadena): su píldora de una línea.
          if (n.tipo === 'espera') return <TarjetaNodo key={n.id} nodo={n} activo={activo} roto={Boolean(n.advertencia)}>{n.detalle}</TarjetaNodo>;
          // LA TARJETA CRON (sexta tanda, CRON 10): una cajita por cosa que lo dispara y «＋ Nuevo CRON» mientras
          // no haya ninguno elegido. Tocar una cajita abre el editor del CRON.
          if (n.id === 'entrada') {
            return (
              <TarjetaNodo key={n.id} nodo={n} activo={activo}>
                <CuerpoCron disparadores={disparadoresDeAviso(aviso)}
                  onAbrir={() => elegirTarjeta('entrada')}
                  onNuevo={editable && !cron && aviso.evento?.tipo !== 'evento' ? () => elegirTarjeta('entrada') : undefined} />
              </TarjetaNodo>
            );
          }
          return (
            <TarjetaNodo key={n.id} nodo={n} activo={activo} roto={Boolean(n.advertencia)}>
              {/* ⚠️ LA TARJETA DE MaKo EN WHATSAPP (MaKo en WhatsApp 3): el mensaje como le llega al
                  grupo, con la MISMA burbuja que el lienzo del Chatbot y que su editor (`BurbujaHilo`,
                  firmada por MaKo, a la izquierda como la ve el equipo). El id es `mensaje` aunque el
                  tipo sea `mako` (lib/flujo-aviso.ts): las posiciones y el ＋ se buscan por id. Un texto
                  largo termina en «…» adentro de la tarjeta (WhatsApp 12): los renglones salen del MISMO
                  alto que estima el grafo. */}
              {n.id === 'mensaje' && n.tipo === 'mako'
                ? <>
                    <BurbujaHilo compacta saliente={false} autor="MaKo" contenido={{ texto }} lineas={lineasMensaje}
                      vacio={<span style={{ color: 'var(--faint)', fontSize: 12.5 }}>Sin escribir</span>} />
                    {n.detalle && <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.detalle}</div>}
                  </>
                : n.id === 'mensaje-email'
                  ? <VistaEmailAviso asunto={asunto ?? ''} titulo={tituloMensaje ?? ''} texto={texto} />
                  : n.tipo === 'condicion'
                    ? null
                    : <div style={{
                      fontSize: 12.5, fontWeight: n.tipo === 'accion' ? 600 : 400, color: 'var(--ink)', lineHeight: 1.45, whiteSpace: 'pre-wrap',
                      display: '-webkit-box', WebkitLineClamp: n.tipo === 'mako' ? 3 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere',
                    }}>{detalleDe(n)}</div>}
            </TarjetaNodo>
          );
        }}
        renderEditor={(n) => (
          <EditorDelAviso
            nodo={n} id={id} disparador={disparador} frecuenciaMin={frecuenciaMin}
            texto={texto} endpoint={endpoint} editable={editable} textoEditable={textoEdit} guardando={guardando || busy}
            asunto={asunto} onAsunto={onAsunto} onAsuntoGuardar={onAsuntoGuardar}
            tituloMensaje={tituloMensaje}
            aporta={aporta}
            canales={canales} flujo={flujo} insistir={insistir} cron={cron} tz={tz} onCron={guardarCron}
            acusesTxt={acusesTxt} onAcuses={guardarAcuses}
            onTexto={onTexto} onCambio={onCambio} onFlujo={guardarFlujo} panelPendiente={panelPendiente}
            probando={probando} prueba={prueba} onProbar={onProbar}
            redactando={redactaEn === n.id} onCerrarRedacta={() => setRedactaEn(null)}
          />
        )}
        tituloEditor={cabeceraMaKo ? (n) => (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: '0 1 auto', minWidth: 0 }}><CabeceraMakoEnWhatsApp /></div>
            {n.id === 'mensaje' && textoEdit && (
              <BotonMakoAviso abierto={redactaEn === n.id} deshabilitado={probando}
                onClick={() => setRedactaEn((x) => (x === n.id ? null : n.id))} />
            )}
          </div>
        ) : undefined}
        accion={pie}
      />
      {err && (
        <div style={{ flex: 'none', marginTop: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--bad)' }}>{err}</div>
      )}
    </>
  );
}

/**
 * EL EMAIL EN LA TARJETA, COMO UN MAIL (como en una automatización: `VistaEmail` de
 * app/automations/FlujoLienzo.tsx, privada allá): el asunto arriba en negrita —el título del mensaje en
 * gris si no tiene uno propio— y hasta tres renglones del cuerpo, que es el MISMO texto del mensaje. Los
 * números son los de `altoDeMensaje` (`MARCO_MAIL`, `RENGLON_ASUNTO`, …): la tarjeta tiene alto fijo.
 */
function VistaEmailAviso({ asunto, titulo, texto }: { asunto: string; titulo: string; texto: string }) {
  const propio = asunto.trim();
  const linea: CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: `${(MARCO_MAIL - 2) / 2}px 9px`, background: 'var(--surface)' }}>
      <div style={{ ...linea, fontSize: 12.5, fontWeight: 700, lineHeight: `${RENGLON_ASUNTO}px`, color: propio ? 'var(--ink)' : 'var(--faint)' }}>{propio || titulo || 'Sin asunto'}</div>
      {texto.trim() && (
        <div style={{
          marginTop: SEP_MAIL, fontSize: 12, lineHeight: `${RENGLON_CUERPO_MAIL}px`, color: 'var(--dim)', whiteSpace: 'pre-wrap',
          display: '-webkit-box', WebkitLineClamp: RENGLONES_EMAIL, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere',
        }}><TextoMarcas texto={texto} /></div>
      )}
    </div>
  );
}

/**
 * El ✦ de MaKo de la cabecera del panel (la misma cara que el de un WhatsApp: el logo en un chip, dorado
 * con el panel abierto). Abre el panel que ayuda a escribir el mensaje (`RedactaAviso`).
 */
function BotonMakoAviso({ abierto, onClick, deshabilitado }: { abierto: boolean; onClick: () => void; deshabilitado?: boolean }) {
  return (
    <button type="button" data-no-pan disabled={deshabilitado} aria-pressed={abierto} onClick={onClick}
      title="Que MaKo te ayude a escribirlo" aria-label="Que MaKo te ayude a escribirlo"
      style={{
        flex: 'none', height: 28, padding: '0 8px', borderRadius: 14, cursor: deshabilitado ? 'default' : 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS,
        border: `1px solid ${abierto ? 'var(--mako-border)' : 'var(--border)'}`,
        background: abierto ? 'var(--mako-bg)' : 'var(--surface)', opacity: deshabilitado ? 0.5 : 1,
      }}>
      <MakoLogo size={16} animate={false} />
    </button>
  );
}

// ── El editor de cada nodo ──────────────────────────────────────────────────

function EditorDelAviso({
  nodo, texto, editable, textoEditable, guardando, canales,
  asunto, onAsunto, onAsuntoGuardar, tituloMensaje, aporta,
  flujo, cron, tz, onCron, onTexto, onFlujo, probando, prueba, onProbar,
  panelPendiente, redactando, onCerrarRedacta,
}: {
  nodo: NodoFlujo; id: string; disparador: string; frecuenciaMin: number; texto: string;
  endpoint: string; editable: boolean; textoEditable: boolean; guardando: boolean; canales: { wa: boolean; email: boolean };
  asunto?: string; onAsunto?: (v: string) => void; onAsuntoGuardar?: () => void;
  tituloMensaje?: string;
  aporta: ReadonlyArray<'lead' | 'cuota'>;
  flujo: Flujo | null;
  insistir: Extract<Paso, { tipo: 'insistir' }> | null;
  cron: CronAviso | null;
  tz: string | null;
  onCron: (c: CronAviso | null) => Promise<boolean> | void;
  acusesTxt: string;
  onAcuses: (v: string, soloPintar?: boolean) => void;
  onTexto: (v: string) => void;
  onCambio?: () => void;
  onFlujo: (f: Flujo | null) => void;
  probando: boolean; prueba: string | null; onProbar: (contexto?: string) => void;
  panelPendiente: React.MutableRefObject<PanelPendiente | null>;
  /** El ✦ de la cabecera está abierto sobre esta tarjeta. */
  redactando: boolean;
  onCerrarRedacta: () => void;
}) {
  const base = flujo ?? FLUJO_VACIO;

  if (nodo.tipo === 'entrada') {
    return (
      <SeccionCron
        base={base} cron={cron} tz={tz}
        guardando={guardando} onFlujo={onFlujo} onCron={onCron}
      />
    );
  }
  /**
   * EL NODO DEL EMAIL, CON LA CARA DE REDACTAR EN GMAIL (como el editor del email de una automatización,
   * `EditorEmailGmail`, que no se monta tal cual: ése le escribe a un LEAD, con su «De», su HTML y los
   * datos del lead). Hasta el 10/10 era un rótulo «Asunto del correo», un input y una frase.
   *
   * ⚠️ EL CUERPO ES UNO, Y SE DICE. El mensaje tiene UN `texto` para los dos canales, y
   * lo único que es propio del correo es el ASUNTO —en WhatsApp no hay asunto, y en una
   * bandeja el título interno («Lead sin confirmar») se lee como un log—. El cuerpo que se
   * edita acá es ESE texto (con WhatsApp apagado, es el único lugar donde se escribe), y
   * con WhatsApp prendido la línea de abajo lo dice.
   */
  if (nodo.id === 'mensaje-email') {
    return (
      <EditorEmailAviso nodo={nodo} asunto={asunto ?? ''} titulo={tituloMensaje ?? ''} texto={texto}
        asuntoEditable={!guardando && editable && !!onAsunto} textoEditable={textoEditable && !guardando}
        onAsunto={(v) => onAsunto?.(v)} onAsuntoGuardar={() => onAsuntoGuardar?.()} onTexto={onTexto}
        conWhatsApp={canales.wa}
        datos={variablesOfrecidas({
          destino: 'equipo',
          conLead: base.disparador.tipo === 'evento' || aporta.includes('lead'),
          conCuota: aporta.includes('cuota'),
        })} />
    );
  }
  if (nodo.id === 'mensaje') {
    /**
     * ⚠️ ACA VIVIA «RECORDATORIOS», Y SE FUE EL 04/10/2026.
     *
     * Pedido: «elimina el apartado de "Recordatorios", para eso ya tendremos los
     * condicionales y la opción de poner más mensajes». Lo que se sacó es la UI: el
     * paso `insistir` sigue existiendo en el motor (lib/flujos.ts), con su techo de
     * 5 veces, sus 30 minutos mínimos y su corte con un «ok» en el grupo.
     *
     * Se midió antes de sacarlo, que es lo que la regla de la casa pide cuando se
     * saca un patrón: **cero flujos tienen hoy un paso `insistir`** en los cuatro
     * workspaces que tocaron el store.
     */

    // ⚠️ `textoEditable`, no `editable` (sexta tanda): en un aviso cuyo texto arma el código el flujo
    // se sigue editando y el mensaje no. Y la nota sirve para los dos casos —el aviso técnico de la
    // agencia y el del cliente que se arma con lo que pasó (el reporte, la reunión, la línea)—: lo que
    // se ve es un ejemplo, y escribir encima no cambiaría lo que llega.
    if (!textoEditable) {
      return (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}><TextoMarcas texto={texto} /></div>
          <p style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, marginTop: 9, marginBottom: 0 }}>
            Lo redacta MaKo con lo que pasa cada vez: esto es un ejemplo.
          </p>
        </>
      );
    }
    // EL ✦ DE LA CABECERA (sexta tanda, WhatsApp 3): el panel que ayuda a escribir ocupa el lugar del chat.
    if (redactando) {
      return (
        <RedactaAviso prueba={prueba} probando={probando} onProbar={onProbar} deshabilitado={guardando}
          onUsar={(t, modo) => { onTexto(modo === 'reemplazar' ? t : [texto, t].filter((x) => x.trim()).join('\n\n')); onCerrarRedacta(); }}
          onCerrar={onCerrarRedacta} />
      );
    }
    return (
      // ⚠️ EL MISMO EDITOR QUE «MaKo EN WHATSAPP» DEL CHATBOT (MaKo en WhatsApp 2 y 3: «El editable
      // de MaKo en WhatsApp debe ser lo mismo que el editable de WhatsApp» y «tienen una interfaz
      // vieja, elimina eso»): `EditorMensajeGrupo`, el chat con la burbuja de MaKo, emojis y el
      // árbol del «{ }». ⚠️ SE OFRECE SÓLO LO QUE ESTE MENSAJE PUEDE RESOLVER: un `{{lead_nombre}}`
      // en un aviso que no habla de ningún lead sale CRUDO al WhatsApp del cliente. Y LO QUE SE PUEDE
      // RESOLVER NO SALE SÓLO DEL FLUJO: un cron puede traer el lead en la mano —la cobranza es el
      // caso—, y lo declara el catálogo (`aporta`). El destino es el EQUIPO.
      <EditorMensajeGrupo texto={texto} onTexto={onTexto} deshabilitado={guardando}
        datos={variablesOfrecidas({
          destino: 'equipo',
          conLead: base.disparador.tipo === 'evento' || aporta.includes('lead'),
          conCuota: aporta.includes('cuota'),
        })} />
    );
  }

  // Un paso agregado: acción, espera, condición, mensaje al grupo o mensaje al lead.
  //
  // ⚠️ LA ESPERA, LA CONDICIÓN Y EL MENSAJE AL GRUPO CAÍAN AL `return` DEL FINAL (sexta tanda,
  // General 15: «hay plantillas que quedaron viejas… que no tienen sentido»): el panel mostraba una
  // línea y nada más. La plantilla de fábrica de la cobranza son EXACTAMENTE esos tres tipos (dos
  // esperas y dos mensajes al grupo). La pregunta es por el ID (`paso-N`), no por el tipo: el mensaje
  // al grupo es `tipo: 'mako'`, igual que el mensaje principal.
  //
  // ⚠️ Y NINGUNO LLEVA «Quitar este paso» (10/10/2026): borrar es de la TARJETA, el tacho rojo de la
  // cabecera del panel (`onBorrar` del Lienzo), como en una automatización.
  if (/^paso-\d+$/.test(nodo.id)) {
    const i = nodo.orden ?? 0;
    const vivos = pasosDibujados(base.pasos);
    const paso = vivos[i];
    const reemplazar = (nuevo: Paso) => onFlujo({ ...base, pasos: base.pasos.map((p) => (p === paso ? nuevo : p)) });
    const advertencia = nodo.advertencia && (
      <p style={{ fontSize: 11.5, color: 'var(--warn)', lineHeight: 1.45, marginTop: 6, marginBottom: 0 }}>{nodo.advertencia}</p>
    );
    if (paso?.tipo === 'accion') {
      // El `key` es el del nodo: abrir otra tarjeta de acción tiene que traer SU estado,
      // no reusar el de la anterior (el editor siembra un `useState` de props).
      return (
        <EditorPasoAccion key={nodo.id} paso={paso} onGuardar={reemplazar}
          advertencia={advertencia} panelPendiente={panelPendiente} />
      );
    }
    if (paso?.tipo === 'esperar') {
      return (
        <EditorPasoEspera key={nodo.id} paso={paso} onGuardar={reemplazar}
          guardando={guardando} advertencia={advertencia} panelPendiente={panelPendiente} />
      );
    }
    if (paso?.tipo === 'condicional') {
      return (
        <EditorPasoCondicion key={nodo.id} paso={paso} onGuardar={reemplazar}
          guardando={guardando} advertencia={advertencia} panelPendiente={panelPendiente} />
      );
    }
    if (paso?.tipo === 'mensaje' && paso.canal === 'aviso_dueno') {
      return (
        <EditorPasoAlGrupo key={nodo.id} paso={paso} onGuardar={reemplazar}
          guardando={guardando} advertencia={advertencia} panelPendiente={panelPendiente}
          datos={variablesOfrecidas({
            destino: 'equipo',
            conLead: base.disparador.tipo === 'evento' || aporta.includes('lead'),
            conCuota: aporta.includes('cuota'),
          })} />
      );
    }
    return (
      <>
        {paso?.tipo === 'mensaje' && (
          <>
            <label style={rotuloLienzo}>Qué le escribe al lead</label>
            <textarea value={paso.texto} rows={4} disabled={guardando}
              onChange={(e) => reemplazar({ ...paso, texto: e.target.value })}
              style={{ ...inpLienzo, resize: 'vertical', lineHeight: 1.45 }} />
            {/* ⛔ Este paso NO SE MANDA (decisión de Martín, 06/10/2026: «nada al
                cliente»; ver la rama en lib/flujos.ts). El lienzo ya no ofrece crearlo; queda
                para el que exista, con su marca en la tarjeta. */}
          </>
        )}
        {advertencia}
      </>
    );
  }

  return <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{nodo.detalle}</div>;
}

/**
 * EL PANEL DEL PASO «⚡ ACCIÓN»: cualquier acción de MaKo, con sus datos.
 *
 * Decisión de Martín (08/10/2026), textual: un paso de un flujo «que pueda hacer todo, sin
 * limitaciones». Lo que se configura acá CORRE SOLO cuando el flujo llega a este paso
 * (`ejecutarDesdeFlujo` en lib/flujos.ts): el dueño confirma al configurar, no después.
 * Por eso ya no hay ninguna línea que prometa «se hace con tu sí» — era cierta para las
 * tres acciones fijas de antes, y ésas no corrían nunca.
 *
 * El editor es el COMPARTIDO por los dos lienzos (`EditorAccionMako`), montado tal cual.
 *
 * ⚠️ TIENE ESTADO PROPIO Y GUARDA CON UN RESPIRO, por tres razones medidas en este archivo:
 *  · `guardarFlujo` no pinta optimista —el flujo se repinta con lo que contesta el server—,
 *    así que un campo de texto controlado por el flujo PIERDE LETRAS si se escribe más
 *    rápido que un POST;
 *  · cada guardado apila un deshacer, y uno por tecla deja un Ctrl+Z que borra una letra;
 *  · no se le pasa `disabled={guardando}`: con el guardado en vuelo el campo se apagaría y
 *    perdería el foco a mitad de una palabra.
 * Elegir la ACCIÓN se guarda en el acto; los datos, 700 ms después de la última tecla.
 *
 * ⚠️ Y LO PENDIENTE SE MANDA AL CERRAR EL PANEL, salvo que se haya BORRADO el paso: el tacho
 * lo descarta antes (`borrarPaso` toma lo pendiente), porque armado con el flujo de antes de
 * quitarlo, lo devolvería.
 */
function EditorPasoAccion({ paso, onGuardar, advertencia, panelPendiente }: {
  paso: PasoAccion;
  onGuardar: (nuevo: PasoAccion) => void;
  advertencia?: React.ReactNode;
  panelPendiente: React.MutableRefObject<PanelPendiente | null>;
}) {
  // Un paso VIEJO (sólo `accion`, sin `operacion`) se abre sin acción elegida: sus tres
  // valores no son ids del registro y el motor no lo corre.
  const [valor, setValor] = useState<ValorAccion>(() => {
    const op = operacionDelPaso(paso);
    return op ? { operacion: op, params: paso.params ?? {} } : {};
  });
  // El guardado diferido llama al `onGuardar` del ÚLTIMO render: el de un render viejo
  // reemplazaría el paso sobre un flujo que ya cambió.
  const guardarRef = useRef(onGuardar);
  useEffect(() => { guardarRef.current = onGuardar; });
  const pendiente = useRef<ValorAccion | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  const soltar = useCallback(() => {
    if (reloj.current) { clearTimeout(reloj.current); reloj.current = null; }
    const v = pendiente.current;
    pendiente.current = null;
    if (v) guardarRef.current(pasoDeAccion(v));
  }, []);
  useEffect(() => soltar, [soltar]);
  // El paso de ESTE render: es el que está en el flujo de ahora, así que es contra el que el
  // tablero reemplaza lo que toma.
  const pasoRef = useRef(paso);
  useEffect(() => { pasoRef.current = paso; });
  useEffect(() => {
    const yo: PanelPendiente = {
      tomar: () => {
        if (reloj.current) { clearTimeout(reloj.current); reloj.current = null; }
        const v = pendiente.current;
        pendiente.current = null;
        return v ? { original: pasoRef.current, nuevo: pasoDeAccion(v) } : null;
      },
    };
    panelPendiente.current = yo;
    return () => { if (panelPendiente.current === yo) panelPendiente.current = null; };
  }, [panelPendiente]);
  // Y cambiar de pestaña o cerrar el navegador también es salir: ahí el desmonte no corre.
  useEffect(() => {
    const alOcultar = () => { if (document.visibilityState === 'hidden') soltar(); };
    document.addEventListener('visibilitychange', alOcultar);
    return () => document.removeEventListener('visibilitychange', alOcultar);
  }, [soltar]);

  const cambiar = (v: ValorAccion) => {
    const otraAccion = (v.operacion ?? '') !== (valor.operacion ?? '');
    setValor(v);
    pendiente.current = v;
    if (reloj.current) clearTimeout(reloj.current);
    if (otraAccion) soltar();
    else reloj.current = setTimeout(soltar, 700);
  };

  return (
    <>
      <EditorAccionMako valor={valor} onCambio={cambiar} />
      {advertencia}
    </>
  );
}

/**
 * EL GUARDADO DIFERIDO DE UN PASO, para los editores de la espera, la condición y el mensaje al
 * grupo (sexta tanda). Es el MISMO contrato que `EditorPasoAccion` (arriba, y por las mismas
 * razones): lo escrito espera 700 ms, se registra en `panelPendiente` para que el tablero lo TOME
 * antes de cambiar el flujo por otro camino (un ＋, un deshacer, el tacho), se manda al desmontar y al
 * ocultar la pestaña. `enElActo` es para lo que se elige de una vez (una opción de un desplegable).
 */
function usePasoDiferido<V>(paso: Paso, inicial: () => V, aPaso: (v: V) => Paso, onGuardar: (nuevo: Paso) => void,
  panelPendiente: React.MutableRefObject<PanelPendiente | null>) {
  const [valor, setValor] = useState<V>(inicial);
  const guardarRef = useRef(onGuardar);
  useEffect(() => { guardarRef.current = onGuardar; });
  const aPasoRef = useRef(aPaso);
  useEffect(() => { aPasoRef.current = aPaso; });
  const pasoRef = useRef(paso);
  useEffect(() => { pasoRef.current = paso; });
  const pendiente = useRef<{ v: V } | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parar = () => { if (reloj.current) { clearTimeout(reloj.current); reloj.current = null; } };
  const soltar = useCallback(() => {
    if (reloj.current) { clearTimeout(reloj.current); reloj.current = null; }
    const p = pendiente.current;
    pendiente.current = null;
    if (p) guardarRef.current(aPasoRef.current(p.v));
  }, []);
  useEffect(() => soltar, [soltar]);
  useEffect(() => {
    const yo: PanelPendiente = {
      tomar: () => {
        if (reloj.current) { clearTimeout(reloj.current); reloj.current = null; }
        const p = pendiente.current;
        pendiente.current = null;
        return p ? { original: pasoRef.current, nuevo: aPasoRef.current(p.v) } : null;
      },
    };
    panelPendiente.current = yo;
    return () => { if (panelPendiente.current === yo) panelPendiente.current = null; };
  }, [panelPendiente]);
  useEffect(() => {
    const alOcultar = () => { if (document.visibilityState === 'hidden') soltar(); };
    document.addEventListener('visibilitychange', alOcultar);
    return () => document.removeEventListener('visibilitychange', alOcultar);
  }, [soltar]);
  const cambiar = (v: V, enElActo = false) => {
    setValor(v);
    pendiente.current = { v };
    parar();
    if (enElActo) soltar();
    else reloj.current = setTimeout(soltar, 700);
  };
  return { valor, cambiar };
}

type PropsPaso<P extends Paso> = {
  paso: P;
  onGuardar: (nuevo: Paso) => void;
  guardando: boolean;
  advertencia?: React.ReactNode;
  panelPendiente: React.MutableRefObject<PanelPendiente | null>;
};

/** Un ícono por unidad (general 10), los mismos del DELAY de una automatización. */
const ICONO_UNIDAD: Record<UnidadEspera, NombreIconoMenu> = { s: 'cronometro', min: 'reloj', h: 'reloj', dias: 'calendario' };

/**
 * DELAY, COMO UNA FRASE GIGANTE: «Esperar [24] [horas ▾]» (como el DELAY de una automatización, sexta tanda,
 * CRON 1: «Haz los botones gigantes»; quinta, punto 3: minutos además de horas). Hasta el 10/10 era «Cuántas
 * horas espera» con un input chico y sólo horas.
 *
 * ⚠️ EL DATO SIGUE SIENDO `horas` (lo lee el motor de avisos, `decidir` en lib/flujo-pasos.ts, que acepta
 * fracciones: un minuto es 1/60). Lo que se ofrece es lo que el motor cumple: de un minuto a 30 días, y lo
 * guardado se MUESTRA acotado igual que el motor lo acota (`sanearHoras`): una espera vieja de 8760 h se lee
 * «30 días», que es lo que de verdad espera.
 */
function EditorPasoEspera({ paso, onGuardar, guardando, advertencia, panelPendiente }: PropsPaso<Extract<Paso, { tipo: 'esperar' }>>) {
  // El valor del panel son SEGUNDOS (en minutos enteros, acotados como el motor); el paso guarda `horas`.
  const { valor, cambiar } = usePasoDiferido<number>(paso, () => segundosDeEspera(paso.horas),
    (s) => ({ tipo: 'esperar', horas: horasDeEspera(s) }), onGuardar, panelPendiente);
  const [preferida, setPreferida] = useState<UnidadEspera | null>(null);
  const unidad = unidadDeEsperaAviso(valor, preferida);
  const n = Math.max(1, Math.round(valor / SEGUNDOS_DE[unidad]));
  const poner = (cuanto: number, u: UnidadEspera, enElActo: boolean) =>
    cambiar(Math.round(horasDeEspera(Math.round(cuanto) * SEGUNDOS_DE[u]) * 3600), enElActo);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', flex: 'none', fontFamily: SANS }}>Esperar</span>
        <input type="number" min={1} max={Math.floor(ESPERA_AVISO_MAX_S / SEGUNDOS_DE[unidad])} step={1} value={n} disabled={guardando}
          aria-label="Cuánto" inputMode="numeric"
          onChange={(ev) => { const v = Number(ev.target.value); if (v > 0) poner(v, unidad, false); }}
          style={{ ...campoGrande, minHeight: ALTO_PRINCIPAL, width: 104, flex: 'none', textAlign: 'center', fontSize: 22, fontWeight: 700, borderRadius: 13, border: '1.5px solid var(--border-strong)' }} />
        <div style={{ flex: '1 1 170px', minWidth: 0 }}>
          <Dropdown value={unidad} width="100%" ariaLabel="Unidad" search={false} disabled={guardando} variante="principal"
            options={UNIDADES_ESPERA_AVISO.map((u) => ({ value: u, label: rotuloUnidad(u, n), icono: ICONO_UNIDAD[u] }))}
            onChange={(v) => { const u = v as UnidadEspera; setPreferida(u); poner(n, u, true); }} />
        </div>
      </div>
      {advertencia}
    </>
  );
}

/**
 * CONDITION: el único dato que este motor ve es si alguien contestó en el grupo (`CONDICIONES_FLUJO`).
 * Una frase, sin rótulo arriba (8/10, punto 5: «menos títulos»), con el desplegable PRINCIPAL de la casa
 * (CONDITION 3: «Tiene que tener más protagonismo el principal»). Lo que pasa si no se cumple lo dice la
 * tarjeta, en su fila «Si no».
 */
function EditorPasoCondicion({ paso, onGuardar, guardando, advertencia, panelPendiente }: PropsPaso<Extract<Paso, { tipo: 'condicional' }>>) {
  const { valor, cambiar } = usePasoDiferido<string>(paso, () => paso.condicion,
    (v) => ({ tipo: 'condicional', condicion: v }), onGuardar, panelPendiente);
  const conocida = (CONDICIONES_FLUJO as readonly string[]).includes(valor);
  return (
    <>
      <Dropdown value={valor} onChange={(v) => cambiar(String(v), true)} ariaLabel="Condición" variante="principal" width="100%"
        search={false} disabled={guardando}
        // Una condición guardada que el motor ya no conoce se MUESTRA (un `value` fuera de sus opciones
        // no dibuja nada y el primer clic lo pisa: AGENTS.md); no se ofrece.
        options={[
          ...CONDICIONES_FLUJO.map((c) => ({ value: c, label: ROTULO_CONDICION[c], icono: ICONO_CONDICION[c] })),
          ...(conocida ? [] : [{ value: valor, label: valor, icono: 'condicion' as NombreIconoMenu }]),
        ]} />
      {advertencia}
    </>
  );
}
const ICONO_CONDICION: Record<(typeof CONDICIONES_FLUJO)[number], NombreIconoMenu> = { contestaron: 'check', no_contestaron: 'silenciar' };

/**
 * MAKO EN WHATSAPP, un paso más: lo que sale al grupo, con el MISMO editor que el mensaje principal
 * (`EditorMensajeGrupo`, MaKo en WhatsApp 2) y lo que ESTE aviso puede resolver en el «{ }». Sale
 * tal cual, con los datos puestos por código (lib/flujos.ts).
 */
function EditorPasoAlGrupo({ paso, onGuardar, advertencia, panelPendiente, datos }: PropsPaso<Extract<Paso, { tipo: 'mensaje' }>> & {
  datos: ReturnType<typeof variablesOfrecidas>;
}) {
  const { valor, cambiar } = usePasoDiferido<string>(paso, () => paso.texto,
    (v) => ({ ...paso, texto: v }), onGuardar, panelPendiente);
  return (
    <>
      <EditorMensajeGrupo texto={valor} onTexto={(v) => cambiar(v)} datos={datos} />
      {advertencia}
    </>
  );
}

function Opcion({ activa, onClick, disabled, children }: {
  activa: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={activa}
      style={{
        padding: '5px 12px', borderRadius: 999, cursor: disabled ? 'default' : 'pointer',
        fontSize: 12.5, fontWeight: 600, fontFamily: SANS,
        border: `1px solid ${activa ? 'var(--primary)' : 'var(--border-strong)'}`,
        background: activa ? 'var(--primary-bg)' : 'var(--surface)',
        color: activa ? 'var(--primary)' : 'var(--dim)', opacity: disabled ? 0.6 : 1,
      }}>
      {activa ? '✓ ' : ''}{children}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────

/** El modo del CRON de un mensaje: por tiempo, por un evento, o ninguno (sale sólo por su camino de siempre). */
type ModoDisparo = 'tiempo' | 'accion' | null;

/**
 * LOS DOS TIPOS DE CRON DE UN MENSAJE, como los botones gigantes del CRON de una automatización (sexta
 * tanda, CRON 1 y 2: «Haz los botones gigantes» y «reemplaza "Por tiempo" y "Por una acción" por lo que ya
 * tenemos… "Recurrente"»). Un mensaje de MaKo no tiene producto ni etiqueta que lo disparen: tiene un
 * horario (el Recurrente) o uno de los eventos que el motor emite (`EVENTOS`).
 */
const TIPOS_CRON: ReadonlyArray<{ modo: 'tiempo' | 'accion'; label: string; icono: 'recurrente' | 'otro' }> = [
  { modo: 'tiempo', label: 'Recurrente', icono: 'recurrente' },
  { modo: 'accion', label: 'Evento', icono: 'otro' },
];

/**
 * LA SECCIÓN «CRON»: TIEMPO **o** ACCIÓN, nunca las dos.
 *
 * Pedido textual: «El cron debería ser uno de dos… O el usuario lo configura para
 * que salga en TIEMPO… O lo configura que se dispare mediante una ACCIÓN. Y no deben
 * poder editarse los 2 al mismo tiempo».
 *
 * ⚠️ DESDE EL 10/10/2026 CON LAS PIEZAS DEL CRON DE UNA AUTOMATIZACIÓN (`EditorDisparadores`): la
 * primera pantalla son dos botones gigantes («Recurrente» y «Evento»), el horario es el de Google
 * Calendar (`EditorRecurrente`, que trabaja sobre el mismo `CronAviso` y cuya zona y fecha de inicio
 * respeta `proximaOcurrencia`), y el evento va en el desplegable PRINCIPAL. Hasta acá eran «Por tiempo
 * / Por una acción» chiquitos y el horario de antes («Cada [n] [unidad] / A las [h]:[m]»).
 *
 * Como en una automatización, la ← vuelve a elegir el tipo SIN apagar lo guardado: lo de antes sigue
 * hasta que lo nuevo esté completo (un horario se completa al elegirlo; un evento, al elegir cuál). Y
 * como un mensaje sin CRON es legítimo —sale sólo por su camino de siempre—, el tacho rojo lo quita.
 *
 * ⚠️ ES UN COMPONENTE PROPIO PORQUE NECESITA ESTADO, y un `useState` adentro del
 * editor de nodos quedaría detrás de los `return` por tipo de nodo — que es el
 * «Minified React error #300» que esta casa ya pagó con la pantalla en blanco.
 *
 * ⚠️ Y EL MODO NO SE PUEDE DERIVAR SOLO DE LOS DATOS. Con `modo = cron ? 'tiempo' : evento ? 'accion' :
 * null`, elegir «Evento» no hacía NADA: sin evento elegido el modo seguía siendo null y el desplegable no
 * se dibujaba. Elegir un modo es una INTENCIÓN de quien mira; lo guardado es otra cosa, y la intención
 * manda hasta que se guarde algo.
 *
 * Y el desplegable «cada cuánto, como máximo» se fue de la pantalla: «realmente no me
 * hace ningun tipo de sentido». El CAMPO y sus dos lectores quedan.
 */
function SeccionCron({ base, cron, tz, guardando, onFlujo, onCron }: {
  base: Flujo; cron: CronAviso | null; tz: string | null;
  guardando: boolean; onFlujo: (f: Flujo | null) => void; onCron: (c: CronAviso | null) => Promise<boolean> | void;
}) {
  const evento = base.disparador.tipo === 'evento' ? base.disparador.evento : '';
  const guardado: ModoDisparo = cron ? 'tiempo' : evento ? 'accion' : null;
  const [intencion, setIntencion] = useState<ModoDisparo>(null);
  /** La ← : volver a los dos botones sin tocar lo guardado. */
  const [eligiendo, setEligiendo] = useState(false);
  const modo: ModoDisparo = eligiendo ? null : (intencion ?? guardado);

  /**
   * ⚠️ ELEGIR UNO APAGA EL OTRO, y es una ESCRITURA y no un `disabled`: las dos mitades viven en
   * lugares distintos —el evento en el store del flujo, el horario en su tabla— así que dejar el de
   * al lado puesto y sólo grisarlo dejaría un mensaje disparado por las dos cosas con la pantalla
   * diciendo una. `null` es el tacho: apaga lo que haya.
   *
   * ⚠️ SI EL AGENDADO SE NIEGA, LA INTENCIÓN VUELVE ATRÁS (y el evento NO se apaga). Pasa con el texto de
   * ejemplo (`motivoNoAgendable`): el server contesta el motivo, `guardarCron` revierte el horario, y sin
   * esto quedaba «Recurrente» elegido sin nada abajo — un botón que se prendió y no hizo nada.
   */
  const elegir = (m: ModoDisparo) => {
    setEligiendo(false);
    if (m === null) {
      setIntencion(null);
      if (cron) onCron(null);
      if (evento) onFlujo({ ...base, disparador: { tipo: 'manual' } });
      return;
    }
    setIntencion(m);
    if (m === 'tiempo' && !cron) {
      void Promise.resolve(onCron(CRON_DEFAULT)).then((ok) => { if (ok === false) setIntencion(null); else if (evento) onFlujo({ ...base, disparador: { tipo: 'manual' } }); });
    } else if (m === 'tiempo' && evento) onFlujo({ ...base, disparador: { tipo: 'manual' } });
  };
  /** Elegir el evento lo completa en el acto: recién ahí se apaga el horario, si había uno. */
  const elegirEvento = (v: string) => {
    setIntencion('accion');
    onFlujo({ ...base, activo: true, disparador: { tipo: 'evento', evento: v as EventoFlujo } });
    if (cron) onCron(null);
  };

  if (modo === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {eligiendo && guardado && <div><BotonVolver onClick={() => setEligiendo(false)} titulo="Volver al CRON elegido" /></div>}
        <div role="group" aria-label="Qué dispara este mensaje" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {TIPOS_CRON.map((t) => (
            <button key={t.modo} type="button" onClick={() => elegir(t.modo)} disabled={guardando} data-clase-cron={t.modo}
              className="mk-cron-gigante"
              style={{
                minHeight: 92, padding: '14px 8px', borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--surface)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9, cursor: 'pointer',
                fontFamily: SANS, fontSize: 15, fontWeight: 700, color: 'var(--ink)', transition: 'border-color .12s, box-shadow .12s',
              }}>
              <IconoDisparador tipo={t.icono} tam={38} />
              {t.label}
            </button>
          ))}
        </div>
        <style>{'.mk-cron-gigante:hover:not(:disabled){border-color:var(--primary)!important;box-shadow:0 2px 10px rgba(0,0,0,.07)}'}</style>
      </div>
    );
  }

  const fila = (editor: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
      <BotonVolver onClick={() => setEligiendo(true)} disabled={guardando} titulo="Elegir otro tipo" />
      <div style={{ flex: 1, minWidth: 0 }}>{editor}</div>
      {guardado && (
        <button type="button" onClick={() => elegir(null)} disabled={guardando} title="Quitar este CRON" aria-label="Quitar este CRON"
          style={{ flex: 'none', width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconoBorrar size={16} />
        </button>
      )}
    </div>
  );

  if (modo === 'tiempo') {
    // Mientras el horario de default va al server (`guardarCron` lo pinta optimista), no hay nada que esperar.
    return cron ? fila(<EditorRecurrente cron={cron} tzNegocio={tz} disabled={guardando} onCron={(c) => void onCron(c)} />) : null;
  }
  return fila(
    <Dropdown
      value={evento} variante="principal" width="100%"
      botonLabel={evento ? undefined : 'Elige el evento'}
      // Un evento que quedó sin emisor no se OFRECE, pero si ya está elegido se muestra marcado:
      // un desplegable cuyo valor no está entre sus opciones no muestra nada (AGENTS.md).
      options={[...EVENTOS, ...EVENTOS_SIN_EMISOR.filter((e) => e.key === evento)]
        .map((e) => ({ value: e.key, label: e.label, icono: ICONO_EVENTO[e.key] }))}
      onChange={(v) => elegirEvento(v)}
      ariaLabel="Qué evento dispara este mensaje" disabled={guardando}
    />,
  );
}

/** La ← de la casa para volver a elegir (la del CRON de una automatización). */
function BotonVolver({ onClick, disabled, titulo }: { onClick: () => void; disabled?: boolean; titulo: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={titulo} aria-label={titulo}
      style={{ flex: 'none', width: 34, height: 34, borderRadius: 9, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
  );
}

/**
 * Un botón de la pila. Apagado cuando no hay nada que deshacer o rehacer, que es lo
 * que lo vuelve honesto: ofrecer un «Deshacer» que no deshace nada es peor que no
 * ofrecerlo — la misma regla que ya está escrita en `app/_ui/Toast.tsx` para su
 * `onUndo` opcional.
 *
 * ⚠️ `data-no-pan` lo pone el envoltorio y no cada botón: un `pointerdown` en los
 * píxeles de separación no encuentra el botón, y el lienzo lo tomaría como un paneo.
 */
function BotonPila({ titulo, onClick, activo, children }: {
  titulo: string; onClick: () => void; activo: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={!activo} title={titulo} aria-label={titulo}
      style={{
        width: 26, height: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
        color: activo ? 'var(--dim)' : 'var(--faint)', fontSize: 15, fontFamily: 'inherit',
        cursor: activo ? 'pointer' : 'default', opacity: activo ? 1 : 0.45,
      }}>
      {children}
    </button>
  );
}

/**
 * EL PANEL DEL ✦: MaKo escribe el mensaje a partir de lo que le contás (sexta tanda, WhatsApp 3: «que se
 * pueda grabar audio y que se vaya transcribiendo»). Con la misma cara que el panel del ✦ de un WhatsApp
 * (`MakoRedacta`): la caja con el dictado en vivo (`BotonDictar`), «Escribir», y lo que propone como la
 * burbuja de MaKo, con «Agregar» y «Usar». Nada se publica hasta «Publicar».
 *
 * Pide por el camino de SIEMPRE de un aviso (`onProbar` → la ruta `probar` → `generarMensajeAviso`, la
 * cascada gratis con la key del negocio), no por el de `MakoRedacta`: ése escribe un mensaje AL LEAD con
 * la voz del negocio, y éste lo escribe MaKo para el EQUIPO. Hasta el 10/10 era un input metido en el
 * editor y una caja «MaKo lo escribiría así» debajo.
 *
 * ⚠️ SÓLO SE MUESTRA LO QUE SE PIDIÓ EN ESTA APERTURA: la propuesta vive en quien monta y sobrevive al
 * panel. Si el pedido no trae nada nuevo (la ruta falló, o contestó lo mismo), lo dice.
 */
function RedactaAviso({ prueba, probando, onProbar, onUsar, onCerrar, deshabilitado }: {
  prueba: string | null; probando: boolean; onProbar: (contexto?: string) => void;
  onUsar: (texto: string, modo: 'reemplazar' | 'agregar') => void; onCerrar: () => void; deshabilitado?: boolean;
}) {
  const [pedido, setPedido] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** La propuesta que había al pedir: lo que llega después es lo nuevo. `undefined` = todavía no se pidió. */
  const [antes, setAntes] = useState<string | null | undefined>(undefined);
  const pidio = antes !== undefined;
  const nueva = pidio && !probando && prueba && prueba !== antes ? prueba : null;
  const escribir = () => {
    if (probando || !pedido.trim()) return;
    setError(null);
    setAntes(prueba);
    onProbar(pedido);
  };
  const btn: CSSProperties = { height: 32, padding: '0 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
  return (
    <div data-mako-redacta style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: SANS, padding: 12, borderRadius: 14, border: '1px solid var(--mako-border)', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--mako-ink)' }}>✦ MaKo</span>
        <button type="button" onClick={onCerrar} aria-label="Cerrar MaKo" title="Cerrar"
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 15, padding: 0 }}>✕</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <textarea value={pedido} onChange={(e) => setPedido(e.target.value)} rows={3} disabled={deshabilitado || probando}
          placeholder="¿Qué quieres que diga?" aria-label="Qué quieres que diga el mensaje"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); escribir(); } }}
          style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '10px 12px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, lineHeight: 1.45, outline: 'none', resize: 'none' }} />
        <BotonDictar titulo="Dictar" valor={pedido} onValor={setPedido} onError={setError} />
      </div>
      <div>
        <button type="button" onClick={escribir} disabled={deshabilitado || probando || !pedido.trim()}
          style={{ ...btn, height: 36, padding: '0 16px', fontSize: 13.5, border: '1px solid var(--mako-border)', background: 'var(--mako-bg)', color: 'var(--mako-ink)', opacity: pedido.trim() ? 1 : 0.55 }}>
          {probando ? <><Spinner size={12} /> {GRAMATICA.analizando.rotulo}…</> : nueva ? 'Escribir otro' : 'Escribir'}
        </button>
      </div>
      {error && <div role="alert" style={{ fontSize: 12.5, color: 'var(--bad)' }}>{error}</div>}
      {nueva && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--mako-ink)' }}>✦ {GRAMATICA.recomienda.rotulo}</div>
          <BurbujaHilo saliente={false} autor="MaKo" contenido={{ texto: nueva }} maxAncho="92%" />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button type="button" style={btn} disabled={deshabilitado} onClick={() => onUsar(nueva, 'agregar')}>Agregar</button>
            <button type="button" style={{ ...btn, border: 'none', background: 'var(--wa)', color: '#fff' }} disabled={deshabilitado} onClick={() => onUsar(nueva, 'reemplazar')}>Usar</button>
          </div>
        </div>
      )}
      {pidio && !probando && !nueva && <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>No llegó nada. Prueba de nuevo.</div>}
    </div>
  );
}

/**
 * EL EMAIL DE UN MENSAJE, CON LA CARA DE REDACTAR EN GMAIL: «Mensaje nuevo», el asunto y el cuerpo, en
 * una ventana como la del editor del email de una automatización (`EditorEmailGmail`). El asunto se
 * guarda al SALIR del campo (son 160 caracteres y escribir en la base a mitad de una palabra deja «Tu
 * reporte de la sem» en la bandeja de alguien); su placeholder es el título, que es lo que va si queda
 * vacío. El cuerpo es el texto del mensaje (ver `EditorDelAviso`), con el «{ }» de lo que este aviso
 * puede resolver.
 */
function EditorEmailAviso({ nodo, asunto, titulo, texto, asuntoEditable, textoEditable, onAsunto, onAsuntoGuardar, onTexto, conWhatsApp, datos }: {
  nodo: NodoFlujo; asunto: string; titulo: string; texto: string; asuntoEditable: boolean; textoEditable: boolean;
  onAsunto: (v: string) => void; onAsuntoGuardar: () => void; onTexto: (v: string) => void; conWhatsApp: boolean;
  datos: ReturnType<typeof variablesOfrecidas>;
}) {
  const cuerpo = useRef<HTMLTextAreaElement>(null);
  const [btnDatos, setBtnDatos] = useState<HTMLButtonElement | null>(null);
  const [datosAbiertos, setDatosAbiertos] = useState(false);
  const fila: CSSProperties = { flex: 'none', display: 'flex', alignItems: 'center', gap: 8, minHeight: 34, padding: '0 12px', borderBottom: '1px solid var(--border)', fontSize: 13 };
  const insertar = (k: string) => {
    const el = cuerpo.current;
    const r = insertarEnCursor(texto, el?.selectionStart, el?.selectionEnd, `{{${k}}}`);
    onTexto(r.valor);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(r.cursor, r.cursor); });
  };
  return (
    <>
      <section aria-label="Mensaje nuevo" style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)', fontFamily: SANS }}>
        <div style={{ flex: 'none', padding: '8px 12px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Mensaje nuevo</div>
        <div style={fila}>
          <input value={asunto} disabled={!asuntoEditable} aria-label="Asunto"
            onChange={(e) => onAsunto(e.target.value)} onBlur={onAsuntoGuardar}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAsuntoGuardar(); } }}
            // El título como placeholder: es lo que se usa si esto queda vacío, y verlo
            // acá es la diferencia entre «no puse nada» y «puse esto».
            placeholder={titulo || 'Asunto'} maxLength={160}
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, padding: '7px 0' }} />
        </div>
        {textoEditable ? (
          <textarea ref={cuerpo} value={texto} onChange={(e) => onTexto(e.target.value)} rows={8} aria-label="Cuerpo del email"
            placeholder="Escribe el mensaje"
            style={{ border: 'none', outline: 'none', resize: 'vertical', padding: '10px 12px', background: 'transparent', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, lineHeight: 1.5, minHeight: 140 }} />
        ) : (
          <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}><TextoMarcas texto={texto} /></div>
        )}
        {textoEditable && datos.length > 0 && (
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 2, padding: '4px 6px', borderTop: '1px solid var(--border)' }}>
            <button type="button" ref={setBtnDatos} onClick={() => setDatosAbiertos((v) => !v)} aria-expanded={datosAbiertos}
              title="Insertar un dato" aria-label="Insertar un dato"
              style={{ height: 28, minWidth: 28, padding: '0 7px', border: 'none', borderRadius: 7, background: datosAbiertos ? 'var(--primary-bg)' : 'transparent', color: datosAbiertos ? 'var(--primary)' : 'var(--dim)', cursor: 'pointer', fontFamily: "'Geist Mono', monospace", fontSize: 12.5, fontWeight: 600 }}>{'{ }'}</button>
          </div>
        )}
      </section>
      {conWhatsApp && <p style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, margin: '8px 0 0' }}>Mismo texto que MaKo en WhatsApp.</p>}
      {!textoEditable && <p style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, margin: '8px 0 0' }}>Lo redacta MaKo con lo que pasa cada vez: esto es un ejemplo.</p>}
      {nodo.advertencia && (
        <p style={{ fontSize: 11.5, color: 'var(--warn)', lineHeight: 1.45, marginTop: 8, marginBottom: 0 }}>{nodo.advertencia}</p>
      )}
      {datosAbiertos && (
        <PopoverWA ancla={btnDatos} etiqueta="Datos" onCerrar={() => setDatosAbiertos(false)}>
          <ArbolDeDatos grupos={datos} onElegir={(k) => { insertar(k); setDatosAbiertos(false); }} />
        </PopoverWA>
      )}
    </>
  );
}
