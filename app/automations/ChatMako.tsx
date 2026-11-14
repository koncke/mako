'use client';
// =============================================================================
// ChatMako — el chat con MaKo de UNA automatización, y la caja «Pídeselo a MaKo» del modal
// =============================================================================
// Duodécima tanda (12/10/2026, docs/diseno-duodecima-tanda.md §2.5, §2.6 y §3.4). Martín, textual: «tiene que tener
// un chat donde guarda el registro... como hoy lo hace Claude que te saltan una pregunta con tres opciones» y «que se
// guarde un registro tipo chat de las cosas que vos le fuiste pidiendo desde el primer pedido hasta el último».
//
// DECIMOTERCERA TANDA (12/10/2026, el pedido literal en el último hito de app/admin/dev/chatbot/bitacora.ts):
//   · PUNTO 6, «el chat con MaKo... exactamente igual en diseño al de WhatsApp... Solo cambiale unos colores»: el chat
//     ES el hilo de WhatsApp de la casa (`ChatHilo`, app/whatsapp/_shared/ChatHilo.tsx: la cinta de color, la cabecera,
//     el hilo con sus burbujas `BurbujaHilo`, el «escribiendo…» y la barra `ComposerWhatsApp` con el emoji, el
//     micrófono y la ➤). Cambian los colores (el dorado de MaKo en la cinta, las burbujas propias y la ➤) y lo que es
//     de MaKo: la pregunta con sus botones debajo de la burbuja (como los botones de respuesta de WhatsApp), los avisos
//     y las fases. La nota de voz se transcribe y viaja como texto (desde el 24/10/2026 se ve y se escucha al instante, f17).
//   · 23/10/2026 (AU4, Martín por el Cerebro): «Pasá el chat a la caja y el hilo únicos (CajaChat y HiloMako): eso trae el
//     "+", el aire y la criatura». Desde ese día el hilo es `HiloMako` y la caja `CajaChat` (./ChatMakoVista.tsx, con
//     `next/dynamic`), la criatura es la estrella de MaKo, y el «+» adjunta archivos e imágenes: se leen a texto al
//     adjuntarlos (`leerArchivoParaPedido`) y viajan con el pedido (lib/chat-adjuntos-automatizacion.ts).
//   · PUNTO 2, «al enviar no ocurre nada... Me debe crear automáticamente la nueva automatización en la sidebar, y
//     llevarme a ese lienzo... Que dentro aparezca un loader»: la barra del modal ya NO trabaja adentro del modal. Manda
//     el pedido a la tab (`onPedido`), que crea la fila YA (`crearNueva`, la de «Lienzo en blanco») y abre su lienzo
//     con este chat abierto y el pedido puesto (`pedidoInicial`). El chat lo manda solo, como CREAR sobre esa fila
//     (vacía y pausada: la ruta lo exige), y la tab tapa el lienzo mientras tanto (`onTrabajando`).
//   · PUNTO 1, «no se ve el placeholder, y tiene scroll... no aparece más la animación»: ⚠️ el diagnóstico obvio («se
//     borró la animación») era el equivocado. `useEjemploQueSeEscribe` seguía andando; lo que se rompía era el ALTO del
//     campo. La pila de modales pinta el modal con `display: none` en su PRIMER render (`decidirVisible` da false hasta
//     que el efecto lo mete en la pila, app/_components/pila-modales.ts), y el efecto del hijo corre ANTES: medía
//     `scrollHeight = 0`, le ponía `height: 0px` y no volvía a medir hasta que cambiara el texto. El campo quedaba en el
//     relleno, con el ejemplo escribiéndose fuera de la vista y la barra de scroll. Ahora la barra es `ComposerWhatsApp`,
//     que mide con el borde y tiene `minHeight`: un alto de 0 no lo colapsa.
//   · PUNTO 4: el logo de MaKo, no la estrella de texto. Y desde el 17/10/2026 (punto 8 del feedback del 16/10, como el CRM
//     en 8db1e3cbc) el MUÑECO de la tab («Automations», app/admin/operaciones/Muneco.tsx), que trabaja mientras MaKo arma.
//   · PUNTO 7: lo que propone «MaKo te ayuda a escribirlo» en una tarjeta entra a ESTE hilo (lo guarda la ruta del ✦,
//     app/api/chat-agent/redactar/route.ts) con una línea que dice en qué tarjeta se apretó (`tarjeta`). Si el chat
//     está abierto, lo suma al momento (`useEscucharChatMako`, ./chat-mako-eventos.ts).
//
// CADA TURNO VUELVE A MANDAR EL PEDIDO ORIGINAL con las respuestas acumuladas (§3.4): una pregunta termina el stream,
// y la respuesta (un botón, «Elige tú» o «Otra cosa» con su texto) es OTRO POST. Lo que manda cada botón es puro y con
// test (`respuestaMako`, lib/flujo-ia-cliente.ts); qué ronda quedó abierta en un chat guardado, también
// (`rondaAbierta`). El lector del stream es ./stream-ia.ts.
//
// NO decide qué hacer con el resultado: crear ya lo GUARDÓ pausado; editar es un borrador local que el padre aplica con
// UNA foto de deshacer, y el CRON que eligió la persona lo guarda el padre por `action: 'disparadores'`.
//
// ⚠️ NADA INVENTADO: los botones de una pregunta son los rótulos del catálogo TAL CUAL (los arma el server), y el
// valor que viaja es el del catálogo. Acá no se escribe ninguna opción.
//
// LOS PEDIDOS SUELTOS (16/10/2026, docs/diseno-mako-pedidos.md → «El punto de enganche»): ANTES de MaKo, un pedido nuevo
// pasa por POST /api/mako/pedidos. Lo de ESTA automatización sigue a MaKo como siempre (sólo su texto); lo demás
// —«y elimina la otra automatización», «créame otra para los que no pagan», algo de otra tab— queda como burbujas de
// MaKo debajo, con sus botones (./pedidos-chat.ts). Si la ruta falla o tarda, el mensaje entero va a MaKo, como antes.
// Las burbujas son de esta pantalla: no se guardan en el hilo.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { LinkIntegracion } from '@/app/_components/ConectarIntegracion';
import type { CabeceraChat } from '@/app/admin/operaciones/PanelChat';
import { avisarCambioEtiquetas } from '@/app/_components/etiquetas-cliente';
import { transcribirNota } from '@/app/_components/useDictar';
import { PedirAlEquipo } from './PedirAlEquipo';
import { Icon } from '@/app/_components/icons';
import type { HiloMsg } from '@/app/whatsapp/_shared/ChatHilo';
import type { EnMensaje } from '@/app/_chat/HiloMako';
import type { ArchivoHilo, ItemHilo } from '@/app/m/mako/chat-ui';
import type { AdjuntoCaja } from '@/app/admin/operaciones/useCentro';
import type { AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { PEDIDO_SOLO_ADJUNTOS, TOPE_ADJUNTOS_AUTOMATIZACION, type AdjuntoLeido } from '@/lib/chat-adjuntos-automatizacion';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { CajaPedido, ChipCaja, CSS_CAJA_PEDIDO, CSS_TOKENS_CASA, TITULO_CAJA } from '@/app/web-generator/CajaPedido';
import { Ico } from '@/app/web-generator/Ico';
import { GRAMATICA } from '@/lib/mako-gramatica';
import { sanearChat, type MensajeChatMako, type PreguntaMako, type RespuestaMako } from '@/lib/automatizacion-chat';
import { SelectorIntencion, useIntencion } from '@/app/_chat/SelectorIntencion';
import { ordenarAvisos, rondaAbierta, respuestaMako, textoDeCreada, lineaDeListo, CIERRE_EDICION, ELIGE_TU, OTRA_COSA, type EleccionMako, type RondaMako } from '@/lib/flujo-ia-cliente';
import type { PasoGrafo } from '@/lib/flujo-grafo';
import { useStreamIA, RUTA_IA, TOPE_CLIENTE_MS, TEXTO_FASE, ORDEN_FASES, type EstadoIA, type ListoStreamIA } from './stream-ia';
import { cancelarEnElServidor } from './stream-ia';
import { trabajoEnElServidor } from '@/lib/flujo-ia-trabajo-reglas';
import type { FinIA } from './stream-ia';
import { avisarTrabajoTerminado, marcarTrabajoVisto } from '@/lib/mako-trabajos';
import { servicioDeLink } from '@/lib/integracion-en-tab';
import { EJEMPLOS, PLACEHOLDER_QUIETO, ACCEPT_ARCHIVO_FLUJO, pedidoConArchivo, type ListoCrearIA } from './CrearConIA';
import { leerArchivoParaPedido, subirArchivoDelPedido } from './archivo-pedido-cliente';
import { usoDelArchivo, pedidoConContenido, pedidoSinLeer } from '@/lib/archivo-del-pedido';
import { copiaPegada, rotuloFlujoPegado } from '@/lib/flujo-copia';
import { resumenDePegado } from './copia-flujo-cliente';
import { useEscucharChatMako } from './chat-mako-eventos';
import Link from '@/app/_ui/Link';
import {
  cuerpoPedidos, interpretacionDe, textoActual, burbujasDe, vistaDeBurbuja, pulsar, trasEliminar, trasRecuperar, trasCrear,
  alTerminar, paraLienzoVacio, type BurbujaPedido, type EfectoPedido,
} from './pedidos-chat';
// Los POST de los pedidos sueltos viven aparte: este chat no hace POST propios (el stream lo lee sólo ./stream-ia.ts).
import { pedirPedidos, pedirALaLista } from './pedidos-cliente';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { useAppDeEscritorio } from '@/app/_chat/useAppDeEscritorio';
import { useCitaDelChat } from '@/app/_chat/useCitaDelChat';
import { separarCita } from '@/lib/centro-mensajes';

/**
 * LA VISTA (el hilo y la caja únicos, 23/10/2026, AU4) entra con `next/dynamic`: trae el CSS de las piezas únicas, y este
 * archivo lo importan SecuenciaPerfil y la galería, que muchos tests dibujan bajo tsx (ver ChatMakoVista.tsx).
 */
const ChatMakoVista = dynamic(() => import('./ChatMakoVista'), { ssr: false, loading: () => <div data-vista-cargando="" style={{ flex: 1 }} /> });

/** Lo que dice un mensaje que no salió (`noSalio`, stream-ia.ts), con su «Reintentar» al lado (lo pone el hilo único). */
export const NO_SE_ENVIO = 'No se envió';

/** Los colores de MaKo sobre el hilo de WhatsApp (punto 6: «Solo cambiale unos colores»). */
export const COLORES_MAKO = {
  cinta: 'var(--mako)', burbuja: 'var(--mako-bg)', borde: 'var(--mako-border)', enviar: 'var(--mako)',
  fondo: 'color-mix(in srgb, var(--mako-bg) 35%, var(--surface-2))',
} as const;

export type ChatMakoProps = {
  /** La automatización de este chat (su hilo vive en `automatizacion.chat:<id>`). */
  secuenciaId: number;
  /** El borrador LOCAL del lienzo (puede tener cambios sin publicar). VACÍO = MaKo CREA sobre esta fila. */
  pasos: readonly PasoGrafo[];
  /**
   * Cuántas tarjetas tiene lo PUBLICADO. Con alguna, MaKo no crea aunque el borrador esté vacío: crear escribe encima en
   * el server, que contesta 409 (no se pisa un flujo publicado: puede tener leads adentro). Edita sobre el borrador vacío,
   * y lo que arma queda en el borrador hasta Publicar.
   */
  publicadas?: number;
  /** `false` = no lo aplicó (editar sobre un lienzo que cambió): el pedido vuelve a la barra. */
  onListo: (r: ListoCrearIA) => boolean | void;
  /** El ✕ del chat (sin esto, no hay ✕: en Automations el chat está siempre, desde el 20/10/2026). */
  onCerrar?: () => void;
  /**
   * LA «←» DE LA CABECERA (20/10/2026, Martín: «con la flecha para atrás para cambiar a otra automatización»): la sidebar
   * vuelve a la lista. Sin esto, no hay flecha.
   */
  onVolver?: () => void;
  /** Mientras MaKo trabaja: quien monta tapa el lienzo (y deja el chat encima de la capa). */
  onTrabajando?: (trabajando: boolean) => void;
  deshabilitado?: boolean;
  /** El hilo con el que arranca (lo usan las pruebas; el lienzo lo trae por GET). */
  inicial?: readonly MensajeChatMako[];
  /**
   * EL PEDIDO CON EL QUE NACIÓ (punto 2): el de «Pídeselo a MaKo» del modal. Se manda SOLO al montar, una vez; quien
   * monta se entera por `onPedidoInicialUsado` y no lo vuelve a pasar.
   */
  pedidoInicial?: string | null;
  onPedidoInicialUsado?: () => void;
  /** El nombre de esta automatización: los pedidos sueltos la distinguen de «la otra» (`cuerpoPedidos`). */
  nombre?: string;
  /**
   * «Crea otra automatización…» (los pedidos sueltos): la MISMA puerta que «Pídeselo a MaKo». Sin esto, no se ofrece.
   * Contesta si la fila nació: la burbuja no dice «Creada» sin saberlo.
   */
  onCrearOtra?: (pedido: string) => Promise<boolean>;
  /** Se eliminó o volvió OTRA automatización desde una burbuja: la lista se vuelve a leer. */
  onListaCambio?: () => void;
  /**
   * Abre Configuraciones de ESTA automatización (la tuerca del título, SecuenciaPerfil). Con esto, un globo de MaKo que habla
   * de Configuraciones lleva esa misma tuerca, que la abre (24/10/2026, f19: «el ícono de configuraciones no es el correcto»).
   */
  onAbrirConfiguraciones?: () => void;
  /**
   * LO QUE LA PANTALLA LE HACE DECIR A MaKo (20/10/2026): al activarla, por qué sus mensajes quedan para que los apruebes
   * (`POR_QUE_SE_APRUEBAN`, lib/mensajes-por-aprobar.ts). Una vez por `id`; no se guarda en el hilo: lo sigue diciendo la
   * línea de la automatización mientras haya alguno esperando.
   */
  nota?: { id: string; texto: string } | null;
  /**
   * EL TURNO TERMINÓ Y NADIE LO ESTABA MIRANDO (22/10/2026, Martín: «Se debe ejecutar en segundo plano»): la persona se
   * fue a otra tab u otra automatización. Quien monta guarda el resultado (el borrador del lienzo) con lo que tenía al
   * largarlo; el chat ya lo guardó la ruta.
   */
  alTerminarSinVer?: (f: FinIA) => void;
};


/**
 * Lo de esta pantalla que no es del hilo guardado: lo que se escribió sin nada para la abierta, y las burbujas.
 * ⚠️ SIN DEDUPLICAR (17/10/2026): un mensaje repetido trae sus burbujas otra vez. Las de antes se salteaban las «iguales»,
 * y un mensaje mandado dos veces no dejaba ni burbuja ni turno de MaKo: se tragaba.
 */
/**
 * Lo del hilo que vive sólo en esta pantalla: una burbuja de pedidos, o lo que escribió la persona mientras todavía no es un
 * turno (`yo`). 22/10/2026, Martín: «Envío un mensaje y no se ve que se envió... no se ve mi envío hasta que me responde»: lo
 * escrito entra al hilo AL INSTANTE, antes de la vuelta por los pedidos; y si no salió, queda con «Reintentar» (`fallido`).
 */
/**
 * `mako`: lo que contestó MaKo cuando el pedido LLEGÓ y no pudo hacerlo (falta la IA, un tope, el lienzo cambió), con el
 * botón a donde se arregla. 22/10/2026, Martín: «No se envió» sobre su mensaje estaba mal — el mensaje sí llegó, lo que
 * faltaba era la IA. «No se envió» queda sólo cuando de verdad no salió (`noSalio`, stream-ia.ts).
 */
type ExtraChat = {
  id: string; at: string; yo?: string; b?: BurbujaPedido; fallido?: string; mako?: { texto: string; link?: string }; adjuntos?: AdjuntoLeido[];
  /** La nota de voz de este mensaje (f17): se escucha en su globo. `enviando` mientras se transcribe. */
  voz?: VozNota; enviando?: boolean;
};
/** Una nota de voz de ESTA sesión de la pantalla: su audio (para escucharla y para reintentar) y cuánto dura. */
type VozNota = { url: string; secs: number; blob: Blob };
const PREFIJO_EXTRA = 'pedido:';

/** Lo que dice el campo en el lienzo, y con una pregunta abierta (la respuesta escrita es «Otra cosa»). */
export const PLACEHOLDER_EDITAR = 'Pídele un cambio';
export const PLACEHOLDER_OTRA = 'Escribe tu respuesta';
/** El lienzo cambió mientras MaKo trabajaba: el resultado no se aplica (`edicionVigente`). */
export const NO_APLICADO = 'Cambiaste el flujo: pídelo de nuevo';
/** Debajo del nombre, como en WhatsApp. */
export const ESTADO_EN_LINEA = 'en línea';
export const ESTADO_ESCRIBIENDO = 'escribiendo…';
/** La «←» de la cabecera: vuelve a la lista de automatizaciones (20/10/2026). */
export const ROTULO_VOLVER = 'Volver a tus automatizaciones';
/** La línea del hilo que dice de qué tarjeta salió un pedido del ✦ (punto 7). */
export const ROTULO_TARJETA = 'MaKo te ayuda en';
/** Lo que se lee con el hilo vacío. */
export const VACIO_EDITAR = 'Pídele lo que quieras cambiar';
export const VACIO_CREAR = 'Cuéntale qué tiene que pasar';

let cuenta = 0;
/** Un id de mensaje (≤ 80, `sanearMensaje`): único en la pestaña y entre pestañas. */
const nuevoId = (de: 'yo' | 'mako') => `${de}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${(cuenta++).toString(36)}`;

/**
 * LO QUE DICE MaKo AL TERMINAR UNA EDICIÓN: el resumen del server («Cambié 3 · saqué 1 · agregué 2», armado por
 * código) y, si no vino (un server de antes), uno por código con lo que se sabe. Corto.
 */
export function textoDeListo(l: Pick<ListoStreamIA, 'resumen' | 'disparadores' | 'orden'>): string {
  const r = l.resumen?.trim();
  if (r) return r;
  if (l.disparadores?.length) return 'Cambié qué la dispara';
  const n = l.orden.length;
  if (n) return n === 1 ? 'Agregué 1 tarjeta' : `Agregué ${n} tarjetas`;
  return 'Listo';
}

/** El hilo guardado y lo de esta pantalla, sin repetir ids (gana lo guardado, en su orden). */
export function juntarHilo(guardados: readonly MensajeChatMako[], locales: readonly MensajeChatMako[]): MensajeChatMako[] {
  const ids = new Set(guardados.map((m) => m.id));
  return [...guardados, ...locales.filter((m) => !ids.has(m.id))];
}

/**
 * EL HILO COMO LO DIBUJA EL CHAT DE WHATSAPP (`ChatHilo`): cada mensaje en su lado, y ANTES de un pedido que salió del
 * ✦ de una tarjeta, la línea de sistema que lo dice («MaKo te ayuda en «WHATSAPP: Hola…»», punto 7). Pura.
 */
export function hiloDeChat(mensajes: readonly MensajeChatMako[]): HiloMsg[] {
  return mensajes.flatMap((m): HiloMsg[] => [
    ...(m.de === 'yo' && m.tarjeta ? [{ id: `${m.id}:tarjeta`, fromMe: false, tipo: 'sistema', texto: `${ROTULO_TARJETA} «${m.tarjeta}»` }] : []),
    { id: m.id, fromMe: m.de === 'yo', texto: m.texto, fecha: m.at, autor: m.de === 'mako' ? 'MaKo' : null },
  ]);
}


/** ¿La tecla nace en un campo de texto? (la lista y su buscador siguen andando mientras MaKo trabaja). */
const esCampo = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');

export function ChatMako(p: ChatMakoProps) {
  const crea = p.pasos.length === 0 && !(p.publicadas ?? 0);
  const [mensajes, setMensajes] = useState<MensajeChatMako[]>(() => [...(p.inicial ?? [])]);
  /** La ronda que espera respuesta (la pregunta de ahora, el pedido original y lo ya contestado). */
  const [ronda, setRonda] = useState<RondaMako | null>(() => rondaAbierta(p.inicial ?? []));
  const [error, setError] = useState<{ texto: string; link?: string } | null>(null);
  /**
   * «DISCUTIR» O «EDITAR» (22/10/2026, la llamada con Mauricio: «como Lovable: un botón de discutir y otro de editar»).
   * Editar hace lo pedido al pie de la letra; Discutir contesta y sugiere sin tocar el lienzo. La regla vive en
   * lib/flujo-ia-intencion.ts. Arranca en Editar (Mauricio: «que obedezca»), y se recuerda por persona en el navegador.
   * Desde el 24/10/2026 el selector y su memoria son los compartidos (app/_chat/SelectorIntencion.tsx): el mismo del
   * editor web, con la misma clave guardada.
   */
  const [intencion, elegirIntencion] = useIntencion();
  // Sin la app de escritorio no sale nada (25/10/2026, «En ningun chat, no solo en Ops Center»): la caja lo dibuja (`bloqueo`,
  // que viaja en `caja` a ChatMakoVista) y acá se corta también lo que no pasa por ella (el pedido que llega de la galería).
  const appEscritorio = useAppDeEscritorio();
  const sinApp = appEscritorio.bloqueada;
  /** Lo que vuelve a la barra cuando un pedido que no nació en ella no salió (`ChatHilo.ponerBorrador`). */
  const [devolver, setDevolver] = useState<{ texto: string; vez: number } | null>(null);
  /** Lo que se hace con un turno que terminó y que largó OTRA instancia (se fue y volvió): se arma más abajo. */
  const adoptarRef = useRef<(f: FinIA) => void>(() => {});
  const { estado, trabajando, enviar, cancelar: cortarElPedido } = useStreamIA(`chat:${p.secuenciaId}`, (f) => adoptarRef.current(f));
  /**
   * «CANCELAR» CORTA EL TRABAJO DEL SERVIDOR (14/11/2026, la llamada con Julio). Crear sobre esta fila ya no se corta con la
   * pestaña que se cierra; Cancelar (el botón y el Escape), además de cortar el pedido, deja la marca que el trabajo mira
   * (`cancelarEnElServidor`).
   */
  const cancelar = useCallback(() => {
    if (crea) cancelarEnElServidor(p.secuenciaId);
    cortarElPedido();
  }, [crea, cortarElPedido, p.secuenciaId]);
  /** Lo de esta pantalla (los pedidos sueltos). El ref es la verdad sincrónica: dos clics en el mismo tick no repiten. */
  const [extras, setExtras] = useState<ExtraChat[]>([]);
  const extrasRef = useRef<ExtraChat[]>([]);
  const ponerExtras = useCallback((f: (xs: ExtraChat[]) => ExtraChat[]) => { extrasRef.current = f(extrasRef.current); setExtras(extrasRef.current); }, []);
  /** La nota de voz de cada mensaje propio de esta sesión, por su id (f17): el hilo la dibuja en su globo. */
  const voces = useRef(new Map<string, VozNota>());
  /** Mientras la ruta de los pedidos contesta (el «escribiendo…» de MaKo). */
  const [interpretando, setInterpretando] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const raizRef = useRef<HTMLDivElement | null>(null);
  /** Turnos hechos en esta pantalla: si ya hubo uno, el GET no pisa la ronda de acá. */
  const turnos = useRef(0);
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  /**
   * ⚠️ EL `onListo` DE AHORA, NO EL DEL CLIC (revisión, 09/10/2026). El turno cierra sobre las props del render en que
   * se hizo clic: llamar a `p.onListo` al terminar llamaba al del padre de hace un minuto, con SU `pasos` de entonces,
   * y la comparación con el lienzo de ahora daba siempre igual. El ref se actualiza en cada render.
   */
  const onListoRef = useRef(p.onListo);
  useEffect(() => { onListoRef.current = p.onListo; });

  // La nota de la pantalla (`nota`): una vez por id, como un turno de MaKo de esta pantalla.
  const notaDicha = useRef<string | null>(null);
  const nota = p.nota ?? null;
  useEffect(() => {
    if (!nota || notaDicha.current === nota.id) return;
    notaDicha.current = nota.id;
    setMensajes((ms) => [...ms, { id: nota.id, de: 'mako', texto: nota.texto, at: new Date().toISOString(), via: 'app' }]);
  }, [nota]);

  // El reloj de lo que lleva (progreso real, no decorativo). Corre sólo mientras trabaja.
  useEffect(() => {
    if (!trabajando) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [trabajando]);
  // Quien monta tapa el lienzo mientras MaKo trabaja (y lo destapa si el chat se desmonta en el medio).
  const onTrabajandoRef = useRef(p.onTrabajando);
  useEffect(() => { onTrabajandoRef.current = p.onTrabajando; });
  useEffect(() => { onTrabajandoRef.current?.(trabajando); }, [trabajando]);
  useEffect(() => () => { onTrabajandoRef.current?.(false); }, []);

  // EL CHAT GUARDADO: GET ?secuenciaId=. Si falla, el hilo arranca vacío y nada se bloquea. Una fila que acaba de nacer
  // con un pedido (`pedidoInicial`) no tiene chat todavía: no se pide (la ruta escribe el turno mientras tanto).
  const secId = p.secuenciaId;
  const conPedido = !!p.pedidoInicial?.trim();
  /** Mientras MaKo la sigue armando en el servidor (ver `enServidor`, abajo): el GET que trae su respuesta la recarga. */
  const enServidorRef = useRef(false);
  const traerChat = useCallback(async (sigue: () => boolean = () => vivo.current) => {
    try {
      const r = await fetch(`${RUTA_IA}?secuenciaId=${secId}`, { cache: 'no-store' });
      const j = await r.json().catch(() => null) as { ok?: boolean; mensajes?: unknown } | null;
      if (!sigue() || !r.ok || !j?.ok) return;
      const guardados = sanearChat({ v: 1, mensajes: j.mensajes }).mensajes;
      // TERMINÓ EN EL SERVIDOR: el lienzo de esta pantalla nació vacío, así que se recarga entera (las tarjetas, el CRON y el
      // nombre los trae la página, como al abrirla; una pregunta o un «no pude» los muestra el chat al volver a leerse).
      if (enServidorRef.current && !trabajoEnElServidor(guardados, Date.now())) { window.location.reload(); return; }
      if (!guardados.length) return;
      setMensajes((locales) => juntarHilo(guardados, locales));
      if (!turnos.current) setRonda(rondaAbierta(guardados));
    } catch { /* sin chat guardado: arranca vacío */ }
  }, [secId]);
  useEffect(() => {
    // Volvió a esta automatización: lo que MaKo terminó mientras no estaba ya se ve (sale del globito de la estrella).
    marcarTrabajoVisto(`/automations?sec=${secId}`);
    if (conPedido) return;
    let sigue = true;
    void traerChat(() => sigue);
    return () => { sigue = false; };
    // Una vez por automatización (el pedido inicial sólo decide la primera).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secId]);

  /**
   * MaKo LA SIGUE ARMANDO EN EL SERVIDOR (14/11/2026, la llamada con Julio): se recargó o se cerró la pestaña mientras creaba.
   * El chat guardado termina en el pedido de la persona, reciente y sin respuesta (`trabajoEnElServidor`), y esta pantalla no
   * tiene un turno en vuelo. Se dice eso arriba de la barra, no se larga otro pedido encima, y se mira cada pocos segundos:
   * cuando hay tarjetas, se recarga; si MaKo preguntó o no pudo, su mensaje entra al hilo como siempre.
   */
  const [ahoraServidor, setAhoraServidor] = useState(() => Date.now());
  const enServidor = crea && !trabajando && trabajoEnElServidor(mensajes, ahoraServidor);
  useEffect(() => { enServidorRef.current = enServidor; }, [enServidor]);
  useEffect(() => {
    if (!enServidor) return;
    const t = setInterval(() => { setAhoraServidor(Date.now()); void traerChat(); }, 4_000);
    return () => clearInterval(t);
  }, [enServidor, traerChat]);

  // LO QUE ENTRÓ POR EL ✦ DE UNA TARJETA (punto 7) mientras el chat está montado: al hilo, sin repetir.
  useEscucharChatMako(secId, useCallback((ms: MensajeChatMako[]) => setMensajes((locales) => juntarHilo(locales, ms)), []));

  /**
   * ⚠️ MIENTRAS TRABAJA, EL TECLADO NO LLEGA AL LIENZO (tercera tanda, punto 6). La capa de quien monta se traga los
   * clics, pero un atajo vive en `document` (el deshacer del lienzo, Suprimir sobre una tarjeta): se corta en CAPTURA
   * lo que no nace en el chat ni en un campo de texto. Escape cancela, igual que el botón, y sólo cuando el botón está
   * (en «Verificando» el server ya no mira la señal).
   */
  const fase = estado.t === 'trabajando' ? estado.fase : null;
  useEffect(() => {
    if (!trabajando) return;
    const alTeclado = (e: KeyboardEvent) => {
      const raiz = raizRef.current;
      const adentro = !!raiz && e.target instanceof Node && raiz.contains(e.target);
      // ⚠️ ESCAPE NO CANCELA LO QUE NO SE VE (revisión del 20/10/2026). Con «←» la ranura del chat se ESCONDE (no se
      // desmonta) y el pedido sigue en vuelo: un Escape para cerrar un modal, un desplegable o el buscador de la lista lo
      // cortaba sin que se viera, y al volver el pedido no estaba. Con el chat escondido, o con un diálogo o menú abierto
      // afuera del chat (y el Escape no nace en el chat), el Escape es de ellos.
      const oculto = !raiz || raiz.getClientRects().length === 0;
      const otroAbierto = !adentro && [...document.querySelectorAll('[role="dialog"], [role="menu"], [role="listbox"]')].some((n) => !raiz?.contains(n));
      if (e.key === 'Escape' && (oculto || otroAbierto)) return;
      if (e.key === 'Escape' && fase !== 'revision') { e.preventDefault(); e.stopImmediatePropagation(); cancelar(); return; }
      if (adentro) return;
      if (esCampo(e.target)) return;
      // Sin `preventDefault`: los atajos del NAVEGADOR siguen andando; lo que se corta es que lleguen a los de la app.
      e.stopImmediatePropagation();
    };
    document.addEventListener('keydown', alTeclado, true);
    return () => document.removeEventListener('keydown', alTeclado, true);
  }, [trabajando, fase, cancelar]);

  /** Lo que volvió de la ruta, al lienzo de quien monta (`onListo`). `false` = no lo aplicó (el lienzo cambió). */
  const aplicarListo = (l: ListoStreamIA, base: readonly PasoGrafo[] | undefined): boolean | void => {
    // ⚠️ LAS ETIQUETAS QUE CREÓ EL SERVER (revisión, 09/10/2026): `crearEtiqueta` corre en la ruta, no pasa por
    // `crearEtiquetaCliente`, y las listas de la pestaña ya estaban pedidas. Va ANTES de `onListo`: las tarjetas nuevas
    // se dibujan con la lista nueva.
    if (l.etiquetasNuevas.length) avisarCambioEtiquetas();
    return onListoRef.current({
      modo: l.modo, secuenciaId: l.secuenciaId, pasos: l.pasos, nombre: l.nombre, orden: l.orden,
      avisos: l.avisos, etiquetasNuevas: l.etiquetasNuevas, disparador: l.disparador ?? null, base,
      // El horario de un Recurrente (20/10/2026): sin él, la tarjeta CRON se sembraba sin horario.
      ...(l.cron ? { cron: l.cron } : {}),
      ...(l.resumen !== undefined ? { resumen: l.resumen } : {}),
      ...(l.cambiadas ? { cambiadas: l.cambiadas } : {}),
      ...(l.quitadas ? { quitadas: l.quitadas } : {}),
      ...(l.disparadores !== undefined ? { disparadores: l.disparadores } : {}),
      ...(l.pregunta ? { pregunta: l.pregunta } : {}),
    });
  };

  /**
   * SE FUE Y VOLVIÓ CON MaKo TRABAJANDO (22/10/2026): mientras tanto el chat mostró lo que iba (el estado lo trae
   * `useStreamIA` de la clave); al terminar, el resultado va al lienzo de ahora y el hilo se relee (la ruta guardó el
   * turno y la respuesta de MaKo).
   */
  adoptarRef.current = (f: FinIA) => {
    if (!vivo.current) return;
    void traerChat();
    if (f.t === 'listo') aplicarListo(f.listo, p.pasos);
  };

  /**
   * UN TURNO: lo que dijo la persona entra al hilo YA y sale el POST con el pedido ORIGINAL de la ronda y las
   * respuestas acumuladas. Cancelar o un error lo sacan del hilo; lo escrito vuelve a la barra (lo devuelve el hilo de
   * WhatsApp con `{ error }`, o `devolver` si no nació en la barra). El próximo ➤ es reintentar.
   *   · `origen: 'barra'` — lo escribió en la barra (ChatHilo lo devuelve solo);
   *   · `origen: 'afuera'` — el pedido con que nació la fila, o una nota de voz transcrita (lo devuelve `devolver`);
   *   · `origen: 'boton'` — una opción de una pregunta (la pregunta sigue viva: se vuelve a tocar).
   */
  const turno = async (dicho: string, respuesta: RespuestaMako | null, origen: 'barra' | 'afuera' | 'boton', pedido?: string, adj: AdjuntoLeido[] = [], voz?: VozNota): Promise<true | { error: string | null }> => {
    // Con MaKo armándola en el servidor (`enServidor`), otro pedido encima chocaría con el que sigue: espera a que termine.
    if (enServidor) return origen === 'barra' ? { error: null } : true;
    if (trabajando || p.deshabilitado || sinApp) return origen === 'barra' ? { error: null } : true;
    const yo: MensajeChatMako = {
      id: nuevoId('yo'), de: 'yo', texto: dicho, at: new Date().toISOString(), via: 'app', ...(respuesta ? { respuesta } : {}),
      ...(adj.length ? { adjuntos: adj.map((a) => a.nombre) } : {}),
    };
    if (voz) voces.current.set(yo.id, voz);
    // `pedido`: lo de ESTA automatización cuando el mensaje traía algo más (los pedidos sueltos); en el hilo queda lo dicho.
    const enCurso = respuesta && ronda
      ? { pedido: ronda.pedido, respuestas: [...ronda.respuestas, respuesta] }
      : { pedido: pedido ?? dicho, respuestas: [] as RespuestaMako[] };
    turnos.current += 1;
    setMensajes((ms) => [...ms, yo]); setError(null); setAhora(Date.now());
    // Con el lienzo VACÍO, MaKo CREA sobre esta fila (la ruta exige que siga vacía y pausada); con tarjetas, EDITA el
    // borrador que se manda (vuelve en `onListo` como `base`).
    const modo = crea ? 'crear' : 'editar';
    const base = modo === 'editar' ? p.pasos : undefined;
    // Si la persona se va antes de que termine (otra tab, otra automatización), el turno sigue (stream-ia.ts) y lo que
    // vuelva lo guarda quien monta (`alTerminarSinVer`, el borrador) y queda avisado para la estrella de la tab donde esté.
    const alTerminarSinVer = p.alTerminarSinVer;
    const titulo = p.nombre?.trim() || 'Tu automatización';
    const siNadieMira = (f: FinIA) => {
      alTerminarSinVer?.(f);
      if (f.t === 'cancelado') return;
      avisarTrabajoTerminado({
        tab: 'Automations', titulo, href: `/automations?sec=${p.secuenciaId}`, ok: f.t !== 'error',
        texto: f.t === 'error' ? f.error : f.t === 'pregunta' ? f.pregunta.texto
          : f.listo.modo === 'crear' ? (f.listo.texto ?? textoDeCreada(f.listo.nombre)) : textoDeListo(f.listo),
      });
    };
    const fin = await enviar({
      pedido: enCurso.pedido, modo, respuestas: enCurso.respuestas, secuenciaId: p.secuenciaId,
      ...(base ? { pasos: base } : {}),
      // El hilo de ANTES del turno. La ruta guarda el turno y busca ahí la pregunta que se contesta: el rótulo del «yo» y
      // el «Elige tú» del CRON (`respuestaDelCron`). Con el turno al final, `turnoDelUsuario` creía que ya estaba.
      historial: mensajes,
      // Discutir / Editar sólo cuando hay tarjetas: con el lienzo vacío MaKo CREA.
      ...(modo === 'editar' ? { intencion } : {}),
      // Lo adjuntado con el «+», ya leído (AU4: lib/chat-adjuntos-automatizacion.ts).
      ...(adj.length ? { adjuntos: adj } : {}),
    }, { siNadieMira });
    if (!vivo.current) return true;
    /**
     * LLEGÓ Y MaKo NO PUDO (falta la IA, un tope, el lienzo cambió): el mensaje queda ENVIADO en el hilo y la respuesta de
     * MaKo dice por qué, con su botón (22/10/2026, Martín). La ruta ya la guardó en el chat.
     */
    const respondeMako = (e: { texto: string; link?: string }): true => {
      setError(null);
      ponerExtras((xs) => [...xs, { id: `${PREFIJO_EXTRA}${nuevoId('mako')}`, at: new Date().toISOString(), mako: e }]);
      return true;
    };
    const deshacer = (e: { texto: string; link?: string } | null): true | { error: string | null } => {
      setMensajes((ms) => ms.filter((m) => m.id !== yo.id));
      setError(e);
      // ⚠️ SI NO SALIÓ, QUEDA EN EL HILO CON «Reintentar» (22/10/2026, Cerebro, con lo de Martín: lo escrito se ve al instante;
      // «si falla, queda marcado con Reintentar»). Antes se borraba del hilo y volvía a la barra. Cancelar no es un fallo: eso
      // sí vuelve a la barra, como siempre. Una opción tocada (`boton`) sigue viva en su pregunta: se vuelve a tocar.
      if (e && origen !== 'boton') {
        ponerExtras((xs) => [...xs, { id: `${PREFIJO_EXTRA}${yo.id}`, at: yo.at, yo: dicho, fallido: e.texto, ...(adj.length ? { adjuntos: adj } : {}), ...(voz ? { voz } : {}) }]);
        return true;
      }
      if (origen === 'barra') return { error: null };
      if (origen === 'afuera') setDevolver((d) => ({ texto: dicho, vez: (d?.vez ?? 0) + 1 }));
      return true;
    };
    // Cancelar no es un error: lo escrito vuelve a la barra.
    if (fin.t === 'cancelado') return deshacer(null);
    // «No se envió · Reintentar» SÓLO si el pedido no llegó a la ruta; si llegó, lo dice MaKo.
    if (fin.t === 'error' && fin.noSalio) return deshacer({ texto: fin.error, ...(fin.link ? { link: fin.link } : {}) });
    if (fin.t === 'error') return respondeMako({ texto: fin.error, ...(fin.link ? { link: fin.link } : {}) });
    if (fin.t === 'pregunta') {
      setMensajes((ms) => [...ms, fin.mensaje]);
      setRonda({ ...enCurso, pregunta: fin.pregunta });
      return true;
    }
    const l = fin.listo;
    const aplicado = aplicarListo(l, base);
    if (!vivo.current) return true;
    // Si el padre no lo aplicó (el lienzo cambió en el medio): el pedido llegó, MaKo lo dice.
    if (aplicado === false) return respondeMako({ texto: NO_APLICADO });
    // «¿Cambio qué la dispara?» (§2.6): una ronda NUEVA sobre el mismo pedido (su respuesta no vuelve a editar).
    setRonda(l.pregunta ? { pedido: enCurso.pedido, respuestas: [], pregunta: l.pregunta } : null);
    const avisos = ordenarAvisos(l.avisos ?? []);
    setMensajes((ms) => [...ms, {
      // Crear: lo que armó el server con lo guardado (cuándo sale, a quién y qué manda, 20/10/2026); uno de antes, el corto.
      id: nuevoId('mako'), de: 'mako', texto: l.modo === 'crear' ? (l.texto ?? textoDeCreada(l.nombre)) : textoDeListo(l), at: new Date().toISOString(), via: 'app',
      ...(avisos.length ? { avisos } : {}), ...(l.pregunta ? { pregunta: l.pregunta } : {}),
      // Las cuentas (para el «✓ Listo» de una línea) y lo pedido que no se hizo (en rojo), como lo guarda la ruta.
      ...(l.modo === 'editar' && l.cambiadas ? { cambios: { cambiadas: l.cambiadas.length, quitadas: l.quitadas?.length ?? 0, agregadas: l.orden.length } } : {}),
      ...(l.noHecho?.length ? { noHecho: l.noHecho } : {}),
      // Lo que pidió y no está en MaKo (f23): el globo ofrece pasárselo al equipo.
      ...(l.falta ? { falta: l.falta } : {}),
      // Y qué IA lo contestó (27/10/2026), como lo guarda la ruta.
      ...(l.ia ? { ia: l.ia } : {}),
    }]);
    return true;
  };

  // EL PEDIDO CON EL QUE NACIÓ LA FILA (punto 2), una vez por pedido. En un `setTimeout` y no en el cuerpo del
  // efecto: en desarrollo React desmonta y vuelve a montar los efectos, y el desmonte de `useStreamIA` cortaba el
  // pedido recién salido.
  const pedidoUsado = useRef<string | null>(null);
  const turnoRef = useRef(turno);
  useEffect(() => { turnoRef.current = turno; });
  const avisoUsado = useRef(p.onPedidoInicialUsado);
  useEffect(() => { avisoUsado.current = p.onPedidoInicialUsado; });
  const pedidoInicial = p.pedidoInicial?.trim() || null;
  useEffect(() => {
    if (!pedidoInicial || pedidoUsado.current === pedidoInicial) return;
    const h = setTimeout(() => {
      if (pedidoUsado.current === pedidoInicial) return;
      pedidoUsado.current = pedidoInicial;
      avisoUsado.current?.();
      void turnoRef.current(pedidoInicial, null, 'afuera');
    }, 0);
    return () => clearTimeout(h);
  }, [pedidoInicial]);

  /** ➤ (o Enter): con una pregunta abierta, lo escrito ES «Otra cosa»; si no, un pedido nuevo. */
  const enviarTexto = async (texto: string, origen: 'barra' | 'afuera', adj: AdjuntoLeido[] = [], voz?: VozNota): Promise<true | { error: string | null }> => {
    const t = texto.trim() || (adj.length ? PEDIDO_SOLO_ADJUNTOS : '');
    if (!t) return true;
    if (ronda) { const r = respuestaMako(ronda.pregunta, { texto: t }); return turno(r.texto, r.respuesta, origen, undefined, adj, voz); }
    // Ocupado (MaKo trabajando, el chat apagado) o sin automatización: lo de siempre (el turno lo devuelve a la barra).
    // Con algo adjuntado, es para ESTA automatización: no pasa por los pedidos sueltos.
    if (trabajando || p.deshabilitado || interpretando || adj.length) return turno(t, null, origen, undefined, adj, voz);
    // LO ESCRITO ENTRA AL HILO YA (22/10/2026, Martín: «no se ve mi envío hasta que me responde»): la vuelta por los pedidos
    // tarda hasta ~8 s y mientras tanto sólo se veían los tres puntos. Entra como un extra; cuando arranca el turno, el turno
    // lo pone en el hilo de verdad y el extra se va en el MISMO render (sin parpadeo).
    const enviado: ExtraChat = { id: `${PREFIJO_EXTRA}${nuevoId('yo')}`, at: new Date().toISOString(), yo: t, ...(voz ? { voz } : {}) };
    ponerExtras((xs) => [...xs, enviado]);
    const sinEnviado = (xs: ExtraChat[]) => xs.filter((x) => x.id !== enviado.id);
    // LOS PEDIDOS SUELTOS: qué es de ESTA automatización y qué no. Sin respuesta útil, todo es de ésta (cero regresión).
    setInterpretando(true);
    // Lo que se interpreta es lo ESCRITO, sin la cita de «Responder» (lib/centro-mensajes.ts, `separarCita`): con el renglón
    // citado adentro, citar «Archiva la automatización» y escribir «mejor no» la archivaba. La parte de ésta vuelve con su cita.
    const { pedido: lemos, conCita } = separarCita(t);
    const crudo = await pedirPedidos(cuerpoPedidos(lemos, p.secuenciaId, p.nombre ?? ''));
    if (!vivo.current) return true;
    setInterpretando(false);
    // Con el lienzo VACÍO, «crea una automatización…» es el pedido para ÉSTA, no una burbuja (`paraLienzoVacio`).
    const leida = interpretacionDe(crudo, lemos);
    const i = crea ? paraLienzoVacio(leida, lemos) : leida;
    const nuevas = burbujasDe(i, p.secuenciaId).filter((b) => b.tipo !== 'crear' || !!p.onCrearOtra);
    const actual = conCita(textoActual(i));
    if (!nuevas.length) { ponerExtras(sinEnviado); return turno(t, null, origen, actual ?? undefined, [], voz); }
    // Lo escrito queda en el hilo; las burbujas, debajo.
    const base = Date.now();
    const burbujas = nuevas.map((b, k): ExtraChat => ({ id: `${PREFIJO_EXTRA}${nuevoId('mako')}`, at: new Date(base + 1 + k).toISOString(), b }));
    if (!actual) {
      // Nada de esta automatización: MaKo no trabaja. Lo escrito ya está en el hilo (sólo en esta pantalla).
      ponerExtras((xs) => [...xs, ...burbujas]);
      return true;
    }
    ponerExtras((xs) => [...sinEnviado(xs), ...burbujas]);
    return turno(t, null, origen, actual, [], voz);
  };

  /**
   * «Reintentar» de un mensaje que no salió: se saca del hilo y se manda otra vez, como si se escribiera de nuevo. Una nota de
   * voz que no se pudo entender se vuelve a transcribir; una que sí, sale con lo entendido y sigue con su audio.
   */
  const reintentar = (id: string, texto: string) => {
    if (trabajando || interpretando) return;
    const x = extrasRef.current.find((e) => e.id === id);
    ponerExtras((xs) => xs.filter((e) => e.id !== id));
    setError(null);
    if (x?.voz && !texto.trim()) { URL.revokeObjectURL(x.voz.url); void enviarAudio(x.voz.blob, x.voz.secs); return; }
    void enviarTexto(texto, 'afuera', x?.adjuntos ?? [], x?.voz);
  };

  /** Lo que pide un clic en una burbuja: crear por la puerta de «Pídeselo a MaKo», eliminar o recuperar por la de la lista. */
  const efectuar = async (id: string, ef: EfectoPedido | null) => {
    if (!ef) return;
    const cambiar = (f: (b: BurbujaPedido) => BurbujaPedido) => ponerExtras((xs) => xs.map((x) => (x.id === id && x.b ? { ...x, b: f(x.b) } : x)));
    if (ef.tipo === 'agregar') {
      ponerExtras((xs) => [...xs, { id: `${PREFIJO_EXTRA}${nuevoId('mako')}`, at: new Date().toISOString(), b: ef.burbuja }]);
      return;
    }
    if (ef.tipo === 'crear') {
      if (!p.onCrearOtra) { cambiar((b) => trasCrear(b, false)); return; }
      // «Creada» sólo si la fila nació. Si nació, el lienzo cambia a la nueva y este chat se desmonta.
      const ok = await p.onCrearOtra(ef.pedido).catch(() => false);
      if (!vivo.current) return;
      cambiar((b) => trasCrear(b, ok));
      return;
    }
    const ok = await pedirALaLista(ef.cuerpo);
    if (!vivo.current) return;
    cambiar((b) => (ef.tipo === 'eliminar' ? trasEliminar(b, ok) : trasRecuperar(b, ok)));
    if (ok) p.onListaCambio?.();
  };
  /** Un botón de una burbuja: se lee la burbuja del REF (sincrónico) y no la del render. */
  const tocarBurbuja = (id: string, boton: string) => {
    const x = extrasRef.current.find((e) => e.id === id);
    if (!x?.b) return;
    const r = pulsar(x.b, boton, p.secuenciaId, { trabajando });
    ponerExtras((xs) => xs.map((e) => (e.id === id ? { ...e, b: r.burbuja } : e)));
    void efectuar(id, r.efecto);
  };
  // MaKo terminó con esta automatización: una creación que esperaba («Sí» mientras trabajaba) sale ahora.
  useEffect(() => {
    if (trabajando) return;
    for (const x of extrasRef.current) {
      if (!x.b) continue;
      const r = alTerminar(x.b);
      if (!r.efecto) continue;
      ponerExtras((xs) => xs.map((e) => (e.id === x.id ? { ...e, b: r.burbuja } : e)));
      void efectuar(x.id, r.efecto);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trabajando]);
  /**
   * LA NOTA DE VOZ SALE YA Y SE ESCUCHA (24/10/2026, f17 de la llamada con Leandro: «se envió tipo transcripto cuando ahí en el
   * chat mismo se debería poder escuchar el audio... cuando le das a enviar audio se tiene que enviar automáticamente, no
   * esperar a transcribirlo»). El globo con el audio entra al hilo en el acto («enviando» mientras se transcribe: MaKo lee
   * texto), y debajo queda lo que se entendió. Hasta ese día no se veía nada hasta transcribirla, y salía como texto. Como
   * el chat del lead (app/crm/lead-view/MakoAnalystLead.tsx). El audio es de esta sesión: al recargar queda lo entendido.
   */
  const enviarAudio = async (blob: Blob, secs: number): Promise<void> => {
    setError(null);
    const voz: VozNota = { url: URL.createObjectURL(blob), secs, blob };
    const nota: ExtraChat = { id: `${PREFIJO_EXTRA}${nuevoId('yo')}`, at: new Date().toISOString(), yo: '', voz, enviando: true };
    ponerExtras((xs) => [...xs, nota]);
    const r = await transcribirNota(blob);
    if (!vivo.current) return;
    if (!r.ok || !r.texto.trim()) {
      // No se entendió: queda en el hilo con «Reintentar», que la vuelve a transcribir.
      ponerExtras((xs) => xs.map((x) => (x.id === nota.id ? { ...x, enviando: false, fallido: r.ok ? 'No se entendió el audio' : r.error } : x)));
      return;
    }
    // Lo entendido pasa a ser el mensaje: este globo se va en el MISMO render en que entra el del pedido (con el audio).
    ponerExtras((xs) => xs.filter((x) => x.id !== nota.id));
    await enviarTexto(r.texto, 'afuera', [], voz);
  };
  const elegir = (e: EleccionMako) => {
    if (!ronda) return;
    const r = respuestaMako(ronda.pregunta, e);
    void turno(r.texto, r.respuesta, 'boton');
  };

  // ── LA CAJA ÚNICA (23/10/2026, AU4): lo escrito, con su borrador por automatización, y lo adjuntado con el «+» ──
  const [texto, setTexto] = useState('');
  const claveBorrador = `mako-chat:${secId}`;
  useEffect(() => { try { setTexto(localStorage.getItem(claveBorrador) ?? ''); } catch { /* sin almacenamiento */ } }, [claveBorrador]);
  useEffect(() => { try { if (texto) localStorage.setItem(claveBorrador, texto); else localStorage.removeItem(claveBorrador); } catch { /* idem */ } }, [texto, claveBorrador]);
  // Lo que vuelve a la caja (un pedido que no nació en ella y no salió): era `ChatHilo.ponerBorrador`.
  useEffect(() => { if (devolver) setTexto(devolver.texto); }, [devolver]);
  const [adjuntos, setAdjuntos] = useState<AdjuntoCaja[]>([]);
  const adjuntosRef = useRef<AdjuntoCaja[]>([]);
  /** Lo LEÍDO de cada uno (`leerArchivoParaPedido`: la ruta lo pasa a texto con `archivoATexto`), por id. */
  const leidos = useRef(new Map<string, string>());
  const ponerAdjuntos = (l: AdjuntoCaja[]) => { adjuntosRef.current = l; setAdjuntos(l); };
  const sumarAdjuntos = (fs: File[]) => {
    const lugar = TOPE_ADJUNTOS_AUTOMATIZACION - adjuntosRef.current.length;
    if (lugar <= 0) { setError({ texto: `Hasta ${TOPE_ADJUNTOS_AUTOMATIZACION} archivos por mensaje.` }); return; }
    const nuevos = fs.slice(0, lugar).map((file): AdjuntoCaja => ({
      id: nuevoId('yo'), file, tipo: file.type.startsWith('image/') ? 'image' : 'document', url: URL.createObjectURL(file), estado: 'leyendo',
    }));
    ponerAdjuntos([...adjuntosRef.current, ...nuevos]);
    for (const a of nuevos) {
      void leerArchivoParaPedido(a.file).then((r) => {
        if (!vivo.current || !adjuntosRef.current.some((x) => x.id === a.id)) return;
        if (r.ok) leidos.current.set(a.id, r.texto); else setError({ texto: `«${a.file.name}»: ${r.error}` });
        ponerAdjuntos(adjuntosRef.current.map((x) => (x.id === a.id ? (r.ok ? { id: x.id, file: x.file, tipo: x.tipo, url: x.url } : { ...x, estado: 'error' }) : x)));
      });
    }
  };
  const quitarAdjunto = (id: string) => {
    const a = adjuntosRef.current.find((x) => x.id === id);
    if (a) URL.revokeObjectURL(a.url);
    leidos.current.delete(id);
    ponerAdjuntos(adjuntosRef.current.filter((x) => x.id !== id));
  };
  const adjuntosCaja: AdjuntosDeCaja = {
    items: adjuntos, puede: !p.deshabilitado, onSumar: sumarAdjuntos, onQuitar: quitarAdjunto, accept: ACCEPT_ARCHIVO_FLUJO,
    onSinImagen: (puedeLeer) => setError({ texto: puedeLeer ? 'No hay una imagen copiada.' : 'Este navegador no deja pegar.' }),
  };
  /** ➤ de la caja: lo escrito y lo adjuntado (ya leído). Si no salió, vuelve todo a la caja. */
  // La cita es de ESTA automatización: al abrir otra no viaja (la clave del hook).
  const cita = useCitaDelChat(p.secuenciaId ?? null);
  const mandar = async () => {
    if (trabajando || interpretando || p.deshabilitado) return;
    if (adjuntosRef.current.some((a) => a.estado === 'leyendo')) { setError({ texto: 'Espera a que termine de leer el archivo.' }); return; }
    const escrito = texto;
    const antes = adjuntosRef.current;
    const adj = antes.filter((a) => leidos.current.has(a.id)).map((a) => ({ nombre: a.file.name || 'archivo', texto: leidos.current.get(a.id)! }));
    if (!escrito.trim() && !adj.length) return;
    setTexto(''); ponerAdjuntos([]);
    // «Responder» del clic derecho (6/11/2026, useCitaDelChat): la cita sale adelante de lo escrito, y se suelta sólo si salió.
    const r = await enviarTexto(cita.con(escrito, adj.length > 0), 'barra', adj);
    if (r === true || !vivo.current) { for (const a of antes) URL.revokeObjectURL(a.url); if (r === true) cita.soltar(); return; }
    setTexto(escrito); ponerAdjuntos(antes);
    if (r.error) setError({ texto: r.error });
  };

  const preguntaViva = !trabajando && ronda ? ronda.pregunta : null;
  const ultimoMako = mensajes.reduce((k, m, i) => (m.de === 'mako' ? i : k), -1);
  const porId = useMemo(() => new Map(mensajes.map((m, i) => [m.id, { m, i }] as const)), [mensajes]);
  // El hilo guardado y lo de esta pantalla (los pedidos sueltos), en el orden en que pasaron.
  const hilo = useMemo(() => {
    const deChat = hiloDeChat(mensajes);
    if (!extras.length) return deChat;
    const conHora = (h: HiloMsg, k: number) => ({ h, t: Date.parse(String(h.fecha ?? '')) || 0, k });
    const deAca = extras.map((x, k) => conHora({ id: x.id, fromMe: !!x.yo, texto: x.yo ?? x.mako?.texto ?? '', fecha: x.at, autor: x.yo ? null : 'MaKo' }, deChat.length + k));
    // Lo guardado sin hora (una línea de sistema) se queda pegado a lo anterior: hereda la hora de su vecino.
    let previa = 0;
    const guardados = deChat.map((h, k) => { const x = conHora(h, k); previa = x.t || previa; return { ...x, t: previa }; });
    return [...guardados, ...deAca].sort((a, b) => a.t - b.t || a.k - b.k).map((x) => x.h);
  }, [mensajes, extras]);
  const extraPorId = useMemo(() => new Map(extras.map((x) => [x.id, x] as const)), [extras]);
  const segundos = estado.t === 'trabajando' ? Math.max(0, Math.round((ahora - estado.desde) / 1000)) : 0;
  const placeholder = ronda ? PLACEHOLDER_OTRA : crea ? PLACEHOLDER_QUIETO : PLACEHOLDER_EDITAR;

  // LA CABECERA ÚNICA (23/10/2026, «Tienes que UNIFICAR los chats con MaKo»): la del panel del Ops Center (PanelChat.tsx), con
  // la estrella de MaKo (adentro de `[data-chat-sidebar]`, como `role="img"` «MaKo»: la busca el vuelo del loader), «en línea» o
  // escribiendo al lado, la «←» a la lista antes de la criatura y el ✕. Antes era una cabecera propia.
  const volverALista = (
    <>
      {p.onVolver && (
        <button type="button" className="chm-x" data-volver-lista="" onClick={p.onVolver} aria-label={ROTULO_VOLVER} title={ROTULO_VOLVER}>←</button>
      )}
    </>
  );
  const cabecera: CabeceraChat = {
    clave: `automations:${p.secuenciaId}`, titulo: 'MaKo', criatura: 'MaKo', aspecto: ASPECTO_MAKO,
    animo: trabajando ? 'trabajando' : 'despierto', antes: volverALista,
    acciones: <>
      <span data-estado-mako="" style={{ ...S.estado, color: trabajando ? 'var(--mako-ink)' : 'var(--faint)' }}>{trabajando ? ESTADO_ESCRIBIENDO : ESTADO_EN_LINEA}</span>
      {p.onCerrar && (
        <button type="button" className="chm-x" onClick={p.onCerrar} aria-label="Cerrar el chat" title="Cerrar" style={{ marginLeft: 'auto' }}>✕</button>
      )}
    </>,
  };

  const errorMako = error ? <p data-error-mako="" style={S.error} role="alert"><TextoConLink texto={error.texto} link={error.link} /><ReportarASoporte /></p> : null;
  const encima = estado.t === 'trabajando'
    ? <FasesIA estado={estado} segundos={segundos} onCancelar={cancelar} />
    : enServidor ? <EnElServidor />
    : crea ? errorMako
      : <>{errorMako}<SelectorIntencion valor={intencion} onCambio={elegirIntencion} deshabilitado={!!p.deshabilitado} /></>;

  const { items, enGlobo } = hiloUnico({
    hilo, porId, extraPorId, total: mensajes.length, preguntaViva, ultimoMako, deshabilitado: !!p.deshabilitado, trabajando,
    elegir, tocarBurbuja, voces: voces.current, secuenciaId: p.secuenciaId, abrirConfiguraciones: p.onAbrirConfiguraciones,
  });

  return (
    <div ref={raizRef} data-chat-mako="editar" style={S.raiz}>
      <style>{CSS}</style>
      <ChatMakoVista
        cabecera={cabecera}
        items={items}
        enMensaje={(m) => enGlobo.get(m.id) ?? null}
        escribiendo={trabajando || interpretando ? { segs: segundos } : null}
        vacio={<div style={S.vacio}>{crea ? VACIO_CREAR : VACIO_EDITAR}</div>}
        onReintentar={(id) => { const e = extrasRef.current.find((y) => y.id === id); if (e?.yo !== undefined) reintentar(e.id, e.yo); }}
        encima={encima}
        caja={{
          texto, onTexto: (v) => { setError(null); setTexto(v); }, onMandar: () => void mandar(),
          ocupado: trabajando || interpretando, apagado: !!p.deshabilitado, placeholder, enterManda: true, tituloMandar: 'Enviar',
          adjuntos: adjuntosCaja, arriba: cita.arriba,
          voz: { onAudio: (b, segs) => { void enviarAudio(b, segs); }, onError: (m) => setError({ texto: m }), rotuloEnviar: 'Enviar audio' },
          bloqueo: appEscritorio.bloqueo,
        }}
        onCitar={cita.citar}
      />
    </div>
  );
}

/**
 * EL HILO ÚNICO (23/10/2026, AU4): cada mensaje del chat como `ItemHilo` (app/_chat/HiloMako.tsx), y lo de ChatMako adentro
 * del globo de MaKo (`enGlobo`, que la vista le pasa como `enMensaje`): «✓ Listo», lo que faltó en rojo, lo acomodado
 * plegado, la pregunta viva, los botones de un pedido suelto y el botón de lo que falta conectar. Exportada: los tests la
 * miran sin dibujar las piezas (traen CSS).
 */
export function hiloUnico(o: {
  hilo: readonly HiloMsg[];
  porId: ReadonlyMap<string, { m: MensajeChatMako; i: number }>;
  extraPorId: ReadonlyMap<string, ExtraChat>;
  /** Cuántos mensajes guardados hay (la pregunta viva es la del último). */
  total: number;
  preguntaViva: PreguntaMako | null;
  ultimoMako: number;
  deshabilitado: boolean;
  trabajando: boolean;
  elegir: (e: EleccionMako) => void;
  tocarBurbuja: (id: string, boton: string) => void;
  /** La nota de voz de cada mensaje propio de esta sesión, por su id (f17). */
  voces?: ReadonlyMap<string, { url: string; secs: number }>;
  /** De qué automatización es el chat: el botón de lo que falta (f23) se lo pasa al equipo desde ésta. */
  secuenciaId?: number;
  /** Abre Configuraciones (f19): el globo que la nombra lleva la tuerca de verdad. */
  abrirConfiguraciones?: () => void;
}): { items: ItemHilo[]; enGlobo: Map<string, EnMensaje> } {
  const { hilo, porId, extraPorId, preguntaViva } = o;
  const enGlobo = new Map<string, EnMensaje>();
  const items: ItemHilo[] = [];
  for (const h of hilo) {
    const id = String(h.id);
    const e = extraPorId.get(id);
    if (e) {
      if (e.yo !== undefined) {
        items.push({ k: 'msg', id, role: 'user', texto: e.yo, at: e.at, ...(e.adjuntos?.length ? { archivos: archivosDe(e.adjuntos.map((a) => a.nombre)) } : {}),
          ...(e.voz ? { voz: { url: e.voz.url, secs: e.voz.secs } } : {}),
          ...(e.enviando ? { estado: 'enviando' as const } : {}),
          ...(e.fallido !== undefined ? { estado: 'error' as const, error: e.voz && !e.yo ? e.fallido : NO_SE_ENVIO } : {}) });
      } else if (e.b) {
        const x = parteDePedido(e.b, (boton) => o.tocarBurbuja(e.id, boton), o.deshabilitado);
        items.push({ k: 'msg', id, role: 'assistant', texto: x.texto, at: e.at });
        enGlobo.set(id, x.en);
      } else if (e.mako) {
        items.push({ k: 'msg', id, role: 'assistant', texto: e.mako.texto, at: e.at });
        if (e.mako.link) enGlobo.set(id, { abajo: <LinkIntegracion href={e.mako.link} style={S.botonArreglo}>{servicioDeLink(e.mako.link) ? 'Conectar' : 'Abrir'}</LinkIntegracion> });
      }
      continue;
    }
    const x = porId.get(id);
    if (!x) continue;
    if (x.m.de === 'yo') {
      // De qué tarjeta salió (el ✦, punto 7): el chip «desde» arriba de su globo.
      const voz = o.voces?.get(id);
      items.push({ k: 'msg', id, role: 'user', texto: x.m.texto, at: x.m.at, ...(x.m.tarjeta ? { desde: `«${x.m.tarjeta}»` } : {}),
        ...(x.m.adjuntos?.length ? { archivos: archivosDe(x.m.adjuntos) } : {}), ...(voz ? { voz: { url: voz.url, secs: voz.secs } } : {}) });
      continue;
    }
    const viva = x.i === o.total - 1 && preguntaViva && x.m.pregunta?.id === preguntaViva.id ? preguntaViva : null;
    const pm = parteDeMako(x.m, viva, x.i === o.ultimoMako, o.elegir, o.trabajando || o.deshabilitado, o.secuenciaId, o.abrirConfiguraciones);
    items.push({ k: 'msg', id, role: 'assistant', texto: pm.texto, at: x.m.at });
    enGlobo.set(id, pm.en);
  }
  return { items, enGlobo };
}

/** Los archivos de un mensaje de la persona, para el hilo: el nombre y si es una imagen. No se abren: se guardó lo leído. */
function archivosDe(nombres: readonly string[]): ArchivoHilo[] {
  return nombres.map((nombre) => ({ nombre, tipo: /\.(png|jpe?g|webp|gif|heic)$/i.test(nombre) ? 'image' as const : 'document' as const, sinAbrir: true }));
}

/**
 * Lo de un mensaje de MaKo, para el globo del hilo único: su texto y lo que va arriba y abajo. Si es la pregunta VIVA (la
 * última, sin contestar), sus botones; las de antes, sólo el texto.
 * ⚠️ «LISTO», EN VERDE, Y LO DEMÁS EN GRIS (22/10/2026, Martín: «El mensaje una vez realizada una tarea se tiene que ver como
 * "Success". Si me ponés un mensaje en rojo abajo y el de arriba no dice algo como "Listo!", parece que no funcionó»). Un
 * turno que cambió el lienzo sin nada pedido afuera: «✓ Listo» y lo que quedó en UNA línea; el detalle tarjeta por tarjeta y
 * lo que MaKo acomodó solo, plegados y en gris. En rojo, SÓLO lo pedido que no se hizo (`noHecho`).
 */
function parteDeMako(m: MensajeChatMako, viva: PreguntaMako | null, ultimo: boolean, onElegir: (e: EleccionMako) => void, deshabilitado: boolean, secuenciaId?: number, abrirConfiguraciones?: () => void): { texto: string; en: EnMensaje } {
  const preguntaAparte = m.pregunta && m.pregunta.texto.trim() !== m.texto.trim() ? m.pregunta.texto : null;
  const listo = lineaDeListo(m);
  const texto = listo ?? [m.texto, preguntaAparte].filter((t) => t && t.trim()).join('\n\n');
  const detalle = listo ? m.texto.split('\n').filter((l) => l.trim() && l.trim() !== CIERRE_EDICION) : [];
  const acomodado = [...detalle, ...(m.avisos ?? [])];
  return {
    texto,
    en: {
      arriba: listo ? <span data-listo-mako="" style={S.listo}>✓ Listo</span> : null,
      abajo: (
        <>
          {m.noHecho?.length ? (
            <ul data-no-hecho-mako="" role="alert" style={S.noHecho}>
              {m.noHecho.map((a, i) => <li key={i}>{a}</li>)}
              <li><ReportarASoporte /></li>
            </ul>
          ) : null}
          {acomodado.length ? (
            <details data-avisos-mako="" style={{ ...S.avisos, ...(ultimo ? null : { opacity: 0.75 }) }}>
              <summary style={S.avisosTitulo}>{listo ? 'Qué cambió' : 'Lo que acomodé'} ({acomodado.length})</summary>
              <ul style={S.avisosLista}>{acomodado.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </details>
          ) : null}
          {viva && <TarjetaPregunta pregunta={viva} onElegir={onElegir} deshabilitado={deshabilitado} />}
          {m.falta && secuenciaId != null && <PedirAlEquipo secuenciaId={secuenciaId} falta={m.falta} />}
          {abrirConfiguraciones && nombraConfiguraciones(m.texto) && <TuercaEnElGlobo onClick={abrirConfiguraciones} />}
          {/* QUÉ IA CONTESTÓ (27/10/2026, el Cerebro: «el chat dice qué IA contestó»): chico y en gris, al pie. */}
          {m.ia && <span data-ia-mako="" style={S.ia}>{m.ia}</span>}
        </>
      ),
    },
  };
}

/** ¿El mensaje de MaKo manda a Configuraciones? Entonces lleva la tuerca (f19). */
export const nombraConfiguraciones = (texto: string): boolean => /\bConfiguraciones\b/.test(texto);

/**
 * LA TUERCA DE VERDAD EN EL GLOBO (24/10/2026, f19 de la llamada con Leandro: «Maco debería poder enviar íconos... el ícono de
 * configuraciones no es el correcto... Fíjate dónde está»): el mismo ícono del botón del título (`BotonTuerca`,
 * ./SecuenciaPerfil.tsx, `Icon name="tuerca"`: la tuerca de verdad desde el 25/10/2026) con su nombre, y abre Configuraciones. Así lo que dice MaKo y lo que se ve son
 * lo mismo, y no hay que buscarlo.
 */
function TuercaEnElGlobo({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" data-tuerca-mako="" onClick={onClick} title="Abrir Configuraciones de esta automatización" style={S.tuercaGlobo}>
      <Icon name="tuerca" size={15} />
      <span>Configuraciones</span>
    </button>
  );
}

/**
 * UN PEDIDO SUELTO (16/10/2026, ./pedidos-chat.ts), para el globo del hilo único: el texto de MaKo, sus botones (con los de
 * la pregunta) y sus links (el `Link` de la casa: conserva el ?ws=). Lo que dice y qué botón está prendido lo decide
 * `vistaDeBurbuja`.
 */
function parteDePedido(b: BurbujaPedido, onBoton: (boton: string) => void, deshabilitado: boolean): { texto: string; en: EnMensaje } {
  const v = vistaDeBurbuja(b);
  return {
    texto: v.texto,
    en: {
      abajo: (
        <div data-pedido-suelto={b.tipo}>
          {(v.botones.length > 0 || v.links.length > 0) && (
            <div style={S.opciones} role="group" aria-label={v.texto}>
              {v.botones.map((x) => (
                <button key={x.id} type="button" className={`chm-op${x.v === 'contorno' ? ' chm-op--suave' : ''}`} data-boton-pedido={x.id}
                  aria-pressed={x.elegido || undefined} disabled={deshabilitado || x.apagado} onClick={() => onBoton(x.id)}>{x.texto}</button>
              ))}
              {v.links.map((l) => <Link key={l.href} href={l.href} className="chm-op chm-op--suave" data-link-pedido="">{l.texto}</Link>)}
            </div>
          )}
          {v.nota && <p style={{ ...S.dim, margin: '4px 0 0', color: v.error ? 'var(--bad)' : undefined }} role={v.error ? 'alert' : 'status'}>{v.nota}<ReportarASoporte /></p>}
        </div>
      ),
    },
  };
}

/**
 * LA PREGUNTA COMO LOS BOTONES DE RESPUESTA DE WHATSAPP (§2.4, el molde de Claude): de 2 a 4 botones con los rótulos
 * del catálogo TAL CUAL, más «Otra cosa» (enfoca la barra: lo que se escriba es la respuesta) y «Elige tú» (`valor:
 * null`: MaKo elige sola). Exportada: la dibuja el test.
 */
export function TarjetaPregunta({ pregunta, onElegir, onOtraCosa, deshabilitado }: {
  pregunta: PreguntaMako; onElegir: (e: EleccionMako) => void; onOtraCosa?: () => void; deshabilitado?: boolean;
}) {
  // «Otra cosa»: la barra de abajo (la del hilo), con el foco. Sin quien la enfoque, la busca en el chat.
  const otraCosa = (e: { currentTarget: HTMLElement }) => {
    if (onOtraCosa) { onOtraCosa(); return; }
    e.currentTarget.closest('[data-chat-mako]')?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
  };
  return (
    <div data-pregunta-mako={pregunta.sobre} style={S.opciones} role="group" aria-label={pregunta.texto}>
      {pregunta.opciones.map((o) => (
        <button key={o.valor} type="button" className="chm-op" data-opcion={o.valor} title={o.detalle}
          disabled={deshabilitado} onClick={() => onElegir({ valor: o.valor })}>{o.label}</button>
      ))}
      <button type="button" className="chm-op chm-op--suave" data-otra-cosa="" disabled={deshabilitado} onClick={otraCosa}>{OTRA_COSA}</button>
      <button type="button" className="chm-op chm-op--suave" data-elige-tu="" disabled={deshabilitado} onClick={() => onElegir({ eligeTu: true })}>{ELIGE_TU}</button>
    </div>
  );
}

/** Las fases REALES del server, lo que lleva y Cancelar (menos en «Verificando»), arriba de la barra. */
function FasesIA({ estado, segundos, onCancelar }: {
  estado: Extract<EstadoIA, { t: 'trabajando' }>; segundos: number; onCancelar: () => void;
}) {
  // «Pensando la respuesta» ocupa el punto de «Escribiendo el flujo»: es la misma vuelta del modelo.
  const actual = estado.fase ? ORDEN_FASES.indexOf(estado.fase === 'respuesta' ? 'modelo' : estado.fase) : -1;
  return (
    <div style={S.fases} role="status" aria-live="polite" data-crear-ia-fases="">
      <span aria-hidden style={S.puntos}>
        {ORDEN_FASES.map((f, i) => (
          <span key={f} style={{ ...S.punto, background: i < actual ? 'var(--good)' : i === actual ? 'var(--mako)' : 'var(--border)' }} />
        ))}
      </span>
      <span style={S.rotulo}>{estado.fase ? TEXTO_FASE[estado.fase] : GRAMATICA.analizando.rotulo}</span>
      {estado.fase === 'revision' && estado.reparadas ? <span style={S.dim}>· {estado.reparadas} {estado.reparadas === 1 ? 'arreglo' : 'arreglos'}</span> : null}
      {/* El anterior no sirvió y se prueba otro (#847: «que diga en qué está»): lo dice la ruta, no un reloj. */}
      {estado.fase === 'modelo' && estado.intento && estado.intento > 1 ? <span style={S.dim}>· intento {estado.intento}</span> : null}
      {/* ⚠️ EL TOPE SALE DEL TOPE REAL (revisión, 09/10/2026): «75 s · hasta 1 min» se lee como colgado y la persona
          cancela un pedido que iba a terminar. */}
      <span style={{ ...S.dim, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{segundos} s · hasta {Math.round(TOPE_CLIENTE_MS / 60_000)} min</span>
      {/* ⚠️ SIN «Cancelar» EN «Verificando» (revisión, 09/10/2026): el server mira la señal una sola vez, antes de
          esa fase, y después crea las etiquetas y guarda igual. */}
      {estado.fase !== 'revision' && <button type="button" onClick={onCancelar} style={S.cancelar}>Cancelar</button>}
    </div>
  );
}

/** Volvió mientras MaKo la armaba en el servidor (14/11/2026): lo dice, sin Cancelar (ya no es un pedido de esta pestaña). */
export const TEXTO_EN_EL_SERVIDOR = 'MaKo la sigue armando: te aviso cuando esté lista.';
function EnElServidor() {
  return (
    <div style={S.fases} role="status" aria-live="polite" data-crear-ia-servidor="">
      <span aria-hidden style={S.puntos}><span style={{ ...S.punto, background: 'var(--mako)' }} /></span>
      <span style={S.rotulo}>{TEXTO_EN_EL_SERVIDOR}</span>
    </div>
  );
}

/**
 * El error, con la palabra «Integraciones» convertida en el lugar donde se arregla (si lo hay). Un link que nombra una
 * integración (`/integraciones?abrir=gemini`) abre SU modal acá (`LinkIntegracion`, 14/10/2026: «para una integración
 * jamás se debe salir de la tab»); cualquier otro sigue siendo un link.
 */
function TextoConLink({ texto, link }: { texto: string; link?: string }) {
  if (!link) return <>{texto}</>;
  const i = texto.indexOf('Integraciones');
  if (i < 0) return <>{texto} <LinkIntegracion href={link} style={S.link}>Abrir</LinkIntegracion></>;
  return <>{texto.slice(0, i)}<LinkIntegracion href={link} style={S.link}>Integraciones</LinkIntegracion>{texto.slice(i + 'Integraciones'.length)}</>;
}

// ── «Pídeselo a MaKo»: la caja del modal «Nueva automatización» ─────────────────────────────────────

/** El «+» de la caja (decimoquinta tanda, punto 7): subir un archivo o una imagen, y pegar un flujo. */
export const MAS_ARCHIVO = 'archivo';
export const MAS_PEGAR = 'pegar';

/**
 * EL «+» DE LA CAJA (decimoquinta tanda, punto 7). Martín, textual: «en el botón de "+" en esa sección, no tiene sentido
 * las opciones de lienzo en blanco y plantilla, si para eso ya tenemos eso abajo, ahí se debería poder cargar archivos o
 * imagenes para que la IA lo interprete y cree flujo a raiz de eso... Y también ahí una opción para pegar el flujo que
 * copié o me pasaron con el botón de "Copiar flujo"». «Pegar un flujo» sólo si quien monta puede crearlo (`onFlujo`).
 * Pura y exportada para el test.
 */
export function accionesMas(conPegar: boolean): DropdownOption[] {
  return [
    { value: MAS_ARCHIVO, label: 'Subir archivo o imagen', icono: 'subir' },
    ...(conPegar ? [{ value: MAS_PEGAR, label: 'Pegar un flujo', icono: 'copiar' as const }] : []),
  ];
}

/** Lo que dice la caja cuando lo pegado no es un flujo (o el token no existe). */
export const NO_ES_FLUJO = 'No encontré ese flujo.';
/** «Pegar un flujo» sin un flujo en el portapapeles. */
export const SIN_FLUJO_COPIADO = 'No hay un flujo copiado.';
/** «Pegar un flujo» sin permiso para leer el portapapeles. */
export const PEGALO_A_MANO = 'Pega el flujo en la caja (Ctrl+V).';
/** El placeholder con un archivo adjunto (el ejemplo no se mueve: el pedido ya es el archivo). */
export const PLACEHOLDER_ARCHIVO = 'Qué hacer con el archivo (opcional)';

/** El archivo de la caja: leyéndose, leído (con su texto) o que no se pudo leer. */
/**
 * El archivo de la caja (16/10/2026, lib/archivo-del-pedido.ts): se ELIGE y recién al mandar se decide para qué es.
 * 'subiendo' = contenido del flujo, a la biblioteca sin leerlo; 'leyendo' = instrucciones, se lee.
 */
type ArchivoCaja = { nombre: string; imagen: boolean; file: File; estado: 'elegido' | 'subiendo' | 'leyendo' };

/**
 * LA CAJA DE «PÍDESELO A MaKo» (décima tanda, punto 6; decimotercera, puntos 1, 2 y 4; decimocuarta, puntos 1 y 2;
 * DECIMOQUINTA, puntos 1, 6, 7 y 8). Martín, 12/10/2026, con la captura de la caja «¿Qué vas a crear hoy?» del Landing
 * Generator: «Vuelve a crear el modal de "pideselo a MaKo" y que se vea exactamente igual que en la captura... Ya lo
 * tenemos en landing generator, copialo» y «elimina el texto de "Nace pausada"». ES ESA CAJA (`CajaPedido`,
 * app/web-generator/CajaPedido.tsx), no una copia: el título «¿Qué vas a crear hoy?» (decimoquinta, punto 1), la
 * tarjeta blanca, el ejemplo que se escribe solo (`EJEMPLOS`: para mientras la caja tiene el foco y vuelve si se sale
 * sin escribir, punto 6), el «+» azul, el micrófono de la casa (dicta en el campo; se lee antes de mandar) y el ↑.
 *
 * El «+» (decimoquinta, punto 7, `accionesMas`):
 *   · «Subir archivo o imagen»: queda como chip arriba del campo, SIN LEERLO. Al enviar se decide con lo escrito
 *     (16/10/2026, lib/archivo-del-pedido.ts): si es CONTENIDO del flujo («dando este lead magnet») va a la biblioteca
 *     y el pedido lo nombra; si es INSTRUCCIONES, lo lee el server (`archivoATexto`; una imagen, por visión) y va al
 *     pedido (`pedidoConArchivo`, ./CrearConIA.tsx). Si falla, el pedido sale igual.
 *   · «Pegar un flujo»: lee el portapapeles. Lo mismo que pegar con Ctrl+V en el campo.
 * UN FLUJO PEGADO (decimoquinta, punto 8: «en lugar de ver el token debería decir "Flujo copiado: NOMBRE DEL FLUJO"»):
 * un token o el texto entero de una copia SALE del campo (`copiaPegada`) y en su lugar se lee «Flujo copiado: <nombre>»
 * (el nombre lo da el server: `resumenDePegado`). El ↑ lo crea en ESTE negocio (`onFlujo`, «Pegar lo copiado»).
 *
 * ⚠️ SIN EL CHIP «Plan | Express» de la landing: acá no hay un modo que elegir (MaKo pregunta lo que le falta en el chat
 * de la fila, con botones). Un chip que no cambia nada sería inventado.
 *
 * NO trabaja acá: manda el pedido a quien monta (`onPedido`), que cierra el modal, crea la fila YA y abre su lienzo con el
 * chat (decimotercera, punto 2).
 */
export function BarraPideselo({ onPedido, onFlujo, deshabilitado, inicial }: {
  onPedido: (pedido: string) => void;
  /** Crear la automatización de un flujo pegado (el token o el texto entero). Sin esto, ni «Pegar un flujo» ni el chip. */
  onFlujo?: (copia: string) => void;
  deshabilitado?: boolean;
  /** Lo escrito que vuelve (la fila no se pudo crear): con algo escrito, el ejemplo no se mueve. */
  inicial?: string | null;
}) {
  const [texto, setTexto] = useState(inicial ?? '');
  const [error, setError] = useState<string | null>(null);
  /** El flujo pegado: lo que va al server y su nombre (null mientras el server contesta). */
  const [flujo, setFlujo] = useState<{ copia: string; nombre: string | null } | null>(null);
  const [archivo, setArchivo] = useState<ArchivoCaja | null>(null);
  // Sin la app de escritorio, la caja de pedido tampoco escribe (25/10/2026): app/_chat/useAppDeEscritorio.tsx.
  const appEscritorio = useAppDeEscritorio();
  const vezFlujo = useRef(0);
  const subida = useRef<AbortController | null>(null);
  const elegirArchivo = useRef<HTMLInputElement>(null);
  useEffect(() => () => subida.current?.abort(), []);

  const quitarArchivo = () => { subida.current?.abort(); subida.current = null; setArchivo(null); };
  const ponerFlujo = (copia: string) => {
    const vez = ++vezFlujo.current;
    quitarArchivo();
    setError(null);
    setFlujo({ copia, nombre: null });
    void resumenDePegado(copia).then((r) => {
      if (vezFlujo.current !== vez) return;
      if (!r) { setFlujo(null); setError(NO_ES_FLUJO); return; }
      setFlujo({ copia, nombre: r.nombre });
    });
  };
  const quitarFlujo = () => { vezFlujo.current++; setFlujo(null); };
  /** Lo escrito o pegado en el campo: un flujo de MaKo sale del texto y queda como «Flujo copiado: …». */
  const alEscribir = (v: string) => {
    const pegado = onFlujo ? copiaPegada(v) : null;
    if (pegado) { setTexto(pegado.resto); ponerFlujo(pegado.copia); return; }
    setTexto(v);
  };
  const pegarDelPortapapeles = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) { setError(PEGALO_A_MANO); return; }
    navigator.clipboard.readText().then((t) => {
      const pegado = copiaPegada(t);
      if (!pegado) { setError(SIN_FLUJO_COPIADO); return; }
      ponerFlujo(pegado.copia);
    }).catch(() => setError(PEGALO_A_MANO));
  };
  // ⚠️ ELEGIR NO LO LEE (16/10/2026, Martín: «otras como esta, son docs o cosas para DENTRO de la automatización... Debe
  // razonar»): hasta ese día se leía con visión apenas se elegía, y con la IA caída («gemini high demand») la caja no
  // dejaba mandar. Ahora se decide AL MANDAR, con lo escrito (`usoDelArchivo`).
  const subir = (file: File) => {
    quitarFlujo();
    quitarArchivo();
    setError(null);
    setArchivo({ nombre: file.name, imagen: file.type.startsWith('image/'), file, estado: 'elegido' });
  };
  /**
   * EL ARCHIVO, AL MANDAR: CONTENIDO del flujo («dando este lead magnet») se sube a la biblioteca SIN LEERLO y el pedido lo
   * nombra con su id; INSTRUCCIONES se lee. Si subir o leer falla, el pedido sale IGUAL y lo dice (`pedidoSinLeer`): la
   * creación no depende del archivo.
   */
  const mandarConArchivo = (a: ArchivoCaja, escrito: string) => {
    const ac = new AbortController();
    subida.current = ac;
    if (usoDelArchivo(escrito) === 'contenido') {
      setArchivo({ ...a, estado: 'subiendo' });
      void subirArchivoDelPedido(a.file, ac.signal).then((r) => {
        if (ac.signal.aborted) return;
        setArchivo(null);
        onPedido(r.ok ? pedidoConContenido(escrito, { nombre: a.nombre, id: r.id }) : pedidoSinLeer(escrito, a.nombre, 'subir'));
      });
      return;
    }
    setArchivo({ ...a, estado: 'leyendo' });
    void leerArchivoParaPedido(a.file, ac.signal).then((r) => {
      if (ac.signal.aborted) return;
      setArchivo(null);
      onPedido(r.ok ? pedidoConArchivo(escrito, { nombre: a.nombre, texto: r.texto }) : pedidoSinLeer(escrito, a.nombre));
    });
  };
  const alMas = (v: string) => {
    if (v === MAS_ARCHIVO) elegirArchivo.current?.click();
    else if (v === MAS_PEGAR) pegarDelPortapapeles();
  };
  /** ¿Se puede mandar? Un flujo con nombre, un archivo elegido, o algo escrito (y nada subiéndose ni leyéndose). */
  const listo = flujo ? !!flujo.nombre : archivo ? archivo.estado === 'elegido' : !!texto.trim();
  const mandar = () => {
    if (deshabilitado || !listo || appEscritorio.bloqueada) return;
    setError(null);
    if (flujo) { onFlujo?.(flujo.copia); return; }
    if (archivo?.estado === 'elegido') { mandarConArchivo(archivo, texto); return; }
    onPedido(texto.trim());
  };
  return (
    <div className="gp cp-casa" data-chat-mako="galeria" data-crear-ia-caja="galeria">
      <style>{CSS_TOKENS_CASA + CSS_CAJA_PEDIDO}</style>
      <CajaPedido titulo={{ texto: TITULO_CAJA, nivel: 2 }} valor={texto} onValor={alEscribir} onEnviar={mandar} listo={listo}
        ejemplos={EJEMPLOS} animar={!archivo} placeholderQuieto={archivo ? PLACEHOLDER_ARCHIVO : PLACEHOLDER_QUIETO}
        etiqueta="Qué tiene que hacer la automatización" deshabilitado={deshabilitado} onError={setError} bloqueo={appEscritorio.bloqueo}
        adjunto={archivo ? (
          <ChipCaja icono={archivo.imagen ? 'imagen' : 'archivo'} texto={archivo.nombre}
            detalle={archivo.estado === 'leyendo' ? 'Leyendo…' : archivo.estado === 'subiendo' ? 'Subiendo…' : null} onQuitar={quitarArchivo} etiquetaQuitar="Quitar el archivo" />
        ) : null}
        enLugarDelCampo={flujo ? (
          <ChipCaja icono="flujo" texto={rotuloFlujoPegado(flujo.nombre ?? '…')} onQuitar={quitarFlujo} etiquetaQuitar="Quitar el flujo" />
        ) : null}
        antes={(
          <Dropdown value="" resetAfterSelect sinFlecha search={false} ariaLabel="Agregar" disabled={deshabilitado}
            botonLabel={<Ico n="mas" t={16} />} options={accionesMas(!!onFlujo)} onChange={alMas} menuMinAncho={240}
            buttonStyle={BOTON_MAS} />
        )} />
      <input ref={elegirArchivo} type="file" accept={ACCEPT_ARCHIVO_FLUJO} hidden tabIndex={-1} aria-hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) subir(f); }} />
      {error && <p role="alert" style={{ ...S.error, margin: '-6px 0 0', maxWidth: 720, width: '100%' }}>{error}<ReportarASoporte /></p>}
    </div>
  );
}

/** El «+» de la caja (`.gp-cc-mas` de CajaPedido) con el desplegable de la casa: 34 redondo, el azul de Gamma. */
const BOTON_MAS: CSSProperties = {
  width: 34, height: 34, padding: 0, border: 0, borderRadius: 9999, justifyContent: 'center',
  background: 'var(--gp-azul-50)', color: 'var(--gp-azul-600)',
};

// ⚠️ EL HOVER VA EN LA CLASE, NUNCA EN EL `style` (docs/hallazgos-chatbot.md, parte «horario»: un `border` en línea
// anula el `:hover` de la clase). Sólo tokens que existen en claro y en oscuro (app/globals.css).
const CSS = `
.chm-op{font:inherit;font-size:13.5px;font-weight:600;line-height:1.3;text-align:center;padding:8px 12px;border-radius:10px;border:1px solid var(--mako-border);background:var(--surface);color:var(--mako-ink);cursor:pointer;transition:border-color .14s ease,background .14s ease}
.chm-op:hover:not(:disabled),.chm-op:focus-visible{border-color:var(--mako);background:var(--mako-bg);outline:none}
.chm-op:disabled{cursor:default;opacity:.55}
.chm-op--suave{font-weight:500;color:var(--dim);border-color:var(--border)}
.chm-x{flex:none;border:none;background:none;color:var(--dim);font-size:14px;cursor:pointer;padding:4px 6px;border-radius:6px}
.chm-x:hover{color:var(--ink);background:var(--surface-2)}
@media (prefers-reduced-motion: reduce){.chm-op{transition:none}}
`;

const S: Record<string, CSSProperties> = {
  // El chat llena la caja que le da quien monta (un alto DEFINIDO: `ChatHilo` mide con `height: 100%`).
  raiz: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', minHeight: 0, boxShadow: '0 12px 34px rgba(18,21,27,.18)', borderRadius: 16 },
  // CON SU RELLENO (23/10/2026, Martín: «se corta el diseño del chat de MaKo al costado, con la criatura de MaKo y la topbar
  // de ese chat cortado»): el margen negativo era del `ChatHilo` de antes, que tenía relleno. Sin él, la cabecera salía 4 px
  // por encima del panel (que recorta) y el hilo le pisaba 4 px abajo.
  estado: { fontSize: 12, lineHeight: 1.3 },
  filaMako: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, minWidth: 0 },
  // Lo que MaKo acomodó solo y el detalle de un «Listo»: plegado y en GRIS (22/10/2026: en rojo, sólo lo pedido que no se hizo).
  avisos: { maxWidth: '92%', fontSize: 12.5, color: 'var(--faint)' },
  avisosTitulo: { cursor: 'pointer', fontWeight: 600, listStylePosition: 'inside' },
  avisosLista: { margin: '4px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 },
  listo: { alignSelf: 'flex-start', fontSize: 12.5, fontWeight: 700, color: 'var(--good)' },
  ia: { fontSize: 11.5, color: 'var(--faint)' },
  noHecho: { margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12.5, color: 'var(--bad)', maxWidth: '92%' },
  opciones: { display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: '92%' },
  vacio: { margin: 'auto', color: 'var(--faint)', fontSize: 13.5, textAlign: 'center' },
  // EN UNA SOLA LÍNEA (22/10/2026, Martín: «no me gusta que "cancelar" tenga un salto de línea»): sin `wrap`; si falta lugar,
  // se achica el rótulo (`rotulo`, con «…»), nunca el tiempo ni Cancelar. Medido en producción: con el botón del kit (82 px)
  // y el rótulo largo no entraba nada; por eso el rótulo es de una palabra (stream-ia.ts) y Cancelar es un enlace (`cancelar`).
  fases: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', paddingBottom: 8, fontSize: 13, minWidth: 0 },
  puntos: { display: 'inline-flex', gap: 4, flex: 'none' },
  punto: { width: 7, height: 7, borderRadius: 999 },
  rotulo: { fontWeight: 600, color: 'var(--mako-ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dim: { fontSize: 12.5, color: 'var(--faint)' },
  error: { margin: '0 0 8px', fontSize: 13, lineHeight: 1.4, color: 'var(--bad)' },
  fallido: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, margin: '2px 4px 6px', fontSize: 12, color: 'var(--bad)' },
  reintentar: { border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' },
  tuercaGlobo: { alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '5px 11px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', fontSize: 12.5, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer', fontFamily: 'inherit' },
  botonArreglo: { alignSelf: 'flex-start', padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' },
  cancelar: { flex: 'none', border: 'none', background: 'none', padding: '4px 2px', font: 'inherit', fontSize: 12.5, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer' },
  link: { color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' },
};
