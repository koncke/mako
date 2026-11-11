'use client';

// =============================================================================
// La caja de los chats con MaKo — UNA pieza en toda la app (20/10/2026)
// =============================================================================
// Martín, 18/10: «un solo chat en toda la app» (docs/feedback-18-10.md). Y el 20/10: «Te pedí que unificaras el chat del
// Ops Center en todos lados, su diseño y funcionalidades... Y en el onboarding y en otros lugares el chat sigue siendo
// diferente» (docs/feedback-20-10.md, punto 8). Es la caja del Ops Center sacada de Conversacion.tsx y ChatsMovil.tsx, con
// todo lo que ya hacía:
//   · UNA fila, como WhatsApp: el «+» (Documento, Fotos, Cámara y Pegar, y abajo lo de cada pantalla), los emojis, el
//     campo y UN botón, que es el micrófono sin nada escrito y la flecha con algo (Microfono.tsx → BotonMandar);
//   · las miniaturas de lo adjuntado arriba, pegar una imagen (Ctrl+V), viñetas y listas mientras se escribe, los links
//     azules con su chip, y sin tope de largo;
//   · el campo crece y el scroll lo acompaña: la conversación sigue abajo si estaba abajo, y el campo sigue al cursor.
// Lo que cambia de una pantalla a otra va por props: a quién se le escribe, qué se manda, qué va arriba (la cita, un
// texto largo pegado) y qué va en el «+». El motor (a qué endpoint manda y qué devuelve) es de cada pantalla.
// ⚠️ ARRASTRAR Y SOLTAR: la pantalla puede hacer de toda la conversación la zona (`alSoltar` y `traeArchivos`, pegar.ts), y
// desde el 27/10/2026 la CAJA también lo toma (ticket #16 de Leila: «No me deja adjuntar un documento ni por arrastrar, ni
// por adjuntar»; casi ninguna pantalla lo tenía). Y la pantalla SIN adjuntos propios adjunta igual: la caja lee cada archivo
// y lo manda con el mensaje (./adjuntos-que-se-leen.ts). `sinAdjuntos` lo apaga donde adjuntar no tiene sentido.
// La NOTA DE VOZ (20/10/2026, para el onboarding): con `voz`, sin nada escrito el botón GRABA en vez de dictar (el dictado
// no aguanta un monólogo, y su respaldo usa las keys del negocio, que un cliente nuevo no tiene). Mientras graba, o con lo
// grabado para escuchar, la fila es la barra de la grabación (`BarraGrabacion`): se termina, se escucha y recién ahí se
// manda (la regla de Martín del 09/10).
// SIN `voz` TAMBIÉN GRABA (24/10/2026, Martín: «en chats o en los chats de MaKo que se grabe el audio y se envíe
// directamente»): la pantalla cuyo motor no recibe audios usa la nota que se transcribe y se MANDA como texto
// (./nota-que-se-manda.ts). El dictado ya no está en ninguna caja de chat: quedó sólo donde se escribe un texto (el alta
// de una tarea del Plan, el guion de Copywriting, la nota de un lead). docs/diseno-chats-de-mako.md.
// ⚠️ tests/chat-unico.test.ts hace cumplir la regla: una pantalla de MaKo que arma su propia caja falla.

import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Icon } from '@/app/_components/icons';
import { BarraGrabacion, useGrabacionVoz, type GrabacionVoz } from '@/app/whatsapp/_shared/VoiceRecorder';
import { altoDelCampo, conVinetas, enterEnLista, estaAbajo, micAlLadoDeLaFlecha } from '@/lib/centro-caja';
import { ListaAdjuntos, MasCaja, alPegar, alSoltar, traeArchivos, type AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import { useAdjuntosQueSeLeen } from './adjuntos-que-se-leen';
import { ESPERA_PARA_ADJUNTAR, adjuntosQuietos, juntarAdjuntos } from './juntar-adjuntos';
import { useAvisarAdjuntos } from './soltar-en-la-caja';
import { capturaParaOfrecer, firmaDeCaptura } from '@/app/admin/operaciones/pegar';
import { BotonGrabar, BotonMandar } from '@/app/admin/operaciones/Microfono';
import { BotonEmojis } from '@/app/admin/operaciones/Emojis';
import { LinksDeLaCaja, ResalteDeLinks, hayLinks } from '@/app/admin/operaciones/ConLinks';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { useNotaQueSeManda, type GrabacionLista, type NotaGrabada, type NotaQueSeManda } from './nota-que-se-manda';

export type PropsCajaChat = {
  texto: string;
  onTexto: (t: string) => void;
  onMandar: () => void;
  /** Saliendo: el campo y el botón se apagan, y el botón gira. */
  enviando?: boolean;
  /** Sin poder escribir todavía (el chat no cargó): como `enviando`, sin el giro. */
  apagado?: boolean;
  /** MaKo está trabajando (20/10/2026, la revisión de caja-voz): SÓLO el botón gira y no manda. El campo, el «+» y los
   *  emojis siguen: se escribe el próximo mensaje mientras tanto (apagar el campo cerraba el teclado del teléfono). */
  ocupado?: boolean;
  /** «Escribe a CRM», «Escríbele a MaKo»: también es su nombre accesible. */
  placeholder: string;
  tituloMandar?: string;
  /** Los adjuntos de la PANTALLA (su motor los recibe). Sin esto, la caja adjunta sola: lee cada archivo y lo manda con el
   *  mensaje (./adjuntos-que-se-leen.ts), salvo con `sinAdjuntos`. */
  adjuntos?: AdjuntosDeCaja;
  /** Esta caja no adjunta nada (ni el «+» ni lo arrastrado). Sólo donde adjuntar no tiene sentido: tiene que decir por qué. */
  sinAdjuntos?: boolean;
  /** Cuántos caracteres lee el motor de esta pantalla (el Video y el Image Editor): lo adjuntado entra hasta ahí, con aviso. */
  topeTexto?: number;
  /** De qué conversación es lo que la caja lee, en una pantalla con varias y UNA caja (Soporte, 28/10/2026): lo de cada una se
   *  guarda aparte, y lo que se leía al cambiar no sale en la otra (./adjuntos-que-se-leen.ts). */
  conversacion?: string;
  /** La caja está leyendo lo que se mandó con el mensaje (un .pptx, un audio): la pantalla que manda otra cosa por fuera de la
   *  caja lo espera (Soporte: el ticket no sale sin ese mensaje, 28/10/2026). */
  onLeyendo?: (leyendo: boolean) => void;
  /** Lo de abajo del «+» (la cuenta, el modelo, las tareas): como función recibe `cerrar`. */
  mas?: ReactNode | ((cerrar: () => void) => ReactNode);
  /** Lo que va arriba de las miniaturas: la cita de un mensaje, un texto largo pegado. */
  arriba?: ReactNode;
  /** Además de lo escrito y lo adjuntado, ¿hay algo para mandar? (un texto largo pegado como documento). */
  hayAlgoMas?: boolean;
  /** Enter manda (la computadora). En el teléfono Enter baja de renglón: se manda con el botón. */
  enterManda?: boolean;
  /** Un pegado que la pantalla resuelve antes (un texto largo que va como documento): si llama a `preventDefault`, listo. */
  onPegar?: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
  /** El campo, para enfocarlo desde afuera (responder un mensaje, «Responder sobre esto»). */
  campo?: RefObject<HTMLTextAreaElement | null>;
  /** La conversación que sigue abajo mientras se escribe (la del hilo, o el cuerpo de la hoja en el teléfono). */
  seguir?: () => HTMLElement | null;
  /** Hasta cuánto crece el campo a mano (la computadora, 220). null = lo hace crecer el CSS (`field-sizing`, el teléfono). */
  altoMax?: number | null;
  /** El micrófono no pudo (permiso, transcripción): lo dice la pantalla, en su línea de estado o en un aviso. */
  onErrorMic?: (m: string) => void;
  /** La clase de la fila: la de la computadora (`co-caja__fila`) o la del teléfono (`m-operaciones-caja__fila`). */
  fila?: string;
  /** La nota de voz: `onAudio` recibe lo que se MANDA (después de escucharlo); `pendiente`, una grabación de antes que la
   *  pantalla todavía tiene (con borrar, dejar y seguir); `rotuloEnviar`, el nombre del botón que la manda. */
  voz?: {
    onAudio: (blob: Blob, secs: number) => void | Promise<void>;
    onError?: (m: string) => void;
    pendiente?: { url: string; secs?: number | null; onBorrar: () => void; onDejar: () => void; onSeguir?: () => void } | null;
    rotuloEnviar?: string;
    /** No se puede empezar a grabar (el onboarding, mientras MaKo contesta: su respuesta puede cerrar la etapa y lo grabado
     *  en el medio se perdía). Lo ya grabado se sigue viendo. */
    apagada?: boolean;
  };
  /** Sin `voz`, la nota que se transcribe y sale (26/10/2026): la pantalla que la quiere recibe su MP3, lo que dura y su
   *  transcripción antes de mandar, para mandarla como nota de voz (el Ops Center). */
  onNota?: (n: NotaGrabada) => void;
  /** Sin `voz`, la nota SALE EN EL ACTO (27/10/2026): la pantalla la recibe apenas se grabó, sin transcribir, y la manda por
   *  detrás (./nota-que-se-manda.ts → prepararNota). Cambiar de chat o de tab no la pierde. */
  onGrabada?: (g: GrabacionLista) => void;
  /** La línea de estado debajo de la caja, con lo que dice la pantalla («Leyendo «X»…»). Sin esto, no se dibuja (la pantalla
   *  puede tener la suya afuera, como el Ops Center). */
  estado?: string | null;
  /** Al final de la fila, antes del botón: lo que la pantalla necesita a mano (21/10/2026, Martín: «Si el usuario aún no
   *  conectó su Claude o GPT, debería aparecer en la barra de chat, al final... el botón de conectar»). */
  alFinal?: ReactNode;
  /** NO SE PUEDE ESCRIBIR hasta hacer algo (24/10/2026, Martín: «Si no tengo instalada la app de desktop NO debe dejarme
   *  escribir nada, directamente en el chat donde está el botón de audio se debería reemplazar por "Instalar MaKo"»): el
   *  campo apagado dice `frase`, y EN EL LUGAR DEL MICRÓFONO va `boton` (app/_chat/AppPrimero.tsx → useBloqueoApp). */
  bloqueo?: { frase: string; boton: ReactNode };
};

/** Cuánto queda apagado el micrófono justo después de mandar: lo que dura un doble toque. */
const MS_MISMO_GESTO = 600;
/** Las capturas que ya se ofrecieron en esta pestaña (pegadas o descartadas): no se vuelven a ofrecer en otra caja. */
const CAPTURAS_VISTAS = new Set<string>();

export function CajaChat(p: PropsCajaChat) {
  // La grabación es un hook: va en su propio componente. Con `voz`, la manda la pantalla; sin `voz`, se transcribe y sale.
  return p.voz ? <CajaConVoz {...p} voz={p.voz} /> : <CajaConNota {...p} />;
}

function CajaConNota(p: PropsCajaChat) {
  const nota = useNotaQueSeManda({ texto: p.texto, onTexto: p.onTexto, onMandar: p.onMandar, onError: p.onErrorMic, onNota: p.onNota, onGrabada: p.onGrabada });
  return <Caja p={p} grabacion={nota.grabacion} nota={nota} />;
}

function CajaConVoz(p: PropsCajaChat & { voz: NonNullable<PropsCajaChat['voz']> }) {
  const grabacion = useGrabacionVoz(p.voz.onAudio, p.voz.onError);
  return <Caja p={p} grabacion={grabacion} />;
}

function Caja({ p, grabacion: deLaPantalla, nota = null }: { p: PropsCajaChat; grabacion: GrabacionVoz | null; nota?: NotaQueSeManda | null }) {
  const { texto, onTexto, ocupado = false, altoMax = 220 } = p;
  // TODA CAJA TOMA TODO LO QUE MaKo SABE LEER (ticket #16, ./adjuntos-que-se-leen.ts): lo que la pantalla toma (su `accept`)
  // va a SUS adjuntos; lo demás (un Word en el Second Brain, que sólo toma fotos y PDF; cualquier cosa donde la pantalla no
  // adjunta) lo lee la caja al mandar y sale con el mensaje. `sinAdjuntos`: sólo lo de la pantalla.
  const leidos = useAdjuntosQueSeLeen({ activo: !p.sinAdjuntos, texto, onTexto, onMandar: p.onMandar, onError: p.onErrorMic, tope: p.topeTexto, conversacion: p.conversacion });
  const deLaCaja = juntarAdjuntos(p.adjuntos, p.sinAdjuntos ? undefined : leidos.adjuntos);
  const onMandar = leidos.mandar;
  // ⚠️ CON ALGO ADJUNTADO, LA NOTA ES EL TEXTO DE ESE MENSAJE (ticket #51 de Leandro, 4/11/2026). La nota «de siempre» de cada pantalla
  // sale sola (`voz`, `onGrabada`) y lo adjuntado se quedaba en la caja: MaKo contestaba el audio sin haber visto la imagen. Ésta se
  // transcribe y sale por el `onMandar` de todas, el que ya lleva texto y archivos juntos, sin tocar ningún motor. Es otra sesión, y la
  // arranca SÓLO el micrófono que está al lado de la flecha: sin adjuntos, nada cambia.
  const conAdjuntos = useNotaQueSeManda({ texto, onTexto, onMandar, onError: p.onErrorMic ?? p.voz?.onError });
  const grabandoConAdjuntos = conAdjuntos.grabacion.fase === 'grabando' || !!conAdjuntos.grabacion.revision;
  const grabacion = grabandoConAdjuntos ? conAdjuntos.grabacion : deLaPantalla;
  // La pantalla sabe que la caja está leyendo (y que dejó de leer, también si la caja se va en el medio). Hasta que lo leído le
  // LLEGA (`entregando`): avisar al terminar de leer, un dibujo antes, dejaba una ventana en la que el ticket de Soporte salía sin
  // ese mensaje (la verificación de 5ddf1672a).
  const leyendoParaLaPantalla = leidos.leyendo || leidos.entregando;
  const avisarLeyendo = useRef(p.onLeyendo);
  avisarLeyendo.current = p.onLeyendo;
  useEffect(() => {
    if (!leyendoParaLaPantalla) return;
    avisarLeyendo.current?.(true);
    return () => avisarLeyendo.current?.(false);
  }, [leyendoParaLaPantalla]);
  // Pasando a texto una nota de voz, o leyendo lo adjuntado: la caja está saliendo (el botón gira y no se escribe encima).
  const transcribiendo = !!nota?.transcribiendo || conAdjuntos.transcribiendo;
  const enviando = !!p.enviando || transcribiendo || leidos.leyendo;
  const apagado = !!p.apagado;
  // QUIETA, LO ADJUNTADO NO SE TOCA (28/10/2026, la revisión de 0453923ab): saliendo, apagada o bloqueada, ni se quita nada
  // (la ✕ se apaga) ni entra lo soltado (./juntar-adjuntos.ts → adjuntosQuietos). El navegador igual no abre lo soltado
  // (`alSoltar` lo frena antes).
  const quieto = enviando || apagado || !!p.bloqueo;
  // Y lo soltado con la caja quieta no se pierde callado (la verificación de tren-t): lo dice la pantalla (`onErrorMic`) o la
  // caja, hasta que vuelve a tomar.
  // La espera es sólo de la caja que SALE (enviando, leyendo o pasando una nota): la apagada o bloqueada dice lo de siempre.
  const [enEspera, setEnEspera] = useState(false);
  if (enEspera && !enviando) setEnEspera(false);
  const avisarEspera = () => { if (p.onErrorMic) p.onErrorMic(ESPERA_PARA_ADJUNTAR); else setEnEspera(true); };
  const adjuntos = adjuntosQuietos(deLaCaja, { quieta: quieto, saliendo: enviando, onEspera: avisarEspera, pantallaDiceQueNo: !!p.adjuntos && !p.adjuntos.puede });
  // Lo soltado sobre la conversación (PanelDeChat) también va acá (./soltar-en-la-caja.ts).
  useAvisarAdjuntos(adjuntos);
  /** El botón: gira saliendo un mensaje o mientras MaKo trabaja. El campo sólo se apaga con `enviando` o `apagado`. */
  const girando = enviando || ocupado;
  const propio = useRef<HTMLTextAreaElement | null>(null);
  const caja = p.campo ?? propio;
  /** Dónde va el cursor después de que una lista cambió el texto (la viñeta, el ítem siguiente). */
  const cursor = useRef<number | null>(null);
  /** La capa que pinta los links (17/10/2026): se corre con el scroll del <textarea>. */
  const resalte = useRef<HTMLDivElement | null>(null);
  const conLinks = hayLinks(texto);
  // «Pegar la captura» (24/10/2026, pegar.ts → capturaParaOfrecer): al enfocar el campo, la imagen copiada que todavía no se
  // ofreció aparece arriba de la caja, como en el teclado de Android. Sólo donde la caja adjunta.
  const [captura, setCaptura] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => () => { if (captura) URL.revokeObjectURL(captura.url); }, [captura]);
  const ofrecerCaptura = () => {
    if (!adjuntos?.puede || quieto || captura) return;
    void capturaParaOfrecer(CAPTURAS_VISTAS).then((f) => { if (f) setCaptura({ file: f, url: URL.createObjectURL(f) }); });
  };
  // Con la caja quieta, la captura ofrecida espera (no se dibuja ni se descarta): anotarla como vista sin pegarla la perdía
  // para siempre (la verificación de tren-t).
  const resolverCaptura = (pegar: boolean) => {
    if (!captura || quieto) return;
    CAPTURAS_VISTAS.add(firmaDeCaptura(captura.file));
    if (pegar) adjuntos?.onSumar([captura.file]);
    setCaptura(null);
  };

  // El campo crece con lo que se escribe, y el scroll lo acompaña (18/10/2026, Martín: «la caja crece y el chat no lo
  // acompaña»): la conversación, que se achica cuando la caja crece, sigue abajo si estaba abajo (se mide ANTES de crecer);
  // y el campo, pasado su tope, sigue al cursor (el `height = 'auto'` le reseteaba el scroll). En el teléfono crece el CSS:
  // la hoja sigue abajo si se está escribiendo y se miraba lo último (con el margen de lo que creció).
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const h = p.seguir?.() ?? null;
    if (altoMax != null) {
      const abajo = h ? estaAbajo(h) : false;
      const antes = el.scrollTop;
      el.style.height = 'auto';
      el.style.height = altoDelCampo(el.scrollHeight, altoMax);
      el.scrollTop = el.selectionEnd >= el.value.length ? el.scrollHeight : antes;
      if (h && abajo) h.scrollTop = h.scrollHeight;
    } else if (h && document.activeElement === el && estaAbajo(h, 160)) h.scrollTop = h.scrollHeight;
    if (cursor.current != null) { el.setSelectionRange(cursor.current, cursor.current); cursor.current = null; }
  }, [texto]); // eslint-disable-line react-hooks/exhaustive-deps
  // La frase de la caja TRABADA («Instala MaKo para escribir»), en una caja angosta, ocupa dos renglones: sin volver a medir
  // quedaba cortada a la mitad (11/11/2026, en producción, el chat de Copywriting a 1440: un campo de 104 px junto a «Instalar
  // MaKo»). Se mide cada vez que cambia el ANCHO mientras está trabada: medir sólo al llegar la frase no alcanzó, porque el botón
  // «Instalar MaKo» se carga después (es dinámico) y recién ahí el campo se angosta. Vacío, el alto de un textarea cuenta su
  // placeholder. Sólo el ancho: el alto que se pone acá también dispara al observador.
  // ⚠️ Y TAMBIÉN cuando cambia algo en su FILA (`MutationObserver`): el `ResizeObserver` avisa con los cuadros de dibujo, y en una
  // pestaña de fondo no hay cuadros. Desplegado y medido en producción con la página en segundo plano: el campo midió antes de
  // que llegara el botón y nunca más (40 px con una frase de 61). El de mutaciones avisa igual, y al llegar el botón vuelve a medir.
  useEffect(() => {
    const el = caja.current;
    if (!el || altoMax == null || !p.bloqueo) return;
    let ancho = -1;
    const medir = () => {
      const w = el.getBoundingClientRect().width;
      if (el.value || w === ancho) return;
      ancho = w;
      el.style.height = 'auto';
      el.style.height = altoDelCampo(el.scrollHeight, altoMax);
    };
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    // La fila: el campo vive en `.co-caja__campo`, y ese en la fila (con el «+», los emojis y el botón).
    const fila = el.parentElement?.parentElement ?? null;
    const mo = fila && typeof MutationObserver !== 'undefined' ? new MutationObserver(medir) : null;
    if (fila) mo?.observe(fila, { childList: true, subtree: true });
    return () => { ro?.disconnect(); mo?.disconnect(); };
  }, [p.bloqueo?.frase, altoMax]); // eslint-disable-line react-hooks/exhaustive-deps
  // Montada escondida (el chat del lienzo de Automations, en su ranura con `display: none`), se mide al APARECER: el ancho pasa
  // de 0 a algo (lib/centro-caja.ts → altoDelCampo, el texto que quedaba abajo y cortado, 23/10/2026).
  useEffect(() => {
    const el = caja.current;
    if (!el || altoMax == null || typeof ResizeObserver === 'undefined') return;
    let ancho = el.getBoundingClientRect().width;
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      if (!ancho && w) { el.style.height = 'auto'; el.style.height = altoDelCampo(el.scrollHeight, altoMax); }
      ancho = w;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [altoMax]); // eslint-disable-line react-hooks/exhaustive-deps

  const tecla = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Mientras se compone un acento (IME), Enter es del teclado. Adentro de una lista, Enter arma el ítem siguiente y en
    // uno vacío la corta (lib/centro-caja.ts → enterEnLista). Fuera de una lista: en la computadora manda (Shift+Enter
    // baja de renglón); en el teléfono baja de renglón.
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    const l = enterEnLista(texto, e.currentTarget.selectionStart, e.currentTarget.selectionEnd, { conUno: !p.enterManda });
    if (l) { e.preventDefault(); cursor.current = l.cursor; onTexto(l.texto); return; }
    if (p.enterManda) { e.preventDefault(); onMandar(); }
  };

  const hayQueMandar = !apagado && !p.bloqueo && (!!texto.trim() || !!adjuntos?.items.length || !!p.hayAlgoMas);
  /** Grabando, o con lo grabado para escuchar: la fila es la barra de la grabación. */
  const conBarra = !!grabacion && (grabacion.fase === 'grabando' || !!grabacion.revision || !!p.voz?.pendiente);
  // EL MISMO GESTO (21/10/2026, quinta revisión del onboarding): al mandar, el ➤ se vuelve micrófono EN EL MISMO LUGAR, y
  // un doble toque grababa o dictaba con el segundo (con el pedido de permiso del micrófono a un cliente nuevo). Justo
  // después de mandar, el micrófono queda apagado un instante. Se ajusta DURANTE el render (el patrón de React para «lo que
  // cambió desde el render anterior»): así el DOM ya sale con el botón apagado. Grabar o dictar mientras MaKo trabaja sigue
  // igual, salvo donde la pantalla lo apaga (`voz.apagada`).
  const hayAlgo = hayQueMandar || conBarra;
  const [recien, setRecien] = useState(false);
  const [habia, setHabia] = useState(hayAlgo);
  if (habia !== hayAlgo) {
    setHabia(hayAlgo);
    setRecien(habia && !hayAlgo);
  }
  useEffect(() => {
    if (!recien) return;
    const t = window.setTimeout(() => setRecien(false), MS_MISMO_GESTO);
    return () => window.clearTimeout(t);
  }, [recien]);

  return (
    <>
      {p.arriba}
      {captura && !quieto && (
        <div className="co-caja__captura">
          {/* eslint-disable-next-line @next/next/no-img-element -- una URL `blob:` local, recién copiada */}
          <img className="co-caja__captura-img" src={captura.url} alt="" />
          <button type="button" className="co-caja__captura-pegar" onClick={() => resolverCaptura(true)}>Pegar la captura</button>
          <button type="button" className="co-caja__captura-no" onClick={() => resolverCaptura(false)} aria-label="No pegarla" title="No pegarla">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}
      <ListaAdjuntos a={adjuntos} apagado={quieto} />
      {/* Lo arrastrado sobre la caja entra como adjunto (ticket #16): sin esto, soltar un documento lo ABRÍA en la pestaña. */}
      <div className={p.fila ?? 'co-caja__fila'} data-caja-adjunta={adjuntos ? '' : undefined}
        onDragOver={(e) => { if (adjuntos && traeArchivos(e.dataTransfer)) e.preventDefault(); }}
        onDrop={(e) => { if (!adjuntos || !traeArchivos(e.dataTransfer)) return; e.stopPropagation(); alSoltar(e, adjuntos); }}>
        {conBarra && grabacion ? (
          // El ▶ de escuchar, con el color de la nota de voz ya mandada en el hilo (HiloMako: `--primary`), no el verde de WhatsApp.
          <BarraGrabacion voz={grabacion} ocupado={girando} existente={p.voz?.pendiente ?? null} rotuloEnviar={p.voz?.rotuloEnviar} colorPlay="var(--primary)" />
        ) : (<>
        {/* Sin nada que ofrecer (no se puede adjuntar ahora y no hay más), el «+» queda apagado: abría un panel vacío. */}
        {(adjuntos || p.mas) && <MasCaja a={adjuntos} apagado={quieto || (!adjuntos?.puede && !p.mas)} resumen={null}>{p.mas}</MasCaja>}
        {/* Los emojis, en su botón junto al campo (WhatsApp; Emojis.tsx). */}
        {!p.bloqueo && <BotonEmojis campo={caja} valor={texto} onValor={onTexto} apagado={quieto} />}
        {/* Un link se ve azul mientras se escribe (la capa de abajo) y se abre desde su chip (17/10/2026). */}
        <div className="co-caja__campo">
          {conLinks && <ResalteDeLinks texto={texto} capa={(el) => { resalte.current = el; }} />}
          <textarea
            ref={caja}
            className={conLinks ? 'co-caja__texto--resalte' : undefined}
            onScroll={(e) => { if (resalte.current) resalte.current.scrollTop = e.currentTarget.scrollTop; }}
            rows={1}
            value={texto}
            onChange={(e) => {
              // «- » y «* » al principio de un renglón se vuelven viñeta mientras se escribe (lib/centro-caja.ts).
              const v = conVinetas(e.target.value, e.target.selectionStart);
              if (v.texto !== e.target.value) cursor.current = v.cursor;
              onTexto(v.texto);
            }}
            onKeyDown={tecla}
            onFocus={ofrecerCaptura}
            onPaste={(e) => { p.onPegar?.(e); if (!e.defaultPrevented) alPegar(e, adjuntos); }}
            placeholder={p.bloqueo ? p.bloqueo.frase : transcribiendo ? 'Pasando tu nota a texto…' : p.placeholder}
            aria-label={p.placeholder}
            disabled={quieto}
          />
        </div>
        {p.alFinal}
        {/* Lo adjuntado sin nada escrito: también se puede explicar hablando (ticket #51). */}
        {!p.bloqueo && !enviando && micAlLadoDeLaFlecha({ adjuntos: adjuntos?.items.length ?? 0, texto, hayAlgoMas: p.hayAlgoMas })
          && <BotonGrabar onGrabar={() => void conAdjuntos.grabacion.start()} apagado={quieto || recien || !!p.voz?.apagada} />}
        {/* Bloqueada, lo que la destraba va en el lugar del micrófono. Si no: con nada que mandar, el botón GRABA; con algo, la flecha. */}
        {p.bloqueo ? p.bloqueo.boton : grabacion && !hayQueMandar && !enviando ? (
          <button type="button" className="co-enviar co-enviar--mic" onClick={() => void grabacion.start()} disabled={quieto || recien || !!p.voz?.apagada}
            aria-label="Grabar una nota de voz" title="Grabar una nota de voz">
            <Icon name="mic" size={18} />
          </button>
        ) : (
          <BotonMandar valor={texto} onValor={onTexto} onError={(m) => p.onErrorMic?.(m)} enviando={enviando} ocupado={ocupado} apagado={apagado || recien}
            hayQueMandar={hayQueMandar} onMandar={onMandar} titulo={p.tituloMandar} />
        )}
        </>)}
      </div>
      <LinksDeLaCaja texto={texto} />
      {p.estado !== undefined && <p className="co-caja__estado" aria-live="polite">{p.estado ?? ''}</p>}
      {/* Por qué no salió la nota, si la pantalla no tiene dónde decirlo (`onErrorMic`). */}
      {nota?.error && !p.onErrorMic && <p className="co-caja__estado" role="alert">{nota.error}<ReportarASoporte /></p>}
      {conAdjuntos.error && !p.onErrorMic && !p.voz?.onError && <p className="co-caja__estado" role="alert">{conAdjuntos.error}<ReportarASoporte /></p>}
      {/* Lo adjuntado que no se pudo tomar o leer, con el porqué (./adjuntos-que-se-leen.ts). */}
      {leidos.leyendo && <p className="co-caja__estado" aria-live="polite">Leyendo lo que adjuntaste…</p>}
      {leidos.error && !p.onErrorMic && <p className="co-caja__estado" role="alert">{leidos.error}<ReportarASoporte /></p>}
      {leidos.aviso && <p className="co-caja__estado" aria-live="polite">{leidos.aviso}</p>}
      {enEspera && <p className="co-caja__estado" aria-live="polite">{ESPERA_PARA_ADJUNTAR}</p>}
    </>
  );
}
