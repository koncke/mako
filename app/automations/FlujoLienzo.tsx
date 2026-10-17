'use client';

// =============================================================================
// FlujoLienzo — una automatización del chatbot, dibujada como FLUJO CON RAMAS
// =============================================================================
// El pedido, textual: «Quiero que los editables del flujo de conversacion sea
// como el editable de Manychat, que tiene una pantalla tipo flujo, y ahi se edita
// todo», con la captura del Flow Builder al lado. Y el 08/10/2026, doce puntos más; los
// de esta pieza:
//   · 4  «En el CRON sigue diciendo "Se dispara" como título» → la tarjeta dice CRON y
//        su detalle es el disparador REAL (`detalleDisparador`).
//   · 5  «Pon mucho menos títulos dentro del editable, todo debe entenderse por su propia
//        cuenta» → ningún editor lleva rótulos de sección: cada uno es una FRASE con
//        valores elegibles, el molde de ManyChat («Wait [15] [Minutes] and then continue»).
//   · 6  «Solo a leads recientes» y «Sale sola» se van de la tarjeta CRON: el primero es
//        una fila de una Condición («Llegó hace menos de [72] h»), el segundo es de cada
//        mensaje («Revisar antes de enviar», en el editor del mensaje).
//   · 7  ningún mensaje nace con espera; la espera es su propia tarjeta, editable y
//        borrable.
//   · 9  condiciones con ramas, creadas desde el punto de cada salida.
//   · 11 «Termina si agenda» se va: es una Condición como cualquier otra.
//
// Acá vive lo PROPIO de una secuencia: qué muestra cada tarjeta y qué se edita al
// tocarla. El gesto, el encuadre, las curvas, los puntos de las salidas y el panel son de
// app/_components/Lienzo.tsx, que también dibuja el flujo de un aviso. El árbol (qué
// tarjeta va dónde) es de lib/flujo-conversacion.ts, y el modelo (qué es una rama, qué es
// válido) de lib/flujo-grafo.ts.
//
// ⚠️ ESTE ARCHIVO NO GUARDA NADA. Cada cambio es local y sube por `onPasos` a
// SecuenciaPerfil, que es dueño del estado, de la pila de deshacer y de «Publicar»
// (sólo Publicar publica). Una edición que escribiera por su cuenta sería un segundo
// camino a la base que no pasa por `validarGrafo`.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Dropdown, type DropdownOption } from '../components/Dropdown';
import {
  Lienzo, TarjetaNodo, IconoNodo, IconoAcomodar, inpLienzo, campoGrande, botonGrande, type ItemMenuLienzo,
} from '@/app/_components/Lienzo';
// La papelera de la casa, roja siempre (sexta tanda, general 9): la del menú de una tarjeta.
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { Icon } from '@/app/_components/icons';
import { Toast, useToast } from '@/app/_ui';
import { conectar, desconectar, eliminar, soltar, crearSuelta, duplicar, partirConEspera, type Edicion } from '@/lib/flujo-edicion';
import { insertarDesdeLienzo } from '@/lib/flujo-conversacion';
// El editor del paso «⚡ Acción» es UNO para los dos lienzos (este y el de /mensajes).
import { EditorAccionMako, useTitulosAcciones, type ValorAccion } from '@/app/_components/EditorAccionMako';
import {
  EditorMensajeWhatsApp, CabeceraWhatsApp, CabeceraMakoEnWhatsApp, horaDeAhora,
  type EditorMensajeWhatsAppProps,
} from './EditorMensajeWhatsApp';
// La tarjeta «MaKo en WhatsApp» POR PARTES (undécima tanda): su editor es el de WhatsApp sobre ESTE DTO.
import {
  pasoDeMako, paramsDeMako, chipDeEspera, esperaQueAbra, FUERAS_DE_HORARIO, ROTULO_FUERA_DE_HORARIO, CANALES_MAKO, ROTULO_CANAL_MAKO,
  TOPE_ASUNTO_MAKO, esPorEmail, asuntoDeMako, sinGrupoDeMako, SINES_GRUPO, ROTULO_SIN_GRUPO,
  type CambioDeMako, type CanalMako, type FueraDeHorario, type SinGrupo,
} from '@/lib/mako-tarjeta';
import { useHorarioOficina } from './horario-oficina';
// El contexto de los datos de una tarjeta: el MISMO con que Publicar los valida.
import { contextoDeTarjeta } from '@/lib/tokens-del-flujo';
import { EditorEmailGmail, type EditorEmailGmailProps } from './EditorEmailGmail';
import type { HistorialRedacta } from './MakoRedacta';
import { NuevoPlaceholder } from './NuevoPlaceholder';
import { EditorEtiqueta } from './EditorEtiqueta';
// El editor de la CONDICIÓN (tercera tanda, puntos 9 y 10): una frase por fila, del catálogo por
// secciones filtrado por el CRON. Vive aparte; este archivo sólo lo monta.
import { EditorCondicion, EditorCondicionDeRespuesta, useCatalogosCondicion, catalogosDe } from './EditorCondicion';
// El AI STEP (novena tanda): su cuerpo en la tarjeta y su editor viven aparte; este archivo los monta.
import { CuerpoPasoIA, EditorPasoIA, type CambioPasoIA } from './EditorPasoIA';
import { respuestaAPasoIA } from '@/lib/paso-ia-convertir';
import { quitarIrA } from '@/lib/flujo-legado';
import { ambitoDeDisparo, nombresCatalogoDe } from '@/lib/condiciones-catalogo';
import { LEAD_DEL_EVENTO } from '@/lib/api-mako/flujo-params';
import { BurbujaHilo } from '@/app/whatsapp/_shared/BurbujaHilo';
import { Ticks } from '@/app/whatsapp/_shared/Ticks';
import { IconDoc } from '@/app/whatsapp/_shared/composer-icons';
import { esPasoAccion } from '@/lib/nutricion-paso-accion';
import { proveedorDelPaso } from '@/lib/nutricion-canal';
import { TRIGGER_RECORDATORIO, DATOS_RECORDATORIO } from '@/lib/recordatorio-automatizacion';
import { aplicarVariables } from '@/lib/template-vars';
import { datosOfrecidos, type ContextoDatos } from '@/lib/variables-aviso';
import type { AdjuntoDto } from '@/lib/setting-adjuntos-reglas';
import {
  claseDe, idDe, indicePorId, borrarNodo, condicionARespuesta, raizRespuesta, esPasoIA, TOPE_CASOS, OPCIONES_SI_AGENDA_CERCA, textoSiAgendaCerca,
  type Espera, type NombresParaTexto,
} from '@/lib/flujo-grafo';
import {
  grafoDeSecuencia, opcionesDelMas, opcionesSueltas, nombreDeTarjeta, agregarRama, quitarRama, agregarCaso, quitarCaso, cambiarNodo,
  revisarHeredado, cambioApila, nombreEtiqueta, vistaDeArchivo, etiquetaDeAccion, esMako, errorLegible,
  ID_ENTRADA, tarjetasIncompletas, PARTES_EN_TARJETA, RENGLONES_CON_DOS, SEP_BURBUJAS_TARJETA, ALTO_MAS_PARTES, ALTO_PALOMITAS,
  MARCO_MAIL, RENGLON_ASUNTO, RENGLON_PREHEADER, RENGLON_CUERPO_MAIL, SEP_MAIL, RENGLONES_EMAIL, RENGLON_MAS_PARTES, altoDeMensaje,
  MARCO_DISPARO, RENGLON_DISPARO, SEP_DISPARO, ALTO_NUEVO_DISPARO, burbujasDeTarjeta,
  type NodoFlujo, type QueAgregar, type DisparadorTarjeta, type AristaFlujo,
} from '@/lib/flujo-conversacion';
import { editorDeTarjeta, Y_ENTRADA, type Muelles } from '@/lib/lienzo-grafo';
import {
  UNIDADES_ESPERA, SEGUNDOS_DE, rotuloUnidad, segundosDeMinutos, minutosDeSegundos, unidadMostrada,
  type UnidadEspera,
} from '@/lib/espera-duracion';
import { etiquetasDelPaso, paramsConEtiquetas } from '@/lib/editor-acciones';
import { ALTO_PRINCIPAL } from '@/app/components/dropdown-reglas';
import type { NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { conPosiciones, moverRelativo, fijarPosicion, congelarPosiciones, fijarVarias, type Posiciones } from '@/lib/lienzo-posiciones';
import { leerCopia, copiaDeTarjetas, pegarTarjetas, referenciasDe, textoDeCopia, tokenDeTexto, type PasoCopiado } from '@/lib/flujo-copia';
import type { AudioSetting, PasoSecuenciaDto, ProductoOpcion } from './ChatAgentApp';
// Instagram y Messenger (sexta tanda, parte «canales»): su tarjeta y su editor viven aparte.
import { esCanalSocial } from '@/lib/canal-social';
import { VistaMensajeSocial } from './VistaMensajeSocial';
import { EditorMensajeSocial, CabeceraSocialPanel } from './EditorMensajeSocial';
// El ícono de cada CRON de la tarjeta (sexta tanda, CRON 10): el de su clase, como en el panel.
import { IconoDisparador } from './IconosDisparador';
import { EVENTOS_MAKO, TRIGGER_AVISO_MAKO, type ClaseDisparador, type SubtipoMako } from '@/lib/disparadores';
import { condicionesDelEvento, datosDeLaPersona } from '@/lib/aviso-evento';
// El chip «Sin conectar» de una tarjeta (décima tanda, GENERAL 6) y el modal que conecta ahí mismo.
import { ConectarMedio, useEstadoMedios } from './ConectarMedio';
import { chipDeTarjeta, lineaDePaso, mediosQueUsa, MOTIVO_MEDIO, type Medio } from '@/lib/medios-automatizacion';

const SANS = "'Geist', sans-serif";

/** Una etiqueta del CRM (GET /api/crm/etiquetas). */
export type EtiquetaLienzo = { id: number; nombre: string; color?: string | null; archivada_at?: string | null };
/** Las etapas de UN producto, para la fila «Está en la etapa». */
export type SeccionEtapas = { title: string; funnelId: number; options: Array<{ value: string; label: string }> };

/** Un cambio del flujo. Va como FUNCIÓN del estado anterior: dos cambios en el mismo
 *  tick (el composer manda el texto y la IA juntos) se componen en vez de pisarse. */
export type CambioPasos = (fn: (prev: PasoSecuenciaDto[]) => PasoSecuenciaDto[], apilar: boolean) => void;

/** Lo que MaKo necesita para escribir el guion de una nota de voz: lo de la ESTRATEGIA. */
export type ParaGuion = EditorMensajeWhatsAppProps['paraGuion'];

/**
 * La biblioteca de archivos, leída una vez para las tarjetas. «No pude leer» es un tercer
 * estado y no una lista vacía: con una lista vacía la tarjeta afirmaría que el archivo ya no
 * está (AGENTS.md, «No pude leer» es un tercer estado).
 */
type Biblioteca = { estado: 'ok'; lista: AdjuntoDto[] } | { estado: 'error' } | null;

export function FlujoLienzo({
  pasos, disparador, secuencias, audios, negocio, rolAdmin, busy, envioAutoSecuencia,
  etiquetas, etapas, paraGuion, foco, pendientesOtraCosa,
  onPasos, onAgregar, onBorrar, onAudioNuevo, onError, onModoIA,
  chrome, herramientas, pie, editorEntrada, insetIzq, insetDer, muelles, revelar,
  onTarjetaAbierta, reservaAbajo, triggerTipo, eventoMako, productos, posiciones, onPosiciones, linea,
  disparadores, onNuevoDisparador, onAbrirDisparador, accionesTodo, secuenciaId,
}: {
  /**
   * LA AUTOMATIZACIÓN que se edita (AI Step v2, décima tanda): el ensayo de un AI Step deja contestar a MaKo con
   * la estrategia de ESTA automatización (`responderSimulador`). Sin esto, el ensayo es sólo «Respondes tú».
   */
  secuenciaId?: number;
  /**
   * EL CLICK DERECHO EN LA TARJETA CRON (10/10/2026, general 11: «Si le doy click derecho al cron, no me
   * salen las opciones en desplegable, debería... si es "Eliminar" es "Eliminar todo" o "Duplicar
   * todo". Y claro, ahora falta la opción de copiar»): lo de la AUTOMATIZACIÓN ENTERA, que hace la lista
   * (SimuladorWhatsApp: el mismo «⋯» de la fila). Sin esto, el CRON no tiene menú.
   */
  accionesTodo?: { copiar: () => void; duplicar: () => void; eliminar: () => void };
  /**
   * LOS DISPARADORES DE LA TARJETA CRON (sexta tanda, CRON 10: «copiá la tarjeta de CRON de ManyChat…
   * agrega la opción de tener más de un CRON»), uno por cajita. Los arma la parte de los disparadores
   * desde SecuenciaPerfil. Sin esto, la tarjeta dibuja el disparador de siempre (`disparador`).
   */
  disparadores?: DisparadorTarjeta[];
  /** «＋ Nuevo CRON», abajo de las cajitas. Sin esto, no se dibuja. Abre también el editor del CRON. */
  onNuevoDisparador?: () => void;
  /** Tocar la cajita de un disparador: abre el editor del CRON en ese disparador. */
  onAbrirDisparador?: (id: string) => void;
  /**
   * EL NÚMERO DE SALIDA de la automatización y su guardado (cuarta tanda, punto 15): el mismo del
   * selector del CRON, en el editor de cada mensaje de WhatsApp. Sin esto, la fila no se dibuja.
   */
  linea?: EditorMensajeWhatsAppProps['linea'];
  /**
   * DÓNDE QUEDÓ CADA TARJETA QUE LA PERSONA MOVIÓ (quinta tanda, punto 2; mig 0233): desplazamientos
   * desde el CRON derivado (lib/lienzo-posiciones.ts). Lo demás va donde lo pone el árbol. Las guarda
   * quien monta, por SU acción: este archivo sigue sin guardar nada.
   */
  posiciones?: Posiciones;
  /** Soltar una tarjeta: el mapa entero, ya podado. Sin esto las tarjetas no se agarran (sólo se panea). */
  onPosiciones?: (p: Posiciones) => void;
  /** El flujo, normalizado (ids y `siguiente` explícitos). */
  pasos: PasoSecuenciaDto[];
  /** Lo que dice la tarjeta CRON: el disparador real (`detalleDisparador`). */
  disparador: string;
  /** Las OTRAS automatizaciones del workspace: a dónde puede ir un «Ir a». */
  secuencias: ReadonlyArray<{ id: number; nombre: string }>;
  audios: AudioSetting[];
  negocio: string;
  rolAdmin: boolean;
  busy: boolean;
  /** Lo que la secuencia dice de sus mensajes (`envio_automatico`): un mensaje sin
   *  `revisar` propio hace eso. */
  envioAutoSecuencia: boolean;
  etiquetas: EtiquetaLienzo[];
  /** «+ Nueva» en el selector de etiqueta. Devuelve la creada, o null si no se pudo. */
  etapas: SeccionEtapas[];
  /**
   * El objetivo, el gancho y las preguntas de la estrategia, para «✦ guion» de una nota de voz
   * (revisión, costuras-4: sin esto el guion salía sin el contexto de la secuencia, y un mensaje
   * sin texto ni siquiera ofrecía el botón).
   */
  paraGuion?: ParaGuion;
  /**
   * La tarjeta que hay que ABRIR, la pide quien publica cuando un error la frena (revisión,
   * lienzo-6). `vez` cambia en cada pedido: el mismo error dos veces la vuelve a abrir.
   * `id: null` CIERRA la que esté abierta (el ✦ del título, duodécima tanda: `abrirMako`).
   */
  foco?: { id: string | null; vez: number } | null;
  /** Cuántas respuestas de esta automatización esperan a una persona (ver `grafoDeSecuencia`). */
  pendientesOtraCosa?: number;
  onPasos: CambioPasos;
  /** El ＋ de una salida (o del medio de una flecha). Devuelve el id de la tarjeta nueva. */
  onAgregar?: (nodo: string, puerto: string | undefined, que: QueAgregar) => string | null;
  /** La papelera de la cabecera del panel. */
  onBorrar?: (id: string) => void;
  // (`onCrearRespuesta`, el ＋ de la fila «Si responde» del CRON, se fue con la fila en la segunda pasada
  // de la sexta tanda: «Si responde» nace de una CONDITION vacía, `onPasarARespuesta` en su editor.)
  onAudioNuevo: (a: AudioSetting) => void;
  onError: (m: string) => void;
  /** Se prendió (o apagó) «MaKo lo adapta» en un mensaje: la primera vez abre la guía de voz. */
  onModoIA?: (on: boolean) => void;
  /** El título, el interruptor y «Probar»: FLOTAN sobre el lienzo, arriba. */
  chrome?: ReactNode;
  /** Pegado al zoom, abajo a la izquierda: deshacer y rehacer. */
  herramientas?: ReactNode;
  /** Abajo a la derecha: «Publicar». */
  pie?: ReactNode;
  /** El editor de la tarjeta CRON. Viene de afuera porque su estado (el disparador, el
   *  horario, la línea) vive en quien monta el lienzo, igual que la pila de deshacer. */
  editorEntrada?: ReactNode;
  /** Cuánto se corre lo que flota a la izquierda (la lista de secuencias) y a la derecha
   *  (el panel de «Probar»). No angostan el dibujo — ver `Lienzo.insetIzq`. */
  insetIzq?: number;
  insetDer?: number;
  /**
   * DÓNDE VA CADA COSA QUE FLOTA (`muelles`, lib/lienzo-grafo.ts): la lista, «Probar» y el editor.
   * Con esto el editor es APAISADO (la franja de abajo, alto fijo) y los insets salen de una sola
   * cuenta; sin esto, lo de siempre (`insetIzq`/`insetDer` y el panel de columna).
   */
  muelles?: Muelles | null;
  /** Las tarjetas aparecen de a una («Crear con IA»). Ver `Lienzo.revelar`. */
  revelar?: { orden: string[]; clave: number } | null;
  /**
   * Avisa si hay una tarjeta ABIERTA (su panel a la vista). Lo usa quien monta para esconder lo que
   * flota en la franja de abajo —la caja y la barra de «Crear con IA»—, que si no queda encima del
   * panel y le tapa los botones (revisión de la segunda tanda, 09/10/2026). La selección vive acá
   * adentro, así que sin este aviso nadie de afuera sabe que se abrió una.
   */
  onTarjetaAbierta?: (abierta: boolean) => void;
  /** Lo que el encuadre deja libre abajo (la caja de «Crear con IA»). Ver `Lienzo.reservaAbajo`. */
  reservaAbajo?: number;
  /**
   * El disparador de la automatización y los productos con sus etapas (tercera tanda). Los necesita el
   * editor de la CONDICIÓN de la parte A (`EditorCondicion`: `ambito` sale de `ambitoDeDisparo(triggerTipo)`
   * y `productos` es lo que ofrece): viajan hasta `PropsEditor` para que la integración sólo cambie el
   * componente. Opcionales: sin ellos, lo de siempre.
   */
  triggerTipo?: string;
  /**
   * EL EVENTO DE MaKo de una fila de «MaKo en WhatsApp» (11/10/2026: su CRON es `aviso_mako` y esto es
   * cuál, `disparadores[0].subtipo`). Con él, el «{ }» de la tarjeta MaKo ofrece lo que ESE evento trae
   * (`datosDelEvento`, lib/aviso-evento.ts: «Lo que arma MaKo», los datos de la cuota). null/ausente = una
   * automatización de las de siempre.
   */
  eventoMako?: SubtipoMako | null;
  productos?: ProductoOpcion[];
}) {
  const [sel, setSel] = useState<string | null>(null);
  /** Las tarjetas elegidas con el LAZO (general 3). Se copian, se eliminan y se pegan juntas. */
  const [varios, setVarios] = useState<string[]>([]);
  /**
   * LOS MEDIOS SIN CONECTAR (décima tanda, GENERAL 6: «en la tarjeta lo debe decir»). Una lectura de los
   * medios que usa el flujo (`useEstadoMedios`, la misma de «Probar»), y la tarjeta que sale por uno sin
   * conectar lleva el chip «Sin conectar» (`chipDeTarjeta`). Tocarlo abre el modal ahí mismo (`ConectarMedio`).
   */
  const usaMedios = useMemo(() => mediosQueUsa(pasos), [pasos]);
  const medios = useEstadoMedios(usaMedios);
  const [conectarMedio, setConectarMedio] = useState<{ medio: Medio; linea: string | null } | null>(null);
  // El horario de oficina (15/10/2026): para el chip «Espera a que abra (mañana 9:00)» de la tarjeta «MaKo en WhatsApp».
  const oficina = useHorarioOficina();
  // ⛔ EL QR YA NO SALTA AL CREAR (decimoquinta tanda, 12/10/2026, punto 4). La duodécima (§2.12) abría este modal
  // solo, una vez por visita y por medio, al crear una tarjeta de un medio sin conectar (`pedirConectar` +
  // `medioAConectarAlCrear`). Martín, textual: «Si creo una tarjeta de lo que sea y no lo tengo conectado, que en
  // ningún momento de la edición del flujo se me interrumpa saltando el desplegable de conectar X cosa... Solo cuando
  // le intente a dar publicar, probar o manualmente me vaya a conectarlo». Acá lo abre SÓLO el chip «Sin conectar» de
  // la tarjeta (un toque de la persona); Publicar, Probar y Activar lo abren desde SecuenciaPerfil.
  /**
   * LAS TARJETAS QUE YA SE ABRIERON Y SE CERRARON (10/10/2026, condición 4: «Si cierro una condición, como
   * cualquier cosa, sin completar, debe remarcarse con rojo para identificar donde falta»). Una recién
   * creada no se pinta de rojo mientras se la está llenando: recién al cerrarla, si le falta algo.
   */
  const [cerradas, setCerradas] = useState<ReadonlySet<string>>(() => new Set());
  const selAntes = useRef<string | null>(null);
  useEffect(() => {
    const antes = selAntes.current;
    selAntes.current = sel;
    if (antes && antes !== sel) setCerradas((c) => (c.has(antes) ? c : new Set([...c, antes])));
  }, [sel]);
  const incompletas = useMemo(() => (cerradas.size ? tarjetasIncompletas(pasos) : new Set<string>()), [cerradas, pasos]);
  // El foco que pide Publicar se aplica UNA vez por pedido (ajuste de estado en el render,
  // no un efecto: la tarjeta se abre en el mismo pintado que el error).
  const [focoVisto, setFocoVisto] = useState(0);
  if (foco && foco.vez !== focoVisto) { setFocoVisto(foco.vez); setSel(foco.id); }
  const titulos = useTitulosAcciones(pasos.some(esPasoAccion));
  const nombreEtapa = (key: string, funnelId: number | null) =>
    etapas.filter((s) => funnelId == null || s.funnelId === funnelId).flatMap((s) => s.options).find((o) => o.value === key)?.label ?? null;
  const editable = rolAdmin && !!onAgregar;

  /**
   * LA BIBLIOTECA DE ARCHIVOS, para que la tarjeta de un archivo diga CUÁL es (revisión,
   * costuras-6). Hasta el 08/10 la tarjeta le pasaba a la burbuja un archivo con `url: null` y
   * todas decían «(no disponible)», o «document (no disponible)» sin caption: afirmaban que un
   * PDF bien subido estaba roto. Se pide sólo si hay un archivo y quien mira es admin (la ruta
   * es de admin), y la misma lista le llega al editor, así no se pide dos veces.
   */
  const hayArchivos = pasos.some((p) => p.tipo === 'media');
  const [biblioteca, setBiblioteca] = useState<Biblioteca>(null);
  useEffect(() => {
    if (!rolAdmin || !hayArchivos || biblioteca) return;
    let vivo = true;
    fetch('/api/chat-agent/adjuntos', { cache: 'no-store', signal: AbortSignal.timeout(30_000) })
      .then((r) => r.json())
      .then((j: { ok?: boolean; adjuntos?: AdjuntoDto[] }) => {
        if (vivo) setBiblioteca(j?.ok && Array.isArray(j.adjuntos) ? { estado: 'ok', lista: j.adjuntos } : { estado: 'error' });
      })
      .catch(() => { if (vivo) setBiblioteca({ estado: 'error' }); });
    return () => { vivo = false; };
  }, [rolAdmin, hayArchivos, biblioteca]);
  const archivoNuevo = (a: AdjuntoDto) => setBiblioteca((b) => (b?.estado === 'ok' ? { estado: 'ok', lista: [a, ...b.lista.filter((x) => x.id !== a.id)] } : b));

  // CON CUÁNTA ANTICIPACIÓN SE PUEDE AGENDAR HOY (16/10/2026, `avisoAgendaCerca`): la ⚠ de una espera «antes de la
  // reunión» que no llega a salir. Se pide sólo si hay una de esas esperas y quien mira es admin (la ruta es de admin).
  // `undefined` = sin pedir; `null` = no se sabe (sin Calendly, o no se pudo leer): no se avisa nada.
  const hayAntes = pasos.some((p) => claseDe(p) === 'esperar' && p.espera?.modo === 'antes_reunion');
  const [anticipacion, setAnticipacion] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    if (!rolAdmin || !hayAntes || anticipacion !== undefined) return;
    let vivo = true;
    fetch('/api/flujos/anticipacion', { cache: 'no-store', signal: AbortSignal.timeout(30_000) })
      .then((r) => r.json())
      .then((j: { ok?: boolean; minutos?: number | null }) => { if (vivo) setAnticipacion(j?.ok && typeof j.minutos === 'number' ? j.minutos : null); })
      .catch(() => { if (vivo) setAnticipacion(null); });
    return () => { vivo = false; };
  }, [rolAdmin, hayAntes, anticipacion]);

  // Los catálogos de las condiciones (cursos, clases, posts, campañas), para que la tarjeta diga el
  // nombre de lo elegido («Completó la clase «Bienvenida»» y no «una clase»). Se piden sólo si hay una
  // condición y quien mira es admin (la ruta es de admin): un setter ve el texto genérico.
  const remotosCond = useCatalogosCondicion(rolAdmin && pasos.some((p) => claseDe(p) === 'condicion'));
  // Los nombres de las etiquetas, las etapas y lo del catálogo: los mismos para la tarjeta y para el «Ir a».
  const nombres: NombresParaTexto = {
    etiqueta: (id) => nombreEtiqueta(etiquetas, id), etapa: nombreEtapa,
    catalogo: nombresCatalogoDe(catalogosDe({ etapas, productos: productos ?? [], remotos: remotosCond })),
  };
  const conNuevoDisparador = editable && !!onNuevoDisparador;
  const opcionesGrafo: Parameters<typeof grafoDeSecuencia>[1] = {
    disparador, secuencias, tituloAccion: (op) => titulos?.get(op),
    nombres, colorEtiqueta: (id) => etiquetas.find((t) => t.id === id)?.color ?? null,
    audioDe: (id) => audios.find((a) => a.id === id) ?? null,
    pendientesOtraCosa, anticipacionMin: anticipacion ?? null,
    // El alto de la tarjeta CRON es fijo y se suma por cajita (`altoCron`): tiene que saber cuántas son.
    disparadores, nuevoDisparador: conNuevoDisparador,
  };
  const derivado = grafoDeSecuencia(pasos, opcionesGrafo);
  // Lo movido, sobre el árbol. `moverRelativo` mide contra el DERIVADO: mover el CRON no arrastra al resto.
  const grafo = conPosiciones(derivado, posiciones, ID_ENTRADA);
  const pasoDe = (id: string) => pasos.find((p, i) => idDe(p, i) === id) ?? null;

  // ── LO QUE EL MOUSE LE HACE AL FLUJO (sexta tanda): todo por lib/flujo-edicion.ts y `onPasos` ──
  // Cada edición se calcula sobre el flujo de AHORA y, si no se puede, el motivo va al aviso de al lado
  // de «Publicar» (`onError`, pasado por `errorLegible`: la red de `conectar` puede traer ids). Sube
  // con foto (deshacible) y nada se guarda hasta Publicar: este archivo sigue sin guardar nada.
  const { toast, show: avisar, clear: limpiarAviso } = useToast(6000);
  /**
   * LO QUE SE VE SE QUEDA DONDE ESTÁ al sacar una flecha o una tarjeta (10/10/2026, general 9: «Si elimino
   * una flecha, no se deben mover las tarjetas»): las que el árbol nuevo correría quedan fijas donde están
   * (`congelarPosiciones`). Crear sí acomoda: ahí no se llama.
   */
  const congelar = (nuevos: readonly PasoSecuenciaDto[]) => {
    if (!onPosiciones) return;
    onPosiciones(congelarPosiciones(grafo, grafoDeSecuencia(nuevos, opcionesGrafo), posiciones, ID_ENTRADA));
  };
  const aplicar = (r: Edicion<PasoSecuenciaDto>, quieto = false): boolean => {
    if (!r.ok) { onError(errorLegible(r.motivo, pasos)); return false; }
    if (quieto) congelar(r.pasos);
    onPasos(() => r.pasos, true);
    // Lo que se hizo bien borra el motivo de lo que no se pudo (si no, quedaba en rojo hasta Publicar).
    onError('');
    return true;
  };
  /** Una tarjeta nueva PUESTA en un punto (la suelta del click derecho, la copia de «Duplicar»). */
  const ponerEn = (id: string, x: number, y: number) => {
    onPosiciones?.(fijarPosicion(derivado, posiciones, id, Math.round(x), Math.round(y), ID_ENTRADA));
  };
  const crearSueltaEn = (que: QueAgregar, punto: { x: number; y: number }) => {
    // Sólo lo que el menú ofrece ahora: un AI Step pasado el tope del medio, o con un «Si responde» de los de
    // siempre, no (`puedeSumarAIStep`; `crearSuelta` devuelve el flujo igual con el id vacío).
    if (!opcionesSueltas(pasos).some((o) => o.value === que)) return;
    const r = crearSuelta(pasos, que);
    onPasos(() => r.pasos, true);
    ponerEn(r.id, punto.x, punto.y);
    setSel(r.id);
  };
  const duplicarTarjeta = (id: string) => {
    const r = duplicar(pasos, id);
    if (!aplicar(r) || !r.ok || !r.id) return;
    // La copia, debajo de la original (suelta: se conecta después).
    const o = grafo.nodos.find((x) => x.id === id);
    if (o) ponerEn(r.id, o.x, o.y + o.alto + 28);
    setSel(r.id);
  };
  /**
   * ELIMINAR UNA TARJETA: lo de después queda suelto (`eliminar`, por `onBorrar`). La espera que va EN
   * UNA FLECHA es la excepción: es parte de la flecha, así que se saca de la cadena y la flecha queda
   * (`borrarNodo` reconecta a su padre con lo de después).
   */
  const borrarTarjeta = (id: string) => {
    if (grafo.nodos.find((x) => x.id === id)?.enFlecha) { onPasos((prev) => borrarNodo(prev, id), true); return; }
    const r = eliminar(pasos, id);
    if (r.ok) congelar(r.pasos);
    onBorrar?.(id);
  };
  /**
   * LA PAPELERA DE UNA FLECHA (punto 6): la de después queda SUELTA. Si la flecha lleva esperas encima
   * (sus pastillas), en el dato llega a la PRIMERA espera, y las esperas se van con la flecha: eran de ella.
   */
  const quitarFlecha = (a: AristaFlujo) => {
    const r = desconectar(pasos, a.desde, a.puerto ?? 'sig', a.esperas?.[0]?.id ?? a.hasta);
    if (!r.ok) { onError(errorLegible(r.motivo, pasos)); return; }
    let out = r.pasos;
    for (const e of a.esperas ?? []) { const x = eliminar(out, e.id); if (x.ok) out = x.pasos; }
    congelar(out);
    onPasos(() => out, true);
    if (sel && (a.esperas ?? []).some((e) => e.id === sel)) setSel(null);
  };
  /**
   * LA PUNTA DE UNA FLECHA, LLEVADA A OTRA TARJETA (general 13): se saca la flecha y se pone la nueva
   * desde la MISMA salida. Si la nueva no se puede (un círculo, dos caminos que se juntan), no se toca
   * nada: el motivo va al aviso, como con cualquier conexión.
   */
  const desdeDe = (a: AristaFlujo) => (a.esperas?.length ? { desde: a.esperas[a.esperas.length - 1].id, puerto: 'sig' } : { desde: a.desde, puerto: a.puerto ?? 'sig' });
  const reconectar = (a: AristaFlujo, hacia: string) => {
    const o = desdeDe(a);
    const r1 = desconectar(pasos, o.desde, o.puerto, a.hasta);
    if (!r1.ok) { onError(errorLegible(r1.motivo, pasos)); return; }
    aplicar(conectar(r1.pasos, o.desde, o.puerto, hacia));
  };
  /** Y soltada en el vacío: una tarjeta NUEVA desde esa salida, donde se soltó (general 13 y 14). */
  const reconectarANueva = (a: AristaFlujo, que: string, punto: { x: number; y: number }) => {
    const o = desdeDe(a);
    const r1 = desconectar(pasos, o.desde, o.puerto, a.hasta);
    if (!r1.ok) { onError(errorLegible(r1.motivo, pasos)); return; }
    const r2 = insertarDesdeLienzo(r1.pasos, o.desde, o.puerto, que as QueAgregar);
    if (!r2.id) return;
    onPasos(() => r2.pasos, true);
    ponerEn(r2.id, punto.x, punto.y - Y_ENTRADA);
    setSel(r2.id);
  };
  /**
   * COPIAR (Ctrl+C, el click derecho): las tarjetas, con sus flechas ENTRE ellas, dónde estaba cada una
   * (relativo a la esquina de lo copiado) y el guion de cada audio. lib/flujo-copia.ts.
   */
  const textoCopiado = (ids: readonly string[]): string | null => {
    const nodos = grafo.nodos.filter((n) => ids.includes(n.id) && !n.enFlecha && n.id !== ID_ENTRADA);
    if (!nodos.length) return null;
    const x0 = Math.min(...nodos.map((n) => n.x)), y0 = Math.min(...nodos.map((n) => n.y));
    const lugares: Posiciones = {};
    for (const n of nodos) lugares[n.id] = { x: n.x - x0, y: n.y - y0 };
    const guiones: Record<string, string> = {};
    for (const au of audios) if (au.transcript?.trim()) guiones[String(au.id)] = au.transcript;
    const c = copiaDeTarjetas(pasos as unknown as PasoCopiado[], [...ids, ...grafo.nodos.filter((n) => n.enFlecha).map((n) => n.id).filter((e) => ids.includes(e))], { guiones, lugares });
    return c ? textoDeCopia(c) : null;
  };
  const copiarTarjetas = async (ids: readonly string[]) => {
    const t = textoCopiado(ids);
    if (!t) return;
    try { await navigator.clipboard.writeText(t); avisar(ids.length === 1 ? 'Tarjeta copiada' : `${ids.length} tarjetas copiadas`); } catch { onError('No se pudo copiar'); }
  };
  /**
   * PEGAR (Ctrl+V): las tarjetas copiadas —de este flujo, de otro o de otro negocio— entran SUELTAS, con
   * ids nuevos, alrededor de donde está el cursor, y quedan elegidas. Lo que no existe en este negocio lo
   * saca el server (`limpiar_copia`: decisión de Martín, «Pegar y marcar en rojo»).
   * DECIMOQUINTA TANDA (punto 8): un TOKEN de «Copiar flujo» también se pega acá. La copia la tiene el server: la misma
   * `limpiar_copia` la devuelve (`copia`) junto con sus tarjetas limpias.
   */
  const pegarTexto = async (texto: string, punto: { x: number; y: number }) => {
    let copia = leerCopia(texto);
    const token = copia ? null : tokenDeTexto(texto);
    if ((!copia && !token) || !editable) return;
    let entrantes = copia?.pasos ?? [];
    if (token || referenciasDe(entrantes)) {
      try {
        const r = await fetch('/api/chat-agent/secuencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'limpiar_copia', copia: token ?? texto }), signal: AbortSignal.timeout(30_000) });
        const j = await r.json().catch(() => null) as { ok?: boolean; pasos?: PasoCopiado[]; copia?: unknown; error?: string } | null;
        if (!j?.ok || !Array.isArray(j.pasos)) { onError(j?.error ?? 'No se pudo pegar'); return; }
        if (!copia) copia = leerCopia(JSON.stringify(j.copia ?? null));
        if (!copia) { onError('No se pudo pegar'); return; }
        entrantes = j.pasos;
      } catch { onError('No se pudo pegar'); return; }
    }
    if (!copia) return;
    const r = pegarTarjetas(pasos, { ...copia, pasos: entrantes });
    if (!r.ids.length) return;
    // Dónde va cada una: lo que traía la copia de tarjetas, o el dibujo del flujo copiado (uno entero).
    let lugares = copia.lugares;
    if (!lugares) {
      const g = conPosiciones(grafoDeSecuencia(entrantes as unknown as PasoSecuenciaDto[], opcionesGrafo), copia.posiciones ?? null, ID_ENTRADA);
      const nodos = g.nodos.filter((n) => !n.enFlecha && n.id !== ID_ENTRADA);
      const x0 = Math.min(...nodos.map((n) => n.x)), y0 = Math.min(...nodos.map((n) => n.y));
      lugares = {};
      for (const n of nodos) lugares[n.id] = { x: n.x - x0, y: n.y - y0 };
    }
    const nuevas: Posiciones = {};
    let k = 0;
    for (const [viejo, nuevo] of r.mapa) {
      const l = lugares[viejo] ?? { x: 0, y: (k++) * 40 };
      nuevas[nuevo] = { x: Math.round(punto.x + l.x), y: Math.round(punto.y + l.y) };
    }
    onPasos(() => r.pasos as PasoSecuenciaDto[], true);
    onPosiciones?.(fijarVarias(derivado, posiciones, nuevas, ID_ENTRADA));
    setSel(null);
    setVarios(r.ids);
    avisar(r.ids.length === 1 ? 'Tarjeta pegada' : `${r.ids.length} tarjetas pegadas`);
  };
  /** Eliminar lo elegido con el lazo: cada una queda fuera y lo de después, suelto (como una sola). */
  const eliminarVarias = (ids: readonly string[]) => {
    let out = pasos;
    for (const id of ids) { if (id === ID_ENTRADA) continue; const r = eliminar(out, id); if (r.ok) out = r.pasos; }
    if (out === pasos) return;
    congelar(out);
    onPasos(() => out, true);
    setVarios([]); setSel(null);
  };
  /** «ACOMODAR» (punto 14): vuelve al árbol (borra lo movido), con su deshacer en el aviso. */
  const hayPosiciones = !!posiciones && Object.keys(posiciones).length > 0;
  const acomodar = () => {
    if (!onPosiciones || !posiciones || !hayPosiciones) return;
    const antes = posiciones;
    onPosiciones({});
    avisar('Acomodado', () => onPosiciones(antes));
  };
  const iconoMenu = (src?: string) => (src ? <img src={src} alt="" width={18} height={18} style={{ display: 'block' }} /> : undefined);
  /**
   * EL CLICK DERECHO EN EL FONDO (punto 2): crear cada tipo de tarjeta EN ese punto. ⛔ Sin «Publicar» ni «Acomodar»
   * (decimoquinta tanda, punto 5: «Elimina las opciones de "Publicar, acomodar y centrar" en el desplegable cuando le
   * doy click derecho»): Publicar está abajo a la derecha y Acomodar al lado del deshacer.
   */
  const menuLienzo = editable ? (punto: { x: number; y: number }): ItemMenuLienzo[] => opcionesSueltas(pasos).map((o) => ({
    id: `crear-${o.value}`, label: o.label, grupo: o.grupo, icono: iconoMenu(o.icono),
    onElegir: () => crearSueltaEn(o.value as QueAgregar, punto),
  })) : undefined;
  /** EL CLICK DERECHO EN UNA TARJETA (punto 2): duplicar, desconectar (le saca lo que le llega) y eliminar. */
  const menuNodo = editable ? (id: string): ItemMenuLienzo[] => {
    // Con el LAZO: lo que se hace es con TODAS las elegidas.
    // El CRON puede entrar en el lazo, pero no se copia ni se borra como tarjeta: no cuenta.
    const tarjetasElegidas = varios.filter((x) => x !== ID_ENTRADA);
    if (tarjetasElegidas.length > 1 && varios.includes(id) && id !== ID_ENTRADA) {
      const n = tarjetasElegidas.length;
      return [
        { id: 'copiar-varias', label: `Copiar ${n} tarjetas`, icono: <Icon name="copy" size={16} />, onElegir: () => void copiarTarjetas(tarjetasElegidas) },
        { id: 'eliminar-varias', label: `Eliminar ${n} tarjetas`, grupo: 1, peligro: true, icono: <IconoBorrar size={16} />, onElegir: () => eliminarVarias(tarjetasElegidas) },
      ];
    }
    if (id === ID_ENTRADA) {
      if (!accionesTodo) return [];
      return [
        { id: 'copiar-todo', label: 'Copiar todo', icono: <Icon name="copy" size={16} />, onElegir: accionesTodo.copiar },
        { id: 'duplicar-todo', label: 'Duplicar todo', icono: <Icon name="copy" size={16} />, onElegir: accionesTodo.duplicar },
        { id: 'eliminar-todo', label: 'Eliminar todo', grupo: 1, peligro: true, icono: <IconoBorrar size={16} />, onElegir: accionesTodo.eliminar },
      ];
    }
    const paso = pasoDe(id);
    if (!paso) return [];
    const nodo = grafo.nodos.find((x) => x.id === id);
    // ⚠️ LA FLECHA DEL CRON A «SI RESPONDE» NO CUENTA (séptima tanda): es dibujo, no dato (`sinMas`), y
    // «Desconectar» sobre la que escucha no tiene nada que soltar (`soltar` contestaría que no le llega nada).
    // Desde el 10/10/2026 la de «Si responde» SÍ cuenta (`quitable`): desconectarla la deja suelta.
    const leLlega = grafo.aristas.some((a) => a.hasta === id && !(a.sinMas && !a.quitable) && !(a.esperas?.length && nodo?.enFlecha));
    return [
      ...(claseDe(paso) !== 'respuesta' ? [{ id: 'duplicar', label: 'Duplicar', icono: <Icon name="copy" size={16} />, onElegir: () => duplicarTarjeta(id) }] : []),
      { id: 'copiar', label: 'Copiar', icono: <Icon name="copy" size={16} />, onElegir: () => void copiarTarjetas([id]) },
      ...(leLlega && !nodo?.enFlecha ? [{ id: 'desconectar', label: 'Desconectar', icono: <Icon name="tijera" size={16} />, onElegir: () => aplicar(soltar(pasos, id), true) }] : []),
      { id: 'eliminar', label: 'Eliminar', grupo: 1, peligro: true, icono: <IconoBorrar size={16} />, onElegir: () => { if (sel === id) setSel(null); borrarTarjeta(id); } },
    ];
  } : undefined;
  /** El botón «Acomodar», pegado al deshacer (donde estaba el ✦ de MaKo, punto 14). */
  const conAcomodar = editable && onPosiciones ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {herramientas}
      <button type="button" onClick={acomodar} disabled={!hayPosiciones} title="Acomodar" aria-label="Acomodar las tarjetas"
        style={{
          width: 26, height: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
          color: hayPosiciones ? 'var(--dim)' : 'var(--faint)', cursor: hayPosiciones ? 'pointer' : 'default', opacity: hayPosiciones ? 1 : 0.45,
        }}><IconoAcomodar /></button>
    </span>
  ) : herramientas;
  /**
   * ¿HAY UNA TARJETA ABIERTA? Se CALCULA del dato, igual que el Lienzo decide si dibuja el panel
   * (una selección que apunta a una tarjeta borrada no abre nada), y se avisa ANTES de pintar
   * (layout effect): con un efecto común, la barra de «Crear con IA» se vería un cuadro encima del
   * panel recién abierto.
   */
  const abierta = sel != null && grafo.nodos.some((n) => n.id === sel);
  const avisarAbierta = useRef(onTarjetaAbierta);
  useLayoutEffect(() => { avisarAbierta.current = onTarjetaAbierta; });
  useLayoutEffect(() => { avisarAbierta.current?.(abierta); }, [abierta]);
  /**
   * LA FORMA DEL EDITOR: el panel mediano de abajo (`apaisado`, tercera tanda: hasta 720 × ~420,
   * pegado a la lista) cuando `muelles` dice que entra; si no (o sin `muelles`), de columna como
   * siempre. El editor de WhatsApp va SIEMPRE en una columna (decisión 1): partido en dos se leía roto.
   */
  const formaPanel: 'apaisado' | 'columna' = muelles?.editorForma === 'apaisado' ? 'apaisado' : 'columna';
  /**
   * EL TAMAÑO DEL PANEL, POR TIPO DE TARJETA (cuarta tanda, punto 1: «tanto espacio en blanco y un
   * desplegable chico arriba del todo»). Un mensaje, el editor grande de `muelles` (punto 16); lo
   * demás, el alto de su tipo y 600 de ancho (`editorDeTarjeta`, lib/lienzo-grafo.ts, con test). Sale
   * del TIPO de la tarjeta abierta, nunca del contenido: elegir una acción con más campos no mueve el
   * panel, que scrollea adentro.
   */
  const talla = editorDeTarjeta(muelles, sel != null ? grafo.nodos.find((n) => n.id === sel)?.tipo : null);

  return (
    <>
    <Lienzo
      grafo={grafo} seleccion={sel} onSeleccion={setSel}
      onMover={onPosiciones ? (id, x, y) => onPosiciones(moverRelativo(derivado, posiciones, id, x, y, ID_ENTRADA)) : undefined}
      sinMarco alto="100%" panelAncho={talla.ancho}
      insetIzq={muelles ? muelles.insets.izq : insetIzq} insetDer={muelles ? muelles.insets.der : insetDer}
      insetDerChrome={muelles?.insets.derChrome} insetDerAbajo={muelles?.insets.derAbajo}
      panelForma={formaPanel} panelAlto={talla.alto}
      revelar={revelar} reservaAbajo={reservaAbajo}
      chrome={chrome} herramientas={conAcomodar} accion={pie}
      /* ⚠️ EL ＋ ES EL DE CADA SALIDA (y el del medio de cada flecha), y la tarjeta nueva se
         abre sola: casi todas nacen con algo que elegir (la acción, la condición).

         ⚠️ SEXTA TANDA, PUNTO 5: el ＋ del círculo asoma una flecha y el menú va en su PUNTA
         (`punto`). Si la tarjeta de origen está MOVIDA (tiene posición guardada), la nueva nace ahí,
         en la punta: el árbol la pondría al lado de donde estaba antes la de origen, lejos de ella. */
      onAgregarTras={editable ? ((id, que, puerto, punto, enElPunto) => {
        const nuevo = onAgregar!(id, puerto, que as QueAgregar);
        if (nuevo) setSel(nuevo);
        // Soltada la flecha en el vacío (general 14), la tarjeta nace DONDE se soltó.
        if (nuevo && punto && (enElPunto || posiciones?.[id])) ponerEn(nuevo, punto.x, punto.y - Y_ENTRADA);
      }) : undefined}
      varios={varios} onVarios={editable ? setVarios : undefined} onEliminarVarios={editable ? eliminarVarias : undefined}
      onReconectar={editable ? reconectar : undefined}
      onReconectarANueva={editable ? reconectarANueva : undefined}
      onCopiar={editable ? textoCopiado : undefined}
      onPegar={editable ? (t, p) => { void pegarTexto(t, p); } : undefined}
      opcionesEn={(nodo, puerto, medio) => opcionesDelMas(pasos, nodo, medio, puerto)}
      onBorrar={rolAdmin && onBorrar ? borrarTarjeta : undefined}
      puedeBorrar={(id) => id !== ID_ENTRADA}
      onConectar={editable ? (desde, puerto, hacia) => { aplicar(conectar(pasos, desde, puerto, hacia)); } : undefined}
      onQuitarFlecha={editable ? quitarFlecha : undefined}
      menuLienzo={menuLienzo} menuNodo={menuNodo}
      nombreNodo={(id) => nombreDeTarjeta(pasos, id, nombres)}
      renderNodo={(n, activo) => {
        const paso = pasoDe(n.id);
        // La espera es una píldora de UNA línea: su texto va suelto (TarjetaNodo lo envuelve).
        if (n.tipo === 'espera') return <TarjetaNodo key={n.id} nodo={n} activo={activo}>{n.detalle}</TarjetaNodo>;
        // LA TARJETA CRON (sexta tanda, CRON 10): «⚡ CRON», una cajita por disparador y «＋ Nuevo CRON».
        if (n.id === ID_ENTRADA) {
          return (
            <TarjetaNodo key={n.id} nodo={n} activo={activo}>
              <CuerpoCron
                disparadores={disparadores?.length ? disparadores : [{ id: '', texto: n.detalle ?? disparador }]}
                onAbrir={disparadores?.length && onAbrirDisparador ? (did) => { setSel(ID_ENTRADA); onAbrirDisparador(did); } : undefined}
                onNuevo={conNuevoDisparador ? () => { setSel(ID_ENTRADA); onNuevoDisparador!(); } : undefined}
              />
            </TarjetaNodo>
          );
        }
        const chip = paso ? chipDeTarjeta(paso, medios, linea?.actual ?? null) : null;
        // «MaKo en WhatsApp» que AHORA esperaría a que abra la oficina: lo dice, con cuándo (`chipDeEspera`).
        const espera = paso && esMako(paso) && oficina?.horario
          ? chipDeEspera(paso.accion?.params as Record<string, unknown> | undefined, oficina.horario, oficina.zona, Date.now())
          : null;
        return (
          <>
          <TarjetaNodo key={n.id} nodo={n} activo={activo} roto={(n.tipo === 'ir-a' && Boolean(n.advertencia)) || (cerradas.has(n.id) && incompletas.has(n.id))}>
            {/* EL AI STEP (novena tanda): sus casos adentro, una fila cada uno, y «Otra cosa» al pie. */}
            {n.tipo === 'paso-ia' && paso
              ? <CuerpoPasoIA paso={paso} pendientes={n.detalle} advertencia={!!n.advertencia} />
              : n.tipo === 'mensaje' && paso && esCanalSocial(paso.canal)
              ? <VistaMensajeSocial paso={paso} canal={paso.canal} negocio={negocio} adjuntos={biblioteca?.estado === 'ok' ? biblioteca.lista : null} />
              : n.tipo === 'mensaje' && paso
              ? <VistaMensaje paso={paso} audios={audios} negocio={negocio} biblioteca={biblioteca} />
              : n.detalle
                ? <div style={{
                  fontSize: 12.5, fontWeight: n.tipo === 'accion' || n.tipo === 'etiqueta' ? 600 : 400,
                  color: n.advertencia ? 'var(--faint)' : 'var(--ink)', lineHeight: 1.45,
                  // Las de control son de UNA línea (su alto es fijo y compacto): lo que no entra, «…».
                  ...(n.familia === 'control' ? { whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' } : {}),
                  // La tarjeta MAKO: hasta tres renglones del mensaje (`ALTO_MAKO`).
                  ...(n.tipo === 'mako' ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', overflowWrap: 'anywhere' as const } : {}),
                }}>{n.detalle}</div>
                : null}
          </TarjetaNodo>
          {espera && <ChipEspera nodo={n} texto={espera} />}
          {chip && (
            <ChipMedio nodo={n} texto={chip.texto} frena={chip.frena} motivo={MOTIVO_MEDIO[chip.medio]}
              onConectar={!chip.informa && rolAdmin && paso ? () => setConectarMedio({ medio: chip.medio, linea: chip.medio === 'whatsapp' ? lineaDePaso(paso, linea?.actual ?? null) : null }) : undefined} />
          )}
          </>
        );
      }}
      renderEditor={(n) => (
        <EditorDeNodo
          nodo={n} paso={pasoDe(n.id)} pasos={pasos} secuencias={secuencias}
          audios={audios} negocio={negocio} rolAdmin={rolAdmin} busy={busy} envioAutoSecuencia={envioAutoSecuencia}
          etiquetas={etiquetas} etapas={etapas} triggerTipo={triggerTipo} eventoMako={eventoMako} productos={productos}
          nombres={nombres} paraGuion={paraGuion} adjuntos={biblioteca?.estado === 'ok' ? biblioteca.lista : undefined} onAdjuntoNuevo={archivoNuevo}
          onPasos={onPasos} onAudioNuevo={onAudioNuevo} onError={onError} onModoIA={onModoIA}
          editorEntrada={editorEntrada} formaPanel={formaPanel} linea={linea}
          disparador={disparador} secuenciaId={secuenciaId ?? null}
          onAbrir={(id) => setSel(id)}
        />
      )}
      // LA CABECERA DEL PANEL DE UN WHATSAPP (sexta tanda, WhatsApp 2 y 3): el logo, el NÚMERO de ese
      // mensaje en lugar de la palabra «WhatsApp» y el ✦ de MaKo al lado (`CabeceraWhatsApp`). La de una
      // tarjeta MAKO dice «MaKo en WhatsApp» (MaKo en WhatsApp 1), con su ✦ desde la undécima tanda (la MISMA
      // clave que su editor: `pasoDeMako` conserva el id y el orden). Las demás, la de siempre del lienzo
      // (`tituloEditor` ausente). Se decide con la tarjeta ABIERTA: el lienzo sólo pinta una cabecera.
      tituloEditor={cabeceraDe(sel ? pasoDe(sel) : null, rolAdmin) ? (n) => {
        const paso = pasoDe(n.id);
        if (paso && esMako(paso)) return <CabeceraMakoEnWhatsApp paso={pasoDeMako(paso)} deshabilitado={busy} />;
        if (!paso) return null;
        // INSTAGRAM Y MESSENGER (decimocuarta tanda, puntos 5 a 8): el logo, la CUENTA de ese mensaje en lugar de la palabra
        // «Instagram» (con «Conectar otra» adentro) y el ✦ al lado, como un WhatsApp. La `key` por tarjeta: siembra estado.
        if (esCanalSocial(paso.canal)) {
          return (
            <CabeceraSocialPanel key={`cab-social-${n.id}`} paso={paso} canal={paso.canal} deshabilitado={busy}
              onCuenta={(c) => onPasos((prev) => cambiarNodo(prev, n.id, { cuenta_zernio: c }), true)} />
          );
        }
        // `linea` es un campo del paso (`PasoSecuenciaDto`): sin cast.
        return (
          <CabeceraWhatsApp paso={paso} lineaAutomatizacion={linea?.actual ?? null} deshabilitado={busy}
            conMako={permiteIADe(paso, !!onModoIA)}
            onLinea={(l) => onPasos((prev) => cambiarNodo(prev, n.id, { linea: l }), true)} />
        );
      } : undefined}
    />
    {/* El aviso de «Acomodado», con su deshacer (las posiciones no viven en la pila de los pasos). */}
    <Toast state={toast} onClose={limpiarAviso} />
    {/* CONECTAR AHÍ MISMO (GENERAL 6), desde el chip de una tarjeta. Al conectar, el chip se apaga solo
        (`avisarMedioConectado` vacía la lectura). */}
    {conectarMedio && rolAdmin && (
      <ConectarMedio medio={conectarMedio.medio} linea={conectarMedio.linea}
        onCerrar={() => setConectarMedio(null)} onConectado={() => setConectarMedio(null)} />
    )}
    </>
  );
}

/**
 * EL CHIP «SIN CONECTAR» DE UNA TARJETA (décima tanda, GENERAL 6: «en la tarjeta lo debe decir»). Cuelga de la
 * esquina de arriba a la derecha, SOBRE el borde, como una insignia: la tarjeta tiene alto fijo y adentro no
 * hay lugar que no se corte. Va en el mismo envoltorio que la tarjeta (lo que devuelve `renderNodo`), así que
 * se mueve con ella al arrastrarla.
 *
 * Rojo si se SABE sin conectar (Publicar y Activar lo frenan); ámbar si no se pudo comprobar (avisa y no frena).
 * Con `onConectar` (un admin) es un botón con `data-no-pan`: el lienzo no arma un gesto y el clic le llega.
 */
export function ChipMedio({ nodo, texto, frena, motivo, onConectar }: {
  nodo: { x: number; y: number; ancho: number }; texto: string; frena: boolean; motivo: string; onConectar?: () => void;
}) {
  const color = frena ? 'var(--bad)' : 'var(--warn)';
  const estilo: CSSProperties = {
    position: 'absolute', left: nodo.x + nodo.ancho - 10, top: nodo.y - 9, transform: 'translateX(-100%)', zIndex: 2,
    display: 'inline-flex', alignItems: 'center', height: 19, padding: '0 8px', boxSizing: 'border-box', borderRadius: 999,
    border: `1px solid ${color}`, background: 'var(--surface)', color, fontFamily: SANS, fontSize: 10.5, fontWeight: 700,
    whiteSpace: 'nowrap', lineHeight: 1,
  };
  if (!onConectar) return <span data-chip-medio title={frena ? motivo : texto} style={estilo}>{texto}</span>;
  return (
    <button type="button" data-chip-medio data-no-pan title={frena ? motivo : texto}
      onClick={(e) => { e.stopPropagation(); onConectar(); }} style={{ ...estilo, cursor: 'pointer' }}>{texto}</button>
  );
}

/**
 * EL CHIP DE «MaKo en WhatsApp» QUE ESPERA A QUE ABRA (15/10/2026): arriba a la IZQUIERDA de la tarjeta, para no pisar
 * el de «Sin conectar» (a la derecha), y afuera del cuerpo, que tiene su alto medido. Neutro: no es un error.
 */
export function ChipEspera({ nodo, texto }: { nodo: { x: number; y: number }; texto: string }) {
  return (
    <span data-chip-espera title="Fuera del horario de oficina sale cuando abre. Se cambia en la tarjeta." style={{
      position: 'absolute', left: nodo.x + 10, top: nodo.y - 9, zIndex: 2,
      display: 'inline-flex', alignItems: 'center', height: 19, padding: '0 8px', boxSizing: 'border-box', borderRadius: 999,
      border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS,
      fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1,
    }}>{texto}</span>
  );
}

/**
 * EL CUERPO DE LA TARJETA CRON (sexta tanda, CRON 10, copiando la de ManyChat: «Me gusta que se vea la
 * opción de Cron que seleccioné y abajo también "+Nuevo CRON"»): una cajita gris por disparador, con su
 * ícono y su texto, y abajo el «＋ Nuevo CRON» punteado (el placeholder de la casa). La salida al pie
 * («Entonces ●») la dibuja la tarjeta.
 *
 * ⚠️ LOS NÚMEROS SON LOS DE `altoCron` (lib/flujo-conversacion.ts: `MARCO_DISPARO`, `RENGLON_DISPARO`,
 * `SEP_DISPARO`, `ALTO_NUEVO_DISPARO`): la tarjeta tiene alto fijo y se estima antes de pintar.
 *
 * Las cajitas y el «＋» son botones con `data-no-pan`: el lienzo no arma un gesto con ellos, así que su
 * clic les llega (sin la marca, el lienzo lo tomaba como un clic en la tarjeta). Sin `onAbrir` la
 * cajita es texto y tocarla abre la tarjeta, como siempre.
 */
export function CuerpoCron({ disparadores, onAbrir, onNuevo }: {
  disparadores: DisparadorTarjeta[]; onAbrir?: (id: string) => void; onNuevo?: () => void;
}) {
  const caja: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, width: '100%', boxSizing: 'border-box', textAlign: 'left',
    padding: `${(MARCO_DISPARO - 2) / 2}px 9px`, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)',
    fontFamily: SANS, fontSize: 12.5, lineHeight: `${RENGLON_DISPARO}px`, color: 'var(--ink)', fontWeight: 600,
  };
  const texto: CSSProperties = { minWidth: 0, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SEP_DISPARO }}>
      {disparadores.map((d) => {
        // El ícono de CADA CRON es el de su clase (`iconoDeDisparador`, lib/disparadores.ts): el mismo
        // dibujo que su botón gigante en el panel (`IconoDisparador`). Otra cosa (un emoji, una marca),
        // como el ícono de una tarjeta.
        const cuerpo = (
          <>
            {d.icono && (
              <span style={{ flex: 'none', display: 'inline-flex' }}>
                {esClaseDeIcono(d.icono) ? <IconoDisparador tipo={d.icono} tam={16} /> : <IconoNodo icono={d.icono} tam={14} />}
              </span>
            )}
            <span style={texto}>{d.texto}</span>
          </>
        );
        return onAbrir && d.id
          ? <button key={d.id} type="button" data-no-pan data-disparador={d.id} onClick={() => onAbrir(d.id)} title={d.texto} style={{ ...caja, cursor: 'pointer' }}>{cuerpo}</button>
          : <div key={d.id || 'unico'} title={d.texto} style={caja}>{cuerpo}</div>;
      })}
      {/* Con la animación de «＋ Nueva automatización» (10/10/2026, CRON 1): `NuevoPlaceholder`. */}
      {onNuevo && <NuevoPlaceholder chico texto="Nuevo CRON" onClick={onNuevo} data-no-pan data-nuevo-disparador style={{ height: ALTO_NUEVO_DISPARO }} />}
    </div>
  );
}

/** Las claves que da `iconoDeDisparador` (lib/disparadores.ts): las dibuja `IconoDisparador`. */
// `mako` («Evento de MaKo», 11/10/2026) dibuja el rayo, como `otro`: `IconoDisparador` cae ahí para lo que no tiene dibujo propio.
const CLASES_ICONO_CRON: ReadonlySet<string> = new Set<ClaseDisparador | 'otro'>(['producto', 'recurrente', 'etiqueta', 'instagram', 'messenger', 'email', 'pagos', 'mako', 'otro']);
const esClaseDeIcono = (s: string): s is ClaseDisparador | 'otro' => CLASES_ICONO_CRON.has(s);

/**
 * ¿La tarjeta abierta lleva la cabecera propia? Un WhatsApp NO oficial (el número y el ✦) o una
 * tarjeta MAKO («MaKo en WhatsApp»), y sólo para quien edita. Las demás, la cabecera del lienzo.
 */
function cabeceraDe(paso: PasoSecuenciaDto | null, rolAdmin: boolean): boolean {
  if (!paso || !rolAdmin) return false;
  if (claseDe(paso) === 'accion') return esMako(paso);
  // Instagram y Messenger: su cuenta y el ✦ (decimocuarta tanda).
  if (claseDe(paso) === 'mensaje' && esCanalSocial(paso.canal)) return true;
  return claseDe(paso) === 'mensaje' && paso.canal === 'whatsapp' && proveedorDelPaso(paso) === 'no_oficial';
}

/**
 * ¿El editor de este mensaje ofrece «✦ MaKo»? Por el WhatsApp no oficial, con cualquier contenido (la
 * sexta tanda lo volvió el panel que ayuda a ESCRIBIR, y un audio también se escribe: MaKo propone el
 * guion). «Adaptarlo a cada persona» sigue siendo sólo de un texto, y eso lo decide el editor
 * (`adaptable`). Una función para el editor y la cabecera del panel.
 */
function permiteIADe(paso: PasoSecuenciaDto, hayModoIA: boolean): boolean {
  return hayModoIA && paso.canal === 'whatsapp' && proveedorDelPaso(paso) === 'no_oficial';
}

/**
 * El mensaje COMO LLEGA: la burbuja de WhatsApp del resto del producto (`BurbujaHilo`),
 * en su versión chica. Es la pieza que hace que esto sea un editor y no un diagrama.
 *
 * ⚠️ LAS VARIABLES SE RESUELVEN CON LA FUNCIÓN DEL MOTOR (`aplicarVariables`), no con un
 * `replace` propio. Hasta el 05/10 la tarjeta resolvía `{{negocio}}` a mano y el envío no
 * lo conocía: se veía perfecto acá y al lead le llegaban las llaves puestas. Con la misma
 * función, lo que esta vista resuelve es por construcción lo que el motor resuelve. Sólo
 * se le pasa el negocio: los datos del lead no se conocen acá, y quedan crudos, que es
 * como se ve que son variables.
 */
function VistaMensaje({ paso, audios, negocio, biblioteca }: { paso: PasoSecuenciaDto; audios: AudioSetting[]; negocio: string; biblioteca: Biblioteca }) {
  const n = negocio.trim();
  const texto = aplicarVariables(paso.cuerpo || '', n ? { negocio: n } : {});
  const a = paso.tipo === 'audio' ? audios.find((x) => x.id === paso.audio_id) ?? null : null;
  // La hora de las burbujas: la de cuando se abrió el lienzo, como en el editor (`horaDeAhora`).
  const [hora] = useState(horaDeAhora);
  if (paso.canal === 'email') return <VistaEmail paso={paso} texto={texto} negocio={n} />;
  // ⚠️ CADA MENSAJE EN SU BURBUJA (décima tanda, WhatsApp 1: «que cada mensaje sea un recuadro de fondo gris,
  // como si fueran mensajes diferentes, porque lo son. No que estén todo junto»): `burbujasDeTarjeta` parte
  // también el audio con su texto guardado como antes, que se dibujaba en una sola burbuja.
  const partes = burbujasDeTarjeta(paso as unknown as Parameters<typeof burbujasDeTarjeta>[0]);
  /**
   * ⚠️ COMO UN WHATSAPP (10/10/2026, WhatsApp 1: «los mensajes deben estar separados, como en el editable, y
   * que se vean como máximo 2 mensajes en la tarjeta del lienzo, para no romper diseño. Que se vea las
   * palomitas todo... Y si hay más mensajes un pequeño y sutil recuadro que diga "+3 mensajes..."»). Cada
   * burbuja con su hora y su ✓✓, hasta dos, y el recuadro de lo que queda. El alto lo mide `altoDeMensaje`
   * con las MISMAS piezas (`altoDeBurbuja`, `ALTO_MAS_PARTES`).
   */
  const pie = { hora, pie: <Ticks status="read" /> };
  if (partes && partes.length > 1) {
    const resto = partes.length - PARTES_EN_TARJETA;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: SEP_BURBUJAS_TARJETA }}>
        {partes.slice(0, PARTES_EN_TARJETA).map((pt, k) => {
          if (pt.tipo === 'audio') {
            const au = audios.find((x) => x.id === pt.audio_id) ?? null;
            return <BurbujaHilo key={k} compacta saliente autor={negocio} {...pie} contenido={{ audio: { url: au?.url ?? null, titulo: au?.titulo, transcript: null, duracion_s: au?.duracion_s ?? null } }} />;
          }
          if (pt.tipo === 'media') {
            const v = vistaDeArchivo(pt.media_id, biblioteca?.estado === 'ok' ? biblioteca.lista : biblioteca?.estado === 'error' ? 'error' : null);
            return <BurbujaHilo key={k} compacta saliente autor={negocio} {...pie} lineas={RENGLONES_CON_DOS}
              contenido={{ texto: aplicarVariables(pt.cuerpo ?? '', n ? { negocio: n } : {}), media: { url: v.modo === 'documento' ? v.url : null, mime: v.modo === 'documento' ? v.mime : '', nombre: v.nombre, tipo: 'document' } }} />;
          }
          return <BurbujaHilo key={k} compacta saliente autor={negocio} {...pie} lineas={RENGLONES_CON_DOS} contenido={{ texto: aplicarVariables(pt.cuerpo, n ? { negocio: n } : {}) }} />;
        })}
        {resto > 0 && (
          <div style={{ alignSelf: 'flex-end', height: ALTO_MAS_PARTES, boxSizing: 'border-box', padding: '0 9px', display: 'inline-flex', alignItems: 'center', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 11, color: 'var(--faint)' }}>
            {textoMasPartes(resto)}
          </div>
        )}
      </div>
    );
  }
  const vacio = paso.tipo === 'media' ? !paso.media_id : paso.tipo !== 'audio' && !texto.trim();
  if (vacio) return <span style={{ fontSize: 12, color: 'var(--faint)' }}>Sin escribir</span>;
  if (paso.tipo === 'media') return <VistaArchivo paso={paso} texto={texto} negocio={negocio} biblioteca={biblioteca} />;
  return (
    // Sin la transcripción del audio (punto 15: «que no se vea la transcripción»): el alto tampoco la
    // cuenta. Un texto largo TERMINA EN «…» adentro de la tarjeta (WhatsApp 12: «así no se rompe el
    // diseño»): los renglones salen del MISMO alto que estima el árbol.
    <BurbujaHilo compacta saliente autor={negocio} {...pie} lineas={renglonesDeTarjeta(paso, 0)} contenido={{
      texto,
      audio: paso.tipo === 'audio' ? { url: a?.url ?? null, titulo: a?.titulo, transcript: null, duracion_s: a?.duracion_s ?? null } : null,
      ia: paso.tipo === 'ia',
    }} />
  );
}

/** «+1 mensaje…», «+2 mensajes…»: lo que queda adentro de la tarjeta. Pura (test). */
export const textoMasPartes = (n: number): string => `+${n} ${n === 1 ? 'mensaje' : 'mensajes'}…`;

/**
 * CUÁNTOS RENGLONES DEL TEXTO ENTRAN EN LA TARJETA antes del «…». La tarjeta tiene alto FIJO (lleva
 * puertos) y lo estima `altoDeMensaje` antes de pintar; la burbuja cortaba a 5 renglones aunque el alto
 * estimado tuviera lugar para 3, y lo que no entraba se cortaba a la mitad de un renglón, sin «…». Se
 * calcula con el MISMO alto: el marco de la tarjeta (47), el de la burbuja (18), el aire (6) y el
 * renglón «+N» si lo hay, a 18,1 px por renglón (12,5 × 1,45). Entre 1 y 5.
 */
export function renglonesDeTarjeta(paso: PasoSecuenciaDto, mas: number): number {
  const alto = altoDeMensaje(paso as unknown as Parameters<typeof altoDeMensaje>[0]);
  // La fila de las palomitas (WhatsApp 1, 10/10/2026) lleva también el ✦ de «MaKo lo adapta».
  const libre = alto - 47 - 18 - 6 - ALTO_PALOMITAS - (mas > 0 ? 4 + RENGLON_MAS_PARTES : 0);
  return Math.max(1, Math.min(5, Math.floor(libre / 18.125)));
}

/**
 * EL EMAIL EN LA TARJETA, COMO UN MAIL (segunda tanda): la caja del correo con el asunto arriba
 * en negrita, la vista previa en gris y hasta tres renglones del cuerpo. Hasta el 08/10 se dibujaba
 * como una burbuja de WhatsApp con el asunto chiquito encima: se leía como un WhatsApp.
 *
 * ⚠️ LOS NÚMEROS SON LOS DE `altoDeMensaje` (lib/flujo-conversacion.ts: `MARCO_MAIL`,
 * `RENGLON_ASUNTO`, `RENGLON_PREHEADER`, `RENGLON_CUERPO_MAIL`, `RENGLONES_EMAIL`): la tarjeta
 * tiene alto FIJO y el alto se estima antes de pintar. Si cambia uno, cambian los dos.
 */
function VistaEmail({ paso, texto, negocio }: { paso: PasoSecuenciaDto; texto: string; negocio: string }) {
  const asunto = aplicarVariables((paso.asunto ?? '').trim(), negocio ? { negocio } : {});
  const pre = aplicarVariables((paso.preheader ?? '').trim(), negocio ? { negocio } : {});
  if (!asunto && !texto.trim()) return <span style={{ fontSize: 12, color: 'var(--faint)' }}>Sin escribir</span>;
  const linea: CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: `${(MARCO_MAIL - 2) / 2}px 9px`, background: 'var(--surface)' }}>
      <div style={{ ...linea, fontSize: 12.5, fontWeight: 700, lineHeight: `${RENGLON_ASUNTO}px`, color: asunto ? 'var(--ink)' : 'var(--faint)' }}>{asunto || 'Sin asunto'}</div>
      {pre && <div style={{ ...linea, fontSize: 11, lineHeight: `${RENGLON_PREHEADER}px`, color: 'var(--faint)' }}>{pre}</div>}
      {texto.trim() && (
        <div style={{
          marginTop: SEP_MAIL, fontSize: 12, lineHeight: `${RENGLON_CUERPO_MAIL}px`, color: 'var(--dim)', whiteSpace: 'pre-wrap',
          display: '-webkit-box', WebkitLineClamp: RENGLONES_EMAIL, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere',
        }}>{texto}</div>
      )}
    </div>
  );
}

/**
 * EL ARCHIVO EN LA TARJETA: su nombre y el caption, NUNCA «(no disponible)» sobre un archivo
 * que existe (revisión, costuras-6). Qué se dibuja lo decide `vistaDeArchivo`
 * (lib/flujo-conversacion.ts, con test): un documento con su nombre si la biblioteca lo tiene;
 * «Archivo» si no se pudo saber; «Un archivo que ya no está» si se leyó y no está.
 */
function VistaArchivo({ paso, texto, negocio, biblioteca }: { paso: PasoSecuenciaDto; texto: string; negocio: string; biblioteca: Biblioteca }) {
  const v = vistaDeArchivo(paso.media_id, biblioteca?.estado === 'ok' ? biblioteca.lista : biblioteca?.estado === 'error' ? 'error' : null);
  if (v.modo === 'documento') {
    return <BurbujaHilo compacta saliente autor={negocio} contenido={{ texto, media: { url: v.url, mime: v.mime, nombre: v.nombre, tipo: 'document' } }} />;
  }
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: texto.trim() ? 6 : 0, fontSize: 12, fontWeight: 600, color: v.falta ? 'var(--warn)' : 'var(--ink)', minWidth: 0 }}>
        <span style={{ flex: 'none', color: 'var(--dim)', display: 'inline-flex' }}><IconDoc size={16} /></span>
        <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.nombre}</span>
      </div>
      {texto.trim() && <BurbujaHilo compacta saliente autor={negocio} contenido={{ texto }} />}
    </>
  );
}

// ── El editor de la tarjeta tocada ──────────────────────────────────────────

type PropsEditor = {
  nodo: NodoFlujo; paso: PasoSecuenciaDto | null; pasos: PasoSecuenciaDto[];
  secuencias: ReadonlyArray<{ id: number; nombre: string }>;
  audios: AudioSetting[]; negocio: string; rolAdmin: boolean; busy: boolean; envioAutoSecuencia: boolean;
  etiquetas: EtiquetaLienzo[]; etapas: SeccionEtapas[];
  /** Para el editor de la condición de la parte A (ver FlujoLienzo). */
  triggerTipo?: string; productos?: ProductoOpcion[];
  /** El evento de una fila de «MaKo en WhatsApp» (ver FlujoLienzo): lo que ofrece el «{ }» de la tarjeta MaKo. */
  eventoMako?: SubtipoMako | null;
  nombres: NombresParaTexto;
  paraGuion?: ParaGuion;
  /** La biblioteca de archivos ya leída (undefined = el editor la pide solo). */
  adjuntos?: AdjuntoDto[]; onAdjuntoNuevo?: (a: AdjuntoDto) => void;
  onPasos: CambioPasos;
  onAudioNuevo: (a: AudioSetting) => void; onError: (m: string) => void; onModoIA?: (on: boolean) => void;
  /** Lo que se edita en la tarjeta CRON. Ver FlujoLienzo. */
  editorEntrada?: ReactNode;
  /** La forma del panel donde se dibuja este editor (apaisado = la franja de abajo, ancha y baja). */
  formaPanel: 'apaisado' | 'columna';
  onAbrir: (id: string) => void;
  /** La automatización (ver FlujoLienzo): el ensayo de un AI Step. */
  secuenciaId?: number | null;
  /** El número de salida de la automatización (ver FlujoLienzo). */
  linea?: EditorMensajeWhatsAppProps['linea'];
  /**
   * El disparador en palabras («Llega a «Agendado»»): el ✦ de MaKo del editor de WhatsApp lo lee como
   * contexto para escribir el mensaje (sexta tanda, WhatsApp 3). Es el de la tarjeta CRON.
   */
  disparador?: string;
};

/**
 * EL EDITOR DE LA TARJETA TOCADA: una rama por CLASE de tarjeta, y cada rama en su función.
 *
 * Los de la segunda tanda (docs/chatbot-flujo-ramas-diseno.md, «Los editores (parte E)»):
 *   · `EditorEmail`          → `EditorEmailGmail` (asunto, vista previa y cuerpo, tipo Gmail);
 *   · `EditorEtiquetaLienzo` → `EditorEtiqueta` (una frase: «[Poner ▾] [etiqueta ▾]»);
 *   · `EditorMensaje`        → `EditorMensajeWhatsApp` en dos columnas con el panel apaisado.
 */
function EditorDeNodo(pr: PropsEditor) {
  const { nodo, paso, rolAdmin } = pr;
  /**
   * EL ✦ DE CADA TARJETA ANOTA EN EL CHAT DE MaKo (decimotercera tanda, punto 7: «se tiene que ver que el usuario apretó
   * el botón en X tarjeta»): la automatización y la tarjeta nombrada como se lee en el lienzo (`nombreDeTarjeta`, la
   * misma que nombra los errores de Publicar). Sin automatización guardada, no se anota.
   */
  const chatDe = (id: string) => (pr.secuenciaId ? { secuenciaId: pr.secuenciaId, tarjeta: nombreDeTarjeta(pr.pasos, id) } : null);
  // ⚠️ UN SETTER NO EDITA, PERO TIENE QUE PODER LEER. Un mensaje no tiene `detalle` —su
  // contenido es el mensaje—, así que el panel salía en blanco justo en lo que más se abre.
  if (!rolAdmin) return <SoloLectura nodo={nodo} paso={paso} />;
  if (nodo.id === ID_ENTRADA) return <>{pr.editorEntrada ?? <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{nodo.detalle}</div>}</>;
  if (!paso) return null;
  const id = nodo.id;
  /** Un cambio de ESTA tarjeta. `apilar`: entra a la pila de deshacer (lo que no es tipear). */
  const cambiar = (patch: Partial<PasoSecuenciaDto>, apilar: boolean) => pr.onPasos((prev) => cambiarNodo(prev, id, patch), apilar);
  switch (claseDe(paso)) {
    case 'accion':
      // La etiqueta es una ⚡ Acción dibujada como lo que hace (decisión 8): tiene su propio editor.
      if (etiquetaDeAccion(paso)) return <EditorEtiquetaLienzo paso={paso} id={id} busy={pr.busy} cambiar={cambiar} />;
      // La tarjeta MAKO (tercera tanda, decisión 11): el aviso al grupo del negocio, con su editor.
      if (esMako(paso)) return <EditorMako key={`mako-${id}`} {...pr} paso={paso} id={id} chatMako={chatDe(id)} />;
      return <EditorAccion paso={paso} id={id} busy={pr.busy} cambiar={cambiar} />;
    // La `key` va por tarjeta: el editor recuerda la unidad elegida (`useState` sembrado de props).
    case 'esperar': return <EditorEspera key={`espera-${id}`} espera={paso.espera} busy={pr.busy} cambiar={cambiar} />;
    // La condición (parte A de la tercera tanda): el catálogo filtrado por el ámbito del CRON. Agregar
    // o quitar una rama crea un puerto o se lleva lo que colgaba de él: eso lo hace el lienzo.
    //
    // ⚠️ SEXTA TANDA, PUNTO 12 («Reply ya te dije que tiene que estar dentro de CONDITION»): una
    // condición VACÍA —ninguna fila elegida— ofrece «Su respuesta trata de», y elegirla la pasa a ser
    // la CONDITION que escucha (`condicionARespuesta`: el nodo «Si responde» de siempre, con su primer
    // caso y su «Si no» avisando al equipo). Una por automatización: si ya hay una, no se ofrece.
    case 'condicion': {
      const pasarARespuesta = (paso.ramas ?? []).every((r) => !r.filas?.length) && !raizRespuesta(pr.pasos)
        ? () => pr.onPasos((prev) => { const r = condicionARespuesta(prev, id); return 'error' in r ? prev : r.pasos; }, true)
        : undefined;
      return (
        <EditorCondicion key={`cond-${id}`} paso={paso} cambiar={cambiar}
          ambito={ambitoDeDisparo(pr.triggerTipo)} etapas={pr.etapas} productos={pr.productos ?? []} busy={pr.busy}
          onAgregarRama={() => pr.onPasos((prev) => agregarRama(prev, id), true)}
          onQuitarRama={(ramaId) => pr.onPasos((prev) => quitarRama(prev, id, ramaId), true)}
          onPasarARespuesta={pasarARespuesta}
          // Los DATOS DEL EVENTO (16/10/2026): en una fila de evento, lo que ese evento trae y se pregunta.
          datos={pr.eventoMako ? condicionesDelEvento(pr.eventoMako) : null} />
      );
    }
    case 'respuesta': {
      // EL AI STEP (novena tanda; una por objetivo desde la undécima): la misma clase, con su objetivo y sus
      // escenarios adentro, y su propio editor. Sus campos (`paso_ia`, el medio, el objetivo, los casos) van por
      // `cambiarNodo` sobre el DTO. «＋ Otro AI Step» se fue (undécima: UN AI Step por medio).
      if (esPasoIA(paso)) {
        const cambiarIA: CambioPasoIA = (patch, apilar) => pr.onPasos((prev) => cambiarNodo<PasoSecuenciaDto>(prev, id, patch), apilar);
        return <EditorPasoIA key={`ia-${id}`} id={id} paso={paso} pasos={pr.pasos} busy={pr.busy} cambiar={cambiarIA} secuenciaId={pr.secuenciaId ?? null} onError={pr.onError} />;
      }
      return <EditorRespuesta {...pr} paso={paso} id={id} cambiar={cambiar} />;
    }
    case 'ir_a': return <EditorIrA {...pr} paso={paso} id={id} cambiar={cambiar} />;
    default:
      // El ✦ de MaKo también en el email y en los DM (decimotercera tanda, punto 8): cada uno pide lo suyo (lib/mako-redacta.ts).
      if (paso.canal === 'email') {
        // En un evento de una PERSONA (la contraseña, 15/10/2026) es el «Email a la persona»: por el remitente de MaKo, a
        // esa persona y con los datos de su evento (`datosDeLaPersona`, lib/aviso-evento.ts).
        const contexto = pr.eventoMako ? datosDeLaPersona(pr.eventoMako) : null;
        const quien = EVENTOS_MAKO.find((e) => e.subtipo === pr.eventoMako)?.quien ?? 'La persona del evento';
        return <EditorEmail paso={paso} id={id} negocio={pr.negocio} busy={pr.busy} cambiar={cambiar}
          persona={contexto ? { contexto, para: quien } : null}
          mako={rolAdmin ? { disparador: pr.disparador, paraGuion: pr.paraGuion, chat: chatDe(id) } : null} />;
      }
      // Instagram y Messenger: la lógica del de WhatsApp con la cara de su app. La `key` va por tarjeta
      // (siembra estado de sus props). Tipear no apila; borrar, editar o adjuntar sí (`cambioApila`).
      if (esCanalSocial(paso.canal)) {
        return (
          <EditorMensajeSocial key={`social-${id}`} paso={paso} canal={paso.canal} negocio={pr.negocio} deshabilitado={pr.busy}
            adjuntos={pr.adjuntos} onAdjuntoNuevo={pr.onAdjuntoNuevo} onError={pr.onError}
            mako={rolAdmin ? { disparador: pr.disparador, paraGuion: pr.paraGuion, chat: chatDe(id) } : null}
            onChange={(patch) => cambiar(patch, cambioApila(patch, paso))} />
        );
      }
      return <EditorMensaje {...pr} paso={paso} id={id} cambiar={cambiar} chatMako={chatDe(id)} />;
  }
}

/**
 * EL EMAIL, con la cara de redactar en Gmail: el «De», el asunto y el cuerpo con su barra de
 * formato (cuarta tanda, punto 16: sin la vista previa ni el ojo «Así llega»). Tipear no apila: el
 * Ctrl+Z del texto es del navegador; elegir otro «De», sí, porque es una decisión.
 * La `key` va por tarjeta: el editor siembra estado de sus props (AGENTS.md).
 *
 * ⚠️ `remitente` VA SIEMPRE: el editor lo acepta y sin este enchufe elegir otro «De» se guardaba en el
 * paso y la pantalla seguía mostrando el del negocio (docs/hallazgos-chatbot.md, «Una prop nueva del
 * editor con CERO call sites»).
 */
function EditorEmail({ paso, id, negocio, busy, cambiar, mako, persona = null }: { paso: PasoSecuenciaDto; id: string; negocio: string; busy: boolean; cambiar: Cambiar; mako?: EditorEmailGmailProps['mako']; persona?: EditorEmailGmailProps['persona'] }) {
  return (
    // `cuerpoHtml`: el editor rico arranca del HTML guardado y un deshacer del lienzo lo devuelve
    // entero (sin esto, arrancaba del texto plano y deshacer sólo volvía el texto).
    <EditorEmailGmail key={`email-${id}`}
      asunto={paso.asunto ?? ''} preheader={paso.preheader ?? ''} cuerpo={paso.cuerpo ?? ''} cuerpoHtml={paso.cuerpo_html ?? ''}
      remitente={paso.remitente ?? null} mako={mako} persona={persona}
      // Usar la sugerencia de MaKo (asunto y cuerpo de una vez) es una decisión: apila, como elegir otro «De».
      onChange={(patch) => cambiar(patch, 'remitente' in patch || ('asunto' in patch && 'cuerpo_html' in patch))} negocio={negocio} deshabilitado={busy} />
  );
}

/**
 * LA ETIQUETA, como una frase: «[Agregar ▾] [etiquetas]» (decisión 8). Sigue siendo una ⚡ Acción
 * (poner_etiqueta_lead / sacar_etiqueta_lead) sobre el lead del flujo: el motor no cambia. Cambiar
 * la operación o la etiqueta apila (es una decisión, no tipear).
 */
function EditorEtiquetaLienzo(p: { paso: PasoSecuenciaDto; id: string; busy: boolean; cambiar: Cambiar }) {
  const e = etiquetaDeAccion(p.paso);
  if (!e) return null;
  // VARIAS ETIQUETAS (sexta tanda, TAG 2): la primera en `etiquetaId` y todas en `etiquetaIds` si son más
  // de una (`paramsConEtiquetas`, lib/editor-acciones.ts). Con una, el paso queda como siempre.
  return (
    <EditorEtiqueta key={`etq-${p.id}`} operacion={e.operacion} etiquetaIds={etiquetasDelPaso(p.paso.accion?.params)} deshabilitado={p.busy}
      onChange={(operacion, ids) => p.cambiar({
        accion: { operacion, params: paramsConEtiquetas(ids, { leadId: LEAD_DEL_EVENTO }) },
      }, true)} />
  );
}

type Cambiar = (patch: Partial<PasoSecuenciaDto>, apilar: boolean) => void;

function SoloLectura({ nodo, paso }: { nodo: NodoFlujo; paso: PasoSecuenciaDto | null }) {
  const txt: CSSProperties = { fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap' };
  if (paso && claseDe(paso) === 'mensaje') return <div style={txt}>{paso.cuerpo || 'Sin escribir'}</div>;
  // El AI Step no tiene filas de salida: sus casos son su contenido (lo mismo que dibuja la tarjeta).
  if (paso && esPasoIA(paso)) return <CuerpoPasoIA paso={paso} />;
  if (nodo.puertos?.some((p) => p.rotulo != null)) return <div style={txt}>{nodo.puertos.map((p) => p.rotulo).join('\n')}</div>;
  return <div style={{ ...txt, color: 'var(--dim)' }}>{nodo.detalle}</div>;
}

/**
 * EL MENSAJE: UN editor para todo lo que sale por WhatsApp (punto 8: «que todo lo que
 * tenga que ver con WhatsApp tenga un mismo editable, ya sea audio, texto, archivos»).
 * El editor es `EditorMensajeWhatsApp` (el composer); acá se le dice qué permite.
 *
 * ⚠️ LA IA SÓLO DONDE EL MOTOR LA HONRA: WhatsApp no oficial y un mensaje de texto. Por la
 * vía oficial sale una plantilla que aprobó Meta, y `setSecuenciaPasos` le saca el
 * `tipo: 'ia'` a esos pasos al guardar: ofrecerla ahí sería un control que se apaga solo.
 * La condición es la MISMA función que usa el saneo (`proveedorDelPaso`), no una copia.
 *
 * ⚠️ Y LA `key` VA POR TARJETA: el editor es uno y se reusa al tocar otra; con estado
 * sembrado de props (lo que se está grabando, el guion), sin la key lo de un mensaje se
 * quedaba dibujado en el siguiente (AGENTS.md, el `useState` sembrado de props).
 */
function EditorMensaje({ paso, id, cambiar, pasos, audios, negocio, envioAutoSecuencia, onAudioNuevo, onModoIA, paraGuion, adjuntos, onAdjuntoNuevo, disparador, triggerTipo, onPasos, chatMako }: PropsEditor & { paso: PasoSecuenciaDto; id: string; cambiar: Cambiar; chatMako?: HistorialRedacta | null }) {
  const noOficial = proveedorDelPaso(paso) === 'no_oficial';
  // EL RECORDATORIO DE LA REUNIÓN (10/10/2026): lo manda su emisor, que manda TEXTO y resuelve SUS datos
  // (lib/recordatorio-automatizacion.ts). Ni audio, ni archivos, ni «Revisar» (sale siempre), y el «{ }» con
  // sus datos y no los del motor.
  const recordatorio = triggerTipo === TRIGGER_RECORDATORIO;
  // EL «{ }» Y EL ROJO DE LA BARRA (undécima tanda, puntos 6 y 7) salen del contexto con que Publicar valida ESTA
  // tarjeta (`contextoDeTarjeta`): el árbol entero al lead por el no oficial, los datos de siempre por el oficial.
  const firmaCtx = JSON.stringify(recordatorio ? null : contextoDeTarjeta(paso, { trigger_tipo: triggerTipo ?? '' }));
  const tarjeta = useMemo(() => JSON.parse(firmaCtx) as ReturnType<typeof contextoDeTarjeta>, [firmaCtx]);
  const datosTarjeta = useMemo(() => (tarjeta?.tipo === 'catalogo' ? datosOfrecidos(tarjeta.datos) : undefined), [tarjeta]);
  const modoIA = (on: boolean) => {
    // El tipo cambia ACÁ (un cambio que se deshace) y la guía la abre quien monta. Las dos
    // cosas idempotentes: el composer puede mandar también `{ tipo }` por `onChange`.
    cambiar({ tipo: on ? 'ia' : 'texto' }, true);
    onModoIA?.(on);
  };
  return (
    <EditorMensajeWhatsApp
      key={`msg-${id}`}
      paso={paso}
      // ⚠️ SIN `disposicion` (tercera tanda, decisión 1): el chat arriba y el composer abajo, como un
      // teléfono. Hasta el 09/10 iba `'fila'` con el panel apaisado —el chat a un costado y el
      // composer al otro— y Martín lo leyó «bugeado».
      onChange={(patch) => {
        // Tipear no entra a la pila (el Ctrl+Z del texto es del navegador); cambiar de
        // audio, de archivo, de tipo o de «Revisar», sí. Escribir en una variante también es
        // tipear: la decide `cambioApila` (lib/flujo-conversacion.ts).
        cambiar(patch, cambioApila(patch, paso));
        if (patch.tipo === 'ia' && paso.tipo !== 'ia') onModoIA?.(true);
      }}
      audios={audios} onAudioNuevo={onAudioNuevo}
      adjuntos={adjuntos} onAdjuntoNuevo={onAdjuntoNuevo}
      paraGuion={paraGuion}
      disparador={disparador}
      // El ✦ va en la CABECERA del panel (`CabeceraWhatsApp`, el `tituloEditor` de FlujoLienzo), con la
      // misma regla; el panel que abre se dibuja en el editor. El número también va en la cabecera y es
      // de este mensaje (sexta tanda, WhatsApp 2 y 3).
      permiteIA={permiteIADe(paso, !!onModoIA)}
      onModoIA={modoIA}
      permiteAudio={noOficial && !recordatorio}
      permiteAdjuntos={noOficial && !recordatorio}
      variables={recordatorio ? DATOS_RECORDATORIO.map((d) => ({ ...d })) : undefined}
      datos={datosTarjeta}
      contexto={tarjeta?.tipo === 'catalogo' ? tarjeta.datos : tarjeta?.tipo}
      redactaCon={recordatorio ? 'recordatorio' : undefined}
      // Minutos entre dos mensajes (WhatsApp 2): la tarjeta se parte con una espera en el medio.
      onPartirConEspera={noOficial && !recordatorio ? (i, m) => onPasos((prev) => { const r = partirConEspera(prev, id, i, m); return r.ok ? r.pasos : prev; }, true) : undefined}
      // «Sale sola» pasó a cada mensaje (punto 6): ausente en el paso = lo que hace el MOTOR con
      // él, así que el interruptor se pinta con ese valor (`revisarHeredado`: un «MaKo contesta»
      // de «Si responde» sin `revisar` deja borrador, aunque la secuencia salga sola).
      mostrarRevisar={!recordatorio}
      revisarHeredado={revisarHeredado(pasos, id, envioAutoSecuencia)}
      negocio={negocio}
      placeholder={paso.tipo === 'ia' ? 'Cómo responder' : undefined}
      chatMako={chatMako}
    />
  );
}

/**
 * EL CONTEXTO DE LOS DATOS DE UNA TARJETA MAKO en un flujo de lead: el aviso al EQUIPO sobre UN lead (al equipo sí le
 * llegan el link al CRM, la etapa, la campaña). Es lo que contesta `contextoDeTarjeta` para una tarjeta MAKO de una
 * automatización de siempre; queda acá sólo por si no contestara (no pasa: la tarjeta es MAKO).
 */
const CONTEXTO_MAKO: ContextoDatos = { destino: 'equipo', conLead: true };

/**
 * LA TARJETA MAKO («MaKo en WhatsApp»): el mensaje que MaKo le manda al GRUPO de WhatsApp del negocio
 * (tercera tanda, decisión 11). Sigue siendo la ⚡ Acción `avisar_al_equipo` sobre el lead del EVENTO.
 *
 * ⚠️ UNDÉCIMA TANDA (decisión 2 de la décima, textual: «Si, agregale esas opciones. Pero en audios, que se pueda
 *    configurar con ElevenLabs que salga la voz de MaKo. La que usamos para crear los VSL de la landing.»): es EL
 *    MISMO editor que un WhatsApp (`EditorMensajeWhatsApp`), no el «modo grupo» de un solo texto (`EditorMensajeGrupo`
 *    quedó para /mensajes): archivos de la biblioteca, varios mensajes, pausas, minutos (la tarjeta se parte con un
 *    DELAY, `partirConEspera`), el ✦ (escribe para el EQUIPO) y, de audio, SÓLO la Voz de MaKo (`vozMako`: sin
 *    micrófono ni «Audios guardados», que serían la voz del dueño). El editor ve la tarjeta como un mensaje
 *    (`pasoDeMako`: con su id y su orden REALES, así el borrador de la barra y el ✦ son de ESTA tarjeta) y lo que
 *    cambia vuelve a sus `params` por `paramsDeMako`: `partes` siempre explícita (sale TAL CUAL, lo que se ve es lo que
 *    llega: sin «🟡 título», sin «— MaKo», sin el nombre · teléfono · link que agregaba el aviso) y `mensaje` su espejo.
 * ⚠️ EL CAMBIO SE APLICA SOBRE LA TARJETA DE AHORA, adentro del updater (`onPasos(prev => …)`), no sobre los `params`
 *    del render: el editor manda dos cambios en el mismo tick (al salir, lo de la barra y después el audio) y el
 *    segundo pisaba al primero.
 * ⚠️ LOS DATOS («{ }» y el ✦) SALEN DEL CONTEXTO CON QUE PUBLICAR LOS VALIDA (`contextoDeTarjeta`,
 *    lib/tokens-del-flujo.ts): el equipo y el lead en un flujo de lead; sin lead en un Recurrente que es sólo el grupo;
 *    en una fila de EVENTO, lo que ese evento trae (`datosDelEvento`). Ofrecer de más es prometer un dato que sale crudo.
 *
 * Tipear no apila (el Ctrl+Z del texto es del navegador); borrar, adjuntar o sumar la voz, sí (`cambioApila`). La
 * `key` va por tarjeta.
 */
function EditorMako({ paso, id, busy, onPasos, eventoMako, triggerTipo, adjuntos, onAdjuntoNuevo, onError, disparador, paraGuion, negocio, chatMako }: PropsEditor & { paso: PasoSecuenciaDto; id: string; chatMako?: HistorialRedacta | null }) {
  const trigger = eventoMako ? TRIGGER_AVISO_MAKO : (triggerTipo ?? '');
  const ctx = contextoDeTarjeta(paso, { trigger_tipo: trigger, subtipo: eventoMako ?? undefined });
  // Por su firma: la tarjeta cambia en cada tecla y su contexto no (el «{ }» no se rearma por tipear).
  const firmaCtx = JSON.stringify(ctx?.tipo === 'catalogo' ? ctx.datos : CONTEXTO_MAKO);
  const contexto = useMemo(() => JSON.parse(firmaCtx) as ContextoDatos, [firmaCtx]);
  const datos = useMemo(() => datosOfrecidos(contexto), [contexto]);
  const dto = useMemo(() => pasoDeMako(paso), [paso]);
  const cambiarMako = (patch: Partial<PasoSecuenciaDto>) => onPasos((prev) => {
    const i = indicePorId(prev, id);
    const accion = i >= 0 ? prev[i].accion : null;
    if (!accion) return prev;
    const params = accion.params ?? {};
    const sig = paramsDeMako({ ...params, leadId: params.leadId ?? LEAD_DEL_EVENTO }, patch as unknown as CambioDeMako);
    return cambiarNodo(prev, id, { accion: { operacion: accion.operacion ?? '', params: sig } });
  }, cambioApila(patch, dto));
  // FUERA DEL HORARIO (15/10/2026, Martín: «que se pueda configurar que te mande el mensaje luego, cuando se "abra" la
  // oficina. Y por defecto si esta configurado horario de oficina que esté eso»). Sólo con horario: sin él no hay nada
  // que esperar. Elegir es una decisión: apila.
  const oficina = useHorarioOficina();
  const paramsAhora = paso.accion?.params as Record<string, unknown> | undefined;
  const fuera: FueraDeHorario = esperaQueAbra(paramsAhora) ? 'espera' : 'igual';
  // Lo que no es el mensaje (fuera del horario, por dónde, el asunto), sobre la tarjeta de AHORA. `apila`: elegir apila,
  // tipear el asunto no (como el texto).
  const cambiarEnvio = (cambio: CambioDeMako, apila: boolean) => onPasos((prev) => {
    const i = indicePorId(prev, id);
    const accion = i >= 0 ? prev[i].accion : null;
    if (!accion) return prev;
    const params = accion.params ?? {};
    const sig = paramsDeMako({ ...params, leadId: params.leadId ?? LEAD_DEL_EVENTO }, cambio);
    return cambiarNodo(prev, id, { accion: { operacion: accion.operacion ?? '', params: sig } });
  }, apila);
  const cambiarFuera = (v: FueraDeHorario) => cambiarEnvio({ fueraDeHorario: v }, true);
  const porEmail = esPorEmail(paramsAhora);
  const campoFuera = oficina?.horario ? (
    <div data-fuera-de-horario style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)', whiteSpace: 'nowrap' }}>Fuera del horario</span>
      <Dropdown
        value={fuera}
        options={FUERAS_DE_HORARIO.map((v) => ({ value: v, label: ROTULO_FUERA_DE_HORARIO[v], icono: v === 'espera' ? 'reloj' : 'enviar' }))}
        onChange={(v) => cambiarFuera(v as FueraDeHorario)}
        ariaLabel="Qué hace este aviso fuera del horario de oficina"
        disabled={busy}
      />
    </div>
  ) : null;
  // UN EVENTO DE LA PLATAFORMA (15/10/2026, `EventoMako.plataforma`): la tarjeta le llega al grupo del NEGOCIO que lo emitió
  // (`negocioWs`, lib/flujos.ts), no al tuyo. Nada por detrás: lo dice.
  const aNegocio = EVENTOS_MAKO.find((e) => e.subtipo === eventoMako)?.plataforma === true;
  return (
    <>
    {aNegocio && <div data-mako-a-negocio style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 8 }}>{porEmail ? 'Le llega por email al equipo del negocio del evento.' : 'Le llega al grupo del negocio del evento.'}</div>}
    <EnvioDeMako params={paramsAhora} busy={busy} onCambio={cambiarEnvio} aNegocio={aNegocio} />
    {campoFuera}
    {/* Por email, un solo texto: sin la Voz de MaKo, sin archivos (y con eso, sin varios mensajes ni minutos). */}
    <EditorMensajeWhatsApp
      key={porEmail ? 'email' : 'grupo'}
      paso={dto} autor="MaKo" vozMako={!porEmail} placeholder={porEmail ? 'Texto del correo' : aNegocio ? 'Mensaje para el negocio' : 'Mensaje para tu equipo'}
      audios={[]} permiteAudio={false} permiteAdjuntos={!porEmail} adjuntos={adjuntos} onAdjuntoNuevo={onAdjuntoNuevo}
      datos={datos} redactaCon={contexto} permiteIA paraGuion={paraGuion} disparador={disparador} negocio={negocio}
      onPartirConEspera={porEmail ? undefined : (i, m) => onPasos((prev) => { const r = partirConEspera(prev, id, i, m); return r.ok ? r.pasos : prev; }, true)}
      onChange={cambiarMako} onError={onError} deshabilitado={busy} chatMako={chatMako}
    />
    </>
  );
}

/**
 * POR DÓNDE SALE LA TARJETA MAKO, y su asunto (16/10/2026, la mudanza del reporte semanal: docs/diseno-avisos-plataforma.md
 * §6): el grupo de WhatsApp, o un correo al EQUIPO del negocio (sus destinatarios de Notificaciones, desde
 * equipo@hola-mako.com). Por email va un texto con su asunto: sin voz ni archivos ni varios mensajes
 * (`problemaDeEmailMako` lo frena al publicar). Elegir apila; tipear el asunto no (como el texto).
 */
function EnvioDeMako({ params, busy, onCambio, aNegocio }: { params: Record<string, unknown> | undefined; busy: boolean; onCambio: (c: CambioDeMako, apila: boolean) => void; aNegocio: boolean }) {
  const porEmail = esPorEmail(params);
  const sinGrupo = sinGrupoDeMako(params);
  // «Por email» sin nadie a quien escribirle no hace nada: lo dice (17/10/2026). Sólo para TU negocio: en un evento de la
  // plataforma el correo va al equipo de cada negocio, y esos destinatarios no son los tuyos.
  const sinDestinatarios = useSinDestinatariosEmail(!porEmail && sinGrupo === 'email' && !aNegocio);
  return (
    <>
      <div data-canal-mako style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)', whiteSpace: 'nowrap' }}>Por dónde</span>
        <Dropdown
          value={porEmail ? 'email' : 'grupo'}
          options={CANALES_MAKO.map((v) => ({ value: v, label: ROTULO_CANAL_MAKO[v], icono: v === 'email' ? 'email' : 'whatsapp' }))}
          onChange={(v) => onCambio({ canal: v as CanalMako }, true)}
          ariaLabel="Por dónde sale este aviso"
          disabled={busy}
        />
      </div>
      {/* SIN GRUPO DE MAKO (17/10/2026): qué pasa si el negocio no tiene grupo. Antes se perdía sin decirlo. De fábrica,
          queda en la app (la campanita y el teléfono). */}
      {!porEmail && (
        <div data-sin-grupo-mako style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)', whiteSpace: 'nowrap' }}>Sin grupo de MaKo</span>
          <Dropdown
            value={sinGrupo}
            options={SINES_GRUPO.map((v) => ({ value: v, label: ROTULO_SIN_GRUPO[v], icono: v === 'email' ? 'email' : 'avisar' }))}
            onChange={(v) => onCambio({ sinGrupo: v as SinGrupo }, true)}
            ariaLabel="Qué pasa si el negocio no tiene grupo de MaKo"
            disabled={busy}
          />
          {sinDestinatarios && <span data-sin-destinatarios style={{ fontSize: 12, color: 'var(--warn)' }}>Nadie recibe avisos por email</span>}
        </div>
      )}
      {porEmail && (
        <input data-asunto-mako value={asuntoDeMako(params)} placeholder="Asunto" aria-label="Asunto del correo" maxLength={TOPE_ASUNTO_MAKO}
          disabled={busy} onChange={(e) => onCambio({ asunto: e.target.value }, false)}
          style={{ width: '100%', boxSizing: 'border-box', marginBottom: 10, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--card)', color: 'var(--ink)', fontWeight: 600, fontSize: 14 }} />
      )}
    </>
  );
}

/**
 * ¿EL NEGOCIO NO TIENE A NADIE EN «Notificaciones por email»? (17/10/2026, la tarjeta MaKo «Sin grupo: por email»). Se lee
 * recién cuando hace falta y una vez por página (`/api/perfil/destinatarios`, sólo admin). true SÓLO si se leyó y está
 * vacío: lo que no se pudo leer no se afirma.
 */
let destinatariosEmail: Promise<number | null> | null = null;
function useSinDestinatariosEmail(activo: boolean): boolean {
  const [sin, setSin] = useState(false);
  useEffect(() => {
    if (!activo) { setSin(false); return; }
    let vivo = true;
    destinatariosEmail ??= fetch('/api/perfil/destinatarios', { cache: 'no-store', signal: AbortSignal.timeout(30_000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ok?: boolean; destinatarios?: { emails?: unknown[] } } | null) => (j?.ok && Array.isArray(j.destinatarios?.emails) ? j.destinatarios.emails.length : null))
      .catch(() => null);
    const p = destinatariosEmail;
    void p.then((n) => { if (vivo) setSin(n === 0); if (n == null && destinatariosEmail === p) destinatariosEmail = null; });
    return () => { vivo = false; };
  }, [activo]);
  return activo && sin;
}

/**
 * EL PASO «⚡ ACCIÓN DE MAKO». El editor es el compartido (`EditorAccionMako`): qué acción
 * y con qué datos. Corre SOLO cuando el flujo llega acá, sin pedir un «sí» (decisión de
 * Martín, 08/10/2026). Ya no lleva «Cuándo corre»: el tiempo es su propia tarjeta.
 *
 * ⚠️ LA `key` LLEVA LA OPERACIÓN: el editor siembra estado de sus props (el texto crudo de
 * un campo JSON) y es UNO que se reusa al tocar otro nodo.
 */
function EditorAccion({ paso, id, busy, cambiar }: { paso: PasoSecuenciaDto; id: string; busy: boolean; cambiar: Cambiar }) {
  const previa = paso.accion?.operacion ?? '';
  return (
    <EditorAccionMako
      key={`accion-${id}-${previa}`}
      valor={{ operacion: paso.accion?.operacion || undefined, params: paso.accion?.params ?? {} }}
      onCambio={(v: ValorAccion) => cambiar({ accion: { operacion: v.operacion ?? '', params: v.params ?? {} } }, (v.operacion ?? '') !== previa)}
      disabled={busy}
    />
  );
}

// `Unidad` es la de lib/espera-duracion.ts (segundos, minutos, horas, días).
type Unidad = UnidadEspera;

/**
 * ESPERAR, COMO UNA FRASE GIGANTE: «Esperar [10] [segundos ▾]», o «[1] [hora ▾] [antes de la reunión ▾]»
 * en las que ya estaban ancladas.
 *
 * Sexta tanda (09/10/2026), textual:
 *   · DELAY 2: «No entiendo el texto "Sigue a la hora en punto", eso no tiene sentido, eliminalo... SI
 *     es que configuraste un "Horario de oficina" no deberías hacerlo... Eso se hace en todo caso en
 *     configuraciones, no aquí. No pongas esa limitación.» El aviso de precisión (`avisoDePrecision`,
 *     lib/espera-duracion.ts) SALE de acá: que la espera se cumpla a la hora exacta, de día o de noche,
 *     es del motor (parte «tiempo» de la tanda), y el horario de envío de un negocio se pone en
 *     Configuraciones. Esta frase dice cuánto espera y nada más;
 *   · CRON 1 (vale para DELAY): «Haz los botones gigantes, y reduce el espacio». El número y la unidad
 *     miden lo del desplegable PRINCIPAL de la casa (56 de alto, ./dropdown-reglas.ts) y el número va en
 *     22 y negrita: es lo único que se mira en esta tarjeta. Sin la línea del aviso, la frase es todo
 *     el panel.
 *
 * ⚠️ SEGUNDOS, MINUTOS, HORAS Y DÍAS desde la quinta tanda (punto 3, literal: «En Delay, falta la
 * opción de minutos y segundos...»). El dato sigue siendo `espera.minutos`, con decimales para los
 * segundos (10 s = 1/6 min). La UNIDAD que se ve la elige la persona y se recuerda mientras el número
 * entre en ella (`unidadMostrada`): sin eso, tipear «120» en segundos saltaba a «2 minutos» con el
 * cursor adentro. Una espera vieja con minutos sueltos sigue mostrando «minutos»: el valor que está
 * puesto entra siempre (AGENTS.md).
 */
function EditorEspera({ espera, busy, cambiar }: { espera: Espera | undefined; busy: boolean; cambiar: Cambiar }) {
  const e: Espera = espera ?? { modo: 'tiempo', minutos: 1440 };
  const seg = Math.max(1, segundosDeMinutos(e.minutos));
  const [preferida, setPreferida] = useState<Unidad | null>(null);
  const unidad = unidadMostrada(seg, preferida);
  const n = seg / SEGUNDOS_DE[unidad];
  // «Si agenda más cerca» (16/10/2026) se conserva al cambiar el número o la unidad; pasar a «Esperar» lo suelta.
  const cerca = e.modo === 'antes_reunion' && e.siAgendaCerca === 'sale' ? { siAgendaCerca: 'sale' as const } : {};
  const poner = (modo: Espera['modo'], cuanto: number, u: Unidad, apilar: boolean) =>
    cambiar({ espera: { modo, minutos: minutosDeSegundos(Math.max(1, Math.round(cuanto)) * SEGUNDOS_DE[u]), ...(modo === 'antes_reunion' ? cerca : {}) } }, apilar);
  // Un ícono por unidad (general 10: «pon íconos en todos los desplegable»): el cronómetro para lo corto,
  // el reloj para minutos y horas, el calendario para los días.
  const iconoUnidad: Record<Unidad, NombreIconoMenu> = { s: 'cronometro', min: 'reloj', h: 'reloj', dias: 'calendario' };
  const numero = (
    <input type="number" min={1} step={1} value={n} disabled={busy} aria-label="Cuánto"
      onChange={(ev) => { const v = Number(ev.target.value); if (v > 0) poner(e.modo, v, unidad, false); }}
      style={{ ...campoGrande, minHeight: ALTO_PRINCIPAL, width: 104, flex: 'none', textAlign: 'center', fontSize: 22, fontWeight: 700, borderRadius: 13, border: '1.5px solid var(--border-strong)' }} />
  );
  const selUnidad = (
    <div style={{ flex: '1 1 170px', minWidth: 0 }}>
      <Dropdown value={unidad} width="100%" ariaLabel="Unidad" search={false} disabled={busy} variante="principal"
        options={UNIDADES_ESPERA.map((u) => ({ value: u, label: rotuloUnidad(u, n), icono: iconoUnidad[u] }))}
        onChange={(v) => { const u = v as Unidad; setPreferida(u); poner(e.modo, n, u, true); }} />
    </div>
  );
  // ⚠️ CUARTA TANDA, PUNTO 9: «En "Delay" lo de "Antes de la reunión" debería ser una CONDITION,
  // dentro de la sección de llamadas» (vive en «Próxima reunión en», lib/condiciones-catalogo.ts). Un
  // DELAY nuevo sólo espera: «Esperar [1] [día]». Uno que YA está anclado a la reunión sigue con su
  // selector, para poder verlo y pasarlo a «Esperar»; el motor lo sigue corriendo igual.
  if (e.modo === 'tiempo') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', flex: 'none' }}>Esperar</span>{numero}{selUnidad}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
      {numero}{selUnidad}
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <Dropdown value={e.modo} width="100%" ariaLabel="Cuándo" search={false} disabled={busy} buttonStyle={botonGrande}
          options={[{ value: 'tiempo', label: 'Esperar', icono: 'reloj' }, { value: 'antes_reunion', label: 'antes de la reunión', icono: 'calendario' }]}
          onChange={(v) => poner(v as Espera['modo'], n, unidad, true)} />
      </div>
      {/* «SI AGENDA MÁS CERCA» (16/10/2026, Martín: «si está configurado "1 día antes" y se agendó dentro de 3 horas, que
          simplemente no salga»): lo que pasa cuando el lead llega con menos de la mitad (`llegaTarde`). De fábrica, no sale. */}
      <div style={{ flex: '1 1 100%', minWidth: 0 }}>
        <Dropdown value={e.siAgendaCerca ?? 'no_sale'} width="100%" ariaLabel="Si agenda más cerca" search={false} disabled={busy}
          options={OPCIONES_SI_AGENDA_CERCA.map((o) => ({ value: o, label: textoSiAgendaCerca({ ...e, siAgendaCerca: o }) ?? '', icono: o === 'sale' ? 'reloj' : 'calendario' }))}
          onChange={(v) => cambiar({ espera: v === 'sale' ? { modo: 'antes_reunion', minutos: e.minutos, siAgendaCerca: 'sale' } : { modo: 'antes_reunion', minutos: e.minutos } }, true)} />
      </div>
    </div>
  );
}

/**
 * «SI RESPONDE», EDITADA COMO UNA CONDITION (sexta tanda, punto 12: «Reply ya te dije que tiene que
 * estar dentro de CONDITION»). Es el mismo dato y el mismo motor de siempre —los casos de la tarjeta
 * `respuesta`, que clasifica `responderConGrafo` cuando el lead escribe—; lo que cambia es la cara: el
 * editor de la CONDITION con la familia «Respuesta» (`EditorCondicionDeRespuesta`). Cada caso nuevo
 * nace con su tarjeta «MaKo contesta» (`agregarCaso`), que no se abre sola para no sacar a la persona
 * de la lista que está armando; el «Si no» es lo que antes era «Otra cosa».
 */
function EditorRespuesta({ paso, id, cambiar, onPasos, busy, onAbrir, pasos }: PropsEditor & { paso: PasoSecuenciaDto; id: string; cambiar: Cambiar }) {
  const casos = paso.casos ?? [];
  /**
   * «PASAR A AI STEP» (novena tanda: «Todo lo que hiciste… debería estar en una nueva tarjeta que sea "AI
   * Step". Configuralo allí»): pliega las tarjetas de cada caso adentro de la tarjeta (`respuestaAPasoIA`,
   * lib/paso-ia-convertir.ts). Todo o nada: si un caso tiene algo que no entra, el botón se apaga y su
   * `title` dice cuál. Deshacible como cualquier cambio, y nada se guarda hasta Publicar.
   */
  const conversion = respuestaAPasoIA(pasos, id);
  const motivo = 'error' in conversion ? conversion.error : null;
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <EditorCondicionDeRespuesta key={`resp-${id}`} busy={busy} r={{
        casos,
        cambiarCasos: (c, apilar) => cambiar({ casos: c }, apilar),
        onAgregarCaso: () => { if (casos.length < TOPE_CASOS) onPasos((prev) => agregarCaso(prev, id).pasos, true); },
        onQuitarCaso: (casoId) => onPasos((prev) => quitarCaso(prev, id, casoId), true),
        ...(paso.si_no ? { onVerSiNo: () => onAbrir(paso.si_no!) } : {}),
      }} />
      <button type="button" disabled={busy || motivo != null} title={motivo ?? 'Pasar a AI Step'}
        onClick={() => onPasos((prev) => { const r = respuestaAPasoIA(prev, id); return 'error' in r ? prev : r.pasos; }, true)}
        style={{
          ...botonGrande, width: '100%', border: '1px solid var(--border-strong)', background: 'var(--surface)', fontFamily: SANS,
          color: motivo != null ? 'var(--faint)' : 'var(--primary)', cursor: busy || motivo != null ? 'default' : 'pointer',
        }}>
        Pasar a AI Step
      </button>
    </div>
  );
}

/**
 * «IR A», SÓLO EL QUE QUEDA (sexta tanda, punto 12: «"Go to" desaparece directamente»). No se crea
 * desde la tercera tanda, y al abrir la automatización el lienzo los pasa a flechas
 * (`abrirFlujo` → `quitarIrA`, lib/flujo-legado.ts). Si igual se abre uno —un flujo que todavía no se
 * convirtió—, dice a dónde va y lo pasa a lo de ahora con un botón: a una tarjeta de este flujo, una
 * flecha directa; a otra automatización, se quita (la otra arranca por su propio CRON). El motor lo
 * sigue corriendo mientras tanto.
 */
function EditorIrA({ paso, id, pasos, secuencias, nombres, busy, onPasos }: PropsEditor & { paso: PasoSecuenciaDto; id: string; cambiar: Cambiar }) {
  const d = paso.destino ?? null;
  const aTarjeta = d && 'nodo' in d ? d.nodo : null;
  const otra = d && 'secuencia_id' in d ? (secuencias.find((s) => s.id === Number(d.secuencia_id))?.nombre ?? 'otra automatización') : null;
  const texto = aTarjeta ? `Va a «${nombreDeTarjeta(pasos, aTarjeta, nombres)}»` : otra ? `Sigue en «${otra}»` : 'No dice a dónde';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 14, color: 'var(--ink)', fontFamily: SANS }}>{texto}</div>
      <button type="button" disabled={busy} onClick={() => onPasos((prev) => quitarIrA(prev, { solo: id }).pasos, true)}
        style={{ ...botonGrande, width: '100%', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--primary)', cursor: busy ? 'default' : 'pointer', fontFamily: SANS }}>
        {aTarjeta ? 'Pasar a flecha' : 'Quitar'}
      </button>
    </div>
  );
}
