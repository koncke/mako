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

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Dropdown, type DropdownOption } from '../components/Dropdown';
import { Lienzo, TarjetaNodo, inpLienzo, campoGrande, botonGrande } from '@/app/_components/Lienzo';
// El editor del paso «⚡ Acción» es UNO para los dos lienzos (este y el de /mensajes).
import { EditorAccionMako, useTitulosAcciones, type ValorAccion } from '@/app/_components/EditorAccionMako';
import { EditorMensajeWhatsApp, BotonMakoWhatsApp, makoPosible, type EditorMensajeWhatsAppProps } from './EditorMensajeWhatsApp';
import { EditorEmailGmail } from './EditorEmailGmail';
import { EditorEtiqueta } from './EditorEtiqueta';
// El editor de la CONDICIÓN (tercera tanda, puntos 9 y 10): una frase por fila, del catálogo por
// secciones filtrado por el CRON. Vive aparte; este archivo sólo lo monta.
import { EditorCondicion, useCatalogosCondicion, catalogosDe } from './EditorCondicion';
import { ambitoDeDisparo, nombresCatalogoDe } from '@/lib/condiciones-catalogo';
import { LEAD_DEL_EVENTO } from '@/lib/api-mako/flujo-params';
import { BurbujaHilo } from '@/app/whatsapp/_shared/BurbujaHilo';
import { IconDoc } from '@/app/whatsapp/_shared/composer-icons';
import { esPasoAccion } from '@/lib/nutricion-paso-accion';
import { proveedorDelPaso } from '@/lib/nutricion-canal';
import { aplicarVariables, VARIABLES_LEAD } from '@/lib/template-vars';
import type { AdjuntoDto } from '@/lib/setting-adjuntos-reglas';
import {
  claseDe, idDe, TOPE_CASOS,
  type Espera, type NombresParaTexto,
} from '@/lib/flujo-grafo';
import {
  grafoDeSecuencia, opcionesDelMas, nombreDeTarjeta, agregarRama, quitarRama, agregarCaso, quitarCaso, cambiarNodo,
  revisarHeredado, cambioApila, nombreEtiqueta, vistaDeArchivo, etiquetaDeAccion, tarjetasParaIrA, esMako, makoDeAccion,
  ID_ENTRADA, PUERTO_RESPUESTA,
  MARCO_MAIL, RENGLON_ASUNTO, RENGLON_PREHEADER, RENGLON_CUERPO_MAIL, SEP_MAIL, RENGLONES_EMAIL, RENGLON_MAS_PARTES,
  type NodoFlujo, type QueAgregar,
} from '@/lib/flujo-conversacion';
import { partesExplicitas } from '@/lib/mensaje-partes';
import { editorDeTarjeta, type Muelles } from '@/lib/lienzo-grafo';
import {
  UNIDADES_ESPERA, SEGUNDOS_DE, rotuloUnidad, segundosDeMinutos, minutosDeSegundos, unidadMostrada, sinPrecision, avisoDePrecision,
  type UnidadEspera,
} from '@/lib/espera-duracion';
import { conPosiciones, moverRelativo, type Posiciones } from '@/lib/lienzo-posiciones';
import type { AudioSetting, PasoSecuenciaDto, ProductoOpcion } from './ChatAgentApp';

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
  onPasos, onAgregar, onBorrar, onCrearRespuesta, onAudioNuevo, onError, onModoIA,
  chrome, herramientas, pie, editorEntrada, insetIzq, insetDer, muelles, revelar,
  onTarjetaAbierta, reservaAbajo, triggerTipo, productos, posiciones, onPosiciones, linea,
}: {
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
   */
  foco?: { id: string; vez: number } | null;
  /** Cuántas respuestas de esta automatización esperan a una persona (ver `grafoDeSecuencia`). */
  pendientesOtraCosa?: number;
  onPasos: CambioPasos;
  /** El ＋ de una salida (o del medio de una flecha). Devuelve el id de la tarjeta nueva. */
  onAgregar?: (nodo: string, puerto: string | undefined, que: QueAgregar) => string | null;
  /** La papelera de la cabecera del panel. */
  onBorrar?: (id: string) => void;
  /** El ＋ de la fila «Si responde» del CRON, vacía: crea la tarjeta. Devuelve su id. */
  onCrearRespuesta?: () => string | null;
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
  productos?: ProductoOpcion[];
}) {
  const [sel, setSel] = useState<string | null>(null);
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

  // Los catálogos de las condiciones (cursos, clases, posts, campañas), para que la tarjeta diga el
  // nombre de lo elegido («Completó la clase «Bienvenida»» y no «una clase»). Se piden sólo si hay una
  // condición y quien mira es admin (la ruta es de admin): un setter ve el texto genérico.
  const remotosCond = useCatalogosCondicion(rolAdmin && pasos.some((p) => claseDe(p) === 'condicion'));
  // Los nombres de las etiquetas, las etapas y lo del catálogo: los mismos para la tarjeta y para el «Ir a».
  const nombres: NombresParaTexto = {
    etiqueta: (id) => nombreEtiqueta(etiquetas, id), etapa: nombreEtapa,
    catalogo: nombresCatalogoDe(catalogosDe({ etapas, productos: productos ?? [], remotos: remotosCond })),
  };
  const derivado = grafoDeSecuencia(pasos, {
    disparador, secuencias, tituloAccion: (op) => titulos?.get(op),
    nombres, colorEtiqueta: (id) => etiquetas.find((t) => t.id === id)?.color ?? null,
    audioDe: (id) => audios.find((a) => a.id === id) ?? null,
    pendientesOtraCosa,
  });
  // Lo movido, sobre el árbol. `moverRelativo` mide contra el DERIVADO: mover el CRON no arrastra al resto.
  const grafo = conPosiciones(derivado, posiciones, ID_ENTRADA);
  const pasoDe = (id: string) => pasos.find((p, i) => idDe(p, i) === id) ?? null;
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
    <Lienzo
      grafo={grafo} seleccion={sel} onSeleccion={setSel}
      onMover={onPosiciones ? (id, x, y) => onPosiciones(moverRelativo(derivado, posiciones, id, x, y, ID_ENTRADA)) : undefined}
      sinMarco alto="100%" panelAncho={talla.ancho}
      insetIzq={muelles ? muelles.insets.izq : insetIzq} insetDer={muelles ? muelles.insets.der : insetDer}
      insetDerChrome={muelles?.insets.derChrome} insetDerAbajo={muelles?.insets.derAbajo}
      panelForma={formaPanel} panelAlto={talla.alto}
      revelar={revelar} reservaAbajo={reservaAbajo}
      chrome={chrome} herramientas={herramientas} accion={pie}
      /* ⚠️ EL ＋ ES EL DE CADA SALIDA (y el del medio de cada flecha), y la tarjeta nueva se
         abre sola: casi todas nacen con algo que elegir (la acción, a dónde va el salto, la
         condición). La fila «Si responde» del CRON, vacía, crea «Si responde» (`crearRespuesta`):
         desapareció la tarjeta fantasma que lo hacía (decisión 1, un solo CRON). */
      onAgregarTras={editable ? ((id, que, puerto) => {
        if (id === ID_ENTRADA && puerto === PUERTO_RESPUESTA) {
          const r = onCrearRespuesta ? onCrearRespuesta() : null;
          if (r) setSel(r);
          return;
        }
        const nuevo = onAgregar!(id, puerto, que as QueAgregar);
        if (nuevo) setSel(nuevo);
      }) : undefined}
      opcionesEn={(nodo, puerto, medio) => opcionesDelMas(pasos, nodo, medio, puerto)}
      onBorrar={rolAdmin && onBorrar ? onBorrar : undefined}
      puedeBorrar={(id) => id !== ID_ENTRADA}
      renderNodo={(n, activo) => {
        const paso = pasoDe(n.id);
        // La espera es una píldora de UNA línea: su texto va suelto (TarjetaNodo lo envuelve).
        if (n.tipo === 'espera') return <TarjetaNodo key={n.id} nodo={n} activo={activo}>{n.detalle}</TarjetaNodo>;
        return (
          <TarjetaNodo key={n.id} nodo={n} activo={activo} roto={n.tipo === 'ir-a' && Boolean(n.advertencia)}>
            {n.tipo === 'mensaje' && paso
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
        );
      }}
      renderEditor={(n) => (
        <EditorDeNodo
          nodo={n} paso={pasoDe(n.id)} pasos={pasos} secuencias={secuencias}
          audios={audios} negocio={negocio} rolAdmin={rolAdmin} busy={busy} envioAutoSecuencia={envioAutoSecuencia}
          etiquetas={etiquetas} etapas={etapas} triggerTipo={triggerTipo} productos={productos}
          nombres={nombres} paraGuion={paraGuion} adjuntos={biblioteca?.estado === 'ok' ? biblioteca.lista : undefined} onAdjuntoNuevo={archivoNuevo}
          onPasos={onPasos} onAudioNuevo={onAudioNuevo} onError={onError} onModoIA={onModoIA}
          editorEntrada={editorEntrada} formaPanel={formaPanel} linea={linea}
          onAbrir={(id) => setSel(id)}
        />
      )}
      // «✦ MaKo» AL LADO DEL TÍTULO del panel de un mensaje de WhatsApp (cuarta tanda, punto 15). Se
      // ofrece con la MISMA regla que el editor (`makoPosible` + `permiteIADe`), que con
      // `makoEnCabecera` deja de dibujar el suyo: un solo botón, nunca dos.
      accionesTitulo={(n) => {
        const paso = pasoDe(n.id);
        if (!rolAdmin || !paso || claseDe(paso) !== 'mensaje' || paso.canal === 'email') return null;
        if (!makoPosible(paso, permiteIADe(paso, !!onModoIA), proveedorDelPaso(paso) === 'no_oficial')) return null;
        return (
          <BotonMakoWhatsApp activo={paso.tipo === 'ia'} deshabilitado={busy}
            onCambiar={(on) => { onPasos((prev) => cambiarNodo(prev, n.id, { tipo: on ? 'ia' : 'texto' }), true); onModoIA?.(on); }} />
        );
      }}
    />
  );
}

/**
 * ¿El editor de este mensaje ofrece «✦ MaKo»? Sólo donde el motor la honra: WhatsApp no oficial y un
 * mensaje de texto (ver `EditorMensaje`). Una función para el editor y la cabecera del panel.
 */
function permiteIADe(paso: PasoSecuenciaDto, hayModoIA: boolean): boolean {
  return hayModoIA && paso.canal === 'whatsapp' && proveedorDelPaso(paso) === 'no_oficial' && paso.tipo !== 'audio' && paso.tipo !== 'media';
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
  if (paso.canal === 'email') return <VistaEmail paso={paso} texto={texto} negocio={n} />;
  const vacio = paso.tipo === 'media' ? !paso.media_id : paso.tipo !== 'audio' && !texto.trim();
  if (vacio) return <span style={{ fontSize: 12, color: 'var(--faint)' }}>Sin escribir</span>;
  // VARIAS PARTES (cuarta tanda, punto 15): la tarjeta dibuja la PRIMERA (los campos de siempre son su
  // espejo) y «+N más» debajo. El alto lo mide `altoDeMensaje` con lo mismo (`RENGLON_MAS_PARTES`).
  const mas = (partesExplicitas(paso)?.length ?? 1) - 1;
  const masPartes = mas > 0
    ? <div style={{ marginTop: 4, fontSize: 11, lineHeight: `${RENGLON_MAS_PARTES}px`, color: 'var(--dim)', fontWeight: 600 }}>+{mas} más</div>
    : null;
  if (paso.tipo === 'media') return <><VistaArchivo paso={paso} texto={texto} negocio={negocio} biblioteca={biblioteca} />{masPartes}</>;
  return (
    <>
      {/* Sin la transcripción del audio (punto 15: «que no se vea la transcripción»): el alto
          tampoco la cuenta. */}
      <BurbujaHilo compacta saliente autor={negocio} contenido={{
        texto,
        audio: paso.tipo === 'audio' ? { url: a?.url ?? null, titulo: a?.titulo, transcript: null, duracion_s: a?.duracion_s ?? null } : null,
        ia: paso.tipo === 'ia',
      }} />
      {masPartes}
    </>
  );
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
  /** El número de salida de la automatización (ver FlujoLienzo). */
  linea?: EditorMensajeWhatsAppProps['linea'];
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
      if (esMako(paso)) return <EditorMako key={`mako-${id}`} paso={paso} busy={pr.busy} cambiar={cambiar} />;
      return <EditorAccion paso={paso} id={id} busy={pr.busy} cambiar={cambiar} />;
    // La `key` va por tarjeta: el editor recuerda la unidad elegida (`useState` sembrado de props).
    case 'esperar': return <EditorEspera key={`espera-${id}`} espera={paso.espera} busy={pr.busy} cambiar={cambiar} />;
    // La condición (parte A de la tercera tanda): el catálogo filtrado por el ámbito del CRON. Agregar
    // o quitar una rama crea un puerto o se lleva lo que colgaba de él: eso lo hace el lienzo.
    case 'condicion': return (
      <EditorCondicion key={`cond-${id}`} paso={paso} cambiar={cambiar}
        ambito={ambitoDeDisparo(pr.triggerTipo)} etapas={pr.etapas} productos={pr.productos ?? []} busy={pr.busy}
        onAgregarRama={() => pr.onPasos((prev) => agregarRama(prev, id), true)}
        onQuitarRama={(ramaId) => pr.onPasos((prev) => quitarRama(prev, id, ramaId), true)} />
    );
    case 'respuesta': return <EditorRespuesta {...pr} paso={paso} id={id} cambiar={cambiar} />;
    case 'ir_a': return <EditorIrA {...pr} paso={paso} id={id} cambiar={cambiar} />;
    default:
      if (paso.canal === 'email') return <EditorEmail paso={paso} id={id} negocio={pr.negocio} busy={pr.busy} cambiar={cambiar} />;
      return <EditorMensaje {...pr} paso={paso} id={id} cambiar={cambiar} />;
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
function EditorEmail({ paso, id, negocio, busy, cambiar }: { paso: PasoSecuenciaDto; id: string; negocio: string; busy: boolean; cambiar: Cambiar }) {
  return (
    // `cuerpoHtml`: el editor rico arranca del HTML guardado y un deshacer del lienzo lo devuelve
    // entero (sin esto, arrancaba del texto plano y deshacer sólo volvía el texto).
    <EditorEmailGmail key={`email-${id}`}
      asunto={paso.asunto ?? ''} preheader={paso.preheader ?? ''} cuerpo={paso.cuerpo ?? ''} cuerpoHtml={paso.cuerpo_html ?? ''}
      remitente={paso.remitente ?? null}
      onChange={(patch) => cambiar(patch, 'remitente' in patch)} negocio={negocio} deshabilitado={busy} />
  );
}

/**
 * LA ETIQUETA, como una frase: «[Poner ▾] [etiqueta ▾]» (decisión 8). Sigue siendo una ⚡ Acción
 * (poner_etiqueta_lead / sacar_etiqueta_lead) sobre el lead del flujo: el motor no cambia. Cambiar
 * la operación o la etiqueta apila (es una decisión, no tipear).
 */
function EditorEtiquetaLienzo(p: { paso: PasoSecuenciaDto; id: string; busy: boolean; cambiar: Cambiar }) {
  const e = etiquetaDeAccion(p.paso);
  if (!e) return null;
  return (
    <EditorEtiqueta key={`etq-${p.id}`} operacion={e.operacion} etiquetaId={e.etiquetaId} deshabilitado={p.busy}
      onChange={(operacion, etiquetaId) => p.cambiar({
        accion: { operacion, params: { leadId: LEAD_DEL_EVENTO, ...(etiquetaId != null ? { etiquetaId } : {}) } },
      }, true)} />
  );
}

type Cambiar = (patch: Partial<PasoSecuenciaDto>, apilar: boolean) => void;

/** Los datos del lead que se pueden poner en el mensaje de la tarjeta MAKO. */
const DATOS_MAKO: DropdownOption[] = VARIABLES_LEAD.map((v) => ({ value: v.key, label: v.label, sub: v.ejemplo }));

/**
 * LA TARJETA MAKO: el mensaje que MaKo le manda al GRUPO de WhatsApp del negocio (tercera tanda,
 * decisión 11), con los datos del lead para insertar y un título opcional. Sigue siendo la ⚡ Acción
 * `avisar_al_equipo` sobre el lead del EVENTO: el aviso ya lleva su nombre, su teléfono y el link a su
 * ficha, y no se repite para el mismo lead en 12 h (lib/api-mako/areas/chatbot.run.ts).
 *
 * ⚠️ NO ES UN MENSAJE AL LEAD. Por eso no es el composer de WhatsApp: ni audio, ni archivos, ni
 * «Revisar antes de enviar».
 *
 * Tipear no apila (el Ctrl+Z del texto es del navegador); insertar un dato, sí. La `key` va por
 * tarjeta: el editor guarda dónde estaba el cursor.
 */
function EditorMako({ paso, busy, cambiar }: { paso: PasoSecuenciaDto; busy: boolean; cambiar: Cambiar }) {
  const m = makoDeAccion(paso) ?? { mensaje: '', titulo: '' };
  const area = useRef<HTMLTextAreaElement | null>(null);
  const params = paso.accion?.params ?? {};
  const poner = (patch: { mensaje?: string; titulo?: string }, apilar: boolean) => {
    const sig: Record<string, unknown> = { ...params, leadId: params.leadId ?? LEAD_DEL_EVENTO, ...patch };
    // Un título vacío no viaja: el aviso pone el suyo («<lead>: hay que verlo»).
    if (typeof sig.titulo === 'string' && !sig.titulo.trim()) delete sig.titulo;
    cambiar({ accion: { operacion: paso.accion?.operacion ?? '', params: sig } }, apilar);
  };
  const insertar = (clave: string) => {
    const t = `{{${clave}}}`;
    const el = area.current;
    const ini = el ? el.selectionStart : m.mensaje.length;
    const fin = el ? el.selectionEnd : m.mensaje.length;
    poner({ mensaje: m.mensaje.slice(0, ini) + t + m.mensaje.slice(fin) }, true);
    // El cursor queda después del dato, como al tipearlo.
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(ini + t.length, ini + t.length); } });
  };
  // EL MENSAJE ES EL PROTAGONISTA (cuarta tanda, punto 1): llena el alto del panel (fijo por tipo,
  // `editorDeTarjeta`) en vez de quedar en cuatro renglones con aire debajo. Columna flex y
  // `flex: 1` + `minHeight`, nunca `height: 100%` (Safari lo resuelve a cero).
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
      <input value={m.titulo} maxLength={120} placeholder="Título (opcional)" disabled={busy} aria-label="Título del aviso"
        onChange={(e) => poner({ titulo: e.target.value }, false)} style={{ ...inpLienzo, fontWeight: 600, flex: 'none' }} />
      <textarea ref={area} value={m.mensaje} rows={5} maxLength={1000} placeholder="Mensaje para tu equipo" disabled={busy} aria-label="Mensaje para tu equipo"
        onChange={(e) => poner({ mensaje: e.target.value }, false)}
        style={{ ...inpLienzo, flex: 1, minHeight: 96, resize: 'none', fontSize: 14.5, lineHeight: 1.5, padding: '10px 12px', borderRadius: 11 }} />
      <div style={{ flex: 'none' }}>
        <Dropdown value="" resetAfterSelect options={DATOS_MAKO} botonLabel="＋ Dato del lead" ariaLabel="Insertar un dato del lead" disabled={busy}
          buttonStyle={{ padding: '6px 10px', fontSize: 12.5, borderRadius: 8 }} onChange={(v) => v && insertar(v)} />
      </div>
    </div>
  );
}

function SoloLectura({ nodo, paso }: { nodo: NodoFlujo; paso: PasoSecuenciaDto | null }) {
  const txt: CSSProperties = { fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap' };
  if (paso && claseDe(paso) === 'mensaje') return <div style={txt}>{paso.cuerpo || 'Sin escribir'}</div>;
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
function EditorMensaje({ paso, id, cambiar, pasos, audios, negocio, envioAutoSecuencia, onAudioNuevo, onModoIA, paraGuion, adjuntos, onAdjuntoNuevo, linea }: PropsEditor & { paso: PasoSecuenciaDto; id: string; cambiar: Cambiar }) {
  const noOficial = proveedorDelPaso(paso) === 'no_oficial';
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
      permiteIA={permiteIADe(paso, !!onModoIA)}
      onModoIA={modoIA}
      // «✦ MaKo» lo dibuja la cabecera del panel (`accionesTitulo` en FlujoLienzo), con la misma regla.
      makoEnCabecera
      linea={linea}
      permiteAudio={noOficial}
      permiteAdjuntos={noOficial}
      // «Sale sola» pasó a cada mensaje (punto 6): ausente en el paso = lo que hace el MOTOR con
      // él, así que el interruptor se pinta con ese valor (`revisarHeredado`: un «MaKo contesta»
      // de «Si responde» sin `revisar` deja borrador, aunque la secuencia salga sola).
      mostrarRevisar
      revisarHeredado={revisarHeredado(pasos, id, envioAutoSecuencia)}
      negocio={negocio}
      placeholder={paso.tipo === 'ia' ? 'Cómo responder' : undefined}
    />
  );
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
 * ESPERAR, COMO UNA FRASE GRANDE: «Esperar [10] [segundos ▾]» (cuarta tanda, punto 1: el campo es el
 * protagonista, de 48 de alto, y la unidad llena lo que queda del renglón), o «[1] [hora ▾] [antes de
 * la reunión ▾]» en las que ya estaban ancladas.
 *
 * ⚠️ SEGUNDOS, MINUTOS, HORAS Y DÍAS desde la quinta tanda (punto 3, literal: «En Delay, falta la
 * opción de minutos y segundos...»). Hasta ahí eran horas y días, «porque el motor corre una vez por
 * hora y ofrecer minutos sería prometer una precisión que no existe». Eso sigue siendo cierto, y por
 * eso la frase lleva su aviso: una espera de hasta 2 min se cumple EN LA MISMA EJECUCIÓN que llegó al
 * DELAY —la corrida del cron o la vía rápida de un evento, después de contestar— (la decisión entera,
 * en la cabecera de lib/espera-duracion.ts); más larga depende del cron, que corre a la hora en punto
 * y sólo de día, y la pantalla dice cuándo sigue con las horas de quien mira (`sinPrecision` +
 * `avisoDePrecision`: «Un número tuyo por encima del suyo no protege: promete»).
 *
 * El dato sigue siendo `espera.minutos`, con decimales para los segundos (10 s = 1/6 min). La UNIDAD
 * que se ve la elige la persona y se recuerda mientras el número entre en ella (`unidadMostrada`): sin
 * eso, tipear «120» en segundos saltaba a «2 minutos» con el cursor adentro. Una espera vieja con
 * minutos sueltos sigue mostrando «minutos»: el valor que está puesto entra siempre (AGENTS.md).
 */
function EditorEspera({ espera, busy, cambiar }: { espera: Espera | undefined; busy: boolean; cambiar: Cambiar }) {
  const e: Espera = espera ?? { modo: 'tiempo', minutos: 1440 };
  const seg = Math.max(1, segundosDeMinutos(e.minutos));
  const [preferida, setPreferida] = useState<Unidad | null>(null);
  const unidad = unidadMostrada(seg, preferida);
  const n = seg / SEGUNDOS_DE[unidad];
  const poner = (modo: Espera['modo'], cuanto: number, u: Unidad, apilar: boolean) =>
    cambiar({ espera: { modo, minutos: minutosDeSegundos(Math.max(1, Math.round(cuanto)) * SEGUNDOS_DE[u]) } }, apilar);
  const numero = (
    <input type="number" min={1} step={1} value={n} disabled={busy} aria-label="Cuánto"
      onChange={(ev) => { const v = Number(ev.target.value); if (v > 0) poner(e.modo, v, unidad, false); }}
      style={{ ...campoGrande, width: 96, flex: 'none', textAlign: 'center' }} />
  );
  const selUnidad = (
    <div style={{ flex: '1 1 150px', minWidth: 0 }}>
      <Dropdown value={unidad} width="100%" ariaLabel="Unidad" search={false} disabled={busy} buttonStyle={botonGrande}
        options={UNIDADES_ESPERA.map((u) => ({ value: u, label: rotuloUnidad(u, n) }))}
        onChange={(v) => { const u = v as Unidad; setPreferida(u); poner(e.modo, n, u, true); }} />
    </div>
  );
  const aviso = e.modo === 'tiempo' && sinPrecision(seg)
    ? <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--dim)' }}>{avisoDePrecision(new Date().getTimezoneOffset())}</div>
    : null;
  // ⚠️ CUARTA TANDA, PUNTO 9: «En "Delay" lo de "Antes de la reunión" debería ser una CONDITION,
  // dentro de la sección de llamadas» (vive en «Próxima reunión en», lib/condiciones-catalogo.ts). Un
  // DELAY nuevo sólo espera: «Esperar [1] [día]». Uno que YA está anclado a la reunión sigue con su
  // selector, para poder verlo y pasarlo a «Esperar»; el motor lo sigue corriendo igual.
  if (e.modo === 'tiempo') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', flex: 'none' }}>Esperar</span>{numero}{selUnidad}
        </div>
        {aviso}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
      {numero}{selUnidad}
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <Dropdown value={e.modo} width="100%" ariaLabel="Cuándo" search={false} disabled={busy} buttonStyle={botonGrande}
          options={[{ value: 'tiempo', label: 'Esperar' }, { value: 'antes_reunion', label: 'antes de la reunión' }]}
          onChange={(v) => poner(v as Espera['modo'], n, unidad, true)} />
      </div>
    </div>
  );
}

/**
 * «SI RESPONDE»: los casos (nombre corto + cuándo aplica) con «+ caso». Es lo que antes eran
 * los escenarios del modo asistido, editados en un formulario arriba de la pantalla
 * (punto 1). Cada caso nuevo nace con su tarjeta «MaKo contesta» (`agregarCaso`), que es
 * donde se escribe cómo responder. «Otra cosa» es la última salida, fija.
 */
function EditorRespuesta({ paso, id, cambiar, onPasos, busy, onAbrir }: PropsEditor & { paso: PasoSecuenciaDto; id: string; cambiar: Cambiar }) {
  const casos = paso.casos ?? [];
  const setCaso = (k: number, p: Partial<(typeof casos)[number]>) => cambiar({ casos: casos.map((c, j) => (j === k ? { ...c, ...p } : c)) }, false);
  return (
    <div>
      {casos.map((c, k) => (
        <div key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 9 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <input value={c.titulo} maxLength={40} placeholder="Nombre" disabled={busy} aria-label="Nombre del caso"
              onChange={(e) => setCaso(k, { titulo: e.target.value })} style={{ ...inpLienzo, fontWeight: 600 }} />
            <textarea value={c.cuando} rows={2} placeholder="Cuándo aplica" disabled={busy} aria-label="Cuándo aplica"
              onChange={(e) => setCaso(k, { cuando: e.target.value })} style={{ ...inpLienzo, resize: 'vertical', lineHeight: 1.45 }} />
          </div>
          <button type="button" onClick={() => onPasos((prev) => quitarCaso(prev, id, c.id), true)} disabled={busy} title="Quitar" aria-label="Quitar este caso"
            style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 13, padding: '8px 2px' }}>✕</button>
        </div>
      ))}
      {/* El caso se nombra acá; cómo responder se escribe en su tarjeta «MaKo contesta»,
          que no se abre sola para no sacar a la persona de la lista que está armando. */}
      <BotonTexto disabled={busy || casos.length >= TOPE_CASOS} onClick={() => onPasos((prev) => agregarCaso(prev, id).pasos, true)}>+ caso</BotonTexto>
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>Otra cosa</span>
        {paso.si_no && (
          <button type="button" onClick={() => onAbrir(paso.si_no!)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--primary)', cursor: 'pointer', fontFamily: SANS }}>Ver</button>
        )}
      </div>
    </div>
  );
}

/**
 * «IR A»: otra automatización (se la inscribe) u otra tarjeta de este flujo (un salto).
 *
 * ⚠️ DESDE LA SALIDA, SÓLO LAS TARJETAS DE SU HILO (`tarjetasParaIrA`, con `hiloDe` del modelo):
 * con flechas en paralelo, saltar a la tarjeta de otro hilo le manda lo mismo dos veces al lead y
 * `validarGrafo` no lo deja publicar. Desde «Si responde», todas.
 */
function EditorIrA({ paso, id, cambiar, pasos, secuencias, nombres, busy }: PropsEditor & { paso: PasoSecuenciaDto; id: string; cambiar: Cambiar }) {
  const d = paso.destino ?? null;
  const valor = !d ? '' : 'secuencia_id' in d ? `sec:${d.secuencia_id}` : `nodo:${d.nodo}`;
  const secciones = [
    { title: 'Otra automatización', options: secuencias.map((s) => ({ value: `sec:${s.id}`, label: s.nombre })) },
    {
      title: 'Otra tarjeta de este flujo',
      // El nombre ya trae lo que la tarjeta dice («Mensaje: Hola, te…»), como la tarjeta del «Ir a».
      options: tarjetasParaIrA(pasos, id).map((t) => ({ value: `nodo:${t}`, label: nombreDeTarjeta(pasos, t, nombres) })),
    },
  ].filter((s) => s.options.length > 0);
  if (valor && !secciones.some((s) => s.options.some((o) => o.value === valor))) {
    secciones.unshift({ title: 'La que tiene puesta', options: [{ value: valor, label: 'Algo que ya no existe' }] });
  }
  // Grande y de ancho completo: es lo único que se elige acá (cuarta tanda, punto 1).
  return (
    <Dropdown value={valor} secciones={secciones} placeholder="Elige a dónde" width="100%" ariaLabel="A dónde va" disabled={busy} search buttonStyle={botonGrande}
      onChange={(v) => {
        const [clase, ...resto] = v.split(':');
        const x = resto.join(':');
        if (clase === 'sec' && Number(x) > 0) cambiar({ destino: { secuencia_id: Number(x) } }, true);
        if (clase === 'nodo' && x) cambiar({ destino: { nodo: x } }, true);
      }} />
  );
}

function BotonTexto({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, fontFamily: SANS, color: disabled ? 'var(--faint)' : 'var(--primary)', cursor: disabled ? 'default' : 'pointer' }}>
      {children}
    </button>
  );
}
